import { Resend } from 'resend';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Resend Client initialisieren
const resend = new Resend(process.env.RESEND_API_KEY);

// Gemini für personalisierte E-Mails
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

// Email-Absender - WICHTIG: plattform-aras.ai ist die einzige verifizierte Domain bei Resend!
const FROM_EMAIL = 'ARAS AI <noreply@plattform-aras.ai>';
const FRONTEND_URL = process.env.APP_URL || process.env.FRONTEND_URL || 'https://www.plattform-aras.ai';

// ============================================
// AI PROFILE INTERFACE
// ============================================
interface AIProfile {
  companyDescription?: string;
  products?: string[];
  services?: string[];
  targetAudience?: string;
  brandVoice?: string;
  competitors?: string[];
  uniqueSellingPoints?: string[];
  currentChallenges?: string[];
  opportunities?: string[];
  goals?: string[];
  industry?: string;
  [key: string]: any;
}

interface UserData {
  firstName?: string;
  lastName?: string;
  company?: string;
  industry?: string;
  role?: string;
  primaryGoal?: string;
  aiProfile?: AIProfile | null;
}

// ============================================
// AI-PERSONALISIERTE WILLKOMMENS-EMAIL
// ============================================
async function generatePersonalizedWelcomeContent(userData: UserData): Promise<{
  subject: string;
  greeting: string;
  mainContent: string;
  benefits: string[];
  callToAction: string;
} | null> {
  if (!genAI || !userData.aiProfile) {
    return null;
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `Du bist ein erstklassiger Marketing-Texter für ARAS AI, eine High-End KI-Plattform für Vertrieb und Kommunikation.

AUFGABE: Erstelle eine ULTRA-PERSONALISIERTE Willkommens-E-Mail für einen neuen Nutzer.

USER DATEN:
- Name: ${userData.firstName} ${userData.lastName || ''}
- Unternehmen: ${userData.company || 'Nicht angegeben'}
- Branche: ${userData.industry || 'Nicht angegeben'}
- Position: ${userData.role || 'Nicht angegeben'}
- Hauptziel: ${userData.primaryGoal?.replace(/_/g, ' ') || 'Geschäftswachstum'}

RECHERCHE-ERGEBNISSE ZUM UNTERNEHMEN:
${userData.aiProfile.companyDescription ? `Beschreibung: ${userData.aiProfile.companyDescription}` : ''}
${userData.aiProfile.products?.length ? `Produkte: ${userData.aiProfile.products.join(', ')}` : ''}
${userData.aiProfile.services?.length ? `Services: ${userData.aiProfile.services.join(', ')}` : ''}
${userData.aiProfile.targetAudience ? `Zielgruppe: ${userData.aiProfile.targetAudience}` : ''}
${userData.aiProfile.uniqueSellingPoints?.length ? `USPs: ${userData.aiProfile.uniqueSellingPoints.join(', ')}` : ''}
${userData.aiProfile.currentChallenges?.length ? `Aktuelle Herausforderungen: ${userData.aiProfile.currentChallenges.join(', ')}` : ''}
${userData.aiProfile.opportunities?.length ? `Chancen: ${userData.aiProfile.opportunities.join(', ')}` : ''}
${userData.aiProfile.competitors?.length ? `Wettbewerber: ${userData.aiProfile.competitors.join(', ')}` : ''}

ANFORDERUNGEN:
1. Beziehe dich KONKRET auf das Unternehmen und die Branche
2. Zeige, wie ARAS AI bei den spezifischen Herausforderungen helfen kann
3. Sei begeisternd aber professionell
4. Nutze die Recherche-Daten, um relevante Vorteile hervorzuheben
5. Sprich den User mit Vornamen an
6. Maximal 3-4 kurze Absätze für mainContent

AUSGABE FORMAT (JSON):
{
  "subject": "Persönlicher, spannender Betreff mit Bezug zum Unternehmen (max 60 Zeichen)",
  "greeting": "Personalisierte Begrüßung",
  "mainContent": "2-3 Absätze personalisierter Inhalt mit Bezug auf Branche/Unternehmen/Ziele. HTML erlaubt für <p> und <strong>.",
  "benefits": ["3-4 spezifische Vorteile für DIESEN User/Branche, kurz und knackig"],
  "callToAction": "Motivierender, personalisierter Call-to-Action"
}

NUR JSON AUSGEBEN, KEIN WEITERER TEXT!`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[Email-AI] Could not parse JSON from Gemini response');
      return null;
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    console.log('[Email-AI] ✅ Generated personalized welcome content for', userData.company);
    return parsed;
    
  } catch (error: any) {
    console.error('[Email-AI] Error generating personalized content:', error?.message);
    return null;
  }
}

// ============================================
// 1. WILLKOMMENS-EMAIL bei Registrierung
// ============================================
export async function sendWelcomeEmail(
  to: string,
  userName: string,
  userData?: UserData
) {
  try {
    // Try to generate AI-personalized content
    let personalizedContent = null;
    if (userData?.aiProfile) {
      personalizedContent = await generatePersonalizedWelcomeContent(userData);
    }

    const subject = personalizedContent?.subject || '🎉 Willkommen bei ARAS AI!';
    const greeting = personalizedContent?.greeting || `Hallo ${userName},`;
    
    const mainContent = personalizedContent?.mainContent || `
      <p>vielen Dank für deine Registrierung! Wir freuen uns, dich an Bord zu haben.</p>
      <p>ARAS AI ist deine persönliche KI-Plattform für intelligente Vertriebskommunikation. 
      Ab sofort steht dir die volle Power von künstlicher Intelligenz zur Verfügung.</p>
    `;
    
    const benefits = personalizedContent?.benefits || [
      '🤖 AI-gestützte Voice Agents für automatisierte Gespräche',
      '📅 Intelligente Terminplanung mit Kalender-Sync',
      '📞 Automatisierte Anrufe mit persönlicher Note',
      '📊 Detaillierte Analytics & Insights'
    ];
    
    const callToAction = personalizedContent?.callToAction || 
      'Starte jetzt und erlebe die Zukunft der KI-Kommunikation!';

    const benefitsHtml = benefits.map(b => `<li>${b}</li>`).join('\n');

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
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
                font-size: 28px;
                margin: 0 0 20px 0;
              }
              p {
                color: #E9D7C4;
                font-size: 16px;
                line-height: 1.7;
                margin: 0 0 16px 0;
              }
              ul {
                color: #E9D7C4;
                padding-left: 0;
                list-style: none;
              }
              li {
                padding: 8px 0;
                border-bottom: 1px solid rgba(254, 145, 0, 0.1);
              }
              li:last-child {
                border-bottom: none;
              }
              .button {
                display: inline-block;
                padding: 16px 32px;
                background: linear-gradient(135deg, #FE9100, #A34E00);
                color: #000 !important;
                text-decoration: none;
                border-radius: 12px;
                font-weight: bold;
                font-size: 16px;
                box-shadow: 0 0 20px rgba(254, 145, 0, 0.4);
                margin: 20px 0;
              }
              .cta-text {
                font-size: 18px;
                font-weight: 600;
                color: #FE9100;
                margin: 24px 0 16px 0;
              }
              .footer {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid rgba(233, 215, 196, 0.2);
                color: #A34E00;
                font-size: 14px;
              }
              .highlight {
                color: #FE9100;
                font-weight: 600;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Willkommen bei ARAS AI! 🚀</h1>
              <p>${greeting}</p>
              
              ${mainContent}
              
              <p style="margin-top: 24px;"><strong>Was dich erwartet:</strong></p>
              <ul>
                ${benefitsHtml}
              </ul>
              
              <p class="cta-text">${callToAction}</p>
              
              <a href="${FRONTEND_URL}/space" class="button">Jetzt ARAS AI starten →</a>
              
              <div class="footer">
                <p>Bei Fragen: support@plattform-aras.ai</p>
                <p>ARAS AI - Die Zukunft der KI-Kommunikation</p>
                <p style="margin-top: 10px; font-size: 12px; color: #666;">
                  Entwickelt von der Schwarzott Group
                </p>
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

    console.log('[Email] ✅ Welcome email sent:', data?.id, personalizedContent ? '(AI-personalized)' : '(standard)');
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
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Passwort zurücksetzen</title>
          </head>
          <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0a0a0a;">
              <tr>
                <td align="center" style="padding: 40px 20px;">
                  <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; background: linear-gradient(135deg, #141414 0%, #1a1a1a 100%); border-radius: 24px; border: 1px solid rgba(254, 145, 0, 0.3); box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(254, 145, 0, 0.1);">
                    
                    <!-- Header with Logo -->
                    <tr>
                      <td align="center" style="padding: 40px 40px 20px 40px;">
                        <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #FE9100, #A34E00); border-radius: 20px; display: flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 10px 30px rgba(254, 145, 0, 0.3);">
                          <span style="font-size: 40px;">🔐</span>
                        </div>
                        <h1 style="margin: 0; font-size: 32px; font-weight: 700; background: linear-gradient(135deg, #ffffff, #FE9100); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                          Passwort zurücksetzen
                        </h1>
                      </td>
                    </tr>
                    
                    <!-- Main Content -->
                    <tr>
                      <td style="padding: 0 40px 30px 40px;">
                        <p style="color: #ffffff; font-size: 18px; line-height: 1.6; margin: 0 0 10px 0;">
                          Hallo <strong style="color: #FE9100;">${userName}</strong>,
                        </p>
                        <p style="color: #d0d0d0; font-size: 16px; line-height: 1.7; margin: 0 0 30px 0;">
                          wir haben eine Anfrage erhalten, dein Passwort zurückzusetzen. Keine Sorge, das passiert den Besten! 😊
                        </p>
                        
                        <!-- CTA Button -->
                        <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 30px auto;">
                          <tr>
                            <td align="center" style="background: linear-gradient(135deg, #FE9100, #A34E00); border-radius: 14px; box-shadow: 0 8px 25px rgba(254, 145, 0, 0.4);">
                              <a href="${resetLink}" target="_blank" style="display: inline-block; padding: 18px 45px; color: #ffffff; font-size: 16px; font-weight: 700; text-decoration: none; letter-spacing: 0.5px; text-shadow: 0 1px 2px rgba(0,0,0,0.3);">
                                🔑 Neues Passwort setzen
                              </a>
                            </td>
                          </tr>
                        </table>
                        
                        <p style="color: #999; font-size: 13px; text-align: center; margin: 0 0 30px 0; word-break: break-all;">
                          Oder kopiere diesen Link:<br>
                          <a href="${resetLink}" style="color: #FE9100; text-decoration: underline;">${resetLink}</a>
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Info Box -->
                    <tr>
                      <td style="padding: 0 40px 30px 40px;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: rgba(254, 145, 0, 0.12); border-radius: 16px; border: 1px solid rgba(254, 145, 0, 0.3);">
                          <tr>
                            <td style="padding: 24px;">
                              <p style="color: #FE9100; font-size: 14px; font-weight: 600; margin: 0 0 12px 0;">
                                ℹ️ Gut zu wissen:
                              </p>
                              <table role="presentation" cellspacing="0" cellpadding="0">
                                <tr>
                                  <td style="padding: 6px 0; color: #ffffff; font-size: 14px;">
                                    <span style="color: #FE9100; margin-right: 8px;">⏱️</span> Link ist 1 Stunde gültig
                                  </td>
                                </tr>
                                <tr>
                                  <td style="padding: 6px 0; color: #ffffff; font-size: 14px;">
                                    <span style="color: #FE9100; margin-right: 8px;">🔒</span> Dein aktuelles Passwort bleibt aktiv
                                  </td>
                                </tr>
                                <tr>
                                  <td style="padding: 6px 0; color: #ffffff; font-size: 14px;">
                                    <span style="color: #FE9100; margin-right: 8px;">❓</span> Nicht angefragt? Einfach ignorieren
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                      <td style="padding: 30px 40px; border-top: 1px solid rgba(255, 255, 255, 0.15);">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                          <tr>
                            <td align="center">
                              <p style="color: #aaa; font-size: 13px; margin: 0 0 8px 0;">
                                Fragen? Schreib uns: <a href="mailto:support@plattform-aras.ai" style="color: #FE9100; text-decoration: none;">support@plattform-aras.ai</a>
                              </p>
                              <p style="color: #888; font-size: 12px; margin: 0;">
                                ARAS AI – Die Zukunft der KI-Kommunikation
                              </p>
                              <p style="color: #666; font-size: 11px; margin: 10px 0 0 0;">
                                Entwickelt von der Schwarzott Group
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    
                  </table>
                </td>
              </tr>
            </table>
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
                <li>Kontaktiere sofort unseren Support: support@plattform-aras.ai</li>
                <li>Setze dein Passwort erneut zurück</li>
              </ul>
              
              <div class="footer">
                <p>Bei Fragen: support@plattform-aras.ai</p>
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
