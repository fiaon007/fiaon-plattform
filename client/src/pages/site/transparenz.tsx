// ═══════════════════════════════════════════════════════════════════════════
// /transparenz — der Transparenzbericht (02.09.2026, E-083)
//
// Seite 8 im Zehn-Seiten-Plan — das, was kein Marktteilnehmer hat:
// öffentliche Kennzahlen mit Definition, Stand und Herkunft. Was gemessen
// ist, steht mit Zahl; was noch nicht belastbar gemessen ist, steht als
// „in Messung" — nicht als Schätzung. Zahlen: Datenbank, nur bankbestätigt
// (E-075/E-082), Skript scripts/tmp/zahlen-oeffentlich.ts. Stand sichtbar.
// Nordstern-Kennzahlen (Definitionen von /investoren): Zeit bis zur ersten
// Einsicht, Antwortquote auf Schreiben, Graduation-Rate, Raten-Einzugsquote.
// Für die vier braucht es einen öffentlichen Endpunkt (bei TFO angefragt);
// bis dahin Definition + Status.
// ═══════════════════════════════════════════════════════════════════════════
// 02.09.2026: zweisprachig — /transparenz (Deutsch) und /en/transparency
// (Englisch); Texte im Wörterbuch client/src/i18n/transparenz.ts, die
// Zahlen bleiben HIER (eine Quelle, Stand sichtbar).
import { Dunkel, Hero, Block, Licht, Knopf, Kennzahlen, Zeilen, Karten, Glas, Fragen } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { TRANSPARENZ_WOERTER } from "@/i18n/transparenz";
import "@/styles/ratgeber.css";
import "@/styles/seo-seiten.css";

// Die Zahlen (E-082, scripts/tmp/zahlen-oeffentlich.ts) — in beiden Sprachen dieselben.
const ZAHLEN = ["443", "450", "267 · 150 · 4", "20 · 57"];

export default function Transparenz() {
  const t = useWoerter(TRANSPARENZ_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/transparency" : "/transparenz";
  return (
    <Dunkel seite="ratgeber" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <SeoDaten pfad={pfad} titel={t.seoTitel} beschreibung={t.seoBeschreibung} fragen={t.fragen} krumen={[{ name: t.krume, pfad }]} />

      <Hero
        bild="/kino/datenraum.jpg"
        pille={t.pille}
        titel={<>{t.h1a}<span className="dk-verlauf">{t.h1b}</span></>}
        lead={t.lead}
        knoepfe={<><Knopf href="#zahlen">{t.dieZahlen}</Knopf><Knopf href={zu("/fiaon-erfahrungen")} still>{t.soArbeitet}</Knopf></>}
      />

      <Block id="zahlen" eng>
        <Kennzahlen items={ZAHLEN.map((wert, i) => ({ wert, label: t.zahlenLabels[i] }))} />
        <p className="dk-leise" style={{ textAlign: "center", marginTop: 14 }}>{t.standSatz(t.stand)}</p>
      </Block>

      <Licht>
        <Block schmal titel={<>{t.defH2a}<span className="dk-verlauf">{t.defH2b}</span></>} lead={t.defLead}>
          <Zeilen items={t.definitionen} />
        </Block>

        <Block titel={<>{t.nordH2a}<span className="dk-verlauf">{t.nordH2b}</span></>} lead={t.nordLead}>
          <Karten items={t.nord} />
        </Block>

        <Block schmal>
          <Glas ruhig tag={t.nichtTag} titel={t.nichtTitel}>
            <p className="dk-text" style={{ fontSize: 15, lineHeight: 1.7 }}>{t.nichtText}</p>
          </Glas>
        </Block>

        <Block schmal titel={t.fragenTitel}><Fragen items={t.fragen} /></Block>
      </Licht>

      <Block schmal>
        <div className="dk-knoepfe" style={{ justifyContent: "center" }}>
          <Knopf href={zu("/fiaon-erfahrungen")}>{t.soArbeitet}</Knopf>
          <Knopf href={zu("/status")} still>{t.statusKnopf}</Knopf>
          <Knopf href="/investoren" still>{t.investorenKnopf}</Knopf>
        </div>
      </Block>
    </Dunkel>
  );
}
