export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  /** Machine-readable template id, useful for providers and tests. */
  template: 'password-reset';
  data?: Record<string, string>;
}

/** Outbound email abstraction. Real providers (Resend, SES...) plug in here. */
export interface MailProvider {
  send(message: MailMessage): Promise<void>;
}

export const MAIL_PROVIDER = Symbol('MAIL_PROVIDER');
