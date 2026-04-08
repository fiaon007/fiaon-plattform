/**
 * ============================================================================
 * ARAS LAB - Experimental Voice Command Interface Backend
 * ============================================================================
 * Whisper STT → Gemini Intent Recognition → Action Execution → ElevenLabs TTS
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { db } from '../db';
import { contacts } from '@shared/schema';
import { eq, ilike, or } from 'drizzle-orm';
import { logger } from '../logger';
import multer from 'multer';

const router = Router();

// Multer for audio upload
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB max
});

// Initialize AI clients
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const gemini = process.env.GOOGLE_GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY)
  : null;

// Intent types
type IntentType = 'call' | 'schedule' | 'search' | 'info' | 'unknown';

interface ParsedIntent {
  type: IntentType;
  contactName?: string;
  action?: string;
  details?: string;
  confidence: number;
}

interface ContactMatch {
  id: number;
  firstName: string;
  lastName: string;
  phone: string | null;
  company?: string;
}

// Main processing endpoint
router.post('/process', upload.single('audio'), async (req: Request, res: Response) => {
  const userId = (req as any).user?.id || (req as any).session?.userId;
  
  if (!userId) {
    return res.status(401).json({ error: 'Nicht authentifiziert' });
  }

  try {
    const audioFile = req.file;
    
    if (!audioFile) {
      return res.status(400).json({ error: 'Keine Audiodatei empfangen' });
    }

    logger.info('[ARAS-LAB] Processing voice command', { 
      userId, 
      fileSize: audioFile.size,
      mimeType: audioFile.mimetype 
    });

    // Step 1: Transcribe with Whisper
    const transcript = await transcribeAudio(audioFile.buffer);
    
    if (!transcript) {
      return res.status(400).json({ 
        error: 'Transkription fehlgeschlagen',
        transcript: '',
        response: 'Ich konnte dich leider nicht verstehen. Bitte versuche es erneut.'
      });
    }

    logger.info('[ARAS-LAB] Transcript:', { transcript });

    // Step 2: Parse intent with Gemini
    const intent = await parseIntent(transcript);
    
    logger.info('[ARAS-LAB] Parsed intent:', intent);

    // Step 3: Execute action based on intent
    const actionResult = await executeAction(intent, userId);

    // Step 4: Generate response
    const response = await generateResponse(transcript, intent, actionResult);

    // Step 5: Generate summary
    const summary = await generateSummary(transcript, response, intent);

    // Step 6: Generate TTS (optional - can be added later with ElevenLabs)
    let audioUrl: string | null = null;
    // TODO: Integrate ElevenLabs TTS here

    logger.info('[ARAS-LAB] Response generated', { 
      hasAction: !!actionResult,
      hasSummary: !!summary 
    });

    return res.json({
      transcript,
      response,
      action: actionResult ? {
        type: intent.type,
        status: actionResult.success ? 'completed' : 'failed',
        details: actionResult.message
      } : null,
      summary,
      audioUrl
    });

  } catch (error: any) {
    logger.error('[ARAS-LAB] Processing error:', error.message);
    return res.status(500).json({
      error: 'Verarbeitungsfehler',
      transcript: '',
      response: 'Es ist ein Fehler aufgetreten. Bitte versuche es erneut.'
    });
  }
});

// Transcribe audio using Whisper
async function transcribeAudio(audioBuffer: Buffer): Promise<string | null> {
  if (!openai) {
    logger.error('[ARAS-LAB] OpenAI not configured');
    return null;
  }

  try {
    // Convert buffer to File-like object
    const audioFile = new File([audioBuffer], 'audio.webm', { type: 'audio/webm' });
    
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'de',
      response_format: 'text'
    });

    return transcription.trim();
  } catch (error: any) {
    logger.error('[ARAS-LAB] Whisper error:', error.message);
    return null;
  }
}

// Parse intent using Gemini
async function parseIntent(transcript: string): Promise<ParsedIntent> {
  if (!gemini) {
    return { type: 'unknown', confidence: 0 };
  }

  try {
    const model = gemini.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    const prompt = `Du bist ein Intent-Parser für einen Voice Assistant. Analysiere den folgenden Sprachbefehl und extrahiere die Absicht.

SPRACHBEFEHL: "${transcript}"

MÖGLICHE INTENT-TYPEN:
- "call": Jemanden anrufen (z.B. "Rufe Martin an", "Verbinde mich mit Lisa")
- "schedule": Termin verschieben/erstellen (z.B. "Verschiebe mein Meeting", "Plane einen Termin")
- "search": Suche/Recherche (z.B. "Suche nach...", "Finde...")
- "info": Information abfragen (z.B. "Wie ist das Wetter", "Was steht an")
- "unknown": Nicht erkennbar

Antworte NUR im folgenden JSON-Format:
{
  "type": "call|schedule|search|info|unknown",
  "contactName": "Name der Person falls erwähnt oder null",
  "action": "Kurze Beschreibung der gewünschten Aktion",
  "details": "Zusätzliche Details falls vorhanden oder null",
  "confidence": 0.0-1.0
}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Parse JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as ParsedIntent;
    }
    
    return { type: 'unknown', confidence: 0 };
  } catch (error: any) {
    logger.error('[ARAS-LAB] Intent parsing error:', error.message);
    return { type: 'unknown', confidence: 0 };
  }
}

// Execute action based on intent
async function executeAction(intent: ParsedIntent, userId: string): Promise<{ success: boolean; message: string; data?: any } | null> {
  
  if (intent.type === 'call' && intent.contactName) {
    // Search for contact in database
    const contact = await findContact(intent.contactName, userId);
    
    if (contact) {
      // For now, just return the contact info
      // Later: Actually initiate the call via ElevenLabs
      return {
        success: true,
        message: `Kontakt gefunden: ${contact.firstName} ${contact.lastName}`,
        data: contact
      };
    } else {
      return {
        success: false,
        message: `Kontakt "${intent.contactName}" nicht gefunden`
      };
    }
  }
  
  if (intent.type === 'schedule') {
    // For now, just acknowledge
    return {
      success: true,
      message: intent.action || 'Termin wird bearbeitet'
    };
  }
  
  if (intent.type === 'search') {
    // TODO: Implement web search
    return {
      success: true,
      message: 'Suche wird durchgeführt...'
    };
  }
  
  return null;
}

// Find contact in database
async function findContact(name: string, userId: string): Promise<ContactMatch | null> {
  try {
    const searchTerms = name.toLowerCase().split(' ');
    
    const results = await db
      .select({
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        phone: contacts.phone,
        company: contacts.company
      })
      .from(contacts)
      .where(
        eq(contacts.userId, userId)
      )
      .limit(10);
    
    // Fuzzy match on name
    const matched = results.find(c => {
      const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
      return searchTerms.some(term => fullName.includes(term));
    });
    
    return matched || null;
  } catch (error: any) {
    logger.error('[ARAS-LAB] Contact search error:', error.message);
    return null;
  }
}

// Generate natural language response
async function generateResponse(transcript: string, intent: ParsedIntent, actionResult: any): Promise<string> {
  if (!gemini) {
    return 'Ich verstehe. Wie kann ich dir weiter helfen?';
  }

  try {
    const model = gemini.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    const context = actionResult 
      ? `Aktion ausgeführt: ${actionResult.message}${actionResult.data ? ` (${JSON.stringify(actionResult.data)})` : ''}`
      : 'Keine spezifische Aktion ausgeführt';

    const prompt = `Du bist ARAS, ein freundlicher und effizienter KI-Assistent. Antworte auf den Benutzer-Befehl.

BENUTZER SAGTE: "${transcript}"
ERKANNTE ABSICHT: ${intent.type} (Confidence: ${intent.confidence})
KONTEXT: ${context}

Antworte kurz, freundlich und natürlich auf Deutsch. Maximal 2-3 Sätze.
Wenn eine Aktion erfolgreich war, bestätige sie.
Wenn etwas nicht gefunden wurde, biete Hilfe an.`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error: any) {
    logger.error('[ARAS-LAB] Response generation error:', error.message);
    return 'Ich habe deine Anfrage verstanden. Wie kann ich dir weiter helfen?';
  }
}

// Generate conversation summary
async function generateSummary(transcript: string, response: string, intent: ParsedIntent): Promise<{ summary: string; actionRequired: boolean; suggestedAction?: string } | null> {
  if (!gemini || intent.type === 'unknown') {
    return null;
  }

  try {
    const model = gemini.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    const prompt = `Erstelle eine kurze Zusammenfassung der Konversation.

BENUTZER: "${transcript}"
ARAS: "${response}"
INTENT: ${intent.type}

Antworte im JSON-Format:
{
  "summary": "Kurze Zusammenfassung in einem Satz",
  "actionRequired": true/false,
  "suggestedAction": "Vorgeschlagene nächste Aktion falls actionRequired=true, sonst null"
}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return null;
  } catch (error: any) {
    logger.error('[ARAS-LAB] Summary generation error:', error.message);
    return null;
  }
}

export default router;
