import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AuditLogEntry } from "../lib/audit-log";

// ND-053 — fire-and-forget audit logger. The DB module is mocked so the
// insert chain is observable and DB failures can be simulated without a
// running Postgres. Unit tests only exercise audit-log.ts (not the hook).

const auditMocks = vi.hoisted(() => ({
  values: vi.fn(),
  execute: vi.fn(),
  consoleError: vi.fn(),
}));

vi.mock("../db", () => ({
  db: {
    insert: () => ({
      values: (values: unknown) => {
        auditMocks.values(values);
        return { execute: auditMocks.execute };
      },
    }),
  },
}));

vi.mock("../db/schema", () => ({
  auditLog: {},
}));

import { auditLog } from "../lib/audit-log";

const CHARACTER_ID = "11111111-1111-4111-8111-111111111111";

function entry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    characterId: CHARACTER_ID,
    action: "saideira_chat",
    ip: "127.0.0.1",
    userAgent: "Mozilla/5.0 (test)",
    payload: { messageLength: 42 },
    result: "allowed",
    ...overrides,
  };
}

describe("auditLog (fire-and-forget audit logger)", () => {
  beforeEach(() => {
    auditMocks.values.mockReset();
    auditMocks.execute.mockReset();
    auditMocks.execute.mockResolvedValue(undefined);
  });

  it("should insert an audit_log row for an allowed action", () => {
    auditLog(entry());

    expect(auditMocks.values).toHaveBeenCalledTimes(1);
    expect(auditMocks.execute).toHaveBeenCalledTimes(1);
  });

  it("should store characterId, action, ip, userAgent, payload and result", () => {
    auditLog(entry({ result: "rate_limited", action: "pvp_attack" }));

    const values = auditMocks.values.mock.calls[0][0] as Record<string, unknown>;
    expect(values).toEqual({
      characterId: CHARACTER_ID,
      action: "pvp_attack",
      ip: "127.0.0.1",
      userAgent: "Mozilla/5.0 (test)",
      payload: { messageLength: 42 },
      result: "rate_limited",
    });
  });

  it("should default payload to an empty object when omitted", () => {
    // AuditLogEntry requires payload, but the logger is defensive: undefined
    // must fall back to {} (cast through the required type to simulate it).
    const { payload: _omit, ...rest } = entry();
    auditLog({ ...rest, payload: undefined as unknown as Record<string, unknown> });

    const values = auditMocks.values.mock.calls[0][0] as Record<string, unknown>;
    expect(values.payload).toEqual({});
  });

  it("should never throw when the DB write fails (fire-and-forget)", () => {
    auditMocks.execute.mockRejectedValue(new Error("connection closed"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(auditMocks.consoleError);

    // Must return synchronously and not propagate the rejection.
    expect(() => auditLog(entry())).not.toThrow();

    // Flush the microtask queue so the internal catch runs.
    return new Promise<void>((resolve) =>
      setTimeout(() => {
        expect(errorSpy).toHaveBeenCalled();
        errorSpy.mockRestore();
        resolve();
      }, 0),
    );
  });

  it("should return void immediately without blocking the caller", () => {
    const result = auditLog(entry());
    expect(result).toBeUndefined();
  });
});
