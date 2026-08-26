// ═══════════════════════════════════════════════════════════════════════════
// AntragStart — Schritt 0 des Antrags: die Paketwahl als Erlebnis (23.08.2026)
//
// Justin: „Hier beginnt der Antrag — die Seite muss PERFEKT sein. Pakete viel
// zu schmal am PC, Texte und Sektionen neu, Mischung hell/dunkel, 3D,
// Animationen." Die Pakettexte selbst bleiben (sie stehen in antrag.tsx),
// alles andere ist neu: Bühne, Lichtband, Karten in voller Breite, Ablauf,
// Vertrauen, Fragen, Abschluss. Die Wahl ruft `onWahl` — die Logik dahinter
// (Paket setzen, Limit, Tracking, nächster Schritt) bleibt unverändert.
// ═══════════════════════════════════════════════════════════════════════════
import { Block, Karten, Schritte, Glas, Fragen, Zwischenruf, Knopf, Auf, Licht } from "@/components/site/DunkleBuehne";
import KartenSzene from "@/components/home3d/KartenSzene";
import SchichtenSzene from "@/components/home3d/SchichtenSzene";

export interface StartPaket { key: string; name: string; sub: string; fee: number; lim: number; rec?: boolean; bg: string; feats: readonly string[] | string[] }

const euro = (n: number) => n.toFixed(2).replace(".", ",");

export function AntragStart({ packs, onWahl }: { packs: readonly StartPaket[]; onWahl: (p: StartPaket) => void }) {
  const zuPaketen = () => document.getElementById("pakete")?.scrollIntoView({ behavior: "smooth", block: "start" });
  return (
    <div className="antrag-start">
      {/* 1 · Eintritt */}
      <section className="dk-hero as-hero">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/hero.jpg" alt="" decoding="async" {...({ fetchpriority: "high" } as any)} /><div className="schleier" /></div>
        <div className="dk-rahmen dk-zweispaltig">
          <Auf>
            <span className="dk-pille">Ihr Antrag beginnt hier</span>
            <h1 className="dk-h1">Wählen Sie Ihr Paket. <span className="dk-verlauf">Der Rest dauert zwei Minuten.</span></h1>
            <p className="dk-lead">Kein Papier, keine Filiale, keine Vorkasse. Sie wählen, wie weit FIAON Sie begleitet – von der ersten Einsicht in Ihre Bonität bis zu Konto, Karte und Finanzierung. Das Paket lässt sich später noch ändern.</p>
            <div className="dk-knoepfe"><Knopf onClick={zuPaketen}>Pakete ansehen</Knopf><Knopf href="#ablauf" still>So geht es weiter</Knopf></div>
            <p className="dk-leise" style={{ marginTop: 22 }}>SEPA-Lastschrift · zwölf Raten, danach Ihre Entscheidung · anwaltlich geprüfte Schreiben · Server in der EU</p>
          </Auf>
          <Auf verzoegerung={150}><div className="dk-szene gross"><KartenSzene anzahl={1} className="absolute inset-0" /></div></Auf>
        </div>
      </section>

      <Licht>
        {/* 2 · Die Pakete — in voller Breite */}
        <Block id="pakete" pille="Ihr Paket" titel={<>Vier Pakete. <span className="dk-verlauf">Ein Weg.</span></>}
               lead="Jedes Paket beginnt mit Ihrer Auskunft. Je weiter Sie gehen, desto mehr nimmt FIAON Ihnen ab. Über Konto, Karte und Rahmen entscheidet immer die Bank – FIAON bereitet Sie darauf vor." mitte>
          <div className="as-preise">
            {packs.map((p, i) => (
              <Auf key={p.key} verzoegerung={i * 90}>
                <button type="button" className="as-paket" data-top={p.rec ? "1" : undefined} onClick={() => onWahl(p)} aria-label={`${p.name} (${p.sub}) wählen`}>
                  {p.rec && <span className="band">Beliebt</span>}
                  <div className="as-karte" style={{ background: p.bg }}>
                    <span className="chip" /><span className="wort">FIAON</span>
                    <span className="limit">{p.lim.toLocaleString("de-DE")} €</span>
                    <span className="inhaber">Ziel-Rahmen</span>
                  </div>
                  <p className="name">{p.name}</p>
                  <p className="sub">{p.sub}</p>
                  <p className="betrag dk-verlauf zahl">{euro(p.fee)} €<small>/ Monat</small></p>
                  <ul className="dk-liste">{p.feats.map((f) => <li key={f}>{f}</li>)}</ul>
                  <span className={`dk-knopf${p.rec ? "" : " still"}`}>Dieses Paket wählen</span>
                </button>
              </Auf>
            ))}
          </div>
          <p className="dk-leise" style={{ marginTop: 26, maxWidth: "72ch", marginLeft: "auto", marginRight: "auto" }}>
            Alle Pakete: monatlich per SEPA-Lastschrift oder Überweisung · zwölf Raten, danach entscheiden Sie, ob Sie bleiben · Paket im Antrag jederzeit änderbar.
          </p>
        </Block>

        {/* 3 · Was Sie bekommen */}
        <Block pille="Was Sie bekommen" titel={<>Einsicht. Aktion. <span className="dk-verlauf">Zugang.</span></>} mitte>
          <div style={{ textAlign: "left" }}>
            <Karten items={[
              { tag: "Schicht 1 · Einsicht", titel: "Ihre Auskunft, erklärt.", text: "FIAON beantragt Ihre Auskunft bei SCHUFA, KSV oder CRIF und liest Ihren Kontoauszug. Innerhalb von 24 Stunden sehen Sie, was gespeichert ist – und was sich ändern lässt." },
              { tag: "Schicht 2 · Aktion", titel: "Schreiben, die hinausgehen.", text: "Löschanträge, Widersprüche, Ratenvereinbarungen – vorbereitet, anwaltlich geprüft, mit einem Klick versendet. FIAON verfolgt jede Antwort und jede Frist." },
              { tag: "Schicht 3 · Zugang", titel: "Konto, Karte, Finanzierung.", text: "Girokonto für jeden Kunden, Kreditkarte bis 25.000 € bei guter Bonität, Finanzierung später. Niemand geht leer aus – jeder hat ein nächstes Ziel." },
            ]} />
          </div>
        </Block>

        {/* 4 · So geht es weiter */}
        <Block id="ablauf" pille="So geht es weiter" titel={<>Vom Paket zur <span className="dk-verlauf">ersten Einsicht.</span></>} mitte>
          <div style={{ textAlign: "left" }}>
            <Schritte items={[
              { titel: "Paket wählen", text: "Ein Klick – Sie landen direkt im Antrag. Das Paket lässt sich dort noch ändern." },
              { titel: "Angaben in zwei Minuten", text: "Name, Adresse, Einkommen, Telefon. Verschlüsselt übertragen, am Handy wie am Rechner." },
              { titel: "Zahlung einrichten", text: "SEPA-Lastschrift oder Überweisung. Ihr Bereich ist sofort aktiv, die Auskunft wird beantragt." },
              { titel: "Startgespräch", text: "Ein Mensch ruft Sie an, erklärt Ihre Auskunft und legt mit Ihnen den ersten Schritt fest." },
            ]} />
          </div>
        </Block>
      </Licht>

      {/* 5 · Vertrauen */}
      <Block pille="Ihr Vertrauen" titel={<>Geführt wie ein Finanzinstitut. <span className="dk-verlauf">Gebaut wie eine App.</span></>}
             lead="FIAON LTD mit Sitz in London, Kunden in Deutschland, Österreich und der Schweiz. Jedes Schreiben anwaltlich geprüft, jede Zahlung per SEPA über einen verifizierten Kreditor, jede Akte verschlüsselt in der EU.">
        <div className="dk-zweispaltig" style={{ marginTop: 56 }}>
          <div className="dk-raster zwei" style={{ marginTop: 0 }}>
            {[
              { tag: "01", titel: "Anwaltlich geprüft", text: "Jede Vorlage ist vom Anwaltsteam freigegeben. Kein Schreiben geht hinaus, ohne dass Sie es freigeben." },
              { tag: "02", titel: "SEPA-Lastschrift", text: "Monatliche Raten über einen verifizierten Kreditor. Keine Kreditkarte nötig, keine Vorkasse, jede Abbuchung angekündigt." },
              { tag: "03", titel: "Verschlüsselt, DSGVO-konform", text: "Ihre Auskunft und Ihr Kontoauszug liegen auf Servern in der EU. Sie entscheiden, was Sie hochladen." },
              { tag: "04", titel: "Ein Mensch am Telefon", text: "Jeder Kunde beginnt mit einem Startgespräch. Danach kennen Sie Ihren Ansprechpartner mit Namen." },
            ].map((k, i) => <Auf key={k.tag} verzoegerung={i * 80}><Glas tag={k.tag} titel={k.titel}>{k.text}</Glas></Auf>)}
          </div>
          <Auf verzoegerung={150}><div className="dk-szene gross"><SchichtenSzene namen={["Anwaltlich geprüft", "SEPA-Lastschrift", "EU-Server"]} className="absolute inset-0" /></div></Auf>
        </div>
      </Block>

      <Zwischenruf text="Unsicher, welches Paket passt? Wählen Sie eines – im Startgespräch prüfen wir es gemeinsam und ändern es, wenn nötig." knopf="Pakete ansehen" href="#pakete" still={{ knopf: "Was ist FIAON", href: "/was-ist-fiaon" }} />

      {/* 6 · Fragen */}
      <Block schmal pille="Häufige Fragen">
        <Fragen items={[
          { f: "Was passiert nach dem Klick auf ein Paket?", a: "Sie landen im Antrag: wenige Angaben, zwei Minuten. Danach richten Sie die Zahlung ein, und Ihr Bereich ist sofort aktiv. FIAON beantragt Ihre Auskunft." },
          { f: "Wann zahle ich?", a: "Die erste Rate mit der Aktivierung – per SEPA-Lastschrift oder Überweisung. Danach monatlich, zwölf Raten lang. Nach der zwölften fragen wir Sie, ob Sie bleiben möchten." },
          { f: "Kann ich das Paket später ändern?", a: "Ja, direkt im Antrag über „Paket ändern“ – und im Startgespräch prüfen wir gemeinsam, ob es passt." },
          { f: "Brauche ich Unterlagen?", a: "Für den Antrag nicht. Die Auskunft beantragt FIAON für Sie. Einen Kontoauszug können Sie später in Ihrem Bereich hochladen – für die Analyse Ihres Spielraums." },
          { f: "Bekomme ich garantiert eine Karte?", a: "Über Konto, Karte und Rahmen entscheidet immer die Bank. FIAON bringt Ihre Bonität in Ordnung und bereitet Sie vor – ein Girokonto ist für jeden Kunden erreichbar, eine Karte bis 25.000 € bei guter Bonität." },
        ]} />
      </Block>

      {/* 7 · Abschluss */}
      <section className="dk-block as-abschluss">
        <div className="dk-rahmen schmal mitte">
          <Auf>
            <span className="dk-pille">Bereit</span>
            <h2 className="dk-h2">Ihr Weg beginnt <span className="dk-verlauf">mit einem Klick.</span></h2>
            <p className="dk-lead">Konto in zwei Minuten. Ihre Auskunft innerhalb von 24 Stunden. Ein Mensch, der Sie durch alles Weitere begleitet.</p>
            <div className="dk-knoepfe"><Knopf onClick={zuPaketen}>Paket wählen</Knopf></div>
          </Auf>
        </div>
      </section>
    </div>
  );
}
