// ═══════════════════════════════════════════════════════════════════════════
// DIE VEREINBARUNGS-SEITE — /vereinbarung (26.08.2026)
//
// Justin: „Erstelle dafür eine eigene gesperrte Seite (mit einem Code um zu
// entsperren, der Code soll 26082026 sein) … auf der Seite soll er seine
// fehlenden Daten eintippen, Anmerkungen schreiben und direkt unterzeichnen
// können — bitte sehr seriös und in unserem CI gestaltet."
//
// ── DER AUFBAU FOLGT DEM, WAS EIN MENSCH HIER TUT ─────────────────────────
//   1. Aufsperren      — ein Feld, ein Knopf, sonst nichts.
//   2. Lesen           — der vollständige Vertragstext, ruhig gesetzt.
//   3. Ergänzen        — die fehlenden Angaben stehen DORT, wo sie im Vertrag
//                        hingehören, nicht in einem Formular am Ende. Wer
//                        seine Steuer-ID einträgt, sieht dabei den Satz, in
//                        dem sie steht.
//   4. Entscheiden     — § 3 Abs. 3, zwei Varianten, eine Wahl.
//   5. Anmerken        — ein freies Feld. Wer etwas anders will, soll es
//                        sagen können, ohne den Vertrag abzulehnen.
//   6. Unterzeichnen   — Name tippen, Haken setzen, senden.
//
// ── WARUM DIE FELDER IM TEXT STEHEN ───────────────────────────────────────
// Ein Formular über einem PDF trennt die Angabe von ihrer Bedeutung. Man füllt
// „Steuernummer" aus, ohne zu sehen, wofür. Hier ist das Feld die Lücke im
// Satz — man liest, was man unterschreibt, während man es ausfüllt.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import "@/styles/vereinbarung.css";

const API = "/api/fiaon";

async function ruf(pfad: string, koerper: unknown) {
  const r = await fetch(`${API}${pfad}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(koerper),
  });
  const json = await r.json().catch(() => null);
  return { status: r.status, ok: r.ok && json?.ok, json };
}

type Angaben = Record<string, string>;

/** Ein Feld mitten im Vertragstext. */
function Luecke({ name, wert, setzen, breite, hinweis, gesperrt, typ }: {
  name: string; wert: string; setzen: (v: string) => void;
  breite?: number; hinweis?: string; gesperrt: boolean; typ?: string;
}) {
  const leer = !wert.trim();
  if (gesperrt) {
    return <span className={`vb-fest${leer ? " vb-fest-leer" : ""}`}>{wert.trim() || "— nicht angegeben —"}</span>;
  }
  return (
    <span className={`vb-luecke${leer ? " leer" : " voll"}`}>
      <input
        type={typ || "text"}
        value={wert}
        onChange={(e) => setzen(e.target.value)}
        placeholder={hinweis || ""}
        aria-label={hinweis || name}
        style={breite ? { width: breite } : undefined}
      />
    </span>
  );
}

export default function VereinbarungSeite(): JSX.Element {
  const [code, setCode] = useState("");
  const [offen, setOffen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [a, setA] = useState<Angaben>({});
  const [anmerkungen, setAnmerkungen] = useState("");
  const [variante, setVariante] = useState<string | null>(null);
  const [gelesen, setGelesen] = useState(false);
  const [unterschrift, setUnterschrift] = useState("");
  const [fertig, setFertig] = useState<{ am: string; pruefsumme: string } | null>(null);
  const [gespeichert, setGespeichert] = useState<string | null>(null);

  const gesperrt = !!fertig;
  const setz = (k: string) => (v: string) => setA((alt) => ({ ...alt, [k]: v }));
  const feld = (k: string) => a[k] ?? "";

  const aufsperren = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setFehler(null);
    const r = await ruf("/vereinbarung/entsperren", { code });
    setBusy(false);
    if (!r.ok) { setFehler(r.json?.error || "Das hat nicht geklappt."); return; }
    const v = r.json.vereinbarung || {};
    setA(v.angaben || {});
    setAnmerkungen(v.anmerkungen || "");
    setVariante(v.variante || null);
    if (v.unterzeichnetAm) {
      setUnterschrift(v.unterschriftName || "");
      setFertig({ am: v.unterzeichnetAm, pruefsumme: "" });
    }
    setOffen(true);
  };

  // Stilles Zwischenspeichern: Wer zwanzig Felder tippt und dann den Tab
  // schliesst, soll nicht von vorn anfangen.
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (!offen || gesperrt) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void ruf("/vereinbarung/speichern", { code, angaben: a, anmerkungen, variante })
        .then((r) => { if (r.ok) setGespeichert(new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })); });
    }, 1200);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [a, anmerkungen, variante, offen, gesperrt, code]);

  const unterzeichnen = async () => {
    setBusy(true); setFehler(null);
    const r = await ruf("/vereinbarung/unterzeichnen", {
      code, angaben: a, anmerkungen, variante, gelesen, unterschriftName: unterschrift,
    });
    setBusy(false);
    if (!r.ok) { setFehler(r.json?.error || "Das hat nicht geklappt."); return; }
    setFertig({ am: r.json.unterzeichnetAm, pruefsumme: r.json.pruefsumme || "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Die Sperre ───────────────────────────────────────────────────────────
  if (!offen) {
    return (
      <main className="vb-tor">
        <div className="vb-tor-karte">
          <p className="vb-marke">FIAON</p>
          <p className="vb-tor-art">Vertrauliches Dokument</p>
          <h1>Zusatzvereinbarung zum Vertriebspartnervertrag</h1>
          <p className="vb-tor-satz">
            Diese Seite ist geschützt. Bitte geben Sie den Code ein, den Sie von der
            Geschäftsleitung erhalten haben.
          </p>
          <form onSubmit={aufsperren}>
            <label className="vb-tor-label" htmlFor="vb-code">Zugangscode</label>
            <input
              id="vb-code" className="vb-tor-feld" value={code} inputMode="numeric" autoFocus
              onChange={(e) => setCode(e.target.value)} placeholder="········"
              aria-describedby={fehler ? "vb-tor-fehler" : undefined}
            />
            {fehler && <p className="vb-tor-fehler" id="vb-tor-fehler" role="alert">{fehler}</p>}
            <button type="submit" className="vb-knopf" disabled={busy || code.trim().length < 4}>
              {busy ? "Prüft …" : "Dokument öffnen"}
            </button>
          </form>
          <p className="vb-tor-fuss">
            FIAON LTD · Company No. 17318250 · 128 City Road, London EC1V 2NX
          </p>
        </div>
      </main>
    );
  }

  // ── Das Dokument ─────────────────────────────────────────────────────────
  return (
    <main className="vb">
      <div className="vb-blatt">

        <header className="vb-band">
          <p className="vb-marke">FIAON</p>
          <p className="vb-art">Zusatzvereinbarung zum Vertriebspartnervertrag</p>
          <h1>Leistungsvereinbarung und garantierte Monatsprovision</h1>
          <p className="vb-kennung">
            Vertrags-Nr. <b>FIAON-ZV-2026-013</b> · Fassung vom <b>26. August 2026</b> ·
            Laufzeit <b>1. September 2026 bis 31. August 2027</b>
          </p>
        </header>

        <div className="vb-inhalt">

          {fertig ? (
            <div className="vb-fertig" role="status">
              <p className="vb-fertig-kopf">Unterzeichnet</p>
              <p>
                Diese Vereinbarung wurde am{" "}
                <b>{new Date(fertig.am).toLocaleString("de-DE", { dateStyle: "long", timeStyle: "short" })}</b>{" "}
                durch <b>{unterschrift}</b> unterzeichnet. Der Inhalt ist damit festgeschrieben und
                lässt sich nicht mehr ändern.
                {fertig.pruefsumme && <> Prüfsumme <code>{fertig.pruefsumme}</code>.</>}
              </p>
              <p className="vb-fertig-leise">
                Bitte drucken Sie dieses Dokument oder speichern Sie es als PDF für Ihre Unterlagen.
                Die Geschäftsleitung erhält eine gegengezeichnete Ausfertigung.
              </p>
            </div>
          ) : (
            <div className="vb-hinweis">
              <p className="vb-hinweis-kopf">So gehen Sie vor</p>
              <p>
                Lesen Sie die Vereinbarung in Ruhe. Die <span className="vb-beispiel">hervorgehobenen Felder</span>{" "}
                sind Angaben, die uns zu Ihnen noch fehlen — bitte tragen Sie sie direkt an Ort und Stelle ein.
                In <b>§ 3 Absatz 3</b> treffen Sie eine Wahl. Ganz unten können Sie Anmerkungen hinterlassen
                und unterzeichnen. Ihre Eingaben werden während des Ausfüllens automatisch gesichert.
              </p>
            </div>
          )}

          <p className="vb-zwischen">Zwischen</p>

          <section className="vb-partei">
            <p className="vb-rolle">Auftraggeberin — nachfolgend „FIAON“</p>
            <p className="vb-name">FIAON LTD</p>
            <table className="vb-daten"><tbody>
              <tr><td>Registernummer</td><td>Company No. 17318250</td></tr>
              <tr><td>Sitz</td><td>128 City Road, London EC1V 2NX, Vereinigtes Königreich</td></tr>
              <tr><td>Vertreten durch</td><td>Justin Schwarzott, Geschäftsführer</td></tr>
            </tbody></table>
          </section>

          <p className="vb-verbinder">und</p>

          <section className="vb-partei">
            <p className="vb-rolle">Vertriebspartner — nachfolgend „der Partner“</p>
            <p className="vb-name">Nikita Boychenko</p>
            <table className="vb-daten"><tbody>
              <tr><td>Vollständiger Name laut Ausweis</td><td>
                <Luecke name="legalName" wert={feld("legalName")} setzen={setz("legalName")} gesperrt={gesperrt} breite={260} hinweis="wie im Ausweis" /></td></tr>
              <tr><td>Geburtsdatum</td><td>
                <Luecke name="geburtsdatum" wert={feld("geburtsdatum")} setzen={setz("geburtsdatum")} gesperrt={gesperrt} breite={150} hinweis="TT.MM.JJJJ" /></td></tr>
              <tr><td>Straße und Hausnummer</td><td>
                <Luecke name="strasse" wert={feld("strasse")} setzen={setz("strasse")} gesperrt={gesperrt} breite={280} hinweis="Straße, Nr." /></td></tr>
              <tr><td>Postleitzahl und Ort</td><td>
                <Luecke name="plz" wert={feld("plz")} setzen={setz("plz")} gesperrt={gesperrt} breite={80} hinweis="PLZ" />{" "}
                <Luecke name="ort" wert={feld("ort")} setzen={setz("ort")} gesperrt={gesperrt} breite={180} hinweis="Ort" /></td></tr>
              <tr><td>Land</td><td>
                <Luecke name="land" wert={feld("land")} setzen={setz("land")} gesperrt={gesperrt} breite={160} hinweis="Deutschland" /></td></tr>
              <tr><td>E-Mail</td><td>nikitaboychenko73@gmail.com</td></tr>
              <tr><td>Telefon</td><td>+49 163 4065459</td></tr>
              <tr><td>Steuerliche Identifikationsnummer</td><td>
                <Luecke name="steuerId" wert={feld("steuerId")} setzen={setz("steuerId")} gesperrt={gesperrt} breite={180} hinweis="11-stellig" /></td></tr>
              <tr><td>Steuernummer <em>(falls vorhanden)</em></td><td>
                <Luecke name="steuernummer" wert={feld("steuernummer")} setzen={setz("steuernummer")} gesperrt={gesperrt} breite={180} hinweis="optional" /></td></tr>
              <tr><td>Umsatzsteuer</td><td>
                <Luecke name="ustId" wert={feld("ustId")} setzen={setz("ustId")} gesperrt={gesperrt} breite={200} hinweis="USt-IdNr. oder „Kleinunternehmer“" /></td></tr>
              <tr><td>IBAN</td><td>
                <Luecke name="iban" wert={feld("iban")} setzen={setz("iban")} gesperrt={gesperrt} breite={300} hinweis="DE.. .... .... .... .... .." /></td></tr>
              <tr><td>Kontoinhaber</td><td>
                <Luecke name="kontoinhaber" wert={feld("kontoinhaber")} setzen={setz("kontoinhaber")} gesperrt={gesperrt} breite={260} hinweis="Name auf dem Konto" /></td></tr>
              <tr><td>Tätig für FIAON seit</td><td>22. Juli 2026</td></tr>
              <tr><td>Partnerstatus</td><td>Selbstständig, natürliche Person</td></tr>
            </tbody></table>
          </section>

          <div className="vb-praeambel">
            <p><b>Präambel.</b> Der Partner ist seit dem 22. Juli 2026 als selbstständiger Vertriebspartner
              für FIAON tätig. In diesem Zeitraum hat er 76 Mandate übernommen und 1.490 dokumentierte
              Kundenkontakte geführt; er gehört damit zu den tragenden Partnern des Vertriebs.</p>
            <p>FIAON befindet sich in einer Aufbauphase, in der Plattform, Arbeitsabläufe und
              Vergütungssystematik parallel zum laufenden Geschäft entwickelt werden. Erfahrene Partner,
              die nicht nur verkaufen, sondern mitdenken, Schwachstellen benennen und an der
              Weiterentwicklung mitwirken, sind dafür entscheidend.</p>
            <p>Vor diesem Hintergrund vereinbaren die Parteien eine auf zwölf Monate befristete garantierte
              Monatsprovision, die durch die in § 4 beschriebenen erweiterten Mitwirkungsleistungen
              abgegolten wird. Diese Vereinbarung ergänzt den bestehenden Vertriebspartnervertrag; dessen
              Regelungen gelten fort, soweit hier nichts Abweichendes bestimmt ist.</p>
          </div>

          <section className="vb-par">
            <h2><span className="vb-nr">§ 1</span> Gegenstand und Verhältnis zum Hauptvertrag</h2>
            <ol className="vb-abs">
              <li>Gegenstand dieser Vereinbarung ist eine befristete garantierte Monatsprovision zugunsten
                des Partners sowie die hierfür zu erbringenden erweiterten Mitwirkungsleistungen.</li>
              <li>Diese Vereinbarung ist eine Zusatzvereinbarung zum bestehenden Vertriebspartnervertrag
                („Hauptvertrag“). Der Hauptvertrag bleibt im Übrigen unberührt.</li>
              <li>Bei Widersprüchen geht diese Vereinbarung vor, jedoch ausschließlich für ihre Laufzeit
                und ausschließlich für die hier geregelten Gegenstände.</li>
            </ol>
          </section>

          <section className="vb-par">
            <h2><span className="vb-nr">§ 2</span> Laufzeit</h2>
            <ol className="vb-abs">
              <li>Diese Vereinbarung tritt am <b>1. September 2026</b> in Kraft und endet ohne Kündigung
                mit Ablauf des <b>31. August 2027</b>.</li>
              <li>Die Laufzeit umfasst zwölf volle Kalendermonate. Eine stillschweigende Verlängerung
                findet nicht statt.</li>
              <li>Beabsichtigt eine Partei die Fortsetzung, teilt sie dies spätestens einen Monat vor
                Ablauf in Textform mit. Eine Fortsetzung bedarf einer neuen schriftlichen Vereinbarung.</li>
              <li>Das Recht zur außerordentlichen Kündigung aus wichtigem Grund nach § 7 bleibt unberührt.</li>
            </ol>
          </section>

          <section className="vb-par">
            <h2><span className="vb-nr">§ 3</span> Garantierte Monatsprovision</h2>
            <ol className="vb-abs">
              <li>FIAON schreibt dem Provisionskonto des Partners für jeden vollen Kalendermonat der
                Laufzeit einen Betrag in Höhe von <b>2.000,00 EUR</b> (in Worten: zweitausend Euro) gut.
                <div className="vb-betrag">
                  <span className="vb-zahl">2.000,00 EUR je Monat</span>
                  <span className="vb-was">12 Gutschriften · Gesamtvolumen 24.000,00 EUR ·
                    erste Gutschrift zum 30. September 2026, letzte zum 31. August 2027</span>
                </div>
              </li>
              <li>Die Gutschrift erfolgt zum letzten Werktag des Kalendermonats auf das in der Plattform
                geführte Provisionskonto und ist dort unter „Earnings“ nachvollziehbar ausgewiesen.</li>
              <li>
                <b>Verhältnis zur laufenden Provision.</b> Die Parteien wählen:
                <div className="vb-wahl">
                  <p className="vb-wahl-kopf">Bitte eine Variante wählen</p>
                  {[
                    { key: "A", titel: "Variante A — zusätzlich",
                      text: "Die garantierte Monatsprovision tritt neben die nach dem Hauptvertrag verdiente laufende Provision. Eine Verrechnung findet nicht statt." },
                    { key: "B", titel: "Variante B — anrechenbar",
                      text: "Die garantierte Monatsprovision wird auf die im selben Kalendermonat verdiente laufende Provision angerechnet. Übersteigt die verdiente Provision den Garantiebetrag, wird nur der übersteigende Betrag zusätzlich gutgeschrieben. Ein Negativsaldo entsteht nicht." },
                  ].map((v) => (
                    <label key={v.key} className={`vb-wahl-zeile${variante === v.key ? " an" : ""}`}>
                      <input type="radio" name="variante" checked={variante === v.key}
                             disabled={gesperrt} onChange={() => setVariante(v.key)} />
                      <span><b>{v.titel}.</b> {v.text}</span>
                    </label>
                  ))}
                </div>
              </li>
              <li>Die Gutschrift versteht sich als Nettobetrag zuzüglich einer etwaig anfallenden
                Umsatzsteuer. Der Partner stellt FIAON monatlich eine ordnungsgemäße Rechnung;
                Zahlungsziel ist der 14. Kalendertag nach Rechnungseingang.</li>
              <li>Für die Abführung von Steuern und etwaiger Sozialversicherungsbeiträge auf die ihm
                zufließenden Beträge ist der Partner selbst verantwortlich.</li>
            </ol>
          </section>

          <section className="vb-par">
            <h2><span className="vb-nr">§ 4</span> Gegenleistung des Partners</h2>
            <ol className="vb-abs">
              <li>Der Partner verpflichtet sich, während der Laufzeit über die Pflichten des Hauptvertrags
                hinaus die nachfolgenden Leistungen zu erbringen. Sie sind die Gegenleistung für die
                garantierte Monatsprovision nach § 3.</li>
              <li><b>Erweiterter Vertriebseinsatz.</b> Der Partner bearbeitet die ihm über den Kundenpool
                zugewiesenen Vorgänge fortlaufend und mit erkennbar gesteigertem Einsatz gegenüber dem
                bisherigen Umfang.</li>
              <li><b>Mitdenken und Eigeninitiative.</b> Der Partner bringt Verbesserungsvorschläge zu
                Abläufen, Gesprächsleitfäden, Preisgestaltung und Kundenansprache aus eigener Initiative
                ein und beschränkt sich nicht auf die Ausführung vorgegebener Schritte.</li>
              <li><b>Rückmeldungen zur Plattform.</b> Der Partner meldet Fehler, Hindernisse und
                Verbesserungsmöglichkeiten strukturiert und nachvollziehbar. Jede Meldung nennt den
                betroffenen Bereich, das erwartete Verhalten, das tatsächliche Verhalten und — soweit
                möglich — den Weg zur Wiederholung. Mindestens eine gesammelte Rückmeldung je
                Kalendermonat; blockierende Fehler unverzüglich.</li>
              <li><b>Abstimmung mit Management und Geschäftsleitung.</b> Der Partner nimmt an den
                regelmäßigen Abstimmungen des Vertriebs teil und stimmt wesentliche Fragen der
                Kundenbearbeitung, der Zusagen gegenüber Kunden und der Preisgestaltung vorab mit der
                Vertriebsleitung ab. Die Termine werden im gegenseitigen Einvernehmen festgelegt; eine
                Weisungsgebundenheit hinsichtlich Arbeitszeit und Arbeitsort wird dadurch nicht
                begründet (§ 8).</li>
              <li><b>Sorgfalt in der Dokumentation.</b> Der Partner dokumentiert jedes Kundengespräch mit
                Ergebnis und Notiz in der Plattform. Zusagen gegenüber Kunden — insbesondere Zahlungs-
                und Rückruftermine — werden ausnahmslos mit Datum erfasst.</li>
              <li><b>Einarbeitung neuer Partner.</b> Der Partner steht auf Anfrage für die Einarbeitung
                neuer Vertriebspartner zur Verfügung, im Umfang von bis zu{" "}
                <Luecke name="einarbeitungStunden" wert={feld("einarbeitungStunden")}
                        setzen={setz("einarbeitungStunden")} gesperrt={gesperrt} breite={54} hinweis="Std." />{" "}
                Stunden je Kalendermonat.</li>
            </ol>
          </section>

          <section className="vb-par">
            <h2><span className="vb-nr">§ 5</span> Leistungsmaßstab</h2>
            <ol className="vb-abs">
              <li>Die Parteien legen den nachfolgenden Maßstab als Bezugsgröße fest. Die Ausgangswerte
                entsprechen der tatsächlichen Leistung des Partners vom 23. Juli bis 25. August 2026 und
                sind der Plattform entnommen.
                <div className="vb-tab-huelle">
                  <table className="vb-kennzahl">
                    <thead><tr><th>Kennzahl</th><th>Ausgangswert</th><th>Ziel je Monat</th></tr></thead>
                    <tbody>
                      <tr><td>Dokumentierte Kundenkontakte</td><td>1.490 in 34 Tagen</td><td>
                        <Luecke name="zielKontakte" wert={feld("zielKontakte")} setzen={setz("zielKontakte")} gesperrt={gesperrt} breite={70} hinweis="Anzahl" /></td></tr>
                      <tr><td>Übernommene Mandate</td><td>76 gesamt</td><td>
                        <Luecke name="zielMandate" wert={feld("zielMandate")} setzen={setz("zielMandate")} gesperrt={gesperrt} breite={70} hinweis="Anzahl" /></td></tr>
                      <tr><td>Geführte Termine</td><td>48 gesamt, davon 11 abgeschlossen</td><td>
                        <Luecke name="zielTermine" wert={feld("zielTermine")} setzen={setz("zielTermine")} gesperrt={gesperrt} breite={70} hinweis="Anzahl" /></td></tr>
                      <tr><td>Termine mit dokumentiertem Ergebnis</td><td>23 % der geführten Termine</td><td>mindestens 90 %</td></tr>
                      <tr><td>Rückmeldungen zur Plattform</td><td>—</td><td>mindestens 1</td></tr>
                    </tbody>
                  </table>
                </div>
              </li>
              <li>Die Zielwerte müssen sachlich begründet und erreichbar sein. Sie können einvernehmlich
                in Textform angepasst werden, insbesondere wenn sich Kundenpool, Marktlage oder
                Aufgabenverteilung wesentlich ändern.</li>
              <li>Ein Unterschreiten einzelner Zielwerte begründet für sich genommen keinen Anspruch auf
                Kürzung. Maßgeblich ist die Gesamtbetrachtung nach § 6.</li>
            </ol>
          </section>

          <section className="vb-par">
            <h2><span className="vb-nr">§ 6</span> Überprüfung, Kürzung und Rückforderung</h2>
            <ol className="vb-abs">
              <li>Die Parteien überprüfen die Erfüllung der Pflichten aus § 4 einmal je Kalenderquartal
                gemeinsam. Grundlage sind die in der Plattform dokumentierten Vorgänge.</li>
              <li>Erfüllt der Partner die Pflichten in einem Quartal nicht wesentlich, weist FIAON ihn in
                Textform darauf hin und benennt die konkreten Punkte. Der Partner erhält 30 Tage
                Gelegenheit zur Nachbesserung.</li>
              <li>Bleibt die Nachbesserung aus, kann FIAON die Monatsprovision für die folgenden Monate
                auf bis zu 50 % kürzen. Die Kürzung ist zu begründen und in Textform mitzuteilen.</li>
              <li>Bereits erfolgte Gutschriften bleiben unberührt und werden nicht zurückgefordert.
                Ausgenommen sind Gutschriften, die auf vorsätzlich unrichtigen Angaben beruhen.</li>
              <li>Kann der Partner aus von ihm nicht zu vertretenden Gründen vorübergehend nicht leisten
                — insbesondere bei Krankheit oder höherer Gewalt —, entfällt die Gutschrift für bis zu
                zwei Kalendermonate je Laufzeitjahr nicht. Die Verhinderung ist unverzüglich anzuzeigen.</li>
            </ol>
          </section>

          <section className="vb-par">
            <h2><span className="vb-nr">§ 7</span> Vorzeitige Beendigung</h2>
            <ol className="vb-abs">
              <li>Endet der Hauptvertrag, endet diese Vereinbarung zum selben Zeitpunkt, ohne dass es
                einer gesonderten Kündigung bedarf.</li>
              <li>Jede Partei kann aus wichtigem Grund fristlos kündigen. Ein wichtiger Grund liegt für
                FIAON insbesondere vor bei schwerwiegendem oder wiederholtem Verstoß gegen § 4 trotz
                Abmahnung, bei unrichtiger Dokumentation von Kundengesprächen oder Zahlungszusagen in der
                Absicht, Provisionsansprüche zu beeinflussen, sowie bei Verstoß gegen § 9 oder § 10.</li>
              <li>Die Kündigung bedarf der Textform. Bei Beendigung im Laufe eines Kalendermonats wird
                die Monatsprovision zeitanteilig gutgeschrieben.</li>
            </ol>
          </section>

          <section className="vb-par">
            <h2><span className="vb-nr">§ 8</span> Selbstständigkeit des Partners</h2>
            <ol className="vb-abs">
              <li>Der Partner ist selbstständiger Unternehmer. Ein Arbeits-, Dienst- oder
                Anstellungsverhältnis wird durch diese Vereinbarung nicht begründet und ist von den
                Parteien ausdrücklich nicht gewollt.</li>
              <li>Der Partner bestimmt Arbeitszeit, Arbeitsort und Arbeitsweise eigenverantwortlich. Die
                Abstimmungen nach § 4 Abs. 5 dienen der fachlichen Koordination und begründen keine
                Weisungsgebundenheit.</li>
              <li>Der Partner ist nicht verpflichtet, ausschließlich für FIAON tätig zu sein. Er darf für
                weitere Auftraggeber arbeiten, soweit keine Wettbewerbsverstöße nach § 11 entstehen.</li>
              <li>Der Partner setzt eigene Betriebsmittel ein. Von FIAON bereitgestellte Plattform-Zugänge
                sind zur Erfüllung dieser Vereinbarung erforderlich und begründen keine Eingliederung in
                die Betriebsorganisation.</li>
              <li>Der Partner ist für die Anmeldung seiner selbstständigen Tätigkeit, die Abführung von
                Steuern und den Abschluss etwaig erforderlicher Versicherungen selbst verantwortlich.</li>
              <li>Auf Verlangen einer Partei wirken beide an einem Statusfeststellungsverfahren nach
                § 7a SGB IV mit.</li>
            </ol>
          </section>

          <section className="vb-par">
            <h2><span className="vb-nr">§ 9</span> Verschwiegenheit</h2>
            <ol className="vb-abs">
              <li>Der Partner bewahrt über alle ihm bekannt werdenden Geschäfts- und Betriebsgeheimnisse
                Stillschweigen. Dazu zählen insbesondere Kundendaten, Preis- und Provisionsstrukturen,
                Gesprächsleitfäden, Kennzahlen und der Aufbau der Plattform.</li>
              <li>Der Inhalt dieser Vereinbarung, insbesondere die Höhe der garantierten Monatsprovision,
                ist vertraulich. Ausgenommen sind zur Verschwiegenheit verpflichtete Berufsträger sowie
                gesetzliche Offenlegungspflichten.</li>
              <li>Die Verpflichtung besteht über das Ende dieser Vereinbarung hinaus fort.</li>
            </ol>
          </section>

          <section className="vb-par">
            <h2><span className="vb-nr">§ 10</span> Datenschutz</h2>
            <ol className="vb-abs">
              <li>Der Partner verarbeitet personenbezogene Daten von Kunden ausschließlich im Rahmen der
                ihm zugewiesenen Vorgänge und ausschließlich innerhalb der FIAON-Plattform.</li>
              <li>Das Speichern, Kopieren oder Übertragen von Kundendaten auf private Geräte, in private
                Verzeichnisse oder an Dritte ist untersagt.</li>
              <li>Der Partner hält die Vorgaben der Datenschutz-Grundverordnung sowie die Anweisungen von
                FIAON zum Umgang mit Kundendaten ein.</li>
              <li>Bei Beendigung löscht der Partner sämtliche in seinem Besitz befindlichen Kundendaten
                und bestätigt dies auf Verlangen in Textform.</li>
            </ol>
          </section>

          <section className="vb-par">
            <h2><span className="vb-nr">§ 11</span> Wettbewerb und Abwerbung</h2>
            <ol className="vb-abs">
              <li>Der Partner wird während der Laufzeit nicht für Unternehmen tätig, die mit FIAON in
                unmittelbarem Wettbewerb stehen.</li>
              <li>Der Partner wird während der Laufzeit und für zwölf Monate danach keine Kunden von
                FIAON für eigene oder fremde Rechnung abwerben und keine Partner oder Mitarbeitenden
                von FIAON abwerben.</li>
              <li>Für jeden Fall der schuldhaften Zuwiderhandlung gegen Absatz 2 wird eine Vertragsstrafe
                in Höhe von{" "}
                <Luecke name="vertragsstrafe" wert={feld("vertragsstrafe")} setzen={setz("vertragsstrafe")}
                        gesperrt={gesperrt} breite={100} hinweis="Betrag" /> EUR vereinbart. Die
                Geltendmachung eines darüber hinausgehenden Schadens bleibt vorbehalten.</li>
            </ol>
          </section>

          <section className="vb-par">
            <h2><span className="vb-nr">§ 12</span> Schlussbestimmungen</h2>
            <ol className="vb-abs">
              <li>Änderungen und Ergänzungen bedürfen der Textform. Dies gilt auch für die Änderung
                dieser Textformklausel.</li>
              <li>Mündliche Nebenabreden bestehen nicht.</li>
              <li>Sollte eine Bestimmung unwirksam sein oder werden, bleibt die Wirksamkeit der übrigen
                Bestimmungen unberührt. Die Parteien ersetzen die unwirksame Bestimmung durch eine
                wirksame, die dem wirtschaftlich Gewollten am nächsten kommt.</li>
              <li>Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.</li>
              <li>Ausschließlicher Gerichtsstand ist{" "}
                <Luecke name="gerichtsstand" wert={feld("gerichtsstand")} setzen={setz("gerichtsstand")}
                        gesperrt={gesperrt} breite={170} hinweis="Ort" />, soweit der Partner
                Unternehmer ist und eine Gerichtsstandsvereinbarung zulässig getroffen werden kann.</li>
              <li>Diese Vereinbarung wird elektronisch geschlossen. Beide Parteien erhalten eine
                Ausfertigung in Textform.</li>
            </ol>
          </section>

          {/* ── Anmerkungen ────────────────────────────────────────────── */}
          <section className="vb-par">
            <h2><span className="vb-nr">§ 13</span> Anmerkungen des Partners</h2>
            <p className="vb-satz">
              Falls Sie zu einzelnen Punkten Anmerkungen, Rückfragen oder abweichende Vorstellungen
              haben, halten Sie sie hier fest. Ihre Anmerkungen werden Bestandteil der Akte und von der
              Geschäftsleitung vor der Gegenzeichnung gelesen.
            </p>
            {gesperrt ? (
              <div className="vb-anmerkung-fest">{anmerkungen.trim() || "— keine Anmerkungen —"}</div>
            ) : (
              <textarea className="vb-anmerkung" value={anmerkungen} rows={6}
                        onChange={(e) => setAnmerkungen(e.target.value)}
                        placeholder="Optional. Zum Beispiel: Wünsche zu den Zielwerten in § 5, zur Laufzeit oder zum Turnus der Abstimmung." />
            )}
          </section>

          {/* ── Unterschrift ───────────────────────────────────────────── */}
          <div className="vb-schluss">
            <p className="vb-schluss-satz">
              Die Parteien haben diese Vereinbarung gelesen, verstanden und erklären sich mit ihrem
              Inhalt einverstanden.
            </p>

            {!gesperrt && (
              <div className="vb-signieren">
                <label className="vb-sig-label" htmlFor="vb-sig">
                  Unterschrift — bitte Ihren vollständigen Namen eintippen
                </label>
                <input id="vb-sig" className="vb-sig-feld" value={unterschrift}
                       onChange={(e) => setUnterschrift(e.target.value)}
                       placeholder="Vor- und Nachname" autoComplete="off" />
                <label className="vb-bestaetigen">
                  <input type="checkbox" checked={gelesen} onChange={(e) => setGelesen(e.target.checked)} />
                  <span>
                    Ich habe die Vereinbarung vollständig gelesen und verstanden, meine Angaben sind
                    richtig, und ich unterzeichne sie rechtsverbindlich in elektronischer Form.
                  </span>
                </label>
                {fehler && <p className="vb-fehler" role="alert">{fehler}</p>}
                <button type="button" className="vb-knopf gross" disabled={busy || !gelesen || unterschrift.trim().length < 4}
                        onClick={() => void unterzeichnen()}>
                  {busy ? "Wird unterzeichnet …" : "Rechtsverbindlich unterzeichnen"}
                </button>
                <p className="vb-sig-fuss">
                  Mit dem Absenden werden Ihr Name, der Zeitpunkt und Ihre IP-Adresse protokolliert.
                  Danach ist der Inhalt festgeschrieben.
                  {gespeichert && <> · Zwischenstand gesichert um {gespeichert} Uhr.</>}
                </p>
              </div>
            )}

            <div className="vb-unter">
              <div className="vb-feld">
                <div className="vb-strich" />
                <p className="vb-wer">Justin Schwarzott</p>
                <p className="vb-rolle2">für die FIAON LTD</p>
              </div>
              <div className="vb-feld">
                <div className={`vb-strich${fertig ? " signiert" : ""}`}>
                  {fertig && <span className="vb-hand">{unterschrift}</span>}
                </div>
                <p className="vb-wer">Nikita Boychenko</p>
                <p className="vb-rolle2">
                  {fertig
                    ? `Elektronisch unterzeichnet am ${new Date(fertig.am).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })}`
                    : "Vertriebspartner"}
                </p>
              </div>
            </div>
          </div>

          <footer className="vb-fuss">
            FIAON LTD · Company No. 17318250 · 128 City Road, London EC1V 2NX ·
            Vertraulich. Dieses Dokument ist ausschließlich für den benannten Empfänger bestimmt.
          </footer>

        </div>
      </div>
    </main>
  );
}
