import crypto from 'crypto';

const TEST_CODE = process.env.TWO_FACTOR_TEST_CODE || '123456';
const SUPPORTED_PROVIDERS = new Set(['console', 'twilio', 'resend', 'whatsapp']);

export function providerForMethod(method) {
  return process.env[`TWO_FACTOR_${method.toUpperCase()}_PROVIDER`] || process.env.TWO_FACTOR_PROVIDER || (process.env.NODE_ENV === 'production' ? null : 'console');
}

export function isMethodEnabled(method, destination) {
  return Boolean(destination && SUPPORTED_PROVIDERS.has(providerForMethod(method)));
}

export function generateCode() {
  if (process.env.TWO_FACTOR_TEST_MODE === 'true') {
    return TEST_CODE;
  }
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

export function hashCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

export function codesMatch(code, codeHash) {
  const actual = Buffer.from(hashCode(code), 'hex');
  const expected = Buffer.from(codeHash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export async function deliverCode({ method, destination, code }) {
  const provider = providerForMethod(method);

  if (provider === 'console') {
    console.log(`[2FA console provider] ${method} code for ${destination}: ${code}`);
    return { provider, method };
  }

  if (!provider) {
    throw new Error('No 2FA provider is configured for this environment');
  }

  const message = `Your Leoni-in verification code is ${code}. It expires in 10 minutes.`;

  if (provider === 'twilio') {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;
    if (!accountSid || !authToken || !from) throw new Error('Twilio environment variables are missing');

    const body = new URLSearchParams({ To: destination, From: from, Body: message });
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!response.ok) throw new Error(`Twilio delivery failed with status ${response.status}`);
    return { provider, method };
  }

  if (provider === 'resend') {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !from) throw new Error('Resend environment variables are missing');

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [destination], subject: 'Leoni-in verification code', text: message }),
    });
    if (!response.ok) throw new Error(`Email delivery failed with status ${response.status}`);
    return { provider, method };
  }

  if (provider === 'whatsapp') {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const templateName = process.env.WHATSAPP_TEMPLATE_NAME;
    if (!token || !phoneNumberId || !templateName) throw new Error('WhatsApp environment variables are missing');

    const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: destination, type: 'template', template: { name: templateName, language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en_US' }, components: [{ type: 'body', parameters: [{ type: 'text', text: code }] }] } }),
    });
    if (!response.ok) throw new Error(`WhatsApp delivery failed with status ${response.status}`);
    return { provider, method };
  }

  throw new Error(`2FA provider "${provider}" is not configured yet`);
}
