import crypto from "crypto";

import config from "../config";

export interface SanitizeOptions {
  denyList?: string[];
  hmacKey?: string;
  hmacLength?: number;
  placeholder?: string;
  useHmac?: boolean;
}

const DEFAULT_DENY = [
  "password",
  "pass",
  "pwd",
  "token",
  "secret",
  "refreshToken",
  "cardNumber",
  "card_number",
  "cvv",
  "otp",
  "accountnumber",
  "account_number",
  "accessToken",
  "pin",
];

export function sanitizeAudit<T = unknown>(
  payload: T,
  options?: SanitizeOptions,
): T {
  const deny = (options?.denyList ?? DEFAULT_DENY).map((d) => d.toLowerCase());
  const useHmac = options?.useHmac ?? true;
  const hmacKey = options?.hmacKey ?? config.TOKEN_SECRET ?? "__audit_key__";
  const hLen = options?.hmacLength ?? 16;
  const placeholder = options?.placeholder ?? "[REDACTED]";

  function redactValue(value: unknown) {
    if (useHmac) {
      return `[HMAC:${hmacTruncate(value, hmacKey, hLen)}]`;
    }
    return placeholder;
  }

  function matchesKey(key: string) {
    const k = key.toLowerCase();
    return deny.some((d) => k === d || k.includes(d));
  }

  function walk(v: unknown): unknown {
    if (Array.isArray(v)) {
      return v.map((i) => walk(i));
    }
    if (isPlainObject(v)) {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v)) {
        if (matchesKey(k)) {
          out[k] = redactValue(val);
        } else {
          out[k] = walk(val);
        }
      }
      return out;
    }
    return v;
  }

  return walk(payload) as T;
}

function hmacTruncate(value: unknown, key: string, length: number) {
  const str = typeof value === "string" ? value : JSON.stringify(value);
  const h = crypto.createHmac("sha256", key).update(str).digest("hex");
  return h.slice(0, length);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
