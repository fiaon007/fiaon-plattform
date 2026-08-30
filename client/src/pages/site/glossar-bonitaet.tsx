// ═══════════════════════════════════════════════════════════════════════════
// /glossar-bonitaet — das Glossar als interner Link-Hub (30.08.2026)
//
// Suchintention: „bonität begriffe erklärt“. Jeder Begriff: zwei bis vier
// Sätze Klartext plus der Verweis auf die Themenseite, die in die Tiefe geht
// — genau DAS macht die Seite zum SEO-Verteiler: Sie sammelt Long-Tail-
// Suchen und verteilt die Leser (und die Linkkraft) auf die Pfeiler.
// Suchfeld filtert im Client, Sprunganker je Buchstabe, Akkordeon je
// Begriff. JSON-LD: DefinedTermSet.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";
import { Dunkel, Block, Licht, Knopf } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import KartenAufruf from "@/components/site/KartenAufruf";
import "@/styles/ratgeber.css";
import "@/styles/seo-seiten.css";

interface Begriff { wort: string; text: string; link?: { href: string; label: string } }

const BEGRIFFE: Begriff[] = [
  { wort: "Anfrage (Kredit / Konditionen)", text: "Jede Bonitätsprüfung einer Bank hinterlässt eine Anfrage in Ihrer Auskunft. Entscheidend ist die Art: Die Kreditanfrage ist zehn Tage für andere Banken sichtbar und fließt in den Score ein, die Konditionsanfrage bleibt neutral. Beim Vergleichen immer die neutrale Art verlangen.", link: { href: "/schufa-neutral-anfragen", label: "SCHUFA-neutral anfragen" } },
  { wort: "Auskunftei", text: "Ein Unternehmen, das bonitätsrelevante Daten sammelt und an Vertragspartner weitergibt: in Deutschland vor allem die SCHUFA, in Österreich der KSV, in der Schweiz die CRIF. Auskunfteien entscheiden nichts — sie liefern die Datenlage, auf der andere entscheiden.", link: { href: "/auskunfteien", label: "die Auskunfteien im Überblick" } },
  { wort: "Basiskonto", text: "Das Jedermann-Konto nach § 31 ZKG: Jede kontoführende Bank in Deutschland muss es auf Antrag eröffnen, auf Guthabenbasis und mit Grundfunktionen — unabhängig von der Bonität. Es ist das gesetzliche Sicherheitsnetz, wenn sonst kein Konto zustande kommt.", link: { href: "/girokonto-trotz-negativer-bonitaet", label: "Girokonto trotz negativer Bonität" } },
  { wort: "Basisscore", text: "Der Prozentwert (0 bis 100), den die SCHUFA vierteljährlich über Sie berechnet — die Schätzung, wie wahrscheinlich Sie Verpflichtungen erfüllen. 100 erreicht niemand; entscheidend ist der Bereich, in dem Ihr Wert liegt.", link: { href: "/schufa-score-verstehen", label: "SCHUFA-Score verstehen" } },
  { wort: "Bestrittene Forderung", text: "Eine Forderung, der Sie begründet widersprochen haben. Sie darf nicht an Auskunfteien gemeldet werden (§ 31 BDSG) — der rechtzeitige, schriftliche Widerspruch ist deshalb Ihr stärkstes Werkzeug gegen drohende Einträge.", link: { href: "/inkasso-brief-erhalten", label: "Inkasso-Brief erhalten" } },
  { wort: "Bonität", text: "Die Einschätzung, ob jemand seine Zahlungsverpflichtungen erfüllen kann und will. Sie speist sich aus Datenlage (Einträge, Historie) und Verhalten (pünktliche Zahlungen) — und sie ist veränderbar: Daten lassen sich bereinigen, Verhalten dokumentieren.", link: { href: "/bonitaet-verbessern", label: "Bonität verbessern" } },
  { wort: "Bonitätsauskunft", text: "Der Blick in die eigene Datenlage. Als Datenkopie nach Art. 15 DSGVO kostenlos; als geprüfte FIAON-Auskunft mit Beschaffung bei drei Häusern, Klartext-Erklärung und Prüfung jedes Eintrags für einmalig 74 Euro.", link: { href: "/bonitaetsauskunft-beantragen", label: "Bonitätsauskunft beantragen" } },
  { wort: "Branchenscore", text: "Neben dem Basisscore berechnet die SCHUFA je Branche eigene Werte — Banken, Telekommunikation, Handel sehen unterschiedliche Scores. Sie entstehen tagesaktuell im Moment der Anfrage, deshalb kann eine Löschung schneller wirken als der vierteljährliche Basisscore vermuten lässt.", link: { href: "/schufa-score-verstehen", label: "SCHUFA-Score verstehen" } },
  { wort: "CRIF", text: "Die führende Wirtschaftsauskunftei der Schweiz. Für Auskunft und Berichtigung gilt dort das revidierte Datenschutzgesetz (DSG) — die Rechte sind mit der DSGVO vergleichbar, die Abläufe unterscheiden sich im Detail.", link: { href: "/schweiz", label: "FIAON in der Schweiz" } },
  { wort: "Datenkopie (Art. 15 DSGVO)", text: "Ihr gesetzliches Recht auf eine vollständige, kostenlose Kopie aller Daten, die eine Auskunftei über Sie speichert — samt Meldedatum und meldender Stelle. Die Grundlage jeder ernsthaften Prüfung; die Bezahlprodukte zeigen nicht mehr.", link: { href: "/werkzeuge/selbstauskunft", label: "Selbstauskunft anfordern (kostenlos)" } },
  { wort: "Eigenauskunft", text: "Der umgangssprachliche Sammelbegriff für den Blick in die eigenen Auskunftei-Daten. Sie ist neutral: Sie verändert den Score nicht und ist für niemanden außer Ihnen sichtbar — beliebig oft möglich.", link: { href: "/selbstauskunft-checkliste", label: "Selbstauskunft richtig lesen" } },
  { wort: "Erledigungsvermerk", text: "Das Kennzeichen, dass eine gemeldete Forderung bezahlt wurde — mit Datum. Erst dieses Datum startet die Löschfrist (drei Jahre). Fehlt der Vermerk trotz Zahlung, ist das ein Berichtigungsfall mit Beleg.", link: { href: "/selbstauskunft-checkliste", label: "die 10-Punkte-Checkliste" } },
  { wort: "Geoscoring", text: "Die Bewertung anhand des Wohnorts. Sie darf nur eine Rolle spielen, wenn sonst kaum Daten vorliegen — und nie das einzige Kriterium sein. Wer eine Ablehnung „wegen der Adresse“ vermutet, sollte die eigene Datenlage prüfen: Meist liegt es an etwas anderem.", link: { href: "/schufa-score-verstehen", label: "was den Score wirklich bewegt" } },
  { wort: "Girokonto (Vertragsdaten)", text: "Konten und Karten stehen als Vertragsdaten in der Auskunft — nicht als Werturteil, sondern als Bestandsmeldung. Mit der Kündigung müssen sie ausgetragen werden; ein „aktives“ Konto von 2022 in der Auskunft von heute ist ein Berichtigungsfall.", link: { href: "/girokonto-trotz-negativer-bonitaet", label: "Konto und Bonität" } },
  { wort: "Hundert-Tage-Regel", text: "Seit 2024: Wird eine gemeldete Forderung innerhalb von 100 Tagen vollständig bezahlt und liegen sonst keine Negativmerkmale vor, verkürzt sich die Speicherfrist von drei Jahren auf 18 Monate. Schnelles Ausgleichen ist damit bares Geld für die Bonität.", link: { href: "/eintrag-verjaehrung", label: "alle Fristen im Überblick" } },
  { wort: "Inkasso", text: "Der gewerbliche Forderungseinzug im Auftrag eines Gläubigers. Ein Inkassobrief ist eine Behauptung mit Briefkopf — manche berechtigt, viele überhöht, einige erfunden. Erst prüfen (Register, Forderung, Kosten), dann zahlen oder widersprechen.", link: { href: "/inkasso-brief-erhalten", label: "der 5-Schritte-Plan" } },
  { wort: "Konditionsanfrage", text: "Die SCHUFA-neutrale Anfrageart: Die Bank prüft dieselben Daten und nennt echte Konditionen, aber die Anfrage bleibt für andere unsichtbar und scorefrei. Das richtige Werkzeug zum Kreditvergleich — ausdrücklich verlangen.", link: { href: "/schufa-neutral-anfragen", label: "so fragen Sie richtig an" } },
  { wort: "Kreditanfrage", text: "Die echte Antragsart: zwölf Monate gespeichert, zehn Tage für andere Banken sichtbar, fließt in den Score ein. Gehört an den Vertrag, den Sie wirklich abschließen — nicht an den Vergleich davor.", link: { href: "/schufa-neutral-anfragen", label: "Kredit- gegen Konditionsanfrage" } },
  { wort: "KSV (Kreditschutzverband)", text: "Österreichs große Wirtschaftsauskunftei (KSV1870). Die DSGVO gilt in Österreich unmittelbar — Datenkopie, Berichtigung und Löschung funktionieren nach denselben Artikeln wie in Deutschland.", link: { href: "/oesterreich", label: "FIAON in Österreich" } },
  { wort: "Löschfrist", text: "Die Zeitspanne, nach der ein Eintrag aus der Auskunft verschwinden muss: drei Jahre ab Erledigung, 18 Monate bei der 100-Tage-Regel, sechs Monate nach Restschuldbefreiung, zwölf Monate für Anfragen. Taggenau gerechnet — und erstaunlich oft überschritten.", link: { href: "/eintrag-verjaehrung", label: "Fristen-Checker und Tabelle" } },
  { wort: "Löschung (Art. 17 DSGVO)", text: "Ihr Anspruch auf Entfernung unzulässiger, falscher oder verfristeter Daten. Kein Gnadenakt der Auskunftei, sondern ein Recht — schriftlich geltend machen, mit Begründung und Frist, an Auskunftei und meldende Stelle.", link: { href: "/schufa-eintrag-loeschen", label: "SCHUFA-Eintrag löschen lassen" } },
  { wort: "Mahnbescheid", text: "Das gerichtliche Mahnverfahren (gelber Umschlag): Das Gericht prüft die Forderung NICHT inhaltlich. Gegen einen Mahnbescheid haben Sie 14 Tage für den Widerspruch — das Formular liegt bei. Verstreichen lassen führt zum Vollstreckungsbescheid.", link: { href: "/inkasso-brief-erhalten", label: "Fristen im Inkasso-Fall" } },
  { wort: "Meldung (§ 31 BDSG)", text: "Eine offene Forderung darf nur unter Voraussetzungen an Auskunfteien gemeldet werden: zwei Mahnungen mit mindestens vier Wochen Abstand, rechtzeitiger Hinweis auf die Meldung, Forderung nicht bestritten. Fehlt eine, ist der Eintrag angreifbar.", link: { href: "/schufa-eintrag-loeschen", label: "welche Einträge angreifbar sind" } },
  { wort: "Negativmerkmal", text: "Ein Eintrag über nicht vertragsgemäßes Verhalten: gemeldete offene Forderungen, Titel, Insolvenz. Negativmerkmale sind das schwerste Einzelgewicht im Score — und der erste Prüfpunkt jeder Auskunft: Sind sie zulässig, richtig und in der Frist?", link: { href: "/schufa-eintrag-loeschen", label: "Negativeinträge prüfen" } },
  { wort: "Ombudsmann", text: "Die kostenlose Schlichtungsstelle der SCHUFA für Streitfälle zwischen Verbrauchern und Auskunftei. Der Weg dorthin steht offen, wenn Widerspruch und Löschverlangen ins Leere laufen — parallel bleibt die Datenschutz-Aufsichtsbehörde.", link: { href: "/schufa-eintrag-loeschen", label: "der Weg bei Weigerung" } },
  { wort: "Positivmerkmal", text: "Daten über vertragsgemäßes Verhalten: das lang geführte Konto, der bediente Kredit, die saubere Zahlungsreihe. Positivmerkmale entstehen nicht über Nacht — aber verlässlich, aus Zeit und Pünktlichkeit.", link: { href: "/ratenzahlung-und-bonitaet", label: "Raten als stärkster Hebel" } },
  { wort: "Ratenzahlung", text: "Die Königsdisziplin der Bonität: Jede pünktliche Rate ist ein Positivdatum, jede geplatzte startet die Eskalationstreppe Richtung Eintrag. Ein Abbuchungstag, ein Puffer, eine Erinnerung — mehr braucht es meist nicht.", link: { href: "/ratenzahlung-und-bonitaet", label: "Ratenzahlung und Bonität" } },
  { wort: "Restschuldbefreiung", text: "Der Schlusspunkt der Privatinsolvenz: Die restlichen Schulden erlöschen. Der Eintrag darüber wird seit 2023 schon nach sechs Monaten gelöscht — steht er länger, ist das ein klarer Löschfall.", link: { href: "/eintrag-verjaehrung", label: "Fristen nach Eintragsart" } },
  { wort: "Rücklastschrift", text: "Eine geplatzte Abbuchung. Sie wird nicht automatisch gemeldet, kostet aber Gebühren und Vertrauen beim Vertragspartner — und gehäufte Rückgaben führen zu Kündigungen, die dann sehr wohl in der Auskunft landen.", link: { href: "/ratenzahlung-und-bonitaet", label: "Rückstände vermeiden" } },
  { wort: "SCHUFA", text: "Die größte deutsche Wirtschaftsauskunftei: Daten zu rund 68 Millionen Menschen, gespeist von Banken, Händlern und Telekommunikationsanbietern. Die SCHUFA entscheidet keine Anträge — sie liefert Daten und Scores an ihre Vertragspartner.", link: { href: "/auskunfteien", label: "SCHUFA, KSV und CRIF" } },
  { wort: "Score", text: "Die statistische Schätzung Ihrer Zahlungswahrscheinlichkeit, als Zahl. Die Formel ist Geschäftsgeheimnis, die Merkmale dahinter sind bekannt: Zahlungshistorie, Negativmerkmale, Anfragen, Kontenlandschaft, Historie-Alter.", link: { href: "/schufa-score-verstehen", label: "Score-Tabelle und Hebel" } },
  { wort: "Selbstauskunft", text: "Siehe Datenkopie und Eigenauskunft: der eigene, kostenlose Blick in die gespeicherten Daten. Wie man sie liest — Stammdaten, Kennzeichen, Fristen, Doppelmeldungen — steht in der Checkliste.", link: { href: "/selbstauskunft-checkliste", label: "die 10-Punkte-Checkliste" } },
  { wort: "Speicherfrist", text: "Die Zeit, die ein Eintrag stehen darf — nicht zu verwechseln mit der Verjährung der Forderung. Eine bezahlte Forderung bleibt trotz Zahlung bis zu drei Jahre sichtbar; eine verjährte kann noch eingetragen sein. Zwei Uhren, zwei Regeln.", link: { href: "/eintrag-verjaehrung", label: "Speicherfrist gegen Verjährung" } },
  { wort: "Titulierte Forderung", text: "Eine Forderung mit gerichtlichem Titel (Urteil, Vollstreckungsbescheid): 30 Jahre vollstreckbar und meldefähig unabhängig vom Bestreiten. Der Grund, warum man den Widerspruch gegen den Mahnbescheid nie verstreichen lässt.", link: { href: "/inkasso-brief-erhalten", label: "bevor es zum Titel kommt" } },
  { wort: "Verjährung", text: "Das Ende der Durchsetzbarkeit einer Forderung — bei Alltagsforderungen meist drei Jahre zum Jahresende. Verjährtes müssen Sie nicht zahlen, aber Sie müssen sich AUF die Verjährung BERUFEN; von selbst passiert nichts.", link: { href: "/werkzeuge/verjaehrung", label: "Verjährung kostenlos prüfen" } },
  { wort: "Vollstreckungsbescheid", text: "Die zweite Stufe nach dem Mahnbescheid: Aus der Behauptung wird ein vollstreckbarer Titel — pfändbar, 30 Jahre gültig. Auch hier gilt eine 14-Tage-Frist für den Einspruch; danach wird es aufwendig.", link: { href: "/inkasso-brief-erhalten", label: "die Fristen im Verfahren" } },
  { wort: "Widerspruch", text: "Ihr förmliches Nein — gegen eine Forderung (an Gläubiger und Inkasso), gegen einen Mahnbescheid (ans Gericht, 14 Tage) oder gegen einen Eintrag (an die Auskunftei). Immer schriftlich, immer nachweisbar, immer mit Begründung.", link: { href: "/inkasso-brief-erhalten", label: "richtig widersprechen" } },
  { wort: "Zahlungshistorie", text: "Die Chronik Ihres Zahlungsverhaltens — das Gedächtnis der Bonität. Sie lässt sich nicht kaufen und nicht faken, nur aufbauen: mit pünktlichen Raten, geführten Konten und der Zeit, die beides braucht.", link: { href: "/ratenzahlung-und-bonitaet", label: "Historie aufbauen" } },
];

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function GlossarBonitaet() {
  const [filter, setFilter] = useState("");

  useEffect(() => {
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "DefinedTermSet",
      name: "FIAON Bonitäts-Glossar",
      url: "https://fiaon.com/glossar-bonitaet",
      hasDefinedTerm: BEGRIFFE.map((b) => ({
        "@type": "DefinedTerm", name: b.wort, description: b.text,
        inDefinedTermSet: "https://fiaon.com/glossar-bonitaet",
      })),
    });
    document.head.appendChild(el);
    return () => el.remove();
  }, []);

  const sichtbar = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return BEGRIFFE;
    return BEGRIFFE.filter((b) => b.wort.toLowerCase().includes(f) || b.text.toLowerCase().includes(f));
  }, [filter]);

  const gruppen = useMemo(() => {
    const karte = new Map<string, Begriff[]>();
    for (const b of sichtbar) {
      const buchstabe = b.wort[0].toUpperCase();
      if (!karte.has(buchstabe)) karte.set(buchstabe, []);
      karte.get(buchstabe)!.push(b);
    }
    return karte;
  }, [sichtbar]);

  return (
    <Dunkel seite="ratgeber" titel="Bonitäts-Glossar: alle Begriffe erklärt" beschreibung="Von Anfrage bis Zahlungshistorie: das Bonitäts-Glossar erklärt jeden Begriff in Klartext — mit dem Weg zur passenden Themenseite. Jetzt nachschlagen.">
      <SeoDaten
        pfad="/glossar-bonitaet"
        titel="Bonitäts-Glossar: alle Begriffe erklärt | FIAON"
        beschreibung="Von Anfrage bis Zahlungshistorie: das Bonitäts-Glossar erklärt jeden Begriff in Klartext — mit dem Weg zur passenden Themenseite. Jetzt nachschlagen."
        krumen={[{ name: "Bonitäts-Glossar", pfad: "/glossar-bonitaet" }]}
      />

      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/akten.jpg" alt="" decoding="async" {...({ fetchpriority: "high" } as any)} /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">Nachschlagen · Verstehen · Vertiefen</span>
          <h1 className="dk-h1">Das Bonitäts-Glossar: <span className="dk-verlauf">alle Begriffe erklärt.</span></h1>
          <p className="dk-lead">
            {BEGRIFFE.length} Begriffe von A wie Anfrage bis Z wie Zahlungshistorie — jeder in zwei
            bis vier Sätzen Klartext, jeder mit dem Weg zur Seite, die in die Tiefe geht.
          </p>
          <div className="dk-knoepfe">
            <Knopf href="/antrag">Jetzt Antrag starten</Knopf>
            <Knopf href="/kontakt" still>Kostenlos prüfen lassen</Knopf>
          </div>
        </div>
      </section>

      <Licht>
        <Block schmal>
          <div className="sx-glossar-suche">
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={`${BEGRIFFE.length} Begriffe durchsuchen …`}
              aria-label="Glossar durchsuchen"
              data-fiaon="glossar-suche"
            />
          </div>
          <nav className="sx-anker" aria-label="Sprungmarken nach Anfangsbuchstaben">
            {ALPHABET.map((b) => (
              <a key={b} href={`#glossar-${b}`} className={gruppen.has(b) ? "" : "leer"}
                 aria-disabled={!gruppen.has(b)}>{b}</a>
            ))}
          </nav>

          {sichtbar.length === 0 && (
            <p style={{ marginTop: 30, fontSize: 14.5, color: "#475569" }}>
              Kein Begriff passt zu „{filter}“. Vielleicht hilft die Suche nach einem Wortteil —
              oder die Antwort steht schon auf einer Themenseite wie{" "}
              <a href="/schufa-score-verstehen" style={{ color: "#1d4ed8" }}>SCHUFA-Score verstehen</a>.
            </p>
          )}

          {Array.from(gruppen.entries()).map(([buchstabe, eintraege]) => (
            <div key={buchstabe}>
              <h2 className="sx-buchstabe" id={`glossar-${buchstabe}`}>{buchstabe}</h2>
              {eintraege.map((b) => (
                <details className="sx-begriff" key={b.wort}>
                  <summary>
                    {b.wort}
                    <span className="plus" aria-hidden="true">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                    </span>
                  </summary>
                  <div className="text">
                    {b.text}
                    {b.link && <> Vertiefung: <a href={b.link.href}>{b.link.label}</a>.</>}
                  </div>
                </details>
              ))}
            </div>
          ))}

          <p className="dk-leise" style={{ marginTop: 34 }}>
            Redaktionell gepflegt, Stand August 2026 — keine Rechtsberatung im Einzelfall.
            Für den Einstieg: <a href="/schufa-score-verstehen" style={{ color: "#1d4ed8" }}>SCHUFA-Score verstehen</a> ·{" "}
            <a href="/bonitaetsauskunft-beantragen" style={{ color: "#1d4ed8" }}>Bonitätsauskunft beantragen</a> ·{" "}
            <a href="/ratgeber" style={{ color: "#1d4ed8" }}>alle Ratgeber</a>.
          </p>
        </Block>
      </Licht>

      <KartenAufruf
        titel="Verstanden? Dann jetzt die eigene Lage klären."
        satz="FIAON beschafft Ihre Auskünfte bei SCHUFA, KSV und CRIF, erklärt jede Zeile in dem Klartext, den Sie hier gelesen haben — und greift an, was angreifbar ist."
      />
    </Dunkel>
  );
}
