import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Users, Check, Phone, Mail, MapPin, Cake, Info, Undo2, AlertTriangle } from "lucide-react";

// ════════════════════════════════════════════════════════════════════
// /admin/dubletten — Dubletten zusammenführen (P3-A Nachtrag).
// Zeigt Gruppen (E-Mail/Telefon) mit Konfidenz, Gewinner-Vorschlag und
// Feld-/Anrufbarkeits-Vorschau. Merge per Klick (Soft-Merge, KEIN Löschen),
// sofort rückgängig machbar (Undo per Batch). Läuft in der AdminShell.
// ════════════════════════════════════════════════════════════════════

const ACCENT = "#2563eb";

async function apiF(path: string, init?: RequestInit) {
  const res = await fetch(`/api/fiaon${path}`, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok && json?.ok, json };
}

type App = {
  ref: string; payment_reference: string | null; payment_status: string | null;
  amount_due: number | null; pack_name: string | null;
  first_name: string | null; last_name: string | null; contact_name: string | null;
  email: string | null; phone: string | null; phone_country_code: string | null; contact_phone: string | null;
  street: string | null; zip: string | null; city: string | null; birthdate: string | null;
  assigned_agent_id: number | null; created_at: string | null;
};
type Group = {
  matchType: "email" | "phone"; key: string; label: string; email: string | null;
  apps: App[]; winnerRef: string; confidence: "sicher" | "wahrscheinlich" | "pruefen";
  gainable: string[]; callableGain: boolean; paidCount: number;
};

const PAY_LABEL: Record<string, string> = {
  paid: "bezahlt", claimed_paid: "angekündigt", pending_payment: "offen",
  cancelled: "storniert", expired: "abgelaufen",
};
const CONF: Record<string, { label: string; cls: string }> = {
  sicher: { label: "Sicher", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  wahrscheinlich: { label: "Wahrscheinlich", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  pruefen: { label: "Prüfen", cls: "bg-slate-100 text-slate-600 border-slate-200" },
};
const GAIN_ICON: Record<string, JSX.Element> = {
  Telefon: <Phone size={12} />, "E-Mail": <Mail size={12} />, Adresse: <MapPin size={12} />, Geburtsdatum: <Cake size={12} />,
};

function name(a: App): string {
  return [a.first_name, a.last_name].filter(Boolean).join(" ") || a.contact_name || "—";
}
function eur(v: number | null): string {
  return v == null ? "—" : `${Number(v).toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`;
}

export default function AdminDubletten() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, string>>({});     // key → gewählter Gewinner-Ref
  const [flash, setFlash] = useState<{ text: string; kind: "ok" | "err" } | null>(null);
  const [lastMerge, setLastMerge] = useState<{ batch: string; primaryRef: string; count: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { ok, json } = await apiF("/admin/duplicates/groups");
    if (ok) {
      setGroups(json.groups || []);
      const p: Record<string, string> = {};
      for (const g of json.groups || []) p[g.key] = g.winnerRef;
      setPicked(p);
    } else setFlash({ text: "Konnte Dubletten nicht laden", kind: "err" });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), 4000); return () => clearTimeout(t); }, [flash]);

  const doMerge = async (g: Group) => {
    const primaryRef = picked[g.key] || g.winnerRef;
    const duplicateRefs = g.apps.map((a) => a.ref).filter((r) => r !== primaryRef);
    if (duplicateRefs.length === 0) return;
    setBusyKey(g.key);
    const { ok, json } = await apiF("/admin/applications/merge", {
      method: "POST",
      body: JSON.stringify({ primaryRef, duplicateRefs, reviewed: true }),
    });
    if (ok) {
      setLastMerge({ batch: json.batch, primaryRef, count: (json.merged || []).length });
      const filled = (json.fieldsUpdated || []).length;
      setFlash({ text: `Zusammengeführt in ${primaryRef} — ${(json.merged || []).length} Dublette(n)${filled ? `, ${filled} Feld(er) ergänzt` : ""}. Rückgängig möglich.`, kind: "ok" });
      await load();
    } else {
      setFlash({ text: `Fehler: ${json?.error || "Unbekannt"}`, kind: "err" });
    }
    setBusyKey(null);
  };

  const undo = async () => {
    if (!lastMerge) return;
    setBusyKey("undo");
    const { ok, json } = await apiF("/admin/applications/merge/undo", {
      method: "POST",
      body: JSON.stringify({ batch: lastMerge.batch }),
    });
    if (ok) {
      setFlash({ text: `Rückgängig gemacht — ${(json.restored || []).length} Datensatz/‑sätze wiederhergestellt.`, kind: "ok" });
      setLastMerge(null);
      await load();
    } else setFlash({ text: `Undo fehlgeschlagen: ${json?.error || "Unbekannt"}`, kind: "err" });
    setBusyKey(null);
  };

  const doubles = groups.filter((g) => g.paidCount > 1);
  const callable = groups.filter((g) => g.callableGain).length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex flex-wrap items-center gap-3 mb-1">
        <Users size={20} className="text-slate-400" />
        <h1 className="text-[19px] font-bold text-slate-900 flex-1 min-w-0">Dubletten zusammenführen</h1>
        <button onClick={load} disabled={loading}
          className="px-3 py-2 min-h-[38px] rounded-lg border border-slate-200 text-[12.5px] font-semibold text-slate-600 inline-flex items-center gap-1.5 hover:border-slate-300 disabled:opacity-50">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Aktualisieren
        </button>
      </div>
      <p className="text-[13px] text-slate-500 mb-4 max-w-3xl">
        Mehrfach angelegte Personen erkennen (gleiche E-Mail oder Telefonnummer) und zu einem Datensatz vereinen.
        Der Merge <b>füllt nur leere Felder</b> des Gewinners aus dem Verlierer — nichts wird überschrieben, nichts gelöscht,
        alles ist rückgängig machbar. Bezahlte Bestellungen bleiben unangetastet.
      </p>

      {/* Kennzahlen-Leiste */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">Gruppen</p>
          <p className="text-[20px] font-bold text-slate-900">{groups.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">Werden anrufbar</p>
          <p className="text-[20px] font-bold" style={{ color: ACCENT }}>{callable}</p>
        </div>
        <div className={`rounded-xl p-3 border ${doubles.length ? "bg-rose-50 border-rose-200" : "bg-white border-slate-200"}`}>
          <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">Doppelt bezahlt</p>
          <p className={`text-[20px] font-bold ${doubles.length ? "text-rose-700" : "text-slate-900"}`}>{doubles.length}</p>
        </div>
      </div>

      {flash && (
        <div className={`mb-4 px-3.5 py-2.5 rounded-lg text-[13px] flex items-center gap-3 ${flash.kind === "ok" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>
          <span className="flex-1">{flash.text}</span>
          {lastMerge && flash.kind === "ok" && (
            <button onClick={undo} disabled={busyKey === "undo"}
              className="px-2.5 py-1 rounded-md border border-emerald-300 font-semibold inline-flex items-center gap-1.5 hover:bg-emerald-100 disabled:opacity-50">
              <Undo2 size={12} /> Rückgängig
            </button>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-[13px] text-slate-400">Lädt…</p>
      ) : groups.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
          <Check size={28} className="text-emerald-500 mx-auto mb-2" />
          <p className="text-[14px] font-semibold text-slate-800">Keine Dubletten offen</p>
          <p className="text-[12.5px] text-slate-500 mt-1">Alle Personen sind eindeutig.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => {
            const winner = picked[g.key] || g.winnerRef;
            const conf = CONF[g.confidence];
            return (
              <div key={g.key} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                {/* Kopf */}
                <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/60">
                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${conf.cls}`}>{conf.label}</span>
                  <span className="text-[11px] text-slate-400 inline-flex items-center gap-1">
                    {g.matchType === "email" ? <Mail size={12} /> : <Phone size={12} />}
                    {g.matchType === "email" ? "E-Mail-Treffer" : "Telefon-Treffer"}
                  </span>
                  <span className="text-[12.5px] font-mono font-semibold text-slate-700">{g.label}</span>
                  {g.paidCount > 1 && (
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-100 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
                      <AlertTriangle size={11} /> {g.paidCount}× bezahlt
                    </span>
                  )}
                  {g.callableGain && (
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold border" style={{ color: ACCENT, borderColor: "#bfdbfe", background: "#eff6ff" }}>
                      wird anrufbar
                    </span>
                  )}
                  <span className="ml-auto text-[11px] text-slate-400">{g.apps.length} Datensätze</span>
                </div>

                {/* Datensätze */}
                <div className="divide-y divide-slate-100">
                  {g.apps.map((a) => {
                    const isWinner = a.ref === winner;
                    const phone = a.contact_phone || [a.phone_country_code, a.phone].filter(Boolean).join(" ") || null;
                    return (
                      <label key={a.ref} className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 cursor-pointer ${isWinner ? "bg-blue-50/40" : "hover:bg-slate-50/60"}`}>
                        <input type="radio" name={`w_${g.key}`} checked={isWinner}
                          onChange={() => setPicked((p) => ({ ...p, [g.key]: a.ref }))}
                          className="accent-blue-600" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[13.5px] font-semibold text-slate-900 truncate">{name(a)}</span>
                            {isWinner && <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: ACCENT }}>behalten</span>}
                          </div>
                          <div className="text-[11.5px] text-slate-500 flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                            <span className="font-mono">{a.ref}</span>
                            {a.email && <span className="inline-flex items-center gap-1"><Mail size={11} />{a.email}</span>}
                            {phone && <span className="inline-flex items-center gap-1"><Phone size={11} />{phone}</span>}
                            {(a.city || a.zip) && <span className="inline-flex items-center gap-1"><MapPin size={11} />{[a.zip, a.city].filter(Boolean).join(" ")}</span>}
                            {a.birthdate && <span className="inline-flex items-center gap-1"><Cake size={11} />{new Date(a.birthdate).toLocaleDateString("de-DE")}</span>}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${a.payment_status === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                            {PAY_LABEL[a.payment_status || ""] || a.payment_status || "—"}
                          </span>
                          <div className="text-[11.5px] text-slate-500 mt-0.5">{eur(a.amount_due)}{a.assigned_agent_id ? " · Agent" : ""}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {/* Fußzeile: Feld-Vorschau + Aktion */}
                <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-t border-slate-100 bg-slate-50/40">
                  {g.gainable.length > 0 ? (
                    <span className="text-[12px] text-slate-600 inline-flex items-center gap-2 flex-wrap">
                      <Info size={13} className="text-slate-400" /> Gewinner erhält:
                      {g.gainable.map((f) => (
                        <span key={f} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[11px] font-medium text-slate-700">
                          {GAIN_ICON[f]} {f}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="text-[12px] text-slate-400">Keine fehlenden Felder zu ergänzen</span>
                  )}
                  <button onClick={() => doMerge(g)} disabled={busyKey === g.key}
                    className="ml-auto px-3.5 py-2 min-h-[38px] rounded-lg text-white text-[12.5px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
                    style={{ background: ACCENT }}>
                    <Check size={14} /> {busyKey === g.key ? "Führe zusammen…" : "Zusammenführen"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
