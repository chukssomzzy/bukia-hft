import type { EntityManager } from "typeorm";

import { jest } from "@jest/globals";

import type { User } from "../../models";

import { UserRole } from "../../enums/user-roles";
import { BadRequest } from "../../middleware";
import { UserRepository } from "../../repositories/user.repository";

describe("UserRepository (unit)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("create", () => {
    it("creates entity using provided manager for non-super admin", async () => {
      const payload: Partial<User> = {
        email: "u@example.com",
        type: UserRole.REGULAR_USER,
      };
      const entity = { ...payload } as User;

      const findOne = jest
        .fn()
        .mockImplementation(() => Promise.resolve(null as null | User));
      const create = jest
        .fn()
        .mockImplementation((_p: Partial<User>) => entity);

      const fakeRepo = { create, findOne } as unknown;

      const manager = {
        getRepository: jest
          .fn()
          .mockReturnValue(fakeRepo as unknown as EntityManager),
      } as unknown as EntityManager;

      const res = await UserRepository.create(payload, manager);

      expect(
        (manager as unknown as { getRepository: jest.Mock }).getRepository,
      ).toHaveBeenCalled();
      expect(create).toHaveBeenCalledWith(payload);
      expect(res).toBe(entity);
    });

    it("creates super admin when none exists", async () => {
      const payload: Partial<User> = {
        email: "sa@example.com",
        type: UserRole.SUPER_ADMIN,
      };
      const entity = { ...payload } as User;

      const fakeRepo = {
        create: jest.fn().mockImplementation(() => entity),
        findOne: jest
          .fn()
          .mockImplementation(() => Promise.resolve(null as null | User)),
      } as unknown;

      const manager = {
        getRepository: jest
          .fn()
          .mockReturnValue(fakeRepo as unknown as EntityManager),
      } as unknown as EntityManager;

      const res = await UserRepository.create(payload, manager);

      expect(
        (fakeRepo as unknown as { findOne: jest.Mock }).findOne,
      ).toHaveBeenCalledWith({ where: { type: UserRole.SUPER_ADMIN } });
      expect(
        (fakeRepo as unknown as { create: jest.Mock }).create,
      ).toHaveBeenCalledWith(payload);
      expect(res).toBe(entity);
    });

    it("throws BadRequest when a super admin already exists", async () => {
      const payload: Partial<User> = {
        email: "sa@example.com",
        type: UserRole.SUPER_ADMIN,
      };
      const existing = {
        email: "exists@example.com",
        id: 1,
        type: UserRole.SUPER_ADMIN,
      } as User;

      const fakeRepo = {
        create: jest.fn(),
        findOne: jest.fn().mockImplementation(() => Promise.resolve(existing)),
      } as unknown;

      const manager = {
        getRepository: jest
          .fn()
          .mockReturnValue(fakeRepo as unknown as EntityManager),
      } as unknown as EntityManager;

      await expect(UserRepository.create(payload, manager)).rejects.toThrow(
        BadRequest,
      );
      expect(
        (fakeRepo as unknown as { findOne: jest.Mock }).findOne,
      ).toHaveBeenCalledWith({ where: { type: UserRole.SUPER_ADMIN } });
    });

    it("uses repository instance (this) when manager not provided for non-super-admin", async () => {
      const payload: Partial<User> = {
        email: "no-mgr@example.com",
        type: UserRole.REGULAR_USER,
      };
      const entity = { ...payload } as User;

      interface FakeThis {
        create: jest.Mock;
        findOne: jest.Mock;
      }
      const fakeThis: FakeThis = {
        create: jest.fn().mockReturnValue(entity),
        findOne: jest.fn(),
      };

      const createFn = UserRepository.create as unknown as (
        this: unknown,
        entityLike: Partial<User>,
        manager?: EntityManager,
      ) => Promise<User>;

      const res = await createFn.call(fakeThis, payload);

      expect(fakeThis.create).toHaveBeenCalledWith(payload);
      expect(res).toBe(entity);
    });

    it("throws when super admin exists and manager not provided", async () => {
      const payload: Partial<User> = {
        email: "sa2@example.com",
        type: UserRole.SUPER_ADMIN,
      };
      const existing = {
        email: "exist2@example.com",
        id: 9,
        type: UserRole.SUPER_ADMIN,
      } as User;

      interface FakeThis {
        create: jest.Mock;
        findOne: jest.Mock;
      }
      const fakeThis: FakeThis = {
        create: jest.fn(),
        findOne: jest.fn().mockImplementation(() => Promise.resolve(existing)),
      };

      const createFn = UserRepository.create as unknown as (
        this: unknown,
        entityLike: Partial<User>,
        manager?: EntityManager,
      ) => Promise<User>;

      await expect(createFn.call(fakeThis, payload)).rejects.toThrow(
        BadRequest,
      );
      expect(fakeThis.findOne).toHaveBeenCalledWith({
        where: { type: UserRole.SUPER_ADMIN },
      });
    });
  });

  describe("findByTypes", () => {
    it("returns empty array when types is empty or falsy", async () => {
      const res1 = await UserRepository.findByTypes([]);
      expect(res1).toEqual([]);

      const res2 = await UserRepository.findByTypes(
        undefined as unknown as UserRole[],
      );
      expect(res2).toEqual([]);
    });

    it("queries using createQueryBuilder when types provided", async () => {
      const expected: User[] = [{ id: 1 } as unknown as User];
      interface QB {
        getMany: jest.Mock;
        where: jest.Mock;
      }
      const qb: QB = {
        getMany: jest.fn().mockImplementation(() => Promise.resolve(expected)),
        where: jest.fn().mockReturnThis(),
      };

      const spy = jest
        .spyOn(UserRepository, "createQueryBuilder")
        .mockReturnValue(
          qb as unknown as ReturnType<typeof UserRepository.createQueryBuilder>,
        );

      const res = await UserRepository.findByTypes([
        UserRole.ADMIN,
        UserRole.REGULAR_USER,
      ]);

      expect(spy).toHaveBeenCalledWith("user");
      expect(qb.where).toHaveBeenCalledWith("user.type IN (:...types)", {
        types: [UserRole.ADMIN, UserRole.REGULAR_USER],
      });
      expect(qb.getMany).toHaveBeenCalled();
      expect(res).toBe(expected as unknown as User[]);

      spy.mockRestore();
    });

    it("propagates errors from query builder getMany", async () => {
      interface QB {
        getMany: jest.Mock;
        where: jest.Mock;
      }
      const qb: QB = {
        getMany: jest
          .fn()
          .mockImplementationOnce(() => Promise.reject(new Error("qb fail"))),
        where: jest.fn().mockReturnThis(),
      };

      jest
        .spyOn(UserRepository, "createQueryBuilder")
        .mockReturnValue(
          qb as unknown as ReturnType<typeof UserRepository.createQueryBuilder>,
        );

      await expect(
        UserRepository.findByTypes([UserRole.ADMIN]),
      ).rejects.toThrow("qb fail");
    });
  });

  describe("findWithProfile", () => {
    it("calls findOne with relations profile merged", async () => {
      const options = { where: { id: 2 } };
      const user = { id: 2, profile: { id: 3 } } as unknown as User;

      const findOneSpy = jest
        .spyOn(UserRepository, "findOne")
        .mockResolvedValue(user as unknown as User);

      const res = await UserRepository.findWithProfile(options);

      expect(findOneSpy).toHaveBeenCalledWith({
        ...options,
        relations: ["profile"],
      });
      expect(res).toBe(user as unknown as User);

      findOneSpy.mockRestore();
    });

    it("propagates errors from findOne", async () => {
      const options = { where: { id: 5 } };
      const findOneSpy = jest
        .spyOn(UserRepository, "findOne")
        .mockRejectedValueOnce(new Error("find fail"));

      await expect(UserRepository.findWithProfile(options)).rejects.toThrow(
        "find fail",
      );

      findOneSpy.mockRestore();
    });
  });
});
