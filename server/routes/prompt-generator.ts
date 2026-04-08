/**
 * ============================================================================
 * ARAS PROMPT GENERATOR - Gemini-powered Conversational Prompt Builder
 * ============================================================================
 * Interaktiver Chat zur Erstellung perfekter Anweisungen für POWER Calls
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../logger';

const router = Router();

// Initialize Gemini
const gemini = process.env.GOOGLE_GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY)
  : null;

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  step: number;
  initialContext?: string;
}

// Questions flow for building a perfect prompt
const QUESTION_FLOW = [
  {
    step: 1,
    question: 'Was ist das Ziel des Anrufs?',
    examples: ['Termin vereinbaren', 'Information einholen', 'Angebot nachfassen', 'Problem klären']
  },
  {
    step: 2,
    question: 'Wer wird angerufen? (Beschreibe die Person/Firma kurz)',
    examples: ['Geschäftsführer einer IT-Firma', 'Sachbearbeiter bei der Versicherung', 'Restaurantbesitzer']
  },
  {
    step: 3,
    question: 'Gibt es wichtige Details oder Kontext, den ARAS wissen sollte?',
    examples: ['Wir hatten letzte Woche ein Meeting', 'Es geht um Projekt XY', 'Der Kunde ist sehr beschäftigt']
  },
  {
    step: 4,
    question: 'Wie soll ARAS auftreten? (Tonalität)',
    examples: ['Professionell und förmlich', 'Freundlich und locker', 'Direkt und effizient']
  },
  {
    step: 5,
    question: 'Was ist das gewünschte Ergebnis?',
    examples: ['Fester Termin', 'Verbindliche Zusage', 'Mehr Informationen', 'Weiterleitung zum Entscheider']
  }
];

router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { messages, step, initialContext } = req.body as ChatRequest;
    
    if (!gemini) {
      return res.status(503).json({ 
        error: 'KI-Service nicht verfügbar',
        message: 'Bitte versuche es später erneut.'
      });
    }

    const model = gemini.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // Build conversation context
    const conversationHistory = messages.map(m => 
      `${m.role === 'user' ? 'Nutzer' : 'ARAS'}: ${m.content}`
    ).join('\n\n');

    // Get current step info
    const currentStep = QUESTION_FLOW.find(q => q.step === step) || QUESTION_FLOW[0];
    const nextStep = QUESTION_FLOW.find(q => q.step === step + 1);

    // Determine if we have enough info to generate a prompt (after step 3 or if user gives comprehensive answer)
    const shouldGeneratePrompt = step >= 4 || (step >= 3 && messages.length >= 6);

    let systemPrompt: string;

    if (shouldGeneratePrompt) {
      // Final step: Generate the prompt
      systemPrompt = `Du bist ein ARAS Prompt-Experte. Analysiere die bisherige Konversation und erstelle eine PERFEKTE, klare Anweisung für einen KI-Telefonanruf.

BISHERIGE KONVERSATION:
${conversationHistory}

DEINE AUFGABE:
1. Fasse die gesammelten Informationen zusammen
2. Erstelle eine klare, präzise Anweisung für ARAS (den KI-Anrufer)
3. Die Anweisung sollte enthalten: Ziel, Kontext, gewünschte Tonalität, erwartetes Ergebnis

WICHTIG:
- Schreibe die Anweisung in der 2. Person ("Du rufst an bei...", "Dein Ziel ist...")
- Halte es prägnant aber vollständig (max 150 Wörter)
- Formatiere KEINE Markdown-Syntax in der Anweisung selbst

Antworte im folgenden JSON-Format:
{
  "message": "Deine Zusammenfassung und Bestätigung (kurz, freundlich)",
  "generatedPrompt": "Die fertige Anweisung für ARAS",
  "isComplete": true
}`;
    } else {
      // Continue conversation
      systemPrompt = `Du bist ein freundlicher ARAS Prompt-Assistent. Du hilfst dem Nutzer, eine perfekte Anweisung für einen KI-Telefonanruf zu erstellen.

BISHERIGE KONVERSATION:
${conversationHistory}

AKTUELLE FRAGE (Schritt ${step} von 5):
${currentStep.question}
Beispiele: ${currentStep.examples.join(', ')}

${nextStep ? `NÄCHSTE FRAGE wird sein: ${nextStep.question}` : ''}

DEINE AUFGABE:
1. Reagiere kurz und freundlich auf die letzte Nutzer-Antwort
2. Stelle die nächste relevante Frage (oder eine Vertiefungsfrage wenn nötig)
3. Halte deine Antwort kurz (max 2-3 Sätze + Frage)

WICHTIG:
- Sei warmherzig aber professionell
- Verwende **fett** für wichtige Begriffe
- Verwende _kursiv_ für Beispiele oder Hinweise
- Stelle immer eine klare Frage am Ende

Antworte im folgenden JSON-Format:
{
  "message": "Deine Antwort mit der nächsten Frage",
  "nextStep": ${step + 1},
  "isComplete": false
}`;
    }

    const result = await model.generateContent(systemPrompt);
    const responseText = result.response.text();

    // Parse JSON response
    let parsedResponse: any;
    try {
      // Extract JSON from response (handle potential markdown code blocks)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      logger.warn('[PromptGenerator] Failed to parse JSON, using raw response');
      parsedResponse = {
        message: responseText,
        nextStep: step + 1,
        isComplete: false
      };
    }

    logger.info('[PromptGenerator] Chat response generated', {
      step,
      nextStep: parsedResponse.nextStep,
      isComplete: parsedResponse.isComplete,
      hasPrompt: !!parsedResponse.generatedPrompt
    });

    return res.json({
      message: parsedResponse.message,
      nextStep: parsedResponse.nextStep || step + 1,
      generatedPrompt: parsedResponse.generatedPrompt || null,
      isComplete: parsedResponse.isComplete || false
    });

  } catch (error: any) {
    logger.error('[PromptGenerator] Error:', error.message);
    return res.status(500).json({
      error: 'Fehler bei der Verarbeitung',
      message: 'Entschuldigung, es gab einen Fehler. Bitte versuche es erneut.'
    });
  }
});

export default router;
