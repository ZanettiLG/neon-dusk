import { describe, it, expect } from "vitest";
import { sseCorsHeaders } from "../lib/sse";
import { envSchema } from "../env";

function envWith(origin: string) {
  return envSchema.parse({ ...process.env, CORS_ORIGIN: origin });
}

describe("sseCorsHeaders", () => {
  it("should mirror the cors config for a specific origin (allow-origin + vary + credentials)", () => {
    const headers = sseCorsHeaders(envWith("http://localhost:5173"));

    expect(headers["Access-Control-Allow-Origin"]).toBe("http://localhost:5173");
    expect(headers["Vary"]).toBe("Origin");
    expect(headers["Access-Control-Allow-Credentials"]).toBe("true");
  });

  it("should omit Vary when origin is * (no credentials allowed with wildcard)", () => {
    const headers = sseCorsHeaders(envWith("*"));

    expect(headers["Access-Control-Allow-Origin"]).toBe("*");
    expect(headers["Vary"]).toBeUndefined();
    expect(headers["Access-Control-Allow-Credentials"]).toBe("true");
  });
});
