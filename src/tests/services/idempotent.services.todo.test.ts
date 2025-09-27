describe("IdempotentServices", () => {
  describe("getStatus", () => {
    it.todo("returns pending/default status when key not found");
    it.todo("returns correct completed/progress/response when record exists with processing/completed/failed");
  });

  describe("streamStatus", () => {
    it.todo("writes SSE headers and writes status updates when status changes");
    it.todo("stops emitting and ends response when status.completed becomes true");
    it.todo("cleans up interval when request 'close' event fired");
  });
});