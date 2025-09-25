import { Router } from "express";

import { UserController } from "../controllers/user.controller";
import { authenticateJWT } from "../middleware/auth";

const userRoute = Router();
const userController = new UserController();

userRoute.use(authenticateJWT);

userRoute.get("/me", userController.getMe);

export default userRoute;
