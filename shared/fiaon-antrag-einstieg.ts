// ═══════════════════════════════════════════════════════════════════════════
// DER LINK VON /start IN DEN ANTRAG (05.10.2026, E-283)
//
// Justin: „Stelle den neuen Antrag live, überall für die Privatkunden, also
// auch auf fiaon.com/start". Bis hier hängte /start jedem Link src=wa an und
// reichte ref durch — die Weiche las beides als „Link, den nur der alte Weg
// versteht", und /start blieb auch bei 100 % beim alten Antrag.
//
// Jetzt: Ziel bleibt /antrag (der eine Eingang, damit ein Zurückstellen im
// Chefbüro sofort wirkt — die Weiche entscheidet). Mit reisen nur das Paket,
// die Werbe-Kennungen und die Herkunft. Kein erzwungenes src mehr: Der alte
// Antrag liest src nur für die Auskunft-Varianten. fbclid und gclid reisen
// mit, weil ohne Einwilligung auf /start nichts davon gespeichert ist — sonst
// ginge die Klick-Kennung beim Seitenwechsel verloren.
//
// Rein (kein window) — Prüfstand: scripts/pruef-antrag-weiche.ts.
// ═══════════════════════════════════════════════════════════════════════════

/** Was außer dem Paket von der Landingpage in den Antrag mitreist (dazu jedes utm_*). */
export const ANTRAG_EINSTIEG_WEITERGABE = ["fbclid", "gclid", "gbraid", "wbraid", "msclkid", "quelle", "ref"] as const;

/**
 * Der Link in den Antrag: /antrag?pack=…&utm_…&fbclid=… — nur, was in der Adresse
 * der Landingpage steht (suche = location.search, mit oder ohne „?").
 */
export function antragEinstiegLink(pack: string | undefined, suche: string): string {
  let ein: URLSearchParams;
  try { ein = new URLSearchParams(String(suche || "")); } catch { ein = new URLSearchParams(); }
  const aus = new URLSearchParams();
  if (pack) aus.set("pack", pack);
  ein.forEach((wert, schluessel) => {
    const k = schluessel.trim().toLowerCase();
    if (!wert || aus.has(k)) return;
    if (/^utm_[a-z0-9_]{1,40}$/.test(k) || (ANTRAG_EINSTIEG_WEITERGABE as readonly string[]).includes(k)) aus.set(k, wert.slice(0, 300));
  });
  const q = aus.toString();
  return q ? `/antrag?${q}` : "/antrag";
}
