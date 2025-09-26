import { Router } from "express";

import { TransferController } from "../controllers/transfer.controller";
import { authenticateJWT } from "../middleware/auth";
import { validateRequestBody } from "../middleware/request-validation";
import { TransferRequestSchema } from "../schema/transfer.schema";

const router = Router();
const controller = new TransferController();

router.post(
  "/transfer",
  authenticateJWT,
  validateRequestBody(TransferRequestSchema),
  controller.createTransfer,
);

export default router;
