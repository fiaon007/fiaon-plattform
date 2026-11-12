// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DER VERKAUFSMOTOR: ANGEBOT AUS DEM KONFIGURATOR (Register E-509, 12.11.2026)
//
// Regeln, Preise und Texte: shared/fiaon-global-verkauf.ts. Der Vertrag selbst bleibt der bestehende Vertragsmotor
// (Kapital-Angebot Fassung C): Diese Datei ruft kapitalCAnlegen mit denselben Parametern, mit denen seit E-505 jedes
// Angebot von Hand entstand — nur ohne Hand.
//
// ── DER WEG ───────────────────────────────────────────────────────────────
//   GET  /api/fiaon/global/verkauf        → Einstellung für die Seite (an/aus FÜR DIESEN AUFRUFER, Kurs) + Zeit-Siegel
//   POST /api/fiaon/global/verkauf/start  → geprüfte Eingabe → Weiche (verkaufWeg):
//        abschluss  Angebot anlegen → signierter Link (die Seite öffnet ihn sofort) + Mail mit dem Link an den Kunden
//                   + Mail und Aufgabe an Justin
//        sonst      Anfrage über den bestehenden Weg (globalAnfrageAnnehmen: Cockpit, Lead-Dossier, Aufgabe)
//
// ── SCHUTZ ────────────────────────────────────────────────────────────────
//   · Honigtopf („falle“): Wer das unsichtbare Feld füllt, bekommt ein freundliches Ja und nichts geschieht.
//   · Zeit-Siegel: Die Seite holt beim Laden ein signiertes Siegel; ein Absenden früher als vier Sekunden danach oder mit
//     einem fremden oder alten Siegel wird abgewiesen.
//   · Mengen: je Anschluss vier Versuche in fünfzehn Minuten und zwölf am Tag, je Adresse einer in der Minute; am Tag
//     höchstens `tagesGrenze` neue Angebote — darüber nimmt der Konfigurator Anfragen an.
//   · Eine Adresse, ein offenes Angebot: Gibt es zu einer E-Mail-Adresse schon ein offenes Angebot, geht der Link NUR per
//     E-Mail an diese Adresse — nie auf den Bildschirm dessen, der die Adresse eintippt (sonst läse ein Fremder Name und
//     Anschrift eines anderen).
//   · Notschalter: Ohne vollständige Einstellung (GLOBAL_VERKAUF) entsteht kein Angebot.
//   · Probebetrieb („nurLeitung“: true): Nur ein angemeldeter Chefbüro-Browser schließt selbst ab. Jeder andere Besucher
//     schickt eine Anfrage über den persönlichen Weg — mit demselben freundlichen Schlusstext wie beim Notschalter; die
//     Seite bekommt für ihn „an“: false und verspricht nirgends ein Angebot, das sich sofort öffnet. Justin liest in der
//     Meldung Rahmen und Schwerpunkte. Ohne den Schlüssel gilt alles wie zuvor.
//
// ── EINSTELLUNG (Umgebung, nie im öffentlichen Repo) ──────────────────────
//   GLOBAL_VERKAUF = JSON { "an": true, "buerginRegister": "…", "buerginAktiv": false, "buerginStandAm": "JJJJ-MM-TT",
//                           "kursUsdJeEur": 1.1165, "kursDatum": "JJJJ-MM-TT", "team": [ … ], "tagesGrenze": 25,
//                           "selbstMaxUsd": 950000, "nurLeitung": true }   („nurLeitung“ ist freiwillig, Vorgabe false)
//   Name, Anschrift und Vertretung der Bürgin stehen wie bei jedem Angebot in BUERGIN_VORGABE; die Registernummer kommt
//   aus der Einstellung. Ein Registerstand, der älter als sieben Tage ist, steht nicht mit Datum im Vertrag (der Satz
//   „derzeit als inaktiv geführt“ bleibt, bis buerginAktiv auf true steht).
//
// ── LEITPLANKE (12.11.2026) ───────────────────────────────────────────────
//   Nichts, was diese Datei ÖFFENTLICH ausgibt (Antwort an die Seite, Mail mit dem Link VOR dem Öffnen des Angebots),
//   nennt die Bürgschaft oder den Registerstand der Bürgin — beides steht nur im Angebot selbst (Vertrag der Fassung C).
//   Den öffentlichen Mustervertrag im Wortlaut gibt es deshalb nicht mehr; /business/mustervertrag zeigt den Aufbau des
//   Vertrags in Stichpunkten (VERKAUF_TEXTE.vertrag).
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { berlinToday } from "./fiaon-time";
import { absoluteUrl } from "../fiaon-base-url";
import { angebotGeheimFingerabdruck, angebotTokenErzeugen, angebotKundenPfad, verlaufAngebot, ensureAngebotTabellen } from "./fiaon-global-angebot";
import { BUERGIN_VORGABE } from "@shared/fiaon-global-angebot";
import { kapitalTeamAus, type KapitalBuergin } from "@shared/fiaon-global-angebot-kapital";
import { kapitalCEur, kapitalCUsd } from "@shared/fiaon-global-angebot-kapital-c";
import { privatpersonPlatzhalter } from "@shared/fiaon-global-lead";
import {
  VERKAUF_KURS_VORGABE, VERKAUF_RAHMEN, VERKAUF_GUELTIG_TAGE, VERKAUF_TEXTE, VERKAUF_PREISE,
  verkaufEingabeLesen, verkaufWeg, verkaufAngebotParameter, verkaufMeldungZeilen, verkaufPreis, verkaufUsd, verkaufEur,
  type VerkaufEinstellung, type VerkaufEingabe, type VerkaufWeg,
} from "@shared/fiaon-global-verkauf";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
export const VERKAUF_WER = "Konfigurator (Selbstabschluss)";
const CHEF_LINK = "/chef/s/global-auftraege?reiter=angebote";

// ═══════════════════════════════════════════════════════════════════════════
// EINSTELLUNG
// ═══════════════════════════════════════════════════════════════════════════
export interface VerkaufEinstellungServer extends VerkaufEinstellung { buergin: KapitalBuergin | null; grundAus: string | null }

/** Die Einstellung aus der Umgebung — rein (der Prüfstand gibt den Text und das Datum hinein). */
export function verkaufEinstellungAus(roh: string | undefined | null, heute: string = berlinToday()): VerkaufEinstellungServer {
  let o: Record<string, unknown> = {};
  try { const x = JSON.parse(String(roh ?? "")); if (x && typeof x === "object") o = x as Record<string, unknown>; } catch { /* leer = aus */ }
  const kurs = Number(o.kursUsdJeEur);
  const kursUsdJeEur = Number.isFinite(kurs) && kurs >= 0.5 && kurs <= 2.5 ? kurs : VERKAUF_KURS_VORGABE.kursUsdJeEur;
  const kursDatum = ISO.test(String(o.kursDatum ?? "")) && Number.isFinite(kurs) ? String(o.kursDatum) : VERKAUF_KURS_VORGABE.kursDatum;
  const register = String(o.buerginRegister ?? "").replace(/[^A-Za-z0-9 .\-/]/g, "").trim().slice(0, 40);
  const standRoh = ISO.test(String(o.buerginStandAm ?? "")) ? String(o.buerginStandAm) : "";
  // Ein alter Stand wäre im Vertrag eine falsche Zeitangabe — dann lieber der Satz ohne Datum.
  const alterTage = standRoh ? Math.round((Date.parse(`${heute}T12:00:00Z`) - Date.parse(`${standRoh}T12:00:00Z`)) / 864e5) : Infinity;
  const buerginStandAm = alterTage >= 0 && alterTage <= 7 ? standRoh : "";
  const grenze = Math.round(Number(o.tagesGrenze));
  const max = Math.round(Number(o.selbstMaxUsd));
  const buergin: KapitalBuergin | null = register ? {
    name: BUERGIN_VORGABE.name, bundesstaat: String(BUERGIN_VORGABE.bundesstaat ?? ""), anschrift: String(BUERGIN_VORGABE.anschrift ?? ""),
    registernummer: register, vertreter: String(BUERGIN_VORGABE.vertreter ?? ""), funktion: String(BUERGIN_VORGABE.funktion ?? ""),
  } : null;
  const grundAus = o.an !== true ? "Schalter aus" : !buergin ? "Registernummer der Bürgin fehlt" : null;
  return {
    an: grundAus === null,
    // Nur das echte true zählt (wie bei „an“): Ein Tippfehler darf den Probebetrieb nicht still einschalten oder aufheben.
    nurLeitung: o.nurLeitung === true,
    kursUsdJeEur, kursDatum,
    buerginAktiv: o.buerginAktiv === true,
    buerginStandAm,
    team: kapitalTeamAus(o.team, []),
    tagesGrenze: Number.isFinite(grenze) && grenze >= 1 && grenze <= 500 ? grenze : 25,
    selbstMaxUsd: Number.isFinite(max) && max >= VERKAUF_RAHMEN.minUsd + VERKAUF_RAHMEN.schrittUsd && max <= VERKAUF_RAHMEN.selbstMaxUsd ? max : VERKAUF_RAHMEN.selbstMaxUsd,
    buergin, grundAus,
  };
}
export function verkaufEinstellung(): VerkaufEinstellungServer {
  return verkaufEinstellungAus(process.env.GLOBAL_VERKAUF);
}

/** Der Grund in der Meldung an Justin, wenn ein Besucher im Probebetrieb den Konfigurator abschickt — nie Kundentext. */
export const VERKAUF_GRUND_PROBE = "Probebetrieb: Selbstabschluss noch nicht für alle freigegeben";
/**
 * Entstünde für DIESEN Aufrufer ein Angebot? null = ja; sonst der Grund (für die Meldung an Justin). Rein — Seite, Weiche und
 * Prüfstand lesen dieselbe Funktion: Schalter und Einstellung, dann der Probebetrieb (nur die Leitung), dann — wenn ein
 * Rahmen genannt ist — der Deckel. Die Tagesgrenze braucht die Datenbank und steht deshalb in verkaufStarten.
 */
export function verkaufSperrGrund(est: Pick<VerkaufEinstellungServer, "grundAus" | "nurLeitung" | "selbstMaxUsd">, leitung: boolean, usd?: number): string | null {
  if (est.grundAus) return est.grundAus;
  if (est.nurLeitung && !leitung) return VERKAUF_GRUND_PROBE;
  if (usd !== undefined && usd > est.selbstMaxUsd) return "Rahmen über dem Deckel des Selbstabschlusses";
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// ZEIT-SIEGEL UND BREMSEN
// ═══════════════════════════════════════════════════════════════════════════
export const SIEGEL_MIN_MS = 4_000;
export const SIEGEL_MAX_MS = 6 * 3_600_000;
export function verkaufSiegel(jetzt: number = Date.now()): string {
  return `${jetzt}.${angebotGeheimFingerabdruck("verkauf-siegel", String(jetzt)).slice(0, 32)}`;
}
export function verkaufSiegelPruefen(siegel: unknown, jetzt: number = Date.now()): "gut" | "ungueltig" | "zu_schnell" | "alt" {
  const m = String(siegel ?? "").match(/^(\d{10,16})\.([0-9a-f]{32})$/);
  if (!m) return "ungueltig";
  if (angebotGeheimFingerabdruck("verkauf-siegel", m[1]).slice(0, 32) !== m[2]) return "ungueltig";
  const alter = jetzt - Number(m[1]);
  if (alter < SIEGEL_MIN_MS) return "zu_schnell";
  if (alter > SIEGEL_MAX_MS) return "alt";
  return "gut";
}

const jeIp = new Map<string, number[]>();
const jeMail = new Map<string, number>();
/** Je Anschluss vier Versuche in fünfzehn Minuten und zwölf am Tag; je Adresse einer in der Minute. */
export function verkaufZuViel(ip: string, email: string, jetzt: number = Date.now()): boolean {
  const liste = (jeIp.get(ip) ?? []).filter((z) => jetzt - z < 86_400_000);
  if (liste.filter((z) => jetzt - z < 15 * 60_000).length >= 4 || liste.length >= 12) { jeIp.set(ip, liste); return true; }
  if (jetzt - (jeMail.get(email) ?? 0) < 60_000) return true;
  liste.push(jetzt); jeIp.set(ip, liste); jeMail.set(email, jetzt);
  if (jeIp.size > 5000) for (const [k, v] of Array.from(jeIp.entries())) if (!v.some((z) => jetzt - z < 86_400_000)) jeIp.delete(k);
  if (jeMail.size > 5000) for (const [k, v] of Array.from(jeMail.entries())) if (jetzt - v > 60_000) jeMail.delete(k);
  return false;
}
/** Nur für den Prüfstand: die Bremsen leeren. */
export function verkaufBremsenLeeren(): void { jeIp.clear(); jeMail.clear(); }

// ═══════════════════════════════════════════════════════════════════════════
// WAS DIE SEITE BEIM LADEN BEKOMMT
// ═══════════════════════════════════════════════════════════════════════════
export function verkaufSeitenSicht(leitung: boolean = false, e: VerkaufEinstellungServer = verkaufEinstellung()): Record<string, unknown> {
  return {
    ok: true,
    // Die Seite zeigt den Konfigurator immer; „an“ sagt nur, ob für DIESEN Aufrufer am Ende ein Angebot entsteht (true) oder
    // eine Anfrage (false: Notschalter — oder Probebetrieb und der Aufruf kommt nicht aus einem Chefbüro-Browser). Die Seite
    // wählt danach ihre Sätze; mehr erfährt sie nicht (kein „nurLeitung“, kein Grund, nichts zur Bürgin).
    an: verkaufSperrGrund(e, leitung) === null,
    kursUsdJeEur: e.kursUsdJeEur, kursDatum: e.kursDatum,
    selbstMaxUsd: e.selbstMaxUsd,
    siegel: verkaufSiegel(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// STARTEN
// ═══════════════════════════════════════════════════════════════════════════
export interface VerkaufKontext { ip: string; userAgent: string; leitung?: boolean }
export type Antwort = { status: number; body: Record<string, unknown> };
const fehler = (status: number, error: string, extra: Record<string, unknown> = {}): Antwort => ({ status, body: { ok: false, error, ...extra } });

/** Wie viele Angebote hat der Konfigurator heute (Berliner Tag) schon angelegt? */
async function heuteAngelegt(): Promise<number> {
  const [r] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_global_angebote
     WHERE erstellt_von = ${VERKAUF_WER} AND (created_at AT TIME ZONE 'Europe/Berlin')::date = ${berlinToday()}::date`) as any[];
  return Number(r?.n ?? 0);
}

/** Was verkaufStarten nach der Weiche ruft — als Werkbank, damit der Prüfstand die Weiche ohne Datenbank und Mail durchspielt. */
export interface VerkaufWerk {
  einstellung: () => VerkaufEinstellungServer;
  /** Wie viele Angebote der Konfigurator heute schon angelegt hat (legt die Tabellen an, falls sie fehlen). */
  heuteAngelegt: () => Promise<number>;
  angebot: (e: VerkaufEingabe, est: VerkaufEinstellungServer & { buergin: KapitalBuergin }, kontext: VerkaufKontext) => Promise<Antwort>;
  anfrage: (e: VerkaufEingabe, weg: VerkaufWeg, est: VerkaufEinstellungServer, kontext: VerkaufKontext, grundAus: string | null) => Promise<Antwort>;
}
const WERK: VerkaufWerk = {
  einstellung: verkaufEinstellung,
  heuteAngelegt: async () => { await ensureAngebotTabellen(); return heuteAngelegt(); },
  angebot: (e, est, kontext) => verkaufAngebot(e, est, kontext),
  anfrage: (e, weg, est, kontext, grundAus) => verkaufAnfrage(e, weg, est, kontext, grundAus),
};

export async function verkaufStarten(body: any, kontext: VerkaufKontext, werk: VerkaufWerk = WERK): Promise<Antwort> {
  const en = String(body?.sprache ?? "").toLowerCase().startsWith("en");
  const T = VERKAUF_TEXTE[en ? "en" : "de"].konfig;
  // Honigtopf: freundliches Ja, nichts geschieht.
  if (String(body?.falle ?? "").trim()) return { status: 200, body: { ok: true, art: "anfrage", weg: "vorhaben", danke: T.wege.vorhaben.danke } };
  const p = verkaufEingabeLesen(body);
  if (!p.ok) return fehler(400, en ? p.errorEn : p.error, { feld: p.feld });
  const e = p.eingabe;
  const siegel = verkaufSiegelPruefen(body?.siegel);
  if (siegel !== "gut") return fehler(siegel === "alt" ? 409 : 400, T.fehler.netz, { code: siegel === "alt" ? "SIEGEL_ALT" : "SIEGEL" });
  if (verkaufZuViel(kontext.ip, e.email)) return fehler(429, T.fehler.zuViel);
  // Die Leitung darf den Motor selbst durchspielen (Justin will jeden Klickweg selbst gehen) — das Angebot trägt dann den Vermerk
  // „aus einem Chefbüro-Browser“ im Verlauf und in der Meldung, damit ein Probelauf als solcher erkennbar bleibt. Im
  // Probebetrieb („nurLeitung“) ist sie die Einzige, für die ein Angebot entsteht (verkaufSperrGrund).

  const est = werk.einstellung();
  const weg = verkaufWeg(e);
  if (weg === "abschluss") {
    let grundAus = verkaufSperrGrund(est, kontext.leitung === true, e.usd);
    if (!grundAus && (await werk.heuteAngelegt()) >= est.tagesGrenze) grundAus = `Tagesgrenze ${est.tagesGrenze} erreicht`;
    if (!grundAus && est.buergin) return werk.angebot(e, est as VerkaufEinstellungServer & { buergin: KapitalBuergin }, kontext);
    // Notschalter, Probebetrieb oder Grenze: die Anfrage kommt an, das Angebot erstellen wir persönlich.
    const r = await werk.anfrage(e, weg, est, kontext, grundAus ?? "aus");
    return { status: 200, body: { ...r.body, titel: T.persoenlich.titel, danke: T.fehler.aus, aus: true } };
  }
  return werk.anfrage(e, weg, est, kontext, null);
}

/** Selbstabschluss: Angebot anlegen (oder zum bestehenden offenen Angebot dieser Adresse den Link mailen). */
async function verkaufAngebot(e: VerkaufEingabe, est: VerkaufEinstellungServer & { buergin: KapitalBuergin }, kontext: VerkaufKontext): Promise<Antwort> {
  const T = VERKAUF_TEXTE[e.sprache].konfig;
  const heute = berlinToday();
  const [offen] = (await sqlPool`
    SELECT id, angebot_ref, gueltig_bis FROM fiaon_global_angebote
     WHERE status = 'offen' AND fassung LIKE 'IA-KAPITAL-%-C' AND gueltig_bis >= ${heute}::date AND lower(kunde->>'email') = ${e.email}
     ORDER BY id DESC LIMIT 1`) as any[];
  if (offen) {
    // Nie auf den Bildschirm: Wer die Adresse eintippt, ist vielleicht nicht ihr Inhaber. Der Link geht per E-Mail an sie.
    const bis = offen.gueltig_bis instanceof Date ? berlinToday(offen.gueltig_bis) : String(offen.gueltig_bis).slice(0, 10);
    const link = absoluteUrl(angebotKundenPfad(angebotTokenErzeugen(String(offen.angebot_ref), bis)));
    void verkaufKundenMail(e, String(offen.angebot_ref), link, bis, true).catch((x) => console.error(`[FIAON-VERKAUF] ${offen.angebot_ref}: Mail mit Link:`, x));
    await verlaufAngebot(Number(offen.id), VERKAUF_WER, `Konfigurator erneut abgeschickt (${verkaufUsd(e.usd)}) — Link per E-Mail an die Adresse des Angebots`, { ip: kontext.ip });
    return { status: 200, body: { ok: true, art: "mail", titel: T.mailGesendet.titel, text: T.mailGesendet.text } };
  }
  const gueltigBis = new Date(Date.parse(`${heute}T12:00:00Z`) + VERKAUF_GUELTIG_TAGE * 864e5).toISOString().slice(0, 10);
  const { kapitalCAnlegen } = await import("./fiaon-global-angebot-kapital-c");
  const erg = await kapitalCAnlegen({
    kunde: { art: "privat", anrede: e.anrede, vorname: e.vorname, nachname: e.nachname, email: e.email, telefon: e.telefon, land: e.land },
    buergin: est.buergin,
    parameter: verkaufAngebotParameter(e.usd, est),
    gueltigBis,
  }, VERKAUF_WER);
  if (!erg.ok) {
    console.error(`[FIAON-VERKAUF] Angebot nicht angelegt: ${erg.error}`);
    // Der Kunde soll nie an einer Störung hängen bleiben: Die Anfrage kommt an, das Angebot folgt persönlich.
    const r = await verkaufAnfrage(e, "abschluss", est, kontext, `Anlegen gescheitert: ${erg.error}`);
    return { status: 200, body: { ...r.body, titel: T.persoenlich.titel, danke: T.fehler.aus, aus: true } };
  }
  const zeilen = verkaufMeldungZeilen(e, "abschluss", est.kursUsdJeEur);
  await verlaufAngebot(erg.id, VERKAUF_WER, `${kontext.leitung ? "Im Konfigurator aus einem Chefbüro-Browser zusammengestellt (Probelauf?)" : "Vom Kunden im Konfigurator zusammengestellt"}: ${zeilen[1]} ${zeilen[2]}`, { ip: kontext.ip, interessen: e.interessen, sprache: e.sprache, nachricht: e.nachricht || undefined });
  void verkaufKundenMail(e, erg.ref, erg.link, gueltigBis, false).catch((x) => console.error(`[FIAON-VERKAUF] ${erg.ref}: Mail mit Link:`, x));
  void verkaufMelden(e, "abschluss", est, { ref: erg.ref, link: erg.link, gueltigBis }, kontext.leitung ? "HINWEIS: aus einem Chefbüro-Browser abgeschickt — vermutlich ein Probelauf." : null).catch((x) => console.error(`[FIAON-VERKAUF] ${erg.ref}: Meldung an Justin:`, x));
  // Der Pfad ist relativ: Die Seite bleibt auf ihrer Adresse (auch lokal und in der Vorschau).
  const pfad = new URL(erg.link).pathname;
  return { status: 200, body: { ok: true, art: "angebot", url: pfad, titel: T.fertig.titel, text: T.fertig.text, knopf: T.fertig.knopf } };
}

/** Persönlicher Weg: die Anfrage über den bestehenden Eingang (Cockpit, Lead-Dossier, Aufgabe an die zuständige Person). */
async function verkaufAnfrage(e: VerkaufEingabe, weg: VerkaufWeg, est: VerkaufEinstellungServer, kontext: VerkaufKontext, grundAus: string | null): Promise<Antwort> {
  const T = VERKAUF_TEXTE[e.sprache].konfig;
  const zeilen = verkaufMeldungZeilen(e, weg, est.kursUsdJeEur);
  if (grundAus) zeilen.unshift(`Selbstabschluss war nicht möglich (${grundAus}) — bitte das Angebot von Hand anlegen.`);
  const name = `${e.vorname} ${e.nachname}`.trim();
  const produkt = VERKAUF_TEXTE.de.produkt.kurz;
  const { globalAnfrageAnnehmen } = await import("./fiaon-global-termin");
  const erg = await globalAnfrageAnnehmen({
    kontakt: {
      name, vorname: e.vorname, nachname: e.nachname, firma: privatpersonPlatzhalter(name, e.sprache), email: e.email, telefon: e.telefon,
      paket: null, paketText: e.interessen.includes("kapital") ? `${produkt} · Kapitalrahmen ${verkaufUsd(e.usd)}` : `${produkt} · ohne Kapital`,
      land: e.land === "ANDERES" ? null : e.land, sprache: e.sprache,
    },
    wunschzeit: null,
    text: ["Aus dem Konfigurator (Verkaufsmotor):", ...zeilen].join("\n"),
    ip: kontext.ip,
    herkunft: { wo: "fiaon.com (Konfigurator)", quelle: "konfigurator", autor: "FIAON Global" },
  });
  void verkaufMelden(e, weg, est, null, grundAus).catch((x) => console.error(`[FIAON-VERKAUF] Anfrage ${erg.anfrageId}: Meldung an Justin:`, x));
  const w = weg === "abschluss" ? "vorhaben" : weg;
  return { status: 200, body: { ok: true, art: "anfrage", weg, danke: T.wege[w].danke, messRef: `global-anfrage-${erg.anfrageId}` } };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAILS
// ═══════════════════════════════════════════════════════════════════════════
const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const tagDe = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

/** Die Mail an den Kunden mit dem Link zu seinem Angebot — reine Funktion (Prüfstand, Wortwand). */
export function verkaufKundenMailTexte(e: Pick<VerkaufEingabe, "anrede" | "vorname" | "nachname" | "usd" | "sprache">, ref: string, gueltigBis: string, erneut: boolean, kursUsdJeEur: number) {
  const p = verkaufPreis(e.usd, kursUsdJeEur);
  const en = e.sprache === "en";
  const gruss = en
    ? `Dear ${e.anrede === "Herr" ? "Mr" : e.anrede === "Frau" ? "Ms" : e.vorname} ${e.nachname}`.trim()
    : e.anrede === "Herr" ? `Sehr geehrter Herr ${e.nachname}` : e.anrede === "Frau" ? `Sehr geehrte Frau ${e.nachname}` : `Guten Tag ${e.vorname} ${e.nachname}`;
  if (en) {
    return {
      betreff: `Your offer from FIAON Global (${ref})`,
      preheader: "Your US company, actively managed — open your offer and sign online.",
      titel: erneut ? "Your offer is waiting for you" : "Your offer is ready",
      absaetze: [
        `${gruss},`,
        erneut ? "you asked for your offer again. Here is the link to it." : "thank you for putting your offer together. It is ready for you.",
        "On your offer page you adjust your capital range, choose the term and the name of your company, and sign online. Your agreement is in German, the language of the contract; your contact will take you through it in English.",
      ],
      daten: [
        { label: "Capital range", wert: verkaufUsd(e.usd, "en") },
        { label: "With your order", wert: verkaufEur(p.gruendungCents, "en") },
        { label: "On registration", wert: verkaufEur(p.erfolgCents, "en") },
        { label: "Valid until", wert: tagDe(gueltigBis) },
      ],
      knopf: "Open my offer",
      fussnote: "This link is personal. Please do not forward it.",
    };
  }
  return {
    betreff: `Ihr Angebot von FIAON Global (${ref})`,
    preheader: "Ihre US-Gesellschaft mit aktiver Betreuung — Angebot öffnen und online unterschreiben.",
    titel: erneut ? "Ihr Angebot wartet auf Sie" : "Ihr Angebot ist fertig",
    absaetze: [
      `${gruss},`,
      erneut ? "Sie haben Ihr Angebot noch einmal angefordert. Hier ist der Link dorthin." : "vielen Dank, dass Sie Ihr Angebot zusammengestellt haben. Es liegt für Sie bereit.",
      "Auf Ihrer Angebotsseite stellen Sie Ihren Kapitalrahmen nach, wählen Laufzeit und Namen Ihrer Gesellschaft und unterschreiben online.",
    ],
    daten: [
      { label: "Kapitalrahmen", wert: kapitalCUsd(e.usd) },
      { label: "Mit Ihrem Auftrag", wert: kapitalCEur(p.gruendungCents) },
      { label: "Mit der Eintragung", wert: kapitalCEur(p.erfolgCents) },
      { label: "Gültig bis", wert: tagDe(gueltigBis) },
    ],
    knopf: "Mein Angebot öffnen",
    fussnote: "Dieser Link ist persönlich. Bitte leiten Sie ihn nicht weiter.",
  };
}

async function verkaufKundenMail(e: VerkaufEingabe, ref: string, link: string, gueltigBis: string, erneut: boolean): Promise<void> {
  const est = verkaufEinstellung();
  const T = verkaufKundenMailTexte(e, ref, gueltigBis, erneut, est.kursUsdJeEur);
  const { GLOBAL_ROLLEN } = await import("@shared/fiaon-global");
  const { freitextSenden } = await import("../mail/motor");
  const r = await freitextSenden({
    an: e.email, betreff: T.betreff, absender: "welcome",
    text: [...T.absaetze, T.daten.map((x) => `${x.label}: ${x.wert}`).join("\n"), `${T.knopf}: ${link}`, T.fussnote].join("\n\n"),
    antwortAn: { email: "js@fiaon.com", name: "Justin Schwarzott" },
    baustein: {
      betreff: T.betreff, preheader: T.preheader, titel: T.titel, persoenlich: true,
      bereich: "business", kopfSatz: "FIAON Global", rechtsSatz: GLOBAL_ROLLEN[e.sprache].fiaon,
      absaetze: T.absaetze.map(escape), daten: T.daten.map((x) => ({ label: escape(x.label), wert: escape(x.wert) })),
      knopf: { text: T.knopf, url: link },
      fussnote: escape(T.fussnote),
    },
  });
  try {
    const { mailProtokoll } = await import("./fiaon-mail-log");
    await mailProtokoll({
      event: "global_verkauf_angebot_link", personId: null, empfaenger: e.email,
      status: r.ok ? "versandt" : "fehlgeschlagen", grund: r.ok ? null : (r.grund ?? "unbekannt"), payload: { angebot: ref, erneut },
      ausgeloestVon: VERKAUF_WER, brevoMessageId: r.messageId ?? null,
    });
  } catch (x) { console.error(`[FIAON-VERKAUF] ${ref}: Mailprotokoll:`, x); }
  if (!r.ok) console.warn(`[FIAON-VERKAUF] ${ref}: Mail mit Link nicht gesendet (${r.grund})`);
}

/** Mail und Aufgabe an Justin — bei jedem neuen Selbst-Angebot und bei jeder Anfrage aus dem Konfigurator. */
async function verkaufMelden(e: VerkaufEingabe, weg: VerkaufWeg, est: VerkaufEinstellungServer, angebot: { ref: string; link: string; gueltigBis: string } | null, grundAus: string | null = null): Promise<void> {
  const name = `${e.vorname} ${e.nachname}`.trim();
  const zeilen = verkaufMeldungZeilen(e, weg, est.kursUsdJeEur);
  if (grundAus) zeilen.unshift(angebot ? grundAus : `Selbstabschluss war nicht möglich (${grundAus}) — bitte das Angebot von Hand anlegen.`);
  const titel = angebot
    ? `Neues Selbst-Angebot ${angebot.ref}: ${name} · ${verkaufUsd(e.usd)}`
    : `Konfigurator-Anfrage: ${name}${e.interessen.includes("kapital") ? ` · ${verkaufUsd(e.usd)}` : " · ohne Kapital"}`;
  const text = [
    angebot ? `${name} hat sich im Konfigurator ein Angebot zusammengestellt. Es ist angelegt und bis ${tagDe(angebot.gueltigBis)} gültig; die Unterschrift ist frei.` : `${name} hat den Konfigurator abgeschickt.`,
    ...zeilen,
    angebot ? `Mit dem Auftrag ${verkaufEur(VERKAUF_PREISE.gruendungCents)} (Fast-Track wählbar), Erfolgshonorar mit der Eintragung.` : "",
  ].filter(Boolean).join("\n\n");
  if (angebot) {
    // Bei einer Anfrage legt der bestehende Eingang (globalAnfrageAnnehmen) schon Aufgabe und Dossier an — hier nur beim Angebot.
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    await auftragFuerKunden({
      personId: null, ref: null, titel, text, anBetreiber: true, schluessel: `global:${angebot.ref}:verkauf-neu`,
      bereich: "konten", quelle: "global", autorName: "FIAON Global", link: CHEF_LINK,
    }).catch((x) => console.error(`[FIAON-VERKAUF] ${angebot.ref}: Aufgabe:`, x));
  }
  const { eigeneMailSenden } = await import("./fiaon-brevo");
  const { AUFRUF_MELDUNG_AN, AUFRUF_CHEF_PFAD } = await import("./fiaon-global-angebot-aufrufe");
  const v = await eigeneMailSenden({
    an: AUFRUF_MELDUNG_AN, name: "Justin", betreff: titel, text,
    knoepfe: [{ text: "Angebote im Chefbüro", url: absoluteUrl(AUFRUF_CHEF_PFAD) }],
  });
  if (!v.ok) console.warn(`[FIAON-VERKAUF] Meldung an ${AUFRUF_MELDUNG_AN} nicht gesendet (${String(v.grund || "unbekannt").slice(0, 160)})`);
}
