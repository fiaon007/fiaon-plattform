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
//   · Zahlungsweg als Zeitleiste (jede Rate per Überweisung — seit 19.09.2026 ohne Lastschrift, E-194)
//   · Kündigungsregel „monatlich, formlos" (offizielle Geschäftsregel seit
//     02.09.2026 — nicht zurückdrehen)
//   · Leistungstabelle, Business-Stufen bleiben; neue Zeile: neuer Score
// Preise kommen ausschließlich aus shared/fiaon-pakete.ts (eine Quelle).
//
// 17.09.2026 (E-188): Die vier Business-Abos sind eingestellt. Der Abschnitt
// für Unternehmen zeigt FIAON Global — vier EINMALPREISE, Namen und „für wen"
// aus shared/fiaon-global.ts (beide Sprachen), Links aus
// shared/fiaon-global-wege.ts. Der Paketfinder fragt ein Unternehmen nicht mehr
// nach Lage und Tempo (das sind Fragen der Bonitätslinie), sondern zeigt den
// Weg zu FIAON Global.
//
// 02.09.2026 (Zweisprachigkeit, Scheibe 1): dieselbe Seite läuft unter /preise
// (Deutsch) und /en/pricing (Englisch). Alle Texte stehen im Wörterbuch
// client/src/i18n/preise.ts; die Sprache kommt aus der Adresse (useWoerter).
// Die Logik (Paketfinder, Fallrechner) bleibt eine — nur die Worte wechseln.
//
// 24.09.2026 (E-240): Die Bonitätsauskunft ist in KEINEM Paket enthalten.
// Vorher trug jede Paketspalte „Bonitätsauskunft beschafft ✓", der Fallrechner
// zählte sie als „inklusive", und „Nur Auskunft" führte auf /antrag?pack=schufa
// — ein Paket, das der Antrag nicht kennt. Jetzt: Spalte „Auskunft" mit dem
// Einzelpreis, Paketspalten „+ 74 € Kundenpreis", der Fallrechner rechnet sie
// als Zusatz, und jeder Auskunft-Knopf führt auf /bonitaet-antrag. Preise aus
// shared/fiaon-auskunft.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { PREISE_WOERTER } from "@/i18n/preise";
import { Dunkel, Hero, Block, Licht, Knopf, Auf, Kennzahlen, Fragen, Zwischenruf, Abschluss, Glas } from "@/components/site/DunkleBuehne";
import KartenSzene from "@/components/home3d/KartenSzene";
import SeoDaten from "@/components/site/SeoDaten";
import { PAKETE } from "@shared/fiaon-pakete";
import { AUSKUNFT_PREISE_CENTS, auskunftSchluessel, euroText } from "@shared/fiaon-auskunft";
import { GLOBAL_PAKETE, globalPreisText } from "@shared/fiaon-global";
import { globalGespraechPfad, globalPaketePfad, globalStartPfad } from "@shared/fiaon-global-wege";
import "@/styles/preise.css";
import "@/styles/plattform-konzept.css";
import "@/styles/seo-seiten.css";
import "@/styles/ratgeber.css";

// Die Zeilen der Leistungstabelle: welche Spalte was hat. Die Texte kommen aus
// dem Wörterbuch (Reihenfolge = leistungen[]); "s" = zum Selbstversand,
// "v" = FIAON versendet, "t" = ab Schwelle, "z" = zubuchbar zum Kundenpreis
// (die Auskunft ist nicht im Paket), "a" = Schreiben an Auskunfteien zur
// Freigabe (Teil der Auskunft).
type Zelle = boolean | "s" | "v" | "t" | "z" | "a";
const MATRIX: Record<string, Zelle>[] = [
  { schufa: true, start: "z", pro: "z", ultra: "z", highend: "z" },
  { schufa: true, start: true, pro: true, ultra: true, highend: true },
  { schufa: true, start: true, pro: true, ultra: true, highend: true },
  { schufa: false, start: true, pro: true, ultra: true, highend: true },
  { schufa: "a", start: "s", pro: "v", ultra: "v", highend: "v" },
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
// E-240: „Nur wissen, was drinsteht" ist die Auskunft ohne Paket — also der
// Einzelpreis (auskunft_privat), nicht der Kundenpreis „schufa".
type Antwort = Record<string, string>;
const AUSKUNFT_EINZELN = auskunftSchluessel("privat", false);
function paketFuer(a: Antwort): { key: string; grund: string } | null {
  // E-188: Ein Unternehmen bekommt sofort seine Antwort — FIAON Global.
  if (a.wer === "business") return { key: "global", grund: "global" };
  if (!a.wer || !a.lage || !a.tempo) return null;
  if (a.lage === "klar") return { key: AUSKUNFT_EINZELN, grund: "schufa" };
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
  // E-240: zwei Preise der Auskunft — einzeln und mit laufendem Paket (Kundenpreis).
  const euroKurz = (c: number) => en ? "€" + (c / 100).toLocaleString("en-GB") : euroText(c);
  const auskunftEinzeln = euroKurz(AUSKUNFT_PREISE_CENTS.privat.einzeln);
  const auskunftMitPaket = euroKurz(AUSKUNFT_PREISE_CENTS.privat.mitAbo);
  const zelle = (w: Zelle) => w === true ? <span className="pr-ja">✓</span> : w === false ? <span className="pr-nein">–</span> : <span className="pr-text">{w === "s" ? t.selbstversand : w === "v" ? t.fiaonVersendet : w === "a" ? t.anAuskunfteien : w === "z" ? t.zubuchbar(auskunftMitPaket) : t.abSchwelle}</span>;
  const privat = PAKETE.filter((p) => p.art === "privat" && p.abo && !p.eingestellt);
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
    const key = ziel === "auskunft" ? AUSKUNFT_EINZELN : eintraege >= 4 ? "ultra" : "pro";
    const p = PAKETE.find((x) => x.key === key)!;
    // E-240: Mit Paket kommt die Auskunft zum Kundenpreis dazu — sie ist nicht enthalten.
    const auskunftCents = p.abo ? AUSKUNFT_PREISE_CENTS.privat.mitAbo : 0;
    const raten = p.abo ? (p.preisCents / 100) * 12 : p.preisCents / 100;
    const gesamt = raten + auskunftCents / 100;
    const anwalt = eintraege * 190 + (laender - 1) * 60;
    const selbstZeit = eintraege * 3 + 4 + (laender - 1) * 2;
    return { p, raten, gesamt, auskunftCents, anwalt, selbstZeit, selbstWert: selbstZeit * stunden + eintraege * 11 };
  }, [eintraege, laender, ziel, stunden]);

  return (
    <Dunkel seite="privatkunden" titel={en ? "Pricing & plans" : "Preise & Pakete · FIAON"} beschreibung={en
      ? `FIAON costs ${geld(privat[0].preisCents)} to ${geld(privat[privat.length - 1].preisCents)} a month, twelve instalments, cancellable monthly thereafter. Credit report ${auskunftEinzeln} one-off, ${auskunftMitPaket} with a plan.`
      : `FIAON kostet ${geld(privat[0].preisCents)} bis ${geld(privat[privat.length - 1].preisCents)} im Monat, zwölf Raten, danach monatlich kündbar. Bonitätsauskunft ${auskunftEinzeln} einmalig, mit Paket ${auskunftMitPaket}. Alle Pakete, alle Leistungen, keine Sternchen.`}>
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
        <Kennzahlen items={[{ wert: "12", label: t.kz1 }, { wert: en ? "€0" : "0 €", label: t.kz2 }, { wert: auskunftEinzeln, label: t.kz3(auskunftMitPaket) }, { wert: geld(privat[0].preisCents), label: t.kz4 }]} />
      </Block>

      <Licht>
        <Block id="finder" schmal titel={<>{t.finderH2a}<span className="dk-verlauf">{t.finderH2b}</span></>} lead={t.finderLead}>
          <div className="pk-finder">
            {t.finder.filter((f) => a.wer !== "business" || f.key === "wer").map((f, i) => (
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
                <div className="pk-weg-knoepfe"><Knopf href={globalPaketePfad(sprache)}>{t.zurBusiness}</Knopf><Knopf href={globalGespraechPfad(sprache)} still>{t.globalGespraech}</Knopf></div>
              </div>
            )}
            {paketV && vorschlag && (
              <div className="pk-ergebnis">
                <small>{t.vorschlag}</small>
                <h3>{paketV.abo ? paketV.label : t.auskunftTitel}</h3>
                <p className="pk-preis">{paketV.abo ? <>{geld(paketV.preisCents)} <span>{t.imMonat} · {t.zwoelfRaten} · {geld(paketV.preisCents * 12)} {t.gesamt}</span></> : <>{auskunftEinzeln} <span>{t.einmalig} · {t.mitPaket(auskunftMitPaket)}</span></>}</p>
                <p>{t.gruende[vorschlag.grund]}</p>
                <div className="pk-weg-knoepfe"><Knopf href={paketV.abo ? `/antrag?pack=${paketV.key}&src=preise` : "/bonitaet-antrag"}>{paketV.abo ? t.diesesPaket : t.auskunftBestellen}</Knopf><Knopf href={zu("/kontakt")} still>{t.lieberReden}</Knopf></div>
              </div>
            )}
          </div>
        </Block>
      </Licht>

      <Block id="privat" pille={t.privatPille} titel={<>{t.privatH2a}<span className="dk-verlauf">{t.privatH2b}</span></>} lead={t.privatLead}>
        <div className="pr-tabelle-huelle">
          <table className="pr-tabelle">
            <thead><tr><th>{t.leistung}</th><th><small>{t.einmaligGross}</small>{t.auskunft}<b>{auskunftEinzeln}</b><small style={{ marginTop: 6, marginBottom: 0 }}>{t.mitPaket(auskunftMitPaket)}</small></th>{privat.map((p) => <th key={p.key} className={p.key === "pro" ? "hervor" : ""}><small>{p.key === "pro" ? t.meistgewaehlt : t.proMonat}</small>{p.label.replace("FIAON ", "").replace(" (Standard)", "")}<b>{geld(p.preisCents)}</b></th>)}</tr></thead>
            <tbody>{t.leistungen.map((l, i) => <tr key={l}><td>{l}</td>{SPALTEN.map((k) => <td key={k} className={k === "pro" ? "hervor" : ""}>{zelle(MATRIX[i][k])}</td>)}</tr>)}</tbody>
            <tfoot><tr><td /><td><a href="/bonitaet-antrag" className="pr-knopf still">{t.nurAuskunft}</a></td>{privat.map((p) => <td key={p.key} className={p.key === "pro" ? "hervor" : ""}><a href={`/antrag?pack=${p.key}&src=preise`} className={`pr-knopf${p.key === "pro" ? "" : " still"}`}>{t.waehlen}</a></td>)}</tr></tfoot>
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
                  <li><span>{fall.p.abo ? t.zwoelfRatenA + geld(fall.p.preisCents) : t.einmaligGross}</span><b>{euro0(fall.raten)}</b></li>
                  <li><span>{fall.p.abo ? t.auskunftMitPaket : t.auskunftBei(laender)}</span><b>{fall.p.abo ? euro0(fall.auskunftCents / 100) : t.inklusive}</b></li>
                  <li><span>{!fall.p.abo ? t.schreibenAuskunft : fall.p.key === "start" ? t.schreibenSelbst : t.schreibenVersand}</span><b>{t.inklusive}</b></li>
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
        <div className="pr-business">{GLOBAL_PAKETE.map((g, i) => <Auf key={g.key} verzoegerung={i * 60}><a href={globalStartPfad(g.key, sprache)} className="pr-bkarte"><small>{g[sprache].name}</small><b>{globalPreisText(g.key, sprache)}</b><span>{t.globalEinmalig}</span><span>{g[sprache].fuer}</span></a></Auf>)}</div>
        <p className="dk-leise" style={{ marginTop: 18, maxWidth: "78ch" }}>{t.globalKosten}</p>
        <div className="dk-knoepfe" style={{ marginTop: 24 }}><Knopf href={globalPaketePfad(sprache)}>{t.zurBusiness}</Knopf><Knopf href={globalGespraechPfad(sprache)} still>{t.globalGespraech}</Knopf></div>
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
      <Abschluss titel={<>{t.abschlussA}<span className="dk-verlauf">{t.abschlussB}</span></>} text={t.abschlussText(geld(privat[0].preisCents))} knoepfe={<><Knopf href={`/antrag?pack=${pro.key}&src=preise`}>{t.mitStarten(pro.label.replace(" (Standard)", ""))}</Knopf><Knopf href="/bonitaet-antrag" still>{t.nurDieAuskunft}</Knopf></>} />
    </Dunkel>
  );
}
