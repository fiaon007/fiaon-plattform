import { useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, Copy, ChevronRight, ScrollText } from "lucide-react";
import { ACCENT } from "@/components/admin/AdminShell";
import { PageIntro, Tip } from "@/components/admin/PageHelp";

// ═══════════════════════════════════════════════════════════════════════════
// /admin/auszahlungen — Provisions-Anforderungen des Teams
//
// Vorher lebte das als Sektion in der Zahlungszentrale. Das war falsch
// zugeordnet: Die Zahlungszentrale beantwortet „Hat der KUNDE gezahlt?",
// hier geht es um „Bekommt der MITARBEITER sein Geld?". Zwei Geldrichtungen,
// zwei Verantwortlichkeiten, zwei Seiten — sonst sucht man die Freigabe unter
// den Kundenzahlungen.
//
// Überwiesen wird von Hand in der Bank. Diese Seite bestätigt oder lehnt ab;
// sie bewegt selbst kein Geld. Deshalb stehen IBAN und Betrag gross und
// kopierbar da: Genau diese zwei Werte tippt man drüben ins Banking.
// ═══════════════════════════════════════════════════════════════════════════

interface Position {
  id: number; ref: string; payment_reference: string | null;
  pack_name: string | null; amount_cents: number; rate_bp: number; status: string;
}
interface Auszahlung {
  id: number; agent_id: number; agent_name: string; amount_cents: number;
  status: "angefordert" | "ausgezahlt" | "abgelehnt";
  requested_at: string; processed_at: string | null; reject_reason: string | null;
  holder: string | null; iban_full: string | null; bic: string | null;
  entries: Position[];
}

const eur = (c: number) =>
  `${(c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

function zeit(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString("de-DE", {
    timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

const STATUS: Record<string, { label: string; farbe: string; flaeche: string }> = {
  angefordert: { label: "Wartet auf dich", farbe: "#b45309", flaeche: "rgba(217,119,6,.1)" },
  ausgezahlt: { label: "Ausgezahlt", farbe: "#047857", flaeche: "rgba(5,150,105,.09)" },
  abgelehnt: { label: "Abgelehnt", farbe: "#64748b", flaeche: "#f1f5f9" },
};

export default function AdminAuszahlungenPage() {
  const [liste, setListe] = useState<Auszahlung[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [offenId, setOffenId] = useState<number | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [kopiert, setKopiert] = useState<string | null>(null);
  const [auditOffen, setAuditOffen] = useState(false);
  const [audit, setAudit] = useState<any[]>([]);

  const sagen = (t: string) => { setMeldung(t); setTimeout(() => setMeldung(null), 6000); };

  const laden = useCallback(async () => {
    setLaedt(true);
    try {
      const j = await fetch("/api/fiaon/admin/payouts", { credentials: "include" })
        .then((r) => r.json()).catch(() => null);
      setListe(j?.ok ? j.data : []);
    } finally { setLaedt(false); }
  }, []);

  useEffect(() => { void laden(); }, [laden]);

  const auditLaden = async () => {
    setAuditOffen((v) => !v);
    if (!auditOffen && audit.length === 0) {
      const j = await fetch("/api/fiaon/admin/agent-log", { credentials: "include" })
        .then((r) => r.json()).catch(() => null);
      setAudit(j?.ok ? j.data : []);
    }
  };

  const kopieren = (text: string, marke: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setKopiert(marke);
      setTimeout(() => setKopiert(null), 1600);
    });
  };

  const alsUeberwiesen = async (p: Auszahlung) => {
    if (!confirm(
      `Auszahlung #${p.id} als überwiesen markieren?\n\n` +
      `${eur(p.amount_cents)} an ${p.agent_name}\n\n` +
      `Die enthaltenen Provisionen wechseln auf „ausgezahlt“, der Mitarbeiter bekommt eine ` +
      `Bestätigungsmail (Make: agent_payout_done) und eine Provisions-Abrechnung als PDF.`,
    )) return;
    setBusy(p.id);
    try {
      const res = await fetch(`/api/fiaon/admin/payouts/${p.id}/mark-paid`, { method: "POST", credentials: "include" });
      const j = await res.json().catch(() => null);
      if (res.ok && j?.ok) { sagen(`Auszahlung #${p.id} als überwiesen markiert.`); await laden(); }
      else sagen(`Fehler: ${j?.error || res.status}`);
    } finally { setBusy(null); }
  };

  const ablehnen = async (p: Auszahlung) => {
    const grund = prompt(`Auszahlung #${p.id} ablehnen — Grund (wird dem Mitarbeiter mitgeteilt):`);
    if (!grund) return;
    setBusy(p.id);
    try {
      const res = await fetch(`/api/fiaon/admin/payouts/${p.id}/reject`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ reason: grund }),
      });
      const j = await res.json().catch(() => null);
      if (res.ok && j?.ok) { sagen(`Auszahlung #${p.id} abgelehnt — die Provisionen sind wieder verfügbar.`); await laden(); }
      else sagen(`Fehler: ${j?.error || res.status}`);
    } finally { setBusy(null); }
  };

  const wartend = useMemo(() => liste.filter((p) => p.status === "angefordert"), [liste]);
  const erledigt = useMemo(() => liste.filter((p) => p.status !== "angefordert"), [liste]);
  const summeWartend = wartend.reduce((s, p) => s + p.amount_cents, 0);
  const summeAusgezahlt = liste.filter((p) => p.status === "ausgezahlt").reduce((s, p) => s + p.amount_cents, 0);

  const Karte = ({ p }: { p: Auszahlung }) => {
    const s = STATUS[p.status] || STATUS.abgelehnt;
    const wartet = p.status === "angefordert";
    return (
      <div className="px-4 py-3.5" style={{
        boxShadow: "inset 0 -1px 0 rgba(226,232,240,.8)",
        borderLeft: `3px solid ${wartet ? "#d97706" : "transparent"}`,
      }}>
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold text-slate-900 a3-zahl">
              {eur(p.amount_cents)}
              <span className="ml-2 text-[13px] font-semibold text-slate-600">{p.agent_name}</span>
              <span className="ml-2 px-1.5 py-0.5 rounded-md text-[10.5px] font-bold align-middle"
                style={{ background: s.flaeche, color: s.farbe }}>
                {s.label}
              </span>
            </p>
            <p className="text-[11.5px] text-slate-500 mt-0.5">
              Beantragt {zeit(p.requested_at)}
              {p.processed_at ? ` · verarbeitet ${zeit(p.processed_at)}` : ""}
              {p.reject_reason ? ` · Grund: ${p.reject_reason}` : ""}
            </p>

            {/* Bankdaten nur bei offenen Anforderungen — man braucht sie genau
                dann, wenn man die Überweisung tatsächlich tippt. */}
            {wartet && p.iban_full && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[12px] text-slate-700 font-semibold">{p.holder}</span>
                <button type="button" className="a3-knopf inline-flex"
                  onClick={() => kopieren(p.iban_full || "", `iban-${p.id}`)}>
                  <Copy size={12} /> {kopiert === `iban-${p.id}` ? "kopiert" : p.iban_full}
                </button>
                {p.bic && (
                  <button type="button" className="a3-knopf inline-flex"
                    onClick={() => kopieren(p.bic || "", `bic-${p.id}`)}>
                    <Copy size={12} /> {kopiert === `bic-${p.id}` ? "kopiert" : p.bic}
                  </button>
                )}
                <button type="button" className="a3-knopf inline-flex"
                  onClick={() => kopieren((p.amount_cents / 100).toFixed(2), `betrag-${p.id}`)}>
                  <Copy size={12} /> {kopiert === `betrag-${p.id}` ? "kopiert" : (p.amount_cents / 100).toFixed(2)}
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <button type="button" className="a3-knopf inline-flex"
              onClick={() => setOffenId(offenId === p.id ? null : p.id)}>
              {p.entries.length} {p.entries.length === 1 ? "Position" : "Positionen"}
              <ChevronRight size={12} className={offenId === p.id ? "rotate-90 transition-transform" : "transition-transform"} />
            </button>
            <a className="a3-knopf inline-flex" href={`/api/fiaon/admin/payouts/${p.id}/export.csv`}>CSV</a>
            {wartet && (
              <>
                <button type="button" className="a3-knopf inline-flex" disabled={busy === p.id}
                  onClick={() => void ablehnen(p)}>
                  Ablehnen
                </button>
                <button type="button" className="a3-knopf inline-flex" data-haupt="1" disabled={busy === p.id}
                  onClick={() => void alsUeberwiesen(p)}>
                  {busy === p.id ? "…" : "Als überwiesen markieren"}
                </button>
              </>
            )}
          </div>
        </div>

        {offenId === p.id && (
          <div className="mt-2.5 rounded-xl border overflow-hidden" style={{ borderColor: "var(--a3-linie,#e4e9f2)" }}>
            {p.entries.map((en) => (
              <div key={en.id} className="px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[12px]"
                style={{ boxShadow: "inset 0 -1px 0 rgba(226,232,240,.7)" }}>
                <a href={`/admin/kunde/${encodeURIComponent(en.ref)}`} className="font-semibold" style={{ color: ACCENT }}>
                  {en.payment_reference || en.ref}
                </a>
                <span className="text-slate-400 truncate max-w-[40%]">{(en.pack_name || "").replace(/\n/g, " ")}</span>
                <span className="text-slate-400 a3-zahl">{(en.rate_bp / 100).toLocaleString("de-DE")} %</span>
                <span className="font-bold text-slate-700 a3-zahl">{eur(en.amount_cents)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-end justify-between gap-4 mb-4">
        <div className="min-w-0">
          <h1 className="text-[22px] sm:text-[26px] font-bold text-slate-900 tracking-[-.02em]">Auszahlungen</h1>
          <p className="text-[12.5px] text-slate-500 mt-0.5">
            Provisions-Anforderungen des Teams · Überweisung machst du in der Bank, hier nur freigeben
          </p>
        </div>
        <button type="button" onClick={() => void laden()} disabled={laedt}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border text-[12.5px] font-semibold text-slate-600 disabled:opacity-50"
          style={{ borderColor: "var(--a3-linie,#e4e9f2)" }}>
          {laedt ? "Lädt …" : "Aktualisieren"}
        </button>
      </div>

      {meldung && (
        <div className="mb-4 px-4 py-3 rounded-xl text-[13px] font-semibold"
          style={{ background: "rgba(29,78,216,.05)", border: "1px solid rgba(29,78,216,.2)", color: "#1e40af" }}>
          {meldung}
        </div>
      )}

      {/* Zwei Zahlen genügen: was auf dich wartet, was schon draussen ist. */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-3 mb-4">
        <div className="a3-kachel a3-auf p-4 pl-[18px]" data-ton={wartend.length > 0 ? "offen" : undefined} style={{ ["--i" as any]: 0 }}>
          <span className="flex items-start gap-1.5">
            <Banknote size={13} className="text-slate-400 shrink-0 mt-[1px]" />
            <span className="flex-1 text-[10px] font-semibold uppercase tracking-[.07em] text-slate-500 leading-tight">Wartet auf Freigabe</span>
            <span className="shrink-0"><Tip text="Anforderungen, die noch nicht überwiesen sind. Der Mitarbeiter sieht in seinem Portal denselben Stand." /></span>
          </span>
          <span className="block mt-2 text-[22px] font-bold text-slate-900 a3-zahl leading-none">{eur(summeWartend)}</span>
          <span className="block mt-1.5 text-[11.5px] text-slate-500">{wartend.length} Anforderung(en)</span>
        </div>
        <div className="a3-kachel a3-auf p-4 pl-[18px]" data-ton="geld" style={{ ["--i" as any]: 1 }}>
          <span className="text-[10px] font-semibold uppercase tracking-[.07em] text-slate-500">Bereits ausgezahlt</span>
          <span className="block mt-2 text-[22px] font-bold text-slate-900 a3-zahl leading-none">{eur(summeAusgezahlt)}</span>
          <span className="block mt-1.5 text-[11.5px] text-slate-500">{liste.filter((p) => p.status === "ausgezahlt").length} Vorgänge</span>
        </div>
        <a href="/admin/team" className="a3-kachel a3-auf p-4 pl-[18px]" style={{ ["--i" as any]: 2 }}>
          <span className="text-[10px] font-semibold uppercase tracking-[.07em] text-slate-500">Sätze und Mitarbeiter</span>
          <span className="block mt-2 text-[15px] font-bold text-slate-900 leading-tight">Team-Übersicht</span>
          <span className="block mt-1.5 text-[11.5px] text-slate-500">Provisionssätze, Bankdaten, Guthaben</span>
        </a>
        <a href="/admin/team?tab=nachbuchung" className="a3-kachel a3-auf p-4 pl-[18px]" style={{ ["--i" as any]: 3 }}>
          <span className="text-[10px] font-semibold uppercase tracking-[.07em] text-slate-500">Fehlt eine Provision?</span>
          <span className="block mt-2 text-[15px] font-bold text-slate-900 leading-tight">Nachbuchen</span>
          <span className="block mt-1.5 text-[11.5px] text-slate-500">Bezahlte Bestellungen ohne Provision</span>
        </a>
      </div>

      {/* Offene Anforderungen zuerst — das ist die Arbeit. */}
      <section className="a3-tafel mb-4">
        <header className="a3-tafel-kopf">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "var(--fi-flaeche-akzent,#f1f5ff)", color: ACCENT }}>
            <Banknote size={15} />
          </span>
          <h2 className="text-[14px] font-bold text-slate-900">Offene Anforderungen</h2>
          <span className="ml-auto text-[11.5px] font-semibold text-slate-400 a3-zahl">{wartend.length}</span>
        </header>
        {laedt && <p className="px-4 py-6 text-[13px] text-slate-400">Wird geladen …</p>}
        {!laedt && wartend.length === 0 && (
          <p className="px-4 py-8 text-center text-[13px] text-slate-400">
            Keine offene Anforderung — es wartet niemand auf sein Geld.
          </p>
        )}
        {wartend.map((p) => <Karte key={p.id} p={p} />)}
      </section>

      {erledigt.length > 0 && (
        <section className="a3-tafel mb-4">
          <header className="a3-tafel-kopf">
            <h2 className="text-[14px] font-bold text-slate-900">Verlauf</h2>
            <span className="ml-auto text-[11.5px] text-slate-400 a3-zahl">{erledigt.length}</span>
          </header>
          {erledigt.map((p) => <Karte key={p.id} p={p} />)}
        </section>
      )}

      {/* Audit: alle Mitarbeiter-Aktionen. Gehört hierher, weil man beim Freigeben
          gelegentlich nachsehen will, was der Agent tatsächlich getan hat. */}
      <section className="a3-tafel mb-4">
        <header className="a3-tafel-kopf">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "var(--fi-flaeche-akzent,#f1f5ff)", color: ACCENT }}>
            <ScrollText size={14} />
          </span>
          <button type="button" onClick={() => void auditLaden()} className="flex items-center gap-2 text-left">
            <h2 className="text-[14px] font-bold text-slate-900">Mitarbeiter-Aktionen</h2>
            <ChevronRight size={14} className={`text-slate-400 transition-transform ${auditOffen ? "rotate-90" : ""}`} />
          </button>
          <span className="ml-auto text-[11px] text-slate-400">
            Vollständiges Protokoll unter <a href="/admin/audit" className="font-semibold" style={{ color: ACCENT }}>Audit-Log</a>
          </span>
        </header>
        {auditOffen && (
          <div className="max-h-80 overflow-y-auto">
            {audit.length === 0 && <p className="px-4 py-6 text-center text-[12px] text-slate-400">Noch nichts protokolliert.</p>}
            {audit.map((l) => (
              <div key={l.id} className="px-4 py-2.5 flex items-start justify-between gap-3"
                style={{ boxShadow: "inset 0 -1px 0 rgba(226,232,240,.7)" }}>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-slate-700">
                    <span style={{ color: ACCENT }}>{l.agent_name}</span>
                    {" · "}
                    {l.type === "note" ? "Notiz" : l.type === "email_sent" ? "Zahlungsdaten-Mail" : `Ergebnis: ${l.outcome || "—"}`}
                    {" · "}
                    <a href={`/admin/kunde/${encodeURIComponent(l.ref)}`} className="text-slate-400 hover:text-slate-700">{l.ref}</a>
                  </p>
                  {l.note && <p className="text-[11px] text-slate-500 truncate">{l.note}</p>}
                </div>
                <span className="text-[11px] text-slate-400 whitespace-nowrap">{zeit(l.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <PageIntro
        id="auszahlungen"
        title="So arbeitest du hier"
        subtitle="Anforderung prüfen, in der Bank überweisen, hier bestätigen."
        steps={[
          "Ein Mitarbeiter fordert seine Provision im Portal an. Sie erscheint hier unter „Offene Anforderungen“ mit Betrag, Kontoinhaber, IBAN und BIC — alle drei Werte sind mit einem Klick kopierbar.",
          "Überweise den Betrag in deinem Banking. Diese Seite bewegt kein Geld.",
          "Danach „Als überwiesen markieren“: Die enthaltenen Provisionen wechseln auf „ausgezahlt“, der Mitarbeiter bekommt eine Bestätigungsmail und eine Abrechnung als PDF.",
          "„Ablehnen“ braucht einen Grund — der Mitarbeiter sieht ihn, und die Provisionen sind sofort wieder anforderbar.",
          "„Positionen“ zeigt, aus welchen Abschlüssen die Summe besteht; jede Referenz führt in die Kundenakte.",
          "Provisionssätze, Bankdaten und Guthaben pflegst du in der Team-Übersicht. Fehlt eine Provision ganz, hilft „Nachbuchen“.",
        ]}
      />
    </div>
  );
}
