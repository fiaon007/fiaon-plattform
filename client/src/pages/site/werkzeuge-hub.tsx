// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge · /en/tools — die Werkzeugbank (26.08.2026, zweisprachig 03.09.2026)
//
// Zwanzig Werkzeuge, ein Verteiler — für die Suche der eine Ort, an dem
// „kostenlose Schufa-Werkzeuge" eine Adresse hat. Die Karten sind zugleich
// die Sprungmarken, auf die Anzeigen zeigen können. Namen, Fragen und Sätze
// der Werkzeuge kommen aus shared/fiaon-seo-seiten.ts (eine Quelle für
// Server-Vorrendering und Client), die Gruppen aus dieser Datei, die Rahmen-
// texte aus client/src/i18n/wz-hub.ts. SEO: ItemList, Brotkrumen, FAQ.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect } from "react";
import { Dunkel, Block, Licht, Knopf, Zwischenruf, Fragen, Auf } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import { SEO_WERKZEUGE, SEO_WERKZEUGE_EN } from "@shared/fiaon-seo-seiten";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { WZ_HUB_WOERTER } from "@/i18n/wz-hub";
import "@/styles/ratgeber.css";
import "@/styles/seo-seiten.css";

const GRUPPE: Record<string, "eintrag" | "geld" | "karte"> = {
  "/werkzeuge/selbstauskunft": "eintrag", "/werkzeuge/eintrag-pruefen": "eintrag", "/werkzeuge/loeschfrist": "eintrag", "/werkzeuge/verjaehrung": "eintrag", "/werkzeuge/inkassokosten": "eintrag",
  "/werkzeuge/widerspruch": "eintrag", "/werkzeuge/mahnbescheid": "eintrag", "/werkzeuge/inkasso-antwort": "eintrag", "/werkzeuge/mahngebuehren": "eintrag",
  "/werkzeuge/kreditrechner": "geld", "/werkzeuge/umschuldung": "geld", "/werkzeuge/schulden-check": "geld", "/werkzeuge/spielraum": "geld", "/werkzeuge/ratenplan": "geld", "/werkzeuge/schuldenplan": "geld", "/werkzeuge/dispo-rechner": "geld", "/werkzeuge/pfaendungsrechner": "geld",
  "/werkzeuge/karten-check": "karte", "/werkzeuge/basiskonto": "karte", "/werkzeuge/kartenkosten": "karte",
};

export default function WerkzeugeHub() {
  const t = useWoerter(WZ_HUB_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/tools" : "/werkzeuge";
  const werkzeuge = (en ? SEO_WERKZEUGE_EN : SEO_WERKZEUGE).map((w) => ({ ...w, gruppe: GRUPPE[w.pfad] ?? "eintrag", ziel: zu(w.pfad) }));

  useEffect(() => {
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: t.ldName,
      itemListElement: werkzeuge.map((w, i) => ({ "@type": "ListItem", position: i + 1, name: w.name, url: "https://fiaon.com" + w.ziel })),
    });
    document.head.appendChild(el);
    return () => el.remove();
  }, [t, en]);

  return (
    <Dunkel seite="ratgeber" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <SeoDaten pfad={pfad} titel={t.metaTitel} beschreibung={t.seoBeschreibung} fragen={t.fragen} krumen={[{ name: t.krume, pfad }]} />
      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/akten.jpg" alt="" decoding="async" {...({ fetchpriority: "high" } as any)} /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">{t.pille}</span>
          <h1 className="dk-h1">{t.h1a}<span className="dk-verlauf">{t.h1b}</span></h1>
          <p className="dk-lead">{t.lead}</p>
        </div>
      </section>
      <Licht>
        {t.gruppen.map((g) => (
          <Block key={g.key} titel={g.titel} lead={g.satz}>
            <div className="wzh-karten">
              {werkzeuge.filter((w) => w.gruppe === g.key).map((w, i) => (
                <Auf key={w.pfad} verzoegerung={i * 70}>
                  <a className="wzh-karte" href={w.ziel}>
                    <small>{w.frage}</small>
                    <b>{w.name}</b>
                    <p>{w.satz}</p>
                    <span className="wzh-pfeil" aria-hidden="true">→</span>
                  </a>
                </Auf>
              ))}
            </div>
          </Block>
        ))}
        <Block schmal titel={t.fragenTitel}>
          <Fragen items={t.fragen} />
        </Block>
        <Block schmal titel={t.weiterTitel}>
          <div className="sx-vertiefen">
            {t.weiter.map((w) => <a href={zu(w.href)} key={w.href}><b>{w.titel}</b><span>{w.text}</span></a>)}
          </div>
        </Block>
      </Licht>
      <Zwischenruf text={<><b>{t.zwischenrufFett}</b>{t.zwischenruf}</>} knopf={t.zwischenrufKnopf} href={zu("/was-ist-fiaon")} />
    </Dunkel>
  );
}
