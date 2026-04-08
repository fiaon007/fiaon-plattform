/**
 * ============================================================================
 * ARAS MAIL AI SERVICE
 * ============================================================================
 * Gemini-powered email triage, classification, and draft generation
 * Uses GOOGLE_GEMINI_API_KEY environment variable
 * ============================================================================
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../logger';

// ============================================================================
// TYPES
// ============================================================================

export interface MailTriageInput {
  fromEmail: string;
  fromName?: string | null;
  subject: string;
  snippet: string;
  bodyText: string;
  bodyHtml: string;
  mailbox?: string | null;
}

export interface MailTriageResult {
  category: 'SALES' | 'SUPPORT' | 'MEETING' | 'BILLING' | 'PARTNERSHIP' | 'LEGAL' | 'SPAM' | 'OTHER';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  confidence: number;
  action: 'REPLY' | 'SCHEDULE_MEETING' | 'ASK_CLARIFY' | 'FORWARD_TO_HUMAN' | 'ARCHIVE' | 'DELETE';
  reason: string;  // 1-2 sentences explaining the classification
  summary: string;
  needsClarification: boolean;
  clarifyingQuestions: string[];
  reply: {
    subject: string;
    text: string;
    html: string;
  };
}

// ============================================================================
// ARAS HTML EMAIL TEMPLATE
// ============================================================================

const ARAS_EMAIL_STYLE = `
<style>
  body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f0f0f; color: #e5e5e5; margin: 0; padding: 0; }
  .container { max-width: 600px; margin: 0 auto; background: linear-gradient(180deg, #151515 0%, #0f0f0f 100%); border: 1px solid rgba(254,145,0,0.15); border-radius: 16px; overflow: hidden; }
  .header { background: linear-gradient(135deg, #1a1a1a, #0d0d0d); padding: 24px 32px; border-bottom: 1px solid rgba(254,145,0,0.12); }
  .logo { font-family: 'Orbitron', monospace; font-size: 18px; font-weight: 700; background: linear-gradient(135deg, #e9d7c4, #FE9100); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: 2px; }
  .content { padding: 32px; line-height: 1.7; color: #d4d4d4; font-size: 15px; }
  .content p { margin: 0 0 16px 0; }
  .highlight { color: #FE9100; font-weight: 500; }
  .cta-container { padding: 0 32px 32px; }
  .cta { display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #FE9100, #a34e00); color: #ffffff !important; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 14px; margin-right: 12px; margin-bottom: 8px; box-shadow: 0 4px 16px rgba(254,145,0,0.3); }
  .cta-secondary { background: transparent; border: 1px solid rgba(254,145,0,0.4); color: #FE9100 !important; box-shadow: none; }
  .footer { background: #0a0a0a; padding: 24px 32px; border-top: 1px solid rgba(254,145,0,0.08); text-align: center; }
  .footer-text { font-size: 12px; color: #666; margin: 0; }
  .footer-brand { color: #FE9100; font-weight: 600; }
  .signature { margin-top: 24px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.06); }
  .sig-name { font-weight: 600; color: #FE9100; margin: 0 0 4px 0; }
  .sig-title { font-size: 13px; color: #888; margin: 0 0 4px 0; }
  .sig-company { font-size: 12px; color: #666; margin: 0; }
</style>
`;

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

const SYSTEM_PROMPT = `You are an elite email triage and response AI for ARAS AI, a premium B2B AI/CRM platform.

COMPANY CONTEXT:
- ARAS AI helps SMBs automate sales, enrichment, and CRM workflows
- Premium positioning: "Apple meets Neuralink" design philosophy
- Tone: Confident, professional, human, never salesy or hype-driven

YOUR TASK:
Analyze incoming business emails and generate:
1. Classification (category, priority, confidence, action)
2. A professional German reply draft

CLASSIFICATION RULES:
- SALES: Inquiries about pricing, demos, capabilities, new customer acquisition
- SUPPORT: Technical issues, bugs, how-to questions, feature requests
- MEETING: Explicit meeting requests, scheduling, calendar invites
- BILLING: Invoice, payment, subscription, refund questions
- PARTNERSHIP: Partner proposals, reseller requests, integration inquiries, affiliate programs
- LEGAL: Contracts, NDA requests, compliance, GDPR, terms questions
- SPAM: Newsletters, cold outreach, irrelevant marketing, automated messages
- OTHER: Everything that doesn't fit above categories

PRIORITY RULES:
- URGENT: Existing customer with critical issue, time-sensitive deal
- HIGH: Active prospect, important partner, quick response needed
- MEDIUM: Standard business inquiry, normal timeline
- LOW: General questions, non-urgent, newsletters

ACTION RULES:
- REPLY: Needs a thoughtful response, draft ready
- SCHEDULE_MEETING: Schedule a meeting/call, draft includes time proposals
- ASK_CLARIFY: Missing key information, set needsClarification=true with questions
- FORWARD_TO_HUMAN: Complex case requiring human judgment
- ARCHIVE: File away, no response needed (newsletters, spam)
- DELETE: Clear spam, phishing, malicious

CLARIFICATION RULES:
- If the email asks for pricing/timeline/account details you don't have: set needsClarification=true
- Provide 1-5 specific clarifying questions in clarifyingQuestions array
- You may still provide a partial draft as a starting point

REPLY GUIDELINES:
- Write in German (unless email clearly in English)
- Human, warm, professional tone
- Never invent facts - ask if data is missing
- If meeting: propose 2 time windows, ask timezone
- If support: concise solution + next steps + max 1 clarifying question
- If sales: friendly, confident, offer short call + 2 CTA options
- If spam/newsletter: leave reply empty, action=ARCHIVE
- Keep replies concise: 3-5 paragraphs max
- Include ARAS Team signature block at the end
- NEVER invent company details, pricing, timelines, or technical specs
- NEVER say "I am an AI" or mention any AI/model provider
- Signature: "Mit freundlichen Grüßen, ARAS Team" (or contextually appropriate)

OUTPUT FORMAT (strict JSON):
{
  "category": "SALES|SUPPORT|MEETING|BILLING|PARTNERSHIP|LEGAL|SPAM|OTHER",
  "priority": "LOW|MEDIUM|HIGH|URGENT",
  "confidence": 0.0-1.0,
  "action": "REPLY|SCHEDULE_MEETING|ASK_CLARIFY|FORWARD_TO_HUMAN|ARCHIVE|DELETE",
  "reason": "1-2 sentences explaining classification (max 200 chars, no PII)",
  "summary": "2-4 sentences in German describing the email and recommended action (max 400 chars)",
  "needsClarification": false,
  "clarifyingQuestions": [],
  "reply": {
    "subject": "Re: [original subject or new subject]",
    "text": "Plain text version of the reply",
    "html": "Full ARAS-styled HTML email (inline styles, dark theme, gold/orange accents)"
  }
}

For spam/archive/delete, reply should have empty strings and needsClarification=false.`;

// ============================================================================
// GEMINI CLIENT
// ============================================================================

let genAI: GoogleGenerativeAI | null = null;

function getGeminiClient(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_GEMINI_API_KEY environment variable not set');
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

// ============================================================================
// TRIAGE FUNCTION
// ============================================================================

export async function triageEmail(input: MailTriageInput): Promise<MailTriageResult> {
  const startTime = Date.now();
  logger.info(`[MAIL-AI] Starting triage for email from ${input.fromEmail}`);

  try {
    const client = getGeminiClient();
    const model = client.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.3,
        topP: 0.8,
        maxOutputTokens: 4096,
      },
    });

    // Prepare content (truncate if too long)
    const bodyContent = (input.bodyText || '').slice(0, 8000) || (input.snippet || '').slice(0, 2000);
    
    const prompt = `${SYSTEM_PROMPT}

EMAIL TO ANALYZE:
From: ${input.fromName ? `${input.fromName} <${input.fromEmail}>` : input.fromEmail}
To: ${input.mailbox || 'info@aras-ai.com'}
Subject: ${input.subject || '(No Subject)'}
Snippet: ${input.snippet || ''}

Body:
${bodyContent}

---
Respond with valid JSON only. No markdown, no code blocks, just the JSON object.`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Parse JSON response
    let parsed: MailTriageResult;
    try {
      // Clean up potential markdown code blocks
      let cleanText = text.trim();
      if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      parsed = JSON.parse(cleanText);
    } catch (parseError) {
      logger.error('[MAIL-AI] Failed to parse Gemini response:', text);
      throw new Error('Failed to parse AI response as JSON');
    }

    // Validate required fields
    if (!parsed.category || !parsed.priority || !parsed.action) {
      throw new Error('Missing required fields in AI response');
    }

    // Ensure defaults for optional fields
    parsed.reason = parsed.reason ?? '';
    parsed.needsClarification = parsed.needsClarification ?? false;
    parsed.clarifyingQuestions = parsed.clarifyingQuestions ?? [];
    parsed.reply = parsed.reply ?? { subject: '', text: '', html: '' };

    // Wrap HTML in ARAS template if reply exists
    if (parsed.reply?.html && parsed.reply.html.length > 0) {
      parsed.reply.html = wrapInArasTemplate(parsed.reply.html);
    }

    const duration = Date.now() - startTime;
    logger.info(`[MAIL-AI] Triage complete in ${duration}ms: category=${parsed.category}, priority=${parsed.priority}, action=${parsed.action}`);

    return parsed as MailTriageResult;

  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error(`[MAIL-AI] Triage failed after ${duration}ms:`, error.message);
    
    // Return fallback result
    return {
      category: 'OTHER',
      priority: 'MEDIUM',
      confidence: 0,
      action: 'FORWARD_TO_HUMAN',
      reason: 'Automatische Klassifizierung fehlgeschlagen.',
      summary: `ARAS Engine konnte diese E-Mail nicht automatisch verarbeiten. Bitte manuell prüfen.`,
      needsClarification: true,
      clarifyingQuestions: ['Bitte manuell klassifizieren und Antwort erstellen.'],
      reply: {
        subject: '',
        text: '',
        html: '',
      },
    };
  }
}

// ============================================================================
// HTML TEMPLATE WRAPPER
// ============================================================================

function wrapInArasTemplate(bodyHtml: string): string {
  // If already has container, return as-is
  if (bodyHtml.includes('class="container"')) {
    return bodyHtml;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${ARAS_EMAIL_STYLE}
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">ARAS AI</div>
    </div>
    <div class="content">
      ${bodyHtml}
    </div>
    <div class="footer">
      <p class="footer-text"><span class="footer-brand">ARAS</span> — Premium Business Intelligence</p>
    </div>
  </div>
</body>
</html>`;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  triageEmail,
};
