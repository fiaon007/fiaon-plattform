// ═══════════════════════════════════════════════════════════════════════════
// VERTRAG LESEN (E-301, Justin 07.10.2026: „Man kann im Vertragstext nicht
// scrollen, und die Darstellung muss viel besser werden.“)
//
// Auf der Seite: ein „Dokument“ in Papier-Optik mit dem Inhaltsverzeichnis der
// Ziffern (seite.vertrag.inhalt) und daneben die PDF-Knöpfe. Ein Klick auf
// „Vertrag lesen“ oder eine Ziffer öffnet den Vollbild-Leser an dieser Stelle.
//
// Der Leser ist ein Dialog über der ganzen Seite: Er ist der EINZIGE
// Scrollbereich (die Seite dahinter steht still — html.gaf-leser-an), also
// keine verschachtelte Scrollfalle. Oben eine ruhige Leiste mit Inhalt,
// PDF und Schließen; links (am Rechner) das Inhaltsverzeichnis, das beim Lesen
// mitläuft; rechts das Papier: Ziffern in Newsreader, Absätze Inter 16 px,
// höchstens 68 Zeichen pro Zeile, Absatznummern hängend im Rand.
// Der Text ist sicht.html — derselbe Rumpf wie im PDF (eine Textquelle); der
// Leser legt nur seine Gestaltung darüber (CSS unter .gaf-leser).
// Escape schließt, der Fokus bleibt im Dialog und kehrt danach zurück.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef, useState } from "react";
import type { FirmaSeite } from "@shared/fiaon-global-angebot-firma-typen";
import { Auf, Zeichen } from "./gemeinsam";

const WORTE = {
  lesen: "Vertrag lesen", inhalt: "Inhalt", schliessen: "Schließen", pdf: "PDF", pdfOeffnen: "PDF öffnen", ziffer: "Ziffer",
  dokumente: "Zum Herunterladen", leserTitel: "Vertrag und Anlagen", inhaltZu: "Inhalt schließen",
};

type Pdf = { titel: string; href: string };

export default function VertragsLeser({ v, html, pdfs }: { v: FirmaSeite["vertrag"]; html: string; pdfs: Pdf[] }) {
  const [offen, setOffen] = useState(false);
  const [ziel, setZiel] = useState<string | null>(null);
  const [aktiv, setAktiv] = useState<string>("praeambel");
  const [inhaltAuf, setInhaltAuf] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const papier = useRef<HTMLDivElement>(null);
  const zu = useRef<HTMLButtonElement>(null);
  const ausloeser = useRef<HTMLElement | null>(null);

  const oeffnen = (anker: string | null) => (e: React.MouseEvent<HTMLElement>) => {
    ausloeser.current = e.currentTarget;
    setZiel(anker);
    setOffen(true);
  };
  const schliessen = useCallback(() => { setOffen(false); setInhaltAuf(false); }, []);

  /** Das Element einer Ziffer im Papier — die erste Fundstelle ist der Vertrag (Anlage 1 zählt ihre Ziffern noch einmal). */
  const element = useCallback((anker: string): HTMLElement | null => papier.current?.querySelector<HTMLElement>(`[id="${anker}"]`) ?? null, []);
  const springen = useCallback((anker: string) => {
    const el = element(anker); const d = dialog.current;
    if (!el || !d) return;
    d.scrollTo({ top: el.getBoundingClientRect().top - d.getBoundingClientRect().top + d.scrollTop - 92, behavior: "auto" });
    setAktiv(anker); setInhaltAuf(false);
  }, [element]);

  // Öffnen: Seite still, Fokus auf Schließen, an die gewählte Stelle springen.
  useEffect(() => {
    if (!offen) return;
    document.documentElement.classList.add("gaf-leser-an");
    zu.current?.focus({ preventScroll: true });
    const t = window.setTimeout(() => { if (ziel) springen(ziel); else dialog.current?.scrollTo({ top: 0 }); }, 0);
    return () => {
      window.clearTimeout(t);
      document.documentElement.classList.remove("gaf-leser-an");
      ausloeser.current?.focus({ preventScroll: true });
    };
  }, [offen, ziel, springen]);

  // Escape schließt, Tab bleibt im Dialog.
  useEffect(() => {
    if (!offen) return;
    const taste = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); schliessen(); return; }
      if (e.key !== "Tab" || !dialog.current) return;
      const f = Array.from(dialog.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const erst = f[0], letzt = f[f.length - 1];
      if (e.shiftKey && document.activeElement === erst) { e.preventDefault(); letzt.focus(); }
      else if (!e.shiftKey && document.activeElement === letzt) { e.preventDefault(); erst.focus(); }
    };
    document.addEventListener("keydown", taste);
    return () => document.removeEventListener("keydown", taste);
  }, [offen, schliessen]);

  // Beim Lesen läuft das Inhaltsverzeichnis mit: aktiv ist die letzte Ziffer, deren Kopf oben vorbei ist.
  useEffect(() => {
    if (!offen) return;
    const d = dialog.current; if (!d) return;
    let raf = 0;
    const pruefen = () => {
      raf = 0;
      const oben = d.getBoundingClientRect().top + 120;
      let jetzt = v.inhalt[0]?.anker ?? "praeambel";
      for (const z of v.inhalt) { const el = element(z.anker); if (el && el.getBoundingClientRect().top <= oben) jetzt = z.anker; }
      setAktiv(jetzt);
    };
    const anstoss = () => { if (!raf) raf = requestAnimationFrame(pruefen); };
    d.addEventListener("scroll", anstoss, { passive: true });
    return () => { d.removeEventListener("scroll", anstoss); if (raf) cancelAnimationFrame(raf); };
  }, [offen, v.inhalt, element]);

  const verzeichnis = (klein: boolean) => (
    <ol className={`gaf-leser-inhalt${klein ? " klein" : ""}`}>
      {v.inhalt.map((z) => (
        <li key={z.anker}>
          <a href={`#${z.anker}`} aria-current={aktiv === z.anker ? "true" : undefined} onClick={(e) => { e.preventDefault(); springen(z.anker); }}>
            <span className="marke">{z.marke}</span><span className="titel">{z.titel}</span>
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <>
      <div className="gaf-vertrag-raster" data-fiaon="firma-vertrag">
        <Auf className="gaf-dokument">
          <div className="gaf-dokument-blatt">
            <p className="gaf-dokument-auge">FIAON LTD · London</p>
            <h3 className="gaf-dokument-titel">{v.dokument}</h3>
            <p className="gaf-dokument-unter">{v.unterzeile}</p>
            <ol className="gaf-dokument-inhalt">
              {v.inhalt.map((z) => (
                <li key={z.anker}>
                  <button type="button" onClick={oeffnen(z.anker)}>
                    <span className="marke">{z.marke}</span><span className="titel">{z.titel}</span>
                  </button>
                </li>
              ))}
            </ol>
            <button type="button" className="gaf-dokument-lesen" onClick={oeffnen(null)} aria-haspopup="dialog">
              <span>{WORTE.lesen}</span><Zeichen art="pfeil" groesse={18} />
            </button>
          </div>
        </Auf>
        <Auf className="gaf-dokumente-spalte" verz={120}>
          <p className="gaf-auge">{WORTE.dokumente}</p>
          <ul className="gaf-dokumente">
            {pdfs.map((d) => (
              <li key={d.titel}>
                <a href={d.href} target="_blank" rel="noreferrer">
                  <span className="gaf-dok-zeichen"><Zeichen art="dokument" groesse={20} /></span>
                  <span className="gaf-dok-titel">{d.titel}</span>
                  <span className="gaf-dok-aktion">{WORTE.pdfOeffnen}<Zeichen art="pfeil" groesse={14} /></span>
                </a>
              </li>
            ))}
          </ul>
        </Auf>
      </div>

      {offen && (
        <div className="gaf-leser" ref={dialog} role="dialog" aria-modal="true" aria-label={WORTE.leserTitel} data-fiaon="firma-leser">
          <div className="gaf-leser-leiste">
            <button type="button" className="gaf-leser-knopf gaf-leser-inhalt-knopf" aria-expanded={inhaltAuf} onClick={() => setInhaltAuf((x) => !x)}>
              <span className="gaf-leser-striche" aria-hidden="true" /><span>{WORTE.inhalt}</span>
            </button>
            <p className="gaf-leser-titel">{v.dokument}</p>
            <a className="gaf-leser-knopf gaf-leser-pdf" href={pdfs[0]?.href} target="_blank" rel="noreferrer"><Zeichen art="dokument" groesse={16} /><span>{WORTE.pdf}</span></a>
            <button type="button" ref={zu} className="gaf-leser-knopf gaf-leser-zu" onClick={schliessen} aria-label={WORTE.schliessen}>
              <Zeichen art="kreuz" groesse={18} /><span className="gaf-leser-zu-text">{WORTE.schliessen}</span>
            </button>
          </div>
          {inhaltAuf && <div className="gaf-leser-klapp">{verzeichnis(true)}</div>}
          <div className="gaf-leser-buehne">
            <nav className="gaf-leser-seite" aria-label={WORTE.inhalt}>{verzeichnis(false)}</nav>
            <article className="gaf-leser-papier" ref={papier}>
              <p className="gaf-leser-auge">FIAON LTD · London</p>
              {/* Der Text kommt von unserem Server aus derselben Quelle wie das PDF. */}
              <div className="gaf-leser-text" dangerouslySetInnerHTML={{ __html: html }} />
            </article>
          </div>
        </div>
      )}
    </>
  );
}
