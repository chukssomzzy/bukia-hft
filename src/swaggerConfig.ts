import swaggerJsdoc, { SwaggerDefinition } from "swagger-jsdoc";

import { version } from "../package.json";
import config from "./config";

const swaggerDefinition: SwaggerDefinition = {
  components: {
    securitySchemes: {
      bearerAuth: {
        bearerFormat: "JWT",
        scheme: "bearer",
        type: "http",
      },
    },
  },
  externalDocs: {
    url: config.SWAGGER_JSON_URL,
  },
  info: {
    basePath: `${config.BASE_URL}/api-docs`,
    description: "BUKIA HFT backend documentation",
    title: "BUKIA HFT",
    version: version,
  },
  openapi: "3.1.0",
  security: [
    {
      bearerAuth: [],
    },
  ],
  servers: [
    {
      description: "Local server",
      url: `${config.BASE_URL}/`,
    },
  ],
};

const options = {
  apis: [
    "./src/routes/*.ts",
    "./src/controllers/*.ts",
    "./src/services/*.ts",
    "./src/schema/*.ts",
  ],
  swaggerDefinition,
};

const specs = swaggerJsdoc(options);

export default specs;
