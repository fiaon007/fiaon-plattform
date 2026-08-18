// ═══════════════════════════════════════════════════════════════════════════
// DIE FIAON ACADEMY — /admin/schulung
//
// ── WOFÜR ──────────────────────────────────────────────────────────────────
// Der Betreiber teilt den Bildschirm und führt einen neuen Mitarbeiter durch
// den perfekten Ablauf seiner Abteilung. Drei Reisen, je eine Abteilung.
//
// ── DIE ENTSCHEIDUNG: DER WEG STATT DES BILDES ─────────────────────────────
// Der Auftrag ließ die Wahl zwischen eingebetteten Komponenten und
// Build-Screenshots. Beides ist verworfen (Begründung in
// `shared/fiaon-academy.ts`). Jedes Kapitel nennt stattdessen die ECHTE Route
// und öffnet sie auf Wunsch in einem neuen Tab — der Betreiber führt am echten
// System vor. Die Texte kommen aus dem Repo, die Agenda-Schritte sogar aus
// derselben Datei wie das Cockpit.
//
// ── DIE BÜHNE ──────────────────────────────────────────────────────────────
// Dunkles Navy, ein wandernder Verlaufs-Glanz, Karten mit Tiefe-Eintritt. Kein
// Video, kein Ton: Eine Schulung, die beim Öffnen etwas abspielt, wird
// stummgeschaltet — und dann fehlt die Hälfte.
//
// ── ZUGÄNGLICHKEIT IST HIER KEINE KÜR ──────────────────────────────────────
// `prefers-reduced-motion` schaltet ALLE Bewegung ab (harte Schnitte statt
// Übergänge) — auf einer scroll-getriebenen Seite ist Bewegung sonst ein
// Ausschlussgrund. Text steht mindestens auf 4.5:1 gegen den Grund. Und auf
// 380 px funktioniert alles, denn eine Einschulung passiert auch am Telefon.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRoute } from "wouter";
import { REISEN, reise as reiseFinden, HANDELNDER_TEXT, type Kapitel } from "@shared/fiaon-academy";

// ── DIE FARBFAMILIE ──────────────────────────────────────────────────────
// #0A1A3C ist der Grund. Alle Textfarben darüber sind auf Kontrast geprüft:
// #eef2fb auf #0A1A3C ≈ 14:1, #9fb3d9 ≈ 6.2:1, #7f97c4 ≈ 4.6:1. Darunter
// nichts — AGENTS.md verlangt 4.5:1.
const GRUND = "#0A1A3C";
const HELL = "#eef2fb";
const LEISE = "#9fb3d9";
const LEISER = "#7f97c4";
const AKZENT = "#5b8cff";

/** Läuft der Nutzer mit abgeschalteter Bewegung? */
function nutztRuhe(): boolean {
  return typeof window !== "undefined"
    && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE STARTSEITE — drei Reise-Karten
// ═══════════════════════════════════════════════════════════════════════════
function Buehne() {
  const ruhe = nutztRuhe();
  return (
    <div data-fiaon="academy-start" style={{ background: GRUND, minHeight: "100vh" }}>
      {/* ── DER WANDERNDE GLANZ ──────────────────────────────────────────
          Zwei weiche Farbkreise, die langsam wandern. Bei `reduced-motion`
          stehen sie still — sie bleiben als Tiefe erhalten, ohne Bewegung. */}
      <div aria-hidden="true" style={{
        position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", width: 900, height: 900, left: "-16%", top: "-28%",
          background: "radial-gradient(circle, rgba(91,140,255,.20), transparent 62%)",
          filter: "blur(38px)",
          animation: ruhe ? "none" : "fiAcademyGlanz 26s ease-in-out infinite alternate",
        }} />
        <div style={{
          position: "absolute", width: 760, height: 760, right: "-14%", bottom: "-24%",
          background: "radial-gradient(circle, rgba(16,185,129,.13), transparent 62%)",
          filter: "blur(44px)",
          animation: ruhe ? "none" : "fiAcademyGlanz2 32s ease-in-out infinite alternate",
        }} />
      </div>

      <div style={{ position: "relative", maxWidth: 1120, margin: "0 auto", padding: "72px 20px 96px" }}>
        <p style={{
          color: AKZENT, fontSize: 12, fontWeight: 700, letterSpacing: ".18em",
          textTransform: "uppercase", margin: 0,
        }}>
          FIAON Academy
        </p>
        <h1 style={{
          color: HELL, fontSize: "clamp(30px,5.2vw,54px)", fontWeight: 800,
          lineHeight: 1.06, letterSpacing: "-.02em", margin: "12px 0 0",
        }}>
          Der perfekte Ablauf,<br />Kapitel für Kapitel.
        </h1>
        <p style={{
          color: LEISE, fontSize: "clamp(14px,1.7vw,17px)", lineHeight: 1.6,
          maxWidth: 640, margin: "18px 0 0",
        }}>
          Drei Reisen durch die drei Abteilungen. Jede zeigt, was passiert, wer
          handelt und warum es so gebaut ist — mit den echten Wegen im System.
          Bildschirm teilen, Reise starten, vorführen.
        </p>

        <div style={{
          display: "grid", gap: 18, marginTop: 44,
          gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
        }}>
          {REISEN.map((r, i) => (
            <a key={r.key} href={`/admin/schulung/${r.key}`}
               data-fiaon="reise-karte"
               style={{
                 display: "block", textDecoration: "none", padding: "26px 24px 22px",
                 borderRadius: 22, background: "rgba(255,255,255,.055)",
                 boxShadow: "inset 0 0 0 1px rgba(255,255,255,.11)",
                 // ── EINTRITT AUS DER TIEFE ──────────────────────────────
                 // Die Haus-Kurve (0.22,1,0.36,1): schnell heraus, sanft
                 // hinein. Bei `reduced-motion` erscheinen die Karten fertig.
                 animation: ruhe ? "none" : `fiAcademyTiefe .62s cubic-bezier(.22,1,.36,1) ${i * 0.09}s both`,
                 transition: ruhe ? "none" : "transform .25s, box-shadow .25s",
               }}
               onMouseEnter={(e) => {
                 if (ruhe) return;
                 e.currentTarget.style.transform = "translateY(-3px)";
                 e.currentTarget.style.boxShadow = "inset 0 0 0 1px rgba(91,140,255,.42)";
               }}
               onMouseLeave={(e) => {
                 e.currentTarget.style.transform = "none";
                 e.currentTarget.style.boxShadow = "inset 0 0 0 1px rgba(255,255,255,.11)";
               }}>
              <p style={{
                color: LEISER, fontSize: 11.5, fontWeight: 700, letterSpacing: ".14em",
                textTransform: "uppercase", margin: 0,
              }}>
                Reise {i + 1}
              </p>
              <h2 style={{
                color: HELL, fontSize: 25, fontWeight: 800, letterSpacing: "-.01em",
                margin: "8px 0 0",
              }}>
                {r.titel}
              </h2>
              <p style={{ color: LEISE, fontSize: 13.5, lineHeight: 1.58, margin: "10px 0 0" }}>
                {r.unterzeile}
              </p>
              <p style={{ color: LEISER, fontSize: 12.5, margin: "16px 0 0", fontVariantNumeric: "tabular-nums" }}>
                ~{r.dauerMin} Min · {r.kapitel.length} Kapitel
              </p>
              <span style={{
                display: "inline-block", marginTop: 18, padding: "11px 18px",
                borderRadius: 12, background: AKZENT, color: "#04102b",
                fontSize: 13, fontWeight: 800, minHeight: 44, lineHeight: "22px",
              }}>
                Reise starten →
              </span>
            </a>
          ))}
        </div>

        <p style={{ color: LEISER, fontSize: 12, lineHeight: 1.6, marginTop: 40, maxWidth: 640 }}>
          Kein Ton, kein Autoplay. Die Kapitel verweisen auf die echten Seiten im
          System — so schult niemand veraltete Bilder.
        </p>
      </div>

      <style>{`
        @keyframes fiAcademyGlanz {
          0% { transform: translate3d(0,0,0) scale(1); }
          100% { transform: translate3d(9%,7%,0) scale(1.12); }
        }
        @keyframes fiAcademyGlanz2 {
          0% { transform: translate3d(0,0,0) scale(1.08); }
          100% { transform: translate3d(-8%,-6%,0) scale(1); }
        }
        @keyframes fiAcademyTiefe {
          from { opacity: 0; transform: perspective(900px) translate3d(0,26px,-90px) scale(.965); }
          to   { opacity: 1; transform: none; }
        }
        /* Wer Bewegung abgeschaltet hat, bekommt harte Schnitte — nicht
           langsamere Animationen. Eine gedrosselte Animation ist immer noch
           Bewegung. */
        @media (prefers-reduced-motion: reduce) {
          [data-fiaon="academy-start"] *, [data-fiaon="academy-reise"] * {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EIN KAPITEL
// ═══════════════════════════════════════════════════════════════════════════
function KapitelBuehne({ k, nummer, gesamt, aktiv, praesentation }: {
  k: Kapitel; nummer: number; gesamt: number; aktiv: boolean; praesentation: boolean;
}) {
  const ruhe = nutztRuhe();
  const [warumOffen, setWarumOffen] = useState(false);
  // Die Mail-Vorschau wird erst geladen, wenn das Kapitel sichtbar ist —
  // sonst holt die Seite 13 Vorschauen beim Öffnen (LCP-Budget).
  const [vorschau, setVorschau] = useState<any>(null);
  const [vorschauLaedt, setVorschauLaedt] = useState(false);

  useEffect(() => {
    if (!aktiv || !k.mailEvent || vorschau || vorschauLaedt) return;
    setVorschauLaedt(true);
    // ── DIE BESTEHENDE BREVO-VORSCHAU, NICHT EINE NEUE ────────────────────
    // Dieselbe Route, die das Sende-Menü der Verwaltung benutzt. Eine zweite
    // Fassung würde beim nächsten Template-Wechsel auseinanderlaufen.
    // Die Route nimmt das Ereignis im PFAD (`/vorschau/:event`), nicht als
    // Abfrage. Ein erster Entwurf riet `?event=` — die Antwort wäre still ein
    // 404 gewesen, und das Kapitel hätte „Vorlage liegt in Brevo" gezeigt,
    // obwohl die Vorschau da ist.
    void fetch(`/api/fiaon/admin/mail/vorschau/${encodeURIComponent(k.mailEvent)}`,
      { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setVorschau(j?.ok ? j : { ok: false }))
      .catch(() => setVorschau({ ok: false }))
      .finally(() => setVorschauLaedt(false));
  }, [aktiv, k.mailEvent, vorschau, vorschauLaedt]);

  const gross = praesentation;
  return (
    <section
      id={`kapitel-${k.key}`}
      data-fiaon="kapitel"
      data-kapitel-key={k.key}
      style={{
        minHeight: praesentation ? "100vh" : "88vh",
        display: "flex", flexDirection: "column", justifyContent: "center",
        padding: praesentation ? "40px 32px" : "56px 20px",
        scrollSnapAlign: "start",
      }}
    >
      <div style={{
        maxWidth: gross ? 1160 : 880, margin: "0 auto", width: "100%",
        animation: ruhe || !aktiv ? "none" : "fiAcademyTiefe .6s cubic-bezier(.22,1,.36,1) both",
      }}>
        {/* ── ROLLE UND ZÄHLER ───────────────────────────────────────── */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
          <span style={{
            padding: "6px 12px", borderRadius: 999, background: "rgba(91,140,255,.16)",
            color: "#c3d5ff", fontSize: gross ? 14 : 12, fontWeight: 700,
            boxShadow: "inset 0 0 0 1px rgba(91,140,255,.3)",
          }}>
            {HANDELNDER_TEXT[k.wer]}
          </span>
          <span style={{
            color: LEISER, fontSize: gross ? 14 : 12, fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
          }}>
            Kapitel {nummer} / {gesamt}
          </span>
        </div>

        {/* ── WAS PASSIERT — GROSS ───────────────────────────────────── */}
        <h2 style={{
          color: HELL, fontWeight: 800, letterSpacing: "-.02em",
          fontSize: gross ? "clamp(30px,4.4vw,60px)" : "clamp(23px,3.4vw,40px)",
          lineHeight: 1.1, margin: "20px 0 0",
        }}>
          {k.was}
        </h2>

        <p style={{
          color: LEISE, lineHeight: 1.62, margin: "20px 0 0",
          fontSize: gross ? "clamp(16px,1.8vw,22px)" : "clamp(14px,1.6vw,17px)",
          maxWidth: gross ? 980 : 720,
        }}>
          {k.text}
        </p>

        {/* ── DIE STICHPUNKTE ZUM VORLESEN ───────────────────────────
            Aus der Onboarding-Agenda: „Wer einen Absatz vorliest, klingt
            vorgelesen." Deshalb kurze Punkte, groß gesetzt. */}
        {k.punkte && k.punkte.length > 0 && (
          <ul style={{
            listStyle: "none", padding: 0, margin: "22px 0 0", display: "grid", gap: 10,
          }}>
            {k.punkte.map((pt, i) => (
              <li key={i} style={{
                color: HELL, fontSize: gross ? "clamp(15px,1.6vw,19px)" : 14.5,
                lineHeight: 1.5, paddingLeft: 18, position: "relative",
              }}>
                <span aria-hidden="true" style={{
                  position: "absolute", left: 0, top: gross ? 10 : 8,
                  width: 6, height: 6, borderRadius: 999, background: AKZENT,
                }} />
                {pt}
              </li>
            ))}
          </ul>
        )}

        {/* ── DIE ZAHLEN, DIE DEN SCHRITT BELEGEN ─────────────────────── */}
        {k.zahlen && k.zahlen.length > 0 && (
          <div style={{ marginTop: 22, display: "grid", gap: 8 }}>
            {k.zahlen.map((zz, i) => (
              <p key={i} style={{
                margin: 0, padding: "11px 14px", borderRadius: 12,
                background: "rgba(16,185,129,.10)", boxShadow: "inset 0 0 0 1px rgba(16,185,129,.26)",
                color: "#8ff0c8", fontSize: gross ? 15 : 13, fontWeight: 600, lineHeight: 1.5,
              }}>
                {zz}
              </p>
            ))}
          </div>
        )}

        {/* ── DIE ECHTE MAIL-VORSCHAU IM GERÄTERAHMEN ─────────────────── */}
        {k.mailEvent && (
          <div style={{ marginTop: 26 }}>
            <p style={{
              color: LEISER, fontSize: 11.5, fontWeight: 700, letterSpacing: ".13em",
              textTransform: "uppercase", margin: "0 0 10px",
            }}>
              Diese Mail geht raus
            </p>
            <div style={{
              borderRadius: 16, overflow: "hidden", background: "#fff",
              boxShadow: "0 18px 48px rgba(2,8,25,.44), inset 0 0 0 1px rgba(255,255,255,.14)",
              maxWidth: 620,
            }}>
              <div style={{
                padding: "11px 14px", background: "#f1f5fb",
                borderBottom: "1px solid #e2e8f3",
              }}>
                <p style={{ margin: 0, fontSize: 11.5, color: "#64748b" }}>
                  Von <b style={{ color: "#0f172a" }}>{vorschau?.absender ?? "FIAON"}</b>
                </p>
                <p style={{ margin: "3px 0 0", fontSize: 13.5, fontWeight: 700, color: "#0f172a" }}>
                  {vorschau?.betreff ?? (vorschauLaedt ? "Lädt …" : k.mailEvent)}
                </p>
              </div>
              {/* Der Rumpf kommt als HTML aus Brevo. `srcDoc` statt
                  `innerHTML`: Fremdes HTML gehört in einen eigenen Rahmen, nicht
                  in unser Dokument. */}
              {vorschau?.html ? (
                <iframe title={`Vorschau ${k.mailEvent}`} srcDoc={vorschau.html}
                        sandbox="" loading="lazy"
                        style={{ width: "100%", height: 300, border: 0, display: "block" }} />
              ) : (
                <p style={{ margin: 0, padding: "22px 16px", fontSize: 12.5, color: "#64748b" }}>
                  {vorschauLaedt
                    ? "Lädt die Vorlage aus Brevo …"
                    : `Ereignis „${k.mailEvent}“. Die Vorlage liegt in Brevo — `
                      + "unter Verwaltung → E-Mail-Events lässt sie sich in echt ansehen."}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── DER WEG INS ECHTE SYSTEM ────────────────────────────────── */}
        {(k.weg || k.quelle) && (
          <div style={{ marginTop: 24, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            {k.weg && (
              <a href={k.weg.pfad} target="_blank" rel="noreferrer"
                 style={{
                   padding: "12px 18px", borderRadius: 12, textDecoration: "none",
                   background: "rgba(255,255,255,.09)", color: HELL,
                   boxShadow: "inset 0 0 0 1px rgba(255,255,255,.2)",
                   fontSize: 13, fontWeight: 700, minHeight: 44, lineHeight: "20px",
                 }}>
                {k.weg.label} live öffnen →
              </a>
            )}
            {k.quelle && (
              <code style={{ color: LEISER, fontSize: 11.5 }}>{k.quelle}</code>
            )}
          </div>
        )}

        {/* ── WARUM DIESER SCHRITT — AUFKLAPPBAR ──────────────────────── */}
        <div style={{ marginTop: 22 }}>
          <button type="button" onClick={() => setWarumOffen((v) => !v)}
                  aria-expanded={warumOffen}
                  style={{
                    background: "none", border: 0, cursor: "pointer", padding: "10px 0",
                    color: AKZENT, fontSize: gross ? 15 : 13.5, fontWeight: 700,
                    minHeight: 44,
                  }}>
            {warumOffen ? "Warum dieser Schritt — zuklappen" : "Warum dieser Schritt?"}
          </button>
          {warumOffen && (
            <p style={{
              color: LEISE, fontSize: gross ? "clamp(15px,1.6vw,19px)" : 14,
              lineHeight: 1.62, margin: "4px 0 0", maxWidth: gross ? 900 : 700,
              paddingLeft: 14, boxShadow: `inset 2px 0 0 ${AKZENT}`,
            }}>
              {k.warum}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE REISE
// ═══════════════════════════════════════════════════════════════════════════
function Reise({ reiseKey }: { reiseKey: string }) {
  const r = useMemo(() => reiseFinden(reiseKey), [reiseKey]);
  const [aktiv, setAktiv] = useState(0);
  const [praesentation, setPraesentation] = useState(false);
  const behaelter = useRef<HTMLDivElement | null>(null);
  const ruhe = nutztRuhe();

  const springe = useCallback((i: number) => {
    if (!r) return;
    const ziel = Math.max(0, Math.min(r.kapitel.length - 1, i));
    const el = document.getElementById(`kapitel-${r.kapitel[ziel].key}`);
    // Bei abgeschalteter Bewegung ein harter Schnitt statt eines Gleitens.
    el?.scrollIntoView({ behavior: ruhe ? "auto" : "smooth", block: "start" });
    setAktiv(ziel);
  }, [r, ruhe]);

  // ── DIE TASTEN ──────────────────────────────────────────────────────────
  // Pfeile und Bild-auf/ab. Im Präsentationsmodus ist das der einzige Weg —
  // wer vorführt, hat keine Hand für die Maus.
  useEffect(() => {
    const auf = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault(); springe(aktiv + 1);
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault(); springe(aktiv - 1);
      } else if (e.key === "Escape" && praesentation) {
        setPraesentation(false);
        void document.exitFullscreen?.().catch(() => {});
      }
    };
    window.addEventListener("keydown", auf);
    return () => window.removeEventListener("keydown", auf);
  }, [aktiv, springe, praesentation]);

  // ── WELCHES KAPITEL IST SICHTBAR? ──────────────────────────────────────
  // Über einen Beobachter, nicht über Scroll-Positionen: Ein Rechenweg aus
  // Pixeln bricht, sobald ein Kapitel länger wird als geplant.
  useEffect(() => {
    if (!r) return;
    const beobachter = new IntersectionObserver((eintraege) => {
      for (const e of eintraege) {
        if (!e.isIntersecting) continue;
        const key = (e.target as HTMLElement).dataset.kapitelKey;
        const i = r.kapitel.findIndex((k) => k.key === key);
        if (i >= 0) setAktiv(i);
      }
    }, { threshold: 0.45 });
    // `forEach` statt `for…of`: Eine NodeList lässt sich ohne
    // `downlevelIteration` nicht durchlaufen, und diese Flagge für ein Bauteil
    // umzustellen wäre der falsche Hebel.
    document.querySelectorAll('[data-fiaon="kapitel"]').forEach((el) => beobachter.observe(el));
    return () => beobachter.disconnect();
  }, [r]);

  if (!r) {
    return (
      <div style={{ background: GRUND, minHeight: "100vh", padding: "80px 20px" }}>
        <p style={{ color: HELL, fontSize: 18, textAlign: "center" }}>
          Diese Reise gibt es nicht. <a href="/admin/schulung" style={{ color: AKZENT }}>Zur Übersicht</a>
        </p>
      </div>
    );
  }

  const anteil = ((aktiv + 1) / r.kapitel.length) * 100;

  return (
    <div ref={behaelter} data-fiaon="academy-reise"
         style={{ background: GRUND, minHeight: "100vh", position: "relative" }}>
      {/* ── DIE FORTSCHRITTSLEISTE ─────────────────────────────────────── */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 30,
        background: "rgba(10,26,60,.86)", backdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(255,255,255,.08)",
      }}>
        <div style={{ height: 3, background: "rgba(255,255,255,.09)" }}>
          <div style={{
            height: "100%", width: `${anteil}%`, background: AKZENT,
            transition: ruhe ? "none" : "width .3s",
          }} />
        </div>
        <div style={{
          maxWidth: 1160, margin: "0 auto", padding: "10px 16px",
          display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        }}>
          <a href="/admin/schulung" style={{
            color: LEISE, fontSize: 12.5, fontWeight: 700, textDecoration: "none",
            minHeight: 44, display: "inline-flex", alignItems: "center",
          }}>
            ← Academy
          </a>
          <span style={{ color: HELL, fontSize: 13.5, fontWeight: 800 }}>{r.titel}</span>
          <span style={{
            color: LEISER, fontSize: 12.5, fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
          }}>
            Kapitel {aktiv + 1} / {r.kapitel.length}
          </span>
          <button type="button"
                  data-fiaon="praesentieren"
                  onClick={() => {
                    const an = !praesentation;
                    setPraesentation(an);
                    if (an) void document.documentElement.requestFullscreen?.().catch(() => {});
                    else void document.exitFullscreen?.().catch(() => {});
                  }}
                  style={{
                    marginLeft: "auto", padding: "10px 16px", borderRadius: 11,
                    background: praesentation ? AKZENT : "rgba(255,255,255,.09)",
                    color: praesentation ? "#04102b" : HELL, border: 0, cursor: "pointer",
                    fontSize: 12.5, fontWeight: 800, minHeight: 44,
                    boxShadow: praesentation ? "none" : "inset 0 0 0 1px rgba(255,255,255,.2)",
                  }}>
            {praesentation ? "Präsentation beenden (Esc)" : "Präsentieren"}
          </button>
        </div>
      </div>

      {/* ── DIE KAPITEL-PUNKTE RECHTS ──────────────────────────────────
          Auf 380 px weg: Dort ist kein Platz, und die Fortschrittsleiste oben
          sagt dasselbe. */}
      <nav aria-label="Kapitel" className="fi-academy-punkte" style={{
        position: "fixed", right: 14, top: "50%", transform: "translateY(-50%)",
        zIndex: 25, display: "grid", gap: 9,
      }}>
        {r.kapitel.map((k, i) => (
          <button key={k.key} type="button" onClick={() => springe(i)}
                  aria-label={`Kapitel ${i + 1}: ${k.was.slice(0, 40)}`}
                  aria-current={i === aktiv ? "true" : undefined}
                  title={`${i + 1}. ${k.was}`}
                  style={{
                    width: i === aktiv ? 11 : 8, height: i === aktiv ? 11 : 8,
                    borderRadius: 999, border: 0, cursor: "pointer", padding: 0,
                    background: i === aktiv ? AKZENT : "rgba(255,255,255,.28)",
                    transition: ruhe ? "none" : "all .2s",
                  }} />
        ))}
      </nav>

      <div style={{ paddingTop: 54 }}>
        {r.kapitel.map((k, i) => (
          <KapitelBuehne key={k.key} k={k} nummer={i + 1} gesamt={r.kapitel.length}
                         aktiv={i === aktiv} praesentation={praesentation} />
        ))}

        {/* ── DER ABSCHLUSS ─────────────────────────────────────────────── */}
        <section style={{ padding: "72px 20px 110px", textAlign: "center" }}>
          <p style={{ color: LEISER, fontSize: 12, fontWeight: 700, letterSpacing: ".16em",
                      textTransform: "uppercase", margin: 0 }}>
            Ende der Reise
          </p>
          <h2 style={{ color: HELL, fontSize: "clamp(24px,3.4vw,38px)", fontWeight: 800,
                       margin: "12px 0 0", letterSpacing: "-.02em" }}>
            {r.kapitel.length} Kapitel, {r.dauerMin} Minuten.
          </h2>
          <p style={{ color: LEISE, fontSize: 14.5, lineHeight: 1.6, margin: "14px auto 0", maxWidth: 560 }}>
            Jetzt am echten System nachmachen — die Wege stehen in jedem Kapitel.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 24, flexWrap: "wrap" }}>
            <button type="button" onClick={() => springe(0)}
                    style={{ padding: "13px 20px", borderRadius: 12, border: 0, cursor: "pointer",
                             background: "rgba(255,255,255,.09)", color: HELL, fontSize: 13,
                             fontWeight: 700, minHeight: 44,
                             boxShadow: "inset 0 0 0 1px rgba(255,255,255,.2)" }}>
              Von vorn
            </button>
            <a href="/admin/schulung"
               style={{ padding: "13px 20px", borderRadius: 12, textDecoration: "none",
                        background: AKZENT, color: "#04102b", fontSize: 13, fontWeight: 800,
                        minHeight: 44, lineHeight: "18px" }}>
              Andere Reise wählen
            </a>
          </div>
        </section>
      </div>

      <style>{`
        @keyframes fiAcademyTiefe {
          from { opacity: 0; transform: perspective(900px) translate3d(0,26px,-90px) scale(.965); }
          to   { opacity: 1; transform: none; }
        }
        /* Auf schmalen Geräten verschwinden die Punkte: Sie überdecken sonst
           Text, und die Leiste oben sagt dasselbe. */
        @media (max-width: 767px) {
          .fi-academy-punkte { display: none !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-fiaon="academy-reise"] *, [data-fiaon="academy-start"] * {
            animation: none !important;
            transition: none !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
export default function AdminSchulungPage() {
  const [, params] = useRoute("/admin/schulung/:reise");
  const key = params?.reise;
  // Der Titel gehört gesetzt: Wer vier Tabs offen hat, findet die Schulung
  // sonst nicht wieder.
  useEffect(() => {
    const r = key ? reiseFinden(key) : null;
    document.title = r ? `${r.titel} — FIAON Academy` : "FIAON Academy";
  }, [key]);
  return key ? <Reise reiseKey={key} /> : <Buehne />;
}
