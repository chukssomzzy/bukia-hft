import { describe, expect, it } from "@jest/globals";

import { sendJsonResponse } from "../../utils/send-json-response";

describe("sendJsonResponse", () => {
  it("should be defined", () => {
    expect(sendJsonResponse).toBeDefined();
  });
});
