// ═══════════════════════════════════════════════════════════════════════════
// /agent/updates — Raum „Feed“ (23.08.2026, Plan §4/§11)
//
// Ersetzt updates.tsx und feedback.tsx in einem Raum mit zwei Reitern:
//   Neuigkeiten  Das Update-Protokoll für Mitarbeiter (AGENT_UPDATES aus
//                updates-data.ts): was gemacht wurde, wie man es bedient.
//                Der Aufruf markiert alles als gesehen (Badge verschwindet).
//   Feedback     Verbesserung / Fehler / Idee einreichen (mit Screenshot),
//                eigene Tickets als Verlauf lesen, antworten, Boni sehen.
// Endpunkte wie bisher: GET /agent/feedback, POST /agent/feedback
//   { category, title, description, screenshot }, POST /agent/feedback/:id/reply
//   { body }, POST /agent/feedback/:id/read. Ereignis `agent-feedback-read`.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { ChevronDown, ListChecks, Hand, ArrowRight, MessageSquarePlus, HandCoins, ImagePlus, X, CheckCircle2, Send, CircleDot } from "lucide-react";
import { AgentShell, api, fmtCents, fmtD, fmtDT } from "./shared";
import { useOffice } from "./OfficeShell";
import { AGENT_UPDATES, markUpdatesSeen, fmtUpdateDate, getUnseenCount, type AgentUpdate, type UpdateCategory } from "./updates-data";
import "@/styles/office-feed.css";

const KATEGORIEN: UpdateCategory[] = ["Neu", "Verbessert", "Behoben", "Geändert", "Hintergrund"];

export default function AgentFeedPage() { return <AgentShell><FeedInnen /></AgentShell>; }

function FeedInnen() {
  const { dunkel, titel } = useOffice();
  useEffect(() => { dunkel(true); titel("Feed"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [reiter, setReiter] = useState<"neu" | "feedback">(() => (typeof window !== "undefined" && window.location.search.includes("feedback")) ? "feedback" : "neu");
  // Die Zahl einmal beim Öffnen merken – danach gilt alles als gesehen.
  const [ungelesen] = useState(() => getUnseenCount());
  useEffect(() => { markUpdatesSeen(); }, []);
  const [feedbackZahl, setFeedbackZahl] = useState<number | null>(null);
  const [boni, setBoni] = useState(0);
  const letztes = AGENT_UPDATES[0];

  return (
    <div className="fe">
      <section className="fe-kopf">
        <div>
          <span className="fe-pille">Feed · Stand {letztes ? fmtUpdateDate(letztes.date) : "–"}</span>
          <h1>{ungelesen > 0 ? <><span className="fe-verlauf">{ungelesen} {ungelesen === 1 ? "Neuerung" : "Neuerungen"}</span> seit deinem letzten Besuch.</> : <>Du bist <span className="fe-verlauf">auf dem Stand.</span></>}</h1>
          <p>Was sich im Office geändert hat – in einfacher Sprache, mit Schritten zum Bedienen. Und dein Draht zurück: Feedback, das umgesetzt wird, bringt eine Provisions-Gutschrift.</p>
        </div>
        <div className="fe-lage">
          <small>Überblick</small>
          <div className="fe-lage-zahl"><b>{AGENT_UPDATES.length}</b><span>Einträge im Protokoll</span></div>
          <div className="fe-lage-zeile"><span>Deine Feedback-Tickets</span><b>{feedbackZahl ?? "–"}</b></div>
          <div className="fe-lage-zeile"><span>Erhaltene Boni</span><b>{boni > 0 ? fmtCents(boni) : "–"}</b></div>
        </div>
      </section>

      <div className="fe-reiter" role="tablist">
        <button type="button" role="tab" aria-selected={reiter === "neu"} className={reiter === "neu" ? "an" : ""} onClick={() => setReiter("neu")}>Neuigkeiten {ungelesen > 0 && <em>{ungelesen}</em>}</button>
        <button type="button" role="tab" aria-selected={reiter === "feedback"} className={reiter === "feedback" ? "an" : ""} onClick={() => setReiter("feedback")}>Feedback</button>
      </div>

      {reiter === "neu" && <Neuigkeiten ungelesen={ungelesen} zumFeedback={() => setReiter("feedback")} />}
      <div style={{ display: reiter === "feedback" ? "contents" : "none" }}>
        <Feedback onStand={(n, b) => { setFeedbackZahl(n); setBoni(b); }} />
      </div>
    </div>
  );
}

// ── Neuigkeiten ──────────────────────────────────────────────────────────────
function Neuigkeiten({ ungelesen, zumFeedback }: { ungelesen: number; zumFeedback: () => void }) {
  const [filter, setFilter] = useState<UpdateCategory | "alle">("alle");
  const [auf, setAuf] = useState<Record<string, boolean>>(() => AGENT_UPDATES[0] ? { [AGENT_UPDATES[0].id]: true } : {});
  const [anzahl, setAnzahl] = useState(20);
  const liste = useMemo(() => AGENT_UPDATES.filter((u) => filter === "alle" || u.category === filter), [filter]);
  const toggle = (id: string) => setAuf((o) => ({ ...o, [id]: !o[id] }));
  return (
    <>
      <div className="fe-leiste">
        <div className="fe-filter">
          <button type="button" className={filter === "alle" ? "an" : ""} onClick={() => setFilter("alle")}>Alle</button>
          {KATEGORIEN.map((k) => <button key={k} type="button" className={filter === k ? "an" : ""} onClick={() => setFilter(k)}>{k}</button>)}
        </div>
      </div>
      <div className="fe-liste">
        {liste.length === 0 && <p className="fe-leer">Nichts in dieser Kategorie.</p>}
        {liste.slice(0, anzahl).map((u) => <Update key={u.id} u={u} neu={AGENT_UPDATES.indexOf(u) < ungelesen} auf={!!auf[u.id]} onToggle={() => toggle(u.id)} />)}
        {liste.length > anzahl && <button type="button" className="fe-knopf still" onClick={() => setAnzahl((n) => n + 20)}>Ältere Einträge zeigen ({liste.length - anzahl})</button>}
      </div>
      <div className="fe-hinweis">
        <i><MessageSquarePlus size={18} strokeWidth={1.75} /></i>
        <div><b>Du hast eine Idee fürs Office?</b><span>Reiche Feedback ein – umgesetzte Vorschläge werden mit einer Provisions-Gutschrift belohnt.</span></div>
        <button type="button" className="fe-knopf" onClick={zumFeedback}>Feedback geben <ArrowRight size={15} /></button>
      </div>
    </>
  );
}

function Update({ u, neu, auf, onToggle }: { u: AgentUpdate; neu: boolean; auf: boolean; onToggle: () => void }) {
  return (
    <article className={`fe-update${auf ? " auf" : ""}${neu ? " neu" : ""}`}>
      <button type="button" className="fe-update-kopf" onClick={onToggle} aria-expanded={auf}>
        <span>
          <span className="fe-marken">
            <span className={`fe-kat ${u.category}`}>{u.category}</span>
            {neu && <span className="fe-punkt" aria-label="ungelesen" />}
            {u.important && <span className="fe-wichtig">wichtig</span>}
            <span className="fe-datum">{fmtUpdateDate(u.date)}</span>
          </span>
          <h3>{u.title}</h3>
          <p>{u.summary}</p>
        </span>
        <ChevronDown size={18} className="fe-pfeil" />
      </button>
      {auf && (
        <div className="fe-update-innen">
          <section>
            <p className="fe-titel"><ListChecks size={13} strokeWidth={2} /> Was wurde gemacht</p>
            <ul>{u.changes.map((c, i) => <li key={i}><span>{c}</span></li>)}</ul>
          </section>
          {u.howto && u.howto.length > 0 && (
            <section>
              <p className="fe-titel"><Hand size={13} strokeWidth={2} /> So bedienst du es</p>
              <ol>{u.howto.map((s, i) => <li key={i}><i>{i + 1}</i><span>{s}</span></li>)}</ol>
            </section>
          )}
          {u.link && <div><Link href={u.link.href} className="fe-knopf klein">{u.link.label} <ArrowRight size={14} /></Link></div>}
        </div>
      )}
    </article>
  );
}

// ── Feedback ─────────────────────────────────────────────────────────────────
interface ThreadMessage { id: number; author: "agent" | "admin" | "system"; body: string | null; event: string | null; meta: string | null; created_at: string }
interface FeedbackItem { id: number; category: string; title: string; status: string; admin_comment: string | null; reward_cents: number | null; duplicate_of: number | null; created_at: string; messages: ThreadMessage[]; unread: number }
const CATEGORIES: { key: string; label: string }[] = [
  { key: "verbesserung", label: "Verbesserung" }, { key: "bug", label: "Fehler / Bug" }, { key: "idee", label: "Neue Idee" }, { key: "sonstiges", label: "Sonstiges" },
];
const STATUS_LABELS: Record<string, string> = { offen: "Offen", geprueft: "Geprüft", umgesetzt: "Umgesetzt", abgelehnt: "Abgelehnt" };

/** Screenshot clientseitig auf max. 1280px verkleinern (JPEG, DataURL) – wie bisher. */
async function resizeScreenshot(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = url; });
    const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally { URL.revokeObjectURL(url); }
}

function Feedback({ onStand }: { onStand: (anzahl: number, boniCents: number) => void }) {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [rewardTotal, setRewardTotal] = useState(0);
  const [meldung, setMeldung] = useState<{ text: string; warn?: boolean } | null>(null);
  const [form, setForm] = useState({ category: "verbesserung", title: "", description: "" });
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [replies, setReplies] = useState<Record<number, string>>({});
  const [replyBusy, setReplyBusy] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const flash = (text: string, warn = false) => { setMeldung({ text, warn }); setTimeout(() => setMeldung(null), 4500); };

  const load = useCallback(() => {
    api("/agent/feedback").then((r) => { if (r.ok) { setItems(r.json.data || []); setRewardTotal(r.json.rewardTotalCents || 0); onStand((r.json.data || []).length, r.json.rewardTotalCents || 0); } });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(load, [load]);

  const toggle = async (f: FeedbackItem) => {
    const willOpen = !expanded[f.id];
    setExpanded((e) => ({ ...e, [f.id]: willOpen }));
    if (willOpen && f.unread > 0) {
      await api(`/agent/feedback/${f.id}/read`, { method: "POST" });
      setItems((list) => list.map((x) => (x.id === f.id ? { ...x, unread: 0 } : x)));
      window.dispatchEvent(new Event("agent-feedback-read"));
    }
  };
  const sendReply = async (f: FeedbackItem) => {
    const body = (replies[f.id] || "").trim();
    if (!body) return;
    setReplyBusy(f.id);
    const r = await api(`/agent/feedback/${f.id}/reply`, { method: "POST", body: JSON.stringify({ body }) });
    setReplyBusy(null);
    if (r.ok) { setReplies((x) => ({ ...x, [f.id]: "" })); flash("Antwort gesendet – das Admin-Team wird benachrichtigt."); load(); } else flash(r.json?.error || "Fehler beim Senden.", true);
  };
  const pickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { flash("Bitte ein Bild (JPG/PNG/WebP) wählen.", true); return; }
    if (f.size > 8 * 1024 * 1024) { flash("Bild zu groß (max. 8 MB Rohdatei).", true); return; }
    try { setScreenshot(await resizeScreenshot(f)); } catch { flash("Bild konnte nicht verarbeitet werden.", true); }
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) return;
    setBusy(true);
    const r = await api("/agent/feedback", { method: "POST", body: JSON.stringify({ ...form, title: form.title.trim(), description: form.description.trim(), screenshot }) });
    setBusy(false);
    if (r.ok) { setForm({ category: "verbesserung", title: "", description: "" }); setScreenshot(null); setSent(true); setTimeout(() => setSent(false), 4000); flash("Danke – dein Feedback ist beim Admin-Team eingegangen."); load(); }
    else flash(r.json?.error || "Fehler beim Senden.", true);
  };

  return (
    <>
      {meldung && <p className={meldung.warn ? "fe-fehler" : "fe-meldung"}>{meldung.text}</p>}
      {rewardTotal > 0 && (
        <div className="fe-hinweis"><i><HandCoins size={18} strokeWidth={1.75} /></i><div><b>Bisher erhaltene Feedback-Boni: {fmtCents(rewardTotal)}</b><span>Gutschriften fließen in dein normales Guthaben.</span></div></div>
      )}
      <div className="fe-spalten">
        <section className="fe-block">
          <div className="fe-block-kopf"><b>Neues Feedback einreichen</b><small>Verbesserung, Fehler, Idee</small></div>
          {sent ? (
            <div className="fe-danke"><CheckCircle2 size={28} strokeWidth={1.75} style={{ color: "#34d399" }} /><b>Eingegangen – danke für deinen Beitrag.</b><span>Das Admin-Team prüft deinen Vorschlag.</span></div>
          ) : (
            <form onSubmit={submit} className="fe-form">
              <div className="fe-kats">{CATEGORIES.map((c) => <button key={c.key} type="button" className={form.category === c.key ? "an" : ""} onClick={() => setForm((f) => ({ ...f, category: c.key }))}>{c.label}</button>)}</div>
              <input type="text" className="fe-feld" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Kurzer Titel – z. B. Calendar: Wochenansicht verbessern" maxLength={160} aria-label="Titel" />
              <textarea className="fe-feld" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Beschreibe deinen Vorschlag oder das Problem so konkret wie möglich …" rows={4} maxLength={6000} aria-label="Beschreibung" />
              <div className="fe-bild">
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={pickFile} />
                {screenshot ? (
                  <><img src={screenshot} alt="" /><button type="button" className="fe-knopf still klein" onClick={() => setScreenshot(null)} aria-label="Screenshot entfernen"><X size={14} /> Entfernen</button></>
                ) : (
                  <button type="button" className="fe-bild-knopf" onClick={() => fileRef.current?.click()}><ImagePlus size={15} strokeWidth={1.75} /> Screenshot anhängen (optional)</button>
                )}
              </div>
              <button type="submit" className="fe-knopf" disabled={busy || !form.title.trim() || !form.description.trim()} style={{ minHeight: 48 }}>{busy ? "Sende …" : "Feedback einreichen"}</button>
            </form>
          )}
        </section>

        <section className="fe-block">
          <div className="fe-block-kopf"><b>Deine Tickets</b><small>{items.length ? `${items.length} gesamt` : ""}</small></div>
          {items.length === 0 && <p className="fe-leer">Noch keine Tickets. Dein erstes Feedback landet hier – mit Antwort des Admin-Teams.</p>}
          {items.map((f) => {
            const isOpen = !!expanded[f.id];
            return (
              <div key={f.id} className="fe-ticket">
                <button type="button" className="fe-ticket-kopf" onClick={() => void toggle(f)} aria-expanded={isOpen}>
                  {f.unread > 0 && !isOpen && <span className="fe-punkt" aria-label="Ungelesene Antwort" />}
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <b>#{f.id} · {f.title}</b>
                    <small>{CATEGORIES.find((c) => c.key === f.category)?.label || f.category} · {fmtD(f.created_at)}{f.duplicate_of != null && <> · Duplikat von #{f.duplicate_of}</>}{f.reward_cents != null && <> · <em>+{fmtCents(f.reward_cents)} Bonus</em></>}</small>
                  </span>
                  <span className={`fe-status ${f.status}`}>{STATUS_LABELS[f.status] || f.status}</span>
                  <ChevronDown size={16} className="fe-pfeil" style={{ transform: isOpen ? "rotate(180deg)" : "none", marginTop: 0 }} />
                </button>
                {isOpen && (
                  <div>
                    <Verlauf messages={f.messages} />
                    {f.status === "abgelehnt" && <p className="fe-kleinhinweis">Dieses Ticket wurde abgelehnt. Du kannst trotzdem antworten – das Admin-Team sieht deine Nachricht.</p>}
                    <div className="fe-antwort">
                      <textarea className="fe-feld" value={replies[f.id] ?? ""} onChange={(e) => setReplies((x) => ({ ...x, [f.id]: e.target.value }))} placeholder="Antworten … (kein neues Ticket – bleibt in diesem Verlauf)" rows={2} maxLength={6000} aria-label="Antwort"
                        onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); void sendReply(f); } }} />
                      <button type="button" className="fe-knopf" onClick={() => void sendReply(f)} disabled={replyBusy === f.id || !(replies[f.id] || "").trim()} aria-label="Antwort senden"><Send size={14} strokeWidth={2} /> {replyBusy === f.id ? "…" : "Senden"}</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      </div>
    </>
  );
}

function Verlauf({ messages }: { messages: ThreadMessage[] }) {
  if (!messages || messages.length === 0) return <p className="fe-kleinhinweis">Noch kein Verlauf.</p>;
  return (
    <div className="fe-verlauf-liste">
      {messages.map((m) => m.author === "system"
        ? <div key={m.id} className="fe-blase system"><CircleDot size={11} style={{ verticalAlign: -1, marginRight: 5 }} />{m.body} · {fmtDT(m.created_at)}</div>
        : <div key={m.id} className={`fe-blase ${m.author}`}><small>{m.author === "agent" ? "Du" : "Admin-Team"} · {fmtDT(m.created_at)}</small>{m.body}</div>)}
    </div>
  );
}
