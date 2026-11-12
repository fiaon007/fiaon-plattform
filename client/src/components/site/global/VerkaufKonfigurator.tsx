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
// Bewegung: Die Zahlen gleiten zum neuen Wert (0,42 s), die Fläche baut sich beim Hineinscrollen einmal auf. Bei
// „weniger Bewegung“ steht alles sofort; nichts hängt an der Scrollposition.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import {
  VERKAUF_TEXTE, VERKAUF_RAHMEN, VERKAUF_INTERESSEN, VERKAUF_LAENDER, VERKAUF_PREISE,
  verkaufStopps, verkaufPreis, verkaufEur, verkaufUsd, verkaufWeg, verkaufStoppNahe, verkaufUsdAusPaket,
  type VerkaufInteresse, type VerkaufLand, type VerkaufSprache, type VerkaufFeld,
} from "@shared/fiaon-global-verkauf";
import { useVerkaufSicht, verkaufTag, verkaufKurs } from "@/lib/verkauf";
import { ruhigGewuenscht, useEinmalSichtbar } from "@/components/site/global/bewegung";
import { werbeEreignis, kampagne } from "@/lib/werbung";
import "@/styles/global-verkauf.css";

/** Eine Zahl, die zum neuen Wert gleitet (nur Anzeige — gerechnet wird immer mit dem Zielwert). */
function useGleitzahl(ziel: number): number {
  const [wert, setWert] = useState(ziel);
  const von = useRef(ziel);
  useEffect(() => {
    if (ruhigGewuenscht() || typeof requestAnimationFrame === "undefined") { von.current = ziel; setWert(ziel); return; }
    const start = von.current; const t0 = performance.now(); const dauer = 420;
    let bild = 0;
    const schritt = (t: number) => {
      const p = Math.min(1, (t - t0) / dauer);
      const e = 1 - Math.pow(1 - p, 3);
      const w = start + (ziel - start) * e;
      von.current = w; setWert(w);
      if (p < 1) bild = requestAnimationFrame(schritt);
    };
    bild = requestAnimationFrame(schritt);
    return () => cancelAnimationFrame(bild);
  }, [ziel]);
  return wert;
}

type Schritt = "wahl" | "kontakt" | "fertig";
interface Ergebnis { art: "angebot" | "mail" | "anfrage"; titel?: string; text: string; url?: string; knopf?: string }

export default function VerkaufKonfigurator({ sprache, eigeneSeite = false }: { sprache: VerkaufSprache; eigeneSeite?: boolean }) {
  const T = VERKAUF_TEXTE[sprache]; const K = T.konfig; const en = sprache === "en";
  const { sicht, neu } = useVerkaufSicht();
  const wurzel = useRef<HTMLDivElement>(null);
  useEinmalSichtbar(wurzel, 0, "0px 0px -18% 0px");
  const id = useId();

  // Die Rasterpunkte — ein Deckel aus der Einstellung schneidet den Selbstabschluss ab, die Million bleibt der Miami-Fall.
  const stopps = useMemo(() => verkaufStopps().filter((u) => u <= sicht.selbstMaxUsd || u === VERKAUF_RAHMEN.maxUsd), [sicht.selbstMaxUsd]);
  const [interessen, setInteressen] = useState<VerkaufInteresse[]>(["kapital"]);
  const [usd, setUsd] = useState<number>(VERKAUF_RAHMEN.startUsd);
  const [schritt, setSchritt] = useState<Schritt>("wahl");
  const [form, setForm] = useState({ anrede: "" as "" | "Herr" | "Frau", vorname: "", nachname: "", email: "", telefon: "", land: "DE" as VerkaufLand, bestand: false, nachricht: "", falle: "" });
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<{ feld?: VerkaufFeld; text: string } | null>(null);
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);

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

  const gleitUsd = useGleitzahl(usd);
  const gleitErfolg = useGleitzahl(preis.erfolgCents);
  const gleitJahr = useGleitzahl(preis.erstesJahrCents);
  const rund = (cents: number) => Math.round(cents / 1000) * 1000;

  const umschalten = (k: VerkaufInteresse) => setInteressen((alt) => (alt.includes(k) ? (alt.length > 1 ? alt.filter((x) => x !== k) : alt) : VERKAUF_INTERESSEN.filter((x) => x === k || alt.includes(x))));
  const feld = (name: keyof typeof form) => (ev: { target: { value: string } }) => { setForm((f) => ({ ...f, [name]: ev.target.value })); if (fehler) setFehler(null); };

  const zuKontakt = () => {
    werbeEreignis("global_beauftragen_klick", { seite: window.location.pathname, ort: "konfigurator", rahmen: usd });
    setSchritt("kontakt");
    requestAnimationFrame(() => document.getElementById(`${id}-vorname`)?.focus({ preventScroll: true }));
    wurzel.current?.scrollIntoView({ behavior: ruhigGewuenscht() ? "auto" : "smooth", block: "start" });
  };

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
        setErgebnis({ art, titel: a.d.titel, text: art === "anfrage" ? String(a.d.danke ?? "") : String(a.d.text ?? ""), url: a.d.url, knopf: a.d.knopf });
        setSchritt("fertig");
        if (art === "angebot" && a.d.url) window.setTimeout(() => window.location.assign(String(a.d.url)), ruhigGewuenscht() ? 300 : 1400);
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

  return (
    <div className={`vk-konfig${eigeneSeite ? " eigen" : ""}`} ref={wurzel} id="konfigurator" data-schritt={schritt}>
      <div className="vk-flaeche">
        <div className="vk-licht" aria-hidden="true" />
        {/* ── Links: wählen ─────────────────────────────────────────────── */}
        <div className="vk-wahl">
          {schritt === "wahl" && (
            <>
              <div className="vk-block">
                <p className="vk-nr"><i>1</i>{K.schritt1}</p>
                <p className="vk-sub">{K.schritt1Sub}</p>
                <div className="vk-chips" role="group" aria-label={K.schritt1}>
                  {VERKAUF_INTERESSEN.map((k) => {
                    const an = interessen.includes(k);
                    return (
                      <button key={k} type="button" className={`vk-chip${an ? " an" : ""}`} aria-pressed={an} onClick={() => umschalten(k)}>
                        <span className="vk-chip-haken" aria-hidden="true"><svg viewBox="0 0 16 16" width="12" height="12"><path d="M3.2 8.4l3 3 6.6-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                        <b>{K.interessen[k].titel}</b>
                        <span>{K.interessen[k].zeile}</span>
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
                  <span className="vk-zahl-wert">{miami ? (en ? "US$1m +" : "1 Mio. US-$ +") : verkaufUsd(Math.round(gleitUsd / 10_000) * 10_000, sprache)}</span>
                  <span className="vk-zahl-euro">{miami ? K.wege.miami.titel : K.rahmenEuro(verkaufEur(preis.rahmenEurCents, sprache))}</span>
                </div>
                <div className="vk-regler" style={{ ["--f" as string]: String(fuellung) }}>
                  <input type="range" min={0} max={stopps.length - 1} step={1} value={index} disabled={!mitKapital}
                    aria-label={K.rahmenLabel} aria-valuetext={miami ? K.wege.miami.titel : verkaufUsd(usd, sprache)}
                    onChange={(ev) => setUsd(stopps[Number(ev.target.value)] ?? usd)} />
                  <div className="vk-skala" aria-hidden="true"><span>{K.rahmenMin}</span><span>{K.rahmenMax}</span></div>
                </div>
                <p className="vk-fein">{K.rahmenInstitut} {K.rahmenHinweis}</p>
              </div>
            </>
          )}

          {schritt === "kontakt" && (
            <form className="vk-form" onSubmit={absenden} noValidate={false}>
              <p className="vk-nr"><i>3</i>{K.form.titel}</p>
              <p className="vk-sub">{abschluss ? K.form.sub : hinweisWeg?.text}</p>
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
                  <span><b>{K.form.bestand}</b><small>{K.form.bestandSub}</small></span>
                </label>
                <label className="breit"><span>{K.form.nachricht}</span><textarea value={form.nachricht} onChange={feld("nachricht")} rows={2} maxLength={1200} placeholder={K.form.nachrichtPlatz} /></label>
                {/* Honigtopf: kein Mensch sieht dieses Feld. */}
                <input className="vk-falle" tabIndex={-1} autoComplete="off" aria-hidden="true" name="firma_website" value={form.falle} onChange={feld("falle")} />
              </div>
              {fehler && <p className="vk-fehler" role="alert">{fehler.text}</p>}
              {K.form.vertragssprache && abschluss && <p className="vk-fein">{K.form.vertragssprache}</p>}
              <div className="vk-knoepfe">
                <button type="submit" className="vk-knopf" disabled={laeuft}>{laeuft ? K.form.laeuft : abschluss ? K.form.absenden : K.form.absendenWeg}</button>
                <button type="button" className="vk-knopf leise" onClick={() => { setSchritt("wahl"); setFehler(null); }} disabled={laeuft}>{K.zurueck}</button>
              </div>
              <p className="vk-fein">{K.form.datenschutz} <a href={en ? "/en/privacy" : "/datenschutz"}>{K.form.datenschutzLink}</a></p>
            </form>
          )}

          {schritt === "fertig" && ergebnis && (
            <div className="vk-fertig" role="status">
              <span className="vk-fertig-zeichen" aria-hidden="true"><svg viewBox="0 0 48 48" width="48" height="48"><circle cx="24" cy="24" r="22" /><path d="M14 24.6l7 7L34.5 17" /></svg></span>
              <h3>{ergebnis.titel ?? (ergebnis.art === "anfrage" ? (hinweisWeg?.titel ?? K.wege.vorhaben.titel) : K.fertig.titel)}</h3>
              <p>{ergebnis.text}</p>
              {ergebnis.art === "angebot" && ergebnis.url && <a className="vk-knopf" href={ergebnis.url}>{ergebnis.knopf ?? K.fertig.knopf}</a>}
            </div>
          )}
        </div>

        {/* ── Rechts: das Preisblatt ────────────────────────────────────── */}
        <aside className="vk-blatt" aria-label={K.blatt.titel}>
          <p className="vk-blatt-auge">{K.blatt.titel}</p>
          <p className="vk-blatt-name">{T.produkt.kurz}</p>
          {mitKapital && !miami ? (
            <dl className="vk-zeilen">
              <div><dt>{K.blatt.heute}<small>{K.blatt.heuteText}</small></dt><dd>{verkaufEur(VERKAUF_PREISE.gruendungCents, sprache)}</dd></div>
              <div><dt>{K.blatt.eintragung}<small>{K.blatt.eintragungText}</small></dt><dd>{verkaufEur(rund(gleitErfolg), sprache)}</dd></div>
              <div className="summe"><dt>{K.blatt.jahr1}</dt><dd>{verkaufEur(Math.round(gleitJahr / 100) * 100, sprache)}</dd></div>
              <div className="leise"><dt>{K.blatt.jahr2}<small>{K.blatt.jahr2Text}</small></dt><dd>{verkaufEur(VERKAUF_PREISE.jahresCents, sprache)}</dd></div>
            </dl>
          ) : miami ? (
            <div className="vk-weg"><h3>{K.wege.miami.titel}</h3><p>{K.wege.miami.text}</p></div>
          ) : (
            <>
              <dl className="vk-zeilen">
                <div><dt>{K.blatt.heute}<small>{K.blatt.heuteText}</small></dt><dd>{verkaufEur(VERKAUF_PREISE.gruendungCents, sprache)}</dd></div>
                <div className="leise"><dt>{K.blatt.jahr2}<small>{K.blatt.jahr2Text}</small></dt><dd>{verkaufEur(VERKAUF_PREISE.jahresCents, sprache)}</dd></div>
              </dl>
              <p className="vk-blatt-fein">{K.ohneKapitalBlatt}</p>
            </>
          )}
          {/* Für Screenreader: der Preis als ein Satz, sobald der Regler ruht. */}
          <p className="vk-nur-sr" aria-live="polite">{mitKapital && !miami ? `${verkaufUsd(usd, sprache)} — ${K.blatt.eintragung}: ${verkaufEur(preis.erfolgCents, sprache)} — ${K.blatt.jahr1}: ${verkaufEur(preis.erstesJahrCents, sprache)}` : ""}</p>
          {schritt === "wahl" && (
            <button type="button" className="vk-knopf voll" onClick={zuKontakt}>
              {wegVorKontakt === "abschluss" ? K.weiter : K.wege[wegVorKontakt].knopf}
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 8h9M8.5 4.5L12 8l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          )}
          <ul className="vk-blatt-liste">
            {mitKapital && !miami && <li>{K.blatt.fastTrack(verkaufEur(VERKAUF_PREISE.fastTrackCents, sprache))}</li>}
            {mitKapital && !miami && <li>{K.blatt.garantie}</li>}
            <li>{K.blatt.endpreise}{mitKapital && !miami ? ` ${K.blatt.kurs(verkaufKurs(sicht.kursUsdJeEur, en), verkaufTag(sicht.kursDatum, en))}` : ""}</li>
          </ul>
          {mitKapital && (
            <details className="vk-buergin">
              <summary>{K.buergin.frage}</summary>
              <p>{sicht.buerginAktiv ? K.buergin.aktiv : K.buergin.inaktiv}</p>
            </details>
          )}
        </aside>
      </div>
    </div>
  );
}
