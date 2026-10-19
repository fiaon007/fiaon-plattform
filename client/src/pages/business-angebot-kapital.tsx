// ═══════════════════════════════════════════════════════════════════════════
// /business/angebot/:token — DAS KAPITAL-ANGEBOT FÜR FIRMENKUNDEN, Register E-399
//
// Verzweigung: business-angebot.tsx lädt die Kundensicht wie immer; ist sie art === "kapital" UND status === "offen",
// zeigt sie diese Seite (lazy, eigener Chunk). Angenommene Kapital-Angebote nutzen die bestehende Ansicht „fertig“.
// Reihenfolge: Willkommen · Hero mit dem Kapitalplan (Zähler) · Name der Gesellschaft mit Live-Urkunde · Ihr Weg ·
// Experten-Team · Bürgschaft · Compliance-Bühne (Navy — die EINE dunkle Stelle) · Investition · Fragen · Ansprechpartner ·
// Vertrag · Annahme. Inhalte aus KapitalKundenSicht (shared/fiaon-global-angebot-kapital.ts); hart im Client stehen nur
// Bedienbeschriftungen. Bausteine der Firmen-/Begleitseite (gaf-, gab-), CI Glasblau über .gak, Eigenes mit gkp-.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef, useState } from "react";
import { ANGEBOT_AUFRUF_HINWEIS } from "@shared/fiaon-global-angebot";
import { llcVollname, llcNameFehler, type BegleitLlcWahl } from "@shared/fiaon-global-angebot-begleit";
import type { KapitalKundenSicht, KapitalAnnahmeEingabe } from "@shared/fiaon-global-angebot-kapital";
import Glueckwunsch from "@/components/angebot-firma/Glueckwunsch";
import PhasenZeitstrahl from "@/components/angebot-firma/PhasenZeitstrahl";
import LeistungsKarten from "@/components/angebot-firma/LeistungsKarten";
import FragenAntworten from "@/components/angebot-firma/FragenAntworten";
import VertragsLeser from "@/components/angebot-firma/VertragsLeser";
import ComplianceBuehne from "@/components/angebot-firma/ComplianceBuehne";
import SonderfreigabeSiegel from "@/components/angebot-firma/SonderfreigabeSiegel";
import UnterschriftFeld, { type UnterschriftStand } from "@/components/angebot-firma/UnterschriftFeld";
import { Auf, MarkeGlobal, Zeichen, ruhig, tagDe } from "@/components/angebot-firma/gemeinsam";
import "@/styles/global-angebot-firma.css";
import "@/styles/global-angebot-begleit.css";
import "@/styles/global-angebot-koop.css";
import "@/styles/global-angebot-kapital.css";

const WORTE = {
  seitenTitel: "Ihr persönliches Angebot · FIAON Global",
  angebot: "Angebot", gueltig: "gültig bis",
  vertragPdf: "Vertrag mit Prüfbericht (PDF)", pruefPdf: "Prüfbericht (PDF)",
  vorschau: "Vorschau der Leitung.", vorschauSatz: "Annehmen kann nur der Kunde — aus dem Chefbüro heraus ist der Knopf gesperrt.", fehlt: "Für die Annahme fehlt noch:",
  impressum: "Impressum", datenschutz: "Datenschutzerklärung",
  fehltTitel: "Bitte noch ergänzen:", sendet: "Wird gespeichert …", neuLaden: "Angebot neu laden",
  geaendert: "Das Angebot wurde inzwischen aktualisiert. Bitte laden Sie es neu und prüfen Sie es noch einmal.",
  allgemein: "Der Auftrag ließ sich gerade nicht speichern. Bitte versuchen Sie es noch einmal.",
  netz: "Keine Verbindung — Ihr Auftrag ist NICHT angekommen. Bitte versuchen Sie es noch einmal.",
  vorschauKnopf: "Vorschau der Leitung — annehmen kann nur der Kunde.",
  inklusive: "Im Festpreis enthalten", zumNamen: "Namen wählen", zumAuftrag: "Zum Auftrag",
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

const springen = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ block: "center", behavior: ruhig() ? "auto" : "smooth" });
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

// ── Die Urkunde: Live-Vorschau des Namens (wie beim Begleitvertrag) ───────────
function Urkunde({ t, name, staat }: { t: KapitalKundenSicht["seite"]["llc"]; name: string; staat: string }) {
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
  t: KapitalKundenSicht["seite"]["llc"]; wahl: BegleitLlcWahl; setWahl: (w: BegleitLlcWahl) => void;
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

export default function BusinessAngebotKapital({ sicht, token, onAngenommen, onNeuLaden }: {
  sicht: KapitalKundenSicht; token: string; onAngenommen: (antwort: unknown) => void; onNeuLaden: () => void;
}) {
  const S = sicht.seite, A = sicht.annahme, U = sicht.uebersicht, T = S.llc, H = S.hero, B = S.buergschaft, I = S.investition;
  const [auftakt, setAuftakt] = useState<"offen" | "geht" | "vorbei">("offen");
  const [ohneBild, setOhneBild] = useState<Record<string, boolean>>({});
  const [wahl, setWahl] = useState<BegleitLlcWahl>({ wunsch: "", alternative1: "", alternative2: "" });
  const [vertretung, setVertretung] = useState(false);
  const [gelesen, setGelesen] = useState(false);
  const [sig, setSig] = useState<UnterschriftStand>({ da: false, eingabe: null });
  const [falle, setFalle] = useState("");
  const [zeigeFehlt, setZeigeFehlt] = useState(false);
  const [sendet, setSendet] = useState(false);
  const [fehler, setFehler] = useState("");
  const [serverFeld, setServerFeld] = useState<{ feld: keyof BegleitLlcWahl; text: string } | null>(null);
  const [geaendert, setGeaendert] = useState(false);
  useSeitenRahmen(WORTE.seitenTitel);
  const auftaktGeht = useCallback(() => setAuftakt((a) => (a === "offen" ? "geht" : a)), []);
  const auftaktEnde = useCallback(() => setAuftakt("vorbei"), []);

  const staat = H.staat;
  const betreff = encodeURIComponent(`${WORTE.angebot} ${sicht.ref}`);
  const gesperrt = !sicht.annahmeBereit || !!sicht.vorschauLeitung;

  const nameFehler: Partial<Record<keyof BegleitLlcWahl, string>> = {};
  (["wunsch", "alternative1", "alternative2"] as const).forEach((k) => {
    const f = llcNameFehler(wahl[k], k === "wunsch");
    if (f && (wahl[k].trim() || zeigeFehlt)) nameFehler[k] = f;
  });
  const voll = [wahl.wunsch, wahl.alternative1, wahl.alternative2].map(llcVollname);
  if (voll[1] && voll[1] === voll[0]) nameFehler.alternative1 = T.doppelt;
  if (voll[2] && (voll[2] === voll[0] || voll[2] === voll[1])) nameFehler.alternative2 = T.doppelt;
  if (serverFeld && !nameFehler[serverFeld.feld]) nameFehler[serverFeld.feld] = serverFeld.text;

  const fehlt: { id: string; text: string }[] = [];
  if (llcNameFehler(wahl.wunsch, true) || nameFehler.alternative1 || nameFehler.alternative2) fehlt.push({ id: "gkp-annahme-namen", text: llcNameFehler(wahl.wunsch, true) ?? nameFehler.alternative1 ?? nameFehler.alternative2 ?? T.fehltWunsch });
  if (!vertretung) fehlt.push({ id: "gkp-vertretung", text: "Bitte bestätigen Sie, dass Sie Ihr Unternehmen vertreten dürfen." });
  if (!gelesen) fehlt.push({ id: "gkp-gelesen", text: "Bitte bestätigen Sie, dass Sie Vertrag und Prüfbericht gelesen haben." });
  if (!sig.da || !sig.eingabe) fehlt.push({ id: "gaf-unterschrift", text: A.unterschrift.fehlt });
  const zeig = (id: string) => zeigeFehlt && fehlt.some((f) => f.id === id);

  const absenden = async () => {
    if (sendet || gesperrt) return;
    if (fehlt.length) { setZeigeFehlt(true); setFehler(""); springen(fehlt[0].id); return; }
    setSendet(true); setFehler(""); setGeaendert(false); setServerFeld(null);
    const eingabe: KapitalAnnahmeEingabe & { falle: string } = {
      textHash: sicht.textHash, llc: wahl, vertretung: true, gelesen: true, unterschrift: sig.eingabe!, falle,
    };
    try {
      const r = await fetch(`/api/fiaon/global/angebot/${encodeURIComponent(token)}/annehmen`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(eingabe),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { onAngenommen(j); return; }
      if (r.status === 409 || j?.code === "GEAENDERT") { setGeaendert(true); setFehler(j?.error || WORTE.geaendert); return; }
      setFehler(j?.error || WORTE.allgemein);
      if (j?.code === "LLC" && j?.feld) { setServerFeld({ feld: j.feld, text: j.error }); springen("gkp-annahme-namen"); }
      if (j?.code === "UNTERSCHRIFT") { setZeigeFehlt(true); springen("gaf-unterschrift"); }
    } catch {
      setFehler(WORTE.netz);
    } finally { setSendet(false); }
  };

  return (
    <div className={`gaf gab gak gkp${auftakt === "offen" ? " gaf-wartet" : ""}`} data-fiaon="angebot-kapital">
      {auftakt !== "vorbei" && (
        <Glueckwunsch auge={S.auftakt.auge} gruss={S.auftakt.gruss} zeile={S.auftakt.zeile} weiter={S.auftakt.weiter} onWeg={auftaktGeht} onEnde={auftaktEnde} />
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

      {/* 1 — Hero: das Versprechen und der Kapitalplan */}
      <section className="gab-hero gkp-hero" aria-label={H.titel}>
        <div className="gkp-licht" aria-hidden="true"><span /><span /></div>
        <div className="gaf-rahmen gab-hero-raster">
          <div className="gab-hero-text">
            <p className="gaf-auge">{H.auge}</p>
            <h1 className="gaf-h1">{H.titel}</h1>
            <p className="gab-lead">{H.lead}</p>
            <ul className="gab-nutzen">{H.nutzen.map((n) => <li key={n}><Zeichen art="haken" groesse={16} /><span>{n}</span></li>)}</ul>
            <div className="gkp-hero-knoepfe">
              <button type="button" className="gkp-knopf" onClick={() => springen("gkp-name")}>{WORTE.zumNamen}<Zeichen art="pfeil" groesse={16} /></button>
              <button type="button" className="gkp-knopf-leise" onClick={() => springen("gkp-annahme-namen")}>{WORTE.zumAuftrag}</button>
            </div>
          </div>
          <div className="gkp-plan" aria-label={H.siegel}>
            <div className="gkp-plan-ring" aria-hidden="true" />
            <p className="gkp-plan-auge">{H.siegel}</p>
            <p className="gkp-plan-betrag"><Zaehler text={H.betrag} /></p>
            <p className="gkp-plan-usd">{H.umrechnung}</p>
            <p className="gkp-plan-kurs">{H.kurs}</p>
            <div className="gkp-plan-linie" aria-hidden="true" />
            <ul className="gkp-plan-saeulen">
              {H.saeulen.map((x) => <li key={x.titel}><span>{x.titel}</span><b>{x.wert}</b></li>)}
            </ul>
            {H.garantie && <p className="gkp-plan-garantie"><Zeichen art="haken" groesse={13} /><span>{H.garantie}</span></p>}
          </div>
        </div>
      </section>

      <main className="gaf-inhalt">
        {/* 2 — Name der Gesellschaft mit Live-Urkunde */}
        <section className="gaf-abschnitt" id="gkp-name" aria-label={T.titel}>
          <div className="gaf-rahmen gkp-name-raster">
            <div>
              <Kopf titel={T.titel} sub={T.sub} />
              <NamensFelder t={T} wahl={wahl} setWahl={(w) => { setWahl(w); setServerFeld(null); }} fehler={nameFehler} idPraefix="gkp-oben" />
              <p className="gab-hinweis">{T.hinweis}</p>
            </div>
            <Auf><Urkunde t={T} name={wahl.wunsch} staat={staat} /></Auf>
          </div>
        </section>

        {/* 3 — Ihr Weg */}
        <section className="gaf-abschnitt gaf-abschnitt-weg" id="weg" aria-label={S.ablauf.titel}>
          <div className="gaf-rahmen">
            <Kopf auge={S.ablauf.titel} titel={S.ablauf.sub} />
            <PhasenZeitstrahl liste={S.ablauf.liste} />
          </div>
        </section>

        {/* 4 — Experten-Team */}
        <section className="gaf-abschnitt" id="team" aria-label={S.team.titel}>
          <div className="gaf-rahmen">
            <Kopf titel={S.team.titel} sub={S.team.sub} />
            <LeistungsKarten karten={S.team.karten} />
          </div>
        </section>

        {/* 5 — Bürgschaft (hell, Glas — die dunkle Stelle ist die Compliance-Bühne) */}
        <section className="gaf-abschnitt" id="buergschaft" aria-label={B.titel}>
          <div className="gaf-rahmen">
            <Auf className="gkp-buerg">
              <div className="gkp-buerg-kopf">
                <p className="gaf-auge">{B.auge}</p>
                {B.freigabe && <p className="gkp-freigabe"><Zeichen art="siegel" groesse={15} /><span>{B.freigabe}</span></p>}
                <h2 className="gaf-h2">{B.titel}</h2>
                <p className="gaf-sub">{B.lead}</p>
              </div>
              <div className="gkp-buerg-siegel" aria-hidden="true">
                <svg viewBox="0 0 120 120" width="120" height="120"><defs><linearGradient id="gkp-sg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#288dfa" /><stop offset="1" stopColor="#1d4ed8" /></linearGradient></defs>
                  <circle cx="60" cy="60" r="54" fill="none" stroke="url(#gkp-sg)" strokeWidth="2" strokeDasharray="4 5" className="gkp-dreh" />
                  <circle cx="60" cy="60" r="42" fill="#fff" stroke="url(#gkp-sg)" strokeWidth="1.5" />
                  <path d="M60 36 L80 44 V60 C80 72 71 81 60 85 C49 81 40 72 40 60 V44 Z" fill="none" stroke="url(#gkp-sg)" strokeWidth="2.2" strokeLinejoin="round" />
                  <path d="M51 60 L57.5 66.5 L70 53.5" fill="none" stroke="#1d4ed8" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <span>{B.betrag}</span>
              </div>
              <ul className="gkp-buerg-punkte">{B.punkte.map((x) => <li key={x.titel}><b>{x.titel}</b><span>{x.text}</span></li>)}</ul>
              {S.sonderfreigabe && <div className="gkp-buerg-siegel-voll"><SonderfreigabeSiegel sf={S.sonderfreigabe} /></div>}
              <div className="gkp-buerg-bed">
                <p className="gaf-auge">{B.bedingungenTitel}</p>
                <ol>{B.bedingungen.map((x, i) => <li key={x}><i>{i + 1}</i><span>{x}</span></li>)}</ol>
              </div>
              <p className="gaf-fein">{B.fein}</p>
            </Auf>
          </div>
        </section>

        {/* 6 — Compliance-Prüfung */}
        <ComplianceBuehne c={sicht.compliance} texte={S.pruefbericht} pdf={sicht.pruefberichtPdf ?? sicht.vertragPdf} sonderfreigabe={S.sonderfreigabe} />

        {/* 7 — Investition */}
        <section className="gaf-abschnitt" id="investition" aria-label={I.titel}>
          <div className="gaf-rahmen">
            <Kopf titel={I.titel} sub={I.sub} />
            <div className={`gkp-weg${I.posten.length ? "" : " allein"}`}>
              <Auf className="gkp-weg-heute">
                <span className="gkp-weg-punkt an" aria-hidden="true" />
                <p className="gkp-weg-auge">{I.heuteAuge}</p>
                <p className="gkp-preis-betrag">{I.preis}</p>
                <p className="gkp-preis-zeile">{I.preisZeile}</p>
              </Auf>
              {I.posten.length > 0 && <div className="gkp-weg-spaeter">
                <p className="gkp-weg-auge leise">{I.spaeterTitel}</p>
                {I.posten.map((x, i) => (
                  <Auf key={x.titel} verz={i * 90} className="gkp-weg-schritt">
                    <span className="gkp-weg-punkt" aria-hidden="true" />
                    <span className="gkp-weg-wann">{x.wann}</span>
                    <span className="gkp-weg-zeile"><b>{x.betrag}</b><span>{x.titel} · {x.text}</span></span>
                  </Auf>
                ))}
              </div>}
            </div>
            {I.jahr && <p className="gkp-weg-jahr">{I.jahr}</p>}
            <Auf className="gkp-inklusive">
              <p className="gaf-auge">{WORTE.inklusive}</p>
              <ul>{I.inklusive.map((x) => <li key={x}><Zeichen art="haken" groesse={15} /><span>{x}</span></li>)}</ul>
              {I.garantie && <p className="gkp-garantie-zeile">{I.garantie}</p>}
              <p className="gaf-fein">{I.fein}</p>
            </Auf>
          </div>
        </section>

        {/* 8 — Fragen */}
        <section className="gaf-abschnitt" id="fragen" aria-label={S.fragen.titel}>
          <div className="gaf-rahmen gaf-rahmen-schmal">
            <Kopf titel={S.fragen.titel} sub={S.fragen.sub} />
            <FragenAntworten liste={S.fragen.liste} sichtbar={S.fragen.sichtbar} />
          </div>
        </section>

        {/* 9 — Ansprechpartner */}
        <section className="gaf-abschnitt" id="ansprechpartner" aria-label={S.ansprechpartner.titel}>
          <div className="gaf-rahmen">
            <Kopf titel={S.ansprechpartner.titel} sub={S.ansprechpartner.sub} />
            <ul className="gab-personen">
              {sicht.ansprechpartner.map((p, i) => (
                <Auf als="li" key={p.kuerzel} verz={i * 90} className="gab-person">
                  <span className="gab-person-bild">
                    {ohneBild[p.kuerzel]
                      ? <span className="gaf-person-mono" aria-hidden="true">{p.name.split(/\s+/).map((t) => t[0]).join("").slice(0, 2)}</span>
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
            {S.ansprechpartner.team.length > 0 && (
              <div className="gaf-team gkp-team" data-fiaon="kapital-team">
                <Kopf titel={S.ansprechpartner.teamTitel} sub={S.ansprechpartner.teamSub} />
                <ul className="gaf-team-raster">
                  {S.ansprechpartner.team.map((t, i) => (
                    <Auf als="li" key={t.name} verz={(i % 4) * 70} className="gaf-team-person">
                      <span className="gaf-team-bild">
                        {t.foto && !ohneBild[`team:${t.name}`]
                          ? <img src={t.foto} alt={t.name} width={240} height={240} loading="lazy" decoding="async" onError={() => setOhneBild((o) => ({ ...o, [`team:${t.name}`]: true }))} />
                          : <span className="gaf-team-mono" aria-hidden="true">{t.initialen}</span>}
                      </span>
                      <span className="gaf-team-name">{t.name}</span>
                      <span className="gaf-team-rolle">{t.rolle}</span>
                    </Auf>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        {/* 10 — Vertrag */}
        <section className="gaf-abschnitt" id="vertrag" aria-label={S.vertrag.titel}>
          <div className="gaf-rahmen">
            <Kopf titel={S.vertrag.titel} sub={S.vertrag.sub} />
            <VertragsLeser v={S.vertrag} html={sicht.html} annehmen={{ knopf: A.knopf, onAnnehmen: () => springen("gkp-annahme-namen") }}
              pdfs={[{ titel: WORTE.vertragPdf, href: sicht.vertragPdf }, ...(sicht.pruefberichtPdf ? [{ titel: WORTE.pruefPdf, href: sicht.pruefberichtPdf }] : [])]} />
            <p className="gaf-aufruf-hinweis">{ANGEBOT_AUFRUF_HINWEIS}</p>
          </div>
        </section>

        {/* 11 — Annahme */}
        <section className="gaf-abschnitt gaf-abschnitt-annahme" id="annahme" aria-label={A.titel}>
          <div className="gaf-rahmen gaf-rahmen-schmal">
            <Kopf titel={A.titel} sub={A.sub} auge={sicht.kundeAnrede.replace(/^Sehr geehrte[r]? /, "")} />
            <div className="gaf-annahme" data-fiaon="kapital-annahme">
              <div className={`gaf-annahme-feld gab-annahme-namen${zeig("gkp-annahme-namen") ? " fehlt" : ""}`} id="gkp-annahme-namen">
                <h3 className="gaf-h3">{T.titel}</h3>
                <NamensFelder t={T} wahl={wahl} setWahl={(w) => { setWahl(w); setServerFeld(null); }} fehler={nameFehler} kompakt idPraefix="gkp-annahme" />
                {llcVollname(wahl.wunsch) && <p className="gab-annahme-vorschau">{llcVollname(wahl.wunsch)}</p>}
              </div>

              <div className="gaf-uebersicht">
                <h3 className="gaf-h3">{U.titel}</h3>
                <dl>{U.zeilen.map((z) => <div key={z.label}><dt>{z.label}</dt><dd>{z.wert}</dd></div>)}</dl>
              </div>

              <div className={`gaf-annahme-feld gaf-haken${zeig("gkp-vertretung") || zeig("gkp-gelesen") ? " fehlt" : ""}`} role="group">
                <label className={`gaf-haken-zeile${vertretung ? " an" : ""}`} id="gkp-vertretung">
                  <input type="checkbox" checked={vertretung} onChange={(e) => setVertretung(e.target.checked)} required aria-invalid={(zeig("gkp-vertretung") && !vertretung) || undefined} />
                  <span className="gaf-haken-kasten" aria-hidden="true"><Zeichen art="haken" groesse={14} /></span>
                  <span>{A.vertretung}</span>
                </label>
                <label className={`gaf-haken-zeile${gelesen ? " an" : ""}`} id="gkp-gelesen">
                  <input type="checkbox" checked={gelesen} onChange={(e) => setGelesen(e.target.checked)} required aria-invalid={(zeig("gkp-gelesen") && !gelesen) || undefined} />
                  <span className="gaf-haken-kasten" aria-hidden="true"><Zeichen art="haken" groesse={14} /></span>
                  <span>{A.gelesen}</span>
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
                  <button type="button" className="gaf-knopf-annehmen" onClick={absenden} disabled={sendet} data-fiaon="kapital-annehmen">
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
                  <button type="button" className="gaf-knopf-annehmen" disabled aria-describedby="gkp-gesperrt">{A.knopf}</button>
                  <p className="gaf-gesperrt" id="gkp-gesperrt">{sicht.vorschauLeitung ? WORTE.vorschauKnopf : (sicht.gesperrtGrund || A.gesperrt)}</p>
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
          {S.bildnachweis && <p className="gaf-aufruf-hinweis">{S.bildnachweis}</p>}
          <p className="gaf-aufruf-hinweis">{ANGEBOT_AUFRUF_HINWEIS}</p>
          <p className="gaf-fuss-links"><a href="/impressum">{WORTE.impressum}</a> · <a href="/datenschutz">{WORTE.datenschutz}</a></p>
          <p className="gaf-fuss-ref">{WORTE.angebot} {sicht.ref} · {sicht.fassung}</p>
        </div>
      </footer>
    </div>
  );
}
