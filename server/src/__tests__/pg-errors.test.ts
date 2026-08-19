import { describe, it, expect } from "vitest";
import { sqlState, isUniqueViolation, isForeignKeyViolation, toAppError } from "../db/pg-errors";
import { AppError } from "../middleware/error-handler";

// #158 DB repository layer — shared Postgres error mapping.
// Pure unit tests (no DB): SQLSTATE extraction + AppError mapping used by
// every repository. Unknown errors must be re-thrown unchanged.

function pgError(code: string): { code: string; message: string } {
  return { code, message: `pg error ${code}` };
}

describe("sqlState", () => {
  it("should return the SQLSTATE code for a Postgres error", () => {
    expect(sqlState(pgError("23505"))).toBe("23505");
  });

  it("should return null for non-object, null, or code-less errors", () => {
    expect(sqlState(null)).toBeNull();
    expect(sqlState("boom")).toBeNull();
    expect(sqlState(undefined)).toBeNull();
    expect(sqlState({ message: "no code" })).toBeNull();
    expect(sqlState({ code: 23505 })).toBeNull(); // non-string code
  });
});

describe("isUniqueViolation", () => {
  it("should return true for SQLSTATE 23505", () => {
    expect(isUniqueViolation(pgError("23505"))).toBe(true);
  });

  it("should return false for other SQLSTATEs and non-DB errors", () => {
    expect(isUniqueViolation(pgError("23503"))).toBe(false);
    expect(isUniqueViolation(new Error("boom"))).toBe(false);
  });
});

describe("isForeignKeyViolation", () => {
  it("should return true for SQLSTATE 23503", () => {
    expect(isForeignKeyViolation(pgError("23503"))).toBe(true);
  });

  it("should return false for other SQLSTATEs", () => {
    expect(isForeignKeyViolation(pgError("23505"))).toBe(false);
  });
});

describe("toAppError", () => {
  it("should map 23505 unique violation to 409 UNIQUE_VIOLATION", () => {
    const err = toAppError(pgError("23505"), "createCharacter");
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe("UNIQUE_VIOLATION");
    expect(err.message).toContain("createCharacter");
  });

  it("should map 23503 foreign key violation to 409 FK_VIOLATION", () => {
    const err = toAppError(pgError("23503"), "joinCrew");
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe("FK_VIOLATION");
    expect(err.message).toContain("joinCrew");
  });

  it("should map 40001 serialization failure to 409 CONCURRENCY_CONFLICT", () => {
    const err = toAppError(pgError("40001"), "spend");
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe("CONCURRENCY_CONFLICT");
  });

  it("should map 22P02 invalid input to 400 INVALID_INPUT", () => {
    const err = toAppError(pgError("22P02"), "parse");
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("INVALID_INPUT");
    expect(err.message).toContain("parse");
  });

  it("should map integrity SQLSTATEs (23514/23502/22003/42P01) to 500 DB_CONSTRAINT_ERROR", () => {
    for (const code of ["23514", "23502", "22003", "42P01"]) {
      const err = toAppError(pgError(code), "ctx");
      expect(err.statusCode).toBe(500);
      expect(err.code).toBe("DB_CONSTRAINT_ERROR");
    }
  });

  it("should re-throw unknown errors unchanged", () => {
    const original = new Error("boom");
    expect(() => toAppError(original, "ctx")).toThrow(original);
    expect(() => toAppError({ message: "no code" }, "ctx")).toThrow();
  });

  it("should apply opts overrides for code, message and statusCode", () => {
    const err = toAppError(pgError("23505"), "createCharacter", {
      code: "NAME_TAKEN",
      message: "Nome já em uso",
      statusCode: 409,
    });
    expect(err.code).toBe("NAME_TAKEN");
    expect(err.message).toBe("Nome já em uso");
    expect(err.statusCode).toBe(409);
  });
});
