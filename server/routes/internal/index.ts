/**
 * ============================================================================
 * ARAS COMMAND CENTER - INTERNAL API ROUTES
 * ============================================================================
 * Zentrale Router-Datei für alle internen CRM APIs
 * NUR für admin/staff zugänglich
 * ============================================================================
 */

import { Router } from "express";
import { requireInternal } from "../../middleware/role-guard";
import { z } from "zod";
import { nanoid } from "nanoid";
import * as storage from "../../storage-internal-crm";
import aiRoutes from "./ai";
import searchRoutes from "./search";
import contractsRoutes from "./contracts";
import commandCenterRoutes from "./command-center";
import { adminRouter as foundingAdminRoutes } from "../founding";

const router = Router();

// ============================================================================
// ALLE INTERNAL ROUTES BENÖTIGEN AUTHENTIFIZIERUNG & ROLE
// ============================================================================
router.use(requireInternal);

// ============================================================================
// FOUNDING MEMBER PASS (Admin Claims Queue)
// ============================================================================
router.use("/founding", foundingAdminRoutes);

// ============================================================================
// AI ROUTES
// ============================================================================
router.use("/ai", aiRoutes);

// ============================================================================
// GLOBAL SEARCH
// ============================================================================
router.use("/search", searchRoutes);

// ============================================================================
// CONTRACTS
// ============================================================================
router.use("/contracts", contractsRoutes);

// ============================================================================
// COMMAND CENTER (Team Feed, Calendar, Todos, Actions)
// ============================================================================
router.use("/command-center", commandCenterRoutes);

// ============================================================================
// COMPANIES
// ============================================================================

router.get("/companies", async (req, res) => {
  try {
    const { search } = req.query;
    const companies = search 
      ? await storage.searchCompanies(search as string)
      : await storage.getAllCompanies();
    res.json(companies);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/companies/:id", async (req, res) => {
  try {
    const company = await storage.getCompanyById(req.params.id);
    if (!company) return res.status(404).json({ error: "Company not found" });
    res.json(company);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/companies", async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      website: z.string().optional(),
      industry: z.string().optional(),
      tags: z.array(z.string()).optional(),
      notes: z.string().optional()
    });
    
    const data = schema.parse(req.body);
    const company = await storage.createCompany({
      id: nanoid(),
      ...data,
      tags: data.tags || [],
      createdAt: new Date(),
      updatedAt: new Date()
    });
    res.status(201).json(company);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/companies/:id", async (req, res) => {
  try {
    const company = await storage.updateCompany(req.params.id, req.body);
    if (!company) return res.status(404).json({ error: "Company not found" });
    res.json(company);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/companies/:id", async (req, res) => {
  try {
    const deleted = await storage.deleteCompany(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Company not found" });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// CONTACTS
// ============================================================================

router.get("/contacts", async (req, res) => {
  try {
    const { search, companyId } = req.query;
    let contacts;
    
    if (search) {
      contacts = await storage.searchContacts(search as string);
    } else if (companyId) {
      contacts = await storage.getContactsByCompany(companyId as string);
    } else {
      contacts = await storage.getAllContacts();
    }
    
    res.json(contacts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/contacts/:id", async (req, res) => {
  try {
    const contact = await storage.getContactById(req.params.id);
    if (!contact) return res.status(404).json({ error: "Contact not found" });
    res.json(contact);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/contacts", async (req, res) => {
  try {
    const schema = z.object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      position: z.string().optional(),
      companyId: z.string().optional(),
      source: z.string().optional(),
      status: z.enum(["NEW", "ACTIVE", "ARCHIVED"]).optional(),
      tags: z.array(z.string()).optional(),
      notes: z.string().optional()
    });
    
    const data = schema.parse(req.body);
    const contact = await storage.createContact({
      id: nanoid(),
      ...data,
      status: data.status || "NEW",
      tags: data.tags || [],
      createdAt: new Date(),
      updatedAt: new Date()
    });
    res.status(201).json(contact);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/contacts/:id", async (req, res) => {
  try {
    const contact = await storage.updateContact(req.params.id, req.body);
    if (!contact) return res.status(404).json({ error: "Contact not found" });
    res.json(contact);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/contacts/:id", async (req, res) => {
  try {
    const deleted = await storage.deleteContact(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Contact not found" });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// DEALS
// ============================================================================

router.get("/deals", async (req, res) => {
  try {
    const { stage, contactId } = req.query;
    let deals;
    
    if (stage) {
      deals = await storage.getDealsByStage(stage as string);
    } else if (contactId) {
      deals = await storage.getDealsByContact(contactId as string);
    } else {
      deals = await storage.getAllDeals();
    }
    
    res.json(deals);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/deals/stats", async (req, res) => {
  try {
    const stats = await storage.getDealStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/deals/:id", async (req, res) => {
  try {
    const deal = await storage.getDealById(req.params.id);
    if (!deal) return res.status(404).json({ error: "Deal not found" });
    res.json(deal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/deals", async (req, res) => {
  try {
    const schema = z.object({
      title: z.string().min(1),
      value: z.number().optional(),
      currency: z.string().default("EUR"),
      stage: z.enum(["IDEA", "CONTACTED", "NEGOTIATION", "COMMITTED", "CLOSED_WON", "CLOSED_LOST"]).optional(),
      contactId: z.string().optional(),
      companyId: z.string().optional(),
      ownerUserId: z.string().optional(),
      probability: z.number().min(0).max(100).optional(),
      closeDate: z.string().optional(),
      notes: z.string().optional()
    });
    
    const data = schema.parse(req.body);
    const deal = await storage.createDeal({
      id: nanoid(),
      ...data,
      stage: data.stage || "IDEA",
      closeDate: data.closeDate ? new Date(data.closeDate) : null,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    res.status(201).json(deal);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/deals/:id", async (req, res) => {
  try {
    const deal = await storage.updateDeal(req.params.id, req.body);
    if (!deal) return res.status(404).json({ error: "Deal not found" });
    res.json(deal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/deals/:id", async (req, res) => {
  try {
    const deleted = await storage.deleteDeal(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Deal not found" });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// TASKS
// ============================================================================

router.get("/tasks", async (req, res) => {
  try {
    const { status, contactId, dueToday } = req.query;
    let tasks;
    
    if (dueToday === 'true') {
      tasks = await storage.getTasksDueToday();
    } else if (status) {
      tasks = await storage.getTasksByStatus(status as string);
    } else if (contactId) {
      tasks = await storage.getTasksByContact(contactId as string);
    } else {
      tasks = await storage.getAllTasks();
    }
    
    res.json(tasks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/tasks/:id", async (req, res) => {
  try {
    const task = await storage.getTaskById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json(task);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/tasks", async (req, res) => {
  try {
    const schema = z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      status: z.enum(["OPEN", "IN_PROGRESS", "DONE", "CANCELLED"]).optional(),
      dueDate: z.string().optional(),
      assignedUserId: z.string().optional(),
      relatedContactId: z.string().optional(),
      relatedDealId: z.string().optional()
    });
    
    const data = schema.parse(req.body);
    const task = await storage.createTask({
      id: nanoid(),
      ...data,
      status: data.status || "OPEN",
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    res.status(201).json(task);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/tasks/:id", async (req, res) => {
  try {
    const task = await storage.updateTask(req.params.id, req.body);
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json(task);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/tasks/:id", async (req, res) => {
  try {
    const deleted = await storage.deleteTask(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Task not found" });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// CALL LOGS
// ============================================================================

router.get("/calls", async (req, res) => {
  try {
    const { contactId, hours } = req.query;
    let calls;
    
    if (contactId) {
      calls = await storage.getCallLogsByContact(contactId as string);
    } else if (hours) {
      calls = await storage.getRecentCallLogs(parseInt(hours as string));
    } else {
      calls = await storage.getAllCallLogs();
    }
    
    res.json(calls);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/calls/:id", async (req, res) => {
  try {
    const callLog = await storage.getCallLogById(req.params.id);
    if (!callLog) return res.status(404).json({ error: "Call log not found" });
    res.json(callLog);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/calls", async (req, res) => {
  try {
    const schema = z.object({
      contactId: z.string().optional(),
      source: z.enum(["RETELL", "ELEVENLABS", "TWILIO", "OTHER"]).optional(),
      externalCallId: z.string().optional(),
      phoneNumber: z.string().optional(),
      durationSeconds: z.number().optional(),
      outcome: z.string().optional(),
      sentiment: z.enum(["POSITIVE", "NEUTRAL", "NEGATIVE", "MIXED"]).optional(),
      summary: z.string().optional(),
      recordingUrl: z.string().optional(),
      rawMetadata: z.any().optional()
    });
    
    const data = schema.parse(req.body);
    const callLog = await storage.createCallLog({
      id: nanoid(),
      ...data,
      source: data.source || "OTHER",
      timestamp: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    });
    res.status(201).json(callLog);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================================================
// NOTES
// ============================================================================

router.get("/notes", async (req, res) => {
  try {
    const { contactId, dealId } = req.query;
    let notes;
    
    if (contactId) {
      notes = await storage.getNotesByContact(contactId as string);
    } else if (dealId) {
      notes = await storage.getNotesByDeal(dealId as string);
    } else {
      return res.status(400).json({ error: "contactId or dealId required" });
    }
    
    res.json(notes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/notes", async (req, res) => {
  try {
    const schema = z.object({
      contactId: z.string().optional(),
      dealId: z.string().optional(),
      content: z.string().min(1)
    });
    
    const data = schema.parse(req.body);
    const user = req.user as Express.User;
    
    const note = await storage.createNote({
      id: nanoid(),
      ...data,
      authorUserId: user.id,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    res.status(201).json(note);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/notes/:id", async (req, res) => {
  try {
    const deleted = await storage.deleteNote(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Note not found" });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// DASHBOARD
// ============================================================================

router.get("/dashboard/stats", async (req, res) => {
  try {
    const stats = await storage.getDashboardStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// HEALTH / DIAGNOSTICS (for debugging auth issues)
// ============================================================================

router.get("/health", async (req, res) => {
  try {
    const user = req.user as any;
    const cookies = req.headers.cookie;
    
    res.json({
      ok: true,
      env: process.env.NODE_ENV || 'development',
      hasSession: !!req.isAuthenticated?.() || !!user,
      user: user ? {
        id: user.id,
        username: user.username,
        role: user.userRole || user.user_role || 'unknown'
      } : null,
      cookieSeen: !!cookies,
      host: req.headers.host || null,
      origin: req.headers.origin || null,
      referer: req.headers.referer || null,
      time: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ 
      ok: false, 
      error: error.message,
      time: new Date().toISOString()
    });
  }
});

// ============================================================================
// ENRICHMENT: TRIGGER RUN (Admin re-enrichment for any user)
// ============================================================================

router.post("/enrichment/run", async (req, res) => {
  try {
    const adminUser = (req as any).adminUser;
    const targetUserId = req.body?.userId || adminUser?.id;
    
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'userId required' });
    }

    console.log('[enrich.admin.run]', JSON.stringify({
      targetUserId,
      triggeredBy: adminUser?.username ?? 'unknown',
      timestamp: new Date().toISOString()
    }));

    const { forceReEnrich } = await import('../../services/enrichment.service');
    const result = await forceReEnrich(targetUserId);

    return res.json(result);
  } catch (err: any) {
    console.error('[enrich.admin.run.error]', err?.message);
    return res.status(500).json({ success: false, message: err?.message || 'Unknown error' });
  }
});

// ============================================================================
// ENRICHMENT SMOKE TEST (1-click Gemini API validation)
// ============================================================================

router.get("/enrichment/smoke", async (req, res) => {
  const model = process.env.GEMINI_ENRICH_MODEL || "gemini-3-pro-preview";
  const timeoutMs = 30_000;

  console.log('[enrich.smoke.start]', JSON.stringify({
    model,
    provider: 'gemini',
    timeoutMs,
    triggeredBy: (req as any).adminUser?.username ?? 'unknown',
    timestamp: new Date().toISOString()
  }));

  try {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('[enrich.smoke.err]', JSON.stringify({ error: 'missing_gemini_key' }));
      return res.status(500).json({ success: false, errorType: 'config', message: 'GOOGLE_GEMINI_API_KEY missing' });
    }

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    const start = Date.now();
    const result = await ai.models.generateContent({
      model,
      contents: 'Return ONLY one factual sentence about Google Gemini AI. No markdown, no extra text.',
      config: {
        temperature: 0.2,
        maxOutputTokens: 100
      }
    });

    const durationMs = Date.now() - start;
    const outputText = result?.text || '';
    const truncated = outputText.substring(0, 200);
    const tokensUsed = (result as any)?.usageMetadata?.totalTokenCount ?? null;

    console.log('[enrich.smoke.ok]', JSON.stringify({
      model,
      provider: 'gemini',
      durationMs,
      hasOutput: !!outputText,
      outputLength: outputText.length,
      tokensUsed
    }));

    return res.json({
      success: true,
      model,
      provider: 'gemini',
      durationMs,
      outputText: truncated,
      tokensUsed
    });
  } catch (err: any) {
    const msg = String(err?.message ?? '');

    console.error('[enrich.smoke.err]', JSON.stringify({
      model,
      provider: 'gemini',
      errorType: err?.name ?? null,
      errorMessage: msg.substring(0, 300)
    }));

    return res.status(500).json({
      success: false,
      errorType: err?.name ?? 'Unknown',
      message: msg.substring(0, 300),
      model,
      provider: 'gemini'
    });
  }
});

export default router;
