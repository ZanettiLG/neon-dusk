import { describe, it, expect } from "vitest";
import { sseCorsHeaders } from "../lib/sse";
import { envSchema, parseCorsOrigins } from "../env";

function envWith(origin: string) {
  return envSchema.parse({ ...process.env, CORS_ORIGIN: origin });
}

describe("parseCorsOrigins", () => {
  it("should split a multi-origin CORS_ORIGIN into a 2-element array", () => {
    expect(parseCorsOrigins("http://a.com,http://b.com")).toEqual(["http://a.com", "http://b.com"]);
  });

  it("should trim whitespace and drop empty entries", () => {
    expect(parseCorsOrigins(" http://a.com , ,http://b.com, ")).toEqual([
      "http://a.com",
      "http://b.com",
    ]);
  });

  it("should keep a single origin backward-compatible", () => {
    expect(parseCorsOrigins("http://localhost:5173")).toEqual(["http://localhost:5173"]);
  });
});

describe("sseCorsHeaders", () => {
  it("should mirror the cors config for a specific origin (allow-origin + vary + credentials)", () => {
    const headers = sseCorsHeaders(envWith("http://localhost:5173"))();

    expect(headers["Access-Control-Allow-Origin"]).toBe("http://localhost:5173");
    expect(headers["Vary"]).toBe("Origin");
    expect(headers["Access-Control-Allow-Credentials"]).toBe("true");
  });

  it("should omit Vary when origin is * (no credentials allowed with wildcard)", () => {
    const headers = sseCorsHeaders(envWith("*"))();

    expect(headers["Access-Control-Allow-Origin"]).toBe("*");
    expect(headers["Vary"]).toBeUndefined();
    expect(headers["Access-Control-Allow-Credentials"]).toBe("true");
  });

  it("should echo the request origin when it is on the allowed list", () => {
    const headers = sseCorsHeaders(envWith("http://a.com,http://b.com"))("http://b.com");

    expect(headers["Access-Control-Allow-Origin"]).toBe("http://b.com");
    expect(headers["Vary"]).toBe("Origin");
  });

  it("should fall back to the first allowed origin for a disallowed request origin", () => {
    const headers = sseCorsHeaders(envWith("http://a.com,http://b.com"))("http://evil.example");

    expect(headers["Access-Control-Allow-Origin"]).toBe("http://a.com");
    expect(headers["Vary"]).toBe("Origin");
  });

  it("should fall back to the first allowed origin when no Origin header is sent", () => {
    const headers = sseCorsHeaders(envWith("http://a.com,http://b.com"))(undefined);

    expect(headers["Access-Control-Allow-Origin"]).toBe("http://a.com");
  });
});
