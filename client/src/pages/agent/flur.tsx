// ═══════════════════════════════════════════════════════════════════════════
// /agent/flur — Raum 3: Der Flur (23.08.2026)
//
// Wer ist da, wer telefoniert, wer macht Pause – remote, aber nicht allein.
// Präsenz aus /agent/flur (alle 60 s), eigener Status aus dem Office-Kopf
// (wird per POST /agent/praesenz gemeldet). Der Team-Feed (Space) bleibt
// erreichbar – Ansagen und Erfolge wandern ins Schwarze Brett.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Avatar, AgentShell, api } from "./shared";
import { useOffice } from "./OfficeShell";
import "@/styles/office-flur.css";

const STATUS: Record<string, [string, string]> = { da: ["Da", "#34d399"], telefon: ["Telefoniert", "#60a5fa"], pause: ["Pause", "#fbbf24"], weg: ["Nicht im Büro", "#64748b"] };
const ROLLE: Record<string, string> = { vertriebsleiter: "Teamleitung", onboarding: "Bonitätsmanager", agent: "Bonitätsmanager", inkasso: "Forderungen & Zahlungen" };

export default function AgentFlurPage() { return <AgentShell><FlurInnen /></AgentShell>; }

function FlurInnen() {
  const { dunkel, titel, praesenz } = useOffice();
  useEffect(() => { dunkel(true); titel("Flur"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [leute, setLeute] = useState<any[]>([]);
  const laden = () => api("/agent/flur").then((r) => { if (r.ok) setLeute(r.json.leute || []); });
  useEffect(() => { laden(); const i = setInterval(laden, 60_000); return () => clearInterval(i); }, [praesenz]);
  const da = leute.filter((l) => l.status === "da"), tel = leute.filter((l) => l.status === "telefon"), pause = leute.filter((l) => l.status === "pause"), weg = leute.filter((l) => l.status === "weg");
  const stunde = new Date().getHours();

  return (
    <div className="fl">
      <section className="fl-kopf">
        <div>
          <span className="fl-pille">{stunde < 11 ? "Guten Morgen" : stunde < 18 ? "Guten Tag" : "Guten Abend"} im Büro</span>
          <h1>{da.length + tel.length ? <><span className="fl-verlauf">{da.length + tel.length}</span> {da.length + tel.length === 1 ? "Kollege ist" : "Kollegen sind"} gerade da.</> : <>Gerade ist <span className="fl-verlauf">niemand</span> im Büro.</>}</h1>
          <p>Dein Status steht oben rechts im Kopf – stell ihn auf „Telefoniere“, wenn du nicht gestört werden willst, und auf „Pause“, wenn du kurz weg bist. Wer da ist, bekommt Anrufe vom Empfang.</p>
        </div>
        <Link href="/agent/space" className="fl-feed"><b>Team-Feed öffnen</b><span>Ansagen, Fragen, Erfolge</span></Link>
      </section>

      {[["Am Platz", da], ["Am Telefon", tel], ["In der Pause", pause], ["Nicht im Büro", weg]].map(([t, l]) => (
        <section key={String(t)} className="fl-gruppe">
          <div className="fl-gruppe-kopf"><b>{String(t)}</b><small>{(l as any[]).length}</small></div>
          <div className="fl-raster">
            {(l as any[]).length === 0 && <p className="fl-leer">–</p>}
            {(l as any[]).map((p) => (
              <div key={p.id} className={`fl-karte st-${p.status}`}>
                <div className="fl-avatar"><Avatar src={p.avatar ?? null} name={p.name} size={44} /><i style={{ background: STATUS[p.status]?.[1] }} /></div>
                <b>{p.name}</b>
                <small>{ROLLE[p.rolle] || "Bonitätsmanager"}</small>
                <span>{STATUS[p.status]?.[0]}{p.seit && p.status !== "weg" ? ` · seit ${new Date(p.seit).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" })}` : ""}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
