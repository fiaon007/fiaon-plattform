// ═══════════════════════════════════════════════════════════════════════════
// /ratgeber — der Hub (23.08.2026): Hero auf der dunklen Bühne, darunter der
// helle Leseraum mit Filtern nach Kategorie und den Artikelkarten. Die Daten
// kommen aus /api/fiaon/ratgeber (nur Veröffentlichtes). Hell, schnell, wenig
// 3D — die Ratgeber sind die Arbeitsseiten, nicht die Bühne.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";
import { Dunkel, Hero, Block, Licht, Knopf, Auf, Zwischenruf } from "@/components/site/DunkleBuehne";
import { KATEGORIEN, AUTORIN, ratgeberPfad, type Kategorie } from "@shared/fiaon-ratgeber";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { RATGEBER_WOERTER } from "@/i18n/ratgeber";
import "@/styles/ratgeber.css";

interface Karte { slug: string; titel: string; teaser: string; kategorie: Kategorie; land: string; lesezeit: number; veroeffentlichtAm: string | null }

export default function Ratgeber() {
  const t = useWoerter(RATGEBER_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const datum = (s: string | null) => s ? new Date(s).toLocaleDateString(t.gebiet, { day: "2-digit", month: "long", year: "numeric" }) : "";
  const [liste, setListe] = useState<Karte[] | null>(null);
  const [kat, setKat] = useState<string>(() => new URLSearchParams(window.location.search).get("kategorie") || "");
  useEffect(() => {
    // 09.09.2026 (E-100): Die Liste kommt je Sprache — sonst mischen sich die
    // Fassungen und ein englischer Leser landet in einem deutschen Text.
    fetch(`/api/fiaon/ratgeber?sprache=${sprache}`).then((r) => r.json()).then((j) => setListe(j?.artikel || [])).catch(() => setListe([]));
  }, [sprache]);
  useEffect(() => { document.title = t.dokumentTitel; }, [t]);
  const gefiltert = useMemo(() => (liste || []).filter((a) => !kat || a.kategorie === kat), [liste, kat]);
  const vorhandene = useMemo(() => new Set((liste || []).map((a) => a.kategorie)), [liste]);

  return (
    <Dunkel seite="ratgeber" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <Hero
        bild="/kino/akten.jpg"
        pille={t.pille}
        titel={<>{t.heroA}<span className="dk-verlauf">{t.heroB}</span></>}
        lead={t.heroLead}
        knoepfe={<><Knopf href="#artikel">{t.heroKnopf}</Knopf><Knopf href="/antrag" still>{t.heroKnopfStill}</Knopf></>}
      />

      <Licht>
        <Block id="artikel" pille={t.themenPille} titel={<>{t.themenA}<span className="dk-verlauf">{t.themenB}</span></>}
               lead={t.themenLead} mitte>
          <div className="rg-filter" role="tablist">
            <button type="button" data-an={kat === "" ? "1" : undefined} onClick={() => setKat("")}>{t.alle}</button>
            {(Object.keys(KATEGORIEN) as Kategorie[]).filter((k) => vorhandene.has(k)).map((k) => (
              <button key={k} type="button" data-an={kat === k ? "1" : undefined} onClick={() => setKat(k)}>{KATEGORIEN[k].label}</button>
            ))}
          </div>
          <div className="rg-liste" style={{ textAlign: "left" }}>
            {liste === null && <p className="rg-leer">{t.laden}</p>}
            {liste !== null && gefiltert.length === 0 && <p className="rg-leer">{t.leer}</p>}
            {gefiltert.map((a, i) => (
              <Auf key={a.slug} verzoegerung={Math.min(i, 6) * 60}>
                <a href={ratgeberPfad(a.slug, sprache)} className={`rg-karte${i === 0 && !kat ? " gross" : ""}`}>
                  <div className="rg-karte-text" style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
                    <div className="rg-kopfzeile"><span>{KATEGORIEN[a.kategorie]?.label || a.kategorie}</span><span className="land">{t.laender[a.land] || a.land}</span></div>
                    <h3>{a.titel}</h3>
                    <p>{a.teaser}</p>
                    <div className="rg-karte-fuss"><span>{datum(a.veroeffentlichtAm)} · {a.lesezeit} {t.lesezeit}</span><b>{t.lesen}</b></div>
                  </div>
                </a>
              </Auf>
            ))}
          </div>
        </Block>

        <Block id="werkzeuge" pille={t.werkzeugePille} titel={<>{t.werkzeugeA}<span className="dk-verlauf">{t.werkzeugeB}</span></>} mitte>
          <div className="rg-liste" style={{ gridTemplateColumns: "repeat(2,1fr)", textAlign: "left", marginTop: 28 }}>
            {t.werkzeuge.map((w) => (
              <a key={w.pfad} href={zu(w.pfad)} className="rg-karte">
                <div className="rg-kopfzeile"><span>{t.werkzeugLabel}</span></div>
                <h3>{w.titel}</h3><p>{w.text}</p>
                {w.tat
                  ? <div className="rg-karte-fuss"><span>{w.dauer}</span><b>{w.tat}</b></div>
                  : <div className="rg-fuss"><span>{t.sofort}</span></div>}
              </a>
            ))}
          </div>
        </Block>

        <Block pille={t.autorinPille} mitte>
          <div className="rg-autorin" style={{ maxWidth: 760, margin: "0 auto", textAlign: "left" }}>
            <img src={AUTORIN.bild} alt={AUTORIN.name} />
            <div><small>{AUTORIN.rolle}</small><b>{AUTORIN.name}</b><p>{AUTORIN.lang}</p></div>
          </div>
        </Block>
      </Licht>

      <Zwischenruf text={t.zwischenruf} knopf={t.zwischenrufKnopf} href="/antrag" still={{ knopf: t.zwischenrufStill, href: zu("/was-ist-fiaon") }} />
    </Dunkel>
  );
}
