// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DANIELS TAKT, ÜBERSICHT 18:30, WÄCHTER: DIE REINE RECHNUNG UND DIE TEXTE (E-476 Scheibe 5, 05.11.2026)
//
// Zu server/lib/fiaon-lead-takt.ts: keine Datenbank, kein Netz, keine Uhr — `jetzt` kommt immer als Parameter, damit
// scripts/pruef-lead-takt.ts jede Kante (Nacht, Wochenende, Feiertag, 17:55 Uhr, Zeitumstellung) heute prüft.
//
// ── DIE REGELN (Plan Lead-Weg 2.0, Scheibe 5 + Gutachten-Pflichten) ─────────
//   Dienstzeit   Mo–Fr 9–18 Uhr Berlin, ohne deutsche Feiertage. Die Uhr eines Leads zählt NUR Dienstminuten — ein
//                Lead von 21:13 Uhr steht am nächsten Werktag um 9:00 bei Minute 0 („Nachts zählt die Uhr ab 9 Uhr“).
//   Leiter       15 Dienstminuten ohne Reaktion (Auftrag/Cockpit nicht geöffnet, kein Anruf, kein Termin) → Erinnerung an
//                Daniel. 60 → eine Zeile an Justin im Faden des Leads, die Vertretung bekommt den Rückruf als Aufgabe
//                (Gutachten 1, Mangel 14 — keine Aufgabe an Justin). 120 ohne eingetragenen Anruf → Zusage-Wächter
//                (Gutachten 1, Mangel 3): Hinweis an Daniel, Rückruf an die Vertretung. Jede Stufe genau einmal je Lead;
//                Mails nur in der Dienstzeit; holt der Lauf nach einem Ausfall mehrere Stufen auf einmal nach, bekommt
//                Daniel nur die stärkere Mail.
//   Übersicht    18:30 Uhr, nur werktags, einmal je Tag (atomarer Tagesmerker, Gutachten 0, Mangel 11).
//   T1           Die Lead-Meldung an Daniel (Adresse „Lead-Meldungen an“): kurz, die Antworten im Klartext, was der Lead
//                schon von Justin bekommen hat, wann anrufen (Wochentag statt „morgen“ — Gutachten 1, Mangel 3).
// Texte an Justin und Daniel: du-Form. Alles, was der Lead geschrieben hat, wird entschärft (nie ein fremder Link).
// ═══════════════════════════════════════════════════════════════════════════
import { berlinZeitpunkt } from "./fiaon-time";
import { istFeiertag } from "@shared/fiaon-feiertage";
import {
  berlinZeit, linksEntschaerfen, antwortZeile, fadenAntwortBetreff, TEMPERATUR_WORT, ANRUF_ERGEBNIS_TEXT,
  type LeadAntwort, type LeadTemperatur,
} from "@shared/fiaon-global-lead";
import { istWerktag, isoPlus } from "@shared/fiaon-global-lead-texte";
import { LEAD_TAKT_VORGABE as V, ANFRAGE_STAND_WORT } from "@shared/fiaon-lead-takt";
import { versandLand } from "@shared/fiaon-whatsapp-erlaubnis";

/** Deutsche Feiertage (der Absender sitzt hier — dieselbe Regel wie beim Nachfass). */
export const feiertagDE = (iso: string): boolean => istFeiertag("DE", iso);

const zwei = (n: number) => String(n).padStart(2, "0");
/** „14:05“ (Berlin). */
export function uhr(d: Date): string { const z = berlinZeit(d); return `${zwei(z.stunde)}:${zwei(z.minute)}`; }
/** „Mi 05.11., 14:05“ (Berlin). */
export function tagUhr(d: Date): string { const z = berlinZeit(d); return `${z.wochentag.slice(0, 2)} ${z.datum}, ${zwei(z.stunde)}:${zwei(z.minute)}`; }

// ═══════════════════════════════════════════════════════════════════════════
// DIE DIENSTZEIT-UHR
// ═══════════════════════════════════════════════════════════════════════════
/** Liegt `jetzt` in der Dienstzeit (Mo–Fr 9–18 Uhr Berlin, kein Feiertag)? */
export function imDienst(jetzt: Date, feiertag: (iso: string) => boolean = feiertagDE): boolean {
  const b = berlinZeit(jetzt);
  return istWerktag(b.iso, feiertag) && b.stunde >= V.dienstVon && b.stunde < V.dienstBis;
}

/** Dienstminuten zwischen zwei Zeitpunkten (nur Mo–Fr 9–18 Uhr Berlin, ohne Feiertage), abgerundet. Höchstens 40 Tage. */
export function dienstMinuten(von: Date, bis: Date, feiertag: (iso: string) => boolean = feiertagDE): number {
  if (!(bis.getTime() > von.getTime())) return 0;
  let summe = 0;
  const ende = berlinZeit(bis).iso;
  let iso = berlinZeit(von).iso;
  for (let i = 0; i < 40 && iso <= ende; i++, iso = isoPlus(iso, 1)) {
    if (!istWerktag(iso, feiertag)) continue;
    const a = Math.max(von.getTime(), berlinZeitpunkt(iso, V.dienstVon * 60).getTime());
    const b = Math.min(bis.getTime(), berlinZeitpunkt(iso, V.dienstBis * 60).getTime());
    if (b > a) summe += (b - a) / 60_000;
  }
  return Math.floor(summe);
}

/** Der nächste Dienstbeginn (9:00 am nächsten Werktag) — null, wenn gerade Dienstzeit ist. */
export function naechsterDienst(jetzt: Date, feiertag: (iso: string) => boolean = feiertagDE): Date | null {
  if (imDienst(jetzt, feiertag)) return null;
  const b = berlinZeit(jetzt);
  let iso = b.iso;
  if (!(istWerktag(iso, feiertag) && b.stunde < V.dienstVon)) {
    iso = isoPlus(iso, 1);
    for (let i = 0; i < 14 && !istWerktag(iso, feiertag); i++) iso = isoPlus(iso, 1);
  }
  return berlinZeitpunkt(iso, V.dienstVon * 60);
}

/** „jetzt“ oder „am Donnerstag, 06.11. ab 9 Uhr“ — nie „morgen“ (nach Mitternacht falsch, Gutachten 1, Mangel 3). */
export function anrufWann(jetzt: Date, feiertag: (iso: string) => boolean = feiertagDE): { jetzt: boolean; text: string } {
  const n = naechsterDienst(jetzt, feiertag);
  if (!n) return { jetzt: true, text: "jetzt" };
  const z = berlinZeit(n);
  return { jetzt: false, text: `am ${z.wochentag}, ${z.datum} ab ${V.dienstVon} Uhr` };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE ERINNERUNGSLEITER 15 / 60 / 120
// ═══════════════════════════════════════════════════════════════════════════
export type EskStufe = "e15" | "e60" | "e120";
export interface EskalationLage {
  eingang: Date; jetzt: Date;
  /** Auftrag oder Cockpit geöffnet, Anruf eingetragen, Termin, Auftrag zu, Abschluss im Cockpit. */
  reagiert: boolean;
  /** Ein Anruf ist eingetragen (oder Termin, Auftrag zu, Abschluss) — für den Zusage-Wächter zählt nur das. */
  angerufen: boolean;
  gesendet: Record<EskStufe, boolean>;
}
export interface EskalationPlan {
  minuten: number;
  /** Die EINE Mail an Daniel in diesem Takt — die stärkere gewinnt. */
  daniel: "e15" | "e120" | null;
  /** Eine Zeile an Justin im Faden des Leads. */
  justin: boolean;
  /** Der Rückruf als Aufgabe an die Vertretung (einmal — die Datenbank merkt sich, ob es ihn schon gibt). */
  vertretung: boolean;
  /** Welche Stufen dieser Takt als erledigt merkt (eine übersprungene schwächere Erinnerung mit). */
  markieren: EskStufe[];
}

/** Was ist jetzt fällig? Nur in der Dienstzeit; jede Stufe einmal. Rein. */
export function eskalationPlanen(l: EskalationLage, feiertag: (iso: string) => boolean = feiertagDE): EskalationPlan {
  const leer: EskalationPlan = { minuten: 0, daniel: null, justin: false, vertretung: false, markieren: [] };
  if (!imDienst(l.jetzt, feiertag)) return leer;
  const minuten = dienstMinuten(l.eingang, l.jetzt, feiertag);
  const e120 = !l.angerufen && minuten >= V.zusageMin && !l.gesendet.e120;
  const e60 = !l.reagiert && minuten >= V.justinMin && !l.gesendet.e60;
  const e15 = !l.reagiert && minuten >= V.erinnerungMin && !l.gesendet.e15;
  const markieren: EskStufe[] = [];
  // Holt der Lauf mehrere Stufen auf einmal nach, bekommt Daniel nur die stärkere Mail — die fällige schwächere gilt als erledigt.
  if (e120) { markieren.push("e120"); if (e15) markieren.push("e15"); } else if (e15) markieren.push("e15");
  if (e60) markieren.push("e60");
  return { minuten, daniel: e120 ? "e120" : e15 ? "e15" : null, justin: e60, vertretung: e60 || e120, markieren };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE ÜBERSICHT 18:30 — wann
// ═══════════════════════════════════════════════════════════════════════════
/** Der Tagesmerker: „JJJJ-MM-TT“ = erledigt, „JJJJ-MM-TT#f<n>“ = n Fehlversuche (ab drei: für heute aufgegeben). Rein. */
export function uebersichtMerkerLesen(wert: unknown, tag: string): { erledigt: boolean; fehlversuche: number } {
  const s = String(wert ?? "").trim();
  if (s === tag) return { erledigt: true, fehlversuche: 0 };
  const m = /^(\d{4}-\d{2}-\d{2})#f(\d+)$/.exec(s);
  if (m && m[1] === tag) { const n = Number(m[2]) || 0; return { erledigt: n >= 3, fehlversuche: n }; }
  return { erledigt: false, fehlversuche: 0 };
}

/** Fällig ab 18:30 Uhr an einem Werktag, einmal je Tag (holt einen verschlafenen Takt am selben Abend nach). Rein. */
export function uebersichtFaellig(jetzt: Date, merker: unknown, feiertag: (iso: string) => boolean = feiertagDE): { faellig: boolean; tag: string; fehlversuche: number } {
  const b = berlinZeit(jetzt);
  const m = uebersichtMerkerLesen(merker, b.iso);
  const faellig = istWerktag(b.iso, feiertag) && b.stunde * 60 + b.minute >= V.uebersichtUm && !m.erledigt;
  return { faellig, tag: b.iso, fehlversuche: m.fehlversuche };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE TEXTE
// ═══════════════════════════════════════════════════════════════════════════
export interface TaktMail { betreff: string; text: string; knoepfe: { text: string; url: string; leise?: boolean }[]; links: string[] }

export interface TelefonTeil { lesbar: string; e164: string | null; land: string | null }

/** Kurz: „Beides · 100.000 $ – 250.000 $ · So bald wie möglich“ — seine Antworten in einer Zeile (intern, Klartext). */
export function antwortenKurz(antworten: readonly LeadAntwort[]): string | null {
  const t = antworten.map((a) => linksEntschaerfen(String(a.antwort ?? "").trim())).filter(Boolean);
  return t.length ? t.join(" · ").slice(0, 220) : null;
}

/** Aus den Antworten: Rahmen und Start für den Betreff der Lead-Meldung. */
function betreffTeile(antworten: readonly LeadAntwort[]): string[] {
  const code = (p: RegExp) => antworten.find((a) => p.test(String(a.code ?? a.schluessel ?? "")));
  const rahmen = code(/^kapitalrahmen/);
  const start = code(/^wann_(starten|gruenden)/);
  return [rahmen?.antwort, start?.antwort].map((x) => String(x ?? "").trim()).filter((x) => x && !/^noch offen/i.test(x)).map((x) => linksEntschaerfen(x).slice(0, 40));
}

export interface T1Daten {
  anfrageId: number; anzeige: string; name: string; kanal: "meta" | "website";
  eingangAm: Date; antworten: LeadAntwort[]; nachricht: string | null; paketwunsch: string | null;
  temperatur: LeadTemperatur | null; telefon: TelefonTeil; email: string; mailArt: "firma" | "freemail" | "unklar";
  /** Was der Lead schon von Justin bekommen hat (oder warum nicht) — ein Satz. */
  mailVonJustin: string;
  /** „Bestandskunde Privat (…)“ oder ein Hinweis — sonst null. */
  vermerk: string | null;
  cockpitUrl: string;
  /** Vorname der zuständigen Person (Anrede). */
  wer: string;
  /** Nachbesserung (Gutachten Betreiber, Mangel 3): „Wann erreichen wir Sie am besten?“ von der Website — dann zu SEINER Zeit. */
  wunschzeit?: string | null;
  /** Nachbesserung (Mangel 3): Er hat auf Englisch angefragt — das Gespräch auf Englisch. */
  englisch?: boolean;
  /** Nachbesserung (Gutachten Sicherheit, Mangel 6 b): Er möchte keine Mails — anrufen ist erlaubt. */
  keineMails?: boolean;
  /** Der Auftrag liegt bei jemand anderem (Vertretung, Abwesenheit) — dann ein Satz, bei wem (die Meldung geht ans Team-Postfach). */
  auftragBei?: string | null;
}

/** T1 — die Lead-Meldung an Daniel (an die Adresse „Lead-Meldungen an“). Rein. */
export function t1Mail(d: T1Daten, jetzt: Date, feiertag: (iso: string) => boolean = feiertagDE): TaktMail {
  const w = anrufWann(jetzt, feiertag);
  const wz = d.wunschzeit ? linksEntschaerfen(d.wunschzeit).replace(/\s+/g, " ").slice(0, 80) : null;
  const wann = wz ? { jetzt: false, text: `zu seiner Wunschzeit (${wz})` } : w;
  const anzeige = linksEntschaerfen(d.anzeige);
  const name = linksEntschaerfen(d.name || d.anzeige);
  const teile = betreffTeile(d.antworten);
  const t: string[] = [];
  t.push(`NEUER LEAD: ${anzeige} — ${wann.jetzt ? "bitte jetzt anrufen" : `bitte ${wann.text} anrufen`}`, "");
  t.push(`Hallo ${linksEntschaerfen(d.wer)},`, "");
  t.push(`neuer Business-Lead über ${d.kanal === "meta" ? "das Meta-Formular" : "die Website"} (${tagUhr(d.eingangAm)} Uhr, Anfrage #${d.anfrageId}).`);
  if (d.auftragBei) t.push(`Der Anruf-Auftrag liegt bei ${linksEntschaerfen(d.auftragBei)} (Portal) — diese Meldung geht an das Team-Postfach.`);
  t.push(d.mailVonJustin);
  if (wz) t.push(`Wunschzeit: ${wz} — bitte dann anrufen.`);
  if (d.englisch) t.push("Gespräch auf ENGLISCH — er hat auf Englisch angefragt.");
  if (d.keineMails) t.push("Er möchte keine Mails — anrufen ist erlaubt.");
  if (d.vermerk) t.push(`Achtung: ${linksEntschaerfen(d.vermerk)}`);
  t.push("");
  if (d.paketwunsch || d.antworten.length) {
    t.push("SEINE ANTWORTEN");
    if (d.paketwunsch) t.push(`– Paketwunsch: ${linksEntschaerfen(d.paketwunsch)}`);
    for (const a of d.antworten) t.push(`– ${linksEntschaerfen(antwortZeile(a))}`);
    if (d.temperatur && d.temperatur !== "offen") t.push(`Einschätzung aus seinen Antworten: ${TEMPERATUR_WORT[d.temperatur]}`);
  } else if (d.nachricht) {
    t.push("SEINE NACHRICHT", `„${linksEntschaerfen(d.nachricht.replace(/\s+/g, " ").slice(0, 400))}“`);
  } else {
    t.push("SEINE ANGABEN", "– keine Auswahlfragen, keine Nachricht");
  }
  t.push("");
  t.push("KONTAKT");
  const mailArt = d.mailArt === "firma" ? " (Firmen-Adresse)" : d.mailArt === "freemail" ? " (Freemail)" : "";
  t.push(`${name} · ${d.telefon.lesbar || "keine Nummer"}${d.telefon.land ? ` (${d.telefon.land})` : ""} · ${linksEntschaerfen(d.email)}${mailArt}`);
  t.push("");
  t.push("SO GEHT'S");
  t.push(`1. Anrufen${d.telefon.lesbar ? `: ${d.telefon.lesbar}` : ""} — ${wann.jetzt ? "jetzt" : wann.text}.`);
  t.push("2. Im Gespräch: zwei, drei Sätze „Was er selbst erzählt hat“ — dann „Termin bei Justin eintragen“.");
  t.push("3. Bucht er vorher selbst über seinen Link, schließt sich dein Auftrag von allein.");
  const knoepfe: TaktMail["knoepfe"] = [{ text: "Im Firmen-Cockpit öffnen", url: d.cockpitUrl }];
  if (d.telefon.e164) knoepfe.push({ text: `Anrufen: ${d.telefon.lesbar}`, url: `tel:${d.telefon.e164}`, leise: true });
  return {
    betreff: `Neuer Lead: ${anzeige}${teile.length ? ` · ${teile.join(" · ")}` : ""}`.replace(/[\r\n]+/g, " ").slice(0, 150),
    text: t.join("\n"), knoepfe, links: [d.cockpitUrl],
  };
}

export interface ErinnerungDaten {
  stufe: "e15" | "e120"; anzeige: string; name: string; telefon: TelefonTeil; wer: string; minuten: number;
  /** Nachbesserung (Gutachten Sicherheit, Mangel 6 b): Er möchte keine Mails — anrufen ist erlaubt. */
  keineMails?: boolean;
  /** Hat Justins Willkommens-Mail den Anruf angekündigt? Dann ist es eine Zusage. */
  zusage: boolean;
  /** Die Vertretung, die den Rückruf als Aufgabe bekommt (oder schon hat) — sonst null. */
  vertretung: string | null;
  cockpitUrl: string;
  /** Der Betreff der Lead-Meldung T1 — die Erinnerung hängt in ihrem Faden. */
  t1Betreff: string | null;
}

/** Die Erinnerung an Daniel (15 Minuten) bzw. der Zusage-Hinweis (120 Minuten). Rein. */
export function erinnerungMail(d: ErinnerungDaten): TaktMail {
  const anzeige = linksEntschaerfen(d.anzeige);
  const name = linksEntschaerfen(d.name || d.anzeige);
  const t: string[] = [];
  if (d.stufe === "e15") {
    t.push(`LEAD WARTET SEIT ${d.minuten} MIN.: ${anzeige} — bitte jetzt anrufen`, "");
    t.push(`Hallo ${linksEntschaerfen(d.wer)},`, "");
    t.push(`${name} wartet seit ${d.minuten} Minuten (Dienstzeit) auf deinen Anruf — der Auftrag ist noch nicht geöffnet.`);
  } else {
    t.push(`ZUSAGE OFFEN: ${anzeige} — seit zwei Stunden kein Anruf eingetragen`, "");
    t.push(`Hallo ${linksEntschaerfen(d.wer)},`, "");
    t.push(d.zusage
      ? `Justins Mail hat ${name} deinen Anruf angekündigt — im Cockpit ist seit ${d.minuten} Minuten (Dienstzeit) kein Anruf eingetragen.`
      : `${name} wartet seit ${d.minuten} Minuten (Dienstzeit) auf einen Anruf — im Cockpit ist noch keiner eingetragen.`);
  }
  if (d.telefon.lesbar) t.push(`Telefon: ${d.telefon.lesbar}`);
  if (d.keineMails) t.push("Er möchte keine Mails — anrufen ist erlaubt.");
  t.push("", "Nach dem Anruf das Ergebnis im Cockpit eintragen — auch „nicht erreicht“ (dann passt Justins nächste Mail). Bei „erreicht“ mit zwei, drei Sätzen, was er erzählt hat.");
  if (d.vertretung) t.push(`${linksEntschaerfen(d.vertretung)} hat zur Sicherheit eine Rückruf-Aufgabe — rufst du an, schließt sie sich von selbst.`);
  const knoepfe: TaktMail["knoepfe"] = [{ text: "Im Firmen-Cockpit öffnen", url: d.cockpitUrl }];
  if (d.telefon.e164) knoepfe.push({ text: `Anrufen: ${d.telefon.lesbar}`, url: `tel:${d.telefon.e164}`, leise: true });
  return {
    betreff: d.t1Betreff ? fadenAntwortBetreff(d.t1Betreff) : `${d.stufe === "e15" ? "Lead wartet" : "Zusage offen"}: ${anzeige}`.slice(0, 150),
    text: t.join("\n"), knoepfe, links: [d.cockpitUrl],
  };
}

export interface JustinEskalationDaten {
  anzeige: string; name: string; eingangAm: Date; wer: string; minuten: number;
  vertretung: string | null; telefon: TelefonTeil; cockpitUrl: string;
  /** „Ich rufe selbst an“ aus dem Dossier (schließt Daniels Auftrag) — sonst null. */
  selbstUrl: string | null;
  /** Der Faden des Leads (Dossier, D2) — sonst ein eigener Betreff. */
  stamm: string | null;
}

/** Die eine Zeile an Justin nach 60 Dienstminuten — im Faden des Leads, keine Aufgabe. Rein. */
export function justinEskalationMail(d: JustinEskalationDaten): TaktMail {
  const anzeige = linksEntschaerfen(d.anzeige);
  const t: string[] = [];
  t.push(`WARTET SEIT ${d.minuten} MIN.: ${anzeige} — ${linksEntschaerfen(d.wer)} hat noch nicht reagiert`, "");
  t.push("Hallo Justin,", "");
  t.push(`der Lead von ${tagUhr(d.eingangAm)} Uhr wartet seit ${d.minuten} Minuten (Dienstzeit): ${linksEntschaerfen(d.wer)} hat den Auftrag nicht geöffnet und nicht angerufen.`);
  // Nachbesserung (Gutachten Betreiber, Mangel 5): ohne Vertretung keine versteckte Aufgabe an Justin — der Hinweis steht gelb
  // im Lagezimmer und am Feld „Vertretung für die Gespräche“.
  t.push(d.vertretung
    ? `${linksEntschaerfen(d.vertretung)} hat jetzt den Rückruf als Aufgabe — keine Aufgabe für dich.`
    : `${linksEntschaerfen(d.wer)} hat eine Erinnerung bekommen — keine Aufgabe für dich.`);
  if (d.telefon.lesbar) t.push(`Willst du selbst anrufen: ${d.telefon.lesbar}${d.selbstUrl ? " — „Ich rufe selbst an“ schließt den Auftrag, damit niemand doppelt anruft." : "."}`);
  const knoepfe: TaktMail["knoepfe"] = [{ text: "Im Firmen-Cockpit öffnen", url: d.cockpitUrl }];
  if (d.selbstUrl) knoepfe.push({ text: "Ich rufe selbst an", url: d.selbstUrl, leise: true });
  return {
    betreff: d.stamm ? fadenAntwortBetreff(d.stamm) : `Lead wartet seit ${d.minuten} Min.: ${anzeige}`.slice(0, 150),
    text: t.join("\n"), knoepfe, links: [d.cockpitUrl, ...(d.selbstUrl ? [d.selbstUrl] : [])],
  };
}

/** Die Rückruf-Aufgabe der Vertretung (Text). Rein. */
export function vertretungAuftragText(d: { anfrageId: number; anzeige: string; eingangAm: Date; minuten: number; wer: string; stufe: "e60" | "e120"; telefon: string; email: string }): { titel: string; text: string } {
  return {
    titel: `FIAON Global: Rückruf ${d.anzeige} — wartet seit ${d.minuten} Min.`.slice(0, 160),
    text: [
      `Der Business-Lead (Anfrage #${d.anfrageId}, Eingang ${tagUhr(d.eingangAm)} Uhr) wartet seit ${d.minuten} Minuten (Dienstzeit) auf einen Anruf — ${d.wer} hat ${d.stufe === "e60" ? "noch nicht reagiert" : "noch keinen Anruf eingetragen"}.`,
      `Telefon: ${d.telefon || "—"} · E-Mail: ${d.email || "—"}`,
      "Bitte anrufen und das Ergebnis im Firmen-Cockpit eintragen (bei „erreicht“ mit zwei, drei Sätzen, was er erzählt hat; bei Interesse „Termin bei Justin eintragen“).",
      `Ruft ${d.wer} vorher an oder bucht der Lead selbst, schließt sich diese Aufgabe von allein.`,
    ].join("\n"),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// GEBÜNDELT (Nachbesserung E-476, Gutachten Betreiber Mangel 5): mehrere wartende Leads in einem Takt = EINE Mail
// ═══════════════════════════════════════════════════════════════════════════
export interface SammelZeile { anzeige: string; name: string; minuten: number; telefon: TelefonTeil; cockpitUrl: string; stufe: "e15" | "e120" | "e60"; vertretung: string | null; keineMails?: boolean }

/** Mehrere Erinnerungen an Daniel in diesem Takt (z. B. die Nacht-Leads um 9:15) — eine Mail. Rein. */
export function erinnerungSammelMail(liste: readonly SammelZeile[], wer: string, cockpitAlle: string): TaktMail {
  const t: string[] = [];
  t.push(`${liste.length} LEADS WARTEN AUF DEINEN ANRUF`, "");
  t.push(`Hallo ${linksEntschaerfen(wer)},`, "");
  t.push(`${liste.length} Business-Leads warten (Dienstzeit) — bitte der Reihe nach anrufen und das Ergebnis im Cockpit eintragen:`, "");
  for (const z of liste) {
    t.push(`– ${linksEntschaerfen(z.anzeige)} · seit ${z.minuten} Min.${z.stufe === "e120" ? " · ZUSAGE OFFEN (kein Anruf eingetragen)" : ""} · ${z.telefon.lesbar || "keine Nummer"}${z.keineMails ? " · will keine Mails (anrufen erlaubt)" : ""}${z.vertretung ? ` · Rückruf-Aufgabe auch bei ${linksEntschaerfen(z.vertretung)}` : ""}`);
  }
  t.push("", "Bei „erreicht“ zwei, drei Sätze, was er erzählt hat — Justin liest das vor dem Gespräch.");
  return { betreff: `${liste.length} Leads warten auf deinen Anruf`, text: t.join("\n"), knoepfe: [{ text: "Firmen-Cockpit öffnen", url: cockpitAlle }], links: [cockpitAlle] };
}

/** Mehrere Zeilen an Justin nach 60 Minuten in diesem Takt — eine Mail, keine Aufgabe. Rein. */
export function justinSammelMail(liste: readonly SammelZeile[], wer: string, cockpitAlle: string): TaktMail {
  const t: string[] = [];
  t.push(`${liste.length} LEADS WARTEN SEIT ÜBER 60 MIN. — ${linksEntschaerfen(wer)} hat noch nicht reagiert`, "");
  t.push("Hallo Justin,", "");
  t.push(`diese Leads warten seit über einer Stunde (Dienstzeit) — ${linksEntschaerfen(wer)} hat eine Erinnerung bekommen. Keine Aufgabe für dich:`, "");
  for (const z of liste) t.push(`– ${linksEntschaerfen(z.anzeige)} · seit ${z.minuten} Min. · ${z.telefon.lesbar || "keine Nummer"}${z.vertretung ? ` · ${linksEntschaerfen(z.vertretung)} hat den Rückruf` : ""}`);
  return { betreff: `${liste.length} Leads warten seit über 60 Min.`, text: t.join("\n"), knoepfe: [{ text: "Firmen-Cockpit öffnen", url: cockpitAlle }], links: [cockpitAlle] };
}

/**
 * Ein kurzer Nachtrag im Faden der Lead-Meldung T1 (Nachbesserung, Gutachten Betreiber Mangel 2/6/8): der Anruf-Auftrag hat sich
 * von selbst geschlossen (Justin ruft selbst an, er hat selbst gebucht), ist wieder offen (abgesagt) oder es kam ein zweiter
 * Eingang desselben Leads. Rein.
 */
export function t1NachtragMail(d: { art: "selbst" | "gebucht" | "abgesagt" | "zweiter"; anzeige: string; wer: string; t1Betreff: string | null; wann?: string | null; zweiteAnfrage?: number | null; cockpitUrl: string }): TaktMail {
  const anzeige = linksEntschaerfen(d.anzeige);
  const kopf = d.art === "selbst" ? `ERLEDIGT: Justin ruft ${anzeige} selbst an — bitte nicht anrufen`
    : d.art === "gebucht" ? `ERLEDIGT: ${anzeige} hat selbst bei Justin gebucht${d.wann ? ` (${d.wann})` : ""} — bitte nicht anrufen`
      : d.art === "abgesagt" ? `ABGESAGT: ${anzeige} — bitte heute anrufen und neu eintragen`
        : `ZWEITER EINGANG: ${anzeige} hat noch einmal angefragt — ein Anruf genügt`;
  const satz = d.art === "selbst" ? "Justin hat den Anruf übernommen. Dein Auftrag ist geschlossen."
    : d.art === "gebucht" ? "Er hat über seinen Link bzw. den Kalender selbst gebucht. Dein Auftrag ist geschlossen — Justin führt das Gespräch."
      : d.art === "abgesagt" ? `Das Gespräch bei Justin${d.wann ? ` (${d.wann})` : ""} ist abgesagt bzw. kam nicht zustande. Dein Auftrag ist wieder offen — bitte heute anrufen und den neuen Termin bei Justin eintragen.`
        : `Derselbe Lead hat noch einmal angefragt${d.zweiteAnfrage ? ` (Anfrage #${d.zweiteAnfrage})` : ""} — es bleibt bei EINEM Anruf. Der zweite Auftrag ist geschlossen.`;
  return {
    betreff: d.t1Betreff ? fadenAntwortBetreff(d.t1Betreff) : kopf.slice(0, 150),
    text: [kopf, "", `Hallo ${linksEntschaerfen(d.wer)},`, "", satz].join("\n"),
    knoepfe: [{ text: "Im Firmen-Cockpit öffnen", url: d.cockpitUrl }], links: [d.cockpitUrl],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE ÜBERSICHT 18:30 — der Text
// ═══════════════════════════════════════════════════════════════════════════
export interface UebersichtLead {
  anfrageId: number; anzeige: string; kanal: "meta" | "website"; eingangAm: Date;
  temperatur: LeadTemperatur | null; antwortenKurz: string | null;
  mail: { status: string | null; am: Date | null };
  anrufe: { n: number; letzter: { ergebnis: string; am: Date; wer: string | null } | null };
  termin: { beginn: Date; status: string; bei: string | null } | null;
  /** Der Stand der Anfrage (abgeleitet: neu, in_arbeit, termin, kein_interesse …). */
  stand: string;
  /** Höchste erreichte Erinnerungsstufe heute — sonst null. */
  eskaliert: "e15" | "e60" | "e120" | null;
  /** Nachbesserung (Gutachten Betreiber, Mangel 2): Justin ruft selbst an — für das Team nichts zu tun. */
  selbst?: boolean;
}
export interface UebersichtDaten {
  tag: string; jetzt: Date;
  neu: UebersichtLead[]; offen: UebersichtLead[]; privatWeg: number;
  anrufe: { eintraege: number; leads: number };
  termineGebucht: number;
  gespraeche: { heute: { beginn: Date; anzeige: string; status: string; justinSeite?: boolean }[]; morgen: { beginn: Date; anzeige: string; justinSeite?: boolean }[] };
  takt: { t1: number; e15: number; e60: number; e120: number; ersterAnrufMin: number | null };
  nachfass: { n1: number; n2: number; n3: number; gestoppt: number };
  ki: { usd: number; deckelUsd: number; an: boolean };
  waechter: string[];
  cockpitUrl: string;
}

const MAIL_WORT: Readonly<Record<string, string>> = { gesendet: "Mail von Justin ✓", ausgelassen: "keine Mail von Justin", fehler: "Mail von Justin gescheitert", unklar: "Mail von Justin wird abgeglichen", laeuft: "Mail von Justin geht raus", wartet: "Mail von Justin wartet" };

/** Was an diesem Lead noch offen ist — ein Satz, oder null (nichts zu tun). Rein. */
export function leadOffen(l: Pick<UebersichtLead, "stand" | "termin" | "anrufe"> & { selbst?: boolean }, jetzt: Date): string | null {
  if (["kein_interesse", "ungueltig", "antrag", "kunde", "privat"].includes(l.stand)) return null;
  // Justin ruft selbst an (Knopf im Dossier) — für das Team nichts zu tun, bis ein Ergebnis oder Termin dasteht.
  if (l.selbst && !l.termin && !l.anrufe.letzter) return null;
  if (l.termin) {
    if (l.termin.status === "gebucht") return l.termin.beginn.getTime() > jetzt.getTime() - 2 * 3_600_000 ? null : "Ergebnis des Gesprächs eintragen";
    if (l.termin.status === "erledigt") return null;
    if (l.termin.status === "verpasst") return "erneut anrufen (Gespräch kam nicht zustande)";
    if (l.termin.status === "abgesagt") return "neu vereinbaren (Gespräch abgesagt)";
  }
  const letzter = l.anrufe.letzter?.ergebnis ?? null;
  if (!letzter) return "anrufen";
  if (letzter === "nicht_erreicht" || letzter === "mailbox") return "erneut anrufen";
  if (letzter === "erreicht_interesse") return "Termin bei Justin eintragen";
  return null;
}

function leadZeilen(l: UebersichtLead, jetzt: Date, mitAntworten: boolean): string[] {
  const kopf = [linksEntschaerfen(l.anzeige), l.temperatur && l.temperatur !== "offen" ? TEMPERATUR_WORT[l.temperatur] : null, mitAntworten ? l.antwortenKurz : null].filter(Boolean).join(" · ");
  const stand: string[] = [];
  stand.push(l.mail.status ? `${MAIL_WORT[l.mail.status] ?? `Mail: ${l.mail.status}`}${l.mail.status === "gesendet" && l.mail.am ? ` ${uhr(l.mail.am)}` : ""}` : "noch keine Mail von Justin");
  stand.push(l.anrufe.n
    ? `${l.anrufe.n === 1 ? "1 Anruf" : `${l.anrufe.n} Anrufe`}${l.anrufe.letzter ? `, zuletzt ${tagUhr(l.anrufe.letzter.am).slice(3)} ${ANRUF_ERGEBNIS_TEXT[l.anrufe.letzter.ergebnis] ?? l.anrufe.letzter.ergebnis}${l.anrufe.letzter.wer ? ` (${linksEntschaerfen(l.anrufe.letzter.wer.split(" ")[0])})` : ""}` : ""}`
    : "kein Anruf");
  if (l.termin) stand.push(`Termin ${tagUhr(l.termin.beginn)}${l.termin.bei ? ` bei ${linksEntschaerfen(l.termin.bei.split(" ")[0])}` : ""}${l.termin.status !== "gebucht" ? ` (${l.termin.status})` : ""}`);
  if (l.eskaliert) stand.push(l.eskaliert === "e120" ? "Zusage-Wächter" : l.eskaliert === "e60" ? "an dich nach 60 Min." : "Erinnerung nach 15 Min.");
  if (l.selbst) stand.push("Justin ruft selbst an");
  const offen = leadOffen(l, jetzt);
  return [`– ${kopf}`, `  ${stand.join(" · ")}`, `  ${offen ? `offen: ${offen}` : `Stand: ${ANFRAGE_STAND_WORT[l.stand] ?? l.stand}`}`];
}

/**
 * Die Übersicht 18:30 — an Justin (alles, mit KI-Kosten und Wächtern) oder ans Team (die Lead-Meldungen-Adresse: was
 * morgen zuerst dran ist). `leer` = nichts passiert und nichts offen → keine Mail (Mail-Müdigkeit, Plan-Risiko). Rein.
 */
export function uebersichtMail(d: UebersichtDaten, fuer: { art: "justin" } | { art: "team"; vorname: string }): TaktMail & { leer: boolean } {
  const z = berlinZeit(d.jetzt);
  const n = d.neu.length;
  const leer = n === 0 && d.offen.length === 0 && d.anrufe.eintraege === 0 && d.gespraeche.heute.length === 0 && d.termineGebucht === 0;
  const plural = (k: number, eins: string, viele: string) => `${k} ${k === 1 ? eins : viele}`;
  const betreff = `FIAON Global heute: ${plural(n, "Lead", "Leads")} · ${plural(d.termineGebucht, "Termin", "Termine")} · ${d.anrufe.leads} angerufen`;
  const t: string[] = [];
  t.push(`FIAON GLOBAL HEUTE · ${z.wochentag}, ${z.datum}`, "");
  t.push(`Hallo ${fuer.art === "justin" ? "Justin" : linksEntschaerfen(fuer.vorname)},`, "");
  const gefuehrt = d.gespraeche.heute.filter((g) => g.status === "erledigt").length;
  t.push(`heute: ${plural(n, "neuer Lead", "neue Leads")} · ${d.anrufe.leads} angerufen (${plural(d.anrufe.eintraege, "Anruf", "Anrufe")}) · ${plural(d.termineGebucht, "Termin gebucht", "Termine gebucht")}${d.gespraeche.heute.length ? ` · ${plural(d.gespraeche.heute.length, "Gespräch", "Gespräche")} bei Justin${gefuehrt ? ` (${gefuehrt} geführt)` : ""}` : ""}.`);
  const wartend = [...d.neu, ...d.offen].filter((l) => leadOffen(l, d.jetzt) === "anrufen").length;
  if (wartend) t.push(`Offen: ${plural(wartend, "Lead wartet", "Leads warten")} noch auf den ersten Anruf.`);
  if (d.privatWeg) t.push(`Dazu ${plural(d.privatWeg, "Privat-Anliegen", "Privat-Anliegen")} über das Global-Formular (Privat-Weg: Leitung bzw. Betreuung).`);
  t.push("");
  if (fuer.art === "team") {
    const zuerst = [...d.neu, ...d.offen].filter((l) => leadOffen(l, d.jetzt));
    t.push("MORGEN ZUERST");
    if (zuerst.length) for (const l of zuerst.slice(0, 15)) t.push(...leadZeilen(l, d.jetzt, false));
    else t.push("– nichts offen — stark.");
    t.push("");
    if (d.gespraeche.morgen.length) {
      t.push("MORGEN BEI JUSTIN");
      for (const g of d.gespraeche.morgen.slice(0, 8)) t.push(`– ${uhr(g.beginn)} ${linksEntschaerfen(g.anzeige)}${g.justinSeite ? " (/justin)" : ""}`);
      t.push("");
    }
    t.push("Bei „erreicht“ immer zwei, drei Sätze, was er erzählt hat — Justin liest das vor dem Gespräch.");
    return { betreff, text: t.join("\n"), knoepfe: [{ text: "Firmen-Cockpit öffnen", url: d.cockpitUrl }], links: [d.cockpitUrl], leer };
  }
  t.push("NEU HEUTE");
  if (n) for (const l of d.neu.slice(0, 20)) t.push(...leadZeilen(l, d.jetzt, true));
  else t.push("– kein neuer Lead");
  t.push("");
  if (d.offen.length) {
    t.push(`NOCH OFFEN (bis ${V.offenTage} Tage)`);
    for (const l of d.offen.slice(0, 12)) t.push(...leadZeilen(l, d.jetzt, false));
    if (d.offen.length > 12) t.push(`– und ${d.offen.length - 12} weitere im Firmen-Cockpit`);
    t.push("");
  }
  if (d.gespraeche.heute.length || d.gespraeche.morgen.length) {
    t.push("GESPRÄCHE BEI DIR");
    for (const g of d.gespraeche.heute.slice(0, 8)) t.push(`– heute ${uhr(g.beginn)} ${linksEntschaerfen(g.anzeige)}${g.justinSeite ? " (/justin)" : ""} (${g.status === "erledigt" ? "geführt" : g.status === "verpasst" ? "nicht zustande" : g.status === "gebucht" ? (g.beginn.getTime() > d.jetzt.getTime() ? "steht an" : "Ergebnis fehlt noch") : g.status})`);
    for (const g of d.gespraeche.morgen.slice(0, 8)) t.push(`– morgen ${uhr(g.beginn)} ${linksEntschaerfen(g.anzeige)}${g.justinSeite ? " (/justin)" : ""}`);
    t.push("");
  }
  t.push("DANIELS TAKT");
  t.push(`– Lead-Meldungen: ${d.takt.t1} · Erinnerung nach 15 Min.: ${d.takt.e15} · an dich nach 60 Min.: ${d.takt.e60} · Zusage-Wächter: ${d.takt.e120}`);
  if (d.takt.ersterAnrufMin != null) t.push(`– erster Anruf heute im Schnitt nach ${d.takt.ersterAnrufMin} Minuten (Dienstzeit)`);
  t.push("");
  t.push("NACHFASS HEUTE");
  t.push(`– N1: ${d.nachfass.n1} · N2: ${d.nachfass.n2} · N3: ${d.nachfass.n3} · gestoppt: ${d.nachfass.gestoppt}`);
  t.push("");
  t.push("KI-HINTERGRUND");
  t.push(`– heute ${d.ki.usd.toFixed(2).replace(".", ",")} $ von ${d.ki.deckelUsd.toFixed(0)} $ Tagesdeckel (${d.ki.an ? "an" : "aus"})`);
  if (d.waechter.length) {
    t.push("", "WÄCHTER (Lagezimmer)");
    for (const w of d.waechter.slice(0, 6)) t.push(`– ${linksEntschaerfen(w)}`);
  }
  return { betreff, text: t.join("\n"), knoepfe: [{ text: "Firmen-Cockpit öffnen", url: d.cockpitUrl }], links: [d.cockpitUrl], leer };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE WÄCHTER — Urteile (die Datenbank liefert die Zahlen)
// ═══════════════════════════════════════════════════════════════════════════
/** Kalender leer, während eine Global-Kampagne Geld ausgibt (gestern oder heute)? Rein. */
export function kalenderWaechter(ein: { tage: number; grund: string | null; person: string | null; ausgabenGesternCents: number; ausgabenHeuteCents: number }): { an: boolean; text: string } {
  const werbung = ein.ausgabenGesternCents > 0 || ein.ausgabenHeuteCents > 0;
  const euro = (c: number) => `${(c / 100).toFixed(2).replace(".", ",")} €`;
  const warum = ein.grund === "keine_zeiten" ? "es sind keine Zeitfenster gepflegt" : ein.grund === "keine_person" ? "niemand führt die Gespräche" : "alle Zeiten sind vergeben oder die Tagesdeckel erreicht";
  return {
    an: ein.tage === 0 && werbung,
    text: `Der Kalender auf fiaon.com zeigt keine freie Zeit (${warum}${ein.person ? `, Gespräche führt ${ein.person}` : ""}), während die Global-Werbung läuft (gestern ${euro(ein.ausgabenGesternCents)}, heute ${euro(ein.ausgabenHeuteCents)}). `
      + "Leads können nicht selbst buchen. Bitte Zeitfenster pflegen (Portal › Verfügbarkeit) oder die Deckel prüfen (Chefbüro › Rückholung › FIAON Global).",
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// E-487 (09.11.2026): DER ERGEBNIS-WÄCHTER „LEAD-KETTE“ — die reinen Urteile (die Zahlen liest fiaon-lead-takt.ts)
//
// Justin (09.11.2026): „ALLES, sodass jeder neue Lead auch ne Mail, WhatsApp und co bekommt — nichts darf still hängen“.
// Befund (Produktion nur gelesen): Vom 05.11. bis 09.11. ging keine einzige Willkommens-Mail hinaus, und kein Wächter schlug
// an — sie fragten, ob ein LAUF läuft („lead_post 2.558× erfolg“), nicht, ob beim LEAD etwas ankommt. Dieser Wächter misst
// das Ergebnis je Lead:
//   W-Lücke   rot   Anfrage ab dem Zählbeginn, älter als Ruhe + 20 Minuten, jünger als 3 Tage, mit Mail-Adresse, ohne Termin —
//                   und kein Willkommen „gesendet“ oder „ausgelassen“ (egal ob die Zeile fehlt, auf „fehler“ mit 0 Versuchen
//                   steht oder auf „wartet“).
//   N-Lücke   rot   Willkommen gesendet, kein Stopp, ein Nachfass seit 2 Dienststunden fällig — geprüft nur Mo–Fr 9–18 Uhr.
//   WhatsApp  rot   Ja zu WhatsApp (Website, Formular-Fassung 2, am Telefon), Handynummer, kein vergangenes Gespräch — nach
//                   30 Minuten im Fenster 8–20 Uhr noch keine WhatsApp (Begrüßung oder Terminnachricht) und keine von ihm,
//                   UND der Takt hat es nie versucht. E-490 F4: Für „Termin steht, aber keine Terminnachricht“ schaut der
//                   Wächter wie der Takt 60 Tage zurück (nur kommende Termine, nur mit Ja-Zeile) und zählt die 30 Minuten ab
//                   der Buchung, wenn sie nach Eingang und Ja liegt.
//             gelb  eine Ja-Zeile ohne Anfrage, obwohl es am selben Anschluss eine gibt · eine falsch gelesene Nummer (gleicher
//                   Anschluss, andere Landesvorwahl) · (E-490 F5) eine laufende Anzeige nutzt noch ein Global-Formular ohne
//                   WhatsApp-Satz — Meta gefragt, stündlich, mit dem Namen der Anzeige (vorher: „drei Meta-Leads in 24
//                   Stunden ohne WhatsApp-Satz“, nach jedem Formulartausch bis zu 24 Stunden Fehlalarm) · Takt aus ·
//                   (Nachbesserung) der Takt hat es versucht, und es scheiterte (Meta, Sperre) oder wartet (Bremse) · WhatsApp
//                   ist pausiert (die Pause hat ihren eigenen roten Alarm „wa-pause“).
//             —     (Nachbesserung, Gutachten 09.11.) bewusst ausgelassen wie im Takt (waAuslassGrund: STOPP, kein WhatsApp
//                   laut Meta 131026, Werbung abbestellt, Werbegrenze, schon ein Verlauf, zahlender Privatkunde) — kein Alarm.
//                   Vorher meldete der Wächter genau diese Fälle rot (drei Tage lang, alle 4 Stunden eine Mail), obwohl sie nie
//                   lösbar sind; mit Formular-Fassung 2 (jeder Meta-Lead mit Handynummer = Ja) wäre er praktisch dauerhaft rot.
// Rote Fälle bekommt Justin zusätzlich als kurze Mail (ketteMail): einmal je Fall, danach höchstens alle 4 Stunden.
// E-490 F2/F3 (09.11.2026): „je Fall“ heißt jetzt wirklich je FALL — der Merker führt die schon gemailten Anfrage-Nummern
// (ketteMailPlan). Vorher hing die Mail an der Episode des Alarms: Hielt eine gelbe Zeile sie offen, bekam ein NEUER roter Fall
// bis zu 4 Stunden keine Mail. Ein roter WhatsApp-Fall geht erst in die Mail, wenn er seit waBestaetigtMin rot ist (also auch
// im vorigen Wächterlauf) — ein Wächter, der mitten in den Versand des Takts las (09.11., 0,5 s vor dem Versand), mailt so nie.
// ═══════════════════════════════════════════════════════════════════════════
export const KETTE_VORGABE = {
  /** W: so viele Minuten nach der Ruhe (Vorgabe Ruhe 10 → 30 Minuten nach dem Eingang). */
  wNachRuheMin: 20,
  /** N: so viele Dienstminuten nach der Fälligkeit. */
  nDienstMin: 120,
  /** WhatsApp: so viele Minuten im Fenster 8–20 Uhr, gezählt ab 10 Minuten nach dem Eingang bzw. dem Ja (Termin: der Buchung). */
  waFensterMin: 30,
  /** Das WhatsApp-Fenster (Berlin, jeden Tag) — wie imVersandfenster. */
  waVon: 8, waBis: 20,
  /** Mail an Justin: höchstens so oft (Stunden) je Alarm für dieselben Fälle — ein NEUER Fall geht sofort (E-490 F2). */
  mailAlleStunden: 4,
  /** Nur Leads der letzten so vielen Tage (wie das Willkommen). E-490 F4: „Termin ohne Terminnachricht“ wie der Takt 60 Tage. */
  tage: 3,
  /** E-490 F4: so weit schaut der Wächter für „Termin steht, aber keine Terminnachricht“ zurück (wie der Takt, Schritte 2–5). */
  terminTage: 60,
  /**
   * E-490 F3: Ein roter WhatsApp-Fall geht erst in die Mail an Justin, wenn er seit so vielen Minuten ohne Unterbrechung rot
   * ist — der Wächter läuft alle 15 Minuten, also war er auch im vorigen Lauf rot. Zwei Läufe kurz hintereinander (beim
   * Deploy zwei Prozesse) bestätigen sich nicht gegenseitig.
   */
  waBestaetigtMin: 10,
  /** E-490 F2: höchstens so viele gemailte Fälle merkt sich der Merker je Alarm (die ältesten fallen heraus). */
  gemailtHoechstens: 200,
} as const;

export type KetteSchluessel = "lead-takt:w-luecke" | "lead-takt:n-luecke" | "lead-takt:wa-luecke";
export interface KetteAlarm {
  schluessel: KetteSchluessel;
  /** true = an, false = aus, null = jetzt keine Aussage (N außerhalb der Dienstzeit, Lesefehler) — der Stand bleibt. */
  an: boolean | null;
  stufe: "rot" | "gelb";
  titel: string;
  text: string;
  /** Die Anfrage-Nummern der ROTEN Fälle (für die Mail an Justin). */
  faelle: number[];
  vorbeiGrund: string;
}

/** Minuten im WhatsApp-Fenster (8–20 Uhr Berlin, jeden Tag) zwischen zwei Zeitpunkten, abgerundet. Höchstens 40 Tage. Rein. */
export function waFensterMinuten(von: Date, bis: Date): number {
  if (!(bis.getTime() > von.getTime())) return 0;
  let summe = 0;
  const ende = berlinZeit(bis).iso;
  let iso = berlinZeit(von).iso;
  for (let i = 0; i < 40 && iso <= ende; i++, iso = isoPlus(iso, 1)) {
    const a = Math.max(von.getTime(), berlinZeitpunkt(iso, KETTE_VORGABE.waVon * 60).getTime());
    const b = Math.min(bis.getTime(), berlinZeitpunkt(iso, KETTE_VORGABE.waBis * 60).getTime());
    if (b > a) summe += (b - a) / 60_000;
  }
  return Math.floor(summe);
}

/** Feiertage für den Nachfass: Deutschland immer, dazu das Land des Leads (wie feiertagFuer im Lead-Post). Rein. */
export function feiertagLand(land: unknown): (iso: string) => boolean {
  const l = versandLand(land);
  return (iso) => istFeiertag("DE", iso) || (l === "AT" && istFeiertag("AT", iso)) || (l === "CH" && istFeiertag("CH", iso));
}

const mehr = (n: number, eins: string, viele: string) => (n === 1 ? eins : `${n} ${viele}`);
const kurzGrund = (s: unknown) => linksEntschaerfen(String(s ?? "").replace(/\s+/g, " ").trim()).slice(0, 140);

// ── W ─────────────────────────────────────────────────────────────────────────
export interface KetteWZeile { anfrageId: number; eingangAm: Date; status: string | null; grund: string | null; versuche: number }

function wStandText(z: KetteWZeile): string {
  const grund = kurzGrund(z.grund);
  if (!z.status) return "noch kein Ergebnis — der Lauf lead_post hat sie nicht geschickt (Gmail gestört, Tagesdeckel oder der Lauf steht)";
  if (z.status === "fehler") return `gescheitert (${z.versuche} von 3 Versuchen${grund ? `: ${grund}` : ""})`;
  if (z.status === "wartet") return `wartet${grund ? ` (${grund})` : ""}`;
  if (z.status === "laeuft" || z.status === "unklar") return "hängt im Versand — der Gesendet-Abgleich entscheidet";
  return `${z.status}${grund ? ` (${grund})` : ""}`;
}

/** W-Lücke: welche Anfragen haben nach Ruhe + 20 Minuten noch kein Willkommen „gesendet“ oder „ausgelassen“? Rein. */
export function wLueckeUrteil(zeilen: readonly KetteWZeile[], jetzt: Date, e: { an: boolean; ruheMin: number }): KetteAlarm {
  const schluessel = "lead-takt:w-luecke" as const;
  if (!e.an) return { schluessel, an: false, stufe: "rot", titel: "Lead-Kette: Willkommens-Mail", text: "", faelle: [], vorbeiGrund: "Lead-Mails sind ausgeschaltet" };
  const grenze = (e.ruheMin + KETTE_VORGABE.wNachRuheMin) * 60_000;
  const offen = zeilen.filter((z) => {
    const alter = jetzt.getTime() - z.eingangAm.getTime();
    return !["gesendet", "ausgelassen"].includes(String(z.status ?? "")) && alter >= grenze && alter < KETTE_VORGABE.tage * 86_400_000;
  });
  const zeilenText = offen.slice(0, 10).map((z) => `Anfrage #${z.anfrageId} (Eingang ${tagUhr(z.eingangAm)}): ${wStandText(z)}`);
  return {
    schluessel, an: offen.length > 0, stufe: "rot", faelle: offen.map((z) => z.anfrageId),
    titel: `Lead-Kette: ${mehr(offen.length, "eine Anfrage", "Anfragen")} ohne Willkommens-Mail`,
    text: [...zeilenText, offen.length > 10 ? `… und ${offen.length - 10} weitere.` : null,
      "Daniels Anruf-Aufträge stehen trotzdem. Den Grund je Anfrage zeigt der Lead-Motor (Karte „Lead-Mails“)."].filter(Boolean).join("\n"),
    vorbeiGrund: "jede Anfrage hat ihr Willkommen (gesendet oder bewusst ausgelassen)",
  };
}

// ── N ─────────────────────────────────────────────────────────────────────────
export interface KetteNZeile { anfrageId: number; faellig: Date; stufe: number; land: string | null }

/** N-Lücke: ein Nachfass seit 2 Dienststunden fällig, aber nicht gesendet. Außerhalb Mo–Fr 9–18 Uhr keine Aussage. Rein. */
export function nLueckeUrteil(zeilen: readonly KetteNZeile[], jetzt: Date, e: { an: boolean }, feiertag: (iso: string) => boolean = feiertagDE): KetteAlarm {
  const schluessel = "lead-takt:n-luecke" as const;
  const basis = { schluessel, stufe: "rot" as const, titel: "Lead-Kette: Nachfass-Mail", text: "", faelle: [] as number[] };
  if (!e.an) return { ...basis, an: false, vorbeiGrund: "Nachfass ist ausgeschaltet" };
  if (!imDienst(jetzt, feiertag)) return { ...basis, an: null, vorbeiGrund: "" };
  const offen = zeilen.filter((z) => z.stufe < 3 && dienstMinuten(z.faellig, jetzt, feiertagLand(z.land)) >= KETTE_VORGABE.nDienstMin);
  return {
    ...basis, an: offen.length > 0, faelle: offen.map((z) => z.anfrageId),
    titel: `Lead-Kette: ${mehr(offen.length, "eine Nachfass-Mail", "Nachfass-Mails")} seit über 2 Dienststunden fällig`,
    text: [...offen.slice(0, 10).map((z) => `Anfrage #${z.anfrageId}: N${Math.min(3, z.stufe + 1)} fällig seit ${tagUhr(z.faellig)}`),
      offen.length > 10 ? `… und ${offen.length - 10} weitere.` : null,
      "Der Lauf lead_nachfass (alle 10 Minuten, Mo–Fr 9–18 Uhr) hat sie nicht geschickt — bitte im Lead-Motor nachsehen."].filter(Boolean).join("\n"),
    vorbeiGrund: "kein fälliger Nachfass hängt mehr",
  };
}

// ── WhatsApp ──────────────────────────────────────────────────────────────────
export interface KetteWaZeile {
  anfrageId: number; eingangAm: Date;
  /** Stand der Anfrage (neu, in_arbeit, termin …). */
  status: string;
  /** Die WhatsApp-Nummer der Anfrage (Handy) — null = Festnetz oder keine. */
  nummer: string | null;
  /** Woher das Ja kommt (website, formular, telefon:<Name> …) — null = kein Ja. */
  ja: string | null;
  /** Seit wann das Ja gilt (ein Formular-Ja: der Eingang). */
  jaSeit: Date | null;
  /** Ein kommendes Gespräch (dann ist die Terminnachricht fällig) bzw. ein schon vergangenes (dann nichts mehr). */
  terminKommend: boolean; terminVorbei: boolean;
  /**
   * E-490 F4: Wann das kommende Gespräch gebucht wurde. Liegt die Buchung nach Eingang und Ja (z. B. ein altes Ja, heute
   * gebucht), zählen die 30 Fensterminuten erst ab ihr — sonst wäre eine frische Buchung sofort „rot“, bevor der Takt sie sah.
   */
  terminSeit?: Date | null;
  /** Ging an ihn schon eine WhatsApp (Begrüßung, Terminnachricht), die nicht scheiterte — oder schrieb er selbst? */
  kontakt: boolean;
  /**
   * Was zuletzt scheiterte: „fehler: …“ aus willkommen_status (Begrüßung) oder Metas Fehler an der letzten WhatsApp an ihn
   * seit der Anfrage — auch nachträglich vom Status-Webhook (Meta nahm an, stellte nicht zu). Sonst null.
   */
  begruessungFehler: string | null;
  /**
   * E-487 Nachbesserung (Gutachten): Hat der Takt es schon versucht? Begrüßung verbucht (willkommen_am — gesendet oder
   * gescheitert, auch zu einer früheren Anfrage derselben Nummer) bzw. die Terminnachricht zu GENAU diesem Termin
   * (termin_gemeldet_id). Fehlt = nein.
   */
  versucht?: boolean;
  /** E-487 Nachbesserung: Die Begrüßung wartet („wartet: …“ — die Bremse hielt an, der Takt versucht es wieder). Sonst null. */
  wartet?: string | null;
  /**
   * E-487 Nachbesserung: Warum der Takt bewusst nichts schickt — derselbe Grund wie im Takt (waAuslassGrund: STOPP, laut Meta
   * kein WhatsApp, Werbung abbestellt, Werbegrenze, schon ein Verlauf, zahlender Privatkunde). Dann gibt es keinen Alarm.
   */
  ausgelassen?: string | null;
}
export interface KetteJaOhneAnfrage { nummer: string; anfrageId: number; seit: Date }
export interface KetteNummerFalsch { anfrageId: number; schluessel: string; erwartet: string }

/**
 * Erwartet der Takt bei dieser Anfrage jetzt eine WhatsApp (Begrüßung oder Terminnachricht)? Bewusst ausgelassen = nein.
 * Gezählt ab dem Späteren von Eingang und Ja — beim kommenden Termin (E-490 F4) auch ab seiner Buchung. Rein.
 */
export function waErwartet(z: KetteWaZeile, jetzt: Date): boolean {
  if (!z.ja || !z.nummer || z.kontakt || z.ausgelassen) return false;
  if (!z.terminKommend && (z.terminVorbei || z.status === "termin")) return false;
  const gebucht = z.terminKommend && z.terminSeit && Number.isFinite(z.terminSeit.getTime()) ? z.terminSeit.getTime() : 0;
  const ab = new Date(Math.max(z.eingangAm.getTime(), (z.jaSeit ?? z.eingangAm).getTime(), gebucht) + 10 * 60_000);
  return waFensterMinuten(ab, jetzt) >= KETTE_VORGABE.waFensterMin;
}

/**
 * E-487 Nachbesserung (Gutachten, 09.11.2026): Wie wird ein erwarteter Fall gemeldet? ROT nur, wenn der Takt es nie versucht
 * hat (dann hängt wirklich etwas). GELB, ohne Mail: der Takt hat es versucht, und es scheiterte (Meta, Sperre) — ein neuer
 * Versuch kommt nicht —, oder die Begrüßung wartet auf das Ende der Bremse. null: versucht, kein Fehler bekannt (z. B. die
 * Begrüßung ging schon zu einer früheren Anfrage derselben Nummer hinaus) — nichts zu melden. Rein.
 */
export function waFallStufe(z: KetteWaZeile): "rot" | "gelb" | null {
  if (z.wartet) return "gelb";
  if (!z.versucht) return "rot";
  return z.begruessungFehler ? "gelb" : null;
}

const waGrund = (s: unknown) => kurzGrund(String(s ?? "").replace(/^(fehler|wartet):\s*/i, "")).slice(0, 100) || "ohne Angabe";

/**
 * WhatsApp-Lücke: rot (Ja, aber keine WhatsApp, und der Takt hat es nie versucht), gelb (gescheitert oder wartend, WhatsApp
 * pausiert, Zuordnung, Nummer, eine laufende Anzeige mit der alten Formular-Fassung, Takt aus). Bewusst Ausgelassenes meldet
 * sie nicht. Rein.
 */
export function waLueckeUrteil(ein: {
  /** Mara Business UND der WhatsApp-Takt sind an. */
  an: boolean;
  /**
   * E-487 Nachbesserung: WhatsApp ist pausiert (Notbremse, fiaon-wa-bremse.ts) — die Pause hat ihren eigenen roten Alarm
   * „wa-pause“; wartende Leads stehen hier dann gelb (keine zweite Mail an Justin).
   */
  pausiert?: boolean;
  zeilen: readonly KetteWaZeile[]; ohneAnfrage: readonly KetteJaOhneAnfrage[]; falsch: readonly KetteNummerFalsch[];
  /**
   * E-490 F5: die laufenden Anzeigen, die noch ein Global-Formular OHNE WhatsApp-Satz nutzen (Meta gefragt, stündlich —
   * alteFassungInAnzeigen in fiaon-meta-leads.ts). null = keine Aussage (Meta-Fehler, kein Werbekonto) → nichts gemeldet.
   */
  alteFassung: readonly { anzeige: string; formular: string }[] | null;
}, jetzt: Date): KetteAlarm {
  const schluessel = "lead-takt:wa-luecke" as const;
  const warten = ein.zeilen.filter((z) => waErwartet(z, jetzt));
  const offen = warten.filter((z) => waFallStufe(z) === "rot");
  const gescheitert = warten.filter((z) => waFallStufe(z) === "gelb");
  const rot = ein.an && !ein.pausiert ? offen : [];
  const zeilen: string[] = rot.slice(0, 10).map((z) => `Anfrage #${z.anfrageId} (Ja: ${kurzGrund(z.ja).slice(0, 60)}): ${z.terminKommend
    ? "Termin steht, aber keine Terminnachricht auf WhatsApp" : "noch keine WhatsApp-Begrüßung"}${z.begruessungFehler ? ` (zuletzt gescheitert: ${waGrund(z.begruessungFehler)})` : ""}`);
  if (rot.length > 10) zeilen.push(`… und ${rot.length - 10} weitere.`);
  const gelb: string[] = [];
  if (!ein.an && warten.length) gelb.push(`Mara Business oder der WhatsApp-Takt ist aus — ${mehr(warten.length, "ein Lead", "Leads")} mit Ja zu WhatsApp bekommt keine Nachricht.`);
  if (ein.an && ein.pausiert && offen.length) {
    gelb.push(`WhatsApp ist pausiert (eigener Alarm im Lagezimmer) — ${mehr(offen.length, "ein Lead", "Leads")} mit Ja zu WhatsApp ${offen.length === 1 ? "wartet" : "warten"} auf die Nachricht; der Takt schickt sie nach dem Aktivieren.`);
  }
  if (ein.an) {
    for (const z of gescheitert.slice(0, 5)) {
      gelb.push(`Anfrage #${z.anfrageId} (Ja: ${kurzGrund(z.ja).slice(0, 60)}): ${z.wartet
        ? `Begrüßung wartet (${waGrund(z.wartet)}) — der Takt versucht es wieder.`
        : `${z.terminKommend ? "Terminnachricht" : "Begrüßung"} gescheitert (${waGrund(z.begruessungFehler)}) — kein neuer Versuch; Mail und Anruf laufen weiter.`}`);
    }
    if (gescheitert.length > 5) gelb.push(`… und ${gescheitert.length - 5} weitere gescheiterte oder wartende WhatsApp.`);
  }
  const alt = ein.ohneAnfrage.filter((o) => jetzt.getTime() - o.seit.getTime() >= 30 * 60_000);
  for (const o of alt.slice(0, 5)) gelb.push(`Ja zu WhatsApp (Nummer …${o.nummer.slice(-4)}) ohne Anfrage, obwohl Anfrage #${o.anfrageId} denselben Anschluss hat — der Takt verknüpft sie nicht.`);
  for (const f of ein.falsch.slice(0, 5)) gelb.push(`Anfrage #${f.anfrageId}: eine Nummer ist falsch gelesen (+${f.schluessel.slice(0, 2)}… statt +${f.erwartet.slice(0, 2)}…, derselbe Anschluss …${f.schluessel.slice(-4)}) — bitte im Lead-Motor prüfen.`);
  // E-490 F5: Meta selbst sagt, welche laufende Anzeige noch die alte Fassung nutzt — mit dem Namen der Anzeige.
  const alteFassung = ein.alteFassung ?? [];
  for (const a of alteFassung.slice(0, 5)) {
    gelb.push(`Die Anzeige „${kurzGrund(a.anzeige).slice(0, 90)}“ läuft noch mit dem Formular „${kurzGrund(a.formular).slice(0, 90)}“ OHNE WhatsApp-Satz (alte Fassung) — bitte im Werbeanzeigenmanager auf die Fassung 2 tauschen.`);
  }
  if (alteFassung.length > 5) gelb.push(`… und ${alteFassung.length - 5} weitere Anzeigen mit der alten Formular-Fassung.`);
  const n = rot.length;
  const titel = n
    ? `Lead-Kette: ${mehr(n, "ein Lead", "Leads")} mit Ja zu WhatsApp ohne WhatsApp`
    : gelb.length ? "Lead-Kette: WhatsApp — bitte prüfen" : "Lead-Kette: WhatsApp";
  return {
    schluessel, an: n > 0 || gelb.length > 0, stufe: n ? "rot" : "gelb", faelle: rot.map((z) => z.anfrageId), titel,
    text: [...zeilen,
      ...(n ? ["Die Begrüßung bzw. Terminnachricht schickt der Takt wa_global_takt (8–20 Uhr, nur freigegebene Vorlagen). Bitte im Lead-Motor (Karte „Mara Business“) nachsehen."] : []),
      ...(n && gelb.length ? [""] : []), ...gelb].join("\n"),
    vorbeiGrund: "jeder Lead mit Ja zu WhatsApp hat seine Nachricht",
  };
}

// ── Die Mail an Justin ────────────────────────────────────────────────────────
/** Kommt jetzt eine Mail an Justin? Ein neuer Fall → ja; sonst höchstens alle 4 Stunden, solange der Alarm rot ist. Rein. */
export function ketteMailFaellig(ein: { neu: boolean; letzte: Date | null; jetzt: Date }): boolean {
  if (ein.neu || !ein.letzte) return true;
  return ein.jetzt.getTime() - ein.letzte.getTime() >= KETTE_VORGABE.mailAlleStunden * 3_600_000;
}

/**
 * E-490 F2/F3 (09.11.2026): der Merker der Mail an Justin je Alarm (fiaon_settings „lead_kette_mail:<schlüssel>“, JSON).
 *   am       wann zuletzt eine Mail zu diesem Alarm ging (null = noch keine, seit er zuletzt aus war)
 *   gemailt  die Fälle (Anfrage-Nummern), die schon in einer Mail standen — null = unbekannt (der Merker aus E-487 trug nur
 *            die Zeit; dann gelten die jetzt roten Fälle als gemailt: keine Doppelmail gleich nach dem Deploy)
 *   rotSeit  seit wann ein Fall ohne Unterbrechung rot ist (Anfrage-Nummer → Zeitpunkt des ersten roten Wächterlaufs)
 */
export interface KetteMerker { am: Date | null; gemailt: number[] | null; rotSeit: Record<string, string> }

const nummernListe = (v: unknown): number[] =>
  Array.from(new Set((Array.isArray(v) ? v : []).map((x) => Number(x)).filter((x) => Number.isInteger(x) && x > 0)));

/** Den Merker lesen: leer → leer; nur eine Zeit (E-487) → gemailt unbekannt; JSON → geprüft; Unsinn → leer. Rein. */
export function ketteMerkerLesen(roh: unknown): KetteMerker {
  const leer: KetteMerker = { am: null, gemailt: [], rotSeit: {} };
  const s = String(roh ?? "").trim();
  if (!s) return leer;
  if (!s.startsWith("{")) {
    const t = Date.parse(s);
    return Number.isFinite(t) ? { am: new Date(t), gemailt: null, rotSeit: {} } : leer;
  }
  try {
    const o = JSON.parse(s);
    const t = Date.parse(String(o?.am ?? ""));
    const rotSeit: Record<string, string> = {};
    for (const [k, v] of Object.entries(o?.rotSeit && typeof o.rotSeit === "object" ? o.rotSeit : {})) {
      if (/^\d{1,12}$/.test(k) && Number.isFinite(Date.parse(String(v)))) rotSeit[k] = new Date(Date.parse(String(v))).toISOString();
    }
    return { am: Number.isFinite(t) ? new Date(t) : null, gemailt: nummernListe(o?.gemailt), rotSeit };
  } catch { return leer; }
}

/** Den Merker schreiben — leer (keine Mail, nichts gemailt, nichts rot) als „“, sonst JSON. Rein. */
export function ketteMerkerText(m: KetteMerker): string {
  const gemailt = m.gemailt ?? [];
  if (!m.am && !gemailt.length && !Object.keys(m.rotSeit).length) return "";
  return JSON.stringify({ am: m.am ? m.am.toISOString() : null, gemailt, rotSeit: m.rotSeit });
}

export interface KettePlan {
  /** Geht jetzt eine Mail zu diesem Alarm? */
  mailen: boolean;
  /** Die roten Fälle, die noch in keiner Mail standen (und bestätigt sind). */
  neueFaelle: number[];
  /** Der neue Merker — mit der Mail (am, gemailt) bzw. ohne. */
  merker: KetteMerker;
  /** Der Merker, falls der Versand scheitert: rotSeit aktuell, am/gemailt wie vorher (der nächste Lauf versucht es wieder). */
  merkerOhneMail: KetteMerker;
}

/**
 * E-490 F2/F3: Geht jetzt eine Mail an Justin — und wie sieht der Merker danach aus? Rein.
 *   · Rot sind nur die Fälle eines roten Alarms (alarm.faelle). Ein gelber oder abgeschalteter Alarm mailt nie.
 *   · WhatsApp (wa-luecke): ein Fall ist erst bestätigt, wenn er seit waBestaetigtMin rot ist (auch im vorigen Wächterlauf).
 *     W und N gelten sofort.
 *   · Ein bestätigter Fall, der noch in keiner Mail stand → sofort eine Mail — auch wenn eine gelbe Zeile die Episode offen
 *     hielt (vorher bis zu 4 Stunden keine). Dieselben Fälle → höchstens alle mailAlleStunden.
 *   · `neu` (eine neue Episode des Alarms) → der alte Merker gilt nicht (auch wenn ihn niemand geleert hat).
 *   · In die Liste „gemailt“ kommen alle roten Fälle, die in der Mail stehen (der Text nennt sie alle) — ein WhatsApp-Fall, der
 *     erst im nächsten Lauf bestätigt wäre, löst so keine zweite Mail eine Viertelstunde später aus.
 */
export function ketteMailPlan(ein: { alarm: KetteAlarm; merker: KetteMerker; neu: boolean; jetzt: Date }): KettePlan {
  const jetztMs = ein.jetzt.getTime();
  const rot = ein.alarm.an === true && ein.alarm.stufe === "rot" ? Array.from(new Set(ein.alarm.faelle)) : [];
  const vorher: Record<string, string> = ein.neu ? {} : ein.merker.rotSeit;
  const rotSeit: Record<string, string> = {};
  for (const f of rot) rotSeit[String(f)] = vorher[String(f)] ?? ein.jetzt.toISOString();
  const bestaetigt = ein.alarm.schluessel === "lead-takt:wa-luecke"
    ? rot.filter((f) => jetztMs - Date.parse(rotSeit[String(f)]) >= KETTE_VORGABE.waBestaetigtMin * 60_000)
    : rot;
  const am = ein.neu ? null : ein.merker.am;
  const gemailt = ein.neu ? [] : (ein.merker.gemailt ?? rot);
  const neueFaelle = bestaetigt.filter((f) => !gemailt.includes(f));
  const mailen = bestaetigt.length > 0 && ketteMailFaellig({ neu: neueFaelle.length > 0, letzte: am, jetzt: ein.jetzt });
  const merkerOhneMail: KetteMerker = { am, gemailt, rotSeit };
  const merker: KetteMerker = mailen
    ? { am: ein.jetzt, gemailt: Array.from(new Set([...gemailt, ...rot])).slice(-KETTE_VORGABE.gemailtHoechstens), rotSeit }
    : merkerOhneMail;
  return { mailen, neueFaelle, merker, merkerOhneMail };
}

const KETTE_KURZ: Readonly<Record<KetteSchluessel, string>> = {
  "lead-takt:w-luecke": "Willkommens-Mail hängt", "lead-takt:n-luecke": "Nachfass hängt", "lead-takt:wa-luecke": "WhatsApp hängt",
};

/** Die kurze Mail an Justin zu den roten Alarmen der Lead-Kette (du-Form, nur Anfrage-Nummern, ein Knopf). Rein. */
export function ketteMail(alarme: readonly KetteAlarm[], leadMotorUrl: string): TaktMail {
  const faelle = Array.from(new Set(alarme.flatMap((a) => a.faelle))).sort((a, b) => a - b);
  const was = alarme.map((a) => KETTE_KURZ[a.schluessel]).join(" · ");
  const t: string[] = [];
  t.push(`LEAD-KETTE ROT: ${was}`, "");
  t.push("Hallo Justin,", "");
  t.push(`bei ${faelle.length === 1 ? "diesem Lead" : "diesen Leads"} kommt gerade nichts an, obwohl es sollte:`, "");
  for (const a of alarme) t.push(linksEntschaerfen(a.titel).replace(/^Lead-Kette:\s*/, "").toUpperCase(), linksEntschaerfen(a.text), "");
  t.push(`Diese Mail kommt einmal je Fall und danach höchstens alle ${KETTE_VORGABE.mailAlleStunden} Stunden, solange es rot ist. Ist es gelöst, geht der Alarm von selbst aus.`);
  return {
    betreff: `Lead-Kette rot: ${was}${faelle.length ? ` (${faelle.slice(0, 6).map((f) => `#${f}`).join(", ")}${faelle.length > 6 ? " …" : ""})` : ""}`.slice(0, 150),
    text: t.join("\n"), knoepfe: [{ text: "Lead-Motor öffnen", url: leadMotorUrl }], links: [leadMotorUrl],
  };
}
