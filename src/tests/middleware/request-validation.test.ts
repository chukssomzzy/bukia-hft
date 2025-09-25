import type { NextFunction, Request, Response } from "express";

import { afterEach, describe, expect, it } from "@jest/globals";
import { z } from "zod";

import {
  validateRequestBody,
  validateRequestParams,
  validateRequestQuery,
  ValidationError,
} from "../../middleware/request-validation";

describe("validateRequestParams, validateRequestBody, validateRequestQuery", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("validateRequestBody", () => {
    it("parses body and calls next on success", async () => {
      const schema = z.object({ name: z.string() });
      const req = { body: { name: "alice" } } as unknown as Request<
        Record<string, never>,
        unknown,
        z.infer<typeof schema>,
        unknown
      >;
      const res = {} as unknown as Response;
      const next = jest.fn() as unknown as NextFunction;

      const mw = validateRequestBody(schema);
      await mw(req, res, next);

      expect(req.body).toEqual({ name: "alice" });
      expect(next).toHaveBeenCalledTimes(1);
      expect((next as unknown as jest.Mock).mock.calls[0][0]).toBeUndefined();
    });

    it("calls next with ValidationError when zod fails", async () => {
      const schema = z.object({ age: z.number() });
      const req = { body: { age: "not-a-number" } } as unknown as Request<
        Record<string, never>,
        unknown,
        z.infer<typeof schema>,
        unknown
      >;
      const res = {} as unknown as Response;
      const next = jest.fn() as unknown as NextFunction;

      const mw = validateRequestBody(schema);
      await mw(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = (next as unknown as jest.Mock).mock.calls[0][0];
      expect(err).toBeInstanceOf(ValidationError);
      expect(err.message).toBe("Invalid body schema");
      expect(err.errors).toBeDefined();
    });

    it("forwards non-zod errors", async () => {
      const schema = z.object({ foo: z.string() });
      const parseSpy = jest
        .spyOn(schema, "parseAsync")
        .mockRejectedValue(new Error("boom"));

      const req = { body: { foo: "bar" } } as unknown as Request<
        Record<string, never>,
        unknown,
        z.infer<typeof schema>,
        unknown
      >;
      const res = {} as unknown as Response;
      const next = jest.fn() as unknown as NextFunction;

      const mw = validateRequestBody(schema);
      await mw(req, res, next);

      expect(parseSpy).toHaveBeenCalled();
      const err = (next as unknown as jest.Mock).mock.calls[0][0];
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe("boom");
    });
  });

  describe("validateRequestParams", () => {
    it("parses params and calls next on success", async () => {
      const schema = z.object({ id: z.string() });
      const req = { params: { id: "123" } } as unknown as Request<
        z.infer<typeof schema>,
        unknown,
        unknown,
        unknown
      >;
      const res = {} as unknown as Response;
      const next = jest.fn() as unknown as NextFunction;

      const mw = validateRequestParams(schema);
      await mw(req, res, next);

      expect(req.params).toEqual({ id: "123" });
      expect(next).toHaveBeenCalledTimes(1);
      expect((next as unknown as jest.Mock).mock.calls[0][0]).toBeUndefined();
    });

    it("calls next with ValidationError when params schema invalid", async () => {
      const schema = z.object({ num: z.number() });
      const req = { params: { num: "nan" } } as unknown as Request<
        z.infer<typeof schema>,
        unknown,
        unknown,
        unknown
      >;
      const res = {} as unknown as Response;
      const next = jest.fn() as unknown as NextFunction;

      const mw = validateRequestParams(schema);
      await mw(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = (next as unknown as jest.Mock).mock.calls[0][0];
      expect(err).toBeInstanceOf(ValidationError);
      expect(err.message).toBe("Invalid params schema");
      expect(err.errors).toBeDefined();
    });
  });

  describe("validateRequestQuery", () => {
    it("parses query and calls next on success", async () => {
      const schema = z.object({ q: z.string() });
      const req = { query: { q: "find" } } as unknown as Request<
        Record<string, never>,
        unknown,
        unknown,
        z.infer<typeof schema>
      >;
      const res = {} as unknown as Response;
      const next = jest.fn() as unknown as NextFunction;

      const mw = validateRequestQuery(schema);
      await mw(req, res, next);

      expect(req.query).toEqual({ q: "find" });
      expect(next).toHaveBeenCalledTimes(1);
      expect((next as unknown as jest.Mock).mock.calls[0][0]).toBeUndefined();
    });

    it("calls next with ValidationError when query schema invalid", async () => {
      const schema = z.object({ page: z.number() });
      const req = { query: { page: "one" } } as unknown as Request<
        Record<string, never>,
        unknown,
        unknown,
        z.infer<typeof schema>
      >;
      const res = {} as unknown as Response;
      const next = jest.fn() as unknown as NextFunction;

      const mw = validateRequestQuery(schema);
      await mw(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = (next as unknown as jest.Mock).mock.calls[0][0];
      expect(err).toBeInstanceOf(ValidationError);
      expect(err.message).toBe("Invalid query schema");
      expect(err.errors).toBeDefined();
    });
  });
});
