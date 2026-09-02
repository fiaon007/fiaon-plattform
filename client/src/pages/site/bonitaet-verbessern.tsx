// ═══════════════════════════════════════════════════════════════════════════
// /bonitaet-verbessern — der Pfeiler zu Justins Suchwort „Bonität optimieren"
// (26.08.2026)
//
// Die Seite ordnet die Hebel nach WIRKUNG, nicht nach Beliebtheit: Was in
// Wochen wirkt, was Monate braucht, was gar nichts bringt (und trotzdem
// überall empfohlen wird). Der Neunzig-Tage-Plan ist das teilbare Stück —
// und jede Etappe verlinkt das Werkzeug, das sie vorbereitet.
// ═══════════════════════════════════════════════════════════════════════════
import { Dunkel, Block, Licht, Knopf, Zwischenruf, Fragen, Karten, Schritte } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import "@/styles/ratgeber.css";
import "@/styles/seo-seiten.css";

const FRAGEN = [
  { f: "Wie schnell kann ich meine Bonität verbessern?", a: "Das hängt vom Hebel ab: Ein gelöschter Negativeintrag oder ein ausgeglichener Dispo wirkt innerhalb weniger Wochen bis Monate, sobald die Auskunftei neu rechnet. Eine Historie aus pünktlichen Zahlungen und langen, stabilen Vertragsbeziehungen wächst über Jahre. Realistisch ist: erste messbare Verbesserung in drei Monaten, deutliche in zwölf." },
  { f: "Was schadet dem Score am meisten?", a: "In dieser Reihenfolge: harte Negativmerkmale (Vollstreckung, Insolvenz), gemeldete Zahlungsausfälle, viele Kreditanfragen in kurzer Zeit, viele parallele Kredite und Konten, häufige Kontowechsel. Wohnort und Einkommen fließen bei SCHUFA übrigens nicht ein — das Einkommen kennt sie gar nicht." },
  { f: "Hilft es, alte Konten und Karten zu kündigen?", a: "Meist nein — eher das Gegenteil: Lange bestehende, unauffällig geführte Verträge sind ein Positivmerkmal. Kündigen Sie ungenutzte ZWEITE Kreditkarten und Zweitkonten, aber behalten Sie die älteste Bankbeziehung. Viele kurzlebige Verträge lesen die Scores als Unruhe." },
  { f: "Bringen „Score-Verbesserer“-Apps etwas?", a: "Den messbaren Kern können Sie selbst: Datenkopie ziehen, Fehler berichtigen lassen, Fristen prüfen. Apps, die dafür ein Abo verlangen oder „Geheimtricks“ versprechen, verkaufen verpacktes Standardwissen. Vorsicht bei allem, was eine Garantie verspricht — den Score berechnet die Auskunftei, niemand sonst." },
  { f: "Wie oft wird der Score neu berechnet?", a: "Der neue SCHUFA-Score (seit März 2026, 100 bis 999 Punkte) wird bei jeder Anfrage tagesaktuell aus den gespeicherten Daten berechnet. Eine Löschung oder Berichtigung wirkt deshalb, sobald die Auskunftei die Daten geändert hat – eine erledigte Zahlungsstörung zählt nach den veröffentlichten Kriterien allerdings bis zu drei Jahre abgeschwächt nach." },
  { f: "Was hat mein Girokonto mit meiner Bonität zu tun?", a: "Bei der Auskunftei: nur die Existenz des Vertrags. Bei der Bank selbst: sehr viel — die Kontoführung ist Teil jeder Kreditprüfung. Ein dauerhaft genutzter Dispo, Rücklastschriften und geplatzte Daueraufträge stehen dort sichtbar. Kontoauszüge der letzten drei Monate entscheiden häufiger über Kredite als der Score." },
];

export default function BonitaetVerbessern() {
  return (
    <Dunkel seite="ratgeber" titel="Bonität verbessern · Die Hebel nach Wirkung geordnet" beschreibung="Bonität verbessern: Welche Maßnahmen wirklich wirken, welche Monate brauchen und welche gar nichts bringen – mit 90-Tage-Plan, kostenlosen Werkzeugen und den Regeln hinter SCHUFA-, KSV- und CRIF-Scores.">
      <SeoDaten
        pfad="/bonitaet-verbessern"
        titel="Bonität verbessern · Die Hebel nach Wirkung geordnet"
        beschreibung="Welche Maßnahmen wirklich wirken, welche Monate brauchen und welche gar nichts bringen – mit 90-Tage-Plan und kostenlosen Werkzeugen."
        fragen={FRAGEN}
        artikel={{ ueberschrift: "Bonität verbessern: Die Hebel nach Wirkung geordnet", stand: "2026-08-26" }}
        krumen={[{ name: "Bonität verbessern", pfad: "/bonitaet-verbessern" }]}
      />
      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/cockpit.jpg" alt="" decoding="async" {...({ fetchpriority: "high" } as any)} /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">Nach Wirkung geordnet · nicht nach Beliebtheit</span>
          <h1 className="dk-h1">Bonität verbessern — <span className="dk-verlauf">was wirklich wirkt.</span></h1>
          <p className="dk-lead">Die meisten Ratschläge zum Score sind Folklore. Hier stehen die Hebel in der Reihenfolge ihrer Wirkung — mit ehrlicher Angabe, wie lange jeder braucht.</p>
        </div>
      </section>
      <Licht>
        <Block titel="Die großen Hebel" lead="Wirkung in Wochen bis Monaten — hier beginnt jede ernsthafte Verbesserung.">
          <Karten items={[
            { tag: "Hebel 1", titel: "Angreifbare Einträge entfernen", text: "Negativeinträge sind das schwerste Einzelmerkmal. Ein erheblicher Teil ist angreifbar: ohne die Voraussetzungen des § 31 BDSG gemeldet, verfristet oder falsch. Datenkopie ziehen, jeden Eintrag prüfen, Löschung verlangen — kein anderer Hebel bewegt den Score so stark." },
            { tag: "Hebel 2", titel: "Dispo ausgleichen, Rücklastschriften stoppen", text: "Für die Bank ist der Kontoauszug die Wahrheit: Ein Dauer-Dispo und geplatzte Lastschriften kosten mehr Kreditwürdigkeit als mancher alte Eintrag. Wenn der Dispo nicht aus eigener Kraft verschwindet: Der Umschuldungsrechner zeigt, ob ein Ratenkredit ihn günstiger ablöst." },
            { tag: "Hebel 3", titel: "Anfragen richtig stellen", text: "Jede Kreditanfrage in kurzer Folge drückt. Vergleichen Sie ausschließlich mit Konditionsanfragen — sie sind score-neutral und liefern dieselben Zahlen. Ein einziges Wort im Antrag entscheidet." },
          ]} />
        </Block>

        <Block titel="Die stillen Hebel" lead="Wirkung über Monate — unspektakulär, aber sie tragen die Historie.">
          <Karten items={[
            { tag: "Ausdauer", titel: "Alles pünktlich, ohne Ausnahme", text: "Raten, Handyrechnung, Versandhändler: Jede pünktliche Zahlung baut Historie, jeder gemeldete Ausfall reißt sie ein. Daueraufträge und Lastschriften mit Puffer am Monatsanfang sind der einfachste Schutz." },
            { tag: "Ruhe", titel: "Wenige, alte, stabile Verträge", text: "Die älteste Bankverbindung behalten, ungenutzte Zweitkarten und -konten schließen, nicht jährlich das Konto wechseln. Scores lesen Beständigkeit als Sicherheit." },
            { tag: "Kontrolle", titel: "Einmal im Jahr die Datenkopie", text: "Kostenlos nach Art. 15 DSGVO. Fehler fallen nur auf, wenn jemand hinsieht — und je früher, desto leichter die Berichtigung. Der Generator erzeugt das Schreiben in zwei Minuten." },
          ]} />
        </Block>

        <Zwischenruf text={<><b>Wo stehen Sie gerade?</b> Der Schulden-Check rechnet Quote und Spielraum in einer Minute — ehrlich, kostenlos, ohne Anmeldung.</>} knopf="Zum Schulden-Check" href="/werkzeuge/schulden-check" />

        <Block titel="Der 90-Tage-Plan" lead="Drei Etappen, jede mit dem Werkzeug, das sie vorbereitet.">
          <Schritte items={[
            { titel: "Tage 1–14: Wissen", text: "Datenkopien bei SCHUFA, KSV und CRIF anfordern (Werkzeug: Datenkopie-Generator). Kontoauszüge der letzten drei Monate durchsehen: Dispo, Rücklastschriften, vergessene Abos." },
            { titel: "Tage 15–45: Aufräumen", text: "Jeden Eintrag prüfen (Werkzeug: Eintrag-Prüfer, Löschfrist-Rechner). Löschung und Berichtigung schriftlich verlangen, Fristen notieren. Dispo-Ablösung durchrechnen (Werkzeug: Umschuldungsrechner)." },
            { titel: "Tage 46–90: Festigen", text: "Zahlungen auf Dauerauftrag umstellen, Zweitkonten schließen, Antworten der Auskunfteien nachhalten. Wer bis hier durchhält, geht mit einer messbar anderen Auskunft in die nächste Kreditprüfung." },
          ]} />
          <div className="dk-knoepfe" style={{ marginTop: 26 }}>
            <Knopf href="/werkzeuge">Alle zehn Werkzeuge ansehen</Knopf>
            <Knopf href="/antrag" still>Den Plan machen lassen</Knopf>
          </div>
        </Block>

        <Block schmal titel="Häufige Fragen zur Bonität">
          <Fragen items={FRAGEN} />
          <p className="dk-leise" style={{ marginTop: 22 }}>
            Redaktionelle Einordnung nach den veröffentlichten Score-Grundsätzen der Auskunfteien und der Kreditpraxis,
            Stand August 2026. Scores berechnen ausschließlich die Auskunfteien; niemand kann eine bestimmte
            Verbesserung garantieren — auch FIAON nicht.
          </p>
        </Block>

        {/* Weiterlesen (30.08.2026): die Themenseiten, die hier anschliessen. */}
        <Block schmal titel="Zum Weiterlesen">
          <div className="sx-vertiefen">
            <a href="/schufa-score-verstehen"><b>SCHUFA-Score verstehen</b><span>Die Tabelle der Score-Bereiche und die sechs Hebel dahinter.</span></a>
            <a href="/ratenzahlung-und-bonitaet"><b>Ratenzahlung & Bonität</b><span>Warum pünktliche Raten Ihr stärkster Hebel sind — und was bei Rückstand passiert.</span></a>
            <a href="/schufa-neutral-anfragen"><b>SCHUFA-neutral anfragen</b><span>Kredite vergleichen, ohne den Score zu belasten: Konditions- statt Kreditanfrage.</span></a>
            <a href="/girokonto-trotz-negativer-bonitaet"><b>Girokonto trotz negativer Bonität</b><span>Was wirklich erreichbar ist — und was niemand versprechen kann.</span></a>
          </div>
        </Block>
      </Licht>
      <Zwischenruf text={<><b>90 Tage sind schneller vorbei, als man denkt.</b> FIAON übernimmt Beschaffung, Prüfung und Schriftwechsel — Sie sehen jeden Schritt und jede Frist in Ihrem Kundenbereich.</>} knopf="Bonität ordnen lassen" href="/antrag" />
    </Dunkel>
  );
}
