import { otpText } from './message';
import { OtpSendError, type NoticeMessage, type OtpMessage, type OtpSender } from './types';

/** Dev adapter: prints the code to the server log. Refuses to run in production. */
export function createConsoleSender(opts: { log?: (line: string) => void; production?: boolean } = {}): OtpSender {
  const log = opts.log ?? ((line: string) => console.info(line));
  const production = opts.production ?? process.env.NODE_ENV === 'production';
  return {
    name: 'console',
    async send({ phone, code, locale }: OtpMessage) {
      if (production) {
        throw new OtpSendError('config', 'OTP_SENDER=console is not allowed in production');
      }
      log(`[otp:console] ${phone} -> ${code}  (${otpText(code, locale)})`);
    },
    async sendNotice({ phone, kind, text }: NoticeMessage) {
      if (production) {
        throw new OtpSendError('config', 'OTP_SENDER=console is not allowed in production');
      }
      log(`[notice:console] ${kind} ${phone}  (${text})`);
    },
  };
}
