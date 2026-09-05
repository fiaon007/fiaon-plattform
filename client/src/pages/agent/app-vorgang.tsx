// ═══════════════════════════════════════════════════════════════════════════
// /agent/app-vorgaenge/:id — ein Vorgang aus dem neuen Kundenbereich, gesehen
// vom Mitarbeiter (05.09.2026, Scheibe 5). Drei Handgriffe, sonst nichts:
//   1. Antrag versendet → Versand bestätigen (Empfänger, „Wir fragen nach am“)
//   2. Ergebnis eintragen (bewilligt/abgelehnt, Betrag, ein Satz für den Kunden)
//   3. Zwei Sätze für den Kunden (Brief: „Das haben wir daraus gemacht“)
// Der Kunde sieht jede Eintragung sofort unter Vorgänge — in Sie-Form, deshalb
// stehen die Kundensätze hier in Sie-Form; der Mitarbeiter wird geduzt wie im Rest
// des Office. Erreichbar aus dem Auftrag beim Betreuer und aus der Akte.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { AgentShell, api, fmtCents } from "./shared";
import { useOffice } from "./OfficeShell";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "./rundgaenge";
import "@/styles/office-app-vorgang.css";

interface Dok { id: number; art: string; dateiname: string; am: string | null; bytes: number }
interface Ereignis { art: string; am: string | null; text: string | null; textFuerKunden: string | null; agentName: string | null }
interface Vorgang {
  id: number; art: string; artTitel: string; titel: string; stand: string; standText: string | null; aktenzeichen: string | null;
  empfaengerName: string | null; empfaengerAdresse: string | null; versandtAm: string | null; fristAm: string | null; erinnertAm: string | null; eskaliertAm: string | null;
  createdAt: string | null; notizKunde: string | null; betragCents: number | null; monatlich: boolean | null;
  kunde: { ref: string; name: string; personId: number; telefon: string | null; email: string | null };
  regel: { titel: string; stelle: string; rechtsgrundlage: string } | null;
  dokumente: Dok[]; zeitleiste: Ereignis[]; schreibenHtml: string | null;
}

const STAND: Record<string, string> = { eingegangen: "Eingegangen – noch nicht gelesen", gelesen: "Gelesen", entwurf: "Entwurf", unterschrift_offen: "Wartet auf Unterschrift des Kunden", versandbereit: "Unterschrieben – bitte versenden und quittieren", versandt: "Versandt – wartet auf Antwort", nachfrage: "Überfällig – nachgefragt", bewilligt: "Bewilligt", abgelehnt: "Abgelehnt", zurueckgezogen: "Zurückgezogen", erledigt: "Erledigt" };
const heutePlus = (tage: number) => { const d = new Date(); d.setDate(d.getDate() + tage); return d.toISOString().slice(0, 10); };

export default function AgentAppVorgangPage() { return <AgentShell><Innen /></AgentShell>; }

function Innen() {
  const { dunkel, titel } = useOffice();
  const [, params] = useRoute("/agent/app-vorgaenge/:id");
  const id = Number(params?.id || 0);
  const [v, setV] = useState<Vorgang | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [empfaenger, setEmpfaenger] = useState("");
  const [nachfrageAm, setNachfrageAm] = useState(heutePlus(21));
  const [ergebnis, setErgebnis] = useState<"bewilligt" | "abgelehnt">("bewilligt");
  const [betrag, setBetrag] = useState("");
  const [monatlich, setMonatlich] = useState(true);
  const [textKunde, setTextKunde] = useState("");
  const [notiz, setNotiz] = useState("");

  useEffect(() => { dunkel(true); titel("Vorgang"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const laden = () => {
    if (!id) { setFehler("Kein Vorgang angegeben."); return; }
    api(`/agent/app/vorgaenge/${id}`).then((r) => {
      if (r.ok && r.json?.ok) { setV(r.json.vorgang); setEmpfaenger(r.json.vorgang.empfaengerName || ""); }
      else setFehler(r.json?.error || "Dieser Vorgang lässt sich gerade nicht öffnen.");
    }).catch(() => setFehler("Dieser Vorgang lässt sich gerade nicht öffnen."));
  };
  useEffect(laden, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const post = async (pfad: string, body: any, okText: string) => {
    setBusy(true); setMeldung(null); setFehler(null);
    const r = await api(`/agent/app/vorgaenge/${id}/${pfad}`, { method: "POST", body: JSON.stringify(body) });
    setBusy(false);
    if (r.ok && r.json?.ok) { setMeldung(okText); laden(); } else setFehler(r.json?.error || "Das hat gerade nicht geklappt. Bitte noch einmal.");
  };

  if (fehler && !v) return <div className="av"><p className="av-fehler">{fehler}</p></div>;
  if (!v) return <div className="av"><p className="av-lade">Lädt …</p></div>;
  const istBrief = v.art === "brief";
  const cents = betrag.trim() ? Math.round(Number(betrag.replace(/\./g, "").replace(",", ".")) * 100) : null;

  return (
    <div className="av">
      <div className="av-kopf">
        <span className="av-pille">Vorgang aus dem Kundenbereich</span>
        <h1>{v.artTitel}{v.aktenzeichen ? <> · <span className="av-mono" style={{ fontSize: "0.6em", color: "#93c5fd" }}>{v.aktenzeichen}</span></> : null}</h1>
        <p>Kunde: <a href={`/admin/kunde/${encodeURIComponent(v.kunde.ref)}`}>{v.kunde.name}</a> · <span className="av-mono">{v.kunde.ref}</span>{v.kunde.telefon ? <> · <a href={`tel:${v.kunde.telefon}`}>{v.kunde.telefon}</a></> : null}{v.empfaengerName ? <> · an {v.empfaengerName}</> : null}</p>
      </div>

      {meldung && <p className="av-meldung">{meldung}</p>}
      {fehler && <p className="av-fehler">{fehler}</p>}

      <div className="av-karte">
        <small>Stand</small>
        <div className="av-stand"><b>{STAND[v.stand] ?? v.stand}</b>{v.standText && <span>{v.standText}</span>}</div>
        {v.versandtAm && <div className="av-zeile"><span>Versandt</span><b>{v.versandtAm}{v.empfaengerName ? ` an ${v.empfaengerName}` : ""}</b></div>}
        {v.fristAm && <div className="av-zeile"><span>Wir fragen nach am</span><b>{v.fristAm}</b></div>}
        {v.erinnertAm && <div className="av-zeile"><span>Nachgefragt</span><b>{v.erinnertAm}</b></div>}
        {v.betragCents != null && <div className="av-zeile"><span>Betrag</span><b className="av-mono">{fmtCents(v.betragCents)}{v.monatlich ? " im Monat" : ""}</b></div>}
        {v.regel && <div className="av-zeile"><span>Grundlage</span><b>{v.regel.rechtsgrundlage}</b></div>}
        {v.notizKunde && <div className="av-zeile"><span>Notiz des Kunden</span><b>„{v.notizKunde}“</b></div>}
      </div>

      {v.stand === "versandbereit" && (
        <div className="av-karte">
          <small>1 · Versand bestätigen</small>
          <h2>Du versendest das unterschriebene Schreiben und quittierst hier.</h2>
          <p className="av-hinweis">Das PDF liegt unten unter Dokumente. Der Kunde sieht danach: „Versandt am … an …, wir fragen nach am …“. Die Nachfrage ist unser eigener Termin, keine gesetzliche Frist.</p>
          <div className="av-form">
            <label>Empfänger<input className="av-feld" value={empfaenger} onChange={(e) => setEmpfaenger(e.target.value)} placeholder="z. B. Sparkasse Musterstadt, Kontoservice" /></label>
            <label>Wir fragen nach am<input className="av-feld" type="date" value={nachfrageAm} onChange={(e) => setNachfrageAm(e.target.value)} min={heutePlus(1)} /></label>
            <div className="av-knoepfe"><button type="button" className="av-knopf haupt" disabled={busy || empfaenger.trim().length < 3 || !nachfrageAm} onClick={() => void post("versandt", { empfaenger: empfaenger.trim(), fristAm: nachfrageAm }, "Versand quittiert. Der Kunde sieht es jetzt unter Vorgänge.")}>{busy ? "…" : "Versand bestätigen"}</button></div>
          </div>
        </div>
      )}

      {(v.stand === "versandt" || v.stand === "nachfrage") && !istBrief && (
        <div className="av-karte">
          <small>2 · Ergebnis eintragen</small>
          <h2>Antwort da? Trag das Ergebnis ein – der Kunde liest deinen Satz wörtlich.</h2>
          <div className="av-form">
            <div className="av-knoepfe">
              <button type="button" className={`av-knopf ${ergebnis === "bewilligt" ? "haupt" : ""}`} onClick={() => setErgebnis("bewilligt")}>Bewilligt</button>
              <button type="button" className={`av-knopf ${ergebnis === "abgelehnt" ? "haupt" : ""}`} onClick={() => setErgebnis("abgelehnt")}>Abgelehnt</button>
            </div>
            {ergebnis === "bewilligt" && (
              <>
                <label>Betrag laut Bescheid (Euro, leer lassen, wenn keiner genannt ist)<input className="av-feld" inputMode="decimal" value={betrag} onChange={(e) => setBetrag(e.target.value)} placeholder="z. B. 597,42" /></label>
                <label style={{ gridTemplateColumns: "auto 1fr", alignItems: "center", display: "flex", gap: 8 }}><input type="checkbox" checked={monatlich} onChange={(e) => setMonatlich(e.target.checked)} /> Betrag gilt monatlich</label>
              </>
            )}
            <label>Ein Satz für den Kunden (Sie-Form, keine Zusage, kein Rechtsrat)<textarea className="av-feld" value={textKunde} onChange={(e) => setTextKunde(e.target.value)} placeholder={ergebnis === "bewilligt" ? "z. B. Ihre Bank hat den höheren Freibetrag ab dem 1. Oktober bestätigt. Der Bescheid liegt in Ihrer Akte." : "z. B. Die Stelle hat abgelehnt, weil die Bescheinigung fehlte. Wir gehen den nächsten Schritt mit Ihnen durch."} /></label>
            <div className="av-knoepfe"><button type="button" className="av-knopf haupt" disabled={busy || textKunde.trim().length < 10 || (ergebnis === "bewilligt" && betrag.trim() !== "" && !(cents !== null && Number.isFinite(cents) && cents >= 0))} onClick={() => void post("ergebnis", { stand: ergebnis, betragCents: ergebnis === "bewilligt" ? cents : null, monatlich, textFuerKunden: textKunde.trim() }, "Ergebnis eingetragen. Der Kunde sieht es jetzt unter Vorgänge – und im Monatsbericht.")}>{busy ? "…" : "Ergebnis eintragen"}</button></div>
          </div>
        </div>
      )}

      {(istBrief || v.stand === "versandt" || v.stand === "nachfrage" || v.stand === "bewilligt" || v.stand === "abgelehnt") && (
        <div className="av-karte">
          <small>{istBrief ? "Brief · Das haben wir daraus gemacht" : "3 · Zwei Sätze für den Kunden"}</small>
          <h2>{istBrief ? "Sag dem Kunden in zwei Sätzen, was wir aus seinem Brief machen." : "Zwischenstand für den Kunden – erscheint wörtlich in seinem Bereich."}</h2>
          <p className="av-hinweis">Sie-Form. Sag, was wir tun und bis wann du dich meldest – nicht, was der Brief „bedeutet“, und keine Zusage über das Ergebnis.</p>
          <div className="av-form">
            <textarea className="av-feld" value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="z. B. Es ist eine Zahlungsaufforderung eines Inkassobüros. Wir prüfen die Forderung gegen Ihre Auskunft und melden uns bis Donnerstag hier." />
            <div className="av-knoepfe">
              <button type="button" className="av-knopf haupt" disabled={busy || notiz.trim().length < 10} onClick={() => void post("notiz", { textFuerKunden: notiz.trim(), stand: istBrief && v.stand === "eingegangen" ? "gelesen" : undefined }, "Gespeichert. Der Kunde sieht den Satz jetzt unter Vorgänge.")}>{busy ? "…" : "Für den Kunden speichern"}</button>
              {istBrief && v.stand !== "erledigt" && <button type="button" className="av-knopf" disabled={busy} onClick={() => void post("notiz", { textFuerKunden: notiz.trim() || null, stand: "erledigt" }, "Brief als erledigt markiert.")}>Brief erledigt</button>}
            </div>
          </div>
        </div>
      )}

      {v.dokumente.length > 0 && (
        <div className="av-karte">
          <small>Dokumente</small>
          <ul className="av-liste">
            {v.dokumente.map((d) => <li key={d.id}><span>{d.art} · {d.dateiname}</span><a href={`/api/fiaon/agent/app/dokument/${d.id}`} target="_blank" rel="noopener noreferrer">Öffnen{d.am ? ` · ${d.am}` : ""}</a></li>)}
          </ul>
        </div>
      )}

      {v.schreibenHtml && (
        <div className="av-karte">
          <small>Das Schreiben des Kunden</small>
          <div className="av-schreiben" dangerouslySetInnerHTML={{ __html: v.schreibenHtml }} />
        </div>
      )}

      <div className="av-karte">
        <small>Verlauf</small>
        <ul className="av-zeit">
          {v.zeitleiste.map((e, i) => <li key={i}><span /><div><b>{e.text || e.art}</b>{e.textFuerKunden && <small>Für den Kunden: „{e.textFuerKunden}“</small>}<small>{e.am ?? ""}{e.agentName ? ` · ${e.agentName}` : ""}</small></div></li>)}
        </ul>
      </div>

      <Rundgang raum="appVorgang" titel={RUNDGAENGE.appVorgang.titel} schritte={RUNDGAENGE.appVorgang.schritte} />
    </div>
  );
}
