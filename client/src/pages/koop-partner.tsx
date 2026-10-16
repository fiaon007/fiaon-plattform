// ═══════════════════════════════════════════════════════════════════════════
// /partner/:token — DER PARTNERBEREICH DES KOOPERATIONSVERTRAGS (E-386, 16.10.2026)
//
// Der Partner braucht keinen Klick von uns: Er gibt hier seine Zeiten frei (Ziffer 4), ändert die Wunschmenge, sieht jeden
// übermittelten Kontakt mit Termin, reklamiert binnen der Frist mit einem Klick (Ziffer 7), meldet „kein Kontakt mehr
// gewünscht“ (Ziffer 5) und findet seine Monatsrechnungen. Der Link kommt automatisch nach der Annahme per Mail.
// CI Glasblau (#288DFA / #1D4ED8), Navy-Glas an EINER Stelle (der Stand oben), dünne Schrift, am Handy gestapelt.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from "react";
import { useRoute } from "wouter";
import { KOOP_TERMIN_ARTEN, KOOP_ZEITEN_DAUER, type KoopLieferStand } from "@shared/fiaon-koop-lieferung";
import "@/styles/koop-partner.css";

interface Kontakt {
  id: number; name: string; telefon: string; email: string; thema: string; terminText: string; art: string; dauerMin: number; notiz: string | null;
  ersatz: boolean; status: string; reklamation: { grund: string; wahl: string; ergebnis: string; begruendung: string } | null;
  reklamierbarBis: string | null; keinKontakt: boolean;
}
interface Rechnung { monat: string; monatText: string; anzahl: number; betrag: string; gutschrift: string | null; nummer: string | null; status: string; faellig: string | null; zahlung: string | null; pdf: string | null }
interface Sicht {
  ok: boolean; error?: string; ref: string; partner: string; anrede: string; gruss: string; preis: string; reklamationTage: number;
  stand: KoopLieferStand & { zeitenText: string };
  gruende: { key: string; text: string }[]; kontakte: Kontakt[]; rechnungen: Rechnung[];
}
const TAGE = [{ n: 1, t: "Mo" }, { n: 2, t: "Di" }, { n: 3, t: "Mi" }, { n: 4, t: "Do" }, { n: 5, t: "Fr" }, { n: 6, t: "Sa" }, { n: 7, t: "So" }];

export default function KoopPartnerPage() {
  const [, params] = useRoute("/partner/:token");
  const token = params?.token ? decodeURIComponent(params.token) : "";
  const [sicht, setSicht] = useState<Sicht | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [zeiten, setZeiten] = useState({ tage: [1, 2, 3, 4, 5], von: "09:00", bis: "18:00", dauerMin: 60, arten: ["telefon"] as string[] });
  const [wunsch, setWunsch] = useState(10);
  const [rekl, setRekl] = useState<{ id: number; grund: string; wahl: string; text: string } | null>(null);

  const laden = useCallback(async () => {
    const r = await fetch(`/api/fiaon/koop/partner/${encodeURIComponent(token)}`).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    if (!r?.ok || !j?.ok) { setFehler(j?.error ?? "Ihr Partnerbereich ließ sich gerade nicht laden."); return; }
    setSicht(j);
    if (j.stand.zeiten) setZeiten(j.stand.zeiten);
    if (j.stand.woche.wunsch) setWunsch(j.stand.woche.wunsch);
  }, [token]);
  useEffect(() => { document.title = "Ihr Partnerbereich · FIAON"; void laden(); }, [laden]);

  async function senden(was: string, pfad: string, body: unknown) {
    setLaeuft(was); setMeldung(null);
    const r = await fetch(`/api/fiaon/koop/partner/${encodeURIComponent(token)}${pfad}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    setLaeuft(null);
    if (!r?.ok || !j?.ok) { setMeldung(j?.error ?? "Das ließ sich gerade nicht speichern."); return null; }
    await laden();
    return j;
  }

  if (fehler) return <main className="kpb"><div className="kpb-rahmen"><p className="kpb-marke">FIAON</p><h1>Partnerbereich</h1><p className="kpb-fehler">{fehler}</p></div></main>;
  if (!sicht) return <main className="kpb"><div className="kpb-rahmen"><p className="kpb-marke">FIAON</p><p>Wird geladen …</p></div></main>;
  const s = sicht.stand;
  return (
    <main className="kpb">
      <div className="kpb-rahmen">
        <p className="kpb-marke">FIAON · Partner-Kooperation</p>
        <h1>Willkommen in Ihrem Partnerbereich, {sicht.gruss}.</h1>
        <p className="kpb-lead">Hier geben Sie Ihre Zeiten frei, sehen jeden Termin und reklamieren mit einem Klick. Vertrag {sicht.ref} · {sicht.preis} netto je Kontakt.</p>

        <section className="kpb-stand" aria-label="Ihr Stand">
          <div><small>Diese Woche</small><b>{s.woche.geliefert} <span>von {s.woche.wunsch}</span></b></div>
          <div><small>Dieser Monat</small><b>{s.monat.geliefert} <span>Kontakte</span></b></div>
          {s.startRahmen && <div><small>Start-Rahmen</small><b>{s.startRahmen.geliefert} <span>von {s.startRahmen.deckel}</span></b></div>}
          {s.ersatzOffen > 0 && <div><small>Ersatz offen</small><b>{s.ersatzOffen}</b></div>}
          <p className="kpb-stand-zeile">{s.ruht ? `Die Übermittlung ruht, bis Rechnung ${s.ruht.rechnung} bezahlt ist — vereinbarte Termine bleiben.` : !s.zeiten ? "Bitte geben Sie unten Ihre Zeiten frei — dann vereinbaren wir die ersten Termine." : s.sperre ? s.sperre : "Alles bereit — wir vereinbaren Termine in Ihren Zeiten."}</p>
        </section>

        {meldung && <p className="kpb-meldung" role="status">{meldung}</p>}

        <section className="kpb-karte">
          <h2>Ihre Zeiten für Termine</h2>
          <p className="kpb-fein">Wir vereinbaren Termine nur in diesen Zeiten und übermitteln jeden Kontakt spätestens am Werktag vorher. Gilt ab sofort für neue Termine.</p>
          <div className="kpb-reihe">{TAGE.map((t) => (
            <button key={t.n} type="button" className={`kpb-chip ${zeiten.tage.includes(t.n) ? "an" : ""}`} aria-pressed={zeiten.tage.includes(t.n)}
              onClick={() => setZeiten((z) => ({ ...z, tage: z.tage.includes(t.n) ? z.tage.filter((x) => x !== t.n) : [...z.tage, t.n].sort() }))}>{t.t}</button>
          ))}</div>
          <div className="kpb-felder">
            <label>Von<input type="time" value={zeiten.von} onChange={(e) => setZeiten({ ...zeiten, von: e.target.value })} /></label>
            <label>Bis<input type="time" value={zeiten.bis} onChange={(e) => setZeiten({ ...zeiten, bis: e.target.value })} /></label>
            <label>Termindauer<select value={zeiten.dauerMin} onChange={(e) => setZeiten({ ...zeiten, dauerMin: Number(e.target.value) })}>{KOOP_ZEITEN_DAUER.map((d) => <option key={d} value={d}>{d} Minuten</option>)}</select></label>
          </div>
          <div className="kpb-reihe">{KOOP_TERMIN_ARTEN.map((a) => (
            <button key={a.key} type="button" className={`kpb-chip ${zeiten.arten.includes(a.key) ? "an" : ""}`} aria-pressed={zeiten.arten.includes(a.key)}
              onClick={() => setZeiten((z) => ({ ...z, arten: z.arten.includes(a.key) ? z.arten.filter((x) => x !== a.key) : [...z.arten, a.key] }))}>{a.text}</button>
          ))}</div>
          <div className="kpb-tun">
            <button type="button" className="kpb-knopf" disabled={laeuft === "zeiten"} onClick={() => void senden("zeiten", "/zeiten", zeiten).then((j) => j && setMeldung(`Gespeichert: ${j.zeitenText}`))}>{laeuft === "zeiten" ? "Speichert …" : "Zeiten speichern"}</button>
            <span className="kpb-fein">Aktuell: {s.zeitenText}</span>
          </div>
        </section>

        <section className="kpb-karte">
          <h2>Ihre Menge je Woche</h2>
          <div className="kpb-tun">
            <input className="kpb-zahl" type="number" min={1} max={500} value={wunsch} onChange={(e) => setWunsch(Number(e.target.value))} aria-label="Kontakte je Woche" />
            <span>Kontakte je Woche</span>
            <button type="button" className="kpb-knopf still" disabled={laeuft === "wunsch"} onClick={() => void senden("wunsch", "/wunsch", { wunschWoche: wunsch }).then((j) => j && setMeldung(`Gespeichert: ${j.wunschWoche} Kontakte je Woche.`))}>Menge speichern</button>
          </div>
        </section>

        <section className="kpb-karte">
          <h2>Ihre Termine</h2>
          {sicht.kontakte.length === 0 ? <p className="kpb-fein">Noch keine übermittelten Kontakte.</p> : (
            <ul className="kpb-kontakte">
              {sicht.kontakte.map((k) => (
                <li key={k.id} className={k.status === "reklamiert" ? "still" : ""}>
                  <div className="kpb-kontakt-kopf"><b>{k.name}</b><span>{k.terminText} · {k.art} · {k.dauerMin} Min.</span></div>
                  <p>{k.thema}{k.ersatz ? " · Ersatzkontakt" : ""}</p>
                  <p className="kpb-fein"><a href={`tel:${k.telefon}`}>{k.telefon}</a> · <a href={`mailto:${k.email}`}>{k.email}</a></p>
                  {k.notiz && <p className="kpb-notiz">„{k.notiz}“</p>}
                  {k.reklamation && <p className={`kpb-rekl ${k.reklamation.ergebnis}`}>Reklamation ({k.reklamation.grund}): {k.reklamation.begruendung}</p>}
                  {k.keinKontakt && <p className="kpb-fein">Gemeldet: kein Kontakt mehr gewünscht.</p>}
                  <div className="kpb-tun">
                    {k.reklamierbarBis && !k.reklamation && rekl?.id !== k.id && <button type="button" className="kpb-knopf still klein" onClick={() => setRekl({ id: k.id, grund: "", wahl: "gutschrift", text: "" })}>Reklamieren</button>}
                    {!k.keinKontakt && <button type="button" className="kpb-knopf still klein" disabled={!!laeuft} onClick={() => void senden(`kk${k.id}`, `/kontakt/${k.id}/kein-kontakt`, {}).then((j) => j && setMeldung(j.meldung))}>Wünscht keinen Kontakt mehr</button>}
                    {k.reklamierbarBis && <span className="kpb-fein">Reklamation bis {new Date(k.reklamierbarBis).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}</span>}
                  </div>
                  {rekl?.id === k.id && (
                    <div className="kpb-rekl-form">
                      <label>Grund<select value={rekl.grund} onChange={(e) => setRekl({ ...rekl, grund: e.target.value })}><option value="">Bitte wählen</option>{sicht.gruende.map((g) => <option key={g.key} value={g.key}>{g.text}</option>)}</select></label>
                      <div className="kpb-reihe">
                        <button type="button" className={`kpb-chip ${rekl.wahl === "gutschrift" ? "an" : ""}`} onClick={() => setRekl({ ...rekl, wahl: "gutschrift" })}>Gutschrift</button>
                        <button type="button" className={`kpb-chip ${rekl.wahl === "ersatz" ? "an" : ""}`} onClick={() => setRekl({ ...rekl, wahl: "ersatz" })}>Ersatzkontakt</button>
                      </div>
                      <label>Kurz erklärt (freiwillig)<textarea rows={2} maxLength={500} value={rekl.text} onChange={(e) => setRekl({ ...rekl, text: e.target.value })} /></label>
                      <p className="kpb-fein">„Kein Abschluss“ ist kein Reklamationsgrund (Ziffer 7).</p>
                      <div className="kpb-tun">
                        <button type="button" className="kpb-knopf" disabled={!rekl.grund || laeuft === "rekl"} onClick={() => void senden("rekl", `/kontakt/${k.id}/reklamation`, rekl).then((j) => { if (j) { setMeldung(j.begruendung); setRekl(null); } })}>Reklamation senden</button>
                        <button type="button" className="kpb-knopf still" onClick={() => setRekl(null)}>Abbrechen</button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="kpb-karte">
          <h2>Ihre Rechnungen</h2>
          {sicht.rechnungen.length === 0 ? <p className="kpb-fein">Die erste Rechnung kommt am Ersten des Folgemonats — mit Aufstellung jedes Kontakts.</p> : (
            <ul className="kpb-rechnungen">
              {sicht.rechnungen.map((r) => (
                <li key={r.monat}>
                  <span><b>{r.monatText}</b> · {r.anzahl} Kontakte{r.gutschrift ? ` · Gutschrift ${r.gutschrift}` : ""}</span>
                  <span>{r.nummer ? `${r.nummer} · ` : ""}{r.betrag} · <em className={r.status === "bezahlt" ? "gut" : r.status === "offen" ? "offen" : ""}>{r.status}{r.faellig && r.status === "offen" ? ` bis ${r.faellig}` : ""}</em></span>
                  <span className="kpb-reihe">{r.pdf && <a href={r.pdf} target="_blank" rel="noreferrer">PDF</a>}{r.zahlung && <a href={r.zahlung}>Bezahlen</a>}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <p className="kpb-fuss">FIAON LTD · 128 City Road, London · Fragen: support@fiaon.com · Bitte geben Sie diesen Link nicht weiter.</p>
      </div>
    </main>
  );
}
