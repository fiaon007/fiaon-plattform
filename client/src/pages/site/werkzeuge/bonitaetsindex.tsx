// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge/bonitaetsindex · /en/tools/business-credit-index
// Bonitätsindex-Deuter (09.09.2026, E-099) — erstes Werkzeug für Firmenkunden.
// Texte: client/src/i18n/wz-bonitaetsindex.ts
//
// QUELLE (nachschlagbar): Creditreform, Flyer „Wirtschaftsinformationen ·
// Creditreform Bonitätsindex", Dokumentnummer C2001.2024.01, abgerufen am
// 09.09.2026. Daraus stammen ALLE Zahlen dieses Werkzeugs:
//   · Skala 100 bis 500 und 600; je niedriger, desto besser.
//     „Übertragen auf Creditreform gelten der Bonitätsindex 500 und 600 als
//     Ausfall." Bei unklaren Sachverhalten wird kein Index vergeben.
//   · Ausfallwahrscheinlichkeiten (PD) je Klasse, Zeitraum September 2022 zu
//     September 2023: 100–149 → 0,05 %; 150–199 → 0,16 %; 200–249 → 0,30 %;
//     250–299 → 0,97 %; 300–349 → 3,38 %; 350–499 → 11,68 %.
//   · Durchschnitt aller deutschen Unternehmen: 1,43 % (Stand September 2023).
//   · Gewichtung der zwölf Merkmale in Prozent: Zahlungsweise 25,
//     Krediturteil 25, Bilanzbonität 10, Branche 6, Unternehmensentwicklung 5,
//     Auftragslage 5, Umsatz 5, Gezeichnetes Kapital 5, Rechtsform 4,
//     Unternehmensalter 4, Mitarbeiterzahl 4, Umsatz/Mitarbeiter 2 = 100.
//
// WAS DAS WERKZEUG BEWUSST NICHT TUT: Creditreform veröffentlicht die
// Gewichtung, nicht die Formel. Der Deuter ordnet deshalb einen vorhandenen
// Wert ein — er rechnet keinen Index aus und sagt keine Kreditlinie voraus.
// Jede Zahl unten steht so im Flyer; nichts ist interpoliert oder geschätzt.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Zwischenruf, Fragen } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { WZ_BONITAETSINDEX_WOERTER } from "@/i18n/wz-bonitaetsindex";
import "@/styles/ratgeber.css";
import { zahlEingabe } from "@/lib/zahl-eingabe";

/** Zahl aus Eingabe — deutsch wie englisch, EINE Quelle (client/src/lib/zahl-eingabe.ts). */
const zahl = (s: string) => { const n = zahlEingabe(s); return Number.isFinite(n) ? n : 0; };

/** Die veröffentlichten Klassen. `pd` ist die Ausfallwahrscheinlichkeit aus dem Flyer. */
const KLASSEN = [
  { bis: 149, schluessel: "k1" as const, pd: 0.05, ton: "gut" as const },
  { bis: 199, schluessel: "k2" as const, pd: 0.16, ton: "gut" as const },
  { bis: 249, schluessel: "k3" as const, pd: 0.3, ton: "gut" as const },
  { bis: 299, schluessel: "k4" as const, pd: 0.97, ton: "mittel" as const },
  { bis: 349, schluessel: "k5" as const, pd: 3.38, ton: "schwach" as const },
  { bis: 499, schluessel: "k6" as const, pd: 11.68, ton: "schwach" as const },
  { bis: 600, schluessel: "k7" as const, pd: null, ton: "ausfall" as const },
];
const SCHNITT = 1.43;

export default function Bonitaetsindex() {
  const t = useWoerter(WZ_BONITAETSINDEX_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/tools/business-credit-index" : "/werkzeuge/bonitaetsindex";
  const prozent = (n: number) => `${n.toLocaleString(en ? "en-GB" : "de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;

  const [wert, setWert] = useState("");
  const [zahlweise, setZahlweise] = useState<"puenktlich" | "spaet" | "streit" | "">("");

  const e = useMemo(() => {
    const i = Math.round(zahl(wert));
    if (i < 100 || i > 600) return null;
    const k = KLASSEN.find((x) => i <= x.bis)!;
    const deutung = k.ton === "gut" ? t.deutungGut : k.ton === "mittel" ? t.deutungMittel : k.ton === "schwach" ? t.deutungSchwach : t.deutungAusfall;
    const rat = zahlweise === "puenktlich" ? t.ratPuenktlich : zahlweise === "spaet" ? t.ratSpaet : zahlweise === "streit" ? t.ratStreit : "";
    return { i, k, deutung, rat };
  }, [wert, zahlweise, t]);

  const farbe = (ton: string) => (ton === "gut" ? "#047857" : ton === "mittel" ? "#b45309" : "#b91c1c");

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
              <p className="wz-nr">{t.schritt1}</p><h3>{t.frage1}</h3>
              <p className="wz-hinweis">{t.hinweis1}</p>
              <div className="wz-felder">
                <label><span>{t.index}</span><input value={wert} onChange={(ev) => setWert(ev.target.value)} inputMode="numeric" placeholder={t.bspIndex} /></label>
              </div>
            </div>
            <div className="wz-frage">
              <p className="wz-nr">{t.schritt2}</p><h3>{t.frage2}</h3>
              <p className="wz-hinweis">{t.hinweis2}</p>
              <div className="wz-optionen zwei">
                <button type="button" className={`wz-option${zahlweise === "puenktlich" ? " an" : ""}`} onClick={() => setZahlweise("puenktlich")}><b>{t.zahlPuenktlich}</b><small>{t.zahlPuenktlichHinweis}</small></button>
                <button type="button" className={`wz-option${zahlweise === "spaet" ? " an" : ""}`} onClick={() => setZahlweise("spaet")}><b>{t.zahlSpaet}</b><small>{t.zahlSpaetHinweis}</small></button>
                <button type="button" className={`wz-option${zahlweise === "streit" ? " an" : ""}`} onClick={() => setZahlweise("streit")}><b>{t.zahlStreit}</b><small>{t.zahlStreitHinweis}</small></button>
              </div>
            </div>
          </div>

          {e && (
            <div className={`wz-ergebnis${e.k.ton === "gut" ? " gut" : e.k.ton === "ausfall" ? " alarm" : ""}`}>
              <span className="wz-stufe" style={{ background: farbe(e.k.ton) }}>{t[e.k.schluessel]}</span>
              <h3>{t.ergebnisTitel(String(e.i))}</h3>
              <p>{e.deutung}</p>
              {e.k.pd !== null && <p>{t.vergleich(prozent(e.k.pd))}</p>}
              <div className="wz-tabelle-huelle"><table className="wz-tabelle">
                <tbody>
                  <tr><td>{t.klasse}</td><td>{t[e.k.schluessel]}</td></tr>
                  <tr><td>{t.pd}</td><td>{e.k.pd === null ? "—" : prozent(e.k.pd)}</td></tr>
                  <tr><td>{t.schnitt}</td><td>{prozent(SCHNITT)}</td></tr>
                </tbody>
              </table></div>
              {e.rat && <div className="wz-schritt"><small>{t.hebelTitel}</small><p>{e.rat}</p></div>}
              <div className="wz-schritt">
                <small>{t.hebelTitel}</small>
                <p>{t.hebelText}</p>
                <div className="wz-tabelle-huelle"><table className="wz-tabelle">
                  <tbody>{t.hebel.map((h) => <tr key={h.m}><td><b>{h.g}</b> {h.m}</td><td>{h.t}</td></tr>)}</tbody>
                </table></div>
              </div>
              <div className="wz-schritt">
                <small>{t.schritt3}</small>
                <p>{t.schritt3Text}</p>
                <div className="wz-tabelle-huelle"><table className="wz-tabelle">
                  <tbody>{t.schritt3Punkte.map((x) => { const [a, ...rest] = x.split(": "); return <tr key={x}><td>{a}</td><td>{rest.join(": ")}</td></tr>; })}</tbody>
                </table></div>
              </div>
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
