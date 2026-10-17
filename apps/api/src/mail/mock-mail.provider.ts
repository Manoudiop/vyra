import { Logger } from '@nestjs/common';
import { type MailMessage, type MailProvider } from './mail.provider';

/**
 * Development mail provider: keeps messages in memory (read by tests) and logs
 * them so codes can be copied from the API console. Never logs content in production.
 */
export class MockMailProvider implements MailProvider {
  private readonly logger = new Logger('MockMail');
  readonly outbox: MailMessage[] = [];

  constructor(private readonly logContent: boolean) {}

  async send(message: MailMessage): Promise<void> {
    this.outbox.push(message);
    if (this.outbox.length > 100) this.outbox.shift();
    if (this.logContent) {
      this.logger.log(`to=${message.to} subject="${message.subject}"\n${message.text}`);
    } else {
      this.logger.warn(`Mail "${message.template}" suppressed: no real mail provider configured`);
    }
  }

  lastTo(email: string): MailMessage | undefined {
    return [...this.outbox].reverse().find((message) => message.to === email);
  }
}
