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
type Partei = {
  rolle: string; bezeichnung: string; name: string; sitz: string;
  register: string | null; vertretung: string | null;
  quote: string | null; gesamtanteil: string | null;
};
type Meine = { anmerkungen: string | null; unterschrift: string | null; unterzeichnetAm: string | null };
type Stand = { rolle: string; unterschrift: string | null; unterzeichnetAm: string };

const DOKUMENT = "anteilskaufvertrag";

/** Die vier Parteien in der Reihenfolge der Unterschriftenseiten. */
const REIHE: { rolle: string; bezeichnung: string; name: string; quote: string }[] = [
  { rolle: "erwerber1", bezeichnung: "Erwerber zu 1", name: "Schwarzott Capital Partners AG", quote: "41,50 %" },
  { rolle: "erwerber2", bezeichnung: "Erwerber zu 2", name: "FIAON Ltd.", quote: "15,00 %" },
  { rolle: "erwerber3", bezeichnung: "Erwerber zu 3", name: "Dr. Gerhold", quote: "43,50 %" },
  { rolle: "veraeusserer", bezeichnung: "Veräußerer", name: "Christian Schwab", quote: "100 % der Anteile" },
];

export default function ScpDatenraum(): JSX.Element {
  const [laedt, setLaedt] = useState(true);
  const [gast, setGast] = useState<Gast | null>(null);
  const [partei, setPartei] = useState<Partei | null>(null);
  const [meine, setMeine] = useState<Meine | null>(null);
  const [stand, setStand] = useState<Stand[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Anmeldung
  const [name, setName] = useState("");
  const [firma, setFirma] = useState("");
  const [email, setEmail] = useState("");
  const [telefon, setTelefon] = useState("");
  const [code, setCode] = useState("");

  // Zeichnung
  const [anmerkungen, setAnmerkungen] = useState("");
  const [unterschrift, setUnterschrift] = useState("");
  const [gelesen, setGelesen] = useState(false);
  const [form, setForm] = useState(false);
  const [gespeichert, setGespeichert] = useState<string | null>(null);

  const fertig = !!meine?.unterzeichnetAm;

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

  // ── DER UNTERSCHRIFTENSTAND GEHOERT ALLEN (04.09.2026) ─────────────────
  // Hier stand die Rueckkehr VOR setStand: Wer nicht angemeldet war, bekam den
  // Stand zwar vom Server geliefert, die Seite warf ihn aber weg und zeigte
  // „0 von 4 Unterschriften" — auch wenn zwei Parteien gezeichnet hatten.
  // Genau das war Justins Beschwerde. Der Stand wird jetzt IMMER uebernommen,
  // die Rueckkehr betrifft nur noch die persoenlichen Daten.
  const standHolen = async () => {
    const r = await ruf("/scp/stand", undefined, "GET");
    if (r.ok) setStand(r.json.stand || []);
    return r;
  };

  useEffect(() => {
    void ruf("/scp/stand", undefined, "GET").then((r) => {
      setLaedt(false);
      if (r.ok) setStand(r.json.stand || []);
      if (!r.ok || !r.json?.angemeldet) return;
      setGast(r.json.gast);
      setPartei(r.json.partei ?? null);
      setStand(r.json.stand || []);
      const m = r.json.meine as Meine | null;
      if (m) {
        setMeine(m);
        setAnmerkungen(m.anmerkungen || "");
        if (m.unterschrift) setUnterschrift(m.unterschrift);
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
    setPartei(r.json.partei ?? null);
    if (!unterschrift) setUnterschrift(r.json.gast.name);
    // Nach dem Anmelden den Stand frisch holen: Zwischen Seitenaufbau und
    // Anmeldung kann eine andere Partei gezeichnet haben — und ohne dieses
    // Nachladen zaehlte die Seite die eigene Unterschrift auf eine leere
    // Liste und meldete „1 von 4", obwohl vielleicht drei vorlagen.
    void standHolen();
  };

  // Stilles Sichern, solange nicht unterzeichnet ist.
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (!gast || fertig) return;
    // NUR speichern, wenn wirklich etwas getippt wurde. Vorher feuerte dieser
    // Lauf 1,2 Sekunden nach jedem Anmelden auch bei leerem Feld — und legte
    // damit eine unfertige Zeile in scp_zeichnungen an, samt Rolle. Zwei
    // Folgen: Ein vorhandener Text wurde von einem leeren ueberschrieben,
    // und der Eindeutigkeits-Index auf (rolle, dokument) sperrte danach
    // JEDEN zweiten Menschen derselben Partei mit „Serverfehler" aus. Bei
    // FIAON Ltd. ist gar nicht festgelegt, wer zeichnet — dort war das
    // besonders wahrscheinlich.
    if (!anmerkungen.trim()) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void ruf("/scp/anmerkungen", { dokument: DOKUMENT, anmerkungen })
        .then((r) => { if (r.ok) setGespeichert(new Date().toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })); });
    }, 1200);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [anmerkungen, gast, fertig]);

  const unterzeichnen = async () => {
    setBusy(true); setFehler(null);
    const r = await ruf("/scp/unterzeichnen", {
      dokument: DOKUMENT, unterschrift, anmerkungen, gelesen, form,
    });
    setBusy(false);
    if (!r.ok) { setFehler(r.json?.error || "Die Unterzeichnung war nicht möglich."); return; }
    setMeine({ anmerkungen, unterschrift, unterzeichnetAm: r.json.unterzeichnetAm });
    // Den echten Stand holen statt ihn lokal fortzuschreiben: Die eigene
    // Unterschrift an eine womoeglich unvollstaendige Liste anzuhaengen
    // ergibt eine falsche Zahl — „1 von 4", waehrend in Wahrheit drei
    // Parteien gezeichnet haben. Der Server weiss es, also fragen wir ihn.
    void standHolen();
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
          <Wortlauf text="Anteilskaufvertrag SWP Verwaltungs GmbH" als="h1" klasse="scp-h1 gross" />
          <p className="scp-lead">
            Erwerb sämtlicher Geschäftsanteile an der SWP Verwaltungs GmbH, Hamburg, durch drei
            gemeinschaftlich handelnde Erwerber. Gesamtkaufpreis 14.000.000,00 EUR.
            {partei && <> Sie sind hier als <b>{partei.bezeichnung}</b> — {partei.name}.</>}
          </p>
        </section>

        {fertig && (
          <section className="scp-fertig" role="status">
            <p className="scp-fertig-kopf">Unterschrift erfasst</p>
            <p>
              Ihre Unterschrift als <b>{partei?.bezeichnung}</b> ist am{" "}
              <b>{new Date(meine!.unterzeichnetAm!).toLocaleString("de-DE", { dateStyle: "long", timeStyle: "short" })}</b>{" "}
              eingegangen. Der Vertrag wird wirksam, sobald alle vier Parteien unterzeichnet haben
              und die notarielle Beurkundung nach § 12 erfolgt ist.
            </p>
            <button type="button" className="scp-knopf schmal" onClick={() => window.print()}>
              Ausfertigung als PDF sichern
            </button>
          </section>
        )}

        {/* ── Der Vertragsgegenstand ───────────────────────────────── */}
        <section className="scp-block">
          <p className="scp-nr">01</p>
          <Wortlauf text="Vertragsgegenstand" als="h2" klasse="scp-h2" />
          <p className="scp-satz">
            Gegenstand ist der Erwerb sämtlicher Geschäftsanteile an der Gesellschaft auf
            schuldenfreier Basis (Share Deal). Die Due Diligence ist nach § 5 abgeschlossen.
          </p>
          <div className="scp-spiegel">
            <Zeile was="Gesellschaft" wert="SWP Verwaltungs GmbH" />
            <Zeile was="Sitz" wert="Olbersweg 41, 22767 Hamburg" />
            <Zeile was="Handelsregister" wert={<span className="scp-mono">Amtsgericht Lübeck, HRB 23250 HL</span>} />
            <Zeile was="Stammkapital" wert={<span className="scp-mono">EUR 25.000,00</span>} />
            <Zeile was="Gesamtkaufpreis" wert={<span className="scp-mono"><b>EUR 14.000.000,00</b></span>} />
            <Zeile was="davon Ablösebetrag" wert={<span className="scp-mono">EUR 8.000.000,00 (variabel)</span>} />
            <Zeile was="davon Gewinnanteil" wert={<span className="scp-mono">EUR 6.000.000,00 (variabel)</span>} />
            <Zeile was="Erwerbsform" wert="Anteilskauf (Share Deal), schuldenfreie Basis" />
          </div>
        </section>

        {/* ── Die Parteien und Quoten ──────────────────────────────────── */}
        <section className="scp-block">
          <p className="scp-nr">02</p>
          <Wortlauf text="Parteien und Quoten" als="h2" klasse="scp-h2" />
          <p className="scp-satz">
            Anlage 1 des Vertrags. Die Summe der Beteiligungsquoten ergibt 100,00 %.
          </p>
          <div className="scp-tabhuelle">
            <table className="scp-tab">
              <thead>
                <tr>
                  <th></th>
                  <th>Erwerber zu 1</th>
                  <th>Erwerber zu 2</th>
                  <th>Erwerber zu 3</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Firma / Name</td><td>Schwarzott Capital Partners AG</td><td>FIAON Ltd.</td><td>Dr. Gerhold</td></tr>
                <tr><td>Sitz</td><td>Zürich, Schweiz</td><td>London, UK</td><td>Woodland Hills, USA</td></tr>
                <tr className="stark"><td>Beteiligungsquote</td><td>41,50 %</td><td>15,00 %</td><td>43,50 %</td></tr>
                <tr><td>Nennbetrag</td><td>EUR 10.375,00</td><td>EUR 3.750,00</td><td>EUR 10.875,00</td></tr>
                <tr><td>Anteil Gewinnanteil</td><td>EUR 2.490.000,00</td><td>EUR 900.000,00</td><td>EUR 2.610.000,00</td></tr>
                <tr><td>Anteil Ablösebetrag</td><td>EUR 3.320.000,00</td><td>EUR 1.200.000,00</td><td>EUR 3.480.000,00</td></tr>
                <tr className="stark"><td>Gesamtanteil Kaufpreis</td><td>EUR 5.810.000,00</td><td>EUR 2.100.000,00</td><td>EUR 6.090.000,00</td></tr>
              </tbody>
            </table>
          </div>
          <p className="scp-satz" style={{ marginTop: 18 }}>
            <b>Veräußerer:</b> Christian Schwab, geboren am 26.06.1976 in Hamburg, Olbersweg 41,
            22767 Hamburg — Alleingesellschafter und alleinvertretungsberechtigter Geschäftsführer,
            100 % der Geschäftsanteile.
          </p>
        </section>

        {/* ── Der Vertrag ──────────────────────────────────────────── */}
        <section className="scp-block">
          <p className="scp-nr">03</p>
          <Wortlauf text="Der Vertrag" als="h2" klasse="scp-h2" />
          <p className="scp-satz">
            Der vollständige Anteilskaufvertrag nebst Konsortialerklärung, 33 Seiten mit fünf
            Anlagen. Bitte lesen Sie ihn vollständig, bevor Sie unterzeichnen.
          </p>
          <a className="scp-akte-oeffnen" href={`${API}/scp/vertrag.pdf`} target="_blank" rel="noopener noreferrer">
            <span className="scp-akte-nr">§</span>
            <span className="scp-akte-text">
              <span className="scp-akte-titel">Anteilskaufvertrag SWP Verwaltungs GmbH</span>
              <span className="scp-akte-was">33 Seiten · Kaufpreis EUR 14.000.000,00 · nebst Anlagen 1 bis 5</span>
            </span>
            <span className="scp-akte-stand">öffnen</span>
          </a>

          <div className="scp-anlagen">
            {[
              ["1", "Beteiligungs- und Quotentabelle"],
              ["2", "Objektverzeichnis"],
              ["3", "Abzulösende Finanzierungen"],
              ["4", "Bankverbindung und Aufstellung des Veräußerers"],
              ["5", "Ablauf- und Fristenplan"],
            ].map(([nr, titel]) => (
              <span key={nr} className="scp-anlage">Anlage {nr} · {titel}</span>
            ))}
          </div>

          {/* § 12 des Vertrags — das Wichtigste für jeden, der hier
              unterschreibt. Es steht so im Vertrag selbst, auf Seite 1 und in
              § 12 Abs. 4. Eine Unterschrift in einem Datenraum, die den
              Eindruck erweckte, damit sei der Anteilskauf vollzogen, wäre
              irreführend. */}
          <div className="scp-form-hinweis">
            <p className="scp-form-kopf">§ 12 — Notarielle Beurkundung</p>
            <p>
              Sowohl die Verpflichtung zur Übertragung von GmbH-Geschäftsanteilen als auch die
              Abtretung selbst bedürfen nach <b>§ 15 Abs. 3 und 4 GmbHG der notariellen
              Beurkundung</b>. Bis dahin kann der Vertrag nach § 125 Satz 1 BGB formunwirksam sein;
              ein Formmangel wird erst durch die notarielle Abtretung nach § 15 Abs. 4 Satz 2 GmbHG
              geheilt.
            </p>
            <p>
              Ihre Unterschrift in diesem Datenraum dokumentiert Ihr Einverständnis mit dem
              vorliegenden Text und Ihre Bereitschaft zur notariellen Wiederholung nach § 12 Abs. 2.
              Sie ersetzt die Beurkundung <b>nicht</b>. Die Parteien haben vereinbart, dass die
              §§ 6 bis 11 hiervon unberührt bleiben und als selbständige, formfrei wirksame
              Vereinbarung über die Abwicklung gelten.
            </p>
          </div>
        </section>

        {/* ── Die Unterzeichnung ───────────────────────────────────── */}
        <section className="scp-block">
          <p className="scp-nr">04</p>
          <Wortlauf text="Ihre Unterzeichnung" als="h2" klasse="scp-h2" />

          {partei && (
            <div className="scp-spiegel eng">
              <Zeile was="Sie unterzeichnen als" wert={<b>{partei.bezeichnung}</b>} />
              <Zeile was="Partei" wert={partei.name} />
              <Zeile was="Sitz laut Vertrag" wert={partei.sitz} />
              {partei.register && <Zeile was="Register" wert={<span className="scp-mono">{partei.register}</span>} />}
              {partei.vertretung && <Zeile was="Vertreten durch" wert={partei.vertretung} />}
              {partei.quote && <Zeile was="Beteiligungsquote" wert={<b>{partei.quote}</b>} />}
              {partei.gesamtanteil && <Zeile was="Anteil am Kaufpreis" wert={<span className="scp-mono">{partei.gesamtanteil}</span>} />}
            </div>
          )}

          <label className="scp-label gross" htmlFor="scp-anm">Anmerkungen und Vorbehalte</label>
          <p className="scp-satz" style={{ marginTop: -6 }}>
            Was Sie hier festhalten, wird mit Ihrer Unterschrift festgeschrieben und ist
            Bestandteil der Akte. Es geht an die Schwarzott Capital Partners AG; den übrigen
            Parteien wird es nicht selbsttätig angezeigt. Bitte richten Sie einen Vorbehalt,
            der allen bekannt sein muss, zusätzlich unmittelbar an Ihre Vertragspartner.
          </p>
          {fertig ? (
            <div className="scp-anm-fest">{anmerkungen.trim() || "— keine Anmerkungen —"}</div>
          ) : (
            <textarea id="scp-anm" className="scp-textfeld" rows={6} value={anmerkungen}
                      onChange={(e) => setAnmerkungen(e.target.value)}
                      placeholder="Optional. Zum Beispiel Bedingungen, Rückfragen oder abweichende Vorstellungen zu einzelnen Paragraphen." />
          )}

          {!fertig && (
            <div className="scp-zeichnen">
              <p className="scp-zeichnen-hinweis">
                Sie geben nachfolgend eine <b>einfache elektronische Signatur</b> ab. Sie
                dokumentiert Ihr Einverständnis mit dem Vertragstext und ersetzt die notarielle
                Beurkundung nach § 12 nicht. Erfasst werden Ihr Name, der Zeitpunkt und Ihre
                IP-Adresse.
              </p>

              <label className="scp-label" htmlFor="scp-sig">Unterschrift — vollständiger Name</label>
              <input id="scp-sig" className="scp-sig" value={unterschrift} autoComplete="off"
                     onChange={(e) => setUnterschrift(e.target.value)} placeholder="Vor- und Nachname" />

              <label className="scp-haken">
                <input type="checkbox" checked={gelesen} onChange={(e) => setGelesen(e.target.checked)} />
                <span>
                  Ich habe den Anteilskaufvertrag nebst Anlagen vollständig gelesen und verstanden
                  und bestätige die Richtigkeit der zu meiner Partei gemachten Angaben nach § 2.
                </span>
              </label>
              <label className="scp-haken">
                <input type="checkbox" checked={form} onChange={(e) => setForm(e.target.checked)} />
                <span>
                  Mir ist bekannt, dass die Übertragung der Geschäftsanteile nach § 15 Abs. 3 und 4
                  GmbHG der notariellen Beurkundung bedarf, und ich verpflichte mich zur
                  notariellen Wiederholung nach § 12 Abs. 2.
                </span>
              </label>

              {fehler && <p className="scp-fehler" role="alert">{fehler}</p>}

              <button type="button" className="scp-knopf gross"
                      disabled={busy || !gelesen || !form || unterschrift.trim().length < 4}
                      onClick={() => void unterzeichnen()}>
                {busy ? "Wird erfasst …" : "Vertrag unterzeichnen"}
              </button>
              {gespeichert && <p className="scp-gesichert">Zwischenstand gesichert um {gespeichert} Uhr.</p>}
            </div>
          )}
        </section>

        {/* ── Der Stand aller Parteien ─────────────────────────────────── */}
        <section className="scp-block">
          <p className="scp-nr">05</p>
          <Wortlauf text="Unterschriftenstand" als="h2" klasse="scp-h2" />
          <p className="scp-satz">
            Der Vertrag ist vollständig unterzeichnet, wenn alle vier Parteien gezeichnet haben.
            Danach folgt die notarielle Beurkundung nach § 12.
          </p>
          <div className="scp-unterschriften vier">
            {REIHE.map((r) => {
              const z = stand.find((x) => x.rolle === r.rolle);
              const ich = partei?.rolle === r.rolle;
              return (
                <div className={`scp-uf${ich ? " ich" : ""}`} key={r.rolle}>
                  <div className={`scp-strich${z ? " gezeichnet" : ""}`}>
                    {z && <span className="scp-hand">{z.unterschrift}</span>}
                  </div>
                  <p className="scp-uf-wer">{r.name}</p>
                  <p className="scp-uf-rolle">
                    {r.bezeichnung} · {r.quote}
                    {z
                      ? <><br />gezeichnet am {new Date(z.unterzeichnetAm).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })}</>
                      : <><br />ausstehend</>}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="scp-zaehler">
            {stand.length} von 4 Unterschriften liegen vor.
          </p>
        </section>

        <footer className="scp-fuss">
          <div className="scp-linie" />
          <p>
            Anteilskaufvertrag SWP Verwaltungs GmbH · HRB 23250 HL (Amtsgericht Lübeck) ·
            Kaufpreis EUR 14.000.000,00
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
