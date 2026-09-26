// ═══════════════════════════════════════════════════════════════════════════
// DER ZAHLUNGSAUFTRAG — eine Referenz, ein Ergebnis (02.09.2026)
//
// Die Zahlungsseite /zahlung/:ref und der QR-Code in den Mails brauchen
// dieselbe Antwort auf dieselbe Frage: „Was soll zu dieser Referenz bezahlt
// werden?" Bis heute kannte die Seite nur Bestellungen (FIAON-XXXXXX). Seit
// dem Kontowechsel und Justins Auftrag „so einfach zahlen wie möglich" gilt
// dasselbe für Monatsraten (FIAON-XXXXXX-N): eigene Seite, eigener QR-Code,
// Verwendungszweck = Ratenreferenz, damit der Eingang automatisch bucht.
//
// Was hier NICHT passiert: keine Kundendaten außer Vorname und Paket. Die
// Seite ist ohne Anmeldung erreichbar — die Referenz ist der Schlüssel.
// Bezahlt wird seit dem 19.09.2026 ausschließlich per Überweisung (E-194).
// Seit dem 26.09.2026 (E-243) kommt bei einer Bonitätsauskunft dazu, was die
// Seite für ihre eigenen Sätze braucht: Art, Land (nur als Auskunfteien-Name),
// ob ein Paket läuft (ja/nein), welcher Hinweis zur Karte gilt (paketSchritt, nur
// die Art — nie die Referenz einer anderen Bestellung) und ggf. der Beginn nach der
// Widerrufsfrist — keine Anschrift, kein Geburtsdatum, keine Mail.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import { BANK } from "@shared/fiaon-bank";
import { epcQrNutzlast } from "@shared/fiaon-epc-qr";
import { istGlobalPaket, paket as katalogPaket } from "@shared/fiaon-pakete";
import { globalPaket } from "@shared/fiaon-global";
import {
  AUSKUNFT_SCHLUESSEL, auskunftLand, auskunfteienText, istAuskunftSchluessel,
  type AuskunftArt, type AuskunftLand,
} from "@shared/fiaon-auskunft";
import { produktkategorie } from "./fiaon-produktkategorie";
import { hatLaufendesPaket, auskunftPaketSchritt } from "./fiaon-auskunft";

export interface Zahlungsauftrag {
  art: "bestellung" | "rate";
  paymentReference: string;
  /** pending_payment | claimed_paid | paid | … (Bestellung) — Raten: offen → pending_payment, bezahlt → paid, storniert → cancelled */
  status: string;
  dueDate: string | null;
  amountDue: string;
  currency: string;
  firstName: string;
  packName: string;
  rateNr?: number;
  ratenVon?: number;
  /**
   * E-188 (17.09.2026): ein Firmenauftrag über FIAON Global — Einmalpreis, kein
   * Konto, das „aktiviert" wird, keine Karte „unterwegs". Die Zahlungsseite
   * spricht dann das Unternehmen an (der Firmenname ist keine Personenangabe)
   * und lässt alle Sätze der Privatkundenlinie weg.
   */
  firmenauftrag?: boolean;
  firmenName?: string;
  /**
   * Nur beim Firmenauftrag: die Sprache, in der das Unternehmen seinen Auftrag geführt hat
   * (fiaon_global_auftraege.vertrag_sprache). Wer auf /en/business/start unterschrieben hat,
   * liest die Zahlungsseite englisch (kleines Wörterbuch in client/src/pages/zahlung.tsx).
   */
  sprache?: "de" | "en";
  /**
   * DIE AUSKUNFT HAT IHRE EIGENE ZAHLUNGSSEITE (26.09.2026, E-243)
   * Justin: „Warum die gleiche Zahlungsseite für Nicht-Kunden — da steht ‚Konto
   * aktivieren', die bestellen ja nur die Auskunft!" Nur bei einer Bestellung der
   * Produktkategorie „auskunft" gesetzt (fiaon-produktkategorie.ts: type schufa,
   * Referenz FIAON-SCHUFA-… oder einer der vier Auskunft-Schlüssel). Für Pakete,
   * Raten und FIAON Global bleibt die Antwort, wie sie war — ohne diese Felder.
   */
  produkt?: "auskunft";
  /** privat (149/74 €) oder firma (349/199 €) — aus dem Katalogschlüssel der Bestellung. */
  auskunftArt?: AuskunftArt;
  /** Land der Bestellung — AT und CH lesen nie „SCHUFA". */
  land?: AuskunftLand;
  /** Die Auskunfteien des Landes als Satzteil („SCHUFA, CRIF und Creditreform Boniversum"). */
  auskunfteien?: string;
  /**
   * Hat dieser Mensch HEUTE ein bezahltes, laufendes Paket (hatLaufendesPaket)?
   * Nur dann kein Hinweis „Ihr nächster Schritt zur Karte" auf der Dankeseite.
   * Ohne Person: der Katalogschlüssel der Bestellung (Kundenpreis = mit Paket).
   */
  mitAbo?: boolean;
  /** Die Bestellung läuft zum Kundenpreis mit Paket (74 € bzw. 199 €) UND der Mensch hat ein laufendes Paket. */
  kundenpreis?: boolean;
  /**
   * Nur wenn der Kunde den Beginn vor Ablauf der Widerrufsfrist NICHT verlangt hat und
   * die Frist noch läuft: der erste Tag der Beschaffung („10.10.2026", Berlin) —
   * dieselbe Regel wie die Lieferung (auskunftWiderrufStand). Sonst fehlt das Feld.
   */
  beginnAb?: string;
  /**
   * Darf die Dankeseite den ruhigen Hinweis „Ihr nächster Schritt zur Karte" zeigen — und welchen?
   * (26.09.2026, E-243, Gegenlese) DIESELBE Regel wie „Ihre Auskunft ist da" (auskunftPaketSchritt):
   * null bei laufendem Paket, Werbe-/Vertriebssperre, Testkonto, Kündigung, Vertragsende,
   * storniertem Paket oder gemeldeter Paketzahlung und ohne Person — „neu" = der Antrag,
   * „antrag" = ein fertiger Paket-Antrag wartet auf die erste Zahlung (kein zweiter Antrag).
   * Nur die Art, nie die Adresse der anderen Bestellung (die Seite ist öffentlich, die
   * Referenz ist der Schlüssel).
   */
  paketSchritt?: "neu" | "antrag" | null;
}

// E-230: Auch das neue Bestellformat ohne Bindestrich (FIAONXXXXXX-N). Vorher
// führte jede Rate dieser Bestellungen auf „Bestellung nicht gefunden" (404) —
// 135 Bestellungen im neuen Format, auch die Links in den Raten-Mails.
const RATEN_MUSTER = /^FIAON-?[A-Z0-9]{6}-(\d{1,2})$/i;

export async function zahlungsauftragFinden(refRoh: string): Promise<Zahlungsauftrag | null> {
  const ref = String(refRoh || "").trim().toUpperCase();
  if (!ref) return null;

  if (RATEN_MUSTER.test(ref)) {
    const [r] = (await sqlPool`
      SELECT r.zahlungsreferenz, r.status, r.betrag_cents, r.faellig_am, r.rate_nr,
             a.first_name, a.pack_name, a.currency
      FROM fiaon_abo_raten r
      JOIN fiaon_applications a ON a.ref = r.ref
      WHERE UPPER(r.zahlungsreferenz) = ${ref}
      ORDER BY r.id DESC LIMIT 1
    `) as any[];
    if (!r) return null;
    const status = r.status === "bezahlt" ? "paid" : r.status === "storniert" ? "cancelled" : "pending_payment";
    return {
      art: "rate",
      paymentReference: r.zahlungsreferenz,
      status,
      dueDate: r.faellig_am ? new Date(r.faellig_am).toISOString() : null,
      amountDue: (Number(r.betrag_cents) / 100).toFixed(2),
      currency: r.currency || "EUR",
      firstName: r.first_name || "",
      packName: r.pack_name || "",
      rateNr: Number(r.rate_nr) || undefined,
      ratenVon: 12,
    };
  }

  const [a] = (await sqlPool`
    SELECT ref, type, payment_reference, payment_status, payment_due_date, amount_due, currency, first_name, pack_name, pack_key,
           company_name, country, person_id
    FROM fiaon_applications WHERE payment_reference = ${ref} LIMIT 1
  `) as any[];
  if (!a) return null;
  // E-243: Die Bonitätsauskunft ist kein Konto, das „aktiviert" wird — eigene Seite, eigene Sätze.
  if (produktkategorie({ type: a.type, ref: a.ref, pack_key: a.pack_key }) === "auskunft") {
    return auskunftAuftrag(a);
  }
  const firmenauftrag = istGlobalPaket(a.pack_key);
  // Die Sprache steht in der Auftragsakte. Fehlt die Akte (Bestellung außerhalb des Bestellwegs) oder
  // die Tabelle, bleibt die Seite deutsch — die Zahlungsseite darf daran nie scheitern.
  let sprache: "de" | "en" = "de";
  if (firmenauftrag) {
    const [g] = (await sqlPool`SELECT vertrag_sprache FROM fiaon_global_auftraege WHERE ref = ${a.ref} LIMIT 1`.catch(() => [])) as any[];
    if (String(g?.vertrag_sprache ?? "").toLowerCase() === "en") sprache = "en";
  }
  const enName = sprache === "en" ? globalPaket(a.pack_key)?.en.name : null;
  return {
    art: "bestellung",
    paymentReference: a.payment_reference,
    status: a.payment_status,
    dueDate: a.payment_due_date ? new Date(a.payment_due_date).toISOString() : null,
    amountDue: String(a.amount_due),
    currency: a.currency || "EUR",
    // Beim Firmenauftrag steht oben die Firma, nicht ein Vorname.
    firstName: firmenauftrag ? "" : (a.first_name || ""),
    packName: firmenauftrag ? (enName ? `FIAON ${enName}` : (katalogPaket(a.pack_key)?.label ?? a.pack_name ?? "")) : (a.pack_name || ""),
    ...(firmenauftrag ? { firmenauftrag: true, firmenName: String(a.company_name || ""), sprache } : {}),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE AUSKUNFT-BESTELLUNG AUF DER ZAHLUNGSSEITE (26.09.2026, E-243)
//
// Was die Seite braucht, um von der Auskunft zu sprechen statt vom Paket: Art
// (privat/firma), Land und seine Auskunfteien, ob der Mensch ein laufendes Paket
// hat (nur ohne Paket zeigt die Dankeseite den ruhigen Hinweis „Ihr nächster
// Schritt zur Karte") und — falls der Kunde den Beginn erst nach der
// Widerrufsfrist gewählt hat — ab wann beschafft wird. Jede Zusatzabfrage darf
// scheitern: Die Zahlungsseite muss immer stehen, im Zweifel ohne Hinweis.
//
// Den Namen setzt die Seite neu („Bonitätsauskunft inkl. Handlungsplan"):
// Sechs Altbestellungen tragen im pack_name das Stufenpaket ihres Kunden
// (fiaon-produktkategorie.ts) — dort stand sonst „FIAON Ultra" über einer Auskunft.
// ═══════════════════════════════════════════════════════════════════════════
const AUSKUNFT_NAME: Record<AuskunftArt, string> = {
  privat: "Bonitätsauskunft inkl. Handlungsplan",
  firma: "Firmen-Bonitätsauskunft inkl. Handlungsplan",
};

async function auskunftAuftrag(a: any): Promise<Zahlungsauftrag> {
  const key = String(a.pack_key ?? "").trim().toLowerCase();
  const art: AuskunftArt = key === AUSKUNFT_SCHLUESSEL.firma.einzeln || key === AUSKUNFT_SCHLUESSEL.firma.mitAbo ? "firma" : "privat";
  const land = auskunftLand(a.country);
  // Der Schlüssel sagt, zu welchem Preis bestellt wurde; nur die vier Auskunft-Schlüssel zählen
  // (eine Altbestellung mit Stufenpaket im pack_key ist kein Beleg für einen Kundenpreis).
  const schluesselMitAbo = istAuskunftSchluessel(key) && (key === AUSKUNFT_SCHLUESSEL.privat.mitAbo || key === AUSKUNFT_SCHLUESSEL.firma.mitAbo);
  let mitAbo = schluesselMitAbo;
  const personId = a.person_id != null ? Number(a.person_id) : null;
  if (personId != null && Number.isFinite(personId)) {
    try {
      mitAbo = await hatLaufendesPaket(personId);
    } catch (e) {
      console.warn("[ZAHLUNGSAUFTRAG] Paketstand nicht lesbar — Rückfall auf den Schlüssel:", String((e as Error)?.message || e).slice(0, 160));
    }
  }
  // Gegenlese 26.09.2026 (E-243): Der Hinweis zur Karte folgt denselben Sperren wie die Mail
  // „Ihre Auskunft ist da" — vorher hing er nur an „kein laufendes Paket" und hätte Gekündigten,
  // Stornierten, Werbe-/Vertriebssperren und Menschen mit offenem Paket-Antrag einen neuen
  // Antrag angeboten. Scheitert die Abfrage: kein Hinweis (im Zweifel still).
  let paketSchritt: "neu" | "antrag" | null = null;
  if (personId != null && Number.isFinite(personId) && !mitAbo) {
    try {
      paketSchritt = (await auskunftPaketSchritt(personId))?.variante ?? null;
    } catch (e) {
      console.warn("[ZAHLUNGSAUFTRAG] Paketschritt nicht lesbar — kein Hinweis:", String((e as Error)?.message || e).slice(0, 160));
    }
  }
  let beginnAb: string | undefined;
  if (art === "privat") {
    try {
      const { auskunftWiderrufStand } = await import("./fiaon-auskunft-lieferung");
      const w = await auskunftWiderrufStand(String(a.ref));
      if (w.warten && w.abText) beginnAb = w.abText;
    } catch (e) {
      console.warn("[ZAHLUNGSAUFTRAG] Widerrufsstand nicht lesbar:", String((e as Error)?.message || e).slice(0, 160));
    }
  }
  return {
    art: "bestellung",
    paymentReference: a.payment_reference,
    status: a.payment_status,
    dueDate: a.payment_due_date ? new Date(a.payment_due_date).toISOString() : null,
    amountDue: String(a.amount_due),
    currency: a.currency || "EUR",
    firstName: a.first_name || "",
    packName: AUSKUNFT_NAME[art],
    ...(art === "firma" && String(a.company_name || "").trim() ? { firmenName: String(a.company_name).trim() } : {}),
    produkt: "auskunft",
    auskunftArt: art,
    land,
    auskunfteien: auskunfteienText(land),
    mitAbo,
    kundenpreis: mitAbo && schluesselMitAbo,
    paketSchritt,
    ...(beginnAb ? { beginnAb } : {}),
  };
}

// ── KEINE SOFORTZAHLUNG MEHR (19.09.2026, E-194) ─────────────────────────────
// Die „Sofortzahlung per Bank-App" lief über GoCardless (Instant Bank Pay). Die
// Zusammenarbeit ist beendet — bezahlt wird per Überweisung mit den Daten unten
// (Zahlungsmail, Zahlungsseite, GiroCode). sofortUrlFuer/sofortErlaubt sind
// entfernt; Mails und Seiten bieten keinen Bank-App-Knopf mehr an.

/** Die GiroCode-Nutzlast zu einem Auftrag — Bankdaten IMMER aus der einen Quelle. */
export function zahlungsauftragQrNutzlast(z: Zahlungsauftrag): string {
  return epcQrNutzlast({
    recipient: BANK.empfaenger,
    iban: BANK.iban,
    bic: BANK.bic,
    amount: Number(z.amountDue) || 0,
    remittance: z.paymentReference,
  });
}
