// ═══════════════════════════════════════════════════════════════════════════
// FIAON BANKING — Auszüge und Dokumente (E-228)
//
// Monatsauszüge je Konto als PDF und als CSV für die Steuerberatung, dazu die
// Papiere des Bankings: Übergabevermerk, Zugangsblätter, Auszahlungsjournal.
// ═══════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from "react";
import { ruf, type Lage } from "./api";
import { geld, monatName, tag, zeit } from "./format";
import { Chip, Knopf, KnopfLink, Meldung, Zeichen } from "./ui";

function letzterTag(monat: string): string {
  const [j, m] = monat.split("-").map(Number);
  return `${monat}-${String(new Date(Date.UTC(j, m, 0)).getUTCDate()).padStart(2, "0")}`;
}

export default function Auszuege({ lage, onNeu }: { lage: Lage; onNeu: () => void }) {
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const jeKonto = useMemo(() => {
    const g = lage.fluss.filter((f) => f.konto === "geschaeft").sort((a, b) => b.monat.localeCompare(a.monat));
    const w = lage.fluss.filter((f) => f.konto === "wise").sort((a, b) => b.monat.localeCompare(a.monat));
    return [
      { schluessel: "geschaeft", titel: "Geschäftskonto", iban: lage.konten.find((k) => k.schluessel === "geschaeft")?.ibanDisplay ?? "", monate: g },
      { schluessel: "wise", titel: "Altkonto Wise · gesperrt", iban: lage.konten.find((k) => k.schluessel === "wise")?.ibanDisplay ?? "", monate: w },
    ];
  }, [lage]);

  const bestaetigen = async () => {
    setLaeuft(true); setFehler(null);
    try { await ruf("/buchhaltung/uebergabe/bestaetigen", { body: {} }); onNeu(); }
    catch (e: any) { setFehler(e.message); } finally { setLaeuft(false); }
  };

  const u = lage.uebergabe;
  const andere = lage.leute.filter((p) => p.email !== lage.ich.email);

  return (
    <div className="bk-seite">
      <div className="bk-zwei bk-zwei-breit">
        <div className="bk-stapel">
          {jeKonto.map((k) => (
            <section className="bk-karte" key={k.schluessel}>
              <header className="bk-karte-kopf">
                <div><h2>{k.titel}</h2><span className="bk-mono bk-leise">{k.iban}</span></div>
              </header>
              {k.monate.length === 0 ? <p className="bk-leise">Keine Umsätze.</p> : (
                <div className="bk-tabelle-rolle">
                  <table className="bk-tabelle">
                    <thead><tr><th>Monat</th><th className="bk-r">Umsätze</th><th className="bk-r">Eingänge</th><th className="bk-r">Ausgänge</th><th /></tr></thead>
                    <tbody>{k.monate.map((m) => (
                      <tr key={m.monat}>
                        <td><strong>{monatName(m.monat)}</strong></td>
                        <td className="bk-r">{m.anzahl}</td>
                        <td className="bk-r bk-zahl">{geld(m.einCents)}</td>
                        <td className="bk-r bk-zahl">{geld(m.ausCents)}</td>
                        <td className="bk-r">
                          <div className="bk-knopfreihe bk-eng bk-rechts">
                            <KnopfLink href={`/api/fiaon/buchhaltung/auszug.pdf?konto=${k.schluessel}&monat=${m.monat}`} zeichen="pdf" klein>Auszug</KnopfLink>
                            <KnopfLink href={`/api/fiaon/buchhaltung/umsaetze.csv?konto=${k.schluessel}&von=${m.monat}-01&bis=${letzterTag(m.monat)}`} zeichen="herunter" klein art="still" neu={false}>CSV</KnopfLink>
                          </div>
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
          <p className="bk-fussnote">Der Auszug ist ein Auszug aus dem Kassenbuch der FIAON LTD, kein Kontoauszug der Bank. Jede Zeile nennt ihre Herkunft.</p>
        </div>

        <div className="bk-stapel">
          <section className="bk-karte">
            <header className="bk-karte-kopf"><h2>Übergabe der Buchhaltung</h2></header>
            {!u ? <p className="bk-leise">{lage.ich.rolle === "inhaber" ? "Noch nicht hinterlegt — unter „Kontostand“." : "Noch keine Übergabe hinterlegt."}</p> : (
              <>
                <dl className="bk-dl">
                  <dt>Bisher geführt von</dt><dd>{u.bisher}</dd>
                  <dt>Übergabe zum</dt><dd>{tag(u.stichtag)}</dd>
                  <dt>Stand</dt><dd>{u.bestaetigtVon ? <Chip art="gut" zeichen="haken">Bestätigt {zeit(u.bestaetigtAm)}</Chip> : <Chip art="warn">Nicht bestätigt</Chip>}</dd>
                </dl>
                <div className="bk-knopfreihe">
                  <KnopfLink href="/api/fiaon/buchhaltung/uebergabe.pdf" zeichen="pdf">Vermerk lesen</KnopfLink>
                  {!u.bestaetigtVon && lage.ich.rolle === "buchhaltung" ? (
                    <Knopf art="primaer" zeichen="haken" disabled={laeuft} onClick={() => void bestaetigen()}>Übernahme bestätigen</Knopf>
                  ) : null}
                </div>
              </>
            )}
            {fehler ? <Meldung art="fehler">{fehler}</Meldung> : null}
          </section>

          <section className="bk-karte">
            <header className="bk-karte-kopf"><h2>Dokumente</h2></header>
            <ul className="bk-dokumente">
              <li><Zeichen n="dokument" /><span><strong>Mein Zugangsblatt</strong><em>Anmeldung, Rechte, Regeln — ohne Passwort</em></span><KnopfLink href="/api/fiaon/buchhaltung/zugang.pdf" zeichen="pdf" klein art="still">Öffnen</KnopfLink></li>
              {lage.ich.rolle === "inhaber" ? andere.map((p) => (
                <li key={p.email}><Zeichen n="person" /><span><strong>Zugangsblatt {p.name}</strong><em>Zum persönlichen Übergeben</em></span><KnopfLink href={`/api/fiaon/buchhaltung/zugang.pdf?fuer=${encodeURIComponent(p.email)}`} zeichen="pdf" klein art="still">Öffnen</KnopfLink></li>
              )) : null}
              <li><Zeichen n="team" /><span><strong>Auszahlungsjournal</strong><em>Alle Auszahlungen an Mitarbeiter, nach Person</em></span><KnopfLink href="/api/fiaon/buchhaltung/auszahlungsjournal.pdf" zeichen="pdf" klein art="still">Öffnen</KnopfLink></li>
              <li><Zeichen n="umsatz" /><span><strong>Alle Umsätze als CSV</strong><em>Beide Konten, gesamter Zeitraum</em></span><KnopfLink href="/api/fiaon/buchhaltung/umsaetze.csv" zeichen="herunter" klein art="still" neu={false}>Laden</KnopfLink></li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
