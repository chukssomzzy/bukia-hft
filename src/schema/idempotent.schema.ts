import { z } from "zod";

/**
 * @openapi
 * components:
 *   schemas:
 *     IdempotentParams:
 *       type: object
 *       properties:
 *         key:
 *           type: string
 *           example: abc123
 *     IdempotentStatus:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [pending, processing, completed, failed]
 *         progress:
 *           type: number
 *           example: 50
 *         completed:
 *           type: boolean
 *         response:
 *           type: object
 */
export const IdempotentParamsSchema = z.object({
  key: z.string().min(1),
});

export const IdempotentStatusSchema = z.object({
  completed: z.boolean(),
  progress: z.number().min(0).max(100).optional(),
  response: z.any().nullable().optional(),
  status: z.enum(["pending", "processing", "completed", "failed"]),
});

export type IdempotentParamsType = z.infer<typeof IdempotentParamsSchema>;
export type IdempotentStatusType = z.infer<typeof IdempotentStatusSchema>;
