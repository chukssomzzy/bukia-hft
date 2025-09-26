import { NextFunction, Request, Response } from "express";

import { CreateWalletBodyType } from "../schema/wallet.schema";
import { WalletServices } from "../services/wallet.services";
import { sendJsonResponse } from "../utils/send-json-response";

export class WalletController {
  private walletServices: WalletServices;

  constructor() {
    this.walletServices = new WalletServices();
  }

  /**
   * @openapi
   * /wallets:
   *   post:
   *     summary: Create a new wallet
   *     tags:
   *       - Wallets
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateWalletBody'
   *     responses:
   *       201:
   *         description: Wallet created
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/WalletResponse'
   */
  createWallet = async (
    req: Request<Record<string, never>, unknown, CreateWalletBodyType, unknown>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const userId = req.user.id;
      const data = await this.walletServices.createWallet(
        userId,
        req.body.currency,
      );
      return sendJsonResponse(res, 201, "Wallet created", data);
    } catch (err) {
      next(err);
    }
  };

  /**
   * @openapi
   * /wallets:
   *   get:
   *     summary: List all wallets for the authenticated user
   *     tags:
   *       - Wallets
   *     responses:
   *       200:
   *         description: List of wallets
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/WalletListResponse'
   */
  listWallets = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user.id;
      const wallets = await this.walletServices.getWalletsForUser(userId);
      return sendJsonResponse(res, 200, "Wallets", wallets);
    } catch (err) {
      next(err);
    }
  };
}
