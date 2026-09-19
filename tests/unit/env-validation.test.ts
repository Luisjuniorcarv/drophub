import { describe, it, expect } from "vitest";
import { validateEnv } from "@/lib/env";

describe("ETAPA 13 — Environment Validation Unit Tests", () => {
  it("1. should successfully parse valid environment configurations", () => {
    const validConfig = {
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
      JWT_SECRET: "this_is_a_very_secure_jwt_secret_key_with_at_least_32_characters",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    };

    const parsed = validateEnv(validConfig);
    expect(parsed.DATABASE_URL).toBe("postgresql://user:pass@localhost:5432/db");
    expect(parsed.JWT_SECRET).toBe(validConfig.JWT_SECRET);
    expect(parsed.PAYMENT_GATEWAY).toBe("TEST_MODE");
  });

  it("2. should reject invalid URLs for NEXT_PUBLIC_APP_URL", () => {
    const invalidConfig = {
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
      JWT_SECRET: "super_secret_jwt_key_with_enough_length_for_hmac_sha256",
      NEXT_PUBLIC_APP_URL: "not_a_valid_url",
    };

    expect(() => validateEnv(invalidConfig)).toThrow();
  });

  it("3. should reject short JWT secrets below 32 characters in production", () => {
    const weakSecretConfig = {
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
      JWT_SECRET: "too_short_secret",
      NEXT_PUBLIC_APP_URL: "https://drophub.exemplo.com",
    };

    expect(() => validateEnv(weakSecretConfig)).toThrow();
  });

  it("4. should validate ENCRYPTION_KEY length if provided in production", () => {
    const invalidEncryptionKeyConfig = {
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
      JWT_SECRET: "super_secret_jwt_key_with_enough_length_for_hmac_sha256",
      ENCRYPTION_KEY: "short_key",
      NEXT_PUBLIC_APP_URL: "https://drophub.exemplo.com",
    };

    expect(() => validateEnv(invalidEncryptionKeyConfig)).toThrow();

    const validEncryptionKeyConfig = {
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
      JWT_SECRET: "super_secret_jwt_key_with_enough_length_for_hmac_sha256",
      ENCRYPTION_KEY: "super_secret_encryption_key_at_least_32_characters_2026",
      NEXT_PUBLIC_APP_URL: "https://drophub.exemplo.com",
    };

    const parsed = validateEnv(validEncryptionKeyConfig);
    expect(parsed.ENCRYPTION_KEY).toBe(validEncryptionKeyConfig.ENCRYPTION_KEY);
  });
});
