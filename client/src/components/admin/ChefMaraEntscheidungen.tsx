// ═══════════════════════════════════════════════════════════════════════════
// /chef/s/mara?reiter=entscheidungen — MARAS ENTSCHEIDUNGEN (15.10.2026, E-370)
//
// Justin: „Mara soll ALLES selbst machen können, nichts weitergeben an die
// Mitarbeiter – wenn sie ne Entscheidung braucht, dann soll ich es mit 1 Klick
// entscheiden können (übersichtlich, verständlich, einfach) – aber Mara soll
// nicht MEHR Arbeit schaffen."
//
//   · Oben eine Zeile: wie viele offen sind (Geld/Recht zuerst), Stand, „Neu prüfen".
//   · Je Karte: was es ist, wer (Link zur Akte), ein, zwei Sätze, Belege als Chips,
//     die Kundenzeile gekürzt, Maras Empfehlung als blauer Knopf vorn, die anderen
//     Optionen daneben, „Später". Nach dem Klick steht das Ergebnis IN der Karte.
//   · Unten aufklappbar: entschieden in den letzten 7 Tagen, und was „später" liegt.
// Die erste Karte ist die eine Glasfläche der Ansicht (.mara-glas); die übrigen matt.
// Regeln und Werkzeuge: server/lib/fiaon-mara-entscheidungen.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from "react";
import { API, zahl, seit, Geruest, Fehlermeldung } from "./chef-teile";
import { useMaraDaten, useMaraRundgang, useMeldung, Meldung, MARA_QUELLEN, uhrBerlin, wannWieder } from "./mara-lage";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "@/pages/agent/rundgaenge";
import { akteLink } from "@/lib/akte-link";

type Ton = "gut" | "neutral" | "vorsicht";
interface Option { key: string; label: string; ton: Ton; link: string | null; titel: string | null; harmlos?: boolean }
interface Beleg { text: string; art?: "chip" | "zitat" | "zeile"; ton?: "gut" | "warn" | "krit"; name?: string | null; personId?: number | null }
interface Karte {
  id: number; art: string; artText: string; gewicht: number;
  personId: number | null; name: string | null; ref: string | null;
  titel: string; text: string; empfehlung: string | null;
  optionen: Option[]; belege: Beleg[];
  status: "offen" | "entschieden" | "erledigt_von_selbst" | "spaeter";
  spaeterBis: string | null; entschiedenAm: string | null; entschiedenVon: string | null;
  gewaehlt: string | null; gewaehltLabel: string | null; ergebnis: string | null; fehler: string | null; createdAt: string;
}
// E-397: „Heute N Entscheidungen, etwa M Minuten“ und Sammelkarten (gleiche Fälle, ein Klick, einzeln abwählbar).
interface Last { entscheidungen: number; minuten: number; karten: number; sammelkarten: number; aelterAlsZiel: number; aeltesteTage: number }
// E-406 B3: `nein` — „Nein, so lassen“ für alle (nur ein harmloses „nichts“, der Server prüft es noch einmal).
interface Gruppe { schluessel: string; art: string; artText: string; empfehlung: string; empfehlungLabel: string; empfehlungTitel: string | null; ids: number[]; anzahl: number; aeltesteAm: string; nein?: { key: string; label: string } | null }
interface Daten {
  offen: Karte[]; spaeter: Karte[]; entschieden: Karte[];
  zaehler: { offen: number; geldRecht: number; spaeter: number };
  stand: { gesammeltAm: string | null; laeuft: boolean; fehler: Record<string, string> };
  last?: Last; gruppen?: Gruppe[];
}

const ARTEN_TEXT: Record<string, string> = {
  kuendigung_ungebucht: "Kündigungen", raten_nach_ende: "Raten nach Vertragsende", eingang_unverbucht: "Geld eingegangen",
  mahnstopp: "Mahnstopps", werbesperre_zahlungspost: "Werbesperren", wa_vorlagen: "WhatsApp-Vorlagen",
  // E-406 B3: Maras Aufräum-Vorschläge und die Karte „Termin eintragen?“ (Ampel rot).
  mara_aufraeumen_zahlung: "Alte Zahlungsmeldungen", mara_termin_rot: "Termine (Ampel rot)",
};

async function senden(pfad: string, body: unknown): Promise<any> {
  const r = await fetch(`${API}${pfad}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok) {
    const e = new Error(j?.error || "Das hat nicht geklappt.") as Error & { karte?: Karte };
    e.karte = j?.karte ?? undefined;
    throw e;
  }
  return j;
}

function Knopf({ o, haupt, busy, onKlick }: { o: Option; haupt?: boolean; busy: boolean; onKlick: () => void }) {
  const klasse = `mara-knopf${haupt ? " haupt" : ""}${!haupt && o.ton === "vorsicht" ? " warn" : ""}`;
  if (o.link) return <a className={klasse} href={o.link} title={o.titel ?? undefined}>{o.label}</a>;
  return <button type="button" className={klasse} disabled={busy} title={o.titel ?? undefined} onClick={onKlick}>{o.label}</button>;
}

function KarteAnsicht({ k, glas, busy, onEntscheiden, onSpaeter }: {
  k: Karte; glas: boolean; busy: string | null;
  onEntscheiden: (k: Karte, o: Option) => void; onSpaeter: (k: Karte) => void;
}) {
  const chips = k.belege.filter((b) => !b.art || b.art === "chip");
  const zitate = k.belege.filter((b) => b.art === "zitat");
  const zeilen = k.belege.filter((b) => b.art === "zeile");
  const empfohlen = k.optionen.find((o) => o.key === k.empfehlung) ?? null;
  const andere = k.optionen.filter((o) => o !== empfohlen);
  const fertig = k.status === "entschieden" || k.status === "erledigt_von_selbst";
  const laeuft = busy?.startsWith(`${k.id}:`) ?? false;
  const person = k.personId ? akteLink(k.personId, "chef") : null;
  return (
    <article className={`me-karte ${glas ? "mara-glas" : "mara-karte"}${fertig ? " fertig" : ""}`} data-art={k.art} id={`me-${k.id}`}>
      <header className="me-kopf">
        <span className="mara-etikett">{k.artText}</span>
        {k.personId ? (
          person ? <a className="me-person" href={person} target="_blank" rel="noreferrer">{k.name || `Person ${k.personId}`}</a>
            : <span className="me-person">{k.name || `Person ${k.personId}`}</span>
        ) : null}
      </header>
      <h3 className="me-titel">{k.titel}</h3>
      <p className="me-text">{k.text}</p>
      {chips.length > 0 && (
        <div className="me-belege">
          {chips.map((b, i) => <span key={i} className={`mp-chip${b.ton === "warn" ? " gelb" : b.ton === "gut" ? " gruen" : b.ton === "krit" ? " rot" : ""}`}>{b.text}</span>)}
        </div>
      )}
      {zitate.map((b, i) => (
        <p key={i} className="me-zitat">{b.name ? <span className="me-zitat-wo">{b.name}</span> : null}„{b.text}“</p>
      ))}
      {zeilen.length > 0 && (
        <details className="mara-klappe me-liste">
          <summary>Liste · {zahl(zeilen.length)}</summary>
          <ul>
            {zeilen.map((z, i) => {
              const l = z.personId ? akteLink(z.personId, "chef") : null;
              return (
                <li key={i}>
                  {l ? <a href={l} target="_blank" rel="noreferrer">{z.name || `Person ${z.personId}`}</a> : <span>{z.name || "—"}</span>}
                  <span className="mara-still">{z.text}</span>
                </li>
              );
            })}
          </ul>
        </details>
      )}
      {fertig ? (
        <p className={`me-ergebnis${k.status === "erledigt_von_selbst" ? " leise" : ""}`} role="status">
          <span className="mara-punkt gut" aria-hidden="true" />
          <span>
            {k.status === "erledigt_von_selbst" ? "Nichts mehr zu tun: " : "Erledigt: "}{k.ergebnis}
            {k.gewaehltLabel ? <span className="mara-still"> · {k.gewaehltLabel}</span> : null}
          </span>
        </p>
      ) : (
        <div className="me-knoepfe">
          {empfohlen ? <span className="me-empf">Mara empfiehlt</span> : null}
          {empfohlen ? <Knopf o={empfohlen} haupt busy={!!busy} onKlick={() => onEntscheiden(k, empfohlen)} /> : null}
          {andere.map((o) => <Knopf key={o.key} o={o} busy={!!busy} onKlick={() => onEntscheiden(k, o)} />)}
          <button type="button" className="mara-knopf text me-spaeter" disabled={!!busy} onClick={() => onSpaeter(k)} title="Drei Tage aus der Liste">Später</button>
          {laeuft ? <span className="mara-still mara-klein">läuft …</span> : null}
        </div>
      )}
      {!fertig && k.fehler ? <p className="mara-meldung fehler" role="alert"><span>{k.fehler}</span></p> : null}
    </article>
  );
}

/**
 * E-397: Eine Sammelkarte — gleiche Fälle (gleiche Art, gleiche Empfehlung). Ein Klick führt je Fall SEINE Empfehlung
 * aus (dieselbe Wirkung wie der blaue Knopf auf der Einzelkarte); Häkchen weg = dieser Fall bleibt offen.
 */
function SammelKarte({ g, karten, busy, onAlle, onEinzeln }: {
  g: Gruppe; karten: Karte[]; busy: string | null;
  onAlle: (g: Gruppe, ids: number[], option?: string) => void; onEinzeln: (g: Gruppe) => void;
}) {
  const [ab, setAb] = useState<Set<number>>(new Set());
  const gewaehlt = karten.filter((k) => !ab.has(k.id)).map((k) => k.id);
  const laeuft = busy === `sammel:${g.schluessel}`;
  return (
    <article className="me-karte mara-karte me-sammel" data-art={g.art} id={`me-sammel-${g.art}`}>
      <header className="me-kopf">
        <span className="mara-etikett">Sammelkarte · {g.artText}</span>
        <span className="mara-still mara-klein">{zahl(karten.length)} gleiche Fälle</span>
      </header>
      <h3 className="me-titel">{zahl(karten.length)} × {g.artText}: Mara empfiehlt „{g.empfehlungLabel}“</h3>
      <p className="me-text">Ein Klick entscheidet alle angehakten Fälle — jeder mit seiner eigenen Empfehlung, wie auf der Einzelkarte. Häkchen weg: Der Fall bleibt offen.{g.empfehlungTitel ? ` ${g.empfehlungTitel}` : ""}</p>
      <ul className="me-sammel-liste">
        {karten.map((k) => {
          const l = k.personId ? akteLink(k.personId, "chef") : null;
          return (
            <li key={k.id}>
              <label>
                <input type="checkbox" checked={!ab.has(k.id)} disabled={laeuft}
                  onChange={(e) => setAb((alt) => { const n = new Set(alt); if (e.target.checked) n.delete(k.id); else n.add(k.id); return n; })} />
                {l ? <a href={l} target="_blank" rel="noreferrer">{k.name || `Person ${k.personId}`}</a> : <b>{k.name || k.ref || "—"}</b>}
              </label>
              <span className="mara-still">{k.text}</span>
            </li>
          );
        })}
      </ul>
      <div className="me-knoepfe">
        <span className="me-empf">Mara empfiehlt</span>
        <button type="button" className="mara-knopf haupt" disabled={!!busy || gewaehlt.length === 0} onClick={() => onAlle(g, gewaehlt)}>
          {laeuft ? "läuft …" : `${g.empfehlungLabel} · ${zahl(gewaehlt.length)} ${gewaehlt.length === 1 ? "Fall" : "Fälle"}`}
        </button>
        {g.nein ? (
          <button type="button" className="mara-knopf" disabled={!!busy || gewaehlt.length === 0} onClick={() => onAlle(g, gewaehlt, g.nein!.key)}
            title="Alle angehakten Fälle bleiben, wie sie sind — die Karten gehen zu.">{g.nein.label}</button>
        ) : null}
        <button type="button" className="mara-knopf text" disabled={!!busy} onClick={() => onEinzeln(g)}>Einzeln entscheiden</button>
      </div>
    </article>
  );
}

export default function ChefMaraEntscheidungen() {
  const d = useMaraDaten<Daten>("entscheidungen", MARA_QUELLEN.entscheidungen);
  const rg = useMaraRundgang();
  const { meldung, melden, zu } = useMeldung();
  const [busy, setBusy] = useState<string | null>(null);
  // Nach dem Klick: die Karte, wie der Server sie zurückgab — sie bleibt an ihrem Platz stehen, mit Ergebnis.
  const [frisch, setFrisch] = useState<Record<number, Karte>>({});
  const reihe = useRef<number[]>([]);
  const daten = d.daten;
  // E-397: Sammelkarten, die Justin lieber einzeln sehen will (bis zum Neuladen der Seite).
  const [einzeln, setEinzeln] = useState<Set<string>>(new Set());
  const gruppen = useMemo(() => (daten?.gruppen ?? []).filter((g) => !einzeln.has(g.schluessel)), [daten, einzeln]);

  // Mara prüft gerade (Sammler läuft) — gleich noch einmal nachsehen.
  useEffect(() => {
    if (!daten?.stand?.laeuft) return;
    const t = window.setTimeout(() => d.neu(), 6000);
    return () => window.clearTimeout(t);
  }, [daten, d.neu]);

  const liste = useMemo(() => {
    const server = daten?.offen ?? [];
    const aus: Karte[] = server.map((k) => frisch[k.id] ?? k).filter((k) => k.status !== "spaeter");
    // Was eben entschieden wurde und nicht mehr „offen" kommt, bleibt an seinem bisherigen Platz.
    for (const k of Object.values(frisch)) {
      if (k.status === "spaeter" || aus.some((x) => x.id === k.id)) continue;
      const vorher = reihe.current.indexOf(k.id);
      aus.splice(vorher < 0 ? aus.length : Math.min(vorher, aus.length), 0, k);
    }
    return aus;
  }, [daten, frisch]);
  useEffect(() => { reihe.current = liste.map((k) => k.id); }, [liste]);
  // Karten einer Sammelkarte stehen nicht noch einmal einzeln da (solange sie offen sind).
  const inGruppe = useMemo(() => new Set(gruppen.flatMap((g) => g.ids)), [gruppen]);
  const einzelListe = useMemo(() => liste.filter((k) => !(inGruppe.has(k.id) && k.status === "offen")), [liste, inGruppe]);

  const sammel = async (g: Gruppe, ids: number[], option?: string) => {
    if (!ids.length) return;
    setBusy(`sammel:${g.schluessel}`);
    try {
      const j = await senden("/chef/mara/entscheidungen/sammel", { gruppe: g.schluessel, ids, ...(option ? { option } : {}) });
      setFrisch((f) => { const n = { ...f }; for (const k of (j.karten ?? []) as Karte[]) n[k.id] = k; return n; });
      melden(`${zahl(j.erledigt)} ${j.erledigt === 1 ? "Fall" : "Fälle"} entschieden${j.fehler?.length ? ` · ${zahl(j.fehler.length)} mit Fehler (stehen einzeln da)` : ""}.`, "kopf", !!j.fehler?.length);
    } catch (e: any) { melden(e.message, "kopf", true); } finally { setBusy(null); d.neu(); }
  };

  const entscheiden = async (k: Karte, o: Option) => {
    if (o.ton === "vorsicht" && o.key !== k.empfehlung && !window.confirm(`${o.label}?${o.titel ? `\n\n${o.titel}` : ""}`)) return;
    setBusy(`${k.id}:${o.key}`);
    try {
      const j = await senden("/chef/mara/entscheidungen/entscheiden", { id: k.id, option: o.key });
      setFrisch((f) => ({ ...f, [k.id]: j.karte as Karte }));
    } catch (e: any) {
      setFrisch((f) => ({ ...f, [k.id]: (e.karte as Karte | undefined) ?? { ...k, fehler: e.message } }));
    } finally {
      setBusy(null);
      d.neu();
    }
  };
  const spaeter = async (k: Karte) => {
    setBusy(`${k.id}:spaeter`);
    try {
      const j = await senden("/chef/mara/entscheidungen/spaeter", { id: k.id });
      setFrisch((f) => ({ ...f, [k.id]: j.karte as Karte }));
      melden(`„${k.titel}“ liegt bis ${wannWieder(j.karte?.spaeterBis)} auf später.`, "kopf");
    } catch (e: any) { melden(e.message, "kopf", true); } finally { setBusy(null); d.neu(); }
  };
  const pruefen = async () => {
    setBusy("pruefen");
    try { await senden("/chef/mara/entscheidungen/pruefen", {}); setFrisch({}); d.neu(); melden("Neu geprüft.", "kopf"); }
    catch (e: any) { melden(e.message, "kopf", true); } finally { setBusy(null); }
  };

  const rundgang = <Rundgang raum="mara-entscheidungen" titel="Entscheidungen" schritte={RUNDGAENGE.maraEntscheidungen.schritte} {...rg} />;
  if (d.fehler && !daten) return <div className="me">{rundgang}<Fehlermeldung text={d.fehler} erneut={d.neu} /></div>;
  if (!daten) return <div className="me">{rundgang}<Geruest zeilen={8} /></div>;

  const offen = liste.filter((k) => k.status === "offen").length;
  const geldRecht = liste.filter((k) => k.status === "offen" && k.gewicht >= 60).length;
  const nichtGeprueft = Object.keys(daten.stand.fehler ?? {});

  return (
    <div className="me">
      {rundgang}
      <div className="mara-status me-status" aria-label="Was auf dich wartet">
        <div className="st">
          <span className={`gross${offen ? "" : " wort"}`}>{offen ? zahl(offen) : "nichts"}</span>
          <div className="st-text"><div>offen</div><small>{offen ? (geldRecht ? `${zahl(geldRecht)} davon Geld oder Recht` : "nur Komfort") : "Mara erledigt den Rest"}</small></div>
        </div>
        {daten.last && daten.last.karten > 0 ? (
          <div className="st me-last" title={`${zahl(daten.last.karten)} Karten, davon ${zahl(daten.last.sammelkarten)} Sammelkarten. Ziel: keine Karte älter als 2 Tage.`}>
            <div className="st-text">
              <div>Heute {zahl(daten.last.entscheidungen)} {daten.last.entscheidungen === 1 ? "Entscheidung" : "Entscheidungen"}, etwa {zahl(daten.last.minuten)} {daten.last.minuten === 1 ? "Minute" : "Minuten"}</div>
              <small className={daten.last.aelterAlsZiel ? "me-warn" : undefined}>{daten.last.aelterAlsZiel ? `${zahl(daten.last.aelterAlsZiel)} älter als 2 Tage · älteste ${zahl(daten.last.aeltesteTage)} Tage` : "keine älter als 2 Tage"}</small>
            </div>
          </div>
        ) : null}
        {daten.zaehler.spaeter > 0 ? (
          <div className="st"><span className="gross">{zahl(daten.zaehler.spaeter)}</span><div className="st-text"><div>später</div><small>kommen von selbst wieder</small></div></div>
        ) : null}
        <div className="st rechts">
          <span className="mara-still mara-klein">
            {daten.stand.laeuft ? "Mara prüft gerade …" : daten.stand.gesammeltAm ? `Geprüft ${uhrBerlin(daten.stand.gesammeltAm)}` : "noch nicht geprüft"}
            {" · "}
            <button type="button" className="mara-knopf text" disabled={!!busy} onClick={() => void pruefen()}>{busy === "pruefen" ? "prüft …" : "Neu prüfen"}</button>
          </span>
        </div>
      </div>
      <Meldung m={meldung} ort="kopf" onZu={zu} />
      {nichtGeprueft.length > 0 && (
        <div className="mara-hinweise">
          <p className="mara-hinweis warn" title={nichtGeprueft.map((a) => `${ARTEN_TEXT[a] ?? a}: ${daten.stand.fehler[a]}`).join("\n")}>
            <span className="mara-punkt warn" aria-hidden="true" />
            <span>Nicht geprüft: {nichtGeprueft.map((a) => ARTEN_TEXT[a] ?? a).join(", ")} — beim nächsten Prüfen wieder.</span>
          </p>
        </div>
      )}

      {liste.length === 0 ? (
        <p className="mp-leer me-leer">Nichts zu entscheiden.</p>
      ) : (
        <div className="me-liste-karten">
          {gruppen.map((g) => (
            <SammelKarte key={g.schluessel} g={g} karten={liste.filter((k) => g.ids.includes(k.id) && k.status === "offen")} busy={busy}
              onAlle={(x, ids, option) => void sammel(x, ids, option)} onEinzeln={(x) => setEinzeln((alt) => new Set(alt).add(x.schluessel))} />
          ))}
          {einzelListe.map((k, i) => (
            <KarteAnsicht key={k.id} k={k} glas={i === 0 && gruppen.length === 0} busy={busy} onEntscheiden={(x, o) => void entscheiden(x, o)} onSpaeter={(x) => void spaeter(x)} />
          ))}
        </div>
      )}

      <details className="mara-klappe me-entschieden">
        <summary>Entschieden (letzte 7 Tage){daten.entschieden.length ? ` · ${zahl(daten.entschieden.length)}` : ""}</summary>
        {daten.entschieden.length === 0 ? <p className="mp-leer">Noch nichts.</p> : (
          <ul className="me-verlauf">
            {daten.entschieden.map((k) => (
              <li key={k.id}>
                <span className="mara-etikett">{k.artText}</span>
                <span className="me-verlauf-was">
                  <b>{k.titel}</b>
                  {k.personId && k.name ? <> · <a href={akteLink(k.personId, "chef") ?? undefined} target="_blank" rel="noreferrer">{k.name}</a></> : null}
                </span>
                <span className="me-verlauf-ergebnis">
                  {k.status === "erledigt_von_selbst" && !k.gewaehltLabel ? "von selbst erledigt" : k.gewaehltLabel}{k.ergebnis ? ` — ${k.ergebnis}` : ""}
                </span>
                <span className="mara-still mara-klein">{seit(k.entschiedenAm)}{k.entschiedenVon ? ` · ${k.entschiedenVon}` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </details>
      {daten.spaeter.length > 0 && (
        <details className="mara-klappe me-spaeter-liste">
          <summary>Später · {zahl(daten.spaeter.length)}</summary>
          <ul className="me-verlauf">
            {daten.spaeter.map((k) => (
              <li key={k.id}>
                <span className="mara-etikett">{k.artText}</span>
                <span className="me-verlauf-was"><b>{k.titel}</b>{k.name ? ` · ${k.name}` : ""}</span>
                <span className="mara-still mara-klein">kommt {wannWieder(k.spaeterBis)} wieder</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
