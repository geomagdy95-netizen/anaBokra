import { describe, expect, it, vi } from 'vitest';

import { createConsoleSender } from './console';
import { createOtpSender } from './index';
import { createOpenWaSender } from './openwa';
import { OtpSendError } from './types';
import { createWhatsAppCloudSender } from './whatsapp-cloud';

const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;
const msg = { phone: '+201012345678', code: '482915', locale: 'ar' as const };

function mockFetch(response: Response | Error) {
  return vi.fn(async (...args: [string | URL | Request, RequestInit?]) => {
    void args;
    if (response instanceof Error) throw response;
    return response;
  });
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const lastCall = (f: ReturnType<typeof mockFetch>) => {
  const [url, init] = f.mock.calls.at(-1)!;
  return { url: String(url), init: init!, body: JSON.parse(String(init!.body)) };
};

describe('console adapter', () => {
  it('logs the code', async () => {
    const log = vi.fn();
    await createConsoleSender({ log, production: false }).send(msg);
    expect(log).toHaveBeenCalledOnce();
    expect(log.mock.calls[0]![0]).toContain('+201012345678');
    expect(log.mock.calls[0]![0]).toContain('482915');
  });
  it('refuses to run in production', async () => {
    const log = vi.fn();
    await expect(createConsoleSender({ log, production: true }).send(msg)).rejects.toMatchObject({ kind: 'config' });
    expect(log).not.toHaveBeenCalled();
  });
});

describe('open-wa adapter', () => {
  it('POSTs { args: { to, content } } to /sendText with the api_key header', async () => {
    const f = mockFetch(json({ success: true, response: 'true_201012345678@c.us_ABC' }));
    await createOpenWaSender({ baseUrl: 'http://openwa:8002/', apiKey: 'k3y', fetch: f }).send(msg);
    const { url, init, body } = lastCall(f);
    expect(url).toBe('http://openwa:8002/sendText');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'content-type': 'application/json', api_key: 'k3y' });
    expect(body.args.to).toBe('201012345678@c.us');
    expect(body.args.content).toContain('482915');
  });

  it('omits api_key when not configured and sends English text for en', async () => {
    const f = mockFetch(json({ success: true }));
    await createOpenWaSender({ baseUrl: 'http://openwa:8002', fetch: f }).send({ ...msg, locale: 'en' });
    const { init, body } = lastCall(f);
    expect(init.headers).not.toHaveProperty('api_key');
    expect(body.args.content).toMatch(/verification code/i);
  });

  it('maps HTTP errors, success:false and network failures to OtpSendError', async () => {
    await expect(
      createOpenWaSender({ baseUrl: 'http://x', fetch: mockFetch(json({}, 500)) }).send(msg),
    ).rejects.toMatchObject({ kind: 'upstream', status: 500 });
    await expect(
      createOpenWaSender({ baseUrl: 'http://x', fetch: mockFetch(json({ success: false, error: 'not logged in' })) }).send(msg),
    ).rejects.toMatchObject({ kind: 'upstream' });
    await expect(
      createOpenWaSender({ baseUrl: 'http://x', fetch: mockFetch(new Error('ECONNREFUSED')) }).send(msg),
    ).rejects.toMatchObject({ kind: 'network' });
  });
});

describe('WhatsApp Cloud adapter', () => {
  const cfg = { accessToken: 'EAAtoken', phoneNumberId: '1098765', templateName: 'anabokra_otp' };

  it('POSTs an authentication template to the Graph API', async () => {
    const f = mockFetch(json({ messages: [{ id: 'wamid.X' }] }));
    await createWhatsAppCloudSender({ ...cfg, fetch: f }).send(msg);
    const { url, init, body } = lastCall(f);
    expect(url).toBe('https://graph.facebook.com/v23.0/1098765/messages');
    expect(init.headers).toMatchObject({ authorization: 'Bearer EAAtoken', 'content-type': 'application/json' });
    expect(body).toEqual({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '201012345678',
      type: 'template',
      template: {
        name: 'anabokra_otp',
        language: { code: 'ar' },
        components: [
          { type: 'body', parameters: [{ type: 'text', text: '482915' }] },
          { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: '482915' }] },
        ],
      },
    });
  });

  it('uses the configured API version and the en template language', async () => {
    const f = mockFetch(json({}));
    await createWhatsAppCloudSender({ ...cfg, apiVersion: 'v25.0', fetch: f }).send({ ...msg, locale: 'en' });
    const { url, body } = lastCall(f);
    expect(url).toContain('/v25.0/');
    expect(body.template.language.code).toBe('en');
  });

  it('surfaces Meta error details as OtpSendError', async () => {
    const f = mockFetch(json({ error: { message: 'Template not found', code: 132001 } }, 404));
    const err = await createWhatsAppCloudSender({ ...cfg, fetch: f }).send(msg).catch((e) => e);
    expect(err).toBeInstanceOf(OtpSendError);
    expect(err.status).toBe(404);
    expect(err.message).toContain('Template not found');
    expect(err.message).not.toContain('482915'); // never leak the code into errors
  });
});

describe('createOtpSender (env selection)', () => {
  it('defaults to console outside production', () => {
    expect(createOtpSender(env({ NODE_ENV: 'development' })).name).toBe('console');
  });
  it('requires an explicit sender in production', () => {
    expect(() => createOtpSender(env({ NODE_ENV: 'production' }))).toThrow(/OTP_SENDER/);
  });
  it('selects openwa and whatsappCloud and validates their env', () => {
    expect(createOtpSender(env({ OTP_SENDER: 'openwa', OPENWA_URL: 'http://openwa:8002' })).name).toBe('openwa');
    expect(() => createOtpSender(env({ OTP_SENDER: 'openwa' }))).toThrow(/OPENWA_URL/);
    const cloud = env({
      OTP_SENDER: 'whatsappCloud',
      WHATSAPP_CLOUD_TOKEN: 't',
      WHATSAPP_CLOUD_PHONE_NUMBER_ID: '1',
      WHATSAPP_CLOUD_TEMPLATE_NAME: 'n',
    });
    expect(createOtpSender(cloud).name).toBe('whatsappCloud');
    expect(() => createOtpSender({ ...cloud, WHATSAPP_CLOUD_TOKEN: '' })).toThrow(/WHATSAPP_CLOUD_TOKEN/);
  });
  it('rejects unknown senders', () => {
    expect(() => createOtpSender(env({ OTP_SENDER: 'sms' }))).toThrow(/must be one of/);
  });
});

describe('transactional notices (consent flows reuse the OTP adapters)', () => {
  const notice = { phone: '+201012345678', kind: 'consent_invite' as const, locale: 'ar' as const, text: 'hello https://x/ar/consent/tok', params: ['Sara', 'https://x/ar/consent/tok'] };

  it('console prints the rendered text and refuses production', async () => {
    const log = vi.fn();
    await createConsoleSender({ log, production: false }).sendNotice(notice);
    expect(log.mock.calls[0]![0]).toContain('consent_invite');
    await expect(createConsoleSender({ log, production: true }).sendNotice(notice)).rejects.toMatchObject({ kind: 'config' });
  });

  it('open-wa sends the rendered text through the same /sendText endpoint', async () => {
    const f = mockFetch(json({ success: true }));
    await createOpenWaSender({ baseUrl: 'http://openwa:8002', fetch: f }).sendNotice(notice);
    const { url, body } = lastCall(f);
    expect(url).toBe('http://openwa:8002/sendText');
    expect(body.args).toEqual({ to: '201012345678@c.us', content: notice.text });
  });

  it('WhatsApp Cloud sends the configured utility template with ordered params', async () => {
    const f = mockFetch(json({}));
    const cfg = { accessToken: 't', phoneNumberId: '1', templateName: 'otp', noticeTemplates: { consent_invite: 'anabokra_consent_invite' } };
    await createWhatsAppCloudSender({ ...cfg, fetch: f }).sendNotice(notice);
    const { body } = lastCall(f);
    expect(body.template).toEqual({
      name: 'anabokra_consent_invite',
      language: { code: 'ar' },
      components: [{ type: 'body', parameters: [{ type: 'text', text: 'Sara' }, { type: 'text', text: 'https://x/ar/consent/tok' }] }],
    });
    await expect(createWhatsAppCloudSender({ ...cfg, fetch: f }).sendNotice({ ...notice, kind: 'child_claim' })).rejects.toMatchObject({ kind: 'config' });
  });
});
