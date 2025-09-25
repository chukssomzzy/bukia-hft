import { NextFunction, Request, Response } from "express";
import { QueryFailedError } from "typeorm";

import { BadRequest, Conflict } from "../middleware";
import {
  FacebookOAuthRequestType,
  GetOtpType,
  GoogleOAuthRequestType,
  JWTRefreshType,
  LoginUserRequestType,
  RegisterUserRequestType,
  ValidateOtpType,
} from "../schema";
import { AuthServices } from "../services/auth.services";
import log from "../utils/logger";
import { sendJsonResponse } from "../utils/send-json-response";

/**
 * @openapi
 * tags:
 *   - name: Auth
 *     description: Authentication endpoints
 */
export class AuthController {
  private authServices: AuthServices;

  constructor() {
    this.authServices = new AuthServices();
  }

  /**
   * @openapi
   * /api/v1/auth/facebook:
   *   post:
   *     tags:
   *       - Auth
   *     summary: Facebook OAuth login
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/FacebookOAuthRequest'
   *     responses:
   *       200:
   *         description: Facebook OAuth login successful
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/LoginUserResponse'
   *       401:
   *         description: Unauthorized - Invalid token or user not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       400:
   *         description: Bad Request
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  facebookOAuth = async (
    req: Request<
      Record<string, never>,
      unknown,
      FacebookOAuthRequestType,
      unknown
    >,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const data = await this.authServices.facebookOAuth(
        req.body.facebookAccessToken,
      );

      return sendJsonResponse(
        res,
        200,
        "Facebook OAuth login successful",
        data,
      );
    } catch (err) {
      next(err);
    }
  };

  /**
   * @openapi
   * /api/v1/auth/get-otp:
   *   post:
   *     tags:
   *       - Auth
   *     summary: Request an OTP to be sent to the user's email
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/GetOtpRequest'
   *     responses:
   *       200:
   *         description: OTP sent successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                 success:
   *                   type: boolean
   *       429:
   *         description: Too many requests
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       400:
   *         description: Bad Request
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  getOtp = async (
    req: Request<Record<string, never>, unknown, GetOtpType, unknown>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      await this.authServices.getOtp(req.body.email, req.body.purpose);
      return sendJsonResponse(res, 200, "An OTP has been sent to your email");
    } catch (err) {
      next(err);
    }
  };

  /**
   * @openapi
   * /api/v1/auth/google:
   *   post:
   *     tags:
   *       - Auth
   *     summary: Google OAuth login
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/GoogleOAuthRequest'
   *     responses:
   *       200:
   *         description: Google OAuth login successful
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/LoginUserResponse'
   *       401:
   *         description: Unauthorized - Invalid token or user not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       400:
   *         description: Bad Request
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  googleOAuth = async (
    req: Request<
      Record<string, never>,
      unknown,
      GoogleOAuthRequestType,
      unknown
    >,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const data = await this.authServices.googleOAuth(
        req.body.googleAccessToken,
      );

      return sendJsonResponse(res, 200, "Google OAuth login successful", data);
    } catch (err) {
      next(err);
    }
  };

  /**
   * @openapi
   * /api/v1/auth/login:
   *   post:
   *     tags:
   *       - Auth
   *     summary: Login a user
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/LoginUserRequest'
   *     responses:
   *       200:
   *         description: Login successful
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/LoginUserResponse'
   *       400:
   *         description: Bad Request
   *       401:
   *         description: Unauthorized
   */
  loginUser = async (
    req: Request<Record<string, never>, unknown, LoginUserRequestType, unknown>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const data = await this.authServices.loginUser(req.body);

      return sendJsonResponse(res, 200, "Login Successful", data);
    } catch (err) {
      next(err);
    }
  };

  /**
   * @openapi
   * /api/v1/auth/logout:
   *   post:
   *     tags:
   *       - Auth
   *     summary: Logout user and invalidate tokens
   *     responses:
   *       200:
   *         description: Logout successful
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *       401:
   *         description: Unauthorized
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  logoutUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.authServices.logout(req.user.id);
      return sendJsonResponse(res, 200, "Logout successful");
    } catch (err) {
      next(err);
    }
  };

  /**
   * @openapi
   * /api/v1/auth/refresh:
   *   post:
   *     tags:
   *       - Auth
   *     summary: Refresh access and refresh tokens
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/JWTRefreshRequest'
   *     responses:
   *       200:
   *         description: Tokens refreshed successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/LoginUserResponse'
   *       401:
   *         description: Invalid or expired refresh token
   */
  refreshToken = async (
    req: Request<Record<string, never>, unknown, JWTRefreshType, unknown>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const data = await this.authServices.refreshToken(req.body.refreshToken);
      return sendJsonResponse(
        res,
        200,
        "Access Token Refreshed Sucessfully",
        data,
      );
    } catch (err) {
      next(err);
    }
  };

  /**
   * @openapi
   * /api/v1/auth/register:
   *   post:
   *     tags:
   *       - Auth
   *     summary: Register a new user
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/RegisterUserRequest'
   *     responses:
   *       201:
   *         description: User registered
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/RegisterUserResponse'
   *       409:
   *         description: Conflict - user already exists
   *       400:
   *         description: Bad Request
   */
  registerUser = async (
    req: Request<
      Record<string, never>,
      unknown,
      RegisterUserRequestType,
      unknown
    >,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const user = await this.authServices.registerUser(req.body);
      return sendJsonResponse(res, 201, `${user.type} register successfully`);
    } catch (error: unknown) {
      log.error(error);
      if (error instanceof QueryFailedError) {
        const err = error.driverError;
        if (err.code == "23505")
          return next(new Conflict("User already exists"));
      }
      next(
        error instanceof Error ? new BadRequest("Registration failed") : error,
      );
    }
  };

  /**
   * @openapi
   * /api/v1/auth/reset-password:
   *   post:
   *     tags:
   *       - Auth
   *     summary: Reset user password after OTP verification
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/ResetPasswordRequest'
   *     responses:
   *       200:
   *         description: Password reset successful
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                 success:
   *                   type: boolean
   */
  resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.authServices.resetPassword(req.body);
      return sendJsonResponse(res, 200, "Password reset successful");
    } catch (err) {
      next(err);
    }
  };

  /**
   * @openapi
   * /api/v1/auth/validate-otp:
   *   post:
   *     tags:
   *       - Auth
   *     summary: Validate OTP for a user
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/ValidateOtp'
   *     responses:
   *       200:
   *         description: OTP validated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                 status:
   *                   type: integer
   *                 success:
   *                   type: boolean
   *       400:
   *         description: Bad Request
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  validateOtp = async (
    req: Request<Record<string, never>, unknown, ValidateOtpType, unknown>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      await this.authServices.validateOtp(req.body);
      return sendJsonResponse(
        res,
        200,
        "You have been authenticated successfully",
      );
    } catch (err) {
      next(err);
    }
  };
}
