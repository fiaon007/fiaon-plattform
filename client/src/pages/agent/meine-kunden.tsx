import { useState, useEffect, useCallback } from "react";
import {
  Search, RefreshCw, PhoneCall, FileText, Link2, Archive, CalendarClock, Users, AlertTriangle,
} from "lucide-react";
import {
  AgentShell, api, FlashMessage, inputCls, btnGhost, btnPrimary, ACCENT, fmtD, fmtDT,
} from "./shared";
import { Reveal } from "./motion";
import { CustomerDetail } from "./kunden";
import { LeadDetail } from "./leads";

// ════════════════════════════════════════════════════════════════════
// /agent/meine-kunden — P1-D „MEINE KUNDEN"
//
// Übernommene Akten landen dauerhaft beim Agenten. NICHTS verschwindet:
// auch bezahlt, abgelaufen, storniert und zusammengeführt bleibt sichtbar —
// zusammengeführte Akten mit ausdrücklichem Verweis auf den Datensatz, der
// sie aufgenommen hat. Genau das war das „Kunde verschwunden"-Problem.
// ════════════════════════════════════════════════════════════════════

interface MeinKunde {
  cardId: string;
  ref: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  paket: string | null;
  betrag: string | number | null;
  paymentReference: string | null;
  zusageAm: string | null;
  letzterKontakt: string | null;
  naechsterTermin: string | null;
  zusammengefuehrtMit: string | null;
  ersetztDurch: string | null;
  aussortiertAm: string | null;
  uebernommenAm: string | null;
  createdAt: string;
}

interface MeinLead {
  cardId: string;
  leadId: number;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  quelle: string | null;
  letzterKontakt: string | null;
  naechsterTermin: string | null;
  konvertiertZu: string | null;
  uebernommenAm: string | null;
  createdAt: string;
}

const FILTERS: { key: string; label: string }[] = [
  { key: "", label: "Alle" },
  { key: "offen", label: "Offen" },
  { key: "angekuendigt", label: "Angekündigt" },
  { key: "bezahlt", label: "Bezahlt" },
  { key: "rueckruf", label: "Rückruf" },
  { key: "abgelaufen", label: "Abgelaufen" },
  { key: "tot", label: "Tot" },
];

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "Offen",
  claimed_paid: "Zahlung angekündigt",
  paid: "Bezahlt",
  expired: "Abgelaufen",
  cancelled: "Storniert",
  superseded: "Ersetzt",
  neu: "Neu",
  kontaktiert: "Kontaktiert",
  nicht_erreichbar: "Nicht erreichbar",
  konvertiert: "Konvertiert",
  kein_interesse: "Kein Interesse",
  tot: "Tot",
};

function fmtBetrag(v: string | number | null): string | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

export default function AgentMeineKundenPage() {
  return (
    <AgentShell>
      <MeineKundenContent />
    </AgentShell>
  );
}

function MeineKundenContent() {
  const [filter, setFilter] = useState("");
  const [q, setQ] = useState("");
  const [kunden, setKunden] = useState<MeinKunde[]>([]);
  const [leads, setLeads] = useState<MeinLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [openApp, setOpenApp] = useState<string | null>(null);
  const [openLead, setOpenLead] = useState<number | null>(null);

  const say = (m: string) => { setFlash(m); setTimeout(() => setFlash(null), 5000); };

  const load = useCallback(async () => {
    // Laedt / leer / Fehler sauber getrennt — ein Serverfehler darf nie als
    // „keine Kunden" erscheinen. Sonst glaubt der Agent, sein Bestand sei weg.
    setLadeFehler(null);
    try {
      const r = await api(
        `/agent/kartei/meine?limit=60${filter ? `&filter=${filter}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`,
      );
      if (r.ok) {
        setKunden(r.json.kunden);
        setLeads(r.json.leads);
      } else {
        setLadeFehler(r.json?.error || "Deine Kunden konnten nicht geladen werden.");
      }
    } catch {
      setLadeFehler("Keine Verbindung zum Server. Prüfe deine Internetverbindung.");
    } finally {
      setLoading(false);
    }
  }, [filter, q]);

  useEffect(() => { setLoading(true); const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t); }, [load, q]);

  const gesamt = kunden.length + leads.length;

  return (
    <div>
      <FlashMessage message={flash} />

      <Reveal index={0}>
        <div className="rounded-2xl agent-glass-strong mb-4 px-5 py-5">
          <p className="text-[12px] font-semibold uppercase tracking-[.14em] text-slate-400">Meine Kunden</p>
          <h1 className="text-[20px] sm:text-[23px] font-black tracking-tight text-slate-900 mt-1">
            Alles, was du übernommen hast
          </h1>
          <p className="text-[13px] text-slate-500 mt-1.5 leading-relaxed">
            Hier verschwindet nichts — auch bezahlte, abgelaufene und zusammengeführte Akten bleiben sichtbar.
          </p>
        </div>
      </Reveal>

      {/* Filter + Suche */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 mb-4">
        <div className="flex gap-1 p-1 rounded-xl bg-slate-100/80 overflow-x-auto -mx-1 px-1 sm:mx-0">
          {FILTERS.map((f) => (
            <button
              key={f.key || "alle"}
              type="button"
              onClick={(e) => { e.stopPropagation(); setFilter(f.key); }}
              className={`px-3.5 rounded-lg text-[12.5px] font-semibold whitespace-nowrap transition-colors ${
                filter === f.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
              style={{ minHeight: 44 }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, E-Mail, Telefon, Referenz …"
            className={`${inputCls} pl-9`}
            style={{ minHeight: 44 }}
          />
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setLoading(true); load(); }}
          className={`${btnGhost} shrink-0 inline-flex items-center gap-1.5`}
          style={{ minHeight: 44 }}
        >
          <RefreshCw size={14} strokeWidth={2} /> Aktualisieren
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => <div key={i} className="agent-skeleton h-24 rounded-2xl" />)}
        </div>
      ) : ladeFehler ? (
        /* Fehler ist NICHT dasselbe wie „keine Kunden" — sonst glaubt der
           Agent, sein Bestand sei verschwunden. */
        <div className="rounded-2xl border border-slate-300 bg-white px-6 py-12 text-center">
          <AlertTriangle size={26} strokeWidth={1.6} className="mx-auto text-slate-400 mb-3" />
          <p className="text-[14px] font-semibold text-slate-800">Deine Kunden konnten nicht geladen werden.</p>
          <p className="text-[12.5px] text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">{ladeFehler}</p>
          <p className="text-[11.5px] text-slate-400 mt-1.5 max-w-sm mx-auto leading-relaxed">
            Das ist ein Anzeigefehler — deine Akten sind vollständig gespeichert.
          </p>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setLoading(true); load(); }}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl px-5 text-[13px] font-semibold text-white transition-transform duration-150 active:scale-[.985]"
            style={{ background: ACCENT, minHeight: 44 }}
          >
            <RefreshCw size={14} strokeWidth={2.2} /> Erneut laden
          </button>
        </div>
      ) : gesamt === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center">
          <Users size={26} strokeWidth={1.5} className="mx-auto text-slate-300 mb-3" />
          <p className="text-[14px] font-semibold text-slate-700">Noch keine Akte in diesem Bereich.</p>
          <p className="text-[12.5px] text-slate-400 mt-1">
            Übernimm in der Kartei eine Karte — sie erscheint danach dauerhaft hier.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {kunden.map((k, i) => (
            <KundeRow key={k.cardId} k={k} index={i} onOpen={() => setOpenApp(k.ref)} />
          ))}
          {leads.map((l, i) => (
            <LeadRow key={l.cardId} l={l} index={kunden.length + i} onOpen={() => setOpenLead(l.leadId)} />
          ))}
        </div>
      )}

      {openApp && (
        <CustomerDetail
          refId={openApp}
          onClose={() => { setOpenApp(null); load(); }}
          onChanged={() => load()}
          flash={say}
        />
      )}
      {openLead !== null && (
        <LeadDetail id={openLead} onClose={() => { setOpenLead(null); load(); }} onChanged={() => load()} />
      )}
    </div>
  );
}

function KundeRow({ k, index, onOpen }: { k: MeinKunde; index: number; onOpen: () => void }) {
  const betrag = fmtBetrag(k.betrag);
  const merged = !!k.zusammengefuehrtMit;
  return (
    <Reveal index={Math.min(index, 8)}>
      <div
        onClick={onOpen}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
        className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 cursor-pointer transition-all duration-150 active:scale-[.995] hover:shadow-[0_18px_40px_-28px_rgba(15,23,42,.34)]"
        style={{ minHeight: 76 }}
      >
        <div className="flex items-start gap-3">
          <span className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 text-slate-500 flex items-center justify-center shrink-0">
            <FileText size={16} strokeWidth={1.9} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 flex-wrap">
              <p className="text-[14px] font-bold text-slate-900 truncate">{k.name}</p>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border border-slate-200 text-slate-500">
                {STATUS_LABEL[k.status] || k.status}
              </span>
            </div>
            <p className="text-[11.5px] text-slate-400 mt-1 truncate">
              {[k.paket?.replace(/\n/g, " "), betrag, k.paymentReference].filter(Boolean).join(" · ")}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11.5px] text-slate-400">
              {k.letzterKontakt && <span>Letzter Kontakt {fmtD(k.letzterKontakt)}</span>}
              {k.naechsterTermin && (
                <span className="inline-flex items-center gap-1 font-medium text-slate-600">
                  <CalendarClock size={11} strokeWidth={2} /> {fmtDT(k.naechsterTermin)}
                </span>
              )}
              {k.zusageAm && <span>Zusage {fmtD(k.zusageAm)}</span>}
            </div>

            {/* Der frühere „Kunde verschwunden"-Fall — jetzt sichtbar erklärt */}
            {merged && (
              <p className="mt-2 inline-flex items-start gap-1.5 text-[11.5px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                <Link2 size={12} strokeWidth={2} className="mt-0.5 shrink-0" />
                Wurde mit <span className="font-semibold text-slate-700">{k.zusammengefuehrtMit}</span> zusammengeführt — dort läuft die Betreuung weiter.
              </p>
            )}
            {k.ersetztDurch && !merged && (
              <p className="mt-2 inline-flex items-start gap-1.5 text-[11.5px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                <Link2 size={12} strokeWidth={2} className="mt-0.5 shrink-0" />
                Ersetzt durch <span className="font-semibold text-slate-700">{k.ersetztDurch}</span>.
              </p>
            )}
            {k.aussortiertAm && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] text-slate-500">
                <Archive size={12} strokeWidth={2} /> Aussortiert am {fmtD(k.aussortiertAm)} — nicht gelöscht.
              </p>
            )}
          </div>
        </div>
      </div>
    </Reveal>
  );
}

function LeadRow({ l, index, onOpen }: { l: MeinLead; index: number; onOpen: () => void }) {
  return (
    <Reveal index={Math.min(index, 8)}>
      <div
        onClick={onOpen}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
        className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 cursor-pointer transition-all duration-150 active:scale-[.995] hover:shadow-[0_18px_40px_-28px_rgba(15,23,42,.34)]"
        style={{ minHeight: 76 }}
      >
        <div className="flex items-start gap-3">
          <span className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 text-slate-500 flex items-center justify-center shrink-0">
            <PhoneCall size={16} strokeWidth={1.9} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 flex-wrap">
              <p className="text-[14px] font-bold text-slate-900 truncate">{l.name}</p>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border border-slate-200 text-slate-500">
                {STATUS_LABEL[l.status] || l.status}
              </span>
            </div>
            <p className="text-[11.5px] text-slate-400 mt-1 truncate">
              {[l.quelle, l.phone, l.email].filter(Boolean).join(" · ")}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11.5px] text-slate-400">
              {l.letzterKontakt && <span>Letzter Kontakt {fmtD(l.letzterKontakt)}</span>}
              {l.naechsterTermin && (
                <span className="inline-flex items-center gap-1 font-medium text-slate-600">
                  <CalendarClock size={11} strokeWidth={2} /> {fmtDT(l.naechsterTermin)}
                </span>
              )}
            </div>
            {l.konvertiertZu && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                <Link2 size={12} strokeWidth={2} />
                Zum Kunden geworden — Bestellung <span className="font-semibold text-slate-700">{l.konvertiertZu}</span>.
              </p>
            )}
          </div>
        </div>
      </div>
    </Reveal>
  );
}
