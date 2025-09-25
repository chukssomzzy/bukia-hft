import { describe, expect, it } from "@jest/globals";

import { errorHandler } from "../../middleware/error";

describe("errorHandler", () => {
  it("should be defined", () => {
    expect(errorHandler).toBeDefined();
  });
});
