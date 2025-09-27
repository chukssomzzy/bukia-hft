const mockRedisInstance = {
  del: jest.fn().mockResolvedValue(1),
  duplicate: jest.fn().mockReturnThis(),
  eval: jest.fn().mockResolvedValue(1),
  evalsha: jest.fn().mockResolvedValue([0, 0]),
  get: jest.fn().mockResolvedValue(null),
  ping: jest.fn().mockResolvedValue("PONG"),
  quit: jest.fn().mockResolvedValue("OK"),
  script: jest.fn().mockResolvedValue("sha"),
  set: jest.fn().mockResolvedValue("OK"),
  ttl: jest.fn().mockResolvedValue(0),
};

const Redis = jest.fn(() => mockRedisInstance);

export default Redis;
export { mockRedisInstance };
