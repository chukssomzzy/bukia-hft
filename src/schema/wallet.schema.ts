import { z } from "zod";

/**
 * @openapi
 * components:
 *   schemas:
 *     CreateWalletBody:
 *       type: object
 *       properties:
 *         currency:
 *           type: string
 *           minLength: 2
 *           maxLength: 3
 *           description: ISO currency code (e.g. USD, NGN)
 *       required:
 *         - currency
 */
export const CreateWalletBodySchema = z.object({
  currency: z.string().min(2).max(3),
});

/**
 * @openapi
 * components:
 *   schemas:
 *     WalletResponse:
 *       type: object
 *       properties:
 *         balance:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         currency:
 *           type: string
 *         id:
 *           type: integer
 *         isDefault:
 *           type: boolean
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         userId:
 *           type: integer
 *       required:
 *         - id
 *         - userId
 *         - currency
 *         - balance
 *         - isDefault
 *         - createdAt
 *         - updatedAt
 */
export const WalletResponseSchema = z.object({
  balance: z.string().nullable(),
  createdAt: z.date().nullable(),
  currency: z.string(),
  id: z.number(),
  isDefault: z.boolean().nullable(),
  updatedAt: z.date(),
  userId: z.number().nullable(),
  version: z.number().optional().nullable(),
});

/**
 * @openapi
 * components:
 *   schemas:
 *     WalletListResponse:
 *       type: array
 *       items:
 *         $ref: '#/components/schemas/WalletResponse'
 */
export const WalletListResponseSchema = z.array(WalletResponseSchema);

export type CreateWalletBodyType = z.infer<typeof CreateWalletBodySchema>;
export type WalletListResponseType = z.infer<typeof WalletListResponseSchema>;
export type WalletResponseType = z.infer<typeof WalletResponseSchema>;
