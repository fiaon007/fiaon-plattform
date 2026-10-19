// ═══════════════════════════════════════════════════════════════════════════
// LAGEZIMMER › „MARA HEUTE“ (E-406 B3, 19.10.2026)
//
// Justin, Vorschlag 3: „Karte ‚Mara heute‘. Sie zeigt nur Auffälliges: was erledigt ist, wie viel Geld reinkam,
// welche Entscheidungen offen sind und wo jemand im Team hängt. Kein langer Bericht.“
// Keine neue Seite — eine Kachel im Lagezimmer, die sich selbst lädt (wie ChefAufgabenLage): GET /chef/mara-heute.
//   · Kopf: wie viel Mara heute selbst erledigt hat; darunter je Art ein Chip (Link in den Raum).
//   · Zeilen: Geld heute (EINE Quelle), offene Entscheidungen, Aufräum-Vorschläge, wo jemand hängt, KI-Kosten.
//   · Gelb: was Mara mit einem gelben Werkzeug getan hat — 24 h mit einem Klick zurück (Stufe Inhaber).
// Regeln: shared/fiaon-mara-ampel.ts · Server: server/lib/fiaon-mara-heute.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Bot, ListChecks, Sparkles, Users, Wallet, Cpu, Undo2 } from "lucide-react";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "@/pages/agent/rundgaenge";
import { akteLink } from "@/lib/akte-link";
import "@/styles/office-rundgang.css";

const API = "/api/fiaon";
const zahl = (n: number) => Number(n || 0).toLocaleString("de-DE");
const eur = (cents: number) => `${(Number(cents || 0) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const uhr = (iso: string) => new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

type Stufe = "gruen" | "gelb" | "rot";
interface Zeile { art: string; n: number; text: string; link: string; werkzeug: string | null }
interface Gelb {
  art: string; id: string; werkzeug: string; am: string; personId: number | null; name: string | null; text: string;
  knoepfe: { art: string; label: string; vorsicht?: boolean }[]; ohne: string | null;
  erledigt: { am: string; von: string | null; ergebnis: string | null } | null;
}
interface Daten {
  stand: string; erledigt: number; zeilen: Zeile[];
  geld: { heuteCents: number; zahlungen: number; nachMaraCents: number; nachMaraZahlungen: number } | null;
  karten: { entscheidungen: number; minuten: number; karten: number; aelterAlsZiel: number; aeltesteTage: number } | null;
  aufraeumen: { art: string; anzahl: number; titel: string }[];
  haengt: { agentId: number; name: string; termineOhneErgebnis: number; aeltesterTermin: string | null; auftraegeUeberfaellig: number; auftraegeOffen: number }[];
  ki: { maraCents: number; alleCents: number; wocheCents: number } | null;
  gelb: Gelb[]; ampel: Record<string, Stufe>; gelbWerkzeuge: string[]; darfRueckgaengig: boolean;
}

export default function ChefMaraHeute() {
  const [d, setD] = useState<Daten | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ text: string; fehler: boolean } | null>(null);
  const start = useRef<(() => void) | null>(null);
  const laden = useCallback(() => {
    fetch(`${API}/chef/mara-heute`, { credentials: "include" }).then((r) => r.json()).then((j) => { if (j?.ok) setD(j); }).catch(() => {});
  }, []);
  useEffect(() => { laden(); }, [laden]);

  const klick = async (g: Gelb, k: { art: string; label: string; vorsicht?: boolean }) => {
    if (k.vorsicht && !window.confirm(`${k.label}?\n\n${g.name ? `${g.name}: ` : ""}${g.text}`)) return;
    setBusy(`${k.art}:${g.id}`);
    try {
      const r = await fetch(`${API}/chef/mara-heute/rueckgaengig`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ art: k.art, id: g.id }) });
      const j = await r.json().catch(() => null);
      setMeldung(j?.ok ? { text: String(j.text), fehler: false } : { text: String(j?.error || "Das ging nicht."), fehler: true });
      laden();
    } finally { setBusy(null); }
  };

  if (!d) return null;
  const punkt = (w: string | null) => (w && d.ampel[w] && d.ampel[w] !== "gruen" ? <span className={`al-ampel ${d.ampel[w]}`} title={d.ampel[w] === "gelb" ? "Ampel gelb" : "Ampel rot"} aria-hidden="true" /> : null);
  const karten = d.karten;

  return (
    <section className="cl-block mh-block" aria-label="Mara heute">
      <Rundgang raum="lagezimmer" titel="Lagezimmer" schritte={RUNDGAENGE.lagezimmer.schritte} knopf="keiner" startRef={start} />
      <div className="cl-block-kopf">
        <h2><Bot size={17} strokeWidth={1.9} /> Mara heute</h2>
        <small>
          <b className="mh-zahl">{zahl(d.erledigt)}</b> selbst erledigt · <a href="/chef/s/mara">Steuerpult</a>
          {" · "}<button type="button" className="mh-link" onClick={() => start.current?.()}>Rundgang</button>
        </small>
      </div>

      {d.zeilen.length > 0 && (
        <div className="mh-chips">
          {d.zeilen.map((z) => (
            <a key={z.art} href={z.link} className="mh-chip" data-art={z.art}><b>{zahl(z.n)}</b> {z.text}{punkt(z.werkzeug)}</a>
          ))}
        </div>
      )}

      <div className="cl-klemmer">
        {d.geld && (
          <a href="/chef/zahlungen" className="cl-klemmzeile mh-geld">
            <i><Wallet size={16} strokeWidth={1.75} /></i>
            <b>{eur(d.geld.heuteCents)}</b>
            <span>Geld heute ({zahl(d.geld.zahlungen)} {d.geld.zahlungen === 1 ? "Zahlung" : "Zahlungen"})</span>
            <em title="Zahlung nach Maras Kontakt (14 Tage) — zeitliche Folge, kein Beweis.">nach Maras Kontakt: {eur(d.geld.nachMaraCents)}</em>
            <ArrowRight size={15} strokeWidth={1.75} className="pfeil" />
          </a>
        )}
        {karten && karten.karten > 0 && (
          <a href="/chef/s/mara?reiter=entscheidungen" className="cl-klemmzeile">
            <i><ListChecks size={16} strokeWidth={1.75} /></i>
            <b>{zahl(karten.entscheidungen)}</b>
            <span>{karten.entscheidungen === 1 ? "Entscheidung" : "Entscheidungen"} offen, etwa {zahl(karten.minuten)} Min.</span>
            <em className={karten.aelterAlsZiel ? "al-warn" : undefined}>{karten.aelterAlsZiel ? `${zahl(karten.aelterAlsZiel)} älter als 2 Tage` : "keine älter als 2 Tage"}</em>
            <ArrowRight size={15} strokeWidth={1.75} className="pfeil" />
          </a>
        )}
        {d.aufraeumen.map((a) => (
          <a key={a.art} href="/chef/s/mara?reiter=entscheidungen" className="cl-klemmzeile mh-aufraeumen">
            <i><Sparkles size={16} strokeWidth={1.75} /></i>
            <b>{zahl(a.anzahl)}</b>
            <span>{a.titel}</span>
            <em>Maras Vorschlag</em>
            <ArrowRight size={15} strokeWidth={1.75} className="pfeil" />
          </a>
        ))}
        {d.haengt.map((h) => (
          <a key={h.agentId} href={`/chef/s/team?agent=${h.agentId}`} className="cl-klemmzeile mh-haengt">
            <i><Users size={16} strokeWidth={1.75} /></i>
            <b>{zahl(h.termineOhneErgebnis || h.auftraegeUeberfaellig)}</b>
            <span>{h.name}: {[
              h.termineOhneErgebnis ? `${zahl(h.termineOhneErgebnis)} ${h.termineOhneErgebnis === 1 ? "Termin" : "Termine"} ohne Ergebnis` : null,
              h.auftraegeUeberfaellig ? `${zahl(h.auftraegeUeberfaellig)} Aufträge überfällig` : null,
            ].filter(Boolean).join(" · ")}</span>
            <em>{h.aeltesterTermin ? `seit ${uhr(h.aeltesterTermin)}` : "hängt"}</em>
            <ArrowRight size={15} strokeWidth={1.75} className="pfeil" />
          </a>
        ))}
        {d.ki && (
          <a href="/chef/s/mara" className="cl-klemmzeile mh-ki">
            <i><Cpu size={16} strokeWidth={1.75} /></i>
            <b>{eur(d.ki.maraCents)}</b>
            <span>KI heute für Mara · alle Dienste {eur(d.ki.alleCents)}</span>
            <em>7 Tage: {eur(d.ki.wocheCents)}</em>
            <ArrowRight size={15} strokeWidth={1.75} className="pfeil" />
          </a>
        )}
      </div>

      {d.gelb.length > 0 && (
        <div className="mh-gelb">
          <h3><span className="al-ampel gelb" aria-hidden="true" /> Gelb — 24 h mit einem Klick zurück</h3>
          <ul>
            {d.gelb.map((g) => {
              const akte = g.personId ? akteLink(g.personId, "chef") : null;
              return (
                <li key={`${g.art}:${g.id}`} className={g.erledigt ? "fertig" : undefined}>
                  <span className="mh-wann">{uhr(g.am)}</span>
                  <span className="mh-was">
                    {akte ? <a href={akte} target="_blank" rel="noreferrer">{g.name || `Person ${g.personId}`}</a> : <b>{g.name || "—"}</b>}
                    {" "}{g.text}
                  </span>
                  <span className="mh-tun">
                    {g.erledigt ? <em><Undo2 size={13} /> {g.erledigt.ergebnis || "erledigt"}{g.erledigt.von ? ` · ${g.erledigt.von}` : ""}</em>
                      : g.knoepfe.length && d.darfRueckgaengig ? g.knoepfe.map((k) => (
                        <button key={k.art} type="button" className={`mh-knopf${k.vorsicht ? " vorsicht" : ""}`} disabled={!!busy}
                          onClick={() => void klick(g, k)}>{busy === `${k.art}:${g.id}` ? "…" : k.label}</button>
                      ))
                        : <em>{g.knoepfe.length ? "Nur Stufe Inhaber" : g.ohne || "nicht rückgängig"}</em>}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {meldung && <p className={`al-meldung${meldung.fehler ? " al-warn" : ""}`} role="status">{meldung.text}</p>}
      <style>{`
        .mh-block .cl-block-kopf h2 { display: flex; align-items: center; gap: 10px; }
        .mh-block .al-ampel { display: inline-block; width: 9px; height: 9px; border-radius: 6px; background: #34d399; vertical-align: middle; }
        .mh-block .al-ampel.gelb { background: #fbbf24; box-shadow: 0 0 10px rgba(251,191,36,.7); }
        .mh-block .al-ampel.rot { background: #f87171; box-shadow: 0 0 10px rgba(248,113,113,.8); }
        .mh-block .al-warn { color: #fcd34d; }
        /* Die Nebeninfo ist hier meist keine Störung (der Lagezimmer-Stil „klemmt“ färbt sie rot): ruhig, nur Warnungen gelb. */
        .mh-block .cl-klemmzeile em { color: #94a3b8; white-space: nowrap; }
        .mh-block .cl-klemmzeile em.al-warn { color: #fcd34d; }
        .mh-block .cl-klemmzeile b { white-space: nowrap; }
        @media (max-width: 640px) {
          .mh-block .cl-klemmzeile { flex-wrap: wrap; }
          .mh-block .cl-klemmzeile span { flex: 1 1 calc(100% - 120px); }
          .mh-block .cl-klemmzeile em { order: 5; flex: 1 0 100%; padding-left: 27px; white-space: normal; }
        }
        .mh-zahl { font-variant-numeric: tabular-nums; }
        .mh-link { background: none; border: 0; padding: 0; color: inherit; text-decoration: underline; cursor: pointer; font: inherit; }
        .mh-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 2px 0 12px; }
        .mh-chip { display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; padding: 4px 10px; border-radius: 999px;
          border: 1px solid rgba(255,255,255,.16); text-decoration: none; color: inherit; white-space: nowrap; }
        .mh-chip b { font-variant-numeric: tabular-nums; }
        .mh-chip:hover { border-color: rgba(125,184,255,.55); }
        .mh-gelb { margin-top: 16px; }
        .mh-gelb h3 { font: 600 13px/1.3 'Inter', sans-serif; margin: 0 0 8px; opacity: .85; display: flex; gap: 8px; align-items: center; }
        .mh-gelb ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
        .mh-gelb li { display: grid; grid-template-columns: 92px 1fr auto; gap: 10px; align-items: baseline; font-size: 12.5px; }
        .mh-gelb li.fertig { opacity: .6; }
        .mh-wann { opacity: .6; font-variant-numeric: tabular-nums; }
        .mh-was a { color: inherit; }
        .mh-tun { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
        .mh-tun em { font-style: normal; opacity: .7; display: inline-flex; gap: 4px; align-items: center; }
        .mh-knopf { font-size: 11.5px; padding: 3px 10px; border-radius: 999px; border: 1px solid rgba(255,255,255,.25); background: transparent; color: inherit; cursor: pointer; }
        .mh-knopf.vorsicht { border-color: rgba(251,191,36,.55); color: #fcd34d; }
        .mh-knopf:disabled { opacity: .5; cursor: wait; }
        @media (max-width: 640px) { .mh-gelb li { grid-template-columns: 1fr; gap: 2px; } .mh-tun { justify-content: flex-start; } }
      `}</style>
    </section>
  );
}
