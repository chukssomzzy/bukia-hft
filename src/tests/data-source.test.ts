import { describe, expect, it } from "@jest/globals";

import dataSource from "../data-source";

describe("dataSource", () => {
  it("should be defined", () => {
    expect(dataSource).toBeDefined();
  });
});
