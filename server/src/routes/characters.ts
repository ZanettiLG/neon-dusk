import type { FastifyInstance } from "fastify";
import type Redis from "ioredis";
import { z } from "zod";
import type {
  Character,
  CharacterEventsResponse,
  NilConsumeResponse,
  NilStatus,
  NilStimResponse,
} from "@neon-dusk/shared";
import { createCharacter, createCharacterSchema } from "../services/character-service";
import { consumeNil, consumeNilSchema, getNilStatus, useStim } from "../services/nil-service";
import { listCharacterEvents } from "../services/event-service";
import { characterRepository as characters } from "../repositories/character-repository";
import { authenticate } from "../middleware/auth";
import { checkRateLimit } from "../lib/rate-limit";

/** Query schema for the player event feed (ND-139). */
const eventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  // Semantic validation: reject impossible calendar dates (e.g. 2026-99-99)
  // before they reach `new Date(cursor)` inside event-service and throw a 500.
  // The server returns `createdAt` via toISOString() (UTC "Z"), which the
  // frontend passes back verbatim — datetime({ offset: true }) accepts it.
  cursor: z.string().datetime({ offset: true }).optional(),
});

export interface CharacterRoutesOptions {
  redis: Redis;
}

export async function characterRoutes(app: FastifyInstance, opts: CharacterRoutesOptions) {
  const { redis } = opts;

  app.post("/characters", { preHandler: [authenticate] }, async (request, reply) => {
    const input = createCharacterSchema.parse(request.body);
    const character = await createCharacter(request.user.sub, input);
    return reply.status(201).send(character as Character);
  });

  // NIL — energy readout + spend + syn-café (Feature #2). GET is read-only:
  // regen is applied in memory and never persisted. Consume/stim are rate
  // limited per account (not per IP): the limiter runs at preHandler (after
  // authenticate) so `request.user.sub` is always set.
  app.get("/characters/me/nil", { preHandler: [authenticate] }, async (request) => {
    return getNilStatus(request.user.sub) as Promise<NilStatus>;
  });

  app.post(
    "/characters/me/nil/consume",
    {
      preHandler: [
        authenticate,
        async (request) => {
          await checkRateLimit(redis, `nil:consume:${request.user.sub}`, 1000, 60_000);
        },
      ],
    },
    async (request) => {
      const { amount } = consumeNilSchema.parse(request.body);
      return consumeNil(request.user.sub, amount) as Promise<NilConsumeResponse>;
    },
  );

  app.post(
    "/characters/me/nil/use-stim",
    {
      preHandler: [
        authenticate,
        async (request) => {
          await checkRateLimit(redis, `nil:stim:${request.user.sub}`, 500, 30_000);
        },
      ],
    },
    async (request) => {
      return useStim(redis, request.user.sub) as Promise<NilStimResponse>;
    },
  );

  // GET /characters/me/events — read-only player event feed (Feature #139).
  app.get("/characters/me/events", { preHandler: [authenticate] }, async (request) => {
    const { limit, cursor } = eventsQuerySchema.parse(request.query);
    const characterId = (await characters.requireByUserId(request.user.sub)).id;
    return listCharacterEvents(characterId, limit, cursor) as Promise<CharacterEventsResponse>;
  });
}
