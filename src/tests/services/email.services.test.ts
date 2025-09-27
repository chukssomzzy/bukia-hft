import type { Redis as RedisClient } from "ioredis";

const addMock = jest.fn();
const closeMock = jest.fn();
const duplicateMock = jest.fn(() => ({}) as RedisClient);
const renderTemplateMock = jest.fn();
const providerSendMock = jest.fn();
const providerHealthMock = jest.fn();
const findByTypesMock = jest.fn();

jest.mock("../../providers", () => ({
  AwsSesProvider: jest.fn().mockImplementation(() => ({
    healthCheck: providerHealthMock,
    send: providerSendMock,
  })),
}));

jest.mock("bullmq", () => ({
  Queue: jest
    .fn()
    .mockImplementation(() => ({ add: addMock, close: closeMock })),
}));

jest.mock("../../services/redis.services", () => ({
  RedisService: { duplicate: duplicateMock },
}));

jest.mock("../../utils/templates", () => ({
  renderTemplate: renderTemplateMock,
}));

jest.mock("../../repositories/user.repository", () => ({
  UserRepository: { findByTypes: findByTypesMock },
}));

import { UserRole } from "../../enums/user-roles";
import { emailService } from "../../services/email.services";

interface EmailJob {
  html: string;
  subject?: string;
  to: string;
}

describe("EmailService (unit)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (emailService as unknown as { queue?: unknown }).queue = null;
    (emailService as unknown as { initializing?: unknown }).initializing = null;
  });

  describe("processJob", () => {
    it("processJob should call provider.send with job values", async () => {
      providerSendMock.mockResolvedValue(undefined);
      const job: EmailJob = {
        html: "<p>Hi</p>",
        subject: "Test",
        to: "test@example.com",
      };
      await expect(emailService.processJob(job)).resolves.toBeUndefined();
      expect(providerSendMock).toHaveBeenCalledWith(
        "test@example.com",
        "<p>Hi</p>",
        "Test",
      );
    });

    it("processJob should propagate provider errors", async () => {
      providerSendMock.mockRejectedValue(new Error("Provider error"));
      const job: EmailJob = {
        html: "<p>Hi</p>",
        subject: "Test",
        to: "test@example.com",
      };
      await expect(emailService.processJob(job)).rejects.toThrow(
        "Provider error",
      );
      expect(providerSendMock).toHaveBeenCalledWith(
        "test@example.com",
        "<p>Hi</p>",
        "Test",
      );
      expect(providerSendMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("send", () => {
    it("send should render template and add job to queue", async () => {
      renderTemplateMock.mockResolvedValue("<p>Rendered</p>");
      addMock.mockResolvedValue(undefined);
      await expect(
        emailService.send(
          "test@example.com",
          "user.welcome",
          { firstName: "Test" },
          "Welcome!",
        ),
      ).resolves.toBeUndefined();
      expect(renderTemplateMock).toHaveBeenCalledWith("user.welcome", {
        firstName: "Test",
      });
      expect(addMock).toHaveBeenCalledWith(
        "send",
        {
          html: "<p>Rendered</p>",
          subject: "Welcome!",
          to: "test@example.com",
        },
        expect.objectContaining({ attempts: 5 }),
      );
    });

    it("send should propagate template rendering errors", async () => {
      renderTemplateMock.mockRejectedValue(new Error("Template error"));
      await expect(
        emailService.send(
          "test@example.com",
          "user.welcome",
          { firstName: "Test" },
          "Welcome!",
        ),
      ).rejects.toThrow("Template error");
      expect(renderTemplateMock).toHaveBeenCalledWith("user.welcome", {
        firstName: "Test",
      });
      expect(addMock).not.toHaveBeenCalled();
    });

    it("send should propagate queue.add errors", async () => {
      renderTemplateMock.mockResolvedValue("<p>Rendered</p>");
      addMock.mockRejectedValue(new Error("Queue error"));
      await expect(
        emailService.send(
          "test@example.com",
          "user.welcome",
          { firstName: "Test" },
          "Welcome!",
        ),
      ).rejects.toThrow("Queue error");
      expect(renderTemplateMock).toHaveBeenCalledWith("user.welcome", {
        firstName: "Test",
      });
      expect(addMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("close", () => {
    it("close should call queue.close when queue was created", async () => {
      renderTemplateMock.mockResolvedValue("<p>Rendered</p>");
      addMock.mockResolvedValue(undefined);
      await emailService.send(
        "test@example.com",
        "user.welcome",
        { firstName: "Test" },
        "Welcome!",
      );
      await emailService.close();
      expect(closeMock).toHaveBeenCalled();
    });

    it("close is a no-op if queue was never created", async () => {
      await expect(emailService.close()).resolves.toBeUndefined();
      expect(closeMock).not.toHaveBeenCalled();
    });
  });

  describe("healthCheck", () => {
    it("returns true when provider.healthCheck resolves true", async () => {
      providerHealthMock.mockResolvedValue(true);
      await expect(emailService.healthCheck()).resolves.toBe(true);
      expect(providerHealthMock).toHaveBeenCalled();
    });

    it("returns false when provider.healthCheck resolves false", async () => {
      providerHealthMock.mockResolvedValue(false);
      await expect(emailService.healthCheck()).resolves.toBe(false);
      expect(providerHealthMock).toHaveBeenCalled();
    });

    it("propagates errors when provider.healthCheck rejects", async () => {
      providerHealthMock.mockRejectedValue(new Error("health error"));
      await expect(emailService.healthCheck()).rejects.toThrow("health error");
      expect(providerHealthMock).toHaveBeenCalled();
    });
  });

  describe("getQueue & initQueue", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      (emailService as unknown as { queue?: unknown }).queue = null;
      (emailService as unknown as { initializing?: unknown }).initializing =
        null;
    });

    it("getQueue creates queue when not initialized and subsequent calls reuse it", async () => {
      duplicateMock.mockReturnValue({} as RedisClient);
      const getQueue = (
        emailService as unknown as { getQueue: () => Promise<unknown> }
      ).getQueue;
      const q = await getQueue.call(emailService);
      expect(duplicateMock).toHaveBeenCalled();
      expect(
        (emailService as unknown as { queue?: unknown }).queue,
      ).toBeDefined();
      expect(q).toBe((emailService as unknown as { queue?: unknown }).queue);

      // subsequent getQueue should return same queue without calling duplicate again
      duplicateMock.mockClear();
      const q2 = await getQueue.call(emailService);
      expect(q2).toBe(q);
      expect(duplicateMock).not.toHaveBeenCalled();
    });

    it("concurrent getQueue calls reuse initializing promise", async () => {
      duplicateMock.mockReturnValue({} as RedisClient);
      const getQueue = (
        emailService as unknown as { getQueue: () => Promise<unknown> }
      ).getQueue;

      // Call getQueue twice without awaiting first to exercise the initializing branch
      const [r1, r2] = await Promise.all([
        getQueue.call(emailService),
        getQueue.call(emailService),
      ]);

      expect(duplicateMock).toHaveBeenCalledTimes(1);
      expect(r1).toBe(r2);
      expect(
        (emailService as unknown as { queue?: unknown }).queue,
      ).toBeDefined();
    });

    it("initQueue returns existing initializing promise", async () => {
      // create a deferred promise and set as initializing
      let resolveDeferred: () => void;
      const deferred = new Promise<void>((res) => {
        resolveDeferred = res;
      });
      (emailService as unknown as { initializing?: unknown }).initializing =
        deferred;

      const initQueue = (
        emailService as unknown as { initQueue: () => Promise<void> }
      ).initQueue;
      const ret = initQueue.call(emailService);
      expect(ret).toBeDefined();
      expect(typeof (ret as Promise<void>).then).toBe("function");
      // ensure duplicate wasn't called while waiting on existing initializing
      expect(duplicateMock).not.toHaveBeenCalled();

      // cleanup: resolve to avoid hanging
      resolveDeferred!();
      await ret;
    });

    it("initQueue is a no-op when queue already exists", async () => {
      (emailService as unknown as { queue?: unknown }).queue = { dummy: true };
      const initQueue = (
        emailService as unknown as { initQueue: () => Promise<void> }
      ).initQueue;
      await expect(initQueue.call(emailService)).resolves.toBeUndefined();
      expect(duplicateMock).not.toHaveBeenCalled();
    });

    it("initQueue propagates when RedisService.duplicate throws", async () => {
      (emailService as unknown as { queue?: unknown }).queue = null;
      duplicateMock.mockImplementation(() => {
        throw new Error("dup fail");
      });
      const initQueue = (
        emailService as unknown as { initQueue: () => Promise<void> }
      ).initQueue;
      await expect(initQueue.call(emailService)).rejects.toThrow("dup fail");
      expect((emailService as unknown as { queue?: unknown }).queue).toBeNull();
    });
  });

  describe("sendToUsersByTypes", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });
    it("returns early when no recipients found", async () => {
      findByTypesMock.mockResolvedValue([]);
      const sendSpy = jest
        .spyOn(emailService, "send")
        .mockResolvedValue(undefined);
      await expect(
        emailService.sendToUsersByTypes([UserRole.ADMIN], "user.welcome", {
          firstName: "T",
        }),
      ).resolves.toBeUndefined();
      expect(findByTypesMock).toHaveBeenCalledWith([UserRole.ADMIN]);
      expect(sendSpy).not.toHaveBeenCalled();
      sendSpy.mockRestore();
    });

    it("sends to all valid recipient emails (filters empty and whitespace)", async () => {
      const users = [
        { email: "a@example.com" },
        { email: "" },
        { email: "  " },
        { email: null },
        { email: "b@example.com" },
      ];
      findByTypesMock.mockResolvedValue(users);
      const sendSpy = jest
        .spyOn(emailService, "send")
        .mockResolvedValue(undefined);
      await expect(
        emailService.sendToUsersByTypes(
          [UserRole.ADMIN],
          "user.welcome",
          { firstName: "T" },
          "Sub",
          2,
        ),
      ).resolves.toBeUndefined();
      expect(findByTypesMock).toHaveBeenCalledWith([UserRole.ADMIN]);
      expect(sendSpy).toHaveBeenCalledTimes(2);
      expect(sendSpy).toHaveBeenCalledWith(
        "a@example.com",
        "user.welcome",
        { firstName: "T" },
        "Sub",
        2,
      );
      expect(sendSpy).toHaveBeenCalledWith(
        "b@example.com",
        "user.welcome",
        { firstName: "T" },
        "Sub",
        2,
      );
      sendSpy.mockRestore();
    });

    it("propagates when one of the sends fails but still calls send for all recipients", async () => {
      const users = [{ email: "x@example.com" }, { email: "y@example.com" }];
      findByTypesMock.mockResolvedValue(users);
      const sendSpy = jest
        .spyOn(emailService, "send")
        .mockImplementationOnce(() => Promise.resolve())
        .mockImplementationOnce(() => Promise.reject(new Error("send fail")));
      await expect(
        emailService.sendToUsersByTypes([UserRole.ADMIN], "user.welcome", {
          firstName: "T",
        }),
      ).rejects.toThrow("send fail");
      expect(findByTypesMock).toHaveBeenCalledWith([UserRole.ADMIN]);
      expect(sendSpy).toHaveBeenCalledTimes(2);
      expect(sendSpy).toHaveBeenNthCalledWith(
        1,
        "x@example.com",
        "user.welcome",
        { firstName: "T" },
        undefined,
        0,
      );
      expect(sendSpy).toHaveBeenNthCalledWith(
        2,
        "y@example.com",
        "user.welcome",
        { firstName: "T" },
        undefined,
        0,
      );
      sendSpy.mockRestore();
    });
  });
});
