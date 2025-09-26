import { z } from "zod";

export const AWSConfigSchema = z.object({
  credentials: z.object({
    accessKeyId: z.string().min(1),
    secretAccessKey: z.string().min(1),
  }),
  region: z.string().min(1),
});

export type AWSConfigType = z.infer<typeof AWSConfigSchema>;
