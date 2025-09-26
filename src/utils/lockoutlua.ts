import fs from "fs";
import Redis from "ioredis";
import path from "path";

import { LockoutConfig } from "./lockout";

const LUA_SCRIPT_PATH = path.join(__dirname, "lockout.lua");
let LUA_SCRIPT_TEXT: string | undefined = undefined;

/**
 * Loads and caches the Lua script text from disk.
 * @returns {string} The Lua script contents.
 */
export function getLuaScriptText(): string {
  if (!LUA_SCRIPT_TEXT)
    LUA_SCRIPT_TEXT = fs.readFileSync(LUA_SCRIPT_PATH, "utf8");
  return LUA_SCRIPT_TEXT;
}

/**
 * Runs the lockout Lua script in Redis, loading it if necessary.
 * @param {Redis} redis - The Redis client.
 * @param {string} failKey - The Redis key for failures.
 * @param {string} lockKey - The Redis key for locks.
 * @param {LockoutConfig} baseConfig - The lockout configuration.
 * @param {string | null} scriptSha - The cached SHA of the loaded script.
 * @returns {Promise<{status: number, value: number}>} The result from the script.
 */
export async function runLuaScript(
  redis: Redis,
  failKey: string,
  lockKey: string,
  baseConfig: LockoutConfig,
  scriptSha: string,
): Promise<{ status: number; value: number }> {
  if (!scriptSha) {
    const script = getLuaScriptText();
    scriptSha = (await redis.script("LOAD", script)) as unknown as string;
  }

  try {
    const res = await redis.evalsha(
      scriptSha,
      2,
      failKey,
      lockKey,
      String(baseConfig.threshold),
      String(baseConfig.windowSeconds),
      String(baseConfig.lockSeconds),
    );
    if (!Array.isArray(res) || res.length < 2) return { status: 0, value: 0 };
    return { status: Number(res[0]) || 0, value: Number(res[1]) || 0 };
  } catch {
    const script = getLuaScriptText();
    scriptSha = (await redis.script("LOAD", script)) as string;
    const res = await redis.evalsha(
      scriptSha,
      2,
      failKey,
      lockKey,
      String(baseConfig.threshold),
      String(baseConfig.windowSeconds),
      String(baseConfig.lockSeconds),
    );
    if (!Array.isArray(res) || res.length < 2) return { status: 0, value: 0 };
    return { status: Number(res[0]) || 0, value: Number(res[1]) || 0 };
  }
}
