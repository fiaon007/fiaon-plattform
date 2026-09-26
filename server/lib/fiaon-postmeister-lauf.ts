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
  nachrichtLesen, nachrichtLabeln, labelSicherstellen, entwurfAnlegen, antwortSenden,
  type GmailNachricht,
} from "./fiaon-gmail";
import { einordnen, antwortErzeugen, maraMailVermerk } from "./fiaon-postmeister-agent";
import { personSuchen, akteLesen } from "./fiaon-postmeister-dossier";
import { anredeBestimmen, antwortBauen } from "./fiaon-postmeister-antworttext";
import { postmeisterSchema } from "./fiaon-postmeister-schema";
import { wirdBedient, POSTFAECHER } from "./fiaon-postmeister-postfaecher";
import { AUTOMATEN_DOMAENEN, type Aktion } from "@shared/fiaon-postmeister-typen";

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
    const a = await auftragFuerKunden({
      personId: ein.personId, ref: ein.ref,
      titel: ein.art === "versand" ? "Mail-Antwort konnte nicht gesendet werden" : "Mail-Antwort konnte nicht erzeugt werden",
      text, dringend: true, schluessel: `postmeister:${ein.id}:${ein.art}`, quelle: "postmeister", autorName: "Mara",
      link: "/chef/s/postmeister", anBetreiber: !ein.personId && !ein.ref,
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

export function menschNoetig(e: { kategorien: readonly string[]; flags: object; dringend: boolean }, text: string): string | null {
  const f = (e.flags || {}) as Record<string, boolean>;
  if (f.beschwerde) return UEBERGABE_GRUND.beschwerde;
  if (f.bestreitet) return UEBERGABE_GRUND.bestreitet;
  if (f.droht_anwalt || f.rechtlich) return UEBERGABE_GRUND.rechtlich;
  if (f.widerruf) return UEBERGABE_GRUND.widerruf;
  if (f.zahlungsunfaehig) return UEBERGABE_GRUND.zahlungsunfaehig;
  const k = new Set(e.kategorien || []);
  if (k.has("beschwerde") || k.has("rechtlich") || k.has("vertrieb_komplex") || k.has("sonstiges")) return UEBERGABE_GRUND.mensch;
  if (e.dringend) return UEBERGABE_GRUND.dringend;
  // E-240: Unser eigener Fuß („… direkt an Ihren Ansprechpartner") zählt nie als Wunsch des Kunden —
  // falls ein Zitat doch einmal durchrutscht, ohneZitat ist der erste Riegel.
  const eigenerText = String(text || "").replace(/Fragen\? Antworten Sie einfach auf diese E-Mail[^\n]{0,160}?Ansprechpartner\.?/gi, "");
  if (/\b(ansprechpartner(in)?|betreuer(in)?|sachbearbeiter(in)?|mitarbeiter(in)?|einen menschen|mit jemandem sprechen|persönlich sprechen|rufen sie mich|ruft mich|rückruf|zurückrufen|anrufen)\b/i.test(eigenerText)) {
    return UEBERGABE_GRUND.ansprechpartner;
  }
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
    const a = await auftragFuerKunden({
      personId: ein.personId, ref: ein.ref,
      titel: ein.dringend ? "Kunde hat geschrieben — bitte heute antworten" : "Kunde hat geschrieben — bitte antworten",
      text: uebergabeBlock(ein),
      dringend: ein.dringend,
      schluessel: uebergabeSchluessel(ein),
      quelle: "postmeister", autorName: "Mara",
      link: ein.personId ? `/agent/kunden?person=${ein.personId}` : ein.ref ? `/agent/kunden?ref=${ein.ref}` : "/chef/s/postmeister",
      anBetreiber: !ein.personId && !ein.ref,
    });
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
               (p.gesendet_am IS NOT NULL OR COALESCE(p.begruendung, '') LIKE 'Vom Betreuer übernommen%') AS beantwortet
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

  // Anspruch — läuft der Takt doppelt, arbeitet nur einer.
  // 11.09.2026 (E-184): Eine 'fehler'-Zeile wird erst wieder beansprucht, wenn
  // ihre Wiedervorlage (naechster_versuch_am) fällig ist — vorher kam sie in
  // JEDEM 5-Minuten-Takt erneut dran, vier KI-Läufe in 20 Minuten. Ein
  // 'in_arbeit' älter als 15 Minuten ist ein abgebrochener Lauf (Neustart).
  let anspruch = (await sqlPool`
    INSERT INTO fiaon_postmeister (postfach, gmail_id, thread_id, aktion, in_arbeit_seit)
    VALUES (${postfach}, ${gmailId}, '', 'in_arbeit', NOW())
    ON CONFLICT (gmail_id) DO NOTHING RETURNING id, versuche, gesendet_am
  `) as any[];
  if (!anspruch.length) {
    anspruch = (await sqlPool`
      UPDATE fiaon_postmeister SET aktion = 'in_arbeit', in_arbeit_seit = NOW(), versuche = versuche + 1, updated_at = NOW()
       WHERE gmail_id = ${gmailId}
         AND (aktion = 'vorgeordnet'
              OR (aktion = 'fehler' AND (naechster_versuch_am IS NULL OR naechster_versuch_am <= NOW()))
              OR (aktion = 'in_arbeit' AND COALESCE(in_arbeit_seit, updated_at) < NOW() - INTERVAL '15 minutes'))
         AND versuche < 3
       RETURNING id, versuche, gesendet_am
    `) as any[];
    if (!anspruch.length) return { aktion: "geordnet", grund: "schon bearbeitet", id: null };
  }
  const id = Number(anspruch[0].id);
  /** Bisherige Anläufe (0 beim ersten) — der laufende ist Nummer versuche + 1. */
  const versuche = Number(anspruch[0].versuche ?? 0);

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
    const anhangHinweis = mail.anhaenge.length
      ? `\n\n[Der Kunde hat ${mail.anhaenge.length} Datei(en) mitgeschickt: ${mail.anhaenge.map((a) => `${a.name} (${a.typ}, ${Math.max(1, Math.round(a.groesse / 1024))} KB)`).join("; ")}. Du kannst sie nicht öffnen; im Postfach sieht ein Mensch sie. Zählt der Inhalt, bestätige dem Kunden den Eingang und leg eine Aufgabe an, die Datei zu prüfen: einen Zahlungsbeleg an die Zahlungsstelle (kollege: "Zahlung"), Ausweis, Unterlagen oder Schreiben an den Betreuer.]`
      : "";
    const textFuerMara = neuerText + anhangHinweis;

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
      .catch((e) => { throw new Error(`Einordnung: ${String(e?.message || e).slice(0, 160)}`); });

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
      await sqlPool`
        INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
        VALUES (${wer.ref}, ${wer.personId}, NULL, 'Postmeister', 'system',
                ${`E-Mail an ${postfach}: „${mail.betreff.slice(0, 90)}" — ${einordnung.zusammenfassung.slice(0, 400)}`})
      `.catch(() => {});
    }

    const kundenlage = akte.kundenlage;
    if (ein.nurOrdnen || ein.modus === "aus") {
      return fertig({ ...gemeinsam, kundenlage, aktion: "vorgeordnet", begruendung: "nur eingeordnet" }, "nur geordnet");
    }

    // 6. Verlauf und Antwort.
    const verlauf = await verlaufLesen(postfach, mail.threadId, gmailId);
    const erg = await antwortErzeugen({
      postfach, mail: { betreff: mail.betreff, text: textFuerMara, von: mail.von, alterTage },
      verlauf, einordnung, personId: wer.personId, ref: wer.ref, postmeisterId: id,
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
    const sprache = einordnung.sprache && einordnung.sprache.slice(0, 2) !== "de"
      ? einordnung.sprache
      : (akte.sprache || einordnung.sprache);
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
    const mensch = menschNoetig(einordnung, neuerText);
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
