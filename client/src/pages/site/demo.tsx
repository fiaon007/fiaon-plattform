// ═══════════════════════════════════════════════════════════════════════════
// /demo — das perfekte Konto, einmal durchgespielt (23.08.2026)
//
// Justin: „Ein 1:1-Demo-Konto, das das perfekte Kundenkonto zeigt UND den
// Mitarbeiter, der im Onboarding-Prozess dem Kunden hilft. Alles mit
// Platzhaltern. Auf der Investorenseite mit einem Button."
//
// Zwei Türen: (1) der echte Kundenbereich mit der Referenz FIAON-DEMO
// (/demo/kundenbereich, Daten aus server/routes/fiaon-demo.ts) und (2) die
// Gesprächsbühne des Mitarbeiters — hier nachgebaut mit der echten Agenda aus
// shared/fiaon-onboarding-agenda.ts, aber ohne Server: Haken, Notizen und
// Freischalten laufen nur im Browser. Max Mustermann ist kein Kunde.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Hero, Block, Karten, Schritte, Glas, Zwischenruf, Knopf, Auf } from "@/components/site/DunkleBuehne";
import KartenSzene from "@/components/home3d/KartenSzene";
import { AGENDA, darfAbschliessen, fortschritt, type AgendaStand } from "@shared/fiaon-onboarding-agenda";

const KUNDE = {
  name: "Max Mustermann", telefon: "+49 170 1234567", email: "max.mustermann@beispiel.de",
  paket: "FIAON Pro (Standard)", zahlung: "Erste Rate bezahlt · SEPA-Mandat aktiv",
  termin: "Heute · 10:30 Uhr · 15 Minuten",
  lage: [
    ["Paket", "FIAON Pro · 59,99 € im Monat"],
    ["Zahlung", "1. Rate bezahlt · Lastschrift aktiv"],
    ["Unterlagen", "Kontoauszug und Ausweis liegen vor"],
    ["Bonitätsauskunft", "Bestellt · in Beschaffung"],
    ["Stufe", "Wartet auf das Startgespräch"],
    ["Ziel des Kunden", "Kreditkarte in zwölf Monaten"],
  ] as const,
};

const NOTIZEN_VORLAGE: Record<string, string> = {
  begruessung: "Will in zwölf Monaten eine Kreditkarte. Zwei alte Einträge (Mobilfunk 2021, Versandhaus 2022), beide aus seiner Sicht längst bezahlt.",
  tour: "Bereich gemeinsam geöffnet, Fahrplan und Unterlagen gezeigt. Versteht, wo er hochlädt.",
};

function Haken() {
  return <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m4.5 10.5 3.6 3.6L15.5 6.5" /></svg>;
}

/** Die Gesprächsbühne, ohne Server: dieselbe Agenda, dieselben Regeln. */
function OnboardingDemo() {
  const [stand, setStand] = useState<AgendaStand>({ erledigt: ["begruessung", "tour"], notizen: { ...NOTIZEN_VORLAGE } });
  const [aktiv, setAktiv] = useState(2);
  const [frei, setFrei] = useState(false);
  const prozent = fortschritt(stand);
  const pruefung = useMemo(() => darfAbschliessen(stand), [stand]);

  const haken = (key: string) => setStand((s) => ({ ...s, erledigt: s.erledigt.includes(key) ? s.erledigt.filter((k) => k !== key) : [...s.erledigt, key] }));
  const notiz = (key: string, text: string) => setStand((s) => ({ ...s, notizen: { ...s.notizen, [key]: text } }));
  const weiter = (i: number) => { const k = AGENDA[i].key; if (!stand.erledigt.includes(k)) haken(k); setAktiv(Math.min(i + 1, AGENDA.length - 1)); };

  if (frei) {
    return (
      <div className="demo-frei">
        <span className="dk-pille">Freigeschaltet</span>
        <h3 className="dk-h3">Das Konto von Max Mustermann ist jetzt <span className="dk-verlauf">vollständig aktiv.</span></h3>
        <p className="dk-text">Der Mitarbeiter hat abgeschlossen. Was jetzt beim Kunden passiert: Der Fahrplan zeigt das Startgespräch als erledigt, der nächste Schritt steht, die Bonitätsauskunft wird beschafft – und in seinem Bereich steht der Name seiner Ansprechpartnerin.</p>
        <div className="demo-frei-zeilen">
          <div><b>Fahrplan</b><span>Startgespräch erledigt · Unterlagen geprüft · Auskunft in Beschaffung</span></div>
          <div><b>Ansprechpartnerin</b><span>Viktoria Reichert · Onboarding</span></div>
          <div><b>Notizen</b><span>{Object.keys(stand.notizen).filter((k) => stand.notizen[k]?.trim()).length} Schritte dokumentiert, im Verlauf des Kunden hinterlegt</span></div>
        </div>
        <div className="dk-knoepfe"><Knopf href="/demo/kundenbereich">Den Kundenbereich danach ansehen</Knopf><Knopf still onClick={() => { setFrei(false); setAktiv(0); setStand({ erledigt: [], notizen: { ...NOTIZEN_VORLAGE } }); }}>Gespräch noch einmal führen</Knopf></div>
      </div>
    );
  }

  return (
    <div className="demo-cockpit">
      <div className="demo-kopf">
        <div>
          <p className="demo-ueber">Startgespräch · {KUNDE.termin}</p>
          <h3 className="demo-name">{KUNDE.name}</h3>
          <p className="demo-kontakt">{KUNDE.telefon} · {KUNDE.email}</p>
        </div>
        <div className="demo-fortschritt" aria-label={`Fortschritt ${prozent} Prozent`}>
          <span>{stand.erledigt.length} von {AGENDA.length} Schritten</span>
          <div className="balken"><i style={{ width: `${prozent}%` }} /></div>
        </div>
      </div>

      <div className="demo-raster">
        <aside className="demo-lage">
          <p className="demo-ueber">Die Lage des Kunden</p>
          {KUNDE.lage.map(([k, v]) => <div key={k} className="demo-zeile"><span>{k}</span><b>{v}</b></div>)}
          <div className="demo-kern">
            <p className="demo-ueber">Kernbotschaft</p>
            <p>FIAON beschafft die Auskunft und zeigt, was gespeichert ist. Keine Beratung, kein Versprechen – ein Handlungsplan, den der Kunde selbst versteht.</p>
          </div>
        </aside>

        <ol className="demo-agenda">
          {AGENDA.map((a, i) => {
            const fertig = stand.erledigt.includes(a.key);
            const offen = i === aktiv;
            return (
              <li key={a.key} className={`demo-schritt${fertig ? " fertig" : ""}${offen ? " offen" : ""}`}>
                <button type="button" className="demo-schritt-kopf" onClick={() => setAktiv(i)} aria-expanded={offen}>
                  <span className="nr">{fertig ? <Haken /> : i + 1}</span>
                  <span className="titel">{a.titel}</span>
                  {a.notizPflicht && <span className="pflicht">Notiz</span>}
                </button>
                {offen && (
                  <div className="demo-schritt-koerper">
                    <p className="zweck">{a.zweck}</p>
                    <ul className="punkte">{a.punkte.map((p) => <li key={p}>{p}</li>)}</ul>
                    <textarea value={stand.notizen[a.key] || ""} onChange={(e) => notiz(a.key, e.target.value)} placeholder={a.notizFrage || "Notiz (optional)"} rows={3} />
                    <div className="demo-schritt-knoepfe">
                      <button type="button" className="dk-knopf" onClick={() => weiter(i)}>{i === AGENDA.length - 1 ? "Schritt abhaken" : "Erledigt, weiter"}</button>
                      {fertig && <button type="button" className="dk-knopf still" onClick={() => haken(a.key)}>Haken entfernen</button>}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="demo-fuss">
        <p className="dk-leise">{pruefung.ok ? "Alle Pflichtschritte dokumentiert. Der Knopf schaltet das Konto frei und legt die Notizen im Verlauf ab." : `Noch offen: ${pruefung.fehlt.join(", ")}.`}</p>
        <button type="button" className="dk-knopf" disabled={!pruefung.ok} onClick={() => setFrei(true)}>Konto freischalten</button>
      </div>
    </div>
  );
}

export default function Demo() {
  return (
    <Dunkel seite="demo" titel="Demo-Konto" beschreibung="Der FIAON-Kundenbereich im besten Fall – mit Platzhalterdaten – und die Sicht des Mitarbeiters im Startgespräch. Kein Login, keine echten Daten.">
      <Hero
        bild="/kino/datenraum.jpg"
        pille="Demo-Konto · Platzhalterdaten"
        titel={<>Das perfekte Konto, <span className="dk-verlauf">einmal durchgespielt.</span></>}
        lead="So sieht FIAON aus, wenn alles läuft: ein Kunde nach vier Monaten, Auskunft ausgewertet, zwei Einträge angegangen, Kreditkarte in Sicht. Und daneben der Mitarbeiter, der ihn dorthin geführt hat. Alle Namen und Zahlen sind erfunden."
        knoepfe={<><Knopf href="/demo/kundenbereich">Präsentation starten</Knopf><Knopf href="#onboarding" still>Mitarbeitersicht ansehen</Knopf></>}
        szene={<KartenSzene anzahl={1} className="absolute inset-0" />}
      />

      <Block pille="Zwei Sichten" titel={<>Ein Kunde. <span className="dk-verlauf">Zwei Bildschirme.</span></>}
             lead="Die Plattform hat zwei Seiten, die zusammen ein Produkt ergeben: was der Kunde sieht, und was der Mitarbeiter tut, damit er es sieht." mitte>
        <div style={{ textAlign: "left" }}>
          <Karten items={[
            { tag: "01 · Kundensicht", titel: "Der Bereich, 1:1.", text: "Dieselbe Seite, die zahlende Kunden sehen – Fahrplan, Bonität, Finanzen, Unterlagen, Abo, Hilfe. Mit dem Stand von Max Mustermann nach vier Monaten." },
            { tag: "02 · Mitarbeitersicht", titel: "Das Startgespräch, geführt.", text: "Sechs Schritte mit kuratierten Stichpunkten, Notizen während des Gesprächs, und am Ende ein Knopf, der das Konto freischaltet. Unten auf dieser Seite zum Ausprobieren." },
            { tag: "03 · Platzhalter", titel: "Nichts davon ist echt.", text: "Max Mustermann, seine Einträge, seine Zahlen – alles erfunden. Kein Login, keine Datenbank, kein Schreibzugriff. Ein Schaufenster, kein Konto." },
          ]} />
        </div>
      </Block>

      <Block id="kunde" pille="Kundensicht" titel={<>Max Mustermann, <span className="dk-verlauf">vier Monate später.</span></>}
             lead="Der Kunde hat im Antrag FIAON Pro gewählt, das Startgespräch geführt, Unterlagen hochgeladen. Die Auskunft liegt vor, zwei von drei Einträgen sind angegangen. Das zeigt sein Bereich:">
        <div className="dk-raster zwei" style={{ marginTop: 40 }}>
          {[
            { tag: "Fahrplan", titel: "Vier Etappen erledigt, eine läuft", text: "Startgespräch, Unterlagen, Auskunft, Analyse – abgehakt. „Schreiben versenden“ ist der Schritt von heute: zwei Löschanträge draußen, einer erfolgreich." },
            { tag: "Meine Bonität", titel: "Drei Einträge, zwei angreifbar", text: "Die Auskunft ist ausgewertet und in Menschensprache erklärt. Der dritte Eintrag wartet auf die Antwort der Gegenseite – die Frist wird verfolgt." },
            { tag: "Meine Finanzen", titel: "Rund 525 € Spielraum im Monat", text: "Aus dem Kontoauszug: Gehalt stabil, keine Rücklastschriften, kein Dispo. Fixkosten und Kategorien aufgeschlüsselt, drei Merksätze." },
            { tag: "Abo & Zahlungen", titel: "Vier von zwölf Raten bezahlt", text: "SEPA-Mandat aktiv, nächste Rate angekündigt. Nach der zwölften fragt FIAON, ob er bleibt. Seine Ansprechpartnerin steht mit Namen im Bereich." },
          ].map((k, i) => <Auf key={k.tag} verzoegerung={i * 80}><Glas tag={k.tag} titel={k.titel}>{k.text}</Glas></Auf>)}
        </div>
        <div className="dk-knoepfe" style={{ marginTop: 32 }}><Knopf href="/demo/kundenbereich">Präsentation starten</Knopf><Knopf href="/demo/produkt" still>Der heutige Bereich, 1:1</Knopf></div>
      </Block>

      <Block id="onboarding" pille="Mitarbeitersicht" titel={<>Das Startgespräch, <span className="dk-verlauf">wie FIAON es führt.</span></>}
             lead="Der Kunde hat bezahlt, sein Konto wartet auf dieses Gespräch. Fünfzehn Minuten, sechs Schritte, danach ist er freigeschaltet. Haken setzen, Notizen schreiben, freischalten – probieren Sie es aus.">
        <Auf><OnboardingDemo /></Auf>
      </Block>

      <Block pille="Danach" titel={<>Was nach dem Gespräch <span className="dk-verlauf">passiert.</span></>} mitte>
        <div style={{ textAlign: "left" }}>
          <Schritte items={[
            { titel: "Konto freigeschaltet", text: "Der Kunde sieht seinen Fahrplan vollständig, die Notizen liegen in seinem Verlauf, seine Ansprechpartnerin steht mit Namen im Bereich." },
            { titel: "Auskunft beschafft", text: "FIAON stellt die Anfrage bei SCHUFA, KSV oder CRIF. Sobald sie vorliegt, wird jeder Eintrag geprüft und erklärt." },
            { titel: "Schreiben versendet", text: "Löschanträge und Widersprüche, vorbereitet und geprüft. Der Kunde gibt frei, FIAON verfolgt Fristen und Antworten." },
            { titel: "Tür geöffnet", text: "Girokonto sofort, Kreditkarte, sobald der Wert die Schwelle erreicht. Jeder Kunde hat ein nächstes Ziel." },
          ]} />
        </div>
      </Block>

      <Zwischenruf text="Sie möchten die Zahlen hinter dem Schaufenster sehen? Der Datenraum wird persönlich geführt." knopf="Datenraum anfragen" href="/investoren#anfrage" still={{ knopf: "Zurück zu Investoren", href: "/investoren" }} />
    </Dunkel>
  );
}
