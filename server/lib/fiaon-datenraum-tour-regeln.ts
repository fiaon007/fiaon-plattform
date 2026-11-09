// ═══════════════════════════════════════════════════════════════════════════
// DATENRAUM — DIE REGELN DER RAUMTOUR (E-489, 09.11.2026)
//
// Rein, ohne Datenbank und ohne Netz (scripts/pruef-datenraum.ts, Teil A):
//   · Eine Bühne bekommt der Gast mit DERSELBEN Regel wie ein Dokument (drZugriff aus fiaon-datenraum-regeln.ts):
//     angemeldet, nicht gesperrt, Raum offen, Projekt im eigenen Raum — und die unterzeichnete Vereinbarung nennt
//     das Thema. Ohne Vereinbarung gibt es keine einzige Bühne.
//   · Eine Anfrage aus dem Raum (Vertragsentwurf anfordern, Frage stellen) nur aus einer gültigen Sitzung mit
//     Vereinbarung; zu einem Projekt nur, wenn die Vereinbarung es nennt.
//   · Die Bremse für Anfragen — damit niemand Justins Postfach über den Raum füllen kann.
// ═══════════════════════════════════════════════════════════════════════════
import { drZugriff, type DrZugriff, type DrZugriffLage } from "./fiaon-datenraum-regeln";
import { drBuehnePruefen, type DrBuehne } from "@shared/fiaon-datenraum-buehne";

/** Die Lage des Gastes — wie bei Dokumenten, nur ohne Dokument. */
export type DrTourLage = Omit<DrZugriffLage, "dokument">;
export interface DrTourProjekt { id: number; raumId: number; buchstabe: string }

/** Das Projekt als „Dokument“ für die EINE Regel: Entfernte Projekte liest der Server gar nicht erst. */
const wieDokument = (p: DrTourProjekt) => ({ raumId: p.raumId, projektId: p.id, sichtbar: true, entfernt: false, projektEntfernt: false });

/**
 * Die Bühnen, die der Gast sehen darf — je Buchstabe. Eine gespeicherte Bühne, die die Prüfung nicht (mehr)
 * besteht, wird nicht gezeigt (verworfen), statt halb kaputt auf dem Bildschirm eines Investors zu landen.
 */
export function drBuehnenFreigeben(
  lage: DrTourLage,
  projekte: (DrTourProjekt & { buehne: unknown })[],
): { buehnen: Record<string, DrBuehne>; verworfen: string[] } {
  const buehnen: Record<string, DrBuehne> = {};
  const verworfen: string[] = [];
  for (const p of projekte) {
    if (!drZugriff({ ...lage, dokument: wieDokument(p) }).erlaubt) continue;
    const v = drBuehnePruefen(p.buehne);
    if (!v.ok) { verworfen.push(p.buchstabe); continue; }
    if (v.wert) buehnen[p.buchstabe] = v.wert;
  }
  return { buehnen, verworfen };
}

/**
 * Darf der Gast diese Anfrage stellen? projekt = das Projekt im Raum, null = Frage ohne Thema,
 * "unbekannt" = ein Buchstabe, den es im Raum nicht gibt (404 — wie ein unbekanntes Dokument).
 */
export function drAnfrageZugriff(lage: DrTourLage, projekt: DrTourProjekt | null | "unbekannt"): DrZugriff {
  if (projekt === "unbekannt") return drZugriff({ ...lage, dokument: null });
  if (projekt) return drZugriff({ ...lage, dokument: wieDokument(projekt) });
  // Ohne Thema: Sitzung und Sperre wie bei Dokumenten (die Regel antwortet dort, bevor sie das Dokument ansieht) …
  const z = drZugriff({ ...lage, dokument: null });
  if (!z.erlaubt && z.grund !== "unbekannt") return z;
  // … und eine unterzeichnete Vereinbarung.
  if (!lage.ndaProjektIds) return { erlaubt: false, status: 403, grund: "nda", text: "Bitte unterzeichnen Sie zuerst die Vertraulichkeitsvereinbarung." };
  return { erlaubt: true };
}

/** Je Gast höchstens 8 Anfragen in der Stunde und 30 am Tag; über alle Gäste höchstens 60 in 10 Minuten. */
export const DR_ANFRAGE_BREMSE = { jeGastStunde: 8, jeGastTag: 30, gesamtZehnMinuten: 60, vertragDoppeltMinuten: 30 } as const;
export function drAnfrageGebremst(z: { gastStunde: number; gastTag: number; alleZehnMinuten: number }): boolean {
  return z.gastStunde >= DR_ANFRAGE_BREMSE.jeGastStunde || z.gastTag >= DR_ANFRAGE_BREMSE.jeGastTag || z.alleZehnMinuten >= DR_ANFRAGE_BREMSE.gesamtZehnMinuten;
}
