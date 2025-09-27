export const UserRepository = {
  create: jest.fn(),
  findByTypes: jest.fn(),
  findOne: jest.fn(),
  findWithProfile: jest.fn(),
  save: jest.fn(),
};

export const UserProfileRepository = {
  create: jest.fn(),
  save: jest.fn(),
};
