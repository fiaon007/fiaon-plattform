// /app/weg — der Weg in voller Länge (Bauvorlage 3.3) und die Zielkarte, die
// Heute im Navy-Glas und hier in Weiß zeichnet. Kein Prozent, keine Zeitprognose.
import { useState } from "react";
import { Link } from "wouter";
import type { Rahmenweg, Schritt } from "@shared/fiaon-rahmenweg";
import { zielTitel } from "@shared/fiaon-rahmenweg";
import type { Bereich } from "./typen";
import { eur } from "./Bausteine";

const eurGanz = (cents: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(cents / 100);

export function Zielkarte({ rw, hell = false }: { rw: Rahmenweg; hell?: boolean }) {
  const z = zielTitel(rw.ziel, eurGanz);
  return (
    <section className={`ap-ziel${hell ? " hell" : ""}`} aria-label={`${rw.erledigt} von ${rw.gesamt} Schritten erledigt`}>
      <div className="ap-ziel-ueber">Ihr Weg</div>
      <div className="ap-ziel-titel">{z.titel.replace(/^Ihr Weg /, "")}</div>
      {z.zeilen.map((t) => <div key={t} className="ap-ziel-unter">{t}</div>)}
      <div className="ap-stufen" role="img" aria-label={`${rw.erledigt} von ${rw.gesamt} Schritten erledigt`}>
        {rw.schritte.map((s, i) => <span key={s.key} className={`ap-stufe ${s.stand === "erledigt" ? "fertig" : s.stand}${s.verspaetet ? " verspaetet" : ""}`} style={{ ["--i" as any]: i }} />)}
      </div>
      <div className="ap-ziel-stand">
        <b>{rw.erledigt} von {rw.gesamt} Schritten erledigt</b>
        {rw.jetzt && <span>Jetzt: {rw.jetzt.kurz}</span>}
      </div>
      <div className="ap-ziel-hinweis">Über Karte, Konto und Rahmen entscheidet die Bank.</div>
    </section>
  );
}

export function Weg({ b, rw, basis, onAktion }: { b: Bereich; rw: Rahmenweg; basis: string; onAktion: (s: Schritt) => void }) {
  const [offen, setOffen] = useState<string | null>(rw.jetzt?.key ?? null);
  const [ratenAuf, setRatenAuf] = useState(false);
  const tore = b.karte?.tore ?? [];
  const alleTore = tore.length > 0 && tore.every((t) => t.erfuellt);

  return (
    <>
      <div className="ap-auf"><Zielkarte rw={rw} hell /></div>
      <p className="ap-ruhe ap-auf v1" style={{ fontSize: 15 }}>Über Karte, Konto und Rahmen entscheidet die Bank. Wir bereiten alles vor.</p>

      <section className="ap-abschnitt ap-auf v1">
        <h2 className="ap-abschnitt-titel">Die Schritte</h2>
        <div className="ap-karte" style={{ padding: "4px 16px" }}>
          <ol className="ap-etappen">
            {rw.schritte.map((s, i) => {
              const auf = offen === s.key;
              return (
                <li key={s.key} className={`ap-etappe ${s.stand === "erledigt" ? "fertig" : s.stand}`} style={{ cursor: "pointer" }} onClick={() => setOffen(auf ? null : s.key)}>
                  <span className={`ap-punkt ${s.stand === "erledigt" ? "fertig" : s.stand === "jetzt" ? "jetzt" : ""}`}>{s.stand === "erledigt" ? "✓" : s.stand === "kommt" ? <span style={{ color: "var(--fi-text-still)", fontSize: 12 }}>{i + 1}</span> : null}</span>
                  <div>
                    <b>{s.titel}</b>
                    {auf && <small>{s.text}</small>}
                    {auf && s.stand === "jetzt" && s.wer === "kunde" && s.aktion && <button type="button" className="ap-knopf klein" style={{ marginTop: 10 }} onClick={(e) => { e.stopPropagation(); onAktion(s); }}>{s.aktion}</button>}
                  </div>
                  <span className="ap-stempel">{s.stand === "erledigt" ? (s.am ? `erledigt am ${s.am}` : "erledigt") : s.stand === "jetzt" ? (s.wer === "kunde" ? "Ihr Zug" : "Liegt bei FIAON") : i > 0 ? `nach ${rw.schritte[i - 1].titel.split(" ").slice(0, 2).join(" ")}` : ""}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {b.paket.abo && rw.raten.gesamt > 0 && (
        <section className="ap-abschnitt ap-auf v2">
          <h2 className="ap-abschnitt-titel">Raten — zugleich Ihr Zahlungsnachweis</h2>
          <div className="ap-karte">
            <div className="ap-zeile" style={{ cursor: "pointer" }} onClick={() => setRatenAuf(!ratenAuf)}>
              <b style={{ fontSize: 16 }}>{rw.raten.puenktlich} von {rw.raten.gesamt} Raten pünktlich</b>
              <span className="ap-link">{ratenAuf ? "Zuklappen" : "Alle Raten"}</span>
            </div>
            {rw.raten.ueberfaellig && <div className="ap-status offen" style={{ marginTop: 8, fontWeight: 500 }}>Rate {rw.raten.ueberfaellig.nr} ist{rw.raten.ueberfaellig.seit ? ` seit ${rw.raten.ueberfaellig.seit}` : ""} offen.</div>}
            {ratenAuf && (
              <ol className="ap-etappen" style={{ marginTop: 8 }}>
                {b.abo.raten.map((r) => {
                  const bez = r.status === "bezahlt";
                  return (
                    <li key={r.nr} className={`ap-etappe ${bez ? "fertig" : "kommt"}`}>
                      <span className={`ap-punkt ${bez ? "fertig" : ""}`}>{bez ? "✓" : <span style={{ color: "var(--fi-text-still)", fontSize: 12 }}>{r.nr}</span>}</span>
                      <div><b className="ap-mono" style={{ fontSize: 15 }}>{eur(r.betragCents)}</b><small>Rate {r.nr} · fällig {r.faelligAm ?? "–"}{bez ? ` · gezahlt am ${r.bezahltAm ?? "–"}` : " · offen"}</small></div>
                      <span />
                    </li>
                  );
                })}
              </ol>
            )}
            <Link href={`${basis}/geld`} className="ap-link" style={{ display: "inline-block", marginTop: 10, fontSize: 15 }}>Zu Ihrem Geld →</Link>
          </div>
        </section>
      )}

      {tore.length > 0 && (
        <section className="ap-abschnitt ap-auf v3">
          <h2 className="ap-abschnitt-titel">Drei Dinge prüfen wir, bevor wir Konto und Karte beantragen</h2>
          <div className="ap-karte" style={{ padding: "4px 16px" }}>
            <ol className="ap-etappen">
              {tore.map((t, i) => (
                <li key={i} className={`ap-etappe ${t.erfuellt ? "fertig" : "kommt"}`}>
                  <span className={`ap-punkt ${t.erfuellt ? "fertig" : ""}`}>{t.erfuellt ? "✓" : null}</span>
                  <div><b>{t.titel}</b>{t.warum && <small>{t.warum}</small>}</div>
                  <span className="ap-stempel">{t.erfuellt ? "erfüllt" : "offen"}</span>
                </li>
              ))}
            </ol>
            {alleTore && <p style={{ margin: "8px 0 12px" }}>Alle drei Punkte sind erfüllt. {b.ansprechpartner?.name ?? "Ihre Ansprechperson"} bereitet den Antrag bei der Bank vor.</p>}
          </div>
        </section>
      )}

      <p className="ap-fuss ap-auf v4">Ziel: Kreditkarte. Über Karte und Rahmen entscheidet die Bank.{b.karte?.verschickt ? " Der Antrag liegt beim Kartenpartner." : ""}<br />Ihr Weg geht nie zurück: Ein erledigter Schritt bleibt erledigt.</p>
    </>
  );
}
