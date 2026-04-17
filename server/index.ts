import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { db, client } from "./db";
import { subscriptionPlans } from "@shared/schema";
import { sql } from "drizzle-orm";

console.log("[BUILD]", { mailFix: "ae196b1", at: new Date().toISOString() });

const app = express();

// ============================================================================
// CRITICAL: Trust proxy + Canonical Host Redirect MUST be FIRST
// ============================================================================
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

app.set("trust proxy", 1);

// Raw body parser for Stripe webhook (must be before JSON parser)
app.use('/api/fiaon/stripe-webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// ============================================================================
// HEALTH CHECK - Must be early to verify API is responding
// ============================================================================
app.get('/api/_health', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json({
    ok: true,
    service: 'aras-api',
    time: new Date().toISOString(),
  });
});

// Serve static files from attached_assets
app.use('/attached_assets', express.static('attached_assets'));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// 🔥 Migrate AI Profile columns on startup
async function migrateAIProfile() {
  try {
    log('🔍 Checking AI Profile columns...');
    
    // Add all columns in one statement
    await db.execute(sql`
      DO $$ 
      BEGIN
        -- Add Business Intelligence columns
        ALTER TABLE users ADD COLUMN IF NOT EXISTS company VARCHAR(255);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS website VARCHAR(500);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS industry VARCHAR(100);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(100);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'de';
        ALTER TABLE users ADD COLUMN IF NOT EXISTS primary_goal VARCHAR(255);
        
        -- Add AI Profile JSONB column
        ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_profile JSONB;
        
        -- Add enrichment tracking
        ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_enriched BOOLEAN DEFAULT FALSE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS last_enrichment_date TIMESTAMP;
        
        -- Create indexes if they don't exist
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_company') THEN
          CREATE INDEX idx_users_company ON users(company);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_industry') THEN
          CREATE INDEX idx_users_industry ON users(industry);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_profile_enriched') THEN
          CREATE INDEX idx_users_profile_enriched ON users(profile_enriched);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_language') THEN
          CREATE INDEX idx_users_language ON users(language);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_ai_profile') THEN
          CREATE INDEX idx_users_ai_profile ON users USING GIN(ai_profile);
        END IF;
      END $$;
    `);
    
    log('✅ AI Profile columns ready');
  } catch (error) {
    log('⚠️ AI Profile migration error (might already exist):', String(error));
  }
}

// Seed subscription plans on startup
async function seedSubscriptionPlans() {
  try {
    const PLANS = [
      {
        id: "free",
        name: "ARAS Free – Discover Mode",
        price: 0,
        aiMessagesLimit: 10,
        voiceCallsLimit: 2,
        leadsLimit: 50,
        campaignsLimit: 1,
        features: [
          "2 kostenlose Outbound Calls",
          "10 freie Chatnachrichten",
          "Zugriff auf die ARAS-Konsole (Basic)",
          "Basis-Statistiken zu Gesprächsdauer und Erfolgsquote",
          "Dauerhaft kostenlos, keine Zahlungsdaten erforderlich"
        ],
        stripePriceId: null,
        stripeProductId: null,
        isActive: true
      },
      {
        id: "pro",
        name: "ARAS Pro – Growth Mode",
        price: 5900, // €59.00
        aiMessagesLimit: 500,
        voiceCallsLimit: 100,
        leadsLimit: 500,
        campaignsLimit: 10,
        features: [
          "100 Outbound Calls pro Monat",
          "500 Chatnachrichten pro Monat",
          "Integration mit Make, Zapier oder n8n",
          "Live-Dashboard mit Erfolgsquote und Performance-Daten",
          "E-Mail-Support (Antwort innerhalb von 24 Stunden)"
        ],
        stripePriceId: process.env.STRIPE_PRICE_ID_PRO || null,
        stripeProductId: process.env.STRIPE_PRODUCT_ID_PRO || null,
        isActive: true
      },
      {
        id: "ultra",
        name: "ARAS Ultra – Performance Mode",
        price: 24900, // €249.00
        aiMessagesLimit: 10000,
        voiceCallsLimit: 1000,
        leadsLimit: 5000,
        campaignsLimit: 50,
        features: [
          "1.000 Outbound Calls pro Monat",
          "10.000 Chatnachrichten pro Monat",
          "Zugriff auf das erweiterte ARAS Voice Model",
          "Mehrbenutzerzugang (bis zu 5 Teammitglieder)",
          "Erweiterte Analysen (Emotion, Conversion, KPI-Tracking)",
          "Priorisierter Support (Antwort innerhalb von 6 Stunden)",
          "Zugang zum ARAS Partner-Netzwerk"
        ],
        stripePriceId: process.env.STRIPE_PRICE_ID_ULTRA || null,
        stripeProductId: process.env.STRIPE_PRODUCT_ID_ULTRA || null,
        isActive: true
      },
      {
        id: "ultimate",
        name: "ARAS Ultimate – Enterprise Mode",
        price: 199000, // €1990.00
        aiMessagesLimit: null, // unlimited
        voiceCallsLimit: 10000,
        leadsLimit: null,
        campaignsLimit: null,
        features: [
          "10.000 Outbound Calls pro Monat",
          "Unbegrenzte Chatnachrichten",
          "Zugriff auf das dedizierte ARAS Enterprise-LLM",
          "API- und CRM-Integrationen (Salesforce, HubSpot, Bitrix24 u.a.)",
          "Swiss Data Hosting – DSGVO-, ISO- und SOC2-zertifiziert",
          "24/7 Premium-Support mit persönlichem Account Manager",
          "Early Access zu neuen Modulen (Voice2Action, Memory, Multi-LLM)"
        ],
        stripePriceId: process.env.STRIPE_PRICE_ID_ULTIMATE || null,
        stripeProductId: process.env.STRIPE_PRODUCT_ID_ULTIMATE || null,
        isActive: true
      }
    ];

    for (const plan of PLANS) {
      await db
        .insert(subscriptionPlans)
        .values(plan)
        .onConflictDoUpdate({
          target: subscriptionPlans.id,
          set: {
            name: plan.name,
            price: plan.price,
            aiMessagesLimit: plan.aiMessagesLimit,
            voiceCallsLimit: plan.voiceCallsLimit,
            leadsLimit: plan.leadsLimit,
            campaignsLimit: plan.campaignsLimit,
            features: plan.features,
            stripePriceId: plan.stripePriceId,
            stripeProductId: plan.stripeProductId,
            isActive: plan.isActive
          }
        });
    }
    
    log("✅ Subscription plans seeded successfully");
  } catch (error: any) {
    log("⚠️  Error seeding plans (table may not exist yet):", error);
  }
}

(async () => {
  // 🔥 Migrate AI Profile columns first
  await migrateAIProfile();
  
  // Seed subscription plans
  await seedSubscriptionPlans();
  
  // Add migration endpoint (temporary - can be removed after migration)
  // Support both GET and POST since browsers default to GET
  const migrationHandler = async (req: any, res: Response) => {
    try {
      log('[ADMIN] Starting plan migration...');
      
      // First, check how many users need migration
      const usersToMigrate = await client`
        SELECT id, username, subscription_plan 
        FROM users 
        WHERE subscription_plan IN ('starter', 'enterprise')
      `;
      
      log(`[ADMIN] Found ${usersToMigrate.length} users to migrate`);
      
      if (usersToMigrate.length === 0) {
        return res.json({
          success: true,
          message: 'No users need migration',
          users: []
        });
      }
      
      // Perform the migration
      const result = await client`
        UPDATE users
        SET subscription_plan = 
          CASE subscription_plan
            WHEN 'starter' THEN 'free'
            WHEN 'enterprise' THEN 'ultimate'
            ELSE subscription_plan
          END,
          updated_at = NOW()
        WHERE subscription_plan IN ('starter', 'enterprise')
        RETURNING id, username, subscription_plan
      `;
      
      log(`[ADMIN] Successfully migrated ${result.length} users`);
      
      res.json({
        success: true,
        message: `Successfully migrated ${result.length} users from old plans to new plans`,
        users: result.map((u: any) => ({
          id: u.id,
          username: u.username,
          newPlan: u.subscription_plan
        }))
      });
    } catch (error: any) {
      log('[ADMIN] Error migrating plans:', error);
      res.status(500).json({ 
        error: 'Migration failed',
        details: error.message 
      });
    }
  };
  
  // Register for both GET and POST
  app.get('/api/admin/migrate-plans-now', migrationHandler);
  app.post('/api/admin/migrate-plans-now', migrationHandler);
  
  // Delete old subscription plans from database
  const deleteOldPlansHandler = async (req: any, res: Response) => {
    try {
      log('[ADMIN] Deleting old subscription plans...');
      
      // Check which old plans exist
      const oldPlans = await client`
        SELECT id, name, price 
        FROM subscription_plans 
        WHERE id IN ('starter', 'professional', 'enterprise')
      `;
      
      log(`[ADMIN] Found ${oldPlans.length} old plans to delete: ${oldPlans.map((p: any) => p.id).join(', ')}`);
      
      if (oldPlans.length === 0) {
        return res.json({
          success: true,
          message: 'No old plans to delete',
          deletedPlans: []
        });
      }
      
      // Delete the old plans
      const result = await client`
        DELETE FROM subscription_plans
        WHERE id IN ('starter', 'professional', 'enterprise')
        RETURNING id, name
      `;
      
      log(`[ADMIN] Successfully deleted ${result.length} old plans`);
      
      res.json({
        success: true,
        message: `Successfully deleted ${result.length} old subscription plans`,
        deletedPlans: result.map((p: any) => ({
          id: p.id,
          name: p.name
        }))
      });
    } catch (error: any) {
      log('[ADMIN] Error deleting old plans:', error);
      res.status(500).json({ 
        error: 'Failed to delete old plans',
        details: error.message 
      });
    }
  };
  
  app.get('/api/admin/delete-old-plans', deleteOldPlansHandler);
  app.post('/api/admin/delete-old-plans', deleteOldPlansHandler);
  
  // ============================================================================
  // RUN AI TASKS MIGRATION - Ensure columns exist
  // ============================================================================
  try {
    log('🔄 Running AI Tasks migration...');
    await client`
      ALTER TABLE team_todos 
        ADD COLUMN IF NOT EXISTS client_name VARCHAR,
        ADD COLUMN IF NOT EXISTS client_package VARCHAR CHECK (client_package IN ('Starter', 'Pro', 'Ultra', 'High End')),
        ADD COLUMN IF NOT EXISTS task_type VARCHAR CHECK (task_type IN ('Limit-Erhöhung', 'Schufa-Klärung', 'Strategie-Call', 'System')),
        ADD COLUMN IF NOT EXISTS urgency_score INTEGER DEFAULT 50 CHECK (urgency_score >= 0 AND urgency_score <= 100),
        ADD COLUMN IF NOT EXISTS assigned_director_id VARCHAR REFERENCES users(id) ON DELETE SET NULL
    `;
    
    // Update status check constraint
    await client`
      ALTER TABLE team_todos 
        DROP CONSTRAINT IF EXISTS team_todos_status_check
    `;
    
    await client`
      ALTER TABLE team_todos 
        ADD CONSTRAINT team_todos_status_check 
        CHECK (status IN ('pending', 'in_progress', 'done', 'cancelled', 'open', 'waiting_for_client', 'resolved'))
    `;
    
    // Add indexes
    await client`CREATE INDEX IF NOT EXISTS team_todos_urgency_idx ON team_todos(urgency_score DESC)`;
    await client`CREATE INDEX IF NOT EXISTS team_todos_client_package_idx ON team_todos(client_package)`;
    await client`CREATE INDEX IF NOT EXISTS team_todos_task_type_idx ON team_todos(task_type)`;
    
    log('✅ AI Tasks migration completed');
  } catch (error: any) {
    if (error.code === '42701') {
      log('⚠️ AI Tasks columns already exist, skipping migration');
    } else {
      log('❌ AI Tasks migration error:', error.message);
    }
  }
  
  // ============================================================================
  // CRITICAL: registerRoutes MUST run FIRST (sets up passport session)
  // Internal routes MUST be mounted AFTER so req.isAuthenticated() works
  // ============================================================================
  const server = await registerRoutes(app);
  
  // ============================================================================
  // 🔐 ADMIN BOOTSTRAP - Ensure at least one admin exists
  // ============================================================================
  const { bootstrapFirstAdmin } = await import('./middleware/admin');
  await bootstrapFirstAdmin();
  
  // ============================================================================
  // 🎯 ARAS COMMAND CENTER - INTERNAL CRM ROUTES
  // ============================================================================
  // MUST be AFTER registerRoutes (passport session must be initialized first)
  const internalRoutes = await import('./routes/internal/index');
  app.use('/api/internal', internalRoutes.default);
  log('✅ ARAS Command Center routes registered at /api/internal/* (after passport init)');

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
