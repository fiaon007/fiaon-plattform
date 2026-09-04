// ═══════════════════════════════════════════════════════════════════════════
// ANHÄNGE AN MARAS ANTWORTEN — 04.09.2026 (E-115)
//
// Der Plan steht als JSON an der Postmeister-Zeile (`anhaenge`):
//   [{ art: "rechnung", referenz: "FIAON-ABC123-2", quelle: "automatik"|"werkzeug"|"mensch" }]
// Er entsteht an drei Stellen: automatisch, sobald die Antwort eine Zahlungs-
// seite trägt; durch das Werkzeug `rechnung_anhaengen`; durch den Schalter im
// Postfach. Gebaut werden die Dateien erst beim Senden — eine Rechnung von
// gestern könnte heute eine andere Nummer oder einen anderen Stand haben.
// ═══════════════════════════════════════════════════════════════════════════

import type { MailAnhang } from "./fiaon-gmail";
import { rechnungAlsPdf } from "./fiaon-rechnung-pdf";

export interface AnhangPlan { art: "rechnung"; referenz: string; quelle: "automatik" | "werkzeug" | "mensch" }

const REF_IN_URL = /\/zahlung\/(FIAON-[A-Z0-9]{6}(?:-\d{1,2})?)/i;

/** Aus dem nächsten Schritt (Zahlungsseite) die Referenz lesen. */
export function referenzAusSchritt(schritt: { art?: string; url?: string | null } | null | undefined): string | null {
  if (!schritt || schritt.art !== "zahlung" || !schritt.url) return null;
  const m = String(schritt.url).match(REF_IN_URL);
  return m ? m[1].toUpperCase() : null;
}

/** Plan zusammenführen: was schon steht + was die Zahlungsseite verlangt. Keine Dubletten. */
export function anhaengePlanen(
  vorhanden: unknown,
  schritt: { art?: string; url?: string | null } | null | undefined,
  automatik = true,
): AnhangPlan[] {
  const plan: AnhangPlan[] = Array.isArray(vorhanden)
    ? (vorhanden as any[]).filter((a) => a && a.art === "rechnung" && a.referenz)
      .map((a) => ({ art: "rechnung" as const, referenz: String(a.referenz).toUpperCase(), quelle: (a.quelle || "werkzeug") as AnhangPlan["quelle"] }))
    : [];
  const ref = automatik ? referenzAusSchritt(schritt) : null;
  if (ref && !plan.some((p) => p.referenz === ref)) plan.push({ art: "rechnung", referenz: ref, quelle: "automatik" });
  return plan;
}

/** Die Dateien bauen. Eine fehlende Rechnung lässt die Mail nicht scheitern — sie fehlt dann eben. */
export async function anhaengeBauen(plan: AnhangPlan[]): Promise<{ dateien: MailAnhang[]; fehler: string[] }> {
  const dateien: MailAnhang[] = [];
  const fehler: string[] = [];
  for (const p of plan.slice(0, 3)) {
    try {
      const r = await rechnungAlsPdf(p.referenz);
      if (!r) { fehler.push(`Rechnung ${p.referenz}: nicht gefunden`); continue; }
      dateien.push({ dateiname: r.dateiname, inhalt: r.pdf, typ: "application/pdf" });
    } catch (e: any) {
      fehler.push(`Rechnung ${p.referenz}: ${String(e?.message || e).slice(0, 120)}`);
    }
  }
  return { dateien, fehler };
}
