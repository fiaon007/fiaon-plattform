// ═══════════════════════════════════════════════════════════════════════════
// DIE FACHBEREICHE DES GLOBAL-PORTALS — Server (E-341, 12.10.2026)
//
// Strategie & Wachstum · Recht & Verträge · Steuern & Pflichten. Je Bereich:
//   · KI-Sparring mit dem Kontext der Akte (Gesellschaft, Etappe, Paket) und
//     dem Wissen des Bereichs (shared/fiaon-global-fach-*.ts). Jede Antwort
//     läuft durch die Hauswand und die Global-Regeln; trifft sie, schreibt die
//     KI einmal um, sonst kommt ein fester, wahrer Satz. Tageslimit je Bereich.
//   · Vorlagen-Generator (Recht): Felder → PDF (pdf-lib) → Tresor, auf Wunsch
//     gleich zur Unterschrift (derselbe Weg wie jede Unterschrift im Portal).
//   · Bank-Exposé (Strategie): die KI schreibt aus den Angaben des Kunden eine
//     englische Kurzfassung für Banken → PDF → Tresor.
//   · „Einzelfall prüfen lassen": dieselbe Nachricht wie jede Anfrage (Faden,
//     Aufgabe an die zuständige Person), mit dem Bereich vorangestellt.
//
// Vorschau der Leitung: KI und Generator laufen (zum Ansehen), aber nichts
// landet beim Kunden — Chats werden als Vorschau markiert, PDFs nur
// zurückgegeben, nie abgelegt.
// ═══════════════════════════════════════════════════════════════════════════
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { sqlPool } from "./db-pool";
import { openaiFetch, istKiPause } from "./fiaon-ki-pause";
import { wandPruefen } from "@shared/fiaon-wortverbote";
import { globalWortPruefen } from "@shared/fiaon-global-wortregeln";
import { usBundesstaatName, globalDokumentArt } from "@shared/fiaon-global-bereich";
import { FACH_HINWEIS, type FachBereich, type FachKapitel, type FachVorlage, type FachFormular } from "@shared/fiaon-global-fach";
import { lageLesen, dokumentSpeichern, verlaufSchreiben, globalKundenNachricht, type Erg } from "./fiaon-global-bereich";
import { ensureGlobalMandat } from "./fiaon-global-mandat";

const nein = (status: number, error: string) => ({ ok: false as const, status, error });
const absatz = (v: unknown, max: number) => String(v ?? "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
function json<T>(v: unknown, leer: T): T {
  if (v && typeof v === "object") return v as T;
  try { return (JSON.parse(String(v ?? "")) as T) ?? leer; } catch { return leer; }
}

// ── Wissen laden (Inhalte kommen aus eigenen Dateien je Bereich) ─────────────
export interface FachWissen { kapitel: FachKapitel[]; vorlagen: FachVorlage[]; formulare: FachFormular[] }
let wissenCache: FachWissen | null = null;
export async function fachWissen(): Promise<FachWissen> {
  if (wissenCache) return wissenCache;
  const [s, r, st] = await Promise.all([
    import("@shared/fiaon-global-fach-strategie").catch(() => ({} as any)),
    import("@shared/fiaon-global-fach-recht").catch(() => ({} as any)),
    import("@shared/fiaon-global-fach-steuern").catch(() => ({} as any)),
  ]);
  wissenCache = {
    kapitel: [...(s.FACH_STRATEGIE_KAPITEL ?? []), ...(r.FACH_RECHT_KAPITEL ?? []), ...(st.FACH_STEUERN_KAPITEL ?? [])],
    vorlagen: r.FACH_VORLAGEN ?? [],
    formulare: st.FACH_FORMULARE ?? [],
  };
  return wissenCache;
}

// ── Schema ───────────────────────────────────────────────────────────────────
let bereit: Promise<void> | null = null;
function ensureFach(): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      await ensureGlobalMandat();
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_global_fach_chat (
          id BIGSERIAL PRIMARY KEY,
          ref VARCHAR NOT NULL,
          bereich TEXT NOT NULL,
          rolle TEXT NOT NULL CHECK (rolle IN ('kunde', 'ki')),
          text TEXT NOT NULL,
          vorschau BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_global_fach_chat_ref_idx ON fiaon_global_fach_chat (ref, bereich, created_at)`;
    })().catch((e) => { bereit = null; throw e; });
  }
  return bereit;
}

// ── Kontext der Akte ─────────────────────────────────────────────────────────
export interface FachKontext {
  ref: string; sprache: "de" | "en"; status: string; etappe: number; paket: string;
  llcName: string | null; bundesstaat: string | null; bundesstaatName: string | null; gegruendetAm: string | null;
  aktenzeichen: string | null; ein: string | null; registeredAgent: string | null; usAdresse: string | null;
  inhaberName: string | null; inhaberAnschrift: string | null; firma: string | null; land: string | null;
}
async function kontextLesen(ref: string): Promise<FachKontext | null> {
  await ensureFach();
  const l = await lageLesen(ref);
  if (!l) return null;
  const [z] = (await sqlPool`SELECT gesellschaft_plus, ansprechpartner, firma, land FROM fiaon_global_auftraege WHERE ref = ${ref} LIMIT 1`) as any[];
  const plus = json<Record<string, any>>(z?.gesellschaft_plus, {});
  const ap = json<Record<string, any>>(z?.ansprechpartner, {});
  const firma = json<Record<string, any>>(z?.firma, {});
  const g = l.gesellschaft ?? {};
  const anschrift = [firma.strasse, [firma.plz, firma.ort].filter(Boolean).join(" "), firma.land].filter(Boolean).join(", ");
  return {
    ref, sprache: l.sprache, status: l.status, etappe: l.etappe, paket: String(l.akte.paket_key || ""),
    llcName: g.name ?? null, bundesstaat: g.bundesstaat ?? null, bundesstaatName: g.bundesstaat ? (usBundesstaatName(g.bundesstaat) ?? g.bundesstaat) : null,
    gegruendetAm: g.gegruendetAm ?? null, aktenzeichen: plus.aktenzeichen ?? null, ein: plus.ein ?? null,
    registeredAgent: plus.registeredAgent ?? null, usAdresse: plus.usAdresse ?? null,
    inhaberName: [ap.vorname, ap.nachname].filter(Boolean).join(" ").trim() || (ap.name ? String(ap.name) : null),
    inhaberAnschrift: anschrift || null,
    firma: firma.art === "privat" ? null : (firma.name ? String(firma.name) : null),
    land: String(firma.land || l.akte.land || "") || null,
  };
}

/** Die Vorbelegung der Vorlagenfelder — für die Oberfläche. */
export async function fachVorbelegung(ref: string): Promise<Record<string, string>> {
  const k = await kontextLesen(ref);
  if (!k) return {};
  const heute = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "Europe/Berlin" });
  const gegr = k.gegruendetAm ? new Date(`${k.gegruendetAm}T12:00:00`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "";
  return {
    llcName: k.llcName ?? "", bundesstaatName: k.bundesstaatName ?? "", aktenzeichen: k.aktenzeichen ?? "", ein: k.ein ?? "",
    inhaberName: k.inhaberName ?? "", inhaberAnschrift: k.inhaberAnschrift ?? "", usAdresse: k.usAdresse ?? "", registeredAgent: k.registeredAgent ?? "",
    heute, gegruendetAm: gegr,
  };
}

// ── KI-Sparring ──────────────────────────────────────────────────────────────
const LIMIT_JE_TAG = 25;
const BEREICH_NAME: Record<FachBereich, { de: string; en: string }> = {
  strategie: { de: "Strategie & Wachstum", en: "Strategy & growth" },
  recht: { de: "Recht & Verträge", en: "Law & contracts" },
  steuern: { de: "Steuern & Pflichten", en: "Tax & compliance" },
};
const ROLLE: Record<FachBereich, string> = {
  strategie: "Du bist der Strategie-Sparringspartner von FIAON Global für Inhaber einer US-Gesellschaft (meist eine LLC in Florida, Delaware oder Wyoming) aus Deutschland, Österreich oder der Schweiz. Du denkst wie ein erfahrener Unternehmer und Finanzierungsprofi: konkret, ehrlich, mit Zahlen und nächsten Schritten. Themen: Geschäftsmodell, US-Markt, Liquidität, Preise, Bankbeziehung, geschäftliche Kreditwürdigkeit, Kartenleiter, Kreditrahmen, Wachstum.",
  recht: "Du erklärst für FIAON Global allgemein und verständlich rechtliche Fragen rund um eine US-Gesellschaft (meist eine LLC in Florida, Delaware oder Wyoming — bei Florida Chapter 605 Florida Statutes, bei Delaware Title 6 Chapter 18 Delaware Code, bei Wyoming Title 17 Chapter 29 Wyoming Statutes): Operating Agreement, Registered Agent, Beschlüsse, Verträge, Vertretung, Annual Report, Marken, Datenschutz beim Verkauf in die EU. Du gibst ALLGEMEINE INFORMATIONEN, keine Rechtsdienstleistung im Einzelfall.",
  steuern: "Du erklärst für FIAON Global allgemein und verständlich steuerliche Pflichten einer US-Gesellschaft mit Inhaber in Deutschland, Österreich oder der Schweiz: disregarded entity, Form 5472 mit pro forma 1120, Form 7004, EIN/SS-4, ITIN/W-7, W-8BEN/W-8BEN-E/W-9, 1099-NEC, Florida Annual Report und Sales Tax, BOI (US-Gesellschaften seit März 2025 befreit), Heimatland-Themen (Typenvergleich, DBA, Anzeigepflicht § 138 AO). Du gibst ALLGEMEINE INFORMATIONEN, keine Steuerberatung im Einzelfall.",
};
const REGELN = `
REGELN (zwingend):
- Schreibe in der Sie-Form, ruhig, präzise, freundlich. Keine Floskeln. Kurze Absätze, wo hilfreich Aufzählungen mit „–“.
- Verwende NIE diese Wörter: garantieren/Garantie, versprechen/zusichern, beraten/Beratung/Berater, empfehlen/Empfehlung/empfohlen, „bis zu“, „Steuern sparen“/„Steuervorteil“/„Steuerersparnis“, „ohne Sicherheiten“, „0 %“, „Unternehmensberatung“. Statt „ich empfehle“: „ein möglicher Weg ist …“, „üblich ist …“, „Sie können …“.
- Nenne KEINE Banken oder Kartenherausgeber beim Namen. Nenne keine Frist mit Ziffern wie „innerhalb von 30 Tagen“ — nenne Daten („bis 15. April“) oder Worte.
- Versprich kein Ergebnis: Über Konto, Karte, Rahmen und Darlehen entscheidet das Institut; über Steuern das Finanzamt/der IRS.
- Wenn die Frage den Einzelfall verlangt (konkrete Vertragsprüfung, „soll ich …“, Steuerberechnung, Haftung im konkreten Streit): erkläre die allgemeinen Grundlagen und schreibe dann, dass der Kunde den Knopf „Einzelfall prüfen lassen“ nutzen kann.
- Erfinde nichts. Wenn du dir bei einer Zahl, Gebühr oder Frist nicht sicher bist, sage das und verweise auf die amtliche Quelle (irs.gov, sunbiz.org, corp.delaware.gov, wyobiz.wyo.gov, fincen.gov).
- Höchstens etwa 250 Wörter, außer der Kunde bittet ausdrücklich um mehr.`;

function passendeKapitel(alle: FachKapitel[], bereich: FachBereich, frage: string): FachKapitel[] {
  const woerter = frage.toLowerCase().split(/[^a-zäöüß0-9-]+/).filter((w) => w.length > 3);
  const eigene = alle.filter((k) => k.bereich === bereich);
  return eigene
    .map((k) => {
      const text = `${k.titel} ${k.kurz} ${k.abschnitte.map((a) => `${a.titel ?? ""} ${a.absaetze.join(" ")}`).join(" ")}`.toLowerCase();
      return { k, n: woerter.reduce((s, w) => s + (text.includes(w) ? 1 : 0), 0) };
    })
    .sort((a, b) => b.n - a.n)
    .slice(0, 3)
    .filter((x) => x.n > 0)
    .map((x) => x.k);
}
function kapitelText(k: FachKapitel): string {
  return `### ${k.titel}\n${k.abschnitte.map((a) => `${a.titel ? `${a.titel}: ` : ""}${a.absaetze.join(" ")}${a.liste?.length ? ` (${a.liste.join("; ")})` : ""}`).join("\n")}`.slice(0, 5000);
}
function kontextText(k: FachKontext): string {
  return [
    `Auftrag ${k.ref}, Paket ${k.paket}, Stand: ${k.status}, Etappe ${k.etappe} von 5.`,
    `Gesellschaft: ${k.llcName ?? "noch ohne Namen"}${k.bundesstaatName ? `, ${k.bundesstaatName}` : ""}${k.gegruendetAm ? `, eingetragen am ${k.gegruendetAm}` : ", noch nicht eingetragen"}.`,
    `EIN: ${k.ein ? "vorhanden" : "noch nicht"}. Registered Agent: ${k.registeredAgent ? "bestellt" : "offen"}.`,
    `Inhaber wohnt in: ${k.land ?? "unbekannt"}.`,
  ].join(" ");
}
function treffer(text: string): string[] {
  const a = wandPruefen(text).filter((f) => f.art === "verboten").map((f) => f.treffer);
  const b = globalWortPruefen(text).filter((f) => f.quelle === "global").map((f) => f.treffer);
  return [...a, ...b];
}
async function kiAntwort(nachrichten: { role: "system" | "user" | "assistant"; content: string }[]): Promise<string> {
  const r = await openaiFetch("global-berater", "/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY || ""}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.GLOBAL_BERATER_MODELL || "gpt-4.1", temperature: 0.4, max_tokens: 1100, messages: nachrichten }),
  });
  const j: any = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`KI ${r.status}: ${j?.error?.message ?? ""}`);
  return String(j?.choices?.[0]?.message?.content || "").trim();
}

/** Chefbüro: alle Gespräche eines Mandats über die drei Bereiche (mit Vorschau-Marke). */
export async function fachChatsFuerChef(ref: string): Promise<{ bereich: string; rolle: string; text: string; am: string; vorschau: boolean }[]> {
  await ensureFach();
  const z = (await sqlPool`
    SELECT bereich, rolle, text, vorschau, created_at FROM fiaon_global_fach_chat
     WHERE ref = ${ref} ORDER BY created_at DESC, id DESC LIMIT 300`) as any[];
  return z.reverse().map((x) => ({ bereich: String(x.bereich), rolle: String(x.rolle), text: String(x.text), am: new Date(x.created_at).toISOString(), vorschau: !!x.vorschau }));
}

export async function fachChatVerlauf(ref: string, bereich: FachBereich, vorschau: boolean): Promise<{ rolle: string; text: string; am: string }[]> {
  await ensureFach();
  const z = (await sqlPool`
    SELECT rolle, text, created_at FROM fiaon_global_fach_chat
     WHERE ref = ${ref} AND bereich = ${bereich} AND (vorschau = FALSE OR ${vorschau})
     ORDER BY created_at ASC, id ASC LIMIT 200`) as any[];
  return z.map((x) => ({ rolle: String(x.rolle), text: String(x.text), am: new Date(x.created_at).toISOString() }));
}

export async function fachChat(ref: string, bereichRoh: unknown, frageRoh: unknown, vorschau: boolean): Promise<Erg<{ antwort: string; hinweis: string }>> {
  const bereich = (["strategie", "recht", "steuern"] as const).find((b) => b === bereichRoh);
  if (!bereich) return nein(400, "Unbekannter Bereich.");
  const k = await kontextLesen(ref);
  if (!k) return nein(404, "Wir finden zu diesem Link keinen Auftrag.");
  if (k.status === "storniert") return nein(409, "Dieser Auftrag ist storniert.");
  const frage = absatz(frageRoh, 1500);
  if (frage.length < 3) return nein(400, "Bitte stellen Sie Ihre Frage in einem Satz.");
  const [anz] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_global_fach_chat
     WHERE ref = ${ref} AND bereich = ${bereich} AND rolle = 'kunde' AND created_at > NOW() - INTERVAL '24 hours'`) as any[];
  if (Number(anz?.n || 0) >= LIMIT_JE_TAG) return nein(429, "Für heute haben Sie hier viele Fragen gestellt — ab morgen geht es weiter. Für Dringendes nutzen Sie „Einzelfall prüfen lassen“.");
  const vorher = (await fachChatVerlauf(ref, bereich, vorschau)).slice(-10);
  const wissen = await fachWissen();
  const kapitel = passendeKapitel(wissen.kapitel, bereich, frage);
  const system = [
    ROLLE[bereich], REGELN,
    `\nKONTEXT DES KUNDEN (nur zur Orientierung, nicht wörtlich wiederholen): ${kontextText(k)}`,
    kapitel.length ? `\nWISSEN AUS DER BIBLIOTHEK VON FIAON (darauf stützen):\n${kapitel.map(kapitelText).join("\n\n")}` : "",
    k.sprache === "en" ? "\nLANGUAGE: Answer in British English (formal). The same word rules apply: never guarantee, advise or recommend; no bank names; no 'up to'." : "",
  ].join("\n");
  const verlauf = vorher.map((v) => ({ role: (v.rolle === "ki" ? "assistant" : "user") as "assistant" | "user", content: v.text }));
  let antwort = "";
  try {
    antwort = await kiAntwort([{ role: "system", content: system }, ...verlauf, { role: "user", content: frage }]);
    let t = treffer(antwort);
    if (t.length) {
      antwort = await kiAntwort([
        { role: "system", content: system },
        { role: "user", content: frage },
        { role: "assistant", content: antwort },
        { role: "user", content: `Formuliere deine Antwort vollständig neu, inhaltlich gleich, aber OHNE diese Wörter/Wendungen: ${t.map((x) => `„${x}“`).join(", ")}. Halte alle Regeln ein.` },
      ]);
      t = treffer(antwort);
    }
    if (t.length || !antwort) {
      antwort = k.sprache === "en"
        ? "This question is best answered in person. Please use “Have your case reviewed” — your contact will come back to you with the next step."
        : "Diese Frage beantworten wir lieber persönlich. Nutzen Sie „Einzelfall prüfen lassen“ — Ihr Ansprechpartner meldet sich mit dem nächsten Schritt.";
    }
  } catch (e) {
    if (istKiPause(e)) return nein(503, "Der Assistent ist gerade nicht erreichbar. Nutzen Sie „Einzelfall prüfen lassen“ — Ihre Frage kommt so direkt zu uns.");
    console.error(`[GLOBAL-FACH] ${ref}/${bereich}:`, e);
    return nein(502, "Der Assistent ist gerade nicht erreichbar — bitte versuchen Sie es gleich noch einmal.");
  }
  await sqlPool`INSERT INTO fiaon_global_fach_chat (ref, bereich, rolle, text, vorschau) VALUES (${ref}, ${bereich}, 'kunde', ${frage}, ${vorschau}), (${ref}, ${bereich}, 'ki', ${antwort}, ${vorschau})`;
  return { ok: true, antwort, hinweis: FACH_HINWEIS[bereich] };
}

// ── PDF-Satz (Vorlagen, Exposé) ──────────────────────────────────────────────
function sicher(font: PDFFont, s: string): string {
  try { font.encodeText(s); return s; } catch {
    const ohne = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
    return Array.from(ohne).map((c) => { try { font.encodeText(c); return c; } catch { return "?"; } }).join("");
  }
}
function zeilenUmbruch(font: PDFFont, text: string, groesse: number, breite: number): string[] {
  const zeilen: string[] = [];
  for (const absatzTeil of text.split("\n")) {
    const woerter = absatzTeil.split(/\s+/).filter(Boolean);
    let z = "";
    for (const w of woerter) {
      const probe = z ? `${z} ${w}` : w;
      if (font.widthOfTextAtSize(sicher(font, probe), groesse) <= breite) z = probe;
      else { if (z) zeilen.push(z); z = w; }
    }
    zeilen.push(z);
  }
  return zeilen;
}
interface PdfBlock { art: "titel" | "unter" | "kopf" | "text"; text: string }
async function pdfSetzen(o: { dokumentTitel: string; untertitel?: string; bloecke: PdfBlock[]; unterschriften: string[]; fuss: string }): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const normal = await pdf.embedFont(StandardFonts.TimesRoman);
  const fett = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const klein = await pdf.embedFont(StandardFonts.Helvetica);
  const navy = rgb(0.07, 0.157, 0.29); const tinte = rgb(0.1, 0.12, 0.16); const leise = rgb(0.42, 0.46, 0.53);
  const B = 595.28, H = 841.89, R = 68, BREITE = B - 2 * R;
  let seite: PDFPage = pdf.addPage([B, H]); let y = H - 72;
  const neueSeite = () => { seite = pdf.addPage([B, H]); y = H - 72; };
  const platz = (h: number) => { if (y - h < 72) neueSeite(); };
  const zeile = (t: string, f: PDFFont, g: number, farbe = tinte, x = R) => { seite.drawText(sicher(f, t), { x, y, size: g, font: f, color: farbe }); };
  seite.drawText("FIAON Global", { x: R, y: H - 44, size: 8.5, font: klein, color: navy });
  for (const b of [{ art: "titel" as const, text: o.dokumentTitel }, ...(o.untertitel ? [{ art: "unter" as const, text: o.untertitel }] : []), ...o.bloecke]) {
    if (b.art === "titel") {
      for (const z of zeilenUmbruch(fett, b.text, 18, BREITE)) { platz(26); const w = fett.widthOfTextAtSize(sicher(fett, z), 18); zeile(z, fett, 18, navy, (B - w) / 2); y -= 24; }
      y -= 6;
    } else if (b.art === "unter") {
      for (const z of zeilenUmbruch(normal, b.text, 10.5, BREITE)) { platz(16); const w = normal.widthOfTextAtSize(sicher(normal, z), 10.5); zeile(z, normal, 10.5, leise, (B - w) / 2); y -= 14; }
      y -= 14;
    } else if (b.art === "kopf") {
      platz(34); y -= 8;
      for (const z of zeilenUmbruch(fett, b.text, 11.5, BREITE)) { platz(16); zeile(z, fett, 11.5, navy); y -= 15; }
      y -= 2;
    } else {
      for (const z of zeilenUmbruch(normal, b.text, 10.5, BREITE)) { platz(15); zeile(z, normal, 10.5); y -= 14.2; }
      y -= 7;
    }
  }
  if (o.unterschriften.length) {
    platz(40); y -= 18;
    for (const rolle of o.unterschriften) {
      platz(78);
      y -= 36;
      seite.drawLine({ start: { x: R, y }, end: { x: R + 240, y }, thickness: 0.7, color: leise });
      seite.drawLine({ start: { x: R + 290, y }, end: { x: R + 420, y }, thickness: 0.7, color: leise });
      y -= 13;
      zeile(rolle, normal, 9.5, leise); zeile("Date", normal, 9.5, leise, R + 290);
      y -= 16;
    }
  }
  // Fuß in zwei sauberen Zeilen: links Dokument, rechts Seite; darunter der Vorlagen-Hinweis.
  const seiten = pdf.getPages();
  const [fussOben, fussUnten] = o.fuss.split(" | ");
  seiten.forEach((p, i) => {
    const seitenText = `${i + 1} / ${seiten.length}`;
    const breiteSeite = klein.widthOfTextAtSize(seitenText, 7);
    p.drawLine({ start: { x: R, y: 50 }, end: { x: B - R, y: 50 }, thickness: 0.4, color: rgb(0.89, 0.91, 0.93) });
    p.drawText(sicher(klein, fussOben).slice(0, 120), { x: R, y: 38, size: 7, font: klein, color: leise });
    p.drawText(seitenText, { x: B - R - breiteSeite, y: 38, size: 7, font: klein, color: leise });
    if (fussUnten) p.drawText(sicher(klein, fussUnten).slice(0, 140), { x: R, y: 28, size: 6.5, font: klein, color: leise });
  });
  return Buffer.from(await pdf.save());
}

// ── Vorlagen-Generator ───────────────────────────────────────────────────────
export async function fachVorlageErstellen(ref: string, ein: { vorlage: unknown; werte: unknown; unterschrift?: unknown }, vorschau: boolean):
  Promise<Erg<{ meldung: string; id?: number; pdf?: Buffer; dateiname: string }>> {
  const k = await kontextLesen(ref);
  if (!k) return nein(404, "Wir finden zu diesem Link keinen Auftrag.");
  if (k.status === "storniert") return nein(409, "Dieser Auftrag ist storniert.");
  const { vorlagen } = await fachWissen();
  const v = vorlagen.find((x) => x.id === ein.vorlage);
  if (!v) return nein(404, "Diese Vorlage gibt es nicht.");
  const roh = (ein.werte && typeof ein.werte === "object" ? ein.werte : {}) as Record<string, unknown>;
  const werte: Record<string, string> = {};
  for (const f of v.felder) {
    const w = absatz(roh[f.key], f.typ === "langtext" ? 4000 : 400);
    if (f.pflicht && !w) return nein(400, `Bitte füllen Sie „${f.label}“ aus.`);
    werte[f.key] = w;
  }
  const fuell = (t: string) => t.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_m, key: string) => werte[key] || "________________");
  const bloecke: PdfBlock[] = v.text.map((t) => (t.startsWith("## ") ? { art: "kopf", text: fuell(t.slice(3)) } : { art: "text", text: fuell(t) }));
  const llc = k.llcName || werte.llcName || "";
  const pdf = await pdfSetzen({
    dokumentTitel: fuell(v.dokumentTitel), untertitel: llc || undefined, bloecke, unterschriften: v.unterschriften,
    fuss: `${v.dokumentTitel}${llc ? ` · ${llc}` : ""} | Template prepared with FIAON Global — please review before signing.`,
  });
  const dateiname = `${v.dokumentTitel.replace(/[^A-Za-z0-9 _-]+/g, "").trim().replace(/\s+/g, "_").slice(0, 60) || "Vorlage"}.pdf`;
  if (vorschau) return { ok: true, meldung: "Vorschau — nichts wurde abgelegt.", pdf, dateiname };
  const art = globalDokumentArt(v.art) ? v.art : "sonstiges";
  const d = await dokumentSpeichern({ ref, von: "kunde", art, dateiname, mime: "application/pdf", inhalt: pdf, sichtbar: true, agentId: null });
  await sqlPool`UPDATE fiaon_global_dokumente SET titel = ${v.titel}, unterschrift_gefordert = ${ein.unterschrift === true}, fiaon_gesehen_am = NULL WHERE id = ${d.id}`;
  await verlaufSchreiben(ref, { art: "vorlage", text: k.sprache === "en" ? `You created a document from a template: ${v.titel}.` : `Sie haben ein Dokument aus einer Vorlage erstellt: ${v.titel}.`, sichtbar: true, von: "kunde" });
  return { ok: true, id: d.id, dateiname, meldung: ein.unterschrift === true ? "Erstellt — es liegt in Ihrem Tresor und wartet auf Ihre Unterschrift." : "Erstellt — es liegt in Ihrem Tresor." };
}

// ── Bank-Exposé (Strategie) ──────────────────────────────────────────────────
export async function fachExpose(ref: string, eingabe: Record<string, unknown>, vorschau: boolean): Promise<Erg<{ meldung: string; id?: number; pdf?: Buffer; dateiname: string }>> {
  const k = await kontextLesen(ref);
  if (!k) return nein(404, "Wir finden zu diesem Link keinen Auftrag.");
  if (k.status === "storniert") return nein(409, "Dieser Auftrag ist storniert.");
  const felder = ["geschaeft", "kunden", "umsatz", "kosten", "kapital", "verwendung", "team", "besonderheit"];
  const angaben = felder.map((f) => `${f}: ${absatz(eingabe[f], 1200)}`).join("\n");
  if (absatz(eingabe.geschaeft, 1200).length < 20) return nein(400, "Bitte beschreiben Sie Ihr Geschäft in ein paar Sätzen.");
  const [anz] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_global_fach_chat WHERE ref = ${ref} AND bereich = 'expose' AND created_at > NOW() - INTERVAL '24 hours'`) as any[];
  if (Number(anz?.n || 0) >= 5) return nein(429, "Heute wurden schon mehrere Exposés erstellt — ab morgen geht es weiter.");
  let text = "";
  try {
    text = await kiAntwort([
      { role: "system", content: `You write a one-page EXECUTIVE SUMMARY in English for a US bank or card issuer about a small US company owned by a European entrepreneur. Sober, factual, professional banking tone. Structure with these headings, each on its own line starting with "## ": Company Overview, Products and Services, Market and Customers, Financial Snapshot, Use of Funds, Management, Why This Business Is Creditworthy. Use ONLY the facts given; never invent numbers; where a fact is missing, leave that point out. No guarantees, no promises, no bank names, no "up to". Max 550 words. Company: ${k.llcName ?? "the company"}${k.bundesstaatName ? `, a ${k.bundesstaatName} limited liability company` : ""}${k.gegruendetAm ? `, formed ${k.gegruendetAm}` : ""}. Owner: ${k.inhaberName ?? "the owner"}.` },
      { role: "user", content: `Facts from the owner (German or English):\n${angaben}` },
    ]);
  } catch (e) {
    if (istKiPause(e)) return nein(503, "Der Assistent ist gerade nicht erreichbar — bitte später noch einmal.");
    console.error(`[GLOBAL-FACH] Exposé ${ref}:`, e);
    return nein(502, "Das Exposé ließ sich gerade nicht erstellen — bitte gleich noch einmal.");
  }
  const bloecke: PdfBlock[] = text.split(/\n+/).map((t) => t.trim()).filter(Boolean)
    .map((t) => (t.startsWith("## ") ? { art: "kopf" as const, text: t.slice(3) } : { art: "text" as const, text: t.replace(/^[-*]\s+/, "• ").replace(/\*\*/g, "") }));
  const pdf = await pdfSetzen({ dokumentTitel: "Executive Summary", untertitel: k.llcName ?? undefined, bloecke, unterschriften: [], fuss: `Executive Summary${k.llcName ? ` · ${k.llcName}` : ""} | Prepared with FIAON Global from the owner's information.` });
  await sqlPool`INSERT INTO fiaon_global_fach_chat (ref, bereich, rolle, text, vorschau) VALUES (${ref}, 'expose', 'ki', ${text}, ${vorschau})`;
  const dateiname = `Executive_Summary${k.llcName ? `_${k.llcName.replace(/[^A-Za-z0-9]+/g, "_")}` : ""}.pdf`;
  if (vorschau) return { ok: true, meldung: "Vorschau — nichts wurde abgelegt.", pdf, dateiname };
  const d = await dokumentSpeichern({ ref, von: "kunde", art: "bank_unterlage", dateiname, mime: "application/pdf", inhalt: pdf, sichtbar: true, agentId: null });
  await sqlPool`UPDATE fiaon_global_dokumente SET titel = ${"Executive Summary (Bank-Exposé)"}, fiaon_gesehen_am = NULL WHERE id = ${d.id}`;
  await verlaufSchreiben(ref, { art: "vorlage", text: "Sie haben ein Bank-Exposé (Executive Summary) erstellt.", sichtbar: true, von: "kunde" });
  return { ok: true, id: d.id, dateiname, meldung: "Erstellt — Ihr Exposé liegt im Tresor (Mappe „Bank und Konto“)." };
}

// ── Einzelfall prüfen lassen ─────────────────────────────────────────────────
export async function fachEinzelfall(ref: string, bereichRoh: unknown, textRoh: unknown): Promise<Erg<{ meldung: string }>> {
  const bereich = (["strategie", "recht", "steuern"] as const).find((b) => b === bereichRoh);
  if (!bereich) return nein(400, "Unbekannter Bereich.");
  const text = absatz(textRoh, 1800);
  if (text.length < 10) return nein(400, "Bitte beschreiben Sie Ihr Anliegen in ein paar Sätzen.");
  const erg = await globalKundenNachricht(ref, { text: `Einzelfall prüfen lassen — ${BEREICH_NAME[bereich].de}:\n${text}` });
  if (!erg.ok) return erg;
  return { ok: true, meldung: erg.meldung };
}
