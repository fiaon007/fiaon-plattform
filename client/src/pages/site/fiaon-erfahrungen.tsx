// ═══════════════════════════════════════════════════════════════════════════
// /fiaon-erfahrungen — die Vertrauensseite (30.08.2026; NEUBAU 02.09.2026, E-082)
//
// Justin: „Diese Seite bitte in unseren CI (hochmodern, 3D, Animationen,
// Glas …) neu machen, länger, brauchbarer – funktionaler, Werkzeuge."
//
// ── SUCHINTENTION ─────────────────────────────────────────────────────────
// „fiaon erfahrungen / seriös / bewertung". Wer das sucht, steht kurz vor
// der Entscheidung. Messlatte aus der Marktanalyse (CONNY, bonify): Zahlen,
// „So funktioniert's" in drei Schritten, Verläufe, Bewertungen, Team,
// Sicherheit — und ein prüfbares Kriterium statt Eigenlob.
//
// ── DIE ZAHLEN SIND ECHT ──────────────────────────────────────────────────
// Bis 02.09.2026 standen hier Platzhalter („1.000+"). Jetzt: bankbestätigte
// Werte aus der Datenbank (E-075: nur bankbestätigte Zahlen), gemessen am
// 02.09.2026, gerundet nach unten, mit Stand-Datum sichtbar:
//   443 zahlende Kunden (payment_status = paid, keine Testkonten)
//   450 bezahlte Raten (fiaon_abo_raten.bezahlt_am)
//   DE 267 · AT 150 · CH 4 zahlende Kunden nach Land
// Pflege: scripts/tmp/zahlen-oeffentlich.ts (nur SELECT) — Stand alle
// vier Wochen nachziehen, nie nach oben runden.
//
// ── WAS NEU IST ───────────────────────────────────────────────────────────
// 3D-Schichten im Hero, Kennzahlen mit Stand, „So funktioniert's" (3 Schritte),
// Szenenbild mit Relief, zwei typische Verläufe (nachgestellt, als solche
// gekennzeichnet — echte Fälle nur mit Justins Freigabe), das Werkzeug
// „Seriositäts-Check" (sechs Fragen, die für JEDEN Anbieter gelten),
// Warnzeichen-Karten, Team- und Sicherheitsband, Bewertungsplatz (ehrlich:
// im Aufbau), FAQ, Aufruf. JSON-LD: FAQPage über SeoDaten; Organization
// kommt vom Server (E-079) — der frühere Client-Block ist entfernt.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Hero, Block, Licht, Knopf, Fragen, Karten, Kennzahlen, Auf, Glas, Szenenbild, Zitat, Zwischenruf } from "@/components/site/DunkleBuehne";
import SchichtenSzene from "@/components/home3d/SchichtenSzene";
import SeoDaten from "@/components/site/SeoDaten";
import KartenAufruf from "@/components/site/KartenAufruf";
import "@/styles/ratgeber.css";
import "@/styles/seo-seiten.css";

// ── Bankbestätigte Zahlen, Stand 02.09.2026 (siehe Kopfkommentar). ────────────
const STAND = "2. September 2026";
const ZAHLEN = {
  kunden: "440+",           // 443 zahlende Kunden, abgerundet
  raten: "450",             // bezahlte Raten
  laender: "3",             // DE, AT, CH
  werkzeuge: "20",          // kostenlose Werkzeuge
};

const FRAGEN = [
  { f: "Ist FIAON seriös?", a: "Prüfen Sie uns an den Kriterien, die für jeden Anbieter gelten – sie stehen im Seriositäts-Check auf dieser Seite: Festpreise statt Erfolgsbeteiligung, keine Löschgarantien, Ihre kostenlosen Rechte werden genannt, ein Impressum mit erreichbaren Menschen, kein Zeitdruck, jeder Schritt im Kundenbereich nachlesbar. FIAON LTD ist im britischen Handelsregister eingetragen (Company No. 17318250); Kunden in Deutschland, Österreich und der Schweiz." },
  { f: "Was macht FIAON genau?", a: "FIAON beschafft Ihre Bonitätsauskünfte bei SCHUFA, KSV und CRIF, erklärt jede Zeile in Klartext, prüft jeden Eintrag auf Zulässigkeit (§ 31 BDSG) und Verfristung und führt den Schriftwechsel mit Auskunfteien und Gläubigern – anwaltlich geprüfte Vorlagen, Einschreiben, Fristen, Antworten. Danach bereitet FIAON Girokonto und Kreditkarte beim Partnerinstitut vor. Über die Vergabe entscheidet die Bank." },
  { f: "Was kostet FIAON?", a: "Die Bonitätsauskunft mit Prüfung kostet einmalig 74 Euro. Die Pakete für die laufende Begleitung laufen über zwölf Monatsraten von 7,99 bis 99,99 Euro; alle Preise stehen offen auf der Preisseite. Keine Erfolgsbeteiligung, keine Gebühr je Schreiben, keine Provision auf Konto oder Karte." },
  { f: "Kann FIAON meine SCHUFA-Einträge löschen?", a: "FIAON kann durchsetzen, was das Gesetz hergibt: die Löschung unzulässig gemeldeter, inhaltlich falscher oder verfristeter Einträge. Berechtigte, zulässig gemeldete Einträge bleiben bis zum Fristablauf – das sagen wir Ihnen vor der Beauftragung, nicht danach. Wer Ihnen das Gegenteil verspricht, arbeitet unseriös." },
  { f: "Wie sehe ich, was FIAON für mich tut?", a: "In Ihrem Kundenbereich: jeder Auftrag, jede eingegangene Auskunft, jedes Schreiben, jede Frist und jede Antwort als nachvollziehbarer Verlauf. Sie müssen nicht anrufen, um den Stand zu erfahren – und Sie geben jedes Schreiben frei, bevor es rausgeht." },
  { f: "Arbeitet FIAON auch in Österreich und der Schweiz?", a: "Ja. SCHUFA in Deutschland, KSV1870 und CRIF in Österreich, CRIF, Intrum und das Betreibungsregister in der Schweiz – mit den jeweiligen Rechtsgrundlagen. Rund ein Drittel unserer zahlenden Kunden kommt aus Österreich." },
  { f: "Wie kündige ich, wenn ich nicht zufrieden bin?", a: "Jederzeit zum Ende des laufenden Monats, formlos und ohne Grund – im Kundenbereich unter Abo & Zahlungen oder per E-Mail. Das Widerrufsrecht von 14 Tagen gilt zusätzlich." },
  { f: "Wo sind die Bewertungen?", a: "FIAON baut die öffentlichen Bewertungsprofile (Trustpilot, ProvenExpert, Google) gerade auf – Kunden erhalten nach dem Startgespräch eine Einladung. Bis die Profile stehen, zeigen wir hier lieber nichts als erfundene Sterne. Prüfbar sind heute: Zahlen aus dem Betrieb, Ablauf, Preise, Team und Sicherheit." },
];

// ── Der Seriositäts-Check: sechs Ja/Nein-Fragen, die für jeden Anbieter gelten.
const CHECK = [
  { key: "garantie", frage: "Verspricht der Anbieter, jeden Eintrag zu löschen – „garantiert“?", schlecht: "ja", erk: "Rechtlich unmöglich: Berechtigte, zulässig gemeldete Einträge bleiben bis zum Fristablauf." },
  { key: "erfolg", frage: "Rechnet er „pro gelöschtem Eintrag“ oder mit Erfolgsbeteiligung ab?", schlecht: "ja", erk: "Schafft den Anreiz, Ihnen viele Angriffe zu verkaufen statt die richtigen." },
  { key: "rechte", frage: "Nennt er Ihre kostenlosen Rechte – Datenkopie (Art. 15 DSGVO), Basiskonto (§ 31 ZKG)?", schlecht: "nein", erk: "Wer Gratis-Rechte verschweigt, verkauft Ihnen, was Ihnen zusteht." },
  { key: "impressum", frage: "Gibt es ein vollständiges Impressum mit Registernummer, Adresse und erreichbaren Menschen?", schlecht: "nein", erk: "Ohne Impressum keine Verantwortung – und kein Weg für Beschwerden." },
  { key: "druck", frage: "Arbeitet er mit Countdown, „nur heute“ oder Anrufdruck?", schlecht: "ja", erk: "Wer keine Zeit zum Prüfen lässt, fürchtet Ihre Prüfung." },
  { key: "einsicht", frage: "Sehen Sie jeden Schritt (Auskunft, Schreiben, Antwort) selbst – bevor er passiert?", schlecht: "nein", erk: "Sonst zahlen Sie für Behauptungen statt für Arbeit." },
];

export default function FiaonErfahrungen() {
  const [antworten, setAntworten] = useState<Record<string, "ja" | "nein">>({});
  const ergebnis = useMemo(() => {
    const beantwortet = CHECK.filter((c) => antworten[c.key]);
    if (beantwortet.length < CHECK.length) return null;
    const rot = CHECK.filter((c) => antworten[c.key] === c.schlecht);
    return { rot, stufe: rot.length === 0 ? "gut" : rot.length <= 2 ? "pruefen" : "alarm" };
  }, [antworten]);

  return (
    <Dunkel seite="ratgeber" titel="FIAON Erfahrungen: So arbeitet FIAON" beschreibung="FIAON Erfahrungen: bankbestätigte Zahlen, der Ablauf in drei Schritten, was wir nicht versprechen – und ein Seriositäts-Check, der für jeden Anbieter gilt.">
      <SeoDaten
        pfad="/fiaon-erfahrungen"
        titel="FIAON Erfahrungen: So arbeitet FIAON — ehrlich erklärt"
        beschreibung="FIAON Erfahrungen: bankbestätigte Zahlen, der Ablauf in drei Schritten, was wir nicht versprechen – und ein Seriositäts-Check, der für jeden Anbieter gilt."
        fragen={FRAGEN}
        krumen={[{ name: "FIAON Erfahrungen", pfad: "/fiaon-erfahrungen" }]}
      />

      <Hero
        bild="/kino/akten.jpg"
        pille="Transparenz statt Werbeversprechen"
        titel={<>So arbeitet <span className="dk-verlauf">FIAON.</span></>}
        lead="Wer „FIAON Erfahrungen“ sucht, will wissen: Kann ich denen trauen? Die ehrlichste Antwort ist, Ihnen alles Prüfbare hinzulegen – Zahlen aus dem Betrieb, den Ablauf, die Preise, die Grenzen. Und einen Check, mit dem Sie jeden Anbieter prüfen können. Auch uns."
        knoepfe={<><Knopf href="#check">Seriositäts-Check</Knopf><Knopf href="#ablauf" still>So funktioniert's</Knopf></>}
        szene={<SchichtenSzene namen={["Einsicht", "Aktion", "Zugang"]} className="absolute inset-0" />}
      />

      <Block eng>
        <Kennzahlen items={[
          { wert: ZAHLEN.kunden, label: "zahlende Kunden, bankbestätigt" },
          { wert: ZAHLEN.raten, label: "bezahlte Monatsraten" },
          { wert: ZAHLEN.laender, label: "Länder: DE, AT, CH" },
          { wert: ZAHLEN.werkzeuge, label: "kostenlose Werkzeuge" },
        ]} />
        <p className="dk-leise" style={{ textAlign: "center", marginTop: 14 }}>Stand {STAND}. Gezählt wird nur, was die Bank bestätigt hat – keine Anmeldungen, keine Absichten. Rund ein Drittel der Kunden kommt aus Österreich.</p>
      </Block>

      <Licht>
        <Block id="ablauf" schmal titel={<>So funktioniert's – <span className="dk-verlauf">in drei Schritten.</span></>} lead="Kein Kleingedrucktes im Prozess. So läuft ein FIAON-Auftrag wirklich – und so lange dauert jeder Schritt.">
          <Auf>
            <div className="sx-zeitleiste">
              <div className="sx-etappe">
                <div className="spur"><span className="punkt">1</span><span className="faden" /></div>
                <div className="inhalt">
                  <span className="dauer">2 Minuten + 15 Minuten Startgespräch</span>
                  <h3>Antrag mit Festpreis, dann ein Mensch am Telefon</h3>
                  <p>Sie sehen den Preis, BEVOR Sie beauftragen – Bonitätsauskunft 74 Euro einmalig, Pakete über zwölf Monatsraten. Danach ruft ein Mitarbeiter an: Lage, Ziel, Unterlagen, nächste Schritte. Ab dann kennen Sie Ihren Ansprechpartner mit Namen.</p>
                </div>
              </div>
              <div className="sx-etappe">
                <div className="spur"><span className="punkt">2</span><span className="faden" /></div>
                <div className="inhalt">
                  <span className="dauer">Tage bis 4 Wochen, dann binnen 24 Stunden erklärt</span>
                  <h3>Einsicht: Auskunft beschafft, jede Zeile geprüft</h3>
                  <p>SCHUFA, KSV, CRIF – FIAON fordert Ihre Datenkopien mit Vollmacht an. Jeder Eintrag wird gegen § 31 BDSG und die Löschfristen gehalten: erledigt, löschbar, berichtigbar, angreifbar – oder berechtigt. Das Letzte sagen wir genauso deutlich.</p>
                </div>
              </div>
              <div className="sx-etappe">
                <div className="spur"><span className="punkt">3</span></div>
                <div className="inhalt">
                  <span className="dauer">laufend, jeder Schritt im Kundenbereich</span>
                  <h3>Aktion und Zugang: Schreiben, Fristen, Konto, Karte</h3>
                  <p>Für alles Angreifbare gehen anwaltlich geprüfte Schreiben per Einschreiben raus – Sie geben frei, FIAON verfolgt Antworten und Fristen. Parallel der Weg zum Girokonto beim Partnerinstitut; die Kreditkarte, sobald Ihre Akte sie trägt. Die Entscheidung trifft die Bank, und genau so steht es hier.</p>
                </div>
              </div>
            </div>
          </Auf>
        </Block>
      </Licht>

      <Szenenbild tief src="/kino/tuer.jpg" titel={<>Die Tür öffnet sich <span className="dk-verlauf">über die Akte.</span></>} text="Niemand bekommt Konto oder Karte, weil er sie beantragt – sondern weil die Akte sie trägt: bereinigte Einträge, geführtes Konto, zwölf pünktliche Raten. Genau daran arbeitet FIAON, in dieser Reihenfolge." />

      <Licht>
        <Block id="check" schmal titel={<>Der Seriositäts-Check – <span className="dk-verlauf">für jeden Anbieter.</span></>} lead="Sechs Fragen, die Sie jedem stellen sollten, der Ihnen bei Einträgen helfen will. Beantworten Sie sie für einen Anbieter Ihrer Wahl – oder für uns.">
          <div className="wz-fragen">
            {CHECK.map((c, i) => (
              <div key={c.key} className="wz-frage">
                <p className="wz-nr">Frage {i + 1}</p><h3>{c.frage}</h3>
                <div className="wz-optionen zwei">
                  <button type="button" className={`wz-option${antworten[c.key] === "ja" ? " an" : ""}`} onClick={() => setAntworten({ ...antworten, [c.key]: "ja" })}><b>Ja</b></button>
                  <button type="button" className={`wz-option${antworten[c.key] === "nein" ? " an" : ""}`} onClick={() => setAntworten({ ...antworten, [c.key]: "nein" })}><b>Nein</b></button>
                </div>
              </div>
            ))}
          </div>
          {ergebnis && (
            <div className={`wz-ergebnis${ergebnis.stufe === "gut" ? " gut" : ergebnis.stufe === "alarm" ? " alarm" : ""}`}>
              <span className="wz-stufe" style={{ background: ergebnis.stufe === "gut" ? "#047857" : ergebnis.stufe === "alarm" ? "#b91c1c" : "#b45309" }}>{ergebnis.stufe === "gut" ? "Keine Warnzeichen" : ergebnis.stufe === "alarm" ? `${ergebnis.rot.length} von 6 Warnzeichen` : `${ergebnis.rot.length} Warnzeichen – genau hinsehen`}</span>
              <h3>{ergebnis.stufe === "gut" ? "Dieser Anbieter besteht den Check." : ergebnis.stufe === "alarm" ? "Finger weg – oder zumindest: nichts unterschreiben, nichts vorab zahlen." : "Fragen Sie nach, bevor Sie beauftragen."}</h3>
              {ergebnis.rot.length > 0 && <ul style={{ margin: "12px 0 0 18px", color: "#334155", fontSize: 14.5, lineHeight: 1.6 }}>{ergebnis.rot.map((c) => <li key={c.key}><b>{c.frage}</b> – {c.erk}</li>)}</ul>}
              <div className="wz-schritt"><small>So beantworten wir die sechs Fragen für FIAON</small><p>Garantie: nein. Erfolgsbeteiligung: nein, Festpreis. Kostenlose Rechte: stehen auf jeder Werkzeugseite. Impressum: FIAON LTD, Company No. 17318250, 128 City Road, London – Support +41 44 244 93 01. Zeitdruck: keiner, kündbar zum Monatsende. Einsicht: jeder Schritt im Kundenbereich, jedes Schreiben vor dem Versand freigegeben.</p></div>
            </div>
          )}
        </Block>

        <Block titel={<>Woran Sie unseriöse Anbieter <span className="dk-verlauf">erkennen.</span></>} lead="Diese Kriterien gelten für jeden in diesem Markt – auch für uns. Prüfen Sie beides.">
          <Karten items={[
            { tag: "Warnzeichen 1", titel: "Löschgarantien", text: "„Wir löschen jeden Eintrag“ ist rechtlich unmöglich: Berechtigte, zulässig gemeldete Einträge bleiben bis zum Fristablauf. Seriös ist, wer Ihnen vorher sagt, welcher Eintrag bleibt." },
            { tag: "Warnzeichen 2", titel: "Erfolgsbeteiligung pro Eintrag", text: "Abrechnung „pro gelöschtem Eintrag“ schafft den Anreiz, Ihnen viele Angriffe zu verkaufen statt die richtigen. Seriös sind Festpreise, die vorher feststehen." },
            { tag: "Warnzeichen 3", titel: "Ihre Gratis-Rechte verschweigen", text: "Datenkopie nach Art. 15 DSGVO, Basiskonto nach § 31 ZKG: Ihre kostenlosen Rechte gehören auf den Tisch, bevor jemand Geld verlangt. FIAON stellt 20 kostenlose Werkzeuge dafür bereit." },
            { tag: "Warnzeichen 4", titel: "Vorkasse an anonyme Empfänger", text: "Kein Impressum, keine erreichbaren Menschen, Zahlung an ausländische Konten oder per Gutschein: Finger weg. FIAON hat ein Impressum mit Registernummer, Telefon und Team mit Namen." },
            { tag: "Warnzeichen 5", titel: "Erfolg über Nacht", text: "Score-Sprünge „in 48 Stunden“ scheitern an der Realität: Auskunfteien haben einen Monat Antwortfrist, und ein erledigter Eintrag wirkt im neuen Score bis zu drei Jahre nach." },
            { tag: "Warnzeichen 6", titel: "Druck statt Klarheit", text: "Countdown-Timer, „nur heute“, Anruf-Druck: Wer Ihnen keine Zeit zum Prüfen lässt, fürchtet Ihre Prüfung. Diese Seite ist in einer Woche noch genauso da." },
          ]} />
        </Block>

        <Block schmal titel={<>Zwei typische Verläufe – <span className="dk-verlauf">so sieht es aus.</span></>} lead="Nachgestellt aus der Praxis, mit geänderten Namen und Zahlen – kein Versprechen für Ihren Fall. Echte Verläufe mit Freigabe der Kunden folgen.">
          <div className="sx-vertiefen">
            <Glas tag="Verlauf A · Deutschland" titel="Der Eintrag, der nie hätte gemeldet werden dürfen">
              <p className="dk-text" style={{ fontSize: 14.5, lineHeight: 1.7 }}>Woche 1: Startgespräch, Vollmacht, Datenkopie angefordert. Woche 3: Auskunft liegt vor – ein Eintrag, Mobilfunk, 214 Euro. Prüfung: nur eine Mahnung statt zwei. Woche 4: Löschantrag an Auskunftei und Gläubiger, Einschreiben. Woche 8: Löschung bestätigt. Woche 10: Girokonto beim Partner eröffnet. Was nicht ging: nichts – der Eintrag war unzulässig.</p>
            </Glas>
            <Glas tag="Verlauf B · Österreich" titel="Der Eintrag, der berechtigt war – und trotzdem ein Weg">
              <p className="dk-text" style={{ fontSize: 14.5, lineHeight: 1.7 }}>Woche 1: Startgespräch, KSV1870-Auskunft angefordert. Woche 3: zwei Einträge, beide berechtigt und noch in der Frist. Ehrliche Einordnung: keine Löschung möglich. Stattdessen: Ratenvereinbarung mit dem Gläubiger (Meldeverzicht schriftlich), Erledigt-Vermerk beantragt, Konto auf Guthabenbasis. Monat 6: sechs pünktliche Raten, Kontoführung sauber. Karte: noch nicht – die Bank entscheidet, wenn die Akte trägt.</p>
            </Glas>
          </div>
        </Block>
      </Licht>

      <Block schmal>
        <Zitat text="Ehrlich bis zum Nein: Berechtigte Einträge lassen sich nicht weglöschen. Wir sagen es – und zeigen, was stattdessen geht." wer="Justin Schwarzott, Gründer FIAON" />
      </Block>

      <Licht>
        <Block schmal titel={<>Menschen und <span className="dk-verlauf">Sicherheit.</span></>} lead="Vertrauen hat zwei Adressen: wer arbeitet, und wie mit Ihren Daten umgegangen wird.">
          <div className="sx-vertiefen">
            <a href="/team"><b>Das FIAON-Team</b><span>Namen, Gesichter, Verantwortlichkeiten – die Menschen hinter der Plattform, viele davon selbst ehemalige Kunden.</span></a>
            <a href="/sicherheit"><b>Sicherheit und Datenschutz</b><span>Server in Frankfurt, Verschlüsselung, Vollmacht vor jeder Auskunft, Freigabe vor jedem Schreiben, Löschung auf Wunsch.</span></a>
            <a href="/preise"><b>Alle Preise offen</b><span>Jedes Paket, jede Rate, keine Sternchen. Was es kostet, steht fest, bevor Sie beauftragen.</span></a>
            <a href="/werkzeuge"><b>20 kostenlose Werkzeuge</b><span>Löschantrag, Fristen, Pfändung, Dispo, Schuldenplan – alles im Browser, nichts gespeichert. Auch ohne FIAON nutzbar.</span></a>
          </div>
        </Block>

        <Block schmal titel={<>Bewertungen – <span className="dk-verlauf">im Aufbau.</span></>} lead="Wir zeigen hier lieber nichts als erfundene Sterne.">
          <Glas ruhig>
            <p className="dk-text" style={{ fontSize: 15, lineHeight: 1.7 }}>FIAON legt die öffentlichen Bewertungsprofile (Trustpilot, ProvenExpert, Google) im September 2026 an; Kunden erhalten nach dem Startgespräch eine Einladung. Sobald echte Bewertungen vorliegen, stehen sie hier – mit Quelle, ungefiltert, inklusive der kritischen. Bis dahin gilt: Prüfbar sind Zahlen, Ablauf, Preise, Team und Sicherheit. Und der Seriositäts-Check oben.</p>
          </Glas>
        </Block>

        <Block schmal titel="Häufige Fragen zu FIAON">
          <Fragen items={FRAGEN} />
          <p className="dk-leise" style={{ marginTop: 22 }}>Stand {STAND}. FIAON ist keine Rechtsberatung und keine Bank; Konto und Karte entstehen beim Partnerinstitut – die Entscheidung trifft die Bank.</p>
        </Block>
      </Licht>

      <Zwischenruf text={<><b>Lieber erst reden?</b> 15 Minuten am Telefon, ohne Verpflichtung – ein Mensch erklärt Ihnen, was Ihre Auskunft hergibt.</>} knopf="Kontakt aufnehmen" href="/kontakt" still={{ knopf: "Eintrag kostenlos prüfen", href: "/werkzeuge/eintrag-pruefen" }} />

      <KartenAufruf
        titel="Prüfen Sie uns – an unseren eigenen Kriterien."
        satz="Festpreis, ehrliche Grenzen, jeder Schritt sichtbar in Ihrem Kundenbereich: So arbeitet FIAON. Wenn Ihnen das gefällt, dauert der Anfang zwei Minuten."
      />
    </Dunkel>
  );
}
