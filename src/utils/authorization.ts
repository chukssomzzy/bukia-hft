import { NextFunction, Request, Response } from "express";
import Redis from "ioredis";

import { UserRole } from "../enums/user-roles";
import { Forbidden, Unauthorized } from "../middleware/error";
import { OTP_PURPOSE } from "../schema";

/**
 * Generic decorator to inject an `authorized` flag based on a Redis key.
 * The keyPrefix is a function that receives the payload and returns the prefix.
 * Does not throw errors; passes `authorized` as the last argument.
 */
export function isAuthorized<T extends { email: string }>(
  redis: Redis,
  keyPrefix = "otp_verified",
) {
  return function (
    _target: object,
    _propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<
      (payload: T, ...args: unknown[]) => Promise<unknown>
    >,
  ) {
    const original = descriptor.value!;
    descriptor.value = async function (payload: T, ...args: unknown[]) {
      let authorized = false;
      const redisKey = `${keyPrefix}:${payload.email}:${OTP_PURPOSE[2]}`;
      authorized = !!(await redis.get(redisKey));
      if (authorized) {
        await redis.del(redisKey);
      }
      return original.call(this, payload, ...args, authorized);
    };
  };
}

/**
 * Decorator factory to restrict route access to specific user roles.
 * SUPER_ADMIN is always allowed.
 */
export function RoleGuard(...allowedRoles: UserRole[]) {
  return function (
    _target: object,
    _propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<
      (req: Request, res: Response, next: NextFunction) => unknown
    >,
  ) {
    const original = descriptor.value!;
    descriptor.value = function (
      req: Request,
      res: Response,
      next: NextFunction,
    ) {
      if (!req.user) {
        return next(new Unauthorized("User not authenticated"));
      }
      if (
        req.user.role !== UserRole.SUPER_ADMIN &&
        !allowedRoles.includes(req.user.role as UserRole)
      ) {
        return next(
          new Forbidden("You do not have permission to access this resource"),
        );
      }
      return original.call(this, req, res, next);
    };
  };
}
