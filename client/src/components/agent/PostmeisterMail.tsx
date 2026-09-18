// ═══════════════════════════════════════════════════════════════════════════
// EINE KUNDENMAIL AUS DEM POSTFACH — mit Maras Antwort oder Entwurf
//
// Stand bis 18.09.2026 in aufgaben.tsx. Jetzt eine Komponente, weil sie an zwei
// Stellen gebraucht wird: in der Aufgabe (Marke [Mail #id]) und im Reiter
// „E-Mails" der Akte (Schriftverkehr). Team-Feedback Priorität 6: Der Betreuer
// entscheidet selbst — Entwurf senden (auch geändert) oder übernehmen.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from "react";
import { ACCENT } from "@/pages/agent/shared";

async function api(pfad: string, init?: RequestInit) {
  const res = await fetch(`/api/fiaon${pfad}`, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  const json = await res.json().catch(() => null);
  return { ok: res.ok && json?.ok, json };
}

function zeit(v: string | null): string {
  if (!v) return "";
  return new Date(v).toLocaleString("de-DE", {
    timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

/** Die ganze E-Mail zur Aufgabe: Betreff, Absender, Zeit, Text, Maras Antwort, Anhänge. */
export function PostmeisterMail({ id }: { id: number }) {
  const [mail, setMail] = useState<any>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const laden = useCallback(() => {
    void api(`/agent/postmeister/${id}`).then((r) => {
      if (r.ok) { setMail(r.json.mail); setText(String(r.json.mail?.antwort || "")); } else setFehler(r.json?.error || "Die E-Mail konnte nicht geladen werden.");
    });
  }, [id]);
  useEffect(() => { laden(); }, [laden]);
  // 18.09.2026 (Team-Feedback Priorität 6): Der Betreuer entscheidet selbst —
  // Maras Entwurf senden (auch geändert) oder übernehmen und selbst antworten.
  const handeln = async (was: "senden" | "erledigt") => {
    setLaeuft(true); setMeldung(null);
    const body = was === "senden"
      ? (text.trim() !== String(mail?.antwort || "").trim() ? { text } : {})
      : { wie: "selbst beantwortet oder angerufen" };
    const r = await api(`/agent/postmeister/${id}/${was}`, { method: "POST", body: JSON.stringify(body) });
    setLaeuft(false);
    setMeldung(r.ok ? (r.json?.meldung || "Erledigt.") : (r.json?.error || "Das hat nicht geklappt."));
    if (r.ok) laden();
  };
  const offenerEntwurf = !!mail && !mail.gesendetAm && !!mail.antwort
    && ["entwurf", "fehler", "versand_wartet", "versand_fehlgeschlagen"].includes(String(mail.aktion));
  if (fehler) return <p className="mt-2 text-[12px]" style={{ color: "#b45309" }}>{fehler}</p>;
  if (!mail) return <p className="mt-2 text-[12px] text-slate-400">E-Mail wird geladen …</p>;
  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-[12.5px] text-slate-700">
      <p className="text-[11px] uppercase tracking-[.08em] font-semibold text-slate-400 mb-1">E-Mail des Kunden</p>
      <p><b>{mail.betreff || "(kein Betreff)"}</b></p>
      <p className="text-slate-500">von {mail.von} · {zeit(mail.empfangenAm)} · an {mail.postfach}</p>
      <pre className="mt-2 whitespace-pre-wrap font-sans text-[12.5px] leading-relaxed text-slate-800">{mail.text}</pre>
      {Array.isArray(mail.anhaenge) && mail.anhaenge.length > 0 && (
        <p className="mt-2">
          Anhänge:{" "}
          {mail.anhaenge.map((a: any) => (
            <a key={a.idx} href={`/api/fiaon/agent/postmeister/${id}/anhang/${a.idx}`} target="_blank" rel="noreferrer"
               className="font-semibold mr-2" style={{ color: ACCENT }}>{a.name}</a>
          ))}
        </p>
      )}
      {mail.antwort && !offenerEntwurf && (
        <>
          <p className="text-[11px] uppercase tracking-[.08em] font-semibold text-slate-400 mt-3 mb-1">
            Antwort {mail.gesendetAm ? `(gesendet ${zeit(mail.gesendetAm)})` : "(nicht gesendet)"}
          </p>
          <pre className="whitespace-pre-wrap font-sans text-[12.5px] leading-relaxed text-slate-700">{mail.antwort}</pre>
        </>
      )}
      {offenerEntwurf && (
        <>
          <p className="text-[11px] uppercase tracking-[.08em] font-semibold text-slate-400 mt-3 mb-1">
            Maras Entwurf — noch nicht gesendet. Du kannst ihn ändern.
          </p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={Math.min(16, Math.max(6, text.split("\n").length + 1))}
            className="w-full rounded-lg border border-slate-200 bg-white p-2 text-[12.5px] leading-relaxed text-slate-800" />
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" disabled={laeuft || text.trim().length < 10} onClick={() => void handeln("senden")}
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white disabled:opacity-50" style={{ background: ACCENT }}>
              {laeuft ? "…" : "So an den Kunden senden"}
            </button>
            <button type="button" disabled={laeuft} onClick={() => void handeln("erledigt")}
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-white text-slate-700 border border-slate-200 disabled:opacity-50">
              Selbst beantwortet / angerufen
            </button>
          </div>
        </>
      )}
      {meldung && <p className="mt-2 text-[12px] font-semibold" style={{ color: ACCENT }}>{meldung}</p>}
    </div>
  );
}

