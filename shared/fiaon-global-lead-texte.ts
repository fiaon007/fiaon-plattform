// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DIE LEAD-MAILS AUS EINEM GUSS: ALLE SÄTZE UND REGELN AN EINER STELLE (E-476 Scheibe 4, 05.11.2026)
//
// Justin (05.11.2026, Entscheidung 2A, „4× A … Mach alles fix und fertig“): Dem Lead schreibt JUSTIN — aus js@ mit seiner
// echten Unterschrift. Bestätigung und Erinnerungen laufen im Business-Rahmen „FIAON Global“ (Absendername FIAON Global,
// Antworten an js@). Mara schreibt Leads nicht.
//
// ── DAS EINE BILD (Plan Lead-Weg 2.0, Mailtexte) ───────────────────────────
//   · Eine Stimme: Justin. Daniel ist „mein Kollege“, der anruft.
//   · Ein Link: der persönliche Terminlink fiaon.com/g/<code> (Scheibe 3) — in Willkommen, Nachfass und „nicht erreicht“.
//   · Ein Wissensstand: jede Mail spiegelt SEINE Antworten (Sie-Form, ohne Betrag) und weiß, was schon war.
//   · Stopp bei Termin, Antwort, „keine Mails“, Anruf-Ergebnis, Kunde, Info-Mail, Privat-Weg.
//
// ── DIE GUTACHTEN-PFLICHTEN, DIE HIER STEHEN ───────────────────────────────
//   · Kein Formular-Echo, kein Betrag (Gutachten 1, Mangel 7/8): KUNDEN_SATZ (fiaon-global-lead.ts) + die englische Fassung.
//   · „Ihre Angaben sind bei mir angekommen“ statt „gelesen“ (um 00:34 hat niemand gelesen, Gutachten 1, Mangel 16).
//   · Kein fester Anruf ohne Dienst: der Wochentag statt „heute/morgen“, sonst „meldet sich persönlich“ (Gutachten 1, Mangel 3).
//   · „Wir kümmern uns um alles bis zur Unterschrift bei der Bank“ statt „alles von Anfang bis Ende“, der Kernsatz der Anzeige
//     „Erst die US-Gesellschaft, dann der Weg zum Kapital“ (Gutachten 1, Mangel 8).
//   · Website-Fassung ohne Liste, Österreich ohne Steuerberater-/Unternehmensberater-Satz (Gutachten 1, Mangel 11).
//   · Bestandskunde mit Global-Interesse: eigene Fassung; Beschwerde/Privatkunde: Privat-Weg (Gutachten 1, Mangel 1).
//   · Ein Mail-Budget je Lead an EINER Stelle: höchstens eine Mail am Tag, höchstens fünf bis zum Gespräch (Gutachten 1, Mangel 9).
//   · Abmelde-Satz in jedem W/N, „keine Mails“ setzt die Sperre (Gutachten 0, Mangel 5).
//   · Die Platzhalter-Wache: keine Mail mit {…}, [Name], „undefined“ oder leerer Klammer.
//   · Die Matrix „Mail – Auslöser – Absender – Stopp“ (Gutachten 0, Mangel 6) — der Prüfstand prüft sie.
//
// GRENZEN (still eingebaut, nie als Belehrung): immer gesiezt; britisch nie „up to“ (Spitzenwert-Wort der englischen Wand); keine Zinszahl, keine Kapital-Zusage, kein Steuer-Trick, kein
// Satz „die Bank/das Institut entscheidet“ (E-468), kein „Geschenk“, keine Partnernamen, keine erfundene Dringlichkeit; Zahlen
// nur aus SEINEN Antworten (und die stehen nur im Dossier, nie im Kundentext).
//
// Rein, ohne Datenbank — Server, Skript, Vorschau und Prüfstand rendern dieselbe Mail. Repo öffentlich: keine Kundendaten.
// ═══════════════════════════════════════════════════════════════════════════
import {
  KUNDEN_SATZ, berlinZeit, privatOderBeschwerde, privatUrteil, type LeadAntwort,
} from "./fiaon-global-lead";
import { nameFuerAnrede } from "./fiaon-anrede";

export type LeadSprache = "de" | "en";
export type LeadMailArt = "willkommen" | "n1" | "n2" | "n3";

// ── Einstellungen (fiaon_settings) — Vorgabe AUS, bis Justin den Prüfversand gelesen hat (Plan 4.8) ─────────
export const LEAD_POST_SCHLUESSEL = {
  /** Willkommen sofort (auch nachts) aus js@. */
  willkommenAn: "lead_global_willkommen_an",
  /** Nachfass N1–N3 aus js@ im selben Faden. */
  nachfassAn: "lead_global_nachfass_an",
  /**
   * Der Zählbeginn (Altbestand-Schutz): Automatische Lead-Mails nur für Anfragen, die NACH dem Einschalten eingehen. Wer
   * einschaltet, setzt ihn auf JETZT. Leer = keine automatische Lead-Mail. Alte Leads: nur das Entwurf-Skript.
   */
  ab: "lead_global_mails_ab",
  /** Ruhe nach dem Eingang (Minuten) — damit eine Buchung über den Danke-Knopf nicht hinter dem Willkommen landet. */
  ruheMin: "lead_global_willkommen_ruhe_min",
  /**
   * Nachbesserung E-476 (Gutachten Technik/Lead, 05.11.2026): der Antwort-Leser in js@ hat einen eigenen Not-Aus (Vorgabe AN) —
   * er läuft ohnehin nur, wenn das Willkommen an ist, und nur für Anfragen ab dem Zählbeginn.
   */
  antwortenAn: "lead_global_antworten_an",
  /** Höchstens so viele Willkommens-Mails je Berliner Tag (Schutz gegen eine Formular-Flut, Gutachten Sicherheit). */
  willkommenMaxTag: "lead_global_willkommen_max_tag",
} as const;

export const LEAD_POST_VORGABE = {
  /** Gutachten 0, Mangel 6 / Gutachten 1, Mangel 9: Willkommen erst nach 10–15 Minuten Ruhe. */
  ruheMin: 10,
  /** Ab so vielen Minuten nach dem Eingang entschuldigt sich der Einstieg („erst jetzt von mir hören“). */
  nachtragAbMin: 30,
  /** Willkommen nur für Anfragen bis zu so vielen Tagen (Nachhol-Grenze; ältere: Entwurf-Skript). */
  hoechstensTage: 3,
  /** Nachfass nach so vielen Werktagen ab dem Willkommen. */
  nachfassWerktage: [1, 3, 7] as readonly number[],
  /** Uhrzeit (Berlin) der Nachfass-Mails — „etwa 10 Uhr“. */
  nachfassStunde: 10,
  /** Sendefenster der Nachfass-Mails (Berlin, Mo–Fr). */
  fensterVon: 9,
  fensterBis: 18,
  /** Ging in so vielen Tagen schon eine Mail an diese Adresse (js@, welcome@, Protokoll), kommt kein Willkommen. */
  ruheTage: 14,
  /** Mail-Budget je Lead: höchstens eine am Tag, höchstens fünf bis zum Gespräch (Bestätigung und Absage ausgenommen). */
  budgetTag: 1,
  budgetGesamt: 5,
  /** Antworten werden so lange nach dem Willkommen gelesen. */
  antwortTage: 45,
  /** Gesprächsdauer in Minuten (wie GLOBAL_DAUER_MIN). */
  dauerMin: 30,
  /** Tagesdeckel der Willkommens-Mails (Vorgabe) — darüber wartet der Rest, und der Lead-Wächter schlägt an. */
  willkommenMaxTag: 20,
  /** Website-Anfragen: Willkommen nur, wenn derselbe Anschluss in 24 Stunden höchstens so viele Anfragen schickte. */
  flutJeAnschluss: 2,
  /** Der Nachtrag entschuldigt sich erst ab dem nächsten Tag bzw. ab so vielen Stunden. */
  entschuldigungAbStunden: 12,
  /** Schrieb Justin im Faden in so vielen Tagen selbst, legt eine Antwort des Leads keinen Rückruf-Auftrag an. */
  handFadenTage: 7,
} as const;

/** Die Ereignisse im Versandprotokoll (fiaon_mail_log) — Frequenzbremse und Budget zählen sie. */
export const LEAD_POST_EVENT = { willkommen: "global_lead_willkommen", nachfass: "global_lead_nachfass", info: "global_info" } as const;

// ── Seine Antworten für den Kunden (Sie-Form, ohne Betrag) — deutsch aus fiaon-global-lead.ts, hier britisch ─────
/** Je Option ein Satz in britischem Englisch — dieselben Grenzen wie KUNDEN_SATZ (kein Betrag, kein „mein“/„ich“). */
export const KUNDEN_SATZ_EN: Readonly<Record<string, string>> = {
  vorhaben_1: "You would like to take the route to capital through your own US company – also for your business here.",
  vorhaben_2: "You would like to build a business in the US.",
  vorhaben_3: "You would like both: the route to capital and a business in the US.",
  vorhaben_4: "We will gladly clarify together in the call what exactly you have in mind.",
  kapitalrahmen_ziel_1: "I have your target for the capital limit.",
  kapitalrahmen_ziel_2: "I have your target for the capital limit.",
  kapitalrahmen_ziel_3: "I have your target for the capital limit.",
  kapitalrahmen_ziel_4: "",
  wann_starten_1: "You would like to start as soon as possible.",
  wann_starten_2: "You would like to start in the next few months.",
  wann_starten_3: "You would like to start at a later date.",
  wann_starten_4: "You would first like to find out more at your own pace.",
  wann_gruenden_1: "You would like to set up your US company as soon as possible.",
  wann_gruenden_2: "You would like to set up your US company in the next three months.",
  wann_gruenden_3: "You would like to set up your US company at a later date.",
  wann_gruenden_4: "You would first like to find out more at your own pace.",
  wofuer_1: "You have customers or partners in the US.",
  wofuer_2: "You are planning a subsidiary for your existing business.",
  wofuer_3: "You run an international online business.",
  wofuer_4: "You would like to build a new business in the US.",
  wofuer_5: "",
  rolle_1: "You own a business.",
  rolle_2: "You run a business as its managing director.",
  rolle_3: "You are self-employed or work freelance.",
  rolle_4: "You are currently planning to set up a business.",
  rolle_5: "",
};

/** SEINE Antworten als Fließtext in Sie-Form, ohne Betrag — leer, wenn keine Option bekannt ist. „wir“ = Rahmen-Mails. Rein. */
export function kundenSatzFuer(antworten: readonly LeadAntwort[], sprache: LeadSprache, stimme: "ich" | "wir" = "ich"): string {
  const karte = sprache === "en" ? KUNDEN_SATZ_EN : KUNDEN_SATZ;
  const saetze: string[] = [];
  for (const a of antworten) {
    let s = a.code ? karte[a.code] : undefined;
    if (!s) continue;
    if (stimme === "wir") s = sprache === "en" ? s.replace(/^I have your target/, "We have your target") : s.replace(/liegt mir vor/, "liegt uns vor");
    if (!saetze.includes(s)) saetze.push(s);
  }
  return saetze.join(" ");
}

// ── SEIN VORHABEN IN EINEM SATZ (Nachbesserung E-476, Gutachten Lead-Sicht Mangel 4, 05.11.2026) ──────────────
// VORHER: ein Satz je Formular-Antwort aneinandergereiht („Sie möchten beides … Ihr Ziel für den Kapitalrahmen liegt mir vor.
// Sie möchten so bald wie möglich starten. Weil Sie bald starten möchten, …“) — das las sich wie eine Formular-Quittung.
// NACHHER: EIN Satz aus Vorhaben × Start, an EINER Stelle; dazu höchstens ein kurzer Folgesatz, der den Start nicht wiederholt.
// Der Rahmen (Betrag) steht nur im Dossier, die Rolle („Geschäftsführung“) nie im Kundentext.
const VORHABEN_DE: Readonly<Record<string, { tun: string; wie: string }>> = {
  vorhaben_1: { tun: "über eine eigene US-Gesellschaft den Weg zum Kapital gehen, auch für Ihr Unternehmen hier", wie: "der Weg zum Kapital über eine eigene US-Gesellschaft aussieht" },
  vorhaben_2: { tun: "ein Geschäft in den USA aufbauen", wie: "Sie ein Geschäft in den USA aufbauen" },
  vorhaben_3: { tun: "beides angehen: den Weg zum Kapital und ein Geschäft in den USA", wie: "beides zusammen geht: der Weg zum Kapital und ein Geschäft in den USA" },
};
const VORHABEN_EN: Readonly<Record<string, { tun: (zeit: string) => string; wie: string }>> = {
  vorhaben_1: { tun: (z) => `take the route to capital through your own US company${z ? ` ${z}` : ""}, also for your business here`, wie: "the route to capital through your own US company works" },
  vorhaben_2: { tun: (z) => `build a business in the US${z ? ` ${z}` : ""}`, wie: "to build a business in the US" },
  vorhaben_3: { tun: (z) => `pursue both${z ? ` ${z}` : ""}: the route to capital and a business in the US`, wie: "both fit together: the route to capital and a business in the US" },
};
const ZEIT_DE: Readonly<Record<number, string>> = { 1: "so bald wie möglich", 2: "in den nächsten Monaten", 3: "zu einem späteren Zeitpunkt" };
const ZEIT_EN: Readonly<Record<number, string>> = { 1: "as soon as possible", 2: "in the next few months", 3: "at a later date" };
const GRUENDEN_ZEIT_DE: Readonly<Record<number, string>> = { 1: "so bald wie möglich", 2: "in den nächsten drei Monaten", 3: "zu einem späteren Zeitpunkt" };
const GRUENDEN_ZEIT_EN: Readonly<Record<number, string>> = { 1: "as soon as possible", 2: "within the next three months", 3: "at a later date" };
const WOFUER_DE: Readonly<Record<string, string>> = {
  wofuer_1: "Sie haben Kunden oder Partner in den USA", wofuer_2: "Sie planen eine Tochtergesellschaft in den USA für Ihr bestehendes Unternehmen",
  wofuer_3: "Sie betreiben ein internationales Online-Geschäft",
};
const WOFUER_EN: Readonly<Record<string, string>> = {
  wofuer_1: "You have customers or partners in the US", wofuer_2: "You are planning a US subsidiary for your existing business",
  wofuer_3: "You run an international online business",
};
/** Der Folgesatz nach dem Start — er wiederholt den Start nie (kein „bald … bald“). */
const FOLGE_DE: Readonly<Record<number, string>> = {
  1: "Dann sprechen wir am besten direkt.", 2: "Dann lohnt es sich, früh darüber zu sprechen.",
  3: "Ein erstes Gespräch ist ganz unverbindlich.", 4: "Ein erstes Gespräch ist ganz unverbindlich.",
};
const FOLGE_EN: Readonly<Record<number, string>> = {
  1: "Then it is best that we speak directly.", 2: "Then it is worth talking about it early on.",
  3: "An initial call comes with no obligation.", 4: "An initial call comes with no obligation.",
};

/**
 * SEIN Vorhaben in EINEM Satz aus Vorhaben × Start (Kapital-Formular) bzw. Wofür × Gründung (US-Formular), dazu höchstens ein
 * Folgesatz. Sie-Form, ohne Betrag, ohne Rolle. Leer, wenn keine Option bekannt ist. Rein.
 */
export function vorhabenSatz(antworten: readonly LeadAntwort[], sprache: LeadSprache): { satz: string; folge: string } {
  const en = sprache === "en";
  const code = (re: RegExp) => antworten.map((a) => String(a.code ?? "")).find((c) => re.test(c)) ?? null;
  const vorhaben = code(/^vorhaben_[1-4]$/);
  const wofuer = code(/^wofuer_[1-5]$/);
  const startCode = code(/^wann_starten_[1-4]$/);
  const gruendenCode = code(/^wann_gruenden_[1-4]$/);
  const start = startCode ? Number(startCode.slice(-1)) : null;
  const gruenden = gruendenCode ? Number(gruendenCode.slice(-1)) : null;
  const folge = (s: number | null) => (s ? (en ? FOLGE_EN : FOLGE_DE)[s] ?? "" : "");

  // ── Kapital-Formular: Vorhaben × Start ──
  if (vorhaben || (start && !wofuer && !gruenden)) {
    const v = vorhaben && vorhaben !== "vorhaben_4" ? vorhaben : null;
    if (v) {
      if (start === 4) {
        return { satz: en ? `You would first like to find out at your own pace how ${VORHABEN_EN[v].wie}.` : `Sie möchten sich zunächst in Ruhe informieren, wie ${VORHABEN_DE[v].wie}.`, folge: folge(4) };
      }
      const zeit = start ? (en ? ZEIT_EN : ZEIT_DE)[start] : "";
      return {
        satz: en ? `You would like to ${VORHABEN_EN[v].tun(zeit)}.` : `Sie möchten ${zeit ? `${zeit} ` : ""}${VORHABEN_DE[v].tun}.`,
        folge: folge(start),
      };
    }
    const offen = vorhaben === "vorhaben_4" ? (en ? "We will gladly clarify in the call what exactly you have in mind." : "Was genau Sie vorhaben, klären wir gern im Gespräch.") : "";
    if (!start) return { satz: offen, folge: "" };
    const startSatz = start === 4
      ? (en ? "You would first like to find out more at your own pace." : "Sie möchten sich zunächst in Ruhe informieren.")
      : (en ? `You would like to start ${ZEIT_EN[start]}.` : `Sie möchten ${ZEIT_DE[start]} starten.`);
    return { satz: [startSatz, offen].filter(Boolean).join(" "), folge: offen ? "" : folge(start) };
  }

  // ── US-Formular: Wofür × Gründung (die Rolle nie) ──
  const g = gruenden;
  const zeitG = g && g !== 4 ? (en ? GRUENDEN_ZEIT_EN : GRUENDEN_ZEIT_DE)[g] : "";
  if (wofuer === "wofuer_4") {
    if (g === 4) return { satz: en ? "You would like to build a new business in the US and first find out more at your own pace." : "Sie möchten ein neues Geschäft in den USA aufbauen und sich zunächst in Ruhe informieren.", folge: folge(4) };
    return { satz: en ? `You would like to build a new business in the US${zeitG ? ` ${zeitG}` : ""}.` : `Sie möchten ${zeitG ? `${zeitG} ` : ""}ein neues Geschäft in den USA aufbauen.`, folge: folge(g) };
  }
  const aussage = wofuer ? (en ? WOFUER_EN : WOFUER_DE)[wofuer] : null;
  if (aussage) {
    if (g === 4) return { satz: en ? `${aussage} and would first like to find out more at your own pace.` : `${aussage} und möchten sich zunächst in Ruhe informieren.`, folge: folge(4) };
    if (zeitG) {
      const ihre = wofuer === "wofuer_2" ? (en ? "set it up" : "sie") : (en ? "set up your US company" : "Ihre US-Gesellschaft");
      return {
        satz: en ? `${aussage} and would like to ${ihre} ${zeitG}.` : `${aussage} und möchten ${ihre} ${zeitG} gründen.`,
        folge: folge(g),
      };
    }
    return { satz: `${aussage}.`, folge: "" };
  }
  if (g === 4) return { satz: en ? "You would first like to find out more at your own pace." : "Sie möchten sich zunächst in Ruhe informieren.", folge: folge(4) };
  if (zeitG) return { satz: en ? `You would like to set up your US company ${zeitG}.` : `Sie möchten Ihre US-Gesellschaft ${zeitG} gründen.`, folge: folge(g) };
  return { satz: "", folge: "" };
}

/**
 * Die Bestätigung (global_termin, Rahmen „wir“): „Ihre Angaben aus dem Formular liegen uns vor.“ + SEIN Vorhaben in einem Satz
 * (vorhabenSatz — ohne Rahmen, ohne Rolle) — statt der Klammer „(Beides · 250.000 $ – 1.000.000 $ · So bald wie möglich)“
 * (Gutachten 1, Mangel 7/8). Leer ohne Antworten. Rein.
 */
export function angabenSatz(antworten: readonly LeadAntwort[], sprache: LeadSprache): string {
  const { satz } = vorhabenSatz(antworten, sprache);
  if (!satz && !antworten.some((a) => a.code && (sprache === "en" ? KUNDEN_SATZ_EN : KUNDEN_SATZ)[a.code])) return "";
  return `${sprache === "en" ? "We have the details from your form." : "Ihre Angaben aus dem Formular liegen uns vor."}${satz ? ` ${satz}` : ""}`;
}

/** Der freigegebene Vorbereitungs-Absatz der Vortag-Mail (E-458, Justin 29.10.) — er bleibt, wo wir nichts von ihm wissen. */
export const VORBEREITUNG_FREIGEGEBEN = {
  de: "Damit das Gespräch Ihnen viel bringt, notieren Sie gern vorab:\n– was Sie in den USA vorhaben (zwei Sätze genügen),\n– wo Sie bzw. Ihr Unternehmen ansässig sind,\n– welches Ziel Sie für Ihren Kapitalrahmen haben.",
  en: "To get the most out of the call, you may like to note down beforehand:\n– what you plan to do in the US (two sentences are enough),\n– where you or your company are based,\n– what you are aiming for with your capital limit.",
} as const;

/**
 * Der Vorbereitungs-Absatz der Vortag-Mail (Plan: „spiegelt die Antworten und fragt nur, was fehlt“): Wissen wir Vorhaben
 * oder Rahmen aus SEINEN Antworten, fragt die Mail nicht noch einmal danach — nur nach dem, was fehlt (der Sitz immer).
 * Ohne Antworten: der freigegebene Wortlaut. Als HTML (<br />) für den Platzhalter vorbereitung_html; der Motor macht
 * daraus im Text-Teil Zeilen. Nur feste Sätze — nichts vom Lead. Rein.
 */
export function vorbereitungHtml(antworten: readonly LeadAntwort[] | null | undefined, sprache: LeadSprache): string {
  const a = antworten ?? [];
  const vorhaben = a.some((x) => /^vorhaben_[123]$|^wofuer_[1234]$/.test(String(x.code ?? "")));
  const rahmen = a.some((x) => /^kapitalrahmen_ziel_[123]$/.test(String(x.code ?? "")));
  if (!vorhaben && !rahmen) return VORBEREITUNG_FREIGEGEBEN[sprache].replace(/\n/g, "<br />");
  const en = sprache === "en";
  const fragen = [
    en ? "where you or your company are based" : "wo Sie bzw. Ihr Unternehmen ansässig sind",
    ...(vorhaben ? [] : [en ? "what you plan to do in the US (two sentences are enough)" : "was Sie in den USA vorhaben (zwei Sätze genügen)"]),
    ...(rahmen ? [] : [en ? "what you are aiming for with your capital limit" : "welches Ziel Sie für Ihren Kapitalrahmen haben"]),
  ];
  // Nachbesserung (Gutachten Lead-Sicht, Mangel 13): EINE Stimme wie der Rest der Mail („Wir nehmen uns … Zeit“) — „uns“, nicht
  // „mir“; und eine einzige offene Frage ist ein Satz, keine Liste mit einem Punkt.
  if (fragen.length === 1) {
    return en
      ? `We already have the details from your form. To get the most out of the call, you may like to note down beforehand ${fragen[0]}.`
      : `Ihre Angaben aus dem Formular liegen uns vor. Damit das Gespräch Ihnen viel bringt, notieren Sie gern noch, ${fragen[0]}.`;
  }
  const kopf = en
    ? "We already have the details from your form. To get the most out of the call, you may like to note down beforehand:"
    : "Ihre Angaben aus dem Formular liegen uns vor. Damit das Gespräch Ihnen viel bringt, notieren Sie gern noch:";
  return `${kopf}<br />${fragen.map((f, i) => `– ${f}${i === fragen.length - 1 ? "." : ","}`).join("<br />")}`;
}

/** Die Startstufe aus SEINEN Antworten (1 bald · 2 Monate · 3 später · 4 informiert sich) — null ohne Startfrage. Rein. */
export function startStufeAus(antworten: readonly LeadAntwort[]): number | null {
  for (const a of antworten) {
    const m = /^(wann_starten|wann_gruenden)_(\d)$/.exec(String(a.code ?? ""));
    if (m) return Number(m[2]);
  }
  return null;
}

/** Will er den Weg zum Kapital (Vorhaben 1/3 oder ein gewählter Rahmen)? Rein. */
export function willKapital(antworten: readonly LeadAntwort[]): boolean {
  return antworten.some((a) => /^vorhaben_[13]$/.test(String(a.code ?? "")) || /^kapitalrahmen_ziel_[123]$/.test(String(a.code ?? "")));
}

// ── Anrede, Tag, Uhr (Berlin, nur formatToParts) ────────────────────────────
/** Ein voller Name aus dem Formular → Vor- und Nachname (letztes Wort = Nachname). Rein. */
export function nameTeilen(voll: unknown): { vorname: string | null; nachname: string | null } {
  const teile = String(voll ?? "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (!teile.length) return { vorname: null, nachname: null };
  if (teile.length === 1) return { vorname: teile[0], nachname: null };
  return { vorname: teile.slice(0, -1).join(" "), nachname: teile[teile.length - 1] };
}

// ── WAS DER LEAD SELBST TIPPT, IN JUSTINS MAIL (Nachbesserung E-476, Gutachten Sicherheit Mangel 4) ─────────────
// Name, Firma und Wunschzeit kommen aus einem öffentlichen Formular. Sieht etwas nach Adresse aus („https://…“, „www.…“,
// „wort.endung“, „@“), steht es nie in einer Mail mit Justins Unterschrift — dann die neutrale Fassung ohne den Wert.
const ADRESSE_FORM = /https?:|www\.|@|[a-z0-9-]\.[a-z]{2,}\b|\/\//i;
/** Sieht dieser Text nach einer Web- oder Mail-Adresse aus? Rein. */
export function siehtNachAdresseAus(text: unknown): boolean {
  return ADRESSE_FORM.test(String(text ?? ""));
}
/** Die Firma für einen Kundentext — nur ohne Adresse, „/“, „:“ (sonst null; der Satz kommt dann ohne sie aus). Rein. */
export function firmaFuerText(firma: unknown): string | null {
  const f = String(firma ?? "").replace(/\s+/g, " ").trim();
  if (!f || f.length > 120 || siehtNachAdresseAus(f) || /[\/:<>"{}\[\]]/.test(f)) return null;
  return f;
}
/** Die Wunschzeit für einen Kundentext — kurz, ohne Adresse, nur harmlose Zeichen (sonst null). Rein. */
export function wunschzeitFuerText(roh: unknown): string | null {
  const w = String(roh ?? "").replace(/\s+/g, " ").trim();
  if (!w || w.length > 60 || siehtNachAdresseAus(w) || !/^[0-9A-Za-zÄÖÜäöüß .,:–\-\/()]+$/.test(w)) return null;
  return w;
}
/** Alle Adressen im Text außer fiaon.com (die Link-Wand vor jeder Lead-Mail). Rein. */
export function fremdeAdressen(text: unknown): string[] {
  const t = String(text ?? "");
  const funde = t.match(/(?:https?:\/\/|www\.)[^\s<>"')]+|\b[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.[a-z]{2,}\b(?:\/[^\s<>"')]*)?/gi) ?? [];
  return funde.filter((f) => {
    const host = f.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[\/?#]/)[0].toLowerCase();
    return !(host === "fiaon.com" || host.endsWith(".fiaon.com"));
  });
}

/** „Guten Tag Max Mustermann,“ / „Dear Max Mustermann,“ — über die EINE Anrede-Regel des Hauses (fiaon-anrede.ts). Rein. */
export function leadAnredeZeile(name: unknown, sprache: LeadSprache, anrede?: string | null): string {
  // Ein Name, der nach Adresse aussieht, kommt nie in die Anrede (Gutachten Sicherheit, Mangel 4).
  if (siehtNachAdresseAus(name) || /[<>"{}\[\]]/.test(String(name ?? ""))) return sprache === "en" ? "Good day," : "Guten Tag,";
  const t = nameTeilen(name);
  const n = nameFuerAnrede({ vorname: t.vorname, nachname: t.nachname, anrede: anrede ?? null });
  if (sprache === "en") {
    if (n.anrede && n.nachname) return `Dear ${n.anrede === "frau" ? "Ms" : "Mr"} ${n.nachname},`;
    if (n.voll) return `Dear ${n.voll},`;
    return "Good day,";
  }
  if (n.anrede && n.nachname) return `Guten Tag ${n.anrede === "frau" ? "Frau" : "Herr"} ${n.titel ? `${n.titel} ` : ""}${n.nachname},`;
  if (n.voll) return `Guten Tag ${n.voll},`;
  return "Guten Tag,";
}

const WT_EN_LANG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONAT_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** „Mittwoch, 04.11.“ / „Wednesday, 4 November“ (Berlin). Rein. */
export function tagText(d: Date, sprache: LeadSprache): string {
  const z = berlinZeit(d);
  if (sprache === "en") {
    const [, m, t] = z.iso.split("-").map(Number);
    return `${WT_EN_LANG[z.tag]}, ${t} ${MONAT_EN[m - 1]}`;
  }
  return `${z.wochentag}, ${z.datum}`;
}

/** „05.12.2026“ / „5 December 2026“ (Berlin). Rein. */
export function datumText(d: Date, sprache: LeadSprache): string {
  const z = berlinZeit(d);
  const [y, m, t] = z.iso.split("-").map(Number);
  return sprache === "en" ? `${t} ${MONAT_EN[m - 1]} ${y}` : `${z.datum}${y}`;
}

/** Wie liegt ein Tag zu „jetzt“? heute · gestern · sonst der Wochentag. Rein. */
export function tagBezug(d: Date, jetzt: Date, sprache: LeadSprache): { heute: boolean; gestern: boolean; wort: string } {
  const a = berlinZeit(d).iso, j = berlinZeit(jetzt).iso;
  const gesternIso = berlinZeit(new Date(jetzt.getTime() - 86_400_000)).iso;
  const heute = a === j, gestern = a === gesternIso;
  if (sprache === "en") return { heute, gestern, wort: heute ? "today" : gestern ? "yesterday" : `on ${WT_EN_LANG[berlinZeit(d).tag]}` };
  return { heute, gestern, wort: heute ? "heute" : gestern ? "gestern" : `am ${berlinZeit(d).wochentag}` };
}

/**
 * „heute“, „gestern Abend“, „gestern“, „am Montag“, „am 02.11.“ — wann er sich gemeldet hat, für den Nachtrag (Gutachten
 * Lead-Sicht, Mangel 14: nie ein Datum für heute). Rein.
 */
export function meldeBezug(d: Date, jetzt: Date, sprache: LeadSprache): string {
  const b = tagBezug(d, jetzt, sprache);
  const abend = berlinZeit(d).stunde >= 18;
  if (b.heute) return sprache === "en" ? "today" : "heute";
  if (b.gestern) return sprache === "en" ? (abend ? "yesterday evening" : "yesterday") : (abend ? "gestern Abend" : "gestern");
  if (jetzt.getTime() - d.getTime() < 6 * 86_400_000) return b.wort;
  return sprache === "en" ? `on ${datumText(d, "en").replace(/ \d{4}$/, "")}` : `am ${berlinZeit(d).datum}`;
}

// ── Wer ruft an, und wann? (Gutachten 1, Mangel 3) ──────────────────────────
export interface RufLage {
  /** Der Name der zuständigen Person („Daniel …“) — null: niemand, dann „wir“. */
  kollege: string | null;
  /** Die zuständige Person ist eine Frau → „meine Kollegin“. */
  weiblich?: boolean;
  /**
   * heute = jetzt im Dienst (Mo–Fr 9–18) · ab = der nächste Dienst-Tag mit Wochentag · persoenlich = keine feste Zeit
   * (abwesend, unbekannt) · versucht = hat schon angerufen (nicht erreicht/Mailbox).
   */
  art: "heute" | "ab" | "persoenlich" | "versucht";
  /** Bei „ab“: der Tag (Berlin), an dem er ab 9 Uhr anruft. */
  abTag?: Date | null;
}

/** Der Satz über den Anruf der zuständigen Person — nie eine Zusage ohne Dienst. Rein. */
export function rufSatz(r: RufLage, sprache: LeadSprache): string {
  const en = sprache === "en";
  if (!r.kollege) {
    return en ? "If you have not chosen a time by then, we will get in touch with you personally."
      : "Falls Sie bis dahin noch keinen Termin gewählt haben, melden wir uns persönlich bei Ihnen.";
  }
  const wer = en ? `my colleague ${r.kollege}` : `${r.weiblich ? "meine Kollegin" : "mein Kollege"} ${r.kollege}`;
  const Wer = wer.charAt(0).toUpperCase() + wer.slice(1);
  if (r.art === "versucht") {
    return en ? `${Wer} has already tried to call you and will gladly get in touch again personally.`
      : `${Wer} hat schon versucht, Sie anzurufen, und meldet sich gern noch einmal persönlich bei Ihnen.`;
  }
  if (r.art === "heute") {
    return en ? `If you have not chosen a time by then, ${wer} will give you a quick call today.`
      : `Falls Sie bis dahin noch keinen Termin gewählt haben, ruft Sie ${wer} heute noch kurz an.`;
  }
  if (r.art === "ab" && r.abTag) {
    const z = berlinZeit(r.abTag);
    return en ? `If you have not chosen a time by then, ${wer} will give you a quick call on ${WT_EN_LANG[z.tag]} from 9 am (German time).`
      : `Falls Sie bis dahin noch keinen Termin gewählt haben, ruft Sie ${wer} am ${z.wochentag} ab 9 Uhr kurz an.`;
  }
  return en ? `If you have not chosen a time by then, ${wer} will get in touch with you personally.`
    : `Falls Sie bis dahin noch keinen Termin gewählt haben, meldet sich ${wer} persönlich bei Ihnen.`;
}

/**
 * Ohne freie Zeit im Kalender (Gutachten Lead-Sicht, Mangel 8): kein „mit einem Klick gebucht“, sondern wer anruft und den
 * Termin mit ihm vereinbart — nie eine Uhrzeit ohne Dienst. Rein.
 */
export function rufSatzOhneKalender(r: RufLage, sprache: LeadSprache): string {
  const en = sprache === "en";
  if (!r.kollege) return en ? "We will get in touch with you personally to arrange a time for the call." : "Wir melden uns persönlich bei Ihnen und vereinbaren einen Termin für das Gespräch.";
  const wer = en ? `my colleague ${r.kollege}` : `${r.weiblich ? "meine Kollegin" : "mein Kollege"} ${r.kollege}`;
  const Wer = wer.charAt(0).toUpperCase() + wer.slice(1);
  if (r.art === "heute") return en ? `${Wer} will call you today to arrange a time for the call.` : `${Wer} ruft Sie heute noch an und vereinbart mit Ihnen einen Termin.`;
  if (r.art === "ab" && r.abTag) {
    const z = berlinZeit(r.abTag);
    return en ? `${Wer} will call you on ${WT_EN_LANG[z.tag]} from 9 am (German time) to arrange a time for the call.` : `${Wer} ruft Sie am ${z.wochentag} ab 9 Uhr an und vereinbart mit Ihnen einen Termin.`;
  }
  return en ? `${Wer} will get in touch with you personally to arrange a time for the call.` : `${Wer} meldet sich persönlich bei Ihnen und vereinbart mit Ihnen einen Termin.`;
}

// ── Die Mail (Bausteine — der Server baut daraus HTML im Gmail-Stil und Text) ───────────────────────────────
export type LeadBlock =
  | { art: "absatz"; text: string }
  | { art: "zeilen"; zeilen: string[] }
  | { art: "link"; text: string; url: string; anzeige: string }
  | { art: "satzMitLink"; vor: string; url: string; anzeige: string; nach: string };

export interface LeadMailText {
  art: LeadMailArt;
  sprache: LeadSprache;
  /** Betreff der ersten Mail; der Nachfass antwortet im Faden („Re: …“). */
  betreff: string;
  anrede: string;
  bloecke: LeadBlock[];
  gruss: string;
  /** Die leise Zeile über dem Impressum: der Abmelde-Satz (Antwort „keine Mails“ setzt die Sperre). */
  fussSatz: string;
}

export interface LeadLinkTeil {
  url: string; anzeige: string; bis?: Date | null;
  /** false = der allgemeine Kalender (kein persönlicher Link) — dann verspricht der Satz nicht „Ihre Angaben sind schon eingetragen“. */
  vorausgefuellt?: boolean;
}

export const LEAD_BETREFF = { de: "Ihre Anfrage bei FIAON Global", en: "Your enquiry with FIAON Global" } as const;
export const LEAD_GRUSS = { de: "Herzliche Grüße", en: "Kind regards" } as const;
/** Der Abmelde-Satz (Gutachten 0, Mangel 5) — die Antwort „keine Mails“ erkennt keineMailsGewuenscht. */
export const LEAD_FUSS_SATZ = {
  de: "Sie möchten keine weiteren Mails von mir? Eine kurze Antwort mit „keine Mails“ genügt.",
  en: "Would you rather not receive further emails from me? A short reply saying “no emails” is enough.",
} as const;

/** Die Anzeige eines Links ohne Protokoll: „fiaon.com/g/AbC…“. Rein. */
export function linkAnzeige(url: string): string {
  return String(url ?? "").replace(/^https?:\/\//, "");
}

export interface WillkommenEingang {
  sprache: LeadSprache;
  /** Voller Name aus dem Formular. */
  name: string;
  anrede?: string | null;
  /** Meta-Formular (Antworten) oder Website (Nachricht/Paket). */
  kanal: "meta" | "website";
  antworten: readonly LeadAntwort[];
  /** Hat er auf der Website etwas geschrieben? (Wir zitieren es nie — sein Text kann alles enthalten.) */
  mitNachricht: boolean;
  /** Paketwunsch der Website — nur der Name, nie der Preis. */
  paketName?: string | null;
  /** Österreich: kein Steuerberater-/Unternehmensberater-Satz (Gutachten 1, Mangel 11; E-439/E-454). */
  oesterreich: boolean;
  /** Privat-Bestandskunde mit Global-Interesse (Gutachten 1, Mangel 1 Nr. 5). */
  bestandskunde: boolean;
  link: LeadLinkTeil;
  eingangAm: Date;
  jetzt: Date;
  ruf: RufLage;
  dauerMin?: number;
  /**
   * Nachbesserung (Gutachten Lead-Sicht, Mangel 7): „Rückruf statt Termin“ auf der Website mit „Wann erreichen wir Sie am
   * besten?“ — dann fragt die Mail nicht noch einmal nach einer Uhrzeit, und der Link ist nur ein Angebot.
   */
  wunschzeit?: string | null;
  /** Nachbesserung (Mangel 8): Der Kalender zeigt gerade keine freie Zeit — dann kein Versprechen „hier wählen Sie“. */
  kalenderLeer?: boolean;
  /** E-481 (Mara Business): der WhatsApp-Link zu Mara mit Anfrage-Kennung — die Wahl „lieber schriftlich“. Ohne: keine Zeile. */
  whatsapp?: { url: string } | null;
  /** E-487 (09.11.2026): Empfehlung eines Partners — wer empfohlen hat (erster Satz). Ohne: die übliche Fassung. */
  empfehler?: { name: string; nachname?: string | null; anrede?: "Herr" | "Frau" | null } | null;
}

/** E-487: der Empfehlende im ersten Satz — „Herr Muster“ bzw. der volle Name; nie etwas, das nach Adresse oder Code aussieht. Rein. */
function empfehlerText(p: WillkommenEingang["empfehler"], sprache: LeadSprache): string | null {
  const voll = String(p?.name ?? "").replace(/\s+/g, " ").trim();
  const nach = String(p?.nachname ?? "").replace(/\s+/g, " ").trim();
  if (voll.length < 2 || siehtNachAdresseAus(voll) || /[<>"{}[\]]/.test(voll)) return null;
  if (p?.anrede && nach) return sprache === "en" ? `${p.anrede === "Frau" ? "Ms" : "Mr"} ${nach}` : `${p.anrede} ${nach}`;
  return voll;
}

/**
 * W — WILLKOMMEN (sofort, auch nachts, aus js@ mit Justins Unterschrift). Fassungen: Meta (sein Vorhaben in einem Satz),
 * Website (ohne Liste), Rückruf mit Wunschzeit, Kalender leer, Nachtrag (später als 30 Minuten), Bestandskunde, Österreich,
 * Englisch. Nachbesserung 05.11.2026 (Gutachten Lead-Sicht 4/7/8/14/19): ein Satz statt Formular-Echo, höchstens ein
 * Gedankenstrich, keine Zusage „wir rufen genau dann an“, die Uhrzeit-Bitte nur, wo es einen Ablauf dafür gibt. Rein.
 */
export function willkommenText(e: WillkommenEingang): LeadMailText {
  const en = e.sprache === "en";
  const dauer = e.dauerMin ?? LEAD_POST_VORGABE.dauerMin;
  const nachtrag = e.jetzt.getTime() - e.eingangAm.getTime() > LEAD_POST_VORGABE.nachtragAbMin * 60_000;
  const bloecke: LeadBlock[] = [];
  const wunschzeit = e.kanal === "website" ? wunschzeitFuerText(e.wunschzeit) : null;

  // 1. Einstieg — „angekommen“, nie „gelesen“; der Nachtrag entschuldigt sich erst ab dem nächsten Tag bzw. nach 12 Stunden.
  // E-487: Empfehlung — die Person hat selbst nichts angefragt: Der erste Satz nennt den Empfehlenden (kein „Dank für Ihre
  // Anfrage“, kein Nachtrag-Satz), Absatz 2 (Vorhaben) entfällt; danach wie W: Gespräch, Link, wer anruft, Mara.
  // E-487 Nachbesserung (Gutachten Partner-Empfehlung, Mangel 12): Taugt der Name des Empfehlenden nicht für Justins Mail (sieht nach
  // Adresse oder Code aus), bleibt es trotzdem die Empfehlungs-Fassung — mit „Ein Geschäftspartner von uns“ statt „vielen Dank für
  // Ihre Anfrage“ an jemanden, der nie angefragt hat.
  const istEmpfehlung = !!e.empfehler;
  const empfehler = istEmpfehlung ? (empfehlerText(e.empfehler, e.sprache) ?? (en ? "A business partner of ours" : "Ein Geschäftspartner von uns")) : null;
  let einstieg: string;
  if (empfehler) {
    einstieg = en
      ? `${empfehler} passed your details on to me and thought a conversation with us could be of interest to you. I am glad to be in touch.`
      : `${empfehler} hat mir Ihren Kontakt gegeben und meinte, ein Gespräch mit uns könnte für Sie interessant sein. Schön, dass ich mich bei Ihnen melden darf.`;
  } else if (nachtrag) {
    const spaet = !tagBezug(e.eingangAm, e.jetzt, e.sprache).heute
      || e.jetzt.getTime() - e.eingangAm.getTime() > LEAD_POST_VORGABE.entschuldigungAbStunden * 3_600_000;
    const bezug = meldeBezug(e.eingangAm, e.jetzt, e.sprache);
    einstieg = spaet
      ? (en ? `You contacted us ${bezug}. Please excuse that you are only hearing from me now, and thank you for your enquiry.`
        : `Sie hatten sich ${bezug} bei uns gemeldet. Entschuldigen Sie bitte, dass Sie erst jetzt von mir hören, und vielen Dank für Ihre Anfrage.`)
      : (en ? "thank you for your enquiry from earlier today." : "vielen Dank für Ihre Anfrage von heute.");
  } else if (e.bestandskunde) {
    einstieg = en
      ? "thank you for your enquiry. It is good to hear that you are also interested in FIAON Global. Your details have reached me."
      : "vielen Dank für Ihre Anfrage. Schön, dass Sie sich auch für FIAON Global interessieren. Ihre Angaben sind bei mir angekommen.";
  } else {
    einstieg = en ? "thank you for your enquiry. Your details have reached me." : "vielen Dank für Ihre Anfrage. Ihre Angaben sind bei mir angekommen.";
  }
  // Englische Briefe beginnen nach der Anrede groß.
  if (en) einstieg = einstieg.charAt(0).toUpperCase() + einstieg.slice(1);
  bloecke.push({ art: "absatz", text: einstieg });

  // 2. SEIN Vorhaben — EIN Satz in Sie-Form, ohne Betrag, ohne Rolle (Meta); die Website-Fassung zitiert nie.
  const v = e.kanal === "meta" ? vorhabenSatz(e.antworten, e.sprache) : { satz: "", folge: "" };
  if (v.satz) {
    bloecke.push({ art: "absatz", text: [v.satz, v.folge].filter(Boolean).join(" ") });
  } else if (!empfehler) {
    const paket = String(e.paketName ?? "").replace(/\s*\([^)]*\)\s*$/, "").trim();
    const website = paket
      ? (en ? `You are interested in ${paket}.` : `Sie interessieren sich für ${paket}.`)
      : e.mitNachricht
        ? (en ? "You have briefly described what matters to you, and I will go into exactly that in the call." : "Sie haben uns kurz beschrieben, worum es Ihnen geht. Genau darauf gehe ich im Gespräch ein.")
        : (en ? "You would like to know how FIAON Global works for you." : "Sie möchten wissen, wie FIAON Global für Sie funktioniert.");
    bloecke.push({ art: "absatz", text: website });
  }

  // 3. Was wir tun und das Gespräch — ein Absatz (Justins Wortlaut, mit den Grenzen aus Gutachten 1, Mangel 8 und 11).
  const partner = e.oesterreich
    ? (en ? "with one fixed contact person and partner lawyers behind it" : "mit einem festen Ansprechpartner und Partner-Anwälten dahinter")
    : (en ? "with one fixed contact person and partner lawyers, tax advisers and business consultants behind it"
      : "mit einem festen Ansprechpartner und Partner-Anwälten, Steuerberatern und Unternehmensberatern dahinter");
  const kapital = e.kanal === "meta" ? willKapital(e.antworten) : false;
  const schluss = kapital
    ? (en ? "First the US company, then the route to capital: we take care of everything right through to the signature at the bank." : "Erst die US-Gesellschaft, dann der Weg zum Kapital: Wir kümmern uns um alles bis zur Unterschrift bei der Bank.")
    : (en ? "We take care of everything right through to the signature at the bank." : "Wir kümmern uns um alles bis zur Unterschrift bei der Bank.");
  const gespraech = en
    ? `In a free call (around ${dauer} minutes, by phone) I will tell you honestly whether a US company suits your plans, how the process works and what it costs.`
    : `Im kostenlosen Gespräch (etwa ${dauer} Minuten, am Telefon, auf Deutsch) sage ich Ihnen ehrlich, ob eine US-Gesellschaft zu Ihrem Vorhaben passt, wie der Ablauf ist und was es kostet.`;
  bloecke.push({
    art: "absatz",
    text: en
      ? `We set up a US company with a US bank account for business owners from the German-speaking countries, ${partner}. ${schluss} ${gespraech}`
      : `Wir bauen für Unternehmer aus dem deutschsprachigen Raum eine eigene US-Gesellschaft mit US-Konto auf, ${partner}. ${schluss} ${gespraech}`,
  });

  // 4. Wie es weitergeht — drei Fassungen, je nach dem, was er gewählt hat und was der Kalender gerade kann.
  const voraus = e.link.vorausgefuellt !== false;
  if (wunschzeit) {
    // Rückruf statt Termin: seine Zeit gilt — der Link ist nur ein Angebot.
    const r = e.ruf;
    const wer = r.kollege ? (en ? `my colleague ${r.kollege}` : `${r.weiblich ? "meine Kollegin" : "mein Kollege"} ${r.kollege}`) : null;
    const Wer = wer ? wer.charAt(0).toUpperCase() + wer.slice(1) : null;
    bloecke.push({
      art: "absatz",
      text: en
        ? `You would prefer a call at this time: ${wunschzeit}. ${Wer ? `${Wer} will get in touch with you then.` : "We will get in touch with you then."}`
        : `Sie möchten am liebsten zu dieser Zeit angerufen werden: ${wunschzeit}. ${Wer ? `${Wer} meldet sich dann bei Ihnen.` : "Wir melden uns dann bei Ihnen."}`,
    });
    if (!e.kalenderLeer) {
      bloecke.push({
        art: "link",
        text: en ? `Would you rather book a fixed time with me straight away? This is the place${voraus ? ", your details are already filled in" : ""}:`
          : `Lieber gleich einen festen Termin mit mir? Hier geht es${voraus ? ", Ihre Angaben sind schon eingetragen" : ""}:`,
        url: e.link.url, anzeige: e.link.anzeige,
      });
    }
  } else if (e.kalenderLeer) {
    bloecke.push({ art: "absatz", text: rufSatzOhneKalender(e.ruf, e.sprache) });
  } else {
    bloecke.push({
      art: "link",
      text: voraus
        ? (en ? "You can choose a time with me here, your details are already filled in:" : "Ihren Termin mit mir wählen Sie hier, Ihre Angaben sind schon eingetragen:")
        : (en ? "You can choose a time with me here:" : "Ihren Termin mit mir wählen Sie hier:"),
      url: e.link.url, anzeige: e.link.anzeige,
    });
    // Keine der Zeiten passt? Seine Zeiten in einer Antwort — dahinter steht der Rückruf-Auftrag (Antwort-Leser in js@). Kein
    // „wir rufen Sie genau dann an“ (Gutachten Lead-Sicht, Mangel 2): abgestimmt wird im Anruf.
    bloecke.push({
      art: "absatz",
      text: `${en ? "None of the times suit you? Reply with two or three times that work for you and we will arrange the call with you." : "Passt Ihnen keine der Zeiten? Nennen Sie mir in einer kurzen Antwort zwei, drei Zeiten, dann stimmen wir den Termin mit Ihnen ab."} ${rufSatz(e.ruf, e.sprache)}`,
    });
  }

  // 5. E-481 (Mara Business): Der Lead wählt selbst, wie er das Gespräch führt — Telefon (Link oben), E-Mail (einfach
  //    antworten) oder WhatsApp mit Mara (Link mit Anfrage-Kennung; ein Tipp darauf ist zugleich sein Ja zu WhatsApp).
  if (e.whatsapp?.url) {
    bloecke.push({
      art: "link",
      text: en
        ? "Prefer to write? Simply reply to this email, or message my digital assistant Mara on WhatsApp:"
        : "Lieber schriftlich? Antworten Sie einfach auf diese Mail oder schreiben Sie meiner digitalen Assistentin Mara auf WhatsApp:",
      url: e.whatsapp.url, anzeige: en ? "Message Mara on WhatsApp" : "Mara auf WhatsApp schreiben",
    });
  }

  return {
    art: "willkommen", sprache: e.sprache, betreff: LEAD_BETREFF[e.sprache], anrede: leadAnredeZeile(e.name, e.sprache, e.anrede),
    bloecke, gruss: LEAD_GRUSS[e.sprache], fussSatz: LEAD_FUSS_SATZ[e.sprache],
  };
}

export interface NachfassEingang {
  sprache: LeadSprache;
  name: string;
  anrede?: string | null;
  link: LeadLinkTeil;
  /** Wann das Willkommen hinausging. */
  willkommenAm: Date;
  jetzt: Date;
  /** Hat die zuständige Person angerufen und ihn nicht erreicht (nicht erreicht/Mailbox)? Dann sagt N1 genau das. */
  anrufVersuch?: { am: Date; kollege: string; weiblich?: boolean } | null;
  /** Was wir von ihm haben: Formular-Antworten, eine Nachricht — oder nichts. */
  angaben: "antworten" | "nachricht" | null;
  /** Brauchbarer Firmenname (für N3) — sonst null. Steht nur ohne Adresse im Text (firmaFuerText). */
  firma?: string | null;
  dauerMin?: number;
  /** Nachbesserung (Gutachten Lead-Sicht, Mangel 8): Der Kalender zeigt gerade keine freie Zeit. */
  kalenderLeer?: boolean;
  /**
   * E-487 (09.11.2026): Maras WhatsApp-Link (wie in W, mit Anfrage-Kennung) — auch in N1–N3, damit er jederzeit schriftlich
   * weitermachen kann. Ohne Link (Mara Business aus, keine Nummer): keine Zeile.
   */
  whatsapp?: { url: string } | null;
  /** E-487 Nachbesserung (Gutachten Partner-Empfehlung, Mangel 12): Empfehlung eines Partners — N3 spricht nicht von „Ihrer Anfrage“. */
  empfehlung?: boolean;
}

/** E-487: die WhatsApp-Zeile im Nachfass — N1/N2 „Lieber schriftlich?“, N3 als letzter Weg. Ohne Gedankenstrich. Rein. */
function nachfassWhatsappBlock(stufe: 1 | 2 | 3, url: string, en: boolean): LeadBlock {
  const text = stufe === 3
    ? (en ? "You can also reach my digital assistant Mara on WhatsApp:" : "Auch auf WhatsApp erreichen Sie meine digitale Assistentin Mara:")
    : (en ? "Prefer to write? Message my digital assistant Mara on WhatsApp:" : "Lieber schriftlich? Schreiben Sie meiner digitalen Assistentin Mara auf WhatsApp:");
  return { art: "link", text, url, anzeige: en ? "Message Mara on WhatsApp" : "Mara auf WhatsApp schreiben" };
}

/** N1 (+1 Werktag) · N2 (+3) · N3 (+7, letzte) — im selben Faden, mit dem persönlichen Link. Höchstens ein Gedankenstrich. Rein. */
export function nachfassText(stufe: 1 | 2 | 3, e: NachfassEingang): LeadMailText {
  const en = e.sprache === "en";
  const bloecke: LeadBlock[] = [];
  const dauer = e.dauerMin ?? LEAD_POST_VORGABE.dauerMin;
  const zeitenBitte = en
    ? "Reply with two or three times that suit you and we will arrange the call with you."
    : "Nennen Sie mir in einer kurzen Antwort zwei, drei Zeiten, dann stimmen wir den Termin mit Ihnen ab.";
  if (stufe === 1) {
    if (e.anrufVersuch) {
      const wer = en ? `my colleague ${e.anrufVersuch.kollege}` : `${e.anrufVersuch.weiblich ? "meine Kollegin" : "mein Kollege"} ${e.anrufVersuch.kollege}`;
      const wann = tagBezug(e.anrufVersuch.am, e.jetzt, e.sprache).wort;
      bloecke.push({ art: "absatz", text: en ? `My colleague ${e.anrufVersuch.kollege} tried to call you ${wann}, unfortunately without luck.` : `${wer} hat ${wann} versucht, Sie anzurufen, leider ohne Glück.` });
    } else {
      const b = tagBezug(e.willkommenAm, e.jetzt, e.sprache);
      const von = en ? (b.heute ? "from earlier today" : b.gestern ? "from yesterday" : `from ${b.wort.replace(/^on /, "")}`) : (b.heute ? "von heute" : b.gestern ? "von gestern" : `vom ${berlinZeit(e.willkommenAm).wochentag}`);
      bloecke.push({ art: "absatz", text: en ? `Just a quick note to check whether my message ${von} reached you.` : `kurz nachgefragt, ob meine Nachricht ${von} angekommen ist.` });
    }
    if (e.kalenderLeer) {
      bloecke.push({ art: "absatz", text: en ? `Online, my times are fully booked at the moment. ${zeitenBitte}` : `Online sind meine Zeiten gerade vergeben. ${zeitenBitte}` });
    } else {
      // „in einer Minute“ statt „mit einem Klick“ (Gutachten Lead-Sicht, Mangel 15): Link, Uhrzeit, „vereinbaren“.
      bloecke.push({ art: "link", text: en ? "Booking a time with me takes a minute; your details are already filled in:" : "Ihr Termin mit mir ist in einer Minute gebucht, Ihre Angaben sind schon eingetragen:", url: e.link.url, anzeige: e.link.anzeige });
      bloecke.push({ art: "absatz", text: en ? "Or reply with two or three times that suit you and we will arrange the call with you." : "Oder nennen Sie mir in einer kurzen Antwort zwei, drei Zeiten, dann stimmen wir den Termin mit Ihnen ab." });
    }
    if (e.whatsapp?.url) bloecke.push(nachfassWhatsappBlock(1, e.whatsapp.url, en));
  } else if (stufe === 2) {
    const schon = e.angaben === "antworten"
      ? (en ? " (I already have the details from your form)" : " (Ihre Angaben aus dem Formular habe ich schon)")
      : e.angaben === "nachricht" ? (en ? " (I already have your message)" : " (Ihre Nachricht habe ich schon)") : "";
    bloecke.push({ art: "absatz", text: en ? "So that you know what to expect in the call:" : "damit Sie wissen, was Sie im Gespräch erwartet:" });
    bloecke.push({
      art: "zeilen",
      zeilen: en
        ? [
          `1. You tell me in two or three sentences what you have in mind${schon}.`,
          "2. I tell you honestly whether a US company fits – and if it does not, I will say so too.",
          "3. If it fits, I show you the process step by step through to the signature at the bank, and the fixed price for your package.",
        ]
        : [
          `1. Sie erzählen mir in zwei, drei Sätzen, was Sie vorhaben${schon}.`,
          "2. Ich sage Ihnen ehrlich, ob eine US-Gesellschaft dazu passt – und wenn nicht, auch das.",
          "3. Passt es, zeige ich Ihnen den Ablauf Schritt für Schritt bis zur Unterschrift bei der Bank und den Festpreis für Ihr Paket.",
        ],
    });
    const dreissig = dauer === 30 ? (en ? "Thirty minutes" : "Dreißig Minuten") : (en ? `${dauer} minutes` : `${dauer} Minuten`);
    if (e.kalenderLeer) bloecke.push({ art: "absatz", text: en ? `${dreissig}, free of charge, by phone. ${zeitenBitte}` : `${dreissig}, kostenlos, am Telefon. ${zeitenBitte}` });
    else bloecke.push({ art: "link", text: en ? `${dreissig}, free of charge, by phone:` : `${dreissig}, kostenlos, am Telefon:`, url: e.link.url, anzeige: e.link.anzeige });
    if (e.whatsapp?.url) bloecke.push(nachfassWhatsappBlock(2, e.whatsapp.url, en));
  } else {
    // E-487 Nachbesserung (Mangel 12): Bei einer Empfehlung gab es keine Anfrage — „dazu“ statt „zu Ihrer Anfrage“.
    bloecke.push({
      art: "absatz",
      text: e.empfehlung
        ? (en ? "I do not want to flood you with emails – this is my last message on this." : "ich möchte Sie nicht mit Mails überhäufen – das ist meine letzte Nachricht dazu.")
        : (en ? "I do not want to flood you with emails – this is my last message about your enquiry." : "ich möchte Sie nicht mit Mails überhäufen – das ist meine letzte Nachricht zu Ihrer Anfrage."),
    });
    const bis = e.link.bis ? datumText(e.link.bis, e.sprache) : null;
    bloecke.push({
      art: "satzMitLink",
      vor: en ? "If the topic becomes relevant again later: your link " : "Wenn das Thema später wieder aktuell wird: Ihr Link ",
      url: e.link.url, anzeige: e.link.anzeige,
      nach: en
        ? `${bis ? ` is valid until ${bis}` : " stays valid for a while"}, and a short reply to this email is enough.`
        : `${bis ? ` gilt noch bis ${bis}` : " gilt noch eine Weile"}, und eine kurze Antwort auf diese Mail genügt.`,
    });
    if (e.whatsapp?.url) bloecke.push(nachfassWhatsappBlock(3, e.whatsapp.url, en));
    // Die Firma nur, wenn sie keine Adresse ist (Gutachten Sicherheit, Mangel 4) — sonst der Satz ohne sie.
    const firma = firmaFuerText(e.firma);
    bloecke.push({ art: "absatz", text: en ? `I wish you every success${firma ? ` with ${firma}` : ""}.` : `Ich wünsche Ihnen viel Erfolg${firma ? ` mit ${firma}` : ""}.` });
  }
  return {
    art: stufe === 1 ? "n1" : stufe === 2 ? "n2" : "n3", sprache: e.sprache, betreff: `Re: ${LEAD_BETREFF[e.sprache]}`,
    anrede: leadAnredeZeile(e.name, e.sprache, e.anrede), bloecke, gruss: LEAD_GRUSS[e.sprache], fussSatz: LEAD_FUSS_SATZ[e.sprache],
  };
}

/** Die Mail als Klartext (Protokoll, Vorschau, Text-Teil). Rein. */
export function leadMailKlartext(m: LeadMailText): string {
  const teile: string[] = [m.anrede, ""];
  for (const b of m.bloecke) {
    if (b.art === "absatz") teile.push(b.text, "");
    else if (b.art === "zeilen") teile.push(b.zeilen.join("\n"), "");
    else if (b.art === "link") teile.push(b.text, b.url, "");
    else teile.push(`${b.vor}${b.url}${b.nach}`, "");
  }
  teile.push(m.gruss);
  return teile.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE PLATZHALTER-WACHE — keine Mail mit Lücke geht hinaus
// ═══════════════════════════════════════════════════════════════════════════
const WACHE: readonly [string, RegExp][] = [
  ["geschweifte Klammer (Platzhalter)", /[{}]/],
  ["eckiger Platzhalter", /\[(?:name|firma|vorname|nachname|code|link|datum|uhrzeit|kollege|anrede|[A-ZÄÖÜ][A-ZÄÖÜ_ ]{2,})\]/i],
  ["„undefined“/„null“/„NaN“", /\bundefined\b|\bNaN\b|\[object Object\]|(?:^|\s)null(?:\s|[.,;:]|$)/],
  ["leere Klammer oder leere Anführung", /\(\s*\)|„\s*“|"\s*"|“\s*”/],
  ["Leerzeichen vor Satzzeichen (leerer Wert)", /\S\s+[,.;:](?:\s|$)/],
  // Der persönliche Link hat genau zehn Zeichen — „fiaon.com/g“, „fiaon.com/g/“ oder ein abgeschnittener Code ist eine Lücke.
  ["Link ohne Code", /fiaon\.com\/g(?:\/(?![A-Za-z0-9]{10}(?![A-Za-z0-9]))[A-Za-z0-9]*)?(?=[\s.,;:)"'<]|$)/],
  ["doppelte Leerstelle im Satz", /[A-Za-zÄÖÜäöüß] {2,}[A-Za-zÄÖÜäöüß]/],
];

/** Was an einer fertigen Mail nach einer Lücke aussieht — leer = sendbar. Rein. */
export function platzhalterWache(text: unknown): string[] {
  const t = String(text ?? "");
  return WACHE.filter(([, re]) => re.test(t)).map(([w]) => w);
}

// ═══════════════════════════════════════════════════════════════════════════
// ANTWORTEN: „keine Mails“ und die Wunschzeit
// ═══════════════════════════════════════════════════════════════════════════
// Eindeutig, wie die Radar-Regel (fiaon-radar-faden.ts, ABMELDUNG_KURZ/ABMELDUNG): die GANZE Antwort ist ein „keine Mails“,
// „Stopp“ oder „kein Interesse“ — oder ein klarer Satz. Nie ein Halbsatz: „Ich habe keine Mail bekommen“ ist eine Nachfrage,
// „kein Interesse an einem Kredit, nur an der Gründung“ ist Interesse, „One-Stop-Shop“ ist kein Stopp. Wer nachfragt, bekommt
// einen Rückruf — wer sich abmeldet, keine Mail mehr.
const KEINE_MAILS_GANZ = /^\s*(?:bitte\s+)?(?:keine\s+(?:weiteren\s+)?(?:(?:e-?)?mails?|nachrichten)(?:\s+mehr)?|stop+|abmelden|abbestellen|austragen|unsubscribe|remove\s+me|no\s+(?:more\s+)?e-?mails?|kein\s+(?:interesse|bedarf)(?:\s+mehr)?|nein,?\s+danke|no,?\s+thanks?|not\s+interested)(?:[\s,]*(?:bitte|danke|please|thanks?|thank\s+you))?[\s.!]*$/i;
const KEINE_MAILS_SATZ = /\bkeine\s+(?:weiteren\s+)?(?:e-?)?mails\s+(?:mehr|von\s+ihnen|an\s+mich)\b|\bkeine\s+weiteren\s+(?:e-?mails|mails|nachrichten|zusendungen)\b|\b(?:schreiben|mailen)\s+sie\s+(?:mir|uns)\s+(?:bitte\s+)?nicht\s+mehr\b|\bnicht\s+mehr\s+(?:an)?schreiben\b|\bbitte\s+(?:austragen|abmelden|entfernen)\b|\b(?:mich|uns)\s+(?:bitte\s+)?(?:abmelden|austragen)\b|\b(?:möchte|will)\s+(?:bitte\s+)?keine\s+(?:e-?)?mails\b|\bplease\s+(?:remove|unsubscribe)\s+me\b|\bno\s+more\s+e-?mails\b|\bstop\s+(?:e-?mailing|contacting|writing\s+to)\s+me\b|\bkein\s+interesse\s+mehr\b|\bhabe\s+kein\s+interesse\b(?!\s+(?:an|am|für|daran)\b)|\bno\s+longer\s+interested\b/i;
const GRUSS_DANACH = /^(?:viele|beste|freundliche|liebe|herzliche|schöne|mit\s+freundlichen|mfg|vg|lg|gruß|grüße|gruss|best|kind\s+regards|regards|cheers|thanks|danke)\b/i;

/** Will er keine Lead-Mails mehr? Nur der eigene Text (ohne Zitat) — eindeutig, nie ein Halbsatz. Rein. */
export function keineMailsGewuenscht(text: unknown): boolean {
  const t = String(text ?? "").replace(/\r/g, "").slice(0, 2000).trim();
  if (!t) return false;
  if (KEINE_MAILS_GANZ.test(t) || KEINE_MAILS_SATZ.test(t)) return true;
  // „Keine Mails mehr.\n\nViele Grüße\nMax“ — der erste Absatz allein, wenn danach nur Gruß und Name stehen.
  const absaetze = t.split(/\n\s*\n/);
  const rest = absaetze.slice(1).join("\n").trim();
  if (absaetze.length > 1 && KEINE_MAILS_GANZ.test(absaetze[0]) && (rest.length <= 80 || GRUSS_DANACH.test(rest))) return true;
  const zeilen = t.split("\n").map((z) => z.trim()).filter(Boolean);
  return zeilen.length > 1 && KEINE_MAILS_GANZ.test(zeilen[0]) && zeilen.slice(1).join(" ").length <= 80;
}

// ── SCHRIFTLICHE ABSAGE, „KEINE MAILS“, „KEINE ANRUFE“ (Nachbesserung E-476, Gutachten Sicherheit 6 + 13, Lead-Sicht 1) ──
// Zwei Stufen, damit niemand gegen eine schriftliche Absage angerufen wird (§ 7 UWG) und niemand das Telefon verliert, der nur
// keine Mails will:
//   absage       „kein Interesse“, „nicht interessiert“, „nein danke“, „Stopp“ (die ganze Antwort), „no thanks“ … → keine Mail
//                UND kein Anruf: der Auftrag schließt sich, die Firma steht auf „kein Interesse“, die Leiter schweigt.
//   keine_mails  „keine Mails mehr“, „abmelden“, „bitte austragen“, „unsubscribe“ — und die Abmelde-Mail des Mailprogramms
//                (Betreff „Stopp“/„Unsubscribe“ bei leerem Text, List-Unsubscribe) → keine Lead-Mail mehr, anrufen bleibt erlaubt.
//   keineAnrufe  „bitte nicht anrufen“, „nur per Mail“ → kein Rückruf-Auftrag (der Lead bleibt ein Lead, Justin antwortet).
const ABSAGE_GANZ = /^\s*(?:(?:nein|nö|nee|no)[\s.,!]*)?(?:danke[\s,.!]*)?(?:kein(?:e)?\s+(?:interesse|bedarf)(?:\s+mehr)?|nicht\s+(?:mehr\s+)?interessiert|(?:ist\s+)?(?:gerade\s+|aktuell\s+|derzeit\s+)?kein\s+thema|nein,?\s+danke|no,?\s+thanks?|not\s+interested|no\s+longer\s+interested|stop+)(?:[\s,]*(?:bitte|danke|please|thanks?|thank\s+you))?[\s.!]*$/i;
const ABSAGE_SATZ = /\bkein\s+interesse\s+mehr\b|\bhabe\s+kein\s+interesse\b(?!\s+(?:an|am|für|daran)\b)|\bbin\s+nicht\s+(?:mehr\s+)?interessiert\b|\bno\s+longer\s+interested\b|\bnot\s+interested\s+(?:any\s?more|at\s+all)\b|\bkontaktieren\s+sie\s+(?:mich|uns)\s+(?:bitte\s+)?nicht\s+mehr\b|\b(?:do\s+not|don'?t|stop)\s+contact(?:ing)?\s+(?:me|us)\b/i;
const NEIN_ALLEIN = /^\s*(?:nein|nö|nee|no)[\s.,!]*(?:danke|thanks?|thank\s+you)?[\s.,!]*$/i;
const KEINE_ANRUFE = /\bkeine\s+(?:weiteren\s+)?anrufe\b|\bnicht\s+(?:mehr\s+)?an(?:zu)?rufen\b|\brufen\s+sie\s+(?:mich|uns)\s+(?:bitte\s+)?nicht\s+an\b|\b(?:bitte\s+)?nur\s+(?:per\s+)?(?:e-?mail|mail|schriftlich)\b|\bno\s+(?:phone\s+)?calls\b|\b(?:do\s+not|don'?t)\s+(?:call|phone)\b|\b(?:by\s+)?e-?mail\s+only\b/i;
const ABMELDE_BETREFF = /^\s*(?:re:\s*)?(?:stopp?|unsubscribe|abmelden|abbestellen)\s*$/i;

export interface LeadAntwortArt { art: "absage" | "keine_mails" | "antwort"; keineAnrufe: boolean }

/**
 * Was will der Lead mit seiner Antwort? `kern` = sein eigener Text (ohne Zitat), `vorab` = die Radar-Vorprüfung (antwortVorab).
 * Eindeutig, nie ein Halbsatz („kein Interesse an einem Kredit, nur an der Gründung“ ist Interesse). Rein.
 */
export function leadAntwortArt(ein: { kern: unknown; betreff?: unknown; vorab?: string | null }): LeadAntwortArt {
  const t = String(ein.kern ?? "").replace(/\r/g, "").slice(0, 2000).trim();
  const keineAnrufe = KEINE_ANRUFE.test(t);
  // Die Abmelde-Mail des Mailprogramms (List-Unsubscribe): Betreff „Stopp“, kaum eigener Text — nur keine Mails mehr.
  if (ABMELDE_BETREFF.test(String(ein.betreff ?? "")) && t.replace(/this message was automatically generated[^\n]*/i, "").trim().length <= 40) {
    return { art: "keine_mails", keineAnrufe };
  }
  const ersterAbsatz = t.split(/\n\s*\n/)[0] ?? "";
  if (ABSAGE_GANZ.test(t) || NEIN_ALLEIN.test(ersterAbsatz) && t.length - ersterAbsatz.length <= 120
    || (ABSAGE_GANZ.test(ersterAbsatz) && t.length - ersterAbsatz.length <= 120) || ABSAGE_SATZ.test(t)) {
    return { art: "absage", keineAnrufe: true };
  }
  if (keineMailsGewuenscht(t)) return { art: "keine_mails", keineAnrufe };
  // Die Radar-Vorprüfung sagt „kein Interesse“ (z. B. „bitte schreiben Sie mir nicht mehr“): Mails stoppen — eine Absage
  // ist es nur mit den eindeutigen Worten oben.
  if (ein.vorab === "kein_interesse") return { art: "keine_mails", keineAnrufe };
  return { art: "antwort", keineAnrufe };
}

// Nur ganze Wochentage — Kürzel wie „Fr.“ (Frau) oder „So.“ (Satzende) wären Fehlgriffe.
const WT_DE = ["sonntag", "montag", "dienstag", "mittwoch", "donnerstag", "freitag", "samstag"];
const WT_EN = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** Kalendertag ± n (mittags in UTC — über jede Zeitumstellung derselbe Tag). Rein. */
export function isoPlus(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n, 12)).toISOString().slice(0, 10);
}

/**
 * Nennt die Antwort einen Tag UND eine Uhrzeit? „Mittwoch 14 Uhr“, „morgen um 10“, „am 12.11. um 15:30“, „tomorrow at 3 pm“.
 * Uneindeutig („nächste Woche“, „vormittags“) = null. Nur zwischen 7 und 20 Uhr. Rein (`jetzt` als Parameter).
 */
export function wunschzeitErkennen(roh: unknown, jetzt: Date): { tag: string; zeit: string; text: string } | null {
  // „Guten Morgen“ ist ein Gruß, kein Tag.
  const t = String(roh ?? "").toLowerCase().replace(/\s+/g, " ").replace(/\bguten morgen\b|\bgood morning\b/g, " ").slice(0, 1500);
  const heute = berlinZeit(jetzt);
  let tag: string | null = null;
  let tagWort = "";
  const datum = /\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})?/.exec(t);
  if (/(?:^|[^a-zäöüß])übermorgen\b|\bday after tomorrow\b/.test(t)) { tag = isoPlus(heute.iso, 2); tagWort = "übermorgen"; }
  else if (/(?:^|[^a-zäöüß])morgen\b|\btomorrow\b/.test(t)) { tag = isoPlus(heute.iso, 1); tagWort = "morgen"; }
  else if (/\bheute\b|\btoday\b/.test(t)) { tag = heute.iso; tagWort = "heute"; }
  else if (datum) {
    const tg = Number(datum[1]), mo = Number(datum[2]);
    let jahr = datum[3] ? Number(datum[3].length === 2 ? `20${datum[3]}` : datum[3]) : Number(heute.iso.slice(0, 4));
    if (tg >= 1 && tg <= 31 && mo >= 1 && mo <= 12) {
      let iso = `${jahr}-${String(mo).padStart(2, "0")}-${String(tg).padStart(2, "0")}`;
      if (!datum[3] && iso < heute.iso) { jahr += 1; iso = `${jahr}-${String(mo).padStart(2, "0")}-${String(tg).padStart(2, "0")}`; }
      tag = iso; tagWort = datum[0];
    }
  } else {
    for (let i = 0; i < 7 && !tag; i++) {
      const re = new RegExp(`\\b(?:${WT_DE[i]}|${WT_EN[i]})\\b`);
      if (re.test(t)) {
        // Der nächste solche Tag NACH heute (am selben Wochentag gemeint ist meist die nächste Woche).
        let d = 1;
        while (d <= 7 && berlinZeit(new Date(jetzt.getTime() + d * 86_400_000)).tag !== i) d++;
        tag = berlinZeit(new Date(jetzt.getTime() + d * 86_400_000)).iso; tagWort = WT_DE[i];
      }
    }
  }
  if (!tag) return null;
  let stunde: number | null = null, minute = 0;
  const hhmm = /\b(\d{1,2})[:.](\d{2})\s*(?:uhr|h\b)?/.exec(t.replace(/\b\d{1,2}\.\d{1,2}\.(?:\d{2,4})?/, " "));
  const uhr = /\b(?:um|ab|gegen|at|from)?\s*(\d{1,2})\s*(?:uhr|h\b|(am|pm)\b)/.exec(t);
  const um = /\b(?:um|gegen|at)\s+(\d{1,2})\b(?![.:]\d)/.exec(t);
  if (hhmm) { stunde = Number(hhmm[1]); minute = Number(hhmm[2]); }
  else if (uhr) { stunde = Number(uhr[1]); if (uhr[2] === "pm" && stunde < 12) stunde += 12; }
  else if (um) stunde = Number(um[1]);
  if (stunde == null || !Number.isFinite(stunde) || minute > 59) return null;
  if (/\b(\d{1,2})\s*pm\b/.test(t) && stunde < 12) stunde += 12;
  if (stunde < 7 || stunde > 20) return null;
  if (tag === heute.iso && stunde * 60 + minute <= heute.stunde * 60 + heute.minute) return null;
  const zeit = `${String(stunde).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return { tag, zeit, text: `${tagWort} ${zeit}`.trim() };
}

// ═══════════════════════════════════════════════════════════════════════════
// STOPP, BUDGET, SENDEFENSTER — die Regeln als Tabelle
// ═══════════════════════════════════════════════════════════════════════════
export type LeadStoppGrund =
  | "privat" | "kunde" | "abgemeldet" | "unzustellbar" | "termin" | "antwort" | "von_hand" | "ergebnis" | "kein_interesse"
  | "info_mail" | "angebot"
  // Nachbesserung E-476 (Gutachten Lead-Sicht, Mangel 8/9): Rückruf-Bitte über die Seite, neuere Anfrage derselben Adresse,
  // die Gespräche führt gerade nicht Justin (W/N sprechen in seiner Stimme von „Termin mit mir“).
  | "rueckruf" | "neuere_anfrage" | "gespraechsperson";

export interface LeadStoppLage {
  /** Privat-Weiche: Beschwerde/Privatkunde über das Global-Formular. */
  privat: boolean;
  /** Global-Bestellung, Global-Kunde oder eine bezahlte Bestellung nach dem Eingang. */
  kunde: boolean;
  /** „keine Mails“ oder eine Werbesperre an der Adresse. */
  abgemeldet: boolean;
  /** Rückläufer an js@. */
  unzustellbar: boolean;
  /** Irgendein Lead-Gespräch/Global-Termin zu dieser Anfrage oder Adresse — egal welcher Stand (auch „verpasst“). */
  termin: boolean;
  /** Er hat geantwortet (js@ oder welcome@). */
  antwort: boolean;
  /** Ein Mensch hat im Faden selbst geschrieben. */
  vonHand: boolean;
  /** Das letzte Anruf-Ergebnis im Cockpit NACH dem Eingang. */
  anrufErgebnis: string | null;
  /** Stand der Firma im Cockpit. */
  firmaStatus: string | null;
  /** Die Info-Mail ging nach dem Willkommen hinaus. */
  infoMail: boolean;
  /** Ein offenes Global-Angebot oder Mandat (Gutachten 1, Mangel 15). */
  angebot: boolean;
  /** Nachbesserung (Gutachten Lead-Sicht, Mangel 8): Dieselbe Adresse hat danach noch einmal angefragt. */
  neuere?: boolean;
}

/** Erreicht oder erledigt — dann übernimmt der Mensch (Gutachten 0, Mangel 6; Plan 4.3). */
export const STOPP_ANRUF = ["erreicht_interesse", "erreicht_termin", "erreicht_antrag", "erreicht_kein_interesse", "nummer_falsch"] as const;
export const STOPP_FIRMA = ["kein_interesse", "ungueltig", "kunde", "antrag"] as const;

/** Warum keine Lead-Mail (mehr) kommt — die erste zutreffende Regel. null = es darf weitergehen. Rein. */
export function leadStoppGrund(l: LeadStoppLage): LeadStoppGrund | null {
  if (l.privat) return "privat";
  if (l.kunde) return "kunde";
  if (l.abgemeldet) return "abgemeldet";
  if (l.unzustellbar) return "unzustellbar";
  if (l.termin) return "termin";
  if (l.antwort) return "antwort";
  if (l.vonHand) return "von_hand";
  if (l.anrufErgebnis && (STOPP_ANRUF as readonly string[]).includes(l.anrufErgebnis)) return "ergebnis";
  if (l.firmaStatus && (STOPP_FIRMA as readonly string[]).includes(l.firmaStatus)) return "kein_interesse";
  if (l.infoMail) return "info_mail";
  if (l.angebot) return "angebot";
  if (l.neuere) return "neuere_anfrage";
  return null;
}

export const STOPP_TEXT: Readonly<Record<LeadStoppGrund, string>> = {
  privat: "Privat-Weg (Beschwerde oder Privatkunde) — keine Business-Mails",
  kunde: "ist Kunde geworden",
  abgemeldet: "will keine Mails mehr",
  unzustellbar: "Mail kam unzustellbar zurück",
  termin: "hat ein Gespräch (Termin)",
  antwort: "hat geantwortet",
  von_hand: "Justin schreibt selbst im Faden",
  ergebnis: "Anruf im Cockpit eingetragen (erreicht oder Nummer falsch)",
  kein_interesse: "Firma im Cockpit erledigt (kein Interesse, ungültig, Kunde)",
  info_mail: "Info-Mail nach dem Anruf ging hinaus",
  angebot: "hat ein offenes Global-Angebot",
  rueckruf: "bittet über die Seite um einen Rückruf",
  neuere_anfrage: "hat noch einmal angefragt (die neuere Anfrage gilt)",
  gespraechsperson: "die Gespräche führt gerade nicht Justin",
};

/** Das Mail-Budget je Lead — an EINER Stelle (Gutachten 1, Mangel 9). Rein. */
export function leadMailBudget(ein: { letzte24h: number; gesamt: number; tagMax?: number; gesamtMax?: number }): { ok: boolean; grund: string | null } {
  const tag = ein.tagMax ?? LEAD_POST_VORGABE.budgetTag;
  const gesamt = ein.gesamtMax ?? LEAD_POST_VORGABE.budgetGesamt;
  if (ein.letzte24h >= tag) return { ok: false, grund: `heute schon ${ein.letzte24h} Lead-Mail${ein.letzte24h === 1 ? "" : "s"} (höchstens ${tag} am Tag)` };
  if (ein.gesamt >= gesamt) return { ok: false, grund: `schon ${ein.gesamt} Lead-Mails (höchstens ${gesamt} bis zum Gespräch)` };
  return { ok: true, grund: null };
}

/** Ist das ein Werktag (Mo–Fr, kein Feiertag)? `feiertag` prüft den Berliner Kalendertag. Rein. */
export function istWerktag(iso: string, feiertag: (iso: string) => boolean): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  const wt = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
  return wt >= 1 && wt <= 5 && !feiertag(iso);
}

/** Der n-te Werktag NACH einem Tag (Wochenenden und Feiertage zählen nicht). Rein. */
export function werktagPlus(iso: string, n: number, feiertag: (iso: string) => boolean): string {
  let t = iso;
  let rest = Math.max(0, Math.floor(n));
  while (rest > 0) { t = isoPlus(t, 1); if (istWerktag(t, feiertag)) rest--; }
  return t;
}

/** Liegt `jetzt` im Sendefenster der Nachfass-Mails (Mo–Fr 9–18 Uhr Berlin, kein Feiertag)? Rein. */
export function imSendefenster(jetzt: Date, feiertag: (iso: string) => boolean): boolean {
  const z = berlinZeit(jetzt);
  return istWerktag(z.iso, feiertag) && z.stunde >= LEAD_POST_VORGABE.fensterVon && z.stunde < LEAD_POST_VORGABE.fensterBis;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE PRIVATKUNDEN-WEICHE (Gutachten 1, Mangel 1 + 6) — nach dem ANLIEGEN, nicht nach dem Zahlstatus
// ═══════════════════════════════════════════════════════════════════════════
export type PrivatWeg = "global" | "bestandskunde" | "privat" | "beschwerde";

/**
 * beschwerde = die Nachricht klingt nach Beschwerde (zwei starke Signale, oder eins plus Privat-Bestand/zahlend/keine
 * Firma — dieselbe Regel wie der Dossier-Hinweis) → Privat-Weg, Auftrag an die Leitung, kein Business-Willkommen, nicht zu
 * Daniel. privat = Privat-Bestand OHNE Global-Interesse (keine Formular-Antworten, kein Paket, keine Firma) → Auftrag an den
 * Betreuer. bestandskunde = Privat-Bestand MIT Global-Interesse → bleibt Global-Lead, eigene Willkommens-Fassung. Rein.
 */
export function privatWeiche(ein: { nachricht: string | null; privatBestand: boolean; zahlend: boolean; firmaBrauchbar: boolean; globalInteresse: boolean }): { weg: PrivatWeg; signale: string[] } {
  const s = privatOderBeschwerde(ein.nachricht ?? "");
  const u = privatUrteil(s, { privatBestand: ein.privatBestand, zahlend: ein.zahlend, firmaBrauchbar: ein.firmaBrauchbar });
  const signale = [...s.beschwerde, ...s.privat].slice(0, 6);
  if (u.art === "beschwerde") return { weg: "beschwerde", signale };
  if (ein.privatBestand && !ein.globalInteresse && !ein.firmaBrauchbar) return { weg: "privat", signale };
  if (ein.privatBestand) return { weg: "bestandskunde", signale };
  return { weg: "global", signale };
}

// Die Danke-Seite ist für ALLE gleich (Gutachten 1, Mangel 6) — der Satz steht in shared/fiaon-global-termin-texte.ts
// (GLOBAL_TEXTE.anfrageDanke): „Danke — Ihre Anfrage ist angekommen. Wir melden uns persönlich bei Ihnen.“

// ═══════════════════════════════════════════════════════════════════════════
// DIE MATRIX „MAIL – AUSLÖSER – ABSENDER – STOPP“ (Gutachten 0, Mangel 6) — der Prüfstand hält den Code daran
// ═══════════════════════════════════════════════════════════════════════════
export interface LeadMailZeile { mail: string; ausloeser: string; absender: string; antwortAn: string; stopp: string }
export const LEAD_MAIL_MATRIX: readonly LeadMailZeile[] = [
  { mail: "W Willkommen", ausloeser: "Eingang + 10 Minuten Ruhe, rund um die Uhr (Zählbeginn, Schalter)", absender: "js@ — Justin, echte Unterschrift", antwortAn: "js@", stopp: "jeder Stopp-Grund, Handmail in 14 Tagen, zweiter Eingang derselben Adresse" },
  { mail: "N1 Nachfass", ausloeser: "+1 Werktag, Mo–Fr 9–18 Uhr, im selben Faden", absender: "js@ — Justin", antwortAn: "js@", stopp: "jeder Stopp-Grund, Budget (1 je Tag, 5 gesamt)" },
  { mail: "N2 Nachfass", ausloeser: "+3 Werktage, Mo–Fr 9–18 Uhr, im selben Faden", absender: "js@ — Justin", antwortAn: "js@", stopp: "jeder Stopp-Grund, Budget" },
  { mail: "N3 letzte Mail", ausloeser: "+7 Werktage, Mo–Fr 9–18 Uhr, im selben Faden", absender: "js@ — Justin", antwortAn: "js@", stopp: "jeder Stopp-Grund, Budget" },
  { mail: "Bestätigung global_termin", ausloeser: "Buchung (Link, Kalender, Cockpit, /justin-Weiche)", absender: "FIAON Global <welcome@>", antwortAn: "js@", stopp: "— (Pflicht zur Buchung)" },
  { mail: "Vortag global_termin_erinnerung", ausloeser: "24 Stunden vorher (nicht bei kurzfristiger Buchung)", absender: "FIAON Global <welcome@>", antwortAn: "js@", stopp: "Termin verschoben/abgesagt" },
  { mail: "1 Std. vorher global_termin_kurz", ausloeser: "60 Minuten vorher", absender: "FIAON Global <welcome@>", antwortAn: "js@", stopp: "Termin verschoben/abgesagt" },
  { mail: "nicht erreicht global_nicht_erreicht", ausloeser: "ein Mensch trägt „nicht erreicht“ ein — einmal je Gespräch", absender: "FIAON Global <welcome@>", antwortAn: "js@", stopp: "— (danach kein N1: der Termin stoppt den Nachfass)" },
  { mail: "Absage global_termin_absage", ausloeser: "wir sagen ein Lead-Gespräch ab (Kalender, Chefbüro)", absender: "FIAON Global <welcome@>", antwortAn: "js@", stopp: "— (Pflicht zur Absage)" },
  { mail: "Info-Mail nach dem Anruf", ausloeser: "Knopf im Firmen-Cockpit", absender: "FIAON Global <welcome@>", antwortAn: "js@ (Business-Lead), sonst die Firmenadresse der sendenden Person", stopp: "nie bei Termin; Global-Lead nach „nicht erreicht“: N1 übernimmt; stoppt selbst den Nachfass" },
];
