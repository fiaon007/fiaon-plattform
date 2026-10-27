// ═══════════════════════════════════════════════════════════════════════════
// /business/angebot/:token — DAS KAPITAL-ANGEBOT, FASSUNG C (PRIVATPERSONEN), Register E-432
//
// Verzweigung: business-angebot.tsx zeigt diese Seite, wenn die Kundensicht art „kapital“, variante „privat“ und status „offen“
// trägt (lazy, eigener Chunk). Angenommene Angebote nutzen die gemeinsame Ansicht „fertig“.
// Justin (27.10.2026): „nur noch Laufzeit, Name und Unterschrift … es muss sich perfekt anfühlen.“
// Reihenfolge (Nachprüfung 27.10.): Willkommen · Ihre Finanzierung (Betrag groß, Eckdaten, Monatsrate, Geld-zurück-Garantie) ·
// Laufzeit-Rechner mit den Konditionen (die EINE Navy-Stelle) · Name der Gesellschaft mit Live-Urkunde · Ihr Paket · Ihr Weg ·
// Ihre Investition (leise: eine Zeile mit allen Beträgen, Einzelheiten zum Aufklappen — Justin 27.10., 17:40) · Ihre Unterlagen ·
// Fragen · Ansprechpartner mit „Ihr Team“ (Raster wie Fassung A/B: Foto oder Initialen, Bildnachweis im Fuß — Justin 27.10., abends) ·
// Vertrag, Widerruf, Informationen · Auftrag. Kein Verwendungszweck auf der Seite (Justin 27.10.).
// Inhalte aus KapitalCKundenSicht (shared/fiaon-global-angebot-kapital-c.ts); die Rate rechnet dieselbe reine Funktion wie
// Vertrag und Server (kapitalCPlan). Hart im Client stehen nur Bedienbeschriftungen. CI Glasblau, kein Gold (.gak/.gkp/.gkc).
// Runde 2 (27.10.2026): Laufzeit, Name, EIN Haken (Fast-Track) und die Unterschrift — der Satz „… gelesen“ steht über der
// Unterschrift, sie bestätigt ihn. Nach der Annahme die ruhige Fertig-Ansicht KapitalCFertig (ohne Website-Menü, Glasblau).
// ═══════════════════════════════════════════════════════════════════════════
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ANGEBOT_AUFRUF_HINWEIS } from "@shared/fiaon-global-angebot";
import { llcVollname, llcNameFehler, BEGLEIT_LLC_TEXTE, type BegleitLlcWahl } from "@shared/fiaon-global-angebot-begleit";
import { globalWiderrufsbelehrung } from "@shared/fiaon-global-widerruf";
import {
  kapitalCPlan, kapitalCLaufzeiten, kapitalCEurCent, kapitalCUsd, kapitalCProzent, kapitalCLaufzeitZeile, kapitalCLetzteRateAnders,
  KAPITAL_C_LAUFZEIT_LABEL, KAPITAL_C_NB,
  type KapitalCKundenSicht, type KapitalCAnnahmeEingabe, type KapitalCPaketKachel, type KapitalCPlan,
} from "@shared/fiaon-global-angebot-kapital-c";
import Glueckwunsch from "@/components/angebot-firma/Glueckwunsch";
import PhasenZeitstrahl from "@/components/angebot-firma/PhasenZeitstrahl";
import FragenAntworten from "@/components/angebot-firma/FragenAntworten";
import VertragsLeser from "@/components/angebot-firma/VertragsLeser";
import UnterschriftFeld, { type UnterschriftStand } from "@/components/angebot-firma/UnterschriftFeld";
import { Auf, MarkeGlobal, Zeichen, einsetzen, ruhig, tagDe } from "@/components/angebot-firma/gemeinsam";
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
  fehltTitel: "Bitte noch ergänzen:", neuLaden: "Angebot neu laden",
  geaendert: "Das Angebot wurde inzwischen aktualisiert. Bitte laden Sie es neu und prüfen Sie es noch einmal.",
  allgemein: "Ihr Auftrag ließ sich gerade nicht speichern — es ist nichts verloren. Bitte tippen Sie noch einmal auf den Knopf.",
  netz: "Die Verbindung war kurz weg — Ihr Auftrag ist noch nicht angekommen. Bitte tippen Sie noch einmal auf den Knopf.",
  vorschauKnopf: "Vorschau der Leitung — annehmen kann nur der Kunde.",
  infoKnopf: "Informationen lesen", infoZu: "Informationen schließen", widerrufZu: "Belehrung schließen",
  zinsenKurz: "Zinsen", restKurz: "Rest",
};
type NamenFeld = keyof BegleitLlcWahl;
const NAMEN_FELDER: NamenFeld[] = ["wunsch", "alternative1", "alternative2"];

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

/** Zu einem Abschnitt springen und das erste sinnvolle Feld fokussieren — im Rechner die GEWÄHLTE Laufzeit, nie die erste. */
const springen = (id: string, mitte = true) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ block: mitte ? "center" : "start", behavior: (ruhig() ? "instant" : "smooth") as ScrollBehavior });
  const feld = el.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]') ?? el.querySelector<HTMLElement>("input, canvas, button") ?? el;
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

/** Die Monatsrate gleitet zum neuen Wert (ruhig: springt). Ganze Euro groß, Cent klein. Vorgelesen wird nur der Endwert (siehe Rechner). */
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
  // Zwischen Betrag und € steht ein geschütztes Leerzeichen (KAPITAL_C_NB).
  const m = text.match(/^([\d.]+)(,\d{2})[\s ]€$/);
  if (!m) return <span aria-hidden="true">{text}</span>;
  return <span aria-hidden="true"><span className="gkc-rate-ganz">{m[1]}</span><span className="gkc-rate-cent">{m[2]}{KAPITAL_C_NB}€</span></span>;
}

// ── Die Urkunde: Live-Vorschau des Namens — Glasblau, ohne Siegel (wenig Icons) ─────────────────────
type LlcTexte = KapitalCKundenSicht["seite"]["llc"];
function Urkunde({ t, name, staat }: { t: LlcTexte; name: string; staat: string }) {
  const voll = llcVollname(name);
  return (
    <div className="gab-urkunde" aria-live="polite">
      <div className="gab-urkunde-kopf"><span className="gab-urkunde-auge">Articles of Organization</span></div>
      <p className="gab-urkunde-zeile">{t.vorschauZeile}</p>
      <p className={`gab-urkunde-name${voll ? "" : " leer"}`}>{voll || t.vorschauLeer}</p>
      <div className="gab-urkunde-fuss"><span>State of {staat} · Registernummer nach der Eintragung</span><span>{t.vorschauFuss}</span></div>
    </div>
  );
}

/**
 * Eine Zeile aus Teilen mit „ · “ — am Rechner in einer Zeile, am Handy (Klasse gkc-pz-umbruch) je Teil eine Zeile ohne Punkt,
 * statt dass ein Punkt am Zeilenende hängt („IHRE MONATSRATE · | RECHENBEISPIEL“).
 */
function Punktzeile({ text, leise = false }: { text: string; leise?: boolean }) {
  const teile = text.split(" · ");
  return <>{teile.map((t, i) => (
    <Fragment key={t}>{i > 0 && <span className="gkc-pz-trenner" aria-hidden="true"> · </span>}<span className={`gkc-pz-teil${leise && i > 0 ? " leise" : ""}`}>{t}</span></Fragment>
  ))}</>;
}

/** „Gründung, Konto und Karten 2.790 € · Fast-Track 499 €“ — jeder Teil bleibt ganz (nie „Fast-“ | „Track“). */
function Teile({ text }: { text: string }) {
  return <>{text.split(" · ").map((t, i) => <Fragment key={`${i}-${t}`}>{i > 0 && " · "}<span className="gkc-nb">{t}</span></Fragment>)}</>;
}
/** „Fast-Track“ in Fließtext ohne Trennung am Bindestrich. */
function OhneTrennung({ text, wort = "Fast-Track" }: { text: string; wort?: string }) {
  const teile = text.split(wort);
  return <>{teile.map((t, i) => <Fragment key={i}>{i > 0 && <span className="gkc-nb">{wort}</span>}{t}</Fragment>)}</>;
}

/** Ein Hinweis an einem Namensfeld: „leer“ = es fehlt nur noch (ruhig, blau), sonst ist die Eingabe falsch (ein Rotton). */
type NamenHinweis = { text: string; leer?: boolean };
function NamensFelder({ t, wahl, setWahl, hinweise, idPraefix, nurWunsch = false, onVerlassen }: {
  t: LlcTexte; wahl: BegleitLlcWahl; setWahl: (w: BegleitLlcWahl) => void;
  hinweise: Partial<Record<NamenFeld, NamenHinweis>>; idPraefix: string; nurWunsch?: boolean; onVerlassen: (f: NamenFeld) => void;
}) {
  const [ausweichAuf, setAusweichAuf] = useState(() => !!(wahl.alternative1 || wahl.alternative2));
  const ausweichHinweis = !!(hinweise.alternative1 || hinweise.alternative2);
  useEffect(() => { if (ausweichHinweis) setAusweichAuf(true); }, [ausweichHinweis]);
  const feld = (k: NamenFeld, label: string, platz: string, gross = false) => {
    const h = hinweise[k];
    return (
      <label className={`gab-feld${gross ? " gross" : ""}${h ? (h.leer ? " leer" : " fehlt") : ""}`} htmlFor={`${idPraefix}-${k}`}>
        <span className="gab-feld-label">{label}</span>
        <span className="gab-feld-eingabe">
          <input id={`${idPraefix}-${k}`} type="text" value={wahl[k]} placeholder={platz} maxLength={90} autoComplete="off" spellCheck={false}
            aria-invalid={(h && !h.leer) || undefined} aria-describedby={h ? `${idPraefix}-${k}-f` : undefined}
            onChange={(e) => setWahl({ ...wahl, [k]: e.target.value })} onBlur={() => onVerlassen(k)} />
          <span className="gab-feld-llc" aria-hidden="true">LLC</span>
        </span>
        {h && <span className="gab-feld-fehler" id={`${idPraefix}-${k}-f`}>{h.text}</span>}
      </label>
    );
  };
  return (
    <div className="gab-namen">
      {feld("wunsch", t.wunsch, t.wunschPlatz, true)}
      {!nurWunsch && (
        <div className={`gkc-ausweich${ausweichAuf ? " auf" : ""}`}>
          <button type="button" className="gkc-ausweich-knopf" aria-expanded={ausweichAuf} aria-controls={`${idPraefix}-ausweich`} onClick={() => setAusweichAuf((a) => !a)}>
            <span>{ausweichAuf ? t.ausweichZu : t.ausweichAuf}</span><span className="gaf-plus" aria-hidden="true" />
          </button>
          <div className="gaf-klapp" id={`${idPraefix}-ausweich`} {...(ausweichAuf ? {} : { inert: "" })}><div>
            <div className="gab-namen-zwei">
              {feld("alternative1", t.alternative1, "")}
              {feld("alternative2", t.alternative2, "")}
            </div>
            <p className="gaf-fein">{t.alternativenSub}</p>
          </div></div>
        </div>
      )}
    </div>
  );
}

/** Aufklappen, von außen steuerbar (die Wörter im Satz „gelesen“ öffnen Widerruf und Informationen). */
function Klapp({ auf, setAuf, knopf, knopfZu, id, children }: { auf: boolean; setAuf: (a: boolean) => void; knopf: string; knopfZu: string; id: string; children: ReactNode }) {
  return (
    <div className={`gaf-mehr gkc-mehr${auf ? " auf" : ""}`}>
      <button type="button" className="gaf-mehr-knopf" aria-expanded={auf} aria-controls={id} onClick={() => setAuf(!auf)}>
        <span>{auf ? knopfZu : knopf}</span><span className="gaf-plus" aria-hidden="true" />
      </button>
      <div className="gaf-klapp" id={id} {...(auf ? {} : { inert: "" })}><div>{children}</div></div>
    </div>
  );
}

/** Der Satz „Ich habe den Vertrag, die Informationen … und die Widerrufsbelehrung … gelesen.“ — die drei Wörter führen zum Text. */
function GelesenSatz({ satz, links, ziele }: { satz: string; links: Record<"vertrag" | "informationen" | "widerruf", string>; ziele: Record<"vertrag" | "informationen" | "widerruf", () => void> }) {
  const teile: ReactNode[] = [];
  let rest = satz;
  (["vertrag", "informationen", "widerruf"] as const).forEach((k) => {
    const i = rest.indexOf(links[k]);
    if (i < 0) return;
    teile.push(rest.slice(0, i));
    // Ein Verweis in der Beschriftung: preventDefault hält den Haken still (kein Umspringen beim Klick auf das Wort).
    teile.push(<a key={k} href={`#gkc-${k}`} className="gkc-satz-link" onClick={(e) => { e.preventDefault(); e.stopPropagation(); ziele[k](); }}>{links[k]}</a>);
    rest = rest.slice(i + links[k].length);
  });
  teile.push(rest);
  return <>{teile}</>;
}

// ── Die Zinstreppe: am Rechner eine Tabelle, am Handy je Stufe eine Zeile mit zwei Ebenen (CSS) ─────────────
function Zinstreppe({ plan, t }: { plan: KapitalCPlan; t: KapitalCKundenSicht["seite"]["rechner"] }) {
  return (
    <div className="gkc-treppe-halter">
      <table>
        <thead><tr><th scope="col">{t.treppeKopf.zeitraum}</th><th scope="col">{t.treppeKopf.zins}</th><th scope="col">{t.treppeKopf.zinsen}</th><th scope="col">{t.treppeKopf.rest}</th></tr></thead>
        <tbody>
          {plan.treppe.map((s) => (
            <tr key={s.vonMonat}>
              <td className="gkc-tr-zeit">{t.monatPraefix}{KAPITAL_C_NB}{s.vonMonat}{s.bisMonat > s.vonMonat ? `–${s.bisMonat}` : ""}</td>
              <td className="gkc-tr-zins">{s.ratenfrei ? (s.zinsBp === 0 ? t.ratenfreiZinsfrei : `${t.ratenfrei} · ${kapitalCProzent(s.zinsBp)}`) : s.zinsBp === 0 ? t.zinsfrei : kapitalCProzent(s.zinsBp)}</td>
              <td className="gkc-tr-zinsen" data-label={WORTE.zinsenKurz}>{s.zinsenCents ? kapitalCEurCent(s.zinsenCents) : "—"}</td>
              <td className="gkc-tr-rest" data-label={WORTE.restKurz}>{kapitalCEurCent(s.restschuldCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Der Laufzeit-Rechner mit den Konditionen: die eine Navy-Stelle der Seite ─────────────────────
function Rechner({ sicht, jahre, setJahre, plan }: { sicht: KapitalCKundenSicht; jahre: number; setJahre: (j: number) => void; plan: KapitalCPlan }) {
  const t = sicht.seite.rechner; const K = sicht.seite.konditionen; const k = sicht.konditionen;
  const laufzeiten = useMemo(() => kapitalCLaufzeiten(k), [k]);
  const [treppeAuf, setTreppeAuf] = useState(false);
  const knoepfe = useRef<(HTMLButtonElement | null)[]>([]);
  const waehlen = (n: number) => { setJahre(laufzeiten[n]); knoepfe.current[n]?.focus(); };
  const taste = (e: React.KeyboardEvent, i: number) => {
    const ende = laufzeiten.length - 1;
    const ziel = e.key === "ArrowRight" || e.key === "ArrowDown" ? Math.min(ende, i + 1)
      : e.key === "ArrowLeft" || e.key === "ArrowUp" ? Math.max(0, i - 1)
      : e.key === "Home" ? 0 : e.key === "End" ? ende : null;
    if (ziel == null) return;
    e.preventDefault();
    waehlen(ziel);
  };
  const letzteAnders = kapitalCLetzteRateAnders(plan);
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
            <span className="gkc-jahre-zelle" aria-hidden="true">{t.jahre}</span>
          </div>
          <p className="gkc-jahre-einheit" aria-hidden="true">{t.jahre}</p>
        </div>
        <div className="gkc-rechner-rechts">
          <p className="gkc-rate-auge gkc-pz-umbruch"><Punktzeile text={t.rateAuge} leise /></p>
          <p className="gkc-rate-betrag"><RateBetrag cents={plan.monatsrateCents} /></p>
          <p className="gkc-rate-usd"><span className="gkc-nb">{t.usdPraefix}{KAPITAL_C_NB}{kapitalCUsd(plan.usd.monatsrate)}</span> {t.usdImMonat}</p>
          <p className="gkc-rate-raten">
            <span className="gkc-nb gkc-raten-zahl">{plan.raten} {t.werte.raten}</span><span className="gkc-trenner gkc-trenner-erst" aria-hidden="true"> · </span>
            <span className="gkc-nb">{t.monatPraefix}{KAPITAL_C_NB}{plan.ersteRateMonat}–{plan.letzteRateMonat}</span>
            {letzteAnders && <><span className="gkc-trenner" aria-hidden="true"> · </span><span className="gkc-nb">{t.werte.letzteRate} {kapitalCEurCent(plan.letzteRateCents)}</span></>}
          </p>
          <p className="gaf-nur-leser" aria-live="polite">{einsetzen(t.vorlesen, { jahre: String(jahre), rate: kapitalCEurCent(plan.monatsrateCents), zinsen: kapitalCEurCent(plan.zinsenCents) })}</p>
          <dl className="gkc-werte">
            <div><dt>{t.werte.zinsen}</dt><dd>{kapitalCEurCent(plan.zinsenCents)}</dd></div>
            <div><dt>{t.werte.rueckzahlung}</dt><dd>{kapitalCEurCent(plan.rueckzahlungCents)}</dd></div>
            <div><dt>{t.werte.zinsfreiBis}</dt><dd>{t.werte.zinsfreiWert}</dd></div>
          </dl>
        </div>
      </div>
      <div className="gkc-kond" role="group" aria-label={K.auge}>
        <p className="gkc-kond-auge">{K.auge}</p>
        <ol className="gkc-kond-liste">
          {K.schritte.map((x) => (
            <li key={x.titel}><span className="gkc-kond-wann">{x.wann}</span><span className="gkc-kond-titel">{x.titel}</span><span className="gkc-kond-text">{x.text}</span></li>
          ))}
        </ol>
      </div>
      <div className={`gkc-treppe${treppeAuf ? " auf" : ""}`}>
        <button type="button" className="gkc-treppe-knopf" aria-expanded={treppeAuf} aria-controls="gkc-treppe" onClick={() => setTreppeAuf((a) => !a)}>
          <span>{treppeAuf ? t.treppeZu : t.treppeKnopf}</span><span className="gaf-plus" aria-hidden="true" />
        </button>
        <div className="gaf-klapp" id="gkc-treppe" {...(treppeAuf ? {} : { inert: "" })}><div><Zinstreppe plan={plan} t={t} /></div></div>
      </div>
      <div className="gkc-rechner-fuss">
        <p className="gkc-puenktlich">{t.puenktlich}</p>
        <p className="gkc-verantwortung">{t.verantwortung}</p>
        <p>{t.waehrung} {t.kursZeile}.</p>
        <p className="gkc-hinweis">{t.hinweis}</p>
      </div>
    </div>
  );
}

// ── Ihr Paket: typografische Kacheln, jede klickbar (am Handy eine kompakte Liste) ─────────────────────
function PaketKachel({ k, offen, onKlick, mehr, weniger }: { k: KapitalCPaketKachel; offen: boolean; onKlick: () => void; mehr: string; weniger: string }) {
  const id = `gkc-paket-${k.schluessel}`;
  return (
    <li className={`gkc-kachel${offen ? " auf" : ""}`}>
      <button type="button" className="gkc-kachel-kopf" aria-expanded={offen} aria-controls={id} onClick={onKlick}>
        <span className="gkc-kachel-titel">{k.titel}</span>
        <span className="gkc-kachel-zeile">{k.zeile}</span>
        <span className="gkc-kachel-mehr"><span className="gkc-kachel-mehr-text">{offen ? weniger : mehr}</span><span className="gaf-plus" aria-hidden="true" /></span>
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
  // Ihr Team (wie Fassung A/B) — eine ältere Antwort ohne Team zeigt schlicht keinen Abschnitt.
  const team = S.ansprechpartner.team ?? [];
  const [auftakt, setAuftakt] = useState<"offen" | "geht" | "vorbei">("offen");
  const [ohneBild, setOhneBild] = useState<Record<string, boolean>>({});
  const [jahre, setJahre] = useState<number>(k.laufzeitVorschlagJahre);
  const [wahl, setWahl] = useState<BegleitLlcWahl>({ wunsch: "", alternative1: "", alternative2: "" });
  const [beruehrt, setBeruehrt] = useState<Partial<Record<NamenFeld, boolean>>>({});
  const [nameHier, setNameHier] = useState(false);
  const [sofort, setSofort] = useState(false);
  const [sig, setSig] = useState<UnterschriftStand>({ da: false, eingabe: null });
  const [falle, setFalle] = useState("");
  const [zeigeFehlt, setZeigeFehlt] = useState(false);
  const [sendet, setSendet] = useState(false);
  const [fehler, setFehler] = useState("");
  const [serverFeld, setServerFeld] = useState<{ feld: NamenFeld; text: string } | null>(null);
  const [geaendert, setGeaendert] = useState(false);
  const [kachelAuf, setKachelAuf] = useState<string | null>(null);
  const [widerrufAuf, setWiderrufAuf] = useState(false);
  const [infoAuf, setInfoAuf] = useState(false);
  const [investAuf, setInvestAuf] = useState(false);
  const leserOeffnen = useRef<((anker: string | null) => void) | null>(null);
  const fehlerKasten = useRef<HTMLDivElement>(null);
  useSeitenRahmen(WORTE.seitenTitel);
  const auftaktGeht = useCallback(() => setAuftakt((a) => (a === "offen" ? "geht" : a)), []);
  const auftaktEnde = useCallback(() => setAuftakt("vorbei"), []);
  const widerruf = useMemo(() => globalWiderrufsbelehrung("de"), []);
  // Nach „Angebot neu laden“ kann sich der Rahmen geändert haben — die Wahl bleibt darin (sonst wirft kapitalCPlan, die Seite wäre leer).
  const jahreIm = Math.min(k.laufzeitMaxJahre, Math.max(k.laufzeitMinJahre, Math.round(jahre)));
  useEffect(() => { if (jahreIm !== jahre) setJahre(jahreIm); }, [jahreIm, jahre]);
  const plan = useMemo(() => kapitalCPlan(k, jahreIm), [k, jahreIm]);
  // Nach einem Fehler beim Absenden: Fokus auf den Hinweis (Vorleser und Tastatur landen dort, nicht im Nichts).
  useEffect(() => { if (fehler) fehlerKasten.current?.focus(); }, [fehler]);

  const staat = H.staat;
  const betreff = encodeURIComponent(`${WORTE.angebot} ${sicht.ref}`);
  const gesperrt = !sicht.annahmeBereit || !!sicht.vorschauLeitung;

  // ── Namen prüfen: „zu kurz“ und „doppelt“ erst nach dem Verlassen des Felds oder beim Absenden; Umlaute und Zeichen sofort ──
  const hinweise: Partial<Record<NamenFeld, NamenHinweis>> = {};
  NAMEN_FELDER.forEach((f) => {
    const x = llcNameFehler(wahl[f], f === "wunsch");
    if (!x) return;
    if (x === BEGLEIT_LLC_TEXTE.fehltWunsch) { if (zeigeFehlt) hinweise[f] = { text: x, leer: true }; return; }
    if (x === BEGLEIT_LLC_TEXTE.kurz && !(beruehrt[f] || zeigeFehlt)) return;
    hinweise[f] = { text: x };
  });
  const voll = [wahl.wunsch, wahl.alternative1, wahl.alternative2].map(llcVollname);
  if (voll[1] && voll[1] === voll[0] && (beruehrt.alternative1 || zeigeFehlt)) hinweise.alternative1 = { text: T.doppelt };
  if (voll[2] && (voll[2] === voll[0] || voll[2] === voll[1]) && (beruehrt.alternative2 || zeigeFehlt)) hinweise.alternative2 = { text: T.doppelt };
  if (serverFeld && !hinweise[serverFeld.feld]) hinweise[serverFeld.feld] = { text: serverFeld.text };
  const verlassen = (f: NamenFeld) => setBeruehrt((b) => (b[f] ? b : { ...b, [f]: true }));
  const nameNeu = (w: BegleitLlcWahl) => { setWahl(w); setServerFeld(null); };

  // Was zum Absenden fehlt — dieselben Regeln wie der Server (llcWahlPruefen), ohne Zeitpunkt-Bremse. Der Wunschname wird in der
  // Annahme ergänzt; ein Fehler bei einem Ausweichnamen führt nach oben zu genau diesem Feld.
  const doppelt1 = !!voll[1] && voll[1] === voll[0];
  const doppelt2 = !!voll[2] && (voll[2] === voll[0] || voll[2] === voll[1]);
  const wunschFehler = llcNameFehler(wahl.wunsch, true) ?? (serverFeld?.feld === "wunsch" ? serverFeld.text : null);
  const ausweichFeld: NamenFeld | null = llcNameFehler(wahl.alternative1, false) || doppelt1 || serverFeld?.feld === "alternative1" ? "alternative1"
    : llcNameFehler(wahl.alternative2, false) || doppelt2 || serverFeld?.feld === "alternative2" ? "alternative2" : null;
  const ausweichFehler = ausweichFeld
    ? (llcNameFehler(wahl[ausweichFeld], false) ?? ((ausweichFeld === "alternative1" ? doppelt1 : doppelt2) ? T.doppelt : null) ?? serverFeld?.text ?? T.doppelt)
    : null;
  const nameGut = !!llcVollname(wahl.wunsch) && !wunschFehler && !ausweichFehler;
  const fehlt: { id: string; text: string }[] = [];
  if (wunschFehler) fehlt.push({ id: "gkc-annahme-namen", text: wunschFehler });
  else if (ausweichFehler && ausweichFeld) fehlt.push({ id: `gkc-oben-${ausweichFeld}`, text: ausweichFehler });
  if (!sofort) fehlt.push({ id: "gkc-sofort", text: "Bitte bestätigen Sie den Fast-Track (Beginn vor Ablauf der Widerrufsfrist)." });
  if (!sig.da || !sig.eingabe) fehlt.push({ id: "gaf-unterschrift", text: A.unterschrift.fehlt });
  const zeig = (id: string) => zeigeFehlt && fehlt.some((f) => f.id === id);

  const uebersicht = sicht.uebersicht.zeilen.map((z) => (z.label === KAPITAL_C_LAUFZEIT_LABEL ? { ...z, wert: kapitalCLaufzeitZeile(k, jahreIm) } : z));
  const zumText = {
    vertrag: () => leserOeffnen.current?.(null),
    informationen: () => { setInfoAuf(true); window.setTimeout(() => springen("informationen", false), 30); },
    widerruf: () => { setWiderrufAuf(true); window.setTimeout(() => springen("widerruf", false), 30); },
  };

  const absenden = async () => {
    if (sendet || gesperrt) return;
    if (fehlt.length) { setZeigeFehlt(true); setFehler(""); springen(fehlt[0].id); return; }
    setSendet(true); setFehler(""); setGeaendert(false); setServerFeld(null);
    const eingabe: KapitalCAnnahmeEingabe & { falle: string } = {
      // „gelesen“: Die Unterschrift bestätigt den Satz direkt darüber (kein eigener Haken mehr, Runde 2).
      textHash: sicht.textHash, llc: wahl, laufzeitJahre: jahreIm, gelesen: true, sofortBeginn: true, unterschrift: sig.eingabe!, falle,
    };
    try {
      const r = await fetch(`/api/fiaon/global/angebot/${encodeURIComponent(token)}/annehmen`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(eingabe),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { onAngenommen(j); return; }
      if (r.status === 409 || j?.code === "GEAENDERT") { setGeaendert(true); setFehler(j?.error || WORTE.geaendert); return; }
      setFehler(j?.error || WORTE.allgemein);
      if (j?.code === "LLC" && j?.feld) {
        setServerFeld({ feld: j.feld, text: j.error }); setZeigeFehlt(true);
        window.setTimeout(() => springen(j.feld === "wunsch" ? "gkc-annahme-namen" : `gkc-oben-${j.feld}`), 60);
      }
      if (j?.code === "LAUFZEIT") springen("gkc-rechner", false);
      if (j?.code === "UNTERSCHRIFT") setZeigeFehlt(true);
    } catch {
      setFehler(WORTE.netz);
    } finally { setSendet(false); }
  };

  // Der Name in der Annahme: eine Zeile mit „ändern“, sobald ein gültiger Wunschname steht — die Felder nur, solange er fehlt,
  // falsch ist oder gerade hier getippt wird (sonst stünden sechs Felder mit demselben Inhalt auf der Seite).
  const nameZeigen = !llcVollname(wahl.wunsch) || !!wunschFehler || nameHier;

  return (
    <div className={`gaf gab gak gkp gkc${auftakt === "offen" ? " gaf-wartet" : ""}`} data-fiaon="angebot-kapital-c">
      {auftakt !== "vorbei" && (
        <Glueckwunsch ton="morgen" auge={S.auftakt.auge} gruss={S.auftakt.gruss} zeile={S.auftakt.zeile} weiter={S.auftakt.weiter} onWeg={auftaktGeht} onEnde={auftaktEnde} />
      )}

      <header className="gaf-leiste-oben">
        <div className="gaf-rahmen gaf-leiste-oben-innen">
          <MarkeGlobal hoehe={17} className="gaf-marke" />
          <span className="gaf-leiste-ref"><span className="gkc-leiste-nr"><span className="gkc-nb">{WORTE.angebot} {sicht.ref}</span> · </span><span className="gkc-nb">{WORTE.gueltig} {tagDe(sicht.gueltigBis)}</span></span>
        </div>
      </header>

      {sicht.vorschauLeitung && (
        <div className="gaf-rahmen"><p className="gaf-vorschau" role="note"><b>{WORTE.vorschau}</b> {WORTE.vorschauSatz}{sicht.fehlt && sicht.fehlt.length > 0 && <> {WORTE.fehlt} {sicht.fehlt.join(" · ")}.</>}</p></div>
      )}

      {/* 1 — Ihre Finanzierung, mit der Monatsrate der gewählten Laufzeit */}
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
            <p className="gkp-plan-kurs gkc-pz-umbruch"><Punktzeile text={H.kurs} /></p>
            <div className="gkp-plan-linie" aria-hidden="true" />
            <ul className="gkc-eck">
              {H.eckdaten.map((x) => <li key={x.titel}><b>{x.wert}</b><span>{x.titel}</span></li>)}
            </ul>
            <button type="button" className="gkc-hero-rate" onClick={() => springen("gkc-rechner", false)}>
              <span className="gkc-hero-rate-auge gkc-pz-umbruch"><Punktzeile text={einsetzen(H.rateAuge, { monat: String(plan.ersteRateMonat) })} leise /></span>
              <span className="gkc-hero-rate-zeile">
                <b className="gkc-hero-rate-wert">{kapitalCEurCent(plan.monatsrateCents)}</b>
                <span className="gkc-hero-rate-bei">{einsetzen(H.rateBei, { jahre: String(jahreIm) })}</span>
                <span className="gkc-hero-rate-knopf">{H.rateKnopf}<Zeichen art="pfeil" groesse={14} /></span>
              </span>
            </button>
            <p className="gkp-plan-garantie"><Zeichen art="haken" groesse={13} /><span>{H.garantie}</span></p>
          </div>
        </div>
      </section>

      <main className="gaf-inhalt">
        {/* 2 — Laufzeit, Rate und Konditionen */}
        <section className="gaf-abschnitt gkc-abschnitt-rechner" id="gkc-rechner" aria-label={S.rechner.auge}>
          <div className="gaf-rahmen">
            <Auf><Rechner sicht={sicht} jahre={jahreIm} setJahre={setJahre} plan={plan} /></Auf>
            <div className="gkc-fein-block">{S.konditionen.fein.map((x) => <p key={x} className="gaf-fein">{x}</p>)}</div>
          </div>
        </section>

        {/* 3 — Ihre Gesellschaft */}
        <section className="gaf-abschnitt" id="gkc-name" aria-label={T.titel}>
          <div className="gaf-rahmen gkp-name-raster">
            <div>
              <Kopf titel={T.titel} sub={T.sub} />
              <NamensFelder t={T} wahl={wahl} setWahl={nameNeu} hinweise={hinweise} idPraefix="gkc-oben" onVerlassen={verlassen} />
              <p className="gab-hinweis">{T.hinweis}</p>
            </div>
            <Auf><Urkunde t={T} name={wahl.wunsch} staat={staat} /></Auf>
          </div>
        </section>

        {/* 4 — Ihr Paket */}
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

        {/* 5 — Ihr Weg */}
        <section className="gaf-abschnitt gaf-abschnitt-weg" id="weg" aria-label={S.weg.auge}>
          <div className="gaf-rahmen">
            <Kopf auge={S.weg.auge} titel={S.weg.titel} sub={S.weg.sub} />
            <PhasenZeitstrahl liste={S.weg.liste} />
          </div>
        </section>

        {/* 6 — Ihre Investition: leise (Justin 27.10.2026, 17:40 — „kleiner, weiß auf weiß“). Keine Bühne, keine großen Ziffern,
            keine Karte: EINE sichtbare Zeile mit allen Beträgen (Endpreise, Gesamtpreis), die Einzelheiten klappen auf. Lesbar bleibt
            sie: mindestens 13 px, Kontrast mindestens 4,5:1 (Prüfstand). Die Übersicht über dem Knopf nennt alles noch einmal. */}
        {/* aria-label: die Lesemessung (lib/angebot-lesen.ts, E-410) zählt nur section[aria-label] — so sieht Justin auch die Zeit bei den Kosten. */}
        <section className="gaf-abschnitt gkc-invest" id="investition" aria-label={I.titel}>
          <div className="gaf-rahmen gaf-rahmen-schmal">
            <div className="gkc-invest-leise">
              <h2 className="gkc-invest-titel" id="gkc-invest-titel">{I.titel}</h2>
              <p className="gkc-invest-zeile">{I.zeile}</p>
              <Klapp auf={investAuf} setAuf={setInvestAuf} knopf={I.knopf} knopfZu={I.knopfZu} id="gkc-invest-einzeln">
                <dl className="gkc-invest-einzeln">
                  {I.zeilen.map((z) => (
                    <div key={z.wann}>
                      <dt>{z.wann}</dt>
                      <dd><span className="gkc-nb gkc-invest-betrag">{z.betrag}</span> · <Teile text={z.text} /></dd>
                    </div>
                  ))}
                </dl>
                <p className="gkc-invest-summe">{I.summe}</p>
                <p className="gkc-invest-fein">{I.fein}</p>
              </Klapp>
            </div>
          </div>
        </section>

        {/* 7 — Ihre Unterlagen liegen vor */}
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
            <ul className="gab-personen gkc-personen">
              {sicht.ansprechpartner.map((p, i) => (
                <Auf als="li" key={p.kuerzel} verz={i * 90} className="gab-person">
                  <span className="gab-person-bild">
                    {ohneBild[p.kuerzel]
                      ? <span className="gaf-person-mono" aria-hidden="true">{p.name.split(/\s+/).map((x) => x[0]).join("").slice(0, 2)}</span>
                      : <img src={p.portrait} alt={p.alt || p.name} width={160} height={160} loading="lazy" decoding="async" onError={() => setOhneBild((o) => ({ ...o, [p.kuerzel]: true }))} />}
                  </span>
                  <span className="gab-person-text">
                    <b>{p.name}</b>
                    {(() => {
                      // Am Handy steht der letzte Teil („Director“) bewusst in einer eigenen Zeile — kein Punkt am Zeilenende.
                      const teile = p.rolle.split(" · ");
                      return (
                        <span className="gkc-rolle">
                          <span className="gkc-nb">{teile.slice(0, -1).join(" · ")}</span>
                          {teile.length > 1 && <><span className="gkc-rolle-trenner"> · </span><span className="gkc-rolle-letzt gkc-nb">{teile[teile.length - 1]}</span></>}
                        </span>
                      );
                    })()}
                    {p.kiHinweis && !ohneBild[p.kuerzel] && <small className="gkc-ki-hinweis">{p.kiHinweis}</small>}
                    <a href={`mailto:${p.email}?subject=${betreff}`}><Zeichen art="mail" groesse={16} /><span>{p.email}</span></a>
                    <a href={`tel:${p.telefon.replace(/\s/g, "")}`}><Zeichen art="telefon" groesse={16} /><span>{p.telefon}</span></a>
                  </span>
                </Auf>
              ))}
            </ul>
            {/* Ihr Team — wie Fassung A/B (Raster, Foto oder Initialen, Glasblau über .gkp); leeres Team = kein Abschnitt */}
            {team.length > 0 && (
              <div className="gaf-team gkp-team gkc-team" data-fiaon="kapital-team">
                <Kopf titel={S.ansprechpartner.teamTitel} sub={S.ansprechpartner.teamSub} />
                <ul className="gaf-team-raster">
                  {team.map((t, i) => (
                    <Auf als="li" key={`${i}-${t.name}`} verz={(i % 4) * 70} className="gaf-team-person">
                      <span className="gaf-team-bild">
                        {t.foto && !ohneBild[`team:${i}`]
                          ? <img src={t.foto} alt={t.name} width={240} height={240} loading="lazy" decoding="async" onError={() => setOhneBild((o) => ({ ...o, [`team:${i}`]: true }))} />
                          : <span className="gaf-team-mono" aria-hidden="true">{t.initialen}</span>}
                      </span>
                      <span className="gaf-team-name">{t.name}</span>
                      {/* Wie bei den Ansprechpartnern: kein Punkt am Zeilenende — jeder Teil der Rolle („A · B“) steht in seiner Zeile. */}
                      <span className="gaf-team-rolle">{t.rolle.split(" · ").map((teil, j) => <span key={j} className="gkc-team-rolle-teil">{teil}</span>)}</span>
                    </Auf>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        {/* 10 — Vertrag, Widerruf, Informationen */}
        <section className="gaf-abschnitt" id="vertrag" aria-label={S.vertrag.titel}>
          <div className="gaf-rahmen">
            <Kopf titel={S.vertrag.titel} sub={S.vertrag.sub} />
            <VertragsLeser v={S.vertrag} html={sicht.html} annehmen={{ knopf: A.leserKnopf, satz: A.leserSatz, onAnnehmen: () => springen(nameGut ? "gkc-sofort" : "gkc-annahme-namen") }}
              pdfs={[{ titel: WORTE.vertragPdf, href: sicht.vertragPdf }]} oeffner={leserOeffnen} />
            <div className="gkc-recht">
              <div className="gkc-recht-block" id="widerruf">
                <h3 className="gaf-h3">{S.widerruf.titel}</h3>
                <p>{S.widerruf.text}</p>
                <Klapp auf={widerrufAuf} setAuf={setWiderrufAuf} knopf={S.widerruf.knopf} knopfZu={WORTE.widerrufZu} id="gkc-widerruf-text">
                  <div className="gkc-belehrung">
                    {widerruf.abschnitte.map((a) => <div key={a.h}><h4>{a.h}</h4>{a.absaetze.map((x) => <p key={x.slice(0, 40)}>{x}</p>)}</div>)}
                    <h4>{widerruf.formular.titel}</h4>
                    <p>{widerruf.formular.hinweis}</p>
                    <p>{widerruf.formular.an}</p>
                    <ul>{widerruf.formular.zeilen.map((z) => <li key={z}>{z}</li>)}</ul>
                    <p className="gaf-fein">{widerruf.formular.fuss}</p>
                  </div>
                </Klapp>
              </div>
              <div className="gkc-recht-block" id="informationen">
                <h3 className="gaf-h3">{S.informationen.titel}</h3>
                <p>{S.informationen.sub}</p>
                <Klapp auf={infoAuf} setAuf={setInfoAuf} knopf={WORTE.infoKnopf} knopfZu={WORTE.infoZu} id="gkc-info-text">
                  <dl className="gkc-info">{S.informationen.zeilen.map((z) => <div key={z.titel}><dt>{z.titel}</dt><dd>{z.text}</dd></div>)}</dl>
                </Klapp>
              </div>
            </div>
          </div>
        </section>

        {/* 11 — Auftrag erteilen */}
        <section className="gaf-abschnitt gaf-abschnitt-annahme" id="annahme" aria-label={A.titel}>
          <div className="gaf-rahmen gaf-rahmen-schmal">
            <Kopf titel={A.titel} sub={A.sub} auge={A.auge} />
            <div className="gaf-annahme" data-fiaon="kapital-c-annahme">
              <div className="gaf-annahme-feld gkc-wahl">
                <h3 className="gaf-h3">{A.laufzeit}</h3>
                <p className="gkc-wahl-zeile">
                  <b>{jahreIm} {S.rechner.jahre}</b><span className="gkc-wahl-trenner" aria-hidden="true">·</span>
                  <span className="gkc-wahl-rate">{einsetzen(A.rateZeile, { rate: kapitalCEurCent(plan.monatsrateCents) })}</span>
                  <button type="button" className="gkc-link" onClick={() => springen("gkc-rechner", false)}>{A.laufzeitAendern}</button>
                </p>
              </div>

              <div className={`gaf-annahme-feld gab-annahme-namen${zeig("gkc-annahme-namen") ? " fehlt" : ""}`} id="gkc-annahme-namen"
                onFocus={(e) => { if ((e.target as HTMLElement).tagName === "INPUT") setNameHier(true); }}
                onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setNameHier(false); }}>
                <h3 className="gaf-h3">{A.name}</h3>
                {nameZeigen ? (
                  <NamensFelder t={T} wahl={wahl} setWahl={nameNeu} hinweise={hinweise} idPraefix="gkc-annahme" nurWunsch onVerlassen={verlassen} />
                ) : (
                  <>
                    <p className="gkc-wahl-zeile gkc-name-zeile">
                      <b className="gkc-name-wert">{llcVollname(wahl.wunsch)}</b>
                      <button type="button" className="gkc-link" onClick={() => springen("gkc-name")}>{A.nameAendern}</button>
                    </p>
                    {(wahl.alternative1 || wahl.alternative2) && <p className="gkc-name-ausweich">{[wahl.alternative1, wahl.alternative2].map(llcVollname).filter(Boolean).join(" · ")}</p>}
                  </>
                )}
              </div>

              <div className="gaf-uebersicht">
                <h3 className="gaf-h3">{sicht.uebersicht.titel}</h3>
                <dl>{uebersicht.map((z) => <div key={z.label}><dt>{z.label}</dt><dd>{z.wert}</dd></div>)}</dl>
              </div>

              <div className={`gaf-annahme-feld gaf-haken gkc-haken${zeig("gkc-sofort") ? " fehlt" : ""}`} role="group">
                <label className={`gaf-haken-zeile${sofort ? " an" : ""}`} id="gkc-sofort">
                  <input type="checkbox" checked={sofort} onChange={(e) => setSofort(e.target.checked)} required aria-invalid={(zeig("gkc-sofort") && !sofort) || undefined} aria-describedby="gkc-sofort-unter" />
                  <span className="gaf-haken-kasten" aria-hidden="true"><Zeichen art="haken" groesse={14} /></span>
                  <span><OhneTrennung text={A.sofort} /><small className="gkc-haken-unter" id="gkc-sofort-unter"><OhneTrennung text={A.sofortUnter} /></small></span>
                </label>
              </div>

              {/* Kein Haken „gelesen“ (Runde 2): Die Unterschrift bestätigt den Satz direkt darunter — die drei Wörter führen zum Text. */}
              <UnterschriftFeld t={A.unterschrift} fehlt={zeig("gaf-unterschrift")} gesperrt={gesperrt} onAenderung={setSig}
                zusatz={<p className="gkc-unterschrift-satz" id="gkc-gelesen">{A.gelesenVorsatz} „<GelesenSatz satz={A.gelesen} links={A.gelesenLinks} ziele={zumText} />“</p>} />

              <input className="gaf-falle" tabIndex={-1} autoComplete="off" aria-hidden="true" value={falle} onChange={(e) => setFalle(e.target.value)} name="firma_webseite" />
              {fehler && (
                <div className="gaf-fehler" role="alert" tabIndex={-1} ref={fehlerKasten}>
                  <p>{fehler}</p>
                  {geaendert && <button type="button" className="gaf-knopf-leise" onClick={onNeuLaden}>{WORTE.neuLaden}</button>}
                </div>
              )}
              {!gesperrt ? (
                <div className="gaf-knopf-block">
                  <button type="button" className={`gaf-knopf-annehmen${sendet ? " sendet" : ""}`} onClick={absenden} aria-busy={sendet || undefined} aria-disabled={sendet || undefined} data-fiaon="kapital-c-annehmen">
                    <span>{sendet ? A.knopfSendet : A.knopf}</span>{!sendet && <Zeichen art="pfeil" groesse={18} />}
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
          {S.bildnachweis && <p className="gaf-aufruf-hinweis">{S.bildnachweis}</p>}
          <p className="gaf-aufruf-hinweis">{ANGEBOT_AUFRUF_HINWEIS}</p>
          <p className="gaf-fuss-links"><a href="/impressum">{WORTE.impressum}</a> · <a href="/datenschutz">{WORTE.datenschutz}</a></p>
          <p className="gaf-fuss-ref">{WORTE.angebot} {sicht.ref}</p>
        </div>
      </footer>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// NACH DER ANNAHME — die ruhige Fertig-Ansicht der Fassung C (Runde 2, Gestaltung + Kundensicht)
// Vorher sprang dieselbe Adresse in die Website (Menü „Leistungen / Preise …“, Navy-Knopf „Beauftragen“, drei Ansprechpartner).
// Jetzt: derselbe Rahmen wie die Angebotsseite (Glasblau, Wortmarke, kein Website-Menü), „Zur Zahlungsseite“ im Blau-Verlauf,
// der Verwendungszweck offen, Dateien mit klaren Namen und nur der Ansprechpartner aus dem Angebot (mit KI-Hinweis am Porträt).
// Texte vom Server (kapitalCAngenommenAntwort → privat), hier nur Bedienbeschriftungen.
// ═══════════════════════════════════════════════════════════════════════════
export interface KapitalCFertigDaten {
  ref: string; zahlungsseite: string | null; meinAuftrag: string | null; vertragUrl: string | null; rechnungUrl: string | null;
  fertigTitel: string; fertigText: string; teil1Bezahlt?: boolean; fertigZahlung?: string; fertigFuss?: string;
  llc?: { wunsch: string } | null;
  privat: {
    auge: string; zweck: string | null; knopf: string; meinAuftragKnopf: string; dateien: { vertrag: string; rechnung: string };
    ansprechTitel: string; ansprechpartner: KapitalCKundenSicht["ansprechpartner"]; marke: string;
  };
}
const FERTIG_WORTE = { angebot: "Angebot", gesellschaft: "Ihre Gesellschaft", dateien: "Ihre Unterlagen", impressum: "Impressum", datenschutz: "Datenschutzerklärung" };
export function KapitalCFertig({ f }: { f: KapitalCFertigDaten }) {
  useSeitenRahmen(WORTE.seitenTitel);
  const [ohneBild, setOhneBild] = useState<Record<string, boolean>>({});
  const P = f.privat;
  const betreff = encodeURIComponent(`${FERTIG_WORTE.angebot} ${f.ref}`);
  return (
    <div className="gaf gab gak gkp gkc gkc-fertig" data-fiaon="angebot-fertig" data-variante="privat">
      <header className="gaf-leiste-oben">
        <div className="gaf-rahmen gaf-leiste-oben-innen">
          <MarkeGlobal hoehe={17} className="gaf-marke" />
          <span className="gaf-leiste-ref"><span className="gkc-nb">{FERTIG_WORTE.angebot} {f.ref}</span></span>
        </div>
      </header>
      <main className="gaf-inhalt">
        <section className="gaf-abschnitt gkc-fertig-abschnitt" aria-label={f.fertigTitel}>
          <div className="gaf-rahmen gaf-rahmen-schmal">
            <div className="gaf-kopf">
              <p className="gaf-auge">{P.auge}</p>
              <h1 className="gaf-h2 gkc-fertig-titel">{f.fertigTitel}</h1>
              <p className="gaf-sub">{f.fertigText}</p>
            </div>
            <div className="gkc-fertig-karte">
              <dl className="gkc-fertig-daten">
                <div><dt>{FERTIG_WORTE.angebot}</dt><dd>{f.ref}</dd></div>
                {f.llc?.wunsch && <div><dt>{FERTIG_WORTE.gesellschaft}</dt><dd>{f.llc.wunsch}</dd></div>}
              </dl>
              {!f.teil1Bezahlt && f.fertigZahlung && <p className="gkc-fertig-zahlung"><OhneTrennung text={f.fertigZahlung} /></p>}
              {!f.teil1Bezahlt && P.zweck && <p className="gkc-fertig-zweck">{P.zweck}</p>}
              <div className="gkc-fertig-knoepfe">
                {f.zahlungsseite && !f.teil1Bezahlt && <a className="gkp-knopf" href={f.zahlungsseite}>{P.knopf}<Zeichen art="pfeil" groesse={16} /></a>}
                {f.meinAuftrag && <a className="gkp-knopf-leise gkc-fertig-leise" href={f.meinAuftrag}>{P.meinAuftragKnopf}</a>}
              </div>
              {(f.vertragUrl || f.rechnungUrl) && (
                <div className="gkc-fertig-dateien">
                  <p className="gaf-auge">{FERTIG_WORTE.dateien}</p>
                  <ul className="gaf-dokumente">
                    {[{ titel: P.dateien.vertrag, href: f.vertragUrl }, { titel: P.dateien.rechnung, href: f.rechnungUrl }].filter((d) => d.href).map((d) => (
                      <li key={d.titel}>
                        <a href={d.href!} target="_blank" rel="noreferrer">
                          <span className="gaf-dok-zeichen"><Zeichen art="dokument" groesse={20} /></span>
                          <span className="gaf-dok-titel">{d.titel}</span>
                          <span className="gaf-dok-aktion"><Zeichen art="pfeil" groesse={14} /></span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {f.fertigFuss && <p className="gkc-fertig-fuss">{f.fertigFuss}</p>}
            </div>
          </div>
        </section>
        {P.ansprechpartner.length > 0 && (
          <section className="gaf-abschnitt" aria-label={P.ansprechTitel}>
            <div className="gaf-rahmen gaf-rahmen-schmal">
              <div className="gaf-kopf"><h2 className="gaf-h2">{P.ansprechTitel}</h2></div>
              <ul className="gab-personen gkc-personen">
                {P.ansprechpartner.map((p) => {
                  const teile = p.rolle.split(" · ");
                  return (
                    <li key={p.kuerzel} className="gab-person">
                      <span className="gab-person-bild">
                        {ohneBild[p.kuerzel]
                          ? <span className="gaf-person-mono" aria-hidden="true">{p.name.split(/\s+/).map((x) => x[0]).join("").slice(0, 2)}</span>
                          : <img src={p.portrait} alt={p.alt || p.name} width={160} height={160} decoding="async" onError={() => setOhneBild((o) => ({ ...o, [p.kuerzel]: true }))} />}
                      </span>
                      <span className="gab-person-text">
                        <b>{p.name}</b>
                        <span className="gkc-rolle">
                          <span className="gkc-nb">{teile.slice(0, -1).join(" · ")}</span>
                          {teile.length > 1 && <><span className="gkc-rolle-trenner"> · </span><span className="gkc-rolle-letzt gkc-nb">{teile[teile.length - 1]}</span></>}
                        </span>
                        {p.kiHinweis && !ohneBild[p.kuerzel] && <small className="gkc-ki-hinweis">{p.kiHinweis}</small>}
                        <a href={`mailto:${p.email}?subject=${betreff}`}><Zeichen art="mail" groesse={16} /><span>{p.email}</span></a>
                        <a href={`tel:${p.telefon.replace(/\s/g, "")}`}><Zeichen art="telefon" groesse={16} /><span>{p.telefon}</span></a>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        )}
      </main>
      <footer className="gaf-fuss">
        <div className="gaf-rahmen">
          <MarkeGlobal hoehe={16} className="gaf-marke" />
          <p className="gaf-aufruf-hinweis">{ANGEBOT_AUFRUF_HINWEIS}</p>
          <p className="gaf-fuss-links"><a href="/impressum">{FERTIG_WORTE.impressum}</a> · <a href="/datenschutz">{FERTIG_WORTE.datenschutz}</a></p>
          <p className="gaf-fuss-ref">{FERTIG_WORTE.angebot} {f.ref}</p>
        </div>
      </footer>
    </div>
  );
}
