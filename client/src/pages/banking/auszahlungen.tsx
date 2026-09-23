// ═══════════════════════════════════════════════════════════════════════════
// FIAON BANKING — Auszahlungen an Mitarbeiter (E-228)
//
// Jede Auszahlung mit Abrechnung und Beleg. Angeforderte werden hier
// angewiesen: Das legt einen Zahlungsauftrag mit der Bankverbindung aus der
// Anforderung an — freigegeben mit TAN, überwiesen vom Inhaber, und mit der
// Bankreferenz schließt sich die Auszahlung über denselben Weg wie in
// /admin/payouts.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from "react";
import { ruf, type Auszahlung, type Ich } from "./api";
import { geld, tag } from "./format";
import { Chip, Knopf, KnopfLink, Laden, Leer, Meldung, type ChipArt } from "./ui";

const STATUS: Record<string, { text: string; art: ChipArt }> = {
  angefordert: { text: "Angefordert", art: "warn" },
  ausgezahlt: { text: "Ausgezahlt", art: "gut" },
  abgelehnt: { text: "Abgelehnt", art: "fehler" },
  requested: { text: "Altbestand", art: "still" },
};

const AUFTRAG_TEXT: Record<string, string> = {
  entwurf: "Entwurf", eingereicht: "wartet auf Freigabe", freigegeben: "freigegeben, zu überweisen",
  ausgefuehrt: "überwiesen", abgelehnt: "abgelehnt", zurueckgezogen: "zurückgezogen",
};

export default function Auszahlungen({ ich, onZuAuftraegen }: { ich: Ich; onZuAuftraegen: () => void }) {
  const [liste, setListe] = useState<Auszahlung[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [wer, setWer] = useState<string>("");
  const [status, setStatus] = useState<string>("alle");
  const [laeuft, setLaeuft] = useState<number | "alle" | null>(null);

  const laden = useCallback(() => {
    ruf<{ auszahlungen: Auszahlung[] }>("/buchhaltung/auszahlungen").then((j) => setListe(j.auszahlungen)).catch((e) => setFehler(e.message));
  }, []);
  useEffect(() => { laden(); }, [laden]);

  const leute = useMemo(() => {
    const karte = new Map<string, { name: string; bezahlt: number; anzahl: number; offen: number }>();
    for (const p of liste || []) {
      const e = karte.get(p.name) || { name: p.name, bezahlt: 0, anzahl: 0, offen: 0 };
      if (p.status === "ausgezahlt") { e.bezahlt += p.cents; e.anzahl += 1; }
      if (p.status === "angefordert") e.offen += p.cents;
      karte.set(p.name, e);
    }
    return Array.from(karte.values()).sort((a, b) => b.bezahlt - a.bezahlt);
  }, [liste]);

  const gefiltert = useMemo(() => (liste || []).filter((p) =>
    (!wer || p.name === wer) && (status === "alle" || p.status === status)), [liste, wer, status]);

  const summe = (s: string) => (liste || []).filter((p) => p.status === s).reduce((x, p) => x + p.cents, 0);
  const zahl = (s: string) => (liste || []).filter((p) => p.status === s).length;
  const anweisbar = (liste || []).filter((p) => p.status === "angefordert" && !p.auftragId);

  const anweisen = async (id: number) => {
    setLaeuft(id); setFehler(null); setMeldung(null);
    try {
      const j = await ruf<{ auftrag: { nummer: string } }>(`/buchhaltung/auszahlung/${id}/anweisen`, { body: {} });
      setMeldung(`Zahlungsauftrag ${j.auftrag.nummer} angelegt${ich.rolle === "inhaber" ? " — unter Aufträge mit TAN freigeben." : " und zur Freigabe eingereicht."}`);
      laden();
    } catch (e: any) { setFehler(e.message); } finally { setLaeuft(null); }
  };

  const alleAnweisen = async () => {
    if (!window.confirm(`${anweisbar.length} Auszahlungen über zusammen ${geld(anweisbar.reduce((s, p) => s + p.cents, 0))} als Zahlungsaufträge anlegen?`)) return;
    setLaeuft("alle"); setFehler(null); setMeldung(null);
    try {
      const j = await ruf<{ angelegt: string[]; fehlgeschlagen: { id: number; grund: string }[] }>("/buchhaltung/auszahlungen/alle-anweisen", { body: {} });
      setMeldung(`${j.angelegt.length} Aufträge angelegt${j.fehlgeschlagen.length ? ` · ${j.fehlgeschlagen.length} ohne: ${j.fehlgeschlagen.map((f) => `Nr. ${f.id} (${f.grund})`).join(", ")}` : ""}.`);
      laden();
    } catch (e: any) { setFehler(e.message); } finally { setLaeuft(null); }
  };

  if (!liste) return <div className="bk-seite">{fehler ? <Meldung art="fehler">{fehler}</Meldung> : <Laden zeilen={8} />}</div>;

  return (
    <div className="bk-seite">
      <div className="bk-streifen">
        <div><span>Ausgezahlt gesamt</span><strong>{geld(summe("ausgezahlt"))}</strong><em>{zahl("ausgezahlt")} Auszahlungen</em></div>
        <div><span>Angefordert, offen</span><strong>{geld(summe("angefordert"))}</strong><em>{zahl("angefordert")} Anforderungen</em></div>
        <div><span>Altbestand</span><strong>{geld(summe("requested"))}</strong><em>{zahl("requested")} aus August, ohne Provisionszeilen</em></div>
        <div><span>Abgelehnt</span><strong>{geld(summe("abgelehnt"))}</strong><em>{zahl("abgelehnt")} Anforderungen</em></div>
      </div>

      <div className="bk-filter">
        <select className="bk-auswahl" value={wer} onChange={(e) => setWer(e.target.value)} aria-label="Mitarbeiter">
          <option value="">Alle Mitarbeiter</option>
          {leute.map((l) => <option key={l.name} value={l.name}>{l.name}</option>)}
        </select>
        <div className="bk-segment" role="tablist" aria-label="Status">
          {[["alle", "Alle"], ["angefordert", "Offen"], ["ausgezahlt", "Ausgezahlt"], ["abgelehnt", "Abgelehnt"]].map(([w, t]) => (
            <button key={w} type="button" role="tab" aria-selected={status === w} className={status === w ? "aktiv" : ""} onClick={() => setStatus(w)}>{t}</button>
          ))}
        </div>
        <span className="bk-flex" />
        <KnopfLink href="/api/fiaon/buchhaltung/auszahlungsjournal.pdf" zeichen="pdf">Auszahlungsjournal</KnopfLink>
        {anweisbar.length ? (
          <Knopf art="primaer" zeichen="senden" disabled={laeuft !== null} onClick={() => void alleAnweisen()}>
            {laeuft === "alle" ? "Lege an …" : `Alle offenen anweisen (${anweisbar.length})`}
          </Knopf>
        ) : null}
      </div>

      {meldung ? <Meldung art="gut" onZu={() => setMeldung(null)}>{meldung} <button type="button" className="bk-link-knopf" onClick={onZuAuftraegen}>Zu den Aufträgen</button></Meldung> : null}
      {fehler ? <Meldung art="fehler" onZu={() => setFehler(null)}>{fehler}</Meldung> : null}

      <div className="bk-zwei">
        <section className="bk-karte bk-leute">
          <header className="bk-karte-kopf"><h2>Je Mitarbeiter</h2></header>
          <ul>
            {leute.map((l) => (
              <li key={l.name}>
                <button type="button" className={wer === l.name ? "aktiv" : ""} onClick={() => setWer(wer === l.name ? "" : l.name)}>
                  <span className="bk-leute-name">{l.name}</span>
                  <span className="bk-leute-w">{geld(l.bezahlt)}<em>{l.anzahl}× ausgezahlt{l.offen ? ` · ${geld(l.offen)} offen` : ""}</em></span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="bk-karte">
          {gefiltert.length === 0 ? <Leer titel="Keine Auszahlungen" text="In diesem Filter gibt es nichts." /> : (
            <div className="bk-tabelle-rolle">
              <table className="bk-tabelle">
                <thead><tr><th>Mitarbeiter</th><th>Stand</th><th>Angefordert</th><th>Überwiesen</th><th className="bk-r">Betrag</th><th>Unterlagen</th><th /></tr></thead>
                <tbody>
                  {gefiltert.map((p) => {
                    const st = STATUS[p.status] ?? { text: p.status, art: "still" as ChipArt };
                    return (
                      <tr key={p.id}>
                        <td>
                          <strong>{p.name}</strong>
                          <span className="bk-klein">{p.art} · <span className="bk-mono">FIAON-AUS-{p.id}</span>{p.ibanMaskiert ? <> · <span className="bk-mono">{p.ibanMaskiert}</span></> : null}</span>
                          {p.ablehnGrund ? <span className="bk-klein">Grund: {p.ablehnGrund}</span> : null}
                        </td>
                        <td><Chip art={st.art}>{st.text}</Chip>{p.auftragNr ? <span className="bk-klein"><span className="bk-mono">{p.auftragNr}</span> · {AUFTRAG_TEXT[p.auftragStatus ?? ""] ?? p.auftragStatus}</span> : null}</td>
                        <td>{tag(p.angefordertAm)}</td>
                        <td>{tag(p.ausgezahltAm)}</td>
                        <td className="bk-r bk-zahl">{geld(p.cents)}</td>
                        <td>
                          <div className="bk-knopfreihe bk-eng">
                            {p.hatAbrechnungPdf && p.abrechnungId ? <KnopfLink href={`/api/fiaon/buchhaltung/abrechnung/${p.abrechnungId}.pdf`} zeichen="dokument" klein art="still">{p.abrechnungNr}</KnopfLink> : null}
                            {p.status === "ausgezahlt" ? <KnopfLink href={`/api/fiaon/buchhaltung/auszahlung/${p.id}/beleg.pdf`} zeichen="pdf" klein art="still">Beleg</KnopfLink> : null}
                          </div>
                        </td>
                        <td className="bk-r">
                          {p.status === "angefordert" && !p.auftragId ? (
                            <Knopf klein art="primaer" disabled={laeuft !== null} onClick={() => void anweisen(p.id)}>{laeuft === p.id ? "…" : "Anweisen"}</Knopf>
                          ) : p.status === "angefordert" && p.auftragId ? (
                            <Knopf klein art="still" onClick={onZuAuftraegen}>Zum Auftrag</Knopf>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
