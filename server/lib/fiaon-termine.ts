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
  // ── DIE DRITTE GESPRÄCHSART (21.08.2026) ────────────────────────────────
  // Der Kommentar oben sagte: „Wer eine dritte Gesprächsart braucht (Inkasso),
  // trägt sie hier ein und ist fertig." Hier ist sie.
  //
  // ── DER WIDERSPRUCH, DEN SIE AUFLÖSEN MUSS ──────────────────────────────
  // Am 11.08.2026 hat der Betreiber ausdrücklich gesagt: „Die Mitarbeiter aus
  // dem Inkasso, warum haben die Termine? Die können keine Termine bekommen."
  // Deshalb steht weiter unten in `terminBuchen` eine Wand, die jede Buchung
  // auf ein Inkasso-Konto ablehnt.
  //
  // Diese Wand bleibt — sie hat nur nie unterschieden, WELCHE Gesprächsart
  // gebucht wird. Abgelehnt gehören VERTRIEBS-Rückrufe: Hans-Jürgen hatte zwei
  // `nichterreicht_mail`-Termine, und die umgehen seine nach Dringlichkeit
  // sortierte Arbeitsliste.
  //
  // Ein `inkasso_call` ist das Gegenteil: ein Gespräch über GENAU die offene
  // Rate, das der Zuständige selbst führt. Es umgeht keine Liste, es ist ihre
  // Fortsetzung. Nur diese eine Art darf auf ein Inkasso-Konto.
  //
  // 20 Minuten wie das Vertriebsgespräch: Es geht um eine Zahlung, eine
  // Vereinbarung und oft um eine Lebenslage — 15 Minuten wären knapp.
  inkasso_call: { minuten: 20, text: "Gespräch über deine offene Rate" },
} as const;

export type TerminQuelle = keyof typeof QUELLEN;

// ═══════════════════════════════════════════════════════════════════════════
// DIE HERKUNFT — WELCHER WEG HAT ZU DIESEM TERMIN GEFÜHRT? (24.08.2026)
//
// ── VORHER ────────────────────────────────────────────────────────────────
// Der Buchungsweg hinterliess keine Spur. Zwei Fälle standen im Bestand
// identisch da:
//   · Ein Kunde, der VOR der Zahlung aus der Antragsstrecke heraus bucht
//     (server/routes/fiaon-antrag-termin.ts).
//   · Ein Kunde, der nach vergeblichen Anrufen die „nicht erreicht"-Mail
//     bekommt (server/lib/fiaon-nicht-erreicht.ts).
// Beide bekamen `quelle='nichterreicht_mail'`. Und der Weg über die
// Nummern-Korrektur (server/fiaon-number-update.ts) hinterliess gar nichts:
// Der Wert `nummer_korrektur` steht in den Anzeige-Wörterbüchern
// (fiaon-termin-zentrale.ts, shared/fiaon-termin-art.ts), wurde aber NIE
// geschrieben — der Admin-Filter „Nach Nummern-Korrektur" konnte deshalb
// garantiert nichts finden.
//
// ── NACHHER ───────────────────────────────────────────────────────────────
// Ein ZWEITES, rein beschreibendes Feld: `fiaon_termine.herkunft`.
//
// GRUND für das zweite Feld statt neuer Quellwerte: `quelle` beschreibt die
// ZUSTÄNDIGKEIT (welche Art Gespräch — Onboarding/Vertrieb/Inkasso) und
// steuert Rollen- und Slot-Logik. Wer den Buchungsweg dort hineinschreibt,
// ändert die Vergabe. Die Herkunft ändert NICHTS: keine Slot-Auswahl, keine
// Rolle, keine Dauer. Sie ist Buchführung.
// ═══════════════════════════════════════════════════════════════════════════

/** Die Wege, auf denen ein Terminlink zum Menschen kommt — mit Klartext. */
export const HERKUENFTE = {
  antrag_vor_zahlung: "Terminlink aus der Antragsstrecke (vor der Zahlung)",
  nicht_erreicht_mail: "Mail „Wir haben Sie nicht erreicht“",
  nummer_korrektur: "Mail zur Nummern-Korrektur",
  onboarding_einladung: "Einladung zum Startgespräch",
  termin_verpasst_mail: "Einladung nach einem verpassten Termin",
  wiedereinstieg_mail: "Wiedereinstiegs-Mail nach langer Funkstille",
  agent: "Von einem Mitarbeiter weitergegeben oder eingetragen",
  unbekannt: "Weg nicht mitgeführt",
} as const;

export type TerminHerkunft = keyof typeof HERKUENFTE;

/**
 * Eine mitgeschickte Herkunft prüfen.
 *
 * Alles, was nicht auf der Liste steht, wird zu `unbekannt` — NICHT
 * gespeichert, wie es kam. Der Wert stammt aus einer Adresszeile und damit von
 * aussen; eine offene Spalte wäre eine Einladung, sich die Buchführung selbst
 * zu schreiben. Und da die Herkunft nichts steuert, ist „unbekannt" der
 * ehrlichste Ausgang.
 */
export function herkunftPruefen(wert: unknown): TerminHerkunft {
  const h = String(wert ?? "").trim().toLowerCase();
  return (h in HERKUENFTE ? h : "unbekannt") as TerminHerkunft;
}

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
  const q = String(quelle);
  // ── E-045 (Justin 23.08., Plan §17): VORHER band `onboarding_call` an die
  // Rolle „onboarding" — Startgespräche gingen an einen Onboarding-Pool.
  // NACHHER: `null` = der Betreuer bzw. jeder verteilende Bonitätsmanager.
  // Bei Besitz bucht der Terminlink damit IMMER beim Betreuer (freieSlots),
  // ohne Betreuer fällt es auf alle aktiven Bonitätsmanager zurück. Die
  // Beschriftung „Startgespräch" bleibt an der Quelle, nur die Vergabe ändert
  // sich. `inkasso_call` bleibt gebunden: ohne Betreuer gehört ein reines
  // Zahlungsgespräch zu Diana (Back-Office), nicht in die Verteilung.
  if (q === "inkasso_call") return "inkasso";
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE RICHTUNG IST UMGEDREHT — DER ZUSTAND BESTIMMT DIE GESPRÄCHSART
//
// ── DER AUFTRAG (Betreiber, 21.08.2026) ───────────────────────────────────
// „Du hast `zustaendigeRolle` gebaut, aber die Vergabe entscheidet weiterhin
// über die Terminart. Genau dort entsteht der Fehler. Drehe die Richtung um:
// Die Rolle bestimmt die Terminart, nicht umgekehrt."
//
// ── WAS VORHER GALT ───────────────────────────────────────────────────────
// Der Link trug `?art=start`. Daraus wurde die Quelle, daraus die Rolle. Ein
// URL-Parameter entschied, wer den Kunden anruft — und wer ihn wegliess,
// buchte ein Verkaufsgespräch für einen Menschen, der das Paket schon besitzt.
//
// ── GEMESSEN, WAS DIE UMSTELLUNG BEWEGT (21.08.2026) ─────────────────────
// Von 41 Terminen seit dem 20.08. hätten **25** eine andere Gesprächsart
// bekommen, **23** liegen bei einer Rolle, die nicht zuständig ist:
//     11× onboarding_call → nichterreicht_mail  (Startgespräch längst geführt)
//     10× onboarding_call → inkasso_call        (im Rückstand)
//      2× nichterreicht_mail → inkasso_call
//      2× nichterreicht_mail → onboarding_call
//
// ── DIE FOLGE, DIE DER BETREIBER AUSDRÜCKLICH ENTSCHIEDEN HAT ────────────
// 147 der 151 Forderungsfälle (97 %) haben NIE ein Startgespräch geführt. Weil
// der Rückstand vorgeht, wandern 147 der 342 Wartenden (43 % der
// Onboarding-Warteschlange) in ein Zahlungsgespräch statt in ihr
// Startgespräch. Ich habe genau diese Zahl vorgelegt und gefragt; die Antwort
// war „Rückstand zuerst, wie beauftragt". Die Reihenfolge steht in
// `fiaon-zustaendigkeit.ts` und ist dort in EINER Bedingung geändert.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Welche Gesprächsart und welche Rollen gehören zu DIESEM Menschen?
 *
 * Ersetzt den Weg „Quelle → Rolle" durch „Zustand → Quelle → Rollen". Der
 * Rückfall (Vertretung) bleibt: Ist bei der zuständigen Rolle keine Zeit frei,
 * treten Vertrieb und Leitung ein — sichtbar markiert.
 *
 * @param gewuenscht Was der Aufrufer mitgeschickt hat (z. B. `?art=start`).
 *                   Wird vermerkt und verworfen, nicht befolgt.
 */
export async function entscheidFuerPerson(
  personId: number, gewuenscht: string | null = null, lauf: Lauf = sqlPool,
): Promise<RollenEntscheid & { quelle: string; zustaendig: string; verworfen: string | null }> {
  const { terminartFuerPerson } = await import("./fiaon-zustaendigkeit");
  const art = await terminartFuerPerson(personId, gewuenscht, lauf);
  if (!art) {
    // Kein Kunde — dann gilt das alte Verhalten (keine Rollenbindung). Ein
    // Fehler wäre hier falsch: Die Terminwahl darf nicht daran scheitern, dass
    // eine Person gerade zusammengeführt wurde.
    return {
      rollen: null, rueckfall: false, grund: "ohne_rolle",
      quelle: "nichterreicht_mail", zustaendig: "vertrieb", verworfen: gewuenscht,
    };
  }
  const entscheid = await rollenFuerBuchung(art.quelle, personId, lauf);
  return {
    ...entscheid,
    quelle: art.quelle,
    zustaendig: art.zustaendig,
    verworfen: art.verworfen,
  };
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
/**
 * Der Buchungslink für einen Menschen.
 *
 * ── OHNE `?art=` SEIT DEM 21.08.2026 ──────────────────────────────────────
 * Hier stand `?art=start` für Startgespräche. Der Parameter entschied die
 * Gesprächsart und damit, wer anruft — von außen setzbar, und in jeder Mail
 * mitgeschleppt. Wer ihn wegliess (oder eine alte Mail von vor der Zahlung
 * aufrief), buchte ein VERTRIEBSGESPRÄCH für einen Menschen, der das Paket
 * längst besitzt.
 *
 * Jetzt leitet die Seite die Gesprächsart aus dem Zustand ab. Ein
 * mitgeschicktes `?art=` verwirft die Ableitung und vermerkt es
 * (`fiaon_termine.quelle_verworfen`).
 *
 * ── DER ZWEITE PARAMETER TRÄGT JETZT DIE HERKUNFT (24.08.2026) ────────────
 * VORHER stand hier `quelle` — und in der ersten Zeile `void quelle;`. Der
 * Parameter wurde also entgegengenommen und weggeworfen; rund ein Dutzend
 * Aufrufer übergaben folgenlos „onboarding_call". Damit war nirgends
 * festgehalten, welcher WEG einen Termin erzeugt hat.
 *
 * NACHHER trägt er die HERKUNFT und landet als `?von=` in der Adresse. Sie
 * beschreibt den Weg, nicht das Gespräch — die Gesprächsart bleibt abgeleitet.
 * GRUND: Ohne diese Spur sind „vor der Zahlung aus dem Antrag" und „nach
 * vergeblichen Anrufen" im Bestand nicht zu unterscheiden.
 *
 * `unbekannt` hängt bewusst NICHTS an: Ein leerer Zusatz in einer Kundenmail
 * ist besser als ein Wort, das nichts sagt.
 */
export function terminLink(personId: number, herkunft: TerminHerkunft | string = "unbekannt"): string {
  const von = herkunftPruefen(herkunft);
  const anhang = von === "unbekannt" ? "" : `?von=${von}`;
  return absoluteUrl(`/termin/${terminTokenErzeugen(personId)}${anhang}`);
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
  /**
   * Welche Gesprächsart wurde ABGELEITET? (21.08.2026)
   *
   * Die Terminseite schreibt sie hin und schickt sie beim Buchen zurück. Ohne
   * sie müsste die Seite raten, und dann wäre die Ableitung wieder eine von
   * zwei Wahrheiten.
   */
  quelle?: string;
  /** Welche Rolle ist für diesen Menschen zuständig? */
  zustaendig?: string;
  /** Eine mitgeschickte Gesprächsart, die verworfen wurde — nur fürs Protokoll. */
  verworfen?: string | null;
}

/**
 * Die reine Slot-Rechnung für eine Menge Agenten — ohne Verknappung, ohne
 * Lastverteilung.
 *
 * Sie steht getrennt, weil `rollenFuerBuchung` sie braucht, um „gibt es
 * überhaupt eine freie Onboarding-Zeit?" zu beantworten. Eine zweite
 * Rechnung dafür wäre die zweite Wahrheit über dieselbe Frage.
 *
 * E-048 (23.08.2026): VORHER modul-intern — NACHHER exportiert, weil
 * GET /agent/vertrieb/frei (fiaon-office-vertrieb.ts) dem Mitarbeiter seine
 * eigenen freien Zeiten als Klick-Auswahl anbietet. Dieselbe Rechnung wie
 * bei der Kundenbuchung, keine Kopie — sonst böte die Pipeline Zeiten an,
 * die die Annahme (terminBuchen, Raster-Wand) ablehnt.
 */
export async function rohSlots(
  agenten: { id: number; vorname: string }[], takt: number, lauf: Lauf = sqlPool,
  // Vorher fest 2 h Vorlauf. Nachher (24.08., E-048): optional übersteuerbar –
  // der Mitarbeiter vereinbart am Telefon auch „gleich in 30 Minuten"
  // (agent_manuell erlässt den Vorlauf bei der Annahme ohnehin, Z. ~978).
  vorlaufMs: number = VORLAUF_STUNDEN * 3600_000,
): Promise<Slot[]> {
  if (agenten.length === 0) return [];
  const frühestens = new Date(Date.now() + vorlaufMs);
  const spätestens = new Date(Date.now() + HORIZONT_TAGE * 86_400_000);

  // ══════════════════════════════════════════════════════════════════════
  // EINE ABSAGE DES MITARBEITERS SPERRT DIE ZEIT (25.08.2026)
  //
  // Florentine: „Ich habe den 16-Uhr-Call wegen des Teamcalls abgesagt —
  // kurz darauf hat der gleiche Kunde um 16 Uhr wieder einen Termin gebucht."
  //
  // Eine Absage des KUNDEN gibt die Zeit frei — der Mitarbeiter kann sie ja.
  // Eine Absage des MITARBEITERS heißt das Gegenteil: Er hat abgesagt, WEIL
  // er zu dieser Zeit nicht kann. Beide Fälle gleich zu behandeln bot dem
  // Kunden genau den Slot wieder an, der eben erst abgesagt wurde — und die
  // nächste Absage war programmiert. Deshalb zählt `abgesagt_von = 'agent'`
  // hier als belegt.
  // ══════════════════════════════════════════════════════════════════════
  const belegt = new Set(
    ((await lauf`
      SELECT agent_id, beginn FROM fiaon_termine
      WHERE agent_id = ANY(${agenten.map((a) => a.id)})
        AND (status IN ('gebucht', 'erledigt', 'verpasst')
             OR (status = 'abgesagt' AND abgesagt_von = 'agent'))
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
  personId: number, lauf: Lauf = sqlPool, quelle: TerminQuelle | string = "auto",
): Promise<SlotAuskunft> {
  // ── „auto" HEISST: DER ZUSTAND ENTSCHEIDET (21.08.2026) ────────────────
  // Die Vorgabe war `"nichterreicht_mail"` — ein Vertriebsgespräch für jeden,
  // der die Quelle nicht mitschickte, auch für einen längst bezahlten Kunden.
  //
  // Jetzt ist die Vorgabe `"auto"`: Die Gesprächsart wird aus dem Zustand
  // abgeleitet. Wer eine bestimmte Art WILL (ein Mitarbeiter, der einen
  // eigenen Rückruf setzt), gibt sie weiter ausdrücklich an — dann bleibt sie.
  const entscheid = String(quelle) === "auto"
    ? await entscheidFuerPerson(personId, null, lauf)
    : { ...(await rollenFuerBuchung(quelle, personId, lauf)), quelle: String(quelle) };
  const wirkQuelle = entscheid.quelle;
  const takt = dauerFuer(wirkQuelle);
  const nurRollen = entscheid.rollen;
  const nurRolle = nurRollen ? nurRollen[0] : null;
  const [person] = (await lauf`
    SELECT p.id, p.assigned_agent_id,
           a.first_name AS agent_vorname, a.name AS agent_name, a.active AS agent_aktiv
    FROM fiaon_persons p
    LEFT JOIN fiaon_agents a ON a.id = p.assigned_agent_id
    WHERE p.id = ${personId} AND p.merged_into_person_id IS NULL
  `) as any[];
  if (!person) return { slots: [], betreuer: null, quelle: wirkQuelle };

  // Wer darf angeboten werden? Bei Besitz: nur der Betreuer. Sonst: alle, die
  // im Verteilbetrieb stehen — Testkonten ausdrücklich nicht, sonst bucht ein
  // echter Kunde ein Gespräch mit einem Konto, hinter dem niemand sitzt.
  //
  // ── E-045 (Justin 23.08., Plan §17): DER BETREUER GEWINNT IMMER ─────────
  // VORHER: `!nurRolle && …` — verlangte die Quelle eine Rolle (Startgespräch
  // → Onboarding), war der Betreuer unerheblich und der Termin ging an den
  // Rollen-Pool. NACHHER: Ein Bonitätsmanager macht den ganzen Kundenweg —
  // bei Besitz bucht der Terminlink IMMER beim Betreuer, auch Startgespräch
  // und Zahlungsgespräch. Nur ohne (aktiven) Betreuer greift die Rollen-
  // bzw. Verteilliste.
  const betreuerAktiv = person.assigned_agent_id && person.agent_aktiv;
  const agenten = betreuerAktiv
    ? [{ id: Number(person.assigned_agent_id), vorname: String(person.agent_name || person.agent_vorname || "Ihr Ansprechpartner") }]
    : nurRollen
      ? await agentenMitRolle(nurRollen, lauf)
      : ((await lauf`
          SELECT id, COALESCE(NULLIF(first_name, ''), name) AS vorname
          FROM fiaon_agents
          WHERE active AND distribution_active AND NOT is_test_account
            -- Kein Inkasso-Konto: Dass eines in dieser Liste stand, war
            -- dieselbe Lücke wie in der Lead-Zuteilung — die Rolle wurde
            -- nicht geprüft. E-045: VORHER ('agent','vertriebsleiter') —
            -- NACHHER auch 'onboarding': eine Rolle Bonitätsmanager, alle
            -- verteilen. Nur Diana (inkasso) bleibt draußen.
            AND COALESCE(rolle, 'agent') IN ('agent', 'onboarding', 'vertriebsleiter')
          ORDER BY id
        `) as any[]).map((a) => ({ id: Number(a.id), vorname: String(a.vorname) }));
  if (agenten.length === 0) {
    return {
      slots: [], betreuer: null, vertretung: entscheid.rueckfall, quelle: wirkQuelle,
      zustaendig: (entscheid as any).zustaendig,
    };
  }

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
  // E-045: VORHER `(!betreuerAktiv || nurRolle)` — beim Rollen-Pool wurde auch
  // mit Betreuer verteilt. NACHHER zählt nur noch: Gibt es KEINEN Betreuer?
  if (!betreuerAktiv && slots.length > 0) {
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
      quelle: wirkQuelle,
      zustaendig: (entscheid as any).zustaendig,
      verworfen: (entscheid as any).verworfen ?? null,
    };
  }

  return {
    slots: slotsVerknappen(slots, await slotsProTag(lauf)),
    betreuer: betreuerAktiv
      ? { id: Number(person.assigned_agent_id), vorname: String(person.agent_name || person.agent_vorname || "") }
      : null,
    vertretung: entscheid.rueckfall,
    quelle: wirkQuelle,
    zustaendig: (entscheid as any).zustaendig,
    verworfen: (entscheid as any).verworfen ?? null,
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
   * Welche Rolle war ZUM ZEITPUNKT DER BUCHUNG zuständig? (21.08.2026)
   *
   * Die durchführende Person kann abweichen (Vertretung) — die Zuständigkeit
   * wechselt dabei nie. Genau dieser Satz stand im Auftrag, und ohne eigenes
   * Feld wäre er nicht nachweisbar.
   */
  zustaendig?: string | null;
  /** Eine mitgeschickte Gesprächsart, die die Ableitung verworfen hat. */
  verworfen?: string | null;
  /**
   * Der Weg, der zu dieser Buchung geführt hat (24.08.2026) — rein
   * beschreibend, ohne Wirkung auf Slots, Rolle oder Dauer.
   */
  herkunft?: TerminHerkunft;
  /**
   * Führt jemand aus einer anderen Rolle, weil beim Onboarding nichts frei war?
   *
   * Sie steht am Termin und nicht nur im Log: Ein Betreiber, der morgens seine
   * Liste ansieht, soll die Vertretungen sehen können, ohne im Serverprotokoll
   * zu suchen.
   */
  vertretung: boolean;
}

// ── DIE SPALTE `herkunft` ENTSTEHT BEIM ERSTEN BUCHEN (24.08.2026) ─────────
// Muster wie `ensureVertriebSpalten` (server/routes/fiaon-office-vertrieb.ts):
// lazy, memoisiert, in einer Transaktion mit `lock_timeout`. Ohne das Zeitlimit
// stellt sich ein ALTER hinter eine lange laufende Transaktion und ZWINGT jede
// folgende Abfrage auf `fiaon_termine` in dieselbe Warteschlange — die Seite
// stünde. Lieber nach 3 s aufgeben und beim nächsten Aufruf erneut versuchen.
//
// Der Rückgabewert sagt, ob die Spalte da ist. Eine Buchung darf NIE daran
// scheitern, dass eine beschreibende Spalte fehlt: Ist sie nicht da, wird der
// Termin trotzdem gebucht und nur die Herkunft nicht geschrieben.
let herkunftBereit: Promise<boolean> | null = null;
export function ensureHerkunftSpalte(): Promise<boolean> {
  if (!herkunftBereit) {
    herkunftBereit = (async () => {
      await sqlPool.begin(async (tx: any) => {
        await tx`SET LOCAL lock_timeout = '3s'`;
        await tx`ALTER TABLE fiaon_termine ADD COLUMN IF NOT EXISTS herkunft VARCHAR`;
      });
      return true;
    })().catch((e) => {
      herkunftBereit = null;
      console.error("[TERMINE] Spalte `herkunft` konnte nicht angelegt werden:", e);
      return false;
    });
  }
  return herkunftBereit;
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
    /**
     * Der WUNSCH des Aufrufers, nicht die Entscheidung.
     *
     * Bewusst `string` und nicht `TerminQuelle`: Seit dem 21.08.2026 darf hier
     * auch `"auto"` stehen („leite ab"), und ein alter Aufrufer darf weiter
     * eine Art mitschicken, ohne dass der Typcheck ihn zwingt. Was wirklich
     * gebucht wird, entscheidet `entscheidFuerPerson` — und nur die
     * abgeleitete Art landet in der Datenbank.
     */
    quelle: TerminQuelle | string;
    /**
     * Der WEG, auf dem der Mensch zur Buchung kam (24.08.2026).
     *
     * Rein beschreibend: Sie ändert weder Slot-Auswahl noch Rolle noch Dauer.
     * Deshalb steht sie NEBEN `quelle` und nicht darin — `quelle` steuert die
     * Zuständigkeit, und ein Buchungsweg darf sie nicht verschieben.
     */
    herkunft?: TerminHerkunft | string | null;
  },
  lauf: Lauf = sqlPool,
): Promise<Buchung> {
  // ══════════════════════════════════════════════════════════════════════════
  // EIN LESER FÜR ALLE TERMINZEITEN (25.08.2026)
  //
  // Hier stand `new Date(eingabe.beginn)`. Das ist für eine Zeit MIT Zone
  // richtig — und für eine nackte Wandzeit falsch: Node liest „2026-08-26T11:00"
  // nach ECMAScript-Norm als ORTSZEIT DES SERVERS. Der Server läuft in UTC,
  // also wurde aus 11:00 Berlin still und leise 13:00 Berlin.
  //
  // GEMESSEN im Prüfstand: Termin für morgen 11:00 angelegt → bestätigt wurde
  // „26.08.2026 13:00". Zwei Stunden zu spät, ohne jede Fehlermeldung. Das ist
  // die gefährlichere Sorte Fehler: Der Kunde wartet um elf, der Mitarbeiter
  // ruft um eins an.
  //
  // Beide Quellen laufen durch DENSELBEN Leser:
  //   · Kundenseite  → `toISOString()`, also mit Zone → absolut, unverändert.
  //   · Mitarbeiter  → nackte Wandzeit aus dem Feld → als Berliner Zeit gelesen.
  // `parseBerlinInput` unterscheidet das an der Zeichenkette und beherrscht die
  // Zeitumstellung. Das Verschieben nutzt ihn längst — deshalb hat Verschieben
  // nie gehakt und Anlegen immer.
  // ══════════════════════════════════════════════════════════════════════════
  const { parseBerlinInput } = await import("./fiaon-time");
  const beginn = typeof eingabe.beginn === "string"
    ? (parseBerlinInput(eingabe.beginn) ?? new Date(NaN))
    : eingabe.beginn;
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

  // ══════════════════════════════════════════════════════════════════════
  // DIE GESPRÄCHSART WIRD ABGELEITET, NICHT ÜBERNOMMEN (21.08.2026)
  //
  // Was der Aufrufer mitschickt, ist ein WUNSCH. Maßgeblich ist der Zustand
  // des Menschen — sonst entscheidet weiter ein URL-Parameter, wer anruft.
  //
  // Zwei Ausnahmen, beide mit Grund:
  //   · `agent_manuell` — ein Mitarbeiter setzt seinen EIGENEN Rückruf. Das
  //     ist keine Kundenbuchung, sondern eine Notiz mit Uhrzeit; sie darf
  //     nicht in ein Startgespräch umgedeutet werden.
  //   · `onboarding` — die alte Quelle aus der Einladungsstrecke.
  // Alles andere (auch ein mitgeschicktes `onboarding_call`) wird abgeleitet.
  // ══════════════════════════════════════════════════════════════════════
  const gewuenscht = String(eingabe.quelle);
  // ── DIE WAHL DES MITARBEITERS GILT (27.08.2026, Team-Punkt 15) ──────────
  // Gemeldet und reproduzierbar: Wer im Kalender ausdruecklich „Onboarding"
  // waehlte, bekam einen VERTRIEBS-Termin. Die Ausnahmen-Liste kannte nur das
  // alte Wort `onboarding` — die Route schickt aber laengst `onboarding_call`,
  // also lief die Wahl in die Ableitung und wurde dort umgedeutet.
  //
  // Die Regel bleibt fuer oeffentliche Wege richtig (ein URL-Parameter darf
  // nicht entscheiden, wer anruft). Ein ANGEMELDETER Mitarbeiter ist kein
  // URL-Parameter: Buchungen mit herkunft 'agent' behalten die gewaehlte Art.
  const eigenerRueckruf = gewuenscht === "agent_manuell" || gewuenscht === "onboarding"
    || eingabe.herkunft === "agent";
  const abgeleitet = eigenerRueckruf
    ? null
    : await entscheidFuerPerson(eingabe.personId, gewuenscht, lauf);
  const wirkQuelle = abgeleitet ? abgeleitet.quelle : gewuenscht;
  const takt = dauerFuer(wirkQuelle);
  const nurRolle = rolleFuerQuelle(wirkQuelle);
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
    const entscheid = abgeleitet ?? await rollenFuerBuchung(wirkQuelle, eingabe.personId, lauf);
    const rolle = String(agent.rolle || "agent");
    // ── E-045: DER BETREUER DARF IMMER (Justin 23.08., Plan §17) ──────────
    // VORHER lehnte die Wand jeden ab, dessen Rolle nicht auf der Liste
    // stand — auch den Betreuer des Kunden. NACHHER: Was `freieSlots` bei
    // Besitz anbietet (den Betreuer), nimmt die Annahme auch an. Dieselbe
    // Regel an beiden Stellen, sonst ist es wieder die Falle vom 19.08.
    const [besitz] = (await lauf`
      SELECT 1 AS ok FROM fiaon_persons
      WHERE id = ${eingabe.personId} AND assigned_agent_id = ${eingabe.agentId}
        AND merged_into_person_id IS NULL
    `) as any[];
    const istBetreuer = !!besitz;
    if (!istBetreuer && entscheid.rollen && !entscheid.rollen.includes(rolle)) {
      throw new TerminFehler(
        "falsche_rolle",
        `Diese Person führt keine Gespräche dieser Art (${QUELLEN[wirkQuelle as TerminQuelle]?.text ?? wirkQuelle}). `
        + "Bitte wähl eine andere Zeit — die angebotenen Zeiten gehören zu den zuständigen Mitarbeitern.",
      );
    }
    // Vertretung ist es nur, wenn der Rückfall greift UND der Gebuchte weder
    // die zuständige Rolle hat noch der Betreuer ist.
    vertretung = entscheid.rueckfall && rolle !== nurRolle && !istBetreuer;
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
  //
  // ── PRÄZISIERT AM 21.08.2026 ────────────────────────────────────────────
  // Die Wand lehnte JEDE Buchung auf ein Inkasso-Konto ab — sie unterschied
  // nicht, WELCHE Gesprächsart. Abzulehnen sind Vertriebs-Rückrufe: Genau die
  // hatte Hans-Jürgen, und sie umgehen seine nach Dringlichkeit sortierte
  // Liste.
  //
  // Ein `inkasso_call` ist das Gegenteil: das Gespräch über genau die offene
  // Rate, geführt vom Zuständigen. Es umgeht keine Liste, es ist ihre
  // Fortsetzung — und ohne es hätte ein Mensch im Rückstand keinen Weg mehr,
  // eine Zeit zu wählen. „Buchen wird nie hart gesperrt" (Auftrag vom
  // 21.08.2026) gilt auch für ihn.
  if (String(agent.rolle || "agent") === "inkasso" && wirkQuelle !== "inkasso_call") {
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
  const herkunft = herkunftPruefen(eingabe.herkunft);
  const herkunftSpalteDa = await ensureHerkunftSpalte();
  let gebucht: any;
  try {
    // ── DIE ZUSTÄNDIGKEIT WIRD MITGESCHRIEBEN (Migration 073) ───────────
    // Die Ableitung antwortet immer für HEUTE. Wer im Nachhinein prüfen will,
    // ob eine Vertretung berechtigt war, braucht den DAMALIGEN Stand — sonst
    // ist jede Rückschau eine Schätzung. Genau daran ist die Messung vom
    // 21.08.2026 gescheitert: Sie musste den Zustand von heute für den von
    // damals nehmen und musste das dazuschreiben.
    [gebucht] = (await lauf`
      INSERT INTO fiaon_termine (person_id, agent_id, beginn, dauer_min, status, quelle,
                                 storno_token, vertretung, zustaendige_rolle, quelle_verworfen)
      VALUES (${eingabe.personId}, ${eingabe.agentId}, ${beginn}, ${takt}, 'gebucht',
              ${wirkQuelle}, ${stornoToken}, ${vertretung},
              ${abgeleitet?.zustaendig ?? null}, ${abgeleitet?.verworfen ?? null})
      RETURNING id
    `) as any[];
  } catch (err: any) {
    if (String(err?.code) === "23505") {
      throw new TerminFehler("belegt", "Dieser Termin wurde gerade vergeben. Bitte wählen Sie einen anderen.");
    }
    // ── ÜBERSCHNEIDUNG (25.08.2026) ────────────────────────────────────────
    // Meldung von Daniel und Florentine: „10:15 Onboarding und 10:20 Vertrieb —
    // ein Onboarding dauert 15-20 Minuten, der Mitarbeiter ist um 10:20 noch im
    // ersten Gespräch."
    // Seitdem verbietet die Datenbank jede Überlappung
    // (fiaon_termine_keine_ueberschneidung, EXCLUDE USING gist). Kommt der
    // Fehler hier an, ist das kein Systemfehler, sondern eine fachlich richtige
    // Ablehnung — und der Mensch davor muss erfahren, WARUM, nicht nur DASS.
    // 23P01 = exclusion_violation.
    if (String(err?.code) === "23P01") {
      throw new TerminFehler(
        "belegt",
        `In diesem Zeitraum läuft bereits ein Termin — ein Gespräch dauert ${takt} Minuten. `
        + "Bitte eine Zeit wählen, die danach beginnt.",
      );
    }
    throw err;
  }

  // ── DIE HERKUNFT WIRD NACHGETRAGEN, NICHT MITGESCHRIEBEN (24.08.2026) ────
  // Bewusst eine zweite Anweisung statt zweier INSERT-Fassungen: Der INSERT
  // oben ist die Stelle, an der ein Termin ENTSTEHT — dort zwei Varianten
  // nebeneinander zu führen (mit und ohne Spalte) heisst, den kritischen Weg zu
  // verdoppeln. Die Herkunft ist Buchführung; misslingt sie, fehlt eine
  // Auskunft, aber kein Termin.
  if (herkunftSpalteDa) {
    await lauf`UPDATE fiaon_termine SET herkunft = ${herkunft} WHERE id = ${Number(gebucht.id)}`
      .catch((e: unknown) => console.error("[TERMINE] Herkunft nicht vermerkt:", e));
  }

  return {
    id: Number(gebucht.id),
    herkunft,
    personId: eingabe.personId,
    agentId: eingabe.agentId,
    agentVorname: String(agent.vorname),
    beginn: beginn.toISOString(),
    datumText: berlinDatumText(beginn),
    uhrzeit: berlinUhrzeit(beginn),
    stornoToken,
    quelle: wirkQuelle,
    vertretung,
    zustaendig: abgeleitet?.zustaendig ?? null,
    verworfen: abgeleitet?.verworfen ?? null,
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

  // ── SAGT DER MITARBEITER AB, ERFAEHRT ES DER KUNDE (27.08.2026, Team-P.9) ──
  // Vorher bekam nur der ZUSTAENDIGE eine Meldung. Der Kunde sass zur
  // vereinbarten Zeit am Telefon und wartete auf einen Anruf, der nie kam.
  // Jetzt: Bei einer Absage durch den Mitarbeiter geht sofort eine Mail an den
  // Kunden — welcher Termin betroffen war und ein Link, um direkt eine neue
  // Zeit zu waehlen. Sagt der KUNDE selbst ab, braucht er keine Mail darueber.
  // WIRFT NIE: Ein Versandfehler macht die Absage nicht ungueltig.
  if (wer === "agent") {
    void (async () => {
      try {
        const [k] = (await lauf`
          SELECT COALESCE(NULLIF(p.first_name, ''), p.contact_name) AS vorname, p.last_name AS nachname,
                 COALESCE(NULLIF(p.primary_email, ''), (
                   SELECT NULLIF(COALESCE(a.email, a.contact_email, a.billing_email), '')
                   FROM fiaon_applications a
                   WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
                   ORDER BY a.created_at DESC LIMIT 1
                 )) AS email,
                 (SELECT a2.ref FROM fiaon_applications a2
                   WHERE a2.person_id = p.id AND a2.merged_into IS NULL AND a2.archived_at IS NULL
                   ORDER BY a2.created_at DESC LIMIT 1) AS ref
          FROM fiaon_persons p WHERE p.id = ${termin.person_id}
        `) as any[];
        if (!k?.email) return;
        const beginnDatum = new Date(termin.beginn);
        const { versendenUndProtokollieren } = await import("./fiaon-mail-log");
        const { absoluteUrl } = await import("../fiaon-base-url");
        await versendenUndProtokollieren(
          "termin_absage",
          {
            email: String(k.email),
            vorname: k.vorname || null,
            nachname: k.nachname || null,
            termin_datum: berlinDatumText(beginnDatum),
            termin_uhrzeit: berlinUhrzeit(beginnDatum),
            termin_art: (await import("@shared/fiaon-termin-art")).terminArtAusQuelle(String(termin.quelle)).text,
            neu_buchen_link: absoluteUrl(`/termin/${terminTokenErzeugen(Number(termin.person_id))}`),
          },
          {
            personId: Number(termin.person_id),
            verlaufRef: k.ref || null,
            verlaufText: `Absage-Mail an den Kunden versandt (Termin ${berlinDatumText(beginnDatum)}, ${berlinUhrzeit(beginnDatum)} Uhr, abgesagt durch den Mitarbeiter).`,
          },
        );
      } catch (e) {
        console.error("[TERMINE] Kundenmail zur Absage:", e);
      }
    })();
  }

  return { ok: true, termin };
}
