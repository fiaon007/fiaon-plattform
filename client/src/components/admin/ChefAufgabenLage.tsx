// ═══════════════════════════════════════════════════════════════════════════
// LAGEZIMMER › AUFGABEN, AMPEL, KARTEN, HAUSPUTZ (E-397, 19.10.2026)
//
// Keine neue Chefbüro-Seite (Gedächtnis: keine-neuen-chef-seiten) — eine Kachel im
// Lagezimmer, die sich selbst lädt (wie PostmeisterKlein): GET /chef/aufgaben-lage.
//   · Ampel: System-Alarme (eine Zeile je Alarm, geht von selbst aus) und
//     Termintreue — statt 377 Meldungen als Aufträge in „Meine Liste“.
//   · „Heute N Entscheidungen, etwa M Minuten“ — Maras Karten, gebündelt.
//   · „heikel neu“ → Meine Liste mit Filter „heikel“ (statt Kopien „Zur Kenntnis“).
//   · Woche für Woche: neu gegen erledigt — Ziel: erledigt ≥ neu.
//   · Hausputz: Zahlen je Regel; Zurückholen 30 Tage (Stufe Inhaber).
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, ListChecks, ShieldAlert, Sparkles } from "lucide-react";

const API = "/api/fiaon";
const zahl = (n: number) => Number(n || 0).toLocaleString("de-DE");
const wann = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
const tag = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });

interface Alarm { schluessel: string; quelle: string; titel: string; text: string | null; stufe: "rot" | "gelb"; link: string | null; seit: string; zuletzt: string; anzahl: number; episoden: number; vorbeiAm: string | null; vorbeiGrund: string | null }
interface Treue { agentId: number; name: string; verpasst7: number; verspaetet7: number; verpasst30: number; stufe: "gruen" | "gelb" | "rot" }
interface Lage {
  ampel: { farbe: "gruen" | "gelb" | "rot"; alarme: Alarm[]; termintreue: { verpasst7: number; verspaetet7: number; jeMitarbeiter: Treue[] } };
  karten: { entscheidungen: number; minuten: number; karten: number; sammelkarten: number; aelterAlsZiel: number; aeltesteTage: number } | null;
  offen: { gesamt: number; auftraege: number; vermerke: number; beiJustin: number; jungProzent: number; dringendProzent: number; heikelNeu24h: number; heikelOffen: number };
  woche: { ab: string; neu: number; mensch: number; system: number; hausputz: number }[];
  hausputz: {
    probelauf: { id: number; am: string; zahlen: { vorher: any; nachher: any; jeRegel: { regel: string; label: string; summe: number; beiJustin: number }[] } } | null;
    lauf: { id: number; am: string; fertigAm: string | null; zahlen: any; fehler: string | null; zurueckBis: string | null } | null;
    freigabe: string | null;
  } | null;
}

export default function ChefAufgabenLage() {
  const [l, setL] = useState<Lage | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const laden = useCallback(() => {
    fetch(`${API}/chef/aufgaben-lage`, { credentials: "include" }).then((r) => r.json()).then((j) => { if (j?.ok) setL(j); }).catch(() => {});
  }, []);
  useEffect(() => { laden(); }, [laden]);

  const zurueck = async (laufId: number, regel: string, label: string) => {
    if (!window.confirm(`„${label}“ zurückholen? Alles, was der Hausputz mit dieser Regel geschlossen hat, ist dann wieder offen.`)) return;
    setBusy(regel);
    try {
      const r = await fetch(`${API}/chef/hausputz/zurueck`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ laufId, regel }) });
      const j = await r.json().catch(() => null);
      setMeldung(j?.ok ? `${zahl(j.zurueck)} wieder offen.` : (j?.error || "Das ging nicht."));
      laden();
    } finally { setBusy(null); }
  };

  if (!l) return null;
  const aktiv = l.ampel.alarme.filter((a) => !a.vorbeiAm);
  const vorbei = l.ampel.alarme.filter((a) => a.vorbeiAm);
  const treue = l.ampel.termintreue.jeMitarbeiter.filter((m) => m.stufe !== "gruen");
  const hp = l.hausputz;
  const probe = hp?.probelauf?.zahlen ?? null;
  const lauf = hp?.lauf ?? null;
  const woche = l.woche.slice(0, 4);

  return (
    <section className="cl-block al-block" aria-label="Aufgaben und Ampel">
      <div className="cl-block-kopf">
        <h2><span className={`al-ampel ${l.ampel.farbe}`} aria-hidden="true" /> Aufgaben &amp; Ampel</h2>
        <small>Meldungen sind keine Aufgaben mehr — sie stehen hier und gehen von selbst aus.</small>
      </div>

      <div className="cl-klemmer">
        {l.karten && (
          <a href="/chef/s/mara?reiter=entscheidungen" className="cl-klemmzeile">
            <i><ListChecks size={16} strokeWidth={1.75} /></i>
            <b>{zahl(l.karten.entscheidungen)}</b>
            <span>{l.karten.entscheidungen === 1 ? "Entscheidung" : "Entscheidungen"} heute, etwa {zahl(l.karten.minuten)} {l.karten.minuten === 1 ? "Minute" : "Minuten"}{l.karten.sammelkarten ? ` · ${zahl(l.karten.sammelkarten)} Sammelkarten` : ""}</span>
            <em className={l.karten.aelterAlsZiel ? "al-warn" : undefined}>{l.karten.aelterAlsZiel ? `${zahl(l.karten.aelterAlsZiel)} älter als 2 Tage` : "keine älter als 2 Tage"}</em>
            <ArrowRight size={15} strokeWidth={1.75} className="pfeil" />
          </a>
        )}
        <a href="/chef/s/todo?filter=heikel" className="cl-klemmzeile">
          <i><ShieldAlert size={16} strokeWidth={1.75} /></i>
          <b>{zahl(l.offen.heikelNeu24h)}</b>
          <span>heikel neu (24 h) — Kündigung, Widerruf, Beschwerde, Geld</span>
          <em>{zahl(l.offen.heikelOffen)} heikel offen</em>
          <ArrowRight size={15} strokeWidth={1.75} className="pfeil" />
        </a>
        <a href="/chef/s/todo" className="cl-klemmzeile">
          <i><Sparkles size={16} strokeWidth={1.75} /></i>
          <b>{zahl(l.offen.gesamt)}</b>
          <span>Aufgaben offen ({zahl(l.offen.auftraege)} Aufträge, {zahl(l.offen.vermerke)} „Zu tun“) · bei dir {zahl(l.offen.beiJustin)}</span>
          <em>{l.offen.jungProzent.toLocaleString("de-DE")} % jünger als 7 Tage · {l.offen.dringendProzent.toLocaleString("de-DE")} % dringend</em>
          <ArrowRight size={15} strokeWidth={1.75} className="pfeil" />
        </a>
        {aktiv.map((a) => (
          <a key={a.schluessel} href={a.link || "/chef/s/hub"} className="cl-klemmzeile" title={a.text || undefined}>
            <i><span className={`al-ampel ${a.stufe}`} aria-hidden="true" /></i>
            <b>{a.anzahl > 1 ? `${zahl(a.anzahl)}×` : "!"}</b>
            <span>{a.titel}</span>
            <em>seit {wann(a.seit)}</em>
            <ArrowRight size={15} strokeWidth={1.75} className="pfeil" />
          </a>
        ))}
        {treue.map((m) => (
          <a key={m.agentId} href={`/chef/s/team?agent=${m.agentId}`} className="cl-klemmzeile">
            <i><span className={`al-ampel ${m.stufe}`} aria-hidden="true" /></i>
            <b>{zahl(m.verpasst7)}</b>
            <span>Termintreue {m.name}: verpasst in 7 Tagen{m.verspaetet7 ? ` · ${zahl(m.verspaetet7)} verspätet` : ""}</span>
            <em>{zahl(m.verpasst30)} verpasst in 30 Tagen{m.stufe === "rot" ? " · Abmahnung prüfen (E-044)" : ""}</em>
            <ArrowRight size={15} strokeWidth={1.75} className="pfeil" />
          </a>
        ))}
        {!aktiv.length && !treue.length && (
          <p className="al-ruhig"><CheckCircle2 size={15} strokeWidth={1.75} /> Ampel grün: kein System-Alarm offen, Termintreue in Ordnung.</p>
        )}
        {vorbei.length > 0 && (
          <p className="al-vorbei">Heute ausgegangen: {vorbei.map((a) => `${a.titel} (${a.vorbeiGrund || "wieder gut"})`).join(" · ")}</p>
        )}
      </div>

      {woche.length > 0 && (
        <div className="al-woche">
          <h3>Neu gegen erledigt — je Woche</h3>
          <div className="cl-tab-huelle"><table className="cl-tab">
            <thead><tr><th>Woche ab</th><th className="r">neu</th><th className="r">erledigt Mensch</th><th className="r">erledigt System</th><th className="r">Hausputz</th><th>Ziel</th></tr></thead>
            <tbody>
              {woche.map((w) => {
                const erledigt = w.mensch + w.system;
                return (
                  <tr key={w.ab}>
                    <td>{tag(w.ab)}</td><td className="r">{zahl(w.neu)}</td><td className="r">{zahl(w.mensch)}</td><td className="r">{zahl(w.system)}</td>
                    <td className="r">{w.hausputz ? zahl(w.hausputz) : "—"}</td>
                    <td className={erledigt >= w.neu ? "al-gut" : "al-warn"}>{erledigt >= w.neu ? "erledigt ≥ neu" : `${zahl(w.neu - erledigt)} mehr neu als erledigt`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        </div>
      )}

      {hp && (probe || lauf) && (
        <div className="al-hausputz">
          <h3>Großer Hausputz</h3>
          {lauf ? (
            <p>
              Lauf vom {wann(lauf.am)}: {lauf.zahlen ? `${zahl(lauf.zahlen.erledigt)} geändert, jetzt ${zahl(lauf.zahlen.nachher?.gesamt)} offen` : lauf.fehler ? `abgebrochen (${lauf.fehler})` : "läuft …"}
              {lauf.zurueckBis ? ` · zurückholbar bis ${wann(lauf.zurueckBis)}` : ""}
            </p>
          ) : probe ? (
            <p>Probelauf vom {wann(hp.probelauf!.am)} (zählt nur, ändert nichts): <b>{zahl(probe.vorher.gesamt)} → {zahl(probe.nachher.gesamt)}</b> offene Aufgaben, bei dir {zahl(probe.vorher.beiJustin)} → {zahl(probe.nachher.beiJustin)}. Der Lauf startet erst nach deinem „go“ im Chat.</p>
          ) : null}
          {probe && (
            <details className="al-regeln">
              <summary>{lauf ? "Je Regel — zurückholen" : "Je Regel"}</summary>
              <ul>
                {(lauf?.zahlen?.jeRegel ? Object.entries(lauf.zahlen.jeRegel as Record<string, { geplant: number; erledigt: number }>).map(([regel, z]) => ({ regel, label: probe.jeRegel.find((r) => r.regel === regel)?.label ?? regel, summe: z.erledigt, beiJustin: 0 })) : probe.jeRegel).map((r) => (
                  <li key={r.regel}>
                    <b>{zahl(r.summe)}</b> <span>{r.label}</span>
                    {lauf && <button type="button" className="al-zurueck" disabled={!!busy} onClick={() => void zurueck(lauf.id, r.regel, r.label)}>{busy === r.regel ? "…" : "Zurückholen"}</button>}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {meldung && <p className="al-meldung" role="status"><AlertTriangle size={13} /> {meldung}</p>}
        </div>
      )}
      <style>{`
        .al-ampel { display: inline-block; width: 10px; height: 10px; border-radius: 6px; background: #34d399; box-shadow: 0 0 12px rgba(52,211,153,.8); vertical-align: middle; }
        .al-ampel.gelb { background: #fbbf24; box-shadow: 0 0 12px rgba(251,191,36,.8); }
        .al-ampel.rot { background: #f87171; box-shadow: 0 0 12px rgba(248,113,113,.9); }
        .al-block .cl-block-kopf h2 { display: flex; align-items: center; gap: 10px; }
        .al-warn { color: #fcd34d; }
        .al-gut { color: #6ee7b7; }
        .al-ruhig, .al-vorbei, .al-meldung { margin: 6px 2px 0; font-size: 12.5px; opacity: .75; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
        .al-woche, .al-hausputz { margin-top: 18px; }
        .al-woche h3, .al-hausputz h3 { font: 600 13px/1.3 'Inter', sans-serif; margin: 0 0 8px; opacity: .85; }
        .al-hausputz p { font-size: 13px; line-height: 1.5; margin: 0 0 6px; }
        .al-regeln summary { cursor: pointer; font-size: 12.5px; opacity: .8; }
        .al-regeln ul { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 4px; }
        .al-regeln li { display: flex; gap: 10px; align-items: baseline; font-size: 12.5px; }
        .al-regeln li b { min-width: 42px; text-align: right; font-variant-numeric: tabular-nums; }
        .al-zurueck { margin-left: auto; font-size: 11.5px; padding: 3px 9px; border-radius: 999px; border: 1px solid rgba(255,255,255,.25); background: transparent; color: inherit; cursor: pointer; }
      `}</style>
    </section>
  );
}
