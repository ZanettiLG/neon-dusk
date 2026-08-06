// Test environment — points the app at the isolated Postgres + Redis stack
// (docker-compose.test.yml) BEFORE any app module is imported.
process.env.NODE_ENV = "test";
process.env.PORT = "3000";
process.env.HOST = "127.0.0.1";
process.env.LOG_LEVEL = "fatal"; // valid enum; keeps pino quiet in tests
process.env.DATABASE_URL = "postgres://neondusk:neondusk_dev@localhost:55432/neondusk";
process.env.REDIS_URL = "redis://localhost:56379/0";
process.env.RATE_LIMIT_MAX = "100";
process.env.RATE_LIMIT_WINDOW_MS = "60000";
process.env.CORS_ORIGIN = "http://localhost:5173";
