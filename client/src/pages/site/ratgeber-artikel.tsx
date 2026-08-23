// ═══════════════════════════════════════════════════════════════════════════
// /ratgeber/:slug — ein Artikel (23.08.2026)
//
// Hero auf der dunklen Bühne (Kategorie, Titel, Autorin, Datum, Lesezeit),
// darunter der helle Leseraum: Inhaltsverzeichnis links (klebt, markiert den
// aktuellen Abschnitt), Text rechts mit 68 Zeichen Zeilenlänge, ein Einschub
// „Was FIAON übernimmt", FAQ als Aufklapper, Autorin, weitere Texte.
// Für Google: Article- und FAQPage-JSON-LD, Titel und Beschreibung im <head>.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from "react";
import { Dunkel, Licht, Knopf, Zwischenruf } from "@/components/site/DunkleBuehne";
import { KATEGORIEN, AUTORIN, type Artikel } from "@shared/fiaon-ratgeber";
import { markdownZuHtml, inhaltsverzeichnis, textAusMarkdown } from "@shared/fiaon-markdown";
import "@/styles/ratgeber.css";

interface Weiterer { slug: string; titel: string; teaser: string; kategorie: string; land: string; lesezeit: number; veroeffentlichtAm: string | null }
const LANDKURZ: Record<string, string> = { DE: "Deutschland", AT: "Österreich", CH: "Schweiz", DACH: "DACH" };
const datum = (s: string | null | undefined) => s ? new Date(s).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" }) : "";

function kopfSetzen(a: Artikel) {
  document.title = `${a.metaTitel || a.titel} · FIAON Ratgeber`;
  const setz = (sel: string, attr: Record<string, string>) => {
    let el = document.head.querySelector<HTMLElement>(sel);
    if (!el) { el = document.createElement(sel.startsWith("link") ? "link" : "meta"); Object.entries(attr).forEach(([k, v]) => { if (k !== "content" && k !== "href") el!.setAttribute(k, v); }); document.head.appendChild(el); }
    if (attr.content) el.setAttribute("content", attr.content); if (attr.href) el.setAttribute("href", attr.href);
  };
  setz('meta[name="description"]', { name: "description", content: a.metaBeschreibung || a.teaser });
  setz('link[rel="canonical"]', { rel: "canonical", href: `https://www.fiaon.com/ratgeber/${a.slug}` });
  setz('meta[property="og:title"]', { property: "og:title", content: a.titel });
  setz('meta[property="og:description"]', { property: "og:description", content: a.teaser });
  setz('meta[property="og:type"]', { property: "og:type", content: "article" });
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Article", headline: a.titel, description: a.teaser, datePublished: a.veroeffentlichtAm, dateModified: a.aktualisiertAm, inLanguage: "de",
        author: { "@type": "Person", name: AUTORIN.name, jobTitle: AUTORIN.rolle }, publisher: { "@type": "Organization", name: "FIAON", url: "https://www.fiaon.com" },
        mainEntityOfPage: `https://www.fiaon.com/ratgeber/${a.slug}`, keywords: a.schlagworte.join(", "), wordCount: textAusMarkdown(a.inhalt).split(" ").length },
      a.faq.length ? { "@type": "FAQPage", mainEntity: a.faq.map((f) => ({ "@type": "Question", name: f.frage, acceptedAnswer: { "@type": "Answer", text: f.antwort } })) } : null,
    ].filter(Boolean),
  };
  let s = document.getElementById("rg-ld") as HTMLScriptElement | null;
  if (!s) { s = document.createElement("script"); s.type = "application/ld+json"; s.id = "rg-ld"; document.head.appendChild(s); }
  s.textContent = JSON.stringify(ld);
}

export default function RatgeberArtikel() {
  const slug = decodeURIComponent(window.location.pathname.replace(/^\/ratgeber\//, "").replace(/\/+$/, ""));
  const vorschau = new URLSearchParams(window.location.search).get("vorschau") === "1";
  const [a, setA] = useState<Artikel | null>(null);
  const [weitere, setWeitere] = useState<Weiterer[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [aktiv, setAktiv] = useState<string>("");
  const [fortschritt, setFortschritt] = useState(0);
  const inhaltRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/fiaon/ratgeber/${encodeURIComponent(slug)}${vorschau ? "?vorschau=1" : ""}`).then(async (r) => {
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { setFehler(j?.error || "Diesen Ratgeber gibt es nicht."); return; }
      setA(j.artikel); setWeitere(j.weitere || []); kopfSetzen(j.artikel);
    }).catch(() => setFehler("Der Ratgeber ist gerade nicht erreichbar."));
    return () => { document.getElementById("rg-ld")?.remove(); };
  }, [slug, vorschau]);

  const html = useMemo(() => (a ? markdownZuHtml(a.inhalt) : ""), [a]);
  const toc = useMemo(() => (a ? inhaltsverzeichnis(a.inhalt) : []), [a]);

  // Aktiver Abschnitt + Lesefortschritt (die App scrollt in #root → Scroll im Capture-Modus)
  useEffect(() => {
    if (!a) return;
    const fn = () => {
      const el = inhaltRef.current; if (!el) return;
      const r = el.getBoundingClientRect();
      const gesamt = Math.max(1, r.height - window.innerHeight);
      setFortschritt(Math.min(1, Math.max(0, -r.top / gesamt)));
      const ueberschriften = Array.from(el.querySelectorAll<HTMLElement>("h2[id], h3[id]"));
      let akt = ""; for (const h of ueberschriften) { if (h.getBoundingClientRect().top <= 130) akt = h.id; }
      setAktiv(akt);
    };
    fn(); document.addEventListener("scroll", fn, { passive: true, capture: true });
    return () => document.removeEventListener("scroll", fn, { capture: true } as EventListenerOptions);
  }, [a]);

  const springen = (id: string) => (e: React.MouseEvent) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }); history.replaceState(null, "", `#${id}`); };

  if (fehler) {
    return (
      <Dunkel seite="ratgeber" titel="Ratgeber" beschreibung="FIAON Ratgeber">
        <section className="dk-hero"><div className="dk-rahmen"><span className="dk-pille">Ratgeber</span><h1 className="dk-h1">Diesen Text gibt es nicht.</h1><p className="dk-lead">{fehler}</p><div className="dk-knoepfe"><Knopf href="/ratgeber">Alle Ratgeber</Knopf></div></div></section>
      </Dunkel>
    );
  }
  if (!a) return <Dunkel seite="ratgeber" titel="Ratgeber" beschreibung="FIAON Ratgeber"><section className="dk-hero"><div className="dk-rahmen"><p className="dk-lead">Der Text wird geladen …</p></div></section></Dunkel>;

  return (
    <Dunkel seite="ratgeber" titel={a.metaTitel || a.titel} beschreibung={a.metaBeschreibung || a.teaser}>
      <div className="rg-fortschritt" aria-hidden="true"><i style={{ width: `${fortschritt * 100}%` }} /></div>
      <section className="dk-hero rg-artikel-hero">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/akten.jpg" alt="" decoding="async" /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <a href={`/ratgeber?kategorie=${a.kategorie}`} className="dk-pille" style={{ textDecoration: "none" }}>{KATEGORIEN[a.kategorie]?.label || "Ratgeber"} · {LANDKURZ[a.land] || a.land}</a>
          <h1 className="dk-h1">{a.titel}</h1>
          {a.untertitel && <p className="dk-lead">{a.untertitel}</p>}
          <div className="rg-meta">
            <span className="autorin"><img src={AUTORIN.bild} alt="" /><span>{AUTORIN.name}<small>{AUTORIN.rolle}</small></span></span>
            <span>{datum(a.veroeffentlichtAm || a.aktualisiertAm)}</span>
            <span>{a.lesezeit} Min. Lesezeit</span>
            {vorschau && <span style={{ color: "#fcd34d" }}>Vorschau · {a.status}</span>}
          </div>
        </div>
      </section>

      <Licht>
        <div className="dk-rahmen">
          <div className="rg-leseraum">
            <aside className="rg-toc">
              <p>Inhalt</p>
              <ol>{toc.map((t) => <li key={t.id}><a href={`#${t.id}`} className={`${t.ebene === 3 ? "e3" : ""}${aktiv === t.id ? " aktiv" : ""}`} onClick={springen(t.id)}>{t.text}</a></li>)}</ol>
              <div className="rg-toc-cta"><a className="dk-knopf" href="/antrag">Auskunft beschaffen</a><small>Konto in zwei Minuten · Einsicht in 24 Stunden</small></div>
            </aside>
            <article>
              <div ref={inhaltRef} className="rg-inhalt" dangerouslySetInnerHTML={{ __html: html }} />
              <div className="rg-einschub">
                <div><small>Was FIAON übernimmt</small><b>Auskunft beschaffen, jeden Eintrag erklären, Schreiben versenden, Fristen halten.</b><p>Konto in zwei Minuten, Einsicht in 24 Stunden. Danach Girokonto für jeden Kunden – und die Karte, sobald der Wert reicht.</p></div>
                <Knopf href="/antrag">Konto eröffnen</Knopf>
              </div>
              {a.faq.length > 0 && (
                <section className="rg-faq">
                  <h2>Häufige Fragen</h2>
                  {a.faq.map((f) => <details key={f.frage}><summary>{f.frage}</summary><p>{f.antwort}</p></details>)}
                </section>
              )}
              <div className="rg-autorin">
                <img src={AUTORIN.bild} alt={AUTORIN.name} />
                <div><small>{AUTORIN.rolle}</small><b>{AUTORIN.name}</b><p>{AUTORIN.kurz}</p></div>
              </div>
              <p className="rg-hinweis">Dieser Text informiert allgemein über Rechte und Abläufe rund um Auskunfteien und ersetzt keine Rechtsberatung im Einzelfall. FIAON beschafft Auskünfte, erklärt Einträge und bereitet Schreiben vor – über Konto, Karte und Rahmen entscheidet immer die Bank. Stand: {datum(a.aktualisiertAm)}.</p>
              {weitere.length > 0 && (
                <section className="rg-weitere">
                  <h2>Weiterlesen</h2>
                  <div className="rg-liste" style={{ marginTop: 0 }}>
                    {weitere.map((w) => (
                      <a key={w.slug} href={`/ratgeber/${w.slug}`} className="rg-karte">
                        <div className="rg-kopfzeile"><span>{KATEGORIEN[w.kategorie as keyof typeof KATEGORIEN]?.label || w.kategorie}</span><span className="land">{LANDKURZ[w.land] || w.land}</span></div>
                        <h3>{w.titel}</h3><p>{w.teaser}</p>
                        <div className="rg-karte-fuss"><span>{w.lesezeit} Min.</span><b>Lesen →</b></div>
                      </a>
                    ))}
                  </div>
                </section>
              )}
            </article>
          </div>
        </div>
      </Licht>

      <Zwischenruf text="Sie möchten wissen, welche Ihrer Einträge angreifbar sind? FIAON beschafft die Auskunft und erklärt jeden Eintrag – innerhalb von 24 Stunden." knopf="Konto eröffnen" href="/antrag" still={{ knopf: "Alle Ratgeber", href: "/ratgeber" }} />
    </Dunkel>
  );
}
