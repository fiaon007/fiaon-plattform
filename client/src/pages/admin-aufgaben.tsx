import { useCallback, useEffect, useMemo, useState } from "react";
import { ListChecks, StickyNote, Plus, Check, Undo2, Trash2, Lock, Users, UserCheck, AlertTriangle, ChevronRight } from "lucide-react";
import { ACCENT } from "@/components/admin/AdminShell";
import { PageIntro, Tip } from "@/components/admin/PageHelp";
import VermerkDialog, { type AgentWahl } from "@/components/admin/VermerkDialog";
import type { Vermerk } from "@/components/admin/VermerkTafel";

// ═══════════════════════════════════════════════════════════════════════════
// /admin/aufgaben — alle Notizen und Aufgaben an einem Ort
//
// Die Tafel in der Kundenakte beantwortet „was ist an DIESER Person offen?".
// Diese Seite beantwortet die andere Hälfte: „was ist überhaupt offen — bei
// mir und beim Team?". Ohne sie lebt jede Aufgabe nur in ihrer Akte, und man
// muss sich erinnern, welche Akte das war.
//
// Reihenfolge: überfällig, heute, dringend, ohne Frist, später. Nach Anlage-
// datum zu sortieren wäre einfacher zu bauen und im Alltag nutzlos.
// ═══════════════════════════════════════════════════════════════════════════

const SICHT: Record<string, { icon: typeof Lock; text: string }> = {
  privat: { icon: Lock, text: "nur Verwaltung" },
  team: { icon: Users, text: "ganzes Team" },
  auswahl: { icon: UserCheck, text: "bestimmte Personen" },
};

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
function rang(v: Vermerk): number {
  if (v.status === "erledigt") return 9;
  if (v.ueberfaellig) return 0;
  if (v.heuteFaellig) return 1;
  if (v.dringend) return 2;
  if (!v.faelligAm) return 4;
  return 3;
}

type Reiter = "meine" | "team" | "notizen" | "erledigt";

export default function AdminAufgabenPage() {
  const [liste, setListe] = useState<Vermerk[]>([]);
  const [agenten, setAgenten] = useState<AgentWahl[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [reiter, setReiter] = useState<Reiter>("meine");
  const [dialog, setDialog] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const sagen = (t: string) => { setMeldung(t); setTimeout(() => setMeldung(null), 6000); };

  const laden = useCallback(async () => {
    setLaedt(true);
    try {
      const j = await fetch("/api/fiaon/admin/vermerke?limit=300", { credentials: "include" })
        .then((r) => r.json()).catch(() => null);
      setListe(j?.ok ? j.vermerke : []);
    } finally { setLaedt(false); }
  }, []);

  useEffect(() => { void laden(); }, [laden]);
  useEffect(() => {
    fetch("/api/fiaon/admin/agents", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setAgenten((j?.ok ? j.data : []).filter((a: any) => a.active !== false && !a.is_test_account)
        .map((a: any) => ({ id: Number(a.id), name: a.name }))))
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
    if (!confirm(`Zurückziehen?\n\n„${v.text.slice(0, 140)}“\n\nDer Eintrag verschwindet aus der Ansicht, bleibt aber nachvollziehbar.`)) return;
    await fetch(`/api/fiaon/admin/vermerke/${v.id}`, { method: "DELETE", credentials: "include" });
    sagen("Eintrag zurückgezogen.");
    void laden();
  };

  const gefiltert = useMemo(() => {
    const s = filter.trim().toLowerCase();
    const passt = (v: Vermerk) => !s || v.text.toLowerCase().includes(s)
      || (v.kunde || "").toLowerCase().includes(s) || (v.zustaendigName || "").toLowerCase().includes(s);
    return liste.filter(passt);
  }, [liste, filter]);

  const meine = gefiltert.filter((v) => v.art === "aufgabe" && v.status === "offen" && v.fuerBetreiber).sort((a, b) => rang(a) - rang(b));
  const team = gefiltert.filter((v) => v.art === "aufgabe" && v.status === "offen" && !v.fuerBetreiber).sort((a, b) => rang(a) - rang(b));
  const notizen = gefiltert.filter((v) => v.art === "notiz").sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const erledigt = gefiltert.filter((v) => v.art === "aufgabe" && v.status === "erledigt")
    .sort((a, b) => +new Date(b.erledigtAm || 0) - +new Date(a.erledigtAm || 0));

  const sichtbar = reiter === "meine" ? meine : reiter === "team" ? team : reiter === "notizen" ? notizen : erledigt;
  const ueberfaellig = [...meine, ...team].filter((v) => v.ueberfaellig).length;

  const Zeile = ({ v }: { v: Vermerk }) => {
    const S = SICHT[v.sicht] || SICHT.privat;
    const kante = v.status === "erledigt" ? "transparent"
      : v.ueberfaellig ? "#dc2626" : v.dringend ? "#d97706"
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
            {v.kunde && v.akte && (
              <a href={v.akte} className="font-semibold" style={{ color: ACCENT }}>{v.kunde}</a>
            )}
            {v.art === "aufgabe" && (
              <span className="font-semibold" style={{ color: v.ueberfaellig ? "#dc2626" : v.heuteFaellig ? ACCENT : undefined }}>
                · {v.faelligAm
                  ? (v.ueberfaellig ? `überfällig seit ${tag(v.faelligAm)}` : v.heuteFaellig ? "heute fällig" : `bis ${tag(v.faelligAm)}`)
                  : "ohne Frist"}
              </span>
            )}
            {v.art === "aufgabe" && <span>· {v.zustaendigName ? `für ${v.zustaendigName}` : "für mich"}</span>}
            <span className="inline-flex items-center gap-1">· <S.icon size={10} /> {S.text}</span>
            {v.dringend && v.status === "offen" && (
              <span className="inline-flex items-center gap-1 font-bold" style={{ color: "#b45309" }}>
                · <AlertTriangle size={10} /> dringend
              </span>
            )}
            {v.status === "erledigt" && (
              <span className="text-emerald-600 font-semibold">
                · erledigt {v.erledigtVon ? `von ${v.erledigtVon}` : ""} {zeit(v.erledigtAm)}
              </span>
            )}
          </p>
        </div>
        <span className="shrink-0 flex items-center gap-1.5">
          {v.art === "aufgabe" && v.status === "offen" && (
            <button type="button" className="a3-knopf inline-flex" data-haupt="1" onClick={() => void status(v, "erledigt")}>
              <Check size={12} /> erledigt
            </button>
          )}
          {v.art === "aufgabe" && v.status === "erledigt" && (
            <button type="button" className="a3-knopf inline-flex" onClick={() => void status(v, "offen")}>
              <Undo2 size={12} /> öffnen
            </button>
          )}
          {v.akte && <a href={v.akte} className="a3-knopf hidden sm:inline-flex">Akte <ChevronRight size={12} /></a>}
          <button type="button" className="a3-knopf inline-flex" title="Zurückziehen" onClick={() => void entfernen(v)}>
            <Trash2 size={12} />
          </button>
        </span>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-end justify-between gap-4 mb-4">
        <div className="min-w-0">
          <h1 className="text-[22px] sm:text-[26px] font-bold text-slate-900 tracking-[-.02em]">Notizen &amp; Aufgaben</h1>
          <p className="text-[12.5px] text-slate-500 mt-0.5">
            Alles, was an Personen festgehalten oder zugewiesen wurde — mit Frist und Sichtbarkeit
          </p>
        </div>
        <button type="button" onClick={() => setDialog(true)} className="a3-knopf inline-flex shrink-0" data-haupt="1">
          <Plus size={13} /> Neu
        </button>
      </div>

      {meldung && (
        <div className="mb-4 px-4 py-3 rounded-xl text-[13px] font-semibold"
          style={{ background: "rgba(29,78,216,.05)", border: "1px solid rgba(29,78,216,.2)", color: "#1e40af" }}>
          {meldung}
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-3 mb-4">
        {[
          { label: "Meine offenen Aufgaben", wert: meine.length, ton: undefined,
            hilfe: "Aufgaben, die du selbst erledigen musst — nicht an einen Mitarbeiter vergeben." },
          { label: "Überfällig", wert: ueberfaellig, ton: ueberfaellig > 0 ? ("warnung" as const) : undefined,
            hilfe: "Frist verstrichen, noch offen — eigene und vergebene zusammen." },
          { label: "An Team vergeben", wert: team.length, ton: undefined,
            hilfe: "Offene Aufgaben bei Mitarbeitern. Sie erledigen sie in ihrem Portal unter „Aufgaben“; der Stand hier ist derselbe." },
          { label: "Notizen", wert: notizen.length, ton: undefined,
            hilfe: "Reine Informationen ohne Zustand — nach Sichtbarkeit gefiltert genau die, die du angelegt oder freigegeben hast." },
        ].map((k, i) => (
          <div key={k.label} className="a3-kachel a3-auf p-4 pl-[18px]" data-ton={k.ton} style={{ ["--i" as any]: i }}>
            <div className="flex items-start gap-1.5">
              <span className="flex-1 min-w-0 text-[10px] font-semibold uppercase tracking-[.07em] text-slate-500 leading-tight">{k.label}</span>
              <span className="shrink-0"><Tip text={k.hilfe} /></span>
            </div>
            <span className="block mt-2 text-[22px] font-bold text-slate-900 a3-zahl leading-none">{k.wert}</span>
          </div>
        ))}
      </div>

      <section className="a3-tafel">
        <header className="a3-tafel-kopf flex-wrap">
          <span className="a3-reiter">
            {([
              { k: "meine" as Reiter, l: `Meine (${meine.length})` },
              { k: "team" as Reiter, l: `Team (${team.length})` },
              { k: "notizen" as Reiter, l: `Notizen (${notizen.length})` },
              { k: "erledigt" as Reiter, l: "Erledigt" },
            ]).map((r) => (
              <button key={r.k} type="button" data-an={reiter === r.k ? "1" : undefined} onClick={() => setReiter(r.k)}>
                {r.l}
              </button>
            ))}
          </span>
          <input value={filter} onChange={(e) => setFilter(e.target.value)}
            placeholder="Text, Kunde oder Mitarbeiter …"
            className="ml-auto h-[32px] px-3 rounded-lg border bg-white text-[12.5px] outline-none w-[170px] sm:w-[220px]"
            style={{ borderColor: "var(--a3-linie,#e4e9f2)" }} />
        </header>

        {laedt && <p className="px-4 py-6 text-[13px] text-slate-400">Wird geladen …</p>}
        {!laedt && sichtbar.length === 0 && (
          <div className="px-4 py-10 text-center">
            <p className="text-[13.5px] font-bold text-slate-800">
              {reiter === "meine" ? "Nichts offen." : reiter === "team" ? "Beim Team ist nichts offen." : reiter === "notizen" ? "Keine Notizen." : "Noch nichts erledigt."}
            </p>
            <p className="text-[12.5px] text-slate-500 mt-1">
              Notizen und Aufgaben legst du direkt an der Person an — in der Kundenakte, in der Zahlungszentrale
              oder aus jeder Namensliste heraus.
            </p>
          </div>
        )}
        {sichtbar.map((v) => <Zeile key={v.id} v={v} />)}
      </section>

      {dialog && (
        <VermerkDialog
          ziel={{ name: "Allgemein — ohne Kundenbezug" }}
          agenten={agenten}
          onAbbrechen={() => setDialog(false)}
          onFertig={(m) => { setDialog(false); sagen(m); void laden(); }}
        />
      )}

      <PageIntro
        id="aufgaben"
        title="So arbeitest du hier"
        subtitle="Notiz für Wissen, Aufgabe für etwas, das jemand tun muss."
        steps={[
          "Eine Notiz hält Wissen über eine Person fest — sie hat keinen Zustand und wird nie „erledigt“.",
          "Eine Aufgabe hat einen Zuständigen und optional eine Frist. Zuständig bist entweder du selbst oder ein Mitarbeiter.",
          "Sichtbarkeit entscheidet, wer den Eintrag liest: nur du, das ganze Team oder ausgewählte Personen. Unter der Auswahl steht immer in Klartext, wer es am Ende sieht.",
          "Weist du einem Mitarbeiter eine Aufgabe zu, sieht er sie in seinem Portal unter „Aufgaben“ und bekommt eine E-Mail — bei einer Frist von morgen ist das der Unterschied zwischen erledigt und vergessen.",
          "Angelegt wird am schnellsten dort, wo du gerade bist: in der Kundenakte, im Detail einer Zahlung oder aus jeder Namensliste über „Vermerk“.",
          "Zurückziehen löscht nichts — der Eintrag verschwindet aus der Ansicht und bleibt in der Datenbank nachvollziehbar.",
        ]}
      />
    </div>
  );
}
