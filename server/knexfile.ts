import { config } from "dotenv";
import type { Knex } from "knex";

config();

const knexConfig: Knex.Config = {
  client: "pg",
  connection: process.env.DATABASE_URL ?? "postgres://neondusk:neondusk_dev@localhost:5432/neondusk",
  pool: { min: 0, max: 20 },
  acquireConnectionTimeout: 10000,
  migrations: {
    directory: "./migrations",
    extension: "ts",
    tableName: "knex_migrations",
  },
  seeds: {
    directory: "./seeds",
    extension: "ts",
  },
};

export default knexConfig;
