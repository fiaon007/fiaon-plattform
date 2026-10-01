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
//   4b „Ihre Ansprechpartner" (Justin, 01.10.2026 nachmittags) — auch auf der Bestätigung
//   7a „Wann sollen wir beginnen?" — „Sofort starten" (darunter grau die Erklärung zum Widerruf) oder
//      „Starten ab" mit Datum; keins vorgewählt. Fehlt etwas, sagt die Seite beim Klick genau was, am Feld
//      und unter dem Knopf, und springt hin (Justin, 01.10.2026 nachmittags).
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
//   Seit 01.10.2026 nachmittags statt sofortBeginn: beginn=sofort | beginn=datum&startAm=JJJJ-MM-TT —
//   ob ein Starttag vor dem Ende der Widerrufsfrist liegt (dann gilt die Erklärung), entscheidet der Server.
//   Angebot-Aufrufe (01.10.2026): Jeden Abruf protokolliert NUR der Server (Zeit, Gerät, Region aus den
//   Kopfzeilen, IP gekürzt). Die Seite misst nichts, setzt kein Cookie, lädt kein Pixel; sie hängt nur
//   ?wahl=1 an, wenn sie nach einem Häkchen den Vertrag neu holt — das ist kein neues Öffnen. Der Satz
//   dazu (ANGEBOT_AUFRUF_HINWEIS) steht unter den Dokumenten, außerhalb des Vertragstextes.
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
import { ANGEBOT_AUFRUF_HINWEIS, ANGEBOT_ANSPRECHPARTNER, ANGEBOT_ANSPRECHPARTNER_TITEL, ANGEBOT_ANSPRECHPARTNER_SATZ, ANGEBOT_ANNAHME as AN } from "@shared/fiaon-global-angebot";

type Zeile = { label: string; wert: string; kern?: boolean };
// „Wann sollen wir beginnen?" (Justin, 01.10.2026): zwei Kästchen, keins vorgewählt.
type Beginn = "" | "sofort" | "datum";
type Karte = { titel: string; text: string; fein: string };
type Seite = {
  auftakt: { gruss: string; zeile: string; ueberspringen: string };
  auge: string; fuer: string; titel: string; lead: string; nutzen: string[]; erstattungZeile: string;
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
  schalter: { sofortBeginn: boolean; jahresbetreuung: boolean; startAm?: string | null };
  beginn: { morgen: string; spaetestens: string; widerrufStartAb: string; widerrufEnde: string };
};
type Fertig = {
  ref: string; auftragRef: string | null; email: string; sofortBeginn: boolean; zahlungsseite: string | null; meinAuftrag: string | null;
  vertragUrl: string | null; rechnungUrl: string | null; fertigTitel: string; fertigText: string; betragCents: number; hinweis?: string;
  teil1Bezahlt?: boolean; fertigZahlung?: string; fertigFuss?: string;
};

/** Die Wahl als Abfrage: beginn=sofort | beginn=datum&startAm=… | ohne Wahl der Vertrag „nach der Widerrufsfrist". */
const wahlQuery = (b: Beginn, tag: string, jb: boolean) =>
  `${b === "sofort" ? "beginn=sofort" : b === "datum" && tag ? `beginn=datum&startAm=${encodeURIComponent(tag)}` : "sofortBeginn=0"}&jahresbetreuung=${jb ? 1 : 0}`;
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

// ── Ihre Ansprechpartner ─────────────────────────────────────────────────────
// Drei Karten mit Foto, Rolle, E-Mail und Telefon (Justin, 01.10.2026). Am Rechner drei
// nebeneinander, am Handy untereinander mit dem Foto links — E-Mail und Telefon sind
// große Tippflächen (mailto:/tel:). Fehlt ein Foto, steht das Monogramm.
function Ansprechpartner({ angebotRef }: { angebotRef: string }) {
  const [ohneBild, setOhneBild] = useState<Record<string, boolean>>({});
  const betreff = encodeURIComponent(`Mein Angebot ${angebotRef}`);
  return (
    <ul className="gia-kontakt">
      {ANGEBOT_ANSPRECHPARTNER.map((p) => (
        <li key={p.kuerzel}>
          <div className="gia-kontakt-kopf">
            <span className="gia-kontakt-bild" aria-hidden="true">
              {ohneBild[p.kuerzel]
                ? <span className="gia-kontakt-mono">{p.name.split(/\s+/).map((t) => t[0]).join("").slice(0, 2)}</span>
                : <img src={`/portraits/${p.kuerzel}.jpg`} alt="" width={72} height={72} loading="lazy" decoding="async" onError={() => setOhneBild((o) => ({ ...o, [p.kuerzel]: true }))} />}
            </span>
            <span className="gia-kontakt-wer"><b>{p.name}</b><span>{p.rolle}</span></span>
          </div>
          <div className="gia-kontakt-wege">
            <a href={`mailto:${p.email}?subject=${betreff}`}>
              <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M3 5.5h14v9H3z M3.4 5.9 10 11l6.6-5.1" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
              <span>{p.email}</span>
            </a>
            <a href={`tel:${p.telefon.replace(/\s/g, "")}`}>
              <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M6.2 3.2 8 3l1.3 3.3-1.6 1.1a8.6 8.6 0 0 0 4.9 4.9l1.1-1.6L17 12l-.2 1.8c-.1.7-.7 1.2-1.4 1.2A12.4 12.4 0 0 1 5 4.6c0-.7.5-1.3 1.2-1.4z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
              <span>{p.telefon}</span>
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function BusinessAngebot() {
  const [, treffer] = useRoute("/business/angebot/:token");
  const token = String(treffer?.token ?? "");
  const [beginn, setBeginn] = useState<Beginn>("");
  const [startAm, setStartAm] = useState("");
  // Erst nach dem ersten Klick auf den Knopf zeigt die Seite, was fehlt — dann laufend, bis alles da ist.
  const [zeigeFehlt, setZeigeFehlt] = useState(false);
  const [uebersichtOffen, setUebersichtOffen] = useState(false);
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
  // Angebot-Aufrufe: Nach dem ersten erfolgreichen Laden ist jedes weitere Laden ein Nachladen (?wahl=1), kein neues Öffnen.
  const geladen = useRef(false);
  const auftaktGeht = useCallback(() => setAuftakt((a) => (a === "offen" ? "geht" : a)), []);
  const auftaktEnde = useCallback(() => setAuftakt("vorbei"), []);

  const laden = useCallback(async (b: Beginn, tag: string, jb: boolean) => {
    if (!token) { setStand("fehler"); setFehler("Dieser Link ist unvollständig. Bitte öffnen Sie den Link aus unserer Nachricht."); return; }
    const nr = ++anfrage.current;
    setLaedtNeu(true);
    const ab = new AbortController();
    const zeit = window.setTimeout(() => ab.abort(), 20_000);
    try {
      const r = await fetch(`/api/fiaon/global/angebot/${encodeURIComponent(token)}?${wahlQuery(b, tag, jb)}${geladen.current ? "&wahl=1" : ""}`, { signal: ab.signal, credentials: "include" });
      const j = await r.json().catch(() => null);
      if (nr !== anfrage.current) return;
      if (!r.ok || !j?.ok) { setStand("fehler"); setFehler(j?.error || "Das Angebot ließ sich nicht laden. Bitte versuchen Sie es gleich noch einmal."); return; }
      geladen.current = true;
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

  // Der Vertrag folgt der Wahl: ein halb getippter Tag (leer) lädt den Vertrag ohne Starttag.
  const tagFuerVertrag = beginn === "datum" && /^\d{4}-\d{2}-\d{2}$/.test(startAm) ? startAm : "";
  useEffect(() => { void laden(beginn, tagFuerVertrag, jahresbetreuung); }, [laden, beginn, tagFuerVertrag, jahresbetreuung]);

  // Was für die Annahme fehlt — mit dem Feld, zu dem die Seite springt.
  const R = sicht?.beginn;
  const fehltListe: { id: string; text: string }[] = [];
  if (!beginn) fehltListe.push({ id: "gia-beginn", text: `${AN.beginnTitel} ${AN.fehltBeginn}` });
  else if (beginn === "datum" && R && !(tagFuerVertrag && tagFuerVertrag >= R.morgen && tagFuerVertrag <= R.spaetestens)) {
    fehltListe.push({ id: "gia-startdatum", text: AN.fehltDatum(tagDe(R.morgen), tagDe(R.spaetestens)) });
  }
  const fehltBeginn = zeigeFehlt && fehltListe.some((f) => f.id === "gia-beginn");
  const fehltDatum = zeigeFehlt && fehltListe.some((f) => f.id === "gia-startdatum");
  const hinspringen = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: ruhigeBewegung() ? "auto" : "smooth" });
    const feld = el.querySelector<HTMLInputElement>("input") ?? el;
    window.setTimeout(() => feld.focus({ preventScroll: true }), ruhigeBewegung() ? 0 : 350);
  };

  const annehmen = async () => {
    if (!sicht || sendet || laedtNeu) return;
    if (fehltListe.length) { setZeigeFehlt(true); setAntwortFehler(""); hinspringen(fehltListe[0].id); return; }
    setSendet(true); setAntwortFehler("");
    try {
      const r = await fetch(`/api/fiaon/global/angebot/${encodeURIComponent(token)}/annehmen`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beginn, startAm: beginn === "datum" ? tagFuerVertrag : null, jahresbetreuung, textHash: sicht.textHash, falle }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setFertig(j as Fertig); window.scrollTo({ top: 0 }); return; }
      setAntwortFehler(j?.error || "Die Annahme ließ sich gerade nicht speichern. Bitte versuchen Sie es noch einmal.");
      if (j?.code === "BEGINN") { setZeigeFehlt(true); hinspringen("gia-beginn"); }
      if (j?.code === "STARTDATUM") { setZeigeFehlt(true); hinspringen("gia-startdatum"); }
      if (j?.code === "GEAENDERT") void laden(beginn, tagFuerVertrag, jahresbetreuung);
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
          <button type="button" className="gs-link" onClick={() => { setStand("laedt"); void laden(beginn, tagFuerVertrag, jahresbetreuung); }}>Erneut laden</button>
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
            <p className="gia-klein gia-aufruf-hinweis">{ANGEBOT_AUFRUF_HINWEIS}</p>
          </div>
          <section className="gia-abschnitt" aria-label={ANGEBOT_ANSPRECHPARTNER_TITEL}>
            <h2 className="gia-h2">{ANGEBOT_ANSPRECHPARTNER_TITEL}</h2>
            <Ansprechpartner angebotRef={fertig.ref} />
          </section>
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
            {S.erstattungZeile && (() => { const z = S.erstattungZeile; const i = z.indexOf(": "); return (
              <p className="gia-garantie"><b>{i > 0 ? z.slice(0, i) : z}</b>{i > 0 ? <span>{z.slice(i + 2)}</span> : null}</p>
            ); })()}
            <div className="gia-hero-weiter">
              <a href="#bekommen">{S.bekommenTitel}</a>
              <a href="#ansprechpartner">{ANGEBOT_ANSPRECHPARTNER_TITEL}</a>
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

          {/* 4b — Ihre Ansprechpartner: drei Menschen mit Foto, E-Mail und Telefon (außerhalb des Vertragstextes). */}
          <Abschnitt id="ansprechpartner">
            <h2 className="gia-h2">{ANGEBOT_ANSPRECHPARTNER_TITEL}</h2>
            <p className="gia-sub">{ANGEBOT_ANSPRECHPARTNER_SATZ}</p>
            <Ansprechpartner angebotRef={sicht.ref} />
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
              <a href={`${sicht.vertragPdf}?${wahlQuery(beginn, tagFuerVertrag, jahresbetreuung)}`} target="_blank" rel="noreferrer">Vertrag als PDF ansehen (Entwurf)</a>
              <a href={sicht.pruefberichtPdf} target="_blank" rel="noreferrer">Anlage 2: Prüfbericht (PDF)</a>
            </div>
            {/* Angebot-Aufrufe (01.10.2026): außerhalb des Vertragstextes — die Prüfsumme bleibt, wie sie ist. */}
            <p className="gia-fein gia-aufruf-hinweis">{ANGEBOT_AUFRUF_HINWEIS}</p>
            {/* Der Text kommt von unserem eigenen Server aus derselben Quelle wie das PDF; Kundenangaben sind dort maskiert. */}
            <div id="vertragstext" className={`gs-vertrag gia-vertrag${vertragOffen ? " offen" : ""}`} tabIndex={0} aria-busy={laedtNeu || undefined} data-veraltet={laedtNeu ? "1" : undefined} dangerouslySetInnerHTML={{ __html: sicht.html }} />
            <button type="button" className="gia-vertrag-knopf" aria-expanded={vertragOffen} aria-controls="vertragstext" onClick={() => setVertragOffen((v) => !v)}>
              {vertragOffen ? S.vertragZu : S.vertragAuf}
            </button>
          </Abschnitt>

          {/* 7 — Die Annahme: Wahl, Übersicht, Knopf. § 312j Abs. 2 BGB: die Übersicht UNMITTELBAR über dem Knopf. */}
          <section className="gs-blatt gia-annahme" id="annahme" aria-label={A.titel}>
            {/* „Wann sollen wir beginnen?" — zwei Kästchen, keins vorgewählt (Justin, 01.10.2026). Die Erklärung zum
                Widerruf steht klein und grau darunter, sobald sie gilt: bei „Sofort starten" und bei einem Starttag vor dem
                Ende der Widerrufsfrist (das entscheidet der Server, sicht.schalter.sofortBeginn). */}
            <div className={`gs-beginn gia-wahl gia-beginn${fehltBeginn ? " gia-feld-fehlt" : ""}`} id="gia-beginn" role="group" aria-labelledby="gia-beginn-titel" aria-describedby={fehltBeginn ? "gia-beginn-fehlt" : undefined}>
              <h3 id="gia-beginn-titel">{A.beginnTitel}</h3>
              <p className="gia-fein">{AN.beginnWahl}</p>
              <div className="gia-optionen">
                <label className={`gia-option${beginn === "sofort" ? " an" : ""}`}>
                  <input type="checkbox" checked={beginn === "sofort"} onChange={(e) => setBeginn(e.target.checked ? "sofort" : "")} />
                  <span className="gia-option-text"><b>{AN.beginnSofort}</b><span>{AN.beginnSofortUnter}</span></span>
                </label>
                <div className={`gia-option gia-option-datum${beginn === "datum" ? " an" : ""}`}>
                  <label className="gia-option-kopf">
                    <input type="checkbox" checked={beginn === "datum"} onChange={(e) => { setBeginn(e.target.checked ? "datum" : ""); if (e.target.checked) window.setTimeout(() => document.getElementById("gia-startdatum-feld")?.focus(), 0); }} />
                    <span className="gia-option-text"><b>{AN.beginnDatum}</b><span>{AN.beginnDatumUnter}</span></span>
                  </label>
                  {beginn === "datum" && (
                    <div className={`gia-datum${fehltDatum ? " gia-feld-fehlt" : ""}`} id="gia-startdatum">
                      <label htmlFor="gia-startdatum-feld">{AN.beginnDatumFeld}</label>
                      <input id="gia-startdatum-feld" type="date" value={startAm} min={R?.morgen} max={R?.spaetestens}
                        onChange={(e) => setStartAm(e.target.value)} aria-invalid={fehltDatum || undefined} aria-describedby={fehltDatum ? "gia-datum-fehlt" : undefined} />
                      {fehltDatum && R && <p className="gia-feld-hinweis" id="gia-datum-fehlt">{AN.fehltDatum(tagDe(R.morgen), tagDe(R.spaetestens))}</p>}
                    </div>
                  )}
                </div>
              </div>
              {fehltBeginn && <p className="gia-feld-hinweis" id="gia-beginn-fehlt">{AN.fehltBeginn}</p>}
              {(beginn === "sofort" || (beginn === "datum" && !!tagFuerVertrag && sicht.schalter?.startAm === tagFuerVertrag && sicht.schalter.sofortBeginn)) && (
                <p className="gia-widerruf-grau">{A.sofortBeginn}</p>
              )}
              {beginn === "datum" && !!tagFuerVertrag && sicht.schalter?.startAm === tagFuerVertrag && !sicht.schalter.sofortBeginn && R && (
                <p className="gia-widerruf-grau">{AN.beginnNachWiderruf(tagDe(R.widerrufEnde))}</p>
              )}
            </div>
            <div className="gia-wahl">
              <label><input type="checkbox" checked={jahresbetreuung} onChange={(e) => setJahresbetreuung(e.target.checked)} /><span>{A.jahresbetreuung}</span></label>
              <p className="gia-fein">{A.jahresbetreuungUnter}</p>
            </div>

            {/* Ein- und ausklappbar (Justin, 01.10.2026) — die Kernzeilen (Leistung, Preise, Laufzeit, Beginn) bleiben
                immer sichtbar, § 312j Abs. 2 BGB; der Schalter steht oben, damit die Übersicht direkt über dem Knopf bleibt. */}
            <div className="gia-uebersicht-kopf">
              <h2 className="gia-h2 gia-uebersicht-titel">{A.titel}</h2>
              {sicht.uebersicht.some((z) => !z.kern) && (
                <button type="button" className="gia-uebersicht-knopf" aria-expanded={uebersichtOffen} aria-controls="gia-uebersicht" onClick={() => setUebersichtOffen((o) => !o)}>
                  {uebersichtOffen ? AN.uebersichtWeniger : `${AN.uebersichtMehr} (${sicht.uebersicht.filter((z) => !z.kern).length} weitere)`}
                </button>
              )}
            </div>
            <dl className="gia-uebersicht" id="gia-uebersicht" aria-busy={laedtNeu || undefined}>
              {sicht.uebersicht.filter((z) => uebersichtOffen || z.kern).map((z) => (
                <div key={z.label}><dt>{z.label}</dt>
                  {/* Solange nichts gewählt ist, zeigt „Beginn" das ehrlich — nicht den Vertragsstand ohne Wahl. */}
                  <dd className={z.label === "Beginn" && !(beginn === "sofort" || (beginn === "datum" && tagFuerVertrag)) ? "gia-offen" : undefined}>
                    {z.label === "Beginn" && !(beginn === "sofort" || (beginn === "datum" && tagFuerVertrag)) ? AN.beginnOffen : z.wert}
                  </dd>
                </div>
              ))}
            </dl>
            <input className="gs-falle" tabIndex={-1} autoComplete="off" aria-hidden="true" value={falle} onChange={(e) => setFalle(e.target.value)} />
            {antwortFehler && <p className="gs-fehler" role="alert">{antwortFehler}</p>}
            {sicht.annahmeBereit ? (
              <div className="gia-knopf-block">
                <button type="button" className="gs-knopf gia-annehmen" onClick={annehmen} disabled={sendet || laedtNeu}>
                  {sendet ? "Wird gespeichert …" : A.knopf}
                </button>
                {laedtNeu && <p className="gia-fein" role="status">Der Vertrag wird an Ihre Wahl angepasst …</p>}
                {/* Was fehlt — erst nach dem ersten Klick, dann laufend; jeder Punkt springt zum Feld. */}
                {zeigeFehlt && fehltListe.length > 0 && (
                  <div className="gia-fehlt" role="alert">
                    <b>{AN.fehltTitel}</b>
                    <ul>{fehltListe.map((f) => <li key={f.id}><a href={`#${f.id}`} onClick={(e) => { e.preventDefault(); hinspringen(f.id); }}>{f.text}</a></li>)}</ul>
                  </div>
                )}
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
