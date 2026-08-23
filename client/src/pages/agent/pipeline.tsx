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
//   · Aktive Kunden (§16a): VORHER alle bezahlten/zugewiesenen Kunden der
//     Liste – NACHHER zählen NUR übernommene Mandate
//     (fiaon_persons.mandat_seit, gesetzt beim Buchen von „Mandat
//     angenommen“), x/500. Der Bestand-Reiter trennt „Mandate (dein Bestand)“
//     und „Zugewiesen, Mandat offen“.
// Regel (Justin): Die erste Zahlung ist immer eine Überweisung – nirgends
// Lastschrift. Liste: GET /agent/kunden/liste (+ filter=bezahlt für Aktive).
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { Phone, Search, X, Plus, Copy, Send, Mail, FileText, RefreshCw, Check, ExternalLink, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { AgentShell, api, useFragen } from "./shared";
import { useOffice } from "./OfficeShell";
import { ToastAnbieter, useToast, eur } from "@/lib/fiaon-ui";
import { statusAusTierGrund, type Stufe } from "@shared/fiaon-kundenstatus";
import { ERGEBNIS_TEXT } from "@shared/fiaon-kontakt-ergebnis-liste";
import { PAKETE } from "@shared/fiaon-pakete";
import { ARTEN, type Art as LeitfadenArt } from "./tools/gespraech";
import { ProduktDialog } from "@/components/agent/ProduktDialog";
import { KundeAnlegen } from "@/components/agent/KundeAnlegen";
import { SendeMenue } from "@/components/SendeMenue";
import { Gespraechsblatt } from "@/components/Gespraechsblatt";
import { RechnungBestaetigung } from "@/components/agent/RechnungBestaetigung";
import { ErgebnisWahl, type ErgebnisAusgang } from "@/components/agent/ErgebnisWahl";
import "@/styles/office-pipeline.css";


// ── Der Kunde, wie ihn /agent/kunden/liste und /agent/crm/kunden/:id liefern ──
interface Kunde {
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
const anrufen = (nummer: string | null | undefined, personId: number, name: string) => {
  if (!nummer) return;
  window.dispatchEvent(new CustomEvent("fiaon-anrufen", { detail: { nummer, personId, name } }));
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
const MAX_AKTIV = 500; // Justin 23.08.: Bestand bis 500 Kunden, erst dann muss abgegeben werden
// §16a: In die x/500-Zählung gehen NUR übernommene Mandate (mandat_seit) ein.
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
  if (s === "heiss") return "Der Kunde hat „bezahlt“ gemeldet. Termin vergeben, Zahlung bestätigen lassen – das ist der heißeste Anruf im Haus.";
  if (s === "warm") return k.hinweis || "Antrag fertig, Geld fehlt. Zahlungsdaten senden, Überweisung vereinbaren, Termin setzen.";
  if (s === "lead") return k.hinweis || "Registriert, noch kein Antrag. Daten aufnehmen, Paket am Telefon annehmen lassen.";
  return k.termin ? `${terminText(k.termin.beginn)} · ${k.termin.art}` : (k.hinweis || "Betreuter Kunde.");
}

// ── Kleine Haken ──────────────────────────────────────────────────────────
function useMedia(q: string): boolean {
  const [m, setM] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => { const mq = window.matchMedia(q); const h = () => setM(mq.matches); mq.addEventListener("change", h); return () => mq.removeEventListener("change", h); }, [q]);
  return m;
}
/** Zahl zählt in ~300 ms auf den Zielwert. */
function useZaehlen(ziel: number, ms = 300): number {
  const [wert, setWert] = useState(ziel);
  const stand = useRef(ziel);
  useEffect(() => {
    const von = stand.current; const start = performance.now();
    if (von === ziel) return;
    let id = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms); const e = 1 - Math.pow(1 - p, 3);
      const w = von + (ziel - von) * e; stand.current = w; setWert(w);
      if (p < 1) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [ziel, ms]);
  return wert;
}
const euro0 = (c: number) => (c / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export default function AgentPipelinePage() {
  return <AgentShell><ToastAnbieter><PipelineInnen /></ToastAnbieter></AgentShell>;
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

  // ── Reiter: Arbeitsliste (Start) · Mein Bestand (3D-Strom) ──────────────
  const [tab, setTab] = useState<"arbeit" | "bestand">("arbeit");
  // Arbeitsliste (E-043): genau 6 Slots vom Server.
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsZaehler, setSlotsZaehler] = useState<Record<string, number>>({});
  const [slotsLaedt, setSlotsLaedt] = useState(true);
  const [slotsFehler, setSlotsFehler] = useState<string | null>(null);
  const [fokusId, setFokusId] = useState<number | null>(null);
  const [geht, setGeht] = useState<Set<number>>(new Set());
  const [meldungA, setMeldungA] = useState<{ art: "gut" | "schlecht" | "info"; text: string } | null>(null);
  // Mein Bestand
  const [liste, setListe] = useState<Kunde[]>([]);
  const [zaehler, setZaehler] = useState<Zaehler>({});
  const [erledigt, setErledigt] = useState<Set<number>>(new Set());
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ansicht, setAnsicht] = useState("alle");
  const [sort, setSort] = useState("arbeit");
  const [suche, setSuche] = useState("");
  const [nurPerson, setNurPerson] = useState<number | null>(null);
  const [rolle, setRolle] = useState<string>("agent");
  const [satz, setSatz] = useState(0.25);
  const [stufe, setStufe] = useState<Hitze | "alle">("alle");
  const [land, setLand] = useState("");
  const [kontakt, setKontakt] = useState<"alle" | "heute" | "3" | "7" | "nie">("alle");
  const [nurRueckruf, setNurRueckruf] = useState(false);
  const [anlageOffen, setAnlageOffen] = useState(false);
  const [aktiv, setAktiv] = useState(0);
  const [ratenQuelle, setRatenQuelle] = useState<"ok" | "leer" | "keine">("keine");
  // §16a: Nur übernommene Mandate zählen als „Aktive Kunden“ (mandat_seit).
  const [mandate, setMandate] = useState<{ anzahl: number; ids: Set<number> }>({ anzahl: 0, ids: new Set() });
  const [mandatFilter, setMandatFilter] = useState<"alle" | "mandat" | "offen">("alle");
  const [offen, setOffen] = useState<number | null>(null);
  const [fremd, setFremd] = useState<Kunde | null>(null);
  const handy = useMedia("(max-width: 700px)");
  const ruhig = useMedia("(prefers-reduced-motion: reduce)");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const f = p.get("filter");
    if (f && ANSICHTEN.some((x) => x.key === f)) { setAnsicht(f); setTab("bestand"); }
    if (p.get("tab") === "bestand") setTab("bestand");
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
      setFehler(null);
      if (!nurZaehler) {
        const haupt: Kunde[] = r.json.kunden || [];
        const ids = new Set(haupt.map((k) => k.personId));
        const extra: Kunde[] = b?.ok ? (b.json.kunden || []).filter((k: Kunde) => !ids.has(k.personId)) : [];
        const zusammen = [...haupt, ...extra];
        if (ink?.ok && Array.isArray(ink.json?.personen)) {
          setRatenQuelle(ink.json.personen.length > 0 ? "ok" : "leer");
          ink.json.personen.forEach((pers: any, i: number) => {
            const d = pers.dringendste || pers.raten?.[0] || {};
            const felder = {
              istRate: true, rateCents: d.betrag_cents != null ? Number(d.betrag_cents) : null,
              rateNr: d.rate_nr != null ? Number(d.rate_nr) : null,
              rateFaelligAm: d.faellig_am ?? null,
              rateAnzahl: Number(pers.anzahl || pers.raten?.length || 1),
              rateSummeCents: Number(pers.summeCents || 0),
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
        } else if (mitAktiven) setRatenQuelle("keine");
        setListe(zusammen);
        setErledigt(new Set());
        setAktiv(0);
      }
      setZaehler({ ...(r.json.zaehler ?? {}), ...(r.json.zaehlerUeberschrieben ?? {}) });
      setRolle(r.json.rolle ?? "agent");
    } else setFehler(r.json?.error || "Die Pipeline konnte nicht geladen werden.");
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
  useEffect(() => { document.body.style.overflow = offen ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [offen]);

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
    // Karte gleitet hinaus, der nächste rückt nach (Server füllt die 6 Slots neu).
    setGeht((g) => new Set(g).add(k.personId));
    setFokusId(null);
    window.setTimeout(() => { void arbeitslisteLaden(true); void laden(true, true); }, 420);
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

  // ── Zahlen für die Umsatz-Leiste (aus dem Bestand) ──────────────────────
  const jeStufe = useMemo(() => {
    const z: Record<Hitze, number> = { heiss: 0, rate: 0, warm: 0, lead: 0, aktiv: 0 };
    for (const k of liste) z[stufeVon(k)]++;
    return z;
  }, [liste]);
  const erreichbar = useMemo(() => liste.filter((k) => !erledigt.has(k.personId)).reduce((s, k) => {
    const st = stufeVon(k);
    if (st === "heiss" || st === "warm") return s + paketPreis(k);
    if (st === "rate") return s + (k.rateCents ?? 0);
    return s;
  }, 0), [liste, erledigt]);
  // §16a: VORHER zählten hier alle bezahlten/zugewiesenen Kunden – NACHHER nur Mandate.
  const aktive = mandate.anzahl;
  // Motivationssatz: 5 Mandate/Tag × 21 Arbeitstage × (Ø-Rate × Satz + 10 € SCHUFA-Bonus).
  const mottoCents = useMemo(() => {
    const n = Object.values(MIX_MOTTO).reduce((a, b) => a + b, 0) || 1;
    const avg = Object.entries(MIX_MOTTO).reduce((sum, [key, c]) => sum + (PAKETE.find((x) => x.key === key)?.preisCents ?? 0) * c, 0) / n;
    return Math.round(5 * 21 * (avg * satz + SCHUFA_BONUS_CENTS));
  }, [satz]);
  const zErreichbar = useZaehlen(erreichbar), zAktive = useZaehlen(aktive);

  // ── Der Bestand-Strom: gefiltert, nach Hitze ────────────────────────────
  const laender = useMemo(() => Array.from(new Set(liste.map((k) => k.stammdaten?.land).filter(Boolean) as string[])).sort(), [liste]);
  const strom = useMemo(() => {
    const f = liste.filter((k) => {
      if (stufe !== "alle" && stufeVon(k) !== stufe) return false;
      if (land && k.stammdaten?.land !== land) return false;
      if (kontakt !== "alle") {
        const t = kontaktTage(k.letzterKontakt);
        if (kontakt === "nie" && t != null) return false;
        if (kontakt === "heute" && (t == null || t > 0)) return false;
        if (kontakt === "3" && (t == null || t < 3)) return false;
        if (kontakt === "7" && (t == null || t < 7)) return false;
      }
      if (nurRueckruf && !rueckrufFaellig(k)) return false;
      // §16a: Bestand nach Mandat trennen – übernommene Mandate vs. nur zugewiesen.
      if (mandatFilter === "mandat" && !mandate.ids.has(k.personId)) return false;
      if (mandatFilter === "offen" && mandate.ids.has(k.personId)) return false;
      return true;
    });
    if (sort !== "arbeit") return f;
    return [...f].sort((a, b) => (Number(erledigt.has(a.personId)) - Number(erledigt.has(b.personId))) || vergleich(a, b));
  }, [liste, stufe, land, kontakt, nurRueckruf, sort, erledigt, mandatFilter, mandate.ids]);
  useEffect(() => { if (aktiv > strom.length - 1) setAktiv(Math.max(0, strom.length - 1)); }, [strom.length, aktiv]);

  const geoeffnet = useMemo(() => liste.find((k) => k.personId === offen) || slots.find((s) => s.kunde.personId === offen)?.kunde || fremd || null, [liste, slots, offen, fremd]);

  // Tastatur nur im Bestand-Reiter: Pfeile blättern den Strom, Enter öffnet die Akte.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (offen || tab !== "bestand") return;
      const ziel = e.target as HTMLElement | null;
      if (ziel && /^(INPUT|TEXTAREA|SELECT)$/.test(ziel.tagName)) return;
      if (e.key === "ArrowRight") { setAktiv((a) => Math.min(strom.length - 1, a + 1)); e.preventDefault(); }
      if (e.key === "ArrowLeft") { setAktiv((a) => Math.max(0, a - 1)); e.preventDefault(); }
      if (e.key === "Enter" && strom[aktiv]) oeffnen(strom[aktiv].personId);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [offen, tab, strom, aktiv]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Arbeitsliste: Fokus = gewählter Slot, sonst der erste ───────────────
  const fokusSlot = useMemo(() => slots.find((s) => s.kunde.personId === fokusId) ?? slots[0] ?? null, [slots, fokusId]);
  const kleine = useMemo(() => slots.filter((s) => s.kunde.personId !== (fokusSlot?.kunde.personId ?? -1)), [slots, fokusSlot]);

  return (
    <div className="pi">
      {/* Umsatz-Leiste */}
      <section className="pi-umsatz">
        <div className="pi-umsatz-zahl">
          <small>Heute erreichbar</small>
          <b>{laedt ? "–" : euro0(zErreichbar)}</b>
          <span>erste Raten der heißen und warmen Kunden – per Überweisung</span>
        </div>
        {/* VORHER: Kachel „Meine Provision möglich“ – bei 6 sichtbaren Kunden klein und
            demotivierend. NACHHER: Motivationssatz mit echter Zahl (Justin 23.08.). */}
        <div className="pi-umsatz-zahl hervor pi-motto">
          <small>Dein Hebel</small>
          <MottoSatz cents={mottoCents} />
          <Link href="/agent/gehalt" className="pi-motto-link">Rechne selbst → Earnings</Link>
        </div>
        <div className="pi-umsatz-zahl">
          <small>Aktive Kunden · Mandate</small>
          <b>{laedt ? "–" : Math.round(zAktive)}<em> / {MAX_AKTIV}</em></b>
          <span>{aktive >= MAX_AKTIV ? "Bestand voll – Kunden an Kollegen übergeben" : "nur übernommene Mandate zählen – Zuweisung allein nicht"}</span>
          <i className="pi-umsatz-balken"><i style={{ width: `${Math.min(100, (aktive / MAX_AKTIV) * 100)}%` }} /></i>
        </div>
      </section>

      {/* Reiter */}
      <div className="pi-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "arbeit"} className={`pi-tab${tab === "arbeit" ? " an" : ""}`} onClick={() => setTab("arbeit")}>
          Arbeitsliste<em>{slots.length}</em>
        </button>
        <button type="button" role="tab" aria-selected={tab === "bestand"} className={`pi-tab${tab === "bestand" ? " an" : ""}`} onClick={() => setTab("bestand")}>
          Mein Bestand<em>{liste.length}</em>
        </button>
      </div>

      {tab === "arbeit" && (
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
            <section className="pi-arbeit">
              <div className="pi-arbeit-haupt">
                {fokusSlot && (
                  <ArbeitsFokus key={fokusSlot.kunde.personId} k={fokusSlot.kunde} gruppe={fokusSlot.gruppe} satz={satz}
                                geht={geht.has(fokusSlot.kunde.personId)}
                                onAkte={() => oeffnen(fokusSlot.kunde.personId)}
                                onErgebnis={(art, notiz, zusatz) => ergebnisSchnell(fokusSlot.kunde, art, notiz, zusatz)}
                                onEntfernen={() => void karteileiche(fokusSlot.kunde)}
                                melden={(art, text) => setMeldungA({ art, text })} />
                )}
                <div className="pi-arbeit-klein">
                  {kleine.map((s) => (
                    <KleineKarte key={s.kunde.personId} k={s.kunde} gruppe={s.gruppe} geht={geht.has(s.kunde.personId)}
                                 onFokus={() => setFokusId(s.kunde.personId)}
                                 onAkte={() => oeffnen(s.kunde.personId)}
                                 onEntfernen={() => void karteileiche(s.kunde)} />
                  ))}
                </div>
                <p className="pi-fussnote">
                  Höchstens 6 auf einmal – je 2 „{GRUPPE_INFO.bezahlt_gemeldet.name}“ ({slotsZaehler.bezahlt_gemeldet ?? 0}),
                  „{GRUPPE_INFO.rechnung_offen.name}“ ({slotsZaehler.rechnung_offen ?? 0}),
                  „{GRUPPE_INFO.lead.name}“ ({slotsZaehler.lead ?? 0}). Erledigt = der nächste rückt sofort nach.
                </p>
              </div>
              <Leitfaden stufe={fokusSlot ? (GRUPPE_INFO[fokusSlot.gruppe]?.stufe ?? "heiss") : "heiss"} />
            </section>
          )}
        </>
      )}

      {tab === "bestand" && (
        <>
          {fehler && <p className="pi-fehler">{fehler}</p>}
          {/* §16a: zwei Gruppen im Bestand – Mandate und „Zugewiesen, Mandat offen“ */}
          <div className="pi-tabs" role="group" aria-label="Mandate">
            <button type="button" className={`pi-tab${mandatFilter === "alle" ? " an" : ""}`} onClick={() => setMandatFilter("alle")}>Alle<em>{liste.length}</em></button>
            <button type="button" className={`pi-tab${mandatFilter === "mandat" ? " an" : ""}`} onClick={() => setMandatFilter("mandat")}>Mandate · dein Bestand<em>{liste.filter((x) => mandate.ids.has(x.personId)).length}</em></button>
            <button type="button" className={`pi-tab${mandatFilter === "offen" ? " an" : ""}`} onClick={() => setMandatFilter("offen")}>Zugewiesen, Mandat offen<em>{liste.filter((x) => !mandate.ids.has(x.personId)).length}</em></button>
          </div>
          <section className="pi-stufen">
            <button type="button" className={`pi-stufe-chip${stufe === "alle" ? " an" : ""}`} onClick={() => setStufe("alle")}><b>{liste.length}</b><span>Alle</span></button>
            {STUFEN_REIHE.map((s) => (
              <button key={s} type="button" className={`pi-stufe-chip${stufe === s ? " an" : ""}`} style={{ ["--hitze" as string]: STUFE[s].farbe }} onClick={() => setStufe(stufe === s ? "alle" : s)}>
                <i className="pi-glut" />
                <b>{jeStufe[s]}</b><span>{STUFE[s].name}</span>
              </button>
            ))}
          </section>

          <section className="pi-leiste">
            <label className="pi-suche">
              <Search size={15} strokeWidth={1.75} />
              <input value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="Name, E-Mail, Nummer, Referenz" />
              {suche && <button type="button" className="pi-link" onClick={() => setSuche("")} aria-label="Suche leeren"><X size={14} /></button>}
            </label>
            <label className={`pi-feld${land ? " an" : ""}`}>Land
              <select value={land} onChange={(e) => setLand(e.target.value)}><option value="">alle</option>{laender.map((l) => <option key={l} value={l}>{LAND_NAME[l] || l}</option>)}</select>
            </label>
            <label className={`pi-feld${kontakt !== "alle" ? " an" : ""}`}>Kontakt
              <select value={kontakt} onChange={(e) => setKontakt(e.target.value as typeof kontakt)}>
                <option value="alle">egal</option><option value="heute">heute</option><option value="3">3+ Tage her</option><option value="7">7+ Tage her</option><option value="nie">noch nie</option>
              </select>
            </label>
            <label className={`pi-feld pi-schalter${nurRueckruf ? " an" : ""}`}><input type="checkbox" checked={nurRueckruf} onChange={(e) => setNurRueckruf(e.target.checked)} /> Rückruf fällig</label>
            <label className={`pi-feld${ansicht !== "alle" ? " an" : ""}`}>Ansicht
              <select value={ansicht} onChange={(e) => { setAnsicht(e.target.value); setStufe("alle"); }}>
                {ANSICHTEN.map((f) => <option key={f.key} value={f.key}>{f.label}{zaehler[f.key] != null ? ` (${zaehler[f.key]})` : ""}</option>)}
              </select>
            </label>
            <label className="pi-feld">Sortierung
              <select value={sort} onChange={(e) => setSort(e.target.value)}>{SORT.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
            </label>
            <span className="pi-leiste-rechts">
              <button type="button" className="pi-knopf still klein" onClick={() => void laden()} title="Neu laden"><RefreshCw size={14} strokeWidth={1.75} />{erledigt.size > 0 ? ` ${erledigt.size} neu ordnen` : ""}</button>
              <button type="button" className="pi-knopf klein" onClick={() => setAnlageOffen((v) => !v)}><Plus size={14} strokeWidth={1.75} /> Kunde anlegen</button>
            </span>
          </section>
          {anlageOffen && <div className="pi-hell"><KundeAnlegen offen={anlageOffen} aufKlappen={setAnlageOffen} fertig={() => { void laden(true); void arbeitslisteLaden(true); }} /></div>}
          {(zaehler.wartet ?? 0) > 0 && ansicht !== "nicht_erreicht" && (
            <button type="button" className="pi-hinweis" onClick={() => setAnsicht("nicht_erreicht")}>
              <span className="zahl">{zaehler.wartet}</span>
              <span><b>{zaehler.wartet === 1 ? "Einer wartet auf seinen Termin" : `${zaehler.wartet} warten auf ihren Termin`}</b><small>Nicht erreicht – sie haben den Buchungslink und wählen selbst. Nicht erneut anrufen.</small></span>
            </button>
          )}
          {stufe === "rate" && ratenQuelle !== "ok" && (
            <div className="pi-hinweis blau" style={{ cursor: "default" }}>
              <span><b>{ratenQuelle === "leer" ? "Keine Rate überfällig – stark." : "Rate überfällig – kommt mit dem Zahlungsmotor."}</b>
                <small>{ratenQuelle === "leer" ? "Sobald eine Rate deiner Kunden überfällig ist, steht sie hier – mit 50 % Bonus je zurückgeholter Rate." : "Die überfälligen Raten liegen heute noch bei Collections. Hier wird nichts geraten."}</small></span>
            </div>
          )}

          <Strom liste={strom} aktiv={aktiv} setAktiv={setAktiv} erledigt={erledigt} onAkte={(id) => oeffnen(id)} flach={handy || ruhig} ruhig={ruhig} laedt={laedt} />
          {!laedt && liste.length > 0 && (
            <p className="pi-fussnote">Dein Bestand: bis zu {MAX_AKTIV} übernommene Mandate ({mandate.anzahl} aktuell) plus alles Zugewiesene ohne Mandat. Gearbeitet wird in der Arbeitsliste – hier suchst und findest du.</p>
          )}
        </>
      )}

      {offen && (
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
              <div className="pi-lade-kopf"><span /><h2>{laedt ? "Lade …" : "Akte nicht gefunden"}</h2>
                <button type="button" className="pi-lade-zu" onClick={() => oeffnen(null)} aria-label="Schließen"><X size={18} /></button></div>
              {!laedt && <div className="pi-lade-koerper"><p className="pi-fussnote">Dieser Kunde gehört nicht zu deinem Bestand oder die Kennung stimmt nicht.</p></div>}
            </aside>
          )}
        </>
      )}
    </div>
  );
}

/** Der Motivationssatz der Umsatz-Leiste — 2–3 Varianten je Tageszeit, immer mit echter Zahl. */
function MottoSatz({ cents }: { cents: number }) {
  const zahl = euro0(useZaehlen(cents));
  const stunde = new Date().getHours();
  if (stunde < 12) return <p className="pi-motto-satz">5 neue Mandate am Tag sind <b>{zahl}</b> am Monatsende.</p>;
  if (stunde < 17) return <p className="pi-motto-satz">Jedes Mandat zahlt 12 Raten – 5 am Tag sind <b>{zahl}</b> im ersten Monat.</p>;
  return <p className="pi-motto-satz">Dein Bestand zahlt dich jeden Monat – 5 Mandate am Tag sind <b>{zahl}</b>.</p>;
}

// ═══════════════════════════════════════════════════════════════════════════
// E-043: Die Fokus-Karte der Arbeitsliste — Herz des Umsatz-Raums.
// Während des Gesprächs: Anrufen, Akte, Zugänge senden, Zahlungsdaten senden,
// Termin einbuchen. Am Ende EIN Ergebnis — Wording: Erfolgreich/Negativ →
// „Mandat angenommen“ / „Mandat nicht zustande gekommen“ (Justin 23.08.,
// E-044): Mandat angenommen nur mit gebuchtem Termin; nicht zustande gekommen
// mit Grund (Nicht erreicht / Nummer falsch / Kein Interesse / Überlegt noch
// → Rückruf über das bestehende rueckruf_termin-Ergebnis). Beim Mandat setzt
// POST /agent/vertrieb/mandat/:id die Mandatsmarke (§16a). Bestandsendpunkte.
// ═══════════════════════════════════════════════════════════════════════════
function ArbeitsFokus({ k, gruppe, satz, geht, onAkte, onErgebnis, onEntfernen, melden }: {
  k: Kunde; gruppe: string; satz: number; geht: boolean;
  onAkte: () => void;
  onErgebnis: (art: string, notiz?: string, zusatz?: Record<string, unknown>) => Promise<boolean>;
  onEntfernen: () => void;
  melden: (art: "gut" | "schlecht" | "info", text: string) => void;
}) {
  const fragen = useFragen();
  const info = GRUPPE_INFO[gruppe] ?? GRUPPE_INFO.lead;
  const st = STUFE[info.stufe];
  const preis = paketPreis(k); const wert = preis * 12;
  const zWert = useZaehlen(wert), zProv = useZaehlen(Math.round(wert * satz));
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [negativOffen, setNegativOffen] = useState(false);
  const [terminOffen, setTerminOffen] = useState(false);
  const [datum, setDatum] = useState(tagPlus(1));
  const [zeit, setZeit] = useState("10:00");
  const [gebucht, setGebucht] = useState<string | null>(null);
  const [bestaetigen, setBestaetigen] = useState(false);
  const [sendeFehler, setSendeFehler] = useState<string | null>(null);
  const faellig = rueckrufFaellig(k);
  // „Erfolgreich vereinbart“ zählt nur mit echtem Termin: eben gebucht oder
  // schon gebucht und in der Zukunft.
  const hatTermin = !!gebucht
    || (!!k.termin && !k.termin.erledigt && new Date(k.termin.beginn).getTime() > Date.now())
    || (!!k.terminAm && new Date(k.terminAm).getTime() > Date.now());

  const terminBuchen = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || !/^\d{2}:\d{2}$/.test(zeit)) { melden("schlecht", "Bitte Datum und Uhrzeit angeben."); return; }
    setLaeuft("termin");
    const r = await api("/agent/termine", { method: "POST", body: JSON.stringify({ personId: k.personId, beginn: `${datum}T${zeit}:00` }) });
    setLaeuft(null);
    if (!r.ok) { melden("schlecht", r.json?.error || "Der Termin konnte nicht gebucht werden."); return; }
    const text = `${r.json.termin?.datumText ?? datum}, ${r.json.termin?.uhrzeit ?? zeit} Uhr`;
    setGebucht(text); setTerminOffen(false);
    melden("gut", `Termin gebucht: ${text}. Der Slot ist blockiert, die Bestätigung geht an den Kunden.`);
  };
  const zugaengeSenden = async () => {
    if (!(await fragen({ titel: `Zugänge („Willkommen und Zugang“) an ${k.name} senden?`, ja: "Senden" }))) return;
    setLaeuft("zugang");
    const r = await api(`/agent/versand/${k.personId}/welcome`, { method: "POST", body: JSON.stringify({}) });
    setLaeuft(null);
    melden(r.ok ? "gut" : "schlecht", r.json?.meldung || r.json?.error || (r.ok ? "Verschickt." : "Nicht verschickt."));
  };
  const zahlungsdaten = async (ref: string | null) => {
    setLaeuft("rechnung");
    const r = await api(`/agent/crm/kunden/${k.personId}/rechnung`, { method: "POST", body: JSON.stringify({ ref }) });
    setLaeuft(null);
    if (!r.ok) { setSendeFehler(r.json?.error || "Der Server hat den Versand abgelehnt."); return; }
    setSendeFehler(null); setBestaetigen(false);
    melden("gut", r.json.warnung || `Zahlungsdaten und Rechnung an ${r.json.versandtAn} gesendet.`);
  };
  // E-044: „Mandat angenommen“ – der Kunde nimmt die Betreuung an. Setzt die
  // Mandatsmarke (§16a, zählt in x/500) und bucht das bestehende Ergebnis.
  const mandatAngenommen = async () => {
    if (!hatTermin) {
      setTerminOffen(true);
      melden("info", "Ein Mandat gilt als angenommen, wenn der Termin steht. Buchen Sie ihn hier ein – dann zählt es.");
      return;
    }
    setLaeuft("vereinbart");
    await api(`/agent/vertrieb/mandat/${k.personId}`, { method: "POST", body: JSON.stringify({}) }).catch(() => null);
    const ok = await onErgebnis("erreicht_sonstiges",
      `Mandat angenommen – Termin ${gebucht ?? (k.termin ? terminText(k.termin.beginn) : terminText(k.terminAm!))} gebucht. Kunde erinnert: Rechnung vor dem Termin begleichen, dann wird im Gespräch direkt aktiviert.`);
    if (ok) melden("gut", `Mandat angenommen – ${k.name} zählt jetzt zu deinem Bestand.`);
    setLaeuft(null);
  };
  // E-044: „Mandat nicht zustande gekommen“ – mit Grund. Technisch dieselben
  // Ergebnisse wie bisher; „Überlegt noch“ nutzt das Rückruf-Ergebnis.
  const [rueckrufOffen, setRueckrufOffen] = useState(false);
  const [rueckrufDatum, setRueckrufDatum] = useState(tagPlus(1));
  const [rueckrufZeit, setRueckrufZeit] = useState("10:00");
  const nichtZustande = async (grund: "nicht_erreicht" | "nummer_falsch" | "kein_interesse" | "ueberlegt") => {
    if (grund === "ueberlegt") { setRueckrufOffen(true); setNegativOffen(false); return; }
    setLaeuft(grund);
    if (grund === "kein_interesse") {
      if (!(await fragen({
        titel: `Mandat nicht zustande gekommen – ${k.name} hat kein Interesse?`,
        text: "Der Kunde wird gesperrt: Er erscheint bei keinem Mitarbeiter mehr und die Verteilung fasst ihn nicht mehr an. Zahlungs- und Vertragsdaten bleiben erhalten.",
        folge: "Der Vorgang steht mit Grund im Kontaktprotokoll.",
        ja: "Sperren", gefaehrlich: true,
      }))) { setLaeuft(null); return; }
      await onErgebnis("erreicht_abgelehnt", "Mandat nicht zustande gekommen – kein Interesse, vom Kunden im Gespräch erklärt.");
    } else if (grund === "nummer_falsch") {
      await onErgebnis("nummer_falsch", "Mandat nicht zustande gekommen – hinterlegte Rufnummer stimmt nicht.");
    } else {
      await onErgebnis("nicht_erreicht");
    }
    setLaeuft(null); setNegativOffen(false);
  };
  const rueckrufBuchen = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rueckrufDatum) || !/^\d{2}:\d{2}$/.test(rueckrufZeit)) { melden("schlecht", "Bitte Datum und Uhrzeit für den Rückruf angeben."); return; }
    setLaeuft("ueberlegt");
    await onErgebnis("rueckruf_termin", "Mandat noch offen – Kunde überlegt, Rückruf vereinbart.", { terminDatum: rueckrufDatum, terminZeit: rueckrufZeit });
    setLaeuft(null); setRueckrufOffen(false);
  };

  return (
    <div className={`pi-fokus-karte${geht ? " geht" : " tief"}`} style={{ ["--hitze" as string]: faellig ? "#f87171" : st.farbe }}>
      <div className="pi-fokus-kopf">
        <span className="pi-pille">{faellig ? "Rückruf fällig" : "Jetzt anrufen"}</span>
        <button type="button" className="pi-link" style={{ color: "#64748b" }} onClick={onEntfernen} title="Karteileiche? Sperren statt löschen – mit Rückfrage.">Entfernen</button>
      </div>
      <h1>{k.name}</h1>
      <div className="pi-fokus-stufe"><i className="pi-glut" /><b>{info.name}</b><span>· {(k.buchungen ?? []).find((b) => !b.erledigt && b.art === "paket")?.bezeichnung || k.produkt || "noch kein Paket"}{preis ? ` · ${eur(preis)} im Monat` : ""}</span></div>
      <p className="pi-fokus-warum">{warumJetzt(k)}</p>
      <div className="pi-fokus-wert">
        <div><small>Erwarteter Wert</small><b>{preis ? euro0(zWert) : "–"}</b><span>12 Raten · erste per Überweisung</span></div>
        <div className="hervor"><small>Meine Provision</small><b>{preis ? euro0(zProv) : "–"}</b><span>{Math.round(satz * 100)} % je bankbestätigter Rate</span></div>
        <div><small>Letzter Kontakt</small><b className="klein">{wartezeit(k.letzterKontakt).replace(" kontaktiert", "")}</b><span>{k.nichtErreicht > 0 ? `${k.nichtErreicht}× nicht erreicht` : k.stammdaten?.land ? (LAND_NAME[k.stammdaten.land] || k.stammdaten.land) : "—"}</span></div>
      </div>

      {/* Während des Gesprächs: alles Nötige, ein Klick */}
      <div className="pi-fokus-knoepfe">
        {k.telefonWaehlbar ? (
          <button type="button" className="pi-knopf riesig" onClick={() => anrufen(k.telefonWaehlbar, k.personId, k.name)}><Phone size={20} strokeWidth={1.75} /> Anrufen</button>
        ) : (
          <button type="button" className="pi-knopf riesig warn" onClick={onAkte} title={k.telefon ? "Ländervorwahl fehlt – in der Akte ergänzen" : "keine Nummer – in der Akte nachtragen"}><Phone size={20} strokeWidth={1.75} /> {k.telefon ? "Vorwahl ergänzen" : "Nummer fehlt"}</button>
        )}
        <button type="button" className="pi-knopf still gross" onClick={onAkte}><FileText size={16} strokeWidth={1.75} /> Akte</button>
        <button type="button" className="pi-knopf still gross" disabled={laeuft === "zugang"} onClick={() => void zugaengeSenden()}><Mail size={15} strokeWidth={1.75} /> {laeuft === "zugang" ? "Sende …" : "Zugänge senden"}</button>
        <button type="button" className="pi-knopf still gross" disabled={laeuft === "rechnung"} onClick={() => setBestaetigen(true)}><Send size={15} strokeWidth={1.75} /> Zahlungsdaten senden</button>
        <button type="button" className={`pi-knopf gross ${hatTermin ? "gut" : "still"}`} onClick={() => setTerminOffen((v) => !v)}>
          {hatTermin ? <><Check size={15} strokeWidth={2} /> Termin steht</> : "Termin einbuchen"}
        </button>
      </div>

      {terminOffen && (
        <div className="pi-termin">
          <div className="pi-reihe">
            <input type="date" className="pi-eingabe" style={{ flex: "0 0 160px" }} value={datum} min={heuteIso()} onChange={(e) => setDatum(e.target.value)} aria-label="Datum" />
            <input type="time" className="pi-eingabe" style={{ flex: "0 0 110px" }} value={zeit} step={900} onChange={(e) => setZeit(e.target.value)} aria-label="Uhrzeit" />
            <button type="button" className="pi-knopf" disabled={laeuft === "termin"} onClick={() => void terminBuchen()}>{laeuft === "termin" ? "Bucht …" : "Termin buchen"}</button>
            <button type="button" className="pi-link" onClick={() => setTerminOffen(false)}>Schließen</button>
          </div>
          <p className="pi-fussnote">Der Slot kommt aus deiner Availability und wird echt blockiert – liegt er außerhalb oder ist er belegt, lehnt der Server ab.</p>
        </div>
      )}
      {hatTermin && (
        <p className="pi-fokus-erinnerung">Erinnere den Kunden: Rechnung vor dem Termin begleichen → im Gespräch wird direkt aktiviert.{gebucht ? ` (Termin: ${gebucht})` : ""} Danach: „Mandat angenommen“ buchen.</p>
      )}

      {/* Am Ende: EIN Ergebnis – Mandats-Wording (E-044), seriöser Kanzlei-Ton */}
      <div className="pi-ergebnisweg">
        <button type="button" className="pi-knopf gross" disabled={!!laeuft}
                style={hatTermin ? undefined : { opacity: .75 }}
                title={hatTermin ? "Der Termin steht – Mandat buchen" : "Ein Mandat gilt mit gebuchtem Termin als angenommen – der Knopf führt zur Terminbuchung"}
                onClick={() => void mandatAngenommen()}>
          <Check size={16} strokeWidth={2} /> {laeuft === "vereinbart" ? "Speichert …" : "Mandat angenommen"}
        </button>
        {!negativOffen && !rueckrufOffen ? (
          <button type="button" className="pi-knopf warn gross" disabled={!!laeuft} onClick={() => setNegativOffen(true)}>Mandat nicht zustande gekommen …</button>
        ) : negativOffen ? (
          <span className="pi-reihe">
            <button type="button" className="pi-knopf still" disabled={!!laeuft} onClick={() => void nichtZustande("nicht_erreicht")}>{laeuft === "nicht_erreicht" ? "…" : "Nicht erreicht"}</button>
            <button type="button" className="pi-knopf still" disabled={!!laeuft} onClick={() => void nichtZustande("nummer_falsch")}>{laeuft === "nummer_falsch" ? "…" : "Nummer falsch"}</button>
            <button type="button" className="pi-knopf still" disabled={!!laeuft} onClick={() => void nichtZustande("ueberlegt")}>Überlegt noch – Rückruf</button>
            <button type="button" className="pi-knopf warn" disabled={!!laeuft} onClick={() => void nichtZustande("kein_interesse")}>{laeuft === "kein_interesse" ? "…" : "Kein Interesse"}</button>
            <button type="button" className="pi-link" onClick={() => setNegativOffen(false)}>zurück</button>
          </span>
        ) : (
          <span className="pi-reihe">
            <input type="date" className="pi-eingabe" style={{ flex: "0 0 150px" }} value={rueckrufDatum} min={heuteIso()} onChange={(e) => setRueckrufDatum(e.target.value)} aria-label="Rückruf-Datum" />
            <input type="time" className="pi-eingabe" style={{ flex: "0 0 104px" }} value={rueckrufZeit} step={900} onChange={(e) => setRueckrufZeit(e.target.value)} aria-label="Rückruf-Uhrzeit" />
            <button type="button" className="pi-knopf" disabled={!!laeuft} onClick={() => void rueckrufBuchen()}>{laeuft === "ueberlegt" ? "…" : "Rückruf vereinbaren"}</button>
            <button type="button" className="pi-link" onClick={() => setRueckrufOffen(false)}>zurück</button>
          </span>
        )}
      </div>

      {bestaetigen && (
        <RechnungBestaetigung personId={k.personId} kundeName={k.name} laeuft={laeuft === "rechnung"}
                              onAbbrechen={() => { setBestaetigen(false); setSendeFehler(null); }}
                              onSenden={(ref) => void zahlungsdaten(ref)} sendeFehler={sendeFehler} />
      )}
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

// ── Der Leitfaden der Stufe (tools/gespraech.tsx) als aufklappbare Glas-Karte ──
function Leitfaden({ stufe }: { stufe: Hitze }) {
  const [auf, setAuf] = useState(false);
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
function Strom({ liste, aktiv, setAktiv, erledigt, onAkte, flach, ruhig, laedt }: {
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
        <span className="pi-sk-fuss">{s === "rate" ? `${k.rateCents ? eur(k.rateCents) : "Rate"} überfällig${k.rateFaelligAm ? ` seit ${dtag(k.rateFaelligAm)}` : ""} · Bonus ${k.rateCents ? eur(Math.round(k.rateCents * REAKTIVIERUNG_ANTEIL)) : "50 %"}` : k.termin ? `${terminText(k.termin.beginn)} · ${k.termin.art}` : k.rueckrufAm ? `Rückruf ${terminText(k.rueckrufAm)}` : relativ(k.zusagedatum) ? `Zusage ${relativ(k.zusagedatum)!.text}` : wartezeit(k.letzterKontakt)}</span>
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
// DIE AKTE — alle Aktionen der alten Kundenkarte, in der Glas-Lade
// ═══════════════════════════════════════════════════════════════════════════
function Akte({ k, onZu, onWeg, onNeu, onErledigt, onZaehler }: {
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
  const [bearbeiten, setBearbeiten] = useState(false);
  const [mailNachtrag, setMailNachtrag] = useState("");
  const [produktOffen, setProduktOffen] = useState(false);
  const [datumWert] = useState(tagPlus(1));
  const [notiz, setNotiz] = useState("");
  const [verlauf, setVerlauf] = useState<any[] | null>(null);
  // ── E-044/§16: Reiter „Aktivität“ + Vollständigkeit (Kartenstatus) ──
  const [reiter, setReiter] = useState<"akte" | "aktivitaet">("akte");
  const [akt, setAkt] = useState<{ ereignisse: any[]; vollstaendig: { vollstaendig: boolean; paketBezahlt: boolean; schufaBezahlt: boolean; kontoauszug: boolean; ausweis: boolean } } | null>(null);
  const [aktFehler, setAktFehler] = useState<string | null>(null);
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
  const notizFeld = useRef<HTMLInputElement | null>(null);

  const zusage = relativ(k.zusagedatum);
  const rueckruf = k.rueckrufAm ? new Date(k.rueckrufAm) : null;
  const rueckrufJetzt = rueckruf ? rueckruf.getTime() <= Date.now() : false;
  const termin = k.terminAm ? new Date(k.terminAm) : null;
  const status = statusAusTierGrund(k.tierGrund);

  useEffect(() => {
    // Escape schließt die Lade – aber nicht, solange ein Dialog darüber liegt.
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
      if (r.ok) { setAkt({ ereignisse: r.json.ereignisse || [], vollstaendig: r.json.vollstaendig }); setAktFehler(null); }
      else setAktFehler(r.json?.error || "Die Aktivität konnte nicht geladen werden.");
    });
    return () => { an = false; };
  }, [k.personId]);
  // §16: Der Kartenstatus ist überall der Platzhalter, bis der Kunde vollständig ist.
  const vollstaendig = akt?.vollstaendig?.vollstaendig ?? k.vollstaendig ?? false;
  const kartenText = vollstaendig ? "Vollständig – liegt bei FIAON zur Bearbeitung" : "In Bearbeitung";

  // ── Ergebnis / Notiz (POST /agent/crm/kunden/:id/aktivitaet) ───────────
  const ergebnis = async (art: string, zusatz: Record<string, unknown> = {}): Promise<ErgebnisAusgang> => {
    setLaeuft(art);
    const eigeneNotiz = typeof zusatz.notiz === "string" ? zusatz.notiz.trim() : "";
    const r = await api(`/agent/crm/kunden/${k.personId}/aktivitaet`, {
      method: "POST", body: JSON.stringify({ art, ...zusatz, notiz: eigeneNotiz || notiz.trim() || undefined }),
    });
    setLaeuft(null);
    if (!r.ok) {
      const grund = r.json?.error || "Nicht gespeichert. Bitte erneut versuchen.";
      melden("schlecht", "Nicht gespeichert", grund);
      return { ok: false, fehler: grund };
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
    return { ok: true };
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

  return (
    <aside className="pi-lade" role="dialog" aria-modal="true" aria-label={`Akte ${k.name}`}>
      <div className="pi-lade-kopf">
        <span className="pi-lade-glut" style={{ ["--hitze" as string]: STUFE[stufeVon(k)].farbe }} aria-hidden="true"><i className="pi-glut" /></span>
        <div>
          <h2>{k.name}</h2>
          <div className="status">
            <i style={{ color: k.tier === 1 ? "#fca5a5" : k.tier === 2 ? "#fcd34d" : k.tier === 0 ? "#6ee7b7" : "#cbd5e1" }}>{status.anzeige}</i>
            <span>{STUFE[stufeVon(k)].name}</span>
            {termin && <span className="pi-marke">Termin {terminText(k.terminAm!)}</span>}
            {k.termin && !termin && <span className="pi-marke">{terminText(k.termin.beginn)} · {k.termin.art}</span>}
            {zusage && <span className={`pi-marke${zusage.dringend ? " dringend" : ""}`}>Zusage {zusage.text}</span>}
            {rueckruf && <span className={`pi-marke${rueckrufJetzt ? " dringend" : " warn"}`}>Rückruf {rueckruf.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })} {rueckruf.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</span>}
          </div>
        </div>
        <button type="button" className="pi-lade-zu" onClick={onZu} aria-label="Akte schließen"><X size={18} strokeWidth={1.75} /></button>
      </div>

      <div className="pi-lade-koerper">
        {meldung && <p className={`pi-meldung ${meldung.art === "gut" ? "gut" : meldung.art === "schlecht" ? "schlecht" : ""}`}>{meldung.text}</p>}

        {/* E-044: Reiter Akte · Aktivität */}
        <div className="pi-lade-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={reiter === "akte"} className={`pi-tab${reiter === "akte" ? " an" : ""}`} onClick={() => setReiter("akte")}>Akte</button>
          <button type="button" role="tab" aria-selected={reiter === "aktivitaet"} className={`pi-tab${reiter === "aktivitaet" ? " an" : ""}`} onClick={() => setReiter("aktivitaet")}>Aktivität{akt ? <em>{akt.ereignisse.length}</em> : null}</button>
          <span className={`pi-marke${vollstaendig ? " gut" : " still"}`} style={{ marginLeft: "auto" }} title={akt ? `Paket ${akt.vollstaendig.paketBezahlt ? "✓" : "–"} · SCHUFA ${akt.vollstaendig.schufaBezahlt ? "✓" : "–"} · Kontoauszug ${akt.vollstaendig.kontoauszug ? "✓" : "–"} · Ausweis ${akt.vollstaendig.ausweis ? "✓" : "–"}` : undefined}>
            Karte: {kartenText}
          </span>
        </div>

        {reiter === "aktivitaet" && <AktivitaetsZeit akt={akt} fehler={aktFehler} />}
        {reiter === "akte" && <>
        {/* Nächster Schritt + Aktionen */}
        <div className="pi-block hervor">
          <div className="pi-block-kopf"><b>Nächster Schritt</b><small style={{ color: "#9ca3af", fontSize: 12 }}>{wartezeit(k.letzterKontakt)}</small></div>
          <p>{k.hinweis}</p>
          <div className="pi-reihe oben">
            {k.telefonWaehlbar ? (
              <button type="button" className="pi-knopf gross" onClick={() => anrufen(k.telefonWaehlbar, k.personId, k.name)}><Phone size={16} strokeWidth={1.75} /> Anrufen</button>
            ) : k.telefon ? (
              <NummerLandNachtragen k={k} onFertig={onNeu} />
            ) : (
              <span className="pi-sperre">keine Nummer</span>
            )}

            {!sperre ? (
              <span className="pi-stapel">
                <button type="button" className="pi-knopf gut gross" onClick={() => setBestaetigen(true)} disabled={!!laeuft} title={`Zahlungsdaten und Rechnung an ${k.email}`}>
                  <Send size={15} strokeWidth={1.75} /> {laeuft === "rechnung" ? "Sende …" : "Zahlungsdaten senden"}
                </button>
                <VertragsLuecke k={k} melden={melden} />
              </span>
            ) : (
              <span className="pi-stapel">
                <span className="pi-sperre"><Send size={14} strokeWidth={1.75} /> Zahlungsdaten: gesperrt</span>
                <span className="pi-luecke" style={{ color: "#fde68a" }}>{sperre.grund}</span>
                <VertragsLuecke k={k} melden={melden} />
                {sperre.ziel === "stammdaten" && (
                  <span className="pi-reihe">
                    <input className="pi-eingabe" value={mailNachtrag} onChange={(e) => setMailNachtrag(e.target.value)} placeholder="E-Mail nachtragen" type="email" inputMode="email" style={{ minWidth: 200 }} />
                    <button type="button" className="pi-knopf still" disabled={!!laeuft || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mailNachtrag.trim())} onClick={() => void mailNachtragen()}>{laeuft === "mailnachtrag" ? "Speichert …" : "Speichern"}</button>
                  </span>
                )}
                {sperre.ziel === "produkt" && <button type="button" className="pi-knopf still" onClick={() => setProduktOffen(true)}>Produkt anlegen</button>}
              </span>
            )}
          </div>
          <div className="pi-reihe">
            <button type="button" className="pi-knopf still" onClick={() => setProduktOffen((v) => !v)} title="Ein Paket aus dem Katalog an diese Akte hängen. Ein offenes Paket wird dabei ersetzt.">
              {buchungen.some((b) => b.offen && b.art === "paket") ? "Produkt tauschen" : "Produkt hinzufügen"}
            </button>
            {k.email && <a href={`mailto:${k.email}`} className="pi-knopf still" title={`Öffnet dein eigenes Mailprogramm mit ${k.email}`}><Mail size={14} strokeWidth={1.75} /> eigenes Mailprogramm</a>}
            <button type="button" className="pi-knopf still" onClick={() => void nummerKorrektur()} disabled={!!laeuft || !k.email} title="Schickt dem Kunden einen Link, mit dem er seine Telefonnummer selbst korrigiert">
              {laeuft === "nummer" ? "Sende …" : "Nummer korrigieren lassen"}
            </button>
            <button type="button" className="pi-knopf still" onClick={() => setBlatt(true)}>Gesprächsblatt</button>
            <button type="button" className="pi-knopf still" onClick={() => setSendeMenue(true)}><Mail size={14} strokeWidth={1.75} /> E-Mail senden</button>
          </div>
          {produktOffen && (
            <div className="pi-hell">
              <ProduktDialog offen={produktOffen} personId={k.personId} buchungen={buchungen as any} aufKlappen={setProduktOffen}
                             fertig={async (m) => { melden("gut", "Produkt gespeichert", m); await frisch(); onZaehler(); }} />
            </div>
          )}
        </div>

        {/* Vorgeschichte */}
        {(k.nichtErreicht >= 2 || k.ruhtSeit) && (
          <div className={`pi-block ${k.ruhtSeit ? "still" : "warn"}`}>
            <div className="pi-block-kopf"><b>Vorgeschichte</b></div>
            <p className={k.ruhtSeit ? "leise" : "warn"}>
              {k.nichtErreicht}× nicht erreicht
              {k.letzterKontakt && `, zuletzt ${dtag(k.letzterKontakt)}`}
              {k.terminlinkMailAm && `, Terminlink versandt ${dtag(k.terminlinkMailAm)}`}
            </p>
            {k.ruhtSeit && <p className="leise">Ruht bis {k.wiedervorlage ? dtag(k.wiedervorlage) : "zur Wiedervorlage"}. Nicht anrufen — er hat den Terminlink und meldet sich selbst.</p>}
            {!k.email && (
              <div className="pi-reihe">
                <p className="leise">Keine E-Mail hinterlegt — es ging keine Mail raus.</p>
                <button type="button" className="pi-knopf still klein" onClick={() => void terminlinkKopieren()}><Copy size={13} strokeWidth={1.75} /> {linkKopiert ? "Kopiert" : "Terminlink für WhatsApp kopieren"}</button>
              </div>
            )}
          </div>
        )}

        {/* Zahlung: Verwendungszweck + Beleg */}
        {k.zahlung?.referenz && (
          <div className="pi-block">
            <div className="pi-zweck">
              <span><small>Verwendungszweck</small><b>{k.zahlung.referenz}</b></span>
              <button type="button" className="pi-knopf still klein" style={{ marginLeft: "auto" }} disabled={!k.zahlung.klartext} onClick={() => void zahlungsdatenKopieren()} title="Empfänger, IBAN, Betrag und Verwendungszweck als Text — fertig für WhatsApp">
                <Copy size={13} strokeWidth={1.75} /> {kopiert ? "Kopiert" : "Zahlungsdaten kopieren"}
              </button>
            </div>
            {kopiert && <p className="gut">Empfänger, IBAN, Betrag und Verwendungszweck liegen in der Zwischenablage.</p>}
            {!belegOffen ? (
              <button type="button" className="pi-link" onClick={() => setBelegOffen(true)}>Überweisungsbeleg hinterlegen</button>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                <p className="leise">Foto oder PDF der Überweisung. Es erscheint bei der Zahlungsprüfung neben dem Bankeingang. Gebucht wird dadurch nichts.</p>
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
          </div>
        )}

        {/* Ergebnis festhalten */}
        <div className="pi-block">
          <div className="pi-block-kopf"><b>Ergebnis festhalten</b>
            <small style={{ color: "#64748b", fontSize: 12 }}>
              {k.nichtErreicht > 0 && `${k.nichtErreicht}× nicht erreicht`}{k.nichtErreicht > 0 && k.rechnungVersandt > 0 && " · "}{k.rechnungVersandt > 0 && `${k.rechnungVersandt}× Zahlungsdaten`}
            </small>
          </div>
          <div className="pi-hell">
            <ErgebnisWahl onErgebnis={(art, zusatz) => ergebnis(art, zusatz)} laeuft={laeuft} kundeName={k.name} heute={heuteIso()} vorgabeDatum={datumWert} />
          </div>
        </div>

        {/* Buchungen */}
        {buchungen.length > 0 && (
          <div className="pi-block">
            <div className="pi-block-kopf"><b>Buchungen</b>
              {auswahl.size > 0 && (
                <>
                  <button type="button" className="pi-knopf warn klein" disabled={laeuft === "arch-auswahl"} onClick={() => void auswahlWegraeumen()}>{laeuft === "arch-auswahl" ? "Wird weggeräumt …" : `Auswahl wegräumen (${auswahl.size})`}</button>
                  <button type="button" className="pi-link" onClick={() => setAuswahl(new Set())}>Auswahl aufheben</button>
                </>
              )}
            </div>
            {buchungen.map((b) => (
              <div key={b.ref} className={`pi-buchung${b.bezahlt ? " bezahlt" : b.erledigt ? " erledigt" : " offen"}`}>
                <b>{b.bezeichnung}</b>
                <span className={`art${b.art === "bonitaet" ? " zusatz" : ""}`}>{b.art === "bonitaet" ? "Zusatz" : "Paket"}</span>
                {b.betragCents != null && <span className="betrag">{eur(b.betragCents)}</span>}
                <span className="zustand">{b.zahlungText}</span>
                {!b.erledigt && <a href={`/api/fiaon/agent/customers/${encodeURIComponent(b.ref)}/invoice.pdf`} target="_blank" rel="noreferrer">Rechnung (PDF) <ExternalLink size={11} /></a>}
                <span className="rechts">gestellt {b.gestelltAm ? dtag(b.gestelltAm) : "—"}{b.faelligAm && !b.bezahlt && ` · fällig ${dtag(b.faelligAm)}`}</span>
                {/* §16 (E-044): VORHER stand hier der Servertext – `Karte: {k.karte.text} (seit …)`.
                    NACHHER überall der Platzhalter, bis der Kunde vollständig ist (kundeVollstaendig). */}
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
              <p className="leise" style={{ color: "#bfdbfe" }}>
                {gemeldet.length === 1
                  ? <>Der Kunde hat für <b style={{ color: "#fff" }}>{gemeldet[0].bezeichnung}</b> eine Zahlung gemeldet — sehr wahrscheinlich die gewollte Buchung. Die anderen kannst du wegräumen.</>
                  : <>{offeneBuchungen.length} offene Buchungen. Frag am Telefon, welche der Kunde will — die anderen räumst du hier weg.</>}
              </p>
            )}
            {offeneBuchungen.length > 0 && <p className="warn">Offen insgesamt: <b style={{ color: "#fff" }}>{eur(offeneBuchungen.reduce((s, b) => s + (b.betragCents ?? 0), 0))}</b></p>}
          </div>
        )}

        {/* Stammdaten */}
        <div className="pi-block">
          <div className="pi-block-kopf"><b>Stammdaten</b><button type="button" className="pi-link" onClick={() => setBearbeiten((v) => !v)}>{bearbeiten ? "Schließen" : "Kunde bearbeiten"}</button></div>
          {bearbeiten && <KundeBearbeiten k={k} melden={melden} onFertig={async () => { setBearbeiten(false); await frisch(); }} />}
          <dl className="pi-dl">
            {([
              ["Adresse", [k.stammdaten?.strasse, [k.stammdaten?.plz, k.stammdaten?.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null],
              ["Land", k.stammdaten?.land ? (LAND_NAME[k.stammdaten.land] || k.stammdaten.land) : null],
              ["Geburtsdatum", k.stammdaten?.geburtsdatum ? dtag(String(k.stammdaten.geburtsdatum)) : null],
              ["E-Mail", k.email], ["Telefon", k.telefon],
              ["Verwendungszweck", k.zahlung?.referenz],
              ["Wiedervorlage", k.wiedervorlage ? dtag(k.wiedervorlage) : null],
              ["Betreut seit", k.betreutSeit ? dtag(k.betreutSeit) : null],
            ] as [string, string | null | undefined][]).map(([l, w]) => (
              <div key={l}><dt>{l}</dt><dd className={w ? "" : "fehlt"}>{w || "nicht hinterlegt"}</dd></div>
            ))}
          </dl>
        </div>

        {/* E-Mails / Versand */}
        <div className="pi-block">
          <div className="pi-block-kopf"><b>E-Mails</b>
            <button type="button" className="pi-knopf still klein" onClick={() => setBlatt(true)}>Gesprächsblatt</button>
            <button type="button" className="pi-knopf klein" onClick={() => setSendeMenue(true)}><Mail size={13} strokeWidth={1.75} /> E-Mail senden</button>
          </div>
          <Versandzentrum personId={k.personId} />
        </div>
        <SendeMenue personId={k.personId} offen={sendeMenue} onSchliessen={() => setSendeMenue(false)} onGesendet={onZaehler} />
        <Gespraechsblatt personId={k.personId} offen={blatt} onZu={() => setBlatt(false)} />

        {/* Verlauf + Notiz + Testeintrag */}
        <div className="pi-block">
          <div className="pi-block-kopf"><b>Verlauf</b><small style={{ color: "#64748b", fontSize: 12 }}>{wartezeit(k.letzterKontakt)}</small></div>
          {!verlauf && <p className="leise">Lade …</p>}
          {verlauf && verlauf.length === 0 && <p className="leise">Noch kein Eintrag.</p>}
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
            <input ref={notizFeld} className="pi-eingabe" value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="Notiz hinzufügen"
                   onKeyDown={(e) => { if (e.key === "Enter" && notiz.trim().length >= 2 && !laeuft) void ergebnis("notiz"); }} />
            <button type="button" className="pi-knopf klein" disabled={notiz.trim().length < 2 || !!laeuft} onClick={() => void ergebnis("notiz")}>{laeuft === "notiz" ? "…" : "Speichern"}</button>
          </div>
          {!testOffen ? (
            <button type="button" className="pi-link" style={{ color: "#64748b", justifySelf: "start" }} onClick={() => setTestOffen(true)}>Kein echter Kunde? Als Testeintrag melden</button>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              <p className="leise">Die Vertriebsleitung prüft und legt die Bestellung ins Archiv, wenn es stimmt. Du entfernst hier nichts selbst — der Kunde bleibt bis zur Entscheidung in deiner Liste.</p>
              <div className="pi-reihe">
                <input className="pi-eingabe" value={testNotiz} onChange={(e) => setTestNotiz(e.target.value)} placeholder="Woran erkennst du das? (ein Satz)" />
                <button type="button" className="pi-knopf still klein" disabled={testNotiz.trim().length < 5 || !!laeuft} onClick={() => void testeintragMelden()}>{laeuft === "test" ? "Meldet …" : "Melden"}</button>
                <button type="button" className="pi-link" onClick={() => { setTestOffen(false); setTestNotiz(""); }}>Abbrechen</button>
              </div>
            </div>
          )}
        </div>
        </>}
      </div>

      {bestaetigen && (
        <RechnungBestaetigung personId={k.personId} kundeName={k.name} laeuft={laeuft === "rechnung"}
                              onAbbrechen={() => { setBestaetigen(false); setSendeFehler(null); }}
                              onSenden={(ref) => void zahlungsdaten(ref)} sendeFehler={sendeFehler} />
      )}
    </aside>
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
function VertragsLuecke({ k, melden }: { k: Kunde; melden: (art: "gut" | "schlecht" | "info", titel: string, text?: string) => void }) {
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
    <span className="pi-stapel">
      <span className="pi-luecke">Für den Vertrag fehlen noch: {k.fehlendeFelder}</span>
      {sachangaben.length > 0 && <span className="pi-luecke">{sachangaben.join(", ")} kannst du am Telefon aufnehmen — über „Kunde bearbeiten“.</span>}
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
function KundeBearbeiten({ k, melden, onFertig }: { k: Kunde; melden: (art: "gut" | "schlecht" | "info", titel: string, text?: string) => void; onFertig: () => Promise<void> }) {
  const [f, setF] = useState({
    firstName: (k.name || "").split(" ").slice(0, -1).join(" ") || k.name || "", lastName: (k.name || "").split(" ").slice(-1).join(""),
    phone: k.telefon || "", street: k.stammdaten?.strasse || "", zip: k.stammdaten?.plz || "", city: k.stammdaten?.ort || "",
  });
  const [busy, setBusy] = useState(false);
  const ref = k.zahlung?.ref || k.buchungen?.[0]?.ref || null;
  const speichern = async () => {
    if (!ref) { melden("schlecht", "Keine Bestellung", "Ohne Bestellung gibt es keine Akte, an der die Daten hängen."); return; }
    setBusy(true);
    const r = await api(`/agent/customers/${encodeURIComponent(ref)}/stammdaten`, { method: "POST", body: JSON.stringify(f) });
    setBusy(false);
    if (!r.ok) { melden("schlecht", "Nicht gespeichert", r.json?.error || "Bitte erneut versuchen."); return; }
    melden("gut", "Gespeichert", "Die Änderungen stehen mit altem und neuem Wert in der Akte.");
    await onFertig();
  };
  const feld = (key: keyof typeof f, label: string, breit = false) => (
    <label className={breit ? "breit" : ""}>{label}<input className="pi-eingabe" value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} /></label>
  );
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div className="pi-form">
        {feld("firstName", "Vorname")}{feld("lastName", "Nachname")}
        {feld("phone", "Telefon", true)}{feld("street", "Straße", true)}
        {feld("zip", "PLZ")}{feld("city", "Ort")}
      </div>
      <div className="pi-reihe">
        <button type="button" className="pi-knopf klein" onClick={() => void speichern()} disabled={busy}>{busy ? "Speichert …" : "Speichern"}</button>
        <span className="pi-luecke">Geburtsdatum und Land ändert die Vertriebsleitung.</span>
      </div>
    </div>
  );
}
