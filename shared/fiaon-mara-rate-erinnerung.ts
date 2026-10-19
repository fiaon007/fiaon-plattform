// ═══════════════════════════════════════════════════════════════════════════
// MARA-INKASSO, ERSTE STUFE — FRISCH FÄLLIGE RATEN, PERSÖNLICH UND FREUNDLICH (19.10.2026, E-406 B1)
//
// Justin (19.10.2026, Vorschlag 3 „Mara führt den Betrieb“): „los, starte Etappe A und alle anderen gleichzeitig,
// damit alles fertig wird … mach einfach mal“. Aus der Endfassung: „Frisch zuerst … Mara erinnert freundlich und
// bietet einen Termin an … höchstens 3 Kontakte je Rate.“
//
// ── DIE KARTE (gemessen 19.10.2026, Produktion nur lesend, Raten fällig 20.09.–15.10.) ──────────────────
// Was eine fällige Rate HEUTE schon bekommt — und was davon unverändert bleibt (E-182 „Bremse aus“):
//   · Tag −3  Vorabinfo des Abo-Motors (abo_payment_reminder, vorabErinnern)            161 Mails
//   · Tag 0   „Heute ist Ihre Monatsrate fällig“ (abo_payment_reminder, Mahnstufe 1)       160 Mails
//   · Tag 1–3 WhatsApp-Zentrale „Monatsrate fällig“ (fiaon_kkb_rate, Automatik 07:40–20:45) 45 Nachrichten
//   · Tag 3, 7, 14, 21, dann alle 3 Tage: Mahnmotor E-368 (RATE_MAHNBAR_SQL)               148 Mails an Tag 3
//   · Inkasso von Hand (Liste ab Tag 1, Knopf „Erinnerung“), Anrufe der Betreuer (E-165)    an 25 von 143 Raten
//   · Rückholsystem E-078 und Mara-Aktion: nur Erstzahlungen (Stufe A/B) — Raten nie.
// An Tag 1 und 2 kommt per Mail NICHTS (5 und 2 Mails). Genau dort ist die Lücke.
//
// Wer zahlt wann (Raten fällig 01.08.–18.10., Rate 2 und später, ohne Test/Storno):
//   bis Tag 0: 10,1 % · bis Tag 1: 11,2 % · bis Tag 3: 13,6 % · bis Tag 7: 17,5 % · bis Tag 30: 27,3 %.
//   Von denen, die nach Tag 0 noch offen sind: bis Tag 3 nur 4,1 %, bis Tag 7 8,7 %, bis Tag 30 20,2 %.
//   E-165 (08.09.2026) maß „frisch fällig ~19 %, 60 Tage alt fast nie“; E-078 „ein gebuchter Termin wirkt 6-mal besser“.
//
// ── DIE REGEL ───────────────────────────────────────────────────────────────
// Eine Rate ist seit 1–3 Tagen fällig und offen. Dann schickt Mara EINE persönliche, freundliche Mail — kein Druck,
// drei einfache Wege: (1) jetzt zahlen über die Zahlungsseite der Rate, (2) kurz antworten, wann er zahlt (die Antwort
// landet bei Mail-Mara im Postfach — die bestehenden Werkzeuge greifen), (3) einen kurzen Rückruf wählen (persönlicher
// Terminlink, Herkunft mara_rate_mail). Nur, wenn ALLES stimmt:
//   · die Forderung ist aktiv (FORDERUNG_AKTIV_SQL_FUER: nie nach dem Vertragsende, keine ungebuchte Kündigung,
//     kein Mahnstopp, keine Testperson) — und dazu: keine gebuchte Kündigung, kein Widerruf/Bestreiten/Anwalt,
//     kein Global-Kunde, keine Vertriebssperre, nicht eskaliert, keine offene Entscheidungskarte bei Justin;
//   · Ratenpause: die verschobene Rate ist nicht mehr fällig — fällt von selbst heraus;
//   · keine offene Zahlungszusage, keine Zahlungsmeldung, kein passender unverbuchter Eingang, kein Termin;
//   · höchstens HOECHSTENS_KONTAKTE (3) Kontakte je Rate über ALLE Wege (Vorabinfo, Rechnung, Mahnung, WhatsApp-Rate,
//     Anruf) — Maras Mail ist höchstens der dritte. Die Frequenzbremse des Hauses ist seit E-182 aus; diese Grenze
//     gilt nur für Maras eigene Mail, nie für Abo-Motor, Mahnmotor oder WhatsApp-Zentrale;
//   · nichts am selben Tag doppelt: Ging heute schon eine Rechnung, Mahnung oder WhatsApp-Rate raus — oder kommt
//     heute die Mahnung des Abo-Motors —, wartet Mara bis zum nächsten Tag;
//   · nur 10:00–18:00 Uhr Berlin (im Hausfenster 08–20, nach den Morgen-Takten von Abo-Motor und WhatsApp-Zentrale);
//   · nie doppelt: ein Merker je Rate (fiaon_mara_rate_erinnerung, PRIMARY KEY rate_id);
//   · in der KI-Pause wartet sie (Antworten gingen an Mail-Mara, die dann ruht);
//   · Werbesperre: Die Mail ist Zahlungspost ohne Verkauf (kein Kartenblock, kein Paket) — sie geht trotzdem.
// Kanal: nur Mail. WhatsApp NICHT: Die einzige freigegebene Raten-Vorlage (fiaon_kk_rate) gehört der WhatsApp-Zentrale,
// die sie an Tag 1–3 schon schickt; eine Vorlage mit den drei Wegen gibt es nicht; die Meta-Qualität steht auf ROT.
// Schreibt der Kunde gerade selbst (WhatsApp oder Mail in den letzten 24 h), ist Mara dort schon im Gespräch — die
// Mail wartet, bis es 24 h ruhig ist.
//
// Hier steht nur die REGEL — rein, ohne Datenbank, im Prüfstand geprüft (scripts/pruef-mara-rate-erinnerung.ts).
// Vormerken, Fakten und Senden tut der Server (server/lib/fiaon-mara-rate-erinnerung.ts), nie ein Modell.
// ═══════════════════════════════════════════════════════════════════════════
import { kuendigungSendeUrteil, wandPruefen } from "./fiaon-wortverbote";
import { BANK } from "./fiaon-bank";

/** Das Mail-Ereignis (Quelltext-Vorlage im Mailwerk, server/mail/vorlagen/zahlung.ts). */
export const RATE_ERINNERUNG_EVENT = "mara_rate_erinnerung";
/** Der Schalter im Mara-Steuerpult (fiaon_settings). Fehlt er, ist die Automatik AN. */
export const RATE_ERINNERUNG_SCHALTER = "mara_rate_erinnerung";
/** Herkunft des Terminlinks (`?von=`) — so sieht man im Kalender, welche Buchung diese Mail gebracht hat. */
export const RATE_ERINNERUNG_HERKUNFT = "mara_rate_mail";
/** Frisch heißt: seit so vielen Tagen fällig (Berliner Kalendertage, Tag 0 = Fälligkeitstag). */
export const TAGE_AB = 1;
export const TAGE_BIS = 3;
/** Höchstens so viele Kontakte je Rate über alle Wege — Maras Mail eingeschlossen. */
export const HOECHSTENS_KONTAKTE = 3;
/** Gezählt wird ab so vielen Tagen vor der Fälligkeit (die Vorabinfo kommt 3 Tage vorher). */
export const KONTAKT_VORLAUF_TAGE = 7;
/** Maras Fenster (Berlin, Minuten seit Mitternacht): 10:00 bis vor 18:00 — innerhalb des Hausfensters 08–20. */
export const FENSTER_AB_MIN = 10 * 60;
export const FENSTER_BIS_MIN = 18 * 60;
/** Schreibt der Kunde gerade selbst, wartet Mara so viele Stunden Ruhe ab. */
export const GESPRAECH_RUHE_STUNDEN = 24;
/** In der KI-Pause schaut Mara nach so vielen Minuten wieder nach. */
export const KI_PAUSE_WARTEN_MIN = 30;

/** Schalterwert lesen: fehlt er oder ist er leer, ist die Automatik an. „aus“, „0“, „nein“, „false“ schalten ab. */
export function schalterAn(wert: unknown): boolean {
  const w = String(wert ?? "").trim().toLowerCase();
  return !["aus", "0", "nein", "false", "off"].includes(w);
}

// ── ZEIT (Berlin, nur formatToParts — Zeit-Falle 01.09.2026; Muster aus shared/fiaon-nicht-erreicht-nachfass.ts) ──
function berlinTeile(d: Date): { j: number; m: number; t: number; h: number; min: number } {
  const teile = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(d);
  const v = (typ: string) => Number(teile.find((p) => p.type === typ)?.value ?? "0");
  return { j: v("year"), m: v("month"), t: v("day"), h: v("hour") === 24 ? 0 : v("hour"), min: v("minute") };
}

/** Ein Berliner Wandzeitpunkt (Jahr, Monat, Tag, Minuten) als absoluter Zeitpunkt — sommer- und winterzeitfest. */
function berlinWandZuDatum(j: number, m: number, t: number, minuten: number): Date {
  const ziel = Date.UTC(j, m - 1, t, Math.floor(minuten / 60), minuten % 60);
  let guess = ziel - 60 * 60_000;
  for (let i = 0; i < 3; i++) {
    const b = berlinTeile(new Date(guess));
    const ist = Date.UTC(b.j, b.m - 1, b.t, b.h, b.min);
    guess += ziel - ist;
  }
  return new Date(guess);
}

/** Der Berliner Kalendertag als JJJJ-MM-TT. */
export function berlinTag(d: Date = new Date()): string {
  const b = berlinTeile(d);
  return `${b.j}-${String(b.m).padStart(2, "0")}-${String(b.t).padStart(2, "0")}`;
}

/** Ganze Kalendertage zwischen zwei JJJJ-MM-TT (b − a). */
export function tageZwischen(a: string, b: string): number {
  const [ja, ma, ta] = a.split("-").map(Number);
  const [jb, mb, tb] = b.split("-").map(Number);
  return Math.round((Date.UTC(jb, mb - 1, tb) - Date.UTC(ja, ma - 1, ta)) / 86_400_000);
}

/** Minuten seit Mitternacht in Berlin. */
export function berlinMinuten(d: Date = new Date()): number {
  const b = berlinTeile(d);
  return b.h * 60 + b.min;
}

/** Liegt der Zeitpunkt in Maras Fenster 10:00–18:00 (Berlin)? */
export function imFenster(d: Date = new Date()): boolean {
  const m = berlinMinuten(d);
  return m >= FENSTER_AB_MIN && m < FENSTER_BIS_MIN;
}

/** Der Fensterbeginn (10:00 Berlin) an einem Berliner Tag JJJJ-MM-TT. */
export function fensterBeginnAm(tag: string): Date {
  const [j, m, t] = tag.split("-").map(Number);
  return berlinWandZuDatum(j, m, t, FENSTER_AB_MIN);
}

/** Der Berliner Tag nach `tag` (JJJJ-MM-TT). */
export function tagDanach(tag: string, n = 1): string {
  const [j, m, t] = tag.split("-").map(Number);
  const d = new Date(Date.UTC(j, m - 1, t + n));
  return d.toISOString().slice(0, 10);
}

/** Der nächste Zeitpunkt in Maras Fenster: jetzt (wenn offen), sonst heute bzw. morgen 10:00 Berlin. */
export function naechstesFenster(d: Date = new Date()): Date {
  if (imFenster(d)) return d;
  const heute = berlinTag(d);
  return berlinMinuten(d) < FENSTER_AB_MIN ? fensterBeginnAm(heute) : fensterBeginnAm(tagDanach(heute));
}

// ── DIE FAKTEN UND DAS URTEIL ──────────────────────────────────────────────
/** Was der Server über diese Rate und diesen Menschen weiß — vollständig, damit die Regel nichts erraten muss. */
export interface RateErinnerungFakten {
  /** Die Rate gibt es, sie ist offen, nicht storniert und nicht bezahlt. */
  rateOffen: boolean;
  /** Fälligkeit der Rate (JJJJ-MM-TT, Berliner Tag). Eine Ratenpause verschiebt sie in die Zukunft. */
  faelligAm: string;
  /** Die Bestellung trägt eine Forderung: bezahlt, nicht storniert/archiviert/zusammengeführt, Abo nicht gestoppt, kein Einmalkauf. */
  bestellungAktiv: boolean;
  /** Die Rate liegt nach dem Vertragsende eines gekündigten Altvertrags (RATE_NACH_ENDE_SQL_FUER, E-394). */
  nachVertragsende: boolean;
  /** Ein eingegangener, nie gebuchter Kündigungsantrag (KUENDIGUNG_UNGEBUCHT_SQL, E-368). */
  kuendigungUngebucht: boolean;
  /** Die Kündigung dieser Bestellung ist gebucht (und nicht zurückgenommen). */
  kuendigungGebucht: boolean;
  /** Widerruf, Bestreiten, Anwalt oder Rechtliches in den letzten 90 Tagen (Postfach-Lampen, heikle WhatsApp-Fälle). */
  widerrufOderRecht: boolean;
  /** Mahnstopp nach der ersten Zahlung (dieselbe Lesart wie RATE_MAHNBAR_SQL). */
  mahnstopp: boolean;
  /** Testperson (fiaon_persons.ist_test_am — auch an der Familie). */
  testperson: boolean;
  /** Kunde von FIAON Global (fiaon-global-kunde.ts). */
  globalKunde: boolean;
  /** Vertriebssperre (is_blocked): „kein Kontakt, kein Termin“ — kein Rückrufangebot. */
  vertriebssperre: boolean;
  /** Die Rate liegt als Härtefall bei der Leitung (eskaliert_am). */
  eskaliert: boolean;
  /** Zu diesem Menschen liegt eine offene Entscheidungskarte bei Justin (fiaon_mara_entscheidungen). */
  karteOffen: boolean;
  /** „Kann nicht zahlen“ oder eine Beschwerde in den letzten 30 Tagen. */
  einwand: boolean;
  /** „Habe bezahlt“ in den letzten 14 Tagen (Postfach) oder ein Beleg im Inkasso. */
  zahlungGemeldet: boolean;
  /** Ein passender, noch nicht verbuchter Eingang im Bankbuch (Referenz oder Name, 30 Tage). */
  eingangPasst: boolean;
  /** Eine Zahlungszusage für heute oder später (Rate oder Person). */
  zusageOffen: boolean;
  /** Ein gebuchter Termin oder vereinbarter Rückruf in der Zukunft. */
  terminSteht: boolean;
  /** Eine zustellbare E-Mail-Adresse. */
  hatEmail: boolean;
  /** Kontakte zu DIESER Rate über alle Wege seit KONTAKT_VORLAUF_TAGE vor der Fälligkeit (ohne Maras eigene). */
  kontakte: number;
  /** Die jüngste eingehende Nachricht des Kunden (WhatsApp, Mail ans Postfach oder Anliegen im Kundenbereich). */
  letzteKundenNachrichtAm: string | Date | null;
  /** Ging heute (Berlin) schon eine Rechnung, Mahnung oder WhatsApp-Rate an ihn raus? */
  heuteRatenpost: boolean;
  /** Ist der Abo-Motor heute mit einer Mahnung zu dieser Rate dran (Mahnstufen-Abstand erreicht, noch nicht gesendet)? */
  motorHeuteDran: boolean;
  /** KI-Pause: Mail-Mara antwortet gerade nicht. */
  kiPause: boolean;
}

export type RateErinnerungUrteil =
  | { art: "senden" }
  | { art: "warten"; nichtVor: Date; grund: string }
  | { art: "auslassen"; grund: string }
  | { art: "erledigt"; grund: string }
  | { art: "verfallen"; grund: string };

export const GRUND = {
  nichtOffen: "Rate bezahlt oder nicht mehr offen",
  nichtFaellig: "nicht mehr fällig (Ratenpause oder verschoben)",
  zuAlt: "mehr als 3 Tage fällig — die erste Stufe ist vorbei",
  bestellung: "Bestellung trägt keine Forderung mehr (storniert, archiviert oder Abo gestoppt)",
  vertragsende: "nach dem Vertragsende fällig — nicht geschuldet",
  kuendigungUngebucht: "Kündigung eingegangen (noch nicht gebucht)",
  kuendigungGebucht: "Kündigung gebucht",
  widerruf: "Widerruf, Bestreiten oder Anwalt in Bearbeitung",
  mahnstopp: "Mahnstopp",
  test: "Testkonto",
  global: "Kunde von FIAON Global",
  vertriebssperre: "Vertriebssperre — kein Rückrufangebot",
  eskaliert: "Härtefall bei der Leitung",
  karte: "eine Entscheidung zu diesem Kunden liegt bei Justin",
  einwand: "„kann nicht zahlen“ oder Beschwerde — kein Zahlungsdruck",
  gemeldet: "Zahlung gemeldet — die Zahlungsstelle prüft",
  eingang: "passender Eingang im Bankbuch — wird zugeordnet",
  zusage: "Zahlungszusage steht",
  termin: "Termin oder Rückruf steht schon",
  keineMail: "keine E-Mail-Adresse hinterlegt",
  kontakte: `schon ${HOECHSTENS_KONTAKTE} Kontakte zu dieser Rate`,
  gespraech: "Kunde schreibt gerade selbst — Mara wartet 24 Stunden Ruhe ab",
  kiPause: "KI-Pause — Antworten blieben liegen, Mara wartet",
  heutePost: "heute ging schon eine Rechnung oder Mahnung raus — Mara schreibt morgen",
  motor: "heute kommt die Mahnung des Abo-Motors — Mara schreibt morgen",
  fenster: "außerhalb 10–18 Uhr — geht ab 10 Uhr raus",
} as const;

/**
 * Die eine Regel: Was tut Mara jetzt mit dieser Rate? Rein — dieselbe Prüfung beim Vormerken und beim Senden,
 * damit sich zwischendurch Geändertes (bezahlt, Ratenpause, Kündigung, Zusage) durchsetzt.
 * Reihenfolge: erst was die Sache erledigt, dann was sie für immer ausschließt, dann was sie aufschiebt.
 */
export function rateErinnerungUrteil(f: RateErinnerungFakten, jetzt: Date = new Date()): RateErinnerungUrteil {
  if (!f.rateOffen) return { art: "erledigt", grund: GRUND.nichtOffen };
  const heute = berlinTag(jetzt);
  const tage = tageZwischen(String(f.faelligAm).slice(0, 10), heute);
  if (!Number.isFinite(tage) || tage < TAGE_AB) return { art: "erledigt", grund: GRUND.nichtFaellig };
  if (tage > TAGE_BIS) return { art: "verfallen", grund: GRUND.zuAlt };

  // ── Was für immer ausschließt (dieselben Wände wie Mahnmotor und Inkasso, dazu Maras eigene) ──
  if (!f.bestellungAktiv) return { art: "auslassen", grund: GRUND.bestellung };
  if (f.nachVertragsende) return { art: "auslassen", grund: GRUND.vertragsende };
  if (f.kuendigungUngebucht) return { art: "auslassen", grund: GRUND.kuendigungUngebucht };
  if (f.kuendigungGebucht) return { art: "auslassen", grund: GRUND.kuendigungGebucht };
  if (f.widerrufOderRecht) return { art: "auslassen", grund: GRUND.widerruf };
  if (f.mahnstopp) return { art: "auslassen", grund: GRUND.mahnstopp };
  if (f.testperson) return { art: "auslassen", grund: GRUND.test };
  if (f.globalKunde) return { art: "auslassen", grund: GRUND.global };
  if (f.vertriebssperre) return { art: "auslassen", grund: GRUND.vertriebssperre };
  if (f.eskaliert) return { art: "auslassen", grund: GRUND.eskaliert };
  if (f.karteOffen) return { art: "auslassen", grund: GRUND.karte };
  if (f.einwand) return { art: "auslassen", grund: GRUND.einwand };

  // ── Was die Sache schon erledigt (das Geld kommt oder ein Gespräch steht) ──
  if (f.zahlungGemeldet) return { art: "erledigt", grund: GRUND.gemeldet };
  if (f.eingangPasst) return { art: "erledigt", grund: GRUND.eingang };
  if (f.zusageOffen) return { art: "erledigt", grund: GRUND.zusage };
  if (f.terminSteht) return { art: "erledigt", grund: GRUND.termin };

  if (!f.hatEmail) return { art: "auslassen", grund: GRUND.keineMail };
  if (Number(f.kontakte || 0) >= HOECHSTENS_KONTAKTE) return { art: "auslassen", grund: GRUND.kontakte };

  // ── Was aufschiebt — fällt der neue Zeitpunkt hinter Tag 3, ist die erste Stufe vorbei ──
  const aufschieben = (nichtVor: Date, grund: string): RateErinnerungUrteil =>
    tageZwischen(String(f.faelligAm).slice(0, 10), berlinTag(nichtVor)) > TAGE_BIS
      ? { art: "verfallen", grund: `${grund} · danach ist die erste Stufe vorbei` }
      : { art: "warten", nichtVor, grund };

  const kunde = f.letzteKundenNachrichtAm ? new Date(f.letzteKundenNachrichtAm).getTime() : NaN;
  if (Number.isFinite(kunde) && jetzt.getTime() - kunde < GESPRAECH_RUHE_STUNDEN * 3_600_000) {
    return aufschieben(naechstesFenster(new Date(kunde + GESPRAECH_RUHE_STUNDEN * 3_600_000)), GRUND.gespraech);
  }
  if (f.heuteRatenpost) return aufschieben(fensterBeginnAm(tagDanach(heute)), GRUND.heutePost);
  if (f.motorHeuteDran) return aufschieben(fensterBeginnAm(tagDanach(heute)), GRUND.motor);
  if (f.kiPause) return aufschieben(naechstesFenster(new Date(jetzt.getTime() + KI_PAUSE_WARTEN_MIN * 60_000)), GRUND.kiPause);
  if (!imFenster(jetzt)) return aufschieben(naechstesFenster(jetzt), GRUND.fenster);
  return { art: "senden" };
}

// ── DER TEXT: kein Druck, kein Verkauf, nie eine Drohung (E-393) ──────────
/**
 * Wörter, die in Maras Raten-Mail nie stehen dürfen: Mahn- und Drohwörter (E-393, „kein Druck“), Verkauf
 * (Werbesperre: Service ja, Verkauf nein — die Mail geht an jeden gleich), „Letzte Erinnerung“ (E-368).
 */
export const VERBOTEN_IM_TEXT: { muster: RegExp; warum: string }[] = [
  { muster: /\bletzte\s+erinnerung\b/i, warum: "„Letzte Erinnerung“ (E-368)" },
  { muster: /\bmahn\w*/i, warum: "Mahnwort — kein Druck" },
  { muster: /\binkasso\w*/i, warum: "Inkasso — kein Druck" },
  { muster: /\b(gericht\w*|anwalt\w*|rechtlich\w*|schufa|pfändung|vollstreck\w*)/i, warum: "Drohung (E-393)" },
  { muster: /\b(gebühr\w*|säumnis\w*|verzugs\w*|zinsen)\b/i, warum: "Kosten — kein Druck" },
  { muster: /\b(sperr\w*|deaktivier\w*|gekündigt|kündig\w*)/i, warum: "Sperre oder Kündigung — nie in der Erinnerung" },
  { muster: /\b(kreditkarte\w*|limit\w*|upgrade|paket\w*|angebot\w*|partnerbank)\b/i, warum: "Verkauf — die Mail ist Zahlungspost (Werbesperre)" },
  { muster: /\b(frist\w*|umgehend|sofort|unverzüglich)\b/i, warum: "Frist oder Eile — kein Druck" },
];

/**
 * Prüft den fertigen Kundentext: E-393-Sendesperre (Kopplung, Drohung), die Wortwand des Hauses (ihre VERBOTE),
 * Maras eigene Liste oben und die KI-Offenlegung („digitale Assistentin“, KI-VO Art. 50). Leere Liste = sendbar. Rein.
 *
 * Zwei Anpassungen an die Wortwand, die für frei geschriebene KI-Antworten gebaut ist:
 *   · Die Bankverbindung DES HAUSES (shared/fiaon-bank.ts) im Datenkasten ist erlaubt — wie in jeder Zahlungsmail des
 *     Mailwerks. Jede ANDERE IBAN bleibt verboten (z. B. die gesperrte alte Verbindung).
 *   · „Zusage“-Treffer („wir rufen Sie an“) zählen nicht: Das ist hier keine Behauptung eines Modells, sondern das
 *     Angebot, über den eigenen Terminlink eine Zeit zu WÄHLEN — der Anruf steht erst mit der Buchung im Kalender.
 */
export function textPruefen(text: string): string[] {
  const t = String(text || "");
  const fehler: string[] = [];
  const e393 = kuendigungSendeUrteil({ antwort: t });
  if (e393.gesperrt) fehler.push(e393.grund);
  const ohneHausbank = t.split(BANK.ibanDisplay).join("[IBAN]").split(BANK.iban).join("[IBAN]");
  const verbote = wandPruefen(ohneHausbank).filter((w) => w.art === "verboten");
  if (verbote.length) fehler.push(`Wortwand: ${verbote.map((w) => `„${w.treffer.trim()}“`).join(", ")}`);
  for (const v of VERBOTEN_IM_TEXT) {
    const m = t.match(v.muster);
    if (m) fehler.push(`${v.warum}: „${m[0]}“`);
  }
  if (!/digitale\s+Assistentin/i.test(t)) fehler.push("Mara muss sich als digitale Assistentin zu erkennen geben (KI-VO Art. 50)");
  return fehler;
}

/** „heute 10:00“ / „morgen 10:00“ / „am 22.10., 10:00“ — für den Stand im Chefbüro. */
export function wannText(ziel: Date, jetzt: Date = new Date()): string {
  const z = berlinTeile(ziel);
  const uhr = `${String(z.h).padStart(2, "0")}:${String(z.min).padStart(2, "0")}`;
  const tage = tageZwischen(berlinTag(jetzt), berlinTag(ziel));
  if (tage <= 0) return `heute ${uhr}`;
  if (tage === 1) return `morgen ${uhr}`;
  return `am ${String(z.t).padStart(2, "0")}.${String(z.m).padStart(2, "0")}., ${uhr}`;
}
