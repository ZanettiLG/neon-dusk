import { describe, it, expect, beforeAll } from "vitest";
import { db, withTransaction } from "../db";
import { insertTestCharacter } from "./helpers";

// #158 DB repository layer — withTransaction must commit on success and roll
// back on a thrown error. Uses character_wallets as a safe scratch table
// (FK to characters, so we insert a real character first).

describe("withTransaction", () => {
  let characterId: string;

  beforeAll(async () => {
    const c = await insertTestCharacter();
    characterId = c.characterId;
  });

  it("should commit the transaction when the callback resolves", async () => {
    const result = await withTransaction(async (trx) => {
      await trx("character_wallets").insert({
        character_id: characterId,
        balance: 100,
        escrow: 0,
        lifetime_earned: 100,
        lifetime_spent: 0,
        version: 0,
      });
      return "done";
    });

    expect(result).toBe("done");

    // The row must be visible outside the transaction (committed).
    const rows = await db("character_wallets")
      .select("balance")
      .where("character_id", characterId);
    expect(rows).toHaveLength(1);
    expect(rows[0].balance).toBe(100);
  });

  it("should roll back the transaction when the callback throws", async () => {
    const other = (await insertTestCharacter()).characterId;

    await expect(
      withTransaction(async (trx) => {
        await trx("character_wallets").insert({
          character_id: other,
          balance: 50,
          escrow: 0,
          lifetime_earned: 50,
          lifetime_spent: 0,
          version: 0,
        });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    // The row must NOT be visible outside the transaction (rolled back).
    const rows = await db("character_wallets")
      .select("id")
      .where("character_id", other);
    expect(rows).toHaveLength(0);
  });
});
