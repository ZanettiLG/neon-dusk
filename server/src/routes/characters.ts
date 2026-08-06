import type { FastifyInstance } from "fastify";
import type { Character } from "@neon-dusk/shared";
import { createCharacter, createCharacterSchema } from "../services/character-service";
import { authenticate } from "../middleware/auth";

export async function characterRoutes(app: FastifyInstance) {
  app.post("/characters", { preHandler: [authenticate] }, async (request, reply) => {
    const input = createCharacterSchema.parse(request.body);
    const character = await createCharacter(request.user.sub, input);
    return reply.status(201).send(character as Character);
  });
}
