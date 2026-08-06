// @neon-dusk/shared — shared types barrel
// Feature developers: export cross-package types here (e.g. Character, Gig).

/** Response body of the `GET /api/health` endpoint. */
export interface HealthResponse {
  status: string;
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    database: string;
    redis: string;
  };
}
