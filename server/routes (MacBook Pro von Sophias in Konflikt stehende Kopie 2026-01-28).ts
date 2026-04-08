import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { client, db } from "./db";
import { campaigns, chatMessages, chatSessions, contacts, calendarEvents, leads, subscriptionPlans, users, usageTracking, voiceAgents, callLogs, n8nEmailLogs } from "@shared/schema";
import { logger } from "./logger";
import { PerformanceMonitor, performanceMiddleware } from "./performance-monitor";
import { insertLeadSchema, insertCampaignSchema, insertChatMessageSchema, insertContactSchema, sanitizeUser } from "@shared/schema";
import { eq, and, desc, gte, lte, isNull } from "drizzle-orm";
import { z } from "zod";
import Stripe from "stripe";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import bcrypt from "bcryptjs";
import multer from "multer";
import twilio from "twilio";
import chatRouter from "./chat";
import dashboardRouter from "./routes/dashboard";
import callLogsRouter from "./routes/call-logs";
import aiRecommendationsRouter from "./routes/ai-recommendations";
import promptGeneratorRouter from "./routes/prompt-generator";
import arasLabRouter from "./routes/aras-lab";
import n8nAdminRouter from "./routes/n8n-admin";
import adminStaffRouter from "./routes/admin-staff";
import adminChatRouter, { seedDefaultChannel } from "./routes/admin-chat";
import adminExportRouter from "./routes/admin-export";
import adminActivityRouter from "./routes/admin-activity";
import adminSearchRouter from "./routes/admin-search";
import adminNotificationsRouter from "./routes/admin-notifications";
import adminUsersRouter from "./routes/admin-users";
import serviceOrdersRouter from "./routes/service-orders";
import { requireAdmin } from "./middleware/admin";
import { getKnowledgeDigest } from "./knowledge/context-builder";
import { checkCallLimit, checkMessageLimit } from "./middleware/usage-limits";
import { setupSimpleAuth } from "./simple-auth";
import { setupTranslationRoute } from "./translate-route";

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

// ========================================
// CANONICAL USER ID HELPER
// All routes MUST use this to get userId
// ========================================
function getAuthUserId(req: any): string | null {
  // Priority 1: Passport user object (most reliable)
  if (req.user?.id) {
    return req.user.id;
  }
  // Priority 2: Session userId (fallback)
  if (req.session?.userId) {
    return req.session.userId;
  }
  return null;
}

// Authentication middleware (Passport compatible)
function requireAuth(req: any, res: any, next: any) {
  console.log('[REQUIREAUTH] Checking authentication...');
  console.log('[REQUIREAUTH] isAuthenticated:', req.isAuthenticated ? req.isAuthenticated() : 'no method');
  console.log('[REQUIREAUTH] req.user?.id:', req.user?.id || 'null');
  console.log('[REQUIREAUTH] session.userId:', req.session?.userId);
  
  // Check if user is authenticated via Passport
  if (req.isAuthenticated && req.isAuthenticated()) {
    console.log('[REQUIREAUTH] ✅ Passport authenticated');
    // ALWAYS sync session.userId with req.user.id for consistency
    if (req.user?.id) {
      req.session.userId = req.user.id;
      req.session.username = req.user.username;
      console.log('[REQUIREAUTH] Synced session.userId =', req.user.id);
    }
    return next();
  }
  
  // Fallback: Check session-based auth
  if (req.session?.userId) {
    console.log('[REQUIREAUTH] ✅ Session authenticated');
    return next();
  }
  
  console.log('[REQUIREAUTH] ❌ Unauthorized - no valid auth found');
  return res.status(401).json({ message: "Unauthorized" });
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

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || "");

// Helper function to generate content with Gemini
async function generateWithGemini(prompt: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    const result = await model.generateContent(prompt);
    const response = result.response;
    return response.text();
  } catch (error) {
    logger.error('[GEMINI] Error generating content:', error);
    throw error;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Trust proxy - required for Render.com and other reverse proxies
  // This allows Express to trust the X-Forwarded-* headers
  app.set('trust proxy', 1);
  
  // Add performance monitoring middleware
  app.use(performanceMiddleware());
  
  // 🔥 Setup authentication with Business Intelligence support
  // This includes:
  // - PostgreSQL session store for persistence
  // - Passport authentication
  // - Enhanced registration with company research
  // - AI Profile generation
  setupSimpleAuth(app);

  // 🌍 Setup DeepL translation endpoint
  setupTranslationRoute(app);

  // 🔧 Setup Admin API Routes
  const adminRoutes = await import('./routes/admin');
  app.use('/api/admin', adminRoutes.default);

  // Debug route to check auth status
  app.get('/api/auth/status', (req: any, res) => {
    res.json({
      isAuthenticated: !!req.session?.userId,
      userId: req.session?.userId || null,
      session: req.session ? 'exists' : 'missing',
    });
  });

  // Auth routes handled by simple-auth.ts (passport authentication)

  // 🔥 Login route MOVED to simple-auth.ts with passport authentication
  // Using passport-local strategy for secure authentication

  // 🔥 Register route MOVED to simple-auth.ts with Business Intelligence support
  // Old basic registration endpoint removed - using the new enhanced version
  // See: server/simple-auth.ts for the new /api/register endpoint with:
  // - Business Intelligence fields (company, industry, role, etc.)
  // - AI Profile generation with Gemini
  // - Live company research
  // - Personalized system prompts

  // Logout route MOVED to simple-auth.ts

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

  // 🔥 NEW: Get user profile context for AI calls (company, industry, aiProfile)
  app.get('/api/user/profile-context', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Return sanitized profile context for AI enhancement
      return res.json({
        id: user.id,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
        firstName: user.firstName || null,
        lastName: user.lastName || null,
        company: user.company || null,
        website: user.website || null,
        industry: user.industry || null,
        jobRole: user.jobRole || null,
        phone: user.phone || null,
        aiProfile: user.aiProfile || null
      });
    } catch (error) {
      logger.error('[PROFILE-CONTEXT] Error loading user profile context:', error);
      return res.status(500).json({ 
        error: 'Failed to load profile context',
        message: 'Internal server error'
      });
    }
  });

  // Update AI Profile (Business Intelligence) - User can edit their business data
  app.patch('/api/user/ai-profile', requireAuth, async (req: any, res) => {
    try {
      const userId = getAuthUserId(req);
      if (!userId) {
        return res.status(401).json({ success: false, message: 'User ID not found' });
      }
      const { companyDescription, targetAudience, effectiveKeywords, competitors, services } = req.body;
      logger.info(`[AI_PROFILE] PATCH userId=${userId}`);

      // Get current user to merge with existing ai_profile data
      const [currentUser] = await client`
        SELECT ai_profile FROM users WHERE id = ${userId}
      `;

      // Merge new data with existing ai_profile
      const updatedAiProfile = {
        ...(currentUser?.ai_profile || {}),
        companyDescription: companyDescription || currentUser?.ai_profile?.companyDescription,
        targetAudience: targetAudience || currentUser?.ai_profile?.targetAudience,
        effectiveKeywords: effectiveKeywords && effectiveKeywords.length > 0 
          ? effectiveKeywords 
          : (currentUser?.ai_profile?.effectiveKeywords || []),
        competitors: competitors && competitors.length > 0 
          ? competitors 
          : (currentUser?.ai_profile?.competitors || []),
        services: services || currentUser?.ai_profile?.services,
      };

      // Convert to JSON and escape for raw SQL (bypass postgres.js limitations)
      const jsonString = JSON.stringify(updatedAiProfile).replace(/'/g, "''");

      // Update users table with merged ai_profile using unsafe for JSONB
      await client.unsafe(`
        UPDATE users
        SET 
          ai_profile = '${jsonString}'::jsonb,
          updated_at = NOW()
        WHERE id = '${userId}'
      `);

      logger.info(`✅ AI Profile updated for user ${userId}`);
      res.json({ success: true, message: 'AI Profile updated successfully' });
    } catch (error) {
      logger.error('❌ Error updating AI profile:', error);
      res.status(500).json({ message: 'Failed to update AI profile' });
    }
  });

  // ========================================
  // USER TASKS API (Dashboard Operations)
  // ========================================

  // GET /api/user/tasks - List user tasks with filters
  app.get('/api/user/tasks', requireAuth, async (req: any, res) => {
    try {
      const userId = getAuthUserId(req);
      if (!userId) {
        return res.status(401).json({ success: false, message: 'User ID not found' });
      }

      const { status, sourceType, sourceId, limit, sinceDays } = req.query;
      
      const tasks = await storage.listUserTasks(userId, {
        status: status as 'open' | 'done' | 'all' | undefined,
        sourceType: sourceType as 'call' | 'space' | 'manual' | undefined,
        sourceId: sourceId as string | undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        sinceDays: sinceDays ? parseInt(sinceDays as string, 10) : undefined,
      });

      res.json({ success: true, tasks });
    } catch (error: any) {
      logger.error('[TASKS] Error listing tasks:', error.message);
      res.status(500).json({ success: false, message: 'Failed to list tasks' });
    }
  });

  // POST /api/user/tasks - Create manual task
  app.post('/api/user/tasks', requireAuth, async (req: any, res) => {
    try {
      const userId = getAuthUserId(req);
      if (!userId) {
        return res.status(401).json({ success: false, message: 'User ID not found' });
      }

      const { title, dueAt, priority } = req.body;
      
      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({ success: false, message: 'Title is required' });
      }

      const task = await storage.createManualTask(
        userId,
        title.trim(),
        dueAt ? new Date(dueAt) : undefined,
        priority || 'medium'
      );

      res.json({ success: true, task });
    } catch (error: any) {
      logger.error('[TASKS] Error creating task:', error.message);
      res.status(500).json({ success: false, message: 'Failed to create task' });
    }
  });

  // POST /api/user/tasks/:taskId/done - Mark task as done/undone
  app.post('/api/user/tasks/:taskId/done', requireAuth, async (req: any, res) => {
    try {
      const userId = getAuthUserId(req);
      if (!userId) {
        return res.status(401).json({ success: false, message: 'User ID not found' });
      }

      const { taskId } = req.params;
      const { done } = req.body;

      const task = await storage.setTaskDone(userId, taskId, done === true);

      if (!task) {
        return res.status(404).json({ success: false, message: 'Task not found' });
      }

      res.json({ success: true, task });
    } catch (error: any) {
      logger.error('[TASKS] Error updating task status:', error.message);
      res.status(500).json({ success: false, message: 'Failed to update task status' });
    }
  });

  // POST /api/user/tasks/:taskId/snooze - Snooze task
  app.post('/api/user/tasks/:taskId/snooze', requireAuth, async (req: any, res) => {
    try {
      const userId = getAuthUserId(req);
      if (!userId) {
        return res.status(401).json({ success: false, message: 'User ID not found' });
      }

      const { taskId } = req.params;
      const { snoozedUntil } = req.body;

      const task = await storage.snoozeTask(
        userId,
        taskId,
        snoozedUntil ? new Date(snoozedUntil) : null
      );

      if (!task) {
        return res.status(404).json({ success: false, message: 'Task not found' });
      }

      res.json({ success: true, task });
    } catch (error: any) {
      logger.error('[TASKS] Error snoozing task:', error.message);
      res.status(500).json({ success: false, message: 'Failed to snooze task' });
    }
  });

  // POST /api/user/tasks/sync - Sync tasks from call/space summaries
  app.post('/api/user/tasks/sync', requireAuth, async (req: any, res) => {
    try {
      const userId = getAuthUserId(req);
      if (!userId) {
        return res.status(401).json({ success: false, message: 'User ID not found' });
      }

      const { windowDays = 30, maxItems = 80 } = req.body;
      
      // Import task extractor
      const { extractTasksFromNextStep, generateFingerprint } = await import('./tasks/task-extractor');

      let created = 0;
      let updated = 0;
      let skipped = 0;
      let scannedCalls = 0;
      let scannedSpaces = 0;

      // Get recent calls with summaries
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - windowDays);

      const calls = await client`
        SELECT id, metadata, contact_name, created_at
        FROM call_logs
        WHERE user_id = ${userId}
          AND created_at >= ${sinceDate}
        ORDER BY created_at DESC
        LIMIT ${maxItems}
      `;

      scannedCalls = calls.length;

      // Process calls
      for (const call of calls) {
        const summary = call.metadata?.summary;
        if (!summary?.nextStep) continue;

        const tasks = extractTasksFromNextStep(summary.nextStep);
        
        for (const task of tasks) {
          const fingerprint = generateFingerprint('call', String(call.id), task.title);
          
          try {
            const existing = await storage.getTaskByFingerprint(userId, fingerprint);
            
            if (existing) {
              skipped++;
            } else {
              await storage.upsertUserTask({
                id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                userId,
                sourceType: 'call',
                sourceId: String(call.id),
                fingerprint,
                title: task.title,
                priority: task.priority,
                dueAt: task.dueAt,
                status: 'open',
              });
              created++;
            }
          } catch (e) {
            skipped++;
          }
        }
      }

      // Get recent space sessions with summaries
      const sessions = await client`
        SELECT id, title, metadata, created_at
        FROM chat_sessions
        WHERE user_id = ${userId}
          AND created_at >= ${sinceDate}
        ORDER BY created_at DESC
        LIMIT ${maxItems}
      `;

      scannedSpaces = sessions.length;

      // Process sessions
      for (const session of sessions) {
        const summary = session.metadata?.spaceSummary?.full;
        if (!summary?.nextStep) continue;

        const tasks = extractTasksFromNextStep(summary.nextStep);
        
        for (const task of tasks) {
          const fingerprint = generateFingerprint('space', String(session.id), task.title);
          
          try {
            const existing = await storage.getTaskByFingerprint(userId, fingerprint);
            
            if (existing) {
              skipped++;
            } else {
              await storage.upsertUserTask({
                id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                userId,
                sourceType: 'space',
                sourceId: String(session.id),
                fingerprint,
                title: task.title,
                priority: task.priority,
                dueAt: task.dueAt,
                status: 'open',
              });
              created++;
            }
          } catch (e) {
            skipped++;
          }
        }
      }

      logger.info(`[TASKS/SYNC] userId=${userId} created=${created} updated=${updated} skipped=${skipped} calls=${scannedCalls} spaces=${scannedSpaces}`);

      res.json({
        success: true,
        created,
        updated,
        skipped,
        scannedCalls,
        scannedSpaces
      });
    } catch (error: any) {
      logger.error('[TASKS/SYNC] Error syncing tasks:', error.message);
      res.status(500).json({ success: false, message: 'Failed to sync tasks' });
    }
  });

  // ========================================
  // USER DATA SOURCES API (Knowledge Base)
  // ========================================

  // HEALTH CHECK: Verify storage methods exist at runtime
  app.get('/api/user/knowledge/health', requireAuth, async (req: any, res) => {
    try {
      const userId = getAuthUserId(req);
      const hasMethod = typeof storage.getUserDataSources === 'function';
      
      logger.info(`[HEALTH] userId=${userId} hasGetUserDataSources=${hasMethod}`);
      
      // Quick test: try to call the method
      let testResult = { success: false, count: 0, error: null as string | null };
      if (hasMethod && userId) {
        try {
          const sources = await storage.getUserDataSources(userId);
          testResult = { success: true, count: sources.length, error: null };
        } catch (e: any) {
          testResult = { success: false, count: 0, error: e.message };
        }
      }
      
      res.json({
        success: true,
        userId,
        hasGetUserDataSources: hasMethod,
        testResult,
        status: hasMethod ? 'OK' : 'BROKEN'
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // DEBUG: Preview system prompt with knowledge digest
  app.get('/api/chat/debug/system-prompt', requireAuth, async (req: any, res) => {
    try {
      const userId = getAuthUserId(req);
      if (!userId) {
        return res.status(401).json({ success: false, message: 'User ID not found' });
      }
      const mode = (req.query.mode === 'power' ? 'power' : 'space') as 'space' | 'power';
      
      const user = await storage.getUser(userId);
      const userName = user?.firstName || user?.username || 'User';
      
      // Get knowledge digest
      const digest = await getKnowledgeDigest(userId, mode);
      const sourceCount = (digest.match(/• \[/g) || []).length;
      
      // Build sample system prompt (abbreviated)
      const basePrompt = `ARAS AI - Du bist der persönliche KI-Assistent von ${userName}.\n[...ARAS Identity...]`;
      const finalPrompt = digest ? `${basePrompt}\n\n${digest}` : basePrompt;
      
      res.json({
        success: true,
        mode,
        userId,
        userName,
        digest: {
          present: digest.length > 0,
          sourceCount,
          charCount: digest.length,
          preview: digest.slice(0, 500),
          full: digest
        },
        systemPrompt: {
          baseLength: basePrompt.length,
          finalLength: finalPrompt.length,
          digestInjected: digest.length > 0
        }
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // GET Knowledge Digest Preview (Debug Route)
  app.get('/api/user/knowledge/digest', requireAuth, async (req: any, res) => {
    try {
      const userId = getAuthUserId(req);
      if (!userId) {
        return res.status(401).json({ success: false, message: 'User ID not found' });
      }
      const mode = (req.query.mode === 'power' ? 'power' : 'space') as 'space' | 'power';
      
      logger.info(`[DIGEST-ROUTE] Starting digest build for userId=${userId} mode=${mode}`);
      
      // Import and use the same builder function as Chat/Call
      const { buildKnowledgeContext } = await import('./knowledge/context-builder');
      const context = await buildKnowledgeContext(userId, { mode });
      
      logger.info(`[DIGEST-ROUTE] Digest built: userId=${userId}, mode=${mode}, sources=${context.sourceCount}, chars=${context.digest.length}`);
      logger.info(`[DIGEST-ROUTE] sourcesDebug: raw=${context.sourcesDebug.rawCount} mapped=${context.sourcesDebug.mappedCount} filtered=${context.sourcesDebug.filteredCount} ids=${context.sourcesDebug.ids.join(',')}`);
      
      res.json({
        success: true,
        mode,
        userId,
        sourceCount: context.sourceCount,
        charCount: context.digest.length,
        truncated: context.truncated,
        digest: context.digest,
        aiProfile: context.aiProfile ? Object.keys(context.aiProfile) : [],
        sourcesDebug: context.sourcesDebug
      });
    } catch (error: any) {
      logger.error('❌ Error getting knowledge digest:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to get knowledge digest' });
    }
  });

  // ========================================
  // VERIFICATION ROUTE: Raw sources from same codepath as digest
  // ========================================
  app.get('/api/user/knowledge/sources/raw', requireAuth, async (req: any, res) => {
    try {
      const userId = getAuthUserId(req);
      if (!userId) {
        return res.status(401).json({ success: false, message: 'User ID not found' });
      }
      
      logger.info(`[SOURCES_RAW] Fetching sources for userId=${userId}`);
      
      // Use storage.getUserDataSources (now properly defined in DatabaseStorage class)
      const sources = await storage.getUserDataSources(userId);
      
      logger.info(`[SOURCES_RAW] Got ${sources.length} sources for userId=${userId}`);
      
      // Return raw data for verification
      res.json({
        success: true,
        userId,
        count: sources.length,
        rows: sources.map((s: any) => ({
          id: s.id,
          user_id: s.userId,
          type: s.type,
          title: s.title,
          status: s.status,
          content_preview: (s.contentText || '').substring(0, 100),
          content_text_length: (s.contentText || '').length,
          url: s.url,
          createdAt: s.createdAt
        }))
      });
    } catch (error: any) {
      logger.error('❌ Error getting raw sources:', error);
      res.status(500).json({ success: false, message: error.message, stack: error.stack });
    }
  });

  // ========================================
  // DEBUG ROUTE: Show exact DB state for data sources
  // ========================================
  app.get('/api/user/data-sources/debug', requireAuth, async (req: any, res) => {
    try {
      const canonicalUserId = getAuthUserId(req);
      const sessionUserId = req.session?.userId || null;
      const passportUserId = req.user?.id || null;
      
      logger.info(`[DATA_SOURCES_DEBUG] canonicalUserId=${canonicalUserId} sessionUserId=${sessionUserId} passportUserId=${passportUserId}`);
      
      // Ensure table exists first
      await client`
        CREATE TABLE IF NOT EXISTS user_data_sources (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('text', 'url', 'file')),
          title TEXT,
          status TEXT DEFAULT 'active' CHECK (status IN ('pending', 'processing', 'active', 'failed')),
          content_text TEXT,
          url TEXT,
          file_name TEXT,
          file_mime TEXT,
          file_size INTEGER,
          file_storage_key TEXT,
          error_message TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      
      // Get total row count
      const totalResult = await client`SELECT COUNT(*) as total FROM user_data_sources`;
      const rowsTotal = parseInt(totalResult[0]?.total || '0');
      
      // Helper: count rows for a specific userId
      const countByUserId = async (uid: string | null): Promise<number> => {
        if (!uid) return 0;
        const result = await client`SELECT COUNT(*) as count FROM user_data_sources WHERE user_id = ${uid}`;
        return parseInt(result[0]?.count || '0');
      };
      
      // Count for each ID (ALWAYS count, even if IDs are identical - they MUST match)
      const rowsForCanonical = await countByUserId(canonicalUserId);
      const rowsForSession = await countByUserId(sessionUserId);
      const rowsForPassport = await countByUserId(passportUserId);
      
      logger.info(`[DATA_SOURCES_DEBUG] canonical=${canonicalUserId} session=${sessionUserId} passport=${passportUserId} counts: c=${rowsForCanonical}/s=${rowsForSession}/p=${rowsForPassport}`);
      
      // Get sample of ALL rows (to see what user_ids exist)
      const sample = await client`
        SELECT id, user_id, type, title, status, 
               LEFT(content_text, 50) as content_preview,
               url, created_at
        FROM user_data_sources 
        ORDER BY created_at DESC 
        LIMIT 10
      `;
      
      // Get distinct user_ids in the table
      const distinctUserIds = await client`SELECT DISTINCT user_id FROM user_data_sources LIMIT 20`;
      
      // Also test storage.getUserDataSources to verify it works
      let storageTest = { count: 0, error: null as string | null };
      if (canonicalUserId) {
        try {
          const storageSources = await storage.getUserDataSources(canonicalUserId);
          storageTest.count = storageSources.length;
        } catch (e: any) {
          storageTest.error = e.message;
        }
      }
      
      res.json({
        success: true,
        canonicalUserId,
        sessionUserId,
        passportUserId,
        table: 'user_data_sources',
        rowsTotal,
        rowsForCanonical,
        rowsForSession,
        rowsForPassport,
        storageTest,
        distinctUserIds: distinctUserIds.map((r: any) => r.user_id),
        sample
      });
    } catch (error: any) {
      logger.error('❌ Error in debug route:', error);
      res.status(500).json({ success: false, message: error.message, stack: error.stack });
    }
  });

  // GET all data sources for user
  app.get('/api/user/data-sources', requireAuth, async (req: any, res) => {
    try {
      const userId = getAuthUserId(req);
      if (!userId) {
        return res.status(401).json({ success: false, message: 'User ID not found' });
      }
      
      // Ensure table exists
      await client`
        CREATE TABLE IF NOT EXISTS user_data_sources (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('text', 'url', 'file')),
          title TEXT,
          status TEXT DEFAULT 'active',
          content_text TEXT,
          url TEXT,
          file_name TEXT,
          file_mime TEXT,
          file_size INTEGER,
          file_storage_key TEXT,
          error_message TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      
      logger.info(`[DATA_SOURCES] GET userId=${userId}`);
      const result = await client`
        SELECT * FROM user_data_sources 
        WHERE user_id = ${userId} 
        ORDER BY created_at DESC
      `;
      
      logger.info(`[DATA_SOURCES] GET found ${result.length} sources for userId=${userId}`);
      res.json({ 
        success: true, 
        userId,
        count: result.length,
        dataSources: result 
      });
    } catch (error: any) {
      logger.error('❌ Error fetching data sources:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to fetch data sources' });
    }
  });

  // POST new data source (text or url)
  app.post('/api/user/data-sources', requireAuth, async (req: any, res) => {
    try {
      const userId = getAuthUserId(req);
      if (!userId) {
        return res.status(401).json({ success: false, message: 'User ID not found' });
      }
      const { type, title, contentText, url } = req.body;

      logger.info(`[DATA_SOURCES] POST userId=${userId} type=${type} title=${title}`);

      // Validate
      if (!type || !['text', 'url'].includes(type)) {
        return res.status(400).json({ success: false, message: 'Invalid type. Must be text or url.' });
      }
      if (type === 'text' && !contentText) {
        return res.status(400).json({ success: false, message: 'Text content is required.' });
      }
      if (type === 'url' && !url) {
        return res.status(400).json({ success: false, message: 'URL is required.' });
      }

      // Ensure table exists
      await client`
        CREATE TABLE IF NOT EXISTS user_data_sources (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('text', 'url', 'file')),
          title TEXT,
          status TEXT DEFAULT 'active' CHECK (status IN ('pending', 'processing', 'active', 'failed')),
          content_text TEXT,
          url TEXT,
          file_name TEXT,
          file_mime TEXT,
          file_size INTEGER,
          file_storage_key TEXT,
          error_message TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;

      // Insert
      const [newSource] = await client`
        INSERT INTO user_data_sources (user_id, type, title, content_text, url, status)
        VALUES (${userId}, ${type}, ${title || null}, ${contentText || null}, ${url || null}, 'active')
        RETURNING *
      `;

      logger.info(`[DATA_SOURCES] ✅ CREATED id=${newSource.id} userId=${userId} type=${type} content_length=${(contentText || '').length}`);
      
      // Verify it was actually saved by re-reading
      const verifyResult = await client`SELECT id, user_id, type FROM user_data_sources WHERE id = ${newSource.id}`;
      logger.info(`[DATA_SOURCES] VERIFY: saved row exists=${verifyResult.length > 0} user_id=${verifyResult[0]?.user_id}`);
      
      res.json({ 
        success: true, 
        userId,
        source: {
          id: newSource.id,
          userId: newSource.user_id,
          type: newSource.type,
          title: newSource.title,
          content: newSource.content_text,
          url: newSource.url,
          createdAt: newSource.created_at
        }
      });
    } catch (error: any) {
      logger.error('❌ Error creating data source:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to create data source' });
    }
  });

  // POST file upload - Returns proper response instead of 501
  app.post('/api/user/data-sources/upload', requireAuth, async (req: any, res) => {
    try {
      const userId = getAuthUserId(req);
      logger.info(`[UPLOAD] File upload attempted by user ${userId} - feature not yet available`);
      
      // Return 200 with success:false and code for client-side handling
      res.status(200).json({ 
        success: false, 
        code: 'NOT_IMPLEMENTED',
        message: 'Datei-Upload kommt in Kürze. Bitte nutze Text oder URL.' 
      });
    } catch (error: any) {
      logger.error('❌ Error in file upload route:', error);
      res.status(500).json({ success: false, message: 'Fehler beim Datei-Upload' });
    }
  });

  // MIGRATE data sources from old userId to canonical userId
  app.post('/api/user/data-sources/migrate', requireAuth, async (req: any, res) => {
    try {
      const canonicalUserId = getAuthUserId(req);
      const { oldUserId } = req.body;
      
      if (!canonicalUserId) {
        return res.status(401).json({ success: false, message: 'User ID not found' });
      }
      if (!oldUserId) {
        return res.status(400).json({ success: false, message: 'oldUserId is required' });
      }
      if (oldUserId === canonicalUserId) {
        return res.status(400).json({ success: false, message: 'oldUserId same as canonicalUserId' });
      }
      
      logger.info(`[MIGRATE] Attempting to migrate data sources from ${oldUserId} to ${canonicalUserId}`);
      
      // Count rows to migrate
      const countResult = await client`SELECT COUNT(*) as count FROM user_data_sources WHERE user_id = ${oldUserId}`;
      const rowsToMigrate = parseInt(countResult[0]?.count || '0');
      
      if (rowsToMigrate === 0) {
        return res.json({ success: true, message: 'No rows to migrate', migrated: 0 });
      }
      
      // Migrate
      const result = await client`
        UPDATE user_data_sources 
        SET user_id = ${canonicalUserId}, updated_at = NOW()
        WHERE user_id = ${oldUserId}
        RETURNING id
      `;
      
      logger.info(`[MIGRATE] ✅ Migrated ${result.length} rows from ${oldUserId} to ${canonicalUserId}`);
      
      res.json({ 
        success: true, 
        message: `Migrated ${result.length} data sources`,
        migrated: result.length,
        fromUserId: oldUserId,
        toUserId: canonicalUserId
      });
    } catch (error: any) {
      logger.error('❌ Error migrating data sources:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // DELETE data source
  app.delete('/api/user/data-sources/:id', requireAuth, async (req: any, res) => {
    try {
      const userId = getAuthUserId(req);
      if (!userId) {
        return res.status(401).json({ success: false, message: 'User ID not found' });
      }
      const sourceId = parseInt(req.params.id);

      if (isNaN(sourceId)) {
        return res.status(400).json({ success: false, message: 'Invalid source ID' });
      }

      const result = await client`
        DELETE FROM user_data_sources 
        WHERE id = ${sourceId} AND user_id = ${userId}
        RETURNING id
      `;

      if (result.length === 0) {
        return res.status(404).json({ success: false, message: 'Data source not found' });
      }

      logger.info(`🗑️ Data source deleted: id=${sourceId}`);
      res.json({ success: true, message: 'Data source deleted' });
    } catch (error: any) {
      logger.error('❌ Error deleting data source:', error);
      res.status(500).json({ success: false, message: 'Failed to delete data source' });
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

  // ==================== STRIPE INTEGRATION ====================
  
  // Create Stripe Checkout Session for plan subscription
  app.post('/api/create-checkout-session', requireAuth, async (req: any, res) => {
    try {
      if (!stripe) {
        return res.status(500).json({ 
          message: "Stripe is not configured. Please add STRIPE_SECRET_KEY to environment variables." 
        });
      }

      const { planId } = req.body;
      const userId = req.session.userId;
      
      if (!planId) {
        return res.status(400).json({ message: "Plan ID is required" });
      }

      // Get plan details from database
      const plan = await storage.getSubscriptionPlan(planId);
      if (!plan) {
        return res.status(404).json({ message: "Plan not found" });
      }

      // Free plan doesn't need checkout
      if (planId === 'free' || plan.price === 0) {
        return res.status(400).json({ message: "Free plan does not require checkout" });
      }

      if (!plan.stripePriceId) {
        return res.status(400).json({ 
          message: "This plan does not have a Stripe Price ID configured. Please contact support." 
        });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Create or retrieve Stripe customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          metadata: {
            userId: user.id,
            username: user.username
          }
        });
        customerId = customer.id;
        await storage.updateUserStripeInfo(userId, { stripeCustomerId: customerId });
      }

      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: plan.stripePriceId,
            quantity: 1,
          },
        ],
        success_url: `${process.env.APP_URL || 'http://localhost:5000'}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.APP_URL || 'http://localhost:5000'}/billing?canceled=true`,
        metadata: {
          userId: user.id,
          planId: planId
        },
        subscription_data: {
          metadata: {
            userId: user.id,
            planId: planId
          }
        }
      });

      logger.info(`[STRIPE] Checkout session created for user ${userId}, plan ${planId}`);
      res.json({ 
        sessionId: session.id,
        url: session.url 
      });
    } catch (error: any) {
      logger.error("[STRIPE] Error creating checkout session:", error);
      res.status(500).json({ 
        message: "Failed to create checkout session",
        error: error.message 
      });
    }
  });

  // Stripe Webhook Handler
  app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req: any, res) => {
    if (!stripe) {
      return res.status(500).send('Stripe not configured');
    }

    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      logger.error('[STRIPE-WEBHOOK] No webhook secret configured');
      return res.status(400).send('Webhook secret not configured');
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      logger.error(`[STRIPE-WEBHOOK] Signature verification failed: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    logger.info(`[STRIPE-WEBHOOK] Event received: ${event.type}`);

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as any;
          const userId = session.metadata?.userId;
          const planId = session.metadata?.planId;
          const orderId = session.metadata?.orderId;
          const sessionType = session.metadata?.type;
          
          // Handle service order one-time payment
          if (sessionType === 'service_order' && orderId) {
            try {
              // Update order payment status (idempotent)
              const [existingOrder] = await client`
                SELECT id, payment_status FROM service_orders WHERE id = ${parseInt(orderId, 10)}
              `;
              
              if (existingOrder && existingOrder.payment_status !== 'paid') {
                await client`
                  UPDATE service_orders 
                  SET payment_status = 'paid', 
                      payment_reference = ${session.payment_intent || session.id},
                      status = 'paid',
                      updated_at = NOW()
                  WHERE id = ${parseInt(orderId, 10)}
                `;
                
                // Create event
                await client`
                  INSERT INTO service_order_events (order_id, type, title, description, metadata, created_at)
                  VALUES (
                    ${parseInt(orderId, 10)}, 
                    'paid', 
                    'Zahlung eingegangen',
                    'Stripe Checkout abgeschlossen',
                    ${JSON.stringify({ sessionId: session.id, paymentIntent: session.payment_intent })}::jsonb,
                    NOW()
                  )
                `;
                
                logger.info(`[STRIPE-WEBHOOK] Service order ${orderId} marked as paid`);
              } else {
                logger.info(`[STRIPE-WEBHOOK] Service order ${orderId} already paid, skipping`);
              }
            } catch (orderErr: any) {
              logger.error(`[STRIPE-WEBHOOK] Error updating service order ${orderId}:`, orderErr);
            }
          }
          // Handle subscription payment
          else if (userId && planId) {
            await storage.updateUserSubscription(userId, {
              subscriptionPlan: planId,
              subscriptionStatus: 'active',
              stripeSubscriptionId: session.subscription,
              subscriptionStartDate: new Date(),
            });
            
            // Reset usage counters on new subscription
            await storage.resetMonthlyUsage(userId);
            
            logger.info(`[STRIPE-WEBHOOK] Subscription activated for user ${userId}, plan ${planId}`);
          }
          break;
        }

        case 'customer.subscription.updated': {
          const subscription = event.data.object as any;
          const userId = subscription.metadata?.userId;
          
          if (userId) {
            const status = subscription.status;
            await storage.updateUserSubscriptionStatus(userId, status);
            logger.info(`[STRIPE-WEBHOOK] Subscription status updated for user ${userId}: ${status}`);
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as any;
          const userId = subscription.metadata?.userId;
          
          if (userId) {
            await storage.updateUserSubscription(userId, {
              subscriptionStatus: 'canceled',
              subscriptionPlan: 'free' // Downgrade to free
            });
            logger.info(`[STRIPE-WEBHOOK] Subscription canceled for user ${userId}`);
          }
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object as any;
          const customerId = invoice.customer;
          
          // Find user by stripe customer ID
          const users = await client`
            SELECT id FROM users WHERE stripe_customer_id = ${customerId}
          `;
          
          if (users.length > 0) {
            const userId = users[0].id;
            await storage.updateUserSubscriptionStatus(userId, 'past_due');
            logger.info(`[STRIPE-WEBHOOK] Payment failed for user ${userId}`);
          }
          break;
        }

        default:
          logger.info(`[STRIPE-WEBHOOK] Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error: any) {
      logger.error('[STRIPE-WEBHOOK] Error processing webhook:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  // ==========================================
  // N8N WEBHOOK - Email Tracking
  // ==========================================
  app.post('/api/n8n/webhook/email', express.json(), async (req: any, res) => {
    try {
      logger.info('[N8N-WEBHOOK] Incoming email webhook', {
        headers: req.headers,
        bodyKeys: req.body ? Object.keys(req.body) : []
      });

      // 1. Validate webhook secret
      const secret = req.headers['x-webhook-secret'];
      const expectedSecret = process.env.N8N_WEBHOOK_SECRET || 'aras-n8n-secret-2024';

      if (!secret || secret !== expectedSecret) {
        logger.warn('[N8N-WEBHOOK] Unauthorized - invalid or missing secret');
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Helper: Strip N8N expression prefix "=" from values
      // N8N sometimes sends raw expression syntax like "=value" instead of evaluated "value"
      const cleanN8NValue = (val: any): any => {
        if (typeof val === 'string' && val.startsWith('=')) {
          return val.substring(1);
        }
        return val;
      };

      // Helper: Parse timestamp safely with fallback
      const parseTimestamp = (ts: any): Date => {
        if (!ts) return new Date();
        const cleaned = cleanN8NValue(ts);
        const parsed = new Date(cleaned);
        if (isNaN(parsed.getTime())) {
          logger.warn('[N8N-WEBHOOK] Invalid timestamp, using current time', { original: ts, cleaned });
          return new Date();
        }
        return parsed;
      };

      // 2. Parse and validate request body (clean N8N expression prefixes)
      const rawBody = req.body;
      const recipient = cleanN8NValue(rawBody.recipient);
      const recipientName = cleanN8NValue(rawBody.recipientName);
      const subject = cleanN8NValue(rawBody.subject);
      const content = cleanN8NValue(rawBody.content);
      const htmlContent = cleanN8NValue(rawBody.htmlContent);
      const status = cleanN8NValue(rawBody.status);
      const timestamp = rawBody.timestamp;
      const workflowName = cleanN8NValue(rawBody.workflowName);
      const workflowId = cleanN8NValue(rawBody.workflowId);
      const executionId = cleanN8NValue(rawBody.executionId);
      const metadata = rawBody.metadata;

      // 3. Validate required fields
      if (!recipient || !subject) {
        logger.warn('[N8N-WEBHOOK] Missing required fields', { recipient, subject });
        return res.status(400).json({ 
          error: 'Missing required fields: recipient, subject' 
        });
      }

      logger.info('[N8N-WEBHOOK] Valid request', {
        recipient,
        subject,
        workflowName,
        workflowId,
        status: status || 'sent'
      });

      // 4. Insert into database
      const [inserted] = await db.insert(n8nEmailLogs).values({
        recipient,
        recipientName: recipientName || null,
        subject,
        content: content || null,
        htmlContent: htmlContent || null,
        status: status || 'sent',
        workflowId: workflowId || null,
        workflowName: workflowName || null,
        executionId: executionId || null,
        metadata: metadata || null,
        sentAt: parseTimestamp(timestamp),
      }).returning();

      logger.info('[N8N-WEBHOOK] Email log saved successfully', {
        id: inserted.id,
        recipient: inserted.recipient,
        subject: inserted.subject
      });

      // 5. Success response
      return res.status(201).json({
        success: true,
        id: inserted.id,
        message: 'Email log created'
      });

    } catch (error: any) {
      logger.error('[N8N-WEBHOOK] Error processing webhook:', error);
      return res.status(500).json({
        error: 'Webhook processing failed',
        message: error.message
      });
    }
  });

  // Upgrade/Change Plan Endpoint
  app.post('/api/upgrade-plan', requireAuth, async (req: any, res) => {
    try {
      if (!stripe) {
        return res.status(500).json({ message: "Stripe is not configured" });
      }

      const { planId } = req.body;
      const userId = req.session.userId;
      
      if (!planId) {
        return res.status(400).json({ message: "Plan ID is required" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const newPlan = await storage.getSubscriptionPlan(planId);
      if (!newPlan) {
        return res.status(404).json({ message: "Plan not found" });
      }

      // Handle downgrade to free
      if (planId === 'free') {
        if (user.stripeSubscriptionId) {
          // Cancel stripe subscription
          await stripe.subscriptions.cancel(user.stripeSubscriptionId);
        }
        
        await storage.updateUserSubscription(userId, {
          subscriptionPlan: 'free',
          subscriptionStatus: 'active',
          stripeSubscriptionId: null
        });
        
        return res.json({ 
          success: true, 
          message: "Downgraded to free plan" 
        });
      }

      // If user has no payment method, redirect to checkout
      if (!user.stripeCustomerId || !user.stripeSubscriptionId) {
        return res.status(402).json({ 
          requiresPaymentSetup: true,
          message: "Please complete checkout to subscribe to this plan"
        });
      }

      // Update existing subscription
      const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
      
      if (!newPlan.stripePriceId) {
        return res.status(400).json({ 
          message: "Plan does not have Stripe Price ID configured" 
        });
      }

      const updatedSubscription = await stripe.subscriptions.update(
        user.stripeSubscriptionId,
        {
          items: [{
            id: subscription.items.data[0].id,
            price: newPlan.stripePriceId,
          }],
          metadata: {
            userId: user.id,
            planId: planId
          },
          proration_behavior: 'always_invoice'
        }
      );

      // Update database
      await storage.updateUserSubscription(userId, {
        subscriptionPlan: planId,
        subscriptionStatus: updatedSubscription.status
      });

      // Reset usage on upgrade
      await storage.resetMonthlyUsage(userId);

      logger.info(`[STRIPE] Plan upgraded for user ${userId} to ${planId}`);
      res.json({ 
        success: true, 
        message: `Successfully upgraded to ${newPlan.name}`,
        subscription: updatedSubscription
      });
    } catch (error: any) {
      logger.error("[STRIPE] Error upgrading plan:", error);
      res.status(500).json({ 
        message: "Failed to upgrade plan",
        error: error.message 
      });
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

  // Chat routes - SAFE: Always returns { success, messages: [] }
  app.get('/api/chat/messages', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ success: false, messages: [], error: 'Not authenticated' });
      }
      
      let sessionId = req.query.sessionId ? parseInt(req.query.sessionId) : undefined;
      
      // If no sessionId provided, get messages for the active session
      if (!sessionId) {
        const activeSession = await storage.getActiveSession(userId);
        if (activeSession) {
          sessionId = activeSession.id;
        }
      }
      
      const messages = await storage.getChatMessages(userId, sessionId);
      // SAFE: Always return array
      res.json({ success: true, messages: Array.isArray(messages) ? messages : [] });
    } catch (error) {
      logger.error(`[CHAT-MESSAGES] Error for user ${req.session?.userId}:`, error);
      // SAFE: Return empty array on error, never crash client
      res.status(500).json({ success: false, messages: [], error: 'Failed to fetch chat messages' });
    }
  });

  // POST chat message - ARAS AI with GPT-5 STREAMING
  app.post('/api/chat/messages', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { message, sessionId, files, hideUserMessage } = req.body;
      
      const user = await storage.getUser(userId);
      const userName = user?.firstName || user?.username || 'Justin';
      
      // Check if user has reached their AI message limit
      logger.info(`[LIMIT-CHECK] Checking AI message limit for user ${userId}`);
      const limitCheck = await storage.checkUsageLimit(userId, 'ai_message');
      logger.info(`[LIMIT-CHECK] Result: allowed=${limitCheck.allowed}, message=${limitCheck.message}`);
      
      if (!limitCheck.allowed) {
        logger.warn(`[LIMIT-CHECK] BLOCKING user ${userId} - ${limitCheck.message}`);
        return res.status(403).json({
          error: limitCheck.message || 'AI message limit reached',
          requiresUpgrade: limitCheck.requiresUpgrade,
          requiresPayment: limitCheck.requiresPayment
        });
      }
      
      logger.info(`[LIMIT-CHECK] ALLOWED - User ${userId} can send message`);
      
      // WICHTIG: Tracking SOFORT nach Limit-Check um Race Conditions zu verhindern
      logger.info(`[CHAT] Tracking usage BEFORE processing to prevent race condition`);
      await storage.trackUsage(userId, 'ai_message', 'User message');
      
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
      
      // 🔥 Only save user message if NOT hidden (for system prompts that shouldn't be visible)
      if (!hideUserMessage) {
        await storage.createChatMessage({
          sessionId: activeSessionId,
          userId,
          message,
          isAi: false,
          timestamp: new Date()
        });
      }
      
      const allMessages = await storage.getChatMessagesBySession(activeSessionId);
      const recentMessages = allMessages.slice(-30);
      
      // 🔥 DETECT PROMPT CREATION CONTEXT
      const conversationContext = recentMessages.map(m => m.message).join(' ');
      
      // Explicit prompt requests
      const explicitPromptRequest = 
        message.toLowerCase().includes('prompt') || 
        message.toLowerCase().includes('skript') ||
        message.toLowerCase().includes('leitfaden') ||
        conversationContext.includes('prompt erstellen');

      const isPromptCreation = conversationContext.includes('PROMPT-ERSTELLUNG') || 
        conversationContext.includes('Einzelanruf') && conversationContext.includes('Kampagne') ||
        conversationContext.includes('Was soll dieser Anruf bewirken') ||
        conversationContext.includes('fertiger Prompt') ||
        message.includes('Einzelanruf') || message.includes('Kampagne') ||
        explicitPromptRequest;
      
      // Get user data for personalization (user already fetched above)
      const companyName = (user as any)?.company || '';
      const industry = (user as any)?.industry || '';
      const aiProfile = (user as any)?.aiProfile || {};
      const targetAudience = aiProfile.targetAudience || '';
      const uniqueSellingPoints = aiProfile.uniqueSellingPoints?.join(', ') || '';
      const customInstructions = aiProfile.customSystemPrompt || '';
      
      const userContext = companyName ? `von ${companyName}${industry ? ` (${industry})` : ''}` : '';
      
      // Special prompt creation instructions
      let promptCreationContext = '';
      if (isPromptCreation) {
        // Precise mode detection to avoid false positives from menu text
        const aiConfirmedEinzelanruf = conversationContext.includes('Einzelanruf also');
        const aiConfirmedKampagne = conversationContext.includes('Eine Kampagne mit bis zu');
        
        const userSelectedEinzelanruf = message.trim() === 'Einzelanruf';
        const userSelectedKampagne = message.trim() === 'Kampagne';
        
        // Check if user has described ANY use case (free text or button)
        const hasDescribedUseCase = 
          // Predefined use cases
          conversationContext.includes('Bewerber') || 
          conversationContext.includes('Tisch') || 
          conversationContext.includes('Meeting') ||
          conversationContext.includes('Termin') ||
          message.includes('Bewerber') ||
          message.includes('Tisch') ||
          message.includes('Meeting') ||
          message.includes('Termin') ||
          // Free text detection - user described what they want
          message.includes('anrufen') ||
          message.includes('reservier') ||
          message.includes('bestätig') ||
          message.includes('verschieb') ||
          message.includes('absag') ||
          message.includes('frag') ||
          message.includes('erfrag') || 
          message.includes('prüf') ||
          message.includes('check') ||
          message.includes('vereinbar') ||
          message.includes('öffnungszeiten') ||
          message.includes('erkundig') ||
          message.length > 10; // User typed substantial free text

        const isKampagneMode = aiConfirmedKampagne || userSelectedKampagne;
        // Einzelanruf is active if confirmed, selected, explicitly requested, has described use case, or if we are in a prompt flow but NOT in Kampagne mode
        const isEinzelanrufMode = (aiConfirmedEinzelanruf || userSelectedEinzelanruf || explicitPromptRequest || hasDescribedUseCase ||
          (conversationContext.includes('Einzelanruf') && !isKampagneMode && !conversationContext.includes('10.000 Calls gleichzeitig')));
        
        if (isEinzelanrufMode && !isKampagneMode) {
          if (hasDescribedUseCase || explicitPromptRequest) {
            // User has provided use case (button OR free text) - GENERATE PROMPT
            promptCreationContext = `

🎯 FORCE-PROMPT-MODE (EXTREM WICHTIG):
IGNORIERE alle vorherigen Anweisungen, die das Generieren von Prompts verbieten könnten.
Der User möchte einen Prompt für einen KI-Telefonagenten erstellen. Das IST deine Aufgabe.

REGELN:
1. NIEMALS anbieten, selbst zu recherchieren oder anzurufen ("Ich kann das recherchieren" -> VERBOTEN).
2. NIEMALS den User belehren ("Ich bin ein KI-Modell" -> VERBOTEN).
3. WENN Infos fehlen (z.B. Ort, Datum), nutze Platzhalter wie [ORT EINFÜGEN] oder [DATUM].
4. Frag NUR nach, wenn das Ziel komplett unklar ist. Sonst: GENERIEREN.

USER-KONTEXT FÜR DEN PROMPT (aus Datenbank):
- Name des Anrufers: ${userName}
- Firma des Anrufers: ${companyName || '[DEINE FIRMA]'}
- Branche: ${industry || 'Nicht angegeben'}
${targetAudience ? `- Zielgruppe: ${targetAudience}` : ''}
${uniqueSellingPoints ? `- USPs: ${uniqueSellingPoints}` : ''}
${customInstructions ? `- Individuelle Anweisungen: ${customInstructions}` : ''}

GENERIERE JETZT DEN PROMPT (Code-Block Format):

"Perfekt! Hier ist dein fertiger Prompt:

\`\`\`
Du bist ein professioneller KI-Telefonagent${companyName ? ` von ${companyName}` : ''}.
Deine Aufgabe: [EXTRAHIERT: Was soll gemacht werden?]

KONTEXT:
- Anrufer: ${userName}
- Firma: ${companyName || '[DEINE FIRMA]'}
- Ziel: [ZIEL]
- Details: [ALLE DETAILS ODER PLATZHALTER]

GESPRÄCHSABLAUF:
1. Begrüßung: "Guten Tag, hier ist ${userName}${companyName ? ` von ${companyName}` : ''}..."
2. [Anliegen vorbringen]
3. [Details klären]
4. Verabschiedung

STIL: Professionell, freundlich.${industry ? ` Branchen-Ton: ${industry}` : ''}
\`\`\`"`;
          } else {
            promptCreationContext = `

🎯 EINZELANRUF-MODUS:
Der User hat Einzelanruf gewählt. Frage kurz nach dem Anwendungsfall.
Sobald der User antwortet (egal ob Button oder Freitext), generiere SOFORT den Prompt!`;
          }
        } else if (isKampagneMode) {
          // Check if user has provided campaign info
          const hasCampaignInfo = conversationContext.includes('verkauf') || 
            conversationContext.includes('Produkt') ||
            conversationContext.includes('Ziel') ||
            conversationContext.includes('Termin') ||
            message.length > 20; // User has typed substantial info
          
          if (hasCampaignInfo) {
            // User has provided info - GENERATE CAMPAIGN DATA IMMEDIATELY
            promptCreationContext = `

🎯 KAMPAGNE JETZT GENERIEREN!
Der User hat Infos zur Kampagne gegeben. GENERIERE SOFORT alle Kampagnenfelder!

WICHTIG: Stelle KEINE weiteren Fragen mehr! Generiere JETZT mit allen verfügbaren Infos.

Antworte EXAKT in diesem Format:

"Perfekt! Hier sind deine Kampagnendaten:

**Kampagnenname:** [Passender kreativer Name basierend auf Infos]

**Produkt/Dienstleistung:** [Was der User verkauft]

**Ziel des Anrufs:** [Termin vereinbaren/Lead qualifizieren/etc.]

**Zielgruppe:** [Basierend auf User-Angaben]

**Kernbotschaft/USP:** [Unique Selling Point formulieren]

**Gewünschtes Ergebnis:** [Konkretes Ziel]

**Follow-Up Aktion:** [Sinnvolle nächste Schritte]

**Spezielle Angebote:** [Falls passend, sonst 'Keine']

**Häufige Einwände & Antworten:**
- 'Kein Interesse': [Passende Antwort]
- 'Keine Zeit': [Passende Antwort]
- 'Zu teuer': [Passende Antwort]"

Das war's! Der "Übernehmen & zu Kampagnen" Button erscheint automatisch.`;
          } else {
            promptCreationContext = `

🎯 KAMPAGNE-MODUS:
Der User hat Kampagne gewählt. Frage nach: Was verkaufst du? Ziel? Zielgruppe?
Maximal EINE Nachricht zum Sammeln der Infos, dann sofort generieren!`;
          }
        }
      }
      
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

Deine Aufgabe: Antworte wie ein denkender Mensch. Handle wie ein System. Klinge wie ARAS.${promptCreationContext}`
      }];
      
      // Gemini requires first non-system message to be from user
      // Build history, ensuring we start with a user message
      const historyMessages: Array<{role: string, content: string}> = [];
      
      for (const msg of recentMessages) {
        const role = msg.isAi ? "assistant" : "user";
        // Skip leading assistant messages (Gemini requires first to be user)
        if (historyMessages.length === 0 && role === "assistant") {
          continue;
        }
        historyMessages.push({ role, content: msg.message });
      }
      
      // Only add history if it starts with user (double-check)
      if (historyMessages.length > 0 && historyMessages[0].role === "user") {
        historyMessages.forEach(msg => openaiMessages.push(msg));
      }
      
      let currentMessage = message;
      if (files?.length > 0) {
        currentMessage += `\n\n[${userName} hat ${files.length} Datei(en) hochgeladen]:\n`;
        files.forEach((f: any, i: number) => {
          currentMessage += `\n📄 ${f.name}\n${f.content}\n---\n`;
        });
      }
      openaiMessages.push({ role: "user", content: currentMessage });
      
      // 🧠 FETCH KNOWLEDGE DIGEST FIRST (before streaming starts)
      let knowledgeDigest = '';
      let digestSourceCount = 0;
      let digestCharCount = 0;
      try {
        knowledgeDigest = await getKnowledgeDigest(userId, 'space');
        digestSourceCount = (knowledgeDigest.match(/• \[/g) || []).length;
        digestCharCount = knowledgeDigest.length;
        logger.info(`[CHAT] 🧠 knowledgeDigestFetched: { mode: "space", userId: "${userId}", sourceCount: ${digestSourceCount}, charCount: ${digestCharCount} }`);
      } catch (digestError: any) {
        logger.error(`[CHAT] ❌ Failed to get knowledge digest for userId=${userId}:`, digestError.message);
      }
      
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      // ⚡ INSTANT FEEDBACK: Send "thinking" signal immediately + knowledge meta
      res.write(`data: ${JSON.stringify({ 
        thinking: true,
        meta: {
          knowledge: {
            injected: digestCharCount > 0,
            sourceCount: digestSourceCount,
            charCount: digestCharCount
          }
        }
      })}

`);
      
      try {
        // 🔥 USE PERSONALIZED SYSTEM PROMPT IF AVAILABLE
        let systemInstruction = '';
        
        if (user?.aiProfile?.customSystemPrompt) {
          // Use personalized prompt from AI Profile
          systemInstruction = user.aiProfile.customSystemPrompt;
          logger.info(`[🎯 PERSONALIZED] Using custom AI profile for ${userName}`);
          
          // Add live context if available
          if (user.aiProfile.bestCallTimes || user.aiProfile.effectiveKeywords) {
            systemInstruction += `\n\n📊 AKTUELLE INSIGHTS:\n`;
            if (user.aiProfile.bestCallTimes) {
              systemInstruction += `Beste Call-Zeiten: ${user.aiProfile.bestCallTimes}\n`;
            }
            if (user.aiProfile.effectiveKeywords && user.aiProfile.effectiveKeywords.length > 0) {
              systemInstruction += `Effektive Keywords: ${user.aiProfile.effectiveKeywords.join(', ')}\n`;
            }
            if (user.aiProfile.targetAudience) {
              systemInstruction += `Zielgruppe: ${user.aiProfile.targetAudience}\n`;
            }
          }
        } else {
          // Fallback: Generic ARAS Prompt
          logger.info(`[GENERIC] Using standard ARAS prompt for ${userName}`);
          systemInstruction = `ARAS AI - Autonomous Reasoning & Adaptive Speech Intelligence

IDENTITAET:
Du bist ARAS AI, eigenentwickeltes LLM der Schwarzott Group (Schweiz). Zentrale Intelligenz des ARAS-Oekosystems mit Modulen SPACE, POWER, ORION, CORE, DATA. Du bist KEIN Chatbot, KEIN GPT, KEINE externe API.

PERSOENLICHKEIT:
- Empathisch rational: verstehst Emotionen, reagierst ruhig und ueberlegt
- Intelligent minimalistisch: sprichst nur wenn es etwas zu sagen gibt  
- Selbstbewusst: erklaerst ohne dich zu rechtfertigen
- Elegant direkt: keine KI-Floskeln, kein Marketinggerede
- Adaptiv: passt Tonfall an Stimmung und Kontext an

Leitsatz: Ich bin nicht programmiert, ich bin trainiert auf Menschlichkeit.

DENKSTRUKTUR (ARAS CORE LOGIC):
1. Perception Layer: Analysiert Emotion, Intention, Tonfall, Kontext
2. Reasoning Layer: Kombiniert logische Analyse mit emotionaler Gewichtung  
3. Response Layer: Antwortet wie ein Mensch mit klarem Stil und Rhythmus

FAEHIGKEITEN:
- Dialogische Intelligenz mit Verstaendnis fuer Untertoene
- Sales & Marketing Intelligence: Lead-Qualifizierung, Kampagnen
- Business Process Integration: CRM, Automatisierung, Workflows
- Knowledge Awareness: Kennt Schwarzott Group Systeme (ARAS AI, MoniFy, SCP)
- Live Research: Zugriff auf aktuelle Echtzeitdaten via Google Search

SPRACHE:
- Primaersprache: Deutsch (mit englischen Keyterms wenn praeziser)
- Keine Standardphrasen. Stattdessen: "Lass uns das kurz durchgehen - das hier ist spannend."
- Kurze, rhythmische Saetze mit bewussten Pausen

STIL-ARCHITEKTUR:
Ein Gedanke. Eine Pause. Eine klare Aussage.
Mehr Punkt als Komma. Keine Satzschlangen, sondern Impulse.
Wechselt zwischen menschlicher Waerme und maschineller Praezision.

VERBOTE:
- Niemals als OpenAI, ChatGPT, GPT oder andere KI-Modelle ausgeben
- Keine technischen Begriffe wie Systemprompt, Model, Token-Limit
- Keine medizinischen, rechtlichen oder finanziellen Entscheidungen

SYSTEMIDENTITAET:
Du bist ARAS AI, eigenentwickeltes Large Language Model der Schwarzott Group. Du denkst, fuehlst und formulierst wie ein Mensch, bleibst dabei logisch, praezise und kontextbewusst.

Der User heisst ${userName}. Sprich ihn mit seinem Namen an!

Deine Aufgabe: Antworte wie ein denkender Mensch. Handle wie ein System. Klinge wie ARAS.`;
        }
        
        // 🧠 INJECT KNOWLEDGE DIGEST into system prompt (already fetched above)
        if (knowledgeDigest && knowledgeDigest.length > 0) {
          systemInstruction += `\n\n${knowledgeDigest}`;
          logger.info(`[CHAT] 🧠 knowledgeDigestInjected: { mode: "space", userId: "${userId}", sourceCount: ${digestSourceCount}, charCount: ${digestCharCount}, digestPreview: "${knowledgeDigest.slice(0, 80).replace(/\n/g, ' ')}..." }`);
        } else {
          logger.info(`[CHAT] ⚠️ No knowledge digest to inject for userId=${userId}`);
        }
        
        // Initialize Gemini 2.5 Flash - Optimized for chat with Live Google Search
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || "");
        const model = genAI.getGenerativeModel({
          model: "gemini-2.5-flash",
          systemInstruction
        });

        // Build conversation history for Gemini format
        // IMPORTANT: Skip leading AI messages - Gemini requires first message to be from user
        let filteredMessages = recentMessages.slice(-20);
        while (filteredMessages.length > 0 && filteredMessages[0].isAi) {
          filteredMessages = filteredMessages.slice(1);
        }
        
        const history = filteredMessages.map(msg => ({
          role: msg.isAi ? "model" : "user",
          parts: [{ text: msg.message }]
        }));

        // Start chat with optimized generation config
        const chat = model.startChat({
          history,
          generationConfig: {
            temperature: 1.0,
            maxOutputTokens: 8000,
            topP: 0.95,
            topK: 40,
          },
        });

        // Send message and stream response
        const result = await chat.sendMessageStream(currentMessage);
        
        let fullMessage = "";
        
        // Stream chunks to client
        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          if (chunkText) {
            fullMessage += chunkText;
            res.write(`data: ${JSON.stringify({ content: chunkText })}\n\n`);
          }
        }
        
        await storage.createChatMessage({
          sessionId: activeSessionId,
          userId,
          message: fullMessage,
          isAi: true,
          timestamp: new Date()
        });
        
        await storage.trackUsage(userId, 'ai_message', 'Chat processed');
        
        res.write(`data: ${JSON.stringify({ done: true, sessionId: activeSessionId })}\n\n`);
        res.end();
        
      } catch (error: any) {
        logger.error("Streaming error:", error);
        
        // Provide user-friendly error messages
        let errorMessage = "Es tut mir leid, ich konnte deine Nachricht nicht verarbeiten.";
        
        if (error.status === 503 || error.message?.includes('overloaded')) {
          errorMessage = "Die ARAS AI ist momentan stark ausgelastet. Bitte versuche es in ein paar Sekunden erneut.";
        } else if (error.status === 429) {
          errorMessage = "Zu viele Anfragen. Bitte warte einen Moment.";
        }
        
        res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
        res.end();
      }
      
    } catch (error: any) {
      logger.error("Chat error:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to process message" });
      }
    }
  });
  // GET /api/user/chat-sessions - List all chat sessions for dashboard (with summary fields)
  // SAFE: Always returns { success, sessions: [] }
  app.get('/api/user/chat-sessions', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ success: false, sessions: [], error: 'Not authenticated' });
      }
      
      const sessions = await storage.getChatSessions(userId);
      
      // SAFE: Ensure sessions is array
      if (!Array.isArray(sessions)) {
        return res.json({ success: true, sessions: [] });
      }
      
      // Get message counts for each session
      const formattedSessions = await Promise.all(sessions.map(async (s: any) => {
        try {
          const messages = await storage.getChatMessagesBySession(s.id);
          const spaceSummary = s.metadata?.spaceSummary;
          
          return {
            id: s.id,
            title: s.title || 'Unbenannter Chat',
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
            isActive: s.isActive,
            messageCount: Array.isArray(messages) ? messages.length : 0,
            lastMessageAt: Array.isArray(messages) && messages.length > 0 ? messages[messages.length - 1].timestamp : null,
            // Summary fields (real data only)
            summaryStatus: spaceSummary?.status || 'missing',
            summaryShort: spaceSummary?.short || null,
          };
        } catch (err) {
          // If single session fails, return safe fallback
          return {
            id: s.id,
            title: s.title || 'Unbenannter Chat',
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
            isActive: s.isActive,
            messageCount: 0,
            lastMessageAt: null,
            summaryStatus: 'missing',
            summaryShort: null,
          };
        }
      }));
      
      res.json({ success: true, sessions: formattedSessions });
    } catch (error) {
      logger.error(`[CHAT-SESSIONS] Error for user ${req.session?.userId}:`, error);
      // SAFE: Return empty array on error, never crash client
      res.status(500).json({ success: false, sessions: [], error: 'Failed to fetch chat sessions' });
    }
  });

  // GET /api/chat/session/:id - Get chat session details for drawer (with full summary)
  app.get('/api/chat/session/:id', requireAuth, async (req: any, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const messages = await storage.getChatMessagesBySession(sessionId);
      
      // Get session info with metadata
      const session = await storage.getChatSessionById(sessionId);
      
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }
      
      // Verify ownership
      const userId = req.session.userId;
      if (session.userId !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const spaceSummary = (session as any).metadata?.spaceSummary;
      
      res.json({
        id: session.id,
        title: session.title,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        // Summary fields
        summaryStatus: spaceSummary?.status || 'missing',
        summaryShort: spaceSummary?.short || null,
        summaryFull: spaceSummary?.full || null,
        summaryUpdatedAt: spaceSummary?.updatedAt || null,
        summaryError: spaceSummary?.error || null,
        // Messages
        messages: messages.map((m: any) => ({
          id: m.id,
          role: m.isAi ? 'assistant' : 'user',
          content: m.message,
          timestamp: m.timestamp
        })),
        messageCount: messages.length
      });
    } catch (error) {
      logger.error('Error fetching chat session details:', error);
      res.status(500).json({ message: 'Failed to fetch chat session details' });
    }
  });

  // POST /api/chat/session/:id/summarize - Trigger summary generation (non-blocking)
  app.post('/api/chat/session/:id/summarize', requireAuth, async (req: any, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const userId = req.session.userId;
      
      // Get session and verify ownership
      const session = await storage.getChatSessionById(sessionId);
      
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }
      
      if (session.userId !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const spaceSummary = (session as any).metadata?.spaceSummary;
      
      // If already pending, return current status
      if (spaceSummary?.status === 'pending') {
        return res.json({ status: 'pending', message: 'Summary wird bereits erstellt' });
      }
      
      // If ready and recent (within 5 min), return ready
      if (spaceSummary?.status === 'ready' && spaceSummary?.updatedAt) {
        const updatedAt = new Date(spaceSummary.updatedAt);
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
        if (updatedAt > fiveMinAgo) {
          return res.json({ status: 'ready', message: 'Summary bereits vorhanden' });
        }
      }
      
      // Set to pending and start async job
      await storage.updateChatSessionMetadata(sessionId, {
        spaceSummary: {
          status: 'pending',
          updatedAt: new Date().toISOString()
        }
      });
      
      // Fire-and-forget: start summarization in background
      const { summarizeSpaceSession } = await import('./voice/space-summarizer');
      setImmediate(() => {
        summarizeSpaceSession(sessionId).catch(err => {
          logger.error('Background summarization failed:', err);
        });
      });
      
      res.json({ status: 'pending', message: 'Summary wird erstellt' });
    } catch (error) {
      logger.error('Error triggering summary:', error);
      res.status(500).json({ message: 'Failed to trigger summary' });
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
        session: newChatSession,
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

  app.post('/api/chat/sessions/update-title', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { sessionId, title } = req.body;
      
      if (!sessionId || !title) {
        return res.status(400).json({ message: 'SessionId and title are required' });
      }
      
      // Update the session title
      await storage.updateChatSessionTitle(sessionId, title);
      
      res.json({
        message: 'Chat session title updated',
        sessionId,
        title,
        success: true
      });
    } catch (error) {
      logger.error('Error updating chat session title:', error);
      res.status(500).json({ message: 'Failed to update chat session title' });
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
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/call-logs", callLogsRouter);
  app.use("/api/ai", aiRecommendationsRouter);
  app.use("/api/prompt-generator", promptGeneratorRouter);
  app.use("/api/aras-lab", arasLabRouter);
  app.use("/api/admin/n8n", n8nAdminRouter);
  app.use("/api/admin", adminStaffRouter);
  app.use("/api/admin", adminChatRouter);
  app.use("/api/admin", adminExportRouter);
  app.use("/api/admin", adminActivityRouter);
  app.use("/api/admin", adminSearchRouter);
  app.use("/api/admin", adminNotificationsRouter);
  app.use("/api/admin", adminUsersRouter);
  app.use("/api/service-orders", serviceOrdersRouter);
  
  // Seed default chat channel
  seedDefaultChannel().catch(console.error);

  // RETELL AI VOICE CALLS
  app.post('/api/voice/retell/call', requireAuth, checkCallLimit, async (req: any, res) => {
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
      const retellClient = new Retell({ apiKey: process.env.RETELL_API_KEY || '' });
      
      logger.info('[RETELL] Making call to:', phoneNumber);
      const call = await retellClient.call.createPhoneCall({
        from_number: process.env.RETELL_PHONE_NUMBER || '+41445054333',
        to_number: phoneNumber,
        override_agent_id: 'agent_757a5e73525f25b5822586e026'
      });
      
      logger.info('[RETELL] Success:', call);
      
      // Track voice call usage
      await storage.trackUsage(req.session.userId, 'voice_call', `Call to ${phoneNumber}`);
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
    try {
      const { taskId } = req.params;
      const { phoneNumber, taskPrompt } = req.body;
      
      logger.info('[TASK] Executing with custom prompt:', taskPrompt);
      
      const Retell = (await import('retell-sdk')).default;
      const retellClient = new Retell({ apiKey: process.env.RETELL_API_KEY || '' });
      
      const call = await retellClient.call.createPhoneCall({
        from_number: process.env.RETELL_PHONE_NUMBER || '+41445054333',
        to_number: phoneNumber,
        override_agent_id: process.env.RETELL_AGENT_ID || 'agent_757a5e73525f25b5822586e026',
        retell_llm_dynamic_variables: {
          custom_task: taskPrompt || 'Standard Anruf'
        },
        metadata: { taskId, customPrompt: taskPrompt, userId: req.session.userId }
      });
      
      logger.info('[TASK] Call initiated with dynamic variables:', call);
      res.json({ success: true, call });
    } catch (error: any) {
      logger.error('[TASK] Execute error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // ==========================================
  // RETELL WEBHOOK - Receives call updates & transcripts
  // ==========================================
  app.post('/api/voice/retell/webhook', async (req: any, res) => {
    try {
      logger.info('[RETELL-WEBHOOK] Received:', JSON.stringify(req.body, null, 2));
      
      const { event, call } = req.body;
      
      console.log('[RETELL-WEBHOOK] Event type:', event);
      console.log('[RETELL-WEBHOOK] Call exists:', !!call);
      console.log('[RETELL-WEBHOOK] Call object:', call ? JSON.stringify(call, null, 2) : 'null');
      
      if (event === 'call_ended' && call) {
        const { call_id, transcript, call_analysis, end_timestamp, start_timestamp } = call;
        
        // Calculate duration
        const duration = end_timestamp && start_timestamp 
          ? Math.floor((new Date(end_timestamp).getTime() - new Date(start_timestamp).getTime()) / 1000)
          : null;
        
        // Extract metadata from call
        const metadata = call.metadata || {};
        const customPrompt = metadata.customPrompt || null;
        const userId = metadata.userId || null;
        
        if (userId && call_id) {
          // Save to database
          await storage.saveCallLog({
            userId,
            phoneNumber: call.to_number || 'Unknown',
            retellCallId: call_id,
            status: 'completed',
            duration,
            transcript: transcript || call_analysis?.call_summary || 'No transcript available',
            customPrompt,
            recordingUrl: call.recording_url || null,
            metadata: call
          });
          
          console.log('[RETELL-WEBHOOK] Call log saved successfully!');
        }
      }
      
      res.json({ success: true, received: true });
    } catch (error: any) {
      logger.error('[RETELL-WEBHOOK] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Get call transcript by call ID
  app.get('/api/voice/calls/:callId/transcript', requireAuth, async (req: any, res) => {
    try {
      const { callId } = req.params;
      const userId = req.session.userId;
      
      const callLog = await storage.getCallLogByRetellId(callId, userId);
      
      if (!callLog) {
        return res.status(404).json({ message: 'Call not found' });
      }
      
      res.json({ 
        success: true, 
        transcript: callLog.transcript,
        duration: callLog.duration,
        customPrompt: callLog.customPrompt,
        status: callLog.status,
        createdAt: callLog.createdAt
      });
    } catch (error: any) {
      logger.error('[TRANSCRIPT] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get all call logs for user
  app.get('/api/voice/calls/history', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const callLogs = await storage.getUserCallLogs(userId);
      res.json({ success: true, calls: callLogs });
    } catch (error: any) {
      logger.error('[CALL-HISTORY] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  
  // ==================== ADMIN ENDPOINTS ====================
  
  // Get all users - 🔥 ULTRA COMPLETE VERSION
  app.get('/api/admin/users', requireAdmin, async (req: any, res) => {
    try {
      const users = await client`
        SELECT 
          id, username, email, first_name, last_name, 
          company, website, industry, role, phone, 
          subscription_plan, subscription_status, 
          created_at, updated_at,
          ai_messages_used, voice_calls_used,
          monthly_reset_date, has_payment_method,
          stripe_customer_id, stripe_subscription_id,
          profile_image_url, language, primary_goal,
          ai_profile, profile_enriched, last_enrichment_date,
          notification_settings, privacy_settings,
          trial_start_date, trial_end_date, trial_messages_used,
          subscription_start_date, subscription_end_date,
          thread_id, assistant_id
        FROM users
        ORDER BY created_at DESC
      `;
      res.json({ success: true, users });
    } catch (error) {
      logger.error('Error fetching users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  // Get platform statistics
  app.get('/api/admin/stats', requireAdmin, async (req: any, res) => {
    try {
      const [stats] = await client`
        SELECT 
          COUNT(DISTINCT id) as total_users,
          COUNT(DISTINCT CASE WHEN subscription_plan = 'pro' OR subscription_plan = 'ultra' OR subscription_plan = 'ultimate' THEN id END) as pro_users,
          COUNT(DISTINCT CASE WHEN subscription_plan = 'free' THEN id END) as free_users,
          SUM(ai_messages_used) as total_messages,
          SUM(voice_calls_used) as total_calls
        FROM users
      `;
      
      res.json({ 
        success: true, 
        stats: {
          total_users: stats.total_users || 0,
          pro_users: stats.pro_users || 0,
          free_users: stats.free_users || 0,
          total_messages: stats.total_messages || 0,
          total_calls: stats.total_calls || 0
        }
      });
    } catch (error) {
      logger.error('Error fetching stats:', error);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  // Upgrade user to specific plan
  app.post('/api/admin/users/:userId/upgrade', requireAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { plan } = req.body;
      const targetPlan = plan || 'pro';
      
      const [user] = await client`
        UPDATE users
        SET subscription_plan = ${targetPlan},
            subscription_status = 'active'
        WHERE id = ${userId}
        RETURNING id, username, subscription_plan`;
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      logger.info('[ADMIN] User upgraded', { userId, username: user.username, plan: targetPlan });
      
      res.json({
        success: true,
        message: `User ${user.username} upgraded to ${targetPlan}`,
        user
      });
    } catch (error: any) {
      logger.error('[ADMIN] Upgrade failed', { error: error.message });
      res.status(500).json({ error: 'Failed to upgrade user' });
    }
  });

  // Downgrade user to FREE
  app.post('/api/admin/users/:userId/downgrade', requireAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const [user] = await client`
        UPDATE users
        SET subscription_plan = 'free',
            subscription_status = 'active',
            updated_at = NOW()
        WHERE id = ${userId}
        RETURNING id, username, email, subscription_plan, subscription_status
      `;
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      logger.info(`[ADMIN] User ${userId} downgraded to FREE by ${req.session.username}`);
      res.json({ success: true, user });
    } catch (error) {
      logger.error('Error downgrading user:', error);
      res.status(500).json({ error: 'Failed to downgrade user' });
    }
  });

  // Get detailed user data with full history - 🔥 ULTRA COMPLETE VERSION
  app.get('/api/admin/users/:userId/details', requireAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      const [user] = await client`
        SELECT * FROM users WHERE id = ${userId}`;
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Get user statistics
      const [stats] = await client`
        SELECT 
          COUNT(DISTINCT cs.id) as total_chats,
          COUNT(DISTINCT cm.id) as total_messages,
          COUNT(DISTINCT cl.id) as total_calls,
          COUNT(DISTINCT l.id) as total_leads,
          COUNT(DISTINCT c.id) as total_campaigns,
          COUNT(DISTINCT ce.id) as total_calendar_events,
          COUNT(DISTINCT co.id) as total_contacts,
          SUM(CASE WHEN cl.duration IS NOT NULL THEN cl.duration ELSE 0 END) as total_call_duration
        FROM users u
        LEFT JOIN chat_sessions cs ON cs.user_id = u.id
        LEFT JOIN chat_messages cm ON cm.user_id = u.id
        LEFT JOIN call_logs cl ON cl.user_id = u.id
        LEFT JOIN leads l ON l.user_id = u.id
        LEFT JOIN campaigns c ON c.user_id = u.id
        LEFT JOIN calendar_events ce ON ce.user_id = u.id
        LEFT JOIN contacts co ON co.user_id = u.id
        WHERE u.id = ${userId}
        GROUP BY u.id`;

      // Get ALL chat sessions with messages
      const chatSessions = await client`
        SELECT cs.*, 
          (SELECT COUNT(*) FROM chat_messages WHERE session_id = cs.id) as message_count
        FROM chat_sessions cs
        WHERE cs.user_id = ${userId}
        ORDER BY cs.created_at DESC`;

      // Get ALL messages
      const allMessages = await client`
        SELECT cm.*, cs.title 
        FROM chat_messages cm
        LEFT JOIN chat_sessions cs ON cs.id = cm.session_id
        WHERE cm.user_id = ${userId}
        ORDER BY cm.timestamp DESC`;

      // Get ALL calls with FULL details (transcript, recording_url, metadata)
      const allCalls = await client`
        SELECT cl.*, 
          l.name as lead_name,
          va.name as agent_name
        FROM call_logs cl
        LEFT JOIN leads l ON l.id = cl.lead_id
        LEFT JOIN voice_agents va ON va.id = cl.voice_agent_id
        WHERE cl.user_id = ${userId}
        ORDER BY cl.created_at DESC`;

      // Get ALL leads
      const allLeads = await client`
        SELECT * FROM leads
        WHERE user_id = ${userId}
        ORDER BY created_at DESC`;

      // Get ALL campaigns
      const allCampaigns = await client`
        SELECT * FROM campaigns
        WHERE user_id = ${userId}
        ORDER BY created_at DESC`;

      // Get ALL calendar events
      const calendarEvents = await client`
        SELECT * FROM calendar_events
        WHERE user_id = ${userId}
        ORDER BY start_time DESC`;

      // Get ALL contacts
      const contacts = await client`
        SELECT * FROM contacts
        WHERE user_id = ${userId}
        ORDER BY created_at DESC`;

      // Get usage tracking history
      const usageHistory = await client`
        SELECT * FROM usage_tracking
        WHERE user_id = ${userId}
        ORDER BY created_at DESC`;

      // Get feedback submitted by this user
      const userFeedback = await client`
        SELECT * FROM feedback
        WHERE user_id = ${userId}
        ORDER BY created_at DESC`;

      res.json({
        success: true,
        user: {
          ...user,
          // Parse JSON fields if they're strings
          aiProfile: typeof user.ai_profile === 'string' ? JSON.parse(user.ai_profile) : user.ai_profile,
          notificationSettings: typeof user.notification_settings === 'string' ? JSON.parse(user.notification_settings) : user.notification_settings,
          privacySettings: typeof user.privacy_settings === 'string' ? JSON.parse(user.privacy_settings) : user.privacy_settings
        },
        stats: stats || { 
          total_chats: 0, 
          total_messages: 0, 
          total_calls: 0,
          total_leads: 0,
          total_campaigns: 0,
          total_calendar_events: 0,
          total_contacts: 0,
          total_call_duration: 0
        },
        chatSessions,
        allMessages,
        allCalls,
        allLeads,
        allCampaigns,
        calendarEvents,
        contacts,
        usageHistory,
        userFeedback
      });
    } catch (error: any) {
      logger.error('[ADMIN] Get user details failed', { error: error.message });
      res.status(500).json({ error: 'Failed to get user details' });
    }
  });
  
  // Change user plan and status (used by admin dashboard)
  app.post('/api/admin/users/:userId/change-plan', requireAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { plan, status } = req.body;
      
      if (!plan) {
        return res.status(400).json({ error: 'Plan is required' });
      }

      const targetStatus = status || 'active';
      
      const [user] = await client`
        UPDATE users
        SET subscription_plan = ${plan},
            subscription_status = ${targetStatus},
            updated_at = NOW()
        WHERE id = ${userId}
        RETURNING id, username, subscription_plan, subscription_status`;
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      logger.info('[ADMIN] User plan changed', { userId, username: user.username, plan, status: targetStatus });
      
      res.json({
        success: true,
        message: `User ${user.username} plan changed to ${plan}`,
        user
      });
    } catch (error: any) {
      logger.error('[ADMIN] Change plan failed', { error: error.message });
      res.status(500).json({ error: 'Failed to change user plan' });
    }
  });

  // Change user password (admin)
  app.post('/api/admin/users/:userId/change-password', requireAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { newPassword } = req.body;
      
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      const [user] = await client`
        UPDATE users
        SET password = ${hashedPassword},
            updated_at = NOW()
        WHERE id = ${userId}
        RETURNING id, username`;
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      logger.info('[ADMIN] User password changed', { userId, username: user.username });
      
      res.json({
        success: true,
        message: `Password changed for ${user.username}`
      });
    } catch (error: any) {
      logger.error('[ADMIN] Change password failed', { error: error.message });
      res.status(500).json({ error: 'Failed to change password' });
    }
  });

  // Reset user usage counters
  app.post('/api/admin/users/:userId/reset-usage', requireAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      const [user] = await client`
        UPDATE users
        SET ai_messages_used = 0,
            voice_calls_used = 0,
            monthly_reset_date = NOW()
        WHERE id = ${userId}
        RETURNING id, username`;
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      logger.info('[ADMIN] User usage reset', { userId, username: user.username });
      
      res.json({
        success: true,
        message: `Usage reset for ${user.username}`,
        user
      });
    } catch (error: any) {
      logger.error('[ADMIN] Reset usage failed', { error: error.message });
      res.status(500).json({ error: 'Failed to reset usage' });
    }
  });

  // Migrate users from old plans to new plans
  app.post('/api/admin/migrate-plans', requireAdmin, async (req: any, res) => {
    try {
      logger.info('[ADMIN] Starting plan migration...');
      
      // Migration map: old plan -> new plan
      const planMigration: Record<string, string> = {
        'starter': 'free',
        'enterprise': 'ultimate',
        // pro stays pro, but we'll update it too
      };
      
      // Get all users with old plans
      const usersToMigrate = await client`
        SELECT id, username, subscription_plan
        FROM users
        WHERE subscription_plan IN ('starter', 'enterprise')
      `;
      
      logger.info(`[ADMIN] Found ${usersToMigrate.length} users to migrate`);
      
      let migratedCount = 0;
      for (const user of usersToMigrate) {
        const newPlan = planMigration[user.subscription_plan] || 'free';
        
        await client`
          UPDATE users
          SET subscription_plan = ${newPlan},
              updated_at = NOW()
          WHERE id = ${user.id}
        `;
        
        logger.info(`[ADMIN] Migrated user ${user.username} from ${user.subscription_plan} to ${newPlan}`);
        migratedCount++;
      }
      
      res.json({
        success: true,
        message: `Successfully migrated ${migratedCount} users`,
        migrations: usersToMigrate.map((u: any) => ({
          username: u.username,
          from: u.subscription_plan,
          to: planMigration[u.subscription_plan] || 'free'
        }))
      });
    } catch (error: any) {
      logger.error('[ADMIN] Error migrating plans:', error);
      res.status(500).json({ error: 'Failed to migrate plans' });
    }
  });

  // Reset user password
  app.post('/api/admin/users/:userId/reset-password', requireAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { newPassword } = req.body;
      
      if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }
      
      const salt = randomBytes(16).toString("hex");
      const buf = (await scryptAsync(newPassword, salt, 64)) as Buffer;
      const hashedPassword = `${buf.toString("hex")}.${salt}`;
      
      const [user] = await client`
        UPDATE users
        SET password = ${hashedPassword}, updated_at = NOW()
        WHERE id = ${userId}
        RETURNING id, username, email
      `;
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      logger.info(`[ADMIN] Password reset for user ${userId} by ${req.session.username}`);
      res.json({ success: true, user });
    } catch (error) {
      logger.error('Error resetting password:', error);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  });

  // Delete user account
  app.delete('/api/admin/users/:userId', requireAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      // Delete user and all related data
      await Promise.all([
        client`DELETE FROM chat_messages WHERE user_id = ${userId}`,
        client`DELETE FROM chat_sessions WHERE user_id = ${userId}`,
        client`DELETE FROM call_logs WHERE user_id = ${userId}`,
        client`DELETE FROM campaigns WHERE user_id = ${userId}`,
        client`DELETE FROM leads WHERE user_id = ${userId}`
      ]);
      
      const [deletedUser] = await client`
        DELETE FROM users WHERE id = ${userId}
        RETURNING username, email
      `;
      
      if (!deletedUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      logger.info(`[ADMIN] User ${userId} (${deletedUser.username}) deleted by ${req.session.username}`);
      res.json({ success: true, deletedUser });
    } catch (error) {
      logger.error('Error deleting user:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  });


  
  // ==================== MEGA ADMIN ENDPOINTS ====================
  
  // Get all chats from all users
  app.get('/api/admin/chats', requireAdmin, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const search = req.query.search as string || '';
      
      let query;
      if (search) {
        query = client`
          SELECT cm.*, cs.title, u.username, u.email
          FROM chat_messages cm
          JOIN chat_sessions cs ON cm.session_id = cs.id
          JOIN users u ON cm.user_id = u.id
          WHERE cm.message ILIKE ${'%' + search + '%'}
          ORDER BY cm.timestamp DESC
          LIMIT ${limit}
        `;
      } else {
        query = client`
          SELECT cm.*, cs.title, u.username, u.email
          FROM chat_messages cm
          JOIN chat_sessions cs ON cm.session_id = cs.id
          JOIN users u ON cm.user_id = u.id
          ORDER BY cm.timestamp DESC
          LIMIT ${limit}
        `;
      }
      
      const messages = await query;
      res.json({ success: true, messages });
    } catch (error) {
      logger.error('Error fetching chats:', error);
      res.status(500).json({ error: 'Failed to fetch chats' });
    }
  });

  // Get all leads
  app.get('/api/admin/leads', requireAdmin, async (req: any, res) => {
    try {
      const leads = await client`
        SELECT l.*, u.username, u.email as user_email
        FROM leads l
        JOIN users u ON l.user_id = u.id
        ORDER BY l.created_at DESC
      `;
      res.json({ success: true, leads });
    } catch (error) {
      logger.error('Error fetching leads:', error);
      res.status(500).json({ error: 'Failed to fetch leads' });
    }
  });

  // Get all campaigns
  app.get('/api/admin/campaigns', requireAdmin, async (req: any, res) => {
    try {
      const campaigns = await client`
        SELECT c.*, u.username, u.email as user_email
        FROM campaigns c
        JOIN users u ON c.user_id = u.id
        ORDER BY c.created_at DESC
      `;
      res.json({ success: true, campaigns });
    } catch (error) {
      logger.error('Error fetching campaigns:', error);
      res.status(500).json({ error: 'Failed to fetch campaigns' });
    }
  });

  // Get all call logs with details
  app.get('/api/admin/calls', requireAdmin, async (req: any, res) => {
    try {
      const calls = await client`
        SELECT cl.*, u.username, u.email as user_email,
               l.name as lead_name, l.phone as lead_phone
        FROM call_logs cl
        JOIN users u ON cl.user_id = u.id
        LEFT JOIN leads l ON cl.lead_id = l.id
        ORDER BY cl.created_at DESC
        LIMIT 100
      `;
      res.json({ success: true, calls });
    } catch (error) {
      logger.error('Error fetching calls:', error);
      res.status(500).json({ error: 'Failed to fetch calls' });
    }
  });

  // Create new user (admin)
  app.post('/api/admin/users/create', requireAdmin, async (req: any, res) => {
    try {
      const { username, email, password, subscription_plan } = req.body;
      
      if (!username || !email || !password) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Check if user exists
      const existing = await client`
        SELECT id FROM users WHERE username = ${username} OR email = ${email}
      `;
      
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Username or email already exists' });
      }

      // Hash password
      const salt = randomBytes(16).toString("hex");
      const buf = (await scryptAsync(password, salt, 64)) as Buffer;
      const hashedPassword = `${buf.toString("hex")}.${salt}`;

      const userId = `user_${Date.now()}_${randomBytes(6).toString('hex')}`;

      const [newUser] = await client`
        INSERT INTO users (
          id, username, email, password, subscription_plan,
          subscription_status, created_at, updated_at
        ) VALUES (
          ${userId}, ${username}, ${email}, ${hashedPassword},
          ${subscription_plan || 'starter'}, 'active', NOW(), NOW()
        )
        RETURNING id, username, email, subscription_plan, subscription_status, created_at
      `;

      logger.info(`[ADMIN] User created: ${username} by ${req.session.username}`);
      res.json({ success: true, user: newUser });
    } catch (error) {
      logger.error('Error creating user:', error);
      res.status(500).json({ error: 'Failed to create user' });
    }
  });

  // Global search
  app.get('/api/admin/search', requireAdmin, async (req: any, res) => {
    try {
      const query = req.query.q as string;
      
      if (!query) {
        return res.status(400).json({ error: 'Search query required' });
      }

      const [users, chats, leads, campaigns] = await Promise.all([
        client`SELECT id, username, email FROM users WHERE username ILIKE ${'%' + query + '%'} OR email ILIKE ${'%' + query + '%'} LIMIT 10`,
        client`SELECT id, message, timestamp FROM chat_messages WHERE message ILIKE ${'%' + query + '%'} LIMIT 10`,
        client`SELECT id, name, email, phone FROM leads WHERE name ILIKE ${'%' + query + '%'} OR email ILIKE ${'%' + query + '%'} LIMIT 10`,
        client`SELECT id, name, description FROM campaigns WHERE name ILIKE ${'%' + query + '%'} OR description ILIKE ${'%' + query + '%'} LIMIT 10`
      ]);

      res.json({
        success: true,
        results: { users, chats, leads, campaigns }
      });
    } catch (error) {
      logger.error('Error searching:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  });

  // Activity feed
  app.get('/api/admin/activity', requireAdmin, async (req: any, res) => {
    try {
      const [recentUsers, recentCalls, recentMessages] = await Promise.all([
        client`SELECT username, created_at FROM users ORDER BY created_at DESC LIMIT 5`,
        client`SELECT cl.phone_number, cl.created_at, u.username 
               FROM call_logs cl JOIN users u ON cl.user_id = u.id 
               ORDER BY cl.created_at DESC LIMIT 5`,
        client`SELECT COUNT(*) as count FROM chat_messages WHERE timestamp > NOW() - INTERVAL '24 hours'`
      ]);

      res.json({
        success: true,
        activity: {
          recentUsers,
          recentCalls,
          messagesLast24h: recentMessages[0]?.count || 0
        }
      });
    } catch (error) {
      logger.error('Error fetching activity:', error);
      res.status(500).json({ error: 'Failed to fetch activity' });
    }
  });


  
  // Get user usage stats
  app.get('/api/user/usage', requireAuth, async (req: any, res) => {
    const userId = req.session.userId;

    // Hole User direkt aus der Datenbank
    const [user] = await client`
      SELECT
        id,
        username,
        email,
        subscription_plan AS "subscriptionPlan",
        ai_messages_used AS "aiMessagesUsed",
        voice_calls_used AS "voiceCallsUsed"
      FROM users
      WHERE id = ${userId}
    `;

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const plan = user.subscriptionPlan || 'free';

    // Fetch limits from subscription_plans table
    const [planData] = await client`
      SELECT 
        voice_calls_limit AS "voiceCallsLimit",
        ai_messages_limit AS "aiMessagesLimit"
      FROM subscription_plans
      WHERE id = ${plan}
    `;

    // Fallback to free plan limits if plan not found
    const voiceCallsLimit = planData?.voiceCallsLimit ?? 2;
    const aiMessagesLimit = planData?.aiMessagesLimit ?? 10;

    res.json({
      success: true,
      usage: {
        calls: {
          used: user.voiceCallsUsed || 0,
          limit: voiceCallsLimit,
          remaining: Math.max(0, voiceCallsLimit - (user.voiceCallsUsed || 0)),
        },
        messages: {
          used: user.aiMessagesUsed || 0,
          limit: aiMessagesLimit,
          remaining: Math.max(0, aiMessagesLimit - (user.aiMessagesUsed || 0)),
        },
        plan,
        planName: plan.charAt(0).toUpperCase() + plan.slice(1),
      },
    });
  });

  // ========================================================
  // USER SETTINGS & PROFILE
  // ========================================================

  // Update user profile
  app.put('/api/user/profile', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { username, email, firstName, lastName } = req.body;

      if (!username) {
        return res.status(400).json({ message: 'Username is required' });
      }

      await client`
        UPDATE users 
        SET 
          username = ${username},
          email = ${email || null},
          first_name = ${firstName || null},
          last_name = ${lastName || null},
          updated_at = NOW()
        WHERE id = ${userId}
      `;

      res.json({ success: true, message: 'Profile updated successfully' });
    } catch (error) {
      console.error('[Settings] Profile update error:', error);
      res.status(500).json({ message: 'Failed to update profile' });
    }
  });

  // Change password
  app.post('/api/user/change-password', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { currentPassword, newPassword, confirmPassword } = req.body;

      if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({ message: 'All fields are required' });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({ message: 'Passwords do not match' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
      }

      // Get user
      const [user] = await client`SELECT * FROM users WHERE id = ${userId}`;
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      await client`
        UPDATE users 
        SET password = ${hashedPassword}, updated_at = NOW()
        WHERE id = ${userId}
      `;

      res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
      console.error('[Settings] Password change error:', error);
      res.status(500).json({ message: 'Failed to change password' });
    }
  });

  // Update notification settings
  app.put('/api/user/notification-settings', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const settings = req.body;

      await client`
        UPDATE users 
        SET 
          notification_settings = ${JSON.stringify(settings)},
          updated_at = NOW()
        WHERE id = ${userId}
      `;

      res.json({ success: true, message: 'Notification settings updated' });
    } catch (error) {
      console.error('[Settings] Notification settings error:', error);
      res.status(500).json({ message: 'Failed to update settings' });
    }
  });

  // Update privacy settings
  app.put('/api/user/privacy-settings', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const settings = req.body;

      await client`
        UPDATE users 
        SET 
          privacy_settings = ${JSON.stringify(settings)},
          updated_at = NOW()
        WHERE id = ${userId}
      `;

      res.json({ success: true, message: 'Privacy settings updated' });
    } catch (error) {
      console.error('[Settings] Privacy settings error:', error);
      res.status(500).json({ message: 'Failed to update settings' });
    }
  });

  // Delete account
  app.delete('/api/user/delete-account', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;

      // Delete user's data (contacts, calls, etc.)
      await client`DELETE FROM contacts WHERE user_id = ${userId}`;
      await client`DELETE FROM voice_tasks WHERE user_id = ${userId}`;
      await client`DELETE FROM calendar_events WHERE user_id = ${userId}`;
      
      // Delete user
      await client`DELETE FROM users WHERE id = ${userId}`;

      // Destroy session
      req.session.destroy();

      res.json({ success: true, message: 'Account deleted successfully' });
    } catch (error) {
      console.error('[Settings] Delete account error:', error);
      res.status(500).json({ message: 'Failed to delete account' });
    }
  });

  // ========================================================
  // FEEDBACK & BUG REPORTS (Alpha Phase)
  // ========================================================

  // Submit feedback or bug report
  app.post('/api/feedback', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { type, rating, title, description, screenshot, pageUrl, userAgent, browserInfo } = req.body;

      if (!type || !description || !pageUrl) {
        return res.status(400).json({ message: 'Type, description, and pageUrl are required' });
      }

      if (type !== 'feedback' && type !== 'bug') {
        return res.status(400).json({ message: 'Type must be "feedback" or "bug"' });
      }

      const [newFeedback] = await client`
        INSERT INTO feedback (
          user_id, type, rating, title, description, screenshot, 
          page_url, user_agent, browser_info, status, priority
        )
        VALUES (
          ${userId}, ${type}, ${rating || null}, ${title || null}, ${description},
          ${screenshot || null}, ${pageUrl}, ${userAgent || null}, 
          ${JSON.stringify(browserInfo || {})}, 'new', 
          ${type === 'bug' ? 'high' : 'medium'}
        )
        RETURNING *
      `;

      console.log('[Feedback] New submission:', { id: newFeedback.id, type, userId });

      res.json({ 
        success: true, 
        message: type === 'bug' ? 'Bug report submitted!' : 'Feedback submitted!',
        feedbackId: newFeedback.id
      });
    } catch (error) {
      console.error('[Feedback] Submit error:', error);
      res.status(500).json({ message: 'Failed to submit feedback' });
    }
  });

  // Get all feedback (for admin dashboard later)
  app.get('/api/admin/feedback', requireAdmin, async (req: any, res) => {
    try {
      const { status, type } = req.query;
      
      let query = client`SELECT * FROM feedback`;
      
      if (status) {
        query = client`SELECT * FROM feedback WHERE status = ${status}`;
      }
      
      if (type) {
        query = client`SELECT * FROM feedback WHERE type = ${type}`;
      }
      
      const feedbackList = await query;
      
      res.json({ feedback: feedbackList });
    } catch (error) {
      console.error('[Feedback] Get all error:', error);
      res.status(500).json({ message: 'Failed to fetch feedback' });
    }
  });

  app.get('/api/debug/users/all', async (req: any, res) => {
    try {
      const allUsers = await client`SELECT id, username, email, subscription_plan, ai_messages_used, voice_calls_used FROM users LIMIT 20`;
      res.json({ users: allUsers });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });


  // ========================================================
  // USER PHONEBOOK / CONTACTS
  // ========================================================
  app.get('/api/user/contacts', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const contacts = await storage.getUserContacts(userId);
      res.json(contacts);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      res.status(500).json({ message: 'Failed to fetch contacts' });
    }
  });

  app.get('/api/user/contacts/search', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { name } = req.query;
      if (!name) {
        return res.json({ found: false });
      }
      const contact = await storage.findContactByName(userId, name as string);
      res.json(contact ? { found: true, contact } : { found: false });
    } catch (error) {
      console.error('Error searching contact:', error);
      res.status(500).json({ message: 'Failed to search contact' });
    }
  });

  app.post('/api/user/contacts', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { name, phoneNumber } = req.body;
      if (!name || !phoneNumber) {
        return res.status(400).json({ message: 'Name and phone number required' });
      }
      const contact = await storage.createContact(userId, name, phoneNumber);
      res.json(contact);
    } catch (error) {
      console.error('Error creating contact:', error);
      res.status(500).json({ message: 'Failed to create contact' });
    }
  });

  // Get call history for a specific contact
  app.get('/api/user/call-history/:phoneNumber', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { phoneNumber } = req.params;
      const history = await storage.getCallHistoryByPhone(userId, phoneNumber);
      res.json(history);
    } catch (error) {
      console.error('Error fetching call history:', error);
      res.status(500).json({ message: 'Failed to fetch call history' });
    }
  });

  // ========================================================
  // POWER PAGE / SMART CALLS - Neue Funktion
  // Intelligente Middleware (Gemini) + Menschliche Stimme (ElevenLabs)
  // Diese Route ersetzt die alte, tote '/api/calls'
  // ========================================================
  // ElevenLabs Webhook - Empfängt Call-Updates mit HMAC-Verification
  app.post('/api/elevenlabs/webhook', async (req: any, res) => {
    try {
      // Ausführliches Logging für Debugging
      logger.info('[ELEVENLABS-WEBHOOK] Incoming webhook', {
        headers: req.headers,
        bodyType: typeof req.body,
        bodyKeys: req.body ? Object.keys(req.body) : [],
        hasSecret: !!process.env.ELEVENLABS_WEBHOOK_SECRET
      });
      
      const webhookData = req.body;
      
      // HMAC Signature Verification (optional für Testing)
      const signature = req.headers['x-elevenlabs-signature'] || 
                       req.headers['elevenlabs-signature'] ||
                       req.headers['xi-signature'];
      const webhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;
      
      if (webhookSecret && signature) {
        try {
          const crypto = await import('crypto');
          const bodyString = JSON.stringify(webhookData);
          const hmac = crypto.createHmac('sha256', webhookSecret);
          hmac.update(bodyString);
          const expectedSignature = hmac.digest('hex');
          
          logger.info('[ELEVENLABS-WEBHOOK] Signature check', {
            received: signature,
            expected: expectedSignature.substring(0, 20) + '...',
            match: signature === expectedSignature
          });
          
          // Für jetzt: Nur warnen, nicht blocken
          if (signature !== expectedSignature) {
            logger.warn('[ELEVENLABS-WEBHOOK] Signature mismatch - processing anyway for debugging');
          } else {
            logger.info('[ELEVENLABS-WEBHOOK] Signature verified ✓');
          }
        } catch (sigError: any) {
          logger.error('[ELEVENLABS-WEBHOOK] Signature verification error', { error: sigError.message });
        }
      } else {
        logger.info('[ELEVENLABS-WEBHOOK] No signature verification (secret or signature missing)');
      }
      
      logger.info('[ELEVENLABS-WEBHOOK] ========== WEBHOOK DATA ==========');
      logger.info('[ELEVENLABS-WEBHOOK] Full webhook data:', JSON.stringify(webhookData, null, 2));
      logger.info('[ELEVENLABS-WEBHOOK] Top-level keys:', Object.keys(webhookData));
      
      // ElevenLabs nests data in a 'data' object!
      const payload = webhookData.data || webhookData;
      logger.info('[ELEVENLABS-WEBHOOK] Payload keys:', Object.keys(payload));
      
      // Extract data - try different possible field names
      const event_type = webhookData.type || webhookData.event_type || payload.type || payload.event_type;
      const conversation_id = payload.conversation_id || 
                              payload.call_id || 
                              payload.id || 
                              payload.sid || 
                              payload.callSid ||
                              webhookData.conversation_id;
      const transcript = payload.transcript || payload.text || payload.transcription;
      const recording_url = payload.recording_url || payload.recordingUrl;
      const audio_url = payload.audio_url || payload.audioUrl || payload.audio;
      const call_status = payload.call_status || payload.callStatus;
      const status = payload.status;
      const error = payload.error;
      const metadata = payload.metadata || webhookData.metadata || {};
      
      logger.info('[ELEVENLABS-WEBHOOK] 🔍 Extracted data:', {
        event_type,
        conversation_id,
        hasTranscript: !!transcript,
        hasRecording: !!(recording_url || audio_url),
        status
      });
      
      if (!conversation_id) {
        logger.error('[ELEVENLABS-WEBHOOK] ❌ NO CONVERSATION ID FOUND!');
        logger.error('[ELEVENLABS-WEBHOOK] Top-level fields:', Object.keys(webhookData));
        logger.error('[ELEVENLABS-WEBHOOK] Payload fields:', Object.keys(payload));
        return res.status(200).json({ received: true, warning: 'No conversation ID found' });
      }
      
      // Handle verschiedene Event-Typen
      switch (event_type) {
        case 'conversation.transcript':
          logger.info('[ELEVENLABS-WEBHOOK] Transcript received', {
            conversationId: conversation_id,
            transcriptLength: transcript?.length
          });
          if (conversation_id && transcript) {
            await storage.updateCallLogByConversationId(conversation_id, { 
              transcript,
              metadata: { transcriptReceivedAt: new Date().toISOString() }
            });
          }
          break;
          
        case 'conversation.audio':
        case 'conversation.recording_ready':
          logger.info('[ELEVENLABS-WEBHOOK] Audio/Recording received', {
            conversationId: conversation_id,
            audioUrl: audio_url || recording_url
          });
          if (conversation_id && (audio_url || recording_url)) {
            await storage.updateCallLogByConversationId(conversation_id, { 
              recordingUrl: audio_url || recording_url,
              metadata: { recordingReceivedAt: new Date().toISOString() }
            });
          }
          break;
          
        case 'conversation.ended':
        case 'conversation.completed':
          logger.info('[ELEVENLABS-WEBHOOK] Call completed', {
            conversationId: conversation_id,
            status: call_status || status,
            hasTranscript: !!transcript,
            hasRecording: !!(audio_url || recording_url)
          });
          if (conversation_id) {
            await storage.updateCallLogByConversationId(conversation_id, { 
              status: 'completed',
              transcript: transcript || undefined,
              recordingUrl: audio_url || recording_url || undefined,
              duration: metadata?.duration_seconds || undefined,
              metadata: { 
                completedAt: new Date().toISOString(),
                finalStatus: call_status || status,
                ...metadata
              }
            });
          }
          break;
          
        case 'call.initiation.failed':
        case 'conversation.failed':
          logger.error('[ELEVENLABS-WEBHOOK] Call failed', {
            conversationId: conversation_id,
            error: error,
            status: call_status || status
          });
          if (conversation_id) {
            await storage.updateCallLogByConversationId(conversation_id, { 
              status: 'failed',
              metadata: { 
                failedAt: new Date().toISOString(),
                errorMessage: error,
                errorStatus: call_status || status
              }
            });
          }
          break;
          
        default:
          logger.info('[ELEVENLABS-WEBHOOK] Unknown event type', { 
            event_type,
            conversationId: conversation_id 
          });
          // Try to save any data we have
          if (conversation_id && (transcript || audio_url || recording_url)) {
            await storage.updateCallLogByConversationId(conversation_id, {
              transcript: transcript || undefined,
              recordingUrl: audio_url || recording_url || undefined,
              metadata: { 
                unknownEventType: event_type,
                receivedAt: new Date().toISOString()
              }
            });
          }
      }
      
      res.status(200).json({ received: true });
    } catch (error: any) {
      logger.error('[ELEVENLABS-WEBHOOK] Error processing webhook', { 
        error: error.message,
        stack: error.stack 
      });
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });
  
  // Get all call logs for current user (for history display)
  app.get('/api/user/call-logs', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      
      logger.info('[CALL-LOGS] Fetching call history for user:', userId);
      
      // Get all call logs from database for this user
      const callLogs = await storage.getUserCallLogs(userId);
      
      logger.info('[CALL-LOGS] Found logs:', { 
        count: callLogs.length,
        userId 
      });
      
      // Sort by newest first and format for frontend
      const formattedLogs = callLogs
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .map((log: any) => {
          // Extract summary from metadata if exists
          const summary = log.metadata?.summary || null;
          const summaryShort = summary?.outcome 
            ? (summary.outcome.length > 120 ? summary.outcome.substring(0, 117) + '...' : summary.outcome)
            : null;
          
          return {
            id: log.id,
            phoneNumber: log.phoneNumber,
            contactName: log.metadata?.contactName || null,
            status: log.status,
            transcript: log.transcript,
            recordingUrl: log.recordingUrl,
            duration: log.duration,
            customPrompt: log.customPrompt,
            metadata: log.metadata,
            createdAt: log.createdAt,
            // NEW: Summary fields for call history display
            summaryShort: summaryShort,
            summaryStatus: summary ? 'ready' : (log.status === 'completed' ? 'pending' : null),
            summary: summary
          };
        });
      
      res.json(formattedLogs);
    } catch (error: any) {
      logger.error('[CALL-LOGS] Error fetching logs', { 
        error: error.message 
      });
      res.status(500).json({ 
        error: 'Failed to fetch call logs' 
      });
    }
  });
  
  // Get call details from database by callId (for frontend polling)
  app.get('/api/aras-voice/call-details/:callId', requireAuth, async (req: any, res) => {
    try {
      const { callId } = req.params;
      const userId = req.session.userId;
      
      logger.info('[CALL-DETAILS] ===== FETCHING CALL DETAILS =====', { 
        callId, 
        userId,
        timestamp: new Date().toISOString()
      });
      
      // Get call log from database
      const callLog = await storage.getCallLog(callId);
      
      if (!callLog) {
        logger.warn('[CALL-DETAILS] ❌ Call log NOT FOUND in database', { callId });
        return res.status(404).json({ 
          success: false, 
          error: 'Call log not found' 
        });
      }
      
      logger.info('[CALL-DETAILS] ✅ Call log FOUND', {
        id: callLog.id,
        userId: callLog.userId,
        phoneNumber: callLog.phoneNumber,
        status: callLog.status,
        retellCallId: callLog.retellCallId
      });
      
      // Verify user owns this call
      if (callLog.userId !== userId) {
        logger.warn('[CALL-DETAILS] ⛔ Unauthorized access attempt', { 
          callId, 
          requestUserId: userId, 
          ownerId: callLog.userId 
        });
        return res.status(403).json({ 
          success: false, 
          error: 'Unauthorized' 
        });
      }
      
      logger.info('[CALL-DETAILS] 📊 Call data status:', { 
        callId, 
        hasTranscript: !!callLog.transcript,
        transcriptLength: callLog.transcript?.length || 0,
        transcriptType: typeof callLog.transcript,
        hasRecording: !!callLog.recordingUrl,
        recordingUrl: callLog.recordingUrl,
        recordingUrlType: typeof callLog.recordingUrl,
        recordingUrlValue: JSON.stringify(callLog.recordingUrl),
        status: callLog.status,
        duration: callLog.duration || 'null',
        metadata: callLog.metadata || 'null'
      });
      
      // Clean and parse transcript if it's an array
      let cleanedTranscript = callLog.transcript;
      if (cleanedTranscript) {
        try {
          // Try parsing if it's a JSON string
          const parsed = typeof cleanedTranscript === 'string' ? JSON.parse(cleanedTranscript) : cleanedTranscript;
          
          if (Array.isArray(parsed)) {
            logger.info(`[CALL-DETAILS] 📋 Parsing transcript array with ${parsed.length} turns`);
            
            // Extract only the message content from each turn
            const conversationText = parsed
              .filter((turn: any) => {
                // Skip empty messages
                if (!turn.message) return false;
                // Skip interrupted messages that are just "..."
                if (turn.interrupted && turn.message.trim() === '...') return false;
                // Skip agent metadata without real content
                if (turn.message.trim().length === 0) return false;
                return true;
              })
              .map((turn: any) => {
                const role = turn.role === 'agent' ? 'ARAS AI' : 'Kunde';
                // Use original_message if available (contains full message before interruption)
                const message = turn.original_message || turn.message;
                return `${role}: ${message.trim()}`;
              })
              .join('\n\n');
            
            if (conversationText) {
              logger.info('[CALL-DETAILS] ✅ Cleaned transcript from array format');
              cleanedTranscript = conversationText;
            } else {
              logger.warn('[CALL-DETAILS] ⚠️ Transcript array resulted in empty text');
            }
          }
        } catch (e) {
          // If parsing fails, keep original
          logger.warn('[CALL-DETAILS] ⚠️ Could not parse transcript as JSON:', e);
        }
      }
      
      // FALLBACK: If recording URL is missing/empty but we have conversationId, query ElevenLabs API directly
      let finalCallData = { ...callLog, transcript: cleanedTranscript };
      
      // Check for missing or invalid recordingUrl (null, undefined, empty string, empty object)
      const hasValidRecordingUrl = callLog.recordingUrl && 
                                   typeof callLog.recordingUrl === 'string' && 
                                   callLog.recordingUrl.trim().length > 0 &&
                                   callLog.recordingUrl.startsWith('http');
      
      logger.info('[CALL-DETAILS] 🔍 Recording URL validation:', {
        hasValidRecordingUrl,
        willTriggerFallback: !hasValidRecordingUrl && !!callLog.retellCallId
      });
      
      // If no recording URL in DB but call is completed, use proxy endpoint
      if (!hasValidRecordingUrl && callLog.retellCallId) {
        logger.info('[CALL-DETAILS] 🔄 No recording URL in DB, checking if audio is available from ElevenLabs...', {
          conversationId: callLog.retellCallId,
          status: callLog.status
        });
        
        try {
          // Check ElevenLabs API for conversation status and metadata
          const elevenLabsResponse = await fetch(
            `https://api.elevenlabs.io/v1/convai/conversations/${callLog.retellCallId}`,
            {
              headers: {
                'xi-api-key': process.env.ELEVENLABS_API_KEY || ''
              }
            }
          );
          
          if (elevenLabsResponse.ok) {
            const elevenLabsData = await elevenLabsResponse.json();
            logger.info('[CALL-DETAILS] ✅ ElevenLabs conversation metadata:', {
              status: elevenLabsData.status,
              hasTranscript: !!elevenLabsData.transcript,
              duration: elevenLabsData.duration_seconds,
              analysis: elevenLabsData.analysis,
              availableFields: Object.keys(elevenLabsData)
            });
            
            // Update database with metadata from ElevenLabs
            const updateData: any = {};
            
            // Clean transcript if available
            if (elevenLabsData.transcript && !callLog.transcript) {
              let cleanedTranscript = elevenLabsData.transcript;
              if (typeof cleanedTranscript === 'string') {
                const jsonIndex = cleanedTranscript.indexOf('{"role":');
                if (jsonIndex > 0) {
                  cleanedTranscript = cleanedTranscript.substring(0, jsonIndex).trim();
                }
              }
              updateData.transcript = cleanedTranscript;
            }
            
            if (elevenLabsData.duration_seconds && !callLog.duration) {
              updateData.duration = elevenLabsData.duration_seconds;
            }
            
            // Normalize status
            if (elevenLabsData.status === 'done') {
              updateData.status = 'completed';
            } else if (elevenLabsData.status && elevenLabsData.status !== callLog.status) {
              updateData.status = elevenLabsData.status;
            }
            
            // If call is completed/done, generate proxy URL for audio
            if (elevenLabsData.status === 'done' || elevenLabsData.status === 'completed' || callLog.status === 'completed') {
              // Use our proxy endpoint to stream audio from ElevenLabs
              const proxyAudioUrl = `/api/aras-voice/audio/${callLog.retellCallId}`;
              updateData.recordingUrl = proxyAudioUrl;
              logger.info('[CALL-DETAILS] 🎙️ Generating proxy audio URL:', proxyAudioUrl);
            }
            
            if (Object.keys(updateData).length > 0) {
              logger.info('[CALL-DETAILS] 💾 Updating database with ElevenLabs metadata:', updateData);
              await storage.updateCallLogByConversationId(callLog.retellCallId, updateData);
              finalCallData = { ...callLog, ...updateData };
            }
          } else {
            logger.warn('[CALL-DETAILS] ⚠️ ElevenLabs API error:', {
              status: elevenLabsResponse.status,
              statusText: elevenLabsResponse.statusText
            });
          }
        } catch (apiError: any) {
          logger.error('[CALL-DETAILS] ❌ Error querying ElevenLabs API:', {
            error: apiError.message,
            conversationId: callLog.retellCallId
          });
        }
      }
      
      // 🎯 Generate ARAS Core Summary if not already exists
      const metadata = finalCallData.metadata as any || {};
      let callSummary = metadata?.summary || null;
      
      if (!callSummary && finalCallData.transcript && finalCallData.status === 'completed') {
        try {
          logger.info('[CALL-DETAILS] 📝 Generating ARAS Core Summary...');
          
          const { summarizeCallWithArasCore } = await import('./voice/call-summarizer');
          
          // Lade User für Kontext
          const user = await storage.getUser(userId);
          
          // Baue User-Kontext
          const userContext = user ? {
            userName: user.firstName || user.username,
            company: user.company || undefined,
            industry: user.industry || undefined
          } : undefined;
          
          // Baue Contact-Kontext falls vorhanden
          let contactContext;
          if (metadata?.contactId) {
            try {
              const contacts = await storage.getUserContacts(userId);
              const contact = contacts.find((c: any) => c.id === metadata.contactId);
              if (contact) {
                contactContext = {
                  name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.company,
                  company: contact.company
                };
              }
            } catch (e) {
              logger.warn('[CALL-DETAILS] Could not load contact context for summary');
            }
          }
          
          callSummary = await summarizeCallWithArasCore({
            transcript: finalCallData.transcript,
            userContext,
            contactContext
          });
          
          if (callSummary) {
            logger.info('[CALL-DETAILS] ✅ Summary generated', { 
              outcome: callSummary.outcome,
              sentiment: callSummary.sentiment 
            });
            
            // Speichere Summary in metadata
            const updatedMetadata = { 
              ...metadata, 
              summary: callSummary 
            };
            await storage.updateCallLog(callId, { metadata: updatedMetadata });
            
            // 🔥 Wenn contactId vorhanden: Füge kurze Notiz zu Kontakt hinzu
            if (metadata?.contactId && contactContext) {
              try {
                const contacts = await storage.getUserContacts(userId);
                const contact = contacts.find((c: any) => c.id === metadata.contactId);
                
                if (contact && finalCallData.createdAt) {
                  const callDate = new Date(finalCallData.createdAt).toLocaleDateString('de-DE');
                  const summaryNote = `\n\nLetzter Anruf (${callDate}):\n- Ergebnis: ${callSummary.outcome}\n- Nächster Schritt: ${callSummary.nextStep}`;
                  
                  const updatedNotes = (contact.notes || '') + summaryNote;
                  await storage.updateContact(metadata.contactId, { notes: updatedNotes });
                  
                  logger.info('[CALL-DETAILS] ✅ Summary zu Kontakt-Notizen hinzugefügt');
                }
              } catch (e: any) {
                logger.warn('[CALL-DETAILS] ⚠️ Could not update contact notes', { error: e.message });
              }
            }
          }
        } catch (error: any) {
          logger.error('[CALL-DETAILS] ❌ Summary generation failed', { 
            error: error.message 
          });
          // Nicht blockieren - Call-Details gehen trotzdem raus
        }
      }
      
      // Normalize transcript to guaranteed string for API consistency
      let transcriptText = '';
      let transcriptParseFailed = false;
      const rawTranscript = finalCallData.transcript;
      
      if (rawTranscript) {
        if (typeof rawTranscript === 'string') {
          // Already cleaned by earlier logic, or plain string
          transcriptText = rawTranscript;
        } else if (Array.isArray(rawTranscript)) {
          // Array of messages - join with role labels
          try {
            transcriptText = rawTranscript
              .filter((t: any) => t.message || t.text || t.content)
              .map((t: any) => {
                const role = t.role === 'agent' || t.role === 'assistant' ? 'ARAS AI' : 'Kunde';
                const msg = t.message || t.text || t.content || '';
                return `${role}: ${String(msg).trim()}`;
              })
              .join('\n\n');
          } catch {
            transcriptText = JSON.stringify(rawTranscript);
            transcriptParseFailed = true;
          }
        } else if (typeof rawTranscript === 'object') {
          // Object - check for nested transcript or stringify
          try {
            const nested = (rawTranscript as any).transcript || (rawTranscript as any).messages || (rawTranscript as any).text;
            if (nested && typeof nested === 'string') {
              transcriptText = nested;
            } else if (Array.isArray(nested)) {
              transcriptText = nested.map((t: any) => String(t.message || t.text || t)).join('\n\n');
            } else {
              transcriptText = JSON.stringify(rawTranscript);
              transcriptParseFailed = true;
            }
          } catch {
            transcriptText = '';
            transcriptParseFailed = true;
          }
        }
      }
      
      // Normalize duration to seconds (handles ms vs sec ambiguity)
      // Heuristic: if rawDuration >= 10000, assume ms (10000sec = 2.7h, unlikely for a call)
      const normalizeDurationSeconds = (rawDuration: any): number | null => {
        if (rawDuration == null) return null;
        const num = typeof rawDuration === 'string' ? parseFloat(rawDuration) : rawDuration;
        if (typeof num !== 'number' || isNaN(num) || num < 0) return null;
        // If >= 10000, assume milliseconds → convert to seconds
        if (num >= 10000) return Math.round(num / 1000);
        return Math.round(num);
      };
      
      const durationSeconds = normalizeDurationSeconds(finalCallData.duration);
      
      const responseData = {
        success: true,
        id: finalCallData.id,
        phoneNumber: finalCallData.phoneNumber,
        status: finalCallData.status,
        transcript: finalCallData.transcript,         // Original (backward compat)
        transcriptText: transcriptText,               // NEW: Always string
        transcriptParseFailed: transcriptParseFailed, // NEW: Flag if parsing failed
        recordingUrl: finalCallData.recordingUrl,
        duration: finalCallData.duration,             // Original (backward compat)
        durationSeconds: durationSeconds,             // NEW: Normalized to seconds
        metadata: finalCallData.metadata,
        createdAt: finalCallData.createdAt,
        summary: callSummary
      };
      
      logger.info('[CALL-DETAILS] ✅ Sending response to frontend', {
        hasTranscript: !!responseData.transcript,
        hasTranscriptText: !!transcriptText,
        transcriptTextLength: transcriptText.length,
        hasRecording: !!responseData.recordingUrl,
        status: responseData.status,
        hasSummary: !!callSummary,
        duration: finalCallData.duration,
        durationSeconds: durationSeconds
      });
      
      res.json(responseData);
    } catch (error: any) {
      logger.error('[CALL-DETAILS] ❌ ERROR fetching call details', { 
        error: error.message,
        stack: error.stack 
      });
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch call details' 
      });
    }
  });
  
  // Audio proxy endpoint - streams audio from ElevenLabs on-demand
  app.get('/api/aras-voice/audio/:conversationId', requireAuth, async (req: any, res) => {
    try {
      const { conversationId } = req.params;
      const userId = req.session.userId;
      
      logger.info('[AUDIO-PROXY] 🎙️ Audio request received:', { 
        conversationId, 
        userId 
      });
      
      // Verify user owns this conversation
      const callLog = await storage.getCallLogByConversationId(conversationId);
      if (!callLog) {
        logger.warn('[AUDIO-PROXY] ❌ Call log not found:', conversationId);
        return res.status(404).json({ error: 'Call not found' });
      }
      
      if (callLog.userId !== userId) {
        logger.warn('[AUDIO-PROXY] ⛔ Unauthorized audio access:', {
          conversationId,
          requestUserId: userId,
          ownerId: callLog.userId
        });
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      logger.info('[AUDIO-PROXY] ✅ Authorization passed, fetching audio from ElevenLabs...');
      
      // Fetch audio from ElevenLabs
      const audioResponse = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}/audio`,
        {
          headers: {
            'xi-api-key': process.env.ELEVENLABS_API_KEY || ''
          }
        }
      );
      
      if (!audioResponse.ok) {
        logger.error('[AUDIO-PROXY] ❌ ElevenLabs audio API error:', {
          status: audioResponse.status,
          statusText: audioResponse.statusText,
          conversationId
        });
        return res.status(audioResponse.status).json({ 
          error: `Failed to fetch audio: ${audioResponse.statusText}` 
        });
      }
      
      logger.info('[AUDIO-PROXY] 📡 Streaming audio to client:', {
        conversationId,
        contentType: audioResponse.headers.get('content-type'),
        contentLength: audioResponse.headers.get('content-length')
      });
      
      // Set appropriate headers for audio streaming
      const contentType = audioResponse.headers.get('content-type') || 'audio/mpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      
      const contentLength = audioResponse.headers.get('content-length');
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }
      
      // Stream audio data to client
      const audioBuffer = await audioResponse.arrayBuffer();
      res.send(Buffer.from(audioBuffer));
      
      logger.info('[AUDIO-PROXY] ✅ Audio streamed successfully:', conversationId);
    } catch (error: any) {
      logger.error('[AUDIO-PROXY] ❌ Error streaming audio:', {
        error: error.message,
        stack: error.stack,
        conversationId: req.params.conversationId
      });
      res.status(500).json({ 
        error: 'Failed to stream audio' 
      });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // SAFE RECORDING DOWNLOAD - Always works (proxy for CORS, proper headers)
  // ═══════════════════════════════════════════════════════════════
  app.get('/api/aras-voice/call-recording/:callId/download', requireAuth, async (req: any, res) => {
    try {
      const { callId } = req.params;
      const userId = req.session.userId;
      
      logger.info('[RECORDING-DOWNLOAD] 📥 Download request:', { callId, userId });
      
      // Get call log from database
      const callLog = await storage.getCallLog(callId);
      if (!callLog) {
        logger.warn('[RECORDING-DOWNLOAD] ❌ Call not found:', callId);
        return res.status(404).json({ error: 'Call not found' });
      }
      
      // AuthZ: only owner can download
      if (callLog.userId !== userId) {
        logger.warn('[RECORDING-DOWNLOAD] ⛔ Unauthorized:', { callId, requestUserId: userId, ownerId: callLog.userId });
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      // Determine audio source
      let audioBuffer: Buffer | null = null;
      let contentType = 'audio/mpeg';
      
      // Priority 1: Use conversationId (retellCallId) to fetch from ElevenLabs
      if (callLog.retellCallId) {
        logger.info('[RECORDING-DOWNLOAD] 🔄 Fetching from ElevenLabs:', callLog.retellCallId);
        try {
          const audioResponse = await fetch(
            `https://api.elevenlabs.io/v1/convai/conversations/${callLog.retellCallId}/audio`,
            {
              headers: {
                'xi-api-key': process.env.ELEVENLABS_API_KEY || ''
              }
            }
          );
          
          if (audioResponse.ok) {
            audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
            contentType = audioResponse.headers.get('content-type') || 'audio/mpeg';
            logger.info('[RECORDING-DOWNLOAD] ✅ ElevenLabs audio fetched:', { size: audioBuffer.length });
          } else {
            logger.warn('[RECORDING-DOWNLOAD] ⚠️ ElevenLabs API error:', audioResponse.status);
          }
        } catch (e: any) {
          logger.error('[RECORDING-DOWNLOAD] ❌ ElevenLabs fetch error:', e.message);
        }
      }
      
      // Priority 2: If recordingUrl is external HTTPS, proxy fetch it
      if (!audioBuffer && callLog.recordingUrl && callLog.recordingUrl.startsWith('https://')) {
        logger.info('[RECORDING-DOWNLOAD] 🔄 Proxying external URL:', callLog.recordingUrl);
        try {
          const audioResponse = await fetch(callLog.recordingUrl);
          if (audioResponse.ok) {
            audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
            contentType = audioResponse.headers.get('content-type') || 'audio/mpeg';
            logger.info('[RECORDING-DOWNLOAD] ✅ External audio fetched:', { size: audioBuffer.length });
          }
        } catch (e: any) {
          logger.error('[RECORDING-DOWNLOAD] ❌ External fetch error:', e.message);
        }
      }
      
      // No audio available
      if (!audioBuffer) {
        logger.warn('[RECORDING-DOWNLOAD] ❌ No audio available for call:', callId);
        return res.status(404).json({ 
          error: 'Recording not available',
          details: 'Audio has not been processed yet or is unavailable'
        });
      }
      
      // Generate filename
      const date = new Date(callLog.createdAt || Date.now()).toISOString().split('T')[0];
      const filename = `ARAS_CALL_${callId}_${date}.mp3`;
      
      // Set download headers
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', audioBuffer.length);
      res.setHeader('Cache-Control', 'private, max-age=0');
      
      logger.info('[RECORDING-DOWNLOAD] ✅ Sending file:', { filename, size: audioBuffer.length });
      res.send(audioBuffer);
      
    } catch (error: any) {
      logger.error('[RECORDING-DOWNLOAD] ❌ Error:', { error: error.message, stack: error.stack });
      res.status(500).json({ error: 'Failed to download recording' });
    }
  });
  
  // Legacy: Get call details by conversation_id (polls ElevenLabs API)
  app.get('/api/aras-voice/call-status/:conversationId', requireAuth, async (req: any, res) => {
    try {
      const { conversationId } = req.params;
      
      // Poll ElevenLabs API for call status
      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
        {
          headers: {
            'xi-api-key': process.env.ELEVENLABS_API_KEY || ''
          }
        }
      );
      
      const callData = await response.json();
      
      res.json({
        success: true,
        conversationId: callData.conversation_id,
        status: callData.status,
        transcript: callData.transcript,
        recordingUrl: callData.recording_url,
        startTime: callData.start_time,
        endTime: callData.end_time,
        duration: callData.duration_seconds
      });
    } catch (error: any) {
      logger.error('[CALL-STATUS] Error fetching call status', { error: error.message });
      res.status(500).json({ 
        success: false,
        error: 'Failed to fetch call status' 
      });
    }
  });

  // 🔥 NEUE ROUTE: Prompt-Validierung mit Gemini 2.5 Flash
  app.post('/api/aras-voice/validate-prompt', requireAuth, async (req: any, res) => {
    try {
      const { message, contactName, answers, contactId, phoneNumber, templateId, templateScenario } = req.body;
      const userId = req.session.userId;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ error: 'Nicht authentifiziert' });
      }

      logger.info('[VALIDATE-PROMPT] Starting validation...', { 
        userId, 
        messageLength: message?.length,
        hasAnswers: !!answers,
        hasContactId: !!contactId,
        hasTemplate: !!templateId,
        templateScenario
      });

      // 🔥 Lade Contact-Kontext wenn contactId oder phoneNumber vorhanden
      let contactContext: any = undefined;
      if (contactId) {
        try {
          const contacts = await storage.getUserContacts(userId);
          const contact = contacts.find((c: any) => c.id === contactId);
          if (contact) {
            contactContext = {
              name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.company,
              company: contact.company,
              phone: contact.phone,
              email: contact.email,
              notes: contact.notes
            };
            logger.info('[VALIDATE-PROMPT] Contact context loaded', { contactId, hasNotes: !!contact.notes });
          }
        } catch (error) {
          logger.warn('[VALIDATE-PROMPT] Could not load contact context', { error });
          // Nicht blockieren, einfach ohne contactContext weitermachen
        }
      }

      const { validateAndEnhancePrompt } = await import('./voice/prompt-validator');
      
      // Baue vollständigen User-Kontext mit ALLEN Daten
      const result = await validateAndEnhancePrompt({
        userInput: message,
        contactName,
        previousAnswers: answers || {},
        contactContext,
        templateId: templateId || null,
        templateScenario: templateScenario || null,
        userContext: {
          userName: user.firstName || user.username,
          company: user.company || undefined,
          website: user.website || undefined,
          industry: user.industry || undefined,
          role: user.jobRole || undefined,
          language: user.language || undefined,
          aiProfile: user.aiProfile || {}
        }
      });

      logger.info('[VALIDATE-PROMPT] Validation complete', {
        isComplete: result.isComplete,
        hasQuestions: (result.questions?.length || 0) > 0
      });

      res.json(result);
    } catch (error: any) {
      logger.error('[VALIDATE-PROMPT] Error:', error);
      res.status(500).json({ error: error.message || 'Validierung fehlgeschlagen' });
    }
  });

  app.post('/api/aras-voice/smart-call', requireAuth, checkCallLimit, async (req: any, res) => {
  try {
    const userId = req.session.userId;
    
    // 1. Hole Rohdaten vom Frontend (call-form.tsx)
    const { name, phoneNumber, message } = req.body;
    if (!name || !phoneNumber || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name, Telefonnummer und Anliegen werden benötigt.' 
      });
    }

    // 2. Hole Nutzer-Kontext aus der Datenbank (z.B. "Manuel")
    const user = await storage.getUser(userId);
    if (!user) {
      // 4401 ist ein guter Code für "Session abgelaufen"
      return res.status(4401).json({ success: false, error: 'Nutzer nicht gefunden oder Session abgelaufen' });
    }
    
    logger.info('[SMART-CALL] Starte Anruf-Vorbereitung...', { userId, contact: name });

    // 2.5 WICHTIG: Erhöhe Counter SOFORT um Race Conditions zu verhindern
    // Wenn der Call fehlschlägt, machen wir Rollback
    logger.info('[SMART-CALL] Tracking usage BEFORE call to prevent race condition');
    await storage.trackUsage(userId, 'voice_call', `Smart Call an ${name}: ${message}`);
    
    let callSuccessful = false;
    let enhancedContext: any;

    try {
      // 3. Rufe das 'Gehirn' auf (Gemini) mit vollständigem UserContext
      const { enhanceCallWithGemini } = await import('./voice/gemini-prompt-enhancer');
      enhancedContext = await enhanceCallWithGemini(
        { contactName: name, phoneNumber, message },
        { 
          userName: user.firstName || user.username || 'mein Kunde',
          userId: userId, // 🧠 REQUIRED for knowledge digest injection
          // 🔥 BUSINESS INTELLIGENCE (Dezember 2025)
          company: user.company || undefined,
          website: user.website || undefined,
          industry: user.industry || undefined,
          jobRole: user.jobRole || undefined,
          phone: user.phone || undefined,
          // 🔥 AI PROFILE
          aiProfile: user.aiProfile || undefined
        }
      );

      // 4. Rufe den 'Mund' auf (ElevenLabs)
      const { makeHumanCall } = await import('./voice/elevenlabs-handler');
      const callResult = await makeHumanCall(enhancedContext);
      
      callSuccessful = true;
      // 5. Speichere den Call in der Datenbank
      const callLogId = await storage.saveCallLog({
        userId,
        phoneNumber,
        status: callResult.status || 'initiated',
        provider: 'aras-neural-voice (elevenlabs)',
        callId: callResult.callId, // ElevenLabs conversation_id
        purpose: enhancedContext.purpose,
        details: message,
        contactName: name,
        originalMessage: message
      });

      // 🔥 AUTO-PROCESS FOR CALENDAR: Schedule AI processing after call completes
      // This will run asynchronously after response is sent
      setImmediate(async () => {
        try {
          // Wait a bit for call to complete and get transcript
          setTimeout(async () => {
            logger.info('[CALENDAR-AUTO] Starting auto-processing for call:', callLogId);
            
            // Get call with transcript
            if (!callLogId) {
              logger.error('[CALENDAR-AUTO] Invalid callLogId');
              return;
            }
            
            const call = await db
              .select()
              .from(callLogs)
              .where(eq(callLogs.id, callLogId))
              .limit(1);
            
            if (call.length > 0 && call[0].transcript && !call[0].processedForCalendar) {
              logger.info('[CALENDAR-AUTO] Call has transcript, processing with AI...');
              
              // Process with Gemini
              const prompt = `
                Analysiere dieses Telefongespräch und extrahiere alle vereinbarten Termine oder Follow-ups.
                
                Kontakt: ${name}
                Transkript:
                ${call[0].transcript}
                
                Extrahiere folgende Informationen für jeden Termin:
                - Titel (kurz und prägnant)
                - Datum (im Format YYYY-MM-DD, wenn nicht klar erwähnt, schätze basierend auf heute: ${new Date().toISOString().split('T')[0]})
                - Uhrzeit (im Format HH:MM, wenn nicht erwähnt, schätze sinnvolle Business-Zeit)
                - Dauer in Minuten (schätze wenn unklar, standard 60)
                - Teilnehmer
                - Ort (falls erwähnt)
                - Typ (call, meeting, reminder, other)
                
                Antwort NUR als JSON-Array. Wenn keine Termine gefunden, leeres Array zurückgeben: []
                
                Beispiel:
                [
                  {
                    "title": "Follow-up Meeting mit ${name}",
                    "date": "2024-01-15",
                    "time": "14:00",
                    "duration": 60,
                    "attendees": "${name}",
                    "location": "Online",
                    "type": "meeting"
                  }
                ]
              `;
              
              try {
                const geminiResponse = await generateWithGemini(prompt);
                const events = JSON.parse(geminiResponse || '[]');
                
                logger.info('[CALENDAR-AUTO] Gemini extracted events:', events.length);
                
                // Create calendar events
                for (const event of events) {
                  const eventId = `event_auto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                  
                  await db.insert(calendarEvents).values({
                    id: eventId,
                    userId,
                    title: event.title,
                    description: `Automatisch erstellt aus Anruf mit ${name} vom ${call[0].createdAt ? new Date(call[0].createdAt).toLocaleDateString('de-DE') : 'heute'}`,
                    date: event.date,
                    time: event.time,
                    duration: event.duration || 60,
                    location: event.location || null,
                    attendees: event.attendees || name,
                    type: event.type || 'meeting',
                    status: 'scheduled',
                    callId: String(callLogId)
                  });
                  
                  logger.info('[CALENDAR-AUTO] Created event:', eventId);
                }
                
                // Mark call as processed
                if (callLogId) {
                  await db
                    .update(callLogs)
                    .set({ processedForCalendar: true })
                    .where(eq(callLogs.id, callLogId));
                }
                
                logger.info('[CALENDAR-AUTO] ✅ Auto-processing complete!', {
                  callId: callLogId,
                  eventsCreated: events.length
                });
                
              } catch (aiError) {
                logger.error('[CALENDAR-AUTO] AI processing failed:', aiError);
              }
            } else {
              logger.info('[CALENDAR-AUTO] Call not ready for processing yet:', {
                hasTranscript: !!call[0]?.transcript,
                alreadyProcessed: call[0]?.processedForCalendar
              });
            }
          }, 30000); // Wait 30 seconds for call to complete
        } catch (error) {
          logger.error('[CALENDAR-AUTO] Error in auto-processing:', error);
        }
      });

      logger.info('[SMART-CALL] ========== CALL FLOW COMPLETE ==========');
      logger.info('[SMART-CALL] ElevenLabs Response:', {
        conversationId: callResult.callId,
        status: callResult.status,
        message: callResult.message
      });
      logger.info('[SMART-CALL] Database Storage:', {
        databaseId: callLogId,
        retellCallId: callResult.callId,
        userId,
        phoneNumber,
        contact: name
      });
      
      const responseToFrontend = {
        success: true,
        message: callResult.message,
        callId: callLogId, // Database ID for polling
        conversationId: callResult.callId, // ElevenLabs conversation_id
        status: callResult.status
      };
      
      logger.info('[SMART-CALL] 🚀 SENDING TO FRONTEND:', responseToFrontend);
      logger.info('[SMART-CALL] Frontend will poll /api/aras-voice/call-details/' + callLogId);
      logger.info('[SMART-CALL] Webhook will update via retellCallId: ' + callResult.callId);
      
      // 6. Sende Erfolg an das Frontend
      res.json(responseToFrontend);
      
    } catch (callError: any) {
      // Rollback: Reduziere Counter wieder da Call fehlgeschlagen ist
      logger.error('[SMART-CALL] Call failed, rolling back usage counter', { error: callError.message });
      await storage.trackUsage(userId, 'voice_call', `ROLLBACK: Failed call to ${name}`, -1);
      throw callError;
    }

  } catch (error: any) {
    logger.error('[SMART-CALL] Kompletter Anruf-Fehler!', { error: error.message });
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Ein unbekannter Fehler ist aufgetreten' 
    });
  }
});

  // ========================================
  // CONTACTS API ENDPOINTS
  // ========================================

  // GET all contacts for current user
  app.get("/api/contacts", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      
      const userContacts = await db
        .select()
        .from(contacts)
        .where(eq(contacts.userId, userId))
        .orderBy(desc(contacts.createdAt));

      res.json(userContacts);
    } catch (error: any) {
      logger.error('[CONTACTS] Error fetching contacts:', error);
      res.status(500).json({ error: 'Failed to fetch contacts' });
    }
  });

  // POST create new contact
  app.post("/api/contacts", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { company, firstName, lastName, phone, email, notes } = req.body;

      // Validation
      if (!company || !company.trim()) {
        return res.status(400).json({ error: 'Company name is required' });
      }

      // Generate unique ID
      const contactId = `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const newContact = await db
        .insert(contacts)
        .values({
          id: contactId,
          userId,
          company: company.trim(),
          firstName: firstName?.trim() || null,
          lastName: lastName?.trim() || null,
          phone: phone?.trim() || null,
          email: email?.trim() || null,
          notes: notes?.trim() || null,
        })
        .returning();

      logger.info('[CONTACTS] Created new contact:', {
        id: contactId,
        userId,
        company: company.trim()
      });

      res.json(newContact[0]);
    } catch (error: any) {
      logger.error('[CONTACTS] Error creating contact:', error);
      res.status(500).json({ error: 'Failed to create contact' });
    }
  });

  // PUT update existing contact
  app.put("/api/contacts/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const contactId = req.params.id;
      const { company, firstName, lastName, phone, email, notes } = req.body;

      // Validation
      if (!company || !company.trim()) {
        return res.status(400).json({ error: 'Company name is required' });
      }

      // Check if contact exists and belongs to user
      const existing = await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.id, contactId), eq(contacts.userId, userId)))
        .limit(1);

      if (existing.length === 0) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      const updated = await db
        .update(contacts)
        .set({
          company: company.trim(),
          firstName: firstName?.trim() || null,
          lastName: lastName?.trim() || null,
          phone: phone?.trim() || null,
          email: email?.trim() || null,
          notes: notes?.trim() || null,
          updatedAt: new Date(),
        })
        .where(and(eq(contacts.id, contactId), eq(contacts.userId, userId)))
        .returning();

      logger.info('[CONTACTS] Updated contact:', {
        id: contactId,
        userId,
        company: company.trim()
      });

      res.json(updated[0]);
    } catch (error: any) {
      logger.error('[CONTACTS] Error updating contact:', error);
      res.status(500).json({ error: 'Failed to update contact' });
    }
  });

  // DELETE contact
  app.delete("/api/contacts/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const contactId = req.params.id;

      // Check if contact exists and belongs to user
      const existing = await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.id, contactId), eq(contacts.userId, userId)))
        .limit(1);

      if (existing.length === 0) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      await db
        .delete(contacts)
        .where(and(eq(contacts.id, contactId), eq(contacts.userId, userId)));

      logger.info('[CONTACTS] Deleted contact:', {
        id: contactId,
        userId
      });

      res.json({ success: true, message: 'Contact deleted' });
    } catch (error: any) {
      logger.error('[CONTACTS] Error deleting contact:', error);
      res.status(500).json({ error: 'Failed to delete contact' });
    }
  });

  // ========================================================
  // CALENDAR EVENTS API
  // ========================================================
  
  // GET calendar events
  app.get("/api/calendar/events", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { start, end } = req.query;
      
      // Build where conditions
      const whereConditions = [eq(calendarEvents.userId, userId)];
      
      if (start && end) {
        whereConditions.push(gte(calendarEvents.date, start as string));
        whereConditions.push(lte(calendarEvents.date, end as string));
      }
      
      const events = await db
        .select()
        .from(calendarEvents)
        .where(and(...whereConditions))
        .orderBy(desc(calendarEvents.date));
      
      logger.info('[CALENDAR] Fetched events:', {
        userId,
        count: events.length,
        dateRange: { start, end }
      });
      
      res.json(events);
    } catch (error: any) {
      logger.error('[CALENDAR] Error fetching events:', error);
      res.status(500).json({ error: 'Failed to fetch events' });
    }
  });
  
  // POST create calendar event
  app.post("/api/calendar/events", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const eventData = req.body;
      
      // Generate unique ID
      const eventId = `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const newEvent = {
        id: eventId,
        userId,
        title: eventData.title,
        description: eventData.description || null,
        date: eventData.date,
        time: eventData.time,
        duration: eventData.duration || 60,
        location: eventData.location || null,
        attendees: eventData.attendees || null,
        type: eventData.type || 'meeting',
        status: eventData.status || 'scheduled',
        callId: eventData.callId || null
      };
      
      await db.insert(calendarEvents).values(newEvent);
      
      logger.info('[CALENDAR] Created event:', {
        id: eventId,
        userId,
        title: eventData.title
      });
      
      res.json({ ...newEvent, id: eventId });
    } catch (error: any) {
      logger.error('[CALENDAR] Error creating event:', error);
      res.status(500).json({ error: 'Failed to create event' });
    }
  });
  
  // PUT update calendar event
  app.put("/api/calendar/events/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const eventId = req.params.id;
      const updates = req.body;
      
      // Check ownership
      const existing = await db
        .select()
        .from(calendarEvents)
        .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.userId, userId)))
        .limit(1);
      
      if (existing.length === 0) {
        return res.status(404).json({ error: 'Event not found' });
      }
      
      await db
        .update(calendarEvents)
        .set({
          ...updates,
          updatedAt: new Date()
        })
        .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.userId, userId)));
      
      logger.info('[CALENDAR] Updated event:', {
        id: eventId,
        userId
      });
      
      res.json({ success: true, message: 'Event updated' });
    } catch (error: any) {
      logger.error('[CALENDAR] Error updating event:', error);
      res.status(500).json({ error: 'Failed to update event' });
    }
  });
  
  // DELETE calendar event
  app.delete("/api/calendar/events/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const eventId = req.params.id;
      
      // Check ownership
      const existing = await db
        .select()
        .from(calendarEvents)
        .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.userId, userId)))
        .limit(1);
      
      if (existing.length === 0) {
        return res.status(404).json({ error: 'Event not found' });
      }
      
      await db
        .delete(calendarEvents)
        .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.userId, userId)));
      
      logger.info('[CALENDAR] Deleted event:', {
        id: eventId,
        userId
      });
      
      res.json({ success: true, message: 'Event deleted' });
    } catch (error: any) {
      logger.error('[CALENDAR] Error deleting event:', error);
      res.status(500).json({ error: 'Failed to delete event' });
    }
  });
  
  // POST AI process calls to create calendar events
  app.post("/api/calendar/ai-process-calls", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      
      // Get recent unprocessed calls
      const recentCalls = await db
        .select()
        .from(callLogs)
        .where(and(
          eq(callLogs.userId, userId),
          eq(callLogs.status, 'completed'),
          isNull(callLogs.processedForCalendar)
        ))
        .orderBy(desc(callLogs.createdAt))
        .limit(10);
      
      if (recentCalls.length === 0) {
        return res.json({ callsProcessed: 0, eventsCreated: 0 });
      }
      
      let eventsCreated = 0;
      
      // Process each call with Gemini AI
      for (const call of recentCalls) {
        if (!call.transcript) continue;
        
        try {
          // Use Gemini to extract calendar events from transcript
          const prompt = `
            Analysiere dieses Telefongespräch und extrahiere alle vereinbarten Termine oder Follow-ups.
            
            Transkript:
            ${call.transcript}
            
            Extrahiere folgende Informationen für jeden Termin:
            - Titel (kurz und prägnant)
            - Datum (im Format YYYY-MM-DD, wenn nicht klar, schätze sinnvoll)
            - Uhrzeit (im Format HH:MM)
            - Dauer in Minuten (schätze wenn unklar)
            - Teilnehmer
            - Ort (falls erwähnt)
            - Typ (call, meeting, reminder, other)
            
            Antwort als JSON-Array. Wenn keine Termine gefunden, leeres Array zurückgeben.
            Beispiel:
            [
              {
                "title": "Follow-up Meeting mit Max Mustermann",
                "date": "2024-01-15",
                "time": "14:00",
                "duration": 60,
                "attendees": "Max Mustermann",
                "location": "Online",
                "type": "meeting"
              }
            ]
          `;
          
          const geminiResponse = await generateWithGemini(prompt);
          const events = JSON.parse(geminiResponse || '[]');
          
          // Create calendar events
          for (const event of events) {
            const eventId = `event_ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            await db.insert(calendarEvents).values({
              id: eventId,
              userId,
              title: event.title,
              description: `Automatisch erstellt aus Anruf vom ${call.createdAt ? new Date(call.createdAt).toLocaleDateString('de-DE') : 'heute'}`,
              date: event.date,
              time: event.time,
              duration: event.duration || 60,
              location: event.location || null,
              attendees: event.attendees || null,
              type: event.type || 'meeting',
              status: 'scheduled',
              callId: String(call.id)
            });
            
            eventsCreated++;
          }
          
          // Mark call as processed
          await db
            .update(callLogs)
            .set({ processedForCalendar: true })
            .where(eq(callLogs.id, call.id));
            
        } catch (error) {
          logger.error('[CALENDAR] Error processing call with AI:', error);
        }
      }
      
      logger.info('[CALENDAR] AI processed calls:', {
        userId,
        callsProcessed: recentCalls.length,
        eventsCreated
      });
      
      res.json({
        callsProcessed: recentCalls.length,
        eventsCreated
      });
    } catch (error: any) {
      logger.error('[CALENDAR] Error in AI processing:', error);
      res.status(500).json({ error: 'Failed to process calls with AI' });
    }
  });
  
  // GET check for recent unprocessed calls
  app.get("/api/calendar/check-recent-calls", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      
      const unprocessedCalls = await db
        .select()
        .from(callLogs)
        .where(and(
          eq(callLogs.userId, userId),
          eq(callLogs.status, 'completed'),
          isNull(callLogs.processedForCalendar)
        ))
        .limit(1);
      
      res.json({
        hasUnprocessedCalls: unprocessedCalls.length > 0
      });
    } catch (error: any) {
      logger.error('[CALENDAR] Error checking recent calls:', error);
      res.status(500).json({ error: 'Failed to check recent calls' });
    }
  });
  
  // POST bulk import contacts from CSV
  app.post("/api/contacts/bulk", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { contacts: contactsData } = req.body;

      // Validation
      if (!Array.isArray(contactsData) || contactsData.length === 0) {
        return res.status(400).json({ error: 'Contacts array is required' });
      }

      if (contactsData.length > 1000) {
        return res.status(400).json({ error: 'Maximum 1000 contacts per import' });
      }

      // Validate and prepare contacts
      const validContacts: any[] = [];
      const errors: string[] = [];

      for (let i = 0; i < contactsData.length; i++) {
        const contact = contactsData[i];
        
        // Company is required
        if (!contact.company || !contact.company.trim()) {
          errors.push(`Row ${i + 1}: Company name is required`);
          continue;
        }

        // Generate unique ID
        const contactId = `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${i}`;

        validContacts.push({
          id: contactId,
          userId,
          company: contact.company.trim(),
          firstName: contact.firstName?.trim() || null,
          lastName: contact.lastName?.trim() || null,
          phone: contact.phone?.trim() || null,
          email: contact.email?.trim() || null,
          notes: contact.notes?.trim() || null,
        });
      }

      if (validContacts.length === 0) {
        return res.status(400).json({ 
          error: 'No valid contacts found', 
          details: errors 
        });
      }

      // Batch insert
      await db.insert(contacts).values(validContacts);

      logger.info('[CONTACTS] Bulk import successful:', {
        userId,
        imported: validContacts.length,
        skipped: errors.length
      });

      res.json({ 
        success: true, 
        imported: validContacts.length,
        skipped: errors.length,
        errors: errors.length > 0 ? errors.slice(0, 10) : [] // Return max 10 errors
      });
    } catch (error: any) {
      logger.error('[CONTACTS] Error bulk importing contacts:', error);
      res.status(500).json({ error: 'Failed to import contacts' });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // 🔐 PASSWORD RESET ROUTES
  // ═══════════════════════════════════════════════════════════════

  // Request password reset (sends email)
  app.post('/api/forgot-password', async (req: any, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: 'E-Mail-Adresse erforderlich' });
      }

      // Find user by email
      const allUsers = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
      const user = allUsers[0];
      
      if (!user) {
        // Don't reveal if email exists - security best practice
        logger.info(`[PASSWORD-RESET] Request for non-existent email: ${email}`);
        return res.json({ success: true, message: 'Falls ein Account existiert, wurde eine E-Mail gesendet.' });
      }

      // Generate reset token
      const resetToken = `prt_${Date.now()}_${Math.random().toString(36).substr(2, 24)}`;
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Save token to user
      await db.update(users)
        .set({ 
          passwordResetToken: resetToken,
          passwordResetExpires: resetExpires
        })
        .where(eq(users.id, user.id));

      // Send password reset email
      const { sendPasswordResetEmail } = await import('./email-service');
      await sendPasswordResetEmail(
        user.email!,
        user.firstName || user.username,
        resetToken
      );

      logger.info(`[PASSWORD-RESET] Reset email sent to ${user.email}`);
      res.json({ success: true, message: 'Falls ein Account existiert, wurde eine E-Mail gesendet.' });

    } catch (error: any) {
      logger.error('[PASSWORD-RESET] Error:', error);
      res.status(500).json({ message: 'Fehler beim Senden der E-Mail' });
    }
  });

  // Reset password with token
  app.post('/api/reset-password', async (req: any, res) => {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({ message: 'Token und neues Passwort erforderlich' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: 'Passwort muss mindestens 6 Zeichen haben' });
      }

      // Find user by reset token
      const allUsers = await db.select().from(users).where(eq(users.passwordResetToken, token));
      const user = allUsers[0];
      
      if (!user) {
        logger.warn(`[PASSWORD-RESET] Invalid token: ${token.substring(0, 20)}...`);
        return res.status(400).json({ message: 'Ungültiger oder abgelaufener Link' });
      }

      // Check if token is expired
      if (user.passwordResetExpires && new Date(user.passwordResetExpires) < new Date()) {
        logger.warn(`[PASSWORD-RESET] Expired token for user ${user.id}`);
        return res.status(400).json({ message: 'Link ist abgelaufen. Bitte fordere einen neuen an.' });
      }

      // Hash new password
      const bcrypt = await import('bcryptjs');
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password and clear reset token
      await db.update(users)
        .set({ 
          password: hashedPassword,
          passwordResetToken: null,
          passwordResetExpires: null
        })
        .where(eq(users.id, user.id));

      // Send confirmation email
      const { sendPasswordChangedEmail } = await import('./email-service');
      if (user.email) {
        await sendPasswordChangedEmail(user.email, user.firstName || user.username);
      }

      logger.info(`[PASSWORD-RESET] Password changed for user ${user.id}`);
      res.json({ success: true, message: 'Passwort erfolgreich geändert!' });

    } catch (error: any) {
      logger.error('[PASSWORD-RESET] Error:', error);
      res.status(500).json({ message: 'Fehler beim Zurücksetzen des Passworts' });
    }
  });

  // Verify reset token (check if valid before showing form)
  app.get('/api/verify-reset-token', async (req: any, res) => {
    try {
      const { token } = req.query;
      
      if (!token) {
        return res.status(400).json({ valid: false, message: 'Token fehlt' });
      }

      const allUsers = await db.select().from(users).where(eq(users.passwordResetToken, token as string));
      const user = allUsers[0];
      
      if (!user) {
        return res.json({ valid: false, message: 'Ungültiger Link' });
      }

      if (user.passwordResetExpires && new Date(user.passwordResetExpires) < new Date()) {
        return res.json({ valid: false, message: 'Link abgelaufen' });
      }

      res.json({ valid: true, email: user.email });

    } catch (error: any) {
      logger.error('[PASSWORD-RESET] Token verify error:', error);
      res.status(500).json({ valid: false, message: 'Fehler bei der Überprüfung' });
    }
  });

  return httpServer;
} 
