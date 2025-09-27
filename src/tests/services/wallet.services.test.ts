import { WalletRepository } from "../../repositories/wallet.repository";
import { WalletServices } from "../../services/wallet.services";

jest.mock("../../repositories/wallet.repository", () => ({
  WalletRepository: {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    getWalletsForUser: jest.fn(),
    save: jest.fn(),
  },
}));

describe("WalletServices", () => {
  const services = new WalletServices();
  afterEach(() => jest.clearAllMocks());

  test("creates a new wallet when none exists", async () => {
    (WalletRepository.findOne as jest.Mock).mockResolvedValue(null);
    const created = { currency: "USD", id: 1, isDefault: false, userId: 1 };
    (WalletRepository.create as jest.Mock).mockReturnValue(created);
    (WalletRepository.save as jest.Mock).mockResolvedValue(created);

    const res = await services.createWallet(1, "USD");

    expect(WalletRepository.findOne).toHaveBeenCalledWith({
      where: { currency: "USD", userId: 1 },
    });
    expect(WalletRepository.create).toHaveBeenCalled();
    expect(WalletRepository.save).toHaveBeenCalledWith(created);
    expect(res).toEqual(created);
  });

  test("throws conflict when wallet already exists", async () => {
    (WalletRepository.findOne as jest.Mock).mockResolvedValue({
      currency: "NGN",
      id: 2,
    });
    await expect(services.createWallet(1, "NGN")).rejects.toThrow();
  });

  test("lists wallets for a user", async () => {
    const wallets = [{ currency: "USD", id: 1 }];
    (WalletRepository.getWalletsForUser as jest.Mock).mockResolvedValue(
      wallets,
    );
    const res = await services.getWalletsForUser(1);
    expect(res).toEqual(wallets);
  });
});
