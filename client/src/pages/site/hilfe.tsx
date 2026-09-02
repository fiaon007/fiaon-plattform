// ═══════════════════════════════════════════════════════════════════════════
// /hilfe — das Hilfe-Center (02.09.2026, E-083)
//
// Seite 2 im Zehn-Seiten-Plan; Seitenverzeichnis A4 seit 22.08. offen
// („entlastet Support"). Acht Themen, je fünf bis sieben Fragen, ein
// Suchfeld über alles (im Browser), am Ende die Kontaktwege. Die Antworten
// folgen shared/fiaon-wissen.ts (dem Wissen des Assistenten) — dieselben
// Aussagen wie am Telefon und im Assistenten, damit nie zwei Antworten
// nebeneinander stehen. Fängt „fiaon login / kündigen / zahlung"-Suchen ab.
// Jede Frage hat eine Anker-ID (#thema-n), damit Support-Mails direkt auf
// die Antwort verlinken können.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Hero, Block, Licht, Knopf, Glas, Zwischenruf } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import "@/styles/ratgeber.css";
import "@/styles/seo-seiten.css";

type Thema = { key: string; titel: string; satz: string; fragen: { f: string; a: string }[] };

const THEMEN: Thema[] = [
  { key: "antrag", titel: "Antrag und Start", satz: "Vom ersten Klick bis zum Startgespräch.", fragen: [
    { f: "Wie lange dauert der Antrag?", a: "Etwa zwei Minuten: E-Mail, Name, Geburtsdatum, Telefon, Adresse (füllt sich beim Tippen selbst aus), Beschäftigung, Einkommen, Wunschlimit. Danach nehmen Sie den Vertrag an und sind sofort in Ihrem Bereich." },
    { f: "Was passiert nach dem Antrag?", a: "Sie legen ein Passwort fest und wählen: „Jetzt aktivieren“ (Zahlungsdaten mit QR-Code) oder „Zuerst sprechen“ (Termin mit einem Mitarbeiter). Nach Zahlungseingang buchen Sie das Startgespräch – bis dahin bleibt der Bereich geschlossen." },
    { f: "Was ist das Startgespräch?", a: "Ein Telefonat von rund 15 Minuten mit einem Mitarbeiter: Lage, Ziel, Unterlagen, nächste Schritte. Es ist Pflicht, weil danach Ihre Auskunft beantragt wird. Wer vorher einen Termin über /termin gebucht hat, braucht keinen zweiten." },
    { f: "Kann ich das Paket noch ändern?", a: "Ja – im Antrag, im Startgespräch und danach jederzeit nach oben; nach unten zum nächsten Ratenlauf. Der Paketfinder auf der Preisseite gibt die erste Orientierung." },
    { f: "Ich habe den Antrag abgebrochen – was nun?", a: "Sie können jederzeit weitermachen: Der Link in der E-Mail führt zurück in den Antrag. Es entstehen keine Kosten, bis Sie den Vertrag annehmen und die erste Rate zahlen." },
  ] },
  { key: "zahlung", titel: "Zahlung und Raten", satz: "Erste Rate, SEPA, Zahlungskalender.", fragen: [
    { f: "Wie bezahle ich die erste Rate?", a: "Per Überweisung an die Zahlungsdaten im Kundenbereich (mit QR-Code zum Scannen). Sobald die Bank den Eingang bestätigt, ist Ihr Paket aktiv – „bezahlt“ heißt bei FIAON immer bankbestätigt, nicht nur gemeldet." },
    { f: "Wie laufen die weiteren Raten?", a: "Per SEPA-Lastschrift über einen verifizierten Kreditor, jeweils zum Monatsanfang. Sie erteilen das Mandat einmal im Kundenbereich. Zwei Tage vor jeder Abbuchung erinnert der Zahlungskalender." },
    { f: "Meine Zahlung ist nicht angekommen – was tun?", a: "Überweisungen brauchen ein bis zwei Bankarbeitstage. Prüfen Sie Verwendungszweck (Ihre Referenz) und Betrag. Ist die Zahlung nach drei Werktagen nicht zugeordnet, melden Sie sich mit Datum und Betrag beim Support – wir suchen sie im Bankbuch." },
    { f: "Was passiert, wenn eine Rate nicht abgebucht werden kann?", a: "Sie bekommen eine Nachricht mit einem neuen Termin; es entstehen keine Mahngebühren bei FIAON. Melden Sie sich vor dem Termin, wenn es eng wird – Ihre Ansprechpartnerin kann eine Rate verschieben." },
    { f: "Bekomme ich eine Rechnung?", a: "Ja, je Rate im Kundenbereich unter Abo & Zahlungen als PDF – mit Umsatzsteuer ausgewiesen." },
    { f: "Wird die Bonitätsauskunft angerechnet?", a: "Wer zuerst nur die Auskunft (74 Euro) bucht und innerhalb von 30 Tagen ein Paket wählt, bekommt den Betrag auf die erste Rate angerechnet – sagen Sie es im Startgespräch." },
  ] },
  { key: "auskunft", titel: "Auskunft und Einträge", satz: "Was FIAON beschafft und wie Sie es lesen.", fragen: [
    { f: "Welche Auskünfte beschafft FIAON?", a: "In Deutschland die SCHUFA (auf Wunsch auch Boniversum, CRIF), in Österreich KSV1870 und CRIF, in der Schweiz CRIF, Intrum und den Betreibungsregisterauszug – mit Ihrer digitalen Vollmacht. Sie füllen kein Formular aus." },
    { f: "Wie lange dauert es, bis die Auskunft da ist?", a: "Die Auskunfteien haben einen Monat Zeit (Art. 15 DSGVO); in der Praxis kommen Datenkopien oft nach ein bis drei Wochen. Sobald sie vorliegt, sehen Sie sie innerhalb von 24 Stunden erklärt im Kundenbereich." },
    { f: "Was bedeuten die Bewertungen an den Einträgen?", a: "Jeder Eintrag bekommt eine Einordnung: erledigt, löschbar, berichtigbar, angreifbar – oder berechtigt. Berechtigt heißt: zulässig gemeldet und noch in der Frist; daran ändert kein Schreiben etwas, und das sagen wir vorher." },
    { f: "Was ist der neue SCHUFA-Score?", a: "Seit dem 17. März 2026 rechnet die SCHUFA mit 100 bis 999 Punkten aus zwölf veröffentlichten Kriterien in fünf Klassen. Er ersetzt den Basisscore in Prozent. FIAON ordnet Ihren Score je Kriterium ein – die Tabelle steht auf der Seite SCHUFA-Score verstehen." },
    { f: "Kann ich meine Auskunft selbst kostenlos anfordern?", a: "Ja, die Datenkopie nach Art. 15 DSGVO ist bei jeder Auskunftei kostenlos. Der Selbstauskunft-Generator unter /werkzeuge/selbstauskunft schreibt den Brief. FIAON lohnt sich für die Erklärung, die Prüfung und alles danach." },
  ] },
  { key: "schreiben", titel: "Schreiben und Fristen", satz: "Löschanträge, Widersprüche, Ratenangebote.", fragen: [
    { f: "Wer schreibt die Briefe?", a: "FIAON, aus anwaltlich geprüften Vorlagen, mit Ihren Daten und dem passenden Grund (§ 31 BDSG, Art. 16/17/21 DSGVO). Sie sehen jedes Schreiben im Kundenbereich und geben es frei – nichts geht ohne Sie raus." },
    { f: "Wie werden die Schreiben versendet?", a: "Ab dem Paket Pro per Einschreiben durch FIAON; im Paket Start bereiten wir sie vor und Sie versenden selbst. Der Nachweis über den Zugang liegt in Ihrer Akte." },
    { f: "Wie lange dauert es, bis eine Auskunftei antwortet?", a: "Einen Monat nach Zugang, in Ausnahmefällen mit Mitteilung bis zu drei. FIAON verfolgt die Frist und fasst nach; bei Ablehnung ohne Grund folgt die Beschwerde bei der Datenschutzaufsicht (Art. 77 DSGVO)." },
    { f: "Was, wenn ein Gläubiger nicht reagiert?", a: "Dann geht die Aufforderung an die Auskunftei, die selbst prüfen muss – und parallel die Erinnerung mit Frist an den Gläubiger. Sie sehen jeden Schritt und jede Antwort in Ihrer Akte." },
    { f: "Ich habe einen Mahnbescheid bekommen – hilft FIAON?", a: "FIAON ist keine Rechtsberatung; die Widerspruchsfrist (zwei Wochen) müssen Sie selbst wahren – der Fristenrechner unter /werkzeuge/mahnbescheid nennt den Tag. Wir prüfen mit Ihnen Forderung, Kosten und Verjährung und formulieren Ratenangebote." },
  ] },
  { key: "konto", titel: "Konto und Karte", satz: "Girokonto, Kreditkarte, Rahmen.", fragen: [
    { f: "Bekomme ich garantiert ein Konto oder eine Karte?", a: "Nein – und wer das verspricht, arbeitet unseriös. FIAON bereitet vor: Girokonto beim Partnerinstitut für jeden Kunden, Kreditkarte, sobald Ihre Akte die Schwelle des Kartenpartners erreicht. Über die Vergabe entscheidet die Bank." },
    { f: "Was ist die Karten-Readiness?", a: "Ein Wert, den FIAON aus Einträgen, Einkommen und Kontoverhalten berechnet. Er zeigt, wie nah Sie an der Schwelle des Kartenpartners sind und welcher Schritt sie wie weit bewegt – ein Fortschrittsbalken, kein Versprechen." },
    { f: "Ich habe ein Basiskonto – reicht das?", a: "Das Basiskonto ist Ihr gesetzliches Recht und ein guter Boden: Gehaltseingänge, pünktliche Abbuchungen, kein Dauer-Dispo bauen die Kontohistorie, die Banken später lesen. Der Weg über FIAON baut darauf auf." },
    { f: "Wie hoch ist der Rahmen am Anfang?", a: "Das entscheidet der Kartenpartner anhand der Akte; typisch beginnt es klein und wächst mit pünktlicher Abrechnung. Die Zeitachse steht auf der Seite Kreditkarte trotz Eintrag – ein typischer Verlauf, kein Versprechen." },
  ] },
  { key: "kuendigung", titel: "Kündigung und Widerruf", satz: "Monatlich, formlos, ohne Grund.", fragen: [
    { f: "Wie kündige ich?", a: "Jederzeit zum Ende des laufenden Monats, formlos: im Kundenbereich unter Abo & Zahlungen mit einem Klick oder per E-Mail an support@fiaon.com. Sie bekommen eine Bestätigung; die letzte Rate ist die des laufenden Monats." },
    { f: "Gibt es ein Widerrufsrecht?", a: "Ja, 14 Tage ab Vertragsschluss, ohne Angabe von Gründen – die Widerrufsbelehrung und das Musterformular stehen auf der Seite Widerrufsbelehrung. Bereits erbrachte Leistungen (etwa eine beschaffte Auskunft) werden anteilig berechnet." },
    { f: "Was passiert mit meinen Daten nach der Kündigung?", a: "Auf Wunsch löschen wir Auskunft, Unterlagen und Akte vollständig (Art. 17 DSGVO) und bestätigen das innerhalb von 30 Tagen. Gesetzliche Aufbewahrungspflichten für Rechnungen bleiben." },
    { f: "Laufen meine Schreiben nach der Kündigung weiter?", a: "Bereits versendete Schreiben bleiben wirksam – die Auskunftei muss antworten. Die Nachverfolgung durch FIAON endet mit dem Paket; Sie erhalten alle Unterlagen als Kopie." },
  ] },
  { key: "datenschutz", titel: "Datenschutz und Sicherheit", satz: "Wo Ihre Daten liegen, wer sie sieht.", fragen: [
    { f: "Wo liegen meine Daten?", a: "Auf Servern in Frankfurt am Main (EU), verschlüsselt übertragen und gespeichert. Details und den Live-Status finden Sie unter /status und /sicherheit." },
    { f: "Wer sieht meine Akte?", a: "Ihre Ansprechpartnerin, die Betreiber – und niemand sonst. Partnerbanken sehen nur, was Sie ausdrücklich freigeben; die Einwilligung wird protokolliert und ist widerrufbar." },
    { f: "Sieht FIAON mein Online-Banking?", a: "Nein. Sie laden Kontoauszüge als Datei oder Foto hoch; die Kontoanbindung (PSD2) ist in Vorbereitung und wird nur mit Ihrer ausdrücklichen Zustimmung genutzt." },
    { f: "Wie bekomme ich eine Kopie meiner Daten bei FIAON?", a: "Im Kundenbereich unter Mein Konto oder per E-Mail – Auskunft nach Art. 15 DSGVO, kostenlos, innerhalb eines Monats." },
  ] },
  { key: "mitarbeiter", titel: "Mitarbeiter werden", satz: "Von zuhause, fest oder frei.", fragen: [
    { f: "Kann ich als Kunde für FIAON arbeiten?", a: "Ja – viele im Team waren selbst Kunden. Bewerbung in vier Schritten auf der Karriere-Seite; Florentine meldet sich persönlich innerhalb von zwei Werktagen." },
    { f: "Fest oder frei?", a: "Beides: Festanstellung oder freie Mitarbeit auf Provision, remote in Deutschland, Österreich und der Schweiz. Niemand spricht mit Kunden, bevor er die Academy bestanden hat." },
    { f: "Was verdiene ich?", a: "Das steht im Gespräch und im Vertrag – ehrlich geregelt, keine Fantasiezahlen auf der Website. Auf der Karriere-Seite steht, wie die Zusammenarbeit funktioniert." },
  ] },
];

export default function Hilfe() {
  const [suche, setSuche] = useState("");
  const [offen, setOffen] = useState<string | null>(null);
  const treffer = useMemo(() => {
    const q = suche.trim().toLowerCase();
    if (q.length < 2) return null;
    const list: { thema: string; key: string; f: string; a: string }[] = [];
    for (const t of THEMEN) t.fragen.forEach((x, i) => { if ((x.f + " " + x.a).toLowerCase().includes(q)) list.push({ thema: t.titel, key: `${t.key}-${i + 1}`, f: x.f, a: x.a }); });
    return list;
  }, [suche]);
  const alle = THEMEN.flatMap((t) => t.fragen);

  return (
    <Dunkel seite="kontakt" titel="Hilfe-Center · Antworten auf einen Blick" beschreibung="Antrag, Zahlung, Auskunft, Schreiben, Konto und Karte, Kündigung, Datenschutz, Mitarbeiter werden: Das FIAON-Hilfe-Center beantwortet die häufigsten Fragen – mit Suche.">
      <SeoDaten pfad="/hilfe" titel="Hilfe-Center: Antworten zu Antrag, Zahlung, Auskunft" beschreibung="Antrag, Zahlung, Auskunft, Schreiben, Konto und Karte, Kündigung, Datenschutz, Mitarbeiter werden: Das FIAON-Hilfe-Center beantwortet die häufigsten Fragen – mit Suche." fragen={alle.slice(0, 12)} krumen={[{ name: "Hilfe", pfad: "/hilfe" }]} />

      <Hero
        bild="/kino/cockpit.jpg"
        pille="Hilfe-Center"
        titel={<>Antworten, <span className="dk-verlauf">bevor Sie fragen müssen.</span></>}
        lead="Acht Themen, dieselben Antworten wie am Telefon und im Assistenten. Suchen Sie – oder öffnen Sie das Thema, das gerade dran ist."
        knoepfe={<><Knopf href="#suche">Suchen</Knopf><Knopf href="/kontakt" still>Ein Mensch, bitte</Knopf></>}
      />

      <Licht>
        <Block id="suche" schmal>
          <div className="wz-formular" style={{ marginTop: 0 }}>
            <label><span>Wonach suchen Sie?</span><input value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="z. B. kündigen, Rate, Vollmacht, Mahnbescheid" autoFocus /></label>
          </div>
          {treffer && (
            <div style={{ marginTop: 18 }}>
              {treffer.length === 0 ? <p className="dk-text">Kein Treffer. Fragen Sie den Assistenten auf der <a href="/kontakt" style={{ color: "#1d4ed8" }}>Kontaktseite</a> – er antwortet sofort.</p> : treffer.map((t) => (
                <div key={t.key} className="wz-schritt" style={{ marginTop: 10 }}><small>{t.thema}</small><p><b>{t.f}</b><br />{t.a}</p></div>
              ))}
            </div>
          )}
        </Block>

        {THEMEN.map((t) => (
          <Block key={t.key} id={t.key} schmal titel={t.titel} lead={t.satz}>
            <div className="wz-fragen">
              {t.fragen.map((x, i) => {
                const id = `${t.key}-${i + 1}`; const auf = offen === id;
                return (
                  <div key={id} id={id} className="wz-frage" style={{ cursor: "pointer" }} onClick={() => setOffen(auf ? null : id)}>
                    <h3 style={{ margin: 0 }}>{x.f}</h3>
                    {auf && <p className="wz-hinweis" style={{ marginTop: 10 }}>{x.a}</p>}
                  </div>
                );
              })}
            </div>
          </Block>
        ))}

        <Block schmal>
          <Glas ruhig tag="Nicht dabei?" titel="Drei Wege zu einem Menschen">
            <p className="dk-text" style={{ fontSize: 15, lineHeight: 1.7 }}>Der <a href="/kontakt" style={{ color: "#1d4ed8" }}>Assistent auf der Kontaktseite</a> antwortet sofort und kennt die Plattform im Detail. Kunden erreichen ihre Ansprechpartnerin im Kundenbereich unter Hilfe. Alle anderen: Support +41 44 244 93 01 (werktags 9–19 Uhr) oder support@fiaon.com – Antwort innerhalb eines Werktags. Dringendes landet über „Dringend melden“ direkt bei der Geschäftsführung.</p>
          </Glas>
        </Block>
      </Licht>

      <Zwischenruf text={<><b>Lieber reden als lesen?</b> 15 Minuten am Telefon, kostenlos – wählen Sie ein Zeitfenster.</>} knopf="Startgespräch buchen" href="/termin" still={{ knopf: "Kostenlose Werkzeuge", href: "/werkzeuge" }} />
    </Dunkel>
  );
}
