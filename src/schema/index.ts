import { z } from "zod";

export const BaseResponseSchema = z.object({
  message: z.string(),
  status: z.number(),
  success: z.boolean(),
});

export function createResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return BaseResponseSchema.extend({
    data: dataSchema,
  });
}

/**
 * @openapi
 * components:
 *   schemas:
 *     PaginationBase:
 *       type: object
 *       properties:
 *         total:
 *           type: integer
 *           example: 100
 *         page:
 *           type: integer
 *           example: 1
 *         pageSize:
 *           type: integer
 *           example: 10
 */
export const PaginatedResponseBaseSchema = z.object({
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
});

export const IdParamSchema = z.object({
  id: z
    .string()
    .transform((val) => Number(val))
    .refine((n) => Number.isFinite(n) && n > 0, {
      message: "id must be a positive number",
    }),
});

/**
 * Pagination query schema for pagination.
 * page: current page number (default 1)
 * pageSize: number of items per page (default 10)
 * sort: optional sort field
 * order: optional sort order ("asc" or "desc")
 * search: optional search string
 */
export const PaginationQuerySchema = z.object({
  order: z.enum(["asc", "desc"]).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  sort: z.string().optional(),
});

export type PaginationQueryType = z.infer<typeof PaginationQuerySchema>;
export * from "./auth.schema";
