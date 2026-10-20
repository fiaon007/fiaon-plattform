// ═══════════════════════════════════════════════════════════════════════════
// DER VERLAUF (E-248 · Neubau 20.10.2026) — Blasen wie bei WhatsApp
//
// Justin, 20.10.2026: „schön, cleanes WhatsApp … wie man es kennt, nur eben
// ein wenig in FIAON CI".
//
// · Hintergrund wie bei WhatsApp, nur in FIAON-Blau statt Beige (CSS).
// · Blasen mit Zipfel an der ersten Blase einer Gruppe: Kunde links hell,
//   wir rechts in FIAON-Blau — das Team im hellen Blau, Mara im tiefen Blau
//   mit „Mara KI". Zeit und Häkchen IN der Blase unten rechts (✓ gesendet,
//   ✓✓ zugestellt, ✓✓ hell = gelesen, ! = nicht zugestellt).
// · Tagesstreifen „Heute", „Gestern", „Samstag, 17. Oktober"; beim Öffnen
//   „2 ungelesene Nachrichten" vor den neuen.
// · Vorlagen wie beim Kunden: Kopfbild oder Kopfzeile, Text, Fußzeile, darunter
//   die Knöpfe — und oben klein „Vorlage · Erstkontakt", damit man sie erkennt.
//   Lange Vorlagen sind gekürzt („Mehr anzeigen").
// · Fotos, Sprachnachrichten, Dokumente direkt in der Blase (Medien.tsx); was
//   nicht geht, als sauberer Platzhalter. Reaktionen (👍) hängen an der Blase.
// · Maras interne Schritte: eine leise Zeile, standardmäßig zu.
//
// BLEIBT (E-248): NUR der Verlauf scrollt (scrollTop, nie scrollIntoView — das
// zog die ganze Seite mit). Ans Ende geht es nur, wenn man schon unten ist;
// sonst erscheint „↓ 2 neue". Wächst das Feld, bleibt unten, wer unten war.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { InterneSchritte } from "./InterneSchritte";
import { MedienInhalt } from "./Medien";
import { artAusTyp, hakenStufe, uhr, vorlageNameRoh, vorname, wann, type Eintrag, type Nachricht } from "./wr-format";
import { ZAntwort, ZHaken, ZLink, ZRunter, ZUhr, ZWarnung } from "./Symbole";

/** Gesendet ✓ · zugestellt ✓✓ · gelesen ✓✓ hell · Fehler ! — als SVG, nicht als Textzeichen. */
export function Haken({ n }: { n: Nachricht }) {
  const stufe = hakenStufe(n);
  if (stufe === "fehler") return <span className="wr-haken fehler" role="img" aria-label="nicht zugestellt"><ZWarnung g={14} /></span>;
  // Noch ohne Zeit bei Meta (gerade erst angelegt): die Uhr wie bei WhatsApp.
  if (stufe === "gesendet" && n.status === "offen") return <span className="wr-haken" role="img" aria-label="wird gesendet"><ZUhr g={13} /></span>;
  const text = stufe === "gelesen" ? "gelesen" : stufe === "zugestellt" ? "zugestellt" : "gesendet";
  return (
    <span className={`wr-haken${stufe === "gelesen" ? " gelesen" : ""}`} role="img" aria-label={text} title={text}>
      <ZHaken doppelt={stufe !== "gesendet"} />
    </span>
  );
}

const LANG_ZEICHEN = 900;
const VORLAGE_LANG = 280;

/** Text mit „Mehr anzeigen" — bei WhatsApp genauso für sehr lange Nachrichten. */
function Text({ text, grenze, platz }: { text: string; grenze: number; platz: boolean }) {
  const [auf, setAuf] = useState(false);
  const lang = text.length > grenze || text.split("\n").length > Math.max(6, Math.round(grenze / 60));
  return (
    <>
      <p className={`wr-text${lang && !auf ? " gekuerzt" : ""}`}>{text}{platz && <span className="wr-platz" aria-hidden="true" />}</p>
      {lang && (
        <button type="button" className="wr-mehr" onClick={() => setAuf(!auf)} aria-expanded={auf}>
          {auf ? "Weniger anzeigen" : "Mehr anzeigen"}
        </button>
      )}
    </>
  );
}

function Blase({ e, api }: { e: Extract<Eintrag, { art: "nachricht" }>; api: string }) {
  const { n, absender, gruppeNeu, gruppeEnde, reaktionen } = e;
  const raus = n.richtung === "raus";
  const fehler = n.status === "fehler";
  const va = n.vorlage ? n.vorlageAnzeige ?? null : null;
  const knoepfe = va?.knoepfe ?? [];
  // Nur wenn die Nachricht wirklich etwas trug (Foto, Ton, Dokument …) — Text bleibt eine schlichte Blase.
  const art = n.medien?.art ?? artAusTyp(n.typ);
  const medien = !n.vorlage && art && art !== "reaktion" ? <MedienInhalt n={n} api={api} /> : null;
  const titel = n.medien?.titel?.trim() || "";
  const text = n.vorlage ? (n.text || n.vorlageText || "") : (n.text?.trim() || titel);
  const nurBild = !!medien && !text && (art === "bild" || art === "video") && !!n.medien?.datei;
  const sticker = art === "sticker" && !!n.medien?.datei;
  const knopfAntwort = !raus && (n.typ === "button" || n.typ === "interactive");
  return (
    <div className={`wr-reihe ${raus ? "raus" : "rein"}${gruppeNeu ? " neu" : ""}${gruppeEnde ? " ende" : ""}`} data-absender={absender}>
      <div className={`wr-stapel${knoepfe.length ? " mit-knoepfen" : ""}`}>
        <div className={`wr-blase ${absender}${fehler ? " fehler" : ""}${n.auto ? " auto" : ""}${n.vorlage ? " vorlage" : ""}${medien ? " mit-medien" : ""}${medien && !text ? " ohne-text" : ""}${nurBild ? " nur-bild" : ""}${sticker ? " sticker" : ""}${gruppeNeu ? " zipfel" : ""}${reaktionen.length ? " mit-reaktion" : ""}`}>
          {raus && gruppeNeu && (
            <span className="wr-absender">
              {absender === "mara"
                ? <>Mara <span className="wr-ki" title="Mara ist die digitale Assistentin (KI) von FIAON">KI</span></>
                : vorname(n.von)}
            </span>
          )}
          {n.vorlage && (
            <span className="wr-vorlage-marke" title={`Freigegebene WhatsApp-Vorlage (${n.vorlage})`}>Vorlage · {n.vorlageName ?? vorlageNameRoh(n.vorlage)}</span>
          )}
          {n.auto && <span className="wr-automarke">Automatische Antwort</span>}
          {knopfAntwort && <span className="wr-knopfmarke"><ZAntwort g={13} />per Knopf geantwortet</span>}
          {va?.bild && <img className="wr-vorlage-bild" src={va.bild} alt="" loading="lazy" decoding="async" />}
          {va?.kopf && !va.bild && <b className="wr-vorlage-kopf">{va.kopf}</b>}
          {medien}
          {text
            ? <Text text={text} grenze={n.vorlage ? VORLAGE_LANG : LANG_ZEICHEN} platz={!va?.fuss} />
            : !medien && <p className="wr-text wr-leise">Nachricht ohne Text<span className="wr-platz" aria-hidden="true" /></p>}
          {va?.fuss && <small className="wr-vorlage-fuss">{va.fuss}<span className="wr-platz" aria-hidden="true" /></small>}
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
          {reaktionen.length > 0 && <span className="wr-reaktion" title="Reaktion des Kunden">{reaktionen.join(" ")}</span>}
        </div>
        {knoepfe.length > 0 && (
          <div className="wr-vk-liste" aria-label="Knöpfe der Vorlage beim Kunden">
            {knoepfe.map((k, i) => (
              <span key={i} className="wr-vk" title={k.art === "link" ? "Knopf mit Link — öffnet beim Kunden eine Seite" : "Antwort-Knopf beim Kunden"}>
                {k.art === "link" ? <ZLink g={15} /> : <ZAntwort g={15} />}{k.text}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function Verlauf({ nummer, eintraege, geladen, alleSchritte, zumEnde, api }: {
  nummer: string; eintraege: Eintrag[]; geladen: boolean; alleSchritte: boolean;
  /** Zähler: steigt er, geht der Verlauf ans Ende (eigene Nachricht gesendet). */
  zumEnde: number;
  /** /api/fiaon/<tür>/whatsapp — für Fotos, Sprachnachrichten, Dokumente. */
  api: string;
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

  // Wächst das Eingabefeld (oder lädt ein Foto nach), wird der Verlauf kleiner bzw. länger — wer unten war, bleibt unten.
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => { if (unten.current) el.scrollTop = el.scrollHeight; });
    ro.observe(el);
    const innen = el.firstElementChild;
    if (innen) ro.observe(innen);
    return () => ro.disconnect();
  }, [geladen]);

  const beimScrollen = () => {
    const el = box.current; if (!el) return;
    const nah = el.scrollHeight - el.scrollTop - el.clientHeight < 64;
    unten.current = nah;
    if (nah && neu) setNeu(0);
  };

  return (
    <div className="wr-verlauf-rahmen">
      <div className="wr-verlauf" ref={box} onScroll={beimScrollen} role="log" aria-live="polite" aria-label="Nachrichten">
        <div className="wr-verlauf-innen">
          {!geladen ? (
            <div className="wr-verlauf-laedt" role="status" aria-label="Lädt …"><span /><span /><span /></div>
          ) : eintraege.length === 0 ? <p className="wr-hinweis-zeile"><span>Noch keine Nachricht.</span></p>
            : eintraege.map((e) => {
              if (e.art === "tag") return <div key={e.key} className="wr-tag"><span>{e.text}</span></div>;
              if (e.art === "ungelesen") {
                return <div key={e.key} className="wr-ungelesen-streifen"><span>{e.anzahl === 1 ? "1 ungelesene Nachricht" : `${e.anzahl} ungelesene Nachrichten`}</span></div>;
              }
              if (e.art === "hinweis") return <div key={e.key} className="wr-hinweis-zeile"><span>{e.text}</span></div>;
              if (e.art === "schritte") {
                const auf = offen[e.key] ?? alleSchritte;
                return <InterneSchritte key={e.key} liste={e.liste} offen={auf} onUmschalten={() => setOffen((o) => ({ ...o, [e.key]: !auf }))} />;
              }
              return <Blase key={e.key} e={e} api={api} />;
            })}
        </div>
      </div>
      {neu > 0 && (
        <button type="button" className="wr-neu-pille" onClick={ansEnde}>
          <ZRunter g={14} />
          {neu} {neu === 1 ? "neue Nachricht" : "neue"}
        </button>
      )}
    </div>
  );
}
