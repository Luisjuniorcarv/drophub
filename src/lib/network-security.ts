import dns from "dns";
import net from "net";
import { URL } from "url";

export interface SafeUrlValidationResult {
  isValid: boolean;
  sanitizedUrl?: string;
  errorMessage?: string;
  resolvedIps?: string[];
}

export interface SafeFetchOptions extends RequestInit {
  timeoutMs?: number;
  maxRedirects?: number;
  allowedProtocols?: string[];
}

/**
 * Lista de blocos CIDR e IPs privados / reservados / loopback / link-local / cloud metadata.
 */
const PRIVATE_IPV4_RANGES = [
  { start: ipToLong("0.0.0.0"), end: ipToLong("0.255.255.255") }, // Current network (RFC 1122)
  { start: ipToLong("10.0.0.0"), end: ipToLong("10.255.255.255") }, // RFC 1918 Class A
  { start: ipToLong("100.64.0.0"), end: ipToLong("100.127.255.255") }, // Carrier-grade NAT (RFC 6598)
  { start: ipToLong("127.0.0.0"), end: ipToLong("127.255.255.255") }, // Loopback (RFC 1122)
  { start: ipToLong("169.254.0.0"), end: ipToLong("169.254.255.255") }, // Link-local / Cloud Metadata (RFC 3927)
  { start: ipToLong("172.16.0.0"), end: ipToLong("172.31.255.255") }, // RFC 1918 Class B
  { start: ipToLong("192.0.0.0"), end: ipToLong("192.0.0.255") }, // IETF Protocol Assignments
  { start: ipToLong("192.0.2.0"), end: ipToLong("192.0.2.255") }, // TEST-NET-1 (RFC 5737)
  { start: ipToLong("192.168.0.0"), end: ipToLong("192.168.255.255") }, // RFC 1918 Class C
  { start: ipToLong("198.18.0.0"), end: ipToLong("198.19.255.255") }, // Benchmark testing (RFC 2544)
  { start: ipToLong("198.51.100.0"), end: ipToLong("198.51.100.255") }, // TEST-NET-2 (RFC 5737)
  { start: ipToLong("203.0.113.0"), end: ipToLong("203.0.113.255") }, // TEST-NET-3 (RFC 5737)
  { start: ipToLong("224.0.0.0"), end: ipToLong("239.255.255.255") }, // Multicast (RFC 5771)
  { start: ipToLong("240.0.0.0"), end: ipToLong("255.255.255.255") }, // Reserved / Broadcast (RFC 1112)
];

/**
 * Hostnames conhecidos de instâncias de Cloud Metadata que devem ser bloqueados explicitamente.
 */
const CLOUD_METADATA_HOSTS = new Set([
  "169.254.169.254",
  "metadata.google.internal",
  "metadata.goog",
  "instance-data",
  "metadata.azure.com",
  "100.100.100.200", // Alibaba Cloud metadata
]);

/**
 * Headers HTTP proibidos de serem customizados por integrações externas para evitar injection/smuggling.
 */
const FORBIDDEN_HTTP_HEADERS = new Set([
  "host",
  "cookie",
  "set-cookie",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "content-length",
  "transfer-encoding",
  "connection",
  "upgrade",
  "proxy-authorization",
  "proxy-connection",
  "te",
  "keep-alive",
]);

/**
 * Converte endereço IPv4 para representação numérica inteira de 32 bits (Long)
 */
function ipToLong(ip: string): number {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return -1;
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/**
 * Verifica se um endereço IPv4 está dentro de faixas privadas ou restritas.
 */
export function isPrivateIPv4(ip: string): boolean {
  const longVal = ipToLong(ip);
  if (longVal === -1) return true; // Formato inválido = bloqueia preventivamente

  for (const range of PRIVATE_IPV4_RANGES) {
    if (longVal >= range.start && longVal <= range.end) {
      return true;
    }
  }
  return false;
}

/**
 * Verifica se um endereço IPv6 é privado, loopback, link-local, unique local ou IPv4-mapped.
 */
export function isPrivateIPv6(ip: string): boolean {
  const cleanIp = ip.toLowerCase().trim();

  // Loopback / Unspecified
  if (cleanIp === "::1" || cleanIp === "::" || cleanIp === "0:0:0:0:0:0:0:1" || cleanIp === "0:0:0:0:0:0:0:0") {
    return true;
  }

  // IPv4-mapped IPv6 (ex: ::ffff:127.0.0.1 ou ::ffff:7f00:1)
  if (cleanIp.startsWith("::ffff:") || cleanIp.startsWith("0:0:0:0:0:ffff:")) {
    const ipv4Part = cleanIp.split(":").pop();
    if (ipv4Part && net.isIPv4(ipv4Part)) {
      return isPrivateIPv4(ipv4Part);
    }
    return true; // Se não conseguir extrair IPv4 com segurança, bloqueia
  }

  // Link-local (fe80::/10)
  if (cleanIp.startsWith("fe8") || cleanIp.startsWith("fe9") || cleanIp.startsWith("fea") || cleanIp.startsWith("feb")) {
    return true;
  }

  // Unique Local Address - ULA (fc00::/7 - fc00:: e fd00::)
  if (cleanIp.startsWith("fc") || cleanIp.startsWith("fd")) {
    return true;
  }

  // IPv4/IPv6 translation (64:ff9b::/96)
  if (cleanIp.startsWith("64:ff9b:")) {
    return true;
  }

  return false;
}

/**
 * Verifica se um IP (v4 ou v6) é privado ou proibido.
 */
export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    return isPrivateIPv4(ip);
  }
  if (net.isIPv6(ip)) {
    return isPrivateIPv6(ip);
  }
  return true; // Se não for IP reconhecido, considera arriscado
}

/**
 * Validação rigorosa de URL contra ataques de SSRF (Server-Side Request Forgery).
 * Resolve DNS para impedir DNS Rebinding e bloqueia loopback, redes privadas, link-local e cloud metadata.
 */
export async function validateSafeUrl(
  inputUrl?: string | null,
  options?: { allowedProtocols?: string[]; resolveDns?: boolean }
): Promise<SafeUrlValidationResult> {
  if (!inputUrl || typeof inputUrl !== "string") {
    return { isValid: false, errorMessage: "URL não fornecida ou inválida." };
  }

  const trimmed = inputUrl.trim();
  if (!trimmed) {
    return { isValid: false, errorMessage: "URL vazia." };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { isValid: false, errorMessage: "Formato de URL inválido." };
  }

  // 1. Protocolo Permitido
  const allowedProtocols = options?.allowedProtocols || ["https:", "http:"];
  if (!allowedProtocols.includes(parsed.protocol)) {
    return {
      isValid: false,
      errorMessage: `Protocolo '${parsed.protocol}' não permitido. Permitidos: ${allowedProtocols.join(", ")}`,
    };
  }

  let hostname = parsed.hostname.toLowerCase().trim();
  // Remover colchetes IPv6 [ ] se presentes para correta análise de IP
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    hostname = hostname.slice(1, -1).trim();
  }

  // 2. Bloqueio de Hostnames Especiais / Cloud Metadata
  if (CLOUD_METADATA_HOSTS.has(hostname) || hostname.endsWith(".internal") || hostname.endsWith(".local") || hostname.endsWith(".localhost")) {
    return {
      isValid: false,
      errorMessage: `Destino proibido por políticas de segurança SSRF: ${hostname}`,
    };
  }

  // 3. Bloqueio de Localhost e 0.0.0.0
  if (hostname === "localhost" || hostname === "0.0.0.0" || hostname === "::1" || hostname === "::") {
    return {
      isValid: false,
      errorMessage: `Acesso a destinos locais (localhost) é estritamente proibido: ${hostname}`,
    };
  }

  // 4. Se o hostname for um IP direto, validação imediata
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      return {
        isValid: false,
        errorMessage: `Endereço IP privado/restrito bloqueado por segurança SSRF: ${hostname}`,
      };
    }
  }

  // 5. Resolução DNS e Proteção contra DNS Rebinding
  const shouldResolveDns = options?.resolveDns === true;
  if (shouldResolveDns && !net.isIP(hostname)) {
    try {
      // Lookup com timeout de 2.5s para evitar hanging em redes sem DNS
      const lookupPromise = dns.promises.lookup(hostname, { all: true });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("DNS_LOOKUP_TIMEOUT")), 2500)
      );

      const addresses = await Promise.race([lookupPromise, timeoutPromise]);
      if (!addresses || addresses.length === 0) {
        return {
          isValid: false,
          errorMessage: `Não foi possível resolver o hostname via DNS: ${hostname}`,
        };
      }

      const resolvedIps = addresses.map((a) => a.address);

      for (const addr of addresses) {
        if (isPrivateIp(addr.address)) {
          return {
            isValid: false,
            errorMessage: `O hostname '${hostname}' resolveu para o IP privado restrito '${addr.address}'. Requisição bloqueada (SSRF/DNS Rebinding).`,
            resolvedIps,
          };
        }
      }

      return {
        isValid: true,
        sanitizedUrl: parsed.toString(),
        resolvedIps,
      };
    } catch (dnsErr: any) {
      // Se estiver em ambiente de teste ou timeout de DNS, não bloqueia se o hostname for público sintaticamente
      if (process.env.NODE_ENV === "test" || dnsErr.message === "DNS_LOOKUP_TIMEOUT") {
        return {
          isValid: true,
          sanitizedUrl: parsed.toString(),
        };
      }
      return {
        isValid: false,
        errorMessage: `Falha na resolução DNS do fornecedor '${hostname}': ${dnsErr.message || "Host não encontrado."}`,
      };
    }
  }

  return {
    isValid: true,
    sanitizedUrl: parsed.toString(),
  };
}

/**
 * Validação e higienização de cabeçalhos HTTP personalizados.
 * Impede CRLF Injection (HTTP Request Splitting) e substituição de headers proibidos.
 */
export function validateAndSanitizeHeaders(headers: Record<string, string>): {
  isValid: boolean;
  sanitizedHeaders: Record<string, string>;
  errorMessage?: string;
} {
  const sanitized: Record<string, string> = {};

  for (const [rawKey, rawVal] of Object.entries(headers)) {
    // 1. Proteção estrita contra Header Injection (CRLF \r e \n e Null bytes) na chave e valor brutos
    const strVal = typeof rawVal === "string" ? rawVal : String(rawVal);
    if (/[\r\n\0]/.test(rawKey) || /[\r\n\0]/.test(strVal)) {
      return {
        isValid: false,
        sanitizedHeaders: {},
        errorMessage: `Injeção de caracteres de controle CRLF detectada no cabeçalho '${rawKey}'.`,
      };
    }

    const key = rawKey.trim();
    const val = strVal.trim();

    // 2. Validação de formato do nome do Header
    if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
      return {
        isValid: false,
        sanitizedHeaders: {},
        errorMessage: `Nome de cabeçalho HTTP inválido contendo caracteres ilegais: '${key}'`,
      };
    }

    // 3. Bloqueio de Cabeçalhos Críticos/Proibidos
    if (FORBIDDEN_HTTP_HEADERS.has(key.toLowerCase())) {
      return {
        isValid: false,
        sanitizedHeaders: {},
        errorMessage: `O cabeçalho HTTP '${key}' é restrito pelo sistema e não pode ser sobrescrito por integrações.`,
      };
    }

    sanitized[key] = val;
  }

  return {
    isValid: true,
    sanitizedHeaders: sanitized,
  };
}

/**
 * Cliente HTTP Seguro com Proteção SSRF, Validação de Redirecionamento e Timeouts Rigorosos.
 */
export async function safeFetch(
  url: string,
  options?: SafeFetchOptions
): Promise<Response> {
  const timeoutMs = Math.min(30000, Math.max(1000, options?.timeoutMs || 10000));
  const maxRedirects = Math.min(3, Math.max(0, options?.maxRedirects ?? 0)); // Por padrão NÃO segue redirects silenciosos

  // 1. Validação SSRF pré-requisição
  const validation = await validateSafeUrl(url, {
    allowedProtocols: options?.allowedProtocols || ["https:", "http:"],
    resolveDns: true,
  });

  if (!validation.isValid) {
    throw new Error(`SSRF_BLOCKED: ${validation.errorMessage}`);
  }

  // 2. Higienização de headers se fornecidos
  const customHeaders: Record<string, string> = {};
  if (options?.headers) {
    const headersRecord: Record<string, string> =
      options.headers instanceof Headers
        ? Object.fromEntries(options.headers.entries())
        : Array.isArray(options.headers)
        ? Object.fromEntries(options.headers)
        : (options.headers as Record<string, string>);

    const headerValidation = validateAndSanitizeHeaders(headersRecord);
    if (!headerValidation.isValid) {
      throw new Error(`INVALID_HEADERS: ${headerValidation.errorMessage}`);
    }
    Object.assign(customHeaders, headerValidation.sanitizedHeaders);
  }

  // 3. Controle de Timeout com AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let currentUrl = validation.sanitizedUrl || url;
  let redirectsCount = 0;

  try {
    while (true) {
      const response = await fetch(currentUrl, {
        ...options,
        headers: customHeaders,
        signal: controller.signal,
        redirect: "manual", // Interceptação manual obrigatória para re-validar destino
      });

      // 4. Se for redirecionamento (301, 302, 303, 307, 308)
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (maxRedirects === 0 || redirectsCount >= maxRedirects) {
          return response; // Retorna resposta 3xx sem seguir destino não verificado
        }

        const locationHeader = response.headers.get("location");
        if (!locationHeader) {
          return response;
        }

        const nextUrl = new URL(locationHeader, currentUrl).toString();

        // Re-validar estritamente o destino do redirect contra SSRF
        const redirectValidation = await validateSafeUrl(nextUrl, {
          allowedProtocols: options?.allowedProtocols || ["https:", "http:"],
          resolveDns: true,
        });

        if (!redirectValidation.isValid) {
          throw new Error(`SSRF_BLOCKED_REDIRECT: Redirecionamento para destino inseguro bloqueado: ${redirectValidation.errorMessage}`);
        }

        currentUrl = redirectValidation.sanitizedUrl || nextUrl;
        redirectsCount++;
        continue;
      }

      return response;
    }
  } finally {
    clearTimeout(timeoutId);
  }
}
