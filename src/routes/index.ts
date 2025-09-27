import { Router } from "express";

import adminUserRouter from "./admin-user.routes";
import analyticsRouter from "./analytics.routes";
import authRouter from "./auth.routes";
import healthcheckRoute from "./healthcheck.routes";
import idempotentRoute from "./idempotent.routes";
import transferRoute from "./transfer.routes";
import userRoute from "./user.routes";
import walletRoute from "./wallet.routes";

const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/users", userRoute);
apiRouter.use("/wallets", walletRoute);
apiRouter.use("/transfers", transferRoute);
apiRouter.use("/idempotent", idempotentRoute);
apiRouter.use("/healthcheck", healthcheckRoute);
apiRouter.use("/analytics", analyticsRouter);
apiRouter.use("/admin", adminUserRouter);

export default apiRouter;
