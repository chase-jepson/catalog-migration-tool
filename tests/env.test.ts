import { describe, it, expect } from "vitest";
import { detectEnvironment, getApiBaseUrl, getMsoApiBaseUrl } from "../lib/env";

describe("detectEnvironment", () => {
  it('returns "production" for app.treez.io', () => {
    expect(detectEnvironment("https://app.treez.io/treez-admin/import/home")).toBe("production");
  });

  it('returns "sandbox" for app.sandbox.treez.io', () => {
    expect(detectEnvironment("https://app.sandbox.treez.io/treez-admin/import/home")).toBe(
      "sandbox",
    );
  });

  it('returns "dev" for app.dev.treez.io', () => {
    expect(detectEnvironment("https://app.dev.treez.io/treez-admin/import/home")).toBe("dev");
  });

  it("returns null for unknown domains", () => {
    expect(detectEnvironment("https://example.com")).toBeNull();
  });

  it("returns null for invalid URLs", () => {
    expect(detectEnvironment("invalid")).toBeNull();
  });
});

describe("getApiBaseUrl", () => {
  it("returns correct URL for production", () => {
    expect(getApiBaseUrl("production")).toBe("https://api.treez.io");
  });

  it("returns correct URL for sandbox", () => {
    expect(getApiBaseUrl("sandbox")).toBe("https://api.sandbox.treez.io");
  });

  it("returns correct URL for dev", () => {
    expect(getApiBaseUrl("dev")).toBe("https://api-dev.treez.io");
  });
});

describe("getMsoApiBaseUrl", () => {
  it("returns correct URL for production", () => {
    expect(getMsoApiBaseUrl("production")).toBe("https://api.mso.treez.io");
  });

  it("returns correct URL for sandbox", () => {
    expect(getMsoApiBaseUrl("sandbox")).toBe("https://api.sandbox.treez.io");
  });

  it("returns correct URL for dev", () => {
    expect(getMsoApiBaseUrl("dev")).toBe("https://api.dev.treez.io");
  });
});
