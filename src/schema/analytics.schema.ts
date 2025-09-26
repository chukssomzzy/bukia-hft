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

const preprocessToNumber = (val: unknown) => {
  if (val == null) return 0;
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const n = Number(val);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof val === "bigint") return Number(val);
  return 0;
};

const preprocessToString = (val: unknown) => {
  if (val == null) return "0";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "bigint") return String(val);
  return String(val);
};

export const AnalyticsBreakdownSchema = z.object({
  count: z.preprocess(preprocessToNumber, z.number().int().nonnegative()),
  total: z.preprocess(preprocessToString, z.string()),
});
export const UserAnalyticsResponseSchema = z.object({
  credits: AnalyticsBreakdownSchema,
  currency: z.string(),
  debits: AnalyticsBreakdownSchema,
  largestTransfer: z.preprocess(preprocessToString, z.string()),
  totalTransactions: z.preprocess(
    preprocessToNumber,
    z.number().int().nonnegative(),
  ),
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

export type UserAnalyticsQueryType = z.infer<typeof UserAnalyticsQuerySchema>;
export type UserAnalyticsResponseType = z.infer<
  typeof UserAnalyticsResponseSchema
>;
