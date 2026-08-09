import { useCallback, useEffect, useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// DOKUMENTE — Ausweis, Kontoauszug, Bonitätsauskunft
//
// Eine LÜCKE sieht anders aus als ein vorhandenes Dokument. Das ist der ganze
// Zweck der Sektion: Bisher musste man raten, ob ein Ausweis fehlt oder nur
// nirgends angezeigt wird.
//
// WER WAS SIEHT: Der Vorgesetzte öffnet Inhalte. Die Vertriebsleitung sieht, DASS
// etwas vorliegt — so steht es in ihrer Verpflichtungserklärung, und seit dem
// 10.08.2026 steht es auch im Server. Diese Komponente zeigt der Leitung
// deshalb gar keinen Öffnen-Knopf, statt einen anzubieten, der 403 liefert.
// ═══════════════════════════════════════════════════════════════════════════

interface Dokument {
  art: string; label: string; vorhanden: boolean;
  groesseKb: number | null; seit: string | null;
  typ: "pdf" | "bild" | "unbekannt" | null;
  benoetigt: boolean; erneutAngefordert: boolean;
}

interface Stand {
  ref: string | null; personId: number | null;
  kycStatus: string | null; schufaStatus: string | null;
  adminNotiz: string | null; schufaNotiz: string | null;
  geprueftAm: string | null; hochgeladenAm: string | null;
  dokumente: Dokument[]; inhaltErlaubt: boolean;
}

const KYC_TEXT: Record<string, { text: string; farbe: string }> = {
  approved: { text: "geprüft und angenommen", farbe: "#047857" },
  changes_requested: { text: "Änderung angefordert", farbe: "#b45309" },
  pending: { text: "noch nicht geprüft", farbe: "#64748b" },
};

function ZeichenDoc({ art, size = 17 }: { art: "blatt" | "luecke"; size?: number }) {
  const p = {
    width: size, height: size, viewBox: "0 0 20 20", fill: "none", stroke: "currentColor",
    strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
    "aria-hidden": true, focusable: "false" as const,
  };
  if (art === "blatt") {
    return <svg {...p}><path d="M11.5 2.5H6a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 6 17.5h8a1.5 1.5 0 0 0 1.5-1.5V6.5Z" /><path d="M11.5 2.5v4h4" /></svg>;
  }
  // Lücke: gestrichelter Umriss — sichtbar leer, nicht nur blass.
  return (
    <svg {...p}>
      <path d="M11.5 2.5H6a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 6 17.5h8a1.5 1.5 0 0 0 1.5-1.5V6.5Z" strokeDasharray="2.5 2.5" />
      <path d="M10 8.5v3M10 13.6v.1" />
    </svg>
  );
}

/**
 * `kundenRef`, NICHT `ref`.
 *
 * `ref` ist in React reserviert. Ein Prop dieses Namens an eine
 * Funktionskomponente wirft „Function components cannot have string refs" —
 * und zwar so, dass die GANZE Seite weiß bleibt, ohne dass in der Konsole
 * etwas Naheliegendes steht. Genau das ist am 10.08.2026 mit der Kundenakte
 * passiert; derselbe Fehler wie zwei Tage zuvor beim Startgespräch-Gate.
 */
export function DokumenteSektion({
  personId, kundenRef, adminSicht = false,
}: { personId: number; kundenRef?: string | null; adminSicht?: boolean }) {
  const [stand, setStand] = useState<Stand | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [vorschau, setVorschau] = useState<{ art: string; label: string; url: string; typ: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);

  const laden = useCallback(async () => {
    const pfad = adminSicht && kundenRef
      ? `/api/fiaon/admin/dokumente/${encodeURIComponent(kundenRef)}`
      : `/api/fiaon/dokumente/${personId}`;
    const r = await fetch(pfad, { credentials: "include" }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (j?.ok) setStand(j.stand);
    else setFehler(j?.error || "Dokumente nicht ladbar.");
  }, [adminSicht, kundenRef, personId]);

  useEffect(() => { void laden(); }, [laden]);

  const anfordern = async (art: string) => {
    setBusy(art);
    const r = await fetch(`/api/fiaon/dokumente/${personId}/anfordern`, {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ art }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setBusy(null);
    setMeldung(j?.meldung || j?.error || "Unbekannter Fehler.");
  };

  if (fehler) return <p className="text-[12.5px] text-slate-400">{fehler}</p>;
  if (!stand) return <p className="text-[12.5px] text-slate-400">Wird geladen …</p>;

  const kyc = KYC_TEXT[String(stand.kycStatus || "pending")] ?? KYC_TEXT.pending;

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
        <span className="text-[12px] font-semibold" style={{ color: kyc.farbe }}>
          Prüfstand: {kyc.text}
        </span>
        {stand.geprueftAm && (
          <span className="text-[11.5px] text-slate-400">
            zuletzt am {new Date(stand.geprueftAm).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}
          </span>
        )}
        {!stand.inhaltErlaubt && (
          <span className="text-[11.5px] text-slate-400">
            · Inhalte öffnet nur der Vorgesetzte
          </span>
        )}
      </div>

      {meldung && (
        <p className="mb-3 px-3 py-2 rounded-xl text-[12px] font-semibold"
           style={{ background: "rgba(29,78,216,.06)", color: "#1d4ed8" }}>
          {meldung}
        </p>
      )}

      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
        {stand.dokumente.map((d) => (
          <div key={d.art} className="p-3 rounded-xl"
               style={{
                 background: d.vorhanden ? "#fff" : "#fafbfd",
                 border: d.vorhanden ? "1px solid #e8eef6" : "1px dashed #cbd5e1",
               }}>
            <div className="flex items-start gap-2.5">
              <span className="shrink-0 mt-0.5" style={{ color: d.vorhanden ? "#1d4ed8" : "#94a3b8" }}>
                <ZeichenDoc art={d.vorhanden ? "blatt" : "luecke"} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-slate-900">{d.label}</p>
                {d.vorhanden ? (
                  <p className="text-[11.5px] text-slate-400">
                    {d.groesseKb} KB
                    {d.seit && ` · ${new Date(d.seit).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}`}
                    {d.typ === "bild" && " · Bild"}
                  </p>
                ) : (
                  <p className="text-[11.5px] font-semibold" style={{ color: d.benoetigt ? "#b45309" : "#94a3b8" }}>
                    {d.benoetigt ? "fehlt — wird gebraucht" : "nicht hinterlegt"}
                  </p>
                )}
                {d.erneutAngefordert && (
                  <p className="text-[11px] text-amber-700 mt-0.5">erneut angefordert</p>
                )}
              </div>
            </div>

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {d.vorhanden && stand.inhaltErlaubt && (
                <button type="button"
                        onClick={() => setVorschau({
                          art: d.art, label: d.label, typ: d.typ ?? "pdf",
                          url: adminSicht && stand.ref
                            ? `/api/fiaon/admin/dokumente/${encodeURIComponent(stand.ref)}/${d.art}/datei`
                            : `/api/fiaon/agent/dokumente/${personId}/${d.art}/datei`,
                        })}
                        className="px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold text-white"
                        style={{ background: "#1d4ed8" }}>
                  Ansehen
                </button>
              )}
              {!d.vorhanden && d.benoetigt && (
                <button type="button" onClick={() => void anfordern(d.art)} disabled={busy === d.art}
                        className="px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold bg-white text-slate-600 disabled:opacity-40"
                        style={{ border: "1px solid #e8eef6" }}>
                  {busy === d.art ? "…" : "Anfordern"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {(stand.adminNotiz || stand.schufaNotiz) && (
        <p className="mt-3 text-[12px] text-slate-500 leading-relaxed">
          {stand.adminNotiz && <>Notiz: {stand.adminNotiz}<br /></>}
          {stand.schufaNotiz && <>Zur Auskunft: {stand.schufaNotiz}</>}
        </p>
      )}

      {/* ── Vorschau ────────────────────────────────────────────────────
          Vollbild-Ebene, auch auf dem Bildschirm: Ein Ausweis in einem
          200-Pixel-Kasten ist nicht lesbar, und darum geht es hier. */}
      {vorschau && (
        <>
          <div className="fixed inset-0 z-[420]" onClick={() => setVorschau(null)} aria-hidden="true"
               style={{ background: "rgba(7,11,22,.72)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }} />
          <div className="fixed inset-0 z-[421] flex flex-col p-3 sm:p-6 pointer-events-none">
            <div className="pointer-events-auto flex items-center gap-3 mb-3">
              <p className="text-[14px] font-bold text-white flex-1 truncate">{vorschau.label}</p>
              <a href={vorschau.url} download
                 className="px-3 py-2 rounded-xl text-[12.5px] font-semibold bg-white/12 text-white backdrop-blur">
                Herunterladen
              </a>
              <button type="button" onClick={() => setVorschau(null)} aria-label="Schließen"
                      className="w-9 h-9 rounded-full flex items-center justify-center bg-white/12 text-white backdrop-blur">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
                  <path d="m5 5 10 10M15 5 5 15" />
                </svg>
              </button>
            </div>
            <div className="pointer-events-auto flex-1 rounded-2xl overflow-hidden bg-white">
              {vorschau.typ === "bild"
                ? <img src={vorschau.url} alt={vorschau.label}
                       style={{ width: "100%", height: "100%", objectFit: "contain", background: "#0f172a" }} />
                : <iframe title={vorschau.label} src={vorschau.url}
                          style={{ width: "100%", height: "100%", border: 0 }} />}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
