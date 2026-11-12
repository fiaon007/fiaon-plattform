// ═══════════════════════════════════════════════════════════════════════════
// ZEIT BLOCKIEREN — LESEN UND SCHREIBEN (E-498, 12.11.2026)
//
// Die Regeln (Prüfung, Überschneidung, Texte) stehen rein in
// fiaon-sperrzeit-regeln.ts. Diese Datei ist die DATENBANK-Seite:
//
//   LESEN      sperrenLesen / sperrenJePerson — für `rohSlots` (alle
//              Terminseiten), `globalAngebotLaden` (Global-Kalender), das
//              Startgespräch-Angebot und das Kalender-Abo.
//   SCHREIBEN  sperrzeitAnlegen / sperrzeitLoeschen — die EINZIGEN Funktionen,
//              die in fiaon_sperrzeiten schreiben (Hausregel: Schreiben nur über
//              eine Plattform-Funktion). Die Route ruft nur sie.
//
// ── ZWEI ZUSAGEN AN DEN BETRIEB ────────────────────────────────────────────
//   1. Ein Lesefehler legt NIE eine Buchungsseite lahm. Die Tabelle gibt es erst
//      nach der Migration 133 (lokale Prüfstände haben sie oft nicht): Fehlt sie,
//      wird nicht einmal gefragt (to_regclass — wirft nie, auch nicht in einer
//      laufenden Transaktion); scheitert die Abfrage doch, steht der Fehler im
//      Log und die Seite rechnet wie bisher.
//   2. Eine Sperrzeit löst NIE etwas aus: keine Mail, kein Telefon-Wortlaut,
//      keine Aufgabe, kein Eintrag in fiaon_termine. Sie sperrt nur Zeit.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import {
  sperrzeitPruefen, sperrFensterMs, sperrzeitAlsBelegung, SPERRZEIT_MAX_OFFEN,
  type SperrzeitFehlerCode,
} from "./fiaon-sperrzeit-regeln";
import type { GlobalBelegung } from "./fiaon-global-zeiten";

type Lauf = typeof sqlPool;

export interface SperrzeitZeile {
  id: number;
  agentId: number;
  beginn: Date;
  ende: Date;
  grund: string | null;
  erstelltAm: Date;
}

/** Gibt es die Tabelle? Einmal ja = für immer ja (Tabellen verschwinden im Betrieb nicht). */
let tabelleDa = false;
export async function sperrzeitTabelleDa(lauf: Lauf = sqlPool): Promise<boolean> {
  if (tabelleDa) return true;
  const [r] = (await lauf`SELECT to_regclass('public.fiaon_sperrzeiten') IS NOT NULL AS da`.catch(() => [])) as any[];
  tabelleDa = !!r?.da;
  return tabelleDa;
}

function zeile(r: any): SperrzeitZeile {
  return {
    id: Number(r.id), agentId: Number(r.agent_id), beginn: new Date(r.beginn), ende: new Date(r.ende),
    grund: r.grund ? String(r.grund) : null, erstelltAm: new Date(r.erstellt_am),
  };
}

/** Fehler höchstens einmal je Minute ins Log — eine Buchungsseite fragt sekündlich, das Log soll lesbar bleiben. */
let letzterFehlerLog = 0;
function lesefehler(err: unknown): void {
  if (Date.now() - letzterFehlerLog < 60_000) return;
  letzterFehlerLog = Date.now();
  console.error("[SPERRZEIT] Sperrzeiten nicht lesbar — die Seite rechnet ohne sie:", String((err as Error)?.message ?? err).slice(0, 200));
}

/**
 * Alle Sperrzeiten dieser Personen, die das Fenster [von, bis) berühren (auch solche, die davor beginnen oder
 * danach enden). Wirft nie: ohne Tabelle oder bei einem Lesefehler kommt eine leere Liste.
 */
export async function sperrenLesen(agentIds: number[], von: Date, bis: Date, lauf: Lauf = sqlPool): Promise<SperrzeitZeile[]> {
  const ids = agentIds.filter((n) => Number.isInteger(n) && n > 0);
  if (ids.length === 0) return [];
  try {
    if (!(await sperrzeitTabelleDa(lauf))) return [];
    const zeilen = (await lauf`
      SELECT id, agent_id, beginn, ende, grund, erstellt_am FROM fiaon_sperrzeiten
       WHERE agent_id = ANY(${ids}) AND geloescht_am IS NULL
         AND ende > ${von} AND beginn < ${bis}
       ORDER BY beginn, id
       LIMIT 2000`) as any[];
    return zeilen.map(zeile);
  } catch (err) {
    lesefehler(err);
    return [];
  }
}

/** Dasselbe als Karte Person → Fenster in Millisekunden, fertig für `sperrzeitUeberlappt`. */
export async function sperrenJePerson(agentIds: number[], von: Date, bis: Date, lauf: Lauf = sqlPool): Promise<Map<number, { von: number; bis: number }[]>> {
  const karte = new Map<number, { von: number; bis: number }[]>();
  for (const s of await sperrenLesen(agentIds, von, bis, lauf)) {
    const f = sperrFensterMs(s);
    if (!f) continue;
    const liste = karte.get(s.agentId) ?? [];
    liste.push(f);
    karte.set(s.agentId, liste);
  }
  return karte;
}

/**
 * Die Sperrzeiten einer Person als Belegung für `globalZeitenRechnen` — für den Global-Gesprächskalender und das
 * Startgespräch. Vom Fenster [von, bis) berührt; zählt auf keinen Tagesdeckel.
 */
export async function sperrenAlsBelegung(agentId: number, von: Date, bis: Date, lauf: Lauf = sqlPool): Promise<GlobalBelegung[]> {
  const aus: GlobalBelegung[] = [];
  for (const s of await sperrenLesen([agentId], von, bis, lauf)) {
    const b = sperrzeitAlsBelegung(s);
    if (b) aus.push(b);
  }
  return aus;
}

/** Die kommenden Sperrzeiten einer Person (noch nicht vorbei), für die Liste im Kalender. */
export async function sperrzeitenListe(agentId: number, lauf: Lauf = sqlPool): Promise<SperrzeitZeile[]> {
  if (!(await sperrzeitTabelleDa(lauf))) return [];
  const zeilen = (await lauf`
    SELECT id, agent_id, beginn, ende, grund, erstellt_am FROM fiaon_sperrzeiten
     WHERE agent_id = ${agentId} AND geloescht_am IS NULL AND ende > NOW()
     ORDER BY beginn, id
     LIMIT 100`) as any[];
  return zeilen.map(zeile);
}

/** Ein bereits gebuchter Termin, der in die neue Sperrzeit fällt — OHNE Kundendaten (nur Zeit, Dauer, Art). */
export interface KollidierenderTermin { id: number; beginn: string; dauerMin: number; quelle: string }

export type SperrzeitAnlegen =
  | { ok: true; sperrzeit: SperrzeitZeile; schon: boolean; termine: KollidierenderTermin[] }
  | { ok: false; code: SperrzeitFehlerCode | "keine_tabelle" | "zu_viele"; error: string };

/** Das Kalender-Abo hält seinen Feed 60 s im Speicher — nach jeder Änderung vergessen, damit der nächste Abruf stimmt. */
async function abosAktualisieren(): Promise<void> {
  try {
    const { zwischenspeicherVergessen } = await import("./fiaon-kalender-abo");
    zwischenspeicherVergessen();
  } catch { /* ohne Abo-Modul (Prüfstand): nichts zu vergessen */ }
}

/**
 * Legt eine Sperrzeit an. DIE Schreibstelle. `agentId` = wessen Zeit gesperrt wird (die Route gibt hier immer den
 * angemeldeten Menschen hinein, nie einen Wert aus der Anfrage), `vonAgentId` = wer sie angelegt hat.
 *
 * Idempotent: Dieselbe Sperrzeit (gleiche Person, gleiches von/bis) zweimal angelegt — Doppelklick, zweiter Tab —
 * ergibt eine Zeile; `schon: true`. Die Antwort nennt außerdem die schon gebuchten Termine, die in die Sperrzeit
 * fallen: Eine Sperrzeit ersetzt keinen Termin, die Person soll es WISSEN.
 */
export async function sperrzeitAnlegen(
  ein: { agentId: number; beginn: unknown; ende: unknown; grund?: unknown; vonAgentId?: number | null },
  lauf: Lauf = sqlPool, jetzt: Date = new Date(),
): Promise<SperrzeitAnlegen> {
  if (!Number.isInteger(ein.agentId) || ein.agentId <= 0) {
    return { ok: false, code: "beginn_fehlt", error: "Ohne Person lässt sich keine Zeit sperren." };
  }
  const p = sperrzeitPruefen(ein, jetzt);
  if (!p.ok) return p;
  if (!(await sperrzeitTabelleDa(lauf))) {
    return { ok: false, code: "keine_tabelle", error: "Das Blockieren von Zeiten ist auf dem Server noch nicht eingerichtet." };
  }

  const [vorhanden] = (await lauf`
    SELECT id, agent_id, beginn, ende, grund, erstellt_am FROM fiaon_sperrzeiten
     WHERE agent_id = ${ein.agentId} AND beginn = ${p.beginn} AND ende = ${p.ende} AND geloescht_am IS NULL
     LIMIT 1`) as any[];
  let sperrzeit: SperrzeitZeile;
  let schon = false;
  if (vorhanden) {
    sperrzeit = zeile(vorhanden);
    schon = true;
  } else {
    const [n] = (await lauf`
      SELECT COUNT(*)::int AS n FROM fiaon_sperrzeiten
       WHERE agent_id = ${ein.agentId} AND geloescht_am IS NULL AND ende > NOW()`) as any[];
    if (Number(n?.n ?? 0) >= SPERRZEIT_MAX_OFFEN) {
      return { ok: false, code: "zu_viele", error: `Es gibt schon ${SPERRZEIT_MAX_OFFEN} gesperrte Zeiten. Bitte erst vergangene oder überflüssige löschen.` };
    }
    const [neu] = (await lauf`
      INSERT INTO fiaon_sperrzeiten (agent_id, beginn, ende, grund, erstellt_von)
      VALUES (${ein.agentId}, ${p.beginn}, ${p.ende}, ${p.grund}, ${ein.vonAgentId ?? null})
      RETURNING id, agent_id, beginn, ende, grund, erstellt_am`) as any[];
    sperrzeit = zeile(neu);
    await abosAktualisieren();
  }

  const kollisionen = (await lauf`
    SELECT id, beginn, COALESCE(dauer_min, 20)::int AS dauer, quelle FROM fiaon_termine
     WHERE agent_id = ${ein.agentId} AND status = 'gebucht'
       AND beginn < ${p.ende}
       AND beginn + make_interval(mins => COALESCE(dauer_min, 20)::int) > ${p.beginn}
     ORDER BY beginn
     LIMIT 20`.catch(() => [])) as any[];
  return {
    ok: true, sperrzeit, schon,
    termine: kollisionen.map((t) => ({ id: Number(t.id), beginn: new Date(t.beginn).toISOString(), dauerMin: Number(t.dauer), quelle: String(t.quelle ?? "") })),
  };
}

/**
 * Löscht eine Sperrzeit (weich). Nur die EIGENE: `agentId` muss zur Zeile passen — wer eine fremde Kennung rät,
 * löscht nichts. true = gelöscht, false = gab es nicht (mehr) oder gehört einem anderen.
 */
export async function sperrzeitLoeschen(id: number, agentId: number, vonAgentId: number | null = null, lauf: Lauf = sqlPool): Promise<boolean> {
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(agentId) || agentId <= 0) return false;
  if (!(await sperrzeitTabelleDa(lauf))) return false;
  const weg = (await lauf`
    UPDATE fiaon_sperrzeiten SET geloescht_am = NOW(), geloescht_von = ${vonAgentId}
     WHERE id = ${id} AND agent_id = ${agentId} AND geloescht_am IS NULL
     RETURNING id`) as any[];
  if (weg.length === 0) return false;
  await abosAktualisieren();
  return true;
}
