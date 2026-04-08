// 🎯 ARAS Core Space-Summarizer
// Erstellt strukturierte Zusammenfassungen aus Chat-Sessions

import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../logger';
import { storage } from '../storage';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || '');

const ARAS_SPACE_SUMMARY_PROMPT = `Du bist ARAS Core – das interne LLM der ARAS AI Plattform.

**Deine Aufgabe:**
Du erhältst den Verlauf einer Chat-Session zwischen einem Nutzer und ARAS AI.
Du sollst die Konversation kurz und klar zusammenfassen.

**Antwortformat (NUR JSON, kein Markdown):**
{
  "outcome": "Kurzer Satz zum Hauptthema/Ergebnis (max 140 Zeichen)",
  "bulletPoints": ["Punkt 1", "Punkt 2", "Punkt 3"],
  "nextStep": "Konkreter empfohlener nächster Schritt",
  "sentiment": "positiv" | "neutral" | "kritisch",
  "tags": ["tag1", "tag2"]
}

**Regeln:**
- outcome: max 140 Zeichen, klarer Satz
- bulletPoints: max 5 Punkte, je max 120 Zeichen
- nextStep: 1 Satz, max 140 Zeichen
- sentiment: nur "positiv", "neutral" oder "kritisch"
- tags: max 6 Tags, je max 18 Zeichen, lowercase mit Unterstrichen
- Kein Markdown, keine Formatierung
- Keine personenbezogenen Daten erfinden
- Bei zu wenig Inhalt:
  outcome: "Zu wenig Kontext für eine belastbare Zusammenfassung."
  bulletPoints: []
  nextStep: "Bitte mehr Kontext im nächsten Austausch."
  sentiment: "neutral"
  tags: []`;

export interface SpaceSummary {
  outcome: string;
  bulletPoints: string[];
  nextStep: string;
  sentiment: 'positiv' | 'neutral' | 'kritisch';
  tags: string[];
}

export interface SpaceSummaryMetadata {
  status: 'pending' | 'ready' | 'failed';
  short?: string;
  full?: SpaceSummary;
  updatedAt?: string;
  error?: string;
}

/**
 * Summarizes a chat session using Gemini (non-blocking, fire-and-store)
 */
export async function summarizeSpaceSession(sessionId: number): Promise<void> {
  try {
    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      logger.error('[SPACE-SUMMARIZER] LLM API Key fehlt!');
      await storage.updateChatSessionMetadata(sessionId, {
        spaceSummary: {
          status: 'failed',
          error: 'LLM API Key nicht konfiguriert',
          updatedAt: new Date().toISOString()
        }
      });
      return;
    }

    // Get messages for this session
    const messages = await storage.getChatMessagesBySession(sessionId);
    
    if (!messages || messages.length < 2) {
      logger.warn('[SPACE-SUMMARIZER] Zu wenige Nachrichten', { sessionId, count: messages?.length });
      await storage.updateChatSessionMetadata(sessionId, {
        spaceSummary: {
          status: 'ready',
          short: 'Zu wenig Kontext für Zusammenfassung',
          full: {
            outcome: 'Zu wenig Kontext für eine belastbare Zusammenfassung.',
            bulletPoints: [],
            nextStep: 'Bitte mehr Kontext im nächsten Austausch.',
            sentiment: 'neutral',
            tags: []
          },
          updatedAt: new Date().toISOString()
        }
      });
      return;
    }

    logger.info('[SPACE-SUMMARIZER] Erstelle Summary...', {
      sessionId,
      messageCount: messages.length
    });

    // Build conversation string (max 30 messages, max ~15k chars)
    const MAX_MESSAGES = 30;
    const MAX_CHARS = 15000;
    
    let conversationText = '';
    const recentMessages = messages.slice(-MAX_MESSAGES);
    
    for (const msg of recentMessages) {
      const role = msg.isAi ? 'ARAS' : 'USER';
      const line = `${role}: ${msg.message}\n\n`;
      if (conversationText.length + line.length > MAX_CHARS) break;
      conversationText += line;
    }

    if (conversationText.length < 50) {
      await storage.updateChatSessionMetadata(sessionId, {
        spaceSummary: {
          status: 'ready',
          short: 'Zu wenig Kontext für Zusammenfassung',
          full: {
            outcome: 'Zu wenig Kontext für eine belastbare Zusammenfassung.',
            bulletPoints: [],
            nextStep: 'Bitte mehr Kontext im nächsten Austausch.',
            sentiment: 'neutral',
            tags: []
          },
          updatedAt: new Date().toISOString()
        }
      });
      return;
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.3,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json'
      }
    });

    const fullPrompt = `${ARAS_SPACE_SUMMARY_PROMPT}

---
CHAT-VERLAUF:
${conversationText}
---

Antworte NUR mit dem JSON-Objekt.`;

    const result = await model.generateContent(fullPrompt);
    const responseText = result.response.text();

    logger.info('[SPACE-SUMMARIZER] Antwort erhalten', {
      sessionId,
      responseLength: responseText.length
    });

    // Clean and parse JSON
    let cleanedJson = responseText.trim();
    if (cleanedJson.startsWith('```json')) {
      cleanedJson = cleanedJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedJson.startsWith('```')) {
      cleanedJson = cleanedJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    let summary: SpaceSummary;
    try {
      summary = JSON.parse(cleanedJson);
    } catch (parseError: any) {
      logger.error('[SPACE-SUMMARIZER] JSON Parse Fehler', {
        sessionId,
        error: parseError.message,
        jsonPreview: cleanedJson.substring(0, 300)
      });
      await storage.updateChatSessionMetadata(sessionId, {
        spaceSummary: {
          status: 'failed',
          error: 'JSON Parse Fehler',
          updatedAt: new Date().toISOString()
        }
      });
      return;
    }

    // Validate structure
    if (!summary.outcome || !Array.isArray(summary.bulletPoints) || !summary.nextStep || !summary.sentiment) {
      logger.error('[SPACE-SUMMARIZER] Ungültige Summary-Struktur', { sessionId });
      await storage.updateChatSessionMetadata(sessionId, {
        spaceSummary: {
          status: 'failed',
          error: 'Ungültige Summary-Struktur',
          updatedAt: new Date().toISOString()
        }
      });
      return;
    }

    // Generate short summary (max 140 chars)
    const short = summary.outcome.length > 140 
      ? summary.outcome.substring(0, 137) + '...' 
      : summary.outcome;

    await storage.updateChatSessionMetadata(sessionId, {
      spaceSummary: {
        status: 'ready',
        short,
        full: summary,
        updatedAt: new Date().toISOString()
      }
    });

    logger.info('[SPACE-SUMMARIZER] Summary erfolgreich erstellt', {
      sessionId,
      outcome: summary.outcome,
      bulletPointsCount: summary.bulletPoints.length,
      sentiment: summary.sentiment
    });

  } catch (error: any) {
    logger.error('[SPACE-SUMMARIZER] Fehler bei Summary-Erstellung', {
      sessionId,
      error: error.message,
      stack: error.stack
    });
    
    try {
      await storage.updateChatSessionMetadata(sessionId, {
        spaceSummary: {
          status: 'failed',
          error: error.message || 'Unbekannter Fehler',
          updatedAt: new Date().toISOString()
        }
      });
    } catch (updateError) {
      logger.error('[SPACE-SUMMARIZER] Konnte Fehler-Status nicht speichern', { sessionId });
    }
  }
}
