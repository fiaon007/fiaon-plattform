// ═══════════════════════════════════════════════════════════════════════════
// BESTEHENDE US-GESELLSCHAFT: LÖSCHEN ODER ÜBERTRAGEN — DIE WEISUNG DES KUNDEN (17.11.2026)
//
// Justin (17.11.2026): „baue ihm die Seite für die alte LLC — er fragte Frau Lombardi, ob er diese auch jemand anderem
// übertragen kann statt löschen. Uns ist beides recht, er soll uns nur mitteilen wie, wo genau.“
//
// Der Vertrag (Befugnisse, shared/fiaon-global-befugnisse.ts) erlaubt FIAON „keine Übertragung oder Belastung von Anteilen
// und keine Auflösung ohne Weisung in Textform“. Diese Seite holt genau diese Weisung ein: der Kunde wählt „löschen“ oder
// „übertragen“, nennt die Gesellschaft und — bei der Übertragung — den neuen Inhaber, und bestätigt mit seinem Namen.
// Die Weisung liegt danach als Dokument in seiner Akte, das Team bekommt eine Aufgabe, und der Kunde erhält eine Kopie
// per E-Mail (dauerhafter Datenträger — Textform).
//
// Die Seite hängt am persönlichen Angebotslink: /business/angebot/<Link>/bestehende-gesellschaft — nur nach der Annahme.
// Diese Datei ist REIN (kein Netz, keine Datenbank): Sätze, Prüfung der Eingaben, Text der Weisung.
// ═══════════════════════════════════════════════════════════════════════════
import { namePasst } from "./fiaon-global-unterschrift";

/** Kosten der Löschung — wie Justin sie Herrn Milkowitsch am 12.11.2026 zugesagt hat: Rechnung erst nach der Löschung. */
export const BESTEHENDE_LLC_LOESCHUNG_USD = 149;

export const BESTEHENDE_LLC_STAATEN = ["Florida", "Delaware", "Wyoming", "anderer Bundesstaat"] as const;
export type BestehendeLlcStaat = (typeof BESTEHENDE_LLC_STAATEN)[number];
export type BestehendeLlcWahl = "loeschen" | "uebertragen";

export interface BestehendeLlcEingabe {
  wahl: BestehendeLlcWahl;
  gesellschaft: { name: string; staat: BestehendeLlcStaat; dokumentNr: string };
  /** Nur bei „übertragen“. */
  empfaenger: {
    art: "person" | "firma";
    name: string;
    /** Bei einer Firma: wer sie vertritt. */
    vertreten: string;
    strasse: string; plz: string; ort: string; land: string;
    email: string; telefon: string;
  } | null;
  /** Anteil in Prozent, der übertragen wird (1–100). Nur bei „übertragen“. */
  anteil: number | null;
  /** Gewünschter Stichtag (JJJJ-MM-TT) oder leer. */
  stichtag: string;
  anmerkung: string;
  /** Der vollständige Name, mit dem der Kunde bestätigt — muss zum Auftraggeber passen. */
  bestaetigtMit: string;
  weisungBestaetigt: boolean;
}

const kurz = (v: unknown, max: number): string => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const absatz = (v: unknown, max: number): string => String(v ?? "").replace(/\r/g, "").replace(/[ \t]+/g, " ").trim().slice(0, max);

/** Die Eingaben prüfen und säubern. Fehler: ein Satz, den die Seite unter dem Feld zeigt; `feld` sagt, wo. */
export function bestehendeLlcPruefen(roh: any, erwarteterName: string): { ok: true; eingabe: BestehendeLlcEingabe } | { ok: false; feld: string; fehler: string } {
  const wahl = roh?.wahl === "loeschen" || roh?.wahl === "uebertragen" ? (roh.wahl as BestehendeLlcWahl) : null;
  if (!wahl) return { ok: false, feld: "wahl", fehler: "Bitte wählen Sie: löschen oder übertragen." };
  const name = kurz(roh?.gesellschaft?.name, 120);
  if (name.length < 3) return { ok: false, feld: "gesellschaft.name", fehler: "Bitte nennen Sie den Namen Ihrer bisherigen Gesellschaft." };
  const staatRoh = kurz(roh?.gesellschaft?.staat, 40);
  const staat = (BESTEHENDE_LLC_STAATEN as readonly string[]).includes(staatRoh) ? (staatRoh as BestehendeLlcStaat) : "Florida";
  const dokumentNr = kurz(roh?.gesellschaft?.dokumentNr, 30).toUpperCase();
  if (dokumentNr && !/^[A-Z0-9-]{4,30}$/.test(dokumentNr)) return { ok: false, feld: "gesellschaft.dokumentNr", fehler: "Die Registernummer besteht aus Buchstaben und Ziffern (z. B. L21000123456). Lassen Sie das Feld sonst einfach leer." };

  let empfaenger: BestehendeLlcEingabe["empfaenger"] = null;
  let anteil: number | null = null;
  if (wahl === "uebertragen") {
    const e = roh?.empfaenger ?? {};
    const art = e.art === "firma" ? "firma" : "person";
    const eName = kurz(e.name, 120);
    if (eName.length < 3) return { ok: false, feld: "empfaenger.name", fehler: art === "firma" ? "Bitte nennen Sie den Namen der Firma." : "Bitte nennen Sie den vollständigen Namen der Person." };
    const vertreten = kurz(e.vertreten, 120);
    if (art === "firma" && vertreten.length < 3) return { ok: false, feld: "empfaenger.vertreten", fehler: "Bitte nennen Sie, wer die Firma vertritt." };
    const strasse = kurz(e.strasse, 120), plz = kurz(e.plz, 20), ort = kurz(e.ort, 80), land = kurz(e.land, 60);
    if (strasse.length < 3 || plz.length < 3 || ort.length < 2 || land.length < 2) return { ok: false, feld: "empfaenger.anschrift", fehler: "Bitte tragen Sie die vollständige Anschrift ein (Straße, PLZ, Ort, Land)." };
    const email = kurz(e.email, 160).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, feld: "empfaenger.email", fehler: "Bitte tragen Sie eine gültige E-Mail-Adresse ein — der neue Inhaber unterschreibt die Übertragung digital." };
    const telefon = kurz(e.telefon, 40);
    empfaenger = { art, name: eName, vertreten: art === "firma" ? vertreten : "", strasse, plz, ort, land, email, telefon };
    const a = Math.round(Number(roh?.anteil));
    if (!Number.isFinite(a) || a < 1 || a > 100) return { ok: false, feld: "anteil", fehler: "Bitte nennen Sie den Anteil zwischen 1 und 100 Prozent." };
    anteil = a;
  }
  const stichtagRoh = kurz(roh?.stichtag, 10);
  const stichtag = /^\d{4}-\d{2}-\d{2}$/.test(stichtagRoh) ? stichtagRoh : "";
  const anmerkung = absatz(roh?.anmerkung, 1500);
  const bestaetigtMit = kurz(roh?.bestaetigtMit, 120);
  if (!namePasst(bestaetigtMit, erwarteterName)) return { ok: false, feld: "bestaetigtMit", fehler: `Bitte bestätigen Sie mit Ihrem vollständigen Namen (${erwarteterName}).` };
  if (roh?.weisungBestaetigt !== true) return { ok: false, feld: "weisungBestaetigt", fehler: "Bitte bestätigen Sie Ihre Weisung mit dem Häkchen." };
  return { ok: true, eingabe: { wahl, gesellschaft: { name, staat, dokumentNr }, empfaenger, anteil, stichtag, anmerkung, bestaetigtMit, weisungBestaetigt: true } };
}

const tagText = (iso: string): string => {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
};

/** Der Text der Weisung — derselbe Wortlaut liegt in der Akte und steht in der Kopie an den Kunden. */
export function bestehendeLlcWeisungText(e: BestehendeLlcEingabe, k: { auftraggeber: string; auftragRef: string; erteiltAm: string }): string {
  const z: string[] = [];
  z.push("WEISUNG ZUR BESTEHENDEN US-GESELLSCHAFT");
  z.push("");
  z.push(`Auftraggeber: ${k.auftraggeber}`);
  z.push(`Auftrag: ${k.auftragRef}`);
  z.push(`Gesellschaft: ${e.gesellschaft.name} (${e.gesellschaft.staat})${e.gesellschaft.dokumentNr ? ` · Registernummer ${e.gesellschaft.dokumentNr}` : ""}`);
  z.push("");
  if (e.wahl === "loeschen") {
    z.push("Weisung: LÖSCHUNG — FIAON soll die Gesellschaft beim Bundesstaat auflösen lassen (Auflösung und Löschung im Register).");
    z.push(`Kosten der Löschung: ${BESTEHENDE_LLC_LOESCHUNG_USD} US-Dollar, in Rechnung gestellt erst nach erfolgter Löschung. Ist für die Gesellschaft noch ein steuerlicher Abschluss in den USA nötig, nennt FIAON die Kosten vorab.`);
  } else if (e.empfaenger) {
    const p = e.empfaenger;
    z.push(`Weisung: ÜBERTRAGUNG — FIAON soll die Übertragung von ${e.anteil} % der Anteile an der Gesellschaft vorbereiten und die neuen Verantwortlichen beim Bundesstaat eintragen lassen.`);
    z.push(`Neuer Inhaber: ${p.art === "firma" ? `${p.name} (Firma), vertreten durch ${p.vertreten}` : p.name}`);
    z.push(`Anschrift: ${p.strasse}, ${p.plz} ${p.ort}, ${p.land}`);
    z.push(`Kontakt: ${p.email}${p.telefon ? ` · ${p.telefon}` : ""}`);
    z.push("Die Übertragungsunterlagen unterschreiben Auftraggeber und neuer Inhaber. Die Kosten nennt FIAON vorab, bevor etwas eingereicht wird.");
  }
  if (e.stichtag) z.push(`Gewünschter Stichtag: ${tagText(e.stichtag)}`);
  if (e.anmerkung) { z.push(""); z.push(`Anmerkung des Auftraggebers: ${e.anmerkung}`); }
  z.push("");
  z.push(`Erteilt am ${k.erteiltAm} über die persönliche Seite des Auftraggebers, bestätigt mit dem Namen „${e.bestaetigtMit}“.`);
  return z.join("\n");
}

/** Eine Zeile für Aufgabe und Meldung. */
export function bestehendeLlcKurz(e: BestehendeLlcEingabe): string {
  if (e.wahl === "loeschen") return `Löschung von ${e.gesellschaft.name} (${e.gesellschaft.staat})`;
  const p = e.empfaenger!;
  return `Übertragung von ${e.gesellschaft.name} (${e.gesellschaft.staat}): ${e.anteil} % der Anteile an ${p.name}${p.art === "firma" ? " (Firma)" : ""}`;
}
