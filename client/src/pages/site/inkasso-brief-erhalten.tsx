// ═══════════════════════════════════════════════════════════════════════════
// /inkasso-brief-erhalten — der Pfeiler für den gestressten Moment
// (30.08.2026)
//
// Suchintention: „inkasso brief was tun“. Wer das sucht, hat den Brief in der
// Hand und Puls. Deshalb ist der Ton dieser Seite RUHIG und souverän: erst
// prüfen, dann zahlen — nummerierte Schritte, klare Fristen, keine Panik und
// keine Verharmlosung. JSON-LD: HowTo + FAQPage.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect } from "react";
import { Dunkel, Block, Licht, Knopf, Fragen, Karten, Auf } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import KartenAufruf from "@/components/site/KartenAufruf";
import "@/styles/ratgeber.css";
import "@/styles/seo-seiten.css";

const SCHRITTE = [
  { name: "Ruhe bewahren — und nichts unterschreiben", text: "Ein Inkassobrief ist eine Zahlungsaufforderung, kein Urteil und kein Vollstreckungsbescheid. Unterschreiben Sie kein Schuldanerkenntnis und keine Ratenvereinbarung, bevor die Forderung geprüft ist — beides kann Ihnen später die Einwände nehmen. Es entscheidet ohnehin kein Anruf binnen 24 Stunden über Ihr Schicksal, auch wenn der Brief so klingt." },
  { name: "Absender und Forderung prüfen", text: "Steht das Unternehmen im Rechtsdienstleistungsregister (rechtsdienstleistungsregister.de)? Stimmen Gläubiger, Vertragsnummer, Datum und Betrag — kennen Sie die Forderung überhaupt? Betrüger kopieren das Auftreten echter Inkassobüros. Ein echter Anspruch lässt sich immer einem Vertrag oder einer Bestellung zuordnen." },
  { name: "Kosten nachrechnen", text: "Inkassokosten sind gesetzlich gedeckelt (RVG-Sätze; bei unbestrittenen Forderungen bis 50 Euro höchstens 18 Euro Gebühr zuzüglich Auslagen). Fantasiegebühren, doppelte Auslagenpauschalen und „Kontoführungsgebühren“ des Inkassos müssen Sie nicht hinnehmen. Unser kostenloser Inkassokosten-Rechner zeigt die zulässige Höhe." },
  { name: "Berechtigt? Dann zahlen oder Raten vereinbaren — schriftlich", text: "Ist die Forderung echt und korrekt, ist Zahlen der schnellste Weg, Folgen zu vermeiden: Wer innerhalb von 100 Tagen nach einer Meldung ausgleicht, profitiert bei der SCHUFA von der verkürzten Löschfrist von 18 Monaten. Vereinbaren Sie Raten nur schriftlich und nur in einer Höhe, die Sie durchhalten." },
  { name: "Unberechtigt? Schriftlich widersprechen — mit Frist", text: "Bestreiten Sie die Forderung schriftlich (nachweisbar, z. B. per Einwurfeinschreiben) gegenüber Inkasso UND Gläubiger. Eine BESTRITTENE Forderung darf nicht an die SCHUFA gemeldet werden (§ 31 BDSG). Reagiert die Gegenseite mit einem gerichtlichen Mahnbescheid, widersprechen Sie binnen 14 Tagen auf dem beiliegenden Formular — danach muss der Gläubiger klagen und beweisen." },
];

const FRAGEN = [
  { f: "Muss ich auf einen Inkassobrief überhaupt reagieren?", a: "Ignorieren ist die schlechteste Option — aber reagieren heißt nicht zahlen. Reagieren heißt: prüfen, und je nach Ergebnis zahlen oder schriftlich widersprechen. Wer gar nichts tut, riskiert gerichtlichen Mahnbescheid, weitere Kosten und am Ende einen Negativeintrag." },
  { f: "Darf Inkasso einfach einen SCHUFA-Eintrag machen?", a: "Nein. § 31 BDSG verlangt unter anderem zwei Mahnungen mit mindestens vier Wochen Abstand, einen rechtzeitigen Hinweis auf die bevorstehende Meldung — und die Forderung darf nicht bestritten sein. Wer rechtzeitig und begründet widerspricht, blockiert die Meldung, bis die Sache geklärt ist." },
  { f: "Was passiert, wenn ich die Forderung wirklich nicht zahlen kann?", a: "Melden Sie sich schriftlich und schlagen Sie realistische Raten vor — Inkassobüros nehmen fast immer an, weil eine zahlende Rate mehr wert ist als ein Titel. Wichtig: nur Beträge zusagen, die Sie sicher halten können. Eine geplatzte Vereinbarung verschlechtert Ihre Position." },
  { f: "Sind die hohen Inkassogebühren rechtens?", a: "Oft nicht in voller Höhe. Die Vergütung ist gedeckelt; bei kleinen, unbestrittenen Forderungen liegt die Grenze niedrig. Verlangen Sie eine Aufschlüsselung und zahlen Sie zunächst die Hauptforderung plus die zulässigen Kosten — überhöhte Posten dürfen Sie bestreiten." },
  { f: "Woran erkenne ich Fake-Inkasso?", a: "Druck mit unrealistischen Fristen (24 bis 48 Stunden), Zahlung nur auf ausländische Konten oder per Gutscheinkarte, kein Eintrag im Rechtsdienstleistungsregister, keine nachvollziehbare Forderung. Im Zweifel: nicht zahlen, nicht anrufen, schriftlich Nachweise verlangen." },
  { f: "Ich habe schon einen Eintrag — was jetzt?", a: "Prüfen, ob er zulässig gemeldet wurde (zwei Mahnungen, Hinweis, nicht bestritten) und ob die Löschfrist läuft oder abgelaufen ist. Erledigte Forderungen werden nach drei Jahren gelöscht, bei Ausgleich binnen 100 Tagen nach 18 Monaten. FIAON prüft das für Sie — die Regeln stehen im Ratgeber zum Eintrag löschen." },
];

export default function InkassoBriefErhalten() {
  useEffect(() => {
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: "Inkasso-Brief erhalten: der 5-Schritte-Sofortplan",
      step: SCHRITTE.map((s, i) => ({ "@type": "HowToStep", position: i + 1, name: s.name, text: s.text })),
    });
    document.head.appendChild(el);
    return () => el.remove();
  }, []);

  return (
    <Dunkel seite="ratgeber" titel="Inkasso-Brief erhalten? Erst prüfen, dann zahlen" beschreibung="Inkasso-Brief erhalten: der ruhige 5-Schritte-Plan — Forderung prüfen, Kosten nachrechnen, Fristen kennen, Eintrag verhindern. Jetzt prüfen lassen.">
      <SeoDaten
        pfad="/inkasso-brief-erhalten"
        titel="Inkasso-Brief erhalten? Erst prüfen, dann zahlen | FIAON"
        beschreibung="Inkasso-Brief erhalten: der ruhige 5-Schritte-Plan — Forderung prüfen, Kosten nachrechnen, Fristen kennen, Eintrag verhindern. Jetzt prüfen lassen."
        fragen={FRAGEN}
        krumen={[{ name: "Inkasso-Brief erhalten", pfad: "/inkasso-brief-erhalten" }]}
      />

      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/akten.jpg" alt="" decoding="async" {...({ fetchpriority: "high" } as any)} /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">Ruhig bleiben · richtig reagieren</span>
          <h1 className="dk-h1">Inkasso-Brief erhalten? <span className="dk-verlauf">Erst prüfen, dann zahlen.</span></h1>
          <p className="dk-lead">
            Ein Inkassoschreiben ist kein Urteil — es ist eine Behauptung mit Briefkopf.
            Manche Forderungen sind berechtigt, viele überhöht, einige frei erfunden.
            Hier steht der ruhige Plan für die nächsten Tage, Schritt für Schritt.
          </p>
          <div className="dk-knoepfe">
            <Knopf href="/antrag">Jetzt Antrag starten</Knopf>
            <Knopf href="/kontakt" still>Kostenlos prüfen lassen</Knopf>
          </div>
        </div>
      </section>

      <Licht>
        {/* Der 5-Schritte-Sofortplan — nummeriert, mit Scroll-Reveal über Auf. */}
        <Block titel="Der 5-Schritte-Sofortplan" lead="In dieser Reihenfolge — und nichts davon am Telefon, alles schriftlich.">
          <div className="wz-fragen">
            {SCHRITTE.map((s, i) => (
              <Auf key={s.name} verzoegerung={i * 70}>
                <div className="wz-frage">
                  <p className="wz-nr">Schritt {i + 1}</p>
                  <h3>{s.name}</h3>
                  <p className="wz-hinweis">{s.text}</p>
                </div>
              </Auf>
            ))}
          </div>
          <div className="dk-knoepfe" style={{ marginTop: 26 }}>
            <Knopf href="/werkzeuge/inkassokosten">Inkassokosten nachrechnen (kostenlos)</Knopf>
            <Knopf href="/werkzeuge/verjaehrung" still>Verjährung der Forderung prüfen</Knopf>
          </div>
        </Block>

        {/* Fristen als Info-Karten. */}
        <Block titel="Diese Fristen gelten" lead="Wer die Fristen kennt, verhandelt aus einer anderen Position.">
          <Karten items={[
            { tag: "14 Tage", titel: "Widerspruch gegen den Mahnbescheid", text: "Kommt ein GERICHTLICHER Mahnbescheid (gelber Umschlag vom Amtsgericht), haben Sie zwei Wochen für den Widerspruch — das Formular liegt bei, ein Kreuz und die Unterschrift genügen. Danach muss der Gläubiger klagen und die Forderung beweisen. Diese Frist ist die einzige im Verfahren, die wirklich brennt." },
            { tag: "100 Tage", titel: "Die 100-Tage-Regel der SCHUFA", text: "Wird eine offene Forderung gemeldet und innerhalb von 100 Tagen vollständig ausgeglichen, verkürzt sich die Speicherfrist von drei Jahren auf 18 Monate — sofern sonst keine Negativmerkmale vorliegen. Wenn die Forderung berechtigt ist, ist schnelles Ausgleichen deshalb bares Geld für Ihre Bonität." },
            { tag: "3 Jahre", titel: "Regelverjährung der Forderung", text: "Die meisten Alltagsforderungen verjähren drei Jahre nach dem Ende des Jahres, in dem sie entstanden sind. Eine verjährte Forderung müssen Sie nicht mehr zahlen — Sie müssen die Verjährung aber EINREDEN, von selbst verschwindet nichts. Inkasso darf Verjährtes anschreiben; durchsetzen kann es das gegen Ihre Einrede nicht." },
          ]} />
        </Block>

        {/* Wann ein Eintrag droht. */}
        <Block schmal titel="Wann ein SCHUFA-Eintrag droht — und wann nicht" lead="Die Angst vor dem Eintrag ist das Druckmittel jedes Inkassobriefs. Die Regeln stehen in § 31 BDSG.">
          <div className="wz-tabelle-huelle">
            <table className="wz-tabelle">
              <thead><tr><th scope="col">Lage</th><th scope="col">Meldung erlaubt?</th></tr></thead>
              <tbody>
                <tr><td>Zwei Mahnungen, vier Wochen Abstand, Hinweis auf Meldung, nicht bestritten</td><td>ja — das ist der zulässige Weg</td></tr>
                <tr><td>Sie haben der Forderung begründet widersprochen</td><td>nein — bestrittene Forderungen sind tabu</td></tr>
                <tr><td>Nur eine Mahnung, kein Hinweis auf die Meldung</td><td>nein — Voraussetzungen fehlen</td></tr>
                <tr><td>Titulierte Forderung (Urteil, Vollstreckungsbescheid)</td><td>ja — unabhängig vom Bestreiten</td></tr>
                <tr><td>Forderung ist verjährt und Sie erheben die Einrede</td><td>Meldung angreifbar — prüfen lassen</td></tr>
              </tbody>
            </table>
          </div>
          <p className="dk-leise" style={{ marginTop: 14 }}>
            Steht der Eintrag schon? Dann gilt der Weg aus dem Ratgeber{" "}
            <a href="/schufa-eintrag-loeschen" style={{ color: "#1d4ed8" }}>SCHUFA-Eintrag löschen lassen</a> —
            und die Fristen aus <a href="/eintrag-verjaehrung" style={{ color: "#1d4ed8" }}>Eintrag und Verjährung</a>.
          </p>
        </Block>

        {/* Wie FIAON unterstützt. */}
        <Block schmal titel="Wie FIAON Sie dabei unterstützt" lead="FIAON ist kein Inkasso und keine Rechtsberatung — FIAON ist Ihre Gegenprüfung.">
          <div className="wz-fragen">
            <div className="wz-frage">
              <p className="wz-nr">Klarheit</p>
              <h3>Erst sehen, was gespeichert ist</h3>
              <p className="wz-hinweis">FIAON beschafft Ihre Auskünfte bei SCHUFA, KSV und CRIF. Ob die Forderung aus dem Brief dort schon gemeldet ist — und ob zulässig —, sehen Sie schwarz auf weiß, statt es zu vermuten.</p>
            </div>
            <div className="wz-frage">
              <p className="wz-nr">Prüfung</p>
              <h3>Jeden Eintrag gegen die Regeln halten</h3>
              <p className="wz-hinweis">Zwei Mahnungen? Hinweis auf die Meldung? Frist abgelaufen? Bestritten und trotzdem gemeldet? Jede Zeile wird gegen § 31 BDSG und die Löschfristen geprüft — mit Klartext-Ergebnis.</p>
            </div>
            <div className="wz-frage">
              <p className="wz-nr">Durchsetzung</p>
              <h3>Schreiben und Fristen übernehmen wir</h3>
              <p className="wz-hinweis">Für angreifbare Einträge bereitet FIAON den Schriftwechsel mit Auskunftei und meldender Stelle vor und verfolgt die Fristen. Berechtigte, zulässig gemeldete Einträge bleiben — das sagen wir vorher, nicht hinterher.</p>
            </div>
          </div>
        </Block>

        <Block schmal titel="Häufige Fragen zum Inkasso-Brief">
          <Fragen items={FRAGEN} />
          <p className="dk-leise" style={{ marginTop: 22 }}>
            Redaktionelle Einordnung nach RDG, RVG, § 31 BDSG und den Verhaltensregeln der
            Wirtschaftsauskunfteien, Stand August 2026. Keine Rechtsberatung im Einzelfall — bei
            gerichtlichen Schreiben zählt jede Frist, im Zweifel hilft die Verbraucherzentrale oder
            eine Anwältin.
          </p>
        </Block>
      </Licht>

      <KartenAufruf
        titel="Gewissheit statt Bauchgefühl."
        satz="FIAON zeigt Ihnen, was wirklich über Sie gespeichert ist, prüft jeden Eintrag gegen die gesetzlichen Regeln und führt den Schriftwechsel — Sie sehen jeden Schritt in Ihrem Kundenbereich."
      />
    </Dunkel>
  );
}
