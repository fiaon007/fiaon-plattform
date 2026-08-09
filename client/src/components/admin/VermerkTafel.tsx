import { useCallback, useEffect, useState } from "react";
import { StickyNote, ListChecks, Plus, Check, Undo2, Trash2, Lock, Users, UserCheck, AlertTriangle } from "lucide-react";
import { ACCENT } from "./AdminShell";
import VermerkDialog, { type AgentWahl, type VermerkZiel } from "./VermerkDialog";

// ═══════════════════════════════════════════════════════════════════════════
// Vermerke einer Person — Notizen und Aufgaben in EINEM Strom
//
// Warum ein Strom und nicht zwei Listen: Wer eine Akte öffnet, will wissen
// „was ist hier los?" — und nicht erst zwei Kästen vergleichen. Offene
// Aufgaben stehen oben (nach Frist), Notizen und Erledigtes darunter.
//
// Die Tafel steckt an drei Stellen im gleichen Zustand: in der Kundenakte, im
// Detailfenster der Kennzahlen und in der Zahlungszentrale. Deshalb ist sie
// eine Komponente und keine dreifach kopierte Ansicht.
// ═══════════════════════════════════════════════════════════════════════════

export interface Vermerk {
  id: number;
  art: "notiz" | "aufgabe";
  ref: string | null;
  kunde: string | null;
  akte: string | null;
  text: string;
  sicht: "privat" | "team" | "auswahl";
  sichtAgenten: number[];
  zustaendigAgentId: number | null;
  zustaendigName: string | null;
  fuerBetreiber: boolean;
  faelligAm: string | null;
  ueberfaellig: boolean;
  heuteFaellig: boolean;
  dringend: boolean;
  status: "offen" | "erledigt";
  erledigtAm: string | null;
  erledigtVon: string | null;
  autorName: string;
  createdAt: string;
}

function tagText(iso: string | null): string {
  if (!iso) return "";
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
function zeitText(v: string | null): string {
  if (!v) return "";
  return new Date(v).toLocaleString("de-DE", {
    timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

const SICHT_ZEICHEN: Record<string, { icon: typeof Lock; text: string }> = {
  privat: { icon: Lock, text: "nur Verwaltung" },
  team: { icon: Users, text: "ganzes Team" },
  auswahl: { icon: UserCheck, text: "bestimmte Personen" },
};

/** Eine Zeile. Bewusst flach: Titel, Zustand, Frist, Sichtbarkeit, Handlungen. */
function Zeile({ v, onStatus, onEntfernen }: {
  v: Vermerk; onStatus: (v: Vermerk, status: "offen" | "erledigt") => void; onEntfernen: (v: Vermerk) => void;
}) {
  const S = SICHT_ZEICHEN[v.sicht] || SICHT_ZEICHEN.privat;
  const kante = v.status === "erledigt" ? "transparent"
    : v.ueberfaellig ? "#dc2626"
    : v.dringend ? "#d97706"
    : v.art === "aufgabe" ? "#1d4ed8" : "transparent";
  return (
    <div className="px-4 py-3 flex items-start gap-3"
      style={{ boxShadow: "inset 0 -1px 0 rgba(226,232,240,.8)", borderLeft: `3px solid ${kante}` }}>
      <span className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-[1px]"
        style={{
          background: v.status === "erledigt" ? "#f1f5f9" : "var(--fi-flaeche-akzent,#f1f5ff)",
          color: v.status === "erledigt" ? "#94a3b8" : ACCENT,
        }}>
        {v.art === "aufgabe" ? <ListChecks size={14} /> : <StickyNote size={14} />}
      </span>

      <div className="min-w-0 flex-1">
        <p className={`text-[13.5px] leading-snug ${v.status === "erledigt" ? "text-slate-400 line-through" : "text-slate-900 font-medium"}`}>
          {v.text}
        </p>
        <p className="text-[11px] text-slate-400 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {v.art === "aufgabe" && (
            <span className="font-semibold" style={{ color: v.ueberfaellig ? "#dc2626" : v.heuteFaellig ? ACCENT : undefined }}>
              {v.faelligAm
                ? `${v.ueberfaellig ? "überfällig seit" : v.heuteFaellig ? "heute fällig" : "fällig"} ${v.heuteFaellig ? "" : tagText(v.faelligAm)}`
                : "ohne Frist"}
            </span>
          )}
          {v.art === "aufgabe" && (
            <span>· {v.zustaendigName ? `für ${v.zustaendigName}` : "für die Verwaltung"}</span>
          )}
          <span className="inline-flex items-center gap-1">· <S.icon size={10} /> {S.text}</span>
          <span>· {v.autorName}, {zeitText(v.createdAt)}</span>
          {v.status === "erledigt" && (
            <span className="text-emerald-600 font-semibold">
              · erledigt {v.erledigtVon ? `von ${v.erledigtVon}` : ""} {zeitText(v.erledigtAm)}
            </span>
          )}
          {v.dringend && v.status === "offen" && (
            <span className="inline-flex items-center gap-1 font-bold" style={{ color: "#b45309" }}>
              · <AlertTriangle size={10} /> dringend
            </span>
          )}
        </p>
      </div>

      <span className="shrink-0 flex items-center gap-1.5">
        {v.art === "aufgabe" && v.status === "offen" && (
          <button type="button" className="a3-knopf inline-flex" data-haupt="1" onClick={() => onStatus(v, "erledigt")}>
            <Check size={12} /> erledigt
          </button>
        )}
        {v.art === "aufgabe" && v.status === "erledigt" && (
          <button type="button" className="a3-knopf inline-flex" onClick={() => onStatus(v, "offen")}>
            <Undo2 size={12} /> öffnen
          </button>
        )}
        <button type="button" className="a3-knopf inline-flex" title="Zurückziehen (nichts wird gelöscht)"
          onClick={() => onEntfernen(v)}>
          <Trash2 size={12} />
        </button>
      </span>
    </div>
  );
}

export default function VermerkTafel({ ziel, kompakt, onMeldung }: {
  ziel: VermerkZiel;
  /** kompakt = eingebettet in ein Fenster/Drawer: kleinere Kopfzeile, keine Tafel-Rahmen. */
  kompakt?: boolean;
  onMeldung?: (t: string) => void;
}) {
  const [liste, setListe] = useState<Vermerk[]>([]);
  const [agenten, setAgenten] = useState<AgentWahl[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [dialog, setDialog] = useState(false);
  const [zeigeErledigt, setZeigeErledigt] = useState(false);

  const sagen = (t: string) => (onMeldung ? onMeldung(t) : undefined);

  const laden = useCallback(async () => {
    setLaedt(true);
    try {
      const p = new URLSearchParams();
      if (ziel.ref) p.set("ref", ziel.ref);
      if (ziel.leadId) p.set("lead", String(ziel.leadId));
      const j = await fetch(`/api/fiaon/admin/vermerke?${p.toString()}`, { credentials: "include" })
        .then((r) => r.json()).catch(() => null);
      setListe(j?.ok ? j.vermerke : []);
    } finally { setLaedt(false); }
  }, [ziel.ref, ziel.leadId]);

  useEffect(() => { void laden(); }, [laden]);

  // Mitarbeiterliste einmal holen — für Zuständigkeit und Sichtbarkeit.
  useEffect(() => {
    fetch("/api/fiaon/admin/agents", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        const roh = j?.ok ? (j.data ?? j.agents ?? []) : [];
        setAgenten(roh.filter((a: any) => a.active !== false && (!a.is_test_account || a.pruefkonto))
          .map((a: any) => ({ id: Number(a.id), name: a.name })));
      })
      .catch(() => setAgenten([]));
  }, []);

  const status = async (v: Vermerk, neu: "offen" | "erledigt") => {
    await fetch(`/api/fiaon/admin/vermerke/${v.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      credentials: "include", body: JSON.stringify({ status: neu }),
    });
    sagen(neu === "erledigt" ? "Aufgabe erledigt." : "Aufgabe wieder offen.");
    void laden();
  };

  const entfernen = async (v: Vermerk) => {
    if (!confirm(`Diesen ${v.art === "aufgabe" ? "Aufgabe" : "Vermerk"} zurückziehen?\n\n„${v.text.slice(0, 120)}“\n\nEr verschwindet aus der Ansicht, bleibt aber in der Datenbank nachvollziehbar.`)) return;
    await fetch(`/api/fiaon/admin/vermerke/${v.id}`, { method: "DELETE", credentials: "include" });
    sagen("Vermerk zurückgezogen.");
    void laden();
  };

  const offene = liste.filter((v) => v.status === "offen");
  const erledigte = liste.filter((v) => v.status === "erledigt");
  const offeneAufgaben = offene.filter((v) => v.art === "aufgabe").length;
  const ueberfaellig = offene.filter((v) => v.ueberfaellig).length;

  const Kopf = (
    <div className={kompakt ? "flex items-center gap-2 px-4 py-2.5" : "a3-tafel-kopf"}
      style={kompakt ? { background: "#fbfcfe", boxShadow: "inset 0 -1px 0 rgba(226,232,240,.8)" } : undefined}>
      {!kompakt && (
        <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "var(--fi-flaeche-akzent,#f1f5ff)", color: ACCENT }}>
          <StickyNote size={14} />
        </span>
      )}
      <h3 className={kompakt ? "text-[12.5px] font-bold text-slate-800" : "text-[14px] font-bold text-slate-900"}>
        Notizen &amp; Aufgaben
      </h3>
      <span className="flex items-center gap-1.5">
        {offeneAufgaben > 0 && (
          <span className="px-1.5 py-0.5 rounded-md text-[10.5px] font-bold"
            style={{ background: "rgba(29,78,216,.08)", color: ACCENT }}>
            {offeneAufgaben} offen
          </span>
        )}
        {ueberfaellig > 0 && (
          <span className="px-1.5 py-0.5 rounded-md text-[10.5px] font-bold"
            style={{ background: "rgba(220,38,38,.08)", color: "#dc2626" }}>
            {ueberfaellig} überfällig
          </span>
        )}
      </span>
      <button type="button" onClick={() => setDialog(true)} className="a3-knopf inline-flex ml-auto shrink-0" data-haupt="1">
        <Plus size={12} /> Neu
      </button>
    </div>
  );

  const Inhalt = (
    <>
      {laedt && <p className="px-4 py-5 text-[13px] text-slate-400">Wird geladen …</p>}
      {!laedt && liste.length === 0 && (
        <div className="px-4 py-6 text-center">
          <p className="text-[13px] text-slate-500">Noch kein Vermerk zu dieser Person.</p>
          <p className="text-[11.5px] text-slate-400 mt-0.5">
            Notiz für Wissen, Aufgabe für etwas, das jemand tun muss — mit Frist und Zuständigem.
          </p>
        </div>
      )}
      {offene.map((v) => <Zeile key={v.id} v={v} onStatus={status} onEntfernen={entfernen} />)}
      {erledigte.length > 0 && (
        <>
          <button type="button" onClick={() => setZeigeErledigt((s) => !s)}
            className="w-full px-4 py-2 text-left text-[11.5px] font-semibold text-slate-400 hover:text-slate-600"
            style={{ boxShadow: "inset 0 -1px 0 rgba(226,232,240,.8)" }}>
            {zeigeErledigt ? "Erledigte ausblenden" : `${erledigte.length} erledigt anzeigen`}
          </button>
          {zeigeErledigt && erledigte.map((v) => <Zeile key={v.id} v={v} onStatus={status} onEntfernen={entfernen} />)}
        </>
      )}
    </>
  );

  return (
    <>
      {kompakt ? (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--a3-linie,#e4e9f2)" }}>
          {Kopf}{Inhalt}
        </div>
      ) : (
        <section className="a3-tafel">{Kopf}{Inhalt}</section>
      )}

      {dialog && (
        <VermerkDialog
          ziel={ziel}
          agenten={agenten}
          onAbbrechen={() => setDialog(false)}
          onFertig={(m) => { setDialog(false); sagen(m); void laden(); }}
        />
      )}
    </>
  );
}
