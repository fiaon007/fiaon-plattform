import { useState, useCallback, useMemo } from "react";
import { X, Upload, ClipboardPaste, ArrowRight, Download, CheckCircle2 } from "lucide-react";

// ════════════════════════════════════════════════════════════════════
// Alt-Lead-Import (Paket BE1/BE2) — Datei (CSV/XLSX) ODER Copy/Paste,
// Spalten-Zuordnung, Vorschau, batchweiser Upload, Ergebnis-Report.
// Parsing passiert im Browser; Server erhält nur gemappte Zeilen in Batches
// (kein Full-File-Load serverseitig). XLSX-Parser wird bei Bedarf lazy vom
// CDN geladen (keine zusätzliche Build-Abhängigkeit).
// ════════════════════════════════════════════════════════════════════

const ACCENT = "#2563eb";
const BATCH = 500;

async function apiF(path: string, init?: RequestInit) {
  const res = await fetch(`/api/fiaon${path}`, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok && json?.ok, json };
}

const TARGETS = [
  { key: "vorname", label: "Vorname" },
  { key: "nachname", label: "Nachname" },
  { key: "email", label: "E-Mail" },
  { key: "telefon", label: "Telefon" },
  { key: "quelle", label: "Quelle" },
  { key: "kampagne", label: "Kampagne" },
  { key: "erstellt_am", label: "Erstellt am" },
] as const;
type TargetKey = (typeof TARGETS)[number]["key"];

const HINTS: Record<TargetKey, string[]> = {
  email: ["email", "e-mail", "mail", "emailadresse", "e mail"],
  telefon: ["telefon", "phone", "mobil", "handy", "tel", "rufnummer", "telefonnummer", "mobile"],
  vorname: ["vorname", "first name", "firstname", "first", "given"],
  nachname: ["nachname", "last name", "lastname", "last", "surname", "familienname"],
  quelle: ["quelle", "source", "herkunft"],
  kampagne: ["kampagne", "campaign", "adset", "ad set", "anzeige"],
  erstellt_am: ["datum", "date", "created", "erstellt", "created_at", "timestamp", "zeitpunkt"],
};

// ── SheetJS lazy vom CDN ─────────────────────────────────────────────
let sheetjsPromise: Promise<any> | null = null;
function loadSheetJS(): Promise<any> {
  const w = window as any;
  if (w.XLSX) return Promise.resolve(w.XLSX);
  if (sheetjsPromise) return sheetjsPromise;
  sheetjsPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
    s.onload = () => resolve((window as any).XLSX);
    s.onerror = () => reject(new Error("XLSX-Bibliothek konnte nicht geladen werden — bitte als CSV speichern."));
    document.head.appendChild(s);
  });
  return sheetjsPromise;
}

// ── Parser ───────────────────────────────────────────────────────────
function detectDelim(sample: string): string {
  const firstLines = sample.split(/\r?\n/).slice(0, 5).join("\n");
  const counts: Record<string, number> = { "\t": 0, ";": 0, ",": 0 };
  for (const ch of firstLines) if (ch in counts) counts[ch]++;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][1] > 0
    ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
    : ",";
}

function parseDelimited(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === delim) { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

function autoMap(headers: string[]): Record<TargetKey, number> {
  const map = {} as Record<TargetKey, number>;
  const used = new Set<number>();
  const norm = headers.map((h) => h.trim().toLowerCase());
  for (const t of TARGETS) {
    let found = -1;
    for (const hint of HINTS[t.key]) {
      const idx = norm.findIndex((h, i) => !used.has(i) && (h === hint || h.includes(hint)));
      if (idx !== -1) { found = idx; break; }
    }
    if (found !== -1) used.add(found);
    map[t.key] = found;
  }
  return map;
}

type Report = { imported: number; converted: number; updated: number; skipped: any[] };

export default function ImportDialog({ onClose, onDone }: { onClose: () => void; onDone: (msg: string) => void }) {
  const [step, setStep] = useState<"input" | "mapping" | "importing" | "done">("input");
  const [tab, setTab] = useState<"file" | "paste">("file");
  const [pasteText, setPasteText] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<TargetKey, number>>({} as any);
  const [firstRowIsHeader, setFirstRowIsHeader] = useState(true);
  const [source, setSource] = useState("import");
  const [campaign, setCampaign] = useState("");
  const [addToSequence, setAddToSequence] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [report, setReport] = useState<Report | null>(null);
  const [importId, setImportId] = useState("");
  const [seqActivated, setSeqActivated] = useState<number | null>(null);

  const ingest = useCallback((allRows: string[][]) => {
    if (allRows.length === 0) { setErr("Keine Daten erkannt."); return; }
    const hdr = allRows[0].map((h, i) => (h.trim() || `Spalte ${i + 1}`));
    setHeaders(hdr);
    setDataRows(allRows.slice(1));
    setMapping(autoMap(hdr));
    setErr(null);
    setStep("mapping");
  }, []);

  const onFile = async (file: File) => {
    setErr(null);
    try {
      if (/\.(xlsx|xls)$/i.test(file.name)) {
        const XLSX = await loadSheetJS();
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const arr: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, raw: false });
        ingest(arr.map((r) => r.map((c) => (c == null ? "" : String(c)))));
      } else {
        const text = await file.text();
        ingest(parseDelimited(text, detectDelim(text)));
      }
    } catch (e: any) {
      setErr(e?.message || "Datei konnte nicht gelesen werden.");
    }
  };

  const onPaste = () => {
    if (!pasteText.trim()) { setErr("Bitte Zeilen einfügen."); return; }
    ingest(parseDelimited(pasteText, detectDelim(pasteText)));
  };

  // Zeilen (inkl. evtl. erster Zeile, falls kein Header) gemäß Mapping bauen.
  const effectiveRows = useMemo(() => (firstRowIsHeader ? dataRows : [headers, ...dataRows]), [firstRowIsHeader, headers, dataRows]);
  const mapRow = useCallback((cols: string[]) => {
    const o: Record<string, string> = {};
    for (const t of TARGETS) { const idx = mapping[t.key]; if (idx != null && idx >= 0) o[t.key] = (cols[idx] ?? "").trim(); }
    return o;
  }, [mapping]);
  const preview = useMemo(() => effectiveRows.slice(0, 10).map(mapRow), [effectiveRows, mapRow]);
  const hasContact = mapping.email >= 0 || mapping.telefon >= 0;

  const startImport = async () => {
    if (!hasContact) { setErr("Mindestens E-Mail oder Telefon muss zugeordnet sein."); return; }
    const id = (crypto as any)?.randomUUID?.() || `imp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    setImportId(id);
    setErr(null);
    setStep("importing");
    const all = effectiveRows.map(mapRow);
    setProgress({ done: 0, total: all.length });
    const agg: Report = { imported: 0, converted: 0, updated: 0, skipped: [] };
    for (let i = 0; i < all.length; i += BATCH) {
      const batch = all.slice(i, i + BATCH);
      const r = await apiF("/admin/leads/import", {
        method: "POST",
        body: JSON.stringify({ importId: id, rows: batch, defaultSource: source || "import", defaultCampaign: campaign || null, addToSequence }),
      });
      if (r.ok) {
        agg.imported += r.json.imported; agg.converted += r.json.converted;
        agg.updated += r.json.updated; agg.skipped.push(...(r.json.skipped || []));
      } else {
        agg.skipped.push({ reason: `Batch-Fehler: ${r.json?.error || r.status}` });
      }
      setProgress({ done: Math.min(i + BATCH, all.length), total: all.length });
    }
    setReport(agg);
    setStep("done");
    onDone(`Import abgeschlossen: ${agg.imported} neu, ${agg.converted} als Kunde, ${agg.updated} aktualisiert, ${agg.skipped.length} übersprungen.`);
  };

  const enableSequence = async () => {
    const r = await apiF("/admin/leads/enable-sequence", { method: "POST", body: JSON.stringify({ importId }) });
    if (r.ok) setSeqActivated(r.json.activated);
  };

  const downloadSkipped = () => {
    if (!report?.skipped.length) return;
    const csv = ["email;telefon;grund", ...report.skipped.map((s) => `${s.email || ""};${s.telefon || ""};${(s.reason || "").replace(/;/g, ",")}`)].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "uebersprungene-zeilen.csv"; a.click();
  };

  const inp = "px-2.5 py-1.5 rounded-lg border border-slate-200 text-[13px]";
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-6 px-3" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/40" />
      <div className="relative w-full max-w-3xl bg-white border border-slate-200 rounded-2xl shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
          <p className="text-[15px] font-bold text-slate-900 flex-1">Leads importieren</p>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-slate-200 text-slate-400 flex items-center justify-center"><X size={15} /></button>
        </div>

        <div className="p-5">
          {err && <div className="mb-3 px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 text-[13px] text-slate-700">{err}</div>}

          {step === "input" && (
            <div>
              <div className="flex gap-2 mb-4">
                <button onClick={() => setTab("file")} className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border inline-flex items-center gap-1.5 ${tab === "file" ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-500"}`}><Upload size={13} /> Datei (CSV/XLSX)</button>
                <button onClick={() => setTab("paste")} className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border inline-flex items-center gap-1.5 ${tab === "paste" ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-500"}`}><ClipboardPaste size={13} /> Copy / Paste</button>
              </div>
              {tab === "file" ? (
                <label className="block border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-slate-300">
                  <Upload size={22} className="mx-auto text-slate-300 mb-2" />
                  <span className="text-[13px] text-slate-500">CSV- oder XLSX-Datei auswählen</span>
                  <input type="file" accept=".csv,.xlsx,.xls,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
                </label>
              ) : (
                <div>
                  <textarea className="w-full h-40 px-3 py-2 rounded-lg border border-slate-200 text-[13px] font-mono" placeholder="Zeilen aus Excel/Sheets einfügen (Tab-, Komma- oder Semikolon-getrennt)…" value={pasteText} onChange={(e) => setPasteText(e.target.value)} />
                  <button onClick={onPaste} className="mt-2 px-3 py-2 rounded-lg text-white text-[12px] font-semibold inline-flex items-center gap-1.5" style={{ background: ACCENT }}>Weiter <ArrowRight size={13} /></button>
                </div>
              )}
            </div>
          )}

          {step === "mapping" && (
            <div>
              <label className="flex items-center gap-2 text-[12px] text-slate-600 mb-3">
                <input type="checkbox" checked={firstRowIsHeader} onChange={(e) => setFirstRowIsHeader(e.target.checked)} /> Erste Zeile enthält Spaltenüberschriften
              </label>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Spalten zuordnen</p>
              <div className="grid sm:grid-cols-2 gap-2 mb-4">
                {TARGETS.map((t) => (
                  <label key={t.key} className="text-[12px] text-slate-500 flex items-center gap-2">
                    <span className="w-24 shrink-0">{t.label}{(t.key === "email" || t.key === "telefon") && <span className="text-slate-300"> *</span>}</span>
                    <select className={inp + " flex-1"} value={mapping[t.key] ?? -1} onChange={(e) => setMapping({ ...mapping, [t.key]: Number(e.target.value) })}>
                      <option value={-1}>— ignorieren —</option>
                      {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                    </select>
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 mb-3">* Mindestens E-Mail oder Telefon zuordnen. Zeilen ohne beides werden übersprungen.</p>

              <div className="grid sm:grid-cols-3 gap-2 mb-4">
                <label className="text-[12px] text-slate-500">Quelle<input className={inp + " w-full"} value={source} onChange={(e) => setSource(e.target.value)} placeholder="import" /></label>
                <label className="text-[12px] text-slate-500">Kampagne (optional)<input className={inp + " w-full"} value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="z. B. bestandsliste_juni" /></label>
                <label className="text-[12px] text-slate-600 flex items-end gap-2 pb-1.5"><input type="checkbox" checked={addToSequence} onChange={(e) => setAddToSequence(e.target.checked)} /> In Nachfass-Sequenz aufnehmen</label>
              </div>

              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Vorschau (erste 10 Zeilen)</p>
              <div className="border border-slate-200 rounded-lg overflow-x-auto mb-4">
                <table className="w-full text-[12px]">
                  <thead className="bg-slate-50 text-slate-400"><tr>{TARGETS.map((t) => <th key={t.key} className="text-left px-2 py-1.5 font-semibold">{t.label}</th>)}</tr></thead>
                  <tbody>
                    {preview.map((r, i) => (
                      <tr key={i} className="border-t border-slate-100">{TARGETS.map((t) => <td key={t.key} className="px-2 py-1 text-slate-600 whitespace-nowrap">{(r as any)[t.key] || "—"}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setStep("input")} className="px-3 py-2 rounded-lg border border-slate-200 text-[12px] font-semibold text-slate-600">Zurück</button>
                <button onClick={startImport} disabled={!hasContact} className="px-4 py-2 rounded-lg text-white text-[12px] font-semibold disabled:opacity-40" style={{ background: ACCENT }}>{effectiveRows.length} Zeilen importieren</button>
              </div>
            </div>
          )}

          {step === "importing" && (
            <div className="py-8 text-center">
              <p className="text-[13px] text-slate-600 mb-3">Import läuft… {progress.done} / {progress.total}</p>
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden max-w-md mx-auto">
                <div className="h-full rounded-full transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`, background: ACCENT }} />
              </div>
            </div>
          )}

          {step === "done" && report && (
            <div>
              <div className="flex items-center gap-2 mb-4"><CheckCircle2 size={18} style={{ color: ACCENT }} /><p className="text-[14px] font-semibold text-slate-800">Import abgeschlossen</p></div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {[["Neu importiert", report.imported], ["Als Kunde konvertiert", report.converted], ["Aktualisiert (Dublette)", report.updated], ["Übersprungen", report.skipped.length]].map(([l, v]) => (
                  <div key={l as string} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <p className="text-[11px] text-slate-400">{l}</p><p className="text-lg font-bold text-slate-900 tabular-nums">{v as number}</p>
                  </div>
                ))}
              </div>
              {report.skipped.length > 0 && (
                <button onClick={downloadSkipped} className="mb-3 px-3 py-2 rounded-lg border border-slate-200 text-[12px] font-semibold text-slate-600 inline-flex items-center gap-1.5"><Download size={13} /> Übersprungene Zeilen (CSV)</button>
              )}
              {!addToSequence && report.imported > 0 && (
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 mb-3">
                  <p className="text-[12px] text-slate-600 mb-2">Diese Leads sind <b>nicht</b> in der Nachfass-Sequenz (kein automatischer Mailversand). Jetzt bewusst starten?</p>
                  {seqActivated == null
                    ? <button onClick={enableSequence} className="px-3 py-2 rounded-lg text-white text-[12px] font-semibold" style={{ background: ACCENT }}>Sequenz für diese {report.imported} Leads starten</button>
                    : <p className="text-[12px] font-semibold text-slate-700">{seqActivated} Lead(s) in die Sequenz aufgenommen.</p>}
                </div>
              )}
              <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-[12px] font-semibold text-slate-600">Schließen</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
