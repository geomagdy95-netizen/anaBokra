import { getOtpSender } from '../otp';
import type { ConsentMessenger, NoticeMessage } from '../otp/types';

/** The consent flows send through the SAME adapters as the OTP (console | openwa | whatsappCloud). */
export function getConsentMessenger(): ConsentMessenger {
  return getOtpSender();
}

/** Mock/test messenger: keeps the messages so a tester (or the pending screen) can open the link. */
export class OutboxMessenger implements ConsentMessenger {
  readonly name = 'outbox';
  readonly sent: NoticeMessage[] = [];
  async sendNotice(notice: NoticeMessage): Promise<void> {
    this.sent.push(notice);
    console.info(`[consent:outbox] ${notice.kind} -> ${notice.phone}\n${notice.text}`);
  }
  /** Last message of a kind, newest first. */
  last(kind?: NoticeMessage['kind']): NoticeMessage | undefined {
    return [...this.sent].reverse().find((m) => !kind || m.kind === kind);
  }
}
