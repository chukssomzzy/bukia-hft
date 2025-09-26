export interface EmailTemplateMap {
  /* eslint-disable @typescript-eslint/naming-convention */
  "user.otp": OtpEmailData;
  "user.password-reset.success": PasswordResetSuccessData;
  "user.transfer-received": TransferReceivedEmailData;
  "user.transfer-status": TransferStatusEmailData;
  "user.welcome": WelcomeEmailData;
}

export type EmailTemplateName = keyof EmailTemplateMap;
export interface OtpEmailData {
  expiryMinutes: number;
  firstName: string;
  otp: string;
}
export interface PasswordResetSuccessData {
  firstName: string;
}
export interface TransferReceivedEmailData {
  amount: string;
  currency: string;
  firstName: string;
  fromName?: string;
  toWalletId: number;
  txId?: string;
}

export interface TransferStatusEmailData {
  amount: string;
  currency: string;
  firstName: string;
  fromWalletId: number;
  reason?: string;
  status: "completed" | "failed" | "pending";
  toWalletId: number;
  txId?: string;
}

export interface WelcomeEmailData {
  firstName: string;
}
