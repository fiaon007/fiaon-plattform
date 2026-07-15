import { useState, useEffect } from "react";
import { History } from "lucide-react";
import { PageIntro } from "@/components/admin/PageHelp";

// ═══════════════════════════════════════════════════════════════════
// /admin/changelog — „Was ist neu?" (Phase 4, P4-F).
// Gespeist aus CHANGELOG.md (eine Quelle, im Repo gepflegt — jede Änderung
// bekommt dort einen Eintrag im selben Commit). Diese Seite parst die
// Markdown-Struktur in Klartext-Karten: Datum · Was · Warum · Wo.
// ═══════════════════════════════════════════════════════════════════

interface Entry {
  title: string;
  body: string[];
}

/** Parst CHANGELOG.md: jede "## "-Überschrift = ein Eintrag. */
function parseChangelog(md: string): Entry[] {
  const entries: Entry[] = [];
  let current: Entry | null = null;
  for (const raw of md.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (line.startsWith("## ")) {
      if (current) entries.push(current);
      current = { title: line.slice(3).trim(), body: [] };
    } else if (current && line.trim() !== "" && !line.startsWith("# ") && line.trim() !== "---") {
      current.body.push(line);
    }
  }
  if (current) entries.push(current);
  return entries;
}

/** Sehr leichtes Inline-Markdown: **fett**, `code`, - Listen. Kein HTML-Inject. */
function Line({ text }: { text: string }) {
  const isBullet = /^\s*-\s+/.test(text);
  const clean = text.replace(/^\s*-\s+/, "");
  const parts = clean.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  const rendered = parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <b key={i} className="text-slate-800">{p.slice(2, -2)}</b>;
    if (p.startsWith("`") && p.endsWith("`")) return <code key={i} className="px-1 py-0.5 rounded bg-slate-100 text-[11.5px] font-mono text-slate-700">{p.slice(1, -1)}</code>;
    return <span key={i}>{p}</span>;
  });
  if (isBullet) {
    return (
      <li className="flex gap-2 text-[13px] text-slate-600 leading-relaxed">
        <span className="shrink-0 w-1 h-1 rounded-full bg-slate-300 mt-2" />
        <span>{rendered}</span>
      </li>
    );
  }
  return <p className="text-[13px] text-slate-600 leading-relaxed">{rendered}</p>;
}

export default function AdminChangelogPage() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/fiaon/admin/changelog", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok && j.content) setEntries(parseChangelog(j.content));
        else setError("Das Änderungsprotokoll (CHANGELOG.md) wurde nicht gefunden. Es liegt im Projekt-Stammverzeichnis — nach dem nächsten Deploy erscheint es hier automatisch.");
      })
      .catch(() => setError("Verbindung fehlgeschlagen — bitte Seite neu laden."));
  }, []);

  return (
    <div className="px-4 sm:px-6 py-5 max-w-3xl mx-auto">
      <PageIntro
        id="changelog"
        title="Was ist neu?"
        subtitle="Hier liest du jede Änderung am System in Klartext — Datum, was geändert wurde, warum, und wo du es findest."
        steps={[
          "Neueste Änderungen stehen oben. Jede Karte ist ein Update-Paket mit Datum.",
          "„Wo\" nennt immer die Seite in der Verwaltung, auf der du die Änderung siehst.",
          "Die Liste wird bei jeder System-Änderung im selben Zug gepflegt — sie ist damit vollständig.",
        ]}
      />

      {error && (
        <div className="px-4 py-3 rounded-xl border border-amber-300 bg-amber-50 text-[13px] text-amber-800">{error}</div>
      )}
      {!entries && !error && <p className="text-[13px] text-slate-400">Lädt…</p>}

      <div className="space-y-4">
        {entries?.map((e, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-start gap-3 mb-2.5">
              <span className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                <History size={14} />
              </span>
              <p className="text-[14px] font-bold text-slate-900 leading-snug">{e.title}</p>
            </div>
            <ul className="space-y-1.5">
              {e.body.map((l, j) => <Line key={j} text={l} />)}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
