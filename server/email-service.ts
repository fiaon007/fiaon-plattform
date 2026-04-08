import { Resend } from 'resend';

// Resend Client initialisieren
const resend = new Resend(process.env.RESEND_API_KEY);

// Email-Absender (muss deine verifizierte Domain sein)
const FROM_EMAIL = process.env.FROM_EMAIL || 'ARAS AI <noreply@arasai.com>';
const FRONTEND_URL = process.env.APP_URL || process.env.FRONTEND_URL || 'https://www.plattform-aras.ai';

// ============================================
// 1. WILLKOMMENS-EMAIL bei Registrierung
// ============================================
export async function sendWelcomeEmail(
  to: string,
  userName: string,
  verificationToken?: string
) {
  try {
    const verifyLink = verificationToken 
      ? `${FRONTEND_URL}/verify-email?token=${verificationToken}`
      : null;

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: '🎉 Willkommen bei ARAS AI!',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(to bottom, #0a0a0a, #151515);
                margin: 0;
                padding: 20px;
              }
              .container {
                max-width: 600px;
                margin: 0 auto;
                background: linear-gradient(135deg, rgba(10, 10, 10, 0.98), rgba(20, 20, 20, 0.98));
                border: 2px solid transparent;
                background-image: 
                  linear-gradient(135deg, rgba(10,10,10,0.98), rgba(20,20,20,0.98)), 
                  linear-gradient(135deg, #FE9100, #E9D7C4);
                background-origin: border-box;
                background-clip: padding-box, border-box;
                border-radius: 16px;
                padding: 40px;
                box-shadow: 0 0 40px rgba(254, 145, 0, 0.2);
              }
              h1 {
                background: linear-gradient(135deg, #E9D7C4, #FE9100, #A34E00);
                -webkit-background-clip: text;
                background-clip: text;
                -webkit-text-fill-color: transparent;
                font-size: 32px;
                margin: 0 0 20px 0;
              }
              p {
                color: #E9D7C4;
                font-size: 16px;
                line-height: 1.6;
                margin: 0 0 20px 0;
              }
              .button {
                display: inline-block;
                padding: 16px 32px;
                background: linear-gradient(135deg, #FE9100, #A34E00);
                color: #000;
                text-decoration: none;
                border-radius: 12px;
                font-weight: bold;
                font-size: 16px;
                box-shadow: 0 0 15px rgba(254, 145, 0, 0.4);
                margin: 20px 0;
              }
              .footer {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid rgba(233, 215, 196, 0.2);
                color: #A34E00;
                font-size: 14px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Willkommen bei ARAS AI!</h1>
              <p>Hallo ${userName},</p>
              <p>vielen Dank für deine Registrierung! Wir freuen uns, dich an Bord zu haben.</p>
              
              ${verifyLink ? `
                <p>Bitte bestätige deine Email-Adresse, um vollen Zugriff auf alle Features zu erhalten:</p>
                <a href="${verifyLink}" class="button">Email bestätigen</a>
                <p style="font-size: 14px; color: #888;">
                  Oder kopiere diesen Link: ${verifyLink}
                </p>
              ` : ''}
              
              <p>Mit ARAS AI erhältst du:</p>
              <ul style="color: #E9D7C4;">
                <li>🤖 AI-gestützte Voice Agents</li>
                <li>📅 Intelligente Terminplanung</li>
                <li>📞 Automatisierte Anrufe</li>
                <li>📊 Analytics & Insights</li>
              </ul>
              
              <p>Starte jetzt und erlebe die Zukunft der KI-Kommunikation!</p>
              
              <div class="footer">
                <p>Bei Fragen: support@arasai.com</p>
                <p>ARAS AI - Die Zukunft der KI-Kommunikation</p>
              </div>
            </div>
          </body>
        </html>
      `
    });

    if (error) {
      console.error('[Email] Welcome email error:', error);
      return { success: false, error };
    }

    console.log('[Email] Welcome email sent:', data);
    return { success: true, data };
  } catch (error) {
    console.error('[Email] Welcome email failed:', error);
    return { success: false, error };
  }
}

// ============================================
// 2. PASSWORT-RESET EMAIL
// ============================================
export async function sendPasswordResetEmail(
  to: string,
  userName: string,
  resetToken: string
) {
  try {
    const resetLink = `${FRONTEND_URL}/reset-password?token=${resetToken}`;

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: '🔐 Passwort zurücksetzen - ARAS AI',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(to bottom, #0a0a0a, #151515);
                margin: 0;
                padding: 20px;
              }
              .container {
                max-width: 600px;
                margin: 0 auto;
                background: linear-gradient(135deg, rgba(10, 10, 10, 0.98), rgba(20, 20, 20, 0.98));
                border: 2px solid transparent;
                background-image: 
                  linear-gradient(135deg, rgba(10,10,10,0.98), rgba(20,20,20,0.98)), 
                  linear-gradient(135deg, #FE9100, #E9D7C4);
                background-origin: border-box;
                background-clip: padding-box, border-box;
                border-radius: 16px;
                padding: 40px;
                box-shadow: 0 0 40px rgba(254, 145, 0, 0.2);
              }
              h1 {
                background: linear-gradient(135deg, #E9D7C4, #FE9100, #A34E00);
                -webkit-background-clip: text;
                background-clip: text;
                -webkit-text-fill-color: transparent;
                font-size: 32px;
                margin: 0 0 20px 0;
              }
              p {
                color: #E9D7C4;
                font-size: 16px;
                line-height: 1.6;
                margin: 0 0 20px 0;
              }
              .button {
                display: inline-block;
                padding: 16px 32px;
                background: linear-gradient(135deg, #FE9100, #A34E00);
                color: #000;
                text-decoration: none;
                border-radius: 12px;
                font-weight: bold;
                font-size: 16px;
                box-shadow: 0 0 15px rgba(254, 145, 0, 0.4);
                margin: 20px 0;
              }
              .warning {
                background: rgba(254, 145, 0, 0.1);
                border: 1px solid rgba(254, 145, 0, 0.3);
                border-radius: 8px;
                padding: 15px;
                margin: 20px 0;
                color: #FE9100;
              }
              .footer {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid rgba(233, 215, 196, 0.2);
                color: #A34E00;
                font-size: 14px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Passwort zurücksetzen</h1>
              <p>Hallo ${userName},</p>
              <p>du hast angefragt, dein Passwort zurückzusetzen.</p>
              
              <p>Klicke auf den folgenden Button, um ein neues Passwort zu setzen:</p>
              <a href="${resetLink}" class="button">Passwort zurücksetzen</a>
              
              <p style="font-size: 14px; color: #888;">
                Oder kopiere diesen Link: ${resetLink}
              </p>
              
              <div class="warning">
                ⚠️ <strong>Wichtig:</strong><br>
                • Dieser Link ist 1 Stunde gültig<br>
                • Falls du diese Anfrage nicht gestellt hast, ignoriere diese Email<br>
                • Dein aktuelles Passwort bleibt bis zum Reset aktiv
              </div>
              
              <div class="footer">
                <p>Bei Fragen: support@arasai.com</p>
                <p>ARAS AI - Die Zukunft der KI-Kommunikation</p>
              </div>
            </div>
          </body>
        </html>
      `
    });

    if (error) {
      console.error('[Email] Password reset error:', error);
      return { success: false, error };
    }

    console.log('[Email] Password reset sent:', data);
    return { success: true, data };
  } catch (error) {
    console.error('[Email] Password reset failed:', error);
    return { success: false, error };
  }
}

// ============================================
// 3. PASSWORT WURDE GEÄNDERT (Bestätigung)
// ============================================
export async function sendPasswordChangedEmail(
  to: string,
  userName: string
) {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: '✅ Passwort erfolgreich geändert - ARAS AI',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(to bottom, #0a0a0a, #151515);
                margin: 0;
                padding: 20px;
              }
              .container {
                max-width: 600px;
                margin: 0 auto;
                background: linear-gradient(135deg, rgba(10, 10, 10, 0.98), rgba(20, 20, 20, 0.98));
                border: 2px solid transparent;
                background-image: 
                  linear-gradient(135deg, rgba(10,10,10,0.98), rgba(20,20,20,0.98)), 
                  linear-gradient(135deg, #FE9100, #E9D7C4);
                background-origin: border-box;
                background-clip: padding-box, border-box;
                border-radius: 16px;
                padding: 40px;
                box-shadow: 0 0 40px rgba(254, 145, 0, 0.2);
              }
              h1 {
                background: linear-gradient(135deg, #E9D7C4, #FE9100, #A34E00);
                -webkit-background-clip: text;
                background-clip: text;
                -webkit-text-fill-color: transparent;
                font-size: 32px;
                margin: 0 0 20px 0;
              }
              p {
                color: #E9D7C4;
                font-size: 16px;
                line-height: 1.6;
                margin: 0 0 20px 0;
              }
              .success {
                background: rgba(0, 255, 0, 0.1);
                border: 1px solid rgba(0, 255, 0, 0.3);
                border-radius: 8px;
                padding: 15px;
                margin: 20px 0;
                color: #4ade80;
              }
              .footer {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid rgba(233, 215, 196, 0.2);
                color: #A34E00;
                font-size: 14px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Passwort geändert</h1>
              <p>Hallo ${userName},</p>
              
              <div class="success">
                ✅ Dein Passwort wurde erfolgreich geändert!
              </div>
              
              <p>Du kannst dich jetzt mit deinem neuen Passwort anmelden.</p>
              
              <p><strong>Falls du diese Änderung nicht durchgeführt hast:</strong></p>
              <ul style="color: #E9D7C4;">
                <li>Kontaktiere sofort unseren Support: support@arasai.com</li>
                <li>Setze dein Passwort erneut zurück</li>
              </ul>
              
              <div class="footer">
                <p>Bei Fragen: support@arasai.com</p>
                <p>ARAS AI - Die Zukunft der KI-Kommunikation</p>
              </div>
            </div>
          </body>
        </html>
      `
    });

    if (error) {
      console.error('[Email] Password changed email error:', error);
      return { success: false, error };
    }

    console.log('[Email] Password changed email sent:', data);
    return { success: true, data };
  } catch (error) {
    console.error('[Email] Password changed email failed:', error);
    return { success: false, error };
  }
}
