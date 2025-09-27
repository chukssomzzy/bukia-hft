import { LedgerRepository } from "../repositories";
import {
  SystemSummaryResponseSchema,
  SystemSummaryResponseType,
  UserAnalyticsResponseSchema,
  UserAnalyticsResponseType,
} from "../schema/analytics.schema";
import { cacheable } from "../utils/cache-decorator";
import log from "../utils/logger";
import { currencyConversionService } from "./currency-convertion.services";

const CACHE_TTL = 30;

export class AnalyticsServices {
  @cacheable<[number, string], UserAnalyticsResponseType>({
    keyGenerator: (userId: number, baseCurrency: string) =>
      `analytics:user:${userId}:currency:${baseCurrency}`,
    lockKeyGenerator: (userId: number) => `analytics:lock:user:${userId}`,
    lockTtlSeconds: 5,
    ttlSeconds: CACHE_TTL,
  })
  public async computeAnalytics(
    userId: number,
    baseCurrency: string = "USD",
  ): Promise<UserAnalyticsResponseType> {
    try {
      const totalTransactions = await this.getTotalTransactionsForUser(userId);
      const { creditsRows, debitsRows } =
        await this.getCreditsDebitsBreakdown(userId);
      const creditsAgg = await this.convertAndAggregateRows(
        creditsRows,
        baseCurrency,
      );
      const debitsAgg = await this.convertAndAggregateRows(
        debitsRows,
        baseCurrency,
      );
      const largestTransfer = await this.getLargestTransferAmount(
        userId,
        baseCurrency,
      );

      const result = UserAnalyticsResponseSchema.parse({
        credits: {
          count: creditsAgg.count,
          total: String(creditsAgg.total),
        },
        currency: baseCurrency,
        debits: {
          count: debitsAgg.count,
          total: String(debitsAgg.total),
        },
        largestTransfer: String(largestTransfer),
        totalTransactions,
      });

      log.info({
        baseCurrency,
        cacheTtl: CACHE_TTL,
        event: "analytics_computed",
        userId,
      });
      return result;
    } catch (err) {
      log.error({
        error: (err as Error).message,
        event: "analytics_failure",
        userId,
      });
      throw err;
    }
  }

  @cacheable<[string], SystemSummaryResponseType>({
    keyGenerator: (baseCurrency: string) =>
      `analytics:system:summary:currency:${baseCurrency}`,
    lockKeyGenerator: () => `analytics:system:summary:lock`,
    lockTtlSeconds: 5,
    ttlSeconds: CACHE_TTL,
  })
  public async getSystemSummary(
    baseCurrency: string = "USD",
  ): Promise<SystemSummaryResponseType> {
    try {
      const breakdown = await LedgerRepository.getTotalTransfersByCurrency();
      const totalCount = await LedgerRepository.getTotalTransferCount();

      const converted = await Promise.all(
        breakdown.map(async (r) => {
          const amt = Number(r.total ?? "0");
          const conv = await currencyConversionService.convert(
            amt,
            r.currency,
            baseCurrency,
          );
          return { count: r.count, currency: r.currency, total: conv };
        }),
      );

      const totalValue = converted.reduce((s, r) => s + (r.total ?? 0), 0);

      const result = SystemSummaryResponseSchema.parse({
        currency: baseCurrency,
        currencyBreakdown: converted.map((c) => ({
          count: c.count,
          currency: c.currency,
          total: String(c.total),
        })),
        totalTransfersCount: totalCount,
        totalValue: String(totalValue),
      });

      log.info({
        baseCurrency,
        cacheTtl: CACHE_TTL,
        event: "system_summary_computed",
      });
      return result;
    } catch (err) {
      log.error({
        error: (err as Error).message,
        event: "system_summary_failure",
      });
      throw err;
    }
  }

  public async getUserAnalytics(
    userId: number,
    baseCurrency: string = "USD",
  ): Promise<UserAnalyticsResponseType> {
    return this.computeAnalytics(userId, baseCurrency);
  }

  private async convertAndAggregateRows(
    rows: Array<{ count: number; currency: string; total: string }>,
    baseCurrency: string,
  ) {
    const converted = await Promise.all(
      rows.map(async (r) => {
        const amt = Number(r.total ?? "0");
        const conv = await currencyConversionService.convert(
          amt,
          r.currency,
          baseCurrency,
        );
        return { count: r.count, total: conv };
      }),
    );

    const count = converted.reduce((s, r) => s + (r.count ?? 0), 0);
    const total = converted.reduce((s, r) => s + (r.total ?? 0), 0);
    return { count, total };
  }

  private async getCreditsDebitsBreakdown(userId: number) {
    const breakdownByCurrency =
      await LedgerRepository.getCreditsDebitsBreakdownByCurrencyForUser(userId);

    const creditsRows = breakdownByCurrency.filter((r) => r.type === "credit");
    const debitsRows = breakdownByCurrency.filter((r) => r.type === "debit");

    return { creditsRows, debitsRows };
  }

  private async getLargestTransferAmount(
    userId: number,
    baseCurrency: string,
  ): Promise<number> {
    const largestByCurrency =
      await LedgerRepository.getLargestByCurrencyForUser(userId);
    let largestNum = 0;

    await Promise.all(
      largestByCurrency.map(async (r) => {
        const amt = Number(r.max ?? "0");
        const conv = await currencyConversionService.convert(
          amt,
          r.currency,
          baseCurrency,
        );
        if (conv > largestNum) largestNum = conv;
      }),
    );

    return largestNum;
  }

  private async getTotalTransactionsForUser(userId: number): Promise<number> {
    return await LedgerRepository.getTransactionCountForUser(userId);
  }
}

export const analyticsServices = new AnalyticsServices();
