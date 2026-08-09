import { useCallback, useEffect, useMemo, useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// „E-MAIL SENDEN" — ein Menü, zwei Geräte
//
// Auf dem Bildschirm eine schwebende Glas-Ebene, auf dem Telefon ein Blatt von
// unten. Nicht aus Geschmack: Ein zentriertes Fenster auf 380 px lässt für den
// Inhalt 300 px übrig, und das Sende-Menü hat je Ereignis drei Zeilen Text.
//
// Was hier steht, kommt vollständig vom Server (Registry + Zustandsprüfung).
// Die Seite entscheidet nichts selbst — sonst gäbe es zwei Wahrheiten darüber,
// ob eine Mail rausgehen darf, und die im Browser wäre die falsche.
// ═══════════════════════════════════════════════════════════════════════════

interface EventZeile {
  type: string;
  label: string;
  gruppe: string;
  klartext: string;
  verifikation: "bestaetigt" | "nicht_bestaetigt" | "ungeprueft";
  verifikationsText: string;
  hatVorlage: boolean;
  erlaubt: boolean;
  grund: string | null;
  heute: number;
}

interface HistorieZeile {
  id: number; event: string; titel: string; status: string; grund: string | null;
  am: string; ausgeloestVon: string; zustellung?: string | null;
}

const GRUPPEN: { schluessel: string; titel: string }[] = [
  { schluessel: "zahlung", titel: "Zahlung" },
  { schluessel: "termin", titel: "Termin" },
  { schluessel: "konto", titel: "Konto" },
  { schluessel: "dokumente", titel: "Dokumente" },
  { schluessel: "lead", titel: "Lead" },
];

/** Briefumschlag — 20×20, 1,5 px, currentColor. Wie alle Zeichen im Haus. */
export function MarkeBrief({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor"
         strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="2.5" y="4.5" width="15" height="11" rx="2" />
      <path d="m3 6 6.3 4.6c.4.3 1 .3 1.4 0L17 6" />
    </svg>
  );
}

function Ampel({ e }: { e: EventZeile }) {
  const farbe = e.erlaubt ? "#059669" : "#94a3b8";
  return (
    <span className="inline-flex items-center gap-1.5 shrink-0" title={e.erlaubt ? "sendbar" : (e.grund || "")}>
      <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 99, background: farbe }} />
      <span className="text-[11px] font-semibold" style={{ color: farbe }}>
        {e.erlaubt ? "sendbar" : "gesperrt"}
      </span>
    </span>
  );
}

export function SendeMenue({
  personId, basis = "/api/fiaon/agent/mail", offen, onSchliessen, onGesendet,
}: {
  personId: number;
  basis?: string;
  offen: boolean;
  onSchliessen: () => void;
  onGesendet?: () => void;
}) {
  const [daten, setDaten] = useState<{ events: EventZeile[]; historie: HistorieZeile[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ art: "gut" | "schlecht"; text: string } | null>(null);
  const [vorschau, setVorschau] = useState<string | null>(null);

  const laden = useCallback(async () => {
    const r = await fetch(`${basis}/${personId}`, { credentials: "include" }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (j?.ok) setDaten({ events: j.events || [], historie: j.historie || [] });
  }, [basis, personId]);

  useEffect(() => { if (offen) void laden(); }, [offen, laden]);

  // Esc schließt. Ein Menü, das nur über einen kleinen Knopf zu schließen ist,
  // fühlt sich auf dem Bildschirm wie eine Falle an.
  useEffect(() => {
    if (!offen) return;
    const zu = (e: KeyboardEvent) => { if (e.key === "Escape") onSchliessen(); };
    window.addEventListener("keydown", zu);
    return () => window.removeEventListener("keydown", zu);
  }, [offen, onSchliessen]);

  const nachGruppe = useMemo(() => {
    const m = new Map<string, EventZeile[]>();
    for (const e of daten?.events || []) m.set(e.gruppe, [...(m.get(e.gruppe) || []), e]);
    return m;
  }, [daten]);

  const senden = async (e: EventZeile) => {
    if (!confirm(`„${e.label}" jetzt an den Kunden schicken?`)) return;
    setBusy(e.type);
    const r = await fetch(`${basis}/${personId}/${e.type}`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" }, body: "{}",
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setBusy(null);
    setMeldung({ art: j?.ok ? "gut" : "schlecht", text: j?.meldung || j?.error || "Unbekannter Fehler." });
    void laden();
    onGesendet?.();
  };

  if (!offen) return null;

  const inhalt = (
    <>
      <div className="px-5 sm:px-7 pt-5 pb-4 shrink-0 fi-glas" style={{ transform: "translateZ(20px)" }}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] font-semibold uppercase tracking-[.2em]" style={{ color: "var(--fi-text-still)" }}>
              An diesen Kunden
            </p>
            <h2 className="mt-1 text-[19px] sm:text-[22px] font-bold tracking-tight leading-tight">
              <span className="fi-gradient-text">E-Mail senden</span>
            </h2>
          </div>
          <button type="button" onClick={onSchliessen} aria-label="Schließen"
                  className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: "var(--fi-seite)", color: "var(--fi-text-leise)" }}>
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
              <path d="m5 5 10 10M15 5 5 15" />
            </svg>
          </button>
        </div>
        <div className="mt-3.5" style={{ height: 1, background: "linear-gradient(90deg, rgba(29,78,216,.28), rgba(15,23,42,.06) 40%, transparent)" }} />
      </div>

      <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-4">
        {meldung && (
          <p className="mb-3 px-3 py-2.5 rounded-xl text-[12.5px] font-semibold"
             style={meldung.art === "gut"
               ? { background: "rgba(5,150,105,.08)", color: "#047857" }
               : { background: "rgba(217,119,6,.08)", color: "#b45309" }}>
            {meldung.text}
          </p>
        )}

        {!daten && <p className="text-[13px]" style={{ color: "var(--fi-text-still)" }}>Wird geladen …</p>}

        {daten && GRUPPEN.filter((g) => nachGruppe.has(g.schluessel)).map((g) => (
          <div key={g.schluessel} className="mb-5">
            <p className="text-[10.5px] font-semibold uppercase tracking-[.1em] mb-2"
               style={{ color: "var(--fi-text-still)" }}>{g.titel}</p>
            <div className="space-y-2">
              {(nachGruppe.get(g.schluessel) || []).map((e) => (
                <div key={e.type} className="fi-karte p-3.5">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-bold leading-tight">{e.label}</p>
                      <p className="mt-1 text-[12px] leading-relaxed" style={{ color: "var(--fi-text-leise)" }}>
                        {e.klartext}
                      </p>
                    </div>
                    <Ampel e={e} />
                  </div>

                  {/* Der Grund im Klartext — nicht als Wolke am Mauszeiger,
                      die auf dem Telefon niemand sieht. */}
                  {!e.erlaubt && e.grund && (
                    <p className="mt-2 text-[11.5px] leading-snug" style={{ color: "var(--fi-text-still)" }}>
                      {e.grund}
                    </p>
                  )}

                  <div className="mt-2.5 pt-2.5 flex flex-wrap items-center gap-2"
                       style={{ borderTop: "1px solid var(--fi-linie)" }}>
                    <span className="text-[10.5px] font-semibold" title={e.verifikationsText}
                          style={{ color: e.verifikation === "bestaetigt" ? "#059669" : "var(--fi-text-still)" }}>
                      {e.verifikation === "bestaetigt" ? "Zweig bestätigt"
                        : e.verifikation === "nicht_bestaetigt" ? "Zweig nicht bestätigt"
                        : "Zweig ungeprüft"}
                    </span>
                    {e.hatVorlage && (
                      <button type="button" onClick={() => setVorschau(e.type)}
                              className="text-[11.5px] font-semibold" style={{ color: "var(--fi-primaer)" }}>
                        Vorschau
                      </button>
                    )}
                    <button type="button" onClick={() => void senden(e)} disabled={!e.erlaubt || busy === e.type}
                            className="fi-primaerknopf ml-auto px-3.5 py-2 text-[12.5px] font-semibold disabled:opacity-40">
                      {busy === e.type ? "…" : "Senden"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {daten && daten.historie.length > 0 && (
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[.1em] mb-2"
               style={{ color: "var(--fi-text-still)" }}>Was schon rausging</p>
            {daten.historie.slice(0, 10).map((h) => (
              <div key={h.id} className="py-1.5 text-[12px] flex flex-wrap items-baseline gap-x-2"
                   style={{ boxShadow: "inset 0 -1px 0 var(--fi-linie)" }}>
                <span className="font-semibold">{h.titel}</span>
                <span style={{ color: h.status === "versandt" ? "#059669" : "#b45309" }}>
                  {h.zustellung
                    ? h.zustellung
                    : h.status === "versandt" ? "angenommen" : h.status === "uebersprungen" ? "übersprungen" : "fehlgeschlagen"}
                </span>
                <span style={{ color: "var(--fi-text-still)" }}>
                  {new Date(h.am).toLocaleString("de-DE", {
                    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin",
                  })} · {h.ausgeloestVon}
                </span>
                {h.grund && <span className="block w-full text-[11px]" style={{ color: "var(--fi-text-still)" }}>{h.grund}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      <div className="fixed inset-0 z-[300]" onClick={onSchliessen} aria-hidden="true"
           style={{ background: "rgba(7,11,22,.5)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }} />
      {/* Bildschirm: schwebende Ebene. Telefon: Blatt von unten. */}
      <div className="fixed inset-0 z-[301] flex items-end sm:items-center justify-center sm:p-6 pointer-events-none">
        <div role="dialog" aria-modal="true" aria-label="E-Mail senden"
             className="w-full flex flex-col overflow-hidden pointer-events-auto"
             style={{
               maxWidth: 560,
               maxHeight: "88vh",
               background: "var(--fi-karte, #fff)",
               borderRadius: "22px 22px 0 0",
               boxShadow: "0 40px 120px -24px rgba(13,26,63,.5), inset 0 1px 0 rgba(255,255,255,.7)",
               animation: "sendeAuf 420ms cubic-bezier(.32,.72,0,1) both",
             }}>
          <style>{`
            @media (min-width: 640px) { [role="dialog"][aria-label="E-Mail senden"] { border-radius: 22px !important; } }
            @keyframes sendeAuf { from { opacity: 0; transform: translateY(28px) } to { opacity: 1; transform: none } }
            @media (prefers-reduced-motion: reduce) { [role="dialog"][aria-label="E-Mail senden"] { animation: none !important } }
          `}</style>
          {inhalt}
        </div>
      </div>
      {vorschau && <MailVorschau event={vorschau} onZu={() => setVorschau(null)} />}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LIVE-VORSCHAU — „wie sieht die Mail aus?"
//
// Das echte Vorlagen-HTML aus Brevo, mit den Beispielwerten der Registry
// gefüllt. In einem abgeschotteten iframe: Vorlagen enthalten fremdes HTML,
// und das hat im Seitenkontext nichts verloren.
//
// Der Geräterahmen ist kein schmaler Kasten, sondern ein Rahmen mit Radius,
// Rand und Kerbe. Wer beurteilen soll, ob eine Mail auf dem Telefon gut
// aussieht, braucht den Eindruck eines Telefons.
// ═══════════════════════════════════════════════════════════════════════════
export function MailVorschau({ event, onZu }: { event: string; onZu: () => void }) {
  const [daten, setDaten] = useState<{ html: string | null; betreff?: string; grund?: string } | null>(null);
  const [geraet, setGeraet] = useState<"desktop" | "handy">("desktop");

  useEffect(() => {
    fetch(`/api/fiaon/admin/mail/vorschau/${encodeURIComponent(event)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setDaten(j?.ok ? j : { html: null, grund: j?.error || "Vorschau nicht ladbar." }))
      .catch(() => setDaten({ html: null, grund: "Vorschau nicht ladbar." }));
  }, [event]);

  return (
    <>
      <div className="fixed inset-0 z-[400]" onClick={onZu} aria-hidden="true"
           style={{ background: "rgba(7,11,22,.62)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }} />
      <div className="fixed inset-0 z-[401] flex items-center justify-center p-3 sm:p-6 pointer-events-none">
        <div role="dialog" aria-modal="true" aria-label="Mail-Vorschau"
             className="w-full flex flex-col overflow-hidden pointer-events-auto"
             style={{ maxWidth: 780, maxHeight: "92vh", background: "var(--fi-karte,#fff)", borderRadius: 22,
                      boxShadow: "0 40px 120px -24px rgba(13,26,63,.55)" }}>
          <div className="px-5 sm:px-7 pt-5 pb-4 shrink-0 fi-glas">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <p className="text-[10.5px] font-semibold uppercase tracking-[.2em]" style={{ color: "var(--fi-text-still)" }}>
                  So sieht der Kunde sie
                </p>
                <h2 className="mt-1 text-[17px] font-bold tracking-tight truncate">
                  {daten?.betreff || event}
                </h2>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {(["desktop", "handy"] as const).map((g) => (
                  <button key={g} type="button" onClick={() => setGeraet(g)}
                          className="px-3 py-1.5 rounded-xl text-[12px] font-semibold"
                          style={geraet === g
                            ? { background: "var(--fi-primaer)", color: "#fff" }
                            : { background: "var(--fi-seite)", color: "var(--fi-text-leise)" }}>
                    {g === "desktop" ? "Bildschirm" : "Telefon"}
                  </button>
                ))}
                <button type="button" onClick={onZu} aria-label="Schließen"
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ background: "var(--fi-seite)", color: "var(--fi-text-leise)" }}>
                  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
                    <path d="m5 5 10 10M15 5 5 15" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex justify-center" style={{ background: "var(--fi-seite)" }}>
            {!daten && <p className="text-[13px]" style={{ color: "var(--fi-text-still)" }}>Wird geladen …</p>}
            {daten && !daten.html && (
              <div className="text-center py-10 max-w-sm">
                <p className="text-[14px] font-semibold">Keine Vorlage zugeordnet.</p>
                <p className="text-[12.5px] mt-1.5 leading-relaxed" style={{ color: "var(--fi-text-still)" }}>
                  {daten.grund}
                </p>
                <a href="/admin/events" className="fi-primaerknopf inline-block mt-4 px-4 py-2.5 text-[13px] font-semibold">
                  Template zuordnen
                </a>
              </div>
            )}
            {daten?.html && (
              <div style={geraet === "handy"
                ? {
                    width: 390, maxWidth: "100%", borderRadius: 38, padding: 10,
                    background: "#0f172a", boxShadow: "0 24px 60px -18px rgba(13,26,63,.5)", position: "relative",
                  }
                : {
                    width: "100%", maxWidth: 680, borderRadius: 14, padding: 0,
                    border: "1px solid var(--fi-linie)", background: "#fff", overflow: "hidden",
                    boxShadow: "0 12px 40px -14px rgba(13,26,63,.25)",
                  }}>
                {geraet === "handy" && (
                  <span aria-hidden="true" style={{
                    position: "absolute", top: 18, left: "50%", transform: "translateX(-50%)",
                    width: 92, height: 22, borderRadius: 99, background: "#0f172a", zIndex: 2,
                  }} />
                )}
                <iframe
                  title="Mail-Vorschau"
                  // Kein allow-scripts, kein allow-same-origin: Vorlagen-HTML
                  // ist fremder Code. Es soll aussehen, nicht ausgeführt werden.
                  sandbox=""
                  srcDoc={daten.html}
                  style={{
                    width: "100%", height: geraet === "handy" ? 640 : 560, border: 0,
                    borderRadius: geraet === "handy" ? 30 : 14, background: "#fff", display: "block",
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
