import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Lock, Users, Sparkles, Search, RefreshCw, PhoneCall, FileText,
  Clock, AlertCircle, CheckCircle2, MapPin, Inbox,
} from "lucide-react";
import {
  AgentShell, api, ConfirmDialog, FlashMessage, inputCls, btnGhost, ACCENT, useAgentInfo,
} from "./shared";
import { Reveal, useReducedMotion } from "./motion";
import { CustomerDetail } from "./kunden";
import { LeadDetail } from "./leads";

// ════════════════════════════════════════════════════════════════════
// /agent/kartei — DIE OFFENE KUNDEN-KARTEI
//
// Ein gemeinsamer Bestand für alle Agenten. Leads und Kunden liegen in
// derselben Kartei; solange eine Karte frei ist, sind ihre Kontaktdaten
// gesperrt — nicht nur ausgeblendet, sondern serverseitig gar nicht erst
// geliefert. Der Agent übernimmt per Doppelbestätigung, arbeitet die Akte
// ab und nimmt die nächste. Kein Round-Robin, kein Deckel.
//
// Nach der Übernahme öffnet sich EXAKT die bestehende Akte (CustomerDetail
// bzw. LeadDetail) — dieselben Endpoints, dieselben E-Mail-Events.
// ════════════════════════════════════════════════════════════════════

interface KarteiCard {
  cardId: string;
  kind: "lead" | "app";
  zustand: "frei" | "vergeben" | "meine";
  bearbeiterName: string | null;
  status: string;
  quelle: string | null;
  kampagne: string | null;
  paket: string | null;
  potenzialCents: number | null;
  region: string | null;
  alterTage: number | null;
  hatTelefon: boolean;
  hatEmail: boolean;
  rueckrufFaellig: boolean;
  zahlungAngekuendigt: boolean;
  nummerKorrigiert: boolean;
  betreut: boolean;
}

interface KarteiStatus {
  activeCardId: string | null;
  freieKarten: number;
  meineKarten: number;
  ruecklaeufer: { anzahl: number; inTagen: number | null; fristTage: number };
  autoReleaseMinutes: number;
}

const TABS: { key: "frei" | "meine" | "alle"; label: string }[] = [
  { key: "frei", label: "Frei" },
  { key: "meine", label: "Meine Akten" },
  { key: "alle", label: "Alle" },
];

const STATUS_LABEL: Record<string, string> = {
  lead: "Lead",
  offener_antrag: "Offener Antrag",
  angekuendigt: "Zahlung angekündigt",
};

function fmtPotenzial(cents: number | null): string | null {
  if (!cents || cents <= 0) return null;
  return `${(cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`;
}

function fmtAlter(tage: number | null): string {
  if (tage === null) return "—";
  if (tage <= 0) return "heute";
  if (tage === 1) return "1 Tag alt";
  if (tage < 31) return `${tage} Tage alt`;
  const m = Math.floor(tage / 30);
  return m === 1 ? "1 Monat alt" : `${m} Monate alt`;
}

export default function AgentKarteiPage() {
  return (
    <AgentShell>
      <KarteiContent />
    </AgentShell>
  );
}

function KarteiContent() {
  const { agent } = useAgentInfo();
  const reduced = useReducedMotion();
  const [tab, setTab] = useState<"frei" | "meine" | "alle">("frei");
  const [cards, setCards] = useState<KarteiCard[]>([]);
  const [status, setStatus] = useState<KarteiStatus | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [flash, setFlash] = useState<string | null>(null);

  // Übernahme-Dialog (P1-B: Doppelbestätigung) + Freischalt-Animation
  const [pendingClaim, setPendingClaim] = useState<KarteiCard | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [unlocking, setUnlocking] = useState<string | null>(null);

  // Geöffnete Akte nach der Übernahme
  const [openApp, setOpenApp] = useState<string | null>(null);
  const [openLead, setOpenLead] = useState<number | null>(null);

  // Bewusste Rückgabe einer eigenen Akte (P1-C/D)
  const [pendingRelease, setPendingRelease] = useState<KarteiCard | null>(null);
  const [releaseReason, setReleaseReason] = useState("");
  const [releasing, setReleasing] = useState(false);

  const say = (m: string) => { setFlash(m); setTimeout(() => setFlash(null), 5000); };

  const load = useCallback(async () => {
    const [c, s] = await Promise.all([
      api(`/agent/kartei?tab=${tab}&limit=48${q ? `&q=${encodeURIComponent(q)}` : ""}`),
      api("/agent/kartei/status"),
    ]);
    if (c.ok) { setCards(c.json.cards); setTotal(c.json.total); }
    if (s.ok) setStatus(s.json);
    setLoading(false);
  }, [tab, q]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const openCard = (card: KarteiCard) => {
    if (card.kind === "lead") setOpenLead(Number(card.cardId.replace("lead-", "")));
    else setOpenApp(card.cardId);
  };

  const confirmClaim = async () => {
    if (!pendingClaim) return;
    setClaiming(true);
    const r = await api(`/agent/kartei/${encodeURIComponent(pendingClaim.cardId)}/claim`, { method: "POST" });
    setClaiming(false);
    const card = pendingClaim;
    setPendingClaim(null);

    if (!r.ok) {
      say(r.json?.error || "Übernahme nicht möglich.");
      load();
      return;
    }
    // Freischalt-Moment: die Karte „öffnet" sich sichtbar, dann die Akte.
    if (!reduced) {
      setUnlocking(card.cardId);
      setTimeout(() => { setUnlocking(null); openCard(card); }, 320);
    } else {
      openCard(card);
    }
    say("✓ Akte übernommen — du siehst jetzt alle Daten und bist für die Betreuung zuständig.");
    load();
  };

  const confirmRelease = async () => {
    if (!pendingRelease || releaseReason.trim().length < 3) return;
    setReleasing(true);
    const r = await api(`/agent/kartei/${encodeURIComponent(pendingRelease.cardId)}/release`, {
      method: "POST",
      body: JSON.stringify({ mode: "zurueckgeben", reason: releaseReason.trim() }),
    });
    setReleasing(false);
    setPendingRelease(null);
    setReleaseReason("");
    say(r.ok
      ? "✓ Akte zurückgegeben — sie liegt wieder frei in der Kartei und kann von jedem übernommen werden."
      : r.json?.error || "Rückgabe nicht möglich.");
    load();
  };

  const claimText = useMemo(() => {
    if (!pendingClaim) return { title: "", message: "" };
    const art = pendingClaim.kind === "lead" ? "Lead-Akte" : "Kunden-Akte";
    return {
      title: `Diese ${art} übernehmen?`,
      message:
        "Mit der Annahme übernimmst du diese Kundenakte. Du bist dann für die Betreuung verantwortlich und siehst alle Daten.",
    };
  }, [pendingClaim]);

  const hasActive = !!status?.activeCardId;

  return (
    <div>
      <FlashMessage message={flash} />

      {/* ── Kopfkarte: Begrüßung + was heute ansteht (Prompt 2 B) ── */}
      <Reveal index={0}>
        <div className="relative overflow-hidden rounded-2xl agent-glass-strong mb-4 px-5 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold uppercase tracking-[.14em] text-slate-400">
                Offene Kartei
              </p>
              <h1 className="text-[20px] sm:text-[23px] font-black tracking-tight text-slate-900 mt-1">
                {agent?.name ? `${agent.name.split(" ")[0]}, hier ist deine Arbeit.` : "Deine Arbeit"}
              </h1>
              <p className="text-[13px] text-slate-500 mt-1.5 leading-relaxed">
                {status
                  ? status.freieKarten > 0
                    ? `${status.freieKarten.toLocaleString("de-DE")} freie Karten liegen bereit. Nimm oben weg — die Reihenfolge macht der Server.`
                    : "Aktuell liegt keine freie Karte in der Kartei. Sobald etwas frei wird, erscheint es hier."
                  : "Lädt …"}
              </p>
            </div>
            {status && (
              <div className="flex gap-2.5 shrink-0">
                <HeadStat label="Frei" value={status.freieKarten} />
                <HeadStat label="Meine" value={status.meineKarten} accent />
              </div>
            )}
          </div>

          {/* Vorwarnung Hortungs-Schutz (P1-E) */}
          {status && status.ruecklaeufer.anzahl > 0 && (
            <div className="mt-4 flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white/70">
              <AlertCircle size={15} strokeWidth={1.9} className="text-slate-400 mt-0.5 shrink-0" />
              <p className="text-[12.5px] text-slate-600 leading-relaxed">
                <span className="font-semibold text-slate-800">
                  {status.ruecklaeufer.anzahl} {status.ruecklaeufer.anzahl === 1 ? "Akte läuft" : "Akten laufen"}
                  {status.ruecklaeufer.inTagen !== null
                    ? status.ruecklaeufer.inTagen === 0 ? " heute" : ` in ${status.ruecklaeufer.inTagen} ${status.ruecklaeufer.inTagen === 1 ? "Tag" : "Tagen"}`
                    : ""} zurück in die Kartei.
                </span>{" "}
                Grund: seit der Übernahme kein dokumentierter Kontakt. Ein Kontakt-Ergebnis genügt, und die Akte bleibt bei dir.
              </p>
            </div>
          )}

          {/* Aktive Akte (P1-C) */}
          {hasActive && (
            <div className="mt-3 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white/70">
              <Clock size={15} strokeWidth={1.9} className="shrink-0" style={{ color: ACCENT }} />
              <p className="text-[12.5px] text-slate-600 leading-relaxed flex-1 min-w-0">
                Du hast eine Akte in Bearbeitung. Dokumentiere ein Ergebnis — dann wird die nächste frei.
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const id = status!.activeCardId!;
                  if (id.startsWith("lead-")) setOpenLead(Number(id.replace("lead-", "")));
                  else setOpenApp(id);
                }}
                className={`${btnGhost} shrink-0`}
                style={{ minHeight: 40 }}
              >
                Öffnen
              </button>
            </div>
          )}
        </div>
      </Reveal>

      {/* ── Tabs + Suche ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 mb-4">
        <div className="flex gap-1 p-1 rounded-xl bg-slate-100/80 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={(e) => { e.stopPropagation(); setTab(t.key); }}
              className={`px-4 rounded-lg text-[13px] font-semibold whitespace-nowrap transition-colors ${
                tab === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
              style={{ minHeight: 44 }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tab === "frei" ? "Quelle, Kampagne, Paket, Region …" : "Suchen …"}
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

      {tab === "frei" && (
        <p className="text-[12px] text-slate-400 mb-3 leading-relaxed">
          Freie Karten zeigen bewusst keine Namen oder Nummern — alle werden gleich behandelt, niemand wird übersprungen.
          Erst mit der Übernahme siehst du die vollständigen Daten.
        </p>
      )}

      {/* ── Kartenraster ── */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="agent-skeleton h-40 rounded-2xl" />)}
        </div>
      ) : cards.length === 0 ? (
        <EmptyState tab={tab} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((c, i) => (
              <KarteiCardView
                key={c.cardId}
                card={c}
                index={i}
                unlocking={unlocking === c.cardId}
                blockedByActive={hasActive && status?.activeCardId !== c.cardId}
                onClaim={() => setPendingClaim(c)}
                onOpen={() => openCard(c)}
                onRelease={() => { setReleaseReason(""); setPendingRelease(c); }}
              />
            ))}
          </div>
          {total > cards.length && (
            <p className="text-center text-[12px] text-slate-400 mt-5">
              {cards.length} von {total.toLocaleString("de-DE")} Karten. Arbeite die obersten ab — es rutscht automatisch nach.
            </p>
          )}
        </>
      )}

      {/* ── P1-B: Doppelbestätigung vor der Übernahme ── */}
      <ConfirmDialog
        open={!!pendingClaim}
        title={claimText.title}
        message={claimText.message}
        consequence={
          pendingClaim
            ? "Es wird keine E-Mail versendet. Die Übernahme wird protokolliert; die Akte erscheint danach unter „Meine Kunden“."
            : undefined
        }
        confirmLabel="Übernehmen"
        busy={claiming}
        onConfirm={confirmClaim}
        onCancel={() => setPendingClaim(null)}
      >
        {pendingClaim && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 space-y-1.5">
            <MetaRow label="Art" value={pendingClaim.kind === "lead" ? "Lead" : STATUS_LABEL[pendingClaim.status] || "Kunde"} />
            {pendingClaim.paket && <MetaRow label="Paket" value={pendingClaim.paket.replace(/\n/g, " ")} />}
            {fmtPotenzial(pendingClaim.potenzialCents) && (
              <MetaRow label="Offener Betrag" value={fmtPotenzial(pendingClaim.potenzialCents)!} />
            )}
            {pendingClaim.quelle && <MetaRow label="Quelle" value={pendingClaim.quelle} />}
            <MetaRow label="Alter" value={fmtAlter(pendingClaim.alterTage)} />
          </div>
        )}
      </ConfirmDialog>

      {/* ── Akte bewusst zurückgeben (P1-D: sichtbar und protokolliert) ── */}
      <ConfirmDialog
        open={!!pendingRelease}
        title="Akte zurückgeben?"
        message="Die Akte verlässt deine Liste und liegt wieder frei in der Kartei."
        consequence="Es wird nichts gelöscht und keine E-Mail versendet. Die Rückgabe wird mit deinem Namen und deiner Begründung protokolliert; ein Kollege kann die Akte danach übernehmen."
        confirmLabel="Zurückgeben"
        danger
        busy={releasing}
        confirmDisabled={releaseReason.trim().length < 3}
        onConfirm={confirmRelease}
        onCancel={() => { setPendingRelease(null); setReleaseReason(""); }}
      >
        <div>
          <label className="block text-[12px] font-medium text-slate-500 mb-1.5">Kurze Begründung (Pflicht)</label>
          <input
            type="text"
            value={releaseReason}
            onChange={(e) => setReleaseReason(e.target.value)}
            placeholder="z. B. passt nicht zu mir, keine Zeit"
            className={inputCls}
            style={{ minHeight: 44 }}
          />
        </div>
      </ConfirmDialog>

      {/* ── Die Akte selbst: unveränderte bestehende Komponenten ── */}
      {openApp && (
        <CustomerDetail
          refId={openApp}
          onClose={() => { setOpenApp(null); load(); }}
          onChanged={() => load()}
          flash={say}
        />
      )}
      {openLead !== null && (
        <LeadDetail
          id={openLead}
          onClose={() => { setOpenLead(null); load(); }}
          onChanged={() => load()}
        />
      )}
    </div>
  );
}

function HeadStat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white/70 text-center min-w-[76px]">
      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-[19px] font-black tabular-nums leading-tight mt-0.5" style={accent ? { color: ACCENT } : undefined}>
        {value.toLocaleString("de-DE")}
      </p>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className="font-semibold text-slate-800 text-right truncate">{value}</span>
    </div>
  );
}

// ── Die Karte (P1-A/C: gesperrt, vergeben, meine) ───────────────────────────
function KarteiCardView({
  card, index, unlocking, blockedByActive, onClaim, onOpen, onRelease,
}: {
  card: KarteiCard;
  index: number;
  unlocking: boolean;
  blockedByActive: boolean;
  onClaim: () => void;
  onOpen: () => void;
  onRelease: () => void;
}) {
  const frei = card.zustand === "frei";
  const vergeben = card.zustand === "vergeben";
  const potenzial = fmtPotenzial(card.potenzialCents);

  // Signale, die dem Agenten ehrlich sagen, warum sich die Karte lohnt.
  const signale: { icon: typeof Clock; text: string }[] = [];
  if (card.rueckrufFaellig) signale.push({ icon: Clock, text: "Rückruf fällig" });
  if (card.zahlungAngekuendigt) signale.push({ icon: CheckCircle2, text: "Zahlung angekündigt" });
  if (card.nummerKorrigiert) signale.push({ icon: PhoneCall, text: "Nummer korrigiert" });

  const clickable = frei ? !blockedByActive : card.zustand === "meine";

  return (
    <Reveal index={Math.min(index, 8)}>
      <div
        className={`relative overflow-hidden rounded-2xl border transition-all duration-200 ${
          vergeben
            ? "border-slate-200/70 bg-slate-50/60"
            : "border-slate-200 bg-white hover:shadow-[0_20px_44px_-26px_rgba(15,23,42,.34)]"
        } ${clickable ? "cursor-pointer active:scale-[.99]" : ""} ${unlocking ? "agent-glow" : ""}`}
        onClick={clickable ? (frei ? onClaim : onOpen) : undefined}
        role={clickable ? "button" : undefined}
        tabIndex={clickable ? 0 : undefined}
        onKeyDown={(e) => {
          if (!clickable) return;
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); frei ? onClaim() : onOpen(); }
        }}
        style={{ minHeight: 156 }}
      >
        {/* Kopf */}
        <div className="px-4 pt-4 flex items-start gap-2.5">
          <span
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={
              frei
                ? { background: "rgba(37,99,235,.09)", color: ACCENT }
                : { background: "rgb(241,245,249)", color: "rgb(100,116,139)" }
            }
          >
            {frei ? <Lock size={16} strokeWidth={1.9} /> : card.kind === "lead" ? <PhoneCall size={16} strokeWidth={1.9} /> : <FileText size={16} strokeWidth={1.9} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-bold text-slate-900 leading-tight">
              {STATUS_LABEL[card.status] || card.status}
            </p>
            <p className="text-[11.5px] text-slate-400 mt-0.5">
              {fmtAlter(card.alterTage)}
              {card.region ? ` · ${card.region}` : ""}
            </p>
          </div>
          {potenzial && (
            <span className="text-[13px] font-bold tabular-nums shrink-0 text-slate-800">{potenzial}</span>
          )}
        </div>

        {/* Gesperrter Datenbereich — bewusst verschleiert */}
        <div className="px-4 mt-3">
          {frei ? (
            <div className="space-y-1.5" aria-label="Kontaktdaten gesperrt">
              <div className="h-2.5 rounded-full bg-slate-100 w-[62%]" />
              <div className="h-2.5 rounded-full bg-slate-100 w-[44%]" />
              <p className="text-[11px] text-slate-400 pt-1">
                Name und Nummer erscheinen nach der Übernahme.
              </p>
            </div>
          ) : vergeben ? (
            <p className="text-[12.5px] text-slate-500">
              In Bearbeitung bei <span className="font-semibold text-slate-700">{card.bearbeiterName}</span>
            </p>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <p className="text-[12.5px] font-semibold" style={{ color: ACCENT }}>
                Deine Akte — zum Öffnen tippen
              </p>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRelease(); }}
                className="text-[11.5px] font-semibold text-slate-400 hover:text-slate-600 px-2 py-1 rounded-lg transition-colors shrink-0"
                style={{ minHeight: 32 }}
              >
                Zurückgeben
              </button>
            </div>
          )}
        </div>

        {/* Merkmale */}
        <div className="px-4 pb-4 pt-3 flex flex-wrap items-center gap-1.5">
          {card.quelle && <Chip>{card.quelle}</Chip>}
          {card.kampagne && card.kampagne !== card.quelle && <Chip>{card.kampagne}</Chip>}
          {card.hatTelefon && <Chip>Telefon</Chip>}
          {signale.map((s) => (
            <span
              key={s.text}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border"
              style={{ borderColor: "rgba(37,99,235,.25)", color: ACCENT, background: "rgba(37,99,235,.06)" }}
            >
              <s.icon size={10} strokeWidth={2.2} /> {s.text}
            </span>
          ))}
        </div>

        {/* Sperrhinweis, wenn schon eine Akte aktiv ist */}
        {frei && blockedByActive && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] flex items-center justify-center px-5 text-center">
            <p className="text-[12px] font-medium text-slate-500 leading-relaxed">
              Erst das Ergebnis deiner aktiven Akte dokumentieren.
            </p>
          </div>
        )}
      </div>
    </Reveal>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border border-slate-200 text-slate-500 bg-white">
      {children}
    </span>
  );
}

function EmptyState({ tab }: { tab: string }) {
  const text =
    tab === "frei"
      ? { icon: Inbox, title: "Die Kartei ist gerade leer.", sub: "Sobald neue Leads eingehen oder Akten zurücklaufen, erscheinen sie hier — automatisch sortiert." }
      : tab === "meine"
        ? { icon: Users, title: "Du hast noch keine Akte übernommen.", sub: "Wechsle auf „Frei“ und nimm die oberste Karte. Du kannst so viele übernehmen, wie du schaffst." }
        : { icon: Sparkles, title: "Keine Karten gefunden.", sub: "Passe die Suche an oder wechsle den Bereich." };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center">
      <text.icon size={26} strokeWidth={1.5} className="mx-auto text-slate-300 mb-3" />
      <p className="text-[14px] font-semibold text-slate-700">{text.title}</p>
      <p className="text-[12.5px] text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">{text.sub}</p>
    </div>
  );
}
