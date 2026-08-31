import crypto from 'crypto';
import nodemailer from 'nodemailer';

const TEST_CODE = process.env.TWO_FACTOR_TEST_CODE || '123456';
const SUPPORTED_PROVIDERS = new Set(['console', 'twilio', 'gmail']);

export function providerForMethod(method) {
  return process.env[`TWO_FACTOR_${method.toUpperCase()}_PROVIDER`] || process.env.TWO_FACTOR_PROVIDER || (process.env.NODE_ENV === 'production' ? null : 'console');
}

export function isMethodEnabled(method, destination) {
  return Boolean(destination && SUPPORTED_PROVIDERS.has(providerForMethod(method)));
}

export function isTwoFactorGloballyEnabled() {
  return process.env.TWO_FACTOR_ENABLED === 'true';
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

  if (provider === 'gmail') {
    const user = process.env.GMAIL_USER;
    const password = process.env.GMAIL_APP_PASSWORD;
    if (!user || !password) throw new Error('Gmail environment variables are missing');

    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass: password } });
    await transporter.sendMail({ from: user, to: destination, subject: 'Leoni-in verification code', text: message });
    return { provider, method };
  }

  throw new Error(`2FA provider "${provider}" is not configured yet`);
}
