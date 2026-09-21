// ═══════════════════════════════════════════════════════════════════════════
// PERSÖNLICHE NACHRICHT — die KI schreibt, Justin schickt (21.09.2026, E-205)
//
// Justin: „so was wie ein Freitext, nur besser benannt: Wenn er draufklickt,
// öffnet sich ein Fenster mit der Frage ‚Was möchten Sie dem Kunden schreiben?',
// und dann tippt man z. B. ein ‚Wie besprochen zum Angucken unserer Website,
// überlegen Sie es sich und melden sich gern erneut bei mir' — und dann schreibt
// die KI daraus eine 100 % personalisierte und 100 % menschlich klingende
// WhatsApp-Nachricht."
//
// ── DIE KI SCHLÄGT VOR, JUSTIN SCHICKT ─────────────────────────────────────
// Dieselbe Bauart wie die Mail-KI (fiaon-mail-ki.ts): Diese Datei kann nicht
// senden. Der Text geht zurück in die Telefonkartei; Justin liest ihn, ändert
// ihn und tippt selbst in WhatsApp auf Senden.
//
// ── DATENSPARSAM ───────────────────────────────────────────────────────────
// Das Modell bekommt Anrede, Vor- und Nachname, den Stand in Worten, Paket und
// Wunschlimit — keine Telefonnummer, keine E-Mail, keine Anschrift, keine
// Bankdaten, keine Links. Links gibt es nur als Platzhalter ([WEBSITE],
// [KALENDER], [ZAHLUNGSSEITE], [RECHNUNG], [ANTRAG]); eingesetzt werden sie
// hier. So erfindet die KI keine Adresse und verstümmelt keinen Link.
//
// ── ZWEI ZÄUNE ─────────────────────────────────────────────────────────────
// 1. Der Auftrag an das Modell verbietet Zusagen, Fristen, Beratung, Druck.
// 2. Die ANTWORT wird geprüft: Emojis und Sternchen raus, Anrede und Gruß
//    gesetzt, Wortwand (shared/fiaon-wortverbote.ts). Trifft die Wand, schreibt
//    das Modell einmal neu, mit dem Grund; bleibt ein Treffer, wird entschärft
//    und Justin sieht den Hinweis vor dem Senden.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import { absoluteUrl } from "../fiaon-base-url";
import { wandPruefen } from "@shared/fiaon-wortverbote";
import {
  anredeWhatsApp, ohneEmojis, euroGanz, limitZiel, KI_WUNSCH_MAX,
  type KarteiKarte, type KarteiKiAntwort,
} from "@shared/fiaon-telefonkartei";

const MODELL = () => process.env.KARTEI_KI_MODELL || process.env.POSTMEISTER_MODELL || "gpt-5.5";
/** Tagesdeckel in Euro — eine Nachricht kostet wenige Cent. */
const TAGESDECKEL_EUR = () => Number(process.env.KARTEI_KI_TAGESDECKEL_EUR || 5);
const ZEIT_MS = 45_000;

const GRUSS = "Viele Grüße\nJustin Schwarzott";

const AUFTRAG = `Du schreibst WhatsApp-Nachrichten im Namen von Justin Schwarzott, Gründer von FIAON, an einen Kunden.
FIAON begleitet Menschen rund um ihre Bonität und den Weg zu Konto und Kreditkarte bei einer Partnerbank.
FIAON ist keine Bank, kein Kreditvermittler und keine Finanzberatung.

SO SCHREIBST DU
- Wie Justin selbst, der gerade in WhatsApp tippt: nahbar, freundlich, positiv, ruhig selbstbewusst. Kurze Sätze.
- Mach aus den Stichpunkten eine runde, persönliche Nachricht — nicht die Stichpunkte abschreiben. Drei bis fünf Sätze Inhalt.
- Persönlich heißt: an diesen einen Menschen. Nimm Bezug auf seine Lage (Stand, Paket, Wunschlimit, letzter Kontakt), wenn es zum Anliegen passt — ohne etwas zuzusagen.
- Ein freundlicher, ermutigender Schluss, der zum nächsten Schritt einlädt (z. B. sich melden, Termin buchen, Zahlung erledigen) — passend zu den Stichpunkten, ohne Druck.
- Sie-Form, Deutsch. Keine Emojis, keine Sternchen, keine Aufzählungszeichen, keine Überschriften.
- Keine Floskeln wie „Ich hoffe, es geht Ihnen gut", „zögern Sie nicht", „für Rückfragen stehe ich zur Verfügung", „Sehr geehrte", „Mit freundlichen Grüßen".
- Beginne GENAU mit der vorgegebenen Anrede-Zeile. Danach eine Leerzeile. Der erste Satz beginnt klein, weil er nach „Hallo …," steht.
- Ende mit einer Leerzeile und genau zwei Zeilen: „Viele Grüße" und „Justin Schwarzott".
- Übernimm den Inhalt von Justins Stichpunkten vollständig und sinngemäß. Erfinde nichts dazu, keine neuen Themen, keine Angebote.
- Links nur als Platzhalter aus der Liste und nur, wenn die Stichpunkte sie verlangen oder sie eindeutig passen (Website → [WEBSITE]). Jeden Platzhalter höchstens einmal, auf einer eigenen Zeile.

ABSOLUT VERBOTEN, auch wenn die Stichpunkte es nahelegen
- Zusagen zu Karte, Limit, Konto, Bewilligung oder Ergebnis: „garantiert", „sicher", „auf jeden Fall", „versprochen", „zugesichert".
- Das Wunschlimit höchstens als Ziel nennen, nie als feststehendes Ergebnis.
- Feste Fristen oder Uhrzeiten, die nicht in den Stichpunkten stehen; Beträge, die nicht angegeben sind.
- „Beratung", „beraten", „Berater", „Empfehlung", „empfehlen".
- Druck oder erfundene Knappheit („nur noch heute", „letzte Chance").
- Ankündigen, dass Justin oder jemand anruft oder zurückruft.

Antworte nur mit der fertigen Nachricht, ohne Vorrede und ohne Anführungszeichen.`;

type Platzhalter = { zeichen: string; wofuer: string; wert: string };

function platzhalterFuer(k: KarteiKarte, antragUrl: string): Platzhalter[] {
  const liste: Platzhalter[] = [{ zeichen: "[WEBSITE]", wofuer: "die FIAON-Website", wert: absoluteUrl("/") }];
  if (k.terminLink) liste.push({ zeichen: "[KALENDER]", wofuer: "Justins Kalender, der Kunde bucht selbst eine Zeit (Daten schon eingetragen)", wert: k.terminLink });
  if (k.zahlung?.zahlungsseite) liste.push({ zeichen: "[ZAHLUNGSSEITE]", wofuer: "die Zahlungsseite, Zahlung mit einem Klick in der Banking-App", wert: k.zahlung.zahlungsseite });
  if (k.zahlung?.rechnungLink) liste.push({ zeichen: "[RECHNUNG]", wofuer: "die Rechnung als PDF", wert: k.zahlung.rechnungLink });
  if (!k.zahlung && (k.lage === "C" || k.lage === "abbrecher")) liste.push({ zeichen: "[ANTRAG]", wofuer: "der Antrag, dauert etwa zwei Minuten", wert: antragUrl });
  return liste;
}

function eingabe(k: KarteiKarte, wunsch: string, platz: Platzhalter[], vorher: string | null, nachbessern: string | null): string {
  const ziel = limitZiel(k);
  const kontakt = k.kontakt.am
    ? `${k.kontakt.von ? `${k.kontakt.von}: ` : ""}${k.kontakt.ergebnis ?? "Kontakt"}`
    : "noch kein dokumentierter Kontakt";
  return [
    `Anrede-Zeile: ${anredeWhatsApp(k)}`,
    `Kunde: ${k.name}${k.vorname ? ` (Vorname ${k.vorname})` : ""}`,
    `Stand bei FIAON: ${k.stand}`,
    k.paket ? `Paket: ${k.paket.label}` : null,
    ziel != null ? `Wunschlimit, nur als Ziel nennen: ${euroGanz(ziel)}` : null,
    `Letzter Kontakt im Verlauf: ${kontakt}`,
    "",
    "Verfügbare Platzhalter:",
    ...platz.map((p) => `${p.zeichen} = ${p.wofuer}`),
    "",
    `Justins Stichpunkte: „${wunsch}"`,
    vorher ? `\nVorige Fassung — schreib dieselbe Aussage anders, natürlicher:\n${vorher}` : null,
    nachbessern ? `\nDie vorige Fassung verstieß gegen die Regeln (${nachbessern}). Schreib sie ohne diese Aussagen neu.` : null,
  ].filter((z) => z !== null).join("\n");
}

/** Anrede vorn, Gruß hinten, Platzhalter ersetzt, Emojis und Sternchen raus. */
export function nachrichtGlaetten(roh: string, k: KarteiKarte, platz: Platzhalter[]): string {
  let t = ohneEmojis(String(roh || "").replace(/^["„“”]+|["„“”]+$/g, "").trim());
  for (const p of platz) t = t.split(p.zeichen).join(p.wert);
  t = t.replace(/\[[A-ZÄÖÜ_]{3,}\]/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const anrede = anredeWhatsApp(k);
  if (!t.startsWith(anrede)) t = `${anrede}\n\n${t.replace(/^(hallo|hi|guten tag|liebe[rs]?)\b[^\n]*\n+/i, "")}`;
  // Den Gruß des Modells durch den einen Gruß ersetzen — nie zwei untereinander.
  t = t.replace(/\n+(viele|beste|liebe|freundliche)\s+grüße[\s\S]*$/i, "").replace(/\n+(mfg|lg|vg)\b[\s\S]*$/i, "").trim();
  return `${t}\n\n${GRUSS}`;
}

/** Harte Treffer der Wand (verboten, Zusage) und Floskeln — getrennt. */
function wand(text: string): { hart: string[]; floskel: string[] } {
  const funde = wandPruefen(text, []);
  return {
    hart: funde.filter((f) => f.art === "verboten" || f.art === "zusage").map((f) => `„${f.treffer}" — ${f.hinweis}`),
    floskel: funde.filter((f) => f.art === "floskel").map((f) => `„${f.treffer}" — ${f.hinweis}`),
  };
}

async function modellFragen(eingabeText: string): Promise<{ ok: true; text: string } | { ok: false; grund: string }> {
  const schluessel = process.env.OPENAI_API_KEY;
  if (!schluessel) return { ok: false, grund: "Für die KI fehlt der Schlüssel OPENAI_API_KEY." };
  const { nutzungMerken, kostenHeute } = await import("./fiaon-postmeister-schema");
  const heute = await kostenHeute("telefonkartei").catch(() => 0);
  if (heute >= TAGESDECKEL_EUR()) return { ok: false, grund: `Der Tagesdeckel für KI-Nachrichten ist erreicht (${TAGESDECKEL_EUR()} €). Morgen geht es weiter.` };

  const modell = MODELL();
  const start = Date.now();
  const abbruch = new AbortController();
  const uhr = setTimeout(() => abbruch.abort(), ZEIT_MS);
  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${schluessel}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modell,
        instructions: AUFTRAG,
        input: eingabeText,
        max_output_tokens: 2_000,
        reasoning: { effort: "low" },
      }),
      signal: abbruch.signal,
    });
    const roh: any = await res.json().catch(() => null);
    const u = roh?.usage ?? {};
    await nutzungMerken({
      dienst: "telefonkartei", modell, dauerMs: Date.now() - start, ok: res.ok,
      usage: { prompt_tokens: u.input_tokens, completion_tokens: u.output_tokens, completion_tokens_details: { reasoning_tokens: u.output_tokens_details?.reasoning_tokens } },
      fehler: res.ok ? null : JSON.stringify(roh?.error ?? "").slice(0, 200),
    });
    if (!res.ok) return { ok: false, grund: `Die KI antwortet gerade nicht (HTTP ${res.status}). Bitte noch einmal versuchen.` };
    let text = "";
    for (const teil of Array.isArray(roh?.output) ? roh.output : []) {
      if (teil?.type !== "message" || !Array.isArray(teil.content)) continue;
      for (const c of teil.content) if (c?.type === "output_text" && typeof c.text === "string") text += c.text;
    }
    text = (text || String(roh?.output_text ?? "")).trim();
    if (!text) return { ok: false, grund: "Die KI hat keinen Text geliefert. Bitte noch einmal versuchen." };
    return { ok: true, text };
  } catch (e: any) {
    await nutzungMerken({ dienst: "telefonkartei", modell, dauerMs: Date.now() - start, ok: false, fehler: String(e?.message || e).slice(0, 200) });
    return { ok: false, grund: e?.name === "AbortError" ? "Die KI hat zu lange gebraucht — bitte noch einmal versuchen." : "Die KI ist gerade nicht erreichbar." };
  } finally {
    clearTimeout(uhr);
  }
}

/**
 * Die Nachricht: aus Justins Stichpunkten, für diesen Menschen. `vorher` ist die
 * zuletzt gezeigte Fassung („Neu formulieren").
 */
export async function kiNachricht(k: KarteiKarte, wunschRoh: string, vorherRoh: string | null, antragUrl: string): Promise<KarteiKiAntwort> {
  const wunsch = String(wunschRoh ?? "").replace(/\s+/g, " ").trim().slice(0, KI_WUNSCH_MAX);
  if (wunsch.length < 3) return { ok: false, meldung: "Schreib in ein paar Worten, worum es gehen soll." };
  const vorher = vorherRoh ? String(vorherRoh).slice(0, 2_000) : null;
  const platz = platzhalterFuer(k, antragUrl);

  let r = await modellFragen(eingabe(k, wunsch, platz, vorher, null));
  if (!r.ok) return { ok: false, meldung: r.grund };
  let text = nachrichtGlaetten(r.text, k, platz);
  let pruef = wand(text);
  if (pruef.hart.length || pruef.floskel.length) {
    // Einmal nachbessern lassen — mit dem Grund. Floskeln zählen mit: Sie sind
    // genau das, woran man den Automaten erkennt.
    const zweiter = await modellFragen(eingabe(k, wunsch, platz, text, [...pruef.hart, ...pruef.floskel].join("; ")));
    if (zweiter.ok) {
      const neu = nachrichtGlaetten(zweiter.text, k, platz);
      const neuPruef = wand(neu);
      if (neuPruef.hart.length <= pruef.hart.length) { text = neu; pruef = neuPruef; }
    }
  }
  const hinweise: string[] = [];
  if (pruef.hart.length) {
    // Bleibt ein harter Treffer, entschärft der Zaun der Mail-KI die Wörter —
    // und Justin sieht, was geändert wurde.
    const { entschaerfen } = await import("./fiaon-mail-ki");
    const e = entschaerfen(text);
    text = e.text;
    hinweise.push(...wand(text).hart.map((h) => `Bitte prüfen: ${h}`));
    if (e.entfernt.length) hinweise.push(`Entschärft: ${e.entfernt.join(", ")}`);
  }
  hinweise.push(...pruef.floskel.map((f) => `Floskel: ${f}`));
  return { ok: true, text, hinweise };
}

/**
 * Hält fest, dass Justin eine persönliche Nachricht in WhatsApp geöffnet hat —
 * im Verlauf der Bestellung oder des Leads, mit seinem Namen und ohne
 * Mitarbeiter-ID (er wird nie Betreuer). Ob er in WhatsApp wirklich auf Senden
 * tippt, sieht der Server nicht; der Eintrag sagt deshalb „geöffnet".
 */
export async function nachrichtVermerken(k: KarteiKarte, text: string, akteur: string): Promise<boolean> {
  const inhalt = ohneEmojis(String(text || "")).slice(0, 1_800);
  if (inhalt.length < 3) return false;
  const notiz = `WhatsApp von ${akteur} geöffnet (persönliche Nachricht):\n${inhalt}`;
  if (k.ref) {
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
      VALUES (${k.ref}, ${k.personId}, NULL, ${akteur}, 'system', ${notiz})`;
    return true;
  }
  if (k.leadId) {
    const { logLead } = await import("../routes/fiaon-leads");
    await logLead(k.leadId, { id: null, name: akteur }, "note", { note: notiz });
    return true;
  }
  return false;
}
