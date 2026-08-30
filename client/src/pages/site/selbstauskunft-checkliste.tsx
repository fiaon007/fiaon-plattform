// ═══════════════════════════════════════════════════════════════════════════
// /selbstauskunft-checkliste — der Pfeiler zum Lese-Suchwort (30.08.2026)
//
// Suchintention: „selbstauskunft lesen / verstehen“. Wer hier landet, hat die
// Datenkopie vor sich und ein Fragezeichen im Kopf. Kern der Seite ist die
// interaktive 10-Punkte-Checkliste (Stand bleibt im localStorage — wer
// morgen weiterliest, findet seine Haken wieder) und ein annotierter
// Muster-Ausschnitt aus CSS statt Bild: keine Ladezeit, kein veralteter
// Screenshot, echte Alt-Texte. JSON-LD: HowTo + FAQPage.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Fragen, Karten } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import KartenAufruf from "@/components/site/KartenAufruf";
import "@/styles/ratgeber.css";
import "@/styles/seo-seiten.css";

const SPEICHER = "fiaon_selbstauskunft_checkliste";

const PUNKTE: Array<{ titel: string; text: string }> = [
  { titel: "Persönliche Daten stimmen", text: "Name, Geburtsdatum, aktuelle und frühere Anschriften: Jeder Dreher kann zu Verwechslungen führen — im schlimmsten Fall tragen Sie die Einträge eines Namensvetters. Falsche Stammdaten sind ein Berichtigungsfall nach Art. 16 DSGVO." },
  { titel: "Jeden Vertrag zuordnen können", text: "Girokonten, Karten, Handyverträge, Kredite: Zu jedem Eintrag muss Ihnen ein echter Vertrag einfallen. Was Sie nicht zuordnen können, wird markiert und hinterfragt — unbekannte Konten können auf Identitätsmissbrauch hindeuten." },
  { titel: "Beendete Verträge sind ausgetragen", text: "Gekündigte Konten und Karten müssen mit der Beendigung verschwinden. Ein 2022 gekündigtes Konto, das noch als aktiv geführt wird, verzerrt Ihr Bild — und ist ein klarer Berichtigungsfall." },
  { titel: "Erledigte Forderungen tragen das Erledigt-Kennzeichen", text: "Eine bezahlte Forderung muss als erledigt gekennzeichnet sein, mit Datum. Fehlt das Kennzeichen, wirkt die Forderung offen — und die Löschfrist (drei Jahre ab Erledigung) beginnt auf dem Papier nie zu laufen." },
  { titel: "Löschfristen nachgerechnet", text: "Erledigt plus drei Jahre, 100-Tage-Fälle plus 18 Monate, Restschuldbefreiung plus sechs Monate, Anfragen plus zwölf Monate: Alles, was älter ist, gehört gelöscht. Der Verjährungs-Checker rechnet jeden Fall taggenau nach." },
  { titel: "Doppelte Einträge markiert", text: "Dieselbe Forderung darf nur einmal stehen — nicht einmal vom Gläubiger und einmal vom Inkasso. Doppelmeldungen sind keine Seltenheit, wenn Forderungen verkauft wurden, und drücken doppelt aufs Bild." },
  { titel: "Beträge und Daten geprüft", text: "Stimmen Forderungshöhe, Meldedatum und Erledigungsdatum mit Ihren Unterlagen überein? Ein falscher Betrag oder ein falsches Datum ist mehr als ein Schönheitsfehler — an den Daten hängen die Fristen." },
  { titel: "Bestrittene Forderungen erkennen", text: "Haben Sie einer Forderung damals widersprochen? Bestrittene Forderungen dürfen nicht gemeldet werden (§ 31 BDSG). Steht sie trotzdem drin, notieren Sie Datum und Form Ihres Widerspruchs — das ist Ihre stärkste Karte." },
  { titel: "Anfragen der letzten 12 Monate zählen", text: "Wie viele KREDITanfragen stehen drin — und waren das nicht eigentlich Konditionsanfragen? Banken stellen gelegentlich die falsche Anfrageart. Eine als Kreditanfrage gespeicherte Konditionsanfrage ist korrigierbar." },
  { titel: "Unklares notiert statt ignoriert", text: "Alles, was Sie nicht erklären können, kommt auf eine Liste: Eintrag, Frage, Beleglage. Diese Liste ist die Grundlage für jeden Widerspruch — und genau das, was FIAON bei der geprüften Auskunft für Sie übernimmt." },
];

const FEHLER = [
  { tag: "Fehler 1", titel: "Nur den Score anschauen", text: "Die Zahl ist das Ergebnis, nicht die Ursache. Wer nur auf den Score starrt, übersieht den einen angreifbaren Eintrag, der ihn drückt. Gelesen wird von unten nach oben: erst die Einträge, dann die Zahl." },
  { tag: "Fehler 2", titel: "Das Bezahlprodukt mit der Datenkopie verwechseln", text: "Die kostenpflichtige Auskunft der Auskunfteien ist zum WEITERGEBEN gedacht und zeigt weniger. Für die Prüfung brauchen Sie die kostenlose Datenkopie nach Art. 15 DSGVO — vollständig, mit Meldedatum und meldender Stelle." },
  { tag: "Fehler 3", titel: "Erledigt mit gelöscht verwechseln", text: "Bezahlt heißt nicht weg: Erledigte Forderungen bleiben drei Jahre sichtbar (18 Monate bei der 100-Tage-Regel). Wer das nicht weiß, wundert sich über Absagen trotz beglichener Schulden — und übersieht, wann die Frist wirklich abläuft." },
  { tag: "Fehler 4", titel: "Nur die SCHUFA prüfen", text: "In Österreich meldet der KSV, in der Schweiz die CRIF — und auch in Deutschland gibt es weitere Auskunfteien. Wer nur ein Haus prüft, kennt ein Drittel seiner Lage. Die Rechte sind überall vergleichbar; die Datenkopie gibt es bei jedem Haus." },
  { tag: "Fehler 5", titel: "Widerspruch am Telefon", text: "Ein Anruf beweist nichts. Widersprüche, Berichtigungen und Löschverlangen laufen schriftlich und nachweisbar — mit Frist, an Auskunftei UND meldende Stelle. Nur so entsteht die Kette, auf die Sie sich später berufen können." },
];

const FRAGEN = [
  { f: "Wie bekomme ich meine Selbstauskunft kostenlos?", a: "Über die Datenkopie nach Art. 15 DSGVO — formlos oder über die Formulare der Auskunfteien, gesetzlich kostenlos und beliebig oft. Unser kostenloses Werkzeug bereitet den Antrag für SCHUFA, KSV und CRIF vor. Die Häuser haben einen Monat Zeit, meist kommt sie schneller." },
  { f: "Was ist der Unterschied zwischen Selbstauskunft und Datenkopie?", a: "Umgangssprachlich meint beides dasselbe: die Auskunft über die eigenen Daten. Juristisch sauber ist die Datenkopie nach Art. 15 DSGVO — vollständig und kostenlos. Die Bezahlprodukte der Auskunfteien (Bonitätszertifikat) sind gekürzte Fassungen zum Vorzeigen, nicht zum Prüfen." },
  { f: "In welcher Reihenfolge lese ich die Auskunft am besten?", a: "Genau in der Reihenfolge der Checkliste oben: erst Stammdaten, dann Verträge, dann Forderungen samt Kennzeichen und Fristen, dann Anfragen — und zuletzt der Score. Wer andersherum liest, sucht die Ursache am falschen Ende." },
  { f: "Was mache ich mit einem Eintrag, den ich nicht zuordnen kann?", a: "Nicht ignorieren: schriftlich bei der Auskunftei nachfragen, wer gemeldet hat und auf welcher Grundlage (das steht teils schon in der Datenkopie). Kennen Sie den Vorgang trotzdem nicht, widersprechen Sie und verlangen Belege. Unbekannte Einträge können auf Verwechslung oder Missbrauch hindeuten." },
  { f: "Wie oft sollte ich meine Auskunft prüfen?", a: "Einmal im Jahr als Routine — und zusätzlich vor jedem großen Schritt: Wohnungssuche, Finanzierung, Selbstständigkeit. Die Eigenauskunft ist neutral, sie verändert Ihren Score nicht und wird anderen nicht angezeigt." },
  { f: "Übernimmt FIAON diese Prüfung komplett?", a: "Ja — das ist die Bonitätsauskunft mit Prüfung: FIAON beschafft die Datenkopien aller drei Häuser, erklärt jede Zeile in Klartext und hält jeden Eintrag gegen § 31 BDSG und die Löschfristen. Sie bekommen die Liste, die Sie hier von Hand erstellen würden — fertig und mit Handlungsplan." },
];

export default function SelbstauskunftCheckliste() {
  // Haken oben (Rules of Hooks): die Checkliste lebt im localStorage.
  const [haken, setHaken] = useState<boolean[]>(() => {
    try {
      const roh = JSON.parse(localStorage.getItem(SPEICHER) || "[]");
      return PUNKTE.map((_, i) => roh[i] === true);
    } catch { return PUNKTE.map(() => false); }
  });

  useEffect(() => {
    try { localStorage.setItem(SPEICHER, JSON.stringify(haken)); } catch { /* privates Fenster — dann eben ohne Merken */ }
  }, [haken]);

  useEffect(() => {
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: "Selbstauskunft lesen: die 10-Punkte-Checkliste",
      step: PUNKTE.map((p, i) => ({ "@type": "HowToStep", position: i + 1, name: p.titel, text: p.text })),
    });
    document.head.appendChild(el);
    return () => el.remove();
  }, []);

  const erledigt = haken.filter(Boolean).length;

  return (
    <Dunkel seite="ratgeber" titel="Selbstauskunft lesen: die 10-Punkte-Checkliste" beschreibung="Selbstauskunft verstehen: die interaktive 10-Punkte-Checkliste, die 5 häufigsten Fehler und ein erklärter Muster-Ausschnitt. Jetzt Auskunft prüfen.">
      <SeoDaten
        pfad="/selbstauskunft-checkliste"
        titel="Selbstauskunft lesen: 10-Punkte-Checkliste | FIAON"
        beschreibung="Selbstauskunft verstehen: die interaktive 10-Punkte-Checkliste, die 5 häufigsten Fehler und ein erklärter Muster-Ausschnitt. Jetzt Auskunft prüfen."
        fragen={FRAGEN}
        krumen={[{ name: "Selbstauskunft-Checkliste", pfad: "/selbstauskunft-checkliste" }]}
      />

      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/akten.jpg" alt="" decoding="async" {...({ fetchpriority: "high" } as any)} /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">Lesen · Prüfen · Abhaken</span>
          <h1 className="dk-h1">Selbstauskunft lesen: <span className="dk-verlauf">die 10-Punkte-Checkliste.</span></h1>
          <p className="dk-lead">
            Die Datenkopie liegt vor Ihnen, aber niemand hat erklärt, wie man sie liest?
            Diese Checkliste geht Punkt für Punkt durch — Ihre Haken bleiben gespeichert,
            bis Sie fertig sind. Danach wissen Sie, was stimmt, was fehlt und was angreifbar ist.
          </p>
          <div className="dk-knoepfe">
            <Knopf href="/antrag">Jetzt Antrag starten</Knopf>
            <Knopf href="/kontakt" still>Kostenlos prüfen lassen</Knopf>
          </div>
        </div>
      </section>

      <Licht>
        {/* Die interaktive Checkliste. */}
        <Block schmal titel="Die Checkliste" lead="Zehn Punkte, in dieser Reihenfolge. Ein Klick setzt den Haken — der Stand bleibt in Ihrem Browser gespeichert.">
          <div className="sx-liste" data-fiaon="selbstauskunft-checkliste">
            {PUNKTE.map((p, i) => (
              <button
                key={p.titel} type="button"
                className={`sx-punkt${haken[i] ? " ab" : ""}`}
                aria-pressed={haken[i]}
                onClick={() => setHaken((alt) => alt.map((h, j) => (j === i ? !h : h)))}
              >
                <span className="kasten" aria-hidden="true">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                </span>
                <span>
                  <b>{i + 1}. {p.titel}</b>
                  <p>{p.text}</p>
                </span>
              </button>
            ))}
          </div>
          <p className="sx-liste-stand" role="status">
            {erledigt} von {PUNKTE.length} Punkten geprüft{erledigt === PUNKTE.length ? " — vollständig. Was auf Ihrer Notizliste steht, ist Ihr Arbeitsvorrat." : "."}
          </p>
          <p className="dk-leise" style={{ marginTop: 10 }}>
            Noch keine Auskunft zur Hand? Das kostenlose Werkzeug{" "}
            <a href="/werkzeuge/selbstauskunft" style={{ color: "#1d4ed8" }}>Selbstauskunft anfordern</a>{" "}
            bereitet den Antrag nach Art. 15 DSGVO vor.
          </p>
        </Block>

        {/* Die 5 häufigsten Fehler. */}
        <Block titel="Die fünf häufigsten Fehler beim Lesen" lead="Aus der Praxis der geprüften Auskünfte — dieselben fünf, immer wieder.">
          <Karten items={FEHLER.map((f) => ({ tag: f.tag, titel: f.titel, text: f.text }))} />
        </Block>

        {/* Der annotierte Muster-Ausschnitt — CSS statt Bild. */}
        <Block schmal titel="So sieht ein typischer Ausschnitt aus" lead="Nachgebaut und erklärt — mit den Markierungen, die Sie beim eigenen Exemplar setzen würden.">
          <div className="sx-muster" data-fiaon="muster-ausschnitt">
            <div className="kopfzeile">Auszug aus einer Datenkopie (nachgestellt)</div>
            <div className="zeilen">
              <div className="zeile">
                <code>Girokonto · eröffnet 03/2019 · Bank X</code>
                <span className="marke gruen">in Ordnung</span>
                <p>Aktives Konto mit Historie seit 2019 — ein Positivmerkmal. Nichts zu tun.</p>
              </div>
              <div className="zeile">
                <code>Forderung 214,00 € · gemeldet 05/2023 · erledigt —</code>
                <span className="marke rot">Kennzeichen fehlt</span>
                <p>Die Forderung wurde laut Kontoauszug 08/2023 bezahlt, das Erledigt-Kennzeichen fehlt. Ohne Kennzeichen beginnt die Löschfrist nie — Berichtigung verlangen (Art. 16 DSGVO), Zahlungsbeleg beilegen.</p>
              </div>
              <div className="zeile">
                <code>Forderung 214,00 € · Inkasso Y · gemeldet 07/2023</code>
                <span className="marke rot">Doppelmeldung</span>
                <p>Dieselbe Forderung ein zweites Mal, jetzt vom Inkasso: Eine Forderung darf nur einmal stehen. Löschung der Doppelmeldung verlangen.</p>
              </div>
              <div className="zeile">
                <code>Kreditanfrage · 11/2024 · Bank Z</code>
                <span className="marke gelb">Frist läuft</span>
                <p>Anfragen verschwinden nach zwölf Monaten. Prüfenswert: War das wirklich eine Kredit- und nicht eine Konditionsanfrage? Falsch gestellte Anfragen sind korrigierbar.</p>
              </div>
            </div>
          </div>
        </Block>

        {/* FIAON-Prüfung. */}
        <Block schmal titel="Oder Sie lassen prüfen" lead="Die Checkliste ist genau die Arbeit, die FIAON bei der geprüften Bonitätsauskunft übernimmt.">
          <div className="wz-fragen">
            <div className="wz-frage">
              <p className="wz-nr">Beschaffen</p>
              <h3>Alle drei Häuser aus einer Hand</h3>
              <p className="wz-hinweis">SCHUFA, KSV und CRIF — FIAON fordert die Datenkopien für Sie an. Kein Formular-Marathon, kein Warten an drei Stellen.</p>
            </div>
            <div className="wz-frage">
              <p className="wz-nr">Prüfen</p>
              <h3>Jede Zeile gegen die Regeln</h3>
              <p className="wz-hinweis">Stammdaten, Kennzeichen, Fristen, Doppelmeldungen, Zulässigkeit nach § 31 BDSG — die zehn Punkte dieser Seite, professionell und vollständig. Ergebnis in Klartext.</p>
            </div>
            <div className="wz-frage">
              <p className="wz-nr">Handeln</p>
              <h3>Schreiben und Fristen inklusive</h3>
              <p className="wz-hinweis">Für alles Angreifbare bereitet FIAON den Schriftwechsel vor und verfolgt die Fristen. Was berechtigt und zulässig gemeldet ist, bleibt — das sagen wir ehrlich.</p>
            </div>
          </div>
          <div className="dk-knoepfe" style={{ marginTop: 26 }}>
            <Knopf href="/bonitaetsauskunft-beantragen">Zur geprüften Bonitätsauskunft</Knopf>
            <Knopf href="/schufa-score-verstehen" still>Erst den Score verstehen</Knopf>
          </div>
        </Block>

        <Block schmal titel="Häufige Fragen zur Selbstauskunft">
          <Fragen items={FRAGEN} />
          <p className="dk-leise" style={{ marginTop: 22 }}>
            Stand August 2026 — keine Rechtsberatung im Einzelfall. Alle Begriffe erklärt das{" "}
            <a href="/glossar-bonitaet" style={{ color: "#1d4ed8" }}>Bonitäts-Glossar</a>; die drei Auskunfteien
            im Detail zeigt <a href="/auskunfteien" style={{ color: "#1d4ed8" }}>die Auskunfteien-Seite</a>.
          </p>
        </Block>
      </Licht>

      <KartenAufruf
        titel="Zehn Punkte. Oder ein Auftrag."
        satz="FIAON beschafft Ihre Auskünfte, geht jede Zeile nach genau dieser Checkliste durch und liefert Klartext samt Handlungsplan — Sie sehen jeden Schritt in Ihrem Kundenbereich."
      />
    </Dunkel>
  );
}
