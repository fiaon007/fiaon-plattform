import { Router, type Request } from "express";
import { sqlPool } from "../lib/db-pool";
import { logger } from "../logger";
import { geburtsdatumAnzeige, geburtsdatumLesen } from "../../shared/fiaon-geburtsdatum";
import { KUENDIGUNG_IDENTITAET_OFFEN_SQL } from "../../shared/fiaon-kuendigung-regel";
import {
  kuendigungIdentitaet, kuendigungDrossel, kopfDerKette, KUENDIGUNG_KEIN_TREFFER, KUENDIGUNG_ZU_VIELE, type KuendigungUeber,
  kuendigungEingangInhalt,
} from "../lib/fiaon-kuendigung-identitaet";

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
      -- E-IT-G (08.10.2026): 'geburtsdatum', 'name_email' oder 'name_email_abweichend' (Team prüft). Bestand: Migration 103.
      identifiziert_ueber VARCHAR,
      admin_note       TEXT,
      processed_by     VARCHAR,
      processed_at     TIMESTAMP,
      created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;
  await identitaetSpalteSichern();
}

// ── E-IT-G (08.10.2026), Gegenprüfung: DIE KÜNDIGUNG HÄNGT NIE AN EINER MIGRATION ──
// CREATE TABLE IF NOT EXISTS legt bei der bestehenden Tabelle keine neue
// Spalte an. Scheiterte Migration 103 (eine Datei = eine Transaktion), fehlte
// identifiziert_ueber — und jedes INSERT der Kündigungsseite endete mit 500.
// Darum hier: Fehlt die Spalte, wird sie angelegt — nur dann (Katalog-Abfrage
// zuerst, keine Sperre im Normalfall), mit lock_timeout (E-254). Die Tabelle
// ist kalt (rund 80 Anträge in 60 Tagen), die Spalte ohne Vorgabewert ist
// eine reine Katalog-Änderung. Zusätzlich fängt das INSERT unten 42703 ab.
async function identitaetSpalteSichern(): Promise<boolean> {
  const [da] = (await sqlPool`
    SELECT 1 AS da FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = 'cancellation_requests' AND column_name = 'identifiziert_ueber'
     LIMIT 1
  `) as any[];
  if (da) return false;
  await sqlPool.begin(async (tx: any) => {
    await tx`SET LOCAL lock_timeout = '3s'`;
    await tx`ALTER TABLE cancellation_requests ADD COLUMN IF NOT EXISTS identifiziert_ueber VARCHAR`;
  });
  logger.info("[CANCELLATION] Spalte identifiziert_ueber nachgelegt (Migration 103 fehlte).");
  return true;
}
/** Für den Prüfstand: wartet, bis Tabelle und Spalte stehen. */
export const kuendigungTabelleBereit: Promise<void> = ensureTable().catch(err => logger.error("[CANCELLATION] ensureTable error:", err));
export { identitaetSpalteSichern };

/** Wie die Kündigung angenommen wurde — für Verlauf, Aufgabe und Notiz. */
const UEBER_TEXT: Record<Exclude<KuendigungUeber, "geburtsdatum">, string> = {
  name_email: "ohne Geburtsdatum angenommen (bei uns ist keines hinterlegt)",
  name_email_abweichend: "angenommen, obwohl das Geburtsdatum nicht zu unseren Angaben passt",
};

/**
 * Der Antrag in die Tabelle. Fehlt die Spalte identifiziert_ueber (Migration
 * 103 nicht eingespielt), geht er OHNE sie hinein — die Kennung steht dann in
 * admin_note. Eine Kündigung darf nie an einer Spalte scheitern (§ 312k BGB).
 */
export async function kuendigungsAntragEinfuegen(w: {
  ref: string; firstName: string; lastName: string; email: string; phone: string | null;
  packName: string | null; reason: string | null; cancellationDate: string | null; ueber: KuendigungUeber;
}): Promise<{ id: number; ref: string; status: string; created_at: unknown; ohneSpalte: boolean }> {
  try {
    const [row] = (await sqlPool`
      INSERT INTO cancellation_requests
        (ref, first_name, last_name, email, phone, package_name, reason, cancellation_date, identifiziert_ueber)
      VALUES (${w.ref}, ${w.firstName}, ${w.lastName}, ${w.email}, ${w.phone}, ${w.packName}, ${w.reason}, ${w.cancellationDate}, ${w.ueber})
      RETURNING id, ref, status, created_at
    `) as any[];
    return { ...row, ohneSpalte: false };
  } catch (e: any) {
    if (e?.code !== "42703") throw e;
    logger.error("[CANCELLATION] Spalte identifiziert_ueber fehlt — Antrag ohne sie angelegt (Migration 103 prüfen).");
    const notiz = w.ueber === "geburtsdatum" ? null : `[Kündigungsseite: ${UEBER_TEXT[w.ueber]} – Identität prüfen]`;
    const [row] = (await sqlPool`
      INSERT INTO cancellation_requests
        (ref, first_name, last_name, email, phone, package_name, reason, cancellation_date, admin_note)
      VALUES (${w.ref}, ${w.firstName}, ${w.lastName}, ${w.email}, ${w.phone}, ${w.packName}, ${w.reason}, ${w.cancellationDate}, ${notiz})
      RETURNING id, ref, status, created_at
    `) as any[];
    void identitaetSpalteSichern().catch(() => {});
    return { ...row, ohneSpalte: true };
  }
}

/**
 * Die Eingangsbestätigung der Kündigungsseite (Querprüfung 08.10.2026, § 312k Abs. 4 BGB): Inhalt der
 * Erklärung, Datum und Uhrzeit des Eingangs, gewünschter Zeitpunkt, „gilt ab dem Eingang“ — Mailwerk-Ereignis
 * kuendigung_eingegangen (Pflichtmail, Vertragspost). Der Versand steht im Verlauf der Bestellung.
 */
export async function eingangBestaetigen(w: {
  ref: string; antragId: number; am: Date; name: string; wunsch: string | null; grund: string | null; packName: string | null; email: string;
}): Promise<{ gesendet: boolean; grund?: string | null; inhalt: Record<string, string> }> {
  const [a] = (await sqlPool`
    SELECT ref, person_id, email, contact_email, billing_email, first_name, last_name, contact_name, payment_reference, amount_due, pack_name
      FROM fiaon_applications WHERE ref = ${w.ref} LIMIT 1`) as any[];
  const inhalt = kuendigungEingangInhalt({ am: w.am, wunsch: w.wunsch, paket: a?.pack_name ?? w.packName, grund: w.grund, antragNr: w.antragId, name: w.name });
  const { sendMakeWebhookMitGrund, makePayloadFromRow } = await import("../make-webhook");
  const erg: any = await sendMakeWebhookMitGrund("kuendigung_eingegangen", {
    ...makePayloadFromRow(a ?? { ref: w.ref, email: w.email }), ...inhalt,
  } as any).catch((e: any) => ({ ok: false, grund: String(e?.message || e) }));
  const gesendet = erg?.ok === true;
  await sqlPool`
    INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
    VALUES (${w.ref}, ${a?.person_id ?? null}, NULL, 'System', 'system',
            ${`Eingangsbestätigung der Kündigung (Antrag Nr. ${w.antragId}, Eingang ${inhalt.eingang_text}, Kündigung zum ${inhalt.zeitpunkt_text}) `
              + (gesendet ? "per E-Mail gesendet." : `NICHT gesendet (${String(erg?.grund ?? "unbekannt").slice(0, 160)}) — bitte die Bestätigung von Hand nachholen.`)})
  `.catch((e) => logger.error("[CANCELLATION] Verlauf Eingangsbestätigung:", e));
  return { gesendet, grund: gesendet ? null : String(erg?.grund ?? "unbekannt"), inhalt };
}

/** Die Adresse des Anfragenden — Muster clientIp (fiaon-app-login.ts): req.ip (trust proxy 1), sonst der LETZTE X-Forwarded-For-Eintrag. */
function anfragerIp(req: Request): string {
  if (req.ip) return String(req.ip);
  const weiter = String(req.headers["x-forwarded-for"] || "").split(",").map((x) => x.trim()).filter(Boolean);
  return weiter.length ? weiter[weiter.length - 1] : (req.socket?.remoteAddress || "");
}
const drossel = kuendigungDrossel();

// ─── POST /api/fiaon/abo-kuendigen ───────────────────────────────────────────
// Public endpoint — user submits a cancellation request after identity check.
// Identifies the applicant via first name, last name, email (+ birthdate, see below).
// If reason === "__verify_only__" the identity is checked but nothing is inserted.
//
// ── E-IT-G (08.10.2026), Punkt (14): DIE KÜNDIGUNG SCHEITERT NICHT MEHR AM GEBURTSDATUM ──
// VORHER verglich die Prüfung NUR fiaon_applications.birthdate. Gemessen am
// 08.10.: 31 bezahlte Bestellungen (29 Menschen) kamen hier nie durch — ihr
// Geburtsdatum stand nur an der Person oder nirgends. Auf der Seite stand
// „Keine Übereinstimmung“: eine Sackgasse am Kündigungsbutton (§ 312k BGB).
// Dazu verlangte das Datumsfeld des Browsers aus „63“ das Jahr 0063.
// NACHHER (nach der Gegenprüfung vom 08.10.):
//   · Das eingegebene Datum geht durch den einen Leser (shared, Kontext
//     „pruefung“: zweistellige Jahre ergänzt, keine Altersregel).
//   · Verglichen wird gegen Bestellung UND Person; der Name auch zusammen-
//     gesetzt (anders geteilte Altdaten) — server/lib/fiaon-kuendigung-identitaet.ts.
//   · Passen Name und E-Mail, wird die Kündigung IMMER angenommen. Fehlt bei
//     uns das Geburtsdatum ('name_email', Justin 08.10.) oder widerspricht die
//     Eingabe ('name_email_abweichend'), prüft das Team die Identität: Aufgabe
//     „Kündigung – Identität prüfen“ beim Betreuer, Verlaufseintrag in der Akte,
//     und der Sammellauf Altbestand (fiaon-kuendigung.ts) bucht den Antrag erst,
//     wenn die Aufgabe erledigt ist.
//   · Nach außen gibt es nur „angenommen“ oder EINE neutrale Meldung — nie,
//     ob es die E-Mail bei uns gibt oder ob das Datum falsch war. Dazu eine
//     Drossel auf Fehlschläge (10 je IP, 5 je E-Mail in 15 Minuten).
router.post("/abo-kuendigen", async (req, res) => {
  try {
    const { firstName, lastName, email, birthdate, phone, reason, cancellationDate } = req.body ?? {};

    if (!firstName || !lastName || !email) {
      return res.status(400).json({ ok: false, error: "Bitte Vorname, Nachname und E-Mail-Adresse angeben." });
    }
    const ip = anfragerIp(req);
    if (drossel.gesperrt(ip, String(email))) {
      return res.status(429).json({ ok: false, error: KUENDIGUNG_ZU_VIELE });
    }
    // Das Geburtsdatum darf fehlen oder unlesbar sein — dann zählt es als „nicht angegeben“.
    const geburt = birthdate ? geburtsdatumLesen(birthdate, "pruefung").iso : null;

    // Alle Bestellungen mit dieser E-Mail — mit dem Geburtsdatum der Person dazu.
    const kandidaten = (await sqlPool`
      SELECT a.ref, a.first_name, a.last_name, a.email, a.pack_name, a.merged_into,
             a.birthdate AS app_geburt, p.birthdate AS person_geburt, a.person_id
        FROM fiaon_applications a
        LEFT JOIN fiaon_persons p ON p.id = a.person_id
       WHERE LOWER(TRIM(a.email)) = LOWER(TRIM(${String(email)}))
       ORDER BY (a.merged_into IS NULL) DESC, (a.payment_status = 'paid') DESC, a.created_at DESC
       LIMIT 50
    `) as any[];
    const ident = kuendigungIdentitaet(kandidaten, { firstName, lastName, geburt });

    if (!ident.treffer || !ident.ueber) {
      drossel.fehlschlag(ip, String(email));
      // Eine Meldung für jeden Fall — keine Auskunft, ob es die E-Mail bei uns gibt.
      return res.status(404).json({ ok: false, error: KUENDIGUNG_KEIN_TREFFER });
    }
    const treffer = ident.treffer;
    const ueber = ident.ueber;

    // Verify-only mode — just confirm identity without inserting (nichts weiter nach außen).
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

    // Ein zusammengeführter Treffer zeigt auf die Bestellung, in die er aufging —
    // über die ganze Kette bis zur lebenden (Gegenprüfung 08.10.: ein Schritt reichte nicht).
    const appRef = await kopfDerKette(String(treffer.ref), treffer.merged_into, async (r) => {
      const [n] = (await sqlPool`SELECT merged_into FROM fiaon_applications WHERE ref = ${r} LIMIT 1`) as any[];
      return n?.merged_into ? String(n.merged_into) : null;
    });

    const row = await kuendigungsAntragEinfuegen({
      ref: appRef, firstName: String(firstName), lastName: String(lastName), email: String(email),
      phone: phone ?? null, packName: treffer.pack_name ?? null, reason: reason ?? null,
      cancellationDate: cancellationDate ?? null, ueber,
    });

    // E-IT-G: Ohne passendes Geburtsdatum angenommen → Verlauf UND Aufgabe, damit das Team die Identität prüft.
    if (ueber !== "geburtsdatum") {
      const angegeben = geburt ? geburtsdatumAnzeige(geburt) : "keines";
      const satz = ueber === "name_email"
        ? `Kündigungsantrag über das Formular — ${UEBER_TEXT.name_email}.`
        : `Kündigungsantrag über das Formular — ${UEBER_TEXT.name_email_abweichend}: angegeben ${angegeben}, bei uns ${ident.hinterlegt ? geburtsdatumAnzeige(ident.hinterlegt) : "—"}.`;
      const pruefen = "Identifiziert nur über Name und E-Mail: Identität bitte prüfen, z. B. per Rückruf oder Ausweis. Erst danach die Kündigung buchen.";
      await sqlPool`
        INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
        VALUES (${appRef}, NULL, 'System', 'system', ${`${satz} ${pruefen}`})
      `.catch((e) => logger.error("[CANCELLATION] Verlaufseintrag:", e));
      try {
        const [pz] = (await sqlPool`SELECT person_id FROM fiaon_applications WHERE ref = ${appRef} LIMIT 1`) as any[];
        const { auftragFuerKunden } = await import("./fiaon-betreiber-todo");
        await auftragFuerKunden({
          personId: pz?.person_id != null ? Number(pz.person_id) : null,
          ref: appRef,
          titel: "Kündigung – Identität prüfen",
          text: `${satz}\n${pruefen}\nName laut Formular: ${String(firstName)} ${String(lastName)} · E-Mail: ${String(email)} · Antrag Nr. ${row.id}.`,
          schluessel: `kuendigung-identitaet:${row.id}`,
          bereich: "pruefen",
          quelle: "kuendigungsseite",
          autorName: "System",
          anlageText: "Angelegt von der Kündigungsseite (§ 312k BGB): Kündigung ohne passendes Geburtsdatum angenommen.",
        });
      } catch (e) {
        logger.error("[CANCELLATION] Aufgabe „Identität prüfen“ nicht angelegt:", e);
      }
    }

    logger.info(`[CANCELLATION] New request #${row.id} for ref=${appRef}${ueber !== "geburtsdatum" ? ` (${ueber}, Team prüft)` : ""}`);

    // ── Querprüfung 08.10.2026 (§ 312k Abs. 4 BGB): DIE EINGANGSBESTÄTIGUNG — SOFORT, IN TEXTFORM ──
    // Vorher ging die einzige Mail erst mit der Buchung raus — bei offener Identität erst nach der Prüfung.
    // Jetzt nach JEDEM angenommenen Antrag, auch wenn das Team die Identität noch prüft. Scheitert der Versand,
    // bleibt der Antrag trotzdem angenommen (Eingang zählt); die Seite zeigt Eingang und Antragsnummer.
    const eingangAm = new Date();
    const eingang = await eingangBestaetigen({
      ref: appRef, antragId: Number(row.id), am: eingangAm, name: `${String(firstName).trim()} ${String(lastName).trim()}`,
      wunsch: cancellationDate ?? null, grund: reason ?? null, packName: treffer.pack_name ?? null, email: String(email),
    }).catch((e) => { logger.error("[CANCELLATION] Eingangsbestätigung:", e); return { gesendet: false, inhalt: null as Record<string, string> | null }; });

    return res.json({
      ok: true, id: row.id, ref: row.ref, status: row.status,
      eingangAm: eingangAm.toISOString(), eingangText: eingang.inhalt?.eingang_text ?? null, bestaetigungGesendet: eingang.gesendet,
    });
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
    // Querprüfung 08.10.2026: ob die Identität eines offenen Antrags noch zu prüfen ist (dieselbe Regel wie beim Buchen).
    const offen = sqlPool.unsafe(`(c.status = 'pending' AND ${KUENDIGUNG_IDENTITAET_OFFEN_SQL("c")})`);
    const rows = status === "all"
      ? await sqlPool`SELECT c.*, ${offen} AS identitaet_offen FROM cancellation_requests c ORDER BY c.created_at DESC`
      : await sqlPool`SELECT c.*, ${offen} AS identitaet_offen FROM cancellation_requests c WHERE c.status = ${status} ORDER BY c.created_at DESC`;

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
    const { status, adminNote, processedBy, identitaetVermerk } = req.body;

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
        // Querprüfung 08.10.2026 (Strang b × g): Auch die Leitung bucht einen Antrag mit offener Identität nur mit Vermerk.
        vorgang = await antragBuchen(offen, {
          grund: String(adminNote ?? offen.grund ?? "Kündigungsantrag bestätigt").slice(0, 300),
          personId: offen.personId, alsLeitung: true, identitaetVermerk: identitaetVermerk ?? null,
          unterzeichner: { name: String(processedBy ?? "FIAON LTD"), rolle: "Geschäftsführung" },
        }).catch((e: any) => ({ ok: false, error: String(e?.message || e) }));
        if (!vorgang?.ok) return res.status(409).json({ ok: false, error: `Nicht gebucht: ${vorgang?.grund || vorgang?.error || "unbekannt"}`, vertrag: vorgang, identitaet: !!vorgang?.identitaet });
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
