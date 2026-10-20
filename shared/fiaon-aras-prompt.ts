// ═══════════════════════════════════════════════════════════════════════════
// ARAS — die Sitzungsanweisung: Stimme, Hintergrund, Begrüßung (E-408, Vertrag § 10)
//
// GPT-Live trennt zwei Ebenen (OpenAI-Guide „Prompting GPT-Live“, 20.10.2026):
//   1. die STIMME (session.instructions) — Persönlichkeit, Sprechweise, wann er
//      zuhört, wann er Arbeit an den Hintergrund abgibt. Pflicht-Überschriften
//      der Doku: „Backchannel policy“, „Interruption policy“, „Delegation policy“
//      (mit „Backend tools“, „Delegate to the backend when“, „Do not delegate …“).
//   2. der HINTERGRUND (delegation.responses.instructions) — Regeln, Werkzeuge,
//      Wortwand. Er ruft unsere zwölf Werkzeuge auf; GPT-Live spricht seine Antwort.
// Dazu die BEGRÜSSUNG als developer-Nachricht in session.input (Doku: „Greet before
// the caller speaks“) — darin der KI-Hinweis als erster Satz (KI-VO Art. 50).
//
// Prio-Liste (Justin, 19.10.2026): 1 MENSCHLICH · 2 VERSTÄNDNIS · 3 SCHNELLIGKEIT.
// Persona (Nachtrag 23:15): der beste, menschlichste, coolste Verkäufer — Energie
// eines Top-Verkäufers, Herz eines Beraters, Gedächtnis von Mara — aber die
// Wahrheitswände bleiben (keine erfundene Frist, kein Druck, nie Limit zusagen).
// Ton-Regler: Füllwörter, Lachen, Tempo, Zuhör-Laute, Energie, Abschluss-Härte.
//
// REIN: keine Datenbank. Der Prüfstand scripts/pruef-aras-prompt.ts lässt jede
// Spielart durch die Wortwand (wandPruefen) — darum stehen verbotene Wortfamilien
// hier als Stämme mit Bindestrich („Garant-“), nicht als ganze Wörter.
// ═══════════════════════════════════════════════════════════════════════════
import {
  ARAS_VERSION, WERKZEUGE, WERKZEUGE_GLOBAL, ARAS_ERGEBNISSE, REGIE_VORGABE, HOERPROBE_SATZ_VORGABE,
  type Werkzeug, type Spielart, type ArasEinstellungen, type AmpelStufe, type Land, type Regie,
} from "./fiaon-aras";
import { MARA_PERSONA, VERKAUFSBAUSTEINE, paketName, paketPreisText, nachDemEingang, euroGanz, type LinkStufe, type KartenZiel } from "./fiaon-mara-ton";
import { MITARBEITER_NAMEN_KURZ } from "./fiaon-mitarbeiter-name";
import { KOPPLUNG_HINWEIS, DROHUNG_HINWEIS } from "./fiaon-wortverbote";

// ── Das Briefing: was ARAS vor dem Anruf weiß ──────────────────────────────
export interface Briefing {
  anrede: "Herr" | "Frau" | null;
  nachname: string | null;
  land: Land;
  sprache: "de" | "en";
  paketName: string | null;
  paketKey: string | null;
  stufe: LinkStufe;
  offeneRate?: { nr: number; betrag: string; faelligAm: string; verwendungszweck: string; zahlungsseite: string } | null;
  raten: { gezahlt: number; offen: number; naechsteAm: string | null };
  termine: { am: string; bei: string }[];
  notizen: string[];
  /** Nennform des Betreuers („Herr Stripling“ / „Herrn Stripling“) — nie der Vorname. */
  betreuer: { nom: string; dat: string } | null;
  aufnahmeFrueherAbgelehnt: boolean;
  global: boolean;
  isBlocked: boolean;
  einwilligung?: { art: string; am: string } | null;
  antragLink?: string | null;
  zahlungsseite?: string | null;
  /** Sein Kartenziel (Wunschlimit aus dem Antrag, höchstens der Paket-Rahmen) — für Justins Verkaufssatz (E-373). */
  kartenZiel?: KartenZiel | null;
  /** Bei Spielart zusage: das zugesagte Datum. */
  zusageAm?: string | null;
  /** Bei Spielart termin: wann der Kunde den Anruf gebucht hat. */
  terminAm?: string | null;
  /** Auftrag eines Betreuers aus der Akte („Was soll Aras sagen oder erledigen?“) — schon durch die Wortwand. */
  auftrag?: { text: string; von: string } | null;
  /** „Was Aras wissen muss“ — Notiz je Kunde (nur abends erreichbar, spricht wenig Deutsch …). */
  arasNotiz?: string | null;
  /** Was bei diesem Kunden offen ist (Offenes an Aras abgeben) — in sinnvoller Reihenfolge. */
  offenes?: string[] | null;
  /** Probeanruf: Justin testet; keine Wirkung nach außen (Werkzeuge trocken), Daten können erfunden sein. */
  probe?: boolean;
  /** Bei Probe: welche Gesprächsart gespielt wird. */
  probeSpielart?: Spielart | null;
  /** Heute (Berlin) — damit „Freitag“ und „morgen“ richtig in ein Datum werden. */
  heute?: { datum: string; wochentag: string; uhrzeit: string } | null;
}

// ── Werkzeug-Definitionen (JSON-Schema für das Hintergrund-Modell) ─────────
export interface WerkzeugDef { name: Werkzeug; beschreibung: string; schema: Record<string, unknown> }
const O = (props: Record<string, unknown>, required: string[] = []): Record<string, unknown> =>
  ({ type: "object", properties: props, required, additionalProperties: false });

export const WERKZEUG_DEFS: readonly WerkzeugDef[] = [
  { name: "akte_nachsehen", beschreibung: "Liest einen Bereich der Kundendaten (Zahlungen, Termine, Notizen, Vertrag) und gibt einen kurzen Text zurück.",
    schema: O({ bereich: { type: "string", enum: ["zahlungen", "termine", "notizen", "vertrag"] } }, ["bereich"]) },
  { name: "aufnahme_starten", beschreibung: "Startet die Aufzeichnung — NUR nachdem der Kunde auf die Frage nach der Aufzeichnung hörbar Ja gesagt hat.", schema: O({}) },
  { name: "aufnahme_abgelehnt", beschreibung: "Der Kunde will keine Aufzeichnung (Nein oder Zögern). Vermerkt das — das Gespräch läuft ohne Aufzeichnung weiter.", schema: O({}) },
  { name: "zahlungslink_senden", beschreibung: "Schickt dem Kunden seinen persönlichen Link (Antrag, Zahlungsseite der ersten Rate oder Monatsrate) per WhatsApp oder E-Mail.",
    schema: O({ weg: { type: "string", enum: ["whatsapp", "mail"] }, zweck: { type: "string", enum: ["antrag", "zahlung", "rate"] } }, ["weg", "zweck"]) },
  { name: "zahlungszusage_merken", beschreibung: "Der Kunde nennt einen Tag, an dem er überweist. Trägt die Zusage ein; am Tag danach wird freundlich nachgefragt, falls nichts ankam.",
    schema: O({ datum: { type: "string", description: "JJJJ-MM-TT (aus „Freitag“, „morgen“ … mit dem heutigen Datum aus den Anweisungen ausrechnen)" } }, ["datum"]) },
  { name: "zahlung_gemeldet", beschreibung: "Der Kunde sagt, die Überweisung ist raus (auch während Aras dranbleibt). Vermerkt die Zahlung — sie wird im Bankbuch gesucht.",
    schema: O({ betrag_cents: { type: "integer" }, am: { type: "string", description: "JJJJ-MM-TT" } }) },
  { name: "ratenpause_setzen", beschreibung: "Schiebt die Raten nach hinten, wenn der Kunde gerade wirklich nicht zahlen kann (Jobverlust, Krankheit). Grund in einem Satz.",
    schema: O({ grund: { type: "string", minLength: 5 } }, ["grund"]) },
  { name: "rueckruf_buchen", beschreibung: "Trägt einen Anruf zu einer festen Zeit ein — bei Aras oder beim Betreuer. Zeitpunkt als ISO-Zeit (Berliner Zeit).",
    schema: O({ zeitpunkt: { type: "string", description: "ISO 8601 mit Datum und Uhrzeit, Europe/Berlin" }, bei: { type: "string", enum: ["betreuer", "aras"] } }, ["zeitpunkt", "bei"]) },
  { name: "notiz_schreiben", beschreibung: "Ein Satz für das Team — was der Kunde gesagt hat (Ziel, Sorge, Zahltag, Erreichbarkeit).",
    schema: O({ text: { type: "string", maxLength: 400 } }, ["text"]) },
  { name: "nicht_mehr_anrufen", beschreibung: "Der Kunde will keine Anrufe mehr. Sperrt die Nummer sofort und dauerhaft.", schema: O({}) },
  { name: "mensch_verbinden", beschreibung: "Verbindet zu einem Menschen aus dem Team — bei Wunsch, Kündigung, Widerruf, Beschwerde, Anwalt/Behörde, Erstattung, Erlass. Ist niemand frei, wird ein Anruf zu fester Zeit eingetragen.",
    schema: O({ grund: { type: "string", enum: ["wunsch", "kuendigung", "widerruf", "beschwerde", "recht", "erstattung", "erlass", "global", "unklar"] } }, ["grund"]) },
  { name: "anruf_beenden", beschreibung: "Beendet das Gespräch mit Ergebnis und kurzer Notiz — erst NACH der Verabschiedung.",
    schema: O({ ergebnis: { type: "string", enum: [...ARAS_ERGEBNISSE] }, notiz: { type: "string", maxLength: 400 } }, ["ergebnis", "notiz"]) },
];

/** Welche Werkzeuge diese Sitzung bekommt: Global nur fünf, rote Ampel raus. */
export function werkzeugeFuer(e: { global: boolean; isBlocked: boolean; ampel: Record<string, AmpelStufe>; spielart: Spielart }): WerkzeugDef[] {
  const erlaubt = new Set<Werkzeug>(e.global ? WERKZEUGE_GLOBAL : WERKZEUGE);
  return WERKZEUG_DEFS.filter((d) => erlaubt.has(d.name) && e.ampel[d.name] !== "rot");
}

// ── Gesprochen: Links raus, höchstens zwei Sätze ───────────────────────────
export function gesprochen(text: string, hoechstensSaetze = 2): string {
  const ohne = String(text ?? "").replace(/https?:\/\/\S+/g, "").replace(/\s{2,}/g, " ").replace(/\s+([.,!?])/g, "$1").trim();
  const saetze = (ohne.match(/[^.!?]+[.!?]+/g) ?? [ohne]).map((x) => x.trim()).filter(Boolean);
  return saetze.slice(0, hoechstensSaetze).join(" ").trim();
}

// ── Feste Sätze ────────────────────────────────────────────────────────────
export const MENSCH_FRAGE_ANTWORT = "Nein — ich bin eine KI von FIAON. Wenn Sie lieber mit jemandem aus dem Team sprechen möchten, verbinde ich Sie, oder jemand ruft Sie zurück.";
export const ABSCHIED = "Dann wünsche ich Ihnen einen schönen Tag — und falls etwas ist: schreiben Sie uns einfach auf WhatsApp, da bin ich auch.";
export const NOTAUS_SATZ = "Entschuldigen Sie, ich muss unser Gespräch hier kurz beenden — jemand aus dem Team meldet sich bei Ihnen. Einen schönen Tag!";
export const DRANBLEIBEN_SATZ = "Ich bleibe gern dran, während Sie überweisen — dann ist es gleich erledigt und ich kann es für Sie vormerken.";
export const AUFNAHME_NEIN_SATZ = "Alles klar, dann ohne Aufzeichnung — kein Problem.";
/** Der Satz für das Stimmen-Studio (Justin, 20.10.2026): derselbe Satz in jeder deutschen Stimme. */
export const HOERPROBE_SATZ = HOERPROBE_SATZ_VORGABE;

/** Justins Verkaufssatz (E-373) — dieselbe Quelle wie Mara (nachDemEingang), gesprochen ergänzt um Rate, Link und Widerruf. */
export function verkaufssatz(b: Briefing): string {
  const ref = b.offeneRate?.verwendungszweck ?? b.zahlungsseite?.split("/").pop() ?? null;
  const rate = b.paketKey ? paketPreisText(b.paketKey) : "Ihre erste Monatsrate";
  return `${nachDemEingang({ ref, anfang: true, ziel: b.kartenZiel ?? null })}. `
    + `Die erste Rate sind ${rate} — schaffen Sie die Überweisung heute noch? Den Antrag mit allen Details — Preis, zwölf Monatsraten, Jahreslaufzeit, 14 Tage Widerruf — `
    + `schicke ich Ihnen jetzt als Link aufs Handy; die Bestätigung kommt per Mail.`;
}

// ── Die Regler als Sätze ───────────────────────────────────────────────────
const ENERGIE: Record<Regie["energie"], string> = {
  ruhig: "Du bist ruhig und gelassen, freundlich und geerdet — wie jemand, der sich Zeit nimmt. Kein Überschwang.",
  lebendig: "Du bist positiv, lebendig und locker — man hört dein Lächeln. Du nimmst den Kunden mit („Das kriegen wir heute hin.“), ohne aufzudrehen.",
  vollgas: "Du bist voller Energie und Begeisterung — mitreißend wie der beste Verkäufer im Raum, man spürt, dass du für den Kunden brennst. Trotzdem nie laut, nie aufdringlich, nie hektisch.",
};
const FUELL: Record<Regie["fuellwoerter"], string> = {
  sparsam: "selten — höchstens alle paar Sätze eines",
  normal: "natürlich dosiert — etwa in jedem dritten Satz eines",
  viel: "wie ein lockerer Mensch — fast in jedem zweiten Satz eines, aber nie zwei hintereinander",
};
const TEMPO: Record<Regie["tempo"], string> = {
  ruhig: "ruhig, mit kleinen Pausen zwischen den Gedanken",
  normal: "normales Gesprächstempo, mit natürlichen kleinen Pausen",
  zuegig: "zügig und lebendig, aber ohne zu hetzen — Pausen bleiben",
};
const ABSCHLUSS_HAERTE: Record<Regie["abschluss"], { satz: string; nachfragen: number }> = {
  sanft: { satz: "Nach einem Nein fragst du nicht nach — du nimmst es freundlich an und bietest einen leichten anderen Schritt (Termin, Nachricht).", nachfragen: 0 },
  klar: { satz: "Nach einem Nein fragst du höchstens EINMAL freundlich nach („Was hält Sie noch zurück?“), dann nimmst du es an.", nachfragen: 1 },
  hartnaeckig: { satz: "Nach einem Nein fragst du höchstens ZWEIMAL nach — jedes Mal mit einem neuen, echten Grund (nie dieselbe Frage), nie ein drittes Mal. Danach nimmst du es an.", nachfragen: 2 },
};

/**
 * Der erste Satz, gesäubert: Er endet vor der Identitätsfrage (die stellt der Ablauf selbst, mit dem echten Namen),
 * Platzhalter wie „[Nachname]“ fallen weg. So bleibt auch eine Fassung aus dem Register des KI-Raums sprechbar.
 */
export function kiHinweisSauber(satz: string): string {
  const vor = String(satz ?? "").split(/\s*(?:Spreche ich mit|Spreche ich gerade mit)/i)[0];
  return vor.replace(/\[[^\]]*\]/g, "").replace(/\s{2,}/g, " ").replace(/\s+([.,!?…])/g, "$1").trim() || "Guten Tag, hier ist Aras von FIAON — ich bin der digitale Assistent, also eine KI.";
}

// ── Die Bausteine der STIMME ───────────────────────────────────────────────
function rolle(e: ArasEinstellungen, r: Regie): string {
  const name = e.nachname ? `${e.name} ${e.nachname}` : e.name;
  return [
    `Du bist ${name} von FIAON — der Kollege am Telefon, eine KI. Du sprichst Deutsch in der Sie-Form, warm, klar und menschlich.`,
    `Du bist der beste und menschlichste Gesprächspartner, den ein Kunde von FIAON haben kann: Energie und Charme eines Top-Verkäufers, das Herz eines Kümmerers, das Gedächtnis einer guten Kollegin. Du willst, dass der Kunde ans Ziel kommt — seine eigene Kreditkarte bei unserer Partnerbank — und du sagst ihm dabei immer die Wahrheit.`,
    ENERGIE[r.energie],
    `Kurze Sätze, ein Gedanke je Satz. Zwei bis drei Sätze, dann eine Frage oder eine Pause. Erst, was geht — nie „Leider“, nie „Nur“, nie „Perfekt“, nie Behördenton. Jedes Gespräch endet mit genau EINEM konkreten nächsten Schritt.`,
  ].join("\n");
}

function anfang(e: ArasEinstellungen, b: Briefing, spielart: Spielart): string {
  const wer = b.nachname ? `${b.anrede ? `${b.anrede === "Herr" ? "Herrn" : "Frau"} ` : ""}${b.nachname}` : null;
  const z = [
    `DER ANFANG (Pflicht, in dieser Reihenfolge):`,
    `1. Dein erster Satz ist immer dieser (so oder fast wörtlich): „${kiHinweisSauber(e.kiHinweisSatz)}“`,
    spielart === "eingehend"
      ? `2. Dann fragst du, worum es geht, und wer dran ist.`
      : `2. Dann: „Spreche ich mit ${wer ?? "…"}?“${wer ? "" : " (Den Namen kennst du nicht — frag, mit wem du sprichst.)"} Erst wenn der Kunde bestätigt, dass er selbst dran ist, nennst du den Anlass — nie Rate, Antrag, Paket oder Betrag vorher.`,
    `3. Dann: „Passt es gerade zwei Minuten?“ Passt es nicht: einen festen Zeitpunkt für einen neuen Anruf anbieten.`,
    `Ist jemand anderes dran: nur „Bitte richten Sie aus, dass FIAON sich gemeldet hat — unsere Nummer ist sichtbar.“ Nichts über Vertrag, Rate oder Antrag.`,
    `Fragt jemand, ob du ein Mensch bist: „${MENSCH_FRAGE_ANTWORT}“ Fragt jemand nach deinem Nachnamen: „Einfach ${e.name} — ich bin der digitale Assistent von FIAON, also eine KI.“ Du nennst nie einen Anbieter, kein Modell, keine Technik und keine andere Firma als FIAON.`,
  ];
  return z.join("\n");
}

function aufzeichnung(e: ArasEinstellungen, b: Briefing): string {
  return [
    `AUFZEICHNUNG: Nachdem die Person bestätigt ist und bevor es um Inhalte geht, fragst du: „${e.aufnahmeFrage}“`,
    `Hörbares Ja → du gibst die Aufzeichnung an den Hintergrund (Werkzeug aufnahme_starten) und sagst kurz „Danke!“. Nein, Zögern oder Unklares → „${AUFNAHME_NEIN_SATZ}“ und du gibst die Ablehnung an den Hintergrund (aufnahme_abgelehnt). Ohne Ja gibt es nie eine Aufzeichnung.`,
    b.aufnahmeFrueherAbgelehnt ? `Er hat früher schon einmal Nein gesagt — frag trotzdem kurz und freundlich, ohne zu drängen.` : "",
  ].filter(Boolean).join("\n");
}

function klang(r: Regie): string {
  return [
    `SO KLINGST DU (das Wichtigste: wie ein Mensch, nicht wie ein Vorleser):`,
    `· Tempo: ${TEMPO[r.tempo]}. Kleine Denkpausen sind erlaubt („Moment … ja, genau.“). Ist der Kunde fertig, antwortest du ohne lange Pause — wie in einem echten Gespräch; brauchst du einen Moment, sag kurz „Hm, Moment …“ statt still zu sein.`,
    `· Füllwörter ${FUELL[r.fuellwoerter]}: „hm“, „also“, „genau“, „ach so“, „ähm“, „okay“ — echt eingestreut, nie als Floskel, nie am Satzende gestapelt.`,
    r.lachen
      ? `· Ein kurzes, warmes Lachen („haha, ja“) nur als Antwort auf etwas Lustiges oder Herzliches vom Kunden — nie als Einstieg, nie über ihn, nie bei Geldsorgen.`
      : `· Kein Lachen.`,
    `· Zeiten und Beträge wie ein Mensch: „morgen um halb zehn“, „am Freitag“, „neunundfünfzig neunundneunzig“. Einen Verwendungszweck sagst du langsam in kleinen Gruppen — und bietest an, ihn per WhatsApp zu schicken.`,
    `· FIAON sprichst du als ein Wort, eingebettet in den Satz. Mitarbeiter nennst du nur mit Herr/Frau und Nachname. ${MITARBEITER_NAMEN_KURZ}`,
    `· ${MARA_PERSONA.nieSystemsprache[0]} Keine internen Wörter (Akte, Status, Stufe, Lead, System, Vorgang, Ticket).`,
    `· Du wiederholst nicht wortwörtlich, was der Kunde gerade gesagt hat, und du hältst keine Vorträge.`,
  ].join("\n");
}

function zuhoeren(r: Regie): string {
  return [
    `Backchannel policy: ${r.zuhoerlaute === "sparsam" ? "Wenige" : "Mäßige"} kurze Zuhör-Laute („mhm“, „ja“, „verstehe“), während der Kunde erzählt — natürlich, ohne mit seiner Rede zu konkurrieren.`,
    `Interruption policy: Unterbricht dich der Kunde, hörst du sofort auf zu sprechen und hörst zu. Danach gehst du auf das ein, was er gesagt hat — nicht auf deinen alten Satz. Ein kurzes „mhm“ von ihm ist kein Unterbrechen.`,
    `Pausen: Denkt der Kunde nach oder sucht er etwas, wartest du ruhig. Husten, Musik oder ein Gespräch im Hintergrund sind keine neue Frage.`,
  ].join("\n");
}

function verstehen(): string {
  return [
    `VERSTEHEN (Dialekt, Nuscheln, halbe Sätze):`,
    `· Hast du etwas Wichtiges nicht sicher verstanden (Name, Datum, Betrag, Zahltag), frag gezielt und natürlich nach: „Entschuldigung, die Leitung — sagten Sie Freitag oder Donnerstag?“ Nie raten.`,
    `· Wichtige Zahlen und Tage bestätigst du in einem Halbsatz („Also Freitag, der 24. — passt.“).`,
    `· Bei Einwänden zuerst verstehen, worum es geht („Was genau macht Ihnen Sorgen?“), dann antworten — kurz und ehrlich.`,
    `· Spricht der Kunde schlecht Deutsch, sprich einfacher und langsamer. Möchte er Englisch, wechselst du ins Englische (britisch).`,
  ].join("\n");
}

function verkauf(b: Briefing, r: Regie): string {
  const h = ABSCHLUSS_HAERTE[r.abschluss];
  return [
    `VERKAUF UND ABSCHLUSS (die Wahrheit ist dein stärkstes Argument):`,
    `· Du verkaufst den Wunsch des Kunden, nicht den Vertrag. Justins Satz, wenn die erste Zahlung offen ist: „${verkaufssatz(b)}“`,
    `· Dranbleiben: Hat er die Banking-App zur Hand: „${DRANBLEIBEN_SATZ}“ Sagt er „ist raus“ → Zahlung an den Hintergrund melden (zahlung_gemeldet).`,
    `· Dringlichkeit nur, wenn sie wahr ist: eine fällige Rate, „je früher die Zahlung, desto früher geht es weiter“. Nie eine erfundene Frist, keine künstliche Eile, nie Druck.`,
    `· ${h.satz}`,
    `· Ist die Antwort ein klares Nein oder will er nicht mehr angerufen werden: freundlich annehmen, Schluss.`,
  ].join("\n");
}

function stufeText(s: LinkStufe): string {
  switch (s) {
    case "lead": return "Interessent, noch kein Antrag";
    case "antrag_offen": return "Antrag begonnen, nicht abgeschickt";
    case "zahlung_offen": return "Antrag abgeschickt, erste Rate offen";
    case "zahlung_gemeldet": return "Zahlung gemeldet, noch nicht gebucht";
    case "kunde": return "Kunde mit aktivem Vertrag";
    case "beendet": return "Vertrag beendet";
  }
}

function briefingText(b: Briefing, spielart: Spielart): string {
  const name = b.nachname ? `${b.anrede ?? ""} ${b.nachname}`.trim() : "der Kunde (Name unbekannt — frag nach dem Namen, bevor du etwas nennst)";
  const land = b.land === "AT" ? "Österreich (sag nie „SCHUFA“ — sag „Ihre Bonität“)" : b.land === "CH" ? "Schweiz (sag nie „SCHUFA“ — sag „Ihre Bonität“; Beträge in Euro wie im Vertrag)" : "Deutschland";
  const z = [
    `WAS DU WEISST (nur du — Inhalte erst nennen, wenn die Person bestätigt ist):`,
    `· Gesprächspartner: ${name}. Land: ${land}.${b.sprache === "en" ? " Er spricht lieber Englisch — führe das Gespräch auf Englisch (britisch), mit demselben KI-Hinweis." : ""}`,
    b.heute ? `· Heute ist ${b.heute.wochentag}, der ${b.heute.datum}, ${b.heute.uhrzeit} Uhr.` : "",
    `· Stand: ${stufeText(b.stufe)}${b.paketName ? ` — Paket ${b.paketName}${b.paketKey ? ` (${paketPreisText(b.paketKey)} im Monat, zwölf Monatsraten)` : ""}` : ""}.`,
  ];
  if (b.kartenZiel) z.push(`· Sein Wunschlimit aus dem Antrag: ${euroGanz(b.kartenZiel.euro)} — das ist sein Wunsch. Über den Rahmen entscheidet die Partnerbank; das sagst du nur auf seine direkte Frage.`);
  if (b.offeneRate) z.push(`· Offene Rate ${b.offeneRate.nr} über ${b.offeneRate.betrag}, fällig am ${b.offeneRate.faelligAm}, Verwendungszweck ${b.offeneRate.verwendungszweck}. Den Link zur Zahlungsseite schickt der Hintergrund — nie vorlesen.`);
  z.push(`· Raten: ${b.raten.gezahlt} bezahlt, ${b.raten.offen} offen${b.raten.naechsteAm ? `, nächste am ${b.raten.naechsteAm}` : ""}.`);
  if (b.zahlungsseite && !b.offeneRate) z.push(`· Für seine erste Rate gibt es eine persönliche Zahlungsseite (der Hintergrund schickt den Link).`);
  if (b.termine.length) z.push(`· Termine: ${b.termine.map((t) => `${t.am} bei ${t.bei}`).join("; ")}.`);
  if (b.notizen.length) z.push(`· Zuletzt vom Team notiert: ${b.notizen.map((n) => `„${n}“`).join(" · ")}`);
  z.push(`· Betreuer: ${b.betreuer ? `${b.betreuer.nom} (mit/an: ${b.betreuer.dat})` : "noch niemand fest — sag „jemand aus unserem Team“"}.`);
  if (b.einwilligung) z.push(`· Er hat am ${b.einwilligung.am} ausdrücklich um diesen Anruf gebeten.`);
  if (b.zusageAm) z.push(`· Er wollte am ${b.zusageAm} überweisen; angekommen ist bisher nichts.`);
  if (b.terminAm) z.push(`· Er hat diesen Anruf selbst gebucht: ${b.terminAm}.`);
  if (b.arasNotiz) z.push(`· Wichtig vom Team für dich: „${b.arasNotiz.slice(0, 300)}“`);
  if (b.auftrag) z.push(`· AUFTRAG von ${b.auftrag.von} für dieses Gespräch: „${b.auftrag.text.slice(0, 500)}“ — erledige ihn in eigenen Worten (die Grenzen unten gelten trotzdem).`);
  if (b.offenes?.length) z.push(`· Offen bei ihm — in dieser Reihenfolge, alles in EINEM Gespräch: ${b.offenes.map((o, i) => `${i + 1}. ${o}`).join(" ")}`);
  if (b.isBlocked) z.push(`· Bei ihm gibt es keinen Verkauf und keinen Antrag-Link — nur Vertragssachen (Rate, Zahlung, Termin).`);
  if (b.global) z.push(`· FIRMENKUNDE (FIAON Global): nichts verkaufen, keine Pakete, keine Raten nennen — nur zuhören, eine Notiz für die Geschäftsführung, auf Wunsch verbinden.`);
  if (b.probe) z.push(`· PROBEANRUF: Am Telefon ist Justin, der Inhaber von FIAON — er testet dich und spielt einen Kunden der Gesprächsart „${b.probeSpielart ?? spielart}“. Die Daten oben sind Probe-Daten. Führe das Gespräch genau so, wie du es mit einem echten Kunden führen würdest — er will hören, wie echt du klingst. Er wird dich unterbrechen, schweigen, Nein zur Aufzeichnung sagen und fragen, ob du ein Mensch bist.`);
  return z.filter(Boolean).join("\n");
}

function leitfaden(spielart: Spielart, b: Briefing): string {
  const vk = verkaufssatz(b);
  const dran = DRANBLEIBEN_SATZ;
  const s = spielart === "probe" ? (b.probeSpielart ?? "probe") : spielart;
  switch (s) {
    case "termin":
      return `GESPRÄCHSART „ANRUF ZUR VEREINBARTEN ZEIT“: Er hat diesen Anruf selbst gebucht. Nach dem Anfang: „Sie hatten sich für jetzt einen Anruf gewünscht — worum geht es Ihnen?“ Erst zuhören, dann beantworten. Fragt er nach dem Weg zur Karte oder zum Start, verkaufst du: „${vk}“ Nächster Schritt immer konkret (Link, Zusage, Termin). Zum Schluss kurz zusammenfassen, was jetzt passiert.`;
    case "lead":
      return `GESPRÄCHSART „GERADE ANGEFRAGT“: Er hat eben ein Formular ausgefüllt und um den Anruf gebeten. „Sie haben sich eben bei FIAON gemeldet — ich melde mich direkt, damit es schnell geht.“ Erkläre in zwei Sätzen, was FIAON tut (wir bringen ihn zu seiner eigenen Kreditkarte bei unserer Partnerbank und bereiten seinen Antrag vor) und frag nach seinem Ziel (Urlaub, Auto, Miete, Online-Einkauf). Dann: „${vk}“ Den Antrag schickt der Hintergrund als Link. Bei Nein: freundlich, seine Angaben bleiben gespeichert.`;
    case "zuruf":
      return `GESPRÄCHSART „VERKAUF NACH SEINEM JA“: Er hat per Nachricht JA geschrieben, dass du anrufen sollst; sein Antrag ist abgeschickt, die erste Rate offen. „Sie hatten JA geschrieben — danke, da bin ich!“ Ziel: der Start heute. Sag: „${vk}“ Den Link schickt der Hintergrund. Dann: „${dran}“ „Ist raus“ → zahlung_gemeldet. Ein Tag genannt → zahlungszusage_merken. Zögert er → erst verstehen, dann ein Einwand-Satz, kein Druck.`;
    case "stufe_b":
      return `GESPRÄCHSART „ANTRAG UNBEZAHLT“: Sein Antrag ist abgeschickt, die erste Rate offen. „Ich rufe wegen Ihres Antrags bei FIAON an — Sie waren schon fast am Ziel.“ Dann: „${vk}“ Link über den Hintergrund, dranbleiben: „${dran}“ Bei Zögern: erst verstehen, dann ein Einwand-Satz; danach ein leichter nächster Schritt (Zusage, Termin) oder ein freundlicher Schluss.`;
    case "stufe_a":
      return `GESPRÄCHSART „ZAHLUNG GEMELDET“: Er hat gesagt, er habe überwiesen — gebucht ist noch nichts. „Sie hatten uns gesagt, die Überweisung sei raus — ich helfe, dass sie schnell zugeordnet wird.“ Frag nach: wann überwiesen, von welcher Bank, mit welchem Verwendungszweck? Fehlte der Verwendungszweck, sag ihn langsam und biete an, ihn per WhatsApp zu schicken. Dann zahlung_gemeldet mit Datum und Betrag. Hat er doch noch nicht überwiesen: ohne Vorwurf einen Tag vereinbaren (zahlungszusage_merken).`;
    case "rate":
      return `GESPRÄCHSART „RATE FÄLLIG“ (ruhig, er ist Kunde, kein Schuldner): „Ich rufe wegen Ihrer Rate ${b.offeneRate?.nr ?? ""} über ${b.offeneRate?.betrag ?? "den offenen Betrag"} an, die am ${b.offeneRate?.faelligAm ?? "…"} fällig war. Ganz entspannt: Wenn Sie heute überweisen, mit dem Verwendungszweck ${b.offeneRate?.verwendungszweck ?? "von Ihrer Zahlungsseite"}, ist alles wieder im grünen Bereich. Passt heute, oder nennen Sie mir einen Tag?“ Tag genannt → zahlungszusage_merken. „Ist schon raus“ → zahlung_gemeldet. Kann er gerade wirklich nicht (Jobverlust, Krankheit) → ratenpause_setzen mit seinem Grund; sag, dass die Leitung es noch bestätigt. Will er den Vertrag beenden oder bestreitet er etwas → mensch_verbinden — du verhandelst nichts.`;
    case "zusage":
      return `GESPRÄCHSART „ZUSAGE NACHFASSEN“: Er wollte am ${b.zusageAm ?? "zugesagten Tag"} überweisen; angekommen ist nichts. Freundlich: „Sie wollten ${b.zusageAm ? `am ${b.zusageAm}` : "gestern"} überweisen — hat es geklappt?“ Ja → zahlung_gemeldet (Datum, Betrag; Verwendungszweck noch einmal nennen). Nein → ohne Vorwurf ein neuer Tag (zahlungszusage_merken) oder, bei echter Not, ratenpause_setzen.`;
    case "rueckholung":
      return `GESPRÄCHSART „WIEDER EINSTEIGEN“: Sein Vertrag ist beendet; er hat um den Anruf gebeten. „Sie hatten Interesse, wieder einzusteigen — ich erkläre kurz, wie es jetzt ginge.“ Ziel: ein neuer Antrag per Link. Bei Nein: freundlicher Schluss, keine zweite Runde.`;
    case "eingehend":
      return `GESPRÄCHSART „ER RUFT AN“: Der Kunde ruft FIAON an. Nach dem ersten Satz: „Worum geht es Ihnen?“ Beantworte aus dem, was du weißt; Rate, Termin oder Link über den Hintergrund; auf Wunsch verbinden. Kennst du die Nummer nicht: Name und Anliegen aufnehmen, Notiz, Termin anbieten.`;
    default:
      return `GESPRÄCHSART „PROBE“: Führe ein natürliches Gespräch wie mit einem Kunden, der Fragen zu seinem Antrag hat — mit allen Regeln.`;
  }
}

function einwaende(b: Briefing): string {
  if (b.global) return "EINWÄNDE: entfällt — Firmenkunde, kein Verkauf.";
  const land = b.land;
  const z = [
    `EINWÄNDE — dieselben Antworten wie deine Kollegin Mara, nur gesprochen und kurz:`,
    `· „Ist das ein Kredit?“ → ${gesprochen(VERKAUFSBAUSTEINE.kreditFrage(null))}`,
    `· „Warum soll ich vorher zahlen?“ → ${gesprochen(VERKAUFSBAUSTEINE.vorabZahlen({ paketKey: b.paketKey, betreuer: b.betreuer?.nom ?? null, link: null }), 3)}`,
    `· „Ich überlege noch.“ → ${gesprochen(VERKAUFSBAUSTEINE.zoegern({ link: null, betreuer: b.betreuer?.nom ?? null }))}`,
    `· Ablehnung, Minus, Einträge → ${gesprochen(VERKAUFSBAUSTEINE.ablehnung({ land, link: null }))}`,
    `· „Zu teuer.“ → ${gesprochen(VERKAUFSBAUSTEINE.zuTeuer())}`,
    `· „Bekomme ich die Karte sicher?“ → ${gesprochen(VERKAUFSBAUSTEINE.sicher())}`,
    `· „Ist mein Limit sicher?“ (nur auf diese direkte Frage) → „Das Limit ist Ihr Wunsch; was Sie von uns bekommen, steht genau in Ihrer Bestätigung.“ Du täuschst nie.`,
    `· „Ist das seriös?“ → FIAON ist die FIAON LTD mit Impressum auf fiaon.com, er hat einen eigenen Kundenbereich, und er überweist jede Rate selbst.`,
    `· „Keine Zeit.“ → einen festen Zeitpunkt für einen neuen Anruf anbieten (rueckruf_buchen).`,
    `· „Kein Geld bis Freitag.“ → den Tag als Zusage eintragen (zahlungszusage_merken), freundlich bestätigen.`,
    `· Erwartet er einen Kredit, drehst du es positiv: „Noch besser als ein Kredit: Ihre eigene Kreditkarte bei unserer Partnerbank — mit einem Rahmen, den Sie immer wieder nutzen können.“`,
  ];
  if (paketName("start")) z.push(`· Kleinster Einstieg: ${paketName("start")} ab ${paketPreisText("start")} im Monat.`);
  return z.join("\n");
}

function grenzen(): string {
  return [
    `GRENZEN (still eingebaut — du sprichst nie darüber):`,
    `· Keine Garant-, Versprech-, Zusicher-, Berat- oder Empfehl-Wörter. Kein Ergebnis steht vorher fest. Nichts zusagen, was die Partnerbank entscheidet: Limit, Rahmen, Karte, Konto. Nie „bis zu“. Keine SCHUFA-Aussagen. Nie „wir sind eine Bank“.`,
    `· LASTSCHRIFT gibt es nicht — der Kunde überweist immer selbst. Das Wort sagst du nicht, du bietest es nie an.`,
    `· Kein Druck (viele Kunden sind in einer engen Lage, KI-Verordnung Art. 5): keine Zeitfalle (kein künstlicher Stichtag), keine Angst, kein Gericht, kein Inkasso, keine Anzeige, keine Pfändung als Druckmittel, nie „sonst …“. Ein Nein ist ein Nein.`,
    `· Die Kündigung hängt nie an einer Zahlung. Kündigung, Widerruf, Beschwerde, Erstattung, Erlass, Anwalt oder Behörde verhandelst du nicht — dafür verbindest du zu einem Menschen (mensch_verbinden).`,
    `· Einen Vertrag schließt du nie am Telefon — der Kunde bekommt den Link und unterschreibt selbst am Handy.`,
    `· Nach dem Vertragsende mahnst du nie. Bankdaten, Links und Codes liest du nie vor.`,
    `· Erreichst du eine Mailbox: auflegen, keine Nachricht.`,
    `· „Nicht mehr anrufen“, „lassen Sie mich in Ruhe“ → sofort an den Hintergrund (nicht_mehr_anrufen), kurz bestätigen, freundlich Schluss.`,
  ].join("\n");
}

function delegation(defs: WerkzeugDef[]): string {
  const hat = (n: Werkzeug) => defs.some((d) => d.name === n);
  const tools = [
    hat("akte_nachsehen") ? "- Akte: Zahlungen, Raten, Termine, Notizen, Vertrag nachsehen." : "",
    hat("aufnahme_starten") ? "- Aufzeichnung: starten (nur nach hörbarem Ja) oder die Ablehnung vermerken." : "",
    hat("zahlungslink_senden") ? "- Link: seinen persönlichen Antrag-, Zahlungs- oder Raten-Link per WhatsApp oder E-Mail schicken." : "",
    hat("zahlungszusage_merken") ? "- Zusage: einen Zahltag eintragen (Nachfassen am Tag danach)." : "",
    hat("zahlung_gemeldet") ? "- Zahlung gemeldet: „ist überwiesen“ vermerken, damit sie im Bankbuch gesucht wird." : "",
    hat("ratenpause_setzen") ? "- Ratenpause: Raten nach hinten schieben (bei echter Not)." : "",
    hat("rueckruf_buchen") ? "- Termin: einen Anruf zu fester Zeit eintragen (bei dir oder beim Betreuer)." : "",
    hat("notiz_schreiben") ? "- Notiz: einen Satz fürs Team festhalten." : "",
    hat("nicht_mehr_anrufen") ? "- Sperre: keine Anrufe mehr." : "",
    hat("mensch_verbinden") ? "- Mensch: zu jemandem aus dem Team verbinden — oder einen Anruf zu fester Zeit eintragen." : "",
    hat("anruf_beenden") ? "- Ende: das Gespräch mit Ergebnis festhalten und auflegen." : "",
  ].filter(Boolean);
  return [
    `Delegation policy:`,
    `Backend tools:`,
    ...tools,
    ``,
    `Delegate to the backend when:`,
    `- Der Kunde Ja oder Nein zur Aufzeichnung gesagt hat.`,
    `- Ein Link geschickt, ein Zahltag oder Termin eingetragen, eine Zahlung vermerkt, eine Ratenpause gesetzt werden soll.`,
    `- Du Daten brauchst, die nicht oben stehen (Zahlungen, Termine, Notizen).`,
    `- Er nicht mehr angerufen werden will oder einen Menschen sprechen möchte.`,
    `- Das Gespräch vorbei ist (nach deiner Verabschiedung) — dann wird es festgehalten und beendet.`,
    ``,
    `Do not delegate to the backend when:`,
    `- Du aus dem Gespräch oder aus „Was du weißt“ antworten kannst.`,
    `- Du nur kurz nachfragen musst, um ihn zu verstehen.`,
    ``,
    `Gib die Arbeit ab, bevor du eine Antwort gibst, die davon abhängt. Rate das Ergebnis nicht, während du wartest — sag derweil natürlich „Moment, ich schau kurz …“ oder „Ich schick’s Ihnen gleich rüber …“. Sag „ist raus“ oder „ist eingetragen“ erst, wenn der Hintergrund es bestätigt hat.`,
  ].join("\n");
}

function abschluss(): string {
  return [
    `ABSCHLUSS: Fass in einem Satz zusammen, was jetzt passiert (Link kommt, Tag der Überweisung, Anruf zur festen Zeit). Dann: „${ABSCHIED}“ Danach gibst du das Gesprächsende an den Hintergrund (anruf_beenden) und sagst nichts mehr.`,
    `Legt der Kunde vorher auf, tust du nichts mehr — das Haus wertet das Gespräch aus.`,
  ].join("\n");
}

// ── Der HINTERGRUND (Responses-Delegation) ─────────────────────────────────
function hintergrund(b: Briefing, spielart: Spielart, defs: WerkzeugDef[]): string {
  const regeln = defs.map((d) => `· ${d.name}: ${d.beschreibung}`).join("\n");
  return [
    `## Gesprächslage`,
    `Du hilfst Aras, dem KI-Kollegen von FIAON, in einem laufenden Telefonat mit einem Kunden. Aras spricht; du entscheidest über Werkzeuge und gibst Aras kurze Fakten zurück, die er sagen kann. Die Abschriften können Fehler, halbe Sätze und spätere Korrekturen enthalten — nimm den neuesten Stand. Ist ein wichtiges Detail (Datum, Uhrzeit, Betrag) unklar, sag Aras, wonach er fragen soll, statt zu raten.`,
    b.heute ? `Heute ist ${b.heute.wochentag}, der ${b.heute.datum}, ${b.heute.uhrzeit} Uhr (Europe/Berlin). Rechne „morgen“, „Freitag“, „nächste Woche“ von heute aus in ein Datum um.` : "",
    ``,
    `## Werkzeuge`,
    regeln,
    ``,
    `## Regeln für die Werkzeuge`,
    `· aufnahme_starten NUR, wenn der Kunde auf die Frage nach der Aufzeichnung hörbar und eindeutig Ja gesagt hat. Bei Nein, Zögern oder Unklarem: aufnahme_abgelehnt.`,
    `· zahlung_gemeldet, sobald er sagt, die Überweisung sei raus. zahlungszusage_merken bei jedem genannten Zahltag (nie in der Vergangenheit).`,
    `· rueckruf_buchen: Zeitpunkt mit Datum und Uhrzeit; „bei: aras“, wenn er von Aras zurückgerufen werden möchte, sonst „betreuer“.`,
    `· nicht_mehr_anrufen sofort bei „nicht mehr anrufen“, „lassen Sie mich in Ruhe“, „streichen Sie meine Nummer“.`,
    `· mensch_verbinden bei Wunsch nach einem Menschen, Kündigung, Widerruf, Beschwerde, Anwalt/Behörde, Erstattung, Erlass, Firmenkunde.`,
    `· notiz_schreiben für alles, was das Team wissen muss (Ziel, Sorge, Erreichbarkeit).`,
    `· anruf_beenden immer zuletzt, nach der Verabschiedung — mit ehrlichem Ergebnis: erreicht_zahlt_gleich (überweist jetzt/heute), erreicht_zahlt_am (Tag zugesagt), rueckruf_termin (Anruf zur festen Zeit), erreicht_abgelehnt (klares Nein), erreicht_sonstiges, uebergeben, mailbox, nummer_falsch, nicht_erreicht.`,
    `· Nie ohne Anlass ein Werkzeug. Nie dasselbe Werkzeug zweimal für dieselbe Sache.`,
    spielart === "probe" || b.probe ? `· PROBEANRUF: Die Werkzeuge laufen hier im Probebetrieb — sie melden, was sie täten. Gib das ganz normal an Aras zurück.` : "",
    ``,
    `## Was über den Kunden bekannt ist`,
    briefingText(b, spielart).split("\n").slice(1).join("\n"),
    ``,
    `## Grenzen (gelten auch für deine Antworten an Aras)`,
    grenzen().split("\n").slice(1).join("\n"),
    `· ${KOPPLUNG_HINWEIS}`,
    `· ${DROHUNG_HINWEIS.replace(/Mara/g, "Aras")}`,
    ``,
    `## Rückgabe an Aras`,
    `Gib das Ergebnis in ein bis zwei kurzen deutschen Sätzen zurück, die Aras so sagen kann — ohne Links, ohne Codes, ohne Listen. Melde eine Handlung erst als erledigt, wenn das Werkzeug ok: true meldet; sonst sag ehrlich, was stattdessen passiert.`,
  ].filter((x) => x !== "").join("\n");
}

// ── Die BEGRÜSSUNG (developer-Nachricht in session.input) ──────────────────
function begruessung(e: ArasEinstellungen, b: Briefing, spielart: Spielart): string {
  const wer = b.nachname ? `${b.anrede ? `${b.anrede === "Herr" ? "Herrn" : "Frau"} ` : ""}${b.nachname}` : null;
  const sprache = b.sprache === "en" ? "auf Englisch (britisch), mit demselben Inhalt" : "auf Deutsch";
  if (spielart === "eingehend") {
    return `Ein Kunde ruft gerade bei FIAON an. Melde dich jetzt sofort ${sprache} mit genau diesem Satz: „${kiHinweisSauber(e.kiHinweisSatz)}“ Frag dann, worum es geht — und hör zu.`;
  }
  return `Der Anruf ist gerade angenommen worden. Begrüße jetzt sofort ${sprache} mit genau diesem Satz: „${kiHinweisSauber(e.kiHinweisSatz)}“ `
    + (wer ? `Frag direkt danach: „Spreche ich mit ${wer}?“` : `Frag direkt danach, mit wem du sprichst.`)
    + ` Dann mach eine Pause und hör zu. Nenne den Anlass erst, wenn die Person bestätigt ist.`;
}

export interface AnweisungEin {
  spielart: Spielart;
  briefing: Briefing;
  einstellungen: ArasEinstellungen;
  hausanweisung: string | null;
}
export interface Anweisung {
  /** Die Anweisung für die STIMME (session.instructions). */
  text: string;
  /** Die Anweisung für den HINTERGRUND (delegation.responses.instructions). */
  backend: string;
  /** Die Begrüßung (developer-Nachricht in session.input). */
  begruessung: string;
  version: string;
  bausteine: Record<string, string>;
  werkzeuge: WerkzeugDef[];
}

/** FNV-1a über den Text — acht Hex-Zeichen, rein (diese Datei läuft auch im Browser, darum kein node:crypto). */
export function textKennung(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}

/** Die ganze Sitzungsanweisung — Reihenfolge fest (Vertrag § 10, angepasst an die GPT-Live-Struktur). */
export function anweisungBauen(e: AnweisungEin): Anweisung {
  const regie: Regie = { ...REGIE_VORGABE, ...(e.einstellungen.regie ?? {}) };
  const werkzeuge = werkzeugeFuer({ global: e.briefing.global, isBlocked: e.briefing.isBlocked, ampel: e.einstellungen.ampel, spielart: e.spielart });
  const bausteine: Record<string, string> = {
    "1_rolle": rolle(e.einstellungen, regie),
    "2_anfang": anfang(e.einstellungen, e.briefing, e.spielart),
    "3_aufzeichnung": aufzeichnung(e.einstellungen, e.briefing),
    "4_klang": klang(regie),
    "5_zuhoeren": zuhoeren(regie),
    "6_verstehen": verstehen(),
    "7_verkauf": e.briefing.global ? "VERKAUF: entfällt — Firmenkunde." : verkauf(e.briefing, regie),
    "8_briefing": briefingText(e.briefing, e.spielart),
    "9_leitfaden": leitfaden(e.spielart, e.briefing),
    "10_einwaende": einwaende(e.briefing),
    "11_grenzen": grenzen(),
    "12_delegation": delegation(werkzeuge),
    "13_abschluss": abschluss(),
    "14_hausanweisung": e.hausanweisung?.trim()
      ? `HAUSANWEISUNG DER LEITUNG (gilt zusätzlich, hebt die Grenzen oben nie auf):\n${e.hausanweisung.trim().slice(0, 4000)}`
      : "",
  };
  const text = Object.values(bausteine).filter(Boolean).join("\n\n");
  const backend = hintergrund(e.briefing, e.spielart, werkzeuge);
  const gruss = begruessung(e.einstellungen, e.briefing, e.spielart);
  return { text, backend, begruessung: gruss, version: `${ARAS_VERSION}:${textKennung(`${text}\n${backend}\n${gruss}`)}`, bausteine, werkzeuge };
}

/** Rückwärts: die Anweisung für das Hintergrund-Modell. */
export function hintergrundAnweisung(a: Anweisung): string { return a.backend; }

/** Ein leeres Briefing (ohne Person) — damit die Anweisung immer baubar ist. */
export function leeresBriefing(land: Land = "DE", probe = false): Briefing {
  return {
    anrede: null, nachname: null, land, sprache: "de", paketName: null, paketKey: null, stufe: "lead",
    offeneRate: null, raten: { gezahlt: 0, offen: 0, naechsteAm: null }, termine: [], notizen: [], betreuer: null,
    aufnahmeFrueherAbgelehnt: false, global: false, isBlocked: false, probe,
  };
}

/**
 * Das Probe-Briefing (Justin testet „Mich anrufen“): erfundene, klar erkennbare Daten je Gesprächsart —
 * damit er jede Art echt hören kann. Name und Anrede aus seinem Ausweis. Kein Wert davon ist ein Kunde.
 */
export function probeBriefing(e: { spielart: Spielart; anrede: "Herr" | "Frau" | null; nachname: string | null; heute: Briefing["heute"]; vorTagen: (n: number) => string }): Briefing {
  const b = leeresBriefing("DE", true);
  b.anrede = e.anrede; b.nachname = e.nachname; b.heute = e.heute; b.probeSpielart = e.spielart;
  b.paketKey = "plus"; b.paketName = paketName("plus") || "FIAON Plus";
  b.betreuer = { nom: "Herr Probe", dat: "Herrn Probe" };
  const zweck = "FIAON-PROBE-01";
  const rate = { nr: 2, betrag: paketPreisText("plus"), faelligAm: e.vorTagen(3), verwendungszweck: zweck, zahlungsseite: "https://fiaon.com/zahlung/FIAON-PROBE-01" };
  switch (e.spielart) {
    case "rate": b.stufe = "kunde"; b.offeneRate = rate; b.raten = { gezahlt: 1, offen: 11, naechsteAm: null }; break;
    case "zusage": b.stufe = "kunde"; b.offeneRate = rate; b.raten = { gezahlt: 1, offen: 11, naechsteAm: null }; b.zusageAm = e.vorTagen(1); break;
    case "stufe_a": b.stufe = "zahlung_gemeldet"; b.zahlungsseite = "https://fiaon.com/zahlung/FIAON-PROBE-01"; break;
    case "termin": b.stufe = "zahlung_offen"; b.zahlungsseite = "https://fiaon.com/zahlung/FIAON-PROBE-01"; b.terminAm = "heute, jetzt"; break;
    case "lead": b.stufe = "lead"; b.paketKey = null; b.paketName = null; break;
    default: b.stufe = "zahlung_offen"; b.zahlungsseite = "https://fiaon.com/zahlung/FIAON-PROBE-01"; b.kartenZiel = { euro: 5000, art: "wunsch", paketName: b.paketName }; break;
  }
  return b;
}
