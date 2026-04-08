/**
 * ============================================================================
 * ARAS CLIENT PORTAL - PDF Report Page (Print-to-PDF)
 * ============================================================================
 * STEP 7: Print-optimized report page with window.print()
 * No new dependencies - uses inline print styles
 * ============================================================================
 */

import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer, Loader2 } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface ReportData {
  generatedAt: string;
  range: string;
  maskedExportLabel?: string;
  company: {
    name: string;
    ceo: string;
    email: string;
    addressLine: string;
    zipCity: string;
    vatId: string;
  };
  package: {
    includedCalls: number;
    label: string;
    notes: string;
  };
  totals: {
    total: number;
    completed: number;
    failed: number;
    avgDurationSec: number;
    analyzedCount: number;
    highSignalCount: number;
  };
  // STEP 27: Executive Summary
  execSummary?: {
    rangeLabel: string;
    totals: {
      total: number;
      completed: number;
      failed: number;
      avgDurationSec: number;
      analyzedCount: number;
      highSignalCount: number;
    };
    pipeline: {
      appointments: number;
      callbacks: number;
      followUps: number;
    };
    forecast: {
      remainingCalls: number;
      avgCallsPerDay: number;
      daysToDepletion: number | null;
      projectedDepletionDate: string | null;
    };
    topNextActions: Array<{
      contactName: string;
      phoneMasked: string;
      nextBestAction: string | null;
      successChance: number;
      signalScore: number | null;
    }>;
  };
  calls: Array<{
    createdAt: string;
    phoneNumberMasked: string;
    contactName: string;
    status: string;
    durationSec: number;
    signalScore: number | null;
    nextBestAction: string | null;
  }>;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('de-DE', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDuration(seconds: number): string {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getRangeLabel(range: string): string {
  if (range === '14d') return 'Letzte 14 Tage';
  if (range === '30d') return 'Letzte 30 Tage';
  return 'Alle Zeiträume';
}

// ============================================================================
// PRINT STYLES (inline, no global CSS)
// ============================================================================

const printStyles = `
  @media print {
    body {
      background: white !important;
      color: #111 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 11px !important;
      line-height: 1.4 !important;
    }
    .no-print {
      display: none !important;
    }
    .print-container {
      background: white !important;
      color: #111 !important;
      padding: 0 !important;
      max-width: 100% !important;
    }
    .print-header {
      border-bottom: 2px solid #333 !important;
      padding-bottom: 12px !important;
      margin-bottom: 16px !important;
    }
    .print-section {
      page-break-inside: avoid;
      margin-bottom: 16px !important;
    }
    .print-table {
      width: 100% !important;
      border-collapse: collapse !important;
    }
    .print-table th,
    .print-table td {
      border: 1px solid #ccc !important;
      padding: 6px 8px !important;
      text-align: left !important;
      font-size: 10px !important;
    }
    .print-table th {
      background: #f5f5f5 !important;
      font-weight: 600 !important;
    }
    .print-table tr:nth-child(even) {
      background: #fafafa !important;
    }
  }
`;

// ============================================================================
// REPORT PAGE COMPONENT
// ============================================================================

export default function PortalReport() {
  const { portalKey } = useParams<{ portalKey: string }>();
  const [, setLocation] = useLocation();
  
  // Get query params from URL
  const searchParams = new URLSearchParams(window.location.search);
  const range = searchParams.get('range') || '14d';
  const status = searchParams.get('status') || '';
  const highSignal = searchParams.get('highSignal') || '';
  const analyzed = searchParams.get('analyzed') || '';
  const q = searchParams.get('q') || '';
  
  // Build query string
  const queryString = new URLSearchParams({
    range,
    ...(status && { status }),
    ...(highSignal && { highSignal }),
    ...(analyzed && { analyzed }),
    ...(q && { q })
  }).toString();
  
  // Fetch report data
  const { data: report, isLoading, error } = useQuery<ReportData>({
    queryKey: ['portal-report', portalKey, queryString],
    queryFn: async () => {
      const res = await fetch(`/api/portal/calls/report?${queryString}`, {
        credentials: 'include'
      });
      if (res.status === 401) {
        setLocation(`/portal/${portalKey}/login`);
        throw new Error('UNAUTHORIZED');
      }
      if (!res.ok) throw new Error('Failed to fetch report');
      return res.json();
    },
    retry: false
  });
  
  const handlePrint = () => {
    window.print();
  };
  
  const handleBack = () => {
    // Preserve filters when going back
    const backParams = new URLSearchParams();
    if (status) backParams.set('status', status);
    if (highSignal) backParams.set('highSignal', highSignal);
    if (q) backParams.set('q', q);
    const backQuery = backParams.toString();
    setLocation(`/portal/${portalKey}${backQuery ? '?' + backQuery : ''}`);
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black/40">
        <Loader2 className="w-10 h-10 text-[#FE9100] animate-spin" />
      </div>
    );
  }
  
  if (error || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black/40">
        <div className="text-center">
          <p className="text-white/60 mb-4">Report konnte nicht geladen werden.</p>
          <button
            onClick={handleBack}
            className="px-4 py-2 rounded-lg bg-[#FE9100] text-white font-medium"
          >
            Zurück zum Dashboard
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <>
      {/* Inject print styles */}
      <style>{printStyles}</style>
      
      {/* Screen UI (hidden on print) */}
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-black/90 border-b border-white/10 backdrop-blur-xl">
        <div className="max-w-[900px] mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Zurück</span>
          </button>
          
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FE9100] text-white font-medium hover:bg-[#FF6B00] transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Als PDF speichern</span>
          </button>
        </div>
      </div>
      
      {/* Report Content */}
      <div 
        className="print-container min-h-screen bg-black/40 pt-20"
        style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}
      >
        {/* Header */}
        <div className="print-header mb-8 pb-6 border-b border-white/10">
          <h1 
            className="text-2xl font-bold text-white mb-2"
            style={{ fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.06em' }}
          >
            {report.company.name}
          </h1>
          <p className="text-white/60 text-sm">
            Call Intelligence Report · {getRangeLabel(report.range)}
          </p>
          <p className="text-white/40 text-xs mt-1">
            Erstellt am {formatDate(report.generatedAt)}
          </p>
        </div>
        
        {/* STEP 27: Executive Summary Section */}
        {report.execSummary && (
          <div className="print-section mb-8 p-6 rounded-2xl" style={{ background: 'rgba(254,145,0,0.05)', border: '1px solid rgba(254,145,0,0.15)' }}>
            <h2 className="text-lg font-bold text-white mb-4" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              Executive Summary
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: KPI blocks */}
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-white/5 text-center">
                    <div className="text-xl font-bold text-white">{report.execSummary.totals.total}</div>
                    <div className="text-[10px] text-white/50">Gesamt</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 text-center">
                    <div className="text-xl font-bold text-green-400">{report.execSummary.totals.completed}</div>
                    <div className="text-[10px] text-white/50">Completed</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 text-center">
                    <div className="text-xl font-bold text-red-400">{report.execSummary.totals.failed}</div>
                    <div className="text-[10px] text-white/50">Failed</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-white/5 text-center">
                    <div className="text-xl font-bold text-[#FE9100]">{report.execSummary.totals.highSignalCount}</div>
                    <div className="text-[10px] text-white/50">High Signal</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 text-center">
                    <div className="text-xl font-bold text-blue-400">{report.execSummary.pipeline.appointments}</div>
                    <div className="text-[10px] text-white/50">Appointments</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 text-center">
                    <div className="text-xl font-bold text-purple-400">{report.execSummary.pipeline.callbacks}</div>
                    <div className="text-[10px] text-white/50">Callbacks</div>
                  </div>
                </div>
                
                {/* Forecast Risk Badge */}
                {report.execSummary.forecast.daysToDepletion !== null && (
                  <div className="p-3 rounded-xl" style={{ 
                    background: report.execSummary.forecast.daysToDepletion < 14 ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                    border: report.execSummary.forecast.daysToDepletion < 14 ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(34,197,94,0.2)'
                  }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/60">Quota Forecast</span>
                      <span className={`text-sm font-bold ${report.execSummary.forecast.daysToDepletion < 14 ? 'text-red-400' : 'text-green-400'}`}>
                        {report.execSummary.forecast.daysToDepletion} Tage
                      </span>
                    </div>
                    <div className="text-[10px] text-white/40 mt-1">
                      {report.execSummary.forecast.remainingCalls} Calls verbleibend · {report.execSummary.forecast.avgCallsPerDay}/Tag
                    </div>
                  </div>
                )}
              </div>
              
              {/* Right: Top 5 Next Actions */}
              <div>
                <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">
                  Top Next Actions
                </h4>
                {report.execSummary.topNextActions.length > 0 ? (
                  <ul className="space-y-2">
                    {report.execSummary.topNextActions.map((action, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#FE9100]/20 text-[#FE9100] text-xs flex items-center justify-center font-bold">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-white/80 font-medium truncate">
                            {action.contactName} · {action.phoneMasked}
                          </div>
                          {action.nextBestAction && (
                            <p className="text-white/50 text-xs line-clamp-2">{action.nextBestAction}</p>
                          )}
                        </div>
                        {action.successChance > 0 && (
                          <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold" style={{
                            background: action.successChance >= 70 ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)',
                            color: action.successChance >= 70 ? '#22c55e' : '#eab308'
                          }}>
                            {action.successChance}%
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-white/40 text-sm">Keine priorisierten Next Actions.</p>
                )}
              </div>
            </div>
            
            {/* Share-safe disclaimer */}
            <p className="text-[10px] text-white/30 mt-4 pt-3 border-t border-white/5">
              Dieser Report enthält ausschließlich maskierte Daten.
            </p>
          </div>
        )}
        
        {/* Company + Package Grid */}
        <div className="print-section grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Company Block */}
          <div 
            className="p-5 rounded-2xl"
            style={{ background: 'rgba(20,20,20,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
              Unternehmen
            </h3>
            <div className="space-y-2 text-sm">
              <p className="text-white font-medium">{report.company.name}</p>
              <p className="text-white/70">GF: {report.company.ceo}</p>
              <p className="text-white/70">{report.company.addressLine}</p>
              <p className="text-white/70">{report.company.zipCity}</p>
              <p className="text-white/50 text-xs">USt-ID: {report.company.vatId}</p>
            </div>
          </div>
          
          {/* Package Block */}
          <div 
            className="p-5 rounded-2xl"
            style={{ background: 'rgba(254,145,0,0.08)', border: '1px solid rgba(254,145,0,0.2)' }}
          >
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
              Call-Paket
            </h3>
            <div className="space-y-2 text-sm">
              <p className="text-white font-medium">{report.package.label}</p>
              <p className="text-white/70">Inklusiv: {report.package.includedCalls.toLocaleString()} Calls</p>
              <p className="text-white/50 text-xs">{report.package.notes}</p>
            </div>
          </div>
        </div>
        
        {/* Insights Block */}
        <div className="print-section mb-8">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">
            Zusammenfassung ({getRangeLabel(report.range)})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="p-4 rounded-xl bg-white/5 text-center">
              <div className="text-2xl font-bold text-white">{report.totals.total}</div>
              <div className="text-xs text-white/50">Gesamt</div>
            </div>
            <div className="p-4 rounded-xl bg-white/5 text-center">
              <div className="text-2xl font-bold text-green-400">{report.totals.completed}</div>
              <div className="text-xs text-white/50">Completed</div>
            </div>
            <div className="p-4 rounded-xl bg-white/5 text-center">
              <div className="text-2xl font-bold text-red-400">{report.totals.failed}</div>
              <div className="text-xs text-white/50">Failed</div>
            </div>
            <div className="p-4 rounded-xl bg-white/5 text-center">
              <div className="text-2xl font-bold text-white">{formatDuration(report.totals.avgDurationSec)}</div>
              <div className="text-xs text-white/50">Ø Dauer</div>
            </div>
            <div className="p-4 rounded-xl bg-white/5 text-center">
              <div className="text-2xl font-bold text-[#FE9100]">{report.totals.analyzedCount}</div>
              <div className="text-xs text-white/50">Analysiert</div>
            </div>
            <div className="p-4 rounded-xl bg-white/5 text-center">
              <div className="text-2xl font-bold text-[#FE9100]">{report.totals.highSignalCount}</div>
              <div className="text-xs text-white/50">High Signal</div>
            </div>
          </div>
        </div>
        
        {/* Calls Table */}
        <div className="print-section">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">
            Calls ({report.calls.length} von max. 200)
          </h3>
          <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            <table className="print-table w-full text-sm">
              <thead>
                <tr className="bg-white/5">
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase">Datum</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase">Kontakt</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase">Telefon</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase">Dauer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase">Signal</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase">Nächster Schritt</th>
                </tr>
              </thead>
              <tbody>
                {report.calls.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-white/40">
                      Keine Calls im ausgewählten Zeitraum.
                    </td>
                  </tr>
                ) : (
                  report.calls.map((call, idx) => (
                    <tr 
                      key={idx} 
                      className="border-t border-white/5"
                      style={{ background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}
                    >
                      <td className="px-4 py-3 text-white/70 whitespace-nowrap">
                        {formatDate(call.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-white/90">
                        {call.contactName || '—'}
                      </td>
                      <td className="px-4 py-3 text-white/70 font-mono text-xs">
                        {call.phoneNumberMasked}
                      </td>
                      <td className="px-4 py-3">
                        <span 
                          className="px-2 py-0.5 rounded text-xs font-medium"
                          style={{
                            background: call.status === 'completed' ? 'rgba(34,197,94,0.15)' : 
                                       call.status === 'failed' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.1)',
                            color: call.status === 'completed' ? '#22c55e' : 
                                   call.status === 'failed' ? '#ef4444' : '#9ca3af'
                          }}
                        >
                          {call.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/70">
                        {formatDuration(call.durationSec)}
                      </td>
                      <td className="px-4 py-3">
                        {call.signalScore !== null ? (
                          <span 
                            className="px-2 py-0.5 rounded text-xs font-bold"
                            style={{
                              background: call.signalScore >= 70 ? 'rgba(254,145,0,0.15)' : 'rgba(255,255,255,0.1)',
                              color: call.signalScore >= 70 ? '#FE9100' : '#9ca3af'
                            }}
                          >
                            {call.signalScore}
                          </span>
                        ) : (
                          <span className="text-white/30">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-white/60 text-xs max-w-[200px] truncate">
                        {call.nextBestAction || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Footer */}
        <div className="print-section mt-8 pt-6 border-t border-white/10 text-center">
          <p className="text-white/30 text-xs">
            Dieser Report wurde automatisch generiert. Daten gemäß DSGVO verarbeitet.
          </p>
        </div>
      </div>
    </>
  );
}
