// ═══════════════════════════════════════════════════════════════════════════
// SCHULUNG — DIE LEITUNGS-FASSUNG (/agent/schulung)
//
// ── WOFÜR ──────────────────────────────────────────────────────────────────
// Florentine und Daniel schulen die Mitarbeiter selbst. Dafür brauchen sie an
// EINER Stelle: die drei Academy-Reisen, den Funktionskatalog (ohne die
// Verwaltungs-Themen), die Kernbotschaft und den Stand ihres Teams.
//
// ── WARUM NICHT EINFACH /admin/funktionen FREIGEBEN ───────────────────────
// Weil dort Dinge stehen, die die Leitung nicht entscheidet: Auszahlungen
// ablehnen, Provisionen nachbuchen, Boni vergeben. Eine Seite, auf der man
// Knöpfe sieht, die man nicht drücken darf, erzeugt Rückfragen statt Klarheit.
//
// Der Katalog wird IMPORTIERT und gefiltert (`katalogFuerLeitung`), nicht
// kopiert: Eine zweite Fassung würde beim nächsten neuen Eintrag
// auseinanderlaufen — und dann schult die Leitung eine Funktion, die es nicht
// mehr gibt.
//
// ── DER ZUGANG ─────────────────────────────────────────────────────────────
// Die Seite prüft die Rolle über `/agent/academy` (das Feld `istLeitung`, das
// der Server liefert). Kein eigener Rollen-Vergleich hier: Eine zweite Fassung
// derselben Regel geht auseinander.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { katalogFuerLeitung, anzahlNurVerwaltung } from "@/pages/admin-funktionen";
import { KernbotschaftKarte } from "@/components/KernbotschaftKarte";

const GRUND = "#0A1A3C";
const HELL = "#eef2fb";
const LEISE = "#9fb3d9";
const LEISER = "#7f97c4";
const AKZENT = "#5b8cff";

export default function AgentSchulungPage() {
  const [academy, setAcademy] = useState<any>(null);
  const [stand, setStand] = useState<any>(null);
  const [laedt, setLaedt] = useState(true);

  useEffect(() => {
    document.title = "Schulung — FIAON Team";
    void fetch("/api/fiaon/agent/academy", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => { setAcademy(j?.ok ? j : null); setLaedt(false); })
      .catch(() => setLaedt(false));
    // Der Team-Stand — dieselbe Route wie die Team-Zentrale.
    void fetch("/api/fiaon/admin/academy/stand", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setStand(j?.ok ? j : null))
      .catch(() => {});
  }, []);

  const katalog = katalogFuerLeitung();

  // ── NUR FÜR DIE LEITUNG ────────────────────────────────────────────────
  // Der Server hat entschieden; hier wird nur angezeigt oder nicht.
  if (!laedt && academy && !academy.istLeitung) {
    return (
      <div style={{ background: GRUND, minHeight: "100vh", padding: "40px 18px" }}>
        <p style={{ color: HELL, fontSize: 15, lineHeight: 1.6, maxWidth: 520 }}>
          Diese Seite ist für die Vertriebsleitung. Deine eigene Reise findest du
          unter <Link href="/agent/academy" style={{ color: AKZENT }}>Academy</Link>.
        </p>
      </div>
    );
  }

  return (
    <div data-fiaon="leitung-schulung" style={{ background: GRUND, minHeight: "100vh" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "26px 16px 96px" }}>
        <Link href="/agent/mehr" style={{
          color: LEISE, fontSize: 13, fontWeight: 700, textDecoration: "none",
          minHeight: 44, display: "inline-flex", alignItems: "center",
        }}>
          ← Mehr
        </Link>

        <p style={{
          color: AKZENT, fontSize: 11.5, fontWeight: 700, letterSpacing: ".16em",
          textTransform: "uppercase", margin: "14px 0 0",
        }}>
          Für die Vertriebsleitung
        </p>
        <h1 style={{
          color: HELL, fontSize: "clamp(26px,5.4vw,38px)", fontWeight: 800,
          lineHeight: 1.12, letterSpacing: "-.02em", margin: "8px 0 0",
        }}>
          Schulung
        </h1>
        <p style={{ color: LEISE, fontSize: 14, lineHeight: 1.6, margin: "12px 0 0", maxWidth: 620 }}>
          Alles, was du zum Einschulen brauchst: die drei Reisen zum Vorführen,
          der Funktionskatalog und der Stand deines Teams.
        </p>

        {/* ══════════════════════════════════════════════════════════════════
            1. DIE KERNBOTSCHAFT — GANZ OBEN

            Sie steht vor allem anderen, weil sie in jedem Gespräch vorkommt.
            Dasselbe Bauteil wie in der Academy und im Cockpit.
            ══════════════════════════════════════════════════════════════════ */}
        <section style={{ marginTop: 26 }}>
          <h2 style={{ color: HELL, fontSize: 16, fontWeight: 800, margin: "0 0 10px" }}>
            Die Kernbotschaft
          </h2>
          <KernbotschaftKarte dunkel />
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            2. DIE REISEN ZUM VORFÜHREN
            ══════════════════════════════════════════════════════════════════ */}
        <section style={{ marginTop: 30 }}>
          <h2 style={{ color: HELL, fontSize: 16, fontWeight: 800, margin: "0 0 4px" }}>
            Die Reisen
          </h2>
          <p style={{ color: LEISER, fontSize: 12.5, margin: "0 0 12px" }}>
            Bildschirm teilen, Reise öffnen, „Präsentieren" drücken — Vollbild,
            große Schrift, Pfeiltasten.
          </p>
          <div style={{ display: "grid", gap: 10 }}>
            {(academy?.reisen ?? []).map((r: any) => (
              <Link key={r.key} href={`/agent/academy/${r.key}`}
                    data-fiaon="leitung-reise"
                    style={{
                      display: "block", textDecoration: "none", padding: "16px 16px",
                      borderRadius: 16, background: "rgba(255,255,255,.05)",
                      boxShadow: `inset 0 0 0 1px ${r.ton?.akzent ?? AKZENT}3d`,
                    }}>
                <p style={{ margin: 0, color: HELL, fontSize: 16, fontWeight: 800 }}>
                  {r.titel}
                </p>
                <p style={{ margin: "5px 0 0", color: LEISE, fontSize: 12.5, lineHeight: 1.5 }}>
                  {r.unterzeile}
                </p>
                <p style={{
                  margin: "9px 0 0", color: LEISER, fontSize: 11.5,
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {r.kapitelZahl} Kapitel · ~{r.dauerMin} Min
                  {r.fortschritt?.kapitel > 0 && ` · du bist bei ${r.fortschritt.kapitel}`}
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            3. WER HAT SCHON ANGEFANGEN?

            Kein Urteil, nur ein Stand. Die Leitung sieht, mit wem sie noch
            einmal durchgehen sollte.
            ══════════════════════════════════════════════════════════════════ */}
        {stand?.mitarbeiter?.length > 0 && (
          <section style={{ marginTop: 30 }}>
            <h2 style={{ color: HELL, fontSize: 16, fontWeight: 800, margin: "0 0 4px" }}>
              Dein Team
            </h2>
            <p style={{ color: LEISER, fontSize: 12.5, margin: "0 0 12px" }}>
              {stand.hinweis}
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 7 }}>
              {stand.mitarbeiter.map((m: any) => (
                <li key={m.id} data-fiaon="leitung-teamstand"
                    style={{
                      display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10,
                      padding: "11px 14px", borderRadius: 13,
                      background: "rgba(255,255,255,.04)",
                    }}>
                  <span style={{ color: HELL, fontSize: 13.5, fontWeight: 700 }}>{m.name}</span>
                  <span style={{ color: LEISER, fontSize: 11.5 }}>{m.rolle}</span>
                  <span style={{
                    marginLeft: "auto", fontSize: 12, fontWeight: 700,
                    color: m.angefangen ? "#8ff0c8" : "#fbbf24",
                  }}>
                    {m.kurz}
                    {!m.angefangen && " — noch nicht geöffnet"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            4. DER FUNKTIONSKATALOG — GEFILTERT
            ══════════════════════════════════════════════════════════════════ */}
        <section style={{ marginTop: 30 }}>
          <h2 style={{ color: HELL, fontSize: 16, fontWeight: 800, margin: "0 0 4px" }}>
            Was das System kann
          </h2>
          <p style={{ color: LEISER, fontSize: 12.5, margin: "0 0 14px", lineHeight: 1.55 }}>
            Derselbe Katalog wie in der Verwaltung, ohne {anzahlNurVerwaltung()} Einträge,
            die nur die Geschäftsführung entscheidet (Auszahlungen ablehnen,
            Provisionen nachbuchen, Boni vergeben).
          </p>
          <div style={{ display: "grid", gap: 14 }}>
            {katalog.map((g) => (
              <div key={g.title} data-fiaon="leitung-katalog-gruppe" style={{
                padding: "15px 16px", borderRadius: 16,
                background: "rgba(255,255,255,.04)",
                boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)",
              }}>
                <p style={{ margin: 0, color: HELL, fontSize: 14.5, fontWeight: 800 }}>
                  {g.title}
                </p>
                <p style={{ margin: "4px 0 10px", color: LEISER, fontSize: 12 }}>
                  {g.intro}
                </p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
                  {g.items.map((i) => (
                    <li key={i.name} style={{ paddingLeft: 14, position: "relative" }}>
                      <span aria-hidden="true" style={{
                        position: "absolute", left: 0, top: 7, width: 5, height: 5,
                        borderRadius: 999, background: AKZENT, opacity: .75,
                      }} />
                      <span style={{ color: HELL, fontSize: 13, fontWeight: 600 }}>{i.name}</span>
                      <span style={{ color: LEISE, fontSize: 12, lineHeight: 1.5, display: "block" }}>
                        {i.desc}
                      </span>
                      {/* Der Weg dorthin — im neuen Tab, damit die Schulung
                          nicht verlassen wird. */}
                      {i.href && (
                        <a href={i.href} target="_blank" rel="noreferrer"
                           style={{
                             color: AKZENT, fontSize: 11.5, fontWeight: 700,
                             textDecoration: "none", display: "inline-block", marginTop: 3,
                             minHeight: 32, lineHeight: "26px",
                           }}>
                          öffnen →
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
