// ═══════════════════════════════════════════════════════════════════════════
// DIE GROSSE KARTE DER PIPELINE — DRINGLICHKEIT ÜBER BEIDE SPALTEN
// (16.10.2026, E-391)
//
// Daniel Stripling, 16.10.: „Hab in der Pipeline wieder nur C-Kunden."
//
// ── GEMESSEN (Produktion, nur lesend, 16.10. 19:30) ──────────────────────
// Links („Neu für dich") 0 A, 0 B, 6 C — nie angerufene Leads aus dem Pool.
// Rechts („Wieder dran") 31 A, 455 B, 103 Rate, 39 C; ganz oben rechts eine
// A-Kundin „Zahlung prüfen". Die große Karte nahm IMMER zuerst die linke
// Spalte (pipeline.tsx: slots[0] ?? wieder[0]) — Daniels nächster Anruf war
// ein C-Lead, während die A-Kundin wartete.
//
// Links bleibt bei ihm zwangsläufig C: Er ruft jeden neuen A/B binnen ~20 h
// an, danach steht der Mensch rechts. Das ist die Spaltenregel (E-168/E-212)
// und bleibt so. Falsch war nur, dass die große Karte die Spalte über die
// Dringlichkeit gestellt hat.
//
// ── DIE REGEL ────────────────────────────────────────────────────────────
// Spalten und Reihenfolge darin bleiben unverändert. Die große Karte wählt
// über beide Spalten; kleiner Rang zuerst, bei gleichem Rang die Reihenfolge
// der Spalte (rechts vor links):
//   1  rechts Band 0 / links „jetzt": Termin oder Rückruf mit Uhrzeit JETZT
//   2  links Sofort-Spur (A/B, Antrag oder Zahlungsmeldung ≤ 24 h, E-251)
//   3  rechts Band 1: Termin heute, Zusage/Zahlung prüfen
//   4  rechts Band 2: Rückruf fällig
//   5  rechts Band 3: frische A/B/Rate, nicht gerade bearbeitet
//   6  links A/B
//   7  rechts Band 4: alle anderen A/B/Rate
//   8  links C
//   9  rechts Band 5: Stufe C
// Die Bänder rechnet der Server (wiederBandSql in fiaon-office-vertrieb.ts,
// derselbe Ausdruck, nach dem die rechte Spalte sortiert) — hier steht nur,
// wie sie gegen die linke Spalte stehen.
//
// Was die Seite zusätzlich hält (pipeline.tsx): Wer selbst eine Karte wählt,
// behält sie; während eines Anrufs und bei offener Akte wechselt die große
// Karte nicht.
// ═══════════════════════════════════════════════════════════════════════════

/** Was die Fokuswahl von einer Karte braucht — mehr nicht. */
export interface FokusKarte {
  personId: number;
  /** priority_tier: 1 = A (Zahlung gemeldet), 2 = B (Antrag), 3 = C (Lead), 0 = Ratenkunde. */
  tier: number;
  /** Nur rechts: das Band aus wiederOrdnung (0–5). Fehlt es, gilt Band 4 (Stufe C: 5). */
  band?: number | null;
  /** Nur links: Sofort-Spur (E-251). */
  sofort?: boolean;
  /** Nur links: Termin oder Rückruf mit Uhrzeit jetzt (erster Schlüssel von NEU_ORDNUNG). */
  jetzt?: boolean;
}

const istAB = (tier: number) => tier === 1 || tier === 2;

/** Der Rang einer Karte für die große Karte — kleiner ist dringender. */
export function fokusRang(k: FokusKarte, seite: "links" | "rechts"): number {
  if (seite === "links") {
    if (k.jetzt) return 1;
    if (k.sofort && istAB(k.tier)) return 2;
    return istAB(k.tier) ? 6 : 8;
  }
  const band = k.band ?? (k.tier === 3 ? 5 : 4);
  switch (band) {
    case 0: return 1;
    case 1: return 3;
    case 2: return 4;
    case 3: return 5;
    case 5: return 9;
    default: return 7;
  }
}

/**
 * Die große Karte: die dringendste über beide Spalten. Bei gleichem Rang gewinnt,
 * wer in seiner Spalte weiter vorn steht, rechts vor links. null nur ohne Karten.
 */
export function fokusWahl(links: readonly FokusKarte[], rechts: readonly FokusKarte[]): number | null {
  let beste: { id: number; rang: number } | null = null;
  for (const [seite, liste] of [["rechts", rechts], ["links", links]] as const) {
    for (const k of liste) {
      const rang = fokusRang(k, seite);
      if (!beste || rang < beste.rang) beste = { id: k.personId, rang };
    }
  }
  return beste?.id ?? null;
}

/**
 * Welche Karte die Seite groß zeigt (pipeline.tsx) — in dieser Reihenfolge:
 *   1. die selbst gewählte (gewaehlt), solange sie in einer Spalte steht;
 *   2. während eines Anrufs oder bei offener Akte (halten) die bisher gezeigte —
 *      die Karte rutscht nicht unter der Hand weg, auch wenn die Liste neu lädt;
 *   3. der Vorschlag des Servers (fokusId aus arbeitslisteLesen);
 *   4. dieselbe Regel hier über die Karten (falls der Vorschlag fehlt oder weg ist).
 */
export function grosseKarteId(o: {
  links: readonly FokusKarte[]; rechts: readonly FokusKarte[];
  gewaehlt: number | null; gezeigt: number | null; halten: boolean; vorschlag: number | null;
}): number | null {
  const da = (id: number | null): id is number =>
    id != null && (o.links.some((k) => k.personId === id) || o.rechts.some((k) => k.personId === id));
  if (da(o.gewaehlt)) return o.gewaehlt;
  if (o.halten && da(o.gezeigt)) return o.gezeigt;
  if (da(o.vorschlag)) return o.vorschlag;
  return fokusWahl(o.links, o.rechts);
}

/** Eine Karte der Arbeitsliste (Server oder Seite) → das, was die Fokuswahl braucht. */
export function fokusKarte(k: {
  personId: number; tier: number; band?: number | null; jetzt?: boolean;
  hitze?: { sofort?: boolean } | null;
}): FokusKarte {
  return { personId: Number(k.personId), tier: Number(k.tier), band: k.band ?? null, sofort: k.hitze?.sofort === true, jetzt: k.jetzt === true };
}

/**
 * Die ehrliche Kopfzeile der linken Spalte (E-391): Steht links kein A/B mehr
 * (nur C oder gar nichts), sagt sie das — und wie viele A/B rechts warten.
 * null, solange links ein A/B steht.
 */
export function neuKopfzeile(links: readonly { tier: number }[], wiederAb: number): string | null {
  if (links.some((k) => istAB(Number(k.tier)))) return null;
  const n = Math.max(0, Math.floor(Number(wiederAb) || 0));
  if (n === 0) return "Alle neuen A/B sind angerufen.";
  return `Alle neuen A/B sind angerufen — ${n} A/B ${n === 1 ? "wartet" : "warten"} rechts.`;
}
