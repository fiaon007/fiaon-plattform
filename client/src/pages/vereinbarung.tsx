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
  // ── ZWEI STUFEN (26.08.2026) ─────────────────────────────────────────────
  // Justin: „Florentine muss es zuerst lesen, Feedback geben ODER direkt
  // abschließen … Erst dann soll Nikita unterzeichnen können."
  // Dieselbe Seite, zwei Codes, zwei Rollen — der Text bleibt identisch,
  // nur der Schluss unterscheidet sich. Zwei getrennte Seiten hießen zwei
  // Fassungen desselben Vertrags, und irgendwann wären sie verschieden.
  const [rolle, setRolle] = useState<"leitung" | "partner">("partner");
  const [leitung, setLeitung] = useState<{ am: string | null; name: string | null; urteil: string | null; feedback: string | null }>(
    { am: null, name: null, urteil: null, feedback: null });
  const [ltName, setLtName] = useState("");
  const [ltFeedback, setLtFeedback] = useState("");
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
    setRolle(r.json.rolle === "leitung" ? "leitung" : "partner");
    setA(v.angaben || {});
    setAnmerkungen(v.anmerkungen || "");
    setLeitung({ am: v.leitungAm ?? null, name: v.leitungName ?? null, urteil: v.leitungUrteil ?? null, feedback: v.leitungFeedback ?? null });
    if (v.leitungName) setLtName(v.leitungName);
    if (v.leitungFeedback) setLtFeedback(v.leitungFeedback);
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
      void ruf("/vereinbarung/speichern", { code, angaben: a, anmerkungen })
        .then((r) => { if (r.ok) setGespeichert(new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })); });
    }, 1200);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [a, anmerkungen, offen, gesperrt, code]);

  const unterzeichnen = async () => {
    setBusy(true); setFehler(null);
    const r = await ruf("/vereinbarung/unterzeichnen", {
      code, angaben: a, anmerkungen, gelesen, unterschriftName: unterschrift,
    });
    setBusy(false);
    if (!r.ok) { setFehler(r.json?.error || "Das hat nicht geklappt."); return; }
    setFertig({ am: r.json.unterzeichnetAm, pruefsumme: r.json.pruefsumme || "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const leitungSenden = async (urteil: "freigabe" | "rueckmeldung") => {
    setBusy(true); setFehler(null);
    const r = await ruf("/vereinbarung/leitung", { code, urteil, name: ltName, feedback: ltFeedback });
    setBusy(false);
    if (!r.ok) { setFehler(r.json?.error || "Das hat nicht geklappt."); return; }
    setLeitung({ am: urteil === "freigabe" ? new Date().toISOString() : null, name: urteil === "freigabe" ? ltName : null, urteil, feedback: ltFeedback || null });
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
                Lade dir die unterzeichnete Fassung für deine Unterlagen herunter. Die Geschäftsführung
                erhält eine gleichlautende Ausfertigung.
              </p>
              {/* Der Druckdialog des Browsers erzeugt das PDF — mit der
                  Druckfassung dieser Seite (siehe @media print). Ein eigener
                  PDF-Erzeuger auf dem Server wäre eine zweite Fassung des
                  Vertrags, die irgendwann von dieser abweicht. */}
              <button type="button" className="vb-knopf" style={{ width: "auto", padding: "0 26px", marginTop: 4 }}
                      onClick={() => window.print()}>
                Als PDF herunterladen
              </button>
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
            <h2><span className="vb-nr">§ 3</span> Vergütung</h2>
            <ol className="vb-abs">
              <li><b>Garantierte Monatsprovision.</b> FIAON schreibt dem Provisionskonto des Partners
                für jeden vollen Kalendermonat der Laufzeit einen Betrag in Höhe von <b>2.000,00 EUR</b>
                (in Worten: zweitausend Euro) gut. Die Gutschrift erfolgt jeweils zum <b>letzten Tag des
                Kalendermonats</b>, erstmals zum 30. September 2026, letztmals zum 31. August 2027.
                <div className="vb-betrag">
                  <span className="vb-zahl">2.000,00 EUR je Monat</span>
                  <span className="vb-was">12 Gutschriften · Gesamtvolumen 24.000,00 EUR</span>
                </div>
              </li>
              <li><b>Erhöhte Abschlussprovision.</b> Der Provisionssatz des Partners auf die von ihm
                vermittelten Pakete wird für die Laufzeit dieser Vereinbarung von 20 % auf
                <b> 35 %</b> erhöht. Bemessungsgrundlage bleibt unverändert die tatsächlich vom Kunden
                gezahlte Rate; der Anspruch entsteht mit dem Zahlungseingang.
                <div className="vb-betrag">
                  <span className="vb-zahl">35 % statt 20 %</span>
                  <span className="vb-was">auf jede bezahlte Rate · unverändert zwölf Monate je Mandat</span>
                </div>
              </li>
              <li><b>Beides nebeneinander.</b> Die garantierte Monatsprovision nach Absatz 1 und die
                Abschlussprovision nach Absatz 2 treten <b>zusätzlich</b> nebeneinander. Eine Verrechnung
                findet nicht statt; die Monatsprovision ist kein Vorschuss und wird nicht angerechnet.</li>
              <li>Alle übrigen Bestimmungen des Hauptvertrags zur Vergütung — insbesondere die Dauer
                des Provisionsanspruchs je Mandat, die Behandlung von Rücklastschriften und Stornierungen
                sowie die Auszahlungsregeln — bleiben unverändert.</li>
              <li>Die Gutschriften verstehen sich als Nettobeträge zuzüglich einer etwaig anfallenden
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
                neuer Vertriebspartner zur Verfügung, im Umfang von bis zu <b>20 Stunden je
                Kalendermonat</b>. Die zeitliche Lage bestimmt er selbst; FIAON meldet den Bedarf
                mindestens drei Werktage im Voraus an.</li>
            </ol>
          </section>

          <section className="vb-par">
            <h2><span className="vb-nr">§ 5</span> Leistungsmaßstab</h2>
            <ol className="vb-abs">
              <li><b>Die maßgebliche Größe.</b> Maßstab ist der <b>monatliche Zahlungseingang</b> aus
                den vom Partner betreuten Kunden — also das Geld, das tatsächlich bei FIAON ankommt.
                Anrufe, Termine und Gesprächszahlen sind Mittel zum Zweck und werden nicht als
                Zielgröße vereinbart: Sie lassen sich erfüllen, ohne dass ein Euro fließt.</li>
              <li><b>Die Rechnung, auf der dieser Maßstab beruht.</b> Beide Parteien legen sie
                offen, damit die Zahl nachvollziehbar ist und nicht verhandelt werden muss:
                <div className="vb-tab-huelle">
                  <table className="vb-kennzahl">
                    <thead><tr><th>Monatlicher Zahlungseingang</th><th>Partner erhält</th><th>Bei FIAON verbleibt</th></tr></thead>
                    <tbody>
                      <tr><td>3.077 EUR</td><td>3.077 EUR</td><td>0 EUR — Verlustschwelle</td></tr>
                      <tr><td>4.500 EUR</td><td>3.575 EUR</td><td>925 EUR</td></tr>
                      <tr><td><b>6.000 EUR</b></td><td><b>4.100 EUR</b></td><td><b>1.900 EUR</b></td></tr>
                      <tr><td>7.500 EUR</td><td>4.625 EUR</td><td>2.875 EUR</td></tr>
                    </tbody>
                  </table>
                </div>
                <p className="vb-satz" style={{ marginTop: 10 }}>
                  Unterhalb von 3.077 EUR monatlichem Zahlungseingang trägt FIAON die Vereinbarung
                  aus eigener Substanz. Die Beträge in der Spalte rechts verstehen sich vor allen
                  übrigen Kosten (Zahlungsabwicklung, Bezug der Auskünfte, Betrieb der Plattform).
                </p>
              </li>
              <li><b>Der vereinbarte Zielwert.</b> Die Parteien vereinbaren einen monatlichen
                Zahlungseingang von <b>6.000,00 EUR</b> aus den vom Partner betreuten Kunden.
                <div className="vb-betrag">
                  <span className="vb-zahl">6.000 EUR Zahlungseingang je Monat</span>
                  <span className="vb-was">
                    Bester bisheriger Monat des Partners: 5.381,19 EUR (August 2026, aus der Plattform).
                    Der Zielwert liegt 11 % darüber und entspricht rund 91 bezahlten Raten
                    bei einem Durchschnitt von 65,62 EUR.
                  </span>
                </div>
              </li>
              <li><b>Begleitende Kennzahlen.</b> Sie beschreiben die Arbeitsweise, nicht das Ergebnis,
                und lösen für sich genommen keine Rechtsfolge aus:
                <ol className="vb-buchst">
                  <li>mindestens 20 neu übernommene Mandate je Kalendermonat,</li>
                  <li>mindestens 90 % der geführten Termine mit dokumentiertem Ergebnis
                    (Ausgangswert 23 %),</li>
                  <li>mindestens eine gesammelte Rückmeldung zur Plattform je Kalendermonat.</li>
                </ol>
              </li>
              <li><b>Anpassung.</b> Der Zielwert kann einvernehmlich in Textform angepasst werden,
                insbesondere wenn sich die Zusammensetzung des Kundenpools, die Preisgestaltung oder
                die Marktlage wesentlich ändern. Kürzt FIAON den Nachschub aus dem Kundenpool, ist der
                Zielwert für den betroffenen Zeitraum entsprechend herabzusetzen.</li>
              <li><b>Nachweis.</b> Grundlage ist ausschließlich die in der FIAON-Plattform
                dokumentierte Zahlungshistorie. Der Partner kann sie im Bereich „Earnings" jederzeit
                einsehen.</li>
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
            <h2><span className="vb-nr">§ 8</span> Selbstständigkeit und Haftung</h2>
            <ol className="vb-abs">
              <li>Der Partner ist <b>selbstständiger Unternehmer</b>. Ein Arbeits-, Dienst- oder
                Anstellungsverhältnis wird durch diese Vereinbarung nicht begründet und ist von beiden
                Parteien ausdrücklich nicht gewollt.</li>
              <li><b>Wie, wann und wo er arbeitet, bestimmt allein der Partner.</b> Er unterliegt
                keinen Weisungen zu Arbeitszeit, Arbeitsort, Arbeitsmenge oder Arbeitsweise. Er ist zu
                keiner Anwesenheit verpflichtet, führt keine Arbeitszeiten und ist an keine Schichten,
                Kernzeiten oder Anwesenheitspläne gebunden.</li>
              <li>Die Abstimmungen nach § 4 Abs. 5 dienen ausschließlich der fachlichen Koordination
                und dem Informationsaustausch. Termine werden im gegenseitigen Einvernehmen gelegt;
                eine Teilnahmepflicht zu einer von FIAON einseitig bestimmten Zeit besteht nicht.</li>
              <li>Der Partner ist <b>nicht verpflichtet, ausschließlich für FIAON</b> tätig zu sein.
                Er darf für weitere Auftraggeber arbeiten, soweit dadurch keine Wettbewerbsverstöße
                nach § 11 entstehen.</li>
              <li>Der Partner setzt eigene Betriebsmittel ein und trägt sein eigenes Unternehmerrisiko.
                Von FIAON bereitgestellte Plattform-Zugänge sind zur Erfüllung dieser Vereinbarung
                erforderlich und begründen keine Eingliederung in die Betriebsorganisation.</li>
              <li>Er darf sich zur Erfüllung seiner Leistungen <b>Erfüllungsgehilfen bedienen</b>,
                soweit diese die Pflichten aus §§ 9 und 10 schriftlich übernehmen.</li>
              <li><b>Haftung.</b> Der Partner haftet für sein Handeln gegenüber Dritten selbst. Er
                stellt FIAON von Ansprüchen Dritter frei, die auf einer Pflichtverletzung, einer
                unzutreffenden Auskunft oder einer über den Leistungsumfang von FIAON hinausgehenden
                Zusage des Partners beruhen. Insbesondere ist der Partner nicht befugt, gegenüber
                Kunden rechtliche Beratung zu erbringen, Erfolgszusagen zu geben oder Preise außerhalb
                des von FIAON veröffentlichten Katalogs zu vereinbaren.</li>
              <li>Der Partner ist für die Anmeldung seiner selbstständigen Tätigkeit, die Abführung
                von Steuern und den Abschluss etwaig erforderlicher Versicherungen — einschließlich
                einer Berufshaftpflicht — selbst verantwortlich.</li>
              <li>Beide Parteien wirken auf Verlangen einer Partei an einem Statusfeststellungsverfahren
                nach § 7a SGB IV mit.</li>
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
              <li>Für jeden Fall der schuldhaften Zuwiderhandlung gegen Absatz 1 oder Absatz 2 wird
                eine Vertragsstrafe in Höhe von <b>50.000,00 EUR</b> (in Worten: fünfzigtausend Euro)
                vereinbart. Die Geltendmachung eines darüber hinausgehenden Schadens sowie
                Unterlassungsansprüche bleiben vorbehalten.
                <div className="vb-betrag">
                  <span className="vb-zahl">50.000,00 EUR</span>
                  <span className="vb-was">
                    je schuldhaftem Verstoß · Der Betrag bemisst sich am Wert der betroffenen
                    Kundenbeziehungen und der Kenntnis über Preis- und Provisionsstruktur.
                  </span>
                </div>
              </li>
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

          {/* ── Unterschriften ─────────────────────────────────────────── */}
          <div className="vb-schluss">
            <p className="vb-schluss-satz">
              Die Parteien haben diese Vereinbarung gelesen, verstanden und erklären sich mit ihrem
              Inhalt einverstanden.
            </p>

            {/* Die drei Unterschriften in der Reihenfolge, in der sie entstehen. */}
            <div className="vb-unter drei">
              <div className="vb-feld">
                <div className="vb-strich signiert"><span className="vb-hand">Justin Schwarzott</span></div>
                <p className="vb-wer">Justin Schwarzott</p>
                <p className="vb-rolle2">Geschäftsführer, FIAON LTD · gezeichnet am 26. August 2026</p>
              </div>
              <div className="vb-feld">
                <div className={`vb-strich${leitung.am ? " signiert" : ""}`}>
                  {leitung.am && <span className="vb-hand">{leitung.name}</span>}
                </div>
                <p className="vb-wer">Florentine Lombardi</p>
                <p className="vb-rolle2">
                  {leitung.am
                    ? `Künftige Geschäftsführerin · gegengezeichnet am ${new Date(leitung.am).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })}`
                    : "Künftige Geschäftsführerin · Gegenzeichnung ausstehend"}
                </p>
              </div>
              <div className="vb-feld">
                <div className={`vb-strich${fertig ? " signiert" : ""}`}>
                  {fertig && <span className="vb-hand">{unterschrift}</span>}
                </div>
                <p className="vb-wer">Nikita Boychenko</p>
                <p className="vb-rolle2">
                  {fertig
                    ? `Vertriebspartner · unterzeichnet am ${new Date(fertig.am).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })}`
                    : "Vertriebspartner"}
                </p>
              </div>
            </div>

            {/* ── STUFE 1: Die Geschäftsführung entscheidet ─────────────── */}
            {rolle === "leitung" && !fertig && (
              <div className="vb-signieren" style={{ marginTop: 38 }}>
                <p className="vb-sig-label">Für die Geschäftsführung — Florentine Lombardi</p>
                <p className="vb-satz" style={{ marginBottom: 16 }}>
                  Bitte lies die Vereinbarung vollständig. Du hast zwei Wege: Du zeichnest sie gegen —
                  dann kann Nikita unterschreiben. Oder du schreibst auf, was geändert werden soll —
                  dann bleibt seine Unterschrift gesperrt, bis nachgebessert ist.
                </p>

                {leitung.urteil === "rueckmeldung" && (
                  <div className="vb-hinweis" style={{ margin: "0 0 18px" }}>
                    <p className="vb-hinweis-kopf">Deine Rückmeldung liegt vor</p>
                    <p style={{ whiteSpace: "pre-wrap" }}>{leitung.feedback}</p>
                  </div>
                )}
                {leitung.urteil === "freigabe" && leitung.am && (
                  <div className="vb-fertig" style={{ margin: "0 0 18px" }} role="status">
                    <p className="vb-fertig-kopf">Gegengezeichnet</p>
                    <p>Du hast am {new Date(leitung.am).toLocaleString("de-DE", { dateStyle: "long", timeStyle: "short" })} freigegeben. Nikita kann jetzt unterschreiben.</p>
                  </div>
                )}

                <label className="vb-sig-label" htmlFor="lt-fb" style={{ marginTop: 4 }}>
                  Anmerkungen {leitung.urteil === "freigabe" ? "(optional)" : "— was soll geändert werden?"}
                </label>
                <textarea id="lt-fb" className="vb-anmerkung" rows={5} value={ltFeedback}
                          onChange={(e) => setLtFeedback(e.target.value)}
                          placeholder="Zum Beispiel: Zielwert in § 5, Laufzeit, Vertragsstrafe in § 11 …" />

                <label className="vb-sig-label" htmlFor="lt-name" style={{ marginTop: 18 }}>
                  Unterschrift — vollständiger Name
                </label>
                <input id="lt-name" className="vb-sig-feld" value={ltName} autoComplete="off"
                       onChange={(e) => setLtName(e.target.value)} placeholder="Florentine Lombardi" />

                {fehler && <p className="vb-fehler" role="alert">{fehler}</p>}

                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
                  <button type="button" className="vb-knopf gross" style={{ marginTop: 0 }}
                          disabled={busy || ltName.trim().length < 4}
                          onClick={() => void leitungSenden("freigabe")}>
                    {busy ? "Zeichnet gegen …" : "Gegenzeichnen und freigeben"}
                  </button>
                  <button type="button" className="vb-knopf gross still" style={{ marginTop: 0 }}
                          disabled={busy || ltFeedback.trim().length < 10}
                          onClick={() => void leitungSenden("rueckmeldung")}>
                    Rückmeldung an Justin
                  </button>
                </div>
                <p className="vb-sig-fuss">
                  Bei einer Rückmeldung bleibt Nikitas Unterschrift gesperrt. Bei einer Freigabe wird
                  Zeitpunkt und IP-Adresse protokolliert.
                </p>
              </div>
            )}

            {/* ── STUFE 2: Der Partner unterzeichnet ────────────────────── */}
            {rolle === "partner" && !fertig && !leitung.am && (
              <div className="vb-warten" role="status">
                <p className="vb-warten-kopf">Noch nicht freigegeben</p>
                <p>
                  Die Geschäftsführung prüft die Vereinbarung derzeit. Du kannst sie vollständig lesen
                  und deine Angaben bereits eintragen — sie werden gespeichert. Sobald gegengezeichnet
                  ist, erscheint hier das Unterschriftsfeld.
                </p>
              </div>
            )}

            {rolle === "partner" && !fertig && leitung.am && (
              <div className="vb-signieren" style={{ marginTop: 38 }}>
                <label className="vb-sig-label" htmlFor="vb-sig">
                  Unterschrift — bitte deinen vollständigen Namen eintippen
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
                <button type="button" className="vb-knopf gross"
                        disabled={busy || !gelesen || unterschrift.trim().length < 4}
                        onClick={() => void unterzeichnen()}>
                  {busy ? "Wird unterzeichnet …" : "Rechtsverbindlich unterzeichnen"}
                </button>
                <p className="vb-sig-fuss">
                  Mit dem Absenden werden dein Name, der Zeitpunkt und deine IP-Adresse protokolliert.
                  Danach ist der Inhalt festgeschrieben.
                  {gespeichert && <> · Zwischenstand gesichert um {gespeichert} Uhr.</>}
                </p>
              </div>
            )}
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
