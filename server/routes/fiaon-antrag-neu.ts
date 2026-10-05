// ═══════════════════════════════════════════════════════════════════════════
// DER NEUE PRIVATANTRAG /antrag-neu — die Server-Seite (05.10.2026, E-282)
//
// Justin: „bau es jetzt unter /antrag-neu … achte auf JEDES Detail … führe
// Statistik darüber, ich will später wissen, wie der Weg performt und wie das
// alte." Und: „Nach der Bonitätsprüfung soll der Kunde einen 4-stelligen
// persönlichen Code auswählen."
//
// ── EIN WEG IN DIE BESTEHENDE PLATTFORM, KEIN ZWEITER ─────────────────────
// Die Antragszeile wird NICHT selbst geschrieben, sondern über POST
// /api/fiaon/application (fiaon-antrag.ts) — dieselbe Stelle, durch die der
// alte Antrag geht: Reinigung, Personenbindung, Willkommensmail, Lead-
// Umwandlung, Messung, Einstufung, Vertragsannahme (consent_contract,
// agb_stand). Das Muster (interner Aufruf mit IP und Browser des Menschen)
// steht schon in fiaon-global-auftrag.ts. Die Bestellung entsteht über
// bestellungFuerAntrag — dieselbe Funktion wie im alten Weg.
//
// Weil /application fast jedes Feld überschreibt, das im Rumpf fehlt, hält
// DIESER Server die vollständigen Angaben (antrag_neu_daten) und schickt bei
// jedem Speichern alles. Der Browser schickt nur, was sich geändert hat.
//
// ── WER DARF? ─────────────────────────────────────────────────────────────
// Angelegt wird erst nach dem Kontakt-Schritt (vorher ist es kein Antrag,
// sondern ein Besucher — Abbrecherlisten und Rückholung sollen ihn nicht
// sehen). Jeder weitere Aufruf braucht das Antrags-Cookie dieses Browsers
// (lib/fiaon-antrag-sitzung.ts); die Referenz allein reicht nie.
//
// ── ZUSTAND UND SCHRITT ───────────────────────────────────────────────────
// Nur die Wörter, die es schon gibt (shared/fiaon-antrag-stand.ts):
//   Name … Anschrift → 1 personal_data · Beruf … Einträge → 2 finances ·
//   Prüfung → 4 verifying · Ergebnis, PIN, Paket, Limit → 5 approved ·
//   Vertrag, Unterschrift → 6 contract · Annahme → 8 submitted.
// Der Schritt geht nie zurück, wenn jemand „Angaben ändern" nutzt.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { createHash } from "crypto";
import { promises as dns } from "dns";
import { sqlPool } from "../lib/db-pool";
import { antragAusCookie, antragCookieLoeschen, antragCookieSetzen, antragPasst, requireKundeOderAntrag } from "../lib/fiaon-antrag-sitzung";
import { requireKunde, type KundeRequest } from "../lib/fiaon-kunde-session";
import { istRoboterUnterschrift } from "../lib/fiaon-vertrieb-zusage";
import { pinErstmalsSetzen } from "../lib/fiaon-kunden-pin";
import { antragGeraet } from "../lib/fiaon-antrag-weiche";
import {
  ANTRAG_NEU_BERUF_SPALTE, ANTRAG_NEU_HAKEN_GEPRUEFT, ANTRAG_NEU_LEER, ANTRAG_NEU_LEISTUNG_FASSUNG,
  ANTRAG_NEU_SOFORT_TEXT, ANTRAG_NEU_VERTRAG_FASSUNG, ANTRAG_NEU_WOHNEN_SPALTE, BERUF_MIT_ARBEITGEBER,
  EINTRAG_TEXT, LANDNAME, OHNE_ABFRAGE, SEIT_TEXT, ZWECK_TEXT, agbDatum, antragNeuDatenSauber, antragNeuLuecke,
  antragNeuPaket, emailGueltig, geburtPruefen, geburtText, limitErlaubt, staatAnzeige, telefonZiffern,
  type AntragNeuDaten, type AntragNeuSchritt,
} from "@shared/fiaon-antrag-neu";
import { antragNeuVertragHtml } from "@shared/fiaon-antrag-neu-vertrag";
import { AGB_FASSUNG } from "@shared/fiaon-vertrag-paket";
import { paketPreisCents } from "@shared/fiaon-pakete";
import { paketNameFuerDaten } from "@shared/fiaon-paketname";
import { istAuslandsnummer } from "@shared/fiaon-dach-telefon";
import { KNOPF_ZAHLUNGSPFLICHTIG } from "../../client/src/components/antrag/bestelluebersicht-daten";

const router = Router();

const REF_MUSTER = /^FIAON-[A-Z0-9]{4,}-[A-Z0-9]{3,8}$/;

// ── Kleine Helfer ─────────────────────────────────────────────────────────
/**
 * Die Adresse des Menschen. Wie clientIp in fiaon-app-login.ts: req.ip (trust proxy 1) bzw. der LETZTE
 * X-Forwarded-For-Eintrag — den ersten schickt der Browser selbst mit, und eine frei gewählte Adresse wäre
 * weder eine Bremse noch ein Nachweis (sie steht in fiaon_vertragsannahmen und im PDF).
 */
function kundenIp(req: Request): string {
  if (req.ip) return String(req.ip).replace(/^::ffff:/, "");
  const weiter = String(req.headers["x-forwarded-for"] || "").split(",").map((x) => x.trim()).filter(Boolean);
  return weiter.length ? weiter[weiter.length - 1] : (req.socket?.remoteAddress || "");
}
function refAus(req: Request): string | null {
  const r = String(req.params.ref || "").trim().toUpperCase();
  return REF_MUSTER.test(r) ? r : null;
}
/** Dieselbe Geräte-Einteilung wie die Weiche und der Vergleich (handy/tablet/desktop). */
function geraetAus(ua: string): "handy" | "tablet" | "desktop" {
  return antragGeraet(ua);
}
function istBot(ua: string): boolean {
  return /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|curl\/|python-requests|node-fetch|axios\//i.test(ua);
}

/** Eine einfache Bremse je Schlüssel (Speicher). Reicht gegen Durchprobieren und Fluten. */
function bremse(name: string, max: number, fensterMs: number) {
  const zaehler = new Map<string, { n: number; bis: number }>();
  return (schluesselRoh: string): boolean => {
    const jetzt = Date.now();
    const schluessel = String(schluesselRoh).slice(0, 64);
    if (zaehler.size > 5000) {
      zaehler.forEach((v, k) => { if (v.bis < jetzt) zaehler.delete(k); });
      // Harte Obergrenze: Die Map hält die Einfügereihenfolge — die ältesten Einträge gehen zuerst.
      if (zaehler.size > 5000) for (const k of Array.from(zaehler.keys()).slice(0, zaehler.size - 4000)) zaehler.delete(k);
    }
    const z = zaehler.get(schluessel);
    if (!z || z.bis < jetzt) { zaehler.set(schluessel, { n: 1, bis: jetzt + fensterMs }); return true; }
    z.n++;
    if (z.n > max) { if (z.n === max + 1) console.warn(`[ANTRAG-NEU] Bremse ${name} greift für ${schluessel.slice(0, 60)}`); return false; }
    return true;
  };
}
const bremseEreignis = bremse("ereignis", 600, 10 * 60_000);
const bremseAnlegen = bremse("anlegen", 12, 60 * 60_000);
const bremseSpeichern = bremse("speichern", 240, 10 * 60_000);
const bremsePin = bremse("pin", 10, 10 * 60_000);
const bremsePruefen = bremse("pruefen", 12, 10 * 60_000);

/**
 * Der lokale Prüfstand (127.0.0.1, eigene Datenbank) darf eine Annahme aus dem
 * eigenen Browser erzeugen — sonst ließe sich der Weg dort nie zu Ende gehen.
 * NUR wenn der Schalter gesetzt ist UND die Datenbank auf derselben Maschine
 * liegt; gegen die echte Datenbank ist das ausgeschlossen.
 */
function pruefstandErlaubt(): boolean {
  if (process.env.PRUEFSTAND_ROBOTER_ERLAUBT !== "1") return false;
  try {
    const host = new URL(String(process.env.DATABASE_URL || "")).hostname;
    return host === "127.0.0.1" || host === "localhost" || host === "::1";
  } catch { return false; }
}

/** Ein interner Aufruf einer bestehenden Route — mit IP, Browser und Cookies des Menschen. */
async function intern(req: Request, pfad: string, body: unknown): Promise<{ status: number; json: any }> {
  const port = process.env.PORT || 5000;
  const ab = new AbortController();
  const t = setTimeout(() => ab.abort(), 30_000);
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/fiaon${pfad}`, {
      method: "POST",
      signal: ab.signal,
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": kundenIp(req),
        "user-agent": String(req.headers["user-agent"] ?? ""),
        // Das Empfehlungs-Cookie (fiaon_e) liest /application beim Anlegen.
        ...(req.headers.cookie ? { cookie: String(req.headers.cookie) } : {}),
      },
      body: JSON.stringify(body),
    });
    return { status: r.status, json: await r.json().catch(() => null) };
  } finally {
    clearTimeout(t);
  }
}

// ── Zustand je Bildschirm ────────────────────────────────────────────────
const STAND: Record<AntragNeuSchritt, { schritt: number; status: string }> = {
  name: { schritt: 1, status: "personal_data" }, kontakt: { schritt: 1, status: "personal_data" },
  geburt: { schritt: 1, status: "personal_data" }, adresse: { schritt: 1, status: "personal_data" },
  beruf: { schritt: 2, status: "finances" }, einkommen: { schritt: 2, status: "finances" }, eintraege: { schritt: 2, status: "finances" },
  pruefung: { schritt: 4, status: "verifying" },
  ergebnis: { schritt: 5, status: "approved" }, pin: { schritt: 5, status: "approved" },
  paket: { schritt: 5, status: "approved" }, limit: { schritt: 5, status: "approved" },
  vertrag: { schritt: 6, status: "contract" }, unterschrift: { schritt: 6, status: "contract" },
  zahlung: { schritt: 8, status: "submitted" }, danke: { schritt: 8, status: "submitted" },
};
const STATUS_JE_SCHRITT: Record<number, string> = { 1: "personal_data", 2: "finances", 4: "verifying", 5: "approved", 6: "contract", 8: "submitted" };

/** Der weitere Stand: nie zurück (außer es gab noch keinen). Nie 8 ohne Annahme. */
function standFuer(bisher: { current_step: number | null }, ziel: AntragNeuSchritt): { schritt: number; status: string } {
  const neu = STAND[ziel] ?? STAND.name;
  const alt = Math.min(6, Number(bisher.current_step) || 0);
  const s = Math.min(6, Math.max(alt, neu.schritt));
  return { schritt: s, status: STATUS_JE_SCHRITT[s] ?? neu.status };
}

/**
 * Der vollständige Rumpf für POST /application — aus den gespeicherten Angaben.
 * Felder, die der neue Weg nicht fragt, gehen leer mit (wie im alten Weg die
 * Vorgaben: Vollzahlung, keine Zusatzleistung, Überweisung).
 */
function antragKoerper(ref: string, d: AntragNeuDaten, stand: { schritt: number; status: string }, extra: Record<string, unknown> = {}) {
  const P = antragNeuPaket(d.paket);
  const mitArbeitgeber = d.beruf && BERUF_MIT_ARBEITGEBER.includes(d.beruf);
  // Paket und Limit hat der Kunde erst ab dem Vertrag gewählt — vorher steht dort nichts (kein „genehmigt"-Wert in der Akte).
  const gewaehlt = stand.schritt >= 6;
  return {
    ref, type: "private", status: stand.status, currentStep: stand.schritt,
    packKey: d.paket, packName: paketNameFuerDaten(d.paket) ?? P?.name ?? null,
    firstName: d.vorname, lastName: d.nachname,
    birthDay: d.gt || null, birthMonth: d.gm || null, birthYear: d.gj.length === 4 ? d.gj : null,
    phone: telefonZiffern(d.telefon) || null, phoneCountryCode: d.vorwahl,
    street: [d.strasse, d.nr].filter(Boolean).join(" ") || null, zip: d.plz || null, city: d.ort || null, country: d.land,
    nationality: staatAnzeige(d) || null,
    employment: d.beruf ? ANTRAG_NEU_BERUF_SPALTE[d.beruf] : null,
    employer: d.beruf === "selbst" ? (d.branche ? `Branche: ${d.branche}` : null) : mitArbeitgeber ? (d.arbeitgeber || null) : null,
    employedSince: d.seit && (mitArbeitgeber || d.beruf === "selbst") ? SEIT_TEXT[d.seit] : null,
    income: Number(d.einkommen) || null, rent: null, debts: null,
    housing: d.wohnen ? ANTRAG_NEU_WOHNEN_SPALTE[d.wohnen] : null,
    wantedLimit: gewaehlt ? d.limit : null, approvedLimit: gewaehlt ? d.limit : null,
    purpose: d.zweck.map((z) => ZWECK_TEXT[z]).join(", ") || null,
    billing: "Vollzahlung (100%)", addon: "Keine", nfc: "Ja",
    email: d.email || null, iban: null, billingMethod: "iban", salaryReceiptDay: null,
    ag1: false, ag2: false, ag3: false,
    // Die Willkommensmail nennt „Ihr Paket" — im neuen Weg wählt der Kunde es erst nach der
    // Prüfung. Bis dahin hält /application sie zurück (/speichern gibt sie ab „paket" frei).
    willkommenZurueckhalten: stand.schritt < 6,
    ...extra,
  };
}

type Zeile = {
  ref: string; person_id: number | null; status: string | null; current_step: number | null;
  antrag_neu_daten: any; antrag_neu_pruefung: any; antrag_neu_geprueft_am: Date | null;
  kunden_pin_hash: string | null; payment_reference: string | null; payment_status: string | null;
  antrag_weg: string | null; created_at: Date;
};
async function zeileLaden(ref: string): Promise<Zeile | null> {
  const [z] = (await sqlPool`
    SELECT ref, person_id, status, current_step, antrag_neu_daten, antrag_neu_pruefung, antrag_neu_geprueft_am,
           kunden_pin_hash, payment_reference, payment_status, antrag_weg, created_at
      FROM fiaon_applications
     WHERE ref = ${ref} AND merged_into IS NULL AND gdpr_deleted_at IS NULL
     LIMIT 1`) as any[];
  return z ?? null;
}
function datenAus(z: Zeile): { d: AntragNeuDaten; leadLink: string | null } {
  const roh = z.antrag_neu_daten && typeof z.antrag_neu_daten === "object" ? z.antrag_neu_daten : {};
  const leadLink = typeof roh.leadLink === "string" && /^[A-Za-z0-9]{10}$/.test(roh.leadLink) ? roh.leadLink : null;
  return { d: antragNeuDatenSauber(roh, ANTRAG_NEU_LEER), leadLink };
}
async function annahmeLaden(ref: string): Promise<{ angenommen_am: Date; sofort_beginn: boolean } | null> {
  const [a] = (await sqlPool`SELECT angenommen_am, sofort_beginn FROM fiaon_vertragsannahmen WHERE ref = ${ref} LIMIT 1`) as any[];
  return a ?? null;
}

/** Ereignis in die Messung — vom Server, damit Meilensteine nie mit dem Browser verloren gehen. */
function meilenstein(req: Request, ref: string, ereignis: string, schritt: string | null, detail: string | null = null): void {
  const sitzung = String((req.body && req.body.sitzung) || "").replace(/[^a-z0-9]/gi, "").slice(0, 40) || `srv${ref.slice(-8)}`;
  const ua = String(req.headers["user-agent"] ?? "");
  sqlPool`
    INSERT INTO fiaon_antrag_ereignisse (weg, sitzung, ref, schritt, ereignis, detail, geraet)
    VALUES ('neu', ${sitzung}, ${ref}, ${schritt}, ${ereignis}, ${detail}, ${geraetAus(ua)})`
    .catch((e) => console.error(`[ANTRAG-NEU] Messung „${ereignis}" für ${ref} nicht geschrieben:`, e));
}

async function speichernIntern(req: Request, ref: string, d: AntragNeuDaten, leadLink: string | null,
  stand: { schritt: number; status: string }, extra: Record<string, unknown> = {}): Promise<{ ok: boolean; status: number; fehler?: string }> {
  const r = await intern(req, "/application", { ...antragKoerper(ref, d, stand, extra), ...(leadLink ? { leadLink } : {}) });
  if (r.status >= 300 || !r.json?.ok) {
    console.error(`[ANTRAG-NEU] /application für ${ref} (Schritt ${stand.schritt}) nicht gespeichert: HTTP ${r.status}`, r.json?.code ?? r.json?.error ?? "");
    return { ok: false, status: r.status, fehler: r.json?.code === "NUR_DACH" ? r.json?.error : undefined };
  }
  await sqlPool`
    UPDATE fiaon_applications
       SET antrag_weg = 'neu', antrag_neu_daten = ${sqlPool.json({ ...d, ...(leadLink ? { leadLink } : {}) } as any)}
     WHERE ref = ${ref}`;
  return { ok: true, status: 200 };
}

/** Ereignisse, die nur der Server schreibt (die Statistik zählt sie als Tatsachen). */
const SERVER_EREIGNISSE = new Set(["angelegt", "geprueft", "doppelt", "pin_gesetzt", "angenommen", "auskunft_gewaehlt"]);

// ═══════════════════════════════════════════════════════════════════════════
// POST /antrag-neu/ereignis — die Messung beider Wege (gebündelt, ohne Inhalte)
// ═══════════════════════════════════════════════════════════════════════════
router.post("/antrag-neu/ereignis", async (req: Request, res: Response) => {
  try {
    const ua = String(req.headers["user-agent"] ?? "");
    if (istBot(ua)) return res.json({ ok: true });
    if (!bremseEreignis(kundenIp(req))) return res.status(429).json({ ok: false });
    const b = req.body || {};
    const weg = b.weg === "alt" ? "alt" : b.weg === "neu" ? "neu" : null;
    const sitzung = String(b.sitzung || "");
    if (!weg || !/^[a-z0-9]{8,40}$/i.test(sitzung) || !Array.isArray(b.liste)) return res.status(400).json({ ok: false });
    const geraet = geraetAus(ua);
    const nur = (v: unknown, muster: RegExp, max: number) => { const s = String(v ?? "").slice(0, max); return s && muster.test(s) ? s : null; };
    let n = 0;
    for (const e of b.liste.slice(0, 60)) {
      const ereignis = nur(e?.ereignis, /^[a-z_]{2,40}$/, 40);
      // Zuteilungen (beide Wege) und die Meilensteine des neuen Wegs schreibt nur der Server —
      // aus dem Browser zählen sie nicht. Der alte Weg meldet seine Meilensteine selbst (antrag.tsx).
      if (!ereignis || ereignis === "weiche" || (weg === "neu" && SERVER_EREIGNISSE.has(ereignis))) continue;
      const schritt = nur(e?.schritt, /^[a-z0-9_]{1,40}$/i, 40);
      // Detail: nur Feldnamen, Paketschlüssel, Beträge — keine freien Texte mit Leerzeichen-Sätzen.
      const detail = nur(e?.detail, /^[a-z0-9_.:+\-]{1,80}$/i, 80);
      const refRoh = String(e?.ref ?? "").trim().toUpperCase();
      const ref = REF_MUSTER.test(refRoh) && antragPasst(req, refRoh) ? refRoh : null;
      await sqlPool`
        INSERT INTO fiaon_antrag_ereignisse (weg, sitzung, ref, schritt, ereignis, detail, geraet)
        VALUES (${weg}, ${sitzung}, ${ref}, ${schritt}, ${ereignis}, ${detail}, ${geraet})`;
      n++;
    }
    res.json({ ok: true, n });
  } catch (err) {
    console.error("[ANTRAG-NEU] ereignis:", err);
    res.json({ ok: false });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /antrag-neu/anlegen — nach dem Kontakt-Schritt: aus dem Besucher wird ein Antrag
// ═══════════════════════════════════════════════════════════════════════════
router.post("/antrag-neu/anlegen", async (req: Request, res: Response) => {
  try {
    if (!bremseAnlegen(kundenIp(req))) return res.status(429).json({ ok: false, error: "Zu viele Versuche. Bitte warten Sie einen Moment." });
    const d = antragNeuDatenSauber(req.body?.daten);
    if (!d.anrede || !d.vorname || !d.nachname) return res.status(400).json({ ok: false, schritt: "name", error: "Bitte tragen Sie Ihren Namen ein." });
    if (!emailGueltig(d.email)) return res.status(400).json({ ok: false, schritt: "kontakt", feld: "email", error: "Bitte prüfen Sie Ihre E-Mail-Adresse." });
    if (telefonZiffern(d.telefon).length < 8) return res.status(400).json({ ok: false, schritt: "kontakt", feld: "telefon", error: "Bitte prüfen Sie Ihre Mobilnummer." });
    if (istAuslandsnummer(d.vorwahl, d.telefon)) return res.status(400).json({ ok: false, schritt: "kontakt", feld: "telefon", error: "Anträge nehmen wir derzeit nur mit einer Nummer aus Deutschland, Österreich oder der Schweiz an." });
    const leadLink = typeof req.body?.leadLink === "string" && /^[A-Za-z0-9]{10}$/.test(req.body.leadLink) ? req.body.leadLink : null;

    const zufall = Array.from({ length: 4 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 31)]).join("");
    const ref = `FIAON-${Date.now().toString(36).toUpperCase()}-${zufall}`;
    const r = await intern(req, "/application", {
      ...antragKoerper(ref, d, STAND.kontakt),
      ...(leadLink ? { leadLink } : {}),
      ...(req.body?.messung && typeof req.body.messung === "object" ? { messung: req.body.messung } : {}),
    });
    if (r.status >= 300 || !r.json?.ok) {
      console.error(`[ANTRAG-NEU] anlegen ${ref}: /application HTTP ${r.status}`, r.json?.code ?? r.json?.error ?? "");
      if (r.json?.code === "NUR_DACH") return res.status(400).json({ ok: false, schritt: "kontakt", feld: "telefon", error: r.json.error });
      return res.status(502).json({ ok: false, error: "Ihr Antrag konnte gerade nicht gespeichert werden. Bitte versuchen Sie es gleich noch einmal." });
    }
    await sqlPool`
      UPDATE fiaon_applications
         SET antrag_weg = 'neu', antrag_neu_daten = ${sqlPool.json({ ...d, ...(leadLink ? { leadLink } : {}) } as any)}
       WHERE ref = ${ref}`;
    antragCookieSetzen(res, ref);
    meilenstein(req, ref, "angelegt", "kontakt");
    console.log(`[ANTRAG-NEU] ${ref} angelegt (${geraetAus(String(req.headers["user-agent"] ?? ""))}).`);
    res.json({ ok: true, ref });
  } catch (err) {
    console.error("[ANTRAG-NEU] anlegen:", err);
    res.status(500).json({ ok: false, error: "Ihr Antrag konnte gerade nicht gespeichert werden. Bitte versuchen Sie es gleich noch einmal." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /antrag-neu/:ref/stand — Wiederaufnahme (neuer Tab, Seite neu geladen)
// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// GET /antrag-neu/aus-cookie — Wiedereinstieg ohne Speicher im Browser
// (Link aus der Erinnerungsmail, anderes Gerät, gelöschter Speicher). Das Antrags-
// Cookie ist der Nachweis; zurück kommt nur die Referenz, die Angaben holt /stand.
// POST /antrag-neu/vergessen — „Nicht Sie? Neu beginnen": Cookie weg.
// ═══════════════════════════════════════════════════════════════════════════
router.get("/antrag-neu/aus-cookie", async (req: Request, res: Response) => {
  try {
    const ref = antragAusCookie(req);
    if (!ref) return res.json({ ok: true, ref: null });
    const z = await zeileLaden(ref);
    res.json({ ok: true, ref: z && z.antrag_weg === "neu" ? z.ref : null });
  } catch (err) {
    console.error("[ANTRAG-NEU] aus-cookie:", err);
    res.json({ ok: true, ref: null });
  }
});

router.post("/antrag-neu/vergessen", (_req: Request, res: Response) => {
  antragCookieLoeschen(res);
  res.json({ ok: true });
});

router.get("/antrag-neu/:ref/stand", async (req: Request, res: Response) => {
  try {
    const ref = refAus(req);
    if (!ref) return res.status(400).json({ ok: false });
    if (!antragPasst(req, ref)) return res.status(403).json({ ok: false, error: "abgelaufen" });
    let z = await zeileLaden(ref);
    if (!z || z.antrag_weg !== "neu") return res.status(404).json({ ok: false });
    const annahme = await annahmeLaden(ref);
    // Halbe Annahme (Bestellung fehlt): beim Neuladen der Zahlungsseite nachholen.
    if (annahme && !["pending_payment", "claimed_paid", "paid"].includes(String(z.payment_status ?? ""))) {
      await annahmeNachholen(req, ref, annahme).catch((e) => console.error(`[ANTRAG-NEU] ${ref}: Nachholen:`, e));
      z = (await zeileLaden(ref)) ?? z;
    }
    const { d } = datenAus(z);
    res.json({
      ok: true, ref, daten: d,
      geprueftAm: z.antrag_neu_geprueft_am, pruefung: z.antrag_neu_pruefung ?? null,
      pinGesetzt: !!z.kunden_pin_hash,
      angenommenAm: annahme?.angenommen_am ?? null, sofortBeginn: annahme?.sofort_beginn ?? null,
      paymentReference: annahme ? z.payment_reference : null, zahlungsstatus: annahme ? z.payment_status : null,
    });
  } catch (err) {
    console.error("[ANTRAG-NEU] stand:", err);
    res.status(500).json({ ok: false });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /antrag-neu/:ref/speichern — Zwischenstand je Bildschirm
// ═══════════════════════════════════════════════════════════════════════════
router.post("/antrag-neu/:ref/speichern", async (req: Request, res: Response) => {
  try {
    const ref = refAus(req);
    if (!ref) return res.status(400).json({ ok: false });
    if (!antragPasst(req, ref)) return res.status(403).json({ ok: false, error: "Ihre Sitzung ist abgelaufen. Bitte laden Sie die Seite neu.", abgelaufen: true });
    if (!bremseSpeichern(ref)) return res.status(429).json({ ok: false });
    const z = await zeileLaden(ref);
    if (!z || z.antrag_weg !== "neu") return res.status(404).json({ ok: false });
    if (await annahmeLaden(ref)) return res.status(409).json({ ok: false, angenommen: true, error: "Ihr Vertrag ist bereits geschlossen." });
    const { d: bisher, leadLink } = datenAus(z);
    const d = antragNeuDatenSauber(req.body?.daten, bisher);
    const ziel = String(req.body?.schritt || "") as AntragNeuSchritt;
    // Speichern ab „Vertrag" nur mit geprüftem Antrag — sonst bliebe die Prüfung übersprungen.
    const zielFrei = STAND[ziel] && (STAND[ziel].schritt < 5 || !!z.antrag_neu_geprueft_am) && STAND[ziel].schritt < 8 ? ziel : "name";
    const paketGewaehlt = (["paket", "limit", "vertrag", "unterschrift"] as string[]).includes(zielFrei);
    const erg = await speichernIntern(req, ref, d, leadLink, standFuer(z, zielFrei), paketGewaehlt ? { willkommenZurueckhalten: false } : {});
    if (!erg.ok) return res.status(erg.fehler ? 400 : 502).json({ ok: false, error: erg.fehler || "Ihre Angaben konnten gerade nicht gespeichert werden." });
    res.json({ ok: true });
  } catch (err) {
    console.error("[ANTRAG-NEU] speichern:", err);
    res.status(500).json({ ok: false, error: "Ihre Angaben konnten gerade nicht gespeichert werden." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /antrag-neu/:ref/pruefen — die Prüfung: nur, was wirklich geprüft wird
//
// Keine Auskunftei-Abfrage (AGB § 9). Geprüft werden: Vollständigkeit und
// Volljährigkeit, die Anschrift gegen das Adressverzeichnis, die Mobilnummer
// (DE/AT/CH), ob die E-Mail-Domain Post empfangen kann (MX), ob schon ein
// laufender Vertrag besteht. Jede Zeile, die der Kunde sieht, stammt von hier.
// ═══════════════════════════════════════════════════════════════════════════
async function mailDomain(domain: string): Promise<"mx" | "a" | "keine" | "unklar"> {
  const zeitlich = <T,>(p: Promise<T>) => Promise.race([p, new Promise<never>((_, nein) => setTimeout(() => nein(Object.assign(new Error("Zeit"), { code: "ETIMEOUT" })), 2500))]);
  const endgueltig = (e: any) => ["ENOTFOUND", "ENODATA", "NXDOMAIN"].includes(String(e?.code));
  try {
    const mx = await zeitlich(dns.resolveMx(domain));
    if (mx.some((m) => m.exchange && m.exchange !== ".")) return "mx";
  } catch (e) { if (!endgueltig(e)) return "unklar"; }
  try {
    const a = await zeitlich(dns.resolve4(domain));
    if (a.length) return "a";
  } catch (e) { if (!endgueltig(e)) return "unklar"; }
  return "keine";
}

async function anschriftImVerzeichnis(req: Request, d: AntragNeuDaten): Promise<"ja" | "nein" | "unklar"> {
  try {
    const port = process.env.PORT || 5000;
    const q = `${d.strasse} ${d.nr}, ${d.plz} ${d.ort}`;
    const ab = new AbortController(); const t = setTimeout(() => ab.abort(), 4000);
    const r = await fetch(`http://127.0.0.1:${port}/api/fiaon/adresse?q=${encodeURIComponent(q)}&land=${d.land}`, { signal: ab.signal, headers: { "user-agent": String(req.headers["user-agent"] ?? "") } })
      .finally(() => clearTimeout(t));
    const j: any = await r.json().catch(() => null);
    const liste: any[] = Array.isArray(j?.vorschlaege) ? j.vorschlaege : [];
    if (!r.ok) return "unklar";
    const norm = (s: string) => s.toLowerCase().replace(/str\.?(\s|$)/g, "straße$1").replace(/[^a-z0-9äöüß]/g, "");
    const strasseN = norm(d.strasse);
    return liste.some((v) => String(v.plz) === d.plz && norm(String(v.strasse)).startsWith(strasseN.slice(0, Math.max(4, strasseN.length - 2)))) ? "ja" : liste.length ? "nein" : "unklar";
  } catch { return "unklar"; }
}

router.post("/antrag-neu/:ref/pruefen", async (req: Request, res: Response) => {
  try {
    const ref = refAus(req);
    if (!ref) return res.status(400).json({ ok: false });
    if (!antragPasst(req, ref)) return res.status(403).json({ ok: false, abgelaufen: true, error: "Ihre Sitzung ist abgelaufen. Bitte laden Sie die Seite neu." });
    if (!bremsePruefen(ref)) return res.status(429).json({ ok: false, error: "Bitte einen Moment Geduld." });
    const z = await zeileLaden(ref);
    if (!z || z.antrag_weg !== "neu") return res.status(404).json({ ok: false });
    if (await annahmeLaden(ref)) return res.status(409).json({ ok: false, angenommen: true });
    const { d: bisher, leadLink } = datenAus(z);
    const d = antragNeuDatenSauber(req.body?.daten, bisher);

    // 1. Vollständig? (Zweck und Limit kommen erst danach.)
    const luecke = antragNeuLuecke(d);
    if (luecke && luecke !== "limit") {
      return res.status(409).json({ ok: false, zurueck: { schritt: luecke, meldung: "Bitte ergänzen Sie hier noch Ihre Angaben." } });
    }
    const alter = geburtPruefen(d);
    if (alter !== "ok") return res.status(409).json({ ok: false, zurueck: { schritt: "geburt", meldung: alter === "jung" ? "Den Vertrag können Sie ab 18 Jahren schließen." : "Bitte prüfen Sie Ihr Geburtsdatum." } });
    if (istAuslandsnummer(d.vorwahl, d.telefon)) return res.status(409).json({ ok: false, zurueck: { schritt: "kontakt", feld: "telefon", meldung: "Anträge nehmen wir derzeit nur mit einer Nummer aus Deutschland, Österreich oder der Schweiz an." } });

    // 2. E-Mail, Anschrift, laufender Vertrag — parallel.
    const domain = d.email.split("@")[1] || "";
    const [mail, anschrift, laufend] = await Promise.all([
      mailDomain(domain),
      d.adresseQuelle === "vorschlag" || d.adresseQuelle === "hand" ? anschriftImVerzeichnis(req, d) : Promise.resolve<"unklar">("unklar"),
      z.person_id ? import("../lib/fiaon-auskunft").then((m) => m.hatLaufendesPaket(Number(z.person_id))).catch(() => false) : Promise.resolve(false),
    ]);
    if (mail === "keine") {
      return res.status(409).json({ ok: false, zurueck: { schritt: "kontakt", feld: "email", meldung: `An die Adresse ${d.email} kann keine E-Mail zugestellt werden – die Endung „${domain}“ gibt es so nicht. Bitte prüfen Sie die Schreibweise.` } });
    }
    const landWort = LANDNAME[d.vorwahl === "+43" ? "AT" : d.vorwahl === "+41" ? "CH" : "DE"];
    const anschriftText = `${d.strasse} ${d.nr}, ${d.plz} ${d.ort}`;
    const punkte = [
      { id: "angaben", titel: "Angaben", text: "Name, Geburtsdatum und Kontakt vollständig · volljährig", ok: true },
      { id: "anschrift", titel: "Anschrift", text: (anschrift === "ja" ? "Anschrift im Verzeichnis gefunden · " : "Anschrift vollständig erfasst · ") + anschriftText, ok: true },
      { id: "telefon", titel: "Telefon", text: `Mobilnummer passt zu ${landWort}`, ok: true },
      { id: "email", titel: "E-Mail", text: mail === "unklar" ? `E-Mail-Adresse richtig geschrieben · ${domain}` : `E-Mail-Adresse kann Post empfangen · ${domain}`, ok: true },
      { id: "einkommen", titel: "Einkommen", text: "Einkommen und Wohnsituation erfasst", ok: true },
      { id: "ausgangslage", titel: "Ausgangslage", text: "Ihre Ausgangslage erfasst", ok: true },
      { id: "doppelt", titel: "Kein Doppelvertrag", text: laufend ? "Auf Ihren Namen läuft bereits ein FIAON-Vertrag" : "Kein laufender Vertrag auf Ihren Namen", ok: !laufend },
      { id: "profil", titel: "Profil", text: `Ihr FIAON-Profil erstellt – ${OHNE_ABFRAGE[d.land]}, ohne Einfluss auf Ihren Score`, ok: !laufend },
    ];
    const pruefung = { punkte, mail, anschrift, doppelt: !!laufend, am: new Date().toISOString() };
    const stand = laufend ? standFuer(z, "pruefung") : standFuer(z, "ergebnis");
    const erg = await speichernIntern(req, ref, d, leadLink, stand);
    if (!erg.ok) return res.status(502).json({ ok: false, error: "Die Prüfung konnte gerade nicht abgeschlossen werden. Bitte versuchen Sie es gleich noch einmal." });
    await sqlPool`
      UPDATE fiaon_applications
         SET antrag_neu_pruefung = ${sqlPool.json(pruefung as any)},
             antrag_neu_geprueft_am = ${laufend ? null : new Date()}
       WHERE ref = ${ref}`;
    if (laufend) {
      await sqlPool`
        INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
        VALUES (${ref}, ${z.person_id}, NULL, 'System', 'system',
                ${"Neuer Antragsweg: Antrag bei der Prüfung angehalten — auf diesen Menschen läuft bereits ein bezahltes Paket. Der Kunde wurde in seinen Kundenbereich geschickt (Paketwechsel dort)."})`
        .catch((e) => console.error("[ANTRAG-NEU] Vermerk Doppelvertrag:", e));
    }
    meilenstein(req, ref, laufend ? "doppelt" : "geprueft", "pruefung", anschrift === "ja" ? "anschrift_ja" : null);
    res.json({ ok: true, punkte, doppelt: !!laufend, geprueftAm: new Date().toISOString() });
  } catch (err) {
    console.error("[ANTRAG-NEU] pruefen:", err);
    res.status(500).json({ ok: false, error: "Die Prüfung konnte gerade nicht abgeschlossen werden. Bitte versuchen Sie es gleich noch einmal." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /antrag-neu/:ref/pin — die persönliche FIAON-PIN (einmal; ändern im Bereich)
// ═══════════════════════════════════════════════════════════════════════════
router.post("/antrag-neu/:ref/pin", async (req: Request, res: Response) => {
  try {
    const ref = refAus(req);
    if (!ref) return res.status(400).json({ ok: false });
    if (!antragPasst(req, ref)) return res.status(403).json({ ok: false, abgelaufen: true, error: "Ihre Sitzung ist abgelaufen. Bitte laden Sie die Seite neu." });
    if (!bremsePin(ref)) return res.status(429).json({ ok: false, error: "Zu viele Versuche. Bitte warten Sie einen Moment." });
    const z = await zeileLaden(ref);
    if (!z || z.antrag_weg !== "neu") return res.status(404).json({ ok: false });
    if (!z.antrag_neu_geprueft_am) return res.status(409).json({ ok: false, error: "Bitte lassen Sie zuerst Ihren Antrag prüfen." });
    const pin = String(req.body?.pin ?? "");
    const erg = await pinErstmalsSetzen(ref, pin);
    if (!erg.ok) {
      if (erg.code === "SCHON_GESETZT") return res.json({ ok: true, schon: true });
      return res.status(erg.status).json({ ok: false, code: erg.code, error: erg.meldung });
    }
    meilenstein(req, ref, "pin_gesetzt", "pin");
    res.json({ ok: true });
  } catch (err) {
    console.error("[ANTRAG-NEU] pin:", err);
    res.status(500).json({ ok: false, error: "Ihre PIN konnte gerade nicht gespeichert werden. Bitte versuchen Sie es noch einmal." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /antrag-neu/:ref/vertrag — der Vertragstext, wie er gilt
// (vor der Annahme aus den aktuellen Angaben; danach der gespeicherte Text)
// ═══════════════════════════════════════════════════════════════════════════
function vertragDaten(ref: string, d: AntragNeuDaten, sofort: boolean, am: Date | null) {
  return {
    ref, anrede: d.anrede === "keine" ? "" : d.anrede, vorname: d.vorname, nachname: d.nachname, geburt: geburtText(d),
    strasse: d.strasse, nr: d.nr, plz: d.plz, ort: d.ort, land: d.land, email: d.email,
    paketKey: d.paket, limit: d.limit, sofortBeginn: sofort, angenommenAm: am,
  };
}
router.get("/antrag-neu/:ref/vertrag", async (req: Request, res: Response) => {
  try {
    const ref = refAus(req);
    if (!ref) return res.status(400).json({ ok: false });
    if (!antragPasst(req, ref)) return res.status(403).json({ ok: false, abgelaufen: true });
    const [a] = (await sqlPool`SELECT vertrag_html, vertrag_sha256 FROM fiaon_vertragsannahmen WHERE ref = ${ref} LIMIT 1`) as any[];
    if (a) return res.json({ ok: true, html: a.vertrag_html, angenommen: true, pruefsumme: a.vertrag_sha256 });
    const z = await zeileLaden(ref);
    if (!z || z.antrag_weg !== "neu") return res.status(404).json({ ok: false });
    const { d } = datenAus(z);
    const sofort = String(req.query.sofort || "") === "1";
    res.json({ ok: true, html: antragNeuVertragHtml(vertragDaten(ref, d, sofort, null)), angenommen: false });
  } catch (err) {
    console.error("[ANTRAG-NEU] vertrag:", err);
    res.status(500).json({ ok: false, error: "Der Vertrag konnte gerade nicht geladen werden." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /antrag-neu/:ref/annehmen — „Zahlungspflichtig annehmen"
//
// Was gilt, wird gespeichert, bevor irgendetwas anderes passiert: Vertragstext
// (mit Zeitpunkt), Prüfsumme, Unterschrift, die Haken im Wortlaut, Knopftext,
// Gerät. Erst danach Antragszeile (Schritt 8), Bestellung, Bestätigungsmail.
// Ein Roboter kann nicht annehmen (lib/fiaon-vertrieb-zusage.ts).
// ═══════════════════════════════════════════════════════════════════════════
const PNG_KOPF = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

async function zahlungsAntwort(ref: string, annahme: { angenommen_am: Date; sofort_beginn: boolean }) {
  const [z] = (await sqlPool`SELECT payment_reference, payment_status, amount_due, payment_due_date FROM fiaon_applications WHERE ref = ${ref} LIMIT 1`) as any[];
  return {
    ok: true, ref, angenommenAm: annahme.angenommen_am, sofortBeginn: annahme.sofort_beginn,
    paymentReference: z?.payment_reference ?? null, zahlungsstatus: z?.payment_status ?? null,
    betrag: z?.amount_due != null ? String(z.amount_due) : null,
    faellig: z?.payment_due_date ? new Date(z.payment_due_date).toISOString() : null,
  };
}

/**
 * Nach der gespeicherten Annahme: Antragszeile auf „abgeschickt" (Schritt 8, AGB und
 * Vertrag angenommen) und die Bestellung zum unterschriebenen Vertrag. Wirft nie —
 * was scheitert, holt der nächste Aufruf über annahmeNachholen nach.
 */
async function annahmeAbschliessen(req: Request, ref: string, d: AntragNeuDaten, leadLink: string | null,
  extra: Record<string, unknown> = {}): Promise<{ status: number; body: Record<string, unknown> } | null> {
  try {
    const gespeichert = await speichernIntern(req, ref, d, leadLink, { schritt: 8, status: "submitted" }, { ag1: true, ag3: true, ...extra });
    if (!gespeichert.ok) console.error(`[ANTRAG-NEU] ${ref}: Annahme gespeichert, Antragszeile NICHT auf Schritt 8 — wird beim nächsten Aufruf nachgeholt.`);
  } catch (e) {
    console.error(`[ANTRAG-NEU] ${ref}: Antragszeile nach der Annahme nicht gespeichert:`, e);
  }
  try {
    const { bestellungFuerAntrag } = await import("./fiaon-antrag");
    // Immer die eigene Bestellung zum unterschriebenen Vertrag — nie in eine ältere gemischt.
    const b = await bestellungFuerAntrag(ref, { ohneVerknuepfung: true });
    if (b.status >= 300) console.error(`[ANTRAG-NEU] ${ref}: Bestellung HTTP ${b.status}`, b.body);
    return b;
  } catch (e) {
    console.error(`[ANTRAG-NEU] ${ref}: Bestellung nicht angelegt:`, e);
    return null;
  }
}

/**
 * HALBE ANNAHME NACHHOLEN: Die Annahme steht, aber Schritt 8 oder die Bestellung fehlt
 * (Abbruch zwischen den Schritten). Ruft der Kunde erneut an (Neuladen, zweiter Klick),
 * wird es ergänzt. Erst 60 s nach der Annahme — vorher läuft womöglich der erste Aufruf
 * noch, und zwei Bestellanlagen gleichzeitig ergäben zwei Verwendungszwecke.
 */
async function annahmeNachholen(req: Request, ref: string, annahme: { angenommen_am: Date }): Promise<void> {
  if (Date.now() - new Date(annahme.angenommen_am).getTime() < 60_000) return;
  const z = await zeileLaden(ref);
  if (!z || z.antrag_weg !== "neu") return;
  const fertig = Number(z.current_step ?? 0) >= 8 && String(z.status ?? "") === "submitted";
  const bestellt = ["pending_payment", "claimed_paid", "paid"].includes(String(z.payment_status ?? ""));
  if (fertig && bestellt) return;
  console.warn(`[ANTRAG-NEU] ${ref}: halbe Annahme (Schritt ${z.current_step}, ${z.payment_status ?? "keine Bestellung"}) — wird nachgeholt.`);
  const { d, leadLink } = datenAus(z);
  if (!fertig) {
    await annahmeAbschliessen(req, ref, d, leadLink);
    return;
  }
  try {
    const { bestellungFuerAntrag } = await import("./fiaon-antrag");
    await bestellungFuerAntrag(ref, { ohneVerknuepfung: true });
  } catch (e) {
    console.error(`[ANTRAG-NEU] ${ref}: Bestellung beim Nachholen nicht angelegt:`, e);
  }
}

router.post("/antrag-neu/:ref/annehmen", async (req: Request, res: Response) => {
  const ref = refAus(req);
  try {
    if (!ref) return res.status(400).json({ ok: false });
    if (!antragPasst(req, ref)) return res.status(403).json({ ok: false, abgelaufen: true, error: "Ihre Sitzung ist abgelaufen. Bitte laden Sie die Seite neu – Ihre Angaben sind gespeichert." });
    const ip = kundenIp(req);
    const ua = String(req.headers["user-agent"] ?? "");
    const roboter = istRoboterUnterschrift(ip, ua);
    const pruefstand = roboter.roboter && pruefstandErlaubt();
    if (roboter.roboter && !pruefstand) {
      console.warn(`[ANTRAG-NEU] Annahme ${ref} abgewiesen: ${roboter.grund}`);
      return res.status(403).json({ ok: false, error: "Die Annahme ist nur direkt im Browser möglich." });
    }
    const vorher = await annahmeLaden(ref);
    if (vorher) {
      await annahmeNachholen(req, ref, vorher).catch((e) => console.error(`[ANTRAG-NEU] ${ref}: Nachholen:`, e));
      return res.json(await zahlungsAntwort(ref, vorher));
    }

    const z = await zeileLaden(ref);
    if (!z || z.antrag_weg !== "neu") return res.status(404).json({ ok: false, error: "Diesen Antrag finden wir nicht." });
    const { d: bisher, leadLink } = datenAus(z);
    const d = antragNeuDatenSauber(req.body?.daten, bisher);
    if (!z.antrag_neu_geprueft_am) return res.status(409).json({ ok: false, zurueck: { schritt: "eintraege", meldung: "Bitte lassen Sie zuerst Ihren Antrag prüfen." } });
    if (!z.kunden_pin_hash) return res.status(409).json({ ok: false, zurueck: { schritt: "pin", meldung: "Bitte legen Sie noch Ihre persönliche PIN fest." } });
    const luecke = antragNeuLuecke(d);
    if (luecke) return res.status(409).json({ ok: false, zurueck: { schritt: luecke, meldung: "Bitte ergänzen Sie hier noch Ihre Angaben." } });
    if (!limitErlaubt(d.paket, d.limit)) return res.status(409).json({ ok: false, zurueck: { schritt: "limit", meldung: "Bitte wählen Sie Ihr Start-Limit." } });

    const h = req.body?.haken || {};
    if (h.agb !== true) return res.status(400).json({ ok: false, feld: "agb", error: "Bitte bestätigen Sie die AGB." });
    if (h.geprueft !== true) return res.status(400).json({ ok: false, feld: "geprueft", error: "Bitte bestätigen Sie, dass Sie die Bestellung geprüft haben." });
    const sofort = h.sofort === true;
    if (String(req.body?.knopf || "") !== KNOPF_ZAHLUNGSPFLICHTIG) return res.status(400).json({ ok: false, error: "Bitte nutzen Sie den Knopf „Zahlungspflichtig annehmen“." });

    // Die Unterschrift: ein PNG aus dem Browser, höchstens 400 KB.
    const u = req.body?.unterschrift || {};
    const m = String(u.png || "").match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
    const png = m ? Buffer.from(m[1], "base64") : null;
    if (!png || png.length < 200 || png.length > 400_000 || !png.subarray(0, 8).equals(PNG_KOPF)) {
      return res.status(400).json({ ok: false, feld: "unterschrift", error: "Bitte unterschreiben Sie noch einmal auf der Linie." });
    }
    const getippt = u.getippt === true;

    const am = new Date();
    const vertragHtml = antragNeuVertragHtml(vertragDaten(ref, d, sofort, am));
    const sha = createHash("sha256").update(vertragHtml, "utf8").digest("hex");
    const rate = paketPreisCents(d.paket);
    const agbText = `Ich akzeptiere die AGB (Fassung vom ${agbDatum(AGB_FASSUNG)}).`;
    const haken = [
      { id: "agb", text: agbText, gesetzt: true },
      { id: "geprueft", text: ANTRAG_NEU_HAKEN_GEPRUEFT, gesetzt: true },
      { id: "sofort", text: ANTRAG_NEU_SOFORT_TEXT, gesetzt: sofort },
    ];
    const neu = (await sqlPool`
      INSERT INTO fiaon_vertragsannahmen (ref, person_id, weg, angenommen_am, ip, user_agent, paket, rate_cents, gesamt_cents,
        ziel_limit, vertrag_fassung, leistung_fassung, agb_fassung, knopf_text, haken, sofort_beginn,
        unterschrift_png, unterschrift_getippt, vertrag_html, vertrag_sha256)
      VALUES (${ref}, ${z.person_id}, ${pruefstand ? "neu-pruefstand" : "neu"}, ${am}, ${ip.slice(0, 80)}, ${ua.slice(0, 500)},
        ${d.paket}, ${rate}, ${rate * 12}, ${d.limit}, ${ANTRAG_NEU_VERTRAG_FASSUNG}, ${ANTRAG_NEU_LEISTUNG_FASSUNG}, ${AGB_FASSUNG},
        ${KNOPF_ZAHLUNGSPFLICHTIG}, ${sqlPool.json(haken as any)}, ${sofort}, ${png}, ${getippt}, ${vertragHtml}, ${sha})
      ON CONFLICT (ref) DO NOTHING
      RETURNING angenommen_am, sofort_beginn`) as any[];
    if (!neu.length) {
      const doch = await annahmeLaden(ref);
      if (doch) return res.json(await zahlungsAntwort(ref, doch));
      return res.status(500).json({ ok: false, error: "Die Annahme konnte gerade nicht gespeichert werden." });
    }
    console.log(`[ANTRAG-NEU] ${ref} angenommen: ${d.paket}, Ziel ${d.limit} €, ${sofort ? "Sofortbeginn verlangt" : "Beginn nach Widerrufsfrist"}${pruefstand ? " (PRÜFSTAND)" : ""}.`);

    // Die Antragszeile: Schritt 8, abgeschickt, AGB und Vertrag angenommen (ag1/ag3 — wie der alte Knopf).
    // Dann die Bestellung (Verwendungszweck, Rechnung, Fälligkeit, Zahlungsmail) — wie im alten Weg,
    // aber immer zu DIESEM Vertrag.
    await annahmeAbschliessen(req, ref, d, leadLink,
      req.body?.messung && typeof req.body.messung === "object" ? { messung: req.body.messung } : {});

    // Für die Akte: was nur der neue Weg fragt — damit der Mitarbeiter es am Telefon vor sich hat.
    const notiz = [
      `Antrag über den neuen Weg angenommen (${d.paket.toUpperCase()}, Ziel-Limit ${d.limit.toLocaleString("de-DE")} €).`,
      `Einträge laut Kunde: ${d.eintraege ? EINTRAG_TEXT[d.eintraege] : "–"}. Nutzung: ${d.zweck.map((x) => ZWECK_TEXT[x]).join(", ") || "–"}.`,
      sofort
        ? "Beginn: Der Kunde hat den sofortigen Beginn verlangt — Leistungen gleich nach Zahlungseingang."
        : `Beginn: KEIN sofortiger Beginn verlangt — Leistungen (Gespräche, Schreiben) erst nach Ablauf der Widerrufsfrist, also ab dem ${new Date(am.getTime() + 15 * 864e5).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}. Der Kundenbereich ist ab Zahlungseingang offen.`,
      "Persönliche FIAON-PIN festgelegt — am Telefon über „PIN prüfen“ in der Akte abfragen.",
    ].join("\n");
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
      SELECT ${ref}, a.person_id, NULL, 'System', 'system', ${notiz} FROM fiaon_applications a WHERE a.ref = ${ref}`
      .catch((e) => console.error(`[ANTRAG-NEU] ${ref}: Akten-Vermerk nicht geschrieben:`, e));

    // Die Vertragsbestätigung mit PDF — im Hintergrund; ein Nachhol-Lauf fängt Fehler auf.
    import("../lib/fiaon-antrag-neu-bestaetigung")
      .then((mod: any) => mod.vertragBestaetigungSenden(ref))
      .catch((e) => console.error(`[ANTRAG-NEU] ${ref}: Vertragsbestätigung nicht angestoßen:`, e));

    meilenstein(req, ref, "angenommen", "unterschrift", d.paket);
    const antwort = await zahlungsAntwort(ref, { angenommen_am: am, sofort_beginn: sofort });
    res.json(antwort);
  } catch (err) {
    console.error(`[ANTRAG-NEU] annehmen ${ref ?? "?"}:`, err);
    res.status(500).json({ ok: false, error: "Die Annahme konnte gerade nicht gespeichert werden. Bitte versuchen Sie es gleich noch einmal." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /antrag-neu/:ref/auskunft — Bonitätsauskunft zum Kundenpreis dazubestellen
// (das bestehende Bündel: vermerkt jetzt, Bestellung erst nach der ersten Paketzahlung)
// ═══════════════════════════════════════════════════════════════════════════
router.post("/antrag-neu/:ref/auskunft", async (req: Request, res: Response) => {
  try {
    const ref = refAus(req);
    if (!ref) return res.status(400).json({ ok: false });
    if (!antragPasst(req, ref)) return res.status(403).json({ ok: false, abgelaufen: true, error: "Ihre Sitzung ist abgelaufen." });
    const z = await zeileLaden(ref);
    if (!z || z.antrag_weg !== "neu") return res.status(404).json({ ok: false });
    if (!(await annahmeLaden(ref))) return res.status(409).json({ ok: false, error: "Bitte nehmen Sie zuerst Ihren Vertrag an." });
    if (z.payment_status === "paid") return res.status(409).json({ ok: false, error: "Ihre erste Zahlung ist schon da – bestellen Sie die Auskunft bitte in Ihrem Kundenbereich." });
    const { d } = datenAus(z);
    const b = req.body || {};
    const jetzt = new Date().toISOString();
    const { buendelWunschVermerken } = await import("../lib/fiaon-auskunft");
    const { BUENDEL_FASSUNG, BUENDEL_SOFORT_TEXT } = await import("@shared/fiaon-auskunft-buendel");
    const v = await buendelWunschVermerken({
      ref, packKey: d.paket, ip: kundenIp(req), ua: String(req.headers["user-agent"] ?? ""),
      zusatz: {
        gewaehlt: b.gewaehlt === true, art: "privat", fassung: BUENDEL_FASSUNG,
        haken: String(b.haken ?? ""), auftrag: String(b.auftrag ?? ""), am: jetzt,
        sofort: b.sofort === true, sofortText: b.sofort === true ? BUENDEL_SOFORT_TEXT : "", sofortAm: b.sofort === true ? jetzt : null,
        anzeige: "offen", land: d.land,
      },
    });
    if (v === "vermerkt" || v === "schon") {
      meilenstein(req, ref, "auskunft_gewaehlt", "danke", "besorgen");
      return res.json({ ok: true, ergebnis: v });
    }
    console.warn(`[ANTRAG-NEU] ${ref}: Auskunft-Bündel nicht vermerkt (${v}).`);
    res.status(400).json({ ok: false, error: "Die Bestellung konnte nicht vermerkt werden. Bitte versuchen Sie es noch einmal." });
  } catch (err) {
    console.error("[ANTRAG-NEU] auskunft:", err);
    res.status(500).json({ ok: false, error: "Die Bestellung konnte gerade nicht gespeichert werden." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Unterlagen: Vertrag als PDF, Rechnung (signierter Link der bestehenden Rechnung)
// ═══════════════════════════════════════════════════════════════════════════
// Aus dem Kundenbereich (/app → Geld und Abo): der Vertrag der angemeldeten Person.
router.get("/kunde/:ref/vertrag.pdf", requireKunde as any, async (req: Request, res: Response) => {
  try {
    const sitzung = String((req as KundeRequest).kundeRef || "");
    const mod: any = await import("../lib/fiaon-antrag-neu-bestaetigung");
    const vertragsRef = sitzung ? await mod.vertragsRefFuerKunde(sitzung) : null;
    const pdf = vertragsRef ? await mod.vertragPdfFuerKunde(vertragsRef) : null;
    if (!pdf) return res.status(404).send("Zu Ihrem Konto gibt es keinen Vertrag aus dem neuen Antrag. Ihre Unterlagen schicken wir Ihnen gern per E-Mail – schreiben Sie an support@fiaon.com.");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${pdf.dateiname}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.send(pdf.pdf);
  } catch (err) {
    console.error("[ANTRAG-NEU] kunde vertrag.pdf:", err);
    res.status(503).send("Der Vertrag wird gerade erstellt. Bitte versuchen Sie es in einer Minute noch einmal.");
  }
});

router.get("/antrag-neu/:ref/vertrag.pdf", requireKundeOderAntrag as any, async (req: Request, res: Response) => {
  try {
    const ref = refAus(req);
    if (!ref) return res.status(400).send("Ungültige Referenz.");
    const mod: any = await import("../lib/fiaon-antrag-neu-bestaetigung");
    const pdf = await mod.vertragPdfFuerKunde(ref);
    if (!pdf) return res.status(404).send("Zu diesem Antrag gibt es noch keinen angenommenen Vertrag.");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${pdf.dateiname}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.send(pdf.pdf);
  } catch (err) {
    // Die Annahme ist da, aber Chromium druckt gerade nicht — kein Ersatzdruck (das PDF ist ein Nachweis).
    console.error("[ANTRAG-NEU] vertrag.pdf:", err);
    res.status(503).send("Der Vertrag wird gerade erstellt. Bitte versuchen Sie es in einer Minute noch einmal.");
  }
});

router.get("/antrag-neu/:ref/rechnung", async (req: Request, res: Response) => {
  try {
    const ref = refAus(req);
    if (!ref || !antragPasst(req, ref)) return res.status(403).send("Bitte melden Sie sich in Ihrem Kundenbereich an.");
    const [z] = (await sqlPool`SELECT payment_reference, invoice_number FROM fiaon_applications WHERE ref = ${ref} AND merged_into IS NULL LIMIT 1`) as any[];
    if (!z?.payment_reference) return res.status(404).send("Die Rechnung ist noch nicht erstellt.");
    const { signInvoiceUrl } = await import("../fiaon-invoice");
    const u = new URL(signInvoiceUrl(String(z.payment_reference)));
    res.redirect(302, `${u.pathname}${u.search}`);
  } catch (err) {
    console.error("[ANTRAG-NEU] rechnung:", err);
    res.status(500).send("Die Rechnung konnte gerade nicht geladen werden.");
  }
});

export default router;
