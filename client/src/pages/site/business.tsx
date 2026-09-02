// ═══════════════════════════════════════════════════════════════════════════
// /business — Geschäftskunden (Neubau 23.08.2026)
//
// Justin: „HIGH END VIP Design, auf Kreditkarten bzw. Liquidität pitchen,
// cinematisch (Higgsfield), passende Werkzeuge, einladend, spannend."
// Aufbau: Film-Bühne → Kennzahlen → Liquidität ist Zeit → Zahlungsziel-
// Rechner → Pakete → Limit-Bedarf-Rechner → der Weg → für wen → Bonität des
// Unternehmens → Fragen → Abschluss. Preise aus dem Paketkatalog, Zielrahmen
// wie im Business-Antrag. Sie-Form, „Mitarbeiter", keine Zusagen.
// ═══════════════════════════════════════════════════════════════════════════
// 02.09.2026: zweisprachig — /business (Deutsch) und /en/business (Englisch);
// Texte im Wörterbuch client/src/i18n/business.ts, Sprache aus der Adresse.
import { useMemo, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Auf, Glas, Kennzahlen, Schritte, Fragen, Zwischenruf, Abschluss } from "@/components/site/DunkleBuehne";
import { PAKETE } from "@shared/fiaon-pakete";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { BUSINESS_WOERTER } from "@/i18n/business";
import "@/styles/business.css";

const z = (s: string) => { const n = parseFloat(String(s).replace(/\./g, "").replace(",", ".")); return isFinite(n) && n >= 0 ? n : 0; };

// Die Pakete: Schlüssel, Name, Zielrahmen, Ton — die Texte stehen im Wörterbuch.
const PAKETE_B = [
  { key: "business_starter", name: "Business Starter", rahmen: 5000, ton: "silber" },
  { key: "business_pro", name: "Business Pro", rahmen: 25000, ton: "gold", empfohlen: true },
  { key: "business_ultra", name: "Business Ultra", rahmen: 75000, ton: "navy" },
  { key: "business_enterprise", name: "Business Enterprise", rahmen: 250000, ton: "schwarz" },
];

export default function Business() {
  const t = useWoerter(BUSINESS_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const euro0 = (n: number) => n.toLocaleString(en ? "en-GB" : "de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const preis = (key: string) => { const p = PAKETE.find((x) => x.key === key); if (!p) return ""; return en ? "€" + (p.preisCents / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 }) : (p.preisCents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 }) + " €"; };
  // Werkzeug 1: Zahlungsziel-Rechner
  const [ausgaben, setAusgaben] = useState("");
  const [anteil, setAnteil] = useState(70);
  const liq = useMemo(() => { const a = z(ausgaben); if (!a) return null; const ueberKarte = a * anteil / 100; const tage = 45; const frei = ueberKarte * tage / 30; return { ueberKarte, tage, frei, jahr: frei }; }, [ausgaben, anteil]);
  // Werkzeug 2: Limit-Bedarf
  const [k, setK] = useState<Record<string, string>>({});
  const bedarf = useMemo(() => {
    const summe = ["werbung", "software", "reisen", "einkauf", "sonst"].reduce((s, key) => s + z(k[key] || ""), 0); if (!summe) return null;
    const rahmen = Math.ceil(summe * 2 / 500) * 500;
    const paket = PAKETE_B.find((p) => p.rahmen >= rahmen) || PAKETE_B[3];
    return { summe, rahmen, paket };
  }, [k]);
  // Die Kostenfrage trägt die echten Preise aus dem Katalog.
  const fragen = t.fragen.map((f, i) => i === 2 ? { f: f.f, a: t.kostenAntwort(preis("business_starter"), preis("business_enterprise")) } : f);

  return (
    <Dunkel seite="business" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <section className="bz-hero">
        <video className="bz-film" autoPlay muted loop playsInline poster="/kino/business.jpg" aria-hidden="true"><source src="/kino/business.mp4" type="video/mp4" /></video>
        <div className="bz-schleier" />
        <div className="dk-rahmen bz-hero-inhalt">
          <Auf>
            <span className="dk-pille">{t.pille}</span>
            <h1 className="dk-h1">{t.h1a}<span className="dk-verlauf">{t.h1b}</span></h1>
            <p className="dk-lead">{t.lead}</p>
            <div className="dk-knoepfe"><Knopf href="/business-antrag">{t.firmenkarte}</Knopf><Knopf href="#zahlungsziel" still>{t.wasBringt}</Knopf></div>
          </Auf>
        </div>
      </section>

      <section className="dk-block" style={{ paddingTop: 20 }}>
        <div className="dk-rahmen"><Kennzahlen items={t.zahlen} /></div>
      </section>

      <Block pille={t.warumPille} titel={<>{t.warumH2a}<span className="dk-verlauf">{t.warumH2b}</span></>} lead={t.warumLead}>
        <div className="dk-raster" style={{ marginTop: 36 }}>
          {t.warum.map((w, i) => <Auf key={w.tag} verzoegerung={i * 80}><Glas tag={w.tag} titel={w.titel}>{w.text}</Glas></Auf>)}
        </div>
      </Block>

      <Licht>
        <Block id="zahlungsziel" pille={t.zielPille} titel={<>{t.zielH2a}<span className="dk-verlauf">{t.zielH2b}</span></>} lead={t.zielLead} mitte>
          <div className="bz-werkzeug">
            <div className="bz-felder">
              <label><span>{t.ausgaben}</span><input inputMode="decimal" placeholder={t.ausgabenPlatz} value={ausgaben} onChange={(e) => setAusgaben(e.target.value)} /></label>
              <label><span>{t.anteil}<b>{anteil} %</b></span><input type="range" min={10} max={100} step={5} value={anteil} onChange={(e) => setAnteil(Number(e.target.value))} /><small>{t.anteilHinweis}</small></label>
            </div>
            {liq && (
              <div className="bz-ergebnis">
                <small>{t.ergebnis}</small>
                <h3>{t.liqTitel(euro0(liq.frei))}</h3>
                <p>{t.liqText(euro0(liq.ueberKarte), liq.tage, euro0(liq.frei))}</p>
                <div className="bz-zeile"><span>{t.rahmenZeile}</span><b>{euro0(Math.ceil(liq.ueberKarte * 2 / 500) * 500)}</b></div>
                <div className="dk-knoepfe" style={{ marginTop: 20 }}><Knopf href="#pakete">{t.passendesPaket}</Knopf><Knopf href="/business-antrag" still>{t.direktVorbereiten}</Knopf></div>
              </div>
            )}
          </div>
        </Block>
      </Licht>

      <Block id="pakete" pille={t.paketePille} titel={<>{t.paketeH2a}<span className="dk-verlauf">{t.paketeH2b}</span></>} lead={t.paketeLead}>
        <div className="bz-pakete">
          {PAKETE_B.map((p, i) => {
            const w = t.pakete[p.key];
            return (
              <Auf key={p.key} verzoegerung={i * 70}>
                <a href={`/business-antrag?pack=${p.key}`} className={`bz-paket ${p.ton}${p.empfohlen ? " empfohlen" : ""}`}>
                  <div className="bz-karte"><span>FIAON</span><b>{p.name}</b><small>{t.zielrahmenBis}{euro0(p.rahmen)}</small></div>
                  <div className="bz-paket-text">
                    <p className="bz-preis">{preis(p.key)} <span>{t.imMonat}</span></p>
                    <p className="bz-fuer">{w.fuer}</p>
                    <ul>{w.punkte.map((x) => <li key={x}>{x}</li>)}</ul>
                    <span className="bz-paket-knopf">{p.empfohlen ? t.empfohlenStarten : t.paketWaehlen}</span>
                  </div>
                </a>
              </Auf>
            );
          })}
        </div>
        {t.antragHinweis && <p className="dk-leise" style={{ marginTop: 18 }}>{t.antragHinweis}</p>}
      </Block>

      <Licht>
        <Block id="limit" pille={t.limitPille} titel={<>{t.limitH2a}<span className="dk-verlauf">{t.limitH2b}</span></>} lead={t.limitLead} mitte>
          <div className="bz-werkzeug">
            <div className="bz-felder zwei">
              {t.felder.map(([key, l]) => <label key={key}><span>{l}</span><input inputMode="decimal" placeholder={t.proMonatPlatz} value={k[key] || ""} onChange={(e) => setK({ ...k, [key]: e.target.value })} /></label>)}
            </div>
            {bedarf && (
              <div className="bz-ergebnis">
                <small>{t.ergebnis}</small>
                <h3>{t.bedarfTitel(euro0(bedarf.rahmen), bedarf.paket.name)}</h3>
                <p>{t.bedarfText(euro0(bedarf.summe), bedarf.paket.name, euro0(bedarf.paket.rahmen), preis(bedarf.paket.key))}</p>
                <div className="dk-knoepfe" style={{ marginTop: 20 }}><Knopf href={`/business-antrag?pack=${bedarf.paket.key}`}>{t.vorbereiten(bedarf.paket.name)}</Knopf><Knopf href={zu("/kontakt")} still>{t.zuerstSprechen}</Knopf></div>
              </div>
            )}
          </div>
        </Block>

        <Block pille={t.wegPille} titel={<>{t.wegH2a}<span className="dk-verlauf">{t.wegH2b}</span></>}>
          <Schritte items={t.weg} />
        </Block>
      </Licht>

      <Block pille={t.fuerPille} titel={<>{t.fuerH2a}<span className="dk-verlauf">{t.fuerH2b}</span></>}>
        <div className="dk-raster" style={{ marginTop: 36 }}>
          {t.fuer.map((w, i) => <Auf key={w.tag} verzoegerung={i * 80}><Glas tag={w.tag} titel={w.titel}>{w.text}</Glas></Auf>)}
        </div>
      </Block>

      <Licht>
        <Block schmal pille={t.fragenPille}>
          <Fragen items={fragen} />
        </Block>
      </Licht>

      <Zwischenruf text={<><b>{t.zwischenrufA}</b>{t.zwischenrufB}</>} knopf={t.termin} href={zu("/kontakt")} still={{ knopf: t.assistent, href: zu("/kontakt") + "#assistent" }} />
      <Abschluss titel={<>{t.abschlussA}<span className="dk-verlauf">{t.abschlussB}</span></>} text={t.abschlussText} knoepfe={<><Knopf href="/business-antrag">{t.firmenkarte}</Knopf><Knopf href="#pakete" still>{t.paketeAnsehen}</Knopf></>} />
    </Dunkel>
  );
}
