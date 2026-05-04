/**
 * ============================================================================
 * JARVIS BRAIN-LINK — KNOWLEDGE BASE UI
 * ============================================================================
 * Upload knowledge (chat logs, strategies, documents) → vector embeddings
 * Semantic search for JARVIS long-term memory
 * ============================================================================
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Loader2,
  Database,
  Search,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Brain,
  Sparkles,
} from "lucide-react";

interface KnowledgeEntry {
  id: number;
  content: string;
  metadata: {
    chunk_index?: number;
    total_chunks?: number;
    source?: string;
    category?: string;
    [key: string]: any;
  };
  created_at: string;
}

interface SearchResult extends KnowledgeEntry {
  similarity: number;
}

export default function KnowledgeBase() {
  const [content, setContent] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    success: boolean;
    message: string;
    chunks?: number;
  } | null>(null);

  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // ============================================================================
  // DATA LOAD
  // ============================================================================

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      const res = await fetch("/api/ceo-mind-os/knowledge?limit=5", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
      }
    } catch (e) {
      console.error("[KNOWLEDGE] load entries:", e);
    } finally {
      setLoadingEntries(false);
    }
  };

  // ============================================================================
  // UPLOAD KNOWLEDGE
  // ============================================================================

  const handleUpload = async () => {
    if (!content.trim() || uploading) return;

    setUploading(true);
    setUploadStatus(null);

    try {
      const res = await fetch("/api/ceo-mind-os/knowledge/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          content: content.trim(),
          metadata: {
            source: "manual_upload",
            uploaded_at: new Date().toISOString(),
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setUploadStatus({
          success: true,
          message: data.message || "Wissen erfolgreich hochgeladen",
          chunks: data.chunks_processed,
        });
        setContent("");
        loadEntries();
      } else {
        const err = await res.json().catch(() => ({}));
        setUploadStatus({
          success: false,
          message: err.detail || "Upload fehlgeschlagen",
        });
      }
    } catch (err) {
      console.error("[KNOWLEDGE] upload:", err);
      setUploadStatus({
        success: false,
        message: "Netzwerkfehler. Bitte erneut versuchen.",
      });
    } finally {
      setUploading(false);
    }
  };

  // ============================================================================
  // SEMANTIC SEARCH
  // ============================================================================

  const handleSearch = async () => {
    if (!searchQuery.trim() || searching) return;

    setSearching(true);

    try {
      const res = await fetch("/api/ceo-mind-os/knowledge/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          query: searchQuery.trim(),
          limit: 5,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
      }
    } catch (err) {
      console.error("[KNOWLEDGE] search:", err);
    } finally {
      setSearching(false);
    }
  };

  // ============================================================================
  // DELETE ENTRY
  // ============================================================================

  const handleDelete = async (id: number) => {
    if (!confirm("Wissens-Eintrag wirklich löschen?")) return;

    try {
      const res = await fetch(`/api/ceo-mind-os/knowledge/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (res.ok) {
        loadEntries();
        setSearchResults((prev) => prev.filter((r) => r.id !== id));
      }
    } catch (err) {
      console.error("[KNOWLEDGE] delete:", err);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="knowledge-base-container">
      <style>{`
        .knowledge-base-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 16px;
        }

        .kb-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 32px;
        }

        .kb-header-icon {
          width: 32px;
          height: 32px;
          color: #6366f1;
        }

        .kb-header-title {
          font-size: 24px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }

        .kb-header-subtitle {
          font-size: 14px;
          color: #64748b;
          margin: 0;
        }

        .kb-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 32px;
        }

        @media (max-width: 768px) {
          .kb-grid {
            grid-template-columns: 1fr;
          }
        }

        .kb-card {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(24px) saturate(180%);
          -webkit-backdrop-filter: blur(24px) saturate(180%);
          border-radius: 16px;
          padding: 24px;
          box-shadow:
            0 8px 32px 0 rgba(31, 38, 135, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.9);
        }

        .kb-card-title {
          font-size: 16px;
          font-weight: 600;
          color: #0f172a;
          margin: 0 0 16px 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .kb-textarea {
          width: 100%;
          min-height: 200px;
          padding: 12px;
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 8px;
          font-family: inherit;
          font-size: 14px;
          line-height: 1.6;
          color: #0f172a;
          background: rgba(248, 250, 252, 0.5);
          resize: vertical;
          outline: none;
          transition: all 0.2s;
        }

        .kb-textarea:focus {
          border-color: #2563eb;
          background: rgba(255, 255, 255, 0.9);
        }

        .kb-textarea::placeholder {
          color: #94a3b8;
        }

        .kb-upload-btn {
          margin-top: 12px;
          width: 100%;
          padding: 12px 20px;
          background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s;
        }

        .kb-upload-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        }

        .kb-upload-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .kb-status {
          margin-top: 12px;
          padding: 12px;
          border-radius: 8px;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .kb-status.success {
          background: rgba(34, 197, 94, 0.1);
          color: #16a34a;
        }

        .kb-status.error {
          background: rgba(239, 68, 68, 0.1);
          color: #dc2626;
        }

        .kb-search-input {
          width: 100%;
          padding: 12px;
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 8px;
          font-family: inherit;
          font-size: 14px;
          color: #0f172a;
          background: rgba(248, 250, 252, 0.5);
          outline: none;
          transition: all 0.2s;
        }

        .kb-search-input:focus {
          border-color: #2563eb;
          background: rgba(255, 255, 255, 0.9);
        }

        .kb-search-btn {
          margin-top: 12px;
          width: 100%;
          padding: 12px 20px;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s;
        }

        .kb-search-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
        }

        .kb-search-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .kb-results {
          margin-top: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .kb-result-item {
          padding: 12px;
          background: rgba(248, 250, 252, 0.8);
          border-radius: 8px;
          border: 1px solid rgba(148, 163, 184, 0.15);
        }

        .kb-result-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .kb-result-similarity {
          font-size: 12px;
          font-weight: 600;
          color: #6366f1;
        }

        .kb-result-content {
          font-size: 13px;
          line-height: 1.6;
          color: #334155;
          margin-bottom: 8px;
          max-height: 100px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .kb-result-meta {
          font-size: 11px;
          color: #94a3b8;
        }

        .kb-entry-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .kb-entry-item {
          padding: 12px;
          background: rgba(248, 250, 252, 0.8);
          border-radius: 8px;
          border: 1px solid rgba(148, 163, 184, 0.15);
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }

        .kb-entry-content {
          flex: 1;
          font-size: 13px;
          line-height: 1.6;
          color: #334155;
          max-height: 60px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .kb-delete-btn {
          padding: 6px;
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .kb-delete-btn:hover {
          background: rgba(239, 68, 68, 0.1);
          color: #dc2626;
        }

        .kb-empty {
          text-align: center;
          padding: 32px;
          color: #94a3b8;
          font-size: 14px;
        }
      `}</style>

      <div className="kb-header">
        <Brain className="kb-header-icon" />
        <div>
          <h2 className="kb-header-title">JARVIS Brain-Link</h2>
          <p className="kb-header-subtitle">
            Langzeitgedächtnis & Semantische Suche
            <span style={{ 
              display: 'block', 
              fontSize: '11px', 
              color: '#6366f1', 
              marginTop: '4px',
              fontWeight: 600,
              letterSpacing: '0.05em'
            }}>
              ⚡ Powered by Open-Source Neural Embeddings
            </span>
          </p>
        </div>
      </div>

      <div className="kb-grid">
        {/* UPLOAD SECTION */}
        <div className="kb-card">
          <h3 className="kb-card-title">
            <Upload className="w-4 h-4" />
            Wissen hochladen
          </h3>
          <textarea
            className="kb-textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Füge hier dein Wissen ein: Chat-Logs, Strategien, Dokumente, Business-Konzepte..."
            disabled={uploading}
          />
          <button
            className="kb-upload-btn"
            onClick={handleUpload}
            disabled={!content.trim() || uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Verarbeite...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                In JARVIS einspeisen
              </>
            )}
          </button>

          <AnimatePresence>
            {uploadStatus && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`kb-status ${uploadStatus.success ? "success" : "error"}`}
              >
                {uploadStatus.success ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                <span>
                  {uploadStatus.message}
                  {uploadStatus.chunks && ` (${uploadStatus.chunks} Chunks)`}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* SEARCH SECTION */}
        <div className="kb-card">
          <h3 className="kb-card-title">
            <Search className="w-4 h-4" />
            Semantische Suche
          </h3>
          <input
            type="text"
            className="kb-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            placeholder="Wonach suchst du im JARVIS-Gedächtnis?"
            disabled={searching}
          />
          <button
            className="kb-search-btn"
            onClick={handleSearch}
            disabled={!searchQuery.trim() || searching}
          >
            {searching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Suche...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Suchen
              </>
            )}
          </button>

          {searchResults.length > 0 && (
            <div className="kb-results">
              {searchResults.map((result) => (
                <div key={result.id} className="kb-result-item">
                  <div className="kb-result-header">
                    <span className="kb-result-similarity">
                      {(result.similarity * 100).toFixed(1)}% Match
                    </span>
                    <button
                      className="kb-delete-btn"
                      onClick={() => handleDelete(result.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="kb-result-content">{result.content}</div>
                  <div className="kb-result-meta">
                    {new Date(result.created_at).toLocaleDateString("de-DE")}
                    {result.metadata.source && ` • ${result.metadata.source}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RECENT ENTRIES */}
      <div className="kb-card">
        <h3 className="kb-card-title">
          <Database className="w-4 h-4" />
          Letzte Wissens-Einträge
        </h3>

        {loadingEntries ? (
          <div className="kb-empty">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            Lade...
          </div>
        ) : entries.length === 0 ? (
          <div className="kb-empty">Noch kein Wissen gespeichert</div>
        ) : (
          <div className="kb-entry-list">
            {entries.map((entry) => (
              <div key={entry.id} className="kb-entry-item">
                <div className="kb-entry-content">{entry.content}</div>
                <button
                  className="kb-delete-btn"
                  onClick={() => handleDelete(entry.id)}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
