import { NextFunction, Request, RequestHandler, Response } from "express";
import { z, ZodTypeAny } from "zod";

import { InvalidInput } from "../middleware/error";

class ValidationError extends InvalidInput {
  errors: unknown;
  constructor(message: string, errors: unknown) {
    super(message);
    this.errors = errors;
  }
}

const validateRequestBody = <T extends ZodTypeAny>(
  schema: T,
): RequestHandler<Record<string, never>, unknown, z.infer<T>, unknown> => {
  return async (
    req: Request<Record<string, never>, unknown, z.infer<T>, unknown>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const parsed = await schema.parseAsync(req.body as unknown);
      req.body = parsed;
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        return next(new ValidationError("Invalid body schema", err.errors));
      }
      next(err);
    }
  };
};

const validateRequestParams = <T extends ZodTypeAny>(
  schema: T,
): RequestHandler<z.infer<T>, unknown, unknown, unknown> => {
  return async (
    req: Request<z.infer<T>, unknown, unknown, unknown>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const parsed = await schema.parseAsync(req.params as unknown);
      req.params = parsed as unknown as Request<z.infer<T>>["params"];
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        return next(new ValidationError("Invalid params schema", err.errors));
      }
      next(err);
    }
  };
};

const validateRequestQuery = <T extends ZodTypeAny>(
  schema: T,
): RequestHandler<Record<string, never>, unknown, unknown, z.infer<T>> => {
  return async (
    req: Request<Record<string, never>, unknown, unknown, z.infer<T>>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const parsed = await schema.parseAsync(req.query as unknown);
      req.query = parsed;
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        return next(new ValidationError("Invalid query schema", err.errors));
      }
      next(err);
    }
  };
};

export {
  validateRequestBody,
  validateRequestParams,
  validateRequestQuery,
  ValidationError,
};
