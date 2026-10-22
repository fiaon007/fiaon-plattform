// ═══════════════════════════════════════════════════════════════════════════
// ARAS — die Stufen-Ampel (E-408 Scheibe 3 Teil 2; Nachtrag „Persona & Skalierung“ § 2, Justin 19.10.2026)
//
// „Klein testen, dann sofort skalieren — Parameter entscheiden, nicht Gefühl.“ Jeden Tag die Werte der
// Kundenanrufe, je Wert eine Ampel, und daraus die Entscheidung:
//   · ROT (Abbrüche/Beschwerden/„nicht mehr anrufen“ ab 3 %, Prüf-Mara-Fehler ab 2 %) → sofort eine Stufe
//     zurück + Karte an Justin. Gemessen über das Fenster der Stufe (Stufe 1: 3 Tage, sonst 5), damit ein
//     einzelner Tag mit drei Gesprächen nicht alles umwirft — bei den Abbrüchen erst ab zwei Fällen, und
//     (E-409 Kalibrierung, 22.10.2026) bei den Prüf-Fehlern genauso: ein einzelner Fall an einem kleinen Tag ist
//     gelb, nicht rot. Als Prüf-Fehler zählt nur ein harter Punkt, der nach den Regeln Bestand hat
//     (shared/fiaon-ki-pruefung-regeln.ts anrufZaehltAlsPruefFehler) — ein „fehler“ ohne solchen Punkt nicht.
//   · GRÜN an 3 abgeschlossenen Tagen in Stufe 1 → Stufe 2; an 5 Tagen in Stufe 2 → Stufe 3. „Abgeschlossen“
//     heißt: 48 h vorbei, die Zahlungen sind messbar. Nie aus Stufe 0 (die schaltet Justin), nie über 3.
// REIN — die Zahlen holt server/lib/fiaon-aras-stufe.ts aus der Datenbank; geprüft in scripts/pruef-aras-plan.ts.
// ═══════════════════════════════════════════════════════════════════════════
import type { Spielart, Stufe } from "./fiaon-aras";

export type AmpelFarbe = "gruen" | "gelb" | "rot" | "leer";

export interface SpielartWerte {
  versuche: number;
  erreicht: number;
  /** Erreichte Gespräche mit einer gebuchten Zahlung binnen 48 h — null, solange der Tag jünger als 48 h ist. */
  zahlungen48: number | null;
}
export interface TagesWerte {
  /** Berliner Datum JJJJ-MM-TT. */
  tag: string;
  stufe: number;
  versuche: number;
  /** Erreichte Gespräche (der Kunde war dran). */
  gespraeche: number;
  je: Partial<Record<Spielart, SpielartWerte>>;
  kostenEuro: number;
  /** null = noch nicht messbar (jünger als 48 h). */
  zahlungen48: number | null;
  sekundenGespraeche: number;
  /** Früh aufgelegt, „nicht mehr anrufen“, Beschwerde. */
  abbrueche: number;
  uebergaben: number;
  /** Gespräche mit einem harten Prüf-Befund, der Bestand hat (Prüfzeile, sonst Live-Befund — anrufZaehltAlsPruefFehler). */
  pruefFehler: number;
}
export interface AmpelPunkt { schluessel: string; name: string; wert: string; ziel: string; farbe: AmpelFarbe }

/** Die Ziele aus dem Nachtrag (§ 2) — EINE Quelle für Ampel, Prüfstand und Anzeige. */
export const STUFEN_ZIELE = {
  erreicht: { rate: 0.25, stufe_a: 0.25, termin: 0.4 } as Partial<Record<Spielart, number>>,
  zahlung48: { stufe_a: 0.3, rate: 0.2, stufe_b: 0.12 } as Partial<Record<Spielart, number>>,
  kostenJeZahlungEuro: 8,
  minutenVon: 2, minutenBis: 5,
  abbruchRotAb: 0.03, abbruchMindestFaelle: 2,
  uebergabeGelbAb: 0.3,
  pruefRotAb: 0.02,
  /** E-409 Kalibrierung (22.10.2026): rot erst ab zwei Prüf-Fehlern im Fenster — ein einzelner Fall ist gelb (wie bei den Abbrüchen). */
  pruefMindestFaelle: 2,
  /** Unter so wenigen Versuchen / Gesprächen ist eine Quote noch nicht messbar (grau, „leer“). */
  mindestVersuche: 5, mindestGespraeche: 3,
  /** Grüne, abgeschlossene Tage bis zur nächsten Stufe. */
  tageHoch: { 1: 3, 2: 5 } as Record<number, number>,
} as const;

/** Berliner Datum minus n Tage (JJJJ-MM-TT; negativ = plus). Rein. */
export function tagMinus(tag: string, n: number): string {
  const d = new Date(`${tag}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
/** Abgeschlossen: auch der letzte Anruf des Tages hatte volle 48 h für die Zahlung (Tag + 3 ≤ heute). Rein. */
export function tagAbgeschlossen(tag: string, heute: string): boolean { return tag <= tagMinus(heute, 3); }

/** Das Fenster für die roten Werte: Stufe 1 drei Tage, sonst fünf. */
export function fensterTage(stufe: number): number { return stufe <= 1 ? 3 : 5; }

const prozent = (x: number) => `${Math.round(x * 100)} %`;
const summe = (f: TagesWerte[], k: (w: TagesWerte) => number) => f.reduce((s, w) => s + k(w), 0);

/** Die Ampel eines Tages; die roten Werte über das Fenster (die letzten Tage der Stufe, inkl. dieses Tags). Rein. */
export function tagesAmpel(w: TagesWerte, fenster: TagesWerte[] = [w]): { farbe: AmpelFarbe; punkte: AmpelPunkt[] } {
  const Z = STUFEN_ZIELE;
  const punkte: AmpelPunkt[] = [];
  if (!w.versuche) return { farbe: "leer", punkte: [{ schluessel: "versuche", name: "Kundenanrufe", wert: "0", ziel: "—", farbe: "leer" }] };
  // Erreicht-Quote je Spielart
  for (const [s, ziel] of Object.entries(Z.erreicht) as [Spielart, number][]) {
    const v = w.je[s];
    if (!v?.versuche) continue;
    const q = v.erreicht / v.versuche;
    punkte.push({ schluessel: `erreicht_${s}`, name: `Erreicht (${s})`, wert: `${prozent(q)} von ${v.versuche}`, ziel: `≥ ${prozent(ziel)}`, farbe: v.versuche < Z.mindestVersuche ? "leer" : q >= ziel ? "gruen" : "gelb" });
  }
  // Zahlungen binnen 48 h je Spielart
  for (const [s, ziel] of Object.entries(Z.zahlung48) as [Spielart, number][]) {
    const v = w.je[s];
    if (!v?.erreicht) continue;
    if (v.zahlungen48 == null) { punkte.push({ schluessel: `zahlung48_${s}`, name: `Zahlung binnen 48 h (${s})`, wert: "noch offen", ziel: `≥ ${prozent(ziel)}`, farbe: "leer" }); continue; }
    const q = v.zahlungen48 / v.erreicht;
    punkte.push({ schluessel: `zahlung48_${s}`, name: `Zahlung binnen 48 h (${s})`, wert: `${prozent(q)} von ${v.erreicht}`, ziel: `≥ ${prozent(ziel)}`, farbe: v.erreicht < Z.mindestGespraeche ? "leer" : q >= ziel ? "gruen" : "gelb" });
  }
  // Kosten je gebuchter Zahlung
  if (w.zahlungen48 != null) {
    const je = w.zahlungen48 > 0 ? w.kostenEuro / w.zahlungen48 : null;
    punkte.push({ schluessel: "kosten_je_zahlung", name: "Kosten je Zahlung", wert: je == null ? `${w.kostenEuro.toFixed(2)} €, keine Zahlung` : `${je.toFixed(2)} €`, ziel: `< ${Z.kostenJeZahlungEuro} €`,
      farbe: je == null ? (w.kostenEuro >= Z.kostenJeZahlungEuro ? "gelb" : "leer") : je < Z.kostenJeZahlungEuro ? "gruen" : "gelb" });
  }
  // Minuten je Gespräch
  if (w.gespraeche) {
    const min = w.sekundenGespraeche / w.gespraeche / 60;
    punkte.push({ schluessel: "minuten", name: "Minuten je Gespräch", wert: min.toFixed(1), ziel: `${Z.minutenVon}–${Z.minutenBis}`, farbe: w.gespraeche < Z.mindestGespraeche ? "leer" : min >= Z.minutenVon && min <= Z.minutenBis ? "gruen" : "gelb" });
  }
  // Übergaben an Menschen
  if (w.gespraeche) {
    const q = w.uebergaben / w.gespraeche;
    punkte.push({ schluessel: "uebergaben", name: "Übergaben an Menschen", wert: prozent(q), ziel: `< ${prozent(Z.uebergabeGelbAb)}`, farbe: w.gespraeche < Z.mindestGespraeche ? "leer" : q >= Z.uebergabeGelbAb ? "gelb" : "gruen" });
  }
  // ROT über das Fenster: Abbrüche (ab zwei Fällen) und Prüf-Fehler
  const g = summe(fenster, (x) => x.gespraeche);
  if (g) {
    const ab = summe(fenster, (x) => x.abbrueche);
    const qa = ab / g;
    punkte.push({ schluessel: "abbrueche", name: "Abbrüche, Beschwerden, „nicht mehr anrufen“", wert: `${prozent(qa)} (${ab} von ${g}, ${fenster.length} Tage)`, ziel: `< ${prozent(Z.abbruchRotAb)}`,
      farbe: qa >= Z.abbruchRotAb && ab >= Z.abbruchMindestFaelle ? "rot" : "gruen" });
    const pf = summe(fenster, (x) => x.pruefFehler);
    const qp = pf / g;
    punkte.push({ schluessel: "pruef_fehler", name: "Prüf-Mara-Fehler (Wortwand, Wahrheit, Ton)", wert: `${prozent(qp)} (${pf} von ${g})`, ziel: `< ${prozent(Z.pruefRotAb)}`,
      farbe: qp < Z.pruefRotAb ? "gruen" : pf >= Z.pruefMindestFaelle ? "rot" : "gelb" });
  }
  const farbe: AmpelFarbe = punkte.some((p) => p.farbe === "rot") ? "rot" : punkte.some((p) => p.farbe === "gelb") ? "gelb" : "gruen";
  return { farbe, punkte };
}

export interface TagEintrag { tag: string; stufe: number; farbe: AmpelFarbe; versuche: number; abgeschlossen: boolean }

/**
 * Hoch, zurück oder bleiben? `tage` = die Tage, neuester zuerst. `rotJetzt` = die roten Werte im Fenster bis heute.
 * Nie aus Stufe 0 hoch (die schaltet Justin), nie über 3; zurück geht auch von 1 auf 0. Rein.
 */
export function stufenEntscheidung(e: { stufe: number; auto: boolean; rotJetzt: boolean; tage: TagEintrag[] }): { neu: Stufe | null; richtung: "hoch" | "runter" | null; grund: string } {
  const stufe = Math.max(0, Math.min(3, Math.round(Number(e.stufe) || 0)));
  if (!e.auto) return { neu: null, richtung: null, grund: "Automatik aus (aras_stufe_auto)." };
  if (e.rotJetzt && stufe >= 1) return { neu: (stufe - 1) as Stufe, richtung: "runter", grund: `Rot im Fenster der Stufe ${stufe} — eine Stufe zurück.` };
  if (stufe === 0) return { neu: null, richtung: null, grund: "Stufe 0: hoch schaltet nur Justin." };
  const brauche = STUFEN_ZIELE.tageHoch[stufe];
  if (!brauche) return { neu: null, richtung: null, grund: "Höchste Stufe." };
  let gruen = 0;
  for (const t of e.tage) {
    if (!t.abgeschlossen) continue;            // jünger als 48 h: Zahlungen noch nicht messbar
    if (t.stufe !== stufe) break;              // nur Tage IN dieser Stufe zählen
    if (!t.versuche || t.farbe === "leer") continue; // Tag ohne Anrufe (Sonntag) zählt nicht und bricht nicht
    if (t.farbe !== "gruen") break;
    gruen += 1;
    if (gruen >= brauche) return { neu: (stufe + 1) as Stufe, richtung: "hoch", grund: `${brauche} grüne Tage in Stufe ${stufe} — eine Stufe hoch.` };
  }
  return { neu: null, richtung: null, grund: `${gruen} von ${brauche} grünen Tagen in Stufe ${stufe}.` };
}
