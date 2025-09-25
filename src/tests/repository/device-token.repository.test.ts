import { jest } from "@jest/globals";
import { LessThan } from "typeorm";

import type { DeviceToken } from "../../models/device-token";

import { DeviceTokenRepository } from "../../repositories/device-token.repository";

describe("DeviceTokenRepository (unit)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("createAndSave", () => {
    it("creates entity and saves it", async () => {
      const payload: Partial<DeviceToken> = { token: "tok" };
      const entity = { ...payload } as DeviceToken;
      const saved = { id: 1, ...payload } as DeviceToken;

      const createSpy = jest.spyOn(DeviceTokenRepository, "create");
      createSpy.mockReturnValue(entity as DeviceToken);

      const saveSpy = jest.spyOn(DeviceTokenRepository, "save");
      (saveSpy as ReturnType<typeof jest.spyOn>).mockResolvedValue(
        saved as unknown as Promise<DeviceToken>,
      );

      const res = await DeviceTokenRepository.createAndSave(payload);

      expect(createSpy).toHaveBeenCalledWith(payload);
      expect(saveSpy).toHaveBeenCalledWith(entity);
      expect(res).toBe(saved);
    });

    it("propagates errors from save", async () => {
      const payload: Partial<DeviceToken> = { token: "tok" };
      const entity = { ...payload } as DeviceToken;

      const createSpy = jest.spyOn(DeviceTokenRepository, "create");
      createSpy.mockReturnValue(entity as DeviceToken);
      const saveSpy = jest.spyOn(DeviceTokenRepository, "save");
      (saveSpy as ReturnType<typeof jest.spyOn>).mockRejectedValueOnce(
        new Error("save fail"),
      );

      await expect(
        DeviceTokenRepository.createAndSave(payload),
      ).rejects.toThrow("save fail");

      createSpy.mockRestore();
      saveSpy.mockRestore();
    });
  });

  describe("deactivateToken", () => {
    it("updates token isActive to false", async () => {
      const updateSpy = jest.spyOn(DeviceTokenRepository, "update");
      (updateSpy as ReturnType<typeof jest.spyOn>).mockResolvedValue(undefined);

      await DeviceTokenRepository.deactivateToken("tkn");

      expect(updateSpy).toHaveBeenCalledWith(
        { token: "tkn" },
        { isActive: false },
      );

      updateSpy.mockRestore();
    });

    it("propagates errors from update", async () => {
      const updateSpy = jest.spyOn(DeviceTokenRepository, "update");
      (updateSpy as ReturnType<typeof jest.spyOn>).mockRejectedValueOnce(
        new Error("update fail"),
      );

      await expect(DeviceTokenRepository.deactivateToken("t")).rejects.toThrow(
        "update fail",
      );

      updateSpy.mockRestore();
    });
  });

  describe("findActiveTokensByUserId", () => {
    it("returns active tokens for user", async () => {
      const expected: Array<{ token: string }> = [
        { token: "a" },
        { token: "b" },
      ];
      const findSpy = jest.spyOn(DeviceTokenRepository, "find");
      (findSpy as ReturnType<typeof jest.spyOn>).mockResolvedValue(
        expected as unknown as Promise<Array<{ token: string }>>,
      );

      const res = await DeviceTokenRepository.findActiveTokensByUserId(5);

      expect(findSpy).toHaveBeenCalledWith({
        where: { isActive: true, user: { id: 5 } },
      });
      expect(res).toBe(expected as unknown as DeviceToken[]);

      findSpy.mockRestore();
    });

    it("propagates errors from find", async () => {
      const findSpy = jest.spyOn(DeviceTokenRepository, "find");
      (findSpy as ReturnType<typeof jest.spyOn>).mockRejectedValueOnce(
        new Error("find fail"),
      );

      await expect(
        DeviceTokenRepository.findActiveTokensByUserId(1),
      ).rejects.toThrow("find fail");

      findSpy.mockRestore();
    });
  });

  describe("findByToken", () => {
    it("returns token entity when found", async () => {
      const found = { id: 2, token: "t" } as DeviceToken;
      const findOneSpy = jest.spyOn(DeviceTokenRepository, "findOne");
      (findOneSpy as ReturnType<typeof jest.spyOn>).mockResolvedValue(
        found as unknown as DeviceToken,
      );

      const res = await DeviceTokenRepository.findByToken("t");

      expect(findOneSpy).toHaveBeenCalledWith({ where: { token: "t" } });
      expect(res).toBe(found);

      findOneSpy.mockRestore();
    });

    it("returns null when not found", async () => {
      const findOneSpy = jest.spyOn(DeviceTokenRepository, "findOne");
      (findOneSpy as ReturnType<typeof jest.spyOn>).mockResolvedValue(
        null as unknown as DeviceToken | null,
      );

      const res = await DeviceTokenRepository.findByToken("nope");

      expect(res).toBeNull();

      findOneSpy.mockRestore();
    });

    it("propagates errors from findOne", async () => {
      const findOneSpy = jest.spyOn(DeviceTokenRepository, "findOne");
      (findOneSpy as ReturnType<typeof jest.spyOn>).mockRejectedValueOnce(
        new Error("findOne fail"),
      );

      await expect(DeviceTokenRepository.findByToken("t")).rejects.toThrow(
        "findOne fail",
      );

      findOneSpy.mockRestore();
    });
  });

  describe("removeByToken", () => {
    it("deletes by token", async () => {
      const deleteSpy = jest.spyOn(DeviceTokenRepository, "delete");
      (deleteSpy as ReturnType<typeof jest.spyOn>).mockResolvedValue(undefined);

      await DeviceTokenRepository.removeByToken("xyz");

      expect(deleteSpy).toHaveBeenCalledWith({ token: "xyz" });

      deleteSpy.mockRestore();
    });

    it("propagates errors from delete", async () => {
      const deleteSpy = jest.spyOn(DeviceTokenRepository, "delete");
      (deleteSpy as ReturnType<typeof jest.spyOn>).mockRejectedValueOnce(
        new Error("del fail"),
      );

      await expect(DeviceTokenRepository.removeByToken("x")).rejects.toThrow(
        "del fail",
      );

      deleteSpy.mockRestore();
    });
  });

  describe("removeOlderThan", () => {
    it("deletes tokens older than given date using LessThan", async () => {
      const date = new Date("2020-01-01T00:00:00.000Z");
      const deleteSpy = jest.spyOn(DeviceTokenRepository, "delete");
      (deleteSpy as ReturnType<typeof jest.spyOn>).mockResolvedValue(undefined);

      await DeviceTokenRepository.removeOlderThan(date);

      expect(deleteSpy).toHaveBeenCalledWith({ lastUsed: LessThan(date) });

      deleteSpy.mockRestore();
    });

    it("propagates errors from delete", async () => {
      const date = new Date("2020-01-01T00:00:00.000Z");
      const deleteSpy = jest.spyOn(DeviceTokenRepository, "delete");
      (deleteSpy as ReturnType<typeof jest.spyOn>).mockRejectedValueOnce(
        new Error("del fail"),
      );

      await expect(DeviceTokenRepository.removeOlderThan(date)).rejects.toThrow(
        "del fail",
      );

      deleteSpy.mockRestore();
    });
  });

  describe("updateLastUsed", () => {
    it("updates lastUsed to a Date", async () => {
      const updateSpy = jest.spyOn(DeviceTokenRepository, "update");
      (updateSpy as ReturnType<typeof jest.spyOn>).mockResolvedValue(undefined);

      await DeviceTokenRepository.updateLastUsed("tk1");

      expect(updateSpy).toHaveBeenCalled();
      const callArgs = updateSpy.mock.calls[0] as unknown as [
        Partial<DeviceToken>,
        { lastUsed: Date },
      ];
      expect(callArgs[0]).toEqual({ token: "tk1" });
      expect(callArgs[1]).toHaveProperty("lastUsed");
      expect(callArgs[1].lastUsed).toBeInstanceOf(Date);

      updateSpy.mockRestore();
    });

    it("propagates errors from update", async () => {
      const updateSpy = jest.spyOn(DeviceTokenRepository, "update");
      (updateSpy as ReturnType<typeof jest.spyOn>).mockRejectedValueOnce(
        new Error("update fail"),
      );

      await expect(DeviceTokenRepository.updateLastUsed("t")).rejects.toThrow(
        "update fail",
      );

      updateSpy.mockRestore();
    });
  });
});
