// ═══════════════════════════════════════════════════════════════════════════
// Einrichtung — die Ebene über dem frischen Kundenbereich (23.08.2026)
//
// Justin: „Nach dem Vertrag ist er eingeloggt, sieht unscharf sein Konto, legt
// ein Passwort fest, dann die Zahlungsdetails (smart: alles zum Kopieren, QR)
// — oder die Frage, ob er vorher einen Termin mit einem Mitarbeiter möchte."
//
// Drei Schritte auf Glas über dem unscharfen Bereich:
//   1 · Passwort festlegen (POST /kunde/:ref/passwort-setzen)
//   2 · Wie weiter? „Jetzt aktivieren“ oder „Zuerst sprechen“
//   3a · Zahlungsdaten: Betrag, IBAN, Verwendungszweck (kopierbar), QR für die
//        Banking-App, „Ich habe überwiesen“ (claim-paid)
//   3b · Termin: Link aus /antrag/:ref/termin-link → Terminseite. Ein Gespräch,
//        nicht zwei — ist die Zahlung bis dahin da, wird es das Startgespräch.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { buildEpcQrPayload } from "@/lib/epc-qr";

interface BereichMin { kunde: { ref: string; vorname: string }; paket: { name: string; monatlichCents: number | null; zahlungsreferenz: string | null; zahlungsstatus: string; faelligAm: string | null }; stufe: { bezahlt: boolean; vollAktiv: boolean }; passwortGesetzt?: boolean; termin: { beginn: string; status: string; agent: string | null } | null }
interface Order { paymentReference: string; amountDue: string; dueDate: string; status: string; bank: { recipient: string; iban: string; ibanDisplay?: string; bic: string } }

async function api(pfad: string, init?: RequestInit) {
  const r = await fetch(`/api/fiaon${pfad}`, { credentials: "include", headers: init?.body ? { "Content-Type": "application/json" } : undefined, ...init });
  const j = await r.json().catch(() => null); return { ok: r.ok && j?.ok, status: r.status, json: j };
}
const eurCents = (c: number | null | undefined) => c == null ? "—" : new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(c / 100);

/** Welche Stufe der Einrichtung ist dran? Reine Funktion — der Bereich fragt dieselbe. */
export function einrichtungsPhase(b: BereichMin): "passwort" | "wahl" | "terminPflicht" | "zahlungOffen" | "fertig" {
  const bezahlt = b.stufe.bezahlt || b.paket.zahlungsstatus === "claimed_paid";
  const terminDa = !!b.termin && (b.termin.status === "gebucht" || b.termin.status === "erledigt");
  if (b.passwortGesetzt === false) return "passwort";
  if (b.stufe.vollAktiv) return "fertig";
  if (!bezahlt && !terminDa) return "wahl";
  if (bezahlt && !terminDa) return "terminPflicht";   // bezahlt, aber kein Startgespräch: die Plattform bleibt versperrt
  if (!bezahlt && terminDa) return "zahlungOffen";    // Gespräch gebucht, Paket offen: sichtbar, aber nicht versperrt
  return "fertig";
}

export function Einrichtung({ bereich, name, start = "auto", onFertig }: { bereich: BereichMin; name: string; start?: "auto" | "zahlung"; onFertig: () => void }) {
  const phase = einrichtungsPhase(bereich);
  const [schritt, setSchritt] = useState<"passwort" | "wahl" | "zahlung" | "termin" | "terminPflicht">(
    start === "zahlung" ? "zahlung" : phase === "passwort" ? "passwort" : phase === "terminPflicht" ? "terminPflicht" : "wahl");
  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState(""); const [zeigen, setZeigen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [kopiert, setKopiert] = useState<string | null>(null);
  const [gemeldet, setGemeldet] = useState(false);
  const ref = bereich.kunde.ref;

  useEffect(() => {
    if (schritt !== "zahlung" || order) return;
    const pr = bereich.paket.zahlungsreferenz;
    if (!pr) { setFehler("Für Ihr Konto liegt noch kein Zahlungsauftrag vor – Ihre Ansprechpartnerin meldet sich."); return; }
    fetch(`/api/fiaon/payment-order/${encodeURIComponent(pr)}`).then((r) => r.json()).then((j) => { if (j?.ok) setOrder(j); else setFehler(j?.error || "Zahlungsdaten nicht ladbar."); }).catch(() => setFehler("Keine Verbindung."));
  }, [schritt, order, bereich.paket.zahlungsreferenz]);

  const passwortSetzen = async (e: React.FormEvent) => {
    e.preventDefault(); setFehler(null);
    if (pw.length < 8) return setFehler("Mindestens 8 Zeichen.");
    if (pw !== pw2) return setFehler("Die Passwörter stimmen nicht überein.");
    setLaeuft(true);
    const r = await api(`/kunde/${encodeURIComponent(ref)}/passwort-setzen`, { method: "POST", body: JSON.stringify({ neu: pw }) });
    setLaeuft(false);
    if (r.ok || r.status === 409) setSchritt(phase === "terminPflicht" || (bereich.stufe.bezahlt && !bereich.termin) ? "terminPflicht" : "wahl"); else setFehler(r.json?.error || "Das Passwort konnte nicht gespeichert werden.");
  };
  const kopieren = async (was: string, wert: string) => { try { await navigator.clipboard.writeText(wert); setKopiert(was); setTimeout(() => setKopiert(null), 1800); } catch { /* egal */ } };
  const terminBuchen = async () => {
    setLaeuft(true); setFehler(null);
    const s1 = await api(`/kunde/${encodeURIComponent(ref)}/startgespraech`);
    if (s1.ok && s1.json?.token) { window.location.href = `/termin/${encodeURIComponent(s1.json.token)}`; return; }
    const r = await api(`/antrag/${encodeURIComponent(ref)}/termin-link`);
    setLaeuft(false);
    if (r.ok && r.json.url) window.location.href = r.json.url; else setFehler(r.json?.error || "Der Terminlink konnte nicht erzeugt werden.");
  };
  const ueberwiesen = async () => {
    if (!order) return; setLaeuft(true);
    await api(`/payment-order/${encodeURIComponent(order.paymentReference)}/claim-paid`, { method: "POST" }).catch(() => null);
    setLaeuft(false); setGemeldet(true);
  };

  const betrag = order ? Number(order.amountDue) : (bereich.paket.monatlichCents || 0) / 100;
  const qr = order ? buildEpcQrPayload({ recipient: order.bank.recipient, iban: order.bank.iban, bic: order.bank.bic, amount: betrag, remittance: order.paymentReference }) : "";

  return (
    <div className="mb-vorhang ein" role="dialog" aria-label="Ihr Konto einrichten">
      <div className="ein-karte">
        <div className="ein-schritte" aria-hidden="true">
          {["Passwort", "Wie weiter", schritt === "termin" || schritt === "terminPflicht" ? "Gespräch" : "Zahlung"].map((t, i) => {
            const nr = schritt === "passwort" ? 0 : schritt === "wahl" ? 1 : 2;
            return <span key={t} className={i < nr ? "ok" : i === nr ? "an" : ""}>{t}</span>;
          })}
        </div>

        {schritt === "passwort" && (
          <form onSubmit={passwortSetzen} className="ein-innen">
            <p className="ein-ueber">Willkommen, {bereich.kunde.vorname || name}</p>
            <h2>Legen Sie Ihr <span>Passwort</span> fest.</h2>
            <p className="ein-text">Damit kommen Sie jederzeit zurück in Ihren Bereich – am Handy wie am Rechner. Mindestens 8 Zeichen.</p>
            <label className="ein-feld"><span>Passwort</span><div className="ein-pw"><input type={zeigen ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" autoFocus /><button type="button" onClick={() => setZeigen(!zeigen)}>{zeigen ? "Verbergen" : "Anzeigen"}</button></div></label>
            <label className="ein-feld"><span>Passwort wiederholen</span><input type={zeigen ? "text" : "password"} value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" /></label>
            <div className="ein-staerke" aria-hidden="true">{[8, 10, 12].map((n) => <i key={n} className={pw.length >= n ? "ok" : ""} />)}</div>
            {fehler && <p className="ein-fehler">{fehler}</p>}
            <button type="submit" className="mb-knopf" disabled={laeuft}>{laeuft ? "Wird gespeichert …" : "Passwort speichern"}</button>
          </form>
        )}

        {schritt === "wahl" && (
          <div className="ein-innen">
            <p className="ein-ueber">Ihr Konto ist angelegt</p>
            <h2>Wie möchten Sie <span>weitermachen?</span></h2>
            <p className="ein-text">Beides ist richtig. Wer zuerst sprechen möchte, bekommt einen Termin mit einem Mitarbeiter – und derselbe Termin wird zum Startgespräch, sobald die Zahlung da ist. Niemand telefoniert zweimal.</p>
            <div className="ein-wahl">
              <button type="button" className="ein-option haupt" onClick={() => setSchritt("zahlung")}>
                <span className="ein-band">Empfohlen</span>
                <small>Weg 1</small><b>Jetzt aktivieren</b>
                <p>Zahlungsdaten mit QR-Code für Ihre Banking-App. Nach Zahlungseingang ist Ihr Bereich vollständig aktiv und Ihre Auskunft wird beantragt.</p>
                <span>{eurCents(bereich.paket.monatlichCents)} · monatlich</span>
              </button>
              <button type="button" className="ein-option" onClick={() => setSchritt("termin")}>
                <small>Weg 2</small><b>Zuerst sprechen</b>
                <p>Ein Mitarbeiter ruft Sie zur gewählten Zeit an, beantwortet Ihre Fragen und geht den Bereich mit Ihnen durch. Zahlen können Sie danach – oder im Gespräch.</p>
                <span>15 Minuten · kostenlos</span>
              </button>
            </div>
            <button type="button" className="ein-leise" onClick={onFertig}>Später entscheiden – erst einmal umsehen</button>
          </div>
        )}

        {schritt === "zahlung" && (
          <div className="ein-innen">
            <p className="ein-ueber">Weg 1 · Konto aktivieren</p>
            <h2>Ihre <span>Zahlungsdaten.</span></h2>
            {!order && !fehler && <p className="ein-text">Zahlungsdaten werden geladen …</p>}
            {fehler && <p className="ein-fehler">{fehler}</p>}
            {order && !gemeldet && (
              <div className="ein-zahlung">
                <div className="ein-zahlung-daten">
                  {[["Betrag", `${betrag.toFixed(2).replace(".", ",")} €`, betrag.toFixed(2)], ["Empfänger", order.bank.recipient, order.bank.recipient], ["IBAN", order.bank.ibanDisplay || order.bank.iban, order.bank.iban], ["BIC", order.bank.bic, order.bank.bic], ["Verwendungszweck", order.paymentReference, order.paymentReference]].map(([l, anz, roh]) => (
                    <button key={l} type="button" className="ein-zeile" onClick={() => kopieren(l, roh)} title="Kopieren">
                      <span>{l}</span><b className={l === "IBAN" || l === "Verwendungszweck" ? "zahl" : ""}>{anz}</b><small>{kopiert === l ? "Kopiert" : "Kopieren"}</small>
                    </button>
                  ))}
                  <p className="ein-hinweis">Bitte den Verwendungszweck genau so eintragen – er ordnet Ihre Zahlung Ihrem Konto zu. Fällig bis {new Date(order.dueDate).toLocaleDateString("de-DE")}.</p>
                </div>
                <div className="ein-qr">
                  <div className="ein-qr-bild"><QRCodeSVG value={qr} size={168} level="M" marginSize={2} bgColor="#ffffff" fgColor="#0f172a" /></div>
                  <p>Mit der Banking-App scannen – alle Daten sind dann ausgefüllt.</p>
                </div>
              </div>
            )}
            {order && !gemeldet && (
              <div className="ein-knoepfe">
                <button type="button" className="mb-knopf" onClick={ueberwiesen} disabled={laeuft}>Ich habe überwiesen</button>
                <button type="button" className="mb-knopf still" onClick={() => setSchritt("wahl")}>Zurück</button>
              </div>
            )}
            {gemeldet && (
              <div className="ein-fertig">
                <b>Danke – wir prüfen den Eingang.</b>
                <p>Ein Schritt noch: Ihr Startgespräch. Fünfzehn Minuten mit Ihrer Ansprechpartnerin – danach ist Ihr Bereich vollständig freigeschaltet und Ihre Auskunft wird beantragt.</p>
                <button type="button" className="mb-knopf" onClick={() => setSchritt("terminPflicht")}>Startgespräch buchen</button>
              </div>
            )}
          </div>
        )}

        {schritt === "terminPflicht" && (
          <div className="ein-innen">
            <p className="ein-ueber">Noch ein Schritt</p>
            <h2>Buchen Sie Ihr <span>Startgespräch.</span></h2>
            <p className="ein-text">Ihre Zahlung ist {bereich.stufe.bezahlt ? "eingegangen" : "gemeldet"}. Bevor Ihr Bereich vollständig freigeschaltet wird, geht Ihre Ansprechpartnerin den Bereich mit Ihnen durch: Fahrplan, Unterlagen, Auskunft – fünfzehn Minuten am Telefon. Wählen Sie jetzt eine Zeit.</p>
            <div className="ein-zeilen">
              <div className="ein-merk"><b>15 Minuten</b><span>am Telefon, zur Zeit Ihrer Wahl</span></div>
              <div className="ein-merk"><b>Ein Mensch</b><span>der danach Ihre Akte kennt</span></div>
              <div className="ein-merk"><b>Danach frei</b><span>alle Bereiche, Auskunft wird beantragt</span></div>
            </div>
            {fehler && <p className="ein-fehler">{fehler}</p>}
            <div className="ein-knoepfe">
              <button type="button" className="mb-knopf" onClick={terminBuchen} disabled={laeuft}>{laeuft ? "Einen Moment …" : "Zeit wählen"}</button>
            </div>
            <p className="ein-hinweis">Ohne Startgespräch bleibt der Bereich noch geschlossen – es ist der Moment, in dem aus einem Antrag eine betreute Akte wird.</p>
          </div>
        )}

        {schritt === "termin" && (
          <div className="ein-innen">
            <p className="ein-ueber">Weg 2 · Zuerst sprechen</p>
            <h2>Ihr Gespräch mit <span>FIAON.</span></h2>
            <p className="ein-text">Sie wählen Tag und Uhrzeit, ein Mitarbeiter ruft Sie an. Fünfzehn Minuten: Ihre Fragen, Ihr Paket, Ihr nächster Schritt. Ist die Zahlung bis zum Termin eingegangen, wird derselbe Termin Ihr Startgespräch – Sie müssen nichts zweimal tun.</p>
            {bereich.termin && bereich.termin.status === "gebucht" && <p className="ein-hinweis">Sie haben bereits ein Gespräch am {new Date(bereich.termin.beginn).toLocaleString("de-DE", { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })} Uhr.</p>}
            {fehler && <p className="ein-fehler">{fehler}</p>}
            <div className="ein-knoepfe">
              <button type="button" className="mb-knopf" onClick={terminBuchen} disabled={laeuft}>{laeuft ? "Einen Moment …" : "Zeit wählen"}</button>
              <button type="button" className="mb-knopf still" onClick={() => setSchritt("wahl")}>Zurück</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
