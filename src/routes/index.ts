import { Router } from "express";

import authRouter from "./auth.routes";
import healthcheckRoute from "./healthcheck.routes";
import userRoute from "./user.routes";

const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/users", userRoute);
apiRouter.use("/healthcheck", healthcheckRoute);

export default apiRouter;
