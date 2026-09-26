// ═══════════════════════════════════════════════════════════════════════════
// DIE AUSKUNFT BESTELLEN — EIN WEG FÜR ALLE TÜREN (24.09.2026, E-240)
//
// Bisher gab es drei Anlagestellen mit drei Regeln: die Kundenseite
// (POST /payment-order kind=schufa), die Mitarbeiter-Akte
// (/agent/customers/:ref/produkt) und das Assistenten-Werkzeug — und Mara
// hatte gar keine. Folge: Doris Hösl schrieb „Ich hab keine", und Mara konnte
// nur „fordern Sie sie in Ihrem Bereich an" antworten.
//
// Hier steht der EINE Weg: Preis prüfen (mit Paket 74 €, ohne 149 €; Firma
// 199/349 €), eine offene Bestellung wiederverwenden statt eine zweite
// Zahlungsaufforderung zu erzeugen, sonst anlegen und über bestellungFuerAntrag
// Zahlungsreferenz, Rechnung und Zahlungsmail erzeugen. Rückgabe: der Link zur
// Zahlungsseite — den schickt Mara, den zeigt der Kundenbereich.
//
// Der Preis kommt NIE aus dem Browser oder vom Modell.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { absoluteUrl } from "../fiaon-base-url";
import { istAboPaket, istGlobalPaket } from "@shared/fiaon-pakete";
import {
  auskunftPreisCents, auskunftSchluessel, auskunftLand, euroText, ALLE_AUSKUNFT_SCHLUESSEL, AUSKUNFT_SCHLUESSEL,
  AUSKUNFT_BESCHAFFUNG_VERMERK, AUSKUNFT_BESCHAFFUNGSAUFTRAG_TEXT, AUSKUNFT_AUFTRAG_FASSUNG,
  type AuskunftArt, type AuskunftLand,
} from "@shared/fiaon-auskunft";
import {
  BUENDEL_WUNSCH_VERMERK, BUENDEL_ANLAGE_VERMERK, BUENDEL_FASSUNG, BUENDEL_SOFORT_TEXT,
  buendelArt, buendelHakenText, buendelPreisText,
} from "@shared/fiaon-auskunft-buendel";

type Lauf = typeof sqlPool;

/** Wie lange eine offene Bestellung wiederverwendet wird, statt eine neue anzulegen. */
const OFFEN_WIEDERVERWENDEN_TAGE = 21;

/**
 * Hat dieser Mensch ein bezahltes, laufendes Paket (Abo)? Dann gilt der
 * Kundenpreis. Gekündigt heißt nicht vorbei: bis `vertrag_ende_am` läuft es.
 */
export async function hatLaufendesPaket(personId: number, lauf: Lauf = sqlPool): Promise<boolean> {
  const zeilen = (await lauf`
    SELECT pack_key FROM fiaon_applications
     WHERE person_id = ${personId} AND merged_into IS NULL AND payment_status = 'paid'
       AND cancelled_at IS NULL AND (vertrag_ende_am IS NULL OR vertrag_ende_am > NOW())
       AND COALESCE(type, '') <> 'schufa' AND ref NOT LIKE 'FIAON-SCHUFA-%'`) as any[];
  return zeilen.some((z) => istAboPaket(z.pack_key));
}

/**
 * Welche Auskunft passt — privat oder für die Firma? (25.09.2026, E-240)
 * EINE Regel für alle Türen: Ein laufendes FIAON-Business-Paket heißt
 * Firmen-Auskunft (199/349 €), alles andere privat. Vorher entschieden
 * Postmeister und Takt so, Unterlagen-Mail, Kundenbereich und Mara auf WhatsApp
 * boten dieselben Menschen privat an (6 Business-Kunden, 24.09.).
 */
export async function auskunftArtFuer(personId: number, lauf: Lauf = sqlPool): Promise<AuskunftArt> {
  const [z] = (await lauf`
    SELECT LOWER(TRIM(COALESCE(pack_key, ''))) AS k FROM fiaon_applications
     WHERE person_id = ${personId} AND merged_into IS NULL AND payment_status = 'paid' AND cancelled_at IS NULL
       AND (vertrag_ende_am IS NULL OR vertrag_ende_am > NOW())
       AND COALESCE(type, '') <> 'schufa' AND ref NOT LIKE 'FIAON-SCHUFA-%'
     ORDER BY paid_at DESC NULLS LAST, created_at DESC LIMIT 1
  `.catch(() => [])) as any[];
  return String(z?.k || "").startsWith("business_") ? "firma" : "privat";
}

export interface AuskunftPreis { art: AuskunftArt; mitAbo: boolean; cents: number; key: string; text: string }

/** Der Preis für DIESEN Menschen — die einzige Stelle, die das entscheidet. */
export async function auskunftPreis(personId: number | null, art: AuskunftArt = "privat", lauf: Lauf = sqlPool): Promise<AuskunftPreis> {
  const mitAbo = personId != null && (await hatLaufendesPaket(personId, lauf));
  const cents = auskunftPreisCents(art, mitAbo);
  return { art, mitAbo, cents, key: auskunftSchluessel(art, mitAbo), text: euroText(cents) };
}

export type AuskunftStufe = "bezahlt" | "offen" | "dokument" | "nichts";

export interface AuskunftStand {
  stufe: AuskunftStufe;
  /**
   * Die offene Bestellung (Zahlung ausstehend oder gemeldet). `art` (Integration 26.09.2026, E-243):
   * privat oder Firma nach ihrem Katalogschlüssel — für offenWiederverwendbar (ihr Betrag gegen den
   * Preis, der HEUTE für genau dieses Produkt gilt).
   */
  offen: { ref: string; paymentReference: string | null; betragCents: number; status: string; angelegt: string; art?: AuskunftArt } | null;
  bezahltRef: string | null;
  /** Liegt ein Auskunft-Dokument in der Akte (gekauft oder selbst hochgeladen)? */
  dokumentDa: boolean;
  land: AuskunftLand;
  preis: AuskunftPreis;
}

/**
 * Wo steht dieser Mensch bei der Auskunft? „nichts" = verkaufen, „offen" =
 * Zahlungslink statt neuer Bestellung, „bezahlt"/„dokument" = nicht verkaufen.
 */
export async function auskunftStand(
  personId: number, lauf: Lauf = sqlPool, art: AuskunftArt = "privat",
  /** E-241: `land: false` = nur der Kaufstand gefragt (Türen, Takt) — spart die Abfrage der Grundmenge bei Leads. */
  opts: { land?: boolean } = {},
): Promise<AuskunftStand> {
  const [z] = (await lauf`
    SELECT
      (SELECT country FROM fiaon_applications WHERE person_id = ${personId} AND merged_into IS NULL AND country IS NOT NULL
        ORDER BY (payment_status = 'paid') DESC, created_at DESC LIMIT 1) AS land,
      EXISTS (SELECT 1 FROM fiaon_applications d WHERE d.person_id = ${personId} AND d.gdpr_deleted_at IS NULL AND d.schufa_pdf IS NOT NULL) AS dokument_da,
      (SELECT ref FROM fiaon_applications s WHERE s.person_id = ${personId} AND s.merged_into IS NULL
         AND (COALESCE(s.type, '') = 'schufa' OR s.ref LIKE 'FIAON-SCHUFA-%') AND s.payment_status = 'paid'
       ORDER BY s.created_at DESC LIMIT 1) AS bezahlt_ref`) as any[];
  const [o] = (await lauf`
    SELECT ref, payment_reference, amount_due, payment_status, created_at, pack_key FROM fiaon_applications s
     WHERE s.person_id = ${personId} AND s.merged_into IS NULL
       AND (COALESCE(s.type, '') = 'schufa' OR s.ref LIKE 'FIAON-SCHUFA-%')
       AND s.payment_status IN ('pending_payment', 'claimed_paid')
     ORDER BY s.created_at DESC LIMIT 1`) as any[];
  const preis = await auskunftPreis(personId, art, lauf);
  const offenKey = String(o?.pack_key ?? "").trim().toLowerCase();
  const offen = o ? {
    ref: String(o.ref), paymentReference: o.payment_reference ?? null,
    betragCents: Math.round(Number(o.amount_due || 0) * 100), status: String(o.payment_status),
    angelegt: new Date(o.created_at).toISOString(),
    art: (offenKey === AUSKUNFT_SCHLUESSEL.firma.einzeln || offenKey === AUSKUNFT_SCHLUESSEL.firma.mitAbo ? "firma" : "privat") as AuskunftArt,
  } : null;
  const stufe: AuskunftStufe = z?.bezahlt_ref ? "bezahlt" : offen ? "offen" : z?.dokument_da ? "dokument" : "nichts";
  // Integration 25.09.2026 (E-241): Ohne Land im Antrag (Leads) gilt das Land der Grundmenge (landOhneAntrag).
  const land = String(z?.land ?? "").trim() || opts.land === false
    ? auskunftLand(z?.land) : ((await landOhneAntrag(personId, lauf)) ?? "DE");
  return { stufe, offen, bezahltRef: z?.bezahlt_ref ?? null, dokumentDa: !!z?.dokument_da, land, preis };
}

/**
 * Das Land eines Menschen, dessen Anträge kein Land tragen (Integration
 * 25.09.2026, E-241) — vor allem Leads: Sie geben im Formular kein Land an
 * (gemessen 25.09.: alle 3.036 Leads ohne Antrag ohne country). Dieselbe Regel
 * wie die Grundmenge des Verkaufstakts (personImPool: Land der Person, sonst
 * Vorwahl +43/+41, Kampagne, Adress-Endung .at/.ch — LAND_HINWEIS_SQL in
 * fiaon-auskunft-verkauf.ts). Vorher las ein Lead aus Wien in der Angebots-Mail
 * und bei Mara „KSV1870", auf der Kaufseite, in der Bestellung und in der
 * Beschaffung aber „SCHUFA". null = kein Hinweis (dann Deutschland).
 */
async function landOhneAntrag(personId: number, lauf: Lauf): Promise<AuskunftLand | null> {
  try {
    const { personImPool } = await import("./fiaon-auskunft-verkauf");
    const z = await personImPool(personId, lauf);
    if (z) return z.land;
  } catch (e) {
    console.warn("[AUSKUNFT] Land aus der Grundmenge nicht lesbar — Rückfall auf die Person:", String((e as Error)?.message || e).slice(0, 160));
  }
  const [p] = (await lauf`SELECT country FROM fiaon_persons WHERE id = ${personId} LIMIT 1`.catch(() => [])) as any[];
  return String(p?.country ?? "").trim() ? auskunftLand(p.country) : null;
}

/**
 * Darf diese offene Auskunft-Bestellung wiederverwendet werden — ihr Zahlungslink statt einer
 * neuen Bestellung? (Integration 26.09.2026, E-243) Die EINE Regel für auskunftBestellen und die
 * Kaufseite hinter dem Kauflink (GET /auskunft/bestellen):
 *   · „Zahlung gemeldet" immer — er hat überwiesen, nie eine zweite Forderung daneben,
 *   · sonst nur, wenn sie jünger als 21 Tage ist UND nicht teurer als der Preis, der HEUTE für
 *     genau dieses Produkt (privat/Firma, nach ihrem Schlüssel) gilt.
 * Justin: „Wie stellen wir sicher, dass FIAON-Kunden den Preis bekommen (privat 74 €, B2B 199 €)?"
 * Vorher führte jeder Kauflink eines Kunden, der VOR seinem Paket zum Einzelpreis bestellt hatte,
 * bis zu 21 Tage lang auf die 149-€-Zahlungsseite (Mail, WhatsApp, Mara, Kundenpreis-Link). Jetzt
 * ersetzt die Bestellung zum heutigen Preis die teurere (superseded_by zeigt auf die neue; eine
 * späte Überweisung auf die alte Referenz bleibt auflösbar, die Zahlungsseite sagt „ersetzt").
 * Ohne Betrag (Altlast) wird ebenfalls neu angelegt — wie im Bündel (auskunftBuendelNachZahlung).
 */
export function offenWiederverwendbar(stand: Pick<AuskunftStand, "offen" | "preis">, jetzt: number = Date.now()): boolean {
  const o = stand.offen;
  if (!o) return false;
  if (o.status === "claimed_paid") return true;
  if (jetzt - new Date(o.angelegt).getTime() >= OFFEN_WIEDERVERWENDEN_TAGE * 86_400_000) return false;
  const heute = auskunftPreisCents(o.art ?? stand.preis.art, stand.preis.mitAbo);
  return o.betragCents > 0 && o.betragCents <= heute;
}

/**
 * Der Stand, wie ihn ein Kaufweg dem Kunden ZEIGT (Integration 26.09.2026, E-243): Eine offene
 * Bestellung, die auskunftBestellen nicht wiederverwenden würde (offenWiederverwendbar: älter als
 * 21 Tage oder teurer als heute), gilt nicht als „offen" — kein Link auf ihre Zahlungsseite, sondern
 * der Kauf zum heutigen Preis (der legt die neue an und ersetzt die alte). Für Kundenbereich, Mara
 * (Mail und WhatsApp), Unterlagen-Mail: dieselbe Antwort wie die Kaufseite. auskunftBestellen und das
 * Bündel lesen weiter den rohen Stand (sie brauchen die alte Bestellung zum Ersetzen).
 */
export function standZumZeigen<T extends Pick<AuskunftStand, "stufe" | "offen" | "preis" | "dokumentDa">>(stand: T): T {
  if (stand.stufe !== "offen" || !stand.offen || offenWiederverwendbar(stand)) return stand;
  return { ...stand, offen: null, stufe: stand.dokumentDa ? "dokument" : "nichts" };
}

// 26.09.2026 (E-243): „antrag_buendel" — der Zusatz im Antrag, angelegt nach der ersten Paketzahlung (auskunftBuendelNachZahlung).
export type AuskunftQuelle = "kunde" | "kundenbereich" | "mara_mail" | "mara_wa" | "betreuer" | "assistent" | "verkaufstakt" | "oeffentlich" | "antrag_buendel";

export interface AuskunftBestellung {
  ok: boolean;
  /** neu angelegt, offene wiederverwendet, oder schon bezahlt (nichts angelegt) */
  art: "neu" | "offen" | "bezahlt";
  ref: string | null;
  paymentReference: string | null;
  betragCents: number;
  betragText: string;
  mitAbo: boolean;
  zahlungsseite: string | null;
  fehler?: string;
}

/**
 * Die Auskunft für einen bekannten Menschen bestellen. Idempotent: Ist eine
 * Bestellung offen (jünger als 21 Tage), kommt ihr Zahlungslink zurück; ist sie
 * bezahlt, wird nichts angelegt.
 *
 * Die Stammdaten kommen aus seiner jüngsten Zeile (Paket vor allem anderen) —
 * die Auskunft hängt an derselben Person, damit Akte, Betreuer und Unterlagen
 * sie finden.
 */
export async function auskunftBestellen(ein: {
  personId: number;
  art?: AuskunftArt;
  quelle: AuskunftQuelle;
  /** Wer es ausgelöst hat — für den Verlauf („Mara", „Daniel Stripling", …). */
  von?: string;
  agentId?: number | null;
}, lauf: Lauf = sqlPool): Promise<AuskunftBestellung> {
  const art = ein.art ?? "privat";
  const stand = await auskunftStand(ein.personId, lauf, art);
  const link = (pr: string | null) => (pr ? absoluteUrl(`/zahlung/${encodeURIComponent(pr)}`) : null);
  if (stand.stufe === "bezahlt") {
    return { ok: true, art: "bezahlt", ref: stand.bezahltRef, paymentReference: null, betragCents: 0, betragText: "", mitAbo: stand.preis.mitAbo, zahlungsseite: null };
  }
  // Gemeldet („habe überwiesen") gilt immer; eine offene Bestellung bis 21 Tage —
  // danach wird sie stillgelegt und neu angelegt (der Preis kann sich geändert haben).
  // Integration 26.09.2026 (E-243): und nur, wenn sie nicht teurer ist als der Preis, der HEUTE
  // gilt (offenWiederverwendbar) — sonst ersetzt die neue sie (unten, superseded_by).
  if (stand.offen && offenWiederverwendbar(stand)) {
    return {
      ok: true, art: "offen", ref: stand.offen.ref, paymentReference: stand.offen.paymentReference,
      betragCents: stand.offen.betragCents, betragText: euroText(stand.offen.betragCents),
      mitAbo: stand.preis.mitAbo, zahlungsseite: link(stand.offen.paymentReference),
    };
  }
  let [v] = (await lauf`
    SELECT first_name, last_name, company_name, email, street, zip, city, country, birthdate, phone, phone_country_code, assigned_agent_id
      FROM fiaon_applications WHERE person_id = ${ein.personId} AND merged_into IS NULL
     ORDER BY (payment_status = 'paid') DESC, created_at DESC LIMIT 1`) as any[];
  // Ein Lead ohne Antrag (3.022 Menschen) hat keine Bestellzeile — seine Stammdaten
  // stehen nur an der Person. Ohne diesen Rückfall konnte ihm niemand mehr eine
  // Auskunft verkaufen (Gesprächsschritt „Lead ohne Antrag → Auskunft", Assistent,
  // Akte). Ein Lead zahlt den Einzelpreis — er hat kein laufendes Paket.
  if (!v) {
    [v] = (await lauf`
      SELECT first_name, last_name, company_name, primary_email AS email, street, zip, city, country, birthdate,
             primary_phone AS phone, NULL::text AS phone_country_code, assigned_agent_id
        FROM fiaon_persons WHERE id = ${ein.personId} AND merged_into_person_id IS NULL`) as any[];
  }
  if (!v) return { ok: false, art: "neu", ref: null, paymentReference: null, betragCents: 0, betragText: "", mitAbo: false, zahlungsseite: null, fehler: "Person ohne Datensatz" };

  const ref = `FIAON-SCHUFA-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const preis = stand.preis;
  const packName = art === "firma" ? "Firmen-Bonitätsauskunft inkl. Handlungsplan" : "Bonitätsauskunft inkl. Handlungsplan";
  // payment_reference setzt der Trigger (Migration 037); bestellungFuerAntrag
  // setzt Betrag, Frist, Rechnung und schickt die Zahlungsdaten.
  // Integration 25.09.2026 (E-241): Ohne Land in der Quelle (Lead) trägt die Bestellung das Land
  // aus auskunftStand (landOhneAntrag) — Zahlungsmails und Beschaffung lesen es an genau dieser Zeile.
  // AT und CH sind damit nie mehr „SCHUFA“, nur weil der Lead kein Land angegeben hat.
  await lauf`
    INSERT INTO fiaon_applications (ref, type, status, pack_key, pack_name, first_name, last_name, company_name, email,
                                    street, zip, city, country, birthdate, phone, phone_country_code, person_id, assigned_agent_id,
                                    created_at, updated_at)
    VALUES (${ref}, 'schufa', 'submitted', ${preis.key}, ${packName},
            ${v.first_name}, ${v.last_name}, ${v.company_name}, ${v.email},
            ${v.street}, ${v.zip}, ${v.city}, ${String(v.country ?? "").trim() || stand.land}, ${v.birthdate}, ${v.phone}, ${v.phone_country_code},
            ${ein.personId}, ${v.assigned_agent_id ?? null}, NOW(), NOW())`;
  const { bestellungFuerAntrag } = await import("../routes/fiaon-antrag");
  // ── KEINE VERWAISTE ZEILE (Integration 25.09.2026, E-240) ─────────────────
  // Scheiterte bestellungFuerAntrag (bis Migration 083 z. B. die Katalogpreis-Wand
  // bei 149/199/349 €: eine Ausnahme aus dem UPDATE), blieb die Zeile oben ohne
  // Betrag stehen — jeder weitere Klick legte eine neue daneben. Jetzt wird der
  // Fehler aufgefangen und genau diese eben angelegte Zeile wieder entfernt,
  // solange sie weder Rechnungsnummer noch Zahlungsstand trägt (ein Zurückrollen
  // der eigenen Anlage, keine Bestellung eines Kunden geht verloren).
  let erg: { status: number; body: Record<string, unknown> };
  try {
    erg = await bestellungFuerAntrag(ref);
  } catch (e) {
    console.error(`[AUSKUNFT] ${ref}: Bestellung gescheitert:`, e);
    erg = { status: 500, body: { ok: false, error: String((e as Error)?.message || e).slice(0, 200) } };
  }
  if (erg.status >= 300) {
    await lauf`
      DELETE FROM fiaon_applications
       WHERE ref = ${ref} AND invoice_number IS NULL
         AND COALESCE(payment_status, '') NOT IN ('pending_payment', 'claimed_paid', 'paid')`
      .catch((e) => console.error(`[AUSKUNFT] ${ref}: verwaiste Zeile nicht entfernt:`, e));
    return {
      ok: false, art: "neu", ref: null, paymentReference: null, betragCents: preis.cents, betragText: preis.text,
      mitAbo: preis.mitAbo, zahlungsseite: null, fehler: String((erg.body as any)?.error ?? "Bestellung fehlgeschlagen"),
    };
  }
  const pr = (erg.body as any)?.paymentReference ?? null;
  // Die alte, zu alte offene Bestellung erst JETZT stilllegen — mit Zeiger auf die
  // neue (die ref ist immer auflösbar). Ohne Zeiger würde eine späte Überweisung
  // auf die alte Referenz zum Phantom in der Verbuchung (fiaon-verbuchung.ts).
  if (stand.offen) {
    const alt = stand.offen;
    await lauf`
      UPDATE fiaon_applications SET payment_status = 'superseded', superseded_by = ${ref}, updated_at = NOW()
       WHERE ref = ${alt.ref} AND payment_status = 'pending_payment'`;
    // Integration 26.09.2026 (E-243): Ersetzt, weil sie teurer war als der Preis von heute (offenWiederverwendbar) —
    // das gehört in den Verlauf der alten Bestellung, für die Buchhaltung: Überweist er doch noch auf die alte
    // Referenz, bucht die Verbuchung dort, und die Differenz ist zu erstatten (wie im Bündel). Gelesen wird der
    // Stand DANACH: bestellungFuerAntrag legt Schwester-Bestellungen derselben Kategorie schon selbst still
    // (supersedeSisterOrders, im Hintergrund, Zeiger = Zahlungsreferenz) — wer zuerst kommt, ist gleich.
    const [nachher] = (await lauf`SELECT payment_status FROM fiaon_applications WHERE ref = ${alt.ref} LIMIT 1`) as any[];
    const ersetzt = String(nachher?.payment_status ?? "") === "superseded";
    if (ersetzt && alt.betragCents > preis.cents && Date.now() - new Date(alt.angelegt).getTime() < OFFEN_WIEDERVERWENDEN_TAGE * 86_400_000) {
      await lauf`
        INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
        VALUES (${alt.ref}, ${ein.personId}, NULL, 'System', 'system',
                ${`Durch die Bestellung ${ref} zum heutigen Preis ${preis.text}${preis.mitAbo ? " (Kundenpreis mit Paket)" : ""} ersetzt — diese hier (${euroText(alt.betragCents)}) ist nicht mehr zu zahlen. Geht trotzdem noch eine Überweisung auf diese Referenz ein, bucht die Verbuchung sie HIER: Dann bitte die Differenz erstatten.`})`
        .catch((e) => console.error("[AUSKUNFT] Verlauf der ersetzten Bestellung:", e));
    }
  }
  await lauf`
    INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
    VALUES (${ref}, ${ein.personId}, ${ein.agentId ?? null}, ${ein.von ?? "System"}, 'system',
            ${`Bonitätsauskunft bestellt (${preis.text}${preis.mitAbo ? ", Kundenpreis mit Paket" : ", einzeln"}) — über ${ein.quelle}. Verwendungszweck ${pr ?? "folgt"}.`})`
    .catch((e) => console.error("[AUSKUNFT] Verlaufseintrag:", e));
  return {
    ok: true, art: "neu", ref, paymentReference: pr, betragCents: preis.cents, betragText: preis.text,
    mitAbo: preis.mitAbo, zahlungsseite: link(pr),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// WAS DER KUNDE AUF DER BESTELLSEITE ERKLÄRT HAT (Integration 25.09.2026, E-240)
//
// Die Bestellseite /bonitaet-antrag schickt mit POST /payment-order (kind
// „schufa") `zustimmungen` (Fassung, Knopf, Zeitpunkt, Preis, jeder Haken mit
// Wortlaut und Uhrzeit), bei Firmen `rechtsform`, `firma` und `registernummer`.
// Der Server warf das bisher weg: § 356 Abs. 4 BGB (Beginn vor Fristablauf)
// und die Vollmacht zur Übermittlung waren nicht belegbar, und die Lieferung
// (auskunftWiderrufStand, fiaon-auskunft-lieferung.ts) fand keine Wahl. Jetzt
// steht alles als Verlaufseintrag an der Bestellung — derselbe Wortlaut
// „AUSDRÜCKLICH VERLANGT", den Kauflink und Kaufkarte schreiben —, dazu die
// vorhandenen Spalten consent_* und legal_form. Keine Migration. Gebaut und
// geprüft vom Bauer der Bestellseite (.pruef/E-240-bestellseite-server-vorschlag.ts),
// hier eingebaut. Nur für eine NEUE Bestellung (eine wiederverwendete offene
// hat ihre Erklärungen schon).
// ═══════════════════════════════════════════════════════════════════════════

const kurzText = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

// ═══════════════════════════════════════════════════════════════════════════
// DER BESCHAFFUNGSAUFTRAG IM VERLAUF (25.09.2026, E-241)
//
// Die „Vollmacht zur Übermittlung" deckt nur die kostenlose Datenkopie — nicht,
// eine (kostenpflichtige) Auskunft im Namen des Kunden zu kaufen (Befund der
// Beschaffungs-Prüfer). Jede Kauftür fragt deshalb den Beschaffungsauftrag als
// Pflicht-Haken ab (AUSKUNFT_BESCHAFFUNGSAUFTRAG_TEXT, shared/fiaon-auskunft.ts)
// und schreibt ihn HIER in den Verlauf der Auskunft-Bestellung: Marke
// (AUSKUNFT_BESCHAFFUNG_VERMERK), Weg, Zeit, Fassung und Wortlaut in einer Zeile.
// Die Beschaffung (auskunftEinwilligungen, fiaon-auskunft-lieferung.ts) liest die
// Marke als Einwilligung „auftrag".
//
// Idempotent je Bestellung: Steht schon ein (nicht zurückgenommener) Vermerk,
// bleibt es bei dem ersten — ein zweiter Klick ist kein zweiter Auftrag.
// ═══════════════════════════════════════════════════════════════════════════

// 26.09.2026 (E-243): „antrag" — der Zusatz im letzten Schritt des Paket-Antrags (Bündel).
export type AuftragWeg = "bestellseite" | "kauflink" | "kundenbereich" | "bestaetigung" | "antrag";

const AUFTRAG_WEG_TEXT: Record<AuftragWeg, string> = {
  bestellseite: "auf der Bestellseite /bonitaet-antrag",
  kauflink: "über den Kauflink der E-Mail",
  kundenbereich: "im Kundenbereich (Kaufkarte)",
  bestaetigung: "über den Bestätigungslink aus der E-Mail",
  antrag: "im Antrag (Zusatz beim Vertrag annehmen)",
};

/** „25.09.2026, 14:03 Uhr" (Berlin) — nur über formatToParts (Zeit-Falle Berlin-Stunde). */
function zeitBerlin(d: Date): string {
  const t = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(d);
  const w = (a: string) => t.find((p) => p.type === a)?.value ?? "00";
  return `${w("day")}.${w("month")}.${w("year")}, ${w("hour")}:${w("minute")} Uhr`;
}

/**
 * Den Beschaffungsauftrag an der Auskunft-Bestellung `ref` vermerken. Rückgabe:
 * true = neu vermerkt, false = stand schon da (oder die Bestellung fehlt).
 * `wortlaut`: was der Kunde gesehen hat (Bestellseite schickt ihn mit) — sonst
 * der Text der Art aus der gemeinsamen Quelle.
 */
export async function beschaffungsauftragVermerken(ein: {
  ref: string;
  personId: number | null;
  art: AuskunftArt;
  weg: AuftragWeg;
  /** Autor im Verlauf („Kunde (Kauflink aus der E-Mail)"). */
  von: string;
  wortlaut?: string | null;
  fassung?: string | null;
  /** Zeitpunkt des Hakens (Bestellseite: der Zeitstempel des Browsers); sonst jetzt. */
  am?: string | Date | null;
}, lauf: Lauf = sqlPool): Promise<boolean> {
  const ref = String(ein.ref ?? "").trim();
  if (!ref) return false;
  const wortlaut = kurzText(ein.wortlaut, 1500) || AUSKUNFT_BESCHAFFUNGSAUFTRAG_TEXT(ein.art);
  const fassung = kurzText(ein.fassung, 20) || AUSKUNFT_AUFTRAG_FASSUNG;
  const amRoh = ein.am ? new Date(ein.am as any) : new Date();
  const am = Number.isNaN(amRoh.getTime()) ? new Date() : amRoh;
  const note = `${AUSKUNFT_BESCHAFFUNG_VERMERK} ${AUFTRAG_WEG_TEXT[ein.weg]} am ${zeitBerlin(am)} (${am.toISOString()}, Textfassung ${fassung}). `
    + `Wortlaut: „${wortlaut}"`;
  // Eine Transaktionssperre je Bestellung: zwei Türen im selben Augenblick (Doppelklick,
  // Kaufkarte + Kauflink) schreiben nicht zwei Vermerke.
  return lauf.begin(async (tx) => {
    const t = tx as unknown as Lauf;
    await t`SELECT pg_advisory_xact_lock(hashtext(${`auskunft-auftrag:${ref}`}))`;
    const [da] = (await t`
      SELECT 1 AS da FROM fiaon_contact_log
       WHERE ref = ${ref} AND voided_at IS NULL AND note LIKE ${`${AUSKUNFT_BESCHAFFUNG_VERMERK}%`} LIMIT 1`) as any[];
    if (da) return false;
    const zeilen = (await t`
      INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
      SELECT a.ref, COALESCE(a.person_id, ${ein.personId}), NULL, ${ein.von}, 'system', ${note}
        FROM fiaon_applications a WHERE a.ref = ${ref}
      RETURNING id`) as any[];
    return zeilen.length > 0;
  }) as Promise<boolean>;
}

export async function auskunftBestellungBelegen(
  ref: string, b: any, meta: { ip: string | null; ua: string }, lauf: Lauf = sqlPool,
): Promise<boolean> {
  const z = b?.zustimmungen;
  if (!z || typeof z !== "object" || !Array.isArray(z.punkte)) return false;
  const punkte = (z.punkte as any[]).slice(0, 10).map((p) => ({
    schluessel: kurzText(p?.schluessel, 40),
    text: kurzText(p?.text, 1500),
    zugestimmt: p?.zugestimmt === true,
    am: kurzText(p?.am, 40) || null,
  }));
  const angekreuzt = (k: string) => punkte.some((p) => p.schluessel === k && p.zugestimmt);
  const firma = b?.art === "firma";
  const note = [
    `Bonitätsauskunft zahlungspflichtig bestellt über ${kurzText(z.seite, 60) || "/bonitaet-antrag"} — Knopf „${kurzText(z.knopf, 60)}" am ${kurzText(z.bestelltAm, 40)} (Textfassung ${kurzText(z.fassung, 20)}).`,
    `Angezeigter Preis: ${kurzText(z.preis?.text, 20)}${z.preis?.mitAbo ? " (Kundenpreis mit Paket)" : " (Einzelpreis)"} — ${kurzText(z.preis?.steuer, 90)}.`,
    `${z.verbraucher === false || firma ? "Bestellt als Unternehmen" : "Bestellt als Verbraucher"} · Land ${kurzText(z.land, 2)}.`,
    ...punkte.map((p) => `${p.zugestimmt ? `[angekreuzt ${p.am ?? "?"}]` : "[angezeigt]"} ${p.schluessel}: ${p.text}`),
    firma && b?.registernummer ? `Registernummer (Angabe des Kunden): ${kurzText(b.registernummer, 80)}` : null,
    // Derselbe Wortlaut wie Kauflink und Kaufkarte — die Lieferung sucht genau diesen Satz.
    angekreuzt("vorzeitiger_beginn")
      ? "Beginn vor Ablauf der Widerrufsfrist AUSDRÜCKLICH VERLANGT — mit der Anforderung nach Zahlungseingang beginnen."
      : null,
    `IP ${meta.ip ?? "?"} · Browser ${kurzText(meta.ua, 200)}`,
  ].filter(Boolean).join("\n");
  const zeilen = (await lauf`
    INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
    SELECT a.ref, a.person_id, NULL, 'Kunde (Bestellseite)', 'system', ${note}
      FROM fiaon_applications a WHERE a.ref = ${ref}
    RETURNING id`) as any[];
  // 25.09.2026 (E-241): Seit Fassung 2026-09-25b heißt der eine Haken „beschaffungsauftrag"
  // (Wortlaut AUSKUNFT_BESCHAFFUNGSAUFTRAG_TEXT). Ein älterer Browser-Stand schickt noch
  // „vollmacht_uebermittlung" — das bleibt eine Einwilligung zur Übermittlung, aber kein Auftrag,
  // eine Auskunft zu kaufen: Nur der neue Haken schreibt AUSKUNFT_BESCHAFFUNG_VERMERK.
  //
  // Gegenlesen 25.09.2026 (E-241): „ERTEILT" nur für den Wortlaut der gemeinsamen Quelle. Der Text
  // kommt aus dem Browser — ein anderer (verändertes Formular, eine künftige Fassung in einem alten
  // Tab) ist kein Auftrag, den die Beschaffung als Deckung für einen Kauf lesen darf. Dann bleibt
  // die Bestellung ohne Vermerk UND ohne consent_schufa (sonst läse die Beschaffung „Vollmacht auf der
  // Bestellseite" und schickte keinen Link), und nach der Zahlung holt die Auftragsbestätigung ihn ein.
  const auftragArt: AuskunftArt = firma ? "firma" : "privat";
  const auftrag = punkte.find((p) => p.schluessel === "beschaffungsauftrag" && p.zugestimmt && p.text);
  const auftragGueltig = !!auftrag && auftrag.text === kurzText(AUSKUNFT_BESCHAFFUNGSAUFTRAG_TEXT(auftragArt), 1500);
  if (auftrag && !auftragGueltig) {
    console.warn(`[AUSKUNFT] ${ref}: Haken „beschaffungsauftrag" mit fremdem Wortlaut — kein Vermerk (Auftragsbestätigung nach der Zahlung).`);
  }
  await lauf`
    UPDATE fiaon_applications SET
      consent_agb = TRUE,
      consent_contract = TRUE,
      consent_schufa = ${auftragGueltig || angekreuzt("vollmacht_uebermittlung")},
      legal_form = COALESCE(${firma ? kurzText(b?.rechtsform, 60) || null : null}, legal_form),
      company_name = COALESCE(NULLIF(company_name, ''), ${firma ? kurzText(b?.firma, 200) || null : null}),
      updated_at = NOW()
    WHERE ref = ${ref}`;
  if (auftrag && auftragGueltig && zeilen.length > 0) {
    await beschaffungsauftragVermerken({
      ref, personId: null, art: auftragArt, weg: "bestellseite", von: "Kunde (Bestellseite)",
      wortlaut: auftrag.text, fassung: kurzText(z.fassung, 20) || null, am: auftrag.am,
    }, lauf).catch((e) => console.error(`[AUSKUNFT] ${ref}: Beschaffungsauftrag nicht vermerkt:`, e));
  }
  return zeilen.length > 0;
}

/**
 * Hat die Bestellseite den Auftrag angehakt? (Gegenlesen 25.09.2026, E-241)
 *
 * POST /payment-order kind=schufa legt ohne Anmeldung eine zahlungspflichtige
 * Bestellung an — vorher auch OHNE jeden Haken (die alten Knöpfe auf
 * /dashboard-alt schickten nur E-Mail und Namen). Kein Kaufweg ohne den
 * Pflicht-Haken: „auftrag" = der Beschaffungsauftrag (seit Fassung
 * 2026-09-25b), „alt" = der Haken „Vollmacht zur Übermittlung" eines Tabs, der
 * noch die Fassung bis 2026-09-25 zeigt — bestellt wird, aber ohne Vermerk
 * (die Vollmacht deckt den Kauf nicht; nach der Zahlung kommt die
 * Auftragsbestätigung). null = kein Haken → die Route lehnt ab.
 */
export function bestellseiteHaken(b: any): "auftrag" | "alt" | null {
  const punkte = b?.zustimmungen && Array.isArray(b.zustimmungen.punkte) ? (b.zustimmungen.punkte as any[]).slice(0, 10) : [];
  const an = (k: string) => punkte.some((p) => kurzText(p?.schluessel, 40) === k && p?.zugestimmt === true && kurzText(p?.text, 1500) !== "");
  return an("beschaffungsauftrag") ? "auftrag" : an("vollmacht_uebermittlung") ? "alt" : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE GEMEINSAME BREMSE: EIN ANGEBOT JE MENSCH IN DREI TAGEN (25.09.2026, E-240)
//
// ── DER BEFUND (Integrationsprüfung) ───────────────────────────────────────
// Fünf Wege bieten die Auskunft an: die Angebots-Mail (Verkaufstakt, auch von
// Hand), die Unterlagen-Mail mit Kaufangebot, die WhatsApp-Vorlage
// fiaon_kk_auskunft, Mara im Postfach und Mara auf WhatsApp. Jeder hatte eine
// eigene Rücksicht, keiner sah alle anderen: Der Takt wartete nach einer
// Unterlagen-Mail drei Tage — die Unterlagen-Mail aber nicht nach dem Takt, und
// Mara sah keinen der beiden. Ein Kunde konnte am selben Tag die Angebots-Mail,
// eine Unterlagen-Mail mit demselben Angebot und Maras Angebot in der Antwort
// auf eine ganz andere Frage bekommen — dreimal dieselbe Werbung.
//
// ── DIE REGEL, AN EINER STELLE ─────────────────────────────────────────────
// Nach einem Angebot über irgendeinen dieser Wege bietet drei Tage lang KEIN
// Weg von sich aus erneut an. Was NICHT bremst:
//   · Fragt der Kunde selbst nach der Auskunft (oder schreibt „ich habe keine"),
//     antwortet Mara mit dem Link — das ist seine Anfrage, kein Angebot.
//   · Eine offene Bestellung: ihr Zahlungslink ist Vertragspost.
//   · Die Kaufseite (er klickt) und der Kundenbereich (er schaut selbst nach).
// Drei Tage = der Mindestabstand des Takts zwischen zwei Berührungen
// (MINDESTABSTAND_TAGE, fiaon-auskunft-verkauf.ts) — so stößt der Takt nie an
// seine eigenen Schritte. Die Spuren stehen als SQL-Baustein hier, damit Takt,
// WhatsApp-Zentrale (SQL) und die Einzelprüfung (zuletztAngeboten) dieselbe
// Definition lesen.
// ═══════════════════════════════════════════════════════════════════════════

export const ANGEBOT_ABSTAND_TAGE = 3;

/**
 * Anfang des Aktenvermerks (fiaon_contact_log, Autor „Postmeister"), den Maras
 * Werkzeug auskunft_anbieten bei einem NEUEN Angebot schreibt
 * (fiaon-postmeister-werkzeuge.ts) — die Bremse erkennt Maras Mail-Angebot
 * daran. Der Zahlungsweg einer offenen Bestellung beginnt anders und zählt
 * bewusst nicht. Warum nicht fiaon_postmeister.handlungen: Die liegen in der
 * Produktion als jsonb-TEXT (1.026 von 1.053 Zeilen, gemessen 25.09.2026) und
 * tragen den Ergebnis-Satz des Werkzeugs, nicht diesen Vermerk.
 */
export const ANGEBOT_VERMERK = "Bonitätsauskunft angeboten";

export type AngebotWeg = "angebot_mail" | "unterlagen_mail" | "whatsapp_vorlage" | "mara_mail" | "mara_whatsapp";

export const ANGEBOT_WEG_TEXT: Record<AngebotWeg, string> = {
  angebot_mail: "per Angebots-Mail",
  unterlagen_mail: "in der Unterlagen-Mail",
  whatsapp_vorlage: "per WhatsApp-Vorlage",
  mara_mail: "von Mara per E-Mail",
  mara_whatsapp: "von Mara auf WhatsApp",
};

/**
 * Die Spuren eines Angebots in den letzten `tage` Tagen — als SQL, das
 * (am, weg) liefert. `person` ist ein SQL-Ausdruck: eine Spalte („f.person_id")
 * oder ein Parameter („$1::int"). Nur geprüfte Formen, kein freier Text.
 *
 * Die Nutzlast im Mail-Protokoll liegt teils als jsonb-TEXT vor (die bekannte
 * Falle) — gelesen wird deshalb der Text, nie ein Cast. Maras Mail-Angebot
 * steht als Aktenvermerk im Verlauf (zur Werkzeugzeit; bei einem Entwurf zählt
 * es damit schon vor dem Absenden — lieber einmal zu vorsichtig).
 */
export function angebotSpurenSql(person: string, tage: number = ANGEBOT_ABSTAND_TAGE): string {
  if (!/^(?:[a-z_][a-z0-9_]*\.)?[a-z_][a-z0-9_]*$|^\$\d+(?:::int)?$/i.test(person)) {
    throw new Error("[AUSKUNFT] angebotSpurenSql: unerlaubter Personen-Ausdruck");
  }
  const t = Number.isFinite(tage) && tage >= 1 ? Math.floor(tage) : ANGEBOT_ABSTAND_TAGE;
  const seit = `NOW() - INTERVAL '${t} days'`;
  return `
    SELECT ap_m.created_at AS am, 'angebot_mail'::text AS weg FROM fiaon_mail_log ap_m
     WHERE ap_m.person_id = ${person} AND ap_m.event = 'auskunft_angebot' AND ap_m.status = 'versandt'
       AND COALESCE(ap_m.art, 'echt') = 'echt' AND ap_m.created_at > ${seit}
    UNION ALL
    SELECT ap_u.created_at, 'unterlagen_mail'::text FROM fiaon_mail_log ap_u
     WHERE ap_u.person_id = ${person} AND ap_u.event = 'documents_change_request' AND ap_u.status = 'versandt'
       AND COALESCE(ap_u.art, 'echt') = 'echt' AND ap_u.created_at > ${seit}
       AND (CASE WHEN jsonb_typeof(ap_u.payload) = 'string' THEN ap_u.payload #>> '{}' ELSE ap_u.payload::text END)
           ~ '"auskunft_modus"\\s*:\\s*"angebot"'
    UNION ALL
    SELECT ap_w.erstellt_am, 'whatsapp_vorlage'::text FROM fiaon_wa_aktion ap_w
     WHERE ap_w.person_id = ${person} AND ap_w.gruppe = 'auskunft_fehlt' AND ap_w.ok AND ap_w.erstellt_am > ${seit}
    UNION ALL
    SELECT ap_p.created_at, 'mara_mail'::text FROM fiaon_contact_log ap_p
     WHERE ap_p.person_id = ${person} AND ap_p.agent_name = 'Postmeister' AND ap_p.voided_at IS NULL
       AND ap_p.note LIKE '${ANGEBOT_VERMERK}%' AND ap_p.created_at > ${seit}
    UNION ALL
    SELECT COALESCE(ap_x.gesendet_am, ap_x.created_at), 'mara_whatsapp'::text FROM fiaon_whatsapp ap_x
     WHERE ap_x.person_id = ${person} AND ap_x.richtung = 'raus' AND ap_x.vorlage IS NULL
       AND COALESCE(ap_x.status, '') <> 'fehler' AND ap_x.text LIKE '%/auskunft/bestellen?%'
       AND COALESCE(ap_x.gesendet_am, ap_x.created_at) > ${seit}`;
}

export interface LetztesAngebot {
  /** ISO-Zeitpunkt des jüngsten Angebots. */
  am: string;
  weg: AngebotWeg;
  /** „per Angebots-Mail am 24.09., um 10:12 Uhr" — für Mitarbeiter und Modell. */
  text: string;
}

/**
 * Wurde diesem Menschen die Auskunft in den letzten drei Tagen schon angeboten
 * — egal über welchen Weg? null = nein (oder nicht prüfbar: Eine Störung hier
 * hält weder eine Unterlagen-Mail noch Maras Antwort auf; sie heißt höchstens,
 * dass ein Angebot einmal zu oft kommt).
 */
export async function zuletztAngeboten(personId: number, opts: { tage?: number } = {}, lauf: Lauf = sqlPool): Promise<LetztesAngebot | null> {
  if (!Number.isInteger(personId) || personId <= 0) return null;
  try {
    const [z] = (await lauf.unsafe(`
      SELECT s.am, s.weg FROM (${angebotSpurenSql("$1::int", opts.tage)}) s
       WHERE s.am IS NOT NULL ORDER BY s.am DESC LIMIT 1`, [personId])) as any[];
    if (!z) return null;
    const am = new Date(z.am);
    const weg = String(z.weg) as AngebotWeg;
    // Nur zur Anzeige — gerechnet wird mit `am` (Zeit-Falle Berlin-Stunde betrifft das Rechnen, nicht das Schreiben).
    const wann = am.toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    return { am: am.toISOString(), weg, text: `${ANGEBOT_WEG_TEXT[weg] ?? weg} am ${wann.replace(", ", ", um ")} Uhr` };
  } catch (e) {
    console.error("[AUSKUNFT] Angebots-Bremse nicht prüfbar — lasse durch:", String((e as Error)?.message || e).slice(0, 200));
    return null;
  }
}

/**
 * Fragt der Kunde SELBST nach der Auskunft? Dann ist Maras Link eine Antwort,
 * kein Angebot — die Bremse gilt nicht. Bewusst ohne „Karte", „Limit",
 * „Rahmen": Wer nach seiner Karte fragt, hat nicht nach der Auskunft gefragt
 * (dieselbe Grenze wie AUSKUNFT_DIREKT in fiaon-whatsapp-mara.ts).
 */
export function kundeFragtNachAuskunft(text: unknown): boolean {
  return /schufa|bonit|auskunft|crif|\bksv|boniversum|creditreform|intrum|eintr[aä]g|\bscore|negativ|datenkopie/i.test(String(text ?? ""));
}

/**
 * Antwortet der Kunde auf ein Angebot oder auf die Unterlagen-Mail (Betreff
 * „Re:"/„AW:" auf eine dieser Mails)? Dann ist Maras Link die Antwort auf SEINE
 * Nachricht — „Ja, gerne" auf die Angebots-Mail darf nicht an der Bremse
 * scheitern. Die Bruchstücke stammen aus den Betreffs der drei Fassungen
 * (server/mail/vorlagen/auskunft-verkauf.ts) und der Unterlagen-Mail
 * (server/mail/vorlagen/konto.ts, früher „Ein Dokument fehlt noch") — wer dort
 * einen Betreff ändert, zieht ihn hier mit.
 */
const ANGEBOT_BETREFF = /was die bank über sie sieht|alten einträge noch gespeichert|ohne einen einzigen brief|über ihr unternehmen gespeichert|fehlende unterlagen|dokument fehlt/i;
export function antwortAufAngebot(betreff: unknown): boolean {
  const b = String(betreff ?? "");
  return /^\s*(?:re|aw|antw)\s*:/i.test(b) && (ANGEBOT_BETREFF.test(b) || kundeFragtNachAuskunft(b));
}

/** Für SQL-Filter: die Katalogschlüssel der Auskunft als Literal-Liste (geprüfte Form). */
export function auskunftSchluesselSql(): string {
  if (ALLE_AUSKUNFT_SCHLUESSEL.some((k) => !/^[a-z0-9_]+$/.test(k))) throw new Error("[AUSKUNFT] Schlüssel mit unerlaubten Zeichen");
  return ALLE_AUSKUNFT_SCHLUESSEL.map((k) => `'${k}'`).join(", ");
}

// ═══════════════════════════════════════════════════════════════════════════
// DAS BÜNDEL: AUSKUNFT ZUM KUNDENPREIS AUS DEM PAKET-ANTRAG (26.09.2026, E-243)
//
// Justin: „Wie stellen wir sicher, dass FIAON-Kunden den Preis bekommen …? Ziel
// ist, die Bonitätsauskunft zu verkaufen UND ein Abo zu verkaufen — wenn nicht,
// auch gut, dann nur die Bonität."
//
// Der Weg (Kopf von shared/fiaon-auskunft-buendel.ts):
//   · buendelWunschVermerken — beim Abschicken des Antrags (POST /application,
//     ab Schritt 7): der Haken „Bonitätsauskunft zum Kundenpreis dazubestellen"
//     als Vermerk an der Paket-Bestellung. Keine Spalte, keine Migration.
//   · auskunftBuendelNachZahlung — aus onCustomerPaid: Ist die erste
//     Paketzahlung gebucht und trägt die Paket-Bestellung den Vermerk, entsteht
//     die Auskunft-Bestellung über auskunftBestellen. Der PREIS kommt nie aus dem
//     Vermerk: Im Augenblick der Anlage läuft das Paket, auskunftPreis sagt 74 €
//     (Firma 199 €). Dazu Beschaffungsauftrag (Wortlaut und Zeit aus dem Antrag)
//     und die Wahl zum Beginn — wortgleich mit Kauflink und Kaufkarte.
//     Einmal je Person (Reservierung BUENDEL_ANLAGE_VERMERK unter einer
//     Transaktionssperre), eigener Fehlerweg: nie bricht es die Buchung.
//   · auskunftPaketSchritt — nach der Lieferung: Hat der Mensch kein laufendes
//     Paket (und keine Sperre), bekommt „Ihre Auskunft ist da" den Abschnitt
//     „Ihr nächster Schritt zur Karte" und der Betreuer eine Aufgabe.
//   · buendelWartet — solange das Bündel auf die erste Paketzahlung wartet (höchstens
//     BUENDEL_WARTET_TAGE ab dem Haken), bietet niemand die Auskunft zum Einzelpreis
//     an (auskunftAngebotKaufstand).
// ═══════════════════════════════════════════════════════════════════════════

const ISO_ZEIT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:?\d{2})$/;

/** Ein Zeitstempel aus dem Browser — nur als ISO und nicht in der Zukunft, sonst null. */
function isoAusBrowser(v: unknown): string | null {
  const s = kurzText(v, 40);
  if (!ISO_ZEIT.test(s)) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime()) || d.getTime() > Date.now() + 5 * 60_000) return null;
  return d.toISOString();
}

/**
 * Die Wahl zum Beginn vor Ablauf der Widerrufsfrist im Verlauf der Auskunft-
 * Bestellung — WORTGLEICH mit Kauflink (fiaon-auskunft-kauf.ts) und Kaufkarte
 * (fiaon-kunde-bereich.ts): Die Lieferung (auskunftWiderrufStand) sucht genau
 * diese Sätze, egal durch welche Tür bestellt wurde.
 */
const WIDERRUF_VERLANGT_SATZ = "Beginn vor Ablauf der Widerrufsfrist AUSDRÜCKLICH VERLANGT — Hinweis auf anteiligen Wertersatz und Erlöschen des Widerrufsrechts bei vollständiger Erfüllung bestätigt.";
const WIDERRUF_NICHT_SATZ = "Beginn vor Ablauf der Widerrufsfrist NICHT verlangt — mit der Anforderung erst nach Ablauf der 14-tägigen Widerrufsfrist beginnen.";

export type BuendelVermerkErgebnis = "vermerkt" | "schon" | "nicht_gewaehlt" | "kein_paket" | "keine_bestellung";

/**
 * Den Zusatz aus dem Antrag an der Paket-Bestellung `ref` vermerken — nur wenn
 * er angehakt war und die Bestellung ein Abo-Paket ist. Idempotent je
 * Bestellung (der Antrag speichert bei Schritt 7, 8 und beim Klick in den
 * Bereich — es bleibt beim ersten Vermerk).
 *
 * Wie auskunftBestellungBelegen: Der Wortlaut kommt aus dem Browser; als
 * Beschaffungsauftrag gilt er nur, wenn er dem der gemeinsamen Quelle gleicht
 * (buendelHakenText, AUSKUNFT_BESCHAFFUNGSAUFTRAG_TEXT). Sonst steht der Wunsch
 * trotzdem da, und nach der Zahlung der Auskunft holt die Auftragsbestätigung
 * den Auftrag ein. Die Art (privat/Firma) entscheidet das Paket, nicht der Browser.
 */
export async function buendelWunschVermerken(ein: {
  ref: string; packKey: unknown; zusatz: unknown; ip?: string | null; ua?: string | null;
}, lauf: Lauf = sqlPool): Promise<BuendelVermerkErgebnis> {
  const z = ein.zusatz as Record<string, unknown> | null;
  if (!z || typeof z !== "object" || z.gewaehlt !== true) return "nicht_gewaehlt";
  const ref = kurzText(ein.ref, 80);
  if (!ref) return "keine_bestellung";
  if (!istAboPaket(ein.packKey) || istGlobalPaket(ein.packKey)) return "kein_paket";
  const art = buendelArt(ein.packKey);
  const haken = kurzText(z.haken, 2000);
  const hakenGueltig = haken === kurzText(buendelHakenText(art), 2000);
  const auftrag = kurzText(AUSKUNFT_BESCHAFFUNGSAUFTRAG_TEXT(art), 1500);
  const auftragGueltig = hakenGueltig && kurzText(z.auftrag, 1500) === auftrag;
  const sofortGueltig = art === "privat" && z.sofort === true && kurzText(z.sofortText, 800) === kurzText(BUENDEL_SOFORT_TEXT, 800);
  const am = isoAusBrowser(z.am) ?? new Date().toISOString();
  const sofortAm = isoAusBrowser(z.sofortAm) ?? am;
  const fassung = kurzText(z.fassung, 20).replace(/[,()]/g, "") || BUENDEL_FASSUNG;
  const note = [
    `${BUENDEL_WUNSCH_VERMERK} — Zusatz im Antrag (Schritt „Vertrag annehmen“) am ${zeitBerlin(new Date(am))} `
      + `(${am}, Textfassung ${fassung}, Art ${art}, Kundenpreis ${buendelPreisText(art)}). `
      + "Fällig erst nach der ersten Paketzahlung — dann legt das System die Auskunft-Bestellung zum Kundenpreis an.",
    art === "firma"
      ? "Sofortbeginn: entfällt (Unternehmen, kein gesetzliches Widerrufsrecht)."
      : sofortGueltig
        ? `Sofortbeginn: verlangt am ${zeitBerlin(new Date(sofortAm))} — „${BUENDEL_SOFORT_TEXT}“`
        : `Sofortbeginn: nicht verlangt${z.sofort === true ? " (abweichender Wortlaut — gilt als nicht verlangt)" : ""} — die Anforderung beginnt nach Ablauf der Widerrufsfrist.`,
    hakenGueltig
      ? `Haken: „${haken}“`
      : `Haken mit abweichendem Wortlaut (Fassung ${fassung}): '${haken.replace(/[„“]/g, "'")}'`,
    auftragGueltig
      ? `Beschaffungsauftrag: „${auftrag}“`
      : "Beschaffungsauftrag: NICHT übernommen (abweichender Wortlaut) — nach der Zahlung der Auskunft holt die Auftragsbestätigung ihn ein.",
    `Anzeige ${kurzText(z.anzeige, 10) || "?"} · Land ${kurzText(z.land, 3) || "?"} · IP ${kurzText(ein.ip, 60) || "?"} · Browser ${kurzText(ein.ua, 200)}`,
  ].join("\n");
  return lauf.begin(async (tx) => {
    const t = tx as unknown as Lauf;
    await t`SELECT pg_advisory_xact_lock(hashtext(${`auskunft-buendel-wunsch:${ref}`}))`;
    const [da] = (await t`
      SELECT 1 AS da FROM fiaon_contact_log
       WHERE ref = ${ref} AND voided_at IS NULL AND note LIKE ${`${BUENDEL_WUNSCH_VERMERK}%`} LIMIT 1`) as any[];
    if (da) return "schon";
    const zeilen = (await t`
      INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
      SELECT a.ref, a.person_id, NULL, 'Kunde (Antrag)', 'system', ${note}
        FROM fiaon_applications a WHERE a.ref = ${ref}
      RETURNING id`) as any[];
    return zeilen.length ? "vermerkt" : "keine_bestellung";
  }) as Promise<BuendelVermerkErgebnis>;
}

export interface BuendelWunsch {
  art: AuskunftArt;
  fassung: string;
  /** ISO — wann der Haken gesetzt wurde. */
  am: string;
  /** Beginn vor Fristablauf: true verlangt, false nicht, null = Unternehmen. */
  sofort: boolean | null;
  /** Der Wortlaut des Beschaffungsauftrags — nur wenn er beim Abschicken gültig war. */
  auftrag: string | null;
}

/** Den Vermerk aus buendelWunschVermerken lesen. null = kein (lesbarer) Bündel-Vermerk. */
export function buendelWunschLesen(note: unknown): BuendelWunsch | null {
  const n = String(note ?? "");
  if (!n.startsWith(BUENDEL_WUNSCH_VERMERK)) return null;
  const m = n.match(/\((\d{4}-\d{2}-\d{2}T[0-9:.]+Z), Textfassung ([^,)]+), Art (privat|firma), Kundenpreis /);
  if (!m) return null;
  const art = m[3] as AuskunftArt;
  const sofort = art === "firma" ? null : /^Sofortbeginn: verlangt/m.test(n);
  const auftrag = n.match(/^Beschaffungsauftrag: „([^“]+)“/m)?.[1] ?? null;
  return { art, fassung: m[2].trim(), am: m[1], sofort, auftrag };
}

export interface BuendelErgebnis {
  art: "kein_paket" | "kein_wunsch" | "schon" | "angelegt" | "umgepreist" | "offen_behalten" | "hat_auskunft" | "fehler";
  text: string;
  auskunftRef: string | null;
  betragText: string | null;
  zahlungsseite: string | null;
}

/**
 * Nach der ERSTEN Paketzahlung (onCustomerPaid): Trägt die Paket-Bestellung —
 * oder eine, die in ihr aufging (merged_into/superseded_by) — den Zusatz, wird
 * die Auskunft zum Kundenpreis bestellt. Nie doppelt:
 *   · einmal je Person (Reservierung unter pg_advisory_xact_lock; scheitert die
 *     Anlage, wird die Reservierung zurückgenommen — der nächste Buchungslauf
 *     versucht es erneut),
 *   · schon bezahlt oder ein Dokument in der Akte → nichts,
 *   · eine offene Bestellung zum selben (oder kleineren) Betrag → sie bleibt,
 *     der Beschaffungsauftrag aus dem Antrag kommt an sie; ist sie teurer (z. B.
 *     149 € aus einem Kauflink vor dem Antrag), wird sie durch die Bestellung zum
 *     Kundenpreis ersetzt (superseded_by zeigt auf die neue — eine späte
 *     Überweisung auf die alte Referenz bleibt auflösbar). Gemeldete Zahlungen
 *     („habe überwiesen") bleiben unangetastet.
 * Wirft nie — der Aufrufer protokolliert das Ergebnis.
 */
export async function auskunftBuendelNachZahlung(ref: string, lauf: Lauf = sqlPool): Promise<BuendelErgebnis> {
  const erg = (art: BuendelErgebnis["art"], text: string, extra: Partial<BuendelErgebnis> = {}): BuendelErgebnis =>
    ({ art, text, auskunftRef: null, betragText: null, zahlungsseite: null, ...extra });
  try {
    const [p] = (await lauf`
      SELECT ref, person_id, pack_key, payment_status, type, payment_reference FROM fiaon_applications WHERE ref = ${ref} LIMIT 1`) as any[];
    if (!p || String(p.payment_status) !== "paid" || String(p.type ?? "") === "schufa" || String(p.ref).startsWith("FIAON-SCHUFA-")
        || !istAboPaket(p.pack_key) || istGlobalPaket(p.pack_key)) {
      return erg("kein_paket", `${ref} ist keine bezahlte Paket-Bestellung.`);
    }
    // Gegenlesen 26.09.2026 (E-243): superseded_by trägt BEVORZUGT die payment_reference der
    // bezahlten Bestellung (supersedeSisterOrders, fiaon-antrag.ts: „zeigerKandidat“), nicht ihre ref —
    // ein Zusatz am ersetzten Antrag (z. B. Pro angehakt, dann Ultra bezahlt) fand sonst nie hierher.
    const zeiger = String(p.payment_reference ?? "").trim() || ref;
    const [w] = (await lauf`
      SELECT id, ref, note FROM fiaon_contact_log
       WHERE voided_at IS NULL AND note LIKE ${`${BUENDEL_WUNSCH_VERMERK}%`}
         AND (ref = ${ref} OR ref IN (SELECT x.ref FROM fiaon_applications x
                                       WHERE x.merged_into = ${ref} OR x.superseded_by IN (${ref}, ${zeiger})))
       ORDER BY created_at DESC LIMIT 1`) as any[];
    if (!w) return erg("kein_wunsch", `${ref}: kein Zusatz „Auskunft zum Kundenpreis“ im Antrag.`);
    const personId = p.person_id != null ? Number(p.person_id) : null;
    if (!personId) return erg("fehler", `${ref}: Zusatz vermerkt, aber die Bestellung hängt an keiner Person — bitte von Hand bestellen.`);
    const wunsch = buendelWunschLesen(w.note);
    if (!wunsch) return erg("fehler", `${ref}: Zusatz-Vermerk #${w.id} nicht lesbar — bitte von Hand bestellen.`);

    // ── Reservieren: einmal je Person ─────────────────────────────────────
    const anlage = (await lauf.begin(async (tx) => {
      const t = tx as unknown as Lauf;
      await t`SELECT pg_advisory_xact_lock(hashtext(${`auskunft-buendel:${personId}`}))`;
      const [da] = (await t`
        SELECT id FROM fiaon_contact_log
         WHERE person_id = ${personId} AND voided_at IS NULL AND note LIKE ${`${BUENDEL_ANLAGE_VERMERK}%`} LIMIT 1`) as any[];
      if (da) return null;
      const [z] = (await t`
        INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
        VALUES (${ref}, ${personId}, NULL, 'System', 'system',
                ${`${BUENDEL_ANLAGE_VERMERK}: erste Paketzahlung gebucht — die Bonitätsauskunft zum Kundenpreis wird angelegt (Zusatz aus dem Antrag, Vermerk #${w.id} an ${w.ref}).`})
        RETURNING id`) as any[];
      return z?.id != null ? Number(z.id) : null;
    })) as number | null;
    if (anlage == null) return erg("schon", `${ref}: Das Bündel ist für Person ${personId} schon angelegt (oder wird es gerade).`);

    const vermerk = (zielRef: string, text: string) => lauf`
      INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
      VALUES (${zielRef}, ${personId}, NULL, 'System', 'system', ${text})`
      .catch((e) => console.error(`[AUSKUNFT-BUENDEL] ${zielRef}: Verlaufseintrag:`, e));
    const abschluss = (text: string) => vermerk(ref, `${BUENDEL_ANLAGE_VERMERK}: ${text}`);
    const auftragAn = async (zielRef: string) => {
      if (!wunsch.auftrag) return false;
      return beschaffungsauftragVermerken({
        ref: zielRef, personId, art: wunsch.art, weg: "antrag", von: "Kunde (Zusatz im Antrag)",
        wortlaut: wunsch.auftrag, fassung: wunsch.fassung, am: wunsch.am,
      }, lauf).catch((e) => { console.error(`[AUSKUNFT-BUENDEL] ${zielRef}: Beschaffungsauftrag:`, e); return false; });
    };

    let ersetzt: string | null = null;
    try {
      const stand = await auskunftStand(personId, lauf, wunsch.art, { land: false });
      if (stand.stufe === "bezahlt") {
        await abschluss(`nicht angelegt — die Bonitätsauskunft ist schon bezahlt (${stand.bezahltRef}).`);
        return erg("hat_auskunft", `${ref}: Auskunft schon bezahlt (${stand.bezahltRef}) — nichts angelegt.`, { auskunftRef: stand.bezahltRef });
      }
      if (stand.stufe === "dokument") {
        await abschluss("nicht angelegt — eine Bonitätsauskunft liegt schon in der Akte.");
        return erg("hat_auskunft", `${ref}: Auskunft liegt schon in der Akte — nichts angelegt.`);
      }
      // Der Kundenpreis gilt nur mit laufendem Paket — ohne ihn keine Bestellung zu einem anderen
      // Preis als dem, den der Haken nannte (z. B. am selben Tag storniert).
      if (!stand.preis.mitAbo) {
        await lauf`UPDATE fiaon_contact_log SET voided_at = NOW() WHERE id = ${anlage}`.catch(() => {});
        await vermerk(ref, `Zusatz „Auskunft zum Kundenpreis“: nicht angelegt — für Person ${personId} läuft kein Paket (der Kundenpreis ${buendelPreisText(wunsch.art)} gilt nicht). Bei der nächsten Paketzahlung erneut.`);
        return erg("kein_paket", `${ref}: kein laufendes Paket — der Kundenpreis gilt nicht, nichts angelegt.`);
      }
      if (stand.offen) {
        const o = stand.offen;
        if (o.status === "claimed_paid") {
          await abschluss(`nicht angelegt — für die offene Auskunft-Bestellung ${o.ref} ist die Zahlung schon gemeldet.`);
          return erg("offen_behalten", `${ref}: offene Auskunft ${o.ref} mit gemeldeter Zahlung — nichts angelegt.`, { auskunftRef: o.ref, betragText: euroText(o.betragCents) });
        }
        if (o.betragCents > 0 && o.betragCents <= stand.preis.cents) {
          const mitAuftrag = await auftragAn(o.ref);
          await abschluss(`die offene Auskunft-Bestellung ${o.ref} (${euroText(o.betragCents)}) bleibt — keine zweite angelegt${mitAuftrag ? "; Beschaffungsauftrag aus dem Antrag dort vermerkt" : ""}.`);
          return erg("offen_behalten", `${ref}: offene Auskunft ${o.ref} (${euroText(o.betragCents)}) bleibt.`, {
            auskunftRef: o.ref, betragText: euroText(o.betragCents),
            zahlungsseite: o.paymentReference ? absoluteUrl(`/zahlung/${encodeURIComponent(o.paymentReference)}`) : null,
          });
        }
        // Teurer als der Kundenpreis (oder ohne Betrag): durch die Bestellung zum Kundenpreis ersetzen.
        const [s] = (await lauf`
          UPDATE fiaon_applications SET payment_status = 'superseded', updated_at = NOW()
           WHERE ref = ${o.ref} AND payment_status = 'pending_payment' RETURNING ref`) as any[];
        ersetzt = s?.ref ? String(s.ref) : null;
      }

      const best = await auskunftBestellen({ personId, art: wunsch.art, quelle: "antrag_buendel", von: "Kunde (Zusatz im Antrag)" }, lauf);
      if (!best.ok || !best.ref) throw new Error(best.fehler || "Bestellung fehlgeschlagen");
      if (best.art === "bezahlt") {
        await abschluss(`nicht angelegt — die Bonitätsauskunft ist schon bezahlt (${best.ref}).`);
        return erg("hat_auskunft", `${ref}: Auskunft schon bezahlt — nichts angelegt.`, { auskunftRef: best.ref });
      }
      if (ersetzt && best.art === "neu") {
        await lauf`UPDATE fiaon_applications SET superseded_by = ${best.ref}, updated_at = NOW() WHERE ref = ${ersetzt} AND superseded_by IS NULL`;
        await vermerk(ersetzt, `Durch die Bonitätsauskunft zum Kundenpreis ersetzt (${best.ref}, ${best.betragText}) — die erste Paketzahlung ist gebucht, es gilt der Kundenpreis. Geht trotzdem noch eine Überweisung auf diese Referenz ein, bucht die Verbuchung sie HIER (die neue wird dann als Dublette stillgelegt): Dann bitte die Differenz zum Kundenpreis erstatten.`);
      }
      if (best.art === "neu") {
        // Die Wahl zum Beginn gehört an die neue Bestellung, BEVOR die Zahlungsdaten-Mail sie liest
        // (auskunftMailAnreichern wartet bei einer frischen Bestellung bis rund drei Sekunden darauf).
        const zeilen = [
          `Bonitätsauskunft aus dem Antrag (Zusatz an ${w.ref}, gewünscht am ${zeitBerlin(new Date(wunsch.am))}) nach der ersten Paketzahlung von ${ref} angelegt — Kundenpreis ${best.betragText}.`,
        ];
        if (wunsch.art === "privat") zeilen.push(wunsch.sofort === true ? WIDERRUF_VERLANGT_SATZ : WIDERRUF_NICHT_SATZ);
        await vermerk(best.ref, zeilen.join(" "));
      }
      const mitAuftrag = await auftragAn(best.ref);
      const wie = ersetzt && best.art === "neu" ? `, ersetzt die offene Bestellung ${ersetzt}` : best.art === "offen" ? ", offene Bestellung wiederverwendet" : "";
      await abschluss(`angelegt — ${best.ref} (${best.betragText}${best.mitAbo ? ", Kundenpreis mit Paket" : ""}${wie}), Zahlungsdaten per E-Mail${mitAuftrag ? ", Beschaffungsauftrag aus dem Antrag vermerkt" : ""}.`);
      return erg(ersetzt && best.art === "neu" ? "umgepreist" : best.art === "offen" ? "offen_behalten" : "angelegt",
        `${ref}: Bonitätsauskunft ${best.ref} zum Kundenpreis ${best.betragText} angelegt${wie}.`,
        { auskunftRef: best.ref, betragText: best.betragText, zahlungsseite: best.zahlungsseite });
    } catch (e) {
      // Zurück auf Anfang: die ersetzte Bestellung wieder offen, die Reservierung zurückgenommen.
      if (ersetzt) {
        await lauf`UPDATE fiaon_applications SET payment_status = 'pending_payment', updated_at = NOW()
                    WHERE ref = ${ersetzt} AND payment_status = 'superseded' AND superseded_by IS NULL`
          .catch((x) => console.error(`[AUSKUNFT-BUENDEL] ${ersetzt}: nicht zurückgesetzt:`, x));
      }
      await lauf`UPDATE fiaon_contact_log SET voided_at = NOW() WHERE id = ${anlage}`.catch(() => {});
      const grund = String((e as Error)?.message || e).slice(0, 200);
      await vermerk(ref, `Zusatz „Auskunft zum Kundenpreis“: Anlage gescheitert (${grund}) — beim nächsten Buchungslauf erneut, sonst bitte von Hand bestellen.`);
      return erg("fehler", `${ref}: Bündel-Auskunft nicht angelegt — ${grund}.`);
    }
  } catch (e) {
    return erg("fehler", `${ref}: Bündel nicht prüfbar — ${String((e as Error)?.message || e).slice(0, 200)}.`);
  }
}

/** Wie lange ein angehakter Zusatz ohne Paketzahlung das Angebot zum Einzelpreis zurückhält (Gegenlesen 26.09.2026, E-243). */
export const BUENDEL_WARTET_TAGE = 14;

/**
 * Wartet bei diesem Menschen ein Bündel auf die erste Paketzahlung? (Zusatz
 * vermerkt, Paket-Bestellung weder bezahlt noch storniert/ersetzt/verschmolzen,
 * noch keine Anlage.) Dann bietet niemand die Auskunft zum Einzelpreis an —
 * er hat sie zum Kundenpreis schon bestellt.
 *
 * Gegenlesen 26.09.2026 (E-243): nur BUENDEL_WARTET_TAGE lang ab dem Haken. Vorher
 * wartete das Bündel ohne Ende — wer anhakte und das Paket nie bezahlte, bekam die
 * Auskunft NIE mehr angeboten, auch nicht allein (Justin: „wenn nicht, auch gut,
 * dann nur die Bonität"). Danach darf das Angebot zum Einzelpreis wieder raus;
 * zahlt er das Paket doch noch, ersetzt das Bündel eine offene Einzelpreis-
 * Bestellung durch den Kundenpreis (auskunftBuendelNachZahlung).
 */
export async function buendelWartet(personId: number, lauf: Lauf = sqlPool): Promise<boolean> {
  if (!Number.isInteger(personId) || personId <= 0) return false;
  const [z] = (await lauf`
    SELECT 1 AS ja FROM fiaon_contact_log w JOIN fiaon_applications a ON a.ref = w.ref
     WHERE a.person_id = ${personId} AND w.voided_at IS NULL AND w.note LIKE ${`${BUENDEL_WUNSCH_VERMERK}%`}
       AND w.created_at > NOW() - ${BUENDEL_WARTET_TAGE}::int * INTERVAL '1 day'
       AND a.merged_into IS NULL AND a.cancelled_at IS NULL
       AND COALESCE(a.payment_status, '') NOT IN ('paid', 'superseded', 'cancelled')
       AND NOT EXISTS (SELECT 1 FROM fiaon_contact_log b
                        WHERE b.person_id = ${personId} AND b.voided_at IS NULL AND b.note LIKE ${`${BUENDEL_ANLAGE_VERMERK}%`})
     LIMIT 1`.catch((e) => { console.error("[AUSKUNFT-BUENDEL] buendelWartet:", String(e?.message || e).slice(0, 160)); return []; })) as any[];
  return !!z;
}

/**
 * Dieselbe Frage als SQL-Baustein (boolescher Ausdruck) für Mengen-Abfragen —
 * Verkaufstakt und WA-Zentrale (`NOT (…)` in ihrer Grundmenge). `person` ist
 * eine Spalte („p.id") oder ein Parameter („$1::int"); nur geprüfte Formen.
 */
export function buendelWartetSql(person: string): string {
  if (!/^(?:[a-z_][a-z0-9_]*\.)?[a-z_][a-z0-9_]*$|^\$\d+(?:::int)?$/i.test(person)) {
    throw new Error("[AUSKUNFT] buendelWartetSql: unerlaubter Personen-Ausdruck");
  }
  const wunsch = BUENDEL_WUNSCH_VERMERK.replace(/'/g, "''");
  const anlage = BUENDEL_ANLAGE_VERMERK.replace(/'/g, "''");
  return `EXISTS (SELECT 1 FROM fiaon_contact_log bw_w JOIN fiaon_applications bw_a ON bw_a.ref = bw_w.ref
     WHERE bw_a.person_id = ${person} AND bw_w.voided_at IS NULL AND bw_w.note LIKE '${wunsch}%'
       AND bw_w.created_at > NOW() - ${Math.trunc(BUENDEL_WARTET_TAGE)} * INTERVAL '1 day'
       AND bw_a.merged_into IS NULL AND bw_a.cancelled_at IS NULL
       AND COALESCE(bw_a.payment_status, '') NOT IN ('paid', 'superseded', 'cancelled')
       AND NOT EXISTS (SELECT 1 FROM fiaon_contact_log bw_b
                        WHERE bw_b.person_id = ${person} AND bw_b.voided_at IS NULL AND bw_b.note LIKE '${anlage}%'))`;
}

/**
 * Dieselbe Menge OHNE Bezug auf einen Menschen: die Personen-IDs, bei denen gerade ein Bündel
 * wartet (Integration 26.09.2026, E-243). Für die Grundmenge des Verkaufstakts (OHNE_AUSKUNFT_SQL
 * in fiaon-auskunft-verkauf.ts) — sie gilt für Takt, Tür (personImPool), WA-Gruppe
 * „auskunft_fehlt" samt Handversand und Chefseite. Vorher sperrte nur die Tür (auskunftAngebotKaufstand):
 * Die Grundmenge zählte den Menschen „im Kreis", der Takt wählte ihn und verwarf ihn erst vor dem
 * Versand, und der Handversand der WA-Zentrale („WhatsApp starten") prüft die Tür gar nicht — er
 * hätte das Angebot zum EINZELPREIS geschickt, obwohl die Auskunft im Antrag zum Kundenpreis bestellt ist.
 * Als `person NOT IN (…)`: Postgres rechnet die Liste einmal (Hash), nicht je Mensch.
 * person_id IS NOT NULL — sonst machte ein NULL in der Liste jedes NOT IN unbestimmt.
 */
export function buendelWartendeSql(): string {
  const wunsch = BUENDEL_WUNSCH_VERMERK.replace(/'/g, "''");
  const anlage = BUENDEL_ANLAGE_VERMERK.replace(/'/g, "''");
  return `SELECT bw_a.person_id FROM fiaon_contact_log bw_w JOIN fiaon_applications bw_a ON bw_a.ref = bw_w.ref
     WHERE bw_a.person_id IS NOT NULL AND bw_w.voided_at IS NULL AND bw_w.note LIKE '${wunsch}%'
       AND bw_w.created_at > NOW() - ${Math.trunc(BUENDEL_WARTET_TAGE)} * INTERVAL '1 day'
       AND bw_a.merged_into IS NULL AND bw_a.cancelled_at IS NULL
       AND COALESCE(bw_a.payment_status, '') NOT IN ('paid', 'superseded', 'cancelled')
       AND NOT EXISTS (SELECT 1 FROM fiaon_contact_log bw_b
                        WHERE bw_b.person_id = bw_a.person_id AND bw_b.voided_at IS NULL AND bw_b.note LIKE '${anlage}%')`;
}

export type PaketSchrittVariante = "neu" | "antrag";

/**
 * Nach der Lieferung der Auskunft: Darf und soll diesem Menschen das Paket
 * angeboten werden — und wohin führt der Weg? null = nein:
 *   · laufendes Paket (dann ist er schon Kunde),
 *   · Werbe- oder Vertriebssperre, Testkonto, gekündigt oder Vertrag vorbei,
 *     storniert (Justin: „außer stornierte Kunden"), Zahlung fürs Paket gemeldet.
 * „antrag": Ein fertiger Paket-Antrag wartet auf die erste Zahlung → seine
 * Zahlungsseite (kein zweiter Antrag). „neu": der Antrag, ohne den Zusatz
 * (src=auskunft_da — die Auskunft hat er ja).
 */
export async function auskunftPaketSchritt(personId: number, lauf: Lauf = sqlPool): Promise<{ variante: PaketSchrittVariante; url: string } | null> {
  if (!Number.isInteger(personId) || personId <= 0) return null;
  if (await hatLaufendesPaket(personId, lauf)) return null;
  const { personSperre } = await import("./fiaon-mail-frequenz");
  const s = await personSperre(personId).catch(() => null);
  if (!s || s.werbesperre || s.vertriebssperre || s.test || s.gekuendigt || s.vertragVorbei || s.laufendesPaket) return null;
  const zeilen = (await lauf`
    SELECT pack_key, payment_status, payment_reference, cancelled_at FROM fiaon_applications
     WHERE person_id = ${personId} AND merged_into IS NULL
       AND COALESCE(type, '') <> 'schufa' AND ref NOT LIKE 'FIAON-SCHUFA-%'
     ORDER BY created_at DESC`) as any[];
  const pakete = zeilen.filter((z) => istAboPaket(z.pack_key) && !istGlobalPaket(z.pack_key));
  if (pakete.some((z) => z.cancelled_at != null || String(z.payment_status ?? "") === "cancelled")) return null;
  if (pakete.some((z) => ["claimed_paid", "paid"].includes(String(z.payment_status ?? "")))) return null;
  const offen = pakete.find((z) => String(z.payment_status ?? "") === "pending_payment" && String(z.payment_reference ?? "").trim());
  if (offen) return { variante: "antrag", url: absoluteUrl(`/zahlung/${encodeURIComponent(String(offen.payment_reference).trim())}`) };
  return { variante: "neu", url: absoluteUrl("/antrag?src=auskunft_da") };
}
