import { WalletRepository } from '../../repositories/wallet.repository';
import { WalletServices } from '../../services/wallet.services';

jest.mock('../../repositories/wallet.repository', () => ({
  WalletRepository: {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  },
}));

describe('WalletServices', () => {
  const services = new WalletServices();
  afterEach(() => jest.clearAllMocks());

  it('creates a new wallet when none exists', async () => {
    (WalletRepository.findOne as jest.Mock).mockResolvedValue(null);
    const created = { id: 1, userId: 1, currency: 'USD', isDefault: false };
    (WalletRepository.create as jest.Mock).mockReturnValue(created);
    (WalletRepository.save as jest.Mock).mockResolvedValue(created);

    const res = await services.createWallet(1, 'USD');

    expect(WalletRepository.findOne).toHaveBeenCalledWith({ where: { userId: 1, currency: 'USD' } });
    expect(WalletRepository.create).toHaveBeenCalled();
    expect(WalletRepository.save).toHaveBeenCalledWith(created);
    expect(res).toEqual(created);
  });

  it('throws conflict when wallet already exists', async () => {
    (WalletRepository.findOne as jest.Mock).mockResolvedValue({ id: 2, currency: 'NGN' });
    await expect(services.createWallet(1, 'NGN')).rejects.toThrow();
  });

  it('lists wallets for a user', async () => {
    const wallets = [{ id: 1, currency: 'USD' }];
    (WalletRepository.find as jest.Mock).mockResolvedValue(wallets);
    const res = await services.getWalletsForUser(1);
    expect(res).toEqual(wallets);
  });
});
