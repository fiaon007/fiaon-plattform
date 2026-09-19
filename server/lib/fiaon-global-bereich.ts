// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — „MEIN AUFTRAG" (17.09.2026, E-188)
//
// Justin: „Mach alles fix fertig, keine Platzhalter." Die Pakete sagen einen
// eigenen Dokumentenraum zu, einen Pflichtenkalender, einen festen
// Ansprechpartner und den monatlichen Durchgang. Das hier ist die Funktion dazu.
//
// ── WAS HIER STEHT ────────────────────────────────────────────────────────
// Nach dem Kauf führt der Firmenkunde seinen Auftrag auf EINER Seite
// (/business/auftrag/<ref>, ohne Anmeldung, mit dem signierten Token des
// Bestellwegs), und die zuständige Person führt ihn im Office
// (/agent/global/<ref>). Beide sehen dieselbe Akte:
//   · ETAPPEN 0–5 (shared/fiaon-global-bereich.ts) — gesetzt von Hand, nie von
//     einer Automatik: Ob „die erste Firmenkarte" begonnen hat, weiß ein Mensch.
//     Einzige Ausnahme ist der Start: Zahlungseingang = Etappe 1.
//   · DOKUMENTENRAUM (fiaon_global_dokumente) — der Kunde lädt hoch, FIAON legt
//     ab. Der Kunde sieht Eigenes und was für ihn freigegeben ist.
//   · PFLICHTENKALENDER (fiaon_global_fristen) — Regel-Fristen aus Bundesstaat,
//     Gründungstag und Rechtsform (reine Funktion, mit Quellen), dazu Handeinträge.
//   · VERLAUF (fiaon_global_verlauf) — was geschah; je Zeile sichtbar oder intern.
//   · TAGESLAUF — erinnert an Fristen, stellt den monatlichen Durchgang ein und
//     fasst nach fehlenden Unterlagen nach (Aufgabe, keine Mail-Kaskade).
//
// ── DER VERLAUF: ABGELEITET, WO DIE AKTE ES WEISS — GESCHRIEBEN, WO NICHT ──
// „Auftrag erteilt" und „Zahlung eingegangen" stehen mit Zeitpunkt in der Akte
// (unterschrieben_am, bezahlt_am). Sie werden beim LESEN abgeleitet: Sie können
// der Akte nie widersprechen, entstehen bei keinem zweiten Klick doppelt
// (globalNachZahlung ist ausdrücklich wiederholbar), und kein Schreibfehler im
// Verlauf kann den Zahlungsweg aufhalten. Der START schreibt seine Zeile
// (Etappe 1), weil dort ohnehin geschrieben wird — das UPDATE wirkt nur von
// Etappe 0 aus und ist damit selbst die Sperre gegen Doppelte; fehlt die Zeile
// doch einmal, leitet der Leser sie aus gestartet_am ab. Der STICHTAG wird
// geschrieben, weil die Akte nur das Datum kennt, nicht den Zeitpunkt, an dem
// es gesetzt oder geändert wurde.
//
// ── DER ZUGANG OHNE ANMELDUNG ─────────────────────────────────────────────
// Dasselbe Token wie beim Auftrag (HMAC, an die ref gebunden, 30 Tage). Ein
// Auftrag läuft sechs Monate und länger — deshalb trägt JEDE Mail einen
// frischen Link (globalMeinAuftragUrl), und POST /global/zugang schickt auf
// Anforderung jederzeit einen neuen an die Adresse des Auftrags. Die Antwort
// dort ist immer dieselbe; wer fragt, erfährt nicht, ob es zu einer Adresse
// einen Auftrag gibt.
//
// ── WAS BEWUSST NICHT PASSIERT ────────────────────────────────────────────
//   · Kein Geld: Hier wird nichts gebucht, storniert oder erstattet.
//   · Nichts wird gebunden oder umgewandelt: Eine Datei liegt im Dokumentenraum,
//     wie sie kam (E-178: verschlüsselte Bank-PDFs nie binden). Geprüft wird der
//     INHALT (fiaon-global-bereich-regeln.ts), nie der behauptete Typ.
//   · Kein Dokument reist per Mail. `global_dokument` sagt nur, dass etwas bereitliegt.
//   · Keine private Nummer und keine private Adresse eines Mitarbeiters geht an
//     den Kunden: `fiaon_agents.phone` pflegt der Mitarbeiter selbst für das Haus;
//     gezeigt wird eine Adresse nur, wenn sie auf @fiaon.com endet, sonst welcome@.
// ═══════════════════════════════════════════════════════════════════════════
import { createHash } from "node:crypto";
import { sqlPool } from "./db-pool";
import { berlinToday, berlinDatum, berlinOffsetMinutes } from "./fiaon-time";
import { isoTag } from "./fiaon-kuendigung-mitarbeiter";
import { escapeHtml } from "./fiaon-html-pdf";
import { paket as katalogPaket } from "@shared/fiaon-pakete";
import { globalPaket } from "@shared/fiaon-global";
import { wandPruefen, wandUrteil } from "@shared/fiaon-wortverbote";
import { globalOfficeAuftragPfad } from "@shared/fiaon-global-wege";
import {
  GLOBAL_ETAPPEN, GLOBAL_ETAPPE_MAX, GLOBAL_FRIST_STANDARDHINWEIS, GLOBAL_TEXT_UNTERLAGEN, GLOBAL_UNTERLAGEN_NACHFASS_TAGE, GLOBAL_VERLAUF_TEXT,
  globalDokumentArt, globalDokumentArtText, globalDokumentArtenFuer, globalDurchgangMonat, globalEtappeStand, globalEtappeText, globalFristAbstandText,
  globalFristMarke, globalTageslaufFenster, globalHatMonatsdurchgang, globalHeimatMeldungSchritt, globalKundeDarfArt, globalPaketEtappeBis, globalPflichtFristen, globalTagAlsText,
  globalUnterlagenOffen, globalUnterlagenStand, isoPlusTage, istIsoTag, usBundesstaatCode, usBundesstaatName, globalJahresbetreuungRechnungAb,
  type BereichSprache, type GlobalGesellschaft,
} from "@shared/fiaon-global-bereich";
import {
  ensureGlobalTabelle, globalAkteLesen, globalBestellungLesen, globalEinstellungen, globalMailSenden, globalMeinAuftragUrl, globalSpracheVon,
  globalStatusAus, globalStichtagSetzen, globalJahresbetreuungAus, globalEur, type GlobalMail,
} from "./fiaon-global-auftrag";
import { globalWiderrufsfrist } from "./fiaon-global-vertrag";
import { GLOBAL_DATEI_MAX_BYTES, GLOBAL_DOKUMENTE_MAX, fensterDrossel, globalDateiTyp, globalDateiname } from "./fiaon-global-bereich-regeln";

export type GlobalBereichStatus = "offen" | "bezahlt" | "gestartet" | "abgeschlossen" | "storniert";
export type Erg<T = Record<never, never>> = ({ ok: true } & T) | { ok: false; status: number; error: string };
export interface BereichAgent { id: number; name: string }

const nein = (status: number, error: string) => ({ ok: false as const, status, error });
const t = (sprache: BereichSprache, de: string, en: string) => (sprache === "en" ? en : de);

// ── Schema ───────────────────────────────────────────────────────────────────
let bereit: Promise<void> | null = null;
export function ensureGlobalBereich(): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      await ensureGlobalTabelle();
      // Mit lock_timeout wie im Bestellweg: Ein ALTER darf nie hinter einer langen Transaktion
      // Schlange stehen und dabei alle Leser der Tabelle aufhalten. Klappt es nicht, wirft diese
      // Funktion — und der nächste Aufruf versucht es wieder (bereit = null).
      await sqlPool.begin(async (tx: any) => {
        await tx`SET LOCAL lock_timeout = '3s'`;
        await tx`
          ALTER TABLE fiaon_global_auftraege
            ADD COLUMN IF NOT EXISTS etappe SMALLINT NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS etappe_seit TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS etappen_seit JSONB NOT NULL DEFAULT '{}'::jsonb,
            ADD COLUMN IF NOT EXISTS naechster_schritt TEXT,
            ADD COLUMN IF NOT EXISTS naechster_schritt_bis DATE,
            ADD COLUMN IF NOT EXISTS gesellschaft JSONB,
            ADD COLUMN IF NOT EXISTS abgeschlossen_am TIMESTAMPTZ`;
      });
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_global_dokumente (
          id BIGSERIAL PRIMARY KEY,
          ref VARCHAR NOT NULL,
          von TEXT NOT NULL CHECK (von IN ('kunde', 'fiaon')),
          art TEXT NOT NULL,
          dateiname TEXT NOT NULL,
          mime TEXT NOT NULL,
          groesse INTEGER NOT NULL,
          inhalt BYTEA NOT NULL,
          doc_hash VARCHAR,
          sichtbar_fuer_kunde BOOLEAN NOT NULL DEFAULT TRUE,
          hochgeladen_von_agent INTEGER,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          geloescht_am TIMESTAMPTZ
        )`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_global_dokumente_ref_idx ON fiaon_global_dokumente (ref, created_at DESC)`;
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_global_verlauf (
          id BIGSERIAL PRIMARY KEY,
          ref VARCHAR NOT NULL,
          art TEXT NOT NULL,
          text TEXT NOT NULL,
          sichtbar BOOLEAN NOT NULL DEFAULT FALSE,
          agent_id INTEGER,
          von TEXT NOT NULL DEFAULT 'system',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_global_verlauf_ref_idx ON fiaon_global_verlauf (ref, created_at DESC)`;
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_global_fristen (
          id BIGSERIAL PRIMARY KEY,
          ref VARCHAR NOT NULL,
          titel TEXT NOT NULL,
          faellig_am DATE NOT NULL,
          hinweis TEXT,
          quelle TEXT NOT NULL DEFAULT 'hand' CHECK (quelle IN ('regel', 'hand')),
          regel_key TEXT,
          erledigt_am TIMESTAMPTZ,
          erinnert_30_am TIMESTAMPTZ,
          erinnert_7_am TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sqlPool`CREATE UNIQUE INDEX IF NOT EXISTS fiaon_global_fristen_regel_idx ON fiaon_global_fristen (ref, regel_key) WHERE regel_key IS NOT NULL`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_global_fristen_faellig_idx ON fiaon_global_fristen (faellig_am) WHERE erledigt_am IS NULL`;
    })().catch((e) => { bereit = null; throw e; });
  }
  return bereit;
}

// ── Kleine Helfer ────────────────────────────────────────────────────────────
// JSONB schreiben: IMMER über sqlPool.json(). Einen mit JSON.stringify gebauten Text, der auf ::jsonb
// gegossen wird, kodiert postgres.js ein zweites Mal — in der Spalte stünde eine JSON-ZEICHENKETTE statt
// eines Objekts, und das Anhängen an etappen_seit (Operator ||) ergäbe ein Feld statt eines Objekts (gemessen am 17.09.2026 gegen PostgreSQL 16). Der Leser unten verträgt beides,
// weil die Akte des Bestellwegs (firma, ansprechpartner) so geschrieben ist.
function json<T>(v: unknown, leer: T): T {
  if (v && typeof v === "object") return v as T;
  try { return (JSON.parse(String(v ?? "")) as T) ?? leer; } catch { return leer; }
}
const iso = (v: unknown): string | null => (v ? new Date(v as any).toISOString() : null);
const knapp = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
/** Mehrzeiliger Text: Zeilenumbrüche bleiben, Steuerzeichen nicht. */
const absatz = (v: unknown, max: number) => String(v ?? "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);

/**
 * Der Satz eines Mitarbeiters, den der KUNDE liest — gegen die Wand des Hauses
 * (Muster kundensatzPruefen in fiaon-app-antraege.ts). Harte Treffer sperren:
 * garantieren, beraten, empfehlen, eine Frist in Tagen zusagen.
 *
 * Die SCHÄRFEREN Global-Regeln (shared/fiaon-global-wortregeln.ts: Bankname,
 * „bis zu" …) sperren hier bewusst NICHT — sie gelten für die festen Texte des
 * Hauses. Im laufenden Auftrag muss der Name eines Instituts stehen dürfen
 * („Bitte bestätigen Sie die E-Mail von …"); die Office-Seite zeigt diese
 * Treffer beim Tippen als Hinweis.
 *
 * Gedeckt sind die Zusagen „ich rufe Sie an" / „ich melde mich" / „notiert":
 * Wer hier schreibt, IST die zuständige Person mit dem Auftrag vor sich — er
 * verspricht die Handlung selbst (bei Mara deckt sie das Werkzeug, das die
 * Aufgabe an den Betreuer anlegt).
 */
const SELBST_GEDECKT = ["notiz_an_betreuer", "aufgabe_an_betreuer"];
export function kundensatz(text: string): string | null {
  const funde = wandPruefen(text, SELBST_GEDECKT);
  if (wandUrteil(funde).sendbar) return null;
  return `Der Text für den Kunden enthält Formulierungen, die wir nicht verwenden: ${funde.filter((f) => f.art !== "floskel").map((f) => `„${f.treffer}“`).join(", ")}. Bitte formuliere um.`;
}

async function verlaufSchreiben(ref: string, z: { art: string; text: string; sichtbar: boolean; agentId?: number | null; von?: "system" | "kunde" | "fiaon" }): Promise<void> {
  await sqlPool`
    INSERT INTO fiaon_global_verlauf (ref, art, text, sichtbar, agent_id, von)
    VALUES (${ref}, ${z.art}, ${z.text.slice(0, 4000)}, ${z.sichtbar}, ${z.agentId ?? null}, ${z.von ?? (z.agentId ? "fiaon" : "system")})
  `.catch((e) => console.error(`[GLOBAL-BEREICH] ${ref}: Verlauf (${z.art}) nicht geschrieben:`, e));
}

// ── Die Lage eines Auftrags ──────────────────────────────────────────────────
interface Lage {
  ref: string; akte: any; b: any; status: GlobalBereichStatus; sprache: BereichSprache;
  etappe: number; etappenSeit: Record<string, string>; gesellschaft: GlobalGesellschaft;
}

function bereichStatus(akte: any, b: any): GlobalBereichStatus {
  const s = b?.archived_at ? "storniert" : globalStatusAus(akte, b);
  return s === "gestartet" && String(akte?.status) === "abgeschlossen" ? "abgeschlossen" : s;
}

async function lageLesen(ref: string): Promise<Lage | null> {
  await ensureGlobalBereich();
  const akte = await globalAkteLesen(ref);
  if (!akte) return null;
  const b = await globalBestellungLesen(ref);
  if (!b) return null;
  const [z] = (await sqlPool`
    SELECT etappe, etappe_seit, etappen_seit, naechster_schritt, naechster_schritt_bis, gesellschaft, abgeschlossen_am
      FROM fiaon_global_auftraege WHERE ref = ${ref} LIMIT 1`) as any[];
  const [arch] = (await sqlPool`SELECT archived_at FROM fiaon_applications WHERE ref = ${ref} LIMIT 1`.catch(() => [])) as any[];
  const voll = { ...akte, ...(z ?? {}) };
  const status = bereichStatus(voll, { ...b, archived_at: arch?.archived_at ?? null });
  return {
    ref, akte: voll, b, status, sprache: globalSpracheVon(voll),
    // Ein offener Auftrag steht immer auf Etappe 0 — was auch in der Spalte steht.
    etappe: status === "offen" ? 0 : Math.max(0, Math.min(GLOBAL_ETAPPE_MAX, Number(z?.etappe || 0))),
    etappenSeit: json<Record<string, string>>(z?.etappen_seit, {}),
    gesellschaft: json<GlobalGesellschaft>(z?.gesellschaft, {}),
  };
}

const LAEUFT: GlobalBereichStatus[] = ["bezahlt", "gestartet"];
const BEZAHLT: GlobalBereichStatus[] = ["bezahlt", "gestartet", "abgeschlossen"];

// ── Der Ansprechpartner, wie ihn der Kunde sieht ─────────────────────────────
async function ansprechpartnerFuer(agentId: number | null): Promise<{ name: string; vorname: string; email: string; bild?: string } | undefined> {
  if (!agentId) return undefined;
  const [a] = (await sqlPool`
    SELECT name, first_name, email, avatar FROM fiaon_agents
     WHERE id = ${agentId} AND COALESCE(active, TRUE) AND zugang_gesperrt_am IS NULL LIMIT 1`.catch(() => [])) as any[];
  if (!a) return undefined;
  const name = String(a.name || "").trim();
  const mail = String(a.email || "").trim().toLowerCase();
  const bild = typeof a.avatar === "string" && a.avatar.startsWith("data:image/") ? a.avatar : undefined;
  return {
    name, vorname: String(a.first_name || name.split(" ")[0] || "").trim(),
    // Nur eine Adresse des Hauses geht an den Kunden — nie die private eines Mitarbeiters.
    email: mail.endsWith("@fiaon.com") ? mail : "welcome@fiaon.com",
    ...(bild ? { bild } : {}),
  };
}

// ── Lesen: Dokumente, Fristen, Verlauf ───────────────────────────────────────
async function dokumenteLesen(ref: string): Promise<any[]> {
  return (await sqlPool`
    SELECT d.id, d.von, d.art, d.dateiname, d.mime, d.groesse, d.sichtbar_fuer_kunde, d.hochgeladen_von_agent, d.created_at, ag.name AS agent_name
      FROM fiaon_global_dokumente d LEFT JOIN fiaon_agents ag ON ag.id = d.hochgeladen_von_agent
     WHERE d.ref = ${ref} AND d.geloescht_am IS NULL
     ORDER BY d.created_at DESC, d.id DESC`) as any[];
}
async function fristenLesen(ref: string): Promise<any[]> {
  return (await sqlPool`
    SELECT id, titel, faellig_am, hinweis, quelle, regel_key, erledigt_am, erinnert_30_am, erinnert_7_am
      FROM fiaon_global_fristen WHERE ref = ${ref} ORDER BY faellig_am ASC, id ASC`) as any[];
}
async function verlaufLesen(ref: string): Promise<any[]> {
  return (await sqlPool`
    SELECT v.id, v.art, v.text, v.sichtbar, v.agent_id, v.von, v.created_at, ag.name AS agent_name
      FROM fiaon_global_verlauf v LEFT JOIN fiaon_agents ag ON ag.id = v.agent_id
     WHERE v.ref = ${ref} ORDER BY v.created_at DESC, v.id DESC LIMIT 500`) as any[];
}

interface VerlaufZeile { am: string; art: string; text: string; sichtbar: boolean; von?: string; id?: number }

/** Geschriebene Zeilen plus die aus der Akte abgeleiteten (siehe Kopf) — jüngste zuerst. */
function verlaufBauen(l: Lage, geschrieben: any[], paketName: string): VerlaufZeile[] {
  const T = GLOBAL_VERLAUF_TEXT[l.sprache];
  const zeilen: VerlaufZeile[] = geschrieben.map((v) => ({
    id: Number(v.id), am: iso(v.created_at)!, art: String(v.art), text: String(v.text), sichtbar: !!v.sichtbar,
    von: v.von === "kunde" ? "Kunde" : (v.agent_name ? String(v.agent_name) : "System"),
  }));
  const erteilt = l.akte.unterschrieben_am ?? l.akte.created_at;
  if (erteilt) zeilen.push({ am: iso(erteilt)!, art: "auftrag", text: T.auftrag(paketName), sichtbar: true, von: "System" });
  if (l.akte.bezahlt_am && BEZAHLT.includes(l.status)) zeilen.push({ am: iso(l.akte.bezahlt_am)!, art: "zahlung", text: T.zahlung, sichtbar: true, von: "System" });
  if (l.akte.gestartet_am && !geschrieben.some((v) => v.art === "start")) zeilen.push({ am: iso(l.akte.gestartet_am)!, art: "start", text: T.start, sichtbar: true, von: "System" });
  return zeilen.sort((a, b) => b.am.localeCompare(a.am));
}

// ── DIE SICHT ────────────────────────────────────────────────────────────────
async function sichtBauen(l: Lage, fuer: "kunde" | "office"): Promise<Record<string, unknown>> {
  const { ref, akte, b, sprache } = l;
  const kat = katalogPaket(akte.paket_key);
  const gp = globalPaket(akte.paket_key);
  const paketName = sprache === "en" && gp ? `FIAON ${gp.en.name}` : (kat?.label ?? String(b.pack_name || akte.paket_key));
  const firma = json<Record<string, any>>(akte.firma, {});
  const [dokumente, fristen, geschrieben, ansprechpartner] = await Promise.all([
    dokumenteLesen(ref), fristenLesen(ref), verlaufLesen(ref),
    ansprechpartnerFuer(akte.zustaendig_agent_id ? Number(akte.zustaendig_agent_id) : null),
  ]);
  const bis = globalPaketEtappeBis(akte.paket_key);
  const etappen = GLOBAL_ETAPPEN.map((e) => {
    const seit = e.nr === 0 ? iso(akte.unterschrieben_am ?? akte.created_at) : (l.etappenSeit[String(e.nr)] ? iso(l.etappenSeit[String(e.nr)]) : null);
    const stand = globalEtappeStand(e.nr, l.etappe);
    return { nr: e.nr, ...globalEtappeText(e.nr, sprache), stand, ...(seit && stand !== "offen" ? { seit } : {}), imPaket: e.nr <= bis || e.nr === GLOBAL_ETAPPE_MAX };
  });
  const g = l.gesellschaft;
  const gesellschaft = g && (g.name || g.form || g.bundesstaat || g.gegruendetAm || g.einVorhanden != null || g.itinStand)
    ? {
      ...(g.name ? { name: g.name } : {}), ...(g.form ? { form: g.form } : {}),
      // Der Kunde liest den Namen („Delaware" — „DE" sähe für ihn nach Deutschland aus); das Office
      // bekommt das Kürzel, weil sein Formular es so zurückschickt. Das jeweils andere reist mit.
      ...(g.bundesstaat ? (fuer === "office"
        ? { bundesstaat: g.bundesstaat, bundesstaatName: usBundesstaatName(g.bundesstaat) ?? g.bundesstaat }
        : { bundesstaat: usBundesstaatName(g.bundesstaat) ?? g.bundesstaat, bundesstaatCode: g.bundesstaat }) : {}),
      ...(g.gegruendetAm ? { gegruendetAm: g.gegruendetAm } : {}),
      ...(g.einVorhanden != null ? { einVorhanden: !!g.einVorhanden } : {}), ...(g.itinStand ? { itinStand: g.itinStand } : {}),
    } : undefined;
  const sichtbareDokumente = dokumente.filter((d) => fuer === "office" || d.von === "kunde" || d.sichtbar_fuer_kunde);
  // 19.09.2026 (E-191): Beim Privatauftrag das Widerrufsrecht — bis wann, und ob die Arbeit erst danach beginnt.
  const widerruf = firma.art === "privat" && akte.unterschrieben_am
    ? { ...globalWiderrufsfrist(new Date(akte.unterschrieben_am)), sofortBeginn: json<Record<string, unknown>>(akte.bestaetigungen, {}).sofortBeginn === true }
    : null;
  const verlaufAlles = verlaufBauen(l, geschrieben, paketName);
  const bezahlt = String(b.payment_status) === "paid";
  // 19.09.2026 (E-196): Jahresbetreuung — angekreuzt ja/nein und der Preis je Betreuungsjahr. Das Office sieht
  // dazu, ab wann die Rechnung für das zweite Betreuungsjahr zu stellen ist: dieselbe Regel wie im Tageslauf.
  const jb = globalJahresbetreuungAus(akte);
  const jbPlan = fuer === "office" && jb.jahresbetreuung
    ? globalJahresbetreuungRechnungAb({ gegruendetAm: g?.gegruendetAm ?? null, gestartetAm: akte.gestartet_am ? berlinDatum(new Date(akte.gestartet_am)) : null })
    : null;
  return {
    ref, status: l.status, sprache, paket: String(akte.paket_key), paketName,
    auftraggeber: firma.art === "privat" ? "privat" : "unternehmen",
    ...jb,
    ...(jbPlan ? { jahresbetreuungRechnungAb: jbPlan.rechnungAb, jahresbetreuungJahrestag: jbPlan.jahrestag, jahresbetreuungBasis: jbPlan.basis } : {}),
    ...(widerruf ? { widerruf } : {}),
    firma: { name: String(firma.name || akte.firma_name || ""), ort: String(firma.ort || ""), land: String(firma.land || akte.land || "") },
    zahlung: { status: bezahlt ? "bezahlt" : "offen", ...(!bezahlt && l.status === "offen" && b.payment_reference ? { zahlungsseite: `/zahlung/${b.payment_reference}?bereich=business` } : {}) },
    etappe: l.etappe, etappen,
    ...(akte.stichtag ? { stichtag: isoTag(akte.stichtag) } : {}),
    ...(akte.naechster_schritt ? { naechsterSchritt: { text: String(akte.naechster_schritt), ...(akte.naechster_schritt_bis ? { bis: isoTag(akte.naechster_schritt_bis) } : {}) } } : {}),
    ...(ansprechpartner ? { ansprechpartner } : {}),
    ...(gesellschaft ? { gesellschaft } : {}),
    // Vorhanden ist eine Unterlage, sobald ein Dokument ihrer Art im Raum liegt — gleich, wer es abgelegt hat.
    unterlagen: globalUnterlagenStand(dokumente.map((d) => String(d.art)), sprache, firma.art === "privat"),
    dokumente: sichtbareDokumente.map((d) => ({
      id: Number(d.id), art: String(d.art), artText: globalDokumentArtText(d.art, sprache), name: String(d.dateiname),
      groesse: Number(d.groesse || 0), von: d.von === "kunde" ? "kunde" : "fiaon", am: iso(d.created_at),
      ...(fuer === "office" ? { sichtbarFuerKunde: d.von === "kunde" || !!d.sichtbar_fuer_kunde, vonName: d.von === "kunde" ? "Kunde" : (d.agent_name ?? "FIAON") } : {}),
    })),
    fristen: fristen.map((f) => ({
      id: Number(f.id), titel: String(f.titel), faelligAm: isoTag(f.faellig_am), erledigt: !!f.erledigt_am,
      ...(f.hinweis ? { hinweis: String(f.hinweis) } : {}),
      ...(fuer === "office" ? { quelle: String(f.quelle), erledigtAm: iso(f.erledigt_am), erinnert30Am: iso(f.erinnert_30_am), erinnert7Am: iso(f.erinnert_7_am) } : {}),
    })),
    verlauf: verlaufAlles.filter((v) => v.sichtbar).map((v) => ({ am: v.am, text: v.text })),
    // Dürfen jetzt Dokumente hochgeladen werden? (Kunde: nur bezahlt | gestartet; Office auch nach dem Abschluss)
    uploadOffen: fuer === "office" ? BEZAHLT.includes(l.status) : LAEUFT.includes(l.status),
    // Die Auswahl beim Hochladen — der Kunde nur, was er liefern darf; das Office jede Art (in seiner Sprache: deutsch).
    dokumentArten: globalDokumentArtenFuer(fuer, fuer === "office" ? "de" : sprache),
    _verlaufAlles: verlaufAlles,
  };
}

/** GET /global/mein-auftrag/:ref — was der Kunde sieht. `token` ist das bereits geprüfte aus `?t=`. */
export async function globalBereichKundenSicht(ref: string, token: string): Promise<Record<string, unknown> | null> {
  const l = await lageLesen(ref);
  if (!l) return null;
  const s = await sichtBauen(l, "kunde");
  delete s._verlaufAlles;
  const r = encodeURIComponent(ref); const tk = encodeURIComponent(token);
  return {
    ...s,
    dokumente: (s.dokumente as any[]).map((d) => ({ ...d, url: `/api/fiaon/global/mein-auftrag/${r}/dokument/${d.id}?t=${tk}` })),
    vertragUrl: `/api/fiaon/global/auftrag/${r}/vertrag.pdf?t=${tk}`,
    rechnungUrl: `/api/fiaon/global/auftrag/${r}/rechnung.pdf?t=${tk}`,
  };
}

/** GET /agent/global/auftraege/:ref — die Kundensicht plus alles, was nur das Haus sieht. */
export async function globalBereichOfficeSicht(ref: string): Promise<Record<string, unknown> | null> {
  const l = await lageLesen(ref);
  if (!l) return null;
  const s = await sichtBauen(l, "office");
  const alles = (s._verlaufAlles as VerlaufZeile[]) ?? [];
  delete s._verlaufAlles;
  const ap = json<Record<string, any>>(l.akte.ansprechpartner, {});
  const r = encodeURIComponent(ref);
  const [z] = l.akte.zustaendig_agent_id
    ? ((await sqlPool`SELECT id, name FROM fiaon_agents WHERE id = ${Number(l.akte.zustaendig_agent_id)} LIMIT 1`.catch(() => [])) as any[]) : [];
  return {
    ...s,
    dokumente: (s.dokumente as any[]).map((d) => ({ ...d, url: `/api/fiaon/agent/global/auftraege/${r}/dokument/${d.id}` })),
    // Nur, was es gibt: Ohne unterschriebenen Vertrag bzw. ohne Bestellnummer zeigt die Office-Seite „nicht hinterlegt“.
    vertragUrl: l.akte.hat_vertrag ? `/api/fiaon/agent/global/auftraege/${r}/vertrag.pdf` : null,
    rechnungUrl: l.b.payment_reference ? `/api/fiaon/agent/global/auftraege/${r}/rechnung.pdf` : null,
    kontakt: {
      anrede: String(ap.anrede || ""), vorname: String(ap.vorname || ""), nachname: String(ap.nachname || ""),
      funktion: String(ap.funktion || ""), email: String(l.akte.email || ap.email || ""), telefon: String(ap.telefon || ""),
    },
    firmaVoll: json<Record<string, unknown>>(l.akte.firma, {}),
    ...(l.akte.ust_id ? { ustId: String(l.akte.ust_id) } : {}),
    zustaendig: z ? { id: Number(z.id), name: String(z.name) } : null,
    betragCents: Math.round(Number(l.b.amount_due || 0) * 100),
    verwendungszweck: l.b.payment_reference ?? null, rechnungsnummer: l.b.invoice_number ?? null,
    erstelltAm: iso(l.akte.created_at), bezahltAm: iso(l.akte.bezahlt_am), gestartetAm: iso(l.akte.gestartet_am), abgeschlossenAm: iso(l.akte.abgeschlossen_am),
    intern: {
      notizen: alles.filter((v) => v.art === "notiz").map((v) => ({ id: v.id ?? null, am: v.am, von: v.von ?? "System", text: v.text, sichtbar: v.sichtbar })),
      verlaufAlles: alles.map((v) => ({ am: v.am, art: v.art, text: v.text, sichtbar: v.sichtbar, ...(v.von ? { von: v.von } : {}) })),
    },
    // Frisches Token bei jedem Lesen — zum Kopieren oder Vorlesen am Telefon.
    kundenLink: globalMeinAuftragUrl(ref, l.sprache),
  };
}

/** Wer ist für diesen Auftrag zuständig? Für die Zugriffsregel der Office-Routen. `undefined` = Auftrag unbekannt. */
export async function globalBereichZustaendig(ref: string): Promise<number | null | undefined> {
  await ensureGlobalBereich();
  const [z] = (await sqlPool`SELECT zustaendig_agent_id FROM fiaon_global_auftraege WHERE ref = ${ref} LIMIT 1`) as any[];
  if (!z) return undefined;
  return z.zustaendig_agent_id ? Number(z.zustaendig_agent_id) : null;
}

/**
 * Was die Raum-Regel (globalOfficeRaumZugriff) über diese Person wissen muss: Führt sie mindestens
 * einen Auftrag, und steht sie in den Einstellungen als zuständige Person für FIAON Global?
 */
export async function globalBereichRaumLage(agentId: number): Promise<{ fuehrtAuftraege: boolean; istEingestellt: boolean }> {
  await ensureGlobalBereich();
  const [z] = (await sqlPool`SELECT 1 AS da FROM fiaon_global_auftraege WHERE zustaendig_agent_id = ${agentId} LIMIT 1`) as any[];
  const eingestellt = (await globalEinstellungen()).zustaendigAgentId;
  return { fuehrtAuftraege: !!z, istEingestellt: eingestellt != null && eingestellt === agentId };
}

// ── Die Liste im Office ──────────────────────────────────────────────────────
export async function globalBereichListe(wer: { agentId: number; alle: boolean }): Promise<Record<string, unknown>[]> {
  await ensureGlobalBereich();
  const rows = (await sqlPool`
    SELECT g.ref, g.paket_key, g.land, g.firma, g.firma_name, g.status, g.etappe, g.stichtag, g.naechster_schritt, g.naechster_schritt_bis,
           g.zustaendig_agent_id, g.created_at, g.bezahlt_am, g.vertrag_sprache, g.jahresbetreuung, g.jahresbetreuung_preis_cents,
           a.payment_status, a.cancelled_at, a.archived_at, a.amount_due, a.pack_name, z.name AS zustaendig_name
      FROM fiaon_global_auftraege g
      JOIN fiaon_applications a ON a.ref = g.ref
      LEFT JOIN fiaon_agents z ON z.id = g.zustaendig_agent_id
     WHERE a.merged_into IS NULL AND (${wer.alle} OR g.zustaendig_agent_id = ${wer.agentId})
     ORDER BY g.created_at DESC
     LIMIT 300`) as any[];
  if (!rows.length) return [];
  const refs = rows.map((r) => String(r.ref));
  const arten = (await sqlPool`SELECT ref, art FROM fiaon_global_dokumente WHERE geloescht_am IS NULL AND ref = ANY(${refs}) GROUP BY ref, art`) as any[];
  const naechste = (await sqlPool`
    SELECT DISTINCT ON (ref) ref, titel, faellig_am FROM fiaon_global_fristen
     WHERE erledigt_am IS NULL AND ref = ANY(${refs}) ORDER BY ref, faellig_am ASC, id ASC`) as any[];
  const artenJe = new Map<string, string[]>();
  for (const a of arten) artenJe.set(String(a.ref), [...(artenJe.get(String(a.ref)) ?? []), String(a.art)]);
  const fristJe = new Map(naechste.map((f) => [String(f.ref), f]));
  return rows.map((r) => {
    const firma = json<Record<string, any>>(r.firma, {});
    const kat = katalogPaket(r.paket_key);
    const status = bereichStatus(r, r);
    const frist = fristJe.get(String(r.ref));
    return {
      ref: String(r.ref), firma: String(firma.name || r.firma_name || "—"), ort: String(firma.ort || ""), land: String(firma.land || r.land || ""),
      paket: String(r.paket_key), paketName: kat?.label ?? String(r.pack_name || r.paket_key), status,
      etappe: status === "offen" ? 0 : Number(r.etappe || 0),
      ...(r.stichtag ? { stichtag: isoTag(r.stichtag) } : {}),
      ...(r.naechster_schritt ? { naechsterSchritt: { text: String(r.naechster_schritt), ...(r.naechster_schritt_bis ? { bis: isoTag(r.naechster_schritt_bis) } : {}) } } : {}),
      offeneUnterlagen: globalUnterlagenOffen(artenJe.get(String(r.ref)) ?? []),
      ...(frist ? { naechsteFrist: { titel: String(frist.titel), faelligAm: isoTag(frist.faellig_am) } } : {}),
      zustaendig: r.zustaendig_agent_id ? { id: Number(r.zustaendig_agent_id), name: String(r.zustaendig_name || `Mitarbeiter ${r.zustaendig_agent_id}`) } : null,
      alterTage: Math.max(0, Math.floor((Date.now() - new Date(r.created_at).getTime()) / 86_400_000)),
      ...(r.bezahlt_am ? { bezahltAm: iso(r.bezahlt_am) } : {}),
      betragCents: Math.round(Number(r.amount_due || 0) * 100),
      sprache: String(r.vertrag_sprache) === "en" ? "en" : "de",
      // E-196: Marke „Jahresbetreuung gebucht (ab Jahr 2)" in der Liste.
      ...globalJahresbetreuungAus(r),
    };
  });
}

// ── Mails des Bereichs ───────────────────────────────────────────────────────
/** Englische Anrede und englischer Paketname — bis die Nutzlast des Bestellwegs selbst zweisprachig ist. */
function sprachZusatz(l: Lage): Record<string, string> {
  if (l.sprache !== "en") return {};
  const ap = json<Record<string, any>>(l.akte.ansprechpartner, {});
  const nach = String(ap.nachname || "").trim();
  const voll = [ap.vorname, ap.nachname].map((x) => String(x || "").trim()).filter(Boolean).join(" ");
  const anrede = (ap.anrede === "Herr" || ap.anrede === "Frau") && nach ? `Dear ${ap.anrede === "Herr" ? "Mr" : "Ms"} ${nach}` : (voll ? `Dear ${voll}` : "Good day");
  const gp = globalPaket(l.akte.paket_key);
  return { anrede_zeile: escapeHtml(anrede), ...(gp ? { paket: escapeHtml(`FIAON ${gp.en.name}`) } : {}) };
}
async function bereichMail(event: GlobalMail, l: Lage, zusatz: Record<string, string>, ausgeloestVon?: string): Promise<{ ok: boolean; grund: string | null }> {
  return globalMailSenden(event, l.akte, l.b, { zusatz: { ...sprachZusatz(l), ...zusatz }, ausgeloestVon });
}

// ── START: Zahlungseingang = Etappe 1 ────────────────────────────────────────
/** Gerufen aus globalNachZahlung, nachdem der Auftrag „gestartet" ist. Wirkt nur von Etappe 0 aus — wiederholbar. */
export async function globalStartVermerken(ref: string): Promise<boolean> {
  await ensureGlobalBereich();
  const jetzt = new Date().toISOString();
  const [z] = (await sqlPool`
    UPDATE fiaon_global_auftraege
       SET etappe = 1, etappe_seit = NOW(), etappen_seit = COALESCE(etappen_seit, '{}'::jsonb) || ${sqlPool.json({ "1": jetzt })}, updated_at = NOW()
     WHERE ref = ${ref} AND etappe = 0 AND status = 'gestartet'
     RETURNING vertrag_sprache`) as any[];
  if (!z) return false;
  const sprache: BereichSprache = String(z.vertrag_sprache) === "en" ? "en" : "de";
  const T = GLOBAL_VERLAUF_TEXT[sprache];
  await verlaufSchreiben(ref, { art: "start", text: `${T.start} ${T.etappe(1, globalEtappeText(1, sprache).titel)}`, sichtbar: true });
  return true;
}

// ── OFFICE: Etappe, nächster Schritt, Abschluss ──────────────────────────────
export async function globalEtappeSetzen(ref: string, ein: { etappe: unknown; text?: unknown; mitteilen?: unknown }, agent: BereichAgent): Promise<Erg<{ meldung: string }>> {
  const l = await lageLesen(ref);
  if (!l) return nein(404, "Diesen Auftrag gibt es nicht.");
  const nr = Number(ein.etappe);
  if (!Number.isInteger(nr) || nr < 0 || nr > GLOBAL_ETAPPE_MAX) return nein(400, "Bitte eine Etappe von 0 bis 5 wählen.");
  if (!BEZAHLT.includes(l.status)) return nein(409, l.status === "storniert" ? "Der Auftrag ist storniert." : "Etappen beginnen mit dem Zahlungseingang — dieser Auftrag ist noch nicht bezahlt.");
  if (nr === GLOBAL_ETAPPE_MAX) return globalAbschliessen(ref, { text: ein.text, mitteilen: ein.mitteilen }, agent);
  const text = absatz(ein.text, 1000);
  if (text) { const f = kundensatz(text); if (f) return nein(400, f); }
  const seit = { ...l.etappenSeit, [String(nr)]: new Date().toISOString() };
  const warZu = l.status === "abgeschlossen";
  await sqlPool`
    UPDATE fiaon_global_auftraege
       SET etappe = ${nr}, etappe_seit = NOW(), etappen_seit = ${sqlPool.json(seit)},
           status = CASE WHEN status = 'abgeschlossen' THEN 'gestartet' ELSE status END,
           abgeschlossen_am = NULL, updated_at = NOW()
     WHERE ref = ${ref}`;
  const T = GLOBAL_VERLAUF_TEXT[l.sprache];
  const titel = globalEtappeText(nr, l.sprache).titel;
  await verlaufSchreiben(ref, { art: "etappe", text: [warZu ? T.wiederOffen : null, nr === 0 ? titel + "." : T.etappe(nr, titel), text || null].filter(Boolean).join(" "), sichtbar: true, agentId: agent.id });
  if (ein.mitteilen !== true) return { ok: true, meldung: `Etappe ${nr} („${globalEtappeText(nr, "de").titel}“) gesetzt. Der Kunde sieht sie in „Mein Auftrag“; eine Mail ging nicht raus.` };
  const frisch = (await lageLesen(ref)) ?? l;
  const mail = await etappenMail(frisch, nr, text, agent.name);
  return { ok: true, meldung: mail.ok ? `Etappe ${nr} gesetzt und dem Kunden per Mail mitgeteilt.` : `Etappe ${nr} gesetzt — die Mail an den Kunden ging NICHT raus (${mail.grund}).` };
}

async function etappenMail(l: Lage, nr: number, persoenlich: string, wer: string): Promise<{ ok: boolean; grund: string | null }> {
  const e = globalEtappeText(nr, l.sprache);
  const schritt = l.akte.naechster_schritt
    ? `${t(l.sprache, "Ihr nächster Schritt:", "Your next step:")} ${escapeHtml(String(l.akte.naechster_schritt))}${l.akte.naechster_schritt_bis ? ` (${t(l.sprache, "bis zum", "by")} ${globalTagAlsText(isoTag(l.akte.naechster_schritt_bis), l.sprache)})` : ""}`
    : t(l.sprache, "Den Stand, Ihre Dokumente und Ihre Termine finden Sie jederzeit unter „Mein Auftrag“.", "You can find the status, your documents and your dates at any time under “My order”.");
  return bereichMail("global_etappe", l, {
    etappe_marke: nr >= GLOBAL_ETAPPE_MAX ? t(l.sprache, "Abschluss", "Completion") : `${t(l.sprache, "Etappe", "Stage")} ${nr}`,
    etappe_titel: escapeHtml(e.titel), etappe_text: escapeHtml(e.text),
    etappe_weiter: [persoenlich ? escapeHtml(persoenlich).replace(/\n/g, "<br />") : null, schritt].filter(Boolean).join("<br /><br />"),
  }, wer);
}

export async function globalNaechsterSchrittSetzen(ref: string, ein: { text?: unknown; bis?: unknown }, agent: BereichAgent): Promise<Erg<{ meldung: string }>> {
  const l = await lageLesen(ref);
  if (!l) return nein(404, "Diesen Auftrag gibt es nicht.");
  if (l.status === "storniert") return nein(409, "Der Auftrag ist storniert.");
  const text = knapp(ein.text, 500);
  const bis = String(ein.bis ?? "").trim();
  if (bis && !istIsoTag(bis)) return nein(400, "Bitte ein gültiges Datum wählen.");
  if (text) { const f = kundensatz(text); if (f) return nein(400, f); }
  await sqlPool`
    UPDATE fiaon_global_auftraege SET naechster_schritt = ${text || null}, naechster_schritt_bis = ${text && bis ? bis : null}::date, updated_at = NOW()
     WHERE ref = ${ref}`;
  const T = GLOBAL_VERLAUF_TEXT[l.sprache];
  if (text) await verlaufSchreiben(ref, { art: "schritt", text: `${T.schritt(text)}${bis ? ` (${globalTagAlsText(bis, l.sprache)})` : ""}`, sichtbar: true, agentId: agent.id });
  else await verlaufSchreiben(ref, { art: "schritt", text: "Nächster Schritt geleert.", sichtbar: false, agentId: agent.id });
  return { ok: true, meldung: text ? "Der nächste Schritt steht jetzt in „Mein Auftrag“." : "Der nächste Schritt ist geleert." };
}

export async function globalAbschliessen(ref: string, ein: { text?: unknown; mitteilen?: unknown }, agent: BereichAgent): Promise<Erg<{ meldung: string }>> {
  const l = await lageLesen(ref);
  if (!l) return nein(404, "Diesen Auftrag gibt es nicht.");
  if (l.status === "abgeschlossen") return { ok: true, meldung: "Der Auftrag ist bereits abgeschlossen." };
  if (l.status !== "gestartet") return nein(409, l.status === "storniert" ? "Der Auftrag ist storniert." : "Abschließen lässt sich nur ein gestarteter Auftrag.");
  const text = absatz(ein.text, 1000);
  if (text) { const f = kundensatz(text); if (f) return nein(400, f); }
  const seit = { ...l.etappenSeit, [String(GLOBAL_ETAPPE_MAX)]: new Date().toISOString() };
  await sqlPool`
    UPDATE fiaon_global_auftraege
       SET status = 'abgeschlossen', abgeschlossen_am = NOW(), etappe = ${GLOBAL_ETAPPE_MAX}, etappe_seit = NOW(),
           etappen_seit = ${sqlPool.json(seit)}, naechster_schritt = NULL, naechster_schritt_bis = NULL, updated_at = NOW()
     WHERE ref = ${ref} AND status = 'gestartet'`;
  const T = GLOBAL_VERLAUF_TEXT[l.sprache];
  await verlaufSchreiben(ref, { art: "abschluss", text: [T.etappe(GLOBAL_ETAPPE_MAX, ""), text || null].filter(Boolean).join(" "), sichtbar: true, agentId: agent.id });
  // Die Start-Aufgabe ist damit erledigt — sie bliebe sonst für immer offen.
  await aufgabeErledigen(`global:${ref}:start`, `Auftrag abgeschlossen (${agent.name}).`);
  if (ein.mitteilen === false) return { ok: true, meldung: "Auftrag abgeschlossen. Eine Mail ging nicht raus." };
  const frisch = (await lageLesen(ref)) ?? l;
  const mail = await etappenMail(frisch, GLOBAL_ETAPPE_MAX, text, agent.name);
  return { ok: true, meldung: mail.ok ? "Auftrag abgeschlossen; der Kunde hat die Abschlussmail." : `Auftrag abgeschlossen — die Mail an den Kunden ging NICHT raus (${mail.grund}).` };
}

async function aufgabeErledigen(schluessel: string, ergebnis: string): Promise<void> {
  await sqlPool`
    UPDATE fiaon_betreiber_todos SET status = 'erledigt', erledigt_am = COALESCE(erledigt_am, NOW()), ergebnis = COALESCE(ergebnis, ${ergebnis}), updated_at = NOW()
     WHERE schluessel = ${schluessel} AND status <> 'erledigt'`.catch(() => {});
}

// ── OFFICE: Gesellschaft und Regel-Fristen ───────────────────────────────────
export async function globalGesellschaftSetzen(ref: string, ein: Record<string, unknown>, agent: BereichAgent): Promise<Erg<{ meldung: string; fristen: { neu: number; geaendert: number; entfernt: number } }>> {
  const l = await lageLesen(ref);
  if (!l) return nein(404, "Diesen Auftrag gibt es nicht.");
  if (!BEZAHLT.includes(l.status)) return nein(409, "Die US-Gesellschaft lässt sich erst nach dem Zahlungseingang eintragen.");
  const g: GlobalGesellschaft = { ...l.gesellschaft };
  if ("name" in ein) g.name = knapp(ein.name, 160) || null;
  if ("form" in ein) {
    const f = String(ein.form ?? "").trim().toLowerCase();
    if (f && f !== "llc" && f !== "corporation") return nein(400, "Rechtsform: bitte LLC oder Corporation wählen.");
    g.form = f === "llc" ? "LLC" : f === "corporation" ? "Corporation" : null;
  }
  if ("bundesstaat" in ein) {
    const roh = String(ein.bundesstaat ?? "").trim();
    const code = usBundesstaatCode(roh);
    if (roh && !code) return nein(400, "Diesen US-Bundesstaat kennen wir nicht — bitte das Kürzel (z. B. DE, WY, FL, NM) oder den englischen Namen angeben.");
    g.bundesstaat = code;
  }
  if ("gegruendetAm" in ein) {
    const tag = String(ein.gegruendetAm ?? "").trim();
    if (tag && !istIsoTag(tag)) return nein(400, "Gründungstag: bitte ein gültiges Datum wählen.");
    if (tag && tag > berlinToday()) return nein(400, "Der Gründungstag liegt in der Zukunft — eingetragen wird er, wenn die Gesellschaft steht.");
    g.gegruendetAm = tag || null;
  }
  if ("einVorhanden" in ein) g.einVorhanden = ein.einVorhanden === true;
  if ("itinStand" in ein) {
    const s = String(ein.itinStand ?? "").trim().toLowerCase();
    if (s && !["offen", "beantragt", "vorhanden"].includes(s)) return nein(400, "ITIN: bitte offen, beantragt oder vorhanden wählen.");
    g.itinStand = (s || null) as GlobalGesellschaft["itinStand"];
  }
  const ersteGruendung = !l.gesellschaft.gegruendetAm && !!g.gegruendetAm;
  await sqlPool`UPDATE fiaon_global_auftraege SET gesellschaft = ${sqlPool.json(g as any)}, updated_at = NOW() WHERE ref = ${ref}`;
  const T = GLOBAL_VERLAUF_TEXT[l.sprache];
  await verlaufSchreiben(ref, { art: "gesellschaft", text: T.gesellschaft, sichtbar: true, agentId: agent.id });
  const fristen = await regelFristenSetzen(ref, g, l.sprache);
  if (fristen.neu > 0) await verlaufSchreiben(ref, { art: "frist", text: T.kalender(fristen.neu), sichtbar: true, agentId: agent.id });
  // Die Meldung beim heimischen Finanzamt hat kein Datum, das FIAON nennen dürfte — sie wird zum
  // nächsten Schritt, sobald der Gründungstag steht (und nur, wenn dort nichts anderes steht).
  if (ersteGruendung && !l.akte.naechster_schritt) {
    const schritt = globalHeimatMeldungSchritt(l.akte.land, l.sprache);
    await sqlPool`UPDATE fiaon_global_auftraege SET naechster_schritt = ${schritt}, naechster_schritt_bis = NULL, updated_at = NOW() WHERE ref = ${ref} AND naechster_schritt IS NULL`;
    await verlaufSchreiben(ref, { art: "schritt", text: T.schritt(schritt), sichtbar: true, agentId: agent.id });
  }
  const staatOhneRegel = g.bundesstaat && !["DE", "WY", "FL", "NM"].includes(g.bundesstaat);
  const nmCorp = g.bundesstaat === "NM" && g.form === "Corporation";
  const nmLlc = g.bundesstaat === "NM" && !nmCorp;
  return {
    ok: true, fristen,
    meldung: `Gesellschaft gespeichert. Pflichtenkalender: ${fristen.neu} neu, ${fristen.geaendert} geändert, ${fristen.entfernt} entfernt.`
      + (!g.gegruendetAm ? " Ohne Gründungstag entstehen keine Regel-Fristen." : "")
      + (staatOhneRegel || nmCorp ? ` Für ${usBundesstaatName(g.bundesstaat) ?? g.bundesstaat}${nmCorp ? " (Corporation)" : ""} gibt es keine Staatsregel — bitte den Jahresbericht bzw. die Jahressteuer des Bundesstaats von Hand als Frist eintragen.` : "")
      // New Mexico (LLC): nach unserem Stand keine jährliche Meldung an den Staat — aber nicht an einer Primärquelle belegt.
      + (nmLlc ? " New Mexico verlangt von LLCs nach unserem Stand keine jährliche Meldung an den Staat, deshalb steht keine Staatsfrist im Kalender — bitte vom Registered Agent bestätigen lassen und, falls doch eine gilt, von Hand eintragen." : ""),
  };
}

/** Regel-Fristen der nächsten 18 Monate anlegen, nachziehen, überholte entfernen. Erledigtes und Überfälliges bleibt unangetastet. */
export async function regelFristenSetzen(ref: string, g: GlobalGesellschaft, sprache: BereichSprache, heute: string = berlinToday()): Promise<{ neu: number; geaendert: number; entfernt: number }> {
  const soll = globalPflichtFristen(g, heute, sprache);
  const ist = (await sqlPool`SELECT id, regel_key, titel, faellig_am, hinweis, erledigt_am FROM fiaon_global_fristen WHERE ref = ${ref} AND quelle = 'regel'`) as any[];
  const istJe = new Map(ist.map((f) => [String(f.regel_key), f]));
  let neu = 0, geaendert = 0, entfernt = 0;
  for (const s of soll) {
    const da = istJe.get(s.regelKey);
    if (!da) {
      const r = (await sqlPool`
        INSERT INTO fiaon_global_fristen (ref, titel, faellig_am, hinweis, quelle, regel_key)
        VALUES (${ref}, ${s.titel}, ${s.faelligAm}::date, ${s.hinweis}, 'regel', ${s.regelKey})
        ON CONFLICT (ref, regel_key) WHERE regel_key IS NOT NULL DO NOTHING RETURNING id`) as any[];
      if (r.length) neu++;
    } else if (!da.erledigt_am && (isoTag(da.faellig_am) !== s.faelligAm || String(da.titel) !== s.titel || String(da.hinweis ?? "") !== s.hinweis)) {
      const tagNeu = isoTag(da.faellig_am) !== s.faelligAm;
      await sqlPool`
        UPDATE fiaon_global_fristen
           SET titel = ${s.titel}, faellig_am = ${s.faelligAm}::date, hinweis = ${s.hinweis},
               erinnert_30_am = CASE WHEN ${tagNeu} THEN NULL ELSE erinnert_30_am END,
               erinnert_7_am = CASE WHEN ${tagNeu} THEN NULL ELSE erinnert_7_am END
         WHERE id = ${da.id}`;
      geaendert++;
    }
  }
  const sollKeys = new Set(soll.map((s) => s.regelKey));
  for (const f of ist) {
    // Entfernt wird nur, was in der Zukunft liegt, offen ist und von den Regeln nicht mehr kommt
    // (anderer Bundesstaat, andere Rechtsform, anderer Gründungstag). Überfälliges bleibt stehen.
    if (!f.erledigt_am && isoTag(f.faellig_am) >= heute && !sollKeys.has(String(f.regel_key))) {
      await sqlPool`DELETE FROM fiaon_global_fristen WHERE id = ${f.id} AND quelle = 'regel' AND erledigt_am IS NULL`;
      entfernt++;
    }
  }
  return { neu, geaendert, entfernt };
}

// ── OFFICE: Fristen von Hand ─────────────────────────────────────────────────
export async function globalFristAnlegen(ref: string, ein: { titel?: unknown; faelligAm?: unknown; hinweis?: unknown }, agent: BereichAgent): Promise<Erg<{ id: number; meldung: string }>> {
  const l = await lageLesen(ref);
  if (!l) return nein(404, "Diesen Auftrag gibt es nicht.");
  if (!BEZAHLT.includes(l.status)) return nein(409, "Der Pflichtenkalender beginnt mit dem Zahlungseingang.");
  const titel = knapp(ein.titel, 200); const tag = String(ein.faelligAm ?? "").trim(); const hinweis = absatz(ein.hinweis, 1000);
  if (titel.length < 3) return nein(400, "Bitte einen Titel für die Frist angeben.");
  if (!istIsoTag(tag)) return nein(400, "Bitte ein gültiges Datum wählen.");
  const f = kundensatz(`${titel}\n${hinweis}`); if (f) return nein(400, f);
  const [z] = (await sqlPool`
    INSERT INTO fiaon_global_fristen (ref, titel, faellig_am, hinweis, quelle) VALUES (${ref}, ${titel}, ${tag}::date, ${hinweis || null}, 'hand') RETURNING id`) as any[];
  await verlaufSchreiben(ref, { art: "frist", text: GLOBAL_VERLAUF_TEXT[l.sprache].fristNeu(titel, globalTagAlsText(tag, l.sprache)), sichtbar: true, agentId: agent.id });
  return { ok: true, id: Number(z.id), meldung: "Frist eingetragen — der Kunde sieht sie im Pflichtenkalender und wird vor dem Termin erinnert." };
}

export async function globalFristAendern(ref: string, idRoh: unknown, ein: Record<string, unknown>, agent: BereichAgent): Promise<Erg<{ meldung: string }>> {
  const l = await lageLesen(ref);
  if (!l) return nein(404, "Diesen Auftrag gibt es nicht.");
  const id = Number(idRoh);
  const [f] = Number.isInteger(id) && id > 0 ? ((await sqlPool`SELECT id, titel, faellig_am, hinweis, quelle, erledigt_am FROM fiaon_global_fristen WHERE id = ${id} AND ref = ${ref} LIMIT 1`) as any[]) : [];
  if (!f) return nein(404, "Diese Frist gibt es nicht.");
  const regel = String(f.quelle) === "regel";
  let titel = String(f.titel), tag = isoTag(f.faellig_am), hinweis: string | null = f.hinweis ?? null;
  if ("titel" in ein || "faelligAm" in ein || "hinweis" in ein) {
    if (regel) return nein(409, "Titel, Datum und Hinweis einer Regel-Frist kommen aus Bundesstaat und Gründungstag — ändere die Angaben zur Gesellschaft oder lege eine eigene Frist an.");
    if ("titel" in ein) { titel = knapp(ein.titel, 200); if (titel.length < 3) return nein(400, "Bitte einen Titel für die Frist angeben."); }
    if ("faelligAm" in ein) { tag = String(ein.faelligAm ?? "").trim(); if (!istIsoTag(tag)) return nein(400, "Bitte ein gültiges Datum wählen."); }
    if ("hinweis" in ein) hinweis = absatz(ein.hinweis, 1000) || null;
    const w = kundensatz(`${titel}\n${hinweis ?? ""}`); if (w) return nein(400, w);
  }
  const tagNeu = tag !== isoTag(f.faellig_am);
  const erledigt = "erledigt" in ein ? ein.erledigt === true : !!f.erledigt_am;
  await sqlPool`
    UPDATE fiaon_global_fristen
       SET titel = ${titel}, faellig_am = ${tag}::date, hinweis = ${hinweis},
           erledigt_am = CASE WHEN ${erledigt} THEN COALESCE(erledigt_am, NOW()) ELSE NULL END,
           erinnert_30_am = CASE WHEN ${tagNeu} THEN NULL ELSE erinnert_30_am END,
           erinnert_7_am = CASE WHEN ${tagNeu} THEN NULL ELSE erinnert_7_am END
     WHERE id = ${id} AND ref = ${ref}`;
  if (erledigt && !f.erledigt_am) {
    await verlaufSchreiben(ref, { art: "frist", text: GLOBAL_VERLAUF_TEXT[l.sprache].fristErledigt(titel), sichtbar: true, agentId: agent.id });
    await aufgabeErledigen(`global:${ref}:frist:${id}:30`, "Frist als erledigt eingetragen.");
    await aufgabeErledigen(`global:${ref}:frist:${id}:7`, "Frist als erledigt eingetragen.");
  } else {
    await verlaufSchreiben(ref, { art: "frist", text: `Frist „${titel}“ geändert (${globalTagAlsText(tag, "de")}${erledigt ? ", erledigt" : ""}).`, sichtbar: false, agentId: agent.id });
  }
  return { ok: true, meldung: erledigt && !f.erledigt_am ? "Frist als erledigt eingetragen." : "Frist gespeichert." };
}

export async function globalFristLoeschen(ref: string, idRoh: unknown, agent: BereichAgent): Promise<Erg<{ meldung: string }>> {
  await ensureGlobalBereich();
  const id = Number(idRoh);
  const [f] = Number.isInteger(id) && id > 0 ? ((await sqlPool`SELECT id, titel, quelle FROM fiaon_global_fristen WHERE id = ${id} AND ref = ${ref} LIMIT 1`) as any[]) : [];
  if (!f) return nein(404, "Diese Frist gibt es nicht.");
  // Eine Regel-Frist käme beim nächsten Tageslauf wieder — sie wird erledigt, nicht gelöscht.
  if (String(f.quelle) === "regel") return nein(409, "Eine Regel-Frist lässt sich nicht löschen — sie entstünde beim nächsten Tageslauf neu. Trage sie als erledigt ein oder ändere die Angaben zur Gesellschaft.");
  await sqlPool`DELETE FROM fiaon_global_fristen WHERE id = ${id} AND ref = ${ref} AND quelle = 'hand'`;
  await verlaufSchreiben(ref, { art: "frist", text: `Frist „${String(f.titel)}“ gelöscht.`, sichtbar: false, agentId: agent.id });
  return { ok: true, meldung: "Frist gelöscht." };
}

// ── DOKUMENTENRAUM ───────────────────────────────────────────────────────────
export interface DateiEin { buffer: Buffer; originalname: string }

/** Multer liest Dateinamen als Latin-1; stand dort UTF-8 („Ã¼" statt „ü"), wird es hier zurückgeholt. */
function nameAusMultipart(roh: string): string {
  const s = String(roh ?? "");
  if (!/[\u00c2-\u00f4][\u0080-\u00bf]/.test(s)) return s;
  const utf = Buffer.from(s, "latin1").toString("utf8");
  return utf.includes("\ufffd") ? s : utf;
}

async function dokumentSpeichern(z: { ref: string; von: "kunde" | "fiaon"; art: string; dateiname: string; mime: string; inhalt: Buffer; sichtbar: boolean; agentId: number | null }): Promise<{ id: number; am: string; doppelt: boolean }> {
  const hash = createHash("sha256").update(z.inhalt).digest("hex");
  // Dieselbe Datei noch einmal (Doppelklick, „Zurück und erneut senden") ist kein zweites Dokument.
  const [da] = (await sqlPool`
    SELECT id, created_at FROM fiaon_global_dokumente
     WHERE ref = ${z.ref} AND von = ${z.von} AND art = ${z.art} AND doc_hash = ${hash} AND geloescht_am IS NULL LIMIT 1`) as any[];
  if (da) return { id: Number(da.id), am: iso(da.created_at)!, doppelt: true };
  const [neu] = (await sqlPool`
    INSERT INTO fiaon_global_dokumente (ref, von, art, dateiname, mime, groesse, inhalt, doc_hash, sichtbar_fuer_kunde, hochgeladen_von_agent)
    VALUES (${z.ref}, ${z.von}, ${z.art}, ${z.dateiname}, ${z.mime}, ${z.inhalt.length}, ${z.inhalt}, ${hash}, ${z.sichtbar}, ${z.agentId})
    RETURNING id, created_at`) as any[];
  return { id: Number(neu.id), am: iso(neu.created_at)!, doppelt: false };
}

/** Der Kunde hat etwas in den Dokumentenraum gelegt — die zuständige Person erfährt es (eine Aufgabe je Tag, weitere Uploads als Kommentar). */
async function eingangMelden(l: Lage, zeile: string): Promise<void> {
  try {
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    const firma = String(l.akte.firma_name || l.ref);
    const arten = (await sqlPool`SELECT DISTINCT art FROM fiaon_global_dokumente WHERE ref = ${l.ref} AND geloescht_am IS NULL`) as any[];
    const offen = globalUnterlagenOffen(arten.map((a) => String(a.art)));
    await auftragFuerKunden({
      personId: l.b.person_id != null ? Number(l.b.person_id) : null, ref: l.ref,
      titel: `FIAON Global: neue Unterlagen — ${firma}`,
      text: `${zeile} ${offen === 0 ? "Damit liegen ALLE Unterlagen der Liste vor." : `Es fehlen noch ${offen} von 5 Unterlagen der Liste.`} Bitte ansehen und prüfen: ${globalOfficeAuftragPfad(l.ref)}`,
      schluessel: `global:${l.ref}:eingang:${berlinToday()}`, bereich: "konten", quelle: "global", autorName: "FIAON Global",
      link: globalOfficeAuftragPfad(l.ref),
      agentId: (l.akte.zustaendig_agent_id ? Number(l.akte.zustaendig_agent_id) : null) ?? (await globalEinstellungen()).zustaendigAgentId,
      anlageText: "Der Kunde hat in „Mein Auftrag“ etwas hochgeladen.",
    });
    if (offen === 0) await aufgabeErledigen(`global:${l.ref}:unterlagen`, "Alle Unterlagen der Liste liegen vor.");
  } catch (e) { console.error(`[GLOBAL-BEREICH] ${l.ref}: Aufgabe zum Eingang nicht angelegt:`, e); }
}

/** POST /global/mein-auftrag/:ref/dokument — EINE Datei des Kunden. */
export async function globalKundenDokument(ref: string, ein: { art: unknown; datei: DateiEin | null }): Promise<Erg<{ dokument: Record<string, unknown> }>> {
  const l = await lageLesen(ref);
  if (!l) return nein(404, "Wir finden zu diesem Link keinen Auftrag.");
  const s = l.sprache;
  if (!LAEUFT.includes(l.status)) {
    return nein(409, l.status === "offen"
      ? t(s, "Ihr Dokumentenraum öffnet sich mit dem Zahlungseingang. Bis dahin müssen Sie nichts hochladen.", "Your document room opens once your payment has arrived. Until then there is nothing to upload.")
      : t(s, "Zu diesem Auftrag können keine Dokumente mehr hochgeladen werden. Bitte schreiben Sie Ihrem Ansprechpartner eine Nachricht.", "Documents can no longer be uploaded for this order. Please send your contact a message."));
  }
  const art = globalDokumentArt(ein.art);
  if (!art || !globalKundeDarfArt(art.art)) return nein(400, t(s, "Bitte wählen Sie, um welche Unterlage es sich handelt.", "Please choose which document this is."));
  const datei = ein.datei;
  if (!datei?.buffer?.length) return nein(400, t(s, "Es ist keine Datei angekommen. Bitte versuchen Sie es noch einmal.", "No file arrived. Please try again."));
  if (datei.buffer.length > GLOBAL_DATEI_MAX_BYTES) return nein(400, t(s, "Die Datei ist größer als 15 MB. Bitte speichern Sie sie kleiner oder teilen Sie sie auf.", "The file is larger than 15 MB. Please save a smaller version or split it."));
  const typ = globalDateiTyp(datei.buffer);
  if (!typ) return nein(400, t(s, "Diese Datei können wir nicht annehmen. Möglich sind PDF, JPG, PNG und HEIC.", "We cannot accept this file. PDF, JPG, PNG and HEIC are possible."));
  const [anz] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_global_dokumente WHERE ref = ${ref} AND von = 'kunde' AND geloescht_am IS NULL`) as any[];
  if (Number(anz?.n || 0) >= GLOBAL_DOKUMENTE_MAX) return nein(409, t(s, "In Ihrem Dokumentenraum liegen bereits vierzig Dokumente. Bitte schreiben Sie Ihrem Ansprechpartner, wenn noch etwas fehlt.", "Your document room already holds forty documents. Please message your contact if something is still missing."));
  const name = globalDateiname(nameAusMultipart(datei.originalname), typ.endung);
  const d = await dokumentSpeichern({ ref, von: "kunde", art: art.art, dateiname: name, mime: typ.mime, inhalt: datei.buffer, sichtbar: true, agentId: null });
  if (!d.doppelt) {
    await verlaufSchreiben(ref, { art: "dokument", text: GLOBAL_VERLAUF_TEXT[s].dokumentKunde(globalDokumentArtText(art.art, s), name), sichtbar: true, von: "kunde" });
    await eingangMelden(l, `Der Kunde hat hochgeladen: ${art.de} („${name}“).`);
  }
  return { ok: true, dokument: { id: d.id, art: art.art, artText: globalDokumentArtText(art.art, s), name, groesse: datei.buffer.length, von: "kunde", am: d.am } };
}

/** POST /agent/global/auftraege/:ref/dokument — FIAON legt ein Dokument ab. */
export async function globalOfficeDokument(ref: string, ein: { art: unknown; datei: DateiEin | null; sichtbarFuerKunde: boolean; mitteilen: boolean }, agent: BereichAgent): Promise<Erg<{ dokument: Record<string, unknown>; meldung: string }>> {
  const l = await lageLesen(ref);
  if (!l) return nein(404, "Diesen Auftrag gibt es nicht.");
  if (!BEZAHLT.includes(l.status)) return nein(409, l.status === "storniert" ? "Der Auftrag ist storniert." : "Der Dokumentenraum öffnet sich mit dem Zahlungseingang.");
  const art = globalDokumentArt(ein.art);
  if (!art) return nein(400, "Bitte die Art des Dokuments wählen.");
  const datei = ein.datei;
  if (!datei?.buffer?.length) return nein(400, "Es ist keine Datei angekommen.");
  if (datei.buffer.length > GLOBAL_DATEI_MAX_BYTES) return nein(400, "Die Datei ist größer als 15 MB.");
  const typ = globalDateiTyp(datei.buffer);
  if (!typ) return nein(400, "Diese Datei lässt sich nicht ablegen. Möglich sind PDF, JPG, PNG und HEIC — geprüft wird der Inhalt, nicht die Endung.");
  const [anz] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_global_dokumente WHERE ref = ${ref} AND von = 'fiaon' AND geloescht_am IS NULL`) as any[];
  if (Number(anz?.n || 0) >= GLOBAL_DOKUMENTE_MAX) return nein(409, "Für diesen Auftrag liegen schon vierzig Dokumente von FIAON im Raum. Bitte erst Überholtes entfernen.");
  const name = globalDateiname(nameAusMultipart(datei.originalname), typ.endung);
  const d = await dokumentSpeichern({ ref, von: "fiaon", art: art.art, dateiname: name, mime: typ.mime, inhalt: datei.buffer, sichtbar: ein.sichtbarFuerKunde, agentId: agent.id });
  const dokument = { id: d.id, art: art.art, artText: art.de, name, groesse: datei.buffer.length, von: "fiaon", am: d.am, sichtbarFuerKunde: ein.sichtbarFuerKunde };
  if (d.doppelt) return { ok: true, dokument, meldung: "Genau diese Datei liegt schon im Dokumentenraum — sie wurde nicht noch einmal abgelegt." };
  await verlaufSchreiben(ref, {
    art: "dokument", sichtbar: ein.sichtbarFuerKunde, agentId: agent.id,
    text: ein.sichtbarFuerKunde ? GLOBAL_VERLAUF_TEXT[l.sprache].dokumentFiaon(globalDokumentArtText(art.art, l.sprache), name) : `Internes Dokument abgelegt: ${art.de} („${name}“).`,
  });
  if (!ein.sichtbarFuerKunde) return { ok: true, dokument, meldung: "Dokument intern abgelegt — der Kunde sieht es nicht." };
  if (!ein.mitteilen) return { ok: true, dokument, meldung: "Dokument abgelegt. Der Kunde sieht es in „Mein Auftrag“; eine Mail ging nicht raus." };
  // Höchstens eine Mail je Auftrag in zehn Minuten — wer fünf Dokumente nacheinander ablegt, schreibt dem Kunden nicht fünfmal.
  const [kuerzlich] = (await sqlPool`SELECT id FROM fiaon_global_verlauf WHERE ref = ${ref} AND art = 'mail_dokument' AND created_at > NOW() - INTERVAL '10 minutes' LIMIT 1`) as any[];
  if (kuerzlich) return { ok: true, dokument, meldung: "Dokument abgelegt. Der Kunde hat in den letzten zehn Minuten schon eine Mail zu einem neuen Dokument bekommen — eine zweite ging nicht raus." };
  const mail = await bereichMail("global_dokument", l, { dokument_art: escapeHtml(globalDokumentArtText(art.art, l.sprache)), dokument_name: escapeHtml(name) }, agent.name);
  if (mail.ok) await verlaufSchreiben(ref, { art: "mail_dokument", text: `Mail „neues Dokument“ an den Kunden (${name}).`, sichtbar: false, agentId: agent.id });
  return { ok: true, dokument, meldung: mail.ok ? "Dokument abgelegt und dem Kunden per Mail mitgeteilt." : `Dokument abgelegt — die Mail an den Kunden ging NICHT raus (${mail.grund}).` };
}

/** Ein Dokument zum Ausliefern. Der Kunde bekommt nur Eigenes und Freigegebenes; Gelöschtes bekommt niemand. */
export async function globalDokumentLesen(ref: string, idRoh: unknown, fuer: "kunde" | "office"): Promise<{ inhalt: Buffer; mime: string; dateiname: string } | null> {
  await ensureGlobalBereich();
  const id = Number(idRoh);
  if (!Number.isInteger(id) || id <= 0) return null;
  const [d] = (await sqlPool`
    SELECT inhalt, mime, dateiname, von, sichtbar_fuer_kunde FROM fiaon_global_dokumente
     WHERE id = ${id} AND ref = ${ref} AND geloescht_am IS NULL LIMIT 1`) as any[];
  if (!d?.inhalt) return null;
  if (fuer === "kunde" && d.von !== "kunde" && !d.sichtbar_fuer_kunde) return null;
  return { inhalt: Buffer.from(d.inhalt), mime: String(d.mime), dateiname: String(d.dateiname) };
}

export async function globalDokumentEntfernen(ref: string, idRoh: unknown, agent: BereichAgent): Promise<Erg<{ meldung: string }>> {
  await ensureGlobalBereich();
  const id = Number(idRoh);
  const [d] = Number.isInteger(id) && id > 0 ? ((await sqlPool`
    UPDATE fiaon_global_dokumente SET geloescht_am = NOW() WHERE id = ${id} AND ref = ${ref} AND geloescht_am IS NULL RETURNING dateiname, art, von`) as any[]) : [];
  if (!d) return nein(404, "Dieses Dokument gibt es nicht (mehr).");
  await verlaufSchreiben(ref, { art: "dokument", text: `Dokument entfernt: ${globalDokumentArtText(d.art, "de")} („${String(d.dateiname)}“, abgelegt von ${d.von === "kunde" ? "Kunde" : "FIAON"}).`, sichtbar: false, agentId: agent.id });
  return { ok: true, meldung: "Dokument entfernt. Es bleibt in der Datenbank erhalten, ist aber für niemanden mehr abrufbar." };
}

// ── KUNDE: Nachricht ─────────────────────────────────────────────────────────
/**
 * POST /global/mein-auftrag/:ref/nachricht { text, art? } — Aufgabe an die zuständige Person und
 * eine Zeile im Verlauf. Mit `art` „namenswunsch" oder „taetigkeitsbeschreibung" wird der Text
 * stattdessen als Unterlage in den Dokumentenraum gelegt (Textdatei) — diese beiden müssen keine Datei sein.
 */
export async function globalKundenNachricht(ref: string, ein: { text: unknown; art?: unknown }): Promise<Erg<{ meldung: string; dokument?: Record<string, unknown> }>> {
  const l = await lageLesen(ref);
  if (!l) return nein(404, "Wir finden zu diesem Link keinen Auftrag.");
  const s = l.sprache;
  const text = absatz(ein.text, 2000);
  if (text.length < 1) return nein(400, t(s, "Bitte schreiben Sie Ihre Nachricht in das Feld.", "Please enter your message."));
  if (String(ein.text ?? "").length > 2000) return nein(400, t(s, "Ihre Nachricht ist länger als 2.000 Zeichen. Bitte kürzen Sie sie oder senden Sie zwei Nachrichten.", "Your message is longer than 2,000 characters. Please shorten it or send two messages."));
  if (l.status === "storniert") return nein(409, t(s, "Dieser Auftrag ist storniert. Bitte schreiben Sie uns an support@fiaon.com.", "This order has been cancelled. Please write to support@fiaon.com."));
  const firma = String(l.akte.firma_name || ref);

  const artRoh = String(ein.art ?? "").trim().toLowerCase();
  if (artRoh) {
    const art = globalDokumentArt(artRoh);
    if (!art || !GLOBAL_TEXT_UNTERLAGEN.includes(art.art)) return nein(400, t(s, "Diese Unterlage lässt sich nicht als Text einreichen — bitte laden Sie eine Datei hoch.", "This document cannot be submitted as text — please upload a file."));
    if (!LAEUFT.includes(l.status)) return nein(409, t(s, "Ihr Dokumentenraum öffnet sich mit dem Zahlungseingang.", "Your document room opens once your payment has arrived."));
    const [anz] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_global_dokumente WHERE ref = ${ref} AND von = 'kunde' AND geloescht_am IS NULL`) as any[];
    if (Number(anz?.n || 0) >= GLOBAL_DOKUMENTE_MAX) return nein(409, t(s, "In Ihrem Dokumentenraum liegen bereits vierzig Dokumente.", "Your document room already holds forty documents."));
    const name = `${art.art === "namenswunsch" ? t(s, "Namenswunsch", "Preferred-name") : t(s, "Geschaeftstaetigkeit", "Business-activity")}_${berlinToday()}.txt`;
    const d = await dokumentSpeichern({ ref, von: "kunde", art: art.art, dateiname: name, mime: "text/plain", inhalt: Buffer.from(text, "utf8"), sichtbar: true, agentId: null });
    if (!d.doppelt) {
      await verlaufSchreiben(ref, { art: "dokument", text: GLOBAL_VERLAUF_TEXT[s].dokumentKunde(globalDokumentArtText(art.art, s), name), sichtbar: true, von: "kunde" });
      await eingangMelden(l, `Der Kunde hat als Text eingereicht: ${art.de} — „${text.slice(0, 300)}${text.length > 300 ? " …" : ""}“.`);
    }
    return { ok: true, meldung: t(s, "Danke — Ihre Angabe liegt in Ihrem Dokumentenraum.", "Thank you — your entry is in your document room."), dokument: { id: d.id, art: art.art, artText: globalDokumentArtText(art.art, s), name, groesse: Buffer.byteLength(text, "utf8"), von: "kunde", am: d.am } };
  }

  // Erst die Aufgabe, dann die Antwort: Der Satz „… liest sie" gilt nur, wenn es bei jemandem liegt.
  let empfaenger: string | null = null;
  try {
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    const erg = await auftragFuerKunden({
      personId: l.b.person_id != null ? Number(l.b.person_id) : null, ref,
      titel: `FIAON Global: Nachricht von ${firma}`,
      text: `Nachricht aus „Mein Auftrag“ (${globalTagAlsText(berlinToday(), "de")}):\n„${text}“\nBitte antworten — per Telefon oder Mail — und im Auftrag eine sichtbare Notiz hinterlassen: ${globalOfficeAuftragPfad(ref)}`,
      dringend: false, schluessel: `global:${ref}:nachricht:${berlinToday()}`, bereich: "konten", quelle: "global", autorName: "FIAON Global",
      link: globalOfficeAuftragPfad(ref),
      agentId: (l.akte.zustaendig_agent_id ? Number(l.akte.zustaendig_agent_id) : null) ?? (await globalEinstellungen()).zustaendigAgentId,
      anlageText: "Der Kunde hat in „Mein Auftrag“ geschrieben.",
    });
    if (!erg.id) throw new Error("Aufgabe nicht angelegt");
    empfaenger = erg.kundenName ?? erg.agentName ?? null;
  } catch (e) {
    console.error(`[GLOBAL-BEREICH] ${ref}: Nachricht des Kunden nicht zugestellt:`, e);
    return nein(500, t(s, "Ihre Nachricht konnte gerade nicht zugestellt werden — bitte versuchen Sie es in einer Minute noch einmal.", "Your message could not be delivered just now — please try again in a minute."));
  }
  await verlaufSchreiben(ref, { art: "nachricht", text: GLOBAL_VERLAUF_TEXT[s].nachricht(text), sichtbar: true, von: "kunde" });
  return { ok: true, meldung: empfaenger ? t(s, `Danke — Ihre Nachricht liegt bei ${empfaenger}.`, `Thank you — your message is with ${empfaenger}.`) : t(s, "Danke — Ihre Nachricht ist angekommen.", "Thank you — your message has arrived.") };
}

// ── OFFICE: Notiz, Stichtag, Zugang ──────────────────────────────────────────
export async function globalNotizSchreiben(ref: string, ein: { text?: unknown; sichtbar?: unknown }, agent: BereichAgent): Promise<Erg<{ meldung: string }>> {
  const l = await lageLesen(ref);
  if (!l) return nein(404, "Diesen Auftrag gibt es nicht.");
  const text = absatz(ein.text, 2000);
  if (text.length < 2) return nein(400, "Bitte einen Text eingeben.");
  const sichtbar = ein.sichtbar === true;
  if (sichtbar) { const f = kundensatz(text); if (f) return nein(400, f); }
  await verlaufSchreiben(ref, { art: "notiz", text, sichtbar, agentId: agent.id });
  return { ok: true, meldung: sichtbar ? "Notiz gespeichert — der Kunde sieht sie in seinem Verlauf." : "Interne Notiz gespeichert." };
}

/** Der Stichtag über die EINE Funktion des Bestellwegs — und danach die Zeile im Verlauf, die der Kunde liest. */
export async function globalBereichStichtag(ref: string, stichtag: unknown, wer: string, mitteilen: boolean, agentId: number | null = null): Promise<{ ok: boolean; error?: string; meldung?: string }> {
  const erg = await globalStichtagSetzen(ref, stichtag, wer, mitteilen);
  if (!erg.ok) return erg;
  try {
    await ensureGlobalBereich();
    const akte = await globalAkteLesen(ref);
    const sprache = globalSpracheVon(akte);
    await verlaufSchreiben(ref, { art: "stichtag", text: GLOBAL_VERLAUF_TEXT[sprache].stichtag(globalTagAlsText(String(stichtag ?? "").trim(), sprache)), sichtbar: true, agentId });
  } catch (e) { console.error(`[GLOBAL-BEREICH] ${ref}: Stichtag nicht im Verlauf vermerkt:`, e); }
  return erg;
}

export async function globalZugangSenden(ref: string, agent: BereichAgent): Promise<Erg<{ meldung: string }>> {
  const l = await lageLesen(ref);
  if (!l) return nein(404, "Diesen Auftrag gibt es nicht.");
  if (l.status === "storniert") return nein(409, "Der Auftrag ist storniert.");
  const mail = await bereichMail("global_zugang", l, {}, agent.name);
  if (!mail.ok) return nein(502, `Die Mail ging nicht raus: ${mail.grund}`);
  await verlaufSchreiben(ref, { art: "zugang", text: `Link zu „Mein Auftrag“ an ${String(l.akte.email || "den Kunden")} geschickt.`, sichtbar: false, agentId: agent.id });
  return { ok: true, meldung: `Der Link zu „Mein Auftrag“ ist unterwegs an ${String(l.akte.email || "den Kunden")}.` };
}

// ── KUNDE: Zugang neu anfordern ──────────────────────────────────────────────
const zugangJeIp = fensterDrossel(5, 15 * 60_000);
const zugangJeMail = fensterDrossel(1, 10 * 60_000);

/**
 * POST /global/zugang { email } — antwortet IMMER gleich und sofort; gearbeitet wird dahinter.
 * Gibt es zu der Adresse Aufträge, geht je Auftrag (höchstens fünf, keine stornierten) eine Mail
 * `global_zugang` mit frischem Link an GENAU diese Adresse — nie an eine andere.
 */
export function globalZugangAnfordern(emailRoh: unknown, ip: string): void {
  const email = String(emailRoh ?? "").trim().toLowerCase().slice(0, 160);
  if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email)) return;
  if (zugangJeIp(ip || "—") || zugangJeMail(email)) return;
  void (async () => {
    await ensureGlobalBereich();
    const rows = (await sqlPool`SELECT ref FROM fiaon_global_auftraege WHERE LOWER(email) = ${email} ORDER BY created_at DESC LIMIT 5`) as any[];
    for (const r of rows) {
      const l = await lageLesen(String(r.ref));
      if (!l || l.status === "storniert") continue;
      const mail = await bereichMail("global_zugang", l, {}, "Kunde (Zugang angefordert)");
      await verlaufSchreiben(l.ref, { art: "zugang", text: mail.ok ? "Der Kunde hat einen neuen Link zu „Mein Auftrag“ angefordert — verschickt." : `Der Kunde hat einen neuen Link angefordert — die Mail ging NICHT raus (${mail.grund}).`, sichtbar: false });
    }
  })().catch((e) => console.error("[GLOBAL-BEREICH] Zugang anfordern:", e));
}

// ── TAGESLAUF ────────────────────────────────────────────────────────────────
export interface GlobalTageslaufErgebnis { ruhe: boolean; regelFristen: number; fristMails: number; fristAufgaben: number; durchgaenge: number; unterlagen: number; jahresbetreuung: number; fehler: number }

/** Gibt es die Aufgabe schon? auftragFuerKunden würde eine ERLEDIGTE wieder öffnen — deshalb vorher nachsehen (Muster Fristenwächter). */
async function aufgabeDa(schluessel: string): Promise<boolean> {
  const { todoSchluesselVorhanden } = await import("../routes/fiaon-betreiber-todo");
  return (await todoSchluesselVorhanden([schluessel])).has(schluessel);
}

/** Minuten seit Mitternacht in Berlin — aus dem Offset von fiaon-time.ts (formatToParts), nie aus Number(Intl.format()). */
function berlinMinutenVon(jetzt: Date): number {
  const roh = jetzt.getUTCHours() * 60 + jetzt.getUTCMinutes() + berlinOffsetMinutes(jetzt);
  return ((roh % 1440) + 1440) % 1440;
}

/**
 * `global_tageslauf` — stündlicher Takt (fiaon-crons.ts), gearbeitet wird nur am Tag (Berliner Zeit,
 * globalTageslaufFenster): Der Lauf schreibt Firmenkunden und Mitarbeitern, und beides gehört nicht
 * in die Nacht. Bewusst OHNE `alleXStunden`: Ein 20-Stunden-Abstand wandert jeden Tag vier Stunden
 * nach vorn und landet nach drei Tagen um zwei Uhr nachts. Alles hier ist über Marken-Spalten bzw.
 * Aufgaben-Schlüssel wiederholbar — ein zweiter Lauf am selben Tag findet nichts mehr zu tun —, und
 * ein Auftrag, der klemmt, hält die anderen nicht auf.
 *   (0) Regel-Fristen laufender Aufträge nachziehen — das 18-Monats-Fenster wandert mit.
 *   (a) Fristen: rund einen Monat und rund eine Woche vorher Mail `global_frist` an den Kunden
 *       (gestartet und abgeschlossen) und eine Aufgabe an die zuständige Person (gestartet — oder
 *       wenn die Mail nicht rausging: dann muss ein Mensch erinnern). Je Marke GENAU einmal: Die
 *       Marke wird vor dem Versand gesetzt und nie zurückgenommen; scheitert die Mail, steht es in
 *       der Aufgabe und im Verlauf.
 *   (b) Monatlicher Durchgang (Banking, Kapital, VIP; nur gestartet): Aufgabe am Monatstag des Starts.
 *   (c) Unterlagen: fünf Tage nach dem Start unvollständig → EINE Aufgabe. Keine Kundenmail.
 *   (d) Jahresbetreuung (19.09.2026, E-196; gestartet UND abgeschlossen — ein Paket ist nach Wochen
 *       geliefert, der Jahrestag kommt danach): rund einen Monat vor dem ersten Jahrestag der Gründung
 *       (ohne Gründungstag: des Starts) EINE Aufgabe an die zuständige Person — „Jahresbetreuung:
 *       Rechnung für das zweite Betreuungsjahr stellen". Kein Termin im Kalender des Kunden, keine Mail.
 * Legt selbst keine Auftragstabelle an: Ohne den ersten Auftrag gibt es nichts zu tun.
 */
export async function globalTageslauf(jetzt: Date = new Date()): Promise<GlobalTageslaufErgebnis> {
  const erg: GlobalTageslaufErgebnis = { ruhe: false, regelFristen: 0, fristMails: 0, fristAufgaben: 0, durchgaenge: 0, unterlagen: 0, jahresbetreuung: 0, fehler: 0 };
  if (!globalTageslaufFenster(berlinMinutenVon(jetzt))) { erg.ruhe = true; return erg; }
  const [tabelle] = (await sqlPool`SELECT to_regclass('public.fiaon_global_auftraege') AS da`) as any[];
  if (!tabelle?.da) return erg;
  await ensureGlobalBereich();
  const heute = berlinToday(jetzt);
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  const einstellungen = await globalEinstellungen();

  const auftraege = (await sqlPool`
    SELECT g.ref, g.status, g.paket_key, g.firma_name, g.gestartet_am, g.gesellschaft, g.vertrag_sprache, g.zustaendig_agent_id, a.person_id,
           g.jahresbetreuung, g.jahresbetreuung_preis_cents
      FROM fiaon_global_auftraege g JOIN fiaon_applications a ON a.ref = g.ref
     WHERE g.status IN ('gestartet', 'abgeschlossen') AND a.payment_status = 'paid'
       AND a.cancelled_at IS NULL AND a.archived_at IS NULL AND a.merged_into IS NULL`) as any[];

  for (const g of auftraege) {
    const ref = String(g.ref);
    const firma = String(g.firma_name || ref);
    const sprache: BereichSprache = String(g.vertrag_sprache) === "en" ? "en" : "de";
    const zustaendig = (g.zustaendig_agent_id ? Number(g.zustaendig_agent_id) : null) ?? einstellungen.zustaendigAgentId;
    const laeuft = String(g.status) === "gestartet";
    const aufgabe = (schluessel: string, titel: string, text: string, faelligAm: string, dringend = false) => auftragFuerKunden({
      personId: g.person_id != null ? Number(g.person_id) : null, ref, titel, text, faelligAm, dringend, schluessel,
      bereich: "konten", quelle: "global", autorName: "FIAON Global", link: globalOfficeAuftragPfad(ref), agentId: zustaendig,
      anlageText: "Vom Tageslauf für FIAON Global angelegt.",
    });
    try {
      // (0) Das Fenster der Regel-Fristen wandert — nur solange der Auftrag läuft. Nach dem Abschluss
      //     laufen die schon eingetragenen Termine aus; neue kommen nicht mehr dazu.
      if (laeuft) {
        const r = await regelFristenSetzen(ref, json<GlobalGesellschaft>(g.gesellschaft, {}), sprache, heute);
        erg.regelFristen += r.neu;
      }

      // (a) Fristen — welche Marke heute dran ist, sagt die reine Regel (globalFristMarke).
      const fristen = (await sqlPool`
        SELECT id, titel, faellig_am, hinweis, erinnert_30_am, erinnert_7_am FROM fiaon_global_fristen
         WHERE ref = ${ref} AND erledigt_am IS NULL AND faellig_am >= ${heute}::date AND faellig_am <= ${isoPlusTage(heute, 30)}::date
           AND (erinnert_30_am IS NULL OR erinnert_7_am IS NULL)
         ORDER BY faellig_am ASC, id ASC`) as any[];
      for (const f of fristen) {
        const tag = isoTag(f.faellig_am);
        const marke = globalFristMarke(tag, heute, { m30: !!f.erinnert_30_am, m7: !!f.erinnert_7_am });
        if (!marke) continue;
        // Die Marke zuerst — sie ist die Sperre gegen eine zweite Instanz und gegen den nächsten Takt.
        const frei = marke === 7
          ? ((await sqlPool`UPDATE fiaon_global_fristen SET erinnert_7_am = NOW(), erinnert_30_am = COALESCE(erinnert_30_am, NOW()) WHERE id = ${f.id} AND erinnert_7_am IS NULL AND erledigt_am IS NULL RETURNING id`) as any[])
          : ((await sqlPool`UPDATE fiaon_global_fristen SET erinnert_30_am = NOW() WHERE id = ${f.id} AND erinnert_30_am IS NULL AND erledigt_am IS NULL RETURNING id`) as any[]);
        if (!frei.length) continue;
        const l = await lageLesen(ref);
        if (!l || l.status === "storniert") continue;
        const mail = await bereichMail("global_frist", l, {
          frist_titel: escapeHtml(String(f.titel)), frist_datum: globalTagAlsText(tag, sprache), frist_abstand: globalFristAbstandText(marke, sprache),
          frist_hinweis: escapeHtml(String(f.hinweis || GLOBAL_FRIST_STANDARDHINWEIS[sprache])),
        }, "Tageslauf (Pflichtenkalender)");
        const wann = marke === 7 ? "rund eine Woche" : "rund einen Monat";
        if (mail.ok) {
          erg.fristMails++;
          await verlaufSchreiben(ref, { art: "erinnerung", text: `Erinnerung an „${String(f.titel)}“ (${globalTagAlsText(tag, "de")}) an den Kunden geschickt — ${wann} vorher.`, sichtbar: false });
        } else {
          erg.fehler++;
          console.error(`[GLOBAL-TAGESLAUF] ${ref}: Frist-Mail ${f.id}/${marke} ging nicht raus: ${mail.grund}`);
          await verlaufSchreiben(ref, { art: "erinnerung", text: `Erinnerung an „${String(f.titel)}“ (${globalTagAlsText(tag, "de")}, ${wann} vorher) ging NICHT raus: ${mail.grund ?? "unbekannt"}. Die zuständige Person hat eine Aufgabe.`, sichtbar: false });
        }
        // Die Aufgabe: solange der Auftrag läuft immer — und sonst dann, wenn die Mail nicht rausging.
        const schluessel = `global:${ref}:frist:${f.id}:${marke}`;
        if ((laeuft || !mail.ok) && !(await aufgabeDa(schluessel))) {
          await aufgabe(schluessel, `FIAON Global: Frist ${marke === 7 ? "in einer Woche" : "in einem Monat"} — ${firma}`,
            `„${String(f.titel)}“ ist am ${globalTagAlsText(tag, "de")} fällig. Der Kunde ${mail.ok ? "hat heute die Erinnerung per Mail bekommen" : `hat KEINE Erinnerung bekommen — die Mail ging nicht raus (${mail.grund ?? "unbekannt"}); bitte erinnere ihn selbst, eine zweite Mail kommt nicht von allein`}. Bitte klären, ob Steuerberater bzw. US-CPA die Sache führen, und die Frist im Auftrag als erledigt eintragen, sobald sie es ist: ${globalOfficeAuftragPfad(ref)}`,
            marke === 7 || !mail.ok ? heute : isoPlusTage(heute, 2), marke === 7 || !mail.ok);
          erg.fristAufgaben++;
        }
      }

      // (d) Jahresbetreuung — auch nach dem Abschluss: Der erste Jahrestag liegt fast immer dahinter. Die Regel
      //     (rund einen Monat vor dem Jahrestag) steht rein in shared/fiaon-global-bereich.ts; der Schlüssel
      //     macht die Aufgabe einmalig — auch wenn der Gründungstag später noch eingetragen wird.
      const jb = globalJahresbetreuungAus(g);
      if (jb.jahresbetreuung) {
        const plan = globalJahresbetreuungRechnungAb({
          gegruendetAm: json<GlobalGesellschaft>(g.gesellschaft, {}).gegruendetAm ?? null,
          gestartetAm: g.gestartet_am ? berlinDatum(new Date(g.gestartet_am)) : null,
        });
        const schluessel = `global:${ref}:jahresbetreuung:2`;
        if (plan && heute >= plan.rechnungAb && !(await aufgabeDa(schluessel))) {
          const preis = globalEur(jb.jahresbetreuungPreisCents ?? 0);
          await aufgabe(schluessel, `Jahresbetreuung: Rechnung für das zweite Betreuungsjahr stellen — ${firma}`, [
            `${firma} hat im Auftrag die Jahresbetreuung gebucht: ${preis} je Betreuungsjahr, alle Gebühren inklusive — auch die Staatsgebühr des Bundesstaats.`,
            `Das zweite Jahr beginnt am ${globalTagAlsText(plan.jahrestag, "de")} (erster Jahrestag ${plan.basis === "gruendung" ? "der Gründung" : "des Starts — der Gründungstag ist im Auftrag noch nicht eingetragen"}).`,
            `Bitte die Rechnung für das zweite Betreuungsjahr über ${preis} stellen und dem Kunden schicken. Sie entsteht nicht von selbst — stell sie mit der Leitung aus.`,
            "Mit der Zahlung beginnt das Betreuungsjahr: Registered Agent, US-Adresse, Telefonnummer, US-Meldung und Jahresmeldung beim Bundesstaat laufen dann weiter über FIAON. Die Jahresbetreuung verlängert sich nicht von selbst — bleibt die Zahlung aus, endet sie, und der Kunde trägt die laufenden Kosten selbst (Vertrag, Ziffer 5). Dann bitte im Auftrag eine interne Notiz hinterlassen.",
            `Der Auftrag im Office: ${globalOfficeAuftragPfad(ref)}`,
          ].join("\n"), heute);
          await verlaufSchreiben(ref, { art: "jahresbetreuung", text: `Aufgabe „Jahresbetreuung: Rechnung für das zweite Betreuungsjahr stellen“ vergeben — das zweite Jahr beginnt am ${globalTagAlsText(plan.jahrestag, "de")}.`, sichtbar: false });
          erg.jahresbetreuung++;
        }
      }

      if (!laeuft || !g.gestartet_am) continue;
      const start = berlinDatum(new Date(g.gestartet_am));

      // (b) Monatlicher Durchgang
      if (globalHatMonatsdurchgang(g.paket_key)) {
        const monat = globalDurchgangMonat(start, heute);
        const schluessel = monat ? `global:${ref}:durchgang:${monat}` : null;
        if (schluessel && !(await aufgabeDa(schluessel))) {
          await aufgabe(schluessel, `FIAON Global: monatlicher Durchgang — ${firma}`,
            `Das Paket sagt den monatlichen Durchgang mit dem Ansprechpartner zu (Start am ${globalTagAlsText(start, "de")}). Bitte mit dem Kunden durchgehen: Stand der Etappe, offene Unterlagen, nächster Schritt, Termine im Pflichtenkalender — und danach im Auftrag eine sichtbare Notiz „Durchgang ${monat}“ hinterlassen: ${globalOfficeAuftragPfad(ref)}`,
            isoPlusTage(heute, 2));
          await verlaufSchreiben(ref, { art: "durchgang", text: `Aufgabe „monatlicher Durchgang ${monat}“ vergeben.`, sichtbar: false });
          erg.durchgaenge++;
        }
      }

      // (c) Unterlagen
      if (heute >= isoPlusTage(start, GLOBAL_UNTERLAGEN_NACHFASS_TAGE)) {
        const schluessel = `global:${ref}:unterlagen`;
        if (!(await aufgabeDa(schluessel))) {
          const arten = (await sqlPool`SELECT DISTINCT art FROM fiaon_global_dokumente WHERE ref = ${ref} AND geloescht_am IS NULL`) as any[];
          const [fa] = (await sqlPool`SELECT firma FROM fiaon_global_auftraege WHERE ref = ${ref} LIMIT 1`) as any[];
          const stand = globalUnterlagenStand(arten.map((a) => String(a.art)), "de", json<Record<string, any>>(fa?.firma, {}).art === "privat");
          const fehlt = stand.filter((u) => !u.vorhanden);
          if (fehlt.length) {
            await aufgabe(schluessel, `FIAON Global: Unterlagen fehlen — ${firma}`,
              `Seit dem Start am ${globalTagAlsText(start, "de")} fehlen noch: ${fehlt.map((u) => u.titel).join("; ")}. Bitte den Kunden anrufen und klären, was ihn aufhält — eine Erinnerungsmail geht NICHT automatisch raus. Den Link zu „Mein Auftrag“ schickst du ihm im Auftrag mit „Zugang senden“: ${globalOfficeAuftragPfad(ref)}`,
              heute);
            erg.unterlagen++;
          }
        }
      }
    } catch (e) {
      erg.fehler++;
      console.error(`[GLOBAL-TAGESLAUF] ${ref}:`, e);
    }
  }
  return erg;
}
