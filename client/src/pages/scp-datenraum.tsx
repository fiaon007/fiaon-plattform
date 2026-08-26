// ═══════════════════════════════════════════════════════════════════════════
// DATENRAUM — Schwarzott Capital Partners AG  ·  /scp-datenraum
//
// Gebaut im Auftrag der Schwarzott Capital Partners AG, Zürich. FIAON stellt
// die Technik; Inhalt, Unterlagen und Zeichnungsvorgang verantwortet SCP.
//
// ── DIE GESTALTUNG ────────────────────────────────────────────────────────
// Weiss und Gold, wie von SCP vorgegeben. Das ist eine anspruchsvolle
// Kombination: Gold wird schnell billig, wenn man es flächig einsetzt. Hier
// trägt es deshalb nur die Linien, die Kapitälchen und die Ziffern — Fläche
// bleibt Papier. Die Schrift bewegt sich beim Erscheinen (Wort für Wort,
// nicht Buchstabe für Buchstabe: Buchstabenanimationen wirken bei deutschen
// Komposita zappelig), und sie bewegt sich genau einmal.
//
// ── DIE REIHENFOLGE, IN DER EIN MENSCH HIER ARBEITET ──────────────────────
//   1. Eintreten     — Name, Firma, E-Mail, Telefon, Einladungscode.
//   2. Lesen         — Gesellschaft, Unterlagen, Bedingungen.
//   3. Erklären      — Zeichnungsbetrag und Anmerkungen.
//   4. Unterzeichnen — Name tippen, zwei Bestätigungen, senden.
//   5. Verwahren     — Ausfertigung als PDF.
//
// ── WAS DIESER RAUM NICHT LEISTET ─────────────────────────────────────────
// Er erzeugt eine EINFACHE elektronische Signatur. Ob das für den konkreten
// Zeichnungsschein genügt, entscheidet SCP mit ihren Berufsträgern — der
// Hinweis steht ausdrücklich über dem Unterschriftsfeld, damit niemand mehr
// hineinliest, als hier geschieht.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import "@/styles/scp-datenraum.css";

const API = "/api/fiaon";

async function ruf(pfad: string, koerper?: unknown, art: "GET" | "POST" = "POST") {
  const r = await fetch(`${API}${pfad}`, {
    method: art,
    credentials: "include",
    headers: koerper ? { "Content-Type": "application/json" } : undefined,
    body: koerper ? JSON.stringify(koerper) : undefined,
  });
  const json = await r.json().catch(() => null);
  return { status: r.status, ok: r.ok && json?.ok, json };
}

/**
 * Schrift, die beim Erscheinen wächst — Wort für Wort.
 * Buchstabenweise Animationen zerreissen deutsche Komposita optisch
 * („Zeich-nungs-schein"); Wörter bleiben lesbar.
 */
function Wortlauf({ text, als: Als = "h1", klasse = "", takt = 70 }: {
  text: string; als?: any; klasse?: string; takt?: number;
}) {
  const woerter = text.split(" ");
  return (
    <Als className={`scp-lauf ${klasse}`}>
      {woerter.map((w, i) => (
        <span key={i} style={{ animationDelay: `${i * takt}ms` }}>{w}&nbsp;</span>
      ))}
    </Als>
  );
}

/** Eine Zeile im Firmenspiegel. */
function Zeile({ was, wert }: { was: string; wert: React.ReactNode }) {
  return (
    <div className="scp-zeile">
      <span className="scp-zeile-was">{was}</span>
      <span className="scp-zeile-wert">{wert}</span>
    </div>
  );
}

type Gast = { name: string; firma: string | null; email: string; telefon: string };
type Zeichnung = {
  dokument: string; anmerkungen: string | null; betragChf: string | null;
  unterschrift: string | null; unterzeichnetAm: string | null;
};

const DOKUMENT = "zeichnungsschein";

export default function ScpDatenraum(): JSX.Element {
  const [laedt, setLaedt] = useState(true);
  const [gast, setGast] = useState<Gast | null>(null);
  const [zeichnung, setZeichnung] = useState<Zeichnung | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Anmeldung
  const [name, setName] = useState("");
  const [firma, setFirma] = useState("");
  const [email, setEmail] = useState("");
  const [telefon, setTelefon] = useState("");
  const [code, setCode] = useState("");

  // Zeichnung
  const [betrag, setBetrag] = useState("");
  const [anmerkungen, setAnmerkungen] = useState("");
  const [unterschrift, setUnterschrift] = useState("");
  const [gelesen, setGelesen] = useState(false);
  const [risiko, setRisiko] = useState(false);
  const [gespeichert, setGespeichert] = useState<string | null>(null);

  const fertig = !!zeichnung?.unterzeichnetAm;

  // ── DIE SCHRIFT NUR HIER LADEN ──────────────────────────────────────────
  // Cormorant Garamond trägt SCPs Erscheinungsbild. Im globalen index.html
  // stünde sie auf JEDER FIAON-Seite im Ladepfad, obwohl sie dort nie
  // gebraucht wird — eine fremde Marke darf unsere eigenen Seiten nicht
  // langsamer machen.
  useEffect(() => {
    const id = "scp-schrift";
    if (document.getElementById(id)) return;
    const l = document.createElement("link");
    l.id = id;
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&display=swap";
    document.head.appendChild(l);
  }, []);

  useEffect(() => {
    void ruf("/scp/stand", undefined, "GET").then((r) => {
      setLaedt(false);
      if (!r.ok || !r.json?.angemeldet) return;
      setGast(r.json.gast);
      const z = (r.json.zeichnungen || []).find((x: Zeichnung) => x.dokument === DOKUMENT) || null;
      if (z) {
        setZeichnung(z);
        setBetrag(z.betragChf ? String(z.betragChf) : "");
        setAnmerkungen(z.anmerkungen || "");
        setUnterschrift(z.unterschrift || "");
      }
    });
  }, []);

  const anmelden = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setFehler(null);
    const r = await ruf("/scp/anmelden", { name, firma, email, telefon, code });
    setBusy(false);
    if (!r.ok) { setFehler(r.json?.error || "Der Zugang war nicht möglich."); return; }
    setGast(r.json.gast);
    if (!unterschrift) setUnterschrift(r.json.gast.name);
  };

  // Stilles Sichern, solange nicht unterzeichnet ist.
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (!gast || fertig) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void ruf("/scp/anmerkungen", { dokument: DOKUMENT, anmerkungen, betragChf: betrag })
        .then((r) => { if (r.ok) setGespeichert(new Date().toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })); });
    }, 1200);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [anmerkungen, betrag, gast, fertig]);

  const unterzeichnen = async () => {
    setBusy(true); setFehler(null);
    const r = await ruf("/scp/unterzeichnen", {
      dokument: DOKUMENT, unterschrift, anmerkungen, betragChf: betrag, gelesen, risiko,
    });
    setBusy(false);
    if (!r.ok) { setFehler(r.json?.error || "Die Zeichnung war nicht möglich."); return; }
    setZeichnung({
      dokument: DOKUMENT, anmerkungen, betragChf: betrag || null,
      unterschrift, unterzeichnetAm: r.json.unterzeichnetAm,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (laedt) {
    return <main className="scp-warte"><span className="scp-marke-klein">SCHWARZOTT CAPITAL PARTNERS</span></main>;
  }

  // ── Der Eingang ──────────────────────────────────────────────────────────
  if (!gast) {
    return (
      <main className="scp-eingang">
        <div className="scp-eingang-schmuck" aria-hidden="true" />
        <div className="scp-eingang-karte">
          <p className="scp-marke">SCHWARZOTT<span>CAPITAL PARTNERS AG</span></p>
          <div className="scp-linie" />
          <Wortlauf text="Datenraum" als="h1" klasse="scp-h1" />
          <p className="scp-eingang-satz">
            Dieser Bereich ist ausschliesslich geladenen Gästen zugänglich. Bitte hinterlegen Sie
            Ihre Angaben — sie werden Bestandteil der Zeichnungsunterlagen.
          </p>

          <form onSubmit={anmelden} className="scp-form">
            <label className="scp-label" htmlFor="scp-name">Vollständiger Name</label>
            <input id="scp-name" className="scp-feld" value={name} autoComplete="name"
                   onChange={(e) => setName(e.target.value)} placeholder="Vor- und Nachname" autoFocus />

            <label className="scp-label" htmlFor="scp-firma">Unternehmen <em>(falls Zeichnung durch eine Gesellschaft)</em></label>
            <input id="scp-firma" className="scp-feld" value={firma} autoComplete="organization"
                   onChange={(e) => setFirma(e.target.value)} placeholder="optional" />

            <div className="scp-paar">
              <div>
                <label className="scp-label" htmlFor="scp-mail">E-Mail</label>
                <input id="scp-mail" className="scp-feld" value={email} type="email" autoComplete="email"
                       onChange={(e) => setEmail(e.target.value)} placeholder="name@firma.ch" />
              </div>
              <div>
                <label className="scp-label" htmlFor="scp-tel">Telefon</label>
                <input id="scp-tel" className="scp-feld" value={telefon} type="tel" autoComplete="tel"
                       onChange={(e) => setTelefon(e.target.value)} placeholder="+41 …" />
              </div>
            </div>

            <label className="scp-label" htmlFor="scp-code">Einladungscode</label>
            <input id="scp-code" className="scp-feld scp-feld-code" value={code}
                   onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="········" />

            {fehler && <p className="scp-fehler" role="alert">{fehler}</p>}

            <button type="submit" className="scp-knopf"
                    disabled={busy || !name.trim() || !email.trim() || !telefon.trim() || !code.trim()}>
              {busy ? "Prüft …" : "Datenraum betreten"}
            </button>
          </form>

          <p className="scp-eingang-fuss">
            Schwarzott Capital Partners AG · Schifflände 26, 8001 Zürich · CHE-102.119.428<br />
            Ihre Angaben und der Zeitpunkt des Zugriffs werden protokolliert.
          </p>
        </div>
      </main>
    );
  }

  // ── Der Datenraum ────────────────────────────────────────────────────────
  return (
    <main className="scp">
      <header className="scp-kopf">
        <div className="scp-kopf-innen">
          <p className="scp-marke klein">SCHWARZOTT<span>CAPITAL PARTNERS AG</span></p>
          <div className="scp-kopf-gast">
            <span>{gast.name}{gast.firma ? ` · ${gast.firma}` : ""}</span>
            <button type="button" className="scp-abmelden"
                    onClick={() => void ruf("/scp/abmelden").then(() => window.location.reload())}>
              Abmelden
            </button>
          </div>
        </div>
      </header>

      <div className="scp-bogen">

        <section className="scp-auftakt">
          <p className="scp-eyebrow">Vertraulicher Datenraum · Zeichnung</p>
          <Wortlauf text="Beteiligung an der Schwarzott Capital Partners AG" als="h1" klasse="scp-h1 gross" />
          <p className="scp-lead">
            Auf den folgenden Seiten finden Sie die Angaben zur Gesellschaft, die Unterlagen zur
            Zeichnung und das Feld für Ihre Erklärung. Nehmen Sie sich Zeit — der Zwischenstand
            Ihrer Eingaben bleibt erhalten.
          </p>
        </section>

        {fertig && (
          <section className="scp-fertig" role="status">
            <p className="scp-fertig-kopf">Zeichnung erfasst</p>
            <p>
              Ihre Zeichnungserklärung ist am{" "}
              <b>{new Date(zeichnung!.unterzeichnetAm!).toLocaleString("de-CH", { dateStyle: "long", timeStyle: "short" })}</b>{" "}
              eingegangen. Die Gesellschaft meldet sich zur Gegenzeichnung bei Ihnen.
            </p>
            <button type="button" className="scp-knopf schmal" onClick={() => window.print()}>
              Ausfertigung als PDF sichern
            </button>
          </section>
        )}

        {/* ── Die Gesellschaft ─────────────────────────────────────────── */}
        <section className="scp-block">
          <p className="scp-nr">01</p>
          <Wortlauf text="Die Gesellschaft" als="h2" klasse="scp-h2" />
          <p className="scp-satz">
            Angaben gemäss Handelsregister des Kantons Zürich, Stand der letzten Publikation
            vom 23. Juni 2026.
          </p>
          <div className="scp-spiegel">
            <Zeile was="Firma" wert="Schwarzott Capital Partners AG" />
            <Zeile was="Rechtsform" wert="Aktiengesellschaft" />
            <Zeile was="Rechtssitz" wert="Zürich" />
            <Zeile was="Domizil" wert="Schifflände 26, 8001 Zürich" />
            <Zeile was="Handelsregister-Nr." wert={<span className="scp-mono">CH-130.0.006.118-6</span>} />
            <Zeile was="UID / MWST" wert={<span className="scp-mono">CHE-102.119.428</span>} />
            <Zeile was="Eintrag seit" wert="30. Juni 1992" />
            <Zeile was="Aktienkapital" wert={<span className="scp-mono">CHF 100'000</span>} />
            <Zeile was="Branche" wert="Betreiben von übrigen Finanzinstitutionen" />
            <Zeile was="Verwaltungsrat" wert="Justin Schwarzott" />
            <Zeile was="Zeichnungsberechtigt" wert="Milia Gioti · Justin Schwarzott" />
          </div>

          <p className="scp-satz" style={{ marginTop: 26 }}><b>Gesellschaftszweck</b></p>
          <p className="scp-zweck">
            Die Gesellschaft bezweckt die Investition und Beteiligung an Unternehmen,
            Unternehmensberatung und Marketing sowie Immobilieninvestitionen im Ausland. Sie kann
            alle Geschäfte tätigen, die direkt oder indirekt mit ihrem Zweck in Zusammenhang stehen,
            Zweigniederlassungen und Tochtergesellschaften im In- und Ausland errichten und sich an
            anderen Unternehmen beteiligen. Sie ist berechtigt, Grundeigentum im In- und Ausland zu
            erwerben, zu belasten, zu veräussern und zu verwalten, Finanzierungen für eigene oder
            fremde Rechnung vorzunehmen sowie Garantien und Bürgschaften für Tochtergesellschaften
            und Dritte einzugehen.
          </p>
        </section>

        {/* ── Die Unterlagen ───────────────────────────────────────────── */}
        <section className="scp-block">
          <p className="scp-nr">02</p>
          <Wortlauf text="Die Unterlagen" als="h2" klasse="scp-h2" />
          <p className="scp-satz">
            Die nachstehenden Dokumente sind Bestandteil dieser Zeichnung. Bitte lesen Sie sie
            vollständig, bevor Sie Ihre Erklärung abgeben.
          </p>

          {/* Die Unterlagen werden von SCP eingestellt. Bis dahin steht hier
              ausdrücklich, dass sie fehlen — ein leerer Bereich ohne Hinweis
              liesse den Gast glauben, es gäbe nichts zu lesen. */}
          <div className="scp-akten">
            {[
              { nr: "A", titel: "Zeichnungsschein", was: "Die eigentliche Erklärung mit Betrag, Kategorie und Bedingungen." },
              { nr: "B", titel: "Beteiligungsvertrag", was: "Rechte und Pflichten der Beteiligten, Laufzeit, Übertragung." },
              { nr: "C", titel: "Statuten der Gesellschaft", was: "Fassung in der bei Zeichnung geltenden Form." },
              { nr: "D", titel: "Jahresrechnung", was: "Bilanz, Erfolgsrechnung und Anhang des letzten Geschäftsjahres." },
              { nr: "E", titel: "Risikohinweise", was: "Die mit der Beteiligung verbundenen Risiken im Einzelnen." },
            ].map((d) => (
              <article className="scp-akte" key={d.nr}>
                <span className="scp-akte-nr">{d.nr}</span>
                <div className="scp-akte-text">
                  <p className="scp-akte-titel">{d.titel}</p>
                  <p className="scp-akte-was">{d.was}</p>
                </div>
                <span className="scp-akte-stand">wird bereitgestellt</span>
              </article>
            ))}
          </div>
          <p className="scp-hinweis">
            Die Unterlagen werden von der Gesellschaft eingestellt. Solange sie hier nicht abrufbar
            sind, geben Sie bitte keine Zeichnungserklärung ab.
          </p>
        </section>

        {/* ── Die Erklärung ────────────────────────────────────────────── */}
        <section className="scp-block">
          <p className="scp-nr">03</p>
          <Wortlauf text="Ihre Zeichnungserklärung" als="h2" klasse="scp-h2" />

          <div className="scp-spiegel eng">
            <Zeile was="Zeichnende Person" wert={gast.name} />
            {gast.firma && <Zeile was="Für die Gesellschaft" wert={gast.firma} />}
            <Zeile was="E-Mail" wert={<span className="scp-mono">{gast.email}</span>} />
            <Zeile was="Telefon" wert={<span className="scp-mono">{gast.telefon}</span>} />
          </div>

          <label className="scp-label gross" htmlFor="scp-betrag">Zeichnungsbetrag in CHF</label>
          {fertig ? (
            <p className="scp-betrag-fest">{betrag ? `CHF ${betrag}` : "— nicht angegeben —"}</p>
          ) : (
            <input id="scp-betrag" className="scp-feld scp-feld-betrag" value={betrag} inputMode="decimal"
                   onChange={(e) => setBetrag(e.target.value)} placeholder="z. B. 250000" />
          )}

          <label className="scp-label gross" htmlFor="scp-anm" style={{ marginTop: 30 }}>
            Anmerkungen und Vorbehalte
          </label>
          <p className="scp-satz" style={{ marginTop: -6 }}>
            Was Sie hier festhalten, wird der Gesellschaft zusammen mit Ihrer Erklärung vorgelegt
            und ist Bestandteil der Akte.
          </p>
          {fertig ? (
            <div className="scp-anm-fest">{anmerkungen.trim() || "— keine Anmerkungen —"}</div>
          ) : (
            <textarea id="scp-anm" className="scp-textfeld" rows={6} value={anmerkungen}
                      onChange={(e) => setAnmerkungen(e.target.value)}
                      placeholder="Optional. Zum Beispiel Bedingungen, Rückfragen oder abweichende Vorstellungen." />
          )}

          {!fertig && (
            <div className="scp-zeichnen">
              <p className="scp-zeichnen-hinweis">
                Sie geben nachfolgend eine <b>einfache elektronische Signatur</b> ab. Ob diese für den
                vorliegenden Zeichnungsschein formgenügend ist, richtet sich nach den Unterlagen der
                Gesellschaft. Erfasst werden Ihr Name, der Zeitpunkt und Ihre IP-Adresse.
              </p>

              <label className="scp-label" htmlFor="scp-sig">Unterschrift — vollständiger Name</label>
              <input id="scp-sig" className="scp-sig" value={unterschrift} autoComplete="off"
                     onChange={(e) => setUnterschrift(e.target.value)} placeholder="Vor- und Nachname" />

              <label className="scp-haken">
                <input type="checkbox" checked={gelesen} onChange={(e) => setGelesen(e.target.checked)} />
                <span>Ich habe die Unterlagen der Gesellschaft vollständig gelesen und verstanden.</span>
              </label>
              <label className="scp-haken">
                <input type="checkbox" checked={risiko} onChange={(e) => setRisiko(e.target.checked)} />
                <span>
                  Ich habe die Risikohinweise zur Kenntnis genommen und bin mir bewusst, dass eine
                  Beteiligung mit dem Risiko eines vollständigen Verlusts des eingesetzten Kapitals
                  verbunden sein kann.
                </span>
              </label>

              {fehler && <p className="scp-fehler" role="alert">{fehler}</p>}

              <button type="button" className="scp-knopf gross"
                      disabled={busy || !gelesen || !risiko || unterschrift.trim().length < 4}
                      onClick={() => void unterzeichnen()}>
                {busy ? "Wird erfasst …" : "Zeichnungserklärung abgeben"}
              </button>
              {gespeichert && <p className="scp-gesichert">Zwischenstand gesichert um {gespeichert} Uhr.</p>}
            </div>
          )}

          {/* Die Unterschriftenfelder — für die Ausfertigung. */}
          <div className="scp-unterschriften">
            <div className="scp-uf">
              <div className={`scp-strich${fertig ? " gezeichnet" : ""}`}>
                {fertig && <span className="scp-hand">{unterschrift}</span>}
              </div>
              <p className="scp-uf-wer">{gast.name}</p>
              <p className="scp-uf-rolle">
                {fertig
                  ? `Zeichnende Person · ${new Date(zeichnung!.unterzeichnetAm!).toLocaleDateString("de-CH", { day: "2-digit", month: "long", year: "numeric" })}`
                  : "Zeichnende Person"}
              </p>
            </div>
            <div className="scp-uf">
              <div className="scp-strich" />
              <p className="scp-uf-wer">Für die Gesellschaft</p>
              <p className="scp-uf-rolle">Schwarzott Capital Partners AG · Gegenzeichnung</p>
            </div>
          </div>
        </section>

        <footer className="scp-fuss">
          <div className="scp-linie" />
          <p>
            Schwarzott Capital Partners AG · Schifflände 26, 8001 Zürich · CHE-102.119.428 ·
            Handelsregister des Kantons Zürich
          </p>
          <p className="scp-fuss-leise">
            Vertraulich. Dieser Datenraum und sein Inhalt sind ausschliesslich für die geladene
            Person bestimmt. Weitergabe an Dritte ist nicht gestattet.
          </p>
        </footer>
      </div>
    </main>
  );
}
