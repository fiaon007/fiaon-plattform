// ═══════════════════════════════════════════════════════════════════════════
// EmailBekannt — Hinweis im Antrag, wenn es zu der E-Mail schon etwas gibt
// (23.08.2026, Justin: „beim Antrag die Mail abgleichen … und wenn er schon
// mal einen Antrag gestellt hat, da weitermachen, wo er aufgehört hat").
//
// Drei Fälle nach `GET /api/fiaon/antrag/email-bekannt`:
//   · Konto mit Passwort          → „Anmelden" (der Bereich kennt den Stand)
//   · Antrag begonnen, unfertig   → „Weitermachen, wo ich aufgehört habe"
//                                    = signierter Weiter-Link per E-Mail
//                                    (POST /antrag/weiter-link); die Mail ist
//                                    der Nachweis, nicht die Adresse
//   · sonst bekannt               → „Passwort setzen"
// Blockiert nichts — wer neu beginnen will, macht einfach unten weiter.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";

interface Stand { email: string; bekannt: boolean; hatPasswort: boolean; unfertig: boolean; schritt: number | null }

export function EmailBekannt({ email }: { email: string }) {
  const [stand, setStand] = useState<Stand | null>(null);
  const [gesendet, setGesendet] = useState<"nein" | "laeuft" | "ja" | "fehler">("nein");
  const sauber = String(email || "").trim().toLowerCase();
  useEffect(() => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(sauber)) { setStand(null); return; }
    if (stand?.email === sauber) return;
    setGesendet("nein");
    const t = setTimeout(() => {
      fetch(`/api/fiaon/antrag/email-bekannt?email=${encodeURIComponent(sauber)}`)
        .then((r) => r.json())
        .then((j) => setStand({ email: sauber, bekannt: !!j?.bekannt, hatPasswort: !!j?.hatPasswort, unfertig: !!j?.unfertig, schritt: j?.schritt ?? null }))
        .catch(() => setStand({ email: sauber, bekannt: false, hatPasswort: false, unfertig: false, schritt: null }));
    }, 600);
    return () => clearTimeout(t);
  }, [sauber]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!stand || !stand.bekannt || stand.email !== sauber) return null;

  const weiterLink = async () => {
    setGesendet("laeuft");
    try {
      const r = await fetch("/api/fiaon/antrag/weiter-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: sauber }) });
      setGesendet(r.ok ? "ja" : "fehler");
    } catch { setGesendet("fehler"); }
  };

  if (stand.hatPasswort) return (
    <div className="antrag-email-bekannt" role="status">
      <b>Diese E-Mail-Adresse kennen wir bereits.</b>
      <p>Zu dieser Adresse gibt es ein FIAON-Konto. Melden Sie sich an – Ihr Bereich kennt Ihren Stand und führt Sie genau dort weiter.</p>
      <div className="antrag-email-bekannt-knoepfe"><a href={`/login?email=${encodeURIComponent(sauber)}`}>Anmelden</a><span>oder hier neu beginnen</span></div>
    </div>
  );
  if (stand.unfertig) return (
    <div className="antrag-email-bekannt" role="status">
      <b>Sie haben mit dieser Adresse schon einmal begonnen.</b>
      {gesendet === "ja"
        ? <p>Der Link ist unterwegs an {sauber}. Öffnen Sie ihn – Sie landen genau in dem Schritt, in dem Sie aufgehört haben. Bitte auch im Spam-Ordner nachsehen.</p>
        : <p>Ihr Antrag ist gespeichert{stand.schritt ? ` (Schritt ${stand.schritt})` : ""}. Wir schicken Ihnen einen Link, mit dem Sie genau dort weitermachen – so kommt niemand außer Ihnen an Ihre Daten.</p>}
      <div className="antrag-email-bekannt-knoepfe">
        {gesendet !== "ja" && <button type="button" onClick={weiterLink} disabled={gesendet === "laeuft"}>{gesendet === "laeuft" ? "Wird gesendet …" : gesendet === "fehler" ? "Noch einmal versuchen" : "Weitermachen, wo ich aufgehört habe"}</button>}
        <span>{gesendet === "ja" ? "Oder hier neu beginnen" : "oder hier neu beginnen"}</span>
      </div>
    </div>
  );
  return (
    <div className="antrag-email-bekannt" role="status">
      <b>Diese E-Mail-Adresse kennen wir bereits.</b>
      <p>Zu dieser Adresse gibt es bereits einen Vorgang. Setzen Sie ein Passwort, um Ihren Bereich zu öffnen – oder beginnen Sie hier neu.</p>
      <div className="antrag-email-bekannt-knoepfe"><a href={`/passwort-vergessen?email=${encodeURIComponent(sauber)}`}>Passwort setzen</a><span>oder hier neu beginnen</span></div>
    </div>
  );
}
