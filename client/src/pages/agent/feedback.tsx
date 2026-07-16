import { useState, useEffect, useCallback, useRef } from "react";
import { HandCoins, ImagePlus, X, CheckCircle2, Send, ChevronDown, CircleDot } from "lucide-react";
import { AgentShell, Badge, Card, FlashMessage, api, fmtCents, fmtD, fmtDT, inputCls, btnPrimary, ACCENT } from "./shared";
import { Reveal } from "./motion";

// ============================================================================
// /agent/feedback (Paket AN) — Verbesserungsvorschlag/Bug/Idee einreichen.
// Jede Einreichung landet als Ticket im Admin (Agent-Feedback). Umgesetztes
// Feedback kann der Admin mit einer EINMALIGEN Provisions-Gutschrift
// (kind='feedback_bonus') honorieren — sie fließt ins normale Guthaben.
// ============================================================================

interface ThreadMessage {
  id: number;
  author: "agent" | "admin" | "system";
  body: string | null;
  event: string | null;
  meta: string | null;
  created_at: string;
}
interface FeedbackItem {
  id: number;
  category: string;
  title: string;
  status: string;
  admin_comment: string | null;
  reward_cents: number | null;
  duplicate_of: number | null;
  created_at: string;
  messages: ThreadMessage[];
  unread: number;
}

const CATEGORIES: { key: string; label: string }[] = [
  { key: "verbesserung", label: "Verbesserung" },
  { key: "bug", label: "Fehler / Bug" },
  { key: "idee", label: "Neue Idee" },
  { key: "sonstiges", label: "Sonstiges" },
];

const STATUS_LABELS: Record<string, string> = {
  offen: "Offen",
  geprueft: "Geprüft",
  umgesetzt: "Umgesetzt",
  abgelehnt: "Abgelehnt",
};

/** Screenshot clientseitig auf max. 1280px verkleinern (JPEG, DataURL). */
async function resizeScreenshot(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function AgentFeedbackPage() {
  return (
    <AgentShell>
      <FeedbackContent />
    </AgentShell>
  );
}

function FeedbackContent() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [rewardTotal, setRewardTotal] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({ category: "verbesserung", title: "", description: "" });
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [replies, setReplies] = useState<Record<number, string>>({});
  const [replyBusy, setReplyBusy] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const flash = (m: string) => { setMessage(m); setTimeout(() => setMessage(null), 4500); };

  const load = useCallback(() => {
    api("/agent/feedback").then((r) => {
      if (r.ok) { setItems(r.json.data); setRewardTotal(r.json.rewardTotalCents); }
    });
  }, []);
  useEffect(load, [load]);

  // Thread öffnen: markiert ungelesene Antworten als gelesen und aktualisiert das
  // Nav-Badge (Event für die Shell). Kein neues Ticket — reine Ansicht.
  const toggle = async (f: FeedbackItem) => {
    const willOpen = !expanded[f.id];
    setExpanded((e) => ({ ...e, [f.id]: willOpen }));
    if (willOpen && f.unread > 0) {
      await api(`/agent/feedback/${f.id}/read`, { method: "POST" });
      setItems((list) => list.map((x) => (x.id === f.id ? { ...x, unread: 0 } : x)));
      window.dispatchEvent(new Event("agent-feedback-read"));
    }
  };

  // Agent antwortet IM Thread — kein neues Ticket.
  const sendReply = async (f: FeedbackItem) => {
    const body = (replies[f.id] || "").trim();
    if (!body) return;
    setReplyBusy(f.id);
    const r = await api(`/agent/feedback/${f.id}/reply`, { method: "POST", body: JSON.stringify({ body }) });
    setReplyBusy(null);
    if (r.ok) {
      setReplies((x) => ({ ...x, [f.id]: "" }));
      flash("Antwort gesendet — das Admin-Team wird benachrichtigt.");
      load();
    } else flash(r.json?.error || "Fehler beim Senden");
  };

  const pickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { flash("Bitte ein Bild (JPG/PNG/WebP) wählen"); return; }
    if (f.size > 8 * 1024 * 1024) { flash("Bild zu groß (max. 8 MB Rohdatei)"); return; }
    try { setScreenshot(await resizeScreenshot(f)); } catch { flash("Bild konnte nicht verarbeitet werden"); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) return;
    setBusy(true);
    const r = await api("/agent/feedback", {
      method: "POST",
      body: JSON.stringify({ ...form, title: form.title.trim(), description: form.description.trim(), screenshot }),
    });
    setBusy(false);
    if (r.ok) {
      setForm({ category: "verbesserung", title: "", description: "" });
      setScreenshot(null);
      setSent(true);
      setTimeout(() => setSent(false), 4000);
      flash("Danke — dein Feedback ist beim Admin-Team eingegangen.");
      load();
    } else flash(r.json?.error || "Fehler beim Senden");
  };

  return (
    <div className="max-w-2xl pb-24 md:pb-8">
      <Reveal index={0}>
        <h1 className="text-xl font-bold tracking-tight mb-1">Feedback</h1>
        <p className="text-[12px] text-slate-400 mb-5">
          Hilf uns, das System zu verbessern — umgesetzte Vorschläge werden mit einer einmaligen Provisions-Gutschrift belohnt.
        </p>
      </Reveal>
      <FlashMessage message={message} />

      {rewardTotal > 0 && (
        <Reveal index={1}>
          <div className="agent-glass rounded-2xl px-5 py-4 mb-4 flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(37,99,235,.10)", color: ACCENT }}>
              <HandCoins size={17} strokeWidth={1.8} />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-slate-900">Bisher erhaltene Feedback-Boni: <span className="tabular-nums" style={{ color: ACCENT }}>{fmtCents(rewardTotal)}</span></p>
              <p className="text-[11.5px] text-slate-400">Gutschriften fließen in dein normales Guthaben.</p>
            </div>
          </div>
        </Reveal>
      )}

      {/* Einreichen */}
      <Reveal index={2}>
        <div className="agent-glass rounded-2xl p-5 mb-6">
          <h2 className="text-[13px] font-semibold text-slate-900 mb-3">Neues Feedback einreichen</h2>
          {sent ? (
            <div className="py-6 text-center agent-check-in">
              <CheckCircle2 size={26} strokeWidth={1.8} className="mx-auto mb-2" style={{ color: ACCENT }} />
              <p className="text-[13px] font-semibold text-slate-800">Eingegangen — danke für deinen Beitrag.</p>
              <p className="text-[12px] text-slate-400 mt-0.5">Das Admin-Team prüft deinen Vorschlag.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setForm((f) => ({ ...f, category: c.key })); }}
                    className={`px-3.5 py-2 rounded-lg text-[12px] font-semibold border transition-all duration-150 ${
                      form.category === c.key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Kurzer Titel — z. B. Kalender: Wochenansicht verbessern"
                className={inputCls}
                maxLength={160}
                style={{ minHeight: 46 }}
              />
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Beschreibe deinen Vorschlag oder das Problem so konkret wie möglich …"
                rows={4}
                className={`${inputCls} resize-none`}
                maxLength={6000}
              />
              <div className="flex items-center gap-2">
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pickFile} />
                {screenshot ? (
                  <div className="flex items-center gap-2">
                    <img src={screenshot} alt="" className="h-12 rounded-lg border border-slate-200 object-cover" />
                    <button type="button" onClick={(e) => { e.stopPropagation(); setScreenshot(null); }}
                      className="w-8 h-8 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                    className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-500 hover:text-slate-800 transition-colors">
                    <ImagePlus size={14} strokeWidth={1.8} /> Screenshot anhängen (optional)
                  </button>
                )}
              </div>
              <button type="submit" disabled={busy || !form.title.trim() || !form.description.trim()}
                className={`${btnPrimary} w-full py-3`} style={{ minHeight: 48 }}>
                {busy ? "Sende …" : "Feedback einreichen"}
              </button>
            </form>
          )}
        </div>
      </Reveal>

      {/* Eigene Tickets — jedes ist ein Thread: aufklappen, lesen, antworten */}
      <Reveal index={3}>
        <h2 className="text-[13px] font-semibold text-slate-900 mb-2">Deine Tickets</h2>
        <Card className="divide-y divide-slate-50">
          {items.length === 0 && (
            <p className="px-4 py-8 text-center text-[12px] text-slate-400">Noch keine Tickets.</p>
          )}
          {items.map((f) => {
            const isOpen = !!expanded[f.id];
            return (
              <div key={f.id} className="px-4 py-3">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggle(f); }}
                  aria-expanded={isOpen}
                  className="w-full flex items-center gap-3 text-left min-h-[44px]"
                >
                  {f.unread > 0 && !isOpen && (
                    <span className="shrink-0 w-2 h-2 rounded-full" style={{ background: ACCENT }} aria-label="Ungelesene Antwort" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-slate-900 truncate">
                      #{f.id} · {f.title}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {CATEGORIES.find((c) => c.key === f.category)?.label || f.category} · {fmtD(f.created_at)}
                      {f.duplicate_of != null && <span> · Duplikat von #{f.duplicate_of}</span>}
                      {f.reward_cents != null && (
                        <span className="font-semibold" style={{ color: ACCENT }}> · +{fmtCents(f.reward_cents)} Bonus</span>
                      )}
                    </p>
                  </div>
                  <Badge label={STATUS_LABELS[f.status] || f.status} status={f.status === "umgesetzt" ? "claimed_paid" : undefined} />
                  <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                </button>

                {isOpen && (
                  <div className="mt-3">
                    <ThreadView messages={f.messages} />
                    {f.status === "abgelehnt" ? (
                      <p className="mt-3 text-[11.5px] text-slate-400">
                        Dieses Ticket wurde abgelehnt. Du kannst trotzdem antworten — das Admin-Team sieht deine Nachricht.
                      </p>
                    ) : null}
                    <div className="mt-3 flex items-end gap-2">
                      <textarea
                        value={replies[f.id] ?? ""}
                        onChange={(e) => setReplies((x) => ({ ...x, [f.id]: e.target.value }))}
                        placeholder="Antworten … (kein neues Ticket — bleibt in diesem Verlauf)"
                        rows={2}
                        className={`${inputCls} resize-none`}
                        maxLength={6000}
                        onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); sendReply(f); } }}
                      />
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); sendReply(f); }}
                        disabled={replyBusy === f.id || !(replies[f.id] || "").trim()}
                        className={`${btnPrimary} shrink-0 inline-flex items-center gap-1.5`}
                        style={{ minHeight: 46 }}
                        aria-label="Antwort senden"
                      >
                        <Send size={14} strokeWidth={2} /> {replyBusy === f.id ? "…" : "Senden"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      </Reveal>
    </div>
  );
}

// Chronologischer Verlauf: Agent rechts (Du), Betreiber links, System mittig.
function ThreadView({ messages }: { messages: ThreadMessage[] }) {
  if (!messages || messages.length === 0) {
    return <p className="text-[12px] text-slate-400">Noch kein Verlauf.</p>;
  }
  return (
    <div className="space-y-2.5">
      {messages.map((m) => {
        if (m.author === "system") {
          return (
            <div key={m.id} className="flex justify-center">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 bg-slate-50 border border-slate-100 rounded-full px-3 py-1">
                <CircleDot size={11} className="text-slate-400" />
                {m.body} <span className="text-slate-400">· {fmtDT(m.created_at)}</span>
              </span>
            </div>
          );
        }
        const mine = m.author === "agent";
        return (
          <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${mine ? "text-white" : "bg-slate-50 border border-slate-100 text-slate-700"}`}
              style={mine ? { background: ACCENT } : undefined}>
              <p className={`text-[10px] font-semibold uppercase tracking-wide mb-0.5 ${mine ? "text-white/70" : "text-slate-400"}`}>
                {mine ? "Du" : "Betreiber"} · {fmtDT(m.created_at)}
              </p>
              <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">{m.body}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
