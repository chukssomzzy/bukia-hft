import cors from "cors";
import dotenv from "dotenv";
import express, { Express, Request, Response } from "express";
import "reflect-metadata";
import swaggerUi from "swagger-ui-express";

import config from "./config";
import AppDataSource from "./data-source";
import { errorHandler, routeNotFound } from "./middleware";
import apiRouter from "./routes";
import swaggerSpec from "./swaggerConfig";
import { Limiter } from "./utils";
import log from "./utils/logger";
dotenv.config();

const port = config.PORT;
const server: Express = express();
server.options("*", cors());
server.use(
  cors({
    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Authorization",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    origin: "*",
  }),
);

server.use(Limiter);
server.use(express.json({ limit: "10mb" }));
server.use(express.urlencoded({ extended: true, limit: "10mb" }));

server.get("/api/v1/probe", (req: Request, res: Response) => {
  res.send("I am the express api responding for bukia hft");
});
server.use("/api/v1", apiRouter);
server.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
server.use("/openapi.json", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

server.use(routeNotFound);
server.use(errorHandler);

AppDataSource.initialize()
  .then(async () => {
    server.listen(port, async () => {
      log.info(`Server is listening on port ${port}`);

      if (
        config.NODE_ENV === "production" ||
        process.env.ENABLE_WORKERS === "true"
      ) {
        await import("./workers");
        log.info("Workers started alongside web server");
      }
    });
  })
  .catch((error) => log.error(error));

export default server;
