// ═══════════════════════════════════════════════════════════════════════════
// /glossar-bonitaet · /en/credit-glossary — das Glossar als interner
// Link-Hub (30.08.2026, zweisprachig 02.09.2026)
//
// Suchintention: „bonität begriffe erklärt“. Jeder Begriff: zwei bis vier
// Sätze Klartext plus der Verweis auf die Themenseite, die in die Tiefe geht
// — genau DAS macht die Seite zum SEO-Verteiler. Suchfeld filtert im
// Client, Sprunganker je Buchstabe, Akkordeon je Begriff. Die Begriffe
// werden je Sprache alphabetisch sortiert (englische Stichwörter beginnen
// anders als die deutschen). Texte: client/src/i18n/glossar-bonitaet.ts.
// JSON-LD: DefinedTermSet.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";
import { Dunkel, Block, Licht, Knopf } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import KartenAufruf from "@/components/site/KartenAufruf";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { GLOSSAR_WOERTER, type Begriff } from "@/i18n/glossar-bonitaet";
import "@/styles/ratgeber.css";
import "@/styles/seo-seiten.css";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function GlossarBonitaet() {
  const t = useWoerter(GLOSSAR_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/credit-glossary" : "/glossar-bonitaet";
  const [filter, setFilter] = useState("");

  const begriffe = useMemo(
    () => [...t.begriffe].sort((a, b) => a.wort.localeCompare(b.wort, en ? "en" : "de")),
    [t, en],
  );

  useEffect(() => {
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "DefinedTermSet",
      name: t.ldName,
      url: `https://fiaon.com${pfad}`,
      hasDefinedTerm: begriffe.map((b) => ({
        "@type": "DefinedTerm", name: b.wort, description: b.text,
        inDefinedTermSet: `https://fiaon.com${pfad}`,
      })),
    });
    document.head.appendChild(el);
    return () => el.remove();
  }, [begriffe, pfad, t]);

  const sichtbar = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return begriffe;
    return begriffe.filter((b) => b.wort.toLowerCase().includes(f) || b.text.toLowerCase().includes(f));
  }, [filter, begriffe]);

  const gruppen = useMemo(() => {
    const karte = new Map<string, Begriff[]>();
    for (const b of sichtbar) {
      const buchstabe = b.wort[0].toUpperCase();
      if (!karte.has(buchstabe)) karte.set(buchstabe, []);
      karte.get(buchstabe)!.push(b);
    }
    return karte;
  }, [sichtbar]);

  return (
    <Dunkel seite="ratgeber" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <SeoDaten
        pfad={pfad}
        titel={t.seoTitel}
        beschreibung={t.seoBeschreibung}
        krumen={[{ name: t.krume, pfad }]}
      />

      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/akten.jpg" alt="" decoding="async" {...({ fetchpriority: "high" } as any)} /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">{t.pille}</span>
          <h1 className="dk-h1">{t.h1a}<span className="dk-verlauf">{t.h1b}</span></h1>
          <p className="dk-lead">{t.lead(begriffe.length)}</p>
          <div className="dk-knoepfe">
            <Knopf href="/antrag">{t.antragStarten}</Knopf>
            <Knopf href={zu("/kontakt")} still>{t.kostenlosPruefen}</Knopf>
          </div>
        </div>
      </section>

      <Licht>
        <Block schmal>
          <div className="sx-glossar-suche">
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t.suchePlatzhalter(begriffe.length)}
              aria-label={t.sucheAria}
              data-fiaon="glossar-suche"
            />
          </div>
          <nav className="sx-anker" aria-label={t.ankerAria}>
            {ALPHABET.map((b) => (
              <a key={b} href={`#glossar-${b}`} className={gruppen.has(b) ? "" : "leer"}
                 aria-disabled={!gruppen.has(b)}>{b}</a>
            ))}
          </nav>

          {sichtbar.length === 0 && (
            <p style={{ marginTop: 30, fontSize: 14.5, color: "#475569" }}>
              {t.keinTrefferA}{filter}{t.keinTrefferB}
              <a href={zu("/schufa-score-verstehen")} style={{ color: "#1d4ed8" }}>{t.keinTrefferLink}</a>{t.keinTrefferC}
            </p>
          )}

          {Array.from(gruppen.entries()).map(([buchstabe, eintraege]) => (
            <div key={buchstabe}>
              <h2 className="sx-buchstabe" id={`glossar-${buchstabe}`}>{buchstabe}</h2>
              {eintraege.map((b) => (
                <details className="sx-begriff" key={b.wort}>
                  <summary>
                    {b.wort}
                    <span className="plus" aria-hidden="true">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                    </span>
                  </summary>
                  <div className="text">
                    {b.text}
                    {b.link && <>{t.vertiefung}<a href={zu(b.link.href)}>{b.link.label}</a>.</>}
                  </div>
                </details>
              ))}
            </div>
          ))}

          <p className="dk-leise" style={{ marginTop: 34 }}>
            {t.fussA}<a href={zu("/schufa-score-verstehen")} style={{ color: "#1d4ed8" }}>{t.fussLink1}</a> ·{" "}
            <a href={zu("/bonitaetsauskunft-beantragen")} style={{ color: "#1d4ed8" }}>{t.fussLink2}</a> ·{" "}
            <a href={zu("/ratgeber")} style={{ color: "#1d4ed8" }}>{t.fussLink3}</a>.
          </p>
        </Block>
      </Licht>

      <KartenAufruf titel={t.aufrufTitel} satz={t.aufrufSatz} />
    </Dunkel>
  );
}
