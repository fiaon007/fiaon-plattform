// ═══════════════════════════════════════════════════════════════════════════
// FIAON Academy — Inhalte zusammenführen (23.08.2026, Plan §11)
// Gerüst aus shared/fiaon-academy-lehrplan.ts + Inhalte der Kapitel-Dateien.
// Fehlt ein Inhalt zu einem Schritt des Gerüsts, warnt die Konsole (DEV).
// ═══════════════════════════════════════════════════════════════════════════
import { LEHRPLAN, type LehrplanKapitel, type LehrplanSchritt } from "@shared/fiaon-academy-lehrplan";
import type { Frage, KapitelInhalt, SchrittInhalt } from "./typen";
import { KAPITEL_1 } from "./kapitel-1-fiaon";
import { KAPITEL_2 } from "./kapitel-2-plattform";
import { KAPITEL_3 } from "./kapitel-3-ablauf";
import { KAPITEL_4 } from "./kapitel-4-gespraech";
import { KAPITEL_5 } from "./kapitel-5-recht";
import { KAPITEL_6 } from "./kapitel-6-schufa";
import { KAPITEL_7 } from "./kapitel-7-oesterreich";
import { KAPITEL_8 } from "./kapitel-8-schweiz";
import { KAPITEL_9 } from "./kapitel-9-werkzeuge";
import { KAPITEL_10 } from "./kapitel-10-situationen";

const INHALTE: Record<string, KapitelInhalt> = { fiaon: KAPITEL_1, plattform: KAPITEL_2, ablauf: KAPITEL_3, gespraech: KAPITEL_4, recht: KAPITEL_5, schufa: KAPITEL_6, oesterreich: KAPITEL_7, schweiz: KAPITEL_8, werkzeuge: KAPITEL_9, situationen: KAPITEL_10 };

export interface SchrittVoll extends LehrplanSchritt { inhalt: SchrittInhalt; index: number }
export interface KapitelVoll extends Omit<LehrplanKapitel, "schritte"> { schritte: SchrittVoll[]; test: Frage[] }

export const KAPITEL: KapitelVoll[] = LEHRPLAN.map((k) => {
  const inhalt = INHALTE[k.key];
  return {
    ...k,
    test: inhalt?.test ?? [],
    schritte: k.schritte.map((s, index) => {
      const i = s.art === "test" ? { einleitung: "" } : inhalt?.inhalte[s.key];
      if (!i && import.meta.env.DEV) console.warn(`[Academy] Kein Inhalt für ${k.key}/${s.key}`);
      return { ...s, index, inhalt: i ?? { bloecke: [] } };
    }),
  };
});

export const kapitelVoll = (key: string): KapitelVoll | null => KAPITEL.find((k) => k.key === key) ?? null;
