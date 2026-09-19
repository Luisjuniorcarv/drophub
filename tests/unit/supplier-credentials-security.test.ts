import { describe, it, expect } from "vitest";
import { encryptData, decryptData, maskSecret, maskCredentialsObject } from "@/lib/encryption";
import { getSupplierAdapter, setGlobalTestSupplierAdapter, getTestSupplierAdapter } from "@/modules/suppliers/factory";
import { TestSupplierAdapter } from "@/modules/suppliers/adapters/test-supplier-adapter";
import { isTransientIntegrationError } from "@/modules/suppliers/types";
import { maskSensitiveData } from "@/lib/logger";

describe("ETAPA 16 — Supplier Credentials, Security & Adapter Unit Tests", () => {
  describe("1. AES-256-GCM Encryption & Decryption Security", () => {
    it("should securely encrypt and decrypt string data with AES-256-GCM authenticated tag", () => {
      const secret = "sk-live-supplier-ultra-secret-key-998877";
      const encrypted = encryptData(secret);

      // Deve ter formato iv:authTag:ciphertext
      const parts = encrypted.split(":");
      expect(parts).toHaveLength(3);
      expect(parts[0]).toHaveLength(32); // 16 bytes IV em hex
      expect(parts[1]).toHaveLength(32); // 16 bytes AuthTag em hex
      expect(parts[2].length).toBeGreaterThan(0);

      // Nunca deve conter o texto puro
      expect(encrypted).not.toContain(secret);

      // Decriptografia deve recuperar o valor exato
      const decrypted = decryptData<string>(encrypted);
      expect(decrypted).toBe(secret);
    });

    it("should securely encrypt and decrypt complex credential objects", () => {
      const credentials = {
        apiKey: "pk_live_123456789abcdef",
        apiSecret: "sec_987654321fedcba",
        webhookSecret: "whsec_super_secret_hmac_hash",
        nested: {
          clientToken: "tok_enterprise_999",
        },
      };

      const encrypted = encryptData(credentials);
      expect(encrypted).not.toContain("pk_live");
      expect(encrypted).not.toContain("sec_987654321fedcba");

      const decrypted = decryptData<typeof credentials>(encrypted);
      expect(decrypted).toEqual(credentials);
    });

    it("should fail cryptographic validation if ciphertext or auth tag is tampered with", () => {
      const original = encryptData("secret-data-123");
      const parts = original.split(":");
      // Alterar um byte do ciphertext
      const tamperedCipher = parts[2].substring(0, parts[2].length - 2) + "ff";
      const tamperedPayload = `${parts[0]}:${parts[1]}:${tamperedCipher}`;

      expect(() => decryptData(tamperedPayload)).toThrow();
    });

    it("should fail if payload format is malformed or invalid", () => {
      expect(() => decryptData("invalid-payload-without-colons")).toThrow("INVALID_CIPHERTEXT_FORMAT");
      expect(() => decryptData("")).toThrow("INVALID_ENCRYPTED_PAYLOAD");
    });
  });

  describe("2. Masking & Zero-Leakage Data Protection", () => {
    it("should mask individual secret strings preserving only minimal head/tail characters", () => {
      expect(maskSecret("sk_live_1234567890abcdef")).toBe("sk••••••••ef");
      expect(maskSecret("short")).toBe("••••••••");
      expect(maskSecret("")).toBe("");
      expect(maskSecret(null)).toBe("");
    });

    it("should recursively mask all sensitive credential fields in objects", () => {
      const credentials = {
        apiKey: "sk_live_998877665544332211",
        apiSecret: "sec_secret_password_value_123",
        publicId: "PUB-1002",
        nestedConfig: {
          token: "bearer_token_super_secret",
          timeout: 5000,
        },
      };

      const masked = maskCredentialsObject(credentials);

      expect(masked.apiKey).toBe("sk••••••••11");
      expect(masked.apiSecret).toBe("se••••••••23");
      expect(masked.publicId).toBe("PUB-1002"); // Não é chave sensível
      expect(masked.nestedConfig.token).toBe("be••••••••et");
      expect(masked.nestedConfig.timeout).toBe(5000);
    });

    it("should prevent sensitive credential leakage in structured logger", () => {
      const sensitiveLogData = {
        apiKey: "sk-live-09876543210987654321",
        authorization: "Bearer my-jwt-token",
        password: "SuperSecretPassword123!",
        supplierId: "sup-123",
        durationMs: 150,
      };

      const sanitized = maskSensitiveData(sensitiveLogData);

      expect(sanitized.apiKey).toBe("***[PROTECTED]***");
      expect(sanitized.authorization).toBe("***[PROTECTED]***");
      expect(sanitized.password).toBe("***[PROTECTED]***");
      expect(sanitized.supplierId).toBe("sup-123");
      expect(sanitized.durationMs).toBe(150);
    });
  });

  describe("3. Adapter Factory & Contract Resolution", () => {
    it("should resolve TestSupplierAdapter for TEST, TEST_SUPPLIER, DEFAULT or empty provider", () => {
      const adapterTest = getSupplierAdapter("TEST");
      expect(adapterTest).toBeDefined();
      expect(adapterTest.provider).toBe("TEST");

      const adapterDefault = getSupplierAdapter("");
      expect(adapterDefault.provider).toBe("TEST");

      const adapterNull = getSupplierAdapter(null);
      expect(adapterNull.provider).toBe("TEST");
    });

    it("should resolve UnconfiguredSupplierAdapter for unconfigured real providers and return NOT_CONFIGURED safely", async () => {
      const adapterBling = getSupplierAdapter("BLING");
      expect(adapterBling.name).toBe("BLING");

      const testResult = await adapterBling.testConnection();
      expect(testResult.success).toBe(false);
      expect(testResult.status).toBe("NOT_CONFIGURED");
      expect(testResult.category).toBe("NOT_CONFIGURED");
      expect(testResult.errorMessage).toContain("BLING");

      const orderResult = await adapterBling.createOrder({} as any);
      expect(orderResult.success).toBe(false);
      expect(orderResult.status).toBe("FAILED");
      expect(orderResult.errorMessage).toContain("não configurado");
    });

    it("should allow runtime injection of test adapter for determinism", () => {
      const customAdapter = new TestSupplierAdapter({ shouldFail: true });
      setGlobalTestSupplierAdapter(customAdapter);

      const resolved = getTestSupplierAdapter();
      expect(resolved).toBe(customAdapter);

      // Limpeza
      setGlobalTestSupplierAdapter(null);
    });
  });

  describe("4. Integration Error Categorization & Retry Eligibility", () => {
    it("should correctly classify transient errors as eligible for automatic retry", () => {
      expect(isTransientIntegrationError("TIMEOUT")).toBe(true);
      expect(isTransientIntegrationError("RATE_LIMITED")).toBe(true);
      expect(isTransientIntegrationError("PROVIDER_UNAVAILABLE")).toBe(true);
    });

    it("should classify permanent errors as NOT eligible for retry (fail fast to avoid infinite loops)", () => {
      expect(isTransientIntegrationError("NOT_CONFIGURED")).toBe(false);
      expect(isTransientIntegrationError("INVALID_CREDENTIALS")).toBe(false);
      expect(isTransientIntegrationError("AUTHENTICATION_FAILED")).toBe(false);
      expect(isTransientIntegrationError("INVALID_RESPONSE")).toBe(false);
      expect(isTransientIntegrationError("PROVIDER_REJECTED")).toBe(false);
      expect(isTransientIntegrationError("UNKNOWN_ERROR")).toBe(false);
    });
  });
});
