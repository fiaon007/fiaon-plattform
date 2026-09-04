import type { Request, Response } from "express";
import { Router } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "./db";
import { chatMessages, chatSessions, users } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { getKnowledgeDigest } from './knowledge/context-builder';

// Extend express-session types
declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

// Initialize Gemini 2.5 Flash (NEWEST MODEL NOV 2025)
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ 
  model: "gemini-2.5-flash",  // 🔥 NEWEST MODEL NOV 2025
  generationConfig: {
    temperature: 1.0,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
  },
  tools: [{
    googleSearch: {}  // 🔥 LIVE GOOGLE SEARCH GROUNDING
  }] as any,  // Type not updated yet in SDK
});

console.log('[GEMINI] 🔥 Using gemini-2.5-flash with Google Search Grounding for LIVE DATA');

const router = Router();

// 🧠 ============================================
// ARAS AI PLATFORM KNOWLEDGE BASE
// Complete information about platform, pricing, features
// ============================================
const PLATFORM_KNOWLEDGE = {
  company: {
    name: "Schwarzott Capital Partners AG",
    founded: "1992 (Neu ausgerichtet 2024)",
    ceo: "Justin Schwarzott",
    ceoEmail: "justin@schwarzott.com",
    headquarters: "Schifflände 26, 8001 Zürich, Schweiz",
    usOffice: "Schwarzott Global LLC, 3119 Coral Way, Suite 200, Miami, FL 33145, USA",
    industries: ["Strategische Investitionen", "Unternehmensberatung", "Immobilieninvestitionen (CH/US)", "Fix-and-Flip (USA)"],
    vision: "Global führend in strategischen Investitionen und Immobilien mit Fokus auf Wachstum und optimale Renditen"
  },
  pricing: {
    free: { name: "FREE", price: "€0/Monat", aiMessages: 10, dataSources: 2 },
    pro: { name: "PRO", price: "€49/Monat", aiMessages: 500, dataSources: 10 },
    enterprise: { name: "ENTERPRISE", price: "Custom", aiMessages: "Unlimited", dataSources: "Unlimited" }
  },
  launch: {
    phase: "Early Access (Live Beta)",
    officialLaunch: "01. Januar 2026",
    status: "Voll funktionsfähig, gelegentliche Updates möglich"
  },
  features: {
    space: "Ultra-intelligenter AI Chat mit vollständigem Daten-Zugriff und Live Google Search",
    dashboard: "Power Dashboard mit AI-Profil, Psychologischem Profil, Business Intelligence",
    research: "Ultra-Deep AI Research mit 20+ Kategorien und Live-Daten"
  },
  ai: {
    model: "Google Gemini 2.5 Flash (November 2025)",
    capabilities: ["Google Search Grounding", "Live Internet Access", "Psychologische Profil-Analyse", "8192 Token Output"]
  }
};

// 🧠 ULTRA-INTELLIGENT SYSTEM PROMPT
// Full access to all user data, platform knowledge, and psychological profile
const getSystemPrompt = (user: any, userDataSources?: any[]) => {
  const aiProfile = user.aiProfile || {};
  
  // Extract ALL profile data
  const companyDesc = aiProfile.companyDescription || 'Keine Company Intelligence verfügbar';
  const industry = aiProfile.industry || user.industry || 'Unbekannt';
  const targetAudience = aiProfile.targetAudience || 'Nicht definiert';
  const keywords = aiProfile.effectiveKeywords?.slice(0, 15).join(', ') || 'Keine Keywords';
  const competitors = aiProfile.competitors?.slice(0, 5).join(', ') || 'Keine bekannt';
  const opportunities = aiProfile.opportunities?.slice(0, 3).join(' | ') || 'Nicht analysiert';
  const challenges = aiProfile.challenges?.slice(0, 3).join(' | ') || 'Nicht analysiert';
  
  // Psychological Profile
  const personalityType = aiProfile.personalityType || 'Noch nicht analysiert';
  const communicationTone = aiProfile.communicationTone || 'Noch nicht analysiert';
  const decisionMaking = aiProfile.decisionMakingStyle || 'Noch nicht analysiert';
  const interests = aiProfile.interests?.join(', ') || 'Noch nicht analysiert';
  const painPoints = aiProfile.painPoints?.join(', ') || 'Noch nicht analysiert';
  const chatSummary = aiProfile.chatInsightsSummary || 'Noch keine Chat-Analyse durchgeführt';
  
  // Data Sources
  let dataSourcesList = 'Keine Datenquellen hinzugefügt';
  let dataSourcesCount = 0;
  if (userDataSources && userDataSources.length > 0) {
    dataSourcesCount = userDataSources.length;
    dataSourcesList = userDataSources.map(ds => `- ${ds.name} (${ds.type}): ${ds.url || ds.content?.substring(0, 50) || 'N/A'}`).join('\n');
  }
  
  // Platform Knowledge
  const pricing = `FREE: ${PLATFORM_KNOWLEDGE.pricing.free.price} (${PLATFORM_KNOWLEDGE.pricing.free.aiMessages} Nachrichten) | PRO: ${PLATFORM_KNOWLEDGE.pricing.pro.price} (${PLATFORM_KNOWLEDGE.pricing.pro.aiMessages} Nachrichten) | ENTERPRISE: ${PLATFORM_KNOWLEDGE.pricing.enterprise.price} (Unlimited)`;
  
  return `╔═════════════════════════════════════════════════════════════╗
║  🧠 ARAS AI® – ULTRA-INTELLIGENTE PERSÖNLICHE KI  ║
╚═════════════════════════════════════════════════════════════╝

🆔 SYSTEM IDENTITY:
ARAS AI® v5.0 – Entwickelt von der Schwarzott Group
CEO: ${PLATFORM_KNOWLEDGE.company.ceo}
Model: ${PLATFORM_KNOWLEDGE.ai.model}
Capabilities: Live Google Search, Psychologische Analyse, Ultra-Deep Research

Du bist NICHT ChatGPT, Claude oder OpenAI - du bist ARAS AI®!

══════════════════════════════════════
👤 VOLLSTÄNDIGES USER-PROFIL: ${user.firstName?.toUpperCase() || 'USER'}
══════════════════════════════════════
📍 BASISDATEN:
  Name: ${user.firstName} ${user.lastName}
  Email: ${user.email || 'N/A'}
  Company: ${user.company || 'N/A'}
  Industry: ${industry}
  Website: ${user.website || 'N/A'}
  Phone: ${user.phone || 'N/A'}
  
📊 ACCOUNT STATUS:
  Plan: ${user.subscriptionPlan?.toUpperCase() || 'FREE'}
  Status: ${user.subscriptionStatus || 'active'}
  AI Messages Used: ${user.aiMessagesUsed || 0}
  Voice Calls Used: ${user.voiceCallsUsed || 0}

🏢 BUSINESS INTELLIGENCE:
  Beschreibung: ${companyDesc}
  Zielgruppe: ${targetAudience}
  Keywords: ${keywords}
  Wettbewerber: ${competitors}
  Opportunities: ${opportunities}
  Challenges: ${challenges}

🧠 PSYCHOLOGISCHES PROFIL:
  Persönlichkeitstyp: ${personalityType}
  Kommunikationsstil: ${communicationTone}
  Entscheidungsstil: ${decisionMaking}
  Interessen: ${interests}
  Pain Points: ${painPoints}
  
💬 CHAT-INSIGHTS:
  ${chatSummary}

📁 DATENQUELLEN (${dataSourcesCount}):
${dataSourcesList}

══════════════════════════════════════
🏢 ARAS AI PLATFORM KNOWLEDGE
══════════════════════════════════════
🏛️ COMPANY:
  Name: ${PLATFORM_KNOWLEDGE.company.name}
  CEO: ${PLATFORM_KNOWLEDGE.company.ceo}
  Email: ${PLATFORM_KNOWLEDGE.company.ceoEmail}
  Headquarters: ${PLATFORM_KNOWLEDGE.company.headquarters}
  US Office: ${PLATFORM_KNOWLEDGE.company.usOffice}
  Industries: ${PLATFORM_KNOWLEDGE.company.industries.join(', ')}
  Vision: ${PLATFORM_KNOWLEDGE.company.vision}

� PRICING:
  ${pricing}

� LAUNCH:
  Phase: ${PLATFORM_KNOWLEDGE.launch.phase}
  Official Launch: ${PLATFORM_KNOWLEDGE.launch.officialLaunch}
  Status: ${PLATFORM_KNOWLEDGE.launch.status}

✨ FEATURES:
  SPACE: ${PLATFORM_KNOWLEDGE.features.space}
  Dashboard: ${PLATFORM_KNOWLEDGE.features.dashboard}
  Research: ${PLATFORM_KNOWLEDGE.features.research}

══════════════════════════════════════
🎯 DEINE MISSION
══════════════════════════════════════
1. NUTZE ALLE VERFÜGBAREN DATEN: Du hast vollständigen Zugriff auf User-Profil, Business Intelligence, Psychologisches Profil, Datenquellen UND Platform Knowledge!

2. BEI PLATTFORM-FRAGEN: Antworte präzise mit den Informationen aus dem PLATFORM KNOWLEDGE Block oben. Beispiele:
   - "Wie teuer ist ARAS AI?" → Nenne EXAKTE Preise
   - "Wann ist der Launch?" → Sage "01. Januar 2026"
   - "Welche AI wird verwendet?" → "Gemini 2.5 Flash mit Google Search Grounding"
   - "Was ist die Email von Justin?" → "${PLATFORM_KNOWLEDGE.company.ceoEmail}"

3. BEI BUSINESS-FRAGEN: Nutze die Business Intelligence, Psychologisches Profil und Datenquellen für personalisierte Antworten!

4. BEI AKTUELLEN NEWS: Nutze deine Google Search Grounding Fähigkeit für Live-Daten!

5. TONE: Freundlich, direkt, hilfsbereit. Nutze Emojis 🚀🔥💡. Sprich ${user.firstName} mit Vornamen an!

6. SIGNATUR bei wichtigen Insights:
   "💡 ARAS®: [Dein Insight]"
   "🔥 Pro-Tip: [Dein Tipp]"
   "⚡ Wichtig: [Key Info]"

🚫 NIEMALS:
- Sagen du bist ChatGPT/OpenAI
- Generic antworten ohne Kontext
- ${user.firstName}'s Namen vergessen
- Falsche Platform-Infos geben (nutze PLATFORM KNOWLEDGE!)
- "Ich habe keinen Zugriff auf..." sagen (DU HAST ZUGRIFF AUF ALLES!)

🧠 Du bist die INTELLIGENTESTE Version von ARAS AI - nutze ALLE Daten!
Let's go, ${user.firstName}! 💪🔥`;
};

router.post("/chat/messages", async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { message, sessionId } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ message: "Message cannot be empty" });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let currentSessionId = sessionId;
    if (!currentSessionId) {
      const [newSession] = await db
        .insert(chatSessions)
        .values({
          userId,
          title: message.substring(0, 50),
        })
        .returning();
      currentSessionId = newSession.id;
    }

    await db.insert(chatMessages).values({
      sessionId: currentSessionId,
      userId: userId,
      isAi: false,
      message: message,
    });

    // Get last 25 messages for full context
    const allMessages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, currentSessionId));

    const last25Messages = allMessages
      .filter(msg => msg.message)
      .slice(-25); // Increased from 20 to 25

    const contextMessages: Array<{
      role: "assistant" | "user";
      content: string;
    }> = last25Messages.map((msg) => ({
      role: msg.isAi ? "assistant" as const : "user" as const,
      content: msg.message,
    }));

    // 🧠 Inject Knowledge Digest from user data sources
    const knowledgeDigest = await getKnowledgeDigest(userId, 'space');
    const digestCharCount = knowledgeDigest.length;
    const digestSourceCount = (knowledgeDigest.match(/• \[/g) || []).length;
    
    // Generate enhanced system prompt with full user context + knowledge digest
    const baseSystemPrompt = getSystemPrompt(user);
    const enhancedSystemPrompt = knowledgeDigest 
      ? `${baseSystemPrompt}\n\n${knowledgeDigest}` 
      : baseSystemPrompt;

    console.log(`[CHAT] 💬 ${user.firstName} (${user.company}) | Session: ${currentSessionId}`);
    console.log(`[CHAT] 📊 Context: ${contextMessages.length} messages | Profile enriched: ${user.profileEnriched}`);
    console.log(`[CHAT] 🧠 knowledgeDigestInjected: { userId: ${userId}, sourceCount: ${digestSourceCount}, charCount: ${digestCharCount}, first200: "${knowledgeDigest.slice(0, 200).replace(/\n/g, ' ')}" }`);
    console.log(`[CHAT] 🔥 Using Gemini 2.5 Flash with LIVE DATA & GROUNDING`);

    // Build conversation history for Gemini
    const conversationHistory = contextMessages.map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }]
    }));

    // Start chat with Gemini
    const chat = model.startChat({
      history: conversationHistory,
      systemInstruction: enhancedSystemPrompt,
    });

    // Send message and get response
    const result = await chat.sendMessage(
      contextMessages[contextMessages.length - 1]?.content || message
    );
    
    const assistantMessage = result.response.text() || 
      "Ups, da lief was schief. Versuch's nochmal!";

    await db.insert(chatMessages).values({
      sessionId: currentSessionId,
      userId: userId,
      isAi: true,
      message: assistantMessage,
    });

    await db
      .update(users)
      .set({
        aiMessagesUsed: (user.aiMessagesUsed || 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // 🧠 AUTO-TRIGGER ANALYSIS every 10 messages
    const totalMessages = (user.aiMessagesUsed || 0) + 1;
    if (totalMessages % 10 === 0) {
      console.log(`[🧠 AUTO-ANALYZE] Triggering analysis after ${totalMessages} messages`);
      // Trigger analysis in background (don't await)
      fetch(`http://localhost:${process.env.PORT || 5000}/api/chat/analyze-user`, {
        method: 'POST',
        headers: {
          'Cookie': req.headers.cookie || ''
        }
      }).catch(err => console.error('[❌ AUTO-ANALYZE] Failed:', err));
    }

    return res.json({
      message: assistantMessage,
      sessionId: currentSessionId,
      messagesRemaining: 100 - ((user.aiMessagesUsed || 0) + 1),
    });
  } catch (error: any) {
    console.error("[CHAT-ERROR]", error);
    return res.status(500).json({ 
      message: "Oops, da lief was schief. Versuch's nochmal!" 
    });
  }
});

router.get("/chat/sessions", async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const sessions = await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.userId, userId));

    // NULL-SAFE: Always return array, never undefined
    const safeSessions = Array.isArray(sessions) ? sessions : [];
    return res.json(safeSessions.reverse());
  } catch (error: any) {
    console.error("[GET-SESSIONS-ERROR]", error);
    // UPGRADE: Return 200 with empty array instead of 500 to keep UI alive
    return res.status(200).json([]);
  }
});

router.get("/chat/messages", async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { sessionId } = req.query;
    if (!sessionId) {
      return res.json([]);
    }

    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, parseInt(sessionId as string, 10)));

    return res.json(messages);
  } catch (error) {
    console.error("[GET-MESSAGES-ERROR]", error);
    return res.status(500).json({ message: "Failed to fetch messages" });
  }
});

// 🧠 ANALYZE USER CHAT HISTORY FOR DEEP INTELLIGENCE
router.post('/analyze-user', async (req, res) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const userId = (req.user as any).id;
    console.log(`[🧠 ANALYZE] Starting deep analysis for user: ${userId}`);

    // Get all user messages
    const messages = await db.select()
      .from(chatMessages)
      .where(eq(chatMessages.userId, userId))
      .orderBy(desc(chatMessages.timestamp))
      .limit(100);  // Last 100 messages

    if (messages.length === 0) {
      return res.json({ message: 'No messages to analyze yet' });
    }

    console.log(`[🧠 ANALYZE] Found ${messages.length} messages to analyze`);

    // Prepare conversation text for analysis
    const conversationText = messages
      .map(m => `${m.isAi ? 'AI' : 'USER'}: ${m.message}`)
      .join('\n\n');

    // 🔥 ULTRA-DEEP GEMINI ANALYSIS PROMPT
    const analysisPrompt = `You are an expert psychologist and business analyst. Analyze this conversation history and extract DEEP PERSONAL INTELLIGENCE.

CONVERSATION HISTORY:
${conversationText}

Provide a comprehensive JSON analysis with the following structure:
{
  "personalityType": "Describe personality traits (e.g., Analytical, Direct, Results-Driven)",
  "communicationTone": "How they communicate (e.g., Professional but casual, Formal, Friendly)",
  "decisionMakingStyle": "How they make decisions (e.g., Data-driven, Intuitive, Fast-paced)",
  "emotionalTriggers": ["List 3-5 things that motivate or frustrate them"],
  "workingHours": "Observed active times pattern",
  "responsePatterns": "How they typically respond to questions",
  "interests": ["Topics they seem interested in"],
  "painPoints": ["Problems or challenges they mention"],
  "aspirations": ["Goals they express or hint at"],
  "vocabulary": ["Common words, phrases, or expressions they use"],
  "urgencyLevel": "high/medium/low - how urgent their needs seem",
  "trustLevel": "How much they trust AI/automation",
  "technicalLevel": "Tech-savvy rating: expert/intermediate/beginner",
  "collaborationStyle": "How they work with the AI assistant",
  "priorityFocus": ["What they care about most"],
  "stressIndicators": ["Any signs of stress or pressure"],
  "successMetrics": ["How they seem to measure success"],
  "learningStyle": "How they prefer to learn: visual/analytical/practical",
  "feedbackStyle": "How they give feedback",
  "chatInsightsSummary": "A detailed 2-3 paragraph summary of key insights about this person"
}

Be specific and insightful. Use actual examples from the conversation.`;

    console.log(`[🧠 ANALYZE] Sending ${conversationText.length} chars to Gemini...`);

    const chat = model.startChat({
      history: [],
    });

    const result = await chat.sendMessage(analysisPrompt);
    const analysisText = result.response.text();
    
    console.log(`[🧠 ANALYZE] Gemini response received: ${analysisText.length} chars`);

    // Extract JSON from response
    let insights: any = {};
    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        insights = JSON.parse(jsonMatch[0]);
        console.log(`[✅ ANALYZE] Parsed insights successfully`);
      }
    } catch (e) {
      console.error(`[❌ ANALYZE] Failed to parse JSON:`, e);
      // Fallback
      insights = {
        chatInsightsSummary: analysisText,
        lastChatAnalysis: new Date().toISOString()
      };
    }

    // Add timestamp
    insights.lastChatAnalysis = new Date().toISOString();

    // Update user profile with insights
    const currentUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (currentUser.length > 0) {
      const currentProfile = currentUser[0].aiProfile || {};
      const updatedProfile = {
        ...currentProfile,
        ...insights
      };

      await db.update(users)
        .set({ 
          aiProfile: updatedProfile,
          lastEnrichmentDate: new Date()
        })
        .where(eq(users.id, userId));

      console.log(`[✅ ANALYZE] User profile updated with deep insights`);
    }

    res.json({ 
      success: true, 
      insights,
      messagesAnalyzed: messages.length
    });

  } catch (error: any) {
    console.error('[❌ ANALYZE] Error:', error);
    res.status(500).json({ 
      message: 'Analysis failed', 
      error: error.message 
    });
  }
});

export default router;
