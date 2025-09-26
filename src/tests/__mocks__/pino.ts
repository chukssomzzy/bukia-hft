const pino = () => {
  const logger = {
    child: () => logger,
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  };
  return logger;
};

export default pino;
