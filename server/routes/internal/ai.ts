/**
 * ============================================================================
 * ARAS COMMAND CENTER - AI ENDPOINTS
 * ============================================================================
 */

import { Router } from "express";
import { requireInternal } from "../../middleware/role-guard";
import * as ai from "../../lib/internal-ai";
import * as storage from "../../storage-internal-crm";

const router = Router();

// Alle AI Routes benötigen admin/staff Role
router.use(requireInternal);

/**
 * POST /api/internal/ai/weekly-summary
 * Generiert wöchentliche CRM-Zusammenfassung
 */
router.post("/weekly-summary", async (req, res) => {
  try {
    // Hole aktuelle Stats
    const stats = await storage.getDashboardStats();
    
    // Generiere AI Summary
    const summary = await ai.generateWeeklySummary(stats);
    
    res.json({ summary, stats });
  } catch (error: any) {
    console.error('[AI] Weekly summary error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/internal/ai/contact-summary
 * Generiert Kontakt-Zusammenfassung
 */
router.post("/contact-summary", async (req, res) => {
  try {
    const { contactId } = req.body;
    if (!contactId) {
      return res.status(400).json({ error: "contactId required" });
    }
    
    // Hole Kontakt & Related Data
    const contact = await storage.getContactById(contactId);
    if (!contact) {
      return res.status(404).json({ error: "Contact not found" });
    }
    
    const [deals, tasks, calls, notes] = await Promise.all([
      storage.getDealsByContact(contactId),
      storage.getTasksByContact(contactId),
      storage.getCallLogsByContact(contactId),
      storage.getNotesByContact(contactId)
    ]);
    
    // Generiere Summary
    const summary = await ai.generateContactSummary(contact, {
      deals,
      tasks,
      calls,
      notes,
      company: contact.companyId ? await storage.getCompanyById(contact.companyId) : null
    });
    
    res.json({ summary, contact });
  } catch (error: any) {
    console.error('[AI] Contact summary error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/internal/ai/deal-next-steps
 * Schlägt nächste Schritte für Deal vor
 */
router.post("/deal-next-steps", async (req, res) => {
  try {
    const { dealId } = req.body;
    if (!dealId) {
      return res.status(400).json({ error: "dealId required" });
    }
    
    const deal = await storage.getDealById(dealId);
    if (!deal) {
      return res.status(404).json({ error: "Deal not found" });
    }
    
    // Hole Kontext
    const [contact, company, tasks] = await Promise.all([
      deal.contactId ? storage.getContactById(deal.contactId) : null,
      deal.companyId ? storage.getCompanyById(deal.companyId) : null,
      storage.getTasksByContact(deal.contactId || '')
    ]);
    
    const steps = await ai.suggestDealNextSteps(deal, {
      contact,
      company,
      tasks,
      lastActivity: tasks[0]?.createdAt
    });
    
    res.json({ steps, deal });
  } catch (error: any) {
    console.error('[AI] Deal next steps error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/internal/ai/voice
 * Text-to-Speech via ElevenLabs (server-proxied)
 * Returns audio stream - no API key exposed to client
 */
router.post("/voice", async (req, res) => {
  try {
    const { text, voice = "rachel" } = req.body;
    
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "text is required" });
    }
    
    if (text.length > 2000) {
      return res.status(400).json({ error: "Text too long (max 2000 chars)" });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: "ARAS AI Voice temporarily unavailable" });
    }

    // Voice IDs from ElevenLabs
    const voiceIds: Record<string, string> = {
      rachel: "21m00Tcm4TlvDq8ikWAM",
      domi: "AZnzlk1XvdvUeBnXmlld",
      bella: "EXAVITQu4vr4xnSDxMaL",
      antoni: "ErXwobaYiN019PkySvjV",
      elli: "MF3mGyEYCl7XYWbV9V6O",
      josh: "TxGEqnHWrfWFTfGW9XjX",
    };

    const voiceId = voiceIds[voice] || voiceIds.rachel;

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error("[AI-VOICE] ElevenLabs error:", response.status);
      return res.status(503).json({ error: "ARAS AI Voice temporarily unavailable" });
    }

    // Stream audio response
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-cache");
    
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));

  } catch (error: any) {
    console.error("[AI-VOICE] Error:", error.message);
    res.status(500).json({ error: "ARAS AI Voice temporarily unavailable" });
  }
});

export default router;
