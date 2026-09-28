// ═══════════════════════════════════════════════════════════════════════════
// DER VERLAUF (E-248) — Blasen je Absender, Tagesstreifen, Häkchen, Scrollen
//
// · Kunde links (Schiefer), Mara rechts in Navy mit „Mara KI", Menschen aus
//   dem Team rechts im Blau-Paar mit ihrem Namen. Vorher trugen alle eigenen
//   Blasen dasselbe Blau — wer was geschrieben hatte, stand nur klein im Fuß.
// · Blasen desselben Absenders hintereinander werden gruppiert.
// · Autoantworten („Vielen Dank für Ihre Nachricht … melden uns") tragen die
//   Marke „Automatische Antwort" und treten zurück.
// · Vorlagen als kompakte Karte mit Klartextnamen, drei Zeilen, aufklappbar.
// · NUR der Verlauf scrollt (scrollTop, nie scrollIntoView — das zog die
//   ganze Seite mit). Ans Ende geht es nur, wenn man schon unten ist; sonst
//   erscheint „↓ 2 neue".
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { InterneSchritte } from "./InterneSchritte";
import { typText, uhr, vorlageNameRoh, vorname, wann, type Eintrag, type Nachricht } from "./wr-format";

/** Gesendet ✓ · zugestellt ✓✓ · gelesen ✓✓ im Blau-Paar · Fehler ! — als SVG, nicht als Textzeichen. */
export function Haken({ n }: { n: Nachricht }) {
  if (n.status === "fehler") {
    return (
      <svg className="wr-haken fehler" width="14" height="14" viewBox="0 0 14 14" role="img" aria-label="nicht zugestellt">
        <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M7 3.8v3.9M7 9.9v.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  const gelesen = !!n.gelesen_am;
  const doppelt = gelesen || !!n.zugestellt_am;
  const text = gelesen ? "gelesen" : doppelt ? "zugestellt" : "gesendet";
  return (
    <svg className={`wr-haken${gelesen ? " gelesen" : ""}`} width="17" height="11" viewBox="0 0 17 11" role="img" aria-label={text}>
      <title>{text}</title>
      <path d="M1.2 6.1 4.3 9.2 10.8 1.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {doppelt && <path d="M7.4 8.3 8.3 9.2 14.8 1.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

function VorlagenKarte({ n }: { n: Nachricht }) {
  const [auf, setAuf] = useState(false);
  const text = n.text || n.vorlageText || "";
  const lang = text.length > 160 || text.split("\n").length > 3;
  return (
    <div className={`wr-vorlagekarte${auf ? " auf" : ""}`}>
      <small>Vorlage · {n.vorlageName ?? vorlageNameRoh(n.vorlage)}</small>
      {text ? <p>{text}</p> : <p className="wr-leise">Der Text dieser Vorlage liegt bei Meta.</p>}
      {lang && (
        <button type="button" className="wr-mehr" onClick={() => setAuf(!auf)} aria-expanded={auf}>
          {auf ? "weniger zeigen" : "ganzen Text zeigen"}
        </button>
      )}
    </div>
  );
}

function Blase({ e }: { e: Extract<Eintrag, { art: "nachricht" }> }) {
  const { n, absender, gruppeNeu, gruppeEnde } = e;
  const raus = n.richtung === "raus";
  const fehler = n.status === "fehler";
  const medien = !n.text && !n.vorlage ? typText(n.typ) : null;
  return (
    <div className={`wr-reihe ${raus ? "raus" : "rein"}${gruppeNeu ? " neu" : ""}${gruppeEnde ? " ende" : ""}`} data-absender={absender}>
      <div className={`wr-blase ${absender}${fehler ? " fehler" : ""}${n.auto ? " auto" : ""}`}>
        {raus && gruppeNeu && (
          <span className="wr-absender">
            {absender === "mara"
              ? <>Mara <span className="wr-ki" title="Mara ist die digitale Assistentin (KI) von FIAON">KI</span></>
              : vorname(n.von)}
          </span>
        )}
        {n.auto && <span className="wr-automarke">Automatische Antwort</span>}
        {n.vorlage ? <VorlagenKarte n={n} />
          : n.text ? <p>{n.text}</p>
            : <p className="wr-medien">{medien ?? "Nachricht ohne Text"}<small>Nur auf dem Handy des Kunden sichtbar — bitten Sie um Text oder rufen Sie an.</small></p>}
        {n.typ === "button" && <span className="wr-knopfmarke">per Knopf geantwortet</span>}
        <span className="wr-fuss">
          <time dateTime={wann(n)}>{uhr(wann(n))}</time>
          {raus && <Haken n={n} />}
        </span>
        {fehler && (
          <span className="wr-fehlertext">
            {/undeliverable|131026/i.test(n.fehler ?? "")
              ? "Nicht zugestellt — diese Nummer ist bei WhatsApp nicht erreichbar."
              : n.fehler || "Nicht zugestellt."}
          </span>
        )}
      </div>
    </div>
  );
}

export function Verlauf({ nummer, eintraege, geladen, alleSchritte, zumEnde }: {
  nummer: string; eintraege: Eintrag[]; geladen: boolean; alleSchritte: boolean;
  /** Zähler: steigt er, geht der Verlauf ans Ende (eigene Nachricht gesendet). */
  zumEnde: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const unten = useRef(true);
  const bekannt = useRef<{ nummer: string; nachrichten: number; eintraege: number } | null>(null);
  const [neu, setNeu] = useState(0);
  const [offen, setOffen] = useState<Record<string, boolean>>({});

  const ansEnde = useCallback(() => {
    const el = box.current; if (!el) return;
    el.scrollTop = el.scrollHeight;
    unten.current = true; setNeu(0);
  }, []);

  const nachrichten = eintraege.filter((x) => x.art === "nachricht").length;

  // Gesprächswechsel und erste Daten: ans Ende. Danach nur, wenn man unten ist.
  useLayoutEffect(() => {
    if (!geladen) return;
    const b = bekannt.current;
    if (!b || b.nummer !== nummer) {
      bekannt.current = { nummer, nachrichten, eintraege: eintraege.length };
      setOffen({}); ansEnde(); return;
    }
    if (eintraege.length !== b.eintraege || nachrichten !== b.nachrichten) {
      const dazu = Math.max(0, nachrichten - b.nachrichten);
      bekannt.current = { nummer, nachrichten, eintraege: eintraege.length };
      if (unten.current) ansEnde();
      else if (dazu > 0) setNeu((z) => z + dazu);
    }
  }, [nummer, geladen, eintraege.length, nachrichten, ansEnde]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => { if (zumEnde > 0) ansEnde(); }, [zumEnde, ansEnde]);
  // Der Schalter „alle internen Schritte" gilt wieder für alle Bündel.
  useEffect(() => { setOffen({}); }, [alleSchritte]);

  // Wächst das Eingabefeld, wird der Verlauf kleiner — wer unten war, bleibt unten.
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => { if (unten.current) el.scrollTop = el.scrollHeight; });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const beimScrollen = () => {
    const el = box.current; if (!el) return;
    const nah = el.scrollHeight - el.scrollTop - el.clientHeight < 64;
    unten.current = nah;
    if (nah && neu) setNeu(0);
  };

  return (
    <div className="wr-verlauf-rahmen">
      <div className="wr-verlauf" ref={box} onScroll={beimScrollen} role="log" aria-live="polite" aria-label="Nachrichten">
        {!geladen ? <p className="wr-leer">Lädt …</p>
          : eintraege.length === 0 ? <p className="wr-leer">Noch keine Nachricht.</p>
            : eintraege.map((e) => {
              if (e.art === "tag") return <div key={e.key} className="wr-tag"><span>{e.text}</span></div>;
              if (e.art === "schritte") {
                const auf = offen[e.key] ?? alleSchritte;
                return <InterneSchritte key={e.key} liste={e.liste} offen={auf} onUmschalten={() => setOffen((o) => ({ ...o, [e.key]: !auf }))} />;
              }
              return <Blase key={e.key} e={e} />;
            })}
      </div>
      {neu > 0 && (
        <button type="button" className="wr-neu-pille" onClick={ansEnde}>
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 2v8M2.5 6.5 6 10l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          {neu} {neu === 1 ? "neue Nachricht" : "neue"}
        </button>
      )}
    </div>
  );
}
