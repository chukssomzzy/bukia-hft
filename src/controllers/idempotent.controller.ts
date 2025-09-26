import { NextFunction, Request, Response } from "express";

import { idempotentServices } from "../services/idempotent.services";

/**
 * @openapi
 * /idempotent/{key}/stream:
 *   get:
 *     summary: Stream idempotent transfer status via SSE
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           $ref: '#/components/schemas/IdempotentParams'
 *     responses:
 *       200:
 *         description: SSE stream of status updates
 *         content:
 *           text/event-stream:
 *             schema:
 *               $ref: '#/components/schemas/IdempotentStatus'
 */
export class IdempotentController {
  stream = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await idempotentServices.streamStatus(req, res);
    } catch (err) {
      next(err);
    }
  };
}

export default new IdempotentController();
