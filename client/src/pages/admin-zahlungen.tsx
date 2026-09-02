import { useState, useEffect, useCallback, useRef } from "react";
import { Copy, ChevronRight, Banknote, Check, Send, Phone, Mail } from "lucide-react";
import { PageIntro, Tip } from "@/components/admin/PageHelp";
import { ACCENT } from "@/components/admin/AdminShell";
import Detailfenster, { type ListenArt, type FensterReiter } from "@/components/admin/Detailfenster";
import AboTafel from "@/components/admin/AboTafel";
import BuchenDialog from "@/components/admin/BuchenDialog";
import VermerkTafel from "@/components/admin/VermerkTafel";
import { KUNDENSTATUS, zahlungsstatusText } from "@shared/fiaon-kundenstatus";
import { LABEL_VERTRIEB, zustaendigText } from "@shared/fiaon-zustaendigkeit-text";

// ============================================================================
// /admin/zahlungen — Zahlungszentrale (Vorkasse per Banküberweisung)
// - 4 Kennzahl-Kacheln, „Zahlung angekündigt“ = Arbeitsliste (hervorgehoben)
// - Filter-Chips Alle/Offen/Angekündigt/Bezahlt/Abgelaufen, claimed_paid zuerst
// - Detail-Drawer mit Ereignis-Timeline + Rechnungs-Download
// - Duplikat-Altbestand: sichere Massen-Bereinigung (Soft-Delete)
// - Mitarbeiter-Zugänge (Agent-Portal /agent) + Audit-Trail
// Siehe MIGRATION_INVENTORY.md
// ============================================================================

interface PaymentRow {
  ref: string;
  type: string;
  payment_reference: string;
  payment_status: string;
  payment_due_date: string | null;
  amount_due: string | null;
  currency: string | null;
  first_name: string | null;
  last_name: string | null;
  contact_name: string | null;
  company_name: string | null;
  email: string | null;
  contact_email: string | null;
  billing_email: string | null;
  phone: string | null;
  phone_country_code: string | null;
  contact_phone: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  pack_name: string | null;
  created_at: string;
  claimed_paid_at: string | null;
  promised_pay_date: string | null;
  invoice_number: string | null;
  superseded_by: string | null;
  allow_reminders_despite_paid: boolean;
  cancelled_at: string | null;
  gdpr_deleted_at: string | null;
}

// Paket AD3 / P3-A: Dubletten-Gruppen (per E-Mail ODER normalisiertem Telefon)
interface DupApp {
  ref: string;
  payment_reference: string | null;
  payment_status: string;
  superseded_by: string | null;
  amount_due: string | null;
  pack_name: string | null;
  first_name: string | null;
  last_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  phone_country_code: string | null;
  contact_phone: string | null;
  invoice_number: string | null;
  created_at: string;
  gdpr_deleted_at: string | null;
}
// matchType: "email" (gleiche E-Mail) | "phone" (gleiche normalisierte Nummer).
// label = die gemeinsame E-Mail bzw. Telefonnummer. key = stabiler React-Key.
interface DupGroup { matchType: "email" | "phone"; key: string; label: string; email: string | null; apps: DupApp[] }

interface PaymentStats {
  pending: { count: number; sum: number };
  claimed: { count: number; sum: number };
  paid: { count: number; sum: number };
  confirmationRate: number | null;
  remindersToday: number;
}

// Paket W: Bulk-Zahlungserinnerung
interface BulkPreview { eligible: number; skipped: number; withinWindow: boolean; jobRunning: boolean }
interface BulkJob { running: boolean; startedAt: string; finishedAt: string | null; planned: number; sent: number; errors: number }

interface TimelineEvent { at: string; label: string; type: string; meta?: string }
interface AgentRow { id: number; name: string; email: string; active: boolean; created_at: string }
interface DupPreview { groups: number; mergeable: number }

function customerName(r: PaymentRow): string {
  if (r.company_name) return r.company_name;
  const name = [r.first_name, r.last_name].filter(Boolean).join(" ");
  return name || r.contact_name || "—";
}

function customerEmail(r: PaymentRow): string {
  return r.email || r.contact_email || r.billing_email || "—";
}

function customerPhone(r: PaymentRow): string {
  if (r.phone) return `${r.phone_country_code || ""} ${r.phone}`.trim();
  return r.contact_phone || "—";
}

function fmtDate(v: string | null): string {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return "—";
  }
}

function fmtDateTime(v: string | null): string {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

function fmtAmount(v: string | null): string {
  const n = Number(v);
  if (!v || isNaN(n)) return "—";
  return `${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending_payment: { label: "Offen", cls: "bg-slate-100 text-slate-600" },
  claimed_paid: { label: zahlungsstatusText("claimed_paid"), cls: "bg-amber-100 text-amber-700" },
  paid: { label: "Bezahlt", cls: "bg-emerald-100 text-emerald-700" },
  expired: { label: "Abgelaufen", cls: "bg-rose-100 text-rose-600" },
  superseded: { label: "Ersetzt (Dublette)", cls: "bg-slate-100 text-slate-500" },
  cancelled: { label: "Storniert", cls: "bg-slate-100 text-slate-500" },
};

function StatusBadge({ status }: { status: string }) {
  const b = STATUS_BADGE[status] || { label: status, cls: "bg-slate-100 text-slate-500" };
  return <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${b.cls}`}>{b.label}</span>;
}

type TabKey = "alle" | "pending_payment" | "claimed_paid" | "paid" | "expired";
const STATUS_ORDER: Record<string, number> = { claimed_paid: 0, pending_payment: 1, expired: 2, paid: 3 };

export default function AdminZahlungenPage() {
  const [tab, setTab] = useState<TabKey>("claimed_paid");
  const [rows, setRows] = useState<PaymentRow[]>([]);
  /** true = neueste zuerst (Vorgabe), false = längste Wartezeit zuerst. */
  const [sortNeu, setSortNeu] = useState(true);
  /** Welche Kennzahl ist als Namensliste geöffnet? */
  const [fenster, setFenster] = useState<ListenArt | null>(null);
  /** Bestellung, für die der Buchen-Dialog (mit Zahlungsdatum) offen ist. */
  const [buchenZiel, setBuchenZiel] = useState<PaymentRow | null>(null);
  // Deep-Link aus Hub/Cmd+K: /admin/zahlungen?ref=… öffnet direkt den Drawer
  const deepRef = useRef<string | null>(new URLSearchParams(window.location.search).get("ref"));
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  // Paket DC: globale Server-Suche (alle Status + Leads) — findet auch, was der
  // aktuelle Tab nicht lädt (z. B. bezahlte/ersetzte Bestellungen im Tab „Angekündigt“).
  const [serverHits, setServerHits] = useState<{ customers: any[]; leads: any[] } | null>(null);
  const serverSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [actionRef, setActionRef] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reminderRunning, setReminderRunning] = useState(false);
  // Paket DE: Stammdaten + Adresse im Detail-Drawer korrigieren (Audit über Backend)
  const [contactEdit, setContactEdit] = useState<{ firstName: string; lastName: string; email: string; phone: string; street: string; zip: string; city: string } | null>(null);
  const [contactBusy, setContactBusy] = useState(false);

  // Paket W: Bulk-Versand „An alle unbezahlten erinnern“
  const [bulkPreview, setBulkPreview] = useState<BulkPreview | null>(null);
  const [bulkDialog, setBulkDialog] = useState(false);
  const [bulkJob, setBulkJob] = useState<BulkJob | null>(null);
  const bulkPoll = useRef<ReturnType<typeof setInterval>>();

  // Detail-Drawer
  const [detail, setDetail] = useState<PaymentRow | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[] | null>(null);

  // Duplikat-Bereinigung
  const [dup, setDup] = useState<DupPreview | null>(null);
  const [dupRunning, setDupRunning] = useState(false);
  // Paket AD3: Dubletten-Gruppen (per E-Mail) + retroaktiver Supersede-Lauf
  const [dupGroups, setDupGroups] = useState<DupGroup[]>([]);
  const [dupGroupsOpen, setDupGroupsOpen] = useState(false);
  const [supersedeRunning, setSupersedeRunning] = useState(false);
  const [groupBusy, setGroupBusy] = useState<string | null>(null);

  // Auszahlungen (H2) + Audit
  const [payouts, setPayouts] = useState<any[]>([]);
  const [payoutBusy, setPayoutBusy] = useState<number | null>(null);
  const [expandedPayout, setExpandedPayout] = useState<number | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [audit, setAudit] = useState<any[]>([]);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/fiaon/admin/payments/stats`, { credentials: "include" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) setStats(json);
    } catch {}
  }, []);

  const load = useCallback(async (status: TabKey) => {
    setLoading(true);
    try {
      const statuses = status === "alle" ? (["claimed_paid", "pending_payment", "expired", "paid"] as const) : ([status] as const);
      const results = await Promise.all(
        statuses.map((s) =>
          fetch(`/api/fiaon/admin/payments?status=${s}`, { credentials: "include" })
            .then((r) => r.json())
            .catch(() => null),
        ),
      );
      const all: PaymentRow[] = results.flatMap((j) => (j?.ok ? j.data : []));
      setRows(all);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDup = useCallback(async () => {
    try {
      const res = await fetch(`/api/fiaon/admin/duplicates/preview`, { credentials: "include" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) setDup(json);
    } catch {}
  }, []);

  // Paket AD3: Dubletten-Gruppen (per E-Mail) laden
  const loadDupGroups = useCallback(async () => {
    try {
      const res = await fetch(`/api/fiaon/admin/duplicates/groups`, { credentials: "include" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) setDupGroups(json.groups || []);
    } catch {}
  }, []);

  const loadPayouts = useCallback(async () => {
    try {
      const res = await fetch(`/api/fiaon/admin/payouts`, { credentials: "include" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) setPayouts(json.data);
    } catch {}
  }, []);

  useEffect(() => {
    load(tab);
    loadStats();
  }, [tab, load, loadStats]);

  // Paket DC: globale Server-Suche (debounced) — alle Status + Leads, unabhängig vom Tab
  useEffect(() => {
    if (serverSearchTimer.current) clearTimeout(serverSearchTimer.current);
    const term = search.trim();
    if (term.length < 2) { setServerHits(null); return; }
    serverSearchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/fiaon/admin/customer-search?q=${encodeURIComponent(term)}`, { credentials: "include" });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.ok) setServerHits({ customers: json.customers || [], leads: json.leads || [] });
      } catch { /* Suche ist best-effort */ }
    }, 350);
    return () => { if (serverSearchTimer.current) clearTimeout(serverSearchTimer.current); };
  }, [search]);

  // Deep-Links (Paket O3/N): ?ref → Suche + Drawer; #auszahlungen → Sektion
  useEffect(() => {
    if (deepRef.current) {
      setTab("alle");
      setSearch(deepRef.current);
    }
    const scrollToHash = () => {
      // Alt-Lesezeichen: Auszahlungen und Dubletten sind seit 04.08.2026 eigene
      // Seiten. Ein gemerkter Link darf nicht ins Nichts zeigen — er wird
      // umgeleitet, statt zu einer Sektion zu springen, die es hier nicht
      // mehr gibt.
      if (window.location.hash === "#auszahlungen") { window.location.replace("/admin/auszahlungen"); return; }
      if (window.location.hash === "#dubletten") { window.location.replace("/admin/dubletten"); return; }
    };
    scrollToHash();
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, []);

  useEffect(() => {
    const target = deepRef.current;
    if (!target || rows.length === 0) return;
    const hit = rows.find((r) => r.payment_reference === target || r.ref === target);
    if (hit) {
      deepRef.current = null;
      openDetail(hit);
    }
  }, [rows]);

  useEffect(() => {
    loadDup();
    loadDupGroups();
    loadPayouts();
  }, [loadDup, loadDupGroups, loadPayouts]);

  const flash = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 5000);
  };

  const openDetail = async (r: PaymentRow) => {
    setDetail(r);
    setTimeline(null);
    try {
      const res = await fetch(`/api/fiaon/admin/payments/${encodeURIComponent(r.payment_reference)}/timeline`, { credentials: "include" });
      const json = await res.json().catch(() => null);
      setTimeline(res.ok && json?.ok ? json.events : []);
    } catch {
      setTimeline([]);
    }
  };

  const runDupCleanup = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!dup) return;
    if (!confirm(
      `Duplikat-Bereinigung starten?\n\n${dup.groups} Gruppen · ${dup.mergeable} überflüssige Alt-Einträge werden als „merged“ markiert (Soft-Delete, KEIN Löschen).\n\nPro E-Mail bleibt der vollständigste/neueste Antrag erhalten. Bezahlte/offene Zahlungen sind geschützt.`,
    )) return;
    setDupRunning(true);
    try {
      const res = await fetch(`/api/fiaon/admin/duplicates/cleanup-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ confirmed: true }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        flash(`✓ Bereinigung: ${json.groupsProcessed} Gruppen verarbeitet, ${json.merged} Einträge zusammengeführt (Soft-Delete)${json.skippedProtected ? `, ${json.skippedProtected} geschützt übersprungen` : ""}`);
        loadDup();
        load(tab);
        loadStats();
      } else {
        flash(`Fehler: ${json?.error || res.status}`);
      }
    } catch {
      flash("Netzwerkfehler");
    } finally {
      setDupRunning(false);
    }
  };

  // ── Paket AD3: Einzel-Storno, DSGVO-Löschung, Reminder-Override ──
  const cancelOrder = async (e: React.MouseEvent, paymentRef: string) => {
    e.stopPropagation();
    if (!confirm(`Bestellung ${paymentRef} stornieren?\n\nStatus wird „storniert“, alle Erinnerungen stoppen, vorhandene Provisionen werden zurückgezogen (Clawback). Die Bestellung verschwindet aus den operativen Listen, bleibt aber in der Historie.`)) return;
    setActionRef(paymentRef);
    try {
      const res = await fetch(`/api/fiaon/admin/payments/${encodeURIComponent(paymentRef)}/cancel`, { method: "POST", credentials: "include" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        flash(`${paymentRef} storniert`);
        setDetail(null); load(tab); loadStats(); loadDupGroups();
      } else flash(`Fehler: ${json?.error || res.status}`);
    } catch { flash("Netzwerkfehler"); } finally { setActionRef(null); }
  };

  const gdprDelete = async (e: React.MouseEvent, r: PaymentRow) => {
    e.stopPropagation();
    if (!confirm(`Kunde „${customerName(r)}“ nach DSGVO löschen?\n\nName, E-Mail, Telefon, Adresse und KYC-Dokumente werden anonymisiert/entfernt. Offene Zahlung wird storniert.\n\nWICHTIG: Rechnungsdaten (Nummer ${r.invoice_number || "—"}, Betrag, Datum) bleiben aus Buchhaltungspflicht erhalten. Dieser Schritt ist nicht umkehrbar.`)) return;
    setActionRef(r.payment_reference);
    try {
      const res = await fetch(`/api/fiaon/admin/applications/${encodeURIComponent(r.ref)}/gdpr-delete`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ confirmed: true }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        flash(`${customerName(r)} anonymisiert — Rechnungsdaten bleiben erhalten`);
        setDetail(null); load(tab); loadStats(); loadDupGroups();
      } else flash(`Fehler: ${json?.error || res.status}`);
    } catch { flash("Netzwerkfehler"); } finally { setActionRef(null); }
  };

  const toggleReminders = async (e: React.MouseEvent, r: PaymentRow) => {
    e.stopPropagation();
    const next = !r.allow_reminders_despite_paid;
    setActionRef(r.payment_reference);
    try {
      const res = await fetch(`/api/fiaon/admin/payments/${encodeURIComponent(r.payment_reference)}/allow-reminders`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ allow: next }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        flash(next ? "Erinnerungen trotz bezahlter Schwester-Bestellung erlaubt (echter Zweitkauf)" : "Reminder-Override entfernt");
        setDetail((d) => (d ? { ...d, allow_reminders_despite_paid: next } : d));
        load(tab);
      } else flash(`Fehler: ${json?.error || res.status}`);
    } catch { flash("Netzwerkfehler"); } finally { setActionRef(null); }
  };

  // Retroaktiver Aufräumlauf: wendet AD1 auf den gesamten Bestand an (KEINE Mails)
  const runSupersede = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Dubletten-Aufräumlauf starten?\n\nFür jede bezahlte Bestellung werden offene Schwester-Bestellungen derselben E-Mail auf 'Ersetzt (Dublette)' gesetzt. Es werden KEINE E-Mails versendet. Idempotent — mehrfach ausführbar.")) return;
    setSupersedeRunning(true);
    try {
      const res = await fetch(`/api/fiaon/admin/duplicates/supersede-run`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ confirmed: true }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        flash(`Aufräumlauf: ${json.superseded} Bestellung(en) ersetzt (${json.paidChecked} bezahlte geprüft) — keine Mails versendet`);
        load(tab); loadStats(); loadDupGroups();
      } else flash(`Fehler: ${json?.error || res.status}`);
    } catch { flash("Netzwerkfehler"); } finally { setSupersedeRunning(false); }
  };

  // E-Mail-Gruppen stornieren per E-Mail; Telefon-Gruppen per expliziter Ref-Liste.
  const cancelGroupOpen = async (e: React.MouseEvent, g: DupGroup) => {
    e.stopPropagation();
    if (!confirm(`Alle OFFENEN Bestellungen von ${g.label} stornieren?\n\nBezahlte/ersetzte Einträge bleiben unberührt.`)) return;
    setGroupBusy(g.key);
    try {
      const body = g.matchType === "email" && g.email
        ? { email: g.email, confirmed: true }
        : { refs: g.apps.map((a) => a.ref), confirmed: true };
      const res = await fetch(`/api/fiaon/admin/duplicates/cancel-open`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        flash(`${json.cancelled} offene Bestellung(en) von ${g.label} storniert`);
        load(tab); loadStats(); loadDupGroups();
      } else flash(`Fehler: ${json?.error || res.status}`);
    } catch { flash("Netzwerkfehler"); } finally { setGroupBusy(null); }
  };

  // H2: Auszahlung als überwiesen markieren / ablehnen (Anforderungen — keine Transaktionen)
  const payoutMarkPaid = async (e: React.MouseEvent, p: any) => {
    e.stopPropagation();
    if (!confirm(`Auszahlung #${p.id} (${(p.amount_cents / 100).toFixed(2)} € an ${p.agent_name}) als überwiesen markieren?\n\nDie enthaltenen Provisionen wechseln auf „ausgezahlt“, der Mitarbeiter erhält eine Bestätigungs-Mail (Make: agent_payout_done).`)) return;
    setPayoutBusy(p.id);
    const res = await fetch(`/api/fiaon/admin/payouts/${p.id}/mark-paid`, { method: "POST", credentials: "include" });
    const json = await res.json().catch(() => null);
    setPayoutBusy(null);
    if (res.ok && json?.ok) { flash(`Auszahlung #${p.id} als überwiesen markiert`); loadPayouts(); }
    else flash(`Fehler: ${json?.error || res.status}`);
  };

  const payoutReject = async (e: React.MouseEvent, p: any) => {
    e.stopPropagation();
    const reason = prompt(`Auszahlung #${p.id} ablehnen — Grund (wird dem Mitarbeiter mitgeteilt):`);
    if (!reason) return;
    setPayoutBusy(p.id);
    const res = await fetch(`/api/fiaon/admin/payouts/${p.id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ reason }),
    });
    const json = await res.json().catch(() => null);
    setPayoutBusy(null);
    if (res.ok && json?.ok) { flash(`Auszahlung #${p.id} abgelehnt — Provisionen wieder verfügbar`); loadPayouts(); }
    else flash(`Fehler: ${json?.error || res.status}`);
  };

  const refund = async (e: React.MouseEvent, paymentRef: string) => {
    e.stopPropagation();
    const reason = prompt(`Zahlung ${paymentRef} stornieren/erstatten — Grund:`);
    if (reason === null) return;
    setActionRef(paymentRef);
    try {
      const res = await fetch(`/api/fiaon/admin/payments/${encodeURIComponent(paymentRef)}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        flash(`${paymentRef} erstattet — Provision: ${json.commission.cancelled}× storniert, ${json.commission.clawback}× Verrechnung`);
        setDetail(null);
        load(tab);
        loadStats();
      } else flash(`Fehler: ${json?.error || res.status}`);
    } catch {
      flash("Netzwerkfehler");
    } finally {
      setActionRef(null);
    }
  };

  const openAudit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setAuditOpen((v) => !v);
    if (!auditOpen) {
      const res = await fetch(`/api/fiaon/admin/agent-log`, { credentials: "include" });
      const json = await res.json().catch(() => null);
      setAudit(res.ok && json?.ok ? json.data : []);
    }
  };

  /**
   * Erstzahlung buchen. Läuft über den Dialog, weil das TATSÄCHLICHE
   * Zahlungsdatum mitgegeben werden muss: Es ist der Ankerpunkt der Abo-
   * Fälligkeit (+30 Tage). Wird heute eine Zahlung von vorgestern gebucht,
   * darf der Zyklus nicht um zwei Tage wandern.
   */
  const markPaid = async (paymentRef: string, zahlungsdatum: string) => {
    setActionRef(paymentRef);
    try {
      const res = await fetch(`/api/fiaon/admin/payments/${encodeURIComponent(paymentRef)}/mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ zahlungsdatum }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        flash(
          `${paymentRef} als bezahlt gebucht (Eingang ${zahlungsdatum}) — Zugang frei, Bestätigungsmail versendet` +
          (json.naechsteAboFaelligkeit ? `, erste Abo-Rate fällig am ${fmtDate(json.naechsteAboFaelligkeit)}` : ""),
        );
        setBuchenZiel(null);
        setDetail(null);
        load(tab);
        loadStats();
      } else {
        flash(`Fehler: ${json?.error || res.status}`);
      }
    } catch {
      flash("Netzwerkfehler");
    } finally {
      setActionRef(null);
    }
  };

  /** Öffnet den Buchen-Dialog für eine Bestellung. */
  const buchenOeffnen = (r: PaymentRow) => setBuchenZiel(r);

  const reactivate = async (e: React.MouseEvent, paymentRef: string) => {
    e.stopPropagation();
    if (!confirm(`Bestellung ${paymentRef} reaktivieren?\n\nNeue 7-Tage-Frist, Zahlungs-E-Mail wird erneut versendet.`)) return;
    setActionRef(paymentRef);
    try {
      const res = await fetch(`/api/fiaon/admin/payments/${encodeURIComponent(paymentRef)}/reactivate`, {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        flash(`✓ ${paymentRef} reaktiviert — neue Frist, Zahlungsinfos erneut versendet`);
        load(tab);
        loadStats();
      } else {
        flash(`Fehler: ${json?.error || res.status}`);
      }
    } catch {
      flash("Netzwerkfehler");
    } finally {
      setActionRef(null);
    }
  };

  const runReminders = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setReminderRunning(true);
    try {
      const res = await fetch(`/api/fiaon/admin/payments/run-reminders`, { method: "POST", credentials: "include" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        flash(json.skippedWindow
          ? `✓ Lauf abgeschlossen: ${json.expired}× abgelaufen — Erinnerungen übersprungen (Engine aus oder außerhalb 08–20 Uhr)`
          : `✓ Lauf abgeschlossen: ${json.remindersSent}× Zahlungserinnerung (payment_reminder), ${json.expired}× abgelaufen`);
        load(tab);
        loadStats();
      } else {
        flash(`Fehler: ${json?.error || res.status}`);
      }
    } catch {
      flash("Netzwerkfehler");
    } finally {
      setReminderRunning(false);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ERSTE RECHNUNGEN
  //
  // Kunden mit fertigem Antrag, denen nie eine Rechnung geschickt wurde. Sie
  // stehen auf `payment_status = pending` und werden vom Mahnlauf deshalb nicht
  // erfasst — der sucht `pending_payment`.
  // ══════════════════════════════════════════════════════════════════════════
  const [ersteVorschau, setErsteVorschau] = useState<{
    gesamt: number; versendbar: number; summeCents: number;
    hindernisse: Record<string, number>;
    aelteste: { name: string; paket: string; tageAlt: number; betragCents: number }[];
    laeuft: boolean;
    letzterLauf: { am: string; versendet: number; gescheitert: number } | null;
  } | null>(null);
  const [ersteDialog, setErsteDialog] = useState(false);
  const [ersteLaeuft, setErsteLaeuft] = useState(false);

  const ersteVorschauHolen = useCallback(async () => {
    const r = await fetch("/api/fiaon/admin/rechnungen/erste/vorschau", { credentials: "include" })
      .catch(() => null);
    const j = await r?.json().catch(() => null);
    if (j?.ok) { setErsteVorschau(j); setErsteLaeuft(!!j.laeuft); }
  }, []);

  useEffect(() => { void ersteVorschauHolen(); }, [ersteVorschauHolen]);

  // Während ein Lauf läuft, jede fünf Sekunden nachsehen. Ein Versand von 264
  // Mails dauert Minuten — ohne Rückmeldung klickt der Betreiber ein zweites Mal.
  useEffect(() => {
    if (!ersteLaeuft) return;
    const uhr = window.setInterval(() => void ersteVorschauHolen(), 5000);
    return () => window.clearInterval(uhr);
  }, [ersteLaeuft, ersteVorschauHolen]);

  const oeffneErsteRechnungen = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await ersteVorschauHolen();
    setErsteDialog(true);
  };

  const ersteRechnungenSenden = async () => {
    setErsteLaeuft(true);
    setErsteDialog(false);
    const r = await fetch("/api/fiaon/admin/rechnungen/erste/senden",
      { method: "POST", credentials: "include" }).catch(() => null);
    const j = await r?.json().catch(() => null);
    flash(j?.ok ? j.meldung : `Fehler: ${j?.error ?? "Netzwerk"}`);
    if (!j?.ok) setErsteLaeuft(false);
  };

  // ── Paket W: Bulk-Versand ──
  const openBulkDialog = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/fiaon/admin/payments/bulk-reminder/preview`, { credentials: "include" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        setBulkPreview(json);
        setBulkDialog(true);
      } else {
        flash(`Fehler: ${json?.error || res.status}`);
      }
    } catch {
      flash("Netzwerkfehler");
    }
  };

  const pollBulk = useCallback(() => {
    clearInterval(bulkPoll.current);
    bulkPoll.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/fiaon/admin/payments/bulk-reminder/status`, { credentials: "include" });
        const json = await res.json().catch(() => null);
        if (json?.ok && json.job) {
          setBulkJob(json.job);
          if (!json.job.running) {
            clearInterval(bulkPoll.current);
            loadStats();
            flash(`✓ Bulk-Versand abgeschlossen: ${json.job.sent} versendet, ${json.job.errors} Fehler`);
          }
        }
      } catch {}
    }, 2500);
  }, [loadStats]);

  useEffect(() => () => clearInterval(bulkPoll.current), []);

  // Läuft beim Seitenaufruf bereits ein Bulk-Job (z. B. nach Reload)? → Fortschritt wieder anzeigen
  useEffect(() => {
    fetch(`/api/fiaon/admin/payments/bulk-reminder/status`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok && j.job?.running) {
          setBulkJob(j.job);
          pollBulk();
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startBulk = async () => {
    setBulkDialog(false);
    try {
      const res = await fetch(`/api/fiaon/admin/payments/bulk-reminder/start`, { method: "POST", credentials: "include" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        setBulkJob({ running: true, startedAt: new Date().toISOString(), finishedAt: null, planned: json.planned, sent: 0, errors: 0 });
        pollBulk();
      } else {
        flash(`Fehler: ${json?.error || res.status}`);
      }
    } catch {
      flash("Netzwerkfehler");
    }
  };

  // Paket DE: Formular zurücksetzen, wenn ein anderer Kunde geöffnet wird
  useEffect(() => { setContactEdit(null); }, [detail?.ref]);

  const startContactEdit = () => {
    if (!detail) return;
    setContactEdit({
      firstName: detail.first_name || "",
      lastName: detail.last_name || "",
      email: customerEmail(detail) === "—" ? "" : customerEmail(detail),
      phone: detail.phone ? `${detail.phone_country_code || ""}${detail.phone}` : (detail.contact_phone || ""),
      street: detail.street || "",
      zip: detail.zip || "",
      city: detail.city || "",
    });
  };

  const saveContactEdit = async () => {
    if (!detail || !contactEdit) return;
    setContactBusy(true);
    try {
      const res = await fetch(`/api/fiaon/admin/applications/${encodeURIComponent(detail.ref)}/contact`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({
          firstName: contactEdit.firstName.trim(), lastName: contactEdit.lastName.trim(),
          email: contactEdit.email.trim(), phone: contactEdit.phone.trim(),
          street: contactEdit.street.trim(), zip: contactEdit.zip.trim(), city: contactEdit.city.trim(),
        }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        const changed = (json.changes || []).map((c: any) => c.field).join(", ");
        flash(changed ? `Stammdaten aktualisiert (${changed}) — jede Änderung ist im Audit-Log protokolliert.` : "Keine Änderungen.");
        if (json.duplicate) flash(`Achtung: E-Mail gehört bereits zu ${json.duplicate.name} (${json.duplicate.ref}) — mögliche Dublette.`);
        setContactEdit(null);
        setDetail(null);
        load(tab);
      } else {
        flash(json?.error || "Fehler beim Speichern");
      }
    } catch {
      flash("Netzwerkfehler");
    } finally {
      setContactBusy(false);
    }
  };

  // Paket DC: präzise Suche — tokenisiert (Wortreihenfolge egal, „Max Müller“ =
  // „Müller Max“) + Telefonsuche über normalisierte Ziffern (+49/0049/0/Format egal).
  const q = search.trim().toUpperCase();
  const qTokens = q.split(/\s+/).filter(Boolean);
  const qDigits = (() => {
    let d = search.replace(/\D/g, "");
    if (d.length < 5) return null;
    if (d.startsWith("00")) d = d.slice(2);
    if (d.startsWith("49")) d = d.slice(2);
    else if (d.startsWith("0")) d = d.slice(1);
    return d.length >= 5 ? d : null;
  })();
  const gefiltert = q
    ? rows.filter((r) => {
        if (qDigits) {
          const phoneDigits = `${r.phone_country_code || ""}${r.phone || ""}${r.contact_phone || ""}`.replace(/\D/g, "");
          if (phoneDigits.includes(qDigits)) return true;
        }
        const hay = `${r.payment_reference || ""} ${r.ref || ""} ${customerName(r)} ${customerEmail(r)}`.toUpperCase();
        return qTokens.every((t) => hay.includes(t));
      })
    : rows;

  /** Der maßgebliche Zeitpunkt einer Zeile: bei angekündigten Zahlungen der
   *  Zeitpunkt der Ankündigung, sonst der Bestelleingang. */
  const zeitpunkt = (r: PaymentRow) =>
    new Date((r.payment_status === "claimed_paid" ? r.claimed_paid_at : null) || r.created_at || 0).getTime();

  // Standard: NEUESTE ZUERST (nach Datum und Uhrzeit). Die Gegenansicht
  // „längste Wartezeit zuerst“ bleibt einen Klick entfernt — sie ist die
  // richtige Sicht, wenn man den Rückstand abarbeitet.
  const filtered = [...gefiltert].sort((a, b) => {
    if (tab === "alle") {
      const so = (STATUS_ORDER[a.payment_status] ?? 9) - (STATUS_ORDER[b.payment_status] ?? 9);
      if (so !== 0) return so;
    }
    return sortNeu ? zeitpunkt(b) - zeitpunkt(a) : zeitpunkt(a) - zeitpunkt(b);
  });

  return (
    <div className="text-slate-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* ── Kopf: Titel und Zustand. Die Knöpfe stehen NICHT mehr hier oben,
            sondern jeweils bei der Sache, auf die sie wirken: Erinnerungen in
            der Werkzeugleiste über der Liste, Rechnungen bei den Rechnungen.
            Ein Knopf, der Mails an 159 Kunden schickt, gehört nicht neben die
            Seitenüberschrift, wo man ihn im Vorbeigehen trifft. ── */}
        <div className="flex items-end justify-between gap-4 mb-4">
          <div className="min-w-0">
            <h1 className="text-[22px] sm:text-[26px] font-bold text-slate-900 tracking-[-.02em]">Zahlungszentrale</h1>
            <p className="text-[12.5px] text-slate-500 mt-0.5">
              Angekündigte Zahlungen prüfen und freischalten · Abo-Raten · Auszahlungen · Dubletten
            </p>
          </div>
          <button
            type="button"
            onClick={() => { load(tab); loadStats(); }}
            disabled={loading}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border text-[12.5px] font-semibold text-slate-600 disabled:opacity-50"
            style={{ borderColor: "var(--a3-linie,#e4e9f2)" }}
          >
            {loading ? "Lädt …" : "Aktualisieren"}
          </button>
        </div>

        {/* Paket W: Fortschritt des Bulk-Jobs */}
        {bulkJob && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-white border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <p className="text-[13px] font-semibold text-slate-800">
                {bulkJob.running ? "Bulk-Zahlungserinnerung läuft …" : "Bulk-Zahlungserinnerung abgeschlossen"}
              </p>
              <p className="text-[12px] text-slate-500 tabular-nums">
                {bulkJob.sent} / {bulkJob.planned} versendet{bulkJob.errors > 0 ? ` · ${bulkJob.errors} Fehler` : ""}
                {!bulkJob.running && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); setBulkJob(null); }} className="ml-3 font-semibold text-slate-400 hover:text-slate-600">Ausblenden</button>
                )}
              </p>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#2563eb] transition-all duration-700"
                style={{ width: `${bulkJob.planned > 0 ? Math.min(100, Math.round(((bulkJob.sent + bulkJob.errors) / bulkJob.planned) * 100)) : 100}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">Versand in Batches (max. 20 E-Mails/Minute) — du kannst die Seite verlassen, der Versand läuft im Hintergrund weiter.</p>
          </div>
        )}

        {message && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-[13px] font-semibold text-blue-800">
            {message}
          </div>
        )}

        {/* ── Kennzahlen — jede führt in die Namensliste dahinter ──────────────
            Vorher waren es Anzeigetafeln: „46 Bestellungen“ ohne die Möglichkeit
            zu sehen, WELCHE. Jetzt öffnet jede Kachel dieselbe Detailliste wie
            im Dashboard, mit Akte, Anruf und Mail je Zeile. ── */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3 mb-4">
            {[
              {
                label: "Offen — keine Reaktion",
                wert: `${stats.pending.sum.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`,
                unter: `${stats.pending.count} Bestellungen`,
                art: "offen-alle" as ListenArt, ton: undefined,
                hilfe: "Bestellung liegt, Zahlung fehlt, und der Kunde hat sich nicht gemeldet. Nach sieben Tagen läuft sie in „abgelaufen“ — sichtbar bleibt sie trotzdem.",
              },
              {
                label: zahlungsstatusText("claimed_paid"),
                wert: `${stats.claimed.sum.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`,
                unter: `${stats.claimed.count} warten auf Freischaltung`,
                art: "angekuendigt-alle" as ListenArt, ton: "offen" as const,
                hilfe: "Der Kunde hat „Ich habe überwiesen“ gemeldet. Eingang prüfen (Verwendungszweck = Zahlungsreferenz) und freischalten. Das ist die eigentliche Arbeitsliste.",
              },
              {
                label: "Bestätigt bezahlt",
                wert: `${stats.paid.sum.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`,
                unter: `${stats.paid.count} bezahlt`,
                art: "bezahlt-alle" as ListenArt, ton: "geld" as const,
                hilfe: "Alle bestätigten Erstzahlungen. Ab dieser Buchung läuft die Abo-Uhr: 30 Tage später ist die erste Monatsrate fällig.",
              },
              {
                label: "Bestätigungsquote",
                wert: stats.confirmationRate === null ? "—" : `${stats.confirmationRate} %`,
                unter: "bezahlt / angekündigt",
                art: "angekuendigt-alt" as ListenArt, ton: undefined,
                hilfe: "Wie viele der angekündigten Zahlungen tatsächlich bestätigt wurden. Ein Klick zeigt die verdächtigen Fälle: seit über sieben Tagen angekündigt, nie bestätigt.",
              },
              {
                label: "Erinnerungen heute",
                wert: String(stats.remindersToday ?? 0),
                unter: "Motor, Sammelversand und Team zusammen",
                art: "erinnert-heute" as ListenArt, ton: undefined,
                hilfe: "Zahlungserinnerungen des heutigen Tages. Ein Klick zeigt, WER sie bekommen hat und wie oft insgesamt schon erinnert wurde.",
              },
            ].map((k, i) => (
              // DIV mit echtem Knopf darin, nicht selbst ein Knopf: das ⓘ ist
              // ebenfalls bedienbar, und Bedienelement-in-Bedienelement ist
              // ungültiges HTML — Tastatur und Vorleseprogramm erreichen die
              // Erklärung dann nie.
              <div
                key={k.label}
                onClick={() => setFenster(k.art)}
                className="a3-kachel a3-auf a3-hebt p-4 pl-[18px] text-left w-full cursor-pointer"
                data-ton={k.ton}
                style={{ ["--i" as any]: i }}
              >
                <div className="flex items-start gap-1.5">
                  <span className="flex-1 min-w-0 text-[10px] font-semibold uppercase tracking-[.07em] text-slate-500 leading-tight">{k.label}</span>
                  {/* Das ⓘ braucht eigenen Platz — sonst schiebt sich die
                      umbrechende Beschriftung darunter. */}
                  <span className="shrink-0 mt-[-1px]" onClick={(e) => e.stopPropagation()}><Tip text={k.hilfe} /></span>
                </div>
                <span className="block mt-2 text-[20px] sm:text-[22px] font-bold text-slate-900 a3-zahl leading-none">{k.wert}</span>
                <span className="block mt-1.5 text-[11.5px] text-slate-500 leading-snug">{k.unter}</span>
                <button type="button" onClick={(e) => { e.stopPropagation(); setFenster(k.art); }}
                  className="mt-1.5 text-[11px] font-semibold inline-flex items-center gap-1" style={{ color: ACCENT }}>
                  Wer? →
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Abo — die monatliche Paketrate ── */}
        <AboTafel onMeldung={flash} />

        {/* Paket W: Bestätigungsdialog Bulk-Versand */}
        {/* ══════════════════════════════════════════════════════════════════
            ERSTE RECHNUNGEN — DER DIALOG

            Er zeigt, was passiert, BEVOR es passiert: wie viele, wie viel Geld,
            wer am längsten wartet und was die anderen blockiert. Ein Knopf, der
            264 Mails auslöst, ohne zu sagen an wen, ist eine Zumutung.
            ══════════════════════════════════════════════════════════════════ */}
        {ersteDialog && ersteVorschau && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center px-4" onClick={() => setErsteDialog(false)}>
            <div className="absolute inset-0 bg-slate-900/40" />
            <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl p-6 shadow-xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-[15px] font-bold text-slate-900 mb-1">
                Erste Rechnung an alle mit fertigem Antrag
              </h3>
              <p className="text-[12.5px] text-slate-500 mb-4">
                Diese Kunden haben einen abgeschlossenen Antrag, aber nie eine Rechnung
                bekommen. Sie erhalten Betrag, Verwendungszweck und sieben Tage Frist
                (Make: <code className="font-mono text-[12px]">payment_details</code>).
              </p>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 mb-4 text-[13px] space-y-1">
                <p>
                  <b className="tabular-nums">{ersteVorschau.versendbar}</b> Kunden bekommen
                  jetzt ihre erste Rechnung — zusammen{" "}
                  <b className="tabular-nums">
                    {(ersteVorschau.summeCents / 100).toLocaleString("de-DE",
                      { minimumFractionDigits: 2 })} €
                  </b>.
                </p>
                {Object.entries(ersteVorschau.hindernisse).map(([grund, n]) => (
                  <p key={grund} className="text-slate-500">
                    <b className="tabular-nums">{n}</b> übersprungen: {grund.toLowerCase()}.
                  </p>
                ))}
              </div>

              {ersteVorschau.aelteste.length > 0 && (
                <div className="mb-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[.07em] text-slate-400 mb-1.5">
                    Die am längsten warten
                  </p>
                  <div className="space-y-1">
                    {ersteVorschau.aelteste.map((a, i) => (
                      <p key={i} className="text-[12.5px] flex gap-2">
                        <span className="font-medium text-slate-700 truncate">{a.name}</span>
                        <span className="text-slate-400">{a.paket}</span>
                        <span className="ml-auto shrink-0 tabular-nums text-slate-500">
                          {a.tageAlt} Tage
                        </span>
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Der ehrliche Hinweis: Das sind alte Anträge. */}
              <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                Viele dieser Anträge liegen zwei Monate und länger. Für den Kunden kommt
                die Rechnung aus dem Nichts — die Agenten sollten die ältesten Fälle
                vorher anrufen. Der Filter „Rechnung stellen“ in der Kundenliste zeigt
                sie ihnen.
              </p>

              {ersteVorschau.letzterLauf && (
                <p className="text-[12px] text-slate-500 mb-4">
                  Letzter Lauf: {ersteVorschau.letzterLauf.versendet} verschickt
                  {ersteVorschau.letzterLauf.gescheitert > 0
                    && `, ${ersteVorschau.letzterLauf.gescheitert} gescheitert`}.
                </p>
              )}

              <div className="flex gap-2 justify-end">
                <button type="button"
                        onClick={(e) => { e.stopPropagation(); setErsteDialog(false); }}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-600 hover:border-slate-300">
                  Abbrechen
                </button>
                <button type="button"
                        onClick={(e) => { e.stopPropagation(); void ersteRechnungenSenden(); }}
                        disabled={ersteVorschau.versendbar === 0 || ersteVorschau.laeuft}
                        className="px-4 py-2.5 rounded-xl text-white text-[13px] font-semibold bg-[#2563eb] hover:bg-[#1d4fd7] disabled:opacity-40">
                  Jetzt {ersteVorschau.versendbar} Rechnungen stellen
                </button>
              </div>
            </div>
          </div>
        )}

        {bulkDialog && bulkPreview && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center px-4" onClick={() => setBulkDialog(false)}>
            <div className="absolute inset-0 bg-slate-900/40" />
            <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-[15px] font-bold text-slate-900 mb-3">Zahlungserinnerung an alle offenen senden?</h3>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 mb-4 text-[13px] space-y-1">
                <p><b className="tabular-nums">{bulkPreview.eligible}</b> Kunden erhalten jetzt die Zahlungsdaten-Erinnerung (Make: <code className="font-mono text-[12px]">payment_reminder</code>).</p>
                <p className="text-slate-500"><b className="tabular-nums">{bulkPreview.skipped}</b> Kunden werden übersprungen (bereits in den letzten 20 Stunden erinnert).</p>
              </div>
              {!bulkPreview.withinWindow && (
                <p className="text-[12px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                  Versand nur zwischen 08:00 und 20:00 Uhr (Europa/Berlin) möglich.
                </p>
              )}
              <p className="text-[12px] text-slate-500 mb-4">Versand in Batches von 20 E-Mails pro Minute — läuft im Hintergrund, Fortschritt oben auf der Seite.</p>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={(e) => { e.stopPropagation(); setBulkDialog(false); }} className="px-4 py-2.5 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-600 hover:border-slate-300">Abbrechen</button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); startBulk(); }}
                  disabled={!bulkPreview.withinWindow || bulkPreview.eligible === 0 || bulkPreview.jobRunning}
                  className="px-4 py-2.5 rounded-xl text-white text-[13px] font-semibold bg-[#2563eb] hover:bg-[#1d4fd7] disabled:opacity-40"
                >
                  Jetzt an {bulkPreview.eligible} Kunden senden
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Erstzahlungen: Filter, Suche, Werkzeuge, Liste — alles in EINER
            Tafel, damit sichtbar ist, worauf die Werkzeuge wirken. ── */}
        <section className="a3-tafel mb-4">
          <header className="a3-tafel-kopf flex-wrap">
            <h2 className="text-[14px] font-bold text-slate-900">Erstzahlungen</h2>
            <Tip text="Die erste Zahlung eines Kunden: Sie schaltet den Zugang frei. Die monatlichen Folgeraten stehen in der Abo-Tafel darüber. Bezahlte und abgeschlossene Bestellungen findest du außerdem unter Anträge & KYC." />
            <span className="a3-reiter ml-auto">
              {([
                { key: "claimed_paid", label: `Angekündigt${stats ? ` ${stats.claimed.count}` : ""}` },
                { key: "pending_payment", label: `Offen${stats ? ` ${stats.pending.count}` : ""}` },
                { key: "expired", label: "Abgelaufen" },
                { key: "paid", label: `Bezahlt${stats ? ` ${stats.paid.count}` : ""}` },
                { key: "alle", label: "Alle" },
              ] as const).map((t) => (
                <button key={t.key} type="button" data-an={tab === t.key ? "1" : undefined}
                  onClick={(e) => { e.stopPropagation(); setTab(t.key); }}>
                  {t.label}
                </button>
              ))}
            </span>
          </header>

          {/* Werkzeugleiste: Suche, Sortierung und die Versand-Knöpfe.
              Die Erinnerungs-Knöpfe stehen bewusst HIER — direkt über der Liste
              der offenen Zahlungen, auf die sie wirken. */}
          <div className="px-3.5 sm:px-4 py-3 flex flex-wrap items-center gap-2"
            style={{ boxShadow: "inset 0 -1px 0 rgba(226,232,240,.8)" }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Referenz, Name, E-Mail oder Telefon …"
              className="h-[34px] px-3 rounded-lg border bg-white text-[12.5px] outline-none flex-1 min-w-[180px]"
              style={{ borderColor: "var(--a3-linie,#e4e9f2)" }}
            />
            <span className="a3-reiter shrink-0">
              <button type="button" data-an={sortNeu ? "1" : undefined} onClick={() => setSortNeu(true)}>Neueste zuerst</button>
              <button type="button" data-an={!sortNeu ? "1" : undefined} onClick={() => setSortNeu(false)}>Längste Wartezeit</button>
            </span>
            <span className="flex items-center gap-2 shrink-0">
              {/* ══════════════════════════════════════════════════════════════
                  ERSTE RECHNUNGEN

                  ── DER AUFTRAG (11.08.2026) ──────────────────────────────────
                  „Ich möchte als Admin eine eigene Seite, wo ich ALLE Rechnungen
                  mit einem Knopfdruck versenden kann — oder in der
                  Zahlungszentrale hinzufügen."

                  Hier, nicht auf einer eigenen Seite: Wer über Zahlungen
                  nachdenkt, ist genau hier. Eine zweite Seite für einen Knopf
                  wäre ein Ort mehr, an dem man nachsehen muss.

                  ── WARUM NICHT DER KNOPF DANEBEN ─────────────────────────────
                  „Erinnerung an alle offenen" mahnt Kunden, die eine Rechnung
                  HABEN. Diese hier haben nie eine bekommen — eine Mahnung wäre
                  sachlich falsch und unhöflich.
                  ══════════════════════════════════════════════════════════════ */}
              <button
                type="button"
                onClick={oeffneErsteRechnungen}
                disabled={ersteLaeuft}
                className="a3-knopf inline-flex"
                data-haupt="1"
                title="Stellt allen Kunden mit fertigem Antrag die ERSTE Rechnung — mit Betrag, Verwendungszweck und Zahlungsfrist"
              >
                {ersteLaeuft ? "Rechnungen laufen …"
                  : ersteVorschau?.versendbar
                    ? `Erste Rechnung an ${ersteVorschau.versendbar}`
                    : "Erste Rechnungen"}
              </button>
              <button
                type="button"
                onClick={openBulkDialog}
                disabled={Boolean(bulkJob?.running)}
                className="a3-knopf inline-flex"
                data-haupt="1"
                title="Sendet payment_reminder an alle offenen Bestellungen — mit Vorschau und Bestätigung"
              >
                {bulkJob?.running ? "Sammelversand läuft …" : "Erinnerung an alle offenen"}
              </button>
              <button
                type="button"
                onClick={runReminders}
                disabled={reminderRunning}
                className="a3-knopf inline-flex"
                title="Startet den täglichen Reminder-Lauf sofort (Engine): Erinnerungen + Ablauf-Prüfung"
              >
                {reminderRunning ? "Läuft …" : "Erinnerungs-Lauf"}
              </button>
              <a
                href="/api/fiaon/admin/invoices/download-all"
                onClick={(e) => e.stopPropagation()}
                className="a3-knopf hidden sm:inline-flex"
                title="Alle Rechnungen als ZIP (ein PDF je Kunde + CSV-Übersicht)"
              >
                Rechnungen (ZIP)
              </a>
            </span>
          </div>

          {/* ── Karten statt Breittabelle ─────────────────────────────────────
              Die Tabelle hatte neun Spalten und musste seitwärts geschoben
              werden — auf dem Handy war sie unbenutzbar, und auch am Schreibtisch
              sucht niemand einen Kunden über neun Spalten. Eine Karte zeigt die
              drei Dinge, die zum Zuordnen einer Überweisung reichen:
              Verwendungszweck, Name, Betrag. Alles Weitere steht einen Klick
              entfernt in der Akte. */}
          <div className="p-3 sm:p-3.5 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {loading && <p className="col-span-full px-1 py-8 text-center text-[13px] text-slate-400">Lädt …</p>}
            {!loading && filtered.length === 0 && (
              <p className="col-span-full px-1 py-10 text-center text-[13px] text-slate-400">
                {q ? "Keine Treffer für deine Suche." : "Keine Bestellungen in diesem Status."}
              </p>
            )}
            {!loading && filtered.map((r, i) => {
              const wartet = r.payment_status === "claimed_paid";
              const kante = wartet ? "#d97706" : r.payment_status === "paid" ? "#059669"
                : r.payment_status === "expired" ? "#dc2626" : "transparent";
              return (
                // Die Karte ist ein DIV, kein Button. Vorher steckten die
                // Handlungen in einem Button — verschachtelte Bedienelemente
                // sind ungültiges HTML: Vorleseprogramme und Tastatur sehen nur
                // EIN Element, und selbst der automatische Test traf immer nur
                // die Karte. Jetzt sind „bezahlt buchen" und „Details" echte
                // Knöpfe, die Karte bleibt für die Maus trotzdem anklickbar.
                <div
                  key={r.payment_reference}
                  onClick={() => openDetail(r)}
                  className="a3-kachel a3-auf a3-hebt p-3.5 pl-[18px] text-left w-full cursor-pointer"
                  style={{ ["--i" as any]: Math.min(i, 8), borderLeft: `3px solid ${kante}` }}
                >
                  {/* Zeile 1: Verwendungszweck und Betrag — die zwei Werte, mit
                      denen man den Kontoauszug vergleicht. */}
                  <span className="flex items-start gap-2">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-bold a3-zahl truncate" style={{ color: ACCENT }}>
                        {r.payment_reference}
                      </span>
                      <span className="block text-[14px] font-bold text-slate-900 truncate mt-0.5">{customerName(r)}</span>
                    </span>
                    <span className="shrink-0 text-[15px] font-bold text-slate-900 a3-zahl">{fmtAmount(r.amount_due)}</span>
                  </span>

                  {/* Zeile 2: Zustand in Klartext, nicht als Spaltensalat. */}
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2">
                    <StatusBadge status={r.payment_status} />
                    {wartet && r.claimed_paid_at && (
                      <span className="text-[11.5px] font-semibold text-amber-700">
                        gemeldet {fmtDateTime(r.claimed_paid_at)}
                      </span>
                    )}
                    {!wartet && (
                      <span className="text-[11.5px] text-slate-400">angelegt {fmtDate(r.created_at)}</span>
                    )}
                    {r.promised_pay_date && r.payment_status !== "paid" && (
                      <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md"
                        style={{ background: "rgba(29,78,216,.07)", color: "#1d4ed8" }}>
                        Zusage {fmtDate(r.promised_pay_date)}
                      </span>
                    )}
                  </span>

                  {/* Zeile 3: Paket, klein — Kontext, keine Hauptrolle. */}
                  {r.pack_name && (
                    <span className="block mt-1.5 text-[11px] text-slate-400 truncate">
                      {r.pack_name.replace(/\n/g, " ")}
                    </span>
                  )}

                  {/* Handlungen: genau die, die man ohne Detailansicht braucht. */}
                  <span className="flex flex-wrap items-center gap-1.5 mt-2.5">
                    {(r.payment_status === "pending_payment" || r.payment_status === "claimed_paid") && (
                      <button type="button" className="a3-knopf inline-flex" data-haupt="1"
                        disabled={actionRef === r.payment_reference}
                        onClick={(e) => { e.stopPropagation(); buchenOeffnen(r); }}>
                        <Check size={12} /> bezahlt buchen
                      </button>
                    )}
                    {r.payment_status === "expired" && (
                      <button type="button" className="a3-knopf inline-flex" data-haupt="1"
                        disabled={actionRef === r.payment_reference}
                        onClick={(e) => reactivate(e, r.payment_reference)}>
                        Reaktivieren
                      </button>
                    )}
                    <button type="button" className="a3-knopf inline-flex"
                      onClick={(e) => { e.stopPropagation(); openDetail(r); }}>
                      Details
                    </button>
                    <a href={`/admin/kunde/${encodeURIComponent(r.ref)}`} onClick={(e) => e.stopPropagation()}
                      className="a3-knopf inline-flex">Akte</a>
                    <a href={`/api/fiaon/admin/payments/${encodeURIComponent(r.payment_reference)}/invoice.pdf`}
                      target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                      className="a3-knopf hidden sm:inline-flex">Rechnung</a>
                  </span>
                </div>
              );
            })}
          </div>
          {/* Fuß: Kontodaten dort, wo man die Zahlung prüft — nicht irgendwo
              weiter unten auf der Seite. */}
          <div className="px-4 py-2.5 text-[11px] text-slate-400" style={{ background: "#fbfcfe" }}>
            Bankkonto FIAON LTD · DE86 2022 0800 0047 7193 24 · SXPYDEHH (Banking Circle, seit 02.09.2026 — Wise-Konto gesperrt) — Zuordnung ausschließlich über den Verwendungszweck
            {filtered.length > 0 && ` · ${filtered.length} Zeile${filtered.length === 1 ? "" : "n"} angezeigt`}
          </div>
        </section>

        {/* ── PROMPT 1/2: globale Suchtreffer — JEDER Treffer öffnet die AKTE ──
            (ersetzt den früheren, nicht klickbaren Treffer-Block „Paket DC“:
            Kunden setzten nur den Suchtext, Leads waren gar nicht klickbar.) */}
        {q && serverHits && (() => {
          const localRefs = new Set(rows.map((r) => r.ref));
          const extra = serverHits.customers.filter((c: any) => !localRefs.has(c.ref));
          if (extra.length === 0 && serverHits.leads.length === 0) return null;
          return (
            <div className="mt-4 bg-white border border-slate-200 rounded-2xl p-5">
              <h2 className="text-[13px] font-bold text-slate-900 mb-1">Weitere Treffer (alle Status & Leads)</h2>
              <p className="text-[11.5px] text-slate-400 mb-3">
                Gefunden über die globale Suche — jeder Klick öffnet die Kundenakte (eine Seite, alles).
              </p>
              {extra.length > 0 && (
                <div className="divide-y divide-slate-50 border border-slate-100 rounded-xl overflow-hidden mb-3">
                  {extra.map((c: any) => (
                    <a
                      key={c.ref}
                      href={`/admin/kunde/${encodeURIComponent(c.ref)}`}
                      className="w-full px-4 py-2.5 flex items-center justify-between gap-3 text-left hover:bg-slate-50/70 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-slate-900 truncate">
                          {c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || c.contact_name || "—"}
                          <span className="ml-2 font-mono text-[11px] text-slate-400">{c.payment_reference || c.ref}</span>
                        </p>
                        {/* Beschriftet, nicht nur „Betreut von" (30.08.2026):
                            In der Zahlungsansicht kann derselbe Mensch einen
                            Vertriebs- UND einen Inkasso-Zuständigen haben. Ein
                            Name ohne Rolle liest sich wie ein Widerspruch. */}
                        <p className="text-[11px] text-slate-400 truncate">
                          {c.email || "—"} · {LABEL_VERTRIEB}: {zustaendigText(c.assigned_agent_name)}
                        </p>
                        {/* ── PROVISION ODER WAND, NIE EIN LEERES FELD ──────
                            „Wenn eine Provision existiert, wird sie angezeigt;
                            wenn die Wand griff (Selbstzahler), steht DAS da."
                            GEMESSEN an 409 bezahlten Bestellungen: 244 mit
                            Provision, 104 als Direktzahler vermerkt, 61 ohne
                            beides. Für die 61 steht jetzt „kein Vermerk" da —
                            eine sichtbare Lücke ist ehrlich, eine gefüllte
                            wäre eine Behauptung. */}
                        {(c.payment_status === "paid" || c.payment_status === "claimed_paid") && (
                          <p className="text-[11px] truncate">
                            <span className="text-slate-400">Provision: </span>
                            {c.provision_cents != null && c.provision_cents !== 0 ? (
                              <span className="font-semibold text-emerald-700">
                                {(c.provision_cents / 100).toFixed(2).replace(".", ",")} €
                              </span>
                            ) : c.commission_basis === "direktzahler" ? (
                              <span className="text-slate-500"
                                    title={c.commission_basis_note || undefined}>
                                Direktzahler — keine Provision
                              </span>
                            ) : c.commission_basis ? (
                              <span className="text-slate-500"
                                    title={c.commission_basis_note || undefined}>
                                {c.commission_basis} — nicht gebucht
                              </span>
                            ) : (
                              <span className="text-amber-700">
                                kein Vermerk — bitte prüfen
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                      <span className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={c.payment_status} />
                        <span className="text-[12px] font-bold text-[#2563eb]">Akte öffnen →</span>
                      </span>
                    </a>
                  ))}
                </div>
              )}
              {serverHits.leads.length > 0 && (
                <div className="divide-y divide-slate-50 border border-slate-100 rounded-xl overflow-hidden">
                  {serverHits.leads.map((l: any) => (
                    <a key={l.id} href={`/admin/kunde/lead-${l.id}`} className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-slate-700 truncate">
                          {[l.vorname, l.nachname].filter(Boolean).join(" ") || l.email || l.telefon || `Lead #${l.id}`}
                          <span className="ml-2 px-1.5 py-0.5 rounded border border-slate-200 text-[10px] font-semibold text-slate-500">Lead</span>
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {l.telefon || l.email || "—"} · Status: {l.status}{l.assigned_agent_name ? ` · ${l.assigned_agent_name}` : ""}
                        </p>
                      </div>
                      <span className="text-[12px] font-bold text-[#2563eb] shrink-0">Akte öffnen →</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Verwaltungswerkzeuge liegen jetzt dort, wo sie hingehoeren ──
            Dubletten (inkl. Alt-Bestand-Bereinigung und Aufraeumlauf) leben unter
            /admin/dubletten, Auszahlungen unter /admin/auszahlungen. Diese Seite
            ist Zahlungszentrale — nichts anderes. */}
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          <a href="/admin/dubletten" id="dubletten" className="a3-kachel p-4 flex items-start gap-3 scroll-mt-16">
            <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(180deg,#fff,#f1f5f9)", color: "#475569", boxShadow: "inset 0 1px 0 #fff, 0 1px 3px rgba(15,23,42,.12)" }}>
              <Copy size={16} strokeWidth={1.8} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-bold text-slate-900">Dubletten</span>
              <span className="block text-[11.5px] text-slate-500 leading-snug mt-0.5">
                Mehrfach angelegte Personen zusammenfuehren, Alt-Bestand bereinigen, Aufraeumlauf
              </span>
            </span>
            <ChevronRight size={15} className="text-slate-300 shrink-0 mt-1.5" />
          </a>
          <a href="/admin/auszahlungen" id="auszahlungen" className="a3-kachel p-4 flex items-start gap-3 scroll-mt-16">
            <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(180deg,#fff,#f1f5f9)", color: "#475569", boxShadow: "inset 0 1px 0 #fff, 0 1px 3px rgba(15,23,42,.12)" }}>
              <Banknote size={16} strokeWidth={1.8} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-bold text-slate-900">Auszahlungen</span>
              <span className="block text-[11.5px] text-slate-500 leading-snug mt-0.5">
                Provisions-Anforderungen des Teams freigeben oder ablehnen
              </span>
            </span>
            <ChevronRight size={15} className="text-slate-300 shrink-0 mt-1.5" />
          </a>
        </div>

      </div>

      {/* ── C2: Detail-Drawer mit Timeline ── */}
      {detail && (
        <div className="fixed inset-0 z-50" onClick={() => setDetail(null)}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" />
          <div
            className="absolute right-0 top-0 bottom-0 w-full sm:w-[480px] bg-white shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between">
              <div>
                <p className="font-mono text-[13px] font-bold text-[#2563eb]">{detail.payment_reference}</p>
                <p className="text-[15px] font-bold text-slate-900">{customerName(detail)}</p>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setDetail(null); }}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={detail.payment_status} />
                {detail.promised_pay_date && (
                  <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700">
                    Zusage: {fmtDate(detail.promised_pay_date)}
                  </span>
                )}
                <a
                  href={`/admin/kunde/${encodeURIComponent(detail.ref)}`}
                  className="ml-auto px-3 py-1.5 rounded-lg bg-[#2563eb] hover:bg-blue-700 text-white text-[11.5px] font-bold transition-colors"
                  title="Die zentrale Kundenakte: Stammdaten, Zahlungen, Mails, Agent, Verlauf, Dubletten"
                >
                  Akte öffnen →
                </a>
              </div>

              <div className="grid grid-cols-2 gap-3 text-[13px]">
                <div><p className="text-[10px] uppercase font-bold text-slate-400">E-Mail</p><p className="font-semibold break-all">{customerEmail(detail)}</p></div>
                <div><p className="text-[10px] uppercase font-bold text-slate-400">Telefon</p><p className="font-semibold">{customerPhone(detail)}</p></div>
                <div><p className="text-[10px] uppercase font-bold text-slate-400">Paket</p><p className="font-semibold">{(detail.pack_name || "—").replace(/\n/g, " ")}</p></div>
                <div><p className="text-[10px] uppercase font-bold text-slate-400">Betrag</p><p className="font-semibold">{fmtAmount(detail.amount_due)}</p></div>
                <div><p className="text-[10px] uppercase font-bold text-slate-400">Rechnung</p><p className="font-mono font-semibold">{detail.invoice_number || "—"}</p></div>
                <div><p className="text-[10px] uppercase font-bold text-slate-400">Fällig</p><p className="font-semibold">{fmtDate(detail.payment_due_date)}</p></div>
                <div className="col-span-2"><p className="text-[10px] uppercase font-bold text-slate-400">Adresse</p><p className="font-semibold">{[detail.street, [detail.zip, detail.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "—"}</p></div>
              </div>

              {/* Paket DE: Stammdaten + Adresse korrigieren (Audit alt→neu im Backend) */}
              {!contactEdit ? (
                !detail.gdpr_deleted_at && (
                  <button type="button" onClick={startContactEdit}
                    className="text-[12px] font-bold text-slate-500 hover:text-slate-800 transition-colors">
                    Stammdaten & Adresse korrigieren
                  </button>
                )
              ) : (
                <div className="border border-slate-200 rounded-xl p-3.5 space-y-2.5 bg-slate-50">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Stammdaten korrigieren</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" value={contactEdit.firstName} placeholder="Vorname"
                      onChange={(e) => setContactEdit((f) => f && ({ ...f, firstName: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-[13px] outline-none focus:border-[#2563eb]" />
                    <input type="text" value={contactEdit.lastName} placeholder="Nachname"
                      onChange={(e) => setContactEdit((f) => f && ({ ...f, lastName: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-[13px] outline-none focus:border-[#2563eb]" />
                  </div>
                  <input type="email" value={contactEdit.email} placeholder="E-Mail"
                    onChange={(e) => setContactEdit((f) => f && ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-[13px] outline-none focus:border-[#2563eb]" />
                  <input type="tel" value={contactEdit.phone} placeholder="Telefon (+49 …)"
                    onChange={(e) => setContactEdit((f) => f && ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-[13px] outline-none focus:border-[#2563eb]" />
                  <input type="text" value={contactEdit.street} placeholder="Straße & Hausnummer"
                    onChange={(e) => setContactEdit((f) => f && ({ ...f, street: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-[13px] outline-none focus:border-[#2563eb]" />
                  <div className="grid grid-cols-[110px_1fr] gap-2">
                    <input type="text" inputMode="numeric" value={contactEdit.zip} placeholder="PLZ"
                      onChange={(e) => setContactEdit((f) => f && ({ ...f, zip: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-[13px] outline-none focus:border-[#2563eb]" />
                    <input type="text" value={contactEdit.city} placeholder="Ort"
                      onChange={(e) => setContactEdit((f) => f && ({ ...f, city: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-[13px] outline-none focus:border-[#2563eb]" />
                  </div>
                  <p className="text-[11px] text-slate-400">Paket, Betrag, Status und Referenz sind hier bewusst nicht änderbar. Jede Änderung wird im Verlauf (alt → neu) protokolliert.</p>
                  <div className="flex gap-2">
                    <button type="button" disabled={contactBusy} onClick={saveContactEdit}
                      className="flex-1 px-4 py-2.5 rounded-lg bg-[#2563eb] hover:bg-[#1d4fd7] text-white text-[13px] font-bold transition-all disabled:opacity-50">
                      {contactBusy ? "Speichert …" : "Speichern"}
                    </button>
                    <button type="button" onClick={() => setContactEdit(null)}
                      className="px-4 py-2.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-[13px] font-bold hover:border-slate-300 transition-all">
                      Abbrechen
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {(detail.payment_status === "pending_payment" || detail.payment_status === "claimed_paid") && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); buchenOeffnen(detail); }}
                    disabled={actionRef === detail.payment_reference}
                    className="flex-1 px-4 py-3 rounded-xl text-white text-[13px] font-bold transition-all disabled:opacity-50"
                    style={{ background: `linear-gradient(180deg,${ACCENT},#1e40af)`, boxShadow: "0 4px 14px -6px rgba(29,78,216,.6)" }}
                  >
                    Als bezahlt buchen
                  </button>
                )}
                {detail.payment_status === "paid" && (
                  <button
                    type="button"
                    onClick={(e) => refund(e, detail.payment_reference)}
                    disabled={actionRef === detail.payment_reference}
                    className="flex-1 px-4 py-3 rounded-xl bg-white border border-slate-300 text-slate-600 hover:border-slate-400 text-[13px] font-bold transition-all disabled:opacity-50"
                  >
                    Zahlung stornieren / erstatten
                  </button>
                )}
                <a
                  href={`/api/fiaon/admin/payments/${encodeURIComponent(detail.payment_reference)}/invoice.pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 text-center px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-600 hover:border-slate-300 text-[13px] font-bold transition-all"
                >
                  Rechnung (PDF)
                </a>
              </div>

              {/* Paket AD3: Storno + DSGVO + Reminder-Override */}
              <div className="border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Verwaltung</p>
                {(detail.payment_status === "pending_payment" || detail.payment_status === "claimed_paid" || detail.payment_status === "expired") && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => cancelOrder(e, detail.payment_reference)}
                      disabled={actionRef === detail.payment_reference}
                      className="w-full px-4 py-2.5 rounded-lg bg-white border border-slate-300 text-slate-600 hover:border-slate-400 text-[13px] font-bold transition-all disabled:opacity-50"
                    >
                      Bestellung stornieren
                    </button>
                    <label className="flex items-start gap-2 cursor-pointer select-none px-1 py-1">
                      <input
                        type="checkbox"
                        checked={detail.allow_reminders_despite_paid}
                        onChange={(e) => toggleReminders(e as unknown as React.MouseEvent, detail)}
                        className="w-4 h-4 mt-0.5 accent-[#2563eb]"
                      />
                      <span className="text-[12px] text-slate-600">
                        Erinnerungen trotz bezahlter Schwester-Bestellung erlauben
                        <span className="block text-[11px] text-slate-400">Nur für echten Zweitkauf — sonst blockiert AD2 Erinnerungen an E-Mails mit bezahlter Bestellung.</span>
                      </span>
                    </label>
                  </>
                )}
                <button
                  type="button"
                  onClick={(e) => gdprDelete(e, detail)}
                  disabled={actionRef === detail.payment_reference || Boolean(detail.gdpr_deleted_at)}
                  className="w-full px-4 py-2.5 rounded-lg bg-white border border-rose-200 text-rose-600 hover:border-rose-300 text-[13px] font-bold transition-all disabled:opacity-50"
                >
                  {detail.gdpr_deleted_at ? "Bereits DSGVO-gelöscht" : "Kunde löschen (DSGVO)"}
                </button>
                <p className="text-[11px] text-slate-400">Rechnungsdaten (Nummer/Betrag/Datum) bleiben aus Buchhaltungspflicht erhalten — nur Kontaktdaten werden anonymisiert.</p>
              </div>

              {/* Notizen und Aufgaben zur Person — direkt hier, weil man beim
                  Prüfen einer Zahlung genau dann etwas festhalten will. */}
              <div className="mb-5">
                <VermerkTafel
                  kompakt
                  ziel={{ ref: detail.ref, name: customerName(detail) }}
                  onMeldung={flash}
                />
              </div>

              <div>
                <h3 className="text-[13px] font-bold text-slate-900 mb-3">Ereignis-Timeline</h3>
                {timeline === null && <p className="text-[12px] text-slate-400">Lädt…</p>}
                {timeline !== null && timeline.length === 0 && <p className="text-[12px] text-slate-400">Keine Ereignisse.</p>}
                {timeline !== null && timeline.length > 0 && (
                  <div className="relative pl-5 space-y-4 before:absolute before:left-[5px] before:top-1 before:bottom-1 before:w-px before:bg-slate-200">
                    {timeline.map((ev, i) => (
                      <div key={i} className="relative">
                        <span
                          className={`absolute -left-5 top-1 w-[11px] h-[11px] rounded-full border-2 border-white shadow ${
                            ev.type === "paid" ? "bg-emerald-500"
                            : ev.type === "claimed" ? "bg-amber-500"
                            : ev.type === "agent" ? "bg-violet-500"
                            : ev.type === "invoice" ? "bg-slate-400"
                            : ev.type === "promise" ? "bg-blue-500"
                            : "bg-[#2563eb]"
                          }`}
                        />
                        <p className="text-[12px] font-semibold text-slate-800 leading-snug">{ev.label}</p>
                        {ev.meta && <p className="text-[11px] text-slate-500 whitespace-pre-wrap">{ev.meta}</p>}
                        <p className="text-[11px] text-slate-400">{fmtDateTime(ev.at)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Namensliste zur angeklickten Kennzahl — dieselbe Bauart wie im Dashboard. */}
      {fenster && (
        <Detailfenster
          reiter={(
            fenster.startsWith("angekuendigt")
              ? [
                  { art: "angekuendigt-alle", label: "Alle" },
                  { art: "angekuendigt-heute", label: "Heute" },
                  { art: "angekuendigt-alt", label: "Älter als 7 Tage" },
                ]
              : fenster.startsWith("bezahlt")
                ? [
                    { art: "bezahlt-alle", label: "Alle" },
                    { art: "bezahlt-monat", label: "Dieser Monat" },
                    { art: "bezahlt-heute", label: "Heute" },
                  ]
                : fenster === "erinnert-heute"
                  ? [{ art: "erinnert-heute", label: "Heute erinnert" }]
                  : [
                      { art: "offen-alle", label: "Alle offenen" },
                      { art: "offen-ohne-reaktion", label: "Ohne jede Reaktion" },
                      { art: "abgelaufen", label: "Abgelaufen" },
                    ]
          ) as FensterReiter[]}
          start={fenster}
          titel={
            fenster.startsWith("angekuendigt") ? "Wer hat eine Zahlung angekündigt?"
            : fenster.startsWith("bezahlt") ? "Wer hat bezahlt?"
            : fenster === "erinnert-heute" ? "Wer hat heute eine Erinnerung bekommen?"
            : "Wer hat noch nicht gezahlt?"
          }
          hinweis={
            fenster.startsWith("angekuendigt") ? "Gemeldet, aber nicht bestätigt — ältester Fall zuerst."
            : fenster.startsWith("bezahlt") ? "Bestätigte Erstzahlungen. Ab der Buchung läuft die Abo-Uhr (30 Tage)."
            : fenster === "erinnert-heute" ? "Zahlungserinnerungen des heutigen Tages, jüngste zuerst."
            : "Bestellung liegt, Zahlung fehlt. Neueste zuerst — Alter je Zeile."
          }
          alleLink="/admin/kontoabgleich"
          alleLabel="Im Kontoabgleich mit dem Kontoauszug abgleichen"
          onClose={() => setFenster(null)}
        />
      )}

      {/* Erstzahlung buchen — mit tatsächlichem Zahlungsdatum. */}
      {buchenZiel && (
        <BuchenDialog
          busy={actionRef === buchenZiel.payment_reference}
          ziel={{
            titel: "Erstzahlung buchen",
            name: customerName(buchenZiel),
            referenz: buchenZiel.payment_reference,
            betragText: fmtAmount(buchenZiel.amount_due),
            zeilen: [
              ...(buchenZiel.pack_name ? [{ label: "Paket", wert: buchenZiel.pack_name.replace(/\n/g, " ") }] : []),
              ...(buchenZiel.claimed_paid_at ? [{ label: "Kunde meldete", wert: fmtDateTime(buchenZiel.claimed_paid_at) }] : []),
            ],
            folgen: [
              "Der Zugang wird freigeschaltet und die Bestätigungsmail versendet (Make: payment_confirmed).",
              "Erinnerungen für diese Bestellung stoppen; offene Schwester-Bestellungen derselben Produktart werden als ersetzt markiert.",
              "Die Provision wird geprüft und bei dokumentierter Betreuung gebucht.",
              "Die Abo-Ratenkette startet: die erste Monatsrate wird 30 Tage nach dem Zahlungseingang fällig.",
            ],
          }}
          onAbbrechen={() => setBuchenZiel(null)}
          onBuchen={(datum) => void markPaid(buchenZiel.payment_reference, datum)}
        />
      )}

      {/* Anleitung: am Ende und zugeklappt — sie soll die Arbeitsliste nicht
          jeden Tag nach unten schieben. */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-8">
        <PageIntro
          id="zahlungen"
          title="So arbeitest du hier"
          subtitle="Erstzahlung freischalten, Abo-Raten im Blick behalten, Auszahlungen freigeben."
          steps={[
            "„Angekündigt“ ist die Arbeitsliste: Der Kunde hat gemeldet, dass er überwiesen hat. Eingang prüfen (Verwendungszweck = Zahlungsreferenz FIAON-…) und „Als bezahlt markieren“ — das stoppt Erinnerungen, sendet die Bestätigungsmail und prüft die Provision.",
            "Jede Kennzahl oben ist anklickbar und zeigt die Namen dahinter — mit Akte, Anruf und Mail je Zeile.",
            "Die Abo-Tafel zeigt die monatlichen Paketraten: fällig 30 Tage nach der Buchung, danach im gleichen Abstand. „bezahlt“ buchen erzeugt automatisch die nächste Fälligkeit.",
            "Bei vielen Eingängen ist der Kontoabgleich schneller: Kontoauszug hochladen, Eingänge zuordnen, in einem Zug verbuchen.",
            "Unter „Auszahlungen“ gibst du Provisions-Anforderungen des Teams frei, unter „Dubletten“ führst du Mehrfach-Bestellungen zusammen (nichts wird gelöscht).",
            "Jede Zeile öffnet die Timeline: jede Mail, jeder Statuswechsel, jede Notiz.",
          ]}
        />
      </div>
    </div>
  );
}
