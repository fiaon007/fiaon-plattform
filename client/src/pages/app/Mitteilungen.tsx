// ═══════════════════════════════════════════════════════════════════════════
// /app/mehr/mitteilungen — Push ein- und ausschalten (Bauvorlage 3.14, Scheibe 6)
//
// Regel: Jede Nachricht kommt per E-Mail. Push ist die zusätzliche Stimme auf
// dem Handy — nur bei Zustandswechseln mit Beleg, nie Werbung, nie nachts
// (server/lib/fiaon-push.ts). Kein Banner, keine Aufforderung an anderer
// Stelle: Der Kunde kommt hierher, liest den einen Satz und entscheidet.
//
// Zustände: laden · nicht verfügbar (Server ohne Schlüssel) · nicht möglich
// (Browser kann es nicht) · iPhone ohne Installation (Teilen-Anleitung) ·
// abgelehnt (Erlaubnis verweigert) · aus · an. Der Service Worker
// (/app-sw.js, Scope /app/) wird erst beim Einschalten registriert.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { api } from "./Bausteine";

type Zustand = "laden" | "nicht_verfuegbar" | "nicht_moeglich" | "iphone_installieren" | "abgelehnt" | "aus" | "an" | "keine_person";

const SW_PFAD = "/app-sw.js";
const SW_SCOPE = "/app/";

/** VAPID-Schlüssel (URL-Base64) → Bytes für pushManager.subscribe. */
function schluesselBytes(base64: string): ArrayBuffer {
  const auffuellen = "=".repeat((4 - (base64.length % 4)) % 4);
  const roh = window.atob((base64 + auffuellen).replace(/-/g, "+").replace(/_/g, "/"));
  const puffer = new ArrayBuffer(roh.length);
  const bytes = new Uint8Array(puffer);
  for (let i = 0; i < roh.length; i++) bytes[i] = roh.charCodeAt(i);
  return puffer;
}

const istIos = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const istInstalliert = () => {
  try { return window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true; } catch { return false; }
};
const browserKann = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export function Mitteilungen({ kundeRef, demo, basis }: { kundeRef: string; demo: boolean; basis?: string }) {
  const zurueck = `${basis ?? (demo ? "/app/demo" : "/app")}/mehr`;
  const [zustand, setZustand] = useState<Zustand>(demo ? "aus" : "laden");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ ton: "gut" | "fehler" | "still"; text: string } | null>(null);
  const [grund, setGrund] = useState<string | null>(null);

  useEffect(() => {
    if (demo) return;
    let aktiv = true;
    (async () => {
      // 1. Was der Server kann (Schlüssel vorhanden?) und ob dieses Gerät schon angemeldet ist.
      let endpoint: string | null = null;
      let browserAbo: PushSubscription | null = null;
      if (browserKann()) {
        try {
          const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
          browserAbo = reg ? await reg.pushManager.getSubscription() : null;
          endpoint = browserAbo?.endpoint ?? null;
        } catch { /* kein Zugriff — dann eben ohne Endpunkt fragen */ }
      }
      const r = await api(`/kunde/${encodeURIComponent(kundeRef)}/app/push${endpoint ? `?endpoint=${encodeURIComponent(endpoint)}` : ""}`);
      if (!aktiv) return;
      if (r.json?.ok === false && r.json?.grund === "keine_person") { setGrund(r.json.text || "Ihre Akte wird gerade mit Ihrer Person verknüpft. Bis dahin erreichen wir Sie per E-Mail."); setZustand("keine_person"); return; }
      if (!r.ok || !r.json) { setMeldung({ ton: "fehler", text: r.json?.error || "Ihre Mitteilungs-Einstellung konnte gerade nicht geladen werden." }); setZustand("nicht_moeglich"); return; }
      if (!r.json.verfuegbar) { setZustand("nicht_verfuegbar"); return; }
      setPublicKey(r.json.publicKey || null);
      // 2. Was der Browser kann.
      if (!browserKann()) { setZustand(istIos() && !istInstalliert() ? "iphone_installieren" : "nicht_moeglich"); return; }
      if (istIos() && !istInstalliert()) { setZustand("iphone_installieren"); return; }
      if (Notification.permission === "denied") { setZustand("abgelehnt"); return; }
      setZustand(browserAbo && r.json.abonniert ? "an" : "aus");
    })().catch(() => { if (aktiv) { setMeldung({ ton: "fehler", text: "Ihre Mitteilungs-Einstellung konnte gerade nicht geladen werden." }); setZustand("nicht_moeglich"); } });
    return () => { aktiv = false; };
  }, [kundeRef, demo]);

  const einschalten = async () => {
    if (demo) { setMeldung({ ton: "still", text: "In der Demo-Ansicht werden keine Mitteilungen eingeschaltet. Bei echten Kunden fragt das Gerät hier einmal nach der Erlaubnis." }); return; }
    if (!publicKey) return;
    setLaeuft(true); setMeldung(null);
    try {
      const reg = await navigator.serviceWorker.register(SW_PFAD, { scope: SW_SCOPE });
      const erlaubnis = await Notification.requestPermission();
      if (erlaubnis !== "granted") {
        setZustand(erlaubnis === "denied" ? "abgelehnt" : "aus");
        setMeldung({ ton: "still", text: erlaubnis === "denied" ? "Sie haben Mitteilungen für dieses Gerät abgelehnt. Per E-Mail erreichen wir Sie weiterhin." : "Sie haben die Frage offen gelassen. Sie können sie jederzeit hier noch einmal beantworten." });
        return;
      }
      const bereit = await navigator.serviceWorker.ready;
      const abo = (await bereit.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: schluesselBytes(publicKey) }));
      const r = await api(`/kunde/${encodeURIComponent(kundeRef)}/app/push`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: abo.toJSON() }) });
      if (r.ok && r.json?.ok && r.json.abonniert) { setZustand("an"); setMeldung({ ton: "gut", text: r.json.text || "Mitteilungen sind eingeschaltet." }); }
      else if (r.json?.verfuegbar === false) setZustand("nicht_verfuegbar");
      else setMeldung({ ton: "fehler", text: r.json?.error || "Die Mitteilungen konnten gerade nicht eingeschaltet werden. Bitte versuchen Sie es gleich noch einmal." });
    } catch (e: any) {
      const text = String(e?.name || "") === "NotAllowedError"
        ? "Ihr Browser hat die Mitteilungen nicht zugelassen. Per E-Mail erreichen wir Sie weiterhin."
        : "Die Mitteilungen konnten auf diesem Gerät nicht eingeschaltet werden. Per E-Mail erreichen wir Sie weiterhin.";
      setMeldung({ ton: "fehler", text });
    } finally { setLaeuft(false); }
  };

  const ausschalten = async () => {
    if (demo) { setMeldung({ ton: "still", text: "In der Demo-Ansicht gibt es nichts auszuschalten." }); return; }
    setLaeuft(true); setMeldung(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
      const abo = reg ? await reg.pushManager.getSubscription() : null;
      if (abo) {
        const r = await api(`/kunde/${encodeURIComponent(kundeRef)}/app/push`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: abo.endpoint }) });
        if (!r.ok) { setMeldung({ ton: "fehler", text: r.json?.error || "Die Mitteilungen konnten gerade nicht ausgeschaltet werden." }); return; }
        try { await abo.unsubscribe(); } catch { /* der Server kennt das Abo schon als gelöscht */ }
      }
      setZustand("aus");
      setMeldung({ ton: "still", text: "Mitteilungen auf diesem Gerät sind ausgeschaltet. Per E-Mail erreichen wir Sie weiterhin." });
    } catch {
      setMeldung({ ton: "fehler", text: "Die Mitteilungen konnten gerade nicht ausgeschaltet werden. Bitte versuchen Sie es gleich noch einmal." });
    } finally { setLaeuft(false); }
  };

  return (
    <>
      <Link href={zurueck} className="ap-link ap-auf" style={{ display: "inline-flex", alignItems: "center", minHeight: 40, fontSize: 15 }}>← Zurück</Link>
      <h1 className="ap-gruss ap-auf" style={{ marginTop: 0 }}>Mitteilungen<small>Jede Nachricht kommt per E-Mail. Auf Wunsch zusätzlich auf dieses Gerät.</small></h1>

      <div className="ap-karte ap-auf v1">
        <h3>Wann wir uns melden</h3>
        <p>Nur, wenn sich in Ihrer Akte etwas ändert: eine Zahlung ist eingegangen, ein Schreiben wartet auf Ihre Unterschrift, ein Antrag ist unterwegs, eine Antwort liegt vor, Ihr Monatsbericht ist da.</p>
        <p>Keine Werbung. Nichts zwischen 21 und 8 Uhr. Höchstens eine Mitteilung am Tag.</p>
      </div>

      {zustand === "laden" && <div className="ap-skelett ap-auf v2" style={{ height: 120, borderRadius: 14 }} />}

      {zustand === "keine_person" && <div className="ap-karte ap-leer ap-auf v2"><b>Noch einen Moment.</b>{grund}</div>}

      {zustand === "nicht_verfuegbar" && (
        <div className="ap-karte ap-auf v2">
          <h3>Noch nicht verfügbar</h3>
          <p>Mitteilungen auf das Gerät gibt es hier noch nicht. Per E-Mail erreichen wir Sie weiterhin – dort steht alles, was Sie hier sehen würden.</p>
        </div>
      )}

      {zustand === "nicht_moeglich" && (
        <div className="ap-karte ap-auf v2">
          <h3>Auf diesem Gerät nicht möglich</h3>
          <p>Ihr Browser unterstützt Mitteilungen von Webseiten nicht. Per E-Mail erreichen wir Sie weiterhin – dort steht alles, was Sie hier sehen würden.</p>
        </div>
      )}

      {zustand === "iphone_installieren" && (
        <div className="ap-karte ap-auf v2">
          <h3>Auf dem iPhone: erst auf den Home-Bildschirm</h3>
          <p>Mitteilungen bekommt Mein FIAON auf dem iPhone nur, wenn es wie eine App auf dem Home-Bildschirm liegt. Das dauert drei Schritte in Safari:</p>
          <ol className="ap-etappen" style={{ marginTop: 8 }}>
            <li className="ap-etappe"><span className="ap-punkt"><span style={{ color: "var(--fi-text-still)", fontSize: 12 }}>1</span></span><div><b>Teilen antippen</b><small>Das Viereck mit dem Pfeil nach oben, unten in der Mitte.</small></div><span /></li>
            <li className="ap-etappe"><span className="ap-punkt"><span style={{ color: "var(--fi-text-still)", fontSize: 12 }}>2</span></span><div><b>„Zum Home-Bildschirm“ wählen</b><small>Etwas weiter unten in der Liste.</small></div><span /></li>
            <li className="ap-etappe"><span className="ap-punkt"><span style={{ color: "var(--fi-text-still)", fontSize: 12 }}>3</span></span><div><b>„Hinzufügen“ antippen</b><small>Öffnen Sie Mein FIAON dann vom Home-Bildschirm und kommen Sie hierher zurück.</small></div><span /></li>
          </ol>
          <p className="ap-fuss" style={{ marginTop: 10 }}>Bis dahin erreichen wir Sie per E-Mail.</p>
        </div>
      )}

      {zustand === "abgelehnt" && (
        <div className="ap-karte ap-auf v2">
          <h3>Für dieses Gerät abgelehnt</h3>
          <p>Sie haben Mitteilungen für Mein FIAON in Ihrem Browser abgelehnt. Wenn Sie es sich anders überlegen, erlauben Sie sie in den Einstellungen Ihres Browsers unter „Mitteilungen“ oder „Benachrichtigungen“ für diese Seite und kommen Sie hierher zurück.</p>
          <p className="ap-fuss" style={{ marginTop: 10 }}>Per E-Mail erreichen wir Sie weiterhin.</p>
        </div>
      )}

      {zustand === "aus" && (
        <div className="ap-karte ap-auf v2">
          <h3>Auf diesem Gerät: aus</h3>
          <p>Ihr Gerät fragt einmal nach der Erlaubnis. Danach entscheiden Sie hier jederzeit neu.</p>
          <button type="button" className="ap-knopf" style={{ marginTop: 14 }} onClick={einschalten} disabled={laeuft || (!demo && !publicKey)}>{laeuft ? "Einen Moment …" : "Mitteilungen einschalten"}</button>
        </div>
      )}

      {zustand === "an" && (
        <div className="ap-karte ap-auf v2">
          <div className="ap-karte-kopf"><h3>Auf diesem Gerät: an</h3><span className="ap-status gut">Eingeschaltet</span></div>
          <p>Sie erhalten Mitteilungen auf dieses Gerät – und weiterhin jede Nachricht per E-Mail.</p>
          <button type="button" className="ap-link" style={{ background: "none", border: 0, padding: 0, marginTop: 12, minHeight: 44, fontSize: 15, cursor: "pointer" }} onClick={ausschalten} disabled={laeuft}>{laeuft ? "Einen Moment …" : "Ausschalten"}</button>
        </div>
      )}

      {meldung && <div className={`ap-meldung${meldung.ton === "gut" ? " gut" : meldung.ton === "fehler" ? " fehler" : ""}`} role="status">{meldung.text}</div>}
      <p className="ap-fuss ap-auf v3">Mitteilungen gelten je Gerät. Auf einem zweiten Handy oder Rechner schalten Sie sie dort gesondert ein.</p>
    </>
  );
}
