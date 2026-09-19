import { describe, it, expect } from "vitest";
import {
  validateSafeUrl,
  validateAndSanitizeHeaders,
  isPrivateIPv4,
  isPrivateIPv6,
  isPrivateIp,
  safeFetch,
} from "@/lib/network-security";

describe("ETAPA 16 — SSRF Protection, Safe URL Validation & Header Security Unit Tests", () => {
  describe("1. Private IP Detection & Classification", () => {
    it("should correctly detect RFC 1918 and loopback IPv4 addresses as private", () => {
      // Loopback
      expect(isPrivateIPv4("127.0.0.1")).toBe(true);
      expect(isPrivateIPv4("127.0.0.2")).toBe(true);
      expect(isPrivateIPv4("127.255.255.255")).toBe(true);
      expect(isPrivateIPv4("0.0.0.0")).toBe(true);

      // RFC 1918 Class A (10.0.0.0/8)
      expect(isPrivateIPv4("10.0.0.1")).toBe(true);
      expect(isPrivateIPv4("10.254.1.100")).toBe(true);
      expect(isPrivateIPv4("10.255.255.255")).toBe(true);

      // RFC 1918 Class B (172.16.0.0/12)
      expect(isPrivateIPv4("172.16.0.1")).toBe(true);
      expect(isPrivateIPv4("172.24.10.5")).toBe(true);
      expect(isPrivateIPv4("172.31.255.255")).toBe(true);

      // RFC 1918 Class C (192.168.0.0/16)
      expect(isPrivateIPv4("192.168.0.1")).toBe(true);
      expect(isPrivateIPv4("192.168.1.254")).toBe(true);

      // Link-Local / Cloud Metadata (169.254.0.0/16)
      expect(isPrivateIPv4("169.254.169.254")).toBe(true);
      expect(isPrivateIPv4("169.254.1.1")).toBe(true);

      // Carrier-grade NAT (100.64.0.0/10)
      expect(isPrivateIPv4("100.64.0.1")).toBe(true);
      expect(isPrivateIPv4("100.100.100.200")).toBe(true);

      // Public IPv4 addresses should NOT be private
      expect(isPrivateIPv4("8.8.8.8")).toBe(false);
      expect(isPrivateIPv4("1.1.1.1")).toBe(false);
      expect(isPrivateIPv4("104.26.10.150")).toBe(false);
      expect(isPrivateIPv4("172.32.0.1")).toBe(false); // Fora do range 172.16-172.31
      expect(isPrivateIPv4("192.169.0.1")).toBe(false); // Fora do range 192.168
    });

    it("should correctly detect private, loopback, link-local, ULA and IPv4-mapped IPv6 addresses", () => {
      // Loopback
      expect(isPrivateIPv6("::1")).toBe(true);
      expect(isPrivateIPv6("0:0:0:0:0:0:0:1")).toBe(true);
      expect(isPrivateIPv6("::")).toBe(true);

      // Link-local (fe80::/10)
      expect(isPrivateIPv6("fe80::1")).toBe(true);
      expect(isPrivateIPv6("fe80::215:5dff:fe00:402")).toBe(true);

      // Unique Local Addresses (fc00::/7 - fc00:: / fd00::)
      expect(isPrivateIPv6("fc00::1")).toBe(true);
      expect(isPrivateIPv6("fd12:3456:789a:1::1")).toBe(true);

      // IPv4-mapped IPv6 pointing to private IPv4
      expect(isPrivateIPv6("::ffff:127.0.0.1")).toBe(true);
      expect(isPrivateIPv6("::ffff:10.0.0.1")).toBe(true);
      expect(isPrivateIPv6("::ffff:192.168.1.1")).toBe(true);
      expect(isPrivateIPv6("::ffff:169.254.169.254")).toBe(true);

      // IPv4-mapped IPv6 pointing to public IPv4
      expect(isPrivateIPv6("::ffff:8.8.8.8")).toBe(false);
    });

    it("isPrivateIp generic helper handles both IPv4 and IPv6", () => {
      expect(isPrivateIp("127.0.0.1")).toBe(true);
      expect(isPrivateIp("::1")).toBe(true);
      expect(isPrivateIp("8.8.4.4")).toBe(false);
      expect(isPrivateIp("2606:4700:4700::1111")).toBe(false);
    });
  });

  describe("2. validateSafeUrl (SSRF Guard)", () => {
    it("should accept valid public HTTPS URLs", async () => {
      const res1 = await validateSafeUrl("https://api.fornecedor.com/v1/orders", { resolveDns: false });
      expect(res1.isValid).toBe(true);
      expect(res1.sanitizedUrl).toBe("https://api.fornecedor.com/v1/orders");

      const res2 = await validateSafeUrl("https://supplier.example.org:8443/webhook", { resolveDns: false });
      expect(res2.isValid).toBe(true);
    });

    it("should reject disallowed and dangerous protocols", async () => {
      const fileRes = await validateSafeUrl("file:///etc/passwd");
      expect(fileRes.isValid).toBe(false);
      expect(fileRes.errorMessage).toContain("Protocolo");

      const gopherRes = await validateSafeUrl("gopher://127.0.0.1:70/");
      expect(gopherRes.isValid).toBe(false);

      const ftpRes = await validateSafeUrl("ftp://ftp.example.com/file");
      expect(ftpRes.isValid).toBe(false);

      const jsRes = await validateSafeUrl("javascript:alert(1)");
      expect(jsRes.isValid).toBe(false);
    });

    it("should block localhost and loopback targets", async () => {
      const lh1 = await validateSafeUrl("http://localhost:3000/api");
      expect(lh1.isValid).toBe(false);
      expect(lh1.errorMessage).toContain("localhost");

      const lh2 = await validateSafeUrl("http://127.0.0.1:5432");
      expect(lh2.isValid).toBe(false);
      expect(lh2.errorMessage).toContain("privado/restrito");

      const lh3 = await validateSafeUrl("http://[::1]:8080");
      expect(lh3.isValid).toBe(false);

      const lh4 = await validateSafeUrl("http://0.0.0.0:80");
      expect(lh4.isValid).toBe(false);
    });

    it("should block cloud metadata endpoints (AWS, GCP, Azure, Alibaba)", async () => {
      const aws = await validateSafeUrl("http://169.254.169.254/latest/meta-data/");
      expect(aws.isValid).toBe(false);

      const gcp = await validateSafeUrl("http://metadata.google.internal/computeMetadata/v1/");
      expect(gcp.isValid).toBe(false);

      const azure = await validateSafeUrl("http://metadata.azure.com/metadata/instance");
      expect(azure.isValid).toBe(false);

      const instance = await validateSafeUrl("http://instance-data/latest/meta-data/");
      expect(instance.isValid).toBe(false);
    });

    it("should block RFC 1918 private IPv4 networks", async () => {
      const c10 = await validateSafeUrl("http://10.0.0.5/api/v1");
      expect(c10.isValid).toBe(false);

      const c172 = await validateSafeUrl("http://172.16.50.1:8080");
      expect(c172.isValid).toBe(false);

      const c192 = await validateSafeUrl("http://192.168.1.1/admin");
      expect(c192.isValid).toBe(false);
    });

    it("should block IPv4-mapped IPv6 targets pointing to loopback or private ranges", async () => {
      const mappedLh = await validateSafeUrl("http://[::ffff:127.0.0.1]:8080");
      expect(mappedLh.isValid).toBe(false);

      const mappedPrivate = await validateSafeUrl("http://[::ffff:10.0.0.1]");
      expect(mappedPrivate.isValid).toBe(false);
    });
  });

  describe("3. HTTP Header Validation & Injection Prevention", () => {
    it("should accept valid customized integration headers", () => {
      const valid = {
        "X-API-Key": "sk_live_123456",
        "X-Supplier-ID": "SUP-9988",
        "Authorization": "Bearer token_abc123",
      };

      const result = validateAndSanitizeHeaders(valid);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedHeaders["X-API-Key"]).toBe("sk_live_123456");
      expect(result.sanitizedHeaders["Authorization"]).toBe("Bearer token_abc123");
    });

    it("should block forbidden headers that override server proxy mechanisms", () => {
      const forbiddenHost = { "Host": "evil.internal.corp" };
      expect(validateAndSanitizeHeaders(forbiddenHost).isValid).toBe(false);
      expect(validateAndSanitizeHeaders(forbiddenHost).errorMessage).toContain("restrito");

      const forbiddenCookie = { "Cookie": "admin_session=stolen" };
      expect(validateAndSanitizeHeaders(forbiddenCookie).isValid).toBe(false);

      const forbiddenXForwarded = { "X-Forwarded-For": "127.0.0.1" };
      expect(validateAndSanitizeHeaders(forbiddenXForwarded).isValid).toBe(false);

      const forbiddenTransfer = { "Transfer-Encoding": "chunked" };
      expect(validateAndSanitizeHeaders(forbiddenTransfer).isValid).toBe(false);
    });

    it("should block CRLF injection (HTTP Response/Request Splitting) in header names and values", () => {
      const crlfValue = {
        "X-Custom-Header": "valid_value\r\nInjected-Header: evil\r\n\r\n<script>alert(1)</script>",
      };
      const valResult = validateAndSanitizeHeaders(crlfValue);
      expect(valResult.isValid).toBe(false);
      expect(valResult.errorMessage).toContain("CRLF");

      const crlfKey = {
        "X-Header\r\n": "some_value",
      };
      const keyResult = validateAndSanitizeHeaders(crlfKey);
      expect(keyResult.isValid).toBe(false);
    });
  });

  describe("4. safeFetch Client Protection", () => {
    it("should throw SSRF_BLOCKED when attempting to call private or loopback destinations", async () => {
      await expect(safeFetch("http://127.0.0.1:5432/query")).rejects.toThrow("SSRF_BLOCKED");
      await expect(safeFetch("http://169.254.169.254/meta-data")).rejects.toThrow("SSRF_BLOCKED");
      await expect(safeFetch("http://10.0.0.1:8080/")).rejects.toThrow("SSRF_BLOCKED");
    });

    it("should reject forbidden headers when passed to safeFetch", async () => {
      await expect(
        safeFetch("https://api.fornecedor.com", {
          headers: { "Host": "internal.lan" },
        })
      ).rejects.toThrow("INVALID_HEADERS");

      await expect(
        safeFetch("https://api.fornecedor.com", {
          headers: { "X-Forwarded-Host": "attacker.com" },
        })
      ).rejects.toThrow("INVALID_HEADERS");

      await expect(
        safeFetch("https://api.fornecedor.com", {
          headers: { "Transfer-Encoding": "chunked" },
        })
      ).rejects.toThrow("INVALID_HEADERS");
    });
  });

  describe("5. Configuration Schema Bounds (Timeout & Retry)", () => {
    it("should enforce min and max bounds on timeoutMs (1000ms - 30000ms)", async () => {
      const { SupplierIntegrationSaveSchema } = await import("@/lib/validators");

      // Valid timeout
      const valid = SupplierIntegrationSaveSchema.safeParse({
        provider: "GENERIC_REST",
        timeoutMs: 5000,
        retryMaxAttempts: 3,
      });
      expect(valid.success).toBe(true);

      // Too low (< 1000)
      const tooLow = SupplierIntegrationSaveSchema.safeParse({
        provider: "GENERIC_REST",
        timeoutMs: 500,
      });
      expect(tooLow.success).toBe(false);

      // Too high (> 30000)
      const tooHigh = SupplierIntegrationSaveSchema.safeParse({
        provider: "GENERIC_REST",
        timeoutMs: 60000,
      });
      expect(tooHigh.success).toBe(false);
    });

    it("should enforce min and max bounds on retryMaxAttempts (1 - 5)", async () => {
      const { SupplierIntegrationSaveSchema } = await import("@/lib/validators");

      // Too low (< 1)
      const tooLow = SupplierIntegrationSaveSchema.safeParse({
        provider: "GENERIC_REST",
        retryMaxAttempts: 0,
      });
      expect(tooLow.success).toBe(false);

      // Too high (> 5)
      const tooHigh = SupplierIntegrationSaveSchema.safeParse({
        provider: "GENERIC_REST",
        retryMaxAttempts: 10,
      });
      expect(tooHigh.success).toBe(false);
    });
  });
});
