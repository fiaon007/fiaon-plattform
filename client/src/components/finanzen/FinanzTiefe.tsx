// ═══════════════════════════════════════════════════════════════════════════
// KONTOAUSZUG IM DETAIL (21.09.2026, E-207)
//
// Justin: „Ich muss EXAKT sehen — was verdient er wann, wann gibt er wie viel
// und warum wo aus, was sind die höchsten Kostenpunkte, was kann man sofort
// optimieren."
//
// Die Ansicht rechnet nichts selbst: Sie zeigt `tiefenanalyse()` aus
// shared/fiaon-kontoauszug-tiefe.ts auf den gespeicherten, bereinigten
// Buchungen der Analyse. Jede Zahl lässt sich bis zur einzelnen Buchung
// aufklappen. Sichtbar in der Akte der Telefonkartei (dunkel), in der
// Betreiber-Akte (hell) und in der Mitarbeiter-Akte (dunkel).
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from "react";
import { tiefenanalyse, eur, eurRund, type Posten, type Tiefe } from "@shared/fiaon-kontoauszug-tiefe";
import { kategorieLabel } from "@shared/fiaon-kontoauszug-kategorien";
import "@/styles/finanz-tiefe.css";

const tagDe = (iso: string | null | undefined) => (iso ? iso.split("-").reverse().join(".") : "—");
const monatKurz = (m: string, mitJahr: boolean) => {
  const d = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1));
  const name = d.toLocaleString("de-DE", { month: "short", timeZone: "UTC" }).replace(".", "");
  return mitJahr ? `${name} ${m.slice(2, 4)}` : name;
};
const prozent = (x: number) => `${Math.round(x * 100)} %`;

export default function FinanzTiefe({ analyse, dunkel = false }: { analyse: any; dunkel?: boolean }) {
  const t: Tiefe | null = useMemo(
    () => (Array.isArray(analyse?.buchungen) && analyse.buchungen.length
      ? tiefenanalyse(analyse.buchungen, { zeitraumVon: analyse.zeitraumVon, zeitraumBis: analyse.zeitraumBis })
      : null),
    [analyse],
  );
  if (!t) return null;
  const k = t.kennzahlen;
  const mitJahr = new Set(t.zeitraum.monate.map((m) => m.slice(0, 4))).size > 1;
  const pruef = analyse?.pruefung;
  const tippsHandeln = t.tipps.filter((x) => !x.hinweis);
  const tippsEinordnung = t.tipps.filter((x) => x.hinweis);

  return (
    <div className={`fi-ft${dunkel ? " fi-ft-dunkel" : ""}`}>
      <p className="fi-ft-kopf">
        {[analyse?.bank, `${tagDe(t.zeitraum.von)} – ${tagDe(t.zeitraum.bis)}`, `${t.buchungen} Buchungen`].filter(Boolean).join(" · ")}
        {pruef?.stimmt === true && <span className="fi-ft-gut"> · auf den Cent geprüft</span>}
        {pruef?.stimmt === false && <span className="fi-ft-warn"> · nicht auf den Cent bestätigt — am Auszug gegenlesen</span>}
      </p>

      {analyse?.nebenkonto && (
        <p className="fi-ft-banner">
          <b>Nebenkonto.</b> Die Eingänge kommen überwiegend von einem anderen eigenen Konto — das Einkommen ist hier nicht belegt. Den Auszug des Gehaltskontos anfordern.
        </p>
      )}

      <div className="fi-ft-zahlen">
        <Zahl titel="Einkommen im Monat" wert={eur(k.einkommenJeMonatCents)} unter="Lohn, Rente, Leistungen" />
        <Zahl titel="Ausgaben im Monat" wert={eur(k.ausgabenJeMonatCents)} unter={`davon fest ${eurRund(k.festJeMonatCents)}`} />
        <Zahl titel="Bleibt im Monat" wert={eur(k.freiJeMonatCents)} ton={k.freiJeMonatCents >= 0 ? "gut" : "schlecht"}
          unter={k.weitereJeMonatCents ? `mit ${eurRund(k.weitereJeMonatCents)} weiteren Eingängen` : "alle Eingänge"} />
        <Zahl titel="Sofort vermeidbar" wert={eur(k.vermeidbarJeMonatCents)} ton={k.vermeidbarJeMonatCents > 0 ? "warn" : undefined} unter="Gebühren, Zinsen, Wetten" />
      </div>
      {(k.umbuchungenEinCents > 0 || k.umbuchungenAusCents > 0) && (
        <p className="fi-ft-still">
          Nicht mitgezählt: Umbuchungen zwischen eigenen Konten und Spartöpfen ({eurRund(k.umbuchungenEinCents)} rein, {eurRund(k.umbuchungenAusCents)} raus).
        </p>
      )}
      {t.zahltag && <p className="fi-ft-zahltag">{t.zahltag.text}</p>}

      {/* ── Was kommt wann rein? ─────────────────────────────────────────── */}
      <Abschnitt titel="Was kommt wann rein?" zusatz={t.einkommen.length ? `${t.einkommen.length} Einkommensquelle${t.einkommen.length === 1 ? "" : "n"}` : "kein Einkommen im Auszug"} offen>
        {t.einkommen.length > 0
          ? <QuellenTabelle posten={t.einkommen} monate={t.zeitraum.monate} mitJahr={mitJahr} />
          : <p className="fi-ft-still">Im Auszug steht kein Lohn, keine Rente und keine Leistung.</p>}
        {t.weitereEingaenge.length > 0 && (
          <details className="fi-ft-unter">
            <summary>Weitere Eingänge — kein Einkommen ({eurRund(k.weitereJeMonatCents)} im Monat)</summary>
            <QuellenTabelle posten={t.weitereEingaenge} monate={t.zeitraum.monate} mitJahr={mitJahr} />
          </details>
        )}
      </Abschnitt>

      {/* ── Wofür geht wie viel raus? ────────────────────────────────────── */}
      <Abschnitt titel="Wofür geht wie viel raus?" zusatz={`${t.gruppen.length} Bereiche · ${t.ausgaben.length} Empfänger`} offen>
        <div className="fi-ft-gruppen">
          {t.gruppen.map((g) => (
            <Gruppe key={g.name} name={g.name} jeMonat={g.jeMonatCents} anteil={g.anteil}
              posten={t.ausgaben.filter((p) => p.gruppe === g.name)} />
          ))}
        </div>
      </Abschnitt>

      {/* ── Die größten Kostenpunkte ─────────────────────────────────────── */}
      <Abschnitt titel="Die größten Kostenpunkte" zusatz="nach Betrag im Monat">
        <ol className="fi-ft-rangliste">
          {t.kostenpunkte.map((p) => (
            <li key={p.schluessel}>
              <div className="fi-ft-zeile">
                <span className="fi-ft-name">{p.name}</span>
                <span className="fi-ft-betrag">{eur(p.jeMonatCents)}<small> / Monat</small></span>
              </div>
              <div className="fi-ft-sub">
                {p.kategorieLabel} · {p.rhythmus}{p.anteilEinkommen != null ? ` · ${prozent(p.anteilEinkommen)} des Einkommens` : ""}
              </div>
              {p.anteilEinkommen != null && <Balken anteil={Math.min(1, p.anteilEinkommen)} />}
            </li>
          ))}
        </ol>
        {t.groessteZahlungen.length > 0 && (
          <details className="fi-ft-unter">
            <summary>Größte Einzelzahlungen</summary>
            <ul className="fi-ft-liste">
              {t.groessteZahlungen.map((z, i) => (
                <li key={i} className="fi-ft-zeile">
                  <span><span className="fi-ft-datum">{tagDe(z.datum)}</span> {z.name}{z.zweck ? <span className="fi-ft-still"> · {z.zweck}</span> : null}</span>
                  <span className="fi-ft-betrag">{eur(z.betragCents)}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Abschnitt>

      {/* ── Sofort optimieren ────────────────────────────────────────────── */}
      <Abschnitt titel="Was sich sofort optimieren lässt" zusatz={tippsHandeln.length ? `${tippsHandeln.length} Punkt${tippsHandeln.length === 1 ? "" : "e"}` : "nichts Auffälliges"} offen={tippsHandeln.length > 0}>
        {tippsHandeln.length === 0 && <p className="fi-ft-still">Keine Gebühren, Zinsen, Wetten oder doppelten Verträge im Auszug gefunden.</p>}
        <div className="fi-ft-tipps">
          {[...tippsHandeln, ...tippsEinordnung].map((x) => (
            <div key={x.art} className={`fi-ft-tipp ${x.vermeidbar ? "vermeidbar" : x.hinweis ? "einordnung" : "pruefen"}`}>
              <div className="fi-ft-zeile">
                <span className="fi-ft-name">{x.titel}</span>
                <span className="fi-ft-betrag">
                  {x.jeMonatCents > 0 ? <>{eur(x.jeMonatCents)}<small> / Monat</small></> : x.anzahl ? `${x.anzahl}×` : ""}
                </span>
              </div>
              <span className="fi-ft-marke">{x.vermeidbar ? "vermeidbar" : x.hinweis ? "zur Einordnung" : "prüfen"}</span>
              <p>{x.text}</p>
            </div>
          ))}
        </div>
      </Abschnitt>

      {/* ── Monat für Monat ──────────────────────────────────────────────── */}
      <Abschnitt titel="Monat für Monat" zusatz={`${t.monatsverlauf.length} Monat${t.monatsverlauf.length === 1 ? "" : "e"}`}>
        <div className="fi-ft-scroll">
          <table className="fi-ft-tabelle">
            <thead>
              <tr><th>Monat</th><th>Einkommen</th><th>Weitere</th><th>Fest</th><th>Variabel</th><th>Bleibt</th><th>Tiefster Stand</th></tr>
            </thead>
            <tbody>
              {t.monatsverlauf.map((m) => (
                <tr key={m.monat}>
                  <td>{monatKurz(m.monat, mitJahr)}{!m.voll && <span className="fi-ft-still"> (Teil)</span>}</td>
                  <td>{eurRund(m.einkommenCents)}</td>
                  <td>{eurRund(m.weitereCents)}</td>
                  <td>{eurRund(m.festCents)}</td>
                  <td>{eurRund(m.variabelCents)}</td>
                  <td className={m.freiCents >= 0 ? "fi-ft-gut" : "fi-ft-schlecht"}>{eurRund(m.freiCents)}</td>
                  <td>{m.tiefsterSaldoCents == null ? "—" : <span className={m.tiefsterSaldoCents < 0 ? "fi-ft-schlecht" : undefined}>{eurRund(m.tiefsterSaldoCents)} <span className="fi-ft-still">am {tagDe(m.tiefsterSaldoAm).slice(0, 6)}</span></span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Abschnitt>

      {/* ── Jede Buchung ─────────────────────────────────────────────────── */}
      <Abschnitt titel="Jede Buchung" zusatz={`${t.buchungen} Buchungen, durchsuchbar`}>
        <AlleBuchungen buchungen={analyse.buchungen} />
      </Abschnitt>
    </div>
  );
}

function Zahl({ titel, wert, unter, ton }: { titel: string; wert: string; unter?: string; ton?: "gut" | "schlecht" | "warn" }) {
  return (
    <div className="fi-ft-zahl">
      <span className="fi-ft-zahl-titel">{titel}</span>
      <span className={`fi-ft-zahl-wert${ton ? ` fi-ft-${ton}` : ""}`}>{wert}</span>
      {unter && <span className="fi-ft-zahl-unter">{unter}</span>}
    </div>
  );
}

function Abschnitt({ titel, zusatz, offen = false, children }: { titel: string; zusatz?: string; offen?: boolean; children: React.ReactNode }) {
  return (
    <details className="fi-ft-abschnitt" open={offen}>
      <summary><span className="fi-ft-abschnitt-titel">{titel}</span>{zusatz && <span className="fi-ft-abschnitt-zusatz">{zusatz}</span>}</summary>
      <div className="fi-ft-abschnitt-inhalt">{children}</div>
    </details>
  );
}

function Balken({ anteil }: { anteil: number }) {
  return <span className="fi-ft-balken" aria-hidden="true"><span style={{ width: `${Math.max(2, Math.round(anteil * 100))}%` }} /></span>;
}

function QuellenTabelle({ posten, monate, mitJahr }: { posten: Posten[]; monate: string[]; mitJahr: boolean }) {
  const [alle, setAlle] = useState(false);
  const sichtbar = alle ? posten : posten.slice(0, 8);
  return (
    <>
      <div className="fi-ft-scroll">
        <table className="fi-ft-tabelle">
          <thead>
            <tr>
              <th>Von wem</th><th>Wann</th>
              {monate.map((m) => <th key={m}>{monatKurz(m, mitJahr)}</th>)}
              <th>Ø Monat</th>
            </tr>
          </thead>
          <tbody>
            {sichtbar.map((p) => (
              <tr key={p.schluessel}>
                <td><span className="fi-ft-name">{p.name}</span><span className="fi-ft-sub">{p.kategorieLabel}{p.zweck ? ` · ${p.zweck}` : ""}</span></td>
                <td className="fi-ft-wann">{p.rhythmus}</td>
                {monate.map((m) => <td key={m}>{p.monate[m] ? eurRund(p.monate[m]) : <span className="fi-ft-still">—</span>}</td>)}
                <td><b>{eurRund(p.jeMonatCents)}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {posten.length > 8 && (
        <button type="button" className="fi-ft-mehr" onClick={() => setAlle((x) => !x)}>
          {alle ? "Weniger zeigen" : `Alle ${posten.length} zeigen`}
        </button>
      )}
    </>
  );
}

function Gruppe({ name, jeMonat, anteil, posten }: { name: string; jeMonat: number; anteil: number; posten: Posten[] }) {
  return (
    <details className="fi-ft-gruppe">
      <summary>
        <span className="fi-ft-zeile">
          <span className="fi-ft-name">{name}</span>
          <span className="fi-ft-betrag">{eur(jeMonat)}<small> / Monat · {prozent(anteil)}</small></span>
        </span>
        <Balken anteil={anteil} />
      </summary>
      <ul className="fi-ft-liste">
        {posten.map((p) => <PostenZeile key={p.schluessel} p={p} />)}
      </ul>
    </details>
  );
}

function PostenZeile({ p }: { p: Posten }) {
  const [offen, setOffen] = useState(false);
  return (
    <li className="fi-ft-posten">
      <button type="button" className="fi-ft-posten-knopf" aria-expanded={offen} onClick={() => setOffen((x) => !x)}>
        <span className="fi-ft-zeile">
          <span className="fi-ft-name">{p.name}</span>
          <span className="fi-ft-betrag">{eur(p.jeMonatCents)}<small> / Monat</small></span>
        </span>
        <span className="fi-ft-sub">
          {p.zweck ? `${p.zweck} · ` : ""}{p.kategorieLabel} · {p.rhythmus} · {p.anzahl}× zusammen {eurRund(p.summeCents)}
        </span>
      </button>
      {offen && (
        <ul className="fi-ft-termine">
          {p.termine.map((x, i) => (
            <li key={i} className="fi-ft-zeile">
              <span><span className="fi-ft-datum">{tagDe(x.datum)}</span> {x.zweck || <span className="fi-ft-still">ohne Zweck</span>}{x.korrektur && <span className="fi-ft-korr" title={`Vom System korrigiert (${x.korrektur})`}> korrigiert</span>}</span>
              <span className="fi-ft-betrag">{eur(x.betragCents)}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function AlleBuchungen({ buchungen }: { buchungen: any[] }) {
  const [suche, setSuche] = useState("");
  const [grenze, setGrenze] = useState(150);
  const liste = useMemo(() => {
    const q = suche.trim().toLowerCase();
    const l = [...buchungen].sort((a, b) => String(b.datum).localeCompare(String(a.datum)));
    return q ? l.filter((b) => `${b.empfaenger} ${b.zweck} ${kategorieLabel(b.kategorie)} ${(Number(b.betragCents) / 100).toFixed(2).replace(".", ",")}`.toLowerCase().includes(q)) : l;
  }, [buchungen, suche]);
  return (
    <>
      <input className="fi-ft-suche" type="search" placeholder="Suchen: Name, Zweck, Kategorie oder Betrag" value={suche} onChange={(e) => { setSuche(e.target.value); setGrenze(150); }} />
      <ul className="fi-ft-liste fi-ft-buchungen">
        {liste.slice(0, grenze).map((b, i) => (
          <li key={i} className="fi-ft-zeile">
            <span>
              <span className="fi-ft-datum">{tagDe(b.datum)}</span> {b.empfaenger}
              <span className="fi-ft-sub">{b.zweck ? `${b.zweck} · ` : ""}{kategorieLabel(b.kategorie)}{b.korrektur ? <span className="fi-ft-korr" title={`Vom System korrigiert (${b.korrektur})`}> · korrigiert</span> : null}</span>
            </span>
            <span className={`fi-ft-betrag ${Number(b.betragCents) > 0 ? "fi-ft-gut" : ""}`}>{Number(b.betragCents) > 0 ? "+" : ""}{eur(Number(b.betragCents))}</span>
          </li>
        ))}
      </ul>
      {liste.length > grenze && <button type="button" className="fi-ft-mehr" onClick={() => setGrenze((g) => g + 300)}>Weitere {Math.min(300, liste.length - grenze)} zeigen ({liste.length - grenze} übrig)</button>}
      {liste.length === 0 && <p className="fi-ft-still">Keine Buchung passt zur Suche.</p>}
    </>
  );
}

/**
 * Lädt die Analyse über die Verwaltung (Admin-Code oder Chef-Token) und zeigt
 * sie — für die Betreiber-Akte und die Akte in der Telefonkartei. Die Analyse
 * ist personenweit: Jede Bestellung der Person führt zur jüngsten Auswertung.
 */
export function KontoauszugImDetail({ kundenRef, dunkel = false }: { kundenRef: string; dunkel?: boolean }) {
  const [stand, setStand] = useState<{ geladen: boolean; a: any | null; fehler: string | null }>({ geladen: false, a: null, fehler: null });
  const [laeuft, setLaeuft] = useState(false);
  const laden = useCallback(async () => {
    const r = await fetch(`/api/fiaon/admin/kontoauszug/${encodeURIComponent(kundenRef)}`, { credentials: "include" }).catch(() => null);
    const j: any = r ? await r.json().catch(() => null) : null;
    setStand({ geladen: true, a: j?.analyse ?? null, fehler: r?.ok ? null : (j?.error || "Die Auswertung ließ sich nicht laden.") });
  }, [kundenRef]);
  useEffect(() => { void laden(); }, [laden]);
  const auswerten = async () => {
    setLaeuft(true);
    const r = await fetch(`/api/fiaon/admin/kontoauszug/${encodeURIComponent(kundenRef)}/analysieren`, { method: "POST", credentials: "include" }).catch(() => null);
    const j: any = r ? await r.json().catch(() => null) : null;
    setLaeuft(false);
    if (r?.ok) setStand({ geladen: true, a: j?.analyse ?? null, fehler: null });
    else setStand((s) => ({ ...s, fehler: j?.error || "Die Auswertung ist gescheitert." }));
  };
  if (!stand.geladen) return <p className="fi-ft-lade">Kontoauszug wird geladen …</p>;
  const a = stand.a;
  const knopf = (text: string) => (
    <button type="button" className="fi-ft-knopf" disabled={laeuft} onClick={() => void auswerten()}>
      {laeuft ? "Liest jede Buchung … (1–2 Minuten)" : text}
    </button>
  );
  return (
    <div className={`fi-ft-rahmen${dunkel ? " fi-ft-dunkel" : ""}`}>
      {stand.fehler && <p className="fi-ft-hinweis schlecht">{stand.fehler}</p>}
      {!a && <p className="fi-ft-hinweis">Noch kein Kontoauszug ausgewertet.</p>}
      {a?.status === "laeuft" && <p className="fi-ft-hinweis">Die Auswertung läuft gerade. <button type="button" className="fi-ft-mehr" onClick={() => void laden()}>Neu laden</button></p>}
      {a?.status === "unlesbar" && <p className="fi-ft-hinweis warn">Nicht auswertbar — der Kunde sieht: „{a.fehler}“</p>}
      {a?.status === "fehler" && <p className="fi-ft-hinweis schlecht">Die Auswertung ist gescheitert: {a.fehler}</p>}
      {a?.status === "fertig" && <FinanzTiefe analyse={a} dunkel={dunkel} />}
      <div className="fi-ft-fuss">
        {knopf(a?.status === "fertig" ? "Neu auswerten" : "Jetzt auswerten")}
        {a?.erstelltAm && <span className="fi-ft-still">Ausgewertet am {new Date(a.erstelltAm).toLocaleDateString("de-DE")}</span>}
      </div>
    </div>
  );
}

