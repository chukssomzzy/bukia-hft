import { Router } from "express";

import { WalletController } from "../controllers/wallet.controller";
import { authenticateJWT } from "../middleware/auth";
import { validateRequestBody } from "../middleware/request-validation";
import { CreateWalletBodySchema } from "../schema/wallet.schema";

const walletRouter = Router();
const controller = new WalletController();

walletRouter.post(
  "/",
  authenticateJWT,
  validateRequestBody(CreateWalletBodySchema),
  controller.createWallet,
);

walletRouter.get("/", authenticateJWT, controller.listWallets);

export default walletRouter;
