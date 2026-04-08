"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { CommandCenterLayout } from "@/components/admin/CommandCenterLayout";
import { 
  Search, RefreshCw, ExternalLink, AlertCircle, Package,
  CheckCircle2, Clock, XCircle, Loader2, ChevronRight, Copy, X
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";

// ============================================================================
// Design Tokens (local, matches CommandCenterLayout)
// ============================================================================
const DESIGN = {
  bg: {
    primary: "#050507",
    card: "rgba(255,255,255,0.03)",
    hover: "rgba(255,255,255,0.05)",
  },
  border: {
    subtle: "rgba(255,255,255,0.05)",
    default: "rgba(255,255,255,0.08)",
  },
  accent: {
    primary: "#FF6A00",
    secondary: "#FFB200",
  },
  text: {
    primary: "#FFFFFF",
    secondary: "rgba(255,255,255,0.6)",
    muted: "rgba(255,255,255,0.4)",
  },
};

// ============================================================================
// Types
// ============================================================================
interface ServiceOrder {
  id: number;
  status: string;
  paymentStatus: string;
  packageCode?: string;
  targetCalls?: number;
  priceCents?: number;
  currency?: string;
  companyName?: string;
  contactName?: string;
  contactEmail?: string;
  createdAt: string;
  updatedAt: string;
}

type FetchStatus = 'loading' | 'ready' | 'error';

interface OrderEvent {
  id: number;
  type: string;
  title: string;
  description?: string | null;
  createdAt: string;
}

interface OrderDetails {
  order: ServiceOrder;
  events: OrderEvent[];
}

type DetailsStatus = 'idle' | 'loading' | 'ready' | 'error';

// ============================================================================
// Helpers
// ============================================================================
function formatPrice(cents?: number, currency = 'EUR'): string {
  if (!cents) return '€0';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(date);
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatNumber(n?: number): string {
  if (!n) return '—';
  return new Intl.NumberFormat('de-DE').format(n);
}

// ============================================================================
// Badge Components
// ============================================================================
function PaymentStatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    paid: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', label: 'Paid' },
    unpaid: { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', label: 'Unpaid' },
    pending: { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', label: 'Pending' },
    failed: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', label: 'Failed' },
    refunded: { bg: 'rgba(107, 114, 128, 0.15)', text: '#9ca3af', label: 'Refunded' },
  };
  const c = config[status] || config.pending;
  
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 8px',
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 500,
        background: c.bg,
        color: c.text,
      }}
    >
      {status === 'paid' && <CheckCircle2 size={12} />}
      {(status === 'unpaid' || status === 'pending') && <Clock size={12} />}
      {status === 'failed' && <XCircle size={12} />}
      {c.label}
    </span>
  );
}

function OrderStatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    draft: { bg: 'rgba(107, 114, 128, 0.15)', text: '#9ca3af', label: 'Draft' },
    paid: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', label: 'Paid' },
    intake: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6', label: 'Intake' },
    in_progress: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6', label: 'In Progress' },
    completed: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', label: 'Completed' },
    paused: { bg: 'rgba(107, 114, 128, 0.15)', text: '#9ca3af', label: 'Paused' },
    canceled: { bg: 'rgba(107, 114, 128, 0.15)', text: '#6b7280', label: 'Canceled' },
  };
  const c = config[status] || config.draft;
  
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 8px',
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 500,
        background: c.bg,
        color: c.text,
      }}
    >
      {c.label}
    </span>
  );
}

// ============================================================================
// Inline Styles (local keyframes for wave)
// ============================================================================
const waveKeyframes = `
@keyframes subtle-wave {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}
`;

// ============================================================================
// Main Component
// ============================================================================
export default function AdminDashboardServiceOrders() {
  // State
  const [status, setStatus] = useState<FetchStatus>('loading');
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [isAdminView, setIsAdminView] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsStatus, setDetailsStatus] = useState<DetailsStatus>('idle');
  const [detailsData, setDetailsData] = useState<OrderDetails | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Deep-link orderId from URL
  const deepLinkedOrderId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const oid = params.get('orderId');
    return oid ? parseInt(oid, 10) : null;
  }, []);

  // Check reduced motion preference
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  /**
   * ADMIN/USER FALLBACK STRATEGY:
   * 1. Try admin endpoint first (/api/service-orders/admin)
   * 2. If 401/403, fallback to user endpoint (/api/service-orders)
   * 3. This allows admins to see all orders, users to see only their own
   * 4. Same pattern applies to detail fetch below
   */
  const fetchOrders = useCallback(async () => {
    setStatus('loading');
    
    try {
      // Try admin endpoint first
      let response = await fetch('/api/service-orders/admin', { credentials: 'include' });
      
      // Fallback to user endpoint on 401/403
      if (response.status === 401 || response.status === 403) {
        setIsAdminView(false);
        response = await fetch('/api/service-orders', { credentials: 'include' });
      } else {
        setIsAdminView(true);
      }

      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }

      const data = await response.json();
      // Admin endpoint returns { orders: [] }, user endpoint may return array directly
      const orderList = Array.isArray(data) ? data : (data.orders || []);
      setOrders(orderList);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Filtered orders (client-side search)
  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return orders;
    const q = searchQuery.toLowerCase();
    return orders.filter(order => 
      order.companyName?.toLowerCase().includes(q) ||
      order.contactEmail?.toLowerCase().includes(q) ||
      order.id.toString().includes(q)
    );
  }, [orders, searchQuery]);

  // Fetch order details with admin/user fallback
  const fetchOrderDetails = useCallback(async (orderId: number) => {
    setDetailsStatus('loading');
    setDetailsData(null);
    
    try {
      // Try admin endpoint first
      let response = await fetch(`/api/service-orders/admin/${orderId}`, { credentials: 'include' });
      
      // Fallback to user endpoint on 401/403
      if (response.status === 401 || response.status === 403) {
        response = await fetch(`/api/service-orders/${orderId}`, { credentials: 'include' });
      }

      if (!response.ok) {
        throw new Error('Failed to fetch order details');
      }

      const data = await response.json();
      // Normalize response: could be { order, events } or just order with events
      const order = data.order || data;
      const events = data.events || [];
      
      setDetailsData({ order, events });
      setDetailsStatus('ready');
    } catch {
      setDetailsStatus('error');
    }
  }, []);

  // Check if deep-linked orderId exists in loaded orders
  const deepLinkValid = useMemo(() => {
    if (!deepLinkedOrderId || status !== 'ready') return null;
    return orders.some(o => o.id === deepLinkedOrderId);
  }, [deepLinkedOrderId, orders, status]);

  // Auto-select deep-linked order and open sheet (only if valid)
  useEffect(() => {
    if (deepLinkedOrderId && status === 'ready' && deepLinkValid === true) {
      setSelectedOrderId(deepLinkedOrderId);
      setDetailsOpen(true);
      fetchOrderDetails(deepLinkedOrderId);
      // Scroll to row
      setTimeout(() => {
        const row = document.getElementById(`order-row-${deepLinkedOrderId}`);
        if (row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, [deepLinkedOrderId, status, deepLinkValid, fetchOrderDetails]);

  // Handle open order
  const handleOpenOrder = useCallback((orderId: number) => {
    setSelectedOrderId(orderId);
    setDetailsOpen(true);
    fetchOrderDetails(orderId);
  }, [fetchOrderDetails]);

  // Copy order ID to clipboard
  const handleCopyOrderId = useCallback(() => {
    if (!selectedOrderId) return;
    navigator.clipboard.writeText(selectedOrderId.toString()).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }).catch(() => {
      // Fallback: select text (user can copy manually)
    });
  }, [selectedOrderId]);

  return (
    <CommandCenterLayout>
      {/* Inject keyframes */}
      <style>{waveKeyframes}</style>

      {/* Background glows */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none',
          zIndex: -1,
          background: `
            radial-gradient(ellipse 600px 400px at 20% 10%, rgba(255, 106, 0, 0.08) 0%, transparent 70%),
            radial-gradient(ellipse 500px 300px at 80% 80%, rgba(255, 178, 0, 0.05) 0%, transparent 70%)
          `,
        }}
      />

      {/* Page Header */}
      <div style={{ marginBottom: 32 }}>
        <h1
          style={{
            fontSize: 'clamp(24px, 5vw, 40px)',
            fontWeight: 700,
            lineHeight: 1.1,
            color: DESIGN.text.primary,
            marginBottom: 8,
            background: 'linear-gradient(135deg, #FFFFFF 0%, rgba(255,255,255,0.7) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Service Orders
        </h1>
        <p style={{ fontSize: 15, color: DESIGN.text.secondary }}>
          Track purchases, payment status, and intake progress.
        </p>
      </div>

      {/* Invalid Deep-link Banner */}
      {deepLinkedOrderId && status === 'ready' && deepLinkValid === false && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: '12px 16px',
            marginBottom: 16,
            borderRadius: 12,
            border: `1px solid ${DESIGN.border.default}`,
            background: DESIGN.bg.card,
          }}
        >
          <AlertCircle size={16} style={{ color: DESIGN.text.muted, marginTop: 2, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, color: DESIGN.text.secondary }}>
              Order not found in this view.
            </div>
            <div style={{ fontSize: 12, color: DESIGN.text.muted, marginTop: 2 }}>
              If you're not an admin, you may only see your own orders.
            </div>
          </div>
        </div>
      )}

      {/* Valid Deep-link info strip */}
      {deepLinkedOrderId && status === 'ready' && deepLinkValid === true && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '12px 16px',
            marginBottom: 16,
            borderRadius: 12,
            border: `1px solid ${DESIGN.accent.primary}40`,
            background: `${DESIGN.accent.primary}10`,
          }}
        >
          <span style={{ fontSize: 13, color: DESIGN.text.secondary }}>
            Deep-linked order: <strong style={{ color: DESIGN.text.primary }}>#{deepLinkedOrderId}</strong>
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleOpenOrder(deepLinkedOrderId)}
            style={{ color: DESIGN.accent.primary }}
          >
            Open <ChevronRight size={14} />
          </Button>
        </div>
      )}

      {/* Main Content Card */}
      <div
        style={{
          background: DESIGN.bg.card,
          border: `1px solid ${DESIGN.border.default}`,
          borderRadius: 18,
          padding: '16px 20px',
          overflow: 'hidden',
        }}
      >
        {/* Card Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: DESIGN.text.primary }}>
              Orders
            </h2>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 500,
                background: isAdminView ? 'rgba(255, 106, 0, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                color: isAdminView ? DESIGN.accent.primary : '#3b82f6',
              }}
            >
              {isAdminView ? 'Admin view' : 'My orders'}
            </span>
          </div>

          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative' }}>
              <Search 
                size={14} 
                style={{ 
                  position: 'absolute', 
                  left: 10, 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  color: DESIGN.text.muted,
                }} 
              />
              <Input
                placeholder="Search company / email / id"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: 220,
                  paddingLeft: 32,
                  height: 36,
                  fontSize: 13,
                  background: DESIGN.bg.hover,
                  border: `1px solid ${DESIGN.border.default}`,
                  borderRadius: 8,
                }}
              />
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={fetchOrders}
              disabled={status === 'loading'}
              style={{ height: 36 }}
            >
              <RefreshCw size={14} className={status === 'loading' ? 'animate-spin' : ''} />
            </Button>
          </div>
        </div>

        {/* Loading State */}
        {status === 'loading' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 20px',
              color: DESIGN.text.muted,
            }}
          >
            <Loader2 size={32} className="animate-spin" style={{ marginBottom: 12 }} />
            <span style={{ fontSize: 14 }}>Loading orders...</span>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 20px',
              textAlign: 'center',
            }}
          >
            <AlertCircle size={32} style={{ color: '#ef4444', marginBottom: 12 }} />
            <p style={{ fontSize: 14, color: DESIGN.text.secondary, marginBottom: 16 }}>
              Failed to load orders. Please try again.
            </p>
            <Button size="sm" onClick={fetchOrders}>
              <RefreshCw size={14} style={{ marginRight: 6 }} />
              Retry
            </Button>
          </div>
        )}

        {/* Empty State */}
        {status === 'ready' && filteredOrders.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 20px',
              textAlign: 'center',
            }}
          >
            <Package size={40} style={{ color: DESIGN.text.muted, marginBottom: 12 }} />
            <p style={{ fontSize: 15, color: DESIGN.text.secondary, marginBottom: 4 }}>
              {searchQuery ? 'No orders match your search.' : 'No orders yet.'}
            </p>
            {!searchQuery && (
              <p style={{ fontSize: 13, color: DESIGN.text.muted, marginBottom: 16 }}>
                Create your first campaign to get started.
              </p>
            )}
            {!searchQuery && (
              <Button
                size="sm"
                onClick={() => window.location.href = '/campaign-studio'}
                style={{ background: DESIGN.accent.primary }}
              >
                Create a new campaign
              </Button>
            )}
          </div>
        )}

        {/* Orders Table (Desktop) */}
        {status === 'ready' && filteredOrders.length > 0 && (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow style={{ borderColor: DESIGN.border.subtle }}>
                    <TableHead style={{ color: DESIGN.text.muted, fontSize: 11, fontWeight: 600 }}>DATE</TableHead>
                    <TableHead style={{ color: DESIGN.text.muted, fontSize: 11, fontWeight: 600 }}>COMPANY</TableHead>
                    <TableHead style={{ color: DESIGN.text.muted, fontSize: 11, fontWeight: 600 }}>VOLUME</TableHead>
                    <TableHead style={{ color: DESIGN.text.muted, fontSize: 11, fontWeight: 600 }}>TOTAL</TableHead>
                    <TableHead style={{ color: DESIGN.text.muted, fontSize: 11, fontWeight: 600 }}>PAYMENT</TableHead>
                    <TableHead style={{ color: DESIGN.text.muted, fontSize: 11, fontWeight: 600 }}>STATUS</TableHead>
                    <TableHead style={{ color: DESIGN.text.muted, fontSize: 11, fontWeight: 600, width: 80 }}></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => {
                    const isHighlighted = order.id === deepLinkedOrderId;
                    const isSelected = order.id === selectedOrderId;
                    
                    return (
                      <TableRow
                        key={order.id}
                        id={`order-row-${order.id}`}
                        style={{
                          borderColor: DESIGN.border.subtle,
                          background: isHighlighted || isSelected ? `${DESIGN.accent.primary}10` : undefined,
                          boxShadow: isHighlighted ? `inset 0 0 0 1px ${DESIGN.accent.primary}40` : undefined,
                          cursor: 'pointer',
                          transition: prefersReducedMotion ? 'none' : 'all 0.15s ease',
                        }}
                        className="group"
                        onMouseEnter={(e) => {
                          if (!prefersReducedMotion && !isHighlighted && !isSelected) {
                            e.currentTarget.style.transform = 'translateY(-1px)';
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isHighlighted && !isSelected) {
                            e.currentTarget.style.transform = '';
                            e.currentTarget.style.boxShadow = '';
                          }
                        }}
                        onClick={() => handleOpenOrder(order.id)}
                      >
                        <TableCell style={{ color: DESIGN.text.secondary, fontSize: 13 }}>
                          {formatDate(order.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div style={{ color: DESIGN.text.primary, fontSize: 13, fontWeight: 500 }}>
                              {order.companyName || '—'}
                            </div>
                            {order.contactEmail && (
                              <div style={{ color: DESIGN.text.muted, fontSize: 11 }}>
                                {order.contactEmail}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell style={{ color: DESIGN.text.secondary, fontSize: 13 }}>
                          {formatNumber(order.targetCalls)} calls
                        </TableCell>
                        <TableCell style={{ color: DESIGN.text.primary, fontSize: 13, fontWeight: 500 }}>
                          {formatPrice(order.priceCents, order.currency)}
                        </TableCell>
                        <TableCell>
                          <PaymentStatusBadge status={order.paymentStatus} />
                        </TableCell>
                        <TableCell>
                          <OrderStatusBadge status={order.status} />
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenOrder(order.id);
                            }}
                            style={{ 
                              opacity: 0.6, 
                              transition: 'opacity 0.15s',
                            }}
                            className="group-hover:opacity-100"
                          >
                            <ExternalLink size={14} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {filteredOrders.map((order) => {
                const isHighlighted = order.id === deepLinkedOrderId;
                const isSelected = order.id === selectedOrderId;
                
                return (
                  <div
                    key={order.id}
                    id={`order-row-${order.id}`}
                    onClick={() => handleOpenOrder(order.id)}
                    style={{
                      padding: 14,
                      borderRadius: 12,
                      border: `1px solid ${isHighlighted ? DESIGN.accent.primary + '40' : DESIGN.border.default}`,
                      background: isHighlighted || isSelected ? `${DESIGN.accent.primary}10` : DESIGN.bg.hover,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ color: DESIGN.text.muted, fontSize: 11 }}>
                        {formatDate(order.createdAt)}
                      </span>
                      <span style={{ color: DESIGN.text.muted, fontSize: 11 }}>
                        #{order.id}
                      </span>
                    </div>
                    <div style={{ color: DESIGN.text.primary, fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
                      {order.companyName || 'No company'}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      <span style={{ color: DESIGN.text.secondary, fontSize: 12 }}>
                        {formatNumber(order.targetCalls)} calls
                      </span>
                      <span style={{ color: DESIGN.text.muted }}>•</span>
                      <span style={{ color: DESIGN.text.primary, fontSize: 12, fontWeight: 500 }}>
                        {formatPrice(order.priceCents)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <PaymentStatusBadge status={order.paymentStatus} />
                      <OrderStatusBadge status={order.status} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Order Details Sheet */}
      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent 
          side="right" 
          className="w-full sm:max-w-[560px] overflow-y-auto"
          style={{ 
            background: DESIGN.bg.primary, 
            borderLeft: `1px solid ${DESIGN.border.default}`,
          }}
        >
          <SheetHeader>
            <SheetTitle style={{ color: DESIGN.text.primary, fontSize: 18 }}>
              Order Details
            </SheetTitle>
            <SheetDescription style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <code style={{ 
                fontFamily: 'monospace', 
                fontSize: 13, 
                color: DESIGN.text.secondary,
                background: DESIGN.bg.hover,
                padding: '2px 6px',
                borderRadius: 4,
              }}>
                #{selectedOrderId}
              </code>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCopyOrderId}
                style={{ height: 28, padding: '0 8px' }}
              >
                {copySuccess ? (
                  <CheckCircle2 size={14} style={{ color: '#10b981' }} />
                ) : (
                  <Copy size={14} style={{ color: DESIGN.text.muted }} />
                )}
              </Button>
            </SheetDescription>
          </SheetHeader>

          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Loading State */}
            {detailsStatus === 'loading' && (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <Loader2 size={24} className="animate-spin" style={{ color: DESIGN.text.muted, margin: '0 auto 12px' }} />
                <p style={{ fontSize: 13, color: DESIGN.text.muted }}>Loading order details...</p>
              </div>
            )}

            {/* Error State */}
            {detailsStatus === 'error' && (
              <div style={{ 
                padding: 24, 
                textAlign: 'center',
                background: DESIGN.bg.card,
                borderRadius: 12,
                border: `1px solid ${DESIGN.border.default}`,
              }}>
                <AlertCircle size={24} style={{ color: '#ef4444', margin: '0 auto 12px' }} />
                <p style={{ fontSize: 13, color: DESIGN.text.secondary, marginBottom: 12 }}>
                  Failed to load order details.
                </p>
                <Button size="sm" onClick={() => selectedOrderId && fetchOrderDetails(selectedOrderId)}>
                  <RefreshCw size={14} style={{ marginRight: 6 }} />
                  Retry
                </Button>
              </div>
            )}

            {/* Order Details */}
            {detailsStatus === 'ready' && detailsData && (
              <>
                {/* Customer Section */}
                <div style={{
                  padding: 16,
                  background: DESIGN.bg.card,
                  borderRadius: 12,
                  border: `1px solid ${DESIGN.border.default}`,
                }}>
                  <h4 style={{ fontSize: 11, fontWeight: 600, color: DESIGN.text.muted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Customer
                  </h4>
                  <div style={{ fontSize: 14, color: DESIGN.text.primary, fontWeight: 500, marginBottom: 4 }}>
                    {detailsData.order.companyName || 'No company'}
                  </div>
                  <div style={{ fontSize: 13, color: DESIGN.text.secondary }}>
                    {detailsData.order.contactName || '—'}
                  </div>
                  <div style={{ fontSize: 12, color: DESIGN.text.muted }}>
                    {detailsData.order.contactEmail || '—'}
                  </div>
                </div>

                {/* Package Section */}
                <div style={{
                  padding: 16,
                  background: DESIGN.bg.card,
                  borderRadius: 12,
                  border: `1px solid ${DESIGN.border.default}`,
                }}>
                  <h4 style={{ fontSize: 11, fontWeight: 600, color: DESIGN.text.muted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Package
                  </h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: DESIGN.text.secondary }}>Calls</span>
                    <span style={{ fontSize: 13, color: DESIGN.text.primary, fontWeight: 500 }}>
                      {formatNumber(detailsData.order.targetCalls)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: DESIGN.text.secondary }}>Package</span>
                    <span style={{ fontSize: 13, color: DESIGN.text.primary }}>
                      {detailsData.order.packageCode || '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: `1px solid ${DESIGN.border.subtle}` }}>
                    <span style={{ fontSize: 14, color: DESIGN.text.primary, fontWeight: 500 }}>Total</span>
                    <span style={{ fontSize: 14, color: DESIGN.text.primary, fontWeight: 600 }}>
                      {formatPrice(detailsData.order.priceCents, detailsData.order.currency)}
                    </span>
                  </div>
                </div>

                {/* Status Section */}
                <div style={{
                  padding: 16,
                  background: DESIGN.bg.card,
                  borderRadius: 12,
                  border: `1px solid ${DESIGN.border.default}`,
                }}>
                  <h4 style={{ fontSize: 11, fontWeight: 600, color: DESIGN.text.muted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Status
                  </h4>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <PaymentStatusBadge status={detailsData.order.paymentStatus} />
                    <OrderStatusBadge status={detailsData.order.status} />
                  </div>
                  <div style={{ marginTop: 12, fontSize: 11, color: DESIGN.text.muted }}>
                    Created: {formatDate(detailsData.order.createdAt)}
                  </div>
                </div>

                {/* Timeline Section */}
                <div style={{
                  padding: 16,
                  background: DESIGN.bg.card,
                  borderRadius: 12,
                  border: `1px solid ${DESIGN.border.default}`,
                }}>
                  <h4 style={{ fontSize: 11, fontWeight: 600, color: DESIGN.text.muted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Timeline
                  </h4>
                  {detailsData.events.length === 0 ? (
                    <div style={{
                      padding: 14,
                      background: DESIGN.bg.hover,
                      borderRadius: 8,
                      border: `1px solid ${DESIGN.border.subtle}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, color: DESIGN.text.secondary, fontWeight: 500 }}>
                          Timeline will appear here
                        </span>
                        <button
                          type="button"
                          onClick={() => selectedOrderId && fetchOrderDetails(selectedOrderId)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: DESIGN.accent.primary,
                            fontSize: 12,
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          Refresh
                        </button>
                      </div>
                      <p style={{ fontSize: 12, color: DESIGN.text.muted, margin: 0 }}>
                        As the order progresses, updates will show up automatically.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {detailsData.events.map((event) => (
                        <div key={event.id} style={{ display: 'flex', gap: 12 }}>
                          <div style={{ 
                            width: 8, 
                            height: 8, 
                            borderRadius: '50%', 
                            background: event.type === 'paid' ? '#10b981' : DESIGN.accent.primary,
                            marginTop: 6,
                            flexShrink: 0,
                          }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, color: DESIGN.text.primary, fontWeight: 500 }}>
                              {event.title}
                            </div>
                            {event.description && (
                              <div style={{ 
                                fontSize: 12, 
                                color: DESIGN.text.muted,
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}>
                                {event.description}
                              </div>
                            )}
                            <div style={{ fontSize: 11, color: DESIGN.text.muted, marginTop: 2 }}>
                              {formatDateTime(event.createdAt)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <SheetFooter style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${DESIGN.border.subtle}` }}>
            <div style={{ display: 'flex', gap: 8, width: '100%', flexWrap: 'wrap' }}>
              {detailsData && detailsData.order.paymentStatus !== 'paid' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Button
                    size="sm"
                    onClick={() => window.location.href = `/campaign-studio?orderId=${encodeURIComponent(String(selectedOrderId))}&from=service-orders`}
                    style={{ background: DESIGN.accent.primary }}
                  >
                    Continue checkout
                  </Button>
                  <span style={{ fontSize: 12, color: DESIGN.text.muted, opacity: 0.75 }}>
                    You'll continue in Campaign Studio.
                  </span>
                </div>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyOrderId}
              >
                <Copy size={14} style={{ marginRight: 6 }} />
                {copySuccess ? 'Copied!' : 'Copy Order ID'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDetailsOpen(false)}
                style={{ marginLeft: 'auto' }}
              >
                Close
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </CommandCenterLayout>
  );
}
