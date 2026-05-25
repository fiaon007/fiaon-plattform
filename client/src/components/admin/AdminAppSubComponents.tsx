type SortField = 'name' | 'email' | 'status' | 'payment' | 'package' | 'date' | 'ref';
type SortDir = 'asc' | 'desc';

function Field({ label, value, mono }: { label: string; value: any; mono?: boolean }) {
  const isEmpty = value === null || value === undefined || value === '' || value === false;
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1.5">{label}</p>
      {isEmpty ? (
        <p className="text-[13px] italic text-slate-400">—</p>
      ) : (
        <p className={`text-[13px] font-medium text-slate-800 break-words ${mono ? 'font-mono text-[12px]' : ''}`}>{String(value)}</p>
      )}
    </div>
  );
}

function Th({ field, label, sortField, sortDir, toggle, className = '' }: { field: SortField; label: string; sortField: SortField; sortDir: SortDir; toggle: (f: SortField) => void; className?: string }) {
  return (
    <th onClick={() => toggle(field)} className={`text-left py-3 px-4 text-[10px] uppercase tracking-wider font-semibold text-slate-400 cursor-pointer hover:text-slate-600 select-none transition-colors ${className}`}>
      {label}
      <span className={`ml-1 ${sortField === field ? 'text-blue-600' : 'text-slate-300'}`}>
        {sortField === field && sortDir === 'asc' ? '↑' : sortField === field ? '↓' : '↕'}
      </span>
    </th>
  );
}

function StatusBadge({ label, status, text }: { label: string; status: 'approved' | 'warning' | 'error' | 'pending'; text: string }) {
  const cls = status === 'approved' ? 'bg-emerald-50 text-emerald-700' : status === 'warning' ? 'bg-amber-50 text-amber-700' : status === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-500';
  const dot = status === 'approved' ? 'bg-emerald-500' : status === 'warning' ? 'bg-amber-500 animate-pulse' : status === 'error' ? 'bg-rose-500' : 'bg-slate-400';
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}: {text}
    </span>
  );
}

function KycRow({ label, available, downloadUrl, schufaStatus }: { label: string; available: boolean; downloadUrl?: string; schufaStatus?: string }) {
  const statusBadge = schufaStatus === 'approved'
    ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">Genehmigt</span>
    : schufaStatus === 'requested'
    ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Neu angefordert</span>
    : schufaStatus === 'rejected'
    ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">Abgelehnt</span>
    : available
    ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">In Prüfung</span>
    : null;

  return (
    <div className={`flex items-center justify-between p-4 rounded-xl bg-white border ${schufaStatus === 'approved' ? 'border-teal-200' : schufaStatus === 'rejected' ? 'border-rose-200' : 'border-slate-100'}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${available ? (schufaStatus === 'approved' ? 'bg-teal-600 text-white' : 'bg-slate-900 text-white') : 'bg-slate-100 text-slate-400'}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-semibold text-slate-800">{label}</p>
            {statusBadge}
          </div>
          <p className={`text-[12px] ${available ? 'text-emerald-600' : 'text-slate-400'}`}>{available ? 'Vorhanden' : 'Nicht hochgeladen'}</p>
        </div>
      </div>
      {available && downloadUrl && (
        <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Herunterladen
        </a>
      )}
    </div>
  );
}

export const AdminAppSubComponents = { Field, Th, StatusBadge, KycRow };
