// ═══════════════════════════════════════════════════════════════════════════
// /business/angebot/:token — DER BEGLEITVERTRAG FÜR BESTANDSKUNDEN, Register E-312
//
// Verzweigung: business-angebot.tsx lädt die Kundensicht wie immer; ist sie art === "begleit" UND status === "offen",
// zeigt sie diese Seite (lazy, eigener Chunk). Angenommene Begleitverträge nutzen die bestehende Ansicht „fertig“.
//
// Justin (08.10.2026): „Mach ihm die Seite so, dass er begeistert ist, seinen Gesellschaftsnamen wählen kann … präsentiert
// soll ihm werden, dass er kein Abo mehr bezahlt.“ Reihenfolge: Glückwunsch · Hero mit Namenswahl (Live-Vorschau der
// Articles of Organization) · Was sich ändert (bisher/ab heute) · Rechner „Wir gewinnen nur, wenn Sie gewinnen“ · Ihr Weg ·
// Was Sie bekommen · Jahresbetreuung (freiwillig) · Fragen · Ansprechpartner · Vertrag · Annahme.
// Alle Inhalte kommen aus BegleitKundenSicht (shared/fiaon-global-angebot-begleit.ts); hart im Client stehen nur
// Bedienbeschriftungen. Gestaltung und Bausteine der Firmenseite (global-angebot-firma.css, gaf-), Eigenes mit gab-.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from "react";
import { ANGEBOT_AUFRUF_HINWEIS } from "@shared/fiaon-global-angebot";
import { llcVollname, llcNameFehler, begleitHonorarUsd, type BegleitKundenSicht, type BegleitLlcWahl, type BegleitAnnahmeEingabe } from "@shared/fiaon-global-angebot-begleit";
import Glueckwunsch from "@/components/angebot-firma/Glueckwunsch";
import PhasenZeitstrahl from "@/components/angebot-firma/PhasenZeitstrahl";
import LeistungsKarten from "@/components/angebot-firma/LeistungsKarten";
import FragenAntworten from "@/components/angebot-firma/FragenAntworten";
import VertragsLeser from "@/components/angebot-firma/VertragsLeser";
import UnterschriftFeld, { type UnterschriftStand } from "@/components/angebot-firma/UnterschriftFeld";
import { Auf, MarkeGlobal, Zeichen, ruhig, tagDe } from "@/components/angebot-firma/gemeinsam";
import "@/styles/global-angebot-firma.css";
import "@/styles/global-angebot-begleit.css";

const WORTE = {
  seitenTitel: "Ihr persönliches Angebot · FIAON Global",
  angebot: "Angebot", gueltig: "gültig bis", zurAnnahme: "Zum Auftrag",
  vertragPdf: "Vertrag mit Widerrufsbelehrung",
  vorschau: "Vorschau der Leitung.", vorschauSatz: "Annehmen kann nur der Kunde — aus dem Chefbüro heraus ist der Knopf gesperrt.", fehlt: "Für die Annahme fehlt noch:",
  impressum: "Impressum", datenschutz: "Datenschutzerklärung",
  nameUebernehmen: "Name übernehmen", zumNamen: "Namen wählen",
  fehltTitel: "Bitte noch ergänzen:", sendet: "Wird gespeichert …", neuLaden: "Angebot neu laden",
  geaendert: "Das Angebot wurde inzwischen aktualisiert. Bitte laden Sie es neu und prüfen Sie es noch einmal.",
  allgemein: "Der Auftrag ließ sich gerade nicht speichern. Bitte versuchen Sie es noch einmal.",
  netz: "Keine Verbindung — Ihr Auftrag ist NICHT angekommen. Bitte versuchen Sie es noch einmal.",
  vorschauKnopf: "Vorschau der Leitung — annehmen kann nur der Kunde.",
  freiwillig: "Freiwillig",
};

/** Seitenkopf, noindex, Dokument scrollt (wie die Firmenseite). */
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

const usd = (n: number) => `${Math.round(n).toLocaleString("de-DE")} USD`;
const springen = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ block: "center", behavior: ruhig() ? "auto" : "smooth" });
  const feld = el.querySelector<HTMLElement>("input, canvas, button") ?? el;
  window.setTimeout(() => feld.focus({ preventScroll: true }), ruhig() ? 0 : 350);
};

// ── Die Urkunde: Live-Vorschau des Namens ─────────────────────────────────────
function Urkunde({ t, name, staat }: { t: BegleitKundenSicht["seite"]["llc"]; name: string; staat: string }) {
  const voll = llcVollname(name);
  return (
    <div className="gab-urkunde" aria-live="polite">
      <div className="gab-urkunde-kopf">
        <span className="gab-urkunde-auge">Articles of Organization</span>
        <span className="gab-siegel" aria-hidden="true"><Zeichen art="siegel" groesse={26} /></span>
      </div>
      <p className="gab-urkunde-zeile">{t.vorschauZeile}</p>
      <p className={`gab-urkunde-name${voll ? "" : " leer"}`}>{voll || t.vorschauLeer}</p>
      <div className="gab-urkunde-fuss"><span>{staat} · Document No. nach Eintragung</span><span>{t.vorschauFuss}</span></div>
    </div>
  );
}

function NamensFelder({ t, wahl, setWahl, fehler, kompakt = false, idPraefix }: {
  t: BegleitKundenSicht["seite"]["llc"]; wahl: BegleitLlcWahl; setWahl: (w: BegleitLlcWahl) => void;
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
        {feld("alternative1", kompakt ? t.alternative1 : t.alternative1, "")}
        {feld("alternative2", t.alternative2, "")}
      </div>
      {!kompakt && <p className="gaf-fein">{t.alternativenSub}</p>}
    </div>
  );
}

// ── Rechner: Kapital → Honorar → bleibt ───────────────────────────────────────
function Rechner({ r }: { r: BegleitKundenSicht["seite"]["rechner"] }) {
  const [wert, setWert] = useState(r.startUsd);
  const honorar = begleitHonorarUsd(wert, r.prozent);
  const anteil = Math.max(4, Math.min(100, (wert / r.maxUsd) * 100));
  return (
    <div className="gab-rechner" data-fiaon="begleit-rechner">
      <label className="gab-rechner-regler">
        <span className="gaf-nur-leser">{r.kapital}</span>
        <input type="range" min={r.minUsd} max={r.maxUsd} step={r.schrittUsd} value={wert} onChange={(e) => setWert(Number(e.target.value))}
          style={{ ["--anteil" as string]: `${anteil}%` }} aria-valuetext={usd(wert)} />
      </label>
      <dl className="gab-rechner-werte">
        <div><dt>{r.kapital}</dt><dd className="gab-gold">{usd(wert)}</dd></div>
        <div><dt>{r.honorar}</dt><dd>{usd(honorar)}</dd></div>
        <div className="bleibt"><dt>{r.bleibt}</dt><dd>{usd(wert - honorar)}</dd></div>
      </dl>
      <p className="gaf-fein">{r.fein}</p>
    </div>
  );
}

export default function BusinessAngebotBegleit({ sicht, token, onAngenommen, onNeuLaden }: {
  sicht: BegleitKundenSicht; token: string; onAngenommen: (antwort: unknown) => void; onNeuLaden: () => void;
}) {
  const [auftakt, setAuftakt] = useState<"offen" | "geht" | "vorbei">("offen");
  const [ohneBild, setOhneBild] = useState<Record<string, boolean>>({});
  const [wahl, setWahl] = useState<BegleitLlcWahl>({ wunsch: "", alternative1: "", alternative2: "" });
  const [gelesen, setGelesen] = useState(false);
  const [sofort, setSofort] = useState(false);
  const [jahr, setJahr] = useState(false);
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

  const S = sicht.seite, A = sicht.annahme, U = sicht.uebersicht, T = S.llc;
  const staat = S.hero.staat;
  const betreff = encodeURIComponent(`${WORTE.angebot} ${sicht.ref}`);
  const gesperrt = !sicht.annahmeBereit || !!sicht.vorschauLeitung;

  // Feldfehler der Namen: sofort sichtbar, sobald getippt wurde; „Pflicht“ erst nach dem ersten Klick auf den Knopf.
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
  if (llcNameFehler(wahl.wunsch, true) || nameFehler.alternative1 || nameFehler.alternative2) fehlt.push({ id: "gab-annahme-namen", text: llcNameFehler(wahl.wunsch, true) ?? nameFehler.alternative1 ?? nameFehler.alternative2 ?? T.fehltWunsch });
  if (!gelesen) fehlt.push({ id: "gab-gelesen", text: "Bitte bestätigen Sie, dass Sie den Vertrag gelesen haben." });
  if (!sig.da || !sig.eingabe) fehlt.push({ id: "gaf-unterschrift", text: A.unterschrift.fehlt });
  const zeig = (id: string) => zeigeFehlt && fehlt.some((f) => f.id === id);

  const absenden = async () => {
    if (sendet || gesperrt) return;
    if (fehlt.length) { setZeigeFehlt(true); setFehler(""); springen(fehlt[0].id); return; }
    setSendet(true); setFehler(""); setGeaendert(false); setServerFeld(null);
    const eingabe: BegleitAnnahmeEingabe & { falle: string } = {
      textHash: sicht.textHash, llc: wahl, sofortBeginn: sofort, jahresbetreuung: jahr, gelesen: true, unterschrift: sig.eingabe!, falle,
    };
    try {
      const r = await fetch(`/api/fiaon/global/angebot/${encodeURIComponent(token)}/annehmen`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(eingabe),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { onAngenommen(j); return; }
      if (r.status === 409 || j?.code === "GEAENDERT") { setGeaendert(true); setFehler(j?.error || WORTE.geaendert); return; }
      setFehler(j?.error || WORTE.allgemein);
      if (j?.code === "LLC" && j?.feld) { setServerFeld({ feld: j.feld, text: j.error }); springen("gab-annahme-namen"); }
      if (j?.code === "UNTERSCHRIFT") { setZeigeFehlt(true); springen("gaf-unterschrift"); }
    } catch {
      setFehler(WORTE.netz);
    } finally { setSendet(false); }
  };

  return (
    <div className={`gaf gab${auftakt === "offen" ? " gaf-wartet" : ""}`} data-fiaon="angebot-begleit">
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

      {/* 1 — Hero: kein Abo mehr, das Kapital, und der Name der Gesellschaft mit Live-Urkunde */}
      <section className="gab-hero" aria-label={S.hero.titel}>
        <div className="gaf-rahmen gab-hero-raster">
          <div className="gab-hero-text">
            <p className="gaf-auge gaf-auge-gold">{S.hero.auge}</p>
            <h1 className="gaf-h1">{S.hero.titel}</h1>
            <p className="gab-lead">{S.hero.lead}</p>
            <ul className="gab-nutzen">{S.hero.nutzen.map((n) => <li key={n}><Zeichen art="haken" groesse={16} /><span>{n}</span></li>)}</ul>
            <div className="gab-hero-kapital">
              <p className="gab-hero-betrag">{S.hero.kapital}</p>
              <p className="gab-hero-satz">{S.hero.kapitalSatz}</p>
            </div>
          </div>
          <div className="gab-hero-name" id="name">
            <p className="gaf-auge">{T.titel}</p>
            <p className="gab-name-sub">{T.sub}</p>
            <Urkunde t={T} name={wahl.wunsch} staat={staat} />
            <NamensFelder t={T} wahl={wahl} setWahl={(w) => { setWahl(w); setServerFeld(null); }} fehler={nameFehler} idPraefix="gab-hero" />
            <p className="gab-hinweis">{T.hinweis}</p>
          </div>
        </div>
      </section>

      <main className="gaf-inhalt">
        {/* 2 — Was sich ändert: bisher / ab heute */}
        <section className="gaf-abschnitt" id="aenderung" aria-label={S.vergleich.titel}>
          <div className="gaf-rahmen">
            <Kopf titel={S.vergleich.titel} sub={S.vergleich.sub} />
            <Auf className="gab-vergleich">
              <div className="gab-vergleich-kopf" aria-hidden="true"><span /><span>{S.vergleich.vorherKopf}</span><span>{S.vergleich.jetztKopf}</span></div>
              {S.vergleich.zeilen.map((z) => (
                <div className="gab-vergleich-zeile" key={z.titel}>
                  <div className="gab-vergleich-titel"><b>{z.titel}</b>{z.fein && <span>{z.fein}</span>}</div>
                  <div className="gab-vorher"><span className="gaf-nur-leser">{S.vergleich.vorherKopf}: </span>{z.vorher}</div>
                  <div className="gab-jetzt"><span className="gaf-nur-leser">{S.vergleich.jetztKopf}: </span>{z.jetzt}</div>
                </div>
              ))}
            </Auf>
            <p className="gaf-fein gab-vergleich-fein">{S.vergleich.fein}</p>
            {S.vergleich.erledigt.length > 0 && (
              <Auf className="gab-erledigt">
                <p className="gaf-auge">{S.vergleich.erledigtTitel}</p>
                <ul>{S.vergleich.erledigt.map((x) => <li key={x.titel}><Zeichen art="haken" groesse={15} /><span>{x.titel}</span><b>{x.betrag}</b></li>)}</ul>
              </Auf>
            )}
          </div>
        </section>

        {/* 3 — Rechner */}
        <section className="gaf-abschnitt gab-abschnitt-rechner" id="rechner" aria-label={S.rechner.titel}>
          <div className="gaf-rahmen gaf-rahmen-schmal">
            <Kopf titel={S.rechner.titel} sub={S.rechner.sub} />
            <Auf><Rechner r={S.rechner} /></Auf>
          </div>
        </section>

        {/* 4 — Ihr Weg */}
        <section className="gaf-abschnitt gaf-abschnitt-weg" id="weg" aria-label={S.phasen.titel}>
          <div className="gaf-rahmen">
            <Kopf auge={S.phasen.titel} titel={S.phasen.sub} />
            <PhasenZeitstrahl liste={S.phasen.liste} />
          </div>
        </section>

        {/* 5 — Was Sie bekommen */}
        <section className="gaf-abschnitt" id="leistungen" aria-label={S.leistungen.titel}>
          <div className="gaf-rahmen">
            <Kopf titel={S.leistungen.titel} sub={S.leistungen.sub} />
            <LeistungsKarten karten={S.leistungen.karten} />
          </div>
        </section>

        {/* 6 — Jahresbetreuung (freiwillig) */}
        <section className="gaf-abschnitt" id="jahresbetreuung" aria-label={S.jahresbetreuung.titel}>
          <div className="gaf-rahmen">
            <Auf className="gab-jahr">
              <div>
                <p className="gaf-auge">{WORTE.freiwillig} · {S.jahresbetreuung.preis}</p>
                <h2 className="gaf-h3 gab-jahr-titel">{S.jahresbetreuung.titel}</h2>
                <p className="gaf-sub">{S.jahresbetreuung.lead}</p>
              </div>
              <ul>{S.jahresbetreuung.punkte.map((x) => <li key={x}><Zeichen art="haken" groesse={15} /><span>{x}</span></li>)}</ul>
              <p className="gaf-fein gab-jahr-fein">{S.jahresbetreuung.fein}</p>
            </Auf>
          </div>
        </section>

        {/* 7 — Fragen */}
        <section className="gaf-abschnitt" id="fragen" aria-label={S.fragen.titel}>
          <div className="gaf-rahmen gaf-rahmen-schmal">
            <Kopf titel={S.fragen.titel} sub={S.fragen.sub} />
            <FragenAntworten liste={S.fragen.liste} sichtbar={S.fragen.sichtbar} />
          </div>
        </section>

        {/* 8 — Ansprechpartner */}
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
          </div>
        </section>

        {/* 9 — Vertrag */}
        <section className="gaf-abschnitt" id="vertrag" aria-label={S.vertrag.titel}>
          <div className="gaf-rahmen">
            <Kopf titel={S.vertrag.titel} sub={S.vertrag.sub} />
            <VertragsLeser v={S.vertrag} html={sicht.html} annehmen={{ knopf: A.knopf, onAnnehmen: () => springen("gab-annahme-namen") }} pdfs={[{ titel: WORTE.vertragPdf, href: sicht.vertragPdf }]} />
            <p className="gaf-aufruf-hinweis">{ANGEBOT_AUFRUF_HINWEIS}</p>
          </div>
        </section>

        {/* 10 — Annahme */}
        <section className="gaf-abschnitt gaf-abschnitt-annahme" id="annahme" aria-label={A.titel}>
          <div className="gaf-rahmen gaf-rahmen-schmal">
            <Kopf titel={A.titel} sub={A.sub} auge={sicht.kundeAnrede.replace(/^Sehr geehrte[r]? /, "")} />
            <div className="gaf-annahme" data-fiaon="begleit-annahme">
              <div className={`gaf-annahme-feld gab-annahme-namen${zeig("gab-annahme-namen") ? " fehlt" : ""}`} id="gab-annahme-namen">
                <h3 className="gaf-h3">{T.titel}</h3>
                <NamensFelder t={T} wahl={wahl} setWahl={(w) => { setWahl(w); setServerFeld(null); }} fehler={nameFehler} kompakt idPraefix="gab-annahme" />
                {llcVollname(wahl.wunsch) && <p className="gab-annahme-vorschau">{llcVollname(wahl.wunsch)}</p>}
              </div>

              <div className="gaf-annahme-feld gaf-haken" role="group">
                <label className={`gaf-haken-zeile${sofort ? " an" : ""}`}>
                  <input type="checkbox" checked={sofort} onChange={(e) => setSofort(e.target.checked)} />
                  <span className="gaf-haken-kasten" aria-hidden="true"><Zeichen art="haken" groesse={14} /></span>
                  <span>{A.sofortBeginn}<small className="gab-unter">{A.sofortBeginnUnter}</small></span>
                </label>
                <label className={`gaf-haken-zeile${jahr ? " an" : ""}`}>
                  <input type="checkbox" checked={jahr} onChange={(e) => setJahr(e.target.checked)} />
                  <span className="gaf-haken-kasten" aria-hidden="true"><Zeichen art="haken" groesse={14} /></span>
                  <span>{A.jahresbetreuung}<small className="gab-unter">{A.jahresbetreuungUnter}</small></span>
                </label>
              </div>

              <div className="gaf-uebersicht">
                <h3 className="gaf-h3">{U.titel}</h3>
                <dl>{U.zeilen.map((z) => <div key={z.label}><dt>{z.label}</dt><dd>{z.wert}</dd></div>)}</dl>
              </div>

              <div className={`gaf-annahme-feld gaf-haken${zeig("gab-gelesen") ? " fehlt" : ""}`} id="gab-gelesen" role="group">
                <label className={`gaf-haken-zeile${gelesen ? " an" : ""}`}>
                  <input type="checkbox" checked={gelesen} onChange={(e) => setGelesen(e.target.checked)} required aria-invalid={(zeig("gab-gelesen") && !gelesen) || undefined} />
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
                  <button type="button" className="gaf-knopf-annehmen" onClick={absenden} disabled={sendet} data-fiaon="begleit-annehmen">
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
                  <button type="button" className="gaf-knopf-annehmen" disabled aria-describedby="gab-gesperrt">{A.knopf}</button>
                  <p className="gaf-gesperrt" id="gab-gesperrt">{sicht.vorschauLeitung ? WORTE.vorschauKnopf : (sicht.gesperrtGrund || A.gesperrt)}</p>
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
