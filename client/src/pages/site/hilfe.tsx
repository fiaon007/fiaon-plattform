// ═══════════════════════════════════════════════════════════════════════════
// /hilfe — das Hilfe-Center (02.09.2026, E-083)
//
// Seite 2 im Zehn-Seiten-Plan; Seitenverzeichnis A4 seit 22.08. offen
// („entlastet Support"). Acht Themen, je fünf bis sieben Fragen, ein
// Suchfeld über alles (im Browser), am Ende die Kontaktwege. Die Antworten
// folgen shared/fiaon-wissen.ts (dem Wissen des Assistenten) — dieselben
// Aussagen wie am Telefon und im Assistenten, damit nie zwei Antworten
// nebeneinander stehen. Fängt „fiaon login / kündigen / zahlung"-Suchen ab.
// Jede Frage hat eine Anker-ID (#thema-n), damit Support-Mails direkt auf
// die Antwort verlinken können.
// ═══════════════════════════════════════════════════════════════════════════
// 02.09.2026: zweisprachig — /hilfe (Deutsch) und /en/help (Englisch); die
// acht Themen mit allen Fragen stehen im Wörterbuch client/src/i18n/hilfe.ts.
import { useMemo, useState } from "react";
import { Dunkel, Hero, Block, Licht, Knopf, Glas, Zwischenruf } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { HILFE_WOERTER } from "@/i18n/hilfe";
import "@/styles/ratgeber.css";
import "@/styles/seo-seiten.css";

export default function Hilfe() {
  const t = useWoerter(HILFE_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/help" : "/hilfe";
  const THEMEN = t.themen;
  const [suche, setSuche] = useState("");
  const [offen, setOffen] = useState<string | null>(null);
  const treffer = useMemo(() => {
    const q = suche.trim().toLowerCase();
    if (q.length < 2) return null;
    const list: { thema: string; key: string; f: string; a: string }[] = [];
    for (const th of THEMEN) th.fragen.forEach((x, i) => { if ((x.f + " " + x.a).toLowerCase().includes(q)) list.push({ thema: th.titel, key: `${th.key}-${i + 1}`, f: x.f, a: x.a }); });
    return list;
  }, [suche, THEMEN]);
  const alle = THEMEN.flatMap((th) => th.fragen);

  return (
    <Dunkel seite="kontakt" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <SeoDaten pfad={pfad} titel={t.seoTitel} beschreibung={t.seoBeschreibung} fragen={alle.slice(0, 12)} krumen={[{ name: t.krume, pfad }]} />

      <Hero
        bild="/kino/cockpit.jpg"
        pille={t.pille}
        titel={<>{t.h1a}<span className="dk-verlauf">{t.h1b}</span></>}
        lead={t.lead}
        knoepfe={<><Knopf href="#suche">{t.suchen}</Knopf><Knopf href={zu("/kontakt")} still>{t.einMensch}</Knopf></>}
      />

      <Licht>
        <Block id="suche" schmal>
          <div className="wz-formular" style={{ marginTop: 0 }}>
            <label><span>{t.wonach}</span><input value={suche} onChange={(e) => setSuche(e.target.value)} placeholder={t.suchePlatz} autoFocus /></label>
          </div>
          {treffer && (
            <div style={{ marginTop: 18 }}>
              {treffer.length === 0 ? <p className="dk-text">{t.keinTrefferA}<a href={zu("/kontakt")} style={{ color: "#1d4ed8" }}>{t.keinTrefferLink}</a>{t.keinTrefferB}</p> : treffer.map((x) => (
                <div key={x.key} className="wz-schritt" style={{ marginTop: 10 }}><small>{x.thema}</small><p><b>{x.f}</b><br />{x.a}</p></div>
              ))}
            </div>
          )}
        </Block>

        {THEMEN.map((th) => (
          <Block key={th.key} id={th.key} schmal titel={th.titel} lead={th.satz}>
            <div className="wz-fragen">
              {th.fragen.map((x, i) => {
                const id = `${th.key}-${i + 1}`; const auf = offen === id;
                return (
                  <div key={id} id={id} className="wz-frage" style={{ cursor: "pointer" }} onClick={() => setOffen(auf ? null : id)}>
                    <h3 style={{ margin: 0 }}>{x.f}</h3>
                    {auf && <p className="wz-hinweis" style={{ marginTop: 10 }}>{x.a}</p>}
                  </div>
                );
              })}
            </div>
          </Block>
        ))}

        <Block schmal>
          <Glas ruhig tag={t.nichtDabeiTag} titel={t.nichtDabeiTitel}>
            <p className="dk-text" style={{ fontSize: 15, lineHeight: 1.7 }}>{t.nichtDabeiA}<a href={zu("/kontakt")} style={{ color: "#1d4ed8" }}>{t.nichtDabeiLink}</a>{t.nichtDabeiB}</p>
          </Glas>
        </Block>
      </Licht>

      <Zwischenruf text={<><b>{t.zwischenrufA}</b>{t.zwischenrufB}</>} knopf={t.terminBuchen} href={zu("/termin")} still={{ knopf: t.werkzeuge, href: zu("/werkzeuge") }} />
    </Dunkel>
  );
}
