// ═══════════════════════════════════════════════════════════════════════════
// /fiaon-erfahrungen — die Brand-Seite (30.08.2026)
//
// Suchintention: „fiaon erfahrungen / seriös“. Wer den Firmennamen mit
// „Erfahrungen“ sucht, steht kurz vor der Entscheidung und will wissen, ob
// er uns trauen kann. Die Antwort dieser Seite ist Transparenz: wie FIAON
// arbeitet, was es kostet, was wir NICHT versprechen — und woran man
// unseriöse Anbieter erkennt. Die Abgrenzung ist die stärkste
// Vertrauens-Sektion, weil sie prüfbare Kriterien nennt statt Eigenlob.
//
// ── DIE ZAHLEN SIND PLATZHALTER ────────────────────────────────────────────
// Die Konstanten in ZAHLEN unten sind bewusst als Platzhalter angelegt und
// mit „~“ gekennzeichnet; der Betreiber trägt die echten, gemessenen Werte
// ein (AGENTS.md: eine Zahl in einer Aussage wird GEMESSEN, nicht geschätzt).
// JSON-LD: Organization + FAQPage.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect } from "react";
import { Dunkel, Block, Licht, Knopf, Fragen, Karten, Kennzahlen, Auf } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import KartenAufruf from "@/components/site/KartenAufruf";
import "@/styles/ratgeber.css";
import "@/styles/seo-seiten.css";

// ── PLATZHALTER — echte Werte trägt der Betreiber ein. ──────────────────────
const ZAHLEN = {
  kunden: "1.000+",          // Kunden im DACH-Raum (Platzhalter)
  auskuenfte: "2.500+",      // beschaffte und geprüfte Auskünfte (Platzhalter)
  antwortzeit: "< 24 Std.",  // Antwortzeit im Kundenbereich (Platzhalter)
};

const FRAGEN = [
  { f: "Ist FIAON seriös?", a: "Prüfen Sie uns an den Kriterien, die für jeden Anbieter gelten — sie stehen weiter oben auf dieser Seite: transparente Festpreise statt Erfolgsbeteiligung, keine Löschgarantien, der Hinweis auf Ihre kostenlosen Rechte, ein Impressum mit erreichbaren Menschen und der Satz „die Entscheidung trifft die Bank“. FIAON erfüllt jeden dieser Punkte — und schreibt sie deshalb öffentlich hin." },
  { f: "Was macht FIAON genau?", a: "FIAON beschafft Ihre Bonitätsauskünfte bei SCHUFA, KSV und CRIF, erklärt jede Zeile in Klartext, prüft jeden Eintrag auf Zulässigkeit und Verfristung und führt den Schriftwechsel für alles Angreifbare. Dazu kommt der Weg zum Girokonto beim Partnerinstitut — Konto und Karte als Ziel, die Eröffnung entscheidet die Bank." },
  { f: "Was kostet FIAON?", a: "Die Bonitätsauskunft mit Prüfung kostet einmalig 74 Euro. Die Pakete für die laufende Begleitung laufen über zwölf Monatsraten; alle Preise stehen offen auf der Preisseite. Es gibt keine Erfolgsbeteiligung und keine versteckten Gebühren — was es kostet, steht fest, bevor Sie unterschreiben." },
  { f: "Kann FIAON meine SCHUFA-Einträge löschen?", a: "FIAON kann durchsetzen, was das Gesetz hergibt: die Löschung unzulässig gemeldeter, inhaltlich falscher oder verfristeter Einträge. Berechtigte, zulässig gemeldete Einträge bleiben bis zum Fristablauf — wer Ihnen anderes verspricht, arbeitet unseriös. Diese Ehrlichkeit ist Teil unseres Modells." },
  { f: "Wie sehe ich, was FIAON für mich tut?", a: "In Ihrem Kundenbereich: jeder Auftrag, jede eingegangene Auskunft, jedes Schreiben und jede Frist als nachvollziehbarer Verlauf. Sie müssen nicht anrufen, um den Stand zu erfahren — er steht da, und bei Fragen antwortet ein Mensch, in der Regel binnen eines Werktags." },
  { f: "Arbeitet FIAON auch in Österreich und der Schweiz?", a: "Ja, FIAON ist für den gesamten DACH-Raum gebaut: SCHUFA in Deutschland, KSV in Österreich, CRIF in der Schweiz — aus einer Hand, mit den jeweiligen Rechtsgrundlagen (DSGVO bzw. revidiertes DSG)." },
  { f: "Wie kündige ich, wenn ich nicht zufrieden bin?", a: "Die Pakete laufen über zwölf Monate und enden, wie vereinbart; die Kündigungswege stehen transparent im Kundenbereich und auf der Abo-Kündigen-Seite — ohne Rückhalte-Schleifen. Ihr gesetzliches Widerrufsrecht bleibt davon unberührt." },
];

export default function FiaonErfahrungen() {
  useEffect(() => {
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "FIAON",
      url: "https://fiaon.com",
      areaServed: ["DE", "AT", "CH"],
      description: "FIAON beschafft und prüft Bonitätsauskünfte (SCHUFA, KSV, CRIF), erklärt jeden Eintrag und begleitet den Weg zu Girokonto und Karte beim Partnerinstitut.",
      sameAs: ["https://fiaon.com/team", "https://fiaon.com/sicherheit"],
    });
    document.head.appendChild(el);
    return () => el.remove();
  }, []);

  return (
    <Dunkel seite="ratgeber" titel="FIAON Erfahrungen: So arbeitet FIAON" beschreibung="FIAON Erfahrungen: wie FIAON arbeitet, was es kostet, was wir nicht versprechen — und woran Sie unseriöse Anbieter erkennen. Jetzt selbst prüfen.">
      <SeoDaten
        pfad="/fiaon-erfahrungen"
        titel="FIAON Erfahrungen: So arbeitet FIAON | FIAON"
        beschreibung="FIAON Erfahrungen: wie FIAON arbeitet, was es kostet, was wir nicht versprechen — und woran Sie unseriöse Anbieter erkennen. Jetzt selbst prüfen."
        fragen={FRAGEN}
        krumen={[{ name: "FIAON Erfahrungen", pfad: "/fiaon-erfahrungen" }]}
      />

      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/akten.jpg" alt="" decoding="async" {...({ fetchpriority: "high" } as any)} /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">Transparenz statt Werbeversprechen</span>
          <h1 className="dk-h1">So arbeitet <span className="dk-verlauf">FIAON.</span></h1>
          <p className="dk-lead">
            Wer „FIAON Erfahrungen“ sucht, will wissen: Kann ich denen trauen?
            Die ehrlichste Antwort ist, Ihnen alles Prüfbare hinzulegen — wie wir arbeiten,
            was es kostet, was wir ausdrücklich nicht versprechen. Urteilen Sie selbst.
          </p>
          <div className="dk-knoepfe">
            <Knopf href="/antrag">Jetzt Antrag starten</Knopf>
            <Knopf href="/kontakt" still>Kostenlos prüfen lassen</Knopf>
          </div>
        </div>
      </section>

      <Licht>
        {/* Zahlen — Platzhalter, klar gekennzeichnet. */}
        <Block schmal mitte titel="FIAON in Zahlen" lead="Gerundete Werte aus dem laufenden Betrieb — regelmäßig aktualisiert.">
          <Kennzahlen items={[
            { wert: ZAHLEN.kunden, label: "Kunden im DACH-Raum" },
            { wert: ZAHLEN.auskuenfte, label: "beschaffte und geprüfte Auskünfte" },
            { wert: ZAHLEN.antwortzeit, label: "Antwortzeit im Kundenbereich" },
          ]} />
        </Block>

        {/* Der Ablauf, transparent. */}
        <Block schmal titel="Der Ablauf — transparent von Anfang bis Ende" lead="Kein Kleingedrucktes im Prozess: So läuft ein FIAON-Auftrag wirklich.">
          <Auf>
            <div className="sx-zeitleiste">
              <div className="sx-etappe">
                <div className="spur"><span className="punkt">1</span><span className="faden" /></div>
                <div className="inhalt">
                  <span className="dauer">2 Minuten</span>
                  <h3>Antrag mit Festpreis</h3>
                  <p>Sie sehen den Preis, BEVOR Sie beauftragen — Bonitätsauskunft 74 Euro einmalig, Pakete über zwölf Monatsraten. Keine Erfolgsbeteiligung, keine Nachschläge.</p>
                </div>
              </div>
              <div className="sx-etappe">
                <div className="spur"><span className="punkt">2</span><span className="faden" /></div>
                <div className="inhalt">
                  <span className="dauer">Tage bis 4 Wochen</span>
                  <h3>Beschaffung bei drei Häusern</h3>
                  <p>SCHUFA, KSV, CRIF — FIAON fordert Ihre Datenkopien an. Den Eingang sehen Sie in Ihrem Kundenbereich, nicht in einer Warteschleife.</p>
                </div>
              </div>
              <div className="sx-etappe">
                <div className="spur"><span className="punkt">3</span><span className="faden" /></div>
                <div className="inhalt">
                  <span className="dauer">binnen 24 Stunden nach Eingang</span>
                  <h3>Prüfung mit Klartext-Ergebnis</h3>
                  <p>Jede Zeile erklärt, jeder Eintrag gegen § 31 BDSG und die Löschfristen gehalten. Sie erfahren auch, was NICHT angreifbar ist — vorher, nicht hinterher.</p>
                </div>
              </div>
              <div className="sx-etappe">
                <div className="spur"><span className="punkt">4</span></div>
                <div className="inhalt">
                  <span className="dauer">laufend</span>
                  <h3>Durchsetzung und Konto-Weg</h3>
                  <p>Schriftwechsel und Fristen für alles Angreifbare; parallel der Weg zum Girokonto beim Partner. Konto und Karte sind Ziele — die Entscheidung trifft die Bank, und genau so steht es überall bei uns.</p>
                </div>
              </div>
            </div>
          </Auf>
        </Block>

        {/* Woran man unseriöse Anbieter erkennt — die Abgrenzung. */}
        <Block titel="Woran Sie unseriöse Anbieter erkennen" lead="Diese Kriterien gelten für jeden in diesem Markt — auch für uns. Prüfen Sie beides.">
          <Karten items={[
            { tag: "Warnzeichen 1", titel: "Löschgarantien", text: "„Wir löschen jeden Eintrag“ ist rechtlich unmöglich: Berechtigte, zulässig gemeldete Einträge bleiben bis zum Fristablauf. Wer Garantien verspricht, kassiert für Hoffnung. FIAON benennt vorab, was angreifbar ist — und was nicht." },
            { tag: "Warnzeichen 2", titel: "Erfolgsbeteiligung pro Eintrag", text: "Abrechnung „pro gelöschtem Eintrag“ schafft den Anreiz, Ihnen viele Angriffe zu verkaufen statt die richtigen. Seriös sind Festpreise, die vorher feststehen — bei FIAON: 74 Euro für die geprüfte Auskunft, Pakete mit festen Raten." },
            { tag: "Warnzeichen 3", titel: "Ihre Gratis-Rechte verschweigen", text: "Datenkopie nach Art. 15 DSGVO, Basiskonto nach § 31 ZKG: Ihre kostenlosen Rechte gehören auf den Tisch, bevor jemand Geld nimmt. FIAON verlinkt die Gratis-Wege auf jeder Themenseite — wer das nicht tut, verkauft Ihnen Ihr eigenes Recht." },
            { tag: "Warnzeichen 4", titel: "Vorkasse an anonyme Empfänger", text: "Kein Impressum, keine erreichbaren Menschen, Zahlung an ausländische Konten oder per Gutschein: Finger weg. FIAON hat ein Impressum mit Anschrift, ein Team mit Namen und Gesichtern und nachvollziehbare Zahlwege." },
            { tag: "Warnzeichen 5", titel: "Erfolg über Nacht", text: "Score-Sprünge „in 48 Stunden“ scheitern an der Realität: Auskunfteien haben Antwortfristen, Scores werden in Läufen neu berechnet. Seriöse Anbieter nennen ehrliche Zeiträume — wir tun das auf jeder Seite." },
            { tag: "Warnzeichen 6", titel: "Druck statt Klarheit", text: "Countdown-Timer, „nur heute“, Anruf-Druck: Wer Ihnen keine Zeit zum Prüfen lässt, fürchtet Ihre Prüfung. Diese Seite ist das Gegenteil — nehmen Sie sich die Zeit, und vergleichen Sie uns an genau diesen Kriterien." },
          ]} />
        </Block>

        {/* Team und Sicherheit — die bestehenden Seiten tragen die Tiefe. */}
        <Block schmal titel="Menschen und Sicherheit" lead="Vertrauen hat zwei Adressen: wer arbeitet, und wie mit Ihren Daten umgegangen wird.">
          <div className="sx-vertiefen">
            <a href="/team">
              <b>Das FIAON-Team</b>
              <span>Namen, Gesichter, Verantwortlichkeiten — die Menschen hinter der Plattform, ohne Stockfotos.</span>
            </a>
            <a href="/sicherheit">
              <b>Sicherheit und Datenschutz</b>
              <span>Wie FIAON Ihre Daten schützt: Verschlüsselung, Zugriffe, Speicherung — im Detail erklärt.</span>
            </a>
            <a href="/preise">
              <b>Alle Preise offen</b>
              <span>Jedes Paket, jede Rate, keine Sternchen. Was es kostet, steht fest, bevor Sie unterschreiben.</span>
            </a>
            <a href="/was-ist-fiaon">
              <b>Was ist FIAON?</b>
              <span>Das Modell hinter der Plattform — für alle, die es von Grund auf verstehen wollen.</span>
            </a>
          </div>
        </Block>

        <Block schmal titel="Häufige Fragen zu FIAON">
          <Fragen items={FRAGEN} />
          <p className="dk-leise" style={{ marginTop: 22 }}>
            Stand August 2026. FIAON ist keine Rechtsberatung und keine Bank; Konto und Karte
            entstehen beim Partnerinstitut — die Entscheidung trifft die Bank.
          </p>
        </Block>
      </Licht>

      <KartenAufruf
        titel="Prüfen Sie uns — an unseren eigenen Kriterien."
        satz="Festpreis, ehrliche Grenzen, jeder Schritt sichtbar in Ihrem Kundenbereich: So arbeitet FIAON. Wenn Ihnen das gefällt, dauert der Anfang zwei Minuten."
      />
    </Dunkel>
  );
}
