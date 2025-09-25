import { Router } from "express";

import { AuthController } from "../controllers/auth.controller";
import { authenticateJWT } from "../middleware/auth";
import { validateRequestBody } from "../middleware/request-validation";
import { LoginUserRequestSchema, RegisterUserRequestSchema } from "../schema";

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
  authController.loginUser,
);

authRoute.post("/logout", authenticateJWT, authController.logoutUser);

export default authRoute;
