/**
 * ============================================================================
 * FIAON FAHRPLAN — Kundenprodukt: Analyse → Coaching → Ziel
 * ============================================================================
 * Kundenfunktionen (per ref, wie /profile/:ref & /kyc-status/:ref):
 *   - Consent-Gate, verschlüsselter Kontoauszug-Upload, KI-Analyse (nur
 *     aggregierte Kennzahlen), persönlicher Fahrplan, Fortschritt, KI-Begrüßung,
 *     GDPR-Löschung.
 * Admin-Gegenseite (requireAdmin):
 *   - Upload-Review (entschlüsselt, auditiert), Analyse/Fahrplan freigeben,
 *     Ziel-Freischaltung/Kriterien, Coaching-Texte, Audit-Log.
 *
 * REGELN: Keine Rohdaten an die KI (nur Aggregate). Karte = erarbeitetes Ziel,
 * nie Zusage. Empfehlungen = Bildungsinhalt, keine Finanzberatung.
 * ============================================================================
 */
import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import multer from "multer";
import { requireAdmin } from "../middleware/admin";
import { encryptBuffer, decryptBuffer, hasDedicatedKey } from "../lib/roadmap-crypto";
import { buildMetrics, analyzeMetrics, generateGreeting, aiConfigured, type AnalysisResult } from "../lib/roadmap-ai";

const router = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

export const CONSENT_VERSION = "v1";
const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"];

/* ── Tabellen sicherstellen (auto-migrate, wie im Rest des Codes üblich) ── */
let tablesReady = false;
async function ensureTables(): Promise<void> {
  if (tablesReady) return;
  await sqlPool`CREATE TABLE IF NOT EXISTS fiaon_consents (
    id SERIAL PRIMARY KEY, ref VARCHAR NOT NULL, consent_type VARCHAR NOT NULL,
    version VARCHAR NOT NULL, ip VARCHAR, user_agent TEXT, created_at TIMESTAMP DEFAULT NOW()
  )`;
  await sqlPool`CREATE TABLE IF NOT EXISTS fiaon_statements (
    id SERIAL PRIMARY KEY, ref VARCHAR NOT NULL, filename VARCHAR, mime VARCHAR,
    size_bytes INTEGER, month_label VARCHAR, content_enc BYTEA NOT NULL,
    uploaded_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP
  )`;
  await sqlPool`CREATE TABLE IF NOT EXISTS fiaon_metrics (
    ref VARCHAR PRIMARY KEY, metrics JSONB NOT NULL, computed_at TIMESTAMP DEFAULT NOW()
  )`;
  await sqlPool`CREATE TABLE IF NOT EXISTS fiaon_analysis (
    ref VARCHAR PRIMARY KEY, status VARCHAR DEFAULT 'draft', summary TEXT, data JSONB,
    metrics_sent JSONB, generated_by VARCHAR, model VARCHAR,
    created_at TIMESTAMP DEFAULT NOW(), approved_at TIMESTAMP, approved_by VARCHAR
  )`;
  await sqlPool`CREATE TABLE IF NOT EXISTS fiaon_roadmap_steps (
    id SERIAL PRIMARY KEY, ref VARCHAR NOT NULL, ord INTEGER DEFAULT 0,
    title VARCHAR, why TEXT, benefit TEXT, category VARCHAR, target_value VARCHAR,
    status VARCHAR DEFAULT 'open', source VARCHAR DEFAULT 'ai',
    completed_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW()
  )`;
  await sqlPool`CREATE TABLE IF NOT EXISTS fiaon_roadmap_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    partner_stage VARCHAR DEFAULT 'in_preparation',
    partner_available_from DATE DEFAULT '2026-10-01',
    auto_approve_analysis BOOLEAN DEFAULT TRUE,
    goal_min_completed_steps INTEGER DEFAULT 5,
    goal_min_savings_rate NUMERIC DEFAULT 10,
    goal_max_debt_ratio NUMERIC DEFAULT 35,
    coaching_intro TEXT, coaching_version INTEGER DEFAULT 1,
    updated_at TIMESTAMP DEFAULT NOW()
  )`;
  await sqlPool`INSERT INTO fiaon_roadmap_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`;
  await sqlPool`CREATE TABLE IF NOT EXISTS fiaon_roadmap_audit (
    id SERIAL PRIMARY KEY, actor VARCHAR, actor_type VARCHAR, ref VARCHAR,
    action VARCHAR, meta JSONB, ip VARCHAR, created_at TIMESTAMP DEFAULT NOW()
  )`;
  tablesReady = true;
}

async function audit(actor: string, actorType: string, ref: string | null, action: string, meta: any, ip?: string) {
  await sqlPool`INSERT INTO fiaon_roadmap_audit (actor, actor_type, ref, action, meta, ip)
    VALUES (${actor}, ${actorType}, ${ref}, ${action}, ${sqlPool.json(meta || {})}, ${ip || null})`.catch(() => {});
}

async function getSettings(): Promise<any> {
  const rows = await sqlPool`SELECT * FROM fiaon_roadmap_settings WHERE id = 1`;
  return rows[0] || {};
}

async function getProfile(ref: string): Promise<any | null> {
  const rows = await sqlPool`SELECT * FROM fiaon_applications WHERE ref = ${ref} LIMIT 1`;
  return rows[0] || null;
}

async function hasConsent(ref: string): Promise<boolean> {
  const rows = await sqlPool`SELECT 1 FROM fiaon_consents WHERE ref = ${ref} AND consent_type = 'statement_processing' AND version = ${CONSENT_VERSION} LIMIT 1`;
  return rows.length > 0;
}

async function countStatements(ref: string): Promise<number> {
  const rows = await sqlPool`SELECT COUNT(*)::int AS c FROM fiaon_statements WHERE ref = ${ref} AND deleted_at IS NULL`;
  return rows[0]?.c || 0;
}

/* ── Metriken (nur Aggregate) berechnen & speichern ── */
async function recomputeMetrics(ref: string): Promise<any> {
  const profile = await getProfile(ref);
  if (!profile) return null;
  const count = await countStatements(ref);
  const metrics = buildMetrics(profile, count);
  await sqlPool`INSERT INTO fiaon_metrics (ref, metrics, computed_at) VALUES (${ref}, ${sqlPool.json(metrics as any)}, NOW())
    ON CONFLICT (ref) DO UPDATE SET metrics = ${sqlPool.json(metrics as any)}, computed_at = NOW()`;
  return metrics;
}

/* ── Fahrplan-Schritte aus Analyse ableiten (Fortschritt bleibt erhalten) ── */
async function generateStepsFromAnalysis(ref: string, result: AnalysisResult, replace: boolean) {
  const existing = await sqlPool`SELECT COUNT(*)::int AS c FROM fiaon_roadmap_steps WHERE ref = ${ref}`;
  if (existing[0]?.c > 0 && !replace) return;
  if (replace) {
    // Nur KI-Schritte ersetzen; manuell angelegte + erledigte bleiben erhalten.
    await sqlPool`DELETE FROM fiaon_roadmap_steps WHERE ref = ${ref} AND source = 'ai' AND status <> 'done'`;
  }
  let ord = 0;
  for (const r of result.recommendations) {
    ord += 1;
    await sqlPool`INSERT INTO fiaon_roadmap_steps (ref, ord, title, why, benefit, category, target_value, status, source)
      VALUES (${ref}, ${ord}, ${r.title}, ${r.why}, ${r.benefit}, ${r.category}, ${r.targetValue || null}, 'open', 'ai')`;
  }
}

/* ── Ziel-Kriterien prüfen ── */
function evaluateGoal(metrics: any, doneCount: number, settings: any) {
  const minSteps = Number(settings.goal_min_completed_steps ?? 5);
  const minSavings = Number(settings.goal_min_savings_rate ?? 10);
  const maxDebt = Number(settings.goal_max_debt_ratio ?? 35);
  const savings = Number(metrics?.savingsRatePct ?? 0);
  const debt = Number(metrics?.debtToIncomePct ?? 0);
  const criteria = [
    { key: "steps", label: `${minSteps} Fahrplan-Schritte abgeschlossen`, met: doneCount >= minSteps, current: `${doneCount}/${minSteps}` },
    { key: "savings", label: `Sparquote ≥ ${minSavings}%`, met: savings >= minSavings, current: `${savings}%` },
    { key: "debt", label: `Schuldenquote < ${maxDebt}%`, met: debt >= 0 && debt < maxDebt, current: `${debt}%` },
  ];
  const allMet = criteria.every((c) => c.met);
  return { criteria, allMet };
}

/* ── Journey-Etappen bauen ── */
async function buildState(ref: string) {
  await ensureTables();
  const profile = await getProfile(ref);
  if (!profile) return null;
  const settings = await getSettings();
  const consent = await hasConsent(ref);
  const statementsCount = await countStatements(ref);
  const metricsRow = (await sqlPool`SELECT metrics FROM fiaon_metrics WHERE ref = ${ref}`)[0];
  const metrics = metricsRow?.metrics || null;
  const analysisRow = (await sqlPool`SELECT * FROM fiaon_analysis WHERE ref = ${ref}`)[0] || null;
  const analysisVisible = analysisRow && analysisRow.status === "approved" ? analysisRow : null;
  const steps = await sqlPool`SELECT id, ord, title, why, benefit, category, target_value, status, source FROM fiaon_roadmap_steps WHERE ref = ${ref} ORDER BY (status='done') ASC, ord ASC`;
  const doneCount = steps.filter((s: any) => s.status === "done").length;
  const goal = evaluateGoal(metrics, doneCount, settings);

  // Etappen-Zustände
  const hasAnalysis = !!analysisVisible;
  const hasSteps = steps.length > 0;
  const allStepsDone = hasSteps && doneCount === steps.length;
  const partnerUnlocked = settings.partner_stage === "unlocked" && goal.allMet;

  const stages = [
    { key: "welcome", title: "Willkommen & Ziel", status: "done" },
    { key: "upload", title: "Kontoauszüge hochladen", status: statementsCount > 0 ? "done" : consent ? "active" : "active" },
    { key: "analysis", title: "KI-Analyse", status: hasAnalysis ? "done" : statementsCount > 0 ? "active" : "locked" },
    { key: "roadmap", title: "Dein persönlicher Fahrplan", status: hasSteps ? (allStepsDone ? "done" : "active") : hasAnalysis ? "active" : "locked" },
    { key: "progress", title: "Fortschritt & Coaching", status: allStepsDone ? "done" : hasSteps ? "active" : "locked" },
    { key: "goal", title: "Ziel: Karte über Partner", status: partnerUnlocked ? "active" : "locked" },
  ];
  // Aktive Etappe = erste nicht-erledigte
  const activeIdx = stages.findIndex((s) => s.status !== "done");

  return {
    ref,
    firstName: profile.first_name,
    consent,
    consentVersion: CONSENT_VERSION,
    statementsCount,
    metrics,
    analysis: analysisVisible ? { summary: analysisVisible.summary, data: analysisVisible.data, generatedBy: analysisVisible.generated_by, model: analysisVisible.model } : null,
    analysisPending: !!(analysisRow && analysisRow.status === "draft"),
    steps,
    doneCount,
    stages,
    activeIdx,
    goal,
    partner: {
      stage: settings.partner_stage || "in_preparation",
      availableFrom: settings.partner_available_from,
      unlocked: partnerUnlocked,
    },
    aiConfigured: aiConfigured(),
  };
}

/* ════════════════════════════════════════════════════════════════════════
   KUNDEN-ENDPOINTS (per ref)
   ════════════════════════════════════════════════════════════════════════ */

router.get("/roadmap/:ref", async (req: Request, res: Response) => {
  try {
    const state = await buildState(String(req.params.ref));
    if (!state) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });
    res.json({ ok: true, ...state });
  } catch (err) {
    console.error("[ROADMAP-GET]", err);
    res.status(500).json({ ok: false, error: "Fehler beim Laden des Fahrplans" });
  }
});

router.post("/roadmap/:ref/consent", async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const ref = String(req.params.ref);
    if (!(await getProfile(ref))) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.socket.remoteAddress || null;
    await sqlPool`INSERT INTO fiaon_consents (ref, consent_type, version, ip, user_agent)
      VALUES (${ref}, 'statement_processing', ${CONSENT_VERSION}, ${ip}, ${req.headers["user-agent"] || ""})`;
    await audit(ref, "customer", ref, "consent_given", { version: CONSENT_VERSION }, ip || undefined);
    res.json({ ok: true, consent: true, version: CONSENT_VERSION });
  } catch (err) {
    console.error("[ROADMAP-CONSENT]", err);
    res.status(500).json({ ok: false, error: "Consent konnte nicht gespeichert werden" });
  }
});

router.post("/roadmap/:ref/upload", (req, res, next) => {
  upload.array("statements", 12)(req, res, (err: any) => {
    if (err) return res.status(400).json({ ok: false, error: err.code === "LIMIT_FILE_SIZE" ? "Datei zu groß (max. 25 MB pro Datei)." : err.message });
    next();
  });
}, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const ref = String(req.params.ref);
    if (!(await getProfile(ref))) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });
    if (!(await hasConsent(ref))) return res.status(403).json({ ok: false, error: "Bitte zuerst die Einwilligung erteilen." });

    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length === 0) return res.status(400).json({ ok: false, error: "Keine Datei ausgewählt." });
    for (const f of files) {
      if (!ALLOWED_MIME.includes(f.mimetype)) return res.status(400).json({ ok: false, error: `Format nicht erlaubt: ${f.originalname}. Nur PDF oder Bild.` });
    }

    const monthLabel = (req.body.monthLabel as string) || null;
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.socket.remoteAddress || undefined;
    for (const f of files) {
      const enc = encryptBuffer(f.buffer);
      await sqlPool`INSERT INTO fiaon_statements (ref, filename, mime, size_bytes, month_label, content_enc)
        VALUES (${ref}, ${f.originalname}, ${f.mimetype}, ${f.size}, ${monthLabel}, ${enc})`;
    }
    await audit(ref, "customer", ref, "statements_uploaded", { count: files.length, encrypted: true }, ip);
    const metrics = await recomputeMetrics(ref);
    res.json({ ok: true, uploaded: files.length, statementsCount: await countStatements(ref), metricsComputed: !!metrics });
  } catch (err) {
    console.error("[ROADMAP-UPLOAD]", err);
    res.status(500).json({ ok: false, error: "Upload fehlgeschlagen. Bitte erneut versuchen." });
  }
});

// Kunde stößt die Analyse an (nur aggregierte Kennzahlen verlassen das System)
router.post("/roadmap/:ref/analyze", async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const ref = String(req.params.ref);
    const profile = await getProfile(ref);
    if (!profile) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });
    const settings = await getSettings();
    const metrics = await recomputeMetrics(ref);
    if (!metrics) return res.status(400).json({ ok: false, error: "Keine Kennzahlen berechenbar." });

    // NACHWEIS: nur Aggregate gehen raus
    console.log(`[ROADMAP-AI] Sending ONLY aggregated metrics to AI for ${ref}:`, JSON.stringify({ ...metrics, ref: undefined }));
    const result = await analyzeMetrics(metrics);

    const autoApprove = settings.auto_approve_analysis !== false;
    await sqlPool`INSERT INTO fiaon_analysis (ref, status, summary, data, metrics_sent, generated_by, model, created_at, approved_at, approved_by)
      VALUES (${ref}, ${autoApprove ? "approved" : "draft"}, ${result.summary}, ${sqlPool.json(result as any)}, ${sqlPool.json(metrics as any)}, ${result.generatedBy}, ${result.model}, NOW(), ${autoApprove ? sqlPool`NOW()` : null}, ${autoApprove ? "auto" : null})
      ON CONFLICT (ref) DO UPDATE SET status = ${autoApprove ? "approved" : "draft"}, summary = ${result.summary}, data = ${sqlPool.json(result as any)}, metrics_sent = ${sqlPool.json(metrics as any)}, generated_by = ${result.generatedBy}, model = ${result.model}, created_at = NOW(), approved_at = ${autoApprove ? sqlPool`NOW()` : null}, approved_by = ${autoApprove ? "auto" : null}`;

    if (autoApprove) await generateStepsFromAnalysis(ref, result, false);
    await audit(ref, "customer", ref, "analysis_requested", { generatedBy: result.generatedBy, model: result.model, autoApprove }, req.socket.remoteAddress || undefined);
    res.json({ ok: true, pending: !autoApprove, generatedBy: result.generatedBy });
  } catch (err) {
    console.error("[ROADMAP-ANALYZE]", err);
    res.status(500).json({ ok: false, error: "Analyse fehlgeschlagen. Deine Daten sind sicher gespeichert — bitte später erneut versuchen." });
  }
});

router.post("/roadmap/:ref/step/:id/toggle", async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const ref = String(req.params.ref);
    const id = Number(req.params.id);
    const rows = await sqlPool`SELECT status FROM fiaon_roadmap_steps WHERE id = ${id} AND ref = ${ref}`;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Schritt nicht gefunden" });
    const next = rows[0].status === "done" ? "open" : "done";
    await sqlPool`UPDATE fiaon_roadmap_steps SET status = ${next}, completed_at = ${next === "done" ? sqlPool`NOW()` : null} WHERE id = ${id} AND ref = ${ref}`;
    await audit(ref, "customer", ref, "step_toggle", { id, status: next });
    res.json({ ok: true, status: next });
  } catch (err) {
    console.error("[ROADMAP-STEP]", err);
    res.status(500).json({ ok: false, error: "Konnte Schritt nicht aktualisieren" });
  }
});

// GDPR: Kunde löscht seine hochgeladenen Kontoauszüge
router.post("/roadmap/:ref/delete-statements", async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const ref = String(req.params.ref);
    const r = await sqlPool`UPDATE fiaon_statements SET content_enc = ${Buffer.alloc(0)}, deleted_at = NOW() WHERE ref = ${ref} AND deleted_at IS NULL`;
    await audit(ref, "customer", ref, "statements_deleted", { count: r.count }, req.socket.remoteAddress || undefined);
    res.json({ ok: true, deleted: r.count });
  } catch (err) {
    console.error("[ROADMAP-DELETE]", err);
    res.status(500).json({ ok: false, error: "Löschung fehlgeschlagen" });
  }
});

// KI-Login-Begrüßung (nur aggregierte Signale)
router.get("/roadmap/:ref/greeting", async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const ref = String(req.params.ref);
    const profile = await getProfile(ref);
    if (!profile) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });
    const state = await buildState(ref);
    const nextStep = state?.steps.find((s: any) => s.status !== "done") || null;
    const metrics = state?.metrics;
    const text = await generateGreeting({
      firstName: profile.first_name,
      stage: state?.stages[state.activeIdx]?.key || "welcome",
      nextStepTitle: nextStep?.title || null,
      completedSteps: state?.doneCount || 0,
      totalSteps: state?.steps.length || 0,
      nextDueDate: profile.payment_due_date || null,
      nextDueAmount: profile.amount_due != null ? Number(profile.amount_due) : null,
      surplusPositive: metrics ? metrics.surplus >= 0 : undefined,
      savingsRatePct: metrics ? metrics.savingsRatePct : null,
    });
    res.json({ ok: true, greeting: text, aiConfigured: aiConfigured() });
  } catch (err) {
    console.error("[ROADMAP-GREETING]", err);
    res.status(500).json({ ok: false, error: "Begrüßung konnte nicht erstellt werden" });
  }
});

/* ════════════════════════════════════════════════════════════════════════
   ADMIN-ENDPOINTS (requireAdmin) — Zugriffe auf sensible Daten werden auditiert
   ════════════════════════════════════════════════════════════════════════ */

router.get("/admin/roadmap/customers", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const rows = await sqlPool`
      SELECT a.ref, a.first_name, a.last_name, a.email, a.pack_name, a.account_status,
        (SELECT COUNT(*)::int FROM fiaon_statements s WHERE s.ref = a.ref AND s.deleted_at IS NULL) AS statements,
        (SELECT status FROM fiaon_analysis an WHERE an.ref = a.ref) AS analysis_status,
        (SELECT COUNT(*)::int FROM fiaon_roadmap_steps st WHERE st.ref = a.ref) AS steps_total,
        (SELECT COUNT(*)::int FROM fiaon_roadmap_steps st WHERE st.ref = a.ref AND st.status='done') AS steps_done
      FROM fiaon_applications a
      WHERE a.merged_into IS NULL AND (
        EXISTS (SELECT 1 FROM fiaon_statements s WHERE s.ref = a.ref)
        OR EXISTS (SELECT 1 FROM fiaon_analysis an WHERE an.ref = a.ref)
        OR EXISTS (SELECT 1 FROM fiaon_roadmap_steps st WHERE st.ref = a.ref)
      )
      ORDER BY a.updated_at DESC NULLS LAST LIMIT 200`;
    res.json({ ok: true, customers: rows });
  } catch (err) {
    console.error("[ADMIN-ROADMAP-LIST]", err);
    res.status(500).json({ ok: false, error: "Liste konnte nicht geladen werden" });
  }
});

router.get("/admin/roadmap/settings", requireAdmin, async (_req: Request, res: Response) => {
  await ensureTables();
  res.json({ ok: true, settings: await getSettings(), aiConfigured: aiConfigured(), encryptionDedicatedKey: hasDedicatedKey() });
});

router.post("/admin/roadmap/settings", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const b = req.body || {};
    const cur = await getSettings();
    const partnerStage = b.partnerStage === "unlocked" ? "unlocked" : "in_preparation";
    const autoApprove = b.autoApproveAnalysis !== undefined ? !!b.autoApproveAnalysis : cur.auto_approve_analysis;
    const minSteps = b.goalMinCompletedSteps != null ? Number(b.goalMinCompletedSteps) : cur.goal_min_completed_steps;
    const minSavings = b.goalMinSavingsRate != null ? Number(b.goalMinSavingsRate) : cur.goal_min_savings_rate;
    const maxDebt = b.goalMaxDebtRatio != null ? Number(b.goalMaxDebtRatio) : cur.goal_max_debt_ratio;
    const coachingIntro = b.coachingIntro !== undefined ? String(b.coachingIntro) : cur.coaching_intro;
    const bumpVersion = b.coachingIntro !== undefined && b.coachingIntro !== cur.coaching_intro;
    await sqlPool`UPDATE fiaon_roadmap_settings SET
      partner_stage = ${partnerStage}, auto_approve_analysis = ${autoApprove},
      goal_min_completed_steps = ${minSteps}, goal_min_savings_rate = ${minSavings}, goal_max_debt_ratio = ${maxDebt},
      coaching_intro = ${coachingIntro}, coaching_version = coaching_version + ${bumpVersion ? 1 : 0}, updated_at = NOW()
      WHERE id = 1`;
    await audit((req as any).adminUser?.username || "admin", "admin", null, "settings_update", { partnerStage, autoApprove, minSteps, minSavings, maxDebt });
    res.json({ ok: true, settings: await getSettings() });
  } catch (err) {
    console.error("[ADMIN-ROADMAP-SETTINGS]", err);
    res.status(500).json({ ok: false, error: "Einstellungen konnten nicht gespeichert werden" });
  }
});

router.get("/admin/roadmap/audit", requireAdmin, async (req: Request, res: Response) => {
  await ensureTables();
  const ref = req.query.ref ? String(req.query.ref) : null;
  const rows = ref
    ? await sqlPool`SELECT * FROM fiaon_roadmap_audit WHERE ref = ${ref} ORDER BY created_at DESC LIMIT 200`
    : await sqlPool`SELECT * FROM fiaon_roadmap_audit ORDER BY created_at DESC LIMIT 200`;
  res.json({ ok: true, audit: rows });
});

router.get("/admin/roadmap/:ref", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const ref = String(req.params.ref);
    const state = await buildState(ref);
    if (!state) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });
    const statements = await sqlPool`SELECT id, filename, mime, size_bytes, month_label, uploaded_at, deleted_at FROM fiaon_statements WHERE ref = ${ref} ORDER BY uploaded_at DESC`;
    const consents = await sqlPool`SELECT consent_type, version, ip, created_at FROM fiaon_consents WHERE ref = ${ref} ORDER BY created_at DESC`;
    const analysisRow = (await sqlPool`SELECT * FROM fiaon_analysis WHERE ref = ${ref}`)[0] || null;
    await audit((req as any).adminUser?.username || "admin", "admin", ref, "admin_view", { section: "roadmap" }, req.socket.remoteAddress || undefined);
    res.json({ ok: true, state, statements, consents, analysisRaw: analysisRow });
  } catch (err) {
    console.error("[ADMIN-ROADMAP-GET]", err);
    res.status(500).json({ ok: false, error: "Kunde konnte nicht geladen werden" });
  }
});

// Entschlüsselten Kontoauszug streamen — nur Admin, wird auditiert
router.get("/admin/roadmap/:ref/statement/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const ref = String(req.params.ref);
    const id = Number(req.params.id);
    const rows = await sqlPool`SELECT filename, mime, content_enc, deleted_at FROM fiaon_statements WHERE id = ${id} AND ref = ${ref}`;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Nicht gefunden" });
    if (rows[0].deleted_at) return res.status(410).json({ ok: false, error: "Datei wurde gelöscht" });
    const plain = decryptBuffer(Buffer.from(rows[0].content_enc));
    await audit((req as any).adminUser?.username || "admin", "admin", ref, "statement_download", { id, filename: rows[0].filename }, req.socket.remoteAddress || undefined);
    res.setHeader("Content-Type", rows[0].mime || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${(rows[0].filename || "auszug").replace(/[^\w.\-]/g, "_")}"`);
    res.send(plain);
  } catch (err) {
    console.error("[ADMIN-ROADMAP-STATEMENT]", err);
    res.status(500).json({ ok: false, error: "Datei konnte nicht entschlüsselt werden" });
  }
});

router.post("/admin/roadmap/:ref/analyze", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const ref = String(req.params.ref);
    if (!(await getProfile(ref))) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });
    const metrics = await recomputeMetrics(ref);
    if (!metrics) return res.status(400).json({ ok: false, error: "Keine Kennzahlen berechenbar." });
    console.log(`[ROADMAP-AI] (admin) Sending ONLY aggregated metrics to AI for ${ref}`);
    const result = await analyzeMetrics(metrics);
    await sqlPool`INSERT INTO fiaon_analysis (ref, status, summary, data, metrics_sent, generated_by, model, created_at)
      VALUES (${ref}, 'draft', ${result.summary}, ${sqlPool.json(result as any)}, ${sqlPool.json(metrics as any)}, ${result.generatedBy}, ${result.model}, NOW())
      ON CONFLICT (ref) DO UPDATE SET status = 'draft', summary = ${result.summary}, data = ${sqlPool.json(result as any)}, metrics_sent = ${sqlPool.json(metrics as any)}, generated_by = ${result.generatedBy}, model = ${result.model}, created_at = NOW(), approved_at = NULL, approved_by = NULL`;
    await audit((req as any).adminUser?.username || "admin", "admin", ref, "analysis_regenerated", { generatedBy: result.generatedBy });
    res.json({ ok: true, result });
  } catch (err) {
    console.error("[ADMIN-ROADMAP-ANALYZE]", err);
    res.status(500).json({ ok: false, error: "Analyse fehlgeschlagen" });
  }
});

router.post("/admin/roadmap/:ref/analysis/approve", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const ref = String(req.params.ref);
    const row = (await sqlPool`SELECT data FROM fiaon_analysis WHERE ref = ${ref}`)[0];
    if (!row) return res.status(404).json({ ok: false, error: "Keine Analyse vorhanden" });
    await sqlPool`UPDATE fiaon_analysis SET status = 'approved', approved_at = NOW(), approved_by = ${(req as any).adminUser?.username || "admin"} WHERE ref = ${ref}`;
    await generateStepsFromAnalysis(ref, row.data as AnalysisResult, true);
    await audit((req as any).adminUser?.username || "admin", "admin", ref, "analysis_approved", {});
    res.json({ ok: true });
  } catch (err) {
    console.error("[ADMIN-ROADMAP-APPROVE]", err);
    res.status(500).json({ ok: false, error: "Freigabe fehlgeschlagen" });
  }
});

// Schritte bearbeiten/hinzufügen/löschen (QS durch Mensch)
router.post("/admin/roadmap/:ref/steps", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const ref = String(req.params.ref);
    const steps = Array.isArray(req.body?.steps) ? req.body.steps : [];
    await sqlPool`DELETE FROM fiaon_roadmap_steps WHERE ref = ${ref}`;
    let ord = 0;
    for (const s of steps) {
      ord += 1;
      await sqlPool`INSERT INTO fiaon_roadmap_steps (ref, ord, title, why, benefit, category, target_value, status, source)
        VALUES (${ref}, ${ord}, ${String(s.title || "")}, ${String(s.why || "")}, ${String(s.benefit || "")}, ${String(s.category || "Allgemein")}, ${s.targetValue || null}, ${s.status === "done" ? "done" : "open"}, ${s.source === "ai" ? "ai" : "manual"})`;
    }
    await audit((req as any).adminUser?.username || "admin", "admin", ref, "steps_edited", { count: steps.length });
    res.json({ ok: true, count: steps.length });
  } catch (err) {
    console.error("[ADMIN-ROADMAP-STEPS]", err);
    res.status(500).json({ ok: false, error: "Schritte konnten nicht gespeichert werden" });
  }
});

export default router;
