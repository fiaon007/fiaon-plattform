import { useCallback, useEffect, useMemo, useState } from "react";
import { AgentShell, ACCENT } from "./shared";
import { Reveal } from "./motion";
import { AuftraegeListe } from "./auftraege-liste";

// ═══════════════════════════════════════════════════════════════════════════
// /agent/aufgaben — was die Verwaltung von mir erwartet
//
// Zwei Sorten Einträge, und die Unterscheidung ist der ganze Sinn der Seite:
//
//   Aufgabe  Etwas ist zu tun, es hat eine Frist und meinen Namen daran. Nur
//            ICH kann sie abhaken.
//   Hinweis  Eine Notiz, die für mich freigegeben wurde. Nichts zu tun —
//            Wissen, das man vor einem Anruf haben will.
//
// Reihenfolge: überfällig, heute, ohne Frist, später. Ein Sortieren nach
// Anlagedatum wäre bequemer zu bauen und im Alltag nutzlos.
//
// Es gibt keine Anlage-Funktion für den Agenten. Was er selbst festhält, gehört
// ins Kontakt-Ergebnis am Kunden — dort steht es in der Historie, die die
// Verwaltung liest. Zwei Notizsysteme im Portal wären ein Notizsystem zu viel.
// ═══════════════════════════════════════════════════════════════════════════

interface Vermerk {
  id: number;
  art: "notiz" | "aufgabe";
  ref: string | null;
  kunde: string | null;
  text: string;
  faelligAm: string | null;
  ueberfaellig: boolean;
  heuteFaellig: boolean;
  dringend: boolean;
  status: "offen" | "erledigt";
  erledigtAm: string | null;
  erledigtVon: string | null;
  autorName: string;
  createdAt: string;
  meins: boolean;
}

async function api(pfad: string, init?: RequestInit) {
  const res = await fetch(`/api/fiaon${pfad}`, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  const json = await res.json().catch(() => null);
  return { ok: res.ok && json?.ok, json };
}

function tag(iso: string | null): string {
  if (!iso) return "";
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
}
function zeit(v: string | null): string {
  if (!v) return "";
  return new Date(v).toLocaleString("de-DE", {
    timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

/** Sortierschlüssel: was zuerst drängt, steht zuerst. */
function rang(v: Vermerk): number {
  if (v.status === "erledigt") return 9;
  if (v.ueberfaellig) return 0;
  if (v.heuteFaellig) return 1;
  if (v.dringend) return 2;
  if (!v.faelligAm) return 4;
  return 3;
}

const CSS = `
.au-karte{
  position:relative; overflow:hidden;
  border-radius:var(--fi-radius-karte,14px);
  background:#fff; border:1px solid var(--fi-linie,#e2e8f0);
  box-shadow:var(--fi-schatten-ruhe), var(--fi-glanzkante);
  transition:box-shadow 280ms var(--fi-kurve), transform 280ms var(--fi-kurve);
}
.au-karte[data-stufe="ueberfaellig"]{ border-left:3px solid var(--fi-tier1,#dc2626); }
.au-karte[data-stufe="heute"]{ border-left:3px solid var(--fi-primaer,#1d4ed8); }
.au-karte[data-stufe="dringend"]{ border-left:3px solid var(--fi-tier2,#d97706); }
.au-karte[data-stufe="erledigt"]{ opacity:.62; }
.au-karte:active{ transform:scale(.995); }

.au-haken{
  width:38px; height:38px; border-radius:11px; flex-shrink:0;
  display:inline-flex; align-items:center; justify-content:center;
  border:1px solid var(--fi-linie,#e2e8f0); background:#fff; color:#94a3b8;
  transition:all 200ms var(--fi-kurve);
}
.au-haken[data-an="1"]{
  border-color:transparent; color:#fff;
  background:linear-gradient(180deg,#10b981,#059669);
  box-shadow:0 3px 10px -3px rgba(5,150,105,.6), inset 0 1px 0 rgba(255,255,255,.3);
}
.au-haken:not([data-an="1"]):hover{ border-color:#059669; color:#059669; }

.au-reiter{ display:inline-flex; padding:3px; border-radius:12px; background:#eef2f7; box-shadow:inset 0 1px 2px rgba(15,23,42,.08); }
.au-reiter > button{ padding:6px 12px; border-radius:9px; font-size:12.5px; font-weight:700; color:#64748b; transition:all 180ms var(--fi-kurve); }
.au-reiter > button[data-an="1"]{ background:#fff; color:#0f172a; box-shadow:0 1px 3px rgba(15,23,42,.16); }
`;

export default function AgentAufgabenSeite() {
  return (
    <AgentShell>
      <Inhalt />
    </AgentShell>
  );
}

function Inhalt() {
  const [liste, setListe] = useState<Vermerk[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [reiter, setReiter] = useState<"offen" | "auftraege" | "hinweise" | "erledigt">("offen");
  // Aufträge der Leitung (E-028): Justin übergibt Aufgaben aus seiner Liste.
  const [auftraegeZahl, setAuftraegeZahl] = useState(0);

  const laden = useCallback(async () => {
    setLaedt(true);
    const r = await api("/agent/vermerke");
    setListe(r.ok ? r.json.vermerke : []);
    setLaedt(false);
    const z = await api("/agent/vermerke/zahlen");
    if (z.ok) setAuftraegeZahl(Number(z.json.auftraege || 0));
  }, []);

  useEffect(() => { void laden(); }, [laden]);

  const abhaken = async (v: Vermerk) => {
    setBusy(v.id);
    // Sofort umschalten: Der Haken muss unter dem Finger reagieren, nicht nach
    // dem Netzwerk. Bei einem Fehler wird neu geladen und der Zustand korrigiert.
    setListe((alt) => alt.map((x) => x.id === v.id
      ? { ...x, status: x.status === "offen" ? "erledigt" : "offen" } : x));
    const r = await api(`/agent/vermerke/${v.id}/status`, {
      method: "POST",
      body: JSON.stringify({ status: v.status === "offen" ? "erledigt" : "offen" }),
    });
    setBusy(null);
    if (!r.ok) void laden();
    else {
      // Der Zähler in der Navigation hängt an denselben Zahlen.
      window.dispatchEvent(new Event("agent-aufgaben-geaendert"));
      void laden();
    }
  };

  const aufgabenOffen = useMemo(
    () => liste.filter((v) => v.art === "aufgabe" && v.status === "offen").sort((a, b) => rang(a) - rang(b)),
    [liste],
  );
  const hinweise = useMemo(
    () => liste.filter((v) => v.art === "notiz").sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [liste],
  );
  const erledigt = useMemo(
    () => liste.filter((v) => v.art === "aufgabe" && v.status === "erledigt")
      .sort((a, b) => +new Date(b.erledigtAm || 0) - +new Date(a.erledigtAm || 0)),
    [liste],
  );

  const ueberfaellig = aufgabenOffen.filter((v) => v.ueberfaellig).length;
  const heute = aufgabenOffen.filter((v) => v.heuteFaellig).length;
  const sichtbar = reiter === "offen" ? aufgabenOffen : reiter === "hinweise" ? hinweise : reiter === "auftraege" ? [] : erledigt;

  return (
    <div className="max-w-2xl pb-24 md:pb-8">
      <style>{CSS}</style>

      <Reveal index={0}>
        <h1 className="text-xl font-bold tracking-tight mb-1">Aufgaben</h1>
        <p className="text-[12px] text-slate-400 mb-4">
          Was die Verwaltung dir zugewiesen hat — und Hinweise, die für dich freigegeben sind.
        </p>
      </Reveal>

      {/* Lage in zwei Zahlen. Mehr braucht niemand, um zu wissen, wo er steht. */}
      <Reveal index={1}>
        <div className="grid grid-cols-3 gap-2.5 mb-4">
          {[
            { label: "Offen", wert: aufgabenOffen.length, farbe: "#0f172a" },
            { label: "Heute fällig", wert: heute, farbe: ACCENT },
            { label: "Überfällig", wert: ueberfaellig, farbe: ueberfaellig > 0 ? "#dc2626" : "#94a3b8" },
          ].map((k) => (
            <div key={k.label} className="au-karte px-3.5 py-3">
              <p className="text-[22px] font-bold leading-none" style={{ color: k.farbe, fontVariantNumeric: "tabular-nums" }}>
                {k.wert}
              </p>
              <p className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-slate-400 mt-1">{k.label}</p>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal index={2}>
        <div className="au-reiter mb-4">
          <button type="button" data-an={reiter === "offen" ? "1" : undefined} onClick={() => setReiter("offen")}>
            Zu tun {aufgabenOffen.length > 0 ? `(${aufgabenOffen.length})` : ""}
          </button>
          <button type="button" data-an={reiter === "auftraege" ? "1" : undefined} onClick={() => setReiter("auftraege")}>
            Aufträge {auftraegeZahl > 0 ? `(${auftraegeZahl})` : ""}
          </button>
          <button type="button" data-an={reiter === "hinweise" ? "1" : undefined} onClick={() => setReiter("hinweise")}>
            Hinweise {hinweise.length > 0 ? `(${hinweise.length})` : ""}
          </button>
          <button type="button" data-an={reiter === "erledigt" ? "1" : undefined} onClick={() => setReiter("erledigt")}>
            Erledigt
          </button>
        </div>
      </Reveal>

      {laedt && reiter !== "auftraege" && <p className="text-[13px] text-slate-400">Wird geladen …</p>}

      {reiter === "auftraege" && (
        <Reveal index={3}>
          <p className="text-[12px] text-slate-400 mb-3">Aufgaben, die Justin dir aus seiner Liste übergeben hat. Annehmen, Rückfrage stellen, Ergebnis melden — alles hier.</p>
          <AuftraegeListe onGeaendert={() => void laden()} />
        </Reveal>
      )}

      {!laedt && reiter !== "auftraege" && sichtbar.length === 0 && (
        <Reveal index={3}>
          <div className="au-karte px-5 py-8 text-center">
            <p className="text-[14px] font-semibold text-slate-800">
              {reiter === "offen" ? "Nichts offen." : reiter === "hinweise" ? "Keine Hinweise." : "Noch nichts erledigt."}
            </p>
            <p className="text-[12.5px] text-slate-400 mt-1">
              {reiter === "offen"
                ? "Sobald die Verwaltung dir etwas zuweist, steht es hier — mit Frist."
                : reiter === "hinweise"
                  ? "Hier erscheinen Notizen, die für dich oder das Team freigegeben wurden."
                  : "Abgehakte Aufgaben sammeln sich hier."}
            </p>
          </div>
        </Reveal>
      )}

      <div className="space-y-2.5">
        {sichtbar.map((v, i) => {
          const stufe = v.status === "erledigt" ? "erledigt"
            : v.ueberfaellig ? "ueberfaellig"
            : v.heuteFaellig ? "heute"
            : v.dringend ? "dringend" : undefined;
          return (
            <Reveal key={v.id} index={Math.min(i + 3, 8)}>
              <div className="au-karte px-4 py-3.5 flex items-start gap-3" data-stufe={stufe}>
                {v.art === "aufgabe" && v.meins ? (
                  <button type="button" className="au-haken" data-an={v.status === "erledigt" ? "1" : undefined}
                    disabled={busy === v.id} onClick={() => void abhaken(v)}
                    aria-label={v.status === "offen" ? "Als erledigt markieren" : "Wieder öffnen"}>
                    {/* Ein Haken, gezeichnet — kein Icon-Paket für ein Häkchen. */}
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                ) : (
                  <span className="w-[38px] h-[38px] rounded-[11px] shrink-0 inline-flex items-center justify-center"
                    style={{ background: "var(--fi-flaeche-akzent,#f1f5ff)", color: ACCENT }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M6 4h9l4 4v12H6z" /><path d="M9 12h7M9 16h5" />
                    </svg>
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <p className={`text-[14px] leading-snug ${v.status === "erledigt" ? "text-slate-400 line-through" : "text-slate-900 font-medium"}`}>
                    {v.text}
                  </p>
                  <p className="text-[11.5px] text-slate-400 mt-1 flex flex-wrap items-center gap-x-2">
                    {v.kunde && <span className="font-semibold text-slate-500">{v.kunde}</span>}
                    {v.art === "aufgabe" && v.status === "offen" && (
                      <span className="font-semibold"
                        style={{ color: v.ueberfaellig ? "#dc2626" : v.heuteFaellig ? ACCENT : undefined }}>
                        {v.faelligAm
                          ? (v.ueberfaellig ? `überfällig seit ${tag(v.faelligAm)}` : v.heuteFaellig ? "heute fällig" : `bis ${tag(v.faelligAm)}`)
                          : "ohne Frist"}
                      </span>
                    )}
                    {v.dringend && v.status === "offen" && (
                      <span className="font-bold" style={{ color: "#b45309" }}>dringend</span>
                    )}
                    {v.status === "erledigt" && (
                      <span className="text-emerald-600 font-semibold">erledigt {zeit(v.erledigtAm)}</span>
                    )}
                    <span>von {v.autorName}</span>
                  </p>

                  {/* Der Weg zum Kunden: die Akte des Agenten, nicht die Verwaltung. */}
                  {v.ref && (
                    <a href={`/agent/kunden?ref=${encodeURIComponent(v.ref)}`}
                      className="inline-flex items-center gap-1 mt-2 text-[12px] font-semibold"
                      style={{ color: ACCENT }}>
                      Kunde öffnen →
                    </a>
                  )}
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>

      {!laedt && reiter === "offen" && aufgabenOffen.length > 0 && (
        <p className="mt-4 text-[11px] text-slate-400 leading-relaxed">
          Nur du kannst deine Aufgaben abhaken. Die Verwaltung sieht sofort, was erledigt ist —
          eine Rückmeldung per Nachricht ist nicht nötig.
        </p>
      )}
    </div>
  );
}
