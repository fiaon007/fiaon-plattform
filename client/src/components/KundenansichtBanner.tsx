// ═══════════════════════════════════════════════════════════════════════════
// DER BANNER DER KUNDENSICHT
//
// ── WARUM ER NICHT WEGKLICKBAR IST ─────────────────────────────────────────
// Wer im Portal eines fremden Menschen arbeitet und das vergisst, hält dessen
// Zahlen für seine eigenen und dessen Unterlagen für die eigenen. Ein Banner,
// den man schließen kann, wird geschlossen — und dann ist die Warnung weg,
// während die Ansicht weiterläuft.
//
// ── WARUM ER GANZ OBEN LIEGT UND ALLES VERSCHIEBT ──────────────────────────
// Ein Hinweis, der Inhalt überdeckt, wird als Störung empfunden und übersehen.
// Deshalb schiebt er die Seite um seine Höhe nach unten: Er nimmt Platz ein,
// wie eine Kopfzeile, und ist damit Teil des Bildes statt darüber zu schweben.
//
// ── DIE FORM ───────────────────────────────────────────────────────────────
// Dieselbe wie beim Banner der Mitarbeiter-Ansicht (client/src/pages/agent/
// shared.tsx): dunkles Blau, Haarlinie, Auge-Zeichen, Restzeit, ein Knopf.
// Dieselbe Klasse von Warnung, also dieselbe Sprache — wer die eine kennt,
// erkennt die andere sofort.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";

interface Stand {
  name: string;
  bis: string;
  art: "admin" | "leitung";
  zurueck: string;
}

export function KundenansichtBanner(): JSX.Element | null {
  const [stand, setStand] = useState<Stand | null>(null);
  const [rest, setRest] = useState("");

  // ── ERST DER MERKER, DANN DIE WAHRHEIT ────────────────────────────────
  // Der Merker im `sessionStorage` lässt den Banner sofort erscheinen (kein
  // Aufblitzen der Seite ohne Warnung). Die WAHRHEIT ist das Cookie auf dem
  // Server: Läuft dort keine Ansicht mehr, verschwindet der Banner wieder.
  useEffect(() => {
    try {
      const roh = sessionStorage.getItem("fiaon_kundenansicht");
      if (roh) setStand(JSON.parse(roh) as Stand);
    } catch { /* kein Merker */ }

    let weg = false;
    void fetch("/api/fiaon/kundenansicht/stand", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (weg) return;
        if (j?.ok && j.aktiv) {
          setStand({ name: j.name, bis: j.bis, art: j.art, zurueck: j.zurueck });
        } else {
          // Abgelaufen oder beendet: Merker räumen, sonst behauptet der Banner
          // beim nächsten Seitenaufruf eine Ansicht, die es nicht mehr gibt.
          sessionStorage.removeItem("fiaon_kundenansicht");
          setStand(null);
        }
      })
      .catch(() => { /* Netzfehler: der Merker bleibt stehen, das ist die sichere Seite */ });
    return () => { weg = true; };
  }, []);

  useEffect(() => {
    if (!stand?.bis) return;
    const rechnen = () => {
      const m = Math.max(0, Math.round((new Date(stand.bis).getTime() - Date.now()) / 60_000));
      setRest(m > 0 ? `noch ${m} Min` : "abgelaufen");
    };
    rechnen();
    const uhr = setInterval(rechnen, 30_000);
    return () => clearInterval(uhr);
  }, [stand?.bis]);

  if (!stand) return null;

  const beenden = async () => {
    const j = await fetch("/api/fiaon/kundenansicht/beenden", {
      method: "POST", credentials: "include",
    }).then((r) => r.json()).catch(() => null);
    sessionStorage.removeItem("fiaon_kundenansicht");
    // Die Kunden-Anmeldung MIT räumen: Sonst bliebe der Betreiber im Portal
    // dieses Menschen, nur ohne Banner — der schlechteste aller Zustände.
    sessionStorage.removeItem("fiaon_user");
    window.location.href = j?.zurueck ?? stand.zurueck ?? "/admin/kunden";
  };

  return (
    <>
      {/* Platzhalter in der Höhe des Banners: Er verschiebt die Seite, statt
          Inhalt zu überdecken. */}
      <div style={{ height: 44 }} aria-hidden="true" />
      <div role="status" style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 9000,
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        padding: "8px 16px", minHeight: 44,
        background: "linear-gradient(178deg, #14264f, #0a1a3c 62%, #071129)",
        color: "#eef3fb",
        boxShadow: "0 8px 22px -12px rgba(7,17,41,.7), inset 0 -1px 0 rgba(255,255,255,.08)",
      }}>
        <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor"
             strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
             style={{ flexShrink: 0, opacity: .8 }}>
          <path d="M1.8 10S4.9 4.5 10 4.5 18.2 10 18.2 10 15.1 15.5 10 15.5 1.8 10 1.8 10Z" />
          <circle cx="10" cy="10" r="2.4" />
        </svg>
        <span style={{ fontSize: 12.5, fontWeight: 700, minWidth: 0 }}>
          Du siehst das Portal als {stand.name}
        </span>
        <span style={{ fontSize: 11.5, color: "rgba(226,236,250,.62)" }}>
          Nur-Ansicht · Aktionen sind abgeschaltet{rest && ` · ${rest}`}
        </span>
        <button type="button" onClick={() => void beenden()}
                style={{
                  marginLeft: "auto", flexShrink: 0, border: 0, cursor: "pointer",
                  padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700,
                  background: "rgba(255,255,255,.14)", color: "#fff",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,.18)",
                }}>
          Beenden
        </button>
      </div>
    </>
  );
}
