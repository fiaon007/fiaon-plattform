// ═══════════════════════════════════════════════════════════════════════════
// /preise — Preise & Pakete, ehrlich verglichen (23.08.2026)
//
// Alle Privat- und Business-Pakete aus dem Katalog, Leistungsvergleich,
// Werkzeug „Was kostet mich das Selbermachen?", Zahlungsweg, Fragen.
// Preise kommen ausschließlich aus shared/fiaon-pakete.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Hero, Block, Licht, Knopf, Auf, Kennzahlen, Fragen, Zwischenruf, Abschluss, Szenenbild } from "@/components/site/DunkleBuehne";
import { PAKETE, SCHUFA_PREIS_EURO } from "@shared/fiaon-pakete";
import "@/styles/preise.css";

const geld = (c: number) => (c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 }) + " €";
const euro0 = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const LEISTUNGEN: [string, Record<string, boolean | string>][] = [
  ["Bonitätsauskunft beschafft und erklärt", { schufa: true, start: true, pro: true, ultra: true, highend: true }],
  ["Löschfristen und 100-Tage-Regel je Eintrag", { schufa: true, start: true, pro: true, ultra: true, highend: true }],
  ["Finanzauswertung aus dem Kontoauszug", { schufa: false, start: true, pro: true, ultra: true, highend: true }],
  ["Schreiben an Gläubiger und Auskunfteien", { schufa: false, start: "zum Selbstversand", pro: "FIAON versendet", ultra: "FIAON versendet", highend: "FIAON versendet" }],
  ["Fristen verfolgt, Antworten bewertet", { schufa: false, start: false, pro: true, ultra: true, highend: true }],
  ["Girokonto vorbereitet", { schufa: false, start: false, pro: true, ultra: true, highend: true }],
  ["Kreditkarte vorbereitet", { schufa: false, start: false, pro: "ab Schwelle", ultra: true, highend: true }],
  ["Fester Ansprechpartner", { schufa: false, start: true, pro: true, ultra: true, highend: true }],
  ["Vorrang bei Fristen und Rückfragen", { schufa: false, start: false, pro: false, ultra: true, highend: true }],
  ["Direkte Durchwahl, alles aus einer Hand", { schufa: false, start: false, pro: false, ultra: false, highend: true }],
];
const SPALTEN = ["schufa", "start", "pro", "ultra", "highend"];

export default function Preise() {
  const [eintraege, setEintraege] = useState(2);
  const [stunden, setStunden] = useState(25);
  const selbst = useMemo(() => {
    const einschreiben = eintraege * 2 * 5.5; // Gläubiger + Auskunftei, je Einschreiben
    const auskunft = 0; // Datenkopie kostenlos
    const zeit = (eintraege * 3 + 4) ; // Stunden: je Eintrag ~3 h (lesen, recherchieren, schreiben, nachfassen) + 4 h Einarbeitung
    return { einschreiben, auskunft, zeit, wert: zeit * stunden, anwalt: eintraege * 190 };
  }, [eintraege, stunden]);
  const privat = PAKETE.filter((p) => p.art === "privat" && p.abo);
  const business = PAKETE.filter((p) => p.art === "business");

  return (
    <Dunkel seite="privatkunden" titel="Preise & Pakete · FIAON" beschreibung={`FIAON kostet ${geld(privat[0].preisCents)} bis ${geld(privat[privat.length - 1].preisCents)} im Monat, zwölf Raten, keine stille Verlängerung. Nur die Auskunft: ${SCHUFA_PREIS_EURO.toFixed(2).replace(".", ",")} € einmalig. Alle Leistungen im Vergleich – und was Selbermachen kostet.`}>
      <Hero pille="Preise & Pakete" titel={<>Ein Preis, <span className="dk-verlauf">keine Überraschung.</span></>}
            lead="Zwölf monatliche Raten, danach fragen wir, ob Sie bleiben. Keine Provision auf Rahmen, keine Gebühr je Schreiben, kein Kleingedrucktes. Hier steht alles – inklusive dessen, was Selbermachen kostet."
            knoepfe={<><Knopf href="#privat">Pakete ansehen</Knopf><Knopf href="#selbst" still>Was kostet Selbermachen?</Knopf></>}
            szene={<Szenenbild src="/kino/akten.jpg" tief />} />

      <section className="dk-block" style={{ paddingTop: 10 }}>
        <div className="dk-rahmen"><Kennzahlen items={[{ wert: "12", label: "Raten, dann entscheiden Sie" }, { wert: "0 €", label: "Provision, Gebühr je Schreiben, Aufschlag" }, { wert: SCHUFA_PREIS_EURO.toFixed(0) + " €", label: "Nur die Auskunft, ohne Abo" }, { wert: "1", label: "Ansprechpartner in jedem Abo-Paket" }]} /></div>
      </section>

      <Block id="privat" pille="Privatkunden" titel={<>Vier Pakete, <span className="dk-verlauf">eine Auskunft.</span></>} lead="Jedes Paket beginnt mit Ihrer Bonitätsauskunft, erklärt in Menschensprache. Der Unterschied liegt darin, wie viel FIAON danach übernimmt.">
        <div className="pr-tabelle-huelle">
          <table className="pr-tabelle">
            <thead><tr><th>Leistung</th><th><small>Einmalig</small>Auskunft<b>{SCHUFA_PREIS_EURO.toFixed(2).replace(".", ",")} €</b></th>{privat.map((p) => <th key={p.key} className={p.key === "pro" ? "hervor" : ""}><small>{p.key === "pro" ? "Empfohlen" : "Monatlich"}</small>{p.label.replace("FIAON ", "").replace(" (Standard)", "")}<b>{geld(p.preisCents)}</b></th>)}</tr></thead>
            <tbody>{LEISTUNGEN.map(([l, w]) => <tr key={l}><td>{l}</td>{SPALTEN.map((k) => <td key={k} className={k === "pro" ? "hervor" : ""}>{w[k] === true ? <span className="pr-ja">✓</span> : w[k] === false ? <span className="pr-nein">–</span> : <span className="pr-text">{w[k]}</span>}</td>)}</tr>)}</tbody>
            <tfoot><tr><td /><td><a href="/antrag?pack=schufa" className="pr-knopf still">Nur Auskunft</a></td>{privat.map((p) => <td key={p.key} className={p.key === "pro" ? "hervor" : ""}><a href={`/antrag?pack=${p.key}&src=preise`} className={`pr-knopf${p.key === "pro" ? "" : " still"}`}>Wählen</a></td>)}</tr></tfoot>
          </table>
        </div>
        <p className="dk-leise" style={{ marginTop: 14 }}>Alle Preise inklusive Umsatzsteuer. Zwölf Raten per SEPA-Lastschrift; erste Rate per Überweisung. Über Konto, Karte und Rahmen entscheidet die Bank.</p>
      </Block>

      <Licht>
        <Block id="selbst" pille="Werkzeug" titel={<>Was kostet <span className="dk-verlauf">Selbermachen?</span></>} lead="Alles, was FIAON tut, können Sie selbst tun – die Datenkopie ist kostenlos, die Gesetze sind öffentlich. Die Frage ist, was Ihre Zeit wert ist und wie oft Sie nachfassen müssen." mitte>
          <div className="pr-werkzeug">
            <div className="pr-felder">
              <label><span>Einträge, um die es geht: <b>{eintraege}</b></span><input type="range" min={1} max={8} value={eintraege} onChange={(e) => setEintraege(Number(e.target.value))} /></label>
              <label><span>Was eine Stunde Ihrer Zeit wert ist: <b>{euro0(stunden)}</b></span><input type="range" min={10} max={120} step={5} value={stunden} onChange={(e) => setStunden(Number(e.target.value))} /></label>
            </div>
            <div className="pr-vergleich">
              <div className="pr-spalte">
                <small>Selbst</small>
                <ul>
                  <li><span>Datenkopie (Art. 15 DSGVO)</span><b>0 €</b></li>
                  <li><span>Einschreiben, je Eintrag zwei</span><b>{euro0(selbst.einschreiben)}</b></li>
                  <li><span>Eigene Zeit, rund {selbst.zeit} Stunden</span><b>{euro0(selbst.wert)}</b></li>
                  <li className="summe"><span>Ohne Anwalt</span><b>{euro0(selbst.einschreiben + selbst.wert)}</b></li>
                  <li><span>Mit Anwalt (je Eintrag, Richtwert)</span><b>+ {euro0(selbst.anwalt)}</b></li>
                </ul>
              </div>
              <div className="pr-spalte hervor">
                <small>FIAON Pro, zwölf Monate</small>
                <ul>
                  <li><span>Auskunft, Erklärung, Fristen</span><b>inklusive</b></li>
                  <li><span>Schreiben, Versand, Nachfassen</span><b>inklusive</b></li>
                  <li><span>Ihre Zeit: Freigaben, rund 1 Stunde</span><b>{euro0(stunden)}</b></li>
                  <li className="summe"><span>Zwölf Raten</span><b>{euro0((PAKETE.find((p) => p.key === "pro")!.preisCents / 100) * 12)}</b></li>
                  <li><span>Girokonto und Karte vorbereitet</span><b>inklusive</b></li>
                </ul>
              </div>
            </div>
            <p className="dk-leise">Richtwerte. Einschreiben Einwurf rund 5,50 €; Anwaltskosten für ein einfaches Schreiben nach RVG je nach Gegenstandswert. Ehrlich gesagt: Bei einem einzigen, klaren Eintrag lohnt sich Selbermachen – unser Werkzeug „Ist mein Eintrag angreifbar?“ zeigt, wie.</p>
          </div>
        </Block>
      </Licht>

      <Block id="business" pille="Geschäftskunden" titel={<>Für Unternehmen: <span className="dk-verlauf">vier Stufen.</span></>} lead="Unternehmens- und Inhaberauskunft, Firmenkarte mit Zahlungsziel, wachsender Rahmen. Details und Werkzeuge auf der Business-Seite.">
        <div className="pr-business">{business.map((p, i) => <Auf key={p.key} verzoegerung={i * 60}><a href={`/business-antrag?pack=${p.key}`} className="pr-bkarte"><small>{p.label.replace("FIAON ", "")}</small><b>{geld(p.preisCents)}</b><span>im Monat · zwölf Raten</span></a></Auf>)}</div>
        <div className="dk-knoepfe" style={{ marginTop: 24 }}><Knopf href="/business">Zur Business-Seite</Knopf></div>
      </Block>

      <Licht>
        <Block schmal pille="Häufige Fragen">
          <Fragen items={[
            { f: "Kann ich jederzeit kündigen?", a: "Das Paket läuft zwölf Raten; danach fragen wir ausdrücklich, ob Sie bleiben – keine stille Verlängerung. Kündigen können Sie jederzeit im Kundenbereich unter Abo & Zahlungen zum Ende der Laufzeit." },
            { f: "Wird die Auskunft angerechnet, wenn ich später ein Paket nehme?", a: "Ja. Wer zuerst nur die Auskunft bucht und innerhalb von 30 Tagen ein Paket wählt, bekommt den Betrag angerechnet." },
            { f: "Gibt es Kosten je Schreiben oder Erfolgsprovisionen?", a: "Nein. Weder je Schreiben noch auf Löschungen, Konten oder Kartenrahmen. Der Paketpreis ist der Preis." },
            { f: "Wie wird bezahlt?", a: "Erste Rate per Überweisung (Zahlungsdaten mit QR-Code im Kundenbereich), danach SEPA-Lastschrift über einen verifizierten Kreditor. Keine Kreditkarte nötig." },
            { f: "Kann ich das Paket wechseln?", a: "Im Antrag, im Startgespräch und danach jederzeit nach oben; nach unten zum nächsten Ratenlauf." },
          ]} />
        </Block>
      </Licht>

      <Zwischenruf text={<><b>Nicht sicher, welches Paket?</b> Drei Fragen im Paketfinder – oder 15 Minuten mit einem Mitarbeiter.</>} knopf="Paketfinder" href="/plattform-konzept#paketfinder" still={{ knopf: "Zuerst sprechen", href: "/kontakt" }} />
      <Abschluss titel={<>Ihr Weg beginnt <span className="dk-verlauf">mit einer E-Mail-Adresse.</span></>} text="Antrag in zwei Minuten, Auskunft innerhalb von 24 Stunden, ein Mensch, der Sie durch alles Weitere begleitet." knoepfe={<><Knopf href="/antrag">Jetzt starten</Knopf><Knopf href="/privatkunden" still>Privatkunden</Knopf></>} />
    </Dunkel>
  );
}
