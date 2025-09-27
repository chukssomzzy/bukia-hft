import { z } from "zod";

import { WalletResponseSchema } from "./wallet.schema";

/**
 * @openapi
 * components:
 *   schemas:
 *     LedgerEntry:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         amount:
 *           type: string
 *         type:
 *           type: string
 *           enum: [credit, debit]
 *         txId:
 *           type: string
 *         metadata:
 *           type: object
 *         walletId:
 *           type: integer
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         wallet:
 *           $ref: '#/components/schemas/WalletResponse'
 *       required:
 *         - id
 *         - amount
 *         - type
 *         - walletId
 */

export const LedgerEntrySchema = z.object({
  amount: z.string(),
  createdAt: z.date(),
  id: z.number(),
  metadata: z.record(z.unknown()).optional().nullable(),
  txId: z.string().optional().nullable(),
  type: z.enum(["credit", "debit"]),
  updatedAt: z.date(),
  wallet: WalletResponseSchema.optional().nullable(),
  walletId: z.number(),
});

/**
 * @openapi
 * components:
 *   schemas:
 *     PaginatedLedgerResponse:
 *       type: object
 *       properties:
 *         page:
 *           type: integer
 *         pageSize:
 *           type: integer
 *         total:
 *           type: integer
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/LedgerEntry'
 */
export const PaginatedLedgerResponseSchema = z.object({
  items: z.array(LedgerEntrySchema),
  page: z.number().nullable(),
  pageSize: z.number().nullable(),
  total: z.number().nullable(),
});

export type LedgerEntryType = z.infer<typeof LedgerEntrySchema>;
export type PaginatedLedgerResponseType = z.infer<
  typeof PaginatedLedgerResponseSchema
>;
