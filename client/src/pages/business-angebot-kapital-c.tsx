// ═══════════════════════════════════════════════════════════════════════════
// /business/angebot/:token — DAS KAPITAL-ANGEBOT, FASSUNG C (PRIVATPERSONEN), Register E-432
//
// Verzweigung: business-angebot.tsx zeigt diese Seite, wenn die Kundensicht art „kapital“, variante „privat“ und status „offen“
// trägt (lazy, eigener Chunk). Angenommene Angebote nutzen die gemeinsame Ansicht „fertig“.
// Justin (27.10.2026): „nur noch Laufzeit, Name und Unterschrift … es muss sich perfekt anfühlen.“
// Reihenfolge: Willkommen · Ihre Finanzierung (Betrag groß, Eckdaten, Garantie) · Ihre Konditionen · Laufzeit-Rechner (die EINE
// Navy-Stelle) · Name der Gesellschaft mit Live-Urkunde · Ihr Paket (klickbare Kacheln) · Ihr Weg · Ihre Investition (offen,
// ruhig) · Ihre Unterlagen liegen vor · Fragen · Ansprechpartner · Vertrag, Widerruf, Informationen · Auftrag erteilen.
// Inhalte aus KapitalCKundenSicht (shared/fiaon-global-angebot-kapital-c.ts); die Rate rechnet dieselbe reine Funktion wie
// Vertrag und Server (kapitalCPlan). Hart im Client stehen nur Bedienbeschriftungen. CI Glasblau, kein Gold (.gak/.gkp/.gkc).
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ANGEBOT_AUFRUF_HINWEIS } from "@shared/fiaon-global-angebot";
import { llcVollname, llcNameFehler, type BegleitLlcWahl } from "@shared/fiaon-global-angebot-begleit";
import { globalWiderrufsbelehrung } from "@shared/fiaon-global-widerruf";
import {
  kapitalCPlan, kapitalCLaufzeiten, kapitalCEurCent, kapitalCUsd, kapitalCProzent, kapitalCLaufzeitZeile, KAPITAL_C_LAUFZEIT_LABEL,
  type KapitalCKundenSicht, type KapitalCAnnahmeEingabe, type KapitalCPaketKachel,
} from "@shared/fiaon-global-angebot-kapital-c";
import Glueckwunsch from "@/components/angebot-firma/Glueckwunsch";
import PhasenZeitstrahl from "@/components/angebot-firma/PhasenZeitstrahl";
import FragenAntworten from "@/components/angebot-firma/FragenAntworten";
import VertragsLeser from "@/components/angebot-firma/VertragsLeser";
import UnterschriftFeld, { type UnterschriftStand } from "@/components/angebot-firma/UnterschriftFeld";
import { Auf, MarkeGlobal, Mehr, Zeichen, ruhig, tagDe } from "@/components/angebot-firma/gemeinsam";
import "@/styles/global-angebot-firma.css";
import "@/styles/global-angebot-begleit.css";
import "@/styles/global-angebot-koop.css";
import "@/styles/global-angebot-kapital.css";
import "@/styles/global-angebot-kapital-c.css";

const WORTE = {
  seitenTitel: "Ihr persönliches Angebot · FIAON Global",
  angebot: "Angebot", gueltig: "gültig bis",
  vertragPdf: "Vertrag mit Widerrufsbelehrung (PDF)",
  vorschau: "Vorschau der Leitung.", vorschauSatz: "Annehmen kann nur der Kunde — aus dem Chefbüro heraus ist der Knopf gesperrt.", fehlt: "Für die Annahme fehlt noch:",
  impressum: "Impressum", datenschutz: "Datenschutzerklärung",
  fehltTitel: "Bitte noch ergänzen:", sendet: "Wird gespeichert …", neuLaden: "Angebot neu laden",
  geaendert: "Das Angebot wurde inzwischen aktualisiert. Bitte laden Sie es neu und prüfen Sie es noch einmal.",
  allgemein: "Der Auftrag ließ sich gerade nicht speichern. Bitte versuchen Sie es noch einmal.",
  netz: "Keine Verbindung — Ihr Auftrag ist NICHT angekommen. Bitte versuchen Sie es noch einmal.",
  vorschauKnopf: "Vorschau der Leitung — annehmen kann nur der Kunde.",
  heuteZusammen: "zusammen", infoKnopf: "Informationen lesen", infoZu: "Informationen schließen", widerrufZu: "Belehrung schließen",
};

function useSeitenRahmen(titel: string) {
  useEffect(() => {
    const vorher = document.title;
    document.title = titel;
    let robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const neu = !robots;
    if (!robots) { robots = document.createElement("meta"); robots.name = "robots"; document.head.appendChild(robots); }
    const robotsVorher = robots.content;
    robots.content = "noindex, nofollow";
    document.documentElement.classList.add("fg-dokument", "gaf-seite");
    window.scrollTo(0, 0);
    return () => {
      document.title = vorher;
      if (neu) robots!.remove(); else robots!.content = robotsVorher;
      document.documentElement.classList.remove("fg-dokument", "gaf-seite");
    };
  }, [titel]);
}

function Kopf({ titel, sub, auge }: { titel: string; sub?: string; auge?: string }) {
  return (
    <Auf className="gaf-kopf">
      {auge && <p className="gaf-auge">{auge}</p>}
      <h2 className="gaf-h2">{titel}</h2>
      {sub && <p className="gaf-sub">{sub}</p>}
    </Auf>
  );
}

const springen = (id: string, mitte = true) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ block: mitte ? "center" : "start", behavior: ruhig() ? "auto" : "smooth" });
  const feld = el.querySelector<HTMLElement>("input, canvas, button") ?? el;
  window.setTimeout(() => feld.focus({ preventScroll: true }), ruhig() ? 0 : 350);
};

/** Der Betrag zählt beim ersten Sichtkontakt hoch (ruhig: sofort der Endwert). */
function Zaehler({ text }: { text: string }) {
  const m = text.match(/^([\d.]+)(.*)$/);
  const ziel = m ? Number(m[1].replace(/\./g, "")) : 0;
  const rest = m ? m[2] : "";
  const [wert, setWert] = useState(ruhig() || !ziel ? ziel : 0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (ruhig() || !ziel || !ref.current) return;
    let start = 0; let raf = 0;
    const lauf = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / 1600);
      setWert(Math.round(ziel * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(lauf);
    };
    const io = new IntersectionObserver((e) => { if (e[0]?.isIntersecting) { raf = requestAnimationFrame(lauf); io.disconnect(); } }, { threshold: 0.4 });
    io.observe(ref.current);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [ziel]);
  if (!m) return <span>{text}</span>;
  return <span ref={ref}>{wert.toLocaleString("de-DE")}{rest}</span>;
}

/** Die Monatsrate gleitet zum neuen Wert (ruhig: springt). Ganze Euro groß, Cent klein. */
function RateBetrag({ cents }: { cents: number }) {
  const [wert, setWert] = useState(cents);
  const vorher = useRef(cents);
  useEffect(() => {
    if (ruhig() || vorher.current === cents) { setWert(cents); vorher.current = cents; return; }
    const von = vorher.current; let start = 0; let raf = 0;
    const lauf = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / 520);
      setWert(Math.round(von + (cents - von) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(lauf); else vorher.current = cents;
    };
    raf = requestAnimationFrame(lauf);
    return () => { cancelAnimationFrame(raf); vorher.current = cents; };
  }, [cents]);
  const text = kapitalCEurCent(wert);
  const m = text.match(/^([\d.]+)(,\d{2}) €$/);
  if (!m) return <span>{text}</span>;
  return <><span className="gkc-rate-ganz">{m[1]}</span><span className="gkc-rate-cent">{m[2]} €</span></>;
}

// ── Die Urkunde: Live-Vorschau des Namens (wie Fassung B) ─────────────────────
type LlcTexte = KapitalCKundenSicht["seite"]["llc"];
function Urkunde({ t, name, staat }: { t: LlcTexte; name: string; staat: string }) {
  const voll = llcVollname(name);
  return (
    <div className="gab-urkunde" aria-live="polite">
      <div className="gab-urkunde-kopf">
        <span className="gab-urkunde-auge">Articles of Organization</span>
        <span className="gab-siegel" aria-hidden="true"><Zeichen art="siegel" groesse={26} /></span>
      </div>
      <p className="gab-urkunde-zeile">{t.vorschauZeile}</p>
      <p className={`gab-urkunde-name${voll ? "" : " leer"}`}>{voll || t.vorschauLeer}</p>
      <div className="gab-urkunde-fuss"><span>State of {staat} · Document No. nach Eintragung</span><span>{t.vorschauFuss}</span></div>
    </div>
  );
}
function NamensFelder({ t, wahl, setWahl, fehler, kompakt = false, idPraefix }: {
  t: LlcTexte; wahl: BegleitLlcWahl; setWahl: (w: BegleitLlcWahl) => void;
  fehler: Partial<Record<keyof BegleitLlcWahl, string>>; kompakt?: boolean; idPraefix: string;
}) {
  const feld = (k: keyof BegleitLlcWahl, label: string, platz: string, gross = false) => (
    <label className={`gab-feld${gross ? " gross" : ""}${fehler[k] ? " fehlt" : ""}`} htmlFor={`${idPraefix}-${k}`}>
      <span className="gab-feld-label">{label}</span>
      <span className="gab-feld-eingabe">
        <input id={`${idPraefix}-${k}`} type="text" value={wahl[k]} placeholder={platz} maxLength={90} autoComplete="off" spellCheck={false}
          aria-invalid={!!fehler[k] || undefined} aria-describedby={fehler[k] ? `${idPraefix}-${k}-f` : undefined}
          onChange={(e) => setWahl({ ...wahl, [k]: e.target.value })} />
        <span className="gab-feld-llc" aria-hidden="true">LLC</span>
      </span>
      {fehler[k] && <span className="gab-feld-fehler" id={`${idPraefix}-${k}-f`}>{fehler[k]}</span>}
    </label>
  );
  return (
    <div className="gab-namen">
      {feld("wunsch", t.wunsch, t.wunschPlatz, true)}
      {!kompakt && <p className="gab-namen-sub">{t.alternativen}</p>}
      <div className="gab-namen-zwei">
        {feld("alternative1", t.alternative1, "")}
        {feld("alternative2", t.alternative2, "")}
      </div>
      {!kompakt && <p className="gaf-fein">{t.alternativenSub}</p>}
    </div>
  );
}

// ── Der Laufzeit-Rechner: die eine Navy-Stelle der Seite ─────────────────────
function Rechner({ sicht, jahre, setJahre }: { sicht: KapitalCKundenSicht; jahre: number; setJahre: (j: number) => void }) {
  const t = sicht.seite.rechner; const k = sicht.konditionen;
  const plan = useMemo(() => kapitalCPlan(k, jahre), [k, jahre]);
  const laufzeiten = useMemo(() => kapitalCLaufzeiten(k), [k]);
  const [treppeAuf, setTreppeAuf] = useState(false);
  const knoepfe = useRef<(HTMLButtonElement | null)[]>([]);
  const taste = (e: React.KeyboardEvent, i: number) => {
    const weiter = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!weiter) return;
    e.preventDefault();
    const n = Math.min(laufzeiten.length - 1, Math.max(0, i + weiter));
    setJahre(laufzeiten[n]); knoepfe.current[n]?.focus();
  };
  return (
    <div className="gkc-rechner" data-fiaon="kapital-c-rechner">
      <div className="gkc-rechner-licht" aria-hidden="true"><span /><span /></div>
      <div className="gkc-rechner-raster">
        <div className="gkc-rechner-links">
          <p className="gkc-auge-hell">{t.auge}</p>
          <h2 className="gkc-h2-hell">{t.titel}</h2>
          <p className="gkc-sub-hell">{t.sub}</p>
          <p className="gkc-jahre-label" id="gkc-jahre-label">{t.laufzeitLabel}</p>
          <div className="gkc-jahre" role="radiogroup" aria-labelledby="gkc-jahre-label">
            {laufzeiten.map((j, i) => (
              <button key={j} ref={(el) => { knoepfe.current[i] = el; }} type="button" role="radio" aria-checked={j === jahre} tabIndex={j === jahre ? 0 : -1}
                className={`gkc-jahr${j === jahre ? " an" : ""}`} onClick={() => setJahre(j)} onKeyDown={(e) => taste(e, i)} aria-label={`${j} ${t.jahre}`}>
                {j}
              </button>
            ))}
          </div>
          <p className="gkc-jahre-einheit">{t.jahre}</p>
        </div>
        <div className="gkc-rechner-rechts" aria-live="polite">
          <p className="gkc-rate-auge">{t.rateAuge}</p>
          <p className="gkc-rate-betrag"><RateBetrag cents={plan.monatsrateCents} /></p>
          <p className="gkc-rate-usd">{t.usdPraefix} {kapitalCUsd(plan.usd.monatsrate)} <span aria-hidden="true">·</span> {plan.raten} {t.werte.raten} <span aria-hidden="true">·</span> <span className="gkc-nb">{t.monatPraefix}{"\u00a0"}{plan.ersteRateMonat}–{plan.letzteRateMonat}</span></p>
          <dl className="gkc-werte">
            <div><dt>{t.werte.zinsen}</dt><dd>{kapitalCEurCent(plan.zinsenCents)}</dd></div>
            <div><dt>{t.werte.rueckzahlung}</dt><dd>{kapitalCEurCent(plan.rueckzahlungCents)}</dd></div>
            <div><dt>{t.werte.zuletzt}</dt><dd>{kapitalCProzent(plan.zinsZuletztBp)}<small> {t.ab} {plan.zinsZuletztAbMonat}</small></dd></div>
          </dl>
        </div>
      </div>
      <div className={`gkc-treppe${treppeAuf ? " auf" : ""}`}>
        <button type="button" className="gkc-treppe-knopf" aria-expanded={treppeAuf} aria-controls="gkc-treppe" onClick={() => setTreppeAuf((a) => !a)}>
          <span>{treppeAuf ? t.treppeZu : t.treppeKnopf}</span><span className="gaf-plus" aria-hidden="true" />
        </button>
        <div className="gaf-klapp" id="gkc-treppe" {...(treppeAuf ? {} : { inert: "" })}><div>
          <div className="gkc-treppe-halter">
            <table>
              <thead><tr><th scope="col">{t.treppeKopf.zeitraum}</th><th scope="col">{t.treppeKopf.zins}</th><th scope="col">{t.treppeKopf.zinsen}</th><th scope="col">{t.treppeKopf.rest}</th></tr></thead>
              <tbody>
                {plan.treppe.map((s) => (
                  <tr key={s.vonMonat}>
                    <td>{t.monatPraefix} {s.vonMonat}{s.bisMonat > s.vonMonat ? `–${s.bisMonat}` : ""}</td>
                    <td>{s.ratenfrei ? t.ratenfrei : s.zinsBp === 0 ? t.zinsfrei : kapitalCProzent(s.zinsBp)}</td>
                    <td>{s.zinsenCents ? kapitalCEurCent(s.zinsenCents) : "—"}</td>
                    <td>{kapitalCEurCent(s.restschuldCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div></div>
      </div>
      <div className="gkc-rechner-fuss">
        <p className="gkc-puenktlich">{t.puenktlich}</p>
        <p>{t.waehrung} {t.kursZeile}.</p>
        <p className="gkc-hinweis">{t.hinweis}</p>
      </div>
    </div>
  );
}

// ── Ihr Paket: typografische Kacheln, jede klickbar ──────────────────────────
function PaketKachel({ k, offen, onKlick, mehr, weniger }: { k: KapitalCPaketKachel; offen: boolean; onKlick: () => void; mehr: string; weniger: string }) {
  const id = `gkc-paket-${k.schluessel}`;
  return (
    <li className={`gkc-kachel${offen ? " auf" : ""}`}>
      <button type="button" className="gkc-kachel-kopf" aria-expanded={offen} aria-controls={id} onClick={onKlick}>
        <span className="gkc-kachel-titel">{k.titel}</span>
        <span className="gkc-kachel-zeile">{k.zeile}</span>
        <span className="gkc-kachel-mehr"><span>{offen ? weniger : mehr}</span><span className="gaf-plus" aria-hidden="true" /></span>
      </button>
      <div className="gaf-klapp" id={id} {...(offen ? {} : { inert: "" })}><div>
        <ul className="gkc-kachel-details">{k.details.map((d) => <li key={d}>{d}</li>)}</ul>
      </div></div>
    </li>
  );
}

export default function BusinessAngebotKapitalC({ sicht, token, onAngenommen, onNeuLaden }: {
  sicht: KapitalCKundenSicht; token: string; onAngenommen: (antwort: unknown) => void; onNeuLaden: () => void;
}) {
  const S = sicht.seite, A = sicht.annahme, T = S.llc, H = S.hero, I = S.investition;
  const k = sicht.konditionen;
  const [auftakt, setAuftakt] = useState<"offen" | "geht" | "vorbei">("offen");
  const [ohneBild, setOhneBild] = useState<Record<string, boolean>>({});
  const [jahre, setJahre] = useState<number>(k.laufzeitVorschlagJahre);
  const [wahl, setWahl] = useState<BegleitLlcWahl>({ wunsch: "", alternative1: "", alternative2: "" });
  const [gelesen, setGelesen] = useState(false);
  const [sofort, setSofort] = useState(false);
  const [sig, setSig] = useState<UnterschriftStand>({ da: false, eingabe: null });
  const [falle, setFalle] = useState("");
  const [zeigeFehlt, setZeigeFehlt] = useState(false);
  const [sendet, setSendet] = useState(false);
  const [fehler, setFehler] = useState("");
  const [serverFeld, setServerFeld] = useState<{ feld: keyof BegleitLlcWahl; text: string } | null>(null);
  const [geaendert, setGeaendert] = useState(false);
  const [kachelAuf, setKachelAuf] = useState<string | null>(null);
  useSeitenRahmen(WORTE.seitenTitel);
  const auftaktGeht = useCallback(() => setAuftakt((a) => (a === "offen" ? "geht" : a)), []);
  const auftaktEnde = useCallback(() => setAuftakt("vorbei"), []);
  const widerruf = useMemo(() => globalWiderrufsbelehrung("de"), []);
  const plan = useMemo(() => kapitalCPlan(k, jahre), [k, jahre]);

  const staat = H.staat;
  const betreff = encodeURIComponent(`${WORTE.angebot} ${sicht.ref}`);
  const gesperrt = !sicht.annahmeBereit || !!sicht.vorschauLeitung;

  const nameFehler: Partial<Record<keyof BegleitLlcWahl, string>> = {};
  (["wunsch", "alternative1", "alternative2"] as const).forEach((f) => {
    const x = llcNameFehler(wahl[f], f === "wunsch");
    if (x && (wahl[f].trim() || zeigeFehlt)) nameFehler[f] = x;
  });
  const voll = [wahl.wunsch, wahl.alternative1, wahl.alternative2].map(llcVollname);
  if (voll[1] && voll[1] === voll[0]) nameFehler.alternative1 = T.doppelt;
  if (voll[2] && (voll[2] === voll[0] || voll[2] === voll[1])) nameFehler.alternative2 = T.doppelt;
  if (serverFeld && !nameFehler[serverFeld.feld]) nameFehler[serverFeld.feld] = serverFeld.text;

  const fehlt: { id: string; text: string }[] = [];
  if (llcNameFehler(wahl.wunsch, true) || nameFehler.alternative1 || nameFehler.alternative2) fehlt.push({ id: "gkc-annahme-namen", text: llcNameFehler(wahl.wunsch, true) ?? nameFehler.alternative1 ?? nameFehler.alternative2 ?? T.fehltWunsch });
  if (!gelesen) fehlt.push({ id: "gkc-gelesen", text: "Bitte bestätigen Sie, dass Sie Vertrag, Informationen und Widerrufsbelehrung gelesen haben." });
  if (!sofort) fehlt.push({ id: "gkc-sofort", text: "Bitte bestätigen Sie den Fast-Track (Beginn vor Ablauf der Widerrufsfrist)." });
  if (!sig.da || !sig.eingabe) fehlt.push({ id: "gaf-unterschrift", text: A.unterschrift.fehlt });
  const zeig = (id: string) => zeigeFehlt && fehlt.some((f) => f.id === id);

  const uebersicht = sicht.uebersicht.zeilen.map((z) => (z.label === KAPITAL_C_LAUFZEIT_LABEL ? { ...z, wert: kapitalCLaufzeitZeile(k, jahre) } : z));

  const absenden = async () => {
    if (sendet || gesperrt) return;
    if (fehlt.length) { setZeigeFehlt(true); setFehler(""); springen(fehlt[0].id); return; }
    setSendet(true); setFehler(""); setGeaendert(false); setServerFeld(null);
    const eingabe: KapitalCAnnahmeEingabe & { falle: string } = {
      textHash: sicht.textHash, llc: wahl, laufzeitJahre: jahre, gelesen: true, sofortBeginn: true, unterschrift: sig.eingabe!, falle,
    };
    try {
      const r = await fetch(`/api/fiaon/global/angebot/${encodeURIComponent(token)}/annehmen`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(eingabe),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { onAngenommen(j); return; }
      if (r.status === 409 || j?.code === "GEAENDERT") { setGeaendert(true); setFehler(j?.error || WORTE.geaendert); return; }
      setFehler(j?.error || WORTE.allgemein);
      if (j?.code === "LLC" && j?.feld) { setServerFeld({ feld: j.feld, text: j.error }); springen("gkc-annahme-namen"); }
      if (j?.code === "LAUFZEIT") springen("gkc-rechner", false);
      if (j?.code === "UNTERSCHRIFT") { setZeigeFehlt(true); springen("gaf-unterschrift"); }
    } catch {
      setFehler(WORTE.netz);
    } finally { setSendet(false); }
  };

  return (
    <div className={`gaf gab gak gkp gkc${auftakt === "offen" ? " gaf-wartet" : ""}`} data-fiaon="angebot-kapital-c">
      {auftakt !== "vorbei" && (
        <Glueckwunsch ton="blau" auge={S.auftakt.auge} gruss={S.auftakt.gruss} zeile={S.auftakt.zeile} weiter={S.auftakt.weiter} onWeg={auftaktGeht} onEnde={auftaktEnde} />
      )}

      <header className="gaf-leiste-oben">
        <div className="gaf-rahmen gaf-leiste-oben-innen">
          <MarkeGlobal hoehe={17} className="gaf-marke" />
          <span className="gaf-leiste-ref">{WORTE.angebot} {sicht.ref} · {WORTE.gueltig} {tagDe(sicht.gueltigBis)}</span>
        </div>
      </header>

      {sicht.vorschauLeitung && (
        <div className="gaf-rahmen"><p className="gaf-vorschau" role="note"><b>{WORTE.vorschau}</b> {WORTE.vorschauSatz}{sicht.fehlt && sicht.fehlt.length > 0 && <> {WORTE.fehlt} {sicht.fehlt.join(" · ")}.</>}</p></div>
      )}

      {/* 1 — Ihre Finanzierung */}
      <section className="gab-hero gkp-hero gkc-hero" aria-label={H.siegel}>
        <div className="gkp-licht" aria-hidden="true"><span /><span /></div>
        <div className="gaf-rahmen gab-hero-raster">
          <div className="gab-hero-text">
            <p className="gaf-auge">{H.auge}</p>
            <h1 className="gaf-h1">{H.titel}</h1>
            <p className="gab-lead">{H.lead}</p>
            <div className="gkp-hero-knoepfe">
              <button type="button" className="gkp-knopf" onClick={() => springen("gkc-rechner", false)}>{H.knopf}<Zeichen art="pfeil" groesse={16} /></button>
              <button type="button" className="gkp-knopf-leise" onClick={() => springen("vertrag", false)}>{H.knopfLeise}</button>
            </div>
          </div>
          <div className="gkp-plan gkc-plan" aria-label={H.siegel}>
            <div className="gkp-plan-ring" aria-hidden="true" />
            <p className="gkp-plan-auge">{H.siegel}</p>
            <p className="gkp-plan-betrag"><Zaehler text={H.betrag} /></p>
            <p className="gkp-plan-usd">{H.umrechnung}</p>
            <p className="gkp-plan-kurs">{H.kurs}</p>
            <div className="gkp-plan-linie" aria-hidden="true" />
            <ul className="gkc-eck">
              {H.eckdaten.map((x) => <li key={x.titel}><b>{x.wert}</b><span>{x.titel}</span></li>)}
            </ul>
            <p className="gkp-plan-garantie"><Zeichen art="haken" groesse={13} /><span>{H.garantie}</span></p>
          </div>
        </div>
      </section>

      <main className="gaf-inhalt">
        {/* 2 — Ihre Konditionen */}
        <section className="gaf-abschnitt" id="konditionen" aria-label={S.konditionen.auge}>
          <div className="gaf-rahmen">
            <Kopf auge={S.konditionen.auge} titel={S.konditionen.titel} sub={S.konditionen.sub} />
            <ol className="gkc-band">
              {S.konditionen.schritte.map((x, i) => (
                <Auf als="li" key={x.titel} verz={i * 90} className="gkc-band-schritt">
                  <span className="gkc-band-punkt" aria-hidden="true" />
                  <span className="gkc-band-wann">{x.wann}</span>
                  <b className="gkc-band-titel">{x.titel}</b>
                  <span className="gkc-band-text">{x.text}</span>
                </Auf>
              ))}
            </ol>
            <div className="gkc-fein-block">{S.konditionen.fein.map((x) => <p key={x} className="gaf-fein">{x}</p>)}</div>
          </div>
        </section>

        {/* 3 — Laufzeit und Rate */}
        <section className="gaf-abschnitt" id="gkc-rechner" aria-label={S.rechner.auge}>
          <div className="gaf-rahmen">
            <Auf><Rechner sicht={sicht} jahre={jahre} setJahre={setJahre} /></Auf>
          </div>
        </section>

        {/* 4 — Ihre Gesellschaft */}
        <section className="gaf-abschnitt" id="gkc-name" aria-label={T.titel}>
          <div className="gaf-rahmen gkp-name-raster">
            <div>
              <Kopf titel={T.titel} sub={T.sub} />
              <NamensFelder t={T} wahl={wahl} setWahl={(w) => { setWahl(w); setServerFeld(null); }} fehler={nameFehler} idPraefix="gkc-oben" />
              <p className="gab-hinweis">{T.hinweis}</p>
            </div>
            <Auf><Urkunde t={T} name={wahl.wunsch} staat={staat} /></Auf>
          </div>
        </section>

        {/* 5 — Ihr Paket */}
        <section className="gaf-abschnitt" id="paket" aria-label={S.paket.auge}>
          <div className="gaf-rahmen">
            <Kopf auge={S.paket.auge} titel={S.paket.titel} sub={S.paket.sub} />
            <div className="gkc-paket">
              {S.paket.gruppen.map((g) => (
                <div key={g.titel} className="gkc-paket-gruppe">
                  <p className="gkc-paket-titel">{g.titel}</p>
                  <ul className="gkc-kacheln">
                    {g.kacheln.map((x) => <PaketKachel key={x.schluessel} k={x} offen={kachelAuf === x.schluessel} mehr={S.paket.mehr} weniger={S.paket.weniger}
                      onKlick={() => setKachelAuf((a) => (a === x.schluessel ? null : x.schluessel))} />)}
                  </ul>
                </div>
              ))}
            </div>
            <p className="gaf-fein gkc-paket-fein">{S.paket.fein}</p>
          </div>
        </section>

        {/* 6 — Ihr Weg */}
        <section className="gaf-abschnitt gaf-abschnitt-weg" id="weg" aria-label={S.weg.auge}>
          <div className="gaf-rahmen">
            <Kopf auge={S.weg.auge} titel={S.weg.titel} sub={S.weg.sub} />
            <PhasenZeitstrahl liste={S.weg.liste} />
          </div>
        </section>

        {/* 7 — Ihre Investition (offen und vollständig, ruhig) */}
        <section className="gaf-abschnitt" id="investition" aria-label={I.auge}>
          <div className="gaf-rahmen">
            <Kopf auge={I.auge} titel={I.titel} sub={I.sub} />
            <div className="gkc-invest">
              <Auf className="gkc-invest-heute">
                <p className="gkc-invest-auge">{I.heuteAuge}</p>
                <p className="gkc-invest-betrag">{I.heute}</p>
                <ul className="gkc-invest-zeilen">{I.heuteZeilen.map((z) => <li key={z.titel}><span>{z.titel}</span><b>{z.betrag}</b></li>)}</ul>
              </Auf>
              <div className="gkc-invest-spaeter">
                {I.spaeter.map((x, i) => (
                  <Auf key={x.titel} verz={i * 90} className="gkc-invest-posten">
                    <p className="gkc-invest-wann">{x.wann}</p>
                    <p className="gkc-invest-zeile"><b>{x.betrag}</b><span>{x.titel}</span></p>
                    <p className="gkc-invest-text">{x.text}</p>
                  </Auf>
                ))}
              </div>
            </div>
            <p className="gkc-invest-garantie">{I.garantie}</p>
            <p className="gaf-fein">{I.fein}</p>
          </div>
        </section>

        {/* 8 — Ihre Unterlagen liegen vor */}
        {S.unterlagen.liste.length > 0 && (
          <section className="gaf-abschnitt" id="unterlagen" aria-label={S.unterlagen.titel}>
            <div className="gaf-rahmen gaf-rahmen-schmal">
              <Kopf auge={S.unterlagen.auge} titel={S.unterlagen.titel} sub={S.unterlagen.sub} />
              <ul className="gkc-unterlagen">
                {S.unterlagen.liste.map((u, i) => (
                  <Auf als="li" key={u.titel} verz={i * 70} className="gkc-unterlage">
                    <span className="gkc-unterlage-titel">{u.titel}</span>
                    <span className="gkc-unterlage-stand"><Zeichen art="haken" groesse={14} />{u.stand}</span>
                  </Auf>
                ))}
              </ul>
              <p className="gaf-fein">{S.unterlagen.fein}</p>
            </div>
          </section>
        )}

        {/* 9 — Fragen */}
        <section className="gaf-abschnitt" id="fragen" aria-label={S.fragen.titel}>
          <div className="gaf-rahmen gaf-rahmen-schmal">
            <Kopf titel={S.fragen.titel} sub={S.fragen.sub} />
            <FragenAntworten liste={S.fragen.liste} sichtbar={S.fragen.sichtbar} />
          </div>
        </section>

        {/* 10 — Ansprechpartner */}
        <section className="gaf-abschnitt" id="ansprechpartner" aria-label={S.ansprechpartner.titel}>
          <div className="gaf-rahmen">
            <Kopf titel={S.ansprechpartner.titel} sub={S.ansprechpartner.sub} />
            <ul className="gab-personen gkc-personen">
              {sicht.ansprechpartner.map((p, i) => (
                <Auf als="li" key={p.kuerzel} verz={i * 90} className="gab-person">
                  <span className="gab-person-bild">
                    {ohneBild[p.kuerzel]
                      ? <span className="gaf-person-mono" aria-hidden="true">{p.name.split(/\s+/).map((x) => x[0]).join("").slice(0, 2)}</span>
                      : <img src={p.portrait} alt={p.name} width={160} height={160} loading="lazy" decoding="async" onError={() => setOhneBild((o) => ({ ...o, [p.kuerzel]: true }))} />}
                  </span>
                  <span className="gab-person-text">
                    <b>{p.name}</b><span>{p.rolle}</span>
                    <a href={`mailto:${p.email}?subject=${betreff}`}><Zeichen art="mail" groesse={16} /><span>{p.email}</span></a>
                    <a href={`tel:${p.telefon.replace(/\s/g, "")}`}><Zeichen art="telefon" groesse={16} /><span>{p.telefon}</span></a>
                  </span>
                </Auf>
              ))}
            </ul>
          </div>
        </section>

        {/* 11 — Vertrag, Widerruf, Informationen */}
        <section className="gaf-abschnitt" id="vertrag" aria-label={S.vertrag.titel}>
          <div className="gaf-rahmen">
            <Kopf titel={S.vertrag.titel} sub={S.vertrag.sub} />
            <VertragsLeser v={S.vertrag} html={sicht.html} annehmen={{ knopf: A.knopf, onAnnehmen: () => springen("gkc-annahme-namen") }}
              pdfs={[{ titel: WORTE.vertragPdf, href: sicht.vertragPdf }]} />
            <div className="gkc-recht">
              <div className="gkc-recht-block" id="widerruf">
                <h3 className="gaf-h3">{S.widerruf.titel}</h3>
                <p>{S.widerruf.text}</p>
                <Mehr knopf={S.widerruf.knopf} knopfZu={WORTE.widerrufZu} id="gkc-widerruf-text" className="gkc-mehr">
                  <div className="gkc-belehrung">
                    {widerruf.abschnitte.map((a) => <div key={a.h}><h4>{a.h}</h4>{a.absaetze.map((x) => <p key={x.slice(0, 40)}>{x}</p>)}</div>)}
                    <h4>{widerruf.formular.titel}</h4>
                    <p>{widerruf.formular.hinweis}</p>
                    <p>{widerruf.formular.an}</p>
                    <ul>{widerruf.formular.zeilen.map((z) => <li key={z}>{z}</li>)}</ul>
                    <p className="gaf-fein">{widerruf.formular.fuss}</p>
                  </div>
                </Mehr>
              </div>
              <div className="gkc-recht-block" id="informationen">
                <h3 className="gaf-h3">{S.informationen.titel}</h3>
                <p>{S.informationen.sub}</p>
                <Mehr knopf={WORTE.infoKnopf} knopfZu={WORTE.infoZu} id="gkc-info-text" className="gkc-mehr">
                  <dl className="gkc-info">{S.informationen.zeilen.map((z) => <div key={z.titel}><dt>{z.titel}</dt><dd>{z.text}</dd></div>)}</dl>
                </Mehr>
              </div>
            </div>
            <p className="gaf-aufruf-hinweis">{ANGEBOT_AUFRUF_HINWEIS}</p>
          </div>
        </section>

        {/* 12 — Auftrag erteilen */}
        <section className="gaf-abschnitt gaf-abschnitt-annahme" id="annahme" aria-label={A.titel}>
          <div className="gaf-rahmen gaf-rahmen-schmal">
            <Kopf titel={A.titel} sub={A.sub} auge={sicht.kundeAnrede.replace(/^Sehr geehrte[r]? /, "")} />
            <div className="gaf-annahme" data-fiaon="kapital-c-annahme">
              <div className="gaf-annahme-feld gkc-wahl">
                <h3 className="gaf-h3">{A.laufzeit}</h3>
                <p className="gkc-wahl-zeile">
                  <b>{jahre} {S.rechner.jahre}</b><span aria-hidden="true">·</span><span>{S.rechner.rateAuge} ≈ {kapitalCEurCent(plan.monatsrateCents)}</span>
                  <button type="button" className="gkc-link" onClick={() => springen("gkc-rechner", false)}>{A.laufzeitAendern}</button>
                </p>
              </div>

              <div className={`gaf-annahme-feld gab-annahme-namen${zeig("gkc-annahme-namen") ? " fehlt" : ""}`} id="gkc-annahme-namen">
                <h3 className="gaf-h3">{T.titel}</h3>
                <NamensFelder t={T} wahl={wahl} setWahl={(w) => { setWahl(w); setServerFeld(null); }} fehler={nameFehler} kompakt idPraefix="gkc-annahme" />
                {llcVollname(wahl.wunsch) && <p className="gab-annahme-vorschau">{llcVollname(wahl.wunsch)}</p>}
              </div>

              <div className="gaf-uebersicht">
                <h3 className="gaf-h3">{sicht.uebersicht.titel}</h3>
                <dl>{uebersicht.map((z) => <div key={z.label}><dt>{z.label}</dt><dd>{z.wert}</dd></div>)}</dl>
              </div>

              <div className={`gaf-annahme-feld gaf-haken gkc-haken${zeig("gkc-gelesen") || zeig("gkc-sofort") ? " fehlt" : ""}`} role="group">
                <label className={`gaf-haken-zeile${gelesen ? " an" : ""}`} id="gkc-gelesen">
                  <input type="checkbox" checked={gelesen} onChange={(e) => setGelesen(e.target.checked)} required aria-invalid={(zeig("gkc-gelesen") && !gelesen) || undefined} />
                  <span className="gaf-haken-kasten" aria-hidden="true"><Zeichen art="haken" groesse={14} /></span>
                  <span>{A.gelesen}</span>
                </label>
                <label className={`gaf-haken-zeile${sofort ? " an" : ""}`} id="gkc-sofort">
                  <input type="checkbox" checked={sofort} onChange={(e) => setSofort(e.target.checked)} required aria-invalid={(zeig("gkc-sofort") && !sofort) || undefined} aria-describedby="gkc-sofort-unter" />
                  <span className="gaf-haken-kasten" aria-hidden="true"><Zeichen art="haken" groesse={14} /></span>
                  <span>{A.sofort}<small className="gkc-haken-unter" id="gkc-sofort-unter">{A.sofortUnter}</small></span>
                </label>
              </div>

              <UnterschriftFeld t={A.unterschrift} fehlt={zeig("gaf-unterschrift")} gesperrt={gesperrt} onAenderung={setSig} />

              <input className="gaf-falle" tabIndex={-1} autoComplete="off" aria-hidden="true" value={falle} onChange={(e) => setFalle(e.target.value)} name="firma_webseite" />
              {fehler && (
                <div className="gaf-fehler" role="alert">
                  <p>{fehler}</p>
                  {geaendert && <button type="button" className="gaf-knopf-leise" onClick={onNeuLaden}>{WORTE.neuLaden}</button>}
                </div>
              )}
              {!gesperrt ? (
                <div className="gaf-knopf-block">
                  <button type="button" className="gaf-knopf-annehmen" onClick={absenden} disabled={sendet} data-fiaon="kapital-c-annehmen">
                    <span>{sendet ? WORTE.sendet : A.knopf}</span>{!sendet && <Zeichen art="pfeil" groesse={18} />}
                  </button>
                  {zeigeFehlt && fehlt.length > 0 && (
                    <div className="gaf-fehlt" role="alert">
                      <b>{WORTE.fehltTitel}</b>
                      <ul>{fehlt.map((f) => <li key={f.id}><a href={`#${f.id}`} onClick={(e) => { e.preventDefault(); springen(f.id); }}>{f.text}</a></li>)}</ul>
                    </div>
                  )}
                  <p className="gaf-unterknopf">{A.unterKnopf}</p>
                </div>
              ) : (
                <div className="gaf-knopf-block">
                  <button type="button" className="gaf-knopf-annehmen" disabled aria-describedby="gkc-gesperrt">{A.knopf}</button>
                  <p className="gaf-gesperrt" id="gkc-gesperrt">{sicht.vorschauLeitung ? WORTE.vorschauKnopf : (sicht.gesperrtGrund || A.gesperrt)}</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="gaf-fuss">
        <div className="gaf-rahmen">
          <MarkeGlobal hoehe={16} className="gaf-marke" />
          <ul className="gaf-pflicht">{S.pflicht.map((x) => <li key={x}>{x}</li>)}</ul>
          <p className="gaf-aufruf-hinweis">{ANGEBOT_AUFRUF_HINWEIS}</p>
          <p className="gaf-fuss-links"><a href="/impressum">{WORTE.impressum}</a> · <a href="/datenschutz">{WORTE.datenschutz}</a></p>
          <p className="gaf-fuss-ref">{WORTE.angebot} {sicht.ref} · {sicht.fassung}</p>
        </div>
      </footer>
    </div>
  );
}
