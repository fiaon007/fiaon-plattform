// ═══════════════════════════════════════════════════════════════════════════
// ZAHL AUS EINER EINGABE — deutsch UND englisch, EINE Quelle (02.09.2026)
//
// Der Fund: Die Werkzeuge lasen „1.500" (deutsche Tausender ohne Komma) als
// 1,50 — weil die Regel nur „Komma + 1–2 Ziffern = deutsch" kannte und sonst
// den Punkt als Dezimaltrenner nahm. Ein Kunde, der 1.500 € Schulden eintippt,
// bekam eine Rechnung über 1,50 €. Diese Funktion entscheidet nach dem
// ganzen Muster, nicht nach einem Zeichen:
//   1.500,50 · 59,99        → deutsch (Punkt Tausender, Komma Dezimal)
//   1,500.50 · 59.99        → englisch (Komma Tausender, Punkt Dezimal)
//   1.500 · 12.000          → deutsche Tausender (Punkt + genau 3 Ziffern)
//   1,500 · 12,000          → englische Tausender (Komma + genau 3 Ziffern)
//   1500 · 1.5 · 59,9       → wie geschrieben
// Leerzeichen und €-Zeichen werden ignoriert. Unlesbares ergibt NaN.
// ═══════════════════════════════════════════════════════════════════════════

export function zahlEingabe(eingabe: string | number | null | undefined): number {
  if (typeof eingabe === "number") return Number.isFinite(eingabe) ? eingabe : NaN;
  const r = String(eingabe ?? "").trim().replace(/[\s€]/g, "").replace(/^\+/, "");
  if (!r) return NaN;
  let t: string;
  if (/,\d{1,2}$/.test(r)) t = r.replace(/\./g, "").replace(",", ".");          // 1.500,50 · 59,99
  else if (/\.\d{1,2}$/.test(r) && r.includes(",")) t = r.replace(/,/g, "");      // 1,500.50
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(r)) t = r.replace(/\./g, "");             // 1.500 · 12.000
  else if (/^-?\d{1,3}(,\d{3})+$/.test(r)) t = r.replace(/,/g, "");               // 1,500 · 12,000
  else t = r.replace(/,/g, ".");                                                  // 1500 · 1.5 · 59,9
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

/** Wie zahlEingabe, aber negative Werte gelten als unlesbar (Beträge, Raten, Zinsen). */
export function betragEingabe(eingabe: string | number | null | undefined): number {
  const n = zahlEingabe(eingabe);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}
