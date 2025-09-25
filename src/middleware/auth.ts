import { NextFunction, Request, Response } from "express";

import { Unauthorized } from "../middleware/error";
import { UserRepository } from "../repositories/user.repository";
import { JWTUserPayloadSchema } from "../schema";
import { verifyJWT } from "../utils/auth";

export async function authenticateJWT(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return next(new Unauthorized("Missing authentication token"));
  }
  const token = authHeader.replace("Bearer ", "");
  const payload = verifyJWT(token);
  if (
    !payload ||
    !JWTUserPayloadSchema.safeParse(payload).success ||
    payload.type !== "access"
  ) {
    return next(new Unauthorized("Invalid or expired authentication token"));
  }

  const { id, jwtVersion } = payload;
  const user = await UserRepository.findOne({ where: { id } });
  if (!user || user.jwtVersion !== jwtVersion) {
    return next(new Unauthorized("Token version mismatch or user not found"));
  }

  req.user = payload;
  next();
}

const MUTATING_METHODS = new Set(["DELETE", "PATCH", "POST", "PUT"]);

export function mutateOnlyAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!MUTATING_METHODS.has(req.method)) return next();
  return authenticateJWT(req, res, next);
}
