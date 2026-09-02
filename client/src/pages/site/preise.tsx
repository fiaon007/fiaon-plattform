// ═══════════════════════════════════════════════════════════════════════════
// /preise — Preise & Pakete, ehrlich verglichen (23.08.2026; NEUBAU 02.09.2026, E-082)
//
// Justin: „länger, brauchbarer – funktionaler, Werkzeuge – passend, SEO/SEA
// 100 % optimiert." Neu gegenüber der Fassung vom 23.08.:
//   · Hero mit 3D-Karte (KartenSzene) statt Standbild
//   · Paketfinder (drei Fragen → Paket) — dieselbe Logik wie auf
//     /plattform-konzept, damit zwei Seiten nie zwei Antworten geben
//   · Preisrechner „Was kostet mein Fall?": Einträge, Länder, Ziel →
//     Paket + Gesamtpreis über zwölf Raten + Vergleich mit Selbst/Anwalt
//   · Zahlungsweg als Zeitleiste (erste Rate Überweisung, dann SEPA)
//   · Kündigungsregel „monatlich, formlos" (offizielle Geschäftsregel seit
//     02.09.2026 — nicht zurückdrehen)
//   · Leistungstabelle, Business-Stufen bleiben; neue Zeile: neuer Score
// Preise kommen ausschließlich aus shared/fiaon-pakete.ts (eine Quelle).
//
// 02.09.2026 (Zweisprachigkeit, Scheibe 1): dieselbe Seite läuft unter /preise
// (Deutsch) und /en/pricing (Englisch). Alle Texte stehen im Wörterbuch
// client/src/i18n/preise.ts; die Sprache kommt aus der Adresse (useWoerter).
// Die Logik (Paketfinder, Fallrechner) bleibt eine — nur die Worte wechseln.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { PREISE_WOERTER } from "@/i18n/preise";
import { Dunkel, Hero, Block, Licht, Knopf, Auf, Kennzahlen, Fragen, Zwischenruf, Abschluss, Glas } from "@/components/site/DunkleBuehne";
import KartenSzene from "@/components/home3d/KartenSzene";
import SeoDaten from "@/components/site/SeoDaten";
import { PAKETE, SCHUFA_PREIS_EURO } from "@shared/fiaon-pakete";
import "@/styles/preise.css";
import "@/styles/plattform-konzept.css";
import "@/styles/seo-seiten.css";
import "@/styles/ratgeber.css";

// Die Zeilen der Leistungstabelle: welche Spalte was hat. Die Texte kommen aus
// dem Wörterbuch (Reihenfolge = leistungen[]); "s" = zum Selbstversand,
// "v" = FIAON versendet, "t" = ab Schwelle.
const MATRIX: Record<string, boolean | "s" | "v" | "t">[] = [
  { schufa: true, start: true, pro: true, ultra: true, highend: true },
  { schufa: true, start: true, pro: true, ultra: true, highend: true },
  { schufa: true, start: true, pro: true, ultra: true, highend: true },
  { schufa: false, start: true, pro: true, ultra: true, highend: true },
  { schufa: false, start: "s", pro: "v", ultra: "v", highend: "v" },
  { schufa: false, start: false, pro: true, ultra: true, highend: true },
  { schufa: false, start: false, pro: true, ultra: true, highend: true },
  { schufa: false, start: false, pro: true, ultra: true, highend: true },
  { schufa: false, start: false, pro: "t", ultra: true, highend: true },
  { schufa: false, start: true, pro: true, ultra: true, highend: true },
  { schufa: false, start: false, pro: false, ultra: true, highend: true },
  { schufa: false, start: false, pro: false, ultra: false, highend: true },
];
const SPALTEN = ["schufa", "start", "pro", "ultra", "highend"];

// ── Paketfinder — dieselben drei Fragen wie auf /plattform-konzept. ───────────
// Die Logik liefert den Paketschlüssel und den SCHLÜSSEL des Grundes; der
// Text zum Grund steht im Wörterbuch (beide Sprachen).
type Antwort = Record<string, string>;
function paketFuer(a: Antwort): { key: string; grund: string } | null {
  if (!a.wer || !a.lage || !a.tempo) return null;
  if (a.wer === "business") return a.lage === "klar" ? { key: "business_starter", grund: "business_starter" } : a.tempo === "sofort" ? { key: "business_ultra", grund: "business_ultra" } : { key: "business_pro", grund: "business_pro" };
  if (a.lage === "klar") return { key: "schufa", grund: "schufa" };
  if (a.lage === "eintrag") return a.tempo === "ruhig" ? { key: "start", grund: "start" } : { key: "pro", grund: "pro_fristen" };
  if (a.lage === "zugang") return { key: "pro", grund: "pro_zugang" };
  return a.tempo === "sofort" ? { key: "highend", grund: "highend" } : { key: "ultra", grund: "ultra" };
}

export default function Preise() {
  const t = useWoerter(PREISE_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  // Zahlen in der Sprache der Seite: 79,99 € (de) — €79.99 (en).
  const geld = (c: number) => en ? "€" + (c / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 }) : (c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 }) + " €";
  const euro0 = (n: number) => n.toLocaleString(en ? "en-GB" : "de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const schufaPreis = en ? "€" + SCHUFA_PREIS_EURO.toFixed(2) : SCHUFA_PREIS_EURO.toFixed(2).replace(".", ",") + " €";
  const zelle = (w: boolean | "s" | "v" | "t") => w === true ? <span className="pr-ja">✓</span> : w === false ? <span className="pr-nein">–</span> : <span className="pr-text">{w === "s" ? t.selbstversand : w === "v" ? t.fiaonVersendet : t.abSchwelle}</span>;
  const privat = PAKETE.filter((p) => p.art === "privat" && p.abo);
  const business = PAKETE.filter((p) => p.art === "business");
  const pro = PAKETE.find((p) => p.key === "pro")!;

  // Paketfinder
  const [a, setA] = useState<Antwort>({});
  const vorschlag = useMemo(() => paketFuer(a), [a]);
  const paketV = vorschlag ? PAKETE.find((p) => p.key === vorschlag.key) : null;

  // Preisrechner „Was kostet mein Fall?"
  const [eintraege, setEintraege] = useState(2);
  const [laender, setLaender] = useState(1);
  const [ziel, setZiel] = useState<"auskunft" | "konto" | "karte">("konto");
  const [stunden, setStunden] = useState(25);
  const fall = useMemo(() => {
    const key = ziel === "auskunft" ? "schufa" : eintraege >= 4 ? "ultra" : "pro";
    const p = PAKETE.find((x) => x.key === key)!;
    const gesamt = p.abo ? (p.preisCents / 100) * 12 : SCHUFA_PREIS_EURO;
    const anwalt = eintraege * 190 + (laender - 1) * 60;
    const selbstZeit = eintraege * 3 + 4 + (laender - 1) * 2;
    return { p, gesamt, anwalt, selbstZeit, selbstWert: selbstZeit * stunden + eintraege * 11 };
  }, [eintraege, laender, ziel, stunden]);

  return (
    <Dunkel seite="privatkunden" titel={en ? "Pricing & plans" : "Preise & Pakete · FIAON"} beschreibung={en
      ? `FIAON costs ${geld(privat[0].preisCents)} to ${geld(privat[privat.length - 1].preisCents)} a month, twelve instalments, cancellable monthly. Credit report ${schufaPreis} one-off.`
      : `FIAON kostet ${geld(privat[0].preisCents)} bis ${geld(privat[privat.length - 1].preisCents)} im Monat, zwölf Raten, monatlich kündbar. Bonitätsauskunft ${SCHUFA_PREIS_EURO} € einmalig. Alle Pakete, alle Leistungen, keine Sternchen.`}>
      <SeoDaten pfad={en ? "/en/pricing" : "/preise"} titel={t.seoTitel} beschreibung={t.seoBeschreibung} fragen={t.fragen} krumen={[{ name: t.krume, pfad: en ? "/en/pricing" : "/preise" }]} />

      <Hero
        bild="/kino/karte.jpg"
        pille={t.pille}
        titel={<>{t.h1a}<span className="dk-verlauf">{t.h1b}</span></>}
        lead={t.lead}
        knoepfe={<><Knopf href="#finder">{t.knopfFinder}</Knopf><Knopf href="#privat" still>{t.knopfAlle}</Knopf></>}
        szene={<KartenSzene anzahl={1} className="absolute inset-0" />}
      />

      <Block eng>
        <Kennzahlen items={[{ wert: "12", label: t.kz1 }, { wert: en ? "€0" : "0 €", label: t.kz2 }, { wert: en ? `€${SCHUFA_PREIS_EURO}` : `${SCHUFA_PREIS_EURO} €`, label: t.kz3 }, { wert: geld(privat[0].preisCents), label: t.kz4 }]} />
      </Block>

      <Licht>
        <Block id="finder" schmal titel={<>{t.finderH2a}<span className="dk-verlauf">{t.finderH2b}</span></>} lead={t.finderLead}>
          <div className="pk-finder">
            {t.finder.map((f, i) => (
              <div key={f.key} className={`pk-frage${a[f.key] ? " beantwortet" : ""}`}>
                <p className="pk-frage-nr">{t.frage} {i + 1}</p><h3>{f.frage}</h3>
                <div className="pk-optionen">{f.optionen.map(([w, l]) => <button key={w} type="button" className={`pk-option${a[f.key] === w ? " an" : ""}`} onClick={() => setA({ ...a, [f.key]: w })}>{l}</button>)}</div>
              </div>
            ))}
            {paketV && vorschlag && (
              <div className="pk-ergebnis">
                <small>{t.vorschlag}</small>
                <h3>{paketV.label}</h3>
                <p className="pk-preis">{paketV.abo ? <>{geld(paketV.preisCents)} <span>{t.imMonat} · {t.zwoelfRaten} · {geld(paketV.preisCents * 12)} {t.gesamt}</span></> : <>{schufaPreis} <span>{t.einmalig}</span></>}</p>
                <p>{t.gruende[vorschlag.grund]}</p>
                <div className="pk-weg-knoepfe"><Knopf href={paketV.key === "schufa" ? "/antrag?pack=schufa" : paketV.art === "business" ? zu("/business") : `/antrag?pack=${paketV.key}&src=preise`}>{paketV.art === "business" ? t.zurBusiness : t.diesesPaket}</Knopf><Knopf href={zu("/kontakt")} still>{t.lieberReden}</Knopf></div>
              </div>
            )}
          </div>
        </Block>
      </Licht>

      <Block id="privat" pille={t.privatPille} titel={<>{t.privatH2a}<span className="dk-verlauf">{t.privatH2b}</span></>} lead={t.privatLead}>
        <div className="pr-tabelle-huelle">
          <table className="pr-tabelle">
            <thead><tr><th>{t.leistung}</th><th><small>{t.einmaligGross}</small>{t.auskunft}<b>{schufaPreis}</b></th>{privat.map((p) => <th key={p.key} className={p.key === "pro" ? "hervor" : ""}><small>{p.key === "pro" ? t.meistgewaehlt : t.proMonat}</small>{p.label.replace("FIAON ", "").replace(" (Standard)", "")}<b>{geld(p.preisCents)}</b></th>)}</tr></thead>
            <tbody>{t.leistungen.map((l, i) => <tr key={l}><td>{l}</td>{SPALTEN.map((k) => <td key={k} className={k === "pro" ? "hervor" : ""}>{zelle(MATRIX[i][k])}</td>)}</tr>)}</tbody>
            <tfoot><tr><td /><td><a href="/antrag?pack=schufa" className="pr-knopf still">{t.nurAuskunft}</a></td>{privat.map((p) => <td key={p.key} className={p.key === "pro" ? "hervor" : ""}><a href={`/antrag?pack=${p.key}&src=preise`} className={`pr-knopf${p.key === "pro" ? "" : " still"}`}>{t.waehlen}</a></td>)}</tr></tfoot>
          </table>
        </div>
        <p className="dk-leise" style={{ marginTop: 14 }}>{t.preisHinweis}{t.antragHinweis ? ` ${t.antragHinweis}` : ""}</p>
      </Block>

      <Licht>
        <Block id="fall" schmal titel={<>{t.fallH2a}<span className="dk-verlauf">{t.fallH2b}</span></>} lead={t.fallLead}>
          <div className="pr-werkzeug">
            <div className="pr-felder">
              <label><span>{t.eintraege}<b>{eintraege}</b></span><input type="range" min={1} max={8} value={eintraege} onChange={(e) => setEintraege(Number(e.target.value))} /></label>
              <label><span>{t.laender}<b>{laender}</b></span><input type="range" min={1} max={3} value={laender} onChange={(e) => setLaender(Number(e.target.value))} /></label>
              <label><span>{t.stunde}<b>{euro0(stunden)}</b></span><input type="range" min={10} max={120} step={5} value={stunden} onChange={(e) => setStunden(Number(e.target.value))} /></label>
            </div>
            <div className="wz-optionen" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginTop: 12 }}>
              <button type="button" className={`wz-option${ziel === "auskunft" ? " an" : ""}`} onClick={() => setZiel("auskunft")}><b>{t.zielAuskunft}</b></button>
              <button type="button" className={`wz-option${ziel === "konto" ? " an" : ""}`} onClick={() => setZiel("konto")}><b>{t.zielKonto}</b></button>
              <button type="button" className={`wz-option${ziel === "karte" ? " an" : ""}`} onClick={() => setZiel("karte")}><b>{t.zielKarte}</b></button>
            </div>
            <div className="pr-vergleich" style={{ marginTop: 22 }}>
              <div className="pr-spalte hervor">
                <small>{fall.p.label}</small>
                <ul>
                  <li><span>{fall.p.abo ? t.zwoelfRatenA + geld(fall.p.preisCents) : t.einmaligGross}</span><b>{euro0(fall.gesamt)}</b></li>
                  <li><span>{t.auskunftBei(laender)}</span><b>{t.inklusive}</b></li>
                  <li><span>{fall.p.key === "schufa" ? t.schreiben : fall.p.key === "start" ? t.schreibenSelbst : t.schreibenVersand}</span><b>{fall.p.key === "schufa" ? "–" : t.inklusive}</b></li>
                  <li><span>{t.ihreZeit}</span><b>{euro0(stunden)}</b></li>
                  <li className="summe"><span>{t.summeGesamt}</span><b>{euro0(fall.gesamt + stunden)}</b></li>
                </ul>
              </div>
              <div className="pr-spalte">
                <small>{t.selbstOhneAnwalt}</small>
                <ul>
                  <li><span>{t.datenkopie}</span><b>{en ? "€0" : "0 €"}</b></li>
                  <li><span>{t.einschreiben}</span><b>{euro0(eintraege * 11)}</b></li>
                  <li><span>{t.eigeneZeit(fall.selbstZeit)}</span><b>{euro0(fall.selbstZeit * stunden)}</b></li>
                  <li className="summe"><span>{t.summeGesamt}</span><b>{euro0(fall.selbstWert)}</b></li>
                  <li><span>{t.mitAnwalt}</span><b>+ {euro0(fall.anwalt)}</b></li>
                </ul>
              </div>
            </div>
            <p className="dk-leise">{t.richtwerteA}<a href={zu("/werkzeuge")} style={{ color: "#1d4ed8" }}>{t.richtwerteLink}</a>{t.richtwerteB}</p>
          </div>
        </Block>

        <Block schmal titel={<>{t.wegH2a}<span className="dk-verlauf">{t.wegH2b}</span></>} lead={t.wegLead}>
          <Auf>
            <div className="sx-zeitleiste">
              {t.weg.map((e, i) => (
                <div key={e.titel} className="sx-etappe"><div className="spur"><span className="punkt">{i + 1}</span>{i < t.weg.length - 1 && <span className="faden" />}</div><div className="inhalt"><span className="dauer">{e.dauer}</span><h3>{e.titel}</h3><p>{e.text}</p></div></div>
              ))}
            </div>
          </Auf>
        </Block>

        <Block schmal titel={t.weiterlesen}>
          <div className="sx-vertiefen">
            {t.weiter.map((w) => <a key={w.href} href={zu(w.href)}><b>{w.t}</b><span>{w.s}</span></a>)}
          </div>
        </Block>
      </Licht>

      <Block id="business" pille={t.businessPille} titel={<>{t.businessH2a}<span className="dk-verlauf">{t.businessH2b}</span></>} lead={t.businessLead}>
        <div className="pr-business">{business.map((p, i) => <Auf key={p.key} verzoegerung={i * 60}><a href={`/business-antrag?pack=${p.key}`} className="pr-bkarte"><small>{p.label.replace("FIAON ", "")}</small><b>{geld(p.preisCents)}</b><span>{t.imMonatZwoelf}</span></a></Auf>)}</div>
        <div className="dk-knoepfe" style={{ marginTop: 24 }}><Knopf href={zu("/business")}>{t.zurBusiness}</Knopf></div>
      </Block>

      <Licht>
        <Block schmal>
          <Glas ruhig tag={t.ehrlichTag} titel={t.ehrlichTitel}>
            <p className="dk-text" style={{ fontSize: 15, lineHeight: 1.7 }}>{t.ehrlichA}<a href={zu("/werkzeuge/widerspruch")} style={{ color: "#1d4ed8" }}>{t.ehrlichLink1}</a>{t.ehrlichB}<a href={zu("/werkzeuge/selbstauskunft")} style={{ color: "#1d4ed8" }}>{t.ehrlichLink2}</a>{t.ehrlichC}</p>
          </Glas>
        </Block>
        <Block schmal pille={t.fragenPille}><Fragen items={t.fragen} /></Block>
      </Licht>

      <Zwischenruf text={<><b>{t.zwischenrufA}</b>{t.zwischenrufB}</>} knopf={t.paketfinder} href="#finder" still={{ knopf: t.kontakt, href: zu("/kontakt") }} />
      <Abschluss titel={<>{t.abschlussA}<span className="dk-verlauf">{t.abschlussB}</span></>} text={t.abschlussText(geld(privat[0].preisCents))} knoepfe={<><Knopf href={`/antrag?pack=${pro.key}&src=preise`}>{t.mitStarten(pro.label.replace(" (Standard)", ""))}</Knopf><Knopf href="/antrag?pack=schufa" still>{t.nurDieAuskunft}</Knopf></>} />
    </Dunkel>
  );
}
