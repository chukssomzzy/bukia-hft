const mockRedisInstance = {
  duplicate: jest.fn().mockReturnThis(),
  ping: jest.fn().mockResolvedValue("PONG"),
  quit: jest.fn().mockResolvedValue("OK"),
  eval: jest.fn().mockResolvedValue(1),
  evalsha: jest.fn().mockResolvedValue([0, 0]),
  script: jest.fn().mockResolvedValue("sha"),
  ttl: jest.fn().mockResolvedValue(0),
  del: jest.fn().mockResolvedValue(1),
  set: jest.fn().mockResolvedValue("OK"),
  get: jest.fn().mockResolvedValue(null),
};

const Redis = jest.fn(() => mockRedisInstance);

export default Redis;
export { mockRedisInstance };
