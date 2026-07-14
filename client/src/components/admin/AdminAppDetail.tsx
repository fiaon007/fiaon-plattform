import { useState, useEffect } from "react";
import { AdminAppSubComponents } from "./AdminAppSubComponents";
import { getPaymentStatusKey, getAppStatusKey, PAYMENT_META, STATUS_META, getFullName, formatDate, formatDateTime, formatCurrency } from "./AdminApplicationsManager";

const { Field, StatusBadge, KycRow } = AdminAppSubComponents;

type DetailTab = 'personal' | 'finance' | 'setup' | 'kyc' | 'admin' | 'schufa' | 'transactions' | 'meta';

interface Props {
  app: any;
  setApp: (app: any | null) => void;
  applications: any[];
  setApplications: (fn: (prev: any[]) => any[]) => void;
}

export function AdminAppDetail({ app, setApp, applications, setApplications }: Props) {
  const [activeTab, setActiveTab] = useState<DetailTab>('personal');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState<string | null>(null);
  const [reuploadBank, setReuploadBank] = useState(false);
  const [reuploadId, setReuploadId] = useState(false);
  const [profileNote, setProfileNote] = useState('');
  const [schufaNote, setSchufaNote] = useState('');

  useEffect(() => {
    if (activeTab === 'transactions' && app?.ref && transactions.length === 0) {
      setTxLoading(true);
      fetch(`/api/fiaon/admin/applications/${app.ref}/transactions`, { credentials: 'include' })
        .then(r => r.json())
        .then(json => { if (json.ok) setTransactions(json.transactions || []); })
        .catch(() => {})
        .finally(() => setTxLoading(false));
    }
  }, [activeTab, app?.ref]);

  const sendReview = async (kycStatus?: string, accountStatus?: string, noteOverride?: string, reuploadBankOverride?: boolean, reuploadIdOverride?: boolean) => {
    if (!app?.ref) return;
    setReviewLoading(true); setReviewSuccess(null);
    try {
      const body: any = {};
      if (kycStatus) body.kycStatus = kycStatus;
      if (accountStatus) body.accountStatus = accountStatus;
      if (noteOverride !== undefined) body.adminNote = noteOverride;
      else if (reviewNote.trim()) body.adminNote = reviewNote.trim();
      if (reuploadBankOverride !== undefined) body.reuploadBankStatement = reuploadBankOverride;
      else if (kycStatus === 'changes_requested') body.reuploadBankStatement = reuploadBank;
      if (reuploadIdOverride !== undefined) body.reuploadIdCard = reuploadIdOverride;
      else if (kycStatus === 'changes_requested') body.reuploadIdCard = reuploadId;
      const res = await fetch(`/api/fiaon/admin/applications/${app.ref}/review`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });
      if (res.ok) {
        const updated = { ...app, kyc_status: kycStatus ?? app.kyc_status, account_status: accountStatus ?? app.account_status, admin_note: body.adminNote ?? app.admin_note, reupload_bank_statement: body.reuploadBankStatement ?? app.reupload_bank_statement, reupload_id_card: body.reuploadIdCard ?? app.reupload_id_card };
        setApp(updated);
        setApplications(prev => prev.map(a => a.ref === app.ref ? { ...a, ...updated } : a));
        setReviewSuccess('Gespeichert');
        setTimeout(() => setReviewSuccess(null), 2500);
        if (kycStatus !== 'changes_requested') { setReviewNote(""); setReuploadBank(false); setReuploadId(false); }
      }
    } catch {}
    setReviewLoading(false);
  };

  const sendSchufaAction = async (schufaStatus: string, note?: string) => {
    if (!app?.ref) return;
    setReviewLoading(true); setReviewSuccess(null);
    try {
      const body: any = { schufaStatus };
      if (note !== undefined) body.adminSchufaNote = note;
      const res = await fetch(`/api/fiaon/admin/applications/${app.ref}/review`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });
      if (res.ok) {
        const updated = { ...app, schufa_status: schufaStatus, admin_schufa_note: note !== undefined ? (note || null) : app.admin_schufa_note };
        setApp(updated);
        setApplications(prev => prev.map(a => a.ref === app.ref ? { ...a, schufa_status: schufaStatus } : a));
        setReviewSuccess('SCHUFA gespeichert');
        setTimeout(() => setReviewSuccess(null), 2500);
        if (note !== undefined) setSchufaNote('');
      }
    } catch {}
    setReviewLoading(false);
  };

  const sendProfileQuery = async () => {
    if (!app?.ref || !profileNote.trim()) return;
    try {
      const body = { adminProfileNote: profileNote.trim(), profileChangesRequested: true };
      const res = await fetch(`/api/fiaon/admin/applications/${app.ref}/review`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });
      if (res.ok) {
        setApp({ ...app, admin_profile_note: profileNote.trim(), profile_changes_requested: true });
        setProfileNote('');
        setReviewSuccess('Profil-Rückfrage gesendet');
        setTimeout(() => setReviewSuccess(null), 2500);
      }
    } catch {}
  };

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-5 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <button onClick={() => setApp(null)} className="text-[12px] font-semibold text-blue-600 hover:text-blue-800 mb-2 flex items-center gap-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
              Zurück zur Übersicht
            </button>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white text-lg font-bold shrink-0">{(getFullName(app)[0] || '?').toUpperCase()}</div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-slate-900 truncate">{getFullName(app)}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-[12px] font-mono text-slate-400">{app.ref}</span>
                  {(() => { const st = STATUS_META[getAppStatusKey(app)]; return <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${st.cls}`}><span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}/>{st.label}</span>; })()}
                  {(() => { const pay = PAYMENT_META[getPaymentStatusKey(app)]; return <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${pay.cls}`}><span className={`w-1.5 h-1.5 rounded-full ${pay.dot}`}/>{pay.label}</span>; })()}
                  {app.email && <span className="text-[12px] text-slate-500">{app.email}</span>}
                </div>
              </div>
            </div>
          </div>
          <button onClick={() => setApp(null)} className="p-2.5 rounded-xl hover:bg-slate-100 transition-colors shrink-0" aria-label="Schließen">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="border-t border-slate-100 px-6 flex gap-0 overflow-x-auto">
          {([
            { id: 'personal' as DetailTab, label: 'Persönlich' },
            { id: 'finance' as DetailTab, label: 'Finanzen' },
            { id: 'setup' as DetailTab, label: 'Setup & Vertrag' },
            { id: 'kyc' as DetailTab, label: 'KYC & Dokumente' },
            { id: 'admin' as DetailTab, label: 'Admin-Prüfung' },
            { id: 'schufa' as DetailTab, label: 'SCHUFA' },
            { id: 'transactions' as DetailTab, label: 'Zahlungen' },
            { id: 'meta' as DetailTab, label: 'Meta' },
          ]).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-3.5 text-[13px] font-semibold border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200'}`}>{tab.label}</button>
          ))}
        </div>
      </div>

      {/* EA: Dubletten-Transparenz — Historie ohne Datenbank verständlich machen */}
      {(() => {
        const email = String(app.email || '').trim().toLowerCase();
        const related = email
          ? applications.filter(a => String(a.email || '').trim().toLowerCase() === email && a.ref !== app.ref)
          : [];
        const supersededBy = app.superseded_by
          ? applications.find(a => a.ref === app.superseded_by || a.payment_reference === app.superseded_by)
          : null;
        const replaces = applications.filter(a => a.superseded_by && (a.superseded_by === app.ref || a.superseded_by === app.payment_reference));
        if (related.length === 0 && !supersededBy && replaces.length === 0 && !app.merged_into) return null;
        return (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mt-4">
            <p className="text-[13px] font-bold text-amber-800 mb-1.5">Dubletten & zusammenhängende Bestellungen</p>
            <div className="space-y-1 text-[12px] text-amber-800/90">
              {app.superseded_by && (
                <p>Diese Bestellung wurde durch <span className="font-mono font-semibold">{app.superseded_by}</span> ersetzt (Zahlung lief über die neuere Bestellung).</p>
              )}
              {app.merged_into && (
                <p>Diese Bestellung wurde in <span className="font-mono font-semibold">{app.merged_into}</span> zusammengeführt.</p>
              )}
              {replaces.map(r => (
                <p key={r.ref}>Ersetzt die ältere Bestellung <span className="font-mono font-semibold">{r.ref}</span>.</p>
              ))}
            </div>
            {related.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <span className="text-[11px] text-amber-700 font-semibold self-center">Gleiche E-Mail:</span>
                {related.map(r => {
                  const pay = PAYMENT_META[getPaymentStatusKey(r)];
                  return (
                    <button key={r.ref} onClick={() => setApp(r)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-amber-200 text-[11px] font-semibold text-slate-700 hover:border-amber-300 transition-colors">
                      <span className="font-mono">{r.payment_reference || r.ref}</span>
                      {pay && <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] ${pay.cls}`}>{pay.label}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Tab Content */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mt-4">
        <div className="p-6">
          {activeTab === 'personal' && (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-6">
              <Field label="Vorname" value={app.first_name} />
              <Field label="Nachname" value={app.last_name} />
              <Field label="Geburtsdatum" value={app.birthdate ? formatDate(app.birthdate) : null} />
              <Field label="Nationalität" value={app.nationality} />
              <Field label="Telefon" value={[app.phone_country_code, app.phone].filter(Boolean).join(' ') || null} />
              <Field label="E-Mail" value={app.email} />
              <Field label="Straße" value={app.street} />
              <Field label="PLZ / Stadt" value={[app.zip, app.city].filter(Boolean).join(' ') || null} />
              <Field label="Land" value={app.country} />
              <Field label="Wohnsituation" value={app.housing} />
              {app.passport_number && <Field label="Reisepass-Nr." value={app.passport_number} mono />}
              {app.passport_expiry && <Field label="Pass gültig bis" value={formatDate(app.passport_expiry)} />}
              {(app.company_name || app.type === 'business') && (
                <>
                  <div className="col-span-full border-t border-slate-100 pt-4 mt-2">
                    <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Unternehmen</p>
                  </div>
                  <Field label="Firmenname" value={app.company_name} />
                  <Field label="Rechtsform" value={app.legal_form} />
                  <Field label="Steuer-ID" value={app.tax_id} />
                  <Field label="Gegründet" value={app.established_year} />
                  <Field label="Branche" value={app.industry} />
                  <Field label="Geschäftstyp" value={app.business_type} />
                  <Field label="Jahresumsatz" value={app.annual_revenue != null ? formatCurrency(app.annual_revenue) : null} />
                  <Field label="Mitarbeiter" value={app.employees} />
                  <Field label="Ansprechpartner" value={app.contact_name} />
                  <Field label="Kontakt-Email" value={app.contact_email} />
                </>
              )}
            </div>
          )}

          {activeTab === 'finance' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-6">
                <Field label="Einkommen (netto)" value={app.income != null ? formatCurrency(app.income) : null} />
                <Field label="Miete" value={app.rent != null ? formatCurrency(app.rent) : null} />
                <Field label="Schulden" value={app.debts != null ? formatCurrency(app.debts) : null} />
                <Field label="Wunschlimit" value={app.wanted_limit != null ? formatCurrency(app.wanted_limit) : null} />
                <Field label="Genehmigtes Limit" value={app.approved_limit != null ? formatCurrency(app.approved_limit) : null} />
                <Field label="Beschäftigung" value={app.employment} />
                <Field label="Arbeitgeber" value={app.employer} />
                <Field label="Beschäftigt seit" value={app.employed_since} />
              </div>
              {app.expenses_food != null && (
                <div className="border-t border-slate-100 pt-5">
                  <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-4">Monatliche Ausgaben</p>
                  <div className="grid grid-cols-3 lg:grid-cols-6 gap-4">
                    {[['Lebensmittel', app.expenses_food], ['Mobilität', app.expenses_transport], ['Versicherungen', app.expenses_insurance], ['Kredite', app.expenses_loans], ['Abos', app.expenses_subscriptions], ['Sonstiges', app.expenses_other]].map(([l, v]) => (
                      <div key={String(l)} className="bg-slate-50 rounded-xl p-3 text-center">
                        <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{l}</div>
                        <div className="text-sm font-bold text-slate-700 mt-1">{v != null ? `€ ${v}` : '—'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'setup' && (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-6">
              <Field label="Paket" value={app.pack_name} />
              <Field label="Paket-Key" value={app.pack_key} />
              <Field label="Verwendungszweck" value={app.purpose} />
              <Field label="Abrechnung" value={app.billing} />
              <Field label="Zahlungsmethode" value={app.billing_method} />
              <Field label="Gehaltseingang" value={app.salary_receipt_day} />
              <Field label="Add-on" value={app.addon} />
              <Field label="NFC" value={app.nfc} />
              <div className="col-span-2"><Field label="IBAN" value={app.iban} mono /></div>
              <div className="col-span-2"><Field label="Stripe Customer" value={app.stripe_customer_id} mono /></div>
              <div className="col-span-2"><Field label="Stripe Subscription" value={app.stripe_subscription_id} mono /></div>
            </div>
          )}

          {activeTab === 'kyc' && (
            <div className="space-y-4">
              <KycRow label="Kontoauszug" available={!!(app.has_bank_statement_pdf ?? app.bank_statement_pdf)} downloadUrl={app.ref ? `/api/fiaon/admin/applications/${app.ref}/document/bank_statement` : undefined} />
              <KycRow label="Ausweisdokument" available={!!(app.has_id_card_pdf ?? app.id_card_pdf)} downloadUrl={app.ref ? `/api/fiaon/admin/applications/${app.ref}/document/id_card` : undefined} />
              <KycRow label="SCHUFA-Nachweis" available={!!(app.has_schufa_pdf ?? app.schufa_pdf)} downloadUrl={app.ref && (app.has_schufa_pdf ?? app.schufa_pdf) ? `/api/fiaon/admin/applications/${app.ref}/document/schufa` : undefined} schufaStatus={app.schufa_status} />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-4 border-t border-slate-100 mt-4">
                <Field label="Hochgeladen" value={app.documents_uploaded_at ? formatDateTime(app.documents_uploaded_at) : null} />
                <Field label="AGB" value={app.consent_agb ? 'Akzeptiert' : null} />
                <Field label="SCHUFA-Einwilligung" value={app.consent_schufa ? 'Akzeptiert' : null} />
                <Field label="Vertrag" value={app.consent_contract ? 'Akzeptiert' : null} />
              </div>
            </div>
          )}

          {activeTab === 'admin' && (
            <div className="space-y-6">
              <div className="flex gap-2 flex-wrap">
                <StatusBadge label="Dokumente" status={app.kyc_status === 'approved' ? 'approved' : app.kyc_status === 'changes_requested' ? 'warning' : 'pending'} text={app.kyc_status === 'approved' ? 'Genehmigt' : app.kyc_status === 'changes_requested' ? 'Änderung angefordert' : 'In Prüfung'} />
                <StatusBadge label="Konto" status={app.account_status === 'active' ? 'approved' : app.account_status === 'suspended' ? 'error' : 'pending'} text={app.account_status === 'active' ? 'Aktiv' : app.account_status === 'suspended' ? 'Gesperrt' : 'Ausstehend'} />
                {reviewSuccess && <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-slate-900 text-white">{reviewSuccess}</span>}
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => sendReview('approved', undefined, '')} disabled={reviewLoading} className="px-4 py-2.5 rounded-xl text-[13px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors">Dokumente genehmigen</button>
                <button onClick={() => sendReview(undefined, 'active', '')} disabled={reviewLoading} className="px-4 py-2.5 rounded-xl text-[13px] font-semibold bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-50 transition-colors">Konto aktivieren</button>
                <button onClick={() => sendReview(undefined, 'suspended', '')} disabled={reviewLoading} className="px-4 py-2.5 rounded-xl text-[13px] font-semibold bg-rose-100 text-rose-700 hover:bg-rose-200 disabled:opacity-50 transition-colors">Konto sperren</button>
              </div>
              <div className="space-y-3 p-5 bg-slate-50 rounded-2xl">
                <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500">Nachricht + Dokument neu anfordern</p>
                <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)} placeholder="z.B. Ihr Kontoauszug ist leider nicht lesbar…" rows={3} className="w-full text-[13px] border border-slate-200 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200 text-slate-700 bg-white" />
                <div className="flex gap-5">
                  <label className="flex items-center gap-2 cursor-pointer select-none"><input type="checkbox" checked={reuploadBank} onChange={e => setReuploadBank(e.target.checked)} className="w-4 h-4 accent-amber-500 rounded" /><span className="text-[13px] text-slate-700 font-medium">Kontoauszug</span></label>
                  <label className="flex items-center gap-2 cursor-pointer select-none"><input type="checkbox" checked={reuploadId} onChange={e => setReuploadId(e.target.checked)} className="w-4 h-4 accent-amber-500 rounded" /><span className="text-[13px] text-slate-700 font-medium">Ausweisdokument</span></label>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => sendReview('changes_requested', undefined)} disabled={reviewLoading || !reviewNote.trim() || (!reuploadBank && !reuploadId)} className="px-4 py-2.5 rounded-xl text-[13px] font-semibold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40 transition-colors">Änderung anfordern</button>
                  {app.admin_note && <button onClick={() => sendReview(undefined, undefined, '', false, false)} disabled={reviewLoading} className="px-4 py-2.5 rounded-xl text-[13px] font-semibold bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 transition-colors">Nachricht löschen</button>}
                </div>
                {app.admin_note && (
                  <div className="text-[12px] text-slate-500 bg-white border border-slate-200 rounded-xl px-4 py-3 space-y-0.5">
                    <p className="font-semibold text-slate-700">Aktive Nachricht:</p>
                    <p>„{app.admin_note}"</p>
                    <p className="text-slate-400">Angefordert: {[app.reupload_bank_statement && 'Kontoauszug', app.reupload_id_card && 'Ausweis'].filter(Boolean).join(', ') || '—'}</p>
                  </div>
                )}
              </div>
              <div className="space-y-3 p-5 bg-slate-50 rounded-2xl">
                <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500">Profil-Rückfrage an Kunde</p>
                <textarea value={profileNote} onChange={e => setProfileNote(e.target.value)} placeholder="z.B. Bitte ergänzen Sie Ihre Reisepassnummer…" rows={2} className="w-full text-[13px] border border-slate-200 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-amber-200 text-slate-700 bg-white" />
                <div className="flex gap-2">
                  <button onClick={sendProfileQuery} disabled={reviewLoading || !profileNote.trim()} className="px-4 py-2.5 rounded-xl text-[13px] font-semibold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40 transition-colors">Profil-Rückfrage senden</button>
                  {app.admin_profile_note && (
                    <button onClick={() => { fetch(`/api/fiaon/admin/applications/${app.ref}/review`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ adminProfileNote: '', profileChangesRequested: false }) }).then(r => r.ok && setApp({ ...app, admin_profile_note: null, profile_changes_requested: false })); }} className="px-4 py-2.5 rounded-xl text-[13px] font-semibold bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors">Rückfrage schließen</button>
                  )}
                </div>
                {app.admin_profile_note && (
                  <div className="text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    <p className="font-semibold mb-0.5">Aktive Rückfrage:</p>
                    <p>„{app.admin_profile_note}"</p>
                    <p className="text-amber-500 mt-0.5">{app.profile_changes_requested ? 'Ausstehend' : 'Beantwortet'}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'schufa' && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 flex-wrap">
                {(() => {
                  const has = !!(app.has_schufa_pdf ?? app.schufa_pdf);
                  const s = app.schufa_status;
                  if (!has) return <StatusBadge label="SCHUFA" status="pending" text="Nicht hochgeladen" />;
                  if (s === 'approved') return <StatusBadge label="SCHUFA" status="approved" text="Genehmigt" />;
                  if (s === 'requested') return <StatusBadge label="SCHUFA" status="warning" text="Neu angefordert" />;
                  if (s === 'rejected') return <StatusBadge label="SCHUFA" status="error" text="Abgelehnt" />;
                  return <StatusBadge label="SCHUFA" status="warning" text="Prüfung ausstehend" />;
                })()}
                {reviewSuccess && reviewSuccess.startsWith('SCHUFA') && <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-slate-900 text-white">{reviewSuccess}</span>}
              </div>
              {(app.has_schufa_pdf ?? app.schufa_pdf) && (
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => sendSchufaAction('approved', '')} disabled={reviewLoading || app.schufa_status === 'approved'} className="px-4 py-2.5 rounded-xl text-[13px] font-semibold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 transition-colors">SCHUFA genehmigen</button>
                  <button onClick={() => sendSchufaAction('rejected', '')} disabled={reviewLoading || app.schufa_status === 'rejected'} className="px-4 py-2.5 rounded-xl text-[13px] font-semibold bg-rose-100 text-rose-700 hover:bg-rose-200 disabled:opacity-40 transition-colors">SCHUFA ablehnen</button>
                  {app.schufa_status === 'approved' && <button onClick={() => sendSchufaAction('pending', '')} disabled={reviewLoading} className="px-4 py-2.5 rounded-xl text-[13px] font-semibold bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors">Zurücksetzen</button>}
                </div>
              )}
              <div className="space-y-3 p-5 bg-slate-50 rounded-2xl">
                <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500">Nachricht an Kunde (SCHUFA)</p>
                <textarea value={schufaNote} onChange={e => setSchufaNote(e.target.value)} placeholder="z.B. Ihre SCHUFA-Auskunft ist nicht lesbar…" rows={2} className="w-full text-[13px] border border-slate-200 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-amber-200 text-slate-700 bg-white" />
                <div className="flex gap-2">
                  <button onClick={() => sendSchufaAction('requested', schufaNote.trim())} disabled={reviewLoading || !schufaNote.trim()} className="px-4 py-2.5 rounded-xl text-[13px] font-semibold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40 transition-colors">Neues Dokument anfordern</button>
                  {app.admin_schufa_note && <button onClick={() => sendSchufaAction(app.schufa_status || 'pending', '')} disabled={reviewLoading} className="px-4 py-2.5 rounded-xl text-[13px] font-semibold bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors">Nachricht löschen</button>}
                </div>
                {app.admin_schufa_note && (
                  <div className="text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    <p className="font-semibold mb-0.5">Aktive SCHUFA-Nachricht:</p>
                    <p>„{app.admin_schufa_note}"</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'transactions' && (
            <div className="space-y-4">
              {txLoading ? (
                <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-slate-50 animate-pulse" />)}</div>
              ) : transactions.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-[13px] text-slate-500 font-medium">{app.stripe_customer_id ? 'Keine Transaktionen gefunden' : 'Kein Stripe-Kunde verknüpft'}</p>
                  {app.stripe_customer_id && <p className="text-[11px] text-slate-400 mt-1 font-mono">{app.stripe_customer_id}</p>}
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                      <p className="text-[10px] font-bold text-emerald-600 uppercase">Erfolgreich</p>
                      <p className="text-lg font-bold text-emerald-800">{transactions.filter(t => t.status === 'succeeded').length}x</p>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                      <p className="text-[10px] font-bold text-emerald-600 uppercase">Gesamt bezahlt</p>
                      <p className="text-lg font-bold text-emerald-800">{formatCurrency(transactions.filter(t => t.status === 'succeeded').reduce((s, t) => s + t.amount, 0))}</p>
                    </div>
                    {transactions.some(t => t.status === 'failed') && (
                      <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
                        <p className="text-[10px] font-bold text-rose-600 uppercase">Fehlgeschlagen</p>
                        <p className="text-lg font-bold text-rose-800">{transactions.filter(t => t.status === 'failed').length}x</p>
                      </div>
                    )}
                    {app.stripe_customer_id && <p className="text-[11px] font-mono text-slate-400">Stripe: {app.stripe_customer_id}</p>}
                  </div>
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                    {transactions.map(tx => (
                      <div key={tx.id} className={`flex items-center justify-between px-4 py-3 ${tx.status === 'failed' ? 'bg-rose-50/50' : ''}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tx.status === 'succeeded' ? 'bg-emerald-100 text-emerald-600' : tx.status === 'failed' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
                            {tx.status === 'succeeded' ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> : tx.status === 'failed' ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> : <span className="text-[10px] font-bold">?</span>}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-slate-800">{formatCurrency(tx.amount)}{tx.refunded ? ' (erstattet)' : ''}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-[11px] text-slate-400">{formatDateTime(tx.created)}</p>
                              {tx.paymentMethod && <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{tx.paymentMethod}</span>}
                              {tx.failureMessage && <span className="text-[10px] text-rose-600 font-medium">{tx.failureMessage}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${tx.status === 'succeeded' ? 'bg-emerald-50 text-emerald-700' : tx.status === 'failed' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>
                            {tx.status === 'succeeded' ? 'Bezahlt' : tx.status === 'failed' ? 'Fehlgeschlagen' : tx.status}
                          </span>
                          {tx.receiptUrl && <a href={tx.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-600 hover:underline">Beleg</a>}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'meta' && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-6">
              <Field label="Typ" value={app.type} />
              <Field label="Step" value={app.current_step} />
              <Field label="Erstellt" value={formatDateTime(app.created_at)} />
              <Field label="Aktualisiert" value={formatDateTime(app.updated_at)} />
              <Field label="Eingereicht" value={app.submitted_at ? formatDateTime(app.submitted_at) : null} />
              <Field label="Abgeschlossen" value={app.completed_at ? formatDateTime(app.completed_at) : null} />
              <div className="col-span-2"><Field label="IP-Adresse" value={app.ip} mono /></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
