// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge/firmenkarte · /en/tools/business-card-check
// Firmenkarten-Check (09.09.2026, E-099). Texte: client/src/i18n/wz-firmenkarte.ts
//
// WAS DIESER CHECK IST: eine Vorbereitungsliste. Er zählt, welche der
// üblicherweise verlangten Unterlagen fehlt, und ordnet die Lücken nach dem
// Aufwand, sie zu schließen.
// WAS ER NICHT IST: eine Bewilligungsprognose. Über Karte und Rahmen
// entscheidet das Kartenunternehmen nach eigenen Regeln. Deshalb gibt es hier
// bewusst KEINE Punktzahl und KEINE Prozentangabe — eine Zahl würde eine
// Genauigkeit vortäuschen, die niemand hat.
//
// BELEGE: § 325 HGB (Offenlegung binnen eines Jahres an das
// Unternehmensregister, vier Monate bei § 264d), § 335 HGB (Ordnungsgeld),
// § 31 Abs. 2 BDSG (Meldevoraussetzungen), Creditreform-Gewichtung
// (Unternehmensalter 4 %, Bilanzbonität 10 %).
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Zwischenruf, Fragen } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { WZ_FIRMENKARTE_WOERTER } from "@/i18n/wz-firmenkarte";
import "@/styles/ratgeber.css";

type Recht = "einzel" | "personen" | "kapital" | "";
type Alter = "jung" | "mittel" | "alt" | "";
type Abschluss = "ja" | "spaet" | "keine" | "";
type Konto = "neu" | "mittel" | "lang" | "";
type Eintrag = "keine" | "erledigt" | "offen" | "unbekannt" | "";
type Index = "gut" | "mittel" | "schwach" | "unbekannt" | "";

export default function Firmenkarte() {
  const t = useWoerter(WZ_FIRMENKARTE_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/tools/business-card-check" : "/werkzeuge/firmenkarte";

  const [recht, setRecht] = useState<Recht>("");
  const [alter, setAlter] = useState<Alter>("");
  const [abschluss, setAbschluss] = useState<Abschluss>("");
  const [konto, setKonto] = useState<Konto>("");
  const [eintrag, setEintrag] = useState<Eintrag>("");
  const [index, setIndex] = useState<Index>("");

  const e = useMemo(() => {
    if (!recht || !alter || !abschluss || !konto || !eintrag || !index) return null;
    // Reihenfolge = Aufwand. Was nichts kostet, steht oben.
    const luecken: { t: string; x: string }[] = [];
    if (eintrag === "unbekannt" || index === "unbekannt") luecken.push(t.lueckeUnbekannt);
    if (eintrag === "offen") luecken.push(t.lueckeOffen);
    if (abschluss === "spaet") luecken.push(t.lueckeAbschluss);
    if (index === "schwach") luecken.push(t.lueckeIndex);
    if (konto === "neu") luecken.push(t.lueckeKonto);
    if (alter === "jung") luecken.push(t.lueckeJung);
    if (recht === "einzel") luecken.push(t.lueckeEinzel);
    const stufe = luecken.length === 0 ? "bereit" : luecken.length <= 2 ? "fast" : "luecken";
    return { luecken, stufe };
  }, [recht, alter, abschluss, konto, eintrag, index, t]);

  const w = (an: boolean) => `wz-option${an ? " an" : ""}`;

  return (
    <Dunkel seite="ratgeber" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <SeoDaten pfad={pfad} titel={t.seoTitel} beschreibung={t.seoBeschreibung} fragen={t.fragen} werkzeug={{ name: t.werkzeugName }} krumen={[{ name: t.krumeWerkzeuge, pfad: zu("/werkzeuge") }, { name: t.krume, pfad }]} />
      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/hero.jpg" alt="" decoding="async" /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">{t.pille}</span>
          <h1 className="dk-h1">{t.h1a}<span className="dk-verlauf">{t.h1b}</span></h1>
          <p className="dk-lead">{t.lead}</p>
        </div>
      </section>

      <Licht>
        <Block schmal>
          <div className="wz-fragen">
            <div className="wz-frage">
              <p className="wz-nr">{t.schritt1}</p><h3>{t.frageRecht}</h3>
              <div className="wz-optionen zwei">
                <button type="button" className={w(recht === "einzel")} onClick={() => setRecht("einzel")}><b>{t.rEinzel}</b><small>{t.rEinzelHinweis}</small></button>
                <button type="button" className={w(recht === "personen")} onClick={() => setRecht("personen")}><b>{t.rPersonen}</b><small>{t.rPersonenHinweis}</small></button>
                <button type="button" className={w(recht === "kapital")} onClick={() => setRecht("kapital")}><b>{t.rKapital}</b><small>{t.rKapitalHinweis}</small></button>
              </div>
            </div>

            <div className="wz-frage">
              <p className="wz-nr">{t.schritt2}</p><h3>{t.frageAlter}</h3>
              <div className="wz-optionen zwei">
                <button type="button" className={w(alter === "jung")} onClick={() => setAlter("jung")}><b>{t.aJung}</b></button>
                <button type="button" className={w(alter === "mittel")} onClick={() => setAlter("mittel")}><b>{t.aMittel}</b></button>
                <button type="button" className={w(alter === "alt")} onClick={() => setAlter("alt")}><b>{t.aAlt}</b></button>
              </div>
            </div>

            <div className="wz-frage">
              <p className="wz-nr">{t.schritt3}</p><h3>{t.frageAbschluss}</h3>
              <p className="wz-hinweis">{t.hinweisAbschluss}</p>
              <div className="wz-optionen zwei">
                <button type="button" className={w(abschluss === "ja")} onClick={() => setAbschluss("ja")}><b>{t.abJa}</b></button>
                <button type="button" className={w(abschluss === "spaet")} onClick={() => setAbschluss("spaet")}><b>{t.abSpaet}</b></button>
                <button type="button" className={w(abschluss === "keine")} onClick={() => setAbschluss("keine")}><b>{t.abKeine}</b></button>
              </div>
            </div>

            <div className="wz-frage">
              <p className="wz-nr">{t.schritt4}</p><h3>{t.frageKonto}</h3>
              <p className="wz-hinweis">{t.hinweisKonto}</p>
              <div className="wz-optionen zwei">
                <button type="button" className={w(konto === "neu")} onClick={() => setKonto("neu")}><b>{t.kNeu}</b></button>
                <button type="button" className={w(konto === "mittel")} onClick={() => setKonto("mittel")}><b>{t.kMittel}</b></button>
                <button type="button" className={w(konto === "lang")} onClick={() => setKonto("lang")}><b>{t.kLang}</b></button>
              </div>
            </div>

            <div className="wz-frage">
              <p className="wz-nr">{t.schritt5}</p><h3>{t.frageEintrag}</h3>
              <div className="wz-optionen zwei">
                <button type="button" className={w(eintrag === "keine")} onClick={() => setEintrag("keine")}><b>{t.eKeine}</b></button>
                <button type="button" className={w(eintrag === "erledigt")} onClick={() => setEintrag("erledigt")}><b>{t.eErledigt}</b></button>
                <button type="button" className={w(eintrag === "offen")} onClick={() => setEintrag("offen")}><b>{t.eOffen}</b></button>
                <button type="button" className={w(eintrag === "unbekannt")} onClick={() => setEintrag("unbekannt")}><b>{t.eUnbekannt}</b></button>
              </div>
            </div>

            <div className="wz-frage">
              <p className="wz-nr">{t.schritt6}</p><h3>{t.frageIndex}</h3>
              <div className="wz-optionen zwei">
                <button type="button" className={w(index === "gut")} onClick={() => setIndex("gut")}><b>{t.iGut}</b></button>
                <button type="button" className={w(index === "mittel")} onClick={() => setIndex("mittel")}><b>{t.iMittel}</b></button>
                <button type="button" className={w(index === "schwach")} onClick={() => setIndex("schwach")}><b>{t.iSchwach}</b></button>
                <button type="button" className={w(index === "unbekannt")} onClick={() => setIndex("unbekannt")}><b>{t.iUnbekannt}</b></button>
              </div>
            </div>
          </div>

          {e && (
            <div className={`wz-ergebnis${e.stufe === "bereit" ? " gut" : ""}`}>
              <span className="wz-stufe" style={{ background: e.stufe === "bereit" ? "#047857" : e.stufe === "fast" ? "#b45309" : "#b91c1c" }}>
                {e.stufe === "bereit" ? t.stufeBereit : e.stufe === "fast" ? t.stufeFast : t.stufeLuecken}
              </span>
              <h3>{t.ergebnisTitel(e.luecken.length)}</h3>
              <p>{e.luecken.length === 0 ? t.einleitungBereit : t.einleitungLuecken}</p>
              {e.luecken.map((l, i) => (
                <div className="wz-schritt" key={l.t}><small>{i + 1}</small><p><b>{l.t}.</b> {l.x}</p></div>
              ))}
              <div className="wz-schritt"><small>{t.reihenfolge}</small><p>{t.reihenfolgeText}</p></div>
              <div className="wz-schritt"><small>{t.anfragen}</small><p>{t.anfragenText}</p></div>
              <div className="wz-knoepfe">
                <Knopf href={zu("/werkzeuge/firmenauskunft")} still>{t.weiterLink}</Knopf>
              </div>
              <div className="wz-schritt"><small>{t.grenze}</small><p>{t.grenzeText}</p></div>
              <div className="wz-schritt"><small>{t.standTitel}</small><p>{t.stand}</p></div>
            </div>
          )}
          <p className="dk-leise" style={{ marginTop: 18 }}>{t.fuss}</p>
        </Block>
      </Licht>

      <Block schmal titel={t.fragenTitel}><Fragen items={t.fragen} /></Block>
      <Zwischenruf text={<><b>{t.zwischenrufFett}</b>{t.zwischenruf}</>} knopf={t.zwischenrufKnopf} href={zu("/business")} still={{ knopf: t.weiterLink, href: zu("/werkzeuge/firmenauskunft") }} />
    </Dunkel>
  );
}
