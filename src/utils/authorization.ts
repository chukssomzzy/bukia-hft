import { NextFunction, Request, Response } from "express";

import { UserRole } from "../enums/user-roles";
import { Forbidden, Unauthorized } from "../middleware/error";

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
