// /karriere — Arbeiten bei FIAON (Neufassung 23.08.2026)
// Justin: „Wir stellen nicht nur auf Provision ein, auch fest. Junges Start-up, rasant wachsend, wir brauchen IMMER
// Unterstützung. Die Bewerbung soll kein Formular sein, sondern ein Prozess; die Seite muss Freude machen, interaktiv sein,
// Leute anwerben; Abteilungen wählbar." Der Satz „Kunden werden Mitarbeiter" bleibt intern.
import { useMemo, useState } from "react";
import { Dunkel, Hero, Block, Karten, Kennzahlen, Glas, Zitat, Fragen, Zwischenruf, Abschluss, Knopf, Auf, Licht } from "@/components/site/DunkleBuehne";
import NeuralSphere from "@/components/home3d/NeuralSphere";
import { LANDNAME } from "@/lib/land-erkennen";

type Bereich = { key: string; name: string; kurz: string; tun: string[]; mitbringen: string[]; arten: string[]; ort: string };
const BEREICHE: Bereich[] = [
  { key: "vertrieb", name: "Vertrieb", kurz: "Das erste Gespräch: Auskunft erklären, Paket finden, den ersten Schritt festlegen.",
    tun: ["Telefonate mit Interessenten, die FIAON kennenlernen wollen", "Auskunft und Weg erklären – ohne Verkaufsdruck", "Ergebnisse in der Akte festhalten, Wiedervorlagen pflegen"],
    mitbringen: ["Zuhören können, klar sprechen", "Deutsch in Wort und Schrift", "Ruhiger Arbeitsplatz, Headset, Internet"], arten: ["Festanstellung", "Freie Mitarbeit"], ort: "Remote · DACH" },
  { key: "onboarding", name: "Onboarding & Kundenbetreuung", kurz: "Das Startgespräch und alles danach: Zahlung prüfen, Auskunft beantragen, Fahrplan festlegen.",
    tun: ["Startgespräche mit neuen Kunden führen", "Fahrplan und nächste Schritte festlegen", "Fester Ansprechpartner für Ihre Kunden sein"],
    mitbringen: ["Geduld und Struktur", "Freude daran, Dinge zu erklären", "Sorgfalt mit Daten und Fristen"], arten: ["Festanstellung", "Freie Mitarbeit", "Werkstudent"], ort: "Remote · DACH" },
  { key: "forderung", name: "Forderungsmanagement", kurz: "Raten begleiten, Fristen halten, Lösungen finden, bevor etwas platzt.",
    tun: ["Offene Raten begleiten – per Telefon, respektvoll", "Ratenvereinbarungen aufsetzen und verfolgen", "Mit Gläubigern und Inkasso sauber kommunizieren"],
    mitbringen: ["Verhandlungsgeschick und Ruhe", "Erfahrung im Inkasso oder Finanzen von Vorteil", "Genauigkeit"], arten: ["Festanstellung", "Freie Mitarbeit"], ort: "Remote · DACH" },
  { key: "marketing", name: "Marketing & Content", kurz: "Eine Marke, die Vertrauen schafft: Texte, Video, Social, Kampagnen in DACH.",
    tun: ["Inhalte für Website, Social und Newsletter", "Kampagnen planen und auswerten", "Mit Video- und Bild-Werkzeugen (KI) arbeiten"],
    mitbringen: ["Gespür für Sprache und Bild", "Erfahrung mit Social und Performance", "Eigenständigkeit"], arten: ["Festanstellung", "Werkstudent", "Freie Mitarbeit"], ort: "Remote" },
  { key: "technik", name: "Produkt & Technik", kurz: "Die Plattform, auf der alles läuft: React, TypeScript, PostgreSQL, Schnittstellen zu Auskunfteien und Banken.",
    tun: ["Kundenweg und Agentenportal weiterentwickeln", "Schnittstellen (Auskunfteien, SEPA, Open Banking) anbinden", "Qualität: Tests, Messung, Dokumentation"],
    mitbringen: ["TypeScript/React oder Node/PostgreSQL", "Sinn für Produkt und Nutzer", "Lust auf Verantwortung"], arten: ["Festanstellung", "Freie Mitarbeit", "Werkstudent"], ort: "Remote" },
  { key: "recht", name: "Recht & Compliance", kurz: "Jedes Schreiben geprüft, jede Vorlage versioniert, Datenschutz gelebt.",
    tun: ["Vorlagen (Löschung, Berichtigung, Widerspruch) prüfen und pflegen", "DSGVO, Werberecht, Verträge begleiten", "Mit dem Anwaltsteam zusammenarbeiten"],
    mitbringen: ["Juristische Ausbildung oder Erfahrung", "Präzision", "Pragmatismus"], arten: ["Festanstellung", "Freie Mitarbeit"], ort: "Remote · Zürich" },
  { key: "operations", name: "Finanzen & Operations", kurz: "Zahlen, Prozesse, Zahlungsabwicklung – damit das Unternehmen jederzeit geprüft werden kann.",
    tun: ["Zahlungsabwicklung und Abstimmung (SEPA, Rechnungen)", "Kennzahlen pflegen, Datenraum aktuell halten", "Prozesse dokumentieren und verbessern"],
    mitbringen: ["Erfahrung in Buchhaltung oder Operations", "Genauigkeit und Überblick", "Freude an Struktur"], arten: ["Festanstellung", "Werkstudent"], ort: "Remote · Zürich" },
];
const ARTEN = ["Festanstellung", "Freie Mitarbeit", "Werkstudent"];
const LAENDER = ["DE", "AT", "CH"];

export default function Karriere() {
  const [gewaehlt, setGewaehlt] = useState<string>(BEREICHE[0].key);
  const bereich = useMemo(() => BEREICHE.find((b) => b.key === gewaehlt) || BEREICHE[0], [gewaehlt]);
  const [vorwahl, setVorwahl] = useState<string | null>(null);
  const zurBewerbung = (key?: string) => { if (key) setVorwahl(key); document.getElementById("bewerbung")?.scrollIntoView({ behavior: "smooth" }); };

  return (
    <Dunkel seite="karriere" titel="Karriere bei FIAON" beschreibung="Arbeiten bei FIAON: fest angestellt oder frei, remote in Deutschland, Österreich und der Schweiz. Sieben Bereiche, ein Ziel – Bonität für 100 Millionen Menschen sichtbar und veränderbar machen.">
      <Hero
        pille="Karriere bei FIAON"
        titel={<>Bauen Sie mit an dem, was 100 Millionen Menschen <span className="dk-verlauf">bisher fehlt.</span></>}
        lead="FIAON ist ein junges, schnell wachsendes Start-up mit Sitz in London und Zürich und Kunden in Deutschland, Österreich und der Schweiz. Wir suchen immer Menschen, die Verantwortung wollen – fest angestellt oder frei, remote oder vor Ort."
        knoepfe={<><Knopf onClick={() => zurBewerbung()}>Bewerbung starten</Knopf><Knopf href="#bereiche" still>Bereiche entdecken</Knopf></>}
        szene={<NeuralSphere variant="hero" className="absolute inset-0" />}
        bild="/kino/karriere.jpg"
      />

      <Block eng>
        <Kennzahlen items={[
          { wert: "7", label: "Bereiche, in denen wir gerade Verstärkung suchen" },
          { wert: "fest & frei", label: "Festanstellung, freie Mitarbeit oder Werkstudium – beides ehrlich geregelt" },
          { wert: "3 Länder", label: "Deutschland, Österreich, Schweiz – überwiegend remote" },
          { wert: "Tag 1", label: "Verantwortung ab dem ersten Tag – bei uns gibt es keine Warteschleife" },
        ]} />
      </Block>

      <Block pille="Warum FIAON" titel={<>Ein Start-up, das etwas <span className="dk-verlauf">repariert.</span></>}
             lead="Wir bauen das Betriebssystem für Bonität: Menschen sehen, was Auskunfteien über sie speichern, ändern es – und bekommen Zugang zu Konto, Karte und Finanzierung. Das ist Arbeit mit Sinn, in einem Tempo, das nur ein junges Unternehmen hat.">
        <Karten items={[
          { tag: "Sinn", titel: "Jeder Tag hilft jemandem.", text: "Hinter jeder Akte steht ein Mensch, der zum ersten Mal sieht, was über ihn gespeichert ist – und der mit uns etwas ändert." },
          { tag: "Tempo", titel: "Entscheidungen in Tagen, nicht Quartalen.", text: "Wir sind klein genug, dass Ihre Idee morgen live sein kann – und groß genug, dass sie Tausende erreicht." },
          { tag: "Verantwortung", titel: "Ihr Bereich, Ihre Kunden, Ihre Zahlen.", text: "Kein Abnicken, keine Hierarchie-Schleifen. Wer etwas kann, bekommt es – und wird daran gemessen." },
          { tag: "Wachstum", titel: "Mit der Plattform wachsen.", text: "Wer heute anfängt, führt morgen einen Bereich. Onboarding, Inkasso und Vertrieb werden von Menschen geleitet, die genau so begonnen haben." },
        ]} zwei />
      </Block>

      <Licht>
        {/* Bereiche — interaktiv */}
        <Block id="bereiche" pille="Bereiche" titel={<>Wo Sie <span className="dk-verlauf">einsteigen</span> können.</>}
               lead="Wählen Sie einen Bereich – Sie sehen, was Sie dort tun, was Sie mitbringen und in welcher Form wir zusammenarbeiten." mitte>
          <Auf>
            <div className="ka-tabs" role="tablist">
              {BEREICHE.map((b) => <button key={b.key} type="button" role="tab" data-an={gewaehlt === b.key ? "1" : undefined} onClick={() => setGewaehlt(b.key)}>{b.name}</button>)}
            </div>
          </Auf>
          <div className="ka-bereich" style={{ textAlign: "left" }}>
            <Glas ruhig>
              <span className="tag">{bereich.ort} · {bereich.arten.join(" · ")}</span>
              <h3 className="dk-h3" style={{ fontSize: 22 }}>{bereich.name}</h3>
              <p className="dk-text" style={{ marginTop: 8, fontSize: 15 }}>{bereich.kurz}</p>
              <div className="ka-zwei">
                <div><p className="ka-titel">Was Sie tun</p><ul className="dk-liste">{bereich.tun.map((t) => <li key={t}>{t}</li>)}</ul></div>
                <div><p className="ka-titel">Was Sie mitbringen</p><ul className="dk-liste">{bereich.mitbringen.map((t) => <li key={t}>{t}</li>)}</ul></div>
              </div>
              <div className="dk-knoepfe" style={{ marginTop: 28 }}><Knopf onClick={() => zurBewerbung(bereich.key)}>Für {bereich.name} bewerben</Knopf></div>
            </Glas>
          </div>
        </Block>

        <Block pille="Fest oder frei" titel={<>Beides ehrlich <span className="dk-verlauf">geregelt.</span></>} mitte>
          <div className="dk-raster zwei" style={{ textAlign: "left" }}>
            <Auf><Glas tag="Festanstellung" titel="Gehalt, Ausstattung, Perspektive.">
              <ul className="dk-liste"><li>Fixgehalt plus Beteiligung am Erfolg Ihres Bereichs</li><li>Laptop, Headset, Software – gestellt</li><li>Remote in DACH, Treffen in Zürich</li><li>Academy und Weiterbildung bezahlt</li><li>Klare Entwicklung: vom Einstieg zur Leitung</li></ul>
            </Glas></Auf>
            <Auf verzoegerung={100}><Glas tag="Freie Mitarbeit" titel="Ihre Zeit, Ihr Ort, Ihre Ergebnisse.">
              <ul className="dk-liste"><li>Vergütung je Abschluss und je eingezogener Rate – im Portal einsehbar</li><li>Homeoffice, eigene Einteilung, Kalender in der Plattform</li><li>Softphone, Akte und Academy gestellt</li><li>Selbständig als Handelsvertreter, ehrlich geregelt</li><li>Fixum, wenn Sie sich bewährt haben</li></ul>
            </Glas></Auf>
          </div>
        </Block>

        <Block pille="So arbeiten wir" titel={<>Remote, aber <span className="dk-verlauf">nie allein.</span></>}>
          <Karten items={[
            { tag: "Academy", titel: "Erst lernen, dann Kunden.", text: "Niemand spricht mit Kunden, bevor er die Academy bestanden hat. Module, Prüfung, Probegespräch – dann echte Akten." },
            { tag: "Werkzeuge", titel: "Alles in einem Portal.", text: "Softphone, Kalender, Akte, Aufträge, Updates. Ein Klick wählt, das Ergebnis landet in der Akte." },
            { tag: "Menschen", titel: "Feste Ansprechpartner.", text: "Florentine führt Onboarding und Einschulung, Daniel den Vertrieb. Sie wissen immer, wen Sie fragen." },
            { tag: "Kultur", titel: "Sie-Form, Respekt, Tempo.", text: "Wir siezen Kunden, wir reden klar, wir entscheiden schnell. Fehler sind erlaubt – Verschweigen nicht." },
          ]} zwei />
        </Block>
      </Licht>

      <Block eng schmal>
        <Zitat text="Wir suchen keine Leute, die Anweisungen abarbeiten. Wir suchen Leute, die einen Bereich übernehmen – und ihn besser machen, als wir ihn übergeben haben." wer="Florentine Lombardi, Gesellschafterin · Menschen & Onboarding" />
      </Block>

      <Zwischenruf text="Sie wissen noch nicht, welcher Bereich passt? Bewerben Sie sich trotzdem – im Gespräch finden wir es gemeinsam heraus." knopf="Bewerbung starten" href="#bewerbung" still={{ knopf: "Das Team kennenlernen", href: "/team" }} />

      {/* Bewerbung — ein Prozess in vier Schritten */}
      <Block id="bewerbung" pille="Bewerbung" titel={<>In vier Schritten <span className="dk-verlauf">zu uns.</span></>}
             lead="Kein Lebenslauf-Upload, kein Anschreiben. Vier kurze Schritte, drei Minuten. Danach meldet sich Florentine persönlich – innerhalb von zwei Werktagen." schmal>
        <Bewerbung vorwahl={vorwahl} />
      </Block>

      <Block eng schmal pille="Häufige Fragen">
        <Fragen items={[
          { f: "Stellt FIAON fest an oder nur auf Provision?", a: "Beides. Festanstellungen in allen Bereichen, freie Mitarbeit vor allem im Vertrieb, Onboarding und Forderungsmanagement, Werkstudenten in Marketing, Technik, Onboarding und Operations." },
          { f: "Wo arbeite ich?", a: "Überwiegend remote in Deutschland, Österreich oder der Schweiz. Treffen finden in Zürich statt; Recht und Operations teils vor Ort." },
          { f: "Brauche ich Erfahrung?", a: "Je nach Bereich. Im Vertrieb und Onboarding bringt die Academy Ihnen alles bei; in Technik, Recht und Operations erwarten wir Erfahrung. Sagen Sie uns ehrlich, wo Sie stehen." },
          { f: "Wie läuft das Gespräch?", a: "Ein Videogespräch mit Florentine oder Daniel, 30 Minuten, ohne Fangfragen. Danach ein Probetag oder eine Probeaufgabe – und eine Entscheidung innerhalb einer Woche." },
          { f: "Wann kann ich anfangen?", a: "Sobald es passt. Wir wachsen schnell und brauchen immer Unterstützung – ein Start ist jederzeit möglich." },
        ]} />
      </Block>

      <Abschluss
        titel={<>Wachsen Sie mit etwas, das <span className="dk-verlauf">wirklich fehlt.</span></>}
        text="Ein junges Unternehmen, ein klares Ziel, sieben Bereiche – und ein Platz, der auf Sie wartet."
        knoepfe={<><Knopf onClick={() => zurBewerbung()}>Bewerbung starten</Knopf><Knopf href="/was-ist-fiaon" still>Was FIAON ist</Knopf></>}
      />
    </Dunkel>
  );
}

/* ── Der Bewerbungsprozess ──────────────────────────────────────────────── */
function Bewerbung({ vorwahl }: { vorwahl: string | null }) {
  const [schritt, setSchritt] = useState(0);
  const [w, setW] = useState<Record<string, string>>({ bereich: vorwahl || "", art: "", land: "", start: "", stunden: "", name: "", email: "", telefon: "", erfahrung: "", linkedin: "", text: "" });
  const [stand, setStand] = useState<"offen" | "sendet" | "fertig" | "fehler">("offen");
  const [meldung, setMeldung] = useState<string | null>(null);
  // Vorwahl aus dem Bereichs-Knopf übernehmen
  if (vorwahl && w.bereich !== vorwahl && schritt === 0 && !w.art) { setW({ ...w, bereich: vorwahl }); }
  const setze = (k: string, v: string) => setW((a) => ({ ...a, [k]: v }));
  const b = BEREICHE.find((x) => x.key === w.bereich);
  const weiter = [!!w.bereich, !!w.art && !!w.land, !!w.name && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(w.email) && !!w.telefon, true];

  const senden = async () => {
    setStand("sendet");
    const body = { art: "karriere", name: w.name, email: w.email, telefon: w.telefon, rolle: b?.name || w.bereich, land: w.land, erfahrung: w.erfahrung,
      anstellung: w.art, start: w.start, stunden: w.stunden, linkedin: w.linkedin, text: w.text };
    const r = await fetch("/api/fiaon/anfrage", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (r?.ok && j?.ok) { setStand("fertig"); setMeldung(j.meldung || "Danke — wir melden uns."); } else { setStand("fehler"); setMeldung(j?.error || "Das hat nicht geklappt. Bitte schreiben Sie an florentine@fiaon.com."); }
  };

  if (stand === "fertig") {
    return (
      <div className="dk-glas ruhig mitte" style={{ marginTop: 36 }}>
        <span className="dk-pille">Eingegangen</span>
        <h3 className="dk-h3" style={{ marginTop: 16 }}>{meldung}</h3>
        <p className="dk-text" style={{ marginTop: 10 }}>Bereich: {b?.name} · {w.art} · {LANDNAME[w.land] || w.land}. Florentine Lombardi liest jede Bewerbung selbst.</p>
      </div>
    );
  }

  const titel = ["Bereich", "Rahmen", "Über Sie", "Absenden"];
  return (
    <div className="ka-bewerbung">
      <div className="ka-fortschritt">
        {titel.map((t, i) => <div key={t} className="ka-stufe" data-an={i === schritt ? "1" : undefined} data-fertig={i < schritt ? "1" : undefined}><span className="n">{i + 1}</span><span>{t}</span></div>)}
      </div>
      <div className="dk-glas ruhig" style={{ marginTop: 18 }}>
        {schritt === 0 && (
          <>
            <h3 className="dk-h3">In welchem Bereich möchten Sie arbeiten?</h3>
            <div className="ka-wahl">
              {BEREICHE.map((x) => (
                <button key={x.key} type="button" className="ka-karte" data-an={w.bereich === x.key ? "1" : undefined} onClick={() => setze("bereich", x.key)}>
                  <span className="name">{x.name}</span><span className="kurz">{x.ort} · {x.arten.join(" · ")}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {schritt === 1 && (
          <>
            <h3 className="dk-h3">Wie möchten Sie mit uns arbeiten?</h3>
            <p className="dk-leise" style={{ marginTop: 6 }}>Bereich: {b?.name}</p>
            <p className="ka-titel" style={{ marginTop: 18 }}>Art der Zusammenarbeit</p>
            <div className="ka-wahl klein">
              {ARTEN.filter((a) => !b || b.arten.includes(a)).map((a) => <button key={a} type="button" className="ka-karte" data-an={w.art === a ? "1" : undefined} onClick={() => setze("art", a)}><span className="name">{a}</span></button>)}
            </div>
            <p className="ka-titel" style={{ marginTop: 18 }}>Land</p>
            <div className="ka-wahl klein">
              {LAENDER.map((l) => <button key={l} type="button" className="ka-karte" data-an={w.land === l ? "1" : undefined} onClick={() => setze("land", l)}><span className="name">{LANDNAME[l]}</span></button>)}
            </div>
            <div className="dk-form" style={{ marginTop: 18 }}>
              <div className="zwei">
                <div><label className="dk-label" htmlFor="ka-start">Frühester Start</label><input id="ka-start" className="dk-feld" type="month" value={w.start} onChange={(e) => setze("start", e.target.value)} /></div>
                <div><label className="dk-label" htmlFor="ka-std">Stunden pro Woche</label>
                  <select id="ka-std" className="dk-feld" value={w.stunden} onChange={(e) => setze("stunden", e.target.value)}><option value="">Bitte wählen</option>{["bis 10", "10–20", "20–30", "30–40", "Vollzeit"].map((o) => <option key={o}>{o}</option>)}</select></div>
              </div>
            </div>
          </>
        )}
        {schritt === 2 && (
          <>
            <h3 className="dk-h3">Wer sind Sie?</h3>
            <div className="dk-form" style={{ marginTop: 18 }}>
              <div className="zwei">
                <div><label className="dk-label" htmlFor="ka-name">Vollständiger Name *</label><input id="ka-name" className="dk-feld" value={w.name} onChange={(e) => setze("name", e.target.value)} /></div>
                <div><label className="dk-label" htmlFor="ka-email">E-Mail *</label><input id="ka-email" className="dk-feld" type="email" inputMode="email" autoCapitalize="none" value={w.email} onChange={(e) => setze("email", e.target.value)} /></div>
                <div><label className="dk-label" htmlFor="ka-tel">Telefon *</label><input id="ka-tel" className="dk-feld" type="tel" inputMode="tel" value={w.telefon} onChange={(e) => setze("telefon", e.target.value)} /></div>
                <div><label className="dk-label" htmlFor="ka-erf">Erfahrung</label>
                  <select id="ka-erf" className="dk-feld" value={w.erfahrung} onChange={(e) => setze("erfahrung", e.target.value)}><option value="">Bitte wählen</option>{["Berufseinstieg", "1–3 Jahre", "3–7 Jahre", "über 7 Jahre", "Führungserfahrung"].map((o) => <option key={o}>{o}</option>)}</select></div>
                <div style={{ gridColumn: "1 / -1" }}><label className="dk-label" htmlFor="ka-li">LinkedIn oder Website (optional)</label><input id="ka-li" className="dk-feld" value={w.linkedin} onChange={(e) => setze("linkedin", e.target.value)} /></div>
                <div style={{ gridColumn: "1 / -1" }}><label className="dk-label" htmlFor="ka-text">Warum FIAON – in drei Sätzen</label><textarea id="ka-text" className="dk-feld" rows={4} value={w.text} onChange={(e) => setze("text", e.target.value)} /></div>
              </div>
            </div>
          </>
        )}
        {schritt === 3 && (
          <>
            <h3 className="dk-h3">Alles richtig?</h3>
            <div style={{ marginTop: 14 }}>
              {[["Bereich", b?.name], ["Zusammenarbeit", w.art], ["Land", LANDNAME[w.land] || w.land], ["Start", w.start || "offen"], ["Stunden/Woche", w.stunden || "offen"], ["Name", w.name], ["E-Mail", w.email], ["Telefon", w.telefon], ["Erfahrung", w.erfahrung || "—"]].map(([k, v]) => (
                <div key={k} className="dk-zeile"><span>{k}</span><b>{v}</b></div>
              ))}
            </div>
            <p className="dk-leise" style={{ marginTop: 14 }}>Ihre Angaben gehen direkt an Florentine Lombardi. Keine Weitergabe, kein Newsletter.</p>
            {stand === "fehler" && <p style={{ color: "#fca5a5", fontSize: 13.5, marginTop: 10 }}>{meldung}</p>}
          </>
        )}
        <div className="ka-knoepfe">
          {schritt > 0 && <Knopf onClick={() => setSchritt(schritt - 1)} still>Zurück</Knopf>}
          {schritt < 3 && <button type="button" className="dk-knopf" disabled={!weiter[schritt]} onClick={() => setSchritt(schritt + 1)}>Weiter</button>}
          {schritt === 3 && <button type="button" className="dk-knopf" disabled={stand === "sendet"} onClick={() => void senden()}>{stand === "sendet" ? "Wird gesendet …" : "Bewerbung absenden"}</button>}
        </div>
      </div>
    </div>
  );
}
