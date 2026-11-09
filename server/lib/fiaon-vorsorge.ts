// ═══════════════════════════════════════════════════════════════════════════
// FIAON — „IHR VORSORGE-ÜBERBLICK“: SEITE, KARTE UND SELBSTBUCHUNG (E-487 (09.11.2026))
//
// Regeln und Texte: shared/fiaon-vorsorge.ts · Lieferstrecke (Kern, Übermittlung, Bestätigung): server/lib/fiaon-koop-lieferung.ts
// Die Mail an die Kunden (Kreis, Takt, Freigabe im Mailwerk): server/lib/fiaon-vorsorge-einladung.ts
//
// ── DIE ZWEI TÜREN ZUM SELBEN WEG ─────────────────────────────────────────
//   · Kundenbereich /app › Heute (angemeldet, requireKunde) — die Karte PartnerGespraechKarte
//   · persönlicher Link /vorsorge/<personId>.<ablauf>.<signatur> (ohne Anmeldung, 30 Tage, noindex, gedrosselt) — der Knopf
//     in Maras Mail. Muster terminTokenErzeugen/terminTokenPruefen (fiaon-termine.ts) mit EIGENEM Präfix „vorsorge.“ im
//     signierten Text: Ein Termin-Link öffnet hier nichts und umgekehrt.
// Beide lesen vorsorgeLage und buchen über vorsorgeBuchen → koopKontaktAnlegen mit Kanal „kundenbereich“, IP und
// Browser-Kennung. Danach wie in der Akte: koopUebermitteln (Mail an den Partner) und koopKundeBestaetigen.
//
// ── WAS NIE PASSIERT ──────────────────────────────────────────────────────
//   · Keine Finanzdaten auf der Seite, keine Notiz an den Partner — nur Name, Kontakt, Thema, Termin (Wortlaut).
//   · Kein Kästchen ist vorangekreuzt; ohne „einwilligung: true“ vom Kunden entsteht nichts.
//   · Die Sperren von koopKandidat gelten (Werbesperre, Vertriebssperre, Global, AT/CH, minderjährig, Test, ohne Kontakt);
//     dazu: nur Kunden mit bezahltem Stufenpaket. Ein Kunde liest nie einen Satz für Mitarbeiter (vorsorgeFehlerText).
//   · Die Vorschau aus dem Chefbüro (Link „v.<ablauf>.<signatur>“, 7 Tage) zeigt den echten Partner, speichert nichts.
// DATENSCHUTZ: Das Repo ist öffentlich (E-242) — hier stehen KEINE Partner- oder Kundendaten.
// ═══════════════════════════════════════════════════════════════════════════
import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { sqlPool } from "./db-pool";
import { absoluteUrl } from "../fiaon-base-url";
import { formatBerlin } from "./fiaon-time";
import { produktkategorieSql } from "@shared/fiaon-produktkategorie";
import { koopPartnerImSatz, koopTerminArtText } from "@shared/fiaon-koop-lieferung";
import { KOOP_THEMEN } from "@shared/fiaon-global-angebot-koop-modelle";
import {
  VORSORGE_FASSUNG, VORSORGE_TEXTE, vorsorgeFehlerText, vorsorgePartnerName, vorsorgeRollenZeile, vorsorgeThemenAus,
  type VorsorgeLage, type VorsorgePartner, type VorsorgeStand,
} from "@shared/fiaon-vorsorge";
import {
  ensureKoopTabellen, koopKandidat, koopVorsorgePartner, koopLieferStand, koopFreieTermine, koopExklusivBelegt, koopKontaktAnlegen,
  koopWiderruf, koopInteresseVermerken, koopSchalterAus, koopOffenerTermin, type KoopSperrCode,
} from "./fiaon-koop-lieferung";
import { koopDatenAus } from "./fiaon-global-angebot-koop";
import type { AngebotZeile } from "./fiaon-global-angebot";

export type VorsorgeQuelle = "link" | "kundenbereich";
export type VorsorgeKontext = "karte" | "seite";

function json<T>(v: unknown, leer: T): T {
  if (v && typeof v === "object" && !Buffer.isBuffer(v)) return v as T;
  try { const x = JSON.parse(String(v ?? "")); return (typeof x === "string" ? JSON.parse(x) : x) as T; } catch { return leer; }
}

// ═══════════════════════════════════════════════════════════════════════════
// DER PERSÖNLICHE LINK — signiert, 30 Tage, eigenes Präfix
// ═══════════════════════════════════════════════════════════════════════════
export const VORSORGE_LINK_TAGE = 30;
const TOKEN_TTL_MS = VORSORGE_LINK_TAGE * 24 * 60 * 60 * 1000;
const VORSCHAU_TTL_MS = 7 * 24 * 60 * 60 * 1000;
function geheimnis(): string {
  return process.env.SESSION_SECRET || process.env.MAKE_WEBHOOK_URL || "fiaon-dev-invoice-secret";
}
function signatur(inhalt: string): string {
  return createHmac("sha256", geheimnis()).update(inhalt).digest("hex").slice(0, 32);
}
/** `personId.ablauf.signatur` — signiert wird „vorsorge.<personId>.<ablauf>“ (ein Termin-Token signiert „termin.…“). */
export function vorsorgeTokenErzeugen(personId: number, ttlMs = TOKEN_TTL_MS, jetzt = Date.now()): string {
  const exp = jetzt + ttlMs;
  return `${personId}.${exp}.${signatur(`vorsorge.${personId}.${exp}`)}`;
}
export type VorsorgeToken = { art: "person"; personId: number; abgelaufen: boolean } | { art: "vorschau"; abgelaufen: boolean };
/** Prüft einen Link. null = gefälscht, fremd oder kaputt; sonst Person (oder Vorschau) und ob er abgelaufen ist. */
export function vorsorgeTokenPruefen(token: unknown, jetzt = Date.now()): VorsorgeToken | null {
  const teile = String(token ?? "").split(".");
  if (teile.length !== 3) return null;
  const [kopf, ablauf, sig] = teile;
  if (!/^\d{10,16}$/.test(ablauf) || !/^[0-9a-f]{32}$/.test(sig)) return null;
  const exp = Number(ablauf);
  const vorschau = kopf === "v";
  const personId = Number(kopf);
  if (!vorschau && !(/^\d{1,10}$/.test(kopf) && Number.isInteger(personId) && personId > 0)) return null;
  const erwartet = Buffer.from(signatur(vorschau ? `vorsorge-vorschau.${exp}` : `vorsorge.${personId}.${exp}`));
  const gegeben = Buffer.from(sig);
  if (erwartet.length !== gegeben.length || !timingSafeEqual(erwartet, gegeben)) return null;
  return vorschau ? { art: "vorschau", abgelaufen: exp < jetzt } : { art: "person", personId, abgelaufen: exp < jetzt };
}
/** Der Knopf in Maras Mail. */
export function vorsorgeLink(personId: number): string {
  return absoluteUrl(`/vorsorge/${vorsorgeTokenErzeugen(personId)}`);
}
/** Die Vorschau für Chefbüro und Prüfversand: echter Partner, „Max Mustermann“, nichts wird gespeichert (7 Tage). */
export function vorsorgeVorschauLink(jetzt = Date.now()): string {
  const exp = jetzt + VORSCHAU_TTL_MS;
  return absoluteUrl(`/vorsorge/v.${exp}.${signatur(`vorsorge-vorschau.${exp}`)}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE TABELLE (db/migrations/132_vorsorge_ueberblick.sql — beim ersten Gebrauch, falls sie fehlt)
// ═══════════════════════════════════════════════════════════════════════════
let bereit: Promise<void> | null = null;
export function ensureVorsorgeTabellen(): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      await ensureKoopTabellen();
      const [r] = (await sqlPool`SELECT to_regclass('public.fiaon_vorsorge_ueberblick') AS t`) as any[];
      if (!r?.t) {
        const sql = readFileSync(path.resolve(process.cwd(), "db", "migrations", "132_vorsorge_ueberblick.sql"), "utf8");
        await sqlPool.begin(async (tx: any) => {
          await tx`SET LOCAL lock_timeout = '3s'`;
          await tx.unsafe(sql);
        });
      }
    })().catch((e) => { bereit = null; throw e; });
  }
  return bereit;
}

/** Eintrag im Verlauf der Akte (an der jüngsten, bezahlten Bestellzeile — ohne Bestellzeile kein Eintrag). */
async function verlaufNotiz(personId: number, notiz: string): Promise<void> {
  try {
    const [a] = (await sqlPool`SELECT ref FROM fiaon_applications WHERE person_id = ${personId} AND merged_into IS NULL ORDER BY (payment_status = 'paid') DESC, created_at DESC LIMIT 1`) as any[];
    if (!a?.ref) return;
    await sqlPool`INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note) VALUES (${String(a.ref)}, ${personId}, NULL, 'System', 'system', ${notiz})`;
  } catch (e) { console.error("[VORSORGE] Verlauf der Akte:", e); }
}

// ═══════════════════════════════════════════════════════════════════════════
// DER ÜBERBLICK — FIAONs eigene Leistung: nur das Thema
// ═══════════════════════════════════════════════════════════════════════════
/** jsonb kann doppelt verpackt als Text ankommen (E-238/E-460) — beides lesen. */
function themenListe(v: unknown): string[] {
  let x: unknown = v;
  for (let i = 0; i < 2 && typeof x === "string"; i++) { try { x = JSON.parse(x); } catch { return []; } }
  return Array.isArray(x) ? x.map((t) => String(t ?? "")).filter(Boolean) : [];
}
export async function ueberblickLesen(personId: number): Promise<{ themen: string[]; am: string | null }> {
  await ensureVorsorgeTabellen();
  const [r] = (await sqlPool`SELECT themen, gespeichert_am FROM fiaon_vorsorge_ueberblick WHERE person_id = ${personId}`) as any[];
  return { themen: themenListe(r?.themen), am: r?.gespeichert_am ? new Date(r.gespeichert_am).toISOString() : null };
}
/** Speichert die Auswahl (nur Themen aus `erlaubt`). Eine Änderung steht im Verlauf der Akte — für den Betreuer. */
export async function ueberblickSpeichern(personId: number, themenRoh: unknown, erlaubt: readonly string[], quelle: VorsorgeQuelle): Promise<{ themen: string[]; geaendert: boolean }> {
  await ensureVorsorgeTabellen();
  const themen = vorsorgeThemenAus(themenRoh, erlaubt);
  const alt = await ueberblickLesen(personId);
  const geaendert = alt.am === null || alt.themen.join("|") !== themen.join("|");
  await sqlPool`
    INSERT INTO fiaon_vorsorge_ueberblick (person_id, themen, quelle, gespeichert_am, geaendert_am)
    VALUES (${personId}, ${sqlPool.json(themen as any)}, ${quelle}, NOW(), NOW())
    ON CONFLICT (person_id) DO UPDATE SET themen = EXCLUDED.themen, quelle = EXCLUDED.quelle, gespeichert_am = NOW(), geaendert_am = NOW()`;
  if (geaendert) {
    await verlaufNotiz(personId, `Vorsorge-Überblick ${themen.length ? `gespeichert: ${themen.join(" · ")}` : "geleert"} (${quelle === "link" ? "über den persönlichen Link aus der E-Mail" : "im Kundenbereich"}). FIAON fragt nur das Thema — keine Empfehlung.`);
  }
  return { themen, geaendert };
}
/** Der persönliche Link wurde geöffnet (Trichter im Mailwerk). Nie für die Vorschau. */
export async function vorsorgeLinkGeoeffnet(personId: number): Promise<void> {
  await ensureVorsorgeTabellen();
  await sqlPool`
    INSERT INTO fiaon_vorsorge_ueberblick (person_id, link_geoeffnet_am, link_aufrufe) VALUES (${personId}, NOW(), 1)
    ON CONFLICT (person_id) DO UPDATE SET link_geoeffnet_am = COALESCE(fiaon_vorsorge_ueberblick.link_geoeffnet_am, NOW()),
           link_aufrufe = fiaon_vorsorge_ueberblick.link_aufrufe + 1, geaendert_am = NOW()`;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE LAGE — was Seite und Karte zeigen
// ═══════════════════════════════════════════════════════════════════════════
/** Ein bezahltes Stufenpaket (nicht erstattet, nicht gelöscht) — die Selbstbuchung ist eine Leistung für Kunden. */
export async function hatBezahltesPaket(personId: number): Promise<boolean> {
  const [r] = (await sqlPool.unsafe(`
    SELECT 1 AS ja FROM fiaon_applications a
     WHERE a.person_id = $1 AND a.merged_into IS NULL AND a.payment_status = 'paid' AND a.refunded_at IS NULL AND a.gdpr_deleted_at IS NULL
       AND ${produktkategorieSql("a")} = 'konto'
     LIMIT 1`, [personId])) as any[];
  return !!r;
}

/** Die Themen der aktiven Vorsorge-Partner (Reihenfolge des ersten), ohne Partner die Vorgabe. */
function themenAusPartnern(zeilen: AngebotZeile[]): string[] {
  const aus: string[] = [];
  for (const z of zeilen) for (const t of koopDatenAus(z).parameter.themen) if (!aus.includes(t)) aus.push(t);
  return aus.length ? aus : [...KOOP_THEMEN.vorsorge];
}

async function partnerFuerKunde(z: AngebotZeile, jetzt: Date): Promise<VorsorgePartner> {
  const d = koopDatenAus(z);
  const stand = await koopLieferStand(z, sqlPool, jetzt);
  const termine = stand.sperre ? [] : (await koopFreieTermine(z, sqlPool, jetzt)).slice(0, 240);
  return {
    angebotId: Number(z.id),
    name: vorsorgePartnerName(d.partner),
    rolle: vorsorgeRollenZeile(koopSchalterAus(z).rolle, d.partner.anrede),
    partnerFuerText: { anrede: d.partner.anrede, vorname: d.partner.vorname, nachname: d.partner.nachname, firma: d.partner.firma },
    arten: (stand.zeiten?.arten ?? []).map((key) => ({ key, text: koopTerminArtText(key) })),
    dauerMin: stand.zeiten?.dauerMin ?? 60,
    termine,
    // „voll“ = der Partner nimmt gerade nichts an (Wunschmenge, Start-Rahmen, Ruhen) — ohne Zeiten ist es „keine Zeiten“.
    voll: !!stand.sperre && !!stand.zeiten,
    themen: d.parameter.themen,
  };
}

/**
 * Der Stand des Kunden. Gutachten 09.11. (E-487 Nachbesserung): Der Termin kommt aus koopOffenerTermin — ein übermittelter Termin,
 * dessen Einwilligung widerrufen ist („Termin nicht mehr gewünscht“, „Kein Gespräch gewünscht“, Widerruf in der Akte, „kein
 * Kontakt mehr“ vom Partner), ist kein gebuchter Termin mehr.
 */
async function standLesen(personId: number): Promise<{ stand: VorsorgeStand; termin: VorsorgeLage["termin"] }> {
  const t = await koopOffenerTermin(personId);
  if (t) {
    return {
      stand: "termin",
      termin: { text: formatBerlin(t.termin_beginn), art: koopTerminArtText(t.termin_art), thema: t.thema, partner: koopPartnerImSatz(json<any>(t.partner, {})) },
    };
  }
  const [e] = (await sqlPool`SELECT art, widerrufen_am FROM fiaon_koop_einwilligungen WHERE person_id = ${personId} AND art IN ('interesse', 'abgelehnt') ORDER BY erteilt_am DESC LIMIT 1`) as any[];
  if (e?.art === "abgelehnt") return { stand: "abgelehnt", termin: null };
  if (e?.art === "interesse" && !e.widerrufen_am) return { stand: "gewuenscht", termin: null };
  return { stand: "frage", termin: null };
}

/** Kundentext zu den Sperr-Kennungen von koopKandidat — nie der Satz für Mitarbeiter. */
function hinweisFuer(codes: readonly KoopSperrCode[]): string {
  if (codes.length === 1 && codes[0] === "kontakt") return VORSORGE_TEXTE.kontaktFehlt;
  if (codes.length === 1 && codes[0] === "ausland") return VORSORGE_TEXTE.nurDeutschland;
  return VORSORGE_TEXTE.nichtMoeglich;
}

/**
 * Was Seite (`seite`) und Kundenbereich-Karte (`karte`) zeigen. Die Karte bleibt wie seit E-386 still ohne aktiven Partner
 * und nach „kein Interesse“; die Seite zeigt den Überblick auch dann (der Kunde kam selbst über seinen Link).
 */
export async function vorsorgeLage(personId: number, opts: { kontext: VorsorgeKontext; jetzt?: Date }): Promise<VorsorgeLage> {
  await ensureVorsorgeTabellen();
  const jetzt = opts.jetzt ?? new Date();
  const [kandidat, ueberblick, partnerZeilen] = await Promise.all([
    koopKandidat(personId, sqlPool, jetzt), ueberblickLesen(personId), koopVorsorgePartner(jetzt),
  ]);
  const leer: VorsorgeLage = {
    ok: true, zeigen: false, buchbar: false, hinweis: VORSORGE_TEXTE.nichtMoeglich, vorschau: false,
    name: kandidat ? `${kandidat.vorname} ${kandidat.nachname}`.trim() : "",
    themen: themenAusPartnern(partnerZeilen), ueberblick, partner: [], termin: null, stand: "frage",
    bestaetigen: kandidat?.bestaetigen ?? [], belegt: {}, fassung: VORSORGE_FASSUNG,
  };
  if (!kandidat || !(await hatBezahltesPaket(personId))) return leer;
  const hart = kandidat.sperrCodes.filter((c) => c !== "kontakt");
  if (hart.length) return { ...leer, hinweis: hinweisFuer(hart) };
  const { stand, termin } = await standLesen(personId);
  if (opts.kontext === "karte" && (!partnerZeilen.length || stand === "abgelehnt")) return { ...leer, hinweis: null, stand };
  const partner: VorsorgePartner[] = [];
  for (const z of partnerZeilen) partner.push(await partnerFuerKunde(z, jetzt));
  const belegt: Record<string, string> = {};
  for (const z of partnerZeilen) {
    const d = koopDatenAus(z);
    for (const t of d.parameter.themen) {
      if (belegt[t]) continue;
      const b = await koopExklusivBelegt(personId, t, d.parameter.exklusivMonate);
      if (b) belegt[t] = `Zu diesem Thema haben Sie am ${formatBerlin(b.am, false)} schon ein Gespräch gebucht.`;
    }
  }
  const kontaktFehlt = kandidat.sperrCodes.includes("kontakt");
  const offen = partner.filter((p) => !p.voll && p.termine.length > 0);
  const buchbar = !kontaktFehlt && stand !== "termin" && offen.length > 0;
  const hinweis = stand === "termin" ? null
    : kontaktFehlt ? VORSORGE_TEXTE.kontaktFehlt
      : !partner.length ? VORSORGE_TEXTE.keinPartner
        : !offen.length ? (partner.some((p) => p.voll) ? VORSORGE_TEXTE.voll : VORSORGE_TEXTE.keineZeiten)
          : null;
  return { ...leer, zeigen: true, buchbar, hinweis, stand, termin, partner, belegt };
}

/** Die Vorschau (Chefbüro, Prüfversand): der echte Partner mit seinen freien Zeiten, ein erfundener Kunde, nichts gespeichert. */
export async function vorsorgeVorschauLage(jetzt = new Date()): Promise<VorsorgeLage> {
  await ensureVorsorgeTabellen();
  const zeilen = await koopVorsorgePartner(jetzt);
  const partner: VorsorgePartner[] = [];
  for (const z of zeilen) partner.push(await partnerFuerKunde(z, jetzt));
  const offen = partner.filter((p) => !p.voll && p.termine.length > 0);
  return {
    ok: true, zeigen: true, buchbar: offen.length > 0,
    hinweis: !partner.length ? VORSORGE_TEXTE.keinPartner : !offen.length ? VORSORGE_TEXTE.voll : null,
    vorschau: true, name: "Max Mustermann", themen: themenAusPartnern(zeilen), ueberblick: { themen: [], am: null },
    partner, termin: null, stand: "frage", bestaetigen: [], belegt: {}, fassung: VORSORGE_FASSUNG,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE HANDLUNGEN DES KUNDEN
// ═══════════════════════════════════════════════════════════════════════════
export interface VorsorgeMeta { quelle: VorsorgeQuelle; ip: string | null; userAgent: string | null; jetzt?: Date }
const kontextVon = (q: VorsorgeQuelle): VorsorgeKontext => (q === "link" ? "seite" : "karte");

export async function vorsorgeUeberblickSpeichern(personId: number, themenRoh: unknown, meta: VorsorgeMeta): Promise<{ ok: true; meldung: string; lage: VorsorgeLage } | { ok: false; status: number; error: string }> {
  await ensureVorsorgeTabellen();
  const jetzt = meta.jetzt ?? new Date();
  const k = await koopKandidat(personId, sqlPool, jetzt);
  if (!k || !(await hatBezahltesPaket(personId)) || k.sperrCodes.some((c) => c !== "kontakt")) {
    return { ok: false, status: 409, error: k ? hinweisFuer(k.sperrCodes.filter((c) => c !== "kontakt")) : VORSORGE_TEXTE.nichtMoeglich };
  }
  const erlaubt = themenAusPartnern(await koopVorsorgePartner(jetzt));
  await ueberblickSpeichern(personId, themenRoh, erlaubt, meta.quelle);
  return { ok: true, meldung: VORSORGE_TEXTE.gespeichert, lage: await vorsorgeLage(personId, { kontext: kontextVon(meta.quelle), jetzt }) };
}

/**
 * „Termin buchen“ — derselbe Kern wie in der Akte (koopKontaktAnlegen), Kanal „kundenbereich“, IP, Browser-Kennung, keine
 * Notiz. Sperre gegen Doppelbuchung, Exklusivität und Wunschmenge prüft der Kern unter der Partner-Sperre; „je Kunde ein
 * offener Termin“ prüft er unter der Personen-Sperre (Gutachten 09.11.) — hier vorab, damit der Kunde gleich seinen Termin sieht.
 */
export async function vorsorgeBuchen(personId: number, roh: Record<string, unknown>, meta: VorsorgeMeta): Promise<{ ok: true; meldung: string; lage: VorsorgeLage } | { ok: false; status: number; error: string; lage?: VorsorgeLage }> {
  // Nur ein echtes `true` aus dem Kästchen zählt — kein „true“ als Text, kein fehlendes Feld. Vor jeder Datenbankarbeit.
  if (roh?.einwilligung !== true) return { ok: false, status: 400, error: vorsorgeFehlerText("einwilligung") };
  await ensureVorsorgeTabellen();
  const jetzt = meta.jetzt ?? new Date();
  const angebotId = Number(roh.angebotId);
  const partnerZeilen = await koopVorsorgePartner(jetzt);
  if (!partnerZeilen.some((z) => Number(z.id) === angebotId)) return { ok: false, status: 404, error: vorsorgeFehlerText("partner") };
  if (!(await hatBezahltesPaket(personId))) return { ok: false, status: 409, error: VORSORGE_TEXTE.nichtMoeglich };
  const k = await koopKandidat(personId, sqlPool, jetzt);
  if (!k) return { ok: false, status: 404, error: VORSORGE_TEXTE.nichtMoeglich };
  if (k.sperrCodes.length) return { ok: false, status: 409, error: hinweisFuer(k.sperrCodes) };
  // Gutachten 09.11.: Die Seite bietet „Termin buchen“ nur ohne offenen Termin an — der Server hält dieselbe Regel (zweiter Tab,
  // direkter Aufruf des Links). Der Kern prüft sie noch einmal unter der Personen-Sperre (zwei Klicks im selben Augenblick).
  if ((await standLesen(personId)).stand === "termin") {
    const lage = await vorsorgeLage(personId, { kontext: kontextVon(meta.quelle), jetzt }).catch(() => undefined);
    return { ok: false, status: 409, error: vorsorgeFehlerText("termin_offen"), lage };
  }
  const thema = String(roh.thema ?? "");
  const r = await koopKontaktAnlegen(personId, {
    angebotId, thema, termin: String(roh.termin ?? ""), art: String(roh.art ?? ""), einwilligung: true,
    bestaetigt: Array.isArray(roh.bestaetigt) ? (roh.bestaetigt as unknown[]).map(String) : [],
    kanal: "kundenbereich", ip: meta.ip, userAgent: meta.userAgent, quelle: meta.quelle,
  }, { name: `${`${k.vorname} ${k.nachname}`.trim() || "Kunde"} (${meta.quelle === "link" ? "persönlicher Link" : "Kundenbereich"})`, agentId: null }, jetzt);
  if (!r.ok) {
    const lage = await vorsorgeLage(personId, { kontext: kontextVon(meta.quelle), jetzt }).catch(() => undefined);
    return { ok: false, status: r.status, error: vorsorgeFehlerText(r.code, k.bestaetigen), lage };
  }
  // Das gebuchte Thema gehört zum Überblick; eine offene Aufgabe „Kunde wünscht ein Gespräch“ hat sich erledigt.
  const alt = await ueberblickLesen(personId);
  if (!alt.themen.includes(thema)) await ueberblickSpeichern(personId, [...alt.themen, thema], themenAusPartnern(partnerZeilen), meta.quelle).catch((e) => console.error("[VORSORGE] Überblick ergänzen:", e));
  await rueckrufAuftraegeSchliessen(personId, meta.quelle);
  return { ok: true, meldung: r.meldung, lage: await vorsorgeLage(personId, { kontext: kontextVon(meta.quelle), jetzt }) };
}

/**
 * Der offene Auftrag „Kunde wünscht ein Gespräch zu Vorsorge und Absicherung“ (koopInteresseVermerken) hat sich mit der
 * Selbstbuchung erledigt. Gutachten 09.11.: über DEN einen Weg (auftragErledigen, fiaon-auftraege.ts) — Art „auto“, von „System“,
 * mit Ereignis und Eintrag in der Zeitleiste. Vorher schloss ein rohes UPDATE ihn: Die Wand (Trigger fiaon_todo_status_wand)
 * schrieb dann „hand“, und die Aufgaben-Lage zählte die Buchung des Kunden als Arbeit eines Menschen.
 * Ein Fehler hier hält die Buchung nie auf.
 */
async function rueckrufAuftraegeSchliessen(personId: number, quelle: VorsorgeQuelle): Promise<void> {
  try {
    const offen = (await sqlPool`
      SELECT id FROM fiaon_betreiber_todos WHERE schluessel LIKE ${`koop:interesse:${personId}:%`} AND status <> 'erledigt'`) as any[];
    if (!offen.length) return;
    const { auftragErledigen } = await import("./fiaon-auftraege");
    const ergebnis = `Der Kunde hat den Partner-Termin selbst gebucht (${quelle === "link" ? "über den persönlichen Link aus der E-Mail" : "im Kundenbereich"}) — der Rückruf entfällt.`;
    for (const t of offen) {
      await auftragErledigen(Number(t.id), { art: "auto", von: "System", autorArt: "system", ereignis: "Kunde hat selbst gebucht", ergebnis });
    }
  } catch (e) { console.error("[VORSORGE] Aufgabe schließen:", e); }
}

/** „Kein Gespräch gewünscht“ — ein gebuchter Termin wird vorher abgesagt (Widerruf, der Partner erfährt es). */
export async function vorsorgeKeinInteresse(personId: number, name: string, meta: VorsorgeMeta): Promise<VorsorgeLage> {
  await ensureVorsorgeTabellen();
  const { stand } = await standLesen(personId);
  const von = `${name || "Kunde"} (${meta.quelle === "link" ? "persönlicher Link" : "Kundenbereich"})`;
  if (stand === "termin") await koopWiderruf(personId, { name: von, kanal: "kundenbereich", grund: "Kein Gespräch mehr gewünscht (Vorsorge-Überblick)" });
  await koopInteresseVermerken(personId, { ja: false, kanal: "kundenbereich", von, ip: meta.ip, userAgent: meta.userAgent });
  return vorsorgeLage(personId, { kontext: kontextVon(meta.quelle), jetzt: meta.jetzt });
}

/**
 * „Termin nicht mehr gewünscht“ — Widerruf: geplante Übermittlung zurück, der Partner erfährt es sofort.
 * Gutachten 09.11.: Nur ein OFFENER Termin wird abgesagt. Ein zweiter Klick, ein alter Tab oder ein Aufruf ohne Termin tut nichts
 * mehr — keine zweite Mail an den Partner, kein zweiter Eintrag in der Akte (koopWiderruf meldet zudem nur, was eben endete).
 */
export async function vorsorgeAbsagen(personId: number, name: string, meta: VorsorgeMeta): Promise<VorsorgeLage> {
  await ensureVorsorgeTabellen();
  if (await koopOffenerTermin(personId)) {
    await koopWiderruf(personId, {
      name: `${name || "Kunde"} (${meta.quelle === "link" ? "persönlicher Link" : "Kundenbereich"})`, kanal: "kundenbereich",
      grund: meta.quelle === "link" ? "Über den persönlichen Link: Termin nicht mehr gewünscht" : "Im Kundenbereich: Termin nicht mehr gewünscht",
    });
  }
  return vorsorgeLage(personId, { kontext: kontextVon(meta.quelle), jetzt: meta.jetzt });
}
