import { Router } from "express";
import { sqlPool } from "../lib/db-pool";
import { logger } from "../logger";

const router = Router();


// ─── Ensure table exists (idempotent) ────────────────────────────────────────
async function ensureTable() {
  await sqlPool`
    CREATE TABLE IF NOT EXISTS cancellation_requests (
      id               SERIAL PRIMARY KEY,
      ref              VARCHAR NOT NULL,
      first_name       VARCHAR NOT NULL,
      last_name        VARCHAR NOT NULL,
      email            VARCHAR NOT NULL,
      phone            VARCHAR,
      package_name     VARCHAR,
      reason           TEXT,
      cancellation_date DATE,
      status           VARCHAR NOT NULL DEFAULT 'pending',
      admin_note       TEXT,
      processed_by     VARCHAR,
      processed_at     TIMESTAMP,
      created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;
}
ensureTable().catch(err => logger.error("[CANCELLATION] ensureTable error:", err));

// ─── POST /api/fiaon/abo-kuendigen ───────────────────────────────────────────
// Public endpoint — user submits a cancellation request after identity check.
// Identifies the applicant via first name, last name, email + birthdate.
// If reason === "__verify_only__" the identity is checked but nothing is inserted.
router.post("/abo-kuendigen", async (req, res) => {
  try {
    const { firstName, lastName, email, birthdate, phone, reason, cancellationDate } = req.body;

    if (!firstName || !lastName || !email || !birthdate) {
      return res.status(400).json({ ok: false, error: "Pflichtfelder fehlen (firstName, lastName, email, birthdate)" });
    }

    // Verify the applicant exists in fiaon_applications via birthdate
    const apps = await sqlPool`
      SELECT ref, first_name, last_name, email, pack_name
      FROM fiaon_applications
      WHERE LOWER(email)      = LOWER(${email})
        AND LOWER(first_name) = LOWER(${firstName})
        AND LOWER(last_name)  = LOWER(${lastName})
        AND birthdate::date   = ${birthdate}::date
      LIMIT 1
    `;

    if (apps.length === 0) {
      return res.status(404).json({
        ok: false,
        error: "Keine Übereinstimmung gefunden. Bitte prüfe Vor- und Nachname, E-Mail sowie Geburtsdatum.",
      });
    }

    // Verify-only mode — just confirm identity without inserting
    if (reason === "__verify_only__") {
      return res.json({ ok: true });
    }

    // Prevent duplicate pending requests (deduplicate by email)
    const existing = await sqlPool`
      SELECT id FROM cancellation_requests
      WHERE LOWER(email) = LOWER(${email}) AND status = 'pending'
      LIMIT 1
    `;

    if (existing.length > 0) {
      return res.status(409).json({
        ok: false,
        error: "Es liegt bereits ein offener Kündigungsantrag für dieses Konto vor.",
      });
    }

    const appRef = apps[0].ref;

    const [row] = await sqlPool`
      INSERT INTO cancellation_requests
        (ref, first_name, last_name, email, phone, package_name, reason, cancellation_date)
      VALUES (
        ${appRef},
        ${firstName},
        ${lastName},
        ${email},
        ${phone ?? null},
        ${apps[0].pack_name ?? null},
        ${reason ?? null},
        ${cancellationDate ?? null}
      )
      RETURNING id, ref, status, created_at
    `;

    logger.info(`[CANCELLATION] New request #${row.id} for ref=${appRef} email=${email}`);

    return res.json({ ok: true, id: row.id, ref: row.ref, status: row.status });
  } catch (err: any) {
    logger.error("[CANCELLATION] POST error:", err);
    return res.status(500).json({ ok: false, error: "Interner Serverfehler. Bitte später erneut versuchen." });
  }
});

// ─── GET /api/fiaon/admin/cancellations ──────────────────────────────────────
// Admin endpoint — list all cancellation requests.
router.get("/admin/cancellations", async (req, res) => {
  try {
    const status = (req.query.status as string) || "all";
    const rows = status === "all"
      ? await sqlPool`SELECT * FROM cancellation_requests ORDER BY created_at DESC`
      : await sqlPool`SELECT * FROM cancellation_requests WHERE status = ${status} ORDER BY created_at DESC`;

    return res.json({ ok: true, data: rows });
  } catch (err: any) {
    logger.error("[CANCELLATION] GET admin list error:", err);
    return res.status(500).json({ ok: false, error: "Fehler beim Laden der Kündigungsanträge." });
  }
});

// ─── PATCH /api/fiaon/admin/cancellations/:id ─────────────────────────────────
// Admin endpoint — confirm or reject a cancellation request.
router.patch("/admin/cancellations/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNote, processedBy } = req.body;

    if (!status || !["confirmed", "rejected"].includes(status)) {
      return res.status(400).json({ ok: false, error: "Status muss 'confirmed' oder 'rejected' sein." });
    }

    const [updated] = await sqlPool`
      UPDATE cancellation_requests
      SET
        status       = ${status},
        admin_note   = ${adminNote ?? null},
        processed_by = ${processedBy ?? "Admin"},
        processed_at = NOW(),
        updated_at   = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (!updated) {
      return res.status(404).json({ ok: false, error: "Kündigungsantrag nicht gefunden." });
    }

    logger.info(`[CANCELLATION] #${id} set to ${status} by ${processedBy ?? "Admin"}`);

    return res.json({ ok: true, data: updated });
  } catch (err: any) {
    logger.error("[CANCELLATION] PATCH admin error:", err);
    return res.status(500).json({ ok: false, error: "Interner Serverfehler." });
  }
});

export default router;
