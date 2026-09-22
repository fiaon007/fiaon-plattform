// ═══════════════════════════════════════════════════════════════════════════
// /chef/s/lead-motor — das Steuerpult des Lead-Motors (22.09.2026, E-210)
//
// Justin baut bei Meta (Firma, App, Token, Nummer, Formular) und schickt
// Zwischenstände. Hier sieht er, ob jeder Schritt angekommen ist, richtet die
// Verbindung mit einem Knopf ein, holt den Rückstand nach, schaltet die
// Begrüßungsmail und sieht jeden Lead mit Herkunft, Begrüßung, Klick und
// Antrag. Die Regeln selbst stehen in server/lib/fiaon-meta-leads.ts und
// server/lib/fiaon-lead-willkommen.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { API, seit, Geruest, Fehlermeldung, useDaten } from "./chef-teile";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "@/pages/agent/rundgaenge";
import "@/styles/office-rundgang.css";
import "@/styles/chef-lead-motor.css";

interface Pruefpunkt { key: string; titel: string; ok: boolean | null; text: string }
interface Kaestchen { key?: string; text?: string; is_required?: boolean }
interface Formular {
  id: string; name: string | null; status: string | null; kaestchen: Kaestchen[] | null;
  einwilligung_schluessel: string | null; einwilligung_von: string | null; leads_woche: number;
}
interface WaKnopf { typ: "URL" | "QUICK_REPLY"; text: string }
interface WaVorlage { name: string; kategorie: string; zweck: string; wann: string; text: string; beispiele: string[]; knoepfe: WaKnopf[] }
interface Stand {
  konfig: { bereit: boolean; fehlt: string[]; appId: string | null; zweiApps: boolean };
  adressen: { webhook: string; plattform: string };
  pruefliste: { am: string; punkte: Pruefpunkt[]; bereit: boolean } | null;
  willkommen: { an: boolean; testAdresse: string | null };
  zahlen: {
    heute: number; woche: number; begruesst: number; begruessungFehler: number; linkGeoeffnet: number; antrag: number;
    whatsappJa: number; jeWeg: Record<string, number>; klicks: { mail: number; whatsapp: number; sms: number; mitarbeiter: number };
  };
  letzterLead: { am: string; weg: string } | null;
  letzteMeldung: string | null;
  nachholBis: string | null;
  alarme: { id: number; art: string; text: string; erstellt_am: string; zuletzt_am: string; zaehler: number }[];
  formulare: Formular[];
  messung: Messung;
  ereignisNamen: { web: Record<string, string>; crm: Record<string, string> };
  texte: { einwilligung: string; vorlagen: WaVorlage[] };
  wegText: Record<string, string>;
}
interface Lead {
  id: number; personId: number | null; name: string; nameUnbrauchbar: boolean; email: string | null; telefon: string | null; am: string;
  weg: string; wegText: string; kampagne: string | null; gruppe: string | null; anzeige: string | null; formular: string | null;
  plattform: string | null; whatsapp: boolean | null;
  begruessung: { am: string | null; status: string | null; grund: string | null };
  link: { am: string | null; klicks: number };
  antrag: string | null;
  strecke: { stufe: number; stopp: string | null };
}
interface Messung {
  datensatz: string | null; web: boolean; crm: boolean;
  heute: { name: string; n: number }[]; offen: number; fehler: number; letzterFehler: string | null;
}
interface Ereignis {
  id: number; ereignis_id: string; name: string; quelle: string; ref: string | null; meta_lead_id: string | null;
  wert_cents: number | null; status: string; versuche: number; fehler: string | null; gesendet_am: string | null; created_at: string;
}
interface Meldung { id: number; empfangen_am: string; objekt: string; feld: string; status: string; versuche: number; fehler: string | null; lead_id: number | null }

const zeit = (s: string | null | undefined) => (s ? new Date(s).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const heuteIso = () => new Date().toISOString().slice(0, 10);

async function senden(pfad: string, body: unknown): Promise<any> {
  const r = await fetch(`${API}${pfad}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok) throw new Error(j?.error || "Das hat nicht geklappt.");
  return j;
}

/** Meta nennt die Ereignisse englisch — hier steht, was sie bei uns bedeuten. */
const EREIGNIS_TEXT: Record<string, string> = {
  InitiateCheckout: "Antrag begonnen",
  CompleteRegistration: "Antrag abgeschickt",
  Purchase: "Zahlung gebucht",
  Schedule: "Startgespräch gebucht",
  qualified_lead: "Lead hat den Antrag fertig",
  converted_lead: "Lead hat bezahlt",
};

const BEGRUESSUNG_TEXT: Record<string, string> = {
  gesendet: "Begrüßt", fehler: "Begrüßung fehlgeschlagen", ausgelassen: "Keine Begrüßung", aus: "Begrüßung war aus", laeuft: "Begrüßung läuft",
};

export default function ChefLeadMotor() {
  const stand = useDaten<Stand>("/chef/lead-motor/stand");
  const [wegFilter, setWegFilter] = useState("");
  const leads = useDaten<{ leads: Lead[] }>(`/chef/lead-motor/leads${wegFilter ? `?weg=${encodeURIComponent(wegFilter)}` : ""}`, [wegFilter]);
  const [meldungenOffen, setMeldungenOffen] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [beschaeftigt, setBeschaeftigt] = useState<string | null>(null);
  const [seitDatum, setSeitDatum] = useState("2026-09-21");
  const [nachholErgebnis, setNachholErgebnis] = useState<any | null>(null);
  const [vorschau, setVorschau] = useState<{ betreff: string; html: string; beispiel: boolean } | null>(null);
  const [datensatzFeld, setDatensatzFeld] = useState("");
  const [testCode, setTestCode] = useState("");
  const [ereignisseOffen, setEreignisseOffen] = useState(false);
  const s = stand.daten;

  const melden = (t: string) => { setMeldung(t); window.setTimeout(() => setMeldung(null), 7000); };
  const alles = () => { stand.neu(); leads.neu(); };

  const verbindung = async (einrichten: boolean) => {
    setBeschaeftigt(einrichten ? "einrichten" : "pruefen");
    try {
      const j = await senden("/chef/lead-motor/verbindung", { einrichten });
      melden(j.pruefliste?.bereit ? "Verbunden: Meta meldet jeden Lead direkt an die Plattform." : "Geprüft — die Liste sagt, was noch fehlt.");
      alles();
    } catch (err: any) { melden(err.message); } finally { setBeschaeftigt(null); }
  };
  const willkommenSchalten = async (an: boolean) => {
    if (an && !window.confirm("Begrüßungsmail einschalten?\n\nNur, wenn in Make im Szenario „FIAON Lead #1“ der Brevo-Weg (Weg 3) gelöscht ist — sonst bekommt jeder neue Lead zwei Begrüßungen.")) return;
    setBeschaeftigt("willkommen");
    try { await senden("/chef/lead-motor/willkommen", { an }); melden(an ? "Begrüßungsmail ist an — jeder neue Lead bekommt sie in Sekunden." : "Begrüßungsmail ist aus."); stand.neu(); }
    catch (err: any) { melden(err.message); } finally { setBeschaeftigt(null); }
  };
  const vorschauZeigen = async (leadId?: number) => {
    setBeschaeftigt("vorschau");
    try {
      const r = await fetch(`${API}/chef/lead-motor/willkommen/vorschau${leadId ? `?leadId=${leadId}` : ""}`, { credentials: "include" });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Die Vorschau ließ sich nicht bauen.");
      setVorschau({ betreff: j.betreff, html: j.html, beispiel: !!j.beispiel });
    } catch (err: any) { melden(err.message); } finally { setBeschaeftigt(null); }
  };
  const pruefversand = async () => {
    setBeschaeftigt("pruefung");
    try { const j = await senden("/chef/lead-motor/willkommen/pruefung", {}); melden(j.ergebnis?.grund || "Prüfversand gesendet."); }
    catch (err: any) { melden(err.message); } finally { setBeschaeftigt(null); }
  };
  const nachholen = async () => {
    if (!window.confirm(`Alle Leads seit ${new Date(seitDatum).toLocaleDateString("de-DE")} bei Meta abfragen und fehlende anlegen?\n\nWer schon da ist, wird nicht doppelt angelegt.`)) return;
    setBeschaeftigt("nachholen"); setNachholErgebnis(null);
    try { const j = await senden("/chef/lead-motor/nachholen", { seit: seitDatum }); setNachholErgebnis(j.ergebnis); alles(); }
    catch (err: any) { melden(err.message); } finally { setBeschaeftigt(null); }
  };
  const einwilligung = async (formularId: string, schluessel: string) => {
    try { await senden("/chef/lead-motor/einwilligung", { formularId, schluessel: schluessel || null }); melden("Gespeichert."); stand.neu(); }
    catch (err: any) { melden(err.message); }
  };
  const formulareNeu = async () => {
    setBeschaeftigt("formulare");
    try { const j = await senden("/chef/lead-motor/formulare", {}); melden(`${j.ergebnis?.formulare ?? 0} Formulare geladen.`); stand.neu(); }
    catch (err: any) { melden(err.message); } finally { setBeschaeftigt(null); }
  };
  const alarmErledigt = async (id: number) => {
    try { await senden(`/chef/lead-motor/alarm/${id}/erledigt`, {}); stand.neu(); } catch (err: any) { melden(err.message); }
  };
  const messungSchalten = async (welcher: "web" | "crm", an: boolean) => {
    setBeschaeftigt(`messung-${welcher}`);
    try {
      await senden("/chef/lead-motor/messung/schalter", { welcher, an });
      melden(welcher === "web"
        ? (an ? "Die Web-Messung ist an — Pixel und Server melden jeden Schritt im Antrag." : "Die Web-Messung ist aus.")
        : (an ? "Die Stufenmeldung ist an — Meta erfährt, welcher Lead zahlt." : "Die Stufenmeldung ist aus."));
      stand.neu();
    } catch (err: any) { melden(err.message); } finally { setBeschaeftigt(null); }
  };
  const datensatzSpeichern = async () => {
    setBeschaeftigt("datensatz");
    try { const j = await senden("/chef/lead-motor/messung/datensatz", { id: datensatzFeld }); melden(`Datensatz ${j.id} gespeichert.`); setDatensatzFeld(""); stand.neu(); }
    catch (err: any) { melden(err.message); } finally { setBeschaeftigt(null); }
  };
  const jetztSenden = async () => {
    setBeschaeftigt("senden");
    try { const j = await senden("/chef/lead-motor/messung/senden", {}); melden(`${j.ergebnis?.gesendet ?? 0} Ereignis(se) gemeldet${j.ergebnis?.fehler ? `, ${j.ergebnis.fehler} mit Fehler` : ""}.`); stand.neu(); }
    catch (err: any) { melden(err.message); } finally { setBeschaeftigt(null); }
  };
  const probe = async () => {
    setBeschaeftigt("probe");
    try { const j = await senden("/chef/lead-motor/messung/probe", { testCode }); melden(`Probe angekommen (${j.angenommen} Ereignis). Im Events-Manager unter „Testereignisse“ sichtbar.`); }
    catch (err: any) { melden(err.message); } finally { setBeschaeftigt(null); }
  };
  const kopieren = async (text: string) => {
    try { await navigator.clipboard.writeText(text); melden("Kopiert."); } catch { melden("Kopieren ging nicht — bitte markieren und kopieren."); }
  };

  const direkt = !!s?.konfig.bereit && !!s?.pruefliste?.bereit;
  const punktKlasse = !s ? "" : s.alarme.length ? " warn" : direkt ? " an" : s.konfig.bereit ? " halb" : "";
  const kopfSatz = !s ? "" : !s.konfig.bereit
    ? "Der Meta-Zugang fehlt noch — bis dahin kommen die Leads über Make (dort Weg 1 löschen, dann läuft es wieder). Jeden Schritt bei Meta siehst du hier."
    : direkt
      ? `Direkt von Meta. Letzter Lead ${s.letzterLead ? `${seit(s.letzterLead.am)} (${s.letzterLead.weg})` : "—"}.`
      : "Der Zugang ist eingetragen — jetzt „Verbindung einrichten“ drücken.";
  const wege = s ? Object.entries(s.zahlen.jeWeg).sort((a, b) => b[1] - a[1]) : [];

  return (
    <div className="lm">
      <Rundgang raum="lead-motor" titel="Lead-Motor" schritte={RUNDGAENGE.leadMotor.schritte} />
      {stand.laedt && !s && <Geruest zeilen={8} />}
      {stand.fehler && <Fehlermeldung text={stand.fehler} erneut={stand.neu} />}
      {s && (
        <>
          <header className="lm-kopf">
            <div className="lm-wer">
              <span className={`lm-punkt${punktKlasse}`} aria-hidden="true" />
              <div>
                <h1>Lead-Motor</h1>
                <p>{kopfSatz}</p>
              </div>
            </div>
            <div className="lm-kopf-rechts">
              <span className="lm-still">Letzte Meldung von Meta: {s.letzteMeldung ? seit(s.letzteMeldung) : "noch keine"}</span>
            </div>
          </header>

          {s.alarme.length > 0 && (
            <section className="lm-alarme" aria-label="Alarme">
              {s.alarme.map((a) => (
                <div key={a.id} className="lm-alarm">
                  <div>
                    <b>{a.text.split(" — ")[0]}</b>
                    <p>{a.text.split(" — ").slice(1).join(" — ") || a.text}</p>
                    <span className="lm-still">seit {zeit(a.erstellt_am)}{a.zaehler > 1 ? ` · ${a.zaehler}× gemeldet` : ""}</span>
                  </div>
                  <button className="lm-klein" onClick={() => alarmErledigt(a.id)}>Erledigt</button>
                </div>
              ))}
            </section>
          )}

          <section className="lm-zahlen" aria-label="Kennzahlen der letzten 7 Tage">
            <Zahl titel="Leads heute" wert={s.zahlen.heute} unter={`${s.zahlen.woche} in 7 Tagen`} />
            <Zahl titel="Begrüßt" wert={s.zahlen.begruesst} unter={s.zahlen.begruessungFehler ? `${s.zahlen.begruessungFehler} fehlgeschlagen` : "in 7 Tagen"} ton={s.zahlen.begruessungFehler ? "rot" : undefined} />
            <Zahl titel="Link geöffnet" wert={s.zahlen.linkGeoeffnet} unter={`Mail ${s.zahlen.klicks.mail} · WhatsApp ${s.zahlen.klicks.whatsapp} · SMS ${s.zahlen.klicks.sms}`} ton="blau" />
            <Zahl titel="Antrag begonnen" wert={s.zahlen.antrag} unter={s.zahlen.woche ? `${Math.round((s.zahlen.antrag / s.zahlen.woche) * 100)} % der Leads (7 Tage)` : "in 7 Tagen"} ton="gruen" />
            <Zahl titel="WhatsApp erlaubt" wert={s.zahlen.whatsappJa} unter={s.zahlen.woche ? `${Math.round((s.zahlen.whatsappJa / s.zahlen.woche) * 100)} % der Leads` : "Kästchen im Formular"} />
            <div className="lm-zahl lm-wege">
              <span className="lm-zahl-titel">Eingang je Weg (7 Tage)</span>
              <div className="lm-chips">
                {wege.length ? wege.map(([w, n]) => <span key={w} className={`lm-chip${w.startsWith("meta") ? " blau" : ""}`}>{s.wegText[w] ?? w} {n}</span>) : <span className="lm-still">noch keine</span>}
              </div>
            </div>
          </section>

          <section className="lm-karte lm-verbindung" aria-label="Verbindung zu Meta">
            <div className="lm-karte-kopf">
              <div>
                <h2>Verbindung zu Meta</h2>
                <p className="lm-still">{s.pruefliste ? `Zuletzt geprüft ${seit(s.pruefliste.am)}` : "Noch nie geprüft."} · Webhook-Adresse: <code>{s.adressen.webhook}</code></p>
              </div>
              <div className="lm-knoepfe">
                <button className="lm-knopf" onClick={() => verbindung(false)} disabled={!!beschaeftigt}>{beschaeftigt === "pruefen" ? "Prüft …" : "Erneut prüfen"}</button>
                <button className="lm-knopf voll" onClick={() => verbindung(true)} disabled={!!beschaeftigt || !s.konfig.bereit}
                  title={s.konfig.bereit ? "Webhook bei Meta eintragen, Seite abonnieren, Formulare laden" : "Erst die drei Zugangswerte in Render eintragen"}>
                  {beschaeftigt === "einrichten" ? "Richtet ein …" : "Verbindung einrichten"}
                </button>
              </div>
            </div>
            {!s.konfig.bereit && (
              <div className="lm-hinweis">
                <b>Das fehlt noch in Render:</b> {s.konfig.fehlt.join(", ")}.
                <span> dashboard.render.com → fiaon-plattform → Environment → „Add Environment Variable“. Die Werte nie in einen Chat oder eine Mail.</span>
              </div>
            )}
            <ul className="lm-pruefliste">
              {(s.pruefliste?.punkte ?? []).map((p) => (
                <li key={p.key} className={p.ok === true ? "ok" : p.ok === false ? "fehlt" : "offen"}>
                  <span className="lm-haken" aria-label={p.ok === true ? "erledigt" : p.ok === false ? "fehlt" : "offen"}>{p.ok === true ? "✓" : p.ok === false ? "✕" : "–"}</span>
                  <div><b>{p.titel}</b><p>{p.text}</p></div>
                </li>
              ))}
              {!s.pruefliste && <li className="offen"><span className="lm-haken">–</span><div><b>Noch keine Prüfung</b><p>„Erneut prüfen“ zeigt, was fehlt.</p></div></li>}
            </ul>
          </section>

          <section className="lm-karte lm-messung" aria-label="Messung an Meta">
            <div className="lm-karte-kopf">
              <div>
                <h2>Messung an Meta</h2>
                <p className="lm-still">
                  Damit die Werbung auf <b>zahlende Kunden</b> optimiert statt auf Formulare: Der Pixel im Browser und der Server melden
                  dieselben vier Schritte — Antrag begonnen, Antrag abgeschickt, Zahlung gebucht, Startgespräch. Beide tragen dieselbe
                  Kennung, Meta zählt sie als eines. Namen, E-Mail und Telefon gehen nur verschlüsselt.
                </p>
              </div>
            </div>

            <div className="lm-mess-zeile">
              <div className="lm-mess-block">
                <span className="lm-etikett">Datensatz (Pixel)</span>
                {s.messung.datensatz
                  ? <p className="lm-mess-wert"><code>{s.messung.datensatz}</code> <span className="lm-chip gruen">steht</span></p>
                  : (
                    <div className="lm-reihe">
                      <input className="lm-feld" inputMode="numeric" placeholder="Kennung aus dem Events-Manager" value={datensatzFeld}
                        onChange={(e) => setDatensatzFeld(e.target.value)} aria-label="Kennung des Datensatzes" />
                      <button className="lm-knopf" onClick={datensatzSpeichern} disabled={!!beschaeftigt || datensatzFeld.replace(/\D/g, "").length < 10}>
                        {beschaeftigt === "datensatz" ? "Speichert …" : "Eintragen"}
                      </button>
                    </div>
                  )}
                {!s.messung.datensatz && <p className="lm-still">„Verbindung einrichten“ holt sie selbst — oder hier aus dem Events-Manager eintragen.</p>}
              </div>

              <div className="lm-mess-block">
                <span className="lm-etikett">Web-Messung (Pixel + Server)</span>
                <button className={`lm-schalter${s.messung.web ? " an" : ""}`} onClick={() => messungSchalten("web", !s.messung.web)}
                  disabled={beschaeftigt === "messung-web"} aria-pressed={s.messung.web}>
                  <span className="lm-schalter-knopf" aria-hidden="true" />{s.messung.web ? "An" : "Aus"}
                </button>
                <p className="lm-still">Nur mit Marketing-Einwilligung im Cookie-Fenster.</p>
              </div>

              <div className="lm-mess-block">
                <span className="lm-etikett">Stufenmeldung (zahlende Leads)</span>
                <button className={`lm-schalter${s.messung.crm ? " an" : ""}`} onClick={() => messungSchalten("crm", !s.messung.crm)}
                  disabled={beschaeftigt === "messung-crm"} aria-pressed={s.messung.crm}>
                  <span className="lm-schalter-knopf" aria-hidden="true" />{s.messung.crm ? "An" : "Aus"}
                </button>
                <p className="lm-still">Meldet je Lead „Antrag fertig“ und „hat bezahlt“ — die Grundlage für Conversion-Leads-Kampagnen.</p>
              </div>
            </div>

            <div className="lm-chips lm-mess-heute">
              {s.messung.heute.length
                ? s.messung.heute.map((h) => <span key={h.name} className={`lm-chip${h.name === "Purchase" || h.name === "converted_lead" ? " gruen" : " blau"}`}>{EREIGNIS_TEXT[h.name] ?? h.name} {h.n}</span>)
                : <span className="lm-still">Heute noch nichts gemeldet.</span>}
              {s.messung.offen > 0 && <span className={`lm-chip${s.messung.fehler ? " rot" : ""}`}>{s.messung.offen} wartet{s.messung.fehler ? ` · ${s.messung.fehler} mit Fehler` : ""}</span>}
            </div>
            {s.messung.letzterFehler && <div className="lm-hinweis gelb">Letzter Fehler: {s.messung.letzterFehler}</div>}

            <div className="lm-reihe">
              <input className="lm-feld" placeholder="Testcode (TEST12345)" value={testCode} onChange={(e) => setTestCode(e.target.value)} aria-label="Testcode aus dem Events-Manager" />
              <button className="lm-knopf" onClick={probe} disabled={!!beschaeftigt || !testCode.trim() || !s.messung.datensatz}
                title="Events-Manager → Datenquellen → Testereignisse → Code kopieren">
                {beschaeftigt === "probe" ? "Sendet …" : "Probe senden"}
              </button>
              <button className="lm-knopf" onClick={jetztSenden} disabled={!!beschaeftigt || !s.messung.offen}>
                {beschaeftigt === "senden" ? "Sendet …" : `Wartende senden${s.messung.offen ? ` (${s.messung.offen})` : ""}`}
              </button>
            </div>

            <details className="lm-unterklapp" onToggle={(e) => setEreignisseOffen((e.target as HTMLDetailsElement).open)}>
              <summary>Gemeldete Ereignisse (die letzten 40)</summary>
              {ereignisseOffen && <EreignisListe />}
            </details>
          </section>

          <section className="lm-karte lm-willkommen" aria-label="Begrüßungsmail">
            <div className="lm-karte-kopf">
              <div>
                <h2>Begrüßungsmail</h2>
                <p className="lm-still">Eine Mail in Sekunden nach dem Formular, gesiezt, mit dem persönlichen Link — Name, E-Mail und Telefon stehen im Antrag schon drin.</p>
              </div>
              <button className={`lm-schalter${s.willkommen.an ? " an" : ""}`} onClick={() => willkommenSchalten(!s.willkommen.an)} disabled={beschaeftigt === "willkommen"} aria-pressed={s.willkommen.an}>
                <span className="lm-schalter-knopf" aria-hidden="true" />
                {s.willkommen.an ? "An" : "Aus"}
              </button>
            </div>
            {!s.willkommen.an && (
              <div className="lm-hinweis gelb">
                Erst einschalten, wenn in Make im Szenario „FIAON Lead #1“ der Brevo-Weg (Weg 3) gelöscht ist — sonst bekommt jeder neue Lead zwei Begrüßungen.
              </div>
            )}
            <div className="lm-knoepfe">
              <button className="lm-knopf" onClick={() => vorschauZeigen()} disabled={!!beschaeftigt}>{beschaeftigt === "vorschau" ? "Baut …" : "Vorschau"}</button>
              <button className="lm-knopf" onClick={pruefversand} disabled={!!beschaeftigt || !s.willkommen.testAdresse}
                title={s.willkommen.testAdresse ? `An ${s.willkommen.testAdresse}` : "Im Mailwerk eine Testadresse eintragen"}>
                {beschaeftigt === "pruefung" ? "Sendet …" : `Prüfversand${s.willkommen.testAdresse ? ` an ${s.willkommen.testAdresse}` : ""}`}
              </button>
            </div>
          </section>

          <section className="lm-karte lm-rueckstand" aria-label="Rückstand nachholen">
            <div className="lm-karte-kopf">
              <div>
                <h2>Rückstand nachholen</h2>
                <p className="lm-still">Meta hält jeden Lead 90 Tage bereit. Seit dem 21.09. morgens kam über Make fast nichts an — diese Leads holt der Knopf. {s.nachholBis ? `Der Nachhol-Lauf steht bei ${zeit(s.nachholBis)}.` : ""}</p>
              </div>
            </div>
            <div className="lm-reihe">
              <label className="lm-etikett" htmlFor="lm-seit">Seit</label>
              <input id="lm-seit" type="date" className="lm-feld" value={seitDatum} max={heuteIso()} onChange={(e) => setSeitDatum(e.target.value)} />
              <button className="lm-knopf voll" onClick={nachholen} disabled={!!beschaeftigt || !s.konfig.bereit} title={s.konfig.bereit ? "" : "Erst den Meta-Zugang eintragen"}>
                {beschaeftigt === "nachholen" ? "Holt nach …" : "Nachholen"}
              </button>
            </div>
            {nachholErgebnis && (
              <p className="lm-ergebnis">
                {nachholErgebnis.formulare} Formulare gefragt · {nachholErgebnis.gefunden} Leads bei Meta · <b>{nachholErgebnis.neu} neu angelegt</b> · {nachholErgebnis.schonDa} schon da
                {nachholErgebnis.ungueltig ? ` · ${nachholErgebnis.ungueltig} ohne Mail und Telefon` : ""}
                {nachholErgebnis.fehler?.length ? <span className="lm-rot"> · {nachholErgebnis.fehler.join(" · ")}</span> : null}
              </p>
            )}
          </section>

          <section className="lm-karte lm-formulare" aria-label="Formulare">
            <div className="lm-karte-kopf">
              <div>
                <h2>Formulare</h2>
                <p className="lm-still">Welches Kästchen erlaubt WhatsApp? Ohne Kästchen bekommt der Mensch nur E-Mails.</p>
              </div>
              <button className="lm-knopf" onClick={formulareNeu} disabled={!!beschaeftigt || !s.konfig.bereit}>{beschaeftigt === "formulare" ? "Lädt …" : "Formulare neu laden"}</button>
            </div>
            {s.formulare.length === 0 ? <p className="lm-leer">Noch keine Formulare — sie erscheinen nach „Verbindung einrichten“.</p> : (
              <div className="lm-tabelle-huelle">
                <table className="lm-tabelle">
                  <thead><tr><th>Formular</th><th>Status</th><th>Leads 7 T</th><th>WhatsApp-Einwilligung</th></tr></thead>
                  <tbody>
                    {s.formulare.map((f) => (
                      <tr key={f.id}>
                        <td><b>{f.name || f.id}</b><span className="lm-still"> · {f.id}</span></td>
                        <td>{(f.status || "—").toLowerCase() === "active" ? "aktiv" : (f.status || "—").toLowerCase() === "archived" ? "archiviert" : f.status || "—"}</td>
                        <td className="lm-zahlzelle">{f.leads_woche}</td>
                        <td>
                          <select className="lm-feld" value={f.einwilligung_schluessel ?? ""} onChange={(e) => einwilligung(f.id, e.target.value)} aria-label={`WhatsApp-Einwilligung für ${f.name || f.id}`}>
                            <option value="">Kein Kästchen — nur E-Mail</option>
                            {(f.kaestchen ?? []).filter((k) => k.key).map((k) => (
                              <option key={k.key} value={k.key}>{(k.text || k.key || "").slice(0, 90)}</option>
                            ))}
                          </select>
                          {f.einwilligung_von && <span className="lm-still"> {f.einwilligung_von === "hand" ? "von Hand" : "erkannt"}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="lm-karte lm-leads" aria-label="Letzte Leads">
            <div className="lm-karte-kopf">
              <div>
                <h2>Letzte Leads</h2>
                <p className="lm-still">Die jüngsten 60 — mit Weg, Anzeige, Einwilligung, Begrüßung, Klick und Antrag.</p>
              </div>
              <div className="lm-reiter">
                {[["", "Alle"], ["meta_webhook", "Meta direkt"], ["meta_nachhol", "Nachgeholt"], ["meta_rueckstand", "Rückstand"], ["make", "Make"]].map(([w, t]) => (
                  <button key={w || "alle"} className={`lm-reiter-knopf${wegFilter === w ? " an" : ""}`} onClick={() => setWegFilter(w)}>{t}</button>
                ))}
              </div>
            </div>
            {leads.fehler && <Fehlermeldung text={leads.fehler} erneut={leads.neu} />}
            {leads.laedt && !leads.daten && <Geruest zeilen={5} />}
            {leads.daten && (leads.daten.leads.length === 0 ? <p className="lm-leer">Keine Leads auf diesem Weg.</p> : (
              <ul className="lm-liste">
                {leads.daten.leads.map((l) => (
                  <li key={l.id} className="lm-zeile">
                    <div className="lm-zeile-kopf">
                      {l.personId
                        ? <a className="lm-name" href={`/chef/s/akte?id=${l.personId}`} target="_blank" rel="noreferrer">{l.name}</a>
                        : <span className="lm-name">{l.name}</span>}
                      {l.nameUnbrauchbar && <span className="lm-chip gelb" title="Die Anrede lautet „Guten Tag,“ ohne Namen">Name unbrauchbar</span>}
                      <span className={`lm-chip${l.weg.startsWith("meta") ? " blau" : ""}`}>{l.wegText}</span>
                      {l.plattform && <span className="lm-chip">{l.plattform === "instagram" ? "Instagram" : l.plattform === "facebook" ? "Facebook" : l.plattform}</span>}
                      <span className="lm-still">{zeit(l.am)}</span>
                    </div>
                    <div className="lm-zeile-mitte">
                      {(l.kampagne || l.anzeige) && <span>{[l.kampagne, l.gruppe, l.anzeige].filter(Boolean).join(" › ")}</span>}
                      {l.formular && <span className="lm-still">Formular: {l.formular}</span>}
                    </div>
                    <div className="lm-zeile-fuss">
                      <span className={`lm-chip${l.whatsapp === true ? " gruen" : ""}`}>{l.whatsapp === true ? "WhatsApp erlaubt" : l.whatsapp === false ? "WhatsApp nicht erlaubt" : "WhatsApp unbekannt"}</span>
                      <span className={`lm-chip${l.begruessung.status === "gesendet" ? " gruen" : l.begruessung.status === "fehler" ? " rot" : ""}`} title={l.begruessung.grund ?? ""}>
                        {BEGRUESSUNG_TEXT[l.begruessung.status ?? ""] ?? "Noch nicht begrüßt"}{l.begruessung.status === "ausgelassen" && l.begruessung.grund ? `: ${l.begruessung.grund}` : ""}
                      </span>
                      <span className={`lm-chip${l.link.am ? " blau" : ""}`}>{l.link.am ? `Link geöffnet ${seit(l.link.am)}${l.link.klicks > 1 ? ` · ${l.link.klicks}×` : ""}` : "Link nicht geöffnet"}</span>
                      <span className={`lm-chip${l.antrag ? " gruen" : ""}`}>{l.antrag ? `Antrag ${l.antrag}` : "Kein Antrag"}</span>
                      <button className="lm-klein" onClick={() => vorschauZeigen(l.id)}>Begrüßung ansehen</button>
                    </div>
                  </li>
                ))}
              </ul>
            ))}
          </section>

          <details className="lm-karte lm-texte">
            <summary>Texte zur Freigabe — Einwilligung und WhatsApp-Vorlagen</summary>
            <div className="lm-texte-inhalt">
              <div className="lm-einwilligung">
                <h3>Kästchen im Meta-Formular</h3>
                <p className="lm-still">„Benutzerdefinierter Haftungsausschluss“ → Kästchen, Pflicht. Bitte einmal vom Anwalt absegnen lassen.</p>
                <blockquote>{s.texte.einwilligung}</blockquote>
                <button className="lm-knopf" onClick={() => kopieren(s.texte.einwilligung)}>Text kopieren</button>
              </div>
              <h3>WhatsApp-Vorlagen (Entwurf, gehen mit Phase 2 an Meta)</h3>
              <div className="lm-vorlagen">
                {s.texte.vorlagen.map((v) => (
                  <div key={v.name} className="lm-vorlage">
                    <div className="lm-vorlage-kopf"><b>{v.name}</b><span className="lm-chip">{v.kategorie === "UTILITY" ? "Service" : "Werbung"}</span></div>
                    <p className="lm-still">{v.zweck} {v.wann}</p>
                    <div className="lm-blase">
                      <p>{v.text.replace("{{1}}", v.beispiele[0] ?? "Maria Muster").replace("{{2}}", v.beispiele[1] ?? "")}</p>
                      {v.knoepfe.length > 0 && <div className="lm-blase-knoepfe">{v.knoepfe.map((k) => <span key={k.text}>{k.typ === "URL" ? "↗ " : ""}{k.text}</span>)}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </details>

          <details className="lm-karte lm-meldungen" onToggle={(e) => setMeldungenOffen((e.target as HTMLDetailsElement).open)}>
            <summary>Meldungen von Meta (die letzten 40)</summary>
            {meldungenOffen && <MeldungenListe />}
          </details>
        </>
      )}

      {vorschau && (
        <div className="lm-schleier" role="dialog" aria-modal="true" aria-label="Vorschau der Begrüßungsmail" onClick={() => setVorschau(null)}>
          <div className="lm-fenster" onClick={(e) => e.stopPropagation()}>
            <div className="lm-fenster-kopf">
              <div>
                <span className="lm-still">{vorschau.beispiel ? "Beispiel (Maria Muster)" : "So bekäme dieser Lead die Mail"}</span>
                <h2>{vorschau.betreff}</h2>
              </div>
              <button className="lm-klein" onClick={() => setVorschau(null)}>Schließen</button>
            </div>
            <iframe className="lm-vorschau" title="Begrüßungsmail" srcDoc={vorschau.html} sandbox="" />
          </div>
        </div>
      )}
      {meldung && <div className="lm-meldung" role="status">{meldung}</div>}
    </div>
  );
}

/** Was wir Meta gemeldet haben — erst geladen, wenn der Bereich aufgeklappt ist. */
function EreignisListe() {
  const e = useDaten<{ ereignisse: Ereignis[] }>("/chef/lead-motor/messung/ereignisse");
  if (e.fehler) return <Fehlermeldung text={e.fehler} erneut={e.neu} />;
  if (!e.daten) return <Geruest zeilen={4} />;
  if (e.daten.ereignisse.length === 0) return <p className="lm-leer">Noch nichts gemeldet.</p>;
  return (
    <div className="lm-tabelle-huelle">
      <table className="lm-tabelle">
        <thead><tr><th>Wann</th><th>Ereignis</th><th>Woher</th><th>Antrag / Lead</th><th>Wert</th><th>Status</th></tr></thead>
        <tbody>
          {e.daten.ereignisse.map((z) => (
            <tr key={z.id}>
              <td>{zeit(z.gesendet_am ?? z.created_at)}</td>
              <td><b>{EREIGNIS_TEXT[z.name] ?? z.name}</b></td>
              <td>{z.quelle === "crm" ? "Lead-Stufe" : "Website"}</td>
              <td>{z.ref ?? (z.meta_lead_id ? `Lead ${z.meta_lead_id}` : "—")}</td>
              <td className="lm-zahlzelle">{z.wert_cents != null ? `${(z.wert_cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 })} €` : "—"}</td>
              <td className={z.status === "fehler" ? "lm-rot" : ""}>{z.status === "gesendet" ? "gemeldet" : z.status === "fehler" ? `Fehler: ${z.fehler ?? ""}` : "wartet"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Erst geladen, wenn der Bereich aufgeklappt ist. */
function MeldungenListe() {
  const meldungen = useDaten<{ meldungen: Meldung[] }>("/chef/lead-motor/meldungen");
  if (meldungen.fehler) return <Fehlermeldung text={meldungen.fehler} erneut={meldungen.neu} />;
  if (!meldungen.daten) return <Geruest zeilen={4} />;
  if (meldungen.daten.meldungen.length === 0) return <p className="lm-leer">Noch keine Meldung.</p>;
  return (
    <div className="lm-tabelle-huelle">
      <table className="lm-tabelle">
        <thead><tr><th>Empfangen</th><th>Art</th><th>Status</th><th>Lead</th><th>Hinweis</th></tr></thead>
        <tbody>
          {meldungen.daten.meldungen.map((m) => (
            <tr key={m.id}>
              <td>{zeit(m.empfangen_am)}</td>
              <td>{m.objekt === "page" && m.feld === "leadgen" ? "Lead" : `${m.objekt}/${m.feld}`}</td>
              <td>{m.status === "verarbeitet" ? "angelegt" : m.status}{m.versuche > 1 ? ` (${m.versuche} Versuche)` : ""}</td>
              <td className="lm-zahlzelle">{m.lead_id ?? "—"}</td>
              <td className="lm-still">{m.fehler ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Zahl({ titel, wert, unter, ton }: { titel: string; wert: number; unter?: string; ton?: "blau" | "gruen" | "rot" }) {
  return (
    <div className={`lm-zahl${ton ? ` ${ton}` : ""}`}>
      <span className="lm-zahl-titel">{titel}</span>
      <span className="lm-zahl-wert">{wert.toLocaleString("de-DE")}</span>
      {unter && <span className="lm-zahl-unter">{unter}</span>}
    </div>
  );
}
