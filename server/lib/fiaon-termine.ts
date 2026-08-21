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

// ═══════════════════════════════════════════════════════════════════════════
// EIN GATE OHNE SLOTS IST EINE VERSCHLOSSENE TÜR
//
// ── DER BEFUND (20.08.2026) ────────────────────────────────────────────────
// Vor der Bestands-Migration gemessen: Die Rollen im Haus sind
// vertriebsleiter (2), agent (2), inkasso (2). **Kein einziger
// Onboarding-Mitarbeiter.** Und `freieSlots(..., "onboarding_call")` filtert
// nach genau dieser Rolle — es kamen NULL Slots heraus.
//
// Hätte ich die 364 bezahlten Kunden auf „wartet_auf_onboarding" gesetzt,
// stünden sie beim nächsten Login vor einem Pflicht-Gate, das keine Termine
// anbietet: buchen unmöglich, „Später" abgeschafft, nur noch Abmelden. 364
// zahlende Menschen ausgesperrt — genau der Vorfall, den AGENTS.md unter
// „349 Menschen vor einer verschlossenen Tür" beschreibt.
//
// ── DIE LÖSUNG IST TECHNISCH, NICHT PERSONELL ──────────────────────────────
// Man könnte sagen: „Der Betreiber soll einen Onboarding-Mitarbeiter anlegen."
// Richtig — aber solange er es nicht getan hat, darf das System nicht kaputt
// sein. Ein Startgespräch, das ein Vertriebsmitarbeiter führt, ist ein
// geführtes Startgespräch; ein Gate ohne Slots ist ein Ausfall.
//
// Deshalb: Gibt es keine freie Onboarding-Zeit, fallen die Slots auf Vertrieb
// und Leitung zurück. Die Rückfall-Entscheidung wird protokolliert, damit sie
// nicht unbemerkt zum Dauerzustand wird.
//
// ═══════════════════════════════════════════════════════════════════════════
// DER RÜCKFALL FRAGTE DAS FALSCHE (21.08.2026)
//
// ── DIE MELDUNG (Betrieb) ─────────────────────────────────────────────────
// „Kunden buchen ein Startgespräch, der Termin landet beim Vertrieb."
//
// ── GEMESSEN (scripts/mess-startgespraech-zuordnung.ts) ───────────────────
// 15 Startgespräche (quelle `onboarding_call`) gingen an Angelique Laukert,
// Rolle `agent` — angelegt zwischen dem 19.08. 11:08 und dem 20.08. 10:22.
// Alle 15 waren echte Kundenbuchungen (`akteur = kunde`). Danach kein
// einziger mehr: Seit dem 20.08. 10:22 gehen alle an Rifka oder Viktoria.
//
// ── DIE URSACHE ───────────────────────────────────────────────────────────
// Diese Funktion fragte: „Gibt es überhaupt ein aktives Onboarding-KONTO?"
// Das erste (Rifka) entstand am 19.08. um 12:29 — davor war der Rückfall
// zwangsläufig, und er war auch richtig: Ohne Onboarding muss jemand das
// Gespräch führen.
//
// Falsch war er trotzdem in zwei Punkten, und die bleiben auch mit besetzter
// Rolle bestehen:
//
//   1. **Er fragte nach dem KONTO, nicht nach der ZEIT.** Ein Onboarding, das
//      besetzt ist — Urlaub, krank, Kalender voll —, hat ein Konto und keinen
//      freien Slot. Dann liefert `freieSlots` null Zeiten, der Kunde sieht
//      eine leere Terminwahl, und niemand fällt zurück. Genau die
//      verschlossene Tür, die diese Wand verhindern sollte.
//   2. **Der Rückfall war unsichtbar.** Am Termin stand nichts, in der
//      Bestätigungsmail stand nichts, in der Liste des Betreibers stand
//      nichts. Ein Startgespräch beim Vertrieb sah aus wie eines beim
//      Onboarding — und deshalb hat es niemand bemerkt, bis Kunden sich
//      wunderten.
//
// ── DIE REGEL, DIE JETZT GILT ─────────────────────────────────────────────
// Ein Startgespräch geht IMMER ans Onboarding, solange dort eine Zeit frei
// ist. Erst bei NULL freien Onboarding-Zeiten treten Vertrieb und Leitung ein
// — und dann trägt der Termin die Marke „Vertretung", sichtbar in Kalender,
// Liste und Bestätigung.
//
// Die Entscheidung fällt an EINER Stelle (`rollenFuerBuchung`) und wird von
// der Anzeige UND der Annahme benutzt. Zwei Regeln für dieselbe Frage haben
// am 19.08.2026 schon einmal 213 Kunden abgewiesen, denen die Anzeige eine
// Zeile vorher Zeiten angeboten hatte.
// ═══════════════════════════════════════════════════════════════════════════

let rueckfallGemeldet = false;

export interface RollenEntscheid {
  /** Wer darf angeboten/gebucht werden? `null` = keine Rollen-Einschränkung. */
  rollen: string[] | null;
  /** Greift der Rückfall auf Vertrieb und Leitung? Dann ist es eine Vertretung. */
  rueckfall: boolean;
  /** Warum — für Protokoll und Anzeige. */
  grund: "rolle_frei" | "kein_konto" | "keine_freie_zeit" | "ohne_rolle";
}

/**
 * Welche Rollen dürfen Slots für diese Quelle stellen?
 *
 * DIE Entscheidung — Anzeige und Annahme rufen dieselbe Funktion auf.
 *
 * `personId` wird für die Slot-Prüfung gebraucht: „frei" heißt frei für DIESEN
 * Kunden, im Vorlauf- und Horizontfenster.
 */
export async function rollenFuerBuchung(
  quelle: TerminQuelle | string, personId: number, lauf: Lauf = sqlPool,
): Promise<RollenEntscheid> {
  const soll = rolleFuerQuelle(quelle);
  if (!soll) return { rollen: null, rueckfall: false, grund: "ohne_rolle" };

  const agenten = await agentenMitRolle([soll], lauf);
  if (agenten.length === 0) {
    if (!rueckfallGemeldet) {
      console.warn(`[TERMINE] Kein aktiver Mitarbeiter mit der Rolle „${soll}" — `
        + "Startgespräche laufen als VERTRETUNG über Vertrieb und Leitung.");
      rueckfallGemeldet = true;
    }
    return { rollen: ["agent", "vertriebsleiter"], rueckfall: true, grund: "kein_konto" };
  }

  // Die eigentliche Frage: Ist dort noch eine Zeit frei? Ein Konto im Urlaub
  // hat keine, und dann ist die Terminwahl leer statt vertreten.
  const roh = await rohSlots(agenten, dauerFuer(quelle), lauf);
  if (roh.length > 0) return { rollen: [soll], rueckfall: false, grund: "rolle_frei" };

  console.warn(`[TERMINE] Onboarding hat in den nächsten ${HORIZONT_TAGE} Tagen `
    + `keine freie Zeit (${agenten.length} Konten) — Startgespräch läuft als VERTRETUNG `
    + "über Vertrieb und Leitung. Person " + String(personId) + ".");
  return { rollen: ["agent", "vertriebsleiter"], rueckfall: true, grund: "keine_freie_zeit" };
}

/**
 * Alte Signatur, damit bestehende Aufrufer nicht ins Leere laufen.
 *
 * Sie kann die Slot-Frage nicht stellen (ihr fehlt die Person) und beantwortet
 * deshalb nur die Konto-Frage. Neue Aufrufer nehmen `rollenFuerBuchung`.
 */
export async function rollenMitRueckfall(
  quelle: TerminQuelle | string, lauf: Lauf = sqlPool,
): Promise<{ rollen: string[] | null; rueckfall: boolean }> {
  const soll = rolleFuerQuelle(quelle);
  if (!soll) return { rollen: null, rueckfall: false };
  const agenten = await agentenMitRolle([soll], lauf);
  return agenten.length > 0
    ? { rollen: [soll], rueckfall: false }
    : { rollen: ["agent", "vertriebsleiter"], rueckfall: true };
}

/** Die aktiven, echten Mitarbeiter dieser Rollen — Testkonten nie. */
async function agentenMitRolle(
  rollen: string[], lauf: Lauf = sqlPool,
): Promise<{ id: number; vorname: string }[]> {
  return ((await lauf`
    SELECT id, COALESCE(NULLIF(first_name, ''), name) AS vorname
    FROM fiaon_agents
    WHERE active AND NOT COALESCE(is_test_account, FALSE)
      AND COALESCE(rolle, 'agent') = ANY(${rollen})
    ORDER BY id
  `) as any[]).map((a) => ({ id: Number(a.id), vorname: String(a.vorname) }));
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
  /**
   * Führt hier eine VERTRETUNG statt der zuständigen Rolle?
   *
   * Die Terminseite schreibt es dann hin. Ein Kunde, der ein Startgespräch
   * bucht und einen Verkäufer bekommt, soll das VORHER lesen — nicht erst,
   * wenn das Telefon klingelt.
   */
  vertretung?: boolean;
}

/**
 * Die reine Slot-Rechnung für eine Menge Agenten — ohne Verknappung, ohne
 * Lastverteilung.
 *
 * Sie steht getrennt, weil `rollenFuerBuchung` sie braucht, um „gibt es
 * überhaupt eine freie Onboarding-Zeit?" zu beantworten. Eine zweite
 * Rechnung dafür wäre die zweite Wahrheit über dieselbe Frage.
 */
async function rohSlots(
  agenten: { id: number; vorname: string }[], takt: number, lauf: Lauf = sqlPool,
): Promise<Slot[]> {
  if (agenten.length === 0) return [];
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
  return slots;
}

/**
 * Freie Slots für eine Person, gruppierbar nach Tag.
 *
 * Belegt ist ein Slot, wenn dort schon ein Termin steht (`gebucht`, `erledigt`
 * oder `verpasst` — ein abgesagter gibt die Zeit wieder frei) ODER wenn er
 * innerhalb des Vorlaufs liegt.
 */
// ═══════════════════════════════════════════════════════════════════════════
// KNAPPHEIT — HÖCHSTENS FÜNF ZEITEN JE TAG
//
// ── DER AUFTRAG DES BETREIBERS (18.08.2026) ────────────────────────────────
// „Die Terminwahl zeigt je Tag höchstens 5 freie Slots — auch wenn mehr frei
// sind. Kein Ausklappen: Wer keinen passenden findet, wählt den nächsten Tag."
//
// GEMESSEN vorher: 260 angebotene Zeiten über zehn Tage, **27 pro Tag**.
// Siebenundzwanzig freie Termine sagen dem Kunden: hier ist nichts los. Fünf
// sagen: da ist Betrieb, nimm einen. Dieselbe Verfügbarkeit, ein anderer
// Eindruck — und der Eindruck entscheidet, ob er bucht.
//
// ── WARUM GESTREUT UND NICHT DIE ERSTEN FÜNF ───────────────────────────────
// Die ersten fünf wären 09:00, 09:20, 09:40, 10:00, 10:20 — ein Kunde, der
// nachmittags Zeit hat, findet nichts und geht. Gestreut über früh, vormittag,
// mittag, nachmittag, spät trifft jede Tageshälfte.
//
// ── UND DIE VERSTECKTEN? ───────────────────────────────────────────────────
// Nicht buchbar. Der Server filtert bei der ANNAHME identisch (dieselbe
// Funktion) — sonst wäre die Knappheit eine Behauptung in der Oberfläche, und
// wer die Adresse errät, bucht daneben.
// ═══════════════════════════════════════════════════════════════════════════

/** Vorgabe, wenn die Einstellung fehlt. */
export const SLOTS_PRO_TAG_VORGABE = 5;

/**
 * Nimmt je Tag höchstens `hoechstens` Zeiten — gleichmäßig über den Tag.
 *
 * Deterministisch: Dieselbe Eingabe ergibt dieselbe Auswahl. Das ist Pflicht,
 * weil die Buchungsannahme dieselbe Rechnung anstellt und zum selben Ergebnis
 * kommen muss.
 */
export function slotsVerknappen(slots: Slot[], hoechstens = SLOTS_PRO_TAG_VORGABE): Slot[] {
  if (hoechstens <= 0) return slots;

  const jeTag = new Map<string, Slot[]>();
  for (const s of slots) {
    const tag = s.datum;
    if (!jeTag.has(tag)) jeTag.set(tag, []);
    jeTag.get(tag)!.push(s);
  }

  const raus: Slot[] = [];
  for (const tag of Array.from(jeTag.keys()).sort()) {
    const alle = jeTag.get(tag)!.slice().sort((a, b) => a.beginn.localeCompare(b.beginn));
    if (alle.length <= hoechstens) { raus.push(...alle); continue; }

    // Gleichmäßig greifen: Bei 27 Zeiten und fünf Plätzen sind das die
    // Positionen 0, 6, 13, 19, 26 — erste, letzte und drei dazwischen.
    // (n-1)/(k-1) als Schrittweite trifft immer beide Ränder.
    const gewaehlt: Slot[] = [];
    const schritt = (alle.length - 1) / (hoechstens - 1);
    for (let i = 0; i < hoechstens; i++) {
      const pos = Math.round(i * schritt);
      const s = alle[Math.min(pos, alle.length - 1)];
      // Bei kleinen Mengen kann dieselbe Position zweimal getroffen werden.
      if (!gewaehlt.includes(s)) gewaehlt.push(s);
    }
    // Falls durch Rundung einer fehlt: von vorn auffüllen, damit es immer
    // genau `hoechstens` sind, solange genug da ist.
    for (const s of alle) {
      if (gewaehlt.length >= hoechstens) break;
      if (!gewaehlt.includes(s)) gewaehlt.push(s);
    }
    gewaehlt.sort((a, b) => a.beginn.localeCompare(b.beginn));
    raus.push(...gewaehlt);
  }
  return raus;
}

/** Wie viele Zeiten zeigt ein Tag? Einstellbar in /admin/einstellungen. */
export async function slotsProTag(lauf: Lauf = sqlPool): Promise<number> {
  try {
    const [z] = (await lauf`
      SELECT value FROM fiaon_settings WHERE key = 'slots_pro_tag'
    `) as any[];
    const n = Math.round(Number(z?.value));
    // Grenzen: unter 1 wäre keine Buchung möglich, über 12 ist die Knappheit
    // dahin. Ein Tippfehler in den Einstellungen darf die Terminwahl nicht
    // unbrauchbar machen.
    if (Number.isFinite(n) && n >= 1 && n <= 12) return n;
  } catch { /* Vorgabe */ }
  return SLOTS_PRO_TAG_VORGABE;
}

export async function freieSlots(
  personId: number, lauf: Lauf = sqlPool, quelle: TerminQuelle | string = "nichterreicht_mail",
): Promise<SlotAuskunft> {
  const takt = dauerFuer(quelle);
  // ── DER RÜCKFALL ────────────────────────────────────────────────────────
  // DIESELBE Entscheidung, die auch `terminBuchen` trifft. Sie prüft nicht
  // mehr nur, ob es ein Onboarding-Konto GIBT, sondern ob dort eine Zeit FREI
  // ist — Begründung bei `rollenFuerBuchung`.
  const entscheid = await rollenFuerBuchung(quelle, personId, lauf);
  const nurRollen = entscheid.rollen;
  const nurRolle = nurRollen ? nurRollen[0] : null;
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
  const agenten = nurRollen
    ? await agentenMitRolle(nurRollen, lauf)
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
  if (agenten.length === 0) return { slots: [], betreuer: null, vertretung: entscheid.rueckfall };

  // Die Rechnung steht in `rohSlots` — dieselbe, die `rollenFuerBuchung`
  // benutzt, um „ist beim Onboarding etwas frei?" zu beantworten.
  const slots = await rohSlots(agenten, takt, lauf);

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
    // Verknappen erst NACH der Lastverteilung: Sonst würde die Auswahl der
    // fünf Zeiten die Verteilung verzerren.
    return {
      slots: slotsVerknappen(eindeutig, await slotsProTag(lauf)),
      betreuer: null,
      vertretung: entscheid.rueckfall,
    };
  }

  return {
    slots: slotsVerknappen(slots, await slotsProTag(lauf)),
    betreuer: betreuerAktiv
      ? { id: Number(person.assigned_agent_id), vorname: String(person.agent_vorname || person.agent_name || "") }
      : null,
    vertretung: entscheid.rueckfall,
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

// ═══════════════════════════════════════════════════════════════════════════
// JEDER VERSUCH WIRD PROTOKOLLIERT — AUCH DER ERFOLGREICHE
//
// ── DIE MELDUNG (Team, 30.08.2026) ─────────────────────────────────────────
// „Die Buchung funktioniert unabhängig von der Uhrzeit nicht zuverlässig."
//
// Diese Aussage war bis heute weder zu belegen noch zu widerlegen: Ein
// gescheiterter Versuch hinterließ eine Zeile auf der Konsole und sonst nichts.
// Die Tabelle `fiaon_termin_versuche` (Migration 062) macht ihn zählbar.
//
// ── WARUM AUCH DIE ERFOLGE ────────────────────────────────────────────────
// Ohne sie gibt es keine Quote. 12 Ablehnungen sind bei 15 Versuchen ein
// Notfall und bei 4.000 ein Rundungsfehler — eine Zahl ohne ihren Bezug ist
// keine Messung.
//
// ── WARUM DAS PROTOKOLL NIE EINEN VORGANG STOPPT ──────────────────────────
// Es wird in ein `.catch()` gesetzt, und das ist hier ausdrücklich richtig:
// Eine Buchung darf nicht scheitern, weil ihre Protokollzeile scheitert. Der
// Fehler wird aber GESCHRIEBEN, nicht verschluckt — ein stilles `.catch()`
// verwandelt einen Programmfehler in eine falsche Auskunft (AGENTS.md).
// ═══════════════════════════════════════════════════════════════════════════

export type VersuchErgebnis = "gebucht" | "abgelehnt";

/**
 * Einen Buchungsversuch festhalten.
 *
 * @param opts.grund Der Grund-CODE bei einer Ablehnung (nicht der Anzeigetext).
 *   Codes bleiben stabil, Texte werden umformuliert — eine Statistik über Texte
 *   bricht bei der ersten Verbesserung der Formulierung.
 */
export async function versuchProtokollieren(
  opts: {
    ergebnis: VersuchErgebnis;
    personId?: number | null;
    leadId?: number | null;
    slotBeginn?: string | Date | null;
    agentId?: number | null;
    grund?: string | null;
    quelle?: string | null;
    akteur?: "kunde" | "agent";
  },
  lauf: Lauf = sqlPool,
): Promise<void> {
  try {
    const beginn = opts.slotBeginn ? new Date(opts.slotBeginn) : null;
    await lauf`
      INSERT INTO fiaon_termin_versuche
        (person_id, lead_id, slot_beginn, agent_id, ergebnis, grund, quelle, akteur)
      VALUES (${opts.personId ?? null}, ${opts.leadId ?? null},
              ${beginn && !Number.isNaN(beginn.getTime()) ? beginn : null},
              ${opts.agentId ?? null}, ${opts.ergebnis},
              ${opts.ergebnis === "gebucht" ? null : (opts.grund ?? "unbekannt")},
              ${opts.quelle ?? null}, ${opts.akteur ?? "kunde"})
    `;
  } catch (e) {
    console.error("[TERMINE] Versuch-Protokoll fehlgeschlagen:", e instanceof Error ? e.message : e);
  }
}

/**
 * Der Klartext für einen Grund-Code — für die Karte in der Termin-Zentrale.
 *
 * Die Codes stehen in Migration 062. Ein unbekannter Code wird ANGEZEIGT, nicht
 * unterschlagen: Eine Ablehnung, die in keiner Kategorie landet, ist genau die,
 * die man sehen will.
 */
export const VERSUCH_GRUND_TEXT: Record<string, string> = {
  belegt: "Slot war im selben Moment weg",
  nicht_angeboten: "Slot stand nicht (mehr) in der Auswahl",
  kein_slot: "Zu dieser Zeit gibt es kein Angebot",
  zu_frueh: "Weniger als 2 Stunden Vorlauf",
  vergangenheit: "Zeitpunkt lag in der Vergangenheit",
  zu_spaet: "Mehr als 14 Tage im Voraus",
  agent_unbekannt: "Ansprechpartner nicht verfügbar",
  falsche_rolle: "Ansprechpartner nimmt diese Terminart nicht",
  zeit_unlesbar: "Zeitangabe unlesbar",
  link_ungueltig: "Link ungültig oder abgelaufen",
  keine_auswahl: "Kein Slot ausgewählt",
  serverfehler: "Serverfehler",
  unbekannt: "ohne Grund-Code",
};

export interface Buchung {
  id: number;
  personId: number;
  agentId: number;
  agentVorname: string;
  beginn: string;
  datumText: string;
  uhrzeit: string;
  stornoToken: string;
  /** Woher der Termin kommt — die Meldung an den Zuständigen nennt es. */
  quelle: string;
  /**
   * Führt jemand aus einer anderen Rolle, weil beim Onboarding nichts frei war?
   *
   * Sie steht am Termin und nicht nur im Log: Ein Betreiber, der morgens seine
   * Liste ansieht, soll die Vertretungen sehen können, ohne im Serverprotokoll
   * zu suchen.
   */
  vertretung: boolean;
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

  // ══════════════════════════════════════════════════════════════════════════
  // DIE ROLLENPRÜFUNG KENNT DEN RÜCKFALL — SEIT DEM 19.08.2026
  //
  // ── DIE MELDUNG (Herr Hertel, telefonisch) ────────────────────────────────
  // Ein Kunde kann im Startgespräch-Kalender keine Zeit auswählen.
  //
  // ── DER BEFUND, MIT 38 BELEGEN ────────────────────────────────────────────
  // Jens Hertel (Person 4540) hat es heute um 08 Uhr ACHTUNDDREISSIG MAL
  // versucht. Jeder einzelne Versuch steht im Protokoll, jeder mit demselben
  // Grund: `falsche_rolle`. Er hat die Zeiten gesehen und wurde bei jedem Klick
  // abgewiesen.
  //
  // Bestandsweit: 220 von 222 Ablehnungen tragen diesen Grund. Die gewählten
  // Ansprechpartner waren Lucas (98×), Nikita (51×), Florentine (44×) und
  // Daniel (27×) — alle aus Vertrieb und Leitung.
  //
  // ── DIE URSACHE: ZWEI REGELN FÜR DIESELBE FRAGE ───────────────────────────
  // Ist kein Onboarding-Konto aktiv, bietet `freieSlots` bewusst Zeiten aus
  // Vertrieb und Leitung an — `rollenMitRueckfall` ist genau dafür gebaut und
  // meldet den Rückfall sogar ins Log.
  //
  // Diese Prüfung hier kannte den Rückfall NICHT. Sie verglich stur gegen
  // `rolleFuerQuelle` und lehnte damit ab, was die Anzeige eine Zeile vorher
  // angeboten hatte. Der alte Kommentar sagte „Die Prüfung steht hier und nicht
  // nur in der Slot-Anzeige" — richtig gedacht, aber mit einer ANDEREN Regel als
  // die Anzeige. Eine Wand, die etwas anderes prüft als das Angebot, ist kein
  // Schutz, sondern eine Falle.
  //
  // Die Wand bleibt (wer die Anfrage selbst baut, kommt sonst an der Anzeige
  // vorbei) — sie benutzt jetzt DIESELBE Funktion.
  // ══════════════════════════════════════════════════════════════════════════
  //
  // ── SEIT DEM 21.08.2026 FRAGT SIE NACH FREIEN ZEITEN, NICHT NACH KONTEN ──
  // `rollenFuerBuchung` ist dieselbe Funktion, die `freieSlots` eine Zeile
  // vorher benutzt hat. Sie lässt Vertrieb NUR durch, wenn beim Onboarding
  // keine Zeit frei ist — und dann wird der Termin als Vertretung markiert.
  let vertretung = false;
  if (nurRolle) {
    const entscheid = await rollenFuerBuchung(eingabe.quelle, eingabe.personId, lauf);
    const rolle = String(agent.rolle || "agent");
    if (entscheid.rollen && !entscheid.rollen.includes(rolle)) {
      throw new TerminFehler(
        "falsche_rolle",
        "Diese Person führt keine Startgespräche. Bitte wähl eine andere Zeit — "
        + "die angebotenen Zeiten gehören zu Mitarbeitern, die Startgespräche führen.",
      );
    }
    // Vertretung ist es nur, wenn der Rückfall greift UND der Gebuchte
    // tatsächlich nicht die zuständige Rolle hat. Ein Onboarding-Mensch, der
    // während eines Rückfalls doch noch gebucht wird, ist keine Vertretung.
    vertretung = entscheid.rueckfall && rolle !== nurRolle;
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
      INSERT INTO fiaon_termine (person_id, agent_id, beginn, dauer_min, status, quelle,
                                 storno_token, vertretung)
      VALUES (${eingabe.personId}, ${eingabe.agentId}, ${beginn}, ${takt}, 'gebucht',
              ${eingabe.quelle}, ${stornoToken}, ${vertretung})
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
    quelle: eingabe.quelle,
    vertretung,
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

  // ══════════════════════════════════════════════════════════════════════
  // DER ZUSTÄNDIGE ERFÄHRT ES — SOFORT
  //
  // Hier stand nur ein Verlaufseintrag in der Akte des Kunden. Den liest
  // niemand, der nicht ohnehin schon hinsieht. Der Kunde bekam eine
  // Bestätigung mit Uhrzeit, hielt sie ein — und der Zuständige wusste
  // nichts davon.
  //
  // Der Verlaufseintrag entsteht jetzt in `buchungMelden` (mit derselben
  // Aussage), zusammen mit der Mail an den Zuständigen. Fire-and-forget:
  // Eine Buchung darf nicht daran scheitern, dass ein Mailserver hustet.
  void import("./fiaon-termin-meldung")
    .then((m) => m.buchungMelden(buchung.id, buchung.beginn, buchung.quelle, lauf))
    .catch((e) => console.error("[TERMINE] Buchungsmeldung:", e));

  // Ein gebuchter Termin beendet einen Wartezustand: Der Kunde hat reagiert.
  void import("./fiaon-warten")
    .then((m) => m.nichtMehrWarten(buchung.personId))
    .catch((e) => console.error(`[TERMINE] Wartezustand von Person ${buchung.personId} nicht beendet — der Kunde bleibt im Filter „Wartend“, obwohl er gebucht hat:`, e));
}

/** Sagt einen Termin ab. Der Slot wird dadurch wieder frei. */
export async function terminAbsagen(
  stornoToken: string, wer: "kunde" | "agent", lauf: Lauf = sqlPool,
): Promise<{ ok: boolean; termin?: any }> {
  const [termin] = (await lauf`
    UPDATE fiaon_termine
    SET status = 'abgesagt', abgesagt_am = NOW(), abgesagt_von = ${wer}, updated_at = NOW()
    WHERE storno_token = ${stornoToken} AND status = 'gebucht'
    RETURNING id, person_id, agent_id, beginn, quelle
  `) as any[];
  if (!termin) return { ok: false };

  // ══════════════════════════════════════════════════════════════════════
  // EINE ABSAGE, DIE NIEMAND ERFÄHRT, IST SCHLIMMER ALS KEIN TERMIN
  //
  // GEMESSEN: 10 abgesagte Termine, keine einzige Absage jemandem gemeldet.
  // Der Termin verschwand im selben Augenblick aus jeder Ansicht — der
  // Kalender filterte auf „gebucht". Der Zuständige saß zur vereinbarten
  // Zeit da und wartete auf jemanden, der abgesagt hatte.
  //
  // Ab jetzt: Mail an den Zuständigen, Verlaufseintrag, und der Termin bleibt
  // sieben Tage im Kalender stehen — mit „Abgesagt am … durch den Kunden".
  // ══════════════════════════════════════════════════════════════════════
  void import("./fiaon-termin-meldung")
    .then((m) => m.absageMelden(
      Number(termin.id), termin.beginn, String(termin.quelle),
      wer === "kunde" ? "kunde" : "agent", lauf,
    ))
    .catch((e) => console.error("[TERMINE] Absagemeldung:", e));

  return { ok: true, termin };
}
