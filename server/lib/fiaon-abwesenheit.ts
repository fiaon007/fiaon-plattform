// ═══════════════════════════════════════════════════════════════════════════
// TEAM ABWESEND — EIN VERTRETER ÜBERNIMMT MARAS RÜCKRUFE (29.09.2026, E-260)
//
// Justin: „ALLE Termine, die MARA macht, muss ich sehen können … ich arbeite
// gerade alleine an den Kunden, meine einzige Aufgabe ist es, so viel Geld wie
// möglich reinzuholen … Die anderen Mitarbeiter arbeiten erst wieder am
// Freitag. Bis dahin schupfe ich das ganze."
//
// Gemessen am 29.09. (scratchpad/e260/analyse.md): Ein Abwesenheitsmodell gab
// es nicht. Mara buchte weiter beim abwesenden Betreuer oder im „Pool" nach
// der geringsten Last (4 von 10 WhatsApp-Buchungen), nannte Abwesende beim
// Namen („Nikita ruft Sie an") und übergab an Menschen, die bis Freitag nichts
// sehen. Justins Konto ist ein Testkonto — vier Stellen schließen es deshalb
// aus. Eine Vertretung muss es AUSDRÜCKLICH zulassen.
//
// DIESE DATEI IST DIE EINZIGE WAHRHEIT:
//   · Zustand: fiaon_settings.team_abwesenheit (JSON als Text), 10 s
//     zwischengespeichert, beim Setzen im eigenen Prozess sofort umgeschaltet
//     (dasselbe Muster wie ki_pause). Keine Schemaänderung.
//   · „bis" ist Pflicht und liegt höchstens 14 Tage voraus. Ist „bis" vorbei,
//     ist die Abwesenheit AUS — geprüft bei jedem Lesen, ohne Takt. Das Ende
//     wird einmal in den Verlauf geschrieben („abgelaufen").
//   · „fuer" leer = das ganze Team außer dem Vertreter; sonst diese Agent-IDs.
//   · Der Begriff heißt „Abwesenheit", nicht „Vertretung": `fiaon_termine.
//     vertretung` und /agent/termine/vertretungen meinen den Rollen-Rückfall
//     beim Startgespräch (B12). Der Vertreter ist der Mensch, der anruft.
//
// WAS SIE BEWIRKT (und was nicht):
//   · Mara bucht NEUE Rückrufe vor „bis" nur im Kalender des Vertreters (sein
//     Raster, 20 Minuten Vorlauf) — fiaon-mara-termin.ts, freieZeiten. Termine
//     der Abwesenden gelten dabei als belegt: Er ruft sie ja an (B4).
//   · Nach „bis" bucht Mara wieder auf dem normalen Weg: beim Betreuer (der
//     ist dann zurück); ohne buchbaren Betreuer im Pool der Terminseite; ist
//     der Vertreter selbst sein Betreuer, weiter bei ihm. Gegenprüfung 29.09.:
//     vorher gab es für Kunden ohne buchbaren Betreuer nach „bis" gar keine
//     Zeit — ab Do 18 Uhr (Justins Zeiten enden dort) weder Zeit noch Link.
//   · Die Kundenzuordnung bleibt: kein assigned_agent_id, keine Provision,
//     keine Verteilung wird angefasst — weder wandert der Kunde eines
//     gesperrten Betreuers noch wird ein Kunde ohne Betreuer an den Vertreter
//     gebunden (buchungAnwenden mit zuordnen: false, B10).
//   · „nur einzelne" abwesend: Kunden ohne buchbaren Betreuer bleiben im Pool
//     — dort zählen nur die Anwesenden (fiaon-mara-termin.ts, freieZeiten).
//   · Maras Sätze nennen den, der wirklich anruft (anruferFuer, B2).
//   · Maras Übergaben gehen an das Betreiber-Board statt an Abwesende (B9).
//   · Bestehende Termine bleiben, wo sie sind — der Reiter „Termine" im
//     Mara-Steuerpult zeigt sie mit der Marke „Betreuer abwesend".
//
// ── VERTRETUNG (01.10.2026) — der Vertreter ist ein Mitarbeiter ─────────────
// Seit 01.10. 10:28 vertritt Nikita (#13) das ganze Team bis 15.10. Drei Lücken,
// die E-260 mit Justin als Vertreter nicht hatte:
//   · DIE TERMINSEITE (Kunden-Link /termin/…, alle Mails „Termin buchen")
//     buchte weiter beim abwesenden Betreuer bzw. im Pool samt Abwesenden.
//     Jetzt sieht ein Kunde, für den die Abwesenheit gilt, vor „bis" die
//     freien Plätze des Vertreters (fiaon-termine.ts, freieSlots — dieselbe
//     Rechnung für Anzeige und Annahme), danach den normalen Weg. Kunde und
//     Betreuer bleiben (zuordnen: false, wie B10). Gründer-Termine (/justin)
//     und FIAON Global laufen über eigene Wege und werden NIE umgeleitet —
//     auch nicht in Namen, Erinnerungen und der Belegung des Vertreters
//     (NIE_UMLEITEN_QUELLEN).
//   · MARAS ÜBERGABEN lagen auf dem Board des Betreibers. Ist der Vertreter ein
//     echter Mitarbeiter (kein Testkonto, nicht der Gründer), bekommt ER sie
//     (uebergabeVertretung); Heikles (Kündigung, Beschwerde, Bestreiten,
//     Löschwunsch, Rechtsdrohung) liegt zusätzlich auf dem Board
//     (betreiberKopie). Ist der Vertreter der Betreiber, bleibt alles wie in E-260.
//   · DIE AKTE: Eine Aufgabe ohne Zugriff ist eine verschlossene Tür. Der
//     Vertreter sieht während der Abwesenheit die Kunden, für die sie gilt —
//     Akte (fiaon-kundenzugriff.ts) und WhatsApp-Raum (vertreterSiehtBetreuer).
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { rohSlots, verfuegbarkeitVon, type Slot } from "./fiaon-termine";
import { parseBerlinInput } from "./fiaon-time";
import { nennform, type Nennform } from "@shared/fiaon-mitarbeiter-name";

type Lauf = typeof sqlPool;

export const ABWESENHEIT_SCHLUESSEL = "team_abwesenheit";
/** Höchstens so weit voraus — dieselbe Grenze wie der Buchungshorizont (HORIZONT_TAGE). */
export const ABWESENHEIT_HOECHSTENS_TAGE = 14;
/** Ein Kartei-Rückruf blockt beim Vertreter so viele Minuten. */
const KARTEI_RUECKRUF_MIN = 15;

export interface AbwesenheitEreignis { am: string; von: string; was: string }

export interface Abwesenheit {
  an: boolean;
  vertreterId: number | null;
  /** ISO-Zeitpunkt — ab hier ist das Team wieder da. */
  bis: string | null;
  /** Leer = das ganze Team außer dem Vertreter. */
  fuer: number[];
  gesetztVon: string | null;
  gesetztAm: string | null;
  /** Wann und wie sie zuletzt endete (für „Abwesenheit endete Fr 02.10., 09:00"). */
  endeteAm: string | null;
  endeteWie: "abgelaufen" | "beendet" | null;
  /** Neueste zuerst, höchstens 20. */
  verlauf: AbwesenheitEreignis[];
}

/**
 * E-265 (29.09.2026): `anrufName` ist die Nennform („Herr Boychenko" bzw. ohne Anrede
 * „Nikita Boychenko"), `anrufDat` die nach mit/an/für („Herrn Boychenko") — nie der Vorname.
 * `vorname` und `name` bleiben für interne Texte (Protokoll, Aufgabe, Chefbüro).
 */
export interface Vertreter {
  id: number; vorname: string; name: string; anrufName: string; anrufDat: string; nenn: Nennform;
  /**
   * Vertretung (01.10.2026): ein echter Mitarbeiter — kein Testkonto, nicht der
   * Gründer/Betreiber (928/929). Dann gehen Maras Übergaben an IHN statt aufs
   * Board des Betreibers (uebergabeVertretung).
   */
  mitarbeiter?: boolean;
}

/**
 * Vertretung (01.10.2026): Gespräche dieser Quellen werden NIE umgeleitet — das
 * Gründer-Gespräch (/justin) und das Erstgespräch zu FIAON Global haben eigene
 * Wege, eigene Kalender und einen festen Gesprächspartner. Sie zählen weder als
 * „Termin bei einem Abwesenden" (Namen, Erinnerung, Marke im Reiter) noch als
 * Belegung des Vertreters.
 */
export const NIE_UMLEITEN_QUELLEN: readonly string[] = ["gruender", "global"];
/** Darf ein Termin dieser Quelle in der Abwesenheit beim Vertreter landen bzw. ihn nennen? Rein. */
export function quelleUmleitbar(quelle: string | null | undefined): boolean {
  return !NIE_UMLEITEN_QUELLEN.includes(String(quelle ?? ""));
}
export interface AktiveAbwesenheit { vertreter: Vertreter; bis: Date; fuer: number[] }

const LEER: Abwesenheit = {
  an: false, vertreterId: null, bis: null, fuer: [], gesetztVon: null, gesetztAm: null,
  endeteAm: null, endeteWie: null, verlauf: [],
};

function lesen(roh: unknown): Abwesenheit {
  if (!roh) return { ...LEER };
  try {
    const j = typeof roh === "string" ? JSON.parse(roh) : roh;
    return {
      ...LEER, ...j,
      an: j?.an === true,
      vertreterId: Number.isInteger(Number(j?.vertreterId)) && Number(j?.vertreterId) > 0 ? Number(j.vertreterId) : null,
      fuer: Array.isArray(j?.fuer) ? j.fuer.map(Number).filter((n: number) => Number.isInteger(n) && n > 0) : [],
      verlauf: Array.isArray(j?.verlauf) ? j.verlauf.slice(0, 20) : [],
    };
  } catch {
    return { ...LEER };
  }
}

// ── Zustand lesen (10 s zwischengespeichert) ──────────────────────────────
let zwischen: { wert: Abwesenheit; roh: string | null; vertreter: Vertreter | null; problem: string | null; bis: number } | null = null;

/** Nur für Prüfstände: den Zwischenspeicher verwerfen (nach einem direkten SQL-Eingriff). */
export function abwesenheitVergessen(): void { zwischen = null; }

/**
 * Der Vertreter — nur, wenn er wirklich anrufen kann. Ein Testkonto ist hier
 * AUSDRÜCKLICH erlaubt (Justins Konto 928, B3); geprüft werden aktiv, nicht
 * gesperrt, nicht Forderungsmanagement und mindestens ein aktives Zeitfenster.
 */
export async function vertreterPruefen(agentId: number, lauf: Lauf = sqlPool): Promise<{ vertreter: Vertreter | null; problem: string | null }> {
  const [a] = (await lauf`
    SELECT id, name, COALESCE(NULLIF(first_name, ''), split_part(name, ' ', 1)) AS vorname, first_name, last_name, anrede,
           COALESCE(active, TRUE) AS aktiv, zugang_gesperrt_am, COALESCE(rolle, 'agent') AS rolle,
           COALESCE(is_test_account, FALSE) AS test
      FROM fiaon_agents WHERE id = ${agentId}`) as any[];
  if (!a) return { vertreter: null, problem: `Konto #${agentId} gibt es nicht.` };
  if (!a.aktiv) return { vertreter: null, problem: `${a.name} ist nicht aktiv.` };
  if (a.zugang_gesperrt_am) return { vertreter: null, problem: `${a.name} ist gesperrt.` };
  if (a.rolle === "inkasso") return { vertreter: null, problem: `${a.name} ist im Forderungsmanagement — dort gibt es keine Rückruftermine.` };
  const zeiten = (await verfuegbarkeitVon(Number(a.id), lauf)).filter((z) => z.aktiv);
  if (!zeiten.length) return { vertreter: null, problem: `${a.name} hat keine Arbeitszeiten eingetragen — ohne Zeiten kann Mara nichts buchen (Agentenportal → Verfügbarkeit).` };
  const vorname = String(a.vorname || "").trim() || String(a.name);
  // E-265 (29.09.2026, Justin „zum letzten Mal!!"): anrufName ist die Nennform — „Herr Boychenko",
  // ohne gepflegte Anrede „Nikita Boychenko" (heute: Konto 13 und 928 haben keine Anrede). Vorher der
  // Vorname („Nikita ruft Sie an"), weil die Sätze in fiaon-whatsapp-mara.ts das erste Wort nahmen —
  // das tun sie seit E-265 nicht mehr. Damit ist die Frage F3 erledigt.
  const nenn = nennform(a);
  // Vertretung (01.10.2026): Mitarbeiter = kein Testkonto und nicht der Gründer. Kann die
  // Gründer-Einstellung nicht gelesen werden, entscheidet die Testkonto-Marke allein (928/929 sind beide eine).
  let gruender = 0;
  try { gruender = await (await import("../routes/fiaon-gruender-termin")).gruenderAgentId(); } catch { /* ohne Gründer-Einstellung */ }
  const mitarbeiter = !a.test && Number(a.id) !== Number(gruender);
  return { vertreter: { id: Number(a.id), vorname, name: String(a.name), anrufName: nenn.nom, anrufDat: nenn.dat, nenn, mitarbeiter }, problem: null };
}

export async function abwesenheitLesen(frisch = false, lauf: Lauf = sqlPool): Promise<Abwesenheit> {
  return (await stand(frisch, lauf)).wert;
}

async function stand(frisch: boolean, lauf: Lauf): Promise<NonNullable<typeof zwischen>> {
  if (!frisch && zwischen && zwischen.bis > Date.now()) return zwischen;
  try {
    const [r] = (await lauf`SELECT value FROM fiaon_settings WHERE key = ${ABWESENHEIT_SCHLUESSEL} LIMIT 1`) as any[];
    const roh = r?.value != null ? String(r.value) : null;
    const wert = lesen(roh);
    const pr = wert.an && wert.vertreterId ? await vertreterPruefen(wert.vertreterId, lauf) : { vertreter: null, problem: null };
    zwischen = { wert, roh, vertreter: pr.vertreter, problem: pr.problem, bis: Date.now() + 10_000 };
    return zwischen;
  } catch (e) {
    // Ohne Datenbank: der letzte bekannte Stand, sonst aus. Eine gestörte
    // Datenbank darf Mara nicht auf einen Vertreter umlenken, den niemand gesetzt hat.
    console.error("[ABWESENHEIT] Zustand nicht lesbar:", String(e).slice(0, 160));
    const z = zwischen ?? { wert: { ...LEER }, roh: null, vertreter: null, problem: null, bis: 0 };
    zwischen = { ...z, bis: Date.now() + 10_000 };
    return zwischen;
  }
}

/** „Fr 02.10., 09:00" — Berliner Zeit, über formatToParts (Zeit-Falle 04.09.2026). */
export function bisText(d: Date | string): string {
  const x = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(x.getTime())) return "";
  const t: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(x)) t[p.type] = p.value;
  return `${String(t.weekday || "").replace(/\.$/, "")} ${t.day}.${t.month}., ${t.hour}:${t.minute}`;
}

/**
 * Ist die Abwesenheit JETZT in Kraft? null = aus, abgelaufen oder der
 * Vertreter kann nicht anrufen (dann bucht Mara wie ohne Abwesenheit — und der
 * Reiter zeigt den Grund rot). Eine abgelaufene wird dabei einmal als
 * „abgelaufen" in den Verlauf geschrieben.
 */
export async function abwesenheitJetzt(lauf: Lauf = sqlPool, jetzt: Date = new Date()): Promise<AktiveAbwesenheit | null> {
  const z = await stand(false, lauf);
  const w = z.wert;
  if (!w.an || !w.vertreterId || !w.bis) return null;
  const bis = new Date(w.bis);
  if (Number.isNaN(bis.getTime())) return null;
  if (bis.getTime() <= jetzt.getTime()) {
    await ablaufVermerken(z.roh, w, lauf).catch((e) => console.error("[ABWESENHEIT] Ablauf nicht vermerkt:", String(e).slice(0, 160)));
    return null;
  }
  if (!z.vertreter) return null;
  return { vertreter: z.vertreter, bis, fuer: w.fuer };
}

/** Gilt die Abwesenheit für diesen Mitarbeiter (und, mit Beginn, für diesen Zeitpunkt)? Rein. */
export function istAbwesend(ab: AktiveAbwesenheit | null, agentId: number | null | undefined, beginn?: Date | string | null): boolean {
  if (!ab || !agentId) return false;
  const id = Number(agentId);
  if (id === ab.vertreter.id) return false;
  if (ab.fuer.length && !ab.fuer.includes(id)) return false;
  if (beginn != null) {
    const b = typeof beginn === "string" ? new Date(beginn) : beginn;
    if (!(b.getTime() < ab.bis.getTime())) return false;
  }
  return true;
}

/**
 * Wer ruft an? Für jeden Satz an den Kunden, der einen Termin nennt: Liegt der
 * Termin bei einem Abwesenden und vor „bis", der Anrufname des Vertreters —
 * sonst der Name des Gebuchten (B2). E-265: `eigen` ist die Nennform des
 * Gebuchten („Herr Stripling"), zurück kommt die Nennform (nie der Vorname).
 */
export async function anruferFuer(agentId: number, beginn: Date | string, eigen: string, lauf: Lauf = sqlPool, quelle?: string | null): Promise<string> {
  return (await anruferNennform(agentId, beginn, { nom: eigen, dat: eigen }, lauf, quelle)).nom;
}

/**
 * Wie anruferFuer, mit beiden Fällen: { nom: „Herr Stripling", dat: „Herrn Stripling" }. E-265.
 * Vertretung (01.10.2026): `quelle` — Gründer- und Global-Gespräche nennen immer den Gebuchten (NIE_UMLEITEN_QUELLEN).
 */
export async function anruferNennform(agentId: number, beginn: Date | string, eigen: { nom: string; dat: string }, lauf: Lauf = sqlPool, quelle?: string | null): Promise<{ nom: string; dat: string; vertreter: boolean; vertreterVorname: string | null }> {
  if (!quelleUmleitbar(quelle)) return { ...eigen, vertreter: false, vertreterVorname: null };
  try {
    const ab = await abwesenheitJetzt(lauf);
    return istAbwesend(ab, agentId, beginn)
      ? { nom: ab!.vertreter.anrufName, dat: ab!.vertreter.anrufDat, vertreter: true, vertreterVorname: ab!.vertreter.vorname }
      : { ...eigen, vertreter: false, vertreterVorname: null };
  } catch {
    return { ...eigen, vertreter: false, vertreterVorname: null };
  }
}

export interface VertretungFuerPerson {
  ab: AktiveAbwesenheit;
  /** Der eingetragene Betreuer — null, wenn es keinen gibt. E-265: `nenn` = seine Nennform („Herr Stripling"). */
  betreuer: { id: number; vorname: string; name: string; nenn: Nennform } | null;
  /** Kann der Betreuer (ohne Abwesenheit) überhaupt Rückrufe führen? Für die Zeit nach „bis". */
  betreuerBuchbar: boolean;
}

/**
 * Gilt die Abwesenheit für DIESEN Menschen? Ja, wenn sie in Kraft ist und sein
 * Betreuer abwesend ist — oder er keinen Betreuer hat, der Rückrufe führen
 * kann, und das ganze Team weg ist (dann ginge es sonst in den Pool der
 * Abwesenden), oder der Vertreter selbst sein Betreuer ist (Testkonto — ohne
 * das fiele er in den Pool). Sind nur einzelne weg (`fuer`), bleibt ein Kunde
 * ohne buchbaren Betreuer im Pool der Anwesenden (Gegenprüfung 29.09.).
 * null = wie ohne Abwesenheit.
 */
export async function vertretungFuerPerson(personId: number, lauf: Lauf = sqlPool): Promise<VertretungFuerPerson | null> {
  const ab = await abwesenheitJetzt(lauf);
  if (!ab) return null;
  const [p] = (await lauf`
    SELECT a.id, a.name, COALESCE(NULLIF(a.first_name, ''), split_part(a.name, ' ', 1)) AS vorname, a.first_name, a.last_name, a.anrede,
           COALESCE(a.active, TRUE) AS aktiv, a.zugang_gesperrt_am, COALESCE(a.is_test_account, FALSE) AS test,
           COALESCE(a.rolle, 'agent') AS rolle
      FROM fiaon_persons p LEFT JOIN fiaon_agents a ON a.id = p.assigned_agent_id
     WHERE p.id = ${personId} AND p.merged_into_person_id IS NULL`) as any[];
  if (!p?.id) return ab.fuer.length ? null : { ab, betreuer: null, betreuerBuchbar: false };
  const betreuer = { id: Number(p.id), vorname: String(p.vorname || p.name), name: String(p.name), nenn: nennform(p) };
  const buchbar = !!p.aktiv && !p.zugang_gesperrt_am && !p.test && p.rolle !== "inkasso";
  if (betreuer.id === ab.vertreter.id) return { ab, betreuer, betreuerBuchbar: false };
  if (!buchbar) return ab.fuer.length ? null : { ab, betreuer, betreuerBuchbar: false };
  if (istAbwesend(ab, betreuer.id)) return { ab, betreuer, betreuerBuchbar: true };
  return null;
}

/**
 * Was beim Vertreter belegt ist: seine eigenen gebuchten Termine, die Termine
 * der Abwesenden vor „bis" (er ruft sie an, B4) und seine offenen Rückrufe aus
 * der Telefonkartei (15 Minuten, nur wenn er der Gründer ist — die Kartei
 * gehört Justin). Mit Dauer, nicht nur gleicher Beginn.
 */
export async function belegtFuerVertreter(ab: AktiveAbwesenheit, lauf: Lauf = sqlPool): Promise<{ von: number; bis: number; terminId: number | null }[]> {
  const zeilen = (await lauf`
    SELECT id, agent_id, beginn, COALESCE(dauer_min, 20) AS dauer FROM fiaon_termine
     WHERE status = 'gebucht' AND beginn > NOW() - INTERVAL '2 hours' AND beginn < NOW() + INTERVAL '15 days'
       AND (agent_id = ${ab.vertreter.id}
            OR (beginn < ${ab.bis} AND agent_id <> ${ab.vertreter.id}
                -- Vertretung (01.10.2026): Gründer- und Global-Gespräche ruft der Vertreter nie an (NIE_UMLEITEN_QUELLEN)
                AND COALESCE(quelle, '') <> ALL(${[...NIE_UMLEITEN_QUELLEN]})
                AND (${ab.fuer.length === 0} OR agent_id = ANY(${ab.fuer.length ? ab.fuer : [0]}))))`) as any[];
  const raus: { von: number; bis: number; terminId: number | null }[] = zeilen.map((z) => {
    const von = new Date(z.beginn).getTime();
    return { von, bis: von + Number(z.dauer) * 60_000, terminId: Number(z.id) };
  });
  try {
    const { gruenderAgentId } = await import("../routes/fiaon-gruender-termin");
    if ((await gruenderAgentId()) === ab.vertreter.id) {
      const rr = (await lauf`
        SELECT am FROM fiaon_telefonkartei_rueckruf
         WHERE erledigt_am IS NULL AND am > NOW() - INTERVAL '2 hours' AND am < NOW() + INTERVAL '15 days'`) as any[];
      for (const r of rr) {
        const von = new Date(r.am).getTime();
        raus.push({ von, bis: von + KARTEI_RUECKRUF_MIN * 60_000, terminId: null });
      }
    }
  } catch { /* Kartei-Tabelle fehlt (lokaler Prüfstand) — dann nur die Termine */ }
  return raus;
}

/**
 * Die freien Plätze des Vertreters vor „bis": sein Raster (20 Minuten), der
 * Vorlauf, ohne jede Überschneidung mit dem, was er ohnehin anrufen muss.
 * `nachBis: true` (E-260, Gegenprüfung 29.09.): stattdessen die Plätze AB
 * „bis" — für Kunden, deren fester Betreuer der Vertreter selbst ist.
 */
export async function freiePlaetzeVertreter(
  ab: AktiveAbwesenheit, vorlaufMin: number, lauf: Lauf = sqlPool,
  // Vertretung (01.10.2026): `takt` — die Terminseite bucht im Raster der Gesprächsart (Startgespräch 15
  // Minuten, sonst 20; dauerFuer). Dieselbe Zahl muss die Annahme (terminBuchen, Raster-Wand) sehen.
  opts: { nachBis?: boolean; takt?: number } = {},
): Promise<Slot[]> {
  const takt = opts.takt && opts.takt > 0 ? opts.takt : 20;
  const roh = await rohSlots([{ id: ab.vertreter.id, vorname: ab.vertreter.anrufName }], takt, lauf, vorlaufMin * 60_000);
  const belegt = await belegtFuerVertreter(ab, lauf);
  return roh.filter((s) => {
    const von = new Date(s.beginn).getTime();
    if (opts.nachBis ? von < ab.bis.getTime() : von >= ab.bis.getTime()) return false;
    const bis = von + takt * 60_000;
    return !belegt.some((b) => b.von < bis && b.bis > von);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// VERTRETUNG (01.10.2026) — ÜBERGABEN UND ZUGRIFF
// ═══════════════════════════════════════════════════════════════════════════
export interface UebergabeVertretung {
  ab: AktiveAbwesenheit;
  /**
   * true = die Übergabe geht an den Vertreter (er ist ein echter Mitarbeiter);
   * false = aufs Board des Betreibers (der Vertreter IST der Betreiber — wie E-260, B9).
   */
  anVertreter: boolean;
}

/**
 * Gilt die Abwesenheit für eine Übergabe von Mara? `empfaengerId` = an wen sie
 * ohne Abwesenheit ginge (ein genannter Kollege, die Leitung, der abgeleitete
 * Betreuer) — dann zählt, ob GENAU der abwesend ist. Ohne Empfänger zählt die
 * Person (vertretungFuerPerson), ohne Person das Team (die Abwesenheit selbst).
 * null = wie ohne Abwesenheit. Wirft nie.
 */
export async function uebergabeVertretung(personId: number | null, empfaengerId: number | null = null, lauf: Lauf = sqlPool): Promise<UebergabeVertretung | null> {
  try {
    const ab = await abwesenheitJetzt(lauf);
    if (!ab) return null;
    const gilt = empfaengerId
      ? istAbwesend(ab, empfaengerId)
      : personId ? !!(await vertretungFuerPerson(personId, lauf)) : true;
    if (!gilt) return null;
    return { ab, anVertreter: ab.vertreter.mitarbeiter === true };
  } catch (e) {
    console.error("[ABWESENHEIT] Übergabe-Ziel nicht lesbar — die Übergabe geht wie ohne Abwesenheit:", String(e).slice(0, 160));
    return null;
  }
}

/**
 * Wie uebergabeVertretung(personId) — und zusätzlich: Gilt die Abwesenheit nicht für
 * den Kunden, aber für den, an den die Übergabe ohne Abwesenheit ginge
 * (auftragEmpfaenger: Betreuer, sonst die Rolle zur Lage), dann ebenfalls.
 * Für die Wege, die den Empfänger ableiten lassen (Postfach, WhatsApp ohne Leitung).
 */
export async function uebergabeVertretungAbgeleitet(personId: number | null, lauf: Lauf = sqlPool): Promise<UebergabeVertretung | null> {
  const v = await uebergabeVertretung(personId, null, lauf);
  if (v || !personId) return v;
  try {
    if (!(await abwesenheitJetzt(lauf))) return null;
    const { auftragEmpfaenger } = await import("../routes/fiaon-betreiber-todo");
    const e = await auftragEmpfaenger(personId);
    return e?.id ? await uebergabeVertretung(personId, Number(e.id), lauf) : null;
  } catch {
    return null;
  }
}

/** Die Felder für auftragFuerKunden: an den Vertreter — oder aufs Board des Betreibers. Rein. */
export function uebergabeFelder(v: UebergabeVertretung): { agentId: number; anBetreiber: false } | { anBetreiber: true; agentId: null } {
  return v.anVertreter ? { agentId: v.ab.vertreter.id, anBetreiber: false } : { anBetreiber: true, agentId: null };
}

/**
 * Heikel im Sinne der Vertretung: Kündigung, Widerruf, Storno (des Vertrags), Geld zurück,
 * Beschwerde, Bestreiten, Zahlungsverweigerung, Löschwunsch (Daten/Konto), Rechtsdrohung
 * (Anwalt, Verbraucherzentrale, Polizei, Klage, Gericht, Betrug). Solche Übergaben sieht
 * der Betreiber ZUSÄTZLICH auf seinem Board. Rein.
 * Auf WhatsApp entscheidet die Aufgabenklasse (fiaon-whatsapp-mara.ts, HEIKLE_KLASSEN);
 * im Postfach der Text der Aufgabe, den Mara schreibt.
 *
 * Gegenprüfung (01.10.2026): Die erste Fassung suchte Wortstücke („storn", „klage",
 * „gericht", „lösch", „erstatt") und schlug bei „Termin stornieren", „Klagenfurt",
 * „an Daniel gerichtet", „Nummer gelöscht", „Erstattung der Auslagen" an — jede davon
 * eine unnötige Karte auf dem Board. „Kunde verweigert die Zahlung" fand sie nicht.
 * Jetzt: ganze Wörter bzw. das Wort MIT seinem Gegenstand (Storno des Vertrags,
 * Löschen der Daten/des Kontos, Erstattung von Geld). \b ist in JavaScript nur für
 * ASCII gedacht — vor Umlauten steht deshalb ein Lookbehind auf Buchstaben.
 */
const BUCHSTABE_DAVOR = "(?<![a-zäöüß])";
const VERTRAGSWORT = "(?:vertrag|bestellung|auftrag|abo|paket|antrag|mitgliedschaft)";
const BESITZ = "(?:meine|seine|ihre|unsere|alle|sämtliche|saemtliche|persönliche\\w*|persoenliche\\w*|personenbezogene\\w*)";
/** Ein Lückenwort, das nicht von Auskunfteien handelt — „seine Daten aus der SCHUFA löschen" ist das Geschäft, kein Löschwunsch. */
const LUECKE = "(?:(?!schufa|crif|boniversum|eintr|negativ)\\S+\\s+)";
const HEIKEL_MUSTER: readonly RegExp[] = [
  // Kündigung — nicht „angekündigt"/„Ankündigung".
  /(?<!an|ange)k(?:ü|ue|u)ndig/i,
  /widerr(?:uf|ief)/i,
  // Storno des Vertrags/der Bestellung — nicht „Termin stornieren".
  new RegExp(`(?<!termin-?)\\bstorno\\b|storn\\w*\\s+${LUECKE}{0,3}?${VERTRAGSWORT}|${VERTRAGSWORT}\\w*\\s+${LUECKE}{0,3}?storn`, "i"),
  // Geld zurück — nicht „Erstattung der Auslagen".
  /r(?:ü|ue)ck(?:erstatt|überweis|ueberweis)|zurück\s*(?:zu)?(?:überweis|ueberweis|erstatt)|geld\s+(?:\S+\s+){0,2}?(?:zurück|zurueck|wieder)|erstatt\w*\s+(?:\S+\s+){0,3}?(?:geld|betrag|beitrag|gebühr|gebuehr|zahlung|rate|kosten|\d)|(?:geld|betrag|beitrag|gebühr|gebuehr|zahlung|rate|kosten)\w*\s+(?:\S+\s+){0,3}?(?:erstatt|zurück|zurueck)/i,
  /beschwer(?!lich)/i,
  // Rechtsdrohung — „Klage" als Wort (nicht „Klagenfurt"), „Gericht" als Wort (nicht „gerichtet").
  /anw(?:a|ä|ae)lt|rechtsbeistand|verbraucherzentrale|verbraucherschutz|schlichtungsstelle|bafin|polizei|strafanzeige|anzeige\s+(?:\S+\s+){0,2}?erstatt/i,
  new RegExp(`${BUCHSTABE_DAVOR}(?:ver)?klag(?:e|en|t|te)\\b|sammelklage|einklag|${BUCHSTABE_DAVOR}gericht(?:e|s|en|lich\\w*)?\\b|(?:amts|land|mahn)gericht|gerichtsvollzieh`, "i"),
  /betrug|betrüg|betrueg|abzocke|abgezockt/i,
  // Löschwunsch — Daten oder Konto der Person, nicht „Nummer gelöscht" oder ein Auskunftei-Eintrag.
  new RegExp(`dsgvo|art\\.?\\s*17\\b|recht\\s+auf\\s+(?:vergessen|löschung|loeschung)|daten\\s*-?\\s*(?:löschung|loeschung)|(?:lösch|loesch)(?:antrag|wunsch)`
    + `|${BESITZ}\\s+(?:\\S+\\s+)?daten\\s+${LUECKE}{0,3}?(?:lösch|loesch|gelöscht|geloescht|entfern)`
    + `|(?:lösch|loesch)\\w*\\s+${LUECKE}{0,3}?${BESITZ}\\s+(?:\\S+\\s+)?daten`
    + `|${BUCHSTABE_DAVOR}(?:konto|account|kundenkonto|profil|zugang)\\s+(?:\\S+\\s+){0,3}?(?:lösch|loesch|gelöscht|geloescht)`
    + `|(?:lösch|loesch)\\w*\\s+(?:\\S+\\s+){0,3}?(?:kundenkonto|konto|account|profil)\\b`, "i"),
  // Bestreiten — „nie beantragt", „kenne Sie nicht".
  /bestreit|(?:nie|niemals|nichts)\s+(?:\S+\s+){0,2}?(?:beantragt|bestellt|unterschrieben|abgeschlossen|beauftragt)|nicht\s+(?:\S+\s+){0,2}?(?:beantragt|beauftragt)\b|(?:kenne|kennt)\s+(?:\S+\s+){0,2}?(?:fiaon|euch|sie|ihre\s+firma)\s+nicht|identitätsdiebstahl|identitaetsdiebstahl/i,
  // Zahlungsverweigerung (die Eskalation) — „verweigert die Zahlung", „zahlt nichts mehr".
  /verweiger\w*\s+(?:\S+\s+){0,3}?(?:zahlung|zahlen|rate|beitrag)|(?:zahlung|zahlen|rate|beitrag)\w*\s+(?:\S+\s+){0,3}?verweiger|weiger\w*\s+sich\s+(?:\S+\s+){0,3}?zu\s+zahlen|(?:zahle|zahlt|zahlen)\s+(?:\S+\s+){0,3}?(?:nichts|nicht)\s+mehr|keinen\s+(?:cent|euro)\s+mehr|zahlung(?:en)?\s+(?:\S+\s+){0,2}?eingestellt/i,
];
export function heikleUebergabe(text: string | null | undefined): boolean {
  const t = String(text ?? "");
  return HEIKEL_MUSTER.some((m) => m.test(t));
}

/**
 * Die Kopie fürs Board des Betreibers — nur, wenn die Übergabe beim Vertreter
 * liegt (sonst liegt sie ohnehin dort). Eigener Schlüssel (`…:betreiber`), damit
 * weitere Nachrichten desselben Falls sich anhängen statt neue Karten zu machen.
 * `still` (Gegenprüfung 01.10.2026): wie bei der Aufgabe selbst — eine weitere
 * Nachricht hängt sich an, ohne die erledigte Karte wieder zu öffnen.
 */
export async function betreiberKopie(
  ein: { personId: number | null; ref: string | null; titel: string; text: string; dringend?: boolean; schluessel?: string | null; quelle: string; link?: string | null; autorName?: string; still?: boolean },
  v: UebergabeVertretung | null,
): Promise<number | null> {
  if (!v?.anVertreter) return null;
  try {
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    const erg = await auftragFuerKunden({
      personId: ein.personId, ref: ein.ref, anBetreiber: true, dringend: ein.dringend ?? true,
      titel: `Zur Kenntnis (heikel): ${ein.titel}`.slice(0, 160),
      text: `${ein.text}\n\nDie Aufgabe liegt bei ${v.ab.vertreter.name} (Vertretung bis ${bisText(v.ab.bis)}). Heikel — deshalb steht sie zusätzlich hier.`,
      quelle: ein.quelle, autorName: ein.autorName ?? "Mara",
      ...(ein.link ? { link: ein.link } : {}),
      ...(ein.schluessel ? { schluessel: `${ein.schluessel}:betreiber` } : {}),
      ...(ein.still ? { still: true } : {}),
    } as any);
    return erg?.id ?? null;
  } catch (e) {
    console.error("[ABWESENHEIT] Board-Kopie nicht angelegt:", String(e).slice(0, 160));
    return null;
  }
}

/**
 * Sieht der Vertreter einen Kunden dieses Betreuers? Ja, solange die Abwesenheit
 * gilt und der Betreuer abwesend ist — oder der Kunde keinen hat und das ganze
 * Team weg ist. Rein; für Listen (WhatsApp-Raum), die je Zeile entscheiden.
 */
export function vertreterSiehtBetreuer(ab: AktiveAbwesenheit | null, agentId: number | null | undefined, betreuerId: number | null | undefined): boolean {
  if (!ab || !agentId || Number(agentId) !== ab.vertreter.id) return false;
  if (!betreuerId) return ab.fuer.length === 0;
  return istAbwesend(ab, Number(betreuerId));
}

/** Darf dieser Mitarbeiter als Vertreter an diesen Kunden (Akte, Telefon, Mail)? Wirft nie. */
export async function vertreterDarfAnKunde(agentId: number, personId: number, lauf: Lauf = sqlPool): Promise<boolean> {
  try {
    const ab = await abwesenheitJetzt(lauf);
    if (!ab || ab.vertreter.id !== Number(agentId)) return false;
    return !!(await vertretungFuerPerson(personId, lauf));
  } catch {
    return false;
  }
}

// ── Schreiben ─────────────────────────────────────────────────────────────
async function speichern(z: Abwesenheit, lauf: Lauf): Promise<void> {
  const v = JSON.stringify(z);
  await lauf`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${ABWESENHEIT_SCHLUESSEL}, ${v}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = ${v}, updated_at = NOW()`;
  zwischen = null;
}

/**
 * Eine abgelaufene Abwesenheit einmal als „abgelaufen" vermerken. Nur, wenn in
 * der Zeile noch genau der Stand steht, der abgelaufen ist — hat Justin
 * inzwischen verlängert, gilt seine Verlängerung.
 */
async function ablaufVermerken(roh: string | null, w: Abwesenheit, lauf: Lauf): Promise<void> {
  if (!roh || !w.an || !w.bis) return;
  const neu: Abwesenheit = {
    ...w, an: false, endeteAm: w.bis, endeteWie: "abgelaufen",
    verlauf: [{ am: new Date().toISOString(), von: "System", was: `abgelaufen (war bis ${bisText(w.bis)})` }, ...w.verlauf].slice(0, 20),
  };
  const r = (await lauf`
    UPDATE fiaon_settings SET value = ${JSON.stringify(neu)}, updated_at = NOW()
     WHERE key = ${ABWESENHEIT_SCHLUESSEL} AND value = ${roh}
    RETURNING key`) as any[];
  if (r.length) console.log(`[ABWESENHEIT] abgelaufen — war bis ${bisText(w.bis)}. Mara bucht wieder bei den Betreuern.`);
  zwischen = null;
}

export interface SetzenEin {
  an: boolean;
  /** ISO mit Zone oder „YYYY-MM-DD HH:MM" (Berliner Zeit). */
  bis?: string | null;
  vertreterId?: number | null;
  fuer?: number[] | null;
}

/**
 * An, ändern oder aus. Verweigert mit Klartext: Vertreter nicht buchbar, „bis"
 * vorbei oder mehr als 14 Tage voraus. Jede Änderung steht im Verlauf (wer,
 * wann, was) — dazu schreibt die Route eine Zeile ins Chef-Protokoll.
 */
export async function abwesenheitSetzen(ein: SetzenEin, von: string, lauf: Lauf = sqlPool, jetzt: Date = new Date()):
  Promise<{ ok: boolean; fehler?: string; zustand: Abwesenheit; was?: string }> {
  const alt = await abwesenheitLesen(true, lauf);
  const am = jetzt.toISOString();
  if (!ein.an) {
    if (!alt.an) return { ok: true, zustand: alt, was: "war schon aus" };
    const was = `beendet (war bis ${alt.bis ? bisText(alt.bis) : "?"})`;
    const neu: Abwesenheit = { ...alt, an: false, endeteAm: am, endeteWie: "beendet", verlauf: [{ am, von, was }, ...alt.verlauf].slice(0, 20) };
    await speichern(neu, lauf);
    return { ok: true, zustand: neu, was };
  }

  let vertreterId = Number(ein.vertreterId ?? alt.vertreterId ?? 0);
  if (!Number.isInteger(vertreterId) || vertreterId <= 0) {
    const { gruenderAgentId } = await import("../routes/fiaon-gruender-termin");
    vertreterId = await gruenderAgentId();
  }
  const bisRoh = String(ein.bis ?? alt.bis ?? "").trim();
  const bis = bisRoh ? parseBerlinInput(bisRoh.replace(" ", "T")) : null;
  if (!bis || Number.isNaN(bis.getTime())) return { ok: false, fehler: "Bitte sag, bis wann das Team weg ist (Tag und Uhrzeit).", zustand: alt };
  if (bis.getTime() <= jetzt.getTime() + 5 * 60_000) return { ok: false, fehler: `„Bis ${bisText(bis)}“ liegt nicht in der Zukunft.`, zustand: alt };
  if (bis.getTime() > jetzt.getTime() + ABWESENHEIT_HOECHSTENS_TAGE * 86_400_000) {
    return { ok: false, fehler: `Höchstens ${ABWESENHEIT_HOECHSTENS_TAGE} Tage im Voraus — so weit reicht auch der Kalender.`, zustand: alt };
  }
  const pr = await vertreterPruefen(vertreterId, lauf);
  if (!pr.vertreter) return { ok: false, fehler: pr.problem ?? "Dieser Vertreter kann keine Rückrufe führen.", zustand: alt };
  const fuer = Array.from(new Set((ein.fuer ?? alt.fuer ?? []).map(Number)))
    .filter((n) => Number.isInteger(n) && n > 0 && n !== vertreterId).sort((a, b) => a - b);

  const wer = fuer.length ? `für ${fuer.length === 1 ? "ein Teammitglied" : `${fuer.length} Teammitglieder`} (#${fuer.join(", #")})` : "für das ganze Team";
  const war = alt.an && alt.bis && new Date(alt.bis).getTime() > jetzt.getTime();
  const was = `${war ? "geändert" : "an"}: bis ${bisText(bis)} · ${pr.vertreter.name} ruft an · ${wer}`;
  const neu: Abwesenheit = {
    an: true, vertreterId, bis: bis.toISOString(), fuer,
    gesetztVon: von, gesetztAm: am, endeteAm: null, endeteWie: null,
    verlauf: [{ am, von, was }, ...alt.verlauf].slice(0, 20),
  };
  await speichern(neu, lauf);
  return { ok: true, zustand: neu, was };
}

/** Wer als Vertreter taugt — für die Auswahl im Reiter. Testkonten nur, wenn ausdrücklich erlaubt (Gründer, der Chef selbst). */
export async function vertreterKandidaten(erlaubt: number[], lauf: Lauf = sqlPool): Promise<{ id: number; name: string; vorname: string; zeiten: boolean }[]> {
  const ids = erlaubt.filter((n) => Number.isInteger(n) && n > 0);
  const zeilen = (await lauf`
    SELECT a.id, a.name, COALESCE(NULLIF(a.first_name, ''), split_part(a.name, ' ', 1)) AS vorname,
           EXISTS (SELECT 1 FROM fiaon_agent_verfuegbarkeit v WHERE v.agent_id = a.id AND v.aktiv) AS zeiten
      FROM fiaon_agents a
     WHERE COALESCE(a.active, TRUE) AND a.zugang_gesperrt_am IS NULL AND COALESCE(a.rolle, 'agent') <> 'inkasso'
       AND (NOT COALESCE(a.is_test_account, FALSE) OR a.id = ANY(${ids.length ? ids : [0]}))
     ORDER BY (a.id = ANY(${ids.length ? ids : [0]})) DESC, a.id`) as any[];
  return zeilen.map((a) => ({ id: Number(a.id), name: String(a.name), vorname: String(a.vorname || a.name), zeiten: a.zeiten === true }));
}

/** Das Team, das abwesend sein kann: aktiv, nicht gesperrt, kein Testkonto. */
export async function teamFuerAbwesenheit(lauf: Lauf = sqlPool): Promise<{ id: number; vorname: string }[]> {
  const zeilen = (await lauf`
    SELECT a.id, COALESCE(NULLIF(a.first_name, ''), split_part(a.name, ' ', 1)) AS vorname
      FROM fiaon_agents a
     WHERE COALESCE(a.active, TRUE) AND a.zugang_gesperrt_am IS NULL AND NOT COALESCE(a.is_test_account, FALSE)
     ORDER BY a.id`) as any[];
  return zeilen.map((a) => ({ id: Number(a.id), vorname: String(a.vorname) }));
}

/** Warum eine gesetzte Abwesenheit gerade nicht greift (Vertreter unbrauchbar) — für den roten Satz im Reiter. */
export async function abwesenheitProblem(lauf: Lauf = sqlPool): Promise<string | null> {
  const z = await stand(false, lauf);
  return z.wert.an ? z.problem : null;
}
