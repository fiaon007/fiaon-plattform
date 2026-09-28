// ═══════════════════════════════════════════════════════════════════════════
// DIE LAGE DES MARA-STEUERPULTS (E-252, 28.09.2026)
//
// Justin (E-250, freigegeben 28.09.2026 „Go, 1 ja, 2 ja, 3 ja"): über den
// Reitern eine Verkaufsleiste — Geld nach Mara und je Weg, ob er läuft. Dafür
// braucht die Wurzel dieselben Daten wie die Reiter. Vorher lud jeder Reiter
// für sich und nur einmal: Die WhatsApp-Lage wurde nie nachgeladen, während
// das Protokoll darunter jede Minute frisch war (Befund 15). Jetzt holt die
// Wurzel jede Quelle EINMAL, Leiste und Reiter lesen dieselbe Instanz. Takt je
// Quelle (offener Reiter 1 Min., Aufträge 2 Min., Rest 5 Min.), nur bei
// sichtbarem Tab — Einzelheiten beim Takt unten.
//
// ── SCHNITTSTELLE (auch in scratchpad/e252/schnittstelle.md) ──────────────
//
//   <MaraLage>…</MaraLage>            Wurzel (ChefMara). Hält fünf Quellen,
//                                     den Reiter und die Sprünge.
//
//   useMaraDaten<T>(schluessel, url)  → { daten, laedt, fehler, neu, geladenAm }
//       schluessel  url (muss genau so lauten, sonst eigene Instanz)
//       "lage"      "/chef/wa-zentrale/lage"
//       "stand"     "/chef/mara/stand"
//       "auskunft"  "/chef/auskunft"
//       "bilanz"    "/chef/mara/bilanz"
//       "auftraege" "/chef/mara/auftraege"
//     Im Steuerpult: die Instanz der Wurzel. Außerhalb (z. B. eine Seite, die
//     dieselbe Komponente allein zeigt): eine eigene useDaten-Instanz — die
//     Hook-Regel bleibt gewahrt, weil immer dieselben Haken laufen.
//     `neu()` lädt sofort nur diese Quelle neu (nach jeder Aktion aufrufen,
//     damit die Leiste folgt). `neu` ist stabil. `daten` behält beim Neuladen
//     den alten Stand (kein Gerüst-Flackern) und ist nach jedem Laden ein
//     NEUES Objekt — ein Effekt mit [daten] läuft also jede Minute.
//
//   useMaraLage()     → der ganze Kontext oder null (außerhalb):
//       reiter, ansicht, wechseln(reiter, ansicht?), alleNeu(),
//       zeigen(selektor, { reiter?, ansicht?, hervor?, block? }),
//       zumSchalter(weg), gruppeWunsch, gruppeWuenschen(gruppe),
//       rundgangStart (Ref)
//   useMaraRundgang() → { knopf: "keiner", startRef } im Steuerpult, sonst {}
//                       — als Spread an <Rundgang … {...rg} /> geben.
//   useMeldung() + <Meldung m ort onZu />  Rückmeldung am Auslöser, im Fluss.
//   <InfoKnopf offen onClick label />      der (i)-Knopf (Text klappt im Fluss auf).
//   Hilfen: berlinTag, tagNur, uhrBerlin, tagZeitBerlin, wannWieder,
//           naechsteGruppe (nächster Schritt WhatsApp), betragTextCents.
//
// Sprungziele: Jeder Reiter trägt an seinem Hauptschalter
//   data-mara-schalter="whatsapp" | "mail" | "auskunft"
// — die Zellen der Leiste springen dorthin und heben ihn kurz hervor.
// ═══════════════════════════════════════════════════════════════════════════
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type MutableRefObject, type ReactNode,
} from "react";
import { useDaten, ruhig } from "./chef-teile";

// ── Quellen ────────────────────────────────────────────────────────────────
export type MaraQuelle = "lage" | "stand" | "auskunft" | "bilanz" | "auftraege";
export const MARA_QUELLEN: Record<MaraQuelle, string> = {
  lage: "/chef/wa-zentrale/lage",
  stand: "/chef/mara/stand",
  auskunft: "/chef/auskunft",
  bilanz: "/chef/mara/bilanz",
  auftraege: "/chef/mara/auftraege",
};
const ALLE_QUELLEN = Object.keys(MARA_QUELLEN) as MaraQuelle[];

/** Dieselbe Form wie useDaten, dazu der Zeitpunkt des letzten erfolgreichen Ladens. */
export interface MaraGeladen<T> {
  daten: T | null; laedt: boolean; fehler: string | null; neu: () => void;
  /** Wann `daten` zuletzt vom Server kam (ms seit 1970) — für „Stand 12:04". */
  geladenAm: number | null;
}

// ── Reiter, Wege, Sprünge ──────────────────────────────────────────────────
export type MaraReiter = "whatsapp" | "mail" | "auskunft";
export type AuskunftAnsicht = "verkauf" | "beschaffung";
/** Die drei Wege der Leiste — je einer mit Hauptschalter. */
export type MaraWeg = "whatsapp" | "mail" | "auskunft";
/**
 * Der Hauptschalter je Weg. Die Reiter setzen `data-mara-schalter`; die
 * Klassen dahinter treffen den heutigen Stand, solange ein Reiter das
 * Kennzeichen noch nicht trägt.
 */
export const MARA_SCHALTER: Record<MaraWeg, string> = {
  whatsapp: '[data-mara-schalter="whatsapp"], .wz-automatik .wz-schalter',
  mail: '[data-mara-schalter="mail"], .mp-aktion-schalter',
  auskunft: '[data-mara-schalter="auskunft"], .ak-schalter',
};

interface ZeigenOptionen { reiter?: MaraReiter; ansicht?: AuskunftAnsicht; hervor?: boolean; block?: ScrollLogicalPosition }

export interface MaraLageWert {
  quellen: Record<MaraQuelle, MaraGeladen<unknown>>;
  /** Alle fünf Quellen sofort neu. */
  alleNeu: () => void;
  reiter: MaraReiter;
  ansicht: AuskunftAnsicht;
  wechseln: (reiter: MaraReiter, ansicht?: AuskunftAnsicht) => void;
  /** Reiter setzen, auf das Element warten (bis 4 s), hinrollen, auf Wunsch kurz hervorheben. */
  zeigen: (selektor: string, optionen?: ZeigenOptionen) => void;
  zumSchalter: (weg: MaraWeg) => void;
  /** Ein Wunsch an die WhatsApp-Zentrale: diese Gruppe wählen. `nr` ändert sich bei jedem Wunsch. */
  gruppeWunsch: { gruppe: string; nr: number } | null;
  gruppeWuenschen: (gruppe: string) => void;
  /** Hier legt der Rundgang des sichtbaren Reiters seine Startfunktion ab (Rundgang.tsx, startRef). */
  rundgangStart: MutableRefObject<(() => void) | null>;
}

const Kontext = createContext<MaraLageWert | null>(null);

/** Reiter und Ansicht aus der Adresse: ?reiter=mail|auskunft, &ansicht=beschaffung (E-229, E-243). */
function ausAdresse(): { reiter: MaraReiter; ansicht: AuskunftAnsicht } {
  try {
    const q = new URLSearchParams(window.location.search);
    const r = q.get("reiter");
    return {
      reiter: r === "mail" ? "mail" : r === "auskunft" ? "auskunft" : "whatsapp",
      ansicht: q.get("ansicht") === "beschaffung" ? "beschaffung" : "verkauf",
    };
  } catch { return { reiter: "whatsapp", ansicht: "verkauf" }; }
}

export function MaraLage({ children }: { children: ReactNode }) {
  // Fünf Quellen, je einmal. Die Reihenfolge der Haken ist fest.
  const lage = useDaten<unknown>(MARA_QUELLEN.lage);
  const stand = useDaten<unknown>(MARA_QUELLEN.stand);
  const auskunft = useDaten<unknown>(MARA_QUELLEN.auskunft);
  const bilanz = useDaten<unknown>(MARA_QUELLEN.bilanz);
  const auftraege = useDaten<unknown>(MARA_QUELLEN.auftraege);
  const roh = { lage, stand, auskunft, bilanz, auftraege };
  const rohRef = useRef(roh);
  rohRef.current = roh;

  // Wann jede Quelle zuletzt Daten brachte — useDaten merkt sich das nicht.
  const [geladenAm, setGeladenAm] = useState<Record<MaraQuelle, number | null>>(
    { lage: null, stand: null, auskunft: null, bilanz: null, auftraege: null });
  const merke = (q: MaraQuelle) => setGeladenAm((alt) => ({ ...alt, [q]: Date.now() }));
  useEffect(() => { if (lage.daten) merke("lage"); }, [lage.daten]);
  useEffect(() => { if (stand.daten) merke("stand"); }, [stand.daten]);
  useEffect(() => { if (auskunft.daten) merke("auskunft"); }, [auskunft.daten]);
  useEffect(() => { if (bilanz.daten) merke("bilanz"); }, [bilanz.daten]);
  useEffect(() => { if (auftraege.daten) merke("auftraege"); }, [auftraege.daten]);

  // Stabile neu()-Funktionen: Wer sie in einen Effekt schreibt, löst keine Schleife aus.
  const neuFuer = useMemo(() => {
    const n = {} as Record<MaraQuelle, () => void>;
    for (const q of ALLE_QUELLEN) n[q] = () => rohRef.current[q].neu();
    return n;
  }, []);
  const zuletzt = useRef(Date.now());
  // Wann jede Quelle zuletzt ANGEFORDERT wurde (nicht: Daten brachte) — für den Takt je Quelle.
  const angefordert = useRef<Record<MaraQuelle, number>>(
    { lage: Date.now(), stand: Date.now(), auskunft: Date.now(), bilanz: Date.now(), auftraege: Date.now() });
  const alleNeu = useCallback(() => {
    zuletzt.current = Date.now();
    for (const q of ALLE_QUELLEN) { angefordert.current[q] = Date.now(); rohRef.current[q].neu(); }
  }, []);
  // Der offene Reiter — der Takt liest ihn, ohne neu aufgesetzt zu werden (unten nach „ort“ gesetzt).
  const reiterRef = useRef<string>("whatsapp");

  // ── Takt je Quelle, nur bei sichtbarem Tab ──────────────────────────────
  // Ein verdeckter Tab lädt nichts. E-252 nach dem Ausfall vom 28.09.2026
  // (Lesesperren-Stau): gemessen braucht die WhatsApp-Lage ~1,9 s (sechs
  // Gruppenabfragen gleichzeitig), Bilanz und Auskunft je ~0,9 s. Alle fünf
  // jede Minute hätten dauerhaft bis zu sechs der zwölf Verbindungen belegt.
  // Deshalb: die Quelle des OFFENEN Reiters jede Minute (Lage bei WhatsApp,
  // Stand bei Mail, Auskunft bei Auskunft), die Aufträge für den Chip alle
  // 2 Minuten, alles andere alle 5 Minuten — die Leiste oben ist dann höchstens
  // 5 Minuten alt (sie zeigt „Stand …“). Nach jeder eigenen Aktion lädt der
  // Reiter ohnehin sofort neu (neu()).
  useEffect(() => {
    const sichtbar = () => document.visibilityState === "visible";
    const takt = (q: MaraQuelle): number => {
      const r = reiterRef.current;
      if (q === "lage") return r === "whatsapp" ? 60_000 : 300_000;
      if (q === "stand") return r === "mail" ? 60_000 : 300_000;
      if (q === "auskunft") return r === "auskunft" ? 60_000 : 300_000;
      if (q === "auftraege") return 120_000;
      return 300_000; // bilanz — am Server 60 s zwischengespeichert, Geld ändert sich selten
    };
    const faellige = () => {
      if (!sichtbar()) return;
      const jetzt = Date.now();
      for (const q of ALLE_QUELLEN) {
        // 2 s Spielraum gegen das Zittern des Takts.
        if (jetzt - angefordert.current[q] >= takt(q) - 2000) { angefordert.current[q] = jetzt; rohRef.current[q].neu(); }
      }
    };
    const uhr = window.setInterval(faellige, 30_000);
    document.addEventListener("visibilitychange", faellige);
    return () => { window.clearInterval(uhr); document.removeEventListener("visibilitychange", faellige); };
  }, []);

  // ── Reiter und Ansicht (mit der Adresse abgeglichen) ───────────────────
  const [ort, setOrt] = useState(ausAdresse);
  reiterRef.current = ort.reiter;
  const wechseln = useCallback((reiter: MaraReiter, ansicht: AuskunftAnsicht = "verkauf") => {
    setOrt({ reiter, ansicht });
    try {
      const u = new URL(window.location.href);
      if (reiter === "whatsapp") u.searchParams.delete("reiter"); else u.searchParams.set("reiter", reiter);
      if (reiter === "auskunft" && ansicht === "beschaffung") u.searchParams.set("ansicht", "beschaffung"); else u.searchParams.delete("ansicht");
      window.history.replaceState(null, "", u.toString());
    } catch { /* Adresse bleibt, der Reiter wechselt trotzdem */ }
  }, []);

  // ── Springen: Reiter setzen, warten, bis das Ziel steht, hinrollen ─────
  // Der Auskunft-Reiter wird erst beim Öffnen geladen — deshalb bis zu 4 s
  // alle 100 ms nachsehen (dasselbe Muster wie der Rundgang).
  const zeigen = useCallback((selektor: string, o: ZeigenOptionen = {}) => {
    if (o.reiter) wechseln(o.reiter, o.ansicht);
    let versuche = 0;
    const suchen = () => {
      const el = document.querySelector(selektor) as HTMLElement | null;
      const r = el?.getBoundingClientRect();
      if (el && r && (r.width > 0 || r.height > 0)) {
        el.scrollIntoView({ block: o.block ?? "center", behavior: ruhig() ? "auto" : "smooth" });
        if (o.hervor) {
          el.classList.add("hervor");
          window.setTimeout(() => el.classList.remove("hervor"), 1600);
          try { el.focus({ preventScroll: true }); } catch { /* nicht fokussierbar — dann nur hervorgehoben */ }
        }
        return;
      }
      if (++versuche < 40) window.setTimeout(suchen, 100);
    };
    window.setTimeout(suchen, 0);
  }, [wechseln]);
  const zumSchalter = useCallback((weg: MaraWeg) => {
    zeigen(MARA_SCHALTER[weg], { reiter: weg, ansicht: weg === "auskunft" ? "verkauf" : undefined, hervor: true });
  }, [zeigen]);

  const [gruppeWunsch, setGruppeWunsch] = useState<{ gruppe: string; nr: number } | null>(null);
  const gruppeWuenschen = useCallback((gruppe: string) => setGruppeWunsch((alt) => ({ gruppe, nr: (alt?.nr ?? 0) + 1 })), []);

  const rundgangStart = useRef<(() => void) | null>(null);

  const quellen = {} as Record<MaraQuelle, MaraGeladen<unknown>>;
  for (const q of ALLE_QUELLEN) {
    const x = roh[q];
    quellen[q] = { daten: x.daten, laedt: x.laedt, fehler: x.fehler, neu: neuFuer[q], geladenAm: geladenAm[q] };
  }
  const wert: MaraLageWert = {
    quellen, alleNeu, reiter: ort.reiter, ansicht: ort.ansicht, wechseln, zeigen, zumSchalter,
    gruppeWunsch, gruppeWuenschen, rundgangStart,
  };
  return <Kontext.Provider value={wert}>{children}</Kontext.Provider>;
}

/** Der ganze Kontext — oder null, wenn die Komponente nicht im Steuerpult steht. */
export function useMaraLage(): MaraLageWert | null {
  return useContext(Kontext);
}

/**
 * Daten einer Quelle: im Steuerpult die Instanz der Wurzel, sonst eine eigene.
 * Immer dieselben Haken in derselben Reihenfolge (useContext, useDaten,
 * useState, useEffect) — nur der Pfad der eigenen Instanz ist dann `null`.
 */
export function useMaraDaten<T>(schluessel: MaraQuelle, url: string): MaraGeladen<T> {
  const ctx = useContext(Kontext);
  const ausKontext = !!ctx && MARA_QUELLEN[schluessel] === url;
  const eigen = useDaten<T>(ausKontext ? null : url);
  const [eigenAm, setEigenAm] = useState<number | null>(null);
  useEffect(() => { if (eigen.daten) setEigenAm(Date.now()); }, [eigen.daten]);
  if (ausKontext) return ctx!.quellen[schluessel] as MaraGeladen<T>;
  return { ...eigen, geladenAm: eigenAm };
}

/** Für <Rundgang {...useMaraRundgang()} />: im Steuerpult ohne festen Knopf, gestartet vom Chip im Kopf. */
export function useMaraRundgang(): { knopf?: "fest" | "keiner"; startRef?: MutableRefObject<(() => void) | null> } {
  const ctx = useContext(Kontext);
  return ctx ? { knopf: "keiner", startRef: ctx.rundgangStart } : {};
}

// ═══════════════════════════════════════════════════════════════════════════
// RÜCKMELDUNG AM AUSLÖSER
// Vorher stand die Meldung fest unten (.mp-meldung) oder als Portal (.ak-meldung)
// — weit weg vom Knopf, und auf dem Handy über dem Inhalt. Jetzt steht sie im
// Block, in dem geklickt wurde. `ort` sagt, welcher Block. Erfolg geht nach
// 7 s; ein Fehler bleibt stehen, bis man ihn schließt oder die nächste Meldung
// kommt (AGENTS.md, Neubau-Checkliste Punkt 4).
// ═══════════════════════════════════════════════════════════════════════════
export type MeldungStand = { text: string; ort: string; fehler: boolean; nr: number } | null;

export function useMeldung() {
  const [meldung, setMeldung] = useState<MeldungStand>(null);
  const uhr = useRef<number | null>(null);
  const melden = useCallback((text: string, ort: string, fehler = false) => {
    if (uhr.current) window.clearTimeout(uhr.current);
    setMeldung((alt) => ({ text, ort, fehler, nr: (alt?.nr ?? 0) + 1 }));
    uhr.current = fehler ? null : window.setTimeout(() => setMeldung(null), 7000);
  }, []);
  const zu = useCallback(() => setMeldung(null), []);
  useEffect(() => () => { if (uhr.current) window.clearTimeout(uhr.current); }, []);
  return { meldung, melden, zu };
}

export function Meldung({ m, ort, onZu }: { m: MeldungStand; ort: string; onZu: () => void }) {
  if (!m || m.ort !== ort) return null;
  return (
    <p className={`mara-meldung${m.fehler ? " fehler" : ""}`} role={m.fehler ? "alert" : "status"}>
      <span>{m.text}</span>
      {m.fehler && <button type="button" className="mara-knopf text" onClick={onZu}>Schließen</button>}
    </p>
  );
}

/** Der Info-Knopf (i): sichtbar 18 px, Tippfläche 32 px (am Handy 36). Der Text klappt im Fluss auf. */
export function InfoKnopf({ offen, onClick, label }: { offen: boolean; onClick: () => void; label: string }) {
  return <button type="button" className="mara-i" aria-expanded={offen} aria-label={label} title={label} onClick={onClick}>i</button>;
}

// ═══════════════════════════════════════════════════════════════════════════
// ZEIT UND NÄCHSTER SCHRITT
// Berliner Zeit immer über formatToParts — nie Number(format()) (das ergibt
// NaN, siehe Zeit-Falle 04.09.2026).
// ═══════════════════════════════════════════════════════════════════════════
const BERLIN_TAG = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" });
const BERLIN_UHR = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const BERLIN_WOCHE = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "short" });
function teile(f: Intl.DateTimeFormat, d: Date): Record<string, string> {
  const t: Record<string, string> = {};
  for (const p of f.formatToParts(d)) t[p.type] = p.value;
  return t;
}

/** Der Berliner Kalendertag als „JJJJ-MM-TT". */
export function berlinTag(d: Date = new Date()): string {
  const t = teile(BERLIN_TAG, d);
  return `${t.year}-${t.month}-${t.day}`;
}
/** „2026-09-26" → „26.09." */
export const tagNur = (iso: string | null | undefined) => (iso && iso.length >= 10 ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.` : "");
/** Uhrzeit in Berlin, „12:04". */
export function uhrBerlin(s: string | number | Date | null | undefined): string {
  if (s == null) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const t = teile(BERLIN_UHR, d);
  return `${t.hour}:${t.minute}`;
}
/** „26.09., 18:46" in Berlin. */
export function tagZeitBerlin(s: string | number | Date | null | undefined): string {
  if (s == null) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return `${tagNur(berlinTag(d))}, ${uhrBerlin(d)}`;
}
/** „jetzt", „heute 14:48", „morgen 09:10" oder „Mi 30.09., 12:00" — Berliner Zeit (wie E-249). */
export function wannWieder(iso: string | null | undefined): string {
  if (!iso) return "bald";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "bald";
  if (d.getTime() <= Date.now()) return "jetzt";
  const tag = berlinTag(d);
  if (tag === berlinTag()) return `heute ${uhrBerlin(d)}`;
  if (tag === berlinTag(new Date(Date.now() + 86_400_000))) return `morgen ${uhrBerlin(d)}`;
  return `${teile(BERLIN_WOCHE, d).weekday} ${tagNur(tag)}, ${uhrBerlin(d)}`;
}

/**
 * „1.234,56 €" → 123456. GET /chef/auskunft liefert je offener Bestellung den
 * Betrag nur als Text (euroText des Servers, Katalogpreis — E-181). Für die
 * Summe „743,00 € offen" (Leiste und Karte „Bestellt, nicht bezahlt") rechnen
 * beide Stellen mit DIESER Funktion, damit dieselbe Summe dasteht.
 */
export function betragTextCents(text: string | null | undefined): number {
  if (!text) return 0;
  const n = Number(String(text).replace(/[^\d,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** Was von der WhatsApp-Lage für Leiste und Kette gebraucht wird. */
export interface GruppeKern { schluessel: string; titel: string; anzahl: number; wartend?: number; wiederAb?: string | null }
export interface LageKern { automatik: { an: boolean; jeStunde: number; gruppen: string[] }; gruppen: GruppeKern[] }

/**
 * Der nächste Schritt, solange WhatsApp kein Geld gebracht hat: die erste
 * Gruppe im Vorrang der Automatik, in der jemand dran ist oder in der
 * Angeschriebene bald wieder dran sind; danach die übrigen Gruppen.
 * EINE Regel für die Leiste und die Kette im WhatsApp-Reiter (Bauplan § 4).
 */
export function naechsteGruppe(l: LageKern | null | undefined): GruppeKern | null {
  if (!l?.gruppen?.length) return null;
  const vorrang = l.automatik?.gruppen ?? [];
  const reihe = [
    ...vorrang.map((s) => l.gruppen.find((g) => g.schluessel === s)).filter((g): g is GruppeKern => !!g),
    ...l.gruppen.filter((g) => !vorrang.includes(g.schluessel)),
  ];
  return reihe.find((g) => g.anzahl > 0 || (!!g.wartend && g.wartend > 0 && !!g.wiederAb)) ?? null;
}
