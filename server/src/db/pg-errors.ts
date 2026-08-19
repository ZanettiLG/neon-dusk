import { AppError } from "../middleware/error-handler";

// Neon Dusk — Postgres error mapping
// ============================================================================
// Shared SQLSTATE inspection + AppError mapping for repository code.
// Replaces the per-service `isUniqueViolation` copies (#158 DB layer).
//
// SQLSTATE reference:
//   23505 unique_violation    23503 foreign_key_violation
//   40001 serialization_failure  22P02 invalid_text_representation
//   23514 check_violation     23502 not_null_violation
//   22003 numeric_value_out_of_range  42P01 undefined_table

/** Extract the SQLSTATE code from a Postgres error (null when not a DB error). */
export function sqlState(err: unknown): string | null {
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = (err as { code?: unknown }).code;
    return typeof code === "string" ? code : null;
  }
  return null;
}

/** Detect a Postgres unique violation (SQLSTATE 23505). */
export function isUniqueViolation(err: unknown): boolean {
  return sqlState(err) === "23505";
}

/** Detect a Postgres foreign key violation (SQLSTATE 23503). */
export function isForeignKeyViolation(err: unknown): boolean {
  return sqlState(err) === "23503";
}

/**
 * Map a Postgres error to an AppError. Known SQLSTATEs get their canonical
 * status; `opts` overrides code/message/statusCode for the specific context
 * (e.g. a unique violation on characters.name → NAME_TAKEN). Unknown errors
 * are re-thrown unchanged.
 *
 * @param err — the caught error
 * @param context — where the error happened (used in generic messages)
 * @param opts — overrides for the mapped AppError
 */
export function toAppError(
  err: unknown,
  context: string,
  opts?: { code?: string; message?: string; statusCode?: number },
): AppError {
  const state = sqlState(err);
  let statusCode: number;
  let code: string;
  let message: string;

  switch (state) {
    case "23505":
      statusCode = 409;
      code = "UNIQUE_VIOLATION";
      message = `${context}: registro já existe`;
      break;
    case "23503":
      // 409 by default; a missing referenced row is usually a 404 for the caller.
      statusCode = 409;
      code = "FK_VIOLATION";
      message = `${context}: referência inválida ou inexistente`;
      break;
    case "40001":
      statusCode = 409;
      code = "CONCURRENCY_CONFLICT";
      message = "Muitas operações concorrentes. Tente novamente.";
      break;
    case "22P02":
      statusCode = 400;
      code = "INVALID_INPUT";
      message = `${context}: entrada inválida`;
      break;
    case "23514":
    case "23502":
    case "22003":
    case "42P01":
      statusCode = 500;
      code = "DB_CONSTRAINT_ERROR";
      message = `${context}: erro de integridade`;
      break;
    default:
      throw err;
  }

  return new AppError(
    opts?.statusCode ?? statusCode,
    opts?.code ?? code,
    opts?.message ?? message,
  );
}
