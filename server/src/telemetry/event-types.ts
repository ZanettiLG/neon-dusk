// Re-export from @neon-dusk/shared so the server, app, and DB enum share one
// source of truth. Importing this module (instead of the package directly)
// keeps telemetry call sites behind a single stable surface.
export { GAME_EVENT_TYPES, type GameEventType } from "@neon-dusk/shared";
