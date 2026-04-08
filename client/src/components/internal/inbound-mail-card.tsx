/**
 * ============================================================================
 * INBOUND MAIL — Premium Dashboard Mega-Card
 * ============================================================================
 * Full-width glass panel with status tabs, unread badge, latest mails,
 * deep-link CTAs, error/empty states, shimmer skeletons.
 * ARAS CI: dark glass, orange/gold accents, Orbitron headings, Inter body.
 * ============================================================================
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, ChevronRight, Inbox, RefreshCw, AlertCircle,
  ArrowRight, ExternalLink,
} from 'lucide-react';
import { useLocation } from 'wouter';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

// ============================================================================
// TYPES
// ============================================================================

type MailStatus = 'NEW' | 'OPEN' | 'TRIAGED' | 'APPROVED' | 'SENT' | 'ERROR' | 'ARCHIVED';

interface MailItem {
  id: number;
  subject: string;
  fromEmail: string;
  fromName?: string | null;
  receivedAt: string;
  status: string;
  snippet?: string;
  category?: string | null;
  priority?: string | null;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STATUS_TABS: { key: MailStatus; label: string; color: string }[] = [
  { key: 'NEW',      label: 'Neu',      color: '#FE9100' },
  { key: 'OPEN',     label: 'Offen',    color: '#F59E0B' },
  { key: 'TRIAGED',  label: 'Triaged',  color: '#3B82F6' },
  { key: 'APPROVED', label: 'Approved', color: '#10B981' },
  { key: 'ERROR',    label: 'Fehler',   color: '#EF4444' },
];

// ============================================================================
// SHIMMER SKELETON
// ============================================================================

function Shimmer({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-lg ${className}`}
      style={{
        background:
          'linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 100%)',
        backgroundSize: '200% 100%',
        animation: 'mailShimmer 1.8s ease-in-out infinite',
      }}
    />
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function InboundMailCard() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<MailStatus>('NEW');

  // ── Fetch latest mails for active tab ──
  const {
    data: listData,
    isLoading: listLoading,
    isError: listError,
    refetch: refetchList,
  } = useQuery({
    queryKey: ['dashboard-mail-mega', activeTab],
    queryFn: async () => {
      const res = await fetch(
        `/api/internal/mail/inbound?status=${activeTab}&limit=5`,
        { credentials: 'include' },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      return res.json();
    },
    refetchInterval: 20000,
    staleTime: 8000,
    retry: 1,
  });

  // ── Fetch status counts ──
  const { data: countsData, refetch: refetchCounts } = useQuery({
    queryKey: ['dashboard-mail-counts'],
    queryFn: async () => {
      const res = await fetch('/api/internal/mail/inbound/count', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch counts');
      return res.json();
    },
    refetchInterval: 30000,
  });

  const mails: MailItem[] = listData?.data || [];
  const counts: Record<string, number> = countsData?.counts || {};
  const newCount = counts.NEW || 0;
  const totalUnread = newCount;

  // Time formatter
  const formatTime = useMemo(
    () => (dateStr: string) => {
      try {
        return formatDistanceToNow(new Date(dateStr), {
          addSuffix: true,
          locale: de,
        });
      } catch {
        return '';
      }
    },
    [],
  );

  // ── Navigate helpers ──
  const goToInbox = () => navigate('/internal/mails');
  const goToUnread = () => navigate('/internal/mails');
  const goToFiltered = (status: MailStatus) => navigate('/internal/mails');
  const refetchAll = () => { refetchList(); refetchCounts(); };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl relative overflow-hidden"
      style={{
        background: 'rgba(12, 12, 14, 0.55)',
        border: '1px solid rgba(233,215,196,0.10)',
        boxShadow:
          '0 16px 64px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}
    >
      {/* ── Gradient accent line ── */}
      <div
        className="absolute top-0 left-8 right-8 h-[1px]"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(254,145,0,0.35), transparent)',
        }}
      />

      {/* ── Ambient glow ── */}
      <div
        className="absolute -top-32 -right-32 w-64 h-64 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(254,145,0,0.08) 0%, transparent 70%)',
        }}
      />

      {/* ════════════ HEADER ════════════ */}
      <div className="px-6 pt-6 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(254,145,0,0.15), rgba(163,78,0,0.10))',
              border: '1px solid rgba(254,145,0,0.18)',
              boxShadow: '0 4px 16px rgba(254,145,0,0.10)',
            }}
          >
            <Mail className="w-5 h-5" style={{ color: '#FE9100' }} />
          </div>

          <div>
            <h3
              className="text-base font-bold tracking-wide"
              style={{
                fontFamily: 'Orbitron, sans-serif',
                background: 'linear-gradient(135deg, #e9d7c4, #FE9100, #a34e00)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              INBOUND · MAIL
            </h3>
            <p
              className="text-[11px] mt-0.5"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              AI-gestütztes E-Mail Monitoring
            </p>
          </div>
        </div>

        {/* Right side: unread badge + live + refresh */}
        <div className="flex items-center gap-3">
          {/* Unread badge */}
          {totalUnread > 0 && (
            <button
              onClick={goToUnread}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full transition-all hover:scale-105"
              style={{
                background: 'rgba(254,145,0,0.12)',
                border: '1px solid rgba(254,145,0,0.25)',
                boxShadow: '0 0 12px rgba(254,145,0,0.15)',
              }}
            >
              <span className="relative flex h-2 w-2">
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
                  style={{ backgroundColor: '#FE9100' }}
                />
                <span
                  className="relative inline-flex rounded-full h-2 w-2"
                  style={{ backgroundColor: '#FE9100' }}
                />
              </span>
              <span
                className="text-xs font-semibold"
                style={{ color: '#FE9100' }}
              >
                {totalUnread} ungelesen
              </span>
            </button>
          )}

          {/* LIVE chip */}
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span
                className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50"
                style={{ backgroundColor: '#FE9100' }}
              />
              <span
                className="relative inline-flex rounded-full h-1.5 w-1.5"
                style={{ backgroundColor: '#FE9100' }}
              />
            </span>
            <span
              className="text-[9px] font-medium tracking-widest uppercase"
              style={{ color: 'rgba(254,145,0,0.5)' }}
            >
              Live
            </span>
          </div>

          {/* Refresh */}
          <button
            onClick={refetchAll}
            className="p-2 rounded-lg transition-all hover:bg-white/5 active:scale-95"
            style={{ color: 'rgba(255,255,255,0.35)' }}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ════════════ STATUS TABS ════════════ */}
      <div
        className="px-6 pb-3 flex gap-2 overflow-x-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        {STATUS_TABS.map((tab) => {
          const count = counts[tab.key] || 0;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap"
              style={{
                background: isActive
                  ? `${tab.color}18`
                  : 'rgba(255,255,255,0.02)',
                border: `1px solid ${
                  isActive ? `${tab.color}40` : 'rgba(233,215,196,0.06)'
                }`,
                color: isActive ? tab.color : 'rgba(255,255,255,0.45)',
                boxShadow: isActive
                  ? `0 0 8px ${tab.color}15`
                  : 'none',
              }}
            >
              {tab.label}
              {count > 0 && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                  style={{
                    background: isActive
                      ? `${tab.color}25`
                      : 'rgba(255,255,255,0.06)',
                    color: isActive ? tab.color : 'rgba(255,255,255,0.4)',
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ════════════ DIVIDER ════════════ */}
      <div
        className="mx-6 h-[1px]"
        style={{ background: 'rgba(233,215,196,0.06)' }}
      />

      {/* ════════════ MAIL LIST ════════════ */}
      <div className="px-6 py-4 min-h-[240px]">
        <AnimatePresence mode="wait">
          {listError ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-10"
            >
              <AlertCircle
                className="w-10 h-10 mb-3"
                style={{ color: '#EF4444' }}
              />
              <p
                className="text-sm font-medium mb-1"
                style={{ color: 'rgba(255,255,255,0.7)' }}
              >
                Fehler beim Laden
              </p>
              <p
                className="text-xs mb-4"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                API nicht erreichbar
              </p>
              <button
                onClick={() => refetchAll()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: 'rgba(254,145,0,0.1)',
                  color: '#FE9100',
                  border: '1px solid rgba(254,145,0,0.2)',
                }}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Erneut versuchen
              </button>
            </motion.div>
          ) : listLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Shimmer className="w-10 h-10 rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Shimmer className="h-4 w-3/4" />
                    <Shimmer className="h-3 w-1/2" />
                  </div>
                  <Shimmer className="h-3 w-16 rounded" />
                </div>
              ))}
            </motion.div>
          ) : mails.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-10"
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(233,215,196,0.06)',
                }}
              >
                <Inbox
                  className="w-8 h-8"
                  style={{ color: 'rgba(255,255,255,0.12)' }}
                />
              </div>
              <p
                className="text-sm font-medium mb-1"
                style={{ color: 'rgba(255,255,255,0.5)' }}
              >
                Keine {STATUS_TABS.find((t) => t.key === activeTab)?.label || ''} E-Mails
              </p>
              <p
                className="text-xs"
                style={{ color: 'rgba(255,255,255,0.3)' }}
              >
                Neue Nachrichten erscheinen hier automatisch
              </p>
            </motion.div>
          ) : (
            <motion.div
              key={`list-${activeTab}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-1.5"
            >
              {mails.map((mail, idx) => (
                <motion.button
                  key={mail.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  onClick={() => navigate('/internal/mails')}
                  className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all duration-200 group"
                  style={{
                    background: 'rgba(255,255,255,0.015)',
                    border: '1px solid rgba(233,215,196,0.04)',
                  }}
                  whileHover={{
                    y: -1,
                    scale: 1.005,
                    transition: { duration: 0.12 },
                  }}
                >
                  {/* Avatar */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{
                      background:
                        mail.status === 'NEW'
                          ? 'linear-gradient(135deg, #FE9100, #a34e00)'
                          : mail.status === 'ERROR'
                          ? 'linear-gradient(135deg, #EF4444, #991B1B)'
                          : 'rgba(255,255,255,0.06)',
                      color:
                        mail.status === 'NEW' || mail.status === 'ERROR'
                          ? '#fff'
                          : 'rgba(255,255,255,0.5)',
                      boxShadow:
                        mail.status === 'NEW'
                          ? '0 2px 10px rgba(254,145,0,0.25)'
                          : 'none',
                    }}
                  >
                    {(mail.fromName || mail.fromEmail)?.[0]?.toUpperCase() ||
                      '?'}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium truncate"
                      style={{
                        color:
                          mail.status === 'NEW'
                            ? 'rgba(255,255,255,0.95)'
                            : 'rgba(255,255,255,0.75)',
                      }}
                    >
                      {mail.subject || '(Kein Betreff)'}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p
                        className="text-xs truncate"
                        style={{ color: 'rgba(255,255,255,0.4)' }}
                      >
                        {mail.fromName || mail.fromEmail}
                      </p>
                      <span
                        className="text-[10px] flex-shrink-0"
                        style={{ color: 'rgba(255,255,255,0.25)' }}
                      >
                        · {formatTime(mail.receivedAt)}
                      </span>
                    </div>
                    {mail.snippet && (
                      <p
                        className="text-[11px] truncate mt-0.5"
                        style={{ color: 'rgba(255,255,255,0.28)' }}
                      >
                        {mail.snippet}
                      </p>
                    )}
                  </div>

                  {/* Arrow */}
                  <ChevronRight
                    className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-0.5"
                    style={{ color: 'rgba(254,145,0,0.6)' }}
                  />
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ════════════ DIVIDER ════════════ */}
      <div
        className="mx-6 h-[1px]"
        style={{ background: 'rgba(233,215,196,0.06)' }}
      />

      {/* ════════════ FOOTER CTAs ════════════ */}
      <div className="px-6 py-4 flex items-center gap-3">
        {/* Primary CTA */}
        <button
          onClick={totalUnread > 0 ? goToUnread : goToInbox}
          className="flex-1 flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 group"
          style={{
            background:
              'linear-gradient(135deg, rgba(254,145,0,0.12), rgba(163,78,0,0.08))',
            border: '1px solid rgba(254,145,0,0.22)',
            color: '#FE9100',
            boxShadow: '0 4px 20px rgba(254,145,0,0.08)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background =
              'linear-gradient(135deg, rgba(254,145,0,0.18), rgba(163,78,0,0.12))';
            e.currentTarget.style.boxShadow =
              '0 6px 28px rgba(254,145,0,0.12)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background =
              'linear-gradient(135deg, rgba(254,145,0,0.12), rgba(163,78,0,0.08))';
            e.currentTarget.style.boxShadow =
              '0 4px 20px rgba(254,145,0,0.08)';
          }}
        >
          <span>
            {totalUnread > 0
              ? `${totalUnread} Ungelesene öffnen`
              : 'Inbox öffnen'}
          </span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </button>

        {/* Secondary CTA */}
        <button
          onClick={goToInbox}
          className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-medium transition-all duration-200"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(233,215,196,0.08)',
            color: 'rgba(255,255,255,0.5)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(233,215,196,0.16)';
            e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(233,215,196,0.08)';
            e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
          }}
        >
          Alle Mails
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Shimmer keyframe ── */}
      <style>{`
        @keyframes mailShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </motion.div>
  );
}

export default InboundMailCard;
