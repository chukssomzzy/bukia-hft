export interface EmailProvider {
  healthCheck(): Promise<boolean>;
  send(to: string, html: string, subject?: string): Promise<void>;
}
