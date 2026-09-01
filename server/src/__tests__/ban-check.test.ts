import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { checkBan, assertCharacterNotBanned } from "../middleware/ban-check";
import {
  characterRepository as characters,
  type CharacterRow,
} from "../repositories/character-repository";
import { AppError } from "../middleware/error-handler";

// ND-053 (Gap D) — manual admin ban gate. The character-repository module is
// mocked so the middleware behavior is observable without a running Postgres
// (same pattern as anti-cheat-audit.test.ts). The DB-unavailable fail-open
// path is simulated by rejecting the repository call with a connection error.

vi.mock("../repositories/character-repository", () => ({
  characterRepository: {
    requireByUserId: vi.fn(),
    findByUserId: vi.fn(),
  },
}));

const USER_ID = "11111111-1111-4111-8111-111111111111";

function requestFor(userId: string): FastifyRequest {
  return { user: { sub: userId } } as unknown as FastifyRequest;
}

function bannedRow(): CharacterRow {
  return { id: randomUUID(), is_banned: true } as unknown as CharacterRow;
}

function cleanRow(): CharacterRow {
  return { id: randomUUID(), is_banned: false } as unknown as CharacterRow;
}

describe("checkBan (ND-053 admin ban gate)", () => {
  beforeEach(() => {
    vi.mocked(characters.requireByUserId).mockReset();
    vi.mocked(characters.findByUserId).mockReset();
  });

  it("should throw 403 BANNED when the character is banned", async () => {
    vi.mocked(characters.requireByUserId).mockResolvedValue(bannedRow());

    await expect(checkBan(requestFor(USER_ID))).rejects.toMatchObject({
      statusCode: 403,
      code: "BANNED",
      message: "Sua conta foi banida.",
    });
  });

  it("should pass when the character is not banned", async () => {
    vi.mocked(characters.requireByUserId).mockResolvedValue(cleanRow());

    await expect(checkBan(requestFor(USER_ID))).resolves.toBeUndefined();
  });

  it("should throw 404 NO_CHARACTER when the user has no character", async () => {
    vi.mocked(characters.requireByUserId).mockRejectedValue(
      new AppError(404, "NO_CHARACTER", "Crie um personagem primeiro"),
    );

    await expect(checkBan(requestFor(USER_ID))).rejects.toMatchObject({
      statusCode: 404,
      code: "NO_CHARACTER",
    });
  });

  it("should fail open when the DB is unavailable (requireByUserId throws)", async () => {
    vi.mocked(characters.requireByUserId).mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(checkBan(requestFor(USER_ID))).resolves.toBeUndefined();
  });

  it("should skip the NO_CHARACTER gate with requireCharacter: false (ban-only)", async () => {
    // A user with no character is allowed through (pre-character flow).
    vi.mocked(characters.findByUserId).mockResolvedValue(null);

    await expect(
      checkBan(requestFor(USER_ID), { requireCharacter: false }),
    ).resolves.toBeUndefined();
    expect(characters.requireByUserId).not.toHaveBeenCalled();
    expect(characters.findByUserId).toHaveBeenCalledWith(USER_ID);
  });

  it("should still block a banned character with requireCharacter: false", async () => {
    vi.mocked(characters.findByUserId).mockResolvedValue(bannedRow());

    await expect(checkBan(requestFor(USER_ID), { requireCharacter: false })).rejects.toMatchObject({
      statusCode: 403,
      code: "BANNED",
    });
  });
});

describe("assertCharacterNotBanned (login gate)", () => {
  beforeEach(() => {
    vi.mocked(characters.findByUserId).mockReset();
  });

  it("should throw 403 BANNED when the character is banned", async () => {
    vi.mocked(characters.findByUserId).mockResolvedValue(bannedRow());

    await expect(assertCharacterNotBanned(USER_ID)).rejects.toMatchObject({
      statusCode: 403,
      code: "BANNED",
      message: "Sua conta foi banida.",
    });
  });

  it("should pass when the character is not banned", async () => {
    vi.mocked(characters.findByUserId).mockResolvedValue(cleanRow());

    await expect(assertCharacterNotBanned(USER_ID)).resolves.toBeUndefined();
  });

  it("should pass when the user has no character (no ban to enforce)", async () => {
    vi.mocked(characters.findByUserId).mockResolvedValue(null);

    await expect(assertCharacterNotBanned(USER_ID)).resolves.toBeUndefined();
  });

  it("should fail open when the DB is unavailable", async () => {
    vi.mocked(characters.findByUserId).mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(assertCharacterNotBanned(USER_ID)).resolves.toBeUndefined();
  });
});
