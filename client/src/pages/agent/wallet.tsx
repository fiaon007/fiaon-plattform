// ═══════════════════════════════════════════════════════════════════════════
// /agent/wallet — Raum „Wallet" (23.08.2026, Plan §4/§11)
//
// Vier Reiter in EINEM Raum, alle Funktionen der bisherigen Seiten:
//   Guthaben      ← verdienst.tsx   (/agent/earnings, /agent/abrechnungen,
//                                     /agent/wunschgehalt GET+POST)
//   Auszahlung    ← auszahlung.tsx  (/agent/payouts, POST /agent/payouts/request)
//   Leistung      ← leistung.tsx    (/agent/leistung?from&to)
//   Partnerprogramm ← partner-programm.tsx (/agent/partner-program,
//                                     POST /agent/partner-suggestions)
// Provisionssatz aus GET /agent/provision-satz. Alle Beträge kommen fertig
// gerechnet vom Server (Integer-Cents). Wording: „Ausgezahlt wird, was
// angekommen ist" — Provision nur auf bankbestätigte Raten. Kein Stripe:
// Zahlungen laufen über Bankeingang/GoCardless.
// Route: /agent/wallet/:reiter?  (guthaben | auszahlung | leistung | partner)
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { TrendingUp, CheckCircle2, Clock, Wallet, Award, ShieldCheck, Users, Send, Info, Target, HandCoins, BarChart3 } from "lucide-react";
import { AgentShell, api, fmtCents, fmtDT, fmtD, useFragen } from "./shared";
import { useOffice } from "./OfficeShell";
import "@/styles/office-wallet.css";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "./rundgaenge";
import "@/styles/office-rundgang.css";

type Reiter = "guthaben" | "auszahlung" | "leistung" | "partner";
const REITER: { key: Reiter; label: string; Icon: any }[] = [
  { key: "guthaben", label: "Guthaben & Provisionen", Icon: Wallet },
  { key: "auszahlung", label: "Auszahlung", Icon: HandCoins },
  { key: "leistung", label: "Leistung", Icon: BarChart3 },
  { key: "partner", label: "Partnerprogramm", Icon: Award },
];
const STATUS_TEXT: Record<string, [string, string]> = {
  pending_payment: ["Offen", ""], claimed_paid: ["Zahlung angekündigt", "warten"], paid: ["Bezahlt", "gut"],
  expired: ["Abgelaufen", ""], refunded: ["Erstattet", "schlecht"], superseded: ["Ersetzt (Dublette)", ""],
  bestaetigt: ["Bestätigt", "gut"], in_auszahlung: ["In Auszahlung", "warten"], ausgezahlt: ["Ausgezahlt", "gut"],
  storniert: ["Storniert", "schlecht"], angefordert: ["Angefordert", "warten"], abgelehnt: ["Abgelehnt", "schlecht"], potenziell: ["Potenziell", ""],
};
const Status = ({ status }: { status: string }) => { const [t, k] = STATUS_TEXT[status] ?? [status, ""]; return <span className={`wa-status ${k}`}>{t}</span>; };
const prozent = (bp: number) => (bp / 100).toLocaleString("de-DE");

export default function AgentWalletPage() { return <AgentShell><WalletInnen /></AgentShell>; }

function WalletInnen() {
  const { dunkel, titel } = useOffice();
  useEffect(() => { dunkel(true); titel("Wallet"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [location, navigate] = useLocation();
  const ausUrl = (): Reiter => { const s = location.replace(/^\/agent\/wallet\/?/, "").split(/[/?#]/)[0]; return (REITER.some((r) => r.key === s) ? s : "guthaben") as Reiter; };
  const [reiter, setReiter] = useState<Reiter>(ausUrl);
  useEffect(() => { setReiter(ausUrl()); }, [location]); // eslint-disable-line react-hooks/exhaustive-deps
  const wechseln = (r: Reiter) => { setReiter(r); if (location.startsWith("/agent/wallet")) navigate(`/agent/wallet/${r}`, { replace: true }); };

  const [satz, setSatz] = useState<number | null>(null);
  const [earnings, setEarnings] = useState<any>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const laden = useCallback(() => {
    setFehler(null);
    api("/agent/provision-satz").then((r) => { if (r.ok && r.json?.satz != null) setSatz(Number(r.json.satz)); }).catch(() => {});
    api("/agent/earnings").then((r) => { if (r.ok) setEarnings(r.json); else setFehler(r.json?.error || "Deine Zahlen kamen nicht vom Server."); }).catch(() => setFehler("Keine Verbindung zum Server."));
  }, []);
  useEffect(laden, [laden]);
  const satzText = satz != null ? `${Math.round(satz * 100)} %` : earnings ? `${prozent(earnings.rateBp)} %` : "25 %";

  return (
    <div className="wa">
      <section className="wa-kopf">
        <div>
          <span className="wa-pille">Wallet · {satzText} je bankbestätigter Rate</span>
          <h1>Ausgezahlt wird, was <span className="wa-verlauf">angekommen ist.</span></h1>
          <p>Deine Vergütung entsteht mit jeder Rate, die auf dem FIAON-Konto bestätigt ist: {satzText} je Paket-Rate, 10 € je Auskunftszahlung im Onboarding, 50 % je reaktivierter Rate aus dem Altbestand. Offene Beträge stehen als „potenziell" daneben. Auszahlung monatlich, ohne Obergrenze.</p>
        </div>
        <div className="wa-stand">
          <small>Guthaben · auszahlbar</small>
          <b>{earnings ? fmtCents(earnings.confirmedCents) : "–"}</b>
          <span>{earnings ? `${fmtCents(earnings.monthCents)} diesen Monat · ${fmtCents(earnings.paidOutCents)} bisher ausgezahlt` : "Lade …"}</span>
        </div>
      </section>

      <nav className="wa-reiter" aria-label="Bereiche">
        {REITER.map((r) => <button key={r.key} type="button" className={reiter === r.key ? "an" : ""} onClick={() => wechseln(r.key)}><r.Icon size={16} strokeWidth={1.75} />{r.label}</button>)}
      </nav>

      {fehler && <p className="wa-fehler">{fehler} <button type="button" className="wa-link" onClick={laden}>Erneut versuchen</button></p>}

      {reiter === "guthaben" && <Guthaben earnings={earnings} onWechsel={wechseln} />}
      {reiter === "auszahlung" && <Auszahlung />}
      {reiter === "leistung" && <Leistung />}
      {reiter === "partner" && <Partner />}
      {/* 24.08.2026: Rundgang je Raum (E-063). */}
      <Rundgang raum="wallet" titel={RUNDGAENGE.wallet.titel} schritte={RUNDGAENGE.wallet.schritte} />
    </div>
  );
}

// ── Reiter 1: Guthaben & Provisionen ───────────────────────────────────────
function Guthaben({ earnings, onWechsel }: { earnings: any; onWechsel: (r: Reiter) => void }) {
  const [abrechnungen, setAbrechnungen] = useState<any[] | null>(null);
  useEffect(() => { api("/agent/abrechnungen").then((r) => setAbrechnungen(r.ok ? r.json.abrechnungen || [] : [])).catch(() => setAbrechnungen([])); }, []);
  // ── Konto & Karte: was vorgemerkt liegt (24.08.2026) ─────────────────────
  // Justin: „wenn ja, dann muss es überall kommuniziert werden, alles
  // angepasst." Wer 10 € verdient hat, muss sie sehen — sonst glaubt er, es
  // gäbe sie nicht, und drückt den Knopf beim nächsten Kunden nicht mehr.
  // Bewusst als EIGENE Zeile und nicht in „Potenziell" eingerechnet: Das sind
  // zwei verschiedene Versprechen. „Potenziell" hängt an einer Rate, die der
  // Kunde noch zahlen muss; das hier hängt an einer Bestätigung, die der
  // Partner noch schickt.
  const [karte, setKarte] = useState<{ vorgemerkt: number; bestaetigt: number; anzahl: number } | null>(null);
  useEffect(() => {
    api("/agent/karte/verdienst").then((r) => { if (r.ok) setKarte(r.json.stand); }).catch(() => {});
  }, []);
  const e = earnings;
  return (
    <>
      <section className="wa-kacheln">
        {[
          ["Potenziell", e?.potentialCents, e ? `${e.potentialCount} offen · noch nicht bankbestätigt` : "", TrendingUp, ""],
          ["Bestätigt · Guthaben", e?.confirmedCents, "angekommen, auszahlbar", CheckCircle2, "hervor"],
          ["In Auszahlung", e?.inPayoutCents, "Anforderung läuft", Clock, ""],
          ["Ausgezahlt", e?.paidOutCents, "seit Beginn", Wallet, ""],
        ].map(([t, c, u, I, k], i) => { const Icon = I as any; return (
          <div key={String(t)} className={`wa-kachel ${k}`} style={{ animationDelay: `${i * 70}ms` }}><i><Icon size={18} strokeWidth={1.75} /></i><small>{t as string}</small><b>{c != null ? fmtCents(c as number) : "–"}</b><span>{u as string}</span></div>
        ); })}
      </section>

      {karte && (karte.vorgemerkt > 0 || karte.bestaetigt > 0) && (
        <section className="wa-block leicht wa-karte">
          <div className="wa-block-kopf">
            <b>Konto &amp; Karte</b>
            <small>{karte.anzahl} {karte.anzahl === 1 ? "Kunde" : "Kunden"} · 10 € je bestätigter Eröffnung</small>
          </div>
          <div className="wa-karte-zahlen">
            <div><small>Vorgemerkt</small><b>{fmtCents(karte.vorgemerkt)}</b><span>wartet auf die Bestätigung des Partners</span></div>
            <div><small>Bestätigt</small><b>{fmtCents(karte.bestaetigt)}</b><span>zählt zu deinem Guthaben</span></div>
          </div>
          <p className="wa-karte-satz">
            Der Partner meldet eine Eröffnung erst nach einigen Wochen endgültig und kann sie auch wieder
            streichen — deshalb steht sie bis dahin als vorgemerkt und nicht als Guthaben. Ruf deine Kunden
            ein paar Tage nach dem Versand an: Wer beim Video-Ident hängen bleibt, bricht ab und sagt es niemandem.
          </p>
        </section>
      )}

      {e?.monthlyGoalCents > 0 && (
        <section className="wa-block leicht">
          <div className="wa-block-kopf"><b>Monatsziel</b><small>{fmtCents(e.monthCents)} / {fmtCents(e.monthlyGoalCents)}</small></div>
          <div className="wa-balken"><i style={{ width: `${Math.min(100, Math.round((e.monthCents / e.monthlyGoalCents) * 100))}%` }} /></div>
        </section>
      )}



      <section className="wa-block">
        <div className="wa-block-kopf">
          <b>Deine Provisionen je Rate</b>
          {/* 24.08.2026: VORHER stand hier die Länge der gelieferten Liste als
              „N Buchungen". Die Abfrage im Server hat LIMIT 50. GEMESSEN bei
              Daniel Stripling (Konto 8): 276 Buchungen — die Überschrift sagte
              50. NACHHER nennt sie beides. */}
          <small>{e ? (e.entriesGesamt != null && Number(e.entriesGesamt) > e.entries.length
            ? `${e.entries.length} von ${e.entriesGesamt} Buchungen · die jüngsten zuerst`
            : `${e.entries.length} Buchungen`) : ""}{e?.overrideCents > 0 ? ` · davon Team-Beteiligung ${fmtCents(e.overrideCents)}` : ""}</small>
          <button type="button" className="wa-link" onClick={() => onWechsel("auszahlung")}>Auszahlung beantragen →</button>
        </div>
        {!e && <p className="wa-laedt">Lade …</p>}
        {e && e.entries.length === 0 && <p className="wa-leer">Hier erscheint jede Rate, sobald sie auf dem Konto angekommen ist.</p>}
        {e && e.entries.map((k: any) => {
          const bonus = k.kind === "feedback_bonus";
          const name = bonus ? "Feedback-Dankeschön" : k.company_name || [k.first_name, k.last_name].filter(Boolean).join(" ") || k.contact_name || k.payment_reference || k.ref;
          return (
            <div key={k.id} className="wa-zeile">
              <div className="wa-wer">
                <b>{name}{k.kind === "override" && <span className="wa-marke">Team-Beteiligung</span>}{bonus && <span className="wa-marke">Feedback-Bonus</span>}</b>
                <small>{bonus ? `Einmalige Gutschrift · ${fmtDT(k.created_at)}` : `${(k.pack_name || "—").replace(/\n/g, " ")} · ${fmtCents(k.base_amount_cents)} Rate · ${prozent(k.rate_bp)} % · ${fmtDT(k.created_at)}`}</small>
              </div>
              <div className="wa-geld"><b>{fmtCents(k.amount_cents)}</b><Status status={k.status} /></div>
            </div>
          );
        })}
      </section>

      <section className="wa-block leicht wa-belege">
        <div className="wa-block-kopf"><b>Deine Abrechnungen</b><small>{abrechnungen ? `${abrechnungen.length} Beleg(e)` : ""}</small></div>
        <p className="wa-hinweis">Zu jeder Auszahlung gehört eine Provisionsabrechnung – dein Buchungsbeleg für den Steuerberater.</p>
        {abrechnungen === null && <p className="wa-laedt">Lade …</p>}
        {abrechnungen && abrechnungen.length === 0 && <p className="wa-leer" style={{ marginTop: 10 }}>Noch keine Abrechnung. Sie entsteht, sobald deine erste Auszahlung freigegeben ist.</p>}
        {abrechnungen && abrechnungen.map((a) => (
          <div key={a.id} className="wa-zeile">
            <div className="wa-wer"><b>{a.nummer}{a.zustand === "ausgezahlt" && <span className="wa-marke">ausgezahlt{a.auszahlungAm ? ` ${fmtD(a.auszahlungAm)}` : ""}</span>}</b><small>{a.zeitraumVon ? fmtD(a.zeitraumVon) : "—"} · {a.positionen} Position(en)</small></div>
            <div className="wa-geld"><b>{fmtCents(a.betragCents)}</b></div>
            <a href={`/api/fiaon/agent/documents/statement/${a.id}.pdf`} target="_blank" rel="noreferrer" className={a.hatPdf ? "" : "aus"}>PDF ansehen</a>
          </div>
        ))}
      </section>
    </>
  );
}

// Wunschgehalt-Simulator (rechnet serverseitig, /agent/wunschgehalt)
function Wunschgehalt() {
  const [data, setData] = useState<any>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [annahmen, setAnnahmen] = useState(false);
  const laden = useCallback(async () => { const r = await api("/agent/wunschgehalt"); if (r.ok) { setData(r.json); if (r.json.desiredCents) setInput(String(Math.round(r.json.desiredCents / 100))); } }, []);
  useEffect(() => { laden(); }, [laden]);
  const speichern = async (cents: number) => { setBusy(true); const r = await api("/agent/wunschgehalt", { method: "POST", body: JSON.stringify({ amountCents: cents }) }); setBusy(false); if (r.ok) { setEditing(false); laden(); } };
  const absenden = (e: React.FormEvent) => { e.preventDefault(); const eur = Number(input.replace(",", ".")); if (isNaN(eur) || eur < 0) return; speichern(Math.round(eur * 100)); };
  if (!data) return null;
  const sim = data.sim; const hatZiel = data.desiredCents != null && data.desiredCents > 0;
  return (
    <section className="wa-block leicht">
      <div className="wa-block-kopf"><b><Target size={15} strokeWidth={1.75} style={{ verticalAlign: -2, marginRight: 8, color: "#93c5fd" }} />Mein Wunschgehalt diesen Monat</b>{hatZiel && !editing && <button type="button" className="wa-link" onClick={() => setEditing(true)}>Ändern</button>}</div>
      {(!hatZiel || editing) ? (
        <form onSubmit={absenden} className="wa-formzeile">
          <input className="wa-feld" type="number" min="0" step="50" inputMode="numeric" value={input} onChange={(e) => setInput(e.target.value)} placeholder="z. B. 3000 €" aria-label="Wunschgehalt in Euro" />
          <button type="submit" className="wa-knopf" disabled={busy || !input}>{busy ? "…" : "Speichern"}</button>
          {editing && <button type="button" className="wa-knopf still" onClick={() => setEditing(false)}>Abbrechen</button>}
        </form>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}><span className="wa-gross">{fmtCents(data.desiredCents)}</span><span className="wa-hinweis">bisher {fmtCents(data.monthCents)}</span></div>
          <div className="wa-balken"><i style={{ width: `${Math.min(100, (data.monthCents / data.desiredCents) * 100)}%` }} /></div>
          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            {sim?.achieved ? <p className="wa-text"><CheckCircle2 size={15} style={{ verticalAlign: -3, marginRight: 6, color: "#34d399" }} />Ziel erreicht – stark. Alles Weitere ist Bonus.</p>
            : sim && !sim.reachable ? (
              <>
                <p className="wa-text">Mit deinem aktuellen Schnitt ist <b>{fmtCents(data.desiredCents)}</b> in diesem Monat nicht erreichbar – setz dir ein Zwischenziel.</p>
                <p className="wa-hinweis">Dafür wären rund <b style={{ color: "#fff" }}>{sim.perWorkday}</b> Abschlüsse pro Werktag nötig. Die beste Tagesleistung im Team lag zuletzt bei {sim.ceilingPerWorkday}.</p>
                {sim.suggestedCents != null && <button type="button" className="wa-zwischenziel" disabled={busy} onClick={() => speichern(sim.suggestedCents)}><small>Realistisches Zwischenziel</small><b>{fmtCents(sim.suggestedCents)}<em>übernehmen</em></b></button>}
              </>
            ) : sim ? (
              <>
                <p className="wa-text">Für <b>{fmtCents(data.desiredCents)}</b> brauchst du noch <span className="blau">{sim.dealsNeeded} Abschlüsse</span> – ca. <b>{sim.perWorkday}</b> pro verbleibendem Werktag ({sim.workdaysLeft} Werktage), heute noch <b>~{sim.todayTarget}</b>.</p>
                {sim.segments?.length > 1 && <div className="wa-chips">{sim.segments.map((s: any, i: number) => <span key={i} className="wa-chip">{s.deals}× zu {prozent(s.rateBp)} % ({s.label})</span>)}</div>}
              </>
            ) : <p className="wa-hinweis">Noch keine Datenbasis für die Berechnung.</p>}
            {sim && !sim.achieved && (
              <div>
                <button type="button" className="wa-link" onClick={() => setAnnahmen((v) => !v)} aria-expanded={annahmen}><Info size={13} /> Wie wird das gerechnet?</button>
                {annahmen && <p className="wa-hinweis" style={{ marginTop: 6 }}>Gerechnet wird mit einem Ø-Auftragswert von <b style={{ color: "#fff" }}>{fmtCents(sim.avgDealCents)}</b> ({sim.avgSource}), deinem aktuellen Provisionssatz inklusive Partnerstatus-Zuschlag und den Meilenstein-Sprüngen, die während des Monats greifen.{sim.avgThin && " Du hast noch zu wenige eigene Abschlüsse für einen eigenen Schnitt – deshalb der Team-Wert."} Boni und Team-Beteiligungen zählen zu deinem Verdienst, aber nicht als Abschluss. Orientierung – keine Zusage.</p>}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

// ── Reiter 2: Auszahlung ───────────────────────────────────────────────────
// Der Knopf erzeugt NUR eine Anforderung – er löst nie eine Überweisung aus.
// Immer das volle Guthaben, nur mit Bankdaten und ab Mindestbetrag.
function Auszahlung() {
  const fragen = useFragen();
  const [data, setData] = useState<any>(null);
  const [meldung, setMeldung] = useState<{ art: "gut" | "schlecht"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const laden = useCallback(() => { api("/agent/payouts").then((r) => { if (r.ok) setData(r.json); else setMeldung({ art: "schlecht", text: r.json?.error || "Auszahlungsdaten konnten nicht geladen werden." }); }).catch(() => setMeldung({ art: "schlecht", text: "Keine Verbindung." })); }, []);
  useEffect(laden, [laden]);
  if (!data) return <p className="wa-laedt">{meldung?.text || "Lade …"}</p>;
  const offen = data.history.some((h: any) => h.status === "angefordert");
  const kann = data.hasBank && data.balanceCents >= data.minCents && !offen;
  const beantragen = async () => {
    const ja = await fragen({ titel: "Auszahlung beantragen?", text: `Du forderst dein gesamtes verfügbares Guthaben von ${fmtCents(data.balanceCents)} an.`, folge: `Es wird nur eine Anforderung erstellt – es fließt noch kein Geld. Nach der Prüfung überweist FIAON manuell${data.ibanMasked ? ` auf ${data.ibanMasked}` : ""}, in der Regel innerhalb von 5 Werktagen. Du erhältst dann eine E-Mail.`, ja: "Auszahlung beantragen" });
    if (!ja) return;
    setBusy(true);
    const r = await api("/agent/payouts/request", { method: "POST" });
    setBusy(false);
    if (r.ok) { setMeldung({ art: "gut", text: "Auszahlung beantragt – du findest sie unten im Verlauf. Die Überweisung erfolgt nach Prüfung manuell." }); laden(); }
    else setMeldung({ art: "schlecht", text: r.json?.error || "Fehler" });
  };
  return (
    <>
      {meldung && <p className={`wa-meldung ${meldung.art === "schlecht" ? "schlecht" : ""}`}>{meldung.text}</p>}
      <section className="wa-kacheln" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
        <div className="wa-kachel hervor"><i><Wallet size={18} strokeWidth={1.75} /></i><small>Verfügbares Guthaben</small><b>{fmtCents(data.balanceCents)}</b><span>Summe bankbestätigter Provisionen</span></div>
        <div className="wa-kachel"><i><ShieldCheck size={18} strokeWidth={1.75} /></i><small>Mindestbetrag</small><b>{fmtCents(data.minCents)}</b><span>für eine Auszahlung</span></div>
      </section>
      <section className="wa-block">
        <button type="button" className="wa-knopf breit" disabled={!kann || busy} onClick={beantragen} style={{ minHeight: 50 }}>{busy ? "Beantrage …" : `Auszahlung beantragen (${fmtCents(data.balanceCents)})`}</button>
        <div style={{ display: "grid", gap: 6, marginTop: 12 }}>
          {!data.hasBank && <p className="wa-hinweis">Bitte zuerst <Link href="/agent/more/profil" className="wa-link">Auszahlungsdaten im Profil</Link> hinterlegen.</p>}
          {data.hasBank && data.balanceCents < data.minCents && <p className="wa-hinweis">Guthaben liegt unter dem Mindestbetrag von {fmtCents(data.minCents)}.</p>}
          {offen && <p className="wa-hinweis">Eine Anforderung läuft bereits und wird gerade geprüft.</p>}
          {data.ibanMasked && <p className="wa-hinweis">Auszahlung auf <span style={{ fontFamily: "ui-monospace, Menlo, monospace", color: "#e5e7eb" }}>{data.ibanMasked}</span></p>}
          <p className="wa-hinweis">Auszahlungen werden nach Prüfung manuell überwiesen, in der Regel innerhalb von 5 Werktagen.</p>
        </div>
      </section>
      <section className="wa-block leicht">
        <div className="wa-block-kopf"><b>Verlauf</b><small>{data.history.length} Anforderung(en)</small></div>
        {data.history.length === 0 && <p className="wa-leer">Noch keine Auszahlungen.</p>}
        {data.history.map((h: any) => (
          <div key={h.id} className="wa-zeile">
            <div className="wa-wer"><b>{fmtCents(h.amount_cents)}</b><small>Beantragt {fmtDT(h.requested_at)}{h.processed_at ? ` · Verarbeitet ${fmtDT(h.processed_at)}` : ""}{h.iban_masked ? ` · ${h.iban_masked}` : ""}{h.reject_reason ? ` · Grund: ${h.reject_reason}` : ""}</small></div>
            <div className="wa-geld"><Status status={h.status} /></div>
          </div>
        ))}
      </section>
    </>
  );
}

// ── Reiter 3: Leistung (Spiegelansicht – dieselben Zahlen wie die Verwaltung) ─
const OUTCOME_LABEL: Record<string, string> = { erreicht_interesse: "Erreicht – Interesse", erreicht_kein_interesse: "Erreicht – kein Interesse", nicht_erreicht: "Nicht erreicht", mailbox: "Mailbox", rueckruf_termin: "Rückruf-Termin", nummer_falsch: "Nummer falsch" };
type Zeitraum = "heute" | "7t" | "30t";
function Leistung() {
  const [zeitraum, setZeitraum] = useState<Zeitraum>("30t");
  const range = useMemo(() => { const now = new Date(); const tage = zeitraum === "heute" ? 1 : zeitraum === "7t" ? 7 : 30; const from = new Date(now.getTime() - tage * 864e5); if (zeitraum === "heute") from.setHours(0, 0, 0, 0); return { from: from.toISOString(), to: now.toISOString() }; }, [zeitraum]);
  const [me, setMe] = useState<any>(null);
  const [team, setTeam] = useState<any>(null);
  const [laedt, setLaedt] = useState(true);
  useEffect(() => { setLaedt(true); api(`/agent/leistung?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`).then((r) => { if (r.ok) { setMe(r.json.me); setTeam(r.json.teamAvg); } }).finally(() => setLaedt(false)); }, [range]);
  return (
    <>
      <div className="wa-transparenz"><ShieldCheck size={16} strokeWidth={1.75} /><span><b>Volle Transparenz:</b> Hier stehen ausschließlich Ergebnisse, die du selbst dokumentierst (Akten, Kontakt-Ergebnisse, Links, Abschlüsse) – exakt die Zahlen, die auch die Verwaltung sieht. Keine Arbeitszeit-, Pausen- oder Anwesenheits-Erfassung.</span></div>
      <div className="wa-wahl">{([["heute", "Heute"], ["7t", "7 Tage"], ["30t", "30 Tage"]] as [Zeitraum, string][]).map(([k, l]) => <button key={k} type="button" className={zeitraum === k ? "an" : ""} onClick={() => setZeitraum(k)}>{l}</button>)}</div>
      {laedt ? <p className="wa-laedt">Lade …</p> : !me ? <section className="wa-block leicht"><p className="wa-leer">Noch keine dokumentierte Aktivität im Zeitraum – sobald du Akten übernimmst und Ergebnisse dokumentierst, erscheinen hier deine Zahlen.</p></section> : (
        <>
          <section className="wa-kacheln drei">
            {([["Übernommene Akten", me.akten], ["Dokumentierte Kontakte", me.kontakte], ["Antragslinks gesendet", me.links], ["Konversionen", me.konversionen], ["Abschlüsse", me.abschluesse], ["Umsatz", fmtCents(me.umsatzCents)]] as [string, any][]).map(([l, v], i) => <div key={l} className="wa-kachel klein" style={{ animationDelay: `${i * 50}ms` }}><small>{l}</small><b>{v ?? "—"}</b></div>)}
          </section>
          <section className="wa-kacheln drei">
            <div className="wa-kachel klein"><small>Reaktionszeit</small><b>{me.reaktionStunden != null ? `${me.reaktionStunden} h` : "—"}</b><span>Ø Lead-Eingang → dein erster Kontakt</span></div>
            <div className="wa-kachel klein"><small>Rückgabequote</small><b>{me.rueckgabeQuote != null ? `${me.rueckgabeQuote} %` : "—"}</b><span>Akten ohne Ergebnis geschlossen</span></div>
            <div className="wa-kachel klein hervor"><small>Provision</small><b>{fmtCents(me.provisionCents)}</b><span>im Zeitraum gebucht</span></div>
          </section>
          {Object.keys(me.outcomes || {}).length > 0 && (
            <section className="wa-block leicht"><div className="wa-block-kopf"><b>Deine Kontakt-Ergebnisse nach Typ</b></div><div className="wa-chips">{Object.entries(me.outcomes).map(([k, v]) => <span key={k} className="wa-chip">{OUTCOME_LABEL[k] || k} <b>{v as number}</b></span>)}</div></section>
          )}
          {team && (
            <section className="wa-block leicht"><div className="wa-block-kopf"><b>Zur Einordnung: Team-Durchschnitt</b><small>ohne Namen</small></div><div className="wa-team"><div><b>{team.kontakte}</b><small>Kontakte</small></div><div><b>{team.abschluesse}</b><small>Abschlüsse</small></div><div><b>{fmtCents(team.umsatzCents)}</b><small>Umsatz</small></div></div></section>
          )}
          <p className="wa-leise">Zeitraum: {fmtD(range.from)} – {fmtD(range.to)}</p>
        </>
      )}
    </>
  );
}

// ── Reiter 4: Partnerprogramm ──────────────────────────────────────────────
// Partnerstatus aus kumuliertem bestätigtem Eigenumsatz, Meilensteine,
// Team-Umsatzbeteiligung (eine Ebene), „Partner vorschlagen" (Admin prüft).
function Partner() {
  const [data, setData] = useState<any>(null);
  const [meldung, setMeldung] = useState<{ art: "gut" | "schlecht"; text: string } | null>(null);
  const [offen, setOffen] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", reason: "" });
  const [busy, setBusy] = useState(false);
  const laden = useCallback(() => { api("/agent/partner-program").then((r) => { if (r.ok) setData(r.json); else setMeldung({ art: "schlecht", text: r.json?.error || "Partnerprogramm konnte nicht geladen werden." }); }).catch(() => setMeldung({ art: "schlecht", text: "Keine Verbindung." })); }, []);
  useEffect(laden, [laden]);
  if (!data) return <p className="wa-laedt">{meldung?.text || "Lade …"}</p>;
  const { status, revenueCents, next, thresholds, milestones, team, suggestions } = data;
  let prevMin = 0; for (const t of thresholds) if (revenueCents >= t.minCents) prevMin = t.minCents;
  const pct = next ? Math.max(0, Math.min(100, ((revenueCents - prevMin) / (next.minCents - prevMin)) * 100)) : 100;
  const erreicht = new Set((milestones || []).map((m: any) => m.milestone_key));
  const STATUS_LABEL: Record<string, string> = { offen: "In Prüfung", angenommen: "Angenommen", abgelehnt: "Abgelehnt" };
  const einreichen = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) { setMeldung({ art: "schlecht", text: "Vorname, Nachname und E-Mail erforderlich" }); return; }
    setBusy(true);
    const r = await api("/agent/partner-suggestions", { method: "POST", body: JSON.stringify(form) });
    setBusy(false);
    if (r.ok) { setForm({ firstName: "", lastName: "", email: "", phone: "", reason: "" }); setOffen(false); setMeldung({ art: "gut", text: "Vorschlag eingereicht – das Admin-Team prüft die Anfrage." }); laden(); }
    else setMeldung({ art: "schlecht", text: r.json?.error || "Fehler" });
  };
  return (
    <>
      {meldung && <p className={`wa-meldung ${meldung.art === "schlecht" ? "schlecht" : ""}`}>{meldung.text}</p>}
      <section className="wa-block">
        <div className="wa-statusbox">
          <div><small>Aktueller Partnerstatus</small><div className="titel"><Award size={24} strokeWidth={1.5} />{status.label}</div>{status.bonusBp > 0 && <p className="wa-hinweis" style={{ marginTop: 6 }}>+{prozent(status.bonusBp)} Prozentpunkte auf neue Abschlüsse</p>}</div>
          <div className="rechts"><small>Bestätigter Eigenumsatz</small><span className="wa-gross">{fmtCents(revenueCents)}</span></div>
        </div>
        {next ? (<><div className="wa-fortschritt"><b style={{ fontWeight: 500, color: "#fff" }}>Nächster Meilenstein: {next.label}</b><span>Noch {fmtCents(next.remainingCents)}</span></div><div className="wa-balken"><i style={{ width: `${pct}%` }} /></div></>) : <p className="wa-hinweis" style={{ marginTop: 12 }}>Höchster Meilenstein erreicht.</p>}
      </section>

      <section className="wa-meilensteine">
        <Meilenstein label="Partner" min="Start" bonus="Basis-Provisionssatz laut Vertrag" praemie={null} erreicht aktiv={status.key === "partner"} />
        {thresholds.map((t: any) => <Meilenstein key={t.key} label={t.label} min={`ab ${fmtCents(t.minCents)}`} bonus={`+${prozent(t.bonusBp)} Prozentpunkte auf künftige Abschlüsse`} praemie={t.prize} erreicht={revenueCents >= t.minCents || erreicht.has(t.key)} aktiv={status.key === t.key} />)}
      </section>

      {team?.members > 0 && (
        <section className="wa-block leicht">
          <div className="wa-block-kopf"><b><Users size={15} strokeWidth={1.75} style={{ verticalAlign: -2, marginRight: 8, color: "#93c5fd" }} />Mein Team</b><small>anonym aggregiert</small></div>
          <div className="wa-team"><div><b>{team.members}</b><small>geworbene Partner · {team.deals} Abschlüsse</small></div><div><b>{fmtCents(team.revenueCents)}</b><small>Team-Umsatz</small></div><div><b style={{ color: "#93c5fd" }}>{fmtCents(team.overrideCents)}</b><small>deine Beteiligung · fließt ins Guthaben</small></div></div>
        </section>
      )}

      <section className="wa-block">
        <div className="wa-block-kopf"><b>Partner vorschlagen</b>{!offen && <button type="button" className="wa-knopf klein" onClick={() => setOffen(true)}><Send size={14} strokeWidth={1.75} /> Vorschlagen</button>}</div>
        <p className="wa-hinweis">Du kennst jemanden, der zu FIAON passt? Das Admin-Team prüft jeden Vorschlag. Wird die Person Partner, erhältst du eine Umsatzbeteiligung an ihren Abschlüssen.</p>
        {offen && (
          <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
            <div className="wa-raster2"><input className="wa-feld" placeholder="Vorname *" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} /><input className="wa-feld" placeholder="Nachname *" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} /></div>
            <div className="wa-raster2"><input className="wa-feld" type="email" placeholder="E-Mail *" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /><input className="wa-feld" type="tel" placeholder="Telefon (+49 …)" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></div>
            <textarea className="wa-feld" rows={3} placeholder="Warum passt die Person zu FIAON?" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
            <div className="wa-formzeile"><button type="button" className="wa-knopf" disabled={busy} onClick={einreichen}>{busy ? "Sendet …" : "Vorschlag einreichen"}</button><button type="button" className="wa-knopf still" onClick={() => setOffen(false)}>Abbrechen</button></div>
          </div>
        )}
        {suggestions?.length > 0 && (
          <div className="wa-vorschlaege">
            <small style={{ font: "500 10.5px/1 Inter, sans-serif", letterSpacing: ".14em", textTransform: "uppercase", color: "#93c5fd" }}>Deine Vorschläge</small>
            {suggestions.map((s: any) => <div key={s.id} className="wa-vorschlag"><span>{s.first_name} {s.last_name}</span><span className={`wa-status ${s.status === "angenommen" ? "gut" : s.status === "abgelehnt" ? "schlecht" : "warten"}`}>{STATUS_LABEL[s.status] || s.status}</span></div>)}
          </div>
        )}
      </section>
    </>
  );
}

function Meilenstein({ label, min, bonus, praemie, erreicht, aktiv }: { label: string; min: string; bonus: string; praemie: { title: string; description?: string } | null; erreicht: boolean; aktiv: boolean }) {
  return (
    <div className={`wa-meilenstein${erreicht ? " erreicht" : ""}${aktiv ? " aktiv" : ""}`}>
      <header><b>{label}</b>{erreicht && <CheckCircle2 size={16} strokeWidth={1.75} />}</header>
      <small>{min}</small>
      <p>{bonus}</p>
      {praemie && <p className="praemie"><b>Meilenstein-Prämie:</b> {praemie.title}</p>}
    </div>
  );
}
