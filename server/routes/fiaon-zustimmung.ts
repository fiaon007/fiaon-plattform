// ═══════════════════════════════════════════════════════════════════════════
// DIE ZUSTIMMUNGSSEITE — ÖFFENTLICH, MIT SIGNIERTEM TOKEN
//
// Kein Login: Der Kunde steht noch im Antrag und hat oft gar keinen Zugang.
// Ohne den HMAC ist der Link wertlos, und er gilt 30 Tage.
//
// Die Regeln (was fehlt, was geschrieben werden darf, wer schreiben darf)
// stehen ALLE in `server/lib/fiaon-zustimmung.ts`. Hier steht nur, wer was darf
// — dieselbe Aufteilung wie bei `fiaon-termin.ts`.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "../lib/db-pool";
import { Router, type Request, type Response } from "express";
import {
  zustimmungTokenPruefen, zustimmungsLage, zustimmungFesthalten, ZUSTIMMUNG_TAGE,
} from "../lib/fiaon-zustimmung";

const router = Router();

/** Die Adresse des Anfragenden — hinter Render steht ein Proxy davor. */
function absenderIp(req: Request): string | null {
  const weiter = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return weiter || req.ip || null;
}

/** GET /zustimmung/:token — was fehlt noch? */
/**
 * ── NACH DER BESTÄTIGUNG GEHT ES VON SELBST WEITER (11.09.2026, E-184) ──
 * Team-Feedback 3: „Rechnung anschließend direkt per E-Mail versenden können."
 * Hat der Kunde eben bestätigt und wurde noch keine Rechnung gestellt
 * (Sendegrund erste_rechnung), stellt das Haus sie sofort und schickt die
 * Zahlungsdaten — im Namen des Betreuers, mit Vermerk in der Akte. Gibt es
 * keinen Betreuer, entsteht eine Aufgabe für die Leitung. Lief die Rechnung
 * schon (Sendegrund frei), passiert nichts weiter als der Vermerk, den
 * zustimmungFesthalten ohnehin schreibt.
 */
async function nachDerZustimmung(ref: string): Promise<void> {
  // Der Betreuer ist der der PERSON (seit dem Kundenpool die Wahrheit) — und
  // nur, wenn sein Konto aktiv und nicht gesperrt ist; sonst Aufgabe.
  const [a] = (await sqlPool`
    SELECT a.person_id, p.assigned_agent_id, ag.name AS agent_name,
           (ag.active AND ag.zugang_gesperrt_am IS NULL) AS agent_bereit
      FROM fiaon_applications a
      JOIN fiaon_persons p ON p.id = a.person_id
      LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
     WHERE a.ref = ${ref} AND a.merged_into IS NULL`) as any[];
  if (!a?.person_id) return;
  const personId = Number(a.person_id);
  const { sendeGrundSql } = await import("../lib/fiaon-massgebliche-bestellung");
  const [g] = (await sqlPool.unsafe(
    `SELECT ${sendeGrundSql("p")} AS grund FROM fiaon_persons p WHERE p.id = $1`, [personId],
  )) as any[];
  if (g?.grund !== "erste_rechnung") return;

  const vermerk = (note: string) => sqlPool`
    INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
    VALUES (${ref}, ${personId}, NULL, 'System', 'system', ${note}, NOW())
  `.catch((e) => console.error("[ZUSTIMMUNG] Vermerk:", e));

  if (a.assigned_agent_id && a.agent_bereit === true) {
    // OHNE ref: Bei Sendegrund erste_rechnung gibt es noch keine lebende
    // offene Bestellung — mit ref liefe zahlungsdatenSenden in bestellungPruefen
    // und antwortete 409. Ohne ref löst es die Bestellung selbst auf und stellt
    // die Rechnung (rechnungStellen, aufAnweisung).
    const { zahlungsdatenSenden } = await import("./fiaon-agent-kunden");
    const erg = await zahlungsdatenSenden(personId, Number(a.assigned_agent_id), String(a.agent_name ?? "Betreuer"), {});
    await vermerk(erg.ok
      ? `Zustimmung erteilt — Zahlungsdaten automatisch an ${erg.empfaenger ?? "den Kunden"} versandt.`
      : `Zustimmung erteilt — Zahlungsdaten konnten nicht automatisch versandt werden (${erg.error ?? "unbekannt"}). Bitte von Hand senden.`);
    return;
  }
  const { auftragFuerKunden } = await import("./fiaon-betreiber-todo");
  await auftragFuerKunden({
    personId, ref,
    titel: "Kunde hat zugestimmt — Zahlungsdaten senden",
    text: "Der Kunde hat AGB, Bonitätsprüfung und Vertrag bestätigt. Es gibt noch keine Rechnung und keinen aktiven Betreuer — bitte Zahlungsdaten senden und einen Betreuer zuordnen.",
    dringend: true, schluessel: `zustimmung:${ref}:rechnung`, quelle: "zustimmung", bereich: "konten", autorName: "System",
    anBetreiber: !a.assigned_agent_id,
  });
}

router.get("/zustimmung/:token", async (req: Request, res: Response) => {
  try {
    const geprueft = zustimmungTokenPruefen(req.params.token);
    if (!geprueft) {
      return res.status(400).json({ ok: false, error: "Dieser Link ist ungültig." });
    }
    if (geprueft.abgelaufen) {
      return res.status(410).json({
        ok: false,
        error: `Dieser Link ist abgelaufen — er gilt ${ZUSTIMMUNG_TAGE} Tage. `
          + "Melden Sie sich kurz bei uns, dann schicken wir Ihnen sofort einen neuen.",
      });
    }
    const lage = await zustimmungsLage(geprueft.ref);
    if (!lage) return res.status(404).json({ ok: false, error: "Wir finden diesen Vorgang nicht." });
    res.json({ ok: true, lage });
  } catch (err) {
    console.error("[ZUSTIMMUNG] lage:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /zustimmung/:token — die Erklärungen festhalten. */
router.post("/zustimmung/:token", async (req: Request, res: Response) => {
  try {
    const geprueft = zustimmungTokenPruefen(req.params.token);
    if (!geprueft) return res.status(400).json({ ok: false, error: "Dieser Link ist ungültig." });
    if (geprueft.abgelaufen) {
      return res.status(410).json({ ok: false, error: "Dieser Link ist abgelaufen." });
    }
    const lage = await zustimmungsLage(geprueft.ref);
    if (!lage) return res.status(404).json({ ok: false, error: "Wir finden diesen Vorgang nicht." });
    if (lage.fertig) return res.json({ ok: true, lage, meldung: "Es war schon alles bestätigt." });

    // ── ALLE ODER KEINE ──────────────────────────────────────────────────
    // Die Antragsstrecke verlangt es genauso („Bitte allen Bedingungen
    // zustimmen"). Ein Vertrag ohne Vertragsannahme wäre keiner.
    const gewaehlt: string[] = Array.isArray(req.body?.spalten)
      ? req.body.spalten.map((s: unknown) => String(s)) : [];
    const fehlt = lage.spalten.filter((s) => !gewaehlt.includes(s));
    if (fehlt.length > 0) {
      return res.status(400).json({
        ok: false,
        error: "Bitte allen Punkten zustimmen — sonst kommt der Vertrag nicht zustande.",
      });
    }

    const erg = await zustimmungFesthalten(geprueft.ref, lage.spalten, {
      ip: absenderIp(req),
      userAgent: req.headers["user-agent"] ? String(req.headers["user-agent"]) : null,
    });
    if (!erg.ok) return res.status(400).json({ ok: false, error: erg.grund });
    void nachDerZustimmung(geprueft.ref).catch((e) => console.error("[ZUSTIMMUNG] nach der Zustimmung:", e));

    res.json({
      ok: true,
      lage: await zustimmungsLage(geprueft.ref),
      meldung: "Danke — Ihre Bestätigung ist gespeichert.",
    });
  } catch (err) {
    console.error("[ZUSTIMMUNG] festhalten:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
