// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge/firmenauskunft · /en/tools/business-credit-report
// Firmenauskunft-Fahrplan (09.09.2026, E-099).
// Texte: client/src/i18n/wz-firmenauskunft.ts — die Schreiben bleiben deutsch.
//
// DER JURISTISCHE KERN, den die meisten Ratgeber falsch darstellen:
// Die DSGVO schützt natürliche Personen. Für Daten juristischer Personen gilt
// sie NICHT (Erwägungsgrund 14). Daraus folgen drei verschiedene Lagen:
//   · Einzelunternehmen/Freiberuf — Betriebsdaten sind weitgehend
//     personenbezogene Daten. Art. 15 DSGVO greift voll.
//   · Personengesellschaft — die Gesellschaft hat kein Recht, die
//     namentlich geführten Gesellschafter schon.
//   · Kapitalgesellschaft — kein Auskunftsrecht der Gesellschaft; der
//     Geschäftsführer hat es für seine eigenen Daten, und die Auskunfteien
//     gewähren Unternehmen freiwillig Einsicht.
// Deshalb fragt der Fahrplan die Rechtsform ZUERST — sie entscheidet, ob man
// ein Recht ausübt oder um Einsicht bittet, und das ändert den Briefton.
//
// BELEGE: Art. 15, 16, 17, 12 Abs. 3, 77 DSGVO, Erwägungsgrund 14;
// § 31 Abs. 2 BDSG; Art. 25 DSG (CH); Art. 8a SchKG (CH).
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Zwischenruf, Fragen } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { WZ_FIRMENAUSKUNFT_WOERTER } from "@/i18n/wz-firmenauskunft";
import "@/styles/ratgeber.css";

type Land = "de" | "at" | "ch" | "";
type Recht = "einzel" | "personen" | "kapital" | "";
type Ziel = "sehen" | "berichtigen" | "loeschen" | "";

/** Baut das Schreiben. Deutsch, weil der Empfänger eine deutschsprachige Stelle ist. */
function schreiben(land: Land, recht: Recht, ziel: Ziel): string {
  const grundlage =
    land === "ch"
      ? "Art. 25 des Datenschutzgesetzes"
      : recht === "kapital"
        ? "Art. 15 DSGVO für meine personenbezogenen Daten sowie auf Einsicht in den über die Gesellschaft geführten Datensatz"
        : "Art. 15 DSGVO";

  if (ziel === "sehen") {
    return `Sehr geehrte Damen und Herren,\n\nhiermit beantrage ich Auskunft über die zu meinem Unternehmen und zu meiner Person gespeicherten Daten.\n\nUnternehmen: [Firmenname, Rechtsform]\nAnschrift: [Straße, PLZ, Ort]\nRegisternummer: [Handelsregister-/Firmenbuchnummer]\nCrefonummer, falls bekannt: [Nummer]\nInhaber/Geschäftsführung: [Name, Geburtsdatum]\n\nIch stütze mich auf ${grundlage}. Bitte übermitteln Sie mir eine vollständige Kopie der gespeicherten Daten, einschließlich der Herkunft der Daten, der Empfänger, an die sie übermittelt wurden, der Speicherdauer sowie der zu meinem Unternehmen geführten Zahlungserfahrungen und Bewertungsmerkmale.\n\nBitte bestätigen Sie den Eingang und antworten Sie innerhalb der gesetzlichen Frist von einem Monat.\n\nMit freundlichen Grüßen\n[Name, Funktion]`;
  }
  if (ziel === "berichtigen") {
    return `Sehr geehrte Damen und Herren,\n\nin dem über mein Unternehmen geführten Datensatz ist ein Eintrag gespeichert, der nicht zutrifft.\n\nUnternehmen: [Firmenname, Rechtsform]\nAnschrift: [Straße, PLZ, Ort]\nCrefonummer, falls bekannt: [Nummer]\nBetroffener Eintrag: [Gläubiger, Betrag, Datum]\nWas daran unrichtig ist: [kurze Darstellung]\n\nIch verlange die Berichtigung nach Art. 16 DSGVO. Soweit es sich um die Meldung einer offenen Forderung handelt, weise ich darauf hin, dass § 31 Abs. 2 BDSG die Meldung nur zulässt, wenn die Forderung fällig ist, zwei Mahnungen mit einem Abstand von mindestens vier Wochen vorausgingen, auf die bevorstehende Meldung hingewiesen wurde und die Forderung nicht bestritten ist. Die Forderung ist bestritten. Bitte prüfen Sie die Voraussetzungen beim meldenden Gläubiger und teilen Sie mir das Ergebnis mit.\n\nBis zum Abschluss der Prüfung beantrage ich die Einschränkung der Verarbeitung nach Art. 18 Abs. 1 Buchst. a DSGVO.\n\nMit freundlichen Grüßen\n[Name, Funktion]`;
  }
  return `Sehr geehrte Damen und Herren,\n\nzu meinem Unternehmen ist ein Eintrag gespeichert, dessen Voraussetzungen für eine weitere Speicherung entfallen sind.\n\nUnternehmen: [Firmenname, Rechtsform]\nAnschrift: [Straße, PLZ, Ort]\nCrefonummer, falls bekannt: [Nummer]\nBetroffener Eintrag: [Gläubiger, Betrag, Datum der Erledigung]\n\nDie Forderung ist am [Datum] vollständig ausgeglichen worden. Ich verlange die Löschung nach Art. 17 DSGVO, hilfsweise die Prüfung, ob die Speicherfrist nach den Verhaltensregeln der Auskunfteien bereits abgelaufen ist.\n\nBitte bestätigen Sie mir die Löschung schriftlich und teilen Sie mir mit, an welche Empfänger die Daten in den letzten zwölf Monaten übermittelt wurden, damit die Berichtigung dort nachvollzogen werden kann (Art. 19 DSGVO).\n\nMit freundlichen Grüßen\n[Name, Funktion]`;
}

export default function Firmenauskunft() {
  const t = useWoerter(WZ_FIRMENAUSKUNFT_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/tools/business-credit-report" : "/werkzeuge/firmenauskunft";

  const [land, setLand] = useState<Land>("");
  const [recht, setRecht] = useState<Recht>("");
  const [ziel, setZiel] = useState<Ziel>("");
  const [kopiert, setKopiert] = useState(false);

  const e = useMemo(() => {
    if (!land || !recht || !ziel) return null;
    const rechtslage =
      land === "ch" ? t.rechtCh
      : recht === "einzel" ? t.rechtEinzelDe
      : recht === "personen" ? t.rechtPersonenDe
      : t.rechtKapitalDe;
    const stellen = land === "at" ? t.stellenAt : land === "ch" ? t.stellenCh : t.stellenDe;
    return { rechtslage, stellen, text: schreiben(land, recht, ziel) };
  }, [land, recht, ziel, t]);

  const kopieren = async () => { if (!e) return; try { await navigator.clipboard.writeText(e.text); setKopiert(true); setTimeout(() => setKopiert(false), 2500); } catch { /* egal */ } };
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
              <p className="wz-nr">{t.schritt1}</p><h3>{t.frageLand}</h3>
              <div className="wz-optionen zwei">
                <button type="button" className={w(land === "de")} onClick={() => setLand("de")}><b>{t.lDe}</b></button>
                <button type="button" className={w(land === "at")} onClick={() => setLand("at")}><b>{t.lAt}</b></button>
                <button type="button" className={w(land === "ch")} onClick={() => setLand("ch")}><b>{t.lCh}</b></button>
              </div>
            </div>

            <div className="wz-frage">
              <p className="wz-nr">{t.schritt2}</p><h3>{t.frageRecht}</h3>
              <p className="wz-hinweis">{t.hinweisRecht}</p>
              <div className="wz-optionen zwei">
                <button type="button" className={w(recht === "einzel")} onClick={() => setRecht("einzel")}><b>{t.rEinzel}</b><small>{t.rEinzelHinweis}</small></button>
                <button type="button" className={w(recht === "personen")} onClick={() => setRecht("personen")}><b>{t.rPersonen}</b><small>{t.rPersonenHinweis}</small></button>
                <button type="button" className={w(recht === "kapital")} onClick={() => setRecht("kapital")}><b>{t.rKapital}</b><small>{t.rKapitalHinweis}</small></button>
              </div>
            </div>

            <div className="wz-frage">
              <p className="wz-nr">{t.schritt3}</p><h3>{t.frageZiel}</h3>
              <div className="wz-optionen zwei">
                <button type="button" className={w(ziel === "sehen")} onClick={() => setZiel("sehen")}><b>{t.zSehen}</b></button>
                <button type="button" className={w(ziel === "berichtigen")} onClick={() => setZiel("berichtigen")}><b>{t.zBerichtigen}</b></button>
                <button type="button" className={w(ziel === "loeschen")} onClick={() => setZiel("loeschen")}><b>{t.zLoeschen}</b></button>
              </div>
            </div>
          </div>

          {e && (
            <div className="wz-ergebnis gut">
              <span className="wz-stufe" style={{ background: "#047857" }}>{t.ergebnisTitel}</span>
              <h3>{t.rechtsTitel}</h3>
              <p>{e.rechtslage}</p>

              <div className="wz-schritt">
                <small>{t.stellenTitel}</small>
                <div className="wz-tabelle-huelle"><table className="wz-tabelle">
                  <tbody>{e.stellen.map((s) => { const [a, ...r] = s.split(" — "); return <tr key={s}><td><b>{a}</b></td><td>{r.join(" — ")}</td></tr>; })}</tbody>
                </table></div>
              </div>

              <div className="wz-schritt">
                <small>{t.schreibenTitel}</small>
                <p className="wz-hinweis">{t.schreibenHinweis}</p>
                <div className="wz-brief-wrap"><pre className="wz-brief" lang="de">{e.text}</pre></div>
              </div>
              <div className="wz-knoepfe">
                <button type="button" className="dk-knopf" onClick={kopieren}>{kopiert ? t.kopiert : t.kopieren}</button>
                <Knopf href={zu("/werkzeuge/bonitaetsindex")} still>{t.weiterLink}</Knopf>
              </div>

              <div className="wz-schritt"><small>{t.fristTitel}</small><p>{t.fristText}</p></div>
              <div className="wz-schritt"><small>{t.bestrittenTitel}</small><p>{t.bestrittenText}</p></div>
              <div className="wz-schritt"><small>{t.grenze}</small><p>{t.grenzeText}</p></div>
              <div className="wz-schritt"><small>{t.standTitel}</small><p>{t.stand}</p></div>
            </div>
          )}
          <p className="dk-leise" style={{ marginTop: 18 }}>{t.fuss}</p>
        </Block>
      </Licht>

      <Block schmal titel={t.fragenTitel}><Fragen items={t.fragen} /></Block>
      <Zwischenruf text={<><b>{t.zwischenrufFett}</b>{t.zwischenruf}</>} knopf={t.zwischenrufKnopf} href={zu("/business")} still={{ knopf: t.weiterLink, href: zu("/werkzeuge/bonitaetsindex") }} />
    </Dunkel>
  );
}
