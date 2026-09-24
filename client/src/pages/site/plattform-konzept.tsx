// ═══════════════════════════════════════════════════════════════════════════
// /plattform-konzept · /en/how-the-platform-works — Die ganze Plattform,
// erklärt (23.08.2026, zweisprachig 02.09.2026)
//
// Justin: „komplett umbauen, neue Sektionen, nützliche Werkzeuge, die Seite
// soll Spaß machen, die gesamte Plattform erklären, hochwertiges Design."
// Aufbau: Bühne → drei Schichten → der Weg (interaktiv, Tag für Tag) →
// Paketfinder → Kundenbereich-Karte → Startgespräch → DACH → Technik &
// Sicherheit → was FIAON nicht ist → Fragen → Abschluss.
// Texte: client/src/i18n/plattform-konzept.ts. Preise nur aus shared/fiaon-pakete.
//
// 24.09.2026 (E-240): „Nur wissen, was drinsteht" ist die Bonitätsauskunft ohne
// Paket — also der Einzelpreis (149 €, auskunft_privat), daneben der
// Kundenpreis mit Paket (74 €), beide aus shared/fiaon-auskunft.ts. Der Knopf
// führt auf /bonitaet-antrag statt auf /antrag?pack=schufa (das Paket kennt
// der Antrag nicht). Der Grund-Satz im Wörterbuch versprach eine Anrechnung auf
// ein späteres Paket, die es nicht gibt — bis das Wörterbuch nachgezogen ist,
// steht der ehrliche Satz hier (AUSKUNFT_GRUND).
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Hero, Block, Licht, Knopf, Auf, Glas, Karten, Kennzahlen, Zeilen, Fragen, Zwischenruf, Abschluss, Szenenbild } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import { PAKETE } from "@shared/fiaon-pakete";
import { AUSKUNFT_PREISE_CENTS, auskunftSchluessel } from "@shared/fiaon-auskunft";
import { GLOBAL_PAKETE, globalPreisText } from "@shared/fiaon-global";
import { globalGespraechPfad, globalPaketePfad } from "@shared/fiaon-global-wege";
import { AGENDA } from "@shared/fiaon-onboarding-agenda";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { PLATTFORM_KONZEPT_WOERTER } from "@/i18n/plattform-konzept";
import "@/styles/plattform-konzept.css";

type Antwort = Record<string, string>;
const AUSKUNFT_EINZELN = auskunftSchluessel("privat", false);
const AUSKUNFT_GRUND = {
  de: (mitPaket: string) => `Nur die Auskunft: Datenkopien aller Auskunfteien Ihres Landes, jede Zeile erklärt, Fristen geprüft, Handlungsplan und fertige Schreiben – einmalig, kein Abo. Mit einem FIAON-Paket kostet sie ${mitPaket}.`,
  en: (mitPaket: string) => `Just the report: data copies from every credit bureau in your country, every line explained, deadlines checked, an action plan and finished letters — one-off, no subscription. With a FIAON plan it costs ${mitPaket}.`,
};
// 17.09.2026 (E-188): Die Business-Abos sind eingestellt. Ein Unternehmen
// bekommt sofort seine Antwort — FIAON Global (Einmalpreis) — und wird nicht
// mehr nach Lage und Tempo gefragt; das sind Fragen der Bonitätslinie.
// Dieselbe Logik wie auf /preise, damit zwei Seiten nie zwei Antworten geben.
function paketFuer(a: Antwort): { key: string; grund: string } | null {
  if (a.wer === "business") return { key: "global", grund: "global" };
  if (!a.wer || !a.lage || !a.tempo) return null;
  if (a.lage === "klar") return { key: AUSKUNFT_EINZELN, grund: "schufa" };
  if (a.lage === "eintrag") return a.tempo === "ruhig" ? { key: "start", grund: "start" } : { key: "pro", grund: "pro_fristen" };
  if (a.lage === "zugang") return { key: "pro", grund: "pro_zugang" };
  return a.tempo === "sofort" ? { key: "highend", grund: "highend" } : { key: "ultra", grund: "ultra" };
}

export default function PlattformKonzept() {
  const t = useWoerter(PLATTFORM_KONZEPT_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/how-the-platform-works" : "/plattform-konzept";
  const euro = (c: number) => en
    ? "€" + (c / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 })
    : (c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 }) + " €";
  const agenda = AGENDA.map((s, i) => t.agenda?.[i] ?? { titel: s.titel, zweck: s.zweck });

  const [schritt, setSchritt] = useState(0);
  const [a, setA] = useState<Antwort>({});
  const vorschlag = useMemo(() => paketFuer(a), [a]);
  const paket = vorschlag ? PAKETE.find((p) => p.key === vorschlag.key) : null;
  const WEG = t.weg;

  return (
    <Dunkel seite="plattform-konzept" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <SeoDaten pfad={pfad} titel={t.metaTitel} beschreibung={t.metaBeschreibung} fragen={t.fragen} krumen={[{ name: t.heroPille, pfad }]} />
      <Hero pille={t.heroPille} titel={<>{t.heroA}<span className="dk-verlauf">{t.heroB}</span></>}
            lead={t.heroLead}
            knoepfe={<><Knopf href="#weg">{t.wegAnsehen}</Knopf><Knopf href="#paketfinder" still>{t.paketfinder}</Knopf></>}
            szene={<Szenenbild src="/kino/hirn.jpg" tief />} />

      <Block id="schichten" pille={t.schichtenPille} titel={<>{t.schichtenA}<span className="dk-verlauf">{t.schichtenB}</span></>} lead={t.schichtenLead}>
        <div className="pk-schichten">
          {t.schichten.map((s, i) => (
            <Auf key={s.nr} verzoegerung={i * 90}><div className="pk-schicht"><span className="pk-nr">{s.nr}</span><h3>{s.titel}</h3><p>{s.text}</p><small>{s.ergebnis}</small></div></Auf>
          ))}
        </div>
      </Block>

      <Licht>
        <Block id="weg" pille={t.wegPille} titel={<>{t.wegA}<span className="dk-verlauf">{t.wegB}</span></>} lead={t.wegLead}>
          <div className="pk-weg">
            <div className="pk-weg-leiste" role="tablist">
              {WEG.map((w, i) => <button key={w.tag} type="button" role="tab" aria-selected={schritt === i} className={`pk-weg-punkt${schritt === i ? " an" : ""}${i < schritt ? " vorbei" : ""}`} onClick={() => setSchritt(i)}><span>{w.tag}</span><b>{w.titel}</b></button>)}
            </div>
            <div className="pk-weg-karte" key={schritt}>
              <small>{WEG[schritt].tag} · {t.imBereich} {WEG[schritt].bereich}</small>
              <h3>{WEG[schritt].titel}</h3>
              <p>{WEG[schritt].text}</p>
              <div className="pk-weg-knoepfe">
                <button type="button" className="dk-knopf still" onClick={() => setSchritt(Math.max(0, schritt - 1))} disabled={schritt === 0}>{t.zurueck}</button>
                <button type="button" className="dk-knopf" onClick={() => setSchritt(Math.min(WEG.length - 1, schritt + 1))} disabled={schritt === WEG.length - 1}>{schritt === WEG.length - 1 ? t.amZiel : t.weiter}</button>
              </div>
            </div>
          </div>
        </Block>

        <Block id="paketfinder" pille={t.finderPille} titel={<>{t.finderA}<span className="dk-verlauf">{t.finderB}</span></>} lead={t.finderLead} mitte>
          <div className="pk-finder">
            {t.finderFragen.filter((f) => a.wer !== "business" || f.key === "wer").map((f, i) => (
              <div key={f.key} className={`pk-frage${a[f.key] ? " beantwortet" : ""}`}>
                <p className="pk-frage-nr">{t.frage} {i + 1}</p><h3>{f.frage}</h3>
                <div className="pk-optionen">{f.optionen.map(([w, l]) => <button key={w} type="button" className={`pk-option${a[f.key] === w ? " an" : ""}`} onClick={() => setA({ ...a, [f.key]: w })}>{l}</button>)}</div>
              </div>
            ))}
            {vorschlag?.key === "global" && (
              <div className="pk-ergebnis">
                <small>{t.vorschlag}</small>
                <h3>{t.globalTitel}</h3>
                <p className="pk-preis">{t.globalAb(globalPreisText(GLOBAL_PAKETE[0].key, sprache))}</p>
                <p>{t.globalText}</p>
                <div className="pk-weg-knoepfe"><Knopf href={globalPaketePfad(sprache)}>{t.zuBusiness}</Knopf><Knopf href={globalGespraechPfad(sprache)} still>{t.globalGespraech}</Knopf></div>
              </div>
            )}
            {paket && vorschlag && (
              <div className="pk-ergebnis">
                <small>{t.vorschlag}</small>
                <h3>{paket.abo ? paket.label : (en ? "Credit report" : "Bonitätsauskunft")}</h3>
                <p className="pk-preis">{paket.abo ? <>{euro(paket.preisCents)} <span>{t.imMonat}</span></> : <>{euro(paket.preisCents)} <span>{t.einmalig}</span></>}</p>
                <p>{paket.abo ? t.gruende[vorschlag.grund] : AUSKUNFT_GRUND[en ? "en" : "de"](euro(AUSKUNFT_PREISE_CENTS.privat.mitAbo))}</p>
                <div className="pk-weg-knoepfe"><Knopf href={paket.abo ? `/antrag?pack=${paket.key}&src=konzept` : "/bonitaet-antrag"}>{paket.abo ? t.mitPaket : (en ? "Order the credit report" : "Bonitätsauskunft bestellen")}</Knopf><Knopf href={zu("/privatkunden")} still>{t.alleVergleichen}</Knopf></div>
              </div>
            )}
          </div>
        </Block>
      </Licht>

      <Block id="bereich" pille={t.bereichPille} titel={<>{t.bereichA}<span className="dk-verlauf">{t.bereichB}</span></>} lead={t.bereichLead}>
        <div className="pk-raeume">{t.bereich.map(([titel, x], i) => <Auf key={titel} verzoegerung={(i % 4) * 60}><div className="pk-raum"><b>{titel}</b><p>{x}</p></div></Auf>)}</div>
        <div className="dk-knoepfe" style={{ marginTop: 28 }}><Knopf href="/demo/kundenbereich">{t.demoAnsehen}</Knopf></div>
      </Block>

      <Licht>
        <Block id="startgespraech" pille={t.gespraechPille} titel={<>{t.gespraechA}<span className="dk-verlauf">{t.gespraechB}</span></>} lead={t.gespraechLead}>
          <ol className="pk-agenda">{agenda.map((s, i) => <li key={s.titel}><span>{i + 1}</span><div><b>{s.titel}</b><p>{s.zweck}</p></div></li>)}</ol>
        </Block>

        <Block pille={t.dachPille} titel={<>{t.dachA}<span className="dk-verlauf">{t.dachB}</span></>} lead={t.dachLead}>
          <Zeilen items={t.dach} />
        </Block>
      </Licht>

      <Block id="technik" pille={t.technikPille} titel={<>{t.technikA}<span className="dk-verlauf">{t.technikB}</span></>} lead={t.technikLead}>
        <Kennzahlen items={t.kennzahlen} />
        <Karten items={t.technik} />
      </Block>

      <Licht>
        <Block pille={t.nichtPille} titel={<>{t.nichtA}<span className="dk-verlauf">{t.nichtB}</span></>} mitte>
          <div className="dk-raster" style={{ textAlign: "left", marginTop: 28 }}>
            {t.nicht.map((n, i) => (
              <Auf key={n.tag} verzoegerung={i * 80}><Glas tag={n.tag} titel={n.titel}>{n.text}</Glas></Auf>
            ))}
          </div>
        </Block>

        <Block schmal pille={t.fragenPille}>
          <Fragen items={t.fragen} />
        </Block>
      </Licht>

      <Zwischenruf text={<><b>{t.zwischenrufFett}</b>{t.zwischenruf}</>} knopf={t.assistentFragen} href={zu("/kontakt") + "#assistent"} still={{ knopf: t.kontaktSupport, href: zu("/kontakt") }} />
      <Abschluss titel={<>{t.abschlussA}<span className="dk-verlauf">{t.abschlussB}</span></>} text={t.abschlussText} knoepfe={<><Knopf href="/antrag">{t.jetztStarten}</Knopf><Knopf href={zu("/privatkunden")} still>{t.paketeAnsehen}</Knopf></>} />
    </Dunkel>
  );
}
