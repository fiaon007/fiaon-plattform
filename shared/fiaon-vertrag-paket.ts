// ═══════════════════════════════════════════════════════════════════════════
// VERTRAG MIT PAKET — eine Stelle für Client und Server (E-244, 26.09.2026)
//
// § 312j BGB: Der Vertrag über ein Privatpaket entsteht nur mit dem Knopf
// „Zahlungspflichtig annehmen" und der Bestellübersicht direkt darüber. Die
// Übersicht gibt es nur für Privatpakete mit Monatsrate. Dieselbe Frage stellt
// der Server, bevor er über /zustimmung eine Vertragsannahme festhält — sonst
// könnte ein Link einen Vertrag schließen, zu dem der Kunde nie eine Übersicht sah.
//
// AGB_FASSUNG ist das Datum der AGB, die mit diesem Knopf gelten (§ 3 neu am
// 26.09.2026; neu gefasst am 05.10.2026, E-283: Partnerbank und Vergütung
// statt der falschen Unabhängigkeits-Aussage, Fälligkeit, Zahlungsweg,
// Widerrufsbelehrung aus shared/fiaon-global-widerruf.ts). Alle Vergleiche auf
// agb_stand prüfen „>= 2026-09-03" (Jahresvertrag) — das neue Datum liegt
// darüber und ändert nichts an ihnen. Wer das Datum erhöht, legt die bisherige
// Fassung wörtlich ins Archiv (client/src/pages/agb-archiv/) und trägt sie in
// AGB_FRUEHERE_FASSUNGEN ein — Verträge und Bestätigungsmails verlinken die
// Fassung, die für sie gilt.
// ═══════════════════════════════════════════════════════════════════════════
import { paket, PAKETE } from "./fiaon-pakete";
import { PAKET_ANZEIGE } from "./fiaon-paketname";

export const AGB_FASSUNG = "2026-10-05";

/**
 * Die früheren Fassungen der AGB, neueste zuerst (05.10.2026, E-283). Jede steht wörtlich unter
 * fiaon.com/agb/<Fassung> (client/src/pages/agb-archiv/, SEO-Eintrag noindex in shared/fiaon-seo-seiten.ts).
 * 2026-04-12 ist die Fassung der SCP Real Estate KG (Gräfelfing, Zahlung über Stripe) — eine eigene Fassung,
 * nicht nur eine Vorstufe: Anbieterin und Zahlungsweg waren andere.
 */
export const AGB_FRUEHERE_FASSUNGEN = ["2026-09-26", "2026-09-03", "2026-07-04", "2026-04-12"] as const;

/** true = unter fiaon.com/agb/<fassung> steht ein Text (die aktuelle oder eine archivierte Fassung). */
export function agbFassungBekannt(fassung: unknown): boolean {
  const f = String(fassung ?? "").trim();
  return f === AGB_FASSUNG || (AGB_FRUEHERE_FASSUNGEN as readonly string[]).includes(f);
}

/**
 * Die Adresse einer Fassung ohne „https://", so wie sie in Vertrag und Mail steht:
 * „fiaon.com/agb/2026-10-05". Eine Fassung, die es nicht gibt, führt auf fiaon.com/agb —
 * nie auf eine Adresse, unter der kein Text steht.
 */
export function agbAdresse(fassung: unknown = AGB_FASSUNG): string {
  const f = String(fassung ?? "").trim();
  return agbFassungBekannt(f) ? `fiaon.com/agb/${f}` : "fiaon.com/agb";
}

/** Nur Privatpakete mit Rate (start/pro/ultra/highend) bekommen die Übersicht. */
export function istUebersichtPaket(key: unknown): boolean {
  const p = paket(key);
  return !!p && p.abo && p.art === "privat" && !p.eingestellt;
}

/**
 * Der Schlüssel aus einem gespeicherten Paketnamen — für Zeilen ohne pack_key.
 * GEMESSEN 26.09.2026 (Produktion, nur lesend): „FIAON Pro (Standard)", „FIAON
 * PRO", „FIAON High-End", „FIAON HIGHEND", „FIAON Start", „FIAON Starter (Das
 * Fundament)" … Verglichen wird ohne Beisatz, ohne Groß/klein, ohne Leer- und
 * Bindestriche. Was nicht eindeutig passt, bleibt null — geraten wird nie.
 */
export function paketKeyAusName(name: unknown): string | null {
  const roh = String(name ?? "").split("\n")[0].replace(/\s*\([^)]*\)\s*$/, "");
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9äöü]/g, "");
  const n = norm(roh);
  if (!n) return null;
  for (const p of PAKETE) {
    if (!istUebersichtPaket(p.key)) continue;
    const kandidaten = [p.key, `fiaon${p.key}`, norm(p.label.replace(/\s*\([^)]*\)\s*$/, "")), norm(PAKET_ANZEIGE[p.key]?.name ?? "")];
    if (kandidaten.includes(n)) return p.key;
  }
  return null;
}

/** Das Vertragspaket einer Bestellzeile: pack_key, sonst aus dem Namen — nur Privatpakete mit Rate. */
export function vertragsPaketKey(packKey: unknown, packName: unknown): string | null {
  const k = typeof packKey === "string" && packKey.trim() ? packKey.trim() : paketKeyAusName(packName);
  return k && istUebersichtPaket(k) ? k : null;
}
