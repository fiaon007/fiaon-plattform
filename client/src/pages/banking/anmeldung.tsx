// ═══════════════════════════════════════════════════════════════════════════
// FIAON BANKING — die Anmeldung (E-228)
//
// Drei Schritte: Passwort, Person, PIN. Links steht, was die Sicherheit
// ausmacht — nur, was wirklich stimmt. Kein „Ende-zu-Ende", kein „bankgeprüft".
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { ruf, type Ich } from "./api";
import { Guilloche, Meldung, Segmente, Zeichen } from "./ui";

interface Person { email: string; name: string; titel: string; gesperrt?: boolean }

export default function Anmeldung({ fertig, hinweis }: { fertig: (ich: Ich) => void; hinweis?: string | null }) {
  const [schritt, setSchritt] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("accounting@fiaon.com");
  const [passwort, setPasswort] = useState("");
  const [zeigen, setZeigen] = useState(false);
  const [leute, setLeute] = useState<Person[]>([]);
  const [wer, setWer] = useState<Person | null>(null);
  const [pin, setPin] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const passwortSenden = async (e: React.FormEvent) => {
    e.preventDefault();
    setLaeuft(true); setFehler(null);
    try {
      const j = await ruf<{ personen: Person[] }>("/buchhaltung/anmelden", { body: { email, passwort } });
      setLeute(j.personen || []); setPasswort(""); setSchritt(2);
    } catch (err: any) { setFehler(err.message); } finally { setLaeuft(false); }
  };

  const pinHolen = async (p: Person) => {
    setLaeuft(true); setFehler(null);
    try {
      await ruf("/buchhaltung/pin-anfordern", { body: { email: p.email } });
      setWer(p); setPin(""); setSchritt(3);
    } catch (err: any) { setFehler(err.message); } finally { setLaeuft(false); }
  };

  const pinSenden = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!wer || pin.length !== 12) return;
    setLaeuft(true); setFehler(null);
    try {
      const j = await ruf<{ ich: Ich }>("/buchhaltung/pin-pruefen", { body: { email: wer.email, pin } });
      fertig(j.ich);
    } catch (err: any) { setFehler(err.message); setPin(""); } finally { setLaeuft(false); }
  };

  return (
    <div className="bk-tor-buehne">
      <section className="bk-tor-seite" aria-hidden="false">
        <Guilloche className="bk-tor-band" linien={26} />
        <div className="bk-tor-marke">FIAON<small>Banking</small></div>
        <h1 className="bk-tor-satz">Geschäftskonto, Zahlungsverkehr und Auszahlungen der FIAON LTD.</h1>
        <ul className="bk-tor-liste">
          <li><Zeichen n="schloss" g={16} /><span><strong>Zwei Faktoren.</strong> Passwort, dann ein Einmal-PIN an die eigene Adresse.</span></li>
          <li><Zeichen n="schild" g={16} /><span><strong>TAN für jede Freigabe</strong> und jede Bewegung des Kontostands — gebunden an genau diesen Vorgang.</span></li>
          <li><Zeichen n="uhr" g={16} /><span><strong>Automatische Abmeldung</strong> nach 10 Minuten ohne Eingabe.</span></li>
          <li><Zeichen n="auftraege" g={16} /><span><strong>Lückenloses Protokoll.</strong> Jede Handlung mit Name und Uhrzeit.</span></li>
        </ul>
        <div className="bk-tor-fuss">FIAON LTD · Company No. 17318250 · Verbindung TLS-verschlüsselt</div>
      </section>

      <section className="bk-tor-karte" aria-labelledby="bk-tor-titel">
        <div className="bk-tor-schritte" aria-label={`Schritt ${schritt} von 3`}>
          {["Passwort", "Person", "PIN"].map((s, i) => (
            <span key={s} className={`bk-tor-schritt${schritt === i + 1 ? " aktiv" : schritt > i + 1 ? " fertig" : ""}`}>
              <i>{schritt > i + 1 ? <Zeichen n="haken" g={11} /> : i + 1}</i>{s}
            </span>
          ))}
        </div>
        <h2 id="bk-tor-titel" className="bk-tor-titel">
          {schritt === 1 ? "Anmelden" : schritt === 2 ? "Wer meldet sich an?" : "Einmal-PIN eingeben"}
        </h2>
        <p className="bk-tor-text">
          {schritt === 1 && "Mit dem gemeinsamen Anmeldenamen und Passwort des Bankings."}
          {schritt === 2 && "Der PIN geht ausschließlich an die Adresse der gewählten Person."}
          {schritt === 3 && wer && <>Zwölf Zeichen aus der Mail an <strong>{wer.email}</strong>. Gültig 10 Minuten.</>}
        </p>

        {hinweis && schritt === 1 ? <Meldung art="info">{hinweis}</Meldung> : null}

        {schritt === 1 && (
          <form onSubmit={passwortSenden} className="bk-tor-form">
            <div className="bk-tor-feld">
              <label htmlFor="bk-mail">Anmeldename</label>
              <input id="bk-mail" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="bk-tor-feld">
              <label htmlFor="bk-pw">Passwort</label>
              <div className="bk-tor-pw">
                <input id="bk-pw" type={zeigen ? "text" : "password"} autoComplete="current-password" value={passwort}
                  onChange={(e) => setPasswort(e.target.value)} autoFocus />
                <button type="button" className="bk-tor-auge" aria-label={zeigen ? "Passwort verbergen" : "Passwort zeigen"}
                  onClick={() => setZeigen((z) => !z)}><Zeichen n="auge" g={16} /></button>
              </div>
            </div>
            <button className="bk-tor-knopf" type="submit" disabled={laeuft || !passwort}>{laeuft ? "Prüfe …" : "Weiter"}</button>
          </form>
        )}

        {schritt === 2 && (
          <div className="bk-tor-wahl">
            {leute.map((p) => (
              <button key={p.email} type="button" disabled={laeuft || p.gesperrt} onClick={() => void pinHolen(p)}>
                <span className="bk-tor-initial">{p.name.split(" ").map((x) => x[0]).join("").slice(0, 2)}</span>
                <span>
                  <strong>{p.name}</strong>
                  <em>{p.gesperrt ? "Zugang gesperrt" : `${p.titel} · PIN an ${p.email}`}</em>
                </span>
                <Zeichen n="rechts" g={16} />
              </button>
            ))}
            <button type="button" className="bk-tor-zurueck" onClick={() => { setSchritt(1); setFehler(null); }}>Zurück</button>
          </div>
        )}

        {schritt === 3 && wer && (
          <form onSubmit={pinSenden} className="bk-tor-form">
            <Segmente gruppen={[4, 4, 4]} wert={pin} onWert={setPin} erlaubt={/[A-Z0-9]/} dunkel autoFocus beschriftung="Einmal-PIN" />
            <button className="bk-tor-knopf" type="submit" disabled={laeuft || pin.length !== 12}>{laeuft ? "Prüfe …" : "Anmelden"}</button>
            <div className="bk-tor-leise">
              <button type="button" onClick={() => void pinHolen(wer)} disabled={laeuft}>Neuen PIN schicken</button>
              <button type="button" onClick={() => { setSchritt(2); setFehler(null); }}>Andere Person</button>
            </div>
          </form>
        )}

        {fehler ? <div className="bk-tor-fehler" role="alert">{fehler}</div> : null}
      </section>
    </div>
  );
}
