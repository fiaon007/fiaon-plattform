import { useState, useEffect } from "react";
import { FileText, FileSignature, Download, ShieldCheck } from "lucide-react";
import { AgentShell, Card, api, fmtCents, fmtDT, ACCENT } from "./shared";

// ============================================================================
// /agent/dokumente — „Meine Dokumente" (Prompt 2 F).
// Zwei Bereiche: Vertrag (aktuelle + frühere Versionen) und Provisions-
// Abrechnungen (chronologisch, downloadbar). Der offizielle Nachweis des Agenten.
// ============================================================================

interface ContractRow {
  id: number; template_version: number; signature_name: string; signature_mode: string;
  signed_at: string; doc_hash: string; status: string; has_pdf: boolean;
}
interface StatementRow {
  id: number; statement_no: string; period_start: string | null; period_end: string | null;
  issued_at: string; gross_cents: number; net_cents: number; doc_hash: string; has_pdf: boolean;
}

export default function AgentDokumentePage() {
  return (
    <AgentShell>
      <Dokumente />
    </AgentShell>
  );
}

function Dokumente() {
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [statements, setStatements] = useState<StatementRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api("/agent/documents").then((r) => {
      if (r.ok) { setContracts(r.json.contracts || []); setStatements(r.json.statements || []); }
      setLoaded(true);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight text-slate-900">Meine Dokumente</h1>
        <p className="text-[13px] text-slate-500 mt-1">Dein Vertrag und deine Provisions-Abrechnungen — jederzeit als PDF.</p>
      </div>

      {/* Vertrag */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <FileSignature size={16} style={{ color: ACCENT }} />
          <h2 className="text-[14px] font-bold text-slate-900">Vertrag</h2>
        </div>
        {contracts.length === 0 ? (
          <Card className="p-5 text-[13px] text-slate-400">{loaded ? "Noch kein signierter Vertrag vorhanden." : "Lädt …"}</Card>
        ) : (
          <div className="space-y-2.5">
            {contracts.map((c, i) => (
              <Card key={c.id} className="p-4">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                    <FileText size={18} strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-bold text-slate-900">
                      Handelsvertretervertrag <span className="text-slate-400 font-semibold">· v{c.template_version}</span>
                      {i === 0 && <span className="ml-2 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full border border-slate-300 text-slate-500">Aktuell</span>}
                    </p>
                    <p className="text-[11.5px] text-slate-500 mt-0.5">
                      Signiert {fmtDT(c.signed_at)} · {c.signature_mode === "drawn" ? "Unterschrift" : "getippt"} · {c.signature_name}
                    </p>
                    <p className="text-[10px] text-slate-300 font-mono truncate mt-0.5">Hash {c.doc_hash.slice(0, 24)}…</p>
                  </div>
                  {c.has_pdf && (
                    <a
                      href={`/api/fiaon/agent/documents/contract/${c.id}.pdf`}
                      target="_blank" rel="noreferrer"
                      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-[12px] font-semibold"
                      style={{ background: ACCENT }}
                    >
                      <Download size={14} /> PDF
                    </a>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Provisions-Abrechnungen */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck size={16} style={{ color: ACCENT }} />
          <h2 className="text-[14px] font-bold text-slate-900">Provisions-Abrechnungen</h2>
        </div>
        {statements.length === 0 ? (
          <Card className="p-5 text-[13px] text-slate-400">{loaded ? "Noch keine Abrechnungen — sie entstehen automatisch bei jeder Auszahlung." : "Lädt …"}</Card>
        ) : (
          <div className="space-y-2.5">
            {statements.map((s) => (
              <Card key={s.id} className="p-4">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                    <FileText size={18} strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-bold text-slate-900 tabular-nums">{s.statement_no}</p>
                    <p className="text-[11.5px] text-slate-500 mt-0.5">
                      Ausgestellt {fmtDT(s.issued_at)} · Netto <span className="font-semibold text-slate-700">{fmtCents(s.net_cents)}</span>
                    </p>
                  </div>
                  {s.has_pdf && (
                    <a
                      href={`/api/fiaon/agent/documents/statement/${s.id}.pdf`}
                      target="_blank" rel="noreferrer"
                      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-[12px] font-semibold"
                      style={{ background: ACCENT }}
                    >
                      <Download size={14} /> PDF
                    </a>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
