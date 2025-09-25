import { Response } from "express";

/**
 * Sends a JSON response with a standard structure.
 *
 * @param res - The Express response object.
 * @param statusCode - The HTTP status code to send.
 * @param message - The message to include in the response.
 * @param data - The data to include in the response. Can be any type.
 */
const sendJsonResponse = <T>(
  res: Response,
  statusCode: number,
  message: string,
  data?: T,
) => {
  const responsePayload = {
    data,
    message,
    status: "success",
    statusCode,
  };

  res.status(statusCode).json(responsePayload);
};

export { sendJsonResponse };
