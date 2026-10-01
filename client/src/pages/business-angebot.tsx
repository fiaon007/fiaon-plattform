// ═══════════════════════════════════════════════════════════════════════════
// /business/angebot/:token — DAS PERSÖNLICHE ANGEBOT (FIAON Global)
// Individualangebot (01.10.2026), Register E-268
//
// Justin (01.10.2026): „Vertrag so gut, dass er nicht widerstehen kann" — durch
// Klarheit und echte Vorteile (der größere Teil erst bei Erfolg, Geld zurück,
// Bürge, keine Sicherheiten, alles inklusive), NIE durch Falschaussagen, Druck
// oder Garantien über Bankentscheidungen. Kein Countdown, kein „nur heute".
//
// Nachtrag Justin (01.10.2026, 10:50–10:58): „Er soll das Angebot mit einem Lächeln
// annehmen, nicht erschrecken." Deshalb:
//   0 Auftakt — persönliche Begrüßung, baut sich ruhig auf, überspringbar,
//     prefers-reduced-motion beachtet, danach gleitet die Seite in den Hero.
//   1 Hero nur mit Nutzen (keine Beträge, kein Institut-Satz)
//   2 „Was Sie bekommen" · 3 „So läuft es" · 4 „Ihr Schutz"
//   5 „Ihre Investition" — hier wandert die dunkle Tafel hin
//   6 Vertrag + Anlagen (aufklappbar, vollständig lesbar)
//   7 Bestellübersicht UNMITTELBAR über „Zahlungspflichtig annehmen" (§ 312j BGB —
//     Beträge dort vollständig, das bleibt am Ende)
//   Die Abschnitte bauen sich beim Scrollen dezent auf (Auf aus DunkleBuehne).
//   Kein Cookie-Hinweis, keine Messung (components/site/EinwilligungsHinweis.tsx).
//
// ── WAS DIE SEITE TUT ──────────────────────────────────────────────────────
//   GET  /api/fiaon/global/angebot/:token?sofortBeginn=0|1&jahresbetreuung=0|1
//        → Seitentexte, Vertrag (HTML), Prüfsumme für GENAU diese Haken,
//          Bestellübersicht, ob angenommen werden kann (Pflichtfelder der Bürgin)
//   POST /api/fiaon/global/angebot/:token/annehmen  { sofortBeginn, jahresbetreuung, textHash }
//        → der Server rechnet die Prüfsumme nach; weicht sie ab: „bitte neu laden"
// Alle Sätze kommen aus shared/fiaon-global-angebot.ts — über den Server, damit
// Bildschirm und PDF denselben Wortlaut haben (die Seite tippt keinen Vertragssatz,
// auch den Namen in der Begrüßung nicht).
//
// ── GESTALTUNG ─────────────────────────────────────────────────────────────
// Helles Kanzlei-Design der Business-Welt (global-start.css, .gs-Variablen),
// Navy-Glas genau EINMAL: die Tafel unter „Ihre Investition". Häkchen nur für
// den sofortigen Beginn (Wertersatz) und die freiwillige Jahresbetreuung — keiner
// vorangekreuzt, keiner per Link vorbelegt. Am Handy eine Leiste „Zur Annahme"
// (Anker, kein zweiter Knopf).
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRoute } from "wouter";
import { Dunkel, Auf } from "@/components/site/DunkleBuehne";
import "@/styles/global-start.css";
import "@/styles/global-angebot.css";

type Zeile = { label: string; wert: string };
type Karte = { titel: string; text: string; fein: string };
type Seite = {
  auftakt: { gruss: string; zeile: string; ueberspringen: string };
  auge: string; fuer: string; titel: string; lead: string; nutzen: string[];
  bekommenTitel: string; bekommen: Karte[];
  ablaufTitel: string; ablaufZeitplan: string; ablauf: { wann: string; titel: string; text: string }[];
  schutzTitel: string; schutz: Karte[];
  investitionTitel: string; investition: { satz: string; tafel: { label: string; wert: string; zusatz: string }[]; gesamt: string; jahrZwei: string };
  hinweiseTitel: string; hinweise: string[]; kapitalFrei: string; verbunden: string;
  dokumenteTitel: string; dokumente: { titel: string; text: string }[]; vertragAuf: string; vertragZu: string;
};
type Annahme = {
  titel: string; beginnTitel: string; beginnText: string; sofortBeginn: string; jahresbetreuung: string; jahresbetreuungUnter: string;
  knopf: string; unterKnopf: string; gelesen: string; gesperrt: string; neuLaden: string;
};
type Sicht = {
  ok: true; status: "offen"; ref: string; gueltigBis: string; kundeName: string; kundeAnrede: string; email: string;
  seite: Seite; uebersicht: Zeile[]; annahme: Annahme; teil1Cents: number;
  html: string; textHash: string; annahmeBereit: boolean; gesperrtGrund: string | null;
  vorschauLeitung?: boolean; fehlt?: string[]; vertragPdf: string; pruefberichtPdf: string;
};
type Fertig = {
  ref: string; auftragRef: string | null; email: string; sofortBeginn: boolean; zahlungsseite: string | null; meinAuftrag: string | null;
  vertragUrl: string | null; rechnungUrl: string | null; fertigTitel: string; fertigText: string; betragCents: number; hinweis?: string;
  teil1Bezahlt?: boolean; fertigZahlung?: string; fertigFuss?: string;
};

const tagDe = (iso?: string | null) => (iso ? String(iso).slice(0, 10).split("-").reverse().join(".") : "");
const ruhigeBewegung = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };

// ── Der Auftakt ─────────────────────────────────────────────────────────────
// Baut sich in gut zwei Sekunden auf (Überzeile, feine Linie, Gruß, Zeile) und
// gleitet dann nach oben weg; ein Klick, „Überspringen" oder Escape beendet ihn
// sofort. Mit prefers-reduced-motion: keine Bewegung, nur kurz stehen, dann ausblenden.
function Auftakt({ auge, gruss, zeile, ueberspringen, onWeg, onEnde }: { auge: string; gruss: string; zeile: string; ueberspringen: string; onWeg: () => void; onEnde: () => void }) {
  const [weg, setWeg] = useState(false);
  const ruhig = useRef(ruhigeBewegung());
  useEffect(() => {
    document.documentElement.classList.add("gia-auftakt-an");
    // Aufbau gut 1,8 s, dann gleitet der Auftakt in 0,8 s nach oben — zusammen unter drei Sekunden bis zum Hero.
    const t = window.setTimeout(() => setWeg(true), ruhig.current ? 1200 : 2000);
    const taste = (e: KeyboardEvent) => { if (e.key === "Escape") setWeg(true); };
    window.addEventListener("keydown", taste);
    return () => { window.clearTimeout(t); window.removeEventListener("keydown", taste); document.documentElement.classList.remove("gia-auftakt-an"); };
  }, []);
  useEffect(() => {
    if (!weg) return;
    document.documentElement.classList.remove("gia-auftakt-an");
    // Sobald der Auftakt nach oben gleitet, baut sich darunter schon der Hero auf — kein leerer Moment dazwischen.
    onWeg();
    const t = window.setTimeout(onEnde, ruhig.current ? 350 : 800);
    return () => window.clearTimeout(t);
  }, [weg, onWeg, onEnde]);
  return (
    <div className={`gia-auftakt${weg ? " weg" : ""}`} role="status" aria-live="polite" onClick={() => setWeg(true)} data-fiaon="angebot-auftakt">
      <div className="gia-auftakt-inner">
        <span className="gia-auftakt-auge">{auge}</span>
        <i className="gia-auftakt-linie" aria-hidden="true" />
        <p className="gia-auftakt-gruss">{gruss}</p>
        <p className="gia-auftakt-zeile">{zeile}</p>
      </div>
      <button type="button" className="gia-auftakt-skip" onClick={(e) => { e.stopPropagation(); setWeg(true); }}>{ueberspringen}</button>
    </div>
  );
}

/** Ein Abschnitt, der sich beim Scrollen aufbaut. */
function Abschnitt({ id, label, className = "", children }: { id?: string; label?: string; className?: string; children: ReactNode }) {
  return <section id={id} className={`gia-abschnitt ${className}`} aria-label={label}><Auf>{children}</Auf></section>;
}

export default function BusinessAngebot() {
  const [, treffer] = useRoute("/business/angebot/:token");
  const token = String(treffer?.token ?? "");
  const [sofortBeginn, setSofortBeginn] = useState(false);
  const [jahresbetreuung, setJahresbetreuung] = useState(false);
  const [sicht, setSicht] = useState<Sicht | null>(null);
  const [fertig, setFertig] = useState<Fertig | null>(null);
  const [stand, setStand] = useState<"laedt" | "da" | "fehler">("laedt");
  const [fehler, setFehler] = useState("");
  const [laedtNeu, setLaedtNeu] = useState(false);
  const [sendet, setSendet] = useState(false);
  const [antwortFehler, setAntwortFehler] = useState("");
  const [falle, setFalle] = useState("");
  // Der Auftakt läuft genau einmal je Seitenaufruf: „offen" (steht), „geht" (gleitet weg, Hero baut sich auf), „vorbei".
  const [auftakt, setAuftakt] = useState<"offen" | "geht" | "vorbei">("offen");
  const [vertragOffen, setVertragOffen] = useState(false);
  const anfrage = useRef(0);
  const auftaktGeht = useCallback(() => setAuftakt((a) => (a === "offen" ? "geht" : a)), []);
  const auftaktEnde = useCallback(() => setAuftakt("vorbei"), []);

  const laden = useCallback(async (sb: boolean, jb: boolean) => {
    if (!token) { setStand("fehler"); setFehler("Dieser Link ist unvollständig. Bitte öffnen Sie den Link aus unserer Nachricht."); return; }
    const nr = ++anfrage.current;
    setLaedtNeu(true);
    const ab = new AbortController();
    const zeit = window.setTimeout(() => ab.abort(), 20_000);
    try {
      const r = await fetch(`/api/fiaon/global/angebot/${encodeURIComponent(token)}?sofortBeginn=${sb ? 1 : 0}&jahresbetreuung=${jb ? 1 : 0}`, { signal: ab.signal, credentials: "include" });
      const j = await r.json().catch(() => null);
      if (nr !== anfrage.current) return;
      if (!r.ok || !j?.ok) { setStand("fehler"); setFehler(j?.error || "Das Angebot ließ sich nicht laden. Bitte versuchen Sie es gleich noch einmal."); return; }
      if (j.status === "angenommen") { setFertig(j as Fertig); setStand("da"); return; }
      setSicht(j as Sicht); setStand("da");
    } catch {
      if (nr !== anfrage.current) return;
      setStand("fehler"); setFehler("Keine Verbindung — bitte prüfen Sie Ihre Internetverbindung und laden Sie die Seite neu.");
    } finally {
      window.clearTimeout(zeit);
      if (nr === anfrage.current) setLaedtNeu(false);
    }
  }, [token]);

  useEffect(() => { void laden(sofortBeginn, jahresbetreuung); }, [laden, sofortBeginn, jahresbetreuung]);

  const annehmen = async () => {
    if (!sicht || sendet || laedtNeu) return;
    setSendet(true); setAntwortFehler("");
    try {
      const r = await fetch(`/api/fiaon/global/angebot/${encodeURIComponent(token)}/annehmen`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sofortBeginn, jahresbetreuung, textHash: sicht.textHash, falle }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setFertig(j as Fertig); window.scrollTo({ top: 0 }); return; }
      setAntwortFehler(j?.error || "Die Annahme ließ sich gerade nicht speichern. Bitte versuchen Sie es noch einmal.");
      if (j?.code === "GEAENDERT") void laden(sofortBeginn, jahresbetreuung);
    } catch {
      setAntwortFehler("Keine Verbindung — Ihre Annahme ist NICHT angekommen. Bitte versuchen Sie es noch einmal.");
    } finally { setSendet(false); }
  };

  const titel = "Ihr persönliches Angebot · FIAON Global";
  const beschreibung = "Persönliches Angebot von FIAON Global: Gründung Ihrer US-Gesellschaft und Begleitung auf dem Weg zum Kapital.";

  if (stand === "laedt") {
    return (
      <Dunkel seite="business" titel={titel} beschreibung={beschreibung}>
        <div className="gs gia"><div className="dk-rahmen"><p className="gia-laedt" role="status">Ihr Angebot wird geladen …</p></div></div>
      </Dunkel>
    );
  }
  if (stand === "fehler") {
    return (
      <Dunkel seite="business" titel={titel} beschreibung={beschreibung}>
        <div className="gs gia"><div className="dk-rahmen">
          <header className="gs-kopf"><span className="gs-auge">FIAON Global · Persönliches Angebot</span><h1 className="gs-h1">Dieses Angebot lässt sich nicht öffnen</h1></header>
          <p className="gs-fehler" role="alert">{fehler}</p>
          <button type="button" className="gs-link" onClick={() => { setStand("laedt"); void laden(sofortBeginn, jahresbetreuung); }}>Erneut laden</button>
        </div></div>
      </Dunkel>
    );
  }

  if (fertig) {
    return (
      <Dunkel seite="business" titel={titel} beschreibung={beschreibung}>
        <div className="gs gia" data-fiaon="angebot-fertig"><div className="dk-rahmen">
          <header className="gs-kopf">
            <span className="gs-auge">FIAON Global · Auftrag {fertig.auftragRef ?? fertig.ref}</span>
            <h1 className="gs-h1">{fertig.fertigTitel}</h1>
            <p className="gs-lead">{fertig.hinweis || fertig.fertigText}</p>
          </header>
          <div className="gs-blatt gia-fertig">
            <p className="gs-ref"><span>Angebot</span><b>{fertig.ref}</b></p>
            <p className="gia-fertig-satz">{fertig.fertigZahlung}</p>
            <div className="gia-fertig-knoepfe">
              {fertig.zahlungsseite && !fertig.teil1Bezahlt && <a className="gs-knopf" href={fertig.zahlungsseite}>Zur Zahlungsseite</a>}
              {fertig.meinAuftrag && <a className="gia-knopf-leise" href={fertig.meinAuftrag}>Mein Auftrag öffnen</a>}
            </div>
            <div className="gs-dateien">
              {fertig.vertragUrl && <a href={fertig.vertragUrl} target="_blank" rel="noreferrer">Vertrag mit Anlagen (PDF)</a>}
              {fertig.rechnungUrl && <a href={fertig.rechnungUrl} target="_blank" rel="noreferrer">Rechnung Teil 1 (PDF)</a>}
            </div>
            <p className="gia-klein">{fertig.fertigFuss}</p>
          </div>
        </div></div>
      </Dunkel>
    );
  }

  if (!sicht) return null;
  const S = sicht.seite; const A = sicht.annahme; const I = S.investition;
  return (
    <Dunkel seite="business" titel={titel} beschreibung={beschreibung}>
      {auftakt !== "vorbei" && <Auftakt auge={S.auge} gruss={S.auftakt.gruss} zeile={S.auftakt.zeile} ueberspringen={S.auftakt.ueberspringen} onWeg={auftaktGeht} onEnde={auftaktEnde} />}
      <div className={`gs gia${auftakt === "offen" ? " gia-start" : ""}`} data-fiaon="angebot">
        <div className="dk-rahmen">
          {sicht.vorschauLeitung && (
            <div className="gia-vorschau" role="note">
              <b>Vorschau der Leitung.</b> Annehmen kann nur der Kunde — aus dem Chefbüro heraus ist der Knopf gesperrt.
              {sicht.fehlt && sicht.fehlt.length > 0 && <> Für die Annahme fehlt noch: {sicht.fehlt.join(" · ")}.</>}
            </div>
          )}

          {/* 1 — Hero: nur Nutzen. Keine Beträge, kein Institut-Satz (Nachtrag b, c). */}
          <header className="gs-kopf gia-kopf gia-hero">
            <span className="gs-auge">{S.auge}</span>
            <p className="gia-fuer">{S.fuer}</p>
            <h1 className="gs-h1">{S.titel}</h1>
            <p className="gs-lead">{S.lead}</p>
            <ul className="gia-nutzen" aria-label="Ihr Nutzen">{S.nutzen.map((n) => <li key={n}>{n}</li>)}</ul>
            <div className="gia-hero-weiter">
              <a href="#bekommen">{S.bekommenTitel}</a>
              <a href="#vertrag">Zum Vertrag</a>
              <a href="#annahme">Zur Annahme</a>
            </div>
            <p className="gia-meta">Angebot {sicht.ref} · gültig bis {tagDe(sicht.gueltigBis)}</p>
          </header>

          {/* 2 — Was Sie bekommen */}
          <Abschnitt id="bekommen">
            <h2 className="gia-h2">{S.bekommenTitel}</h2>
            <ol className="gia-karten">
              {S.bekommen.map((k) => <li key={k.titel}><h3>{k.titel}</h3><p>{k.text}</p><p className="gia-fein">{k.fein}</p></li>)}
            </ol>
          </Abschnitt>

          {/* 3 — So läuft es: vier Schritte mit Zeitplan */}
          <Abschnitt id="ablauf">
            <h2 className="gia-h2">{S.ablaufTitel}</h2>
            <p className="gia-sub">{S.ablaufZeitplan}</p>
            <ol className="gia-ablauf">
              {S.ablauf.map((x) => <li key={x.titel}><span className="gia-wann">{x.wann}</span><b>{x.titel}</b><span className="gia-ablauf-text">{x.text}</span></li>)}
            </ol>
          </Abschnitt>

          {/* 4 — Ihr Schutz */}
          <Abschnitt id="schutz">
            <h2 className="gia-h2">{S.schutzTitel}</h2>
            <ul className="gia-schutz">
              {S.schutz.map((k) => <li key={k.titel}><h3>{k.titel}</h3><p>{k.text}</p><p className="gia-fein">{k.fein}</p></li>)}
            </ul>
          </Abschnitt>

          {/* 5 — Ihre Investition: Navy-Glas genau einmal, Beträge ruhig und als Vorteil. */}
          <Abschnitt id="investition">
            <h2 className="gia-h2">{S.investitionTitel}</h2>
            <p className="gia-invest-satz">{I.satz}</p>
            <div className="gia-tafel">
              <dl className="gia-tafel-liste">
                {I.tafel.map((z) => (
                  <div key={z.label}><dt>{z.label}</dt><dd><b>{z.wert}</b><span>{z.zusatz}</span></dd></div>
                ))}
              </dl>
              <p className="gia-tafel-gesamt">{I.gesamt}</p>
              <a className="gia-tafel-anker" href="#annahme">Zum Vertrag und zur Annahme</a>
            </div>
            <p className="gia-fein gia-jahr-zwei">{I.jahrZwei}</p>
          </Abschnitt>

          {/* 6 — Vor dem Vertrag die Pflichthinweise; dann der Vertrag mit drei Anlagen, aufklappbar und vollständig lesbar. */}
          <Abschnitt id="hinweise" className="gia-hinweise">
            <h2 className="gia-h2">{S.hinweiseTitel}</h2>
            <ul>{S.hinweise.map((h) => <li key={h}>{h}</li>)}</ul>
            <p>{S.kapitalFrei}</p>
            <p className="gia-fein">{S.verbunden}</p>
          </Abschnitt>

          <Abschnitt id="vertrag" label={S.dokumenteTitel}>
            <h2 className="gia-h2">{S.dokumenteTitel}</h2>
            <ul className="gia-dokumente">{S.dokumente.map((d) => <li key={d.titel}><b>{d.titel}</b><span>{d.text}</span></li>)}</ul>
            <div className="gs-dateien">
              <a href={`${sicht.vertragPdf}?sofortBeginn=${sofortBeginn ? 1 : 0}&jahresbetreuung=${jahresbetreuung ? 1 : 0}`} target="_blank" rel="noreferrer">Vertrag als PDF ansehen (Entwurf)</a>
              <a href={sicht.pruefberichtPdf} target="_blank" rel="noreferrer">Anlage 2: Prüfbericht (PDF)</a>
            </div>
            {/* Der Text kommt von unserem eigenen Server aus derselben Quelle wie das PDF; Kundenangaben sind dort maskiert. */}
            <div id="vertragstext" className={`gs-vertrag gia-vertrag${vertragOffen ? " offen" : ""}`} tabIndex={0} aria-busy={laedtNeu || undefined} data-veraltet={laedtNeu ? "1" : undefined} dangerouslySetInnerHTML={{ __html: sicht.html }} />
            <button type="button" className="gia-vertrag-knopf" aria-expanded={vertragOffen} aria-controls="vertragstext" onClick={() => setVertragOffen((v) => !v)}>
              {vertragOffen ? S.vertragZu : S.vertragAuf}
            </button>
          </Abschnitt>

          {/* 7 — Die Annahme: Wahl, Übersicht, Knopf. § 312j Abs. 2 BGB: die Übersicht UNMITTELBAR über dem Knopf. */}
          <section className="gs-blatt gia-annahme" id="annahme" aria-label={A.titel}>
            <div className="gs-beginn gia-wahl">
              <h3>{A.beginnTitel}</h3>
              <p>{A.beginnText}</p>
              <label><input type="checkbox" checked={sofortBeginn} onChange={(e) => setSofortBeginn(e.target.checked)} /><span>{A.sofortBeginn}</span></label>
            </div>
            <div className="gia-wahl">
              <label><input type="checkbox" checked={jahresbetreuung} onChange={(e) => setJahresbetreuung(e.target.checked)} /><span>{A.jahresbetreuung}</span></label>
              <p className="gia-fein">{A.jahresbetreuungUnter}</p>
            </div>

            <h2 className="gia-h2 gia-uebersicht-titel">{A.titel}</h2>
            <dl className="gia-uebersicht" aria-busy={laedtNeu || undefined}>
              {sicht.uebersicht.map((z) => <div key={z.label}><dt>{z.label}</dt><dd>{z.wert}</dd></div>)}
            </dl>
            <input className="gs-falle" tabIndex={-1} autoComplete="off" aria-hidden="true" value={falle} onChange={(e) => setFalle(e.target.value)} />
            {antwortFehler && <p className="gs-fehler" role="alert">{antwortFehler}</p>}
            {sicht.annahmeBereit ? (
              <div className="gia-knopf-block">
                <button type="button" className="gs-knopf gia-annehmen" onClick={annehmen} disabled={sendet || laedtNeu}>
                  {sendet ? "Wird gespeichert …" : A.knopf}
                </button>
                {laedtNeu && <p className="gia-fein" role="status">Der Vertrag wird an Ihre Wahl angepasst …</p>}
                <p className="gia-unterknopf">{A.unterKnopf}</p>
                <p className="gia-fein">{A.gelesen}</p>
              </div>
            ) : (
              <div className="gia-knopf-block">
                <button type="button" className="gs-knopf gia-annehmen" disabled aria-describedby="gia-gesperrt">{A.knopf}</button>
                <p className="gia-gesperrt" id="gia-gesperrt">{sicht.vorschauLeitung ? "Vorschau der Leitung — annehmen kann nur der Kunde." : (sicht.gesperrtGrund || A.gesperrt)}</p>
              </div>
            )}
          </section>
        </div>
        {/* Am Handy: ein Anker zur Annahme — kein Knopf außerhalb des Blocks mit der Übersicht. */}
        <a className="gia-leiste" href="#annahme">Zur Annahme</a>
      </div>
    </Dunkel>
  );
}
