import Redis from "ioredis";

export function createRedisClient(url: string): Redis {
  const redis = new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      return Math.min(times * 50, 2000);
    },
    lazyConnect: false,
  });

  redis.on("error", (err) => {
    console.error("Redis connection error:", err.message);
  });

  return redis;
}
