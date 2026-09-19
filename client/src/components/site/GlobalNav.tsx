// ═══════════════════════════════════════════════════════════════════════════
// DER KOPF DER BUSINESS-WELT — FIAON GLOBAL (19.09.2026)
//
// Justin: „Wenn man auf /business ist, muss alles für die Business-Kunden
// ausgelegt sein … wenn man aufs Logo klickt, die Startseite von Business."
//
// Was hier NICHT steht, mit Absicht: „Konto eröffnen", „Login", Bonität,
// Ratgeber zu Einträgen, Karriere-Hinweis — alles, was zur Privatkunden-Linie
// gehört. Ein Geschäftskunde sieht nur FIAON Global: vier Themen (aus
// shared/fiaon-global-menue.ts, derselben Liste wie Seiten und Sitemap), „Mein
// Auftrag" für laufende Aufträge und die zwei Handlungen des Hauses — ein
// Gespräch vereinbaren oder direkt beauftragen.
//
// Am Rechner öffnen die Themen ein ruhiges Panel (Überfahren, Klick oder
// Tastatur; Escape schließt). Am Telefon ein eigenes Menü mit aufklappbaren
// Gruppen und den zwei Handlungen am Fuß. Englisch gibt es nur die Übersicht —
// dort springen die Punkte zu den Abschnitten der Seite.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import { useSprache } from "@/i18n/sprache";
import { globalMenue, type MenueGruppe } from "@shared/fiaon-global-menue";
import { GLOBAL_PAKETE, globalPreisText } from "@shared/fiaon-global";
import { globalStartPfad } from "@shared/fiaon-global-wege";
import { FIAON_FIRMA } from "@shared/fiaon-firma";
import "@/styles/global-rahmen.css";

const PROMO: Record<MenueGruppe, { titel: string; text: string; href: string; knopf: string }> = {
  leistungen: { titel: "Ein Vertrag. Ein Festpreis.", text: "Gesellschaft, Steuernummern, Konto- und Kartenanträge, Partner-Honorare — alles im Paket.", href: "/business#pakete", knopf: "Pakete vergleichen" },
  fuerwen: { titel: "Auch ohne eigene Firma", text: "Gründer und Unternehmer, die privat buchen, beauftragen direkt — Vertrag auf den eigenen Namen.", href: "/business/privatpersonen", knopf: "Als Privatperson beauftragen" },
  preise: { titel: "", text: "", href: "", knopf: "" },
  wissen: { titel: "Welches Paket passt?", text: "Vier Fragen zu Vorhaben, Kapitalrahmen und Begleitung — das Ergebnis mit Begründung.", href: "/business/paket-finder", knopf: "Zum Paket-Finder" },
};

const EN_PUNKTE = [
  { href: "/en/business#leistungen", titel: "Services" },
  { href: "/en/business#pakete", titel: "Packages" },
  { href: "/en/business#ablauf", titel: "How it works" },
  { href: "/en/business#fragen", titel: "FAQ" },
];

function Pfeil({ groesse = 13 }: { groesse?: number }) {
  return <svg width={groesse} height={groesse} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}
function Winkel() {
  return <svg className="gk-winkel" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>;
}

/** Die Marke: FIAON + Global. Führt immer zur Startseite von Business. */
export function GlobalMarke({ en = false, hell = false }: { en?: boolean; hell?: boolean }) {
  return (
    <a href={en ? "/en/business" : "/business"} className={`gk-marke${hell ? " hell" : ""}`} aria-label={en ? "FIAON Global — home" : "FIAON Global — Startseite"}>
      <b>FIAON</b><i>Global</i>
    </a>
  );
}

export default function GlobalNav() {
  const sprache = useSprache();
  const en = sprache === "en";
  const pfad = typeof window !== "undefined" ? window.location.pathname : "/business";
  const [offen, setOffen] = useState<MenueGruppe | null>(null);
  const [mobil, setMobil] = useState(false);
  const [mobilGruppe, setMobilGruppe] = useState<MenueGruppe | null>(null);
  const [gescrollt, setGescrollt] = useState(false);
  const uhr = useRef<number | null>(null);
  const kopf = useRef<HTMLElement>(null);

  // Business-Seiten scrollen im Dokument, gemeinsame Seiten (Impressum mit ?bereich=business) noch in #root.
  useEffect(() => {
    const root = document.getElementById("root");
    const fn = () => setGescrollt(Math.max(window.scrollY, root?.scrollTop ?? 0) > 8);
    fn();
    window.addEventListener("scroll", fn, { passive: true });
    root?.addEventListener("scroll", fn, { passive: true });
    return () => { window.removeEventListener("scroll", fn); root?.removeEventListener("scroll", fn); };
  }, []);
  // Escape schließt Panel und Handy-Menü; ein Klick daneben schließt das Panel.
  useEffect(() => {
    const taste = (e: KeyboardEvent) => { if (e.key === "Escape") { setOffen(null); setMobil(false); } };
    const klick = (e: MouseEvent) => { if (kopf.current && !kopf.current.contains(e.target as Node)) setOffen(null); };
    window.addEventListener("keydown", taste);
    document.addEventListener("mousedown", klick);
    return () => { window.removeEventListener("keydown", taste); document.removeEventListener("mousedown", klick); };
  }, []);
  // Das Handy-Menü sperrt das Scrollen der Seite dahinter.
  useEffect(() => {
    if (!mobil) return;
    const vorher = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = vorher; };
  }, [mobil]);

  const auf = (g: MenueGruppe) => { if (uhr.current) window.clearTimeout(uhr.current); setOffen(g); };
  const zuSpaeter = () => { if (uhr.current) window.clearTimeout(uhr.current); uhr.current = window.setTimeout(() => setOffen(null), 160); };

  // Auf dem Auftrag selbst braucht es keinen zweiten Knopf „Beauftragen".
  const imAuftrag = /^\/(en\/)?business\/(start|auftrag)(\/|$)/.test(pfad);
  const startHref = globalStartPfad(undefined, en ? "en" : "de");
  const gespraechHref = en ? "/en/business#gespraech" : "/business#gespraech";
  const auftragHref = en ? "/en/business/auftrag" : "/business/auftrag";
  // Auf der Übersicht selbst gleitet „Gespräch vereinbaren" zum Kalender statt neu zu laden.
  const zumGespraech = (e: React.MouseEvent) => {
    const ziel = document.getElementById("gespraech");
    if (!ziel) return;
    e.preventDefault(); setMobil(false); setOffen(null);
    ziel.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  const menue = globalMenue();

  return (
    <>
    <header ref={kopf} className={`gk${gescrollt || offen ? " gk-fest" : ""}`} onMouseLeave={zuSpaeter}>
      <div className="gk-leiste">
        <GlobalMarke en={en} />

        {en ? (
          <nav className="gk-themen" aria-label="FIAON Global">
            {EN_PUNKTE.map((p) => <a key={p.href} href={p.href} className="gk-thema">{p.titel}</a>)}
          </nav>
        ) : (
          <nav className="gk-themen" aria-label="FIAON Global">
            {menue.map((g) => (
              <button key={g.gruppe} type="button" className="gk-thema" aria-expanded={offen === g.gruppe} aria-controls={`gk-panel-${g.gruppe}`}
                      data-an={g.eintraege.some((e) => e.pfad === pfad) ? "1" : undefined}
                      onMouseEnter={() => auf(g.gruppe)} onFocus={() => auf(g.gruppe)}
                      onClick={() => setOffen(offen === g.gruppe ? null : g.gruppe)}>
                {g.titel}<Winkel />
              </button>
            ))}
          </nav>
        )}

        <div className="gk-tun">
          <a href={auftragHref} className="gk-leise" data-an={pfad.includes("/business/auftrag") ? "1" : undefined}>{en ? "My order" : "Mein Auftrag"}</a>
          <a href={gespraechHref} onClick={zumGespraech} className={`gk-knopf${imAuftrag ? "" : " hell"}`}>{en ? "Arrange a call" : "Gespräch vereinbaren"}</a>
          {!imAuftrag && <a href={startHref} className="gk-knopf">{en ? "Order now" : "Beauftragen"}</a>}
          <a href={en ? "/business" : "/en/business"} className="gk-sprache" hrefLang={en ? "de" : "en"} lang={en ? "de" : "en"} aria-label={en ? "Deutsche Fassung" : "English version"}>
            <span data-an={en ? undefined : "1"}>DE</span><i aria-hidden="true">·</i><span data-an={en ? "1" : undefined}>EN</span>
          </a>
        </div>

        <button type="button" className="gk-burger" aria-expanded={mobil} aria-controls="gk-mobil" aria-label={mobil ? (en ? "Close menu" : "Menü schließen") : (en ? "Open menu" : "Menü öffnen")} onClick={() => setMobil(!mobil)}>
          <span /><span /><span />
        </button>
      </div>

      {/* ── Das Panel am Rechner ─────────────────────────────────────────────── */}
      {!en && menue.map((g) => (
        <div key={g.gruppe} id={`gk-panel-${g.gruppe}`} className="gk-panel" data-auf={offen === g.gruppe ? "1" : undefined} onMouseEnter={() => auf(g.gruppe)} hidden={offen !== g.gruppe}>
          <div className="gk-panel-innen">
            <div className="gk-panel-liste">
              <p className="gk-panel-titel">{g.titel}</p>
              <ul>
                {g.eintraege.map((e) => (
                  <li key={e.pfad}>
                    <a href={e.pfad} aria-current={e.pfad === pfad ? "page" : undefined} onClick={(ev) => { if (e.pfad.startsWith("/business#")) { const id = e.pfad.split("#")[1]; const z = document.getElementById(id); if (z) { ev.preventDefault(); setOffen(null); z.scrollIntoView({ behavior: "smooth" }); } } }}>
                      <b>{e.titel}</b><span>{e.text}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            {g.gruppe === "preise" ? (
              <div className="gk-promo gk-promo-pakete">
                <p className="gk-panel-titel">Vier Pakete · Festpreis</p>
                {GLOBAL_PAKETE.map((p) => (
                  <a key={p.key} href={globalStartPfad(p.key, "de")} className="gk-paket">
                    <span>{p.de.name}</span><b>{globalPreisText(p.key)}</b>
                  </a>
                ))}
                <a href="/business#pakete" className="gk-promo-link">Leistungen im Vergleich<Pfeil /></a>
              </div>
            ) : (
              <div className="gk-promo">
                <p className="gk-promo-titel">{PROMO[g.gruppe].titel}</p>
                <p className="gk-promo-text">{PROMO[g.gruppe].text}</p>
                <a href={PROMO[g.gruppe].href} className="gk-promo-link">{PROMO[g.gruppe].knopf}<Pfeil /></a>
              </div>
            )}
          </div>
        </div>
      ))}

    </header>

      {/* ── Das Menü am Telefon ──────────────────────────────────────────────────
          NEBEN dem Kopf, nicht darin: Der Kopf trägt backdrop-filter, und ein Filter
          macht ihn zum Bezugsrahmen für position:fixed — das Menü wäre 72 px hoch. */}
      {mobil && (
        <div id="gk-mobil" className="gk-mobil" role="dialog" aria-modal="true" aria-label={en ? "Menu" : "Menü"}>
          <div className="gk-mobil-rumpf">
            {en ? (
              <ul className="gk-mobil-liste">
                {EN_PUNKTE.map((p) => <li key={p.href}><a href={p.href} onClick={() => setMobil(false)}><b>{p.titel}</b><Pfeil /></a></li>)}
              </ul>
            ) : (
              <>
                <a href="/business" className="gk-mobil-start" onClick={() => setMobil(false)}><b>Übersicht und Pakete</b><span>US-Gesellschaft aus einer Hand, Festpreis</span></a>
                {menue.map((g) => (
                  <div key={g.gruppe} className="gk-mobil-gruppe" data-auf={mobilGruppe === g.gruppe ? "1" : undefined}>
                    <button type="button" aria-expanded={mobilGruppe === g.gruppe} onClick={() => setMobilGruppe(mobilGruppe === g.gruppe ? null : g.gruppe)}>
                      {g.titel}<Winkel />
                    </button>
                    {mobilGruppe === g.gruppe && (
                      <ul className="gk-mobil-liste">
                        {g.eintraege.map((e) => (
                          <li key={e.pfad}><a href={e.pfad} aria-current={e.pfad === pfad ? "page" : undefined} onClick={() => setMobil(false)}><b>{e.titel}</b><span>{e.text}</span></a></li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </>
            )}
            <div className="gk-mobil-zeile">
              <a href={`tel:${FIAON_FIRMA.telefonTel}`}>{FIAON_FIRMA.telefon}</a>
              <a href={auftragHref}>{en ? "My order" : "Mein Auftrag"}</a>
              <a href={en ? "/business" : "/en/business"} hrefLang={en ? "de" : "en"}>{en ? "Deutsch" : "English"}</a>
            </div>
          </div>
          <div className="gk-mobil-fuss">
            <a href={gespraechHref} onClick={zumGespraech} className="gk-knopf hell">{en ? "Arrange a call" : "Gespräch vereinbaren"}</a>
            {!imAuftrag && <a href={startHref} className="gk-knopf">{en ? "Order now" : "Beauftragen"}</a>}
          </div>
        </div>
      )}
    </>
  );
}
