// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge/kartenkosten · /en/tools/card-costs — Kartenkosten-Vergleich:
// Kaution, Prepaid, Debit (02.09.2026, E-080; zweisprachig 03.09.2026,
// Texte: client/src/i18n/wz-kartenkosten.ts)
//
// Wer trotz Eintrag eine Karte will, bekommt drei Angebote vorgelegt, die
// sich nicht vergleichen lassen: eine Kreditkarte mit Sicherheitsleistung
// (Kaution, Jahresgebühr, das Geld liegt fest), eine Prepaid-Karte (Jahres-
// gebühr, Aufladegebühr, Bargeldgebühr) und die Debitkarte zum Girokonto
// (Kontoführung, meist keine Aufladung). Der Rechner legt alle drei auf
// drei Jahre um – inklusive der Opportunitätskosten der Kaution – und sagt,
// welche Karte was leistet (Hotel/Mietwagen, Rahmen, Bonitätsaufbau).
//
// Keine Anbieternamen, keine Vermittlung: FIAON bekommt für keine Karte
// Provision auf dieser Seite. Der Nutzer trägt die Zahlen aus seinen
// Angeboten ein; die Vorbelegungen sind marktübliche Größenordnungen.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Zwischenruf, Fragen } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { WZ_KARTENKOSTEN_WOERTER } from "@/i18n/wz-kartenkosten";
import "@/styles/ratgeber.css";
import { zahlEingabe } from "@/lib/zahl-eingabe";

/** Zahl aus Eingabe — deutsch wie englisch, EINE Quelle (client/src/lib/zahl-eingabe.ts). */
const zahl = (s: string) => { const n = zahlEingabe(s); return Number.isFinite(n) ? n : 0; };
const JAHRE = 3;

export default function Kartenkosten() {
  const t = useWoerter(WZ_KARTENKOSTEN_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/tools/card-costs" : "/werkzeuge/kartenkosten";
  const eur = (n: number) => n.toLocaleString(en ? "en-GB" : "de-DE", { style: "currency", currency: "EUR" });
  const [k, setK] = useState<Record<string, string>>(() => ({ ...t.vorgaben }));
  const set = (f: string) => (ev: React.ChangeEvent<HTMLInputElement>) => setK({ ...k, [f]: ev.target.value });
  const [bedarf, setBedarf] = useState<"alltag" | "reise" | "aufbau" | "">("");

  const e = useMemo(() => {
    const kaution = zahl(k.kaution), kg = zahl(k.kautionGebuehr), kz = zahl(k.kautionZins);
    const pg = zahl(k.prepaidGebuehr), pa = zahl(k.prepaidAuflade), n = zahl(k.aufladungen), pb = zahl(k.prepaidBargeld), b = zahl(k.bargeld), dk = zahl(k.debitKonto);
    const kautionKosten = JAHRE * (kg + kaution * kz / 100);
    const prepaidKosten = JAHRE * (pg + pa * n + pb * b);
    const debitKosten = JAHRE * 12 * dk;
    return { kautionKosten, prepaidKosten, debitKosten, kaution };
  }, [k]);

  const empfehlung = bedarf === "reise" ? t.empfReise : bedarf === "aufbau" ? t.empfAufbau : bedarf === "alltag" ? t.empfAlltag : "";

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
              <div className="wz-optionen" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                <button type="button" className={`wz-option${bedarf === "alltag" ? " an" : ""}`} onClick={() => setBedarf("alltag")}><b>{t.alltag}</b></button>
                <button type="button" className={`wz-option${bedarf === "reise" ? " an" : ""}`} onClick={() => setBedarf("reise")}><b>{t.reise}</b></button>
                <button type="button" className={`wz-option${bedarf === "aufbau" ? " an" : ""}`} onClick={() => setBedarf("aufbau")}><b>{t.aufbau}</b></button>
              </div>
              {empfehlung && <div className="wz-schritt" style={{ marginTop: 14 }}><small>{t.einordnung}</small><p>{empfehlung}</p></div>}
            </div>
            <div className="wz-frage">
              <p className="wz-nr">{t.schritt2}</p><h3>{t.frage2}</h3>
              <p className="wz-hinweis">{t.hinweis2}</p>
              <div className="wz-felder drei">
                {Object.keys(t.felder).map((f) => (
                  <label key={f}><span>{t.felder[f]}</span><input value={k[f] ?? ""} onChange={set(f)} inputMode={f === "aufladungen" || f === "bargeld" ? "numeric" : "decimal"} /></label>
                ))}
              </div>
            </div>
          </div>
          <div className="wz-ergebnis">
            <span className="wz-stufe" style={{ background: "#1d4ed8" }}>{t.kostenUeber(JAHRE)}</span>
            <h3>{t.guenstigst(String([[t.kautionskarte, e.kautionKosten], [t.prepaidkarte, e.prepaidKosten], [t.debitkarte, e.debitKosten]].sort((a, b) => (a[1] as number) - (b[1] as number))[0][0]))}</h3>
            <div className="wz-tabelle-huelle"><table className="wz-tabelle">
              <tbody>
                <tr><td>{t.zeileKaution(eur(e.kaution))}</td><td>{eur(e.kautionKosten)}</td></tr>
                <tr><td>{t.zeilePrepaid}</td><td>{eur(e.prepaidKosten)}</td></tr>
                <tr><td>{t.zeileDebit}</td><td>{eur(e.debitKosten)}</td></tr>
              </tbody>
            </table></div>
            <p>{t.halbeWahrheit}</p>
            <div className="wz-tabelle-huelle"><table className="wz-tabelle">
              <tbody>
                {t.leistung.map(([a, b]) => <tr key={a}><td>{a}</td><td>{b}</td></tr>)}
              </tbody>
            </table></div>
            <div className="wz-schritt"><small>{t.fiaonWeg}</small><p>{t.fiaonWegA}<a href={zu("/werkzeuge/karten-check")}>{t.fiaonWegLink}</a>{t.fiaonWegB}</p></div>
            <div className="wz-knoepfe"><Knopf href={zu("/werkzeuge/karten-check")} still>{t.kartenCheck}</Knopf><Knopf href={zu("/kreditkarte")} still>{t.kreditkarte}</Knopf></div>
          </div>
          <p className="dk-leise" style={{ marginTop: 18 }}>{t.fuss(JAHRE)}</p>
        </Block>
      </Licht>
      <Block schmal titel={t.fragenTitel}><Fragen items={t.fragen} /></Block>
      <Zwischenruf text={<><b>{t.zwischenrufFett}</b>{t.zwischenruf}</>} knopf={t.zwischenrufKnopf} href={zu("/kreditkarte")} still={{ knopf: t.antrag, href: "/antrag" }} />
    </Dunkel>
  );
}
