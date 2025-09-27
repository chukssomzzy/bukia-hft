import { Router } from "express";

import { AuthController } from "../controllers/auth.controller";
import { auditMiddleware } from "../middleware/audit-log";
import { authenticateJWT } from "../middleware/auth";
import { validateRequestBody } from "../middleware/request-validation";
import {
  GetOtpSchema,
  JWTRefreshRequestSchema,
  LoginUserRequestSchema,
  RegisterUserRequestSchema,
  ResetPasswordRequestSchema,
  ValidateOtpSchema,
} from "../schema";

const authRoute = Router();
const authController = new AuthController();

authRoute.post(
  "/register",
  validateRequestBody(RegisterUserRequestSchema),
  authController.registerUser,
);

authRoute.post(
  "/login",
  validateRequestBody(LoginUserRequestSchema),
  auditMiddleware("Logged In"),
  authController.loginUser,
);

authRoute.post(
  "/refresh",
  validateRequestBody(JWTRefreshRequestSchema),
  authController.refreshToken,
);

authRoute.post(
  "/refresh",
  validateRequestBody(JWTRefreshRequestSchema),
  authController.refreshToken,
);

authRoute.post(
  "/get-otp",
  validateRequestBody(GetOtpSchema),
  authController.getOtp,
);

authRoute.post(
  "/validate-otp",
  validateRequestBody(ValidateOtpSchema),
  authController.validateOtp,
);

authRoute.post(
  "/reset-password",
  validateRequestBody(ResetPasswordRequestSchema),
  authController.resetPassword,
);

authRoute.post("/logout", authenticateJWT, authController.logoutUser);

export default authRoute;
