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
import { einordnen, antwortErzeugen, maraMailVermerk, antwortSprache, type Vorgeschichte } from "./fiaon-postmeister-agent";
import { personSuchen, akteLesen } from "./fiaon-postmeister-dossier";
import { anredeBestimmen, antwortBauen } from "./fiaon-postmeister-antworttext";
import { postmeisterSchema } from "./fiaon-postmeister-schema";
import { wirdBedient, POSTFAECHER } from "./fiaon-postmeister-postfaecher";
import { AUTOMATEN_DOMAENEN, type Aktion } from "@shared/fiaon-postmeister-typen";
import { kiPausiert, istKiPause } from "./fiaon-ki-pause";
// E-272 (02.10.2026): die eine Regel „Kunde von FIAON Global“ (fiaon-global-kunde.ts)
import { istGlobalKunde } from "./fiaon-global-kunde";

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
} as const;

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

export function menschNoetig(
  e: { kategorien: readonly string[]; flags: object; dringend: boolean }, text: string,
  opt: { globalKunde?: boolean } = {},
): string | null {
  const f = (e.flags || {}) as Record<string, boolean>;
  if (f.beschwerde) return UEBERGABE_GRUND.beschwerde;
  if (f.bestreitet) return UEBERGABE_GRUND.bestreitet;
  if (f.droht_anwalt || f.rechtlich) return UEBERGABE_GRUND.rechtlich;
  if (f.widerruf) return UEBERGABE_GRUND.widerruf;
  if (f.zahlungsunfaehig) return UEBERGABE_GRUND.zahlungsunfaehig;
  // E-275: Global-Kunden bleiben bei Justin — nie eine automatische Antwort (E-272).
  if (opt.globalKunde) return UEBERGABE_GRUND.global;
  const k = new Set(e.kategorien || []);
  // E-275: „sonstiges“ ist kein Grund mehr (#6120) — Mara beantwortet es selbst.
  if (k.has("beschwerde") || k.has("rechtlich") || k.has("vertrieb_komplex")) return UEBERGABE_GRUND.mensch;
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
 */
export function uebergabeUrteil(ein: {
  text: string; gesendet: UebergabeMail; mails: UebergabeMail[]; menschEntscheidet?: boolean;
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
  opt: { menschEntscheidet?: boolean } = {},
): Promise<boolean> {
  const bedient = POSTFAECHER.map((p) => p.adresse.toLowerCase());
  let geschlossen = false;
  for (const k of schliessKandidaten(ein)) {
    try {
      const [t] = (await sqlPool`
        SELECT t.id, t.text FROM fiaon_betreiber_todos t
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
      const urteil = uebergabeUrteil({ text, gesendet, mails, menschEntscheidet: !!opt.menschEntscheidet });
      if (!urteil.schliessen) {
        // Die Antwort gehört zu dieser Aufgabe, aber ihr Grund verlangt mehr —
        // der Betreuer soll sehen, dass die Mail raus ist und was noch fehlt.
        if (urteil.trifft && urteil.grund.startsWith("verlangt mehr")) {
          await sqlPool`
            INSERT INTO fiaon_betreiber_todo_beitraege (todo_id, autor_art, autor_name, art, text)
            VALUES (${Number(t.id)}, 'system', 'Mara', 'kommentar',
                    ${`Antwort auf Mail #${ein.id} ist gesendet (${wer.slice(0, 80)}). Die Aufgabe bleibt offen — ${urteil.grund}. Bitte selbst nachfassen und dann erledigen.`})
          `.catch((e) => console.error("[POSTMEISTER] Übergabe-Hinweis:", String(e).slice(0, 160)));
          await sqlPool`UPDATE fiaon_betreiber_todos SET letzte_aktivitaet = NOW(), updated_at = NOW() WHERE id = ${Number(t.id)}`.catch(() => {});
        }
        continue;
      }
      const fertig = (await sqlPool`
        UPDATE fiaon_betreiber_todos t
           SET status = 'erledigt', erledigt_am = NOW(), erledigt_von = ${wer.slice(0, 120)},
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
      if (fertig.length) geschlossen = true;
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

/**
 * Die anderen Mails desselben Kunden aus den letzten drei Tagen, die NICHT in
 * diesem Faden stehen (E-248). Schreibt jemand in drei Fäden kurz hintereinander,
 * sieht Mara alle drei und was sie darauf schon geantwortet hat — eine Antwort,
 * die an die vorige anknüpft, statt dreimal von vorn.
 */
async function nachbarMails(personId: number | null, id: number, threadId: string): Promise<{ von: string; am: string; text: string }[]> {
  if (personId == null) return [];
  const zeilen = (await sqlPool`
    SELECT text, antwort, gesendet_am, aktion, COALESCE(empfangen_am, created_at) AS am
      FROM fiaon_postmeister
     WHERE person_id = ${personId} AND id <> ${id} AND COALESCE(thread_id, '') <> ${threadId || "-"}
       AND aktion NOT IN ('ignoriert') AND COALESCE(empfangen_am, created_at) > NOW() - INTERVAL '3 days'
     ORDER BY COALESCE(empfangen_am, created_at) ASC LIMIT 8`.catch(() => [])) as any[];
  const aus: { von: string; am: string; text: string }[] = [];
  for (const z of zeilen) {
    const am = new Date(z.am).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    if (z.text) aus.push({ von: "Kunde (andere Mail von ihm, anderer Faden)", am, text: String(z.text).slice(0, 1500) });
    if (z.antwort && (z.gesendet_am || z.aktion === "auto_beantwortet")) {
      aus.push({ von: "FIAON (unsere Antwort darauf — er hat sie bekommen)", am, text: String(z.antwort).slice(0, 1500) });
    }
  }
  return aus;
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

export interface LaufErgebnis { aktion: Aktion; grund: string; id: number | null }

/**
 * Eine Mail verarbeiten. `nurOrdnen` schreibt keine Antwort — für den ersten
 * Durchgang über den Altbestand.
 */
export async function mailBearbeiten(ein: {
  postfach: string; gmailId: string; gruss: string;
  modus: "auto" | "hybrid" | "entwurf" | "aus";
  nurOrdnen?: boolean;
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
    ON CONFLICT (gmail_id) DO NOTHING RETURNING id, versuche, gesendet_am, begruendung, created_at
  `) as any[];
  if (!anspruch.length) {
    anspruch = (await sqlPool`
      UPDATE fiaon_postmeister SET aktion = 'in_arbeit', in_arbeit_seit = NOW(), versuche = versuche + 1, updated_at = NOW()
       WHERE gmail_id = ${gmailId}
         AND (aktion = 'vorgeordnet'
              OR (aktion = 'fehler' AND (naechster_versuch_am IS NULL OR naechster_versuch_am <= NOW()))
              OR (aktion = 'in_arbeit' AND COALESCE(in_arbeit_seit, updated_at) < NOW() - INTERVAL '15 minutes'))
         AND versuche < 3
       RETURNING id, versuche, gesendet_am, begruendung, created_at
    `) as any[];
    if (!anspruch.length) return { aktion: "geordnet", grund: "schon bearbeitet", id: null };
  }
  const id = Number(anspruch[0].id);
  /** E-246: Beim Zurücklegen in der Pause wird der Zähler auf den Stand vor diesem Anspruch gebracht. */
  const neuAngelegt = Number(anspruch[0].versuche ?? 0) === 0; // frisch angelegt: 0, erneut beansprucht: alter Wert + 1
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
    if (mail.messageIdHeader) {
      const [doppelt] = (await sqlPool`
        SELECT postfach FROM fiaon_postmeister
         WHERE message_id = ${mail.messageIdHeader} AND id <> ${id} AND aktion NOT IN ('fehler', 'in_arbeit') LIMIT 1
      `) as any[];
      if (doppelt) {
        return fertig({ ...basis, aktion: "geordnet", begruendung: `Dieselbe Mail liegt auch in ${doppelt.postfach}` }, "Doppelzustellung");
      }
    }

    // 3. Wer schreibt da?
    const wer = await personSuchen(mail.von, neuerText);
    fuerAufgabe = { personId: wer.personId, ref: wer.ref, betreff: mail.betreff };
    const alterTage = Math.floor((Date.now() - mail.datum.getTime()) / 86_400_000);

    // 4. Einordnen.
    const einordnung = await einordnen({ betreff: mail.betreff, text: textFuerMara, von: mail.von, alterTage })
      .catch((e) => { if (istKiPause(e)) throw e; throw new Error(`Einordnung: ${String(e?.message || e).slice(0, 160)}`); });

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

    // 5. Akte-Vermerk — JEDE Kundenmail wird nachgetragen.
    const akte = await akteLesen(wer.personId, wer.ref);
    if (wer.ref) {
      // E-246 (Nachprüfung 27.09.): Lag die Mail aus der KI-Pause und steht der
      // Vermerk zu dieser Mail schon da (erster Anlauf kam bis hierher, die Pause
      // traf erst die Antwort), keinen zweiten schreiben.
      const kopf = `E-Mail an ${postfach}: „${mail.betreff.slice(0, 90)}" — `;
      const schonDa = ausDerPause && ((await sqlPool`
        SELECT 1 FROM fiaon_contact_log
         WHERE ref = ${wer.ref} AND agent_name = 'Postmeister' AND created_at >= ${zeileSeit}
           AND LEFT(note, ${kopf.length}) = ${kopf}
         LIMIT 1`.catch(() => [])) as any[]).length > 0;
      if (!schonDa) await sqlPool`
        INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
        VALUES (${wer.ref}, ${wer.personId}, NULL, 'Postmeister', 'system',
                ${`${kopf}${einordnung.zusammenfassung.slice(0, 400)}`})
      `.catch(() => {});
    }

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

    // 6. Verlauf und Antwort.
    const verlauf = await verlaufLesen(postfach, mail.threadId, gmailId);
    // E-248: Seine anderen Mails der letzten drei Tage (andere Fäden) und unsere Antworten darauf.
    const nachbarn = await nachbarMails(wer.personId, id, mail.threadId);
    if (nachbarn.length) verlauf.unshift(...nachbarn);
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
      postfach, mail: { betreff: mail.betreff, text: textFuerMara, von: mail.von, alterTage },
      verlauf, einordnung, personId: wer.personId, ref: wer.ref, postmeisterId: id,
      sprache: antwortSpracheCode, vorgeschichte,
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
    const anrede = await anredeBestimmen(wer.personId, vor || null, restName.join(" ") || null, sprache);
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
    const kuendigungGebucht = erg.handlungen.some((h) => h.ok && h.werkzeug === "kuendigung_vormerken") || !!akte.kuendigung;
    // E-275 (02.10.2026): Global-Kunden bleiben bei Justin (E-272) — die eine Regel, hier für den Entwurf.
    const globalAbsender = await globalUebergabe(wer.personId);
    let mensch = menschNoetig(einordnung, neuerText, { globalKunde: globalAbsender })
      ?? (vorgeschichte ? UEBERGABE_GRUND.vorgeschichte : null)
      // Kündigung angesprochen, nicht gebucht: ein Mensch prüft — nie still liegen lassen (#5626, #4682).
      ?? (einordnung.flags?.kuendigung && !kuendigungGebucht && !erg.automatischErlaubt ? UEBERGABE_GRUND.kuendigung : null);
    // E-275: Der Rückrufwunsch ist erledigt, wenn Mara ihn selbst eingeplant hat (Aufgabe mit Rückruf, Notiz mit
    // Anruf, Terminlink) — dann geht ihre Antwort („Herr Stripling ruft Sie morgen um 10 Uhr an“) ohne zweite
    // Übergabe raus, sofern die Prüfung sie freigibt (die Lampe rueckruf_wunsch fällt dort ebenso).
    if (mensch === UEBERGABE_GRUND.ansprechpartner
      && erg.handlungen.some((h) => h.ok && ["aufgabe_an_betreuer", "notiz_an_betreuer", "terminlink_bauen"].includes(h.werkzeug))) {
      mensch = null;
    }
    // E-248: Sperre direkt vor dem Senden — ist auf denselben Text schon eine Antwort raus, keine zweite.
    const sperre = ein.modus === "auto" && erg.automatischErlaubt && !mensch ? await sendeSperre(id) : null;
    if (sperre) {
      await ablegen(postfach, gmailId, "FIAON/Doppelt");
      return fertig({ ...gemeinsam, kundenlage, aktion: "geordnet", begruendung: `Doppel von Mail #${sperre.doppelVon} — ${sperre.grund}; nur eine Antwort (E-248)` }, "Doppel");
    }
    const darfAuto = ein.modus === "auto" && erg.automatischErlaubt && !ein.nurOrdnen && !mensch;
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
        await antwortSenden(postfach, mail, fertigeAntwort.text, fertigeAntwort.html, gebaut.dateien);
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

    const draftId = await entwurfAnlegen(postfach, mail, fertigeAntwort.text, fertigeAntwort.html, gebaut.dateien).catch(() => null);
    await ablegen(postfach, gmailId, "FIAON/Entwurf wartet");
    const ergebnis = await fertig({ ...felder, aktion: "entwurf", antwort_draft_id: draftId, begruendung: mensch ? `Übergabe an den Betreuer: ${mensch}` : erg.grund }, erg.grund);
    // E-240: Auch der Entwurf steht in der Akte — der Betreuer, der anruft, sieht,
    // was Mara vorgeschlagen und schon getan hat (Angebot, Aufgabe, Rechnung).
    await maraMailVermerk({
      personId: wer.personId, ref: wer.ref, kundeText: neuerText, antwort: erg.antwort, art: "entwurf",
      handlungen: erg.handlungen, grund: mensch ? `Übergabe an den Betreuer: ${mensch}` : erg.grund,
    });
    // Der Entwurf wartet nicht mehr nur in der Zentrale: Der Betreuer bekommt
    // die Mail samt Maras Vorschlag als Aufgabe und kann ihn senden, ändern
    // oder selbst antworten (Aufgaben → „E-Mail anzeigen").
    await anBetreuerUebergeben({
      id, personId: wer.personId, ref: wer.ref, postfach, betreff: mail.betreff,
      zusammenfassung: einordnung.zusammenfassung, grund: mensch ?? "Mara hat einen Entwurf vorbereitet, aber nicht gesendet.",
      dringend: einordnung.dringend || !!mensch,
    });
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
               begruendung = ${"KI pausiert — wartet auf das Aktivieren"}, updated_at = NOW()
         WHERE id = ${id} AND gesendet_am IS NULL
      `.catch((x) => console.error("[POSTMEISTER] Pause zurücklegen:", String(x).slice(0, 160)));
      console.warn(`[POSTMEISTER] ${postfach}/${gmailId}: KI pausiert — zurückgelegt.`);
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
      await antwortSenden(String(r.postfach), mail, text, html, gebaut.dateien);
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
