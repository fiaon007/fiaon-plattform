// ═══════════════════════════════════════════════════════════════════════════
// „NEU FÜR SIE" AUCH PER MAIL — DIE REGELN (E-467, 30.10.2026)
//
// Justin: „Immer wenn wir was Neues für den Kunden haben, muss er eine E-Mail bekommen und das Popup in der App."
//
// Diese Datei ist REIN — keine Datenbank, kein Netz, das „jetzt" kommt als Parameter. Sie sagt:
//   · ab wann etwas für die Mail neu ist (globalNeuigkeitenMailGrenze),
//   · was schon eine EIGENE Mail hatte und deshalb nicht noch einmal gemailt wird (globalNeuigkeitenMailQuelle),
//   · wann gebündelt verschickt wird (globalNeuigkeitenMailEntscheid),
//   · wie die Punkte in der Mail stehen (globalNeuigkeitenMailInhalt).
// Die Punkte selbst baut die EINE Quelle des Fensters: globalNeuigkeitenBauen (shared/fiaon-global-neuigkeiten.ts).
// Es gibt keine zweite Textliste — Titel und Satz jeder Zeile sind die des Fensters.
//
// ── WAS KEINE NEUIGKEITEN-MAIL AUSLÖST ────────────────────────────────────
//   · der Start nach Zahlungseingang (Verlauf „start") — dafür gibt es die Zahlungs-/Startmail;
//   · eine Etappe oder der Abschluss, zu dem schon eine Etappen-Mail ging (global_etappe, „Kunde informieren");
//   · ein Dokument, Post oder „zur Unterschrift", zu dem schon eine Dokument-Mail ging (global_dokument);
//   · eine Antwort im Faden, zu der schon eine Antwort-Mail ging (global_nachricht);
//   · alles, was der Kunde schon gesehen hat (Fenster geschlossen, Dokument geöffnet, Antwort gelesen) — das fällt
//     schon in der Quelle heraus;
//   · interne Zeilen (nur sichtbare Verlaufszeilen werden gelesen) und was der Kunde selbst getan hat.
// Zugangslink, Vertrag/Rechnung, Zahlungserinnerung und Zusatzdienst-Rechnung sind keine Neuigkeiten des Fensters.
// ═══════════════════════════════════════════════════════════════════════════
import type { BereichSprache } from "./fiaon-global-bereich";
import { GLOBAL_NEUIGKEITEN_MAX, GLOBAL_NEUIGKEITEN_WOERTER, type GlobalNeuigkeit, type NeuigkeitenQuelle } from "./fiaon-global-neuigkeiten";

/** Die Zahlen der Bündelung — hier und nur hier. */
export const GLOBAL_NEUIGKEITEN_MAIL = {
  /** So lange nach der letzten neuen Sache wird gewartet, ob noch etwas dazukommt. */
  ruheMinuten: 10,
  /** Höchstens eine Neuigkeiten-Mail je Auftrag in dieser Zeit. */
  abstandMinuten: 60,
  /** Kommt laufend Neues dazu, geht die Mail spätestens so lange nach der ältesten Sache trotzdem. */
  hoechstensWartenMinuten: 60,
  /** Der Takt des Laufs (fiaon-crons.ts, global_neuigkeiten_mail). */
  taktMinuten: 5,
} as const;

/** Die Einstellungen in fiaon_settings: der Schalter (Vorgabe an) und ab wann gezählt wird (gesetzt beim Einschalten). */
export const GLOBAL_NEUIGKEITEN_MAIL_SCHLUESSEL = { schalter: "global_neuigkeiten_mail", seit: "global_neuigkeiten_mail_seit" } as const;

/** Die Ereignisse der Mails, die eine Neuigkeit schon eigens mitgeteilt haben. */
export const GLOBAL_NEUIGKEITEN_EIGENE_MAILS = ["global_etappe", "global_dokument", "global_nachricht"] as const;
export type GlobalEigeneMail = (typeof GLOBAL_NEUIGKEITEN_EIGENE_MAILS)[number];

const ms = (x: string | null | undefined): number | null => { const v = x ? Date.parse(x) : NaN; return Number.isFinite(v) ? v : null; };

// ── AB WANN IST ETWAS FÜR DIE MAIL NEU? ──────────────────────────────────────
/**
 * Das Späteste aus: Fenster zuletzt geschlossen, letzte Neuigkeiten-Mail, Einschalten der Mail (beim ersten Deploy und
 * bei jedem Wiedereinschalten neu gesetzt — so wird nie Altes nachgemailt) und Anlage der Akte.
 */
export function globalNeuigkeitenMailGrenze(e: { gesehenAm?: string | null; mailAm?: string | null; seit: string; akteSeit?: string | null }): string {
  const werte = [e.gesehenAm, e.mailAm, e.seit, e.akteSeit].map(ms).filter((v): v is number => v != null);
  return new Date(werte.length ? Math.max(...werte) : Date.now()).toISOString();
}

// ── WAS SCHON EINE EIGENE MAIL HATTE ─────────────────────────────────────────
/**
 * Nimmt aus der Quelle des Fensters, was schon eine eigene Mail hatte. `gedeckt` = je Ereignis der Zeitpunkt der
 * jüngsten erfolgreich versandten Mail dieses Auftrags. Was VOR (oder genau mit) dieser Mail entstand, ist mitgeteilt.
 * Die „bitte neu"-Bitte (E-443) geht nie per eigener Mail — sie bleibt.
 */
export function globalNeuigkeitenMailQuelle(q: NeuigkeitenQuelle, gedeckt: Partial<Record<GlobalEigeneMail, string | null>>): NeuigkeitenQuelle {
  const bis = (event: GlobalEigeneMail) => ms(gedeckt[event] ?? null);
  const vor = (am: string, grenze: number | null) => grenze != null && (ms(am) ?? Infinity) <= grenze;
  const etappe = bis("global_etappe"); const dokument = bis("global_dokument"); const nachricht = bis("global_nachricht");
  return {
    ...q,
    verlauf: q.verlauf.filter((v) => {
      if (v.art === "start") return false; // die Zahlungs-/Startmail hat es gesagt
      if ((v.art === "etappe" || v.art === "abschluss") && vor(v.am, etappe)) return false;
      return true;
    }),
    dokumente: q.dokumente.filter((d) => d.von === "kunde" || !vor(d.am, dokument)),
    nachrichten: q.nachrichten.filter((n) => !vor(n.am, nachricht)),
  };
}

// ── WANN GEHT DIE MAIL? ──────────────────────────────────────────────────────
export type GlobalNeuigkeitenMailGrund = "nichts_neu" | "sendefenster" | "abstand" | "ruhe" | "senden";
/**
 * Gebündelt: erst wenn seit der jüngsten Neuigkeit {@link GLOBAL_NEUIGKEITEN_MAIL.ruheMinuten} vergangen sind (oder die
 * älteste schon {@link GLOBAL_NEUIGKEITEN_MAIL.hoechstensWartenMinuten} wartet), höchstens eine Mail je
 * {@link GLOBAL_NEUIGKEITEN_MAIL.abstandMinuten} und nur im Sendefenster der Kundenmails.
 */
export function globalNeuigkeitenMailEntscheid(e: { liste: Pick<GlobalNeuigkeit, "am">[]; letzteMailAm?: string | null; jetzt: string; imFenster: boolean }): { senden: boolean; grund: GlobalNeuigkeitenMailGrund } {
  if (!e.liste.length) return { senden: false, grund: "nichts_neu" };
  if (!e.imFenster) return { senden: false, grund: "sendefenster" };
  const jetzt = ms(e.jetzt) ?? Date.now();
  const letzte = ms(e.letzteMailAm ?? null);
  const Z = GLOBAL_NEUIGKEITEN_MAIL;
  if (letzte != null && jetzt - letzte < Z.abstandMinuten * 60_000) return { senden: false, grund: "abstand" };
  const zeiten = e.liste.map((n) => ms(n.am)).filter((v): v is number => v != null);
  const juengste = zeiten.length ? Math.max(...zeiten) : jetzt;
  const aelteste = zeiten.length ? Math.min(...zeiten) : jetzt;
  if (jetzt - juengste < Z.ruheMinuten * 60_000 && jetzt - aelteste < Z.hoechstensWartenMinuten * 60_000) return { senden: false, grund: "ruhe" };
  return { senden: true, grund: "senden" };
}

// ── WIE DIE PUNKTE IN DER MAIL STEHEN ────────────────────────────────────────
const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Betreff-Zusatz und Liste für die Vorlage `global_neuigkeiten` (server/mail/vorlagen/global-bereich.ts) — aus der Liste
 * des Fensters. Ohne Werte: EIN, Nummer und Adresse stehen nur im Portal. Bei einer Mitteilung des Teams steht nur der
 * Titel in der Mail (der Text bleibt im Portal, wie bei einer Antwort im Faden).
 */
export function globalNeuigkeitenMailInhalt(liste: GlobalNeuigkeit[], weitere: number, s: BereichSprache): { titel: string; html: string; weitereSatz: string; anzahl: number } {
  const zeilen = liste.slice(0, GLOBAL_NEUIGKEITEN_MAX).map((n) => {
    const satz = n.art === "mitteilung" ? "" : n.satz;
    return `· <b>${esc(n.titel)}</b>${satz ? `<br />${esc(satz)}` : ""}`;
  });
  const rest = weitere + Math.max(0, liste.length - GLOBAL_NEUIGKEITEN_MAX);
  return {
    titel: esc(liste[0]?.titel ?? ""),
    html: zeilen.join("<br /><br />"),
    weitereSatz: rest > 0 ? esc(GLOBAL_NEUIGKEITEN_WOERTER[s].weitere(rest)) : "",
    anzahl: zeilen.length + rest,
  };
}
