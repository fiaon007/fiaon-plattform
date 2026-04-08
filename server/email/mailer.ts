/**
 * ARAS AI Email Module
 * Transactional email foundation with Resend provider
 */

import { Resend } from 'resend';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  tags?: { name: string; value: string }[];
  replyTo?: string;
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'ARAS AI <no-reply@aras-ai.com>';
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO;
const APP_BASE_URL = process.env.APP_URL || process.env.APP_BASE_URL || 'https://www.plattform-aras.ai';

// Check if email is enabled
const EMAIL_ENABLED = !!RESEND_API_KEY;

// Log email status once on module load
if (!EMAIL_ENABLED) {
  console.log('[EMAIL] Email disabled - RESEND_API_KEY not configured');
} else {
  console.log('[EMAIL] Email enabled via Resend');
}

// Initialize Resend client (only if API key exists)
const resend = EMAIL_ENABLED ? new Resend(RESEND_API_KEY) : null;

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Mask email for safe logging (a***@domain.com)
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***';
  const [local, domain] = email.split('@');
  if (local.length <= 1) return `${local}***@${domain}`;
  return `${local[0]}***@${domain}`;
}

// ═══════════════════════════════════════════════════════════════
// MAIN SEND FUNCTION
// ═══════════════════════════════════════════════════════════════

/**
 * Send an email using the configured provider (Resend)
 * Fail-safe: never throws, returns { ok: false } on error
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  // If email is disabled, return early
  if (!EMAIL_ENABLED || !resend) {
    console.log(`[EMAIL] Skipped (disabled): ${options.subject} -> ${maskEmail(options.to)}`);
    return { ok: false, error: 'Email disabled - no API key' };
  }

  try {
    const result = await resend.emails.send({
      from: EMAIL_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      reply_to: options.replyTo || EMAIL_REPLY_TO,
      tags: options.tags,
    });

    if (result.error) {
      console.error(`[EMAIL] Failed: ${options.subject} -> ${maskEmail(options.to)} | Error: ${result.error.message}`);
      return { ok: false, error: result.error.message };
    }

    console.log(`[EMAIL] Sent: ${options.subject} -> ${maskEmail(options.to)} | ID: ${result.data?.id}`);
    return { ok: true, id: result.data?.id };
  } catch (error: any) {
    console.error(`[EMAIL] Exception: ${options.subject} -> ${maskEmail(options.to)} | ${error?.message || 'Unknown error'}`);
    return { ok: false, error: error?.message || 'Unknown error' };
  }
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

export { APP_BASE_URL, EMAIL_ENABLED };
