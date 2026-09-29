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
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { rohSlots, verfuegbarkeitVon, type Slot } from "./fiaon-termine";
import { parseBerlinInput } from "./fiaon-time";

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

export interface Vertreter { id: number; vorname: string; name: string; anrufName: string }
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
    SELECT id, name, COALESCE(NULLIF(first_name, ''), split_part(name, ' ', 1)) AS vorname,
           COALESCE(active, TRUE) AS aktiv, zugang_gesperrt_am, COALESCE(rolle, 'agent') AS rolle
      FROM fiaon_agents WHERE id = ${agentId}`) as any[];
  if (!a) return { vertreter: null, problem: `Konto #${agentId} gibt es nicht.` };
  if (!a.aktiv) return { vertreter: null, problem: `${a.name} ist nicht aktiv.` };
  if (a.zugang_gesperrt_am) return { vertreter: null, problem: `${a.name} ist gesperrt.` };
  if (a.rolle === "inkasso") return { vertreter: null, problem: `${a.name} ist im Forderungsmanagement — dort gibt es keine Rückruftermine.` };
  const zeiten = (await verfuegbarkeitVon(Number(a.id), lauf)).filter((z) => z.aktiv);
  if (!zeiten.length) return { vertreter: null, problem: `${a.name} hat keine Arbeitszeiten eingetragen — ohne Zeiten kann Mara nichts buchen (Agentenportal → Verfügbarkeit).` };
  const vorname = String(a.vorname || "").trim() || String(a.name);
  // anrufName = der Vorname, wie bei jedem Teammitglied („Nikita ruft Sie an"). Die Sätze in
  // fiaon-whatsapp-mara.ts nehmen vom Betreuer das erste Wort — ein „Herr Schwarzott" würde dort
  // zu „Herr". Ein eigener Anrufname (Frage F3) braucht erst die Anrede am Konto.
  return { vertreter: { id: Number(a.id), vorname, name: String(a.name), anrufName: vorname }, problem: null };
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
 * sonst der Vorname des Gebuchten (B2).
 */
export async function anruferFuer(agentId: number, beginn: Date | string, vorname: string, lauf: Lauf = sqlPool): Promise<string> {
  try {
    const ab = await abwesenheitJetzt(lauf);
    return istAbwesend(ab, agentId, beginn) ? ab!.vertreter.anrufName : vorname;
  } catch {
    return vorname;
  }
}

export interface VertretungFuerPerson {
  ab: AktiveAbwesenheit;
  /** Der eingetragene Betreuer — null, wenn es keinen gibt. */
  betreuer: { id: number; vorname: string; name: string } | null;
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
    SELECT a.id, a.name, COALESCE(NULLIF(a.first_name, ''), split_part(a.name, ' ', 1)) AS vorname,
           COALESCE(a.active, TRUE) AS aktiv, a.zugang_gesperrt_am, COALESCE(a.is_test_account, FALSE) AS test,
           COALESCE(a.rolle, 'agent') AS rolle
      FROM fiaon_persons p LEFT JOIN fiaon_agents a ON a.id = p.assigned_agent_id
     WHERE p.id = ${personId} AND p.merged_into_person_id IS NULL`) as any[];
  if (!p?.id) return ab.fuer.length ? null : { ab, betreuer: null, betreuerBuchbar: false };
  const betreuer = { id: Number(p.id), vorname: String(p.vorname || p.name), name: String(p.name) };
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
export async function freiePlaetzeVertreter(ab: AktiveAbwesenheit, vorlaufMin: number, lauf: Lauf = sqlPool, opts: { nachBis?: boolean } = {}): Promise<Slot[]> {
  const roh = await rohSlots([{ id: ab.vertreter.id, vorname: ab.vertreter.anrufName }], 20, lauf, vorlaufMin * 60_000);
  const belegt = await belegtFuerVertreter(ab, lauf);
  return roh.filter((s) => {
    const von = new Date(s.beginn).getTime();
    if (opts.nachBis ? von < ab.bis.getTime() : von >= ab.bis.getTime()) return false;
    const bis = von + 20 * 60_000;
    return !belegt.some((b) => b.von < bis && b.bis > von);
  });
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
