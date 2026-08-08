// ═══════════════════════════════════════════════════════════════════════════
// PRODUKTSTAND — eine Zeile statt fünf offener Bestellungen
//
// In der Akte standen bis zum 08.08.2026 alle Bestellungen gleichwertig
// untereinander: fünf Zeilen kreuz und quer, teils ersetzt, teils offen, und
// niemand konnte am Telefon sagen, WAS der Kunde eigentlich hat.
//
// Ein Konto hat GENAU EINE Stufe (Starter/Pro/Ultra/High End, geschäftlich
// entsprechend) und dazu beliebige Zusatzprodukte (heute: Bonitätsauskunft). Also
// ist das die richtige Zeile:
//
//     Ultra (79,99 €/M) + Bonitätsauskunft
//
// Alles andere — ersetzte, storniert, archivierte Bestellungen — gehört darunter
// und eingeklappt. Es ist nicht weg, es ist nur nicht die Antwort auf die Frage
// „was hat dieser Kunde?".
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { OFFENE_STUFE } from "./fiaon-produkt-hygiene";

type Lauf = typeof sqlPool;

/** Ist diese Bestellung ein Zusatzprodukt (statt einer Kontostufe)? */
export function istZusatzprodukt(row: { type?: unknown; ref?: unknown }): boolean {
  return String(row?.type ?? "").toLowerCase() === "schufa"
    || String(row?.ref ?? "").startsWith("FIAON-SCHUFA-");
}

/** Kurzname eines Pakets: „FIAON Ultra\n(Elite Konto)" → „Ultra". */
export function paketKurz(packName: unknown, packKey?: unknown): string | null {
  const roh = String(packName ?? "").split("\n")[0].trim();
  if (roh) {
    const ohneMarke = roh.replace(/^FIAON\s+/i, "").trim();
    return ohneMarke || roh;
  }
  const key = String(packKey ?? "").trim();
  if (!key) return null;
  const namen: Record<string, string> = {
    start: "Starter", pro: "Pro", ultra: "Ultra", highend: "High End",
    business_starter: "Business Starter", business_pro: "Business Pro",
    business_ultra: "Business Ultra", business_enterprise: "Business Enterprise",
  };
  return namen[key] ?? key;
}

export interface ProduktZeile {
  /** Die EINE Zeile für Karte und Akte. */
  text: string;
  /** Die maßgebliche Stufe, falls es eine gibt. */
  stufe: { ref: string; name: string; betragCent: number | null; zahlungsstatus: string } | null;
  zusatz: { ref: string; name: string; betragCent: number | null; zahlungsstatus: string }[];
  /** Ersetzt, storniert, archiviert — darunter, eingeklappt. */
  stillgelegt: { ref: string; name: string; zahlungsstatus: string; grund: string }[];
  /** Mehr als eine LEBENDE offene Stufe? Dann stimmt etwas nicht. */
  mehrfachStufe: boolean;
}

const euro = (cent: number | null): string =>
  cent == null ? "" : `${(cent / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

/**
 * Der Produktstand einer Person.
 *
 * Maßgeblich für die Stufe ist: bezahlt schlägt gemeldet schlägt offen. Bei
 * Gleichstand die jüngere Bestellung — der Kunde hat sich zuletzt so entschieden.
 */
export async function produktstand(personId: number, lauf: Lauf = sqlPool): Promise<ProduktZeile> {
  const zeilen = await lauf`
    SELECT ${lauf.unsafe(PRODUKT_SPALTEN)}
    FROM fiaon_applications
    WHERE person_id = ${personId} AND merged_into IS NULL
    ORDER BY rang DESC, created_at DESC
  `;
  return zeileAus(zeilen as any[]);
}

/**
 * Derselbe Produktstand über eine VORGEGEBENE Menge von Bestellungen.
 *
 * Die Kundenakte fasst eine Person über gleiche E-Mail oder Telefonnummer
 * zusammen, nicht über `person_id` (Kopf von `server/routes/fiaon-kunden.ts`).
 * Nimmt man dort den Produktstand nach `person_id`, zeigt die Akte in der einen
 * Zeile ein anderes Produkt als in der Liste direkt darunter.
 */
export async function produktstandFuerBestellungen(refs: string[], lauf: Lauf = sqlPool): Promise<ProduktZeile> {
  const sauber = Array.from(new Set(refs.filter(Boolean).map(String)));
  if (sauber.length === 0) return zeileAus([]);
  const zeilen = await lauf`
    SELECT ${lauf.unsafe(PRODUKT_SPALTEN)}
    FROM fiaon_applications
    WHERE ref = ANY(${sauber}) AND merged_into IS NULL
    ORDER BY rang DESC, created_at DESC
  `;
  return zeileAus(zeilen as any[]);
}

/** Die Spalten, aus denen der Produktstand folgt — an einer Stelle, für beide Wege. */
const PRODUKT_SPALTEN = `
  ref, pack_name, pack_key, type, amount_due, payment_status, archived_at,
  superseded_by, created_at,
  CASE payment_status
    WHEN 'paid' THEN 60 WHEN 'claimed_paid' THEN 50
    WHEN 'pending_payment' THEN 40 WHEN 'expired' THEN 35
    WHEN 'pending' THEN 30 ELSE 10 END AS rang`;

function zeileAus(zeilen: any[]): ProduktZeile {
  const lebt = (r: any) => !r.archived_at
    && !["superseded", "cancelled", "refunded"].includes(String(r.payment_status));

  const stufen = (zeilen as any[]).filter((r) => lebt(r) && !istZusatzprodukt(r));
  const zusatzProdukte = (zeilen as any[]).filter((r) => lebt(r) && istZusatzprodukt(r));
  const tote = (zeilen as any[]).filter((r) => !lebt(r));

  const alsEintrag = (r: any) => ({
    ref: String(r.ref),
    name: paketKurz(r.pack_name, r.pack_key) ?? "Bestellung",
    betragCent: r.amount_due != null ? Math.round(Number(r.amount_due) * 100) : null,
    zahlungsstatus: String(r.payment_status ?? ""),
  });

  const stufe = stufen.length > 0 ? alsEintrag(stufen[0]) : null;
  const zusatz = zusatzProdukte.map(alsEintrag);

  const teile: string[] = [];
  if (stufe) {
    teile.push(stufe.betragCent != null ? `${stufe.name} (${euro(stufe.betragCent)}/M)` : stufe.name);
  }
  for (const z of zusatz) teile.push(z.name);

  return {
    text: teile.length > 0 ? teile.join(" + ") : "kein Produkt",
    stufe,
    zusatz,
    stillgelegt: tote.map((r) => ({
      ref: String(r.ref),
      name: paketKurz(r.pack_name, r.pack_key) ?? "Bestellung",
      zahlungsstatus: String(r.payment_status ?? ""),
      grund: r.archived_at
        ? "archiviert"
        : r.payment_status === "superseded"
          ? `ersetzt durch ${r.superseded_by ?? "eine neuere Bestellung"}`
          : String(r.payment_status ?? ""),
    })),
    // Mehr als eine OFFENE Stufe ist der Zustand, den Teil 4 abschafft: zwei
    // Rechnungen, zwei Verwendungszwecke, zwei Mahnketten. Eine bezahlte Stufe
    // neben einer neu bestellten ist dagegen ein Upgrade und völlig in Ordnung —
    // der erste Entwurf hat genau das als Fehler gemeldet.
    //
    // Maßgeblich ist dieselbe Liste, nach der die Produkt-Hygiene aufräumt
    // (`OFFENE_STUFE`). Vorher zählte auch ein `pending`-Entwurf mit: Die Akte
    // verlangte dann eine Bereinigung, die der Lauf zu Recht verweigerte, weil
    // an einem nie abgeschickten Antrag nichts stillzulegen ist.
    mehrfachStufe: stufen.filter((r: any) => OFFENE_STUFE.includes(String(r.payment_status) as any)).length > 1,
  };
}
