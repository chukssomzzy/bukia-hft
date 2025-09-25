import { jest } from "@jest/globals";

import type { RegisterDeviceType } from "../../schema/device-token.schema";
import type {
  NotificationTemplateKey,
  NotificationTemplateMap,
} from "../../types/notification.template";

import { UserRole } from "../../enums/user-roles";
import { DeviceTokenRepository } from "../../repositories/device-token.repository";
import { pushService } from "../../services/push.services";

interface FcmResponse {
  error?: { code?: string; message?: string };
  success: boolean;
}
interface PushJob {
  data?: Record<string, string>;
  notification: { body?: string; title: string };
  tokens: string[];
}

type QueueAddFn = (
  name: string,
  job: PushJob,
  opts: Record<string, unknown>,
) => Promise<unknown>;
type QueueCloseFn = () => Promise<unknown>;
interface ResponseBatch {
  responses: FcmResponse[];
}

type SendToDevicesFn = (
  tokens: string[],
  notification: { body?: string; title: string },
  data?: Record<string, string> | undefined,
) => Promise<ResponseBatch[]>;

// Provide mock implementations without referencing the outer variables (avoids TDZ when jest hoists mocks)
jest.mock("../../providers/fcm.provider", () => {
  const sendToDevices = jest.fn();
  return {
    fcmProvider: {
      healthCheck: jest.fn().mockReturnValue(true),
      sendToDevices,
    },
  };
});

jest.mock("../../repositories/device-token.repository", () => ({
  DeviceTokenRepository: {
    createAndSave: jest.fn(),
    deactivateToken: jest.fn(),
    findActiveTokensByUserId: jest.fn(),
    findByToken: jest.fn(),
    removeByToken: jest.fn(),
    save: jest.fn(),
    updateLastUsed: jest.fn(),
  },
}));

// mock user repository used by sendTemplateToUsersByType
jest.mock("../../repositories/user.repository", () => ({
  UserRepository: { findByTypes: jest.fn() },
}));

jest.mock("../../utils/logger", () => ({
  /* eslint-disable @typescript-eslint/naming-convention */
  __esModule: true,
  default: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock("../../utils/notifications", () => ({
  buildNotificationPayload: jest.fn(),
}));

jest.mock("../../views/notifications/notifcation.templates", () => {
  const nt: Record<string, unknown> = {};
  nt["sample_template"] = { name: "sample" };
  return { NOTIFICATION_TEMPLATE: nt };
});

jest.mock("bullmq", () => {
  const add = jest.fn().mockImplementation(() => Promise.resolve(undefined));
  const close = jest.fn().mockImplementation(() => Promise.resolve(undefined));
  const QueueMock = jest.fn().mockImplementation(() => ({ add, close }));
  return { Queue: QueueMock };
});

jest.mock("../../services/redis.services", () => ({
  RedisService: { duplicate: jest.fn().mockReturnValue({}) },
}));

interface MockDeviceTokenRepository {
  createAndSave: jest.MockedFunction<(data: unknown) => Promise<unknown>>;
  deactivateToken: jest.MockedFunction<(token: string) => Promise<void>>;
  findActiveTokensByUserId: jest.MockedFunction<
    (userId: number) => Promise<Array<{ token: string }>>
  >;
  findByToken: jest.MockedFunction<(token: string) => Promise<null | unknown>>;
  removeByToken: jest.MockedFunction<(token: string) => Promise<void>>;
  save: jest.MockedFunction<(arg: unknown) => Promise<unknown>>;
  updateLastUsed: jest.MockedFunction<(token: string) => Promise<void>>;
}

// Grab references to the mocks created inside the jest.mock factories
const fcmModule = jest.requireMock(
  "../../providers/fcm.provider",
) as unknown as {
  fcmProvider: {
    healthCheck: jest.MockedFunction<() => Promise<boolean>>;
    sendToDevices: jest.MockedFunction<SendToDevicesFn>;
  };
};
const sendToDevicesMock = fcmModule.fcmProvider
  .sendToDevices as jest.MockedFunction<SendToDevicesFn>;
const fcmHealthMock = fcmModule.fcmProvider.healthCheck as jest.MockedFunction<
  () => Promise<boolean>
>;

const repoModule = jest.requireMock(
  "../../repositories/device-token.repository",
) as unknown as {
  DeviceTokenRepository: Record<string, jest.Mock>;
};
const removeByTokenMock = repoModule.DeviceTokenRepository
  .removeByToken as jest.MockedFunction<(token: string) => Promise<void>>;
const updateLastUsedMock = repoModule.DeviceTokenRepository
  .updateLastUsed as jest.MockedFunction<(token: string) => Promise<void>>;

// user repository mock reference
const userModule = jest.requireMock(
  "../../repositories/user.repository",
) as unknown as { UserRepository: { findByTypes: jest.Mock } };
const userFindMock = userModule.UserRepository
  .findByTypes as jest.MockedFunction<
  (types?: unknown) => Promise<Array<{ id: number }>>
>;

const loggerModule = jest.requireMock("../../utils/logger") as unknown as {
  default: { error: jest.Mock };
};
const logErrorMock = loggerModule.default.error as jest.MockedFunction<
  (arg: unknown) => void
>;

const notificationsModule = jest.requireMock(
  "../../utils/notifications",
) as unknown as {
  buildNotificationPayload: jest.Mock;
};
const buildNotificationPayloadMock =
  notificationsModule.buildNotificationPayload as jest.MockedFunction<
    (
      template: unknown,
      data: Record<string, string>,
      action?: string | undefined,
      url?: string | undefined,
    ) => unknown
  >;

const DeviceTokenRepoMock =
  repoModule.DeviceTokenRepository as unknown as MockDeviceTokenRepository;

describe("PushService (unit)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("processJob", () => {
    it("updates lastUsed for every token when all responses are successful", async () => {
      const job: PushJob = {
        notification: { title: "hi" },
        tokens: ["t1", "t2"],
      };
      sendToDevicesMock.mockResolvedValueOnce([
        { responses: [{ success: true }, { success: true }] },
      ]);
      await expect(pushService.processJob(job)).resolves.toBeUndefined();
      expect(updateLastUsedMock).toHaveBeenCalledTimes(2);
      expect(updateLastUsedMock).toHaveBeenCalledWith("t1");
      expect(updateLastUsedMock).toHaveBeenCalledWith("t2");
      expect(removeByTokenMock).not.toHaveBeenCalled();
      expect(logErrorMock).not.toHaveBeenCalled();
    });

    it("removes invalid tokens and logs when responses contain invalid-token codes", async () => {
      const job: PushJob = {
        notification: { title: "n" },
        tokens: ["ok", "bad", "ok2"],
      };
      sendToDevicesMock.mockResolvedValueOnce([
        {
          responses: [
            { success: true },
            {
              error: {
                code: "messaging/registration-token-not-registered",
                message: "x",
              },
              success: false,
            },
            { success: true },
          ],
        },
      ]);
      await expect(pushService.processJob(job)).resolves.toBeUndefined();
      expect(updateLastUsedMock).toHaveBeenCalledTimes(2);
      expect(updateLastUsedMock).toHaveBeenCalledWith("ok");
      expect(updateLastUsedMock).toHaveBeenCalledWith("ok2");
      expect(removeByTokenMock).toHaveBeenCalledTimes(1);
      expect(removeByTokenMock).toHaveBeenCalledWith("bad");
      expect(logErrorMock).toHaveBeenCalledTimes(1);
      const logged = logErrorMock.mock.calls[0][0] as {
        event?: string;
        token?: string;
      };
      expect(logged).toMatchObject({
        event: "fcm_invalid_token",
        token: "bad",
      });
    });

    it("does not remove tokens for failures with non-invalid codes and does not update lastUsed for those indexes", async () => {
      const job: PushJob = {
        notification: { title: "n" },
        tokens: ["t1", "t2"],
      };
      sendToDevicesMock.mockResolvedValueOnce([
        {
          responses: [
            { error: { code: "some/other-error" }, success: false },
            { error: {}, success: false },
          ],
        },
      ]);
      await expect(pushService.processJob(job)).resolves.toBeUndefined();
      expect(removeByTokenMock).not.toHaveBeenCalled();
      expect(updateLastUsedMock).not.toHaveBeenCalled();
    });

    it("propagates errors thrown by the fcm provider", async () => {
      const job: PushJob = { notification: { title: "n" }, tokens: ["t1"] };
      sendToDevicesMock.mockRejectedValueOnce(new Error("fcmm fail"));
      await expect(pushService.processJob(job)).rejects.toThrow("fcmm fail");
      expect(sendToDevicesMock).toHaveBeenCalledWith(
        job.tokens,
        job.notification,
        undefined,
      );
      expect(removeByTokenMock).not.toHaveBeenCalled();
      expect(updateLastUsedMock).not.toHaveBeenCalled();
    });

    it("handles multiple batches and maps indices to the original tokens array correctly", async () => {
      const job: PushJob = {
        notification: { title: "n" },
        tokens: ["a", "b", "c"],
      };
      sendToDevicesMock.mockResolvedValueOnce([
        {
          responses: [
            { success: true },
            {
              error: { code: "messaging/invalid-registration-token" },
              success: false,
            },
          ],
        },
        { responses: [{ success: true }] },
      ]);
      await expect(pushService.processJob(job)).resolves.toBeUndefined();
      expect(updateLastUsedMock).toHaveBeenCalledTimes(2);
      const calledTokens = updateLastUsedMock.mock.calls.map((c) => c[0]);
      expect(calledTokens).toEqual(["a", "a"]);
      expect(removeByTokenMock).toHaveBeenCalledTimes(1);
      expect(removeByTokenMock).toHaveBeenCalledWith("b");
    });

    it("propagates when DeviceTokenRepository.removeByToken throws", async () => {
      const job: PushJob = {
        notification: { title: "n" },
        tokens: ["t1", "t2"],
      };
      sendToDevicesMock.mockResolvedValueOnce([
        {
          responses: [
            { success: true },
            {
              error: { code: "messaging/invalid-registration-token" },
              success: false,
            },
          ],
        },
      ]);
      removeByTokenMock.mockRejectedValueOnce(new Error("remove fail"));
      await expect(pushService.processJob(job)).rejects.toThrow("remove fail");
    });

    it("propagates when DeviceTokenRepository.updateLastUsed throws", async () => {
      const job: PushJob = { notification: { title: "n" }, tokens: ["t1"] };
      sendToDevicesMock.mockResolvedValueOnce([
        { responses: [{ success: true }] },
      ]);
      updateLastUsedMock.mockRejectedValueOnce(new Error("update fail"));
      await expect(pushService.processJob(job)).rejects.toThrow("update fail");
    });

    it("handles failure responses with no error object (does not remove or update)", async () => {
      const job: PushJob = { notification: { title: "n" }, tokens: ["t1"] };
      sendToDevicesMock.mockResolvedValueOnce([
        { responses: [{ success: false }] },
      ]);
      await expect(pushService.processJob(job)).resolves.toBeUndefined();
      expect(removeByTokenMock).not.toHaveBeenCalled();
      expect(updateLastUsedMock).not.toHaveBeenCalled();
    });
  });

  describe("healthCheck", () => {
    it("returns true when fcmProvider.healthCheck resolves true", async () => {
      fcmHealthMock.mockResolvedValueOnce(true);
      await expect(pushService.healthCheck()).resolves.toBe(true);
      expect(fcmHealthMock).toHaveBeenCalled();
    });

    it("returns false when fcmProvider.healthCheck resolves false", async () => {
      fcmHealthMock.mockResolvedValueOnce(false);
      await expect(pushService.healthCheck()).resolves.toBe(false);
      expect(fcmHealthMock).toHaveBeenCalled();
    });

    it("propagates errors when fcmProvider.healthCheck rejects", async () => {
      fcmHealthMock.mockRejectedValueOnce(new Error("hc fail"));
      await expect(pushService.healthCheck()).rejects.toThrow("hc fail");
      expect(fcmHealthMock).toHaveBeenCalled();
    });
  });

  describe("registerDevice", () => {
    it("should save existing token if found", async () => {
      const existing = { id: 1, token: "t", user: { id: 1 } };
      DeviceTokenRepoMock.findByToken.mockResolvedValueOnce(existing);
      DeviceTokenRepoMock.save.mockResolvedValueOnce(existing);
      const payload1: RegisterDeviceType & { userId: number } = {
        platform: "web",
        token: "t",
        userId: 1,
      } as RegisterDeviceType & { userId: number };
      const result = await pushService.registerDevice(payload1);
      expect(DeviceTokenRepository.findByToken).toHaveBeenCalledWith("t");
      expect(DeviceTokenRepository.save).toHaveBeenCalledWith(existing);
      expect(result).toBe(existing);
    });

    it("should create and save if token not found", async () => {
      DeviceTokenRepoMock.findByToken.mockResolvedValueOnce(null);
      const created = { token: "t", userId: 2 };
      DeviceTokenRepoMock.createAndSave.mockResolvedValueOnce(
        created as unknown,
      );
      const payload2: RegisterDeviceType & { userId: number } = {
        platform: "web",
        token: "t",
        userId: 2,
      } as RegisterDeviceType & { userId: number };
      const result = await pushService.registerDevice(payload2);
      expect(DeviceTokenRepository.findByToken).toHaveBeenCalledWith("t");
      expect(DeviceTokenRepository.createAndSave).toHaveBeenCalledWith(
        payload2,
      );
      expect(result).toBe(created);
    });

    it("should propagate repository errors", async () => {
      DeviceTokenRepoMock.findByToken.mockRejectedValueOnce(new Error("db"));
      const payload3: RegisterDeviceType & { userId: number } = {
        platform: "web",
        token: "t",
        userId: 1,
      } as RegisterDeviceType & { userId: number };
      await expect(pushService.registerDevice(payload3)).rejects.toThrow("db");
    });
  });

  describe("sendTemplateToUser", () => {
    it("builds payload and delegates to sendToUser", async () => {
      DeviceTokenRepoMock.findActiveTokensByUserId.mockResolvedValueOnce([
        { token: "tk1" },
      ]);
      const sendToUserSpy = jest
        .spyOn(
          pushService as unknown as {
            sendToUser(...args: unknown[]): Promise<void>;
          },
          "sendToUser",
        )
        .mockResolvedValue(undefined as unknown as void);
      const templateKey: NotificationTemplateKey =
        "sample_template" as NotificationTemplateKey;
      const templateData: NotificationTemplateMap[typeof templateKey] = {
        foo: "bar",
      } as unknown as NotificationTemplateMap[typeof templateKey];
      buildNotificationPayloadMock.mockReturnValueOnce({
        data: { k: "v" },
        notification: { body: "tpl-body", title: "tpl-title" },
      });
      await expect(
        pushService.sendTemplateToUser(1, templateKey, templateData, 0),
      ).resolves.toBeUndefined();
      expect(buildNotificationPayloadMock).toHaveBeenCalledWith(
        "sample_template",
        templateData as unknown as Record<string, string>,
      );
      expect(sendToUserSpy).toHaveBeenCalledWith(
        1,
        { body: "tpl-body", title: "tpl-title" },
        { k: "v" },
        0,
      );
      sendToUserSpy.mockRestore();
    });

    it("uses default delaySeconds when omitted and calls sendToUser with 0", async () => {
      const sendToUserSpy = jest
        .spyOn(
          pushService as unknown as {
            sendToUser(...args: unknown[]): Promise<void>;
          },
          "sendToUser",
        )
        .mockResolvedValue(undefined as unknown as void);

      const templateKey: NotificationTemplateKey =
        "sample_template" as NotificationTemplateKey;
      const templateData: NotificationTemplateMap[typeof templateKey] = {
        foo: "bar",
      } as unknown as NotificationTemplateMap[typeof templateKey];

      buildNotificationPayloadMock.mockReturnValueOnce({
        data: { k: "v" },
        notification: { body: "tpl-body", title: "tpl-title" },
      });

      await expect(
        // omit delaySeconds to hit default arg branch
        (
          pushService as unknown as {
            sendTemplateToUser(...args: unknown[]): Promise<void>;
          }
        ).sendTemplateToUser(2, templateKey, templateData),
      ).resolves.toBeUndefined();

      expect(sendToUserSpy).toHaveBeenCalledWith(
        2,
        { body: "tpl-body", title: "tpl-title" },
        { k: "v" },
        0,
      );
      sendToUserSpy.mockRestore();
    });
  });

  describe("sendTemplateToUsersByType", () => {
    it("does nothing when no users found", async () => {
      userFindMock.mockResolvedValueOnce([] as Array<{ id: number }>);
      const spy = jest
        .spyOn(
          pushService as unknown as {
            sendTemplateToUser(...args: unknown[]): Promise<void>;
          },
          "sendTemplateToUser",
        )
        .mockResolvedValue(undefined as unknown as void);

      const templateKey: NotificationTemplateKey =
        "sample_template" as NotificationTemplateKey;
      const templateData: NotificationTemplateMap[typeof templateKey] = {
        foo: "bar",
      } as unknown as NotificationTemplateMap[typeof templateKey];

      await expect(
        pushService.sendTemplateToUsersByType(
          [UserRole.REGULAR_USER],
          templateKey,
          templateData,
          0,
        ),
      ).resolves.toBeUndefined();

      expect(userFindMock).toHaveBeenCalledWith([UserRole.REGULAR_USER]);
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it("invokes sendTemplateToUser for every found user with correct args", async () => {
      const users = [{ id: 11 }, { id: 22 }];
      userFindMock.mockResolvedValueOnce(users as Array<{ id: number }>);

      const spy = jest
        .spyOn(
          pushService as unknown as {
            sendTemplateToUser(...args: unknown[]): Promise<void>;
          },
          "sendTemplateToUser",
        )
        .mockResolvedValue(undefined as unknown as void);

      const templateKey: NotificationTemplateKey =
        "sample_template" as NotificationTemplateKey;
      const templateData: NotificationTemplateMap[typeof templateKey] = {
        foo: "bar",
      } as unknown as NotificationTemplateMap[typeof templateKey];

      await expect(
        pushService.sendTemplateToUsersByType(
          [UserRole.REGULAR_USER],
          templateKey,
          templateData,
          5,
        ),
      ).resolves.toBeUndefined();

      expect(spy).toHaveBeenCalledTimes(users.length);
      expect(spy).toHaveBeenCalledWith(
        users[0].id,
        templateKey,
        templateData,
        5,
      );
      expect(spy).toHaveBeenCalledWith(
        users[1].id,
        templateKey,
        templateData,
        5,
      );

      spy.mockRestore();
    });

    it("returns when repository returns null", async () => {
      userFindMock.mockResolvedValueOnce(
        null as unknown as Array<{ id: number }>,
      );
      const spy = jest
        .spyOn(
          pushService as unknown as {
            sendTemplateToUser(...args: unknown[]): Promise<void>;
          },
          "sendTemplateToUser",
        )
        .mockResolvedValue(undefined as unknown as void);

      const templateKey: NotificationTemplateKey =
        "sample_template" as NotificationTemplateKey;
      const templateData: NotificationTemplateMap[typeof templateKey] = {
        foo: "bar",
      } as unknown as NotificationTemplateMap[typeof templateKey];

      await expect(
        pushService.sendTemplateToUsersByType(
          [UserRole.REGULAR_USER],
          templateKey,
          templateData,
          0,
        ),
      ).resolves.toBeUndefined();

      expect(userFindMock).toHaveBeenCalledWith([UserRole.REGULAR_USER]);
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it("propagates repository errors", async () => {
      userFindMock.mockRejectedValueOnce(new Error("db fail"));
      const spy = jest
        .spyOn(
          pushService as unknown as {
            sendTemplateToUser(...args: unknown[]): Promise<void>;
          },
          "sendTemplateToUser",
        )
        .mockResolvedValue(undefined as unknown as void);

      const templateKey: NotificationTemplateKey =
        "sample_template" as NotificationTemplateKey;
      const templateData: NotificationTemplateMap[typeof templateKey] = {
        foo: "bar",
      } as unknown as NotificationTemplateMap[typeof templateKey];

      await expect(
        pushService.sendTemplateToUsersByType(
          [UserRole.REGULAR_USER],
          templateKey,
          templateData,
          0,
        ),
      ).rejects.toThrow("db fail");

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it("propagates errors from sendTemplateToUser and still calls for all users", async () => {
      const users = [{ id: 1 }, { id: 2 }];
      userFindMock.mockResolvedValueOnce(users as Array<{ id: number }>);

      const spy = jest
        .spyOn(
          pushService as unknown as {
            sendTemplateToUser(...args: unknown[]): Promise<void>;
          },
          "sendTemplateToUser",
        )
        .mockRejectedValueOnce(new Error("user fail"))
        .mockResolvedValue(undefined as unknown as void);

      const templateKey: NotificationTemplateKey =
        "sample_template" as NotificationTemplateKey;
      const templateData: NotificationTemplateMap[typeof templateKey] = {
        foo: "bar",
      } as unknown as NotificationTemplateMap[typeof templateKey];

      await expect(
        pushService.sendTemplateToUsersByType(
          [UserRole.REGULAR_USER],
          templateKey,
          templateData,
          2,
        ),
      ).rejects.toThrow("user fail");

      expect(spy).toHaveBeenCalledTimes(users.length);
      expect(spy).toHaveBeenCalledWith(
        users[0].id,
        templateKey,
        templateData,
        2,
      );
      expect(spy).toHaveBeenCalledWith(
        users[1].id,
        templateKey,
        templateData,
        2,
      );

      spy.mockRestore();
    });

    it("sendTemplateToUsersByType uses default delaySeconds when omitted", async () => {
      const users = [{ id: 3 }, { id: 4 }];
      userFindMock.mockResolvedValueOnce(users as Array<{ id: number }>);

      const sendTemplateSpy = jest
        .spyOn(
          pushService as unknown as {
            sendTemplateToUser(...args: unknown[]): Promise<void>;
          },
          "sendTemplateToUser",
        )
        .mockResolvedValue(undefined as unknown as void);

      const templateKey: NotificationTemplateKey =
        "sample_template" as NotificationTemplateKey;
      const templateData: NotificationTemplateMap[typeof templateKey] = {
        foo: "bar",
      } as unknown as NotificationTemplateMap[typeof templateKey];

      await expect(
        // omit delaySeconds
        pushService.sendTemplateToUsersByType(
          [UserRole.REGULAR_USER],
          templateKey,
          templateData,
        ),
      ).resolves.toBeUndefined();

      expect(sendTemplateSpy).toHaveBeenCalledTimes(2);
      expect(sendTemplateSpy).toHaveBeenCalledWith(
        users[0].id,
        templateKey,
        templateData,
        0,
      );
      expect(sendTemplateSpy).toHaveBeenCalledWith(
        users[1].id,
        templateKey,
        templateData,
        0,
      );
      sendTemplateSpy.mockRestore();
    });
  });

  describe("sendToUser", () => {
    let sendToTokensSpy: ReturnType<typeof jest.spyOn>;

    beforeEach(() => {
      DeviceTokenRepoMock.findActiveTokensByUserId.mockReset();
      sendToTokensSpy = jest
        .spyOn(
          pushService as unknown as {
            sendToTokens(...args: unknown[]): Promise<void>;
          },
          "sendToTokens",
        )
        .mockResolvedValue(undefined as unknown as void);
    });
    afterEach(() => {
      (sendToTokensSpy as ReturnType<typeof jest.spyOn>).mockRestore();
      DeviceTokenRepoMock.findActiveTokensByUserId.mockReset();
    });

    it("does nothing when user has no active tokens", async () => {
      DeviceTokenRepoMock.findActiveTokensByUserId.mockResolvedValueOnce([]);
      await expect(
        pushService.sendToUser(1, { title: "x" }, undefined, 0),
      ).resolves.toBeUndefined();
      expect(sendToTokensSpy).not.toHaveBeenCalled();
    });

    it("delegates to sendToTokens with tokens and delay", async () => {
      DeviceTokenRepoMock.findActiveTokensByUserId.mockResolvedValueOnce([
        { token: "tk1" },
        { token: "tk2" },
      ]);
      const data: Record<string, string> = { foo: "bar" };
      await expect(
        pushService.sendToUser(2, { title: "hello" }, data, 3),
      ).resolves.toBeUndefined();
      expect(sendToTokensSpy).toHaveBeenCalledTimes(1);
      expect(sendToTokensSpy.mock.calls[0][0]).toEqual(["tk1", "tk2"]);
      expect(sendToTokensSpy.mock.calls[0][1]).toEqual({ title: "hello" });
      expect(sendToTokensSpy.mock.calls[0][2]).toEqual(data);
      expect(sendToTokensSpy.mock.calls[0][3]).toBe(3);
    });

    it("propagates errors from repository", async () => {
      DeviceTokenRepoMock.findActiveTokensByUserId.mockRejectedValueOnce(
        new Error("db fail"),
      );
      // call and verify it propagates by awaiting the call directly
      try {
        await pushService.sendToUser(1, { title: "x" }, undefined, 0);
        throw new Error("expected to throw");
      } catch (err) {
        expect((err as Error).message).toBe("db fail");
      }
      expect(sendToTokensSpy).not.toHaveBeenCalled();
    });
  });

  describe("initQueue/getQueue", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });
    afterEach(async () => {
      await pushService.close();
    });

    it("initializes queue once and uses RedisService.duplicate", async () => {
      const QueueModuleMock = jest.requireMock("bullmq") as unknown as {
        Queue: jest.Mock;
      };
      const RedisServiceMock = jest.requireMock(
        "../../services/redis.services",
      ) as unknown as { RedisService: { duplicate: jest.Mock } };
      await (
        pushService as unknown as { initQueue(): Promise<void> }
      ).initQueue();
      expect(RedisServiceMock.RedisService.duplicate).toHaveBeenCalled();
      expect(
        (QueueModuleMock.Queue as unknown as jest.Mock).mock,
      ).toBeDefined();
      const q1 = await (
        pushService as unknown as { getQueue(): Promise<unknown> }
      ).getQueue();
      const q2 = await (
        pushService as unknown as { getQueue(): Promise<unknown> }
      ).getQueue();
      expect(q1).toBe(q2);
    });

    it("getQueue waits for initializing and returns queue set by initializing", async () => {
      const QueueModule = jest.requireMock("bullmq") as unknown as {
        Queue: jest.Mock;
      };
      const RedisServiceMock = jest.requireMock(
        "../../services/redis.services",
      ) as unknown as { RedisService: { duplicate: jest.Mock } };
      (pushService as unknown as { queue: unknown }).queue = null;
      (
        pushService as unknown as { initializing: null | Promise<void> }
      ).initializing = (async (): Promise<void> => {
        const connection = RedisServiceMock.RedisService.duplicate();
        (pushService as unknown as { queue: unknown }).queue =
          new (QueueModule.Queue as unknown as new (
            name: string,
            opts: { connection: unknown },
          ) => unknown)("push", { connection });
      })();
      const q = await (
        pushService as unknown as { getQueue(): Promise<unknown> }
      ).getQueue();
      expect(q).toBe((pushService as unknown as { queue: unknown }).queue);
      expect((QueueModule.Queue as unknown as jest.Mock).mock).toBeDefined();
    });
  });

  describe("sendToTokens", () => {
    beforeEach(() => {
      jest.requireMock("bullmq");
    });
    afterEach(async () => {
      jest.restoreAllMocks();
      await pushService.close();
    });

    it("adds job to queue with correct job and options", async () => {
      const tokens = ["t1", "t2"];
      const notification = { title: "Hello" };
      const data: Record<string, string> = { a: "b" };
      await (
        pushService as unknown as { initQueue(): Promise<void> }
      ).initQueue();
      jest.requireMock("bullmq") as unknown as {
        Queue: jest.Mock;
      };
      const addMock = jest.fn() as jest.MockedFunction<QueueAddFn>;
      addMock.mockImplementation(() => Promise.resolve(undefined as unknown));
      const closeMock = jest.fn() as jest.MockedFunction<QueueCloseFn>;
      closeMock.mockImplementation(() => Promise.resolve(undefined as unknown));
      (pushService as unknown as { queue: unknown }).queue = {
        add: addMock,
        close: closeMock,
      };

      await expect(
        pushService.sendToTokens(tokens, notification, data, 0),
      ).resolves.toBeUndefined();

      expect(addMock).toHaveBeenCalledTimes(1);
      const [name, job, opts] = addMock.mock.calls[0];
      expect(name).toBe("send");
      expect(job).toMatchObject({ data, notification, tokens });
      expect(opts).toMatchObject({
        attempts: 5,
        backoff: { delay: 1000, type: "exponential" },
        delay: 0,
        removeOnComplete: true,
        removeOnFail: false,
      });

      // cleanup
      (pushService as unknown as { queue: unknown }).queue = null;
    });

    it("applies delaySeconds correctly", async () => {
      const addMock = jest.fn(() =>
        Promise.resolve(undefined),
      ) as jest.MockedFunction<QueueAddFn>;
      const closeMock = jest.fn(() =>
        Promise.resolve(undefined),
      ) as jest.MockedFunction<QueueCloseFn>;
      const getQueueSpy = jest
        .spyOn(
          pushService as unknown as { getQueue(): Promise<unknown> },
          "getQueue",
        )
        .mockResolvedValue({ add: addMock, close: closeMock } as unknown);

      await expect(
        pushService.sendToTokens(["t"], { title: "x" }, undefined, 3),
      ).resolves.toBeUndefined();

      const opts = addMock.mock.calls[addMock.mock.calls.length - 1][2];
      expect(opts).toBeDefined();
      expect((opts as { delay?: number }).delay).toBe(3000);

      getQueueSpy.mockRestore();
    });

    it("uses default delaySeconds when omitted for sendToTokens", async () => {
      const addMock = jest
        .fn()
        .mockImplementation(() => Promise.resolve(undefined));
      const closeMock = jest
        .fn()
        .mockImplementation(() => Promise.resolve(undefined));
      (pushService as unknown as { queue?: unknown }).queue = {
        add: addMock,
        close: closeMock,
      } as unknown;

      await expect(
        pushService.sendToTokens(["d1"], { title: "T" }, { k: "v" }),
      ).resolves.toBeUndefined();
      const opts = addMock.mock.calls[0][2];
      expect((opts as { delay?: number }).delay).toBe(0);
      (pushService as unknown as { queue?: unknown }).queue = null;
    });

    it("sendToUser uses default delaySeconds when omitted and delegates to sendToTokens", async () => {
      const addMock = jest
        .fn()
        .mockImplementation(() => Promise.resolve(undefined));
      const closeMock = jest
        .fn()
        .mockImplementation(() => Promise.resolve(undefined));
      (pushService as unknown as { queue?: unknown }).queue = {
        add: addMock,
        close: closeMock,
      } as unknown;

      DeviceTokenRepoMock.findActiveTokensByUserId.mockResolvedValueOnce([
        { token: "tA" },
        { token: "tB" },
      ]);

      await expect(
        pushService.sendToUser(42, { title: "Z" }, undefined),
      ).resolves.toBeUndefined();
      expect(addMock).toHaveBeenCalled();
      const job = addMock.mock.calls[0][1];
      expect(job).toMatchObject({
        notification: { title: "Z" },
        tokens: ["tA", "tB"],
      });
      (pushService as unknown as { queue?: unknown }).queue = null;
    });

    it("propagates errors from queue.add", async () => {
      await pushService.close();
      const failingAdd = jest.fn() as jest.MockedFunction<QueueAddFn>;
      failingAdd.mockRejectedValueOnce(new Error("add fail"));
      const closeMock = jest.fn() as jest.MockedFunction<QueueCloseFn>;
      closeMock.mockResolvedValue(undefined);

      const getQueueSpy = jest
        .spyOn(
          pushService as unknown as { getQueue(): Promise<unknown> },
          "getQueue",
        )
        .mockResolvedValue({ add: failingAdd, close: closeMock } as unknown);

      await expect(
        pushService.sendToTokens(["t"], { title: "x" }, undefined, 0),
      ).rejects.toThrow("add fail");

      getQueueSpy.mockRestore();
    });
  });

  describe("default arg branches", () => {
    it("sendTemplateToUser explicit undefined delay uses default", async () => {
      const sendToUserSpy = jest
        .spyOn(
          pushService as unknown as {
            sendToUser(...args: unknown[]): Promise<void>;
          },
          "sendToUser",
        )
        .mockResolvedValue(undefined as unknown as void);
      buildNotificationPayloadMock.mockReturnValueOnce({
        data: { a: "b" },
        notification: { title: "td" },
      } as unknown);
      await expect(
        (
          pushService as unknown as {
            sendTemplateToUser(...args: unknown[]): Promise<void>;
          }
        ).sendTemplateToUser(10, "sample_template", {}, undefined),
      ).resolves.toBeUndefined();
      expect(sendToUserSpy).toHaveBeenCalledWith(
        10,
        { title: "td" },
        { a: "b" },
        0,
      );
      sendToUserSpy.mockRestore();
    });

    it("sendTemplateToUsersByType explicit undefined delay", async () => {
      const users = [{ id: 7 }];
      userFindMock.mockResolvedValueOnce(users as Array<{ id: number }>);
      const sendTemplateSpy = jest
        .spyOn(
          pushService as unknown as {
            sendTemplateToUser(...args: unknown[]): Promise<void>;
          },
          "sendTemplateToUser",
        )
        .mockResolvedValue(undefined as unknown as void);
      buildNotificationPayloadMock.mockReturnValue({
        data: { a: "b" },
        notification: { title: "t" },
      });
      await expect(
        (
          pushService as unknown as {
            sendTemplateToUsersByType(...args: unknown[]): Promise<void>;
          }
        ).sendTemplateToUsersByType(
          [UserRole.REGULAR_USER],
          "sample_template",
          {},
          undefined,
        ),
      ).resolves.toBeUndefined();
      expect(sendTemplateSpy).toHaveBeenCalledWith(
        users[0].id,
        "sample_template",
        expect.anything(),
        0,
      );
      sendTemplateSpy.mockRestore();
    });

    it("sendToTokens explicit undefined delay", async () => {
      const addMock = jest
        .fn()
        .mockImplementation(() => Promise.resolve(undefined));
      const closeMock = jest
        .fn()
        .mockImplementation(() => Promise.resolve(undefined));
      (pushService as unknown as { queue?: unknown }).queue = {
        add: addMock,
        close: closeMock,
      } as unknown;
      await expect(
        pushService.sendToTokens(["x"], { title: "t" }, { k: "v" }, undefined),
      ).resolves.toBeUndefined();
      expect(addMock).toHaveBeenCalled();
      const opts = addMock.mock.calls[0][2];
      expect((opts as { delay?: number }).delay).toBe(0);
      (pushService as unknown as { queue?: unknown }).queue = null;
    });

    it("sendToUser explicit undefined delay", async () => {
      const addMock = jest
        .fn()
        .mockImplementation(() => Promise.resolve(undefined));
      const closeMock = jest
        .fn()
        .mockImplementation(() => Promise.resolve(undefined));
      (pushService as unknown as { queue?: unknown }).queue = {
        add: addMock,
        close: closeMock,
      } as unknown;
      DeviceTokenRepoMock.findActiveTokensByUserId.mockResolvedValueOnce([
        { token: "tt" },
      ]);
      await expect(
        pushService.sendToUser(99, { title: "hi" }, undefined, undefined),
      ).resolves.toBeUndefined();
      expect(addMock).toHaveBeenCalled();
      (pushService as unknown as { queue?: unknown }).queue = null;
    });
  });

  describe("unregisterDevice", () => {
    it("returns when token not found", async () => {
      DeviceTokenRepoMock.findByToken.mockResolvedValueOnce(null);
      await expect(
        pushService.unregisterDevice({ token: "t", userId: 1 }),
      ).resolves.toBeUndefined();
      expect(DeviceTokenRepository.removeByToken).not.toHaveBeenCalled();
      expect(DeviceTokenRepository.deactivateToken).not.toHaveBeenCalled();
    });

    it("removes token when owned by user", async () => {
      const existing = { token: "t", user: { id: 2 } };
      DeviceTokenRepoMock.findByToken.mockResolvedValueOnce(
        existing as unknown,
      );
      DeviceTokenRepoMock.removeByToken.mockResolvedValueOnce(undefined);
      await expect(
        pushService.unregisterDevice({ token: "t", userId: 2 }),
      ).resolves.toBeUndefined();
      expect(DeviceTokenRepository.removeByToken).toHaveBeenCalledWith("t");
      expect(DeviceTokenRepository.deactivateToken).not.toHaveBeenCalled();
    });

    it("deactivates token when owned by another user", async () => {
      const existing = { token: "t", user: { id: 3 } };
      DeviceTokenRepoMock.findByToken.mockResolvedValueOnce(
        existing as unknown,
      );
      DeviceTokenRepoMock.deactivateToken.mockResolvedValueOnce(undefined);
      await expect(
        pushService.unregisterDevice({ token: "t", userId: 2 }),
      ).resolves.toBeUndefined();
      expect(DeviceTokenRepository.deactivateToken).toHaveBeenCalledWith("t");
      expect(DeviceTokenRepository.removeByToken).not.toHaveBeenCalled();
    });

    it("propagates repository errors", async () => {
      DeviceTokenRepoMock.findByToken.mockRejectedValueOnce(
        new Error("db fail"),
      );
      await expect(
        pushService.unregisterDevice({ token: "t", userId: 1 }),
      ).rejects.toThrow("db fail");
    });
  });
});
