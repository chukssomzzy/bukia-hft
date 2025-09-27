describe("AnalyticsServices", () => {
  describe("computeAnalytics", () => {
    it.todo(
      "returns aggregated credits/debits totals and counts in base currency",
    );
    it.todo(
      "uses currencyConversionService.convert for rows with different currencies",
    );
    it.todo("returns largestTransfer computed across currencies");
    it.todo("logs info on successful computation and errors on failure");
    it.todo("properly parses and returns schema-validated result");
  });

  describe("getSystemSummary", () => {
    it.todo(
      "converts breakdown by currency into baseCurrency and sums totalValue",
    );
    it.todo("returns Paginated/system summary schema validated response");
    it.todo("handles errors from currencyConversionService and logs them");
  });

  describe("convertAndAggregateRows & helpers", () => {
    it.todo(
      "convertAndAggregateRows converts rows and aggregates count and total",
    );
    it.todo("getCreditsDebitsBreakdown splits rows by type");
    it.todo("getLargestTransferAmount finds the largest after conversion");
    it.todo(
      "getTotalTransactionsForUser proxies to LedgerRepository.getTransactionCountForUser",
    );
  });
});

