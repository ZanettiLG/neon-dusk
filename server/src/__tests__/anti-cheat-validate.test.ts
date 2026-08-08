import { describe, it, expect } from "vitest";
import type { FastifyRequest } from "fastify";
import { z, ZodError } from "zod";
import { validate } from "../middleware/validate";

// ND-053 — Zod body validation preHandler. Pure unit tests: no HTTP, no
// Redis, no DB — the middleware only parses and tags the audit context.

const actionSchema = z.object({
  name: z.string().trim().min(2).max(30),
  amount: z.number().int().min(1).max(1000),
  tags: z.array(z.string()).optional(),
});

function requestWith(body: unknown, auditContext?: unknown) {
  return { body, audit_context: auditContext } as unknown as FastifyRequest;
}

describe("validate (Zod preHandler)", () => {
  it("should pass a valid body and replace request.body with the parsed value", async () => {
    const preHandler = validate(actionSchema);
    const request = requestWith({ name: "  Vendetta  ", amount: 5 });

    await expect(preHandler(request)).resolves.toBeUndefined();

    // Parsed value replaces the original (trim applied).
    expect(request.body).toEqual({ name: "Vendetta", amount: 5 });
  });

  it("should pass when optional fields are omitted", async () => {
    const preHandler = validate(actionSchema);
    const request = requestWith({ name: "Vendetta", amount: 1 });

    await expect(preHandler(request)).resolves.toBeUndefined();
  });

  it("should throw ZodError and tag validation_error when the body is invalid", async () => {
    const preHandler = validate(actionSchema);
    const auditContext = {};
    const request = requestWith({ name: "V", amount: 5 }, auditContext);

    await expect(preHandler(request)).rejects.toBeInstanceOf(ZodError);
    expect(auditContext).toEqual({ result: "validation_error" });
  });

  it("should catch missing required fields", async () => {
    const preHandler = validate(actionSchema);
    const request = requestWith({ name: "Vendetta" }); // amount missing

    await expect(preHandler(request)).rejects.toBeInstanceOf(ZodError);
  });

  it("should catch type mismatches (string where number expected)", async () => {
    const preHandler = validate(actionSchema);
    const request = requestWith({ name: "Vendetta", amount: "cinco" });

    await expect(preHandler(request)).rejects.toBeInstanceOf(ZodError);
  });

  it("should catch out-of-bounds numbers (negative and zero)", async () => {
    const preHandler = validate(actionSchema);

    await expect(
      preHandler(requestWith({ name: "Vendetta", amount: -5 })),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(
      preHandler(requestWith({ name: "Vendetta", amount: 0 })),
    ).rejects.toBeInstanceOf(ZodError);
  });

  it("should still throw when no audit context exists (no crash tagging)", async () => {
    const preHandler = validate(actionSchema);
    const request = requestWith({ name: "", amount: 5 }); // no audit_context

    await expect(preHandler(request)).rejects.toBeInstanceOf(ZodError);
  });
});
