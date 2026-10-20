// ═══════════════════════════════════════════════════════════════════════════
// REITER „ANRUFE“ (Cockpit, 20.10.2026) — jedes Gespräch als lesbare Zeile, Details als ruhiges Feld
//
// Vorher: ein Textfeld „Tag JJJJ-MM-TT“, Zeilen wie „Probe Probe nicht erreicht … Prüf-Mara: entfaellt“, im Detail
// „aufnahme_abgelehnt · 21 ms“ und ein leeres „Prüf-Mara:“ (die Liste kennt nur den Status, das Detail las ein Objekt).
// Jetzt: Kalender mit ‹ › und „Heute“, Filter (Alle · Probe · Kunden · Daumen runter), Zeilen wie
// „Probe · Rate fällig · 14:27 · 1:30 Min · 0,16 € · beendet von dir“. Detail: Zusammenfassung, Gespräch als
// Sprechblasen (nur nach Aufnahme-Ja gespeichert), was Aras erledigt hat, dein Daumen, Prüf-Mara in Klartext.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";
import { akteLink } from "@/lib/akte-link";
import { holen, NichtVerbunden, type RouteFehler } from "../ki-teile";
import {
  anrufFiltern, ausgangText, berlinHeute, dauerText, endeText, euroText, pruefText, regelText, spielartText, uhrzeit, werText, werkzeugText, zusammenfassungText,
  type AnrufFilter, type AnrufZeile,
} from "./aras-texte";
import { Leer, Punkt, Segment, TagWahl, Verlauf, Zeichen } from "./aras-teile";

interface Zeile extends AnrufZeile { gespielt?: string | null }
interface Detail extends Zeile {
  briefing?: { probeSpielart?: string } | null;
  transkript?: { t: number; wer: string; text: string }[] | null;
  zusammenfassung?: string | null; ergebnisNotiz?: string | null;
  werkzeuge?: { werkzeug: string; ok: boolean | null; am?: string }[];
  aufnahmeUrl?: string | null; kiHinweisAm?: string | null; aufnahmeJaAm?: string | null; aufnahmeNeinAm?: string | null;
  stimme?: string | null; fehler?: string | null; befund?: unknown; probeUrteilGrund?: string | null;
  pruefMara?: { urteil: string; punkte: { regel: string; schwere: string; hinweis: string }[]; begruendung: string | null } | null;
}

const SEITE = 50;
const STIMME: Record<string, string> = { flitz: "Flitz", nuri: "Nuri", juni: "Juni" };

export default function ArasAnrufe({ verbunden }: { verbunden: boolean }) {
  const [tag, setTag] = useState(berlinHeute());
  const [filter, setFilter] = useState<AnrufFilter>("alle");
  const [seiten, setSeiten] = useState(1);
  const [runde, setRunde] = useState(0);
  const [zeilen, setZeilen] = useState<Zeile[] | null>(null);
  const [mehr, setMehr] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [nichtDa, setNichtDa] = useState(false);
  const [offen, setOffen] = useState<number | null>(null);

  const tagWechseln = (t: string) => { setTag(t); setZeilen(null); setSeiten(1); setOffen(null); };
  useEffect(() => {
    if (!verbunden) return;
    let weg = false;
    (async () => {
      try {
        const alle: Zeile[] = [];
        let voll = false;
        for (let s = 0; s < seiten; s++) {
          const j = await holen<{ zeilen: Zeile[] }>(`/chef/aras/anrufe?tag=${tag}&seite=${s}`);
          alle.push(...(j.zeilen ?? []));
          voll = (j.zeilen ?? []).length >= SEITE;
          if (!voll) break;
        }
        if (!weg) { setZeilen(alle); setMehr(voll); setFehler(null); }
      } catch (e) {
        if (weg) return;
        if ((e as RouteFehler).status === 404) setNichtDa(true);
        setFehler((e as Error).message);
      }
    })();
    const t = window.setInterval(() => { if (document.visibilityState === "visible") setRunde((r) => r + 1); }, 30_000);
    return () => { weg = true; window.clearInterval(t); };
  }, [verbunden, tag, seiten, runde]);

  const zahlen = useMemo(() => {
    const z = zeilen ?? [];
    return { alle: z.length, probe: anrufFiltern(z, "probe").length, kunden: anrufFiltern(z, "kunden").length, daumen: anrufFiltern(z, "daumen").length };
  }, [zeilen]);
  if (!verbunden || nichtDa) return <NichtVerbunden />;
  const liste = anrufFiltern(zeilen ?? [], filter);

  return (
    <div className="ar-reiter-inhalt" data-ki="anrufe">
      <div className="ar-werkzeugleiste">
        <TagWahl tag={tag} onTag={tagWechseln} label="Tag der Anrufe" />
        <Segment label="Welche Anrufe" wert={filter} onWahl={(f) => { setFilter(f); setOffen(null); }} werte={[
          { w: "alle", t: "Alle", anzahl: zahlen.alle }, { w: "probe", t: "Probe", anzahl: zahlen.probe },
          { w: "kunden", t: "Kunden", anzahl: zahlen.kunden }, { w: "daumen", t: "Daumen runter", anzahl: zahlen.daumen, titel: "Probeanrufe, bei denen du Daumen runter gegeben hast" },
        ]} />
      </div>
      {fehler && !zeilen ? <Leer titel="Die Anrufe ließen sich nicht laden.">{fehler} <button type="button" className="ar-knopf-text" onClick={() => setRunde((r) => r + 1)}>Nochmal</button></Leer> : null}
      {!zeilen && !fehler ? <div className="ar-karte" aria-busy="true"><div className="ar-zeile-lade" /><div className="ar-zeile-lade" /><div className="ar-zeile-lade" /></div> : null}
      {zeilen ? (
        liste.length === 0 ? (
          <Leer titel={zeilen.length ? "Keine Anrufe für diesen Filter." : "Keine Anrufe an diesem Tag."}>{filter !== "alle" && zeilen.length ? <button type="button" className="ar-knopf-text" onClick={() => setFilter("alle")}>Alle zeigen</button> : null}</Leer>
        ) : (
          <div className="ar-karte ar-liste-karte">
            <div className="ar-anruf-kopf" aria-hidden="true"><span>Wer</span><span>Uhrzeit</span><span>Dauer</span><span>Kosten</span><span>Ausgang</span><span>Prüf-Mara</span><span /></div>
            <ul className="ar-anrufe">
              {liste.map((z) => <AnrufZeileAnsicht key={z.id} z={z} offen={offen === z.id} onKlick={() => setOffen(offen === z.id ? null : z.id)} />)}
            </ul>
            {mehr ? <button type="button" className="ar-knopf klein ar-mehr" onClick={() => setSeiten((s) => s + 1)}>Weitere {SEITE} laden</button> : null}
          </div>
        )
      ) : null}
    </div>
  );
}

/** Prüf-Mara in der Zeile: ein Punkt und ein Wort — „nichts zu prüfen“ bleibt leer. */
const PRUEF_KURZ: Record<string, string> = { ok: "in Ordnung", auffaellig: "auffällig", fehler: "Fehler", offen: "prüft noch" };

function AnrufZeileAnsicht({ z, offen, onKlick }: { z: Zeile; offen: boolean; onKlick: () => void }) {
  const p = pruefText(z.pruefung);
  const kurz = PRUEF_KURZ[String(z.pruefung ?? "")];
  return (
    <li className={`ar-anruf${offen ? " offen" : ""}`} data-ki-anruf={z.id}>
      <button type="button" className="ar-anruf-zeile" aria-expanded={offen} onClick={onKlick}>
        <span className="ar-wer"><b>{werText(z)}</b></span>
        <span className="ar-zeit">{uhrzeit(z.am)}</span>
        <span className="ar-dauer">{dauerText(z.dauerSek)}</span>
        <span className="ar-kosten">{euroText((Number(z.kostenCents) || 0) / 100)}</span>
        <span className="ar-ausgang">{ausgangText(z)}</span>
        <span className={`ar-pruef ${p.klasse}`} title={`Prüf-Mara: ${p.text}`}>{kurz ? <><Punkt klasse={p.klasse} />{kurz}</> : null}</span>
        <span className="ar-marken">
          {z.probeUrteil ? <span className={`ar-marke daumen ${z.probeUrteil}`} title={z.probeUrteil === "hoch" ? "Dein Daumen: hoch" : "Dein Daumen: runter"}><Zeichen art={z.probeUrteil === "hoch" ? "hoch" : "runter"} /></span> : null}
          <span className="ar-auf" aria-hidden="true"><Zeichen art="unten" /></span>
        </span>
      </button>
      {offen ? <AnrufDetail z={z} /> : null}
    </li>
  );
}

/** Die Aufnahme liegt hinter der Office-Anmeldung (Mitarbeiter-Weg) — wie in der Akte (E-352) erst still öffnen. */
function Aufnahme({ url }: { url: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const laden = async () => {
    try {
      const me = await fetch("/api/fiaon/agent/me", { credentials: "include" }).then((r) => r.json()).catch(() => null);
      if (!me?.agent) {
        const r = await fetch("/api/fiaon/chef/office-sitzung", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" });
        if (!r.ok) throw new Error("Die Aufnahme braucht deine Office-Anmeldung.");
      }
      setSrc(url);
    } catch (e) { setFehler((e as Error).message); }
  };
  if (src) return <audio className="ar-audio" controls autoPlay preload="none" src={src} />;
  return <span className="ar-zeile-knopf"><button type="button" className="ar-knopf klein" onClick={() => void laden()}>Aufnahme anhören</button>{fehler ? <span className="ar-fehler-text">{fehler}</span> : null}</span>;
}

function AnrufDetail({ z }: { z: Zeile }) {
  const [d, setD] = useState<Detail | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  useEffect(() => {
    let weg = false;
    holen<Detail>(`/chef/aras/anrufe/${z.id}`).then((x) => { if (!weg) setD(x); }).catch((e) => { if (!weg) setFehler((e as Error).message); });
    return () => { weg = true; };
  }, [z.id]);
  if (fehler) return <div className="ar-detail"><p className="ar-fehler-text">Die Details ließen sich nicht laden: {fehler}</p></div>;
  if (!d) return <div className="ar-detail" aria-busy="true"><div className="ar-zeile-lade" /><div className="ar-zeile-lade" /></div>;
  const probe = d.spielart === "probe";
  const link = d.personId ? akteLink(d.personId, "chef") : null;
  const angenommen = d.angenommen !== false && (d.dauerSek > 0 || !!d.kiHinweisAm);
  const verlauf = (d.transkript ?? []).filter((t) => String(t.text ?? "").trim());
  const ohneWortlaut = !angenommen ? (probe ? "Nicht abgenommen — es gab kein Gespräch." : "Nicht erreicht — es gab kein Gespräch.")
    : d.aufnahmeNeinAm ? "Kein Wortlaut gespeichert: Die Aufnahme wurde abgelehnt. Es gibt nur die Zusammenfassung."
    : "Kein Wortlaut gespeichert: Ohne Ja zur Aufnahme bleibt nur die Zusammenfassung.";
  const werkzeuge = (d.werkzeuge ?? []).filter((w) => w.werkzeug !== "anruf_beenden");
  // Prüf-Mara: das Urteil mit Punkten (wenn sie schon geprüft hat), sonst der Status und die Live-Regeln ohne Wortlaut.
  const pm = d.pruefMara;
  const status = pruefText(pm?.urteil ?? d.pruefung);
  const befundPunkte = !pm && d.befund && typeof d.befund === "object" && Array.isArray((d.befund as any).punkte) ? ((d.befund as any).punkte as { regel: string; schwere: string }[]) : [];
  const punkte = (pm ? pm.punkte.map((p) => regelText(p.regel, p.hinweis)) : befundPunkte.map((p) => regelText(p.regel))).filter(Boolean);
  const fakten = [
    angenommen ? (d.kiHinweisAm ? `KI-Hinweis gesagt (${uhrzeit(d.kiHinweisAm)})` : "KI-Hinweis fehlte") : null,
    angenommen ? (d.aufnahmeJaAm ? "Aufnahme: Ja" : d.aufnahmeNeinAm ? "Aufnahme: Nein" : "Aufnahme: nicht gefragt") : null,
    endeText(d.endeGrund, probe) ? `Ende: ${endeText(d.endeGrund, probe)}` : null,
    d.stimme ? `Stimme: ${STIMME[d.stimme] ?? d.stimme}` : null,
  ].filter(Boolean) as string[];
  return (
    <div className="ar-detail" data-ki="anruf-detail">
      <div className="ar-detail-kopf">
        <div>
          <b>{probe ? `Probeanruf${d.briefing?.probeSpielart ? ` · ${spielartText(d.briefing.probeSpielart)}` : ""}` : werText(d)}</b>
          <span>{new Date(d.am).toLocaleString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" })} · {dauerText(d.dauerSek)} · {euroText((Number(d.kostenCents) || 0) / 100)}</span>
        </div>
        {link ? <a className="ar-knopf klein" href={link}>Akte öffnen</a> : null}
      </div>
      {d.zusammenfassung ? <p className="ar-zusammenfassung">{zusammenfassungText(d.zusammenfassung, probe)}</p> : null}
      {fakten.length ? <ul className="ar-fakten">{fakten.map((f) => <li key={f}>{f}</li>)}</ul> : null}
      {d.fehler ? <p className="ar-fehler-text">Technik: {d.fehler}</p> : null}
      <div className="ar-detail-block">
        <h3>Gespräch</h3>
        {verlauf.length ? <Verlauf zeilen={verlauf} probe={probe} /> : <p className="ar-leise">{ohneWortlaut}</p>}
        {d.aufnahmeUrl ? <Aufnahme url={d.aufnahmeUrl} /> : null}
      </div>
      {werkzeuge.length ? (
        <div className="ar-detail-block">
          <h3>Was Aras erledigt hat</h3>
          <ul className="ar-erledigt">{werkzeuge.map((w, i) => <li key={i}><Punkt klasse={w.ok === false ? "krit" : "gut"} />{werkzeugText(w.werkzeug)}{w.ok === false ? " — hat nicht geklappt" : ""}</li>)}</ul>
        </div>
      ) : null}
      {probe && d.probeUrteil ? (
        <div className="ar-detail-block">
          <h3>Dein Urteil</h3>
          <p className="ar-urteil-zeile"><Zeichen art={d.probeUrteil === "hoch" ? "hoch" : "runter"} /> {d.probeUrteil === "hoch" ? "Daumen hoch — gut genug" : "Daumen runter"}{d.probeUrteilGrund ? <span className="ar-leise"> · {d.probeUrteilGrund}</span> : null}</p>
        </div>
      ) : null}
      <div className="ar-detail-block">
        <h3>Prüf-Mara</h3>
        <p className="ar-pruef-zeile"><Punkt klasse={status.klasse} />{status.text}{!angenommen && d.pruefung === "entfaellt" ? " (kein Gespräch)" : ""}</p>
        {punkte.length ? <ul className="ar-punkte">{punkte.map((p, i) => <li key={i}>{p}</li>)}</ul> : null}
        {pm?.begruendung ? <p className="ar-leise">{pm.begruendung}</p> : null}
      </div>
    </div>
  );
}
