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

    // ── E-IT-B (08.10.2026, Gegenprüfung): BESTÄTIGEN BUCHT AUF DAS RICHTIGE PAKET, ZUM EINGANGSTAG ──
    // Das Formular hängt den Antrag an IRGENDEINE Bestellung des Menschen (oben, LIMIT 1 ohne Reihenfolge) —
    // oft eine zusammengeführte Doppelbestellung, die kuendigungSetzen gar nicht findet: Der Antrag stand dann
    // auf „Bestätigt“, gekündigt war nichts. Und gebucht wurde mit HEUTIGEM Datum statt zum Eingang. Jetzt
    // derselbe Weg wie in der Akte (antragBuchen, Ziel aus antragZiel in shared/fiaon-kuendigung-regel.ts) —
    // die Bestätigung im Chefbüro ist eine Entscheidung der Leitung. Ohne Ziel: nichts bestätigen, Grund nennen.
    let vorgang: any = null;
    let gebucht = false;
    if (status === "confirmed") {
      const { offeneKuendigungsantraege } = await import("../lib/fiaon-kuendigung");
      const [offen] = await offeneKuendigungsantraege(null, Number(id)).catch(() => [] as any[]);
      if (offen) {
        if (!offen.ziel.ziel) {
          return res.status(409).json({ ok: false, error: `${offen.ziel.satz} Bitte „Ablehnen“ (ohne Kündigung) oder in der Akte das richtige Paket kündigen.` });
        }
        const { antragBuchen } = await import("./fiaon-kuendigung");
        vorgang = await antragBuchen(offen, {
          grund: String(adminNote ?? offen.grund ?? "Kündigungsantrag bestätigt").slice(0, 300),
          personId: offen.personId, alsLeitung: true,
          unterzeichner: { name: String(processedBy ?? "FIAON LTD"), rolle: "Geschäftsführung" },
        }).catch((e: any) => ({ ok: false, error: String(e?.message || e) }));
        if (!vorgang?.ok) return res.status(409).json({ ok: false, error: `Nicht gebucht: ${vorgang?.grund || vorgang?.error || "unbekannt"}`, vertrag: vorgang });
        gebucht = true;
      } else {
        // Kam NACH dem Antrag eine Rücknahme, ist der Kunde geblieben — „Bestätigen“ kündigte sonst einen zahlenden
        // Kunden (Fall 11498, Antrag #85). Dann nur „Ablehnen“.
        const [rz] = (await sqlPool`
          SELECT EXISTS (SELECT 1 FROM fiaon_applications a JOIN fiaon_applications r ON r.person_id = a.person_id
                          WHERE a.ref = c.ref AND r.kuendigung_zurueckgenommen_am >= c.created_at) AS zurueck
            FROM cancellation_requests c WHERE c.id = ${Number(id)}`.catch(() => [])) as any[];
        if (rz?.zurueck) {
          return res.status(409).json({ ok: false, error: "Nach diesem Antrag wurde die Kündigung zurückgenommen — der Kunde ist geblieben. Bitte „Ablehnen“." });
        }
      }
    }

    const [updated] = await sqlPool`
      UPDATE cancellation_requests
      SET
        status       = ${status},
        admin_note   = COALESCE(${adminNote ?? null}, admin_note),
        processed_by = ${processedBy ?? "Admin"},
        processed_at = NOW(),
        updated_at   = NOW()
      WHERE id = ${id}
      RETURNING *, created_at::timestamptz AS eingang_tz
    `;

    if (!updated) {
      return res.status(404).json({ ok: false, error: "Kündigungsantrag nicht gefunden." });
    }

    // ══════════════════════════════════════════════════════════════════════
    // BESTÄTIGEN HEISST KÜNDIGEN (23.09.2026, E-213)
    //
    // Bis hierher hat diese Route AUSSCHLIESSLICH `cancellation_requests.status`
    // gesetzt. Der Vertrag blieb unberührt: Raten liefen weiter, Mahnungen
    // gingen raus, der Kunde galt als aktiv. Genau dieser Fehler steht im Kopf
    // von server/lib/fiaon-kuendigung.ts als Anlass für E-092 („Bestätigen
    // änderte nur den Antrag, nie das Abo") — behoben wurde er damals überall,
    // nur an dieser Tür nicht, weil sie in einer anderen Datei wohnt.
    //
    // Jetzt geht sie denselben Weg wie die drei anderen: kuendigungDurchfuehren
    // setzt die Wirkung, fertigt die Urkunde aus und schickt die Bestätigung.
    // ══════════════════════════════════════════════════════════════════════
    if (status === "confirmed" && updated.ref && !gebucht) {
      const { kuendigungDurchfuehren } = await import("./fiaon-kuendigung");
      // `cancellation_requests` führt keine person_id — der Verlauf hängt aber
      // am Menschen. Also über die Bestellung nachschlagen.
      const [pz] = (await sqlPool`SELECT person_id FROM fiaon_applications WHERE ref = ${String(updated.ref)} LIMIT 1`.catch(() => [])) as any[];
      vorgang = await kuendigungDurchfuehren(String(updated.ref), {
        quelle: "formular",
        // E-IT-B (08.10.2026): zum Eingangstag des Antrags, nie zu heute.
        am: updated.eingang_tz ? new Date(updated.eingang_tz).toISOString() : null,
        grund: String(adminNote ?? updated.reason ?? "Kündigungsantrag bestätigt").slice(0, 300),
        personId: pz?.person_id ?? null,
        unterzeichner: { name: String(processedBy ?? "FIAON LTD"), rolle: "Geschäftsführung" },
      }).catch((e: any) => {
        logger.error("[CANCELLATION] Durchführung fehlgeschlagen:", e);
        return { ok: false, error: String(e?.message || e) };
      });
    }

    logger.info(`[CANCELLATION] #${id} set to ${status} by ${processedBy ?? "Admin"}${vorgang ? ` — Vertrag: ${vorgang.weg ?? vorgang.error}` : ""}`);

    return res.json({ ok: true, data: updated, vertrag: vorgang });
  } catch (err: any) {
    logger.error("[CANCELLATION] PATCH admin error:", err);
    return res.status(500).json({ ok: false, error: "Interner Serverfehler." });
  }
});

export default router;
