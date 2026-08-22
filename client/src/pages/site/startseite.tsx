// ═══════════════════════════════════════════════════════════════════════════
// DIE STARTSEITE — Vision in zehn Sekunden, Tiefe beim Scrollen (22.08.2026)
// Texte: ~/Desktop/FIAON/05_Vision/WEBSITE_TEXTE.md · Preise: shared/fiaon-pakete.ts (eine Wahrheit)
// ═══════════════════════════════════════════════════════════════════════════
import { SiteShell, Auf, Abschnitt } from "@/components/site/SiteShell";
import { Buehne, Ebene, Karte3D, Geraet } from "@/components/site/Buehne3D";
import { PAKETE } from "@shared/fiaon-pakete";

const eur = (c: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(c / 100);

export default function Startseite() {
  const privat = PAKETE.filter((p) => p.art === "privat" && p.abo);
  return (
    <SiteShell seite="startseite" titel="Das Betriebssystem für Bonität" beschreibung="FIAON zeigt Ihnen, was die Auskunfteien über Sie wissen, repariert es mit Ihnen — und öffnet dann die Tür zu Konto, Karte und Finanzierung.">
      {/* ── Szene 1: die Karte im Raum ───────────────────────────────── */}
      <section className="ws-abschnitt" style={{ paddingTop: 40 }}>
        <div className="ws-rahmen">
          <Buehne hoehe={520}>{(p) => (
            <div style={{ display: "grid", gap: 40, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", alignItems: "center" }}>
              <Ebene tiefe={0.2} scroll={p}>
                <p className="ws-ueber">Das Betriebssystem für Bonität</p>
                <h1 className="ws-h1">Wissen, was die Auskunfteien über Sie wissen. <span className="ws-verlauf">Und es ändern.</span></h1>
                <p className="ws-lead">FIAON zeigt Ihnen Ihre Bonität, repariert sie mit Ihnen — und öffnet dann die Tür zu Konto, Karte und Finanzierung.</p>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 28 }}>
                  <a className="ws-knopf" href="/antrag">Jetzt starten</a>
                  <a className="ws-knopf still" href="#so">So funktioniert es</a>
                </div>
                <p className="ws-hinweis" style={{ marginTop: 14 }}>Ab 7,99 € im Monat · 12 Raten, dann Ihre Entscheidung · jederzeit zum Monatsende kündbar</p>
              </Ebene>
              <div style={{ position: "relative", minHeight: 360, display: "grid", placeItems: "center", justifyItems: "center" }}>
                <Ebene tiefe={0.6} scroll={p}><Karte3D /></Ebene>
                <Ebene tiefe={1.1} scroll={p} className="ws-schwebe-wrap" style={{ position: "absolute", left: "2%", top: "6%" }}>
                  <div className="ws-schwebe ws-glas"><b>Einsicht</b>Ihr Wert, jeder Eintrag erklärt<small>SCHUFA · KSV · CRIF</small></div>
                </Ebene>
                <Ebene tiefe={0.9} scroll={p} className="ws-schwebe-wrap" style={{ position: "absolute", right: "0%", top: "48%" }}>
                  <div className="ws-schwebe ws-glas"><b>Aktion</b>Löschantrag mit einem Klick<small>juristisch geprüft</small></div>
                </Ebene>
                <Ebene tiefe={1.4} scroll={p} className="ws-schwebe-wrap" style={{ position: "absolute", left: "10%", bottom: "-2%" }}>
                  <div className="ws-schwebe ws-glas"><b>Zugang</b>Konto heute, Karte als Ziel<small>DKB · bis 25.000 €</small></div>
                </Ebene>
                {/* Am Handy stapeln die drei Tafeln unter der Karte, statt sie zu verdecken. */}
                <div className="ws-schwebe-mobil">
                  <div className="ws-schwebe ws-glas"><b>Einsicht</b>Ihr Wert, jeder Eintrag erklärt<small>SCHUFA · KSV · CRIF</small></div>
                  <div className="ws-schwebe ws-glas"><b>Aktion</b>Löschantrag mit einem Klick<small>juristisch geprüft</small></div>
                  <div className="ws-schwebe ws-glas"><b>Zugang</b>Konto heute, Karte als Ziel<small>DKB · bis 25.000 €</small></div>
                </div>
              </div>
            </div>
          )}</Buehne>
        </div>
      </section>

      {/* ── Szene 2–4: die drei Schichten ────────────────────────────── */}
      <Abschnitt id="so" ueber="So funktioniert es" titel={<>Zuerst Klarheit. Dann Bewegung. <span className="ws-verlauf">Dann die Tür.</span></>} lead="Drei Schichten, ein Weg. Niemand geht leer aus — jeder hat ein nächstes Ziel.">
        <div className="ws-raster">
          {[
            ["01 · Einsicht", "Zuerst Klarheit.", "Auskunft aus SCHUFA, KSV1870 oder CRIF, dazu die Auswertung Ihres Kontoauszugs: Einnahmen, Fixkosten, Spielraum. Ihr Wert als Bogen, jeder Eintrag in Menschensprache erklärt — rechtmäßig, angreifbar oder rechtswidrig."],
            ["02 · Aktion", "Dann Bewegung.", "Löschanträge, Berichtigungen, Widersprüche, Ratenvereinbarungen: vorbereitet, vom Anwaltsteam geprüft, mit einem Klick versendet. FIAON erinnert Sie an Fristen und plant den nächsten Schritt, sobald eine Antwort kommt."],
            ["03 · Zugang", "Dann die Tür.", "Ein Girokonto der DKB für jeden Kunden — heute. Eine Kreditkarte bis 25.000 € bei guter Bonität. Finanzierung, sobald Ihr Wert stabil ist. Der Weg dorthin ist sichtbar: Etappe für Etappe in Ihrem Fahrplan."],
          ].map(([u, t, b], i) => (
            <Auf key={u} verzoegerung={i * 120}><div className="ws-karte hoch" style={{ minHeight: 280 }}><p className="ws-ueber">{u}</p><h3 className="ws-h3">{t}</h3><p style={{ marginTop: 12, color: "var(--w-leise)", fontSize: 15 }}>{b}</p></div></Auf>
          ))}
        </div>
      </Abschnitt>

      {/* ── Szene 5: die Plattform ───────────────────────────────────── */}
      <section className="ws-abschnitt">
        <div className="ws-rahmen">
          <Buehne hoehe={640}>{(p) => (
            <div style={{ display: "grid", gap: 40, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", alignItems: "center" }}>
              <div style={{ display: "grid", placeItems: "center" }}><Ebene tiefe={0.5} scroll={p}><Geraet scroll={p} /></Ebene></div>
              <Ebene tiefe={0.15} scroll={p}>
                <p className="ws-ueber">Ihr Bereich</p>
                <h2 className="ws-h2">Alles an einem Ort. <span className="ws-verlauf">Immer auf dem Handy.</span></h2>
                <ul className="ws-liste">
                  <li>Ihr Fahrplan in sieben Etappen — genau eine ist „jetzt".</li>
                  <li>Ihre Finanzen: aus dem Kontoauszug gezählt, nicht geschätzt.</li>
                  <li>Ihre Schreiben: vorbereitet, prüfbar, mit einem Klick versendet.</li>
                  <li>Ihr Ansprechpartner: ein Mensch, der Sie kennt — nicht ein Ticket.</li>
                  <li>Zahlungskalender, Lastschrift, Abo: alles unter Ihrer Kontrolle.</li>
                </ul>
                <a className="ws-knopf" href="/antrag" style={{ marginTop: 28 }}>Bereich eröffnen</a>
              </Ebene>
            </div>
          )}</Buehne>
        </div>
      </section>

      {/* ── Szene 6: Zahlen ──────────────────────────────────────────── */}
      <Abschnitt ueber="Warum es uns gibt" titel="100 Millionen Menschen im deutschsprachigen Raum. Millionen mit einem Eintrag, den niemand erklärt." mitte>
        <div className="ws-raster">
          {[["~6 Mio.", "überschuldete Personen allein in Deutschland"], ["< 24 h", "von der Auskunft zur fertigen Analyse — unser Nordstern"], ["3", "Auskunfteien angebunden: SCHUFA · KSV1870 · CRIF"], ["12 Raten", "dann entscheiden Sie, ob Sie bleiben"]].map(([z, t], i) => (
            <Auf key={z} verzoegerung={i * 100}><div className="ws-karte" style={{ textAlign: "center" }}><div className="ws-kennzahl">{z}</div><p style={{ marginTop: 10, color: "var(--w-leise)", fontSize: 14.5 }}>{t}</p></div></Auf>
          ))}
        </div>
      </Abschnitt>

      {/* ── Szene 7: Pakete (eine Preiswahrheit) ─────────────────────── */}
      <Abschnitt id="pakete" ueber="Pakete" titel="Vier Wege, ein Ziel." lead="Monatlich, 12 Raten, danach Ihre Entscheidung. Die Bonitätsauskunft kommt einmalig mit 74 € dazu — oder Sie bringen Ihre eigene mit.">
        <div className="ws-raster">
          {privat.map((p, i) => (
            <Auf key={p.key} verzoegerung={i * 90}>
              <div className={`ws-karte ${p.key === "pro" ? "hoch" : ""}`} style={p.key === "pro" ? { borderColor: "rgba(40,141,250,.45)" } : undefined}>
                {p.key === "pro" && <p className="ws-ueber">Empfohlen</p>}
                <h3 className="ws-h3">{p.label}</h3>
                <div style={{ marginTop: 14, display: "flex", alignItems: "baseline", gap: 6 }}><span className="zahl" style={{ fontSize: 34, fontWeight: 800, color: "var(--w-tief)" }}>{eur(p.preisCents)}</span><span className="ws-hinweis">/ Monat</span></div>
                <p style={{ marginTop: 10, color: "var(--w-leise)", fontSize: 14 }}>{{ start: "Ziel-Rahmen 500 € · das Fundament", pro: "Ziel-Rahmen 5.000 € · der Standard", ultra: "Ziel-Rahmen 15.000 € · das Elite-Konto", highend: "Ziel-Rahmen 25.000 € · das Maximum" }[p.key] || ""}</p>
                <a className={`ws-knopf ${p.key === "pro" ? "" : "still"}`} href={`/antrag?pack=${p.key}`} style={{ marginTop: 18, width: "100%" }}>Wählen</a>
              </div>
            </Auf>
          ))}
        </div>
        <p className="ws-hinweis" style={{ marginTop: 18 }}>FIAON ist kein Kreditinstitut und vermittelt keine Kredite. Die Karte ist das Ziel des Programms, nicht sein Versprechen — ob und wann Sie sie bekommen, entscheidet Ihre Bonität beim Kartenpartner.</p>
      </Abschnitt>

      {/* ── Szene 8: Vertrauen + Abschluss ───────────────────────────── */}
      <Abschnitt ueber="Vertrauen" titel="Geführt, als würde morgen verkauft." lead="Jede Entscheidung steht im Register, jedes Schreiben wird juristisch geprüft, jede Zahlung ist nachvollziehbar.">
        <div className="ws-raster">
          {[["FIAON LTD", "Sitz London, Companies House 17318250, Kreditor in Österreich verifiziert."], ["Verschlüsselt", "SEPA-Zahlung, signierte Links, keine Weitergabe Ihrer Daten an Dritte."], ["Menschen", "Ein Ansprechpartner, der Sie kennt. Startgespräch vor der Freischaltung."]].map(([t, b], i) => (
            <Auf key={t} verzoegerung={i * 100}><div className="ws-karte"><h3 className="ws-h3">{t}</h3><p style={{ marginTop: 10, color: "var(--w-leise)", fontSize: 14.5 }}>{b}</p></div></Auf>
          ))}
        </div>
        <Auf><div className="ws-glas" style={{ marginTop: 48, padding: 40, textAlign: "center" }}>
          <h2 className="ws-h2">Ihr Weg beginnt mit einer E-Mail-Adresse.</h2>
          <p className="ws-lead" style={{ margin: "14px auto 0" }}>Antrag in wenigen Minuten. Wir erinnern Sie, falls Sie unterbrochen werden — genau an der Stelle, an der Sie aufgehört haben.</p>
          <a className="ws-knopf" href="/antrag" style={{ marginTop: 24 }}>Jetzt starten</a>
        </div></Auf>
      </Abschnitt>
    </SiteShell>
  );
}
