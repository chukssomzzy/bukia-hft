import { HealthService } from "../../services/healthcheck.services";

jest.mock("../../services/redis.services", () => ({
  RedisService: { healthCheck: jest.fn().mockResolvedValue(true) },
}));
jest.mock("../../services/email.services", () => ({
  emailService: { healthCheck: jest.fn().mockResolvedValue(true) },
}));
jest.mock("../../services/push.services", () => ({
  pushService: { healthCheck: jest.fn().mockResolvedValue(true) },
}));
jest.mock("../../data-source", () => ({
  default: { query: jest.fn().mockResolvedValue([1]) },
}));

describe("HealthService.healthCheck", () => {
  let redisCheck: jest.SpyInstance;
  let emailCheck: jest.SpyInstance;
  let postgresCheck: jest.SpyInstance;
  let pushCheck: jest.SpyInstance;

  beforeEach(() => {
    redisCheck = jest.spyOn(HealthService["registered"][0], "check");
    emailCheck = jest.spyOn(HealthService["registered"][1], "check");
    postgresCheck = jest.spyOn(HealthService["registered"][2], "check");
    pushCheck = jest.spyOn(HealthService["registered"][3], "check");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should call all registered service health checks", async () => {
    redisCheck.mockResolvedValue(true);
    emailCheck.mockResolvedValue(true);
    postgresCheck.mockResolvedValue(true);
    pushCheck.mockResolvedValue(true);

    await HealthService.healthCheck();

    expect(redisCheck).toHaveBeenCalled();
    expect(emailCheck).toHaveBeenCalled();
    expect(postgresCheck).toHaveBeenCalled();
    expect(pushCheck).toHaveBeenCalled();
  });

  it("should return all healthy when all services are healthy", async () => {
    redisCheck.mockResolvedValue(true);
    emailCheck.mockResolvedValue(true);
    postgresCheck.mockResolvedValue(true);
    pushCheck.mockResolvedValue(true);

    const result = await HealthService.healthCheck();
    expect(result).toEqual([
      { healthy: true, service: "redis" },
      { healthy: true, service: "email" },
      { healthy: true, service: "postgres" },
      { healthy: true, service: "push" },
    ]);
  });

  it("should return unhealthy for a failing service and introspect call order", async () => {
    redisCheck.mockResolvedValue(true);
    emailCheck.mockResolvedValue(false);
    postgresCheck.mockResolvedValue(true);
    pushCheck.mockResolvedValue(true);

    const result = await HealthService.healthCheck();
    expect(result).toEqual([
      { healthy: true, service: "redis" },
      { healthy: false, service: "email" },
      { healthy: true, service: "postgres" },
      { healthy: true, service: "push" },
    ]);
    expect(redisCheck).toHaveBeenCalled();
    expect(emailCheck).toHaveBeenCalled();
    expect(pushCheck).toHaveBeenCalled();
  });

  it("should handle exceptions and mark service as unhealthy", async () => {
    redisCheck.mockRejectedValue(new Error("Redis error"));
    emailCheck.mockResolvedValue(true);
    postgresCheck.mockResolvedValue(true);
    pushCheck.mockResolvedValue(true);

    const result = await HealthService.healthCheck();
    expect(result).toEqual([
      { healthy: false, service: "redis" },
      { healthy: true, service: "email" },
      { healthy: true, service: "postgres" },
      { healthy: true, service: "push" },
    ]);
    expect(redisCheck).toHaveBeenCalled();
    expect(emailCheck).toHaveBeenCalled();
    expect(postgresCheck).toHaveBeenCalled();
    expect(pushCheck).toHaveBeenCalled();
  });
});
