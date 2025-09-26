import { SendEmailCommand, SESClient } from "@aws-sdk/client-ses";

import { EmailProvider } from ".";
import config, { AWS_CONFIG } from "../config";
import { AWSConfigSchema } from "../schema";
import log from "../utils/logger";

const SES_PERMANENT_ERRORS = [
  "AccountSendingPaused",
  "ConfigurationSetDoesNotExist",
  "EmailAddressNotVerifiedException",
  "MailFromDomainNotVerifiedException",
  "MessageRejected",
] as const;

export class AwsSesProvider implements EmailProvider {
  private client = new SESClient(AWS_CONFIG);

  constructor() {
    AWSConfigSchema.parse(AWS_CONFIG);
    this.client = new SESClient(AWS_CONFIG);
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.send(
        new SendEmailCommand({
          Destination: { ToAddresses: [config.EMAIL_FROM] },
          Message: {
            Body: { Text: { Data: "Healthcheck" } },
            Subject: { Data: "Healthcheck" },
          },
          Source: config.EMAIL_FROM,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async send(to: string, html: string, subject = "Notification") {
    const params = {
      Destination: { ToAddresses: [to] },
      Message: {
        Body: { Html: { Data: html } },
        Subject: { Data: subject },
      },
      Source: config.EMAIL_FROM,
    };
    try {
      await this.client.send(new SendEmailCommand(params));
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "name" in err &&
        SES_PERMANENT_ERRORS.includes(err.name)
      ) {
        log.error({
          code: (err as { name: string }).name,
          error: (err as { message?: string }).message,
          event: "email_permanent_failure",
          to,
        });
        return;
      }
      throw err;
    }
  }
}
