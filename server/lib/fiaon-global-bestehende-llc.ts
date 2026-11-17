// ═══════════════════════════════════════════════════════════════════════════
// BESTEHENDE US-GESELLSCHAFT: LÖSCHEN ODER ÜBERTRAGEN — DER SERVER (17.11.2026)
//
// Die Seite /business/angebot/<Link>/bestehende-gesellschaft (client/src/pages/business-bestehende-llc.tsx) fragt, was
// mit der bisherigen US-Gesellschaft des Kunden geschehen soll. Sätze, Prüfung und Wortlaut: shared/fiaon-global-bestehende-llc.ts.
//
// Zutritt: der persönliche Angebotslink (Signatur geprüft), das Angebot ist ANGENOMMEN und hat einen Auftrag. Ein abgelaufener
// Link gilt hier weiter, solange er echt ist — nach der Annahme ist das der Weg des Kunden zu seinen Schritten. Die Leitung
// sieht die Seite als Vorschau, absenden kann nur der Kunde.
//
// Beim Absenden (in dieser Reihenfolge, jeder Schritt für sich abgesichert):
//   1. die Weisung als Dokument (Art „weisung“, Mappe „Vollmachten“) in die Akte — sichtbar für den Kunden,
//   2. je eine Zeile im Verlauf der Akte und des Angebots (das Angebot trägt die Eingabe, damit die Seite sie wieder zeigt),
//   3. eine Aufgabe an die Zuständigkeit der Akte (Schlüssel global:<Auftrag>:bestehende-llc — eine je Auftrag),
//   4. die Kopie an den Kunden (dauerhafter Datenträger — Textform) und die Meldung an Justin.
// ═══════════════════════════════════════════════════════════════════════════
import { angebotTokenPruefen, angebotLesen, angebotStatusAus, verlaufAngebot, type AngebotZeile } from "./fiaon-global-angebot";
import { absoluteUrl } from "../fiaon-base-url";
import { globalChefMandatPfad } from "@shared/fiaon-global-wege";
import {
  bestehendeLlcPruefen, bestehendeLlcWeisungText, bestehendeLlcKurz, BESTEHENDE_LLC_LOESCHUNG_USD, BESTEHENDE_LLC_STAATEN,
  type BestehendeLlcEingabe,
} from "@shared/fiaon-global-bestehende-llc";

type Antwort = { status: number; body: Record<string, unknown> };
const nein = (status: number, error: string, extra: Record<string, unknown> = {}): Antwort => ({ status, body: { ok: false, error, ...extra } });
export interface BestehendeLlcKontext { ip: string; leitung: boolean }

// Bremse je IP und je Auftrag (im Speicher — ein Neustart setzt sie zurück, das genügt gegen Ausprobieren).
const spuren = new Map<string, number[]>();
function gebremst(schluessel: string, max: number, fensterMs: number): boolean {
  const jetzt = Date.now();
  const liste = (spuren.get(schluessel) ?? []).filter((t) => jetzt - t < fensterMs);
  liste.push(jetzt);
  spuren.set(schluessel, liste);
  return liste.length > max;
}

function json<T>(v: unknown, ersatz: T): T {
  if (v == null) return ersatz;
  if (typeof v === "string") { try { return JSON.parse(v) as T; } catch { return ersatz; } }
  return v as T;
}
interface Kunde { anrede: string; vorname: string; nachname: string; voll: string; email: string }
function kundeAus(z: AngebotZeile): Kunde {
  const k = json<Record<string, any>>(z.kunde, {});
  const vorname = String(k.vorname ?? "").trim(), nachname = String(k.nachname ?? "").trim();
  return { anrede: String(k.anrede ?? "").trim(), vorname, nachname, voll: `${vorname} ${nachname}`.trim(), email: String(k.email ?? "").trim() };
}
const anredeZeile = (k: Kunde): string => (k.anrede === "Frau" ? `Sehr geehrte Frau ${k.nachname}` : k.anrede === "Herr" ? `Sehr geehrter Herr ${k.nachname}` : `Guten Tag ${k.voll}`);

/** Die zuletzt erteilte Weisung steht im Verlauf des Angebots (art „bestehende_llc“). */
function letzteWeisung(z: AngebotZeile): { am: string; kurz: string; eingabe: BestehendeLlcEingabe; text: string } | null {
  const v = json<any[]>(z.verlauf, []);
  for (let i = v.length - 1; i >= 0; i--) {
    const e = v[i];
    if (e?.art === "bestehende_llc" && e.eingabe) return { am: String(e.am), kurz: bestehendeLlcKurz(e.eingabe), eingabe: e.eingabe, text: String(e.text ?? "") };
  }
  return null;
}

async function zeileFuer(token: string): Promise<{ z: AngebotZeile } | { fehler: Antwort }> {
  const t = angebotTokenPruefen(token);
  if (!t) return { fehler: nein(403, "Dieser Link ist ungültig. Bitte öffnen Sie den Link aus unserer Nachricht.") };
  const z = await angebotLesen({ ref: t.ref });
  if (!z) return { fehler: nein(404, "Zu diesem Link finden wir kein Angebot.") };
  if (angebotStatusAus(z) !== "angenommen") {
    return { fehler: t.urteil === "abgelaufen"
      ? nein(410, "Dieser Link ist abgelaufen. Schreiben Sie uns bitte an support@fiaon.com.")
      : nein(409, "Diese Seite öffnet sich, sobald Sie Ihr Angebot angenommen haben.", { code: "NICHT_ANGENOMMEN" }) };
  }
  if (!z.auftrag_ref) return { fehler: nein(409, "Ihr Auftrag wird gerade angelegt — bitte versuchen Sie es in einer Minute noch einmal.") };
  return { z };
}

const berlinZeit = (d = new Date()): string =>
  new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d).replace(",", ",") + " Uhr";
const berlinTag = (d = new Date()): string => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
};

/** GET …/bestehende-gesellschaft — was die Seite zum Start braucht. */
export async function bestehendeLlcSicht(token: string, kontext: BestehendeLlcKontext): Promise<Antwort> {
  if (gebremst(`llc-sicht-ip:${kontext.ip}`, 60, 10 * 60_000)) return nein(429, "Zu viele Aufrufe in kurzer Zeit. Bitte warten Sie einen Moment.");
  const l = await zeileFuer(token);
  if ("fehler" in l) return l.fehler;
  const k = kundeAus(l.z);
  const w = letzteWeisung(l.z);
  return {
    status: 200,
    body: {
      ok: true, vorschau: kontext.leitung, anrede: k.anrede, nachname: k.nachname, auftraggeber: k.voll,
      loeschungUsd: BESTEHENDE_LLC_LOESCHUNG_USD, staaten: BESTEHENDE_LLC_STAATEN,
      weisung: w ? { am: w.am, kurz: w.kurz, wahl: w.eingabe.wahl } : null,
    },
  };
}

/** POST …/bestehende-gesellschaft — die Weisung erteilen. */
export async function bestehendeLlcSpeichern(token: string, body: unknown, kontext: BestehendeLlcKontext): Promise<Antwort> {
  const t = angebotTokenPruefen(token);
  if (t && (gebremst(`llc-ip:${kontext.ip}`, 8, 15 * 60_000) || gebremst(`llc-ref:${t.ref}`, 6, 60 * 60_000))) return nein(429, "Zu viele Versuche in kurzer Zeit. Bitte warten Sie einen Moment.");
  const l = await zeileFuer(token);
  if ("fehler" in l) return l.fehler;
  if (kontext.leitung) return nein(403, "Vorschau der Leitung — absenden kann hier nur der Kunde.", { code: "VORSCHAU" });
  const z = l.z;
  const k = kundeAus(z);
  const p = bestehendeLlcPruefen(body, k.voll);
  if (!p.ok) return nein(400, p.fehler, { feld: p.feld });
  const e = p.eingabe;
  const ref = String(z.auftrag_ref);
  const erteiltAm = berlinZeit();
  const text = bestehendeLlcWeisungText(e, { auftraggeber: `${k.anrede ? `${k.anrede} ` : ""}${k.voll}`, auftragRef: ref, erteiltAm });
  const kurz = bestehendeLlcKurz(e);

  // Doppelklick: dieselbe Weisung (gleicher Inhalt) innerhalb von zehn Minuten ist keine zweite.
  const vorher = letzteWeisung(z);
  if (vorher && JSON.stringify(vorher.eingabe) === JSON.stringify(e) && Date.now() - new Date(vorher.am).getTime() < 10 * 60_000) {
    return { status: 200, body: { ok: true, doppelt: true, weisung: { am: vorher.am, kurz: vorher.kurz, wahl: e.wahl } } };
  }

  // 1 + 2: Akte (Dokument, Verlauf) und Angebot (Verlauf mit der Eingabe)
  const B = await import("./fiaon-global-bereich");
  try {
    await B.dokumentSpeichern({
      ref, von: "kunde", art: "weisung", dateiname: `Weisung_bestehende_Gesellschaft_${berlinTag()}.txt`, mime: "text/plain",
      inhalt: Buffer.from(text, "utf8"), sichtbar: true, agentId: null,
    });
    await B.verlaufSchreiben(ref, { art: "dokument", text: `Weisung zur bestehenden Gesellschaft erteilt: ${kurz}.`, sichtbar: true, von: "kunde" });
  } catch (x) { console.error(`[GLOBAL-BESTEHENDE-LLC] ${ref}: Akte:`, x); }
  const am = new Date().toISOString();
  await verlaufAngebot(Number(z.id), "Kunde (Seite „bestehende Gesellschaft“)", `Weisung erteilt: ${kurz}`, { art: "bestehende_llc", eingabe: e, text, am });

  // 3: die Aufgabe an die Zuständigkeit der Akte
  try {
    const lage = await B.lageLesen(ref);
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    const { globalAufgabenZiel } = await import("./fiaon-global-auftrag");
    await auftragFuerKunden({
      personId: lage?.b?.person_id != null ? Number(lage.b.person_id) : null, ref,
      titel: `FIAON Global: Weisung zur bestehenden Gesellschaft — ${k.voll}`,
      text: `${kurz}.\n\n${text}\n\nBitte vorbereiten (${e.wahl === "loeschen" ? "Auflösung beim Bundesstaat, Unterlagen zum Unterschreiben ins Portal" : "Übertragungsunterlagen für beide Seiten, Kosten vorab nennen"}) — Akte: ${globalChefMandatPfad(ref)}`,
      schluessel: `global:${ref}:bestehende-llc:${berlinTag()}`, bereich: "konten", quelle: "global", autorName: "FIAON Global",
      link: globalChefMandatPfad(ref),
      ...(await globalAufgabenZiel(lage?.akte?.zustaendig_agent_id)),
      anlageText: "Der Kunde hat auf seiner Seite eine Weisung zu seiner bestehenden Gesellschaft erteilt.",
    });
  } catch (x) { console.error(`[GLOBAL-BESTEHENDE-LLC] ${ref}: Aufgabe:`, x); }

  // 4: Kopie an den Kunden (Textform) und Meldung an Justin — Fehler hier erreichen den Kunden nie.
  try {
    const { eigeneMailSenden } = await import("./fiaon-brevo");
    const weiter = e.wahl === "loeschen"
      ? `So geht es weiter: Mit Ihrem Auftrag stellen wir unsere Gebühr von ${BESTEHENDE_LLC_LOESCHUNG_USD} US-Dollar in Rechnung. Wir bereiten die Auflösung Ihrer Gesellschaft vor und legen Ihnen die Unterlagen zum Unterschreiben in Ihren persönlichen Bereich.`
      : "So geht es weiter: Wir nennen Ihnen unsere Gebühr für die Übertragung und stellen sie in Rechnung. Wir bereiten die Übertragungsunterlagen vor; unterschreiben werden Sie und der neue Inhaber anschließend digital.";
    if (k.email) {
      const v = await eigeneMailSenden({
        an: k.email, name: k.voll, betreff: "Ihre Weisung zur bestehenden Gesellschaft — Ihre Kopie",
        text: `${anredeZeile(k)},\n\nvielen Dank — Ihre Weisung ist bei uns angekommen. Für Ihre Unterlagen hier Ihre Kopie:\n\n${text}\n\n${weiter}\n\nMöchten Sie etwas ändern? Antworten Sie einfach auf diese E-Mail.\n\nHerzliche Grüße\nIhr Team von FIAON Global`,
      });
      if (!v.ok) console.warn(`[GLOBAL-BESTEHENDE-LLC] ${ref}: Kopie an den Kunden nicht gesendet (${String(v.grund || "").slice(0, 160)})`);
    }
    const { AUFRUF_MELDUNG_AN } = await import("./fiaon-global-angebot-aufrufe");
    await eigeneMailSenden({
      an: AUFRUF_MELDUNG_AN, name: "Justin", betreff: `Weisung: ${kurz} — ${k.voll}`,
      text: `${k.voll} hat auf seiner Seite eine Weisung zur bestehenden Gesellschaft erteilt. Die Aufgabe liegt bei der Zuständigkeit der Akte; das Dokument liegt im Tresor (Mappe „Vollmachten“).\n\n${text}`,
      knoepfe: [{ text: "Akte im Chefbüro", url: absoluteUrl(globalChefMandatPfad(ref)) }],
    });
  } catch (x) { console.error(`[GLOBAL-BESTEHENDE-LLC] ${ref}: Mails:`, x); }

  return { status: 200, body: { ok: true, weisung: { am, kurz, wahl: e.wahl } } };
}
