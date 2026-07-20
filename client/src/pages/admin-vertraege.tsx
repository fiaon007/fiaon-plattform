import { useState, useEffect, useCallback } from "react";
import { X, FileText, Download, Eye, Check, Plus, Pencil } from "lucide-react";
import { PageIntro } from "@/components/admin/PageHelp";

// ============================================================================
// /admin/vertraege — Onboarding-Status, Vertragsvorlagen & Vertragsvariablen
// (Prompt 1 C + Prompt 2 A/F, Admin-Seite).
//  · Vorlagen: versioniert, Entwurf/Aktiv. Signieren nur bei „Aktiv".
//  · Pro Agent: Variablen setzen + Live-Vorschau des befüllten Vertrags.
//  · Onboarding-Status pro Agent (Zustimmung/Vertrag) + PDF-Nachweise.
// ============================================================================

const ACCENT = "#2563eb";

async function api(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`/api/fiaon${path}`, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok && json?.ok, json };
}

function fmtDT(v: string | null | undefined): string {
  if (!v) return "—";
  try { return new Date(v).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return "—"; }
}
function fmtCents(c: number | null | undefined): string {
  if (c == null) return "—";
  return `${(c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

interface TemplateRow { id: number; version: number; title: string; status: string; created_at: string; activated_at: string | null; }
interface OverviewRow {
  id: number; name: string; email: string; active: boolean;
  consentComplete: boolean; contractComplete: boolean; contractSignedAt: string | null;
  templateVersion: number | null; complete: boolean;
}

export default function AdminVertraegePage() {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [overview, setOverview] = useState<OverviewRow[]>([]);
  const [activeVersion, setActiveVersion] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [editor, setEditor] = useState<{ id: number | null; title: string; body: string } | null>(null);

  const load = useCallback(() => {
    api("/admin/contract-templates").then((r) => { if (r.ok) setTemplates(r.json.data); });
    api("/admin/onboarding-overview").then((r) => { if (r.ok) { setOverview(r.json.data); setActiveVersion(r.json.activeTemplateVersion); } });
  }, []);
  useEffect(load, [load]);

  const flash = (m: string) => { setMessage(m); setTimeout(() => setMessage(null), 4000); };

  const newDraft = async () => {
    // Entwurf aus der jüngsten Vorlage vorbefüllen.
    const latest = templates[0];
    let body = "";
    let title = "Self-Employed Commercial Agent Agreement";
    if (latest) {
      const r = await api(`/admin/contract-templates/${latest.id}`);
      if (r.ok) { body = r.json.template.body_html; title = r.json.template.title; }
    }
    setEditor({ id: null, title, body });
  };

  const editDraft = async (id: number) => {
    const r = await api(`/admin/contract-templates/${id}`);
    if (r.ok) setEditor({ id, title: r.json.template.title, body: r.json.template.body_html });
  };

  const saveEditor = async () => {
    if (!editor) return;
    if (editor.id == null) {
      const r = await api("/admin/contract-templates", { method: "POST", body: JSON.stringify({ title: editor.title, bodyHtml: editor.body }) });
      if (r.ok) { flash(`Entwurf v${r.json.version} angelegt.`); setEditor(null); load(); }
      else flash(r.json?.error || "Fehler");
    } else {
      const r = await api(`/admin/contract-templates/${editor.id}/update`, { method: "POST", body: JSON.stringify({ title: editor.title, bodyHtml: editor.body }) });
      if (r.ok) { flash("Entwurf gespeichert."); setEditor(null); load(); }
      else flash(r.json?.error || "Fehler");
    }
  };

  const activate = async (id: number) => {
    const r = await api(`/admin/contract-templates/${id}/activate`, { method: "POST" });
    if (r.ok) { flash("Vorlage aktiviert. Agenten unterschreiben nun diese Version."); load(); }
    else flash(r.json?.error || "Fehler");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <PageIntro
          id="vertraege"
          title="Onboarding & Verträge"
          subtitle="Zustimmungs- und Vertragsstatus pro Agent, versionierte Vertragsvorlagen (Entwurf/Aktiv) und die Vertragsvariablen je Agent."
          steps={[
            "Lege eine Vertragsvorlage an und aktiviere sie — nur bei Status „Aktiv“ kann ein Agent unterschreiben.",
            "Setze pro Agent die Vertragsvariablen (Privatperson/Unternehmen, Anschrift, Steuer-/USt-ID, Governing law …) und prüfe die Live-Vorschau.",
            "Verfolge den Onboarding-Status je Agent (Zustimmung/Vertrag) und lade Zustimmungsprotokoll, Vertrag und Provisions-Abrechnungen als PDF herunter.",
          ]}
        />

        {message && <div className="mb-4 px-4 py-3 rounded-xl bg-white border border-slate-300 text-[13px] font-medium text-slate-700">{message}</div>}

        {/* Vertragsvorlagen */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-bold text-slate-900">Vertragsvorlagen</h2>
            <button type="button" onClick={newDraft} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-[12px] font-semibold" style={{ background: ACCENT }}>
              <Plus size={14} /> Neuer Entwurf
            </button>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-left">
              <thead><tr className="border-b border-slate-100">
                {["Version", "Titel", "Status", "Aktiviert", ""].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {templates.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-[13px] text-slate-400">Keine Vorlagen.</td></tr>
                ) : templates.map((t) => (
                  <tr key={t.id} className="border-b border-slate-50">
                    <td className="px-4 py-3 text-[13px] font-bold tabular-nums">v{t.version}</td>
                    <td className="px-4 py-3 text-[13px]">{t.title}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={t.status} />
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-500 whitespace-nowrap">{t.activated_at ? fmtDT(t.activated_at) : "—"}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {t.status === "draft" && (
                        <>
                          <button onClick={() => editDraft(t.id)} className="text-[12px] font-semibold text-slate-500 hover:text-slate-800 mr-3 inline-flex items-center gap-1"><Pencil size={12} /> Bearbeiten</button>
                          <button onClick={() => activate(t.id)} className="text-[12px] font-semibold" style={{ color: ACCENT }}>Aktivieren</button>
                        </>
                      )}
                      {t.status === "active" && <span className="text-[11px] text-slate-400">gültige Version</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11.5px] text-slate-400 mt-2">Signieren ist nur bei Status „Aktiv" möglich. Entwürfe tragen in der Vorschau ein „DRAFT"-Wasserzeichen.</p>
        </section>

        {/* Onboarding-Status */}
        <section>
          <h2 className="text-[15px] font-bold text-slate-900 mb-3">Onboarding-Status pro Agent</h2>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead><tr className="border-b border-slate-100">
                  {["Agent", "Zustimmung", "Vertrag", "Version", "Signiert am", ""].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {overview.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-[13px] text-slate-400">Keine Agenten.</td></tr>
                  ) : overview.map((a) => (
                    <tr key={a.id} onClick={() => setDetailId(a.id)} className="border-b border-slate-50 cursor-pointer hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-[13px] font-semibold text-slate-900">{a.name}{!a.active && <span className="ml-2 text-[10px] text-slate-400">(deaktiviert)</span>}</p>
                        <p className="text-[11px] text-slate-400">{a.email}</p>
                      </td>
                      <td className="px-4 py-3"><OkPill ok={a.consentComplete} /></td>
                      <td className="px-4 py-3"><OkPill ok={a.contractComplete} /></td>
                      <td className="px-4 py-3 text-[12px] text-slate-500 tabular-nums">{a.templateVersion ? `v${a.templateVersion}` : "—"}</td>
                      <td className="px-4 py-3 text-[12px] text-slate-500 whitespace-nowrap">{fmtDT(a.contractSignedAt)}</td>
                      <td className="px-4 py-3 text-right text-[12px] font-semibold" style={{ color: ACCENT }}>Öffnen</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {activeVersion == null && <p className="text-[12px] text-amber-700 mt-2">Achtung: Keine aktive Vertragsvorlage — Agenten können nicht signieren.</p>}
        </section>
      </div>

      {editor && <TemplateEditor editor={editor} setEditor={setEditor} onSave={saveEditor} />}
      {detailId != null && <AgentDetail id={detailId} onClose={() => { setDetailId(null); load(); }} flash={flash} />}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = { draft: "Entwurf", active: "Aktiv", archived: "Archiviert" };
  const emph = status === "active";
  return <span className={`inline-block px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${emph ? "border-slate-500 text-slate-800" : "border-slate-200 text-slate-500"}`}>{map[status] || status}</span>;
}

function OkPill({ ok }: { ok: boolean }) {
  return ok
    ? <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-slate-400 text-[11px] font-semibold text-slate-800"><Check size={12} strokeWidth={3} /> erledigt</span>
    : <span className="inline-block px-2.5 py-0.5 rounded-full border border-slate-200 text-[11px] font-semibold text-slate-400">offen</span>;
}

// ── Vorlagen-Editor ──────────────────────────────────────────────────────────
function TemplateEditor({ editor, setEditor, onSave }: {
  editor: { id: number | null; title: string; body: string };
  setEditor: (e: { id: number | null; title: string; body: string } | null) => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45" onClick={() => setEditor(null)}>
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-[15px] font-bold">{editor.id == null ? "Neuer Vertrags-Entwurf" : "Entwurf bearbeiten"}</h3>
          <button onClick={() => setEditor(null)} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <div className="p-5 overflow-y-auto space-y-3">
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1">Titel</label>
            <input value={editor.title} onChange={(e) => setEditor({ ...editor, title: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-[13px]" />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1">Vertragstext (HTML mit [[PLATZHALTERN]] und [[SIGNATURE_PANEL]])</label>
            <textarea value={editor.body} onChange={(e) => setEditor({ ...editor, body: e.target.value })} rows={18} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-[12px] font-mono leading-relaxed" />
            <p className="text-[11px] text-slate-400 mt-1">Verfügbar: EFFECTIVE_DATE, START_DATE, AGENT_LEGAL_NAME, AGENT_TYPE, AGENT_ADDRESS, COMPANY_BLOCK, COMMISSION_RATE, PAYOUT_TERMS, NOTICE_PERIOD, GOVERNING_LAW, JURISDICTION, ACTIVITY.</p>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={() => setEditor(null)} className="px-4 py-2 rounded-lg border border-slate-200 text-[13px] font-semibold text-slate-600">Abbrechen</button>
          <button onClick={onSave} className="px-4 py-2 rounded-lg text-white text-[13px] font-semibold" style={{ background: ACCENT }}>Speichern</button>
        </div>
      </div>
    </div>
  );
}

// ── Agent-Detail: Variablen + Vorschau + Nachweise ───────────────────────────
interface AgentVars {
  partnerType: string; legalName: string; addressLine: string; postalCode: string; city: string; country: string;
  birthDate: string; foundingDate: string; taxId: string; vatId: string;
  companyName: string; legalForm: string; registerNo: string; authorisedRep: string;
  contractStartDate: string; payoutTerms: string; noticePeriod: string; governingLaw: string; jurisdiction: string;
  activityDescription: string; commissionRateBp: number | null;
  minPayoutThreshold?: string; maxRetainedBalance?: string;
}

function AgentDetail({ id, onClose, flash }: { id: number; onClose: () => void; flash: (m: string) => void }) {
  const [vars, setVars] = useState<AgentVars | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [onb, setOnb] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);

  const loadPreview = useCallback(() => {
    api(`/admin/agents/${id}/contract-preview`).then((r) => {
      if (r.ok) {
        setPreviewHtml(r.json.html);
        setMissing(r.json.missing || []);
        const v = r.json.variables || {};
        setVars({
          partnerType: v.partnerType || "private",
          legalName: v.legalName || "", addressLine: v.addressLine || "", postalCode: v.postalCode || "",
          city: v.city || "", country: v.country || "", birthDate: (v.birthDate || "").slice(0, 10),
          foundingDate: (v.foundingDate || "").slice(0, 10), taxId: v.taxId || "", vatId: v.vatId || "",
          companyName: v.companyName || "", legalForm: v.legalForm || "", registerNo: v.registerNo || "",
          authorisedRep: v.authorisedRep || "", contractStartDate: (v.contractStartDate || "").slice(0, 10),
          payoutTerms: v.payoutTerms || "", noticePeriod: v.noticePeriod || "", governingLaw: v.governingLaw || "",
          jurisdiction: v.jurisdiction || "", activityDescription: v.activityDescription || "",
          commissionRateBp: v.commissionRateBp ?? null,
          minPayoutThreshold: v.minPayoutThreshold || "", maxRetainedBalance: v.maxRetainedBalance || "",
        });
      }
    });
  }, [id]);

  useEffect(() => {
    loadPreview();
    api(`/admin/agents/${id}/onboarding`).then((r) => { if (r.ok) setOnb(r.json); });
  }, [id, loadPreview]);

  const save = async () => {
    if (!vars) return;
    const r = await api(`/admin/agents/${id}/contract-variables`, { method: "POST", body: JSON.stringify(vars) });
    if (r.ok) { flash("Vertragsvariablen gespeichert."); loadPreview(); }
    else flash(r.json?.error || "Fehler");
  };

  const isCompany = vars?.partnerType === "company";
  const set = (k: keyof AgentVars, val: string) => setVars((v) => (v ? { ...v, [k]: val } : v));

  const Field = ({ label, k, type = "text" }: { label: string; k: keyof AgentVars; type?: string }) => (
    <div>
      <label className="block text-[11px] font-semibold text-slate-500 mb-1">{label}</label>
      <input type={type} value={(vars?.[k] as string) || ""} onChange={(e) => set(k, e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-[13px]" />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-900/45" onClick={onClose}>
      <div className="bg-slate-50 w-full max-w-2xl h-full overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <h3 className="text-[15px] font-bold">Agent-Detail #{id}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-6">
          {/* Onboarding-Status */}
          {onb && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <h4 className="text-[13px] font-bold mb-2">Onboarding-Status</h4>
              <div className="flex items-center gap-4 text-[12px]">
                <span>Zustimmung: <OkPill ok={onb.status.consent.complete} /></span>
                <span>Vertrag: <OkPill ok={onb.status.contract.complete} /></span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={`/api/fiaon/admin/agents/${id}/consent-protocol.pdf`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-[12px] font-semibold text-slate-600 hover:border-slate-300">
                  <Download size={13} /> Zustimmungsprotokoll
                </a>
                {(onb.contracts || []).filter((c: any) => c.has_pdf).map((c: any) => (
                  <a key={c.id} href={`/api/fiaon/admin/agents/${id}/contract/${c.id}.pdf`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-[12px] font-semibold text-slate-600 hover:border-slate-300">
                    <FileText size={13} /> Vertrag v{c.template_version}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Vertragsvariablen */}
          {vars && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <h4 className="text-[13px] font-bold mb-3">Vertragsvariablen</h4>
              <div className="flex gap-2 mb-4">
                {["private", "company"].map((pt) => (
                  <button key={pt} type="button" onClick={() => set("partnerType", pt)}
                    className={`flex-1 py-2 rounded-lg text-[12px] font-semibold border transition-colors ${vars.partnerType === pt ? "text-white border-transparent" : "text-slate-600 border-slate-200"}`}
                    style={vars.partnerType === pt ? { background: ACCENT } : undefined}>
                    {pt === "private" ? "Privatperson" : "Unternehmen (UG/GmbH/Ltd)"}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label={isCompany ? "Firma (rechtl. Name)" : "Rechtlicher Name"} k={isCompany ? "companyName" : "legalName"} />
                <Field label="Straße & Nr." k="addressLine" />
                <Field label="PLZ" k="postalCode" />
                <Field label="Ort" k="city" />
                <Field label="Land" k="country" />
                <Field label={isCompany ? "Gründungsdatum" : "Geburtsdatum"} k={isCompany ? "foundingDate" : "birthDate"} type="date" />
                {isCompany && <Field label="Rechtsform" k="legalForm" />}
                {isCompany && <Field label="Register-Nr." k="registerNo" />}
                {isCompany && <Field label="USt-ID" k="vatId" />}
                {isCompany && <Field label="Vertretungsberechtigter" k="authorisedRep" />}
                <Field label="Steuernummer" k="taxId" />
                <Field label="Vertragsbeginn" k="contractStartDate" type="date" />
                <Field label="Kündigungsfrist" k="noticePeriod" />
                <Field label="Auszahlungsmodus/-rhythmus" k="payoutTerms" />
                <Field label="Governing law" k="governingLaw" />
                <Field label="Jurisdiction" k="jurisdiction" />
              </div>
              <div className="mt-3">
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Tätigkeitsbeschreibung</label>
                <textarea value={vars.activityDescription} onChange={(e) => set("activityDescription", e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-[13px]" />
              </div>
              <p className="text-[11px] text-slate-400 mt-2">Provisionssatz: {vars.commissionRateBp != null ? `${(vars.commissionRateBp / 100).toLocaleString("de-DE")} %` : "Standard"} (im Team-Bereich pflegbar). Governing law/Jurisdiction haben rechtliche Konsequenzen — Voreinstellung England &amp; Wales / London.</p>
              <p className="text-[11px] text-slate-400 mt-1">Auszahlungs-Schwellen (Clause 6.7): Mindestbetrag <span className="font-semibold text-slate-600">{vars.minPayoutThreshold || "—"}</span> (Selbst-Auszahlung), Obergrenze <span className="font-semibold text-slate-600">{vars.maxRetainedBalance || "—"}</span> (Überschuss wird ausgezahlt). Global im Team-Bereich → Einstellungen pflegbar; nur Timing, kein Einbehalt.</p>
              {missing.length > 0 && <p className="text-[12px] text-amber-700 mt-2">Fehlende Pflichtangaben: {missing.join(", ")}</p>}
              <div className="mt-4 flex gap-2">
                <button onClick={save} className="px-4 py-2 rounded-lg text-white text-[13px] font-semibold" style={{ background: ACCENT }}>Speichern</button>
                <button onClick={() => setShowPreview((s) => !s)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 text-[13px] font-semibold text-slate-600 hover:border-slate-300">
                  <Eye size={14} /> {showPreview ? "Vorschau ausblenden" : "Live-Vorschau"}
                </button>
              </div>
            </div>
          )}

          {/* Live-Vorschau */}
          {showPreview && previewHtml && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-100 text-[12px] font-semibold text-slate-600">Vorschau des befüllten Vertrags</div>
              <iframe title="Vertrags-Vorschau" srcDoc={previewHtml} className="w-full" style={{ height: 520, border: 0 }} />
            </div>
          )}

          {/* Provisions-Abrechnungen */}
          {onb && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <h4 className="text-[13px] font-bold mb-2">Provisions-Abrechnungen</h4>
              {(onb.statements || []).length === 0 ? (
                <p className="text-[12px] text-slate-400">Noch keine Abrechnungen.</p>
              ) : (
                <div className="space-y-2">
                  {onb.statements.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between gap-3 border border-slate-100 rounded-lg px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-semibold text-slate-800 tabular-nums">{s.statement_no}</p>
                        <p className="text-[11px] text-slate-400">{fmtDT(s.issued_at)} · Netto {fmtCents(s.net_cents)}</p>
                      </div>
                      {s.has_pdf && (
                        <a href={`/api/fiaon/admin/agents/${id}/statement/${s.id}.pdf`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-[12px] font-semibold text-slate-600 hover:border-slate-300">
                          <Download size={13} /> PDF
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
