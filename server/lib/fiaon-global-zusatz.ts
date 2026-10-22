// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — ZUSATZDIENSTE PER KLICK, Server (Scheibe 1 „Ihr US-Büro“, 22.10.2026)
//
// Der Kunde fügt im Portal einen Dienst hinzu (POST /global/mein-auftrag/:ref/zusatz) →
// Buchung in fiaon_global_zusatz → eigene Bestellzeile (global_zusatz_*, Loopback wie das
// Firmen-/Kapital-Angebot: firmaBestellzeileAnlegen) → bestellungFuerAntrag mit Rechnungsnummer →
// Rechnungsmail global_zusatz mit PDF (globalMailSenden, alle Mail-Wände) → Verlauf für den
// Kunden + Aufgabe fürs Team. Zahlung (onCustomerPaid → globalNachZahlung → zusatzNachZahlung)
// → „bezahlt“ + Verlauf + Aufgabe „einrichten“. Das Team setzt „aktiv“ im Chefbüro.
//
// ── WIEDERHOLBAR ───────────────────────────────────────────────────────────
// Je Mandat und Dienst höchstens EINE nicht stornierte Buchung — die Grenze steht in der
// Datenbank (Teilindex, ON CONFLICT mit demselben Prädikat). Ein zweiter Klick gibt die
// bestehende Buchung zurück; hing ein Schritt (Zeile ohne Rechnung), macht er dort weiter
// (zusatzKlickEntscheidung in shared/fiaon-global-zusatz.ts). Mail, Verlauf und Aufgabe
// entstehen genau einmal (Marke rechnung_am). Im selben Prozess laufen zwei Klicks
// desselben Dienstes nacheinander (laufend), nie nebeneinander.
//
// ── GLOBAL, NICHT PRIVAT ───────────────────────────────────────────────────
// Die Bestellzeile trägt einen Katalogschlüssel der Art „global“ mit zahlungsseite „global“
// (shared/fiaon-pakete.ts): keine Privat-Mails (make-webhook PRIVATLINIE), kein Abo, keine
// Privat-Erinnerung/Rückholung/Mara (pack_key LIKE 'global%', produktkategorie „global“), nie
// als Dublette stillgelegt. Der Global-Start nach der Zahlung zweigt für diese Zeilen ab.
// ═══════════════════════════════════════════════════════════════════════════
import { randomBytes } from "node:crypto";
import { sqlPool } from "./db-pool";
import { absoluteUrl } from "../fiaon-base-url";
import {
  GLOBAL_ZUSATZ, GLOBAL_ZUSATZ_FREIGABE_SCHLUESSEL, ZUSATZ_WOERTER, buchbareZusatzdienste, globalZusatz, globalZusatzVerfuegbar, globalZusatzZuPaket, zusatzAngabePruefen,
  zusatzFreigabeAus, zusatzFreigegeben, zusatzKlickEntscheidung, zusatzPreisText, zusatzWechselErlaubt,
  type GlobalZusatz, type ZusatzAuftrag, type ZusatzSprache, type ZusatzStatus,
} from "@shared/fiaon-global-zusatz";

type Erg = { status: number; body: Record<string, unknown> };
const RECHNUNG_STEHT = ["pending_payment", "claimed_paid", "paid"];
const chefLink = (ref: string) => `/chef/global?mandat=${encodeURIComponent(ref)}`;
const iso = (v: unknown): string | null => (v ? new Date(v as any).toISOString() : null);
const eur = (cents: number) => `${(cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

// ── SCHEMA (wie Migration 120_global_zusatz.sql) ─────────────────────────────
let bereit: Promise<void> | null = null;
export function ensureZusatzTabelle(): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_global_zusatz (
          id BIGSERIAL PRIMARY KEY,
          ref VARCHAR NOT NULL,
          zusatz_key TEXT NOT NULL,
          bestell_ref VARCHAR UNIQUE,
          status TEXT NOT NULL DEFAULT 'gebucht' CHECK (status IN ('gebucht', 'bezahlt', 'aktiv', 'storniert')),
          preis_cents INTEGER NOT NULL CHECK (preis_cents > 0),
          abrechnung TEXT NOT NULL,
          angabe TEXT,
          notiz TEXT,
          gebucht_ip TEXT,
          rechnung_am TIMESTAMPTZ,
          rechnung_mail_am TIMESTAMPTZ,
          rechnung_mail_fehler TEXT,
          bezahlt_am TIMESTAMPTZ,
          bezahlt_von TEXT,
          aktiv_am TIMESTAMPTZ,
          aktiv_von TEXT,
          storniert_am TIMESTAMPTZ,
          storniert_von TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      // Höchstens EINE nicht stornierte Buchung je Mandat und Dienst — ON CONFLICT nennt dasselbe Prädikat.
      await sqlPool`CREATE UNIQUE INDEX IF NOT EXISTS fiaon_global_zusatz_eins_idx ON fiaon_global_zusatz (ref, zusatz_key) WHERE status <> 'storniert'`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_global_zusatz_ref_idx ON fiaon_global_zusatz (ref, created_at DESC)`;
    })().catch((e) => { bereit = null; throw e; });
  }
  return bereit;
}

// ── LESEN ────────────────────────────────────────────────────────────────────
interface ZusatzZeile {
  id: number; ref: string; zusatz_key: string; bestell_ref: string | null; status: ZusatzStatus; preis_cents: number; abrechnung: string;
  angabe: string | null; notiz: string | null; rechnung_am: Date | null; rechnung_mail_am: Date | null; rechnung_mail_fehler: string | null;
  bezahlt_am: Date | null; bezahlt_von: string | null; aktiv_am: Date | null; aktiv_von: string | null; storniert_am: Date | null; storniert_von: string | null;
  created_at: Date; payment_status: string | null; payment_reference: string | null; invoice_number: string | null; payment_due_date: Date | null;
}
async function zeilenLesen(ref: string): Promise<ZusatzZeile[]> {
  await ensureZusatzTabelle();
  return (await sqlPool`
    SELECT z.*, a.payment_status, a.payment_reference, a.invoice_number, a.payment_due_date
      FROM fiaon_global_zusatz z LEFT JOIN fiaon_applications a ON a.ref = z.bestell_ref
     WHERE z.ref = ${ref}
     ORDER BY z.created_at DESC`) as any[];
}
async function zeileLesen(id: number): Promise<ZusatzZeile | null> {
  await ensureZusatzTabelle();
  const [z] = (await sqlPool`
    SELECT z.*, a.payment_status, a.payment_reference, a.invoice_number, a.payment_due_date
      FROM fiaon_global_zusatz z LEFT JOIN fiaon_applications a ON a.ref = z.bestell_ref
     WHERE z.id = ${id} LIMIT 1`) as any[];
  return z ?? null;
}

// ── FREIGABE JE DIENST (fiaon_settings, Vorgabe: nur Domain & E-Mail) ─────────
/** Welche Dienste Kunden sehen und buchen dürfen. Ein Lesefehler ergibt die Vorgabe — nie „alles frei“. */
export async function zusatzFreigabeLesen(): Promise<string[]> {
  const [z] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${GLOBAL_ZUSATZ_FREIGABE_SCHLUESSEL} LIMIT 1`.catch((e) => {
    console.error("[GLOBAL-ZUSATZ] Freigabe nicht gelesen — es gilt die Vorgabe:", e); return [];
  })) as any[];
  return zusatzFreigabeAus(z?.value);
}
/** Die Leitung schaltet einen Dienst frei oder zurück. Gibt die neue Liste zurück. */
export async function zusatzFreigabeSetzen(keyRoh: unknown, an: boolean, wer: string): Promise<{ ok: true; freigabe: string[]; meldung: string } | { ok: false; status: number; error: string }> {
  const z = globalZusatz(keyRoh);
  if (!z || !z.buchbar) return { ok: false, status: 400, error: "Diesen Dienst gibt es nicht." };
  const vorher = await zusatzFreigabeLesen();
  const neu = an ? Array.from(new Set([...vorher, z.key])) : vorher.filter((k) => k !== z.key);
  const ordnung = GLOBAL_ZUSATZ.map((x) => x.key);
  neu.sort((a, b) => ordnung.indexOf(a) - ordnung.indexOf(b));
  await sqlPool`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${GLOBAL_ZUSATZ_FREIGABE_SCHLUESSEL}, ${JSON.stringify(neu)}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
  console.log(`[GLOBAL-ZUSATZ] Freigabe ${z.key} → ${an ? "frei" : "zurück"} (${wer}); jetzt: ${neu.join(", ") || "keiner"}`);
  return { ok: true, freigabe: neu, meldung: an ? `„${z.de.titel}“ ist für Kunden freigegeben.` : `„${z.de.titel}“ ist für Kunden nicht mehr sichtbar. Bestehende Buchungen laufen weiter.` };
}

/** Paket und verbundenes Angebot des Mandats — für globalZusatzVerfuegbar (was der Auftrag schon enthält). */
export async function zusatzAuftragLesen(ref: string): Promise<ZusatzAuftrag> {
  const [g] = (await sqlPool`SELECT paket_key, angebot_id FROM fiaon_global_auftraege WHERE ref = ${ref} LIMIT 1`.catch(() => [])) as any[];
  let fassung: string | null = null;
  if (g?.angebot_id != null) {
    const [a] = (await sqlPool`SELECT fassung FROM fiaon_global_angebote WHERE id = ${Number(g.angebot_id)} LIMIT 1`.catch(() => [])) as any[];
    fassung = a?.fassung ? String(a.fassung) : null;
  }
  return { paketKey: g?.paket_key ? String(g.paket_key) : null, angebotFassung: fassung };
}
/** Die Schlüssel der Dienste, die der Auftrag schon enthält — das Portal zeigt sie als „Im Auftrag enthalten“. */
export async function zusatzEnthalten(ref: string): Promise<string[]> {
  const auftrag = await zusatzAuftragLesen(ref);
  return buchbareZusatzdienste().filter((z) => globalZusatzVerfuegbar(auftrag, z.key).grund === "enthalten").map((z) => z.key);
}

/** Was das Portal über die gebuchten Dienste zeigt — die Texte liest die Seite aus dem Katalog (shared). */
export async function zusatzKundenSicht(ref: string, token: string, vorschau: boolean): Promise<Record<string, unknown>[]> {
  const r = encodeURIComponent(ref);
  return (await zeilenLesen(ref)).filter((z) => z.status !== "storniert").map((z) => {
    const offen = z.status === "gebucht" && !!z.payment_reference && ["pending_payment", "claimed_paid"].includes(String(z.payment_status));
    return {
      id: Number(z.id), key: z.zusatz_key, status: z.status, preisCents: Number(z.preis_cents), abrechnung: z.abrechnung, angabe: z.angabe,
      am: iso(z.created_at), bezahltAm: iso(z.bezahlt_am), aktivAm: iso(z.aktiv_am),
      rechnungsnummer: z.invoice_number ?? null,
      zahlungOffen: offen,
      zahlungsseite: offen ? `/zahlung/${encodeURIComponent(String(z.payment_reference))}?bereich=business` : null,
      rechnungUrl: z.payment_reference ? `/api/fiaon/global/mein-auftrag/${r}/zusatz/${z.id}/rechnung.pdf?t=${encodeURIComponent(token)}${vorschau ? "&vorschau=1" : ""}` : null,
    };
  });
}

/** Die Rechnung einer Buchung — nur, wenn sie zu DIESEM Mandat gehört. */
export async function zusatzRechnungPdf(ref: string, idRoh: unknown): Promise<{ pdf: Buffer; dateiname: string } | null> {
  const id = Number(idRoh);
  if (!Number.isInteger(id) || id <= 0) return null;
  const z = await zeileLesen(id);
  if (!z || z.ref !== ref || !z.bestell_ref) return null;
  const { globalRechnungPdf } = await import("./fiaon-global-auftrag");
  return globalRechnungPdf(z.bestell_ref);
}

/** Für die Rechnung (server/fiaon-invoice.ts): Sprache des Mandats und die Angabe der Buchung zu einer Zusatz-Bestellzeile. */
export async function zusatzRechnungKontext(bestellRef: string): Promise<{ sprache: ZusatzSprache; angabe: string | null } | null> {
  await ensureZusatzTabelle();
  const [z] = (await sqlPool`
    SELECT z.angabe, g.vertrag_sprache FROM fiaon_global_zusatz z LEFT JOIN fiaon_global_auftraege g ON g.ref = z.ref
     WHERE z.bestell_ref = ${bestellRef} LIMIT 1`) as any[];
  if (!z) return null;
  return { sprache: String(z.vertrag_sprache ?? "").trim().toLowerCase() === "en" ? "en" : "de", angabe: z.angabe ?? null };
}

// ── BUCHEN ───────────────────────────────────────────────────────────────────
const laufend = new Map<string, Promise<Erg>>();

/** Der Klick des Kunden auf „Hinzufügen“. Antwort in der Sprache des Mandats; nie zwei Buchungen desselben Dienstes. */
export function zusatzBuchen(ref: string, ein: { key: unknown; angabe?: unknown }, kontext: { ip: string; userAgent: string }): Promise<Erg> {
  const schluessel = `${ref}:${String(ein.key ?? "").trim().toLowerCase()}`;
  const vorher = laufend.get(schluessel);
  const lauf = (vorher ?? Promise.resolve(null)).catch(() => null).then(() => buchen(ref, ein, kontext));
  laufend.set(schluessel, lauf);
  void lauf.finally(() => { if (laufend.get(schluessel) === lauf) laufend.delete(schluessel); });
  return lauf;
}

async function buchen(ref: string, ein: { key: unknown; angabe?: unknown }, kontext: { ip: string; userAgent: string }): Promise<Erg> {
  const { lageLesen } = await import("./fiaon-global-bereich");
  const { ensureGlobalMandat } = await import("./fiaon-global-mandat");
  await ensureGlobalMandat();
  await ensureZusatzTabelle();
  const l = await lageLesen(ref);
  const s: ZusatzSprache = l?.sprache === "en" ? "en" : "de";
  const W = ZUSATZ_WOERTER[s];
  const nein = (status: number, error: string, extra: Record<string, unknown> = {}): Erg => ({ status, body: { ok: false, error, ...extra } });
  if (!l) return nein(404, s === "en" ? "We cannot find an order for this link." : "Wir finden zu diesem Link keinen Auftrag.");
  const z = globalZusatz(ein.key);
  if (!z || !z.buchbar) return nein(404, W.unbekannt);
  // Freigabe je Dienst: Was die Leitung nicht freigegeben hat, nimmt der Server nicht an — auch nicht über einen alten Link.
  if (!zusatzFreigegeben(z.key, await zusatzFreigabeLesen())) return nein(409, W.nochNichtVerfuegbar, { code: "NICHT_FREIGEGEBEN" });
  if (l.status === "storniert") return nein(409, W.storniert);
  // Schon Teil des Pakets oder des Angebots (z. B. Website im Firmenangebot) → keine Rechnung.
  if (globalZusatzVerfuegbar(await zusatzAuftragLesen(ref), z.key).grund === "enthalten") return nein(409, W.schonEnthalten, { code: "ENTHALTEN" });
  const [mandat] = (await sqlPool`SELECT ist_test_am FROM fiaon_global_auftraege WHERE ref = ${ref} LIMIT 1`) as any[];
  if (mandat?.ist_test_am) return nein(409, W.test);
  const { istRoboterUnterschrift } = await import("./fiaon-vertrieb-zusage");
  if (istRoboterUnterschrift(kontext.ip, kontext.userAgent).roboter) return nein(403, W.roboter);

  // Die bestehende (nicht stornierte) Buchung zuerst — ein zweiter Klick legt nichts an.
  const vorhandenLesen = async () => {
    const [v] = (await sqlPool`
      SELECT z.id, z.status, z.bestell_ref, a.payment_status, a.payment_reference
        FROM fiaon_global_zusatz z LEFT JOIN fiaon_applications a ON a.ref = z.bestell_ref
       WHERE z.ref = ${ref} AND z.zusatz_key = ${z.key} AND z.status <> 'storniert' LIMIT 1`) as any[];
    return v ?? null;
  };
  let v = await vorhandenLesen();
  const entscheidung = zusatzKlickEntscheidung(v ? { status: v.status, bestellRef: v.bestell_ref, rechnungSteht: !!v.payment_reference && RECHNUNG_STEHT.includes(String(v.payment_status)) } : null);
  if (entscheidung === "schon") return { status: 200, body: { ok: true, schon: true, meldung: W.schonText, buchung: { id: Number(v.id), status: v.status } } };
  let angabe: string | null = null;
  if (entscheidung === "neu") {
    const a = zusatzAngabePruefen(z, ein.angabe, s);
    if (!a.ok) return nein(400, a.error, { feld: "angabe" });
    angabe = a.wert;
    await sqlPool`
      INSERT INTO fiaon_global_zusatz (ref, zusatz_key, status, preis_cents, abrechnung, angabe, gebucht_ip)
      VALUES (${ref}, ${z.key}, 'gebucht', ${z.preisCents}, ${z.abrechnung}, ${angabe}, ${String(kontext.ip || "").slice(0, 80) || null})
      ON CONFLICT (ref, zusatz_key) WHERE status <> 'storniert' DO NOTHING`;
    v = await vorhandenLesen();
    if (!v) return nein(502, W.technisch);
  }
  try {
    const erg = await rechnungStellen(Number(v.id), z, l, kontext);
    if (!erg.ok) return nein(502, W.technisch);
    return { status: 200, body: { ok: true, meldung: ZUSATZ_WOERTER[s].fertigText, buchung: { id: Number(v.id), status: "gebucht" } } };
  } catch (e) {
    console.error(`[GLOBAL-ZUSATZ] ${ref}: ${z.key} — Rechnung:`, e);
    return nein(502, W.technisch);
  }
}

/** Bestellzeile + Rechnungsnummer + (einmal) Verlauf, Mail und Aufgabe. Wiederholbar: jeder Schritt prüft, ob er getan ist. */
async function rechnungStellen(id: number, z: GlobalZusatz, l: any, kontext: { ip: string; userAgent: string }): Promise<{ ok: boolean }> {
  const ref = String(l.ref);
  const zeile = await zeileLesen(id);
  if (!zeile || zeile.status === "storniert") return { ok: false };
  let bestellRef = zeile.bestell_ref;
  if (!bestellRef) {
    const neu = `FIAON-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").slice(0, 4).toUpperCase()}`;
    const kunde = await kundeAusMandat(ref, l.akte);
    const { firmaBestellzeileAnlegen } = await import("./fiaon-global-angebot-firma");
    const ok = await firmaBestellzeileAnlegen(neu, { kunde } as any, z.de.titel, kontext, { packKey: z.packKey, packName: `FIAON Global – ${z.de.titel}` });
    if (!ok) return { ok: false };
    const [gebunden] = (await sqlPool`UPDATE fiaon_global_zusatz SET bestell_ref = ${neu}, updated_at = NOW() WHERE id = ${id} AND bestell_ref IS NULL AND status <> 'storniert' RETURNING id`) as any[];
    if (!gebunden) {
      // Ein anderer Lauf war schneller — seine Zeile gilt, diese wird nie berechnet.
      await sqlPool`UPDATE fiaon_applications SET payment_status = 'cancelled', cancelled_at = NOW(), updated_at = NOW() WHERE ref = ${neu} AND payment_status IN ('pending', 'pending_payment')`.catch(() => {});
      const jetzt = await zeileLesen(id);
      if (!jetzt?.bestell_ref) return { ok: false };
      bestellRef = jetzt.bestell_ref;
    } else bestellRef = neu;
  }
  // Rechnung wie die des Mandats: USt-Modus, USt-IdNr. und Firma von der Bestellzeile des Auftrags — VOR der Nummer.
  await zeileWieMandat(bestellRef, ref);
  const [b0] = (await sqlPool`SELECT payment_status, payment_reference FROM fiaon_applications WHERE ref = ${bestellRef} LIMIT 1`) as any[];
  if (!b0?.payment_reference || !RECHNUNG_STEHT.includes(String(b0.payment_status))) {
    const { bestellungFuerAntrag } = await import("../routes/fiaon-antrag");
    const erg = await bestellungFuerAntrag(bestellRef, { globalMailFolgt: true });
    if (erg.status !== 200) { console.error(`[GLOBAL-ZUSATZ] ${ref}: Bestellung ${bestellRef}: ${String((erg.body as any)?.error || erg.status)}`); return { ok: false }; }
  }
  await zeileWieMandat(bestellRef, ref);

  // Der erste Lauf, nach dem die Rechnung steht, schreibt Verlauf, Mail und Aufgabe — genau einmal.
  const [erst] = (await sqlPool`UPDATE fiaon_global_zusatz SET rechnung_am = NOW(), updated_at = NOW() WHERE id = ${id} AND rechnung_am IS NULL RETURNING id`) as any[];
  if (erst) await nachDerRechnung(id, z, l).catch((e) => console.error(`[GLOBAL-ZUSATZ] ${ref}: ${z.key} — Mail/Verlauf/Aufgabe:`, e));
  return { ok: true };
}

/** Der Kunde der Rechnung — aus der Bestellzeile des Mandats (jedes Mandat hat sie), ergänzt aus der Akte. */
async function kundeAusMandat(ref: string, akte: any): Promise<Record<string, any>> {
  const [m] = (await sqlPool`
    SELECT company_name, legal_form, tax_id, first_name, last_name, contact_name, email, contact_email, contact_phone, street, zip, city, country
      FROM fiaon_applications WHERE ref = ${ref} LIMIT 1`) as any[];
  const json = (v: unknown): Record<string, any> => { if (v && typeof v === "object") return v as any; try { return JSON.parse(String(v ?? "")) ?? {}; } catch { return {}; } };
  const f = json(akte?.firma); const ap = json(akte?.ansprechpartner);
  const [vorname, ...rest] = String(m?.contact_name || "").trim().split(/\s+/);
  return {
    firma: {
      name: String(m?.company_name || f.name || akte?.firma_name || "").trim(),
      rechtsform: String(m?.legal_form || f.rechtsform || "").trim(),
      uid: (m?.tax_id || akte?.ust_id || f.ustId || null) ? String(m?.tax_id || akte?.ust_id || f.ustId) : null,
      strasse: String(m?.street || f.strasse || ""), plz: String(m?.zip || f.plz || ""), ort: String(m?.city || f.ort || ""), land: String(m?.country || f.land || ""),
    },
    vertretung: { vorname: String(ap.vorname || m?.first_name || vorname || ""), nachname: String(ap.nachname || m?.last_name || rest.join(" ") || "") },
    email: String(akte?.email || ap.email || m?.contact_email || m?.email || "").trim().toLowerCase(),
    telefon: String(ap.telefon || m?.contact_phone || "") || null,
  };
}

/** USt-Modus, USt-IdNr., Firma und Person der Zusatzzeile = die der Bestellzeile des Mandats (wiederholbar). */
async function zeileWieMandat(bestellRef: string, ref: string): Promise<void> {
  await sqlPool`
    UPDATE fiaon_applications z
       SET rechnung_ust_modus = COALESCE(m.rechnung_ust_modus, z.rechnung_ust_modus), tax_id = COALESCE(m.tax_id, z.tax_id),
           company_name = COALESCE(NULLIF(m.company_name, ''), z.company_name), legal_form = COALESCE(NULLIF(m.legal_form, ''), z.legal_form),
           person_id = COALESCE(z.person_id, m.person_id)
      FROM fiaon_applications m
     WHERE z.ref = ${bestellRef} AND m.ref = ${ref}`;
}

/** Verlauf (sichtbar), Rechnungsmail mit PDF, Aufgabe fürs Team. Einmal je Buchung. */
async function nachDerRechnung(id: number, z: GlobalZusatz, l: any): Promise<void> {
  const ref = String(l.ref);
  const s: ZusatzSprache = l.sprache === "en" ? "en" : "de";
  const zeile = (await zeileLesen(id))!;
  const { globalBestellungLesen, globalMailSenden, globalRechnungPdf, globalMeinAuftragUrl, globalVerlauf, globalEinstellungen } = await import("./fiaon-global-auftrag");
  const { verlaufSchreiben } = await import("./fiaon-global-bereich");
  const b = await globalBestellungLesen(String(zeile.bestell_ref));
  const nr = String(b?.invoice_number || b?.payment_reference || zeile.bestell_ref);
  await verlaufSchreiben(ref, { art: "zusatz", text: ZUSATZ_WOERTER[s].verlaufGebucht(z[s].titel, zusatzPreisText(z, s), nr), sichtbar: true, von: "kunde" });
  await globalVerlauf(ref, `FIAON Global: Zusatzdienst im Portal gebucht — ${z.de.titel} (${zusatzPreisText(z, "de")}), Rechnung ${nr}${zeile.angabe ? `, Angabe „${zeile.angabe}“` : ""}.`).catch(() => {});

  // Die Rechnungsmail — über die Wände von globalMailSenden (Firmenangebot E-301: keine Automatik → Aufgabe sagt es).
  let mailSatz = "";
  try {
    const pdf = await globalRechnungPdf(String(zeile.bestell_ref));
    const mail = await globalMailSenden("global_zusatz", l.akte, b, {
      anhaenge: pdf ? [{ name: pdf.dateiname, inhalt: pdf.pdf }] : [],
      ausgeloestVon: "System (Zusatzdienst im Portal gebucht)",
      zusatz: {
        antrag_id: ref,
        mein_auftrag_url: globalMeinAuftragUrl(ref, s),
        paket: z[s].titel,
        zusatz_titel: z[s].titel,
        betrag_text: zusatzPreisText(z, s),
        zusatz_einrichtung: z[s].einrichtung,
        rechnungsnummer: nr,
      },
    });
    if (mail.ok) {
      await sqlPool`UPDATE fiaon_global_zusatz SET rechnung_mail_am = NOW(), rechnung_mail_fehler = NULL, updated_at = NOW() WHERE id = ${id}`;
      mailSatz = `Rechnungsmail mit PDF ist an den Kunden raus.`;
    } else {
      await sqlPool`UPDATE fiaon_global_zusatz SET rechnung_mail_fehler = ${String(mail.grund || "unbekannt").slice(0, 500)}, updated_at = NOW() WHERE id = ${id}`;
      mailSatz = `Die Rechnungsmail ging NICHT raus (${mail.grund}) — bitte die Rechnung von Hand schicken (Zahlungsseite unten).`;
    }
  } catch (e) {
    mailSatz = `Die Rechnungsmail ging NICHT raus (${e instanceof Error ? e.message : String(e)}) — bitte die Rechnung von Hand schicken.`;
  }

  const zahlungsseite = b?.payment_reference ? absoluteUrl(`/zahlung/${b.payment_reference}?bereich=business`) : null;
  const firma = String(l.akte?.firma_name || b?.company_name || ref);
  try {
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    await auftragFuerKunden({
      personId: b?.person_id != null ? Number(b.person_id) : null, ref,
      titel: `FIAON Global: Zusatzdienst gebucht — ${z.de.titel}, ${firma}`,
      text: [
        `${firma} hat im Portal „${z.de.titel}“ hinzugefügt (${zusatzPreisText(z, "de")}${z.abrechnung !== "einmalig" ? ", berechnet ist nur der erste Zeitraum — Folgerechnungen bis zur laufenden Abrechnung von Hand" : ""}).`,
        zeile.angabe ? `Angabe des Kunden: ${zeile.angabe}` : null,
        `Rechnung ${nr} über ${eur(z.preisCents)}${b?.payment_reference ? ` · Verwendungszweck ${b.payment_reference}` : ""}${zahlungsseite ? ` · Zahlungsseite ${zahlungsseite}` : ""}.`,
        mailSatz,
        `Intern: ${z.intern}`,
        "Nach dem Zahlungseingang kommt die Aufgabe „einrichten“. Ist der Dienst eingerichtet: im Chefbüro › Global › Leistungen auf „aktiv“ setzen — der Kunde sieht es sofort.",
      ].filter(Boolean).join("\n"),
      schluessel: `global:${ref}:zusatz:${id}:gebucht`, bereich: "konten", quelle: "global", autorName: "FIAON Global",
      link: chefLink(ref),
      agentId: (l.akte?.zustaendig_agent_id ? Number(l.akte.zustaendig_agent_id) : null) ?? (await globalEinstellungen()).zustaendigAgentId,
      anlageText: "Zusatzdienst im Portal gebucht.",
    });
  } catch (e) { console.error(`[GLOBAL-ZUSATZ] ${ref}: Aufgabe „gebucht“:`, e); }
}

// ── ZAHLUNG (aus globalNachZahlung — alle Buchungswege gehen durch onCustomerPaid) ──
export async function zusatzNachZahlung(bestellRef: string): Promise<{ gestartet: boolean; grund?: string }> {
  await ensureZusatzTabelle();
  const { globalBestellungLesen } = await import("./fiaon-global-auftrag");
  const b = await globalBestellungLesen(bestellRef);
  if (!b || String(b.payment_status) !== "paid") return { gestartet: false, grund: "nicht bezahlt" };
  const [z] = (await sqlPool`SELECT * FROM fiaon_global_zusatz WHERE bestell_ref = ${bestellRef} LIMIT 1`) as any[];
  if (!z) return { gestartet: false, grund: "keine Buchung zu dieser Zeile" };
  const kat = globalZusatz(z.zusatz_key) ?? globalZusatzZuPaket(b.pack_key);
  const [neu] = (await sqlPool`
    UPDATE fiaon_global_zusatz SET status = 'bezahlt', bezahlt_am = COALESCE(bezahlt_am, ${b.completed_at ?? new Date()}), bezahlt_von = COALESCE(bezahlt_von, 'Zahlungseingang'), updated_at = NOW()
     WHERE id = ${z.id} AND status = 'gebucht' RETURNING id`) as any[];
  if (!neu) {
    if (String(z.status) === "storniert") {
      // Bezahlt nach dem Storno: das System bewegt kein Geld — die Leitung entscheidet über die Erstattung.
      const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
      await auftragFuerKunden({
        personId: b.person_id != null ? Number(b.person_id) : null, ref: String(z.ref),
        titel: `FIAON Global: stornierter Zusatzdienst bezahlt — ${kat?.de.titel ?? z.zusatz_key}`,
        text: `Für den stornierten Zusatzdienst „${kat?.de.titel ?? z.zusatz_key}“ ist eine Zahlung gebucht (${b.payment_reference ?? bestellRef}). Das System hat KEIN Geld bewegt — bitte entscheiden: wieder aktivieren oder von Hand erstatten.`,
        dringend: true, anBetreiber: true, schluessel: `global:${z.ref}:zusatz:${z.id}:nach-storno`, bereich: "konten", quelle: "global", autorName: "FIAON Global",
        link: chefLink(String(z.ref)),
      }).catch((e) => console.error(`[GLOBAL-ZUSATZ] ${z.ref}: Aufgabe „nach Storno bezahlt“:`, e));
    }
    return { gestartet: false, grund: `Zusatzdienst steht auf „${z.status}“ — nichts zu tun` };
  }
  const ref = String(z.ref);
  const { lageLesen, verlaufSchreiben } = await import("./fiaon-global-bereich");
  const l = await lageLesen(ref).catch(() => null);
  const s: ZusatzSprache = l?.sprache === "en" ? "en" : "de";
  const titel = kat ? kat[s].titel : String(z.zusatz_key);
  await verlaufSchreiben(ref, { art: "zusatz", text: ZUSATZ_WOERTER[s].verlaufBezahlt(titel), sichtbar: true });
  const { globalVerlauf, globalEinstellungen } = await import("./fiaon-global-auftrag");
  await globalVerlauf(ref, `FIAON Global: Zusatzdienst bezahlt — ${kat?.de.titel ?? z.zusatz_key} (${b.payment_reference ?? bestellRef}).`).catch(() => {});
  try {
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    await auftragFuerKunden({
      personId: b.person_id != null ? Number(b.person_id) : null, ref,
      titel: `FIAON Global: Zusatzdienst einrichten — ${kat?.de.titel ?? z.zusatz_key}, ${l?.akte?.firma_name || b.company_name || ref}`,
      text: [
        `Die Zahlung für „${kat?.de.titel ?? z.zusatz_key}“ ist eingegangen (${b.payment_reference ?? bestellRef}). Bitte jetzt einrichten.`,
        z.angabe ? `Angabe des Kunden: ${z.angabe}` : null,
        kat ? `Was der Kunde gelesen hat: ${kat.de.einrichtung}` : null,
        kat ? `Intern: ${kat.intern}` : null,
        "Fertig eingerichtet: im Chefbüro › Global › Leistungen auf „aktiv“ setzen.",
      ].filter(Boolean).join("\n"),
      dringend: true, schluessel: `global:${ref}:zusatz:${z.id}:einrichten`, bereich: "konten", quelle: "global", autorName: "FIAON Global",
      link: chefLink(ref),
      agentId: (l?.akte?.zustaendig_agent_id ? Number(l.akte.zustaendig_agent_id) : null) ?? (await globalEinstellungen()).zustaendigAgentId,
      anlageText: "Zahlungseingang Zusatzdienst — einrichten.",
    });
  } catch (e) { console.error(`[GLOBAL-ZUSATZ] ${ref}: Aufgabe „einrichten“:`, e); }
  return { gestartet: false, grund: "Zusatzdienst bezahlt — Aufgabe „einrichten“ vergeben" };
}

/** Der Kunde meldet auf der Zahlungsseite „überwiesen“ — Kommentar an die Aufgabe des Dienstes statt „neuer Auftrag“. */
export async function zusatzZahlungGemeldet(bestellRef: string): Promise<void> {
  await ensureZusatzTabelle();
  const [z] = (await sqlPool`SELECT id, ref, zusatz_key FROM fiaon_global_zusatz WHERE bestell_ref = ${bestellRef} LIMIT 1`) as any[];
  if (!z) return;
  const kat = globalZusatz(z.zusatz_key);
  const { globalBestellungLesen, globalVerlauf } = await import("./fiaon-global-auftrag");
  const b = await globalBestellungLesen(bestellRef);
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  await auftragFuerKunden({
    personId: b?.person_id != null ? Number(b.person_id) : null, ref: String(z.ref),
    titel: `FIAON Global: Zusatzdienst gebucht — ${kat?.de.titel ?? z.zusatz_key}, ${b?.company_name || z.ref}`,
    text: `Der Kunde hat auf der Zahlungsseite gemeldet, dass er die Rechnung für „${kat?.de.titel ?? z.zusatz_key}“ überwiesen hat (Verwendungszweck ${b?.payment_reference ?? "—"}). Den Eingang prüft die Zahlungsstelle; mit der Buchung kommt die Aufgabe „einrichten“.`,
    schluessel: `global:${z.ref}:zusatz:${z.id}:gebucht`, bereich: "konten", quelle: "global", autorName: "FIAON Global", link: chefLink(String(z.ref)),
    anlageText: "Zahlung gemeldet (Zusatzdienst).",
  });
  await globalVerlauf(String(z.ref), `FIAON Global: Zahlung für den Zusatzdienst ${kat?.de.titel ?? z.zusatz_key} vom Kunden gemeldet.`).catch(() => {});
}

// ── CHEFBÜRO ─────────────────────────────────────────────────────────────────
export async function zusatzChefListe(ref: string): Promise<Record<string, unknown>> {
  const zeilen = await zeilenLesen(ref);
  return {
    katalog: await (async () => {
      const frei = await zusatzFreigabeLesen();
      return GLOBAL_ZUSATZ.map((z) => ({ key: z.key, titel: z.de.titel, preis: zusatzPreisText(z, "de"), buchbar: z.buchbar, freigegeben: zusatzFreigegeben(z.key, frei), intern: z.intern }));
    })(),
    buchungen: zeilen.map((z) => {
      const k = globalZusatz(z.zusatz_key);
      return {
        id: Number(z.id), key: z.zusatz_key, titel: k?.de.titel ?? z.zusatz_key, preis: k ? zusatzPreisText({ preisCents: Number(z.preis_cents), abrechnung: z.abrechnung as any }, "de") : eur(Number(z.preis_cents)),
        status: z.status, angabe: z.angabe, notiz: z.notiz, intern: k?.intern ?? null,
        bestellRef: z.bestell_ref, rechnungsnummer: z.invoice_number, zahlungsstatus: z.payment_status, verwendungszweck: z.payment_reference,
        rechnungUrl: z.bestell_ref && z.payment_reference ? `/api/fiaon/chef/global/mandate/${encodeURIComponent(ref)}/zusatz/${z.id}/rechnung.pdf` : null,
        mailAm: iso(z.rechnung_mail_am), mailFehler: z.rechnung_mail_fehler,
        am: iso(z.created_at), bezahltAm: iso(z.bezahlt_am), bezahltVon: z.bezahlt_von, aktivAm: iso(z.aktiv_am), aktivVon: z.aktiv_von,
        storniertAm: iso(z.storniert_am), storniertVon: z.storniert_von,
      };
    }),
  };
}

/** Status im Chefbüro: bezahlt (von Hand), aktiv, storniert. Wechsel nur nach ZUSATZ_WECHSEL. */
export async function zusatzStatusSetzen(ref: string, idRoh: unknown, nachRoh: unknown, notizRoh: unknown, agent: { id: number; name: string }): Promise<{ ok: true; meldung: string } | { ok: false; status: number; error: string }> {
  const id = Number(idRoh);
  const nach = String(nachRoh ?? "") as ZusatzStatus;
  const notiz = String(notizRoh ?? "").replace(/\s+/g, " ").trim().slice(0, 500) || null;
  if (!Number.isInteger(id) || id <= 0) return { ok: false, status: 400, error: "Buchung fehlt." };
  const z = await zeileLesen(id);
  if (!z || z.ref !== ref) return { ok: false, status: 404, error: "Diese Buchung gibt es zu diesem Mandat nicht." };
  if (!zusatzWechselErlaubt(z.status, nach)) return { ok: false, status: 409, error: `Von „${z.status}“ geht es nicht auf „${nach}“.` };
  const [neu] = (await sqlPool`
    UPDATE fiaon_global_zusatz SET status = ${nach}, notiz = COALESCE(${notiz}, notiz), updated_at = NOW(),
           bezahlt_am = CASE WHEN ${nach} = 'bezahlt' THEN NOW() ELSE bezahlt_am END,
           bezahlt_von = CASE WHEN ${nach} = 'bezahlt' THEN ${`von Hand: ${agent.name}`} ELSE bezahlt_von END,
           aktiv_am = CASE WHEN ${nach} = 'aktiv' THEN NOW() ELSE aktiv_am END,
           aktiv_von = CASE WHEN ${nach} = 'aktiv' THEN ${agent.name} ELSE aktiv_von END,
           storniert_am = CASE WHEN ${nach} = 'storniert' THEN NOW() ELSE storniert_am END,
           storniert_von = CASE WHEN ${nach} = 'storniert' THEN ${agent.name} ELSE storniert_von END
     WHERE id = ${id} AND status = ${z.status} RETURNING id`) as any[];
  if (!neu) return { ok: false, status: 409, error: "Die Buchung hat sich gerade geändert — bitte neu laden." };
  const k = globalZusatz(z.zusatz_key);
  const { lageLesen, verlaufSchreiben } = await import("./fiaon-global-bereich");
  const l = await lageLesen(ref).catch(() => null);
  const s: ZusatzSprache = l?.sprache === "en" ? "en" : "de";
  const titel = k ? k[s].titel : z.zusatz_key;
  let zusatzSatz = "";
  if (nach === "storniert") {
    // Eine offene Rechnung wird storniert; eine bezahlte bleibt — Geld bewegt das System nie (Erstattung nur von Hand).
    const [st] = z.bestell_ref ? (await sqlPool`
      UPDATE fiaon_applications SET payment_status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
       WHERE ref = ${z.bestell_ref} AND payment_status IN ('pending', 'pending_payment', 'claimed_paid') RETURNING ref`) as any[] : [];
    zusatzSatz = st ? " Die offene Rechnung ist storniert." : z.payment_status === "paid" ? " Die Rechnung war bezahlt — eine Erstattung geht nur von Hand (das System bewegt kein Geld)." : "";
  }
  // Jeder Schritt steht beim Kunden im Verlauf (auch „bezahlt“ von Hand) — dazu eine interne Zeile mit Namen und Notiz.
  const sichtbar = true;
  const text = nach === "aktiv" ? ZUSATZ_WOERTER[s].verlaufAktiv(titel) : nach === "storniert" ? ZUSATZ_WOERTER[s].verlaufStorniert(titel) : ZUSATZ_WOERTER[s].verlaufBezahlt(titel);
  await verlaufSchreiben(ref, { art: "zusatz", text, sichtbar, agentId: agent.id || null });
  await verlaufSchreiben(ref, { art: "zusatz", text: `Leistung „${k?.de.titel ?? z.zusatz_key}“ → ${nach} (${agent.name})${notiz ? ` — ${notiz}` : ""}.${zusatzSatz}`, sichtbar: false, agentId: agent.id || null });
  return { ok: true, meldung: `„${k?.de.titel ?? z.zusatz_key}“ steht jetzt auf „${nach}“.${zusatzSatz}` };
}
