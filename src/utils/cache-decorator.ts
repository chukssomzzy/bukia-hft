import { RedisService } from "../services/redis.services";

type AsyncFn<TArgs extends unknown[], TResult> = (
  ...args: TArgs
) => Promise<TResult>;

export function cacheable<TArgs extends unknown[], TResult>(opts: {
  keyGenerator: (...args: TArgs) => string;
  lockKeyGenerator?: (...args: TArgs) => string;
  lockTtlSeconds?: number;
  ttlSeconds?: number;
}) {
  const ttl = opts.ttlSeconds ?? 30;
  const lockTtl = opts.lockTtlSeconds ?? 5;
  const lockGen: (...a: TArgs) => string =
    opts.lockKeyGenerator ??
    ((...a: TArgs) => `${opts.keyGenerator(...a)}:lock`);

  return function (
    _target: unknown,
    _propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const original = descriptor.value as AsyncFn<TArgs, TResult>;
    descriptor.value = async function (...args: TArgs) {
      const client = RedisService.getClient();
      const key = opts.keyGenerator(...args);
      const raw = await client.get(key);
      if (raw) return JSON.parse(raw) as TResult;
      const lockKey = lockGen(...args);

      const setRes = await client.set(
        lockKey,
        "1",
        "EX",
        String(lockTtl),
        "NX",
      );
      const gotLock = setRes === "OK";

      if (gotLock) {
        try {
          const res = (await original.apply(this, args)) as TResult;
          await client.set(key, JSON.stringify(res), "EX", String(ttl));
          return res;
        } finally {
          await client.del(lockKey);
        }
      }

      for (let i = 0; i < 5; i++) {
        await new Promise((r) => setTimeout(r, 200));
        const r2 = await client.get(key);
        if (r2) return JSON.parse(r2) as TResult;
      }
      const res = (await original.apply(this, args)) as TResult;
      return res;
    };
    return descriptor;
  };
}
