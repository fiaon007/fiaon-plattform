// ═══════════════════════════════════════════════════════════════════════════
// ABRECHNUNGS-ZENTRALE — EINSEHEN, BEREITHALTEN, SENDEN
//
// ── DIE MELDUNG (19.08.2026) ───────────────────────────────────────────────
// „Keine zentrale Einsicht." Zehn Provisionsabrechnungen lagen in
// `fiaon_commission_statements`, das PDF als base64 in der Zeile — und es gab
// keinen Ort, an dem der Betreiber sie sehen, prüfen oder verschicken konnte.
// Der einzige Weg führte über das Portal des Mitarbeiters.
//
// Das ist dieselbe Klasse wie „Alle prüfen" auf /admin/events (AGENTS.md): Der
// Server konnte es längst, es gab nur keinen Knopf. Und wie dort steht die
// Abnahme im Browser — Knopf finden, drücken, Ergebnis am gerenderten Text
// messen.
//
// ── WAS EIN AUSGEZAHLTER BELEG IST ────────────────────────────────────────
// Sobald die Auszahlung den Status „ausgezahlt" trägt, ist die Abrechnung ein
// Buchungsbeleg. Sie wird dann NICHT mehr neu erzeugt — auch nicht, wenn das
// neue Layout schöner wäre. Ein Beleg, der sich nachträglich ändert, ist kein
// Beleg. Hausregel: keine Hard-Deletes, keine Beleg-Änderung.
//
// Senden bleibt immer erlaubt: Menschen verlieren Mails. Jede Sendung wird
// gezählt und datiert, die zweite ausdrücklich als Wiederholung ausgewiesen.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { sendMakeWebhookMitGrund } from "../make-webhook";
import { absoluteUrl } from "../fiaon-base-url";
import { echteMitarbeiterSql } from "../lib/fiaon-mitarbeiter-sicht";

const router = Router();

/** Wer hat gehandelt — für Protokoll und Vermerke. */
function wer(req: Request): string {
  return String((req as any).adminName || "Verwaltung");
}

/** Ein Datensatz für die Liste — dieselbe Form für Zentrale, Profil und Portal. */
const LISTE_SQL = `
  SELECT s.id, s.statement_no, s.agent_id, s.payout_id,
         s.period_start, s.period_end, s.issued_at,
         s.gross_cents, s.net_cents, s.doc_hash,
         (s.pdf_base64 IS NOT NULL) AS hat_pdf,
         s.gesendet_am, s.gesendet_an, s.sende_anzahl, s.gesendet_von,
         s.neu_erzeugt_am, s.neu_erzeugt_anzahl,
         ag.name AS mitarbeiter, ag.rolle, ag.email AS mitarbeiter_email,
         p.status AS auszahlung_status, p.processed_at AS auszahlung_am,
         p.amount_cents AS auszahlung_cents, p.iban_masked,
         (SELECT COUNT(*)::int FROM fiaon_commissions c WHERE c.payout_id = s.payout_id) AS positionen
    FROM fiaon_commission_statements s
    LEFT JOIN fiaon_agents ag ON ag.id = s.agent_id
    LEFT JOIN fiaon_payouts p ON p.id = s.payout_id
`;

/**
 * Der Zustand einer Abrechnung in EINEM Wort — für Filter und Anzeige.
 *
 * Er wird ABGELEITET und nicht gespeichert: Gespeichert wäre er beim ersten
 * Statuswechsel der Auszahlung falsch, und niemand würde es merken.
 *
 *   erzeugt    Das Dokument liegt vor, ging aber noch nicht an den Menschen.
 *   gesendet   Der Mitarbeiter hat es bekommen.
 *   ausgezahlt Das Geld ist raus — ab hier ist es ein Beleg.
 */
export function abrechnungZustand(z: {
  auszahlung_status?: string | null; gesendet_am?: unknown;
}): "erzeugt" | "gesendet" | "ausgezahlt" {
  if (String(z.auszahlung_status ?? "") === "ausgezahlt") return "ausgezahlt";
  return z.gesendet_am ? "gesendet" : "erzeugt";
}

function zeile(r: any) {
  return {
    id: Number(r.id),
    nummer: String(r.statement_no),
    agentId: Number(r.agent_id),
    mitarbeiter: r.mitarbeiter ?? "(unbekannt)",
    rolle: r.rolle ?? null,
    email: r.mitarbeiter_email ?? null,
    auszahlungId: r.payout_id != null ? Number(r.payout_id) : null,
    zeitraumVon: r.period_start ?? null,
    zeitraumBis: r.period_end ?? null,
    erzeugtAm: r.issued_at,
    bruttoCents: Number(r.gross_cents ?? 0),
    betragCents: Number(r.net_cents ?? 0),
    positionen: Number(r.positionen ?? 0),
    hatPdf: r.hat_pdf === true,
    zustand: abrechnungZustand(r),
    auszahlungStatus: r.auszahlung_status ?? null,
    auszahlungAm: r.auszahlung_am ?? null,
    ibanMaskiert: r.iban_masked ?? null,
    gesendetAm: r.gesendet_am ?? null,
    gesendetAn: r.gesendet_an ?? null,
    gesendetVon: r.gesendet_von ?? null,
    sendeAnzahl: Number(r.sende_anzahl ?? 0),
    neuErzeugtAm: r.neu_erzeugt_am ?? null,
    neuErzeugtAnzahl: Number(r.neu_erzeugt_anzahl ?? 0),
    pruefsumme: r.doc_hash ? String(r.doc_hash).slice(0, 16) : null,
    // Ob „Neu erzeugen" erlaubt ist, entscheidet der SERVER und sagt es der
    // Oberfläche im Klartext. Eine Sperre, die die Anzeige selbst ableitet,
    // gibt irgendwann frei, was der Server ablehnt.
    // Fehlt das PDF, ist „Neu erzeugen" IMMER erlaubt — auch bei „ausgezahlt".
    // Vorher war genau dieser Fall gesperrt, und ein ausgezahlter Beleg ohne
    // Dokument liess sich nicht herstellen.
    darfNeuErzeugen: r.hat_pdf !== true || String(r.auszahlung_status ?? "") !== "ausgezahlt",
    neuErzeugenGrund: r.hat_pdf === true && String(r.auszahlung_status ?? "") === "ausgezahlt"
      ? "Die Auszahlung ist erfolgt und ein Beleg liegt vor — er wird nicht "
        + "überschrieben."
      : (r.hat_pdf !== true && String(r.auszahlung_status ?? "") === "ausgezahlt"
        ? "Der Beleg fehlt und wird nachträglich hergestellt — er zeigt den Stand "
          + "der Auszahlung von damals."
        : null),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /admin/abrechnungen — die Liste, mit Filtern
// ═══════════════════════════════════════════════════════════════════════════
router.get("/admin/abrechnungen", async (req: Request, res: Response) => {
  try {
    const agent = Number(req.query.agent);
    const zustand = String(req.query.zustand ?? "alle");
    const von = String(req.query.von ?? "").trim();
    const bis = String(req.query.bis ?? "").trim();
    const q = String(req.query.q ?? "").trim();

    const wo: string[] = [];
    if (Number.isFinite(agent) && agent > 0) wo.push(`s.agent_id = ${agent}`);
    // Datumsgrenzen als Zeitraum der Abrechnung, nicht als Erzeugungsdatum:
    // Gesucht wird „welche Abrechnung betrifft den August", nicht „welche wurde
    // im August gedruckt".
    if (/^\d{4}-\d{2}-\d{2}$/.test(von)) wo.push(`COALESCE(s.period_end, s.issued_at) >= '${von}'::date`);
    if (/^\d{4}-\d{2}-\d{2}$/.test(bis)) wo.push(`COALESCE(s.period_start, s.issued_at) < ('${bis}'::date + 1)`);
    if (q) {
      const sauber = q.replace(/'/g, "''");
      wo.push(`(s.statement_no ILIKE '%${sauber}%' OR ag.name ILIKE '%${sauber}%')`);
    }
    if (zustand === "ausgezahlt") wo.push(`p.status = 'ausgezahlt'`);
    else if (zustand === "gesendet") wo.push(`s.gesendet_am IS NOT NULL AND COALESCE(p.status,'') <> 'ausgezahlt'`);
    else if (zustand === "erzeugt") wo.push(`s.gesendet_am IS NULL AND COALESCE(p.status,'') <> 'ausgezahlt'`);

    const rows = (await sqlPool.unsafe(
      `${LISTE_SQL} ${wo.length ? `WHERE ${wo.join(" AND ")}` : ""} ORDER BY s.issued_at DESC LIMIT 500`,
    )) as any[];

    // Die Mitarbeiterliste für den Filter — über die eine Grenze
    // (`echteMitarbeiterSql`), damit keine Prüfstands-Konten auftauchen.
    const mitarbeiter = (await sqlPool.unsafe(`
      SELECT ag.id, ag.name, ag.rolle,
             (SELECT COUNT(*)::int FROM fiaon_commission_statements s WHERE s.agent_id = ag.id) AS anzahl
        FROM fiaon_agents ag
       WHERE ${echteMitarbeiterSql("ag")}
       ORDER BY ag.name
    `)) as any[];

    const alle = rows.map(zeile);
    res.json({
      ok: true,
      abrechnungen: alle,
      mitarbeiter: mitarbeiter.map((m) => ({
        id: Number(m.id), name: m.name, rolle: m.rolle, anzahl: Number(m.anzahl),
      })),
      zahlen: {
        alle: alle.length,
        erzeugt: alle.filter((a) => a.zustand === "erzeugt").length,
        gesendet: alle.filter((a) => a.zustand === "gesendet").length,
        ausgezahlt: alle.filter((a) => a.zustand === "ausgezahlt").length,
        summeCents: alle.reduce((s, a) => s + a.betragCents, 0),
        ohnePdf: alle.filter((a) => !a.hatPdf).length,
      },
    });
  } catch (err) {
    console.error("[ABRECHNUNGEN] Liste:", err);
    res.status(500).json({ ok: false, error: "Die Liste konnte nicht geladen werden." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /admin/abrechnungen/:id.pdf — ansehen (inline) oder herunterladen
// ═══════════════════════════════════════════════════════════════════════════
router.get("/admin/abrechnungen/:id.pdf", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [r] = (await sqlPool`
      SELECT pdf_base64, statement_no FROM fiaon_commission_statements WHERE id = ${id}
    `) as any[];
    if (!r) return res.status(404).json({ ok: false, error: "Abrechnung nicht gefunden." });
    if (!r.pdf_base64) {
      // Kein stilles 404: Der Unterschied zwischen „gibt es nicht" und „das PDF
      // fehlt" entscheidet, was der Betreiber als Nächstes tut.
      return res.status(409).json({
        ok: false, code: "PDF_FEHLT",
        // Der alte Hinweis sagte „solange die Auszahlung nicht abgeschlossen
        // ist" — und war damit genau in dem Fall falsch, in dem er auftrat.
        error: `Zu ${r.statement_no} liegt kein PDF. Über „Neu erzeugen“ wird es `
          + "hergestellt — auch wenn die Auszahlung schon erfolgt ist, denn ein "
          + "fehlender Beleg ist schlimmer als ein nachträglich gedruckter.",
      });
    }
    const buf = Buffer.from(String(r.pdf_base64), "base64");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition",
      `${req.query.download === "1" ? "attachment" : "inline"}; filename="${r.statement_no}.pdf"`);
    res.send(buf);
  } catch (err) {
    console.error("[ABRECHNUNGEN] PDF:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /admin/abrechnungen/:id/senden — an den Mitarbeiter
// ═══════════════════════════════════════════════════════════════════════════
router.post("/admin/abrechnungen/:id/senden", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [r] = (await sqlPool`
      SELECT s.*, ag.email, ag.name, ag.first_name
        FROM fiaon_commission_statements s
        LEFT JOIN fiaon_agents ag ON ag.id = s.agent_id
       WHERE s.id = ${id}
    `) as any[];
    if (!r) return res.status(404).json({ ok: false, error: "Abrechnung nicht gefunden." });

    const email = String(r.email ?? "").trim();
    if (!email || !email.includes("@")) {
      return res.status(409).json({
        ok: false,
        error: `${r.name ?? "Der Mitarbeiter"} hat keine brauchbare E-Mail-Adresse. `
          + "Bitte in der Team-Zentrale nachtragen, dann erneut senden.",
      });
    }
    if (!r.pdf_base64) {
      return res.status(409).json({
        ok: false,
        error: `Zu ${r.statement_no} liegt kein PDF — es gäbe nichts zu senden.`,
      });
    }

    const wiederholung = Number(r.sende_anzahl ?? 0) > 0;
    // ── DER VERSAND WIRD ABGEWARTET ────────────────────────────────────────
    // Ein Aufruf mit `.catch(() => {})` und danach `ok: true` hat am 19.08.2026
    // schon einmal dazu geführt, dass die Oberfläche Erfolg meldete und beim
    // Kunden nichts ankam. Also: abwarten, Fehler übernehmen.
    // `sendMakeWebhookMitGrund` statt `sendMakeWebhook`: Letztere gibt nur
    // `true`/`false` zurück — dann stünde in der Meldung an den Betreiber
    // „hat nicht geklappt" ohne ein Wort dazu, und er könnte nichts tun.
    const versand = await sendMakeWebhookMitGrund("commission_statement_issued", {
      email,
      vorname: r.first_name || r.name || "",
      statement_no: r.statement_no,
      betrag: (Number(r.net_cents) / 100).toFixed(2),
      issued_at: new Date(r.issued_at).toISOString(),
      doc_hash: r.doc_hash,
      pdf_url: absoluteUrl(`/api/fiaon/agent/documents/statement/${r.id}.pdf`),
      erneut: wiederholung,
    });
    if (!versand?.ok) {
      const grund = String(versand.grund || "Der Mailversand hat nicht geantwortet.");
      console.error(`[ABRECHNUNGEN] Versand ${r.statement_no} fehlgeschlagen: ${grund}`);
      return res.status(502).json({
        ok: false,
        error: `${r.statement_no} konnte nicht gesendet werden: ${grund} `
          + "Die Abrechnung ist unverändert — bitte erneut versuchen.",
      });
    }

    const [neu] = (await sqlPool`
      UPDATE fiaon_commission_statements
         SET gesendet_am = NOW(), gesendet_an = ${email},
             sende_anzahl = COALESCE(sende_anzahl, 0) + 1,
             gesendet_von = ${String((req as any).adminName || "Verwaltung")}
       WHERE id = ${id}
       RETURNING gesendet_am, sende_anzahl
    `) as any[];

    res.json({
      ok: true,
      meldung: wiederholung
        ? `${r.statement_no} erneut an ${email} gesendet (${neu.sende_anzahl}. Sendung).`
        : `${r.statement_no} an ${email} gesendet.`,
      gesendetAm: neu.gesendet_am,
      sendeAnzahl: Number(neu.sende_anzahl),
    });
  } catch (err) {
    console.error("[ABRECHNUNGEN] senden:", err);
    res.status(500).json({ ok: false, error: "Serverfehler beim Senden." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /admin/abrechnungen/:id/neu-erzeugen — nur solange kein Beleg
// ═══════════════════════════════════════════════════════════════════════════
router.post("/admin/abrechnungen/:id/neu-erzeugen", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [r] = (await sqlPool`
      SELECT s.statement_no, (s.pdf_base64 IS NOT NULL) AS pdf_base64,
             p.status AS auszahlung_status
        FROM fiaon_commission_statements s
        LEFT JOIN fiaon_payouts p ON p.id = s.payout_id
       WHERE s.id = ${id}
    `) as any[];
    if (!r) return res.status(404).json({ ok: false, error: "Abrechnung nicht gefunden." });

    // ── DIE WAND STEHT IM SERVER — ABER AN DER RICHTIGEN STELLE ───────────
    // Sie schützt vor ÜBERSCHREIBEN, nicht vor ERSTELLEN. Fehlt das PDF, wird es
    // IMMER hergestellt — auch bei „ausgezahlt". Eine ausgezahlte Provision ohne
    // Beleg ist der schlimmere Zustand (Befund: FIAON-COM-2026-0011).
    if (String(r.auszahlung_status ?? "") === "ausgezahlt" && r.pdf_base64) {
      return res.status(409).json({
        ok: false, code: "BELEG_UNVERAENDERLICH",
        error: `${r.statement_no} gehört zu einer erfolgten Auszahlung und ein Beleg `
          + "liegt vor — er wird nicht überschrieben.",
      });
    }

    const { abrechnungNeuErzeugen } = await import("./fiaon-onboarding");
    const erg = await abrechnungNeuErzeugen(id, wer(req));
    if (!erg.ok) {
      // 409 bei einer Regel, 502 bei einem gescheiterten Druck — der Unterschied
      // entscheidet, was der Betreiber als Naechstes tut.
      const regel = /nicht überschrieben|nicht zulässig/.test(String(erg.grund ?? ""));
      return res.status(regel ? 409 : 502).json({
        ok: false,
        error: erg.grund || "Das PDF konnte nicht erzeugt werden.",
      });
    }
    res.json({
      ok: true,
      meldung: erg.ersterDruck
        ? `${r.statement_no}: Der Beleg wurde ERSTMALS erzeugt — vorher gab es keinen. `
          + "Er zeigt den Stand der Auszahlung von damals."
        : `${r.statement_no} wurde mit dem aktuellen Layout neu erzeugt. `
          + "Die vorherige Fassung ist archiviert.",
    });
  } catch (err) {
    console.error("[ABRECHNUNGEN] neu erzeugen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler beim Neuerzeugen." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /agent/abrechnungen — NUR die eigenen
//
// Die Grenze steht in der WHERE-Bedingung (`s.agent_id = req.agent.id`), nicht
// in der Anzeige. AGENTS.md: „Die Grenze steht in der WHERE-Bedingung, nicht in
// der Oberfläche: Sonst holt die Abfrage die Zeilen, die Anzeige wirft sie weg."
// `scripts/pruef-abrechnung-zentrale.ts` prüft mit einer Rot-Probe, dass eine
// fremde Abrechnung 404 liefert.
// ═══════════════════════════════════════════════════════════════════════════
router.get("/agent/abrechnungen", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const rows = (await sqlPool.unsafe(
      `${LISTE_SQL} WHERE s.agent_id = ${Number(req.agent!.id)} ORDER BY s.issued_at DESC LIMIT 200`,
    )) as any[];
    const alle = rows.map(zeile);
    res.json({
      ok: true,
      abrechnungen: alle.map((a) => ({
        // Der Mitarbeiter braucht die Verwaltungsfelder nicht — und soll nicht
        // sehen, wer den Versand ausgelöst hat.
        id: a.id, nummer: a.nummer, zeitraumVon: a.zeitraumVon, zeitraumBis: a.zeitraumBis,
        erzeugtAm: a.erzeugtAm, betragCents: a.betragCents, positionen: a.positionen,
        hatPdf: a.hatPdf, zustand: a.zustand, auszahlungAm: a.auszahlungAm,
        ibanMaskiert: a.ibanMaskiert, pruefsumme: a.pruefsumme,
      })),
      summeCents: alle.reduce((s, a) => s + a.betragCents, 0),
    });
  } catch (err) {
    console.error("[ABRECHNUNGEN] Mitarbeiter-Liste:", err);
    res.status(500).json({ ok: false, error: "Deine Abrechnungen konnten nicht geladen werden." });
  }
});

export default router;
