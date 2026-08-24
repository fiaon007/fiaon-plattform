// ═══════════════════════════════════════════════════════════════════════════
// /agent/pipeline — Raum 2: Die Pipeline, der Umsatz-Raum (23.08.2026, Plan §4/§11)
//
// Neubau der Übersicht nach Justins Vorgabe („keine Buchstaben, alle Grenzen
// sprengend, 3D – der Bereich, wo Umsatz passiert, muss der beste sein“):
//   · Umsatz-Leiste: Heute erreichbar · Meine Provision möglich · Aktive Kunden
//     (Bestand bis 500, dann wird abgegeben) – Zahlen zählen hoch. Stufen-Chips filtern den Strom.
//   · Stufen nach Hitze statt A/B/C: „Bezahlt – Termin offen“ (glüht),
//     „Antrag fertig – Rechnung offen“ (warm), „Registriert – noch kein
//     Antrag“ (Leads), „Aktiv – betreut“ (ruhig). Intern bleiben die
//     Serverfelder (priority_tier, tier_reason, termin …).
//   · Fokus-Karte „Jetzt anrufen“: die wertvollste nächste Aktion – Name,
//     Stufe, warum jetzt, erwarteter Wert (Paketpreis × 12, meine Provision
//     mit Satz aus GET /agent/provision-satz), großer Anruf-Knopf
//     (fiaon-anrufen), daneben der Leitfaden der Stufe (tools/gespraech.tsx,
//     ARTEN stufe_a/b/c) als aufklappbare Glas-Karte. Nach einem Ergebnis
//     rückt die nächste Karte nach.
//   · 3D-Kundenstrom: Glas-Karten auf einer perspektivischen Bahn (CSS 3D,
//     Parallax auf die Maus, heiße vorn und groß, kalte hinten), Pfeile,
//     Tastatur, Wischen; Klick = Akte. Handy: flache Bahn mit Scroll-Snap.
//     Höchstens ~40 Karten im DOM, prefers-reduced-motion wird beachtet.
//   · Suche, Filter (Land, letzter Kontakt, Rückruf fällig), Sortierung und
//     die bisherigen Server-Ansichten als schlanke Glas-Leiste.
//   · E-043 (Plan §15): Startansicht ist die ARBEITSLISTE mit genau 6 Karten
//     (je 2 „Bezahlt gemeldet – Termin fehlt“ / „Antrag fertig – Rechnung
//     offen“ / „Registriert – noch kein Antrag“) aus GET /agent/vertrieb/
//     arbeitsliste; erledigt = der nächste rückt nach. Der 3D-Strom ist der
//     zweite Reiter „Mein Bestand“ (Suche/Filter dort). EIN Ergebnisweg je
//     Anruf: „Erfolgreich vereinbart“ (nur mit gebuchtem Termin, POST
//     /agent/termine) oder „Negativ“ (Nicht erreicht / Nummer falsch / Kein
//     Interesse) – alles über den bestehenden aktivitaet-Endpunkt: die
//     Nicht-erreicht-Staffel (fiaon-nicht-erreicht.ts), die Nummern-Mail und
//     die Sperre (is_blocked) hängen dort schon dran.
//   · Die AKTE als Glas-Lade (?person=ID) bleibt mit allen Aktionen.
//   · Wording: Erfolgreich/Negativ → Mandat angenommen / nicht zustande
//     gekommen (Justin 23.08., E-044) – Kanzlei-Ton, technische Ergebnisse
//     dahinter unverändert; neuer Grund „Überlegt noch“ nutzt das bestehende
//     Rückruf-Ergebnis (rueckruf_termin).
//   · Kartenstatus (E-044/§16): VORHER zeigte die Akte den Servertext
//     k.karte.text – NACHHER überall der Platzhalter „In Bearbeitung“, außer
//     der Kunde ist vollständig (Paket + SCHUFA bezahlt, Kontoauszug + Ausweis
//     da; eine Wahrheit: kundeVollstaendig() in fiaon-office-vertrieb.ts) →
//     „Vollständig – liegt bei FIAON zur Bearbeitung“. Neuer Akte-Reiter
//     „Aktivität“: Zeitleiste aller Kundenereignisse inkl. fiaon_click_events
//     (GET /agent/vertrieb/aktivitaet/:id).
//   · Umsatz-Leiste (Justin 23.08.): VORHER Kachel „Meine Provision möglich“
//     – NACHHER ein Motivationssatz mit echter Zahl (5 Mandate/Tag × 21 Tage
//     × Ø-Rate aus dem echten Paketmix × Provisionssatz + 10-€-SCHUFA-Bonus
//     je Abschluss; Mix wie gehalt.tsx), darunter „Rechne selbst → Earnings“.
//   · E-045 (Plan §17): Die Bereichs-Trennung ist aufgehoben — die Raten-
//     Gruppe bekommt echte Daten aus /inkasso/liste (für jeden Bonitäts-
//     manager auf die eigenen Kunden beschränkt); die zwei Ausgänge
//     (Erinnerung · Ergebnis) sitzen in der Akte unter „Zahlungen & Raten“.
//   · Umsatz-Leiste (Justin, nach E-045): VORHER drei Kacheln („Heute
//     erreichbar“, „Dein Hebel“, „Aktive Kunden“) — NACHHER nur noch
//     „Aktive Kunden x/500“; der Hebel steht als schmale, ruhige Zeile
//     UNTER der Arbeitsliste und betont das Zusammenwachsen des Bestands.
//   · Akte: HIGH-END-Neubau (dunkles Glas, Reiter, Erklärzeilen) — Details
//     am Akte-Abschnitt unten.
//   · E-046 (Justin 23.08., Screenshot „Ueberfael Prüfstand-Rate“): Überblick
//     = SITUATIONS-KOPF. VORHER tier-Hinweis („alles bezahlt“) neben
//     überfälliger Rate + Knopf-Wüste + volle Ergebnisliste. NACHHER: EINE
//     serverseitig abgeleitete Situation (kundenSituation() im Vertriebs-
//     Router), eine Klartext-Karte mit EINEM Primär-Knopf, Sekundäres im
//     „Mehr“-Menü, Ergebnisse situativ (3–5 passende, „Alle Ergebnisse“ als
//     Ausklapp), Zahlungsbereich zeigt bei überfälliger Rate die RATE.
//   · E-047 (Justins Live-Test 24.08., Plan §18): Mehr-Menü im Viewport
//     (Handy: Bottom-Sheet) · Akte sperrt den Hintergrund-Scroll (#root wie
//     die Office-Schublade) · Stammdaten-Raster ohne Überlappung (Handy:
//     Label über Wert) · „Kunde bearbeiten“ mit ALLEN Feldern inkl.
//     Geburtsdatum (Server verarbeitet birthdate jetzt), jeder „fehlt“-
//     Hinweis klickbar mit Feld-Fokus · Fokus-Karte kompakt (Chips statt
//     Kacheln, „Warum jetzt“ 2 Zeilen mit Ausklapp) · fachlich richtige
//     Situationstexte (Rechnung geht nach Antragsabschluss IMMER automatisch
//     raus) · Leitfäden als LEGENDE unten (alle vier, nichts vorausgeklappt)
//     statt Seitenkasten · Trenner „Deine nächsten Kunden“ mit Schimmern und
//     mehr Luft zwischen Fokus und den nächsten fünf · SEPA-Grund an jeder
//     offenen Rate (kein SEPA / Rücklastschrift / offen) + Hinweis „Admin
//     bestätigt von Hand“.
//   · Aktive Kunden (§16a): VORHER alle bezahlten/zugewiesenen Kunden der
//     Liste – NACHHER zählen NUR übernommene Mandate
//     (fiaon_persons.mandat_seit, gesetzt beim Buchen von „Mandat
//     angenommen“), x/500. Der Bestand-Reiter trennt „Mandate (dein Bestand)“
//     und „Zugewiesen, Mandat offen“.
//   · E-050 (Justin 24.08., Plan §19): Pipeline und Bestand getrennt. VORHER
//     zwei Reiter (Arbeitsliste · Mein Bestand mit 3D-Strom, Suche, Filtern,
//     Server-Ansichten) — NACHHER ist /agent/pipeline NUR die Arbeitsliste;
//     das Portfolio der Mandate wohnt in /agent/bestand (bestand.tsx). Diese
//     Datei exportiert dafür Akte, Strom und den Kunde-Typ (keine Duplikate).
//     „Kunde anlegen“ und der Warte-Hinweis blieben hier (Arbeit, kein
//     Portfolio); die unsichtbare Liste (laden) bleibt als Datenrücken der
//     Akte-Lade bestehen. NICHT übernommen (siehe Bericht): Server-Ansichten-
//     Wahl, Land-/Kontakt-Filter, Suche über ALLE Zugewiesenen, Gruppe
//     „Zugewiesen, Mandat offen“.
//   · E-048 (Justin 23.08.): 1. Termin buchen = klickbare freie Zeiten,
//     nichts tippen — SlotWahl (GET /agent/vertrieb/frei, dieselbe Rechnung
//     wie die Kundenbuchung) ersetzt die Datum/Zeit-Felder in Fokus-Karte und
//     Akte; gebucht wird weiter über POST /agent/termine. 2. Karten-Wechsel
//     mit Animation ohne Neuladen: hinaus/herein je ~350 ms
//     cubic-bezier(.2,.8,.2,1) mit leichter Tiefe, kleine Karten rücken per
//     FLIP nach (useFlip), Liste füllt sich still über GET /agent/vertrieb/
//     arbeitsliste; prefers-reduced-motion blendet nur.
// Regel (Justin): Die erste Zahlung ist immer eine Überweisung – nirgends
// Lastschrift. Liste: GET /agent/kunden/liste (+ filter=bezahlt für Aktive).
// ═══════════════════════════════════════════════════════════════════════════
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
// E-050: Search/Plus/RefreshCw gingen mit dem Bestand-Reiter nach bestand.tsx.
import { Phone, X, Copy, Send, Mail, FileText, Check, ExternalLink, ChevronLeft, ChevronRight, ChevronDown, MoreHorizontal, Play } from "lucide-react";
import { AgentShell, api, useFragen } from "./shared";
import { useOffice } from "./OfficeShell";
import { ToastAnbieter, useToast, eur } from "@/lib/fiaon-ui";
import { statusAusTierGrund, type Stufe } from "@shared/fiaon-kundenstatus";
import { ERGEBNIS_TEXT, ERGEBNIS_LISTE, NOTIZ_MINDESTLAENGE } from "@shared/fiaon-kontakt-ergebnis-liste";
import { RATEN_ERGEBNISSE, type RatenErgebnis } from "@shared/fiaon-raten-ergebnisse";
import { AnrufPlayer } from "@/components/AnrufPlayer";
import { PAKETE } from "@shared/fiaon-pakete";
import { ARTEN, type Art as LeitfadenArt } from "./tools/gespraech";
import { KundeAnlegen } from "@/components/agent/KundeAnlegen";
import { SendeMenue } from "@/components/SendeMenue";
import { Gespraechsblatt } from "@/components/Gespraechsblatt";
import { RechnungBestaetigung } from "@/components/agent/RechnungBestaetigung";
import "@/styles/office-pipeline.css";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "./rundgaenge";
import "@/styles/office-rundgang.css";


// ── Der Kunde, wie ihn /agent/kunden/liste und /agent/crm/kunden/:id liefern ──
// E-050: exportiert — bestand.tsx (Portfolio-Raum) nutzt dieselbe Form.
export interface Kunde {
  karte?: { status: string | null; text: string | null; am: string | null } | null;
  personId: number;
  name: string;
  termin?: { beginn: string; status: string | null; dauerMin: number | null; erledigt: boolean; art: string } | null;
  telefon: string | null;
  telefonWaehlbar: string | null;
  telefonHinweis: string | null;
  nummerOhneLand?: boolean;
  sendeGrund?: string | null;
  fehlendeFelder?: string | null;
  zustimmungFehlt?: string | null;
  sendeMoeglich?: boolean;
  sendeText?: string | null;
  sendeTat?: string | null;
  nummerRoh?: string | null;
  landVorschlag?: { land: string | null; grund: string };
  email: string | null;
  tier: number;
  tierGrund: string;
  titel: string;
  hinweis: string;
  produkt: string | null;
  buchungen?: {
    ref: string; art: "paket" | "bonitaet" | "sonstiges"; bezeichnung: string;
    betragCents: number | null; zahlungText: string; bezahlt: boolean; offen: boolean;
    gestelltAm: string | null; faelligAm: string | null;
    verwendungszweck: string | null; erledigt: boolean;
  }[];
  betrag: number | null;
  zusagedatum: string | null;
  wiedervorlage: string | null;
  rueckrufAm: string | null;
  nichtErreicht: number;
  rechnungVersandt: number;
  stufe: Stufe | null;
  ruhtSeit: string | null;
  terminlinkMailAm: string | null;
  terminAm: string | null;
  /** 24.08.2026: Ein gebuchter Termin, dessen Zeitpunkt erreicht oder
   *  überschritten ist und der noch nicht erledigt wurde. `terminAm`
   *  liefert nur ZUKÜNFTIGE Termine — ohne dieses Feld konnte der Filter
   *  „Termin fällig" im Bestand-Raum per Konstruktion nie etwas finden. */
  terminFaelligAm?: string | null;
  terminLink: string;
  gesperrt: boolean;
  betreutSeit: string | null;
  letzterKontakt: string | null;
  letztesErgebnis: string | null;
  stammdaten: { strasse: string | null; plz: string | null; ort: string | null; land: string | null; geburtsdatum: string | null } | null;
  zahlung: { referenz: string | null; status: string | null; ref: string | null; empfaenger?: string | null; iban?: string | null; bic?: string | null; klartext?: string | null } | null;
  // ── E-042: „Rate überfällig – zurückholen“ – gefüllt aus /inkasso/liste, wenn erreichbar ──
  istRate?: boolean;
  rateCents?: number | null;
  rateNr?: number | null;
  rateFaelligAm?: string | null;
  rateAnzahl?: number;
  rateSummeCents?: number;
  /** E-045: die überfälligen Raten selbst (aus /inkasso/liste) – für die zwei Ausgänge in der Akte. */
  rateListe?: { id: number; rateNr: number; betragCents: number; faelligAm: string | null; status: string;
    lastschriftStatus?: string | null; lastschriftGrund?: string | null; sepaEingerichtet?: boolean }[];
  // ── E-044/§16a: vom Vertriebs-Router geliefert ──
  mandatSeit?: string | null;
  vollstaendig?: boolean;
}

type Zaehler = Record<string, number>;

/** Die Server-Ansichten — unverändert aus der alten Seite (Schlüssel = Filter des Servers). */
const ANSICHTEN: { key: string; label: string }[] = [
  { key: "alle", label: "Alle" },
  { key: "zusage_heute", label: "Zusage heute" },
  { key: "ueberfaellig", label: "Überfällig" },
  { key: "rueckruf", label: "Rückruf" },
  { key: "tier1", label: "Zahlung gemeldet" },
  { key: "rechnung_stellen", label: "Rechnung stellen" },
  { key: "rechnung_offen", label: "Rechnung offen" },
  { key: "frist_abgelaufen", label: "Frist abgelaufen" },
  { key: "antrag_offen", label: "Antrag offen" },
  { key: "leads", label: "Leads" },
  { key: "nicht_erreicht", label: "Nicht erreicht" },
  { key: "ruhend", label: "Ruhend" },
  { key: "wartend", label: "Wartend (Kunde)" },
  { key: "bezahlt", label: "Bezahlt (Bestand)" },
  { key: "gesperrt", label: "Gesperrt" },
  { key: "nummer_ohne_land", label: "Nummer nicht wählbar" },
];
const SORT: { key: string; label: string }[] = [
  { key: "arbeit", label: "Arbeitsreihenfolge" },
  { key: "neu", label: "Zuletzt hinzugefügt" },
  { key: "betrag", label: "Nach Betrag" },
  { key: "name", label: "Nach Name" },
];
const LAND_NAME: Record<string, string> = { DE: "Deutschland", AT: "Österreich", CH: "Schweiz", IT: "Italien", RO: "Rumänien", SK: "Slowakei" };

// ── Helfer ────────────────────────────────────────────────────────────────
// 24.08.2026 (Justin, Auftrag 2 — Collections öffnet DIESELBE Akte):
// VORHER ging der Anruf aus der Akte immer ohne Rate-Kennung raus. Das
// Telefon entscheidet aber an genau dieser Kennung, WELCHE Ergebnisliste es
// nach dem Gespräch anbietet — ohne sie bekam ein Anruf wegen einer
// überfälligen Rate die Vertriebs-Ergebnisse statt „Zahlt Rate am … / Nicht
// erreicht / Kein Kontakt mehr möglich", und das Ergebnis wurde nicht an der
// Rate gebucht. NACHHER reicht die Akte die Rate der aktuellen Situation mit
// — in der Pipeline wie in Collections.
const anrufen = (nummer: string | null | undefined, personId: number, name: string, rateId?: number | null) => {
  if (!nummer) return;
  window.dispatchEvent(new CustomEvent("fiaon-anrufen", { detail: { nummer, personId, name, rateId: rateId ?? null } }));
};
function heuteIso(): string { const d = new Date(); d.setHours(12, 0, 0, 0); return d.toISOString().slice(0, 10); }
function tagPlus(n: number): string { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
function dtag(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
function relativ(iso: string | null): { text: string; dringend: boolean } | null {
  if (!iso) return null;
  const heute = new Date(); heute.setHours(0, 0, 0, 0);
  const d = new Date(iso); d.setHours(0, 0, 0, 0);
  const t = Math.round((d.getTime() - heute.getTime()) / 86_400_000);
  if (t < 0) return { text: `seit ${Math.abs(t)} ${Math.abs(t) === 1 ? "Tag" : "Tagen"} überfällig`, dringend: true };
  if (t === 0) return { text: "heute", dringend: true };
  if (t === 1) return { text: "morgen", dringend: false };
  return { text: `in ${t} Tagen`, dringend: false };
}
function kontaktTage(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}
function wartezeit(iso: string | null): string {
  const t = kontaktTage(iso);
  if (t == null) return "noch kein Kontakt";
  if (t <= 0) return "heute kontaktiert";
  if (t === 1) return "gestern kontaktiert";
  return `seit ${t} Tagen kein Kontakt`;
}
function terminText(beginn: string): string {
  const d = new Date(beginn);
  const inBerlin = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  const uhr = d.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
  const tag = inBerlin(d);
  if (tag === inBerlin(new Date())) return `Heute ${uhr}`;
  if (tag === inBerlin(new Date(Date.now() + 86_400_000))) return `Morgen ${uhr}`;
  if (tag === inBerlin(new Date(Date.now() - 86_400_000))) return `Gestern ${uhr}`;
  return d.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", weekday: "short", day: "2-digit", month: "2-digit" }) + ` ${uhr}`;
}
function rueckrufFaellig(k: Kunde): boolean {
  if (k.rueckrufAm && new Date(k.rueckrufAm).getTime() <= Date.now()) return true;
  const z = relativ(k.zusagedatum);
  return !!z?.dringend;
}
/** E-047/§18 Nr. 9: Der GRUND an einer offenen Rate — eine Formulierung für
 *  Akte, Collections-Sicht und Raten-Gruppe. Erste Rechnung + SCHUFA zahlt der
 *  Kunde aktiv per Überweisung; die Folgeraten laufen per Lastschrift. */
function sepaGrund(r: { lastschriftStatus?: string | null; lastschriftGrund?: string | null; sepaEingerichtet?: boolean }): { text: string; ton: "rot" | "gelb" | "still" } {
  if (r.lastschriftStatus === "fehlgeschlagen") return { text: `Rücklastschrift${r.lastschriftGrund ? ` – ${r.lastschriftGrund}` : " – der Einzug kam zurück"}`, ton: "rot" };
  if (!r.sepaEingerichtet) return { text: "Kein SEPA eingerichtet – bitte den Kunden im Gespräch, die Lastschrift im Kundenbereich einzurichten", ton: "gelb" };
  return { text: "offen – Zahlung noch nicht bestätigt", ton: "still" };
}

async function inZwischenablage(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* Rückfall */ }
  try {
    const feld = document.createElement("textarea");
    feld.value = text; feld.style.position = "fixed"; feld.style.opacity = "0";
    document.body.appendChild(feld); feld.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(feld);
    return ok;
  } catch { return false; }
}
const paketText = (k: Kunde): string => {
  const offen = (k.buchungen ?? []).filter((b) => !b.erledigt);
  if (offen.length) return offen.map((b) => `${b.bezeichnung}${b.betragCents != null ? ` ${eur(b.betragCents)}` : ""}${b.bezahlt ? " (bezahlt)" : ""}`).join(" · ");
  return k.produkt || "kein Paket";
};

// ── Stufen nach Hitze (keine Buchstaben) – Übersetzung der Serverfelder ─────
type Hitze = "heiss" | "rate" | "warm" | "lead" | "aktiv";
const STUFE: Record<Hitze, { name: string; kurz: string; farbe: string; leitfaden: LeitfadenArt | "reaktivierung"; rang: number }> = {
  heiss: { name: "Bezahlt – Termin offen", kurz: "heiß", farbe: "#fb923c", leitfaden: "stufe_a", rang: 1 },
  // E-042: heißeste Farbe neben „Bezahlt – Termin offen“; weicher Reaktivierungs-Leitfaden, kein Inkasso-Ton.
  rate: { name: "Rate überfällig – zurückholen", kurz: "überfällig", farbe: "#f87171", leitfaden: "reaktivierung", rang: 2 },
  warm: { name: "Antrag fertig – Rechnung offen", kurz: "warm", farbe: "#fbbf24", leitfaden: "stufe_b", rang: 3 },
  lead: { name: "Registriert – noch kein Antrag", kurz: "Lead", farbe: "#60a5fa", leitfaden: "stufe_c", rang: 4 },
  aktiv: { name: "Aktiv – betreut", kurz: "aktiv", farbe: "#34d399", leitfaden: "startgespraech", rang: 5 },
};
const STUFEN_REIHE: Hitze[] = ["heiss", "rate", "warm", "lead", "aktiv"];
/** E-042: Reaktivierungsbonus – 50 % der zurückgeholten Rate für den Bonitätsmanager. */
const REAKTIVIERUNG_ANTEIL = 0.5;
/** SCHUFA-Bonus im Onboarding: 10 € je 74-€-Zahlung (Bonitätsauskunft). */
const SCHUFA_BONUS_TEXT = "+10 € SCHUFA-Bonus je 74-€-Zahlung im Onboarding";
/** Der weiche Reaktivierungs-Leitfaden (Justin, E-042) – bewusst KEIN Inkasso-Ton. */
const REAKTIVIERUNG = {
  key: "reaktivierung" as const,
  label: "Rate überfällig · zurückholen",
  kurz: "Weich einsteigen: vorstellen, zuhören, entschuldigen – dann zwei Wege anbieten. Kein Inkasso-Ton.",
  schritte: [
    { titel: "Vorstellung und Entschuldigung", text: "Du rufst an, um dich vorzustellen – nicht, um Geld einzutreiben. Der Kunde hatte einen schwierigen Start.", satz: "Guten Tag, mein Name ist … von FIAON – ich rufe an, um mich vorzustellen. Ich weiß, Sie hatten einen echt schwierigen Start bei uns, und dafür möchte ich mich entschuldigen." },
    { titel: "Zuhören", text: "Was ist passiert? Nicht unterbrechen, nichts rechtfertigen. Der Grund entscheidet über den Weg.", satz: "Erzählen Sie mir kurz, wo es gehakt hat – ich möchte verstehen, was bei Ihnen los war." },
    { titel: "Den Wert wieder aufbauen", text: "Was FIAON für sein Ziel schon getan hat und noch tut – Auskunft, Schreiben, Konto, Karte.", satz: "Ihr Ziel steht ja weiter: … Genau daran arbeiten wir – und Ihr Bereich zeigt Ihnen jeden Schritt." },
    { titel: "Zwei Wege anbieten", text: "Weg 1: Die offene Rate jetzt per Überweisung begleichen – dann läuft alles weiter. Weg 2: Einen Monat aussetzen und ein Onboarding-Gespräch buchen. Nie Lastschrift anbieten.", satz: "Ich sehe zwei Wege für Sie: Sie begleichen die offene Rate per Überweisung, dann läuft alles nahtlos weiter – oder wir setzen einen Monat aus und starten mit einem gemeinsamen Gespräch neu. Was passt besser?" },
    { titel: "Ergebnis festhalten", text: "Ausgang 1: Kunde zahlt → dein Reaktivierungsbonus (50 % der Rate). Ausgang 2: 1 Monat ausgesetzt + Onboarding-Termin gebucht → 0 €, aber der Kunde bleibt.", satz: "Danke für das Gespräch – Sie hören sofort von mir, sobald alles eingetragen ist." },
  ],
  einwaende: [
    { frage: "„Ich will kündigen.“", antwort: "Das können Sie jederzeit – bevor Sie es tun: Lassen Sie uns einen Monat aussetzen und in einem Gespräch schauen, was FIAON für Ihr Ziel schon erreicht hat. Kostet Sie nichts, und Sie entscheiden danach." },
    { frage: "„Ich habe gerade kein Geld.“", antwort: "Verstehe ich. Dann setzen wir einen Monat aus und buchen ein Gespräch – kein Druck, keine Mahnung. Wann ist Ihr nächster Gehaltseingang?" },
    { frage: "„Bei euch ist nichts passiert.“", antwort: "Das nehme ich ernst – genau deshalb rufe ich an. Lassen Sie uns im Gespräch durchgehen, was schon läuft und was als Nächstes kommt. Danach entscheiden Sie." },
  ],
};
// §16a-Zählung x/500 (nur übernommene Mandate): steht seit 24.08. allein im
// Bestand-Raum (bestand.tsx) — die Kachel hier ist auf Justins Wunsch entfallen.
/** Echter Paketmix Juli/August – dieselben Zahlen wie gehalt.tsx (MIX_STANDARD). */
const MIX_MOTTO: Record<string, number> = { start: 69, pro: 108, ultra: 67, highend: 93 };
/** SCHUFA-Bonus je Abschluss im Onboarding (E-042): 10 €. */
const SCHUFA_BONUS_CENTS = 1000;

/** Die Stufe aus priority_tier + Termin: Tier 1 = „bezahlt“ gemeldet, Tier 0 ohne Termin = bezahlt ohne Termin – beides heiß. */
function stufeVon(k: Kunde): Hitze {
  if (k.istRate) return "rate";
  if (k.tier === 1) return "heiss";
  if (k.tier === 0) return (k.termin || k.terminAm) ? "aktiv" : "heiss";
  if (k.tier === 2) return "warm";
  return "lead";
}
/** 0 … 1 – für Glühen und Größe im Strom. */
function hitzeVon(k: Kunde): number {
  if (rueckrufFaellig(k)) return 1;
  const s = stufeVon(k);
  return s === "heiss" ? (k.tier === 0 ? 0.95 : 0.85) : s === "rate" ? 0.9 : s === "warm" ? 0.6 : s === "lead" ? 0.3 : 0.12;
}
/** Monatspreis des Pakets in Cent – aus der Buchung, sonst Betrag, sonst Katalog über den Namen. */
function paketPreis(k: Kunde): number {
  const b = (k.buchungen ?? []).filter((x) => !x.erledigt && x.art === "paket");
  const p = b.find((x) => x.offen) ?? b[0];
  if (p?.betragCents) return p.betragCents;
  if (k.betrag) return k.betrag;
  const name = (k.produkt || "").toLowerCase().replace(/\s+/g, " ");
  const t = PAKETE.find((x) => name && name.includes(x.label.toLowerCase().replace(" (standard)", "")));
  return t?.preisCents ?? 0;
}
function jungAm(k: Kunde): number {
  const b = (k.buchungen ?? []).map((x) => x.gestelltAm).filter(Boolean) as string[];
  const d = b.length ? Math.max(...b.map((x) => new Date(x).getTime())) : (k.betreutSeit ? new Date(k.betreutSeit).getTime() : 0);
  return d;
}
/**
 * Die Reihenfolge für Fokus und Strom: Rückruf/Zusage fällig → bezahlt ohne
 * Termin → „bezahlt“ gemeldet → Antrag fertig ohne Zahlung (jüngste zuerst) →
 * Leads (jüngste zuerst) → aktiv. Ruhende und gesperrte ganz nach hinten.
 */
function rang(k: Kunde): number[] {
  if (k.gesperrt) return [9, 0];
  if (k.ruhtSeit) return [8, 0];
  if (rueckrufFaellig(k)) {
    const t = k.rueckrufAm ? new Date(k.rueckrufAm).getTime() : (k.zusagedatum ? new Date(k.zusagedatum).getTime() : 0);
    return [0, t];
  }
  const s = stufeVon(k);
  // E-042: Die überfälligen Raten stehen direkt nach den Rückrufen.
  if (s === "rate") return [1, k.rateFaelligAm ? new Date(k.rateFaelligAm).getTime() : 0];
  if (s === "heiss") return [k.tier === 0 ? 2 : 3, -(jungAm(k))];
  if (s === "warm") return [4, -(jungAm(k))];
  if (s === "lead") return [5, -(jungAm(k))];
  return [6, -(jungAm(k))];
}
function vergleich(a: Kunde, b: Kunde): number {
  const ra = rang(a), rb = rang(b);
  return ra[0] - rb[0] || ra[1] - rb[1];
}
/** Warum jetzt – ein Satz für die Fokus-Karte. */
function warumJetzt(k: Kunde): string {
  if (k.rueckrufAm && new Date(k.rueckrufAm).getTime() <= Date.now()) return `Rückruf war für ${terminText(k.rueckrufAm)} vereinbart – er wartet auf dich.`;
  const z = relativ(k.zusagedatum);
  if (z?.dringend) return `Zahlungszusage ${z.text} – jetzt nachfassen, Zahlungsdaten zur Hand.`;
  const s = stufeVon(k);
  if (s === "rate") return `Rate${k.rateNr ? ` ${k.rateNr}` : ""} über ${k.rateCents ? eur(k.rateCents) : "—"} ist ${k.rateFaelligAm ? `seit ${dtag(k.rateFaelligAm)} ` : ""}überfällig. Weich einsteigen: vorstellen, entschuldigen, zuhören – kein Inkasso-Ton.`;
  if (s === "heiss" && k.tier === 0) return "Bezahlt, aber noch kein Termin. Willkommen heißen und den nächsten freien Termin vergeben.";
  // E-047/§18 Nr. 6: VORHER stand hier der tier-Hinweis („keine Rechnung
  // verschickt – kein Verwendungszweck“) — fachlich falsch: Nach dem
  // Antragsabschluss geht die Rechnung mit Verwendungszweck IMMER automatisch
  // raus. NACHHER die richtigen Sätze:
  if (s === "heiss") return "Der Kunde hat die Zahlung angekündigt – das Geld ist noch nicht bestätigt. Termin sichern, Beleg erbitten, Eingang prüfen.";
  if (s === "warm") return "Antrag und Rechnung sind da – die Zahlung fehlt noch. Ruf an, vereinbare den Termin und weise dezent darauf hin: Geht die Rechnung vor dem Termin ein, aktivierst du im Gespräch direkt.";
  if (s === "lead") return k.hinweis || "Registriert, noch kein Antrag. Daten aufnehmen, Paket am Telefon annehmen lassen.";
  return k.termin ? `${terminText(k.termin.beginn)} · ${k.termin.art}` : (k.hinweis || "Betreuter Kunde.");
}

// ── Kleine Haken ──────────────────────────────────────────────────────────
function useMedia(q: string): boolean {
  const [m, setM] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => { const mq = window.matchMedia(q); const h = () => setM(mq.matches); mq.addEventListener("change", h); return () => mq.removeEventListener("change", h); }, [q]);
  return m;
}
const euro0 = (c: number) => (c / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

// ═══════════════════════════════════════════════════════════════════════════
// E-048 Nr. 1: TERMIN BUCHEN = KLICKBARE FREIE ZEITEN, NICHTS TIPPEN.
//
// VORHER: An allen drei Stellen (Fokus-Karte „Termin einbuchen“, Situations-
// Karte der Akte, „Mehr“-Menü → Termin buchen) standen ein Datum- und ein
// Uhrzeit-Feld — der Mitarbeiter tippte blind und erfuhr erst nach dem
// Abschicken, ob die Zeit in seiner Availability liegt oder belegt ist.
// NACHHER: SlotWahl lädt GET /agent/vertrieb/frei (dieselbe Slot-Rechnung wie
// die Kundenbuchung: rohSlots in server/lib/fiaon-termine), zeigt die Zeiten
// als Glas-Kacheln gruppiert nach Tag (Heute · Morgen · Mi 27.08.), ein Klick
// wählt, „Bestätigen“ bucht über den bestehenden POST /agent/termine — der
// serverseitig erneut prüft. Schlägt die Buchung fehl (Slot inzwischen weg),
// lädt die Auswahl neu statt den Fehler stehen zu lassen.
// ═══════════════════════════════════════════════════════════════════════════
interface FreiSlot { beginn: string; datum: string; uhrzeit: string; dauerMin: number }

/** „Heute“ · „Morgen“ · „Mi 27.08.“ — Tage in Berliner Zeit. */
function slotTagLabel(datum: string): string {
  const berlin = (t: number) => new Date(t).toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  if (datum === berlin(Date.now())) return "Heute";
  if (datum === berlin(Date.now() + 86_400_000)) return "Morgen";
  const d = new Date(`${datum}T12:00:00`);
  return `${d.toLocaleDateString("de-DE", { weekday: "short" }).replace(".", "")} ${d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}.`;
}

function SlotWahl({ laeuft, onBuchen, onZu }: {
  laeuft: boolean;
  /** Bucht den Slot; false = fehlgeschlagen (Auswahl lädt dann neu). */
  onBuchen: (beginnIso: string, label: string) => Promise<boolean>;
  onZu: () => void;
}) {
  const [slots, setSlots] = useState<FreiSlot[] | null>(null);
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);
  const [wahl, setWahl] = useState<FreiSlot | null>(null);
  const laden = useCallback(() => {
    setSlots(null); setLadeFehler(null); setWahl(null);
    api("/agent/vertrieb/frei").then((r) => {
      if (r.ok) setSlots(r.json.slots || []);
      else setLadeFehler(r.json?.error || "Die freien Zeiten konnten nicht geladen werden.");
    }).catch(() => setLadeFehler("Die freien Zeiten konnten nicht geladen werden."));
  }, []);
  useEffect(() => { laden(); }, [laden]);
  const tage = useMemo(() => {
    const m = new Map<string, FreiSlot[]>();
    for (const s of slots ?? []) { if (!m.has(s.datum)) m.set(s.datum, []); m.get(s.datum)!.push(s); }
    return Array.from(m.entries()).map(([datum, liste]) => ({ datum, label: slotTagLabel(datum), liste }));
  }, [slots]);
  const wahlLabel = wahl ? `${slotTagLabel(wahl.datum)}, ${wahl.uhrzeit} Uhr` : null;

  return (
    <div className="pi-termin">
      {ladeFehler ? (
        <p className="pi-fehler">{ladeFehler} <button type="button" className="pi-link" onClick={laden}>Erneut laden</button></p>
      ) : slots === null ? (
        <p className="pi-fussnote">Lade deine freien Zeiten …</p>
      ) : slots.length === 0 ? (
        <p className="pi-fussnote">Keine freien Zeiten – erweitere deine <Link href="/agent/arbeitszeiten">Availability</Link>.</p>
      ) : (
        <div className="pi-slots">
          {tage.map((t) => (
            <div key={t.datum} className="pi-slot-tag">
              <b>{t.label}</b>
              <div className="pi-slot-reihe">
                {t.liste.map((s) => (
                  <button key={s.beginn} type="button" className={`pi-slot${wahl?.beginn === s.beginn ? " an" : ""}`}
                          aria-pressed={wahl?.beginn === s.beginn}
                          onClick={() => setWahl(wahl?.beginn === s.beginn ? null : s)}>
                    {s.uhrzeit}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="pi-slot-fuss">
        {wahl ? (
          <>
            <b>{wahlLabel} · {wahl.dauerMin} Min</b>
            <button type="button" className="pi-knopf" disabled={laeuft}
                    onClick={async () => { if (wahl && !(await onBuchen(wahl.beginn, wahlLabel!))) laden(); }}>
              {laeuft ? "Bucht …" : "Bestätigen"}
            </button>
          </>
        ) : (slots?.length ?? 0) > 0 ? <span className="pi-fussnote">Zeit antippen, dann bestätigen.</span> : null}
        <button type="button" className="pi-link" onClick={onZu}>Schließen</button>
      </div>
      <p className="pi-fussnote">Die Zeiten kommen aus deiner Availability abzüglich deiner Termine – beim Bestätigen prüft der Server erneut und blockiert den Slot.</p>
    </div>
  );
}

// E-048 Nr. 2 → E-051 Nr. 1 (Justin 24.08.): VORHER rückten die kleinen
// Karten in einem RASTER per FLIP-Messung nach — NACHHER sind sie ein
// 3D-KARUSSELL (KleinesKarussell, unten bei KleineKarte): eine Karte steht
// immer mittig vorn, die Nachbarn perspektivisch dahinter; das Nachrücken
// nach einem Ergebnis ist eine transform-Transition, keine Messung mehr.
// Der FLIP-Haken (useFlip) ist damit ersatzlos entfallen.

export default function AgentPipelinePage() {
  // E-053: Toast im Office unten mittig, dunkles Glas (ton="dunkel").
  return <AgentShell><ToastAnbieter ton="dunkel"><PipelineInnen /></ToastAnbieter></AgentShell>;
}

// ── E-043: Die drei Gruppen der Arbeitsliste (Serverfeld: priority_tier) ────
const GRUPPE_INFO: Record<string, { name: string; stufe: Hitze }> = {
  bezahlt_gemeldet: { name: "Bezahlt gemeldet – Termin fehlt", stufe: "heiss" },
  rechnung_offen: { name: "Antrag fertig – Rechnung offen", stufe: "warm" },
  lead: { name: "Registriert – noch kein Antrag", stufe: "lead" },
};
interface Slot { gruppe: string; kunde: Kunde }

function PipelineInnen() {
  const { dunkel, titel } = useOffice();
  useEffect(() => { dunkel(true); titel("Pipeline"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const fragen = useFragen();

  // ── E-050 (Plan §19): VORHER zwei Reiter (Arbeitsliste · Mein Bestand mit
  //    3D-Strom, Suche, Filtern, Server-Ansichten) — NACHHER ist /agent/
  //    pipeline NUR noch die Arbeitsliste; das Portfolio der Mandate wohnt im
  //    neuen Raum /agent/bestand (bestand.tsx), der Akte und Strom von hier
  //    importiert. Die Liste (laden) bleibt UNSICHTBAR bestehen: Die Akte-Lade
  //    (?person=) braucht die zusammengeführten Daten (inkl. Raten aus
  //    /inkasso/liste) weiterhin. ─────────────────────────────────────────────
  // Arbeitsliste (E-043): genau 6 Slots vom Server.
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsZaehler, setSlotsZaehler] = useState<Record<string, number>>({});
  const [slotsLaedt, setSlotsLaedt] = useState(true);
  const [slotsFehler, setSlotsFehler] = useState<string | null>(null);
  const [fokusId, setFokusId] = useState<number | null>(null);
  const [geht, setGeht] = useState<Set<number>>(new Set());
  const [meldungA, setMeldungA] = useState<{ art: "gut" | "schlecht" | "info"; text: string } | null>(null);
  // Datenrücken für die Akte (unsichtbar, siehe Kommentar oben)
  const [liste, setListe] = useState<Kunde[]>([]);
  const [zaehler, setZaehler] = useState<Zaehler>({});
  const [erledigt, setErledigt] = useState<Set<number>>(new Set());
  const [laedt, setLaedt] = useState(true);
  const [ansicht] = useState("alle");
  const [sort] = useState("arbeit");
  const [suche] = useState("");
  const [nurPerson, setNurPerson] = useState<number | null>(null);
  const [rolle, setRolle] = useState<string>("agent");
  const [satz, setSatz] = useState(0.25);
  const [anlageOffen, setAnlageOffen] = useState(false);
  // §16a: Nur übernommene Mandate zählen als „Aktive Kunden“ (mandat_seit).
  const [mandate, setMandate] = useState<{ anzahl: number; ids: Set<number> }>({ anzahl: 0, ids: new Set() });
  const [offen, setOffen] = useState<number | null>(null);
  const [fremd, setFremd] = useState<Kunde | null>(null);
  const ruhig = useMedia("(prefers-reduced-motion: reduce)");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    // E-050: `?filter=`/`?tab=bestand` steuerten den entfernten Bestand-Reiter —
    // sie werden ignoriert; der Bestand wohnt unter /agent/bestand.
    const person = p.get("person");
    if (person && Number(person) > 0) { setOffen(Number(person)); setNurPerson(Number(person)); }
    api("/agent/provision-satz").then((r) => { if (r.ok && r.json?.satz) setSatz(Number(r.json.satz)); }).catch(() => {});
  }, []);

  // ── E-043: Die 6 Slots kommen fertig vom Server (GET /agent/vertrieb/arbeitsliste) ──
  const arbeitslisteLaden = useCallback(async (leise = false) => {
    if (!leise) setSlotsLaedt(true);
    const r = await api("/agent/vertrieb/arbeitsliste");
    if (r.ok) {
      setSlots(r.json.slots || []);
      setSlotsZaehler(r.json.zaehler || {});
      if (r.json.rolle) setRolle(r.json.rolle);
      if (r.json.mandate) setMandate((m) => ({ ...m, anzahl: Number(r.json.mandate.anzahl || 0) }));
      setSlotsFehler(null);
    } else setSlotsFehler(r.json?.error || "Die Arbeitsliste konnte nicht geladen werden.");
    setSlotsLaedt(false);
    setGeht(new Set());
  }, []);
  useEffect(() => { void arbeitslisteLaden(); }, [arbeitslisteLaden]);

  const laden = useCallback(async (leise = false, nurZaehler = false) => {
    if (!leise) setLaedt(true);
    const p = new URLSearchParams({ filter: ansicht, sort, limit: "500" });
    if (suche.trim()) p.set("q", suche.trim());
    if (nurPerson) p.set("person", String(nurPerson));
    const mitAktiven = ansicht === "alle" && !suche.trim();
    const [r, b, ink] = await Promise.all([
      api(`/agent/kunden/liste?${p.toString()}`),
      mitAktiven ? api(`/agent/kunden/liste?filter=bezahlt&sort=neu&limit=200`) : Promise.resolve(null),
      // E-042: überfällige Raten – nur echte Daten, ohne Zugriff bleibt die Gruppe ehrlich leer.
      mitAktiven ? api(`/inkasso/liste?limit=60`).catch(() => null) : Promise.resolve(null),
    ]);
    // §16a: Mandats-Kennungen für Zählung und Bestand-Gruppen.
    const man = await api(`/agent/vertrieb/mandate`).catch(() => null);
    if (man?.ok) setMandate({ anzahl: Number(man.json.anzahl || 0), ids: new Set<number>((man.json.ids || []).map(Number)) });
    if (r.ok) {
      if (!nurZaehler) {
        const haupt: Kunde[] = r.json.kunden || [];
        const ids = new Set(haupt.map((k) => k.personId));
        const extra: Kunde[] = b?.ok ? (b.json.kunden || []).filter((k: Kunde) => !ids.has(k.personId)) : [];
        const zusammen = [...haupt, ...extra];
        if (ink?.ok && Array.isArray(ink.json?.personen)) {
          ink.json.personen.forEach((pers: any, i: number) => {
            const d = pers.dringendste || pers.raten?.[0] || {};
            const felder = {
              istRate: true, rateCents: d.betrag_cents != null ? Number(d.betrag_cents) : null,
              rateNr: d.rate_nr != null ? Number(d.rate_nr) : null,
              rateFaelligAm: d.faellig_am ?? null,
              rateAnzahl: Number(pers.anzahl || pers.raten?.length || 1),
              rateSummeCents: Number(pers.summeCents || 0),
              // E-045: die Raten selbst – die Akte bucht darauf Erinnerung/Ergebnis.
              rateListe: (pers.raten || []).map((x: any) => ({
                id: Number(x.rate_id ?? x.id), rateNr: Number(x.rate_nr),
                betragCents: Number(x.betrag_cents || 0), faelligAm: x.faellig_am ?? null,
                status: String(x.status || "offen"),
                // E-047/§18 Nr. 9: der Grund an der Rate (SEPA fehlt / Rücklastschrift / offen)
                lastschriftStatus: x.lastschrift_status ?? null,
                lastschriftGrund: x.lastschrift_grund ?? null,
                sepaEingerichtet: String(x.gc_mandate_status || "") === "active",
              })),
            };
            const da = pers.personId != null ? zusammen.find((k) => k.personId === Number(pers.personId)) : undefined;
            if (da) Object.assign(da, felder);
            else zusammen.push({
              personId: pers.personId != null ? Number(pers.personId) : -(i + 1),
              name: String(pers.name || "Ohne Namen"),
              telefon: pers.telefonAnzeige ?? pers.phone ?? null,
              telefonWaehlbar: pers.telefonWaehlbar ?? null,
              telefonHinweis: pers.telefonHinweis ?? null,
              email: pers.email ?? null,
              tier: 0, tierGrund: "bezahlt", titel: "", hinweis: "",
              produkt: null, buchungen: [], betrag: felder.rateCents,
              zusagedatum: null, wiedervorlage: null, rueckrufAm: null,
              nichtErreicht: 0, rechnungVersandt: 0, stufe: null, ruhtSeit: null,
              terminlinkMailAm: null, terminAm: null, terminLink: "", gesperrt: false,
              betreutSeit: null, letzterKontakt: null, letztesErgebnis: null,
              stammdaten: null, zahlung: null, ...felder,
            });
          });
        }
        setListe(zusammen);
        setErledigt(new Set());
      }
      setZaehler({ ...(r.json.zaehler ?? {}), ...(r.json.zaehlerUeberschrieben ?? {}) });
      setRolle(r.json.rolle ?? "agent");
    }
    // E-050: Ein Fehler der (unsichtbaren) Liste bleibt still — die Akte
    // fällt dann auf /agent/crm/kunden/:id zurück (fremd).
    setLaedt(false);
  }, [ansicht, sort, suche, nurPerson]);

  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent).detail || {};
      if (d.personId) setErledigt((v) => new Set(v).add(Number(d.personId)));
      void laden(true, true);
      void arbeitslisteLaden(true);
    };
    window.addEventListener("fiaon-ergebnis", h);
    return () => window.removeEventListener("fiaon-ergebnis", h);
  }, [laden, arbeitslisteLaden]);
  useEffect(() => { const t = setTimeout(() => void laden(), suche ? 280 : 0); return () => clearTimeout(t); }, [laden, suche]);

  useEffect(() => {
    if (!offen || laedt) { setFremd(null); return; }
    if (liste.some((k) => k.personId === offen) || slots.some((s) => s.kunde.personId === offen)) { setFremd(null); return; }
    let an = true;
    api(`/agent/crm/kunden/${offen}`).then((r) => { if (an) setFremd(r.ok && r.json?.kunde ? r.json.kunde : null); });
    return () => { an = false; };
  }, [offen, laedt, liste, slots]);

  const oeffnen = (id: number | null) => {
    if (id != null && id < 0) return;
    setOffen(id);
    const u = new URL(window.location.href);
    if (id) u.searchParams.set("person", String(id)); else u.searchParams.delete("person");
    window.history.replaceState(null, "", u.toString());
  };
  // E-047 Nr. 2: VORHER document.body — der Hintergrund scrollte am Handy
  // trotzdem mit. NACHHER wie die Office-Schublade: #root wird gesperrt.
  useEffect(() => {
    const r = document.getElementById("root");
    if (r) r.style.overflow = offen ? "hidden" : "";
    document.body.style.overflow = offen ? "hidden" : "";
    return () => { if (r) r.style.overflow = ""; document.body.style.overflow = ""; };
  }, [offen]);

  const entfernen = (personId: number) => {
    setListe((l) => l.filter((k) => k.personId !== personId));
    setErledigt((e) => { const n = new Set(e); n.delete(personId); return n; });
    setSlots((sl) => sl.filter((s) => s.kunde.personId !== personId));
  };
  const ersetzen = (k: Kunde) => {
    setListe((l) => (l.some((x) => x.personId === k.personId) ? l.map((x) => (x.personId === k.personId ? k : x)) : l));
    setSlots((sl) => sl.map((s) => (s.kunde.personId === k.personId ? { ...s, kunde: k } : s)));
    setFremd((f) => (f && f.personId === k.personId ? k : f));
  };

  // ── E-043: EIN Ergebnisweg – alles über den bestehenden aktivitaet-Endpunkt.
  //    „Nicht erreicht“ löst dort die Staffel aus (fiaon-nicht-erreicht.ts),
  //    „Nummer falsch“ die Nummern-Mail, „erreicht_abgelehnt“ die Sperre
  //    (is_blocked → aus allen Listen und aus der Verteilung).
  const ergebnisSchnell = async (k: Kunde, art: string, notiz?: string, zusatz?: Record<string, unknown>): Promise<boolean> => {
    const r = await api(`/agent/crm/kunden/${k.personId}/aktivitaet`, {
      method: "POST", body: JSON.stringify({ art, notiz, ...(zusatz ?? {}) }),
    });
    if (!r.ok) { setMeldungA({ art: "schlecht", text: r.json?.error || "Nicht gespeichert. Bitte erneut versuchen." }); return false; }
    setMeldungA({ art: "gut", text: r.json?.meldung || "Gespeichert." });
    // E-048 Nr. 2: Karte gleitet hinaus (piGeht, 350 ms), erst DANACH füllt
    // der Server die 6 Slots leise nach — kein Neuladen, kein Flackern; die
    // kleinen Karten rücken per FLIP nach (useFlip). VORHER 420 ms auf eine
    // 400-ms-Animation — NACHHER 380 ms auf 350 ms, dieselbe Reserve.
    setGeht((g) => new Set(g).add(k.personId));
    setFokusId(null);
    window.setTimeout(() => { void arbeitslisteLaden(true); void laden(true, true); }, 380);
    return true;
  };
  const karteileiche = async (k: Kunde) => {
    if (!(await fragen({
      titel: `${k.name} aus dem Vertrieb entfernen?`,
      text: "Der Kunde wird gesperrt: Er erscheint bei keinem Mitarbeiter mehr und die Verteilung fasst ihn nicht mehr an. Zahlungs- und Vertragsdaten bleiben erhalten – gelöscht wird nichts.",
      folge: "Der Vorgang steht mit Grund im Kontaktprotokoll.",
      ja: "Entfernen", gefaehrlich: true,
    }))) return;
    await ergebnisSchnell(k, "erreicht_abgelehnt", "Karteileiche – aus dem Vertrieb entfernt (Sperre, kein Löschen).");
  };

  // §16a-Zählung (x/500): VORHER als Kachel „Aktive Kunden · Mandate“ hier
  // oben — NACHHER (Justin 24.08.) wohnt die Zahl NUR noch im Bestand-Raum.

  // E-050: Stufen-Chips, Filter, 3D-Strom und Tastatur-Blättern sind mit dem
  // Bestand-Reiter nach /agent/bestand umgezogen (bestand.tsx).
  const geoeffnet = useMemo(() => liste.find((k) => k.personId === offen) || slots.find((s) => s.kunde.personId === offen)?.kunde || fremd || null, [liste, slots, offen, fremd]);

  // ── Arbeitsliste: Fokus = gewählter Slot, sonst der erste ───────────────
  const fokusSlot = useMemo(() => slots.find((s) => s.kunde.personId === fokusId) ?? slots[0] ?? null, [slots, fokusId]);
  const kleine = useMemo(() => slots.filter((s) => s.kunde.personId !== (fokusSlot?.kunde.personId ?? -1)), [slots, fokusSlot]);

  return (
    <div className="pi">
      {/* Umsatz-Leiste. VORHER (bis 23.08. abends): drei Kacheln — „Heute
          erreichbar“, „Dein Hebel“ (groß), „Aktive Kunden“. NACHHER (Justin):
          nur noch „Aktive Kunden x/500“; der Hebel steht als schmale Zeile
          unter der Arbeitsliste. */}
      {/* E-050: VORHER trug die Leiste nur die Zahl — NACHHER verlinkt sie in
          den neuen Bestand-Raum (/agent/bestand), denn dort WOHNT das
          Portfolio jetzt. Daneben: „Kunde anlegen“ (blieb beim Umzug hier,
          weil ein neuer Kunde Arbeit ist, kein Mandat). */}
      {/* VORHER (bis 24.08. früh): große Kachel „Aktive Kunden · Mandate x/500“
          mit Balken — NACHHER (Justin 24.08.): Kachel weg; die beiden Funktionen
          (Bestand-Link, Kunde anlegen) bleiben als stille Zeile erhalten. */}
      <div className="pi-kopfzeile">
        <Link href="/agent/bestand" className="pi-link">Dein Bestand → Portfolio</Link>
        <button type="button" className="pi-link" onClick={() => setAnlageOffen((v) => !v)}>{anlageOffen ? "Anlage schließen" : "+ Kunde anlegen"}</button>
      </div>
      {anlageOffen && (
        <div style={{ display: "grid", gap: 6 }}>
          {/* Helle Einlage, bewusst gerahmt: KundeAnlegen ist die geprüfte
              Anlage-Strecke (anlegen → Zahlungsdaten → Termin) und bleibt
              vorerst hell — Rest, siehe Bericht. */}
          <p className="pi-fussnote">Kunde anlegen öffnet die geprüfte Anlage-Strecke:</p>
          <div className="pi-hell"><KundeAnlegen offen={anlageOffen} aufKlappen={setAnlageOffen} fertig={() => { void laden(true); void arbeitslisteLaden(true); }} /></div>
        </div>
      )}
      {/* VORHER stand hier die gelbe Kachel „x warten auf ihren Termin“ —
          NACHHER (Justin 24.08.) ersatzlos entfernt. */}

      {/* E-050: VORHER zwei Reiter (Arbeitsliste · Mein Bestand) — NACHHER ist
          diese Seite NUR die Arbeitsliste; der Bestand wohnt in /agent/bestand. */}
      <>
          {meldungA && <p className={`pi-meldung ${meldungA.art === "gut" ? "gut" : meldungA.art === "schlecht" ? "schlecht" : ""}`}>{meldungA.text}</p>}
          {slotsFehler && <p className="pi-fehler">{slotsFehler}</p>}
          {slotsLaedt ? (
            <div className="pi-laedt">Lade deine Arbeitsliste …</div>
          ) : slots.length === 0 && !slotsFehler ? (
            <div className="pi-fokus-karte">
              <span className="pi-pille">Arbeitsliste</span>
              <h1>{rolle === "onboarding" ? "Dein Tag läuft über den Calendar." : "Alles abgearbeitet – stark."}</h1>
              <p className="pi-fokus-warum">{rolle === "onboarding"
                ? "Onboarding arbeitet Startgespräche, keinen Vertrieb – deine Termine stehen im Calendar."
                : "Gerade wartet niemand auf einen Anruf. Neue Kunden rücken automatisch nach – oder schau in deinen Bestand."}</p>
            </div>
          ) : (
            <section className="pi-arbeit einspaltig">
              <div className="pi-arbeit-haupt">
                {fokusSlot && (
                  <ArbeitsFokus key={fokusSlot.kunde.personId} k={fokusSlot.kunde} gruppe={fokusSlot.gruppe} satz={satz}
                                geht={geht.has(fokusSlot.kunde.personId)}
                                onAkte={() => oeffnen(fokusSlot.kunde.personId)}
                                onEntfernen={() => void karteileiche(fokusSlot.kunde)} />
                )}
                {/* E-047 (Justin, Screenshot): Trenner zwischen JETZT und DANACH —
                  animierte Zeile „Deine nächsten Kunden“, Linien beidseits. */}
              <div className="pi-trenner"><span className="linie" aria-hidden="true" /><b>Deine nächsten Kunden</b><span className="linie" aria-hidden="true" /></div>
              {/* E-051 Nr. 1 (Justin): VORHER ein 2-spaltiges Raster (FLIP) —
                  NACHHER ein 3D-Karussell: eine Karte mittig vorn, Nachbarn
                  perspektivisch dahinter; Pfeile, Wischen, Tastatur; Klick auf
                  die Mitte holt sie in den Fokus.
                  24.08.2026: VORHER lief am Handy die flache Wisch-Reihe —
                  Justin sieht das Office aber vor allem am Handy und will
                  DORT das 3D-Karussell zum Wischen. NACHHER bleibt flach nur
                  für „Bewegung reduzieren" (Systemeinstellung). */}
              <KleinesKarussell kinder={kleine} geht={geht} gesperrt={offen != null} flach={ruhig}
                                onFokus={(id) => setFokusId(id)}
                                onAkte={(id) => oeffnen(id)}
                                onEntfernen={(k) => void karteileiche(k)} />
              </div>
            </section>
          )}
          {/* E-051 Nr. 2 (Justin): VORHER standen hier die Fußzeile
              „Höchstens 6 auf einmal – je 2 …“ und die Hebel-Zeile
              („Jeden Tag 5 Mandate … Rechne selbst → Earnings“) — NACHHER
              beide entfernt; die Leitfäden-Legende ist das einzige Element
              unter der Arbeitsliste. */}
          <LeitfadenLegende aktiv={fokusSlot ? (GRUPPE_INFO[fokusSlot.gruppe]?.stufe ?? null) : null} />
      </>

      {/* VORHER lag die Lade im Stapel-Kontext von .of-grund (z-index 1) – der
          Office-Kopf (z-30) malte IMMER über den Akte-Kopf („oben abgeschnitten",
          Justin 3×). NACHHER: Portal an document.body, eigener Kontext. */}
      {offen && createPortal(
        <>
          <div className="pi-lade-hintergrund" onClick={() => oeffnen(null)} aria-hidden="true" />
          {geoeffnet ? (
            <Akte key={geoeffnet.personId} k={geoeffnet} onZu={() => oeffnen(null)}
                  onWeg={() => { entfernen(geoeffnet.personId); oeffnen(null); void arbeitslisteLaden(true); }}
                  onNeu={ersetzen}
                  onErledigt={() => setErledigt((e) => new Set(e).add(geoeffnet.personId))}
                  onZaehler={() => { void laden(true, true); void arbeitslisteLaden(true); }} />
          ) : (
            <aside className="pi-lade" role="dialog" aria-modal="true">
              {/* E-049 Nr. 1: Kopf im selben sticky Glas-Block wie in der vollen Akte. */}
              <div className="pi-lade-fest"><div className="pi-lade-kopf"><span /><h2>{laedt ? "Lade …" : "Akte nicht gefunden"}</h2>
                <button type="button" className="pi-lade-zu" onClick={() => oeffnen(null)} aria-label="Schließen"><X size={18} /></button></div></div>
              {!laedt && <div className="pi-lade-koerper"><p className="pi-fussnote">Dieser Kunde gehört nicht zu deinem Bestand oder die Kennung stimmt nicht.</p></div>}
            </aside>
          )}
        </>, document.body)
      }
      {/* 24.08.2026: Rundgang je Raum (E-063). Steht bewusst HIER am Ende der
          Seiten-Komponente — ein erster Einbau war versehentlich in der
          Terminauswahl gelandet, die nur beim Buchen erscheint; auf der
          Pipeline kam deshalb gar nichts. */}
      <Rundgang raum="pipeline" titel={RUNDGAENGE.pipeline.titel} schritte={RUNDGAENGE.pipeline.schritte} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Die Fokus-Karte der Arbeitsliste — Herz des Umsatz-Raums.
//
// VORHER (E-043/E-044, bis 24.08. früh): Die Karte trug die ganze Werkbank —
// Anrufen · Akte · Zugänge senden · Zahlungsdaten senden · Termin buchen und
// darunter den Ergebnisweg (Mandat angenommen / nicht zustande gekommen mit
// Gründen). Die Akte trug dieselben Knöpfe ein zweites Mal.
// NACHHER (Justin 24.08.): Die Karte SAGT nur noch, wer dran ist und warum —
// und hat EINEN Knopf: „Starten“. Er öffnet die Akte; dort steht alles, was
// hier entfernt wurde, an der passenderen Stelle (Situations-Kopf mit dem
// richtigen Primär-Knopf, „Mehr“-Menü, Mandats-Abschluss). Ein Weg statt zwei.
// ═══════════════════════════════════════════════════════════════════════════
function ArbeitsFokus({ k, gruppe, satz, geht, onAkte, onEntfernen }: {
  k: Kunde; gruppe: string; satz: number; geht: boolean;
  onAkte: () => void;
  onEntfernen: () => void;
}) {
  const info = GRUPPE_INFO[gruppe] ?? GRUPPE_INFO.lead;
  const st = STUFE[info.stufe];
  const preis = paketPreis(k); const wert = preis * 12;
  // E-047 Nr. 5: VORHER drei große Zähl-Kacheln („viel zu wuchtig“) —
  // NACHHER eine schlanke Chip-Zeile ohne Zählanimation.
  const [warumAuf, setWarumAuf] = useState(false);
  const faellig = rueckrufFaellig(k);

  return (
    <div className={`pi-fokus-karte kompakt${geht ? " geht" : " tief"}`} style={{ ["--hitze" as string]: faellig ? "#f87171" : st.farbe }}>
      <div className="pi-fokus-kopf">
        <span className="pi-pille">{faellig ? "Rückruf fällig" : "Jetzt anrufen"}</span>
        <button type="button" className="pi-link" style={{ color: "#64748b" }} onClick={onEntfernen} title="Karteileiche? Sperren statt löschen – mit Rückfrage.">Entfernen</button>
      </div>
      <h1>{k.name}</h1>
      <div className="pi-fokus-stufe"><i className="pi-glut" /><b>{info.name}</b><span>· {(k.buchungen ?? []).find((b) => !b.erledigt && b.art === "paket")?.bezeichnung || k.produkt || "noch kein Paket"}{preis ? ` · ${eur(preis)} im Monat` : ""}</span></div>
      {/* E-047 Nr. 5+6: max. 2 Zeilen mit Ausklapp; fachlich richtige Texte in warumJetzt(). */}
      <p className={`pi-fokus-warum${warumAuf ? "" : " knapp"}`} onClick={() => setWarumAuf((v) => !v)} title={warumAuf ? "einklappen" : "ganzen Text zeigen"}>{warumJetzt(k)}</p>
      <div className="pi-fokus-chips">
        <span className="pi-marke">Wert: {preis ? euro0(wert) : "–"} · 12 Raten</span>
        <span className="pi-marke gut">Deine Provision: {preis ? euro0(Math.round(wert * satz)) : "–"}</span>
        <span className="pi-marke still">{wartezeit(k.letzterKontakt)}{k.nichtErreicht > 0 ? ` · ${k.nichtErreicht}× nicht erreicht` : ""}</span>
      </div>

      {/* Justin 24.08.: EIN Knopf statt sieben — „Starten“ öffnet die Akte. */}
      <div className="pi-fokus-knoepfe">
        <button type="button" className="pi-knopf riesig pi-starten" onClick={onAkte}>
          <Play size={19} strokeWidth={2} /> Starten
        </button>
        <span className="pi-starten-neben">Öffnet die Akte: anrufen, Schritt erledigen, Ergebnis festhalten.</span>
      </div>
    </div>
  );
}

/** Eine der 5 kleinen Karten der Arbeitsliste. */
function KleineKarte({ k, gruppe, geht, onFokus, onAkte, onEntfernen }: {
  k: Kunde; gruppe: string; geht: boolean; onFokus: () => void; onAkte: () => void; onEntfernen: () => void;
}) {
  const info = GRUPPE_INFO[gruppe] ?? GRUPPE_INFO.lead;
  const st = STUFE[info.stufe];
  const faellig = rueckrufFaellig(k);
  return (
    <div className={`pi-ak${geht ? " geht" : ""}`} style={{ ["--hitze" as string]: faellig ? "#f87171" : st.farbe }}>
      <button type="button" className="pi-ak-kern" onClick={onFokus} title="Nach vorn holen">
        <span className="pi-ak-kopf"><i className="pi-glut" /><small>{faellig ? "Rückruf fällig" : info.name}</small></span>
        <b>{k.name}</b>
        <span className="pi-ak-fuss">{(k.buchungen ?? []).find((b) => !b.erledigt && b.art === "paket")?.bezeichnung || k.produkt || "kein Paket"} · {wartezeit(k.letzterKontakt)}</span>
      </button>
      <span className="pi-ak-tun">
        <button type="button" className="pi-knopf klein" disabled={!k.telefonWaehlbar} onClick={() => anrufen(k.telefonWaehlbar, k.personId, k.name)} title={k.telefonWaehlbar ?? "nicht anrufbar"}><Phone size={13} strokeWidth={1.75} /></button>
        <button type="button" className="pi-knopf still klein" onClick={onAkte}><FileText size={13} strokeWidth={1.75} /></button>
        <button type="button" className="pi-link" style={{ color: "#64748b", fontSize: 11 }} onClick={onEntfernen} title="Karteileiche? Sperren statt löschen – mit Rückfrage.">Entfernen</button>
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// E-051 Nr. 1 (Justin 24.08.): „Deine nächsten Kunden“ als 3D-KARUSSELL.
//
// VORHER: ein 2-spaltiges Raster (.pi-arbeit-klein) mit FLIP-Nachrücken.
// NACHHER: Eine Karte steht IMMER mittig vorn (groß, scharf), die Nachbarn
// links/rechts perspektivisch dahinter (rotateY/translateZ/scale, gedimmt).
// Pfeile + Wischen + Pfeiltasten blättern; Klick auf eine Seitenkarte holt
// sie in die Mitte, Klick auf die Mitte holt den Kunden nach vorn in den
// Fokus (onFokus, wie bisher der Raster-Klick). Nach einem Ergebnis ändern
// sich die Indizes und die Karten GLEITEN auf ihre neuen Plätze (transition
// auf transform, 350 ms, dieselbe Kurve wie piGeht/piTief). `flach` (Handy
// oder prefers-reduced-motion): flache Wisch-Reihe mit Scroll-Snap, die
// Mitte zentriert — keine 3D-Bewegung.
// ═══════════════════════════════════════════════════════════════════════════
function KleinesKarussell({ kinder, geht, gesperrt, flach, onFokus, onAkte, onEntfernen }: {
  kinder: Slot[]; geht: Set<number>; gesperrt: boolean; flach: boolean;
  onFokus: (id: number) => void; onAkte: (id: number) => void; onEntfernen: (k: Kunde) => void;
}) {
  const [mitte, setMitte] = useState(0);
  // Am Handy sind die Karten schmaler, also rücken die Nachbarn enger
  // zusammen (sonst stünde die vordere Karte allein auf weiter Flur).
  // Der Hook steht GANZ OBEN: unterhalb der frühen Rückgaben (leere Liste,
  // flache Fassung) wäre die Hook-Reihenfolge nicht mehr stabil.
  const eng = useMedia("(max-width: 700px)");
  // Justin 24.08.: „das man nach rechts und links wischen kann“ — der Zug
  // folgt dem Finger/der Maus in Echtzeit (zieh in Karten-Anteilen), beim
  // Loslassen rastet die nächste Karte ein.
  const [zug, setZug] = useState(0);
  const zieh = useRef<{ x: number; start: number; t: number; id: number } | null>(null);
  const buehne = useRef<HTMLDivElement | null>(null);
  const flachRef = useRef<HTMLDivElement | null>(null);
  // Rückt ein Kunde nach oder geht einer, bleibt die Mitte im gültigen Bereich.
  useEffect(() => { setMitte((m) => Math.min(m, Math.max(0, kinder.length - 1))); }, [kinder.length]);
  const vor = () => setMitte((m) => Math.min(kinder.length - 1, m + 1));
  const zurueck = () => setMitte((m) => Math.max(0, m - 1));
  // Pfeiltasten blättern das Karussell — nur solange keine Akte offen ist.
  useEffect(() => {
    if (flach) return;
    const h = (e: KeyboardEvent) => {
      if (gesperrt) return;
      const ziel = e.target as HTMLElement | null;
      if (ziel && /^(INPUT|TEXTAREA|SELECT)$/.test(ziel.tagName)) return;
      if (e.key === "ArrowRight") { setMitte((m) => Math.min(kinder.length - 1, m + 1)); e.preventDefault(); }
      if (e.key === "ArrowLeft") { setMitte((m) => Math.max(0, m - 1)); e.preventDefault(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [gesperrt, flach, kinder.length]);

  if (kinder.length === 0) return null;

  const karte = (s: Slot) => (
    <KleineKarte k={s.kunde} gruppe={s.gruppe} geht={geht.has(s.kunde.personId)}
                 onFokus={() => onFokus(s.kunde.personId)}
                 onAkte={() => onAkte(s.kunde.personId)}
                 onEntfernen={() => onEntfernen(s.kunde)} />
  );

  if (flach) {
    return (
      <div className="pi-kar-flach" ref={flachRef}>
        {kinder.map((s) => <div key={s.kunde.personId} className="pi-kar-flach-zelle">{karte(s)}</div>)}
      </div>
    );
  }

  // Ein Karten-Schritt in Pixeln — daran misst sich der Zug (`eng` steht oben).
  const SCHRITT = eng ? 150 : 210;
  const zugStart = (x: number, id: number) => { zieh.current = { x, start: x, t: Date.now(), id }; };
  const zugLauf = (x: number) => {
    if (!zieh.current) return;
    const dx = x - zieh.current.start;
    // An den Enden zäh laufen lassen (Gummiband), damit der Rand spürbar ist.
    const roh = -dx / SCHRITT;
    const ziel = mitte + roh;
    const gebremst = ziel < 0 ? roh * 0.35 : ziel > kinder.length - 1 ? roh * 0.35 : roh;
    setZug(gebremst);
  };
  const zugEnde = (x: number) => {
    if (!zieh.current) return;
    const dx = x - zieh.current.start;
    const schnell = Date.now() - zieh.current.t < 400 && Math.abs(dx) > 45;
    const schritte = schnell ? (dx < 0 ? 1 : -1) : Math.round(-dx / SCHRITT);
    setMitte((m) => Math.max(0, Math.min(kinder.length - 1, m + schritte)));
    setZug(0);
    zieh.current = null;
  };

  const versatz = mitte + zug; // gebrochener Stand während des Ziehens
  return (
    <div className="pi-kar">
      <button type="button" className="pi-lade-zu pi-kar-pfeil" onClick={zurueck} disabled={mitte <= 0} aria-label="vorherige Karte"><ChevronLeft size={18} /></button>
      <div className={`pi-kar-buehne${zieh.current ? " zieht" : ""}`} ref={buehne}
           onTouchStart={(e) => zugStart(e.touches[0].clientX, 0)}
           onTouchMove={(e) => zugLauf(e.touches[0].clientX)}
           onTouchEnd={(e) => zugEnde(e.changedTouches[0].clientX)}
           onPointerDown={(e) => { if (e.pointerType === "touch") return; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); zugStart(e.clientX, e.pointerId); }}
           onPointerMove={(e) => { if (zieh.current && e.pointerType !== "touch") zugLauf(e.clientX); }}
           onPointerUp={(e) => { if (e.pointerType !== "touch") zugEnde(e.clientX); }}
           onPointerCancel={() => { setZug(0); zieh.current = null; }}>
        {kinder.map((s, i) => {
          const d = i - versatz; const ad = Math.abs(d);
          const dreh = Math.max(-1, Math.min(1, d)) * -34; // Nachbarn drehen sich weg
          return (
            <div key={s.kunde.personId} className={`pi-kar-zelle${Math.abs(d) < 0.5 ? " mitte" : ""}${zieh.current ? " frei" : ""}`}
                 style={{
                   transform: `translate(-50%,-50%) translateX(${d * SCHRITT}px) translateZ(${-ad * 190}px) rotateY(${dreh}deg) scale(${Math.max(0.6, 1 - ad * 0.11)})`,
                   opacity: Math.max(0, 1 - ad * 0.34), zIndex: 100 - Math.round(ad * 10),
                   pointerEvents: ad > 2 ? "none" : undefined,
                   filter: ad > 0.5 ? `blur(${Math.min(3, (ad - 0.5) * 2.2)}px)` : undefined,
                 }}
                 // Seitenkarte anklicken = in die Mitte drehen (die inneren
                 // Knöpfe gehören nur der vorderen Karte).
                 onClickCapture={Math.abs(d) >= 0.5 ? (e) => { e.preventDefault(); e.stopPropagation(); setMitte(i); } : undefined}>
              {karte(s)}
            </div>
          );
        })}
      </div>
      <button type="button" className="pi-lade-zu pi-kar-pfeil" onClick={vor} disabled={mitte >= kinder.length - 1} aria-label="nächste Karte"><ChevronRight size={18} /></button>
      {/* Punkte: wo stehe ich in der Reihe? */}
      <div className="pi-kar-punkte" aria-hidden="true">
        {kinder.map((s, i) => <i key={s.kunde.personId} className={i === mitte ? "an" : ""} onClick={() => setMitte(i)} />)}
      </div>
    </div>
  );
}

/** E-047: Die Leitfäden-LEGENDE — vier Aufklapp-Chips ganz unten (Klartext
 *  führt, das Kürzel steht klein dahinter); der zur Fokus-Situation passende
 *  Chip trägt einen Glut-Punkt. Nichts ist vorausgeklappt. */
function LeitfadenLegende({ aktiv }: { aktiv: Hitze | null }) {
  const [offenL, setOffenL] = useState<Hitze | null>(null);
  const CHIPS: { stufe: Hitze; name: string; kurz: string }[] = [
    { stufe: "heiss", name: "Zahlung gemeldet", kurz: "A" },
    { stufe: "warm", name: "Antrag offen", kurz: "B" },
    { stufe: "lead", name: "Neukunde", kurz: "C" },
    { stufe: "rate", name: "Rate zurückholen", kurz: "" },
  ];
  return (
    <div className="pi-legende">
      <div className="pi-legende-zeile">
        <span className="linie" aria-hidden="true" />
        <small>Leitfäden</small>
        {CHIPS.map((c) => (
          <button key={c.stufe} type="button" className={`pi-legende-chip${offenL === c.stufe ? " an" : ""}`}
                  style={{ ["--hitze" as string]: STUFE[c.stufe].farbe }}
                  aria-expanded={offenL === c.stufe}
                  onClick={() => setOffenL(offenL === c.stufe ? null : c.stufe)}>
            {aktiv === c.stufe && <i className="pi-glut" aria-hidden="true" title="passt zur aktuellen Fokus-Situation" />}
            {c.name}{c.kurz && <em>{c.kurz}</em>}
          </button>
        ))}
        <span className="linie" aria-hidden="true" />
      </div>
      {offenL && <Leitfaden key={offenL} stufe={offenL} startAuf />}
    </div>
  );
}

// ── Der Leitfaden der Stufe (tools/gespraech.tsx) als aufklappbare Glas-Karte ──
function Leitfaden({ stufe, startAuf }: { stufe: Hitze; startAuf?: boolean }) {
  const [auf, setAuf] = useState(!!startAuf);
  const [schritt, setSchritt] = useState<number | null>(0);
  const art = STUFE[stufe].leitfaden;
  const v = art === "reaktivierung" ? REAKTIVIERUNG : (ARTEN.find((a) => a.key === art) ?? ARTEN[0]);
  useEffect(() => { setSchritt(0); }, [art]);
  return (
    <aside className={`pi-leitfaden${auf ? " auf" : ""}`} style={{ ["--hitze" as string]: STUFE[stufe].farbe }}>
      <button type="button" className="pi-leitfaden-kopf" onClick={() => setAuf((a) => !a)} aria-expanded={auf}>
        <span><small>Leitfaden</small><b>{v.label}</b></span>
        <ChevronDown size={18} strokeWidth={1.75} className="pfeil" />
      </button>
      <p className="pi-leitfaden-kurz">{v.kurz}</p>
      <div className="pi-leitfaden-koerper">
        <ol className="pi-leitfaden-schritte">
          {v.schritte.map((s, i) => (
            <li key={s.titel} className={schritt === i ? "an" : ""}>
              <button type="button" onClick={() => setSchritt(schritt === i ? null : i)}><i>{i + 1}</i><b>{s.titel}</b></button>
              {schritt === i && <div className="pi-leitfaden-text">{s.text && <p>{s.text}</p>}{s.satz && <q>{s.satz}</q>}</div>}
            </li>
          ))}
        </ol>
        <div className="pi-leitfaden-einwaende">
          <small>Einwände</small>
          {v.einwaende.map((e) => <details key={e.frage}><summary>{e.frage}</summary><p>{e.antwort}</p></details>)}
        </div>
      </div>
    </aside>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Der 3D-Kundenstrom – Glas-Karten auf einer perspektivischen Bahn
// ═══════════════════════════════════════════════════════════════════════════
const FENSTER = 18; // Karten je Seite im DOM (max. ~37)
// E-050: exportiert — der Strom ist in den Bestand-Raum umgezogen (bestand.tsx,
// Ansicht „Strom“); hier bleibt nur der Baustein, keine Nutzung mehr.
export function Strom({ liste, aktiv, setAktiv, erledigt, onAkte, flach, ruhig, laedt }: {
  liste: Kunde[]; aktiv: number; setAktiv: (f: (a: number) => number) => void; erledigt: Set<number>; onAkte: (id: number) => void; flach: boolean; ruhig: boolean; laedt: boolean;
}) {
  const [maus, setMaus] = useState({ x: 0, y: 0 });
  const buehne = useRef<HTMLDivElement | null>(null);
  const flachRef = useRef<HTMLDivElement | null>(null);
  const touch = useRef<{ x: number; t: number } | null>(null);
  const radGesperrt = useRef(0);
  const vor = () => setAktiv((a) => Math.min(liste.length - 1, a + 1));
  const zurueck = () => setAktiv((a) => Math.max(0, a - 1));

  // Handy: die aktive Karte in die Mitte rollen.
  useEffect(() => {
    if (!flach || !flachRef.current) return;
    const el = flachRef.current.querySelector<HTMLElement>(`[data-i="${aktiv}"]`);
    el?.scrollIntoView({ behavior: ruhig ? "auto" : "smooth", inline: "center", block: "nearest" });
  }, [aktiv, flach, ruhig]);

  const bewegen = (e: React.MouseEvent) => {
    if (ruhig || !buehne.current) return;
    const r = buehne.current.getBoundingClientRect();
    setMaus({ x: ((e.clientX - r.left) / r.width - 0.5) * 2, y: ((e.clientY - r.top) / r.height - 0.5) * 2 });
  };
  const rad = (e: React.WheelEvent) => {
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
    if (!d || Date.now() < radGesperrt.current) return;
    radGesperrt.current = Date.now() + 260;
    if (d > 0) vor(); else zurueck();
  };
  const touchStart = (e: React.TouchEvent) => { touch.current = { x: e.touches[0].clientX, t: Date.now() }; };
  const touchEnd = (e: React.TouchEvent) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    if (Math.abs(dx) > 40 && Date.now() - touch.current.t < 600) { if (dx < 0) vor(); else zurueck(); }
    touch.current = null;
  };

  const karte = (k: Kunde, i: number) => {
    const s = stufeVon(k); const h = hitzeVon(k); const fertig = erledigt.has(k.personId);
    const preis = paketPreis(k);
    const faellig = rueckrufFaellig(k);
    return (
      <button type="button" key={k.personId} data-i={i} data-fi-kunde={k.personId}
              className={`pi-sk${i === aktiv ? " an" : ""}${fertig ? " erledigt" : ""}`}
              style={{ ["--hitze" as string]: faellig ? "#f87171" : STUFE[s].farbe, ["--glut" as string]: String(fertig ? 0.05 : h), ...(flach ? {} : stil3d(i - aktiv, h)) }}
              onClick={() => { if (flach || i === aktiv) onAkte(k.personId); else setAktiv(() => i); }}
              title={i === aktiv || flach ? "Akte öffnen" : "nach vorn holen"}>
        <span className="pi-sk-kopf"><i className="pi-glut" /><small>{faellig ? "Rückruf fällig" : STUFE[s].kurz}</small>{fertig && <em><Check size={11} strokeWidth={2.5} /> gebucht</em>}</span>
        <b>{k.name}</b>
        <span className="pi-sk-paket">{s === "rate" ? `Rate${k.rateNr ? ` ${k.rateNr}` : ""}${(k.rateAnzahl ?? 1) > 1 ? ` · ${k.rateAnzahl} offen` : ""} · zurückholen` : `${(k.buchungen ?? []).find((b) => !b.erledigt && b.art === "paket")?.bezeichnung || k.produkt || "kein Paket"}${preis ? ` · ${eur(preis)}` : ""}`}</span>
        <span className="pi-sk-fuss">{s === "rate" ? `${k.rateCents ? eur(k.rateCents) : "Rate"} überfällig${k.rateFaelligAm ? ` seit ${dtag(k.rateFaelligAm)}` : ""} · ${k.rateListe?.[0] ? (sepaGrund(k.rateListe[0]).ton === "rot" ? "Rücklastschrift" : sepaGrund(k.rateListe[0]).ton === "gelb" ? "kein SEPA" : "offen") : "offen"}` : k.termin ? `${terminText(k.termin.beginn)} · ${k.termin.art}` : k.rueckrufAm ? `Rückruf ${terminText(k.rueckrufAm)}` : relativ(k.zusagedatum) ? `Zusage ${relativ(k.zusagedatum)!.text}` : wartezeit(k.letzterKontakt)}</span>
      </button>
    );
  };

  if (laedt) return <section className="pi-strom-rahmen"><div className="pi-laedt">Lade den Kundenstrom …</div></section>;
  if (liste.length === 0) return null;

  if (flach) {
    return (
      <section className="pi-strom-rahmen">
        <div className="pi-strom-kopf"><b>Dein Kundenstrom</b><small>{liste.length} Kunden · antippen für die Akte</small></div>
        <div className="pi-strom-flach" ref={flachRef}>{liste.map((k, i) => karte(k, i))}</div>
      </section>
    );
  }
  const von = Math.max(0, aktiv - FENSTER), bis = Math.min(liste.length, aktiv + FENSTER + 1);
  return (
    <section className="pi-strom-rahmen" onWheel={rad} onTouchStart={touchStart} onTouchEnd={touchEnd}>
      <div className="pi-strom-kopf">
        <b>Dein Kundenstrom</b><small>{liste.length} Kunden · heiße vorn · Pfeile, Tasten oder Wischen · Klick auf die vordere Karte öffnet die Akte</small>
        <span className="pi-strom-pfeile">
          <button type="button" className="pi-lade-zu" onClick={zurueck} disabled={aktiv <= 0} aria-label="zurück"><ChevronLeft size={18} /></button>
          <button type="button" className="pi-lade-zu" onClick={vor} disabled={aktiv >= liste.length - 1} aria-label="weiter"><ChevronRight size={18} /></button>
        </span>
      </div>
      <div className="pi-strom" ref={buehne} onMouseMove={bewegen} onMouseLeave={() => setMaus({ x: 0, y: 0 })}>
        <div className="pi-strom-buehne" style={ruhig ? undefined : { transform: `rotateX(${(-maus.y * 2.5).toFixed(2)}deg) rotateY(${(maus.x * 5).toFixed(2)}deg)` }}>
          <div className="pi-strom-boden" aria-hidden="true" />
          {liste.slice(von, bis).map((k, j) => karte(k, von + j))}
        </div>
      </div>
    </section>
  );
}
/** Lage einer Karte relativ zur vorderen: vorn groß, nach hinten rechts in die Tiefe, Vergangenes links heraus. */
function stil3d(d: number, hitze: number): React.CSSProperties {
  const ad = Math.abs(d);
  if (d === 0) return { transform: `translate(-50%,-50%) translateZ(60px) scale(${1 + hitze * 0.06})`, zIndex: 200, opacity: 1 };
  if (d > 0) {
    const x = 150 + d * 165, y = -d * 14, z = -90 - d * 150, s = Math.max(0.5, 0.92 - d * 0.07);
    return { transform: `translate(-50%,-50%) translate3d(${x}px, ${y}px, ${z}px) rotateY(-26deg) scale(${s})`, zIndex: 200 - d, opacity: Math.max(0, 1 - d * 0.09) };
  }
  const x = -170 - ad * 120, z = -120 - ad * 160, s = Math.max(0.45, 0.8 - ad * 0.1);
  return { transform: `translate(-50%,-50%) translate3d(${x}px, ${ad * 10}px, ${z}px) rotateY(34deg) scale(${s})`, zIndex: 200 - ad, opacity: Math.max(0, 0.7 - ad * 0.14) };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE AKTE — HIGH-END-NEUBAU (Justin 23.08.: „darin wird gearbeitet, also
// wirklich PERFEKT, immer erklärend, gut formatiert, clean, genügend Platz“).
//
// VORHER: eine lange Block-Spalte mit hellen Alt-Einlagen (.pi-hell mit
// ErgebnisWahl/ProduktDialog) — der Stilbruch, den Justin gemeldet hat.
// NACHHER: durchgängig dunkles Glas im Office-Stil, großzügige Sektionen mit
// Erklärzeile unter jeder Überschrift, Reiter:
//   Überblick · Zahlungen & Raten · Gespräche · E-Mails · Dokumente ·
//   Aktivität · Daten
// Dunkel NACHGEBAUT (dieselben Endpunkte): Ergebniswahl (ErgebnisWahlDunkel,
// shared/fiaon-kontakt-ergebnis-liste), Produktwechsel (ProduktDunkel,
// GET /agent/katalog + POST /agent/customers/:ref/produkt).
// HELLE RESTE (Vorschau-Pflicht, bewusst nicht nachgebaut): SendeMenue und
// Gesprächsblatt (eigene Overlays) sowie RechnungBestaetigung (Modal mit
// Rechnungs-Vorschau) — sie öffnen ÜBER der Lade, nicht darin.
// E-045: Reiter „Zahlungen & Raten“ trägt die überfälligen Raten mit den zwei
// Ausgängen (Erinnerung senden · Ergebnis buchen) über die Collections-
// Endpunkte /inkasso/rate/:id/erinnerung und /inkasso/rate/:id/ergebnis.
// Alle bisherigen Funktionen bleiben erreichbar.
// ═══════════════════════════════════════════════════════════════════════════
/** Eine Sektion der Akte: Überschrift, Erklärzeile (Justin: „immer erklärend“), Inhalt.
 *  Auf Modulebene, nicht im Renderer — sonst remountet jede Eingabe (Fokusverlust). */
function Sek({ titel, erklaer, children, kopfRechts }: { titel: string; erklaer: string; children: ReactNode; kopfRechts?: ReactNode }) {
  return (
    <section className="pi-sek">
      <div className="pi-sek-kopf"><div><b>{titel}</b><p>{erklaer}</p></div>{kopfRechts}</div>
      {children}
    </section>
  );
}

type AkteReiter = "ueberblick" | "zahlungen" | "gespraeche" | "mails" | "dokumente" | "aktivitaet" | "daten";
const AKTE_REITER: { key: AkteReiter; label: string }[] = [
  { key: "ueberblick", label: "Überblick" },
  { key: "zahlungen", label: "Zahlungen & Raten" },
  { key: "gespraeche", label: "Gespräche" },
  { key: "mails", label: "E-Mails" },
  { key: "dokumente", label: "Dokumente" },
  { key: "aktivitaet", label: "Aktivität" },
  { key: "daten", label: "Daten" },
];

// E-050: exportiert — bestand.tsx öffnet DIESELBE Akte-Lade (?person=), kein
// Duplikat. Voraussetzung beim Einbetten: ToastAnbieter + FragenAnbieter
// (useFragen) liegen außen herum, wie hier über AgentShell/ToastAnbieter.
export function Akte({ k, onZu, onWeg, onNeu, onErledigt, onZaehler }: {
  k: Kunde; onZu: () => void; onWeg: () => void; onNeu: (k: Kunde) => void; onErledigt: () => void; onZaehler: () => void;
}) {
  const fragen = useFragen();
  const { zeige } = useToast();
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ art: "gut" | "schlecht" | "info"; text: string } | null>(null);
  const melden = (art: "gut" | "schlecht" | "info", titel: string, text?: string) => {
    setMeldung({ art, text: text ? `${titel} – ${text}` : titel });
    zeige(art === "gut" ? "erfolg" : art === "schlecht" ? "fehler" : "info", titel, text);
  };
  const [reiter, setReiter] = useState<AkteReiter>("ueberblick");
  const [bearbeiten, setBearbeiten] = useState(false);
  const [bearbeitenFokus, setBearbeitenFokus] = useState<string | null>(null);
  const [mailNachtrag, setMailNachtrag] = useState("");
  const [produktOffen, setProduktOffen] = useState(false);
  const [datumWert] = useState(tagPlus(1));
  const [notiz, setNotiz] = useState("");
  const [verlauf, setVerlauf] = useState<any[] | null>(null);
  const [sendeMenue, setSendeMenue] = useState(false);
  const [blatt, setBlatt] = useState(false);
  const [linkKopiert, setLinkKopiert] = useState(false);
  const [kopiert, setKopiert] = useState(false);
  const [testOffen, setTestOffen] = useState(false);
  const [testNotiz, setTestNotiz] = useState("");
  const [belegOffen, setBelegOffen] = useState(false);
  const [belegDatum, setBelegDatum] = useState("");
  const [belegNotiz, setBelegNotiz] = useState("");
  const [belegDatei, setBelegDatei] = useState<File | null>(null);
  const [auswahl, setAuswahl] = useState<Set<string>>(new Set());
  const [bestaetigen, setBestaetigen] = useState(false);
  const [sendeFehler, setSendeFehler] = useState<string | null>(null);
  // E-044/§16: Aktivität + Vollständigkeit (Kartenstatus-Weiche)
  const [akt, setAkt] = useState<{ ereignisse: any[]; vollstaendig: { vollstaendig: boolean; paketBezahlt: boolean; schufaBezahlt: boolean; kontoauszug: boolean; ausweis: boolean }; situation?: any } | null>(null);
  const [aktFehler, setAktFehler] = useState<string | null>(null);
  // ── E-046: Situations-Kopf (Justin: „auf 1 Blick sehen, auf 1 Klick handeln“) ──
  const [mehrOffen, setMehrOffen] = useState(false);
  const [terminOffen, setTerminOffen] = useState(false);
  // E-048 Nr. 1: VORHER terminDatum/terminZeit als Freitext — NACHHER wählt
  // SlotWahl einen echten freien Slot; hier bleibt nur das Ergebnis.
  const [terminGebucht, setTerminGebucht] = useState<string | null>(null);
  const [leitfadenAuf, setLeitfadenAuf] = useState(false);
  const [alleErgebnisse, setAlleErgebnisse] = useState(false);
  const [sitFeld, setSitFeld] = useState<null | "zahlt_am" | "ausgesetzt" | "rueckruf">(null);
  // Justin 24.08.: Der Abschluss der Akte kennt zwei Wege — „Mandat
  // angenommen“ (bucht bei fehlendem Termin direkt einen) und „Kunde
  // abgelehnt“ (fragt nach dem Grund). `abschlussTermin` zeigt die Slot-Wahl
  // im Abschluss selbst, damit der Weg nicht nach oben springt.
  const [abschluss, setAbschluss] = useState<null | "abgelehnt">(null);
  const [abschlussTermin, setAbschlussTermin] = useState(false);
  const [sitDatum, setSitDatum] = useState(tagPlus(1));
  const [sitZeit, setSitZeit] = useState("10:00");
  // Gespräche: Anrufe mit Aufnahme (lazy je Reiter)
  const [anrufe, setAnrufe] = useState<any[] | null>(null);
  // Dokumente-Stand (lazy)
  const [doku, setDoku] = useState<any | null | "fehlt">(null);

  const zusage = relativ(k.zusagedatum);
  const rueckruf = k.rueckrufAm ? new Date(k.rueckrufAm) : null;
  const rueckrufJetzt = rueckruf ? rueckruf.getTime() <= Date.now() : false;
  const termin = k.terminAm ? new Date(k.terminAm) : null;
  const status = statusAusTierGrund(k.tierGrund);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape" && !bestaetigen && !sendeMenue && !blatt) onZu(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onZu, bestaetigen, sendeMenue, blatt]);

  const frisch = async () => {
    const r = await api(`/agent/crm/kunden/${k.personId}`);
    if (r.ok && r.json?.kunde) onNeu(r.json.kunde);
    if (r.ok) setVerlauf(r.json.verlauf ?? []);
  };
  const verlaufNachladen = async () => {
    const r = await api(`/agent/crm/kunden/${k.personId}`);
    if (r.ok) setVerlauf(r.json.verlauf ?? []);
  };
  useEffect(() => { void verlaufNachladen(); }, [k.personId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let an = true;
    api(`/agent/vertrieb/aktivitaet/${k.personId}`).then((r) => {
      if (!an) return;
      if (r.ok) { setAkt({ ereignisse: r.json.ereignisse || [], vollstaendig: r.json.vollstaendig, situation: r.json.situation ?? null }); setAktFehler(null); }
      else setAktFehler(r.json?.error || "Die Aktivität konnte nicht geladen werden.");
    });
    return () => { an = false; };
  }, [k.personId]);
  // Anrufe und Dokumente erst laden, wenn der Reiter sie braucht.
  useEffect(() => {
    if (reiter === "gespraeche" && anrufe === null) {
      api(`/telefon/person/${k.personId}/anrufe`).then((r) => setAnrufe(r.ok ? (r.json.anrufe || []) : []));
    }
    if (reiter === "dokumente" && doku === null) {
      api(`/dokumente/${k.personId}`).then((r) => setDoku(r.ok && r.json.stand ? r.json.stand : "fehlt"));
    }
  }, [reiter, k.personId]); // eslint-disable-line react-hooks/exhaustive-deps

  // §16: Der Kartenstatus ist überall der Platzhalter, bis der Kunde vollständig ist.
  const vollstaendig = akt?.vollstaendig?.vollstaendig ?? k.vollstaendig ?? false;
  const kartenText = vollstaendig ? "Vollständig – liegt bei FIAON zur Bearbeitung" : "In Bearbeitung";

  // ── E-046: DIE EINE SITUATION (serverseitig aus kundenSituation; Rückfall
  //    aus den Kartendaten, solange die Antwort lädt). VORHER stand hier der
  //    tier-Hinweis NEBEN einer überfälligen Rate — der Widerspruch
  //    „alles bezahlt / Rate offen“ vom 23.08. ──────────────────────────────
  const sit = akt?.situation ?? null;
  const sitArt: string = sit?.art
    ?? (k.istRate ? "rate_ueberfaellig"
      : k.tier === 0 ? ((k.termin || k.terminAm) ? "alles_gut" : "bezahlt_ohne_termin")
      : k.tier === 1 ? "zahlung_gemeldet"
      : k.tier === 2 ? "rechnung_offen" : "lead_ohne_antrag");
  const sitRate: { id: number; nr: number; betragCents: number; faelligAm: string | null; tage: number; referenz: string | null; lastschriftStatus?: string | null; lastschriftGrund?: string | null; sepaEingerichtet?: boolean } | null =
    sit?.rate ?? (k.rateListe?.[0] ? {
      id: k.rateListe[0].id, nr: k.rateListe[0].rateNr, betragCents: k.rateListe[0].betragCents,
      faelligAm: k.rateListe[0].faelligAm, tage: k.rateListe[0].faelligAm ? Math.max(0, kontaktTage(k.rateListe[0].faelligAm) ?? 0) : 0,
      referenz: null,
    } : null);
  const hatTermin = !!terminGebucht || !!sit?.terminAm
    || (!!k.termin && !k.termin.erledigt && new Date(k.termin.beginn).getTime() > Date.now())
    || (!!k.terminAm && new Date(k.terminAm).getTime() > Date.now());
  const sitLeitfaden: Hitze = sitArt === "rate_ueberfaellig" ? "rate"
    : sitArt === "lead_ohne_antrag" ? "lead"
    : sitArt === "rechnung_offen" ? "warm" : "heiss";

  // E-048 Nr. 1: VORHER baute die Funktion `${terminDatum}T${terminZeit}:00`
  // aus zwei Freitext-Feldern — NACHHER kommt der Beginn als ISO-Zeitpunkt
  // eines echten freien Slots aus SlotWahl; POST /agent/termine prüft erneut.
  const terminBuchen = async (beginnIso: string, label: string): Promise<boolean> => {
    setLaeuft("termin");
    const r = await api("/agent/termine", { method: "POST", body: JSON.stringify({ personId: k.personId, beginn: beginnIso }) });
    setLaeuft(null);
    if (!r.ok) { melden("schlecht", "Nicht gebucht", r.json?.error || "Der Termin konnte nicht gebucht werden."); return false; }
    const text = r.json.termin?.datumText ? `${r.json.termin.datumText}, ${r.json.termin.uhrzeit} Uhr` : label;
    setTerminGebucht(text); setTerminOffen(false);
    melden("gut", `Termin gebucht: ${text}. Der Slot ist blockiert, die Bestätigung geht an den Kunden.`);
    return true;
  };
  /** Setzt die Mandatsmarke (§16a) und bucht das Ergebnis. `terminLabel` ist
   *  der Termin, der dabei steht — beim frisch gebuchten Termin direkt
   *  durchgereicht, weil der State (terminGebucht) im selben Zug noch nicht
   *  gelesen werden kann. */
  const mandatVerbuchen = async (terminLabel?: string) => {
    setLaeuft("mandat");
    await api(`/agent/vertrieb/mandat/${k.personId}`, { method: "POST", body: JSON.stringify({}) }).catch(() => null);
    const wann = terminLabel ?? terminGebucht ?? (sit?.terminAm ? terminText(sit.terminAm) : k.termin ? terminText(k.termin.beginn) : k.terminAm ? terminText(k.terminAm) : "gebucht");
    const ok = await ergebnis("erreicht_sonstiges", {
      notiz: `Mandat angenommen – Termin ${wann} steht. Kunde erinnert: Rechnung vor dem Termin begleichen, dann wird im Gespräch direkt aktiviert.`,
    });
    if (ok) melden("gut", `Mandat angenommen – ${k.name} zählt jetzt zu deinem Bestand.`);
    setLaeuft(null);
    return ok;
  };
  const mandatBuchen = async () => {
    // Justin 24.08.: „bei Mandat angenommen bucht man dann direkt den Termin
    // ein (aber nur falls man mit dem noch keinen Termin gebucht hat)“ —
    // steht der Termin schon, wird das Mandat sofort verbucht.
    if (!hatTermin) { setAbschlussTermin(true); setAbschluss(null); return; }
    await mandatVerbuchen();
  };
  /** Situatives Raten-Ergebnis auf die dringendste Rate (Collections-Endpunkt). */
  const sitRatenErgebnis = async (art: RatenErgebnis, zusatz: { zusageDatum?: string; notiz?: string } = {}) => {
    if (!sitRate) return;
    if (art === "nummer_blockiert" && !(await fragen({
      titel: "Kein Kontakt mehr möglich?",
      text: "Die Nummer wird markiert und die Rate ruht 30 Tage – der Weg läuft dann über Mail und Mahnung.",
      ja: "Festhalten",
    }))) return;
    setLaeuft(`sit-${art}`);
    const r = await api(`/inkasso/rate/${sitRate.id}/ergebnis`, { method: "POST", body: JSON.stringify({ ergebnis: art, ...zusatz }) });
    setLaeuft(null);
    if (!r.ok) { melden("schlecht", "Nicht gebucht", r.json?.error || "Bitte erneut versuchen."); return; }
    melden("gut", "Ergebnis gebucht", r.json?.meldung || undefined);
    setSitFeld(null); onErledigt(); onZaehler();
  };
  /** Die Erinnerung zur dringendsten Rate — derselbe Endpunkt wie im Raten-Reiter. */
  const sitErinnerung = async () => {
    if (!sitRate) return;
    if (!(await fragen({ titel: `Zahlungserinnerung für Rate ${sitRate.nr} an den Kunden schicken?`, ja: "Senden" }))) return;
    setLaeuft("sit-erinnerung");
    const r = await api(`/inkasso/rate/${sitRate.id}/erinnerung`, { method: "POST", body: JSON.stringify({}) });
    setLaeuft(null);
    melden(r.ok ? "gut" : "schlecht", r.ok ? "Erinnerung verschickt" : "Nicht verschickt", r.json?.meldung || r.json?.error || undefined);
  };
  const ratenKopieren = async () => {
    if (!sitRate) return;
    const text = [
      k.zahlung?.empfaenger ? `Empfänger: ${k.zahlung.empfaenger}` : null,
      k.zahlung?.iban ? `IBAN: ${k.zahlung.iban}` : null,
      `Betrag: ${eur(sitRate.betragCents)}`,
      `Verwendungszweck: ${sitRate.referenz ?? k.zahlung?.referenz ?? "siehe Akte"}`,
    ].filter(Boolean).join("\n");
    if (await inZwischenablage(text)) { setKopiert(true); setTimeout(() => setKopiert(false), 2500); }
    else melden("schlecht", "Kopieren nicht möglich", "Bitte die Daten von Hand übernehmen.");
  };

  // ── Ergebnis / Notiz (POST /agent/crm/kunden/:id/aktivitaet) ───────────
  const ergebnis = async (art: string, zusatz: Record<string, unknown> = {}): Promise<boolean> => {
    setLaeuft(art);
    const eigeneNotiz = typeof zusatz.notiz === "string" ? zusatz.notiz.trim() : "";
    const r = await api(`/agent/crm/kunden/${k.personId}/aktivitaet`, {
      method: "POST", body: JSON.stringify({ art, ...zusatz, notiz: eigeneNotiz || notiz.trim() || undefined }),
    });
    setLaeuft(null);
    if (!r.ok) {
      melden("schlecht", "Nicht gespeichert", r.json?.error || "Bitte erneut versuchen.");
      return false;
    }
    melden(r.json.uebergabe && !r.json.uebergabe.ok ? "info" : "gut", r.json.meldung || "Gespeichert", k.name);
    setNotiz("");
    const VERABREDET = ["nicht_erreicht", "mailbox", "rueckruf_termin", "nummer_falsch", "nummer_blockiert"];
    if (art === "erreicht_abgelehnt" || r.json.uebergabe?.ok) onWeg();
    else if (VERABREDET.includes(art)) { onErledigt(); if (r.json.kunde) onNeu(r.json.kunde); }
    else if (r.json.kunde) { onNeu(r.json.kunde); onErledigt(); }
    else onErledigt();
    if (art === "notiz") await verlaufNachladen(); else void verlaufNachladen();
    onZaehler();
    return true;
  };

  // ── Zahlungsbeleg (POST …/zahlungsbeleg, multipart) ─────────────────────
  const belegHochladen = async () => {
    if (!belegDatei) { melden("schlecht", "Keine Datei gewählt", "Bitte das Foto oder PDF der Überweisung auswählen."); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(belegDatum)) { melden("schlecht", "Datum fehlt", "Bitte das Überweisungsdatum laut Beleg angeben."); return; }
    setLaeuft("beleg");
    const daten = new FormData();
    daten.append("beleg", belegDatei); daten.append("datum", belegDatum);
    if (belegNotiz.trim()) daten.append("notiz", belegNotiz.trim());
    const antwort = await fetch(`/api/fiaon/agent/crm/kunden/${k.personId}/zahlungsbeleg`, { method: "POST", credentials: "include", body: daten }).then((r) => r.json()).catch(() => null);
    setLaeuft(null);
    if (antwort?.ok) { setBelegOffen(false); setBelegDatei(null); setBelegDatum(""); setBelegNotiz(""); melden("gut", "Beleg hinterlegt", antwort.meldung || "Er steht jetzt bei der Zahlungsprüfung."); }
    else melden("schlecht", "Nicht hinterlegt", antwort?.error || "Bitte erneut versuchen.");
  };

  const zahlungsdatenKopieren = async () => {
    const text = k.zahlung?.klartext; if (!text) return;
    if (await inZwischenablage(text)) { setKopiert(true); setTimeout(() => setKopiert(false), 2500); }
    else melden("schlecht", "Kopieren nicht möglich", "Bitte den Verwendungszweck von Hand übernehmen.");
  };
  const terminlinkKopieren = async () => {
    if (await inZwischenablage(k.terminLink)) { setLinkKopiert(true); setTimeout(() => setLinkKopiert(false), 2500); }
    else melden("schlecht", "Kopieren nicht möglich", "Bitte den Link von Hand übernehmen.");
  };

  // ── Buchungen wegräumen (POST /agent/buchungen/:ref/archivieren) ────────
  const umschalten = (ref: string) => setAuswahl((v) => { const n = new Set(v); if (n.has(ref)) n.delete(ref); else n.add(ref); return n; });
  const auswahlWegraeumen = async () => {
    const refs = Array.from(auswahl); if (refs.length === 0) return;
    const zeilen = (k.buchungen ?? []).filter((b) => refs.includes(b.ref));
    const summe = zeilen.reduce((s, b) => s + Number(b.betragCents ?? 0), 0);
    if (!(await fragen({
      titel: `${refs.length} ${refs.length === 1 ? "Buchung" : "Buchungen"} aus der Liste nehmen?`,
      text: `${zeilen.map((b) => `${b.bezeichnung}${b.betragCents != null ? ` (${eur(b.betragCents)})` : ""}`).join(", ")} — Summe ${eur(summe)}.`,
      folge: "Sie werden archiviert, nicht gelöscht — die Vertriebsleitung kann sie zurückholen. Bezahlte Buchungen und die letzte verbleibende bleiben in jedem Fall stehen.",
      ja: "Wegräumen",
    }))) return;
    setLaeuft("arch-auswahl");
    const geschafft: string[] = []; const geblieben: { ref: string; grund: string }[] = [];
    for (const ref of refs) {
      const r = await api(`/agent/buchungen/${encodeURIComponent(ref)}/archivieren`, { method: "POST", body: JSON.stringify({ grund: "doppelt" }) });
      if (r.ok) geschafft.push(ref); else geblieben.push({ ref, grund: r.json?.error || "unbekannter Grund" });
    }
    setLaeuft(null); setAuswahl(new Set());
    if (geblieben.length === 0) melden("gut", "Weggeräumt", `${geschafft.length} ${geschafft.length === 1 ? "Buchung" : "Buchungen"} archiviert.`);
    else melden(geschafft.length > 0 ? "info" : "schlecht", geschafft.length > 0 ? `${geschafft.length} weggeräumt, ${geblieben.length} blieben stehen` : "Keine weggeräumt", geblieben.map((g) => `${g.ref}: ${g.grund}`).join(" · ").slice(0, 400));
    await frisch(); onZaehler();
  };
  const buchungWegraeumen = async (b: { ref: string; bezeichnung: string; betragCents: number | null }) => {
    const betrag = b.betragCents != null ? eur(b.betragCents) : "ohne Betrag";
    if (!(await fragen({
      titel: `„${b.bezeichnung}“ (${betrag}) aus der Liste nehmen?`,
      text: "Der Kunde behält seine anderen Buchungen. Diese hier wird archiviert, nicht gelöscht — die Vertriebsleitung kann sie zurückholen.",
      folge: `Referenz: ${b.ref}`, ja: "Wegräumen",
    }))) return;
    setLaeuft(`arch-${b.ref}`);
    const r = await api(`/agent/buchungen/${encodeURIComponent(b.ref)}/archivieren`, { method: "POST", body: JSON.stringify({ grund: "doppelt" }) });
    setLaeuft(null);
    if (!r.ok) { melden("schlecht", "Nicht möglich", r.json?.error || "Bitte erneut versuchen."); return; }
    melden("gut", "Buchung weggeräumt", r.json.meldung);
    await frisch(); onZaehler();
  };

  // ── E-Mail nachtragen (POST /agent/customers/:ref/stammdaten) ───────────
  const mailNachtragen = async () => {
    const wert = mailNachtrag.trim();
    const ref = (k.buchungen ?? []).find((b) => !b.erledigt)?.ref ?? (k.buchungen ?? [])[0]?.ref;
    if (!ref) { melden("schlecht", "Keine Bestellung", "Ohne Bestellung gibt es keine Akte, an der die Adresse hängt. Bitte erst ein Produkt anlegen."); return; }
    setLaeuft("mailnachtrag");
    const r = await api(`/agent/customers/${encodeURIComponent(ref)}/stammdaten`, { method: "POST", body: JSON.stringify({ email: wert }) });
    setLaeuft(null);
    if (!r.ok) { melden("schlecht", "Nicht gespeichert", r.json?.error || "Bitte erneut versuchen."); return; }
    melden("gut", "E-Mail gespeichert", `${wert} steht jetzt an der Akte. Der Zahlungsdaten-Knopf ist frei.`);
    setMailNachtrag(""); await frisch();
  };

  // ── Zahlungsdaten + Rechnung (POST …/rechnung) ───────────────────────────
  const zahlungsdaten = async (ref: string | null = null) => {
    setLaeuft("rechnung");
    const r = await api(`/agent/crm/kunden/${k.personId}/rechnung`, { method: "POST", body: JSON.stringify({ ref }) });
    setLaeuft(null);
    if (!r.ok) { const grund = r.json?.error || "Der Server hat den Versand abgelehnt, ohne einen Grund zu nennen."; setSendeFehler(grund); melden("schlecht", "Nicht versandt", grund); return; }
    setSendeFehler(null); setBestaetigen(false);
    melden(r.json.warnung ? "info" : "gut", r.json.warnung ? "Versandt, mit Hinweis" : "Rechnung und Zahlungsdaten gesendet",
      r.json.warnung || `An ${r.json.versandtAn} — mit Bankverbindung, Verwendungszweck und Rechnung.`);
    if (r.json.kunde) onNeu(r.json.kunde);
    await verlaufNachladen();
  };
  const nummerKorrektur = async () => {
    setLaeuft("nummer");
    const r = await api(`/agent/crm/kunden/${k.personId}/nummer-korrektur`, { method: "POST", body: JSON.stringify({}) });
    setLaeuft(null);
    if (r.ok) melden("gut", "Bitte um Nummer versandt", `An ${r.json.versandtAn} — mit Link zum Ändern.`);
    else melden("schlecht", "Nicht versandt", r.json?.error || "Bitte erneut versuchen.");
  };
  const testeintragMelden = async () => {
    const begruendung = testNotiz.trim();
    if (begruendung.length < 5) { melden("schlecht", "Bitte kurz begründen", "Ein Satz genügt: Woran erkennst du, dass das kein echter Kunde ist?"); return; }
    setLaeuft("test");
    const r = await api(`/agent/crm/kunden/${k.personId}/testeintrag-melden`, { method: "POST", body: JSON.stringify({ begruendung }) });
    setLaeuft(null);
    if (r.ok) { setTestOffen(false); setTestNotiz(""); melden("gut", "Gemeldet", r.json.meldung || "Die Vertriebsleitung prüft."); }
    else melden("schlecht", "Nicht gemeldet", r.json?.error || "Bitte erneut versuchen.");
  };

  // ── Sperrgrund für „Zahlungsdaten senden“ — vom Server ──────────────────
  const buchungen = k.buchungen ?? [];
  const sperre = k.sendeGrund
    ? (k.sendeMoeglich ? null : { grund: k.sendeText || "Senden ist gerade nicht möglich.", ziel: (k.sendeGrund === "keine_email" ? "stammdaten" : k.sendeGrund === "keine_bestellung" ? "produkt" : null) as "stammdaten" | "produkt" | null })
    : !k.email ? { grund: "Keine E-Mail-Adresse — ohne sie kann nichts rausgehen.", ziel: "stammdaten" as const }
    : buchungen.length === 0 ? { grund: "Keine Bestellung vorhanden — es gibt nichts zu bezahlen.", ziel: "produkt" as const } : null;
  const offeneBuchungen = buchungen.filter((b) => b.offen);
  const gemeldet = offeneBuchungen.filter((b) => b.zahlungText?.startsWith("Zahlung gemeldet"));
  // Stammdaten hängen an der Bestellung (Referenz) — ohne sie ist Speichern
  // im Reiter „Daten“ zwecklos. Trifft praktisch nur Neukunden (Gruppe C).
  const hatBestellung = !!(k.zahlung?.ref || buchungen[0]?.ref);

  return (
    <aside className="pi-lade" role="dialog" aria-modal="true" aria-label={`Akte ${k.name}`}>
      {/* E-049 Nr. 1 (Justin, Screenshot): VORHER verschwand der Akte-Kopf
          (Name, Status, Anrufen, Schließen) beim Scrollen — nur die Reiter
          blieben (alte sticky-Regel griff nur auf die Tabs). NACHHER: Die
          Lade ist selbst der Scroll-Container, Kopf UND Reiter sitzen in
          EINEM sticky Glas-Block (.pi-lade-fest, top:0, Blur, safe-area);
          der Inhalt scrollt darunter, nichts wird abgeschnitten. */}
      <div className="pi-lade-fest">
      {/* Kopf: Wer, wo er steht, ein großer Anruf-Knopf. */}
      <div className="pi-lade-kopf">
        <span className="pi-lade-glut" style={{ ["--hitze" as string]: STUFE[stufeVon(k)].farbe }} aria-hidden="true"><i className="pi-glut" /></span>
        <div>
          <h2>{k.name}</h2>
          <div className="status">
            <i style={{ color: k.tier === 1 ? "#fca5a5" : k.tier === 2 ? "#fcd34d" : k.tier === 0 ? "#6ee7b7" : "#cbd5e1" }}>{status.anzeige}</i>
            <span>{STUFE[stufeVon(k)].name}</span>
            <span className={`pi-marke${vollstaendig ? " gut" : " still"}`}
                  title={akt ? `Paket ${akt.vollstaendig.paketBezahlt ? "✓" : "–"} · SCHUFA ${akt.vollstaendig.schufaBezahlt ? "✓" : "–"} · Kontoauszug ${akt.vollstaendig.kontoauszug ? "✓" : "–"} · Ausweis ${akt.vollstaendig.ausweis ? "✓" : "–"}` : undefined}>
              Karte: {kartenText}
            </span>
            {k.mandatSeit && <span className="pi-marke">Mandat seit {dtag(k.mandatSeit)}</span>}
            {termin && <span className="pi-marke">Termin {terminText(k.terminAm!)}</span>}
            {k.termin && !termin && <span className="pi-marke">{terminText(k.termin.beginn)} · {k.termin.art}</span>}
            {zusage && <span className={`pi-marke${zusage.dringend ? " dringend" : ""}`}>Zusage {zusage.text}</span>}
            {rueckruf && <span className={`pi-marke${rueckrufJetzt ? " dringend" : " warn"}`}>Rückruf {rueckruf.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })} {rueckruf.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</span>}
          </div>
        </div>
        <div className="pi-lade-kopf-tun">
          {k.telefonWaehlbar && <button type="button" className="pi-knopf gross" onClick={() => anrufen(k.telefonWaehlbar, k.personId, k.name, sitRate?.id ?? null)}><Phone size={16} strokeWidth={1.75} /> Anrufen</button>}
          <button type="button" className="pi-lade-zu" onClick={onZu} aria-label="Akte schließen"><X size={18} strokeWidth={1.75} /></button>
        </div>
      </div>

      {/* Reiter — direkt unter dem Kopf, im selben sticky Block */}
      <div className="pi-lade-tabs" role="tablist">
        {AKTE_REITER.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={reiter === t.key} className={`pi-tab${reiter === t.key ? " an" : ""}`} onClick={() => setReiter(t.key)}>
            {t.label}{t.key === "aktivitaet" && akt ? <em>{akt.ereignisse.length}</em> : null}
          </button>
        ))}
      </div>
      </div>

      <div className="pi-lade-koerper">
        {meldung && <p className={`pi-meldung ${meldung.art === "gut" ? "gut" : meldung.art === "schlecht" ? "schlecht" : ""}`}>{meldung.text}</p>}

        {/* ═══ ÜBERBLICK — DER SITUATIONS-KOPF (E-046) ═══
            VORHER: „Nächster Schritt“-Text aus dem tier-Hinweis + eine Reihe
            gleichrangiger Knöpfe („Knopf-Wüste“) + volle Ergebnisliste — bei
            überfälliger Rate stand daneben „alles bezahlt“ (Widerspruch,
            Justin 23.08.). NACHHER: EINE Situations-Karte mit Klartext-
            Überschrift, einer Erklärzeile und EINEM Primär-Knopf; sekundäre
            Aktionen im „Mehr“-Menü und in den Fach-Reitern; Ergebnisse
            situativ (3–5 passende Ausgänge, „Alle Ergebnisse“ zum Ausklappen). */}
        {reiter === "ueberblick" && <>
          <section className="pi-situation" style={{ ["--hitze" as string]: sitArt === "rate_ueberfaellig" || sitArt === "zusage_gebrochen" ? "#f87171" : STUFE[sitLeitfaden].farbe }}>
            <div className="pi-situation-kopf">
              <div className="pi-situation-text">
                <h3>
                  {sitArt === "rate_ueberfaellig" && sitRate ? `Rate ${sitRate.nr} · ${eur(sitRate.betragCents)} · seit ${sitRate.tage} ${sitRate.tage === 1 ? "Tag" : "Tagen"} überfällig – hol sie zurück`
                    : sitArt === "zusage_gebrochen" ? `Zusage vom ${dtag(sit?.zusageAm ?? k.zusagedatum)} nicht gehalten – fass nach`
                    : sitArt === "rueckruf_faellig" ? `Rückruf war für ${sit?.rueckrufAm ? terminText(sit.rueckrufAm) : "heute"} vereinbart – er wartet auf dich`
                    : sitArt === "bezahlt_ohne_termin" ? "Mandat da, Termin fehlt – buche das Startgespräch"
                    : sitArt === "zahlung_gemeldet" ? "Kunde meldet Zahlung – das Geld ist noch nicht da. Sichere den Termin"
                    : sitArt === "rechnung_offen" ? `Antrag fertig – ${paketPreis(k) ? `${eur(paketPreis(k))} offen` : "Rechnung offen"}. Schick die Zahlungsdaten`
                    : sitArt === "lead_ohne_antrag" ? "Registriert, noch kein Antrag – hol das Mandat"
                    /* E-051 Nr. 3: VORHER „Heute ${terminText(…)}“ — terminText liefert
                       selbst schon „Heute 14:20“ (Berlin-Zeit), also stand dort
                       „Heute Heute 14:20“. NACHHER nur terminText (formatiert mit
                       timeZone Europe/Berlin, keine UTC-Uhrzeit). */
                    : sitArt === "termin_heute" ? `${sit?.terminHeute ? terminText(sit.terminHeute) : "Heute"} – das Gespräch steht`
                    : sit?.naechsteRate ? `Alles läuft – nächste Rate ${eur(sit.naechsteRate.betragCents)} am ${dtag(sit.naechsteRate.faelligAm)}`
                    : "Alles läuft – nichts fällig"}
                </h3>
                <p>
                  {sitArt === "rate_ueberfaellig" ? `Weich einsteigen: vorstellen, entschuldigen, zuhören – kein Inkasso-Ton. Holst du die Rate zurück, gehören ${sitRate ? eur(Math.round(sitRate.betragCents * REAKTIVIERUNG_ANTEIL)) : "50 %"} dir.`
                    : sitArt === "zusage_gebrochen" ? "Kein Vorwurf am Telefon – frag, was dazwischenkam, und vereinbare ein neues, konkretes Datum."
                    : sitArt === "rueckruf_faellig" ? "Der Kunde hat diese Zeit selbst gewählt – ruf jetzt an und knüpf ans letzte Gespräch an."
                    : sitArt === "bezahlt_ohne_termin" ? "Der Kunde hat bezahlt und wartet. Im Startgespräch aktivierst du sein Konto – vergib den nächsten freien Termin."
                    : sitArt === "zahlung_gemeldet" ? "Bitte um den Überweisungsbeleg und sichere den Termin – mit dem Eingang aktivierst du direkt im Gespräch."
                    : sitArt === "rechnung_offen" ? "Antrag und Rechnung sind da – die Zahlung fehlt noch. Ruf an, vereinbare den Termin und weise dezent darauf hin: Geht die Rechnung vor dem Termin ein, aktivierst du im Gespräch direkt."
                    : sitArt === "lead_ohne_antrag" ? "Daten aufnehmen, Paket am Telefon annehmen lassen, Zugänge senden – der Leitfaden führt dich durch."
                    : sitArt === "termin_heute" ? "Akte kurz durchsehen, pünktlich anrufen – Termintreue wird gemessen."
                    : "Betreuter Kunde ohne offenen Schritt. Eine kurze Notiz nach jedem Kontakt hält die Akte lebendig."}
                </p>
              </div>
              <div className="pi-situation-tun">
                {(sitArt === "rate_ueberfaellig" || sitArt === "lead_ohne_antrag") && (
                  k.telefonWaehlbar
                    ? <button type="button" className="pi-knopf riesig" onClick={() => { anrufen(k.telefonWaehlbar, k.personId, k.name, sitRate?.id ?? null); setLeitfadenAuf(true); }}><Phone size={18} strokeWidth={1.75} /> Anrufen mit Leitfaden</button>
                    : <button type="button" className="pi-knopf riesig warn" onClick={() => setLeitfadenAuf(true)}><Phone size={18} strokeWidth={1.75} /> {k.telefon ? "Vorwahl fehlt – unten ergänzen" : "Nummer fehlt – unter „Daten“"}</button>
                )}
                {(sitArt === "zusage_gebrochen" || sitArt === "rueckruf_faellig" || sitArt === "termin_heute") && (
                  <button type="button" className="pi-knopf riesig" disabled={!k.telefonWaehlbar} onClick={() => anrufen(k.telefonWaehlbar, k.personId, k.name, sitRate?.id ?? null)}><Phone size={18} strokeWidth={1.75} /> Anrufen</button>
                )}
                {(sitArt === "bezahlt_ohne_termin" || sitArt === "zahlung_gemeldet") && (
                  <button type="button" className={`pi-knopf riesig${hatTermin ? " gut" : ""}`} onClick={() => setTerminOffen((v) => !v)}>{hatTermin ? <><Check size={17} strokeWidth={2} /> Termin steht</> : "Termin buchen"}</button>
                )}
                {sitArt === "rechnung_offen" && (
                  <button type="button" className="pi-knopf riesig gut" disabled={!!laeuft || !!sperre} title={sperre ? sperre.grund : `Zahlungsdaten und Rechnung an ${k.email}`} onClick={() => setBestaetigen(true)}>
                    <Send size={17} strokeWidth={1.75} /> {laeuft === "rechnung" ? "Sende …" : "Zahlungsdaten senden"}
                  </button>
                )}
                {/* Sekundäres wandert ins „Mehr“-Menü – die Knopf-Wüste ist Geschichte. */}
                <span className="pi-mehr">
                  <button type="button" className="pi-lade-zu" aria-label="Mehr Aktionen" aria-expanded={mehrOffen} onClick={() => setMehrOffen((v) => !v)}><MoreHorizontal size={18} strokeWidth={1.75} /></button>
                  {mehrOffen && (
                    <span className="pi-mehr-menue" onClick={() => setMehrOffen(false)}>
                      <button type="button" onClick={() => setBestaetigen(true)} disabled={!!sperre}>Zahlungsdaten senden{sperre ? " (gesperrt)" : ""}</button>
                      <button type="button" onClick={() => setTerminOffen(true)}>Termin buchen</button>
                      <button type="button" onClick={() => setProduktOffen(true)}>{buchungen.some((b) => b.offen && b.art === "paket") ? "Produkt tauschen" : "Produkt hinzufügen"}</button>
                      <button type="button" onClick={() => setBlatt(true)}>Gesprächsblatt</button>
                      <button type="button" onClick={() => setSendeMenue(true)}>E-Mail senden</button>
                      <button type="button" onClick={() => void nummerKorrektur()} disabled={!k.email}>Nummer korrigieren lassen</button>
                      <button type="button" onClick={() => void terminlinkKopieren()}>{linkKopiert ? "Terminlink kopiert" : "Terminlink kopieren"}</button>
                      {k.email && <a href={`mailto:${k.email}`}>eigenes Mailprogramm</a>}
                    </span>
                  )}
                </span>
              </div>
            </div>
            {sperre && sitArt === "rechnung_offen" && (
              <div className="pi-stapel">
                <span className="pi-luecke" style={{ color: "#fde68a" }}>{sperre.grund}</span>
                {sperre.ziel === "stammdaten" && (
                  <span className="pi-reihe">
                    <input className="pi-eingabe" value={mailNachtrag} onChange={(e) => setMailNachtrag(e.target.value)} placeholder="E-Mail nachtragen" type="email" inputMode="email" style={{ minWidth: 200 }} />
                    <button type="button" className="pi-knopf still" disabled={!!laeuft || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mailNachtrag.trim())} onClick={() => void mailNachtragen()}>{laeuft === "mailnachtrag" ? "Speichert …" : "Speichern"}</button>
                  </span>
                )}
                {sperre.ziel === "produkt" && <button type="button" className="pi-knopf still" onClick={() => setProduktOffen(true)}>Produkt anlegen</button>}
              </div>
            )}
            {!k.telefonWaehlbar && k.telefon && <NummerLandNachtragen k={k} onFertig={onNeu} />}
            {/* E-048 Nr. 1: VORHER Datum-/Uhrzeit-Freitext — NACHHER klickbare freie Zeiten. */}
            {terminOffen && (
              <SlotWahl laeuft={laeuft === "termin"} onBuchen={terminBuchen} onZu={() => setTerminOffen(false)} />
            )}
            {produktOffen && <ProduktDunkel k={k} aufKlappen={setProduktOffen} fertig={async (m) => { melden("gut", "Produkt gespeichert", m); await frisch(); onZaehler(); }} />}
          </section>

          {leitfadenAuf && <Leitfaden stufe={sitLeitfaden} startAuf />}

          {/* ═══ GESPRÄCH ABSCHLIESSEN (Justin 24.08.) ═══
              VORHER: „Ergebnis festhalten“ mit 4–5 gleichrangigen Knöpfen
              (Termin gebucht (Mandat) · Nicht erreicht · Nummer falsch ·
              Überlegt noch · Kein Interesse) — dieselben Wege standen zusätzlich
              in der Fokus-Karte der Pipeline.
              NACHHER: ZWEI Wege, so wie das Gespräch wirklich endet —
              „Mandat angenommen“ (steht kein Termin, wird er direkt hier
              gebucht und das Mandat danach automatisch verbucht) oder
              „Kunde abgelehnt“ (danach der Grund). Die überfällige Rate behält
              ihre eigenen Ausgänge (Reaktivierung, E-042a) — dort gibt es kein
              neues Mandat zu gewinnen. */}
          <Sek titel="Gespräch abschließen" erklaer={sitArt === "rate_ueberfaellig" ? "Wie ist das Reaktivierungs-Gespräch ausgegangen?" : "Zwei Wege: Mandat angenommen oder Kunde abgelehnt."}
               kopfRechts={<button type="button" className="pi-link" onClick={() => setAlleErgebnisse((v) => !v)}>{alleErgebnisse ? "zurück" : "anderes Ergebnis"}</button>}>
            {!alleErgebnisse && sitArt === "rate_ueberfaellig" && sitRate && (
              <div className="pi-ew">
                <div className="pi-reihe">
                  <button type="button" className={`pi-knopf klein ${sitFeld === "zahlt_am" ? "" : "still"}`} disabled={!!laeuft} onClick={() => { setSitFeld(sitFeld === "zahlt_am" ? null : "zahlt_am"); setSitDatum(tagPlus(1)); }}>Zahlt Rate am …</button>
                  <button type="button" className={`pi-knopf klein ${sitFeld === "ausgesetzt" ? "" : "still"}`} disabled={!!laeuft} onClick={() => { setSitFeld(sitFeld === "ausgesetzt" ? null : "ausgesetzt"); setSitDatum(tagPlus(30)); }}>1 Monat ausgesetzt + Termin</button>
                  <button type="button" className="pi-knopf klein still" disabled={!!laeuft} onClick={() => void sitRatenErgebnis("nicht_erreicht")}>{laeuft === "sit-nicht_erreicht" ? "…" : "Nicht erreicht"}</button>
                  <button type="button" className="pi-knopf klein warn" disabled={!!laeuft} onClick={() => void sitRatenErgebnis("nummer_blockiert")}>{laeuft === "sit-nummer_blockiert" ? "…" : "Kein Kontakt mehr möglich"}</button>
                </div>
                {sitFeld === "zahlt_am" && (
                  <div className="pi-ew-feld">
                    <label>Zahlt am<input type="date" className="pi-eingabe" value={sitDatum} min={heuteIso()} onChange={(e) => setSitDatum(e.target.value)} /></label>
                    <button type="button" className="pi-knopf klein" disabled={!!laeuft} onClick={() => void sitRatenErgebnis("zahlt_am", { zusageDatum: sitDatum })}>Speichern</button>
                  </div>
                )}
                {sitFeld === "ausgesetzt" && (
                  <div className="pi-ew-feld">
                    <label>Zahlt wieder am<input type="date" className="pi-eingabe" value={sitDatum} min={heuteIso()} onChange={(e) => setSitDatum(e.target.value)} /></label>
                    <button type="button" className="pi-knopf klein" disabled={!!laeuft} onClick={() => void sitRatenErgebnis("zahlt_am", { zusageDatum: sitDatum, notiz: "1 Monat ausgesetzt – Neustart mit Termin vereinbart." })}>Speichern</button>
                    <small className="pi-sek-neben">Buch danach oben den Termin – ausgesetzt ohne Gespräch verliert den Kunden.</small>
                  </div>
                )}
              </div>
            )}

            {!alleErgebnisse && sitArt !== "rate_ueberfaellig" && (
              <div className="pi-abschluss">
                {/* Die zwei Wege — groß, klar, nebeneinander. */}
                {abschluss === null && !abschlussTermin && (
                  <div className="pi-abschluss-wege">
                    <button type="button" className="pi-abschluss-weg gut" disabled={!!laeuft} onClick={() => void mandatBuchen()}>
                      <Check size={20} strokeWidth={2} />
                      <b>{laeuft === "mandat" ? "Speichert …" : "Mandat angenommen"}</b>
                      <small>{hatTermin ? "Termin steht – zählt sofort zu deinem Bestand." : "Termin fehlt noch – du buchst ihn gleich hier."}</small>
                    </button>
                    <button type="button" className="pi-abschluss-weg warn" disabled={!!laeuft} onClick={() => setAbschluss("abgelehnt")}>
                      <X size={20} strokeWidth={2} />
                      <b>Kunde abgelehnt</b>
                      <small>Danach wählst du den Grund.</small>
                    </button>
                  </div>
                )}

                {/* Mandat ohne Termin: erst den Termin klicken, dann verbucht
                    sich das Mandat von selbst. */}
                {abschlussTermin && (
                  <div className="pi-abschluss-schritt">
                    <p className="pi-sek-satz">Ein Mandat zählt mit gebuchtem Termin. Wähle die Zeit – danach wird das Mandat automatisch verbucht.</p>
                    <SlotWahl laeuft={laeuft === "termin" || laeuft === "mandat"}
                              onBuchen={async (iso, label) => {
                                const ok = await terminBuchen(iso, label);
                                if (!ok) return false;
                                setAbschlussTermin(false);
                                await mandatVerbuchen(label);
                                return true;
                              }}
                              onZu={() => setAbschlussTermin(false)} />
                  </div>
                )}

                {/* Ablehnung: der Grund. */}
                {abschluss === "abgelehnt" && (
                  <div className="pi-abschluss-schritt">
                    <p className="pi-sek-satz">Warum ist das Mandat nicht zustande gekommen?</p>
                    <div className="pi-reihe">
                      <button type="button" className="pi-knopf klein still" disabled={!!laeuft} onClick={async () => { if (await ergebnis("nicht_erreicht")) setAbschluss(null); }}>{laeuft === "nicht_erreicht" ? "…" : "Nicht erreicht"}</button>
                      <button type="button" className="pi-knopf klein still" disabled={!!laeuft} onClick={async () => { if (await ergebnis("nummer_falsch")) setAbschluss(null); }}>{laeuft === "nummer_falsch" ? "…" : "Nummer falsch"}</button>
                      <button type="button" className={`pi-knopf klein ${sitFeld === "rueckruf" ? "" : "still"}`} disabled={!!laeuft} onClick={() => setSitFeld(sitFeld === "rueckruf" ? null : "rueckruf")}>Überlegt noch – Rückruf</button>
                      <button type="button" className="pi-knopf klein warn" disabled={!!laeuft} onClick={async () => {
                        if (!(await fragen({
                          titel: `Mandat nicht zustande gekommen – ${k.name} hat kein Interesse?`,
                          text: "Der Kunde wird gesperrt: Er erscheint bei keinem Mitarbeiter mehr und die Verteilung fasst ihn nicht mehr an. Zahlungs- und Vertragsdaten bleiben erhalten.",
                          folge: "Der Vorgang steht mit Grund im Kontaktprotokoll.", ja: "Sperren", gefaehrlich: true,
                        }))) return;
                        await ergebnis("erreicht_abgelehnt", { notiz: "Mandat nicht zustande gekommen – kein Interesse, vom Kunden im Gespräch erklärt." });
                      }}>{laeuft === "erreicht_abgelehnt" ? "…" : "Kein Interesse"}</button>
                      <button type="button" className="pi-link" onClick={() => { setAbschluss(null); setSitFeld(null); }}>zurück</button>
                    </div>
                    {sitFeld === "rueckruf" && (
                      <div className="pi-ew-feld">
                        <label>Rückruf am<input type="date" className="pi-eingabe" value={sitDatum} min={heuteIso()} onChange={(e) => setSitDatum(e.target.value)} /></label>
                        <label>Uhrzeit<input type="time" className="pi-eingabe" value={sitZeit} step={900} onChange={(e) => setSitZeit(e.target.value)} /></label>
                        <button type="button" className="pi-knopf klein" disabled={!!laeuft} onClick={async () => { if (await ergebnis("rueckruf_termin", { terminDatum: sitDatum, terminZeit: sitZeit, notiz: "Mandat noch offen – Kunde überlegt, Rückruf vereinbart." })) { setSitFeld(null); setAbschluss(null); } }}>Speichern</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {alleErgebnisse && <ErgebnisWahlDunkel onErgebnis={(art, zusatz) => ergebnis(art, zusatz)} laeuft={laeuft} kundeName={k.name} vorgabeDatum={datumWert} fragen={fragen} />}
          </Sek>

          {/* E-046: Bei überfälliger Rate zeigt der Zahlungsbereich die RATE —
              VORHER stand hier „Zahlungsdaten: gesperrt – alles bezahlt“
              neben der offenen Rate (der gemeldete Widerspruch). */}
          {sitArt === "rate_ueberfaellig" && sitRate ? (
            <Sek titel="Offene Rate" erklaer="Diese Rate fehlt auf dem Konto. Referenz mitgeben – so ordnet die Buchhaltung die Zahlung sofort zu."
                 kopfRechts={<button type="button" className="pi-knopf still klein" onClick={() => void ratenKopieren()}><Copy size={13} strokeWidth={1.75} /> {kopiert ? "Kopiert" : "Bankdaten kopieren"}</button>}>
              <p className="pi-zweck-zahl">{sitRate.referenz ?? k.zahlung?.referenz ?? "—"}</p>
              <p className="pi-sek-satz">Rate {sitRate.nr} · {eur(sitRate.betragCents)} · fällig {sitRate.faelligAm ? dtag(sitRate.faelligAm) : "—"} · per Überweisung</p>
              <p className={`pi-sek-satz ${sepaGrund(sit?.rate ?? {}).ton === "rot" ? "warn" : sepaGrund(sit?.rate ?? {}).ton === "gelb" ? "warn" : "leise"}`}>{sepaGrund(sit?.rate ?? {}).text}</p>
              <p className="pi-sek-satz leise">Zahlungen bestätigt der Admin von Hand – bis dahin gilt die Rate als offen.</p>
              <div className="pi-reihe">
                <button type="button" className="pi-knopf still klein" disabled={laeuft === "sit-erinnerung"} onClick={() => void sitErinnerung()}>{laeuft === "sit-erinnerung" ? "…" : "Zahlungserinnerung senden"}</button>
                <button type="button" className="pi-link" onClick={() => setReiter("zahlungen")}>Alle Raten im Reiter „Zahlungen & Raten“</button>
              </div>
            </Sek>
          ) : k.zahlung?.referenz && sitArt !== "alles_gut" ? (
            <Sek titel="Verwendungszweck" erklaer="Die erste Zahlung ist immer eine Überweisung mit dieser Referenz – so ordnet die Buchhaltung das Geld dem Kunden zu."
                 kopfRechts={<button type="button" className="pi-knopf still klein" disabled={!k.zahlung.klartext} onClick={() => void zahlungsdatenKopieren()} title="Empfänger, IBAN, Betrag und Verwendungszweck als Text — fertig für WhatsApp"><Copy size={13} strokeWidth={1.75} /> {kopiert ? "Kopiert" : "Zahlungsdaten kopieren"}</button>}>
              <p className="pi-zweck-zahl">{k.zahlung.referenz}</p>
              {kopiert && <p className="pi-sek-satz gut">Empfänger, IBAN, Betrag und Verwendungszweck liegen in der Zwischenablage.</p>}
              {/* E-049 Nr. 2: Einträge springen in „Kunde bearbeiten“ (Daten-Reiter, Feld-Fokus). */}
              <VertragsLuecke k={k} melden={melden} onNachtragen={(feldKey) => { setReiter("daten"); setBearbeiten(true); setBearbeitenFokus(feldKey); }} />
              {!belegOffen ? (
                <button type="button" className="pi-link" onClick={() => setBelegOffen(true)}>Überweisungsbeleg hinterlegen</button>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  <p className="pi-sek-satz leise">Foto oder PDF der Überweisung. Es erscheint bei der Zahlungsprüfung neben dem Bankeingang. Gebucht wird dadurch nichts.</p>
                  <div className="pi-reihe">
                    <input type="file" accept="image/*,application/pdf" className="pi-eingabe" style={{ paddingTop: 8 }} onChange={(e) => setBelegDatei(e.target.files?.[0] ?? null)} />
                    <input type="date" className="pi-eingabe" style={{ flex: "0 0 160px" }} value={belegDatum} onChange={(e) => setBelegDatum(e.target.value)} max={new Date().toISOString().slice(0, 10)} title="Überweisungsdatum laut Beleg" />
                  </div>
                  <div className="pi-reihe">
                    <input className="pi-eingabe" value={belegNotiz} onChange={(e) => setBelegNotiz(e.target.value)} placeholder="Notiz (freiwillig)" />
                    <button type="button" className="pi-knopf klein" disabled={!belegDatei || !belegDatum || !!laeuft} onClick={() => void belegHochladen()}>{laeuft === "beleg" ? "Lädt …" : "Hinterlegen"}</button>
                    <button type="button" className="pi-link" onClick={() => { setBelegOffen(false); setBelegDatei(null); }}>Abbrechen</button>
                  </div>
                </div>
              )}
            </Sek>
          ) : null}

          {(k.nichtErreicht >= 2 || k.ruhtSeit) && (
            <Sek titel="Vorgeschichte" erklaer="Was mit diesem Kunden schon versucht wurde – damit niemand zum fünften Mal dieselbe Nummer wählt.">
              <p className={k.ruhtSeit ? "pi-sek-satz leise" : "pi-sek-satz warn"}>
                {k.nichtErreicht}× nicht erreicht
                {k.letzterKontakt && `, zuletzt ${dtag(k.letzterKontakt)}`}
                {k.terminlinkMailAm && `, Terminlink versandt ${dtag(k.terminlinkMailAm)}`}
              </p>
              {k.ruhtSeit && <p className="pi-sek-satz leise">Ruht bis {k.wiedervorlage ? dtag(k.wiedervorlage) : "zur Wiedervorlage"}. Nicht anrufen — er hat den Terminlink und meldet sich selbst.</p>}
              {!k.email && (
                <div className="pi-reihe">
                  <p className="pi-sek-satz leise">Keine E-Mail hinterlegt — es ging keine Mail raus.</p>
                  <button type="button" className="pi-knopf still klein" onClick={() => void terminlinkKopieren()}><Copy size={13} strokeWidth={1.75} /> {linkKopiert ? "Kopiert" : "Terminlink für WhatsApp kopieren"}</button>
                </div>
              )}
            </Sek>
          )}
        </>}

        {/* ═══ ZAHLUNGEN & RATEN ═══ */}
        {reiter === "zahlungen" && <>
          <Sek titel="Buchungen" erklaer="Jede Bestellung dieses Kunden – was gebucht ist, was bezahlt ist, was offen bleibt."
               kopfRechts={auswahl.size > 0 ? (
                 <span className="pi-reihe">
                   <button type="button" className="pi-knopf warn klein" disabled={laeuft === "arch-auswahl"} onClick={() => void auswahlWegraeumen()}>{laeuft === "arch-auswahl" ? "Wird weggeräumt …" : `Auswahl wegräumen (${auswahl.size})`}</button>
                   <button type="button" className="pi-link" onClick={() => setAuswahl(new Set())}>aufheben</button>
                 </span>
               ) : undefined}>
            {buchungen.length === 0 && <p className="pi-sek-satz leise">Noch keine Bestellung. Unter „Überblick“ legst du ein Produkt an.</p>}
            {buchungen.map((b) => (
              <div key={b.ref} className={`pi-buchung${b.bezahlt ? " bezahlt" : b.erledigt ? " erledigt" : " offen"}`}>
                <b>{b.bezeichnung}</b>
                <span className={`art${b.art === "bonitaet" ? " zusatz" : ""}`}>{b.art === "bonitaet" ? "Zusatz" : "Paket"}</span>
                {b.betragCents != null && <span className="betrag">{eur(b.betragCents)}</span>}
                <span className="zustand">{b.zahlungText}</span>
                {!b.erledigt && <a href={`/api/fiaon/agent/customers/${encodeURIComponent(b.ref)}/invoice.pdf`} target="_blank" rel="noreferrer">Rechnung (PDF) <ExternalLink size={11} /></a>}
                <span className="rechts">gestellt {b.gestelltAm ? dtag(b.gestelltAm) : "—"}{b.faelligAm && !b.bezahlt && ` · fällig ${dtag(b.faelligAm)}`}</span>
                {/* §16 (E-044): VORHER stand hier der Servertext k.karte.text – NACHHER die Vollständigkeits-Weiche. */}
                {b.art !== "bonitaet" && b.bezahlt && <span className="voll">Karte: {kartenText}</span>}
                {b.verwendungszweck && !b.bezahlt && <span className="voll mono">Verwendungszweck: {b.verwendungszweck}</span>}
                {!b.bezahlt && !b.erledigt && buchungen.filter((x) => !x.erledigt).length > 1 && (
                  <span className="rechts" style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
                    <label><input type="checkbox" checked={auswahl.has(b.ref)} onChange={() => umschalten(b.ref)} aria-label={`${b.bezeichnung} zum Wegräumen auswählen`} /> wählen</label>
                    <button type="button" className="pi-link" style={{ color: "#fcd34d" }} disabled={laeuft === `arch-${b.ref}` || laeuft === "arch-auswahl"} onClick={() => void buchungWegraeumen(b)}>{laeuft === `arch-${b.ref}` ? "…" : "Doppelt — wegräumen"}</button>
                  </span>
                )}
              </div>
            ))}
            {offeneBuchungen.length >= 2 && (
              <p className="pi-sek-satz" style={{ color: "#bfdbfe" }}>
                {gemeldet.length === 1
                  ? <>Der Kunde hat für <b style={{ color: "#fff" }}>{gemeldet[0].bezeichnung}</b> eine Zahlung gemeldet — sehr wahrscheinlich die gewollte Buchung. Die anderen kannst du wegräumen.</>
                  : <>{offeneBuchungen.length} offene Buchungen. Frag am Telefon, welche der Kunde will — die anderen räumst du hier weg.</>}
              </p>
            )}
            {offeneBuchungen.length > 0 && <p className="pi-sek-satz warn">Offen insgesamt: <b style={{ color: "#fff" }}>{eur(offeneBuchungen.reduce((s, b) => s + (b.betragCents ?? 0), 0))}</b></p>}
          </Sek>
          <RatenBlock k={k} melden={melden} fragen={fragen} onZaehler={onZaehler} />
        </>}

        {/* ═══ GESPRÄCHE ═══ */}
        {reiter === "gespraeche" && <>
          <Sek titel="Verlauf" erklaer="Jedes festgehaltene Ergebnis und jede Notiz – wer wann was mit diesem Kunden besprochen hat."
               kopfRechts={<small className="pi-sek-neben">{wartezeit(k.letzterKontakt)}</small>}>
            {!verlauf && <p className="pi-sek-satz leise">Lade …</p>}
            {verlauf && verlauf.length === 0 && <p className="pi-sek-satz leise">Noch kein Eintrag.</p>}
            {verlauf && verlauf.length > 0 && (
              <ul className="pi-protokoll">
                {verlauf.map((v: any, i: number) => (
                  <li key={v.id ?? i}>
                    <b>{new Date(v.am).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</b>
                    {" · "}<span>{v.von || v.agentName || v.agent || "System"}: {(ERGEBNIS_TEXT as Record<string, string>)[String(v.ergebnis)] || (v.art === "note" ? "Notiz" : v.art)}</span>
                    {v.notiz && <> — {v.notiz}</>}
                  </li>
                ))}
              </ul>
            )}
            <div className="pi-reihe">
              <input className="pi-eingabe" value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="Notiz hinzufügen"
                     onKeyDown={(e) => { if (e.key === "Enter" && notiz.trim().length >= 2 && !laeuft) void ergebnis("notiz"); }} />
              <button type="button" className="pi-knopf klein" disabled={notiz.trim().length < 2 || !!laeuft} onClick={() => void ergebnis("notiz")}>{laeuft === "notiz" ? "…" : "Speichern"}</button>
            </div>
          </Sek>
          <Sek titel="Anrufe & Aufnahmen" erklaer="Jeder Anruf über das System – mit Aufnahme und Zusammenfassung, solange die Aufbewahrungsfrist läuft.">
            {anrufe === null && <p className="pi-sek-satz leise">Lade Anrufe …</p>}
            {anrufe && anrufe.length === 0 && <p className="pi-sek-satz leise">Noch kein Anruf über das System. Anrufe von Hand tauchen hier nicht auf – halte ihr Ergebnis im Verlauf fest.</p>}
            {anrufe && anrufe.map((a: any) => (
              <div key={a.id} className="pi-anruf">
                <div className="pi-anruf-kopf">
                  <b>{a.richtung === "eingehend" ? "Kunde rief an" : "Anruf an den Kunden"}</b>
                  <span>{new Date(a.beginn).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}{a.dauer_sek ? ` · ${Math.round(Number(a.dauer_sek) / 60)} Min` : ""}{a.agent ? ` · ${a.agent}` : ""}</span>
                </div>
                {a.zusammenfassung && <p className="pi-sek-satz leise">{a.zusammenfassung}</p>}
                {a.hat_aufnahme && <AnrufPlayer anrufId={Number(a.id)} ton="dunkel" />}
              </div>
            ))}
          </Sek>
          <Sek titel="Kein echter Kunde?" erklaer="Melden statt löschen – die Vertriebsleitung prüft, der Kunde bleibt bis zur Entscheidung in deiner Liste.">
            {!testOffen ? (
              <button type="button" className="pi-link" style={{ justifySelf: "start" }} onClick={() => setTestOffen(true)}>Als Testeintrag melden</button>
            ) : (
              <div className="pi-reihe">
                <input className="pi-eingabe" value={testNotiz} onChange={(e) => setTestNotiz(e.target.value)} placeholder="Woran erkennst du das? (ein Satz)" />
                <button type="button" className="pi-knopf still klein" disabled={testNotiz.trim().length < 5 || !!laeuft} onClick={() => void testeintragMelden()}>{laeuft === "test" ? "Meldet …" : "Melden"}</button>
                <button type="button" className="pi-link" onClick={() => { setTestOffen(false); setTestNotiz(""); }}>Abbrechen</button>
              </div>
            )}
          </Sek>
        </>}

        {/* ═══ E-MAILS ═══ */}
        {reiter === "mails" && (
          <Sek titel="Versand" erklaer="Was an diesen Kunden rausging und was du erneut schicken kannst. Freie E-Mails mit Vorschau öffnen im Sendefenster darüber."
               kopfRechts={<button type="button" className="pi-knopf klein" onClick={() => setSendeMenue(true)}><Mail size={13} strokeWidth={1.75} /> E-Mail senden</button>}>
            <Versandzentrum personId={k.personId} />
          </Sek>
        )}

        {/* ═══ DOKUMENTE ═══ */}
        {reiter === "dokumente" && (
          <Sek titel="Dokumente" erklaer="Was der Kunde hochgeladen hat – Ausweis, Kontoauszug, Auskunft. Zum Prüfen antippen, es öffnet in einem neuen Fenster.">
            {doku === null && <p className="pi-sek-satz leise">Lade den Stand …</p>}
            {doku === "fehlt" && <p className="pi-sek-satz leise">Zu diesem Kunden liegt noch keine Bestellung mit Unterlagen vor.</p>}
            {doku && doku !== "fehlt" && (
              <>
                {(doku.dokumente || []).map((d: any) => (
                  <div key={d.art} className="pi-doku">
                    <span className={`punkt${d.vorhanden ? " da" : ""}`} aria-hidden="true" />
                    <div className="wer"><b>{d.label}</b><small>{d.vorhanden ? `${d.typ === "bild" ? "Foto" : d.typ === "pdf" ? "PDF" : "Datei"}${d.groesseKb ? ` · ${d.groesseKb} KB` : ""}${d.seit ? ` · seit ${dtag(d.seit)}` : ""}` : d.benoetigt ? "fehlt noch – der Kunde lädt es in seinem Bereich hoch" : "für dieses Paket nicht nötig"}{d.erneutAngefordert ? " · erneut angefordert" : ""}</small></div>
                    {d.vorhanden && <a className="pi-knopf still klein" href={`/api/fiaon/agent/dokumente/${k.personId}/${d.art}/datei`} target="_blank" rel="noreferrer">Öffnen <ExternalLink size={12} /></a>}
                  </div>
                ))}
                <p className="pi-sek-satz leise">Vollständig heißt: Paket bezahlt, SCHUFA (74 €) bezahlt, Kontoauszug und Ausweis da – erst dann liegt der Kunde bei FIAON zur Bearbeitung. Stand: {kartenText}.</p>
              </>
            )}
          </Sek>
        )}

        {/* ═══ AKTIVITÄT ═══ */}
        {reiter === "aktivitaet" && <AktivitaetsZeit akt={akt} fehler={aktFehler} />}

        {/* ═══ DATEN ═══ */}
        {reiter === "daten" && (
          <Sek titel="Stammdaten" erklaer="So steht der Kunde in der Akte. Jede Änderung wird mit altem und neuem Wert festgehalten."
               kopfRechts={<button type="button" className="pi-link" onClick={() => setBearbeiten((v) => !v)}>{bearbeiten ? "Schließen" : "Kunde bearbeiten"}</button>}>
            {/* Justin 24.08.: VORHER lief man bei Kunden OHNE Bestellung (fast
                immer Neukunden) hier in eine Sackgasse — beim Speichern kam nur
                die rote Meldung „Keine Bestellung – ohne Bestellung gibt es
                keine Akte, an der die Daten hängen“. NACHHER steht der Hinweis
                VOR dem Tippen da und trägt den Ausweg als Knopf: ein Klick legt
                das Produkt an, danach lassen sich die Daten speichern. */}
            {!hatBestellung && (
              <div className="pi-sackgasse">
                <span><b>Noch keine Bestellung</b>Die Stammdaten hängen an der Bestellung – ohne Paket gibt es nichts, woran sie hängen.</span>
                <button type="button" className="pi-knopf klein" onClick={() => setProduktOffen(true)}>Produkt hinzufügen</button>
              </div>
            )}
            {produktOffen && <ProduktDunkel k={k} aufKlappen={setProduktOffen} fertig={async (m) => { melden("gut", "Produkt gespeichert", m); await frisch(); onZaehler(); }} />}
            {bearbeiten && <KundeBearbeiten k={k} melden={melden} fokus={bearbeitenFokus} onProdukt={() => setProduktOffen(true)} onFertig={async () => { setBearbeiten(false); setBearbeitenFokus(null); await frisch(); }} />}
            {/* E-047 Nr. 4, NEUE REGEL: Jeder „fehlt“-Hinweis ist klickbar und
                öffnet das Formular MIT Fokus auf dem fehlenden Feld. */}
            <dl className="pi-dl">
              {([
                ["Adresse", [k.stammdaten?.strasse, [k.stammdaten?.plz, k.stammdaten?.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null, "street"],
                ["Land", k.stammdaten?.land ? (LAND_NAME[k.stammdaten.land] || k.stammdaten.land) : null, null],
                ["Geburtsdatum", k.stammdaten?.geburtsdatum ? dtag(String(k.stammdaten.geburtsdatum)) : null, "birthdate"],
                ["E-Mail", k.email, "email"], ["Telefon", k.telefon, "phone"],
                ["Verwendungszweck", k.zahlung?.referenz, null],
                ["Wiedervorlage", k.wiedervorlage ? dtag(k.wiedervorlage) : null, null],
                ["Betreut seit", k.betreutSeit ? dtag(k.betreutSeit) : null, null],
                ["Mandat seit", k.mandatSeit ? dtag(k.mandatSeit) : null, null],
              ] as [string, string | null | undefined, string | null][]).map(([l, w, feldKey]) => (
                <div key={l}><dt>{l}</dt>
                  <dd className={w ? "" : "fehlt"}>
                    {w || (feldKey
                      ? <button type="button" className="pi-link" onClick={() => { setBearbeiten(true); setBearbeitenFokus(feldKey); }}>{l} fehlt – jetzt nachtragen</button>
                      : "nicht hinterlegt")}
                  </dd>
                </div>
              ))}
            </dl>
            {!k.telefonWaehlbar && k.telefon && <NummerLandNachtragen k={k} onFertig={onNeu} />}
          </Sek>
        )}
      </div>

      {/* E-052: VORHER öffnete hier das HELLE Versandzentrum über der dunklen
          Akte (Justins Screenshot) — NACHHER dieselbe Komponente in der
          Office-Glas-Fassung (ton="dunkel"); Logik und Endpunkte unverändert. */}
      <SendeMenue personId={k.personId} offen={sendeMenue} onSchliessen={() => setSendeMenue(false)} onGesendet={onZaehler} ton="dunkel" />
      <Gespraechsblatt personId={k.personId} offen={blatt} onZu={() => setBlatt(false)} />
      {bestaetigen && (
        <RechnungBestaetigung personId={k.personId} kundeName={k.name} laeuft={laeuft === "rechnung"}
                              onAbbrechen={() => { setBestaetigen(false); setSendeFehler(null); }}
                              onSenden={(ref) => void zahlungsdaten(ref)} sendeFehler={sendeFehler} />
      )}
    </aside>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// E-045: Überfällige Raten in der Akte — die zwei Ausgänge über die
// Collections-Endpunkte (POST /inkasso/rate/:id/erinnerung · …/ergebnis).
// Daten kommen mit dem Kunden aus /inkasso/liste (rateListe).
// ═══════════════════════════════════════════════════════════════════════════
function RatenBlock({ k, melden, fragen, onZaehler }: {
  k: Kunde; melden: (art: "gut" | "schlecht" | "info", titel: string, text?: string) => void;
  fragen: ReturnType<typeof useFragen>; onZaehler: () => void;
}) {
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [offenFuer, setOffenFuer] = useState<number | null>(null);
  const [wahl, setWahl] = useState<RatenErgebnis | "">("");
  const [datum, setDatum] = useState(tagPlus(1));
  const [notizR, setNotizR] = useState("");
  if (!k.istRate || !(k.rateListe?.length)) return null;
  const gewaehlt = RATEN_ERGEBNISSE.find((e) => e.art === wahl) || null;

  const erinnern = async (rate: NonNullable<Kunde["rateListe"]>[number]) => {
    if (!(await fragen({ titel: `Zahlungserinnerung für Rate ${rate.rateNr} an den Kunden schicken?`, ja: "Senden" }))) return;
    setLaeuft(`er-${rate.id}`);
    const r = await api(`/inkasso/rate/${rate.id}/erinnerung`, { method: "POST", body: JSON.stringify({}) });
    setLaeuft(null);
    melden(r.ok ? "gut" : "schlecht", r.ok ? "Erinnerung verschickt" : "Nicht verschickt", r.json?.meldung || r.json?.error || undefined);
  };
  const buchen = async (rate: NonNullable<Kunde["rateListe"]>[number]) => {
    if (!gewaehlt) return;
    if (gewaehlt.braucht === "datum" && !/^\d{4}-\d{2}-\d{2}$/.test(datum)) { melden("schlecht", "Bitte das zugesagte Datum angeben."); return; }
    if (gewaehlt.braucht === "notiz" && notizR.trim().length < 5) { melden("schlecht", "Bitte kurz begründen – ein Satz genügt."); return; }
    setLaeuft(`erg-${rate.id}`);
    const r = await api(`/inkasso/rate/${rate.id}/ergebnis`, {
      method: "POST",
      body: JSON.stringify({ ergebnis: gewaehlt.art, zusageDatum: gewaehlt.braucht === "datum" ? datum : undefined, notiz: notizR.trim() || undefined }),
    });
    setLaeuft(null);
    if (!r.ok) { melden("schlecht", "Nicht gebucht", r.json?.error || "Bitte erneut versuchen."); return; }
    melden("gut", "Ergebnis gebucht", r.json?.meldung || gewaehlt.label);
    setOffenFuer(null); setWahl(""); setNotizR("");
    onZaehler();
  };

  return (
    <section className="pi-sek" style={{ ["--hitze" as string]: STUFE.rate.farbe }}>
      <div className="pi-sek-kopf"><div><b>Rate überfällig – zurückholen</b>
        <p>Jede Rate, wie sie auf dem Konto ankommen sollte. Weich einsteigen (Leitfaden in der Pipeline) – holst du sie zurück, gehören 50 % dir.</p></div></div>
      <p className="pi-sek-satz leise">Zahlungen bestätigt der Admin von Hand – bis dahin gilt eine Rate als offen.</p>
      {k.rateListe.map((r) => (
        <div key={r.id} className="pi-rate">
          <span className="pi-glut" aria-hidden="true" />
          <div className="wer">
            <b>Rate {r.rateNr} · {eur(r.betragCents)}</b>
            <small>{r.faelligAm ? `fällig ${dtag(r.faelligAm)}` : "fällig"} · {r.status}{r.betragCents ? ` · Bonus bei Rückholung ${eur(Math.round(r.betragCents * REAKTIVIERUNG_ANTEIL))}` : ""}</small>
            {/* E-047/§18 Nr. 9: der Grund an der Rate */}
            <small className={`sepa ${sepaGrund(r).ton}`}>{sepaGrund(r).text}</small>
          </div>
          <span className="pi-reihe">
            <button type="button" className="pi-knopf still klein" disabled={laeuft === `er-${r.id}`} onClick={() => void erinnern(r)}>{laeuft === `er-${r.id}` ? "…" : "Erinnerung senden"}</button>
            <button type="button" className="pi-knopf klein" onClick={() => { setOffenFuer(offenFuer === r.id ? null : r.id); setWahl(""); }}>Ergebnis buchen</button>
          </span>
          {offenFuer === r.id && (
            <div className="pi-rate-form">
              <div className="pi-reihe">
                <select className="pi-eingabe" style={{ minHeight: 40 }} value={wahl} onChange={(e) => setWahl(e.target.value as RatenErgebnis)}>
                  <option value="">— Ergebnis wählen —</option>
                  {RATEN_ERGEBNISSE.map((e) => <option key={e.art} value={e.art}>{e.label}</option>)}
                </select>
                {gewaehlt?.braucht === "datum" && <input type="date" className="pi-eingabe" style={{ flex: "0 0 160px" }} value={datum} min={heuteIso()} onChange={(e) => setDatum(e.target.value)} />}
                <button type="button" className="pi-knopf klein" disabled={!gewaehlt || laeuft === `erg-${r.id}`} onClick={() => void buchen(r)}>{laeuft === `erg-${r.id}` ? "…" : "Buchen"}</button>
              </div>
              {gewaehlt?.braucht === "notiz" && <input className="pi-eingabe" value={notizR} onChange={(e) => setNotizR(e.target.value)} placeholder="Begründung (ein Satz)" />}
              {gewaehlt && <p className="pi-sek-satz leise">{gewaehlt.hinweis}</p>}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Die Ergebniswahl, DUNKEL nachgebaut (Justin 23.08.: keine hellen Einlagen).
// VORHER: helle Einlage mit components/agent/ErgebnisWahl. NACHHER: dieselbe
// Liste (shared/fiaon-kontakt-ergebnis-liste), dieselben Pflichten (Zusage-
// Datum, Termin, Notiz ab NOTIZ_MINDESTLAENGE Zeichen, Rückfrage bei Übergabe)
// — nur die Oberfläche ist Office-Glas. Der Endpunkt bleibt der des Aufrufers.
// ═══════════════════════════════════════════════════════════════════════════
function ErgebnisWahlDunkel({ onErgebnis, laeuft, kundeName, vorgabeDatum, fragen }: {
  onErgebnis: (art: string, zusatz: { notiz?: string; zusageDatum?: string; terminDatum?: string; terminZeit?: string }) => Promise<boolean>;
  laeuft: string | null; kundeName: string; vorgabeDatum: string;
  fragen: ReturnType<typeof useFragen>;
}) {
  const [offen, setOffen] = useState<null | { art: string; braucht: "zusage" | "termin" | "notiz" }>(null);
  const [notiz, setNotiz] = useState("");
  const [datum, setDatum] = useState(vorgabeDatum);
  const [zeit, setZeit] = useState("10:00");
  const fehlt = Math.max(0, NOTIZ_MINDESTLAENGE - notiz.trim().length);

  const anklicken = async (art: string) => {
    const e = ERGEBNIS_LISTE.find((x) => x.art === art)!;
    if (e.braucht && offen?.art === art) { setOffen(null); return; }
    if (e.braucht) { setOffen({ art, braucht: e.braucht }); return; }
    if (e.gibtAb && !(await fragen({
      titel: `${kundeName || "Der Kunde"} hat deine Nummer blockiert?`,
      text: "Der Kunde geht sofort an den Kollegen mit dem kleinsten Bestand, der bei ihm noch nicht blockiert wurde. Er verschwindet aus deiner Liste.",
      folge: "Die Provision folgt dem, der den Abschluss dokumentiert.",
      ja: "Übergeben",
    }))) return;
    if (await onErgebnis(art, {})) setOffen(null);
  };
  const speichern = async () => {
    if (!offen) return;
    const zusatz = offen.braucht === "zusage" ? { zusageDatum: datum }
      : offen.braucht === "termin" ? { terminDatum: datum, terminZeit: zeit }
      : { notiz: notiz.trim() };
    if (await onErgebnis(offen.art, zusatz)) { setOffen(null); setNotiz(""); }
  };

  return (
    <div className="pi-ew">
      <div className="pi-reihe">
        {ERGEBNIS_LISTE.map((e) => (
          <button key={e.art} type="button" disabled={!!laeuft}
                  className={`pi-knopf klein ${offen?.art === e.art ? "" : "still"}`}
                  aria-expanded={offen?.art === e.art ? true : undefined}
                  title={e.klartext}
                  onClick={() => void anklicken(e.art)}>
            {laeuft === e.art ? "…" : e.knopf}
          </button>
        ))}
      </div>
      {offen?.braucht === "zusage" && (
        <div className="pi-ew-feld">
          <label>Zahlt am<input type="date" className="pi-eingabe" value={datum} min={heuteIso()} onChange={(e) => setDatum(e.target.value)} /></label>
          <button type="button" className="pi-knopf klein" disabled={!!laeuft} onClick={() => void speichern()}>Speichern</button>
        </div>
      )}
      {offen?.braucht === "termin" && (
        <div className="pi-ew-feld">
          <label>Rückruf am<input type="date" className="pi-eingabe" value={datum} min={heuteIso()} onChange={(e) => setDatum(e.target.value)} /></label>
          <label>Uhrzeit<input type="time" className="pi-eingabe" value={zeit} step={900} onChange={(e) => setZeit(e.target.value)} /></label>
          <button type="button" className="pi-knopf klein" disabled={!!laeuft} onClick={() => void speichern()}>Speichern</button>
        </div>
      )}
      {offen?.braucht === "notiz" && (
        <div className="pi-ew-feld breit">
          <textarea className="pi-eingabe" value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="Was wurde besprochen? Der nächste Anrufer fängt sonst bei null an." autoFocus />
          <div className="pi-reihe">
            <button type="button" className="pi-knopf klein" disabled={!!laeuft || fehlt > 0} onClick={() => void speichern()}>Speichern</button>
            <small className="pi-sek-neben">{fehlt > 0 ? `noch ${fehlt} Zeichen` : "bereit"}</small>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Produkt wechseln, DUNKEL nachgebaut. VORHER: helle Einlage mit
// components/agent/ProduktDialog. NACHHER: derselbe Katalog
// (GET /agent/katalog) und derselbe Schreibweg
// (POST /agent/customers/:ref/produkt { packKey }) — Office-Glas.
// ═══════════════════════════════════════════════════════════════════════════
function ProduktDunkel({ k, aufKlappen, fertig }: { k: Kunde; aufKlappen: (v: boolean) => void; fertig: (meldung: string) => void }) {
  const [pakete, setPakete] = useState<any[]>([]);
  const [gewaehlt, setGewaehlt] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  useEffect(() => {
    api("/agent/katalog").then((r) => { if (r.ok) setPakete(r.json.pakete ?? []); else setFehler("Der Paketkatalog ließ sich nicht laden."); });
  }, []);
  const buchungen = k.buchungen ?? [];
  const offenesPaket = buchungen.find((b) => b.offen && b.art === "paket");
  const istTausch = !!offenesPaket;
  const paket = pakete.find((p) => p.key === gewaehlt);
  const anlegen = async () => {
    if (!paket) return;
    setLaeuft(true); setFehler(null);
    const ref = offenesPaket?.ref ?? buchungen.find((b) => !b.erledigt)?.ref ?? buchungen[0]?.ref;
    if (!ref) { setLaeuft(false); setFehler("Diese Akte hat keine Bestellung, an die ein Produkt gehängt werden kann."); return; }
    const r = await api(`/agent/customers/${encodeURIComponent(ref)}/produkt`, { method: "POST", body: JSON.stringify({ packKey: paket.key }) });
    setLaeuft(false);
    if (!r.ok) { setFehler(String(r.json?.error ?? "Der Server hat abgelehnt. Bitte erneut versuchen.")); return; }
    aufKlappen(false);
    fertig(r.json.hinweis ? `${paket.label} angelegt. ${r.json.hinweis}` : `${paket.label} angelegt — Verwendungszweck ${r.json.zahlungsreferenz ?? "in der Akte"}.`);
  };
  // 24.08.2026 (Justin: „stehen keine Preise"): VORHER las die Anzeige
  // `p.preisCents` — der Katalog liefert aber `preisEuro`. Number(undefined)
  // ergibt NaN, und so stand bei JEDEM Paket „NaN €/Monat". NACHHER liest sie
  // das Feld, das wirklich kommt, und fängt einen fehlenden Preis ab, statt
  // ihn zu erfinden.
  const preisText = (p: any): string => {
    // Der Katalog liefert `preisEuro`; die geteilte Paketliste
    // (shared/fiaon-pakete.ts) führt dieselbe Zahl als `preisCents`. Beide
    // Schreibweisen werden gelesen — an genau dieser Verwechslung stand bei
    // jedem Paket „NaN €". Fehlt der Preis wirklich, sagt die Anzeige das,
    // statt eine Zahl zu erfinden.
    const euro = Number.isFinite(Number(p?.preisEuro)) ? Number(p.preisEuro)
      : Number.isFinite(Number(p?.preisCents)) ? Number(p.preisCents) / 100
      : NaN;
    if (!Number.isFinite(euro)) return "Preis nicht hinterlegt";
    return `${euro.toFixed(2).replace(".", ",")} €${p.abo ? " / Monat" : " einmalig"}`;
  };

  return (
    <div className="pi-produkt">
      <div className="pi-sek-kopf"><div><b>{istTausch ? "Produkt tauschen" : "Produkt hinzufügen"}</b>
        <p>{istTausch ? `Das offene Paket (${offenesPaket?.bezeichnung}) wird ersetzt – Preis und Verwendungszweck kommen aus dem Katalog.` : "Ein Paket aus dem Katalog an diese Akte hängen – Preis und Verwendungszweck kommen aus dem Katalog."}</p></div>
        <button type="button" className="pi-link" onClick={() => aufKlappen(false)}>Schließen</button></div>

      {/* 24.08.2026 (Justin: „sieht schrecklich aus — alles perfekt in unserer
          CI"): VORHER ein natives <select>. Das malt der Browser in seinem
          eigenen Stil — auf dem Mac eine weiße Liste mitten im dunklen Glas.
          NACHHER Karten in der Office-CI: Name groß, Preis darunter, die
          gewählte Karte leuchtet. Kein Fremdkörper mehr. */}
      {pakete.length === 0 && !fehler && <p className="pi-sek-satz leise">Lade den Katalog …</p>}
      <div className="pi-pakete">
        {pakete.map((p: any) => (
          <button key={p.key} type="button"
                  className={`pi-paket${gewaehlt === p.key ? " an" : ""}`}
                  aria-pressed={gewaehlt === p.key}
                  onClick={() => setGewaehlt(gewaehlt === p.key ? "" : p.key)}>
            <b>{p.label}</b>
            <span>{preisText(p)}</span>
            {p.art && <em>{p.art === "privat" ? "Privat" : p.art === "business" ? "Geschäftlich" : p.art}</em>}
          </button>
        ))}
      </div>

      <div className="pi-reihe" style={{ marginTop: 12 }}>
        <button type="button" className="pi-knopf gross" disabled={!paket || laeuft} onClick={() => void anlegen()}>
          {laeuft ? "Speichert …" : istTausch ? "Paket tauschen" : "Paket hinzufügen"}
        </button>
        {paket && <span className="pi-sek-neben">{paket.label} · {preisText(paket)}</span>}
      </div>
      {fehler && <p className="pi-sek-satz warn">{fehler}</p>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// E-044/§16: Die Zeitleiste der Akte — ALLE Kundenereignisse, nach Tag
// gruppiert, mit Filter-Chips. Daten: GET /agent/vertrieb/aktivitaet/:id
// (Klicks aus fiaon_click_events, Bestellungen/Zahlungen/Raten, Mails,
// Anrufe, Gesprächsergebnisse). Rohe Event-Namen nur als Nebentext.
// ═══════════════════════════════════════════════════════════════════════════
const AKT_FILTER: { key: string; label: string }[] = [
  { key: "alle", label: "Alles" },
  { key: "klick", label: "Klicks" },
  { key: "zahlung", label: "Zahlungen" },
  { key: "gespraech", label: "Gespräche" },
  { key: "mail", label: "Mails" },
];
function AktivitaetsZeit({ akt, fehler }: { akt: { ereignisse: any[] } | null; fehler: string | null }) {
  const [filter, setFilter] = useState("alle");
  const liste = useMemo(() => {
    const e = akt?.ereignisse ?? [];
    return filter === "alle" ? e : e.filter((x) => x.kat === filter || (filter === "klick" && x.kat === "system"));
  }, [akt, filter]);
  const tage = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const e of liste) {
      const tag = new Date(e.am).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
      if (!m.has(tag)) m.set(tag, []);
      m.get(tag)!.push(e);
    }
    return Array.from(m.entries());
  }, [liste]);
  if (fehler) return <div className="pi-block"><p className="warn">{fehler}</p></div>;
  if (!akt) return <div className="pi-block"><p className="leise">Lade die Zeitleiste …</p></div>;
  return (
    <div className="pi-block" style={{ gap: 12 }}>
      <div className="pi-reihe">
        {AKT_FILTER.map((f) => (
          <button key={f.key} type="button" className={`pi-chip-akt${filter === f.key ? " an" : ""}`} onClick={() => setFilter(f.key)}>{f.label}</button>
        ))}
      </div>
      {tage.length === 0 && <p className="leise">Für diese Auswahl ist noch nichts festgehalten.</p>}
      {tage.map(([tag, eintraege]) => (
        <div key={tag} className="pi-zeit-tag">
          <b>{tag}</b>
          <ol className="pi-zeit">
            {eintraege.map((e: any, i: number) => (
              <li key={`${e.am}-${i}`} className={`kat-${e.kat}`}>
                <span className="uhr">{new Date(e.am).toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" })}</span>
                <span className="punkt" aria-hidden="true" />
                <span className="text">
                  <b>{e.titel}</b>
                  {e.detail && <small>{e.detail}</small>}
                  {e.roh && <em>{e.roh}</em>}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

// ── Vertragslücke: fehlende Felder + Zustimmungs-Link (POST …/zustimmungs-link) ──
// E-049 Nr. 2 (Justin, Screenshot „Verwendungszweck“): VORHER stand die Liste
// DOPPELT — „Für den Vertrag fehlen noch: …“ und direkt darunter fast derselbe
// Text als Erklärung („… kannst du am Telefon aufnehmen — über Kunde
// bearbeiten“). NACHHER: EINE Fehlt-Liste; jeder Eintrag, den „Kunde
// bearbeiten“ kennt, ist selbst der klickbare „jetzt nachtragen“-Sprung
// (öffnet den Daten-Reiter mit Fokus auf dem Feld — dieselbe Mechanik wie
// E-047 Nr. 4). Antragsfelder ohne Formularfeld bleiben stille Chips,
// Zustimmungen behalten den Kunden-Link (nur der Kunde darf zustimmen).
/** Feldname (Server-Klartext) → Feld in „Kunde bearbeiten“. */
const LUECKE_SPRUNG: Record<string, string> = {
  "Vorname": "firstName", "Nachname": "lastName", "Geburtsdatum": "birthdate",
  "Telefonnummer": "phone", "Straße": "street", "PLZ": "zip", "Ort": "city",
  "E-Mail-Adresse": "email",
};
function VertragsLuecke({ k, melden, onNachtragen }: {
  k: Kunde;
  melden: (art: "gut" | "schlecht" | "info", titel: string, text?: string) => void;
  /** Springt in „Kunde bearbeiten“ (Daten-Reiter) mit Fokus auf dem Feld. */
  onNachtragen?: (feldKey: string) => void;
}) {
  const [laeuft, setLaeuft] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  if (!k.fehlendeFelder) return null;
  const zustimmungen = (k.zustimmungFehlt || "").split(", ").filter(Boolean);
  const sachangaben = k.fehlendeFelder.split(", ").filter((f) => f.trim() && !zustimmungen.includes(f.trim()));
  const linkSenden = async () => {
    setLaeuft(true);
    const r = await api(`/agent/crm/kunden/${k.personId}/zustimmungs-link`, { method: "POST" });
    setLaeuft(false);
    if (!r.ok) { melden("schlecht", "Nicht möglich", r.json?.error || "Bitte erneut versuchen."); return; }
    setLink(r.json.link ?? null);
    melden(r.json.gesendet ? "gut" : "schlecht", r.json.gesendet ? "Link verschickt" : "Mail nicht zugestellt", r.json.meldung);
  };
  return (
    <span className="pi-stapel breit">
      <span className="pi-luecke">Für den Vertrag fehlt noch:</span>
      <span className="pi-luecke-liste">
        {sachangaben.map((name) => (LUECKE_SPRUNG[name] && onNachtragen ? (
          <button key={name} type="button" className="pi-luecke-chip" title="Öffnet „Kunde bearbeiten“ mit dem Feld im Fokus."
                  onClick={() => onNachtragen(LUECKE_SPRUNG[name])}>
            {name} – jetzt nachtragen
          </button>
        ) : (
          <span key={name} className="pi-luecke-chip still" title="Steht im Antrag – nimmt der Kunde dort auf, oder du gehst den Antrag mit ihm am Telefon durch.">{name}</span>
        )))}
        {zustimmungen.map((name) => (
          <span key={name} className="pi-luecke-chip still" title="Zustimmungen darf nur der Kunde selbst geben — der Link unten führt ihn hin.">{name} · nur der Kunde</span>
        ))}
      </span>
      {zustimmungen.length > 0 && (
        <>
          <button type="button" className="pi-link" style={{ justifySelf: "start", alignSelf: "flex-start" }} onClick={() => void linkSenden()} disabled={laeuft} title="Zustimmungen darf nur der Kunde selbst geben — dieser Link führt ihn hin.">
            {laeuft ? "Sende …" : "Zustimmungs-Link an den Kunden senden"}
          </button>
          {link && <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="pi-luecke-link" aria-label="Zustimmungs-Link zum Kopieren" />}
        </>
      )}
    </span>
  );
}

// ── Nummer ohne Land — Vorwahl ergänzen (POST …/nummer-land) ──────────────
function NummerLandNachtragen({ k, onFertig }: { k: Kunde; onFertig: (neu: Kunde) => void }) {
  const vorschlag = k.landVorschlag?.land ?? "";
  const [land, setLand] = useState(vorschlag);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const VORWAHL: Record<string, string> = { DE: "+49", AT: "+43", CH: "+41", IT: "+39", RO: "+40", SK: "+421" };
  const roh = String(k.nummerRoh ?? k.telefon ?? "").replace(/[\s()/.\-]/g, "");
  const wird = land && VORWAHL[land] && roh.startsWith("0") ? `${VORWAHL[land]}${roh.replace(/^0+/, "")}` : null;
  const speichern = async () => {
    setLaeuft(true); setFehler(null);
    const r = await api(`/agent/crm/kunden/${k.personId}/nummer-land`, { method: "POST", body: JSON.stringify({ land }) });
    setLaeuft(false);
    if (r.ok) {
      setMeldung(r.json.meldung);
      const n = await api(`/agent/crm/kunden/${k.personId}`);
      if (n.ok && n.json?.kunde) onFertig(n.json.kunde);
    } else setFehler(r.json?.error || "Das hat nicht geklappt.");
  };
  if (meldung) return <span className="pi-marke gut" style={{ padding: "10px 14px" }}>{meldung}</span>;
  return (
    <span className="pi-nummer-land">
      <b>{k.telefon}</b>
      <small>Ländervorwahl fehlt — nicht anrufbar. Woher kommt der Kunde?</small>
      <span className="pi-reihe">
        <select className="pi-eingabe" style={{ minHeight: 36, flex: 1 }} value={land} onChange={(e) => { setLand(e.target.value); setFehler(null); }} aria-label="Land des Kunden">
          <option value="">— Land wählen —</option>
          {Object.entries(LAND_NAME).map(([c, n]) => <option key={c} value={c}>{n}</option>)}
        </select>
        <button type="button" className="pi-knopf klein" onClick={() => void speichern()} disabled={!land || laeuft}>{laeuft ? "…" : "Speichern"}</button>
      </span>
      {wird && <span className="vorschau">{k.nummerRoh ?? k.telefon} + {land} → <b>{wird}</b></span>}
      {vorschlag && <small className="grau">Vorschlag {vorschlag} ({k.landVorschlag?.grund}) — bitte prüfen, nicht raten.</small>}
      {!vorschlag && k.landVorschlag?.grund && <small className="grau">Kein Vorschlag: {k.landVorschlag.grund}.</small>}
      {fehler && <small className="rot">{fehler}</small>}
    </span>
  );
}

// ── Versandzentrum (GET/POST /agent/versand/:personId[/:art]) ─────────────
function Versandzentrum({ personId }: { personId: number }) {
  const fragen = useFragen();
  const { zeige } = useToast();
  const [daten, setDaten] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const laden = useCallback(async () => {
    const r = await api(`/agent/versand/${personId}`);
    setDaten(r.ok ? r.json : { fehler: r.json?.error || "Nicht ladbar." });
  }, [personId]);
  useEffect(() => { void laden(); }, [laden]);
  const senden = async (art: string, titel: string) => {
    if (!(await fragen({ titel: `„${titel}“ jetzt erneut an den Kunden schicken?`, ja: "Senden" }))) return;
    setBusy(art);
    const r = await api(`/agent/versand/${personId}/${art}`, { method: "POST", body: JSON.stringify({}) });
    setBusy(null);
    if (r.json?.knoepfe) setDaten((d: any) => ({ ...d, knoepfe: r.json.knoepfe, historie: r.json.historie }));
    const text = r.json?.meldung || r.json?.error || "Bitte erneut versuchen.";
    setMeldung(`${r.ok ? "Verschickt" : "Nicht verschickt"} – ${text}`);
    zeige(r.ok ? "erfolg" : "info", r.ok ? "Verschickt" : "Nicht verschickt", text);
  };
  if (!daten) return <p className="leise">Lade …</p>;
  if (daten.fehler) return <p className="leise">{daten.fehler}</p>;
  return (
    <>
      {meldung && <p className="leise" style={{ color: "#dbeafe" }}>{meldung}</p>}
      <div className="pi-versand">
        {(daten.knoepfe || []).map((x: any) => (
          <button key={x.art} type="button" className="pi-knopf still klein" onClick={() => void senden(x.art, x.titel)} disabled={!x.erlaubt || busy === x.art} title={x.erlaubt ? x.zweck : (x.grund || "")}>
            {busy === x.art ? "…" : x.titel}{x.heute > 0 && <em style={{ fontStyle: "normal", opacity: .6 }}>{x.heute}/3</em>}
          </button>
        ))}
      </div>
      {(daten.knoepfe || []).some((x: any) => !x.erlaubt) && (
        <ul className="pi-versand-grund">{(daten.knoepfe || []).filter((x: any) => !x.erlaubt).map((x: any) => <li key={x.art}>{x.titel}: {x.grund}</li>)}</ul>
      )}
      <div className="pi-block-kopf"><b>Versandhistorie</b></div>
      {(daten.historie || []).length === 0 ? <p className="leise">Für diesen Kunden ist noch keine Mail protokolliert.</p> : (
        <div className="pi-historie">
          {(daten.historie || []).slice(0, 12).map((h: any) => (
            <div key={h.id}>
              <b>{h.titel}</b>
              <span className={h.status === "versandt" ? "ok" : "nein"}>{h.status === "versandt" ? "versandt" : h.status === "uebersprungen" ? "übersprungen" : "fehlgeschlagen"}</span>
              <span>{new Date(h.am).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" })} · {h.ausgeloestVon}</span>
              {h.grund && <small>{h.grund}</small>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── Kunde bearbeiten (POST /agent/customers/:ref/stammdaten) ──────────────
// E-047 Nr. 4: VORHER fehlten E-Mail und Geburtsdatum im Formular („Kunde
// bearbeiten muss ALLE Felder haben“); der Server verarbeitet birthdate jetzt
// (updateCustomerContact). `fokus` springt direkt ins fehlende Feld.
function KundeBearbeiten({ k, melden, onFertig, fokus, onProdukt }: { k: Kunde; melden: (art: "gut" | "schlecht" | "info", titel: string, text?: string) => void; onFertig: () => Promise<void>; fokus?: string | null; onProdukt?: () => void }) {
  const [f, setF] = useState({
    firstName: (k.name || "").split(" ").slice(0, -1).join(" ") || k.name || "", lastName: (k.name || "").split(" ").slice(-1).join(""),
    email: k.email || "", phone: k.telefon || "",
    street: k.stammdaten?.strasse || "", zip: k.stammdaten?.plz || "", city: k.stammdaten?.ort || "",
    birthdate: k.stammdaten?.geburtsdatum ? String(k.stammdaten.geburtsdatum).slice(0, 10) : "",
  });
  const [busy, setBusy] = useState(false);
  const felderRef = useRef<Record<string, HTMLInputElement | null>>({});
  useEffect(() => {
    if (!fokus) return;
    const el = felderRef.current[fokus];
    if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.focus(); }
  }, [fokus]);
  const ref = k.zahlung?.ref || k.buchungen?.[0]?.ref || null;
  const speichern = async () => {
    // Justin 24.08.: VORHER endete der Weg hier mit einer roten Meldung —
    // NACHHER führt der Hinweis über dem Formular direkt zum Produkt-Anlegen;
    // diese Meldung ist nur noch der Rückfall, falls jemand doch hier landet.
    if (!ref) { melden("schlecht", "Keine Bestellung", "Leg oben mit einem Klick ein Produkt an – daran hängen die Stammdaten."); onProdukt?.(); return; }
    setBusy(true);
    const r = await api(`/agent/customers/${encodeURIComponent(ref)}/stammdaten`, { method: "POST", body: JSON.stringify(f) });
    setBusy(false);
    if (!r.ok) { melden("schlecht", "Nicht gespeichert", r.json?.error || "Bitte erneut versuchen."); return; }
    melden("gut", "Gespeichert", "Die Änderungen stehen mit altem und neuem Wert in der Akte.");
    await onFertig();
  };
  const feld = (key: keyof typeof f, label: string, breit = false, typ = "text") => (
    <label className={breit ? "breit" : ""}>{label}<input ref={(el) => { felderRef.current[key] = el; }} type={typ} className="pi-eingabe" value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} /></label>
  );
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div className="pi-form">
        {feld("firstName", "Vorname")}{feld("lastName", "Nachname")}
        {feld("email", "E-Mail", true, "email")}
        {feld("phone", "Telefon", true)}{feld("street", "Straße", true)}
        {feld("zip", "PLZ")}{feld("city", "Ort")}
        {feld("birthdate", "Geburtsdatum", true, "date")}
      </div>
      <div className="pi-reihe">
        <button type="button" className="pi-knopf klein" onClick={() => void speichern()} disabled={busy || !ref} title={ref ? undefined : "Erst ein Produkt anlegen – daran hängen die Stammdaten."}>{busy ? "Speichert …" : "Speichern"}</button>
        {!ref && onProdukt && <button type="button" className="pi-knopf klein still" onClick={onProdukt}>Produkt hinzufügen</button>}
        <span className="pi-luecke">Das Land ändert die Vertriebsleitung.</span>
      </div>
    </div>
  );
}
