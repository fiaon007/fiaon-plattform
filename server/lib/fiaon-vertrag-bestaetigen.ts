// ═══════════════════════════════════════════════════════════════════════════
// VERTRAGSBESTÄTIGUNG FÜR JEDEN ABSCHLUSSWEG (19.10.2026, E-398)
//
// ── DER BEFUND (Produktion, nur lesend, 19.10.2026) ────────────────────────
// /antrag-neu ist sauber: 86 von 86 Annahmen mit Vertrags-PDF und Bestätigung
// (§ 312f BGB). Daneben gibt es Bestellungen, die NIE durch diesen Vertrag
// gingen: der alte Antrag (bis 12.10.) und die Anlage durch den Betreuer
// (server/routes/fiaon-agent-anlage.ts — agb_stand per Datenbank-Standard,
// keine Annahme des Kunden). 22 der aktiven Jahresverträge haben weder PDF noch
// Bestätigung — für einen Finanzierer heißt das: kein Nachweis, dass der
// Vertrag besteht („Veritätsrisiko“).
//
// ── DER WEG ────────────────────────────────────────────────────────────────
// EINE Strecke für alle, auf der Seite /vertrag-bestaetigen/<Link>, mit
// demselben Vertragstext, derselben Tabelle (fiaon_vertragsannahmen), demselben
// PDF und derselben Bestätigungsmail wie /antrag-neu (vertragBestaetigungSenden):
//   · abschluss    — Bestellungen ab BESTAETIGUNG_ALLE_WEGE_AB ohne Annahme
//                    (Betreuer-Anlage, alter Antrag): Der Kunde liest den
//                    Vertrag, unterschreibt und klickt „Zahlungspflichtig
//                    annehmen“ — WORTGLEICH mit /antrag-neu. Läuft nach dem
//                    Aufspielen von selbst (Einladung per Mail, Lauf alle 10 Min.).
//   · bestaetigung — Bestand: bezahlte Jahresverträge VOR diesem Tag ohne
//                    Annahme. Der Kunde bestätigt seinen bestehenden Vertrag mit
//                    „Zahlungspflichtig bestellen“ (EuGH C-400/22). Wortlaut =
//                    ENTWURF FÜR LEXR; die Einladungen gehen erst raus, wenn
//                    BESTAND_FREIGABE gesetzt ist (Justins „go“).
//
// Prüfstand: scripts/pruef-vertrag-bestaetigen.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { sqlPool } from "./db-pool";
import { absoluteUrl } from "../fiaon-base-url";
import { antragNeuPaket, ANTRAG_NEU_VERTRAG_FASSUNG, ANTRAG_NEU_LEISTUNG_FASSUNG, ANTRAG_NEU_SOFORT_TEXT, antragNeuHakenKombi, agbDatum, type Land } from "@shared/fiaon-antrag-neu";
import { antragNeuVertragHtml, KNOPF_BESTAETIGUNG, BESTAETIGUNG_FASSUNG_ZEICHEN, euroCent } from "@shared/fiaon-antrag-neu-vertrag";
import { AGB_FASSUNG } from "@shared/fiaon-vertrag-paket";
import { paketPreisCents } from "@shared/fiaon-pakete";
import { geburtsdatumLesen } from "@shared/fiaon-geburtsdatum";
import { KNOPF_ZAHLUNGSPFLICHTIG } from "../../client/src/components/antrag/bestelluebersicht-daten";
import { abgeschicktSql } from "@shared/fiaon-antrag-stand";

type Lauf = typeof sqlPool;
export type BestaetigenModus = "abschluss" | "bestaetigung";

/** Bestellungen ab diesem Tag (Berlin) ohne Annahme bekommen die Einladung „Vertrag unterschreiben“ von selbst. */
export const BESTAETIGUNG_ALLE_WEGE_AB = "2026-10-19";
/**
 * Bestand (bezahlte Jahresverträge davor ohne Annahme): Einladung „Vertrag bestätigen“ erst nach Justins „go“
 * (Wortlaut vorher von LEXR). null = aus. Wird beim „go“ auf den Tag gesetzt — EINE Stelle.
 */
export const BESTAND_FREIGABE: string | null = null;
/** So lange gilt ein Link. */
export const LINK_TAGE = 60;
const EINLADUNG_EREIGNIS: Record<BestaetigenModus, string> = { abschluss: "vertrag_unterschreiben", bestaetigung: "vertrag_bestaetigen_bitte" };
const PROTOKOLL_VON = "System (Vertragsbestätigung für jeden Weg)";
const PNG_KOPF = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PRIVAT_PAKETE = ["start", "pro", "ultra", "highend"];

// ── Der Link ────────────────────────────────────────────────────────────────

function geheimnis(): string {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("Vertragslinks sind ohne SESSION_SECRET abgeschaltet.");
  return "fiaon-dev-vertrag-bestaetigen";
}
const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");
function signatur(ref: string, ablauf: number): string {
  return b64(createHmac("sha256", geheimnis()).update(`vertrag-bestaetigen.${ref}.${ablauf}`).digest()).slice(0, 32);
}
/** Das Token: Bestellung (base64url), Ablauf (Sekunden), Signatur. */
export function bestaetigenToken(ref: string, gueltigBis: Date = new Date(Date.now() + LINK_TAGE * 864e5)): string {
  const ablauf = Math.floor(gueltigBis.getTime() / 1000);
  return `${b64(ref)}.${ablauf}.${signatur(ref, ablauf)}`;
}
/** Die Bestellung aus einem Token — oder null (falsch, verändert, abgelaufen). */
export function bestaetigenTokenLesen(token: string, jetzt = Date.now()): string | null {
  const m = /^([A-Za-z0-9_-]{8,120})\.(\d{9,11})\.([A-Za-z0-9_-]{32})$/.exec(String(token ?? "").trim());
  if (!m) return null;
  const ref = Buffer.from(m[1], "base64url").toString("utf8");
  if (!/^FIAON-[A-Z0-9-]{4,40}$/.test(ref)) return null;
  const ablauf = Number(m[2]);
  const soll = Buffer.from(signatur(ref, ablauf));
  const ist = Buffer.from(m[3]);
  if (soll.length !== ist.length || !timingSafeEqual(soll, ist)) return null;
  if (ablauf * 1000 < jetzt) return null;
  return ref;
}
export function bestaetigenUrl(token: string): string { return absoluteUrl(`/vertrag-bestaetigen/${token}`); }

// ── Die Lage ────────────────────────────────────────────────────────────────

/** „Hauptstraße 5a“ → Straße und Nummer. */
export function strasseTeilen(roh: unknown): { strasse: string; nr: string } {
  const t = String(roh ?? "").trim().replace(/\s+/g, " ");
  const m = /^(.*\S)\s+(\d+\s?[a-zA-Z]?(?:\s?[-/]\s?\d+\s?[a-zA-Z]?)?)$/.exec(t);
  return m ? { strasse: m[1], nr: m[2].replace(/\s/g, "") } : { strasse: t, nr: "" };
}
/** Land aus der Bestellung (DE als Vorgabe). */
export function landAus(roh: unknown): Land {
  const t = String(roh ?? "").trim().toLowerCase();
  if (/^(at|aut|österreich|oesterreich|austria)$/.test(t)) return "AT";
  if (/^(ch|che|schweiz|switzerland|suisse)$/.test(t)) return "CH";
  return "DE";
}
/** „12. März 1968“ aus dem gespeicherten Geburtsdatum — oder leer. */
function geburtLang(roh: unknown): string {
  const iso = geburtsdatumLesen(roh, "pruefung").iso;
  if (!iso) return "";
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export interface BestaetigenStand {
  ok: boolean;
  grund?: "unbekannt" | "fertig" | "beendet" | "kein_paket";
  ref?: string;
  modus?: BestaetigenModus;
  name?: string;
  paket?: { key: string; name: string; rateCents: number; gesamtCents: number; limits: number[] };
  limitVorschlag?: number;
  bestelltAm?: string | null;
  angenommenAm?: string | null;
  fassungen?: { agb: string; vertrag: string; leistung: string };
  knopf?: string;
  haken?: { agb: string; sofort: string };
}

async function zeileLaden(ref: string, lauf: Lauf): Promise<any | null> {
  const [a] = (await lauf`
    SELECT a.ref, a.person_id, a.pack_key, a.payment_status, a.created_at, a.gekuendigt_am, a.vertrag_ende_am, a.first_name, a.last_name,
           a.email, a.contact_email, a.street, a.zip, a.city, a.country, a.birthdate, a.wanted_limit, a.antrag_weg, a.merged_into,
           (SELECT to_jsonb(p) ->> 'anrede' FROM fiaon_persons p WHERE p.id = a.person_id) AS anrede,
           (SELECT v.angenommen_am FROM fiaon_vertragsannahmen v WHERE v.ref = a.ref LIMIT 1) AS angenommen_am
      FROM fiaon_applications a WHERE a.ref = ${ref} AND a.gdpr_deleted_at IS NULL LIMIT 1`) as any[];
  return a ?? null;
}

/** Abschluss (neu) oder Bestätigung (Bestand) — nach dem Tag der Bestellung. */
export function modusFuer(angelegt: unknown, cutoff = BESTAETIGUNG_ALLE_WEGE_AB): BestaetigenModus {
  const t = angelegt ? new Date(String(angelegt)).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }) : "";
  return t && t >= cutoff ? "abschluss" : "bestaetigung";
}

function limitVorschlag(paketKey: string, wunsch: unknown): number {
  const p = antragNeuPaket(paketKey)!;
  const w = Number(wunsch);
  return (p.limits as number[]).includes(w) ? w : p.limits[Math.floor(p.limits.length / 2)];
}

/** Der Stand für die Seite — ohne personenbezogene Daten außer dem Namen (der Link ist persönlich). */
export async function bestaetigenStand(ref: string, lauf: Lauf = sqlPool): Promise<BestaetigenStand> {
  const a = await zeileLaden(ref, lauf);
  if (!a || a.merged_into) return { ok: false, grund: "unbekannt" };
  if (a.angenommen_am) return { ok: false, grund: "fertig", ref, angenommenAm: new Date(a.angenommen_am).toISOString() };
  if (a.gekuendigt_am || (a.vertrag_ende_am && new Date(a.vertrag_ende_am).getTime() <= Date.now())) return { ok: false, grund: "beendet", ref };
  const p = antragNeuPaket(a.pack_key);
  if (!p) return { ok: false, grund: "kein_paket", ref };
  const modus = modusFuer(a.created_at);
  const rate = paketPreisCents(p.key);
  return {
    ok: true, ref, modus,
    name: [a.first_name, a.last_name].filter(Boolean).join(" ").trim(),
    paket: { key: p.key, name: p.name, rateCents: rate, gesamtCents: rate * 12, limits: [...p.limits] },
    limitVorschlag: limitVorschlag(p.key, a.wanted_limit),
    bestelltAm: a.created_at ? new Date(a.created_at).toISOString() : null,
    fassungen: { agb: AGB_FASSUNG, vertrag: ANTRAG_NEU_VERTRAG_FASSUNG + (modus === "bestaetigung" ? BESTAETIGUNG_FASSUNG_ZEICHEN : ""), leistung: ANTRAG_NEU_LEISTUNG_FASSUNG },
    knopf: modus === "abschluss" ? KNOPF_ZAHLUNGSPFLICHTIG : KNOPF_BESTAETIGUNG,
    haken: { agb: antragNeuHakenKombi(agbDatum(AGB_FASSUNG)), sofort: ANTRAG_NEU_SOFORT_TEXT },
  };
}

/** Der Vertragstext für diese Bestellung — derselbe Baustein wie /antrag-neu. */
export function vertragHtmlFuer(a: any, opt: { modus: BestaetigenModus; limit: number; sofort: boolean; am: Date | null }): string {
  const { strasse, nr } = strasseTeilen(a.street);
  const anrede = a.anrede === "Frau" || a.anrede === "Herr" ? a.anrede : "";
  return antragNeuVertragHtml({
    ref: String(a.ref), anrede, vorname: String(a.first_name ?? ""), nachname: String(a.last_name ?? ""), geburt: geburtLang(a.birthdate),
    strasse, nr, plz: String(a.zip ?? ""), ort: String(a.city ?? ""), land: landAus(a.country), email: String(a.email ?? a.contact_email ?? ""),
    paketKey: String(a.pack_key), limit: opt.limit, sofortBeginn: opt.sofort, angenommenAm: opt.am,
    bestaetigung: opt.modus === "bestaetigung" ? { bestelltAm: a.created_at ? new Date(a.created_at) : null } : null,
  });
}

export async function vertragVorschau(ref: string, opt: { limit: unknown; sofort: boolean }, lauf: Lauf = sqlPool): Promise<string | null> {
  const a = await zeileLaden(ref, lauf);
  const p = a ? antragNeuPaket(a.pack_key) : null;
  if (!a || !p) return null;
  const limit = (p.limits as number[]).includes(Number(opt.limit)) ? Number(opt.limit) : limitVorschlag(p.key, a.wanted_limit);
  return vertragHtmlFuer(a, { modus: modusFuer(a.created_at), limit, sofort: opt.sofort, am: null });
}

// ── Annehmen ────────────────────────────────────────────────────────────────

export interface AnnahmeEingabe {
  limit: unknown;
  sofort: boolean;
  hakenAgb: boolean;
  knopf: string;
  fassungen: { agb?: unknown; vertrag?: unknown; leistung?: unknown };
  unterschrift?: { png?: unknown; getippt?: unknown } | null;
  ip: string;
  userAgent: string;
  /** true = der Roboter-Wand ausgenommen (nur lokaler Prüfstand). */
  pruefstand?: boolean;
}

export type AnnahmeErgebnis = { ok: true; angenommenAm: string; modus: BestaetigenModus } | { ok: false; status: number; feld?: string; neuLaden?: boolean; error: string };

/** Annehmen bzw. bestätigen — schreibt die Annahme (wie /antrag-neu) und stößt die Bestätigung mit PDF an. */
export async function bestaetigenAnnehmen(ref: string, ein: AnnahmeEingabe, lauf: Lauf = sqlPool): Promise<AnnahmeErgebnis> {
  const stand = await bestaetigenStand(ref, lauf);
  if (!stand.ok) {
    if (stand.grund === "fertig") return { ok: true, angenommenAm: stand.angenommenAm!, modus: "abschluss" };
    return { ok: false, status: stand.grund === "unbekannt" ? 404 : 409, error: stand.grund === "beendet" ? "Dieser Vertrag ist beendet — es gibt nichts mehr zu bestätigen." : "Diesen Vertrag finden wir nicht." };
  }
  const modus = stand.modus!;
  if (!ein.hakenAgb) return { ok: false, status: 400, feld: "agb", error: "Bitte bestätigen Sie die AGB und dass Sie die Angaben geprüft haben." };
  if (String(ein.knopf ?? "") !== stand.knopf) return { ok: false, status: 400, error: `Bitte nutzen Sie den Knopf „${stand.knopf}“.` };
  const f = ein.fassungen ?? {};
  if (f.agb !== stand.fassungen!.agb || f.vertrag !== stand.fassungen!.vertrag || f.leistung !== stand.fassungen!.leistung) {
    return { ok: false, status: 409, neuLaden: true, error: "Die Vertragsbedingungen wurden gerade aktualisiert – bitte laden Sie die Seite neu." };
  }
  const limit = Number(ein.limit);
  if (!stand.paket!.limits.includes(limit)) return { ok: false, status: 400, feld: "limit", error: "Bitte wählen Sie Ihr Ziel-Limit." };
  let png: Buffer | null = null;
  let getippt = false;
  if (modus === "abschluss") {
    const m = String(ein.unterschrift?.png ?? "").match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
    png = m ? Buffer.from(m[1], "base64") : null;
    if (!png || png.length < 200 || png.length > 400_000 || !png.subarray(0, 8).equals(PNG_KOPF)) {
      return { ok: false, status: 400, feld: "unterschrift", error: "Bitte unterschreiben Sie noch einmal auf der Linie." };
    }
    getippt = ein.unterschrift?.getippt === true;
  }
  const a = await zeileLaden(ref, lauf);
  const am = new Date();
  const html = vertragHtmlFuer(a, { modus, limit, sofort: ein.sofort === true, am });
  const sha = createHash("sha256").update(html, "utf8").digest("hex");
  const rate = stand.paket!.rateCents;
  const haken = [
    { id: "agb_geprueft", text: stand.haken!.agb, gesetzt: true },
    { id: "sofort", text: stand.haken!.sofort, gesetzt: ein.sofort === true },
  ];
  const weg = ein.pruefstand ? `${modus}-pruefstand` : modus;
  const neu = (await lauf`
    INSERT INTO fiaon_vertragsannahmen (ref, person_id, weg, angenommen_am, ip, user_agent, paket, rate_cents, gesamt_cents,
      ziel_limit, vertrag_fassung, leistung_fassung, agb_fassung, knopf_text, haken, sofort_beginn,
      unterschrift_png, unterschrift_getippt, vertrag_html, vertrag_sha256)
    VALUES (${ref}, ${a.person_id ?? null}, ${weg}, ${am}, ${String(ein.ip ?? "").slice(0, 80)}, ${String(ein.userAgent ?? "").slice(0, 500)},
      ${stand.paket!.key}, ${rate}, ${rate * 12}, ${limit}, ${stand.fassungen!.vertrag}, ${stand.fassungen!.leistung}, ${stand.fassungen!.agb},
      ${stand.knopf!}, ${JSON.stringify(haken)}::jsonb, ${ein.sofort === true}, ${png}, ${modus === "abschluss" ? getippt : null}, ${html}, ${sha})
    ON CONFLICT (ref) DO NOTHING
    RETURNING angenommen_am`) as any[];
  if (!neu.length) {
    const doch = await zeileLaden(ref, lauf);
    if (doch?.angenommen_am) return { ok: true, angenommenAm: new Date(doch.angenommen_am).toISOString(), modus };
    return { ok: false, status: 500, error: "Die Annahme konnte gerade nicht gespeichert werden." };
  }
  // Die Bestellung kennt jetzt die Zustimmung des Kunden (E-264: die Betreuer-Anlage hatte keine) und sein Ziel-Limit.
  await lauf`
    UPDATE fiaon_applications SET consent_contract = TRUE, consent_agb = TRUE, wanted_limit = COALESCE(wanted_limit, ${limit}), updated_at = NOW()
     WHERE ref = ${ref}`;
  await lauf`UPDATE fiaon_vertrag_einladungen SET angenommen_am = ${am} WHERE ref = ${ref}`.catch(() => {});
  const zeit = am.toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  await lauf`
    INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
    VALUES (${ref}, ${a.person_id ?? null}, NULL, 'System', 'system',
            ${modus === "abschluss"
              ? `Vertrag unterschrieben und mit „${KNOPF_ZAHLUNGSPFLICHTIG}“ angenommen am ${zeit} Uhr (Vertragsfassung ${stand.fassungen!.vertrag}, Ziel-Limit ${euroCent(limit * 100)}, ${ein.sofort ? "Sofortbeginn verlangt" : "Beginn nach Widerrufsfrist"}). Vertrag als PDF geht per Mail raus.`
              : `Bestehenden Vertrag mit „${KNOPF_BESTAETIGUNG}“ bestätigt am ${zeit} Uhr (Vertragsfassung ${stand.fassungen!.vertrag}, Ziel-Limit ${euroCent(limit * 100)}). Vertrag als PDF geht per Mail raus.`})`
    .catch((e) => console.error(`[VERTRAG-BESTAETIGEN] ${ref}: Verlauf:`, e));
  // Dieselbe Bestätigung mit PDF wie /antrag-neu — im Hintergrund; der Nachhol-Lauf fängt Fehler auf.
  import("./fiaon-antrag-neu-bestaetigung")
    .then((mod) => mod.vertragBestaetigungSenden(ref, lauf))
    .catch((e) => console.error(`[VERTRAG-BESTAETIGEN] ${ref}: Bestätigung nicht angestoßen:`, e));
  return { ok: true, angenommenAm: am.toISOString(), modus };
}

// ── Die Tabelle ─────────────────────────────────────────────────────────────

let tabelleBereit: Promise<void> | null = null;
/**
 * fiaon_vertrag_einladungen kommt aus db/migrations/113_vertrag_einladungen.sql (läuft vor jedem Start auf Render).
 * Fehlt sie (lokaler Prüfstand ohne Migrationslauf), wird DIESELBE Datei ausgeführt — nur eine neue Tabelle (E-254).
 */
export function einladungTabelle(lauf: Lauf = sqlPool): Promise<void> {
  if (!tabelleBereit) {
    tabelleBereit = (async () => {
      const [t] = (await lauf.unsafe(`SELECT to_regclass('public.fiaon_vertrag_einladungen') IS NOT NULL AS da`)) as any[];
      if (t?.da) return;
      await lauf.unsafe(await readFile(path.join(process.cwd(), "db", "migrations", "113_vertrag_einladungen.sql"), "utf8"));
    })().catch((e) => { tabelleBereit = null; throw e; });
  }
  return tabelleBereit;
}

// ── Die Einladungen (Lauf alle 10 Minuten) ──────────────────────────────────

/** Welche Bestellungen eine Einladung brauchen — eine Definition für Lauf, Prüfstand und Zählung. */
export function einladungKandidatenSql(opt: { bestand: boolean; cutoff?: string }): string {
  const cutoff = opt.cutoff ?? BESTAETIGUNG_ALLE_WEGE_AB;
  return `
    SELECT a.ref, a.person_id, a.created_at,
           CASE WHEN (a.created_at AT TIME ZONE 'Europe/Berlin')::date >= DATE '${cutoff}' THEN 'abschluss' ELSE 'bestaetigung' END AS modus
      FROM fiaon_applications a
      LEFT JOIN fiaon_persons p ON p.id = a.person_id
     WHERE a.merged_into IS NULL AND a.archived_at IS NULL AND a.gdpr_deleted_at IS NULL
       AND a.ref NOT LIKE 'FIAON-TEST%' AND p.ist_test_am IS NULL
       AND COALESCE(a.antrag_weg, '') <> 'neu'
       -- Nur Abgeschicktes (E-264): Der alte Antrag setzte pending_payment schon bei Schritt 3–5.
       AND ${abgeschicktSql("a")}
       AND LOWER(COALESCE(a.pack_key, '')) IN (${PRIVAT_PAKETE.map((k) => `'${k}'`).join(", ")})
       AND a.agb_stand >= DATE '2026-09-03'
       AND a.gekuendigt_am IS NULL
       AND NOT EXISTS (SELECT 1 FROM fiaon_vertragsannahmen v WHERE v.ref = a.ref)
       AND NOT EXISTS (SELECT 1 FROM fiaon_vertrag_einladungen e WHERE e.ref = a.ref AND (e.gesendet_am IS NOT NULL OR e.versuche >= 5))
       AND (
             ((a.created_at AT TIME ZONE 'Europe/Berlin')::date >= DATE '${cutoff}' AND a.payment_status IN ('pending_payment', 'claimed_paid', 'paid'))
          ${opt.bestand ? `OR ((a.created_at AT TIME ZONE 'Europe/Berlin')::date < DATE '${cutoff}' AND a.payment_status = 'paid')` : ""}
       )`;
}

/**
 * Schickt fällige Einladungen (höchstens 20 je Lauf, nacheinander). Bestand nur mit BESTAND_FREIGABE.
 * Gibt die Zahl der gesendeten zurück. Ohne Brevo-Schlüssel (Prüfstand) wird es versucht und protokolliert.
 */
export async function einladungenSenden(opt: { bestand?: boolean } = {}, lauf: Lauf = sqlPool): Promise<number> {
  await einladungTabelle(lauf);
  const bestand = opt.bestand ?? !!BESTAND_FREIGABE;
  const zeilen = (await lauf.unsafe(`${einladungKandidatenSql({ bestand })} ORDER BY a.created_at ASC LIMIT 20`)) as any[];
  let gesendet = 0;
  for (const z of zeilen) {
    const ok = await einladungSenden(String(z.ref), z.modus as BestaetigenModus, lauf).catch((e) => { console.error(`[VERTRAG-BESTAETIGEN] ${z.ref}:`, e); return false; });
    if (ok) gesendet++;
  }
  if (zeilen.length) console.log(`[VERTRAG-BESTAETIGEN] Einladungen: ${zeilen.length} fällig, ${gesendet} gesendet.`);
  return gesendet;
}

/** Eine Einladung — Vertragspost, direkt über den Motor, Adresse über die zentrale Auflösung. */
export async function einladungSenden(ref: string, modus: BestaetigenModus, lauf: Lauf = sqlPool): Promise<boolean> {
  const a = await zeileLaden(ref, lauf);
  const p = a ? antragNeuPaket(a.pack_key) : null;
  if (!a || !p) return false;
  await lauf`INSERT INTO fiaon_vertrag_einladungen (ref, person_id, modus) VALUES (${ref}, ${a.person_id ?? null}, ${modus}) ON CONFLICT (ref) DO NOTHING`;
  const { empfaengerAufloesen } = await import("./fiaon-empfaenger");
  const empf = await empfaengerAufloesen({ personId: a.person_id ?? null, ref, ausNutzlast: a.email || a.contact_email }, lauf);
  const fehler = async (grund: string) => {
    await lauf`UPDATE fiaon_vertrag_einladungen SET versuche = versuche + 1, fehler = ${grund.slice(0, 500)} WHERE ref = ${ref}`;
    return false;
  };
  if (!empf?.email) return fehler("Keine zustellbare E-Mail-Adresse.");
  const rate = paketPreisCents(p.key);
  const nutzlast: Record<string, string> = {
    email: empf.email,
    vorname: String(a.first_name ?? "").replace(/[<>&"]/g, ""),
    paket: p.name,
    rate_text: euroCent(rate),
    gesamt_text: euroCent(rate * 12),
    bestellt_text: a.created_at ? new Date(a.created_at).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" }) : "",
    link_url: bestaetigenUrl(bestaetigenToken(ref)),
    antrag_id: ref,
  };
  const ereignis = EINLADUNG_EREIGNIS[modus];
  const motor = await import("../mail/motor");
  const probe = motor.mailRendern(ereignis, nutzlast);
  if (!probe) return fehler(`Keine Vorlage für '${ereignis}'.`);
  if (probe.fehlend.length) return fehler(`Platzhalter ohne Wert: ${probe.fehlend.join(", ")}.`);
  const erg = await motor.mailDirektSenden(ereignis, nutzlast).catch((e) => ({ ok: false, messageId: null, grund: String(e) }));
  const { mailProtokoll } = await import("./fiaon-mail-log");
  await mailProtokoll({
    event: ereignis, personId: empf.personId ?? a.person_id ?? null, empfaenger: empf.email,
    status: erg.ok ? "versandt" : "fehlgeschlagen", grund: erg.ok ? null : (erg.grund || "unbekannt"),
    payload: { ...nutzlast, link_url: "(persönlicher Link)" }, ausgeloestVon: PROTOKOLL_VON, brevoMessageId: erg.messageId,
  }, lauf);
  if (!erg.ok) return fehler(`Versand gescheitert: ${erg.grund || "unbekannt"}`);
  await lauf`UPDATE fiaon_vertrag_einladungen SET gesendet_am = NOW(), email = ${empf.email}, fehler = NULL, versuche = versuche + 1 WHERE ref = ${ref}`;
  await lauf`
    INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
    VALUES (${ref}, ${a.person_id ?? null}, NULL, 'System', 'system',
            ${modus === "abschluss"
              ? `Einladung „Vertrag unterschreiben“ an ${empf.email} geschickt — die Bestellung entstand ohne den Vertragstext (Betreuer-Anlage oder alter Antrag). Nach der Unterschrift kommt der Vertrag als PDF.`
              : `Einladung „Vertrag bestätigen“ an ${empf.email} geschickt (Bestand ohne Vertragsnachweis, EuGH C-400/22).`})`.catch(() => {});
  return true;
}
