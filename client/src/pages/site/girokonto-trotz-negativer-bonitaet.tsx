// ═══════════════════════════════════════════════════════════════════════════
// /girokonto-trotz-negativer-bonitaet — der Pfeiler zur Konto-Suche
// (30.08.2026)
//
// Suchintention: „konto trotz schufa“. Hier ist die Compliance DOPPELT
// streng: Das Konto entsteht beim Partner, die Eröffnung entscheidet die
// Bank — dieser Satz steht im Hero, im Weg, in der Ehrlichkeits-Sektion und
// im Abschluss. Die Ehrlichkeits-Sektion („Was wir nicht versprechen“) ist
// kein Feigenblatt, sondern die stärkste Vertrauens-Sektion der Seite: Wer
// in diesem Markt sagt, was er NICHT kann, unterscheidet sich von fast
// allen Treffern daneben. JSON-LD: Service + FAQPage.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect } from "react";
import { Dunkel, Block, Licht, Knopf, Fragen, Karten, Auf, Glas } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import KartenAufruf from "@/components/site/KartenAufruf";
import "@/styles/ratgeber.css";
import "@/styles/seo-seiten.css";

const FRAGEN = [
  { f: "Bekomme ich trotz negativer SCHUFA wirklich ein Girokonto?", a: "Ein Konto auf Guthabenbasis ist für die meisten Menschen erreichbar — und auf das Basiskonto besteht in Deutschland sogar ein gesetzlicher Anspruch (§ 31 ZKG). FIAON bereitet den Weg vor und räumt die Datenlage auf; die Eröffnung selbst entscheidet immer die Bank. Genau deshalb versprechen wir keine Eröffnung — sondern einen sauber vorbereiteten Antrag." },
  { f: "Was bringt ein aktives Konto für meine Bonität?", a: "Ein geführtes Konto mit regelmäßigen Eingängen und pünktlichen Abbuchungen erzeugt über die Zeit genau die Datenlage, die Risiko-Modelle positiv lesen: Stabilität, Historie, Verlässlichkeit. Es ist kein Zaubertrick und wirkt nicht über Nacht — es ist die Grundlage, auf der alles Weitere aufbaut." },
  { f: "Was ist der Unterschied zwischen Basiskonto und dem Konto über FIAON?", a: "Das Basiskonto ist Ihr gesetzlicher Anspruch bei jeder kontoführenden Bank — Guthabenbasis, volle Grundfunktionen, aber oft vergleichsweise teuer und ohne Weg zu Karte oder Rahmen. Der FIAON-Weg zielt auf ein vollwertiges Girokonto beim Partner samt Karte als ZIEL — verbunden mit der Aufräumarbeit an Ihrer Datenlage. Beide Wege stehen in der Tabelle auf dieser Seite." },
  { f: "Führt FIAON selbst Konten?", a: "Nein. FIAON ist keine Bank. Konto und Karte entstehen beim Partnerinstitut; FIAON beschafft und prüft Ihre Auskünfte, bereitet den Antrag vor und begleitet den Weg. Über Eröffnung, Karte und Rahmen entscheidet die Bank nach eigenen Regeln." },
  { f: "Wie lange dauert der Weg zum Konto?", a: "Der FIAON-Antrag dauert etwa zwei Minuten. Danach hängt das Tempo von zwei Dingen ab: wie schnell die Auskunfteien liefern (Tage bis etwa vier Wochen) und wie die Bank entscheidet. Einen festen Termin verspricht Ihnen hier niemand seriös — Sie sehen aber jeden Schritt in Ihrem Kundenbereich." },
  { f: "Kostet der Kontoantrag bei FIAON extra?", a: "Der Weg zum Konto ist Teil der FIAON-Pakete; die Preise stehen transparent auf der Preisseite. Es gibt keine Erfolgsprovision auf eine Kontoeröffnung — so bleibt unser Rat frei von falschen Anreizen." },
  { f: "Was passiert, wenn die Bank ablehnt?", a: "Dann sagen wir Ihnen das ehrlich — mit dem, was sich aus der Datenlage ableiten lässt: welche Einträge stören, welche angreifbar sind, was die 100-Tage-Regel bringen kann. Häufig ist die Ablehnung der Anfang der eigentlichen Arbeit: Datenlage bereinigen, dann erneut antragen. Ein Rechtsanspruch auf das Basiskonto bleibt Ihnen daneben immer." },
];

export default function GirokontoTrotzNegativerBonitaet() {
  useEffect(() => {
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Service",
      name: "FIAON Konto-Weg bei schwieriger Bonität",
      serviceType: "Vorbereitung des Girokonto-Antrags beim Partnerinstitut inklusive Bonitätsprüfung",
      provider: { "@type": "Organization", name: "FIAON", url: "https://fiaon.com" },
      areaServed: ["DE", "AT", "CH"],
    });
    document.head.appendChild(el);
    return () => el.remove();
  }, []);

  return (
    <Dunkel seite="ratgeber" titel="Girokonto trotz negativer Bonität: der ehrliche Weg" beschreibung="Girokonto trotz negativer Bonität: was wirklich erreichbar ist, was ein aktives Konto für Ihre Bonität baut und was niemand versprechen kann. Jetzt starten.">
      <SeoDaten
        pfad="/girokonto-trotz-negativer-bonitaet"
        titel="Girokonto trotz negativer Bonität | FIAON"
        beschreibung="Girokonto trotz negativer Bonität: was wirklich erreichbar ist, was ein aktives Konto für Ihre Bonität baut und was niemand versprechen kann. Jetzt starten."
        fragen={FRAGEN}
        krumen={[{ name: "Girokonto trotz negativer Bonität", pfad: "/girokonto-trotz-negativer-bonitaet" }]}
      />

      {/* Hero mit dem Kartenbild — die Karte ist ZIEL, nie Zusage. */}
      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="https://fiaon.com/mail/fiaon-karte-banner.jpg" alt="" decoding="async" {...({ fetchpriority: "high" } as any)} /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">Ehrlich statt vollmundig</span>
          <h1 className="dk-h1">Girokonto trotz negativer Bonität — <span className="dk-verlauf">der ehrliche Weg.</span></h1>
          <p className="dk-lead">
            Ja, ein Konto ist auch mit schwieriger Datenlage erreichbar — und nein, versprechen kann
            Ihnen das niemand seriös: Die Eröffnung entscheidet immer die Bank. Hier steht, was
            wirklich geht, was ein aktives Konto für Ihre Bonität baut, und was wir ausdrücklich
            nicht zusagen.
          </p>
          <div className="dk-knoepfe">
            <Knopf href="/antrag">Jetzt Antrag starten</Knopf>
            <Knopf href="/kontakt" still>Kostenlos prüfen lassen</Knopf>
          </div>
        </div>
      </section>

      <Licht>
        {/* Warum ein aktives Konto Bonität baut. */}
        <Block titel="Warum ein aktives Konto Ihre Bonität baut" lead="Kein Trick, sondern Datenlage: Risiko-Modelle lesen Verhalten — ein geführtes Konto erzeugt das richtige.">
          <Karten items={[
            { tag: "Historie", titel: "Ein Konto, das läuft, erzählt Stabilität", text: "Regelmäßige Gehaltseingänge, pünktliche Abbuchungen, keine Rückgaben: Über Monate entsteht genau das Bild, das Banken sehen wollen. Ein altes, ruhig geführtes Konto ist eines der stärksten Positivmerkmale überhaupt — und es beginnt mit der Eröffnung, nicht mit dem perfekten Score." },
            { tag: "Ordnung", titel: "Ein Konto bündelt, was vorher schiefging", text: "Viele Negativmerkmale entstehen aus Chaos, nicht aus Geldmangel: die Abbuchung vom falschen Konto, der vergessene Dauerauftrag, die Rücklastschrift im Umzugsmonat. EIN sauber geführtes Konto mit Übersicht beendet diese Fehlerquelle — und unser Zahlungskalender erinnert, bevor etwas platzt." },
            { tag: "Anschluss", titel: "Vom Guthabenkonto zur Karte — als Ziel", text: "Der Weg führt über Stufen: erst das Konto auf Guthabenbasis, dann — wenn die Führung stimmt und die Bank zustimmt — Karte und Rahmen. Jede Stufe ist ein ZIEL, keine Zusage. Aber jede erreichte Stufe macht die nächste wahrscheinlicher, weil sie neue Positivdaten erzeugt." },
          ]} />
        </Block>

        {/* Der Weg über FIAON. */}
        <Block schmal titel="Der Weg über FIAON" lead="Vier Etappen — und an der entscheidenden steht nicht FIAON, sondern die Bank. Das gehört zur Wahrheit.">
          <Auf>
            <div className="sx-zeitleiste">
              <div className="sx-etappe">
                <div className="spur"><span className="punkt">1</span><span className="faden" /></div>
                <div className="inhalt">
                  <span className="dauer">2 Minuten</span>
                  <h3>FIAON-Konto eröffnen</h3>
                  <p>Sie legen Ihren FIAON-Zugang an und beauftragen den Konto-Weg. Ab hier sehen Sie jeden Schritt in Ihrem Kundenbereich — nichts passiert im Verborgenen.</p>
                </div>
              </div>
              <div className="sx-etappe">
                <div className="spur"><span className="punkt">2</span><span className="faden" /></div>
                <div className="inhalt">
                  <span className="dauer">Tage bis 4 Wochen</span>
                  <h3>Datenlage klären</h3>
                  <p>FIAON beschafft Ihre Auskünfte (SCHUFA, KSV, CRIF) und prüft jeden Eintrag: Was ist zulässig, was verfristet, was falsch? Angreifbares wird angegangen — ein Antrag mit aufgeräumter Datenlage ist ein besserer Antrag.</p>
                </div>
              </div>
              <div className="sx-etappe">
                <div className="spur"><span className="punkt">3</span><span className="faden" /></div>
                <div className="inhalt">
                  <span className="dauer">danach</span>
                  <h3>Kontoantrag beim Partner</h3>
                  <p>Der Antrag geht vorbereitet an das Partnerinstitut — vollständig, mit sauberer Legitimation. Die Eröffnung entscheidet die Bank nach ihren eigenen Regeln. Diesen Satz lassen wir nie weg.</p>
                </div>
              </div>
              <div className="sx-etappe">
                <div className="spur"><span className="punkt">4</span></div>
                <div className="inhalt">
                  <span className="dauer">laufend</span>
                  <h3>Konto führen, Bonität aufbauen</h3>
                  <p>Mit Eingängen, pünktlichen Raten und ohne Rücklastschriften wächst die Positivhistorie. Die Karte bleibt das Ziel der nächsten Stufe — erreichbar, sobald Führung und Datenlage stimmen und die Bank zustimmt.</p>
                </div>
              </div>
            </div>
          </Auf>
        </Block>

        {/* Die Ehrlichkeits-Sektion — bewusst prominent. */}
        <Block schmal titel="Was wir nicht versprechen" lead="Dieser Abschnitt fehlt auf den meisten Seiten zu dieser Suche. Genau deshalb steht er hier.">
          <Auf>
            <Glas ruhig>
              <ul style={{ margin: 0, padding: "0 0 0 18px", display: "grid", gap: 10, fontSize: 14.5, lineHeight: 1.65, color: "#334155" }}>
                <li><b style={{ color: "#0f172a" }}>Keine garantierte Kontoeröffnung.</b> Die Entscheidung trifft die Bank. Jeder, der Ihnen ein Konto „garantiert“, hat entweder keine Bank dahinter oder verschweigt die Bedingungen.</li>
                <li><b style={{ color: "#0f172a" }}>Keine Karte als Zusage.</b> Karte und Rahmen sind Ziele der nächsten Stufe — erreichbar, aber von Führung und Bankentscheidung abhängig.</li>
                <li><b style={{ color: "#0f172a" }}>Keine Löschung berechtigter Einträge.</b> Zulässig gemeldete, richtige Einträge bleiben bis zum Fristablauf. Angreifbar ist vieles — aber eben nicht alles.</li>
                <li><b style={{ color: "#0f172a" }}>Kein „Score-Tuning“ über Nacht.</b> Bonität entsteht aus Daten und Zeit. Wer anderes verspricht, verkauft Hoffnung statt Arbeit.</li>
              </ul>
            </Glas>
          </Auf>
          <p className="dk-leise" style={{ marginTop: 16 }}>
            Woran Sie unseriöse Anbieter im Detail erkennen, steht auf{" "}
            <a href="/fiaon-erfahrungen" style={{ color: "#1d4ed8" }}>So arbeitet FIAON</a>.
          </p>
        </Block>

        {/* Vergleich Basiskonto. */}
        <Block schmal titel="Basiskonto oder FIAON-Weg?" lead="Beides hat seinen Platz — und das Basiskonto ist Ihr gesetzliches Recht, unabhängig von uns.">
          <div className="wz-tabelle-huelle">
            <table className="wz-tabelle">
              <thead><tr><th scope="col">&nbsp;</th><th scope="col">Basiskonto (§ 31 ZKG)</th><th scope="col">FIAON-Weg zum Partnerkonto</th></tr></thead>
              <tbody>
                <tr><td>Anspruch</td><td>gesetzlich — jede kontoführende Bank</td><td>kein Anspruch: die Bank entscheidet</td></tr>
                <tr><td>Basis</td><td>Guthaben, Grundfunktionen</td><td>vollwertiges Girokonto als Ziel, Karte als nächste Stufe</td></tr>
                <tr><td>Kosten</td><td>Gebühren teils überdurchschnittlich</td><td>Teil der FIAON-Pakete, transparent auf der Preisseite</td></tr>
                <tr><td>Datenlage</td><td>bleibt, wie sie ist</td><td>wird parallel geprüft und bereinigt, wo angreifbar</td></tr>
                <tr><td>Sinnvoll wenn</td><td>Sie SOFORT ein Zahlkonto brauchen</td><td>Sie Konto UND Bonitätsaufbau in einem Zug wollen</td></tr>
              </tbody>
            </table>
          </div>
          <p className="dk-leise" style={{ marginTop: 14 }}>
            Ehrlich gesagt: Beides zusammen ist kein Widerspruch. Erst das Basiskonto für den Alltag,
            parallel die Datenlage aufräumen — die Werkzeuge{" "}
            <a href="/werkzeuge/karten-check" style={{ color: "#1d4ed8" }}>Karten-Check</a> und{" "}
            <a href="/werkzeuge/selbstauskunft" style={{ color: "#1d4ed8" }}>Selbstauskunft</a> sind kostenlos.
            Wie Raten auf die Bonität wirken, steht unter{" "}
            <a href="/ratenzahlung-und-bonitaet" style={{ color: "#1d4ed8" }}>Ratenzahlung und Bonität</a>.
          </p>
        </Block>

        <Block schmal titel="Häufige Fragen zum Konto trotz SCHUFA">
          <Fragen items={FRAGEN} />
          <p className="dk-leise" style={{ marginTop: 22 }}>
            Stand August 2026. Keine Rechtsberatung im Einzelfall. FIAON ist keine Bank; Konto, Karte
            und Rahmen entstehen beim Partnerinstitut — die Entscheidung trifft die Bank.
            Mehr zur Karte: <a href="/kreditkarte" style={{ color: "#1d4ed8" }}>die FIAON-Karte</a>.
          </p>
        </Block>
      </Licht>

      <KartenAufruf
        titel="Das Konto ist der erste Baustein. Wir bereiten ihn vor."
        satz="FIAON räumt Ihre Datenlage auf und bereitet den Kontoantrag beim Partner sauber vor — ehrlich, transparent, mit jedem Schritt sichtbar in Ihrem Kundenbereich. Die Eröffnung entscheidet die Bank."
      />
    </Dunkel>
  );
}
