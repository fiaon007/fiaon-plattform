// ═══════════════════════════════════════════════════════════════════════════
// FIRMEN-RADAR — BRIEF STATT MAIL (12.10.2026, E-339)
//
// Seit Justins Vorgabe „keine info, office, welcome Emails“ geht die erste Mail
// nur an die persönliche, öffentlich belegte Adresse eines Entscheiders. Die
// steht (Probe 12.10.) bei 1 von 20 Firmen auf der Website — Name und Anschrift
// des Geschäftsführers dagegen im Impressum. Für diese Firmen schreibt Mara
// einen Brief an den Geschäftsführer.
//
// ── DER WEG EINES BRIEFS ───────────────────────────────────────────────────
//   1. PRÜFEN    radarBriefPruefen (shared): Kapitalsignal ≥ 3, KEINE persönliche
//                Adresse (dann geht die Mail vor), Name + Anschrift vollständig,
//                kein Kontakt bisher, nicht gesperrt, je Firma genau ein Brief.
//   2. SCHREIBEN Die KI schreibt aus den geprüften Aufhängern des Scans — dieselbe
//                Wand wie die Mail (mailPruefen: Wortwand, kein Betrag, kein
//                Kapitalrahmen, kein Institut-Satz). „Herr“/„Frau“ nur, wenn es auf
//                der Quelle steht (anredeAusText) — wie bei der Mail.
//   3. DRUCKEN   A4 nach DIN 5008 Form B (Anschrift im Fenster), FIAON-CI Glasblau,
//                QR-Code auf /business?utm_source=radar_brief&utm_content=r<ID>,
//                Widerspruch (Art. 21) abgesetzt, Datenschutzhinweis (Art. 14).
//   4. SENDEN    Nur mit Schalter „Briefversand“, im Tageskontingent, an Pingen
//                oder LetterXpress. Im Testmodus bekommt der Dienst den Brief,
//                druckt ihn aber nicht (Pingen: hochgeladen und geprüft, nicht
//                abgeschickt; LetterXpress: Postbox) — so prüft der Dienst die
//                Anschrift im Fenster, bevor ein Euro fließt.
//   5. MESSEN    Jeder Aufruf aus dem QR-Code landet in fiaon_radar_besuche
//                (ohne IP, ohne Gerät); radarAbgleich zählt sie an der Firma.
//                Antworten per Mail an das Radar-Postfach liest radarPostLauf —
//                eine Absage dort ist zugleich der Widerspruch (Sperrliste).
// ═══════════════════════════════════════════════════════════════════════════
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import QRCode from "qrcode";
import { PDFDocument } from "pdf-lib";
import { sqlPool } from "./db-pool";
import {
  ensureRadarTabellen, radarKi, radarScannen, radarAbsender, radarPostfaecher, zeileLesen, mailPruefen, anredeFuer,
  robotsWaechter, seiteHolen, gesperrt, RadarFehler, type Aufhaenger,
} from "./fiaon-radar";
import { anredeAusText, entscheiderFinden } from "./fiaon-radar-entscheider";
import { radarAutomatik } from "./fiaon-radar-faden";
import { htmlZuPdfBlatt, escapeHtml } from "./fiaon-html-pdf";
import { berlinToday } from "./fiaon-time";
import { kiPausiert } from "./fiaon-ki-pause";
import { markeSvg, MARKE_NAVY } from "@shared/fiaon-marke";
import { FIAON_FIRMA } from "@shared/fiaon-firma";
import {
  RADAR_KERNSATZ, RADAR_SIGNAL_AB, RADAR_BRIEF_ANBIETER, RADAR_BRIEF_SCHLUESSEL, RADAR_BRIEF_HOECHSTENS_JE_TAG, RADAR_BRIEF_TEXTE,
  RADAR_BRIEF_QUELLE, radarBriefEinstellungLesen, radarBriefKosten, radarBriefLink, radarBriefKennung, radarBriefPruefen,
  radarBriefAnschrift, radarBriefPerson, radarKennungLesen, radarSendefenster, radarBereich,
  type RadarBriefAnbieter, type RadarBriefEinstellung, type RadarBriefEmpfaenger,
} from "@shared/fiaon-radar";

const SEITE = () => (process.env.RADAR_SEITE || "https://fiaon.com").replace(/\/+$/, "");

// ── DIE SCHALTER ─────────────────────────────────────────────────────────────
export async function radarBriefEinstellung(): Promise<RadarBriefEinstellung> {
  const zeilen = (await sqlPool`SELECT key, value FROM fiaon_settings WHERE key = ANY(${Object.values(RADAR_BRIEF_SCHLUESSEL)})`.catch(() => [])) as any[];
  return radarBriefEinstellungLesen(Object.fromEntries(zeilen.map((z) => [String(z.key), z.value == null ? null : String(z.value)])));
}

/** Ist der Dienst eingerichtet? Die Schlüssel kommen aus der Render-Umgebung — nie aus der Datenbank. */
export function anbieterBereit(a: RadarBriefAnbieter): { ok: boolean; fehlt: string[] } {
  const noetig = a === "pingen"
    ? ["PINGEN_CLIENT_ID", "PINGEN_CLIENT_SECRET", "PINGEN_ORGANISATION_ID"]
    : ["LETTERXPRESS_BENUTZER", "LETTERXPRESS_API_KEY"];
  const fehlt = noetig.filter((k) => !String(process.env[k] ?? "").trim());
  return { ok: !fehlt.length, fehlt };
}

export async function radarBriefEinstellungSetzen(ein: Partial<Record<keyof RadarBriefEinstellung, unknown>>): Promise<RadarBriefEinstellung> {
  const k = RADAR_BRIEF_SCHLUESSEL;
  const alt = await radarBriefEinstellung();
  const setzen: [string, string][] = [];
  const anbieter = ein.anbieter !== undefined ? String(ein.anbieter) : alt.anbieter;
  if (ein.anbieter !== undefined) {
    if (anbieter !== "pingen" && anbieter !== "letterxpress") throw new RadarFehler("Versanddienst: „pingen“ oder „letterxpress“.");
    setzen.push([k.anbieter, anbieter]);
  }
  if (ein.versand !== undefined) {
    const an = ein.versand === true || ein.versand === "an";
    // Einschalten nur mit eingerichtetem Dienst — sonst stünde ein Schalter auf „an“, der nichts senden kann.
    if (an) {
      const bereit = anbieterBereit(anbieter as RadarBriefAnbieter);
      if (!bereit.ok) throw new RadarFehler(`Für ${RADAR_BRIEF_ANBIETER[anbieter as RadarBriefAnbieter].label} fehlen noch die Zugangsdaten: ${bereit.fehlt.join(", ")}.`, 409);
    }
    setzen.push([k.versand, an ? "an" : "aus"]);
  }
  if (ein.testmodus !== undefined) setzen.push([k.testmodus, ein.testmodus === false || ein.testmodus === "aus" ? "aus" : "an"]);
  if (ein.farbe !== undefined) setzen.push([k.farbe, ein.farbe === false || ein.farbe === "aus" ? "aus" : "an"]);
  if (ein.jeTag !== undefined) {
    const n = Math.round(Number(ein.jeTag));
    if (!Number.isFinite(n) || n < 0 || n > RADAR_BRIEF_HOECHSTENS_JE_TAG) throw new RadarFehler(`Briefe je Tag: 0 bis ${RADAR_BRIEF_HOECHSTENS_JE_TAG}.`);
    setzen.push([k.jeTag, String(n)]);
  }
  for (const [key, value] of setzen) {
    await sqlPool`INSERT INTO fiaon_settings (key, value) VALUES (${key}, ${value}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  }
  return radarBriefEinstellung();
}

/** Briefe und Kosten eines Tages (Berlin) — echte Briefe und Testläufe getrennt. */
export async function radarBriefHeute(tag = berlinToday()): Promise<{ briefe: number; kostenCents: number; test: number }> {
  await ensureRadarTabellen();
  const [z] = (await sqlPool`
    SELECT COUNT(*) FILTER (WHERE (brief_versendet_am AT TIME ZONE 'Europe/Berlin')::date = ${tag}::date)::int AS briefe,
           COALESCE(SUM(brief_kosten_cents) FILTER (WHERE (brief_versendet_am AT TIME ZONE 'Europe/Berlin')::date = ${tag}::date), 0)::int AS kosten,
           COUNT(*) FILTER (WHERE (brief_test_am AT TIME ZONE 'Europe/Berlin')::date = ${tag}::date)::int AS test
      FROM fiaon_radar_firmen`) as any[];
  return { briefe: Number(z?.briefe ?? 0), kostenCents: Number(z?.kosten ?? 0), test: Number(z?.test ?? 0) };
}

// ── DER EMPFÄNGER ────────────────────────────────────────────────────────────
function nachnameVon(name: string): string {
  const teile = String(name ?? "").replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
  const idx = teile.findIndex((t, i) => i > 0 && /^(von|van|vom|zu|zur|zum|de|del|di|da|le|la)$/i.test(t));
  return idx > 0 ? teile.slice(idx).join(" ") : (teile[teile.length - 1] ?? "");
}

/**
 * Wer den Brief bekommt — mit „Herr“/„Frau“ nur, wenn es wörtlich vor dem Nachnamen steht: beim belegten Entscheider
 * aus seiner Quelle, sonst auf der Impressumseite (frisch gelesen, robots.txt gilt). Dieselbe Regel wie bei der Mail.
 */
export async function briefEmpfaengerErmitteln(f: any): Promise<{ empfaenger: RadarBriefEmpfaenger; quelle: string }> {
  const imp = f.impressum ?? {};
  const person = radarBriefPerson(imp, f.entscheider ?? null);
  let anrede: "Herr" | "Frau" | null = null;
  if (person) {
    if (f.entscheider?.anrede && radarBriefPerson({ vertreter: [{ name: f.entscheider.name }] })?.name === person.name) anrede = f.entscheider.anrede;
    if (!anrede && imp.seite) {
      const s = await seiteHolen(String(imp.seite), robotsWaechter(), 600_000).catch(() => null);
      if (s) {
        const roh = (Array.isArray(imp.vertreter) ? imp.vertreter : []).map((v: any) => String(v?.name || [v?.vorname, v?.nachname].filter(Boolean).join(" ")));
        const varianten = Array.from(new Set([nachnameVon(person.name), ...roh.map(nachnameVon)].filter(Boolean)));
        for (const n of varianten) { anrede = anredeAusText(s.text, n); if (anrede) break; }
      }
    }
  }
  const empfaenger = radarBriefAnschrift(imp, { firmenname: f.name, land: f.land, anrede, entscheider: f.entscheider ?? null });
  // Herkunft für den Datenschutzhinweis (Art. 14 Abs. 2 lit. f): Name und Anschrift stehen im Impressum.
  const ausImpressum = Array.isArray(imp.vertreter) && imp.vertreter.length > 0;
  const quelle = ausImpressum || !f.entscheider?.quelle
    ? `dem Impressum Ihrer Website ${f.domain}`
    : `dem Impressum Ihrer Website ${f.domain} und einer öffentlichen Quelle (${(() => { try { return new URL(f.entscheider.quelle).hostname.replace(/^www\./, ""); } catch { return "Website"; } })()})`;
  return { empfaenger, quelle };
}

// ── SCHREIBEN ────────────────────────────────────────────────────────────────
export interface RadarBrief {
  betreff: string; anrede: string; absaetze: string[]; frage: string;
  empfaenger: RadarBriefEmpfaenger; quelle: string; kennung: string; link: string; antwortAn: string;
  warnungen: string[]; sperrend: string[]; geaendert: boolean; erstellt_am: string;
}

const SCHEMA_BRIEF = {
  type: "object", additionalProperties: false,
  properties: {
    betreff: { type: "string" }, absaetze: { type: "array", items: { type: "string" } }, frage: { type: "string" },
    passt: { type: "boolean" }, passt_grund: { type: "string" },
  },
  required: ["betreff", "absaetze", "frage", "passt", "passt_grund"],
};

function briefAnweisung(): string {
  const a = radarAbsender();
  // Derselbe Ton wie die erste Mail (E-337, „wie Öl“) — nur auf Papier: ein Brief darf einen Gedanken mehr tragen,
  // aber er muss auf EINE Seite passen, und der Leser antwortet nicht mit einem Klick, sondern mit dem QR-Code.
  return [
    `Du schreibst als ${a.name}, Gründer von FIAON Global, einen kurzen persönlichen BRIEF auf Papier an den Geschäftsführer oder Inhaber einer Firma. Ziel ist ein Gespräch, kein Verkauf.`,
    "",
    "SO KLINGT ES — wie ein Unternehmer, der einem anderen Unternehmer schreibt, den er respektiert:",
    "- Kurze Sätze, höchstens 18 Wörter. Ein Gedanke pro Satz. Alltagssprache, aktiv, konkret.",
    "- Sie-Form, warm, ruhig, selbstbewusst. Kein Verkäuferton, keine Floskel („Ich hoffe, es geht Ihnen gut“, „innovativ“, „maßgeschneidert“, „Synergien“, „spannend“, „Mehrwert“, „Lösung“, „wir bieten“).",
    "- Höchstens ein Gedankenstrich im ganzen Brief. Keine Klammern, keine Aufzählungen, keine Ausrufezeichen, keine Emojis, keine Links, keine Mailadressen.",
    "- „Ich“ ist erlaubt und erwünscht. Den Firmennamen höchstens einmal.",
    "",
    "AUFBAU — absaetze = 3 kurze Absätze, zusammen 90 bis 140 Wörter (Anrede, Gruß, Unterschrift, QR-Code und Kontakt setzt der Server):",
    "1. Der Anlass in zwei Sätzen: EINE konkrete, geprüfte Beobachtung über die Firma (am liebsten das Kapitalsignal), dann eine menschliche Folgerung. Keine Schmeichelei.",
    `2. Was wir tun, natürlich erzählt — diese Fakten, in eigenen kurzen Sätzen: ${RADAR_KERNSATZ.was} ${RADAR_KERNSATZ.vorteil} ${RADAR_KERNSATZ.vorOrt}`,
    "3. Warum ein Gespräch lohnt, in einem bis zwei Sätzen: dass wir in 30 Minuten gemeinsam ansehen, ob dieser Weg zur Lage der Firma passt. Nichts versprechen.",
    "frage = eine einzige, leichte Frage als Schlusssatz. Kein Druck, keine Frist.",
    "",
    "TON-VORBILD (nur der Ton, keine Fakten übernehmen):",
    "„Ich habe gelesen, dass Sie in Gersthofen eine neue Halle bauen. Für einen Familienbetrieb ist das ein großer Schritt, und er braucht meist mehr Spielraum, als die Hausbank geben will.",
    "Wir gründen für Unternehmer eine eigene LLC in den USA, das amerikanische Gegenstück zur GmbH. Um Geschäftskonto, Firmenkreditkarten und den Weg zu US-Funding kümmern wir uns. Viele US-Firmenkarten starten mit einem Einführungszeitraum ohne Sollzins, und das Kapital können Sie auch hier in Europa einsetzen.",
    "In einem Gespräch von 30 Minuten sehen wir gemeinsam, ob dieser Weg zu Ihren Plänen passt.“",
    "Frage: „Darf ich Ihnen das einmal in Ruhe zeigen?“",
    "",
    "betreff = höchstens 60 Zeichen, sachlich und persönlich, mit dem Anlass oder dem Firmennamen (z. B. „Ihre neue Halle in Gersthofen“). Kein Clickbait.",
    "In diesem Brief steht KEIN Paketname, KEIN Preis, KEIN Betrag, KEIN Kapitalrahmen und KEIN Satz darüber, dass ein Institut oder eine Bank entscheidet.",
    "",
    "passt / passt_grund — die Kundensicht, bevor der Brief geht: passt = false, wenn die Firma das Angebot offensichtlich nicht braucht oder nicht nutzen kann: sie hat schon eine eigene US-Gesellschaft oder US-Fertigung, sie ist ein Konzern, börsennotiert oder hat mehr als etwa 250 Mitarbeiter, sie hat gerade eine große Finanzierungsrunde (über etwa 10 Mio. €) abgeschlossen und einen eigenen Finanzchef, sie ist in Insolvenz oder Liquidation, sie ist selbst Bank, Finanzdienstleister oder Gründungsdienst. Sonst passt = true. passt_grund = ein Satz.",
    "",
    "VERBOTEN: Kapital, Kredite oder Limits versprechen; jeder Betrag, Rahmen oder Limit; „bis zu“; Namen von Banken oder Kartenherausgebern; „garantiert“; „Steuern sparen“; „empfehlen“; dass FIAON „berät“; „0 %“; „ohne Sicherheiten“; jede Behauptung über die Firma, die nicht in den geprüften Aufhängern oder im Profil steht; erfundene Zahlen.",
    "Antworte ausschließlich im vorgegebenen JSON.",
  ].join("\n");
}

/** Die Wände vor jedem Brief: dieselben wie bei der Mail (sperrend), dazu die Länge für EINE Seite (Hinweis). Rein. */
export function briefPruefen(b: { betreff: string; absaetze: string[]; frage: string }): { sperrend: string[]; warnungen: string[] } {
  const m = mailPruefen({ betreff: b.betreff, absaetze: b.absaetze, frage: b.frage, ps: "" });
  // Die Längenregeln der Mail (unter 40 / über 130 Wörter) gelten für Papier nicht — dort zählt: passt es auf eine Seite?
  const warnungen = m.warnungen.filter((w) => !/^(Sehr kurz|Lang) \(/.test(w));
  const woerter = [...b.absaetze, b.frage].join(" ").split(/\s+/).filter(Boolean).length;
  if (woerter < 60) warnungen.push(`Sehr kurz (${woerter} Wörter)`);
  if (woerter > 170) warnungen.push(`Lang (${woerter} Wörter) — der Brief soll auf eine Seite passen`);
  if (b.betreff.length > 70) warnungen.push("Betreff länger als 70 Zeichen");
  const rumpf = [b.betreff, ...b.absaetze, b.frage].join("\n");
  if (/https?:\/\/|www\.|[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(rumpf)) warnungen.push("Link oder Mailadresse im Text — QR-Code und Kontakt setzt der Brief selbst");
  // Dieselbe Wand — die Meldung spricht vom Brief, nicht von der Mail.
  return { sperrend: m.sperrend.map((x) => x.replace(/Akquise-Mail/g, "Akquise-Brief")), warnungen };
}

async function firmaLaden(id: number): Promise<any> {
  await ensureRadarTabellen();
  const f: any = zeileLesen(((await sqlPool`SELECT * FROM fiaon_radar_firmen WHERE id = ${id}`) as any[])[0]);
  if (!f) throw new RadarFehler("Firma nicht gefunden.", 404);
  return f;
}

/** Die Anrede des Briefs: dieselbe Regel wie die Mail (anredeFuer) — auf Papier „Guten Tag“ statt „Hallo“. */
export function briefAnrede(e: RadarBriefEmpfaenger): string {
  return anredeFuer(e.person, e.anrede).replace(/^Hallo /, "Guten Tag ");
}

export async function radarBriefSchreiben(id: number, wunsch: { hinweis?: string | null } = {}): Promise<RadarBrief> {
  let f = await firmaLaden(id);
  if (f.status === "gesperrt" || f.status === "kein_interesse") throw new RadarFehler("Diese Firma ist gesperrt oder hat abgelehnt.");
  if (f.brief_versendet_am) throw new RadarFehler("An diese Firma ging schon ein Brief — je Firma genau einer.");
  if (f.brief_status === "sendet") throw new RadarFehler("Der Brief wird gerade übergeben.", 409);
  const { empfaenger, quelle } = await briefEmpfaengerErmitteln(f);
  if (empfaenger.fehlt.length) throw new RadarFehler(`Für einen persönlichen Brief fehlt: ${empfaenger.fehlt.join(", ")}. Ohne vollständige Anschrift aus dem Impressum schreibt Mara keinen Brief.`);
  if (!f.scan) { await radarScannen(id); f = await firmaLaden(id); }
  const aufhaenger: Aufhaenger[] = Array.isArray(f.scan?.aufhaenger) ? f.scan.aufhaenger : [];
  if (!aufhaenger.length) throw new RadarFehler("Der Scan hat keinen belegten Aufhänger gefunden — ohne ihn wäre der Brief nicht persönlich. Bitte erneut scannen oder eine andere Firma wählen.");
  const anrede = briefAnrede(empfaenger);
  const hinweis = String(wunsch.hinweis ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 400);
  const eingabe = [
    `Firma: ${f.name} (${f.website}), ${f.ort ?? ""} ${f.land ?? ""}. Bereich: ${radarBereich(f.bereich)?.label ?? f.bereich}.`,
    `Empfänger: ${empfaenger.person}${empfaenger.rolle ? ` (${empfaenger.rolle})` : ""}. Die Anrede setzt der Server: „${anrede}“.`,
    `Profil: ${JSON.stringify(f.scan?.profil ?? {})}`,
    "GEPRÜFTE Aufhänger (nur diese verwenden):",
    ...aufhaenger.map((x, i) => `${i + 1}. ${x.text} — Beleg: „${x.beleg}“ (${x.url})`),
    f.signal ? `Kapitalsignal (geprüft): ${JSON.stringify(f.signal)}` : "",
    hinweis ? `Wunsch aus dem Chefbüro: ${hinweis}` : "",
  ].filter(Boolean).join("\n");

  let versuch = 0; let nachtrag = "";
  let e: { betreff: string; absaetze: string[]; frage: string; passt: boolean; passt_grund: string } | null = null;
  let pruefung = { sperrend: [] as string[], warnungen: [] as string[] };
  while (versuch < 2) {
    versuch++;
    const { daten } = await radarKi<{ betreff: string; absaetze: string[]; frage: string; passt: boolean; passt_grund: string }>({
      zweck: "radar_brief", anweisung: briefAnweisung(), eingabe: eingabe + nachtrag, schema: SCHEMA_BRIEF, aufwand: "medium", maxTokens: 12_000,
    });
    e = {
      betreff: String(daten.betreff || "").replace(/^(re|aw|fwd?):\s*/i, "").trim().slice(0, 120),
      absaetze: (daten.absaetze || []).map((x) => String(x).trim()).filter(Boolean).slice(0, 5),
      frage: String(daten.frage || "").trim(),
      passt: daten.passt !== false, passt_grund: String(daten.passt_grund || "").trim().slice(0, 300),
    };
    pruefung = briefPruefen(e);
    if (!pruefung.sperrend.length) break;
    nachtrag = `\n\nDein letzter Entwurf verletzte diese Regeln — schreibe ihn neu und vermeide sie: ${pruefung.sperrend.join("; ")}`;
  }
  const b = e!;
  if (b.passt === false) pruefung.sperrend.push(`Passt nicht: ${b.passt_grund || "die Lage der Firma spricht dagegen"}`);
  const brief: RadarBrief = {
    betreff: b.betreff, anrede, absaetze: b.absaetze, frage: b.frage, empfaenger, quelle,
    kennung: radarBriefKennung(id), link: radarBriefLink(id, SEITE()), antwortAn: radarPostfaecher()[0] ?? "js@fiaon.com",
    warnungen: pruefung.warnungen, sperrend: pruefung.sperrend, geaendert: false, erstellt_am: new Date().toISOString(),
  };
  // Wie bei der Mail (E-337): Passt das Angebot nicht zur Lage, wandert die Firma zu „Passt nicht“ — ohne Sperrliste.
  await sqlPool`UPDATE fiaon_radar_firmen SET brief = ${sqlPool.json(brief as any)}, brief_am = NOW(),
                  brief_status = CASE WHEN brief_status IN ('uebergeben', 'versendet') THEN brief_status ELSE 'entwurf' END, brief_fehler = NULL,
                  status = CASE WHEN ${b.passt === false} AND status IN ('neu', 'gescannt', 'mail') THEN 'passt_nicht' ELSE status END,
                  notiz = CASE WHEN ${b.passt === false} THEN ${`Passt nicht (KI vor dem Brief): ${b.passt_grund || "—"}`} ELSE notiz END,
                  updated_at = NOW() WHERE id = ${id}`;
  return brief;
}

/** Von Hand geänderter Text: Betreff und Absätze (Leerzeile = neuer Absatz, der letzte ist die Schlussfrage). */
export async function radarBriefAendern(id: number, ein: { betreff: string; koerper: string }): Promise<RadarBrief> {
  const f = await firmaLaden(id);
  if (!f.brief) throw new RadarFehler("Es gibt noch keinen Brief zu dieser Firma.", 404);
  if (f.brief_versendet_am || f.brief_status === "sendet") throw new RadarFehler("Der Brief ist schon beim Versanddienst — er lässt sich nicht mehr ändern.");
  const bloecke = String(ein.koerper || "").replace(/\r/g, "").split(/\n\s*\n/).map((x) => x.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean);
  if (bloecke.length < 2) throw new RadarFehler("Bitte mindestens zwei Absätze (getrennt durch eine Leerzeile).");
  const frage = bloecke[bloecke.length - 1];
  const absaetze = bloecke.slice(0, -1).slice(0, 6);
  const betreff = String(ein.betreff || "").replace(/[\r\n]+/g, " ").trim().slice(0, 120);
  if (!betreff) throw new RadarFehler("Bitte einen Betreff angeben.");
  const pruefung = briefPruefen({ betreff, absaetze, frage });
  const brief: RadarBrief = { ...f.brief, betreff, absaetze, frage, warnungen: pruefung.warnungen, sperrend: pruefung.sperrend, geaendert: true };
  await sqlPool`UPDATE fiaon_radar_firmen SET brief = ${sqlPool.json(brief as any)}, brief_status = 'entwurf', brief_fehler = NULL, updated_at = NOW() WHERE id = ${id}`;
  return brief;
}

// ── DRUCKEN: A4 NACH DIN 5008 FORM B ────────────────────────────────────────
// Maße in Millimetern: Anschriftfeld 20 mm von links, 45 mm von oben, 85 × 45 mm (Rücksendeangabe 5 mm, Zusatz- und
// Vermerkzone 12,7 mm, Anschriftzone 27,3 mm) — das passt ins linke Fenster von DL-, C6/5- und C5-Umschlägen.
// Informationsblock rechts ab 125 mm, Betreff bei 98,5 mm. Nichts näher als 8 mm am Blattrand (Druckränder der Dienste).
const BILD_CACHE = new Map<string, string | null>();
function bildAlsDaten(relativ: string): string | null {
  if (BILD_CACHE.has(relativ)) return BILD_CACHE.get(relativ)!;
  let daten: string | null = null;
  for (const basis of [path.resolve(process.cwd(), "dist/public"), path.resolve(process.cwd(), "client/public")]) {
    try { daten = `data:image/png;base64,${fs.readFileSync(path.join(basis, relativ)).toString("base64")}`; break; } catch { /* nächste Ablage */ }
  }
  BILD_CACHE.set(relativ, daten);
  return daten;
}

function datumLang(d = new Date()): string {
  return new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "numeric", month: "long", year: "numeric" }).format(d);
}

export async function briefQrSvg(link: string): Promise<string> {
  return QRCode.toString(link, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#0c1a2eff", light: "#ffffff00" } });
}

/** Der ganze Brief als HTML (eine A4-Seite). Alle Werte maskiert; der QR-Code ist ein SVG aus der eigenen Bibliothek. */
export function briefHtml(b: RadarBrief, opts: { qrSvg: string; farbe: boolean; datum?: Date }): string {
  const a = radarAbsender();
  const e = escapeHtml;
  const blau = opts.farbe ? "#288DFA" : "#5b6472";
  const tief = opts.farbe ? "#1D4ED8" : "#2b2f36";
  const glas = opts.farbe ? "#f2f7ff" : "#f5f6f8";
  const kante = opts.farbe ? "#cfe2ff" : "#d9dce1";
  const navy = opts.farbe ? MARKE_NAVY : "#111418";
  const bild = bildAlsDaten("mail/signatur/justin.png");
  const telefon = a.telefon;
  const rolle = a.rolle.replace(/\s*·\s*FIAON Global\s*$/i, "");
  return `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Inter, "Helvetica Neue", Helvetica, Arial, sans-serif; color: ${navy}; -webkit-font-smoothing: antialiased; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .blatt { position: relative; width: 210mm; min-height: 297mm; padding: 98.5mm 20mm 10mm 25mm; display: flex; flex-direction: column; }
  .marke { position: absolute; top: 15mm; right: 20mm; line-height: 0; }
  .linie { position: absolute; top: 33mm; left: 25mm; right: 20mm; height: 0.5mm; border-radius: 0.25mm; background: linear-gradient(90deg, ${opts.farbe ? "#9fd0ff" : "#c9ccd2"}, ${blau} 45%, ${tief}); }
  .fenster { position: absolute; top: 45mm; left: 20mm; width: 85mm; height: 45mm; }
  .ruecksendung { height: 5mm; font-size: 6.3pt; color: #5b6b82; letter-spacing: .01em; white-space: nowrap; overflow: hidden; padding-top: 1mm; }
  .ruecksendung span { border-bottom: 0.15mm solid #9aa8bb; padding-bottom: 0.2mm; }
  .anschrift { position: absolute; top: 17.7mm; left: 0; right: 0; font-size: 10pt; line-height: 1.32; font-weight: 400; color: ${navy === MARKE_NAVY ? "#0b1220" : navy}; }
  .info { position: absolute; top: 50mm; left: 125mm; width: 65mm; margin: 0; font-size: 7.4pt; line-height: 1.38; }
  .info dt { color: #6b7a90; font-weight: 400; margin: 0; }
  .info dd { margin: 0 0 1.2mm; color: ${navy}; font-weight: 500; }
  h1 { font-size: 11.2pt; font-weight: 500; letter-spacing: -0.005em; margin: 0 0 5mm; color: ${navy}; }
  .text p { font-size: 9.8pt; line-height: 1.47; font-weight: 400; margin: 0 0 2.6mm; color: #16213a; }
  .schluss { display: flex; align-items: center; justify-content: space-between; gap: 6mm; margin-top: 3.5mm; }
  .gruss { display: flex; align-items: center; gap: 3.5mm; }
  .gruss img { width: 13mm; height: 13mm; border-radius: 50%; object-fit: cover; border: 0.35mm solid ${kante}; }
  .gruss p { margin: 0; font-size: 9.8pt; line-height: 1.35; }
  .gruss .name { font-weight: 500; }
  .gruss .rolle { font-size: 8pt; color: #5b6b82; }
  .karte { width: 98mm; flex: none; display: flex; gap: 4.5mm; align-items: center; padding: 3.2mm 4mm; border-radius: 3.2mm; background: ${glas}; border: 0.3mm solid ${kante}; box-shadow: inset 0 0.4mm 0 #ffffff; }
  .qr { width: 25mm; height: 25mm; flex: none; padding: 1.5mm; background: #ffffff; border-radius: 2mm; border: 0.25mm solid ${kante}; }
  .qr svg { width: 100%; height: 100%; display: block; }
  .karte div { font-size: 8pt; line-height: 1.42; color: #2a3954; }
  .karte b { display: block; font-size: 9.6pt; font-weight: 600; color: ${tief}; margin-bottom: 0.8mm; }
  .karte span { display: block; }
  .karte .klein { font-size: 7.2pt; color: #5b6b82; margin-top: 1.2mm; }
  .unten { margin-top: auto; padding-top: 5mm; }
  .widerspruch { border-left: 0.8mm solid ${blau}; background: ${glas}; border-radius: 0 2mm 2mm 0; padding: 2mm 3.5mm; margin-bottom: 2.2mm; font-size: 7pt; line-height: 1.4; color: #2a3954; }
  .widerspruch b { display: block; font-size: 7.6pt; font-weight: 600; color: ${navy}; margin-bottom: 0.4mm; }
  .datenschutz { font-size: 6pt; line-height: 1.4; color: #5b6b82; margin: 0 0 1.8mm; text-align: justify; }
  .datenschutz b { color: #3d4b62; font-weight: 600; }
  .fuss { border-top: 0.2mm solid #dfe5ee; padding-top: 1.4mm; font-size: 6pt; color: #8090a6; display: flex; justify-content: space-between; gap: 4mm; }
</style></head>
<body><div class="blatt">
  <div class="marke">${markeSvg("global", navy, "6.6mm")}</div>
  <div class="linie"></div>
  <div class="fenster">
    <div class="ruecksendung"><span>${e(RADAR_BRIEF_TEXTE.ruecksendung)}</span></div>
    <div class="anschrift">${b.empfaenger.zeilen.map((z) => e(z)).join("<br>")}</div>
  </div>
  <dl class="info">
    <dt>Ihr Ansprechpartner</dt><dd>${e(a.name)}<br><span style="font-weight:400">${e(rolle)} · FIAON Global</span></dd>
    <dt>Telefon</dt><dd>${e(telefon)}</dd>
    <dt>E-Mail</dt><dd>${e(b.antwortAn)}</dd>
    <dt>Ihre Kennung</dt><dd>${e(b.kennung)}</dd>
    <dt>Datum</dt><dd>${e(datumLang(opts.datum))}</dd>
  </dl>
  <h1>${e(b.betreff)}</h1>
  <div class="text">
    <p>${e(b.anrede)}</p>
    ${b.absaetze.map((x) => `<p>${e(x)}</p>`).join("\n    ")}
    <p>${e(b.frage)}</p>
  </div>
  <div class="schluss">
    <div class="gruss">
      ${bild ? `<img src="${bild}" alt="">` : ""}
      <div><p>Viele Grüße</p><p class="name">${e(a.name)}</p><p class="rolle">${e(rolle)} · FIAON Global</p></div>
    </div>
    <div class="karte">
      <div class="qr">${opts.qrSvg}</div>
      <div>
        <b>${e(RADAR_BRIEF_TEXTE.qrTitel)}</b>
        <span>${e(RADAR_BRIEF_TEXTE.qrSatz)}</span>
        <span>${e(RADAR_BRIEF_TEXTE.antwort(b.antwortAn))}</span>
        <span>${e(RADAR_BRIEF_TEXTE.telefon(telefon))}</span>
        <span class="klein">${e(RADAR_BRIEF_TEXTE.qrOhneCode)}</span>
      </div>
    </div>
  </div>
  <div class="unten">
    <div class="widerspruch"><b>${e(RADAR_BRIEF_TEXTE.widerspruchTitel)}</b>${e(RADAR_BRIEF_TEXTE.widerspruch(b.kennung, b.antwortAn, telefon))}</div>
    <p class="datenschutz"><b>${e(RADAR_BRIEF_TEXTE.datenschutzTitel)}.</b> ${e(RADAR_BRIEF_TEXTE.datenschutz(b.quelle))}</p>
    <div class="fuss"><span>${e(FIAON_FIRMA.name)} · ${e(FIAON_FIRMA.strasse)}, ${e(FIAON_FIRMA.ortZeile)}, ${e(FIAON_FIRMA.land)} · ${e(FIAON_FIRMA.register)} Nr. ${e(FIAON_FIRMA.companyNo)} · Director: ${e(FIAON_FIRMA.director)}</span><span>fiaon.com</span></div>
  </div>
</div></body></html>`;
}

/** Der Brief als PDF — mit Seitenzahl (mehr als eine Seite ist ein Hinweis, mehr als zwei sperrt den Versand). */
export async function radarBriefPdf(id: number, opts: { farbe?: boolean } = {}): Promise<{ pdf: Buffer; seiten: number; name: string }> {
  const f = await firmaLaden(id);
  if (!f.brief) throw new RadarFehler("Bitte zuerst den Brief schreiben lassen.", 404);
  const farbe = opts.farbe ?? (await radarBriefEinstellung()).farbe;
  const brief: RadarBrief = f.brief;
  const html = briefHtml(brief, { qrSvg: await briefQrSvg(brief.link), farbe, datum: f.brief_versendet_am ? new Date(f.brief_versendet_am) : new Date() });
  const pdf = await htmlZuPdfBlatt(html);
  const seiten = (await PDFDocument.load(pdf)).getPageCount();
  return { pdf, seiten, name: `FIAON-Brief-${brief.kennung}.pdf` };
}

// ── DIE VERSANDDIENSTE ───────────────────────────────────────────────────────
interface Uebergabe { id: string; status: string | null; kostenCents: number | null }

async function jsonOderText(res: Response): Promise<any> {
  const t = await res.text();
  try { return JSON.parse(t); } catch { return { roh: t.slice(0, 300) }; }
}

// Pingen (API v2, offizielles SDK pingencom/pingen2-sdk-php): Token über OAuth2 client_credentials, dann
// GET /file-upload (Adresse + Signatur), PUT der Datei, POST /organisations/{org}/deliveries/letters.
// auto_send = false heißt: Pingen prüft den Brief (Anschrift im Fenster), schickt ihn aber nicht ab — unser Testmodus.
// PINGEN_STAGING=1 nimmt die Testumgebung von Pingen (eigenes Staging-Konto). PINGEN_API_URL/PINGEN_IDENTITY_URL nur für
// den lokalen Prüfstand (ein Nachbau des Dienstes auf 127.0.0.1) — in Produktion bleiben sie leer.
const PINGEN = () => {
  const basis = process.env.PINGEN_STAGING === "1"
    ? { identity: "https://identity-staging.pingen.com", api: "https://api-staging.pingen.com" }
    : { identity: "https://identity.pingen.com", api: "https://api.pingen.com" };
  return { identity: process.env.PINGEN_IDENTITY_URL || basis.identity, api: process.env.PINGEN_API_URL || basis.api };
};
let pingenToken: { wert: string; bis: number; api: string } | null = null;

async function pingenZugang(): Promise<string> {
  const u = PINGEN();
  if (pingenToken && pingenToken.api === u.api && pingenToken.bis > Date.now() + 60_000) return pingenToken.wert;
  const res = await fetch(`${u.identity}/auth/access-tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: String(process.env.PINGEN_CLIENT_ID), client_secret: String(process.env.PINGEN_CLIENT_SECRET), scope: "letter" }).toString(),
    signal: AbortSignal.timeout(20_000),
  });
  const j = await jsonOderText(res as any);
  if (!res.ok || !j?.access_token) throw new RadarFehler(`Pingen lehnt die Anmeldung ab (HTTP ${res.status}: ${String(j?.error_description ?? j?.error ?? j?.roh ?? "").slice(0, 160)}).`, 502);
  pingenToken = { wert: String(j.access_token), bis: Date.now() + Math.max(60, Number(j.expires_in) || 3600) * 1000, api: u.api };
  return pingenToken.wert;
}

async function pingenSenden(pdf: Buffer, ein: { name: string; test: boolean; farbe: boolean }): Promise<Uebergabe> {
  const u = PINGEN();
  const token = await pingenZugang();
  const kopf = { Authorization: `Bearer ${token}`, Accept: "application/vnd.api+json", "Content-Type": "application/vnd.api+json" };
  const hoch = await fetch(`${u.api}/file-upload`, { headers: kopf, signal: AbortSignal.timeout(20_000) });
  const hj = await jsonOderText(hoch as any);
  const ziel = hj?.data?.attributes?.url; const signatur = hj?.data?.attributes?.url_signature;
  if (!hoch.ok || !ziel || !signatur) throw new RadarFehler(`Pingen gibt keine Upload-Adresse (HTTP ${hoch.status}).`, 502);
  const put = await fetch(String(ziel), { method: "PUT", headers: { "Content-Type": "application/pdf" }, body: new Uint8Array(pdf), signal: AbortSignal.timeout(60_000) });
  if (!put.ok) throw new RadarFehler(`Pingen nimmt die Datei nicht an (HTTP ${put.status}).`, 502);
  const res = await fetch(`${u.api}/organisations/${encodeURIComponent(String(process.env.PINGEN_ORGANISATION_ID))}/deliveries/letters`, {
    method: "POST", headers: kopf, signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      data: {
        type: "letters",
        attributes: {
          file_original_name: ein.name, file_url: ziel, file_url_signature: signatur, address_position: "left",
          auto_send: !ein.test, delivery_product: process.env.PINGEN_PRODUKT || "cheap", print_mode: "simplex", print_spectrum: ein.farbe ? "color" : "grayscale",
        },
      },
    }),
  });
  const j = await jsonOderText(res as any);
  if (!res.ok || !j?.data?.id) throw new RadarFehler(`Pingen legt den Brief nicht an (HTTP ${res.status}: ${JSON.stringify(j?.errors ?? j?.roh ?? "").slice(0, 200)}).`, 502);
  const at = j.data.attributes ?? {};
  const preis = Number(at.price_value);
  return { id: String(j.data.id), status: at.status ? String(at.status) : null, kostenCents: Number.isFinite(preis) && preis > 0 && String(at.price_currency ?? "EUR").toUpperCase() === "EUR" ? Math.round(preis * 100) : null };
}

async function pingenStand(briefId: string): Promise<{ status: string | null }> {
  const u = PINGEN();
  const token = await pingenZugang();
  const res = await fetch(`${u.api}/organisations/${encodeURIComponent(String(process.env.PINGEN_ORGANISATION_ID))}/deliveries/letters/${encodeURIComponent(briefId)}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.api+json" }, signal: AbortSignal.timeout(20_000),
  });
  const j = await jsonOderText(res as any);
  if (!res.ok) throw new RadarFehler(`Pingen kennt den Brief nicht (HTTP ${res.status}).`, 502);
  return { status: j?.data?.attributes?.status ? String(j.data.attributes.status) : null };
}

// LetterXpress (API v3, Doku letterxpress.de/briefe-uebertragen/api): auth { username, apikey, mode test|live } in JEDER
// Anfrage; letter { base64_file, base64_file_checksum (MD5 der Base64-Zeichenkette), specification { color 1|4, mode,
// shipping national|international } }. mode „test“ legt den Auftrag in die Postbox (nicht gedruckt, nach 7 Tagen gelöscht).
async function letterxpressSenden(pdf: Buffer, ein: { name: string; test: boolean; farbe: boolean; land: string | null }): Promise<Uebergabe> {
  const base64 = pdf.toString("base64");
  const res = await fetch(`${process.env.LETTERXPRESS_API || "https://api.letterxpress.de/v3"}/printjobs`, {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({
      auth: { username: process.env.LETTERXPRESS_BENUTZER, apikey: process.env.LETTERXPRESS_API_KEY, mode: ein.test ? "test" : "live" },
      letter: {
        base64_file: base64, base64_file_checksum: createHash("md5").update(base64).digest("hex"), filename_original: ein.name,
        specification: { color: ein.farbe ? "4" : "1", mode: "simplex", shipping: ein.land === "DE" ? "national" : "international" },
      },
    }),
  });
  const j = await jsonOderText(res as any);
  const d = j?.data ?? j;
  const id = d?.id ?? d?.printjob?.id ?? d?.jid;
  if (!res.ok || id == null) throw new RadarFehler(`LetterXpress nimmt den Auftrag nicht an (HTTP ${res.status}: ${String(j?.message ?? j?.roh ?? "").slice(0, 200)}).`, 502);
  const preis = Number(d?.price ?? d?.amount ?? d?.cost);
  return { id: String(id), status: d?.status ? String(d.status) : null, kostenCents: Number.isFinite(preis) && preis > 0 ? Math.round(preis * 100) : null };
}

// ── SENDEN ───────────────────────────────────────────────────────────────────
/** Brieftext für den Verlauf (fiaon_radar_post) — damit Mara bei einer Antwort weiß, was im Brief stand. */
function briefText(b: RadarBrief): string {
  return [`Brief an ${b.empfaenger.zeilen.slice(0, 2).join(", ")} (${b.kennung})`, "", `Betreff: ${b.betreff}`, "", b.anrede, "", ...b.absaetze.flatMap((x) => [x, ""]), b.frage].join("\n");
}

export async function radarBriefSenden(id: number, ein: { von?: number | null; automatisch?: boolean } = {}): Promise<{ ok: true; test: boolean; anbieter: RadarBriefAnbieter; anbieterId: string; kostenCents: number | null; seiten: number }> {
  const s = await radarBriefEinstellung();
  if (!s.versand) throw new RadarFehler("Der Briefversand ist aus — im Firmen-Radar unter „Automatik › Briefe“ einschalten.", 409);
  const bereit = anbieterBereit(s.anbieter);
  if (!bereit.ok) throw new RadarFehler(`Für ${RADAR_BRIEF_ANBIETER[s.anbieter].label} fehlen noch die Zugangsdaten: ${bereit.fehlt.join(", ")}.`, 503);
  const f = await firmaLaden(id);
  if (!f.brief) throw new RadarFehler("Bitte zuerst den Brief schreiben lassen.");
  const pruef = radarBriefPruefen(f);
  if (!pruef.ok) throw new RadarFehler(`Kein Brief an diese Firma: ${pruef.punkte.filter((p) => !p.ok).map((p) => p.text).join(" · ")}`);
  if (await gesperrt(f.email ?? null, f.domain)) throw new RadarFehler("Die Firma steht auf der Sperrliste.");
  const brief: RadarBrief = f.brief;
  if (brief.sperrend?.length) throw new RadarFehler(`Der Brief verletzt noch Regeln: ${brief.sperrend.join("; ")}`);
  // Die Wand gilt beim SENDEN — ein Brief, der nach älteren Regeln geschrieben wurde, muss neu geschrieben werden.
  const jetzt = briefPruefen(brief);
  if (jetzt.sperrend.length) throw new RadarFehler(`Dieser Brief ist nach alten Regeln geschrieben (${jetzt.sperrend.join("; ")}) — bitte „Neu schreiben“.`);
  if (brief.empfaenger?.fehlt?.length) throw new RadarFehler(`Die Anschrift ist unvollständig: ${brief.empfaenger.fehlt.join(", ")}.`);

  // Tageskontingent und „genau ein Brief“ unter einer Sperre: Automatik und Klick im Chefbüro greifen nie beide zu.
  const test = s.testmodus;
  const frei = await sqlPool.begin(async (tx: any) => {
    await tx`SELECT pg_advisory_xact_lock(339001)`;
    const heute = berlinToday();
    const [z] = await tx`SELECT COUNT(*)::int AS n FROM fiaon_radar_firmen
                          WHERE ((${test} = FALSE AND (brief_versendet_am AT TIME ZONE 'Europe/Berlin')::date = ${heute}::date)
                              OR (${test} = TRUE AND (brief_test_am AT TIME ZONE 'Europe/Berlin')::date = ${heute}::date))`;
    if (Number(z?.n ?? 0) >= s.jeTag) return { grund: `Tageskontingent erreicht (${s.jeTag} ${test ? "Testbriefe" : "Briefe"} heute).` };
    const r = await tx`UPDATE fiaon_radar_firmen SET brief_status = 'sendet', brief_fehler = NULL, updated_at = NOW()
                        WHERE id = ${id} AND brief_versendet_am IS NULL AND COALESCE(brief_status, 'entwurf') NOT IN ('sendet', 'uebergeben', 'versendet')
                        RETURNING id`;
    return r.length ? { grund: null } : { grund: "Der Brief wird gerade übergeben oder ist schon unterwegs." };
  }) as { grund: string | null };
  if (frei.grund) throw new RadarFehler(frei.grund, 429);

  try {
    const { pdf, seiten, name } = await radarBriefPdf(id, { farbe: s.farbe });
    if (seiten > 2) throw new RadarFehler(`Der Brief hat ${seiten} Seiten — bitte kürzen (höchstens zwei).`);
    const u = s.anbieter === "pingen"
      ? await pingenSenden(pdf, { name, test, farbe: s.farbe })
      : await letterxpressSenden(pdf, { name, test, farbe: s.farbe, land: brief.empfaenger.land });
    const schaetzung = radarBriefKosten(s.anbieter, brief.empfaenger.land).cents;
    if (test) {
      await sqlPool`UPDATE fiaon_radar_firmen SET brief_status = 'test', brief_test_am = NOW(), brief_anbieter = ${s.anbieter}, brief_anbieter_id = ${u.id},
                      brief_fehler = NULL, updated_at = NOW() WHERE id = ${id}`;
    } else {
      await sqlPool`UPDATE fiaon_radar_firmen SET brief_status = 'uebergeben', brief_versendet_am = NOW(), brief_versendet_von = ${ein.von ?? null},
                      brief_anbieter = ${s.anbieter}, brief_anbieter_id = ${u.id}, brief_kosten_cents = ${u.kostenCents ?? schaetzung}, brief_fehler = NULL,
                      status = CASE WHEN status IN ('neu', 'gescannt', 'mail', 'im_postfach', 'ohne_kontakt') THEN 'brief' ELSE status END,
                      updated_at = NOW() WHERE id = ${id}`;
      await sqlPool`INSERT INTO fiaon_radar_post (firma_id, postfach, richtung, art, von, betreff, datum, text)
                    VALUES (${id}, 'brief', 'aus', 'brief', ${RADAR_BRIEF_ANBIETER[s.anbieter].label}, ${brief.betreff}, NOW(), ${briefText(brief).slice(0, 6000)})`;
    }
    console.log(`[RADAR-BRIEF] ${test ? "Test" : "Brief"} ${brief.kennung} an ${RADAR_BRIEF_ANBIETER[s.anbieter].label} (${u.id})${ein.automatisch ? " — Mara" : ` — #${ein.von ?? "?"}`}`);
    return { ok: true, test, anbieter: s.anbieter, anbieterId: u.id, kostenCents: test ? 0 : (u.kostenCents ?? schaetzung), seiten };
  } catch (e: any) {
    await sqlPool`UPDATE fiaon_radar_firmen SET brief_status = 'fehler', brief_fehler = ${String(e?.message || e).slice(0, 400)}, updated_at = NOW()
                   WHERE id = ${id} AND brief_status = 'sendet'`.catch(() => {});
    if (e instanceof RadarFehler) throw e;
    throw new RadarFehler(`Übergabe an ${RADAR_BRIEF_ANBIETER[s.anbieter].label} gescheitert: ${String(e?.message || e).slice(0, 200)}`, 502);
  }
}

// ── MESSEN: BESUCHE AUS DEM QR-CODE ─────────────────────────────────────────
const KEIN_MENSCH = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|slack|discord|curl|wget|python|headless|lighthouse|monitor|uptime/i;

/**
 * Ein Aufruf von /business?utm_source=radar_brief&utm_content=r<ID>. Gezählt wird nur, wenn an diese Firma wirklich ein
 * Brief ging, nicht für Roboter und höchstens einmal je halbe Stunde. Ohne IP, ohne Gerät — nur Firma und Zeit.
 */
export async function radarBriefBesuchMerken(utmContent: unknown, userAgent: unknown): Promise<boolean> {
  const id = radarKennungLesen(utmContent);
  if (!id || KEIN_MENSCH.test(String(userAgent ?? "")) || !String(userAgent ?? "").trim()) return false;
  await ensureRadarTabellen();
  const r = (await sqlPool`
    INSERT INTO fiaon_radar_besuche (firma_id, quelle)
    SELECT r.id, ${RADAR_BRIEF_QUELLE} FROM fiaon_radar_firmen r
     WHERE r.id = ${id} AND r.brief_versendet_am IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM fiaon_radar_besuche b WHERE b.firma_id = r.id AND b.am > NOW() - INTERVAL '30 minutes')
    RETURNING id`) as any[];
  return r.length > 0;
}

// ── DER LAUF: MARA SCHREIBT BRIEFE IM TAGESKONTINGENT ───────────────────────
export interface BriefLaufErgebnis { versandt: number; briefe: number; test: number; uebersprungen: number; heute: number; ziel: number; aus: boolean; abgeglichen: number; grund?: string }

/** Fragt beim Dienst nach, was aus übergebenen Briefen wurde (nur Pingen; LetterXpress meldet keinen Stand je Auftrag). */
async function standAbgleichen(): Promise<number> {
  if (!anbieterBereit("pingen").ok) return 0;
  const offen = (await sqlPool`SELECT id, brief_anbieter_id FROM fiaon_radar_firmen WHERE brief_status = 'uebergeben' AND brief_anbieter = 'pingen' AND brief_anbieter_id IS NOT NULL
                                ORDER BY brief_versendet_am ASC LIMIT 10`) as any[];
  let n = 0;
  for (const o of offen) {
    try {
      const { status } = await pingenStand(String(o.brief_anbieter_id));
      if (!status) continue;
      if (/^(sent|submitted|accepted|delivered)$/.test(status)) {
        await sqlPool`UPDATE fiaon_radar_firmen SET brief_status = 'versendet', updated_at = NOW() WHERE id = ${o.id} AND brief_status = 'uebergeben'`; n++;
      } else if (/^(invalid|action_required|undeliverable|cancelled|canceled|unprintable|expired)$/.test(status)) {
        await sqlPool`UPDATE fiaon_radar_firmen SET brief_status = 'fehler', brief_fehler = ${`Pingen meldet „${status}“ — bitte bei Pingen ansehen.`}, updated_at = NOW() WHERE id = ${o.id}`; n++;
      }
    } catch (e: any) { console.error(`[RADAR-BRIEF] Stand ${o.id}:`, e?.message || e); }
  }
  return n;
}

export async function radarBriefLauf(jetzt = new Date()): Promise<BriefLaufErgebnis> {
  await ensureRadarTabellen();
  const s = await radarBriefEinstellung();
  const erg: BriefLaufErgebnis = { versandt: 0, briefe: 0, test: 0, uebersprungen: 0, heute: 0, ziel: s.jeTag, aus: !s.versand, abgeglichen: 0 };
  erg.abgeglichen = await standAbgleichen().catch(() => 0);
  if (!s.versand) return { ...erg, grund: "aus" };
  if (!radarSendefenster(jetzt)) return { ...erg, grund: "außerhalb des Sendefensters" };
  if (!anbieterBereit(s.anbieter).ok) return { ...erg, grund: "kein Versanddienst eingerichtet" };
  if (await kiPausiert()) return { ...erg, grund: "KI pausiert" };
  const h = await radarBriefHeute(berlinToday(jetzt));
  erg.heute = s.testmodus ? h.test : h.briefe;
  const automatik = await radarAutomatik();
  let rest = Math.min(2, s.jeTag - erg.heute);
  let versuche = 0;
  while (rest > 0 && versuche < 5) {
    versuche++;
    // Beste zuerst: Kapitalsignal, dann Passung. Nur Firmen ohne bisherigen Kontakt, mit Anschrift im Impressum, je Firma
    // EIN Versuch der Automatik (brief_auto_am) — was übersprungen wurde, holt ein Mensch in der Akte nach.
    const [kandidat] = (await sqlPool`
      SELECT id FROM fiaon_radar_firmen r
       WHERE r.status IN ('neu', 'gescannt', 'mail', 'ohne_kontakt') AND r.versendet_am IS NULL AND r.brief_versendet_am IS NULL
         AND COALESCE(r.brief_status, '') NOT IN ('test', 'sendet', 'uebergeben', 'versendet', 'fehler') AND r.brief_auto_am IS NULL
         AND r.archiviert_am IS NULL
         AND (r.signal_staerke IS NULL OR r.signal_staerke >= ${RADAR_SIGNAL_AB}) AND COALESCE(r.passung, 0) >= ${automatik.abPassung}
         AND r.impressum ? 'strasse' AND r.impressum ? 'plz'
         AND NOT EXISTS (SELECT 1 FROM fiaon_radar_sperre x WHERE x.wert = r.domain OR x.wert = lower(COALESCE(r.email, '')))
       ORDER BY COALESCE(r.signal_staerke, 0) DESC, r.passung DESC NULLS LAST, r.created_at DESC
       LIMIT 1`) as any[];
    if (!kandidat) { erg.grund = "keine passende Firma für einen Brief im Vorrat"; break; }
    const id = Number(kandidat.id);
    await sqlPool`UPDATE fiaon_radar_firmen SET brief_auto_am = NOW() WHERE id = ${id}`;
    try {
      let f = await firmaLaden(id);
      if (f.signal_staerke == null) { await radarScannen(id); f = await firmaLaden(id); }
      if (Number(f.signal_staerke ?? 0) < RADAR_SIGNAL_AB) {
        // E-337: nicht qualifiziert → Archiv (wie im Mail-Versand).
        await sqlPool`UPDATE fiaon_radar_firmen SET archiviert_am = NOW(), archiv_grund = ${`Kapitalsignal ${Number(f.signal_staerke ?? 0)} von 5 (Scan)`} WHERE id = ${id}`;
        erg.uebersprungen++; continue;
      }
      // Erst die (bezahlte) Websuche nach einer persönlichen Adresse — findet sie eine, geht die Mail vor (kostet nichts).
      if (!f.entscheider_am) { await entscheiderFinden(id, { websuche: true }).catch(() => null); f = await firmaLaden(id); }
      if (!radarBriefPruefen(f).ok) { erg.uebersprungen++; continue; }
      const b = f.brief && !f.brief.sperrend?.length ? f.brief : await radarBriefSchreiben(id);
      if (b.sperrend?.length) { erg.uebersprungen++; continue; }
      const r = await radarBriefSenden(id, { automatisch: true });
      if (r.test) erg.test++; else { erg.briefe++; erg.versandt++; }
      erg.heute++; rest--;
    } catch (e: any) {
      erg.uebersprungen++;
      // Vorübergehend (KI-Pause, Tagesdeckel, Kontingent): Die Firma darf in einer späteren Runde wieder drankommen.
      if (e instanceof RadarFehler && (e.status === 429 || e.status === 503)) {
        await sqlPool`UPDATE fiaon_radar_firmen SET brief_auto_am = NULL WHERE id = ${id}`.catch(() => {});
        erg.grund = e.message; break;
      }
      console.error(`[RADAR-BRIEF] Lauf ${id}:`, e?.message || e);
    }
  }
  return erg;
}

// ── FÜR DAS CHEFBÜRO ─────────────────────────────────────────────────────────
export async function radarBriefAkte(id: number): Promise<any> {
  const f = await firmaLaden(id);
  const s = await radarBriefEinstellung();
  // Ohne Brief zeigt die Akte die Anschrift, wie sie gedruckt würde — ohne die Impressumseite neu zu lesen (das tut erst „Schreiben“).
  const empfaenger: RadarBriefEmpfaenger = f.brief?.empfaenger ?? radarBriefAnschrift(f.impressum, { firmenname: f.name, land: f.land, anrede: f.entscheider?.anrede ?? null, entscheider: f.entscheider ?? null });
  return {
    pruefung: radarBriefPruefen(f), empfaenger, brief: f.brief ?? null,
    stand: {
      status: f.brief_status ?? null, am: f.brief_am ?? null, versendetAm: f.brief_versendet_am ?? null, testAm: f.brief_test_am ?? null,
      anbieter: f.brief_anbieter ?? null, anbieterId: f.brief_anbieter_id ?? null, kostenCents: f.brief_kosten_cents ?? null, fehler: f.brief_fehler ?? null,
      besuche: Number(f.brief_besuche ?? 0), besuchAm: f.brief_besuch_am ?? null,
    },
    kosten: radarBriefKosten(s.anbieter, empfaenger.land ?? f.land),
    link: radarBriefLink(id, SEITE()), kennung: radarBriefKennung(id),
  };
}

export async function radarBriefUebersicht(): Promise<any> {
  const s = await radarBriefEinstellung();
  return {
    einstellung: s, heute: await radarBriefHeute(),
    bereit: { pingen: anbieterBereit("pingen"), letterxpress: anbieterBereit("letterxpress") },
    anbieter: RADAR_BRIEF_ANBIETER, hoechstens: RADAR_BRIEF_HOECHSTENS_JE_TAG,
  };
}
