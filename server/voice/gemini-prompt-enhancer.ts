import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from '../logger';
import { getKnowledgeDigest } from '../knowledge/context-builder';

// ═══════════════════════════════════════════════════════════════
// SAFE STRING LIST NORMALIZER - Handles any input type robustly
// ═══════════════════════════════════════════════════════════════
function normalizeStringList(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean);
  if (typeof v === 'string') {
    const s = v.trim();
    // Check if it's a JSON array/object as string
    if ((s.startsWith('[') && s.endsWith(']')) || (s.startsWith('{') && s.endsWith('}'))) {
      try {
        const parsed = JSON.parse(s);
        return normalizeStringList(parsed);
      } catch { /* ignore parse errors */ }
    }
    // Fallback: split by comma/newline/semicolon
    return s.split(/[,;\n]/g).map(x => x.trim()).filter(Boolean);
  }
  if (typeof v === 'object' && v !== null) {
    return Object.values(v).map(x => String(x).trim()).filter(Boolean);
  }
  return [String(v).trim()].filter(Boolean);
}

function safeJoin(v: unknown, separator = ', '): string {
  const list = normalizeStringList(v);
  return list.length > 0 ? list.join(separator) : '';
}

// Interface für die Rohdaten vom Formular
export interface CallInput {
  contactName: string;    // "Justin Schwarzott"
  phoneNumber: string;    // "+49..."
  message: string;        // "Verschiebe mein Abendessen..."
}

// Interface für die Daten aus unserer Datenbank
export interface UserContext {
  userName: string;       // "Manuel" (Dein Nutzer)
  userId?: string;        // 🔥 REQUIRED for knowledge digest injection
  
  // 🔥 BUSINESS INTELLIGENCE - ERWEITERT (Dezember 2025)
  company?: string;       // "ARAS GmbH"
  website?: string;       // "https://aras-ai.com"
  industry?: string;      // "real_estate", "insurance", etc.
  jobRole?: string;       // "CEO", "Sales Manager", etc.
  phone?: string;         // User's phone number
  
  // 🔥 AI PROFILE - ULTRA-DEEP INTELLIGENCE
  aiProfile?: {
    companyDescription?: string;
    products?: string[];
    services?: string[];
    targetAudience?: string;
    brandVoice?: string;
    valueProp?: string;
    uniqueSellingPoints?: string[];
    personalityType?: string;
    communicationTone?: string;
    decisionMakingStyle?: string;
    salesTriggers?: string[];
    painPoints?: string[];
    interests?: string[];
    vocabulary?: string[];
  };
}

// Das Ergebnis, das wir an ElevenLabs senden
export interface EnhancedCallContext {
  contactName: string;
  phoneNumber: string;
  userName: string;
  purpose: string; // z.B. "Terminverschiebung (Restaurant)"
  detailsForAI: string; // Der super-menschliche Prompt
  originalMessage: string; // Die ORIGINAL Nachricht vom User für Dynamic Variables
  
  // 🔥 COMPANY DATA für ElevenLabs Dynamic Variables (Dezember 2025)
  userCompany?: string;          // {{user_company}}
  userIndustry?: string;         // {{user_industry}}
  userWebsite?: string;          // {{user_website}}
  userRole?: string;             // {{user_role}}
  companyDescription?: string;   // {{company_description}}
  companyProducts?: string;      // {{company_products}} - komma-separiert
  companyServices?: string;      // {{company_services}} - komma-separiert
  companyValueProp?: string;     // {{company_value_prop}}
  userPersonality?: string;      // {{user_personality}}
  communicationStyle?: string;   // {{communication_style}}
}

export async function enhanceCallWithGemini(
  input: CallInput, 
  context: UserContext
): Promise<EnhancedCallContext> {
  
  try {
    logger.info('[ARAS-BRAIN] Generiere intelligenten Anruf-Kontext...', {
      hasCompany: !!context.company,
      hasIndustry: !!context.industry,
      hasAiProfile: !!context.aiProfile,
      hasUserId: !!context.userId
    });
    
    // 🧠 INJECT KNOWLEDGE DIGEST for POWER calls
    let knowledgeDigest = '';
    let digestSourceCount = 0;
    if (context.userId) {
      try {
        knowledgeDigest = await getKnowledgeDigest(context.userId, 'power');
        digestSourceCount = (knowledgeDigest.match(/• \[/g) || []).length;
        logger.info('[POWER] knowledgeDigestInjected', {
          userId: context.userId,
          sourceCount: digestSourceCount,
          charCount: knowledgeDigest.length
        });
      } catch (e: any) {
        logger.error('[POWER] Failed to get knowledge digest:', e.message);
      }
    }
    
    // Erstelle einen intelligenten Prompt basierend auf dem Input
    const purpose = determinePurpose(input.message);
    const detailsForAI = generateHumanPrompt(input, context, knowledgeDigest);
    
    // 🔥 Prepare company data for ElevenLabs dynamic variables
    const aiProfile = context.aiProfile || {};
    
    logger.info('[ARAS-BRAIN] Anruf-Kontext erfolgreich generiert', { 
      purpose,
      company: context.company,
      hasAiProfile: !!context.aiProfile
    });
    
    return {
      contactName: input.contactName,
      phoneNumber: input.phoneNumber,
      userName: context.userName,
      purpose,
      detailsForAI,
      originalMessage: input.message,
      
      // 🔥 COMPANY DATA für ElevenLabs (Dezember 2025)
      userCompany: context.company,
      userIndustry: context.industry,
      userWebsite: context.website,
      userRole: context.jobRole,
      companyDescription: aiProfile.companyDescription,
      companyProducts: safeJoin(aiProfile.products),
      companyServices: safeJoin(aiProfile.services),
      companyValueProp: aiProfile.valueProp,
      userPersonality: aiProfile.personalityType,
      communicationStyle: aiProfile.communicationTone || aiProfile.brandVoice
    };
  } catch (error: any) {
    logger.error('[ARAS-BRAIN] Fehler bei Kontext-Generierung', { error: error.message });
    
    // Fallback: Einfacher aber funktionaler Prompt
    const aiProfile = context.aiProfile || {};
    
    return {
      contactName: input.contactName,
      phoneNumber: input.phoneNumber,
      userName: context.userName,
      purpose: "Anruf",
      detailsForAI: `Du bist ARAS, der persönliche Assistent von ${context.userName}. Du rufst ${input.contactName} an. Dein Auftrag: ${input.message}. Sei extrem höflich, menschlich und natürlich. Verwende "ähm" und Pausen für mehr Natürlichkeit.`,
      originalMessage: input.message,
      
      // 🔥 COMPANY DATA auch im Fallback
      userCompany: context.company,
      userIndustry: context.industry,
      userWebsite: context.website,
      userRole: context.jobRole,
      companyDescription: aiProfile.companyDescription,
      companyProducts: safeJoin(aiProfile.products),
      companyServices: safeJoin(aiProfile.services),
      companyValueProp: aiProfile.valueProp,
      userPersonality: aiProfile.personalityType,
      communicationStyle: aiProfile.communicationTone || aiProfile.brandVoice
    };
  }
}

// Hilfsfunktion: Bestimme den Zweck des Anrufs
function determinePurpose(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('termin') || lowerMessage.includes('verschieb')) {
    return 'Terminverschiebung';
  }
  if (lowerMessage.includes('reservierung') || lowerMessage.includes('tisch')) {
    return 'Restaurant-Reservierung';
  }
  if (lowerMessage.includes('bestätig') || lowerMessage.includes('bestell')) {
    return 'Bestätigung';
  }
  if (lowerMessage.includes('erinner')) {
    return 'Erinnerung';
  }
  if (lowerMessage.includes('frag')) {
    return 'Anfrage';
  }
  
  return 'Allgemeines Anliegen';
}

// Hilfsfunktion: Generiere menschlichen Prompt (EINFACHE VERSION für Fallback)
function generateHumanPrompt(input: CallInput, context: UserContext, knowledgeDigest: string = ''): string {
  const purpose = determinePurpose(input.message);
  
  let basePrompt = `Du bist ARAS, der persönliche KI-Assistent von ${context.userName}.

Du rufst jetzt ${input.contactName} an.

**WICHTIG - Sei EXTREM menschlich:**
- Verwende natürliche Pausen und Füllwörter wie "ähm", "also", "genau"
- Sprich langsam und klar
- Sei sehr höflich und freundlich
- Stelle dich kurz vor

**Dein Auftrag:**
${input.message}

**Gesprächseröffnung:**
Beginne mit: "Guten Tag, hier spricht ARAS, der persönliche Assistent von ${context.userName}. Ich rufe wegen... an."

**Wichtige Regeln:**
1. Bleib beim Thema und sei präzise
2. Höre auf die Antworten und reagiere natürlich
3. Bedanke dich am Ende höflich
4. Verabschiede dich freundlich

Jetzt führe das Gespräch!`;

  // 🧠 INJECT KNOWLEDGE DIGEST if available
  if (knowledgeDigest && knowledgeDigest.length > 0) {
    basePrompt += `\n\n${knowledgeDigest}`;
  }
  
  return basePrompt;
}

// HINWEIS: Die ULTRA-PERSONALISIERTE Version wird jetzt vom prompt-validator.ts
// mit generateFinalPrompt() generiert, der ALLE User-Daten nutzt!
