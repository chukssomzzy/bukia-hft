import { HealthService } from "../../services/healthcheck.services";

jest.mock("../../services/redis.services", () => ({
  RedisService: { healthCheck: jest.fn().mockResolvedValue(true) },
}));
jest.mock("../../data-source", () => ({
  default: { query: jest.fn().mockResolvedValue([1]) },
}));

describe("HealthService.healthCheck", () => {
  let redisCheck: jest.SpyInstance;
  let postgresCheck: jest.SpyInstance;

  beforeEach(() => {
    // Ensure registered services are only redis and postgres for tests
    (HealthService as unknown as { registered: Array<{ check: () => Promise<boolean>; name: string }> }).registered = [
      { check: jest.fn(), name: "redis" },
      { check: jest.fn(), name: "postgres" },
    ];

    redisCheck = jest.spyOn(HealthService["registered"][0], "check");
    postgresCheck = jest.spyOn(HealthService["registered"][1], "check");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should call all registered service health checks", async () => {
    redisCheck.mockResolvedValue(true);
    postgresCheck.mockResolvedValue(true);

    await HealthService.healthCheck();

    expect(redisCheck).toHaveBeenCalled();
    expect(postgresCheck).toHaveBeenCalled();
  });

  it("should return all healthy when all services are healthy", async () => {
    redisCheck.mockResolvedValue(true);
    postgresCheck.mockResolvedValue(true);

    const result = await HealthService.healthCheck();
    expect(result).toEqual([
      { healthy: true, service: "redis" },
      { healthy: true, service: "postgres" },
    ]);
  });

  it("should return unhealthy for a failing service and introspect call order", async () => {
    redisCheck.mockResolvedValue(true);
    postgresCheck.mockResolvedValue(false);

    const result = await HealthService.healthCheck();
    expect(result).toEqual([
      { healthy: true, service: "redis" },
      { healthy: false, service: "postgres" },
    ]);
    expect(redisCheck).toHaveBeenCalled();
    expect(postgresCheck).toHaveBeenCalled();
  });

  it("should handle exceptions and mark service as unhealthy", async () => {
    redisCheck.mockRejectedValue(new Error("Redis error"));
    postgresCheck.mockResolvedValue(true);

    const result = await HealthService.healthCheck();
    expect(result).toEqual([
      { healthy: false, service: "redis" },
      { healthy: true, service: "postgres" },
    ]);
    expect(redisCheck).toHaveBeenCalled();
    expect(postgresCheck).toHaveBeenCalled();
  });
});
