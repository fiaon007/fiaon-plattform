// ═══════════════════════════════════════════════════════════════════════════
// /agent/kalender → „Team" — DER TEAMKALENDER (E-516, 16.11.2026)
//
// Florentine (16.11.): „ein übergreifender Kalender für das gesamte Team …
// wann Florentine, Dani oder Justin Termine haben, mit welchem Kunden und zu
// welcher Uhrzeit … wer gerade Kapazitäten hat … Doppelbuchungen vermeiden."
// Justin (16.11.): alle aktiven Mitarbeiter sehen alles mit Namen;
// „Übernehmen" geht still (keine Mail an den Kunden, Kunde bleibt beim Betreuer).
//
// Aufbau:
//   · „Jetzt": je Person ein Chip — frei bis …, im Termin bis …, geblockt,
//     nicht im Dienst. Ein Klick blendet die Person aus/ein.
//   · Tag: eine Spalte je Person (Zeitraster aus Arbeitszeiten + Terminen),
//     Arbeitszeit hell, geblockte Zeit schraffiert, Termine als Karten.
//   · Woche: je Person eine Zeile, je Tag die Termine als kurze Chips.
//   · Klick auf einen Termin: Blatt mit Kunde, Art, Zeit — „Öffnen" (Akte bzw.
//     Firmen-Cockpit) und „Übernehmen".
// Daten: GET /agent/calendar/team, POST /agent/termine/:id/uebernehmen
// (server/routes/fiaon-kalender.ts → server/lib/fiaon-teamkalender.ts).
// Regeln „Jetzt frei", Farben, Namen: shared/fiaon-teamkalender.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useLocation } from "wouter";
import { api } from "./shared";
import {
  jetztFrei, teamFarbe, uhrAusMinuten, TEAM_STANDARD_DAUER, KOLLEGEN_ARTEN,
  type TeamKalenderAntwort, type TeamTermin, type Zerleger, type KollegenArt,
} from "@shared/fiaon-teamkalender";
import { ZeichenSchliessen } from "@/lib/fiaon-zeichen";

// ── Berliner Zeit über formatToParts (nie über die Gerätezeit) ─────────────
const TEILER = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false });
const WD: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
const zerlege: Zerleger = (d) => {
  const o = TEILER.formatToParts(d).reduce<Record<string, string>>((a, p) => { a[p.type] = p.value; return a; }, {});
  return { tag: `${o.year}-${o.month}-${o.day}`, min: (Number(o.hour) % 24) * 60 + Number(o.minute), wd: WD[o.weekday] ?? 1 };
};
const ausKey = (key: string) => { const [y, m, d] = key.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d, 12)); };
const plusTage = (key: string, n: number) => { const d = ausKey(key); d.setUTCDate(d.getUTCDate() + n); return zerlege(d).tag; };
const hm = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
const TAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const datumKurz = (key: string) => { const [, m, d] = key.split("-"); return `${d}.${m}.`; };
const zeitText = (iso: string) => uhrAusMinuten(zerlege(new Date(iso)).min);

/** Wohin ein Termin führt — Global ins Firmen-Cockpit, Startgespräch ins Onboarding, sonst die Akte (wie im eigenen Kalender). */
function oeffnenHref(t: TeamTermin): string {
  if (t.quelle === "global") return t.firmaId ? `/agent/firmen?firma=${t.firmaId}` : `/agent/firmen?person=${t.personId}`;
  if (t.quelle === "onboarding_call") return `/agent/onboarding?person=${t.personId}`;
  if (t.quelle === "inkasso_call") return `/agent/collections?person=${t.personId}`;
  return `/agent/kunden?person=${t.personId}`;
}

// Höhe einer Stunde im Tagesraster und Mindesthöhe einer Karte.
const STUNDE_PX = 56;
const MIN_KARTE = 36;

interface Lage { top: number; hoehe: number; links: number; breite: number }
/** Überlappende Termine EINER Person nebeneinander statt übereinander (wie die Wochenansicht des eigenen Kalenders). */
function spaltenLage(liste: TeamTermin[], vonMin: number): Map<number, Lage> {
  const its = liste.map((t) => {
    const top = ((zerlege(new Date(t.beginn)).min - vonMin) / 60) * STUNDE_PX;
    const hoehe = Math.max(MIN_KARTE, ((t.dauerMin || TEAM_STANDARD_DAUER) / 60) * STUNDE_PX);
    return { id: t.id, top, ende: top + hoehe };
  }).sort((a, b) => a.top - b.top || b.ende - a.ende);
  const res = new Map<number, Lage>();
  let gruppe: typeof its = []; let gruppenEnde = -1;
  const fertig = () => {
    const spaltenEnde: number[] = []; const spalte = new Map<number, number>();
    for (const it of gruppe) {
      let s = spaltenEnde.findIndex((e) => e <= it.top + 1);
      if (s === -1) { s = spaltenEnde.length; spaltenEnde.push(0); }
      spaltenEnde[s] = it.ende + 2; spalte.set(it.id, s);
    }
    const n = Math.max(1, spaltenEnde.length);
    for (const it of gruppe) res.set(it.id, { top: it.top, hoehe: it.ende - it.top, links: (spalte.get(it.id)! / n) * 100, breite: 100 / n });
    gruppe = [];
  };
  for (const it of its) {
    if (gruppe.length && it.top >= gruppenEnde) { fertig(); gruppenEnde = -1; }
    gruppe.push(it); gruppenEnde = Math.max(gruppenEnde, it.ende + 2);
  }
  if (gruppe.length) fertig();
  return res;
}

export function TeamKalender({ ansicht, tagKey, heuteKey, wochenKeys, jetzt, onTag, onTeamAbo, onGeaendert, flash }: {
  ansicht: "tag" | "woche";
  tagKey: string;
  heuteKey: string;
  wochenKeys: string[];
  jetzt: Date;
  /** Klick auf einen Tag in der Woche → Tagesansicht dieses Tages. */
  onTag: (key: string) => void;
  onTeamAbo: () => void;
  /** Nach dem Übernehmen: auch die eigene Ansicht („Ich") neu laden — der Termin gehört jetzt mir. */
  onGeaendert?: () => void;
  flash: (text: string, warn?: boolean) => void;
}) {
  const [, navigiere] = useLocation();
  const [daten, setDaten] = useState<TeamKalenderAntwort | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [aus, setAus] = useState<Set<number>>(() => new Set());
  const [blatt, setBlatt] = useState<TeamTermin | null>(null);
  const [busy, setBusy] = useState(false);
  // E-517: „Für Kollegen eintragen" — offen mit vorgewählter Person und (aus dem Klick in die Spalte) Tag und Uhrzeit.
  const [eintragen, setEintragen] = useState<{ agentId: number | null; tag: string | null; min: number | null } | null>(null);

  // Fenster: die gezeigte Woche (bzw. der Tag) mit einem Tag Luft auf jeder Seite.
  const [vonKey, bisKey] = ansicht === "woche" ? [wochenKeys[0], wochenKeys[6]] : [tagKey, tagKey];
  const laden = useCallback(() => {
    const von = new Date(ausKey(plusTage(vonKey, -1)).getTime() - 12 * 3600e3);
    const bis = new Date(ausKey(plusTage(bisKey, 1)).getTime() + 12 * 3600e3);
    api(`/agent/calendar/team?from=${encodeURIComponent(von.toISOString())}&to=${encodeURIComponent(bis.toISOString())}`)
      .then((r) => { if (r.ok) { setDaten(r.json as TeamKalenderAntwort); setFehler(null); } else setFehler(r.json?.error || "Der Teamkalender konnte nicht geladen werden."); })
      .catch(() => setFehler("Keine Verbindung."));
  }, [vonKey, bisKey]);
  useEffect(() => { laden(); }, [laden]);
  // Alle zwei Minuten frisch — wer gerade frei ist, ändert sich.
  useEffect(() => { const i = setInterval(laden, 120_000); return () => clearInterval(i); }, [laden]);

  const farbe = useMemo(() => {
    const m = new Map<number, string>();
    (daten?.personen ?? []).forEach((p, i) => m.set(p.id, teamFarbe(i)));
    return m;
  }, [daten]);
  const frei = useMemo(() => (daten ? jetztFrei(daten, jetzt, zerlege) : []), [daten, jetzt]);
  const sichtbar = useMemo(() => (daten?.personen ?? []).filter((p) => !aus.has(p.id)), [daten, aus]);
  const umschalten = (id: number) => setAus((v) => { const n = new Set(v); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const uebernehmen = async (t: TeamTermin) => {
    const bei = daten?.personen.find((p) => p.id === t.agentId)?.vorname ?? "Kollegen";
    if (!window.confirm(`Termin um ${zeitText(t.beginn)} Uhr mit ${t.kunde} von ${bei} übernehmen?\n\n`
      + "Der Kunde bekommt KEINE Mail, die Uhrzeit bleibt. Der Kunde bleibt bei seinem Betreuer — nur das Gespräch führst du.")) return;
    setBusy(true);
    const r = await api(`/agent/termine/${t.id}/uebernehmen`, { method: "POST" }).catch(() => ({ ok: false, json: null as any }));
    setBusy(false);
    if (r.ok) { flash(r.json?.hinweis || "Übernommen."); setBlatt(null); laden(); onGeaendert?.(); }
    else flash(r.json?.error || "Das Übernehmen hat nicht geklappt.", true);
  };

  if (fehler) return <p className="ca-fehler">{fehler} <button type="button" className="ca-knopf klein still" onClick={laden}>Nochmal</button></p>;
  if (!daten) return <p className="ca-lade">Lade den Teamkalender …</p>;

  const terminVon = (id: number) => daten.termine.filter((t) => t.agentId === id);

  return (
    <>
      {/* ── JETZT: wer ist frei? Ein Klick blendet die Person aus oder ein. ── */}
      <section className="ca-block tk-jetzt" aria-label="Wer ist gerade frei">
        <div className="ca-block-kopf">
          <b>Team · jetzt</b>
          <small>{uhrAusMinuten(zerlege(jetzt).min)} Uhr · Tippe auf eine Person, um sie aus- oder einzublenden.</small>
        </div>
        <div className="tk-chips">
          {daten.personen.map((p) => {
            const f = frei.find((x) => x.agentId === p.id);
            return (
              <button key={p.id} type="button" className={`tk-chip ${f?.zustand ?? ""}${aus.has(p.id) ? " aus" : ""}`}
                      aria-pressed={!aus.has(p.id)} onClick={() => umschalten(p.id)}
                      style={{ "--tk-farbe": farbe.get(p.id) } as CSSProperties}
                      title={p.anwesend ? "gerade im Office" : undefined}>
                <i aria-hidden="true" />
                <b>{p.ich ? `${p.vorname} (du)` : p.vorname}{p.anwesend && <em className="tk-online" aria-label="gerade im Office" />}</b>
                <span>{f?.text ?? ""}</span>
              </button>
            );
          })}
        </div>
        <div className="tk-fuss">
          <span className="tk-legende"><i className="dienst" /> Arbeitszeit <i className="belegt" /> geblockt <i className="vertretung" /> übernommen</span>
          <span className="tk-fuss-knoepfe">
            <button type="button" className="ca-knopf klein tk-eintragen-knopf" onClick={() => setEintragen({ agentId: null, tag: ansicht === "tag" ? tagKey : null, min: null })}>Termin für Kollegen eintragen</button>
            <button type="button" className="ca-knopf klein still" onClick={onTeamAbo}>Team im Handy-Kalender</button>
          </span>
        </div>
      </section>

      {ansicht === "tag" && <TeamTag daten={daten} personen={sichtbar} tagKey={tagKey} istHeute={tagKey === heuteKey} jetzt={jetzt} farbe={farbe} onTermin={setBlatt}
                                      onFrei={(agentId, min) => setEintragen({ agentId, tag: tagKey, min })} />}
      {ansicht === "woche" && (
        <section className="ca-block tk-woche-block" aria-label="Team-Woche">
          <div className="tk-woche" style={{ "--tk-spalten": wochenKeys.length } as CSSProperties}>
            <div className="tk-w-ecke" />
            {wochenKeys.map((k, i) => (
              <button key={k} type="button" className={`tk-w-kopf${k === heuteKey ? " heute" : ""}`} onClick={() => onTag(k)} title="Tag öffnen">
                <b>{k === heuteKey ? "Heute" : TAGE[i]}</b><small>{datumKurz(k)}</small>
              </button>
            ))}
            {sichtbar.map((p) => (
              <WochenZeile key={p.id} name={p.ich ? `${p.vorname} (du)` : p.vorname} farbe={farbe.get(p.id) ?? "#5aa9ff"}
                           termine={terminVon(p.id)} wochenKeys={wochenKeys} heuteKey={heuteKey} onTermin={setBlatt} />
            ))}
          </div>
          {!sichtbar.length && <p className="ca-leer">Alle ausgeblendet — tippe oben auf eine Person.</p>}
        </section>
      )}

      {blatt && (
        <TerminBlatt t={blatt} bei={daten.personen.find((p) => p.id === blatt.agentId)?.vorname ?? "—"}
                     ich={daten.personen.find((p) => p.ich)?.id ?? 0} farbe={farbe.get(blatt.agentId) ?? "#5aa9ff"} busy={busy}
                     onZu={() => setBlatt(null)} onOeffnen={() => navigiere(oeffnenHref(blatt))} onUebernehmen={() => void uebernehmen(blatt)} />
      )}

      {eintragen && (
        <KollegenTermin personen={daten.personen} farbe={farbe} start={eintragen} onZu={() => setEintragen(null)}
                        onFertig={(hinweis) => { setEintragen(null); flash(hinweis); laden(); onGeaendert?.(); }} />
      )}
    </>
  );
}

// ── TAG: eine Spalte je Person ──────────────────────────────────────────────
function TeamTag({ daten, personen, tagKey, istHeute, jetzt, farbe, onTermin, onFrei }: {
  daten: TeamKalenderAntwort; personen: TeamKalenderAntwort["personen"]; tagKey: string; istHeute: boolean; jetzt: Date;
  farbe: Map<number, string>; onTermin: (t: TeamTermin) => void;
  /** E-517: Klick auf eine freie Stelle der Spalte → „Für Kollegen eintragen" mit Person und Uhrzeit (auf 15 Minuten abgerundet). */
  onFrei: (agentId: number, min: number) => void;
}) {
  const wd = zerlege(ausKey(tagKey)).wd;
  const amTag = useMemo(() => daten.termine.filter((t) => zerlege(new Date(t.beginn)).tag === tagKey), [daten, tagKey]);
  // Das Fenster: Arbeitszeiten der sichtbaren Personen an diesem Wochentag + alle Termine, eine Stunde Luft, mindestens 8 Stunden.
  const [vonStd, bisStd] = useMemo(() => {
    const ids = new Set(personen.map((p) => p.id));
    const werte: number[] = [];
    for (const d of daten.dienst) if (ids.has(d.agentId) && d.wochentag === wd) { werte.push(hm(d.von), hm(d.bis)); }
    for (const t of amTag) if (ids.has(t.agentId)) { const m = zerlege(new Date(t.beginn)).min; werte.push(m, m + (t.dauerMin || TEAM_STANDARD_DAUER)); }
    if (!werte.length) return [8, 19];
    let v = Math.max(0, Math.floor(Math.min(...werte) / 60) - 1);
    let b = Math.min(24, Math.ceil(Math.max(...werte) / 60) + 1);
    while (b - v < 8 && b < 24) b++;
    while (b - v < 8 && v > 0) v--;
    return [v, b];
  }, [daten, personen, amTag, wd]);
  const vonMin = vonStd * 60;
  const hoehe = (bisStd - vonStd) * STUNDE_PX;
  const px = (m: number) => Math.max(0, Math.min(hoehe, ((m - vonMin) / 60) * STUNDE_PX));
  const jetztMin = istHeute ? zerlege(jetzt).min : null;
  const rasterRef = useRef<HTMLDivElement | null>(null);

  if (!personen.length) return <section className="ca-block"><p className="ca-leer">Alle ausgeblendet — tippe oben auf eine Person.</p></section>;
  return (
    <section className="ca-block tk-tag-block" aria-label="Team-Tag">
      <div className="tk-tag" ref={rasterRef} style={{ "--tk-spalten": personen.length } as CSSProperties}>
        <div className="tk-zeiten">
          <div className="tk-kopf-leer" />
          <div className="tk-zeitspalte" style={{ height: hoehe }}>
            {Array.from({ length: bisStd - vonStd + 1 }, (_, i) => <span key={i} style={{ top: i * STUNDE_PX }}>{String(vonStd + i).padStart(2, "0")}:00</span>)}
          </div>
        </div>
        {personen.map((p) => {
          const liste = amTag.filter((t) => t.agentId === p.id);
          const lage = spaltenLage(liste, vonMin);
          const dienst = daten.dienst.filter((d) => d.agentId === p.id && d.wochentag === wd);
          const sperren = daten.sperren.filter((s) => s.agentId === p.id).map((s) => {
            const b = zerlege(new Date(s.beginn)); const e = zerlege(new Date(new Date(s.ende).getTime() - 1));
            if (b.tag > tagKey || e.tag < tagKey) return null;
            return { von: b.tag === tagKey ? b.min : 0, bis: e.tag === tagKey ? e.min + 1 : 24 * 60, grund: s.grund };
          }).filter((x): x is { von: number; bis: number; grund: string | null } => !!x);
          const offen = liste.filter((t) => !t.abgesagt).length;
          return (
            <div key={p.id} className="tk-spalte-wrap" style={{ "--tk-farbe": farbe.get(p.id) } as CSSProperties}>
              <div className="tk-person"><i aria-hidden="true" /><b>{p.ich ? `${p.vorname} (du)` : p.vorname}</b><small>{offen ? `${offen} ${offen === 1 ? "Termin" : "Termine"}` : "frei"}</small></div>
              <div className="tk-spalte" style={{ height: hoehe }} title={`Auf eine freie Stelle klicken: Termin für ${p.ich ? "dich" : p.vorname} eintragen`}
                   onClick={(e) => {
                     if ((e.target as HTMLElement).closest(".tk-termin")) return;
                     const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
                     onFrei(p.id, Math.max(0, Math.floor((vonMin + (y / STUNDE_PX) * 60) / 15) * 15));
                   }}>
                {Array.from({ length: bisStd - vonStd }, (_, i) => <div key={i} className="tk-linie" style={{ top: (i + 1) * STUNDE_PX }} />)}
                {dienst.map((d, i) => <div key={`d${i}`} className="tk-dienst" style={{ top: px(hm(d.von)), height: px(hm(d.bis)) - px(hm(d.von)) }} />)}
                {sperren.map((s, i) => <div key={`s${i}`} className="tk-belegt" style={{ top: px(s.von), height: Math.max(14, px(s.bis) - px(s.von)) }} title={s.grund ?? "geblockt"}><span>{s.grund ?? "belegt"}</span></div>)}
                {jetztMin != null && jetztMin >= vonMin && jetztMin <= bisStd * 60 && <div className="tk-jetzt-linie" style={{ top: px(jetztMin) }} />}
                {liste.map((t) => {
                  const l = lage.get(t.id);
                  if (!l) return null;
                  return (
                    <button key={t.id} type="button" className={`tk-termin${t.abgesagt ? " abgesagt" : ""}${t.vertretung ? " vertretung" : ""}`}
                            style={{ top: l.top, height: l.hoehe, left: `calc(${l.links}% + 3px)`, width: `calc(${l.breite}% - 6px)`, "--ca-ton": t.artTon } as CSSProperties}
                            onClick={() => onTermin(t)} aria-label={`${zeitText(t.beginn)} Uhr ${t.kunde}, ${t.artText}${t.abgesagt ? ", abgesagt" : ""}`}>
                      <b>{zeitText(t.beginn)} · {t.kunde}</b>
                      {l.hoehe >= 48 && <span>{t.firma ? `${t.firma} · ` : ""}{t.artText}{t.abgesagt ? " · abgesagt" : ""}</span>}
                    </button>
                  );
                })}
                {!liste.length && !dienst.length && <div className="tk-leer-spalte">keine Zeiten an diesem Tag</div>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── WOCHE: je Person eine Zeile ─────────────────────────────────────────────
function WochenZeile({ name, farbe, termine, wochenKeys, heuteKey, onTermin }: {
  name: string; farbe: string; termine: TeamTermin[]; wochenKeys: string[]; heuteKey: string; onTermin: (t: TeamTermin) => void;
}) {
  return (
    <>
      <div className="tk-w-name" style={{ "--tk-farbe": farbe } as CSSProperties}><i aria-hidden="true" /><b>{name}</b></div>
      {wochenKeys.map((k) => {
        const liste = termine.filter((t) => zerlege(new Date(t.beginn)).tag === k).sort((a, b) => +new Date(a.beginn) - +new Date(b.beginn));
        return (
          <div key={k} className={`tk-w-zelle${k === heuteKey ? " heute" : ""}`}>
            {liste.slice(0, 5).map((t) => (
              <button key={t.id} type="button" className={`tk-w-chip${t.abgesagt ? " abgesagt" : ""}`} style={{ "--ca-ton": t.artTon } as CSSProperties}
                      onClick={() => onTermin(t)} title={`${zeitText(t.beginn)} ${t.kunde} · ${t.artText}`}>
                <b>{zeitText(t.beginn)}</b> {t.kunde}
              </button>
            ))}
            {liste.length > 5 && <small>+{liste.length - 5} weitere</small>}
          </div>
        );
      })}
    </>
  );
}

// ── DAS BLATT ZUM TERMIN ────────────────────────────────────────────────────
function TerminBlatt({ t, bei, ich, farbe, busy, onZu, onOeffnen, onUebernehmen }: {
  t: TeamTermin; bei: string; ich: number; farbe: string; busy: boolean;
  onZu: () => void; onOeffnen: () => void; onUebernehmen: () => void;
}) {
  useEffect(() => { const f = (e: KeyboardEvent) => { if (e.key === "Escape") onZu(); }; window.addEventListener("keydown", f); return () => window.removeEventListener("keydown", f); }, [onZu]);
  const beginn = new Date(t.beginn);
  const ende = new Date(beginn.getTime() + (t.dauerMin || TEAM_STANDARD_DAUER) * 60_000);
  const vorbei = ende.getTime() < Date.now();
  const darf = t.agentId !== ich && !t.abgesagt && t.status === "gebucht" && !vorbei;
  const z = zerlege(beginn);
  return (
    <div className="ca-dialog-hintergrund" onClick={(e) => { if (e.target === e.currentTarget) onZu(); }} role="dialog" aria-modal="true" aria-labelledby="tk-blatt-titel">
      <div className="ca-dialog tk-blatt" style={{ "--tk-farbe": farbe } as CSSProperties}>
        <div className="ca-dialog-kopf">
          <div>
            <h2 id="tk-blatt-titel">{t.kunde}</h2>
            <small>{[t.firma, t.artText].filter(Boolean).join(" · ")}</small>
          </div>
          <button type="button" className="ca-zu" onClick={onZu} aria-label="Schließen"><ZeichenSchliessen size={18} /></button>
        </div>
        <dl className="tk-fakten">
          <div><dt>Wann</dt><dd>{TAGE[z.wd - 1]} {datumKurz(z.tag)} · {zeitText(t.beginn)}–{zeitText(ende.toISOString())} Uhr</dd></div>
          <div><dt>Bei</dt><dd><i aria-hidden="true" />{t.agentId === ich ? `${bei} (du)` : bei}{t.vertretung ? " · übernommen/vertreten" : ""}</dd></div>
          <div><dt>Gebucht</dt><dd>{t.selbstGebucht ? "vom Kunden selbst" : "von einem Mitarbeiter eingetragen"}</dd></div>
          {t.abgesagt && <div><dt>Stand</dt><dd className="warn">abgesagt</dd></div>}
          {t.status === "verpasst" && <div><dt>Stand</dt><dd className="warn">nicht erschienen — Ergebnis fehlt</dd></div>}
        </dl>
        <div className="ca-form-knoepfe tk-blatt-knoepfe">
          <button type="button" className="ca-knopf" onClick={onOeffnen}>{t.quelle === "global" ? "Im Firmen-Cockpit öffnen" : "Akte öffnen"}</button>
          {darf && <button type="button" className="ca-knopf still" disabled={busy} onClick={onUebernehmen}>{busy ? "Übernimmt …" : "Übernehmen"}</button>}
        </div>
        {darf && <p className="tk-blatt-satz">„Übernehmen“ legt den Termin still zu dir: keine Mail an den Kunden, gleiche Uhrzeit, der Kunde bleibt bei seinem Betreuer.</p>}
        {!darf && t.agentId !== ich && !t.abgesagt && vorbei && <p className="tk-blatt-satz">Der Termin ist vorbei — übernehmen geht nur vorher oder währenddessen.</p>}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// FÜR KOLLEGEN EINTRAGEN (E-517, 16.11.2026)
//
// Für wen → welcher Kunde → welche Art → eine FREIE Zeit der Kollegin (dieselbe
// Rechnung wie jede Buchung; was hier steht, nimmt der Server auch an). Ein
// Global-Kontakt aus dem Firmen-Cockpit bekommt nur das Global-Gespräch (und die
// Bestätigung im Global-Rahmen), alle anderen die bekannten Arten.
// Server: GET /agent/termine/kollegen/kunden · …/frei · POST /agent/termine/kollegen.
// ═══════════════════════════════════════════════════════════════════════════
interface KKunde { personId: number; name: string; firma: string | null; global: boolean; betreuer: string | null }
interface KFrei { tag: string; zeiten: { beginn: string; uhrzeit: string }[] }

function KollegenTermin({ personen, farbe, start, onZu, onFertig }: {
  personen: TeamKalenderAntwort["personen"]; farbe: Map<number, string>;
  start: { agentId: number | null; tag: string | null; min: number | null };
  onZu: () => void; onFertig: (hinweis: string) => void;
}) {
  const [agentId, setAgentId] = useState<number | null>(start.agentId ?? personen.find((p) => !p.ich)?.id ?? personen[0]?.id ?? null);
  const [q, setQ] = useState("");
  const [treffer, setTreffer] = useState<KKunde[]>([]);
  const [sucht, setSucht] = useState(false);
  const [kunde, setKunde] = useState<KKunde | null>(null);
  const [art, setArt] = useState<KollegenArt>("rueckruf");
  const [frei, setFrei] = useState<KFrei[] | null>(null);
  const [tag, setTag] = useState<string | null>(start.tag);
  const [beginn, setBeginn] = useState<string | null>(null);
  const [notiz, setNotiz] = useState("");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const zielMin = useRef<number | null>(start.min);
  useEffect(() => { const f = (e: KeyboardEvent) => { if (e.key === "Escape") onZu(); }; window.addEventListener("keydown", f); return () => window.removeEventListener("keydown", f); }, [onZu]);

  // Kundensuche (je Kollegin — wen ich für SIE eintragen darf)
  useEffect(() => {
    if (!agentId || q.trim().length < 2) { setTreffer([]); return; }
    const t = window.setTimeout(() => {
      setSucht(true);
      api(`/agent/termine/kollegen/kunden?agentId=${agentId}&q=${encodeURIComponent(q.trim())}`)
        .then((r) => { setTreffer(r.ok ? (r.json.kunden || []) : []); setSucht(false); }).catch(() => setSucht(false));
    }, 250);
    return () => window.clearTimeout(t);
  }, [q, agentId]);
  // Ein Global-Kontakt bekommt das Global-Gespräch, alle anderen anfangs den Rückruf.
  useEffect(() => { if (kunde) setArt(kunde.global ? "global" : (art === "global" ? "rueckruf" : art)); }, [kunde]); // eslint-disable-line react-hooks/exhaustive-deps
  // Freie Zeiten der Kollegin für die gewählte Art
  useEffect(() => {
    if (!agentId) return;
    setFrei(null); setBeginn(null);
    api(`/agent/termine/kollegen/frei?agentId=${agentId}&art=${art}`).then((r) => {
      const tage: KFrei[] = r.ok ? (r.json.tage || []) : [];
      setFrei(tage);
      const wunschTag = tage.find((x) => x.tag === tag) ?? tage[0] ?? null;
      setTag(wunschTag?.tag ?? null);
      // Aus dem Klick in die Spalte: die erste freie Zeit ab der geklickten Uhrzeit vorwählen.
      if (wunschTag && zielMin.current != null) {
        const z = wunschTag.zeiten.find((x) => hm(x.uhrzeit) >= zielMin.current!);
        if (z) setBeginn(z.beginn);
        zielMin.current = null;
      }
    }).catch(() => setFrei([]));
  }, [agentId, art]); // eslint-disable-line react-hooks/exhaustive-deps

  const arten = KOLLEGEN_ARTEN.filter((a) => (kunde?.global ? a.art === "global" : a.art !== "global"));
  const person = personen.find((p) => p.id === agentId) ?? null;
  const zeitenAmTag = frei?.find((x) => x.tag === tag)?.zeiten ?? [];
  const kannSpeichern = !!agentId && !!kunde && !!beginn && !busy && (art !== "rueckruf" || notiz.trim().length > 0);

  const speichern = async () => {
    if (!kannSpeichern) return;
    setBusy(true); setFehler(null);
    const r = await api("/agent/termine/kollegen", { method: "POST", body: JSON.stringify({ agentId, personId: kunde!.personId, beginn, art, notiz: notiz.trim() || null }) })
      .catch(() => ({ ok: false, json: null as any }));
    setBusy(false);
    if (r.ok) onFertig(r.json?.hinweis || "Eingetragen.");
    else setFehler(r.json?.error || "Der Termin konnte nicht eingetragen werden.");
  };

  return (
    <div className="ca-dialog-hintergrund" onClick={(e) => { if (e.target === e.currentTarget) onZu(); }} role="dialog" aria-modal="true" aria-labelledby="tk-eintragen-titel">
      <div className="ca-dialog tk-eintragen" style={{ "--tk-farbe": agentId ? farbe.get(agentId) : undefined } as CSSProperties}>
        <div className="ca-dialog-kopf">
          <div>
            <h2 id="tk-eintragen-titel">Termin für {person ? (person.ich ? "dich" : person.vorname) : "…"} eintragen</h2>
            <small>Nur in freien Zeiten — so gibt es keine Doppelbuchung. Der Kunde bekommt eine Bestätigung mit dem Namen der Person; sein Betreuer bleibt derselbe.</small>
          </div>
          <button type="button" className="ca-zu" onClick={onZu} aria-label="Schließen"><ZeichenSchliessen size={18} /></button>
        </div>

        <p className="tk-schritt">1 · Für wen?</p>
        <div className="tk-wahl" role="radiogroup" aria-label="Für wen">
          {personen.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={agentId === p.id} className={agentId === p.id ? "an" : ""}
                    style={{ "--tk-farbe": farbe.get(p.id) } as CSSProperties} onClick={() => { setAgentId(p.id); setKunde(null); setTreffer([]); }}>
              <i aria-hidden="true" />{p.ich ? `${p.vorname} (du)` : p.vorname}
            </button>
          ))}
        </div>

        <p className="tk-schritt">2 · Welcher Kunde?</p>
        {!kunde ? (
          <>
            <input className="ca-feld" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, Firma, E-Mail oder Nummer" aria-label="Kunde suchen" autoFocus />
            {sucht && <p className="tk-leise">Sucht …</p>}
            {!sucht && q.trim().length >= 2 && treffer.length === 0 && <p className="tk-leise">Niemand gefunden. Eintragen lassen sich eigene Kunden, Kunden der Person, Kunden ohne Betreuer und Kontakte aus dem Firmen-Cockpit.</p>}
            <div className="ca-treffer">
              {treffer.map((k) => (
                <button key={k.personId} type="button" onClick={() => setKunde(k)}>
                  <span>{k.name}{k.firma ? ` · ${k.firma}` : ""}</span>
                  <small>{k.global ? "FIAON Global" : k.betreuer ? `betreut von ${k.betreuer}` : "ohne Betreuer"}</small>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="ca-treffer"><button type="button" className="an" onClick={() => setKunde(null)}><span>{kunde.name}{kunde.firma ? ` · ${kunde.firma}` : ""}</span><small>ändern</small></button></div>
        )}

        {kunde && (
          <>
            <p className="tk-schritt">3 · Worum geht es?</p>
            <div className="tk-wahl" role="radiogroup" aria-label="Art des Termins">
              {arten.map((a) => (
                <button key={a.art} type="button" role="radio" aria-checked={art === a.art} className={art === a.art ? "an" : ""} onClick={() => setArt(a.art)}>{a.text}</button>
              ))}
            </div>

            <p className="tk-schritt">4 · Freie Zeit von {person?.ich ? "dir" : person?.vorname}</p>
            {frei === null && <p className="tk-leise">Lade freie Zeiten …</p>}
            {frei !== null && frei.length === 0 && <p className="tk-leise">In den nächsten 7 Tagen ist keine Zeit frei (keine Arbeitszeiten hinterlegt oder alles belegt).</p>}
            {frei !== null && frei.length > 0 && (
              <>
                <div className="tk-tage" role="tablist" aria-label="Tag">
                  {frei.map((t) => {
                    const z = zerlege(ausKey(t.tag));
                    return (
                      <button key={t.tag} type="button" role="tab" aria-selected={tag === t.tag} className={tag === t.tag ? "an" : ""} onClick={() => { setTag(t.tag); setBeginn(null); }}>
                        <b>{TAGE[z.wd - 1]}</b><small>{datumKurz(t.tag)}</small>
                      </button>
                    );
                  })}
                </div>
                <div className="tk-zeiten-wahl" role="radiogroup" aria-label="Uhrzeit">
                  {zeitenAmTag.map((z) => (
                    <button key={z.beginn} type="button" role="radio" aria-checked={beginn === z.beginn} className={beginn === z.beginn ? "an" : ""} onClick={() => setBeginn(z.beginn)}>{z.uhrzeit}</button>
                  ))}
                </div>
              </>
            )}

            <input className="ca-feld" value={notiz} onChange={(e) => setNotiz(e.target.value)}
                   placeholder={art === "rueckruf" ? "Warum der Rückruf? (Pflicht — steht im Termin)" : "Notiz für die Person (freiwillig)"} aria-label="Notiz" />
          </>
        )}

        {fehler && <p className="ca-fehler">{fehler}</p>}
        <div className="ca-form-knoepfe tk-blatt-knoepfe">
          <button type="button" className="ca-knopf" disabled={!kannSpeichern} onClick={() => void speichern()}>{busy ? "Trägt ein …" : "Termin eintragen"}</button>
          <button type="button" className="ca-knopf still" onClick={onZu}>Abbrechen</button>
        </div>
      </div>
    </div>
  );
}
