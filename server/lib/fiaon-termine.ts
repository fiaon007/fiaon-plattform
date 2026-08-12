// ═══════════════════════════════════════════════════════════════════════════
// TERMINE — freie Slots, Buchung, Absage
//
// WOZU
// Ein Kunde, der dreimal nicht ans Telefon geht, ist selten uninteressiert —
// er ist meistens bei der Arbeit. Bisher war die einzige Antwort darauf: noch
// einmal anrufen. Jetzt sucht sich der Kunde selbst eine Uhrzeit aus.
//
// DIE ZWEI ZEITBEGRIFFE, DIE MAN NICHT VERWECHSELN DARF
// `fiaon_termine.beginn` ist ein ZEITPUNKT (timestamptz) — ein Moment auf der
// Weltuhr. `fiaon_agent_verfuegbarkeit.von/bis` ist eine REGEL („montags ab
// neun") und hat deshalb bewusst keine Zone. Die Übersetzung zwischen beiden
// passiert ausschließlich hier, über `berlinZeitpunkt`. Wer sie woanders
// nachbaut, baut den Sommerzeit-Fehler nach, der in fiaon-time.ts oben steht.
//
// BESITZSCHUTZ — der Grund für die Fallunterscheidung in `freieSlots`
// Hat die Person einen Betreuer, sieht sie NUR dessen Slots. Sonst könnte ein
// Kunde sich per Buchung von seinem Betreuer wegbuchen, und die Provision
// hinge plötzlich woanders. Hat sie keinen, sieht sie alle — und die Buchung
// PINNT sie auf den gewählten Agenten, über denselben `betreuung_seit`, den
// Nachschub und Erstverteilung respektieren. Kein zweiter Schutzmechanismus.
// ═══════════════════════════════════════════════════════════════════════════

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { sqlPool } from "./db-pool";
import { absoluteUrl } from "../fiaon-base-url";
import { berlinOffsetMinutes } from "./fiaon-time";

type Lauf = typeof sqlPool;

/** Länge eines Gesprächs-Slots in Minuten (Vertriebsgespräch). */
export const SLOT_MINUTEN = 20;

/**
 * Die Quellen einer Buchung — und wie lange das Gespräch dauert.
 *
 * Ein Startgespräch ist kürzer als ein Vertriebsgespräch: Es erklärt das
 * System, es verkauft nichts. Die Dauer gehört deshalb an die QUELLE und nicht
 * in eine zweite Terminmaschine daneben. Wer eine dritte Gesprächsart braucht
 * (Inkasso), trägt sie hier ein und ist fertig.
 */
export const QUELLEN = {
  onboarding: { minuten: 20, text: "Gespräch mit deinem persönlichen Ansprechpartner" },
  nichterreicht_mail: { minuten: 20, text: "Gespräch mit deinem persönlichen Ansprechpartner" },
  agent_manuell: { minuten: 20, text: "Gespräch mit deinem persönlichen Ansprechpartner" },
  onboarding_call: { minuten: 15, text: "Dein persönliches Startgespräch" },
} as const;

export type TerminQuelle = keyof typeof QUELLEN;

/** Wie lange dauert ein Gespräch dieser Quelle? */
export function dauerFuer(quelle: TerminQuelle | string): number {
  return (QUELLEN as Record<string, { minuten: number }>)[String(quelle)]?.minuten ?? SLOT_MINUTEN;
}

/**
 * Welche Rolle führt Gespräche dieser Quelle?
 *
 * `null` heißt „der zuständige Betreuer bzw. jeder verteilende Mitarbeiter" —
 * das bisherige Verhalten. Startgespräche dagegen führt ausschließlich das
 * Onboarding; ein Vertriebsmitarbeiter darf dort nicht gebucht werden, sonst
 * bekommt der Kunde statt einer Einführung ein Verkaufsgespräch.
 */
export function rolleFuerQuelle(quelle: TerminQuelle | string): string | null {
  return String(quelle) === "onboarding_call" ? "onboarding" : null;
}
/** Frühestens buchbar: so viele Stunden ab jetzt. */
export const VORLAUF_STUNDEN = 2;
/** Längstens buchbar: so viele Tage ab jetzt. */
export const HORIZONT_TAGE = 14;
/** Vorgabe für jeden Agenten ohne eigene Zeiten: Mo–Fr 09:00–18:00. */
export const VORGABE_VON = "09:00";
export const VORGABE_BIS = "18:00";
export const VORGABE_TAGE = [1, 2, 3, 4, 5];

// ───────────────────────────────────────────────────────────────────────────
// Zeitrechnung
// ───────────────────────────────────────────────────────────────────────────

/**
 * Ein Datum („2026-08-12") plus eine Wandzeit in Minuten ab Mitternacht,
 * beides in Europe/Berlin, ergibt einen echten Zeitpunkt.
 *
 * Zwei-Pass wie in `parseBerlinInput`: Der Offset hängt vom Zeitpunkt ab, den
 * wir gerade erst ausrechnen. An den Sommerzeit-Rändern ist der erste Versuch
 * eine Stunde daneben.
 */
export function berlinZeitpunkt(datumISO: string, minutenAbMitternacht: number): Date {
  const [y, m, d] = datumISO.split("-").map(Number);
  const wall = Date.UTC(y, m - 1, d, 0, minutenAbMitternacht, 0);
  const off1 = berlinOffsetMinutes(new Date(wall));
  let utc = wall - off1 * 60000;
  const off2 = berlinOffsetMinutes(new Date(utc));
  if (off2 !== off1) utc = wall - off2 * 60000;
  return new Date(utc);
}

/** Datum in Berlin als „YYYY-MM-DD". */
export function berlinDatum(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(at);
}

/** Wochentag nach ISO in Berlin: 1 = Montag … 7 = Sonntag. */
export function berlinWochentag(datumISO: string): number {
  const [y, m, d] = datumISO.split("-").map(Number);
  const wt = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wt === 0 ? 7 : wt;
}

/** „HH:MM" → Minuten ab Mitternacht. Unlesbares ergibt null. */
export function zeitZuMinuten(hhmm: unknown): number | null {
  const m = String(hhmm ?? "").match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** Minuten ab Mitternacht → „HH:MM". */
export function minutenZuZeit(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/** Uhrzeit eines Zeitpunkts in Berlin, „HH:MM". */
export function berlinUhrzeit(at: Date | string): string {
  const d = typeof at === "string" ? new Date(at) : at;
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit",
  }).format(d);
}

/** Datum eines Zeitpunkts als „TT.MM.JJJJ" in Berlin. */
export function berlinDatumText(at: Date | string): string {
  const d = typeof at === "string" ? new Date(at) : at;
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric",
  }).format(d);
}

// ───────────────────────────────────────────────────────────────────────────
// Signierte Links — Muster der Rechnungs-Links (server/fiaon-invoice.ts)
// ───────────────────────────────────────────────────────────────────────────

function geheimnis(): string {
  return process.env.SESSION_SECRET || process.env.MAKE_WEBHOOK_URL || "fiaon-dev-invoice-secret";
}

/**
 * Buchungs-Token je Person: `personId.exp.signatur`.
 *
 * Kein Login, kein Ratespiel: Ohne den HMAC ist der Link wertlos. Der Ablauf
 * ist großzügig (30 Tage), weil der Link in einer Mail steht, die jemand auch
 * nächste Woche noch öffnet — die Buchung selbst ist ohnehin auf 14 Tage
 * begrenzt, und ein abgelaufener Link führt zu einer freundlichen Seite,
 * nicht zu einer Fehlermeldung.
 */
export function terminTokenErzeugen(personId: number, ttlMs = 30 * 24 * 60 * 60 * 1000): string {
  const exp = Date.now() + ttlMs;
  const sig = createHmac("sha256", geheimnis()).update(`termin.${personId}.${exp}`).digest("hex").slice(0, 32);
  return `${personId}.${exp}.${sig}`;
}

/** Prüft ein Buchungs-Token. Liefert die Person oder null. */
export function terminTokenPruefen(token: unknown): { personId: number; abgelaufen: boolean } | null {
  const teile = String(token ?? "").split(".");
  if (teile.length !== 3) return null;
  const personId = Number(teile[0]);
  const exp = Number(teile[1]);
  if (!Number.isInteger(personId) || personId <= 0 || !exp) return null;
  const erwartet = createHmac("sha256", geheimnis()).update(`termin.${personId}.${exp}`).digest("hex").slice(0, 32);
  const a = Buffer.from(erwartet);
  const b = Buffer.from(teile[2]);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { personId, abgelaufen: exp < Date.now() };
}

/**
 * Der vollständige Buchungslink, wie er in Mail und Zwischenablage landet.
 *
 * Die Quelle steht im Pfad, nicht im Token: Sie ist keine Berechtigung,
 * sondern die Auskunft, welche Art Gespräch gebucht wird (15 Minuten
 * Startgespräch beim Onboarding, 20 Minuten beim Vertrieb).
 */
export function terminLink(personId: number, quelle: TerminQuelle | string = "nichterreicht_mail"): string {
  const t = terminTokenErzeugen(personId);
  return absoluteUrl(quelle === "onboarding_call" ? `/termin/${t}?art=start` : `/termin/${t}`);
}

/** Der Storno-Link zu einem Termin. */
export function stornoLink(stornoToken: string): string {
  return absoluteUrl(`/termin/absagen/${stornoToken}`);
}

// ───────────────────────────────────────────────────────────────────────────
// Verfügbarkeit
// ───────────────────────────────────────────────────────────────────────────

export interface Zeitfenster { wochentag: number; von: string; bis: string; aktiv: boolean }

/**
 * Die Zeiten eines Agenten. Wer nichts hinterlegt hat, bekommt die Vorgabe —
 * NICHT „gar nicht buchbar". Ein Agent, der seine Zeiten nie öffnet, wäre
 * sonst für Kunden unsichtbar, ohne dass es jemandem auffällt.
 */
export async function verfuegbarkeitVon(agentId: number, lauf: Lauf = sqlPool): Promise<Zeitfenster[]> {
  const rows = (await lauf`
    SELECT wochentag, to_char(von, 'HH24:MI') AS von, to_char(bis, 'HH24:MI') AS bis, aktiv
    FROM fiaon_agent_verfuegbarkeit WHERE agent_id = ${agentId}
    ORDER BY wochentag, von
  `) as any[];
  if (rows.length === 0) {
    return VORGABE_TAGE.map((wochentag) => ({ wochentag, von: VORGABE_VON, bis: VORGABE_BIS, aktiv: true }));
  }
  return rows.map((r) => ({ wochentag: Number(r.wochentag), von: r.von, bis: r.bis, aktiv: !!r.aktiv }));
}

/**
 * Setzt die Zeiten eines Agenten neu (ersetzt alles Bisherige).
 *
 * Öffnet BEWUSST keine eigene Transaktion: Der Aufrufer bestimmt die Klammer.
 * Ein `lauf.begin` hier würde jeden Aufruf aus einer laufenden Transaktion
 * heraus zerbrechen — genau das ist im Prüfstand passiert. Wer Atomarität
 * braucht (die Route für das Team-Setzen), legt sie außen herum.
 */
export async function verfuegbarkeitSetzen(
  agentId: number, fenster: Zeitfenster[], lauf: Lauf = sqlPool,
): Promise<void> {
  const sauber = fenster.filter((f) => {
    const von = zeitZuMinuten(f.von);
    const bis = zeitZuMinuten(f.bis);
    return von != null && bis != null && bis > von && f.wochentag >= 1 && f.wochentag <= 7;
  });
  await lauf`DELETE FROM fiaon_agent_verfuegbarkeit WHERE agent_id = ${agentId}`;
  for (const f of sauber) {
    await lauf`
      INSERT INTO fiaon_agent_verfuegbarkeit (agent_id, wochentag, von, bis, aktiv)
      VALUES (${agentId}, ${f.wochentag}, ${f.von}::time, ${f.bis}::time, ${f.aktiv !== false})
      ON CONFLICT (agent_id, wochentag, von) DO UPDATE
        SET bis = EXCLUDED.bis, aktiv = EXCLUDED.aktiv, updated_at = NOW()
    `;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Freie Slots
// ───────────────────────────────────────────────────────────────────────────

export interface Slot {
  /** Der Zeitpunkt als ISO-String — eindeutig, zonenfest. */
  beginn: string;
  /** „2026-08-12" in Berlin, zum Gruppieren nach Tagen. */
  datum: string;
  /** „14:20" in Berlin. */
  uhrzeit: string;
  agentId: number;
  agentVorname: string;
}

export interface SlotAuskunft {
  slots: Slot[];
  /** Der zuständige Agent, falls es einen gibt — dann sind alle Slots seine. */
  betreuer: { id: number; vorname: string } | null;
}

/**
 * Freie Slots für eine Person, gruppierbar nach Tag.
 *
 * Belegt ist ein Slot, wenn dort schon ein Termin steht (`gebucht`, `erledigt`
 * oder `verpasst` — ein abgesagter gibt die Zeit wieder frei) ODER wenn er
 * innerhalb des Vorlaufs liegt.
 */
export async function freieSlots(
  personId: number, lauf: Lauf = sqlPool, quelle: TerminQuelle | string = "nichterreicht_mail",
): Promise<SlotAuskunft> {
  const takt = dauerFuer(quelle);
  const nurRolle = rolleFuerQuelle(quelle);
  const [person] = (await lauf`
    SELECT p.id, p.assigned_agent_id,
           a.first_name AS agent_vorname, a.name AS agent_name, a.active AS agent_aktiv
    FROM fiaon_persons p
    LEFT JOIN fiaon_agents a ON a.id = p.assigned_agent_id
    WHERE p.id = ${personId} AND p.merged_into_person_id IS NULL
  `) as any[];
  if (!person) return { slots: [], betreuer: null };

  // Wer darf angeboten werden? Bei Besitz: nur der Betreuer. Sonst: alle, die
  // im Verteilbetrieb stehen — Testkonten ausdrücklich nicht, sonst bucht ein
  // echter Kunde ein Gespräch mit einem Konto, hinter dem niemand sitzt.
  // Verlangt die Quelle eine bestimmte Rolle (Startgespräch → Onboarding), zählt
  // NUR sie. Der Betreuer des Kunden ist dann unerheblich: Ein Startgespräch
  // führt das Onboarding, auch wenn der Kunde längst einen Betreuer hat.
  const betreuerAktiv = !nurRolle && person.assigned_agent_id && person.agent_aktiv;
  const agenten = nurRolle
    ? ((await lauf`
        SELECT id, COALESCE(NULLIF(first_name, ''), name) AS vorname
        FROM fiaon_agents
        WHERE active AND NOT is_test_account AND rolle = ${nurRolle}
        ORDER BY id
      `) as any[]).map((a) => ({ id: Number(a.id), vorname: String(a.vorname) }))
    : betreuerAktiv
      ? [{ id: Number(person.assigned_agent_id), vorname: String(person.agent_vorname || person.agent_name || "dein Ansprechpartner") }]
      : ((await lauf`
          SELECT id, COALESCE(NULLIF(first_name, ''), name) AS vorname
          FROM fiaon_agents
          WHERE active AND distribution_active AND NOT is_test_account
            -- Nur Vertrieb: Ein Kunde, der einen Termin bucht, will einen
            -- Verkäufer sprechen. Dass ein Inkasso-Konto in dieser Liste stand,
            -- war dieselbe Lücke wie in der Lead-Zuteilung — die Rolle wurde
            -- nicht geprüft.
            AND COALESCE(rolle, 'agent') IN ('agent', 'vertriebsleiter')
          ORDER BY id
        `) as any[]).map((a) => ({ id: Number(a.id), vorname: String(a.vorname) }));
  if (agenten.length === 0) return { slots: [], betreuer: null };

  const frühestens = new Date(Date.now() + VORLAUF_STUNDEN * 3600_000);
  const spätestens = new Date(Date.now() + HORIZONT_TAGE * 86_400_000);

  const belegt = new Set(
    ((await lauf`
      SELECT agent_id, beginn FROM fiaon_termine
      WHERE agent_id = ANY(${agenten.map((a) => a.id)})
        AND status IN ('gebucht', 'erledigt', 'verpasst')
        AND beginn BETWEEN ${frühestens} AND ${spätestens}
    `) as any[]).map((t) => `${t.agent_id}@${new Date(t.beginn).toISOString()}`),
  );

  const slots: Slot[] = [];
  for (const agent of agenten) {
    const fenster = (await verfuegbarkeitVon(agent.id, lauf)).filter((f) => f.aktiv);
    for (let tag = 0; tag <= HORIZONT_TAGE; tag++) {
      const datum = berlinDatum(new Date(Date.now() + tag * 86_400_000));
      const wochentag = berlinWochentag(datum);
      for (const f of fenster.filter((x) => x.wochentag === wochentag)) {
        const von = zeitZuMinuten(f.von);
        const bis = zeitZuMinuten(f.bis);
        if (von == null || bis == null) continue;
        for (let min = von; min + takt <= bis; min += takt) {
          const beginn = berlinZeitpunkt(datum, min);
          if (beginn < frühestens || beginn > spätestens) continue;
          if (belegt.has(`${agent.id}@${beginn.toISOString()}`)) continue;
          slots.push({
            beginn: beginn.toISOString(),
            datum: berlinDatum(beginn),
            uhrzeit: berlinUhrzeit(beginn),
            agentId: agent.id,
            agentVorname: agent.vorname,
          });
        }
      }
    }
  }

  slots.sort((a, b) => a.beginn.localeCompare(b.beginn) || a.agentId - b.agentId);

  // ── EINE UHRZEIT, EIN KNOPF ────────────────────────────────────────────
  // Ohne festen Betreuer sind mehrere Agenten gleichzeitig frei. Ungefiltert
  // stünde „09:00" viermal untereinander — bei vier Agenten, 27 Slots und 14
  // Tagen sind das rund 1.500 Knöpfe, auf einem Telefon in einer Spalte.
  // Gesehen im Screenshot vom 08.08.2026; unbenutzbar.
  //
  // Ein Kunde wählt eine ZEIT, keine Person — er kennt keinen der Namen. Also
  // wird je Zeitpunkt genau ein Slot angeboten, und zwar der des Agenten mit
  // den wenigsten anstehenden Terminen. Das verteilt die Last von selbst und
  // bleibt trotzdem deterministisch (bei Gleichstand die kleinere Kennung).
  if ((!betreuerAktiv || nurRolle) && slots.length > 0) {
    const last = new Map<number, number>();
    for (const a of agenten) last.set(a.id, 0);
    for (const t of (await lauf`
      SELECT agent_id, COUNT(*)::int AS n FROM fiaon_termine
      WHERE status = 'gebucht' AND beginn > NOW() AND agent_id = ANY(${agenten.map((a) => a.id)})
      GROUP BY agent_id
    `) as any[]) last.set(Number(t.agent_id), Number(t.n));

    // Die Last MITZÄHLEN, nicht einmal am Anfang messen: Sonst hat zu Beginn
    // jeder null Termine, der Agent mit der kleinsten Kennung gewinnt jeden
    // Vergleich — und bekäme alle 378 Slots. Wer einen Slot zugeteilt bekommt,
    // zählt sofort hoch; dadurch wandern aufeinanderfolgende Zeiten reihum.
    const jeZeit = new Map<string, Slot>();
    const zeiten = Array.from(new Set(slots.map((s) => s.beginn))).sort();
    for (const zeit of zeiten) {
      const frei = slots.filter((s) => s.beginn === zeit);
      let beste = frei[0];
      for (const k of frei) {
        const a = last.get(k.agentId) ?? 0;
        const b = last.get(beste.agentId) ?? 0;
        if (a < b || (a === b && k.agentId < beste.agentId)) beste = k;
      }
      last.set(beste.agentId, (last.get(beste.agentId) ?? 0) + 1);
      jeZeit.set(zeit, beste);
    }
    const eindeutig = Array.from(jeZeit.values()).sort((a, b) => a.beginn.localeCompare(b.beginn));
    return { slots: eindeutig, betreuer: null };
  }

  return {
    slots,
    betreuer: betreuerAktiv
      ? { id: Number(person.assigned_agent_id), vorname: String(person.agent_vorname || person.agent_name || "") }
      : null,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Buchen
// ───────────────────────────────────────────────────────────────────────────

export class TerminFehler extends Error {
  constructor(public code: string, nachricht: string) {
    super(nachricht);
    this.name = "TerminFehler";
  }
}

export interface Buchung {
  id: number;
  personId: number;
  agentId: number;
  agentVorname: string;
  beginn: string;
  datumText: string;
  uhrzeit: string;
  stornoToken: string;
}

/**
 * Bucht einen Slot. Die Doppelbuchungs-Sperre ist der eindeutige Index in der
 * Datenbank, nicht die Prüfung hier — zwei Anfragen in derselben Millisekunde
 * kommen beide durch jede Prüfung, aber nur eine durch den Index.
 */
export async function terminBuchen(
  eingabe: {
    personId: number;
    agentId: number;
    beginn: string | Date;
    quelle: TerminQuelle;
  },
  lauf: Lauf = sqlPool,
): Promise<Buchung> {
  const beginn = typeof eingabe.beginn === "string" ? new Date(eingabe.beginn) : eingabe.beginn;
  if (isNaN(beginn.getTime())) throw new TerminFehler("zeit_unlesbar", "Der gewählte Zeitpunkt ist unlesbar.");

  // Vorlauf und Horizont. Beim Agenten selbst gilt der Vorlauf nicht — er darf
  // ein Gespräch für „in einer halben Stunde" eintragen, wenn er es gerade
  // telefonisch vereinbart hat.
  const jetzt = Date.now();
  if (eingabe.quelle !== "agent_manuell" && beginn.getTime() < jetzt + VORLAUF_STUNDEN * 3600_000) {
    throw new TerminFehler("zu_frueh", `Termine sind frühestens in ${VORLAUF_STUNDEN} Stunden buchbar.`);
  }
  if (beginn.getTime() <= jetzt) {
    throw new TerminFehler("vergangenheit", "Der Termin liegt in der Vergangenheit.");
  }
  if (beginn.getTime() > jetzt + HORIZONT_TAGE * 86_400_000) {
    throw new TerminFehler("zu_spaet", `Termine sind höchstens ${HORIZONT_TAGE} Tage im Voraus buchbar.`);
  }

  const takt = dauerFuer(eingabe.quelle);
  const nurRolle = rolleFuerQuelle(eingabe.quelle);
  const [agent] = (await lauf`
    SELECT id, COALESCE(NULLIF(first_name, ''), name) AS vorname, active, rolle
    FROM fiaon_agents WHERE id = ${eingabe.agentId}
  `) as any[];
  if (!agent || !agent.active) throw new TerminFehler("agent_unbekannt", "Dieser Ansprechpartner ist nicht verfügbar.");
  // Ein Startgespräch bei jemandem ohne Onboarding-Rolle wäre kein
  // Startgespräch. Die Prüfung steht hier und nicht nur in der Slot-Anzeige:
  // Wer die Anfrage selbst baut, kommt sonst an der Anzeige vorbei.
  if (nurRolle && String(agent.rolle || "agent") !== nurRolle) {
    throw new TerminFehler("falsche_rolle", "Diese Person führt keine Startgespräche.");
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DAS FORDERUNGSMANAGEMENT BEKOMMT KEINE TERMINE
  //
  // ── DER BEFUND (11.08.2026) ───────────────────────────────────────────────
  // Der Vorgesetzte: „Die Mitarbeiter aus dem Inkasso, warum haben die
  // Termine? Die können keine Termine bekommen, da sie ja nur die Leute
  // anrufen, die ihre Abo-Rate nicht bezahlt haben!"
  //
  // Gemessen: Hans-Jürgen Gerhold hatte zwei Termine der Quelle
  // „nichterreicht_mail" — Vertriebs-Rückrufe.
  //
  // Die Prüfung oben griff nicht: `rolleFuerQuelle` fordert nur beim
  // Startgespräch eine Rolle. Für alle anderen Quellen war `nurRolle` null,
  // und dann prüfte niemand, WER da gebucht wird.
  //
  // ── WARUM DAS FORDERUNGSMANAGEMENT KEINE TERMINE HAT ──────────────────────
  // Es arbeitet eine Liste ab, die sich nach Dringlichkeit ordnet: die älteste
  // offene Rate zuerst. Ein Termin um 14:30 würde diese Reihenfolge umgehen.
  //
  // Was es stattdessen gibt: die Wiedervorlage an der Rate
  // (`inkasso_wiedervorlage`). Sie erscheint am gesetzten Tag von selbst in
  // der Arbeitsliste — ohne Uhrzeit, ohne zweites System.
  // ══════════════════════════════════════════════════════════════════════════
  if (String(agent.rolle || "agent") === "inkasso") {
    throw new TerminFehler(
      "falsche_rolle",
      "Das Forderungsmanagement nimmt keine Termine an. Für einen späteren Anruf "
        + "setzt man dort eine Wiedervorlage an der Rate.",
    );
  }

  // Der Slot muss im Raster liegen. Ohne diese Prüfung ließe sich über einen
  // selbst gebauten Aufruf jede beliebige Minute belegen, und der eindeutige
  // Index (agent, beginn) verhindert dann keine Überschneidung mehr.
  const datum = berlinDatum(beginn);
  const fenster = (await verfuegbarkeitVon(eingabe.agentId, lauf)).filter(
    (f) => f.aktiv && f.wochentag === berlinWochentag(datum),
  );
  const imRaster = fenster.some((f) => {
    const von = zeitZuMinuten(f.von);
    const bis = zeitZuMinuten(f.bis);
    if (von == null || bis == null) return false;
    for (let min = von; min + takt <= bis; min += takt) {
      if (berlinZeitpunkt(datum, min).getTime() === beginn.getTime()) return true;
    }
    return false;
  });
  if (!imRaster) throw new TerminFehler("kein_slot", "Zu dieser Zeit werden keine Gespräche angeboten.");

  const stornoToken = randomBytes(24).toString("hex");
  let gebucht: any;
  try {
    [gebucht] = (await lauf`
      INSERT INTO fiaon_termine (person_id, agent_id, beginn, dauer_min, status, quelle, storno_token)
      VALUES (${eingabe.personId}, ${eingabe.agentId}, ${beginn}, ${takt}, 'gebucht',
              ${eingabe.quelle}, ${stornoToken})
      RETURNING id
    `) as any[];
  } catch (err: any) {
    if (String(err?.code) === "23505") {
      throw new TerminFehler("belegt", "Dieser Termin wurde gerade vergeben. Bitte wählen Sie einen anderen.");
    }
    throw err;
  }

  return {
    id: Number(gebucht.id),
    personId: eingabe.personId,
    agentId: eingabe.agentId,
    agentVorname: String(agent.vorname),
    beginn: beginn.toISOString(),
    datumText: berlinDatumText(beginn),
    uhrzeit: berlinUhrzeit(beginn),
    stornoToken,
  };
}

/**
 * Nachbehandlung einer Buchung: Zähler zurück, Ruhe-Pool verlassen,
 * Wiedervorlage auf den Termintag, Zuständigkeit pinnen.
 *
 * Bewusst getrennt von `terminBuchen`, damit der Prüfstand die reine
 * Slot-Mechanik ohne Nebenwirkungen prüfen kann.
 */
export async function buchungAnwenden(buchung: Buchung, lauf: Lauf = sqlPool): Promise<void> {
  const [person] = (await lauf`
    SELECT id, assigned_agent_id, betreuung_seit FROM fiaon_persons WHERE id = ${buchung.personId}
  `) as any[];
  if (!person) return;

  // Ein gebuchter Termin ist das Gegenteil von „nicht erreichbar": Der Kunde
  // hat sich gemeldet. Zähler auf null, Ruhe-Pool verlassen.
  await lauf`
    UPDATE fiaon_persons SET
      unreachable_count = 0,
      ruhe_seit = NULL,
      follow_up_date = ${berlinDatum(new Date(buchung.beginn))}::date,
      updated_at = NOW()
    WHERE id = ${buchung.personId}
  `;

  // Ohne Betreuer: Die Buchung pinnt. Über denselben `betreuung_seit`, den
  // Nachschub, Erstverteilung und Auto-Assign respektieren — kein zweiter
  // Schutzmechanismus, der irgendwann auseinanderläuft.
  if (!person.assigned_agent_id) {
    await lauf`
      UPDATE fiaon_persons SET
        assigned_agent_id = ${buchung.agentId},
        assigned_at = COALESCE(assigned_at, NOW()),
        betreuung_seit = COALESCE(betreuung_seit, NOW())
      WHERE id = ${buchung.personId} AND assigned_agent_id IS NULL
    `;
  }

  const [ref] = (await lauf`
    SELECT ref FROM fiaon_applications
    WHERE person_id = ${buchung.personId} AND merged_into IS NULL AND archived_at IS NULL
    ORDER BY created_at DESC LIMIT 1
  `) as any[];
  if (ref) {
    await lauf`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note, created_at)
      VALUES (${ref.ref}, NULL, 'System', 'system',
              ${`Termin gebucht: ${buchung.datumText} um ${buchung.uhrzeit} Uhr mit ${buchung.agentVorname}. Der Kunde hat die Zeit selbst gewählt.`},
              NOW())
    `.catch(() => {});
  }
}

/** Sagt einen Termin ab. Der Slot wird dadurch wieder frei. */
export async function terminAbsagen(
  stornoToken: string, wer: "kunde" | "agent", lauf: Lauf = sqlPool,
): Promise<{ ok: boolean; termin?: any }> {
  const [termin] = (await lauf`
    UPDATE fiaon_termine SET status = 'abgesagt', abgesagt_am = NOW(), updated_at = NOW()
    WHERE storno_token = ${stornoToken} AND status = 'gebucht'
    RETURNING id, person_id, agent_id, beginn
  `) as any[];
  if (!termin) return { ok: false };

  const [ref] = (await lauf`
    SELECT ref FROM fiaon_applications
    WHERE person_id = ${termin.person_id} AND merged_into IS NULL AND archived_at IS NULL
    ORDER BY created_at DESC LIMIT 1
  `) as any[];
  if (ref) {
    await lauf`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note, created_at)
      VALUES (${ref.ref}, NULL, 'System', 'system',
              ${`Termin abgesagt (${wer === "kunde" ? "vom Kunden" : "vom Betreuer"}): ${berlinDatumText(termin.beginn)} um ${berlinUhrzeit(termin.beginn)} Uhr.`},
              NOW())
    `.catch(() => {});
  }
  return { ok: true, termin };
}
