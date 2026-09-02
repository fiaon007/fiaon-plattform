// ═══════════════════════════════════════════════════════════════════════════
// /fiaon-erfahrungen — die Vertrauensseite (30.08.2026; NEUBAU 02.09.2026, E-082)
//
// Justin: „Diese Seite bitte in unseren CI (hochmodern, 3D, Animationen,
// Glas …) neu machen, länger, brauchbarer – funktionaler, Werkzeuge."
//
// ── SUCHINTENTION ─────────────────────────────────────────────────────────
// „fiaon erfahrungen / seriös / bewertung". Wer das sucht, steht kurz vor
// der Entscheidung. Messlatte aus der Marktanalyse (CONNY, bonify): Zahlen,
// „So funktioniert's" in drei Schritten, Verläufe, Bewertungen, Team,
// Sicherheit — und ein prüfbares Kriterium statt Eigenlob.
//
// ── DIE ZAHLEN SIND ECHT ──────────────────────────────────────────────────
// Bis 02.09.2026 standen hier Platzhalter („1.000+"). Jetzt: bankbestätigte
// Werte aus der Datenbank (E-075: nur bankbestätigte Zahlen), gemessen am
// 02.09.2026, gerundet nach unten, mit Stand-Datum sichtbar:
//   443 zahlende Kunden (payment_status = paid, keine Testkonten)
//   450 bezahlte Raten (fiaon_abo_raten.bezahlt_am)
//   DE 267 · AT 150 · CH 4 zahlende Kunden nach Land
// Pflege: scripts/tmp/zahlen-oeffentlich.ts (nur SELECT) — Stand alle
// vier Wochen nachziehen, nie nach oben runden.
//
// ── WAS NEU IST ───────────────────────────────────────────────────────────
// 3D-Schichten im Hero, Kennzahlen mit Stand, „So funktioniert's" (3 Schritte),
// Szenenbild mit Relief, zwei typische Verläufe (nachgestellt, als solche
// gekennzeichnet — echte Fälle nur mit Justins Freigabe), das Werkzeug
// „Seriositäts-Check" (sechs Fragen, die für JEDEN Anbieter gelten),
// Warnzeichen-Karten, Team- und Sicherheitsband, Bewertungsplatz (ehrlich:
// im Aufbau), FAQ, Aufruf. JSON-LD: FAQPage über SeoDaten; Organization
// kommt vom Server (E-079) — der frühere Client-Block ist entfernt.
// ═══════════════════════════════════════════════════════════════════════════
// 02.09.2026: zweisprachig — /fiaon-erfahrungen (Deutsch) und
// /en/how-fiaon-works (Englisch); Texte im Wörterbuch
// client/src/i18n/fiaon-erfahrungen.ts, die Zahlen bleiben HIER.
import { useMemo, useState } from "react";
import { Dunkel, Hero, Block, Licht, Knopf, Fragen, Karten, Kennzahlen, Auf, Glas, Szenenbild, Zitat, Zwischenruf } from "@/components/site/DunkleBuehne";
import SchichtenSzene from "@/components/home3d/SchichtenSzene";
import SeoDaten from "@/components/site/SeoDaten";
import KartenAufruf from "@/components/site/KartenAufruf";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { ERFAHRUNGEN_WOERTER } from "@/i18n/fiaon-erfahrungen";
import "@/styles/ratgeber.css";
import "@/styles/seo-seiten.css";

// ── Bankbestätigte Zahlen, Stand 02.09.2026 (siehe Kopfkommentar). ────────────
const ZAHLEN = ["440+", "450", "3", "20"]; // 443 zahlende Kunden (abgerundet), bezahlte Raten, Länder, Werkzeuge

export default function FiaonErfahrungen() {
  const t = useWoerter(ERFAHRUNGEN_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/how-fiaon-works" : "/fiaon-erfahrungen";
  const CHECK = t.checks;
  const [antworten, setAntworten] = useState<Record<string, "ja" | "nein">>({});
  const ergebnis = useMemo(() => {
    const beantwortet = CHECK.filter((c) => antworten[c.key]);
    if (beantwortet.length < CHECK.length) return null;
    const rot = CHECK.filter((c) => antworten[c.key] === c.schlecht);
    return { rot, stufe: rot.length === 0 ? "gut" : rot.length <= 2 ? "pruefen" : "alarm" };
  }, [antworten, CHECK]);

  return (
    <Dunkel seite="ratgeber" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <SeoDaten pfad={pfad} titel={t.seoTitel} beschreibung={t.seoBeschreibung} fragen={t.fragen} krumen={[{ name: t.krume, pfad }]} />

      <Hero
        bild="/kino/akten.jpg"
        pille={t.pille}
        titel={<>{t.h1a}<span className="dk-verlauf">{t.h1b}</span></>}
        lead={t.lead}
        knoepfe={<><Knopf href="#check">{t.check}</Knopf><Knopf href="#ablauf" still>{t.soFunktioniert}</Knopf></>}
        szene={<SchichtenSzene namen={t.szeneNamen} className="absolute inset-0" />}
      />

      <Block eng>
        <Kennzahlen items={ZAHLEN.map((wert, i) => ({ wert, label: t.zahlenLabels[i] }))} />
        <p className="dk-leise" style={{ textAlign: "center", marginTop: 14 }}>{t.standSatz(t.stand)}</p>
      </Block>

      <Licht>
        <Block id="ablauf" schmal titel={<>{t.ablaufH2a}<span className="dk-verlauf">{t.ablaufH2b}</span></>} lead={t.ablaufLead}>
          <Auf>
            <div className="sx-zeitleiste">
              {t.ablauf.map((e, i) => (
                <div key={e.titel} className="sx-etappe">
                  <div className="spur"><span className="punkt">{i + 1}</span>{i < t.ablauf.length - 1 && <span className="faden" />}</div>
                  <div className="inhalt"><span className="dauer">{e.dauer}</span><h3>{e.titel}</h3><p>{e.text}</p></div>
                </div>
              ))}
            </div>
          </Auf>
        </Block>
      </Licht>

      <Szenenbild tief src="/kino/tuer.jpg" titel={<>{t.szeneA}<span className="dk-verlauf">{t.szeneB}</span></>} text={t.szeneText} />

      <Licht>
        <Block id="check" schmal titel={<>{t.checkH2a}<span className="dk-verlauf">{t.checkH2b}</span></>} lead={t.checkLead}>
          <div className="wz-fragen">
            {CHECK.map((c, i) => (
              <div key={c.key} className="wz-frage">
                <p className="wz-nr">{t.frage} {i + 1}</p><h3>{c.frage}</h3>
                <div className="wz-optionen zwei">
                  <button type="button" className={`wz-option${antworten[c.key] === "ja" ? " an" : ""}`} onClick={() => setAntworten({ ...antworten, [c.key]: "ja" })}><b>{t.ja}</b></button>
                  <button type="button" className={`wz-option${antworten[c.key] === "nein" ? " an" : ""}`} onClick={() => setAntworten({ ...antworten, [c.key]: "nein" })}><b>{t.nein}</b></button>
                </div>
              </div>
            ))}
          </div>
          {ergebnis && (
            <div className={`wz-ergebnis${ergebnis.stufe === "gut" ? " gut" : ergebnis.stufe === "alarm" ? " alarm" : ""}`}>
              <span className="wz-stufe" style={{ background: ergebnis.stufe === "gut" ? "#047857" : ergebnis.stufe === "alarm" ? "#b91c1c" : "#b45309" }}>{ergebnis.stufe === "gut" ? t.keineWarn : ergebnis.stufe === "alarm" ? t.vonSechs(ergebnis.rot.length) : t.genauHinsehen(ergebnis.rot.length)}</span>
              <h3>{ergebnis.stufe === "gut" ? t.bestehtCheck : ergebnis.stufe === "alarm" ? t.fingerWeg : t.nachfragen}</h3>
              {ergebnis.rot.length > 0 && <ul style={{ margin: "12px 0 0 18px", color: "#334155", fontSize: 14.5, lineHeight: 1.6 }}>{ergebnis.rot.map((c) => <li key={c.key}><b>{c.frage}</b> – {c.erk}</li>)}</ul>}
              <div className="wz-schritt"><small>{t.soWir}</small><p>{t.soWirText}</p></div>
            </div>
          )}
        </Block>

        <Block titel={<>{t.warnH2a}<span className="dk-verlauf">{t.warnH2b}</span></>} lead={t.warnLead}>
          <Karten items={t.warn} />
        </Block>

        <Block schmal titel={<>{t.verlaufH2a}<span className="dk-verlauf">{t.verlaufH2b}</span></>} lead={t.verlaufLead}>
          <div className="sx-vertiefen">
            <Glas tag={t.verlaufA.tag} titel={t.verlaufA.titel}><p className="dk-text" style={{ fontSize: 14.5, lineHeight: 1.7 }}>{t.verlaufA.text}</p></Glas>
            <Glas tag={t.verlaufB.tag} titel={t.verlaufB.titel}><p className="dk-text" style={{ fontSize: 14.5, lineHeight: 1.7 }}>{t.verlaufB.text}</p></Glas>
          </div>
        </Block>
      </Licht>

      <Block schmal>
        <Zitat text={t.zitat} wer={t.zitatWer} en={en} />
      </Block>

      <Licht>
        <Block schmal titel={<>{t.menschenH2a}<span className="dk-verlauf">{t.menschenH2b}</span></>} lead={t.menschenLead}>
          <div className="sx-vertiefen">
            {t.links.map((l) => <a key={l.href} href={zu(l.href)}><b>{l.t}</b><span>{l.s}</span></a>)}
          </div>
        </Block>

        <Block schmal titel={<>{t.bewertH2a}<span className="dk-verlauf">{t.bewertH2b}</span></>} lead={t.bewertLead}>
          <Glas ruhig>
            <p className="dk-text" style={{ fontSize: 15, lineHeight: 1.7 }}>{t.bewertText}</p>
          </Glas>
        </Block>

        <Block schmal titel={t.fragenTitel}>
          <Fragen items={t.fragen} />
          <p className="dk-leise" style={{ marginTop: 22 }}>{t.fussSatz(t.stand)}</p>
        </Block>
      </Licht>

      <Zwischenruf text={<><b>{t.zwischenrufA}</b>{t.zwischenrufB}</>} knopf={t.kontakt} href={zu("/kontakt")} still={{ knopf: t.eintragPruefen, href: zu("/werkzeuge/eintrag-pruefen") }} />

      <KartenAufruf titel={t.aufrufTitel} satz={t.aufrufSatz} />
    </Dunkel>
  );
}
