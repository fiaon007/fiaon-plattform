// 🎯 ARAS Core Call-Summarizer
// Erstellt strukturierte Zusammenfassungen aus Call-Transkripten

import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../logger';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || '');

const ARAS_CORE_SUMMARY_PROMPT = `Du bist ARAS Core – das interne LLM der ARAS AI Plattform.

**Deine Aufgabe:**
Du erhältst das vollständige Transkript eines geführten Telefonats.
Du sollst das Gespräch kurz und klar aus Sicht des Auftraggebers zusammenfassen.

**Kontext:**
Du bekommst:
- das Transkript (deutsch oder englisch)
- optional Firmen- und Kontaktkontext

**Ziele:**
1. Bestimme das Gesprächsergebnis (outcome) in einem kurzen Satz (max. 15 Wörter)
2. Fasse in 3–6 Bulletpoints die wichtigsten Inhalte und Entscheidungen zusammen
3. Formuliere einen konkreten, nächsten empfohlenen Schritt (nextStep) in einem Satz
4. Schätze die Stimmung des Gesprächs ein (sentiment)
5. Vergib 1–4 kurze Tags, z.B. ["interessent", "rückruf", "angebot_senden", "kein_interesse", "mailbox", "nicht_erreicht"]

**Antwortformat (JSON):**
{
  "outcome": "Kurzer Satz zum Ergebnis",
  "bulletPoints": ["Punkt 1", "Punkt 2", "Punkt 3"],
  "nextStep": "Konkreter nächster Schritt",
  "sentiment": "positive" | "neutral" | "negative" | "mixed",
  "tags": ["tag1", "tag2"]
}

**WICHTIG:**
- Sprich immer aus Sicht des Auftraggebers ("wir", "unser Unternehmen")
- Erwähne NIEMALS "Modell", "API", "LLM", "Gemini", "OpenAI" oder technische Begriffe
- Bei Mailbox/Nicht-erreicht: outcome = "Mailbox" oder "Nicht erreicht", sentiment = "neutral"
- Bulletpoints sollen kurz und prägnant sein (max. 10-12 Wörter pro Punkt)
- NextStep muss konkret und umsetzbar sein
- Tags in lowercase, Unterstriche statt Leerzeichen`;

export interface CallSummary {
  outcome: string;
  bulletPoints: string[];
  nextStep: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  tags: string[];
}

export interface SummarizeInput {
  transcript: string;
  userContext?: {
    userName?: string;
    company?: string;
    industry?: string;
  };
  contactContext?: {
    name?: string;
    company?: string;
  };
}

/**
 * Erstellt eine strukturierte Zusammenfassung aus einem Call-Transkript
 */
export async function summarizeCallWithArasCore(
  input: SummarizeInput
): Promise<CallSummary | null> {
  try {
    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      logger.error('[CALL-SUMMARIZER] ❌ LLM API Key fehlt!');
      return null;
    }

    if (!input.transcript || input.transcript.trim().length < 10) {
      logger.warn('[CALL-SUMMARIZER] ⚠️ Transkript zu kurz oder leer');
      return null;
    }

    logger.info('[CALL-SUMMARIZER] 📝 Erstelle Summary...', {
      transcriptLength: input.transcript.length,
      hasUserContext: !!input.userContext,
      hasContactContext: !!input.contactContext
    });

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.3, // Niedrig für konsistente Summaries
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json'
      }
    });

    // Baue Kontext-String
    let contextString = '';
    if (input.userContext) {
      contextString += `\n\n**FIRMENKONTEXT:**`;
      if (input.userContext.company) {
        contextString += `\n- Firma: ${input.userContext.company}`;
      }
      if (input.userContext.industry) {
        contextString += `\n- Branche: ${input.userContext.industry}`;
      }
    }

    if (input.contactContext) {
      contextString += `\n\n**GESPRÄCHSPARTNER:**`;
      if (input.contactContext.name) {
        contextString += `\n- Name: ${input.contactContext.name}`;
      }
      if (input.contactContext.company) {
        contextString += `\n- Firma: ${input.contactContext.company}`;
      }
    }

    const userPrompt = `Erstelle eine Zusammenfassung für dieses Telefonat:
${contextString}

**TRANSKRIPT:**
${input.transcript}

Antworte NUR mit dem JSON-Objekt!`;

    const fullPrompt = `${ARAS_CORE_SUMMARY_PROMPT}\n\n---\n\n${userPrompt}`;

    const result = await model.generateContent(fullPrompt);
    const responseText = result.response.text();

    logger.info('[CALL-SUMMARIZER] 📥 ARAS Core Antwort erhalten', {
      responseLength: responseText.length
    });

    // Parse JSON
    let cleanedJson = responseText.trim();
    if (cleanedJson.startsWith('```json')) {
      cleanedJson = cleanedJson.replace(/```json\n?/g, '').replace(/```\n?$/g, '').trim();
    } else if (cleanedJson.startsWith('```')) {
      cleanedJson = cleanedJson.replace(/```\n?/g, '').trim();
    }

    let summary: CallSummary;
    try {
      summary = JSON.parse(cleanedJson);
    } catch (parseError: any) {
      logger.error('[CALL-SUMMARIZER] ❌ JSON Parse Fehler', {
        error: parseError.message,
        jsonPreview: cleanedJson.substring(0, 300)
      });
      return null;
    }

    // Validiere Struktur
    if (!summary.outcome || !summary.bulletPoints || !summary.nextStep || !summary.sentiment) {
      logger.error('[CALL-SUMMARIZER] ❌ Ungültige Summary-Struktur');
      return null;
    }

    logger.info('[CALL-SUMMARIZER] ✅ Summary erfolgreich erstellt', {
      outcome: summary.outcome,
      bulletPointsCount: summary.bulletPoints.length,
      sentiment: summary.sentiment,
      tags: summary.tags
    });

    return summary;

  } catch (error: any) {
    logger.error('[CALL-SUMMARIZER] ❌ Fehler bei Summary-Erstellung', {
      error: error.message,
      stack: error.stack
    });
    return null;
  }
}
