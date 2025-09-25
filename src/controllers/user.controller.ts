import { NextFunction, Request, Response } from "express";

import { UserServices } from "../services/user.services";
import { sendJsonResponse } from "../utils/send-json-response";

/**
 * @openapi
 * tags:
 *   - name: User
 *     description: User endpoints
 */
export class UserController {
  private userServices: UserServices;

  constructor() {
    this.userServices = new UserServices();
  }

  /**
   * @openapi
   * /api/v1/user/me:
   *   get:
   *     tags:
   *       - User
   *     summary: Get current authenticated user details
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: User details with profile
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/MeResponse'
   *       401:
   *         description: Unauthorized
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  getMe = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.userServices.getUserById(req.user.id);
      return sendJsonResponse(res, 200, "User Profile", user);
    } catch (err) {
      next(err);
    }
  };
}
