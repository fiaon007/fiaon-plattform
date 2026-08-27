// ═══════════════════════════════════════════════════════════════════════════
// DER LESE-AUFRUF — nach 1:20 im Ratgeber (27.08.2026)
//
// Justin: „Wenn man einen Ratgeber bei uns liest, dann bitte nach 1 min und
//          20 sekunden ein PopUp erscheinen lassen für die Konto eröffnung —
//          natürlich im BESTEN Design (glas, 3d, …)"
//
// ── WARUM 80 SEKUNDEN GENAU RICHTIG SIND ──────────────────────────────────
// Wer 80 Sekunden auf einem Ratgeber-Artikel bleibt, überfliegt nicht — er
// liest. Das ist der Moment, in dem ein Angebot Hilfe ist statt Werbung.
// Früher wäre es eine Unterbrechung, später hat er die Seite meist verlassen.
//
// ── DIE REGELN, DIE EIN AUFRUF EINHALTEN MUSS, UM KEIN ÄRGERNIS ZU SEIN ───
// Ein Fenster, das sich aufdrängt, kostet mehr Vertrauen, als es Anträge
// bringt — besonders auf einer Seite über Schulden. Deshalb:
//
//   · Die Uhr läuft nur, solange die Seite SICHTBAR ist. Wer den Reiter
//     wechselt, hat nicht gelesen.
//   · Wer schon Kunde ist (Kunden-Cookie), sieht ihn nie.
//   · Wer ihn wegklickt, sieht ihn 30 Tage nicht wieder — geschlossen heißt
//     geschlossen, nicht „bis zum nächsten Artikel".
//   · Escape schließt, ein Klick daneben schließt, der Fokus wird gefangen
//     und danach zurückgegeben.
//   · `prefers-reduced-motion` schaltet die Bewegung ab.
//   · Er erscheint EINMAL je Sitzung, nicht je Artikel.
//
// ── WARUM ER NICHTS VERSPRICHT ────────────────────────────────────────────
// Der Text nennt, was FIAON tut, und keinen Erfolg. Auf einer YMYL-Seite ist
// ein Aufruf mit Versprechen das Gegenteil von Vertrauen — und rechtlich
// heikel dazu.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Nach dieser Lesezeit erscheint der Aufruf — sichtbare Zeit, nicht Uhrzeit. */
const SEKUNDEN = 80;
/** So lange bleibt er weg, wenn jemand ihn geschlossen hat. */
const RUHE_TAGE = 30;
const SCHLUESSEL = "fiaon_leseaufruf_zu";
const SITZUNG = "fiaon_leseaufruf_gezeigt";

function darfErscheinen(): boolean {
  try {
    // Kunden bekommen keine Werbung für ein Konto, das sie haben.
    if (document.cookie.includes("fiaon_kunde")) return false;
    if (sessionStorage.getItem(SITZUNG)) return false;
    const zu = localStorage.getItem(SCHLUESSEL);
    if (zu && Date.now() - Number(zu) < RUHE_TAGE * 86_400_000) return false;
    return true;
  } catch {
    // Ohne Speicher (privates Fenster) lieber gar nicht als bei jedem Aufruf.
    return false;
  }
}

export default function LeseAufruf() {
  const [offen, setOffen] = useState(false);
  const [gehtZu, setGehtZu] = useState(false);
  const gelesen = useRef(0);
  const vorher = useRef<HTMLElement | null>(null);
  const kasten = useRef<HTMLDivElement | null>(null);

  // ── Die Uhr: sie läuft nur, solange gelesen wird ────────────────────────
  useEffect(() => {
    // VORSCHAU: `?aufruf=jetzt` an der Adresse zeigt ihn sofort — zum Ansehen,
    // ohne 80 Sekunden zu warten. Er merkt sich dabei NICHTS: kein Eintrag in
    // den Speicher, keine Sperre für 30 Tage. Ein normaler Besucher kommt nie
    // mit diesem Anhängsel auf die Seite; wer ihn absichtlich anhängt, hat
    // sich den Blick verdient.
    try {
      if (new URLSearchParams(window.location.search).get("aufruf") === "jetzt") {
        vorher.current = document.activeElement as HTMLElement | null;
        setOffen(true);
        return;
      }
    } catch { /* egal */ }

    if (!darfErscheinen()) return;
    let letzterTick = Date.now();
    const uhr = window.setInterval(() => {
      const jetzt = Date.now();
      // Nur zählen, wenn der Reiter vorne ist. Ein Hintergrundreiter liest nicht.
      if (document.visibilityState === "visible") gelesen.current += (jetzt - letzterTick) / 1000;
      letzterTick = jetzt;
      if (gelesen.current >= SEKUNDEN) {
        window.clearInterval(uhr);
        try { sessionStorage.setItem(SITZUNG, "1"); } catch { /* egal */ }
        vorher.current = document.activeElement as HTMLElement | null;
        setOffen(true);
      }
    }, 1000);
    return () => window.clearInterval(uhr);
  }, []);

  // ── Escape, Fokusfalle, kein Wegrollen im Hintergrund ───────────────────
  useEffect(() => {
    if (!offen) return;
    const taste = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); schliessen(); return; }
      if (e.key !== "Tab" || !kasten.current) return;
      const ziele = kasten.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
      if (!ziele.length) return;
      const erster = ziele[0], letzter = ziele[ziele.length - 1];
      if (e.shiftKey && document.activeElement === erster) { e.preventDefault(); letzter.focus(); }
      else if (!e.shiftKey && document.activeElement === letzter) { e.preventDefault(); erster.focus(); }
    };
    document.addEventListener("keydown", taste);
    const vorherigeUeberlauf = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Der Fokus wandert in den Kasten — sonst tabbt man hinter dem Fenster weiter.
    window.setTimeout(() => kasten.current?.querySelector<HTMLElement>("a,button")?.focus(), 60);
    return () => {
      document.removeEventListener("keydown", taste);
      document.body.style.overflow = vorherigeUeberlauf;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offen]);

  const schliessen = () => {
    const vorschau = (() => {
      try { return new URLSearchParams(window.location.search).get("aufruf") === "jetzt"; }
      catch { return false; }
    })();
    if (!vorschau) { try { localStorage.setItem(SCHLUESSEL, String(Date.now())); } catch { /* egal */ } }
    setGehtZu(true);
    window.setTimeout(() => { setOffen(false); setGehtZu(false); vorher.current?.focus?.(); }, 260);
  };

  if (!offen) return null;

  return createPortal(
    <div className={`la-buehne${gehtZu ? " zu" : ""}`} role="presentation"
         onClick={(e) => { if (e.target === e.currentTarget) schliessen(); }}>
      <div className="la-fenster" role="dialog" aria-modal="true"
           aria-labelledby="la-titel" aria-describedby="la-text" ref={kasten}>
        {/* Der Schein hinter dem Glas — er macht die Tiefe, nicht der Rahmen. */}
        <span className="la-schein" aria-hidden="true" />
        <span className="la-kante" aria-hidden="true" />

        <button type="button" className="la-zu" onClick={schliessen} aria-label="Schließen">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        <p className="la-augenbraue">Sie lesen gerade über Ihre Rechte</p>
        <h2 id="la-titel">Sollen wir das <span className="la-verlauf">für Sie übernehmen?</span></h2>
        <p id="la-text" className="la-text">
          Alles in diesem Ratgeber können Sie selbst tun — die Werkzeuge dafür
          sind kostenlos. Wenn Sie es lieber abgeben: FIAON beschafft Ihre
          Auskünfte bei SCHUFA, KSV und CRIF, prüft jeden Eintrag gegen die
          gesetzlichen Voraussetzungen und führt den Schriftwechsel mit Fristen.
          Sie sehen jeden Schritt in Ihrem Bereich.
        </p>

        <ul className="la-punkte">
          <li>Auskünfte aus allen drei Ländern, aus einer Hand</li>
          <li>Jeder Eintrag einzeln geprüft — auch auf Verfristung</li>
          <li>Feste Paketpreise, keine Erfolgsbeteiligung</li>
        </ul>

        <div className="la-knoepfe">
          <a className="la-knopf haupt" href="/antrag">
            Konto eröffnen
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
          <button type="button" className="la-knopf still" onClick={schliessen}>
            Weiterlesen
          </button>
        </div>

        <p className="la-fuss">
          Kein Abschluss auf dieser Seite, keine Zahlungsdaten. FIAON ist keine
          Rechtsberatung und verspricht keine Löschung berechtigter Einträge.
        </p>
      </div>
    </div>,
    document.body,
  );
}
