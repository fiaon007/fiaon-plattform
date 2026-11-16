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
  jetztFrei, teamFarbe, uhrAusMinuten, TEAM_STANDARD_DAUER,
  type TeamKalenderAntwort, type TeamTermin, type Zerleger,
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
          <button type="button" className="ca-knopf klein still" onClick={onTeamAbo}>Team im Handy-Kalender</button>
        </div>
      </section>

      {ansicht === "tag" && <TeamTag daten={daten} personen={sichtbar} tagKey={tagKey} istHeute={tagKey === heuteKey} jetzt={jetzt} farbe={farbe} onTermin={setBlatt} />}
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
    </>
  );
}

// ── TAG: eine Spalte je Person ──────────────────────────────────────────────
function TeamTag({ daten, personen, tagKey, istHeute, jetzt, farbe, onTermin }: {
  daten: TeamKalenderAntwort; personen: TeamKalenderAntwort["personen"]; tagKey: string; istHeute: boolean; jetzt: Date;
  farbe: Map<number, string>; onTermin: (t: TeamTermin) => void;
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
              <div className="tk-spalte" style={{ height: hoehe }}>
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
