// ═══════════════════════════════════════════════════════════════════════════
// DER KONFIGURATOR — das Herz des Verkaufsmotors von FIAON Global (Register E-509, 12.11.2026)
//
// Justin: „… kann man auswählen für was man sich interessiert — Funding, Kreditkarte, Unternehmensberatung … und dann
// soll er seine Funding Summe auswählen — beginnend bei 50k $ endet bei 1 Mio … und dann eben unsere Preise — einfach so
// gestalten dass der Kunde selbstständig abschließen kann.“
//
// Drei Dinge auf einer Fläche (die EINE dunkle Glasfläche der Seite): Schwerpunkte wählen, Kapitalrahmen schieben,
// Preis lesen. Dann die Angaben — und das Angebot öffnet sich. Jede Zahl rechnet mit denselben Funktionen wie der
// Vertrag (shared/fiaon-global-verkauf.ts → kapitalCStaffelHonorarCents); jeder Satz steht dort, die Wortwand liest ihn.
// Welcher Weg am Ende gilt (Selbstabschluss oder persönlich), sagt verkaufWeg — dieselbe Funktion wie auf dem Server.
//
// ZWEI ARTEN, DIESELBE FLÄCHE (12.11.2026): Der Server sagt beim Laden, ob für DIESEN Besucher sofort ein Angebot entsteht
// (sicht.an). Wenn nicht (Notschalter, Probebetrieb), bleibt alles gleich — nur verspricht kein Satz und kein Knopf mehr,
// dass sich das Angebot sofort öffnet: Es kommt persönlich (K.persoenlich). Für den Besucher ist das kein Hinweis auf einen
// Probebetrieb, sondern schlicht der persönliche Weg.
//
// BEWEGUNG (Feinschliff 13.11.2026, Justin: „achte auf die Formatierung … ein paar mehr Animationen“) — bewegt wird nur
// transform und opacity, alles läuft einmal oder beim Bedienen, nichts hängt an der Scrollposition:
//   · Zahlen ROLLEN zum neuen Wert: Nur die Ziffern, die sich ändern, gleiten (RollZahl) — keine springenden Ziffern.
//     Die große Zahl steht in natürlicher Ziffernbreite (keine Lücke nach der 1), die Einheit klein daneben; im
//     Preisblatt stehen Tabellenziffern mit fester Breite, damit links nichts neu umbricht.
//   · Der Regler: Der echte Schieberegler liegt unsichtbar darüber (Tastatur, Screenreader, Finger wie gewohnt);
//     gezeichnet werden Spur, Füllung und Daumen, die weich zum nächsten Rasterpunkt gleiten.
//   · Das Preisblatt hat drei Lagen (Preis, Miami, ohne Kapital) im selben Feld — der Wechsel ist eine Überblendung,
//     das Blatt behält seine Höhe, der Knopf seinen Platz.
//   · Der Schritt zu „Ihre Angaben“ gleitet (hinaus nach links, herein von rechts; zurück umgekehrt).
//   · Am Handy gleitet eine Leiste mit dem Preis herein, solange das Blatt selbst noch nicht im Bild ist.
// Bei „weniger Bewegung“ steht alles sofort; Screenreader bekommen nur den Endwert (ein ruhiger Satz, aria-live).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import {
  VERKAUF_TEXTE, VERKAUF_RAHMEN, VERKAUF_INTERESSEN, VERKAUF_LAENDER, VERKAUF_PREISE,
  verkaufStopps, verkaufPreis, verkaufEur, verkaufUsd, verkaufWeg, verkaufStoppNahe, verkaufUsdAusPaket,
  type VerkaufInteresse, type VerkaufLand, type VerkaufSprache, type VerkaufFeld,
} from "@shared/fiaon-global-verkauf";
import { useVerkaufSicht, verkaufTag, verkaufKurs } from "@/lib/verkauf";
import { ruhigGewuenscht, useEinmalSichtbar } from "@/components/site/global/bewegung";
import { sauber as W } from "@/components/site/global/VerkaufSatz";
import { werbeEreignis, kampagne } from "@/lib/werbung";
import "@/styles/global-verkauf.css";

// ── Eine Zahl, deren Ziffern einzeln zum neuen Wert rollen ──────────────────
// Jede Stelle hat ihren festen Platz (von rechts gezählt). Ändert sich ein Zeichen, gleitet das alte hinaus und das neue
// herein — steigt der Wert, von unten nach oben, sinkt er, von oben nach unten. Was gleich bleibt, steht still. Wird die
// Zahl länger oder kürzer, erscheint sie als Ganzes neu (die Plätze verschieben sich ohnehin). Nur Anzeige (aria-hidden):
// Wer die Zahl vorgelesen bekommt, hört den Endwert aus dem Text daneben.
interface RollPlatz { z: string; alt: string | null; n: number; hoch: boolean }
interface RollStand { text: string; wert: number; n: number; plaetze: RollPlatz[] }
function RollZahl({ text, wert }: { text: string; wert: number }) {
  const [gemerkt, setGemerkt] = useState<RollStand>(() => ({ text, wert, n: 0, plaetze: Array.from(text).reverse().map((z) => ({ z, alt: null, n: 0, hoch: true })) }));
  let s = gemerkt;
  if (gemerkt.text !== text) {
    const neu = Array.from(text).reverse(); const n = gemerkt.n + 1; const hoch = wert >= gemerkt.wert;
    const gleichLang = neu.length === gemerkt.plaetze.length;
    s = { text, wert, n, plaetze: neu.map((z, p) => { const v = gemerkt.plaetze[p]; return gleichLang && v.z === z ? v : { z, alt: gleichLang ? v.z : null, n, hoch }; }) };
    setGemerkt(s);
  }
  const letzter = s.plaetze.length - 1;
  return (
    <span className="vk-roll" aria-hidden="true">
      {s.plaetze.map((p, i) => (
        <span key={i} className="vk-roll-platz" data-r={p.n ? (p.hoch ? "hoch" : "runter") : undefined} style={p.n ? { ["--s" as string]: String(Math.min(letzter - i, 6)) } : undefined}>
          {p.alt !== null && <span key={`a${p.n}`} className="vk-roll-raus">{p.alt}</span>}
          <span key={`z${p.n}`} className={p.n ? "vk-roll-rein" : undefined}>{p.z}</span>
        </span>
      )).reverse()}
    </span>
  );
}

type Schritt = "wahl" | "kontakt" | "fertig";
interface Ergebnis { art: "angebot" | "mail" | "anfrage"; titel?: string; text: string; url?: string; knopf?: string }
const Pfeil = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 8h9M8.5 4.5L12 8l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
/**
 * Die feinen Bögen der beiden persönlichen Lagen des Preisblatts („Persönlich in Miami“, ohne Kapital): Kreise um die untere
 * rechte Ecke ihres Feldes, von denen je ein Viertel zu sehen ist. Sie wachsen einmal aus der Ecke (nur transform und opacity,
 * als Übergang — der Endzustand steht auch, wenn das Feld beim Wechsel außerhalb des Bildes lag). Reiner Schmuck (aria-hidden):
 * Sie füllen das Blatt, wo sonst die Zahlen stehen, damit es in jeder Lage gleich hoch und ruhig bleibt.
 */
const Boegen = () => (
  <div className="vk-boegen" aria-hidden="true">
    {[0, 1, 2, 3, 4, 5, 6].map((i) => <i key={i} style={{ ["--i" as string]: String(i) }} />)}
  </div>
);

/**
 * Der Lead über dem Konfigurator (Startseite und /business/start): Der erste Satz steht sofort, der zweite blendet ein,
 * sobald der Server gesagt hat, welcher Weg für diesen Besucher gilt — so steht nie ein Versprechen da, das nicht stimmt,
 * und nichts springt (der Platz ist mit dem Satz des Selbstabschlusses reserviert, unsichtbar bis zur Antwort).
 */
export function VerkaufKonfigLead({ sprache }: { sprache: VerkaufSprache }) {
  const K = VERKAUF_TEXTE[sprache].konfig;
  const { sicht } = useVerkaufSicht();
  return (
    <p className="fg-lead">
      {K.leadA} <span className={`vk-lead-b${sicht.geladen ? " da" : ""}`} aria-hidden={!sicht.geladen}>{W(sicht.geladen && !sicht.an ? K.persoenlich.leadB : K.leadB)}</span>
    </p>
  );
}

export default function VerkaufKonfigurator({ sprache, eigeneSeite = false }: { sprache: VerkaufSprache; eigeneSeite?: boolean }) {
  const T = VERKAUF_TEXTE[sprache]; const K = T.konfig; const en = sprache === "en";
  const { sicht, neu } = useVerkaufSicht();
  const wurzel = useRef<HTMLDivElement>(null);
  const flaeche = useRef<HTMLDivElement>(null);
  const knopf = useRef<HTMLButtonElement>(null);
  useEinmalSichtbar(wurzel, 0, "0px 0px -18% 0px");
  const id = useId();

  // Die Rasterpunkte — ein Deckel aus der Einstellung schneidet den Selbstabschluss ab, die Million bleibt der Miami-Fall.
  const stopps = useMemo(() => verkaufStopps().filter((u) => u <= sicht.selbstMaxUsd || u === VERKAUF_RAHMEN.maxUsd), [sicht.selbstMaxUsd]);
  const [interessen, setInteressen] = useState<VerkaufInteresse[]>(["kapital"]);
  const [usd, setUsd] = useState<number>(VERKAUF_RAHMEN.startUsd);
  const [schritt, setSchritt] = useState<Schritt>("wahl");
  // Der Wechsel zwischen den Schritten: „raus“ = der alte Inhalt gleitet hinaus; n zählt die Wechsel (der erste Auftritt gleitet nicht).
  const [gleiten, setGleiten] = useState({ raus: false, vor: true, n: 0 });
  const [form, setForm] = useState({ anrede: "" as "" | "Herr" | "Frau", vorname: "", nachname: "", email: "", telefon: "", land: "DE" as VerkaufLand, bestand: false, nachricht: "", falle: "" });
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<{ feld?: VerkaufFeld; text: string } | null>(null);
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  // Die Leiste am Handy: an, solange die Fläche im Bild steht und der Knopf des Preisblatts noch nicht erreicht ist.
  const [leiste, setLeiste] = useState(false);

  // Alte Links: ?rahmen=250000 oder ?paket=global_kapital stellen den Regler.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const r = Number(q.get("rahmen")); const p = verkaufUsdAusPaket(q.get("paket"));
    const wunsch = Number.isFinite(r) && r > 0 ? r : p;
    if (wunsch) setUsd(verkaufStoppNahe(wunsch));
  }, []);
  useEffect(() => { if (!stopps.includes(usd)) setUsd(stopps.reduce((b, x) => (Math.abs(x - usd) < Math.abs(b - usd) ? x : b), stopps[0])); }, [stopps, usd]);

  const mitKapital = interessen.includes("kapital");
  const index = Math.max(0, stopps.indexOf(usd));
  const preis = verkaufPreis(Math.min(usd, VERKAUF_RAHMEN.maxUsd), sicht.kursUsdJeEur);
  const weg = verkaufWeg({ interessen, usd, land: form.land, bestand: form.bestand });
  const wegVorKontakt = verkaufWeg({ interessen, usd, land: "DE", bestand: false });
  const miami = mitKapital && usd >= VERKAUF_RAHMEN.maxUsd;
  // Welche Lage das Preisblatt zeigt.
  const lage: "preis" | "miami" | "ohne" = miami ? "miami" : mitKapital ? "preis" : "ohne";

  const umschalten = (k: VerkaufInteresse) => setInteressen((alt) => (alt.includes(k) ? (alt.length > 1 ? alt.filter((x) => x !== k) : alt) : VERKAUF_INTERESSEN.filter((x) => x === k || alt.includes(x))));
  const feld = (name: keyof typeof form) => (ev: { target: { value: string } }) => { setForm((f) => ({ ...f, [name]: ev.target.value })); if (fehler) setFehler(null); };

  // Von einem Schritt zum nächsten: erst gleitet der alte Inhalt hinaus (0,23 s), dann kommt der neue. Bei „weniger Bewegung“ sofort.
  const uhr = useRef(0);
  useEffect(() => () => window.clearTimeout(uhr.current), []);
  const wechseln = (ziel: Schritt, vor: boolean, danach?: () => void) => {
    window.clearTimeout(uhr.current);
    const da = () => { setGleiten((g) => ({ raus: false, vor, n: g.n + 1 })); setSchritt(ziel); if (danach) requestAnimationFrame(danach); };
    if (ruhigGewuenscht()) { da(); return; }
    setGleiten((g) => ({ ...g, raus: true, vor }));
    uhr.current = window.setTimeout(da, 230);
  };

  const zuKontakt = () => {
    werbeEreignis("global_beauftragen_klick", { seite: window.location.pathname, ort: "konfigurator", rahmen: usd });
    wechseln("kontakt", true, () => document.getElementById(`${id}-vorname`)?.focus({ preventScroll: true }));
    wurzel.current?.scrollIntoView({ behavior: ruhigGewuenscht() ? "auto" : "smooth", block: "start" });
  };

  // Die Leiste (nur in einer Spalte sichtbar, CSS): Fläche im mittleren Band des Bildes UND der Knopf des Blatts weder im Bild
  // noch schon überscrollt. Zwei Beobachter, kein Scroll-Lauscher.
  useEffect(() => {
    const f = flaeche.current; const k = knopf.current;
    if (schritt !== "wahl" || !f || !k || typeof IntersectionObserver === "undefined") { setLeiste(false); return; }
    let imBand = false; let erreicht = false;
    const melden = () => setLeiste(imBand && !erreicht);
    const band = new IntersectionObserver(([e]) => { imBand = e.isIntersecting; melden(); }, { rootMargin: "-40% 0px -25% 0px" });
    const ziel = new IntersectionObserver(([e]) => { erreicht = e.isIntersecting || e.boundingClientRect.top < (e.rootBounds?.top ?? 0); melden(); }, { rootMargin: "0px 0px -88px 0px" });
    band.observe(f); ziel.observe(k);
    return () => { band.disconnect(); ziel.disconnect(); };
  }, [schritt]);

  async function absenden(ev: FormEvent) {
    ev.preventDefault();
    if (laeuft) return;
    setLaeuft(true); setFehler(null);
    const senden = async (siegel: string) => {
      const res = await fetch("/api/fiaon/global/verkauf/start", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({ sprache, interessen, usd, land: form.land, bestand: form.bestand, anrede: form.anrede, vorname: form.vorname, nachname: form.nachname, email: form.email, telefon: form.telefon, nachricht: form.nachricht, falle: form.falle, siegel, kampagne: kampagne() }),
      });
      return { status: res.status, d: await res.json().catch(() => ({})) as Record<string, any> };
    };
    try {
      let a = await senden(sicht.siegel);
      // Das Siegel ist abgelaufen (die Seite stand lange offen): ein frisches holen, die Mindestzeit abwarten, noch einmal.
      if (a.status === 409 && a.d?.code === "SIEGEL_ALT") {
        const frisch = await neu();
        await new Promise((r) => setTimeout(r, 4300));
        a = await senden(frisch.siegel);
      }
      if (a.d?.ok) {
        const art = a.d.art as Ergebnis["art"];
        werbeEreignis("global_konfigurator", { art, weg: String(a.d.weg ?? "abschluss"), rahmen: usd });
        // „aus“: Der Weg wäre der Selbstabschluss gewesen, das Angebot kommt aber persönlich (Notschalter, Probebetrieb, Grenze).
        setErgebnis({ art, titel: a.d.titel ?? (a.d.aus ? K.persoenlich.titel : undefined), text: art === "anfrage" ? String(a.d.danke ?? "") : String(a.d.text ?? ""), url: a.d.url, knopf: a.d.knopf });
        wechseln("fertig", true);
        if (art === "angebot" && a.d.url) window.setTimeout(() => window.location.assign(String(a.d.url)), ruhigGewuenscht() ? 300 : 1700);
      } else {
        setFehler({ feld: a.d?.feld, text: a.status === 429 ? K.fehler.zuViel : String(a.d?.error || K.fehler.netz) });
        if (a.d?.feld) document.getElementById(`${id}-${a.d.feld}`)?.focus();
      }
    } catch {
      setFehler({ text: K.fehler.netz });
    } finally {
      setLaeuft(false);
    }
  }

  const fuellung = stopps.length > 1 ? index / (stopps.length - 1) : 0;
  const abschluss = weg === "abschluss";
  const hinweisWeg = weg !== "abschluss" ? K.wege[weg] : null;
  // Öffnet sich das Angebot gleich nach dem Absenden? Nur im Selbstabschluss UND wenn er für diesen Besucher frei ist.
  const sofort = abschluss && sicht.an;

  // Die große Zahl: Betrag und Einheit getrennt gesetzt (deutsch „150.000“ + „US-$“, englisch „US$“ + „150,000“).
  const zahlText = miami ? (en ? "1m +" : "1 Mio.") : verkaufUsd(usd, sprache).replace(en ? "US$" : " US-$", "");
  const einheit = en ? "US$" : miami ? "US-$ +" : "US-$";
  /** Ein Betrag des Preisblatts: sichtbar rollen die Ziffern, vorgelesen wird der Endwert. */
  const betrag = (cents: number) => { const t = verkaufEur(cents, sprache); return <><span className="vk-nur-sr">{t}</span><RollZahl text={t} wert={cents} /></>; };
  const zeileHeute = <div><dt>{K.blatt.heute}<small>{K.blatt.heuteText}</small></dt><dd>{verkaufEur(VERKAUF_PREISE.gruendungCents, sprache)}</dd></div>;
  const zeileJahr2 = <div className="leise"><dt>{K.blatt.jahr2}<small>{K.blatt.jahr2Text}</small></dt><dd>{verkaufEur(VERKAUF_PREISE.jahresCents, sprache)}</dd></div>;
  const knopfText = wegVorKontakt === "abschluss" ? K.weiter : K.wege[wegVorKontakt].knopf;
  const leisteDa = leiste && schritt === "wahl" && !gleiten.raus;

  return (
    <div className={`vk-konfig${eigeneSeite ? " eigen" : ""}`} ref={wurzel} id="konfigurator" data-schritt={schritt}>
      <div className="vk-flaeche" ref={flaeche}>
        <div className="vk-licht" aria-hidden="true" />
        {/* ── Links: wählen ─────────────────────────────────────────────── */}
        <div className="vk-wahl" data-gleiten={gleiten.raus ? "raus" : gleiten.n > 0 ? "rein" : undefined} data-vor={gleiten.vor ? "1" : "0"}>
          {schritt === "wahl" && (
            <>
              <div className="vk-block">
                <p className="vk-nr"><i>1</i>{K.schritt1}</p>
                <p className="vk-sub">{K.schritt1Sub}</p>
                <div className="vk-chips" role="group" aria-label={K.schritt1}>
                  {VERKAUF_INTERESSEN.map((k, i) => {
                    const an = interessen.includes(k);
                    return (
                      <button key={k} type="button" className={`vk-chip${an ? " an" : ""}`} aria-pressed={an} onClick={() => umschalten(k)} style={{ ["--i" as string]: String(i) }}>
                        <span className="vk-chip-schein" aria-hidden="true" />
                        <span className="vk-chip-haken" aria-hidden="true"><svg viewBox="0 0 16 16" width="12" height="12"><path d="M3.2 8.4l3 3 6.6-7" pathLength={1} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                        <b>{K.interessen[k].titel}</b>
                        <span className="vk-chip-zeile">{W(K.interessen[k].zeile)}</span>
                        <em>{K.interessen[k].preis}</em>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className={`vk-block vk-rahmen${mitKapital ? "" : " aus"}`}>
                <p className="vk-nr"><i>2</i>{K.schritt2}</p>
                <p className="vk-sub">{K.schritt2Sub}</p>
                <div className="vk-zahl" aria-hidden="true">
                  <span className="vk-zahl-wert">
                    {en && <span className="vk-zahl-einheit">{einheit}</span>}
                    <RollZahl text={zahlText} wert={usd} />
                    {!en && <span className="vk-zahl-einheit">{einheit}</span>}
                  </span>
                  <span className="vk-zahl-euro">{miami ? <span key="miami">{K.wege.miami.titel}</span> : K.rahmenEuro(verkaufEur(preis.rahmenEurCents, sprache))}</span>
                </div>
                <div className="vk-regler" style={{ ["--f" as string]: String(fuellung) }}>
                  <input type="range" min={0} max={stopps.length - 1} step={1} value={index} disabled={!mitKapital}
                    aria-label={K.rahmenLabel} aria-valuetext={miami ? K.wege.miami.titel : verkaufUsd(usd, sprache)}
                    onChange={(ev) => setUsd(stopps[Number(ev.target.value)] ?? usd)} />
                  <div className="vk-regler-bild" aria-hidden="true">
                    <span className="vk-regler-fuell" />
                    <span className="vk-regler-schlitten"><i className="vk-regler-daumen" /></span>
                  </div>
                  <div className="vk-skala" aria-hidden="true"><span>{K.rahmenMin}</span><span>{K.rahmenMax}</span></div>
                </div>
                <p className="vk-fein">{W(`${K.rahmenInstitut} ${K.rahmenHinweis}`)}</p>
              </div>
            </>
          )}

          {schritt === "kontakt" && (
            <form className="vk-form" onSubmit={absenden} noValidate={false}>
              <p className="vk-nr"><i>3</i>{K.form.titel}</p>
              <p className="vk-sub">{W((sofort ? K.form.sub : abschluss ? K.persoenlich.sub : hinweisWeg?.text) ?? "")}</p>
              <div className="vk-anrede" role="radiogroup" aria-label={K.form.anrede}>
                {(["Herr", "Frau"] as const).map((a) => (
                  <button key={a} type="button" role="radio" aria-checked={form.anrede === a} className={form.anrede === a ? "an" : ""} onClick={() => setForm((f) => ({ ...f, anrede: f.anrede === a ? "" : a }))}>{a === "Herr" ? K.form.herr : K.form.frau}</button>
                ))}
              </div>
              <div className="vk-felder">
                <label className={fehler?.feld === "vorname" ? "rot" : ""}><span>{K.form.vorname}</span><input id={`${id}-vorname`} value={form.vorname} onChange={feld("vorname")} autoComplete="given-name" required maxLength={80} /></label>
                <label className={fehler?.feld === "nachname" ? "rot" : ""}><span>{K.form.nachname}</span><input id={`${id}-nachname`} value={form.nachname} onChange={feld("nachname")} autoComplete="family-name" required maxLength={80} /></label>
                <label className={fehler?.feld === "email" ? "rot" : ""}><span>{K.form.email}</span><input id={`${id}-email`} type="email" inputMode="email" value={form.email} onChange={feld("email")} autoComplete="email" required maxLength={160} /></label>
                <label className={fehler?.feld === "telefon" ? "rot" : ""}><span>{K.form.telefon}</span><input id={`${id}-telefon`} type="tel" inputMode="tel" value={form.telefon} onChange={feld("telefon")} autoComplete="tel" required maxLength={40} /></label>
                <label className="breit"><span>{K.form.land}</span>
                  <select id={`${id}-land`} value={form.land} onChange={(ev) => setForm((f) => ({ ...f, land: ev.target.value as VerkaufLand }))}>
                    {VERKAUF_LAENDER.map((l) => <option key={l} value={l}>{K.form.laender[l]}</option>)}
                  </select>
                </label>
                <label className="breit vk-haken">
                  <input type="checkbox" checked={form.bestand} onChange={(ev) => setForm((f) => ({ ...f, bestand: ev.target.checked }))} />
                  <span><b>{W(K.form.bestand)}</b><small>{K.form.bestandSub}</small></span>
                </label>
                <label className="breit"><span>{K.form.nachricht}</span><textarea value={form.nachricht} onChange={feld("nachricht")} rows={2} maxLength={1200} placeholder={K.form.nachrichtPlatz} /></label>
                {/* Honigtopf: kein Mensch sieht dieses Feld. */}
                <input className="vk-falle" tabIndex={-1} autoComplete="off" aria-hidden="true" name="firma_website" value={form.falle} onChange={feld("falle")} />
              </div>
              {fehler && <p className="vk-fehler" role="alert">{W(fehler.text)}</p>}
              {K.form.vertragssprache && abschluss && <p className="vk-fein">{W(K.form.vertragssprache)}</p>}
              <div className="vk-knoepfe">
                <button type="submit" className="vk-knopf" disabled={laeuft}>{laeuft ? (sofort ? K.form.laeuft : K.persoenlich.laeuft) : sofort ? K.form.absenden : abschluss ? K.persoenlich.absenden : K.form.absendenWeg}</button>
                <button type="button" className="vk-knopf leise" onClick={() => { setFehler(null); wechseln("wahl", false); }} disabled={laeuft}>{K.zurueck}</button>
              </div>
              <p className="vk-fein">{K.form.datenschutz} <a href={en ? "/en/privacy" : "/datenschutz"}>{K.form.datenschutzLink}</a></p>
            </form>
          )}

          {schritt === "fertig" && ergebnis && (
            <div className="vk-fertig" role="status">
              <span className="vk-fertig-zeichen" aria-hidden="true"><svg viewBox="0 0 48 48" width="48" height="48"><circle cx="24" cy="24" r="22" /><path d="M14 24.6l7 7L34.5 17" /></svg></span>
              <h3>{ergebnis.titel ?? (ergebnis.art === "anfrage" ? (hinweisWeg?.titel ?? K.wege.vorhaben.titel) : K.fertig.titel)}</h3>
              <p>{W(ergebnis.text)}</p>
              {ergebnis.art === "angebot" && ergebnis.url && <a className="vk-knopf" href={ergebnis.url}>{ergebnis.knopf ?? K.fertig.knopf}<Pfeil /></a>}
            </div>
          )}
        </div>

        {/* ── Rechts: das Preisblatt — drei Lagen im selben Feld, sichtbar ist die, die gerade gilt ────────────── */}
        <aside className="vk-blatt" aria-label={K.blatt.titel} data-lage={lage}>
          <p className="vk-blatt-auge">{K.blatt.titel}</p>
          <p className="vk-blatt-name">{W(T.produkt.kurz)}</p>
          <div className="vk-stapel">
            <div className="vk-lage" data-an={lage === "preis" ? "1" : "0"} aria-hidden={lage !== "preis"}>
              <dl className="vk-zeilen">
                {zeileHeute}
                <div><dt>{K.blatt.eintragung}<small>{K.blatt.eintragungText}</small></dt><dd>{betrag(preis.erfolgCents)}</dd></div>
                <div className="summe"><dt>{K.blatt.jahr1}</dt><dd>{betrag(preis.erstesJahrCents)}</dd></div>
                {zeileJahr2}
              </dl>
              <ul className="vk-blatt-liste">
                <li>{W(K.blatt.fastTrack(verkaufEur(VERKAUF_PREISE.fastTrackCents, sprache)))}</li>
                <li>{W(K.blatt.garantie)}</li>
                <li>{W(`${K.blatt.endpreise} ${K.blatt.kurs(verkaufKurs(sicht.kursUsdJeEur, en), verkaufTag(sicht.kursDatum, en))}`)}</li>
              </ul>
            </div>
            <div className="vk-lage vk-lage-miami" data-an={lage === "miami" ? "1" : "0"} aria-hidden={lage !== "miami"}>
              <Boegen />
              <div className="vk-weg"><h3>{K.wege.miami.titel}</h3><p>{W(K.wege.miami.text)}</p></div>
            </div>
            <div className="vk-lage vk-lage-ohne" data-an={lage === "ohne" ? "1" : "0"} aria-hidden={lage !== "ohne"}>
              <div>
                <dl className="vk-zeilen">{zeileHeute}{zeileJahr2}</dl>
                <p className="vk-blatt-fein">{W(K.ohneKapitalBlatt)}</p>
                <ul className="vk-blatt-liste"><li>{K.blatt.endpreise}</li></ul>
              </div>
              <Boegen />
            </div>
          </div>
          {/* Für Screenreader: der Preis als ein Satz, sobald der Regler ruht. */}
          <p className="vk-nur-sr" aria-live="polite">{lage === "preis" ? `${verkaufUsd(usd, sprache)} — ${K.blatt.eintragung}: ${verkaufEur(preis.erfolgCents, sprache)} — ${K.blatt.jahr1}: ${verkaufEur(preis.erstesJahrCents, sprache)}` : ""}</p>
          {schritt === "wahl" && (
            <button type="button" className="vk-knopf voll" ref={knopf} onClick={zuKontakt}>{knopfText}<Pfeil /></button>
          )}
          {/* Der Fuß hält seinen Platz auch ohne die Frage (ohne Kapital) — so steht der Knopf in jeder Lage an derselben Stelle. */}
          <div className="vk-blatt-fuss">
            {mitKapital && (
              <details className="vk-blatt-frage">
                <summary>{K.angebotFrage.frage}</summary>
                <p>{W(K.angebotFrage.antwort)}</p>
              </details>
            )}
          </div>
        </aside>
      </div>

      {/* ── Die Leiste am Handy: der Preis läuft mit, ein Tipp führt zu den Angaben ── */}
      <div className={`vk-mobil${leisteDa ? " da" : ""}`} aria-hidden={!leisteDa}>
        <div className={`vk-mobil-text${lage === "miami" ? " allein" : ""}`}>
          <span>{lage === "preis" ? K.blatt.jahr1 : lage === "miami" ? K.wege.miami.titel : K.blatt.heute}</span>
          {lage === "preis" && <b>{betrag(preis.erstesJahrCents)}</b>}
          {lage === "ohne" && <b>{verkaufEur(VERKAUF_PREISE.gruendungCents, sprache)}</b>}
        </div>
        <button type="button" className="vk-knopf" onClick={zuKontakt} tabIndex={leisteDa ? 0 : -1}>{knopfText}<Pfeil /></button>
      </div>
    </div>
  );
}
