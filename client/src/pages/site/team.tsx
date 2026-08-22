// /team — Wer FIAON baut: drei Gesellschafter im Betrieb, ein Investor, ein Weg für neue Kollegen.
import { Dunkel, Hero, Block, Karten, Schritte, Zwischenruf, Abschluss, Knopf } from "@/components/site/DunkleBuehne";
import { Team, Mitarbeiter, PERSONEN, INVESTOR } from "@/components/site/Team";
import SchichtenSzene from "@/components/home3d/SchichtenSzene";

export default function TeamSeite() {
  return (
    <Dunkel seite="team" titel="Team" beschreibung="Das Team hinter FIAON: Justin Schwarzott (Gründer), Florentine Lombardi (Menschen & Onboarding), Daniel Stripling (Vertrieb) – und Schwarzott Capital Partners AG als Investor.">
      <Hero
        pille="Team"
        titel={<>Drei Menschen, die selbst <span className="dk-verlauf">im Betrieb stehen.</span></>}
        lead="FIAON wird nicht von einer Zentrale geführt, sondern von Gesellschaftern, die täglich Kunden sehen: im Startgespräch, im Vertrieb, in der Akte. Wer uns schreibt, bekommt eine Antwort von einem der drei."
        knoepfe={<><Knopf href="#kontakt">Kontakt aufnehmen</Knopf><Knopf href="/karriere" still>Teil des Teams werden</Knopf></>}
        szene={<SchichtenSzene namen={["Vertrieb", "Onboarding", "Betreuung"]} className="absolute inset-0" />}
        bild="/kino/presse.jpg"
      />

      <Block pille="Das Team" titel={<>Die Menschen, die Sie <span className="dk-verlauf">am Telefon erreichen.</span></>}
             lead="Vertrieb, Onboarding, Forderungsmanagement – wer bei FIAON anruft, spricht mit einem dieser Menschen. Viele von ihnen waren selbst Kunden." mitte>
        <div style={{ textAlign: "left" }}><Mitarbeiter /></div>
      </Block>

      <Block pille="Die Gesellschafter" titel={<>Wer was <span className="dk-verlauf">verantwortet.</span></>} mitte>
        <div style={{ textAlign: "left" }}><Team /></div>
      </Block>

      <Block pille="So arbeiten wir" titel={<>Ein Kunde, <span className="dk-verlauf">drei Hände.</span></>}
             lead="Jeder Kunde durchläuft dieselben drei Stationen – und an jeder steht jemand, der seinen Namen kennt.">
        <Schritte items={[
          { titel: "Vertrieb", text: "Daniels Team führt das erste Gespräch: Was steht in der Auskunft, welches Paket passt, was ist der erste Schritt. Kein Verkaufen gegen den Kunden." },
          { titel: "Onboarding", text: "Florentines Team übernimmt: Startgespräch, Zahlung prüfen, Auskunft beantragen, Fahrplan festlegen. Jeder Kunde kennt danach seinen Ansprechpartner." },
          { titel: "Betreuung", text: "Schreiben freigeben, Raten begleiten, Fristen halten, Zugang vorbereiten. Justin liest jede Woche die Zahlen dahinter – und jede Rückfrage." },
        ]} />
      </Block>

      <Block pille="Grundsätze" titel={<>Woran wir uns <span className="dk-verlauf">halten.</span></>}>
        <Karten items={[
          { tag: "Sie-Form", titel: "Respekt zuerst", text: "Kunden werden gesiezt, immer. Wer bei FIAON anruft, spricht mit jemandem, der seine Akte kennt – nicht mit einer Warteschleife." },
          { tag: "Ehrlich", titel: "Keine Fantasiezahlen", text: "Über Konto und Karte entscheidet die Bank. Wir versprechen, was wir halten: Einsicht in 24 Stunden, geprüfte Schreiben, ein Mensch am Telefon." },
          { tag: "Festgehalten", titel: "Jede Entscheidung ein Eintrag", text: "Register, Logbuch, eine Quelle für jede Zahl. Wer das Unternehmen prüft, findet alles – vom ersten Tag an." },
          { tag: "Aus Kunden", titel: "Wer geholfen bekam, hilft", text: "Viele im Team waren selbst Kunden. Sie erklären den Weg, weil sie ihn gegangen sind." },
        ]} zwei />
      </Block>

      <Zwischenruf text="Sie möchten von zuhause für das arbeiten, was Ihnen selbst geholfen hat? Florentine liest jede Bewerbung persönlich." knopf="In 60 Sekunden bewerben" href="/karriere#bewerbung" still={{ knopf: "Für Partner", href: "/partner" }} />

      <Block id="kontakt" pille="Kontakt" titel={<>Direkt zu <span className="dk-verlauf">uns.</span></>} schmal>
        <div className="dk-raster" style={{ marginTop: 40 }}>
          {PERSONEN.map((p) => (
            <div key={p.kuerzel} className="dk-glas ruhig">
              <span className="tag">{p.rolle.split(" · ")[0]}</span>
              <h3 className="dk-h3">{p.name}</h3>
              <p style={{ marginTop: 10, display: "grid", gap: 4, fontSize: 14.5 }}>
                <a href={`mailto:${p.email}`} style={{ color: "#93c5fd", textDecoration: "none" }}>{p.email}</a>
                {p.telefon && <a href={`tel:${p.telefon.replace(/\s/g, "")}`} style={{ color: "#9ca3af", textDecoration: "none" }}>{p.telefon}</a>}
              </p>
            </div>
          ))}
          <div className="dk-glas ruhig">
            <span className="tag">Investor</span>
            <h3 className="dk-h3">{INVESTOR.name}</h3>
            <p className="dk-leise" style={{ marginTop: 10, lineHeight: 1.6 }}>{INVESTOR.adresse.join(" · ")}<br /><a href={`mailto:${INVESTOR.email}`} style={{ color: "#93c5fd", textDecoration: "none" }}>{INVESTOR.email}</a></p>
          </div>
        </div>
        <p className="dk-leise" style={{ marginTop: 20 }}>FIAON LTD · 128 City Road, London EC1V 2NX · Companies House No. 17318250 · Kundenanliegen: support@fiaon.com</p>
      </Block>

      <Abschluss
        titel={<>Ein Team, das Sie <span className="dk-verlauf">beim Namen kennt.</span></>}
        text="Einsicht, Aktion, Zugang – dahinter stehen Menschen, die jeden Schritt selbst gehen. Wenn Sie starten, lernen Sie einen von ihnen im Startgespräch kennen."
        knoepfe={<><Knopf href="/antrag">Jetzt starten</Knopf><Knopf href="/investoren" still>Für Investoren</Knopf></>}
      />
    </Dunkel>
  );
}
