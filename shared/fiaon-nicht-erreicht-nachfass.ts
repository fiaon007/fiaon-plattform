// ═══════════════════════════════════════════════════════════════════════════
// MARA FASST NACH „NICHT ERREICHT“ SELBST NACH — DIE REGEL (19.10.2026, E-401 5/6)
//
// Justin (19.10.2026): „Mach Mara und co fix fertig, damit die wirklich GUT arbeitet und selbst arbeitet.“
//
// ── DER BEFUND ──────────────────────────────────────────────────────────────
// Die „Wir haben Sie nicht erreicht“-Mail kam erst ab dem SECHSTEN erfolglosen Anruf
// (SCHWELLE_MAIL = 6, server/lib/fiaon-nicht-erreicht.ts). Zwischen dem 2. und dem 6. Versuch
// passierte für den Kunden nichts — nur die Wiedervorlage wuchs (+3, +5, +5 Werktage, +7 Tage).
// Gemessen (Produktion, nur lesend, 05.–19.10.2026): 0 bis 14 Menschen am Tag erreichen ihren
// zweiten Fehlversuch, alle zwischen 8 und 20 Uhr.
//
// ── DIE REGEL ───────────────────────────────────────────────────────────────
// Nach dem 2. erfolglosen Anrufversuch (Gesprächsergebnis „Nicht erreicht“ oder „Mailbox“ —
// derselbe Zähler wie die Staffel) schickt Mara EINE kurze Mail mit dem persönlichen Terminlink:
// „Wir haben Sie zweimal nicht erreicht — wann passt es Ihnen? Hier wählen Sie Ihre Zeit.“
//   · nur Vertrieb und Onboarding — nie Forderungsmanagement (Raten), nie Kunden von FIAON Global,
//     nie bei Werbesperre, „Stopp“, Vertriebssperre (is_blocked), Testkonto, Kündigung/Vertragsende;
//   · nicht, wenn schon ein Termin oder ein vereinbarter Rückruf in der Zukunft steht;
//   · nur 08:00–20:00 Uhr (Berlin) — sonst wartet sie bis 8 Uhr;
//   · keine zweite Terminlink-Mail binnen ABSTAND_STUNDEN (Rückholung, Einladung, „verpasst“,
//     die 6.-Versuch-Mail) — dann wartet sie;
//   · nie doppelt: höchstens eine je SPERRE_TAGE (Merker in fiaon_nicht_erreicht_nachfass);
//   · WhatsApp NICHT: Die einzige passende freigegebene Vorlage (fiaon_kk_nicht_erreicht) führt
//     fest auf das allgemeine Terminformular (nicht den persönlichen Link), sagt „ich habe GERADE
//     versucht“ und „es fehlt nur noch Ihr Ja“ (falsch bei bezahlten Kunden) — also nur Mail.
// Die bestehende 6.-Versuch-Mail bleibt (eigener Merker terminlink_mail_am, 30 Tage).
//
// Hier steht nur die REGEL — rein, ohne Datenbank, im Prüfstand geprüft
// (scripts/pruef-mara-nicht-erreicht.ts). Vormerken und Senden tut der Server
// (server/lib/fiaon-mara-nicht-erreicht.ts), nie ein Modell.
// ═══════════════════════════════════════════════════════════════════════════

/** Nach genau diesem erfolglosen Versuch fasst Mara nach. */
export const NACHFASS_NACH_VERSUCH = 2;
/** Das Mail-Ereignis (Quelltext-Vorlage im Mailwerk, server/mail/vorlagen/termin.ts). */
export const NACHFASS_EVENT = "nicht_erreicht_zweimal";
/** Der Schalter im Chefbüro (fiaon_settings). Fehlt er, ist die Automatik AN. */
export const NACHFASS_SCHALTER = "mara_nicht_erreicht_mail";
/** Herkunft des Terminlinks (`?von=`) — so sieht man im Kalender, welche Buchung diese Mail gebracht hat. */
export const NACHFASS_HERKUNFT = "nicht_erreicht_2_mail";
/** Versandfenster (Berliner Zeit, Minuten seit Mitternacht): 08:00 bis vor 20:00. */
export const FENSTER_AB_MIN = 8 * 60;
export const FENSTER_BIS_MIN = 20 * 60;
/** Nie doppelt: höchstens eine solche Mail je Mensch in so vielen Tagen. */
export const SPERRE_TAGE = 30;
/** Keine zweite Terminlink-Mail an denselben Menschen binnen so vieler Stunden. */
export const ABSTAND_STUNDEN = 20;
/** Was so lange wartet (Fenster, Abstand), verfällt — „zweimal nicht erreicht“ drei Tage später wäre schief. */
export const VERFALL_STUNDEN = 48;
/** Ereignisse, die schon einen Terminlink tragen — der Abstand gilt gegen sie (dazu jedes rueckhol_*). */
export const TERMINLINK_EREIGNISSE: readonly string[] = [
  "nicht_erreicht_termin", "termin_verpasst", "onboarding_einladung", "number_update_request", NACHFASS_EVENT,
];
/**
 * E-401 Nachbesserung (Prüfer-Fund): Auch nach diesen Mails wartet Mara den Abstand ab — Mara-Aktion („Zahlen Sie jetzt
 * die Aktivierung“, Status „gesendet“), Lead-Nachfassen und Antrags-Erinnerung. Zwei Mails an einem Tag sind eine zu viel.
 */
export const ABSTAND_AUCH: readonly string[] = ["mara_aktion", "lead_followup", "antrag_erinnerung"];
export function istTerminlinkEreignis(event: string): boolean {
  const e = String(event || "");
  return TERMINLINK_EREIGNISSE.includes(e) || e.startsWith("rueckhol_");
}

/** Schalterwert lesen: fehlt er oder ist er leer, ist die Automatik an. „aus“, „0“, „nein“, „false“ schalten ab. */
export function schalterAn(wert: unknown): boolean {
  const w = String(wert ?? "").trim().toLowerCase();
  return !["aus", "0", "nein", "false", "off"].includes(w);
}

// ── ZEIT (Berlin, nur formatToParts — Zeit-Falle 01.09.2026) ────────────────
function berlinTeile(d: Date): { j: number; m: number; t: number; h: number; min: number } {
  const teile = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(d);
  const v = (typ: string) => Number(teile.find((p) => p.type === typ)?.value ?? "0");
  return { j: v("year"), m: v("month"), t: v("day"), h: v("hour") === 24 ? 0 : v("hour"), min: v("minute") };
}

/** Minuten seit Mitternacht in Berlin. */
export function berlinMinuten(d: Date = new Date()): number {
  const b = berlinTeile(d);
  return b.h * 60 + b.min;
}

/** Liegt der Zeitpunkt im Versandfenster 08:00–20:00 (Berlin)? */
export function imVersandfenster(d: Date = new Date()): boolean {
  const m = berlinMinuten(d);
  return m >= FENSTER_AB_MIN && m < FENSTER_BIS_MIN;
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

/** Der nächste Zeitpunkt im Versandfenster: jetzt (wenn offen), sonst heute bzw. morgen 08:00 Berlin. */
export function naechstesFenster(d: Date = new Date()): Date {
  if (imVersandfenster(d)) return d;
  const b = berlinTeile(d);
  const minuten = b.h * 60 + b.min;
  if (minuten < FENSTER_AB_MIN) return berlinWandZuDatum(b.j, b.m, b.t, FENSTER_AB_MIN);
  const morgen = new Date(Date.UTC(b.j, b.m - 1, b.t + 1));
  return berlinWandZuDatum(morgen.getUTCFullYear(), morgen.getUTCMonth() + 1, morgen.getUTCDate(), FENSTER_AB_MIN);
}

// ── DAS URTEIL ─────────────────────────────────────────────────────────────
export type Zustaendigkeit = "vertrieb" | "onboarding" | "inkasso";

/** Was der Server über den Menschen weiß — vollständig, damit die Regel nichts erraten muss. */
export interface NachfassFakten {
  /** Gibt es die Person noch (nicht zusammengeführt, nicht gelöscht)? */
  personDa: boolean;
  /** Der Zählerstand `unreachable_count` JETZT — sinkt auf 0, sobald er erreicht wird oder bucht. */
  versuche: number;
  /** Wer ist zuständig (zustaendigeRolleSql, fiaon-zustaendigkeit.ts)? */
  rolle: Zustaendigkeit | null;
  /** Kunde von FIAON Global (fiaon-global-kunde.ts)? */
  globalKunde: boolean;
  /** werbungVerboten(menschSperre) — Werbesperre, „Stopp“, Testkonto, Vertriebssperre, gekündigt; null = frei. */
  sperre: string | null;
  /** Steht schon ein gebuchter Termin oder ein vereinbarter Rückruf in der Zukunft? */
  terminOffen: boolean;
  /** Gibt es eine zustellbare E-Mail-Adresse (dieselbe Rangfolge wie der Versand)? */
  hatEmail: boolean;
  /**
   * Die jüngste VERSANDTE Mail mit Terminlink an ihn (TERMINLINK_EREIGNISSE, rueckhol_*) — E-401 Nachbesserung: dazu die
   * anderen Verkaufs-/Erinnerungsmails (ABSTAND_AUCH: Mara-Aktion, Lead-Nachfassen, Antrags-Erinnerung).
   */
  letzteTerminMailAm: string | Date | null;
  /**
   * E-401 Nachbesserung (Prüfer-Fund): Ein eingegangener, noch NICHT gebuchter Kündigungsantrag (KUENDIGUNG_UNGEBUCHT_SQL).
   * Die Kündigung wirkt mit Zugang — „Wann passt es Ihnen?“ an jemanden, der gekündigt hat, ist falsch.
   */
  kuendigungOffen?: boolean;
}

export type NachfassUrteil =
  | { art: "senden" }
  | { art: "warten"; nichtVor: Date; grund: string }
  | { art: "auslassen"; grund: string }
  | { art: "erledigt"; grund: string };

export const GRUND = {
  personWeg: "Person nicht mehr da (zusammengeführt oder gelöscht)",
  erreicht: "inzwischen erreicht — der Zähler steht wieder unter 2",
  terminSteht: "ein Termin oder vereinbarter Rückruf steht schon",
  global: "Kunde von FIAON Global — sein Ansprechpartner fasst persönlich nach",
  inkasso: "Forderungsmanagement — dort fasst das Raten-Team nach",
  keineMail: "keine E-Mail-Adresse hinterlegt",
  kuendigung: "Kündigung eingegangen (noch nicht gebucht) — keine Terminmail",
  fenster: "außerhalb 08:00–20:00 — geht ab 8 Uhr raus",
  abstand: "vor kurzem ging schon eine Mail mit Terminlink raus — wartet den Abstand ab",
} as const;

/**
 * Die eine Regel: Was tut Mara jetzt mit diesem Menschen? Rein — dieselbe Prüfung beim Vormerken
 * (nach dem Klick auf „Nicht erreicht“) und beim Senden (im Takt), damit sich zwischendurch
 * Geändertes (erreicht, gebucht, gesperrt) durchsetzt.
 */
export function nachfassUrteil(f: NachfassFakten, jetzt: Date = new Date()): NachfassUrteil {
  if (!f.personDa) return { art: "auslassen", grund: GRUND.personWeg };
  if (Number(f.versuche || 0) < NACHFASS_NACH_VERSUCH) return { art: "erledigt", grund: GRUND.erreicht };
  if (f.terminOffen) return { art: "erledigt", grund: GRUND.terminSteht };
  if (f.globalKunde) return { art: "auslassen", grund: GRUND.global };
  if (f.rolle === "inkasso") return { art: "auslassen", grund: GRUND.inkasso };
  if (f.sperre) return { art: "auslassen", grund: f.sperre };
  // E-401 Nachbesserung: Die Sperre kennt nur die GEBUCHTE Kündigung — ein eingegangener Antrag zählt genauso (E-368).
  if (f.kuendigungOffen) return { art: "auslassen", grund: GRUND.kuendigung };
  if (!f.hatEmail) return { art: "auslassen", grund: GRUND.keineMail };
  const letzte = f.letzteTerminMailAm ? new Date(f.letzteTerminMailAm).getTime() : NaN;
  if (Number.isFinite(letzte) && jetzt.getTime() - letzte < ABSTAND_STUNDEN * 3_600_000) {
    return { art: "warten", nichtVor: naechstesFenster(new Date(letzte + ABSTAND_STUNDEN * 3_600_000)), grund: GRUND.abstand };
  }
  if (!imVersandfenster(jetzt)) return { art: "warten", nichtVor: naechstesFenster(jetzt), grund: GRUND.fenster };
  return { art: "senden" };
}

/** „heute 08:00“ / „morgen 08:00“ / „Mi 22.10., 08:00“ — für den Hinweis an den Mitarbeiter. */
export function wannText(ziel: Date, jetzt: Date = new Date()): string {
  const z = berlinTeile(ziel);
  const n = berlinTeile(jetzt);
  const uhr = `${String(z.h).padStart(2, "0")}:${String(z.min).padStart(2, "0")}`;
  const tage = Math.round((Date.UTC(z.j, z.m - 1, z.t) - Date.UTC(n.j, n.m - 1, n.t)) / 86_400_000);
  if (tage <= 0) return `heute ${uhr}`;
  if (tage === 1) return `morgen ${uhr}`;
  return `am ${String(z.t).padStart(2, "0")}.${String(z.m).padStart(2, "0")}., ${uhr}`;
}

/**
 * Der Satz für den Mitarbeiter nach seinem Klick (hängt an der Meldung des Ergebnisses).
 * null, wenn er nichts wissen muss (erreicht, Termin steht, Global/Forderungsmanagement/Sperre —
 * die kennt er aus der Akte). Nur die fehlende Adresse sagt Mara laut: die kann er beheben.
 */
export function hinweisFuerMitarbeiter(u: NachfassUrteil, jetzt: Date = new Date()): string | null {
  if (u.art === "senden") return "Mara schickt dem Kunden in den nächsten Minuten eine kurze Mail mit seinem Terminlink (2× nicht erreicht) — er wählt seine Zeit selbst.";
  if (u.art === "warten") return `Mara schickt dem Kunden ${wannText(u.nichtVor, jetzt)} Uhr eine kurze Mail mit seinem Terminlink (2× nicht erreicht).`;
  if (u.art === "auslassen" && u.grund === GRUND.keineMail) return "Keine E-Mail-Adresse hinterlegt — Mara kann den Terminlink nicht schicken. Trag die Adresse in der Akte nach.";
  return null;
}
