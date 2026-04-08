/**
 * ARAS AI Email Module - Public Exports
 */

export { sendEmail, maskEmail, EMAIL_ENABLED, APP_BASE_URL } from './mailer';
export type { SendEmailOptions, SendEmailResult } from './mailer';
export { getWelcomeEmailHtml, getWelcomeEmailText } from './templates/welcome';

import { sendEmail, maskEmail } from './mailer';
import { getWelcomeEmailHtml, getWelcomeEmailText } from './templates/welcome';

// ═══════════════════════════════════════════════════════════════
// HIGH-LEVEL EMAIL FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Send Welcome Email after successful signup
 * Non-blocking: catches all errors internally
 */
export async function sendWelcomeEmail(
  email: string,
  firstName?: string
): Promise<void> {
  try {
    const result = await sendEmail({
      to: email,
      subject: 'Willkommen bei ARAS AI',
      html: getWelcomeEmailHtml({ firstName }),
      text: getWelcomeEmailText({ firstName }),
      tags: [
        { name: 'category', value: 'welcome' },
        { name: 'type', value: 'transactional' },
      ],
    });

    if (result.ok) {
      console.log(`[EMAIL] Welcome email sent to ${maskEmail(email)}`);
    } else {
      console.log(`[EMAIL] Welcome email failed for ${maskEmail(email)}: ${result.error}`);
    }
  } catch (error: any) {
    // Catch-all: never let email failure crash the signup flow
    console.error(`[EMAIL] Welcome email exception for ${maskEmail(email)}: ${error?.message || 'Unknown'}`);
  }
}
