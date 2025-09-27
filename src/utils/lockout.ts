import type { Redis } from "ioredis";

import { RateLimitError } from "../middleware/error";
import { runLuaScript } from "./lockoutlua";

export interface LockoutOptions<Args extends unknown[] = unknown[]> {
  failurePredicate?: (
    err: unknown,
    result?: unknown,
  ) => boolean | Promise<boolean>;
  getIdFromArgs: (...args: Args) => string;
  lockSeconds?: number;
  methodName?: string;
  redisKeyPrefix?: string;
  serviceName: string;
  threshold?: number;
  windowSeconds?: number;
}

const DEFAULTS = {
  lockSeconds: 900,
  redisKeyPrefix: "lockout",
  threshold: 5,
  windowSeconds: 300,
} as const;

export interface LockoutConfig<Args extends unknown[] = unknown[]> {
  failurePredicate?: (
    err: unknown,
    result?: unknown,
  ) => boolean | Promise<boolean>;
  getIdFromArgs: (...args: Args) => string;
  lockSeconds: number;
  methodName?: string;
  redisKeyPrefix: string;
  serviceName: string;
  threshold: number;
  windowSeconds: number;
}

/**
 * Decorator to apply lockout logic to a method, using Redis and a Lua script.
 *
 * @template Args - Argument types for the decorated method.
 * @template R - Return type for the decorated method.
 * @param {Redis} redis - The Redis client instance.
 * @param {LockoutOptions<Args>} opts - Lockout configuration options.
 * @returns {MethodDecorator} The method decorator.
 */
export function lockout<Args extends unknown[] = unknown[], R = unknown>(
  redis: Redis,
  opts: LockoutOptions<Args>,
): MethodDecorator {
  if (!opts) throw new Error("lockout: options are required");
  if (!opts.serviceName) throw new Error("lockout: serviceName is required");
  if (typeof opts.getIdFromArgs !== "function")
    throw new Error(
      "lockout: getIdFromArgs is required and must be a function",
    );

  const baseConfig: LockoutConfig<Args> = {
    failurePredicate: opts.failurePredicate,
    getIdFromArgs: opts.getIdFromArgs,
    lockSeconds: opts.lockSeconds ?? DEFAULTS.lockSeconds,
    methodName: opts.methodName,
    redisKeyPrefix: opts.redisKeyPrefix ?? DEFAULTS.redisKeyPrefix,
    serviceName: opts.serviceName,
    threshold: opts.threshold ?? DEFAULTS.threshold,
    windowSeconds: opts.windowSeconds ?? DEFAULTS.windowSeconds,
  };

  const scriptSha: null | string = null;

  return function (
    _target: unknown,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const original = descriptor.value as (...a: Args) => Promise<R> | R;
    if (typeof original !== "function") return descriptor;

    const method = baseConfig.methodName ?? String(propertyKey);

    descriptor.value = async function (...args: Args) {
      const idRaw = baseConfig.getIdFromArgs(...args);
      const identifier =
        typeof idRaw === "string" ? idRaw.trim() : String(idRaw ?? "");
      if (!identifier) {
        throw new Error(
          `lockout: identifier resolved to empty string for service="${baseConfig.serviceName}" method="${method}"`,
        );
      }

      const lockKey = `${baseConfig.redisKeyPrefix}:lock:${baseConfig.serviceName}:${method}:${identifier}`;
      const failKey = `${baseConfig.redisKeyPrefix}:fails:${baseConfig.serviceName}:${method}:${identifier}`;

      const ttl = await redis.ttl(lockKey);
      if (ttl && ttl > 0) {
        throw new RateLimitError("Too many attempts, locked", ttl);
      }

      try {
        const result = await Promise.resolve(original.apply(this, args));

        if (baseConfig.failurePredicate) {
          const counts = await baseConfig.failurePredicate(undefined, result);
          if (counts) {
            const { status, value } = await runLuaScript(
              redis,
              failKey,
              lockKey,
              baseConfig,
              scriptSha,
            );
            if (status === 1 || status === 2)
              throw new RateLimitError("Too many attempts, locked", value);
          } else {
            await redis.del(failKey);
          }
        } else {
          await redis.del(failKey);
        }

        return result;
      } catch (err) {
        let countsFailure = true;
        if (baseConfig.failurePredicate)
          countsFailure = await baseConfig.failurePredicate(err);

        if (countsFailure) {
          const { status, value } = await runLuaScript(
            redis,
            failKey,
            lockKey,
            baseConfig,
            scriptSha,
          );
          if (status === 1 || status === 2)
            throw new RateLimitError("Too many attempts, locked", value);
        }

        throw err;
      }
    };

    return descriptor;
  };
}

export default lockout;
