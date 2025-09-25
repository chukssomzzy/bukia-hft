import { NextFunction, Request, Response } from "express";

import log from "../utils/logger";

class HttpError extends Error {
  statusCode: number;
  success: boolean = false;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
  }
}

class BadRequest extends HttpError {
  constructor(message: string) {
    super(400, message);
  }
}

class Conflict extends HttpError {
  constructor(message: string) {
    super(409, message);
  }
}

class Forbidden extends HttpError {
  constructor(message: string) {
    super(403, message);
  }
}

class InvalidInput extends HttpError {
  constructor(message: string) {
    super(422, message);
  }
}

class ResourceNotFound extends HttpError {
  constructor(message: string) {
    super(404, message);
  }
}

class ServerError extends HttpError {
  constructor(message: string) {
    super(500, message);
  }
}

class Unauthorized extends HttpError {
  constructor(message: string) {
    super(401, message);
  }
}

export class RateLimitError extends HttpError {
  public readonly retryAfterSec: number;
  public readonly statusCode: number;

  constructor(message: string, retryAfterSec: number) {
    super(429, message);
    this.statusCode = 429;
    this.retryAfterSec = retryAfterSec;
  }
}

const routeNotFound = (req: Request, res: Response) => {
  const message = `Route not found: ${req.originalUrl}`;
  res.status(404).json({ message, status: 404, success: false });
};

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  log.error(err);

  let status = 500;
  let message = "Internal Server Error";
  let errors = undefined;

  if (typeof err === "object" && err !== null) {
    const errorObj = err as Record<string, unknown>;
    if ("statusCode" in errorObj && typeof errorObj.statusCode === "number") {
      status = Number(errorObj.statusCode);
    }
    if ("message" in errorObj && typeof errorObj.message === "string") {
      message = errorObj.message;
    }
    if ("errors" in errorObj) {
      errors = errorObj.errors;
    }
  }

  res.status(status).json({
    message,
    status,
    success: false,
    ...(errors && { errors }),
  });
}

export {
  BadRequest,
  Conflict,
  Forbidden,
  HttpError,
  InvalidInput,
  ResourceNotFound,
  routeNotFound,
  ServerError,
  Unauthorized,
};
