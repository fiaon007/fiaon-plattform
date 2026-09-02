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
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Hero, Block, Licht, Knopf, Auf, Kennzahlen, Fragen, Zwischenruf, Abschluss, Glas } from "@/components/site/DunkleBuehne";
import KartenSzene from "@/components/home3d/KartenSzene";
import SeoDaten from "@/components/site/SeoDaten";
import { PAKETE, SCHUFA_PREIS_EURO } from "@shared/fiaon-pakete";
import "@/styles/preise.css";
import "@/styles/plattform-konzept.css";
import "@/styles/seo-seiten.css";
import "@/styles/ratgeber.css";

const geld = (c: number) => (c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 }) + " €";
const euro0 = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const LEISTUNGEN: [string, Record<string, boolean | string>][] = [
  ["Bonitätsauskunft beschafft und erklärt (SCHUFA, KSV, CRIF)", { schufa: true, start: true, pro: true, ultra: true, highend: true }],
  ["Neuer SCHUFA-Score (100–999) je Kriterium eingeordnet", { schufa: true, start: true, pro: true, ultra: true, highend: true }],
  ["Löschfristen und 100-Tage-Regel je Eintrag", { schufa: true, start: true, pro: true, ultra: true, highend: true }],
  ["Finanzauswertung aus dem Kontoauszug", { schufa: false, start: true, pro: true, ultra: true, highend: true }],
  ["Schreiben an Gläubiger und Auskunfteien", { schufa: false, start: "zum Selbstversand", pro: "FIAON versendet", ultra: "FIAON versendet", highend: "FIAON versendet" }],
  ["Fristen verfolgt, Antworten bewertet, Eskalation zur Aufsicht", { schufa: false, start: false, pro: true, ultra: true, highend: true }],
  ["Ratenvereinbarungen mit Gläubigern", { schufa: false, start: false, pro: true, ultra: true, highend: true }],
  ["Girokonto vorbereitet", { schufa: false, start: false, pro: true, ultra: true, highend: true }],
  ["Kreditkarte vorbereitet", { schufa: false, start: false, pro: "ab Schwelle", ultra: true, highend: true }],
  ["Fester Ansprechpartner", { schufa: false, start: true, pro: true, ultra: true, highend: true }],
  ["Vorrang bei Fristen und Rückfragen", { schufa: false, start: false, pro: false, ultra: true, highend: true }],
  ["Direkte Durchwahl, alles aus einer Hand", { schufa: false, start: false, pro: false, ultra: false, highend: true }],
];
const SPALTEN = ["schufa", "start", "pro", "ultra", "highend"];

// ── Paketfinder — dieselben drei Fragen wie auf /plattform-konzept. ───────────
type Antwort = Record<string, string>;
const FINDER = [
  { key: "wer", frage: "Für wen suchen Sie?", optionen: [["privat", "Für mich privat"], ["business", "Für mein Unternehmen"]] },
  { key: "lage", frage: "Wie ist die Lage?", optionen: [["klar", "Ich will nur wissen, was drinsteht"], ["eintrag", "Es gibt Einträge, die weg sollen"], ["zugang", "Ich brauche Konto oder Karte"], ["alles", "Alles davon – und einen festen Ansprechpartner"]] },
  { key: "tempo", frage: "Wie schnell soll es gehen?", optionen: [["ruhig", "In Ruhe, Schritt für Schritt"], ["zuegig", "Zügig, ich habe Fristen"], ["sofort", "So schnell wie irgendwie möglich"]] },
];
function paketFuer(a: Antwort): { key: string; grund: string } | null {
  if (!a.wer || !a.lage || !a.tempo) return null;
  if (a.wer === "business") return a.lage === "klar" ? { key: "business_starter", grund: "Übersicht über die Bonität des Unternehmens und der Inhaber – der Einstieg." } : a.tempo === "sofort" ? { key: "business_ultra", grund: "Fristen, Vorrang und Kartenvorbereitung – wenn es schnell gehen muss." } : { key: "business_pro", grund: "Auskünfte, Bereinigung und Kartenvorbereitung für Unternehmen." };
  if (a.lage === "klar") return { key: "schufa", grund: "Nur die Auskunft, erklärt – kein Abo. Wer danach mehr will, rechnet den Betrag an." };
  if (a.lage === "eintrag") return a.tempo === "ruhig" ? { key: "start", grund: "Auskunft, Erklärung und die Schreiben zum Selbstversand – günstig und vollständig." } : { key: "pro", grund: "FIAON versendet und verfolgt – bei Fristen der sichere Weg." };
  if (a.lage === "zugang") return { key: "pro", grund: "Konto- und Kartenvorbereitung sind ab Pro enthalten." };
  return a.tempo === "sofort" ? { key: "highend", grund: "Vorrang bei allem, direkter Draht, alles aus einer Hand." } : { key: "ultra", grund: "Bereinigen, Konto, Karte und ein fester Ansprechpartner – das volle Programm." };
}

const FRAGEN = [
  { f: "Kann ich jederzeit kündigen?", a: "Ja – jederzeit zum Ende des laufenden Monats, formlos und ohne Grund: im Kundenbereich unter Abo & Zahlungen oder per E-Mail. Das Paket ist auf zwölf Raten angelegt, weil Auskunft, Schreiben und Antworten Zeit brauchen – aber niemand ist gebunden. Das gesetzliche Widerrufsrecht von 14 Tagen gilt zusätzlich." },
  { f: "Wird die Auskunft angerechnet, wenn ich später ein Paket nehme?", a: "Ja. Wer zuerst nur die Auskunft bucht und innerhalb von 30 Tagen ein Paket wählt, bekommt den Betrag auf die erste Rate angerechnet. Sagen Sie es im Startgespräch oder im Kundenbereich – Ihr Ansprechpartner trägt es ein." },
  { f: "Gibt es Kosten je Schreiben oder Erfolgsprovisionen?", a: "Nein. Weder je Schreiben noch auf Löschungen, Konten oder Kartenrahmen. Der Paketpreis ist der Preis. Einschreiben-Porto, Nachfassen, Eskalation – alles enthalten." },
  { f: "Wie wird bezahlt?", a: "Erste Rate per Überweisung (Zahlungsdaten mit QR-Code im Kundenbereich), danach SEPA-Lastschrift über einen verifizierten Kreditor, jeweils zum Monatsanfang. Keine Kreditkarte nötig, keine Vorkasse für Leistungen, die noch nicht erbracht sind." },
  { f: "Kann ich das Paket wechseln?", a: "Im Antrag, im Startgespräch und danach jederzeit nach oben; nach unten zum nächsten Ratenlauf. Der Paketfinder auf dieser Seite gibt die erste Orientierung – die endgültige Zuordnung besprechen Sie im Startgespräch." },
  { f: "Was, wenn alle meine Einträge berechtigt sind?", a: "Dann sagen wir es Ihnen nach der Auskunft – und Sie entscheiden, ob Sie weitermachen. Auch bei berechtigten Einträgen gibt es einen Weg: Erledigt-Vermerke, Ratenvereinbarungen mit Meldeverzicht, das Girokonto, die Zahlungshistorie. Nur Löschung gibt es dann nicht, und das versprechen wir auch nicht." },
];

export default function Preise() {
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
    <Dunkel seite="privatkunden" titel="Preise & Pakete · FIAON" beschreibung={`FIAON kostet ${geld(privat[0].preisCents)} bis ${geld(privat[privat.length - 1].preisCents)} im Monat, zwölf Raten, monatlich kündbar. Bonitätsauskunft ${SCHUFA_PREIS_EURO} € einmalig. Alle Pakete, alle Leistungen, keine Sternchen.`}>
      <SeoDaten pfad="/preise" titel="Preise & Pakete: FIAON ab 7,99 € im Monat" beschreibung="Alle FIAON-Pakete auf einen Blick: Start, Pro, Ultra, High-End und Business – was enthalten ist, was es kostet, was Selbermachen kostet. Zwölf Raten." fragen={FRAGEN} krumen={[{ name: "Preise & Pakete", pfad: "/preise" }]} />

      <Hero
        bild="/kino/karte.jpg"
        pille="Preise & Pakete"
        titel={<>Ein Preis, <span className="dk-verlauf">keine Überraschung.</span></>}
        lead="Zwölf monatliche Raten, monatlich kündbar, danach fragen wir, ob Sie bleiben. Keine Provision auf Rahmen, keine Gebühr je Schreiben, kein Kleingedrucktes. Hier steht alles – inklusive dessen, was Selbermachen und Anwalt kosten."
        knoepfe={<><Knopf href="#finder">Welches Paket passt?</Knopf><Knopf href="#privat" still>Alle Pakete</Knopf></>}
        szene={<KartenSzene anzahl={1} className="absolute inset-0" />}
      />

      <Block eng>
        <Kennzahlen items={[{ wert: "12", label: "Raten, monatlich kündbar" }, { wert: "0 €", label: "Provision, Gebühr je Schreiben, Aufschlag" }, { wert: `${SCHUFA_PREIS_EURO} €`, label: "Auskunft einmalig, anrechenbar" }, { wert: geld(privat[0].preisCents), label: "günstigstes Paket im Monat" }]} />
      </Block>

      <Licht>
        <Block id="finder" schmal titel={<>Drei Fragen, <span className="dk-verlauf">ein Paket.</span></>} lead="Kein Verkaufsgespräch – eine ehrliche Zuordnung. Jedes Paket lässt sich im Antrag und im Startgespräch noch ändern.">
          <div className="pk-finder">
            {FINDER.map((f, i) => (
              <div key={f.key} className={`pk-frage${a[f.key] ? " beantwortet" : ""}`}>
                <p className="pk-frage-nr">Frage {i + 1}</p><h3>{f.frage}</h3>
                <div className="pk-optionen">{f.optionen.map(([w, l]) => <button key={w} type="button" className={`pk-option${a[f.key] === w ? " an" : ""}`} onClick={() => setA({ ...a, [f.key]: w })}>{l}</button>)}</div>
              </div>
            ))}
            {paketV && vorschlag && (
              <div className="pk-ergebnis">
                <small>Unser Vorschlag</small>
                <h3>{paketV.label}</h3>
                <p className="pk-preis">{paketV.abo ? <>{geld(paketV.preisCents)} <span>im Monat · zwölf Raten · {geld(paketV.preisCents * 12)} gesamt</span></> : <>{SCHUFA_PREIS_EURO.toLocaleString("de-DE", { minimumFractionDigits: 2 })} € <span>einmalig</span></>}</p>
                <p>{vorschlag.grund}</p>
                <div className="pk-weg-knoepfe"><Knopf href={paketV.key === "schufa" ? "/antrag?pack=schufa" : paketV.art === "business" ? "/business" : `/antrag?pack=${paketV.key}&src=preise`}>{paketV.art === "business" ? "Zur Business-Seite" : "Dieses Paket wählen"}</Knopf><Knopf href="/kontakt" still>Lieber erst reden</Knopf></div>
              </div>
            )}
          </div>
        </Block>
      </Licht>

      <Block id="privat" pille="Privatkunden" titel={<>Vier Pakete, <span className="dk-verlauf">eine Auskunft.</span></>} lead="Jedes Paket beginnt mit Ihrer Bonitätsauskunft, erklärt in Menschensprache – inklusive des neuen SCHUFA-Scores je Kriterium. Der Unterschied liegt darin, wie viel FIAON danach übernimmt.">
        <div className="pr-tabelle-huelle">
          <table className="pr-tabelle">
            <thead><tr><th>Leistung</th><th><small>Einmalig</small>Auskunft<b>{SCHUFA_PREIS_EURO.toFixed(2).replace(".", ",")} €</b></th>{privat.map((p) => <th key={p.key} className={p.key === "pro" ? "hervor" : ""}><small>{p.key === "pro" ? "Meistgewählt" : "im Monat"}</small>{p.label.replace("FIAON ", "").replace(" (Standard)", "")}<b>{geld(p.preisCents)}</b></th>)}</tr></thead>
            <tbody>{LEISTUNGEN.map(([l, w]) => <tr key={l}><td>{l}</td>{SPALTEN.map((k) => <td key={k} className={k === "pro" ? "hervor" : ""}>{w[k] === true ? <span className="pr-ja">✓</span> : w[k] === false ? <span className="pr-nein">–</span> : <span className="pr-text">{String(w[k])}</span>}</td>)}</tr>)}</tbody>
            <tfoot><tr><td /><td><a href="/antrag?pack=schufa" className="pr-knopf still">Nur Auskunft</a></td>{privat.map((p) => <td key={p.key} className={p.key === "pro" ? "hervor" : ""}><a href={`/antrag?pack=${p.key}&src=preise`} className={`pr-knopf${p.key === "pro" ? "" : " still"}`}>Wählen</a></td>)}</tr></tfoot>
          </table>
        </div>
        <p className="dk-leise" style={{ marginTop: 14 }}>Alle Preise inklusive Umsatzsteuer. Zwölf Raten per SEPA-Lastschrift, erste Rate per Überweisung, monatlich kündbar. Über Konto, Karte und Rahmen entscheidet die Bank – FIAON bereitet vor. Preise gelten in Deutschland, Österreich und der Schweiz (Abrechnung in Euro).</p>
      </Block>

      <Licht>
        <Block id="fall" schmal titel={<>Was kostet <span className="dk-verlauf">mein Fall?</span></>} lead="Drei Angaben – der Rechner nennt das passende Paket, den Gesamtpreis über zwölf Raten und was derselbe Fall beim Anwalt oder in eigener Zeit kostet.">
          <div className="pr-werkzeug">
            <div className="pr-felder">
              <label><span>Einträge, um die es geht: <b>{eintraege}</b></span><input type="range" min={1} max={8} value={eintraege} onChange={(e) => setEintraege(Number(e.target.value))} /></label>
              <label><span>Auskunfteien / Länder: <b>{laender}</b></span><input type="range" min={1} max={3} value={laender} onChange={(e) => setLaender(Number(e.target.value))} /></label>
              <label><span>Was eine Stunde Ihrer Zeit wert ist: <b>{euro0(stunden)}</b></span><input type="range" min={10} max={120} step={5} value={stunden} onChange={(e) => setStunden(Number(e.target.value))} /></label>
            </div>
            <div className="wz-optionen" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginTop: 12 }}>
              <button type="button" className={`wz-option${ziel === "auskunft" ? " an" : ""}`} onClick={() => setZiel("auskunft")}><b>Nur wissen, was drinsteht</b></button>
              <button type="button" className={`wz-option${ziel === "konto" ? " an" : ""}`} onClick={() => setZiel("konto")}><b>Einträge angehen, Konto</b></button>
              <button type="button" className={`wz-option${ziel === "karte" ? " an" : ""}`} onClick={() => setZiel("karte")}><b>Bis zur Kreditkarte</b></button>
            </div>
            <div className="pr-vergleich" style={{ marginTop: 22 }}>
              <div className="pr-spalte hervor">
                <small>{fall.p.label}</small>
                <ul>
                  <li><span>{fall.p.abo ? "Zwölf Raten à " + geld(fall.p.preisCents) : "Einmalig"}</span><b>{euro0(fall.gesamt)}</b></li>
                  <li><span>Auskunft{laender > 1 ? ` bei ${laender} Auskunfteien` : ""}, Erklärung, Fristen</span><b>inklusive</b></li>
                  <li><span>{fall.p.key === "schufa" ? "Schreiben" : fall.p.key === "start" ? "Schreiben zum Selbstversand" : "Schreiben, Versand, Nachfassen"}</span><b>{fall.p.key === "schufa" ? "–" : "inklusive"}</b></li>
                  <li><span>Ihre Zeit: Freigaben, rund 1 Stunde</span><b>{euro0(stunden)}</b></li>
                  <li className="summe"><span>Gesamt</span><b>{euro0(fall.gesamt + stunden)}</b></li>
                </ul>
              </div>
              <div className="pr-spalte">
                <small>Selbst, ohne Anwalt</small>
                <ul>
                  <li><span>Datenkopie (Art. 15 DSGVO)</span><b>0 €</b></li>
                  <li><span>Einschreiben, je Eintrag zwei</span><b>{euro0(eintraege * 11)}</b></li>
                  <li><span>Eigene Zeit, rund {fall.selbstZeit} Stunden</span><b>{euro0(fall.selbstZeit * stunden)}</b></li>
                  <li className="summe"><span>Gesamt</span><b>{euro0(fall.selbstWert)}</b></li>
                  <li><span>Mit Anwalt je Schreiben (Richtwert)</span><b>+ {euro0(fall.anwalt)}</b></li>
                </ul>
              </div>
            </div>
            <p className="dk-leise">Richtwerte: Einschreiben Einwurf rund 5,50 €; Anwaltskosten für ein einfaches Schreiben nach RVG je nach Gegenstandswert, hier 190 € je Eintrag. Ehrlich gesagt: Bei einem einzigen, klaren Eintrag reichen die kostenlosen <a href="/werkzeuge" style={{ color: "#1d4ed8" }}>Werkzeuge</a> oft aus – nutzen Sie sie.</p>
          </div>
        </Block>

        <Block schmal titel={<>Der Zahlungsweg – <span className="dk-verlauf">Schritt für Schritt.</span></>} lead="Keine Vorkasse für Leistungen, die noch nicht erbracht sind. So läuft die Zahlung wirklich.">
          <Auf>
            <div className="sx-zeitleiste">
              <div className="sx-etappe"><div className="spur"><span className="punkt">1</span><span className="faden" /></div><div className="inhalt"><span className="dauer">Tag 0</span><h3>Antrag, Paket, Vertrag</h3><p>Sie wählen das Paket, sehen den Preis, nehmen den Vertrag an. Ihr Kundenbereich ist sofort aktiv – noch ohne Zahlung.</p></div></div>
              <div className="sx-etappe"><div className="spur"><span className="punkt">2</span><span className="faden" /></div><div className="inhalt"><span className="dauer">Tag 0–3</span><h3>Erste Rate per Überweisung</h3><p>Zahlungsdaten mit QR-Code im Kundenbereich. Sobald die Bank den Eingang bestätigt, startet das Startgespräch – „bezahlt“ heißt bei FIAON immer bankbestätigt.</p></div></div>
              <div className="sx-etappe"><div className="spur"><span className="punkt">3</span><span className="faden" /></div><div className="inhalt"><span className="dauer">ab Monat 2</span><h3>SEPA-Lastschrift zum Monatsanfang</h3><p>Ein Mandat, elf weitere Raten über einen verifizierten Kreditor. Zwei Tage vorher erinnert der Zahlungskalender. Keine Kreditkarte nötig.</p></div></div>
              <div className="sx-etappe"><div className="spur"><span className="punkt">4</span></div><div className="inhalt"><span className="dauer">jederzeit</span><h3>Kündigen zum Monatsende, formlos</h3><p>Im Kundenbereich unter Abo & Zahlungen oder per E-Mail. Nach der zwölften Rate fragen wir, ob Sie bleiben – Ansprechpartner, Akte und Fristenüberwachung laufen dann weiter.</p></div></div>
            </div>
          </Auf>
        </Block>

        <Block schmal titel="Zum Weiterlesen">
          <div className="sx-vertiefen">
            <a href="/fiaon-erfahrungen"><b>So arbeitet FIAON</b><span>Bankbestätigte Zahlen, Ablauf, Grenzen, Seriositäts-Check für jeden Anbieter.</span></a>
            <a href="/bonitaetsauskunft-beantragen"><b>Bonitätsauskunft beantragen</b><span>Was die 74 Euro leisten – und wann der kostenlose Weg reicht.</span></a>
            <a href="/kreditkarte"><b>Kreditkarte trotz Eintrag</b><span>Welche Karte heute realistisch ist und wie der Rahmen wächst.</span></a>
            <a href="/werkzeuge"><b>20 kostenlose Werkzeuge</b><span>Alles, was Sie selbst tun können – bevor Sie etwas bezahlen.</span></a>
          </div>
        </Block>
      </Licht>

      <Block id="business" pille="Geschäftskunden" titel={<>Für Unternehmen: <span className="dk-verlauf">vier Stufen.</span></>} lead="Unternehmens- und Inhaberauskunft, Firmenkarte mit Zahlungsziel, wachsender Rahmen. Details und Rechner auf der Business-Seite.">
        <div className="pr-business">{business.map((p, i) => <Auf key={p.key} verzoegerung={i * 60}><a href={`/business-antrag?pack=${p.key}`} className="pr-bkarte"><small>{p.label.replace("FIAON ", "")}</small><b>{geld(p.preisCents)}</b><span>im Monat · zwölf Raten</span></a></Auf>)}</div>
        <div className="dk-knoepfe" style={{ marginTop: 24 }}><Knopf href="/business">Zur Business-Seite</Knopf></div>
      </Block>

      <Licht>
        <Block schmal>
          <Glas ruhig tag="Ehrlich gesagt" titel="Wann Sie FIAON nicht brauchen">
            <p className="dk-text" style={{ fontSize: 15, lineHeight: 1.7 }}>Ein einziger, klar erledigter Eintrag ohne Erledigt-Vermerk? Der <a href="/werkzeuge/widerspruch" style={{ color: "#1d4ed8" }}>Löschantrag-Generator</a> schreibt den Brief kostenlos. Nur wissen, was drinsteht? Die Datenkopie nach Art. 15 DSGVO ist kostenlos – der <a href="/werkzeuge/selbstauskunft" style={{ color: "#1d4ed8" }}>Generator</a> auch. FIAON lohnt sich, wenn mehrere Einträge, mehrere Länder, Fristen und Antworten zu verfolgen sind – oder wenn am Ende Konto und Karte stehen sollen.</p>
          </Glas>
        </Block>
        <Block schmal pille="Häufige Fragen"><Fragen items={FRAGEN} /></Block>
      </Licht>

      <Zwischenruf text={<><b>Nicht sicher, welches Paket?</b> Drei Fragen im Paketfinder oben – oder 15 Minuten mit einem Mitarbeiter.</>} knopf="Paketfinder" href="#finder" still={{ knopf: "Kontakt aufnehmen", href: "/kontakt" }} />
      <Abschluss titel={<>Ihr Weg beginnt <span className="dk-verlauf">mit einer E-Mail-Adresse.</span></>} text={`Antrag in zwei Minuten, Auskunft innerhalb von 24 Stunden nach Vorliegen, ein Mensch, der Sie durch alles führt – ab ${geld(privat[0].preisCents)} im Monat, monatlich kündbar.`} knoepfe={<><Knopf href={`/antrag?pack=${pro.key}&src=preise`}>Mit {pro.label.replace(" (Standard)", "")} starten</Knopf><Knopf href="/antrag?pack=schufa" still>Nur die Auskunft</Knopf></>} />
    </Dunkel>
  );
}
