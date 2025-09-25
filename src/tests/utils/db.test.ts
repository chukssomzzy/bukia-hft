import { EntityManager } from "typeorm";

import AppDataSource from "../../data-source";
import { Transactional } from "../../utils/db";

jest.mock("../../data-source");

describe("Transactional decorator", () => {
  let mockTransaction: jest.Mock;
  let mockManager: EntityManager;

  beforeEach(() => {
    mockManager = {} as EntityManager;
    mockTransaction = jest
      .fn()
      .mockImplementation(
        async (fn: (manager: EntityManager) => Promise<unknown>) => {
          return await fn(mockManager);
        },
      );
    (AppDataSource.manager as unknown) = { transaction: mockTransaction };
    jest.clearAllMocks();
  });

  it("should wrap method in a transaction and pass manager", async () => {
    class TestService {
      @Transactional()
      async doSomething(arg: string, manager?: EntityManager): Promise<string> {
        expect(manager).toBe(mockManager);
        return `done:${arg}`;
      }
    }
    const service = new TestService();
    const result = await service.doSomething("test");
    expect(result).toBe("done:test");
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it("should propagate errors from the wrapped method", async () => {
    class TestService {
      @Transactional()
      async failMethod(): Promise<void> {
        throw new Error("fail");
      }
    }
    const service = new TestService();
    await expect(service.failMethod()).rejects.toThrow("fail");
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it("should pass all arguments to the original method", async () => {
    class TestService {
      @Transactional()
      async multiArgs(
        a: number,
        b: string,
        manager?: EntityManager,
      ): Promise<string> {
        expect(manager).toBe(mockManager);
        return `${a}-${b}`;
      }
    }
    const service = new TestService();
    const result = await service.multiArgs(42, "hello");
    expect(result).toBe("42-hello");
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });
});
