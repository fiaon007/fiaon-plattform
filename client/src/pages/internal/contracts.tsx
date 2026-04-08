/**
 * ============================================================================
 * ARAS COMMAND CENTER - INTERNAL CONTRACTS PAGE
 * ============================================================================
 * Staff view for viewing assigned contracts and approval flow
 * Premium PDF viewer with typed signature approval
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useRoute } from 'wouter';
import { 
  FileText, CheckCircle, Clock, AlertCircle, 
  ArrowLeft, ExternalLink, Loader2
} from 'lucide-react';
import InternalLayout from '@/components/internal/internal-layout';
import { apiGet, apiPost } from '@/lib/api';

// Types
interface Contract {
  id: string;
  title: string;
  filename: string;
  assignedUserId: string;
  assignedUsername?: string;
  uploadedBy: string;
  uploadedByName?: string;
  status: 'uploaded' | 'pending_approval' | 'approved';
  approval?: {
    userId: string;
    username: string;
    typedSignature: string;
    approvedAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

// Design tokens
const DT = {
  orange: '#ff6a00',
  gold: '#e9d7c4',
  panelBg: 'rgba(255,255,255,0.03)',
  panelBorder: 'rgba(255,255,255,0.08)',
};

// Status badge
function StatusBadge({ status }: { status: Contract['status'] }) {
  const config = {
    uploaded: { label: 'Hochgeladen', bg: 'rgba(107,114,128,0.2)', color: '#9CA3AF', icon: Clock },
    pending_approval: { label: 'Freigabe ausstehend', bg: 'rgba(251,191,36,0.15)', color: '#FBBF24', icon: Clock },
    approved: { label: 'Freigegeben', bg: 'rgba(34,197,94,0.15)', color: '#22C55E', icon: CheckCircle },
  };
  const c = config[status];
  const Icon = c.icon;
  
  return (
    <span 
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
      style={{ background: c.bg, color: c.color }}
    >
      <Icon className="w-3.5 h-3.5" />
      {c.label}
    </span>
  );
}

// List View
function ContractsList() {
  const [, setLocation] = useLocation();
  const urlParams = new URLSearchParams(window.location.search);
  const highlightId = urlParams.get('contractId');

  const { data: contracts = [], isLoading, error } = useQuery<Contract[]>({
    queryKey: ['internal-contracts'],
    queryFn: async () => {
      const result = await apiGet<Contract[]>('/api/internal/contracts');
      if (!result.ok) throw result.error;
      return result.data || [];
    },
  });

  // Auto-navigate to highlighted contract
  useEffect(() => {
    if (highlightId && contracts.find(c => c.id === highlightId)) {
      setLocation(`/internal/contracts/${highlightId}`);
    }
  }, [highlightId, contracts, setLocation]);

  if (isLoading) {
    return (
      <div className="text-center py-16">
        <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mx-auto" />
        <p className="text-gray-400 mt-4 text-sm">Lade Verträge...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <p className="text-red-400">Fehler beim Laden der Verträge</p>
      </div>
    );
  }

  if (contracts.length === 0) {
    return (
      <div className="text-center py-20">
        <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400 text-lg">Keine Verträge zugewiesen</p>
        <p className="text-gray-500 text-sm mt-2">
          Sobald dir ein Vertrag zugewiesen wird, erscheint er hier.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {contracts.map((contract, index) => (
        <motion.button
          key={contract.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          onClick={() => setLocation(`/internal/contracts/${contract.id}`)}
          className="w-full text-left rounded-2xl border p-5 transition-all hover:border-orange-500/30"
          style={{
            background: DT.panelBg,
            borderColor: DT.panelBorder,
          }}
        >
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div 
              className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(255,106,0,0.1)' }}
            >
              <FileText className="w-7 h-7" style={{ color: DT.orange }} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-white font-medium text-lg">{contract.title}</h3>
                  <p className="text-gray-500 text-sm mt-1">{contract.filename}</p>
                </div>
                <StatusBadge status={contract.status} />
              </div>

              <div className="flex items-center gap-6 mt-3 text-xs text-gray-500">
                <span>Von: {contract.uploadedByName || 'Admin'}</span>
                <span>{new Date(contract.createdAt).toLocaleDateString('de-DE')}</span>
              </div>

              {contract.status === 'pending_approval' && (
                <div className="mt-3 pt-3 border-t border-white/5">
                  <span 
                    className="text-xs font-medium"
                    style={{ color: DT.orange }}
                  >
                    → Bitte prüfen und freigeben
                  </span>
                </div>
              )}
            </div>
          </div>
        </motion.button>
      ))}
    </div>
  );
}

// Detail View with PDF and Approval
function ContractDetail({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [typedSignature, setTypedSignature] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');

  const { data: contract, isLoading } = useQuery({
    queryKey: ['internal-contract', id],
    queryFn: async (): Promise<Contract> => {
      const result = await apiGet<Contract>(`/api/internal/contracts/${id}`);
      if (!result.ok) throw result.error;
      if (!result.data) throw new Error('Contract not found');
      return result.data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const result = await apiPost(`/api/internal/contracts/${id}/approve`, {
          typedSignature,
          confirm: confirmed,
        });
      if (!result.ok) throw new Error(result.error?.message || 'Approval failed');
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-contract', id] });
      queryClient.invalidateQueries({ queryKey: ['internal-contracts'] });
    },
    onError: (err: any) => {
      setError(err.message);
    },
  });

  const handleApprove = () => {
    setError('');
    
    // Validate
    if (typedSignature.length < 6) {
      setError('Name muss mindestens 6 Zeichen haben');
      return;
    }
    if (typedSignature !== typedSignature.toUpperCase()) {
      setError('Name muss in GROSSBUCHSTABEN sein');
      return;
    }
    if (!confirmed) {
      setError('Bitte bestätige, dass du den Vertrag gelesen hast');
      return;
    }

    approveMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="text-center py-16">
        <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <p className="text-red-400">Vertrag nicht gefunden</p>
        <button
          onClick={() => setLocation('/internal/contracts')}
          className="mt-4 text-orange-400 hover:text-orange-300"
        >
          ← Zurück zur Übersicht
        </button>
      </div>
    );
  }

  const isApproved = contract.status === 'approved';

  return (
    <div className="max-w-5xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => setLocation('/internal/contracts')}
        className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-all"
      >
        <ArrowLeft className="w-4 h-4" />
        Zurück zur Übersicht
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">{contract.title}</h1>
          <p className="text-gray-500 mt-1">{contract.filename}</p>
        </div>
        <StatusBadge status={contract.status} />
      </div>

      {/* PDF Viewer */}
      <div 
        className="rounded-2xl border overflow-hidden mb-6"
        style={{ borderColor: DT.panelBorder }}
      >
        <div className="bg-gray-900/50 px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: DT.panelBorder }}>
          <span className="text-sm text-gray-400">PDF Vorschau</span>
          <a
            href={`/api/internal/contracts/${id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            In neuem Tab öffnen
          </a>
        </div>
        <iframe
          src={`/api/internal/contracts/${id}/pdf`}
          className="w-full bg-white"
          style={{ height: '60vh', minHeight: '400px' }}
          title="Contract PDF"
        />
      </div>

      {/* Approval Panel */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border p-6"
        style={{
          background: isApproved ? 'rgba(34,197,94,0.05)' : DT.panelBg,
          borderColor: isApproved ? 'rgba(34,197,94,0.2)' : DT.panelBorder,
        }}
      >
        {isApproved ? (
          // Approved state
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h3 className="text-white font-medium">Vertrag freigegeben</h3>
                <p className="text-gray-500 text-sm">Compliance wurde benachrichtigt</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-4 p-4 rounded-xl bg-white/5">
              <div>
                <p className="text-xs text-gray-500">Signatur</p>
                <p className="text-white font-mono mt-1">{contract.approval?.typedSignature}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Datum</p>
                <p className="text-white mt-1">
                  {contract.approval?.approvedAt 
                    ? new Date(contract.approval.approvedAt).toLocaleString('de-DE')
                    : '-'
                  }
                </p>
              </div>
            </div>
          </div>
        ) : (
          // Approval form
          <div>
            <h3 className="text-white font-medium mb-1">Vertrag freigeben</h3>
            <p className="text-gray-500 text-sm mb-6">
              Bitte lies den Vertrag sorgfältig und gib ihn mit deiner Signatur frei.
            </p>

            {/* Username (read-only) */}
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1.5">Benutzername</label>
              <input
                type="text"
                value={contract.assignedUsername || ''}
                disabled
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 cursor-not-allowed"
              />
            </div>

            {/* Typed Signature */}
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1.5">
                Dein vollständiger Name in GROSSBUCHSTABEN
              </label>
              <input
                type="text"
                value={typedSignature}
                onChange={(e) => setTypedSignature(e.target.value.toUpperCase())}
                placeholder="VORNAME NACHNAME"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500/50 font-mono text-lg tracking-wide"
                style={{ textTransform: 'uppercase' }}
              />
              <p className="text-[10px] text-gray-600 mt-1.5">
                Mind. 6 Zeichen, nur Großbuchstaben
              </p>
            </div>

            {/* Confirm checkbox */}
            <label className="flex items-start gap-3 mb-6 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 w-5 h-5 rounded border-gray-600 bg-white/5 text-orange-500 focus:ring-orange-500/50 focus:ring-offset-0"
              />
              <span className="text-sm text-gray-300">
                Ich bestätige, dass ich den Vertrag vollständig gelesen habe und ihm zustimme.
              </span>
            </label>

            {/* Error */}
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Submit button */}
            <button
              onClick={handleApprove}
              disabled={approveMutation.isPending || !typedSignature || !confirmed}
              className="w-full py-3.5 rounded-xl font-medium text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              style={{
                background: `linear-gradient(135deg, ${DT.orange} 0%, #ff8c3a 100%)`,
              }}
            >
              {approveMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Wird freigegeben...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Vertrag freigeben
                </>
              )}
            </button>

            <p className="text-[10px] text-gray-600 text-center mt-3">
              Nach der Freigabe wird automatisch eine Compliance-Benachrichtigung gesendet.
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// Main Page Component
export default function InternalContractsPage() {
  const [matchList] = useRoute('/internal/contracts');
  const [matchDetail, params] = useRoute('/internal/contracts/:id');

  return (
    <InternalLayout>
      <div className="p-8">
        {/* Header - only show on list view */}
        {matchList && !matchDetail && (
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              Meine Verträge
            </h1>
            <p className="text-gray-400 mt-1">Verträge prüfen und freigeben</p>
          </div>
        )}

        {/* Content */}
        {matchDetail && params?.id ? (
          <ContractDetail id={params.id} />
        ) : (
          <ContractsList />
        )}
      </div>
    </InternalLayout>
  );
}
