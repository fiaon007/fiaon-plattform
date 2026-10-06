// ═══════════════════════════════════════════════════════════════════════════
// SOCIAL-STUDIO · PLAN (06.10.2026, E-294)
// /chef/s/mara?reiter=social&sicht=plan
//
// Konzept §2.1: Wochen- und Monatskalender, jede Karte ein Post mit Uhrzeit,
// Format-Zeichen, Titel, Vorschaubild, Status-Punkt und Kanal-Kürzeln. Filter
// nach Kanal, Marke und Status. Oben „Heute zu posten" mit Countdown bis zum
// nächsten Termin und einem Knopf, der den Post öffnet — die EINE Glasfläche
// dieser Ansicht. Die Planprüfung (shared/fiaon-social.ts, planHinweise) warnt
// vor zwei Reels zur selben Zeit, überfälligen Freigaben und Lücken.
// Verschieben: am breiten Schirm per Ziehen auf einen anderen Tag (Uhrzeit
// bleibt), überall im Post-Detail per Datumsfeld.
// Am Handy und bis 1.180 px steht die Woche als Tagesliste untereinander.
// Prüfung 06.10.2026: „Heute zu posten“ rechnet mit heute_posts (unabhängig vom
// geblätterten Zeitraum); „Liegt bei Claude (n)“ zeigt die Rückgaben mit Notiz —
// Claude liest sie in Scheibe 1 nicht selbst; Lücken stehen als Spannen, bei
// aktivem Filter steht „Kein Post passt zum Filter“ statt „nichts geplant“.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState, type DragEvent } from "react";
import { Geruest, Fehlermeldung, useDaten, zahl } from "../chef-teile";
import { useMaraRundgang, useMeldung, Meldung, uhrBerlin } from "../mara-lage";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "@/pages/agent/rundgaenge";
import {
  SOCIAL_API, SOCIAL_KANAELE, SOCIAL_STATUS, SOCIAL_STATUS_INFO, SOCIAL_VERSCHIEBBAR, KANAL_INFO, FORMAT_INFO, planSortierung,
  type SocialPlanAntwort, type SocialPostKarte,
} from "@shared/fiaon-social";
import {
  Kanaele, StatusPunkt, StatusPille, FormatZeichen, sozialAktion, SozialFehler, useZurueckZurKarte, tageZuSpannen,
  tagPlus, wochentag, tagKurz, kalenderwoche, tagWort, groesse, restzeit, planZeitraum, type PlanZustand,
} from "./social-teile";

const RG = () => RUNDGAENGE.socialPlan;
const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

/** Ab 1.181 px sieben Spalten — darunter die Tagesliste (Handy, Tablet, schmale Fenster). */
function useBreit(): boolean {
  const abfrage = "(min-width: 1181px)";
  const [breit, setBreit] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.(abfrage).matches);
  useEffect(() => {
    const m = window.matchMedia?.(abfrage);
    if (!m) return;
    const neu = () => setBreit(m.matches);
    m.addEventListener?.("change", neu);
    return () => m.removeEventListener?.("change", neu);
  }, []);
  return breit;
}

/** Ohne Uhrzeit geplant: „ganztags“ (früher das rätselhafte „Tag“). */
const uhrText = (z: string | null) => z ?? "ganztags";

export default function SocialPlan({ zustand, setZustand, onOeffnen, onGeaendert, zuletzt, onGerollt }: {
  zustand: PlanZustand; setZustand: (f: (z: PlanZustand) => PlanZustand) => void; onOeffnen: (id: number) => void; onGeaendert?: () => void;
  zuletzt?: number | null; onGerollt?: () => void;
}) {
  const rg = useMaraRundgang();
  const { von, bis } = planZeitraum(zustand);
  const d = useDaten<SocialPlanAntwort>(SOCIAL_API.plan(von, bis));
  const breit = useBreit();
  const { meldung, melden, zu } = useMeldung();
  const [jetzt, setJetzt] = useState(() => Date.now());
  const [ziel, setZiel] = useState<string | null>(null);

  // Jede Minute neu laden (nur sichtbarer Tab); der Countdown tickt alle 30 s.
  useEffect(() => {
    const uhr = window.setInterval(() => {
      setJetzt(Date.now());
      if (document.visibilityState === "visible" && Date.now() - geladen.current > 58_000) { geladen.current = Date.now(); d.neu(); }
    }, 30_000);
    return () => window.clearInterval(uhr);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const geladen = useMemoRef(Date.now());

  const daten = d.daten;
  const rundgang = <Rundgang raum="mara-social-plan" titel={RG().titel} schritte={RG().schritte} {...rg} />;
  const f = zustand.filter;
  const posts = useMemo(() => {
    const alle = [...(daten?.posts ?? [])].sort(planSortierung);
    return alle.filter((p) =>
      (!f.kanal || p.kanaele.includes(f.kanal as never))
      && (!f.marke || p.marke === f.marke)
      && (f.status ? p.status === f.status : p.status !== "verworfen"));
  }, [daten, f.kanal, f.marke, f.status]);
  useZurueckZurKarte(zuletzt, !!daten, (id) => `[data-so-post="${id}"]`, onGerollt);

  if (d.fehler && !daten) return <div>{rundgang}<Fehlermeldung text={d.fehler} erneut={d.neu} /></div>;
  if (!daten) return <div>{rundgang}<Geruest zeilen={8} /></div>;

  const heute = daten.heute;
  const setze = (teil: Partial<PlanZustand>) => setZustand((z) => ({ ...z, ...teil }));
  const setzeFilter = (teil: Partial<PlanZustand["filter"]>) => setZustand((z) => ({ ...z, filter: { ...z.filter, ...teil } }));
  const schritt = (n: number) => setze({ anker: zustand.ansicht === "monat" ? verschiebeMonat(zustand.anker, n) : tagPlus(zustand.anker, 7 * n) });
  const tage: string[] = [];
  for (let t = von; t <= bis; t = tagPlus(t, 1)) tage.push(t);
  const jeTag = (t: string) => posts.filter((p) => p.plan_datum === t);
  const istAktuell = von <= heute && heute <= bis;

  // ── Verschieben per Ziehen (nur Maus, nur am breiten Schirm) ───────────
  const ziehen = (e: DragEvent, p: SocialPostKarte) => {
    e.dataTransfer.setData("text/plain", String(p.id));
    e.dataTransfer.effectAllowed = "move";
  };
  const ablegen = async (e: DragEvent, tag: string) => {
    e.preventDefault();
    setZiel(null);
    const id = Number(e.dataTransfer.getData("text/plain"));
    const p = (daten.posts ?? []).find((x) => x.id === id);
    if (!p || p.plan_datum === tag) return;
    try {
      await sozialAktion(p.id, "verschieben", { version: p.version, datum: tag, zeit: p.plan_zeit });
      melden(`„${p.titel}“ steht jetzt am ${wochentag(tag)} ${tagKurz(tag)}${p.plan_zeit ? `, ${p.plan_zeit} Uhr` : ""}.`, "plan");
      onGeaendert?.();
    } catch (err) {
      melden((err as SozialFehler).message, "plan", true);
    } finally { d.neu(); }
  };

  const titelZeitraum = zustand.ansicht === "monat"
    ? `${MONATE[Number(zustand.anker.slice(5, 7)) - 1]} ${zustand.anker.slice(0, 4)}`
    : `KW ${kalenderwoche(von)} · ${tagKurz(von)}–${tagKurz(bis)}`;

  const hinweiseHart = daten.hinweise.filter((h) => h.art !== "luecke" && h.datum >= von && h.datum <= bis);
  const luecken = daten.hinweise.filter((h) => h.art === "luecke" && h.datum >= von && h.datum <= bis);
  const spannen = tageZuSpannen(luecken.map((h) => h.datum));
  const lueckenTage = luecken.length;
  const laengste = spannen.reduce((m, x) => (x.n > m.n ? x : m), spannen[0] ?? { von: von, bis: von, n: 0 });
  const nichtsDa = Object.values(daten.zaehler ?? {}).reduce((n, x) => n + Number(x || 0), 0) === 0 && !daten.posts.length;
  const gefiltert = !!(f.kanal || f.marke || f.status);
  const filterLeer = gefiltert && posts.length === 0 && daten.posts.length > 0;
  const filterZurueck = () => setzeFilter({ kanal: "", marke: "", status: "" });

  return (
    <div>
      {rundgang}
      <HeuteKarte daten={daten} jetzt={jetzt} istAktuell={istAktuell} onOeffnen={onOeffnen} onHeute={() => setze({ anker: heute })} />
      <BeiClaude daten={daten} onOeffnen={onOeffnen} />

      <div className="so-werkzeug">
        <div className="so-filter" role="group" aria-label="Filter" data-so-filter>
          <select className="mara-eingabe" value={f.kanal} onChange={(e) => setzeFilter({ kanal: e.target.value })} aria-label="Kanal">
            <option value="">Alle Kanäle</option>
            {SOCIAL_KANAELE.map((k) => <option key={k} value={k}>{KANAL_INFO[k].titel}</option>)}
          </select>
          <select className="mara-eingabe" value={f.marke} onChange={(e) => setzeFilter({ marke: e.target.value })} aria-label="Marke">
            <option value="">FIAON und Global</option>
            <option value="fiaon">FIAON</option>
            <option value="global">FIAON Global</option>
          </select>
          <select className="mara-eingabe" value={f.status} onChange={(e) => setzeFilter({ status: e.target.value })} aria-label="Status">
            <option value="">Alle (ohne Verworfene)</option>
            {SOCIAL_STATUS.map((s) => <option key={s} value={s}>{SOCIAL_STATUS_INFO[s].titel}{daten.zaehler?.[s] ? ` · ${zahl(daten.zaehler[s])}` : ""}</option>)}
          </select>
        </div>
        <div className="so-woche" data-so-woche>
          <div className="mara-ansicht" role="group" aria-label="Zeitraum" style={{ margin: 0 }}>
            <button type="button" aria-pressed={zustand.ansicht === "woche"} onClick={() => setze({ ansicht: "woche" })}>Woche</button>
            <button type="button" aria-pressed={zustand.ansicht === "monat"} onClick={() => setze({ ansicht: "monat" })}>Monat</button>
          </div>
          <button type="button" className="mara-knopf klein" aria-label={zustand.ansicht === "monat" ? "Voriger Monat" : "Vorige Woche"} onClick={() => schritt(-1)}>←</button>
          <span className="was" aria-live="polite">{titelZeitraum}</span>
          <button type="button" className="mara-knopf klein" aria-label={zustand.ansicht === "monat" ? "Nächster Monat" : "Nächste Woche"} onClick={() => schritt(1)}>→</button>
          {!istAktuell && <button type="button" className="mara-knopf klein" onClick={() => setze({ anker: heute })}>Heute</button>}
        </div>
      </div>

      {(hinweiseHart.length > 0 || luecken.length > 0) && (
        <div className="mara-hinweise so-pruefung" data-so-pruefung>
          {hinweiseHart.map((h, i) => (
            <p key={i} className="mara-hinweis warn"><span className="mara-punkt warn" />
              <span>{wochentag(h.datum)} {tagKurz(h.datum)}: {h.text}
                {h.post_ids.length ? <> {h.post_ids.map((id) => <button key={id} type="button" className="mara-knopf text" style={{ marginLeft: 8 }} onClick={() => onOeffnen(id)}>Post öffnen</button>)}</> : null}
              </span></p>
          ))}
          {luecken.length > 0 && (
            <p className="mara-hinweis"><span className="mara-punkt" />
              <span>{lueckenTage > 7 && spannen.length > 3
                ? `An ${zahl(lueckenTage)} Tagen ist nichts geplant (${spannen.length} Lücken, die längste ${tagKurz(laengste.von)}–${tagKurz(laengste.bis)}).`
                : `Nichts geplant: ${spannen.map((sp) => (sp.n === 1 ? `${wochentag(sp.von)} ${tagKurz(sp.von)}` : `${tagKurz(sp.von)}–${tagKurz(sp.bis)}`)).join(", ")}`}</span></p>
          )}
        </div>
      )}
      <Meldung m={meldung} ort="plan" onZu={zu} />

      {filterLeer ? (
        <div className="so-leer" data-so-leer>
          <b>Kein Post passt zum Filter.</b> Im Zeitraum stehen {zahl(daten.posts.length)} {daten.posts.length === 1 ? "Post" : "Posts"}, aber keiner mit dieser Auswahl.{" "}
          <button type="button" className="mara-knopf klein" onClick={filterZurueck}>Filter zurücksetzen</button>
        </div>
      ) : nichtsDa ? (
        <div className="so-leer" data-so-leer>
          <b>Noch keine Posts im Studio.</b><br />
          Claude spielt jeden Post mit <code>scripts/social-sync.ts</code> ein (Bild, Video, Caption, Alt-Text, Plan, KI-Kennzeichnung). Er landet hier mit Status „Zur Freigabe“ — dann prüfst du ihn im Handy, gibst frei und meldest ihn nach dem Posten mit dem Link.
        </div>
      ) : zustand.ansicht === "woche" ? (
        breit ? (
          <div className="so-wochenraster" data-so-plan="woche">
            {tage.map((t) => (
              <div key={t} className={`so-tag${t === heute ? " heute" : ""}${ziel === t ? " ziel" : ""}`}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (ziel !== t) setZiel(t); }}
                onDragLeave={() => setZiel((z) => (z === t ? null : z))} onDrop={(e) => void ablegen(e, t)}
                aria-label={`${wochentag(t)} ${tagKurz(t)}`}>
                <div className="so-tag-kopf"><span>{wochentag(t)}</span><b>{tagKurz(t)}</b></div>
                {/* Mehr als zwei Posts am Tag: schmale Karten (Bildchen links), damit die Woche nicht meterlang wird. */}
                {jeTag(t).map((p) => <Karte key={p.id} p={p} onOeffnen={onOeffnen} onZiehen={ziehen} eng={jeTag(t).length > 2} />)}
                {jeTag(t).length === 0 && <span className="so-tag-leer">{gefiltert ? "kein Treffer" : "—"}</span>}
              </div>
            ))}
          </div>
        ) : (
          <TagesListe tage={tage} jeTag={jeTag} heute={heute} onOeffnen={onOeffnen} alleTage gefiltert={gefiltert} />
        )
      ) : breit ? (
        <Monat tage={tage} jeTag={jeTag} heute={heute} anker={zustand.anker} onOeffnen={onOeffnen} onWoche={(t) => setze({ anker: t, ansicht: "woche" })} />
      ) : (
        <TagesListe tage={tage.filter((t) => t.slice(0, 7) === zustand.anker.slice(0, 7))} jeTag={jeTag} heute={heute} onOeffnen={onOeffnen} gefiltert={gefiltert} />
      )}

      <p className="mara-still mara-klein" style={{ marginTop: 14 }}>
        {zahl(posts.length)} {posts.length === 1 ? "Post" : "Posts"} im Zeitraum{f.kanal || f.marke || f.status ? " (gefiltert)" : ""}
        {daten.speicher_bytes ? ` · Speicher Social ${groesse(daten.speicher_bytes)}` : ""}
        {breit && zustand.ansicht === "woche" ? " · Karte auf einen anderen Tag ziehen verschiebt sie (Uhrzeit bleibt)" : ""}
      </p>
    </div>
  );
}

/** Ein veränderlicher Merker ohne Neuzeichnen (für den Takt). */
function useMemoRef<T>(start: T): { current: T } {
  return useMemo(() => ({ current: start }), []); // eslint-disable-line react-hooks/exhaustive-deps
}
function verschiebeMonat(iso: string, n: number): string {
  const d = new Date(`${iso.slice(0, 7)}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

// ── „Heute zu posten" — die eine Glasfläche ─────────────────────────────
function HeuteKarte({ daten, jetzt, istAktuell, onOeffnen, onHeute }: {
  daten: SocialPlanAntwort; jetzt: number; istAktuell: boolean; onOeffnen: (id: number) => void; onHeute: () => void;
}) {
  const heute = daten.heute;
  // Unabhängig vom geblätterten Zeitraum: der Server liefert heute_posts immer mit.
  const heutige = (daten.heute_posts ?? daten.posts.filter((p) => p.plan_datum === heute))
    .filter((p) => p.status !== "verworfen").sort(planSortierung);
  const n = daten.naechster;
  const zp = n?.plan_zeitpunkt ? new Date(n.plan_zeitpunkt).getTime() : null;
  return (
    <section className="mara-glas so-heute" aria-labelledby="so-heute-titel" data-so-heute>
      <div style={{ minWidth: 0 }}>
        <span className="mara-etikett">Heute zu posten · {wochentag(heute)} {tagKurz(heute)}</span>
        <h2 id="so-heute-titel" style={{ marginTop: 4 }}>
          {heutige.length
            ? `${zahl(heutige.length)} ${heutige.length === 1 ? "Post" : "Posts"} heute${heutige.every((p) => !p.plan_zeit) ? " · ganztags" : ""}`
            : "Heute steht nichts im Plan."}
        </h2>
        {heutige.length > 0 && (
          <ul className="so-heute-liste">
            {heutige.slice(0, 6).map((p) => (
              <li key={p.id}>
                {/* Mit Reihenfolge und ohne Uhrzeit zählt nur „#3“ — „ganztags“ steht dann einmal in der Überschrift. */}
                {p.reihenfolge != null && <span className="so-pos nr" title="Reihenfolge beim Posten (damit das Raster stimmt)">#{p.reihenfolge}</span>}
                {(p.plan_zeit || p.reihenfolge == null) && <span className="uhr">{uhrText(p.plan_zeit)}</span>}
                <FormatZeichen f={p.format} />
                <button type="button" className="mara-knopf text titel" onClick={() => onOeffnen(p.id)}><span className="t">{p.titel}</span></button>
                <StatusPille s={p.status} kurz />
              </li>
            ))}
            {heutige.length > 6 && <li className="mara-still">und {heutige.length - 6} weitere — siehe Plan unten</li>}
          </ul>
        )}
        {heutige.length > 1 && heutige.some((p) => p.reihenfolge != null) && (
          <p className="mara-still mara-klein" style={{ marginTop: 6 }}>In der Reihenfolge #1, #2 … posten — sonst stimmt das Raster nicht.</p>
        )}
        {!istAktuell && <button type="button" className="mara-knopf text" onClick={onHeute}>Zur aktuellen Woche</button>}
      </div>
      <div className="so-countdown">
        {n ? (
          <>
            <span className="mara-etikett">Nächster Termin</span>
            <b>{zp ? restzeit(zp, jetzt) : tagWort(n.plan_datum, heute)}</b>
            <small>{zp ? `${tagWort(n.plan_datum, heute)}, ${uhrBerlin(n.plan_zeitpunkt)} Uhr` : "ohne Uhrzeit"} · {n.titel.length > 42 ? `${n.titel.slice(0, 40)}…` : n.titel}</small>
            <button type="button" className="mara-knopf haupt" onClick={() => onOeffnen(n.id)} data-so-naechster>Post öffnen</button>
          </>
        ) : (
          <>
            <span className="mara-etikett">Nächster Termin</span>
            <b className="mara-leise" style={{ fontSize: 18 }}>keiner geplant</b>
            <small>Neue Posts spielt Claude ein.</small>
          </>
        )}
      </div>
    </section>
  );
}

// ── „Liegt bei Claude (n)" ──────────────────────────────────────────────
// Ehrlich (Hausregel „Nur ankündigen, was live ist“): Claude liest diese Notizen in
// Scheibe 1 NICHT selbst. Die Liste ist der Merkzettel für die Social-Sitzung.
function BeiClaude({ daten, onOeffnen }: { daten: SocialPlanAntwort; onOeffnen: (id: number) => void }) {
  const liste = daten.bei_claude ?? [];
  if (!liste.length) return null;
  return (
    <section className="mara-karte so-bei-claude" aria-labelledby="so-bei-claude" data-so-bei-claude>
      <h3 id="so-bei-claude">Liegt bei Claude ({zahl(liste.length)})</h3>
      <p className="mara-satz mara-still">Zurückgegeben mit Notiz. Claude sieht das nicht von selbst — sag es Claude in der Social-Sitzung; die neue Fassung kommt wieder zur Freigabe.</p>
      <ul className="mara-liste" style={{ marginTop: 8 }}>
        {liste.slice(0, 12).map((x) => (
          <li key={x.id} className="so-bei-claude-zeile">
            <button type="button" className="mara-knopf text" onClick={() => onOeffnen(x.id)}>{x.titel}</button>
            <span className="mara-still mara-klein">„{x.notiz.length > 160 ? `${x.notiz.slice(0, 158)}…` : x.notiz}“</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Eine Karte ───────────────────────────────────────────────────────────
function Karte({ p, onOeffnen, onZiehen, liste = false, eng = false }: { p: SocialPostKarte; onOeffnen: (id: number) => void; onZiehen?: (e: DragEvent, p: SocialPostKarte) => void; liste?: boolean; eng?: boolean }) {
  const ziehbar = !!onZiehen && SOCIAL_VERSCHIEBBAR.includes(p.status);
  const titel = `${p.reihenfolge != null ? `#${p.reihenfolge} · ` : ""}${p.titel} — ${FORMAT_INFO[p.format].titel}, ${SOCIAL_STATUS_INFO[p.status].titel}${p.plan_zeit ? `, ${p.plan_zeit} Uhr` : ", ganztags"}`;
  const bild = (
    <span className="bild">
      {p.vorschau ? <img src={p.vorschau.url} alt="" loading="lazy" decoding="async" draggable={false} /> : null}
      {p.format === "reel" || p.format === "karussell" ? <FormatZeichen f={p.format} /> : null}
    </span>
  );
  const kopf = (
    <span className="zeile">
      {p.reihenfolge != null && <span className="so-pos" title="Reihenfolge beim Posten (damit das Raster stimmt)">#{p.reihenfolge}</span>}
      <span className="uhr">{uhrText(p.plan_zeit)}</span>
      <FormatZeichen f={p.format} className="so-zeichen" />
      {p.wortcheck_ergebnis === "rot" && <span className="mara-krit-t" title={`Wort-Check rot (${p.wort_treffer})`}>{liste ? "Wort-Check rot" : "Wort rot"}</span>}
      {p.ki_noetig && <span title="KI-Kennzeichnung nötig">{liste ? "KI-Kennzeichnung" : "KI"}</span>}
      <StatusPunkt s={p.status} />
    </span>
  );
  return (
    <button type="button" className={`so-karte${eng ? " eng" : ""}${p.status === "verworfen" ? " verworfen" : ""}`} onClick={() => onOeffnen(p.id)} title={titel} aria-label={titel}
      draggable={ziehbar || undefined} onDragStart={ziehbar ? (e) => onZiehen!(e, p) : undefined} data-so-post={p.id}>
      {bild}
      {liste || eng ? (
        <span className="text">{kopf}<span className="titel">{p.titel}</span><Kanaele liste={p.kanaele} /></span>
      ) : (
        <>{kopf}<span className="titel">{p.titel}</span><Kanaele liste={p.kanaele} /></>
      )}
    </button>
  );
}

// ── Tagesliste (Handy, Tablet, Monat am Handy) ──────────────────────────
function TagesListe({ tage, jeTag, heute, onOeffnen, alleTage = false, gefiltert = false }: {
  tage: string[]; jeTag: (t: string) => SocialPostKarte[]; heute: string; onOeffnen: (id: number) => void; alleTage?: boolean; gefiltert?: boolean;
}) {
  const sichtbar = alleTage ? tage : tage.filter((t) => jeTag(t).length > 0);
  if (!sichtbar.length) return <div className="so-leer">{gefiltert ? "Kein Post passt zum Filter." : "In diesem Zeitraum ist nichts geplant."}</div>;
  return (
    <div className="so-tagesliste" data-so-plan="liste">
      {sichtbar.map((t) => (
        <section key={t} className={`so-tag${t === heute ? " heute" : ""}`} aria-label={`${wochentag(t)} ${tagKurz(t)}`}>
          <div className="so-tag-kopf"><span>{tagWort(t, heute)}</span><b>{jeTag(t).length ? `${jeTag(t).length} ${jeTag(t).length === 1 ? "Post" : "Posts"}` : ""}</b></div>
          {jeTag(t).map((p) => <Karte key={p.id} p={p} onOeffnen={onOeffnen} liste />)}
          {jeTag(t).length === 0 && <span className="so-tag-leer">{gefiltert ? "kein Treffer für den Filter" : "nichts geplant"}</span>}
        </section>
      ))}
    </div>
  );
}

// ── Monat am breiten Schirm ─────────────────────────────────────────────
function Monat({ tage, jeTag, heute, anker, onOeffnen, onWoche }: { tage: string[]; jeTag: (t: string) => SocialPostKarte[]; heute: string; anker: string; onOeffnen: (id: number) => void; onWoche: (tag: string) => void }) {
  return (
    <div className="so-monat" data-so-plan="monat">
      {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((w) => <span key={w} className="wt">{w}</span>)}
      {tage.map((t) => {
        const ps = jeTag(t);
        return (
          <div key={t} className={`so-monat-tag${t.slice(0, 7) !== anker.slice(0, 7) ? " fremd" : ""}${t === heute ? " heute" : ""}`}>
            <span className="nr">{Number(t.slice(8, 10))}.</span>
            {ps.length > 0 && (
              <div className="bilder">
                {ps.slice(0, 6).map((p) => (
                  <button key={p.id} type="button" onClick={() => onOeffnen(p.id)} title={`${p.plan_zeit ?? "ganztags"} · ${p.titel} · ${SOCIAL_STATUS_INFO[p.status].titel}`} aria-label={p.titel} data-so-post={p.id}>
                    {p.vorschau ? <img src={p.vorschau.url} alt="" loading="lazy" decoding="async" /> : null}
                    <StatusPunkt s={p.status} />
                  </button>
                ))}
              </div>
            )}
            {ps.length > 6 && (
              <button type="button" className="mara-knopf text so-mehr" onClick={() => onWoche(t)}
                aria-label={`${ps.length - 6} weitere Posts am ${wochentag(t)} ${tagKurz(t)} — Woche zeigen`}>+{ps.length - 6}</button>
            )}
          </div>
        );
      })}
    </div>
  );
}
