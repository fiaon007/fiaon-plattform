// ═══════════════════════════════════════════════════════════════════════════
// /partner/:token — DER PARTNERBEREICH DES KOOPERATIONSVERTRAGS (E-386, 16.10.2026)
//
// Der Partner braucht keinen Klick von uns: Er gibt hier seine Zeiten frei (Ziffer 4), ändert die Wunschmenge, sieht jeden
// übermittelten Kontakt mit Termin, reklamiert binnen der Frist mit einem Klick (Ziffer 7), meldet „kein Kontakt mehr
// gewünscht“ (Ziffer 5) und findet seine Monatsrechnungen. Der Link kommt automatisch nach der Annahme per Mail.
// CI Glasblau (#288DFA / #1D4ED8), Navy-Glas an EINER Stelle (der Stand oben), dünne Schrift, am Handy gestapelt.
// E-388 (16.10.2026): „Ihr Jahr in Zahlen“ (sechs Monate) und der DEMO-ZUGANG /partner/demo?bereich=… — derselbe Bereich
// mit Beispieldaten aus client/src/lib/koop-partner-demo.ts, ohne Server, ohne Speichern, klar gekennzeichnet.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from "react";
import { useRoute } from "wouter";
import { KOOP_TERMIN_ARTEN, KOOP_ZEITEN_DAUER, type KoopLieferStand } from "@shared/fiaon-koop-lieferung";
import { NETZ_BEREICHE, NETZ_BEREICH_NAME, NETZ_PFAD, type NetzBereich } from "@shared/fiaon-partnernetz";
import { demoSicht } from "@/lib/koop-partner-demo";
import { KOOP_EMPFEHLUNG_TEXTE } from "@shared/fiaon-koop-empfehlung";
import "@/styles/koop-partner.css";

interface Kontakt {
  id: number; name: string; telefon: string; email: string; thema: string; terminText: string; art: string; dauerMin: number; notiz: string | null;
  ersatz: boolean; status: string; reklamation: { grund: string; wahl: string; ergebnis: string; begruendung: string } | null;
  reklamierbarBis: string | null; keinKontakt: boolean;
  abschluss?: { am: string | null; art: string | null; kein: boolean; betrag: string | null; meldbar: boolean } | null;
}
interface Rechnung { monat: string; monatText: string; anzahl: number; betrag: string; gutschrift: string | null; nummer: string | null; status: string; faellig: string | null; zahlung: string | null; pdf: string | null }
interface Sicht {
  ok: boolean; error?: string; ref: string; partner: string; anrede: string; gruss: string; preis: string; reklamationTage: number;
  stand: KoopLieferStand & { zeitenText: string };
  gruende: { key: string; text: string }[]; kontakte: Kontakt[]; rechnungen: Rechnung[];
  verlauf?: { monat: string; monatText: string; kontakte: number; reklamiert: number; betragCents: number; laufend: boolean }[];
  modell?: "kontakt" | "abschluss" | "platz"; einheit?: string; kontakteTitel?: string; sparten?: { name: string; betrag: string }[];
  // E-419: Empfehlungen an FIAON mit Provision; „Berechnung ausgesetzt“ = Kontakte vorerst ohne Berechnung.
  empfehlungen?: Empfehlungen | null; berechnungAusgesetzt?: boolean;
  demo?: boolean; demoBereich?: NetzBereich; demoWorte?: { kontakteTitel: string; einheit: string; partner: string; gruss: string; modell: string; platz?: boolean; ohneZeiten?: boolean };
}
interface Empfehlungen {
  prozent: number | null; monate: number;
  liste: { id: number; name: string; gemeldetText: string; bisText: string; standText: string; stand: string; umsatz: string; provision: string; ausgezahlt: string; offen: string; quelle: string }[];
  summe: { umsatz: string; provision: string; ausgezahlt: string; offen: string };
  gutschriften?: { id: number; nummer: string; monatText: string; betrag: string; stand: string }[];
  bank?: { inhaber: string; maske: string } | null;
}
/** E-420: Ihre Auszahlungen — Gutschriften (automatisch zum Monatsanfang) und die Bankverbindung für die Überweisung. */
function IhreAuszahlungen({ e, token, laeuft, senden }: { e: Empfehlungen; token: string; laeuft: string | null; senden: (was: string, pfad: string, body: unknown) => Promise<any> }) {
  const [bank, setBank] = useState({ inhaber: "", iban: "" });
  const [aendern, setAendern] = useState(!e.bank);
  const T = KOOP_EMPFEHLUNG_TEXTE;
  const gs = e.gutschriften ?? [];
  return (
    <section className="kpb-karte kpb-empf" aria-label={T.auszahlTitel}>
      <h2>{T.auszahlTitel}{gs.length > 0 && <span className="kpb-zahl-marke">{gs.length}</span>}</h2>
      <p className="kpb-fein">{T.auszahlSub}</p>
      {gs.length === 0 ? <p className="kpb-fein">{T.keineGutschrift}</p> : (
        <ul className="kpb-rechnungen">
          {gs.map((g) => (
            <li key={g.id}>
              <span><b>{g.monatText}</b> · {g.nummer}</span>
              <span>{g.betrag} · <em className={g.stand === "ausgezahlt" ? "gut" : "offen"}>{g.stand}</em></span>
              <span className="kpb-reihe"><a href={`/api/fiaon/koop/partner/${encodeURIComponent(token)}/gutschrift/${g.id}.pdf`} target="_blank" rel="noreferrer">PDF</a></span>
            </li>
          ))}
        </ul>
      )}
      <div className="kpb-empf-form">
        <h3>Ihre Bankverbindung</h3>
        {e.bank && !aendern ? (
          <div className="kpb-tun"><span>{e.bank.inhaber} · IBAN {e.bank.maske}</span><button type="button" className="kpb-knopf still klein" onClick={() => setAendern(true)}>Ändern</button></div>
        ) : (
          <>
            {!e.bank && <p className="kpb-fein">{T.bankFehlt}</p>}
            <div className="kpb-felder">
              <label>Kontoinhaber<input value={bank.inhaber} autoComplete="name" onChange={(ev) => setBank({ ...bank, inhaber: ev.target.value })} /></label>
              <label>IBAN<input value={bank.iban} autoComplete="off" inputMode="text" placeholder="DE…" onChange={(ev) => setBank({ ...bank, iban: ev.target.value })} /></label>
            </div>
            <div className="kpb-tun">
              <button type="button" className="kpb-knopf" disabled={laeuft === "bank" || bank.inhaber.trim().length < 3 || bank.iban.replace(/\s/g, "").length < 15}
                onClick={() => void senden("bank", "/bank", bank).then((j) => { if (j) { setBank({ inhaber: "", iban: "" }); setAendern(false); } })}>
                {laeuft === "bank" ? "Speichert …" : "Bankverbindung speichern"}
              </button>
              {e.bank && <button type="button" className="kpb-knopf still" onClick={() => setAendern(false)}>Abbrechen</button>}
            </div>
            <p className="kpb-fein">Wird verschlüsselt gespeichert und nur für Ihre Provisionen genutzt.</p>
          </>
        )}
      </div>
    </section>
  );
}
/** E-419: Ihre Empfehlungen an FIAON — wer von Ihnen kam, was er gezahlt hat und Ihre Provision; dazu „Jemanden empfehlen“. */
function IhreEmpfehlungen({ e, laeuft, senden }: { e: Empfehlungen; laeuft: string | null; senden: (was: string, pfad: string, body: unknown) => Promise<any> }) {
  const [form, setForm] = useState({ name: "", telefon: "", email: "", notiz: "", einverstanden: false });
  const T = KOOP_EMPFEHLUNG_TEXTE;
  return (
    <section className="kpb-karte kpb-empf" aria-label={T.titel}>
      <h2>{T.titel}{e.liste.length > 0 && <span className="kpb-zahl-marke">{e.liste.length}</span>}</h2>
      {e.prozent != null && <p className="kpb-fein">{T.sub(e.prozent)}</p>}
      <div className="kpb-jahr-kacheln">
        <div><small>Empfehlungen</small><b>{e.liste.length}</b></div>
        <div><small>Ihre Provision</small><b>{e.summe.provision}</b></div>
        <div><small>Davon offen</small><b>{e.summe.offen}</b></div>
      </div>
      {e.liste.length === 0 ? <p className="kpb-fein">{T.leer}</p> : (
        <ul className="kpb-rechnungen kpb-empf-liste">
          {e.liste.map((x) => (
            <li key={x.id}>
              <span><b>{x.name}</b> · gemeldet {x.gemeldetText}</span>
              <span><em className={x.stand === "kunde" ? "gut" : x.stand === "im_gespraech" ? "offen" : ""}>{x.standText}</em> · Umsatz {x.umsatz}</span>
              <span>Provision <b>{x.provision}</b>{x.ausgezahlt !== "0,00 €" ? ` · ausgezahlt ${x.ausgezahlt}` : ""}<small className="kpb-fein"> · zählt bis {x.bisText}</small></span>
            </li>
          ))}
        </ul>
      )}
      <div className="kpb-empf-form">
        <h3>{T.meldenTitel}</h3>
        <p className="kpb-fein">{T.meldenHinweis}</p>
        <div className="kpb-felder">
          <label>Name (Person oder Firma)<input value={form.name} onChange={(ev) => setForm({ ...form, name: ev.target.value })} /></label>
          <label>Telefon<input type="tel" value={form.telefon} onChange={(ev) => setForm({ ...form, telefon: ev.target.value })} /></label>
          <label>E-Mail<input type="email" value={form.email} onChange={(ev) => setForm({ ...form, email: ev.target.value })} /></label>
        </div>
        <label className="kpb-voll">Worum geht es? (freiwillig)<textarea rows={2} maxLength={500} value={form.notiz} onChange={(ev) => setForm({ ...form, notiz: ev.target.value })} /></label>
        <label className="kpb-haken"><input type="checkbox" checked={form.einverstanden} onChange={(ev) => setForm({ ...form, einverstanden: ev.target.checked })} /> {T.einverstanden}</label>
        <div className="kpb-tun">
          <button type="button" className="kpb-knopf" disabled={laeuft === "empf" || form.name.trim().length < 3 || !form.einverstanden}
            onClick={() => void senden("empf", "/empfehlung", form).then((j) => { if (j) setForm({ name: "", telefon: "", email: "", notiz: "", einverstanden: false }); })}>
            {laeuft === "empf" ? "Speichert …" : "Empfehlung senden"}
          </button>
        </div>
      </div>
      <p className="kpb-fein">{T.fein}</p>
    </section>
  );
}
const eurKurz = (c: number) => `${Math.round(c / 100).toLocaleString("de-DE")} €`;
const MON_KURZ = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

/** Ihr Jahr in Zahlen: sechs Monate als Balken, dazu Summe, Quote ohne Reklamation und der laufende Monat. */
function JahrInZahlen({ v, einheit, platz = false }: { v: NonNullable<Sicht["verlauf"]>; einheit: string; platz?: boolean }) {
  const max = Math.max(1, ...v.map((x) => x.kontakte));
  const gesamt = v.reduce((s, x) => s + x.kontakte, 0);
  const rekl = v.reduce((s, x) => s + x.reklamiert, 0);
  const summe = v.reduce((s, x) => s + x.betragCents, 0);
  const quote = gesamt ? Math.round(((gesamt - rekl) / gesamt) * 100) : 100;
  return (
    <section className="kpb-karte kpb-jahr" aria-label="Ihr Jahr in Zahlen">
      <h2>Ihr Jahr in Zahlen</h2>
      <div className="kpb-jahr-kacheln">
        <div><small>{einheit} · 6 Monate</small><b>{gesamt.toLocaleString("de-DE")}</b></div>
        {platz ? <div><small>Ø je Monat</small><b>{Math.round(gesamt / Math.max(1, v.length))}</b></div> : <div><small>Ohne Reklamation</small><b>{quote}<i>%</i></b></div>}
        <div><small>Abgerechnet netto</small><b>{eurKurz(summe)}</b></div>
      </div>
      <div className="kpb-balken" role="img" aria-label={v.map((x) => `${x.monatText}: ${x.kontakte}`).join(", ")}>
        {v.map((x, i) => (
          <div key={x.monat} className={x.laufend ? "laufend" : ""}>
            <em>{x.kontakte}</em>
            <span style={{ height: `${Math.max(4, (x.kontakte / max) * 100)}%`, animationDelay: `${i * 0.09}s` }} />
            <small>{MON_KURZ[Number(x.monat.slice(5, 7)) - 1]}</small>
          </div>
        ))}
      </div>
    </section>
  );
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
  const [alle, setAlle] = useState(false);
  const demo = token === "demo";
  const demoBereich = ((): NetzBereich => {
    const b = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("bereich") : null;
    return (NETZ_BEREICHE as string[]).includes(String(b)) ? (b as NetzBereich) : "vorsorge";
  })();

  const laden = useCallback(async () => {
    if (demo) {
      const d = demoSicht(demoBereich);
      setSicht(d); setZeiten(d.stand.zeiten); setWunsch(d.stand.woche.wunsch);
      return;
    }
    const r = await fetch(`/api/fiaon/koop/partner/${encodeURIComponent(token)}`).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    if (!r?.ok || !j?.ok) { setFehler(j?.error ?? "Ihr Partnerbereich ließ sich gerade nicht laden."); return; }
    setSicht(j);
    if (j.stand.zeiten) setZeiten(j.stand.zeiten);
    if (j.stand.woche.wunsch) setWunsch(j.stand.woche.wunsch);
  }, [token, demo, demoBereich]);
  useEffect(() => { document.title = demo ? "Demo-Zugang Partnerbereich · FIAON" : "Ihr Partnerbereich · FIAON"; void laden(); }, [laden, demo]);

  async function senden(was: string, pfad: string, body: unknown) {
    if (demo) { setMeldung("Demo-Zugang: Im echten Partnerbereich wird das jetzt gespeichert — hier bleibt alles, wie es ist."); setRekl(null); return null; }
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
  const einheit = sicht.demoWorte?.einheit ?? sicht.einheit ?? "Kontakte";
  const zeigen = alle ? sicht.kontakte : sicht.kontakte.slice(0, 12);
  return (
    <main className={`kpb${demo ? " kpb-demo" : ""}`}>
      <div className="kpb-rahmen">
        {demo && (
          <div className="kpb-demoband" role="note">
            <div><b>Demo-Zugang</b><span>So sieht Ihr Partnerbereich aus — mit erfundenen Beispieldaten. Nichts hier wird gespeichert.</span></div>
            <div className="kpb-reihe">
              {NETZ_BEREICHE.map((b) => <a key={b} href={`/partner/demo?bereich=${b}`} className={`kpb-chip${b === demoBereich ? " an" : ""}`}>{NETZ_BEREICH_NAME[b].de}</a>)}
            </div>
            <a className="kpb-knopf" href={`${NETZ_PFAD.de[demoBereich]}#bewerbung`}>Jetzt bewerben</a>
          </div>
        )}
        <p className="kpb-marke">FIAON · Partner-Kooperation</p>
        <h1>Willkommen in Ihrem Partnerbereich, {sicht.gruss}.</h1>
        <p className="kpb-lead">{sicht.modell === "abschluss" || sicht.demoWorte?.ohneZeiten ? "Hier geben Sie Ihre Zeiten frei, sehen jeden Kunden und melden Abschlüsse mit einem Klick." : sicht.modell === "platz" || sicht.demoWorte?.platz ? "Hier geben Sie Ihre Zeiten frei und sehen jeden Termin und jede Rechnung." : "Hier geben Sie Ihre Zeiten frei, sehen jeden Termin und reklamieren mit einem Klick."} {demo ? `${sicht.partner} · ${sicht.preis}` : sicht.berechnungAusgesetzt ? `Vertrag ${sicht.ref} · für die Zusammenarbeit berechnen wir derzeit nichts` : `Vertrag ${sicht.ref} · ${sicht.preis}${sicht.modell && sicht.modell !== "kontakt" ? "" : " netto je Kontakt"}`}.</p>

        <section className="kpb-stand" aria-label="Ihr Stand">
          <div><small>Diese Woche</small><b>{s.woche.geliefert} <span>von {s.woche.wunsch}</span></b></div>
          <div><small>Dieser Monat</small><b>{s.monat.geliefert} <span>{einheit}</span></b></div>
          {s.startRahmen && <div><small>Start-Rahmen</small><b>{s.startRahmen.geliefert} <span>von {s.startRahmen.deckel}</span></b></div>}
          {s.ersatzOffen > 0 && <div><small>Ersatz offen</small><b>{s.ersatzOffen}</b></div>}
          <p className="kpb-stand-zeile">{s.ruht ? `Die Übermittlung ruht, bis Rechnung ${s.ruht.rechnung} bezahlt ist — vereinbarte Termine bleiben.` : !s.zeiten ? "Bitte geben Sie unten Ihre Zeiten frei — dann vereinbaren wir die ersten Termine." : s.sperre ? s.sperre : "Alles bereit — wir vereinbaren Termine in Ihren Zeiten."}</p>
        </section>

        {meldung && <p className="kpb-meldung" role="status">{meldung}</p>}

        {sicht.empfehlungen && <IhreEmpfehlungen e={sicht.empfehlungen} laeuft={laeuft} senden={async (was, pfad, body) => { const j = await senden(was, pfad, body); if (j) setMeldung("Danke — Ihre Empfehlung steht in Ihrer Liste. Wir melden uns bei der Person."); return j; }} />}
        {sicht.empfehlungen && sicht.empfehlungen.prozent != null && <IhreAuszahlungen e={sicht.empfehlungen} token={token} laeuft={laeuft} senden={async (was, pfad, body) => { const j = await senden(was, pfad, body); if (j) setMeldung(`Gespeichert: ${j.maske}. Ihre Provisionen überweisen wir auf dieses Konto.`); return j; }} />}

        {sicht.verlauf && sicht.verlauf.length > 0 && <JahrInZahlen v={sicht.verlauf} einheit={einheit} platz={!!sicht.demoWorte?.platz || sicht.modell === "platz"} />}

        {!sicht.demoWorte?.ohneZeiten && <section className="kpb-karte">
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
        </section>}

        <section className="kpb-karte">
          <h2>Ihre Menge je Woche</h2>
          <div className="kpb-tun">
            <input className="kpb-zahl" type="number" min={1} max={500} value={wunsch} onChange={(e) => setWunsch(Number(e.target.value))} aria-label="Kontakte je Woche" />
            <span>{einheit} je Woche</span>
            <button type="button" className="kpb-knopf still" disabled={laeuft === "wunsch"} onClick={() => void senden("wunsch", "/wunsch", { wunschWoche: wunsch }).then((j) => j && setMeldung(`Gespeichert: ${j.wunschWoche} Kontakte je Woche.`))}>Menge speichern</button>
          </div>
        </section>

        <section className="kpb-karte">
          <h2>{sicht.demoWorte?.kontakteTitel ?? sicht.kontakteTitel ?? "Ihre Termine"}{sicht.kontakte.length > 0 && <span className="kpb-zahl-marke">{sicht.kontakte.length}</span>}</h2>
          {sicht.kontakte.length === 0 ? <p className="kpb-fein">Noch keine übermittelten Kontakte.</p> : (
            <ul className="kpb-kontakte">
              {zeigen.map((k) => (
                <li key={k.id} className={k.status === "reklamiert" ? "still" : ""}>
                  <div className="kpb-kontakt-kopf"><b>{k.name}</b><span>{k.terminText} · {k.art}{k.dauerMin ? ` · ${k.dauerMin} Min.` : ""}</span></div>
                  <p>{k.thema}{k.ersatz ? " · Ersatzkontakt" : ""}</p>
                  <p className="kpb-fein"><a href={`tel:${k.telefon}`}>{k.telefon}</a> · <a href={`mailto:${k.email}`}>{k.email}</a></p>
                  {k.notiz && <p className="kpb-notiz">„{k.notiz}“</p>}
                  {k.reklamation && <p className={`kpb-rekl ${k.reklamation.ergebnis}`}>Reklamation ({k.reklamation.grund}): {k.reklamation.begruendung}</p>}
                  {k.keinKontakt && <p className="kpb-fein">Gemeldet: kein Kontakt mehr gewünscht.</p>}
                  {k.abschluss?.am && <p className="kpb-rekl berechtigt">Abschluss gemeldet: {k.abschluss.art} · {k.abschluss.betrag} netto · {new Date(k.abschluss.am).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}</p>}
                  {k.abschluss?.kein && <p className="kpb-fein">Gemeldet: kein Abschluss — nichts berechnet.</p>}
                  {k.abschluss?.meldbar && (sicht.sparten ?? []).length > 0 && (
                    <div className="kpb-abschluss">
                      <span className="kpb-fein">Abschluss melden:</span>
                      {(sicht.sparten ?? []).map((sp) => <button key={sp.name} type="button" className="kpb-knopf klein" disabled={!!laeuft} onClick={() => void senden(`ab${k.id}`, `/kontakt/${k.id}/abschluss`, { sparte: sp.name }).then((j) => j && setMeldung(j.meldung))}>{sp.name} · {sp.betrag}</button>)}
                      <button type="button" className="kpb-knopf still klein" disabled={!!laeuft} onClick={() => void senden(`ab${k.id}`, `/kontakt/${k.id}/abschluss`, { sparte: "kein" }).then((j) => j && setMeldung(j.meldung))}>Kein Abschluss</button>
                    </div>
                  )}
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
          {sicht.kontakte.length > 12 && <button type="button" className="kpb-knopf still" onClick={() => setAlle((a) => !a)}>{alle ? "Weniger zeigen" : `Alle ${sicht.kontakte.length} anzeigen`}</button>}
        </section>

        <section className="kpb-karte">
          <h2>Ihre Rechnungen</h2>
          {sicht.rechnungen.length === 0 ? <p className="kpb-fein">{sicht.berechnungAusgesetzt ? "Für die Zusammenarbeit berechnen wir derzeit nichts — hier erscheint keine Rechnung." : "Die erste Rechnung kommt am Ersten des Folgemonats — mit Aufstellung jedes Kontakts."}</p> : (
            <ul className="kpb-rechnungen">
              {sicht.rechnungen.map((r) => (
                <li key={r.monat}>
                  <span><b>{r.monatText}</b> · {r.anzahl} {einheit}{r.gutschrift ? ` · Gutschrift ${r.gutschrift}` : ""}</span>
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
