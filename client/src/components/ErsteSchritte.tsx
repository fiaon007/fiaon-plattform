import { useCallback, useEffect, useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// ERSTE SCHRITTE — die Tafel für den neuen Kollegen
//
// SIE BLOCKIERT NIE. Kein Vollbild-Tor, kein „erst hier klicken". Wer sofort
// arbeiten will, klappt sie zu und findet sie im Profil wieder. Der Grund ist
// einfach: Ein neuer Mitarbeiter, der am ersten Tag gegen eine Wand läuft,
// lernt als Erstes, dass die Software im Weg steht.
//
// Die Schemata sind GEZEICHNET, keine Screenshots. Ein Bildschirmfoto ist nach
// dem nächsten Umbau falsch, und niemand merkt es. Eine Zeichnung erklärt das
// Prinzip und veraltet nicht.
// ═══════════════════════════════════════════════════════════════════════════

interface Schritt {
  schluessel: string; titel: string; warum: string;
  ziel?: { href: string; label: string };
  automatisch?: boolean;
  erledigt: boolean; erledigtAm: string | null;
  quelle: "erkannt" | "geklickt" | null;
}

interface Daten {
  rolle: string; vorname: string; begruessung: string;
  schritte: Schritt[];
  karten: { titel: string; text: string; schema: string }[];
  ersteAufgabe: { titel: string; text: string; href: string };
  fertig: number; gesamt: number; abgeschlossen: boolean;
}

// ───────────────────────────────────────────────────────────────────────────
// Schemata — gezeichnet, 1,5 px, currentColor
// ───────────────────────────────────────────────────────────────────────────

function Schema({ art }: { art: string }) {
  const p = {
    width: "100%", height: 84, viewBox: "0 0 240 84", fill: "none",
    stroke: "currentColor", strokeWidth: 1.5,
    strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
    "aria-hidden": true, focusable: "false" as const,
    style: { display: "block", color: "var(--fi-primaer, #1d4ed8)", opacity: 0.75 },
  };

  if (art === "stufen") {
    // Drei Stapel unterschiedlicher Höhe, A am kürzesten — „am wenigsten fehlt".
    return (
      <svg {...p}>
        {[
          { x: 26, h: 18, l: "A" }, { x: 96, h: 40, l: "B" }, { x: 166, h: 60, l: "C" },
        ].map((s) => (
          <g key={s.l}>
            <rect x={s.x} y={70 - s.h} width={48} height={s.h} rx={4} />
            <text x={s.x + 24} y={80} textAnchor="middle" fontSize="11" fontWeight="700"
                  fill="currentColor" stroke="none">{s.l}</text>
          </g>
        ))}
        <path d="M12 70h216" strokeOpacity={0.35} />
        <path d="M74 20h14M88 20l-4-3M88 20l-4 3" strokeOpacity={0.5} />
      </svg>
    );
  }
  if (art === "ergebnis") {
    // Ein Gespräch, dann ein Klick, dann eine Spur.
    return (
      <svg {...p}>
        <rect x={14} y={22} width={62} height={40} rx={8} />
        <path d="M28 38h34M28 47h22" strokeOpacity={0.5} />
        <path d="M84 42h22m0 0-5-4m5 4-5 4" />
        <rect x={114} y={26} width={44} height={32} rx={8} />
        <path d="m126 42 5 5 9-11" />
        <path d="M166 42h22m0 0-5-4m5 4-5 4" />
        <rect x={196} y={22} width={30} height={40} rx={4} strokeDasharray="3 3" />
        <path d="M203 34h16M203 42h16M203 50h10" strokeOpacity={0.5} />
      </svg>
    );
  }
  if (art === "telefon") {
    return (
      <svg {...p}>
        <rect x={16} y={14} width={70} height={56} rx={8} />
        <path d="M28 30h46M28 40h34M28 50h40" strokeOpacity={0.45} />
        <circle cx={196} cy={42} r={20} />
        <path d="M189 34.5c.6 1.2 1.2 2.2 1.9 3a.7.7 0 0 1-.1.9l-.9.8a.6.6 0 0 0-.1.7c.4.8.9 1.6 1.6 2.2.7.6 1.5 1.1 2.3 1.4a.6.6 0 0 0 .7-.1l.8-.9a.7.7 0 0 1 .9-.1c.8.6 1.8 1.2 3 1.8" />
        <path d="M94 42h72m0 0-5-4m5 4-5 4" strokeDasharray="4 3" />
        <text x={196} y={74} textAnchor="middle" fontSize="9" fontWeight="700"
              fill="currentColor" stroke="none">unten rechts</text>
      </svg>
    );
  }
  if (art === "termin") {
    return (
      <svg {...p}>
        <rect x={20} y={16} width={80} height={54} rx={8} />
        <path d="M20 30h80M38 16v-6M82 16v-6" />
        <rect x={32} y={38} width={20} height={12} rx={2} strokeOpacity={0.5} />
        <rect x={60} y={38} width={20} height={12} rx={2} fill="currentColor" fillOpacity={0.18} />
        <path d="M110 43h30m0 0-5-4m5 4-5 4" strokeDasharray="4 3" />
        <circle cx={176} cy={34} r={11} />
        <path d="M162 66c0-7.5 6.3-13 14-13s14 5.5 14 13" />
        <text x={176} y={80} textAnchor="middle" fontSize="9" fontWeight="700"
              fill="currentColor" stroke="none">Kunde bucht</text>
      </svg>
    );
  }
  if (art === "raten") {
    // Vier Kästen, der linke am dunkelsten — die Reihenfolge der Dringlichkeit.
    return (
      <svg {...p}>
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <rect x={14 + i * 56} y={22} width={44} height={34} rx={6}
                  fill="currentColor" fillOpacity={0.2 - i * 0.05} />
            <text x={36 + i * 56} y={44} textAnchor="middle" fontSize="12" fontWeight="700"
                  fill="currentColor" stroke="none">{["!", "3", "2", "1"][i]}</text>
          </g>
        ))}
        <path d="M14 68h212" strokeOpacity={0.3} />
        <text x={14} y={80} fontSize="9" fontWeight="700" fill="currentColor" stroke="none">dringend</text>
        <text x={226} y={80} textAnchor="end" fontSize="9" fontWeight="700"
              fill="currentColor" stroke="none">kann warten</text>
      </svg>
    );
  }
  // zusage
  return (
    <svg {...p}>
      <rect x={62} y={12} width={116} height={60} rx={8} />
      <path d="M76 28h88M76 38h70M76 48h88M76 58h44" strokeOpacity={0.45} />
      <path d="M40 42h14m0 0-4-3m4 3-4 3" strokeOpacity={0.5} />
      <circle cx={178} cy={62} r={12} fill="#fff" />
      <path d="m172.5 62 3.5 3.5 6-7" />
    </svg>
  );
}

function Haken({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor"
         strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="m4 10.5 4 4 8-9" />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════

export function ErsteSchritte({ erzwingen = false }: { erzwingen?: boolean }) {
  const [daten, setDaten] = useState<Daten | null>(null);
  const [zu, setZu] = useState(false);

  const laden = useCallback(async () => {
    const r = await fetch("/api/fiaon/agent/erste-schritte", { credentials: "include" }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (j?.ok) setDaten(j);
  }, []);
  useEffect(() => { void laden(); }, [laden]);

  // Weggeklickt wird pro Browser gemerkt — die Tafel soll nicht bei jedem
  // Seitenwechsel wieder aufspringen.
  useEffect(() => {
    if (!erzwingen && localStorage.getItem("fiaon-erste-schritte-zu") === "1") setZu(true);
  }, [erzwingen]);

  if (!daten) return null;
  if (!erzwingen && (daten.abgeschlossen || zu)) return null;

  const abhaken = async (s: Schritt) => {
    if (s.quelle === "erkannt") return;
    setDaten((d) => d && {
      ...d,
      schritte: d.schritte.map((x) => x.schluessel === s.schluessel
        ? { ...x, erledigt: true, quelle: "geklickt" } : x),
      fertig: d.fertig + (s.erledigt ? 0 : 1),
    });
    await fetch(`/api/fiaon/agent/erste-schritte/${s.schluessel}`, {
      method: "POST", credentials: "include",
    }).catch(() => {});
  };

  return (
    <section className="fi-karte p-5 mb-4" aria-labelledby="erste-schritte-titel">
      <div className="flex flex-wrap items-start gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-bold uppercase tracking-[.16em]" style={{ color: "var(--fi-text-still)" }}>
            Erste Schritte · {daten.fertig} von {daten.gesamt}
          </p>
          <h2 id="erste-schritte-titel" className="text-[18px] font-bold tracking-tight mt-0.5"
              style={{ color: "var(--fi-text)" }}>
            {daten.vorname ? `Willkommen, ${daten.vorname}` : "Willkommen"}
          </h2>
        </div>
        {!erzwingen && (
          <button type="button"
                  onClick={() => { setZu(true); localStorage.setItem("fiaon-erste-schritte-zu", "1"); }}
                  className="text-[12px] font-semibold shrink-0" style={{ color: "var(--fi-text-still)" }}>
            Später — im Profil wiederfinden
          </button>
        )}
      </div>

      <p className="text-[13px] leading-relaxed mb-4" style={{ color: "var(--fi-text-still)" }}>
        {daten.begruessung}
      </p>

      {/* Fortschritt als Balken — eine Zahl allein sagt nicht, wie weit es noch ist. */}
      <div className="h-1.5 rounded-full mb-4 overflow-hidden" style={{ background: "var(--fi-flaeche)" }}>
        <div style={{
          width: `${Math.round((daten.fertig / Math.max(1, daten.gesamt)) * 100)}%`,
          height: "100%", background: "var(--fi-primaer)",
          transition: "width 420ms cubic-bezier(.32,.72,0,1)",
        }} />
      </div>

      {/* ── Schritte ────────────────────────────────────────────────────── */}
      <ol className="space-y-1.5 mb-5">
        {daten.schritte.map((s, i) => (
          <li key={s.schluessel} className="flex items-start gap-3 px-3 py-2.5 rounded-xl"
              style={{ background: s.erledigt ? "transparent" : "var(--fi-flaeche)" }}>
            <button type="button" onClick={() => void abhaken(s)}
                    disabled={s.quelle === "erkannt"}
                    aria-label={s.erledigt ? `${s.titel} erledigt` : `${s.titel} abhaken`}
                    className="shrink-0 flex items-center justify-center mt-0.5"
                    style={{
                      width: 22, height: 22, borderRadius: 7,
                      background: s.erledigt ? "var(--fi-primaer)" : "#fff",
                      border: s.erledigt ? "none" : "1.5px solid var(--fi-rand, #e2e8f0)",
                      color: "#fff",
                      cursor: s.quelle === "erkannt" ? "default" : "pointer",
                    }}>
              {s.erledigt && <Haken size={13} />}
              {!s.erledigt && (
                <span className="text-[11px] font-bold tabular-nums" style={{ color: "var(--fi-text-still)" }}>
                  {i + 1}
                </span>
              )}
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold"
                 style={{ color: s.erledigt ? "var(--fi-text-still)" : "var(--fi-text)" }}>
                {s.titel}
                {/* Woher das Häkchen kommt, gehört sichtbar dazu. */}
                {s.quelle === "erkannt" && (
                  <span className="ml-2 text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: "var(--fi-text-still)" }}>erkannt</span>
                )}
              </p>
              {!s.erledigt && (
                <p className="text-[12px] leading-snug mt-0.5" style={{ color: "var(--fi-text-still)" }}>
                  {s.warum}
                </p>
              )}
            </div>
            {s.ziel && !s.erledigt && (
              <a href={s.ziel.href}
                 // WER HINGEHT, HAT DEN SCHRITT GEMACHT (11.08.2026).
                 // Vorher musste man erst hingehen UND danach zurückkommen,
                 // um von Hand abzuhaken. Das tut niemand — die Tafel stand
                 // deshalb mit offenen Schritten da, die längst erledigt
                 // waren. Der Besuch wird beim Klick gemeldet; die Seite
                 // wechselt trotzdem sofort, weil der Aufruf nicht abgewartet
                 // wird.
                 onClick={() => {
                   void fetch(`/api/fiaon/agent/erste-schritte/besucht/${s.schluessel}`, {
                     method: "POST", credentials: "include",
                   }).catch(() => {});
                 }}
                 className="fi-zweitknopf shrink-0 px-3 py-1.5 text-[12px] font-semibold">
                {s.ziel.label}
              </a>
            )}
          </li>
        ))}
      </ol>

      {/* ── Anleitungskarten ────────────────────────────────────────────── */}
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
        {daten.karten.map((k) => (
          <article key={k.titel} className="rounded-2xl overflow-hidden"
                   style={{ background: "var(--fi-flaeche)", border: "1px solid var(--fi-rand, #eef2f7)" }}>
            <div className="px-3 pt-3">
              <Schema art={k.schema} />
            </div>
            <div className="px-3.5 pb-3.5 pt-1">
              <h3 className="text-[13px] font-bold" style={{ color: "var(--fi-text)" }}>{k.titel}</h3>
              <p className="text-[12px] leading-relaxed mt-1" style={{ color: "var(--fi-text-still)" }}>
                {k.text}
              </p>
            </div>
          </article>
        ))}
      </div>

      {/* ── Die erste echte Arbeit ──────────────────────────────────────── */}
      <div className="p-4 rounded-2xl"
           style={{ background: "rgba(29,78,216,.05)", border: "1px solid rgba(29,78,216,.16)" }}>
        <p className="text-[10.5px] font-bold uppercase tracking-[.16em]" style={{ color: "var(--fi-primaer)" }}>
          Deine erste Aufgabe
        </p>
        <p className="text-[14px] font-bold mt-1" style={{ color: "var(--fi-text)" }}>
          {daten.ersteAufgabe.titel}
        </p>
        <p className="text-[12.5px] leading-relaxed mt-1" style={{ color: "var(--fi-text-still)" }}>
          {daten.ersteAufgabe.text}
        </p>
        <a href={daten.ersteAufgabe.href} className="fi-primaerknopf inline-block mt-3 px-4 py-2.5 text-[13px] font-semibold">
          Los geht's
        </a>
      </div>
    </section>
  );
}
