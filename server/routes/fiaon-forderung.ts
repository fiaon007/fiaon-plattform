// ═══════════════════════════════════════════════════════════════════════════
// FORDERUNGSMANAGEMENT: DER KNOPF DES BETREIBERS UND DIE ÜBERGABE-LISTE
//
// ── ZWEI AUFTRÄGE VOM 21.08.2026 ──────────────────────────────────────────
//
//   „Zusätzlich meine Markierung als Admin: Ein Knopf ‚Sofort ins
//    Forderungsmanagement' unabhängig vom Datum."
//
//   „Zählt ein Kunde drei Anrufversuche ohne Erreichen, erscheint er im Admin
//    unter ‚Bereit zur Übergabe an externes Inkasso' mit fertigem Datensatz.
//    Nichts wird automatisch übergeben — ich entscheide."
//
// ── WAS HIER AUSDRÜCKLICH NICHT PASSIERT ─────────────────────────────────
// Es wird nichts übergeben, nichts verschickt, kein Vertrag beendet. Die Liste
// ist eine MELDUNG. Der Datensatz wird zusammengestellt, damit der Betreiber
// entscheiden kann — nicht damit ein Lauf es für ihn tut.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { zustaendigeRolleSql } from "../lib/fiaon-zustaendigkeit";

const router = Router();

/**
 * Wie viele erfolglose Anrufe machen einen Fall reif für die Meldung?
 *
 * Drei. Der Auftrag nennt die Zahl, und sie passt zum Bestand: `unreachable_count`
 * wird von `fiaon-nicht-erreicht.ts` genau bei „nicht erreicht" erhöht und bei
 * jedem Erreichen auf 0 zurückgesetzt. Drei heißt also DREI IN FOLGE, nicht
 * drei irgendwann.
 */
export const UEBERGABE_AB_VERSUCHEN = 3;

// ═══════════════════════════════════════════════════════════════════════════
// WER IST BEREIT ZUR ÜBERGABE?
//
// Drei Bedingungen, alle drei nötig:
//   1. Zuständigkeit ist Forderungsmanagement (also: im Rückstand)
//   2. Mindestens drei erfolglose Anrufe in Folge
//   3. Der Betreiber hat den Fall noch nicht angesehen
//
// Ohne (1) wäre es eine Liste unerreichbarer Interessenten; ohne (3) käme jeder
// Fall jeden Tag wieder, und dann liest sie niemand mehr.
// ═══════════════════════════════════════════════════════════════════════════
function uebergabeBedingung(): string {
  return `(
    ${zustaendigeRolleSql("p")} = 'inkasso'
    AND COALESCE(p.unreachable_count, 0) >= ${UEBERGABE_AB_VERSUCHEN}
    AND p.uebergabe_geprueft_am IS NULL
    AND p.merged_into_person_id IS NULL
    AND p.ist_test_am IS NULL
  )`;
}

/**
 * Der vollständige Datensatz zu einem Übergabefall.
 *
 * Alles in EINER Abfrage: Person, Vertrag, offene Raten, Fälligkeiten,
 * Mahnhistorie, Anrufprotokoll, Zustimmungsnachweis. Der Auftrag nennt genau
 * diese sieben Dinge — sie stehen hier in dieser Reihenfolge, damit beim
 * nächsten Lesen auffällt, wenn eines fehlt.
 */
async function datensaetze(nurPerson?: number): Promise<any[]> {
  const zeilen = (await sqlPool.unsafe(`
    SELECT p.id AS person_id,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, 'Ohne Namen') AS name,
           p.primary_email AS email, p.primary_phone AS telefon,
           p.street, p.zip, p.city, p.country, p.birthdate,
           p.unreachable_count, p.uebergabe_bereit_am, p.inkasso_ab, p.inkasso_grund,
           ag.name AS betreuer,
           -- ── VERTRAG ──────────────────────────────────────────────────
           (SELECT json_agg(json_build_object(
              'ref', a.ref, 'paket', a.pack_name, 'betrag', a.amount_due,
              'verwendungszweck', a.payment_reference,
              'bezahlt_am', a.paid_at, 'zustand', a.payment_status,
              'agb', a.consent_agb, 'schufa', a.consent_schufa, 'vertrag', a.consent_contract,
              -- ── DER NACHWEIS STEHT NICHT AN DER BESTELLUNG ────────────
              -- Die Spalten „consent_at“ und „consent_ip“ gibt es nicht. Die
              -- Bestellung traegt nur die drei Haken und „ip“/„user_agent“ des
              -- letzten Zugriffs. Zeitpunkt und Geraet der ZUSTIMMUNG stehen im
              -- Verlauf, den fiaon-zustimmung.ts beim Erteilen schreibt — dort
              -- ist es ein Satz mit Datum, und der ist auch fuer ein externes
              -- Inkasso der brauchbarere Nachweis als eine Spalte.
              -- (Backticks in SQL-Kommentaren beenden das Template-Literal —
              --  AGENTS.md, und mir heute selbst passiert.)
              'ip', a.ip, 'geraet', LEFT(COALESCE(a.user_agent, ''), 120),
              'zustimmung_belegt', (
                SELECT MIN(cz.created_at) FROM fiaon_contact_log cz
                WHERE cz.ref = a.ref AND cz.voided_at IS NULL
                  AND cz.note ILIKE '%Zustimmung vom Kunden erteilt%'))
              ORDER BY a.created_at)
            FROM fiaon_applications a
            WHERE a.person_id = p.id AND a.merged_into IS NULL
              AND a.archived_at IS NULL AND a.payment_status = 'paid') AS vertraege,
           -- ── OFFENE RATEN MIT FÄLLIGKEIT UND MAHNSTUFE ────────────────
           (SELECT json_agg(json_build_object(
              'rate', r.rate_nr, 'betrag', r.betrag_cents / 100.0,
              'faellig_am', r.faellig_am, 'ueberfaellig_seit', r.ueberfaellig_seit,
              'mahnstufe', r.mahnstufe, 'erinnerungen', r.erinnerungen,
              'letzte_erinnerung', r.letzte_erinnerung_at,
              'mahnstufe_bestaetigt_am', r.mahnstufe_bestaetigt_am,
              'zahlungsreferenz', r.zahlungsreferenz)
              ORDER BY r.faellig_am)
            FROM fiaon_abo_raten r
            JOIN fiaon_applications ar ON ar.ref = r.ref
            WHERE ar.person_id = p.id AND ar.merged_into IS NULL
              AND r.status <> 'bezahlt' AND r.storniert_am IS NULL) AS offene_raten,
           -- ── ANRUFPROTOKOLL ───────────────────────────────────────────
           (SELECT json_agg(json_build_object(
              'am', cl.created_at, 'ergebnis', cl.outcome,
              'mitarbeiter', cl.agent_name, 'notiz', LEFT(COALESCE(cl.note, ''), 200))
              ORDER BY cl.created_at DESC)
            FROM fiaon_contact_log cl
            WHERE cl.person_id = p.id AND cl.voided_at IS NULL
              AND cl.outcome IS NOT NULL
              AND cl.created_at > NOW() - INTERVAL '180 days') AS anrufe,
           (SELECT COUNT(*)::int FROM fiaon_abo_raten r
             JOIN fiaon_applications ar ON ar.ref = r.ref
             WHERE ar.person_id = p.id AND ar.merged_into IS NULL
               AND r.status <> 'bezahlt') AS anzahl_offen,
           (SELECT COALESCE(SUM(r.betrag_cents), 0)::bigint / 100.0 FROM fiaon_abo_raten r
             JOIN fiaon_applications ar ON ar.ref = r.ref
             WHERE ar.person_id = p.id AND ar.merged_into IS NULL
               AND r.status <> 'bezahlt') AS summe_offen
    FROM fiaon_persons p
    LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
    WHERE ${nurPerson ? "p.id = $1" : uebergabeBedingung()}
    ORDER BY p.unreachable_count DESC, p.id
    LIMIT 500
  `, nurPerson ? [nurPerson] : [])) as any[];
  return zeilen;
}

/**
 * Markiert alle Fälle, die die Bedingung erfüllen, mit `uebergabe_bereit_am`.
 *
 * Warum ein Merker und keine reine Abfrage: Ohne ihn ist nicht sichtbar, wie
 * lange ein Fall schon wartet — und genau das ist die Zahl, die den Betreiber
 * zum Handeln bringt. Idempotent: Wer die Marke hat, behält ihren Zeitpunkt.
 */
export async function uebergabeBereitschaftPruefen(): Promise<{ neu: number; offen: number }> {
  const neu = (await sqlPool.unsafe(`
    UPDATE fiaon_persons p
    SET uebergabe_bereit_am = NOW(), updated_at = NOW()
    WHERE ${uebergabeBedingung()} AND p.uebergabe_bereit_am IS NULL
    RETURNING p.id
  `)) as any[];
  for (const r of neu) {
    // ── `ref` IST PFLICHT IN fiaon_contact_log ─────────────────────────
    // Der erste Entwurf schrieb den Eintrag ohne Bestellung. Ergebnis: 25 Mal
    // „null value in column ref violates not-null constraint" — sichtbar nur,
    // weil das `.catch` den Fehler NENNT. Mit dem stummen `.catch(() => {})`
    // von vorgestern hätte die Liste funktioniert und keine Akte etwas gewusst.
    //
    // Genommen wird die Bestellung mit der offenen Rate: Sie ist der Grund für
    // die Vormerkung, und dort sucht ein Mensch danach.
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
      SELECT ar.ref, ${Number(r.id)}, NULL, 'System', 'system',
             ${`Nach ${UEBERGABE_AB_VERSUCHEN} erfolglosen Anrufen bei offener Rate zur `
               + "Prüfung \u201eÜbergabe an externes Inkasso\u201c vorgemerkt. Es wurde "
               + "NICHTS übergeben — die Entscheidung liegt beim Betreiber."}
      FROM fiaon_applications ar
      WHERE ar.person_id = ${Number(r.id)} AND ar.merged_into IS NULL
        AND EXISTS (SELECT 1 FROM fiaon_abo_raten r2
          WHERE r2.ref = ar.ref AND r2.status <> 'bezahlt' AND r2.storniert_am IS NULL)
      ORDER BY ar.created_at DESC LIMIT 1
    `.catch((e) => console.error(`[FORDERUNG] Akteneintrag zur Übergabe-Vormerkung `
      + `(Person ${r.id}) nicht geschrieben:`, e));
  }
  const [offen] = (await sqlPool.unsafe(`
    SELECT COUNT(*)::int AS n FROM fiaon_persons p WHERE ${uebergabeBedingung()}
  `)) as any[];
  if (neu.length > 0) {
    console.log(`[FORDERUNG] ${neu.length} neue Fälle zur Übergabe vorgemerkt, ${offen.n} offen.`);
  }
  return { neu: neu.length, offen: Number(offen.n) };
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /admin/person/:id/inkasso — sofort ins Forderungsmanagement
// ═══════════════════════════════════════════════════════════════════════════
router.post("/admin/person/:id/inkasso", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const grund = String((req.body?.grund ?? "")).trim();
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: "Keine gültige Person." });
    }
    // Ein Grund ist Pflicht. Eine Zuständigkeit, die ohne Begründung wechselt,
    // ist beim nächsten Lesen nicht mehr erklärbar — und der Kunde bekommt
    // Post aus einer Abteilung, von der niemand weiss, warum.
    if (grund.length < 5) {
      return res.status(400).json({
        ok: false,
        error: "Bitte einen Grund angeben (mindestens fünf Zeichen). Er steht in der Akte.",
      });
    }
    const [p] = (await sqlPool`
      UPDATE fiaon_persons
      SET inkasso_ab = NOW(), inkasso_von = ${String(req.body?.von ?? "Betreiber")},
          inkasso_grund = ${grund}, updated_at = NOW()
      WHERE id = ${id} AND merged_into_person_id IS NULL
      RETURNING id,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), ''),
                 company_name, 'Ohne Namen') AS name
    `) as any[];
    if (!p) return res.status(404).json({ ok: false, error: "Diese Person gibt es nicht." });

    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
      SELECT ar.ref, ${id}, NULL, ${String(req.body?.von ?? "Betreiber")}, 'system',
             ${`Von Hand ins Forderungsmanagement gestellt (unabhängig vom `
               + `Fälligkeitsdatum). Grund: ${grund}`}
      FROM fiaon_applications ar
      WHERE ar.person_id = ${id} AND ar.merged_into IS NULL
      ORDER BY ar.created_at DESC LIMIT 1
    `.catch((e) => console.error(`[FORDERUNG] Akteneintrag zur Handmarkierung `
      + `(Person ${id}) nicht geschrieben — der Wechsel ist dann nicht erklärbar:`, e));

    // Die Ableitung liest `inkasso_ab` — der Wechsel ist damit sofort wirksam.
    const { zustaendigeRolle } = await import("../lib/fiaon-zustaendigkeit");
    const z = await zustaendigeRolle(id);
    res.json({
      ok: true, name: String(p.name),
      zustaendig: z?.rolle ?? null,
      hinweis: "Der Kunde steht ab jetzt in der Arbeitsliste des Forderungsmanagements.",
    });
  } catch (err) {
    console.error("[FORDERUNG] inkasso setzen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler." });
  }
});

/** Die Markierung zurücknehmen — ohne Hard-Delete, mit Spur in der Akte. */
router.delete("/admin/person/:id/inkasso", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [p] = (await sqlPool`
      UPDATE fiaon_persons
      SET inkasso_ab = NULL, inkasso_grund = NULL, updated_at = NOW()
      WHERE id = ${id} AND inkasso_ab IS NOT NULL
      RETURNING id
    `) as any[];
    if (!p) return res.status(404).json({ ok: false, error: "Diese Person war nicht markiert." });
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
      SELECT ar.ref, ${id}, NULL, 'Betreiber', 'system',
             'Handmarkierung \u201eForderungsmanagement\u201c zurueckgenommen. Ab jetzt gilt wieder das Faelligkeitsdatum.'
      FROM fiaon_applications ar
      WHERE ar.person_id = ${id} AND ar.merged_into IS NULL
      ORDER BY ar.created_at DESC LIMIT 1
    `.catch((e) => console.error("[FORDERUNG] Akteneintrag zur Rücknahme:", e));
    res.json({ ok: true });
  } catch (err) {
    console.error("[FORDERUNG] inkasso loeschen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /admin/uebergabe-bereit — die Liste
// ═══════════════════════════════════════════════════════════════════════════
router.get("/admin/uebergabe-bereit", async (_req: Request, res: Response) => {
  try {
    await uebergabeBereitschaftPruefen();
    const zeilen = await datensaetze();
    res.json({
      ok: true,
      abVersuchen: UEBERGABE_AB_VERSUCHEN,
      // Ausdrücklich in der Antwort: Die Oberfläche soll den Satz nicht selbst
      // erfinden, und niemand soll glauben, hier passiere schon etwas.
      hinweis: "Nichts wurde übergeben. Diese Liste ist eine Meldung — die Entscheidung liegt bei dir.",
      faelle: zeilen.map((r) => ({
        personId: Number(r.person_id),
        name: String(r.name),
        email: r.email ?? null,
        telefon: r.telefon ?? null,
        adresse: [r.street, [r.zip, r.city].filter(Boolean).join(" "), r.country]
          .filter(Boolean).join(", ") || null,
        geburtsdatum: r.birthdate ?? null,
        betreuer: r.betreuer ?? null,
        erfolgloseAnrufe: Number(r.unreachable_count ?? 0),
        bereitSeit: r.uebergabe_bereit_am ? new Date(r.uebergabe_bereit_am).toISOString() : null,
        vonHandMarkiert: r.inkasso_ab ? new Date(r.inkasso_ab).toISOString() : null,
        handGrund: r.inkasso_grund ?? null,
        anzahlOffen: Number(r.anzahl_offen ?? 0),
        summeOffen: Number(r.summe_offen ?? 0),
        vertraege: r.vertraege ?? [],
        offeneRaten: r.offene_raten ?? [],
        anrufe: r.anrufe ?? [],
      })),
    });
  } catch (err) {
    console.error("[FORDERUNG] uebergabe-bereit:", err);
    res.status(500).json({ ok: false, error: "Serverfehler beim Laden der Liste." });
  }
});

/** Als geprüft abhaken — der Fall verschwindet aus der Liste, nicht aus der Welt. */
router.post("/admin/uebergabe-bereit/:id/geprueft", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [p] = (await sqlPool`
      UPDATE fiaon_persons
      SET uebergabe_geprueft_am = NOW(),
          uebergabe_geprueft_von = ${String(req.body?.von ?? "Betreiber")}, updated_at = NOW()
      WHERE id = ${id} RETURNING id
    `) as any[];
    if (!p) return res.status(404).json({ ok: false, error: "Diese Person gibt es nicht." });
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
      SELECT ar.ref, ${id}, NULL, ${String(req.body?.von ?? "Betreiber")}, 'system',
             ${`Übergabe-Vormerkung geprüft${req.body?.notiz ? `: ${String(req.body.notiz).slice(0, 400)}` : "."}`}
      FROM fiaon_applications ar
      WHERE ar.person_id = ${id} AND ar.merged_into IS NULL
      ORDER BY ar.created_at DESC LIMIT 1
    `.catch((e) => console.error("[FORDERUNG] Akteneintrag zur Prüfung:", e));
    res.json({ ok: true });
  } catch (err) {
    console.error("[FORDERUNG] geprueft:", err);
    res.status(500).json({ ok: false, error: "Serverfehler." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /admin/uebergabe-bereit.csv — der Export
//
// Semikolon und BOM: Excel in deutscher Einstellung liest sonst alles in eine
// Spalte, und die Umlaute werden zu Fragezeichen.
// ═══════════════════════════════════════════════════════════════════════════
function csvFeld(w: unknown): string {
  const s = w == null ? "" : String(w);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

router.get("/admin/uebergabe-bereit.csv", async (_req: Request, res: Response) => {
  try {
    const zeilen = await datensaetze();
    const kopf = ["person_id", "name", "email", "telefon", "adresse", "geburtsdatum",
      "betreuer", "erfolglose_anrufe", "bereit_seit", "anzahl_offene_raten",
      "summe_offen_eur", "paket", "verwendungszweck", "bezahlt_am",
      "faelligkeiten", "hoechste_mahnstufe", "erinnerungen",
      "zustimmung_agb", "zustimmung_schufa", "zustimmung_vertrag", "zustimmung_belegt_am",
      "geraet",
      "letzte_anrufe"];
    const daten = zeilen.map((r) => {
      const v = (r.vertraege ?? [])[0] ?? {};
      const raten = r.offene_raten ?? [];
      return [
        r.person_id, r.name, r.email ?? "", r.telefon ?? "",
        [r.street, [r.zip, r.city].filter(Boolean).join(" "), r.country].filter(Boolean).join(", "),
        r.birthdate ? new Date(r.birthdate).toLocaleDateString("de-DE") : "",
        r.betreuer ?? "", r.unreachable_count ?? 0,
        r.uebergabe_bereit_am ? new Date(r.uebergabe_bereit_am).toLocaleDateString("de-DE") : "",
        r.anzahl_offen ?? 0, Number(r.summe_offen ?? 0).toFixed(2),
        v.paket ?? "", v.verwendungszweck ?? "",
        v.bezahlt_am ? new Date(v.bezahlt_am).toLocaleDateString("de-DE") : "",
        raten.map((x: any) => `Rate ${x.rate}: ${Number(x.betrag).toFixed(2)} € fällig `
          + `${new Date(x.faellig_am).toLocaleDateString("de-DE")}`).join(" | "),
        raten.reduce((m: number, x: any) => Math.max(m, Number(x.mahnstufe ?? 0)), 0),
        raten.reduce((m: number, x: any) => m + Number(x.erinnerungen ?? 0), 0),
        v.agb ? "ja" : "nein", v.schufa ? "ja" : "nein", v.vertrag ? "ja" : "nein",
        v.zustimmung_belegt ? new Date(v.zustimmung_belegt).toLocaleString("de-DE") : "",
        v.geraet ?? "",
        (r.anrufe ?? []).slice(0, 5).map((a: any) =>
          `${new Date(a.am).toLocaleDateString("de-DE")} ${a.ergebnis}`).join(" | "),
      ];
    });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition",
      `attachment; filename="uebergabe-bereit-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send("\uFEFF" + [kopf, ...daten].map((z) => z.map(csvFeld).join(";")).join("\n"));
  } catch (err) {
    console.error("[FORDERUNG] csv:", err);
    res.status(500).json({ ok: false, error: "Serverfehler beim Export." });
  }
});

export default router;
