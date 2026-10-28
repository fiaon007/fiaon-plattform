// ═══════════════════════════════════════════════════════════════════════════
// DIE NAVIGATION DES GLOBAL-PORTALS — „Ihr US-Büro“ (22.10.2026)
//
// Justin: „Das Menü schöner, unterteilt — wie das Menü auf der Startseite,
//          nichts super Klassisches."
//
// Statt der Liste links: eine schwebende Glasleiste oben, in der Sprache des
// Kopfs von fiaon.com/business (GlobalNav, global-rahmen.css) — Themen mit
// Winkel, darunter ein ruhiges Panel mit Einträgen (Titel + ein Satz mit dem
// LIVE-Stand) und rechts einer Karte zur Gruppe. Ein Lichtschieber gleitet
// unter das aktive Thema. Am Telefon ein ganzseitiges Menü mit großen Zeilen.
//
// Bedienung: Klick, Überfahren (mit kurzer Verzögerung) oder Tastatur; Escape
// schließt und gibt den Fokus an das Thema zurück; ein Klick daneben oder Tab
// aus dem Kopf schließt ebenfalls. Die Adresse bleibt #<seite> — Zurück-Taste
// und geteilte Links funktionieren wie bisher. Bei „Bewegung reduzieren“ gleitet
// nichts. Keine Icon-Bibliothek: Ordnung durch Typografie, Ziffern, Haarlinien.
// Nichts klebt beim Scrollen (Hausregel des Portals).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import "@/styles/global-portal-nav.css";

export interface NavEintrag<K extends string> { key: K; titel: string; satz: string; zahl?: number }
export interface NavGruppe<K extends string> {
  key: string; titel: string;
  /** Ein Thema ohne Panel führt direkt auf diese Seite. */
  direkt?: K;
  eintraege: NavEintrag<K>[];
  /** Die Karte rechts im Panel: ein Satz zur Gruppe, gern mit Zahl. */
  karte?: { auge: string; titel: string; text: string; ziel?: K; knopf?: string };
}

function Winkel() {
  return <svg className="gpn-winkel" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>;
}

export default function PortalNav<K extends string>({ gruppen, seite, geh, marke, titel, person, texte, aktuellTitel }: {
  gruppen: NavGruppe<K>[]; seite: K; geh: (k: K) => void;
  marke: ReactNode; titel: string; aktuellTitel: string;
  person: { name: string; rolle: string; bild?: string | null; onKlick: () => void } | null;
  texte: { navTitel: string; menue: string; schliessen: string; sicher: string; schreiben: string };
}) {
  const [offen, setOffen] = useState<string | null>(null);
  const [mobil, setMobil] = useState(false);
  const kopf = useRef<HTMLElement>(null);
  const themen = useRef<HTMLDivElement>(null);
  const menueKnopf = useRef<HTMLButtonElement>(null);
  const mobilRef = useRef<HTMLDivElement>(null);
  const uhr = useRef<number | null>(null);
  const [schieber, setSchieber] = useState<{ x: number; b: number } | null>(null);
  const aktiv = gruppen.find((g) => g.direkt === seite || g.eintraege.some((e) => e.key === seite))?.key ?? null;

  // Der Lichtschieber unter dem aktiven Thema — gemessen, nicht geraten (Schrift lädt nach, Fenster ändert sich).
  useLayoutEffect(() => {
    const messen = () => {
      const el = themen.current?.querySelector<HTMLElement>(`[data-gruppe="${aktiv}"]`);
      setSchieber(el ? { x: el.offsetLeft, b: el.offsetWidth } : null);
    };
    messen();
    window.addEventListener("resize", messen);
    const f = (document as any).fonts;
    f?.ready?.then?.(messen).catch?.(() => {});
    // Die Breite eines Themas ändert sich mit der Schrift und mit Zahlen-Marken — ein Beobachter misst nach.
    const ro = typeof ResizeObserver !== "undefined" && themen.current ? new ResizeObserver(messen) : null;
    if (ro && themen.current) Array.from(themen.current.children).forEach((c) => ro.observe(c));
    return () => { window.removeEventListener("resize", messen); ro?.disconnect(); };
  }, [aktiv, gruppen.length]);

  // Escape, Klick daneben, Fokus verlässt den Kopf → Panel zu. Escape aus dem Panel gibt den Fokus ans Thema zurück.
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (mobil) { setMobil(false); menueKnopf.current?.focus(); return; }
      if (offen) {
        kopf.current?.querySelector<HTMLElement>(`[data-gruppe="${offen}"]`)?.focus();
        setOffen(null);
      }
    };
    const klick = (e: MouseEvent) => { if (kopf.current && !kopf.current.contains(e.target as Node)) setOffen(null); };
    const k = kopf.current;
    const raus = (e: FocusEvent) => { const n = e.relatedTarget as Node | null; if (k && n && !k.contains(n)) setOffen(null); };
    window.addEventListener("keydown", taste);
    document.addEventListener("mousedown", klick);
    k?.addEventListener("focusout", raus);
    return () => { window.removeEventListener("keydown", taste); document.removeEventListener("mousedown", klick); k?.removeEventListener("focusout", raus); };
  }, [offen, mobil]);

  // Das ganzseitige Menü: Seite dahinter steht still, der Fokus geht hinein und kommt beim Schließen zurück.
  useEffect(() => {
    if (!mobil) return;
    const vorher = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => mobilRef.current?.querySelector<HTMLElement>("[aria-current='page'], a, button")?.focus(), 30);
    const fang = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !mobilRef.current) return;
      const z = Array.from(mobilRef.current.querySelectorAll<HTMLElement>("a, button"));
      if (!z.length) return;
      const erst = z[0], letzt = z[z.length - 1];
      if (e.shiftKey && document.activeElement === erst) { e.preventDefault(); letzt.focus(); }
      else if (!e.shiftKey && document.activeElement === letzt) { e.preventDefault(); erst.focus(); }
    };
    window.addEventListener("keydown", fang);
    return () => { document.body.style.overflow = vorher; window.clearTimeout(t); window.removeEventListener("keydown", fang); };
  }, [mobil]);
  useEffect(() => () => { if (uhr.current) window.clearTimeout(uhr.current); }, []);

  const auf = (g: string) => { if (uhr.current) window.clearTimeout(uhr.current); setOffen(g); };
  const spaeterZu = () => { if (uhr.current) window.clearTimeout(uhr.current); uhr.current = window.setTimeout(() => setOffen(null), 180); };
  const waehle = (k: K) => { setOffen(null); setMobil(false); geh(k); };
  // Nur echte Mäuse öffnen beim Überfahren — ein Finger tippt, und das Tippen schaltet um.
  const maus = (e: React.PointerEvent) => e.pointerType === "mouse";
  const offeneGruppe = gruppen.find((g) => g.key === offen && !g.direkt);
  const zahlGruppe = (g: NavGruppe<K>) => g.eintraege.reduce((s, e) => s + (e.zahl ?? 0), 0);

  return (
    <>
      <header ref={kopf} className={`gpn${offen ? " gpn-offen" : ""}`} onPointerLeave={(e) => { if (maus(e)) spaeterZu(); }}>
        <div className="gpn-leiste">
          <div className="gpn-links">
            {marke}
            <span className="gpn-trenner" aria-hidden="true" />
            <span className="gpn-titel">{titel}</span>
          </div>

          <nav className="gpn-themen" aria-label={texte.navTitel}>
            <div className="gpn-themen-innen" ref={themen}>
              {schieber && <span className="gpn-schieber" aria-hidden="true" style={{ transform: `translateX(${schieber.x}px)`, width: schieber.b }} />}
              {gruppen.map((g) => {
                const zahl = zahlGruppe(g);
                if (g.direkt) {
                  return (
                    <a key={g.key} href={`#${g.direkt}`} data-gruppe={g.key} className={`gpn-thema${aktiv === g.key ? " an" : ""}`}
                      aria-current={seite === g.direkt ? "page" : undefined}
                      onClick={(e) => { e.preventDefault(); waehle(g.direkt!); }} onFocus={() => setOffen(null)}>
                      {g.titel}{zahl > 0 && <i className="gpn-zahl">{zahl}</i>}
                    </a>
                  );
                }
                return (
                  <button key={g.key} type="button" data-gruppe={g.key} className={`gpn-thema${aktiv === g.key ? " an" : ""}`}
                    aria-expanded={offen === g.key} aria-controls={`gpn-panel-${g.key}`}
                    onPointerEnter={(e) => { if (maus(e)) auf(g.key); }}
                    onClick={() => setOffen(offen === g.key ? null : g.key)}
                    onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); auf(g.key); window.setTimeout(() => kopf.current?.querySelector<HTMLElement>(`#gpn-panel-${g.key} a`)?.focus(), 20); } }}>
                    {g.titel}{zahl > 0 && <i className="gpn-zahl">{zahl}</i>}<Winkel />
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="gpn-rechts">
            {person && (
              <button type="button" className="gpn-person" onClick={person.onKlick} title={texte.schreiben}>
                {person.bild ? <img src={person.bild} alt="" /> : <span aria-hidden="true">{person.name.slice(0, 1)}</span>}
                <b>{person.name}</b>
              </button>
            )}
            <button ref={menueKnopf} type="button" className="gpn-menue" aria-expanded={mobil} aria-controls="gpn-mobil" onClick={() => setMobil(true)}>
              <span className="gpn-menue-text"><small>{aktuellTitel}</small>{texte.menue}</span>
              <span className="gpn-menue-striche" aria-hidden="true"><i /><i /></span>
            </button>
          </div>
        </div>

        {/* ── Das Panel am Rechner ── */}
        {gruppen.filter((g) => !g.direkt).map((g) => (
          <div key={g.key} id={`gpn-panel-${g.key}`} className="gpn-panel" hidden={offeneGruppe?.key !== g.key} onPointerEnter={(e) => { if (maus(e)) auf(g.key); }}>
            <div className="gpn-panel-innen">
              <div className="gpn-panel-liste">
                <p className="gpn-panel-titel">{g.titel}</p>
                <ul>
                  {g.eintraege.map((e, i) => (
                    <li key={e.key} style={{ ["--i" as any]: i }}>
                      <a href={`#${e.key}`} aria-current={seite === e.key ? "page" : undefined} onClick={(ev) => { ev.preventDefault(); waehle(e.key); }}>
                        <span className="gpn-eintrag"><b>{e.titel}{(e.zahl ?? 0) > 0 && <i className="gpn-zahl">{e.zahl}</i>}</b><span>{e.satz}</span></span>
                        <span className="gpn-pfeil" aria-hidden="true">→</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              {g.karte && (
                <div className="gpn-karte">
                  <span className="gpn-karte-auge">{g.karte.auge}</span>
                  <p className="gpn-karte-titel">{g.karte.titel}</p>
                  <p className="gpn-karte-text">{g.karte.text}</p>
                  {g.karte.ziel && g.karte.knopf && <a href={`#${g.karte.ziel}`} className="gpn-karte-link" onClick={(ev) => { ev.preventDefault(); waehle(g.karte!.ziel!); }}>{g.karte.knopf} →</a>}
                </div>
              )}
            </div>
          </div>
        ))}
      </header>

      {/* ── Das ganzseitige Menü am Telefon (neben dem Kopf: backdrop-filter macht ihn sonst zum Bezugsrahmen) ── */}
      {mobil && (
        <div id="gpn-mobil" ref={mobilRef} className="gpn-mobil" role="dialog" aria-modal="true" aria-label={texte.navTitel}>
          <div className="gpn-mobil-kopf">
            {/* Die Marke führt zur Übersicht — im Menü schließt der Klick es zugleich. */}
            <span onClickCapture={() => setMobil(false)}>{marke}</span>
            <button type="button" className="gpn-mobil-zu" onClick={() => { setMobil(false); menueKnopf.current?.focus(); }}>{texte.schliessen}<span aria-hidden="true" className="gpn-kreuz" /></button>
          </div>
          <div className="gpn-mobil-rumpf">
            {gruppen.map((g, gi) => (
              <section key={g.key} className="gpn-mobil-gruppe" style={{ ["--i" as any]: gi }}>
                {!g.direkt && <p className="gpn-mobil-titel">{g.titel}</p>}
                <ul>
                  {(g.direkt ? [{ key: g.direkt, titel: g.titel, satz: g.eintraege[0]?.satz ?? "", zahl: zahlGruppe(g) }] : g.eintraege).map((e) => (
                    <li key={e.key}>
                      <a href={`#${e.key}`} aria-current={seite === e.key ? "page" : undefined} onClick={(ev) => { ev.preventDefault(); waehle(e.key); }}>
                        <b>{e.titel}{(e.zahl ?? 0) > 0 && <i className="gpn-zahl">{e.zahl}</i>}</b>
                        {e.satz && <span>{e.satz}</span>}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          {person && (
            <div className="gpn-mobil-fuss">
              <div className="gpn-mobil-person">
                {person.bild ? <img src={person.bild} alt="" /> : <span aria-hidden="true">{person.name.slice(0, 1)}</span>}
                <div><small>{person.rolle}</small><b>{person.name}</b></div>
              </div>
              <button type="button" className="gpn-mobil-knopf" onClick={() => { setMobil(false); person.onKlick(); }}>{texte.schreiben}</button>
              <p className="gpn-mobil-sicher">{texte.sicher}</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
