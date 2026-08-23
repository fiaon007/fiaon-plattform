// ═══════════════════════════════════════════════════════════════════════════
// /plattform-konzept — Die ganze Plattform, erklärt (23.08.2026)
//
// Justin: „komplett umbauen, neue Sektionen, nützliche Werkzeuge, die Seite
// soll Spaß machen, die gesamte Plattform erklären, hochwertiges Design."
// Aufbau: Bühne → drei Schichten → der Weg (interaktiv, Tag für Tag) →
// Paketfinder → Kundenbereich-Karte → Startgespräch → DACH → Technik &
// Sicherheit → was FIAON nicht ist → Fragen → Abschluss.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Hero, Block, Licht, Knopf, Auf, Glas, Karten, Kennzahlen, Zeilen, Fragen, Zwischenruf, Abschluss, Szenenbild } from "@/components/site/DunkleBuehne";
import { PAKETE, SCHUFA_PREIS_EURO } from "@shared/fiaon-pakete";
import { AGENDA } from "@shared/fiaon-onboarding-agenda";
import "@/styles/plattform-konzept.css";

const euro = (c: number) => (c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 }) + " €";

// ── Der Weg, Tag für Tag ─────────────────────────────────────────────────
const WEG = [
  { tag: "Tag 0", titel: "Antrag in zwei Minuten", text: "E-Mail, Name, Adresse, Beschäftigung. Vertrag annehmen – und Sie sind sofort in Ihrem Bereich, Passwort festlegen, Zahlung oder Termin wählen.", bereich: "Übersicht · Einrichtung" },
  { tag: "Tag 1–3", titel: "Startgespräch, 15 Minuten", text: "Ein Mitarbeiter ruft an: Lage, Ziel, Unterlagen, nächste Schritte. Danach kennen Sie Ihren festen Ansprechpartner.", bereich: "Mein Fahrplan" },
  { tag: "Tag 1–5", titel: "Unterlagen mit dem Handy", text: "Kontoauszug der letzten drei Monate und Ausweis fotografieren. Vollmacht für die Auskunft digital unterschreiben.", bereich: "Unterlagen" },
  { tag: "Tag 3–10", titel: "Auskunft beschafft", text: "FIAON holt die Bonitätsauskunft bei SCHUFA, KSV1870 oder CRIF. Jeder Eintrag wird in Menschensprache erklärt und bewertet: berechtigt, angreifbar, falsch.", bereich: "Meine Bonität" },
  { tag: "Tag 5–12", titel: "Finanzauswertung", text: "Aus dem Kontoauszug entsteht Ihre Übersicht: Einnahmen, Fixkosten, Spielraum. Ohne Bewertung, ohne Belehrung – nur Klarheit.", bereich: "Meine Finanzen" },
  { tag: "Tag 10–20", titel: "Schreiben gehen raus", text: "Für angreifbare Einträge liegen anwaltlich geprüfte Schreiben bereit. Sie geben frei, FIAON versendet per Einschreiben und verfolgt die Frist.", bereich: "Meine Schreiben" },
  { tag: "Woche 3–8", titel: "Antworten und Löschungen", text: "Gläubiger und Auskunfteien antworten. FIAON bewertet, hakt nach, eskaliert bei Bedarf zur Datenschutzbehörde. Jeder Stand in der Akte.", bereich: "Meine Schreiben" },
  { tag: "Woche 2–6", titel: "Girokonto", text: "Unabhängig von der Bonität: FIAON bereitet die Kontoeröffnung vor, Sie bestätigen bei der Bank. Ein Konto, das nicht gekündigt wird, weil ein Eintrag auftaucht.", bereich: "Meine Vorteile" },
  { tag: "Ab Monat 2", titel: "Kreditkarte", text: "Sobald Ihr Wert die Schwelle des Kartenpartners erreicht, bereitet FIAON den Kartenantrag vor. Über Karte und Rahmen entscheidet die Bank – FIAON sorgt dafür, dass die Unterlagen stimmen.", bereich: "Meine Vorteile" },
  { tag: "Monat 12", titel: "Sie entscheiden", text: "Zwölf Raten, dann ist das Paket erfüllt. Bleiben Sie, bleibt der Ansprechpartner, die Akte, die Frist-Überwachung. Gehen Sie, gehen Sie mit sauberer Auskunft.", bereich: "Abo & Zahlungen" },
];

// ── Paketfinder ──────────────────────────────────────────────────────────
type Antwort = Record<string, string>;
const FRAGEN = [
  { key: "wer", frage: "Für wen suchen Sie?", optionen: [["privat", "Für mich privat"], ["business", "Für mein Unternehmen"]] },
  { key: "lage", frage: "Wie ist die Lage?", optionen: [["klar", "Ich will nur wissen, was drinsteht"], ["eintrag", "Es gibt Einträge, die weg sollen"], ["zugang", "Ich brauche Konto oder Karte"], ["alles", "Alles davon – und einen festen Ansprechpartner"]] },
  { key: "tempo", frage: "Wie schnell soll es gehen?", optionen: [["ruhig", "In Ruhe, Schritt für Schritt"], ["zuegig", "Zügig, ich habe Fristen"], ["sofort", "So schnell wie irgendwie möglich"]] },
];
function paketFuer(a: Antwort): { key: string; grund: string } | null {
  if (!a.wer || !a.lage || !a.tempo) return null;
  if (a.wer === "business") return a.lage === "klar" ? { key: "business_starter", grund: "Übersicht über die Bonität des Unternehmens und der Inhaber – der Einstieg." } : a.tempo === "sofort" ? { key: "business_ultra", grund: "Fristen, Schreiben und Kartenvorbereitung mit Vorrang." } : { key: "business_pro", grund: "Einträge bereinigen und Liquidität vorbereiten – das Paket für die meisten Unternehmen." };
  if (a.lage === "klar") return { key: "schufa", grund: "Nur die Auskunft, erklärt – kein Abo. Wer danach mehr will, rechnet den Betrag an." };
  if (a.lage === "eintrag") return a.tempo === "ruhig" ? { key: "start", grund: "Auskunft, Erklärung und die Schreiben zum Selbstversand – günstig und vollständig." } : { key: "pro", grund: "FIAON versendet und verfolgt – bei Fristen der Unterschied zwischen Tag 100 und Tag 101." };
  if (a.lage === "zugang") return { key: "pro", grund: "Konto- und Kartenvorbereitung sind ab Pro enthalten." };
  return a.tempo === "sofort" ? { key: "highend", grund: "Vorrang bei allem, direkter Draht, alles aus einer Hand." } : { key: "ultra", grund: "Bereinigen, Konto, Karte und ein fester Ansprechpartner – das volle Programm." };
}

const BEREICH = [
  ["Übersicht", "Fahrplan mit Etappen, nächste Schritte, Stand der Akte."], ["Meine Bonität", "Jeder Eintrag erklärt und bewertet; Score-Entwicklung."], ["Konto verbinden", "Kontoanbindung für die laufende Auswertung (kommt)."], ["Meine Finanzen", "Einnahmen, Fixkosten, Spielraum aus dem Kontoauszug."],
  ["Mein Fahrplan", "Startgespräch, Unterlagen, Auskunft, Analyse, Schreiben, Konto, Karte."], ["Meine Schreiben", "Entwürfe, Freigabe, Versand, Fristen, Antworten."], ["Unterlagen", "Handyfoto genügt. Alles an einem Ort."], ["Meine Vorteile", "Girokonto, Karte, Partnerangebote."],
  ["Mein Konto", "Daten, Ansprechpartner, Referenz."], ["Abo & Zahlungen", "Raten, Zahlungskalender, Abo kündigen."], ["Passwort & Sicherheit", "Passwort ändern, Sitzungen."], ["Hilfe", "Anliegen direkt an den Ansprechpartner, nachlesbar in der Akte."],
];

export default function PlattformKonzept() {
  const [schritt, setSchritt] = useState(0);
  const [a, setA] = useState<Antwort>({});
  const vorschlag = useMemo(() => paketFuer(a), [a]);
  const paket = vorschlag ? PAKETE.find((p) => p.key === vorschlag.key) : null;

  return (
    <Dunkel seite="plattform-konzept" titel="Plattform-Konzept · So funktioniert FIAON" beschreibung="Die ganze Plattform erklärt: drei Schichten, der Weg Tag für Tag, Paketfinder, Kundenbereich, Startgespräch, DACH, Technik und Sicherheit – und was FIAON nicht ist.">
      <Hero pille="Plattform-Konzept" titel={<>Bonität, <span className="dk-verlauf">zu Ende gedacht.</span></>}
            lead="Einsicht, Aktion, Zugang: FIAON beschafft Ihre Auskunft, bereinigt, was angreifbar ist, und öffnet Konto und Karte. Hier ist die ganze Plattform – Schicht für Schicht, Tag für Tag."
            knoepfe={<><Knopf href="#weg">Den Weg ansehen</Knopf><Knopf href="#paketfinder" still>Paketfinder</Knopf></>}
            szene={<Szenenbild src="/kino/hirn.jpg" tief />} />

      <Block id="schichten" pille="Drei Schichten" titel={<>Eine Plattform, <span className="dk-verlauf">drei Schichten.</span></>} lead="Jede Schicht baut auf der vorigen auf. Die meisten Anbieter hören nach der ersten auf.">
        <div className="pk-schichten">
          <Auf><div className="pk-schicht"><span className="pk-nr">I</span><h3>Einsicht</h3><p>Die Bonitätsauskunft – SCHUFA, KSV1870, CRIF – mit Vollmacht beschafft und in Menschensprache erklärt. Dazu die Auswertung des Kontoauszugs: Einnahmen, Fixkosten, Spielraum.</p><small>Ergebnis: Sie wissen, was die Auskunfteien über Sie wissen.</small></div></Auf>
          <Auf verzoegerung={90}><div className="pk-schicht"><span className="pk-nr">II</span><h3>Aktion</h3><p>Für jeden angreifbaren Eintrag ein anwaltlich geprüftes Schreiben: Löschantrag, Widerspruch, Berichtigung, Ratenangebot. Sie geben frei, FIAON versendet per Einschreiben, verfolgt Fristen und Antworten.</p><small>Ergebnis: Was nicht hingehört, ist weg.</small></div></Auf>
          <Auf verzoegerung={180}><div className="pk-schicht"><span className="pk-nr">III</span><h3>Zugang</h3><p>Girokonto für jeden Kunden, unabhängig von der Bonität. Kreditkarte, sobald der Wert die Schwelle des Kartenpartners erreicht. Später Finanzierung. Über alles entscheidet die Bank – FIAON bereitet vor.</p><small>Ergebnis: Türen, die vorher zu waren.</small></div></Auf>
        </div>
      </Block>

      <Licht>
        <Block id="weg" pille="Der Weg" titel={<>Was passiert, <span className="dk-verlauf">Tag für Tag.</span></>} lead="Klicken Sie sich durch. Jede Station zeigt, was FIAON tut, was Sie tun – und wo es im Kundenbereich steht.">
          <div className="pk-weg">
            <div className="pk-weg-leiste" role="tablist">
              {WEG.map((w, i) => <button key={w.tag} type="button" role="tab" aria-selected={schritt === i} className={`pk-weg-punkt${schritt === i ? " an" : ""}${i < schritt ? " vorbei" : ""}`} onClick={() => setSchritt(i)}><span>{w.tag}</span><b>{w.titel}</b></button>)}
            </div>
            <div className="pk-weg-karte" key={schritt}>
              <small>{WEG[schritt].tag} · im Bereich: {WEG[schritt].bereich}</small>
              <h3>{WEG[schritt].titel}</h3>
              <p>{WEG[schritt].text}</p>
              <div className="pk-weg-knoepfe">
                <button type="button" className="dk-knopf still" onClick={() => setSchritt(Math.max(0, schritt - 1))} disabled={schritt === 0}>Zurück</button>
                <button type="button" className="dk-knopf" onClick={() => setSchritt(Math.min(WEG.length - 1, schritt + 1))} disabled={schritt === WEG.length - 1}>{schritt === WEG.length - 1 ? "Am Ziel" : "Weiter"}</button>
              </div>
            </div>
          </div>
        </Block>

        <Block id="paketfinder" pille="Paketfinder" titel={<>Drei Fragen, <span className="dk-verlauf">ein Paket.</span></>} lead="Kein Verkaufsgespräch – eine ehrliche Zuordnung. Jedes Paket lässt sich im Antrag und im Startgespräch noch ändern." mitte>
          <div className="pk-finder">
            {FRAGEN.map((f, i) => (
              <div key={f.key} className={`pk-frage${a[f.key] ? " beantwortet" : ""}`}>
                <p className="pk-frage-nr">Frage {i + 1}</p><h3>{f.frage}</h3>
                <div className="pk-optionen">{f.optionen.map(([w, l]) => <button key={w} type="button" className={`pk-option${a[f.key] === w ? " an" : ""}`} onClick={() => setA({ ...a, [f.key]: w })}>{l}</button>)}</div>
              </div>
            ))}
            {paket && vorschlag && (
              <div className="pk-ergebnis">
                <small>Unser Vorschlag</small>
                <h3>{paket.label}</h3>
                <p className="pk-preis">{paket.abo ? <>{euro(paket.preisCents)} <span>im Monat · zwölf Raten</span></> : <>{SCHUFA_PREIS_EURO.toLocaleString("de-DE", { minimumFractionDigits: 2 })} € <span>einmalig · kein Abo</span></>}</p>
                <p>{vorschlag.grund}</p>
                <div className="pk-weg-knoepfe"><Knopf href={paket.key === "schufa" ? "/antrag?pack=schufa" : paket.art === "business" ? "/business" : `/antrag?pack=${paket.key}&src=konzept`}>{paket.art === "business" ? "Zu den Business-Paketen" : "Mit diesem Paket starten"}</Knopf><Knopf href="/privatkunden" still>Alle Pakete vergleichen</Knopf></div>
              </div>
            )}
          </div>
        </Block>
      </Licht>

      <Block id="bereich" pille="Der Kundenbereich" titel={<>Zwölf Räume, <span className="dk-verlauf">eine Akte.</span></>} lead="Alles, was FIAON für Sie tut, steht an einem Ort – nachlesbar, jederzeit, vom Handy.">
        <div className="pk-raeume">{BEREICH.map(([t, x], i) => <Auf key={t} verzoegerung={(i % 4) * 60}><div className="pk-raum"><b>{t}</b><p>{x}</p></div></Auf>)}</div>
        <div className="dk-knoepfe" style={{ marginTop: 28 }}><Knopf href="/demo/kundenbereich">Den Bereich als Demo ansehen</Knopf></div>
      </Block>

      <Licht>
        <Block id="startgespraech" pille="Das Startgespräch" titel={<>15 Minuten, <span className="dk-verlauf">die alles ordnen.</span></>} lead="Jeder Kunde beginnt mit einem Telefonat. Das ist die Agenda – dieselbe, nach der unsere Mitarbeiter arbeiten.">
          <ol className="pk-agenda">{AGENDA.map((s, i) => <li key={s.titel}><span>{i + 1}</span><div><b>{s.titel}</b><p>{s.zweck}</p></div></li>)}</ol>
        </Block>

        <Block pille="Deutschland · Österreich · Schweiz" titel={<>Drei Länder, <span className="dk-verlauf">drei Systeme.</span></>} lead="FIAON kennt die Auskunfteien, Fristen und Rechte in jedem Land – und schreibt die Schreiben so, wie sie dort gelesen werden.">
          <Zeilen items={[
            ["Deutschland", "SCHUFA (daneben Boniversum, CRIF, infoscore). Datenkopie nach Art. 15 DSGVO kostenlos; Meldung nur nach § 31 BDSG; Löschung drei Jahre nach Erledigung, 18 Monate bei Zahlung innerhalb von 100 Tagen."],
            ["Österreich", "KSV1870 und CRIF. Auskunft nach Art. 15 DSGVO; Löschung in der Regel drei Jahre nach Erledigung; Konsumenteninformation nach § 152 GewO."],
            ["Schweiz", "CRIF, Intrum und das Betreibungsregister beim Betreibungsamt. Auskunft nach Art. 25 DSG; Betreibungen bleiben fünf Jahre sichtbar – unbegründete lassen sich entfernen (Art. 8a SchKG)."],
          ]} />
        </Block>
      </Licht>

      <Block id="technik" pille="Technik & Sicherheit" titel={<>Gebaut wie eine Bank, <span className="dk-verlauf">gesprochen wie ein Mensch.</span></>} lead="Ihre Auskunft ist das sensibelste Dokument, das es über Sie gibt. So behandeln wir es.">
        <Kennzahlen items={[{ wert: "EU", label: "Server in der Europäischen Union, DSGVO" }, { wert: "TLS", label: "Verschlüsselte Übertragung, verschlüsselte Ablage" }, { wert: "SEPA", label: "Zahlungen über einen verifizierten Kreditor" }, { wert: "0", label: "Daten an Dritte verkauft – nie" }]} />
        <Karten items={[
          { tag: "Vollmacht", titel: "Nur mit Ihrer Unterschrift", text: "FIAON beschafft die Auskunft ausschließlich mit Ihrer digitalen Vollmacht – und nur bei den Auskunfteien, die Sie freigeben." },
          { tag: "Freigabe", titel: "Kein Schreiben ohne Sie", text: "Jedes Schreiben sehen Sie vor dem Versand. Sie geben frei, FIAON versendet. Nichts geht raus, was Sie nicht gelesen haben." },
          { tag: "Löschung", titel: "Ihre Daten, Ihr Ende", text: "Nach Vertragsende löschen wir Auskunft und Unterlagen auf Wunsch vollständig. Sie können jederzeit eine Kopie Ihrer Akte anfordern." },
        ]} />
      </Block>

      <Licht>
        <Block pille="Ehrlichkeit" titel={<>Was FIAON <span className="dk-verlauf">nicht ist.</span></>} mitte>
          <div className="dk-raster" style={{ textAlign: "left", marginTop: 28 }}>
            <Auf><Glas tag="Keine Beratung" titel="Wir übernehmen, wir beraten nicht">FIAON ist keine Rechts- oder Finanzberatung. Wir beschaffen, erklären, bereiten vor, versenden, verfolgen. Bei echten Rechtsstreitigkeiten nennen wir Anwälte.</Glas></Auf>
            <Auf verzoegerung={80}><Glas tag="Keine Garantie" titel="Kein Score-Versprechen">Niemand kann einen Score „verbessern“ – nur Einträge, die nicht hingehören, entfernen. Berechtigte Einträge bleiben, bis ihre Frist abläuft. Das sagen wir vorher.</Glas></Auf>
            <Auf verzoegerung={160}><Glas tag="Keine Bank" titel="Die Bank entscheidet">Über Konto, Karte und Rahmen entscheidet immer die Bank. FIAON sorgt dafür, dass die Unterlagen vollständig sind und die Auskunft stimmt – mehr nicht, und das ist viel.</Glas></Auf>
          </div>
        </Block>

        <Block schmal pille="Häufige Fragen">
          <Fragen items={[
            { f: "Wie lange dauert es, bis ich meine Auskunft sehe?", a: "In der Regel innerhalb von 24 Stunden nach Eingang bei FIAON. Die Auskunfteien selbst brauchen je nach Land und Weg zwischen wenigen Tagen und vier Wochen." },
            { f: "Was, wenn alle Einträge berechtigt sind?", a: "Dann sagen wir das. Sie bekommen die Löschdaten, die 100-Tage-Regel, wo sie greift, und den Weg zu Konto und Karte über den Wert statt über die Bereinigung." },
            { f: "Kann ich das Paket wechseln oder kündigen?", a: "Ja – im Antrag, im Startgespräch und im Kundenbereich unter Abo & Zahlungen. Zwölf Raten, dann entscheiden Sie frei." },
            { f: "Muss ich mit jemandem sprechen?", a: "Einmal, 15 Minuten. Das Startgespräch ist Pflicht, weil es den Unterschied macht. Danach läuft alles über den Bereich, Telefon und E-Mail nach Bedarf." },
            { f: "Wer sieht meine Daten?", a: "Ihr Ansprechpartner und die Mitarbeiter, die an Ihrer Akte arbeiten. Niemand sonst. Daten werden nie verkauft oder für Werbung weitergegeben." },
          ]} />
        </Block>
      </Licht>

      <Zwischenruf text={<><b>Noch Fragen zur Plattform?</b> Der FIAON-Assistent kennt jede Seite, jedes Paket und jede Frist – sofort, kostenlos.</>} knopf="Assistent fragen" href="/kontakt#assistent" still={{ knopf: "Kontakt & Support", href: "/kontakt" }} />
      <Abschluss titel={<>Ihr Weg beginnt <span className="dk-verlauf">mit einer E-Mail-Adresse.</span></>} text="Antrag in zwei Minuten, Auskunft innerhalb von 24 Stunden, ein Mensch, der Sie durch alles Weitere begleitet." knoepfe={<><Knopf href="/antrag">Jetzt starten</Knopf><Knopf href="/privatkunden" still>Pakete ansehen</Knopf></>} />
    </Dunkel>
  );
}
