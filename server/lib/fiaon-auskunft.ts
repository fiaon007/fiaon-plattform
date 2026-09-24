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
import { istAboPaket } from "@shared/fiaon-pakete";
import {
  auskunftPreisCents, auskunftSchluessel, auskunftLand, euroText, ALLE_AUSKUNFT_SCHLUESSEL,
  type AuskunftArt, type AuskunftLand,
} from "@shared/fiaon-auskunft";

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
  /** Die offene Bestellung (Zahlung ausstehend oder gemeldet). */
  offen: { ref: string; paymentReference: string | null; betragCents: number; status: string; angelegt: string } | null;
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
export async function auskunftStand(personId: number, lauf: Lauf = sqlPool, art: AuskunftArt = "privat"): Promise<AuskunftStand> {
  const [z] = (await lauf`
    SELECT
      (SELECT country FROM fiaon_applications WHERE person_id = ${personId} AND merged_into IS NULL AND country IS NOT NULL
        ORDER BY (payment_status = 'paid') DESC, created_at DESC LIMIT 1) AS land,
      EXISTS (SELECT 1 FROM fiaon_applications d WHERE d.person_id = ${personId} AND d.gdpr_deleted_at IS NULL AND d.schufa_pdf IS NOT NULL) AS dokument_da,
      (SELECT ref FROM fiaon_applications s WHERE s.person_id = ${personId} AND s.merged_into IS NULL
         AND (COALESCE(s.type, '') = 'schufa' OR s.ref LIKE 'FIAON-SCHUFA-%') AND s.payment_status = 'paid'
       ORDER BY s.created_at DESC LIMIT 1) AS bezahlt_ref`) as any[];
  const [o] = (await lauf`
    SELECT ref, payment_reference, amount_due, payment_status, created_at FROM fiaon_applications s
     WHERE s.person_id = ${personId} AND s.merged_into IS NULL
       AND (COALESCE(s.type, '') = 'schufa' OR s.ref LIKE 'FIAON-SCHUFA-%')
       AND s.payment_status IN ('pending_payment', 'claimed_paid')
     ORDER BY s.created_at DESC LIMIT 1`) as any[];
  const preis = await auskunftPreis(personId, art, lauf);
  const offen = o ? {
    ref: String(o.ref), paymentReference: o.payment_reference ?? null,
    betragCents: Math.round(Number(o.amount_due || 0) * 100), status: String(o.payment_status),
    angelegt: new Date(o.created_at).toISOString(),
  } : null;
  const stufe: AuskunftStufe = z?.bezahlt_ref ? "bezahlt" : offen ? "offen" : z?.dokument_da ? "dokument" : "nichts";
  return { stufe, offen, bezahltRef: z?.bezahlt_ref ?? null, dokumentDa: !!z?.dokument_da, land: auskunftLand(z?.land), preis };
}

export type AuskunftQuelle = "kunde" | "kundenbereich" | "mara_mail" | "mara_wa" | "betreuer" | "assistent" | "verkaufstakt" | "oeffentlich";

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
  if (stand.offen && (stand.offen.status === "claimed_paid"
      || Date.now() - new Date(stand.offen.angelegt).getTime() < OFFEN_WIEDERVERWENDEN_TAGE * 86_400_000)) {
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
  await lauf`
    INSERT INTO fiaon_applications (ref, type, status, pack_key, pack_name, first_name, last_name, company_name, email,
                                    street, zip, city, country, birthdate, phone, phone_country_code, person_id, assigned_agent_id,
                                    created_at, updated_at)
    VALUES (${ref}, 'schufa', 'submitted', ${preis.key}, ${packName},
            ${v.first_name}, ${v.last_name}, ${v.company_name}, ${v.email},
            ${v.street}, ${v.zip}, ${v.city}, ${v.country}, ${v.birthdate}, ${v.phone}, ${v.phone_country_code},
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
    await lauf`
      UPDATE fiaon_applications SET payment_status = 'superseded', superseded_by = ${ref}, updated_at = NOW()
       WHERE ref = ${stand.offen.ref} AND payment_status = 'pending_payment'`;
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
  await lauf`
    UPDATE fiaon_applications SET
      consent_agb = TRUE,
      consent_contract = TRUE,
      consent_schufa = ${angekreuzt("vollmacht_uebermittlung")},
      legal_form = COALESCE(${firma ? kurzText(b?.rechtsform, 60) || null : null}, legal_form),
      company_name = COALESCE(NULLIF(company_name, ''), ${firma ? kurzText(b?.firma, 200) || null : null}),
      updated_at = NOW()
    WHERE ref = ${ref}`;
  return zeilen.length > 0;
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
