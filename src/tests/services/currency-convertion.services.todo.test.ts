describe("CurrencyConversionService", () => {
  describe("getRate", () => {
    it.todo("returns 1 when from and to currencies are equal");
    it.todo(
      "calls axios.get with expected URL and returns conversion_rate on success",
    );
    it.todo("throws when API result !== 'success'");
    it.todo("throws or bubbles axios errors appropriately");
  });

  describe("convert", () => {
    it.todo("uses getRate and multiplies amount by rate");
    it.todo("works for integer and floating amounts");
  });
});
