import rateLimit from "express-rate-limit";

import { RateLimitError } from "../middleware";
import { RedisService } from "../services/redis.services";

export const Limiter = rateLimit({
  max: 100,
  message: "Too many requests from this IP, please try again after 15 minutes",
  windowMs: 15 * 60 * 1000,
});

export interface RateLimitOptions<
  T extends (...args: ReadonlyArray<unknown>) => Promise<unknown>,
> {
  keySelector: (...args: Parameters<T>) => string;
  max: number;
  message?: string;
  prefix?: string;
  windowSec: number;
}

/**
 * Method decorator to rate-limit calls by a derived key (e.g., email).
 * Uses Redis INCR + EXPIRE.
 */
export function RateLimitByKey<
  T extends (...args: ReadonlyArray<unknown>) => Promise<unknown>,
>(options: RateLimitOptions<T>) {
  const { keySelector, max, message, prefix = "rl", windowSec } = options;

  return function (
    _target: object,
    _propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<T>,
  ): void {
    const original = descriptor.value as T;

    descriptor.value = async function (
      ...args: Parameters<T>
    ): Promise<ReturnType<T>> {
      const client = RedisService.getClient();
      const key = keySelector(...args);
      const redisKey = `${prefix}:${key}`;

      const luaScript = `
        local current = redis.call("INCR", KEYS[1])
        if current == 1 then
          redis.call("EXPIRE", KEYS[1], ARGV[1])
        end
        return current
      `;
      const count = (await client.eval(
        luaScript,
        1,
        redisKey,
        windowSec.toString(),
      )) as number;

      if (count > max) {
        const ttl = await client.ttl(redisKey);
        const retryAfter = ttl > 0 ? ttl : windowSec;
        const msg =
          message ??
          `Too many requests. Please try again in ${retryAfter} second(s).`;
        throw new RateLimitError(msg, retryAfter);
      }

      const result = (await (
        original as unknown as (...a: Parameters<T>) => Promise<ReturnType<T>>
      )(...args)) as ReturnType<T>;

      return result;
    } as T;
  };
}
