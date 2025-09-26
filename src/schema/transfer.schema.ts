import { z } from "zod";

/**
 * @openapi
 * components:
 *   schemas:
 *     TransferRequest:
 *       type: object
 *       required:
 *         - fromWalletId
 *         - toWalletId
 *         - amount
 *         - currency
 *       properties:
 *         fromWalletId:
 *           type: integer
 *         toWalletId:
 *           type: integer
 *         amount:
 *           type: string
 *         currency:
 *           type: string
 *         idempotencyKey:
 *           type: string
 *         txId:
 *           type: string
 *         metadata:
 *           type: object
 */
export const TransferRequestSchema = z.object({
  amount: z.string().nonempty(),
  fromWalletId: z.number().int(),
  idempotencyKey: z
    .string()
    .min(1)
    .regex(/^[A-Za-z0-9\-_:]{1,100}$/),
  metadata: z.record(z.any()).optional(),
  toWalletId: z.number().int(),
  txId: z.string().optional(),
});

export type TransferRequestType = z.infer<typeof TransferRequestSchema> & {
  currency: string;
};
