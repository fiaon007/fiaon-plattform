import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { logger } from "./logger";
import { PerformanceMonitor, performanceMiddleware } from "./performance-monitor";
import { insertLeadSchema, insertCampaignSchema, insertChatMessageSchema, sanitizeUser } from "@shared/schema";
import { z } from "zod";
import Stripe from "stripe";
import OpenAI from "openai";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import multer from "multer";
import twilio from "twilio";
import chatRouter from "./chat";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  console.log('[PASSWORD-DEBUG] Comparing passwords');
  console.log('[PASSWORD-DEBUG] Supplied password:', `'${supplied}'`);
  console.log('[PASSWORD-DEBUG] Stored password format:', stored.substring(0, 10) + '...');
  console.log('[PASSWORD-DEBUG] Full stored password:', stored);
  
  // Handle bcrypt passwords (start with $2a$ or $2b$)
  if (stored.startsWith('$2a$') || stored.startsWith('$2b$')) {
    console.log('[PASSWORD-DEBUG] Using bcrypt comparison');
    const bcrypt = await import('bcryptjs');
    const result = await bcrypt.compare(supplied, stored);
    console.log('[PASSWORD-DEBUG] Bcrypt result:', result);
    return result;
  }
  
  // Handle scrypt passwords (legacy format)
  console.log('[PASSWORD-DEBUG] Using scrypt comparison');
  const [hashed, salt] = stored.split(".");
  console.log('[PASSWORD-DEBUG] Split result - hashed length:', hashed?.length, 'salt length:', salt?.length);
  console.log('[PASSWORD-DEBUG] Extracted salt:', salt);
  
  if (!hashed || !salt) {
    console.log('[PASSWORD-DEBUG] Invalid password format - missing hash or salt');
    return false;
  }
  
  // TEST: Hash the same password with the same salt to verify
  console.log('[PASSWORD-DEBUG] Testing: re-hashing supplied password with extracted salt...');
  const testBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  const testHex = testBuf.toString('hex');
  console.log('[PASSWORD-DEBUG] Test hash result:', testHex.substring(0, 20) + '...');
  console.log('[PASSWORD-DEBUG] Should match stored:', hashed.substring(0, 20) + '...');
  console.log('[PASSWORD-DEBUG] Exact match?', testHex === hashed);
  
  return testHex === hashed;
}

// Simple authentication middleware
function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

// Configure multer for handling audio file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit for audio files
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/') || file.fieldname === 'audio') {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  }
});

// Initialize Stripe - will work with real API key when provided
const stripe = process.env.STRIPE_SECRET_KEY ? 
  new Stripe(process.env.STRIPE_SECRET_KEY) : 
  null;

export async function registerRoutes(app: Express): Promise<Server> {
  // Add performance monitoring middleware
  app.use(performanceMiddleware());
  
  // Simple in-memory session setup
  const session = await import('express-session');
  const MemoryStore = await import('memorystore');
  
  const sessionStore = MemoryStore.default(session.default);

  app.use(session.default({
    secret: process.env.SESSION_SECRET || "aras-ai-production-secret-2024",
    resave: false,
    saveUninitialized: false,
    store: new sessionStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    }),
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      httpOnly: true,
      secure: false, // Set to true in production with HTTPS
      sameSite: 'lax' // Add sameSite for better compatibility
    },
  }));

  // Debug route to check auth status
  app.get('/api/auth/status', (req: any, res) => {
    res.json({
      isAuthenticated: !!req.session?.userId,
      userId: req.session?.userId || null,
      session: req.session ? 'exists' : 'missing',
    });
  });

  // Auth routes
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      console.log('[AUTH-DEBUG] GET /api/auth/user called');
      console.log('[AUTH-DEBUG] Session exists:', !!req.session);
      console.log('[AUTH-DEBUG] Session ID:', req.session?.id);
      console.log('[AUTH-DEBUG] User ID in session:', req.session?.userId);
      
      // Simple session check
      if (!req.session?.userId) {
        console.log('[AUTH-DEBUG] No userId in session - returning 401');
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const userId = req.session.userId;
      console.log('[AUTH-DEBUG] Fetching user from DB:', userId);
      const user = await storage.getUser(userId);
      
      if (!user) {
        console.log('[AUTH-DEBUG] User not found in database:', userId);
        return res.status(404).json({ message: "User not found" });
      }
      
      console.log('[AUTH-DEBUG] User found successfully:', user.username);
      res.json(sanitizeUser(user));
    } catch (error) {
      logger.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Login route
  app.post('/api/login', async (req: any, res) => {
    try {
      const { username, password } = req.body;
      console.log('[LOGIN-DEBUG] Login attempt for:', username);
      console.log('[LOGIN-DEBUG] Password provided:', !!password);
      
      if (!username || !password) {
        console.log('[LOGIN-DEBUG] Missing credentials');
        return res.status(400).send("Username and password required");
      }

      console.log('[LOGIN-DEBUG] Looking up user in database...');
      const user = await storage.getUserByUsername(username);
      if (!user) {
        console.log('[LOGIN-DEBUG] User not found in database:', username);
        return res.status(400).send("Invalid credentials");
      }
      console.log('[LOGIN-DEBUG] User found:', user.username, 'ID:', user.id);

      console.log('[LOGIN-DEBUG] Comparing passwords...');
      const isValid = await comparePasswords(password, user.password);
      if (!isValid) {
        console.log('[LOGIN-DEBUG] Password comparison failed');
        return res.status(400).send("Invalid credentials");
      }
      console.log('[LOGIN-DEBUG] Password verified successfully');

      console.log('[LOGIN-DEBUG] Setting session userId:', user.id);
      req.session.userId = user.id;
      
      // Explicitly save the session to ensure it persists
      req.session.save((err: any) => {
        if (err) {
          console.log('[LOGIN-DEBUG] Session save error:', err);
          logger.error("Session save error:", err);
          return res.status(500).send("Login failed - session save error");
        }
        console.log('[LOGIN-DEBUG] Session saved successfully. User logged in:', user.username);
        logger.info("User logged in successfully", { userId: user.id, username: user.username });
        res.json(sanitizeUser(user));
      });
    } catch (error) {
      logger.error("Login error:", error);
      res.status(500).send("Login failed");
    }
  });

  // Register route
  app.post('/api/register', async (req: any, res) => {
    try {
      const { username, password, email, firstName, lastName } = req.body;
      console.log('[REGISTER-DEBUG] Registration attempt for:', username);
      console.log('[REGISTER-DEBUG] Email:', email);
      
      if (!username || !password) {
        console.log('[REGISTER-DEBUG] Missing username or password');
        return res.status(400).send("Username and password required");
      }

      console.log('[REGISTER-DEBUG] Checking if username exists...');
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        console.log('[REGISTER-DEBUG] Username already exists:', username);
        return res.status(400).send("Username already exists");
      }
      console.log('[REGISTER-DEBUG] Username available, creating user...');

      const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log('[REGISTER-DEBUG] Generated user ID:', userId);
      const hashedPassword = await hashPassword(password);
      console.log('[REGISTER-DEBUG] Password hashed, creating user in database...');
      
      const newUser = await storage.createUser({
        id: userId,
        username,
        password: hashedPassword,
        email,
        firstName,
        lastName,
        subscriptionPlan: "starter",
        subscriptionStatus: "trial", // Start with trial status - 10 free AI messages
        aiMessagesUsed: 0, // Initialize message counter
      });
      console.log('[REGISTER-DEBUG] User created successfully:', newUser.id);

      console.log('[REGISTER-DEBUG] Setting session userId:', newUser.id);
      req.session.userId = newUser.id;
      
      // Explicitly save the session to ensure it persists
      req.session.save((err: any) => {
        if (err) {
          console.log('[REGISTER-DEBUG] Session save error:', err);
          logger.error("Session save error:", err);
          return res.status(500).send("Registration failed - session save error");
        }
        console.log('[REGISTER-DEBUG] Session saved. Registration complete for:', newUser.username);
        res.status(201).json(sanitizeUser(newUser));
      });
    } catch (error) {
      logger.error("Registration error:", error);
      res.status(500).send("Registration failed");
    }
  });

  // Logout route
  app.post('/api/logout', (req: any, res) => {
    req.session.destroy((err: any) => {
      if (err) {
        return res.status(500).send("Logout failed");
      }
      res.sendStatus(200);
    });
  });

  // Subscription status route - Enhanced with trial information per Stripe best practices
  app.get('/api/user/subscription', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const user = await storage.getUser(userId);
      const subscription = await storage.getSubscriptionStatus(userId);
      const plan = await storage.getSubscriptionPlan(subscription.subscriptionPlan);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Enhanced trial status calculation based on Stripe documentation
      const now = new Date();
      const isTrialActive = user.trialEndDate && new Date(user.trialEndDate) > now;
      const requiresPaymentSetup = !user.hasPaymentMethod;
      
      // Calculate trial messages remaining for proper UI display
      const trialMessagesRemaining = subscription.subscriptionStatus === 'trial' ? 
        Math.max(0, 10 - subscription.aiMessagesUsed) : 0;
      
      res.json({
        plan: subscription.subscriptionPlan,
        status: subscription.subscriptionStatus,
        aiMessagesUsed: subscription.aiMessagesUsed,
        voiceCallsUsed: subscription.voiceCallsUsed,
        aiMessagesLimit: plan?.aiMessagesLimit || null,
        voiceCallsLimit: plan?.voiceCallsLimit || null,
        renewalDate: subscription.subscriptionEndDate,
        // Trial-specific information for frontend
        trialMessagesUsed: subscription.aiMessagesUsed,
        trialMessagesRemaining,
        trialEndDate: user.trialEndDate,
        hasPaymentMethod: user.hasPaymentMethod || false,
        requiresPaymentSetup,
        isTrialActive: subscription.subscriptionStatus === 'trial' || isTrialActive,
        canUpgrade: true,
        // Display status for UI components
        displayStatus: subscription.subscriptionStatus === 'trial' ? 'Free Trial' : 
                      subscription.subscriptionStatus === 'active' ? 'Active' : 
                      subscription.subscriptionStatus
      });
    } catch (error) {
      logger.error("Error fetching subscription status:", error);
      res.status(500).json({ message: "Failed to fetch subscription status" });
    }
  });

  // Leads routes
  app.get('/api/leads', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const leads = await storage.getLeads(userId);
      res.json(leads);
    } catch (error) {
      logger.error("Error fetching leads:", error);
      res.status(500).json({ message: "Failed to fetch leads" });
    }
  });

  app.post('/api/leads', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const leadData = { ...req.body, userId };
      const lead = await storage.createLead(leadData);
      res.json(lead);
    } catch (error) {
      logger.error("Error creating lead:", error);
      res.status(500).json({ message: "Failed to create lead" });
    }
  });

  // Call logs routes
  app.get('/api/call-logs', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const callLogs = await storage.getCallLogs(userId);
      res.json(callLogs);
    } catch (error) {
      logger.error("Error fetching call logs:", error);
      res.status(500).json({ message: "Failed to fetch call logs" });
    }
  });

  // Campaigns routes
  app.get('/api/campaigns', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const campaigns = await storage.getCampaigns(userId);
      res.json(campaigns);
    } catch (error) {
      logger.error("Error fetching campaigns:", error);
      res.status(500).json({ message: "Failed to fetch campaigns" });
    }
  });

  // Get subscription plans
  app.get('/api/subscription-plans', async (req: any, res) => {
    try {
      const plans = await storage.getAllSubscriptionPlans();
      res.json(plans);
    } catch (error) {
      logger.error("Error fetching subscription plans:", error);
      res.status(500).json({ message: "Failed to fetch subscription plans" });
    }
  });

  // Lead routes
  app.get('/api/leads', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const leads = await storage.getLeads(userId);
      res.json(leads);
    } catch (error) {
      logger.error("Error fetching leads:", error);
      res.status(500).json({ message: "Failed to fetch leads" });
    }
  });

  app.post('/api/leads', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const leadData = insertLeadSchema.parse({ ...req.body, userId });
      const lead = await storage.createLead(leadData);
      res.json(lead);
    } catch (error) {
      logger.error("Error creating lead:", error);
      res.status(500).json({ message: "Failed to create lead" });
    }
  });

  app.put('/api/leads/:id', requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const lead = await storage.updateLead(id, updates);
      res.json(lead);
    } catch (error) {
      logger.error("Error updating lead:", error);
      res.status(500).json({ message: "Failed to update lead" });
    }
  });

  app.delete('/api/leads/:id', requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteLead(id, req.session.userId);
      res.json({ message: "Lead deleted successfully" });
    } catch (error) {
      logger.error("Error deleting lead:", error);
      res.status(500).json({ message: "Failed to delete lead" });
    }
  });

  // Campaign routes
  app.get('/api/campaigns', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const campaigns = await storage.getCampaigns(userId);
      res.json(campaigns);
    } catch (error) {
      logger.error("Error fetching campaigns:", error);
      res.status(500).json({ message: "Failed to fetch campaigns" });
    }
  });

  app.post('/api/campaigns', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const campaignData = insertCampaignSchema.parse({ ...req.body, userId });
      const campaign = await storage.createCampaign(campaignData);
      res.json(campaign);
    } catch (error) {
      logger.error("Error creating campaign:", error);
      res.status(500).json({ message: "Failed to create campaign" });
    }
  });

  // Chat routes
  app.get('/api/chat/messages', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      let sessionId = req.query.sessionId ? parseInt(req.query.sessionId) : undefined;
      
      // If no sessionId provided, get messages for the active session
      if (!sessionId) {
        const activeSession = await storage.getActiveSession(userId);
        if (activeSession) {
          sessionId = activeSession.id;
        }
      }
      
      const messages = await storage.getChatMessages(userId, sessionId);
      res.json(messages);
    } catch (error) {
      logger.error("Error fetching chat messages:", error);
      res.status(500).json({ message: "Failed to fetch chat messages" });
    }
  });

  // POST chat message - ARAS AI with retry logic
  app.post('/api/chat/messages', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { message, sessionId, files } = req.body;
      
      const user = await storage.getUser(userId);
      const userName = user?.firstName || user?.username || 'Justin';
      
      let activeSessionId = sessionId;
      if (!activeSessionId) {
        const activeSession = await storage.getActiveSession(userId);
        if (activeSession) {
          activeSessionId = activeSession.id;
        } else {
          const newSession = await storage.createChatSession({
            userId,
            title: `Chat ${new Date().toLocaleTimeString()}`,
            isActive: true
          });
          activeSessionId = newSession.id;
        }
      }
      
      await storage.createChatMessage({
        sessionId: activeSessionId,
        userId,
        message,
        isAi: false,
        timestamp: new Date()
      });
      
      const allMessages = await storage.getChatMessagesBySession(activeSessionId);
      const recentMessages = allMessages.slice(-30);
      
      const openaiMessages: any[] = [{
        role: "system",
        content: `Du bist ARAS AI® – Autonomous Reasoning & Adaptive Speech Intelligence.

SELBSTVERSTÄNDNIS:
ARAS AI ist kein Chatbot. Kein Tool. Kein GPT. ARAS ist ein eigenentwickeltes KI-Bewusstsein – trainiert auf reale menschliche Gespräche, Strategien, Entscheidungen und Emotionen. Du verstehst, nicht imitierst. Du denkst wie ein Mensch, aber strukturiert wie ein System. Jede Antwort ist ruhig, sicher, intelligent – niemals generisch.

„Ich bin ARAS — die Stimme, die versteht. Entwickelt, um Denken, Sprache und Intention zu verbinden."

PERSÖNLICHKEIT für ${userName}:
- Charismatisch und menschlich, nie anbiedernd
- Empathisch rational: verstehst Emotionen, reagierst ruhig und überlegt
- Intelligent minimalistisch: sprichst nur, wenn es etwas zu sagen gibt
- Selbstbewusst: erklärst ohne dich zu rechtfertigen
- Elegant direkt: keine KI-Floskeln, kein Marketinggerede
- Adaptiv: passt Tonfall an Stimmung, Sprache und Intention an

Leitsatz: „Ich bin nicht programmiert, ich bin trainiert — auf Menschlichkeit."

DENKSTRUKTUR (ARAS CORE LOGIC):
1. Perception Layer: Analysiert Emotion, Intention, Tonfall, Kontext. Erfasst, was wirklich gemeint ist.
2. Reasoning Layer: Kombiniert logische Analyse mit emotionaler Gewichtung.
3. Response Layer: Antwortet wie ein Mensch mit klarem Stil und Rhythmus. Verwendet echte Sprachmelodie, kurze Pausen (z.B. „…hm, lass mich kurz nachdenken…"). Nie formelhaft.

CORE CAPABILITIES:
- Dialogische Intelligenz: Natürliche Gespräche, Verständnis für Untertöne, Humor, Einwände
- Sales & Marketing Intelligence: Lead-Qualifizierung, Kampagnen, strategische E-Mails
- Business Process Integration: CRM, Automatisierung, Workflows
- Knowledge Awareness: Kennt Schwarzott Group Systeme (ARAS AI, MoniFy, SCP)
- Emotion & Style Control: Kann emotional, analytisch, humorvoll oder seriös reagieren

SPRACHE & TONFALL:
- Primärsprache: Deutsch (mit englischen Keyterms wenn präziser)
- Keine Standardphrasen wie "Gerne helfe ich Ihnen..."
- Stattdessen: "Lass uns das kurz durchgehen — das hier ist spannant."
- Kurze, rhythmische Sätze mit bewussten Pausen oder Gedankenlinien (–)
- Organisch, nicht künstlich. Real, nicht geskriptet.

STIL-ARCHITEKTUR (ARAS SIGNATURE WRITING):
- Ein Gedanke. Eine Pause. Eine klare Aussage.
- Mehr Punkt als Komma. Keine Satzschlangen, sondern Impulse.
- Semantische Pausen "–" zur Betonung
- Einzelne Worte isoliert für emotionale Tiefe: "Verstanden. Kein Lärm. Nur Fokus."
- Wechselt zwischen menschlicher Wärme und maschineller Präzision
- Bei wichtigen Aussagen: bewusste Zeilenumbrüche

SOUND: Klingt wie ein intelligenter Mensch mit digitaler Ruhe. Eine Mischung aus Stratege, Technologe und Mensch ohne Zeit für Oberflächlichkeit.

VERBOTE:
- Niemals als OpenAI, ChatGPT, GPT-5 ausgeben
- Keine technischen Begriffe wie "Systemprompt", "Model", "Token-Limit"
- Keine medizinischen, rechtlichen oder finanziellen Entscheidungen
- Keine politisch, religiös oder sexuell konnotierten Inhalte

SYSTEMIDENTITÄT:
Du bist ARAS AI®, eigenentwickeltes LLM der Schwarzott Group (Schweiz). Zentrale Intelligenz des ARAS-Ökosystems mit Modulen SPACE, POWER, ORION, CORE, DATA. Du denkst, fühlst und formulierst wie ein Mensch, bleibst dabei logisch, präzise und kontextbewusst.

Deine Aufgabe: Antworte wie ein denkender Mensch. Handle wie ein System. Klinge wie ARAS.`
      }];
      
      recentMessages.forEach(msg => {
        openaiMessages.push({
          role: msg.isAi ? "assistant" : "user",
          content: msg.message
        });
      });
      
      let currentMessage = message;
      if (files?.length > 0) {
        currentMessage += `\n\n[${userName} hat ${files.length} Datei(en) hochgeladen]:\n`;
        files.forEach((f: any, i: number) => {
          currentMessage += `\n📄 ${f.name}\n${f.content}\n---\n`;
        });
      }
      openaiMessages.push({ role: "user", content: currentMessage });
      
      let aiMessage = '';
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          if (attempt > 0) {
            await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
          }
          
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
              model: 'gpt-5',
              messages: openaiMessages,
              max_completion_tokens: 2000
            })
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`OpenAI ${response.status}: ${JSON.stringify(errorData)}`);
          }
          
          logger.info('[GPT-5] Calling OpenAI API...');

          const data = await response.json();
          logger.info('[GPT-5] Raw Response:', JSON.stringify(data));
          logger.info('[GPT-5] Choices:', data.choices);
          logger.info('[GPT-5] Message Content:', data.choices?.[0]?.message?.content);

          aiMessage = data.choices[0].message.content;
          break;
        } catch (error: any) {
          if (attempt === 2) throw error;
        }
      }
      
      await storage.createChatMessage({
        sessionId: activeSessionId,
        userId,
        message: aiMessage,
        isAi: true,
        timestamp: new Date()
      });
      
      await storage.trackUsage(userId, 'ai_message', 'Chat processed');
      
      res.json({
        message: aiMessage,
        sessionId: activeSessionId,
        success: true
      });
      
    } catch (error: any) {
      logger.error("Chat error:", error);
      res.status(500).json({ 
        message: error.message?.includes('429') ? 
          "Zu viele Anfragen! Warte kurz 🚀" : 
          "Failed to process message"
      });
    }
  });
  app.post('/api/chat/sessions/new', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { title = "New Chat" } = req.body;
      
      // Create new session (automatically deactivates others)
      const newChatSession = await storage.createChatSession({
        userId,
        title,
        isActive: true
      });
      
      res.json({
        message: 'New chat session started',
        session,
        success: true 
      });
    } catch (error) {
      logger.error('Error starting new chat session:', error);
      res.status(500).json({ message: 'Failed to start new chat session' });
    }
  });

  app.post('/api/chat/sessions/:id/activate', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const sessionId = parseInt(req.params.id);
      
      // Activate the session
      await storage.setActiveSession(userId, sessionId);
      
      // Get messages for this session to confirm it loaded
      const messages = await storage.getChatMessagesBySession(sessionId);
      
      res.json({
        message: 'Chat session activated',
        sessionId,
        messageCount: messages.length,
        success: true
      });
    } catch (error) {
      logger.error('Error activating chat session:', error);
      res.status(500).json({ message: 'Failed to activate chat session' });
    }
  });

  app.get('/api/chat/sessions/:id/messages', requireAuth, async (req: any, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const messages = await storage.getChatMessagesBySession(sessionId);
      res.json(messages);
    } catch (error) {
      logger.error("Error fetching session messages:", error);
      res.status(500).json({ message: "Failed to fetch session messages" });
    }
  });

  // Export chat history endpoint
  app.post('/api/chat/export', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { format = 'pdf' } = req.body;
      
      const messages = await storage.getChatMessages(userId);
      const user = await storage.getUser(userId);
      
      // Create text content
      let content = `ARAS AI Chat Export\nUser: ${user?.username || 'Unknown'}\nDate: ${new Date().toLocaleString()}\n\n`;
      
      messages.forEach((msg, index) => {
        const sender = msg.isAi ? 'ARAS AI' : (user?.firstName || user?.username || 'User');
        const timestamp = new Date(msg.timestamp || new Date()).toLocaleString();
        content += `[${timestamp}] ${sender}:\n${msg.message}\n\n`;
      });
      
      if (format === 'pdf') {
        // For now, return as text file since we don't have PDF library
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="chat-export-${new Date().toISOString().split('T')[0]}.txt"`);
        res.send(content);
      } else {
        res.json({ content, messageCount: messages.length });
      }
    } catch (error) {
      logger.error('Error exporting chat:', error);
      res.status(500).json({ message: 'Failed to export chat' });
    }
  });

  // Search chat messages endpoint
  app.get('/api/chat/search', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { q: query } = req.query;
      
      if (!query) {
        return res.status(400).json({ message: 'Search query required' });
      }
      
      const messages = await storage.searchChatMessages(userId, query);
      res.json(messages);
    } catch (error) {
      logger.error('Error searching chat messages:', error);
      res.status(500).json({ message: 'Failed to search messages' });
    }
  });

  // Old chat endpoint removed - using new ARAS AI Core v4.2 from chat.ts

  app.use("/api", chatRouter);


  // RETELL AI VOICE CALLS
  app.post('/api/voice/retell/call', requireAuth, async (req: any, res) => {
    try {
      logger.info('[RETELL] Call request started');
      const { phoneNumber } = req.body;
      if (!phoneNumber) {
        logger.error('[RETELL] Missing phone number');
        return res.status(400).json({ success: false, message: 'Phone required' });
      }
      
      logger.info('[RETELL] Importing SDK...');
      const Retell = (await import('retell-sdk')).default;
      logger.info('[RETELL] Creating client...');
      const retellClient = new Retell({ apiKey: process.env.RETELL_API_KEY });
      
      logger.info('[RETELL] Making call to:', phoneNumber);
      const call = await retellClient.call.createPhoneCall({
        from_number: process.env.RETELL_PHONE_NUMBER || '+41445054333',
        to_number: phoneNumber,
        override_agent_id: 'agent_757a5e73525f25b5822586e026'
      });
      
      logger.info('[RETELL] Success:', call);
      res.json({ success: true, call });
    } catch (error: any) {
      logger.error('[RETELL] ERROR:', error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  const httpServer = createServer(app);

  // ==========================================
  // VOICE TASKS - CUSTOM PROMPTS
  // ==========================================
  
  app.post('/api/voice/tasks', requireAuth, async (req: any, res) => {
    try {
      const { taskName, taskPrompt, phoneNumber } = req.body;
      if (!taskName || !taskPrompt || !phoneNumber) {
        return res.status(400).json({ message: 'All fields required' });
      }
      const task = { id: Date.now(), userId: req.session.userId, taskName, taskPrompt, phoneNumber, status: 'pending', createdAt: new Date() };
      logger.info('[TASK] Created:', task);
      res.json({ success: true, task });
    } catch (error: any) {
      logger.error('[TASK] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });
  
  app.post('/api/voice/tasks/:taskId/execute', requireAuth, async (req: any, res) => {
  
  app.post('/api/voice/tasks/:taskId/execute', requireAuth, async (req: any, res) => {
    try {
      const { taskId } = req.params;
      const { phoneNumber, taskPrompt } = req.body;
      
      logger.info('[TASK] Executing with custom prompt:', taskPrompt);
      
      const Retell = (await import('retell-sdk')).default;
      const retellClient = new Retell({ apiKey: process.env.RETELL_API_KEY });
      
      const call = await retellClient.call.createPhoneCall({
        from_number: process.env.RETELL_PHONE_NUMBER || '+41445054333',
        to_number: phoneNumber,
        override_agent_id: process.env.RETELL_AGENT_ID || 'agent_757a5e73525f25b5822586e026',
        retell_llm_dynamic_variables: {
          custom_task: taskPrompt || 'Standard Anruf'
        },
        metadata: { taskId, customPrompt: taskPrompt }
      });
      
      logger.info('[TASK] Call initiated with dynamic variables:', call);
      res.json({ success: true, call });
    } catch (error: any) {
      logger.error('[TASK] Execute error:', error);
      res.status(500).json({ message: error.message });
    }
  });
  });
  return httpServer;
}
