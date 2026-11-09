// ═══════════════════════════════════════════════════════════════════════════
// DATENRAUM FÜR INVESTOREN — DIE BÜHNE JE PROJEKT (E-489 · Raumtour, 09.11.2026)
//
// Justin: „stelle alles PERFEKT dar … aber perfekt, cinematisch — einfach HIGH END — er soll durch die Räume
// geführt werden wie bei einer 3D-Tour."
//
// Nach der Unterschrift führt die Raumtour (client/src/components/datenraum/Raumtour.tsx) den Gast Raum für Raum
// durch die Projekte. Was ein Raum zeigt, ist die BÜHNE des Projekts: reine Daten in der Spalte
// fiaon_dr_projekte.buehne (JSONB), befüllt über scripts/datenraum.ts raum-anlegen (projekte[].buehne).
// Zahlen, Sätze und Kurven stehen NUR in der Datenbank — das Repo ist öffentlich.
//
// Diese Datei rechnet ohne Datenbank und ohne Netz (Seite, Server, Skript und Prüfstand lesen dieselbe Fassung):
//   · das Schema der Bühne und seine Prüfung (drBuehnePruefen) — streng, damit ein Tippfehler auffällt, bevor
//     ein Investor ihn sieht;
//   · die Prüfung einer Anfrage aus dem Raum (Vertragsentwurf anfordern, Frage stellen).
// Wer eine Bühne sehen darf, entscheidet der Server mit DERSELBEN Regel wie für Dokumente
// (server/lib/fiaon-datenraum-tour-regeln.ts): erst nach der Vereinbarung, nur für Themen, die sie nennt.
//
// ── DAS SCHEMA (alles reiner Text ohne HTML; Werte als fertig formatierter Text) ──
//   {
//     "hauptprojekt": true,                        optional — zuerst und am größten, mit Abschluss-Knopf
//     "kicker": "…",                               Augenzeile über dem großen Satz (höchstens 60 Zeichen)
//     "claim": "…",                                der große Satz des Raums (Pflicht, höchstens 140)
//     "untertitel": "…",                           ein, zwei Sätze darunter (höchstens 320)
//     "kennzahlen": [{ "wert": "…", "label": "…", "hinweis": "…" }],                  0 bis 6 Kacheln
//     "kurve": { "titel": "…", "einheit": "…", "fussnote": "…",
//                "reihen": [{ "name": "…", "punkte": [{ "x": 2027, "y": 1.5 }] }] },      1–3 Reihen, je 2–24 Punkte
//     "kapitel": [{ "titel": "…", "text": "…", "dokumente": [1, 3] }],                0 bis 8; Dokumente = Nummer (nr)
//                                                                                      der Unterlage im Projekt
//     "abschluss": { "knopf": "…", "satz": "…" },   optional — Text des Abschluss-Knopfs und der Satz darunter
//     "hinweis": "…"                               optional — Kleingedrucktes am Ende des Raums
//   }
// ═══════════════════════════════════════════════════════════════════════════
import { mehrzeilig, zeile } from "./fiaon-partner-crm";

export interface DrBuehneKennzahl { wert: string; label: string; hinweis?: string }
export interface DrBuehnePunkt { x: string | number; y: number }
export interface DrBuehneReihe { name: string; punkte: DrBuehnePunkt[] }
export interface DrBuehneKurve { titel: string; einheit: string; reihen: DrBuehneReihe[]; fussnote: string }
export interface DrBuehneKapitel { titel: string; text: string; dokumente?: number[] }
export interface DrBuehneAbschluss { knopf?: string; satz?: string }
export interface DrBuehne {
  hauptprojekt?: boolean;
  kicker: string;
  claim: string;
  untertitel: string;
  kennzahlen: DrBuehneKennzahl[];
  kurve?: DrBuehneKurve;
  kapitel: DrBuehneKapitel[];
  abschluss?: DrBuehneAbschluss;
  hinweis?: string;
}

/** Grenzen — so, dass jeder Raum auf einem Telefon (375 px) ruhig bleibt. */
export const DR_BUEHNE_MAX = {
  kicker: 60, claim: 140, untertitel: 320,
  kennzahlen: 6, wert: 24, label: 60, kennzahlHinweis: 140,
  kurveTitel: 90, einheit: 20, fussnote: 300, reihen: 3, reiheName: 40, punkteMin: 2, punkteMax: 24, x: 14,
  kapitel: 8, kapitelTitel: 90, kapitelText: 1200, dokumente: 12,
  knopf: 40, satz: 200, hinweis: 500,
} as const;

/** Feste Texte der Tour, die auch der Server kennt. */
export const DR_TOUR_TEXTE = {
  abschlussKnopf: "Vertragsentwurf anfordern",
} as const;

const FELDER = new Set(["hauptprojekt", "kicker", "claim", "untertitel", "kennzahlen", "kurve", "kapitel", "abschluss", "hinweis"]);

export type DrBuehnePruefung =
  | { ok: true; wert: DrBuehne | null; warnungen: string[] }
  | { ok: false; fehler: string[]; warnungen: string[] };

/**
 * Prüft und säubert eine Bühne. null, undefined oder "" = keine Bühne (der Raum zeigt dann Titel, Beschreibung und
 * Unterlagen des Projekts). Ein JSON-Text wird gelesen (auch doppelt verpackt, wie jsonb manchmal kommt).
 * Fehler (zu lang, falscher Typ, fehlt) halten an; unbekannte Felder sind nur Warnungen.
 */
export function drBuehnePruefen(roh: unknown): DrBuehnePruefung {
  if (roh === null || roh === undefined || roh === "") return { ok: true, wert: null, warnungen: [] };
  let v: unknown = roh;
  if (typeof v === "string") {
    try { v = JSON.parse(v); if (typeof v === "string") v = JSON.parse(v); } catch { return { ok: false, fehler: ["Die Bühne ist kein gültiges JSON."], warnungen: [] }; }
    if (v === null) return { ok: true, wert: null, warnungen: [] };
  }
  if (!v || typeof v !== "object" || Array.isArray(v)) return { ok: false, fehler: ["Die Bühne muss ein Objekt sein ({ … })."], warnungen: [] };
  const o = v as Record<string, unknown>;
  const fehler: string[] = [];
  const warnungen: string[] = [];
  for (const k of Object.keys(o)) if (!FELDER.has(k)) warnungen.push(`Unbekanntes Feld „${k}“ — wird nicht gezeigt.`);

  const text = (w: unknown, pfad: string, max: number, pflicht: boolean, mehr = false): string => {
    if (w === undefined || w === null || w === "") { if (pflicht) fehler.push(`${pfad}: fehlt.`); return ""; }
    if (typeof w !== "string") { fehler.push(`${pfad}: muss Text sein.`); return ""; }
    const s = mehr ? mehrzeilig(w, 100_000) : zeile(w, 100_000);
    if (pflicht && !s) fehler.push(`${pfad}: fehlt.`);
    if (s.length > max) fehler.push(`${pfad}: höchstens ${max} Zeichen (jetzt ${s.length}).`);
    return s;
  };
  const liste = (w: unknown, pfad: string, max: number, min = 0): unknown[] => {
    if (w === undefined || w === null) { if (min > 0) fehler.push(`${pfad}: fehlt.`); return []; }
    if (!Array.isArray(w)) { fehler.push(`${pfad}: muss eine Liste sein ([ … ]).`); return []; }
    if (w.length > max) fehler.push(`${pfad}: höchstens ${max} Einträge (jetzt ${w.length}).`);
    if (w.length < min) fehler.push(`${pfad}: mindestens ${min} Einträge (jetzt ${w.length}).`);
    return w.slice(0, max);
  };
  const objekt = (w: unknown, pfad: string): Record<string, unknown> | null => {
    if (!w || typeof w !== "object" || Array.isArray(w)) { fehler.push(`${pfad}: muss ein Objekt sein ({ … }).`); return null; }
    return w as Record<string, unknown>;
  };

  if (o.hauptprojekt !== undefined && typeof o.hauptprojekt !== "boolean") fehler.push("hauptprojekt: true oder false.");
  const kicker = text(o.kicker, "kicker", DR_BUEHNE_MAX.kicker, false);
  const claim = text(o.claim, "claim", DR_BUEHNE_MAX.claim, true);
  const untertitel = text(o.untertitel, "untertitel", DR_BUEHNE_MAX.untertitel, false, true);

  const kennzahlen: DrBuehneKennzahl[] = [];
  liste(o.kennzahlen, "kennzahlen", DR_BUEHNE_MAX.kennzahlen).forEach((k, i) => {
    const x = objekt(k, `kennzahlen[${i + 1}]`); if (!x) return;
    const wert = text(x.wert, `kennzahlen[${i + 1}].wert`, DR_BUEHNE_MAX.wert, true);
    const label = text(x.label, `kennzahlen[${i + 1}].label`, DR_BUEHNE_MAX.label, true);
    const hinweis = text(x.hinweis, `kennzahlen[${i + 1}].hinweis`, DR_BUEHNE_MAX.kennzahlHinweis, false);
    kennzahlen.push({ wert, label, ...(hinweis ? { hinweis } : {}) });
  });

  let kurve: DrBuehneKurve | undefined;
  if (o.kurve !== undefined && o.kurve !== null) {
    const k = objekt(o.kurve, "kurve");
    if (k) {
      const titel = text(k.titel, "kurve.titel", DR_BUEHNE_MAX.kurveTitel, true);
      const einheit = text(k.einheit, "kurve.einheit", DR_BUEHNE_MAX.einheit, false);
      const fussnote = text(k.fussnote, "kurve.fussnote", DR_BUEHNE_MAX.fussnote, false, true);
      const arten = new Set<"zahl" | "text">();
      const reihen: DrBuehneReihe[] = [];
      liste(k.reihen, "kurve.reihen", DR_BUEHNE_MAX.reihen, 1).forEach((r, i) => {
        const pfad = `kurve.reihen[${i + 1}]`;
        const ro = objekt(r, pfad); if (!ro) return;
        const name = text(ro.name, `${pfad}.name`, DR_BUEHNE_MAX.reiheName, true);
        const punkte: DrBuehnePunkt[] = [];
        const gesehen = new Set<string>();
        liste(ro.punkte, `${pfad}.punkte`, DR_BUEHNE_MAX.punkteMax, DR_BUEHNE_MAX.punkteMin).forEach((p, j) => {
          const pp = objekt(p, `${pfad}.punkte[${j + 1}]`); if (!pp) return;
          let x: string | number;
          if (typeof pp.x === "number" && Number.isFinite(pp.x)) { x = pp.x; arten.add("zahl"); }
          else if (typeof pp.x === "string" && zeile(pp.x, 100).length > 0) {
            x = zeile(pp.x, 100); arten.add("text");
            if (x.length > DR_BUEHNE_MAX.x) fehler.push(`${pfad}.punkte[${j + 1}].x: höchstens ${DR_BUEHNE_MAX.x} Zeichen.`);
          } else { fehler.push(`${pfad}.punkte[${j + 1}].x: Zahl (z. B. ein Jahr) oder kurzer Text.`); return; }
          if (typeof pp.y !== "number" || !Number.isFinite(pp.y)) { fehler.push(`${pfad}.punkte[${j + 1}].y: muss eine Zahl sein.`); return; }
          const schluessel = String(x);
          if (gesehen.has(schluessel)) fehler.push(`${pfad}.punkte: x „${schluessel}“ steht doppelt.`);
          gesehen.add(schluessel);
          punkte.push({ x, y: pp.y });
        });
        reihen.push({ name, punkte });
      });
      if (arten.size > 1) fehler.push("kurve: x entweder überall Zahlen (z. B. Jahre) oder überall Text.");
      kurve = { titel, einheit, reihen, fussnote };
    }
  }

  const kapitel: DrBuehneKapitel[] = [];
  liste(o.kapitel, "kapitel", DR_BUEHNE_MAX.kapitel).forEach((k, i) => {
    const pfad = `kapitel[${i + 1}]`;
    const x = objekt(k, pfad); if (!x) return;
    const titel = text(x.titel, `${pfad}.titel`, DR_BUEHNE_MAX.kapitelTitel, true);
    const t = text(x.text, `${pfad}.text`, DR_BUEHNE_MAX.kapitelText, true, true);
    const nummern: number[] = [];
    liste(x.dokumente, `${pfad}.dokumente`, DR_BUEHNE_MAX.dokumente).forEach((n) => {
      if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > 999) { fehler.push(`${pfad}.dokumente: nur Nummern der Unterlagen (1, 2, 3 …).`); return; }
      if (!nummern.includes(n)) nummern.push(n);
    });
    kapitel.push({ titel, text: t, ...(nummern.length ? { dokumente: nummern } : {}) });
  });

  let abschluss: DrBuehneAbschluss | undefined;
  if (o.abschluss !== undefined && o.abschluss !== null) {
    const a = objekt(o.abschluss, "abschluss");
    if (a) {
      const knopf = text(a.knopf, "abschluss.knopf", DR_BUEHNE_MAX.knopf, false);
      const satz = text(a.satz, "abschluss.satz", DR_BUEHNE_MAX.satz, false);
      if (knopf || satz) abschluss = { ...(knopf ? { knopf } : {}), ...(satz ? { satz } : {}) };
    }
  }
  const hinweis = text(o.hinweis, "hinweis", DR_BUEHNE_MAX.hinweis, false, true);

  if (fehler.length) return { ok: false, fehler, warnungen };
  const wert: DrBuehne = {
    ...(o.hauptprojekt === true ? { hauptprojekt: true } : {}),
    kicker, claim, untertitel, kennzahlen,
    ...(kurve ? { kurve } : {}),
    kapitel,
    ...(abschluss ? { abschluss } : {}),
    ...(hinweis ? { hinweis } : {}),
  };
  return { ok: true, wert, warnungen };
}

/** Eine Zeile für Listen und Vorschau: „Hauptprojekt · 3 Kennzahlen · Kurve · 2 Kapitel“. */
export function drBuehneKurz(b: DrBuehne | null): string {
  if (!b) return "keine Bühne";
  return [
    b.hauptprojekt ? "Hauptprojekt" : "",
    `${b.kennzahlen.length} ${b.kennzahlen.length === 1 ? "Kennzahl" : "Kennzahlen"}`,
    b.kurve ? `Kurve (${b.kurve.reihen.length} ${b.kurve.reihen.length === 1 ? "Reihe" : "Reihen"})` : "",
    `${b.kapitel.length} Kapitel`,
  ].filter(Boolean).join(" · ");
}

// ═══════════════════════════════════════════════════════════════════════════
// ANFRAGEN AUS DEM RAUM
// ═══════════════════════════════════════════════════════════════════════════
export type DrAnfrageArt = "vertrag" | "frage";
export const DR_ANFRAGE_TEXT = { min: 5, max: 2000 } as const;
export interface DrAnfrage { art: DrAnfrageArt; projekt: string | null; text: string }

/** „vertrag“ braucht ein Projekt (Buchstabe), „frage“ einen Text; beides nur mit sauberem, kurzem Text. */
export function drAnfragePruefen(roh: unknown): { ok: true; wert: DrAnfrage } | { ok: false; error: string } {
  const o = roh && typeof roh === "object" && !Array.isArray(roh) ? (roh as Record<string, unknown>) : {};
  const art = String(o.art ?? "");
  if (art !== "vertrag" && art !== "frage") return { ok: false, error: "Diese Anfrage kennen wir nicht." };
  const p = zeile(o.projekt, 10).toUpperCase();
  if (p && !/^[A-Z][A-Z0-9]{0,2}$/.test(p)) return { ok: false, error: "Dieses Projekt gibt es hier nicht." };
  const text = mehrzeilig(o.text, 100_000);
  if (art === "vertrag" && !p) return { ok: false, error: "Bitte wählen Sie das Projekt." };
  if (art === "frage" && text.length < DR_ANFRAGE_TEXT.min) return { ok: false, error: "Bitte schreiben Sie Ihre Frage in ein paar Worten." };
  if (text.length > DR_ANFRAGE_TEXT.max) return { ok: false, error: `Bitte fassen Sie sich etwas kürzer (höchstens ${DR_ANFRAGE_TEXT.max} Zeichen).` };
  return { ok: true, wert: { art, projekt: p || null, text } };
}
