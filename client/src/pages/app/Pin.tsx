// ═══════════════════════════════════════════════════════════════════════════
// /app/mehr/pin — DIE PERSÖNLICHE FIAON-PIN (05.10.2026, E-282)
//
// Justin: „Nach der Bonitätsprüfung soll der Kunde einen 4-stelligen
// persönlichen Code auswählen … mit der wir ihn verifizieren können … er kann
// den jederzeit auf der Plattform ändern."
//
// Mit der PIN erkennen Mitarbeiter den Kunden am Telefon. Sie ist KEINE
// Karten-PIN — die vergibt allein die Bank. So steht es oben auf der Seite,
// und so darf es nirgends anders klingen.
//
// Drei Zustände, eine Route (POST /kunde/:ref/pin { alt?, neu }, fiaon-kunde-bereich.ts):
//   keine PIN            → neue PIN + Wiederholung
//   PIN da               → bisherige PIN + neue PIN + Wiederholung
//   frisch (Anmelde-Link) → neue PIN + Wiederholung, ohne die bisherige
//                          („PIN vergessen?“ schickt den Link mit weiter=/app/mehr/pin;
//                           fiaon-app-login.ts setzt dabei 15 Minuten „frisch“)
//
// Regeln: Die PIN wird nie angezeigt, nie in Storage gelegt und nach dem
// Senden sofort aus dem Zustand gelöscht. Die Vorabprüfung nutzt DIESELBE
// Regel wie der Server (pinPruefen, shared/fiaon-antrag-neu.ts) — der Kunde
// liest den Grund unter dem Feld, bevor er absendet. Server-Meldungen (falsche
// bisherige PIN mit Restversuchen, Sperre) stehen an dem Feld, das sie betreffen.
// ═══════════════════════════════════════════════════════════════════════════
import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { pinPruefen, PIN_SPERRE_MINUTEN } from "@shared/fiaon-antrag-neu";
import { api } from "./Bausteine";
import { ereignisMelden } from "./Bericht";
import "@/styles/app-antraege.css";
import "@/styles/app-bericht.css";

type Meldung = { ton: "gut" | "fehler"; text: string };
type Feld = "alt" | "neu" | "neu2";

/** Geburtsdatum aus dem Bereich („1985-03-12“ oder „12.03.1985“) — für die Regel „nicht der Geburtstag“. */
function geburtAus(s: string | null | undefined): { tag: number; monat: number; jahr: number } | null {
  const t = String(s ?? "").trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return { jahr: Number(m[1]), monat: Number(m[2]), tag: Number(m[3]) };
  m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return { tag: Number(m[1]), monat: Number(m[2]), jahr: Number(m[3]) };
  return null;
}

// Eigene Klassen dieses Bildschirms — als Text, weil sie nur hier gelten.
// Schrift im Feld 16 px: darunter zoomt iOS beim Antippen in die Seite.
const PIN_STIL = [
  ".ap-pin{position:relative;display:grid;grid-template-columns:repeat(4,minmax(0,64px));gap:10px;width:max-content;max-width:100%}",
  ".ap-feld .ap-pin input{position:absolute;inset:0;width:100%;height:100%;min-height:0;margin:0;padding:0;border:0;border-radius:12px;background:transparent;box-shadow:none;color:transparent;-webkit-text-fill-color:transparent;caret-color:transparent;font-size:16px;letter-spacing:0;outline:none;z-index:2;cursor:text}",
  ".ap-feld .ap-pin input::selection{background:transparent}",
  ".ap-feld .ap-pin input:disabled{cursor:default}",
  ".ap-pin-kasten{display:grid;place-items:center;height:56px;border:1px solid var(--fi-linie);border-radius:var(--fi-radius-knopf,10px);background:#fff;box-shadow:var(--fi-schatten-ruhe);transition:border-color .12s,box-shadow .12s}",
  ".ap-pin-kasten.voll::after{content:\"\";width:12px;height:12px;border-radius:50%;background:var(--fi-text)}",
  ".ap-pin:focus-within .ap-pin-kasten.jetzt{border-color:var(--fi-primaer);box-shadow:0 0 0 4px rgba(29,78,216,.12)}",
  ".ap-pin:focus-within.voll4 .ap-pin-kasten:last-child{border-color:var(--fi-primaer);box-shadow:0 0 0 4px rgba(29,78,216,.12)}",
  ".ap-pin.fehler .ap-pin-kasten{border-color:var(--fi-fehler)}",
  ".ap-pin.aus .ap-pin-kasten{background:var(--fi-seite);box-shadow:none}",
  ".ap-pin-satz{display:block;margin:2px 2px 0;font-size:14px;line-height:1.45;color:var(--fi-text-leise)}",
  ".ap-pin-satz.fehler{color:var(--fi-fehler)}",
  ".ap-pin-satz.gut{color:var(--fi-erfolg)}",
].join("\n");

/** Ein verdecktes Feld für vier Ziffern, gezeichnet als vier Kästchen. Einfügen geht; die Ziffern sieht niemand. */
function PinFeld({ id, titel, wert, setzen, satz, ton, aus, autoFocus }: {
  id: string; titel: string; wert: string; setzen: (v: string) => void;
  satz?: string | null; ton?: "fehler" | "gut" | null; aus?: boolean; autoFocus?: boolean;
}) {
  const n = wert.length;
  return (
    <div className="ap-feld" data-fiaon={`pin-feld-${id}`}>
      <span><label htmlFor={`pin-${id}`}>{titel}</label><span aria-hidden="true" style={{ fontWeight: 500 }}>{n}/4</span></span>
      <div className={`ap-pin${ton === "fehler" ? " fehler" : ""}${aus ? " aus" : ""}${n === 4 ? " voll4" : ""}`}>
        <input
          id={`pin-${id}`}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="next"
          data-1p-ignore="true"
          data-lpignore="true"
          aria-invalid={ton === "fehler" || undefined}
          aria-describedby={satz ? `pin-${id}-satz` : undefined}
          value={wert}
          // Einfügen erlaubt: Alles außer Ziffern fällt weg, mehr als vier werden abgeschnitten.
          onChange={(e) => setzen(e.target.value.replace(/\D/g, "").slice(0, 4))}
          disabled={aus}
          autoFocus={autoFocus}
        />
        {[0, 1, 2, 3].map((i) => <span key={i} aria-hidden="true" className={`ap-pin-kasten${i < n ? " voll" : ""}${i === n ? " jetzt" : ""}`} />)}
      </div>
      {satz && <small id={`pin-${id}-satz`} className={`ap-pin-satz${ton ? ` ${ton}` : ""}`} role={ton === "fehler" ? "alert" : undefined}>{satz}</small>}
    </div>
  );
}

export function Pin({ kundeRef, demo, basis: basisProp, gesetzt, frisch, email, geburtsdatum, onGespeichert }: {
  kundeRef: string;
  demo: boolean;
  basis?: string;
  /** `pinGesetzt` aus GET /kunde/:ref/bereich. null/undefined = unbekannt → Änderungsmaske (der Server entscheidet). */
  gesetzt: boolean | null | undefined;
  /** `pinFrisch`: gerade über den Anmelde-Link hereingekommen — die bisherige PIN ist nicht nötig. */
  frisch: boolean;
  /** Die hinterlegte E-Mail-Adresse — Ziel des Anmelde-Links bei „PIN vergessen?“. */
  email: string;
  geburtsdatum: string | null;
  onGespeichert?: () => void;
}) {
  const basis = basisProp ?? (demo ? "/app/demo" : "/app");
  // Eigener Zustand: Nach dem ersten Speichern gibt es eine PIN, und ein abgelaufenes „frisch“ schaltet auf die Änderungsmaske um.
  const [hatPin, setHatPin] = useState<boolean>(demo ? true : gesetzt !== false);
  const [ohneAlt, setOhneAlt] = useState<boolean>(!demo && frisch);
  const [alt, setAlt] = useState("");
  const [neu, setNeu] = useState("");
  const [neu2, setNeu2] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<Meldung | null>(null);
  const [feldFehler, setFeldFehler] = useState<Partial<Record<Feld, string>>>({});
  const [fertig, setFertig] = useState(false);
  const [linkLaeuft, setLinkLaeuft] = useState(false);
  const [linkSatz, setLinkSatz] = useState<Meldung | null>(null);

  const mitAlt = hatPin && !ohneAlt;
  const geburt = geburtAus(geburtsdatum);
  // Vorabprüfung: erst bei vier Ziffern — vorher wäre jede Meldung ein Vorwurf beim Tippen.
  const neuGrund = neu.length === 4 ? pinPruefen(neu, geburt) : null;
  const gleichWieAlt = mitAlt && alt.length === 4 && neu.length === 4 && alt === neu;
  const wiederholungFalsch = neu2.length === 4 && neu.length === 4 && neu2 !== neu;
  const bereit = !demo && !laeuft && neu.length === 4 && neu2.length === 4 && !neuGrund && !gleichWieAlt && !wiederholungFalsch && (!mitAlt || alt.length === 4);

  const leeren = () => { setAlt(""); setNeu(""); setNeu2(""); };
  const feld = (f: Feld, v: string) => {
    if (f === "alt") setAlt(v); else if (f === "neu") setNeu(v); else setNeu2(v);
    if (feldFehler[f]) setFeldFehler({ ...feldFehler, [f]: undefined });
    if (meldung) setMeldung(null);
    if (fertig) setFertig(false);
  };

  const senden = async (e: FormEvent) => {
    e.preventDefault();
    if (demo) { setMeldung({ ton: "gut", text: "In der Demo-Ansicht wird nichts geändert." }); return; }
    if (!bereit) return;
    setLaeuft(true); setMeldung(null); setFeldFehler({});
    ereignisMelden(kundeRef, demo, "pin", "knopf");
    // Die Ziffern verlassen den Zustand, sobald sie unterwegs sind — auch im Fehlerfall tippt der Kunde neu.
    const body = JSON.stringify(mitAlt ? { alt, neu } : { neu });
    leeren();
    try {
      const r = await api(`/kunde/${encodeURIComponent(kundeRef)}/pin`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
      setLaeuft(false);
      if (r.ok && r.json?.ok) {
        setHatPin(true); setOhneAlt(false); setFertig(true);
        setMeldung({ ton: "gut", text: "Ihre neue PIN ist gespeichert." });
        ereignisMelden(kundeRef, demo, "pin", "fertig");
        onGespeichert?.();
        return;
      }
      const code = String(r.json?.code || "");
      const satz = String(r.json?.meldung || r.json?.error || "");
      if (r.status === 401) { setMeldung({ ton: "fehler", text: "Ihre Anmeldung ist abgelaufen. Bitte melden Sie sich noch einmal an." }); return; }
      if (code === "ALT_FALSCH") {
        const rest = typeof r.json?.restVersuche === "number" ? r.json.restVersuche : null;
        setFeldFehler({ alt: `Die bisherige PIN stimmt nicht.${rest !== null ? ` Noch ${rest} ${rest === 1 ? "Versuch" : "Versuche"}, dann ist die PIN ${PIN_SPERRE_MINUTEN} Minuten gesperrt.` : ""}` });
        return;
      }
      if (code === "GESPERRT") {
        setFeldFehler({ alt: satz || `Zu viele Versuche. Bitte warten Sie ${PIN_SPERRE_MINUTEN} Minuten.` });
        setMeldung({ ton: "fehler", text: "Die PIN ist vorübergehend gesperrt. Mit „PIN vergessen?“ legen Sie über einen Anmelde-Link sofort eine neue fest." });
        return;
      }
      if (code === "ALT_NOETIG") {
        // Das „frisch“ aus dem Anmelde-Link gilt 15 Minuten — danach braucht es wieder die bisherige PIN.
        setHatPin(true); setOhneAlt(false);
        setFeldFehler({ alt: frisch ? "Die Anmeldung über den Link ist älter als 15 Minuten. Bitte geben Sie Ihre bisherige PIN ein – oder fordern Sie unten einen neuen Link an." : (satz || "Bitte geben Sie zuerst Ihre bisherige PIN ein.") });
        return;
      }
      if (code === "SCHWACH") { setFeldFehler({ neu: satz || "Bitte wählen Sie eine andere PIN." }); return; }
      setMeldung({ ton: "fehler", text: satz || "Ihre PIN konnte gerade nicht gespeichert werden. Bitte versuchen Sie es noch einmal." });
    } catch {
      setLaeuft(false);
      setMeldung({ ton: "fehler", text: "Ohne Verbindung lässt sich nichts speichern. Bitte tippen Sie die PIN gleich noch einmal ein." });
    }
  };

  // „PIN vergessen?“ — derselbe Anmelde-Link wie auf /app/login, mit dem Ziel dieser Seite.
  const vergessen = async () => {
    if (demo) { setLinkSatz({ ton: "gut", text: "In der Demo-Ansicht wird kein Link verschickt." }); return; }
    const adresse = email.trim();
    if (!adresse) { setLinkSatz({ ton: "fehler", text: "Für Ihr Konto ist keine E-Mail-Adresse hinterlegt. Bitte wenden Sie sich an Ihre Ansprechperson – sie hilft Ihnen weiter." }); return; }
    setLinkLaeuft(true); setLinkSatz(null);
    try {
      const r = await fetch("/api/fiaon/app/login-link", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ email: adresse, weiter: "/app/mehr/pin" }) });
      if (!r.ok) throw new Error(String(r.status));
      setLinkSatz({ ton: "gut", text: "Wir haben Ihnen einen Anmelde-Link an Ihre hinterlegte E-Mail-Adresse geschickt. Er gilt 60 Minuten. Öffnen Sie ihn – Sie landen direkt hier und legen eine neue PIN fest, ohne die bisherige einzugeben. Bitte sehen Sie auch im Spam-Ordner nach." });
    } catch {
      setLinkSatz({ ton: "fehler", text: "Der Link konnte gerade nicht angefordert werden. Bitte versuchen Sie es in einem Moment noch einmal." });
    }
    setLinkLaeuft(false);
  };

  return (
    <>
      <style>{PIN_STIL}</style>
      <Link href={`${basis}/mehr`} className="ap-textknopf ap-auf">← Zurück</Link>
      <h1 className="ap-gruss ap-auf" style={{ marginTop: 0 }}>
        Persönliche PIN
        <small>{hatPin ? "Vier Ziffern, an denen wir Sie am Telefon erkennen." : "Legen Sie vier Ziffern fest, an denen wir Sie am Telefon erkennen."}</small>
      </h1>
      {demo && <div className="ap-demo-band ap-auf"><b>Demo-Ansicht</b><span>Nur Anzeige – hier wird nichts geändert.</span></div>}

      <div className="ap-karte ap-auf v1" data-fiaon="pin-erklaerung">
        <p style={{ margin: 0 }}>Mit Ihrer persönlichen FIAON-PIN erkennen wir Sie am Telefon. Sie ist nicht die PIN Ihrer Karte – geben Sie sie nie an Dritte weiter.</p>
      </div>

      {!hatPin && !fertig && (
        <div className="ap-band ap-auf v1">
          <div>
            <b>Für Ihr Konto ist noch keine PIN festgelegt.</b>
            <span>Mit PIN können wir Sie am Telefon sicher erkennen – auch, wenn Sie von einer anderen Nummer anrufen.</span>
          </div>
        </div>
      )}
      {hatPin && ohneAlt && !fertig && (
        <div className="ap-band ap-auf v1">
          <div>
            <b>Sie sind über den Anmelde-Link hereingekommen.</b>
            <span>Legen Sie jetzt eine neue PIN fest – die bisherige brauchen Sie dafür nicht.</span>
          </div>
        </div>
      )}

      <form className="ap-karte ap-form ap-auf v1" onSubmit={senden} noValidate data-fiaon="pin-form">
        {mitAlt && (
          <PinFeld id="alt" titel="Bisherige PIN" wert={alt} setzen={(v) => feld("alt", v)} aus={laeuft || demo}
            satz={feldFehler.alt ?? null} ton={feldFehler.alt ? "fehler" : null} />
        )}
        <PinFeld id="neu" titel="Neue PIN" wert={neu} setzen={(v) => feld("neu", v)} aus={laeuft || demo}
          satz={feldFehler.neu ?? neuGrund ?? (gleichWieAlt ? "Die neue PIN ist dieselbe wie die bisherige. Bitte wählen Sie eine andere." : null)}
          ton={feldFehler.neu || neuGrund || gleichWieAlt ? "fehler" : null} />
        <PinFeld id="neu2" titel="Neue PIN wiederholen" wert={neu2} setzen={(v) => feld("neu2", v)} aus={laeuft || demo}
          satz={feldFehler.neu2 ?? (wiederholungFalsch ? "Die beiden Eingaben stimmen nicht überein." : neu2.length === 4 && neu.length === 4 && !neuGrund ? "Stimmt überein." : null)}
          ton={feldFehler.neu2 || wiederholungFalsch ? "fehler" : neu2.length === 4 && neu.length === 4 && !neuGrund ? "gut" : null} />
        <p className="ap-fuss" style={{ margin: "2px 2px 0" }}>Vier Ziffern, ganz nach Ihrer Wahl.</p>
        {!demo && (
          <button type="submit" className="ap-knopf" disabled={!bereit}>
            {laeuft ? "Wird gespeichert …" : hatPin ? "PIN ändern" : "PIN festlegen"}
          </button>
        )}
        {meldung && <div className={`ap-meldung ${meldung.ton}`} role="status" data-fiaon="pin-meldung">{meldung.text}</div>}
      </form>

      <div className="ap-karte ap-auf v2">
        <p style={{ marginTop: 0 }}>Wir speichern Ihre PIN nur als geschützten Prüfwert, nie im Klartext, und zeigen sie nirgends an. Sie nennen sie nur, wenn Sie mit uns telefonieren und wir Sie erkennen sollen – wir fragen sie niemals per E-Mail, SMS oder WhatsApp ab.</p>
        {hatPin && (
          <>
            <button type="button" className="ap-textknopf" onClick={() => void vergessen()} disabled={linkLaeuft} data-fiaon="pin-vergessen" style={{ marginTop: 8 }}>
              {linkLaeuft ? "Wird angefordert …" : "PIN vergessen?"}
            </button>
            {linkSatz && <div className={`ap-meldung ${linkSatz.ton}`} role="status">{linkSatz.text}</div>}
          </>
        )}
      </div>
    </>
  );
}
