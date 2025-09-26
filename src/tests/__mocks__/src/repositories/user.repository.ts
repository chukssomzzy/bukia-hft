export const UserRepository = {
  findOne: jest.fn(),
  findWithProfile: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  findByTypes: jest.fn(),
};

export const UserProfileRepository = {
  create: jest.fn(),
  save: jest.fn(),
};
