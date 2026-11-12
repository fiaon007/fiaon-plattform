// ═══════════════════════════════════════════════════════════════════════════
// CHEFBÜRO › GLOBAL-LAGE — DIE RECHENREGELN (E-508, 12.11.2026)
//
// Justin: „Ich brauche eine Zusammenfassung der heutigen Woche, am besten jeden Tag — wie ein Live-Feed. Welchen
//          Auftragswert haben wir draußen, bei wem warten wir, was wurde gesprochen, wie viel brauchen wir, um unsere
//          monatlichen Fixkosten zu decken, was sind die nächsten Schritte pro Mandant?“
//
// Reine Rechnung, ohne Datenbank und ohne Netz. Der Server (server/lib/fiaon-chef-global-lage.ts) liest die Zeilen und
// gibt sie hier hinein; die Oberfläche (ChefGlobalLage.tsx) zeigt, was hier herauskommt. So rechnen Server, Bildschirm
// und Prüfstand (scripts/pruef-chef-global-lage.ts) dasselbe.
//
// Drei Dinge entscheidet diese Datei:
//   1 Was ein Angebot wert ist — Start-Betrag und Erfolgshonorar getrennt, je Angebotsart.
//   2 Wer am Zug ist — wir, der Kunde, eine Behörde — und was der eine nächste Schritt ist.
//   3 Wie weit der Monat die Fixkosten deckt.
// Nichts hier sendet, bucht oder stellt eine Rechnung.
// ═══════════════════════════════════════════════════════════════════════════
import { listenLage, type ListenZeile } from "./fiaon-global-als-naechstes";

// ── Einstellungen ────────────────────────────────────────────────────────────
/** Der Fixkosten-Wert je Monat steht in fiaon_settings unter diesem Schlüssel (Cent, als Text). */
export const LAGE_FIXKOSTEN_SCHLUESSEL = "chef_fixkosten_monat_cents";
/** Startwert, bis der Inhaber seine eigene Zahl setzt. */
export const LAGE_FIXKOSTEN_VORGABE_CENTS = 1_900_000;
export const LAGE_FIXKOSTEN_MAX_CENTS = 100_000_000;
/** Um wie viele Tage ab heute ein Angebot höchstens verlängert werden kann. */
export const LAGE_GUELTIGKEIT_MAX_TAGE = 60;
/** So lange nach dem Ende der Gültigkeit bleibt ein abgelaufenes Angebot in der Liste (danach nur noch im Reiter „Angebote“). */
export const LAGE_ABGELAUFEN_SICHTBAR_TAGE = 14;
/** So lange lebt ein schon verschickter Link nach dem Ende der Gültigkeit (ANGEBOT_LINK_NACHLAUF_TAGE im Server). */
export const LAGE_LINK_NACHLAUF_TAGE = 7;
export const LAGE_NOTIZ_MAX = 4000;
export const LAGE_WIEDERVORLAGE_TEXT_MAX = 200;

// ── Tage (reine Kalenderrechnung auf JJJJ-MM-TT, ohne Zeitzone) ───────────────
const ISO_TAG = /^\d{4}-\d{2}-\d{2}$/;
export const istTag = (v: unknown): v is string => typeof v === "string" && ISO_TAG.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
const alsUtc = (tag: string) => Date.parse(`${tag}T00:00:00Z`);
export function tagPlus(tag: string, n: number): string {
  return new Date(alsUtc(tag) + n * 86_400_000).toISOString().slice(0, 10);
}
/** Ganze Tage von a bis b (b − a); negativ, wenn b vor a liegt. */
export function tageZwischen(a: string, b: string): number {
  return Math.round((alsUtc(b) - alsUtc(a)) / 86_400_000);
}
/** Der Montag der Woche, in der dieser Tag liegt. */
export function wocheMontag(tag: string): string {
  const wt = new Date(alsUtc(tag)).getUTCDay(); // 0 = Sonntag
  return tagPlus(tag, wt === 0 ? -6 : 1 - wt);
}
/** Die Tage einer Woche bis höchstens „heute“, neueste zuerst. */
export function wochenTage(montag: string, heute: string): string[] {
  const aus: string[] = [];
  for (let i = 6; i >= 0; i--) { const t = tagPlus(montag, i); if (t <= heute) aus.push(t); }
  return aus;
}
const WOCHENTAGE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
/** „Heute“, „Gestern“ oder „Montag, 9. November“. */
export function tagName(tag: string, heute: string): string {
  const d = tageZwischen(tag, heute);
  if (d === 0) return "Heute";
  if (d === 1) return "Gestern";
  const x = new Date(alsUtc(tag));
  return `${WOCHENTAGE[x.getUTCDay()]}, ${x.getUTCDate()}. ${MONATE[x.getUTCMonth()]}`;
}
/** „12.11.“ — kurz, für Fristen. */
export function tagKurz(tag: string | null | undefined): string {
  return istTag(tag) ? `${tag.slice(8, 10)}.${tag.slice(5, 7)}.` : "—";
}
/** „9.–15. November 2026“. */
export function wocheName(montag: string): string {
  const a = new Date(alsUtc(montag)); const b = new Date(alsUtc(tagPlus(montag, 6)));
  const gleich = a.getUTCMonth() === b.getUTCMonth();
  return `${a.getUTCDate()}.${gleich ? "" : ` ${MONATE[a.getUTCMonth()]}`}–${b.getUTCDate()}. ${MONATE[b.getUTCMonth()]} ${b.getUTCFullYear()}`;
}
const mehrzahl = (n: number, eins: string, viele: string) => `${n} ${n === 1 ? eins : viele}`;
/** Ein langer Text auf eine Zeile gekürzt — Zeilenumbrüche werden Leerzeichen. */
export function kurzText(roh: unknown, max = 180): string {
  const s = String(roh ?? "").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

// ── 1 · Was ein Angebot wert ist ─────────────────────────────────────────────
export interface LageTeil {
  nr: number; betragCents: number; zahlungsstatus: string | null; faelligAm: string | null; bezahltAm: string | null;
  /** Die Bestellung zu diesem Teil — erst mit ihr steht eine Rechnung. */
  bestellRef: string | null;
  /** Schon gebuchte Teilzahlungen auf diese Rechnung (E-469), sonst 0. */
  teilBezahltCents: number;
}
export interface LageGelesen { aufrufe: number; besuche: number; zuerst: string | null; zuletzt: string | null }
/** Ein Angebot, wie die Lage es braucht — aus der Zeile der Angebotsliste (angebotListe) abgeleitet. */
export interface LageAngebot {
  id: number; ref: string;
  /** kapital · firma · begleit · individuell (Kooperationen sind Partner, keine Mandanten — sie kommen nie hier an). */
  art: string;
  status: string; name: string; zeile: string;
  gesamtCents: number; teile: LageTeil[];
  /** Wählt der Kunde den Fast-Track erst bei der Annahme, zählt er bis dahin nicht mit — hier steht sein Preis (sonst 0). */
  fastTrackWahlCents: number;
  /** Fest vereinbartes Erfolgshonorar in Cent; null = richtet sich nach dem Ergebnis (Prozent). */
  erfolgCents: number | null;
  gueltigBis: string | null; erstelltAm: string; angenommenAm: string | null;
  link: string | null; akteRef: string | null; gelesen: LageGelesen | null;
  /** E-506: bestehende Gesellschaft übernehmen statt neu gründen. */
  bestand: boolean;
  /** Wie der Knopf heißt, der das Erfolgshonorar in Rechnung stellt (null = unbekannt). */
  meilensteinKnopf: string | null;
}
const zahl = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const text = (v: unknown) => (v == null ? "" : String(v));
const tagAus = (v: unknown): string | null => { const s = text(v).slice(0, 10); return istTag(s) ? s : null; };

/** Macht aus einer Zeile der Angebotsliste (jede Angebotsart liefert etwas andere Felder) EIN Format. Koop → null. */
export function lageAngebotAus(e: Record<string, any>): LageAngebot | null {
  const art = text(e.art) || "individuell";
  if (art === "koop") return null;
  const teile: LageTeil[] = (Array.isArray(e.teile) ? e.teile : []).filter(Boolean).map((t: any) => ({
    nr: zahl(t.nr), betragCents: zahl(t.betragCents), zahlungsstatus: t.zahlungsstatus != null ? text(t.zahlungsstatus) : null,
    faelligAm: tagAus(t.faelligAm ?? t.zahlbarBis), bezahltAm: t.bezahltAm ? text(t.bezahltAm) : null,
    bestellRef: t.bestellRef ? text(t.bestellRef) : null, teilBezahltCents: 0,
  }));
  const par = (e.parameter ?? {}) as Record<string, any>;
  let erfolgCents: number | null;
  if (art === "kapital") {
    const g = (e.gebuehren ?? {}) as Record<string, any>;
    erfolgCents = g.vereinbart === false ? 0 : zahl(g.buergschaftCents) + zahl(g.auszahlungCents);
  } else if (art === "begleit") erfolgCents = null;
  else if (art === "firma") {
    const rest = teile.filter((t) => t.nr !== 1);
    erfolgCents = rest.some((t) => t.betragCents <= 0) ? null : rest.reduce((s, t) => s + t.betragCents, 0);
  } else erfolgCents = teile.find((t) => t.nr === 2)?.betragCents ?? zahl(par.teil2Cents);
  const a = (e.aufrufe ?? null) as Record<string, any> | null;
  const zeile = text(e.kapital?.zeile ?? e.begleit?.zeile ?? e.firma?.zeile ?? "");
  // Kapital-Angebot für Privatpersonen: Solange das Angebot offen ist und der Fast-Track zur Wahl steht, rechnet die Liste ihn
  // mit ein. Die Lage zählt vorsichtig — nur die Gründung; der Fast-Track steht daneben als „wählbar“.
  const ftWahl = art === "kapital" && text(e.status) === "offen" && par.fastTrackWahl === true && zahl(par.gruendungCents) > 0 ? zahl(par.fastTrackCents) : 0;
  return {
    id: zahl(e.id), ref: text(e.ref), art, status: text(e.status), name: text(e.kundeName) || text(e.ref), zeile,
    gesamtCents: ftWahl > 0 ? zahl(par.gruendungCents) : zahl(e.gesamtCents), fastTrackWahlCents: ftWahl, teile, erfolgCents,
    gueltigBis: tagAus(e.gueltigBis), erstelltAm: text(e.erstelltAm), angenommenAm: e.angenommenAm ? text(e.angenommenAm) : null,
    link: e.link ? text(e.link) : null, akteRef: e.auftragRef ? text(e.auftragRef) : null,
    gelesen: a ? { aufrufe: zahl(a.kundeAufrufe), besuche: zahl(a.besuche), zuerst: a.kundeErster?.am ? text(a.kundeErster.am) : null, zuletzt: a.kundeZuletzt?.am ? text(a.kundeZuletzt.am) : null } : null,
    bestand: !!par.bestand,
    meilensteinKnopf: e.knopfTexte?.buergschaft?.knopf ? text(e.knopfTexte.buergschaft.knopf) : null,
  };
}

export interface LageWert {
  startCents: number; erfolgCents: number;
  /** Das Erfolgshonorar ist ein Prozentsatz des Ergebnisses — kein fester Betrag, zählt in keiner Summe mit. */
  erfolgNachErgebnis: boolean;
  startBezahlt: boolean;
  /** Was vom Start-Betrag noch offen ist (0, wenn bezahlt; bei Teilzahlungen der Rest). */
  startOffenCents: number;
  /** keins = nichts vereinbart · offen = vereinbart, noch keine Rechnung · gestellt = Rechnung steht · bezahlt */
  erfolgStand: "keins" | "offen" | "gestellt" | "bezahlt";
}
export function angebotWert(a: LageAngebot): LageWert {
  const t1 = a.teile.find((t) => t.nr === 1);
  const spaeter = a.teile.filter((t) => t.nr !== 1);
  // Nach der Annahme gilt der Betrag der Rechnung (Teil 1); davor der Betrag, den die Seite heute zeigt.
  const startCents = a.status === "angenommen" && t1 ? t1.betragCents : (a.gesamtCents || t1?.betragCents || 0);
  const startBezahlt = !!t1 && t1.zahlungsstatus === "paid";
  const erfolgNachErgebnis = a.erfolgCents === null;
  const erfolgCents = a.erfolgCents ?? 0;
  let erfolgStand: LageWert["erfolgStand"] = erfolgNachErgebnis || erfolgCents > 0 ? "offen" : "keins";
  // „Gestellt“ heißt: Es gibt eine Rechnung (Bestellung) zu einem späteren Teil. Eine Zeile ohne Bestellung ist nur der Plan.
  const mitRechnung = spaeter.filter((t) => !!t.bestellRef);
  if (mitRechnung.length) erfolgStand = mitRechnung.every((t) => t.zahlungsstatus === "paid") ? "bezahlt" : "gestellt";
  const startOffenCents = startBezahlt ? 0 : Math.max(0, startCents - (t1?.teilBezahltCents ?? 0));
  return { startCents, erfolgCents, erfolgNachErgebnis, startBezahlt, startOffenCents, erfolgStand };
}

// ── 2 · Wer am Zug ist ───────────────────────────────────────────────────────
/** angebot = wartet auf Annahme · abgelaufen · zahlung = angenommen, Start-Betrag offen · arbeit = bezahlt, läuft · fertig */
export type LagePhase = "angebot" | "abgelaufen" | "zahlung" | "arbeit" | "fertig";
/** uns = wir sind dran · kunde = wartet auf den Kunden · amt = wartet auf Behörde/Institut · ruhe = nichts offen */
export type LageTon = "uns" | "kunde" | "amt" | "ruhe";
export interface LageSchritt { ton: LageTon; schritt: string; warum: string; seit: string | null; bis: string | null; ueberfaellig: boolean }

/** Der Stand der Akte, wie die Mandatsliste ihn schickt (globalMandateListe) — nur die Felder, die die Lage braucht. */
export interface LageAkte extends ListenZeile {
  ref: string; kunde: string; firma: string | null; llc: string | null; paket: string; angelegtAm: string; test: boolean;
  /** Offener Rechnungsbetrag einer Akte ohne Angebot (Kauf über die Website) — Cent, 0 wenn unbekannt. */
  betragCents?: number;
  /** Schon gebuchte Teilzahlungen auf diese Rechnung, sonst 0. */
  teilBezahltCents?: number;
}

export function angebotPhase(a: LageAngebot, w: LageWert = angebotWert(a)): LagePhase | null {
  if (a.status === "offen") return "angebot";
  if (a.status === "abgelaufen") return "abgelaufen";
  if (a.status !== "angenommen") return null; // zurückgezogen: kein Mandant
  if (a.art === "begleit") return "arbeit";   // der Begleitvertrag hat keinen Start-Betrag
  return w.startBezahlt ? "arbeit" : "zahlung";
}

/** Ein Satz, der mit einem Datum wie „06.11.“ endet, bekommt keinen zweiten Punkt. */
const satz = (s: string) => (s.endsWith(".") ? s : `${s}.`);
const gelesenSatz = (g: LageGelesen | null, heute: string): string => {
  if (!g || g.aufrufe <= 0) return "Bisher kein Aufruf durch den Kunden.";
  const z = tagAus(g.zuletzt);
  const wann = z ? (tageZwischen(z, heute) <= 0 ? "heute" : tageZwischen(z, heute) === 1 ? "gestern" : `am ${tagKurz(z)}`) : "";
  return satz(`${mehrzahl(Math.max(1, g.besuche), "Besuch", "Besuche")}${wann ? `, zuletzt ${wann}` : ""}`);
};

/** Der eine nächste Schritt für ein Angebot OHNE Akte. `heute` = Berliner Tag. */
export function angebotSchritt(a: LageAngebot, heute: string): LageSchritt | null {
  const w = angebotWert(a); const phase = angebotPhase(a, w);
  if (!phase) return null;
  const erstellt = tagAus(a.erstelltAm) ?? heute;
  if (phase === "abgelaufen") {
    return { ton: "uns", schritt: "Abgelaufen — verlängern oder ruhen lassen", warum: `Gültig bis ${tagKurz(a.gueltigBis)} ${gelesenSatz(a.gelesen, heute)}`, seit: a.gueltigBis, bis: null, ueberfaellig: true };
  }
  if (phase === "angebot") {
    const rest = a.gueltigBis ? tageZwischen(heute, a.gueltigBis) : 99;
    const gelesen = !!a.gelesen && a.gelesen.aufrufe > 0;
    const basis = { seit: a.erstelltAm, bis: a.gueltigBis, ueberfaellig: false };
    if (rest <= 2) {
      const wann = rest <= 0 ? "heute" : rest === 1 ? "morgen" : "in 2 Tagen";
      return { ...basis, ton: "uns", schritt: `Läuft ${wann} ab — nachfassen oder verlängern`, warum: gelesenSatz(a.gelesen, heute) };
    }
    if (!gelesen) {
      const alt = tageZwischen(erstellt, heute);
      return alt >= 1
        ? { ...basis, ton: "uns", schritt: "Noch nicht geöffnet — nachfassen", warum: `Seit ${mehrzahl(alt, "Tag", "Tagen")} angelegt, kein Aufruf durch den Kunden.` }
        : { ...basis, ton: "kunde", schritt: "Wartet auf den ersten Blick", warum: "Heute angelegt." };
    }
    const zuletzt = tagAus(a.gelesen!.zuletzt) ?? heute;
    const still = tageZwischen(zuletzt, heute);
    return still >= 2
      ? { ...basis, ton: "uns", schritt: `Seit ${still} Tagen still — nachfassen`, warum: gelesenSatz(a.gelesen, heute) }
      : { ...basis, ton: "kunde", schritt: "Gelesen — wartet auf die Annahme", warum: gelesenSatz(a.gelesen, heute) };
  }
  if (phase === "zahlung") {
    const faellig = a.teile.find((t) => t.nr === 1)?.faelligAm ?? null;
    const ueber = !!faellig && faellig < heute;
    return ueber
      ? { ton: "uns", schritt: "Zahlung überfällig — nachfassen", warum: satz(`Start-Betrag war fällig am ${tagKurz(faellig)}`), seit: a.angenommenAm, bis: faellig, ueberfaellig: true }
      : { ton: "kunde", schritt: "Angenommen — wartet auf die Zahlung", warum: faellig ? satz(`Start-Betrag fällig bis ${tagKurz(faellig)}`) : "Start-Betrag ist offen.", seit: a.angenommenAm, bis: faellig, ueberfaellig: false };
  }
  // arbeit ohne Akte: bezahlt (oder Begleitvertrag angenommen), aber niemand führt eine Akte.
  return { ton: "uns", schritt: "Akte anlegen", warum: "Angenommen — es gibt noch keine Akte mit Fahrplan.", seit: a.angenommenAm, bis: null, ueberfaellig: false };
}

/** Der nächste Schritt einer Akte — dieselbe Regel wie die Liste im Raum „Global-Kunden“ (listenLage). */
export function akteSchritt(z: LageAkte, heute: string): LageSchritt {
  const l = listenLage(z, heute);
  const frist = z.naechsteFrist ?? null;
  return {
    ton: l.gruppe, schritt: l.naechster, warum: l.stand,
    seit: z.status === "offen" ? z.angelegtAm : null,
    bis: l.gruppe === "uns" && frist ? frist : null,
    ueberfaellig: !!frist && frist < heute && l.gruppe === "uns",
  };
}

export interface LageMandant {
  /** „angebot:<Nummer>“ oder „akte:<Kennung>“ — der Bezug für Notizen und Wiedervorlagen. */
  schluessel: string;
  name: string; zeile: string; phase: LagePhase;
  angebotId: number | null; angebotRef: string | null; angebotArt: string | null; akteRef: string | null;
  wert: LageWert;
  gueltigBis: string | null; gelesen: LageGelesen | null; link: string | null;
  schritt: LageSchritt;
  /** Verlängern geht nur, solange das Angebot offen oder abgelaufen ist. */
  kannVerlaengern: boolean;
  /** Steht noch ein Erfolgshonorar aus, das ein Meilenstein-Knopf als Rechnung stellt? Dann zeigt die Karte den Warnsatz. */
  meilensteinOffen: boolean; bestand: boolean;
  /** Name des Knopfs, der die Rechnung stellt — für den Warnsatz (null = „der Meilenstein-Knopf“). */
  meilensteinKnopf: string | null;
}

const PHASE_RANG: Record<LagePhase, number> = { zahlung: 0, angebot: 1, abgelaufen: 2, arbeit: 3, fertig: 4 };
const TON_RANG: Record<LageTon, number> = { uns: 0, kunde: 1, amt: 2, ruhe: 3 };

/**
 * Alle Mandanten der Lage: jedes Angebot (ohne Koop, ohne zurückgezogene) und jede Akte ohne eigenes Angebot.
 * Gehört zu einem Angebot schon eine Akte, ist es EIN Mandant — Geld aus dem Angebot, nächster Schritt aus der Akte.
 */
export function mandantenBauen(angebote: LageAngebot[], akten: LageAkte[], heute: string): LageMandant[] {
  const akteNachRef = new Map(akten.map((a) => [a.ref, a]));
  const vergeben = new Set<string>();
  const aus: LageMandant[] = [];
  for (const a of angebote) {
    const w = angebotWert(a); const phase = angebotPhase(a, w);
    if (!phase) continue;
    if (phase === "abgelaufen" && a.gueltigBis && tageZwischen(a.gueltigBis, heute) > LAGE_ABGELAUFEN_SICHTBAR_TAGE) continue;
    const akte = a.akteRef ? akteNachRef.get(a.akteRef) : undefined;
    if (akte?.test) continue;
    if (akte) vergeben.add(akte.ref);
    if (akte?.status === "storniert") continue;
    // Mit Akte führt die Akte — außer der Start-Betrag ist noch offen: dann ist die Zahlung der Schritt.
    const schritt = akte && phase !== "zahlung" ? akteSchritt(akte, heute) : angebotSchritt(a, heute)!;
    aus.push({
      schluessel: akte ? `akte:${akte.ref}` : `angebot:${a.id}`,
      name: akte?.llc || a.name, zeile: a.zeile, phase: akte?.status === "abgeschlossen" ? "fertig" : phase,
      angebotId: a.id, angebotRef: a.ref, angebotArt: a.art, akteRef: akte?.ref ?? null, wert: w,
      gueltigBis: a.gueltigBis, gelesen: a.gelesen, link: a.link, schritt,
      kannVerlaengern: a.status === "offen" || a.status === "abgelaufen",
      meilensteinOffen: a.status === "angenommen" && w.erfolgStand === "offen" && !w.erfolgNachErgebnis && w.erfolgCents > 0,
      bestand: a.bestand, meilensteinKnopf: a.meilensteinKnopf,
    });
  }
  for (const k of akten) {
    if (k.test || vergeben.has(k.ref) || k.status === "storniert") continue;
    const bezahlt = k.status !== "offen";
    aus.push({
      schluessel: `akte:${k.ref}`, name: k.llc || k.firma || k.kunde || k.ref, zeile: "", phase: k.status === "abgeschlossen" ? "fertig" : bezahlt ? "arbeit" : "zahlung",
      angebotId: null, angebotRef: null, angebotArt: null, akteRef: k.ref,
      wert: { startCents: zahl(k.betragCents), erfolgCents: 0, erfolgNachErgebnis: false, startBezahlt: bezahlt, startOffenCents: bezahlt ? 0 : Math.max(0, zahl(k.betragCents) - zahl(k.teilBezahltCents)), erfolgStand: "keins" },
      gueltigBis: null, gelesen: null, link: null, schritt: akteSchritt(k, heute), kannVerlaengern: false, meilensteinOffen: false, bestand: false, meilensteinKnopf: null,
    });
  }
  return aus.sort((a, b) => TON_RANG[a.schritt.ton] - TON_RANG[b.schritt.ton]
    || Number(b.schritt.ueberfaellig) - Number(a.schritt.ueberfaellig)
    || PHASE_RANG[a.phase] - PHASE_RANG[b.phase]
    || (a.schritt.bis ?? a.gueltigBis ?? "9999").localeCompare(b.schritt.bis ?? b.gueltigBis ?? "9999")
    || a.name.localeCompare(b.name, "de"));
}

// ── Auftragswert ─────────────────────────────────────────────────────────────
export interface LageSpalte { anzahl: number; startCents: number; erfolgCents: number }
export interface LageAuftragswert {
  /** Angebote draußen — warten auf die Annahme. */
  offen: LageSpalte;
  /** Angenommen, Start-Betrag noch nicht bezahlt. */
  angenommen: LageSpalte;
  /** Start-Betrag bezahlt: startCents = eingegangen, erfolgCents = Erfolgshonorar, das noch aussteht (offen + gestellt). */
  bezahlt: LageSpalte & { erfolgGestelltCents: number; erfolgBezahltCents: number };
  /** Alles, was noch nicht bezahlt ist: offen + angenommen + ausstehende Erfolgshonorare. */
  draussenCents: number;
  /** Davon schon zugesagt (angenommen bzw. Mandat läuft). */
  zugesagtCents: number;
  /** Mandanten, deren Erfolgshonorar ein Prozentsatz ist und in keiner Summe steckt. */
  nachErgebnis: number;
}
export function auftragswertRechnen(m: LageMandant[]): LageAuftragswert {
  const leer = (): LageSpalte => ({ anzahl: 0, startCents: 0, erfolgCents: 0 });
  const aus: LageAuftragswert = { offen: leer(), angenommen: leer(), bezahlt: { ...leer(), erfolgGestelltCents: 0, erfolgBezahltCents: 0 }, draussenCents: 0, zugesagtCents: 0, nachErgebnis: 0 };
  for (const x of m) {
    const w = x.wert;
    if (x.phase === "abgelaufen") continue;
    if (w.erfolgNachErgebnis) aus.nachErgebnis++;
    if (x.phase === "angebot") { aus.offen.anzahl++; aus.offen.startCents += w.startCents; aus.offen.erfolgCents += w.erfolgCents; continue; }
    // Angenommen, noch nicht (ganz) bezahlt: Es zählt der offene Rest — eine Teilzahlung ist schon eingegangenes Geld.
    if (x.phase === "zahlung") { aus.angenommen.anzahl++; aus.angenommen.startCents += w.startOffenCents; aus.angenommen.erfolgCents += w.erfolgCents; continue; }
    aus.bezahlt.anzahl++; aus.bezahlt.startCents += w.startCents;
    if (w.erfolgStand === "bezahlt") aus.bezahlt.erfolgBezahltCents += w.erfolgCents;
    else if (w.erfolgStand !== "keins") { aus.bezahlt.erfolgCents += w.erfolgCents; if (w.erfolgStand === "gestellt") aus.bezahlt.erfolgGestelltCents += w.erfolgCents; }
  }
  aus.zugesagtCents = aus.angenommen.startCents + aus.angenommen.erfolgCents + aus.bezahlt.erfolgCents;
  aus.draussenCents = aus.offen.startCents + aus.offen.erfolgCents + aus.zugesagtCents;
  return aus;
}

// ── 3 · Fixkosten ────────────────────────────────────────────────────────────
export interface LageFixkosten {
  fixCents: number; vorgabe: boolean;
  /** Eingang im laufenden Monat (alle Bereiche, EINE Umsatzquelle) — davon Global. */
  monatCents: number; globalMonatCents: number;
  deckungProzent: number | null; fehltCents: number;
  /** Schon zugesagt, aber noch nicht bezahlt (angenommen + ausstehende Erfolgshonorare). */
  zugesagtCents: number; mitZugesagtProzent: number | null;
  /** Wie viel vom Monat vorbei ist — der Maßstab für „im Plan“. */
  monatVorbeiProzent: number;
  /** gedeckt · zugesagt (mit den Zusagen gedeckt) · offen */
  stand: "gedeckt" | "zugesagt" | "offen";
  /** So viele Abschlüsse zum Durchschnitt der offenen Angebote schließen die Lücke (null = keine offenen Angebote). */
  abschluesseNoetig: number | null;
}
export function fixkostenRechnen(e: { fixCents: number; vorgabe: boolean; monatCents: number; globalMonatCents: number; zugesagtCents: number; offen: LageSpalte; heute: string }): LageFixkosten {
  const fix = Math.max(0, Math.round(e.fixCents));
  const prozent = (v: number) => (fix > 0 ? Math.min(999, Math.round((v / fix) * 100)) : null);
  const fehlt = Math.max(0, fix - e.monatCents);
  const jahr = Number(e.heute.slice(0, 4)); const monat = Number(e.heute.slice(5, 7));
  const tageImMonat = new Date(Date.UTC(jahr, monat, 0)).getUTCDate();
  const schnitt = e.offen.anzahl > 0 ? Math.round(e.offen.startCents / e.offen.anzahl) : 0;
  return {
    fixCents: fix, vorgabe: e.vorgabe, monatCents: e.monatCents, globalMonatCents: e.globalMonatCents,
    deckungProzent: prozent(e.monatCents), fehltCents: fehlt,
    zugesagtCents: e.zugesagtCents, mitZugesagtProzent: prozent(e.monatCents + e.zugesagtCents),
    monatVorbeiProzent: Math.round((Number(e.heute.slice(8, 10)) / tageImMonat) * 100),
    stand: fehlt === 0 ? "gedeckt" : e.monatCents + e.zugesagtCents >= fix ? "zugesagt" : "offen",
    abschluesseNoetig: fehlt > 0 && schnitt > 0 ? Math.ceil(fehlt / schnitt) : null,
  };
}
/** Eingabe „19.000“ / „19000,50“ / 19000 (Euro) → Cent. */
export function fixkostenPruefen(roh: unknown): { ok: true; cents: number } | { ok: false; error: string } {
  const s = typeof roh === "number" ? String(roh).replace(".", ",") : String(roh ?? "").trim().replace(/\s|€/g, "");
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(s)) return { ok: false, error: "Bitte einen Betrag in Euro eintragen, zum Beispiel 19.000." };
  const [ganz, nach = ""] = s.replace(/\./g, "").split(",");
  const cents = Number(ganz) * 100 + Number((nach + "00").slice(0, 2));
  if (cents > LAGE_FIXKOSTEN_MAX_CENTS) return { ok: false, error: "Der Betrag ist zu groß." };
  return { ok: true, cents };
}

// ── Gültigkeit verlängern ────────────────────────────────────────────────────
export function gueltigkeitPruefen(e: { status: string; altBis: string | null; neuBis: unknown; heute: string }):
  { ok: true; neuBis: string; linkBleibtBis: string | null } | { ok: false; error: string } {
  if (e.status !== "offen" && e.status !== "abgelaufen") return { ok: false, error: "Verlängern geht nur, solange das Angebot offen oder abgelaufen ist." };
  if (!istTag(e.neuBis)) return { ok: false, error: "Bitte ein Datum wählen." };
  if (e.neuBis < e.heute) return { ok: false, error: "Das Datum liegt in der Vergangenheit." };
  if (e.neuBis > tagPlus(e.heute, LAGE_GUELTIGKEIT_MAX_TAGE)) return { ok: false, error: `Höchstens ${LAGE_GUELTIGKEIT_MAX_TAGE} Tage ab heute.` };
  if (e.altBis && e.neuBis === e.altBis && e.status === "offen") return { ok: false, error: satz(`Das Angebot gilt schon bis ${tagKurz(e.altBis)}`) };
  // Ein schon verschickter Link lebt bis zum ALTEN Ende plus Nachlauf. Reicht das bis zum neuen Ende, bleibt er gültig.
  const altLinkBis = e.altBis ? tagPlus(e.altBis, LAGE_LINK_NACHLAUF_TAGE) : null;
  const linkBleibtBis = altLinkBis && altLinkBis >= e.heute ? altLinkBis : null;
  return { ok: true, neuBis: e.neuBis, linkBleibtBis };
}

// ── Notiz und Wiedervorlage ──────────────────────────────────────────────────
export const LAGE_BEZUG = ["angebot", "akte", "anfrage", "partner", "frei"] as const;
export type LageBezug = typeof LAGE_BEZUG[number];
export interface LageNotizEin { bezugArt: LageBezug; bezugId: string; art: "gespraech" | "notiz" | "wiedervorlage"; text: string; wiedervorlageAm: string | null; wiedervorlageText: string | null }
export function notizPruefen(ein: any, heute: string): { ok: true; wert: LageNotizEin } | { ok: false; error: string } {
  const bezugArt = text(ein?.bezugArt) as LageBezug;
  if (!(LAGE_BEZUG as readonly string[]).includes(bezugArt)) return { ok: false, error: "Der Bezug fehlt." };
  const bezugId = text(ein?.bezugId).trim();
  if (bezugArt !== "frei" && (!bezugId || bezugId.length > 60 || !/^[A-Za-z0-9-]+$/.test(bezugId))) return { ok: false, error: "Der Bezug ist nicht lesbar." };
  const t = text(ein?.text).trim();
  if (t.length > LAGE_NOTIZ_MAX) return { ok: false, error: `Bitte höchstens ${LAGE_NOTIZ_MAX} Zeichen.` };
  const wvAm = ein?.wiedervorlageAm ? text(ein.wiedervorlageAm) : null;
  if (wvAm && !istTag(wvAm)) return { ok: false, error: "Wiedervorlage: bitte ein Datum wählen." };
  if (wvAm && wvAm < heute) return { ok: false, error: "Wiedervorlage: das Datum liegt in der Vergangenheit." };
  const wvText = text(ein?.wiedervorlageText).trim();
  if (wvText.length > LAGE_WIEDERVORLAGE_TEXT_MAX) return { ok: false, error: `Wiedervorlage: höchstens ${LAGE_WIEDERVORLAGE_TEXT_MAX} Zeichen.` };
  if (!t && !wvAm) return { ok: false, error: "Bitte eine Notiz schreiben oder einen Tag für die Wiedervorlage wählen." };
  return { ok: true, wert: { bezugArt, bezugId: bezugArt === "frei" ? "" : bezugId, art: !t ? "wiedervorlage" : ein?.art === "notiz" ? "notiz" : "gespraech", text: t, wiedervorlageAm: wvAm, wiedervorlageText: wvAm ? (wvText || null) : null } };
}

// ── Nachfassen: eine persönliche Mail als ENTWURF (E-508 Scheibe 3) ───────────
// Vier kurze Fassungen, je nach Lage des Angebots. Der Text ist ein Vorschlag für Justins Postfach — gesendet wird nie
// von hier. Regeln des Hauses, still eingebaut: Sie-Form, kein Druck, kein Wort darüber, ob und wie lange jemand das
// Angebot gelesen hat, kein Satz über Banken, kein Versprechen. Die Fassungen laufen durch die Wortwand (Prüfstand).
/** ungelesen = noch nie geöffnet · still = gelesen, seither Ruhe · laeuft_ab = gilt nur noch bis zu zwei Tage · abgelaufen */
export type NachfassArt = "ungelesen" | "still" | "laeuft_ab" | "abgelaufen";
export const NACHFASS_ART_NAME: Record<NachfassArt, string> = {
  ungelesen: "Angebot angekommen?", still: "Noch Fragen offen?", laeuft_ab: "Angebot läuft ab", abgelaufen: "Angebot neu bereitstellen?",
};
/** Für welche Mandanten es einen Nachfass-Entwurf gibt: nur solange das Angebot offen oder gerade abgelaufen ist. */
export function nachfassArt(m: { phase: LagePhase; gelesen: LageGelesen | null; gueltigBis: string | null }, heute: string): NachfassArt | null {
  if (m.phase === "abgelaufen") return "abgelaufen";
  if (m.phase !== "angebot") return null;
  if (m.gueltigBis && tageZwischen(heute, m.gueltigBis) <= 2) return "laeuft_ab";
  return m.gelesen && m.gelesen.aufrufe > 0 ? "still" : "ungelesen";
}
/** „19. November 2026“ */
export function tagLang(tag: string | null | undefined): string {
  if (!istTag(tag)) return "";
  const x = new Date(alsUtc(tag));
  return `${x.getUTCDate()}. ${MONATE[x.getUTCMonth()]} ${x.getUTCFullYear()}`;
}
/** „Guten Tag Herr Beispiel,“ — ohne Anrede oder Nachnamen bleibt es bei „Guten Tag,“. */
export function nachfassAnrede(k: { anrede?: unknown; nachname?: unknown } | null | undefined): string {
  const a = text(k?.anrede).trim(); const n = text(k?.nachname).trim();
  return (a === "Herr" || a === "Frau") && n ? `Guten Tag ${a} ${n},` : "Guten Tag,";
}
export interface NachfassMail { art: NachfassArt; betreff: string; anrede: string; absaetze: string[]; frage: string; gruss: string }
export function nachfassMail(e: { art: NachfassArt; anrede: string; link: string | null; gueltigBis: string | null }): NachfassMail {
  const bis = tagLang(e.gueltigBis);
  const gilt = bis ? `Es gilt bis einschließlich ${bis}.` : "";
  const basis = { art: e.art, betreff: "Ihr persönliches Angebot – FIAON Global", anrede: e.anrede, gruss: "Viele Grüße" };
  if (e.art === "ungelesen") {
    return { ...basis, absaetze: [
      "ich möchte kurz sichergehen, dass mein Angebot bei Ihnen angekommen ist – solche Mails landen manchmal im Spam-Ordner.",
      ...(e.link ? [`Hier finden Sie es noch einmal: ${e.link}`] : []),
      ...(gilt ? [gilt] : []),
    ], frage: "Haben Sie Fragen dazu? Antworten Sie gern einfach auf diese Mail." };
  }
  if (e.art === "still") {
    return { ...basis, absaetze: [
      "ich melde mich kurz zu Ihrem Angebot.",
      "Wenn noch etwas offen ist – zu den Schritten, zum Zeitplan oder zu den Kosten –, klären wir das gern in einem kurzen Telefonat.",
      ...(e.link ? [`Ihr Angebot finden Sie hier: ${e.link}`] : []),
      ...(gilt ? [gilt] : []),
    ], frage: "Wann passt es Ihnen in den nächsten Tagen?" };
  }
  if (e.art === "laeuft_ab") {
    return { ...basis, absaetze: [
      bis ? `Ihr Angebot gilt noch bis einschließlich ${bis}.` : "Ihr Angebot gilt nur noch kurze Zeit.",
      ...(e.link ? [`Wenn Sie starten möchten, nehmen Sie es direkt online an: ${e.link}`] : []),
      "Brauchen Sie etwas mehr Zeit, geben Sie mir kurz Bescheid – dann verlängere ich es gern.",
    ], frage: "Kann ich vorher noch eine Frage für Sie klären?" };
  }
  return { ...basis, absaetze: [
    bis ? `Ihr Angebot ist am ${bis} ausgelaufen.` : "Ihr Angebot ist ausgelaufen.",
    "Wenn Ihr Vorhaben weiter aktuell ist, stelle ich es Ihnen gern noch einmal bereit.",
  ], frage: "Soll ich das für Sie tun?" };
}
/** Die Mail als reiner Text (ohne Signatur) — für die Vorschau und für die Wortwand. */
export function nachfassText(m: NachfassMail): string {
  return [m.anrede, ...m.absaetze, m.frage, m.gruss].join("\n\n");
}

// ── Wir warten auf ───────────────────────────────────────────────────────────
export interface LageWartet {
  schluessel: string;
  /** kunde · amt · partner (Aufgabe aus dem Partner-CRM) · wiedervorlage (eigene, aus der Global-Lage) */
  art: "kunde" | "amt" | "partner" | "wiedervorlage";
  wer: string; worauf: string; seit: string | null; bis: string | null; ueberfaellig: boolean;
  ziel: string | null; mandant: string | null; notizId: number | null;
}
export interface LagePartnerAufgabe { id: number; firmaId: number; firma: string; titel: string; faelligAm: string | null; angelegtAm: string }
export interface LageWiedervorlage { id: number; bezugArt: LageBezug; bezugId: string; name: string; am: string; text: string | null; notiz: string | null; angelegtAm: string }
/** Wie weit im Voraus Partner-Aufgaben in „Wir warten auf“ erscheinen. */
export const LAGE_WARTET_VORAUS_TAGE = 7;

/** Partner-Aufgaben stehen für sich: fällige zuerst (die jüngste oben), dann die kommenden. */
export interface LagePartnerBlock { gesamt: number; ueberfaellig: number; liste: LageWartet[] }
export const LAGE_PARTNER_ZEILEN = 8;

export function wartetBauen(m: LageMandant[], aufgaben: LagePartnerAufgabe[], wv: LageWiedervorlage[], heute: string, ziel: (x: { mandant?: LageMandant; partnerId?: number; bezug?: { art: LageBezug; id: string } }) => string | null): { wartet: LageWartet[]; partner: LagePartnerBlock } {
  const aus: LageWartet[] = []; const partner: LageWartet[] = [];
  for (const x of m) {
    if (x.schritt.ton !== "kunde" && x.schritt.ton !== "amt") continue;
    aus.push({ schluessel: `m:${x.schluessel}`, art: x.schritt.ton, wer: x.name, worauf: x.schritt.schritt, seit: x.schritt.seit, bis: x.schritt.bis, ueberfaellig: x.schritt.ueberfaellig, ziel: ziel({ mandant: x }), mandant: x.schluessel, notizId: null });
  }
  const grenze = tagPlus(heute, LAGE_WARTET_VORAUS_TAGE);
  for (const a of aufgaben) {
    if (!a.faelligAm || a.faelligAm > grenze) continue;
    partner.push({ schluessel: `p:${a.id}`, art: "partner", wer: a.firma, worauf: a.titel, seit: a.angelegtAm, bis: a.faelligAm, ueberfaellig: a.faelligAm < heute, ziel: ziel({ partnerId: a.firmaId }), mandant: null, notizId: null });
  }
  for (const w of wv) {
    const mandant = w.bezugArt === "angebot" ? `angebot:${w.bezugId}` : w.bezugArt === "akte" ? `akte:${w.bezugId}` : null;
    aus.push({ schluessel: `w:${w.id}`, art: "wiedervorlage", wer: w.name, worauf: w.text || kurzText(w.notiz, 120) || "Wiedervorlage", seit: w.angelegtAm, bis: w.am, ueberfaellig: w.am < heute, ziel: ziel({ bezug: { art: w.bezugArt, id: w.bezugId } }), mandant, notizId: w.id });
  }
  const rang = { wiedervorlage: 0, kunde: 1, amt: 2, partner: 3 } as const;
  aus.sort((a, b) => Number(b.ueberfaellig) - Number(a.ueberfaellig)
    || (a.bis ?? "9999").localeCompare(b.bis ?? "9999") || rang[a.art] - rang[b.art] || a.wer.localeCompare(b.wer, "de"));
  const kommend = partner.filter((p) => !p.ueberfaellig).sort((a, b) => (a.bis ?? "").localeCompare(b.bis ?? ""));
  const faellig = partner.filter((p) => p.ueberfaellig).sort((a, b) => (b.bis ?? "").localeCompare(a.bis ?? ""));
  // Heute und morgen Fälliges zuerst, dann das zuletzt fällig Gewordene.
  const liste = [...kommend.filter((p) => (p.bis ?? "") <= tagPlus(heute, 1)), ...faellig, ...kommend.filter((p) => (p.bis ?? "") > tagPlus(heute, 1))].slice(0, LAGE_PARTNER_ZEILEN);
  return { wartet: aus, partner: { gesamt: partner.length, ueberfaellig: faellig.length, liste } };
}

// ── Der Feed ─────────────────────────────────────────────────────────────────
export type FeedArt =
  | "anfrage" | "termin" | "gespraech" | "notiz" | "anruf" | "angebot" | "gelesen" | "annahme" | "zahlung"
  | "meilenstein" | "unterlage" | "nachricht" | "antwort" | "mail" | "partner";
export const FEED_ART_NAME: Record<FeedArt, string> = {
  anfrage: "Neue Anfrage", termin: "Termin", gespraech: "Gespräch", notiz: "Notiz", anruf: "Anruf", angebot: "Angebot",
  gelesen: "Angebot gelesen", annahme: "Angenommen", zahlung: "Zahlung", meilenstein: "Meilenstein", unterlage: "Unterlage",
  nachricht: "Nachricht", antwort: "Antwort", mail: "Mail", partner: "Partner",
};
export interface FeedEintrag {
  id: string;
  /** Zeitpunkt (ISO) — nur zum Sortieren; angezeigt werden tag (Berliner Tag) und uhr („14:05“). */
  am: string; tag: string; uhr: string;
  art: FeedArt; wer: string; titel: string; text: string | null; betragCents: number | null; ziel: string | null;
  /** Wichtig (Annahme, Zahlung, Gespräch, Anfrage …) oder leise (Sammelzeilen, Mails, Änderungen). */
  laut: boolean;
}
/** `zahlen` zählt je Art nur die wichtigen (lauten) Einträge. */
export interface FeedTag { tag: string; name: string; eintraege: FeedEintrag[]; zahlen: Partial<Record<FeedArt, number>> }
export interface FeedWoche { montag: string; name: string; tage: FeedTag[]; zahlen: Partial<Record<FeedArt, number>>; zahlungCents: number; istDieseWoche: boolean; vorher: string; nachher: string | null }

/** Die Arten, die die Wochenzeile zählt — in dieser Reihenfolge. */
export const FEED_WOCHE_ZAEHLT: FeedArt[] = ["anfrage", "gespraech", "angebot", "gelesen", "annahme", "zahlung", "unterlage"];

export function feedOrdnen(eintraege: FeedEintrag[], montag: string, heute: string): FeedWoche {
  const tage = wochenTage(montag, heute);
  const nachTag = new Map<string, FeedEintrag[]>(tage.map((t) => [t, []]));
  for (const e of eintraege) nachTag.get(e.tag)?.push(e);
  // Gezählt wird nur das Wichtige: Sammelzeilen, Automatik-Mails und bloße Änderungen blähen keine Zahl auf.
  const zaehlen = (liste: FeedEintrag[]) => {
    const z: Partial<Record<FeedArt, number>> = {};
    for (const e of liste) if (e.laut) z[e.art] = (z[e.art] ?? 0) + 1;
    return z;
  };
  const feedTage: FeedTag[] = tage.map((t) => {
    const liste = (nachTag.get(t) ?? []).sort((a, b) => b.am.localeCompare(a.am) || a.id.localeCompare(b.id));
    return { tag: t, name: tagName(t, heute), eintraege: liste, zahlen: zaehlen(liste) };
  });
  const alle = feedTage.flatMap((t) => t.eintraege);
  const dieseWoche = wocheMontag(heute) === montag;
  return {
    montag, name: wocheName(montag), tage: feedTage, zahlen: zaehlen(alle),
    zahlungCents: alle.filter((e) => e.art === "zahlung").reduce((s, e) => s + (e.betragCents ?? 0), 0),
    istDieseWoche: dieseWoche, vorher: tagPlus(montag, -7), nachher: dieseWoche ? null : tagPlus(montag, 7),
  };
}

/** Welche Woche zeigt die Lage? `roh` = irgendein Tag (aus der Adresse); Zukunft und Unsinn → diese Woche. */
export function wocheWaehlen(roh: unknown, heute: string): string {
  const dieser = wocheMontag(heute);
  if (!istTag(roh)) return dieser;
  const m = wocheMontag(roh);
  return m > dieser ? dieser : m;
}

// ── Die Antwort des Servers ──────────────────────────────────────────────────
export interface LageTermin { id: number; tag: string; uhr: string; name: string; mit: string | null; thema: string | null; ziel: string | null }
export interface LageNotizZeile { id: number; am: string; tag: string; uhr: string; art: string; text: string; von: string | null; wiedervorlageAm: string | null; wiedervorlageText: string | null; erledigt: boolean }
export interface LageAntwort {
  ok: true; stand: string; heute: string;
  stufe: "inhaber" | "geschaeftsfuehrung" | "leitung";
  auftragswert: LageAuftragswert;
  /** Nur ab Geschäftsführung; sonst null. */
  fixkosten: LageFixkosten | null;
  wartet: LageWartet[];
  /** Fällige Aufgaben aus dem Partner-CRM — eigene Gruppe, damit sie die Mandanten nicht zudecken. */
  partner: LagePartnerBlock;
  mandanten: (LageMandant & { ziele: { akte: string | null; angebot: string | null }; notizen: LageNotizZeile[]; nachfass: NachfassArt | null })[];
  termine: LageTermin[];
  woche: FeedWoche;
  /** Teile, die sich gerade nicht lesen ließen — die Seite sagt es ehrlich, statt eine Null zu zeigen. */
  luecken: string[];
}
