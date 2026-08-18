// ═══════════════════════════════════════════════════════════════════════════
// DIE ACADEMY IM TEAM-PORTAL — /agent/academy
//
// ── WAS HIER ANDERS IST ALS IN DER VERWALTUNG ──────────────────────────────
// Die Admin-Fassung (`/admin/schulung`) ist eine BÜHNE: Der Betreiber teilt den
// Bildschirm und führt vor. Diese hier ist zum Selbstlesen — deshalb:
//
//   · nur die EIGENE Reise (der Server filtert, nicht die Anzeige)
//   · Fortschritt sichtbar und gespeichert („Kapitel 4 von 13")
//   · kein Präsentationsmodus — wer sich selbst einschult, präsentiert nicht
//
// Die Kapitel-Darstellung ist dieselbe wie in der Verwaltung: dieselben Daten,
// dieselbe Reihenfolge. Eine zweite Fassung der Kapitel wäre die zweite
// Wahrheit — und die Schulung würde nach der ersten Änderung auseinanderlaufen.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KernbotschaftKarte } from "@/components/KernbotschaftKarte";
import { Link, useRoute } from "wouter";
import { HANDELNDER_TEXT, type Kapitel } from "@shared/fiaon-academy";

const GRUND = "#0A1A3C";
const HELL = "#eef2fb";
const LEISE = "#9fb3d9";
const LEISER = "#7f97c4";

function nutztRuhe(): boolean {
  return typeof window !== "undefined"
    && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

interface ReiseKurz {
  key: string; titel: string; unterzeile: string; dauerMin: number;
  kapitelZahl: number; ton: { akzent: string; hell: string; verlauf: string };
  fortschritt: { kapitel: number; gesamt: number; fertig: boolean; zuletztAm: string | null };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE ÜBERSICHT — meine Reisen
// ═══════════════════════════════════════════════════════════════════════════
function Uebersicht() {
  const [daten, setDaten] = useState<any>(null);
  const [laedt, setLaedt] = useState(true);
  const ruhe = nutztRuhe();

  useEffect(() => {
    void fetch("/api/fiaon/agent/academy", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => { setDaten(j?.ok ? j : null); setLaedt(false); })
      .catch(() => setLaedt(false));
  }, []);

  return (
    <div data-fiaon="team-academy" style={{ background: GRUND, minHeight: "100vh" }}>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "28px 16px 96px" }}>
        <Link href="/agent/mehr" style={{
          color: LEISE, fontSize: 13, fontWeight: 700, textDecoration: "none",
          minHeight: 44, display: "inline-flex", alignItems: "center",
        }}>
          ← Mehr
        </Link>

        <p style={{
          color: "#5b8cff", fontSize: 11.5, fontWeight: 700, letterSpacing: ".16em",
          textTransform: "uppercase", margin: "14px 0 0",
        }}>
          FIAON Academy
        </p>
        <h1 style={{
          color: HELL, fontSize: "clamp(26px,6vw,40px)", fontWeight: 800,
          lineHeight: 1.1, letterSpacing: "-.02em", margin: "8px 0 0",
        }}>
          Dein Ablauf,<br />Kapitel für Kapitel.
        </h1>
        <p style={{ color: LEISE, fontSize: 14, lineHeight: 1.6, margin: "14px 0 0" }}>
          Was in deinem Bereich passiert, wer handelt und warum es so gebaut ist.
          Du kannst jederzeit aufhören und später weitermachen — dein Stand bleibt.
        </p>

        {laedt && <p style={{ color: LEISER, fontSize: 13, marginTop: 28 }}>Lädt …</p>}

        {daten?.hinweis && (
          <p style={{ color: LEISER, fontSize: 12.5, marginTop: 18 }}>{daten.hinweis}</p>
        )}

        <div style={{ display: "grid", gap: 14, marginTop: 22 }}>
          {(daten?.reisen ?? []).map((r: ReiseKurz, i: number) => {
            const anteil = r.fortschritt.gesamt > 0
              ? Math.round((r.fortschritt.kapitel / r.fortschritt.gesamt) * 100) : 0;
            return (
              <Link key={r.key} href={`/agent/academy/${r.key}`}
                    data-fiaon="team-reise-karte"
                    style={{
                      display: "block", textDecoration: "none", padding: "20px 18px",
                      borderRadius: 20, background: "rgba(255,255,255,.055)",
                      boxShadow: `inset 0 0 0 1px ${r.ton.akzent}3d`,
                      animation: ruhe ? "none"
                        : `fiTeamAcademyEintritt .5s cubic-bezier(.22,1,.36,1) ${i * 0.08}s both`,
                    }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 8 }}>
                  <h2 style={{ color: HELL, fontSize: 21, fontWeight: 800, margin: 0 }}>
                    {r.titel}
                  </h2>
                  {r.fortschritt.fertig && (
                    <span style={{
                      padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 800,
                      background: "rgba(16,185,129,.16)", color: "#8ff0c8",
                    }}>
                      durchgearbeitet
                    </span>
                  )}
                </div>
                <p style={{ color: LEISE, fontSize: 13, lineHeight: 1.55, margin: "8px 0 0" }}>
                  {r.unterzeile}
                </p>

                {/* ── DER FORTSCHRITT ───────────────────────────────────────
                    Als Balken UND als Zahl: Der Balken zeigt auf einen Blick,
                    wie viel noch kommt, die Zahl sagt, wo man weitermacht. */}
                <div style={{ marginTop: 14 }}>
                  <div style={{
                    height: 4, borderRadius: 999, background: "rgba(255,255,255,.12)",
                    overflow: "hidden",
                  }}>
                    <div style={{
                      height: "100%", width: `${anteil}%`, background: r.ton.akzent,
                      transition: ruhe ? "none" : "width .4s",
                    }} />
                  </div>
                  <p style={{
                    color: LEISER, fontSize: 12, margin: "7px 0 0",
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    {r.fortschritt.kapitel > 0
                      ? `Kapitel ${r.fortschritt.kapitel} von ${r.fortschritt.gesamt}`
                      : `${r.kapitelZahl} Kapitel · ~${r.dauerMin} Min`}
                  </p>
                </div>

                <span style={{
                  display: "inline-block", marginTop: 16, padding: "11px 18px",
                  borderRadius: 12, background: r.ton.akzent, color: "#04102b",
                  fontSize: 13, fontWeight: 800, minHeight: 44, lineHeight: "22px",
                }}>
                  {r.fortschritt.kapitel > 0 ? "Weitermachen →" : "Reise starten →"}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes fiTeamAcademyEintritt {
          from { opacity: 0; transform: translate3d(0,16px,0); }
          to   { opacity: 1; transform: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-fiaon="team-academy"] * {
            animation: none !important; transition: none !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EINE REISE — zum Selbstlesen
// ═══════════════════════════════════════════════════════════════════════════
function TeamReise({ reiseKey }: { reiseKey: string }) {
  const [daten, setDaten] = useState<any>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [aktiv, setAktiv] = useState(0);
  /** Präsentationsmodus — nur für die Leitung, siehe unten. */
  const [praesentation, setPraesentation] = useState(false);
  const ruhe = nutztRuhe();

  // ── ECHTES VOLLBILD ────────────────────────────────────────────────────
  // Dieselbe Technik wie in der Verwaltung (admin-schulung.tsx): Klasse am
  // <html> plus Fullscreen-API. Die Klasse heißt hier anders, weil das
  // Team-Portal eine andere Hülle hat — versteckt werden `nav` und die
  // Fußleiste.
  useEffect(() => {
    const wurzel = document.documentElement;
    if (praesentation) {
      wurzel.classList.add("fi-team-academy-vollbild");
      void wurzel.requestFullscreen?.().catch(() => {});
    } else {
      wurzel.classList.remove("fi-team-academy-vollbild");
      if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
    }
    return () => wurzel.classList.remove("fi-team-academy-vollbild");
  }, [praesentation]);

  useEffect(() => {
    const auf = () => { if (!document.fullscreenElement) setPraesentation(false); };
    document.addEventListener("fullscreenchange", auf);
    return () => document.removeEventListener("fullscreenchange", auf);
  }, []);
  /** Das höchste erreichte Kapitel — wird beim Verlassen gespeichert. */
  const hoechstes = useRef(0);

  useEffect(() => {
    void fetch(`/api/fiaon/agent/academy/${encodeURIComponent(reiseKey)}`,
      { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok) {
          setDaten(j);
          // Dort weitermachen, wo man war — aber nicht springen, wenn es der
          // erste Besuch ist.
          const stand = Number(j.fortschritt?.kapitel ?? 0);
          hoechstes.current = stand;
          if (stand > 1) setAktiv(Math.min(stand - 1, (j.reise?.kapitel?.length ?? 1) - 1));
        } else {
          setFehler(String(j?.error ?? "Diese Reise ist nicht für dich."));
        }
        setLaedt(false);
      })
      .catch(() => { setFehler("Nicht erreichbar."); setLaedt(false); });
  }, [reiseKey]);

  const kapitel: Kapitel[] = daten?.reise?.kapitel ?? [];
  const ton = daten?.reise?.ton ?? { akzent: "#5b8cff", hell: "#c3d5ff", verlauf: "" };

  // ── DEN FORTSCHRITT SPEICHERN ───────────────────────────────────────────
  // Nicht bei jedem Kapitel eine Abfrage: Das wären bei 13 Kapiteln 13
  // Schreibvorgänge für eine Zahl. Gespeichert wird, wenn die Seite verlassen
  // wird — und zusätzlich alle 30 Sekunden, damit ein abgebrochener Browser
  // den Stand nicht verschluckt.
  const speichern = useCallback(() => {
    if (!reiseKey || hoechstes.current < 1) return;
    const koerper = JSON.stringify({ kapitel: hoechstes.current });
    // `keepalive`: Ein normales fetch bricht ab, wenn die Seite geht.
    void fetch(`/api/fiaon/agent/academy/${encodeURIComponent(reiseKey)}/fortschritt`, {
      method: "POST", credentials: "include", keepalive: true,
      headers: { "Content-Type": "application/json" }, body: koerper,
    }).catch(() => {});
  }, [reiseKey]);

  useEffect(() => {
    const takt = setInterval(speichern, 30_000);
    window.addEventListener("pagehide", speichern);
    return () => {
      clearInterval(takt);
      window.removeEventListener("pagehide", speichern);
      speichern();
    };
  }, [speichern]);

  useEffect(() => {
    hoechstes.current = Math.max(hoechstes.current, aktiv + 1);
  }, [aktiv]);

  const springe = useCallback((i: number) => {
    const ziel = Math.max(0, Math.min(kapitel.length - 1, i));
    setAktiv(ziel);
    document.getElementById(`tk-${kapitel[ziel]?.key}`)
      ?.scrollIntoView({ behavior: ruhe ? "auto" : "smooth", block: "start" });
  }, [kapitel, ruhe]);

  useEffect(() => {
    const auf = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); springe(aktiv + 1); }
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); springe(aktiv - 1); }
      if (e.key === "Escape" && praesentation) setPraesentation(false);
    };
    window.addEventListener("keydown", auf);
    return () => window.removeEventListener("keydown", auf);
  }, [aktiv, springe, praesentation]);

  const jetzt = kapitel[aktiv];

  if (laedt) {
    return (
      <div style={{ background: GRUND, minHeight: "100vh", padding: "40px 16px" }}>
        <p style={{ color: LEISER, fontSize: 13 }}>Lädt …</p>
      </div>
    );
  }
  if (fehler || !jetzt) {
    return (
      <div style={{ background: GRUND, minHeight: "100vh", padding: "40px 16px" }}>
        <p style={{ color: HELL, fontSize: 15, lineHeight: 1.6 }}>{fehler ?? "Keine Kapitel."}</p>
        <Link href="/agent/academy" style={{ color: "#5b8cff", fontSize: 14, fontWeight: 700 }}>
          Zu meinen Reisen
        </Link>
      </div>
    );
  }

  return (
    <div data-fiaon="team-academy" style={{ background: GRUND, minHeight: "100vh" }}>
      {/* ── DIE LEISTE: WO BIN ICH? ──────────────────────────────────────── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 20, background: "rgba(10,26,60,.93)",
        backdropFilter: "blur(10px)", borderBottom: "1px solid rgba(255,255,255,.08)",
      }}>
        <div style={{ height: 3, background: "rgba(255,255,255,.1)" }}>
          <div style={{
            height: "100%", width: `${((aktiv + 1) / kapitel.length) * 100}%`,
            background: ton.akzent, transition: ruhe ? "none" : "width .3s",
          }} />
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
          padding: "9px 14px", maxWidth: 820, margin: "0 auto",
        }}>
          <Link href="/agent/academy" style={{
            color: LEISE, fontSize: 12.5, fontWeight: 700, textDecoration: "none",
            minHeight: 44, display: "inline-flex", alignItems: "center",
          }}>
            ← Academy
          </Link>
          <span style={{ color: HELL, fontSize: 13, fontWeight: 800 }}>{daten.reise.titel}</span>
          <span style={{
            color: LEISER, fontSize: 12.5, fontWeight: 700, marginLeft: "auto",
            fontVariantNumeric: "tabular-nums",
          }}>
            {aktiv + 1} / {kapitel.length}
          </span>
          {/* ══════════════════════════════════════════════════════════════
              PRÄSENTIEREN — NUR FÜR DIE LEITUNG

              Florentine und Daniel schulen die Mitarbeiter selbst. Dafür
              brauchen sie hier dasselbe wie in der Verwaltung: Vollbild, große
              Schrift, Navigation weg.

              Das Kennzeichen `istLeitung` kommt vom SERVER — eine Rollen-Prüfung
              in der Anzeige wäre die zweite Fassung derselben Regel.
              ══════════════════════════════════════════════════════════════ */}
          {daten?.istLeitung && (
            <button type="button"
                    data-fiaon="team-praesentieren"
                    onClick={() => setPraesentation((v) => !v)}
                    style={{
                      padding: "9px 14px", borderRadius: 10, border: 0, cursor: "pointer",
                      background: praesentation ? ton.akzent : "rgba(255,255,255,.09)",
                      color: praesentation ? "#04102b" : HELL,
                      fontSize: 12, fontWeight: 800, minHeight: 44,
                    }}>
              {praesentation ? "Beenden (Esc)" : "Präsentieren"}
            </button>
          )}
        </div>
      </div>

      {/* ── EIN KAPITEL AUF EINMAL ────────────────────────────────────────
          Anders als in der Verwaltung (dort scrollt man durch alle): Auf dem
          Telefon ist eine Seite je Kapitel übersichtlicher, und der Fortschritt
          ist eindeutig. */}
      <div id={`tk-${jetzt.key}`} style={{ maxWidth: 820, margin: "0 auto", padding: "26px 16px 40px" }}>
        <span style={{
          display: "inline-block", padding: "5px 11px", borderRadius: 999,
          background: `${ton.akzent}26`, color: ton.hell, fontSize: 12, fontWeight: 700,
        }}>
          {HANDELNDER_TEXT[jetzt.wer]}
        </span>

        <h2 style={{
          color: HELL, fontSize: "clamp(21px,5.2vw,31px)", fontWeight: 800,
          lineHeight: 1.14, letterSpacing: "-.015em", margin: "14px 0 0",
        }}>
          {jetzt.was}
        </h2>
        {jetzt.hervorgehoben ? (
          <div style={{ marginTop: 14 }}>
            <KernbotschaftKarte dunkel />
          </div>
        ) : (
          <p style={{ color: LEISE, fontSize: 14.5, lineHeight: 1.62, margin: "14px 0 0" }}>
            {jetzt.text}
          </p>
        )}

        {jetzt.punkte && jetzt.punkte.length > 0 && !jetzt.hervorgehoben && (
          <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0", display: "grid", gap: 9 }}>
            {jetzt.punkte.map((pt, i) => (
              <li key={i} style={{
                color: HELL, fontSize: 14, lineHeight: 1.5, paddingLeft: 16, position: "relative",
              }}>
                <span aria-hidden="true" style={{
                  position: "absolute", left: 0, top: 8, width: 5, height: 5,
                  borderRadius: 999, background: ton.akzent,
                }} />
                {pt}
              </li>
            ))}
          </ul>
        )}

        {jetzt.zahlen && jetzt.zahlen.length > 0 && (
          <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
            {jetzt.zahlen.map((zz, i) => (
              <p key={i} style={{
                margin: 0, padding: "10px 13px", borderRadius: 11,
                background: "rgba(16,185,129,.10)",
                boxShadow: "inset 0 0 0 1px rgba(16,185,129,.24)",
                color: "#8ff0c8", fontSize: 12.5, fontWeight: 600, lineHeight: 1.5,
              }}>
                {zz}
              </p>
            ))}
          </div>
        )}

        {jetzt.weg && (
          <a href={jetzt.weg.pfad} target="_blank" rel="noreferrer"
             style={{
               display: "inline-block", marginTop: 18, padding: "12px 17px",
               borderRadius: 12, textDecoration: "none",
               background: "rgba(255,255,255,.09)", color: HELL,
               boxShadow: "inset 0 0 0 1px rgba(255,255,255,.2)",
               fontSize: 13, fontWeight: 700, minHeight: 44, lineHeight: "20px",
             }}>
            {jetzt.weg.label} öffnen →
          </a>
        )}

        <details style={{ marginTop: 18 }}>
          <summary style={{
            color: ton.akzent, fontSize: 13.5, fontWeight: 700, cursor: "pointer",
            minHeight: 44, display: "flex", alignItems: "center",
          }}>
            Warum dieser Schritt?
          </summary>
          <p style={{
            color: LEISE, fontSize: 13.5, lineHeight: 1.6, margin: "4px 0 0",
            paddingLeft: 13, boxShadow: `inset 2px 0 0 ${ton.akzent}`,
          }}>
            {jetzt.warum}
          </p>
        </details>

        {/* ── WEITER UND ZURÜCK ──────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 10, marginTop: 28, flexWrap: "wrap" }}>
          <button type="button" onClick={() => springe(aktiv - 1)} disabled={aktiv === 0}
                  style={{
                    padding: "13px 19px", borderRadius: 12, border: 0, cursor: "pointer",
                    background: "rgba(255,255,255,.08)", color: HELL, fontSize: 13,
                    fontWeight: 700, minHeight: 48, opacity: aktiv === 0 ? .35 : 1,
                  }}>
            ← Zurück
          </button>
          {aktiv < kapitel.length - 1 ? (
            <button type="button" onClick={() => springe(aktiv + 1)}
                    style={{
                      padding: "13px 22px", borderRadius: 12, border: 0, cursor: "pointer",
                      background: ton.akzent, color: "#04102b", fontSize: 13.5,
                      fontWeight: 800, minHeight: 48, flex: 1,
                    }}>
              Weiter →
            </button>
          ) : (
            <Link href="/agent/academy"
                  onClick={speichern}
                  style={{
                    padding: "13px 22px", borderRadius: 12, textDecoration: "none",
                    background: "#059669", color: "#eafff6", fontSize: 13.5,
                    fontWeight: 800, minHeight: 48, flex: 1, textAlign: "center",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                  }}>
              Fertig — zurück zur Übersicht
            </Link>
          )}
        </div>
      </div>

      <style>{`
        /* ── VOLLBILD FÜR DIE SCHULENDE LEITUNG ──────────────────────────
           Navigation und Fußleiste des Team-Portals aus dem Fluss nehmen —
           nicht überdecken. Die Bühne löst sich mit „position: fixed", weil
           ein begrenzender Container dazwischen liegen kann (gelernt am
           27.08. in der Verwaltungs-Fassung: Ränder zurückzusetzen genügte
           nicht, sie blieb 1200 px breit). */
        html.fi-team-academy-vollbild nav,
        html.fi-team-academy-vollbild header,
        html.fi-team-academy-vollbild .fi-telefonknopf,
        html.fi-team-academy-vollbild .agent-tabbar {
          display: none !important;
        }
        html.fi-team-academy-vollbild [data-fiaon="team-academy"] {
          position: fixed !important;
          inset: 0 !important;
          margin: 0 !important;
          max-width: none !important;
          width: 100vw !important;
          overflow-y: auto !important;
          z-index: 60;
        }
        /* Im Vollbild größere Schrift — der Raum ist da, und die Zuschauer
           sitzen weiter weg. */
        html.fi-team-academy-vollbild [data-fiaon="team-academy"] h2 {
          font-size: clamp(26px,4vw,46px) !important;
        }
        @media (prefers-reduced-motion: reduce) {
          [data-fiaon="team-academy"] * {
            animation: none !important; transition: none !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>
    </div>
  );
}

export default function AgentAcademyPage() {
  const [, params] = useRoute("/agent/academy/:reise");
  const key = params?.reise;
  useEffect(() => {
    document.title = key ? "Academy — FIAON Team" : "FIAON Academy";
  }, [key]);
  return key ? <TeamReise reiseKey={key} /> : <Uebersicht />;
}
