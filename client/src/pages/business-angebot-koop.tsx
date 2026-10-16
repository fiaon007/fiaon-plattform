// ═══════════════════════════════════════════════════════════════════════════
// /business/angebot/:token — DER KOOPERATIONSVERTRAG „TERMINE FÜR IHRE BERATUNG“, Register E-384
//
// Verzweigung: business-angebot.tsx lädt die Kundensicht wie immer; ist sie art === "koop" UND status === "offen",
// zeigt sie diese Seite (lazy, eigener Chunk). Angenommene Kooperationen nutzen die bestehende Ansicht „fertig“.
// Reihenfolge: Willkommen · Hero mit Preis und Menge je Woche · So läuft es · Was zu jedem Kontakt gehört · Fair für
// beide Seiten · Sauber aufgestellt · Fragen · Ansprechpartner · Vertrag · Annahme.
// Alle Inhalte kommen aus KoopKundenSicht (shared/fiaon-global-angebot-koop.ts); hart im Client stehen nur
// Bedienbeschriftungen. Bausteine der Firmen- und Begleitseite (gaf-, gab-), Eigenes mit gak- im CI Glasblau.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from "react";
import { ANGEBOT_AUFRUF_HINWEIS } from "@shared/fiaon-global-angebot";
import { koopMonatCents, koopEur, koopWunschAus, KOOP_WUNSCH, type KoopKundenSicht, type KoopAnnahmeEingabe } from "@shared/fiaon-global-angebot-koop";
import Glueckwunsch from "@/components/angebot-firma/Glueckwunsch";
import PhasenZeitstrahl from "@/components/angebot-firma/PhasenZeitstrahl";
import LeistungsKarten from "@/components/angebot-firma/LeistungsKarten";
import FragenAntworten from "@/components/angebot-firma/FragenAntworten";
import VertragsLeser from "@/components/angebot-firma/VertragsLeser";
import UnterschriftFeld, { type UnterschriftStand } from "@/components/angebot-firma/UnterschriftFeld";
import { Auf, MarkeGlobal, Zeichen, ruhig, tagDe } from "@/components/angebot-firma/gemeinsam";
import "@/styles/global-angebot-firma.css";
import "@/styles/global-angebot-begleit.css";
import "@/styles/global-angebot-koop.css";

const WORTE = {
  seitenTitel: "Ihr Kooperationsangebot · FIAON",
  angebot: "Angebot", gueltig: "gültig bis",
  vertragPdf: "Kooperationsvertrag (PDF)",
  vorschau: "Vorschau der Leitung.", vorschauSatz: "Annehmen kann nur der Partner — aus dem Chefbüro heraus ist der Knopf gesperrt.", fehlt: "Für die Annahme fehlt noch:",
  impressum: "Impressum", datenschutz: "Datenschutzerklärung",
  eigen: "Andere Zahl:",
  fehltTitel: "Bitte noch ergänzen:", sendet: "Wird gespeichert …", neuLaden: "Angebot neu laden",
  geaendert: "Das Angebot wurde inzwischen aktualisiert. Bitte laden Sie es neu und prüfen Sie es noch einmal.",
  allgemein: "Die Annahme ließ sich gerade nicht speichern. Bitte versuchen Sie es noch einmal.",
  netz: "Keine Verbindung — Ihre Annahme ist NICHT angekommen. Bitte versuchen Sie es noch einmal.",
  vorschauKnopf: "Vorschau der Leitung — annehmen kann nur der Partner.",
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

/** Menge je Woche: Stufen-Knöpfe und eine freie Zahl — ein Wert für Hero und Annahme. */
function MengenWahl({ stufen, wert, setWert, idPraefix }: { stufen: number[]; wert: number; setWert: (n: number) => void; idPraefix: string }) {
  const [frei, setFrei] = useState(stufen.includes(wert) ? "" : String(wert));
  return (
    <>
      <div className="gak-stufen" role="group">
        {stufen.map((s) => (
          <button key={s} type="button" className="gak-stufe" aria-pressed={wert === s} onClick={() => { setWert(s); setFrei(""); }}>{s}</button>
        ))}
      </div>
      <label className="gak-eigen" htmlFor={`${idPraefix}-frei`}>
        <span>{WORTE.eigen}</span>
        <input id={`${idPraefix}-frei`} type="number" inputMode="numeric" min={KOOP_WUNSCH.min} max={KOOP_WUNSCH.max} value={frei} placeholder="z. B. 15"
          onChange={(e) => { setFrei(e.target.value); const n = koopWunschAus(e.target.value); if (n) setWert(n); }} />
      </label>
    </>
  );
}

export default function BusinessAngebotKoop({ sicht, token, onAngenommen, onNeuLaden }: {
  sicht: KoopKundenSicht; token: string; onAngenommen: (antwort: unknown) => void; onNeuLaden: () => void;
}) {
  const S = sicht.seite, A = sicht.annahme, U = sicht.uebersicht, R = S.rechner;
  const [auftakt, setAuftakt] = useState<"offen" | "geht" | "vorbei">("offen");
  const [ohneBild, setOhneBild] = useState<Record<string, boolean>>({});
  const [menge, setMenge] = useState<number>(R.vorschlag);
  const [unternehmer, setUnternehmer] = useState(false);
  const [gelesen, setGelesen] = useState(false);
  const [sig, setSig] = useState<UnterschriftStand>({ da: false, eingabe: null });
  const [falle, setFalle] = useState("");
  const [zeigeFehlt, setZeigeFehlt] = useState(false);
  const [sendet, setSendet] = useState(false);
  const [fehler, setFehler] = useState("");
  const [geaendert, setGeaendert] = useState(false);
  useSeitenRahmen(WORTE.seitenTitel);
  const auftaktGeht = useCallback(() => setAuftakt((a) => (a === "offen" ? "geht" : a)), []);
  const auftaktEnde = useCallback(() => setAuftakt("vorbei"), []);

  const betreff = encodeURIComponent(`${WORTE.angebot} ${sicht.ref}`);
  const gesperrt = !sicht.annahmeBereit || !!sicht.vorschauLeitung;

  const fehlt: { id: string; text: string }[] = [];
  if (!koopWunschAus(menge)) fehlt.push({ id: "gak-annahme-menge", text: "Bitte wählen Sie die Menge je Woche." });
  if (!unternehmer) fehlt.push({ id: "gak-unternehmer", text: "Bitte bestätigen Sie, dass Sie als Unternehmer handeln." });
  if (!gelesen) fehlt.push({ id: "gak-gelesen", text: "Bitte bestätigen Sie, dass Sie den Vertrag gelesen haben." });
  if (!sig.da || !sig.eingabe) fehlt.push({ id: "gaf-unterschrift", text: A.unterschrift.fehlt });
  const zeig = (id: string) => zeigeFehlt && fehlt.some((f) => f.id === id);

  const absenden = async () => {
    if (sendet || gesperrt) return;
    if (fehlt.length) { setZeigeFehlt(true); setFehler(""); springen(fehlt[0].id); return; }
    setSendet(true); setFehler(""); setGeaendert(false);
    const eingabe: KoopAnnahmeEingabe & { falle: string } = {
      textHash: sicht.textHash, wunschWoche: menge, unternehmer: true, gelesen: true, unterschrift: sig.eingabe!, falle,
    };
    try {
      const r = await fetch(`/api/fiaon/global/angebot/${encodeURIComponent(token)}/annehmen`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(eingabe),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { onAngenommen(j); return; }
      if (r.status === 409 || j?.code === "GEAENDERT") { setGeaendert(true); setFehler(j?.error || WORTE.geaendert); return; }
      setFehler(j?.error || WORTE.allgemein);
      if (j?.code === "UNTERSCHRIFT") { setZeigeFehlt(true); springen("gaf-unterschrift"); }
    } catch {
      setFehler(WORTE.netz);
    } finally { setSendet(false); }
  };

  return (
    <div className={`gaf gab gak${auftakt === "offen" ? " gaf-wartet" : ""}`} data-fiaon="angebot-koop">
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

      {/* 1 — Hero: das Versprechen, der Preis und die Menge je Woche */}
      <section className="gab-hero" aria-label={S.hero.titel}>
        <div className="gaf-rahmen gab-hero-raster">
          <div className="gab-hero-text">
            <p className="gaf-auge">{S.hero.auge}</p>
            <h1 className="gaf-h1">{S.hero.titel}</h1>
            <p className="gab-lead">{S.hero.lead}</p>
            <ul className="gab-nutzen">{S.hero.nutzen.map((n) => <li key={n}><Zeichen art="haken" groesse={16} /><span>{n}</span></li>)}</ul>
          </div>
          <div className="gak-preis" id="preis">
            <p className="gak-preis-auge">{R.titel}</p>
            <p className="gak-preis-betrag">{S.hero.preis}</p>
            <p className="gak-preis-zeile">{S.hero.preisZeile}</p>
            <div className="gak-rechner">
              <p className="gaf-sub" style={{ marginTop: 0 }}>{R.sub}</p>
              <div style={{ marginTop: 14 }}><MengenWahl stufen={R.stufen} wert={menge} setWert={setMenge} idPraefix="gak-hero" /></div>
              <dl className="gak-werte">
                <div><dt>{R.woche}</dt><dd>{menge}</dd></div>
                <div><dt>{R.monat}</dt><dd>{(R.festMonat ?? koopEur(koopMonatCents(menge, R.preisCents)))}</dd></div>
              </dl>
              <p className="gaf-fein" style={{ marginTop: 12 }}>{R.fein}</p>
            </div>
            <p className="gak-preis-fein">{S.hero.preisFein}</p>
          </div>
        </div>
      </section>

      <main className="gaf-inhalt">
        {/* 2 — So läuft es */}
        <section className="gaf-abschnitt gaf-abschnitt-weg" id="ablauf" aria-label={S.ablauf.titel}>
          <div className="gaf-rahmen">
            <Kopf auge={S.ablauf.titel} titel={S.ablauf.sub} />
            <PhasenZeitstrahl liste={S.ablauf.liste} />
          </div>
        </section>

        {/* 3 — Was zu jedem Kontakt gehört */}
        <section className="gaf-abschnitt" id="kontakt" aria-label={S.kontakt.titel}>
          <div className="gaf-rahmen">
            <Kopf titel={S.kontakt.titel} sub={S.kontakt.sub} />
            <div className="gak-felder">
              {S.kontakt.felder.map((f, i) => (
                <Auf key={f.titel} verz={i * 80} className="gak-feld"><Zeichen art="haken" groesse={18} /><b>{f.titel}</b><span>{f.text}</span></Auf>
              ))}
            </div>
            <Auf className="gak-themen">
              <p className="gaf-auge">{S.kontakt.themenTitel}</p>
              <ul>{S.kontakt.themen.map((t) => <li key={t}>{t}</li>)}</ul>
            </Auf>
          </div>
        </section>

        {/* 4 — Fair für beide Seiten */}
        <section className="gaf-abschnitt" id="fair" aria-label={S.leistungen.titel}>
          <div className="gaf-rahmen">
            <Kopf titel={S.leistungen.titel} sub={S.leistungen.sub} />
            <LeistungsKarten karten={S.leistungen.karten} />
          </div>
        </section>

        {/* 5 — Sauber aufgestellt */}
        <section className="gaf-abschnitt" id="sauber" aria-label={S.sauber.titel}>
          <div className="gaf-rahmen">
            <Kopf titel={S.sauber.titel} sub={S.sauber.sub} />
            <div className="gak-sauber">
              {S.sauber.punkte.map((x, i) => <Auf key={x.titel} verz={i * 90} className="gak-sauber-punkt"><b>{x.titel}</b><p>{x.text}</p></Auf>)}
            </div>
          </div>
        </section>

        {/* 6 — Fragen */}
        <section className="gaf-abschnitt" id="fragen" aria-label={S.fragen.titel}>
          <div className="gaf-rahmen gaf-rahmen-schmal">
            <Kopf titel={S.fragen.titel} sub={S.fragen.sub} />
            <FragenAntworten liste={S.fragen.liste} sichtbar={S.fragen.sichtbar} />
          </div>
        </section>

        {/* 7 — Ansprechpartner */}
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

        {/* 8 — Vertrag */}
        <section className="gaf-abschnitt" id="vertrag" aria-label={S.vertrag.titel}>
          <div className="gaf-rahmen">
            <Kopf titel={S.vertrag.titel} sub={S.vertrag.sub} />
            <VertragsLeser v={S.vertrag} html={sicht.html} annehmen={{ knopf: A.knopf, onAnnehmen: () => springen("gak-annahme-menge") }} pdfs={[{ titel: WORTE.vertragPdf, href: sicht.vertragPdf }]} />
            <p className="gaf-aufruf-hinweis">{ANGEBOT_AUFRUF_HINWEIS}</p>
          </div>
        </section>

        {/* 9 — Annahme */}
        <section className="gaf-abschnitt gaf-abschnitt-annahme" id="annahme" aria-label={A.titel}>
          <div className="gaf-rahmen gaf-rahmen-schmal">
            <Kopf titel={A.titel} sub={A.sub} auge={sicht.partnerAnrede.replace(/^Sehr geehrte[r]? /, "")} />
            <div className="gaf-annahme" data-fiaon="koop-annahme">
              <div className={`gaf-annahme-feld gak-annahme-menge${zeig("gak-annahme-menge") ? " fehlt" : ""}`} id="gak-annahme-menge">
                <h3 className="gaf-h3">{A.wunsch}</h3>
                <MengenWahl stufen={R.stufen} wert={menge} setWert={setMenge} idPraefix="gak-annahme" />
                <small className="gab-unter">{menge} {A.wunschEinheit} · {A.wunschUnter}</small>
              </div>

              <div className="gaf-uebersicht">
                <h3 className="gaf-h3">{U.titel}</h3>
                <dl>{U.zeilen.map((z) => <div key={z.label}><dt>{z.label}</dt><dd>{z.wert}</dd></div>)}</dl>
              </div>

              <div className={`gaf-annahme-feld gaf-haken${zeig("gak-unternehmer") || zeig("gak-gelesen") ? " fehlt" : ""}`} role="group">
                <label className={`gaf-haken-zeile${unternehmer ? " an" : ""}`} id="gak-unternehmer">
                  <input type="checkbox" checked={unternehmer} onChange={(e) => setUnternehmer(e.target.checked)} required aria-invalid={(zeig("gak-unternehmer") && !unternehmer) || undefined} />
                  <span className="gaf-haken-kasten" aria-hidden="true"><Zeichen art="haken" groesse={14} /></span>
                  <span>{A.unternehmer}</span>
                </label>
                <label className={`gaf-haken-zeile${gelesen ? " an" : ""}`} id="gak-gelesen">
                  <input type="checkbox" checked={gelesen} onChange={(e) => setGelesen(e.target.checked)} required aria-invalid={(zeig("gak-gelesen") && !gelesen) || undefined} />
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
                  <button type="button" className="gaf-knopf-annehmen" onClick={absenden} disabled={sendet} data-fiaon="koop-annehmen">
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
                  <button type="button" className="gaf-knopf-annehmen" disabled aria-describedby="gak-gesperrt">{A.knopf}</button>
                  <p className="gaf-gesperrt" id="gak-gesperrt">{sicht.vorschauLeitung ? WORTE.vorschauKnopf : (sicht.gesperrtGrund || A.gesperrt)}</p>
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
