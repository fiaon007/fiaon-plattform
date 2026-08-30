// ═══════════════════════════════════════════════════════════════════════════
// /eintrag-verjaehrung — der Pfeiler zur Fristen-Suche (30.08.2026)
//
// Suchintention: „schufa eintrag löschen nach jahren / verjährung“. Kern der
// Seite ist der kleine Verjährungs-Checker: Art des Eintrags + Datum →
// „gespeichert bis voraussichtlich …“. REIN INFORMATIV — er verspricht
// nichts, er rechnet nur die bekannten Fristen nach. Der Unterschied
// zwischen Speicherfrist (Auskunftei) und Verjährung (Forderung) wird
// ausdrücklich erklärt, weil genau diese Verwechslung die Suche prägt.
// JSON-LD: Article + FAQPage.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Fragen, Karten } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import KartenAufruf from "@/components/site/KartenAufruf";
import "@/styles/ratgeber.css";
import "@/styles/seo-seiten.css";

type EintragsArt = "erledigt" | "hundert" | "restschuld" | "anfrage" | "vertrag" | "offen";

const ARTEN: Array<{ wert: EintragsArt; label: string; datumLabel: string }> = [
  { wert: "erledigt", label: "Erledigte (bezahlte) Forderung", datumLabel: "Datum der Erledigung" },
  { wert: "hundert", label: "Forderung, binnen 100 Tagen nach Meldung bezahlt", datumLabel: "Datum der Meldung" },
  { wert: "restschuld", label: "Restschuldbefreiung nach Insolvenz", datumLabel: "Datum der Erteilung" },
  { wert: "anfrage", label: "Kreditanfrage", datumLabel: "Datum der Anfrage" },
  { wert: "vertrag", label: "Girokonto / Kreditkarte (Vertragsdaten)", datumLabel: "Datum der Kündigung" },
  { wert: "offen", label: "Offene, unbezahlte Forderung", datumLabel: "Datum der Meldung" },
];

function monateDazu(iso: string, monate: number): Date | null {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setMonth(d.getMonth() + monate);
  return d;
}
const alsText = (d: Date) => d.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });

const FRAGEN = [
  { f: "Verschwindet ein SCHUFA-Eintrag automatisch nach der Frist?", a: "Er sollte — die Auskunfteien löschen nach ihren Verhaltensregeln taggenau. In der Praxis bleiben verfristete Einträge trotzdem immer wieder stehen: nach Systemumstellungen, bei nie nachgetragenen Erledigungen, bei Doppelmeldungen. Deshalb lohnt der Abgleich der eigenen Datenkopie gegen die Fristen — eine überschrittene Frist ist der klarste Löschgrund überhaupt." },
  { f: "Ist Verjährung dasselbe wie die Löschfrist?", a: "Nein, und diese Verwechslung kostet bares Geld: Die VERJÄHRUNG betrifft die Forderung selbst (meist drei Jahre zum Jahresende) — danach müssen Sie nicht mehr zahlen, wenn Sie sich darauf berufen. Die SPEICHERFRIST betrifft den Eintrag bei der Auskunftei und läuft unabhängig davon. Eine verjährte Forderung kann noch eingetragen sein — und eine bezahlte Forderung bleibt trotz Zahlung bis zu drei Jahre sichtbar." },
  { f: "Wann genau greift die 18-Monats-Regel?", a: "Wenn die gemeldete Forderung innerhalb von 100 Tagen nach der Meldung vollständig bezahlt wird und sonst keine weiteren Negativmerkmale bestehen. Dann verkürzt sich die Speicherfrist von drei Jahren auf 18 Monate. Die Regel gilt seit 2024 und wird taggenau gerechnet." },
  { f: "Kann ich eine vorzeitige Löschung erreichen?", a: "Bei zulässig gemeldeten, inhaltlich richtigen Einträgen vor Fristablauf grundsätzlich nicht — Anbieter, die das pauschal versprechen, arbeiten unseriös. Angreifbar sind Einträge, die ohne die Voraussetzungen des § 31 BDSG gemeldet wurden, inhaltlich falsch sind oder deren Frist bereits abgelaufen ist. Das ist häufiger, als viele denken." },
  { f: "Zählt die Frist ab Rechnung, Mahnung oder Zahlung?", a: "Bei erledigten Forderungen zählt die Frist ab dem Datum der ERLEDIGUNG (Zahlung), nicht ab Rechnung oder Meldung. Bei Kreditanfragen ab dem Tag der Anfrage, bei der Restschuldbefreiung ab der Erteilung. Genau deshalb fragt der Checker oben nach dem passenden Datum je Eintragsart." },
  { f: "Gilt das auch in Österreich und der Schweiz?", a: "Die Grundrechte (Auskunft, Berichtigung, Löschung) sind vergleichbar — die DSGVO gilt in Österreich unmittelbar, die Schweiz hat das revidierte DSG. Die konkreten Speicherpraktiken von KSV und CRIF unterscheiden sich im Detail. FIAON prüft alle drei Häuser; die Länderseiten für Österreich und die Schweiz erklären die Unterschiede." },
];

export default function EintragVerjaehrung() {
  // Alle Haken oben — der Checker ist der Kern der Seite.
  const [art, setArt] = useState<EintragsArt>("erledigt");
  const [datum, setDatum] = useState<string>("");

  const gewaehlt = ARTEN.find((a) => a.wert === art) || ARTEN[0];
  const ergebnis = useMemo(() => {
    if (art === "offen") {
      return { satz: "Für offene, unbezahlte Forderungen läuft KEINE Löschfrist — sie beginnt erst mit der Erledigung. Der schnellste Weg zur Frist ist die Zahlung (bei Ausgleich binnen 100 Tagen nach Meldung gilt die verkürzte 18-Monats-Frist)." };
    }
    if (art === "vertrag") {
      return { satz: "Vertragsdaten zu Girokonto und Kreditkarte werden mit der Beendigung des Vertrags gelöscht — hier gibt es keine Nachlauffrist. Steht ein beendetes Konto noch drin, ist das ein Berichtigungsfall." };
    }
    if (!datum) return null;
    const monate = art === "erledigt" ? 36 : art === "hundert" ? 18 : art === "restschuld" ? 6 : 12;
    const bis = monateDazu(datum, monate);
    if (!bis) return null;
    const vorbei = bis.getTime() < Date.now();
    return {
      satz: vorbei
        ? `Die Speicherfrist wäre demnach am ${alsText(bis)} abgelaufen — der Eintrag dürfte heute nicht mehr in Ihrer Auskunft stehen. Steht er noch, ist das ein klarer Löschgrund.`
        : `Gespeichert bis voraussichtlich ${alsText(bis)} (${monate} Monate ab dem gewählten Datum).`,
      vorbei,
    };
  }, [art, datum]);

  return (
    <Dunkel seite="ratgeber" titel="SCHUFA-Eintrag und Verjährung: alle Fristen" beschreibung="Wann ein SCHUFA-Eintrag verschwinden muss: Verjährungs-Checker, alle Speicherfristen je Eintragsart und der Weg bei Verfristung. Jetzt Frist prüfen.">
      <SeoDaten
        pfad="/eintrag-verjaehrung"
        titel="SCHUFA-Eintrag und Verjährung: alle Fristen | FIAON"
        beschreibung="Wann ein SCHUFA-Eintrag verschwinden muss: Verjährungs-Checker, alle Speicherfristen je Eintragsart und der Weg bei Verfristung. Jetzt Frist prüfen."
        fragen={FRAGEN}
        artikel={{ ueberschrift: "SCHUFA-Eintrag und Verjährung: Wann welche Frist läuft", stand: "2026-08-30" }}
        krumen={[{ name: "Eintrag und Verjährung", pfad: "/eintrag-verjaehrung" }]}
      />

      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/akten.jpg" alt="" decoding="async" {...({ fetchpriority: "high" } as any)} /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">Fristen kennen · Rechte nutzen</span>
          <h1 className="dk-h1">SCHUFA-Eintrag nach Jahren: <span className="dk-verlauf">Wann er verschwinden muss.</span></h1>
          <p className="dk-lead">
            Jeder Eintrag hat ein Verfallsdatum — es steht nur nirgendwo dran.
            Hier rechnen Sie es aus, sehen alle Speicherfristen je Eintragsart und den
            Unterschied zur Verjährung der Forderung. Taggenau, nach den Regeln von 2024.
          </p>
          <div className="dk-knoepfe">
            <Knopf href="/antrag">Jetzt Antrag starten</Knopf>
            <Knopf href="/kontakt" still>Kostenlos prüfen lassen</Knopf>
          </div>
        </div>
      </section>

      <Licht>
        {/* Der Checker — das interaktive Herzstück. */}
        <Block schmal titel="Der Verjährungs-Checker" lead="Art des Eintrags und Datum wählen — der Checker nennt das voraussichtliche Löschdatum. Rein informativ, kein Versprechen.">
          <div className="sx-checker" data-fiaon="verjaehrungs-checker">
            <div className="felder">
              <label>
                Art des Eintrags
                <select value={art} onChange={(e) => setArt(e.target.value as EintragsArt)}>
                  {ARTEN.map((a) => <option key={a.wert} value={a.wert}>{a.label}</option>)}
                </select>
              </label>
              <label>
                {gewaehlt.datumLabel}
                <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} max="2099-12-31" />
              </label>
            </div>
            {ergebnis && (
              <div className="ergebnis" role="status">
                <b>{ergebnis.satz}</b>
              </div>
            )}
            <p className="klein">
              Der Checker rechnet die Speicherfristen der Verhaltensregeln 2024 nach (taggenau) und ersetzt
              keine Prüfung des Einzelfalls. Ob ein konkreter Eintrag gelöscht werden muss, hängt zusätzlich
              davon ab, ob er überhaupt zulässig gemeldet wurde.
            </p>
          </div>
        </Block>

        {/* Die Fristen-Tabelle. */}
        <Block schmal titel="Alle Speicherfristen je Eintragsart" lead="Stand der Verhaltensregeln 2024 — taggenau gerechnet, nicht mehr zum Jahresende.">
          <div className="wz-tabelle-huelle">
            <table className="wz-tabelle">
              <thead><tr><th scope="col">Eintrag</th><th scope="col">Frist</th><th scope="col">läuft ab</th></tr></thead>
              <tbody>
                <tr><td>Erledigte Forderung</td><td>3 Jahre</td><td>Erledigung</td></tr>
                <tr><td>Erledigt binnen 100 Tagen nach Meldung</td><td>18 Monate</td><td>Meldung</td></tr>
                <tr><td>Restschuldbefreiung</td><td>6 Monate</td><td>Erteilung</td></tr>
                <tr><td>Kreditanfrage</td><td>12 Monate (10 Tage sichtbar für andere)</td><td>Anfrage</td></tr>
                <tr><td>Konditionsanfrage</td><td>12 Monate, nur für Sie sichtbar — scorefrei</td><td>Anfrage</td></tr>
                <tr><td>Girokonto, Kreditkarte (Vertragsdaten)</td><td>bei Beendigung</td><td>Kündigung</td></tr>
                <tr><td>Offene, nicht bestrittene Forderung</td><td>keine — Frist beginnt erst mit Erledigung</td><td>—</td></tr>
              </tbody>
            </table>
          </div>
        </Block>

        {/* Berechtigt vs. unberechtigt. */}
        <Block titel="Berechtigt oder unberechtigt — der Unterschied entscheidet" lead="Die Frist ist nur ein Löschgrund von dreien.">
          <Karten items={[
            { tag: "Verfristet", titel: "Die Frist ist um — der Eintrag steht noch", text: "Der klarste Fall: Nach Ablauf der Speicherfrist MUSS gelöscht werden, ohne Wenn und Aber. Trotzdem bleiben solche Einträge erstaunlich oft stehen — niemand rechnet für Sie nach. Der Checker oben und die eigene Datenkopie decken das in Minuten auf." },
            { tag: "Unzulässig", titel: "Ohne die Voraussetzungen gemeldet", text: "Eine offene Forderung darf nur nach zwei Mahnungen mit vier Wochen Abstand, rechtzeitigem Hinweis und ohne Ihren Widerspruch gemeldet werden (§ 31 BDSG). Fehlt eine Voraussetzung, ist der Eintrag angreifbar — auch wenn die Forderung selbst berechtigt war und unabhängig von jeder Frist." },
            { tag: "Berechtigt", titel: "Zulässig gemeldet und noch in der Frist", text: "Dann bleibt der Eintrag — das ist die ehrliche Antwort. Wer Ihnen hier eine Löschung verspricht, verkauft Hoffnung. Was trotzdem geht: die 100-Tage-Regel nutzen, weitere Einträge vermeiden und die Bonität über pünktliche Zahlungen wieder aufbauen." },
          ]} />
        </Block>

        {/* Der FIAON-Weg. */}
        <Block schmal titel="Der FIAON-Weg bei verfristeten Einträgen" lead="Nachrechnen ist der Anfang — durchsetzen die Arbeit.">
          <div className="wz-fragen">
            <div className="wz-frage">
              <p className="wz-nr">Schritt 1</p>
              <h3>Datenkopie aller drei Auskunfteien</h3>
              <p className="wz-hinweis">FIAON beschafft SCHUFA, KSV und CRIF aus einer Hand. Nur die Datenkopie zeigt Meldedatum und Erledigungsdatum — genau die Daten, an denen die Fristen hängen.</p>
            </div>
            <div className="wz-frage">
              <p className="wz-nr">Schritt 2</p>
              <h3>Jede Frist taggenau nachgerechnet</h3>
              <p className="wz-hinweis">Jeder Eintrag wird gegen seine Frist und gegen § 31 BDSG gehalten. Sie bekommen das Ergebnis in Klartext: Was muss weg, was ist angreifbar, was bleibt.</p>
            </div>
            <div className="wz-frage">
              <p className="wz-nr">Schritt 3</p>
              <h3>Löschverlangen mit Fristsetzung</h3>
              <p className="wz-hinweis">Für verfristete und unzulässige Einträge bereitet FIAON die Schreiben an Auskunftei und meldende Stelle vor (Art. 17 DSGVO) und verfolgt die Antwortfristen — bis zur Ombudsstelle, wenn es sein muss.</p>
            </div>
          </div>
          <p className="dk-leise" style={{ marginTop: 18 }}>
            Selbst rechnen? Das kostenlose Werkzeug{" "}
            <a href="/werkzeuge/loeschfrist" style={{ color: "#1d4ed8" }}>Löschfrist berechnen</a> nimmt jeden Fall
            einzeln auseinander — und <a href="/werkzeuge/verjaehrung" style={{ color: "#1d4ed8" }}>Verjährung prüfen</a>{" "}
            beantwortet die Schwester-Frage zur Forderung selbst. Den kompletten Weg beschreibt{" "}
            <a href="/schufa-eintrag-loeschen" style={{ color: "#1d4ed8" }}>SCHUFA-Eintrag löschen lassen</a>.
          </p>
        </Block>

        <Block schmal titel="Häufige Fragen zu Fristen und Verjährung">
          <Fragen items={FRAGEN} />
          <p className="dk-leise" style={{ marginTop: 22 }}>
            Redaktionelle Einordnung nach den Verhaltensregeln der Wirtschaftsauskunfteien (Fassung 2024),
            § 31 BDSG und Art. 15–17 DSGVO, Stand August 2026. Keine Rechtsberatung im Einzelfall.
            Begriffe von A bis Z erklärt das <a href="/glossar-bonitaet" style={{ color: "#1d4ed8" }}>Bonitäts-Glossar</a>.
          </p>
        </Block>
      </Licht>

      <KartenAufruf
        titel="Ihr Verfallsdatum steht in Ihrer Auskunft. Wir lesen es."
        satz="FIAON beschafft Ihre Datenkopien, rechnet jede Frist taggenau nach und verlangt die Löschung, wo sie fällig ist — Sie sehen jeden Schritt in Ihrem Kundenbereich."
      />
    </Dunkel>
  );
}
