// ═══════════════════════════════════════════════════════════════════════════
// /vergleich — FIAON, Anwalt, Score-App, Selbermachen (02.09.2026, E-083)
//
// Seite 4 im Zehn-Seiten-Plan. Suchintentionen: „schufa eintrag löschen
// anwalt kosten", „bonify alternative", „schufa eintrag löschen lassen
// anbieter". Vergleichsseiten ranken, weil sie die Entscheidung abnehmen —
// und sie konvertieren nur, wenn sie ehrlich sind: Der Anwalt ist bei
// Klage und Schadensersatz besser, Selbermachen reicht bei einem klaren
// Eintrag, die Score-App zeigt kostenlos. Keine Anbieternamen außer den
// allgemein bekannten Kategorien; keine Herabsetzung.
// Werkzeug: Entscheidungsbaum mit drei Fragen → Empfehlung des Wegs (nicht
// des Anbieters) — die Wortregel „empfehlen" wird vermieden: „passt zu".
// ═══════════════════════════════════════════════════════════════════════════
// 02.09.2026: zweisprachig — /vergleich (Deutsch) und /en/compare (Englisch);
// Texte im Wörterbuch client/src/i18n/vergleich.ts; der Entscheidungsbaum
// liefert den SCHLÜSSEL des Wegs, der Text kommt aus dem Wörterbuch.
import { useMemo, useState } from "react";
import { Dunkel, Hero, Block, Licht, Knopf, Karten, Fragen, Glas, Zwischenruf } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { VERGLEICH_WOERTER } from "@/i18n/vergleich";
import "@/styles/ratgeber.css";
import "@/styles/seo-seiten.css";

type Antwort = Record<string, string>;
function weg(a: Antwort): { key: string; href: string } | null {
  if (!a.lage || !a.zeit || !a.ziel) return null;
  if (a.ziel === "recht" || a.lage === "streit") return { key: "anwalt", href: "/werkzeuge/widerspruch" };
  if (a.lage === "nur") return { key: "nur", href: "/werkzeuge/selbstauskunft" };
  if (a.lage === "klar" && a.zeit === "viel") return { key: "selbst", href: "/werkzeuge/widerspruch" };
  if (a.ziel === "konto") return { key: "konto", href: "/preise#finder" };
  return { key: "fiaon", href: "/preise" };
}

/** Eine Tabellenzelle: **fett** aus dem Wörterbuch wird zu <b>. */
function Zelle({ text }: { text: string }) {
  const m = text.match(/^\*\*(.*)\*\*$/);
  return m ? <b>{m[1]}</b> : <>{text}</>;
}

export default function Vergleich() {
  const t = useWoerter(VERGLEICH_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/compare" : "/vergleich";
  const [a, setA] = useState<Antwort>({});
  const w = useMemo(() => weg(a), [a]);
  const wegText = w ? t.wege[w.key] : null;
  return (
    <Dunkel seite="privatkunden" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <SeoDaten pfad={pfad} titel={t.seoTitel} beschreibung={t.seoBeschreibung} fragen={t.fragen} krumen={[{ name: t.krume, pfad }]} />

      <Hero
        bild="/kino/akten.jpg"
        pille={t.pille}
        titel={<>{t.h1a}<span className="dk-verlauf">{t.h1b}</span></>}
        lead={t.lead}
        knoepfe={<><Knopf href="#entscheiden">{t.wasPasst}</Knopf><Knopf href="#tabelle" still>{t.dieTabelle}</Knopf></>}
      />

      <Licht>
        <Block id="tabelle" titel={<>{t.tabelleH2a}<span className="dk-verlauf">{t.tabelleH2b}</span></>} lead={t.tabelleLead}>
          <div className="wz-tabelle-huelle">
            <table className="wz-tabelle">
              <thead><tr>{t.kopf.map((k, i) => <th key={i} scope="col">{k}</th>)}</tr></thead>
              <tbody>
                {t.zeilen.map((z) => <tr key={z[0]}>{z.map((c, i) => <td key={i}><Zelle text={c} /></td>)}</tr>)}
              </tbody>
            </table>
          </div>
          <p className="dk-leise" style={{ marginTop: 14 }}>{t.tabelleHinweis}</p>
        </Block>

        <Block id="entscheiden" schmal titel={<>{t.entscheidenH2a}<span className="dk-verlauf">{t.entscheidenH2b}</span></>} lead={t.entscheidenLead}>
          <div className="wz-fragen">
            {t.baum.map((f, i) => (
              <div key={f.key} className="wz-frage">
                <p className="wz-nr">{t.frage} {i + 1}</p><h3>{f.frage}</h3>
                <div className="wz-optionen zwei">{f.optionen.map(([k, l]) => <button key={k} type="button" className={`wz-option${a[f.key] === k ? " an" : ""}`} onClick={() => setA({ ...a, [f.key]: k })}><b>{l}</b></button>)}</div>
              </div>
            ))}
          </div>
          {w && wegText && (
            <div className="wz-ergebnis gut">
              <span className="wz-stufe" style={{ background: "#047857" }}>{t.ihrWeg}</span>
              <h3>{wegText.titel}</h3>
              <p>{wegText.text}</p>
              <div className="wz-knoepfe"><Knopf href={zu(w.href.split("#")[0]) + (w.href.includes("#") ? "#" + w.href.split("#")[1] : "")}>{wegText.knopf}</Knopf><Knopf href={zu("/termin")} still>{t.lieberReden}</Knopf></div>
            </div>
          )}
        </Block>

        <Block titel={<>{t.altH2a}<span className="dk-verlauf">{t.altH2b}</span></>} lead={t.altLead}>
          <Karten items={t.alternativen} />
        </Block>

        <Block schmal>
          <Glas ruhig tag={t.nichtTag} titel={t.nichtTitel}>
            <p className="dk-text" style={{ fontSize: 15, lineHeight: 1.7 }}>{t.nichtA}<a href={zu("/fiaon-erfahrungen")} style={{ color: "#1d4ed8" }}>{t.nichtLink}</a>{t.nichtB}</p>
          </Glas>
        </Block>

        <Block schmal titel={t.fragenTitel}><Fragen items={t.fragen} /></Block>
      </Licht>

      <Zwischenruf text={<><b>{t.zwischenrufA}</b>{t.zwischenrufB}</>} knopf={t.terminBuchen} href={zu("/termin")} still={{ knopf: t.werkzeuge, href: zu("/werkzeuge") }} />
    </Dunkel>
  );
}
