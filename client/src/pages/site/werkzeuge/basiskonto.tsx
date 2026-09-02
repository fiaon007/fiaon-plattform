// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge/basiskonto · /en/tools/basic-account — Basiskonto-Helfer: Frist,
// Ablehnung, BaFin-Antrag (02.09.2026, E-080; zweisprachig 03.09.2026 — die
// Erinnerung bleibt deutsch, Texte: client/src/i18n/wz-basiskonto.ts)
//
// Jede kontoführende Bank in Deutschland muss Verbrauchern auf Antrag ein
// Basiskonto eröffnen (§ 31 ZKG) – unabhängig von Einträgen bei Auskunfteien.
// Sie hat dafür zehn Geschäftstage ab vollständigem Antrag (§ 33 Abs. 3 ZKG);
// eine Ablehnung muss schriftlich begründet werden (§ 34 ZKG). Wird abgelehnt
// oder verschleppt, gibt es das kostenlose Verwaltungsverfahren bei der BaFin
// (§ 48 ZKG): Sie prüft und ordnet die Eröffnung an, wenn die Ablehnung
// unrechtmäßig war.
//
// Das Werkzeug rechnet die Zehn-Tage-Frist ab Antragsdatum, erklärt die
// zulässigen Ablehnungsgründe (§§ 35, 36 ZKG) und erzeugt die Erinnerung an
// die Bank sowie die Checkliste für den BaFin-Antrag.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Zwischenruf, Fragen } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { WZ_BASISKONTO_WOERTER } from "@/i18n/wz-basiskonto";
import "@/styles/ratgeber.css";

const parse = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + "T12:00:00") : null);
const heuteText = () => new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });

/** Zehn Geschäftstage (Montag–Freitag, bundesweite Feiertage ausgenommen) nach dem Antragstag. */
function geschaeftstage(start: Date, n: number): Date {
  const d = new Date(start); let z = 0;
  const fest = (x: Date) => { const j = x.getFullYear(); const iso = x.toISOString().slice(0, 10); return [`${j}-01-01`, `${j}-05-01`, `${j}-10-03`, `${j}-12-25`, `${j}-12-26`].includes(iso); };
  while (z < n) { d.setDate(d.getDate() + 1); const wt = d.getDay(); if (wt !== 0 && wt !== 6 && !fest(d)) z++; }
  return d;
}

type Lage = "warte" | "abgelehnt" | "";

export default function Basiskonto() {
  const t = useWoerter(WZ_BASISKONTO_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/tools/basic-account" : "/werkzeuge/basiskonto";
  const fmt = (d: Date) => d.toLocaleDateString(en ? "en-GB" : "de-DE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const [lage, setLage] = useState<Lage>("");
  const [antrag, setAntrag] = useState("");
  const [bank, setBank] = useState("");
  const [name, setName] = useState("");
  const [kopiert, setKopiert] = useState(false);
  const a = parse(antrag);
  const heute = useMemo(() => { const d = new Date(); d.setHours(12, 0, 0, 0); return d; }, []);
  const frist = useMemo(() => (a ? geschaeftstage(a, 10) : null), [a]);
  const ueberfaellig = frist ? frist < heute : false;

  const erinnerung = useMemo(() => `${name || "[Vor- und Nachname]"}
[Anschrift]

${bank || "[Bank]"}
[Anschrift der Filiale]

${heuteText()}

Antrag auf Abschluss eines Basiskontovertrags vom ${a ? a.toLocaleDateString("de-DE") : "[Datum]"} – Erinnerung

Sehr geehrte Damen und Herren,

am ${a ? a.toLocaleDateString("de-DE") : "[Datum]"} habe ich bei Ihnen einen Antrag auf Abschluss eines Basiskontovertrags nach § 31 ZKG gestellt. Nach § 33 Abs. 3 ZKG sind Sie verpflichtet, mir innerhalb von zehn Geschäftstagen nach Eingang des vollständigen Antrags den Abschluss anzubieten oder den Antrag schriftlich und begründet abzulehnen (§ 34 ZKG). Diese Frist ist am ${frist ? frist.toLocaleDateString("de-DE") : "[Datum]"} abgelaufen; eine Antwort habe ich nicht erhalten.

Ich fordere Sie auf, mir bis zum ${(() => { const d = new Date(heute); d.setDate(d.getDate() + 5); return d.toLocaleDateString("de-DE"); })()} den Basiskontovertrag anzubieten. Andernfalls werde ich bei der Bundesanstalt für Finanzdienstleistungsaufsicht ein Verwaltungsverfahren nach § 48 ZKG beantragen.

Mit freundlichen Grüßen

${name || "[Vor- und Nachname]"}`, [name, bank, a, frist, heute]);

  const kopieren = async () => { try { await navigator.clipboard.writeText(erinnerung); setKopiert(true); setTimeout(() => setKopiert(false), 2500); } catch { /* egal */ } };

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
              <div className="wz-optionen zwei">
                <button type="button" className={`wz-option${lage === "warte" ? " an" : ""}`} onClick={() => setLage("warte")}><b>{t.warte}</b><small>{t.warteHinweis}</small></button>
                <button type="button" className={`wz-option${lage === "abgelehnt" ? " an" : ""}`} onClick={() => setLage("abgelehnt")}><b>{t.abgelehnt}</b><small>{t.abgelehntHinweis}</small></button>
              </div>
            </div>
            {lage === "warte" && (
              <div className="wz-frage">
                <p className="wz-nr">{t.schritt2}</p><h3>{t.frage2}</h3>
                <p className="wz-hinweis">{t.hinweis2}</p>
                <div className="wz-felder drei">
                  <label><span>{t.antragAm}</span><input type="date" value={antrag} onChange={(ev) => setAntrag(ev.target.value)} /></label>
                  <label><span>{t.bank}</span><input value={bank} onChange={(ev) => setBank(ev.target.value)} placeholder={t.bspBank} /></label>
                  <label><span>{t.ihrName}</span><input value={name} onChange={(ev) => setName(ev.target.value)} /></label>
                </div>
              </div>
            )}
          </div>
          {lage === "warte" && frist && (
            <div className={`wz-ergebnis${ueberfaellig ? " alarm" : " gut"}`}>
              <span className="wz-stufe" style={{ background: ueberfaellig ? "#b91c1c" : "#047857" }}>{ueberfaellig ? t.fristAbgelaufen : t.fristLaeuft}</span>
              <h3>{t.mussBis(fmt(frist))}</h3>
              <p>{t.fristText}{ueberfaellig ? t.fristVorbei : t.fristWarten}</p>
              {ueberfaellig && (
                <div className="wz-brief-wrap" style={{ marginTop: 22 }}>
                  {t.spracheHinweis && <p className="wz-hinweis" style={{ marginBottom: 12 }}>{t.spracheHinweis}</p>}
                  <div className="wz-brief" lang="de">{erinnerung}</div>
                  <div className="wz-knoepfe">
                    <button type="button" className="dk-knopf" onClick={kopieren}>{kopiert ? t.kopiert : t.kopieren}</button>
                    <Knopf href="https://www.bafin.de/DE/verbraucherinnen-verbraucher/themen-finanzprodukte/konten-zahlungen/konten/basiskonto/basiskonto_node.html" still>{t.bafinVerfahren}</Knopf>
                  </div>
                </div>
              )}
            </div>
          )}
          {lage === "abgelehnt" && (
            <div className="wz-ergebnis">
              <span className="wz-stufe" style={{ background: "#1d4ed8" }}>{t.pruefen}</span>
              <h3>{t.nurVier}</h3>
              <p>{t.zulaessig}</p>
              <div className="wz-schritt"><small>{t.s1}</small><p>{t.s1Text}</p></div>
              <div className="wz-schritt"><small>{t.s2}</small><p>{t.s2Text}</p></div>
              <div className="wz-schritt"><small>{t.s3}</small><p>{t.s3Text}</p></div>
              <div className="wz-knoepfe">
                <Knopf href="https://www.bafin.de/DE/verbraucherinnen-verbraucher/themen-finanzprodukte/konten-zahlungen/konten/basiskonto/basiskonto_node.html" still>{t.bafinFormular}</Knopf>
                <Knopf href={zu("/girokonto-trotz-negativer-bonitaet")} still>{t.oderFiaon}</Knopf>
              </div>
            </div>
          )}
          <p className="dk-leise" style={{ marginTop: 18 }}>{t.fuss}</p>
        </Block>
      </Licht>
      <Block schmal titel={t.fragenTitel}><Fragen items={t.fragen} /></Block>
      <Zwischenruf text={<><b>{t.zwischenrufFett}</b>{t.zwischenruf}</>} knopf={t.zwischenrufKnopf} href={zu("/girokonto-trotz-negativer-bonitaet")} still={{ knopf: t.antrag, href: "/antrag" }} />
    </Dunkel>
  );
}
