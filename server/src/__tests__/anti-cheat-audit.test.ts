import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FastifyRequest } from "fastify";
import type { AuditLogEntry } from "../lib/audit-log";

// ND-053 — fire-and-forget audit logger. The DB module is mocked so the
// insert chain is observable and DB failures can be simulated without a
// running Postgres. Unit tests only exercise audit-log.ts (not the hook).

const auditMocks = vi.hoisted(() => ({
  values: vi.fn(),
  execute: vi.fn(),
  consoleError: vi.fn(),
}));

// Knex chain mock: db("audit_log").insert(values).catch(handler).
// `execute` stands in for the query promise — reject it to simulate a DB failure.
vi.mock("../db", () => ({
  db: vi.fn((_table: string) => ({
    insert: (values: unknown) => {
      auditMocks.values(values);
      return {
        catch: (handler: (err: unknown) => void) => {
          const promise = auditMocks.execute();
          promise.catch(handler);
          return promise;
        },
      };
    },
  })),
}));

import { auditLog } from "../lib/audit-log";
import { setPreAuthAuditContext } from "../middleware/audit-middleware";

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
    // audit-log.ts maps its camelCase entry to snake_case DB columns.
    expect(values).toEqual({
      character_id: CHARACTER_ID,
      action: "pvp_attack",
      ip: "127.0.0.1",
      user_agent: "Mozilla/5.0 (test)",
      payload: { messageLength: 42 },
      result: "rate_limited",
    });
  });

  it("should default payload to an empty object when omitted", () => {
    // AuditLogEntry requires payload, but the logger is defensive: undefined
    // must fall back to {} (cast through the required type to simulate it).
    const { ...rest } = entry();
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

describe("setPreAuthAuditContext (ND-053 pre-auth audit)", () => {
  it("should set audit_context with characterId null and the given action", async () => {
    const preHandler = setPreAuthAuditContext("auth_register");
    const request = {} as unknown as FastifyRequest;

    await preHandler(request);

    expect(request.audit_context).toEqual({
      action: "auth_register",
      characterId: null,
    });
  });

  it("should tag the correct action for each pre-auth route", async () => {
    const cases: Array<[string, string]> = [
      ["auth_register", "auth_register"],
      ["auth_login", "auth_login"],
      ["auth_refresh", "auth_refresh"],
      ["auth_logout", "auth_logout"],
    ];
    for (const [action, expected] of cases) {
      const preHandler = setPreAuthAuditContext(action);
      const request = {} as unknown as FastifyRequest;
      await preHandler(request);
      expect(request.audit_context?.action).toBe(expected);
      expect(request.audit_context?.characterId).toBeNull();
    }
  });

  it("should not require a JWT sub or character (pre-auth has neither)", async () => {
    // Unlike setAuditContext, setPreAuthAuditContext must NOT call
    // characters.requireByUserId — a pre-auth request has no user.sub.
    const preHandler = setPreAuthAuditContext("auth_login");
    const request = {} as unknown as FastifyRequest;

    await expect(preHandler(request)).resolves.toBeUndefined();
    expect(request.audit_context?.characterId).toBeNull();
  });
});
