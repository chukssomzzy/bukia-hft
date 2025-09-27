import { NextFunction, Request, Response } from "express";

import { transferService } from "../services/transfer.services";
import { sendJsonResponse } from "../utils/send-json-response";

/**
 * @openapi
 * tags:
 *   - name: Transfer
 *     description: Transfer operations
 */
export class TransferController {
  /**
   * @openapi
   * /transfer:
   *   post:
   *     tags:
   *       - Transfer
   *     summary: Create a new transfer
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/TransferRequest'
   *     responses:
   *       202:
   *         description: Transfer queued
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 jobId:
   *                   type: string
   *                   description: The job ID for the queued transfer
   */
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
