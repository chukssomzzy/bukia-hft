import { Router } from "express";

import { HealthCheckController } from "../controllers/healthcheck.controller";

const healthcheckRoute = Router();

healthcheckRoute.get("/", HealthCheckController.healthCheck);

export default healthcheckRoute;
