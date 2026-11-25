// ═══════════════════════════════════════════════════════════════════════════
// DER LAUF — eine Mail von Anfang bis Ende (02.09.2026, E-094)
//
// Was hier anders ist als in der ersten Fassung:
//   · Der GANZE Gesprächsverlauf geht ins Modell, nicht die Einzelmail. Wer
//     nachlegt („hier der Beleg", „ich habe doch gekündigt"), wird nicht mehr
//     still abgelegt.
//   · JEDE Mail wird nachgetragen: Klartext und Zusammenfassung in der Zeile,
//     ein Vermerk in der Kundenakte, die eigene Antwort in der Mailhistorie.
//   · NICHT-KUNDENPOST (Bestellbestätigungen, Lieferanten, Automaten) wandert
//     in einen eigenen Ordner und wird nie beantwortet — Justins ausdrückliche
//     Vorgabe.
//   · JEDE Antwort wird zuerst ENTWURF. Gesendet wird erst, wenn ein Mensch
//     in der Zentrale freigibt oder der Automat ausdrücklich erlaubt ist.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import {
  nachrichtLesen, nachrichtLabeln, labelSicherstellen, entwurfAnlegen, antwortSenden, nachrichtenSuchen,
  type GmailNachricht,
} from "./fiaon-gmail";
import { einordnenMitMerker, antwortErzeugen, maraMailVermerk, antwortSprache, type Vorgeschichte } from "./fiaon-postmeister-agent";
// E-401 (19.10.2026): eine Mail — eine Einordnung, ein Aktenvermerk.
import { einordnungMerken, akteVermerkEinmal } from "./fiaon-postmeister-einmal";
// E-531 Abnahme (akte#0): absenderGehoertZurPerson — js@/Team und Auto-Versand nur von der bei der Person gespeicherten Adresse.
import { personSuchen, akteLesen, absenderGehoertZurPerson } from "./fiaon-postmeister-dossier";
import { anredeBestimmen, antwortBauen } from "./fiaon-postmeister-antworttext";
import { postmeisterSchema } from "./fiaon-postmeister-schema";
import { wirdBedient, POSTFAECHER } from "./fiaon-postmeister-postfaecher";
import { AUTOMATEN_DOMAENEN, type Aktion } from "@shared/fiaon-postmeister-typen";
import { kiPausiert, istKiPause } from "./fiaon-ki-pause";
// E-272 (02.10.2026): die eine Regel „Kunde von FIAON Global“ (fiaon-global-kunde.ts)
import { istGlobalKunde } from "./fiaon-global-kunde";
// Integration 08.10.2026 (offener Fund zu Strang f): dieselbe Heikel-Regel wie der Auftrags-Katalog.
import { heikelArt } from "@shared/fiaon-auftrag-arten";
import { kuendigungSendeUrteil } from "@shared/fiaon-wortverbote";
// E-406 B3: die Ampel „Mails beantworten“ (grün/gelb/rot) — rein, eine Weiche vor dem Senden.
import { mailDarfAuto, mailAmpelGrund, mailAmpelGelbKarteGrund } from "@shared/fiaon-mara-ampel";
// E-531 (25.11.2026): Fall-Akte aus Gmail, keine Zeit-Zusagen, Schleifen-Bremse, Global-Weiche.
import {
  fallAkteMail, fallAkteBlock, berlinZeitText, adresseAus as fallAdresse, absenderAdresse, absenderEindeutig, entwurfTextLesen, entwurfUnveraendert,
  antwortAnAndere, antwortAnArt, adressWarnung, gueltigeAdresse,
  type FallAkte, type FallAkteGmail, type MaraSpur,
} from "./fiaon-fall-akte";
import { maraZeitZusage, bestehenderTermin, E531_UEBERGABE_SATZ } from "./fiaon-postmeister-werkzeuge";
// E-531 Nachbesserung: js@/Team nur für einen geprüften Absender; „gemischt“ (bezahltes Stufenpaket) wie E-272.
import { absenderEcht } from "@shared/fiaon-angaben-aendern";
import { produktkategorieSql } from "@shared/fiaon-produktkategorie";
// E-531 Abnahme (senden#0): der Kopf der Ablage „je Adresse ein Wand-Entwurf“ — derselbe Text wie im Muster des Rückstands-Takts.
import { E531_ABLAGE_KOPF } from "@shared/fiaon-postmeister-merker";

/**
 * E-272 (02.10.2026): Ist der Absender ein Kunde von FIAON Global? Dann geht seine Mail an den
 * Betreiber, nie an einen Privat-Betreuer oder die Vertriebsleitung — dieselbe Regel wie zustaendig()
 * und aufgabe_an_betreuer in fiaon-postmeister-werkzeuge.ts. Bis heute leiteten die Werkzeuge ihn an
 * den Betreiber, die Übergabe des Entwurfs aber (über auftragEmpfaenger → zustaendigeRolle) an den
 * Privatvertrieb. Justin (Fall Hildbrand): „nehme ihn bitte komplett aus den Workflows … Er soll Global
 * bleiben.“ Bei einer Störung der Prüfung: der bisherige Weg (wie in den Werkzeugen).
 */
async function globalUebergabe(personId: number | null): Promise<boolean> {
  return personId ? await istGlobalKunde(personId).catch(() => false) : false;
}

/**
 * Wiedervorlage nach dem n-ten Fehlversuch (11.09.2026, E-184): 15 Minuten,
 * 2 Stunden, 24 Stunden — danach ist Schluss und ein Mensch bekommt die
 * Aufgabe. Dieselbe Tabelle für KI-Fehler (versuche) und Versandfehler
 * (versand_versuche); Erstversuch + drei Wiederholungen = vier Versuche.
 */
const WIEDERVORLAGE_MS: Record<number, number> = { 1: 15 * 60_000, 2: 2 * 3_600_000, 3: 24 * 3_600_000 };

/** „HH:MM" in Berliner Zeit — nur formatToParts, nie Number(format()) (Zeit-Falle Berlin-Stunde). */
function uhrzeitBerlin(d: Date): string {
  const t = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const w = (n: string) => t.find((p) => p.type === n)?.value ?? "";
  return `${w("hour")}:${w("minute")}`;
}

/** JSONB kommt als Objekt, Altzeilen als Text — beides lesen, nie werfen. */
function jsonLesen(w: unknown): any {
  if (w == null) return null;
  if (typeof w === "object") return w;
  try { return JSON.parse(String(w)); } catch { return null; }
}

/**
 * Die Aufgabe an einen Menschen, wenn Mara nach vier Versuchen aufgibt (E-184).
 * Idempotent über den Schlüssel: entsteht EINMAL je Mail und Art, nicht in
 * jedem Takt. Ohne Person und Referenz bleibt sie beim Betreiber.
 */
async function aufgabeNachAufgabe(ein: {
  id: number; postfach: string; betreff: string; grund: string;
  personId: number | null; ref: string | null; art: "versand" | "ki-fehler";
}): Promise<void> {
  try {
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    const betreff = String(ein.betreff || "(ohne Betreff)").slice(0, 120);
    const text = ein.art === "versand"
      ? `Postfach ${ein.postfach}, Betreff „${betreff}“, Fehler: ${ein.grund}. Die Antwort liegt in der Postmeister-Zentrale (Zu prüfen) und kann von Hand gesendet werden — oder den Kunden anrufen.`
      : `Postfach ${ein.postfach}, Betreff „${betreff}“, Fehler: ${ein.grund}. Mara konnte viermal keine Antwort erzeugen. Die Mail liegt in der Postmeister-Zentrale (Zu prüfen) — bitte von Hand antworten oder den Kunden anrufen.`;
    // Vertretung (01.10.2026): Ist der Betreuer abwesend, bekommt der Vertreter die Aufgabe (ist er der
    // Betreiber: dessen Board) — sonst läge sie bis „bis" bei jemandem, der nichts sieht.
    const { uebergabeVertretungAbgeleitet, uebergabeFelder } = await import("./fiaon-abwesenheit");
    // E-272: Kunde von FIAON Global → Betreiber (globalUebergabe), ohne Vertretung des Privatvertriebs.
    const globalKunde = await globalUebergabe(ein.personId);
    const vt = ein.personId && !globalKunde ? await uebergabeVertretungAbgeleitet(ein.personId) : null;
    const a = await auftragFuerKunden({
      personId: ein.personId, ref: ein.ref,
      titel: ein.art === "versand" ? "Mail-Antwort konnte nicht gesendet werden" : "Mail-Antwort konnte nicht erzeugt werden",
      text, dringend: true, schluessel: `postmeister:${ein.id}:${ein.art}`, quelle: "postmeister", autorName: "Mara",
      link: "/chef/s/postmeister",
      ...(globalKunde ? { anBetreiber: true } : vt ? uebergabeFelder(vt) : { anBetreiber: !ein.personId && !ein.ref }),
    });
    await wiederOffenBereinigen(a.id);
  } catch (e) {
    console.error("[POSTMEISTER] Aufgabe an Menschen:", String(e).slice(0, 160));
  }
}

/** Vermerk in der Kundenakte — nur mit Referenz, und nie eine Mail daran scheitern lassen. */
async function akteVermerk(ref: string | null, personId: number | null, note: string): Promise<void> {
  if (!ref) return;
  await sqlPool`
    INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
    VALUES (${ref}, ${personId}, NULL, 'Postmeister', 'system', ${note})
  `.catch(() => {});
}

/**
 * Eine Nachricht in einen Ordner legen — und daran NIE eine Mail scheitern lassen.
 *
 * 02.09.2026: Die vier Aufrufstellen sahen so aus:
 *   await nachrichtLabeln(pf, id, [await labelSicherstellen(pf, "…")]).catch(() => {})
 * Das `.catch()` hängt an `nachrichtLabeln` — aber `labelSicherstellen` wird
 * BEIM AUSWERTEN DES ARGUMENTS aufgerufen, also bevor es die Promise-Kette
 * überhaupt gibt. Wirft es (Gmail antwortete mit HTTP 409 „Label name exists or
 * conflicts"), fängt das `.catch()` nichts, und die ganze Mail landete auf
 * 'fehler' — obwohl nur ein Ordner nicht angelegt werden konnte.
 *
 * Der Ordner ist Ablage. Die Antwort an den Kunden ist die Arbeit.
 */
async function ablegen(postfach: string, gmailId: string, ordner: string, weg: string[] = []): Promise<void> {
  try {
    const id = await labelSicherstellen(postfach, ordner);
    await nachrichtLabeln(postfach, gmailId, [id], weg);
  } catch (e: any) {
    console.warn(`[POSTMEISTER] Ordner „${ordner}" nicht gesetzt (${String(e?.message || e).slice(0, 120)}) — die Mail wird trotzdem bearbeitet.`);
  }
}

/**
 * Zitatblöcke abschneiden — sonst „liest" das Modell die eigene Rundmail.
 *
 * 24.09.2026 (E-240): Yahoo und die GMX-App setzen den Zitatkopf NICHT auf eine
 * eigene Zeile („  Am Do., Sept. 24, 2026 at 18:39 schrieb FIAON Welcome<…>:
 * Ein Dokument fehlt noch …"), Gmail setzt den Absender vor „schrieb". Die alten
 * Muster verlangten ^Am … :$ — unsere ganze Mail blieb im Kundentext, und
 * menschNoetig fand darin unseren eigenen Fuß „direkt an Ihren Ansprechpartner".
 * Gemessen: 19 von 21 Übergaben „möchte seinen Ansprechpartner sprechen" in 14
 * Tagen waren dieser Fehlalarm (Doris Hösl, 5612: „Ich hab keine." → Entwurf).
 * Deshalb zusätzlich: Zitatköpfe mitten in der Zeile, sobald sie eine Adresse
 * oder FIAON nennen, und als letzter Riegel unsere eigenen festen Sätze.
 */
const EIGENE_SAETZE = [
  /FIAON\s*\|?\s*Bonität ist machbar\./i,
  /Fragen\? Antworten Sie einfach auf diese E-Mail/i,
  /Diese Nachricht wurde automatisch zu Ihrem Vorgang erstellt/i,
  /Questions\? Just reply to this email/i,
];
export function ohneZitat(text: string): string {
  const t = String(text || "");
  const marken = [
    /^Am .{0,60} schrieb .{0,80}:$/m,
    /^On .{0,60} wrote:$/m,
    /^-{2,}\s*(Urspr[üu]ngliche|Original|Weitergeleitete) Nachricht\s*-{2,}$/im,
    /^Von:\s.{0,80}$/m,
    /^From:\s.{0,80}$/m,
    /^_{10,}$/m,
    // Mitten in der Zeile (Yahoo, GMX-App): „Am … schrieb <Absender mit Adresse oder FIAON>:"
    /\bAm\s[^\n]{3,80}?\sschrieb\s[^\n]{0,100}?(?:@|&lt;|fiaon)[^\n]{0,60}?:/i,
    /\bOn\s[^\n]{3,80}?\s[^\n]{0,100}?(?:@|&lt;|fiaon)[^\n]{0,60}?\swrote:/i,
    // Absender zuerst (Gmail deutsch): „FIAON Welcome <welcome@fiaon.com> schrieb am …:"
    /^[^\n]{0,80}(?:<|&lt;)\s*[\w.+-]+@\s*[\w.-]+\s*(?:>|&gt;)\s*(?:schrieb|wrote)\b[^\n]{0,80}:/im,
    ...EIGENE_SAETZE,
  ];
  let ende = t.length;
  for (const m of marken) {
    const treffer = t.match(m);
    if (treffer?.index != null && treffer.index < ende) ende = treffer.index;
  }
  const zeilen = t.slice(0, ende).split("\n").filter((z) => !z.trimStart().startsWith(">"));
  return zeilen.join("\n").trim();
}

/**
 * Muss hier ein Mensch ran? (18.09.2026, Team-Feedback Priorität 6)
 *
 * Bis heute entschied allein das Modell, ob es selbst antwortet — von 527
 * Mails bekannter Kunden lösten 38 % überhaupt eine Übergabe aus, und 17
 * „sonstige" Anliegen gingen automatisch raus. Diese Regel steht im Code, nicht
 * im Prompt: Beschwerde, Widerspruch, Rechtliches, Anwalt, Widerruf,
 * Zahlungsunfähigkeit, dringende Fälle, unklare Anliegen — und wer ausdrücklich
 * einen Menschen sprechen will — gehen an den Betreuer.
 */
/**
 * Die Gründe einer Übergabe — wörtlich, denn sie stehen im Aufgabentext
 * („<Grund>. Betreff „…" an … [Mail #id]") und uebergabeUrteil liest sie dort
 * wieder heraus. NIE umformulieren, ohne die alten Formen in
 * GRUENDE_NUR_ANTWORT mitzuführen.
 */
export const UEBERGABE_GRUND = {
  beschwerde: "Beschwerde",
  bestreitet: "Kunde bestreitet eine Forderung",
  rechtlich: "rechtliches Anliegen",
  widerruf: "Widerruf",
  zahlungsunfaehig: "Kunde kann nicht zahlen",
  mensch: "Anliegen braucht einen Menschen",
  dringend: "dringend",
  ansprechpartner: "Kunde möchte mit seinem Ansprechpartner sprechen",
  entwurf: "Mara hat einen Entwurf vorbereitet, aber nicht gesendet.",
  zentrale: "Kunde wartet auf eine Antwort (Entwurf lag in der Zentrale)",
  // E-248: Ein Widerruf oder Einwand aus einer früheren Mail ist noch offen (#5633) —
  // keine Zahlungsaufforderung, ein Mensch entscheidet.
  vorgeschichte: "Widerruf oder Einwand aus einer früheren Mail offen",
  // E-248: Kündigung angesprochen, aber nicht gebucht (#5626) — ein Mensch prüft und bucht.
  kuendigung: "Kündigung angesprochen, aber nicht gebucht",
  // E-275 (02.10.2026): Kunde von FIAON Global — Mara antwortet ihm nicht automatisch, Justin übernimmt (E-272).
  global: "Kunde von FIAON Global",
  // E-531 Abnahme (akte#0): erkannt über Nummer, Telefon oder Antwortkette, aber von einer Adresse, die bei der Person nicht
  // gespeichert ist — vielleicht ein Dritter. Nie automatisch; ein Mensch prüft, wer schreibt („nur von Hand“).
  fremderAbsender: "Absender ist nicht die bei der Person gespeicherte Adresse",
  // E-531 (Abnahme Runde 3): „Antwort-an“ nennt eine Adresse, die weder der Absender ist noch bei der Person gespeichert —
  // die Antwort ginge dorthin (vielleicht gefälschtes Von). Nie automatisch; ein Mensch prüft („nur von Hand“).
  fremdeAntwortAn: "Antwort-an ist eine fremde Adresse (nicht beim Kunden gespeichert)",
} as const;

/**
 * E-531 (Abnahme Runde 3 — Fund der Gegenprüfung, vorgezogen; fail-closed): Ginge eine Antwort laut „Antwort-an“ an eine
 * Adresse, die weder der Absender ist noch bei der Person gespeichert ist? antwortSenden schreibt an „Antwort-an“ — mit
 * gefälschtem Von (gespeicherte Adresse, Domain ohne strenges DMARC) und fremder Antwort-an ginge die Antwort samt Kundenlage
 * an einen Dritten. Dann nie automatisch. Ohne Person oder bei einer Störung: ja (im Zweifel Entwurf).
 * Gegenprüfung Runde 4 (hoch): Was keine EINZELNE gültige Adresse ist (der Rückfall „ganzer Kopf“ von antwortAnAndere), ist
 * sofort fremd — absenderGehoertZurPerson nähme sonst aus „<kunde@x>, "boese"@y“ die erste <…>-Gruppe und sagte „gehört zu ihm“.
 * `gehoert` nur für den Prüfstand (Attrappe statt Datenbank).
 */
export async function antwortAnFremd(antwortAn: unknown, von: unknown, personId: number | null | undefined,
  gehoert: (adresse: string, personId: number) => Promise<boolean> = absenderGehoertZurPerson): Promise<boolean> {
  // Schlussprüfung Runde 6: nur die Art zählt — „unklar“ ist immer fremd, „einzel“ nur, wenn bei der Person nicht gespeichert.
  const a = antwortAnArt(antwortAn, von);
  if (a.art === "leer" || a.art === "absender") return false;
  if (a.art === "unklar" || !personId || !gueltigeAdresse(a.adresse)) return true;
  return !(await gehoert(a.adresse, Number(personId)).catch(() => false));
}

/**
 * E-531 (Gegenprüfung Runde 4/5, Schlussprüfung Runde 6): der Warnsatz für Karte und Postfach, wenn „Antwort-an“ fremd ist.
 * Mit der fremden Adresse vorn (gekürzt — die Karte kürzt Belege auf 90 Zeichen) und dem, was „Senden“ hier tut: nur an die
 * gespeicherte Absenderadresse, oder gesperrt (dann in Gmail). Rein.
 */
export function antwortAnMangel(antwortAn: unknown, von: unknown, vonGespeichert = false): string {
  const wohin = antwortAnAndere(antwortAn, von).join(", ").replace(/[\r\n]+/g, " ").slice(0, 120);
  return `E-531: Antwort-an fremd (${wohin}) — ${vonGespeichert ? "„Senden“ geht nur an die gespeicherte Adresse" : "„Senden“ hier gesperrt, in Gmail prüfen"}.`;
}

/**
 * E-531 (Gegenprüfung Runde 5, Schlussprüfung Runde 6): der Warnsatz, wenn der Absender nicht die beim Kunden gespeicherte
 * Adresse ist — oder nicht eindeutig (dann der ganze Kopf, nie nur die Kundenadresse aus dem Namen). „Senden“ ist dann hier
 * gesperrt (handVersandZiel): ein Mensch prüft in Gmail, wer schreibt. Rein.
 */
export function absenderMangel(von: unknown): string {
  const eindeutig = absenderEindeutig(von);
  const wer = String((eindeutig && absenderAdresse(von)) || String(von ?? "")).replace(/[\r\n]+/g, " ").slice(0, 120);
  return `E-531: Absender nicht ${eindeutig ? "gespeichert" : "eindeutig"} (${wer}) — „Senden“ hier gesperrt, erst in Gmail prüfen, wer schreibt.`;
}

/** E-531: Ist das ein Adress-Warnsatz (dann hilft „Neu schreiben“ nie — ein Mensch prüft)? Eine Regel, in fiaon-fall-akte.ts. */
export { adressWarnung };

/**
 * E-531 (Gegenprüfung Runde 5, Schlussprüfung Runde 6): Wohin darf eine Antwort, die ein MENSCH über die Plattform freigibt
 * (Zentrale, Karte, Postfach, „N markierte senden“, Betreuer-Office, Mara heute, älterer Freigabe-Weg)? Mit Person NIE an den
 * rohen Kopf — immer an eine saubere, bei der Person gespeicherte Adresse, sonst gar nicht:
 *   · „Antwort-an“ = eine saubere, gespeicherte Adresse → dorthin (Wunsch des Kunden);
 *   · sonst der Absender, wenn er eindeutig und gespeichert ist (bei fremder Antwort-an mit Hinweis „umgeleitet“);
 *   · sonst gesperrt — ein Mensch antwortet bewusst in Gmail (der Gmail-Entwurf hat dann keinen Empfänger).
 * Ohne Person wie bisher (Antwort-an || Von). `gehoert` nur für den Prüfstand.
 */
export async function handVersandZiel(mail: { von?: unknown; antwortAn?: unknown }, personId: number | null | undefined,
  gehoert: (adresse: string, personId: number) => Promise<boolean> = absenderGehoertZurPerson): Promise<{ an: string | null; sperre: string | null; hinweis: string | null }> {
  if (!personId) return { an: null, sperre: null, hinweis: null };
  const pid = Number(personId);
  // Letzte Prüfung Runde 7 (klein): ZUERST der Absender — ist er nicht eindeutig und gespeichert, immer gesperrt (auch wenn die
  // Antwort-an gespeichert wäre); so stimmt der Warnsatz „Senden hier gesperrt“ immer.
  const von = absenderAdresse(mail.von);
  if (!von || !absenderEindeutig(mail.von) || !(await gehoert(von, pid).catch(() => false))) {
    return { an: null, sperre: "Der Absender ist nicht eindeutig die beim Kunden gespeicherte Adresse — hier geht nichts raus. Bitte in Gmail bewusst beantworten oder anrufen (Empfänger dort selbst prüfen — ein älterer Gmail-Entwurf kann noch an die fremde Adresse gerichtet sein); danach hier „Nichts senden“ (E-531).", hinweis: null };
  }
  const aa = antwortAnArt(mail.antwortAn, mail.von);
  if (aa.art === "einzel" && gueltigeAdresse(aa.adresse) && await gehoert(aa.adresse, pid).catch(() => false)) return { an: aa.adresse, sperre: null, hinweis: null };
  const umgeleitet = aa.art === "einzel" || aa.art === "unklar";
  return { an: von, sperre: null, hinweis: umgeleitet ? `An die gespeicherte Adresse ${von} gesendet — „Antwort-an“ war eine fremde Adresse (E-531).` : null };
}

/**
 * Gründe, die allein eine ANTWORT verlangen (E-244, Nachbesserung 26.09.).
 * Nur Aufgaben, deren Blöcke ALLE einen dieser Gründe tragen, schließt das
 * Senden. Rückrufwunsch, Beschwerde, Widerspruch/Bestreiten, Rechtliches,
 * Widerruf, Zahlungsunfähigkeit und „braucht einen Menschen" bleiben beim
 * Betreuer offen — die Antwort per Mail erledigt dort nicht die Arbeit.
 * „dringend" (ohne jeden anderen Grund) ist nur eine eilige Frage.
 */
export const GRUENDE_NUR_ANTWORT: readonly string[] = [UEBERGABE_GRUND.entwurf, UEBERGABE_GRUND.zentrale, UEBERGABE_GRUND.dringend];

// ═══════════════════════════════════════════════════════════════════════════
// E-275 (02.10.2026) — ÜBERGABE NUR NOCH, WO EIN MENSCH WIRKLICH ÜBERNIMMT
//
// Justin: „MARA verweist immer mehr auf die Mitarbeiter, Mara soll aber
// selbstständig arbeiten ohne jedes mal ein Termin zu vereinbaren." Gemessen
// (nur lesend, 18.09.–02.10.): 116 von 400 Antworten mit Übergabe (29 %); am
// 02.10. allein 7 von 13 Mails. Zwei Regeln hier erzwangen den größten Teil:
//   · Kategorie „sonstiges“ → immer ein Mensch. So lief #6120: „I have not your
//     kaditkarte" (Text nur „Sent from Yahoo Mail for iPhone“) — eine
//     Kartenfrage, die Mara seit heute selbst erledigt (karte_senden).
//   · JEDES Wort wie „Betreuer“, „Mitarbeiter“ oder „anrufen“ → ein Mensch —
//     auch „Mein Betreuer hat gesagt, die Karte kommt“ oder „ich habe versucht
//     anzurufen".
// Jetzt bleibt die Übergabe bei: Beschwerde, Bestreiten, Rechtsdrohung,
// Widerruf, „kann nicht zahlen“ (Geld), Beschwerde-/Rechts-/Vertriebs-
// Kategorie, AUSDRÜCKLICHEM Rückruf- oder Gesprächswunsch und Kunden von FIAON
// Global (E-272). Kündigung und Erstattung regeln Werkzeug und Lauf wie bisher
// (Kündigung nicht gebucht → Mensch; Geld zurück → Aufgabe an die Leitung).
// „dringend“ allein ist kein Grund mehr: Eine eilige Frage braucht eine
// schnelle Antwort, keinen wartenden Entwurf.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Will er AUSDRÜCKLICH einen Menschen am Telefon oder im Gespräch? Rein.
 * Nicht: „Mein Betreuer hat gesagt …“, „ich habe versucht anzurufen“,
 * „Herr Stripling hat mich angerufen“.
 */
const RUECKRUF_WUNSCH: RegExp[] = [
  /\b(?:rufen|ruft|ruf)\s+(?:sie|ihr|du)\s+mich\s+(?:\S+\s+){0,4}?an\b/i,
  /\b(?:bitte|können\s+sie|koennen\s+sie|könnten\s+sie|koennten\s+sie|würden\s+sie|wuerden\s+sie)\b[^.!?\n]{0,40}?(?<!nicht\s)(?<!nie\s)(?<!kein\s)\b(?:anrufen|zurückrufen|zurueckrufen|telefonisch\s+melden)\b/i,
  /\b(?:um\s+)?(?:einen\s+|ihren\s+)?rückruf\b|\bruckruf\b|\bzurückrufen\b|\bzurueckrufen\b/i,
  /\b(?:möchte|moechte|will|würde\s+gerne?|wuerde\s+gerne?|bitte)\b[^.!?\n]{0,50}?\b(?:mit\s+(?:einem\s+menschen|jemandem|meinem\s+(?:betreuer|ansprechpartner)\w*|meiner\s+(?:betreuerin|ansprechpartnerin)|ihnen|herrn?\s+\w+|frau\s+\w+)\s+(?:\S+\s+){0,2}?(?:sprechen|telefonieren|reden))\b/i,
  /\b(?:persönlich|persoenlich|telefonisch)\s+(?:sprechen|besprechen|klären|klaeren)\b/i,
  /\b(?:call\s+me|give\s+me\s+a\s+call|speak\s+to\s+(?:a\s+person|someone|a\s+human)|talk\s+to\s+(?:a\s+person|someone|a\s+human))\b/i,
];
export function rueckrufGewollt(text: string): boolean {
  // E-240: Unser eigener Fuß („… direkt an Ihren Ansprechpartner“) zählt nie als Wunsch des Kunden —
  // falls ein Zitat doch einmal durchrutscht, ohneZitat ist der erste Riegel.
  const eigenerText = String(text || "").replace(/Fragen\? Antworten Sie einfach auf diese E-Mail[^\n]{0,160}?Ansprechpartner\.?/gi, "");
  return RUECKRUF_WUNSCH.some((m) => m.test(eigenerText));
}

/** E-369: Post einer Behörde oder Aufsicht (nie automatisch beantworten). Rein. */
export const BEHOERDE = /\b(?:finanzmarktaufsicht|bafin|fma\b|staatsanwaltschaft|polizeiinspektion|polizeipräsidium|polizeipraesidium|kriminalpolizei|amtsgericht|landgericht|gerichtsvollzieh\w*|aktenzeichen\s*[:.]?\s*\d|datenschutzbeh(?:ö|oe)rde|landesbeauftragte\w*\s+f(?:ü|ue)r\s+(?:den\s+)?datenschutz|aufsichtsbeh(?:ö|oe)rde|ermittlungsverfahren)/i;

export function menschNoetig(
  e: { kategorien: readonly string[]; flags: object; dringend: boolean }, text: string,
  opt: { globalKunde?: boolean } = {},
): string | null {
  const f = (e.flags || {}) as Record<string, boolean>;
  // E-369 (15.10.2026, Justin: „Mara soll ALLES selbst machen können, nichts weitergeben an die Mitarbeiter“):
  // Beschwerde, Bestreiten, „kann nicht zahlen“ und „vertrieb_komplex“ beantwortet Mara selbst — ohne Zahlungsbitte
  // (zahlungsRuhe) und nur, wenn die Prüfung sauber ist (maraSelbstSendbar im Agenten). Einen Menschen (Justin, per
  // Entscheidungskarte) brauchen nur noch Anwalt/Behörde, ein Widerruf und FIAON Global — und der ausdrückliche
  // Rückrufwunsch, solange Mara den Termin nicht selbst eingeplant hat.
  if (f.droht_anwalt || f.rechtlich) return UEBERGABE_GRUND.rechtlich;
  // E-369 (#6558: Ersuchen der Finanzmarktaufsicht, Mara-Entwurf „melden uns fristgerecht“): Behördenpost entscheidet Justin.
  if (BEHOERDE.test(text)) return UEBERGABE_GRUND.rechtlich;
  if (f.widerruf) return UEBERGABE_GRUND.widerruf;
  // E-275: Global-Kunden bleiben bei Justin — nie eine automatische Antwort (E-272).
  if (opt.globalKunde) return UEBERGABE_GRUND.global;
  const k = new Set(e.kategorien || []);
  // E-275: „sonstiges“ ist kein Grund mehr (#6120) — Mara beantwortet es selbst.
  if (k.has("rechtlich")) return UEBERGABE_GRUND.rechtlich;
  // E-275: nur der AUSDRÜCKLICHE Wunsch nach Rückruf oder Gespräch — nicht jedes Wort „Betreuer“ oder „anrufen“.
  if (rueckrufGewollt(text)) return UEBERGABE_GRUND.ansprechpartner;
  return null;
}

/**
 * E-244 (Nachbesserung 26.09.): Öffnet auftragFuerKunden eine erledigte
 * Postfach-Aufgabe wieder (ON CONFLICT: status 'erledigt' → 'offen'), bleiben
 * erledigt_am/erledigt_von/ergebnis stehen — und ensureTodoTabelle setzt beim
 * nächsten Neustart jede Zeile mit erledigt_am wieder auf 'erledigt'. Die neue
 * Beschwerde wäre still erledigt. Deshalb hier: offen heißt ohne Erledigt-Spuren.
 * (Die eigentliche Stelle ist das ON CONFLICT in fiaon-betreiber-todo.ts — dort
 * vorgeschlagen; dieser Riegel deckt die Postfach-Wege bis dahin.)
 */
export async function wiederOffenBereinigen(todoId: number | null | undefined): Promise<void> {
  if (!todoId) return;
  await sqlPool`
    UPDATE fiaon_betreiber_todos
       SET erledigt_am = NULL, erledigt_von = NULL, ergebnis = NULL
     WHERE id = ${Number(todoId)} AND status <> 'erledigt'
       AND (erledigt_am IS NOT NULL OR erledigt_von IS NOT NULL OR ergebnis IS NOT NULL)
  `.catch((e) => console.error("[POSTMEISTER] Wiedereröffnung bereinigen:", String(e).slice(0, 160)));
}

/** Die Aufgabe beim Betreuer: eine je Kunde, weitere Mails hängen sich an. */
export async function anBetreuerUebergeben(ein: {
  id: number; personId: number | null; ref: string | null; postfach: string; betreff: string;
  zusammenfassung: string; grund: string; dringend: boolean;
}): Promise<void> {
  try {
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    // Vertretung (01.10.2026): Ist der Betreuer (bzw. der abgeleitete Empfänger) abwesend, bekommt der
    // Vertreter die Übergabe — ist er der Betreiber, dessen Board. Heikles zusätzlich aufs Board.
    const abw = await import("./fiaon-abwesenheit");
    // E-272: Kunde von FIAON Global → Betreiber (globalUebergabe), ohne Vertretung des Privatvertriebs.
    const globalKunde = await globalUebergabe(ein.personId);
    const vt = ein.personId && !globalKunde ? await abw.uebergabeVertretungAbgeleitet(ein.personId) : null;
    const titel = ein.dringend ? "Kunde hat geschrieben — bitte heute antworten" : "Kunde hat geschrieben — bitte antworten";
    const text = uebergabeBlock(ein);
    const link = ein.personId ? `/agent/kunden?person=${ein.personId}` : ein.ref ? `/agent/kunden?ref=${ein.ref}` : "/chef/s/postmeister";
    const a = await auftragFuerKunden({
      personId: ein.personId, ref: ein.ref,
      titel,
      text,
      dringend: ein.dringend,
      schluessel: uebergabeSchluessel(ein),
      quelle: "postmeister", autorName: "Mara",
      link,
      ...(globalKunde ? { anBetreiber: true } : vt ? abw.uebergabeFelder(vt) : { anBetreiber: !ein.personId && !ein.ref }),
    });
    if (vt?.anVertreter && abw.heikleUebergabe(`${ein.betreff}\n${ein.zusammenfassung}\n${ein.grund}`)) {
      await abw.betreiberKopie({ personId: ein.personId, ref: ein.ref, titel, text, dringend: true, schluessel: uebergabeSchluessel(ein), quelle: "postmeister", link }, vt);
    }
    await wiederOffenBereinigen(a.id);
  } catch (e) {
    console.error("[POSTMEISTER] Übergabe an Betreuer:", String(e).slice(0, 160));
  }
}

/**
 * Ein Block des Aufgabentexts — je übergebener Mail einer; eine zweite Mail
 * desselben Kunden hängt ihren Block an (ON CONFLICT in auftragFuerKunden).
 * Form: „<Grund>. Betreff „…" an <Postfach>: <Zusammenfassung> … [Mail #<id>]".
 * uebergabeBloecke liest genau diese Form zurück.
 */
export function uebergabeBlock(ein: { id: number; postfach: string; betreff: string; zusammenfassung: string; grund: string }): string {
  return `${ein.grund}. Betreff „${String(ein.betreff || "(ohne Betreff)").slice(0, 120)}“ an ${ein.postfach}: `
    + `${String(ein.zusammenfassung || "").slice(0, 400)} Mara hat einen Entwurf vorbereitet — ansehen, senden, ändern oder selbst antworten. [Mail #${ein.id}]`;
}

/**
 * Den Aufgabentext in Blöcke zerlegen: Jeder Block endet mit „[Mail #id]", sein
 * Grund steht vor dem ersten „. Betreff „". Rein. null, sobald etwas nicht in
 * diese Form passt (fremder Text, Handeintrag, Rest hinter der letzten Marke) —
 * dann schließt das Senden nie (lieber eine Aufgabe zu viel offen).
 * Produktion 26.09.: 153 offene Übergaben, 313 Blöcke, alle in dieser Form.
 */
export function uebergabeBloecke(text: string): { grund: string; mailId: number }[] | null {
  const t = String(text || "");
  const bloecke: { grund: string; mailId: number }[] = [];
  const marke = /\[Mail #(\d+)\]/g;
  let start = 0;
  for (let m = marke.exec(t); m; m = marke.exec(t)) {
    const stueck = t.slice(start, m.index).trim();
    start = m.index + m[0].length;
    const i = stueck.indexOf(". Betreff „");
    if (i <= 0) return null;
    bloecke.push({ grund: stueck.slice(0, i).trim(), mailId: Number(m[1]) });
  }
  if (!bloecke.length || t.slice(start).trim()) return null;
  return bloecke;
}

/** Eine Zeile aus fiaon_postmeister, wie uebergabeUrteil sie braucht. */
export interface UebergabeMail {
  id: number; postfach: string; thread: string | null;
  /** empfangen_am (sonst created_at) in ms */
  am: number;
  /** gesendet_am gesetzt ODER vom Betreuer übernommen */
  beantwortet: boolean;
  /** begruendung der Zeile — trägt bei Übergaben „Übergabe an den Betreuer: <Grund>" */
  begruendung?: string | null;
}

/**
 * DARF DIESE ANTWORT DIE ÜBERGABE SCHLIESSEN? (E-244, Nachbesserung 26.09.) — rein.
 *
 * Befund der Gesamtdurchsicht: uebergabeSchliessen schloss bei JEDER
 * gesendeten Antwort — auch den Rückrufwunsch, die Beschwerde, den Widerruf,
 * und auch dann, wenn Mara automatisch auf eine ANDERE Mail antwortete, nachdem
 * der Entwurf zur auslösenden Mail verworfen war. Jetzt gilt, der Reihe nach:
 *
 *   1. Der Aufgabentext ist lesbar (uebergabeBloecke), sonst bleibt sie offen.
 *   2. Die gesendete Mail TRIFFT die Aufgabe: Sie ist eine der auslösenden
 *      Mails ([Mail #id]) oder eine spätere Mail in DEMSELBEN Faden
 *      (Postfach + Thread, empfangen nicht vor der auslösenden).
 *   3. Jeder Block trägt einen Grund, der allein eine Antwort verlangt
 *      (GRUENDE_NUR_ANTWORT) — auch laut der Mail-Zeile selbst, falls dort
 *      „Übergabe an den Betreuer: <anderer Grund>" steht. Entfällt nur, wenn
 *      der Betreuer selbst „übernommen/erledigt" meldet (menschEntscheidet).
 *   4. JEDE auslösende Mail hat eine Antwort: selbst gesendet/übernommen, oder
 *      eine spätere Mail desselben Fadens ist beantwortet, oder es ist die
 *      gerade gesendete.
 *
 * `trifft` sagt, ob die Antwort zu dieser Aufgabe gehört — nur dann bekommt
 * eine offen bleibende Aufgabe einen Hinweis im Verlauf.
 *
 * Integration 08.10.2026 (offener Fund der Nachprüfung zu Strang f): Schritt 3 prüft jetzt auch den INHALT
 * (Titel und Text der Aufgabe — Betreff, Zusammenfassung) mit derselben Heikel-Regel wie der Auftrags-Katalog
 * (heikelArt, shared/fiaon-auftrag-arten.ts). Ein Grund, der „nur eine Antwort“ verlangt (Entwurf, Zentrale,
 * dringend, Ansprechpartner), mit Anwalt, Beschwerde, Storno, Löschwunsch oder Widerruf im Betreff schloss sich
 * sonst still, sobald Mara automatisch auf eine spätere, harmlose Mail im selben Faden antwortete —
 * gegen Justins Regel „Heikles schließt nie das System“. Entfällt wie die Gründe nur mit menschEntscheidet.
 */
export function uebergabeUrteil(ein: {
  text: string; gesendet: UebergabeMail; mails: UebergabeMail[]; menschEntscheidet?: boolean;
  /** Titel der Aufgabe — Teil des Inhalts, den die Heikel-Regel liest. */
  titel?: string | null;
}): { schliessen: boolean; trifft: boolean; grund: string } {
  const bloecke = uebergabeBloecke(ein.text);
  if (!bloecke) return { schliessen: false, trifft: false, grund: "Aufgabentext nicht lesbar" };
  const s = ein.gesendet;
  const zeile = (id: number) => (id === s.id ? s : ein.mails.find((m) => m.id === id) ?? null);
  const gleicherFaden = (a: UebergabeMail, b: UebergabeMail) =>
    !!a.thread && a.thread === b.thread && a.postfach.toLowerCase() === b.postfach.toLowerCase();
  // 2. Trifft die gesendete Mail die Aufgabe?
  const trifft = bloecke.some((b) => {
    if (b.mailId === s.id) return true;
    const m = zeile(b.mailId);
    return !!m && gleicherFaden(m, s) && s.am >= m.am;
  });
  if (!trifft) return { schliessen: false, trifft: false, grund: "Antwort gehört zu einer anderen Mail" };
  // 3. Verlangt ein Grund mehr als eine Antwort?
  if (!ein.menschEntscheidet) {
    const mehr = new Set<string>();
    for (const b of bloecke) {
      if (!GRUENDE_NUR_ANTWORT.includes(b.grund)) mehr.add(b.grund);
      const zeilenGrund = String(zeile(b.mailId)?.begruendung ?? "").match(/^Übergabe an den Betreuer:\s*(.+)$/)?.[1]?.trim();
      if (zeilenGrund && !GRUENDE_NUR_ANTWORT.includes(zeilenGrund)) mehr.add(zeilenGrund);
    }
    if (mehr.size) return { schliessen: false, trifft: true, grund: `verlangt mehr als eine Antwort: ${Array.from(mehr).join(", ")}` };
    const heikel = heikelArt(`${ein.titel ?? ""}\n${ein.text}`);
    if (heikel) {
      return { schliessen: false, trifft: true,
        grund: `verlangt mehr als eine Antwort: heikler Inhalt (${heikel === "kuendigung" ? "Kündigung, Widerruf oder Storno" : "Beschwerde, Recht, Löschung oder Erstattung"})` };
    }
  }
  // 4. Hat jede auslösende Mail eine Antwort?
  for (const b of bloecke) {
    if (b.mailId === s.id) continue;
    const m = zeile(b.mailId);
    if (!m) return { schliessen: false, trifft: true, grund: `Mail #${b.mailId} nicht gefunden` };
    if (m.beantwortet) continue;
    const spaeter = [s, ...ein.mails].some((x) => x.id !== m.id && (x.id === s.id || x.beantwortet) && gleicherFaden(x, m) && x.am >= m.am);
    if (!spaeter) return { schliessen: false, trifft: true, grund: `Mail #${b.mailId} hat noch keine Antwort` };
  }
  return { schliessen: true, trifft: true, grund: "" };
}

/**
 * Der Schlüssel der Übergabe-Aufgabe — eine je Kunde (Person, sonst Bestellung,
 * sonst Mail). Rein.
 *
 * 26.09.2026 (E-244, Nachbesserung): Ohne Kunde hieß der Schlüssel bisher
 * „postmeister:antwort:<Mail-ID>" — dieselbe Form wie für eine Person. Mail 5619
 * und Person 5619 teilten sich so eine Aufgabe (Produktion 26.09.: 22 offene
 * Übergaben ohne Kunde, jede ID gibt es auch als Person). Neue Aufgaben ohne
 * Kunde heißen jetzt „postmeister:antwort:mail:<Mail-ID>"; die alten schließt
 * uebergabeSchliessen über schliessKandidaten mit.
 */
export function uebergabeSchluessel(ein: { id: number; personId: number | null; ref: string | null }): string {
  if (ein.personId != null) return `postmeister:antwort:${ein.personId}`;
  if (ein.ref) return `postmeister:antwort:${ein.ref}`;
  return `postmeister:antwort:mail:${ein.id}`;
}

/**
 * Welche Aufgaben eine gesendete Mail schließen darf — rein, im Prüfstand geprüft.
 *
 *   · der Schlüssel des Kunden (Person, sonst Bestellung, sonst mail:<id>);
 *   · immer auch „mail:<id>" — wurde die Person erst nachträglich zugeordnet
 *     (Zentrale „Person zuordnen"), hängt die Aufgabe noch am Mail-Schlüssel;
 *   · der ALTE Mail-Schlüssel „postmeister:antwort:<id>" — aber nur als
 *     `nurOhneKunde`: er zählt nur, wenn die Aufgabe als Mail ohne Kunde angelegt
 *     wurde (Link /chef/s/postmeister). Sonst könnte das Senden der Mail 5619
 *     die Aufgabe der Person 5619 schließen.
 *
 * `sperreNr`: Endet der Schlüssel auf eine Zahl, hält jede noch wartende Zeile
 * mit dieser Zahl als Person ODER als Mail-ID die Aufgabe offen — denn eine
 * Altaufgabe kann beides gesammelt haben (ON CONFLICT hängt an).
 */
export function schliessKandidaten(ein: { id: number; personId: number | null; ref: string | null }):
  { schluessel: string; nurOhneKunde: boolean; sperrePerson: number | null; sperreMail: number | null; sperreRef: string | null }[] {
  const liste: { schluessel: string; nurOhneKunde: boolean; sperrePerson: number | null; sperreMail: number | null; sperreRef: string | null }[] = [];
  const dazu = (k: (typeof liste)[number]) => { if (!liste.some((x) => x.schluessel === k.schluessel)) liste.push(k); };
  if (ein.personId != null) {
    // Alter Namensraum: Person N und Mail N teilen sich den Schlüssel.
    dazu({ schluessel: `postmeister:antwort:${ein.personId}`, nurOhneKunde: false, sperrePerson: ein.personId, sperreMail: ein.personId, sperreRef: null });
  } else if (ein.ref) {
    dazu({ schluessel: `postmeister:antwort:${ein.ref}`, nurOhneKunde: false, sperrePerson: null, sperreMail: null, sperreRef: ein.ref });
  }
  dazu({ schluessel: `postmeister:antwort:mail:${ein.id}`, nurOhneKunde: false, sperrePerson: null, sperreMail: ein.id, sperreRef: null });
  if (ein.personId !== ein.id) {
    dazu({ schluessel: `postmeister:antwort:${ein.id}`, nurOhneKunde: true, sperrePerson: ein.id, sperreMail: ein.id, sperreRef: null });
  }
  return liste;
}

/**
 * DIE ÜBERGABE ENDET MIT DER ANTWORT (26.09.2026, E-244)
 *
 * Bis heute schloss NICHTS die Aufgabe „Kunde hat geschrieben — bitte
 * antworten": weder das Senden aus der Zentrale noch das Senden oder
 * Übernehmen durch den Betreuer. Stand 26.09.: 153 offene Übergaben seit dem
 * 18.09., keine einzige erledigt — 116 davon zu Kunden, deren Entwurf längst
 * gesendet war. Der Betreuer sah also vor allem Aufgaben, die keine mehr waren.
 *
 * Geschlossen wird nur, wenn für denselben Kunden KEIN weiterer Entwurf wartet
 * (die Aufgabe ist eine je Kunde; eine zweite Mail hängt sich an). Nichts wird
 * gelöscht — „erledigt" mit Ergebnis, wie jede andere Aufgabe. Verwerfen
 * schließt NICHT: Dann hat der Kunde noch keine Antwort.
 *
 * Aufgerufen von JEDEM Weg, auf dem eine Antwort hinausgeht: Zentrale (beide
 * Sendewege), Betreuer (Senden, „übernommen"), Maras Auto-Versand und das
 * Nachholen eines gescheiterten Versands.
 *
 * NACHBESSERUNG (26.09.2026, Gesamtdurchsicht E-244): Nicht jede Antwort
 * erledigt die Aufgabe. uebergabeUrteil entscheidet — nur die auslösende Mail
 * (oder eine spätere im selben Faden), nur Gründe, die allein eine Antwort
 * verlangen, und nur, wenn jede auslösende Mail beantwortet ist. Bleibt eine
 * Aufgabe wegen ihres Grundes offen (Rückruf, Beschwerde, Widerruf …), bekommt
 * sie einen Hinweis im Verlauf: Die Antwort ist raus, der Rest wartet.
 * `menschEntscheidet`: Der Betreuer meldet selbst „übernommen/erledigt" — dann
 * zählt sein Wort statt des Grundes (Schritt 3 entfällt).
 *
 * Was NICHT mehr wartet und deshalb nie sperrt: Zeilen eines nicht bedienten
 * Postfachs (js@, E-171 — nie sendbar) und alte Fehlerzeilen (älter als 14
 * Tage, z. B. „Nach Neustart hängen geblieben" vom 31.08.–02.09.).
 */
export async function uebergabeSchliessen(
  ein: { id: number; personId: number | null; ref: string | null },
  wer: string, ergebnis: string,
  /** abgelegt (E-401 6/6): Die Mail bekam keine Antwort, ihr Entwurf ist „nicht mehr nötig“ — der Hinweis sagt das, nicht „gesendet“. */
  opt: { menschEntscheidet?: boolean; abgelegt?: boolean } = {},
): Promise<boolean> {
  const bedient = POSTFAECHER.map((p) => p.adresse.toLowerCase());
  let geschlossen = false;
  for (const k of schliessKandidaten(ein)) {
    try {
      const [t] = (await sqlPool`
        SELECT t.id, t.text, t.titel FROM fiaon_betreiber_todos t
         WHERE t.schluessel = ${k.schluessel} AND t.status <> 'erledigt'
           AND (${k.nurOhneKunde}::boolean = FALSE OR t.link LIKE '/chef/s/postmeister%')
         LIMIT 1
      `) as any[];
      if (!t) continue;
      const text = String(t.text ?? "");
      const ids = Array.from(new Set((uebergabeBloecke(text) ?? []).map((b) => b.mailId).concat(ein.id)));
      // Die auslösenden Mails, die gesendete und alle Zeilen ihrer Fäden.
      const zeilen = (await sqlPool`
        WITH basis AS (
          SELECT LOWER(p.postfach) AS postfach, p.thread_id FROM fiaon_postmeister p
           WHERE p.id = ANY(${ids}::int[]) AND NULLIF(p.thread_id, '') IS NOT NULL)
        SELECT p.id, LOWER(p.postfach) AS postfach, p.thread_id,
               COALESCE(p.empfangen_am, p.created_at) AS am, p.begruendung,
               (p.gesendet_am IS NOT NULL OR COALESCE(p.begruendung, '') LIKE 'Vom Betreuer übernommen%'
                -- E-248: ein Doppel wird nie eigens beantwortet — die Antwort auf das Original gilt.
                OR (p.aktion = 'geordnet' AND COALESCE(p.begruendung, '') LIKE 'Doppel von Mail #%')) AS beantwortet
          FROM fiaon_postmeister p
         WHERE p.id = ANY(${ids}::int[])
            OR (NULLIF(p.thread_id, '') IS NOT NULL AND (LOWER(p.postfach), p.thread_id) IN (SELECT postfach, thread_id FROM basis))
         LIMIT 500
      `) as any[];
      const mails: UebergabeMail[] = zeilen.map((r) => ({
        id: Number(r.id), postfach: String(r.postfach || ""), thread: r.thread_id ?? null,
        am: r.am ? new Date(r.am).getTime() : 0, beantwortet: !!r.beantwortet, begruendung: r.begruendung ?? null,
      }));
      const gesendet = mails.find((m) => m.id === ein.id);
      if (!gesendet) continue;
      const urteil = uebergabeUrteil({ text, titel: t.titel ?? null, gesendet, mails, menschEntscheidet: !!opt.menschEntscheidet });
      if (!urteil.schliessen) {
        // Die Antwort gehört zu dieser Aufgabe, aber ihr Grund verlangt mehr —
        // der Betreuer soll sehen, dass die Mail raus ist und was noch fehlt.
        if (urteil.trifft && urteil.grund.startsWith("verlangt mehr")) {
          await sqlPool`
            INSERT INTO fiaon_betreiber_todo_beitraege (todo_id, autor_art, autor_name, art, text)
            VALUES (${Number(t.id)}, 'system', 'Mara', 'kommentar',
                    ${opt.abgelegt
                      ? `Maras Entwurf zu Mail #${ein.id} ist abgelegt — nicht mehr nötig (${wer.slice(0, 80)}). Die Aufgabe bleibt offen — ${urteil.grund}. Bitte selbst nachfassen und dann erledigen.`
                      : `Antwort auf Mail #${ein.id} ist gesendet (${wer.slice(0, 80)}). Die Aufgabe bleibt offen — ${urteil.grund}. Bitte selbst nachfassen und dann erledigen.`})
          `.catch((e) => console.error("[POSTMEISTER] Übergabe-Hinweis:", String(e).slice(0, 160)));
          await sqlPool`UPDATE fiaon_betreiber_todos SET letzte_aktivitaet = NOW(), updated_at = NOW() WHERE id = ${Number(t.id)}`.catch(() => {});
        }
        continue;
      }
      // E-397: mit Art und Grund wie jedes Ereignis — „Automatisch erledigt durch Mara hat geantwortet (Mail #id)“,
      // sichtbar in „Erledigt“ und mit „Wieder öffnen“ rückholbar. Antwortet ein Mensch (Zentrale, Betreuer),
      // heißt der Grund „Antwort gesendet (<Name>)“.
      const vonMara = /^Mara/i.test(wer);
      const ereignisText = vonMara ? `Mara hat geantwortet (Mail #${ein.id}) – ${wer}` : `Antwort gesendet (Mail #${ein.id}) – ${wer}`;
      const fertig = (await sqlPool`
        UPDATE fiaon_betreiber_todos t
           SET status = 'erledigt', erledigt_am = NOW(), erledigt_von = ${wer.slice(0, 120)},
               erledigt_art = ${opt.menschEntscheidet ? "hand" : "auto"}, erledigt_ereignis = ${ereignisText.slice(0, 300)},
               ergebnis = ${ergebnis.slice(0, 500)}, updated_at = NOW(), letzte_aktivitaet = NOW()
         WHERE t.id = ${Number(t.id)} AND t.status <> 'erledigt'
           -- Hat sich inzwischen eine weitere Mail angehängt, entscheidet der nächste Versand.
           AND t.text IS NOT DISTINCT FROM ${t.text ?? null}
           AND NOT EXISTS (
             SELECT 1 FROM fiaon_postmeister p
              WHERE p.id <> ${ein.id} AND p.gesendet_am IS NULL
                AND p.aktion IN ('entwurf', 'fehler', 'versand_wartet', 'versand_fehlgeschlagen', 'sendet')
                AND LOWER(p.postfach) = ANY(${bedient}::text[])
                AND NOT (p.aktion = 'fehler' AND p.created_at < NOW() - INTERVAL '14 days')
                AND ((${k.sperrePerson}::int IS NOT NULL AND p.person_id = ${k.sperrePerson}::int)
                  OR (${k.sperreMail}::int IS NOT NULL AND p.id = ${k.sperreMail}::int)
                  OR (${k.sperreRef}::text IS NOT NULL AND p.ref = ${k.sperreRef}::text)))
         RETURNING t.id
      `) as any[];
      if (fertig.length) {
        geschlossen = true;
        await sqlPool`
          INSERT INTO fiaon_betreiber_todo_beitraege (todo_id, autor_art, autor_name, art, text)
          VALUES (${Number(t.id)}, 'system', ${wer.slice(0, 120)}, 'status', ${`Automatisch erledigt durch ${ereignisText}`})
        `.catch(() => {});
      }
    } catch (e) {
      console.error("[POSTMEISTER] Übergabe schließen:", String(e).slice(0, 160));
    }
  }
  return geschlossen;
}

/**
 * Schreibt hier ein bekannter Kunde? (18.09.2026, Team-Feedback Priorität 6)
 * Gefragt VOR jeder Verwerf-Regel: Ein Kunde mit einer Adresse bei
 * googlemail.com — oder ein Testkunde des Teams mit fiaon.com-Adresse — ist
 * ein Kunde. Seine Antwort darf nie als „Dienstleister" oder „eigene Post"
 * verschwinden (Befund: 8 echte Antworten, dazu der Test eines Mitarbeiters).
 */
export async function absenderIstKunde(adresse: string): Promise<boolean> {
  const a = String(adresse || "").trim().toLowerCase();
  if (!a.includes("@")) return false;
  const [r] = (await sqlPool`
    SELECT 1 AS ja FROM fiaon_persons p WHERE LOWER(TRIM(COALESCE(p.primary_email, ''))) = ${a}
    UNION ALL
    SELECT 1 FROM fiaon_applications x
     WHERE x.gdpr_deleted_at IS NULL
       AND ${a} IN (LOWER(TRIM(COALESCE(x.email, ''))), LOWER(TRIM(COALESCE(x.contact_email, ''))), LOWER(TRIM(COALESCE(x.billing_email, ''))))
    LIMIT 1
  `.catch(() => [] as any[])) as any[];
  return !!r;
}

/** Post, die nie eine Antwort bekommt. Host-genau, nie als Teilstring. */
export function istFremdpost(mail: GmailNachricht, bekannterKunde = false): { fremd: boolean; grund: string } {
  const adresse = String(mail.vonAdresse || "").toLowerCase();
  const host = adresse.split("@")[1] ?? "";
  // Ein bekannter Kunde ist nie Fremdpost — außer seiner Abwesenheitsnotiz.
  if (bekannterKunde) {
    return mail.autoHinweis ? { fremd: true, grund: "automatische Nachricht eines Kunden (z. B. Abwesenheitsnotiz)" } : { fremd: false, grund: "" };
  }
  if (adresse.endsWith("@fiaon.com")) return { fremd: true, grund: "eigene Post" };
  if (mail.autoHinweis) return { fremd: true, grund: "automatische Nachricht (kein Absender, der antwortet)" };
  for (const d of AUTOMATEN_DOMAENEN) {
    if (host === d || host.endsWith(`.${d}`)) return { fremd: true, grund: `Dienstleister (${d})` };
  }
  const zusatz = String(process.env.POSTMEISTER_AUTOMATEN || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  for (const d of zusatz) if (host === d || host.endsWith(`.${d}`)) return { fremd: true, grund: `Dienstleister (${d})` };
  // Typische Absender von Bestellbestätigungen und Systemmeldungen
  if (/^(no-?reply|noreply|do-?not-?reply|donotreply|mailer-daemon|postmaster|bounce|notifications?|alerts?|newsletter|info@mailer)/.test(adresse.split("@")[0] ?? "")) {
    return { fremd: true, grund: "Absender antwortet nicht" };
  }
  return { fremd: false, grund: "" };
}

/** Der Gesprächsverlauf einer Unterhaltung, wie ihn das Modell braucht. */
async function verlaufLesen(postfach: string, threadId: string, aktuelleId: string): Promise<{ von: string; am: string; text: string }[]> {
  const zeilen = (await sqlPool`
    SELECT von, empfangen_am, text, antwort, gesendet_am, aktion
      FROM fiaon_postmeister
     WHERE thread_id = ${threadId} AND gmail_id <> ${aktuelleId}
     ORDER BY empfangen_am ASC LIMIT 40
  `) as any[];
  const verlauf: { von: string; am: string; text: string }[] = [];
  for (const z of zeilen) {
    if (z.text) verlauf.push({ von: "Kunde", am: new Date(z.empfangen_am).toLocaleDateString("de-DE"), text: String(z.text).slice(0, 3000) });
    if (z.antwort && (z.gesendet_am || z.aktion === "auto_beantwortet")) {
      verlauf.push({ von: "FIAON", am: new Date(z.gesendet_am ?? z.empfangen_am).toLocaleDateString("de-DE"), text: String(z.antwort).slice(0, 3000) });
    }
  }
  return verlauf;
}

/**
 * HAT SCHON EIN MENSCH GEANTWORTET? (27.09.2026, E-246 Nachprüfung)
 *
 * Während der KI-Pause beantworten Menschen Mails direkt in Gmail — der Alarm
 * sagt es ausdrücklich. Unser Verlauf (verlaufLesen) kennt nur fiaon_postmeister,
 * also sähe Mara diese Antwort nie und schriebe nach dem Aktivieren eine zweite,
 * womöglich widersprechende (anderer Betrag, andere Frist, „lag bereits vor").
 *
 * Gesucht wird im Postfach selbst: Nachrichten mit Label SENT an den Absender
 * (oder seine Reply-To-Adresse), NACH dem Eingang dieser Mail, im selben Faden.
 * Maras eigener Versand (aktion 'auto_beantwortet' im selben Faden, ±3 Minuten)
 * zählt nicht — eine Antwort aus der Zentrale ('gesendet') schon: Die hat ein
 * Mensch geschrieben.
 *
 * Wirft bei einem Gmail-Fehler: Der Aufrufer macht daraus einen Fehlversuch mit
 * Wiedervorlage — im Zweifel lieber später als doppelt antworten.
 */
export async function spaetereAntwortImFaden(postfach: string, mail: GmailNachricht): Promise<{ am: Date; id: string } | null> {
  const adressen = Array.from(new Set(
    [mail.vonAdresse, (mail.antwortAn?.match(/<([^>]+)>/)?.[1] ?? mail.antwortAn ?? "")]
      .map((a) => String(a || "").trim().toLowerCase())
      .filter((a) => /^[^\s@{}()"]+@[^\s@{}()"]+$/.test(a)),
  ));
  if (!adressen.length || !mail.threadId) return null;
  const nach = Math.floor(mail.datum.getTime() / 1000);
  const an = adressen.map((a) => `to:${a} cc:${a}`).join(" ");
  const { ids } = await nachrichtenSuchen(postfach, `in:sent after:${nach} {${an}}`, 25);
  for (const kandidat of ids.slice(0, 12)) {
    if (kandidat === mail.id) continue;
    const m = await nachrichtLesen(postfach, kandidat);
    if (m.threadId !== mail.threadId) continue;
    if (!m.labelIds.includes("SENT")) continue;
    if (m.datum.getTime() <= mail.datum.getTime()) continue;
    const [mara] = (await sqlPool`
      SELECT 1 FROM fiaon_postmeister
       WHERE thread_id = ${mail.threadId} AND aktion = 'auto_beantwortet' AND gesendet_am IS NOT NULL
         AND gesendet_am BETWEEN ${new Date(m.datum.getTime() - 180_000)} AND ${new Date(m.datum.getTime() + 180_000)}
       LIMIT 1`) as any[];
    if (mara) continue;
    return { am: m.datum, id: m.id };
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// EINE MAIL — EINE ANTWORT (28.09.2026, E-248)
//
// DIE MESSUNG (Produktion, nur gelesen): Person A schickte am 21.09. dieselbe
// Mail elfmal (gleicher Text, jede mit eigener Message-ID, zwei Fäden) und bekam
// zwischen 15:20 und 15:31 Uhr ELF Antworten — fünf automatisch, sechs von Hand
// freigegeben. Seit 27.09. liegen von ihr 16 gleiche Entwürfe da. Person B
// bekam am 24.09. drei Antworten mit je einer Rechnung in 76 Sekunden (zweimal
// derselbe Text, einmal leer mit Anhang); Person C zwei in 38 Sekunden. Die
// Doppel-Prüfung verglich nur die Message-ID.
//
// JETZT, unter einer Sperre je Kunde (pg_advisory_xact_lock — zwei Takte, der
// Aufhol-Lauf und das Nachholen nach der KI-Pause können gleichzeitig laufen):
//   · gleicher Text derselben Person (oder Adresse) innerhalb von 24 Stunden —
//     bei kurzen Texten („Ja", „Danke") nur 30 Minuten — ist ein DOPPEL: nur
//     eingeordnet, keine zweite Antwort, kein zweiter Entwurf, keine KI-Kosten;
//   · eine Mail ohne eigenen Text (nur Anhang) bis 30 Minuten nach einer
//     anderen derselben Person ist ein NACHTRAG zu ihr;
//   · wer die Sperre zuerst hat, trägt Person und Text sofort in seine Zeile —
//     die nächste Mail sieht ihn, auch wenn seine Antwort noch entsteht.
// Das Senden prüft es ein zweites Mal (sendeSperre): im automatischen Versand,
// im Nachholen und — als Vorschlag — in der Zentrale.
// ═══════════════════════════════════════════════════════════════════════════

/** Der Text für den Doppel-Vergleich: klein, ohne Satzzeichen und Leerraum-Unterschiede. Rein. */
export function doppelSchluessel(text: string): string {
  const roh = String(text || "").toLowerCase().replace(/&nbsp;/g, " ");
  // Ohne /u (Übersetzerziel älter als ES2015): lateinische Buchstaben mit Akzenten; ein Text
  // in anderer Schrift (Kyrillisch, Arabisch …) bleibt dann als ganzer Text der Schlüssel —
  // er darf nie leer werden, sonst gälte er als „Nachtrag ohne Text".
  const k = roh.replace(/[^a-z0-9äöüßàáâãåæçèéêëìíîïñòóôõøùúûýÿąćęłńśźżăîșțşğıœčďěňřšťůž]+/g, " ").trim();
  return (k || roh.replace(/\s+/g, " ").trim()).slice(0, 4000);
}

export interface DoppelKandidat { id: number; text: string | null; am: number; aktion: string }

/** Kurze Texte („Ja", „Danke") gelten nur 30 Minuten als Doppel — ein „Ja" morgen ist ein neues Ja. */
const DOPPEL_FENSTER_MS = 24 * 3_600_000;
const KURZ_FENSTER_MS = 30 * 60_000;

/**
 * Ist diese Mail ein Doppel oder ein Nachtrag? Rein — der Prüfstand rechnet die
 * echten Fälle nach (Person A, B, C). `andere` = Zeilen derselben Person, die
 * schon beansprucht sind (nicht 'ignoriert', nicht 'vorgeordnet'). Fenster 24 h — schickt
 * jemand dieselbe Frage zwei Tage später noch einmal, ist das ein neues Nachfragen.
 */
export function doppelUrteil(ein: { text: string; am: number }, andere: DoppelKandidat[]): { id: number; grund: string } | null {
  const k = doppelSchluessel(ein.text);
  const sortiert = andere.slice().sort((a, b) => a.am - b.am || a.id - b.id);
  if (!k) {
    const nah = sortiert.find((x) => Math.abs(x.am - ein.am) <= KURZ_FENSTER_MS);
    return nah ? { id: nah.id, grund: "Nachtrag ohne eigenen Text (nur Anhang)" } : null;
  }
  const fenster = k.length < 40 ? KURZ_FENSTER_MS : DOPPEL_FENSTER_MS;
  const gleich = sortiert.find((x) => doppelSchluessel(x.text ?? "") === k && Math.abs(x.am - ein.am) <= fenster);
  return gleich ? { id: gleich.id, grund: "derselbe Text noch einmal geschickt" } : null;
}

/** Die Adresse aus „Name <a@b.de>" oder „a@b.de". Rein. */
function adresseAus(von: string | null | undefined): string {
  const t = String(von || "").toLowerCase();
  return (t.match(/<([^>]+)>/)?.[1] ?? t).trim();
}

/**
 * Doppel prüfen und — wenn keins — die eigene Zeile sofort mit Person und Text
 * belegen. Unter einer Sperre je Kunde, damit zwei gleichzeitige Läufe nie beide
 * „kein Doppel" sehen.
 */
async function doppelSperre(ein: {
  id: number; personId: number | null; von: string; text: string; am: Date; threadId: string; betreff: string;
}): Promise<{ id: number; grund: string } | null> {
  const adresse = adresseAus(ein.von);
  const schluessel = ein.personId != null ? `person:${ein.personId}` : adresse ? `adresse:${adresse}` : null;
  if (!schluessel) return null;
  return await sqlPool.begin(async (tx: any) => {
    await tx`SELECT pg_advisory_xact_lock(hashtext(${`postmeister-antwort:${schluessel}`}))`;
    const zeilen = (await tx`
      SELECT id, text, COALESCE(empfangen_am, created_at) AS am, aktion
        FROM fiaon_postmeister
       WHERE id <> ${ein.id}
         AND aktion NOT IN ('ignoriert', 'vorgeordnet')
         AND ${ein.personId != null ? tx`person_id = ${ein.personId}` : tx`LOWER(COALESCE(substring(von from '<([^>]+)>'), von, '')) = ${adresse}`}
         AND COALESCE(empfangen_am, created_at) BETWEEN ${new Date(ein.am.getTime() - DOPPEL_FENSTER_MS)} AND ${new Date(ein.am.getTime() + DOPPEL_FENSTER_MS)}
       ORDER BY id ASC LIMIT 200`) as any[];
    const urteil = doppelUrteil(
      { text: ein.text, am: ein.am.getTime() },
      zeilen.map((z) => ({ id: Number(z.id), text: z.text ?? "", am: new Date(z.am).getTime(), aktion: String(z.aktion) })),
    );
    if (!urteil) {
      // Belegen: Die nächste Mail derselben Person sieht diese hier sofort.
      await tx`
        UPDATE fiaon_postmeister SET person_id = COALESCE(person_id, ${ein.personId}), von = ${ein.von}, text = ${String(ein.text || "").slice(0, 12_000)},
               empfangen_am = ${ein.am}, thread_id = ${ein.threadId || ""}, betreff = ${ein.betreff}, updated_at = NOW()
         WHERE id = ${ein.id}`;
    }
    return urteil;
  });
}

/**
 * DARF DIESE ANTWORT NOCH RAUS? (E-248) — die zweite Sperre, direkt vor dem Senden.
 * Nein, wenn derselbe Kunde auf denselben Text (Doppel-Regel oben) schon eine
 * Antwort bekommen hat oder eine gerade hinausgeht ('sendet'). Für den
 * automatischen Versand, das Nachholen und die Zentrale (entwurfSenden,
 * entwurfBeanspruchen — dort als Vorschlag). Wirft nie; im Zweifel „darf".
 */
export async function sendeSperre(id: number): Promise<{ doppelVon: number; grund: string } | null> {
  try {
    const [z] = (await sqlPool`
      SELECT id, person_id, von, text, COALESCE(empfangen_am, created_at) AS am FROM fiaon_postmeister WHERE id = ${id}`) as any[];
    if (!z) return null;
    const adresse = adresseAus(z.von);
    if (z.person_id == null && !adresse) return null;
    const am = new Date(z.am);
    const zeilen = (await sqlPool`
      SELECT id, text, COALESCE(empfangen_am, created_at) AS am, aktion
        FROM fiaon_postmeister
       WHERE id <> ${id} AND (gesendet_am IS NOT NULL OR aktion IN ('sendet', 'auto_beantwortet', 'gesendet'))
         AND ${z.person_id != null ? sqlPool`person_id = ${Number(z.person_id)}` : sqlPool`LOWER(COALESCE(substring(von from '<([^>]+)>'), von, '')) = ${adresse}`}
         AND COALESCE(empfangen_am, created_at) BETWEEN ${new Date(am.getTime() - DOPPEL_FENSTER_MS)} AND ${new Date(am.getTime() + DOPPEL_FENSTER_MS)}
       ORDER BY id ASC LIMIT 200`) as any[];
    const u = doppelUrteil({ text: String(z.text ?? ""), am: am.getTime() },
      zeilen.map((r) => ({ id: Number(r.id), text: r.text ?? "", am: new Date(r.am).getTime(), aktion: String(r.aktion) })));
    return u ? { doppelVon: u.id, grund: u.grund } : null;
  } catch (e) {
    console.warn("[POSTMEISTER] Sendesperre nicht prüfbar:", String((e as any)?.message || e).slice(0, 160));
    return null;
  }
}

/**
 * Die Doppel-Entwürfe, die schon liegen (E-248: 16 gleiche von Person A),
 * einordnen — damit weder die Zentrale noch das Nachholen sie ein zweites Mal
 * senden. Behalten wird je Kunde und Text der älteste; die anderen werden
 * 'geordnet' mit „Doppel von Mail #…". Nichts wird gelöscht (der Gmail-Entwurf
 * bleibt, die Zeile lässt sich zurücksetzen). Läuft am Anfang von
 * versandNachholen, höchstens alle 15 Minuten.
 */
let doppelZuletzt = 0;
export async function doppelteEntwuerfeOrdnen(opt: { immer?: boolean } = {}): Promise<number> {
  // Nachbesserung E-248: höchstens alle 15 Minuten (der LATERAL-Join mit regexp_replace über
  // 30 Tage kostet in Produktion rund 1,3 s) — neue Doppel hält ohnehin die Sperre 5c am Eingang auf.
  if (!opt.immer && Date.now() - doppelZuletzt < 15 * 60_000) return 0;
  doppelZuletzt = Date.now();
  try {
    const zeilen = (await sqlPool`
      WITH e AS (
        SELECT id, person_id, text, COALESCE(empfangen_am, created_at) AS am,
               regexp_replace(lower(COALESCE(text, '')), '[^[:alnum:]]+', ' ', 'g') AS k
          FROM fiaon_postmeister
         WHERE aktion IN ('entwurf', 'versand_wartet', 'fehler') AND gesendet_am IS NULL AND person_id IS NOT NULL
           AND created_at > NOW() - INTERVAL '30 days')
      SELECT e.id, e.text, e.am, o.id AS original
        FROM e
        JOIN LATERAL (
          SELECT p.id FROM fiaon_postmeister p
           WHERE p.person_id = e.person_id AND p.id <> e.id AND p.aktion NOT IN ('ignoriert', 'vorgeordnet')
             AND regexp_replace(lower(COALESCE(p.text, '')), '[^[:alnum:]]+', ' ', 'g') = e.k
             AND length(trim(e.k)) >= 40
             AND COALESCE(p.empfangen_am, p.created_at) BETWEEN e.am - INTERVAL '24 hours' AND e.am + INTERVAL '24 hours'
             AND (p.gesendet_am IS NOT NULL OR COALESCE(p.empfangen_am, p.created_at) < e.am
                  OR (COALESCE(p.empfangen_am, p.created_at) = e.am AND p.id < e.id))
           ORDER BY (p.gesendet_am IS NOT NULL) DESC, COALESCE(p.empfangen_am, p.created_at) ASC, p.id ASC LIMIT 1) o ON TRUE
       LIMIT 200`) as any[];
    let n = 0;
    for (const z of zeilen) {
      const r = (await sqlPool`
        UPDATE fiaon_postmeister SET aktion = 'geordnet', naechster_versuch_am = NULL, in_arbeit_seit = NULL,
               begruendung = ${`Doppel von Mail #${Number(z.original)} — derselbe Text noch einmal geschickt; nur eine Antwort (E-248)`}, updated_at = NOW()
         WHERE id = ${Number(z.id)} AND aktion IN ('entwurf', 'versand_wartet', 'fehler') AND gesendet_am IS NULL
         RETURNING id`) as any[];
      n += r.length;
    }
    if (n) console.log(`[POSTMEISTER] ${n} Doppel-Entwürfe eingeordnet (E-248).`);
    return n;
  } catch (e) {
    console.error("[POSTMEISTER] Doppel-Entwürfe:", String((e as any)?.message || e).slice(0, 200));
    return 0;
  }
}

/** E-369: So lange wartet eine frische Mail, ob der Kunde gleich weiterschreibt (ein Takt ist 5 Minuten). */
export const BUENDEL_WARTE_MS = 4 * 60_000;
/** E-369: Eine neuere Mail innerhalb dieses Abstands nimmt die ältere mit. */
export const BUENDEL_FENSTER_MS = 3 * 3_600_000;

/**
 * E-369 (15.10.2026): Warten, mitnehmen lassen oder jetzt beantworten? Reine Entscheidung über die Zeilen desselben
 * Kunden (Person, sonst Adresse) — ohne „ignoriert“ und ohne Doppel/Gebündelte („geordnet“ ohne Versand).
 *  · warten: diese Mail ist jünger als BUENDEL_WARTE_MS;
 *  · mitgenommen: eine neuere Mail (bis BUENDEL_FENSTER_MS später) wartet noch auf ihre Antwort — oder hat sie schon
 *    bekommen, nachdem diese hier im Haus war (dann stand sie in deren Verlauf).
 */
export function buendelEntscheiden(
  dieser: { am: number; seit: number }, andere: { id: number; am: number; aktion: string; gesendetAm: number | null }[], jetzt: number,
): { art: "warten" | "mitgenommen" | "jetzt"; grund: string } {
  if (jetzt - dieser.am < BUENDEL_WARTE_MS) return { art: "warten", grund: "frisch" };
  const neuere = andere.filter((z) => z.am > dieser.am && z.am - dieser.am <= BUENDEL_FENSTER_MS && z.aktion !== "ignoriert"
    && !(z.aktion === "geordnet" && !z.gesendetAm));
  const offen = neuere.find((z) => !z.gesendetAm && !["auto_beantwortet", "gesendet"].includes(z.aktion));
  if (offen) return { art: "mitgenommen", grund: `Die Antwort auf Mail #${offen.id} (neuer, desselben Kunden) nimmt diese mit` };
  const beantwortet = neuere.find((z) => z.gesendetAm != null && z.gesendetAm >= dieser.seit);
  if (beantwortet) return { art: "mitgenommen", grund: `Mit der Antwort auf Mail #${beantwortet.id} (neuer, desselben Kunden) beantwortet` };
  return { art: "jetzt", grund: "" };
}

async function buendelUrteil(ein: { id: number; personId: number | null; von: string; am: Date }): Promise<{ art: "warten" | "mitgenommen" | "jetzt"; grund: string }> {
  const adresse = adresseAus(ein.von);
  if (ein.personId == null && !adresse) return { art: "jetzt", grund: "" };
  const [ich] = (await sqlPool`SELECT created_at FROM fiaon_postmeister WHERE id = ${ein.id}`) as any[];
  const zeilen = (await sqlPool`
    SELECT id, COALESCE(empfangen_am, created_at) AS am, aktion, gesendet_am
      FROM fiaon_postmeister
     WHERE id <> ${ein.id}
       AND ${ein.personId != null ? sqlPool`person_id = ${ein.personId}` : sqlPool`LOWER(COALESCE(substring(von from '<([^>]+)>'), von, '')) = ${adresse}`}
       AND COALESCE(empfangen_am, created_at) > ${ein.am}
       AND COALESCE(empfangen_am, created_at) <= ${new Date(ein.am.getTime() + BUENDEL_FENSTER_MS)}
     ORDER BY COALESCE(empfangen_am, created_at) DESC LIMIT 20`) as any[];
  return buendelEntscheiden(
    { am: ein.am.getTime(), seit: ich?.created_at ? new Date(ich.created_at).getTime() : Date.now() },
    zeilen.map((z) => ({ id: Number(z.id), am: new Date(z.am).getTime(), aktion: String(z.aktion), gesendetAm: z.gesendet_am ? new Date(z.gesendet_am).getTime() : null })),
    Date.now(),
  );
}

/** Die Nachbar-Mails, wie sie in den Auftrag gehen (Verlauf, älteste zuerst) — und die IDs, deren Kundentext dort steht. */
export interface NachbarMails { eintraege: { von: string; am: string; text: string }[]; ids: number[] }

/**
 * E-531 Gegenprüfung (B13): die Zeilen aus nachbarMails (neueste zuerst gelesen) als Verlauf, ÄLTESTE zuerst. `ids` nennt
 * nur Zeilen, deren Kundentext wirklich im Auftrag steht — nur sie darf e531AeltereAblegen aus einem anderen Faden ablegen.
 * Die Namen der Einträge bleiben (der Agent erkennt Nachbar-Mails daran). Rein.
 */
export function nachbarEintraege(zeilenNeuesteZuerst: readonly any[]): NachbarMails {
  const eintraege: NachbarMails["eintraege"] = [];
  const ids: number[] = [];
  for (const z of [...(zeilenNeuesteZuerst ?? [])].reverse()) {
    if (!z) continue;
    const am = new Date(z.am).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    if (z.text) {
      eintraege.push({ von: "Kunde (andere Mail von ihm, anderer Faden)", am, text: String(z.text).slice(0, 1500) });
      const id = Number(z.id);
      if (Number.isFinite(id) && id > 0) ids.push(id);
    }
    if (z.antwort && (z.gesendet_am || z.aktion === "auto_beantwortet")) {
      eintraege.push({ von: "FIAON (unsere Antwort darauf — er hat sie bekommen)", am, text: String(z.antwort).slice(0, 1500) });
    }
  }
  return { eintraege, ids };
}

/**
 * Die anderen Mails desselben Kunden aus den letzten drei Tagen, die NICHT in
 * diesem Faden stehen (E-248). Schreibt jemand in drei Fäden kurz hintereinander,
 * sieht Mara alle drei und was sie darauf schon geantwortet hat — eine Antwort,
 * die an die vorige anknüpft, statt dreimal von vorn.
 * E-531 Gegenprüfung (B13): die 8 NEUESTEN (vorher die 8 ältesten — bei Vielschreibern fehlte gerade die jüngste ältere
 * Mail), im Auftrag weiter älteste zuerst; dazu die IDs, die wirklich im Auftrag stehen. Bei einer Störung: nichts.
 */
async function nachbarMails(personId: number | null, id: number, threadId: string): Promise<NachbarMails> {
  if (personId == null) return { eintraege: [], ids: [] };
  const zeilen = (await sqlPool`
    SELECT id, text, antwort, gesendet_am, aktion, COALESCE(empfangen_am, created_at) AS am
      FROM fiaon_postmeister
     WHERE person_id = ${personId} AND id <> ${id} AND COALESCE(thread_id, '') <> ${threadId || "-"}
       AND aktion NOT IN ('ignoriert') AND COALESCE(empfangen_am, created_at) > NOW() - INTERVAL '3 days'
     ORDER BY COALESCE(empfangen_am, created_at) DESC LIMIT 8`.catch(() => [])) as any[];
  return nachbarEintraege(zeilen);
}

/**
 * Ein offener Widerruf oder eine bestrittene Forderung aus einer FRÜHEREN Mail
 * (E-248, #5633): Der Kunde hatte widersprochen, Mara gab den Nachweis zur
 * Prüfung — und forderte auf seine nächste Mail hin automatisch die Zahlung,
 * weil in DIESER Mail das Wort „Widerruf" fehlte. Widerruf gilt 30 Tage,
 * Bestreiten 14 Tage (Produktion 28.09.: 92 Personen, 35 davon mit offener
 * Bestellung; 7 automatische Antworten in 14 Tagen wären betroffen gewesen).
 */
export async function offeneEinwaende(personId: number | null, id: number): Promise<Vorgeschichte | null> {
  if (personId == null) return null;
  const [z] = (await sqlPool`
    SELECT id, (flags::text ~ 'widerruf\\\\?"\\s*:\\s*true') AS widerruf, COALESCE(empfangen_am, created_at) AS am
      FROM fiaon_postmeister
     WHERE person_id = ${personId} AND id <> ${id}
       AND ((flags::text ~ 'widerruf\\\\?"\\s*:\\s*true' AND COALESCE(empfangen_am, created_at) > NOW() - INTERVAL '30 days')
         OR (flags::text ~ 'bestreitet\\\\?"\\s*:\\s*true' AND COALESCE(empfangen_am, created_at) > NOW() - INTERVAL '14 days'))
     ORDER BY COALESCE(empfangen_am, created_at) DESC LIMIT 1`.catch(() => [])) as any[];
  if (!z) return null;
  const am = new Date(z.am).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit" });
  return { grund: `${z.widerruf ? "Widerruf" : "bestrittene Forderung"} aus seiner Mail vom ${am} (Mail #${Number(z.id)}) noch offen` };
}

/**
 * fiaon_postmeister.handlungen in jeder Form, die es in der Datenbank gibt
 * (Produktion 27.09.: 1.054 Zeilen jsonb-TEXT „[…]", 26 Arrays aus solchen
 * Texten — protokoll() hängt Text an —, eine echte Liste): flach als Objekte.
 */
export function handlungenFlach(w: unknown, tiefe = 0): any[] {
  if (w == null || tiefe > 4) return [];
  if (typeof w === "string") { try { return handlungenFlach(JSON.parse(w), tiefe + 1); } catch { return []; } }
  if (Array.isArray(w)) return w.flatMap((x) => handlungenFlach(x, tiefe + 1));
  if (typeof w === "object") return [w];
  return [];
}

/**
 * Was ein früherer Anlauf zu DIESER Mail schon getan hat (E-246): Jedes Werkzeug
 * schreibt seine Handlung an die Zeile (protokoll → fiaon_postmeister.handlungen).
 * Legt die KI-Pause eine Mail mitten im Lauf zurück, stehen sie dort weiter.
 */
export async function schonGetan(postmeisterId: number): Promise<{ werkzeug: string; ergebnis: string }[]> {
  const [z] = (await sqlPool`SELECT handlungen FROM fiaon_postmeister WHERE id = ${postmeisterId}`.catch(() => [])) as any[];
  return handlungenFlach(z?.handlungen)
    .filter((h: any) => h && typeof h.werkzeug === "string" && h.ok !== false)
    .map((h: any) => ({ werkzeug: String(h.werkzeug), ergebnis: String(h.ergebnis ?? "").slice(0, 300) }));
}

// ═══════════════════════════════════════════════════════════════════════════
// E-531 (25.11.2026) — MARA-NEUBAU STUFE 1 IM POSTFACH
//
// Justin (25.11.): Mara soll Zusammenhänge kennen wie ein guter Mitarbeiter, keine falschen Zusagen machen und Arbeit
// abnehmen statt machen. Audit 26.10.–24.11. (welcome@/support@): viele Auto-Mails mit „X meldet sich heute“, fast keine
// davon gehalten; Widerspruch zu Briefen der Geschäftsleitung im selben Faden; einzelne Menschen bekamen in wenigen Tagen
// sehr viele Auto-Mails; Global-Kunden mit Privat-Wissen beantwortet (Zahlen im Register E-531). Hier vier Bausteine:
//   1. GLOBAL-WEICHE vor der KI (wie E-350): keine KI-Antwort, Ordner „FIAON/Global von Hand“, EINE Aufgabe je Faden.
//   2. FALL-AKTE (fiaon-fall-akte.ts): der ganze Gmail-Faden, js@, Team — fiaon_postmeister nur noch als Rückfall.
//   3. KEINE ZEIT-ZUSAGEN: maraZeitZusage vor JEDEM automatischen Versand — Treffer → Entwurf + Karte.
//   4. SCHLEIFEN-BREMSE: ab der dritten automatischen Antwort in 7 Tagen an dieselbe Adresse → Entwurf + Karte.
// Die Entscheidungen sind rein (globalWeicheUrteil, schleifenBremseUrteil) — scripts/pruef-mara-e531.ts rechnet nach.
// ═══════════════════════════════════════════════════════════════════════════

/** Eine Spur „dieser Absender gehört zu FIAON Global“ — aus Auftrag, Angebot/Partnervertrag oder der Akte (E-272). */
export interface GlobalSpur { quelle: "auftrag" | "angebot" | "person"; fassung?: string | null; status?: string | null; test?: boolean }

/** Die Art eines Global-Angebots aus seiner Fassung (IA-KAPITAL-…, IA-KOOP-EMPFEHLUNG-…). Rein. */
export function globalAngebotArt(fassung: string | null | undefined): string {
  const f = String(fassung ?? "").trim().toUpperCase();
  if (f.startsWith("IA-KOOP-EMPFEHLUNG")) return "Empfehlungs-Partnervertrag";
  if (f.startsWith("IA-KOOP")) return "Kooperations-Partnervertrag";
  if (f.startsWith("IA-KAPITAL")) return "Kapital-Angebot";
  if (f.startsWith("IA-FIRMA")) return "Firmenangebot";
  if (f.startsWith("IA-BEGLEIT")) return "Begleitvertrag";
  return "Global-Angebot";
}

/**
 * E-531: Ist der Absender ein Global-Kunde? Ja bei einem Global-Auftrag (Testakten zählen nicht), bei jedem Angebot oder
 * Partnervertrag in fiaon_global_angebote (jeder Status — ein Nein macht keinen Privatkunden, E-272) und bei einer
 * Person, die laut Akte Global-Kunde ist. Rein — die Spuren liest globalSpurenLesen.
 * E-531 Nachbesserung (Gutachten Richtigkeit): AUSNAHME „gemischt“ wie E-272/E-476 — hat er ein BEZAHLTES Stufenpaket
 * (und keinen angenommenen Begleitvertrag), bleibt er Privatkunde: Mara antwortet wie bisher (Kündigung, Rate, Karte),
 * dieselbe Regel wie auf WhatsApp (globalKundeWa). Dann zählen auch Adress-Spuren aus Angebot oder Auftrag nicht.
 */
export function globalWeicheUrteil(spuren: GlobalSpur[] | null | undefined, opt: { gemischt?: boolean } = {}): { global: boolean; grund: string } {
  if (opt.gemischt) return { global: false, grund: "" };
  const gruende: string[] = [];
  for (const s of spuren ?? []) {
    if (!s) continue;
    const status = s.status ? ` (${String(s.status).slice(0, 30)})` : "";
    const grund = s.quelle === "auftrag" ? (s.test ? "" : `Global-Auftrag${status}`)
      : s.quelle === "angebot" ? `${globalAngebotArt(s.fassung)}${status}`
      : s.quelle === "person" ? "Global-Kunde laut Akte (E-272)" : "";
    if (grund && !gruende.includes(grund)) gruende.push(grund);
  }
  return gruende.length ? { global: true, grund: gruende.slice(0, 3).join(", ") } : { global: false, grund: "" };
}

/** Der Schlüssel der EINEN offenen Aufgabe je Gmail-Faden (E-531). Ohne Faden: je Mail. Rein. */
export function globalWeicheSchluessel(threadId: string | null | undefined, mailId: number): string {
  const t = String(threadId ?? "").trim();
  return t ? `postmeister:${t}:global` : `postmeister:mail:${Number(mailId)}:global`;
}

/** Der Aufgabentext der Global-Weiche: wer, wann, Betreff und die ersten 300 Zeichen seiner Mail. Rein. */
export function globalAufgabeText(ein: { id: number; postfach: string; von: string; betreff: string; text: string; grund: string; am?: Date | null }): string {
  const auszug = String(ein.text ?? "").replace(/\s+/g, " ").trim();
  return [
    `Postfach ${ein.postfach}, von ${String(ein.von || "(unbekannt)").slice(0, 120)}, ${berlinZeitText(ein.am ?? null)}.`,
    `Betreff: „${String(ein.betreff || "(ohne Betreff)").slice(0, 160)}“`,
    `„${auszug.slice(0, 300)}${auszug.length > 300 ? " …" : ""}“`,
    `Global-Kunde (${ein.grund}) — Mara antwortet NICHT (E-531): keine KI-Antwort, kein Entwurf. Bitte von Hand antworten; die Mail liegt ungelesen im Posteingang (Ordner „FIAON/Global von Hand“). [Mail #${ein.id}]`,
  ].join("\n");
}

/**
 * Die Global-Spuren eines Absenders (Adresse und Antwort-an) und der gefundenen Person. Spalten wie in der Produktion
 * (gelesen 25.11.): fiaon_global_auftraege.email/status/ist_test_am, fiaon_global_angebote.kunde->>'email'/fassung/status.
 * ist_test_am legt erst die Laufzeit an — darum über to_jsonb gelesen (fehlt die Spalte, ist es kein Test). Wirft bei
 * einer Störung: Die Zeile geht auf „fehler“ und wird später neu geprüft — nie „im Zweifel antworten“ (Muster E-350).
 * E-531 Nachbesserung: dazu „gemischt“ (E-272/E-476) — ein bezahltes Stufenpaket der Person oder unter seiner Adresse,
 * ohne angenommenen Begleitvertrag (E-384). Dieselbe Kategorie-Regel wie globalKundeSql (produktkategorieSql = 'konto').
 */
async function globalSpurenLesen(adressen: string[], personId: number | null): Promise<{ spuren: GlobalSpur[]; gemischt: boolean }> {
  const liste = Array.from(new Set(adressen.map((a) => String(a || "").trim().toLowerCase())))
    .filter((a) => /^[^\s@<>]+@[^\s@<>]+$/.test(a) && !a.endsWith("@fiaon.com"));
  const spuren: GlobalSpur[] = [];
  const pid = personId != null && Number(personId) > 0 ? Number(personId) : null;
  let gemischt = false;
  if (!liste.length && !pid) return { spuren, gemischt };
  const [t] = (await sqlPool`SELECT to_regclass('public.fiaon_global_angebote') AS angebote, to_regclass('public.fiaon_global_auftraege') AS akten`) as any[];
  {
    // Bezahltes Stufenpaket (Person oder Adresse) — dann entscheidet die Privat-Regel, nicht die Adress-Spur.
    const [b] = (await sqlPool.unsafe(`
      SELECT EXISTS (
               SELECT 1 FROM fiaon_applications a
                WHERE (a.person_id = $1::int OR LOWER(TRIM(COALESCE(a.email, ''))) = ANY($2::text[]))
                  AND a.merged_into IS NULL AND a.payment_status = 'paid' AND NOT COALESCE(a.ist_entwurf, FALSE)
                  AND a.gdpr_deleted_at IS NULL AND ${produktkategorieSql("a")} = 'konto') AS bezahlt,
             ${t?.angebote ? `EXISTS (
               SELECT 1 FROM fiaon_global_angebote g
                WHERE g.status = 'angenommen' AND g.fassung LIKE 'IA-BEGLEIT-%'
                  AND (g.person_id = $1::int OR LOWER(TRIM(COALESCE(g.kunde->>'email', CASE WHEN jsonb_typeof(g.kunde) = 'string' THEN (g.kunde #>> '{}')::jsonb ->> 'email' END, ''))) = ANY($2::text[])))` : "FALSE"} AS begleit`,
      [pid, liste])) as any[];
    gemischt = b?.bezahlt === true && b?.begleit !== true;
    if (gemischt) return { spuren, gemischt };
  }
  if (liste.length) {
    if (t?.akten) {
      const zeilen = (await sqlPool`
        SELECT g.status, (to_jsonb(g) ->> 'ist_test_am') IS NOT NULL AS test
          FROM fiaon_global_auftraege g
         WHERE LOWER(TRIM(COALESCE(g.email, ''))) = ANY(${liste}::text[])
         ORDER BY g.id DESC LIMIT 5`) as any[];
      for (const z of zeilen) spuren.push({ quelle: "auftrag", status: z.status ?? null, test: !!z.test });
    }
    if (t?.angebote) {
      const zeilen = (await sqlPool`
        SELECT a.fassung, a.status FROM fiaon_global_angebote a
         WHERE LOWER(TRIM(COALESCE(a.kunde->>'email', CASE WHEN jsonb_typeof(a.kunde) = 'string' THEN (a.kunde #>> '{}')::jsonb ->> 'email' END, ''))) = ANY(${liste}::text[])
         ORDER BY a.id DESC LIMIT 5`) as any[];
      for (const z of zeilen) spuren.push({ quelle: "angebot", fassung: z.fassung ?? null, status: z.status ?? null });
    }
  }
  if (!globalWeicheUrteil(spuren).global && personId != null && Number(personId) > 0 && await istGlobalKunde(Number(personId))) {
    spuren.push({ quelle: "person" });
  }
  return { spuren, gemischt };
}

/** Die EINE Aufgabe je Faden für Justin (Board des Betreibers). Wie E-350: scheitert sie, bleibt die Mail trotzdem liegen. */
async function globalAufgabeAnlegen(ein: { id: number; postfach: string; mail: GmailNachricht; text: string; grund: string; personId: number | null; ref: string | null }): Promise<void> {
  try {
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    const a = await auftragFuerKunden({
      personId: ein.personId, ref: ein.ref, anBetreiber: true, dringend: true,
      titel: `Global-Kunde schreibt: „${String(ein.mail.betreff || "(ohne Betreff)").slice(0, 100)}“`,
      text: globalAufgabeText({ id: ein.id, postfach: ein.postfach, von: ein.mail.von, betreff: ein.mail.betreff, text: ein.text, grund: ein.grund, am: ein.mail.datum }),
      schluessel: globalWeicheSchluessel(ein.mail.threadId, ein.id),
      quelle: "postmeister", autorName: "Mara", link: `/chef/s/postmeister?eintrag=${ein.id}`,
    });
    await wiederOffenBereinigen(a.id);
  } catch (e) {
    console.error("[POSTMEISTER] Aufgabe Global-Kunde (E-531):", String(e).slice(0, 160));
  }
}

/**
 * E-531: Die Fall-Akte dieser Mail. Maras eigene Antworten im Faden erkennt die Akte an Zeit und Text aus
 * fiaon_postmeister (die Gmail-ID der gesendeten Antwort steht dort nicht). Wirft nie.
 * E-531 Nachbesserung (Gutachten Richtigkeit/Kundensicherheit):
 *   · automatische Mails der Mara-Aktion im selben Faden an ihrer Gmail-ID (fiaon_mara_aktion.gmail_id/thread_id) und
 *     andere automatische Mara-Mails (Kündigungsbestätigung) an ihrem Absendernamen — nie „WIR (Mensch)“;
 *   · js@ und die Team-Postfächer NUR für einen bekannten Kunden (Person gefunden) mit geprüftem Absender (absenderEcht:
 *     SPF/DKIM/DMARC bestanden, keine fremde Antwort-an) — dazu seine Adresse aus der Akte.
 * E-531 Abnahme (Gegenprüfung akte#0, senden#1, akte#1):
 *   · js@/Team zusätzlich nur, wenn die Absenderadresse bei der erkannten Person gespeichert ist (`eigenerAbsender`, vom Lauf
 *     mit absenderGehoertZurPerson gerechnet). personSuchen erkennt eine Person auch über Rechnungsnummer, Telefon oder
 *     Antwortkette — ein Dritter mit eigener, echter Adresse bekäme sonst die Briefe der Geschäftsleitung an sie.
 *   · alle gespeicherten Adressen der Person (Person, Bestellungen) für Suche und Empfänger-Filter; die Antwort-an-Adresse
 *     für den Faden (dorthin gingen unsere Antworten).
 *   · scheitert eine Datenbank-Spur, ist die Akte unvollständig (`lesefehler`): Maras eigene Antworten gälten sonst als
 *     Brief eines Menschen. Wirft weiter nie. `gmail` nur für den Prüfstand.
 */
export async function fallAkteLesen(postfach: string, mail: GmailNachricht, wer: { personId: number | null; eigenerAbsender: boolean },
  gmail?: FallAkteGmail): Promise<FallAkte> {
  let maraSpuren: MaraSpur[] = [];
  let eigeneAntwortIds: string[] = [];
  const dbLuecken: string[] = [];
  if (mail.threadId) {
    try {
      const zeilen = (await sqlPool`
        SELECT gesendet_am, antwort, aktion FROM fiaon_postmeister
         WHERE thread_id = ${mail.threadId} AND LOWER(postfach) = ${String(postfach).toLowerCase()}
           AND gesendet_am IS NOT NULL AND aktion IN ('auto_beantwortet', 'gesendet')
         ORDER BY gesendet_am ASC LIMIT 80`) as any[];
      maraSpuren = zeilen.map((z) => ({ am: z.gesendet_am ? new Date(z.gesendet_am) : null, text: z.antwort ?? null, freigegeben: String(z.aktion) === "gesendet" }));
    } catch (e) {
      console.warn("[POSTMEISTER] Fall-Akte: Mara-Antworten nicht lesbar:", String((e as any)?.message || e).slice(0, 160));
      dbLuecken.push("Mara-Antworten (Datenbank)");
    }
    try {
      const aktion = (await sqlPool`
        SELECT gmail_id FROM fiaon_mara_aktion
         WHERE thread_id = ${mail.threadId} AND status = 'gesendet' AND COALESCE(gmail_id, '') <> '' LIMIT 40`) as any[];
      eigeneAntwortIds = aktion.map((z) => String(z.gmail_id)).filter(Boolean);
    } catch (e) {
      console.warn("[POSTMEISTER] Fall-Akte: Mara-Aktion nicht lesbar:", String((e as any)?.message || e).slice(0, 160));
      dbLuecken.push("Mara-Aktion (Datenbank)");
    }
  }
  const { agentNamen } = await import("./fiaon-postmeister-agent");
  const maraNamen = [(await agentNamen().catch(() => null))?.voll].filter((n): n is string => !!n);
  const gmailSuche = !!wer.personId && absenderEcht({ authErgebnis: mail.authErgebnis ?? null, von: mail.von, antwortAn: mail.antwortAn ?? null }).echt
    && wer.eigenerAbsender === true;
  let kundenAdressen: string[] = [];
  if (gmailSuche) {
    try {
      const pid = Number(wer.personId);
      const zeilen = (await sqlPool`
        SELECT a FROM (
          SELECT p.primary_email AS a, 0 AS o FROM fiaon_persons p WHERE p.id = ${pid} OR p.merged_into_person_id = ${pid}
          UNION ALL
          SELECT unnest(ARRAY[ap.email, ap.contact_email, ap.billing_email]) AS a, 1 AS o FROM fiaon_applications ap
           WHERE ap.gdpr_deleted_at IS NULL
             AND (ap.person_id = ${pid} OR ap.person_id IN (SELECT d.id FROM fiaon_persons d WHERE d.merged_into_person_id = ${pid}))
        ) q WHERE COALESCE(q.a, '') LIKE '%@%' ORDER BY q.o ASC LIMIT 12`) as any[];
      kundenAdressen = Array.from(new Set(zeilen.map((z) => fallAdresse(z.a ?? "")).filter(Boolean)));
    } catch (e) {
      console.warn("[POSTMEISTER] Fall-Akte: gespeicherte Adressen nicht lesbar:", String((e as any)?.message || e).slice(0, 160));
      dbLuecken.push("gespeicherte Adressen (Datenbank)");
    }
  }
  const akte = await fallAkteMail({
    postfach, threadId: mail.threadId, kundenEmail: mail.von || mail.vonAdresse, kundenAdressen, maraSpuren, eigeneAntwortIds, maraNamen,
    ohneId: mail.id, gmailSuche, antwortAn: mail.antwortAn ?? null,
  }, gmail);
  if (dbLuecken.length) {
    akte.lesefehler = [...dbLuecken, ...(akte.lesefehler ?? [])];
    akte.hinweise.push(`Datenbank nicht lesbar (${dbLuecken.join(", ")}) — eigene frühere Antworten stehen darum vielleicht als „Mensch“ da.`);
  }
  return akte;
}

/** E-531: Ab der dritten automatischen Antwort in 7 Tagen an dieselbe Adresse (also wenn schon 2 draußen sind) ein Mensch. */
export const SCHLEIFE_AUTO_GRENZE = 2;

/** Schleifen-Bremse: Darf die nächste automatische Antwort an diese Adresse noch raus? Rein. */
export function schleifenBremseUrteil(z: { autoAntworten7Tage: number; kundenMails7Tage?: number | null }): { bremsen: boolean; n: number; grund: string | null } {
  const auto = Math.max(0, Math.floor(Number(z?.autoAntworten7Tage) || 0));
  if (auto < SCHLEIFE_AUTO_GRENZE) return { bremsen: false, n: auto + 1, grund: null };
  const n = Math.max(auto + 1, Math.floor(Number(z?.kundenMails7Tage) || 0));
  return { bremsen: true, n, grund: `Kunde schreibt zum ${n}. Mal in 7 Tagen – bitte ein Mensch (E-531 Schleifen-Bremse: schon ${auto} automatische Antworten an diese Adresse)` };
}

/**
 * E-531 Nachbesserung (Gutachten Kundensicherheit): Bestätigt die Antwort, was ein Werkzeug GERADE gebucht oder gefunden hat
 * — und sonst bestätigt es niemand? Dann bremst die Schleife nicht (die Zeit-Wand gilt weiter): Storno einer unbezahlten
 * Bestellung, sofort beendeter Vertrag, eine neue Kündigung ohne Hausbestätigung (fiaon-kuendigung-nachholen bestätigt nur
 * mit offenen Raten), die gemeldete Zahlung im Bankbuch gefunden. Rein.
 */
export function e531NurBestaetigung(werkzeugDaten: Record<string, any> | null | undefined): boolean {
  return e531BestaetigungsArt(werkzeugDaten) !== null;
}

/** E-531 Abnahme (senden#2): welche Ausnahme von der Schleifen-Bremse trägt die Antwort? */
export type E531Ausnahme = "kuendigung" | "zahlung";

/**
 * E-531 Abnahme (senden#2): Die Art der Bestätigung (wie e531NurBestaetigung). „kuendigung“ = ein Storno oder Vertragsende,
 * das ein Werkzeug GERADE gebucht hat (geschieht je Vertrag einmal); „zahlung“ = zahlung_suchen fand seinen Eingang (kann
 * sich bei jeder Mail wiederholen — darum zählt e531AusnahmeGilt mit). Rein.
 */
export function e531BestaetigungsArt(werkzeugDaten: Record<string, any> | null | undefined): E531Ausnahme | null {
  const k = werkzeugDaten?.kuendigung_vormerken;
  if (k && typeof k === "object") {
    const weg = String(k.weg ?? "");
    const neu = ["storno_unbezahlt", "sofort_beendet", "kulanz_sofort", "letzte_rate", "laufzeit_ende"].includes(weg)
      || (weg === "bereits" && k.in_diesem_vorgang_vorgemerkt === true);
    if (neu && k.bestaetigung_gesendet !== true) return "kuendigung";
  }
  const z = werkzeugDaten?.zahlung_suchen;
  if (z && typeof z === "object" && ["gebucht", "unterwegs", "gefunden"].includes(String(z.art ?? ""))
    && !(Array.isArray(z.ohneEingang) && z.ohneEingang.length)) return "zahlung";
  return null;
}

/**
 * E-531 Abnahme (senden#2): Gilt die Ausnahme hier? Kündigung: ja (ein Ereignis). Zahlungsfund: höchstens EINMAL je Adresse
 * in 7 Tagen — nur, wenn noch keine Auto-Antwort an sie einen Zahlungsfund trug. Sonst bestätigte Mara denselben Fund Tag
 * für Tag („Warum noch Mahnung?“), während die Karte „Geld eingegangen“ auf einen Klick wartet. Unbekannte Zahl: nein. Rein.
 */
export function e531AusnahmeGilt(art: E531Ausnahme | null | undefined, z: { zahlungFunde7Tage?: number | null } | null | undefined): boolean {
  if (art === "kuendigung") return true;
  if (art !== "zahlung") return false;
  const n = Number(z?.zahlungFunde7Tage);
  return Number.isFinite(n) && n <= 0;
}

/**
 * Dasselbe für das Nachholen eines gescheiterten Versands — dort stehen nur die Handlungen der Zeile (Werkzeug, Ergebnis).
 * Grob und vorsichtig: ein gebuchter Storno bzw. ein beendeter Vertrag (Satz aus kuendigungSatz). Rein.
 */
export function e531NurBestaetigungAusHandlungen(handlungen: unknown): boolean {
  const liste = Array.isArray(handlungen) ? handlungen : [];
  return liste.some((h: any) => {
    const t = String(h?.ergebnis ?? "");
    return !!h && h.ok !== false && String(h.werkzeug ?? "") === "kuendigung_vormerken" && !/lag bereits vor/i.test(t)
      && /Bestellung wurde storniert|Vertrag ist beendet|offene Raten entfallen|Raten für die Zeit danach entfallen/i.test(t);
  });
}

/** E-531 Nachbesserung: ein Entwurf, den die Schleifen-Bremse angehalten hat (Begründung der Sendewand). Rein. */
export function e531SchleifenEntwurf(begruendung: string | null | undefined): boolean {
  return /\(E-531 Schleifen-Bremse|^Schleifen-Bremse nicht prüfbar/.test(String(begruendung ?? ""));
}

/** E-531 Abnahme (senden#1): der Grund, wenn der Fall-Akte eine Quelle fehlt — Entwurf + Karte statt Versand. */
export const E531_AKTE_UNVOLLSTAENDIG = "Fall-Akte unvollständig – nicht automatisch gesendet (E-531)";

/**
 * E-531 Abnahme (senden#1): Fehlt der Fall-Akte eine Quelle (Gmail-Faden, js@, Team-Postfach, Datenbank, Zeitbudget), geht
 * nichts automatisch hinaus — sonst widerspräche Mara einem Brief, den sie nur nicht lesen konnte (genau der Fall des
 * Audits). Ein bewusst nicht gelesenes js@ (kein bekannter Kunde) steht nicht in `lesefehler`. Rein.
 * E-531 Gegenprüfung (akte#1): ebenso, wenn im Faden ein Brief von uns an eine andere externe Adresse steht (er fehlt in
 * der Akte, fiaon-fall-akte.ts E531_FREMD_ADRESSIERT).
 */
export function e531AkteWand(lesefehler: readonly (string | null | undefined)[] | null | undefined): { grund: string; mangel: string } | null {
  const l = (lesefehler ?? []).map((x) => String(x ?? "").trim()).filter(Boolean);
  if (!l.length) return null;
  return {
    grund: E531_AKTE_UNVOLLSTAENDIG,
    mangel: `E-531 Fall-Akte unvollständig (${l.join(", ").slice(0, 160)}) — vor dem Senden selbst nachsehen, was wir ihm geschrieben haben`,
  };
}

/** Ein Entwurf der Sendewand (Schleife, Zeit-Zusage oder unvollständige Fall-Akte) — je Adresse soll nur EINER offen sein. Rein. */
export function e531WandEntwurf(begruendung: string | null | undefined): boolean {
  const b = String(begruendung ?? "");
  return e531SchleifenEntwurf(b) || /^Zeit-Zusage im Text ohne Kalendertermin/.test(b) || b.startsWith(E531_AKTE_UNVOLLSTAENDIG);
}

/**
 * E-531 Nachbesserung (Gutachten Kosten): Hält die Schleifen-Bremse für diese Zeile noch an? Für die 24-Stunden-Regel
 * (fiaon-postmeister-frist.ts): Solange sie bremst, wird der Entwurf NICHT neu geschrieben — ein voller KI-Lauf, der
 * wieder gebremst würde, nur mit neuem Entwurf und springender Karte. Lässt sie nach (die alten Auto-Antworten fallen aus
 * den 7 Tagen), schreibt die Regel wie sonst neu. Im Zweifel (nicht lesbar): bremst noch — der nächste Lauf prüft wieder.
 */
export async function schleifeBremstNoch(id: number): Promise<boolean> {
  try {
    const [z] = (await sqlPool`SELECT von FROM fiaon_postmeister WHERE id = ${Number(id)}`) as any[];
    const adresse = fallAdresse(z?.von ?? "");
    if (!adresse) return false;
    return schleifenBremseUrteil(await schleifeZaehlen(Number(id), [adresse])).bremsen;
  } catch (e) {
    console.warn("[POSTMEISTER] Schleifen-Bremse (24-Stunden-Regel) nicht prüfbar:", String((e as any)?.message || e).slice(0, 160));
    return true;
  }
}

/** E-531 Abnahme (senden#4): ältere Wand-Entwürfe nur bis so weit vor der neuen Mail ablegen. */
export const E531_ABLAGE_FENSTER_MS = 7 * 86_400_000;
/** So weit zurück sieht die neue Antwort Mails derselben Person aus ANDEREN Fäden (nachbarMails: drei Tage). */
const NACHBAR_FENSTER_MS = 3 * 86_400_000;

/** E-531 Abnahme (senden#0): die Begründung der Ablage — ihr Kopf steht im Muster des Rückstands-Takts (MENSCH_ERLEDIGT_MUSTER). Rein. */
export function e531AblageBegruendung(neueMailId: number): string {
  return `${E531_ABLAGE_KOPF}: Seine neuere Mail #${Number(neueMailId)} trägt den Fall — je Adresse nur ein offener Entwurf`;
}

/**
 * E-531 Abnahme (Gegenprüfung senden#4): Darf dieser ältere Entwurf abgelegt werden? Nur ein Wand-Entwurf, nur höchstens
 * 7 Tage vor der neuen Mail — und nur, wenn die neue Antwort ihn kannte: derselbe Gmail-Faden (er steht in ihrer
 * Fall-Akte) oder dieselbe bekannte Person mit der alten Mail in den letzten drei Tagen (Nachbar-Mail). Sonst bliebe ein
 * anderes Anliegen in einem anderen Faden ohne Antwort; dann entscheidet wie bisher die 24-Stunden-Regel. Rein.
 * E-531 Gegenprüfung (B13): Aus einem ANDEREN Faden nur, wenn nachbarMails genau diese Zeile in den Auftrag gegeben hat
 * (ihre ID steht in `nachbarIds`) — bei Vielschreibern fehlen ältere Zeilen dort. Ohne IDs (Nachholen: welche Nachbarn der
 * gespeicherte Text sah, ist unbekannt) nie.
 */
export function e531AblageErlaubt(
  alt: { id?: number | null; begruendung: string | null | undefined; am: number; threadId: string | null | undefined; personId: number | null | undefined },
  neu: { am: number; threadId: string | null | undefined; personId: number | null | undefined; jetzt?: number; nachbarIds?: readonly number[] | null },
): boolean {
  if (!e531WandEntwurf(alt.begruendung)) return false;
  if (!Number.isFinite(alt.am) || !Number.isFinite(neu.am) || alt.am >= neu.am || neu.am - alt.am > E531_ABLAGE_FENSTER_MS) return false;
  const fadenAlt = String(alt.threadId ?? "").trim();
  if (fadenAlt && fadenAlt === String(neu.threadId ?? "").trim()) return true;
  const altId = alt.id == null ? NaN : Number(alt.id);
  const imAuftrag = Number.isFinite(altId) && altId > 0 && (neu.nachbarIds ?? []).some((x) => Number(x) === altId);
  if (!imAuftrag) return false;
  const jetzt = Number.isFinite(Number(neu.jetzt)) ? Number(neu.jetzt) : Date.now();
  return neu.personId != null && alt.personId != null && Number(alt.personId) === Number(neu.personId) && jetzt - alt.am <= NACHBAR_FENSTER_MS;
}

/** Gmail-Ordner umhängen: „Entwurf wartet“ → „Nicht mehr nötig“ (wie die 24-Stunden-Regel). Nur Ablage — scheitert es, bleibt alles andere. */
async function ordnerNichtMehrNoetig(postfach: string, gmailId: string): Promise<void> {
  try {
    const alt = await labelSicherstellen(postfach, "FIAON/Entwurf wartet");
    await ablegen(postfach, gmailId, "FIAON/Nicht mehr nötig", [alt]);
  } catch (e) {
    console.warn(`[POSTMEISTER] E-531: Ordner für ${postfach}/${gmailId} nicht umgehängt:`, String((e as any)?.message || e).slice(0, 120));
  }
}

/**
 * E-531 Nachbesserung (Gutachten Kosten): je Adresse nur EIN offener Entwurf der Sendewand. Kommt eine neuere Mail derselben
 * Adresse als Entwurf dazu, werden ihre ÄLTEREN Wand-Entwürfe sofort abgelegt — Übergabe zu, Zeile „geordnet“ mit Verweis
 * auf die neue Mail. Genau das täte die 24-Stunden-Regel einen Tag später („Kunde schrieb danach“); die Karten schließen
 * sich beim nächsten Sammeln. Wirft nie; liefert, wie viele abgelegt wurden.
 * E-531 Abnahme (Gegenprüfung senden#4):
 *   · nur die ECHTE Absenderadresse der neuen Mail (nie Antwort-an) und nur mit bestandener Absender-Prüfung;
 *   · höchstens 7 Tage zurück, nur Entwürfe, die die neue Antwort kannte (e531AblageErlaubt);
 *   · das UPDATE prüft die Begründung noch einmal (hat sie sich seit dem Lesen geändert, bleibt die Zeile);
 *   · der Gmail-Entwurf wird nur gelöscht, wenn er noch genau Maras Text trägt (drafts.get) — hat ein Mensch ihn in Gmail
 *     bearbeitet (oder ist er nicht prüfbar), bleibt er stehen; nur die Zeile wird abgelegt. Ordner „FIAON/Nicht mehr nötig“.
 * E-531 Gegenprüfung (hoch, B13):
 *   · `von` ist der ganze Von-Kopf; die Adresse daraus mit absenderAdresse — dieselbe (letzte „<…>“-Gruppe), die
 *     absenderEcht geprüft hat. Ein mehrdeutiger Von-Kopf (absenderEindeutig) legt nichts ab.
 *   · aus anderen Fäden nur Zeilen, die nachbarMails dieser Antwort mitgab (`nachbarIds`); ohne IDs nur derselbe Faden.
 */
async function e531AeltereAblegen(ein: {
  id: number; von: string; threadId: string | null; personId: number | null; mailAm: Date | null; absenderGeprueft: boolean;
  nachbarIds?: readonly number[] | null;
}): Promise<number> {
  const adresse = absenderAdresse(ein.von);
  if (!ein.absenderGeprueft || !absenderEindeutig(ein.von) || !adresse.includes("@") || adresse.endsWith("@fiaon.com")) return 0;
  try {
    const bis = ein.mailAm instanceof Date && Number.isFinite(ein.mailAm.getTime()) ? ein.mailAm : new Date();
    const kandidaten = (await sqlPool`
      SELECT id, begruendung, thread_id, person_id, COALESCE(empfangen_am, created_at) AS am FROM fiaon_postmeister
       WHERE id <> ${ein.id} AND aktion = 'entwurf' AND gesendet_am IS NULL
         AND COALESCE(empfangen_am, created_at) < ${bis}
         AND COALESCE(empfangen_am, created_at) > ${new Date(bis.getTime() - E531_ABLAGE_FENSTER_MS)}
         AND LOWER(TRIM(COALESCE(substring(von from '<([^>]+)>'), von, ''))) = ${adresse}
       ORDER BY id ASC LIMIT 50`) as any[];
    const neu = { am: bis.getTime(), threadId: ein.threadId, personId: ein.personId, nachbarIds: ein.nachbarIds ?? null };
    const passend = kandidaten.filter((k) => e531AblageErlaubt(
      { id: Number(k.id), begruendung: k.begruendung ?? null, am: k.am ? new Date(k.am).getTime() : NaN, threadId: k.thread_id ?? null, personId: k.person_id ?? null }, neu));
    let n = 0;
    for (const k of passend) {
      const [r] = (await sqlPool`
        UPDATE fiaon_postmeister SET aktion = 'geordnet', naechster_versuch_am = NULL, updated_at = NOW(),
               begruendung = ${e531AblageBegruendung(ein.id)}
         WHERE id = ${Number(k.id)} AND aktion = 'entwurf' AND gesendet_am IS NULL AND begruendung = ${String(k.begruendung)}
        RETURNING id, postfach, gmail_id, antwort_draft_id, antwort, person_id, ref`) as any[];
      if (!r) continue;
      n += 1;
      let entwurfWeg = !r.antwort_draft_id;
      if (r.antwort_draft_id) {
        const imEntwurf = await entwurfTextLesen(String(r.postfach), String(r.antwort_draft_id)).catch(() => null);
        if (imEntwurf != null && entwurfUnveraendert(r.antwort, imEntwurf)) {
          const { entwurfLoeschen } = await import("./fiaon-gmail");
          entwurfWeg = await entwurfLoeschen(String(r.postfach), String(r.antwort_draft_id)).then(() => true, () => false);
          if (entwurfWeg) {
            await sqlPool`UPDATE fiaon_postmeister SET antwort_draft_id = NULL WHERE id = ${Number(r.id)} AND antwort_draft_id = ${String(r.antwort_draft_id)}`.catch(() => {});
          }
        } else {
          console.warn(`[POSTMEISTER] E-531: Gmail-Entwurf zu Mail #${Number(r.id)} bleibt stehen (in Gmail geändert oder nicht prüfbar) — nur die Zeile ist abgelegt.`);
        }
      }
      // Der Ordner folgt dem Entwurf: Steht er noch in Gmail, bleibt „Entwurf wartet“.
      if (entwurfWeg && r.gmail_id) await ordnerNichtMehrNoetig(String(r.postfach), String(r.gmail_id));
      await uebergabeSchliessen({ id: Number(r.id), personId: r.person_id ?? null, ref: r.ref ?? null }, "Mara (automatisch)",
        `Nicht mehr nötig: neuere Mail #${ein.id} derselben Adresse trägt den Fall (E-531), Mail #${Number(r.id)}.`, { abgelegt: true }).catch(() => false);
    }
    if (n) console.log(`[POSTMEISTER] E-531: ${n} ältere Wand-Entwürfe derselben Adresse abgelegt (neue Mail #${ein.id}).`);
    return n;
  } catch (e) {
    console.warn("[POSTMEISTER] E-531 ältere Entwürfe ablegen:", String((e as any)?.message || e).slice(0, 160));
    return 0;
  }
}

/**
 * Automatische Antworten der letzten 7 Tage an diese Adressen und seine Mails in derselben Zeit (ohne diese Zeile).
 * E-531 Abnahme (senden#2): dazu, wie viele dieser Auto-Antworten einen Zahlungsfund trugen (Handlung „zahlung_suchen: …“
 * ohne „kein passender Eingang“) — die Zahlungs-Ausnahme gilt nur, solange es keine gab.
 */
async function schleifeZaehlen(id: number, adressen: string[]): Promise<{ autoAntworten7Tage: number; kundenMails7Tage: number; zahlungFunde7Tage: number }> {
  const liste = Array.from(new Set(adressen.map((a) => String(a || "").trim().toLowerCase()).filter((a) => a.includes("@"))));
  if (!liste.length) return { autoAntworten7Tage: 0, kundenMails7Tage: 1, zahlungFunde7Tage: 0 };
  const [z] = (await sqlPool`
    SELECT COUNT(*) FILTER (WHERE aktion = 'auto_beantwortet' AND gesendet_am > NOW() - INTERVAL '7 days')::int AS auto,
           COUNT(*) FILTER (WHERE aktion = 'auto_beantwortet' AND gesendet_am > NOW() - INTERVAL '7 days'
                              AND COALESCE(handlungen::text, '') ~ 'zahlung_suchen: (?!kein passender Eingang)')::int AS zahlung_funde,
           COUNT(*) FILTER (WHERE COALESCE(empfangen_am, created_at) > NOW() - INTERVAL '7 days' AND aktion <> 'ignoriert'
                              AND NOT (aktion = 'geordnet' AND (COALESCE(begruendung, '') LIKE 'Doppel von Mail #%'
                                                             OR COALESCE(begruendung, '') LIKE 'Dieselbe Mail liegt auch in%')))::int AS mails
      FROM fiaon_postmeister
     WHERE id <> ${id}
       AND (gesendet_am > NOW() - INTERVAL '8 days' OR COALESCE(empfangen_am, created_at) > NOW() - INTERVAL '8 days')
       AND LOWER(TRIM(COALESCE(substring(von from '<([^>]+)>'), von, ''))) = ANY(${liste}::text[])`) as any[];
  return { autoAntworten7Tage: Number(z?.auto ?? 0), kundenMails7Tage: Number(z?.mails ?? 0) + 1, zahlungFunde7Tage: Number(z?.zahlung_funde ?? NaN) };
}

/**
 * E-531: DIE SENDEWAND vor JEDEM automatischen Versand einer Postmeister-Antwort (erster Versand und Nachholen).
 * null = darf raus; sonst der Grund (Entwurf + Karte) und bei einer Zeit-Zusage der Mangel für die Karte. Wirft nie:
 * Ist die Schleife nicht zählbar, hält die Wand an — im Zweifel ein Mensch, nie im Zweifel senden.
 */
export async function e531Sendewand(ein: {
  id: number; text: string; personId: number | null; adressen: string[]; kalender?: (string | null | undefined)[];
  /**
   * E-531 Nachbesserung: die Antwort bestätigt, was ein Werkzeug gerade gebucht/gefunden hat und sonst niemand bestätigt
   * (e531BestaetigungsArt). E-531 Abnahme (senden#2): „kuendigung“ = keine Schleifen-Bremse; „zahlung“ = nur, wenn an diese
   * Adresse in 7 Tagen noch keine Auto-Antwort einen Zahlungsfund trug (e531AusnahmeGilt). Die Zeit-Wand gilt immer.
   */
  ausnahme?: E531Ausnahme | null;
}): Promise<{ grund: string; mangel: string | null } | null> {
  const kalender: (string | null | undefined)[] = (ein.kalender ?? []).slice();
  if (ein.personId) {
    const termin = await bestehenderTermin(Number(ein.personId)).catch(() => null);
    if (termin?.kundenText) kalender.push(termin.kundenText);
  }
  const zeit = maraZeitZusage(ein.text, { kalender });
  if (zeit.length) {
    return {
      grund: "Zeit-Zusage im Text ohne Kalendertermin — nicht automatisch gesendet (E-531)",
      mangel: `E-531 Zeit-Zusage: „${zeit[0].satz.slice(0, 140)}“ — ohne Zeit und ohne Namen schreiben („${E531_UEBERGABE_SATZ}“)`,
    };
  }
  if (ein.ausnahme === "kuendigung") return null;
  try {
    const z = await schleifeZaehlen(ein.id, ein.adressen);
    const u = schleifenBremseUrteil(z);
    if (!u.bremsen || e531AusnahmeGilt(ein.ausnahme, z)) return null;
    return { grund: String(u.grund), mangel: null };
  } catch (e) {
    console.warn("[POSTMEISTER] Schleifen-Bremse nicht prüfbar:", String((e as any)?.message || e).slice(0, 160));
    return { grund: "Schleifen-Bremse nicht prüfbar — bitte ein Mensch (E-531)", mangel: null };
  }
}

export interface LaufErgebnis {
  aktion: Aktion; grund: string; id: number | null;
  /**
   * E-401: Die Mail wartet nur einen Takt (Bündeln, E-369) — sie ist NICHT verarbeitet. Der Nachhol-Lauf nach der
   * KI-Pause zählte sie mit und drehte deshalb 20 Runden in zwei Minuten über dieselbe Mail (#7110, 19.10.).
   */
  wartet?: boolean;
}

/**
 * Eine Mail verarbeiten. `nurOrdnen` schreibt keine Antwort — für den ersten
 * Durchgang über den Altbestand.
 */
export async function mailBearbeiten(ein: {
  postfach: string; gmailId: string; gruss: string;
  modus: "auto" | "hybrid" | "entwurf" | "aus";
  nurOrdnen?: boolean;
  /**
   * E-406 B3: Der zweite Anlauf der 24-Stunden-Regel (fiaon-postmeister-frist.ts). Steht „Mails beantworten“ auf
   * Gelb, sendet Mara erst hier — vorher wartete die Antwort 24 Stunden als Entwurf in „Mara heute“.
   */
  ampelFrist?: boolean;
}): Promise<LaufErgebnis> {
  await postmeisterSchema();
  const { postfach, gmailId } = ein;

  // ── DIE WAND (09.09.2026, E-171) ────────────────────────────────────────
  // Mara fasst NUR die Postfächer an, die in fiaon-postmeister-postfaecher.ts
  // stehen. Vorher reichte ein Aufruf mit einer beliebigen Adresse — der
  // Aufhol-Lauf trug seine Postfachliste als festen Text und der
  // Antwort-Lauf zog sie aus alten Zeilen der Datenbank. So schrieb sie in
  // Justins persönlichem Postfach. Diese Prüfung steht VOR dem ersten
  // Gmail-Aufruf: Ein nicht bedientes Postfach wird nicht einmal gelesen.
  if (!wirdBedient(postfach)) {
    console.warn(`[POSTMEISTER] Postfach „${postfach}" wird nicht bedient — übersprungen.`);
    return { aktion: "geordnet", grund: `Postfach ${postfach} wird nicht bedient`, id: null };
  }

  // ── KI-PAUSE (27.09.2026, E-246) ────────────────────────────────────────
  // Pausiert: die Mail nicht einmal beanspruchen — sie bleibt, wie sie ist,
  // und der Takt nimmt sie nach dem Aktivieren (postmeisterNachDerPause).
  if (await kiPausiert()) return { aktion: "geordnet", grund: "KI pausiert", id: null };

  // Anspruch — läuft der Takt doppelt, arbeitet nur einer.
  // 11.09.2026 (E-184): Eine 'fehler'-Zeile wird erst wieder beansprucht, wenn
  // ihre Wiedervorlage (naechster_versuch_am) fällig ist — vorher kam sie in
  // JEDEM 5-Minuten-Takt erneut dran, vier KI-Läufe in 20 Minuten. Ein
  // 'in_arbeit' älter als 15 Minuten ist ein abgebrochener Lauf (Neustart).
  let anspruch = (await sqlPool`
    INSERT INTO fiaon_postmeister (postfach, gmail_id, thread_id, aktion, in_arbeit_seit)
    VALUES (${postfach}, ${gmailId}, '', 'in_arbeit', NOW())
    ON CONFLICT (gmail_id) DO NOTHING RETURNING id, versuche, gesendet_am, begruendung, created_at, einordnung_merker, akte_vermerk_am
  `) as any[];
  if (!anspruch.length) {
    anspruch = (await sqlPool`
      UPDATE fiaon_postmeister SET aktion = 'in_arbeit', in_arbeit_seit = NOW(), versuche = versuche + 1, updated_at = NOW()
       WHERE gmail_id = ${gmailId}
         AND (aktion = 'vorgeordnet'
              OR (aktion = 'fehler' AND (naechster_versuch_am IS NULL OR naechster_versuch_am <= NOW()))
              OR (aktion = 'in_arbeit' AND COALESCE(in_arbeit_seit, updated_at) < NOW() - INTERVAL '15 minutes'))
         AND versuche < 3
       RETURNING id, versuche, gesendet_am, begruendung, created_at, einordnung_merker, akte_vermerk_am
    `) as any[];
    if (!anspruch.length) return { aktion: "geordnet", grund: "schon bearbeitet", id: null };
  }
  const id = Number(anspruch[0].id);
  /** E-246: Beim Zurücklegen in der Pause wird der Zähler auf den Stand vor diesem Anspruch gebracht. */
  const neuAngelegt = Number(anspruch[0].versuche ?? 0) === 0; // frisch angelegt: 0, erneut beansprucht: alter Wert + 1
  // E-401 (6/6, 19.10.2026): Eine Zeile, die ab heute NEU entsteht, trägt den Merker der 24-Stunden-Regel (frist_ab). Nur
  // solche Entwürfe darf Mara nach 24 Stunden neu schreiben und senden (fiaon-postmeister-frist.ts); der Altbestand ohne
  // Merker wird nie automatisch gesendet. Eigene Anweisung mit .catch: Fehlt die Spalte, bleibt die Zeile Altbestand.
  if (neuAngelegt) await sqlPool`UPDATE fiaon_postmeister SET frist_ab = NOW() WHERE id = ${id} AND frist_ab IS NULL`.catch(() => {});
  /** Bisherige Anläufe (0 beim ersten) — der laufende ist Nummer versuche + 1. */
  const versuche = Number(anspruch[0].versuche ?? 0);
  /** E-246 (Nachprüfung 27.09.): Diese Mail lag aus der KI-Pause — ein früherer Anlauf kann den Aktenvermerk schon geschrieben haben. */
  const ausDerPause = /^KI pausiert/.test(String(anspruch[0].begruendung ?? ""));
  const zeileSeit: Date = anspruch[0].created_at ? new Date(anspruch[0].created_at) : new Date();

  const fertig = async (felder: Record<string, unknown>, grund: string): Promise<LaufErgebnis> => {
    await sqlPool`
      UPDATE fiaon_postmeister SET ${sqlPool(felder as any)}, in_arbeit_seit = NULL, updated_at = NOW() WHERE id = ${id}
    `.catch((e) => console.error("[POSTMEISTER] speichern:", String(e).slice(0, 160)));
    return { aktion: String(felder.aktion) as Aktion, grund, id };
  };

  // ── NIE ZWEIMAL SENDEN (E-184) ────────────────────────────────────────
  // Ein wiederaufgenommener Lauf trifft eine Zeile, deren Antwort schon
  // draußen ist (gesendet_am gesetzt, aber der Abschluss kam nicht mehr):
  // nichts erzeugen, nichts senden — nur den Zustand geradeziehen.
  if (anspruch[0].gesendet_am) {
    return fertig({ aktion: "auto_beantwortet", begruendung: "Antwort war schon gesendet — Wiederaufnahme ohne zweiten Versand (E-184)" }, "schon gesendet");
  }

  // ── KI-FEHLER MIT ZEITPLAN (E-184) ────────────────────────────────────
  // Wer schreibt und worum es geht, merkt sich der Lauf für die Aufgabe, die
  // nach dem vierten Fehlversuch an einen Menschen geht. Vorher blieb die
  // Zeile mit versuche=3 stumm auf 'fehler' stehen — kein Vermerk, keine Aufgabe.
  let fuerAufgabe: { personId: number | null; ref: string | null; betreff: string } = { personId: null, ref: null, betreff: "" };
  const fehlerFelder = async (grund: string): Promise<Record<string, unknown>> => {
    const fehlversuch = versuche + 1;
    const naechster = WIEDERVORLAGE_MS[fehlversuch] ? new Date(Date.now() + WIEDERVORLAGE_MS[fehlversuch]) : null;
    if (naechster) {
      await akteVermerk(fuerAufgabe.ref, fuerAufgabe.personId, `Antwort NICHT erzeugt (Versuch ${fehlversuch}/4, nächster gegen ${uhrzeitBerlin(naechster)}): ${grund}`);
    } else {
      await akteVermerk(fuerAufgabe.ref, fuerAufgabe.personId, `Antwort endgültig nicht erzeugt nach 4 Versuchen: ${grund}`);
      await aufgabeNachAufgabe({ id, postfach, betreff: fuerAufgabe.betreff, grund, personId: fuerAufgabe.personId, ref: fuerAufgabe.ref, art: "ki-fehler" });
    }
    return { aktion: "fehler", begruendung: grund.slice(0, 400), naechster_versuch_am: naechster };
  };

  try {
    const mail = await nachrichtLesen(postfach, gmailId);
    fuerAufgabe.betreff = mail.betreff;
    const neuerText = ohneZitat(mail.text) || mail.snippet || "";
    const basis = {
      thread_id: mail.threadId, von: mail.von, betreff: mail.betreff, empfangen_am: mail.datum,
      text: neuerText.slice(0, 12_000), message_id: mail.messageIdHeader,
      anhaenge_eingang: mail.anhaenge.length ? JSON.stringify(mail.anhaenge) : null,
    };
    // 04.09.2026 (E-115): Dateien an der Mail. Mara kann sie nicht öffnen, aber
    // sie muss wissen, dass sie da sind — ein Mensch sähe den Beleg auch.
    // E-275 (02.10.2026, Justin: „Mara soll selbstständig arbeiten“): Vorher hieß es hier „leg eine Aufgabe an, die
    // Datei zu prüfen … an den Betreuer" — drei Bilder „Account“ ergaben drei Aufgaben „Nikita Boychenko prüft das
    // Bild" (#6075–#6077). Jetzt bestätigt Mara den Eingang selbst und notiert ihn still; nur ein Zahlungsbeleg geht
    // als Aufgabe an die Zahlungsstelle (nur sie sieht das Bankbuch).
    const anhangHinweis = mail.anhaenge.length
      ? `\n\n[Der Kunde hat ${mail.anhaenge.length} Datei(en) mitgeschickt: ${mail.anhaenge.map((a) => `${a.name} (${a.typ}, ${Math.max(1, Math.round(a.groesse / 1024))} KB)`).join("; ")}. Du kannst sie nicht öffnen; das Team sieht sie im Portal. Bestätige dem Kunden den Eingang SELBST und sag, wie es weitergeht (Unterlagen fließen in seine Bonitätsanalyse). Halte sie still fest mit notiz_an_betreuer — keine Aufgabe, kein „Herr X prüft das". Nur ein Zahlungsbeleg geht als Aufgabe an die Zahlungsstelle (aufgabe_an_betreuer, kollege: "Zahlung").]`
      : "";
    // E-275: Mail ohne eigenen Text (nur „Sent from …“, nur ein Bild) — sein Anliegen steht oft im Betreff (#6120:
    // Betreff „I have not your kaditkarte“, Text „Sent from Yahoo Mail for iPhone“). Das Modell soll es dort lesen.
    const { hatEigenenText: eigenerTextDa, eigenerBetreff: betreffEigen } = await import("./fiaon-postmeister-werkzeuge");
    const ohneTextHinweis = !eigenerTextDa(neuerText) && betreffEigen(mail.betreff)
      // Beginnt wie der Anhang-Hinweis mit „[Der Kunde hat “ — dort schneiden kundeTextOhneAnhang und eigenerKundentext ab,
      // damit der Hinweis nie als SEIN Text gelesen wird (Riegel, Werbesperre, Kündigungswille).
      ? `\n\n[Der Kunde hat keinen eigenen Text geschrieben (nur Signatur oder Anhang). Sein Anliegen steht im Betreff: „${betreffEigen(mail.betreff).slice(0, 200)}“ — beantworte DAS. Eine Mail ohne eigenen Text ist nie eine Bitte um weniger Post.]`
      : "";
    const textFuerMara = neuerText + anhangHinweis + ohneTextHinweis;

    // 0. E-246: Eine in der KI-Pause zurückgelegte Mail wird unabhängig vom
    //    Suchfenster wieder beansprucht (postmeisterLauf). Hat ein Mensch sie
    //    inzwischen aus dem Posteingang genommen, ist sie erledigt — nicht
    //    beantworten (Alarmtext: „von Hand beantworten UND archivieren").
    if (ausDerPause && !mail.labelIds.includes("INBOX")) {
      return fertig({ ...basis, aktion: "geordnet", begruendung: "nach der KI-Pause nicht mehr im Posteingang — von Hand erledigt" }, "von Hand erledigt");
    }

    // 0b. E-350 (14.10.2026): Kundin eines FIRMENANGEBOTS (E-301) — Mara antwortet nie, nicht einmal mit Entwurf
    //     oder Werkzeug. Justin (ULRIKA'S): „wenn sie arbeitet darf Mara nicht automatisiert antworten bei ihr“.
    //     Erkannt am Absender (Adresse oder Firmen-Domäne, auch Antwort-an) — das Angebot hat keine Person, die
    //     Global-Regel unten (istGlobalKunde) sähe sie nicht. Die Mail bleibt ungelesen im Posteingang, Justin bekommt
    //     eine Aufgabe. Stört die Prüfung, wirft sie: die Zeile geht auf „fehler“ und wird später neu geprüft — nie
    //     „im Zweifel antworten“.
    {
      const { firmaKundinAbsender } = await import("./fiaon-global-firma-post");
      const antwortAn = String(mail.antwortAn?.match(/<([^>]+)>/)?.[1] ?? mail.antwortAn ?? "");
      const firmaKundin = (await firmaKundinAbsender(String(mail.vonAdresse || ""))) || (!!antwortAn && await firmaKundinAbsender(antwortAn));
      if (firmaKundin) {
        await ablegen(postfach, gmailId, "FIAON/Global von Hand");
        try {
          const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
          const a = await auftragFuerKunden({
            personId: null, ref: null, anBetreiber: true, dringend: true,
            titel: `Firmenkundin schreibt: „${String(mail.betreff || "(ohne Betreff)").slice(0, 100)}“`,
            text: `Postfach ${postfach}, von ${mail.von}. Kundin eines Firmenangebots (E-301) — Mara antwortet ihr NICHT (E-350). Bitte von Hand antworten; die Mail liegt ungelesen im Posteingang (Ordner „FIAON/Global von Hand“).`,
            schluessel: `postmeister:${id}:firma`, quelle: "postmeister", autorName: "Mara", link: "/chef/s/postmeister",
          });
          await wiederOffenBereinigen(a.id);
        } catch (e) {
          console.error("[POSTMEISTER] Aufgabe Firmenkundin:", String(e).slice(0, 160));
        }
        return fertig({ ...basis, kategorie: "intern", aktion: "ignoriert", begruendung: "Firmenangebot (E-350): keine automatische Antwort — Justin antwortet von Hand" }, "Firmenkundin");
      }
    }

    // 0c. E-476 Scheibe 3 (05.11.2026, Entscheidung 2A): Ein offener BUSINESS-LEAD (Global-Anfrage der letzten 60 Tage oder
    //     ein Lead-Gespräch) bekommt keine Mara-Antwort, auch keinen Entwurf — dem Lead schreibt Justin aus js@. Die Mail
    //     bleibt ungelesen (Ordner „FIAON/Global-Lead“), das Cockpit bekommt eine Zeile, Justin eine kurze Mail im Faden
    //     des Leads (keine Aufgabe). AUSNAHME (Gutachten 0, Mangel 7; Gutachten 1, Mangel 1): Hat der Absender eine
    //     BEZAHLTE Privat-Bestellung, antwortet Mara wie bisher — ihre Fragen zu Karte, Zahlung oder Kündigung bleiben nie
    //     liegen. Stört die Prüfung, wirft sie (Muster 0b): die Zeile geht auf „fehler“, nie „im Zweifel antworten“.
    {
      const { globalLeadAbsender, leadAntwortVermerken } = await import("./fiaon-lead-weg");
      const antwortAn = String(mail.antwortAn?.match(/<([^>]+)>/)?.[1] ?? mail.antwortAn ?? "");
      const lead = (await globalLeadAbsender(String(mail.vonAdresse || ""))) || (antwortAn ? await globalLeadAbsender(antwortAn) : null);
      if (lead) {
        await ablegen(postfach, gmailId, "FIAON/Global-Lead");
        await leadAntwortVermerken(lead, { postfach, betreff: String(mail.betreff || "(ohne Betreff)"), auszug: neuerText || mail.snippet || "", von: String(mail.von || "") });
        return fertig({ ...basis, kategorie: "intern", aktion: "ignoriert", begruendung: "Business-Lead (E-476): keine Mara-Antwort — Justin antwortet aus js@" }, "Global-Lead");
      }
    }

    // 1. Fremdpost — eigener Ordner, nie beantworten.
    // ── UNGELESEN BLEIBT UNGELESEN (09.09.2026, E-171) ──────────────────
    // Justin: „ALLE Emails die hinein kommen und NICHT Support sind, müssen
    // irgendwie gekennzeichnet werden bzw. nicht auf ‚geöffnet‘."
    // Vorher nahm Mara hier „UNREAD" weg. Was sie falsch einsortierte, war
    // damit unsichtbar: Am 09.09. lag „Re: 550.000 € — Ihre Untergrenze
    // schließt unsere Runde allein" von Freigeist Capital als „automatische
    // Nachricht" gelesen im Postfach. Der Ordner kennzeichnet die Mail; das
    // Auge entscheidet ein Mensch.
    const fremd = istFremdpost(mail, await absenderIstKunde(String(mail.vonAdresse || "")));
    if (fremd.fremd) {
      await ablegen(postfach, gmailId, "FIAON/Kein Kunde");
      return fertig({ ...basis, kategorie: "intern", aktion: "ignoriert", begruendung: fremd.grund }, fremd.grund);
    }

    // 2. Dieselbe Mail an zwei Postfächer? Nur einmal bearbeiten.
    // E-401 Nachbesserung (Prüfer-Fund): Eine Schwesterzeile, die selbst nur „Doppelzustellung“ ist, ist NICHT das Original.
    // Sonst legte die Neufassung (24-Stunden-Regel, „Neu schreiben“, Rückstands-Takt) den echten Entwurf als „Doppel“ ab —
    // beide Zeilen 'geordnet', der Gmail-Entwurf gelöscht, die Kundenmail ohne Antwort.
    if (mail.messageIdHeader) {
      const [doppelt] = (await sqlPool`
        SELECT postfach FROM fiaon_postmeister
         WHERE message_id = ${mail.messageIdHeader} AND id <> ${id} AND aktion NOT IN ('fehler', 'in_arbeit')
           AND NOT (aktion = 'geordnet' AND COALESCE(begruendung, '') LIKE 'Dieselbe Mail liegt auch in%')
         LIMIT 1
      `) as any[];
      if (doppelt) {
        return fertig({ ...basis, aktion: "geordnet", begruendung: `Dieselbe Mail liegt auch in ${doppelt.postfach}` }, "Doppelzustellung");
      }
    }

    // 3. Wer schreibt da?
    // E-367: die Antwort-Kette mitgeben — antwortet er auf eine unserer Mails, ist er darüber sicher erkannt.
    const wer = await personSuchen(mail.von, neuerText, { kette: [mail.antwortAufId, mail.references].filter(Boolean).join(" ") || null, betreff: mail.betreff });
    fuerAufgabe = { personId: wer.personId, ref: wer.ref, betreff: mail.betreff };
    const alterTage = Math.floor((Date.now() - mail.datum.getTime()) / 86_400_000);

    // 3b. E-531 (25.11.2026): GLOBAL-WEICHE VOR DER KI. Global-Kunde (Auftrag, Angebot/Partnervertrag oder laut Akte) →
    //     keine KI-Antwort, kein Entwurf, kein Senden. Muster E-350 (0b, greift vorher für Firmenangebote): Ordner
    //     „FIAON/Global von Hand“, die Mail bleibt ungelesen, EINE offene Aufgabe je Faden für Justin. Nach Fremdpost und
    //     Doppelzustellung — keine Aufgabe für Abwesenheitsnotizen, keine zweite für dieselbe Mail in zwei Postfächern.
    //     Stört die Prüfung, wirft sie (Zeile „fehler“, später neu) — nie „im Zweifel antworten“.
    //     Nachbesserung: „gemischt“ (bezahltes Stufenpaket, kein angenommener Begleitvertrag) bleibt Privatkunde wie E-272/E-476.
    {
      const antwortAn = String(mail.antwortAn?.match(/<([^>]+)>/)?.[1] ?? mail.antwortAn ?? "");
      const gl = await globalSpurenLesen([String(mail.vonAdresse || ""), antwortAn], wer.personId ?? null);
      const globalUrteil = globalWeicheUrteil(gl.spuren, { gemischt: gl.gemischt });
      if (globalUrteil.global) {
        await ablegen(postfach, gmailId, "FIAON/Global von Hand");
        // Nachbesserung (Gutachten Richtigkeit): auch diese Mail steht GENAU EINMAL in der Akte (Schritt 5 läuft hier nicht) —
        // ohne KI-Zusammenfassung, nur der Anfang seiner Mail.
        await akteVermerkEinmal({
          postmeisterId: id, ref: wer.ref, personId: wer.personId,
          postfach, betreff: mail.betreff,
          zusammenfassung: `Global-Kunde schreibt (keine KI-Antwort, E-531): „${String(neuerText || mail.snippet || "").replace(/\s+/g, " ").trim().slice(0, 200)}“`,
          neuAngelegt, vermerkMerker: anspruch[0].akte_vermerk_am, einordnungMerker: anspruch[0].einordnung_merker, zeileSeit,
        });
        // Eine ältere Mail (Rückstand, nach der KI-Pause) hat vielleicht schon ein Mensch in Gmail beantwortet — dann keine
        // Aufgabe mehr. Ist Gmail gestört, lieber eine Aufgabe zu viel als eine zu wenig.
        const alt = Date.now() - mail.datum.getTime() > 20 * 60_000;
        const schonBeantwortet = alt ? await spaetereAntwortImFaden(postfach, mail).catch(() => null) : null;
        if (!schonBeantwortet) {
          await globalAufgabeAnlegen({ id, postfach, mail, text: neuerText || mail.snippet || "", grund: globalUrteil.grund, personId: wer.personId ?? null, ref: wer.ref ?? null });
        }
        return fertig({
          ...basis, kategorie: "intern", aktion: "ignoriert", person_id: wer.personId ?? null, ref: wer.ref ?? null,
          begruendung: (schonBeantwortet
            ? `Global-Kunde (E-531): keine KI-Antwort — schon von Hand in Gmail beantwortet (${globalUrteil.grund})`
            : `Global-Kunde (E-531): keine KI-Antwort — Justin antwortet von Hand (${globalUrteil.grund})`).slice(0, 400),
        }, "Global-Kunde");
      }
    }

    // 4. Einordnen — E-401 (19.10.2026): EINMAL je Mail. Vorher lief die KI-Einordnung in JEDEM Anlauf neu, auch
    //    wenn die Mail danach nur einen Takt wartete (Bündeln) oder ein Takt sie wieder hervorholte. Der Merker an
    //    der Zeile (einordnung_merker) trägt die rohe Modellantwort; passt er zu dieser Mail, fragt der Server das
    //    Modell nicht noch einmal (der Riegel läuft trotzdem neu). Gemerkt wird sofort — auch wenn die Mail gleich
    //    wartet, als Werbung abgelegt oder gebündelt wird.
    const eo = await einordnenMitMerker({ betreff: mail.betreff, text: textFuerMara, von: mail.von, alterTage }, anspruch[0].einordnung_merker)
      .catch((e) => { if (istKiPause(e)) throw e; throw new Error(`Einordnung: ${String(e?.message || e).slice(0, 160)}`); });
    const einordnung = eo.einordnung;
    if (!eo.wiederverwendet) await einordnungMerken(id, eo.merker);

    const gemeinsam = {
      ...basis,
      kategorie: einordnung.kategorien[0] ?? "sonstiges",
      kategorien: einordnung.kategorien,
      flags: JSON.stringify(einordnung.flags),
      dringend: einordnung.dringend,
      sprache: einordnung.sprache,
      zusammenfassung: einordnung.zusammenfassung,
      person_id: wer.personId,
      ref: wer.ref,
      person_kandidaten: wer.kandidaten.length ? JSON.stringify(wer.kandidaten) : null,
    };

    // Werbung ordnen, nicht beantworten.
    // ── WERBUNG UND SPAM IN EIGENE ORDNER (05.09.2026, E-135) ─────────────
    // Justin: „Der Agent muss verstehen, was Werbung ist (die kann in einen
    // Ordner), was Spam ist und was Kunden sind." Beides verlässt den
    // Posteingang; „Kein Kunde" bleibt für Automaten und Dienstleister
    // (Airwallex, GoCardless), die ein Mensch sehen will.
    if (einordnung.kategorien.length === 1 && einordnung.kategorien[0] === "werbung_newsletter") {
      // Aus dem Posteingang ja (E-135), auf gelesen nein (E-171): Der Ordner
      // trägt die Kennzeichnung, die ungelesene Zeile bleibt Justins Kontrolle.
      await ablegen(postfach, gmailId, "FIAON/Werbung", ["INBOX"]);
      return fertig({ ...gemeinsam, aktion: "ignoriert", begruendung: "Werbung" }, "Werbung");
    }
    if (einordnung.kategorien.length === 1 && einordnung.kategorien[0] === "spam") {
      await ablegen(postfach, gmailId, "FIAON/Spam", ["INBOX"]);
      return fertig({ ...gemeinsam, aktion: "ignoriert", begruendung: "Spam" }, "Spam");
    }

    // 5. Akte-Vermerk — JEDE Kundenmail wird nachgetragen, und zwar GENAU EINMAL (E-401, 19.10.2026).
    //    Vorher schrieb jeder Anlauf derselben Mail einen neuen Vermerk (Mail #7110: 21 in zwei Minuten; eine alte,
    //    von Hand beantwortete Mail 36 bis 45 am Tag). Jetzt trägt die Zeile einen Merker (akte_vermerk_am); Merker
    //    und Vermerk entstehen in einer Anweisung. Altbestand ohne Merker (darunter die Mail aus der KI-Pause,
    //    Nachprüfung E-246 vom 27.09.): erst nach dem alten Vermerk suchen, dann nur den Merker setzen.
    const akte = await akteLesen(wer.personId, wer.ref);
    await akteVermerkEinmal({
      postmeisterId: id, ref: wer.ref, personId: wer.personId,
      postfach, betreff: mail.betreff, zusammenfassung: einordnung.zusammenfassung,
      neuAngelegt, vermerkMerker: anspruch[0].akte_vermerk_am, einordnungMerker: anspruch[0].einordnung_merker, zeileSeit,
    });

    const kundenlage = akte.kundenlage;
    // E-248 (#5591): EINE Sprache je Antwort — eine, die unsere Mail ganz kann, sonst Deutsch.
    const antwortSpracheCode = antwortSprache(einordnung.sprache, akte.sprache ?? null);
    // Die Zeile trägt dieselbe Sprache — die Zentrale baut Anrede, Knopf und Gruß beim Freigeben daraus.
    gemeinsam.sprache = antwortSpracheCode;
    if (ein.nurOrdnen || ein.modus === "aus") {
      return fertig({ ...gemeinsam, kundenlage, aktion: "vorgeordnet", begruendung: "nur eingeordnet" }, "nur geordnet");
    }

    // 5b. E-246: Hat schon ein Mensch geantwortet? Geprüft bei jeder Mail, die
    //     nicht frisch ist — aus der KI-Pause, ein weiterer Anlauf oder älter
    //     als 20 Minuten (nachgeholt). Dann KEINE zweite Antwort: Zeile
    //     „geordnet", und die Übergabe schließt wie beim Senden.
    const nachgeholt = ausDerPause || versuche > 0 || Date.now() - mail.datum.getTime() > 20 * 60_000;
    if (nachgeholt) {
      const mensch = await spaetereAntwortImFaden(postfach, mail)
        .catch((e) => { throw new Error(`Gmail-Faden nicht prüfbar: ${String(e?.message || e).slice(0, 160)}`); });
      if (mensch) {
        const wann = `${mensch.am.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit" })} ${uhrzeitBerlin(mensch.am)}`;
        const ergebnis = await fertig({
          ...gemeinsam, kundenlage, aktion: "geordnet",
          begruendung: `vom Menschen beantwortet (Gmail, ${wann}) — keine zweite Antwort`,
        }, "vom Menschen beantwortet");
        await uebergabeSchliessen({ id, personId: wer.personId ?? null, ref: wer.ref ?? null }, "Mensch (Gmail)", `In Gmail von Hand beantwortet (${wann}), Mail #${id}.`);
        return ergebnis;
      }
    }

    // 5c. E-248: EINE MAIL — EINE ANTWORT. Derselbe Text noch einmal (Person A:
    //     elf Antworten in elf Minuten) oder ein leerer Nachtrag mit Anhang (Person
    //     B: drei Rechnungen in 76 Sekunden) bekommt keine zweite Antwort. Nach der
    //     Prüfung „hat schon ein Mensch geantwortet“ (5b) und vor jeder Antwort-KI.
    const doppel = await doppelSperre({
      id, personId: wer.personId, von: mail.von, text: neuerText, am: mail.datum, threadId: mail.threadId, betreff: mail.betreff,
    }).catch((e) => { console.warn("[POSTMEISTER] Doppel-Prüfung:", String(e?.message || e).slice(0, 160)); return null; });
    if (doppel) {
      await ablegen(postfach, gmailId, "FIAON/Doppelt");
      return fertig({
        ...gemeinsam, kundenlage, aktion: "geordnet",
        begruendung: `Doppel von Mail #${doppel.id} — ${doppel.grund}; nur eine Antwort (E-248)`,
      }, "Doppel");
    }

    // 5d. E-369 (15.10.2026): BÜNDELN — EIN KUNDE, EINE ANTWORT. Gemessen 08.–15.10.: 18 Antwortpaare bei 13 Kunden
    //     binnen Minuten, teils widersprüchlich (#6584 „bitte nicht per Mail schicken“ und #6586 „Datei angekommen“, beide
    //     14:43; #6705/#6706 mit gegensätzlichen Knöpfen; sechs Antworten an einem Tag). Jetzt: Eine Mail, die jünger als
    //     BUENDEL_WARTE_MS ist, wartet einen Takt (er schreibt oft gleich weiter). Gibt es vom selben Kunden eine neuere Mail,
    //     beantwortet Mara nur die neueste — sie sieht diese hier im Verlauf bzw. als Nachbarmail (nachbarMails).
    if (!ein.nurOrdnen) {
      const buendel = await buendelUrteil({ id, personId: wer.personId, von: mail.von, am: mail.datum }).catch((e) => {
        console.warn("[POSTMEISTER] Bündeln:", String(e?.message || e).slice(0, 160));
        return null;
      });
      if (buendel?.art === "warten") {
        await sqlPool`
          UPDATE fiaon_postmeister
             SET aktion = 'vorgeordnet', in_arbeit_seit = NULL, versuche = GREATEST(versuche - ${neuAngelegt ? 0 : 1}, 0),
                 begruendung = ${"Bündeln: wartet einen Takt auf weitere Mails desselben Kunden (E-369)"}, updated_at = NOW()
           WHERE id = ${id} AND gesendet_am IS NULL`.catch((x) => console.error("[POSTMEISTER] Bündeln zurücklegen:", String(x).slice(0, 160)));
        return { aktion: "geordnet", grund: "wartet auf weitere Mails (Bündeln)", id, wartet: true };
      }
      if (buendel?.art === "mitgenommen") {
        await ablegen(postfach, gmailId, "FIAON/Gebündelt");
        return fertig({
          ...gemeinsam, kundenlage, aktion: "geordnet",
          begruendung: `Gebündelt: ${buendel.grund} (E-369)`,
        }, "gebündelt");
      }
    }

    // 6. Verlauf und Antwort.
    // E-531 (25.11.2026): zuerst die FALL-AKTE aus Gmail — der ganze Faden (auch Hand-Mails der Geschäftsleitung), js@
    // und die Team-Postfächer. Der Verlauf aus fiaon_postmeister ist nur noch der Rückfall, wenn Gmail keinen Faden
    // liefert (sonst stünde derselbe Schriftwechsel doppelt im Auftrag).
    // E-531 Abnahme (Gegenprüfung akte#0): Gehört die Absenderadresse zur erkannten Person (Person, Bestellungen, Gmail-
    // Grundform)? personSuchen erkennt sie auch über Rechnungsnummer, Telefon oder Antwortkette — nur von ihrer gespeicherten
    // Adresse liest die Akte js@ und das Team, und nur dann darf Mara automatisch antworten (8.). Bei einer Störung: nein.
    // Die Adresse aus „Name <a@b>“ oder „a@b (Name)“ — nie die ganze Zeile.
    // E-531 Gegenprüfung (hoch): die LETZTE „<…>“-Gruppe (absenderAdresse) — dieselbe, die absenderEcht prüft und an die
    // Gmail antwortet; „"<kunde@x>" <fremd@y>“ ist fremd@y. Nennt der Von-Kopf mehr als einen Absender (zweite Adresse im
    // Namen oder Kommentar, zwei Absender), ist es nie der eigene (absenderEindeutig) → Entwurf + Karte (fremderAbsender).
    const eigenerAbsender = !!wer.personId && absenderEindeutig(mail.von)
      && await absenderGehoertZurPerson(absenderAdresse(mail.von) || mail.von, Number(wer.personId)).catch(() => false);
    const fall = await fallAkteLesen(postfach, mail, { personId: wer.personId ?? null, eigenerAbsender });
    const fallBlock = fallAkteBlock(fall);
    if (fall.hinweise.length) console.warn(`[POSTMEISTER] Fall-Akte ${postfach}/${gmailId}: ${fall.hinweise.join(" · ").slice(0, 300)}`);
    // E-531 Nachbesserung (Gutachten Richtigkeit): Der Verlauf DIESES Fadens aus fiaon_postmeister wird immer gelesen (nur
    // die Datenbank) — die festen Server-Wege brauchen ihn (Ja auf Maras Zahltag-Rückfrage E-406, „Ja bitte löschen“ auf ihr
    // Löschangebot E-264). Nur der Block „BISHERIGER SCHRIFTWECHSEL“ im Auftrag entfällt, wenn die Fall-Akte den Faden hat.
    const verlaufFaden = await verlaufLesen(postfach, mail.threadId, gmailId);
    // E-531 Abnahme (akte#1): … und nur, wenn die Akte mindestens so viele unserer Antworten zeigt wie dieser Verlauf. Gingen
    // unsere Antworten an eine Antwort-an- oder andere Adresse, die der Faden-Filter nicht kennt, fehlten sie sonst ganz.
    const unsereImVerlauf = verlaufFaden.filter((v) => v.von === "FIAON").length;
    const akteTraegt = !!fall.fadenText && (fall.eigeneImFaden?.length ?? 0) >= unsereImVerlauf;
    const verlauf: { von: string; am: string; text: string }[] = akteTraegt ? [] : verlaufFaden.slice();
    // E-248: Seine anderen Mails der letzten drei Tage (andere Fäden) und unsere Antworten darauf.
    // E-531 Gegenprüfung (B13): die 8 neuesten; ihre IDs gehen an die Ablage (nur sie darf sie aus anderen Fäden ablegen).
    const nachbarn = await nachbarMails(wer.personId, id, mail.threadId);
    if (nachbarn.eintraege.length) verlauf.unshift(...nachbarn.eintraege);
    // E-248 (#5633): Ein Widerruf oder eine bestrittene Forderung aus einer früheren Mail ist noch offen.
    const vorgeschichte = await offeneEinwaende(wer.personId, id).catch(() => null);
    // E-246: Lag die Mail aus der KI-Pause, kann ein früherer Anlauf schon
    // gehandelt haben (Kündigung vorgemerkt, Link verschickt, Aufgabe angelegt).
    // Das Modell erfährt es — nichts doppelt tun, dem Kunden nur als erledigt nennen.
    if (ausDerPause) {
      const getan = await schonGetan(id);
      if (getan.length) {
        verlauf.push({
          von: "FIAON intern (nicht an den Kunden zitieren)",
          am: new Date().toLocaleDateString("de-DE"),
          text: `SCHON ERLEDIGT zu DIESER Mail (ein früherer Anlauf wurde von der KI-Pause unterbrochen, bevor die Antwort rausging). Nicht wiederholen, dem Kunden als erledigt nennen:\n${getan.map((h) => `· ${h.werkzeug}: ${h.ergebnis}`).join("\n")}`,
        });
      }
    }
    const erg = await antwortErzeugen({
      postfach, mail: { betreff: mail.betreff, text: textFuerMara, von: mail.von, alterTage, authErgebnis: mail.authErgebnis ?? null, antwortAn: mail.antwortAn ?? null, am: mail.datum ?? null },
      verlauf, einordnung, personId: wer.personId, ref: wer.ref, postmeisterId: id,
      sprache: antwortSpracheCode, vorgeschichte,
      // E-531: der Block „FALL-AKTE – VERBINDLICH“ direkt vor der neuen Nachricht.
      fallAkte: fallBlock || null,
      // E-531 Nachbesserung: für die festen Server-Wege — dieser Faden (Datenbank), unsere Nachrichten darin (Gmail) und
      // was Menschen ihm geschrieben haben (Geld-Prüfungen).
      verlaufFaden,
      fallDaten: { eigene: fall.eigeneImFaden ?? [], mensch: fall.menschTexte ?? [], gmail: !!fall.fadenText },
    });

    if (!erg.ok || !erg.antwort) {
      return fertig({
        ...gemeinsam, kundenlage, ...(await fehlerFelder(erg.grund)),
        handlungen: JSON.stringify(erg.handlungen), pruefung: JSON.stringify(erg.pruefung),
      }, erg.grund);
    }

    // 7. Anrede und HTML im Haus-CI — in der Sprache, in der der Kunde schrieb.
    //    Bis zum 02.09.2026 konnte hier ein englischer Text mit „Guten Tag
    //    Herr Smith," eingeleitet und mit einem deutschen Knopf beendet
    //    werden. Die Sprache reist jetzt bis in die letzte Zeile mit.
    const [vor, ...restName] = String(akte.name || "").split(" ");
    // Was der Kunde GERADE schreibt, schlägt den Vermerk in der Akte — er
    // schreibt ja in dieser Sprache. Der Vermerk greift nur, wenn die Mail
    // nichts hergab (kurze Mail, nur ein Wort) und ein Mensch die Sprache
    // nach einem Telefonat eingetragen hat.
    // E-248 (#5591): dieselbe EINE Sprache wie der Text — nie Rahmen deutsch, Text spanisch.
    const sprache = antwortSpracheCode;
    const anrede = await anredeBestimmen(wer.personId, vor || null, restName.join(" ") || null, sprache, { absender: mail.von });
    // Der Gruß trägt den Namen des Agenten (04.09.2026): „Freundliche Grüße\nMara\nFIAON Welcome-Team".
    const { agentName } = await import("./fiaon-postmeister-agent");
    const name = await agentName();
    // „Freundliche Grüße / Mara / FIAON Welcome-Team" — das „Ihr" fällt weg,
    // sobald ein Mensch davor steht; „Mara / Ihr Team" liest sich schief.
    const { grussMitAgent } = await import("./fiaon-postmeister-antworttext");
    const grussMitName = grussMitAgent(ein.gruss, name);
    const fertigeAntwort = antwortBauen({
      anrede: anrede.zeile, kern: erg.antwort, gruss: grussMitName, agentName: name,
      schritt: erg.naechsterSchritt, betreff: mail.betreff, sprache,
    });

    // 7b. Anhänge (04.09.2026, E-115): Trägt die Antwort eine Zahlungsseite,
    //     geht die Rechnung als PDF mit — wie bei einem Menschen, der die
    //     Rechnung gleich mitschickt. Dazu, was das Werkzeug rechnung_anhaengen
    //     schon an die Zeile geschrieben hat.
    const { anhaengePlanen, anhaengeBauen } = await import("./fiaon-postmeister-anhaenge");
    const [zeileJetzt] = (await sqlPool`SELECT anhaenge, gesendet_am FROM fiaon_postmeister WHERE id = ${id}`.catch(() => [])) as any[];
    const anhangPlan = anhaengePlanen(zeileJetzt?.anhaenge, erg.naechsterSchritt);
    const gebaut = anhangPlan.length ? await anhaengeBauen(anhangPlan) : { dateien: [], fehler: [] as string[] };
    if (gebaut.fehler.length) console.warn(`[POSTMEISTER] Anhänge ${id}:`, gebaut.fehler.join("; "));

    // 8. Senden oder Entwurf. Im Zweifel Entwurf.
    // 18.09.2026 (Team-Feedback Priorität 6): „Die KI übergibt bei komplexeren
    // Anliegen an einen Mitarbeiter." Was ein Mensch klären muss, geht nie
    // automatisch raus — es wird ein Entwurf UND eine Aufgabe beim Betreuer.
    // E-275 (02.10.2026): Global-Kunden bleiben bei Justin (E-272) — die eine Regel, hier für den Entwurf.
    const globalAbsender = await globalUebergabe(wer.personId);
    // E-369 (15.10.2026): Ein früherer Einwand (vorgeschichte) sperrt nur die Zahlungsbitte (zahlungsRuhe), nicht den
    // Versand — vorher machte er JEDE spätere Mail zum Entwurf, auch „Okay, danke“ (#6624) oder „Anruf abgesagt“ (#6658).
    // Eine nicht gebuchte Kündigung beantwortet Mara mit der Rückfrage („Ein kurzes Ja genügt.“, Agent) — kein Mensch.
    // Ein Widerruf, den Mara als Storno der unbezahlten Bestellung gebucht hat, ist erledigt (automatischErlaubt).
    let mensch = menschNoetig(einordnung, neuerText, { globalKunde: globalAbsender });
    if (mensch === UEBERGABE_GRUND.widerruf && erg.automatischErlaubt) mensch = null;
    // E-499: Dieselbe Ausnahme griff nie — der Riegel setzt bei jedem Widerruf auch „rechtlich“, und „rechtlich“ kam hier
    // zuerst. Ist der Widerruf einer unbezahlten Bestellung als Storno gebucht und brannte „rechtlich“ nur seinetwegen
    // (Agent: widerrufAlsStorno — kein Anwalt, keine Behörde, kein Bestreiten), ist es erledigt. Global bleibt bei Justin.
    if (mensch === UEBERGABE_GRUND.rechtlich && erg.automatischErlaubt && erg.widerrufAlsStorno && !BEHOERDE.test(neuerText)) {
      mensch = globalAbsender ? UEBERGABE_GRUND.global : null;
    }
    // E-275: Der Rückrufwunsch ist erledigt, wenn Mara ihn selbst eingeplant hat (Aufgabe mit Rückruf, Notiz mit
    // Anruf, Terminlink) — dann geht ihre Antwort („Herr Stripling ruft Sie morgen um 10 Uhr an“) ohne zweite
    // Übergabe raus, sofern die Prüfung sie freigibt (die Lampe rueckruf_wunsch fällt dort ebenso).
    if (mensch === UEBERGABE_GRUND.ansprechpartner
      && erg.handlungen.some((h) => h.ok && ["aufgabe_an_betreuer", "notiz_an_betreuer", "terminlink_bauen"].includes(h.werkzeug))) {
      mensch = null;
    }
    // E-531 Abnahme (Gegenprüfung akte#0): Erkannt über Rechnungsnummer, Telefon oder Antwortkette, aber von einer Adresse,
    // die bei der Person nicht gespeichert ist — nie automatisch antworten (es könnte ein Dritter sein, der Akte und Briefe
    // nicht sehen darf). Entwurf + Karte; ein Mensch prüft, wer schreibt.
    // Gegenprüfung Runde 5: dazu ein Warnsatz (pruefung.fehlend) — auch wenn schon ein anderer Grund gesetzt ist —, damit Karte
    // und Postfach nicht „senden“ empfehlen.
    if (wer.personId && !eigenerAbsender) {
      if (!mensch) mensch = UEBERGABE_GRUND.fremderAbsender;
      erg.pruefung = { ...erg.pruefung, fehlend: [absenderMangel(mail.von), ...(erg.pruefung?.fehlend ?? [])] };
    }
    // E-531 (Abnahme Runde 3): antwortSenden schreibt an „Antwort-an“. Nennt es eine Adresse, die weder der Absender ist noch
    // bei der Person gespeichert ist (vielleicht gefälschtes Von + fremde Antwort-an), nie automatisch: Entwurf + Karte.
    // Gegenprüfung Runde 4: unabhängig von einem schon gesetzten Grund prüfen — dazu ein Warnsatz (pruefung.fehlend), damit Karte
    // und Postfach nicht „senden“ empfehlen. Von Hand geht die Antwort dann nur an den gespeicherten Absender (handVersandZiel).
    const fremdeAntwortAnJa = !!wer.personId && await antwortAnFremd(mail.antwortAn, mail.von, Number(wer.personId));
    if (fremdeAntwortAnJa) {
      if (!mensch) mensch = UEBERGABE_GRUND.fremdeAntwortAn;
      erg.pruefung = { ...erg.pruefung, fehlend: [antwortAnMangel(mail.antwortAn, mail.von, eigenerAbsender), ...(erg.pruefung?.fehlend ?? [])] };
    }
    // E-248: Sperre direkt vor dem Senden — ist auf denselben Text schon eine Antwort raus, keine zweite.
    const sperre = ein.modus === "auto" && erg.automatischErlaubt && !mensch ? await sendeSperre(id) : null;
    if (sperre) {
      await ablegen(postfach, gmailId, "FIAON/Doppelt");
      return fertig({ ...gemeinsam, kundenlage, aktion: "geordnet", begruendung: `Doppel von Mail #${sperre.doppelVon} — ${sperre.grund}; nur eine Antwort (E-248)` }, "Doppel");
    }
    // ── E-393: DIE SENDESPERRE ─────────────────────────────────────────────
    // Knüpft der fertige Text das Vertragsende an eine Zahlung oder droht er in einer Kündigungs-/Widerrufsantwort
    // (Gericht, Inkasso, Anwalt, SCHUFA), geht er nie automatisch raus — auch wenn der Agent ihn für sauber hielt.
    // E-396: Der Kulanz-Satz ist nur beim Jahresvertrag frei — beim Vertrag vor dem 03.09.2026 sperrt die Wand ihn.
    const kulanzErlaubt = await (await import("./fiaon-kuendigung")).kulanzSatzErlaubt(wer.ref, wer.personId).catch(() => null);
    const e393 = kuendigungSendeUrteil({
      antwort: fertigeAntwort.text, eingang: neuerText, betreff: mail.betreff, flags: einordnung.flags as any,
      kundenlage, kategorien: einordnung.kategorien as any, kuendigungInAkte: !!akte?.kuendigung, kulanzErlaubt,
    });
    if (e393.gesperrt) {
      erg.grund = `${e393.grund}${erg.grund ? ` · ${erg.grund}` : ""}`.slice(0, 900);
      console.warn(`[POSTMEISTER] ${postfach}/${gmailId}: ${e393.grund}`);
    }
    const darfAutoOhneE531 = ein.modus === "auto" && erg.automatischErlaubt && !ein.nurOrdnen && !mensch && !e393.gesperrt;
    // ── E-531 (25.11.2026): DIE SENDEWAND — ZEIT-ZUSAGE UND SCHLEIFEN-BREMSE ─────────────────────────────────
    // Nur, was sonst automatisch hinausginge: Verspricht der Text eine Zeit („Herr X meldet sich heute“) ohne echten
    // Kalendertermin, oder ginge an dieselbe Adresse schon die dritte automatische Antwort in 7 Tagen, wird es ein Entwurf
    // mit Karte (derselbe Weg wie „Mensch nötig“). Die Wand hält nur an — nie lässt sie etwas raus.
    const e531Adressen = [String(mail.vonAdresse || ""), String(mail.antwortAn?.match(/<([^>]+)>/)?.[1] ?? mail.antwortAn ?? "")];
    // E-531 Abnahme (senden#1): Fehlt der Fall-Akte eine Quelle (Faden, js@, Team, Datenbank), geht nichts automatisch raus.
    const akteWand = darfAutoOhneE531 ? e531AkteWand(fall.lesefehler) : null;
    const wand = darfAutoOhneE531
      ? await e531Sendewand({
          id, text: fertigeAntwort.text, personId: wer.personId ?? null,
          adressen: e531Adressen,
          kalender: [erg.werkzeugDaten?.aufgabe_an_betreuer?.rueckruf_termin, erg.werkzeugDaten?.aufgabe_an_betreuer?.bestehender_termin],
          // Nachbesserung: Bestätigt die Antwort nur, was ein Werkzeug gerade gebucht hat (Storno, Ende, Zahlung gefunden), keine
          // Bremse — Abnahme (senden#2): den Zahlungsfund höchstens einmal je Adresse in 7 Tagen.
          ausnahme: e531BestaetigungsArt(erg.werkzeugDaten),
        })
      : null;
    const e531 = wand ?? akteWand;
    if (e531) {
      console.warn(`[POSTMEISTER] ${postfach}/${gmailId}: ${e531.grund}`);
      const maengelE531 = [wand?.mangel, akteWand?.mangel].filter((m): m is string => !!m);
      if (maengelE531.length) erg.pruefung = { ...erg.pruefung, fehlend: [...maengelE531, ...(erg.pruefung?.fehlend ?? [])] };
    }
    const darfAutoOhneAmpel = darfAutoOhneE531 && !e531;
    // ── E-406 B3 / E-409: DIE AMPEL „MAILS BEANTWORTEN“ (Werkzeug antwort_senden, KI-Team › Werkzeuge) ─────────
    // Grün (Startwert = heutiges Verhalten): wie bisher. Gelb: Entwurf statt Senden — er steht in „Mara heute“ im
    // Lagezimmer („Nicht senden“) und geht nach 24 Stunden über die 24-Stunden-Regel raus (ampelFrist). Rot: jede
    // Antwort wird eine Karte „Kundenmail“. Die Ampel hält nur an, was sonst rausginge — nie lässt sie etwas raus.
    let ampelGrund: string | null = null;
    let ampelGelb = false;
    if (darfAutoOhneAmpel) {
      const { ampelStufe } = await import("./fiaon-ki-ampel");
      const stufe = await ampelStufe("mara", "antwort_senden");
      if (!mailDarfAuto(stufe, { fristNeu: !!ein.ampelFrist })) {
        ampelGrund = mailAmpelGrund(stufe, erg.grund);
        ampelGelb = stufe === "gelb";
      }
    }
    // E-406 B3 (Nachbesserung, Prüfer-Fund): Gelb heißt „wartet 24 h, dann sendet die 24-Stunden-Regel“ — nur, wenn sie das
    // auch TUT. Lässt sie den Entwurf liegen (Zeile ohne Merker frist_ab, etwa nach „Neu schreiben lassen“ auf einem alten
    // Entwurf; schon einmal neu geschrieben; Testkonto oder Vertriebssperre; Kundenmail zu alt; Widerruf/Recht), bekäme der
    // Kunde nie eine Antwort und Justin nie eine Karte. Dann ist es KEIN gelber Entwurf, sondern eine normale Karte.
    if (ampelGelb) {
      const { gelbLiegenLesen } = await import("./fiaon-postmeister-frist");
      const [fz] = (await sqlPool`SELECT frist_ab, frist_neu_am FROM fiaon_postmeister WHERE id = ${id}`.catch(() => [])) as any[];
      const liegen = fz
        ? ((await gelbLiegenLesen([{
            id, personId: wer.personId ?? null, fristAb: fz.frist_ab ?? null, fristNeuAm: fz.frist_neu_am ?? null,
            mailAm: mail.datum ?? zeileSeit, entwurfAm: new Date(), begruendung: ampelGrund, flags: einordnung.flags, global: !!globalAbsender,
          }])).get(id) ?? null)
        : "Merker der 24-Stunden-Regel nicht lesbar";
      if (liegen) {
        ampelGrund = mailAmpelGelbKarteGrund(liegen, erg.grund);
        ampelGelb = false;
      }
    }
    const darfAuto = darfAutoOhneAmpel && !ampelGrund;
    const felder = {
      ...gemeinsam, kundenlage,
      antwort: fertigeAntwort.text, antwort_html: fertigeAntwort.html,
      belege: JSON.stringify(erg.belege), handlungen: JSON.stringify(erg.handlungen),
      pruefung: JSON.stringify(erg.pruefung), naechster_schritt: erg.naechsterSchritt ? JSON.stringify(erg.naechsterSchritt) : null,
      ki_kosten_cents: erg.kostenCents, entwurf_geprueft_am: new Date(),
      anhaenge: anhangPlan.length ? JSON.stringify(anhangPlan) : null,
    };

    // Zweite Sperre gegen den Doppelversand (E-184): Sollte die Antwort
    // während dieses Laufs anderswo hinausgegangen sein, nicht noch einmal.
    if (zeileJetzt?.gesendet_am) {
      return fertig({ ...gemeinsam, kundenlage, aktion: "auto_beantwortet", begruendung: "Antwort war schon gesendet — nicht erneut geschickt (E-184)" }, "schon gesendet");
    }

    if (darfAuto) {
      // ── VERSAND SCHEITERT ≠ ANTWORT SCHEITERT (11.09.2026, E-184) ─────
      // Bis heute landete ein Gmail-Fehler beim Senden im äußeren catch: die
      // fertige Antwort ging verloren, die Zeile auf 'fehler', und der nächste
      // Takt erzeugte alles neu — viermal in 20 Minuten. Jetzt bleibt die
      // Antwort mit allen Feldern in der Zeile und wird nachgeholt (unten,
      // versandNachholen): in 15 Minuten, dann 2 Stunden, dann 24 Stunden.
      try {
        // E-531 (Gegenprüfung Runde 4): automatisch mit Kundendaten NUR an die geprüfte, bei ihm gespeicherte Absenderadresse
        // (eigenerAbsender ist hier sicher wahr) — nie an den rohen Antwort-an-/Von-Kopf, den Gmail anders lesen könnte als wir.
        await antwortSenden(postfach, mail, fertigeAntwort.text, fertigeAntwort.html, gebaut.dateien,
          wer.personId ? { an: absenderAdresse(mail.von) } : {});
      } catch (e: any) {
        const grund = String(e?.message || e).slice(0, 300);
        const naechster = new Date(Date.now() + WIEDERVORLAGE_MS[1]);
        console.error(`[POSTMEISTER] Versand ${postfach}/${gmailId} fehlgeschlagen (Versuch 1/4, nächster ${uhrzeitBerlin(naechster)}):`, grund);
        await akteVermerk(wer.ref, wer.personId, `Antwort NICHT gesendet (Versuch 1/4, nächster gegen ${uhrzeitBerlin(naechster)}): ${grund}`);
        return fertig({
          ...felder, aktion: "versand_wartet", versand_versuche: 1, versand_fehler: grund,
          naechster_versuch_am: naechster, versand_aufgegeben_am: null, begruendung: erg.grund,
        }, `Versand fehlgeschlagen: ${grund}`);
      }
      // Sofort festhalten, dass die Mail draußen ist — auch wenn Ablage oder
      // Vermerk gleich scheitern oder der Server neu startet (E-184).
      // Faden und Eingang gleich mit — die Zeile trägt bis zu fertig(...) noch
      // thread_id = '' (Anspruch), und uebergabeSchliessen erkennt „spätere Mail
      // im selben Faden" nur mit Faden (Nachbesserung E-244).
      await sqlPool`
        UPDATE fiaon_postmeister SET gesendet_am = NOW(), aktion = 'auto_beantwortet',
               thread_id = ${String(mail.threadId || "")}, empfangen_am = ${mail.datum ?? null}, updated_at = NOW()
         WHERE id = ${id}
      `.catch(() => {});
      // E-244 (Nachbesserung): Auch Maras eigener Versand beantwortet — eine
      // Übergabe aus einem früheren Entwurf desselben Kunden (z. B. nach
      // „Alle Entwürfe neu schreiben") schließt mit, sofern nichts mehr wartet.
      await uebergabeSchliessen({ id, personId: wer.personId ?? null, ref: wer.ref ?? null }, "Mara (automatisch)", `Antwort automatisch gesendet, Mail #${id}.`);
      await ablegen(postfach, gmailId, "FIAON/Auto-beantwortet", ["UNREAD"]);
      // E-240: EIN Vermerk je Antwort — Kunde schrieb, Mara antwortete, Handlungen
      // (vorher nur der Antworttext, und nur mit Bestellung im Vorgang).
      await maraMailVermerk({
        personId: wer.personId, ref: wer.ref, kundeText: neuerText, antwort: erg.antwort, art: "gesendet",
        handlungen: erg.handlungen, anhaenge: gebaut.dateien.map((d) => d.dateiname),
      });
      return fertig({ ...felder, aktion: "auto_beantwortet", gesendet_am: new Date(), begruendung: erg.grund }, erg.grund);
    }

    // E-531 (Gegenprüfung Runde 5, Schlussprüfung Runde 6): Mit Person ist der Gmail-Entwurf an dieselbe Adresse gerichtet, an
    // die auch „Senden“ von Hand ginge (handVersandZiel: saubere, gespeicherte Adresse) — ist das gesperrt, hat er KEINEN
    // Empfänger: Wer ihn in Gmail sendet, trägt die Adresse bewusst selbst ein.
    const zielEntwurf = wer.personId ? await handVersandZiel(mail, Number(wer.personId)).catch(() => null) : null;
    const draftId = await entwurfAnlegen(postfach, mail, fertigeAntwort.text, fertigeAntwort.html, gebaut.dateien,
      wer.personId ? (zielEntwurf?.an ? { an: zielEntwurf.an } : { ohneEmpfaenger: true }) : {}).catch(() => null);
    await ablegen(postfach, gmailId, "FIAON/Entwurf wartet");
    // E-406 B3: Hält NUR die Ampel die Antwort an, steht das als Begründung da („Ampel gelb: …“ / „Ampel rot: …“).
    // E-531: Hält die Sendewand die Antwort an, steht ihr Grund da (Zeit-Zusage, „Kunde schreibt zum n. Mal …“).
    const begruendungEntwurf = mensch ? `Übergabe an den Betreuer: ${mensch}` : (e531?.grund ?? ampelGrund ?? erg.grund);
    const ergebnis = await fertig({ ...felder, aktion: "entwurf", antwort_draft_id: draftId, begruendung: begruendungEntwurf }, erg.grund);
    // E-240: Auch der Entwurf steht in der Akte — der Betreuer, der anruft, sieht,
    // was Mara vorgeschlagen und schon getan hat (Angebot, Aufgabe, Rechnung).
    await maraMailVermerk({
      personId: wer.personId, ref: wer.ref, kundeText: neuerText, antwort: erg.antwort, art: "entwurf",
      handlungen: erg.handlungen, grund: begruendungEntwurf,
    });
    // E-371 (15.10.2026, Justin: „nichts weitergeben an die Mitarbeiter … mit 1 Klick entscheiden“): Was Mara nicht
    // selbst senden darf, wird eine Karte in Mara › Entscheidungen (fiaon-postmeister-entscheidungen.ts) — senden, neu
    // schreiben, selbst antworten oder ablegen. Nur der ausdrückliche Rückrufwunsch bleibt beim Betreuer (er ruft an).
    if (mensch === UEBERGABE_GRUND.ansprechpartner) {
      await anBetreuerUebergeben({
        id, personId: wer.personId, ref: wer.ref, postfach, betreff: mail.betreff,
        zusammenfassung: einordnung.zusammenfassung, grund: mensch,
        dringend: einordnung.dringend || !!mensch,
      });
    } else if (!ampelGelb) {
      // E-406 B3: Ein gelber Entwurf ist KEINE Karte — er steht in „Mara heute“ und geht nach 24 h selbst raus.
      const { postmeisterKarteJetzt } = await import("./fiaon-postmeister-entscheidungen");
      await postmeisterKarteJetzt(id);
    }
    // E-531 Nachbesserung (Gutachten Kosten): Hielt die Sendewand an, bleibt je Adresse genau EIN Entwurf und EINE Karte —
    // ältere Wand-Entwürfe derselben Adresse legt der Server jetzt ab (sonst erst die 24-Stunden-Regel einen Tag später).
    // Abnahme (senden#4): nur die echte, geprüfte Absenderadresse (nie Antwort-an), nur Entwürfe, die diese Antwort kannte.
    // Gegenprüfung: derselbe Von-Kopf für Adresse und Prüfung (letzte „<…>“-Gruppe); aus anderen Fäden nur die Nachbar-Mails,
    // die wirklich im Auftrag standen (nachbarIds).
    if (e531 && !mensch) {
      await e531AeltereAblegen({
        id, von: mail.von, threadId: mail.threadId ?? null, personId: wer.personId ?? null, mailAm: mail.datum ?? null,
        absenderGeprueft: absenderEcht({ authErgebnis: mail.authErgebnis ?? null, von: mail.von, antwortAn: mail.antwortAn ?? null }).echt,
        nachbarIds: nachbarn.ids,
      });
    }
    return ergebnis;
  } catch (e: any) {
    const grund = String(e?.message || e).slice(0, 300);
    // ── KI-PAUSE (E-246): kein Fehlversuch, kein Aktenvermerk, keine Aufgabe.
    // Die Zeile geht zurück auf 'vorgeordnet' (bleibt beanspruchbar) und der
    // Zähler auf den Stand vor diesem Anspruch — die Pause kostet keinen der
    // vier Versuche. Werkzeuge, die vor dem Fehler schon liefen, bleiben.
    if (istKiPause(e)) {
      await sqlPool`
        UPDATE fiaon_postmeister
           SET aktion = 'vorgeordnet', in_arbeit_seit = NULL, naechster_versuch_am = NULL,
               versuche = GREATEST(versuche - ${neuAngelegt ? 0 : 1}, 0),
               begruendung = ${e?.art === "kasse" ? String(e.message).slice(0, 300) : "KI pausiert — wartet auf das Aktivieren"}, updated_at = NOW()
         WHERE id = ${id} AND gesendet_am IS NULL
      `.catch((x) => console.error("[POSTMEISTER] Pause zurücklegen:", String(x).slice(0, 160)));
      // E-458: Die KI-Kasse bremst wie eine Pause (Anteil, Tagesdeckel, Nachhol-Bremse) — die Mail wartet auf den nächsten Takt.
      console.warn(`[POSTMEISTER] ${postfach}/${gmailId}: ${e?.art === "kasse" ? "KI-Kasse bremst" : "KI pausiert"} — zurückgelegt.`);
      return { aktion: "geordnet", grund: "KI pausiert", id };
    }
    console.error(`[POSTMEISTER] ${postfach}/${gmailId} (Versuch ${versuche + 1}/4):`, grund);
    return fertig(await fehlerFelder(grund), grund);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// VERSAND NACHHOLEN (11.09.2026, E-184 — Team-Feedback Punkt 1)
//
// DIE MESSUNG: Scheiterte der Gmail-Versand, landete die Mail auf 'fehler'.
// Das Sieb im 5-Minuten-Takt legte jede 'fehler'-Zeile in JEDEM Takt neu vor,
// und jedes Mal erzeugte die KI die Antwort NEU — vier Versuche in 15 bis 20
// Minuten (343 postmeister-antwort-Aufrufe in drei Tagen, im Schnitt 2,3 ct
// und 12 Sekunden je Aufruf). Danach stand die Zeile mit versuche=3 für immer
// auf 'fehler': kein Vermerk, keine Aufgabe, niemand erfuhr davon. Dazu hingen
// 13 Zeilen nach Server-Neustarts in 'in_arbeit' (01.–07.09.), für Sieb und
// Zentrale unsichtbar.
//
// JETZT: Scheitert nur der Versand, bleibt die fertige Antwort in der Zeile
// (aktion='versand_wartet') und wird hier nachgeholt — DIESELBE Antwort, nie
// eine neue: 15 Minuten, 2 Stunden und 24 Stunden nach dem Erstversuch. Nach
// dem vierten Fehlschlag: 'versand_fehlgeschlagen', Vermerk in der Akte,
// dringende Aufgabe an den Betreuer (Schlüssel postmeister:<id>:versand —
// entsteht einmal, nicht je Takt). In der Zentrale bleibt die Antwort unter
// „Zu prüfen“ und kann jederzeit von Hand gesendet werden.
//
// Läuft am Ende jedes Takts (postmeisterLauf), kein eigener Cron. Beansprucht
// wird wie beim Handversand über aktion='sendet': Wer die Zeile zuerst nimmt,
// sendet — ein zweiter Takt oder ein Mensch findet sie nicht mehr.
// ═══════════════════════════════════════════════════════════════════════════
export async function versandNachholen(ein: { postfaecher?: string[] } = {}):
  Promise<{ geprueft: number; gesendet: number; verschoben: number; aufgegeben: number }> {
  await postmeisterSchema();
  const erg = { geprueft: 0, gesendet: 0, verschoben: 0, aufgegeben: 0 };
  // E-248: Erst die Doppel einordnen — sonst holte dieser Lauf eine zweite Antwort auf denselben Text nach.
  await doppelteEntwuerfeOrdnen();
  const zeilen = (await sqlPool`
    UPDATE fiaon_postmeister SET aktion = 'sendet', in_arbeit_seit = NOW(), updated_at = NOW()
     WHERE id IN (SELECT id FROM fiaon_postmeister
                   WHERE aktion = 'versand_wartet' AND naechster_versuch_am <= NOW()
                     AND (${ein.postfaecher ? sqlPool`postfach = ANY(${ein.postfaecher})` : sqlPool`TRUE`})
                   ORDER BY naechster_versuch_am ASC LIMIT 10 FOR UPDATE SKIP LOCKED)
     RETURNING *
  `) as any[];

  for (const r of zeilen) {
    erg.geprueft += 1;
    const id = Number(r.id);
    const versuch = Number(r.versand_versuche || 0) + 1;
    const ref: string | null = r.ref ?? null;
    const personId: number | null = r.person_id ?? null;

    const verschieben = async (grund: string, naechster: Date): Promise<void> => {
      await sqlPool`
        UPDATE fiaon_postmeister SET aktion = 'versand_wartet', versand_versuche = ${versuch}, versand_fehler = ${grund},
               naechster_versuch_am = ${naechster}, in_arbeit_seit = NULL, updated_at = NOW() WHERE id = ${id}
      `.catch((e) => console.error("[POSTMEISTER] nachholen speichern:", String(e).slice(0, 160)));
      await akteVermerk(ref, personId, `Antwort NICHT gesendet (Versuch ${versuch}/4, nächster gegen ${uhrzeitBerlin(naechster)}): ${grund}`);
      console.warn(`[POSTMEISTER] Versand ${r.postfach}/${r.gmail_id} erneut gescheitert (Versuch ${versuch}/4, nächster ${uhrzeitBerlin(naechster)}):`, grund);
      erg.verschoben += 1;
    };
    const aufgeben = async (grund: string): Promise<void> => {
      await sqlPool`
        UPDATE fiaon_postmeister SET aktion = 'versand_fehlgeschlagen', versand_versuche = ${versuch}, versand_fehler = ${grund},
               naechster_versuch_am = NULL, versand_aufgegeben_am = NOW(), in_arbeit_seit = NULL, updated_at = NOW() WHERE id = ${id}
      `.catch((e) => console.error("[POSTMEISTER] nachholen speichern:", String(e).slice(0, 160)));
      await akteVermerk(ref, personId, `Versand endgültig fehlgeschlagen nach 4 Versuchen: ${grund}`);
      await aufgabeNachAufgabe({ id, postfach: String(r.postfach), betreff: String(r.betreff || ""), grund, personId, ref, art: "versand" });
      console.error(`[POSTMEISTER] Versand ${r.postfach}/${r.gmail_id} endgültig fehlgeschlagen — Aufgabe angelegt:`, grund);
      erg.aufgegeben += 1;
    };

    // Ein nicht bedientes Postfach (E-171) wird nie wieder senden — sofort aufgeben, nicht 26 Stunden warten.
    if (!wirdBedient(String(r.postfach))) {
      await aufgeben(`Postfach ${r.postfach} wird vom Agenten nicht bedient (E-171)`);
      continue;
    }
    // E-248: Hat derselbe Kunde auf denselben Text inzwischen eine Antwort, wird diese nicht nachgeholt.
    const doppel = await sendeSperre(id);
    if (doppel) {
      await sqlPool`
        UPDATE fiaon_postmeister SET aktion = 'geordnet', naechster_versuch_am = NULL, in_arbeit_seit = NULL,
               begruendung = ${`Doppel von Mail #${doppel.doppelVon} — ${doppel.grund}; nur eine Antwort (E-248)`}, updated_at = NOW()
         WHERE id = ${id}`.catch((e) => console.error("[POSTMEISTER] Doppel beim Nachholen:", String(e).slice(0, 160)));
      continue;
    }

    try {
      // Genau der Weg des Handversands (Zentrale): Nachricht lesen, Anhänge
      // bauen, antwortSenden — nur der Text kommt aus der Zeile, nicht vom Modell.
      const mail = await nachrichtLesen(String(r.postfach), String(r.gmail_id));
      const { anhaengePlanen, anhaengeBauen } = await import("./fiaon-postmeister-anhaenge");
      const plan = anhaengePlanen(r.anhaenge, jsonLesen(r.naechster_schritt));
      const gebaut = plan.length ? await anhaengeBauen(plan) : { dateien: [], fehler: [] as string[] };
      if (gebaut.fehler.length) console.warn(`[POSTMEISTER] Anhänge ${id} (nachgeholt):`, gebaut.fehler.join("; "));
      const text = String(r.antwort || "");
      if (text.trim().length < 20) throw new Error("Gespeicherte Antwort fehlt oder ist zu kurz");
      // E-393: Die gespeicherte Antwort geht durch dieselbe Sendesperre — eine Zeile von vor der Sperre holt nichts nach.
      const e393 = kuendigungSendeUrteil({
        antwort: text, eingang: r.text ?? null, betreff: r.betreff ?? null, flags: jsonLesen(r.flags),
        kundenlage: r.kundenlage ?? null, kategorie: r.kategorie ?? null, kategorien: r.kategorien ?? null,
        // E-396: Kulanz-Satz nur beim Jahresvertrag.
        kulanzErlaubt: await (await import("./fiaon-kuendigung")).kulanzSatzErlaubt(ref, personId).catch(() => null),
      });
      if (e393.gesperrt) {
        await sqlPool`
          UPDATE fiaon_postmeister SET aktion = 'entwurf', naechster_versuch_am = NULL, in_arbeit_seit = NULL,
                 begruendung = ${`Nicht nachgeholt: ${e393.grund}`.slice(0, 900)}, updated_at = NOW() WHERE id = ${id}
        `.catch((x) => console.error("[POSTMEISTER] E-393 beim Nachholen:", String(x).slice(0, 160)));
        console.warn(`[POSTMEISTER] Versand ${r.postfach}/${r.gmail_id} nicht nachgeholt: ${e393.grund}`);
        continue;
      }
      // E-531 (25.11.2026): dieselbe Sendewand wie beim ersten Versand — eine nachgeholte Antwort darf nie mehr als damals:
      // Zeit-Zusage ohne Kalendertermin oder dritte Auto-Antwort in 7 Tagen → Entwurf + Karte statt Versand.
      // E-531 (Abnahme Runde 3 + Gegenprüfung Runde 4): beim Nachholen dieselben Absender-Sperren wie beim ersten Versand —
      // eine Zeile von vor E-531 (ohne Prüfung des eigenen Absenders) holt nichts an eine fremde Adresse nach. Fremder oder
      // mehrdeutiger Absender bzw. fremde „Antwort-an“ → Entwurf + Karte mit Warnsatz.
      const eigenerAbsenderNach = !personId || (absenderEindeutig(mail.von)
        && await absenderGehoertZurPerson(absenderAdresse(mail.von) || mail.von, Number(personId)).catch(() => false));
      const fremdeAntwortAn = personId ? await antwortAnFremd(mail.antwortAn, mail.von, Number(personId)) : false;
      const wand = !eigenerAbsenderNach
        ? { grund: `Nicht nachgeholt: ${UEBERGABE_GRUND.fremderAbsender} (E-531)`, mangel: absenderMangel(mail.von) as string | null }
        : fremdeAntwortAn
          ? { grund: `Nicht nachgeholt: ${UEBERGABE_GRUND.fremdeAntwortAn} (E-531)`, mangel: antwortAnMangel(mail.antwortAn, mail.von, true) as string | null }
          : await e531Sendewand({ id, text, personId, adressen: [adresseAus(r.von)], ausnahme: e531NurBestaetigungAusHandlungen(handlungenFlach(r.handlungen)) ? "kuendigung" : null });
      if (wand) {
        const vorher = jsonLesen(r.pruefung) ?? {};
        const pruefungNeu = wand.mangel
          ? { ...vorher, fehlend: [wand.mangel, ...(Array.isArray(vorher.fehlend) ? vorher.fehlend : [])] }
          : vorher;
        await sqlPool`
          UPDATE fiaon_postmeister SET aktion = 'entwurf', naechster_versuch_am = NULL, in_arbeit_seit = NULL,
                 begruendung = ${wand.grund.slice(0, 900)}, pruefung = ${JSON.stringify(pruefungNeu)}, updated_at = NOW() WHERE id = ${id}
        `.catch((x) => console.error("[POSTMEISTER] E-531 beim Nachholen:", String(x).slice(0, 160)));
        const { postmeisterKarteJetzt } = await import("./fiaon-postmeister-entscheidungen");
        await postmeisterKarteJetzt(id);
        // Nachbesserung (Gutachten Kosten): auch hier je Adresse nur EIN offener Wand-Entwurf — Abnahme (senden#4): nur die
        // echte, geprüfte Absenderadresse, nur Entwürfe, die diese Antwort kannte. Gegenprüfung (B13): derselbe Von-Kopf für
        // Adresse und Prüfung; ohne nachbarIds — welche Nachbar-Mails der gespeicherte Text sah, ist unbekannt (nur derselbe Faden).
        await e531AeltereAblegen({
          id, von: mail.von, threadId: r.thread_id ?? null, personId, mailAm: r.empfangen_am ? new Date(r.empfangen_am) : null,
          absenderGeprueft: absenderEcht({ authErgebnis: mail.authErgebnis ?? null, von: mail.von, antwortAn: mail.antwortAn ?? null }).echt,
        });
        console.warn(`[POSTMEISTER] Versand ${r.postfach}/${r.gmail_id} nicht nachgeholt: ${wand.grund}`);
        continue;
      }
      // Das HTML aus dem Erstversuch. Fehlt es (Altzeile), wird es aus dem Text
      // gebaut — derselbe Weg wie beim Freigeben eines Entwurfs.
      let html: string | null = r.antwort_html ? String(r.antwort_html) : null;
      if (!html) {
        const { antwortAusText, grussMitAgent } = await import("./fiaon-postmeister-antworttext");
        const { agentName } = await import("./fiaon-postmeister-agent");
        const { postfachGruss } = await import("./fiaon-postmeister-postfaecher");
        const name = await agentName();
        html = antwortAusText(text, {
          schritt: jsonLesen(r.naechster_schritt), betreff: String(r.betreff || ""), sprache: r.sprache ?? null,
          agentName: name, gruss: grussMitAgent(postfachGruss(String(r.postfach)), name),
        }).html;
      }
      // E-531 (Gegenprüfung Runde 4): wie beim ersten Versand nur an die geprüfte, gespeicherte Absenderadresse.
      await antwortSenden(String(r.postfach), mail, text, html, gebaut.dateien, personId ? { an: absenderAdresse(mail.von) } : {});
      await sqlPool`
        UPDATE fiaon_postmeister SET aktion = 'auto_beantwortet', gesendet_am = NOW(), versand_versuche = ${versuch},
               versand_fehler = NULL, naechster_versuch_am = NULL, in_arbeit_seit = NULL, updated_at = NOW() WHERE id = ${id}
      `.catch((e) => console.error("[POSTMEISTER] nachholen speichern:", String(e).slice(0, 160)));
      await uebergabeSchliessen({ id, personId, ref }, "Mara (automatisch)", `Antwort gesendet (nachgeholt, Versuch ${versuch}), Mail #${id}.`);
      await ablegen(String(r.postfach), String(r.gmail_id), "FIAON/Auto-beantwortet", ["UNREAD"]);
      await akteVermerk(ref, personId, `Antwort gesendet (nachgeholt, Versuch ${versuch}${gebaut.dateien.length ? `, mit ${gebaut.dateien.map((d) => d.dateiname).join(", ")}` : ""}): ${text.slice(0, 400)}`);
      console.log(`[POSTMEISTER] Versand ${r.postfach}/${r.gmail_id} nachgeholt (Versuch ${versuch}).`);
      erg.gesendet += 1;
    } catch (e: any) {
      const grund = String(e?.message || e).slice(0, 300);
      const wartezeit = WIEDERVORLAGE_MS[versuch];
      if (wartezeit) await verschieben(grund, new Date(Date.now() + wartezeit));
      else await aufgeben(grund);
    }
  }
  return erg;
}
