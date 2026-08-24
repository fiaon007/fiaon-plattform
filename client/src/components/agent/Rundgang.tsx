// ═══════════════════════════════════════════════════════════════════════════
// DER RUNDGANG — jede Seite erklärt sich selbst
//
// ── DER AUFTRAG (Justin, 24.08.2026) ───────────────────────────────────────
// „JEDE Seite, die man öffnet, soll eine Einführung geben und genauestens
// beschreiben, wofür was ist, wie was geht — und mach es realitätsnah. Die
// Einführung soll wirklich GEIL sein, dass man wirklich weiß, worum es geht.
// Und jede Seite braucht einen dezenten Button, dass man das immer wieder
// abspielen kann — mit gebleurtem Hintergrund und Fokus auf das, was gerade
// erklärt wird."
//
// VORHER: Es gab EINEN Rundgang fürs ganze Office, einmalig beim ersten
// Login. Wer drei Wochen später zum ersten Mal in den Bestand-Raum kam,
// bekam nichts — und musste raten, was die Zahlen bedeuten.
// NACHHER: Jeder Raum erklärt sich beim ersten Betreten selbst, Schritt für
// Schritt am echten Bildschirminhalt, und lässt sich jederzeit erneut
// abspielen.
//
// ── WARUM VIER SCHEIBEN UND KEIN LOCH ──────────────────────────────────────
// Die naheliegende Bauart wäre: eine Überlagerung über alles, und das
// erklärte Element per z-index darüber heben. Das geht hier NICHT: Der
// Office-Inhalt lebt in `.of-grund` mit `z-index: 1`, und das erzeugt einen
// eigenen Stapel-Kontext. Alles darin bleibt geschlossen unter einer
// Überlagerung, die außerhalb liegt — kein noch so hoher Wert INNERHALB
// hilft. Genau daran ist heute schon die Kunden-Akte dreimal gescheitert.
//
// Deshalb wird kein Element gehoben, sondern das Dunkel drumherum gelegt:
// vier feste Scheiben (oben, unten, links, rechts) rahmen das erklärte
// Element ein. Was sie bedecken, ist unscharf und abgedunkelt; das Element
// dazwischen bleibt scharf, sichtbar und — wichtig — bedienbar, weil dort
// gar nichts liegt. Das funktioniert in jedem Stapel-Kontext.
//
// ── WAS DER RUNDGANG NICHT TUT ─────────────────────────────────────────────
// Er klickt nichts für den Mitarbeiter und ändert keine Daten. Er zeigt und
// erklärt. Ein Rundgang, der im Hintergrund etwas auslöst, ist ein Risiko —
// besonders in einem Raum, in dem echte Kunden stehen.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "@/pages/agent/shared";

export interface RundgangSchritt {
  /** CSS-Wähler des Elements, das erklärt wird. Fehlt er, wird die ganze
   *  Fläche abgedunkelt und die Karte steht mittig — für Einstieg und Schluss. */
  ziel?: string;
  titel: string;
  /** Was es ist und wofür man es im Alltag braucht. Ganze Sätze, kein Stichwort. */
  text: string;
  /** Ein Satz aus der Praxis: was ein erfahrener Kollege hier tut. */
  tipp?: string;
}

interface Rahmen { top: number; left: number; width: number; height: number }

const LUFT = 8;        // Abstand zwischen Scheinwerfer und Element
const KARTE_BREIT = 380;

export function Rundgang({ raum, titel, schritte }: {
  /** Kleinbuchstaben, Ziffern, Bindestrich — wird als Merker gespeichert. */
  raum: string;
  /** Der Name des Raums, für die Kopfzeile des Rundgangs. */
  titel: string;
  schritte: RundgangSchritt[];
}) {
  const [laeuft, setLaeuft] = useState(false);
  const [i, setI] = useState(0);
  const [rahmen, setRahmen] = useState<Rahmen | null>(null);
  const [bereit, setBereit] = useState(false);   // Merker vom Server gelesen?
  // Die WIRKLICHE Höhe der Karte. Der Anfangswert ist nur für den allerersten
  // Bildaufbau da; danach steht hier immer der gemessene Wert.
  const [karteH, setKarteH] = useState(240);
  const karteRef = useRef<HTMLDivElement | null>(null);
  const gemerkt = useRef(false);

  // ── Beim ersten Betreten von selbst starten ──────────────────────────────
  // Der Merker gehört zum Konto (Server), nicht zum Browser. localStorage
  // dient nur dazu, den zweiten Seitenaufruf nicht warten zu lassen.
  useEffect(() => {
    let an = true;
    const schluessel = `fiaon_rundgang_${raum}`;
    if (localStorage.getItem(schluessel) === "ja") { setBereit(true); return; }
    api("/agent/rundgaenge").then((r) => {
      if (!an) return;
      const gesehen: string[] = r.ok ? (r.json?.gesehen ?? []) : [];
      if (gesehen.includes(raum)) localStorage.setItem(schluessel, "ja");
      // 24.08.2026: NICHT von selbst starten, wenn schon etwas offen ist —
      // eine Akte, das Telefon, ein Dialog. Sonst legt sich die Erklärung
      // über eine Arbeit, die gerade läuft, und der Merker wäre verbraucht,
      // ohne dass jemand den Rundgang gesehen hat. Der Knopf unten links
      // bleibt davon unberührt.
      // Kurz warten, bevor er von selbst aufgeht: Die Seite lädt ihre Daten
      // noch, und ein Rundgang, der über einen leeren Bildschirm läuft,
      // erklärt nichts (24.08.2026, von Justin gemeldet).
      else if (schritte.length > 0) {
        window.setTimeout(() => {
          if (!an) return;
          if (document.querySelector('[role="dialog"]')) return;  // Akte/Telefon offen
          setLaeuft(true);
        }, 900);
      }
      setBereit(true);
    }).catch(() => setBereit(true));
    return () => { an = false; };
  }, [raum, schritte.length]);

  const merken = useCallback(() => {
    if (gemerkt.current) return;
    gemerkt.current = true;
    localStorage.setItem(`fiaon_rundgang_${raum}`, "ja");
    void api(`/agent/rundgaenge/${raum}`, { method: "POST", body: JSON.stringify({}) }).catch(() => null);
  }, [raum]);

  const schliessen = useCallback(() => { setLaeuft(false); setI(0); merken(); }, [merken]);

  // ── Die Karte AUSMESSEN, bevor sie sitzt ─────────────────────────────────
  // `useLayoutEffect` läuft nach dem Aufbau, aber VOR dem Zeichnen: Der
  // Betrachter sieht die Karte nie an der falschen Stelle aufblitzen. Der
  // Beobachter fängt die Fälle, in denen sich die Höhe nachträglich ändert —
  // etwa wenn eine Schriftart nachlädt und der Text auf eine Zeile mehr
  // umbricht.
  useLayoutEffect(() => {
    const el = karteRef.current;
    if (!el) return;
    const nachmessen = () => {
      const h = el.getBoundingClientRect().height;
      if (h > 0) setKarteH((alt) => (Math.abs(alt - h) > 1 ? h : alt));
    };
    nachmessen();
    if (typeof ResizeObserver === "undefined") return;
    const beobachter = new ResizeObserver(nachmessen);
    beobachter.observe(el);
    return () => beobachter.disconnect();
  }, [laeuft, i, bereit]);

  // ── Das erklärte Element suchen und im Bild halten ───────────────────────
  const messen = useCallback(() => {
    const s = schritte[i];
    if (!s?.ziel) { setRahmen(null); return; }
    const el = document.querySelector(s.ziel) as HTMLElement | null;
    if (!el) { setRahmen(null); return; }   // Element fehlt (leerer Raum) → nur Text
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) { setRahmen(null); return; }
    setRahmen({ top: r.top - LUFT, left: r.left - LUFT, width: r.width + LUFT * 2, height: r.height + LUFT * 2 });
  }, [schritte, i]);

  // ── AUF DAS ELEMENT WARTEN (24.08.2026) ──────────────────────────────────
  // VORHER wurde EINMAL nach 380 ms gemessen. Wer eine Seite öffnet, deren
  // Daten noch unterwegs sind, bekam einen Leuchtrahmen um NICHTS gelegt —
  // Justin hat genau das gemeldet („die Einführung passt nicht"). NACHHER
  // wird bis zu 4 Sekunden lang alle 150 ms nachgesehen, ob das Element da
  // ist und eine Größe hat. Taucht es auf, rollt der Rundgang hin und rahmt
  // es. Bleibt es aus (leerer Raum, Element gibt es hier nicht), steht die
  // Karte mittig ohne Scheinwerfer — erklärt wird trotzdem.
  useEffect(() => {
    if (!laeuft) return;
    const s = schritte[i];
    if (!s?.ziel) { setRahmen(null); return; }

    let abgebrochen = false;
    let gerollt = false;
    let versuche = 0;
    const HOECHSTENS = 27;          // 27 × 150 ms ≈ 4 s
    const pruefen = () => {
      if (abgebrochen) return;
      const el = document.querySelector(s.ziel!) as HTMLElement | null;
      const r = el?.getBoundingClientRect();
      const da = !!r && (r.width > 4 || r.height > 4);
      if (da && !gerollt) {
        gerollt = true;
        // Erst ins Bild rollen, dann rahmen — sonst zeigt der Scheinwerfer
        // auf eine Stelle, die der Mitarbeiter gar nicht sieht.
        el!.scrollIntoView({ behavior: "smooth", block: "center" });
        window.setTimeout(() => { if (!abgebrochen) messen(); }, 340);
        return;
      }
      if (da) { messen(); return; }
      setRahmen(null);
      if (++versuche < HOECHSTENS) window.setTimeout(pruefen, 150);
    };
    pruefen();
    return () => { abgebrochen = true; };
  }, [laeuft, i, schritte, messen]);

  useEffect(() => {
    if (!laeuft) return;
    // #root ist der Scroll-Container des Office, nicht das Fenster — beides
    // beobachten, sonst wandert der Scheinwerfer beim Rollen aus dem Bild.
    const wurzel = document.getElementById("root");
    window.addEventListener("resize", messen);
    window.addEventListener("scroll", messen, true);
    wurzel?.addEventListener("scroll", messen);
    return () => {
      window.removeEventListener("resize", messen);
      window.removeEventListener("scroll", messen, true);
      wurzel?.removeEventListener("scroll", messen);
    };
  }, [laeuft, messen]);

  // ── Tastatur: blättern und beenden ───────────────────────────────────────
  useEffect(() => {
    if (!laeuft) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") { schliessen(); return; }
      if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setI((n) => (n + 1 < schritte.length ? n + 1 : (schliessen(), n)));
      }
      if (e.key === "ArrowLeft") { e.preventDefault(); setI((n) => Math.max(0, n - 1)); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [laeuft, schritte.length, schliessen]);

  if (schritte.length === 0) return null;

  // ── Der dezente Knopf zum Wiederabspielen ────────────────────────────────
  const knopf = createPortal(
    <button type="button" className="ru-knopf" onClick={() => { setI(0); setLaeuft(true); }}
            title={`Rundgang: ${titel}`} aria-label={`Rundgang starten: ${titel}`}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M9.6 9.4a2.5 2.5 0 1 1 3.2 3.1c-.5.2-.8.7-.8 1.2v.4" />
        <path d="M12 17.2h.01" />
      </svg>
      <span>Rundgang</span>
    </button>,
    document.body,
  );

  if (!laeuft || !bereit) return knopf;

  const s = schritte[i];
  const letzter = i === schritte.length - 1;

  // ── Die Karte platzieren ─────────────────────────────────────────────────
  //
  // 24.08.2026, Justin: „Das 6/6-Fenster schneidet unten ab und ist nicht
  // vollständig ersichtlich" — und auf dem Dashboard dasselbe bei 3/3.
  //
  // VORHER wurde mit einer GESCHÄTZTEN Höhe von 220 px gerechnet. Schritte mit
  // langem Text und Praxis-Kasten sind aber gut doppelt so hoch: Die Rechnung
  // „passt unten" ging auf, die Karte lief trotzdem aus dem Bild.
  //
  // NACHHER wird die WIRKLICHE Höhe gemessen (`karteH`, siehe useLayoutEffect
  // weiter unten) und die Karte danach in drei Stufen platziert:
  //   1. unter das Element, wenn sie dort ganz hineinpasst,
  //   2. sonst darüber, wenn sie dort ganz hineinpasst,
  //   3. sonst an den Rand geschoben und, falls sie höher ist als das Fenster,
  //      in sich selbst scrollbar (`max-height` im CSS).
  // In jedem Fall wird der Wert zuletzt in das Fenster geklemmt — abgeschnitten
  // wird nichts mehr.
  const fensterB = window.innerWidth;
  const fensterH = window.innerHeight;
  const breite = Math.min(KARTE_BREIT, fensterB - 24);
  const RAND = 12;
  let karte: { top: number; left: number } | null = null;
  if (rahmen) {
    const unter = rahmen.top + rahmen.height + 14;
    const ueber = rahmen.top - 14 - karteH;
    const passtUnter = unter + karteH <= fensterH - RAND;
    const passtUeber = ueber >= RAND;
    const roh = passtUnter ? unter : passtUeber ? ueber : unter;
    karte = {
      top: Math.max(RAND, Math.min(roh, fensterH - karteH - RAND)),
      left: Math.min(Math.max(RAND, rahmen.left + rahmen.width / 2 - breite / 2), fensterB - breite - RAND),
    };
  }

  /** Eine der vier Scheiben um den Scheinwerfer. */
  const scheibe = (stil: React.CSSProperties, k: string) =>
    <div key={k} className="ru-scheibe" style={stil} onClick={schliessen} aria-hidden="true" />;

  return (
    <>
      {knopf}
      {createPortal(
        <div className="ru" role="dialog" aria-modal="true" aria-label={`Rundgang ${titel}, Schritt ${i + 1} von ${schritte.length}`}>
          {/* Kein Element im Blick (Einstieg, Schluss oder Raum noch leer):
              eine Scheibe über alles. */}
          {!rahmen && scheibe({ inset: 0 }, "voll")}

          {/* Vier Scheiben rahmen das Element ein — siehe Kopfkommentar. */}
          {rahmen && [
            scheibe({ top: 0, left: 0, right: 0, height: Math.max(0, rahmen.top) }, "oben"),
            scheibe({ top: rahmen.top + rahmen.height, left: 0, right: 0, bottom: 0 }, "unten"),
            scheibe({ top: rahmen.top, left: 0, width: Math.max(0, rahmen.left), height: rahmen.height }, "links"),
            scheibe({ top: rahmen.top, left: rahmen.left + rahmen.width, right: 0, height: rahmen.height }, "rechts"),
          ]}

          {/* Der Leuchtrahmen: zeigt hin, ohne zu bedecken. */}
          {rahmen && (
            <div className="ru-fokus" aria-hidden="true"
                 style={{ top: rahmen.top, left: rahmen.left, width: rahmen.width, height: rahmen.height }} />
          )}

          <div ref={karteRef} className={`ru-karte${karte ? "" : " mitte"}`}
               style={karte ? { top: karte.top, left: karte.left, width: breite } : { width: breite }}>
            <div className="ru-kopf">
              <span className="ru-raum">{titel}</span>
              <span className="ru-zaehler">{i + 1} / {schritte.length}</span>
            </div>
            <h3>{s.titel}</h3>
            <p>{s.text}</p>
            {s.tipp && <p className="ru-tipp"><b>Aus der Praxis:</b> {s.tipp}</p>}
            <div className="ru-fortschritt" aria-hidden="true">
              {schritte.map((_, n) => <i key={n} className={n <= i ? "an" : ""} />)}
            </div>
            <div className="ru-tun">
              <button type="button" className="ru-still" onClick={schliessen}>
                {letzter ? "Schließen" : "Überspringen"}
              </button>
              <span className="ru-tun-rechts">
                {i > 0 && <button type="button" className="ru-still" onClick={() => setI(i - 1)}>Zurück</button>}
                <button type="button" className="ru-weiter"
                        onClick={() => (letzter ? schliessen() : setI(i + 1))}>
                  {letzter ? "Alles klar" : "Weiter"}
                </button>
              </span>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
