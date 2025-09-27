describe("AdminUserServices", () => {
  describe("deactivateUser", () => {
    it.todo("throws ResourceNotFound when user does not exist");
    it.todo("sets deletedAt and increments jwtVersion and saves the user");
    it.todo("refreshes user data via findWithProfileAndWallets afterwards");
  });

  describe("getUser", () => {
    it.todo("returns parsed MeResponse when user found");
    it.todo("throws ResourceNotFound when user missing");
  });

  describe("getUserTransactions", () => {
    it.todo(
      "proxies to LedgerRepository.getEntriesForUser and returns parsed schema",
    );
  });

  describe("getUserWallets", () => {
    it.todo("returns WalletListResponseSchema parsed wallets for user");
  });

  describe("listUsers", () => {
    it.todo(
      "returns AdminUserListResponseSchema parsed result from UserRepository.listUsers",
    );
  });

  describe("lockUser / unlockUser", () => {
    it.todo("lockUser: throws ResourceNotFound when user missing");
    it.todo(
      "lockUser: sets Redis lock key with correct TTL and increments jwtVersion",
    );
    it.todo("unlockUser: deletes Redis lock key and increments jwtVersion");
  });

  describe("resetPassword", () => {
    it.todo(
      "throws ResourceNotFound when user cannot be found by setPasswordAndIncrementJwt",
    );
    it.todo(
      "hashes provided or generated password, emails user, and returns tempPassword in response",
    );
  });

  describe("updateUser", () => {
    it.todo(
      "throws ResourceNotFound when user not found in transaction manager",
    );
    it.todo("throws Conflict when new email already belongs to another user");
    it.todo(
      "updates profile fields when provided and persists them via manager repository",
    );
    it.todo("returns refreshed parsed MeResponse after save");
  });
});
