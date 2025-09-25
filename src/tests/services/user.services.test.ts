import { UserRepository } from "../../repositories/user.repository";
import { MeResponseSchema } from "../../schema";
import { UserServices } from "../../services/user.services";

jest.mock("../../repositories/user.repository", () => ({
  UserRepository: {
    findWithProfile: jest.fn(),
  },
}));

describe("UserServices", () => {
  const userServices = new UserServices();

  const mockUser = {
    createdAt: new Date(),
    email: "test@example.com",
    id: 1,
    isverified: false,
    phone: "+1234567890",
    profile: {
      dob: new Date("1990-01-01"),
      firstName: "John",
      id: 10,
      lastName: "Doe",
    },
    type: "user",
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return user data parsed by MeResponseSchema", async () => {
    (UserRepository.findWithProfile as jest.Mock).mockResolvedValue(mockUser);

    const result = await userServices.getUserById(1);

    expect(UserRepository.findWithProfile).toHaveBeenCalledWith({
      where: { id: 1 },
    });
    expect(result).toEqual(MeResponseSchema.parse(mockUser));
  });

  it("should throw if user is not found", async () => {
    (UserRepository.findWithProfile as jest.Mock).mockResolvedValue(null);

    await expect(userServices.getUserById(2)).rejects.toThrow();
  });
});
