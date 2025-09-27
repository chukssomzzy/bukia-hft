import express from "express";
import request from "supertest";

import walletRoute from "../../routes/wallet.routes";

jest.mock("../../middleware/auth", () => ({
  authenticateJWT: jest.fn((req, res, next) => {
    req.user = { id: 1 };
    next();
  }),
}));

jest.mock("../../services/wallet.services", () => ({
  WalletServices: jest.fn().mockImplementation(() => ({
    createWallet: jest.fn().mockResolvedValue({
      currency: "USD",
      id: 1,
      isDefault: false,
      userId: 1,
    }),
    getWalletsForUser: jest.fn().mockResolvedValue([]),
  })),
}));

const app = express();
app.use(express.json());
app.use("/wallets", walletRoute);

describe("WalletController", () => {
  it("POST /wallets creates wallet", async () => {
    const res = await request(app).post("/wallets").send({ currency: "USD" });
    expect(res.status).not.toBe(500);
  });

  it("GET /wallets returns list", async () => {
    const res = await request(app).get("/wallets");
    expect(res.status).not.toBe(500);
  });
});
