// ═══════════════════════════════════════════════════════════════════════════
// /app/mehr/passwort — PASSWORT FESTLEGEN UND ÄNDERN (Scheibe 7, Modul E,
// 06.09.2026)
//
// Warum diese Seite: 119 zahlende Kunden haben gar kein Passwort. Im alten
// Bereich gab es dafür genau einen Weg (client/src/components/kunde/
// Einrichtung.tsx, Schritt 1) — im neuen Bereich bisher keinen. Ohne Passwort
// kommt niemand zurück in seinen Bereich, sobald das Cookie abgelaufen ist.
//
// Zwei Zustände, zwei Routen — beide hinter requireKunde:
//   kein Passwort → POST /kunde/:ref/passwort-setzen  { neu }
//                   (server/routes/fiaon-einrichtung.ts:42ff.; 400 unter der
//                    Mindestlänge, 404 kein Konto, 409 es gibt schon eines)
//   Passwort da   → POST /kunde/:ref/passwort         { alt, neu }
//                   (server/routes/fiaon-kunde-bereich.ts:490ff.; 400 zu kurz,
//                    400 bisheriges Passwort falsch, 404 kein Konto)
//
// Die Felder kommen aus Einrichtung.tsx (neues Passwort + Wiederholung,
// Anzeigen/Verbergen, Stärkeanzeige), die Änderungsmaske aus dem bisherigen
// Passwort-Abschnitt in Bausteine.tsx (bisheriges + neues) — der dort
// entfällt, damit es EINE Stelle gibt. Sie-Form, Stil app.css (.ap-*).
//
// 409 ist kein Fehler, sondern eine Erkenntnis: Es gibt doch schon ein
// Passwort. Dann wechselt die Seite von selbst auf „Ändern“, damit niemand in
// einer Sackgasse steht.
// ═══════════════════════════════════════════════════════════════════════════
import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { api } from "./Bausteine";
import "@/styles/app-antraege.css";
import "@/styles/app-bericht.css";

/** Die Stufen der Stärkeanzeige. Die erste ist zugleich die Mindestlänge, die beide Routen verlangen. */
const STAERKE = [8, 10, 12];
const MINDEST = STAERKE[0];

type Meldung = { ton: "gut" | "fehler"; text: string };

export function Passwort({ kundeRef, demo, gesetzt, basis: basisProp }: {
  kundeRef: string;
  demo: boolean;
  /** Hat dieses Konto schon ein Passwort? Kommt als `passwortGesetzt` aus GET /kunde/:ref/bereich. */
  gesetzt: boolean;
  basis?: string;
}) {
  // Die Schale reicht keine Basis herein — in der Demo führt „Zurück“ trotzdem nach /app/demo.
  const basis = basisProp ?? (demo ? "/app/demo" : "/app");
  // Eigener Zustand: 409 auf „setzen“ und das erfolgreiche Festlegen dürfen die Maske umschalten,
  // ohne dass die Schale neu laden muss.
  const [aendern, setAendern] = useState(gesetzt);
  const [alt, setAlt] = useState("");
  const [neu, setNeu] = useState("");
  const [neu2, setNeu2] = useState("");
  const [zeigen, setZeigen] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<Meldung | null>(null);
  const [fertig, setFertig] = useState(false);

  const leeren = () => { setAlt(""); setNeu(""); setNeu2(""); setZeigen(false); };

  /** Ein Weg für beide Routen: prüfen, senden, den Satz des Servers zeigen. */
  const senden = async (e: FormEvent) => {
    e.preventDefault();
    if (demo) { setMeldung({ ton: "gut", text: "In der Demo-Ansicht wird nichts geändert." }); return; }
    if (aendern && !alt) { setMeldung({ ton: "fehler", text: "Bitte geben Sie zuerst Ihr bisheriges Passwort ein." }); return; }
    if (neu.length < MINDEST) { setMeldung({ ton: "fehler", text: `Ihr Passwort braucht mindestens ${MINDEST} Zeichen.` }); return; }
    if (!aendern && neu !== neu2) { setMeldung({ ton: "fehler", text: "Die beiden Eingaben stimmen nicht überein. Bitte tippen Sie das Passwort noch einmal." }); return; }
    if (aendern && neu === alt) { setMeldung({ ton: "fehler", text: "Das neue Passwort ist dasselbe wie das bisherige. Bitte wählen Sie ein anderes." }); return; }

    setLaeuft(true); setMeldung(null);
    const pfad = `/kunde/${encodeURIComponent(kundeRef)}/${aendern ? "passwort" : "passwort-setzen"}`;
    try {
      const r = await api(pfad, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(aendern ? { alt, neu } : { neu }),
      });
      setLaeuft(false);
      if (r.ok && r.json?.ok !== false) {
        leeren();
        setFertig(true);
        setMeldung({ ton: "gut", text: aendern ? "Ihr neues Passwort gilt ab jetzt." : "Ihr Passwort ist gespeichert. Damit melden Sie sich künftig an." });
        setAendern(true);
        return;
      }
      // 409 auf „setzen“: Es gibt doch schon ein Passwort — die Maske wechselt, die Eingabe bleibt stehen.
      if (r.status === 409 && !aendern) {
        setAendern(true); setNeu2("");
        setMeldung({ ton: "fehler", text: "Für Ihr Konto gibt es bereits ein Passwort. Bitte geben Sie zusätzlich Ihr bisheriges Passwort ein." });
        return;
      }
      if (r.status === 401) {
        setMeldung({ ton: "fehler", text: "Ihre Anmeldung ist abgelaufen. Bitte melden Sie sich noch einmal an." });
        return;
      }
      setMeldung({ ton: "fehler", text: String(r.json?.error || "Das Passwort konnte nicht gespeichert werden. Bitte versuchen Sie es noch einmal.") });
    } catch {
      setLaeuft(false);
      setMeldung({ ton: "fehler", text: "Ohne Verbindung lässt sich nichts speichern. Ihre Eingabe bleibt stehen – bitte tippen Sie gleich noch einmal auf Speichern." });
    }
  };

  const stufen = STAERKE.map((n, i) => <span key={n} className={`ap-stufe ${neu.length >= n ? "fertig" : i === 0 ? "jetzt" : ""}`} />);

  return (
    <>
      <Link href={`${basis}/mehr`} className="ap-textknopf ap-auf">← Zurück</Link>
      <h1 className="ap-gruss ap-auf" style={{ marginTop: 0 }}>
        Passwort
        <small>{aendern ? "Ihr Zugang zu Ihrem Bereich – am Handy wie am Rechner." : "Legen Sie Ihr Passwort fest, damit Sie jederzeit zurückkommen."}</small>
      </h1>
      {demo && <div className="ap-demo-band ap-auf"><b>Demo-Ansicht</b><span>Nur Anzeige – hier wird nichts geändert.</span></div>}

      {!aendern && !fertig && (
        <div className="ap-band ap-auf">
          <div>
            <b>Für Ihr Konto ist noch kein Passwort hinterlegt.</b>
            <span>Ohne Passwort kommen Sie nur über den Link aus Ihrer E-Mail herein. Mit Passwort melden Sie sich jederzeit selbst an.</span>
          </div>
        </div>
      )}

      <form className="ap-karte ap-form ap-auf v1" onSubmit={senden} noValidate>
        {aendern && (
          <label className="ap-feld">
            <span>Bisheriges Passwort</span>
            <input type="password" autoComplete="current-password" value={alt} onChange={(e) => setAlt(e.target.value)} disabled={laeuft || demo} readOnly={demo} />
          </label>
        )}
        <label className="ap-feld">
          <span>{aendern ? "Neues Passwort" : "Ihr Passwort"}</span>
          <div className="ap-pw">
            <input
              type={zeigen ? "text" : "password"}
              autoComplete="new-password"
              value={neu}
              onChange={(e) => setNeu(e.target.value)}
              disabled={laeuft || demo}
              readOnly={demo}
            />
            <button type="button" onClick={() => setZeigen(!zeigen)} aria-label={zeigen ? "Passwort verbergen" : "Passwort anzeigen"}>{zeigen ? "Verbergen" : "Anzeigen"}</button>
          </div>
        </label>
        {!aendern && (
          <label className="ap-feld">
            <span>Passwort wiederholen</span>
            <input type={zeigen ? "text" : "password"} autoComplete="new-password" value={neu2} onChange={(e) => setNeu2(e.target.value)} disabled={laeuft || demo} readOnly={demo} />
          </label>
        )}
        <div className="ap-stufen hell" aria-hidden="true" style={{ marginTop: 2 }}>{stufen}</div>
        <p className="ap-fuss" style={{ margin: "2px 2px 0" }}>Mindestens {MINDEST} Zeichen. Wählen Sie eines, das Sie sonst nirgends verwenden – es öffnet Ihre Akte mit Vorgängen, Unterlagen und Vollmacht.</p>
        {!demo && (
          <button type="submit" className="ap-knopf" disabled={laeuft || neu.length < MINDEST || (aendern && !alt) || (!aendern && !neu2)}>
            {laeuft ? "Wird gespeichert …" : aendern ? "Passwort ändern" : "Passwort speichern"}
          </button>
        )}
        {meldung && <div className={`ap-meldung ${meldung.ton}`} role="status">{meldung.text}</div>}
      </form>

      <div className="ap-karte ap-auf v2">
        <p style={{ marginTop: 0 }}>Ihr Passwort kennt niemand außer Ihnen – auch Ihre Ansprechperson nicht. Wenn Sie es vergessen haben, fordern Sie auf der Anmeldeseite einen neuen Zugang an.</p>
        <a className="ap-link" href={demo ? `${basis}` : "/app/login"} style={{ display: "inline-block", marginTop: 8 }}>Zur Anmeldung →</a>
      </div>
    </>
  );
}
