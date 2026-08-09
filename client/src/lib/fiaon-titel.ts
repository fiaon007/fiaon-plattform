// ═══════════════════════════════════════════════════════════════════════════
// SEITENTITEL — was in der Tab-Leiste steht
//
// Bis zum 11.08.2026 trug JEDER Tab denselben Text: „FIAON – Deine Premium
// Kreditkarte. Bis zu 25.000€ Limit." Wer die Kunden-Zentrale, den Space und
// eine Akte offen hatte, sah dreimal dasselbe und musste raten.
//
// Der Titel ist auf einem Tab etwa 18 Zeichen breit, bevor er abgeschnitten
// wird. Deshalb steht der BEREICH vorn und die Marke hinten — genau anders
// herum als üblich. „Kunden · FIAON" ist brauchbar, „FIAON — Kunden…" nicht.
//
// Für die öffentlichen Seiten bleibt der Werbetitel: Dort liest ihn Google,
// nicht der Vorgesetzte.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect } from "react";

const MARKE = "FIAON";

/** Der Titel für einen Pfad. Leer heißt: nicht anfassen (öffentliche Seite). */
export function titelFuer(pfad: string): string | null {
  const p = pfad.split("?")[0].replace(/\/+$/, "") || "/";

  const KARTE: [RegExp, string][] = [
    // ── Verwaltung ──────────────────────────────────────────────────────
    [/^\/admin\/kunde\//, "Akte"],
    [/^\/admin\/kunden/, "Kunden"],
    [/^\/admin\/team/, "Team"],
    [/^\/admin\/mail-zentrale/, "Mail"],
    [/^\/admin\/events/, "E-Mail-Events"],
    [/^\/admin\/space/, "Space"],
    [/^\/admin\/diagnose/, "Diagnose"],
    [/^\/admin\/einstellungen/, "Einstellungen"],
    [/^\/admin\/zahlungen/, "Zahlungen"],
    [/^\/admin\/auszahlungen/, "Auszahlungen"],
    [/^\/admin\/buchhaltung/, "Buchhaltung"],
    [/^\/admin\/rechnungen/, "Rechnungen"],
    [/^\/admin\/lead-automatik/, "Lead-Automatik"],
    [/^\/admin/, "Verwaltung"],

    // ── Team-Portal ─────────────────────────────────────────────────────
    [/^\/agent\/space/, "Space"],
    [/^\/agent\/kunden/, "Meine Kunden"],
    [/^\/agent\/start/, "Start"],
    [/^\/agent\/verdienst/, "Verdienst"],
    [/^\/agent\/kalender/, "Kalender"],
    [/^\/agent\/aufgaben/, "Aufgaben"],
    [/^\/agent\/mail-zentrale/, "Mail"],
    [/^\/agent\/vertrieb/, "Gesamtsicht"],
    [/^\/agent\/startgespraeche/, "Startgespräche"],
    [/^\/agent\/inkasso/, "Forderungen"],
    [/^\/agent\/profil/, "Profil"],
    [/^\/agent/, "Team"],
  ];

  for (const [muster, name] of KARTE) {
    if (muster.test(p)) return `${name} · ${MARKE}`;
  }
  return null;
}

/**
 * Setzt den Titel und stellt den vorherigen beim Verlassen wieder her.
 *
 * Das Wiederherstellen ist nicht Kosmetik: Ohne es behielte die öffentliche
 * Startseite den Titel der zuletzt besuchten Verwaltungsseite, sobald jemand
 * von dort zurücknavigiert — und der Werbetitel wäre für Google weg.
 */
export function useSeitenTitel(pfad: string): void {
  useEffect(() => {
    const neu = titelFuer(pfad);
    if (!neu) return;
    const vorher = document.title;
    document.title = neu;
    return () => { document.title = vorher; };
  }, [pfad]);
}
