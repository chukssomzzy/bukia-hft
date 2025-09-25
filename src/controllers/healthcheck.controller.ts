import { NextFunction, Request, Response } from "express";

import { HealthService } from "../services/healthcheck.services";
import { sendJsonResponse } from "../utils/send-json-response";

export class HealthCheckController {
  /**
   * @openapi
   * /api/v1/healthcheck:
   *   get:
   *     tags:
   *       - Health
   *     summary: Check health of registered services
   *     responses:
   *       200:
   *         description: Health status of services
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   service:
   *                     type: string
   *                   healthy:
   *                     type: boolean
   */
  public static async healthCheck(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const results = await HealthService.healthCheck();
      const allHealthy = results.every((svc) => svc.healthy);
      const statusCode = allHealthy ? 200 : 503;
      sendJsonResponse(res, statusCode, "Health check results", results);
    } catch (error) {
      next(error);
    }
  }
}
