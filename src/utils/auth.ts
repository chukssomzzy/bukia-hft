import crypto from "crypto";
import jwt from "jsonwebtoken";

import config from "../config";
import { JWTUserPayloadSchema, JWTUserPayloadType } from "../schema";

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

export function signAccessToken(payload: JWTUserPayloadType) {
  payload.type = "access";
  JWTUserPayloadSchema.parse(payload);

  return jwt.sign(payload, config.TOKEN_SECRET, {
    expiresIn: Number(config.ACCESS_TOKEN_EXPIRY),
  });
}

export function signRefreshToken(payload: JWTUserPayloadType) {
  payload.type = "refresh";
  JWTUserPayloadSchema.parse(payload);

  return jwt.sign(payload, config.TOKEN_SECRET, {
    expiresIn: Number(config.REFRESH_TOKEN_EXPIRY),
  });
}

export function verifyJWT(token: string): JWTUserPayloadType | null {
  try {
    return jwt.verify(token, config.TOKEN_SECRET) as JWTUserPayloadType;
  } catch {
    return null;
  }
}
