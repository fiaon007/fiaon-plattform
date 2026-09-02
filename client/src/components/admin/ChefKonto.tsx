// ═══════════════════════════════════════════════════════════════════════════
// DAS GESCHÄFTSKONTO (02.09.2026)
//
// JUSTIN: „Airwallex ist ja jetzt verbunden — wo sehen wir nun unser Konto?
// Wo ist die Seite mit den Zahlungen, Funktionen und sowas?"
//
// Es gab keine. Die Eingänge landeten im Bankbuch und waren dort richtig, aber
// niemand konnte sehen, ob überhaupt abgerufen wird, wann zuletzt, und was
// seitdem hereinkam. Ein Konto, dessen Stand man nicht sieht, ist kein Konto,
// dem man vertraut.
//
// DIE WICHTIGSTE ZAHL AUF DIESER SEITE ist nicht die Summe, sondern „wirklich
// offen": Eingänge, zu denen keine bezahlte Bestellung gehört. Alles andere
// ist zugeordnetes Geld — am 02.09. sahen 37 Zeilen ohne Haken nach
// liegengebliebenem Geld aus, und 34 davon waren längst verbucht. Wer die
// Rohzahl zeigt, erzeugt eine Sorge, die es nicht gibt.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import "@/styles/chef-konto.css";

const API = "/api/fiaon";

interface Zeile {
  id: number; txnId: string | null; am: string | null;
  betrag: string; waehrung: string; zahler: string | null; zweck: string;
  referenz: string | null; gebucht: boolean; schwebend: boolean;
  betragPasst: boolean | null; vermerk: string | null;
}
interface Offen {
  id: number; txnId: string | null; am: string | null; betrag: string;
  zahler: string | null; zweck: string; erkannteReferenz: string | null;
  antragStatus: string | null;
}
interface Konto {
  konfiguriert: boolean;
  konto: string; empfaenger: string; bic: string;
  letzterLauf: { wann: string; gesehen: number; neu: number; gebucht: number; fehler: string | null } | null;
  tage: number;
  eingaenge: { anzahl: number; summeCents: number; gebucht: number; gebuchtCents: number; schwebend: number; schwebendCents: number };
  wirklichOffen: { anzahl: number; summeCents: number; zeilen: Offen[] };
  liste: Zeile[];
}

const euro = (cents: number) => (cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const tag = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) : "—";
const zeitpunkt = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "nie";

export default function ChefKonto() {
  const [k, setK] = useState<Konto | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [holt, setHolt] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [tage, setTage] = useState(14);

  const laden = (t = tage) => {
    setLaedt(true);
    fetch(`${API}/admin/airwallex/konto?tage=${t}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => { if (j?.ok) setK(j); else setMeldung(j?.error || "Konnte nicht laden."); })
      .catch(() => setMeldung("Konnte nicht laden."))
      .finally(() => setLaedt(false));
  };
  useEffect(() => { laden(); /* eslint-disable-next-line */ }, []);

  const abrufen = async () => {
    setHolt(true); setMeldung(null);
    try {
      const r = await fetch(`${API}/admin/airwallex/einlesen`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tage: 3 }),
      });
      const j = await r.json();
      setMeldung(j?.ok
        ? `${j.gesehen} Eingänge gesehen, ${j.neu} neu ins Bankbuch, ${j.gebucht} gebucht${j.schwebend ? `, ${j.schwebend} noch unterwegs` : ""}.`
        : (j?.error || "Der Abruf hat nicht geklappt."));
      laden();
    } catch { setMeldung("Der Abruf hat nicht geklappt."); }
    setHolt(false);
  };

  if (laedt && !k) return <div className="kt-leer">Konto wird geladen …</div>;
  if (!k) return <div className="kt-leer">{meldung || "Keine Daten."}</div>;

  const alt = k.letzterLauf ? (Date.now() - new Date(k.letzterLauf.wann).getTime()) / 3_600_000 : null;
  const veraltet = alt === null || alt > 6;

  return (
    <div className="kt">
      <header className="kt-kopf">
        <div>
          <h1>Geschäftskonto</h1>
          <p className="kt-leise">
            {k.empfaenger} · {k.konto} · {k.bic}
          </p>
        </div>
        <button type="button" className="kt-knopf" disabled={holt} onClick={() => void abrufen()}>
          {holt ? "Rufe ab …" : "Jetzt abrufen"}
        </button>
      </header>

      {!k.konfiguriert && (
        <p className="kt-warn">
          Die Zugangsdaten für Airwallex fehlen auf dem Server. Ohne sie kann nichts abgerufen werden.
        </p>
      )}

      {/* Der Abrufstand zuerst: Eine Zahl ist nur so frisch wie ihr letzter Abruf. */}
      <div className={`kt-stand ${veraltet ? "alt" : ""}`}>
        <b>Zuletzt abgerufen:</b> {zeitpunkt(k.letzterLauf?.wann)}
        {k.letzterLauf && ` · ${k.letzterLauf.gesehen} gesehen, ${k.letzterLauf.neu} neu`}
        {k.letzterLauf?.fehler && <span className="kt-fehler"> · Fehler: {k.letzterLauf.fehler}</span>}
        {veraltet && !k.letzterLauf?.fehler && <span className="kt-leise"> — das ist länger her, als es sein sollte.</span>}
      </div>

      <div className="kt-zahlen">
        <div className="kt-kachel">
          <b>{euro(k.eingaenge.summeCents)}</b>
          <span>eingegangen · {k.tage} Tage</span>
        </div>
        <div className="kt-kachel">
          <b>{k.eingaenge.anzahl}</b>
          <span>Zahlungen</span>
        </div>
        {k.eingaenge.schwebend > 0 && (
          <div className="kt-kachel warn">
            <b>{euro(k.eingaenge.schwebendCents)}</b>
            <span>noch unterwegs · {k.eingaenge.schwebend} Stück</span>
          </div>
        )}
        <div className={`kt-kachel ${k.wirklichOffen.anzahl > 0 ? "rot" : "gut"}`}>
          <b>{k.wirklichOffen.anzahl === 0 ? "keine" : euro(k.wirklichOffen.summeCents)}</b>
          <span>{k.wirklichOffen.anzahl === 0 ? "Zahlung ohne Zuordnung" : `ohne Zuordnung · ${k.wirklichOffen.anzahl} Stück`}</span>
        </div>
      </div>

      {meldung && <p className="kt-meldung">{meldung}</p>}

      {/* Nur was wirklich Arbeit ist. Eine Zeile ohne Haken, deren Bestellung
          bezahlt ist, ist keine Arbeit — sie steht deshalb nicht hier. */}
      {k.wirklichOffen.anzahl > 0 && (
        <section className="kt-block">
          <h2>Diese Zahlungen gehören noch zu niemandem</h2>
          <p className="kt-leise">
            Zu diesen Eingängen findet sich keine bezahlte Bestellung. Sie brauchen eine Zuordnung von Hand
            in der Zahlungszentrale.
          </p>
          <table className="kt-tab">
            <thead>
              <tr><th>Datum</th><th>Betrag</th><th>Absender</th><th>Verwendungszweck</th><th>Stand</th></tr>
            </thead>
            <tbody>
              {k.wirklichOffen.zeilen.map((z) => (
                <tr key={z.id}>
                  <td>{tag(z.am)}</td>
                  <td className="kt-zahl">{z.betrag} €</td>
                  <td>{z.zahler || "—"}</td>
                  <td className="kt-zweck">{z.zweck || "—"}</td>
                  <td>{z.erkannteReferenz ? `${z.erkannteReferenz}${z.antragStatus ? ` (${z.antragStatus})` : ""}` : "keine Referenz erkannt"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="kt-block">
        <h2>Alle Eingänge der letzten {k.tage} Tage</h2>
        <div className="kt-filter">
          {[7, 14, 30, 60].map((t) => (
            <button
              key={t} type="button"
              className={`kt-filter-knopf ${tage === t ? "an" : ""}`}
              onClick={() => { setTage(t); laden(t); }}
            >{t} Tage</button>
          ))}
        </div>
        <table className="kt-tab">
          <thead>
            <tr><th>Datum</th><th>Betrag</th><th>Absender</th><th>Verwendungszweck</th><th>Zuordnung</th></tr>
          </thead>
          <tbody>
            {k.liste.map((z) => (
              <tr key={z.id} className={z.schwebend ? "schwebend" : ""}>
                <td>{tag(z.am)}</td>
                <td className="kt-zahl">{z.betrag} {z.waehrung === "EUR" ? "€" : z.waehrung}</td>
                <td>{z.zahler || "—"}</td>
                <td className="kt-zweck">{z.zweck || "—"}</td>
                <td>
                  {z.schwebend ? <span className="kt-marke warn">unterwegs</span>
                    : z.gebucht ? <span className="kt-marke gut">gebucht</span>
                    : z.referenz ? <span className="kt-marke leise">{z.referenz}</span>
                    : <span className="kt-marke leise">—</span>}
                  {z.betragPasst === false && <span className="kt-marke rot">Betrag weicht ab</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {k.liste.length === 0 && <p className="kt-leise">In diesem Zeitraum ist kein Geld eingegangen.</p>}
      </section>

      <p className="kt-fuss">
        Das Konto wird alle 30 Minuten von selbst abgerufen. „Jetzt abrufen“ holt die letzten drei Tage
        sofort — nützlich, wenn ein Kunde gerade überwiesen hat und du nicht warten willst.
      </p>
    </div>
  );
}
