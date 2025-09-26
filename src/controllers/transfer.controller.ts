import { NextFunction, Request, Response } from "express";

import { transferService } from "../services/transfer.services";
import { sendJsonResponse } from "../utils/send-json-response";

export class TransferController {
  createTransfer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payload = { ...req.body, userId: req.user.id };
      const job = await transferService.enqueueTransfer(payload);

      return sendJsonResponse(res, 202, "Transfer queued", { jobId: job.id });
    } catch (err) {
      next(err);
    }
  };
}
