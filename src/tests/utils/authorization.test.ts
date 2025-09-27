import { NextFunction, Request, Response } from "express";

import { UserRole } from "../../enums/user-roles";
import { Forbidden, Unauthorized } from "../../middleware/error";
import { RoleGuard } from "../../utils/authorization";

describe("RoleGuard", () => {
  let req: Request;
  let res: Response;
  let next: jest.Mock;
  let originalHandler: jest.Mock;
  let handler: (req: Request, res: Response, next: NextFunction) => unknown;

  beforeEach(() => {
    req = {} as Request;
    res = {} as Response;
    next = jest.fn();
    originalHandler = jest.fn();
  });

  function applyDecorator(roles: UserRole[], user?: { role?: UserRole }) {
    req.user = user;
    const descriptor: TypedPropertyDescriptor<
      (req: Request, res: Response, next: NextFunction) => unknown
    > = {
      value: originalHandler,
    };
    RoleGuard(...roles)({}, "test", descriptor);
    handler = descriptor.value!;
  }

  it("should call next with Unauthorized if req.user is missing", () => {
    applyDecorator([UserRole.ADMIN]);
    handler(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Unauthorized));
    expect(originalHandler).not.toHaveBeenCalled();
    expect(next.mock.calls[0][0].message).toMatch(/not authenticated/i);
  });

  it("should call next with Forbidden if user role is not allowed", () => {
    applyDecorator([UserRole.USER]);
    req.user = { role: UserRole.ADMIN };
    handler(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Forbidden));
    expect(originalHandler).not.toHaveBeenCalled();
    expect(next.mock.calls[0][0].message).toMatch(/do not have permission/i);
  });

  it("should handle missing role in user object", () => {
    applyDecorator([UserRole.ADMIN]);
    req.user = {};
    handler(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Forbidden));
    expect(originalHandler).not.toHaveBeenCalled();
  });

  it("should handle empty allowedRoles array (no one except SUPER_ADMIN allowed)", () => {
    applyDecorator([]);
    req.user = { role: UserRole.ADMIN };
    handler(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Forbidden));
    expect(originalHandler).not.toHaveBeenCalled();

    next.mockClear();
    originalHandler.mockClear();

    req.user = { role: UserRole.SUPER_ADMIN };
    handler(req, res, next);
    expect(next).not.toHaveBeenCalledWith(expect.any(Forbidden));
    expect(originalHandler).toHaveBeenCalledTimes(1);
  });

  it("should allow SUPER_ADMIN for any route", () => {
    applyDecorator([UserRole.ADMIN, UserRole.USER]);
    req.user = { role: UserRole.SUPER_ADMIN };
    handler(req, res, next);
    expect(next).not.toHaveBeenCalledWith(expect.any(Forbidden));
    expect(originalHandler).toHaveBeenCalledTimes(1);
  });

  it("should allow user with allowed role", () => {
    applyDecorator([UserRole.ADMIN, UserRole.USER]);
    req.user = { role: UserRole.ADMIN };
    handler(req, res, next);
    expect(next).not.toHaveBeenCalledWith(expect.any(Forbidden));
    expect(originalHandler).toHaveBeenCalledTimes(1);

    next.mockClear();
    originalHandler.mockClear();

    req.user = { role: UserRole.USER };
    handler(req, res, next);
    expect(next).not.toHaveBeenCalledWith(expect.any(Forbidden));
    expect(originalHandler).toHaveBeenCalledTimes(1);
  });

  it("should deny access if role is null or undefined", () => {
    applyDecorator([UserRole.ADMIN]);
    req.user = { role: null as unknown as UserRole };
    handler(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Forbidden));
    expect(originalHandler).not.toHaveBeenCalled();

    next.mockClear();
    originalHandler.mockClear();

    req.user = { role: undefined as unknown as UserRole };
    handler(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Forbidden));
    expect(originalHandler).not.toHaveBeenCalled();
  });

  it("should deny access if allowedRoles is empty and user role is not SUPER_ADMIN", () => {
    applyDecorator([]);
    req.user = { role: UserRole.USER };
    handler(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Forbidden));
    expect(originalHandler).not.toHaveBeenCalled();
  });

  it("should allow access if allowedRoles contains only SUPER_ADMIN and user is SUPER_ADMIN", () => {
    applyDecorator([UserRole.SUPER_ADMIN]);
    req.user = { role: UserRole.SUPER_ADMIN };
    handler(req, res, next);
    expect(next).not.toHaveBeenCalledWith(expect.any(Forbidden));
    expect(originalHandler).toHaveBeenCalledTimes(1);
  });
});
