/**
 * ============================================================================
 * ARAS COMMAND CENTER - ADMIN CONTRACTS PAGE
 * ============================================================================
 * Admin view for managing contracts: upload, view status, manage
 * ============================================================================
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'wouter';
import { 
  FileText, Upload, Trash2, Eye, CheckCircle, Clock, 
  AlertCircle, X, User, Calendar, Download
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { apiGet, apiDelete, apiPostFormData } from '@/lib/api';

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

interface StaffUser {
  id: string;
  username: string;
  email: string;
  userRole: string;
}

// Design tokens
const DT = {
  orange: '#ff6a00',
  gold: '#e9d7c4',
  panelBg: 'rgba(255,255,255,0.03)',
  panelBorder: 'rgba(255,255,255,0.08)',
};

// Status badge component
function StatusBadge({ status }: { status: Contract['status'] }) {
  const config = {
    uploaded: { label: 'Uploaded', bg: 'rgba(107,114,128,0.2)', color: '#9CA3AF' },
    pending_approval: { label: 'Pending', bg: 'rgba(251,191,36,0.15)', color: '#FBBF24' },
    approved: { label: 'Approved', bg: 'rgba(34,197,94,0.15)', color: '#22C55E' },
  };
  const c = config[status];
  
  return (
    <span 
      className="px-2 py-1 rounded-full text-[10px] font-medium uppercase tracking-wide"
      style={{ background: c.bg, color: c.color }}
    >
      {c.label}
    </span>
  );
}

export default function AdminContractsPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  
  // URL params for deep linking
  const urlParams = new URLSearchParams(window.location.search);
  const highlightId = urlParams.get('contractId');

  // Fetch contracts
  const { data: contracts = [], isLoading, error } = useQuery<Contract[]>({
    queryKey: ['admin-contracts'],
    queryFn: async () => {
      const result = await apiGet<Contract[]>('/api/admin/contracts');
      if (!result.ok) throw result.error;
      return result.data || [];
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await apiDelete(`/api/admin/contracts/${id}`);
      if (!result.ok) throw new Error(result.error?.message || 'Failed to delete');
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-contracts'] });
    },
  });

  const handleDelete = (contract: Contract) => {
    if (confirm(`Delete contract "${contract.title}"?`)) {
      deleteMutation.mutate(contract.id);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              Contract Manager
            </h1>
            <p className="text-gray-400 mt-1">Verwalte Verträge und Freigaben</p>
          </div>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{
              background: `linear-gradient(135deg, ${DT.orange} 0%, #ff8c3a 100%)`,
              color: 'white',
            }}
          >
            <Upload className="w-4 h-4" />
            Vertrag hochladen
          </button>
        </div>
      </div>

      {/* Contracts List */}
      <div className="max-w-6xl mx-auto">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mx-auto" />
            <p className="text-gray-400 mt-4 text-sm">Lade Verträge...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-red-400">Fehler beim Laden der Verträge</p>
          </div>
        ) : contracts.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">Noch keine Verträge</p>
            <p className="text-gray-500 text-sm mt-2">Lade den ersten Vertrag hoch</p>
          </div>
        ) : (
          <div className="space-y-3">
            {contracts.map((contract, index) => (
              <motion.div
                key={contract.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`
                  rounded-2xl border p-4 transition-all cursor-pointer
                  ${highlightId === contract.id ? 'ring-2 ring-orange-500/50' : ''}
                `}
                style={{
                  background: DT.panelBg,
                  borderColor: highlightId === contract.id ? DT.orange : DT.panelBorder,
                }}
                onClick={() => setSelectedContract(contract)}
              >
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(255,106,0,0.1)' }}
                  >
                    <FileText className="w-6 h-6" style={{ color: DT.orange }} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="text-white font-medium truncate">{contract.title}</h3>
                      <StatusBadge status={contract.status} />
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {contract.assignedUsername || 'Unknown'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(contract.createdAt).toLocaleDateString('de-DE')}
                      </span>
                      <span className="truncate">{contract.filename}</span>
                    </div>
                  </div>

                  {/* Approval info */}
                  {contract.approval && (
                    <div className="text-right text-xs">
                      <div className="flex items-center gap-1 text-green-400">
                        <CheckCircle className="w-3 h-3" />
                        Freigegeben
                      </div>
                      <div className="text-gray-500 mt-1">
                        {new Date(contract.approval.approvedAt).toLocaleDateString('de-DE')}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <a
                      href={`/api/admin/contracts/${contract.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-all"
                      title="PDF anzeigen"
                    >
                      <Eye className="w-4 h-4" />
                    </a>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(contract);
                      }}
                      disabled={deleteMutation.isPending}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-all"
                      title="Löschen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <UploadModal onClose={() => setShowUploadModal(false)} />
        )}
      </AnimatePresence>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedContract && (
          <ContractDetailModal 
            contract={selectedContract} 
            onClose={() => setSelectedContract(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Upload Modal Component
function UploadModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [assignedUserId, setAssignedUserId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // Fetch staff users
  const { data: staffUsers = [] } = useQuery<StaffUser[]>({
    queryKey: ['admin-staff-users'],
    queryFn: async () => {
      const result = await apiGet<StaffUser[]>('/api/admin/contracts/users/staff');
      if (!result.ok) return [];
      return result.data || [];
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      if (!title) {
        setTitle(acceptedFiles[0].name.replace('.pdf', ''));
      }
    }
  }, [title]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024,
  });

  const handleUpload = async () => {
    if (!file || !title || !assignedUserId) {
      setError('Bitte fülle alle Felder aus');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('pdf', file);
      formData.append('title', title);
      formData.append('assignedUserId', assignedUserId);

      const result = await apiPostFormData('/api/admin/contracts', formData);

      if (!result.ok) {
        throw new Error(result.error?.message || 'Upload fehlgeschlagen');
      }

      queryClient.invalidateQueries({ queryKey: ['admin-contracts'] });
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg"
      >
        <div 
          className="rounded-3xl border p-6"
          style={{
            background: 'rgba(15,15,20,0.95)',
            borderColor: DT.panelBorder,
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Vertrag hochladen</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all
              ${isDragActive ? 'border-orange-500 bg-orange-500/5' : 'border-gray-700 hover:border-gray-600'}
            `}
          >
            <input {...getInputProps()} />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="w-8 h-8 text-orange-400" />
                <span className="text-white">{file.name}</span>
              </div>
            ) : (
              <>
                <Upload className="w-10 h-10 text-gray-500 mx-auto mb-3" />
                <p className="text-gray-400">
                  {isDragActive ? 'PDF hier ablegen' : 'PDF hierher ziehen oder klicken'}
                </p>
                <p className="text-gray-600 text-xs mt-2">Max. 20MB</p>
              </>
            )}
          </div>

          {/* Form */}
          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Titel</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Vertragstitel"
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:border-orange-500/50"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Zuweisen an</label>
              <select
                value={assignedUserId}
                onChange={(e) => setAssignedUserId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-orange-500/50"
              >
                <option value="">Benutzer auswählen...</option>
                {staffUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.username} ({user.email})
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            <button
              onClick={handleUpload}
              disabled={uploading || !file || !title || !assignedUserId}
              className="w-full py-3 rounded-xl font-medium text-white transition-all disabled:opacity-50"
              style={{
                background: `linear-gradient(135deg, ${DT.orange} 0%, #ff8c3a 100%)`,
              }}
            >
              {uploading ? 'Lädt hoch...' : 'Hochladen'}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// Contract Detail Modal
function ContractDetailModal({ contract, onClose }: { contract: Contract; onClose: () => void }) {
  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div 
          className="rounded-3xl border p-6"
          style={{
            background: 'rgba(15,15,20,0.95)',
            borderColor: DT.panelBorder,
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white">{contract.title}</h2>
              <p className="text-gray-500 text-sm mt-1">{contract.filename}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Status */}
          <div className="mb-6">
            <StatusBadge status={contract.status} />
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 rounded-xl bg-white/5">
              <p className="text-xs text-gray-500 mb-1">Zugewiesen an</p>
              <p className="text-white">{contract.assignedUsername || 'Unknown'}</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5">
              <p className="text-xs text-gray-500 mb-1">Hochgeladen von</p>
              <p className="text-white">{contract.uploadedByName || 'Admin'}</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5">
              <p className="text-xs text-gray-500 mb-1">Erstellt am</p>
              <p className="text-white">{new Date(contract.createdAt).toLocaleString('de-DE')}</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5">
              <p className="text-xs text-gray-500 mb-1">Aktualisiert am</p>
              <p className="text-white">{new Date(contract.updatedAt).toLocaleString('de-DE')}</p>
            </div>
          </div>

          {/* Approval Info */}
          {contract.approval && (
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-green-400 font-medium">Freigegeben</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Von</p>
                  <p className="text-white">{contract.approval.username}</p>
                </div>
                <div>
                  <p className="text-gray-500">Am</p>
                  <p className="text-white">
                    {new Date(contract.approval.approvedAt).toLocaleString('de-DE')}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500">Signatur</p>
                  <p className="text-white font-mono bg-white/5 px-3 py-1.5 rounded mt-1 inline-block">
                    {contract.approval.typedSignature}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <a
              href={`/api/admin/contracts/${contract.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-all"
            >
              <Eye className="w-4 h-4" />
              PDF anzeigen
            </a>
            <a
              href={`/api/admin/contracts/${contract.id}/pdf`}
              download={contract.filename}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-all"
            >
              <Download className="w-4 h-4" />
              Herunterladen
            </a>
          </div>
        </div>
      </motion.div>
    </>
  );
}
