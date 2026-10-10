import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { ensureProfile } from '@/server/auth/profile';
import { createAdminClient } from '@/server/supabase-admin';

import { clientIp, getLimiters } from '../otp/limits';
import { normalizeAuthPhone } from '../otp/phone';
import type { OtpLocale } from '../otp/types';

import { isConsentMock, mockGuardianAuth } from './mock';
import type { Guardian } from './service';
import { ConsentError } from './types';

/**
 * The guardian proves they hold the INVITED number with a one-time code (Supabase phone auth, delivered over WhatsApp
 * by the existing OTP hook). The browser never chooses the number: it comes from the invite. A parent account is
 * created on first verification or reused (role must be "parent"; a student's number can never act as a guardian).
 */
export interface GuardianAuth {
  sendCode(phone: string, locale: OtpLocale, headers: Headers): Promise<void>;
  verifyCode(phone: string, code: string, tokenHash: string, locale: OtpLocale, headers: Headers): Promise<Guardian>;
  current(phone: string, tokenHash: string): Promise<Guardian | null>;
}

async function enforce(headers: Headers, kind: 'request' | 'verify', phone: string) {
  const l = getLimiters();
  const ip = await (kind === 'request' ? l.requestIp : l.verifyIp).consume(`ip:${clientIp(headers)}`);
  if (!ip.allowed) throw new ConsentError('rate_limited', undefined, { retryAfterSec: ip.retryAfterSec });
  const who = await (kind === 'request' ? l.requestPhone : l.verifyTarget).consume(`phone:${phone}`);
  if (!who.allowed) throw new ConsentError('rate_limited', undefined, { retryAfterSec: who.retryAfterSec });
}

const supabaseGuardianAuth: GuardianAuth = {
  async sendCode(phone, locale, headers) {
    await enforce(headers, 'request', phone);
    const { data: existing } = await createAdminClient().from('profiles').select('role').eq('phone', phone).limit(1).maybeSingle();
    if (existing && existing.role !== 'parent') throw new ConsentError('forbidden', 'this number belongs to a non-parent account');
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({ phone, options: { channel: 'sms', data: { role: 'parent', locale } } });
    if (error) {
      console.error(`[consent/otp] send failed: ${error.status ?? '-'} ${error.code ?? ''} ${error.message}`);
      throw new ConsentError(error.status === 429 ? 'rate_limited' : 'send_failed');
    }
  },

  async verifyCode(phone, code, _tokenHash, locale, headers) {
    void _tokenHash;
    if (!/^\d{6}$/.test(code)) throw new ConsentError('invalid_code');
    await enforce(headers, 'verify', phone);
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' });
    if (error || !data.user) throw new ConsentError('invalid_code');
    const profile = await ensureProfile(data.user, 'parent', locale);
    if (profile.role !== 'parent') {
      await supabase.auth.signOut();
      throw new ConsentError('forbidden', 'this number belongs to a non-parent account');
    }
    return { userId: data.user.id, phone };
  },

  async current(phone) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user?.phone || normalizeAuthPhone(user.phone) !== phone) return null;
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    return profile?.role === 'parent' ? { userId: user.id, phone } : null;
  },
};

export const getGuardianAuth = (): GuardianAuth =>
  isConsentMock()
    ? {
        sendCode: (phone) => mockGuardianAuth.sendCode(phone),
        verifyCode: (phone, code, hash) => mockGuardianAuth.verifyCode(phone, code, hash),
        current: (phone, hash) => mockGuardianAuth.current(phone, hash),
      }
    : supabaseGuardianAuth;
