import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual, createHash } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import type { User } from "@shared/schema";
import { sanitizeUser, type EnrichmentStatus, type EnrichmentErrorCode } from "@shared/schema";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { sendWelcomeEmail } from "./email";
import { sendPasswordResetEmail, sendPasswordChangedEmail } from "./email-service";
import { triggerEnrichmentAsync, type EnrichmentInput } from "./services/enrichment.service";

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

// 🔥 QUALITY GATE: Check if enrichment result is actually valuable
// Returns true if at least 2 of these criteria are met
function isEnrichmentValid(profile: any): boolean {
  if (!profile) return false;
  
  let score = 0;
  
  // Check companyDescription length >= 120
  if (profile.companyDescription && profile.companyDescription.length >= 120) score++;
  
  // Check products length >= 2
  if (Array.isArray(profile.products) && profile.products.length >= 2) score++;
  
  // Check services length >= 2
  if (Array.isArray(profile.services) && profile.services.length >= 2) score++;
  
  // Check uniqueSellingPoints length >= 2
  if (Array.isArray(profile.uniqueSellingPoints) && profile.uniqueSellingPoints.length >= 2) score++;
  
  // Check competitors length >= 2
  if (Array.isArray(profile.competitors) && profile.competitors.length >= 2) score++;
  
  // Check targetAudience length >= 40
  if (profile.targetAudience && profile.targetAudience.length >= 40) score++;
  
  return score >= 2;
}

// 🔥 BUILD FALLBACK PROFILE: Generic profile when enrichment fails
function buildFallbackProfile(params: {
  company: string;
  industry: string;
  role: string;
  firstName: string;
  lastName: string;
  primaryGoal: string;
  language: string;
  errorCode: EnrichmentErrorCode;
}) {
  const { company, industry, role, firstName, lastName, primaryGoal, language, errorCode } = params;
  
  const companyIntel = {
    companyDescription: `${company} ist ein innovatives Unternehmen in der ${industry} Branche. Als ${role} bei ${company} fokussiert sich das Team auf ${primaryGoal?.replace('_', ' ') || 'strategisches Wachstum'}. Das Unternehmen zeichnet sich durch moderne Ansätze und kundenorientierte Lösungen aus.`,
    products: [`${industry} Lösungen`, "Premium Services", "Beratungsleistungen"],
    services: ["Strategieberatung", "Implementierung", "Support & Wartung"],
    targetAudience: `Entscheider in der ${industry} Branche, B2B Kunden mit Fokus auf Innovation und Effizienz`,
    brandVoice: "Professionell, innovativ und kundenorientiert mit persönlicher Note",
    bestCallTimes: "Dienstag-Donnerstag, 14-16 Uhr (optimale Erreichbarkeit)",
    effectiveKeywords: [company, industry, primaryGoal?.replace('_', ' ') || '', "Innovation", "Effizienz", "Lösungen", "Strategie", "Wachstum"].filter(Boolean),
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

  const status: EnrichmentStatus = 'fallback';
  
  return {
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
    lastUpdated: new Date().toISOString(),
    enrichmentStatus: status,
    enrichmentErrorCode: errorCode
  };
}

export function setupSimpleAuth(app: Express) {
  const PostgresSessionStore = connectPg(session);
  const sessionStore = new PostgresSessionStore({
    pool,
    createTableIfMissing: true,
    tableName: "sessions",
  });

  // ============================================================================
  // PRODUCTION COOKIE FIX: Domain must include leading dot for www + non-www
  // ============================================================================
  const IS_PRODUCTION = process.env.NODE_ENV === 'production';
  const COOKIE_DOMAIN = IS_PRODUCTION ? '.plattform-aras.ai' : undefined;
  
  // SESSION_SECRET must be set in production (Render ENV)
  const SESSION_SECRET = process.env.SESSION_SECRET;
  if (IS_PRODUCTION && !SESSION_SECRET) {
    console.error('[AUTH] ❌ FATAL: SESSION_SECRET env var is required in production!');
    console.error('[AUTH] Set it in Render Environment Variables.');
    // Use fallback but warn loudly
  }
  
  const sessionSettings: session.SessionOptions = {
    secret: SESSION_SECRET || "aras-ai-dev-secret-local-only",
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      httpOnly: true,
      secure: IS_PRODUCTION, // true in production (HTTPS required)
      sameSite: 'lax', // Prevents CSRF, works with same-site requests
      path: '/',
      domain: COOKIE_DOMAIN, // .plattform-aras.ai works for www and non-www
    },
  };
  
  console.log(`[AUTH] Cookie config: secure=${IS_PRODUCTION}, domain=${COOKIE_DOMAIN || 'localhost'}, sameSite=lax`);
  console.log(`[AUTH] SESSION_SECRET: ${SESSION_SECRET ? 'SET (from ENV)' : 'NOT SET (using fallback)'}`);

  // NOTE: trust proxy and canonical redirect are now in server/index.ts (runs first)
  
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());
  
  // ============================================================================
  // PUBLIC HEALTH ENDPOINT: Returns 200 always (for diagnostics)
  // ============================================================================
  app.get('/api/health', (req, res) => {
    const cookies = req.headers.cookie;
    const cookieNames = cookies ? cookies.split(';').map(c => c.trim().split('=')[0]) : [];
    
    res.status(200).json({
      ok: !!req.isAuthenticated?.(),
      env: process.env.NODE_ENV || 'development',
      host: req.hostname,
      xForwardedHost: req.headers['x-forwarded-host'] || null,
      xForwardedProto: req.headers['x-forwarded-proto'] || null,
      cookieHeaderPresent: !!cookies,
      cookieNames,
      hasSession: !!req.session,
      sessionId: req.session?.id ? req.session.id.substring(0, 8) + '...' : null,
      isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : false,
      user: req.user ? {
        id: (req.user as any).id,
        username: (req.user as any).username,
        role: (req.user as any).userRole || 'user'
      } : null,
      time: new Date().toISOString(),
      cookieDomain: COOKIE_DOMAIN || 'not set (localhost)',
      sessionSecretSet: !!SESSION_SECRET,
    });
  });
  console.log('[AUTH] ✅ Public health endpoint registered at /api/health');

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        }
        // Block disabled accounts
        if (user.subscriptionStatus === 'disabled') {
          return done(null, false, { message: 'Account disabled. Please contact support.' });
        }
        return done(null, user);
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
        company, website, industry, role, phone, language, primaryGoal,
        noWebsite  // 🔥 STEP 4A: "I don't have a website" flag
      } = req.body;
      
      // 🔥 DEBUG: Log ALL received fields (NO PII)
      console.log('[REGISTER-DEBUG] Received registration data:', {
        hasUsername: !!username, hasEmail: !!email, hasFirstName: !!firstName, hasLastName: !!lastName,
        hasCompany: !!company, hasWebsite: !!website, hasIndustry: !!industry, hasRole: !!role, 
        hasPhone: !!phone, language, hasPrimaryGoal: !!primaryGoal, noWebsite: !!noWebsite
      });
      
      // 🔥 STEP 4A: Phone required validation (plausible format, min 8 chars)
      const trimmedPhone = phone?.trim() || '';
      if (!trimmedPhone || trimmedPhone.length < 8) {
        console.log('[REGISTER-DEBUG] Phone validation failed:', { length: trimmedPhone.length });
        return res.status(400).json({ message: "Telefonnummer ist erforderlich (mindestens 8 Zeichen)" });
      }
      
      // 🔥 STEP 4A: Website consistency - if noWebsite is true, store null
      const finalWebsite = noWebsite === true ? null : (website?.trim() || null);
      
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

      // 🔥 STEP 5: ASYNC ENRICHMENT - Create user immediately, enrich asynchronously
      // 📊 STRUCTURED LOG: register.start (NO PII - only booleans/counts)
      console.log('[register.start]', JSON.stringify({
        timestamp: new Date().toISOString(),
        hasCompany: !!company,
        hasIndustry: !!industry,
        hasWebsite: !!website,
        hasPhone: !!phone,
        language: language || 'de',
        hasPrimaryGoal: !!primaryGoal,
        willAttemptEnrichment: !!(company && industry)
      }));
      
      // 🔥 Create initial "queued" fallback profile (enrichment runs async after user creation)
      let aiProfile: any = null;
      let enrichmentWasSuccessful = false;
      
      if (company && industry) {
        // Build initial queued profile
        aiProfile = {
          companyDescription: `${company} ist ein Unternehmen in der ${industry} Branche.`,
          products: [],
          services: [],
          targetAudience: `Kunden in der ${industry} Branche`,
          brandVoice: "Professionell",
          customSystemPrompt: `Du bist ARAS AI® – die persönliche KI-Assistenz von ${firstName} ${lastName} bei ${company}.`,
          effectiveKeywords: [company, industry].filter(Boolean),
          bestCallTimes: null,
          goals: [primaryGoal].filter(Boolean),
          competitors: [],
          uniqueSellingPoints: [],
          lastUpdated: new Date().toISOString(),
          enrichmentStatus: 'fallback' as const,
          enrichmentErrorCode: null,
          enrichmentMeta: {
            status: 'queued',
            errorCode: null,
            lastUpdated: new Date().toISOString(),
            attempts: 0,
            nextRetryAt: null,
            confidence: null
          }
        };
        console.log('[register.enrich.queued] Enrichment will run asynchronously');
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
        website: finalWebsite,  // 🔥 STEP 4A: Use finalWebsite (null if noWebsite=true)
        industry,
        jobRole: role, // User's job title (renamed from 'role')
        phone: trimmedPhone,  // 🔥 STEP 4A: Use trimmed phone
        language: language || "de",
        primaryGoal,
        aiProfile,
        profileEnriched: enrichmentWasSuccessful, // ✅ Only true if REAL enrichment worked
        lastEnrichmentDate: enrichmentWasSuccessful ? new Date() : null,
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

      // ✅ SEND WELCOME EMAIL (non-blocking, fire-and-forget)
      if (email) {
        sendWelcomeEmail(email, firstName || undefined).catch(() => {
          // Already logged internally, just ensure no unhandled rejection
        });
      }

      // 🔥 STEP 5: ASYNC ENRICHMENT TRIGGER (non-blocking)
      if (company && industry) {
        // Set initial enrichment state BEFORE triggering async job
        // so frontend polling immediately sees "queued" instead of null
        try {
          await storage.updateUserProfile(user.id, {
            aiProfile: {
              ...(user.aiProfile || {}),
              enrichmentMeta: {
                status: 'queued',
                attempts: 0,
                lastUpdated: new Date().toISOString(),
                errorCode: null,
                nextRetryAt: null,
                confidence: null
              }
            },
            profileEnriched: false
          });
        } catch (dbErr: any) {
          console.error('[register.enrich.init] Failed to set initial state:', dbErr?.message);
        }

        const enrichmentInput: EnrichmentInput = {
          userId: user.id,
          company,
          industry,
          role: role || '',
          website: finalWebsite,
          phone: trimmedPhone,
          language: language || 'de',
          primaryGoal: primaryGoal || '',
          firstName: firstName || '',
          lastName: lastName || '',
          email: email || undefined
        };
        triggerEnrichmentAsync(enrichmentInput);
        console.log('[register.enrich.triggered] Async enrichment job started for user:', user.id);
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
        const isDisabled = info?.message?.toLowerCase().includes('disabled');
        return res.status(401).json({
          ok: false,
          code: isDisabled ? 'ACCOUNT_DISABLED' : 'INVALID_CREDENTIALS',
          message: info?.message || "Invalid username or password",
        });
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

  // ============================================================================
  // PASSWORD RESET ENDPOINTS (user-facing)
  // ============================================================================

  function hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  // POST /api/forgot-password — always 200 (no user enumeration)
  app.post("/api/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== 'string') {
        return res.status(200).json({ ok: true });
      }

      const trimmedEmail = email.trim().toLowerCase();
      console.log('[PASSWORD-RESET] Reset requested (no PII logged)');

      const user = await storage.getUserByEmail(trimmedEmail);

      if (user && user.email) {
        const rawToken = randomBytes(32).toString('hex');
        const tokenHash = hashToken(rawToken);
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 60 min

        await storage.setPasswordResetToken(user.id, tokenHash, expiresAt);

        const userName = user.firstName || user.username || 'Nutzer';
        sendPasswordResetEmail(user.email, userName, rawToken).catch(() => {
          console.error('[PASSWORD-RESET] Email send failed (non-fatal)');
        });

        console.log('[PASSWORD-RESET] Token generated and email queued');
      } else {
        console.log('[PASSWORD-RESET] No matching user (generic 200 returned)');
      }

      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error('[PASSWORD-RESET] Error in forgot-password:', error instanceof Error ? error.message : 'Unknown');
      return res.status(200).json({ ok: true });
    }
  });

  // GET /api/verify-reset-token?token=...
  app.get("/api/verify-reset-token", async (req, res) => {
    try {
      const rawToken = req.query.token as string;
      if (!rawToken || typeof rawToken !== 'string') {
        return res.status(200).json({ valid: false, message: 'Kein Token vorhanden' });
      }

      const tokenHash = hashToken(rawToken);
      const user = await storage.getUserByPasswordResetTokenHash(tokenHash);

      if (!user) {
        return res.status(200).json({ valid: false, message: 'Ung\u00fcltiger oder abgelaufener Link' });
      }

      if (!user.passwordResetExpiresAt || new Date() > new Date(user.passwordResetExpiresAt)) {
        return res.status(200).json({ valid: false, message: 'Dieser Link ist abgelaufen' });
      }

      if (user.passwordResetUsedAt) {
        return res.status(200).json({ valid: false, message: 'Dieser Link wurde bereits verwendet' });
      }

      return res.status(200).json({ valid: true });
    } catch (error) {
      console.error('[PASSWORD-RESET] Error verifying token:', error instanceof Error ? error.message : 'Unknown');
      return res.status(200).json({ valid: false, message: 'Fehler bei der \u00dcberpr\u00fcfung' });
    }
  });

  // POST /api/reset-password
  app.post("/api/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({ ok: false, error: 'invalid_or_expired' });
      }

      if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
        return res.status(400).json({ ok: false, error: 'password_too_short' });
      }

      const tokenHash = hashToken(token);
      const user = await storage.getUserByPasswordResetTokenHash(tokenHash);

      if (!user) {
        return res.status(400).json({ ok: false, error: 'invalid_or_expired' });
      }

      if (!user.passwordResetExpiresAt || new Date() > new Date(user.passwordResetExpiresAt)) {
        return res.status(400).json({ ok: false, error: 'invalid_or_expired' });
      }

      if (user.passwordResetUsedAt) {
        return res.status(400).json({ ok: false, error: 'invalid_or_expired' });
      }

      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUserProfile(user.id, { password: hashedPassword });
      await storage.markPasswordResetUsed(user.id);

      console.log('[PASSWORD-RESET] Password successfully reset');

      if (user.email) {
        const userName = user.firstName || user.username || 'Nutzer';
        sendPasswordChangedEmail(user.email, userName).catch(() => {});
      }

      return res.status(200).json({ ok: true, success: true });
    } catch (error) {
      console.error('[PASSWORD-RESET] Error resetting password:', error instanceof Error ? error.message : 'Unknown');
      return res.status(500).json({ ok: false, error: 'server_error' });
    }
  });
}

export const isSimpleAuth = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};