import { Injectable, Logger } from '@nestjs/common'

export interface SmsSendResult {
  providerMessageId: string
}

/**
 * SMS gateway.
 *
 * STUB. Records what would have been sent so tests can assert on delivery without an account, and
 * so nobody is tempted to console.log the code in the real path.
 *
 * The production requirements are in docs/11-security.md § 3 and docs/13-infrastructure.md:
 *  - the code travels by SMS only, never in an API response and never in a log line;
 *  - Amharic messages cost 2-3x Latin per segment, so templates must respect the length budget;
 *  - delivery receipts feed the notification audit in docs/09-notifications.md.
 */
@Injectable()
export class SmsProvider {
  private readonly logger = new Logger(SmsProvider.name)
  readonly sent: { phone: string; code: string }[] = []

  async sendOtp(phone: string, code: string): Promise<SmsSendResult> {
    this.sent.push({ phone, code })
    // Deliberately logs neither the phone nor the code.
    this.logger.log(`OTP dispatch requested for a ${phone.length}-digit number`)
    return { providerMessageId: `stub-${this.sent.length}` }
  }
}