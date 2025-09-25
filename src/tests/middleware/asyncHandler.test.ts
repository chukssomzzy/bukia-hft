import { describe, expect, it } from "@jest/globals";

import { asyncHandler } from "../../middleware/asyncHandler";

describe("asyncHandler", () => {
  it("should be defined", () => {
    expect(asyncHandler).toBeDefined();
  });
});
