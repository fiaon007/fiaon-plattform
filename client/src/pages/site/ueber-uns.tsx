// ═══════════════════════════════════════════════════════════════════════════
// /ueber-uns — die Geschichte und die Haltung (02.09.2026, E-083)
//
// Seite 5 im Zehn-Seiten-Plan. /team zeigt Menschen, /was-ist-fiaon das
// Modell — die Gründungsgeschichte, die Meilensteine und die Haltung
// fehlten. E-E-A-T: Wer steht dahinter, seit wann, warum, und woran hält
// sich das Haus. Alle Daten aus Register, Logbuch und Datenbank; keine
// Erzählung, die sich nicht belegen lässt. Sitz London + Kunden DACH wird
// erklärt statt versteckt (Prüfer fragen danach).
// Meilensteine: Handelsregister (Company No. 17318250), erste bank-
// bestätigte Zahlung 04.07.2026 (Datenbank), Umzug der Server nach
// Frankfurt 24.08.2026 (Logbuch), 443 zahlende Kunden am 02.09.2026.
// ═══════════════════════════════════════════════════════════════════════════
// 02.09.2026: zweisprachig — /ueber-uns (Deutsch) und /en/about (Englisch);
// Texte im Wörterbuch client/src/i18n/ueber-uns.ts.
import { Dunkel, Hero, Block, Licht, Knopf, Karten, Kennzahlen, Zitat, Auf, Szenenbild, Fragen } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { UEBER_UNS_WOERTER } from "@/i18n/ueber-uns";
import "@/styles/ratgeber.css";
import "@/styles/seo-seiten.css";

export default function UeberUns() {
  const t = useWoerter(UEBER_UNS_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/about" : "/ueber-uns";
  return (
    <Dunkel seite="team" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <SeoDaten pfad={pfad} titel={t.seoTitel} beschreibung={t.seoBeschreibung} fragen={t.fragen} krumen={[{ name: t.krume, pfad }]} />

      <Hero
        bild="/kino/investoren.jpg"
        pille={t.pille}
        titel={<>{t.h1a}<span className="dk-verlauf">{t.h1b}</span></>}
        lead={t.lead}
        knoepfe={<><Knopf href="#meilensteine">{t.meilensteineKnopf}</Knopf><Knopf href={zu("/team")} still>{t.teamKnopf}</Knopf></>}
      />

      <Block eng>
        <Kennzahlen items={t.zahlen} />
        <p className="dk-leise" style={{ textAlign: "center", marginTop: 14 }}>{t.stand}</p>
      </Block>

      <Licht>
        <Block schmal titel={<>{t.warumH2a}<span className="dk-verlauf">{t.warumH2b}</span></>} lead={t.warumLead}>
          <Auf>
            <p className="dk-text" style={{ fontSize: 16, lineHeight: 1.8 }}>{t.warum1}</p>
            <p className="dk-text" style={{ fontSize: 16, lineHeight: 1.8, marginTop: 14 }}>{t.warum2}</p>
          </Auf>
        </Block>

        <Block id="meilensteine" schmal titel={<>{t.meilH2a}<span className="dk-verlauf">{t.meilH2b}</span></>} lead={t.meilLead}>
          <Auf>
            <div className="sx-zeitleiste">
              {t.meilensteine.map((m, i) => (
                <div key={m.zeit} className="sx-etappe">
                  <div className="spur"><span className="punkt">{i + 1}</span>{i < t.meilensteine.length - 1 && <span className="faden" />}</div>
                  <div className="inhalt"><span className="dauer">{m.zeit}</span><h3>{m.titel}</h3><p>{m.text}</p></div>
                </div>
              ))}
            </div>
          </Auf>
        </Block>
      </Licht>

      <Szenenbild tief src="/kino/kugel.jpg" titel={<>{t.szeneA}<span className="dk-verlauf">{t.szeneB}</span></>} text={t.szeneText} />

      <Licht>
        <Block titel={<>{t.haltungH2a}<span className="dk-verlauf">{t.haltungH2b}</span></>} lead={t.haltungLead}>
          <Karten items={t.haltung} />
        </Block>

        <Block schmal titel={<>{t.sitzH2a}<span className="dk-verlauf">{t.sitzH2b}</span></>} lead={t.sitzLead}>
          <p className="dk-text" style={{ fontSize: 15.5, lineHeight: 1.75 }}>{t.sitzText}</p>
        </Block>

        <Block schmal><Zitat text={t.zitat} wer={t.zitatWer} en={en} /></Block>

        <Block schmal titel={t.fragenTitel}><Fragen items={t.fragen} /></Block>
      </Licht>

      <Block schmal>
        <div className="dk-knoepfe" style={{ justifyContent: "center" }}>
          <Knopf href={zu("/team")}>{t.teamKennenlernen}</Knopf>
          <Knopf href={zu("/fiaon-erfahrungen")} still>{t.soArbeitet}</Knopf>
          <Knopf href={zu("/presse")} still>{t.presse}</Knopf>
        </div>
      </Block>
    </Dunkel>
  );
}
