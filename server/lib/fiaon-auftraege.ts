// ═══════════════════════════════════════════════════════════════════════════
// AUFTRÄGE — DER EINE WEG ZUM ERLEDIGEN, WIEDER-ÖFFNEN, ZUORDNEN UND ZUM
// AUTOMATISCHEN ERLEDIGEN DURCH EREIGNISSE IN DER AKTE
// E-IT-F (08.10.2026), Punkte (6) bis (9) aus dem IT-Feedback
//
// ── VORHER ────────────────────────────────────────────────────────────────
// status, erledigt_am, erledigt_von und ergebnis wurden an mindestens 15
// Stellen je für sich geschrieben; Erzeuger öffneten Erledigtes wieder, ohne
// Spur. Die Tabelle kannte keinen Kunden — der Name wurde aus dem Link
// geraten (Liste und Popup mit zwei verschiedenen Ratern). Kein Ereignis in
// der Akte konnte „seine" Aufträge finden: 29 % der offenen Aufträge hatten
// nach der Anlage schon ein Gesprächsergebnis, eine WhatsApp-Antwort oder
// einen geführten Termin — und standen weiter oben in der Liste.
//
// ── NACHHER ───────────────────────────────────────────────────────────────
//   auftragErledigen()       der eine Weg, einen Auftrag zu schließen — mit
//                            Art (hand/auto/verwaltung), Ereignis und Beitrag.
//   auftragWiederOeffnen()   der eine Weg, ihn zu öffnen — immer mit Grund;
//                            die Wand in der Datenbank (Migration 102) schreibt
//                            „Wieder offen: <Grund>" in die Zeitleiste.
//   auftraegeZuordnen()      Kunde (Person, Wurzel bei Dubletten), Referenz und
//                            Art für jede Zeile — auch für die rund 30 Wege, die
//                            Aufträge anlegen, ohne davon zu wissen.
//   auftraegeDurchEreignis() schließt beim Ereignis in der Akte die offenen
//                            Aufträge der Person, deren Art es im Katalog führt
//                            (shared/fiaon-auftrag-arten.ts) — nie nurHand-Arten,
//                            nie mit offener Frage, nie bei einer neueren
//                            Kundennachricht. Verlauf: „Automatisch erledigt
//                            durch …". Ein Fehler hier hält nie die Akte auf.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import {
  AUFTRAG_ARTEN, AUFTRAG_EREIGNISSE, artenFuerEreignis, artNachInhalt, auftragArtVon, autoErledigtText, berlinTagZeit,
  istAuftragArt, istKontaktEreignis, kundeAusAuftrag, unterlagePasst, type AuftragArt, type AuftragArtRegel, type AuftragEreignis,
} from "../../shared/fiaon-auftrag-arten";

type Lauf = typeof sqlPool;

// ───────────────────────────────────────────────────────────────────────────
// SPALTEN UND WAND
// Die Migration 102 legt beides an. Die Spalten prüft der Server zusätzlich
// selbst (die DDL-Wache sieht vorher im Katalog nach, E-254) — die Wand nicht:
// ohne sie schreibt der Code die Zeitleiste selbst (statusWandDa).
// ───────────────────────────────────────────────────────────────────────────
let spaltenBereit: Promise<void> | null = null;
export function ensureAuftragSpalten(): Promise<void> {
  if (!spaltenBereit) {
    spaltenBereit = (async () => {
      await sqlPool`ALTER TABLE fiaon_betreiber_todos
        ADD COLUMN IF NOT EXISTS person_id INTEGER,
        ADD COLUMN IF NOT EXISTS ref VARCHAR,
        ADD COLUMN IF NOT EXISTS art VARCHAR,
        ADD COLUMN IF NOT EXISTS zugeordnet_am TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS eingang_am TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS neu_seit TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS erledigt_art VARCHAR,
        ADD COLUMN IF NOT EXISTS erledigt_ereignis TEXT,
        ADD COLUMN IF NOT EXISTS wieder_offen_zahl INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS wieder_offen_am TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS wieder_offen_grund TEXT`;
    })().catch((e) => { spaltenBereit = null; throw e; });
  }
  return spaltenBereit;
}

let wandGeprueft: boolean | null = null;
/** Steht die Wand (Trigger aus Migration 102)? Einmal je Prozess nachgesehen — pg_trigger sperrt nichts. */
export async function statusWandDa(lauf: Lauf = sqlPool): Promise<boolean> {
  if (wandGeprueft !== null) return wandGeprueft;
  const [r] = (await lauf`SELECT 1 AS da FROM pg_trigger WHERE tgname = 'fiaon_todo_status_wand' AND NOT tgisinternal AND tgenabled <> 'D' LIMIT 1`.catch(() => [])) as any[];
  wandGeprueft = !!r?.da;
  return wandGeprueft;
}
/** Nur für Prüfstände: den gemerkten Stand vergessen. */
export function statusWandVergessen(): void { wandGeprueft = null; }

export type BeitragArt = "kommentar" | "frage" | "antwort" | "ergebnis" | "status";
export interface BeitragEin { autorArt: "betreiber" | "agent" | "system"; autorName: string; autorAgentId?: number | null; art: BeitragArt; text: string }

/** Ein Beitrag in der Zeitleiste. Gleicher Text wie der letzte Beitrag desselben Autors = kein zweiter (Zeitleisten-Flut 524×). */
export async function auftragBeitrag(todoId: number, b: BeitragEin, lauf: Lauf = sqlPool, opt: { doppeltErlaubt?: boolean } = {}): Promise<boolean> {
  const text = String(b.text || "").trim();
  if (!text) return false;
  if (!opt.doppeltErlaubt) {
    const [letzter] = (await lauf`
      SELECT text FROM fiaon_betreiber_todo_beitraege
       WHERE todo_id = ${todoId} AND autor_art = ${b.autorArt} AND autor_name = ${b.autorName}
       ORDER BY created_at DESC, id DESC LIMIT 1`) as any[];
    if (letzter && String(letzter.text) === text) return false;
  }
  await lauf`
    INSERT INTO fiaon_betreiber_todo_beitraege (todo_id, autor_art, autor_name, autor_agent_id, art, text)
    VALUES (${todoId}, ${b.autorArt}, ${b.autorName}, ${b.autorAgentId ?? null}, ${b.art}, ${text})`;
  await lauf`UPDATE fiaon_betreiber_todos SET letzte_aktivitaet = NOW(), updated_at = NOW() WHERE id = ${todoId}`;
  return true;
}

// ───────────────────────────────────────────────────────────────────────────
// ERLEDIGEN UND WIEDER ÖFFNEN — DER EINE WEG
// ───────────────────────────────────────────────────────────────────────────
export interface ErledigenEin {
  art: "hand" | "auto" | "verwaltung";
  /** Name, der in „erledigt von" steht. */
  von: string;
  autorArt: "agent" | "betreiber" | "system";
  autorAgentId?: number | null;
  ergebnis?: string | null;
  /** Wodurch (bei „auto"): z. B. „Gesprächsergebnis erfasst". */
  ereignis?: string | null;
  /** Der Satz in der Zeitleiste; Standard: Ergebnis bzw. „Erledigt." */
  beitragText?: string | null;
  /** Der Mitarbeiter hat den Auftrag damit gesehen. */
  gelesen?: boolean;
}

/** Schließt einen offenen Auftrag. false = war schon erledigt (oder fehlt) — dann passiert nichts. */
export async function auftragErledigen(id: number, ein: ErledigenEin, lauf: Lauf = sqlPool): Promise<boolean> {
  const ergebnis = ein.ergebnis ? String(ein.ergebnis).trim().slice(0, 4000) : null;
  const r = (await lauf`
    UPDATE fiaon_betreiber_todos
       SET status = 'erledigt', erledigt_am = NOW(), erledigt_von = ${String(ein.von || "System").slice(0, 120)},
           erledigt_art = ${ein.art}, erledigt_ereignis = ${ein.ereignis ?? null},
           ergebnis = COALESCE(${ergebnis}, ergebnis),
           frage_offen = FALSE, frage_an_agent = FALSE,
           agent_gelesen_am = CASE WHEN ${!!ein.gelesen} THEN NOW() ELSE agent_gelesen_am END,
           updated_at = NOW()
     WHERE id = ${id} AND status <> 'erledigt'
     RETURNING id`) as any[];
  if (!r.length) return false;
  const text = ein.beitragText || ergebnis || "Erledigt.";
  await auftragBeitrag(id, {
    autorArt: ein.autorArt, autorName: ein.autorArt === "system" ? (ein.von || "System") : ein.von, autorAgentId: ein.autorAgentId ?? null,
    art: ergebnis && ein.art !== "auto" ? "ergebnis" : "status", text,
  }, lauf, { doppeltErlaubt: true });
  return true;
}

export interface WiederOeffnenEin {
  /** true = echte Neuigkeit (neue Kundennachricht): Eingang und „neu" beginnen jetzt, der Mitarbeiter wird benachrichtigt. */
  neu?: boolean;
  /** Der Mitarbeiter selbst öffnet — er hat es damit gesehen. */
  gelesen?: boolean;
  /** Statt 'offen' (z. B. 'in_arbeit', wenn der Mitarbeiter selbst wieder aufnimmt). */
  status?: "offen" | "in_arbeit";
}

/** Öffnet einen erledigten Auftrag — immer mit Grund. false = war nicht erledigt. */
export async function auftragWiederOeffnen(id: number, grund: string, ein: WiederOeffnenEin = {}, lauf: Lauf = sqlPool): Promise<boolean> {
  const g = `${String(grund || "ohne Angabe").trim().slice(0, 300)} (${berlinTagZeit(new Date())})`;
  const [vorher] = (await lauf`SELECT ergebnis FROM fiaon_betreiber_todos WHERE id = ${id} AND status = 'erledigt'`) as any[];
  if (!vorher) return false;
  const r = (await lauf`
    UPDATE fiaon_betreiber_todos
       SET status = ${ein.status ?? "offen"}, wieder_offen_grund = ${g},
           erledigt_am = NULL, erledigt_von = NULL, erledigt_art = NULL, erledigt_ereignis = NULL, ergebnis = NULL,
           eingang_am = CASE WHEN ${!!ein.neu} THEN NOW() ELSE eingang_am END,
           neu_seit = CASE WHEN ${!!ein.neu} THEN NOW() ELSE neu_seit END,
           agent_gelesen_am = CASE WHEN ${!!ein.gelesen} THEN NOW() WHEN ${!!ein.neu} THEN NULL ELSE agent_gelesen_am END,
           updated_at = NOW(), letzte_aktivitaet = NOW()
     WHERE id = ${id} AND status = 'erledigt'
     RETURNING id`) as any[];
  if (!r.length) return false;
  // Ohne die Wand (Migration 102 noch nicht gelaufen) schreibt der Code die Zeile selbst — nie still.
  if (!(await statusWandDa(lauf))) {
    await lauf`UPDATE fiaon_betreiber_todos SET wieder_offen_zahl = COALESCE(wieder_offen_zahl, 0) + 1, wieder_offen_am = NOW() WHERE id = ${id}`;
    await auftragBeitrag(id, {
      autorArt: "system", autorName: "System", art: "status",
      text: `Wieder offen: ${g}${vorher.ergebnis ? `\nFrüheres Ergebnis: ${vorher.ergebnis}` : ""}`,
    }, lauf, { doppeltErlaubt: true });
  }
  return true;
}

// ───────────────────────────────────────────────────────────────────────────
// KUNDE UND ART ZUORDNEN
// ───────────────────────────────────────────────────────────────────────────

/** Die Wurzel einer Person (merged_into_person_id bis zum Ende, höchstens sechs Schritte). */
export async function personWurzel(personId: number, lauf: Lauf = sqlPool): Promise<number | null> {
  let id = Number(personId);
  for (let i = 0; i < 6; i++) {
    const [p] = (await lauf`SELECT id, merged_into_person_id FROM fiaon_persons WHERE id = ${id}`) as any[];
    if (!p) return i === 0 ? null : id;
    if (!p.merged_into_person_id || Number(p.merged_into_person_id) === id) return id;
    id = Number(p.merged_into_person_id);
  }
  return id;
}

/** Alle Kennungen eines Menschen: Wurzel, die Person selbst und alles, was in die Wurzel zusammengeführt wurde. */
export async function personenKreis(personId: number, lauf: Lauf = sqlPool): Promise<{ wurzel: number | null; ids: number[] }> {
  const wurzel = await personWurzel(personId, lauf);
  if (!wurzel) return { wurzel: null, ids: [] };
  const zweige = (await lauf`SELECT id FROM fiaon_persons WHERE merged_into_person_id = ${wurzel} LIMIT 50`) as any[];
  return { wurzel, ids: Array.from(new Set([wurzel, Number(personId), ...zweige.map((z) => Number(z.id))])) };
}

export interface Zuordnung { id: number; personId: number | null; ref: string | null; art: AuftragArt; quelle: string }

/** Kunde und Art EINER Zeile — rein lesend; auftraegeZuordnen schreibt. Exportiert für Prüfstand und Einmal-Lauf. */
export async function zuordnungFuer(r: { id: number; link?: string | null; schluessel?: string | null; text?: string | null; titel?: string | null; quelle?: string | null; bereich?: string | null; person_id?: number | null; ref?: string | null }, lauf: Lauf = sqlPool): Promise<Zuordnung> {
  const art = auftragArtVon({ schluessel: r.schluessel, quelle: r.quelle, bereich: r.bereich, titel: r.titel, text: r.text });
  const k = kundeAusAuftrag({ link: r.link, schluessel: r.schluessel, text: r.text });
  let ref: string | null = r.ref ? String(r.ref).toUpperCase() : k.ref;
  let personId: number | null = r.person_id ? Number(r.person_id) : null;
  let quelle = personId ? "gesetzt" : "";
  if (!personId && k.personId) {
    const [p] = (await lauf`SELECT id FROM fiaon_persons WHERE id = ${k.personId}`) as any[];
    if (p) { personId = Number(p.id); quelle = k.personQuelle ?? "link"; }
  }
  if (!personId && ref) {
    const [a] = (await lauf`SELECT person_id FROM fiaon_applications WHERE ref = ${ref} AND person_id IS NOT NULL LIMIT 1`) as any[];
    if (a?.person_id) { personId = Number(a.person_id); quelle = "ref"; }
  }
  if (!personId && k.mailId) {
    const [m] = (await lauf`SELECT person_id, ref FROM fiaon_postmeister WHERE id = ${k.mailId}`.catch(() => [])) as any[];
    if (m?.person_id) { personId = Number(m.person_id); quelle = "mail"; }
    if (!ref && m?.ref) ref = String(m.ref).toUpperCase();
  }
  if (personId) personId = (await personWurzel(personId, lauf)) ?? personId;
  return { id: Number(r.id), personId, ref, art, quelle: quelle || "ohne" };
}

/**
 * Trägt Kunde und Art nach — für Zeilen ohne Zuordnung (zugeordnet_am IS NULL).
 * Läuft beim Laden der Listen, vor jedem Ereignis und im Hintergrund nach dem
 * Start; mit `ids` gezielt (auch erneut, `neu: true`).
 */
export async function auftraegeZuordnen(opt: { ids?: number[]; nurOffen?: boolean; grenze?: number; neu?: boolean } = {}, lauf: Lauf = sqlPool): Promise<number> {
  const grenze = Math.max(1, Math.min(opt.grenze ?? 300, 2000));
  const ids = (opt.ids ?? []).map(Number).filter((n) => Number.isInteger(n) && n > 0);
  const zeilen = (await lauf`
    SELECT id, link, schluessel, LEFT(text, 20000) AS text, titel, quelle, bereich, person_id, ref
      FROM fiaon_betreiber_todos
     WHERE (${ids.length > 0} AND id = ANY(${ids}::int[]) AND (${!!opt.neu} OR zugeordnet_am IS NULL))
        OR (${ids.length === 0} AND zugeordnet_am IS NULL AND (${!opt.nurOffen} OR status <> 'erledigt'))
     ORDER BY id DESC
     LIMIT ${grenze}`) as any[];
  let n = 0;
  for (const z of zeilen) {
    const zu = await zuordnungFuer(z, lauf);
    await lauf`
      UPDATE fiaon_betreiber_todos
         SET person_id = ${zu.personId}, ref = ${zu.ref}, art = ${zu.art}, zugeordnet_am = NOW()
       WHERE id = ${zu.id}`;
    n += 1;
  }
  return n;
}

let nachholenLaeuft = false;
/** Im Hintergrund nach dem Start: alle Zeilen ohne Zuordnung, in Paketen. Nie zweimal gleichzeitig. */
export async function auftraegeZuordnenNachholen(): Promise<number> {
  if (nachholenLaeuft) return 0;
  nachholenLaeuft = true;
  let summe = 0;
  try {
    for (let runde = 0; runde < 20; runde++) {
      const n = await auftraegeZuordnen({ grenze: 250 });
      summe += n;
      if (n < 250) break;
    }
    if (summe) console.log(`[AUFTRÄGE] Kunde und Art für ${summe} Aufträge nachgetragen.`);
  } catch (e) {
    console.error("[AUFTRÄGE] Zuordnung nachholen:", String(e).slice(0, 200));
  } finally {
    nachholenLaeuft = false;
  }
  return summe;
}

// ───────────────────────────────────────────────────────────────────────────
// EREIGNISSE IN DER AKTE → AUTOMATISCH ERLEDIGT
// ───────────────────────────────────────────────────────────────────────────
export interface EreignisEin {
  ereignis: AuftragEreignis;
  personId?: number | null;
  ref?: string | null;
  akteur: { id: number | null; name: string };
  /** z. B. das Ergebnis in Worten — steht in Klammern hinter dem Ereignis. */
  detail?: string | null;
  am?: Date;
}
export interface EreignisWirkung { geschlossen: { id: number; titel: string; art: string }[]; vermerkt: number; ausgelassen: { id: number; grund: string }[] }

/** Der Grund, den die Route „Wieder öffnen“ schreibt (`von <Name> wieder geöffnet[: Grund]`). */
export const VON_HAND_WIEDER_OFFEN = /^von .+ wieder geöffnet/;

/** Wartet für einen dieser Menschen noch ein Antwortentwurf von Mara? Dann darf „Kunde hat geschrieben" nicht schließen. */
async function entwurfWartet(personIds: number[], lauf: Lauf): Promise<boolean> {
  if (!personIds.length) return false;
  const [r] = (await lauf`
    SELECT 1 AS da FROM fiaon_postmeister p
     WHERE p.person_id = ANY(${personIds}::int[]) AND p.gesendet_am IS NULL
       AND p.aktion IN ('entwurf', 'fehler', 'versand_wartet', 'versand_fehlgeschlagen', 'sendet')
       AND NOT (p.aktion = 'fehler' AND p.created_at < NOW() - INTERVAL '14 days')
     LIMIT 1`.catch(() => [{ da: 1 }])) as any[];
  return !!r?.da;
}

/**
 * Das Ereignis schließt die offenen Aufträge, die es laut Katalog schließt.
 *
 * Bedingungen (alle):
 *   · die Art führt das Ereignis in schliesstBei und ist nicht nurHand;
 *   · nicht erledigt, nicht „wartet auf Justin", keine offene Frage in eine Richtung;
 *   · keine neuere Kundennachricht als das Ereignis (neu_seit ≤ Ereigniszeit);
 *   · Kontakt-Ereignisse fassen nur Aufträge beim Team an — was auf Justins Board
 *     liegt (Zahlungsprüfung, Kopien heikler Fälle), schließt nur er;
 *   · Kontakt-Ereignisse schließen nur Aufträge, die beim Handelnden SELBST liegen —
 *     bei Kollegen steht nur „Kontakt durch … – bitte prüfen" (Gegenprüfung 08.10.);
 *     handelt ein Mitarbeiter, gilt das für JEDES Ereignis (Kartenlink, Unterlage);
 *   · „Unterlage anfordern" nur, wenn die Unterlage zum Auftrag passt (unterlagePasst);
 *   · „Kunde hat geschrieben" nur, wenn kein Antwortentwurf mehr wartet.
 * Ein Anrufversuch ohne Erfolg schließt nichts — er steht als Versuch im Verlauf.
 * Wirft nie: Das Ergebnis in der Akte ist schon gebucht.
 */
export async function auftraegeDurchEreignis(ein: EreignisEin, lauf: Lauf = sqlPool): Promise<EreignisWirkung> {
  try {
    return await durchEreignisRoh(ein, lauf);
  } catch (e) {
    console.error(`[AUFTRÄGE] Ereignis ${ein.ereignis}:`, String(e).slice(0, 200));
    return { geschlossen: [], vermerkt: 0, ausgelassen: [] };
  }
}

/** Dasselbe, aber ein Fehler wird geworfen — damit ein Sicherungspunkt ihn zurückrollen kann. */
async function durchEreignisRoh(ein: EreignisEin, lauf: Lauf): Promise<EreignisWirkung> {
  const wirkung: EreignisWirkung = { geschlossen: [], vermerkt: 0, ausgelassen: [] };
  {
    const am = ein.am ?? new Date();
    const wer = String(ein.akteur?.name || "System").slice(0, 120);
    let personId = ein.personId ? Number(ein.personId) : null;
    const ref = ein.ref ? String(ein.ref).toUpperCase() : null;
    if (!personId && ref) {
      const [a] = (await lauf`SELECT person_id FROM fiaon_applications WHERE ref = ${ref} AND person_id IS NOT NULL LIMIT 1`) as any[];
      personId = a?.person_id ? Number(a.person_id) : null;
    }
    const kreis = personId ? await personenKreis(personId, lauf) : { wurzel: null, ids: [] as number[] };
    if (!kreis.ids.length && !ref) return wirkung;
    // Offene Zeilen ohne Zuordnung zuerst einordnen. auftragFuerKunden ordnet beim Anlegen selbst zu;
    // hier bleiben nur Wege ohne Kundenwissen (todoAnlegen, Telefonie, Kontaktformular) — wenige je
    // Stunde. Den Altbestand trägt der Hintergrundlauf nach dem Start nach (auftraegeZuordnenNachholen).
    await auftraegeZuordnen({ nurOffen: true, grenze: 40 }, lauf);

    if (ein.ereignis === "ergebnis_versuch") {
      if (!kreis.ids.length) return wirkung;
      const arten = artenFuerEreignis("ergebnis_erreicht");
      const offen = (await lauf`
        SELECT id FROM fiaon_betreiber_todos
         WHERE status <> 'erledigt' AND zustaendig_art = 'agent'
           AND person_id = ANY(${kreis.ids}::int[]) AND art = ANY(${arten}::text[])`) as any[];
      for (const t of offen) {
        const ok = await auftragBeitrag(Number(t.id), {
          autorArt: "system", autorName: wer, art: "kommentar",
          text: `${AUFTRAG_EREIGNISSE.ergebnis_versuch.label}${ein.detail ? ` (${ein.detail})` : ""} – ${wer}, ${berlinTagZeit(am)}. Der Auftrag bleibt offen.`,
        }, lauf);
        if (ok) wirkung.vermerkt += 1;
      }
      return wirkung;
    }

    // Eine Bonitätsauskunft kam herein: „Auskunft fehlt/bezahlt" schließt das NICHT (Entscheidung 4a) —
    // der Betreuer soll die Leistung klären. Nur ein Beitrag, einmal je Ereignis.
    if (ein.ereignis === "unterlage_erhalten" && kreis.ids.length && /(bonitätsauskunft|schufa)/i.test(String(ein.detail || ""))) {
      const ausk = (await lauf`
        SELECT id FROM fiaon_betreiber_todos
         WHERE status <> 'erledigt' AND person_id = ANY(${kreis.ids}::int[])
           AND art = ANY(${["mara_auskunft", "auskunft_lieferung"]}::text[])`) as any[];
      for (const t of ausk) {
        const ok = await auftragBeitrag(Number(t.id), {
          autorArt: "system", autorName: wer, art: "kommentar",
          text: `Kunde hat eigene Auskunft hochgeladen – Leistung klären (${wer}, ${berlinTagZeit(am)}). Der Auftrag bleibt offen.`,
        }, lauf);
        if (ok) wirkung.vermerkt += 1;
      }
    }

    const arten = artenFuerEreignis(ein.ereignis);
    if (!arten.length) return wirkung;
    const artenPerson = arten.filter((a) => AUFTRAG_ARTEN[a].bezug === "person");
    const artenRef = arten.filter((a) => AUFTRAG_ARTEN[a].bezug === "ref");
    const nurTeam = ein.ereignis !== "zahlung_gebucht";
    const kandidaten = (await lauf`
      SELECT id, schluessel, quelle, bereich, titel, LEFT(text, 20000) AS text, art, zustaendig_art, zustaendig_agent_id, frage_offen, frage_an_agent, status,
             COALESCE(neu_seit, eingang_am, created_at) AS neu_seit, wieder_offen_grund
        FROM fiaon_betreiber_todos
       WHERE status <> 'erledigt'
         AND ((art = ANY(${artenPerson}::text[]) AND person_id = ANY(${kreis.ids}::int[]))
           OR (art = ANY(${artenRef}::text[]) AND ${ref}::text IS NOT NULL AND ref = ${ref}::text))
         AND (${!nurTeam} OR zustaendig_art = 'agent')
       ORDER BY id`) as any[];
    let entwurf: boolean | null = null;
    for (const t of kandidaten) {
      const id = Number(t.id);
      if (t.status === "wartet" || t.frage_offen || t.frage_an_agent) { wirkung.ausgelassen.push({ id, grund: "offene Frage" }); continue; }
      if (t.neu_seit && new Date(t.neu_seit).getTime() > am.getTime() + 1000) { wirkung.ausgelassen.push({ id, grund: "neuere Kundennachricht" }); continue; }
      // Fertigstellung 08.10. (Gegenprüfung, Fund 16): Hat ein Mensch den Auftrag selbst wieder geöffnet (Route
      // wieder-oeffnen: „von <Name> wieder geöffnet …“), schließt ihn kein Ereignis mehr — sonst pendelt er (wie im Einmal-Lauf).
      if (VON_HAND_WIEDER_OFFEN.test(String(t.wieder_offen_grund || ""))) { wirkung.ausgelassen.push({ id, grund: "von Hand wieder geöffnet" }); continue; }
      // Gegenprüfung 08.10.: die Art aus dem JETZIGEN Titel und Text nachsehen. Kam seit der Einordnung
      // Heikles dazu (Widerruf an einer Rückruf-Übergabe, Beschwerde in einem alten WhatsApp-Schlüssel),
      // gilt die strengere Art — gespeichert, damit Liste und Einmal-Lauf sie ebenso sehen.
      const abgeleitet = artNachInhalt(t.art, { schluessel: t.schluessel, quelle: t.quelle, bereich: t.bereich, titel: t.titel, text: t.text });
      if (abgeleitet !== t.art) await lauf`UPDATE fiaon_betreiber_todos SET art = ${abgeleitet} WHERE id = ${id}`;
      const artName: unknown = abgeleitet;
      const regel: AuftragArtRegel | null = istAuftragArt(artName) ? AUFTRAG_ARTEN[artName] : null;
      if (!regel || regel.nurHand) { wirkung.ausgelassen.push({ id, grund: "nur von Hand" }); continue; }
      const wasDetail = `${AUFTRAG_EREIGNISSE[ein.ereignis].label}${ein.detail ? ` (${ein.detail})` : ""}`;
      // Kontakt durch jemand anderen als den Zuständigen (Forderungsmanagement, Leitung, Kollege,
      // Betreiber ohne Mitarbeiterkonto): nicht schließen, nur Bescheid geben.
      // Fertigstellung 08.10. (Justins Regel: Aufträge anderer Mitarbeiter schließt das System nie): Handelt ein
      // MITARBEITER, gilt das für jedes Ereignis — auch Kartenlink und Unterlage eines Kollegen sind nur ein Hinweis.
      // Ohne Mitarbeiter (System, Kunde lädt hoch, Zahlung gebucht) bleiben Tatsachen Tatsachen.
      const kontakt = istKontaktEreignis(ein.ereignis);
      const fremd = ein.akteur?.id ? Number(t.zustaendig_agent_id) !== Number(ein.akteur.id) : kontakt;
      if (fremd) {
        const ok = await auftragBeitrag(id, {
          autorArt: "system", autorName: wer, art: "kommentar",
          // Ohne Uhrzeit im Text: dasselbe Ereignis zweimal gemeldet ergibt keinen zweiten Beitrag (die Zeit steht am Beitrag).
          text: `${kontakt ? `Kontakt durch ${wer} (${wasDetail})` : `${wasDetail} durch ${wer}`} – bitte prüfen, ob der Auftrag damit erledigt ist.`,
        }, lauf);
        if (ok) wirkung.vermerkt += 1;
        wirkung.ausgelassen.push({ id, grund: "anderer Zuständiger" });
        continue;
      }
      // „Unterlage anfordern": nur die angeforderte Unterlage schließt (Ausweis ≠ Kontoauszug).
      if (artName === "unterlage" && (ein.ereignis === "unterlage_erhalten" || ein.ereignis === "unterlage_angefordert")
        && !unterlagePasst({ titel: t.titel, text: t.text }, ein.detail)) {
        const ok = await auftragBeitrag(id, {
          autorArt: "system", autorName: wer, art: "kommentar",
          text: `${wasDetail} – ${wer}, ${berlinTagZeit(am)}. Das ist nicht die Unterlage aus diesem Auftrag – er bleibt offen.`,
        }, lauf);
        if (ok) wirkung.vermerkt += 1;
        wirkung.ausgelassen.push({ id, grund: "andere Unterlage" });
        continue;
      }
      if (regel.nurOhneOffenenEntwurf) {
        if (entwurf === null) entwurf = await entwurfWartet(kreis.ids, lauf);
        if (entwurf) {
          await auftragBeitrag(id, {
            autorArt: "system", autorName: "System", art: "kommentar",
            text: `${AUFTRAG_EREIGNISSE[ein.ereignis].label} (${wer}, ${berlinTagZeit(am)}). Für diesen Kunden wartet noch ein Antwortentwurf von Mara — `
              + "bitte unter E-Mails „Übernommen“ wählen oder senden; dann schließt sich der Auftrag.",
          }, lauf);
          wirkung.ausgelassen.push({ id, grund: "Antwortentwurf wartet" });
          continue;
        }
      }
      const text = autoErledigtText(ein.ereignis, wer, am, ein.detail ?? null);
      const zu = await auftragErledigen(id, {
        art: "auto", von: wer, autorArt: "system", autorAgentId: ein.akteur?.id ?? null,
        ereignis: `${AUFTRAG_EREIGNISSE[ein.ereignis].label}${ein.detail ? ` (${ein.detail})` : ""} – ${wer}`,
        ergebnis: text, beitragText: text,
      }, lauf);
      if (zu) wirkung.geschlossen.push({ id, titel: String(t.titel || ""), art: String(t.art || "") });
    }
    if (wirkung.geschlossen.length) {
      console.log(`[AUFTRÄGE] ${AUFTRAG_EREIGNISSE[ein.ereignis].label} (${wer}): ${wirkung.geschlossen.length} Auftrag/Aufträge automatisch erledigt — ${wirkung.geschlossen.map((g) => `#${g.id}`).join(", ")}.`);
    }
  }
  return wirkung;
}

/**
 * Für Aufrufer mit eigener Transaktion: Das Ereignis läuft in einem
 * Sicherungspunkt — ein Fehler hier bricht nie die Buchung des Aufrufers ab
 * (AGENTS.md: eine gescheiterte Anweisung tötet sonst die ganze Transaktion).
 */
export async function ereignisMelden(ein: EreignisEin, lauf: Lauf = sqlPool): Promise<EreignisWirkung> {
  const leer: EreignisWirkung = { geschlossen: [], vermerkt: 0, ausgelassen: [] };
  try {
    const sp = (lauf as any)?.savepoint;
    if (lauf !== sqlPool && typeof sp === "function") {
      // durchEreignisRoh WIRFT — nur dann rollt postgres.js den Sicherungspunkt zurück, und die
      // Transaktion des Aufrufers bleibt benutzbar.
      return await (lauf as any).savepoint((tx: Lauf) => durchEreignisRoh(ein, tx));
    }
    return await auftraegeDurchEreignis(ein, lauf);
  } catch (e) {
    console.error(`[AUFTRÄGE] Ereignis ${ein.ereignis} (Sicherungspunkt):`, String(e).slice(0, 200));
    return leer;
  }
}

/**
 * „Kunde hat geschrieben“ von Hand erledigt (Gegenprüfung 08.10.): Maras noch wartende Entwürfe zu den
 * Mails DIESES Auftrags ([Mail #id] im Text) gelten als vom Betreuer übernommen — wie
 * POST /agent/postmeister/:id/erledigt. Sonst bliebe der Entwurf in der Zentrale und könnte später doch
 * noch (doppelt oder widersprüchlich) rausgehen. Gibt die Zeilen zurück, deren Gmail-Entwurf der Aufrufer
 * löschen soll. Schreibt nur Zeilen, die noch nicht gesendet sind und nicht gerade senden.
 */
export async function uebergabeEntwuerfeUebernehmen(text: string | null | undefined, wer: string, wie: string, lauf: Lauf = sqlPool): Promise<{ id: number; postfach: string; draftId: string | null }[]> {
  const ids: number[] = [];
  const marke = /\[Mail #(\d+)\]/g;
  const t = String(text || "");
  for (let m = marke.exec(t); m; m = marke.exec(t)) { const n = Number(m[1]); if (n > 0 && !ids.includes(n)) ids.push(n); }
  if (!ids.length) return [];
  const r = (await lauf`
    UPDATE fiaon_postmeister
       SET aktion = 'geordnet', begruendung = ${`Vom Betreuer übernommen (${String(wer || "Betreuer").slice(0, 120)}): ${String(wie || "im Auftrag erledigt").slice(0, 300)}`}, updated_at = NOW()
     WHERE id = ANY(${ids}::int[]) AND gesendet_am IS NULL
       AND aktion IN ('entwurf', 'fehler', 'versand_wartet', 'versand_fehlgeschlagen')
     RETURNING id, postfach, antwort_draft_id`) as any[];
  return r.map((z) => ({ id: Number(z.id), postfach: String(z.postfach || ""), draftId: z.antwort_draft_id ? String(z.antwort_draft_id) : null }));
}

// Die Übersetzung Gesprächs-/Ratenergebnis → Ereignis steht in shared (eine Quelle mit dem Katalog).
export { ereignisAusErgebnis, ereignisAusRatenErgebnis } from "../../shared/fiaon-auftrag-arten";

export { type AuftragArt, type AuftragEreignis };
