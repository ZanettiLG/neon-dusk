import type { FastifyInstance } from "fastify";
import type Redis from "ioredis";
import type { Character, NilConsumeResponse, NilStatus, NilStimResponse } from "@neon-dusk/shared";
import { createCharacter, createCharacterSchema } from "../services/character-service";
import { consumeNil, consumeNilSchema, getNilStatus, useStim } from "../services/nil-service";
import { authenticate } from "../middleware/auth";
import { checkRateLimit } from "../lib/rate-limit";

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
          await checkRateLimit(redis, `nil:consume:${request.user.sub}`, 10, 60_000);
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
          await checkRateLimit(redis, `nil:stim:${request.user.sub}`, 5, 30_000);
        },
      ],
    },
    async (request) => {
      return useStim(redis, request.user.sub) as Promise<NilStimResponse>;
    },
  );
}
