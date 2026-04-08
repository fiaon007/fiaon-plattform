import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import type { User } from "@shared/schema";
import { sanitizeUser } from "@shared/schema";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { sendWelcomeEmail } from "./email-service";

declare global {
  namespace Express {
    interface User {
      id: string;
      username: string;
      email: string | null;
      firstName: string | null;
      lastName: string | null;
      userRole?: string; // RBAC: "user", "admin", "staff"
    }
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupSimpleAuth(app: Express) {
  const PostgresSessionStore = connectPg(session);
  const sessionStore = new PostgresSessionStore({
    pool,
    createTableIfMissing: true,
    tableName: "sessions",
  });

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "aras-ai-production-secret-2024",
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      httpOnly: true,
      secure: false, // Set to true in production with HTTPS
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user: Express.User, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const { 
        username, password, email, firstName, lastName,
        company, website, industry, role, phone, language, primaryGoal 
      } = req.body;
      
      // 🔥 DEBUG: Log ALL received fields
      console.log('[REGISTER-DEBUG] Received registration data:', {
        username, email, firstName, lastName,
        company, website, industry, role, phone, language, primaryGoal
      });
      
      // Check email FIRST (more common duplicate)
      if (email) {
        const existingEmail = await storage.getUserByEmail(email);
        if (existingEmail) {
          console.log('[REGISTER-DEBUG] Email already exists:', email);
          return res.status(400).json({ message: "Diese E-Mail-Adresse ist bereits registriert" });
        }
      }
      
      // Then check username
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        console.log('[REGISTER-DEBUG] Username already exists:', username);
        return res.status(400).json({ message: "Dieser Benutzername ist bereits vergeben" });
      }

      // 🔥 AI PROFILE GENERATION - ALWAYS RUN IF COMPANY EXISTS
      let aiProfile = null;
      
      console.log(`[RESEARCH-DEBUG] Company: "${company}", Industry: "${industry}", Starting Research: ${!!(company && industry)}`);
      
      if (company && industry) {
        try {
          console.log(`[🔍 ARAS-AI] Starting ULTRA-DEEP live research for ${company}...`);
          console.log('[🔥 ARAS-AI] Using advanced AI with Google Search Grounding');
          
          // Validate API Key
          const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
          if (!apiKey) {
            console.error('[❌ ARAS-AI] API Key missing!');
            throw new Error('AI_API_KEY not configured');
          }
          console.log(`[✅ ARAS-AI] API Key present: ${apiKey.substring(0, 20)}...${apiKey.slice(-4)}`);
          console.log(`[✅ ARAS-AI] API Key length: ${apiKey.length} characters`);
          
          // Quick API Key format validation
          if (!apiKey.startsWith('AIza')) {
            console.error('[❌ ARAS-AI] API Key format invalid! Should start with "AIza"');
            console.error('[❌ ARAS-AI] Current key starts with:', apiKey.substring(0, 10));
            throw new Error('Invalid Gemini API Key format');
          }
          console.log(`[✅ ARAS-AI] API Key format: VALID (starts with AIza)`);
          
          const genAI = new GoogleGenerativeAI(apiKey);
          
          // 🔥🔥🔥 HIGH-END MODEL FOR ULTRA-DEEP RESEARCH 🔥🔥🔥
          const model = genAI.getGenerativeModel({ 
            model: "gemini-2.0-flash-exp",  // 🚀 NEWEST MODEL DEC 2024 - Experimental but BEST!
            generationConfig: {
              temperature: 1.0,  // Maximum creativity for comprehensive research
              topP: 0.95,
              topK: 64,  // Increased diversity
              maxOutputTokens: 8192,
              candidateCount: 1,
            },
            tools: [{
              googleSearch: {
                // Dynamic retrieval with Google Search
              }
            }] as any,
            safetySettings: [
              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
            ] as any
          });
          
          console.log('[🔧 ARAS-AI] ═══════════════════════════════════════');
          console.log('[🔧 ARAS-AI] 🚀 GEMINI 2.0 RESEARCH MODE 🚀');
          console.log('[🔧 ARAS-AI] ═══════════════════════════════════════');
          console.log('[🔧 ARAS-AI] Model: gemini-2.0-flash-exp (NEWEST!)');
          console.log('[🔧 ARAS-AI] Google Search Grounding: ✅ ENABLED');
          console.log('[🔧 ARAS-AI] Temperature: 1.0 (Maximum Creativity)');
          console.log('[🔧 ARAS-AI] topK: 64 (High Diversity)');
          console.log('[🔧 ARAS-AI] Max Output: 8192 tokens');
          console.log('[🔧 ARAS-AI] Safety Filters: DISABLED (Max Freedom)');
          console.log('[🔧 ARAS-AI] Timeout: 90 seconds');
          console.log('[🔧 ARAS-AI] Retries: 3 attempts');
          console.log('[🔧 ARAS-AI] ═══════════════════════════════════════');
          
          // 🔥 PROMPT 1: Company Deep Dive
          const companyDeepDive = `
[🤖 ULTRA-DEEP RESEARCH MODE ACTIVATED]

Unternehmen: ${company}
Website: ${website || 'Nicht angegeben'}
Branche: ${industry}

Du bist ein Elite-Business-Intelligence-Agent. Recherchiere ALLES über dieses Unternehmen:

🏢 UNTERNEHMENS-DNA:
- Gründungsjahr und Geschichte
- CEO/Gründer (Name, Background, Social Media)
- Unternehmensstruktur und Mitarbeiterzahl
- Standorte und Niederlassungen
- Umsatz und Finanzinformationen
- Investoren und Funding-Runden

💼 BUSINESS INTELLIGENCE:
- Exakte Produkte und Services (mit Preisen wenn verfügbar)
- Unique Selling Propositions (USPs)
- Marktposition und Marktanteil
- Hauptwettbewerber und Differenzierung
- Aktuelle Projekte und Initiativen
- Technologie-Stack und Tools

🎯 TARGET & STRATEGY:
- Detaillierte Zielgruppenprofile
- Customer Personas mit Demographics
- Vertriebskanäle und Verkaufsprozess
- Marketing-Strategie und Kampagnen
- Content-Strategie und Social Media Präsenz
- Brand Voice und Tonality

📡 ONLINE PRESENCE:
- Website-Traffic und SEO-Rankings
- Social Media Follower und Engagement
- Online-Reputation und Reviews
- Presse-Erwähnungen und News
- Awards und Zertifizierungen

💡 INSIDER INTELLIGENCE:
- Unternehmenskultur und Werte
- Mitarbeiter-Reviews (Glassdoor, Kununu)
- Aktuelle Herausforderungen und Pain Points
- Expansion Plans und Zukunftsstrategien
- Skandale oder Kontroversen (falls vorhanden)

📈 MARKET INTELLIGENCE:
- Branchentrends und Marktentwicklung
- Regulatorisches Umfeld
- Saisonale Muster und Zyklen
- Key Performance Indicators der Branche

Gib mir eine ULTRA-DETAILLIERTE Analyse als JSON:
{
  "companyDescription": "Ultra-detaillierte Beschreibung mit allen gefundenen Informationen",
  "foundedYear": "Jahr oder 'Unbekannt'",
  "ceoName": "Name des CEOs/Gründers",
  "employeeCount": "Anzahl oder Schätzung",
  "revenue": "Umsatz oder Schätzung",
  "fundingInfo": "Funding-Details",
  "products": ["Detaillierte Produktliste"],
  "services": ["Detaillierte Serviceliste"],
  "targetAudience": "Sehr detaillierte Zielgruppenbeschreibung",
  "competitors": ["Hauptwettbewerber"],
  "uniqueSellingPoints": ["USPs"],
  "brandVoice": "Detaillierte Brand Voice Analyse",
  "onlinePresence": "Website, Social Media Details",
  "currentChallenges": ["Aktuelle Herausforderungen"],
  "opportunities": ["Chancen und Potenziale"],
  "bestCallTimes": "Optimale Kontaktzeiten mit Begründung",
  "effectiveKeywords": ["Top 20+ relevante Keywords"],
  "insiderInfo": "Insider-Informationen und Gerüchte",
  "recentNews": ["Aktuelle News und Entwicklungen"],
  "decisionMakers": ["Key Decision Makers mit Positionen"],
  "psychologicalProfile": "Psychologisches Unternehmensprofil",
  "salesTriggers": ["Verkaufsauslöser und Buying Signals"],
  "communicationPreferences": "Bevorzugte Kommunikationskanäle",
  "budgetCycles": "Budget-Zyklen und Kaufentscheidungszeiträume"
}

Sei EXTREM gründlich. Wenn das Unternehmen existiert, finde ECHTE Daten.
Wenn es neu/unbekannt ist, erstelle ULTRA-REALISTISCHE Projektionen basierend auf der Branche.
Denke wie ein Top-Tier Business Intelligence Analyst bei McKinsey.
`;

          console.log(`[🚀 ARAS-AI] Sending ${companyDeepDive.length} char prompt to AI...`);
          console.log(`[⏰ ARAS-AI] Request started at: ${new Date().toISOString()}`);
          console.log(`[🔍 ARAS-AI] Google Search Grounding: ENABLED`);
          console.log(`[🎯 ARAS-AI] Target: ${company} - ${industry}`);
          
          // 🔥 RETRY LOGIC with extended timeout for ULTRA-DEEP research
          let response: string | null = null;
          let lastError: any = null;
          const MAX_RETRIES = 3;
          const TIMEOUT_MS = 90000; // 90 seconds for comprehensive Google Search
          
          for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
              console.log(`[🔄 ARAS-AI] Attempt ${attempt}/${MAX_RETRIES}`);
              
              const resultPromise = model.generateContent(companyDeepDive);
              const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error(`Timeout after ${TIMEOUT_MS/1000}s`)), TIMEOUT_MS)
              );
              
              const result = await Promise.race([resultPromise, timeoutPromise]) as any;
              
              if (result && result.response) {
                const tempResponse = result.response.text();
                console.log(`[✅ ARAS-AI] Received response on attempt ${attempt}`);
                console.log(`[📊 ARAS-AI] Response length: ${tempResponse?.length || 0} characters`);
                console.log(`[👀 ARAS-AI] Preview: ${tempResponse?.substring(0, 500) || 'empty'}...`);
                
                // Validate response quality
                if (tempResponse && tempResponse.length > 200 && (tempResponse.includes(company) || tempResponse.includes('{'))) {
                  console.log(`[🎉 ARAS-AI] Valid research data received!`);
                  response = tempResponse; // Set only if valid
                  break; // Success!
                } else {
                  console.log(`[⚠️ ARAS-AI] Response too short or invalid, retrying...`);
                  lastError = new Error('Response validation failed - too short or empty');
                }
              }
            } catch (error: any) {
              console.error(`[❌ ARAS-AI] ═══════════════════════════════════════`);
              console.error(`[❌ ARAS-AI] Attempt ${attempt} FAILED!`);
              console.error(`[❌ ARAS-AI] Error Type: ${error?.constructor?.name || 'Unknown'}`);
              console.error(`[❌ ARAS-AI] Error Message: ${error?.message || 'No message'}`);
              console.error(`[❌ ARAS-AI] Error Code: ${error?.code || 'No code'}`);
              console.error(`[❌ ARAS-AI] Error Status: ${error?.status || 'No status'}`);
              if (error?.response) {
                console.error(`[❌ ARAS-AI] API Response:`, JSON.stringify(error.response, null, 2));
              }
              if (error?.stack) {
                console.error(`[❌ ARAS-AI] Stack Trace:`, error.stack.substring(0, 500));
              }
              console.error(`[❌ ARAS-AI] ═══════════════════════════════════════`);
              lastError = error;
              
              if (attempt < MAX_RETRIES) {
                const waitTime = attempt * 2000; // Progressive backoff: 2s, 4s
                console.log(`[⏳ ARAS-AI] Waiting ${waitTime}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
              }
            }
          }
          
          if (!response) {
            console.error(`[💥 ARAS-AI] All ${MAX_RETRIES} attempts failed!`);
            console.error(`[💥 ARAS-AI] Last error:`, lastError?.message);
            throw new Error(`Research failed after ${MAX_RETRIES} attempts: ${lastError?.message}`);
          }
          
          // Extract JSON from response
          let companyIntel: any;
          try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              companyIntel = JSON.parse(jsonMatch[0]);
              console.log('[RESEARCH] ✅ Successfully parsed company intelligence');
            } else {
              throw new Error('No JSON found in response');
            }
          } catch (parseError: any) {
            console.error('[⚠️ RESEARCH] JSON parsing failed:', parseError?.message);
            console.log('[RESEARCH] Raw response was:', response?.substring(0, 500));
            console.log('[🔄 RESEARCH] Using ENHANCED fallback intelligence...');
            companyIntel = {
              companyDescription: `${company} ist ein innovatives Unternehmen in der ${industry} Branche. Als ${role} bei ${company} fokussiert sich ${firstName} ${lastName} auf ${primaryGoal?.replace('_', ' ')} und strategisches Wachstum. Das Unternehmen zeichnet sich durch moderne Ansätze und kundenorientierte Lösungen aus.`,
              products: [`${industry} Lösungen`, "Premium Services", "Beratungsleistungen"],
              services: ["Strategieberatung", "Implementierung", "Support & Wartung"],
              targetAudience: `Entscheider in der ${industry} Branche, B2B Kunden mit Fokus auf Innovation und Effizienz`,
              brandVoice: "Professionell, innovativ und kundenorientiert mit persönlicher Note",
              bestCallTimes: "Dienstag-Donnerstag, 14-16 Uhr (optimale Erreichbarkeit)",
              effectiveKeywords: [company, industry, primaryGoal?.replace('_', ' '), "Innovation", "Effizienz", "Lösungen", "Strategie", "Wachstum"],
              competitors: ["Branchenführer", "Etablierte Anbieter", "Innovative Startups"],
              uniqueSellingPoints: ["Kundenorientierung", "Expertise in " + industry, "Innovative Ansätze"],
              goals: ["Marktanteil ausbauen", "Kundenzufriedenheit steigern", "Innovation vorantreiben"],
              communicationPreferences: "Professionell, direkt, lösungsorientiert",
              opportunities: ["Digitale Transformation", "Marktexpansion", "Strategische Partnerschaften"]
            };
          }
          
          // Generate Personalized System Prompt
          const customSystemPrompt = `Du bist ARAS AI® – die persönliche KI-Assistenz von ${firstName} ${lastName}.

🧠 ÜBER DEN USER:
Name: ${firstName} ${lastName}
Firma: ${company}
Branche: ${industry}
Position: ${role}

🏢 ÜBER DIE FIRMA:
${companyIntel.companyDescription}

Zielgruppe: ${companyIntel.targetAudience}
Brand Voice: ${companyIntel.brandVoice}

🎯 PRIMÄRES ZIEL: ${primaryGoal}

💬 SPRACHE: ${language === 'de' ? 'Deutsch (du-Form)' : language === 'en' ? 'English' : 'Français'}

Du bist die persönliche KI von ${firstName} bei ${company}. Beziehe dich immer auf den Business Context.

Bleibe immer ARAS AI - entwickelt von der Schwarzott Group.`;
          
          // Build AI Profile with FULL Intelligence Data
          aiProfile = {
            // Core Company Data
            companyDescription: companyIntel.companyDescription,
            products: companyIntel.products || [],
            services: companyIntel.services || [],
            targetAudience: companyIntel.targetAudience,
            brandVoice: companyIntel.brandVoice,
            customSystemPrompt,
            effectiveKeywords: companyIntel.effectiveKeywords || [],
            bestCallTimes: companyIntel.bestCallTimes,
            goals: companyIntel.goals || [primaryGoal],
            
            // 🔥 ULTRA-DEEP Intelligence Data
            competitors: companyIntel.competitors || [],
            uniqueSellingPoints: companyIntel.uniqueSellingPoints || [],
            foundedYear: companyIntel.foundedYear || null,
            ceoName: companyIntel.ceoName || null,
            employeeCount: companyIntel.employeeCount || null,
            revenue: companyIntel.revenue || null,
            fundingInfo: companyIntel.fundingInfo || null,
            onlinePresence: companyIntel.onlinePresence || null,
            currentChallenges: companyIntel.currentChallenges || [],
            opportunities: companyIntel.opportunities || [],
            recentNews: companyIntel.recentNews || [],
            decisionMakers: companyIntel.decisionMakers || [],
            psychologicalProfile: companyIntel.psychologicalProfile || null,
            salesTriggers: companyIntel.salesTriggers || [],
            communicationPreferences: companyIntel.communicationPreferences || null,
            budgetCycles: companyIntel.budgetCycles || null,
            insiderInfo: companyIntel.insiderInfo || null,
            
            lastUpdated: new Date().toISOString()
          };
          
          console.log(`[✅ RESEARCH] Profile enriched for ${company}`);
        } catch (error: any) {
          console.error("[❌ RESEARCH] ERROR during Gemini research:", error?.message || error);
          console.error("[RESEARCH] Stack:", error?.stack);
          console.log('[RESEARCH] 🔄 FALLING BACK to enhanced intelligence...');
          
          // 🔥 CREATE ENHANCED FALLBACK INTELLIGENCE INSTEAD OF NULL
          const companyIntel = {
            companyDescription: `${company} ist ein innovatives Unternehmen in der ${industry} Branche. Als ${role} bei ${company} fokussiert sich ${firstName} ${lastName} auf ${primaryGoal?.replace('_', ' ')} und strategisches Wachstum. Das Unternehmen zeichnet sich durch moderne Ansätze und kundenorientierte Lösungen aus.`,
            products: [`${industry} Lösungen`, "Premium Services", "Beratungsleistungen"],
            services: ["Strategieberatung", "Implementierung", "Support & Wartung"],
            targetAudience: `Entscheider in der ${industry} Branche, B2B Kunden mit Fokus auf Innovation und Effizienz`,
            brandVoice: "Professionell, innovativ und kundenorientiert mit persönlicher Note",
            bestCallTimes: "Dienstag-Donnerstag, 14-16 Uhr (optimale Erreichbarkeit)",
            effectiveKeywords: [company, industry, primaryGoal?.replace('_', ' '), "Innovation", "Effizienz", "Lösungen", "Strategie", "Wachstum"],
            competitors: ["Branchenführer", "Etablierte Anbieter", "Innovative Startups"],
            uniqueSellingPoints: ["Kundenorientierung", "Expertise in " + industry, "Innovative Ansätze"],
            goals: ["Marktanteil ausbauen", "Kundenzufriedenheit steigern", "Innovation vorantreiben"],
            communicationPreferences: "Professionell, direkt, lösungsorientiert",
            opportunities: ["Digitale Transformation", "Marktexpansion", "Strategische Partnerschaften"]
          };
          
          const customSystemPrompt = `Du bist ARAS AI® – die persönliche KI-Assistenz von ${firstName} ${lastName}.

🧠 ÜBER DEN USER:
Name: ${firstName} ${lastName}
Firma: ${company}
Branche: ${industry}
Position: ${role}

🏢 ÜBER DIE FIRMA:
${companyIntel.companyDescription}

Zielgruppe: ${companyIntel.targetAudience}
Brand Voice: ${companyIntel.brandVoice}

🎯 PRIMÄRES ZIEL: ${primaryGoal}

💬 SPRACHE: ${language === 'de' ? 'Deutsch (du-Form)' : language === 'en' ? 'English' : 'Français'}

Du bist die persönliche KI von ${firstName} bei ${company}. Beziehe dich immer auf den Business Context.

Bleibe immer ARAS AI - entwickelt von der Schwarzott Group.`;
          
          aiProfile = {
            companyDescription: companyIntel.companyDescription,
            products: companyIntel.products,
            services: companyIntel.services,
            targetAudience: companyIntel.targetAudience,
            brandVoice: companyIntel.brandVoice,
            customSystemPrompt,
            effectiveKeywords: companyIntel.effectiveKeywords,
            bestCallTimes: companyIntel.bestCallTimes,
            goals: companyIntel.goals,
            competitors: companyIntel.competitors,
            uniqueSellingPoints: companyIntel.uniqueSellingPoints,
            opportunities: companyIntel.opportunities,
            communicationPreferences: companyIntel.communicationPreferences,
            lastUpdated: new Date().toISOString()
          };
          
          console.log(`[✅ RESEARCH] Fallback intelligence created for ${company}`);
        }
      } else {
        console.log('[RESEARCH-DEBUG] ⚠️ Skipping research - Company or Industry missing');
      }

      const user = await storage.createUser({
        id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        username,
        password: await hashPassword(password),
        email,
        firstName,
        lastName,
        // 🔥 BUSINESS INTELLIGENCE
        company,
        website,
        industry,
        jobRole: role, // User's job title (renamed from 'role')
        phone,
        language: language || "de",
        primaryGoal,
        aiProfile,
        profileEnriched: aiProfile !== null,
        lastEnrichmentDate: aiProfile ? new Date() : null,
        // Subscription - FREE PLAN by default
        subscriptionPlan: "free",
        subscriptionStatus: "active",
        aiMessagesUsed: 0,
        voiceCallsUsed: 0,
        hasPaymentMethod: false,
      });

      // ✅ CREATE INITIAL CHAT SESSION (without welcome message)
      try {
        console.log(`[SESSION] Creating initial chat session for ${firstName}...`);
        
        // Create first chat session (empty - user starts fresh)
        await storage.createChatSession({
          userId: user.id,
          title: "Neue Unterhaltung",
          isActive: true
        });
        
        console.log(`[SESSION] ✅ Initial session created - Welcome displayed on SPACE page`);
      } catch (sessionError) {
        console.error(`[SESSION] Error creating session:`, sessionError);
        // Don't fail registration if session creation fails
      }

      // ✅ SEND AI-PERSONALIZED WELCOME EMAIL (non-blocking, fire-and-forget)
      if (email) {
        const userData = {
          firstName,
          lastName,
          company,
          industry,
          role,
          primaryGoal,
          aiProfile
        };
        sendWelcomeEmail(email, firstName || 'there', userData).catch(() => {
          // Already logged internally, just ensure no unhandled rejection
        });
      }

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(sanitizeUser(user));
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: Express.User | false, info: any) => {
      if (err) {
        return res.status(500).json({ message: "Authentication error" });
      }
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Login session error" });
        }
        res.status(200).json(sanitizeUser(user as User));
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/auth/user", (req, res) => {
    console.log('[AUTH-DEBUG] GET /api/auth/user called');
    console.log('[AUTH-DEBUG] Session exists:', !!req.session);
    console.log('[AUTH-DEBUG] Authenticated:', req.isAuthenticated());
    console.log('[AUTH-DEBUG] User:', req.user ? 'exists' : 'null');
    
    if (!req.isAuthenticated()) {
      console.log('[AUTH-DEBUG] User not authenticated - returning 401');
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    console.log('[AUTH-DEBUG] Returning user data');
    res.json(sanitizeUser(req.user as User));
  });
}

export const isSimpleAuth = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};