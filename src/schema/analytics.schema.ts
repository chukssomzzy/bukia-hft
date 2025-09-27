import { z } from "zod";

function isValidCurrencyCode(code: string): boolean {
  try {
    new Intl.NumberFormat("en", { currency: code, style: "currency" });
    return true;
  } catch {
    return false;
  }
}
/**
 * @openapi
 * components:
 *   schemas:
 *     AnalyticsBreakdown:
 *       type: object
 *       properties:
 *         count:
 *           type: integer
 *         total:
 *           type: string
 *     UserAnalyticsResponse:
 *       type: object
 *       properties:
 *         totalTransactions:
 *           type: integer
 *         largestTransfer:
 *           type: string
 *         credits:
 *           $ref: '#/components/schemas/AnalyticsBreakdown'
 *         debits:
 *           $ref: '#/components/schemas/AnalyticsBreakdown'
 */

export const AnalyticsBreakdownSchema = z.object({
  count: z.number().int().nonnegative(),
  total: z.string(),
});
export const UserAnalyticsResponseSchema = z.object({
  credits: AnalyticsBreakdownSchema,
  currency: z.string(),
  debits: AnalyticsBreakdownSchema,
  largestTransfer: z.string(),
  totalTransactions: z.number().int().nonnegative(),
});

/**
 * @openapi
 * components:
 *   schemas:
 *     UserAnalyticsQuery:
 *       type: object
 *       properties:
 *         currency:
 *           type: string
 *           description: The currency code to use for analytics (e.g., "USD", "NGN"). If not provided, defaults to "USD".
 *       example:
 *         currency: "USD"
 */
export const UserAnalyticsQuerySchema = z.object({
  currency: z
    .string()
    .optional()
    .transform((c) =>
      typeof c === "string" && c.trim() ? c.toUpperCase() : "USD",
    )
    .refine(isValidCurrencyCode, {
      message: "Invalid currency code",
    }),
});

export const SystemSummaryCurrencyBreakdownSchema = z.object({
  count: z.number().int().nonnegative(),
  currency: z.string(),
  total: z.string(),
});

export const SystemSummaryResponseSchema = z.object({
  currency: z.string(),
  currencyBreakdown: z.array(SystemSummaryCurrencyBreakdownSchema),
  totalTransfersCount: z.number().int().nonnegative(),
  totalValue: z.string(),
});

export const SystemSummaryQuerySchema = z.object({
  currency: z
    .string()
    .optional()
    .transform((c) =>
      typeof c === "string" && c.trim() ? c.toUpperCase() : "USD",
    )
    .refine(isValidCurrencyCode, { message: "Invalid currency code" }),
});

export type SystemSummaryQueryType = z.infer<typeof SystemSummaryQuerySchema>;
export type SystemSummaryResponseType = z.infer<
  typeof SystemSummaryResponseSchema
>;
export type UserAnalyticsQueryType = z.infer<typeof UserAnalyticsQuerySchema>;
export type UserAnalyticsResponseType = z.infer<
  typeof UserAnalyticsResponseSchema
>;
