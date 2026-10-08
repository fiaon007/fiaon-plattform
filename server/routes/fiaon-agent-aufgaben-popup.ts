// ═══════════════════════════════════════════════════════════════════════════
// NEU VON MARA — DIE AUFGABEN, DIE DEN BETREUER SOFORT ERREICHEN
// (24.09.2026, E-240)
//
// ── DER BEFUND ─────────────────────────────────────────────────────────────
// Mara (Postfach und WhatsApp) legt Aufgaben beim Betreuer an — „Kunde hat
// geschrieben, bitte heute antworten", „WhatsApp: bitte übernehmen". Der
// Mitarbeiter erfuhr davon nur über die Mail „Neuer Auftrag für dich" (über
// Make, also nur, wenn der Zweig läuft und das Postfach offen ist) oder beim
// nächsten Blick in /agent/aufgaben. Gemessen am 24.09.2026 in Produktion:
// 392 von 404 offenen Aufträgen beim Team waren NIE geöffnet
// (agent_gelesen_am IS NULL), die ältesten vom 02.09. Für Termine gibt es
// seit dem 11.08. eine Erinnerung im Portal (TerminErinnerung.tsx) — für
// Aufgaben nichts.
//
// Justins Auftrag (24.09.2026): Sagt eine Kundin „ich habe keine Auskunft",
// verkauft Mara und informiert den Betreuer AKTIV — Mail UND Popup.
//
// ── WAS HIER STEHT ─────────────────────────────────────────────────────────
//   GET  /agent/aufgaben/neu           die neuesten ungelesenen eigenen
//                                      Aufgaben (höchstens fünf) + Gesamtzahl
//   POST /agent/aufgaben/:id/gesehen   „gesehen" — setzt agent_gelesen_am
//
// Die Karte dazu: client/src/components/AufgabenErinnerung.tsx.
//
// ── WARUM KEINE NEUE SPALTE, KEINE NEUE TABELLE ────────────────────────────
// „Ungelesen" gibt es schon: agent_gelesen_am (E-029) — gesetzt beim
// Annehmen, Fragen, Kommentieren, Erledigen und beim Aufklappen der
// Zeitleiste; zurückgesetzt, wenn die Aufgabe neu übergeben wird oder
// derselbe Kunde Mara erneut schreibt (auftragFuerKunden, 18.09.2026). Ein
// zweiter Merker („popup_gezeigt") wäre eine zweite Wahrheit, die mit der
// ersten auseinanderläuft: Wer die Aufgabe in /agent/aufgaben öffnet, soll
// sie im Popup nicht noch einmal sehen — und umgekehrt.
//
// ── „NEU SEIT" STATT „ANGELEGT AM" ─────────────────────────────────────────
// Schreibt ein Kunde Mara ein zweites Mal, hängt sich die Mail an die
// bestehende Aufgabe (derselbe Schlüssel) und agent_gelesen_am fällt auf
// NULL — die Aufgabe ist wieder NEU, obwohl sie vor Tagen angelegt wurde.
// Deshalb sortiert die Liste nach der letzten Bewegung (der jüngste von
// letzte_aktivitaet, delegiert_am, created_at), und nach demselben Zeitpunkt
// entscheidet die Karte, ob seit „Später" etwas dazugekommen ist.
//
// E-IT-F (08.10.2026), Nachtrag: Die Spalte neu_seit (Migration 102) ersetzt
// GREATEST(letzte_aktivitaet, delegiert_am, created_at). Sie bewegen nur echte
// Neuigkeiten — Anlage, eine weitere Kundennachricht, Justins Übergabe. Ein
// Übertrag in Masse, eine Systemzeile oder ein Versuchsvermerk bewegen sie nicht.
// Ungelesen heißt: neu_seit liegt nach agent_gelesen_am. Der Kunde kommt aus
// person_id — dieselbe Zuordnung wie in der Liste (keine zweite Rater-Fassung).
//
// ── BESITZSCHUTZ ───────────────────────────────────────────────────────────
// Beide Routen sehen NUR Aufgaben, die bei genau diesem Mitarbeiter liegen
// (zustaendig_art = 'agent' AND zustaendig_agent_id = seine Kennung). Eine
// fremde Kennung beim „gesehen" antwortet 404 — nicht 403, damit man durch
// Probieren nicht erfährt, welche Aufgaben es bei anderen gibt (dasselbe
// Muster wie meinAuftrag() in fiaon-betreiber-todo.ts). Die Nur-Ansicht des
// Vorgesetzten schreibt nie: nurLesenWand lehnt jeden POST ab, die Aufgabe
// bleibt für den Menschen selbst ungelesen.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { ensureTodoTabelle, refAusLink } from "./fiaon-betreiber-todo";
// E-IT-F (08.10.2026): Herkunft, Kunde und Person aus EINER Quelle — dieselbe wie die Liste.
import { auftragHerkunft, nameAusTitel } from "../../shared/fiaon-auftrag-arten";
import { auftraegeZuordnen } from "../lib/fiaon-auftraege";
import { nummerAusRaumPfad, raumPfad } from "../../shared/fiaon-wa-raum";

const router = Router();

/** Mehr als fünf liest niemand in einer Ecke — der Rest steht in /agent/aufgaben. */
const HOECHSTENS = 5;

/**
 * Woher die Aufgabe kommt — in Worten, die der Mitarbeiter kennt.
 *
 * `vonMara` entscheidet über die Aufschrift „von Mara". Die Karte holt sie
 * aus shared/fiaon-mara-marke.ts — dieselbe Aufschrift wie an Rückrufen im
 * Kalender; eine eigene hier wäre die zweite Fassung, vor der die Marke warnt.
 * `kanal` sagt, auf welchem Weg der Kunde Mara erreicht hat.
 *
 * Die Quellen stehen in fiaon_betreiber_todos.quelle (gemessen 24.09.2026):
 * postmeister (Mara aus dem Postfach), mara-whatsapp, antrag, abo, bonitaet,
 * global, website, hand, system. Unbekannte Quellen, die mit „mara" beginnen,
 * zählen als Mara — neue Mara-Werkzeuge (E-240) brauchen hier keinen Eintrag.
 */
export function quelleVon(quelle: unknown): { vonMara: boolean; kanal: string | null } {
  // E-IT-F: die Regel steht jetzt in shared/fiaon-auftrag-arten.ts (auftragHerkunft) — Liste und Popup gleich.
  return auftragHerkunft(quelle);
}

/**
 * Der jüngste Teil des Aufgabentexts. Eine zweite Mail desselben Kunden wird
 * mit einer Leerzeile an den Text GEHÄNGT (auftragFuerKunden) — das Neue
 * steht also am Ende, nicht am Anfang.
 */
export function auszugVon(text: unknown, max = 180): string | null {
  const absaetze = String(text ?? "").split(/\n\s*\n/).map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
  const letzter = absaetze[absaetze.length - 1];
  if (!letzter) return null;
  // „[Mail #5612]" ist ein Verweis für die Leitung, kein Satz für den Betreuer.
  const sauber = letzter.replace(/\s*\[Mail #\d+\]\s*/g, " ").trim();
  return sauber.length > max ? `${sauber.slice(0, max - 1).trimEnd()}…` : sauber;
}

/**
 * Wohin „Öffnen" führt. Reihenfolge:
 *   1. Ein Link, der schon ins Office zeigt und KEINE Kundenakte ist
 *      (/agent/global/<ref>, /agent/firmen?firma=…, /agent/app-vorgaenge/…),
 *      bleibt, wie er ist — dort ist die richtige Akte.
 *   2. Mit Person: die Akte /agent/kunden?person=<id> (dieselbe Lade wie aus
 *      der Terminerinnerung; eine Route /agent/kunden/<id> gibt es nicht).
 *   3. Mit Referenz, aber ohne gefundene Person: /agent/kunden?ref=<ref> —
 *      die Pipeline löst die Referenz selbst auf und prüft den Zugriff.
 *   4. WhatsApp ohne Person (nur eine Nummer): der WhatsApp-Raum.
 *   5. Sonst die Aufgabenliste.
 * Links ins Chefbüro (/chef/s/…, /admin/…) sind für Mitarbeiter
 * verschlossen und werden nie weitergereicht.
 */
export function zielVon(a: { link: string | null; personId: number | null; ref: string | null; kanal: string | null; id?: number | null }): { href: string; text: string } {
  const link = String(a.link || "");
  // E-IT-F: „&auftrag=<id>" — in der Akte steht dann die Leiste mit diesem Auftrag (Erledigt, Nächster).
  const auftrag = a.id ? `&auftrag=${Number(a.id)}` : "";
  // E-IT-H (08.10.2026, Punkt 15): Maras Übergabe ohne Person trägt die Nummer (…/whatsapp?nummer=…) —
  // auch eine fürs Chefbüro gedachte führt den Mitarbeiter in SEINEN Raum, direkt ins Gespräch.
  const waNummer = a.personId ? null : nummerAusRaumPfad(link);
  if (waNummer) return { href: raumPfad("agent", waNummer), text: "WhatsApp öffnen" };
  if (link.startsWith("/agent/") && !/^\/agent\/(kunden|pipeline)(\?|$)/.test(link)) return { href: link, text: "Akte öffnen" };
  if (a.personId) return { href: `/agent/kunden?person=${a.personId}${auftrag}`, text: "Akte öffnen" };
  if (a.ref) return { href: `/agent/kunden?ref=${encodeURIComponent(a.ref)}${auftrag}`, text: "Akte öffnen" };
  if (a.kanal === "WhatsApp") return { href: "/agent/whatsapp", text: "WhatsApp öffnen" };
  return { href: "/agent/aufgaben", text: "Aufgabe öffnen" };
}

/** Die Person, soweit sie ohne Nachschlagen feststeht — aus dem Link oder dem Schlüssel. */
export function personAusZeile(r: { link?: string | null; schluessel?: string | null }): number | null {
  const l = String(r.link || "").match(/^\/agent\/(?:kunden|pipeline)\?(?:.*&)?person=(\d+)/);
  if (l) return Number(l[1]);
  // Mara auf WhatsApp: eine Aufgabe je Mensch und Grund, Schlüssel „wa-<person>-<Grund>-<JJJJ-MM-TT>"
  // (E-248; vorher „wa-<person>-<JJJJ-MM-TT>", fiaon-whatsapp-mara.ts). Ohne Person heißt er
  // „wa-n<nummer>-…" und trifft hier nicht.
  const s = String(r.schluessel || "").match(/^wa-(\d+)-/);
  return s ? Number(s[1]) : null;
}

export interface NeueAufgabe {
  id: number;
  titel: string;
  auszug: string | null;
  prioritaet: number;
  dringend: boolean;
  quelle: string;
  /** true = Mara hat die Aufgabe angelegt — die Karte schreibt „von Mara". */
  vonMara: boolean;
  /** E-Mail, WhatsApp — bzw. bei Hausquellen deren Name (Antrag, Zahlungen …). */
  kanal: string | null;
  kunde: string | null;
  personId: number | null;
  ref: string | null;
  ziel: { href: string; text: string };
  faelligAm: string | null;
  /** ISO — die letzte Bewegung, nach der sortiert und „Später" verglichen wird. */
  neuSeit: string;
}

/** Die neuesten ungelesenen offenen Aufgaben eines Mitarbeiters. Exportiert für den Prüfstand. */
export async function neueAufgaben(agentId: number): Promise<{ gesamt: number; stand: string | null; aufgaben: NeueAufgabe[] }> {
  await ensureTodoTabelle();
  // E-IT-F (08.10.2026): Kunde aus person_id (dieselbe Zuordnung wie die Liste) — neue Zeilen erst einordnen.
  const ohne = (await sqlPool`
    SELECT id FROM fiaon_betreiber_todos
     WHERE zustaendig_art = 'agent' AND zustaendig_agent_id = ${agentId} AND status <> 'erledigt' AND zugeordnet_am IS NULL LIMIT 50`.catch(() => [])) as any[];
  if (ohne.length) await auftraegeZuordnen({ ids: ohne.map((o: any) => Number(o.id)) }).catch(() => 0);
  // E-IT-F: „neu" ist, was seit dem letzten Hinsehen eine ECHTE Neuigkeit hat (neu_seit: Anlage, neue
  // Kundennachricht, Justins Übergabe). VORHER zählte GREATEST(letzte_aktivitaet, delegiert_am, created_at) —
  // jede Systemzeile und jeder Übertrag machte Altfälle „neu" (07.10.: 251 ungelesen bei Daniel, 162 davon
  // älter als 7 Tage, alle durch den Übertrag um 19:42).
  const zeilen = (await sqlPool`
    SELECT t.id, t.titel, t.text, t.prioritaet, t.quelle, t.link, t.schluessel, t.faellig_am::text AS faellig_am,
           COALESCE(t.neu_seit, t.created_at) AS neu_seit, t.ref AS t_ref,
           kp.id AS kunde_person_id, kp.name AS kunde_name,
           COUNT(*) OVER ()::int AS gesamt
      FROM fiaon_betreiber_todos t
      LEFT JOIN LATERAL (
        SELECT p.id, COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), NULLIF(TRIM(p.company_name), '')) AS name
          FROM fiaon_persons p0 JOIN fiaon_persons p ON p.id = COALESCE(p0.merged_into_person_id, p0.id)
         WHERE p0.id = t.person_id) kp ON TRUE
     WHERE t.zustaendig_art = 'agent' AND t.zustaendig_agent_id = ${agentId}
       AND t.status <> 'erledigt'
       AND COALESCE(t.neu_seit, t.created_at) > COALESCE(t.agent_gelesen_am, TIMESTAMPTZ 'epoch')
       -- 25.09.2026: nur, was in den letzten 7 Tagen neu ist — das Popup meldet Neues, nicht den Rückstand.
       AND COALESCE(t.neu_seit, t.created_at) > NOW() - INTERVAL '7 days'
     ORDER BY neu_seit DESC, t.id DESC
     LIMIT ${HOECHSTENS}
  `) as any[];
  if (!zeilen.length) return { gesamt: 0, stand: null, aufgaben: [] };

  const aufgaben = zeilen.map((r): NeueAufgabe => {
    const id = Number(r.id);
    const personId = r.kunde_person_id ? Number(r.kunde_person_id) : personAusZeile(r);
    const ref = r.t_ref ? String(r.t_ref) : refAusLink(r.link);
    const { vonMara, kanal } = quelleVon(r.quelle);
    const prioritaet = Number(r.prioritaet || 2);
    return {
      id, titel: String(r.titel || "Aufgabe"), auszug: auszugVon(r.text),
      prioritaet, dringend: prioritaet === 1,
      quelle: String(r.quelle || ""), vonMara, kanal,
      kunde: (r.kunde_name ? String(r.kunde_name) : null) ?? nameAusTitel(r.titel) ?? null,
      personId, ref,
      ziel: zielVon({ link: r.link ?? null, personId, ref, kanal, id }),
      faelligAm: r.faellig_am ? String(r.faellig_am).slice(0, 10) : null,
      neuSeit: new Date(r.neu_seit).toISOString(),
    };
  });
  return { gesamt: Number(zeilen[0].gesamt || aufgaben.length), stand: aufgaben[0]?.neuSeit ?? null, aufgaben };
}

/** „Gesehen" — nur für die eigene Aufgabe. false = nicht gefunden oder nicht seine. */
export async function aufgabeGesehen(agentId: number, id: number): Promise<boolean> {
  if (!Number.isInteger(id) || id <= 0) return false;
  await ensureTodoTabelle();
  // Besitz und Schreiben in EINER Anweisung: Zwischen Prüfen und Setzen kann
  // die Aufgabe nicht den Besitzer wechseln (Übergabe durch die Leitung).
  const r = (await sqlPool`
    UPDATE fiaon_betreiber_todos
       SET agent_gelesen_am = NOW()
     WHERE id = ${id} AND zustaendig_art = 'agent' AND zustaendig_agent_id = ${agentId}
     RETURNING id
  `) as any[];
  return r.length > 0;
}

router.get("/agent/aufgaben/neu", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const lage = await neueAufgaben(Number(req.agent!.id));
    res.json({ ok: true, agentId: Number(req.agent!.id), ...lage });
  } catch (err) {
    console.error("[AUFGABEN-POPUP] neu:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/agent/aufgaben/:id/gesehen", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const ok = await aufgabeGesehen(Number(req.agent!.id), Number(req.params.id));
    if (!ok) return res.status(404).json({ ok: false, error: "Diese Aufgabe liegt nicht bei dir." });
    res.json({ ok: true });
  } catch (err) {
    console.error("[AUFGABEN-POPUP] gesehen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
