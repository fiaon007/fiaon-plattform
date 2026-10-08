// ═══════════════════════════════════════════════════════════════════════════
// FIAON FINANZ- UND BONITÄTSAUSWERTUNG — DER ABLAUF (E-IT-D, 08.10.2026, Punkt 4b)
//
// Die Regeln stehen in shared/fiaon-finanzauswertung.ts. Hier: Daten holen,
// Lauf steuern, Texte schreiben lassen, drucken, ablegen, freigeben.
//
//   1. lage()        Voraussetzungen + Fassungen für die Akte
//   2. erzeugen()    legt eine Fassung „laeuft" an (höchstens eine je Person —
//                    Teilindex in der DB) und rechnet im Hintergrund:
//                    Kontoauszug-Analyse (vorhanden, aktuell) → Art.-9-Maske →
//                    Kennzahlen → Ampeln → FIAON-Finanzwert → Schritte →
//                    Einordnung (Modell, nur Sätze mit Platzhaltern; Rückfall:
//                    feste Sätze) → PDF (Chromium, zwei Durchgänge fürs
//                    Inhaltsverzeichnis, kein Notbehelf) → Status „entwurf".
//   3. freigeben()   Betreuer; bei roter Gesamtlage oder Vorbehalt nur Leitung,
//                    ein anderer Mensch (Vier-Augen). Vorige freigegebene Fassung
//                    → „ersetzt" (bleibt sichtbar). Mail finanzauswertung_bereit.
//   4. verwerfen()   mit Grund; nichts wird gelöscht.
//   5. kunde()       die freigegebenen Fassungen für das Portal — eingefroren.
//
// KI: nur ein Faktenblatt ohne Namen, IBAN, Anschrift; Ausweise gehen an kein
// Modell. Kosten je Aufruf in fiaon_ki_nutzung (dienst „finanzauswertung") und
// je Fassung in kosten_cents. In der KI-Pause oder ohne Schlüssel schreibt der
// Server die festen Sätze — eine Fassung bleibt nie halb stehen.
// ═══════════════════════════════════════════════════════════════════════════

import { createHash } from "node:crypto";
import { sqlPool } from "./db-pool";
import { absoluteUrl } from "../fiaon-base-url";
import {
  FA_DIENST, FA_REGEL_VERSION, PLATZHALTER, VORBEHALT_TEXTE, ampelnRechnen, art9Maskieren, auswertungNummer, beratungsWandFunde,
  einordnungRegel, faktenAus, finanzwertRechnen, freigabeRegel, gesamtAmpel, istSichtTyp, kopfAbgleich, platzhalterEinsetzen,
  schritteAus, sparpotenzial, voraussetzungenPruefen, zahlenWandFunde, VERGLEICHSWEGE, BEREICHE,
  type AuskunftEingang, type AuswertungInhalt, type AusweisEingang, type AuszugEingang, type BereichKey, type IdentEingang,
  type Platzhalter, type SichtTyp, type Voraussetzungen,
} from "@shared/fiaon-finanzauswertung";

type Lauf = typeof sqlPool;

// ───────────────────────────────────────────────────────────────────────────
// Tabelle (Migration 100 legt dieselbe an)
// ───────────────────────────────────────────────────────────────────────────
let bereit: Promise<void> | null = null;
export function ensureFinanzauswertungTabellen(): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      const { ensureUnterlagenLinkTabellen } = await import("./fiaon-unterlagen-link");
      await ensureUnterlagenLinkTabellen();
      const [t] = (await sqlPool`SELECT to_regclass('fiaon_finanzauswertungen') IS NOT NULL AS da,
                                        to_regclass('fiaon_finanzauswertungen_eine_frei_idx') IS NOT NULL AS idx`) as any[];
      if (t?.da && t?.idx) return;
      if (t?.da) {
        // Tabelle gibt es schon (älterer Stand): nur den Teilindex „eine Freigabe je Person" nachziehen.
        // Scheitert er (Altdaten), bleibt die Freigabe trotzdem durch Sperre + Statusbedingung geschützt.
        await sqlPool.begin(async (tx: any) => {
          await tx`SET LOCAL lock_timeout = '5s'`;
          await tx`CREATE UNIQUE INDEX IF NOT EXISTS fiaon_finanzauswertungen_eine_frei_idx ON fiaon_finanzauswertungen (person_id) WHERE status = 'freigegeben'`;
        }).catch((e: unknown) => console.error("[FINANZAUSWERTUNG] Index eine Freigabe:", String((e as Error)?.message || e).slice(0, 160)));
        return;
      }
      await sqlPool.begin(async (tx: any) => {
        await tx`SET LOCAL lock_timeout = '5s'`;
        await tx`CREATE TABLE IF NOT EXISTS fiaon_finanzauswertungen (
          id BIGSERIAL PRIMARY KEY, person_id BIGINT NOT NULL, ref TEXT, fassung INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'laeuft' CHECK (status IN ('laeuft', 'entwurf', 'freigegeben', 'ersetzt', 'verworfen', 'fehler')),
          regel_version TEXT, modell TEXT, texte_quelle TEXT, eingaben JSONB, inhalt JSONB, gesamt TEXT, finanzwert INTEGER, band TEXT,
          vorbehalt BOOLEAN NOT NULL DEFAULT FALSE, vier_augen BOOLEAN NOT NULL DEFAULT FALSE, pdf_dokument_id BIGINT,
          erstellt_von TEXT, erstellt_von_id BIGINT, erstellt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(), fertig_am TIMESTAMPTZ,
          freigegeben_von TEXT, freigegeben_von_id BIGINT, freigegeben_am TIMESTAMPTZ,
          verworfen_von TEXT, verworfen_am TIMESTAMPTZ, verworfen_grund TEXT,
          mail_status TEXT, mail_am TIMESTAMPTZ, kunde_gelesen_am TIMESTAMPTZ, kosten_cents NUMERIC, fehler TEXT,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (person_id, fassung))`;
        await tx`CREATE INDEX IF NOT EXISTS fiaon_finanzauswertungen_person_idx ON fiaon_finanzauswertungen (person_id, erstellt_am DESC)`;
        await tx`CREATE UNIQUE INDEX IF NOT EXISTS fiaon_finanzauswertungen_ein_lauf_idx ON fiaon_finanzauswertungen (person_id) WHERE status = 'laeuft'`;
        await tx`CREATE UNIQUE INDEX IF NOT EXISTS fiaon_finanzauswertungen_eine_frei_idx ON fiaon_finanzauswertungen (person_id) WHERE status = 'freigegeben'`;
      });
    })().catch((e) => { bereit = null; throw e; });
  }
  return bereit;
}

const heuteBerlin = (): string => {
  const t = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const g = (a: string) => t.find((p) => p.type === a)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")}`;
};

// ───────────────────────────────────────────────────────────────────────────
// Die Eingaben einer Person
// ───────────────────────────────────────────────────────────────────────────

export interface Eingaben {
  personId: number;
  ref: string | null;
  person: { vorname: string | null; nachname: string | null; strasse: string | null; plz: string | null; ort: string | null };
  angabeEinkommenCents: number | null;
  ausweis: AusweisEingang;
  ausweisHash: string | null;
  auszug: AuszugEingang;
  auszugRef: string | null;
  analyse: any | null;
  schufa: any | null;
  voraussetzungen: Voraussetzungen;
}

/** Prüfwert der Ausweis-Datei der Person (die Sichtprüfung gilt nur für genau diese Datei). */
async function ausweisHashFuer(personId: number, lauf: Lauf): Promise<string | null> {
  const { dokumentTraeger } = await import("./fiaon-dokumente");
  const traeger = await dokumentTraeger({ personId }, "ausweis", lauf);
  if (!traeger) return null;
  const [r] = (await lauf`SELECT encode(sha256(id_card_pdf), 'hex') AS h FROM fiaon_applications WHERE ref = ${traeger} AND id_card_pdf IS NOT NULL LIMIT 1`) as any[];
  return r?.h ? String(r.h) : null;
}

export async function eingabenSammeln(personId: number, lauf: Lauf = sqlPool): Promise<Eingaben | null> {
  await ensureFinanzauswertungTabellen();
  const { dokumentStand } = await import("./fiaon-dokumente");
  const stand = await dokumentStand({ personId, rolle: "admin" }, lauf);
  const [p] = (await lauf`
    SELECT p.first_name, p.last_name, p.street, p.zip, p.city,
           (SELECT a.income FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.income IS NOT NULL
             ORDER BY (a.payment_status = 'paid') DESC, a.created_at DESC LIMIT 1) AS income,
           (SELECT a.street FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL AND COALESCE(TRIM(a.street), '') <> ''
             ORDER BY (a.payment_status = 'paid') DESC, a.created_at DESC LIMIT 1) AS a_street,
           (SELECT a.zip FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL AND COALESCE(TRIM(a.zip), '') <> ''
             ORDER BY (a.payment_status = 'paid') DESC, a.created_at DESC LIMIT 1) AS a_zip
      FROM fiaon_persons p WHERE p.id = ${personId} LIMIT 1`) as any[];
  if (!p) return null;
  const ref = stand?.ref ?? null;
  const dok = (art: string) => stand?.dokumente.find((d) => d.art === art);

  // Ausweis: Urteil der Dokumentprüfung + Sichtprüfung (gebunden an den Prüfwert).
  const ausweisHash = dok("ausweis")?.vorhanden ? await ausweisHashFuer(personId, lauf) : null;
  let urteil: any = null;
  if (dok("ausweis")?.vorhanden) {
    const { dokumentTraeger } = await import("./fiaon-dokumente");
    const { urteileLesen } = await import("./fiaon-dokument-pruefung");
    const t = await dokumentTraeger({ personId }, "ausweis", lauf);
    if (t) urteil = (await urteileLesen([t]).catch(() => ({} as any))).ausweis ?? null;
  }
  const { personFamilie } = await import("./fiaon-unterlagen-link");
  const familie = await personFamilie(personId, lauf);
  const [sicht] = ausweisHash ? (await lauf`
    SELECT dokumenttyp, von, am FROM fiaon_unterlagen_sichtpruefung
     WHERE person_id = ANY(${familie}) AND art = 'ausweis' AND doc_hash = ${ausweisHash} AND widerrufen_am IS NULL
     ORDER BY am DESC LIMIT 1`) as any[] : [];
  const ausweis: AusweisEingang = {
    vorhanden: !!dok("ausweis")?.vorhanden,
    urteil: urteil ? { erkannt: urteil.erkannt ?? null, vollstaendig: urteil.vollstaendig ?? null, pruefbar: urteil.pruefbar, fehlt: urteil.fehlt ?? [], hinweisIntern: urteil.hinweisIntern ?? null, dokumenttyp: urteil.dokumenttyp ?? null } : null,
    sicht: sicht && istSichtTyp(sicht.dokumenttyp) ? { dokumenttyp: sicht.dokumenttyp, von: sicht.von ?? null, am: new Date(sicht.am).toISOString() } : null,
  };

  // Kontoauszug: die jüngste Analyse der Person.
  let analyse: any = null;
  let version: number | null = null;
  let auszugRef: string | null = null;
  if (dok("kontoauszug")?.vorhanden && ref) {
    const { analyseFuer } = await import("./fiaon-kontoauszug-analyse");
    analyse = await analyseFuer(ref).catch(() => null);
    if (analyse) {
      const [v] = (await lauf`SELECT auswertung_version, ref FROM fiaon_kontoauszug_analysen WHERE id = ${analyse.id}`.catch(() => [])) as any[];
      version = v?.auswertung_version != null ? Number(v.auswertung_version) : null;
      auszugRef = v?.ref ?? null;
    }
  }
  const { AUSWERTUNG_VERSION } = await import("./fiaon-kontoauszug-analyse");
  const auszug: AuszugEingang = {
    vorhanden: !!dok("kontoauszug")?.vorhanden,
    analyse: analyse ? {
      status: analyse.status, version, zeitraumVon: analyse.zeitraumVon, zeitraumBis: analyse.zeitraumBis, nebenkonto: !!analyse.nebenkonto,
      buchungsTage: (analyse.buchungen ?? []).map((b: any) => String(b.datum)), pruefung: analyse.pruefung ? { stimmt: analyse.pruefung.stimmt ?? null, differenzCents: analyse.pruefung.differenzCents ?? null } : null,
      fehler: analyse.fehler ?? null,
    } : null,
  };

  // Auskunft (freiwillig).
  let schufa: any = null;
  if (ref) {
    const { schufaAnalyseFuer } = await import("./fiaon-schufa-analyse");
    schufa = await schufaAnalyseFuer(ref).catch(() => null);
  }

  const voraussetzungen = voraussetzungenPruefen({
    ausweis, auszug, auskunft: schufa ? { status: schufa.status } : null, heuteIso: heuteBerlin(), aktuelleVersion: AUSWERTUNG_VERSION,
  });
  const income = Number(p.income);
  return {
    personId, ref,
    person: {
      vorname: p.first_name ?? null, nachname: p.last_name ?? null,
      strasse: (String(p.street ?? "").trim() || p.a_street) ?? null, plz: (String(p.zip ?? "").trim() || p.a_zip) ?? null, ort: p.city ?? null,
    },
    angabeEinkommenCents: Number.isFinite(income) && income > 0 ? Math.round(income * 100) : null,
    ausweis, ausweisHash, auszug, auszugRef, analyse, schufa, voraussetzungen,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Lage für die Akte
// ───────────────────────────────────────────────────────────────────────────

export interface FassungKurz {
  id: number; fassung: number; nummer: string; status: string; erstelltAm: string; erstelltVon: string | null; erstelltVonId: number | null;
  freigegebenAm: string | null; freigegebenVon: string | null; verworfenGrund: string | null;
  gesamt: string | null; finanzwert: number | null; band: string | null; vorbehalt: boolean; vierAugen: boolean;
  texteQuelle: string | null; fehler: string | null; mailStatus: string | null; kundeGelesenAm: string | null; kostenCents: number | null;
  pdf: boolean;
}

function kurz(r: any): FassungKurz {
  return {
    id: Number(r.id), fassung: Number(r.fassung), nummer: auswertungNummer(Number(r.person_id), Number(r.fassung)), status: String(r.status),
    erstelltAm: new Date(r.erstellt_am).toISOString(), erstelltVon: r.erstellt_von ?? null, erstelltVonId: r.erstellt_von_id != null ? Number(r.erstellt_von_id) : null,
    freigegebenAm: r.freigegeben_am ? new Date(r.freigegeben_am).toISOString() : null, freigegebenVon: r.freigegeben_von ?? null,
    verworfenGrund: r.verworfen_grund ?? null, gesamt: r.gesamt ?? null, finanzwert: r.finanzwert != null ? Number(r.finanzwert) : null,
    band: r.band ?? null, vorbehalt: !!r.vorbehalt, vierAugen: !!r.vier_augen, texteQuelle: r.texte_quelle ?? null, fehler: r.fehler ?? null,
    mailStatus: r.mail_status ?? null, kundeGelesenAm: r.kunde_gelesen_am ? new Date(r.kunde_gelesen_am).toISOString() : null,
    kostenCents: r.kosten_cents != null ? Number(r.kosten_cents) : null, pdf: r.pdf_dokument_id != null,
  };
}

/** Eingabe-Fingerabdruck: ändert sich, sobald eine neue Unterlage oder Analyse da ist („veraltet"). */
function eingabenHash(e: Eingaben): string {
  const roh = JSON.stringify({ a: e.analyse?.id ?? null, ae: e.analyse?.erstelltAm ?? null, s: e.schufa?.id ?? null, h: e.ausweisHash, si: e.ausweis.sicht?.am ?? null });
  return createHash("sha256").update(roh).digest("hex").slice(0, 24);
}

export async function lage(personId: number, lauf: Lauf = sqlPool): Promise<{
  voraussetzungen: Voraussetzungen | null; fassungen: FassungKurz[]; laeuft: FassungKurz | null; veraltet: boolean;
  sicht: { dokumenttyp: SichtTyp; von: string | null; am: string } | null; ausweisVorhanden: boolean;
  anfragen: { am: string; arten: string[]; mail: string | null; whatsapp: string | null; adresse: string | null; von: string | null }[];
  /** Der gültige Upload-Link (ohne Token) — für „Link zurückziehen“ in der Akte (Nachprüfung 08.10.). */
  links: { id: number; arten: string[]; gueltigBis: string; nutzungen: number; dateien: number; erstelltVon: string | null }[];
}> {
  await ensureFinanzauswertungTabellen();
  // Liegengebliebene Läufe (Neustart mitten im Lauf) nach 15 Minuten freigeben — sonst sperrte der Teilindex die Person.
  await lauf`UPDATE fiaon_finanzauswertungen SET status = 'fehler', fehler = 'Lauf unterbrochen (Neustart) — bitte neu erzeugen.', updated_at = NOW()
              WHERE person_id = ${personId} AND status = 'laeuft' AND erstellt_am < NOW() - INTERVAL '15 minutes'`;
  const e = await eingabenSammeln(personId, lauf);
  // Nachprüfung 08.10.: auch Fassungen und Anfragen einer in diese Person zusammengeführten Dublette.
  const { personFamilie } = await import("./fiaon-unterlagen-link");
  const familie = await personFamilie(personId, lauf);
  const zeilen = (await lauf`SELECT * FROM fiaon_finanzauswertungen WHERE person_id = ANY(${familie}) ORDER BY erstellt_am DESC LIMIT 20`) as any[];
  const fassungen = zeilen.map(kurz);
  const letzte = zeilen.find((z) => z.status === "entwurf" || z.status === "freigegeben");
  const veraltet = !!(letzte && e && (letzte.eingaben?.hash ?? null) !== eingabenHash(e));
  const anfragen = ((await lauf`
    SELECT am, arten, mail_status, whatsapp_status, adresse, von FROM fiaon_unterlagen_anfragen
     WHERE person_id = ANY(${familie}) ORDER BY am DESC LIMIT 5`) as any[]).map((r) => ({
    am: new Date(r.am).toISOString(), arten: r.arten ?? [], mail: r.mail_status ?? null, whatsapp: r.whatsapp_status ?? null, adresse: r.adresse ?? null, von: r.von ?? null,
  }));
  const links = ((await lauf`
    SELECT id, arten, gueltig_bis, nutzungen, dateien, erstellt_von FROM fiaon_unterlagen_links
     WHERE person_id = ANY(${familie}) AND widerrufen_am IS NULL AND gueltig_bis > NOW() ORDER BY erstellt_am DESC LIMIT 3`) as any[]).map((r) => ({
    id: Number(r.id), arten: r.arten ?? [], gueltigBis: new Date(r.gueltig_bis).toISOString(), nutzungen: Number(r.nutzungen || 0),
    dateien: Number(r.dateien || 0), erstelltVon: r.erstellt_von ?? null,
  }));
  return {
    voraussetzungen: e?.voraussetzungen ?? null, fassungen, laeuft: fassungen.find((f) => f.status === "laeuft") ?? null, veraltet,
    sicht: e?.ausweis.sicht ?? null, ausweisVorhanden: !!e?.ausweis.vorhanden, anfragen, links,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Sichtprüfung des Ausweises (ohne Modell — ein Mensch sieht hin)
// ───────────────────────────────────────────────────────────────────────────

export async function sichtpruefungSetzen(
  personId: number, dokumenttyp: unknown, wer: { name: string; agentId: number }, lauf: Lauf = sqlPool,
): Promise<{ ok: boolean; text: string }> {
  await ensureFinanzauswertungTabellen();
  if (!istSichtTyp(dokumenttyp)) return { ok: false, text: "Bitte wählen: Reisepass, Personalausweis (beide Seiten) oder Aufenthaltstitel mit Reisepass." };
  const hash = await ausweisHashFuer(personId, lauf);
  if (!hash) return { ok: false, text: "Zu diesem Kunden liegt kein Ausweis vor." };
  await lauf`
    INSERT INTO fiaon_unterlagen_sichtpruefung (person_id, art, doc_hash, dokumenttyp, von, von_id)
    VALUES (${personId}, 'ausweis', ${hash}, ${dokumenttyp}, ${wer.name}, ${wer.agentId})`;
  const { SICHT_TYP_TEXT } = await import("@shared/fiaon-finanzauswertung");
  await lauf`
    INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
    VALUES ((SELECT ref FROM fiaon_applications WHERE person_id = ${personId} AND merged_into IS NULL ORDER BY created_at DESC LIMIT 1),
            ${personId}, ${wer.agentId}, ${wer.name}, 'system',
            ${`Ausweis von Hand geprüft: ${SICHT_TYP_TEXT[dokumenttyp]} — Name passt zur Akte, gültig. Gilt für genau diese Datei (Prüfwert ${hash.slice(0, 12)}…).`})`.catch(() => {});
  return { ok: true, text: `Ausweis bestätigt: ${SICHT_TYP_TEXT[dokumenttyp]}.` };
}

/**
 * Nimmt die Sichtprüfung des Ausweises zurück (Nachprüfung 08.10.2026): Eine Fehlbestätigung schaltete die
 * Auswertung frei und ließ sich nicht zurücknehmen. Danach gilt der Ausweis wieder als ungeprüft; ein
 * offener Entwurf wird über den Eingaben-Prüfwert „veraltet“ und lässt sich nicht mehr übergeben.
 */
export async function sichtpruefungZuruecknehmen(
  personId: number, grund: unknown, wer: { name: string; agentId: number }, lauf: Lauf = sqlPool,
): Promise<{ ok: boolean; text: string }> {
  await ensureFinanzauswertungTabellen();
  const g = String(grund ?? "").trim().slice(0, 300);
  if (g.length < 3) return { ok: false, text: "Bitte kurz begründen, warum die Bestätigung nicht gilt (steht im Verlauf)." };
  const { personFamilie } = await import("./fiaon-unterlagen-link");
  const familie = await personFamilie(personId, lauf);
  const weg = (await lauf`
    UPDATE fiaon_unterlagen_sichtpruefung SET widerrufen_am = NOW()
     WHERE person_id = ANY(${familie}) AND art = 'ausweis' AND widerrufen_am IS NULL
     RETURNING dokumenttyp, von`) as any[];
  if (!weg.length) return { ok: false, text: "Es gibt keine Bestätigung des Ausweises, die noch gilt." };
  const { SICHT_TYP_TEXT } = await import("@shared/fiaon-finanzauswertung");
  const was = weg.map((w) => `${SICHT_TYP_TEXT[w.dokumenttyp as SichtTyp] ?? w.dokumenttyp}${w.von ? `, bestätigt von ${w.von}` : ""}`).join("; ");
  await lauf`
    INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
    VALUES ((SELECT ref FROM fiaon_applications WHERE person_id = ${personId} AND merged_into IS NULL ORDER BY created_at DESC LIMIT 1),
            ${personId}, ${wer.agentId}, ${wer.name}, 'system',
            ${`Ausweis-Bestätigung von Hand zurückgenommen (${was}). Grund: ${g}. Der Ausweis gilt wieder als ungeprüft.`})`.catch(() => {});
  return { ok: true, text: "Bestätigung zurückgenommen — der Ausweis gilt wieder als ungeprüft." };
}

// ───────────────────────────────────────────────────────────────────────────
// Die Einordnung durch das Modell — Sätze mit Platzhaltern, nie Zahlen
// ───────────────────────────────────────────────────────────────────────────

const EINORDNUNG_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    zusammenfassung: { type: "string" },
    bereiche: {
      type: "object", additionalProperties: false,
      properties: Object.fromEntries(BEREICHE.map((b) => [b.key, { type: "string" }])),
      required: BEREICHE.map((b) => b.key),
    },
  },
  required: ["zusammenfassung", "bereiche"],
};

const EINORDNUNG_ANWEISUNG = [
  "Du schreibst für FIAON die persönliche Einordnung einer Finanzauswertung. Leser ist der Kunde selbst.",
  "Regeln, ausnahmslos:",
  "· Sie-Form, ruhig, sachlich, wertschätzend, kurze Sätze. Kein Urteil über den Menschen.",
  "· KEINE Ziffern. Zahlen nur als Platzhalter: {{z:einkommen}}, {{z:ausgaben}}, {{z:ueberschuss}}, {{z:fixkosten}}, {{z:fixquote}}, {{z:raten}}, {{z:ratenquote}}, {{z:finanzwert}}, {{z:band}}, {{z:sparpotenzial}}, {{z:zeitraum}}.",
  "· Keine Empfehlung für Kredite, Umschuldung, Versicherungen oder Geldanlagen, keine Produkte oder Anbieter, keine Zusage (nicht „garantiert“, nicht „Sie bekommen die Karte“).",
  "· Keine Rechtsauskunft zu einzelnen Forderungen. Kein Vergleich mit einem SCHUFA-Score.",
  "· zusammenfassung: zwei bis vier Sätze zur Gesamtlage. bereiche: je Bereich ein bis zwei Sätze, die die Ampel und ihren Grund in eigenen Worten erklären.",
].join("\n");

async function einordnungDurchModell(fakten: Record<string, unknown>): Promise<{ text: { zusammenfassung: string; bereiche: Record<string, string> } | null; modell: string | null; kostenCents: number; fehler: string | null }> {
  if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) return { text: null, modell: null, kostenCents: 0, fehler: "kein KI-Schlüssel" };
  const modell = process.env.FIAON_FINANZAUSWERTUNG_MODELL || "gpt-4.1";
  const { openaiFetch, istKiPause } = await import("./fiaon-ki-pause");
  const { nutzungMerken, kostenCentsAus } = await import("./fiaon-postmeister-schema");
  let kosten = 0;
  let nachricht = JSON.stringify(fakten);
  let letzterFehler: string | null = null;
  for (let versuch = 0; versuch < 2; versuch++) {
    const start = Date.now();
    try {
      const r = await openaiFetch(FA_DIENST, "/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ""}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modell, temperature: 0.2,
          response_format: { type: "json_schema", json_schema: { name: "einordnung", strict: true, schema: EINORDNUNG_SCHEMA } },
          messages: [{ role: "system", content: EINORDNUNG_ANWEISUNG }, { role: "user", content: nachricht }],
        }),
      });
      const j: any = await r.json().catch(() => null);
      if (!r.ok) throw new Error(`KI ${r.status}: ${j?.error?.message || "unbekannt"}`);
      const usage = j?.usage;
      kosten += kostenCentsAus(String(usage?._modell ?? modell), usage);
      await nutzungMerken({ dienst: FA_DIENST, modell: String(usage?._modell ?? modell), usage, dauerMs: Date.now() - start, ok: true });
      const daten = JSON.parse(String(j?.choices?.[0]?.message?.content || "{}"));
      const funde: string[] = [];
      const alle: string[] = [String(daten?.zusammenfassung ?? ""), ...BEREICHE.map((b) => String(daten?.bereiche?.[b.key] ?? ""))];
      for (const t of alle) funde.push(...zahlenWandFunde(t), ...beratungsWandFunde(t));
      if (!funde.length && alle.every((t) => t.trim().length > 10)) return { text: daten, modell: String(usage?._modell ?? modell), kostenCents: kosten, fehler: null };
      letzterFehler = `Wand: ${Array.from(new Set(funde)).join(", ") || "leere Felder"}`;
      nachricht = `${JSON.stringify(fakten)}\n\nDein letzter Entwurf verstieß gegen die Regeln (${letzterFehler}). Schreibe ihn neu — ohne Ziffern, nur Platzhalter.`;
    } catch (e) {
      letzterFehler = String((e as Error)?.message || e).slice(0, 200);
      await nutzungMerken({ dienst: FA_DIENST, modell, dauerMs: Date.now() - start, ok: false, fehler: letzterFehler }).catch(() => {});
      if (istKiPause(e)) return { text: null, modell, kostenCents: kosten, fehler: "KI pausiert" };
    }
  }
  return { text: null, modell, kostenCents: kosten, fehler: letzterFehler };
}

// ───────────────────────────────────────────────────────────────────────────
// Erzeugen
// ───────────────────────────────────────────────────────────────────────────

/** Für den Prüfstand: das Modell und den Druck ersetzen (kein Netz, kein Chromium nötig). */
export interface Abhaengigkeiten {
  einordnung?: (fakten: Record<string, unknown>) => ReturnType<typeof einordnungDurchModell>;
  drucken?: (inhalt: AuswertungInhalt) => Promise<Buffer>;
  kopfText?: (personId: number) => Promise<string | null>;
}

async function kopfTextFuer(personId: number, lauf: Lauf): Promise<string | null> {
  const { dokumentTraeger } = await import("./fiaon-dokumente");
  const t = await dokumentTraeger({ personId }, "kontoauszug", lauf);
  if (!t) return null;
  const [r] = (await lauf`SELECT bank_statement_pdf AS d FROM fiaon_applications WHERE ref = ${t} LIMIT 1`) as any[];
  if (!r?.d) return null;
  const buf = Buffer.from(r.d);
  if (!buf.subarray(0, 1024).includes("%PDF", 0, "latin1")) return null;
  try {
    const { pdfTextJeSeite } = await import("./fiaon-pdf-lesen");
    const seiten = await pdfTextJeSeite(buf);
    // Kopf = erste Seite (und der Anfang der zweiten, falls die erste nur ein Deckblatt ist).
    return `${seiten[0] ?? ""} ${(seiten[1] ?? "").slice(0, 1500)}`.slice(0, 6000);
  } catch {
    return null;
  }
}

/** Den eingefrorenen Inhalt rechnen — ohne Datenbank (Prüfstand ruft ihn direkt). */
export function inhaltRechnen(e: {
  personId: number; fassung: number; person: Eingaben["person"]; analyse: any; schufa: any; voraussetzungen: Voraussetzungen;
  angabeEinkommenCents: number | null; kopf: { inhaber: boolean | null; adresse: boolean | null }; ausweisTyp: string | null;
}): Omit<AuswertungInhalt, "einordnung" | "texteQuelle"> & { faktenblatt: Record<string, unknown>; platzhalter: Partial<Record<Platzhalter, string>> } | null {
  const masken = art9Maskieren(e.analyse?.buchungen ?? []);
  const f = faktenAus(masken.buchungen, { zeitraumVon: e.analyse?.zeitraumVon, zeitraumBis: e.analyse?.zeitraumBis }, masken.anzahl);
  if (!f) return null;
  const ident: IdentEingang = { ausweisOk: e.voraussetzungen.ausweis.ok, ausweisTyp: e.ausweisTyp, adresseImAuszug: e.kopf.adresse, inhaberImAuszug: e.kopf.inhaber };
  const s = e.schufa?.status === "fertig" ? e.schufa : null;
  const auskunft: AuskunftEingang | null = s ? {
    stufe: s.ampel ?? null, auskunftei: s.auskunftei ?? null, vom: s.auskunftVom ?? null,
    negativ: Array.isArray(s.eintraege) ? s.eintraege.length : 0, offenCents: s.summeOffenCents ?? null,
  } : null;
  const ampeln = ampelnRechnen(f, ident, auskunft, e.angabeEinkommenCents);
  const fw = finanzwertRechnen(f, ampeln, auskunft);
  const gesamt = gesamtAmpel(ampeln, fw.band);
  const schritte = schritteAus(f);
  const spar = sparpotenzial(schritte);
  const vorbehalte = [...e.voraussetzungen.vorbehalte];
  if (e.kopf.inhaber === false && !vorbehalte.includes("inhaber")) vorbehalte.push("inhaber");
  const pruefvermerke: string[] = [];
  const cent = e.voraussetzungen.kontoauszug.cent;
  pruefvermerke.push(cent === "stimmt" ? "Cent-Prüfung: Anfangssaldo und Buchungen ergeben den Endsaldo." : cent === "abweichung" ? "Cent-Prüfung: nicht vollständig abgeglichen (siehe Vorbehalt)." : "Cent-Prüfung: Der Auszug nennt keine Salden — die Summe ist nicht gegengerechnet.");
  pruefvermerke.push(e.kopf.inhaber === true ? "Kontoinhaber: Ihr Name steht im Kopf des Auszugs." : e.kopf.inhaber === false ? "Kontoinhaber: Ihr Name war im Kopf des Auszugs nicht zu finden (siehe Vorbehalt)." : "Kontoinhaber: maschinell nicht prüfbar (Foto oder Scan).");
  if (masken.anzahl) pruefvermerke.push(`${masken.anzahl} Buchung${masken.anzahl === 1 ? "" : "en"} ohne Empfänger und Zweck ausgewertet (besondere Kategorien, Art. 9 DSGVO).`);
  const eur = (c: number) => `${Math.round(c / 100).toLocaleString("de-DE")} €`;
  const pct = (q: number) => `${Math.round(q * 100)} %`;
  const zr = `${f.zeitraum.von.split("-").reverse().join(".")}–${f.zeitraum.bis.split("-").reverse().join(".")}`;
  const platzhalter: Partial<Record<Platzhalter, string>> = {
    einkommen: eur(f.einkommenJeMonatCents), ausgaben: eur(f.ausgabenJeMonatCents), ueberschuss: eur(f.ueberschussJeMonatCents),
    fixkosten: eur(f.festJeMonatCents), fixquote: pct(f.fixkostenQuote), raten: eur(f.ratenJeMonatCents), ratenquote: pct(f.ratenQuote),
    finanzwert: String(fw.wert), band: fw.band, sparpotenzial: spar.bisCents > 0 ? `bis zu ${eur(spar.bisCents)}` : "keine nennenswerte Summe", zeitraum: zr,
  };
  void PLATZHALTER;
  // Das Faktenblatt für das Modell: keine Namen, keine IBAN, keine Anschrift, keine Empfänger — nur Lage und Gründe.
  const faktenblatt = {
    gesamt: { ampel: gesamt.ampel, grund: gesamt.grund, band: fw.band },
    bereiche: ampeln.map((a) => ({ bereich: a.key, titel: a.titel, ampel: a.ampel, grund: a.grund.replace(/\d[\d.,]*\s?(%|€)?/g, "[Zahl]") })),
    einkommen_quelle: f.einkommenQuelle, schritte: schritte.map((x) => x.titel), vorbehalt: vorbehalte.length > 0,
    platzhalter_erlaubt: PLATZHALTER,
  };
  return {
    regelVersion: FA_REGEL_VERSION, nummer: auswertungNummer(e.personId, e.fassung), fassung: e.fassung, erstelltAm: new Date().toISOString(),
    kunde: { vorname: e.person.vorname, nachname: e.person.nachname },
    zeitraum: { von: f.zeitraum.von, bis: f.zeitraum.bis, tage: f.zeitraum.tage },
    fakten: f, ampeln, gesamt, finanzwert: fw, schritte, sparpotenzial: spar, vergleichswege: VERGLEICHSWEGE, auskunft,
    vorbehalte, pruefvermerke, ausweisTyp: e.ausweisTyp, faktenblatt, platzhalter,
  };
}

/**
 * Eine neue Fassung erzeugen — gibt sofort zurück; der Lauf rechnet im Hintergrund.
 * Doppelklick: der laufende Lauf kommt zurück, kein zweiter.
 */
export async function erzeugen(
  personId: number, wer: { name: string; agentId: number | null }, deps: Abhaengigkeiten = {}, lauf: Lauf = sqlPool,
  opts: { warten?: boolean } = {},
): Promise<{ ok: boolean; text: string; id?: number; status?: string }> {
  await ensureFinanzauswertungTabellen();
  const e = await eingabenSammeln(personId, lauf);
  if (!e) return { ok: false, text: "Kunde nicht gefunden." };
  if (!e.voraussetzungen.bereit) {
    const fehlt = [!e.voraussetzungen.ausweis.ok ? e.voraussetzungen.ausweis.satz : null, !e.voraussetzungen.kontoauszug.ok ? e.voraussetzungen.kontoauszug.satz : null].filter(Boolean).join(" ");
    return { ok: false, text: `Voraussetzungen fehlen: ${fehlt}` };
  }
  const [lauft] = (await lauf`SELECT id FROM fiaon_finanzauswertungen WHERE person_id = ${personId} AND status = 'laeuft' LIMIT 1`) as any[];
  if (lauft) return { ok: true, text: "Die Auswertung läuft schon.", id: Number(lauft.id), status: "laeuft" };
  // Doppelklick nach einem schnellen Lauf: Ein Entwurf aus denselben Unterlagen, keine zwei Minuten alt, kommt zurück.
  const hash = eingabenHash(e);
  const [frisch] = (await lauf`
    SELECT id FROM fiaon_finanzauswertungen
     WHERE person_id = ${personId} AND status = 'entwurf' AND erstellt_am > NOW() - INTERVAL '2 minutes'
       AND (CASE WHEN jsonb_typeof(eingaben) = 'object' THEN eingaben->>'hash' ELSE NULL END) = ${hash}
     ORDER BY id DESC LIMIT 1`) as any[];
  if (frisch) return { ok: true, text: "Diese Auswertung wurde eben erzeugt — der Entwurf steht unten.", id: Number(frisch.id), status: "entwurf" };
  let id: number;
  let fassung: number;
  try {
    const [neu] = (await lauf`
      INSERT INTO fiaon_finanzauswertungen (person_id, ref, fassung, status, regel_version, erstellt_von, erstellt_von_id, eingaben)
      SELECT ${personId}, ${e.ref}, COALESCE(MAX(fassung), 0) + 1, 'laeuft', ${FA_REGEL_VERSION}, ${wer.name}, ${wer.agentId},
             ${sqlPool.json({ hash, analyseId: e.analyse?.id ?? null, schufaId: e.schufa?.id ?? null, ausweisHash: e.ausweisHash?.slice(0, 16) ?? null } as any)}
        FROM fiaon_finanzauswertungen WHERE person_id = ${personId}
      RETURNING id, fassung`) as any[];
    id = Number(neu.id); fassung = Number(neu.fassung);
  } catch (err) {
    // Teilindex „ein Lauf je Person" — ein zweiter Klick zur selben Zeit.
    const [l] = (await lauf`SELECT id FROM fiaon_finanzauswertungen WHERE person_id = ${personId} AND status = 'laeuft' LIMIT 1`) as any[];
    if (l) return { ok: true, text: "Die Auswertung läuft schon.", id: Number(l.id), status: "laeuft" };
    throw err;
  }
  const arbeit = laufDurchfuehren(id, fassung, e, wer, deps, lauf).catch(async (err) => {
    console.error(`[FINANZAUSWERTUNG] #${id}:`, err);
    await lauf`UPDATE fiaon_finanzauswertungen SET status = 'fehler', fehler = ${String((err as Error)?.message || err).slice(0, 400)}, updated_at = NOW() WHERE id = ${id} AND status = 'laeuft'`.catch(() => {});
  });
  if (opts.warten) await arbeit;
  return { ok: true, text: "Die Auswertung wird erstellt — das dauert ein bis zwei Minuten.", id, status: "laeuft" };
}

async function laufDurchfuehren(id: number, fassung: number, e: Eingaben, wer: { name: string; agentId: number | null }, deps: Abhaengigkeiten, lauf: Lauf): Promise<void> {
  const kopfRoh = deps.kopfText ? await deps.kopfText(e.personId) : await kopfTextFuer(e.personId, lauf);
  const kopf = kopfRoh ? kopfAbgleich(kopfRoh, e.person) : { inhaber: null, adresse: null };
  const basis = inhaltRechnen({
    personId: e.personId, fassung, person: e.person, analyse: e.analyse, schufa: e.schufa, voraussetzungen: e.voraussetzungen,
    angabeEinkommenCents: e.angabeEinkommenCents, kopf, ausweisTyp: e.voraussetzungen.ausweis.typ,
  });
  if (!basis) throw new Error("Im Kontoauszug sind keine Buchungen lesbar — bitte den Kontoauszug neu auswerten.");
  const { faktenblatt, platzhalter, ...rest } = basis;
  const regel = einordnungRegel(rest.ampeln, rest.finanzwert, rest.gesamt);
  const ki = await (deps.einordnung ?? einordnungDurchModell)(faktenblatt);
  let einordnung = regel;
  let texteQuelle: "ki" | "regel" = "regel";
  if (ki.text) {
    const bereiche: Partial<Record<BereichKey, string>> = {};
    for (const b of BEREICHE) {
      const t = String(ki.text.bereiche?.[b.key] ?? "");
      bereiche[b.key] = zahlenWandFunde(t).length || beratungsWandFunde(t).length ? regel.bereiche[b.key] : platzhalterEinsetzen(t, platzhalter);
    }
    const z = String(ki.text.zusammenfassung ?? "");
    einordnung = { zusammenfassung: zahlenWandFunde(z).length || beratungsWandFunde(z).length ? regel.zusammenfassung : platzhalterEinsetzen(z, platzhalter), bereiche };
    texteQuelle = "ki";
  } else {
    rest.pruefvermerke.push(`Einordnung mit festen Sätzen geschrieben (${ki.fehler ?? "ohne Modell"}).`);
  }
  const inhalt: AuswertungInhalt = { ...rest, einordnung, texteQuelle };
  const pdf = deps.drucken ? await deps.drucken(inhalt) : await (await import("./fiaon-finanzauswertung-pdf")).finanzauswertungDrucken(inhalt);
  const hash = createHash("sha256").update(pdf).digest("hex");
  const [d] = (await lauf`
    INSERT INTO fiaon_dokumente (person_id, ref, art, dateiname, mime, bytes, inhalt, quelle, doc_hash)
    VALUES (${e.personId}, ${e.ref}, 'finanzauswertung', ${`FIAON-Finanzauswertung-${inhalt.nummer}.pdf`}, 'application/pdf', ${pdf.length}, ${pdf}, 'erzeugt', ${hash})
    RETURNING id`) as any[];
  const vorbehalt = inhalt.vorbehalte.length > 0;
  await lauf`
    UPDATE fiaon_finanzauswertungen
       SET status = 'entwurf', inhalt = ${sqlPool.json(inhalt as any)}, gesamt = ${inhalt.gesamt.ampel}, finanzwert = ${inhalt.finanzwert.wert},
           band = ${inhalt.finanzwert.band}, vorbehalt = ${vorbehalt}, vier_augen = ${vorbehalt || inhalt.gesamt.ampel === "rot"},
           pdf_dokument_id = ${Number(d.id)}, modell = ${ki.modell}, texte_quelle = ${texteQuelle}, kosten_cents = ${ki.kostenCents},
           fertig_am = NOW(), updated_at = NOW()
     WHERE id = ${id}`;
  await lauf`
    INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
    VALUES (${e.ref}, ${e.personId}, ${wer.agentId}, ${wer.name}, 'system',
            ${`Finanz- und Bonitätsauswertung ${inhalt.nummer} als Entwurf erzeugt (Gesamt ${inhalt.gesamt.ampel}, FIAON-Finanzwert ${inhalt.finanzwert.wert}${vorbehalt ? ", mit Vorbehalt" : ""}). Wartet auf Vorschau und Freigabe.`})`.catch(() => {});
  // Vier-Augen-Entwurf → EINE Aufgabe an die Leitung; ältere Entwürfe geben ihre Aufgabe ab (Integration 08.10.2026).
  await vierAugenAufgabenAbgleichen(e.personId, lauf);
}

// ───────────────────────────────────────────────────────────────────────────
// VIER AUGEN ERREICHEN DIE LEITUNG (Integration 08.10.2026 — offener Fund der Nachprüfung zu Strang d)
//
// Bei roter Gesamtlage oder Vorbehalt darf nur die Leitung freigeben (freigabeRegel) — der Betreuer sah aber nur
// einen gesperrten Knopf, und die Leitung erfuhr nichts: Die im Paket enthaltene Auswertung blieb liegen
// („erledigt heißt bedienbar“). Jetzt bekommt die Leitung EINE Aufgabe je Entwurf, wie die anderen
// Leitungs-Aufgaben im Haus (auftragFuerKunden, Schlüssel → idempotent):
//   · an eine Vertriebsleitung (aktiv, echt, offener Zugang) mit der kleinsten Last, die den Entwurf NICHT selbst
//     erzeugt hat (Vier-Augen) — gibt es keine, aufs Board des Betreibers;
//   · sie gehört dem System: Freigeben, Verwerfen oder eine neuere Fassung erledigen sie von selbst, mit Satz.
// ───────────────────────────────────────────────────────────────────────────
export const VIER_AUGEN_SCHLUESSEL = (fassungId: number): string => `finanzauswertung-freigabe:${fassungId}`;

async function vierAugenLeitung(erstellerId: number | null, lauf: Lauf): Promise<number | null> {
  const [l] = (await lauf`
    SELECT ag.id,
           (SELECT COUNT(*)::int FROM fiaon_betreiber_todos t WHERE t.zustaendig_agent_id = ag.id AND t.status <> 'erledigt') AS offene
      FROM fiaon_agents ag
     WHERE COALESCE(ag.active, TRUE) = TRUE AND ag.rolle = 'vertriebsleiter' AND COALESCE(ag.is_test_account, FALSE) = FALSE
       AND ag.zugang_gesperrt_am IS NULL AND ag.id <> ${erstellerId ?? -1}
     ORDER BY offene ASC, ag.id ASC LIMIT 1`.catch(() => [])) as any[];
  return l?.id ? Number(l.id) : null;
}

/**
 * Gleicht die Vier-Augen-Aufgaben einer Person (samt zusammengeführter Dubletten) mit ihren Fassungen ab: Der jüngste
 * Entwurf mit Vier-Augen hat genau EINE offene Aufgabe; jede andere (freigegeben, verworfen, ersetzt, fehlerhaft oder
 * durch eine neuere Fassung überholt) ist erledigt. Idempotent; wirft nie (die Auswertung selbst ist schon gebucht).
 */
export async function vierAugenAufgabenAbgleichen(personId: number, lauf: Lauf = sqlPool): Promise<{ angelegt: boolean; erledigt: number }> {
  const erg = { angelegt: false, erledigt: 0 };
  try {
    const [tab] = (await lauf`SELECT to_regclass('public.fiaon_betreiber_todos') IS NOT NULL AS da`) as any[];
    if (!tab?.da) return erg;
    const { personFamilie } = await import("./fiaon-unterlagen-link");
    const familie = await personFamilie(personId, lauf);
    const fassungen = (await lauf`
      SELECT id, person_id, ref, fassung, status, vier_augen, vorbehalt, gesamt, erstellt_von, erstellt_von_id, freigegeben_von, verworfen_von,
             CASE WHEN jsonb_typeof(inhalt) = 'object' THEN inhalt->'vorbehalte' ELSE NULL END AS vorbehalte
        FROM fiaon_finanzauswertungen WHERE person_id = ANY(${familie}) ORDER BY id DESC`) as any[];
    if (!fassungen.length) return erg;
    const juengste = fassungen.find((f) => f.status !== "laeuft") ?? null;
    const nummer = (f: any) => auswertungNummer(Number(f.person_id), Number(f.fassung));

    // 1. Offene Aufgaben, deren Entwurf nicht mehr auf die Leitung wartet, erledigen.
    const offen = (await lauf`
      SELECT id, schluessel FROM fiaon_betreiber_todos
       WHERE status <> 'erledigt' AND schluessel = ANY(${fassungen.map((f) => VIER_AUGEN_SCHLUESSEL(Number(f.id)))}::text[])`) as any[];
    if (offen.length) {
      const { auftragErledigen } = await import("./fiaon-auftraege");
      for (const t of offen) {
        const f = fassungen.find((x) => VIER_AUGEN_SCHLUESSEL(Number(x.id)) === String(t.schluessel));
        if (!f) continue;
        const grund = f.status === "freigegeben" ? `von ${f.freigegeben_von ?? "der Leitung"} freigegeben`
          : f.status === "verworfen" ? `von ${f.verworfen_von ?? "der Leitung"} verworfen`
          : f.status === "ersetzt" ? "durch eine neuere Freigabe ersetzt"
          : f.status === "fehler" ? "beim Erzeugen gescheitert"
          : juengste && Number(juengste.id) !== Number(f.id) ? `durch die neuere Fassung ${nummer(juengste)} überholt`
          : !f.vier_augen ? "braucht keine Vier-Augen-Freigabe mehr"
          : null;
        if (!grund) continue;
        const text = `Erledigt: Auswertung ${nummer(f)} ${grund}.`;
        if (await auftragErledigen(Number(t.id), { art: "auto", von: "Finanzauswertung", autorArt: "system", ereignis: text, ergebnis: text, beitragText: text }, lauf)) erg.erledigt++;
      }
    }

    // 2. Der jüngste Entwurf mit Vier-Augen: EINE Aufgabe an die Leitung.
    const f = juengste;
    if (f && f.status === "entwurf" && f.vier_augen) {
      const erstellerId = f.erstellt_von_id != null ? Number(f.erstellt_von_id) : null;
      const leitung = await vierAugenLeitung(erstellerId, lauf);
      const vorbehalte = Array.isArray(f.vorbehalte) ? f.vorbehalte.map(String).filter(Boolean) : [];
      const warum = f.vorbehalt ? `mit Vorbehalt${vorbehalte.length ? ` (${vorbehalte.slice(0, 3).join(" · ")})` : ""}` : "rote Gesamtlage";
      const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
      const r = await auftragFuerKunden({
        personId: Number(f.person_id), ref: f.ref ? String(f.ref) : null,
        schluessel: VIER_AUGEN_SCHLUESSEL(Number(f.id)),
        titel: `Vier-Augen: Auswertung ${nummer(f)} freigeben`,
        text: `Die FIAON Finanz- und Bonitätsauswertung ${nummer(f)} (${warum}) wartet auf die Freigabe der Leitung — `
          + `erzeugt von ${f.erstellt_von ?? "einem Mitarbeiter"}, der sie selbst nicht freigeben darf. Akte → Reiter „Dokumente“ → `
          + "„FIAON Finanz- und Bonitätsauswertung“: Vorschau ansehen, dann „An den Kunden übergeben“ oder „Verwerfen“ (mit Grund). "
          + "Steht dort „veraltet“, erst eine neue Fassung erzeugen. Freigabe, Verwerfen oder eine neuere Fassung erledigen diese Aufgabe von selbst.",
        quelle: "finanzauswertung", bereich: "pruefen", link: `/agent/kunden?person=${Number(f.person_id)}`,
        autorName: "Finanzauswertung", anlageText: "Angelegt, weil der Entwurf nur von der Leitung freigegeben werden darf (Vier-Augen).",
        faelligAm: new Date(Date.now() + 864e5).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }),
        ...(leitung != null ? { agentId: leitung } : { anBetreiber: true as const }),
      });
      erg.angelegt = r.id != null;
    }
  } catch (e) {
    console.error("[FINANZAUSWERTUNG] Vier-Augen-Aufgabe:", String((e as Error)?.message || e).slice(0, 200));
  }
  return erg;
}

// ───────────────────────────────────────────────────────────────────────────
// Freigeben · Verwerfen · PDF
// ───────────────────────────────────────────────────────────────────────────

export async function freigeben(
  id: number, wer: { name: string; agentId: number; rolle: string; zustaendig: boolean }, lauf: Lauf = sqlPool,
  opts: { mail?: boolean } = {},
): Promise<{ ok: boolean; text: string; mail?: string }> {
  await ensureFinanzauswertungTabellen();
  const [r] = (await lauf`SELECT * FROM fiaon_finanzauswertungen WHERE id = ${id} LIMIT 1`) as any[];
  if (!r) return { ok: false, text: "Diese Auswertung gibt es nicht." };
  if (r.status !== "entwurf") return { ok: false, text: `Freigeben geht nur bei einem Entwurf (Stand: ${r.status}).` };
  const regel = freigabeRegel({
    gesamt: r.gesamt ?? "gelb", vorbehalt: !!r.vorbehalt, rolle: wer.rolle, freigeberId: wer.agentId,
    erstellerId: r.erstellt_von_id != null ? Number(r.erstellt_von_id) : null, zustaendig: wer.zustaendig,
  });
  if (!regel.erlaubt) return { ok: false, text: regel.grund ?? "Nicht erlaubt." };
  const personId = Number(r.person_id);
  // Nachprüfung 08.10.: Kein Entwurf auf altem Stand an den Kunden — kam seit dem Entwurf eine neue
  // Unterlage oder Analyse, muss erst eine neue Fassung her (dieselbe Regel wie „veraltet“ in der Akte).
  const eJetzt = await eingabenSammeln(personId, lauf).catch(() => null);
  const eingabenAlt = typeof r.eingaben === "string" ? JSON.parse(r.eingaben) : r.eingaben;
  if (eJetzt && eingabenAlt?.hash && eingabenAlt.hash !== eingabenHash(eJetzt)) {
    return { ok: false, text: "Seit dem Entwurf sind neue Unterlagen oder eine neue Auswertung des Kontoauszugs da — bitte eine neue Fassung erzeugen." };
  }
  const { personFamilie } = await import("./fiaon-unterlagen-link");
  const familie = await personFamilie(personId, lauf);
  // Gegenprüfung 08.10.: Das SELECT oben sperrt nichts. Verwirft die Leitung den Entwurf
  // gleichzeitig, klickt jemand doppelt oder geben zwei Menschen zwei Entwürfe derselben
  // Person zugleich frei, darf genau EINE Freigabe gelingen (und genau eine Mail gehen).
  // Deshalb: Sperre je Person, dann nur „entwurf" → „freigegeben"; ohne Zeile Abbruch.
  const gelungen = await lauf.begin(async (tx: any) => {
    await tx`SELECT pg_advisory_xact_lock(hashtext(${`fiaon_finanzauswertung_freigabe:${personId}`}))`;
    const [noch] = (await tx`SELECT status FROM fiaon_finanzauswertungen WHERE id = ${id} FOR UPDATE`) as any[];
    if (noch?.status !== "entwurf") return false;
    await tx`UPDATE fiaon_finanzauswertungen SET status = 'ersetzt', updated_at = NOW() WHERE person_id = ANY(${familie}) AND status = 'freigegeben' AND id <> ${id}`;
    const z = (await tx`UPDATE fiaon_finanzauswertungen SET status = 'freigegeben', freigegeben_von = ${wer.name}, freigegeben_von_id = ${wer.agentId}, freigegeben_am = NOW(), updated_at = NOW()
                         WHERE id = ${id} AND status = 'entwurf' RETURNING id`) as any[];
    return z.length === 1;
  });
  if (!gelungen) return { ok: false, text: "Der Stand hat sich gerade geändert (schon freigegeben oder verworfen). Bitte die Akte neu laden." };
  // Integration 08.10.2026: die Vier-Augen-Aufgabe der Leitung ist damit erledigt.
  await vierAugenAufgabenAbgleichen(personId, lauf);
  const nummer = auswertungNummer(personId, Number(r.fassung));
  let mail = "aus";
  if (opts.mail !== false) {
    const { mailSenden } = await import("./fiaon-mail-senden");
    const v = await mailSenden({
      event: "finanzauswertung_bereit", personId,
      zusatz: { auswertung_url: absoluteUrl("/app/auswertung"), nummer },
      akteur: { name: wer.name, agentId: wer.agentId, rolle: wer.rolle as any }, lauf,
    }).catch((e: unknown) => ({ ok: false, grund: String((e as Error)?.message || e) } as any));
    mail = (v as any).ok ? "gesendet" : `nicht gesendet: ${String((v as any).grund ?? (v as any).meldung ?? "unbekannt").replace(/\.+$/, "")}`;
    await lauf`UPDATE fiaon_finanzauswertungen SET mail_status = ${mail.slice(0, 300)}, mail_am = NOW() WHERE id = ${id}`;
  }
  await lauf`
    INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
    VALUES (${r.ref}, ${personId}, ${wer.agentId}, ${wer.name}, 'system',
            ${`Finanz- und Bonitätsauswertung ${nummer} freigegeben${regel.vierAugen ? " (Vier-Augen)" : ""} — liegt im Bereich des Kunden. Mail: ${mail}.`})`.catch(() => {});
  return { ok: true, text: `Freigegeben — ${nummer} liegt jetzt im Bereich des Kunden. Mail: ${mail}.`, mail };
}

export async function verwerfen(id: number, grund: string, wer: { name: string; agentId: number }, lauf: Lauf = sqlPool): Promise<{ ok: boolean; text: string }> {
  await ensureFinanzauswertungTabellen();
  const g = String(grund ?? "").replace(/\s+/g, " ").trim();
  if (g.length < 3) return { ok: false, text: "Bitte kurz sagen, warum verworfen wird." };
  const r = (await lauf`
    UPDATE fiaon_finanzauswertungen SET status = 'verworfen', verworfen_von = ${wer.name}, verworfen_am = NOW(), verworfen_grund = ${g.slice(0, 500)}, updated_at = NOW()
     WHERE id = ${id} AND status IN ('entwurf', 'fehler') RETURNING person_id, ref, fassung`) as any[];
  if (!r.length) return { ok: false, text: "Verwerfen geht nur bei einem Entwurf." };
  await lauf`
    INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
    VALUES (${r[0].ref}, ${Number(r[0].person_id)}, ${wer.agentId}, ${wer.name}, 'system',
            ${`Finanz- und Bonitätsauswertung ${auswertungNummer(Number(r[0].person_id), Number(r[0].fassung))} verworfen: ${g}`})`.catch(() => {});
  // Integration 08.10.2026: eine Vier-Augen-Aufgabe zu diesem Entwurf ist damit erledigt.
  await vierAugenAufgabenAbgleichen(Number(r[0].person_id), lauf);
  return { ok: true, text: "Verworfen — der Kunde sieht diesen Entwurf nie." };
}

/** Das PDF einer Fassung — für die Akte (jede) oder den Kunden (nur freigegeben/ersetzt; der Aufrufer prüft die Person). */
export async function pdfLesen(id: number, lauf: Lauf = sqlPool): Promise<{ personId: number; status: string; nummer: string; pdf: Buffer } | null> {
  await ensureFinanzauswertungTabellen();
  const [r] = (await lauf`
    SELECT f.person_id, f.status, f.fassung, d.inhalt FROM fiaon_finanzauswertungen f
      JOIN fiaon_dokumente d ON d.id = f.pdf_dokument_id WHERE f.id = ${id} LIMIT 1`) as any[];
  if (!r?.inhalt) return null;
  return { personId: Number(r.person_id), status: String(r.status), nummer: auswertungNummer(Number(r.person_id), Number(r.fassung)), pdf: Buffer.from(r.inhalt) };
}

/** Die Fassung (Kopf + eingefrorener Inhalt) für die Akte. */
export async function fassungLesen(id: number, lauf: Lauf = sqlPool): Promise<(FassungKurz & { personId: number; inhalt: AuswertungInhalt | null }) | null> {
  await ensureFinanzauswertungTabellen();
  const [r] = (await lauf`SELECT * FROM fiaon_finanzauswertungen WHERE id = ${id} LIMIT 1`) as any[];
  if (!r) return null;
  const inhalt = typeof r.inhalt === "string" ? JSON.parse(r.inhalt) : r.inhalt;
  return { ...kurz(r), personId: Number(r.person_id), inhalt: inhalt ?? null };
}

/** Für das Portal: die freigegebene Fassung (eingefroren) und die früheren (ersetzt). Nie Entwürfe. */
export async function kundeAuswertungen(personId: number, lauf: Lauf = sqlPool): Promise<{
  aktuell: (FassungKurz & { inhalt: AuswertungInhalt }) | null; fruehere: FassungKurz[];
}> {
  await ensureFinanzauswertungTabellen();
  const { personFamilie } = await import("./fiaon-unterlagen-link");
  const familie = await personFamilie(personId, lauf);
  const zeilen = (await lauf`
    SELECT * FROM fiaon_finanzauswertungen WHERE person_id = ANY(${familie}) AND status IN ('freigegeben', 'ersetzt')
     ORDER BY (status = 'freigegeben') DESC, freigegeben_am DESC NULLS LAST LIMIT 10`) as any[];
  const a = zeilen.find((z) => z.status === "freigegeben");
  const inhalt = a ? (typeof a.inhalt === "string" ? JSON.parse(a.inhalt) : a.inhalt) : null;
  return {
    aktuell: a && inhalt ? { ...kurz(a), inhalt } : null,
    fruehere: zeilen.filter((z) => z.status === "ersetzt").map(kurz),
  };
}

export async function kundeGelesen(id: number, personId: number, lauf: Lauf = sqlPool): Promise<void> {
  const { personFamilie } = await import("./fiaon-unterlagen-link");
  const familie = await personFamilie(personId, lauf);
  await lauf`UPDATE fiaon_finanzauswertungen SET kunde_gelesen_am = COALESCE(kunde_gelesen_am, NOW()) WHERE id = ${id} AND person_id = ANY(${familie}) AND status = 'freigegeben'`.catch(() => {});
}

/** Gehört diese Person (oder eine in sie zusammengeführte) zu jener? Für die Routen (Fassung ↔ Akte). */
export async function gehoertZu(fassungPersonId: number, personId: number, lauf: Lauf = sqlPool): Promise<boolean> {
  if (fassungPersonId === personId) return true;
  const { personFamilie } = await import("./fiaon-unterlagen-link");
  return (await personFamilie(personId, lauf)).includes(fassungPersonId);
}

/**
 * DSGVO-Löschung (Nachprüfung 08.10.2026): Was diese Strecke über eine Person speichert, geht mit.
 * Fassungen bleiben als Zeile (Nummer, Status, Zeitpunkte), aber ohne Inhalt und Eingaben; Anfragen
 * ohne Adresse und Nummer; Upload-Links sofort ungültig; Sichtprüfungen und Teil-Prüfwerte weg.
 * `endgueltig` = auch die Zeilen selbst. Fehlt eine Tabelle, ist nichts zu tun.
 */
export async function personDatenLoeschen(personIdOderFamilie: number | number[], opts: { endgueltig?: boolean } = {}, lauf: Lauf = sqlPool): Promise<void> {
  // Querprüfung 08.10.2026: Die endgültige Löschung übergibt die ganze Familie (Kopf + zusammengeführte Dubletten,
  // personFamilie) — Links, Anfragen und Fassungen einer Dublette bleiben nach der Zusammenführung an ihr.
  const personId = (Array.isArray(personIdOderFamilie) ? personIdOderFamilie : [personIdOderFamilie]).map(Number).filter((x) => Number.isFinite(x));
  if (!personId.length) return;
  const [t] = (await lauf`
    SELECT to_regclass('fiaon_finanzauswertungen') IS NOT NULL AS fa, to_regclass('fiaon_unterlagen_links') IS NOT NULL AS li,
           to_regclass('fiaon_unterlagen_anfragen') IS NOT NULL AS an, to_regclass('fiaon_unterlagen_sichtpruefung') IS NOT NULL AS si,
           to_regclass('fiaon_unterlagen_teile') IS NOT NULL AS te`) as any[];
  if (t?.fa) {
    if (opts.endgueltig) await lauf`DELETE FROM fiaon_finanzauswertungen WHERE person_id = ANY(${personId})`;
    else await lauf`UPDATE fiaon_finanzauswertungen SET inhalt = NULL, eingaben = NULL, updated_at = NOW() WHERE person_id = ANY(${personId})`;
  }
  if (t?.li) {
    if (opts.endgueltig) await lauf`DELETE FROM fiaon_unterlagen_links WHERE person_id = ANY(${personId})`;
    else await lauf`UPDATE fiaon_unterlagen_links SET widerrufen_am = COALESCE(widerrufen_am, NOW()), widerruf_grund = COALESCE(widerruf_grund, 'DSGVO-Löschung') WHERE person_id = ANY(${personId})`;
  }
  if (t?.an) {
    if (opts.endgueltig) await lauf`DELETE FROM fiaon_unterlagen_anfragen WHERE person_id = ANY(${personId})`;
    else await lauf`UPDATE fiaon_unterlagen_anfragen SET adresse = NULL, nummer = NULL WHERE person_id = ANY(${personId})`;
  }
  if (t?.si) await lauf`DELETE FROM fiaon_unterlagen_sichtpruefung WHERE person_id = ANY(${personId})`;
  if (t?.te) await lauf`DELETE FROM fiaon_unterlagen_teile WHERE person_id = ANY(${personId})`;
}

export { VORBEHALT_TEXTE };
