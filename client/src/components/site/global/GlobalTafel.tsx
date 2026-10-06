// ═══════════════════════════════════════════════════════════════════════════
// DIE PAKETTAFEL — HERAUSGELÖST AUS /business (06.10.2026, E-293)
//
// Die Tafel ist abgenommen (E-197): Überzeile, Name, Etappen-Balken, Kapital-
// rahmen und Festpreis nebeneinander — jede Zahl mit ihrem Satz (Blickfang-
// Regel, BGH I ZR 129/13) —, Knopf vor der Liste, lange Liste aufklappbar.
// Global VIP steht als die EINE Navy-Glas-Fläche darunter (GlobalVip.tsx).
// Herausgelöst, damit die 25 Pakettafeln der Unterseiten (Scheibe D) dieselbe
// Komponente nutzen. Neu am 06.10.: die Zeile „für wen“ ist nicht mehr sichtbar
// (die Wegleiste über den Tafeln sagt es), der Pflichtsatz „Ihr Ziel — über den
// Rahmen entscheidet das Institut“ steht auf JEDER Tafel, „Alle N Leistungen“
// zählt alle Leistungen des Pakets. Beträge zählen nie hoch.
// ═══════════════════════════════════════════════════════════════════════════
import { useState, type ReactNode } from "react";
import type { GLOBAL_WOERTER } from "@/i18n/global";
import { GLOBAL_PAKETE, globalKapital, globalPreisText, type GlobalPaket, type GlobalSchluessel } from "@shared/fiaon-global";
import { GlobalVipBuehne, GlobalVipTicket } from "@/components/site/GlobalVip";
import { mitBegriffen } from "@/components/site/global/Begriff";

const ROEMISCH = ["I", "II", "III", "IV"];
type Texte = typeof GLOBAL_WOERTER.de;

// ── Eine Quelle für Etappen und Reihenfolge der Leistungen (06.10.2026, E-293) ──
// /business (pages/site/business.tsx) und die Unterseiten (global-seite/SeitenBausteine.tsx) lesen beide von hier:
// Dieselbe Tafel muss überall dasselbe sagen — dieselben Etappen, dieselben Leistungen vor „Alle N Leistungen“.
/** Ab welchem Paket eine Etappe des Wegs enthalten ist — deckungsgleich mit GLOBAL_VERGLEICH. */
export const TAFEL_ETAPPE_AB: readonly GlobalSchluessel[] = ["global_struktur", "global_struktur", "global_banking", "global_kapital"];
/** Bis zu welcher Etappe (1–4) ein Paket begleitet — aus TAFEL_ETAPPE_AB, also deckungsgleich mit dem Weg. */
export const tafelEtappenBis = (k: GlobalSchluessel) => {
  const i = GLOBAL_PAKETE.findIndex((p) => p.key === k);
  return TAFEL_ETAPPE_AB.filter((ab) => GLOBAL_PAKETE.findIndex((p) => p.key === ab) <= i).length;
};
/** Je Tafel die eigenen Leistungen, die vor „Alle N Leistungen“ stehen. Global Struktur: Gründung, EIN/ITIN, erster
 *  Konto- und Kartenantrag (drei statt vier); VIP: die Termine vor Ort. */
export const TAFEL_ZUERST: Readonly<Record<GlobalSchluessel, readonly number[]>> = {
  global_struktur: [0, 1, 6], global_banking: [0, 1], global_kapital: [0, 1], global_vip: [1],
};

export function Haken({ groesse = 16 }: { groesse?: number }) {
  return (
    <svg className="fg-haken" width={groesse} height={groesse} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="7.25" stroke="currentColor" strokeOpacity=".28" strokeWidth="1" />
      <path d="M4.8 8.2l2.1 2.1 4.3-4.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function Pfeil() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}
function Plus() {
  return <svg className="fg-plus" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
}
function Winkel({ offen }: { offen: boolean }) {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: offen ? "rotate(180deg)" : undefined, transition: "transform .25s" }}><path d="m6 9 6 6 6-6" /></svg>;
}
/** Der Funke am VIP-Zeichen und am Band der Tafel „Alle vier Etappen“. */
function Funke() {
  return <svg className="fg-funke" width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5l2.6 7.9 7.9 2.6-7.9 2.6L12 22.5l-2.6-7.9L1.5 12l7.9-2.6z" fill="currentColor" /></svg>;
}

export default function GlobalTafel({ p, s, t, bis, zuerst, fokus = false, gewaehlt = false, startHref, onBeauftragen, onGespraech, begriffe = [] }: {
  p: GlobalPaket;
  s: "de" | "en";
  t: Texte;
  /** Bis zu welcher Etappe (1–4) das Paket begleitet. */
  bis: number;
  /** Welche eigenen Leistungen (ohne „Alles aus …“) zuerst stehen — der Rest hinter „Alle N Leistungen“. */
  zuerst: readonly number[];
  /** Die Tafel mit dem Band „Alle vier Etappen“. */
  fokus?: boolean;
  gewaehlt?: boolean;
  startHref: string;
  onBeauftragen: () => void;
  onGespraech: () => void;
  begriffe?: { wort: string; erklaerung: string }[];
}) {
  const [alle, setAlle] = useState(false);
  const w = p[s];
  const kapital = globalKapital(p.key, s);
  const vip = p.key === "global_vip";
  // Ab dem zweiten Paket ist der erste Punkt „Alles aus …" — er steht als eigene Zeile über der Liste.
  const erbe = w.leistungen[0].match(/^(Alles aus|Everything in) /) ? w.leistungen[0] : null;
  const eigene = erbe ? w.leistungen.slice(1) : w.leistungen;
  const zuerstIdx = zuerst.filter((j) => j < eigene.length);
  const danach = eigene.filter((_, j) => !zuerstIdx.includes(j));
  const sichtbar = alle ? eigene : zuerstIdx.map((j) => eigene[j]);
  const klasse = `fg-tarif${fokus ? " fokus" : ""}${vip ? " vip" : ""}${gewaehlt ? " gewaehlt" : ""}`;
  // „Kapitalrahmen bis zu" nur an der VIP-Zahl — zusammengesetzt aus globalKapital (die eine erlaubte Stelle, E-190).
  const kapitalZeile = kapital.bisZu ? `${t.planung} ${kapital.bisZu}` : t.planung;
  const listeId = `leistungen-${p.key}`;

  // Die volle Dauer („Begleitung in der Regel rund acht Wochen“) statt der Kurzform: „Etappen I–II · rund acht
  // Wochen“ las sich wie eine Frist bis zur ersten Firmenkarte — über die entscheidet das Institut, und die Wand
  // fängt ausgeschriebene Zahlen nicht (06.10.2026, E-293, Rechtsgutachten).
  const weg = (
    <div className="fg-tarif-weg">
      <span className="balken" aria-hidden="true">{ROEMISCH.map((r, j) => <i key={r} className={j < bis ? "an" : undefined} />)}</span>
      <span className="text">{t.etappenBis(ROEMISCH[bis - 1])} · {w.dauer}</span>
    </div>
  );
  const liste: ReactNode = (
    <>
      {erbe && <p className="fg-tarif-erbe"><Plus />{erbe}</p>}
      <ul id={listeId}>{sichtbar.map((x) => <li key={x} className={alle && !zuerstIdx.map((j) => eigene[j]).includes(x) ? "neu" : undefined}><Haken />{x}</li>)}</ul>
      {danach.length > 0 && (
        <button type="button" className="fg-tarif-mehr" aria-expanded={alle} aria-controls={listeId} onClick={() => setAlle(!alle)}>
          {alle ? t.wenigerLeistungen : t.alleLeistungen(w.leistungen.length)}<Winkel offen={alle} />
        </button>
      )}
    </>
  );

  if (vip) {
    return (
      <GlobalVipBuehne id={`paket-${p.key}`} className={klasse} label={w.name}>
        <div className="fg-vip-text">
          <div className="fg-vip-zeile"><span className="fg-vip-zeichen"><Funke />{t.vipZeichen}</span><span className="marke">{w.marke}</span></div>
          <h3>{w.name}</h3>
          {weg}
          <div className="fg-vip-kapital">
            <span>{mitBegriffen(kapitalZeile, begriffe)}</span>
            <b className="fg-glanz">{kapital.wert}</b>
            <em>{t.planungZusatz}</em>
          </div>
          <div className="fg-vip-liste">{liste}</div>
        </div>
        <div className="fg-vip-seite">
          <GlobalVipTicket texte={t.vipTicket} />
          <div className="fg-vip-preis">
            <div><span>{t.festpreis}</span><b className="fg-glanz">{globalPreisText(p.key, s)}</b></div>
            <span className="inkl"><Haken groesse={13} />{t.inklusive}</span>
          </div>
          {/* Global VIP beginnt mit einem Gespräch — für 35.999 € kauft niemand ohne. */}
          <div className="tun">
            <button type="button" className="fg-knopf voll" aria-label={t.vipGespraech(w.name)} onClick={onGespraech}>{t.vipGespraechKurz}<Pfeil /></button>
            <a className="fg-textknopf" href={startHref} onClick={onBeauftragen}>{t.direktBeauftragen}</a>
          </div>
        </div>
      </GlobalVipBuehne>
    );
  }

  return (
    <article id={`paket-${p.key}`} className={klasse} aria-label={w.name}>
      {fokus && <span className="fg-tarif-band"><Funke />{t.fokusBand}</span>}
      <div className="fg-tarif-kopf">
        <span className="marke">{w.marke}</span>
        <h3>{w.name}</h3>
      </div>
      {weg}
      <div className="fg-tarif-zahlen">
        <div>
          <span>{mitBegriffen(kapitalZeile, begriffe)}</span>
          <b className="fg-glanz">{kapital.wert}</b>
          <em>{t.planungZusatz}</em>
        </div>
        <div>
          <span>{t.festpreisKurz}</span>
          <b className="fg-glanz">{globalPreisText(p.key, s)}</b>
          <em className="inkl"><Haken groesse={12} />{t.einmaligInklusive}</em>
        </div>
      </div>
      <div className="tun">
        <a className={`fg-knopf voll${fokus ? "" : " hell"}`} href={startHref} aria-label={t.beauftragen(w.name)} onClick={onBeauftragen}>
          {t.beauftragenKurz}<Pfeil />
        </a>
        <button type="button" className="fg-textknopf" onClick={onGespraech}>{t.erstSprechen}</button>
      </div>
      <div className="fg-tarif-leistungen">{liste}</div>
    </article>
  );
}
