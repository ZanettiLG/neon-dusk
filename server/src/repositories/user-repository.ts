import { db, type Queryable } from "../db";

// Neon Dusk — User repository (#158 DB repository layer)
// ============================================================================

/** Database row shape for the `users` table (snake_case columns). */
export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: "player" | "admin";
  created_at: Date;
  updated_at: Date;
}

/** Input shape for inserting a new user. */
export interface UserInsert {
  email: string;
  password_hash: string;
  role?: "player" | "admin";
}

export interface UserRepository {
  /** Find a user by exact email (emails are stored lowercase). */
  findByEmail(email: string, q?: Queryable): Promise<UserRow | null>;
  /** Find a user by id. */
  findById(id: string, q?: Queryable): Promise<UserRow | null>;
  /** Insert a user and return the full row. */
  insert(input: UserInsert, q?: Queryable): Promise<UserRow>;
}

export function createUserRepository(q: Queryable = db): UserRepository {
  return {
    async findByEmail(email, tx = q): Promise<UserRow | null> {
      const rows = await tx("users").select().where("email", email).limit(1);
      return rows.length ? (rows[0] as UserRow) : null;
    },

    async findById(id, tx = q): Promise<UserRow | null> {
      const rows = await tx("users").select().where("id", id).limit(1);
      return rows.length ? (rows[0] as UserRow) : null;
    },

    async insert(input, tx = q): Promise<UserRow> {
      const [row] = await tx("users").insert(input).returning("*");
      return row as UserRow;
    },
  };
}

/** Shared singleton — production code should use this (or `repositories`). */
export const userRepository = createUserRepository();
