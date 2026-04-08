/**
 * ============================================================================
 * ARAS COMMAND CENTER - AI UTILITIES
 * ============================================================================
 * Zentrale KI-Funktionen für das interne CRM
 * Verwendet OpenAI & Gemini für Insights, Zusammenfassungen, Vorschläge
 * ============================================================================
 */

import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize AI clients
const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const gemini = process.env.GOOGLE_GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY)
  : null;

/**
 * Generiere wöchentliche CRM-Zusammenfassung
 */
export async function generateWeeklySummary(stats: any): Promise<string> {
  const prompt = `Du bist ein KI-Assistent für das ARAS AI Command Center.

Analysiere folgende CRM-Daten der letzten Woche:

**Unternehmen:** ${stats.companies || 0}
**Kontakte:** ${stats.contacts || 0}
**Aktive Deals:** ${stats.activeDeals || 0}
**Fällige Tasks:** ${stats.tasksDueToday || 0}
**Calls (24h):** ${stats.recentCalls || 0}

**Pipeline:**
${Object.entries(stats.pipeline || {}).map(([stage, data]: [string, any]) => 
  `- ${stage}: ${data.count} Deals (${(data.value / 100).toFixed(2)} EUR)`
).join('\n')}

Erstelle eine prägnante, professionelle Zusammenfassung:
1. Wichtigste Erkenntnisse
2. Trends und Muster
3. Handlungsempfehlungen (3-5 konkrete nächste Schritte)

Halte es kurz (max 250 Wörter), auf Deutsch, und fokussiert auf Aktionen.`;

  try {
    // Try OpenAI first
    if (openai) {
      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: "Du bist ein CRM-Assistenzsystem von ARAS AI. Sei präzise, actionable und professionell." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 500
      });
      return response.choices[0]?.message?.content || "Keine Insights verfügbar.";
    }
    
    // Fallback to Gemini
    if (gemini) {
      const model = gemini.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContent(prompt);
      return result.response.text() || "Keine Insights verfügbar.";
    }
    
    return "KI-Service nicht verfügbar. Bitte API-Keys konfigurieren.";
  } catch (error: any) {
    console.error('[AI] Error generating summary:', error.message);
    return `Fehler beim Generieren der Zusammenfassung: ${error.message}`;
  }
}

/**
 * Kontakt-Zusammenfassung & Next Steps
 */
export async function generateContactSummary(contact: any, relatedData: any): Promise<string> {
  const prompt = `Analysiere folgenden Kontakt und gib actionable Insights:

**Kontakt:** ${contact.firstName} ${contact.lastName}
**Firma:** ${relatedData.company?.name || 'N/A'}
**Position:** ${contact.position || 'N/A'}
**Status:** ${contact.status}
**Source:** ${contact.source || 'N/A'}

**Letzte Aktivitäten:**
- Deals: ${relatedData.deals?.length || 0}
- Tasks: ${relatedData.tasks?.length || 0}
- Calls: ${relatedData.calls?.length || 0}

Gib:
1. Kurze Einschätzung (2-3 Sätze)
2. 3 konkrete nächste Schritte

Auf Deutsch, max 150 Wörter.`;

  try {
    if (openai) {
      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 300
      });
      return response.choices[0]?.message?.content || "Keine Analyse verfügbar.";
    }
    
    if (gemini) {
      const model = gemini.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContent(prompt);
      return result.response.text() || "Keine Analyse verfügbar.";
    }
    
    return "KI-Service nicht verfügbar.";
  } catch (error: any) {
    console.error('[AI] Error:', error.message);
    return `Fehler: ${error.message}`;
  }
}

/**
 * Deal Next Steps vorschlagen
 */
export async function suggestDealNextSteps(deal: any, context: any): Promise<string[]> {
  const prompt = `Analysiere folgenden Deal und schlage nächste Schritte vor:

**Deal:** ${deal.title}
**Stage:** ${deal.stage}
**Wert:** ${(deal.value / 100).toFixed(2)} ${deal.currency}
**Probability:** ${deal.probability}%

**Kontext:**
- Kontakt: ${context.contact?.firstName} ${context.contact?.lastName}
- Firma: ${context.company?.name || 'N/A'}
- Letzte Aktivität: ${context.lastActivity || 'N/A'}

Gib 3-5 konkrete, actionable nächste Schritte als nummerierte Liste.
Auf Deutsch, präzise formuliert.`;

  try {
    if (openai) {
      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 300
      });
      const text = response.choices[0]?.message?.content || "";
      return text.split('\n').filter(line => line.trim().match(/^\d+\./));
    }
    
    if (gemini) {
      const model = gemini.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContent(prompt);
      const text = result.response.text() || "";
      return text.split('\n').filter(line => line.trim().match(/^\d+\./));
    }
    
    return ["KI-Service nicht verfügbar"];
  } catch (error: any) {
    console.error('[AI] Error:', error.message);
    return [`Fehler: ${error.message}`];
  }
}
