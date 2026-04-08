/**
 * Welcome Email Template
 * Premium ARAS AI style - dark, subtle gradients, crisp typography
 */

import { APP_BASE_URL } from '../mailer';

interface WelcomeEmailData {
  firstName?: string;
  dashboardUrl?: string;
}

/**
 * Generate Welcome Email HTML
 */
export function getWelcomeEmailHtml(data: WelcomeEmailData = {}): string {
  const firstName = data.firstName || 'dort';
  const dashboardUrl = data.dashboardUrl || `${APP_BASE_URL}/app/dashboard`;

  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Willkommen bei ARAS AI</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #0a0a0a;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 560px; margin: 0 auto; border-collapse: collapse;">
          
          <!-- Header -->
          <tr>
            <td style="text-align: center; padding-bottom: 32px;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 800; letter-spacing: 0.05em; background: linear-gradient(90deg, #ff6a00, #e9d7c4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                ARAS AI
              </h1>
            </td>
          </tr>

          <!-- Main Card -->
          <tr>
            <td style="background: linear-gradient(135deg, rgba(20,20,20,0.98) 0%, rgba(15,15,15,0.95) 100%); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 40px 32px;">
              
              <!-- Greeting -->
              <h2 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 600; color: #ffffff;">
                Hallo ${firstName},
              </h2>
              
              <!-- Welcome Message -->
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.7; color: rgba(255,255,255,0.75);">
                Willkommen bei ARAS AI. Dein Konto wurde erfolgreich erstellt und ist ab sofort einsatzbereit.
              </p>
              
              <p style="margin: 0 0 32px 0; font-size: 15px; line-height: 1.7; color: rgba(255,255,255,0.75);">
                Mit ARAS AI hast du Zugriff auf eine leistungsstarke KI-Plattform, die speziell fuer Vertrieb und Kundenkommunikation entwickelt wurde. Starte jetzt und entdecke die Moeglichkeiten.
              </p>

              <!-- CTA Button -->
              <table role="presentation" style="margin: 0 auto 32px auto;">
                <tr>
                  <td style="background: linear-gradient(135deg, #ff6a00 0%, #ff8533 100%); border-radius: 10px;">
                    <a href="${dashboardUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; letter-spacing: 0.02em;">
                      Zum Dashboard
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Features List -->
              <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 20px 24px; margin-bottom: 24px;">
                <p style="margin: 0 0 12px 0; font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.1em;">
                  Was dich erwartet
                </p>
                <ul style="margin: 0; padding: 0 0 0 18px; color: rgba(255,255,255,0.7); font-size: 14px; line-height: 1.8;">
                  <li style="margin-bottom: 6px;">KI-gestuetzte Gespraechsfuehrung</li>
                  <li style="margin-bottom: 6px;">Automatische Anruf-Zusammenfassungen</li>
                  <li style="margin-bottom: 6px;">Intelligente Wissensdatenbank</li>
                  <li style="margin-bottom: 0;">Personalisierte Business Intelligence</li>
                </ul>
              </div>

              <!-- Help Text -->
              <p style="margin: 0; font-size: 13px; color: rgba(255,255,255,0.5); line-height: 1.6;">
                Bei Fragen stehen wir dir jederzeit zur Verfuegung. Antworte einfach auf diese E-Mail oder besuche unser Help Center.
              </p>
              
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top: 32px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: rgba(255,255,255,0.35);">
                ARAS AI - Schwarzott Group
              </p>
              <p style="margin: 0; font-size: 11px; color: rgba(255,255,255,0.25);">
                Diese E-Mail wurde automatisch generiert.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();
}

/**
 * Generate Welcome Email Plain Text
 */
export function getWelcomeEmailText(data: WelcomeEmailData = {}): string {
  const firstName = data.firstName || 'dort';
  const dashboardUrl = data.dashboardUrl || `${APP_BASE_URL}/app/dashboard`;

  return `
Willkommen bei ARAS AI

Hallo ${firstName},

Willkommen bei ARAS AI. Dein Konto wurde erfolgreich erstellt und ist ab sofort einsatzbereit.

Mit ARAS AI hast du Zugriff auf eine leistungsstarke KI-Plattform, die speziell fuer Vertrieb und Kundenkommunikation entwickelt wurde.

Starte jetzt: ${dashboardUrl}

Was dich erwartet:
- KI-gestuetzte Gespraechsfuehrung
- Automatische Anruf-Zusammenfassungen
- Intelligente Wissensdatenbank
- Personalisierte Business Intelligence

Bei Fragen stehen wir dir jederzeit zur Verfuegung.

---
ARAS AI - Schwarzott Group
Diese E-Mail wurde automatisch generiert.
`.trim();
}
