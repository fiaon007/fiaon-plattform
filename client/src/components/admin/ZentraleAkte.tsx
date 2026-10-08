// ═══════════════════════════════════════════════════════════════════════════
// DIE EINE AKTE IM CHEFBÜRO  (E-315, 09.10.2026)
//
// Justin: „die EINE perfekte zentrale Akte, über die man ALLES steuern kann — jedes Feedback, jede Funktion, übersichtlich,
// clean“. Bis heute gab es fünf Akten-Ansichten (Verwaltung, Telefonkartei-Fenster, Mitarbeiter-Akte, Dashboard-Entwurf,
// Global). Funktionen lagen verstreut — Boni-Ampel, Kündigung, WhatsApp, Termine gab es nur im Office, Buchen/Stornieren/
// Konditionen/Provision nur in der Verwaltung (Bestandsaufnahme 09.10., ~/Developer/it-rettung/akte/).
//
// Jetzt ist es EINE Akte:
//   · Grundlage ist die Mitarbeiter-Akte (pages/agent/pipeline.tsx `Akte`) — dieselbe, in der das Team arbeitet.
//     Im Chefbüro geht sie als Seite auf (alsSeite) und bekommt den Reiter „Verwaltung“.
//   · „Verwaltung“ = admin-kunde.tsx im Modus „verwaltung“: nur, was allein die Verwaltung kann (bezahlt buchen,
//     stornieren, reaktivieren, Konditionen, Provisionen, Bestellungen, Bankeingänge, E-Mail-Center, Notizen & Aufgaben,
//     Dubletten-Familie, Abo-Zyklus, „Warum dieser Status?“).
//   · Die Office-Wege brauchen eine Office-Sitzung DERSELBEN Person (Justin = Justin, keine Ansichts-Sitzung). Fehlt sie,
//     steht oben eine kurze Office-Anmeldung (dieselben Zugangsdaten) und darunter die Verwaltungsakte vollständig —
//     nie eine leere Seite.
// Adresse: /akte/<Kennung>?reiter=… (Tür: pages/akte-tuer.tsx). Kennung = Personen-Nummer, lead-N oder Referenz.
// ═══════════════════════════════════════════════════════════════════════════
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { agentSitzung } from "@/lib/office-zustand";
import { ToastAnbieter } from "@/lib/fiaon-ui";
import "@/styles/office-pipeline.css";
import "@/styles/zentrale-akte.css";

const MitarbeiterAkte = lazy(() => import("@/pages/agent/pipeline").then((m) => ({ default: m.Akte })));
const FragenAnbieter = lazy(() => import("@/pages/agent/shared").then((m) => ({ default: m.FragenAnbieter })));
const Verwaltungsakte = lazy(() => import("@/pages/admin-kunde"));

type Stand =
  | { art: "pruefen" }
  | { art: "akte"; kunde: any; personId: number }
  | { art: "ohneOffice"; grund: "keine" | "andere" | "ansicht" | "ohnePerson"; text?: string };

/** Die Kennung aus /akte/<k> oder (alte Chefbüro-Adresse) /chef/s/akte?id=|?ref=. */
function kennungAusAdresse(): string {
  if (typeof window === "undefined") return "";
  const m = window.location.pathname.match(/^\/akte\/([^/]+)/);
  if (m) return decodeURIComponent(m[1]);
  const q = new URLSearchParams(window.location.search);
  return q.get("id") || q.get("ref") || "";
}

async function json(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; json: any }> {
  try {
    const r = await fetch(url, { credentials: "include", ...init, headers: init?.body ? { "Content-Type": "application/json" } : undefined });
    const j = await r.json().catch(() => null);
    return { ok: r.ok && j?.ok !== false, status: r.status, json: j };
  } catch {
    return { ok: false, status: 0, json: null };
  }
}

export default function ZentraleAkte() {
  const [, navigate] = useLocation();
  const kennung = kennungAusAdresse();
  const startReiter = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("reiter") ?? undefined : undefined;
  const [stand, setStand] = useState<Stand>({ art: "pruefen" });
  const [runde, setRunde] = useState(0);

  // Alte Chefbüro-Adresse (/chef/s/akte?id=|?ref=) → die EINE Adresse; der Reiter reist mit.
  useEffect(() => {
    if (!kennung || window.location.pathname.startsWith("/akte/")) return;
    const reiter = new URLSearchParams(window.location.search).get("reiter");
    navigate(`/akte/${encodeURIComponent(kennung)}${reiter ? `?reiter=${encodeURIComponent(reiter)}` : ""}`, { replace: true });
  }, [kennung, navigate]);

  const laden = useCallback(async () => {
    setStand({ art: "pruefen" });
    const chef = await json("/api/fiaon/chef/status");
    const chefId = Number(chef.json?.agentId ?? 0) || null;
    const ich = await json("/api/fiaon/agent/me");
    const agent = ich.ok ? ich.json?.agent : null;
    if (!agent) { setStand({ art: "ohneOffice", grund: "keine" }); return; }
    if (agent.ansicht) { setStand({ art: "ohneOffice", grund: "ansicht", text: agent.name }); return; }
    if (chefId && Number(agent.id) !== chefId) { setStand({ art: "ohneOffice", grund: "andere", text: agent.name }); return; }
    const auf = await json(`/api/fiaon/agent/akte/aufloesen?id=${encodeURIComponent(kennung)}`);
    const personId = Number(auf.json?.personId ?? 0) || null;
    if (!personId) { setStand({ art: "ohneOffice", grund: "ohnePerson", text: auf.json?.error }); return; }
    const k = await json(`/api/fiaon/agent/crm/kunden/${personId}`);
    if (!k.ok || !k.json?.kunde) { setStand({ art: "ohneOffice", grund: "ohnePerson", text: k.json?.error }); return; }
    // Das Telefon (SoftphoneHost) läuft in der Akte, sobald die Office-Sitzung derselben Person steht.
    agentSitzung.setzen({ email: agent.email, name: agent.name });
    setStand({ art: "akte", kunde: k.json.kunde, personId });
  }, [kennung]);

  useEffect(() => { void laden(); }, [laden, runde]);

  // Reiter in die Adresse schreiben (teilbar, neu laden ohne Verlust).
  const reiterMerken = (key: string) => {
    try {
      const u = new URL(window.location.href);
      if (key === "ueberblick") u.searchParams.delete("reiter"); else u.searchParams.set("reiter", key);
      window.history.replaceState(window.history.state, "", u.toString());
    } catch { /* egal */ }
  };

  const zurListe = () => navigate("/chef/kundenliste");

  if (stand.art === "pruefen") {
    return <div className="za-laden" role="status"><span /><span /><span /><p>Akte wird geöffnet …</p></div>;
  }

  if (stand.art === "akte") {
    return (
      <div className="za">
        <Suspense fallback={<div className="za-laden" role="status"><span /><span /><span /></div>}>
          <ToastAnbieter ton="dunkel">
            <FragenAnbieter>
              <MitarbeiterAkte
                k={stand.kunde}
                alsSeite
                startReiter={startReiter}
                onReiter={reiterMerken}
                onZu={zurListe}
                onWeg={zurListe}
                onNeu={(neu: any) => setStand((s) => (s.art === "akte" ? { ...s, kunde: neu } : s))}
                onErledigt={() => setRunde((n) => n + 1)}
                onZaehler={() => { /* Zähler gibt es im Chefbüro nicht */ }}
                zusatzReiter={[{
                  key: "verwaltung",
                  label: "Verwaltung",
                  inhalt: (
                    <div className="za-verwaltung cbs akte-dunkel">
                      <p className="za-verwaltung-satz">
                        Was nur die Verwaltung kann: Zahlungen buchen und stornieren, Konditionen, Provisionen, Bestellungen,
                        Bankeingänge, E-Mail-Center, Notizen &amp; Aufgaben, Dubletten. Jede Änderung wird protokolliert.
                      </p>
                      <Suspense fallback={<div className="za-laden klein" role="status"><span /><span /><span /></div>}>
                        <Verwaltungsakte akteId={kennung} eingebettet modus="verwaltung" />
                      </Suspense>
                    </div>
                  ),
                }]}
              />
            </FragenAnbieter>
          </ToastAnbieter>
        </Suspense>
      </div>
    );
  }

  // Ohne Office-Sitzung derselben Person: kurze Anmeldung oben, darunter die Verwaltungsakte vollständig.
  return (
    <div className="za">
      <OfficeAnmeldung grund={stand.grund} text={stand.text} onAngemeldet={() => setRunde((n) => n + 1)} />
      <div className="za-voll cbs">
        <Suspense fallback={<div className="za-laden" role="status"><span /><span /><span /></div>}>
          <Verwaltungsakte akteId={kennung} eingebettet />
        </Suspense>
      </div>
    </div>
  );
}

/** Die Office-Anmeldung derselben Person — dieselbe Route wie das Office (/agent/login), kein Sonderweg. */
function OfficeAnmeldung({ grund, text, onAngemeldet }: {
  grund: "keine" | "andere" | "ansicht" | "ohnePerson"; text?: string; onAngemeldet: () => void;
}) {
  const [email, setEmail] = useState("");
  const [passwort, setPasswort] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState("");
  const satz =
    grund === "ohnePerson" ? (text || "Zu dieser Kennung gibt es noch keine Person — die Verwaltungsakte steht darunter.")
    : grund === "ansicht" ? `Im Browser läuft gerade die Ansicht als ${text ?? "Mitarbeiter"}. Für die ganze Akte bitte als du selbst im Office anmelden.`
    : grund === "andere" ? `Im Office ist gerade ${text ?? "eine andere Person"} angemeldet. Für die ganze Akte bitte als du selbst anmelden.`
    : "Anrufen, WhatsApp, Unterlagen-Prüfung, Boni-Ampel, Kündigung und Termine laufen über das Office. Einmal anmelden — dieselben Zugangsdaten wie im Chefbüro.";
  const anmelden = async (e: React.FormEvent) => {
    e.preventDefault();
    setLaeuft(true); setFehler("");
    const r = await json("/api/fiaon/agent/login", { method: "POST", body: JSON.stringify({ email: email.trim(), password: passwort }) });
    setLaeuft(false);
    if (r.ok) { setPasswort(""); onAngemeldet(); }
    else setFehler(r.json?.error || "Anmeldung nicht möglich. Bitte Zugangsdaten prüfen.");
  };
  return (
    <section className="za-office" aria-label="Office-Anmeldung für die ganze Akte">
      <div>
        <b>{grund === "ohnePerson" ? "Verwaltungsakte" : "Für die ganze Akte: im Office anmelden"}</b>
        <p>{satz}</p>
      </div>
      {grund !== "ohnePerson" && (
        <form className="za-office-form" onSubmit={anmelden}>
          <input type="email" autoComplete="username" placeholder="E-Mail" value={email} onChange={(e) => setEmail(e.target.value)} required aria-label="E-Mail" />
          <input type="password" autoComplete="current-password" placeholder="Passwort" value={passwort} onChange={(e) => setPasswort(e.target.value)} required aria-label="Passwort" />
          <button type="submit" className="cw-knopf" disabled={laeuft}>{laeuft ? "…" : "Anmelden"}</button>
          {fehler && <p className="za-office-fehler" role="alert">{fehler}</p>}
        </form>
      )}
    </section>
  );
}
