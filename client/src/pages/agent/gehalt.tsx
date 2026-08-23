// ═══════════════════════════════════════════════════════════════════════════
// /agent/gehalt — Gehaltsrechner (23.08.2026, Justin: „was der Mitarbeiter wie
// verdient, wenn er X Kunden am Tag abschließt – cinematisch, High-End")
//
// Modell (E-036): Bonitätsmanager erhält SATZ % jeder bezahlten Rate seiner
// Kunden, 12 Monate, plus Boni. Haltequote wie im Plan §10.3 (80 % Rate 2,
// danach 92 % je Monat). Paketmix aus dem Kontoauszug Juli/August. Der Satz
// kommt später aus den Admin-Einstellungen (/api/fiaon/agent/provision-satz),
// Standard 25 %.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";
import { AgentShell, api } from "./shared";
import { useOffice } from "./OfficeShell";
import { PAKETE } from "@shared/fiaon-pakete";
import "@/styles/office-gehalt.css";

const MIX_STANDARD: Record<string, number> = { start: 69, pro: 108, ultra: 67, highend: 93 };
const BONI = [
  { titel: "Quartalsbonus", betrag: 500, wann: "≥ 85 % der Raten im eigenen Stamm pünktlich" },
  { titel: "100 aktive Kunden", betrag: 1500, wann: "einmalig, bei Erreichen" },
  { titel: "500 aktive Kunden", betrag: 5000, wann: "einmalig, bei Erreichen" },
];
const euro = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const SCHUFA_BONUS = 10; // E-042: 10 € je 74-€-SCHUFA-Zahlung im Onboarding
const REAKT_ANTEIL = 0.5; // E-042: 50 % des Zahlungswerts je reaktivierter überfälliger Rate

function rechne(proTag: number, satz: number, mix: Record<string, number>, reaktWoche: number, tage = 21, r2 = 0.8, halt = 0.92) {
  const n = Object.values(mix).reduce((a, b) => a + b, 0) || 1;
  const avg = Object.entries(mix).reduce((s, [k, c]) => s + (PAKETE.find((p) => p.key === k)?.preisCents ?? 0) * c, 0) / n / 100;
  const proMonat = proTag * tage; const monate: { m: number; geld: number; aktiv: number }[] = [];
  const schufaMonat = proMonat * SCHUFA_BONUS;               // jeder neue Kunde zahlt die 74 € im Onboarding
  const reaktMonat = reaktWoche * 4.33 * avg * REAKT_ANTEIL; // Reaktivierungen: 50 % der zurückgeholten Rate
  for (let m = 1; m <= 12; m++) {
    let geld = schufaMonat + reaktMonat, aktiv = 0;
    for (let alter = 0; alter < m; alter++) { const anteil = alter === 0 ? 1 : r2 * Math.pow(halt, alter - 1); geld += proMonat * anteil * avg * satz; aktiv += proMonat * anteil; }
    monate.push({ m, geld, aktiv });
  }
  return { avg, proMonat, schufaMonat, reaktMonat, monate, jahr: monate.reduce((s, x) => s + x.geld, 0) };
}

export default function AgentGehaltPage() { return <AgentShell><GehaltInnen /></AgentShell>; }

function GehaltInnen() {
  const { dunkel, titel } = useOffice();
  useEffect(() => { dunkel(true); titel("Earnings"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [basisSatz, setBasisSatz] = useState(0.25);
  const [zertifikat, setZertifikat] = useState(false); // Academy bestanden → +5 Punkte (E-040)
  const [proTag, setProTag] = useState(5);
  const [reaktWoche, setReaktWoche] = useState(0);
  const [mix, setMix] = useState<Record<string, number>>(MIX_STANDARD);
  useEffect(() => { api("/agent/provision-satz").then((r) => { if (r.ok && r.json?.satz) setBasisSatz(Number(r.json.satz)); }).catch(() => {}); }, []);
  const satz = basisSatz + (zertifikat ? 0.05 : 0);
  const e = useMemo(() => rechne(proTag, satz, mix, reaktWoche), [proTag, satz, mix, reaktWoche]);
  const max = Math.max(...e.monate.map((x) => x.geld), 1);
  const m12 = e.monate[11], m6 = e.monate[5], m3 = e.monate[2], m1 = e.monate[0];

  return (
    <>
      <div className="gh">
        <section className="gh-hero">
          <span className="gh-pille">Dein Verdienst · {Math.round(satz * 100)} % jeder bezahlten Rate</span>
          <h1>Was du verdienst, wenn du <span className="gh-verlauf">dranbleibst.</span></h1>
          <p>Vier Bausteine: {Math.round(satz * 100)} % jeder Rate, die dein Kunde bezahlt – zwölf Monate lang, auch bei Verlängerung. Dazu {SCHUFA_BONUS} € für jede 74-€-Auskunftszahlung im Onboarding, 50 % jeder überfälligen Rate, die du zurückholst – und nach der Academy-Prüfung dauerhaft 5 Punkte mehr auf alles.</p>
        </section>

        <section className="gh-bausteine">
          {[
            [`${Math.round(satz * 100)} %`, "je bezahlter Paket-Rate", "ab der Startzahlung, 12 Monate, auch Verlängerung"],
            [`${SCHUFA_BONUS} €`, "je SCHUFA-Zahlung (74 €)", "Ziel jedes Onboarding-Termins; entfällt, wenn schon bezahlt"],
            ["50 %", "je reaktivierter Rate", "überfälligen Kunden weich zurückholen – die halbe Rate gehört dir"],
            ["+5 %", "mit Academy-Zertifikat", "Zertifizierter Bonitätsmanager: dauerhaft auf alle Raten"],
          ].map(([z, t, u], i) => (
            <div key={String(t)} className="gh-baustein" style={{ animationDelay: `${i * 70}ms` }}><b>{z}</b><span>{t}</span><small>{u}</small></div>
          ))}
        </section>

        <section className="gh-regler">
          <div className="gh-regler-kopf"><b>Abschlüsse pro Tag</b><span className="gh-zahl">{proTag}</span></div>
          <input type="range" min={1} max={50} step={1} value={proTag} onChange={(ev) => setProTag(Number(ev.target.value))} aria-label="Abschlüsse pro Tag" />
          <div className="gh-skala">{[1, 5, 10, 20, 30, 40, 50].map((n) => <span key={n} className={n === 5 ? "ziel" : ""} style={{ left: `${((n - 1) / 49) * 100}%` }}>{n}{n === 5 ? " · Min." : ""}</span>)}</div>
          <small>{e.proMonat} Abschlüsse im Monat (21 Arbeitstage) · Ø Rate {e.avg.toFixed(2).replace(".", ",")} € nach eurem echten Paketmix · Haltequote 80 % ab Rate 2, danach 92 % je Monat · dazu {euro(e.schufaMonat)} SCHUFA-Boni im Monat</small>
          <div className="gh-nebenregler">
            <label className="gh-schalter"><input type="checkbox" checked={zertifikat} onChange={(ev) => setZertifikat(ev.target.checked)} /><span>Mit Academy-Zertifikat rechnen ({Math.round((basisSatz + 0.05) * 100)} % statt {Math.round(basisSatz * 100)} %)</span></label>
            <label className="gh-reakt"><span>Reaktivierungen pro Woche (überfällige Kunden, die zahlen)</span><input type="range" min={0} max={25} value={reaktWoche} onChange={(ev) => setReaktWoche(Number(ev.target.value))} /><em>{reaktWoche} · {euro(e.reaktMonat)}/Monat</em></label>
          </div>
        </section>

        <section className="gh-zahlen">
          {[["Monat 1", m1.geld, "erste Startzahlungen"], ["Monat 3", m3.geld, `${Math.round(m3.aktiv)} zahlende Kunden`], ["Monat 6", m6.geld, `${Math.round(m6.aktiv)} zahlende Kunden`], ["Monat 12", m12.geld, `${Math.round(m12.aktiv)} zahlende Kunden`]].map(([t, g, u], i) => (
            <div key={String(t)} className={`gh-karte${i === 3 ? " hervor" : ""}`} style={{ animationDelay: `${i * 80}ms` }}><small>{t}</small><b>{euro(Number(g))}</b><span>{u}</span></div>
          ))}
        </section>

        <section className="gh-kurve">
          <div className="gh-kurve-kopf"><b>Dein Monatseinkommen wächst mit jedem Kunden, der bleibt.</b><span>Im ersten Jahr gesamt: <strong>{euro(e.jahr)}</strong></span></div>
          <div className="gh-balken">{e.monate.map((x) => <div key={x.m} className="gh-balken-spalte" title={`Monat ${x.m}: ${euro(x.geld)}`}><div className="gh-balken-wert" style={{ height: `${Math.max(4, (x.geld / max) * 100)}%` }}><em>{euro(x.geld)}</em></div><span>{x.m}</span></div>)}</div>
        </section>

        <section className="gh-mix">
          <div className="gh-mix-kopf"><b>Paketmix – was deine Kunden kaufen</b><small>Vorbelegt mit dem echten Mix aus Juli/August. Verschiebe, was du erwartest.</small></div>
          <div className="gh-mix-zeilen">
            {PAKETE.filter((p) => p.abo && p.art === "privat").map((p) => (
              <label key={p.key}><span>{p.label.replace("FIAON ", "").replace(" (Standard)", "")} · {(p.preisCents / 100).toFixed(2).replace(".", ",")} € → <b>{((p.preisCents / 100) * satz).toFixed(2).replace(".", ",")} € je Rate für dich</b></span><input type="range" min={0} max={200} value={mix[p.key] ?? 0} onChange={(ev) => setMix({ ...mix, [p.key]: Number(ev.target.value) })} /><em>{Math.round(((mix[p.key] ?? 0) / (Object.values(mix).reduce((a, b) => a + b, 0) || 1)) * 100)} %</em></label>
            ))}
          </div>
        </section>

        <section className="gh-boni">
          <div className="gh-mix-kopf"><b>Dazu kommen Boni</b><small>Für Qualität und Bindung – nicht für Anrufe.</small></div>
          <div className="gh-boni-raster">{BONI.map((b) => <div key={b.titel} className="gh-bonus"><b>{euro(b.betrag)}</b><span>{b.titel}</span><small>{b.wann}</small></div>)}</div>
        </section>

        <section className="gh-regeln">
          <div><b>Ausgezahlt wird, was angekommen ist.</b><p>Provision entsteht nur auf bankbestätigte Eingänge – die erste Zahlung eines Kunden ist immer eine direkte Überweisung. Den Stand siehst du jederzeit im Wallet. Auszahlung monatlich.</p></div>
          <div><b>Dein Kunde bleibt dein Kunde.</b><p>Vom ersten Gespräch bis zur zwölften Rate – und in der Verlängerung. Wer gut betreut, verdient länger.</p></div>
          <div><b>Kein Deckel.</b><p>Deine Kunden bleiben deine Kunden – egal wie viele. Wächst dein Stamm über das, was du allein betreuen kannst, bekommst du Unterstützung, keine Abzüge.</p></div>
        </section>
        <p className="gh-leise">Rechenmodell, keine Zusage: Die Zahlen hängen von deinen Abschlüssen, dem Paketmix und der Zahlungstreue deiner Kunden ab. Der Provisionssatz wird von der Geschäftsführung festgelegt und gilt ab Freigabe des neuen Office.</p>
      </div>
    </>
  );
}
