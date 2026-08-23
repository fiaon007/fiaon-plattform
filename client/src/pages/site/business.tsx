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
import { useMemo, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Auf, Glas, Kennzahlen, Schritte, Fragen, Zwischenruf, Abschluss } from "@/components/site/DunkleBuehne";
import { PAKETE } from "@shared/fiaon-pakete";
import "@/styles/business.css";

const euro0 = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const preis = (key: string) => { const p = PAKETE.find((x) => x.key === key); return p ? (p.preisCents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 }) + " €" : ""; };
const z = (s: string) => { const n = parseFloat(String(s).replace(/\./g, "").replace(",", ".")); return isFinite(n) && n >= 0 ? n : 0; };

const PAKETE_B = [
  { key: "business_starter", name: "Business Starter", rahmen: 5000, ton: "silber", fuer: "Einzelunternehmer, Freiberufler, junge Gründungen", punkte: ["Bonitätsauskunft für Unternehmen und Inhaber", "Erklärung jedes Eintrags, Löschfristen", "Vorbereitung einer Firmenkarte bis 5.000 € Zielrahmen", "Fester Ansprechpartner"] },
  { key: "business_pro", name: "Business Pro", rahmen: 25000, ton: "gold", fuer: "GmbH, UG, Handel, Dienstleister mit laufenden Ausgaben", punkte: ["Alles aus Starter", "Schreiben an Gläubiger und Auskunfteien, versendet und verfolgt", "Trennung privat/geschäftlich in der Auskunft", "Kartenvorbereitung bis 25.000 € Zielrahmen"], empfohlen: true },
  { key: "business_ultra", name: "Business Ultra", rahmen: 75000, ton: "navy", fuer: "Mehrere Inhaber, mehrere Gesellschaften, Wachstum", punkte: ["Alles aus Pro", "Mehrkarten-Struktur für Geschäftsführung und Mitarbeiter", "Vorrang bei Fristen und Schreiben", "Kartenvorbereitung bis 75.000 € Zielrahmen"] },
  { key: "business_enterprise", name: "Business Enterprise", rahmen: 250000, ton: "schwarz", fuer: "Gruppen, Holdings, internationale Struktur", punkte: ["Alles aus Ultra", "Eigener Ansprechpartner mit direkter Durchwahl", "Reise-, Spesen- und Mitarbeiterkarten", "Strukturen bis 250.000 € Zielrahmen"] },
];

export default function Business() {
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

  return (
    <Dunkel seite="business" titel="FIAON Business · Liquidität, die bleibt" beschreibung="Firmenkreditkarte, Zahlungsziel und saubere Unternehmensbonität: FIAON beschafft die Auskunft, bereinigt Einträge und bereitet Kartenanträge bis 250.000 € Zielrahmen vor. Für Einzelunternehmer bis Holding.">
      <section className="bz-hero">
        <video className="bz-film" autoPlay muted loop playsInline poster="/kino/business.jpg" aria-hidden="true"><source src="/kino/business.mp4" type="video/mp4" /></video>
        <div className="bz-schleier" />
        <div className="dk-rahmen bz-hero-inhalt">
          <Auf>
            <span className="dk-pille">FIAON Business</span>
            <h1 className="dk-h1">Liquidität, <span className="dk-verlauf">die bleibt.</span></h1>
            <p className="dk-lead">Jede Rechnung, die Sie per Karte statt per Überweisung bezahlen, bleibt bis zu 58 Tage im Unternehmen. FIAON sorgt dafür, dass Ihre Bonität die Karte trägt – und der Rahmen wächst.</p>
            <div className="dk-knoepfe"><Knopf href="/business-antrag">Firmenkarte vorbereiten</Knopf><Knopf href="#zahlungsziel" still>Was bringt mir das?</Knopf></div>
          </Auf>
        </div>
      </section>

      <section className="dk-block" style={{ paddingTop: 20 }}>
        <div className="dk-rahmen"><Kennzahlen items={[{ wert: "58", label: "Tage Zahlungsziel – bis die Kartenabrechnung fällig ist" }, { wert: "250k", label: "Euro Zielrahmen in der höchsten Stufe" }, { wert: "3", label: "Länder: Deutschland, Österreich, Schweiz" }, { wert: "1", label: "Ansprechpartner, der Ihr Unternehmen kennt" }]} /></div>
      </section>

      <Block pille="Warum Karte" titel={<>Liquidität ist <span className="dk-verlauf">Zeit.</span></>} lead="Ein Unternehmen stirbt selten an fehlendem Umsatz – es stirbt an Zahlungen, die früher rausgehen als das Geld reinkommt. Die Firmenkarte dreht die Reihenfolge um.">
        <div className="dk-raster" style={{ marginTop: 36 }}>
          <Auf><Glas tag="Zahlungsziel" titel="Heute kaufen, in 58 Tagen bezahlen">Werbung, Software, Einkauf, Reisen – alles, was heute per Lastschrift sofort abgeht, geht per Karte mit der Monatsabrechnung. Bis zu 58 Tage, zinsfrei, jeden Monat aufs Neue.</Glas></Auf>
          <Auf verzoegerung={80}><Glas tag="Trennung" titel="Privat bleibt privat">Geschäftsausgaben auf einer Firmenkarte, Privatkonto unberührt. Buchhaltung in Minuten statt Stunden, und die Inhaber-Bonität wird nicht mit Firmenumsätzen vermischt.</Glas></Auf>
          <Auf verzoegerung={160}><Glas tag="Wachstum" titel="Der Rahmen folgt dem Verhalten">Herausgeber erhöhen Rahmen, wenn die Abrechnung pünktlich beglichen wird. FIAON bereitet jede Aufstockung mit sauberer Auskunft vor – statt zu hoffen, dass die Bank von allein anruft.</Glas></Auf>
        </div>
      </Block>

      <Licht>
        <Block id="zahlungsziel" pille="Werkzeug · Zahlungsziel-Rechner" titel={<>Wie viel Geld bleibt <span className="dk-verlauf">länger im Unternehmen?</span></>} lead="Geben Sie Ihre monatlichen Betriebsausgaben ein. Der Rechner zeigt, welcher Betrag dauerhaft als Liquidität im Unternehmen bleibt, wenn Sie per Karte statt per Überweisung zahlen." mitte>
          <div className="bz-werkzeug">
            <div className="bz-felder">
              <label><span>Betriebsausgaben im Monat (ohne Gehälter und Miete)</span><input inputMode="decimal" placeholder="z. B. 12.000" value={ausgaben} onChange={(e) => setAusgaben(e.target.value)} /></label>
              <label><span>Anteil, der per Karte zahlbar ist: <b>{anteil} %</b></span><input type="range" min={10} max={100} step={5} value={anteil} onChange={(e) => setAnteil(Number(e.target.value))} /><small>Werbung, Software, Reisen, Online-Einkauf: fast immer. Lieferanten mit Kartenakzeptanz: oft. Behörden, Löhne, Miete: selten.</small></label>
            </div>
            {liq && (
              <div className="bz-ergebnis">
                <small>Ergebnis</small>
                <h3>{euro0(liq.frei)} bleiben dauerhaft als Liquidität im Unternehmen.</h3>
                <p>{euro0(liq.ueberKarte)} im Monat laufen über die Karte. Bei durchschnittlich {liq.tage} Tagen zwischen Kauf und Abrechnung entspricht das einem revolvierenden Puffer von rund {euro0(liq.frei)} – zinsfrei, solange die Abrechnung pünktlich beglichen wird. Das ist Geld, das sonst ein Kontokorrent kosten würde.</p>
                <div className="bz-zeile"><span>Benötigter Kartenrahmen (Faustregel: zwei Monatsumsätze)</span><b>{euro0(Math.ceil(liq.ueberKarte * 2 / 500) * 500)}</b></div>
                <div className="dk-knoepfe" style={{ marginTop: 20 }}><Knopf href="#pakete">Passendes Paket</Knopf><Knopf href="/business-antrag" still>Direkt vorbereiten</Knopf></div>
              </div>
            )}
          </div>
        </Block>
      </Licht>

      <Block id="pakete" pille="Pakete" titel={<>Vier Stufen, <span className="dk-verlauf">ein Ziel.</span></>} lead="Jedes Paket enthält die Bonitätsauskunft für Unternehmen und Inhaber, einen festen Ansprechpartner und die Vorbereitung der Firmenkarte. Der Zielrahmen ist das, worauf FIAON hinarbeitet – über den Rahmen entscheidet die Bank.">
        <div className="bz-pakete">
          {PAKETE_B.map((p, i) => (
            <Auf key={p.key} verzoegerung={i * 70}>
              <a href={`/business-antrag?pack=${p.key}`} className={`bz-paket ${p.ton}${p.empfohlen ? " empfohlen" : ""}`}>
                <div className="bz-karte"><span>FIAON</span><b>{p.name}</b><small>Zielrahmen bis {euro0(p.rahmen)}</small></div>
                <div className="bz-paket-text">
                  <p className="bz-preis">{preis(p.key)} <span>im Monat · zwölf Raten</span></p>
                  <p className="bz-fuer">{p.fuer}</p>
                  <ul>{p.punkte.map((x) => <li key={x}>{x}</li>)}</ul>
                  <span className="bz-paket-knopf">{p.empfohlen ? "Empfohlen · Jetzt starten" : "Paket wählen"}</span>
                </div>
              </a>
            </Auf>
          ))}
        </div>
      </Block>

      <Licht>
        <Block id="limit" pille="Werkzeug · Limit-Bedarf" titel={<>Welcher Rahmen <span className="dk-verlauf">passt zu Ihnen?</span></>} lead="Tragen Sie ein, was monatlich über die Karte laufen soll. Der Rechner nennt den sinnvollen Rahmen und das Paket, das dorthin führt." mitte>
          <div className="bz-werkzeug">
            <div className="bz-felder zwei">
              {[["werbung", "Werbung und Anzeigen"], ["software", "Software, Cloud, Lizenzen"], ["reisen", "Reisen, Hotels, Spesen"], ["einkauf", "Wareneinkauf, Material"], ["sonst", "Sonstiges"]].map(([key, l]) => <label key={key}><span>{l}</span><input inputMode="decimal" placeholder="€ im Monat" value={k[key] || ""} onChange={(e) => setK({ ...k, [key]: e.target.value })} /></label>)}
            </div>
            {bedarf && (
              <div className="bz-ergebnis">
                <small>Ergebnis</small>
                <h3>Sinnvoller Rahmen: {euro0(bedarf.rahmen)} – Paket {bedarf.paket.name}.</h3>
                <p>{euro0(bedarf.summe)} im Monat über die Karte, Faustregel zwei Monatsumsätze als Rahmen, damit die Abrechnung nie den Rahmen sprengt. {bedarf.paket.name} bereitet eine Firmenkarte bis {euro0(bedarf.paket.rahmen)} Zielrahmen vor – für {preis(bedarf.paket.key)} im Monat.</p>
                <div className="dk-knoepfe" style={{ marginTop: 20 }}><Knopf href={`/business-antrag?pack=${bedarf.paket.key}`}>{bedarf.paket.name} vorbereiten</Knopf><Knopf href="/kontakt" still>Zuerst sprechen</Knopf></div>
              </div>
            )}
          </div>
        </Block>

        <Block pille="Der Weg" titel={<>Von der Anfrage <span className="dk-verlauf">zur Karte.</span></>}>
          <Schritte items={[
            { titel: "Anfrage in drei Minuten", text: "Unternehmen, Rechtsform, Inhaber, Wunschrahmen. Danach legt Ihr Ansprechpartner den Termin für das Startgespräch." },
            { titel: "Startgespräch", text: "20 Minuten: Ausgaben, Struktur, Ziel. Welche Auskünfte (Unternehmen, Inhaber), welche Karte, welcher Rahmen realistisch ist." },
            { titel: "Auskünfte beschaffen", text: "Unternehmensauskunft (Creditreform, CRIF) und Inhaber-Auskunft (SCHUFA, KSV, CRIF) mit Vollmacht. Jeder Eintrag erklärt." },
            { titel: "Bereinigen und ordnen", text: "Falsche oder angreifbare Einträge werden angegriffen, Privat und Geschäft getrennt, Adressen und Register geprüft." },
            { titel: "Kartenantrag", text: "FIAON bereitet den Antrag beim Kartenpartner vor – vollständig, mit sauberer Auskunft. Sie bestätigen, die Bank entscheidet." },
            { titel: "Rahmen wächst", text: "Pünktliche Abrechnung, laufende Begleitung, Aufstockung vorbereitet. Ihr Ansprechpartner bleibt." },
          ]} />
        </Block>
      </Licht>

      <Block pille="Für wen" titel={<>Vom Einzelunternehmer <span className="dk-verlauf">bis zur Holding.</span></>}>
        <div className="dk-raster" style={{ marginTop: 36 }}>
          <Auf><Glas tag="Gründer & Freiberufler" titel="Die erste Firmenkarte">Banken mögen keine kurzen Historien. FIAON baut die Grundlage: saubere Inhaber-Auskunft, getrenntes Geschäftskonto, erste Karte mit wachsendem Rahmen.</Glas></Auf>
          <Auf verzoegerung={80}><Glas tag="GmbH & Handel" titel="Einkauf auf Zahlungsziel">Wareneinkauf, Werbung, Software über die Karte: 58 Tage Luft bei jeder Abrechnung. Mit Pro oder Ultra inklusive Schreiben an Gläubiger, wenn alte Einträge stören.</Glas></Auf>
          <Auf verzoegerung={160}><Glas tag="Gruppen & Holdings" titel="Strukturen statt Einzelkarten">Mehrere Gesellschaften, mehrere Karten, Spesen und Reisen für Mitarbeiter – mit einem Ansprechpartner, der die ganze Struktur kennt.</Glas></Auf>
        </div>
      </Block>

      <Licht>
        <Block schmal pille="Häufige Fragen">
          <Fragen items={[
            { f: "Garantiert FIAON einen Kartenrahmen?", a: "Nein. Über Karte und Rahmen entscheidet der Herausgeber. FIAON sorgt dafür, dass Auskunft und Unterlagen so sind, dass die Entscheidung positiv ausfallen kann – und bereitet Aufstockungen vor." },
            { f: "Mein Unternehmen ist jung – geht das trotzdem?", a: "Ja. Bei jungen Unternehmen zählt die Bonität der Inhaber. FIAON beschafft beide Auskünfte, trennt privat und geschäftlich und beginnt mit einem Rahmen, der wächst." },
            { f: "Was kostet es – und gibt es versteckte Gebühren?", a: `Die Pakete kosten ${preis("business_starter")} bis ${preis("business_enterprise")} im Monat, zwölf Raten. Kartengebühren legt der Herausgeber fest; FIAON nennt sie vorher. Keine Provision auf Rahmen.` },
            { f: "Welche Karten sind möglich?", a: "Firmenkreditkarten mit Monatsabrechnung (Charge) internationaler Herausgeber, je nach Land und Profil. Welche konkret, klärt das Startgespräch – abhängig von Rechtsform, Umsatz und Auskunft." },
            { f: "Auch in Österreich und der Schweiz?", a: "Ja. FIAON kennt KSV1870, CRIF und das Betreibungsregister und arbeitet mit Kartenpartnern in allen drei Ländern." },
          ]} />
        </Block>
      </Licht>

      <Zwischenruf text={<><b>Lieber zuerst sprechen?</b> Ein Mitarbeiter erklärt in 15 Minuten, was für Ihr Unternehmen realistisch ist.</>} knopf="Termin vereinbaren" href="/kontakt" still={{ knopf: "Assistent fragen", href: "/kontakt#assistent" }} />
      <Abschluss titel={<>Die Karte, die Ihr Unternehmen <span className="dk-verlauf">verdient.</span></>} text="Anfrage in drei Minuten, Startgespräch in der Regel innerhalb von zwei Werktagen, ein Ansprechpartner, der bleibt." knoepfe={<><Knopf href="/business-antrag">Firmenkarte vorbereiten</Knopf><Knopf href="#pakete" still>Pakete ansehen</Knopf></>} />
    </Dunkel>
  );
}
