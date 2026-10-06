// ═══════════════════════════════════════════════════════════════════════════
// DIE GROSSE ANSICHT EINES BEITRAGS (E-296, 06.10.2026)
//
// Jede Kachel und Karte öffnet diesen Dialog (die Beiträge stehen alle auch auf
// Instagram — der Link dorthin steht unten im Text). Folien
// wischen (Scroll-Snap), Pfeiltasten und Knöpfe blättern, Escape schließt,
// der Fokus bleibt im Dialog und kehrt danach zum Auslöser zurück. Erst hier
// lädt das große Bild. KI-Inhalte tragen den Hinweis sichtbar (Art. 50 KI-VO).
//
// Der Dialog hängt per Portal an <body>: Die Abschnitte der Bühne tragen
// transform (Einblenden), darin wäre position:fixed an den Abschnitt gebunden.
// Kein backdrop-filter (iPhone), nur ein deckender Schleier.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SozialFeedPost } from "@shared/fiaon-sozial-feed";
import type { SozialWoerter } from "@/i18n/sozial";
import { anzeigeText, bildMasse, sozialDatum } from "./sozial-daten";
import { KanalZeichen, NachAussenZeichen, PfeilZeichen, Profilbild, ReelZeichen, SchliessenZeichen } from "./SozialZeichen";
import { SozialBild } from "./SozialBild";

export type SozialAussehen = "dunkel" | "kanzlei" | "hell";

const FOKUSSIERBAR = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Bildschirm sperren: auf der dunklen Bühne scrollt #root, auf /business das Dokument. */
function sperren(): () => void {
  const root = document.getElementById("root");
  const vorher = { body: document.body.style.overflow, root: root?.style.overflow ?? "" };
  document.body.style.overflow = "hidden";
  if (root) root.style.overflow = "hidden";
  return () => { document.body.style.overflow = vorher.body; if (root) root.style.overflow = vorher.root; };
}

export function SozialAnsicht({ post, w, aussehen, onSchliessen }: { post: SozialFeedPost; w: SozialWoerter; aussehen: SozialAussehen; onSchliessen: () => void }) {
  const kasten = useRef<HTMLDivElement>(null);
  const spur = useRef<HTMLDivElement>(null);
  const zu = useRef<HTMLButtonElement>(null);
  const titelId = useId();
  const [folie, setFolie] = useState(0);
  const [weg, setWeg] = useState(false);
  const n = post.bilder.length;
  const istReel = post.format === "reel";
  const erstes = post.bilder[0].gross;
  // Ein Rahmen für alle Folien: das Format des ersten Bildes, zwischen 9:16 und 1:1 (Reel-Titelbild steht hoch).
  const { width: bw, height: bh } = bildMasse(erstes, 1080, istReel ? 1920 : 1350);
  const verhaeltnis = Math.min(1, Math.max(9 / 16, bw / bh));

  const schliessen = useCallback(() => {
    const ruhig = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (ruhig) { onSchliessen(); return; }
    setWeg(true);
    window.setTimeout(onSchliessen, 180);
  }, [onSchliessen]);

  const zuFolie = useCallback((i: number) => {
    const s = spur.current; if (!s) return;
    const ziel = Math.max(0, Math.min(n - 1, i));
    const ruhig = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    s.scrollTo({ left: ziel * s.clientWidth, behavior: ruhig ? "auto" : "smooth" });
  }, [n]);

  // Öffnen: Fokus in den Dialog, Seite sperren; Schließen: Fokus zurück zum Auslöser.
  useEffect(() => {
    const ausloeser = document.activeElement as HTMLElement | null;
    const frei = sperren();
    const t = window.setTimeout(() => zu.current?.focus({ preventScroll: true }), 30);
    return () => { window.clearTimeout(t); frei(); ausloeser?.focus?.({ preventScroll: true }); };
  }, []);

  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); schliessen(); return; }
      if (e.key === "ArrowRight") { e.preventDefault(); zuFolie(folie + 1); return; }
      if (e.key === "ArrowLeft") { e.preventDefault(); zuFolie(folie - 1); return; }
      if (e.key !== "Tab" || !kasten.current) return;
      const ziele = Array.from(kasten.current.querySelectorAll<HTMLElement>(FOKUSSIERBAR)).filter((x) => x.offsetParent !== null || x === document.activeElement);
      if (!ziele.length) return;
      const erster = ziele[0], letzter = ziele[ziele.length - 1];
      if (e.shiftKey && (document.activeElement === erster || !kasten.current.contains(document.activeElement))) { e.preventDefault(); letzter.focus(); }
      else if (!e.shiftKey && (document.activeElement === letzter || !kasten.current.contains(document.activeElement))) { e.preventDefault(); erster.focus(); }
    };
    document.addEventListener("keydown", taste);
    return () => document.removeEventListener("keydown", taste);
  }, [folie, schliessen, zuFolie]);

  // Welche Folie steht in der Mitte? (Wischen, Knöpfe, Tasten — eine Quelle: die Scrollposition.)
  useEffect(() => {
    const s = spur.current; if (!s || n < 2) return;
    let raf = 0;
    const lesen = () => { raf = 0; setFolie(Math.max(0, Math.min(n - 1, Math.round(s.scrollLeft / Math.max(1, s.clientWidth))))); };
    const beim = () => { if (!raf) raf = requestAnimationFrame(lesen); };
    s.addEventListener("scroll", beim, { passive: true });
    return () => { s.removeEventListener("scroll", beim); if (raf) cancelAnimationFrame(raf); };
  }, [n]);

  const datum = sozialDatum(post.datum, w.locale);
  // Die Beiträge sind deutsch — auf den englischen Seiten tragen Text, Titel und Alt-Texte lang="de" (WCAG 3.1.2).
  const lang = w.inhaltLang || undefined;
  const amAnfang = folie === 0, amEnde = folie === n - 1;
  // Der Alt-Text aus dem Studio beschreibt alle Folien zusammen — er gehört an die erste; die übrigen nennen Titel und Folie.
  const alt = (i: number) => (i === 0 && post.alt ? post.alt : `${post.titel}${n > 1 ? ` – ${w.folieVon(i + 1, n)}` : ""}`);

  return createPortal(
    <div className={`sz-ansicht sz-${aussehen}-ansicht${weg ? " weg" : ""}`} role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) schliessen(); }}>
      <div ref={kasten} className="sz-ansicht-kasten" role="dialog" aria-modal="true" aria-labelledby={titelId} style={{ ["--sz-verh" as string]: String(verhaeltnis) }}>
        <div className="sz-ansicht-bild">
          {/* Mehrere Folien: eine benannte Gruppe mit Rollenbeschreibung „Karussell“ (ARIA 1.2: aria-roledescription
              und aria-label nur an einem Element mit Rolle). Fokussierbar, damit sich die Folien per Tastatur wischen lassen. */}
          <div ref={spur} className="sz-folien" tabIndex={n > 1 ? 0 : undefined} role={n > 1 ? "group" : undefined}
               aria-roledescription={n > 1 ? w.karussell : undefined} aria-label={n > 1 ? w.folieVon(folie + 1, n) : undefined}>
            {post.bilder.map((b, i) => {
              const m = bildMasse(b.gross, bw, bh);
              return (
                <figure key={b.gross.url + i} className="sz-folie" aria-hidden={n > 1 && i !== folie ? true : undefined}>
                  <SozialBild src={b.gross.url} alt={alt(i)} lang={lang} width={m.width} height={m.height} laden={i === 0 ? "eager" : "lazy"} />
                </figure>
              );
            })}
          </div>
          {/* Kein großes Abspiel-Zeichen: Videos laufen auf der Website nicht — ein Knopf, der nichts tut, wäre eine Falle. */}
          {istReel && <span className="sz-reel-marke"><ReelZeichen groesse={14} />{w.reel}</span>}
          {post.ki && <span className="sz-ki gross">{w.kiHinweis}</span>}
          {n > 1 && (
            <>
              {/* aria-disabled statt disabled (Prüfung 06.10.2026): Ein deaktivierter Knopf verliert den Fokus — der fiele
                  aus dem Dialog auf <body>. So bleibt er am Knopf, der Klick tut am Ende einfach nichts. */}
              <button type="button" className="sz-folie-knopf links" onClick={() => { if (!amAnfang) zuFolie(folie - 1); }} aria-disabled={amAnfang || undefined} aria-label={w.folieZurueck}><PfeilZeichen richtung="links" groesse={18} /></button>
              <button type="button" className="sz-folie-knopf rechts" onClick={() => { if (!amEnde) zuFolie(folie + 1); }} aria-disabled={amEnde || undefined} aria-label={w.folieWeiter}><PfeilZeichen groesse={18} /></button>
              <div className="sz-punkte" aria-hidden="true">{post.bilder.map((_, i) => <i key={i} className={i === folie ? "an" : undefined} />)}</div>
            </>
          )}
        </div>
        <div className="sz-ansicht-text">
          <div className="sz-ansicht-kopf">
            <Profilbild groesse={36} ring={false} />
            <div><b>fiaon.ltd</b>{datum && <small>{datum}</small>}</div>
            <button ref={zu} type="button" className="sz-ansicht-zu" onClick={schliessen} aria-label={w.schliessen}><SchliessenZeichen /></button>
          </div>
          {/* Der Titel ist der Arbeitsname aus dem Studio und steht meist wörtlich am Anfang der Caption — er benennt den
              Dialog für Screenreader, sichtbar ist die Caption. */}
          <h2 id={titelId} className="sz-unsichtbar" lang={lang}>{anzeigeText(post.titel)}</h2>
          {post.text && <p className="sz-ansicht-caption" lang={lang}>{anzeigeText(post.text)}</p>}
          {post.hashtags.length > 0 && <p className="sz-ansicht-tags" lang={lang}>{post.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}</p>}
          {istReel && <p className="sz-ansicht-hinweis">{w.reelHinweis}</p>}
          {post.ki && <p className="sz-ansicht-ki"><span className="sz-ki">{w.kiHinweis}</span></p>}
          {n > 1 && <p className="sz-ansicht-zaehler zahl" aria-live="polite">{w.folieVon(folie + 1, n)}</p>}
          {(post.links.instagram || post.links.facebook) && (
            <div className="sz-ansicht-links">
              {post.links.instagram && <a href={post.links.instagram} target="_blank" rel="noopener noreferrer" className="sz-link-knopf"><KanalZeichen kanal="instagram" groesse={16} />{w.aufInstagram}<NachAussenZeichen /></a>}
              {post.links.facebook && <a href={post.links.facebook} target="_blank" rel="noopener noreferrer" className="sz-link-knopf still"><KanalZeichen kanal="facebook" groesse={16} />{w.aufFacebook}<NachAussenZeichen /></a>}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
