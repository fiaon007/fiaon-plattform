// ═══════════════════════════════════════════════════════════════════════════
// /chef/s/auskunft — AUSKUNFT-VERKAUF (24.09.2026, E-240)
//
// Justin: Die Bonitätsauskunft soll „weggehen wie warme Semmeln", Ziel 150 am
// Tag. Die Seite sagt ehrlich, wo wir stehen: bestellt und bezahlt heute
// gegen das Ziel, die letzten 14 Tage, wer sie noch nicht hat (und wen wir
// davon nach § 7 Abs. 3 UWG überhaupt von uns aus anschreiben dürfen), wer
// bestellt und nicht bezahlt hat, wer bezahlt hat und noch wartet. Dazu der
// Schalter des Verkaufstakts und die WhatsApp-Vorlage, die erst bei Meta
// freigegeben werden muss.
//
// Server: server/routes/fiaon-chef-auskunft.ts · Regeln: server/lib/fiaon-auskunft-verkauf.ts
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { API, seit, zahl, eur, Geruest, Fehlermeldung, useDaten } from "./chef-teile";
// Die Preise aus der EINEN Quelle — nie ein Literal (74 € stand an 139 Stellen, E-240).
import { auskunftPreisZeile } from "@shared/fiaon-auskunft";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "@/pages/agent/rundgaenge";
import "@/styles/office-rundgang.css";
import "@/styles/chef-auskunft.css";

type Land = "DE" | "AT" | "CH";
interface Tag { tag: string; bestellt: number; bezahlt: number; umsatzCents: number }
interface Pool {
  gesamt: number; werbesperre: number; waStopp: number; widerspruch: number; nichtZustellbar: number; nachStichtag: number;
  automatisch: number; nurGezaehlt: number; mitWhatsAppEinwilligung: number; schonAngeschrieben: number; fertig: number;
  jeLand: { land: Land; gesamt: number; automatisch: number; werbesperre: number }[];
}
interface Offen {
  ref: string; personId: number | null; name: string; status: string; gemeldetAm: string | null; betrag: string | null;
  angelegt: string; tage: number; land: Land; betreuer: string | null; werbesperre: boolean;
  zahlungsseite: string | null; verwendungszweck: string | null;
}
interface Rueck { personId: number; ref: string; name: string; land: string; auskunfteien: string; gekauftAm: string; tageSeitKauf: number; betreuer: string | null; vorgaenge: number }
interface Stand {
  stand: string;
  ziel: number;
  heute: Tag;
  tage: Tag[];
  pool: Pool;
  offen: Offen[];
  rueckstand: { zeilen: Rueck[]; quelle: "lieferung" | "eigen" };
  takt: {
    an: boolean; proTag: number; hoechstensProTag: number;
    heute: { mails: number; whatsapp: number; gesamt: number };
    sendezeit: boolean; stichtag: string; hoechstensBeruehrungen: number;
    whatsapp: { moeglich: boolean; grund: string | null };
  };
  wirkung30: { angeschrieben: number; bestellt: number; bezahlt: number; whatsapp: number };
  vorlage: { name: string; kopf: string; fuss: string; kategorie: string; text: string; beispiel: string; knoepfe: string[]; entwurf: boolean; freigegeben: boolean | null } | null;
}
interface VorschauZeile { personId: number; name: string; land: Land; art: "privat" | "firma"; schritt: "mail1" | "whatsapp" | "mail2" | null; mail: string; kundeSeit: string | null; ersteMailAm: string | null }

const LAND: Record<string, string> = { DE: "Deutschland", AT: "Österreich", CH: "Schweiz" };
const SCHRITT: Record<string, string> = { mail1: "1. Mail", whatsapp: "WhatsApp", mail2: "2. Mail" };
const WOCHENTAG = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
/** „Mo 22." — am Handy nur „22.", sonst stoßen vierzehn Beschriftungen aneinander. */
const tagKurz = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  return <><i className="ak-wt">{WOCHENTAG[d.getDay()]} </i>{d.getDate()}.</>;
};
const stichtagText = (iso: string) => new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });

async function senden(pfad: string, body: unknown): Promise<any> {
  const r = await fetch(`${API}${pfad}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok) throw new Error(j?.error || "Das hat nicht geklappt.");
  return j;
}

export default function ChefAuskunft() {
  const stand = useDaten<Stand>("/chef/auskunft");
  const s = stand.daten;
  const [beschaeftigt, setBeschaeftigt] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [deckel, setDeckel] = useState<string>("");
  const [vorschau, setVorschau] = useState<{ zeilen: VorschauZeile[]; waGrund: string | null; restHeute: number } | null>(null);
  const [alleOffen, setAlleOffen] = useState(false);
  const [alleRueck, setAlleRueck] = useState(false);

  useEffect(() => { if (s) setDeckel(String(s.takt.proTag)); }, [s?.takt.proTag]);

  const melden = (t: string) => { setMeldung(t); window.setTimeout(() => setMeldung(null), 7000); };

  const schalten = async (an: boolean) => {
    if (!s) return;
    if (an && !window.confirm(
      `Verkaufstakt einschalten?\n\nAb dem nächsten Takt (alle 30 Minuten, 8–20 Uhr) bekommen bis zu ${s.takt.proTag} Kunden am Tag das Angebot per E-Mail — `
      + `nur wer nach dem ${stichtagText(s.takt.stichtag)} zum ersten Mal beantragt hat (§ 7 Abs. 3 UWG), höchstens ${s.takt.hoechstensBeruehrungen} Berührungen je Kunde.`)) return;
    setBeschaeftigt("schalter");
    try {
      await senden("/chef/auskunft/einstellung", { key: "auskunft_verkauf_an", value: an ? "1" : "0" });
      melden(an ? "Der Verkaufstakt läuft — der nächste Takt schreibt an, wer heute dran ist." : "Der Verkaufstakt ist aus. Es geht nichts mehr raus.");
      stand.neu();
    } catch (err: any) { melden(err.message); } finally { setBeschaeftigt(null); }
  };
  const deckelSpeichern = async () => {
    setBeschaeftigt("deckel");
    try { await senden("/chef/auskunft/einstellung", { key: "auskunft_verkauf_pro_tag", value: deckel.trim() }); melden(`Tagesdeckel: ${deckel.trim()}.`); stand.neu(); }
    catch (err: any) { melden(err.message); } finally { setBeschaeftigt(null); }
  };
  const vorschauLaden = async () => {
    setBeschaeftigt("vorschau");
    try {
      const r = await fetch(`${API}/chef/auskunft/vorschau`, { credentials: "include" });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Die Vorschau ließ sich nicht laden.");
      setVorschau({ zeilen: j.zeilen ?? [], waGrund: j.waGrund ?? null, restHeute: Number(j.restHeute || 0) });
    } catch (err: any) { melden(err.message); } finally { setBeschaeftigt(null); }
  };
  // Integration 25.09.2026 (E-240): Die Lieferung des Rückstands von Hand starten — die Lieferung
  // selbst verweist in ihren Aufgaben hierher („… im Chefbüro unter Auskunft-Rückstand neu starten").
  const liefern = async (r: Rueck, mail: boolean) => {
    if (!window.confirm(mail
      ? `Lieferung für ${r.name} starten?\n\nEs entstehen die Anfragen an ${r.auskunfteien}, der Betreuer bekommt die Aufgabe, und der Kunde bekommt per Mail den Link zur Unterschrift (Vollmacht und Anfragen).`
      : `Lieferung für ${r.name} ohne Mail starten?\n\nEs entstehen die Anfragen und die Aufgabe; der Betreuer holt die Unterschrift im Gespräch.`)) return;
    setBeschaeftigt(`liefern:${r.ref}`);
    try {
      const j = await senden("/chef/auskunft/lieferung", { ref: r.ref, mail });
      melden(String(j.lieferung?.text || "Erledigt."));
      stand.neu();
    } catch (err: any) { melden(err.message); } finally { setBeschaeftigt(null); }
  };
  const kopieren = async (text: string) => {
    try { await navigator.clipboard.writeText(text); melden("Zahlungslink kopiert."); } catch { melden("Kopieren ging nicht — bitte den Link öffnen und dort kopieren."); }
  };

  const maxTag = s ? Math.max(1, ...s.tage.map((t) => Math.max(t.bestellt, t.bezahlt))) : 1;
  const anteil = (n: number) => `${Math.min(100, s && s.ziel > 0 ? (n / s.ziel) * 100 : 0)}%`;
  const summe14 = s ? s.tage.reduce((a, t) => ({ bestellt: a.bestellt + t.bestellt, bezahlt: a.bezahlt + t.bezahlt, umsatz: a.umsatz + t.umsatzCents }), { bestellt: 0, bezahlt: 0, umsatz: 0 }) : null;
  const offenListe = s ? (alleOffen ? s.offen : s.offen.slice(0, 12)) : [];
  const rueckListe = s ? (alleRueck ? s.rueckstand.zeilen : s.rueckstand.zeilen.slice(0, 12)) : [];

  return (
    <div className="ak">
      <Rundgang raum="auskunft" titel="Auskunft-Verkauf" schritte={RUNDGAENGE.auskunft.schritte} />
      {stand.laedt && !s && <Geruest zeilen={8} />}
      {stand.fehler && <Fehlermeldung text={stand.fehler} erneut={stand.neu} />}
      {s && (
        <>
          <header className="ak-kopf">
            <div>
              <h1>Auskunft-Verkauf</h1>
              <p>
                Bonitätsauskunft mit Handlungsplan — privat {auskunftPreisZeile("privat")}; Firma {auskunftPreisZeile("firma")}.
                Stand {seit(s.stand)}.
              </p>
            </div>
            <button type="button" className={`ak-schalter${s.takt.an ? " an" : ""}`} aria-pressed={s.takt.an}
              onClick={() => void schalten(!s.takt.an)} disabled={beschaeftigt === "schalter"}>
              <span aria-hidden="true" />{s.takt.an ? "Verkaufstakt läuft" : "Verkaufstakt aus"}
            </button>
          </header>

          {/* ── Heute gegen das Ziel ───────────────────────────────────── */}
          <section className="ak-ziel" aria-label="Heute gegen das Ziel">
            <div className="ak-ziel-zahlen">
              <div className="ak-ziel-zahl"><span>Bestellt heute</span><b>{zahl(s.heute.bestellt)}<small>/ {zahl(s.ziel)}</small></b></div>
              <div className="ak-ziel-zahl bezahlt"><span>Bezahlt heute</span><b>{zahl(s.heute.bezahlt)}</b></div>
              <div className="ak-ziel-zahl"><span>Umsatz heute</span><b>{eur(s.heute.umsatzCents)}</b></div>
            </div>
            <div className="ak-balken" role="img" aria-label={`${s.heute.bestellt} von ${s.ziel} bestellt, ${s.heute.bezahlt} bezahlt`}>
              <i className="bestellt" style={{ width: anteil(s.heute.bestellt) }} />
              <i className="bezahlt" style={{ width: anteil(s.heute.bezahlt) }} />
            </div>
            <div className="ak-balken-legende">
              <em>bestellt</em><em className="bezahlt">bezahlt</em>
              <span>Ziel {zahl(s.ziel)} am Tag · heute {Math.round((s.heute.bestellt / Math.max(1, s.ziel)) * 100)} % bestellt</span>
            </div>
          </section>

          {/* ── 14 Tage ─────────────────────────────────────────────────── */}
          <section className="ak-karte ak-verlauf" aria-label="Die letzten 14 Tage">
            <div className="ak-karte-kopf">
              <h2>Die letzten 14 Tage</h2>
              {summe14 && <span className="ak-still">{zahl(summe14.bestellt)} bestellt · {zahl(summe14.bezahlt)} bezahlt · {eur(summe14.umsatz)}</span>}
            </div>
            <div className="ak-tage">
              {s.tage.map((t, i) => (
                <div key={t.tag} className={`ak-tag${i === s.tage.length - 1 ? " heute" : ""}`} title={`${t.tag}: ${t.bestellt} bestellt, ${t.bezahlt} bezahlt`}>
                  <b>{t.bestellt || t.bezahlt ? `${t.bestellt}/${t.bezahlt}` : "·"}</b>
                  <div className="ak-tag-saeulen" aria-hidden="true">
                    <i style={{ height: `${(t.bestellt / maxTag) * 100}%` }} />
                    <i className="bezahlt" style={{ height: `${(t.bezahlt / maxTag) * 100}%` }} />
                  </div>
                  <span>{tagKurz(t.tag)}</span>
                </div>
              ))}
            </div>
          </section>

          <div className="ak-raster">
            {/* ── Wer sie noch nicht hat ─────────────────────────────────── */}
            <section className="ak-karte ak-pool" aria-label="Zahlende Kunden ohne Auskunft">
              <div className="ak-karte-kopf">
                <h2>Zahlende Kunden ohne Auskunft</h2>
                <span className="ak-still">laufendes Paket, nichts bestellt, nichts hochgeladen, nicht gekündigt</span>
              </div>
              <div className="ak-zahlen">
                <div className="ak-zahl"><span>Gesamt</span><b>{zahl(s.pool.gesamt)}</b><small>{zahl(s.pool.schonAngeschrieben)} schon angeschrieben</small></div>
                <div className="ak-zahl"><span>Automatisch erlaubt</span><b className="blau">{zahl(s.pool.automatisch)}</b><small>§ 7 Abs. 3 UWG</small></div>
                <div className="ak-zahl"><span>Nur gezählt</span><b className="gelb">{zahl(s.pool.nurGezaehlt)}</b><small>erster Antrag vor dem Stichtag</small></div>
                <div className="ak-zahl"><span>Werbesperre</span><b>{zahl(s.pool.widerspruch)}</b><small>oder „Stopp“ · nie anschreiben</small></div>
                <div className="ak-zahl"><span>Nicht zustellbar</span><b>{zahl(s.pool.nichtZustellbar)}</b><small>Rückläufer, Spam, blockiert</small></div>
                <div className="ak-zahl"><span>WhatsApp-Einwilligung</span><b>{zahl(s.pool.mitWhatsAppEinwilligung)}</b><small>nachgewiesen</small></div>
              </div>
              <p className="ak-hinweis">
                <b>Warum so wenige automatisch?</b> Werbung per E-Mail oder WhatsApp an Bestandskunden ohne Einwilligung erlaubt
                § 7 Abs. 3 UWG nur, wenn der Kunde schon bei der Angabe seiner Adresse auf sein Widerspruchsrecht hingewiesen wurde.
                Dieser Hinweis steht erst seit dem {stichtagText(s.takt.stichtag)} im Antrag. Alle anderen erreicht das Angebot im
                Kundenbereich, über ihren Betreuer im Gespräch und über Mara, sobald sie selbst schreiben.
              </p>
              <div className="ak-tabelle-huelle">
                <table className="ak-tabelle">
                  <thead><tr><th>Land</th><th className="r">Ohne Auskunft</th><th className="r">Automatisch</th><th className="r">Werbesperre</th></tr></thead>
                  <tbody>
                    {s.pool.jeLand.map((l) => (
                      <tr key={l.land}><td>{LAND[l.land] ?? l.land}</td><td className="r">{zahl(l.gesamt)}</td><td className="r">{zahl(l.automatisch)}</td><td className="r">{zahl(l.werbesperre)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ── Der Verkaufstakt ───────────────────────────────────────── */}
            <section className="ak-karte ak-takt" aria-label="Verkaufstakt">
              <div className="ak-karte-kopf">
                <h2>Verkaufstakt</h2>
                <span className={`ak-marke${s.takt.an ? " gruen" : ""}`}>{s.takt.an ? (s.takt.sendezeit ? "läuft" : "läuft · Nachtruhe bis 8 Uhr") : "aus"}</span>
              </div>
              <p className="ak-leise">
                Alle 30 Minuten zwischen 8 und 20 Uhr: zuerst die Angebots-Mail, frühestens nach 3 Tagen eine WhatsApp (nur mit
                Einwilligung und freigegebener Vorlage), nach 7 Tagen die zweite Mail — höchstens {s.takt.hoechstensBeruehrungen} Berührungen.
                Kauf, Upload, Werbesperre, „Stopp“ oder Kündigung beenden es sofort.
              </p>
              <div className="ak-zahlen">
                <div className="ak-zahl"><span>Heute</span><b>{zahl(s.takt.heute.gesamt)}<span className="ak-still"> / {zahl(s.takt.proTag)}</span></b><small>Berührungen gegen den Deckel</small></div>
                <div className="ak-zahl"><span>Mails</span><b>{zahl(s.takt.heute.mails)}</b><small>Angebote heute</small></div>
                <div className="ak-zahl"><span>WhatsApp</span><b>{zahl(s.takt.heute.whatsapp)}</b><small>Vorlagen heute</small></div>
              </div>
              <div className="ak-takt-zeile">
                <label>Tagesdeckel
                  <input type="number" min={0} max={s.takt.hoechstensProTag} value={deckel} onChange={(e) => setDeckel(e.target.value)} inputMode="numeric" />
                </label>
                <button type="button" className="ak-knopf" onClick={() => void deckelSpeichern()} disabled={beschaeftigt === "deckel" || deckel.trim() === String(s.takt.proTag)}>
                  {beschaeftigt === "deckel" ? "Speichert …" : "Speichern"}
                </button>
                <span className="ak-still">0 bis {zahl(s.takt.hoechstensProTag)} · Mails und WhatsApp zusammen</span>
              </div>
              {!s.takt.whatsapp.moeglich && s.takt.whatsapp.grund && (
                <p className="ak-hinweis warn">WhatsApp-Schritt ruht: {s.takt.whatsapp.grund} Bis dahin bekommt jeder die zwei Mails.</p>
              )}
              <div className="ak-takt-zeile">
                <button type="button" className="ak-knopf ak-vorschau-knopf" onClick={() => void vorschauLaden()} disabled={beschaeftigt === "vorschau"}>
                  {beschaeftigt === "vorschau" ? "Lädt …" : "Wer wäre heute dran?"}
                </button>
                <span className="ak-still">nur lesen — es geht nichts raus</span>
              </div>
              {vorschau && (
                vorschau.zeilen.length === 0 ? (
                  <p className="ak-leer">Heute ist niemand dran{vorschau.restHeute <= 0 ? " — der Tagesdeckel ist erreicht." : " — alle, die automatisch dürfen, sind angeschrieben, warten auf den nächsten Schritt oder haben gerade eine andere Mail bekommen."}</p>
                ) : (
                  <div className="ak-tabelle-huelle">
                    <table className="ak-tabelle">
                      <thead><tr><th>Kunde</th><th>Schritt</th><th>Land</th><th>E-Mail</th><th>Erster Antrag</th></tr></thead>
                      <tbody>
                        {vorschau.zeilen.map((z) => (
                          <tr key={z.personId}>
                            <td><a href={`/chef/s/akte?id=${z.personId}`}>{z.name}</a>{z.art === "firma" ? <span className="ak-still"> · Firma</span> : null}</td>
                            <td>{z.schritt ? <span className="ak-marke blau">{SCHRITT[z.schritt]}</span> : <span className="ak-still">wartet</span>}</td>
                            <td>{z.land}</td>
                            <td className="ak-still">{z.mail}</td>
                            <td className="ak-still">{z.kundeSeit ? seit(z.kundeSeit) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
              <p className="ak-still">
                Wirkung 30 Tage: {zahl(s.wirkung30.angeschrieben)} per Mail angeschrieben · {zahl(s.wirkung30.bestellt)} danach bestellt · {zahl(s.wirkung30.bezahlt)} bezahlt · {zahl(s.wirkung30.whatsapp)} WhatsApp
              </p>
            </section>
          </div>

          {/* ── WhatsApp-Vorlage ─────────────────────────────────────────── */}
          {s.vorlage && (
            <section className="ak-karte ak-vorlage" aria-label="WhatsApp-Vorlage">
              <div className="ak-karte-kopf">
                <h2>WhatsApp-Vorlage „{s.vorlage.name}“</h2>
                {s.vorlage.freigegeben
                  ? <span className="ak-marke gruen">bei Meta freigegeben</span>
                  : <span className="ak-marke gelb">{s.vorlage.entwurf ? "Entwurf — muss bei Meta freigegeben werden" : "wartet auf Meta"}</span>}
              </div>
              <p className="ak-leise">
                Kategorie {s.vorlage.kategorie === "MARKETING" ? "Marketing (Werbung)" : s.vorlage.kategorie}. Sie liegt bereit, ist aber NICHT
                eingereicht: Erst wenn du den Text freigibst, wird sie zu den eingereichten Vorlagen gelegt und im Postfach über
                „Vorlagen einreichen“ an Meta geschickt. Bis Meta sie freigibt, geht keine einzige WhatsApp damit raus — der Takt
                schickt statt dessen die zweite Mail.
              </p>
              <div className="ak-blase"><b>{s.vorlage.kopf}</b>{s.vorlage.beispiel}<small>{s.vorlage.fuss}</small></div>
              <div className="ak-blase-knoepfe">{s.vorlage.knoepfe.map((k) => <span key={k}>{k}</span>)}</div>
            </section>
          )}

          {/* ── Bestellt, nicht bezahlt ──────────────────────────────────── */}
          <section className="ak-karte ak-offen" aria-label="Bestellt, nicht bezahlt">
            <div className="ak-karte-kopf">
              <h2>Bestellt, nicht bezahlt ({zahl(s.offen.length)})</h2>
              <span className="ak-still">der Zahlungslink führt auf die Zahlungsseite mit QR-Code und Bankdaten</span>
            </div>
            {s.offen.length === 0 ? <p className="ak-leer">Keine offene Bestellung.</p> : (
              <div className="ak-tabelle-huelle">
                <table className="ak-tabelle">
                  <thead><tr><th>Kunde</th><th className="r">Betrag</th><th>Bestellt</th><th>Stand</th><th>Betreuer</th><th /></tr></thead>
                  <tbody>
                    {offenListe.map((o) => (
                      <tr key={o.ref}>
                        <td>{o.personId ? <a href={`/chef/s/akte?id=${o.personId}`}>{o.name}</a> : o.name}<span className="ak-still"> · {o.land}{o.werbesperre ? " · Werbesperre" : ""}</span></td>
                        <td className="r"><b>{o.betrag ?? "—"}</b></td>
                        <td className="ak-still">{seit(o.angelegt)}</td>
                        <td>{o.status === "claimed_paid" ? <span className="ak-marke gelb">Zahlung gemeldet</span> : <span className="ak-marke">offen · {o.tage} T.</span>}</td>
                        <td className="ak-still">{o.betreuer ?? "—"}</td>
                        <td className="ak-tat">
                          {o.zahlungsseite ? (
                            <>
                              <a className="ak-klein" href={o.zahlungsseite} target="_blank" rel="noreferrer">Zahlungsseite</a>
                              <button type="button" className="ak-klein" onClick={() => void kopieren(o.zahlungsseite!)}>Link kopieren</button>
                            </>
                          ) : <span className="ak-still">ohne Verwendungszweck</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {s.offen.length > 12 && (
              <button type="button" className="ak-klein ak-mehr" onClick={() => setAlleOffen(!alleOffen)}>{alleOffen ? "Weniger zeigen" : `Alle ${s.offen.length} zeigen`}</button>
            )}
          </section>

          {/* ── Bezahlt, nicht geliefert ─────────────────────────────────── */}
          <section className="ak-karte ak-rueckstand" aria-label="Bezahlt, nicht geliefert">
            <div className="ak-karte-kopf">
              <h2>Bezahlt, noch nicht geliefert ({zahl(s.rueckstand.zeilen.length)})</h2>
              <span className="ak-still">kein Auskunft-Dokument in der Akte · die ältesten zuerst</span>
            </div>
            {s.rueckstand.zeilen.length === 0 ? <p className="ak-leer">Kein Rückstand — jede bezahlte Auskunft liegt in der Akte.</p> : (
              <div className="ak-tabelle-huelle">
                <table className="ak-tabelle">
                  <thead><tr><th>Kunde</th><th>Bezahlt</th><th>Auskunfteien</th><th className="r">Anfragen</th><th>Betreuer</th><th /></tr></thead>
                  <tbody>
                    {rueckListe.map((r) => (
                      <tr key={r.ref}>
                        <td><a href={`/chef/s/akte?id=${r.personId}`}>{r.name}</a></td>
                        <td>{r.tageSeitKauf > 14 ? <span className="ak-marke gelb">vor {r.tageSeitKauf} Tagen</span> : <span className="ak-still">vor {r.tageSeitKauf} Tagen</span>}</td>
                        <td className="ak-still">{r.auskunfteien}</td>
                        <td className="r">{r.vorgaenge || "—"}</td>
                        <td className="ak-still">{r.betreuer ?? "—"}</td>
                        <td className="ak-tat">
                          {r.vorgaenge ? <span className="ak-still">läuft</span> : (
                            <>
                              <button type="button" className="ak-klein" disabled={beschaeftigt === `liefern:${r.ref}`} onClick={() => void liefern(r, true)}>
                                {beschaeftigt === `liefern:${r.ref}` ? "Startet …" : "Lieferung starten"}
                              </button>
                              <button type="button" className="ak-klein" disabled={beschaeftigt === `liefern:${r.ref}`} onClick={() => void liefern(r, false)}>ohne Mail</button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {s.rueckstand.zeilen.length > 12 && (
              <button type="button" className="ak-klein ak-mehr" onClick={() => setAlleRueck(!alleRueck)}>{alleRueck ? "Weniger zeigen" : `Alle ${s.rueckstand.zeilen.length} zeigen`}</button>
            )}
          </section>
        </>
      )}
      {/* Portal an <body>: Die Chefbüro-Hülle animiert mit transform — ein fester Platz darin säße sonst mitten auf der Seite. */}
      {meldung && createPortal(<div className="ak-meldung" role="status">{meldung}</div>, document.body)}
    </div>
  );
}
