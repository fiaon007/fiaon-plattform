import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, StickyNote, ListChecks, Lock, Users, UserCheck, CalendarClock } from "lucide-react";
import { ACCENT } from "./AdminShell";

// ═══════════════════════════════════════════════════════════════════════════
// Vermerk anlegen — Notiz oder Aufgabe an einer Person
//
// Zwei Entscheidungen trifft man hier, und beide müssen ohne Nachdenken
// verständlich sein:
//
//  1. WAS ist es?      Notiz = Information. Aufgabe = etwas ist zu tun, dann
//                      erscheinen Frist und Zuständigkeit.
//  2. WER darf es sehen?  Nur ich · das ganze Team · bestimmte Personen.
//
// Die Sichtbarkeit ist bewusst der zweite Schritt und nicht in einem Menü
// versteckt: Ein Vermerk, bei dem man sich über die Sichtbarkeit irrt, ist der
// Unterschied zwischen einer internen Einschätzung und einer Beleidigung im
// Team-Kanal. Deshalb steht unter der Auswahl immer ein Satz in Klartext, WER
// diesen Vermerk am Ende sieht.
//
// Frist ist optional. Eine Pflicht-Frist erzeugt Fantasiedaten, die niemand
// ernst nimmt. Stattdessen: zwei Schnellwahlen (heute, morgen) plus Datumsfeld.
// ═══════════════════════════════════════════════════════════════════════════

export interface VermerkZiel {
  /** Antragsreferenz — der Normalfall. */
  ref?: string | null;
  /** Lead-Bezug, falls noch kein Antrag existiert. */
  leadId?: number | null;
  /** Anzeigename für den Kopf des Dialogs. */
  name?: string | null;
}

export interface AgentWahl { id: number; name: string }

type Art = "notiz" | "aufgabe";
type Sicht = "privat" | "team" | "auswahl";

function heuteIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}
function plusTage(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function tagText(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
}

const CSS = `
.vd-hinter{
  position:fixed; inset:0; z-index:110; background:rgba(7,11,22,.6);
  -webkit-backdrop-filter:blur(7px); backdrop-filter:blur(7px);
  animation:vdAuf 220ms cubic-bezier(.32,.72,0,1) both;
}
.vd-fenster{
  position:relative; width:100%; max-width:520px; max-height:92vh; overflow-y:auto;
  border-radius:22px; padding:18px;
  background:linear-gradient(180deg, rgba(255,255,255,.98), rgba(250,252,255,.98));
  border:1px solid rgba(255,255,255,.7);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.9), 0 40px 90px -20px rgba(13,26,63,.6);
  animation:vdHoch 340ms cubic-bezier(.32,.72,0,1) both;
}
@keyframes vdAuf{from{opacity:0}to{opacity:1}}
@keyframes vdHoch{from{opacity:0; transform:translateY(16px) scale(.98)}to{opacity:1; transform:none}}
@media (max-width:640px){
  .vd-huelle{ align-items:flex-end !important; padding:0 !important; }
  .vd-fenster{ max-width:none; border-radius:22px 22px 0 0; }
}

/* Auswahlkarten: die getroffene Wahl liegt sichtbar OBEN (weiß + Akzentkante),
   die anderen liegen flach. Ein Radiobutton würde hier dieselbe Information
   tragen, aber nicht dieselbe Sicherheit geben. */
.vd-wahl{
  flex:1; min-width:0; padding:9px 10px; border-radius:12px; text-align:left;
  border:1px solid var(--a3-linie,#e4e9f2); background:#fff;
  transition:all 180ms cubic-bezier(.32,.72,0,1);
}
.vd-wahl:hover{ border-color:#cdd8ea; }
.vd-wahl[data-an="1"]{
  border-color:#1d4ed8; background:linear-gradient(180deg,#fff,#f5f8ff);
  box-shadow:0 2px 10px -4px rgba(29,78,216,.45), inset 0 1px 0 #fff;
}
.vd-wahl-titel{ display:flex; align-items:center; gap:6px; font-size:12.5px; font-weight:700; color:#0f172a; }
.vd-wahl-text{ display:block; font-size:10.5px; line-height:1.35; color:#64748b; margin-top:2px; }

@media (prefers-reduced-motion: reduce){ .vd-hinter,.vd-fenster{ animation:none !important } }
`;

export default function VermerkDialog({ ziel, agenten, onAbbrechen, onFertig }: {
  ziel: VermerkZiel;
  /** Aktive Mitarbeiter zur Auswahl (Zuständigkeit + Sichtbarkeit). */
  agenten: AgentWahl[];
  onAbbrechen: () => void;
  onFertig: (meldung: string) => void;
}) {
  const [art, setArt] = useState<Art>("notiz");
  const [inhalt, setInhalt] = useState("");
  const [sicht, setSicht] = useState<Sicht>("privat");
  const [auswahl, setAuswahl] = useState<number[]>([]);
  const [zustaendig, setZustaendig] = useState<number | null>(null);
  const [frist, setFrist] = useState("");
  const [dringend, setDringend] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const feld = useRef<HTMLTextAreaElement>(null);
  const heute = heuteIso();

  useEffect(() => {
    const taste = (e: KeyboardEvent) => { if (e.key === "Escape") onAbbrechen(); };
    document.addEventListener("keydown", taste);
    const vorher = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setTimeout(() => feld.current?.focus(), 120);
    return () => { document.removeEventListener("keydown", taste); document.body.style.overflow = vorher; };
  }, [onAbbrechen]);

  // Weist man eine Aufgabe zu, muss der Zuständige sie sehen können. Statt den
  // Vorgesetzter darauf hinzuweisen, wird die Sichtbarkeit einfach mitgezogen.
  useEffect(() => {
    if (art === "aufgabe" && zustaendig && sicht === "auswahl" && !auswahl.includes(zustaendig)) {
      setAuswahl((a) => [...a, zustaendig]);
    }
  }, [art, zustaendig, sicht, auswahl]);

  /** Der Satz, der in Klartext sagt, wer das am Ende liest. */
  const sichtSatz = useMemo(() => {
    const zustName = agenten.find((a) => a.id === zustaendig)?.name;
    if (sicht === "privat") {
      return art === "aufgabe" && zustaendig
        ? `Nur du und ${zustName} — der Zuständige sieht seine Aufgabe immer.`
        : "Nur du. Kein Mitarbeiter sieht diesen Vermerk.";
    }
    if (sicht === "team") return "Du und alle aktiven Mitarbeiter.";
    const namen = auswahl.map((id) => agenten.find((a) => a.id === id)?.name).filter(Boolean);
    return namen.length ? `Du und: ${namen.join(", ")}.` : "Bitte unten mindestens eine Person auswählen.";
  }, [sicht, auswahl, agenten, art, zustaendig]);

  const speichern = async () => {
    if (inhalt.trim().length < 2) { setFehler("Bitte einen Text eingeben."); return; }
    if (sicht === "auswahl" && auswahl.length === 0) { setFehler("Bitte mindestens eine Person auswählen."); return; }
    setBusy(true);
    setFehler(null);
    try {
      const res = await fetch("/api/fiaon/admin/vermerke", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({
          art, ref: ziel.ref || null, leadId: ziel.leadId || null,
          text: inhalt.trim(), sicht, sichtAgenten: auswahl,
          zustaendigAgentId: art === "aufgabe" ? zustaendig : null,
          faelligAm: art === "aufgabe" ? frist : null,
          dringend: art === "aufgabe" ? dringend : false,
        }),
      });
      const j = await res.json().catch(() => null);
      if (res.ok && j?.ok) {
        const wer = art === "aufgabe"
          ? (zustaendig ? `Aufgabe an ${agenten.find((a) => a.id === zustaendig)?.name} vergeben` : "Aufgabe für dich angelegt")
          : "Notiz gespeichert";
        onFertig(`${wer}${frist && art === "aufgabe" ? ` — Frist ${tagText(frist)}` : ""}.`);
      } else setFehler(j?.error || `Fehler ${res.status}`);
    } catch {
      setFehler("Keine Verbindung zum Server.");
    } finally { setBusy(false); }
  };

  return createPortal(
    <>
      <style>{CSS}</style>
      <div className="vd-hinter" onClick={onAbbrechen} />
      <div className="vd-huelle fixed inset-0 z-[111] flex items-center justify-center p-4 pointer-events-none">
        <div className="vd-fenster pointer-events-auto" role="dialog" aria-modal="true" aria-label="Vermerk anlegen">
          <div className="flex items-start gap-3 mb-3">
            <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "var(--fi-flaeche-akzent,#f1f5ff)", color: ACCENT }}>
              {art === "aufgabe" ? <ListChecks size={17} /> : <StickyNote size={17} />}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-[15px] font-bold text-slate-900">
                {art === "aufgabe" ? "Aufgabe anlegen" : "Notiz anlegen"}
              </h3>
              <p className="text-[12px] text-slate-500 truncate">
                {ziel.name || ziel.ref || "Allgemein — ohne Kundenbezug"}
              </p>
            </div>
            <button type="button" onClick={onAbbrechen}
              className="shrink-0 w-8 h-8 rounded-lg border bg-white flex items-center justify-center text-slate-400 hover:text-slate-700"
              style={{ borderColor: "var(--a3-linie,#e4e9f2)" }} aria-label="Abbrechen">
              <X size={15} />
            </button>
          </div>

          {/* 1. Art */}
          <div className="flex gap-2 mb-3">
            <button type="button" className="vd-wahl" data-an={art === "notiz" ? "1" : undefined} onClick={() => setArt("notiz")}>
              <span className="vd-wahl-titel"><StickyNote size={13} /> Notiz</span>
              <span className="vd-wahl-text">Information zur Person. Kein Zustand, keine Frist.</span>
            </button>
            <button type="button" className="vd-wahl" data-an={art === "aufgabe" ? "1" : undefined} onClick={() => setArt("aufgabe")}>
              <span className="vd-wahl-titel"><ListChecks size={13} /> Aufgabe</span>
              <span className="vd-wahl-text">Etwas ist zu tun — mit Frist und Zuständigem.</span>
            </button>
          </div>

          {/* 2. Text */}
          <textarea
            ref={feld}
            value={inhalt}
            onChange={(e) => setInhalt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void speichern(); }}
            rows={3}
            placeholder={art === "aufgabe" ? "Was ist zu tun?" : "Was soll man über diese Person wissen?"}
            className="w-full resize-y rounded-xl border px-3.5 py-2.5 text-[13.5px] outline-none bg-white"
            style={{ borderColor: "var(--a3-linie,#e4e9f2)" }}
          />

          {/* 3. Aufgaben-Felder */}
          {art === "aufgabe" && (
            <>
              <p className="mt-3 mb-1 text-[11.5px] font-semibold text-slate-700">Wer erledigt das?</p>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" className="a3-knopf inline-flex" data-haupt={zustaendig === null ? "1" : undefined}
                  onClick={() => setZustaendig(null)}>
                  Ich selbst
                </button>
                {agenten.map((a) => (
                  <button key={a.id} type="button" className="a3-knopf inline-flex"
                    data-haupt={zustaendig === a.id ? "1" : undefined}
                    onClick={() => setZustaendig(a.id)}>
                    {a.name}
                  </button>
                ))}
              </div>
              {zustaendig !== null && (
                <p className="mt-1.5 text-[11px] text-slate-500">
                  {agenten.find((a) => a.id === zustaendig)?.name} bekommt die Aufgabe im Portal unter „Aufgaben“ und
                  wird per E-Mail benachrichtigt.
                </p>
              )}

              <p className="mt-3 mb-1 text-[11.5px] font-semibold text-slate-700">
                Bis wann? <span className="font-normal text-slate-400">optional</span>
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <button type="button" className="a3-knopf inline-flex" data-haupt={frist === heute ? "1" : undefined}
                  onClick={() => setFrist(frist === heute ? "" : heute)}>
                  Heute
                </button>
                <button type="button" className="a3-knopf inline-flex" data-haupt={frist === plusTage(heute, 1) ? "1" : undefined}
                  onClick={() => setFrist(frist === plusTage(heute, 1) ? "" : plusTage(heute, 1))}>
                  Morgen
                </button>
                <button type="button" className="a3-knopf inline-flex" data-haupt={frist === plusTage(heute, 7) ? "1" : undefined}
                  onClick={() => setFrist(frist === plusTage(heute, 7) ? "" : plusTage(heute, 7))}>
                  In 7 Tagen
                </button>
                <input type="date" value={frist} min={heute} onChange={(e) => setFrist(e.target.value)}
                  className="h-[32px] px-2.5 rounded-lg border bg-white text-[12.5px] outline-none"
                  style={{ borderColor: "var(--a3-linie,#e4e9f2)" }} />
                {frist && (
                  <button type="button" className="a3-knopf inline-flex" onClick={() => setFrist("")}>ohne Frist</button>
                )}
              </div>

              <label className="mt-2.5 flex items-center gap-2 text-[12.5px] text-slate-700 cursor-pointer">
                <input type="checkbox" checked={dringend} onChange={(e) => setDringend(e.target.checked)}
                  className="accent-blue-600 w-4 h-4" />
                Dringend — wird oben hervorgehoben
              </label>
            </>
          )}

          {/* 4. Sichtbarkeit */}
          <p className="mt-3.5 mb-1 text-[11.5px] font-semibold text-slate-700">Wer darf das sehen?</p>
          <div className="flex gap-2">
            <button type="button" className="vd-wahl" data-an={sicht === "privat" ? "1" : undefined} onClick={() => setSicht("privat")}>
              <span className="vd-wahl-titel"><Lock size={12} /> Nur ich</span>
              <span className="vd-wahl-text">Bleibt in der Verwaltung.</span>
            </button>
            <button type="button" className="vd-wahl" data-an={sicht === "team" ? "1" : undefined} onClick={() => setSicht("team")}>
              <span className="vd-wahl-titel"><Users size={12} /> Ganzes Team</span>
              <span className="vd-wahl-text">Alle Mitarbeiter sehen es.</span>
            </button>
            <button type="button" className="vd-wahl" data-an={sicht === "auswahl" ? "1" : undefined} onClick={() => setSicht("auswahl")}>
              <span className="vd-wahl-titel"><UserCheck size={12} /> Bestimmte</span>
              <span className="vd-wahl-text">Nur ausgewählte Personen.</span>
            </button>
          </div>

          {sicht === "auswahl" && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {agenten.map((a) => {
                const an = auswahl.includes(a.id);
                return (
                  <button key={a.id} type="button" className="a3-knopf inline-flex" data-haupt={an ? "1" : undefined}
                    onClick={() => setAuswahl((v) => an ? v.filter((x) => x !== a.id) : [...v, a.id])}>
                    {a.name}
                  </button>
                );
              })}
              {agenten.length === 0 && <p className="text-[12px] text-slate-400">Keine aktiven Mitarbeiter vorhanden.</p>}
            </div>
          )}

          {/* Klartext-Satz: die einzige Absicherung gegen eine falsche Sichtbarkeit. */}
          <p className="mt-2 text-[11.5px] leading-snug px-2.5 py-2 rounded-lg"
            style={{ background: "rgba(29,78,216,.05)", color: "#1e40af" }}>
            {sichtSatz}
          </p>

          {fehler && <p className="mt-2 text-[12px] font-semibold text-red-600">{fehler}</p>}

          <div className="flex items-center gap-2 mt-4">
            <button type="button" onClick={() => void speichern()} disabled={busy}
              className="flex-1 h-[42px] rounded-xl text-[13px] font-bold text-white disabled:opacity-50 inline-flex items-center justify-center gap-2"
              style={{ background: `linear-gradient(180deg,${ACCENT},#1e40af)`, boxShadow: "0 4px 14px -6px rgba(29,78,216,.7)" }}>
              {art === "aufgabe" ? <CalendarClock size={15} /> : <StickyNote size={15} />}
              {busy ? "Speichere …" : art === "aufgabe" ? "Aufgabe anlegen" : "Notiz speichern"}
            </button>
            <button type="button" onClick={onAbbrechen} disabled={busy}
              className="h-[42px] px-4 rounded-xl border bg-white text-[13px] font-semibold text-slate-600"
              style={{ borderColor: "var(--a3-linie,#e4e9f2)" }}>
              Abbrechen
            </button>
          </div>
          <p className="mt-2 text-[10.5px] text-slate-400">⌘/Strg + Enter speichert · ESC schließt</p>
        </div>
      </div>
    </>,
    document.body,
  );
}
