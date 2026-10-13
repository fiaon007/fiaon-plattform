// ═══════════════════════════════════════════════════════════════════════════
// CHEFBÜRO · RÜCKHOLUNG — der Leitstand (02.09.2026, E-074)
//
// Justins Auftrag: „der gesamte Prozess muss ein System sein was ich einsehe
// und verstehe“. Aufbau von grob nach fein wie im Mailwerk: die eine Zahl,
// der Trichter, die Zustellbarkeit (der Block, der vor Schaden bewahrt),
// die Schalter, die Wirkung, die Läufe. Jede Zahl trägt einen Satz, der sie
// erklärt — die Seite muss ohne Rückfrage verständlich sein.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { ShieldAlert, PhoneCall, MailX, CalendarCheck2 } from "lucide-react";
import { eur, zahl, seit, Hochzaehler, Geruest, Fehlermeldung, useDaten, API } from "./chef-teile";
import "@/styles/chef-zahlen.css";
import "@/styles/chef-mailwerk.css";
import "@/styles/chef-rueckholung.css";

type SegmentKey = "s1_frisch" | "s2_behauptet" | "s3_preis_fehlt" | "s4_nie_gemahnt" | "s5_altbestand";

interface SegmentStand { anzahl: number; wert_cents: number; mit_mail: number; mit_telefon: number; bereits_angeschrieben: number }
interface Fall { ref: string; vorname: string | null; mail: string | null; telefon: string | null; paket: string | null; betrag: string | null; alterTage: number; mahnungen: number; bisherige: number }
interface Antwort {
  ok: boolean; stand: string;
  trichter: Record<SegmentKey, SegmentStand>;
  versand: Record<string, { gesamt: number; heute: number; geklickt: number }>;
  zustellbarkeit: {
    sendungen30: number; empfaenger30: number; schnitt: number; maximum: number;
    zugestellt: number; geoeffnet: number; geklickt: number; blockiert: number; gebounct: number; spam: number;
    blockquoteWochen: { woche: string; quote: number }[];
  };
  bremse: { zurueckgehalten24h: number };
  /** E-343: bezahlt/umsatz = Zahlungen nach der ersten Rückhol-Mail; neu_* = davon Erstzahler. */
  wirkung: { angeschrieben: number; termine: number; bezahlt: number; umsatz_cents: number; neu_bezahlt?: number; neu_umsatz_cents?: number };
  schalter: Record<string, string | null>;
  laeufe: { name: string; letzteMeldung: string | null; letzterErfolg: string | null; stundenHer: number | null; ampel: string }[];
  /** E-188: Auswahl für die zuständige Person bei FIAON Global. */
  mitarbeiter?: { id: number; name: string; rolle: string }[];
}

// Was jedes Segment IST und WARUM es so behandelt wird — die Messung steht
// dabei, damit die Karte sich selbst erklärt.
const SEGMENT_TEXT: Record<SegmentKey, { titel: string; satz: string; beleg: string; event: string }> = {
  s1_frisch: {
    titel: "Frische Zahlungsmeldung", event: "rueckhol_s1",
    satz: "Vor unter 3 Tagen Überweisung gemeldet, Geld noch nicht da.",
    beleg: "9,5 % zahlen (19× Grundquote) — nach 72 h vorbei.",
  },
  s2_behauptet: {
    titel: "Alte Zahlungsmeldung", event: "rueckhol_s2",
    satz: "Meldung Wochen alt, danach ~29 Mahnungen. Mail entschuldigt sich, stoppt die Kette.",
    beleg: "47,2 % haben doch bezahlt — wertvollste Gruppe.",
  },
  s3_preis_fehlt: {
    titel: "Preis fehlt (unser Bruch)", event: "rueckhol_s3",
    satz: "Bestellung ohne Betrag — nie eine Zahlungsaufforderung bekommen.",
    beleg: "0 von 1.211 haben gezahlt. Erst prüfen, dann anschalten (Standard AUS).",
  },
  s4_nie_gemahnt: {
    titel: "Nie angeschrieben", event: "rueckhol_s4",
    satz: "Antrag und Betrag da, nie erinnert. Erstkontakt, keine Mahnung.",
    beleg: "Die ersten 3 Mails bringen 75 von 116 Zahlern.",
  },
  s5_altbestand: {
    titel: "Dauerpflege", event: "rueckhol_s5",
    satz: "Strecke durch: alle 28 Tage eine neue Mail, bis Kunde oder Stopp.",
    beleg: "Zahl = heute versandfertig. Abstand unten einstellbar (min. 21 Tage).",
  },
};

const REIHENFOLGE: SegmentKey[] = ["s1_frisch", "s2_behauptet", "s4_nie_gemahnt", "s3_preis_fehlt", "s5_altbestand"];

export default function ChefRueckholung() {
  const { daten, fehler, neu } = useDaten<Antwort>("/chef/rueckholung");
  const [meldung, setMeldung] = useState<string | null>(null);
  const [offen, setOffen] = useState<SegmentKey | null>(null);
  const [faelle, setFaelle] = useState<Fall[] | null>(null);

  useEffect(() => {
    if (!offen) { setFaelle(null); return; }
    setFaelle(null);
    fetch(`${API}/chef/rueckholung/segment/${offen}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setFaelle(d.ok ? d.faelle : []))
      .catch(() => setFaelle([]));
  }, [offen]);

  const speichern = async (key: string, value: string, hinweis?: string) => {
    setMeldung(null);
    const r = await fetch(`${API}/chef/rueckholung/einstellung`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    }).then((x) => x.json()).catch(() => ({ ok: false, error: "Netzwerkfehler" }));
    setMeldung(r.ok ? (hinweis ?? "Gespeichert.") : `Nicht gespeichert: ${r.error}`);
    if (r.ok) neu();
  };

  if (fehler) return <Fehlermeldung text="Die Rückholung lässt sich gerade nicht laden." erneut={neu} />;
  if (!daten) return <Geruest zeilen={8} />;

  const t = daten.trichter;
  const gesamtWert = REIHENFOLGE.reduce((s, k) => s + (t[k]?.wert_cents || 0), 0);
  const gesamtZahl = REIHENFOLGE.reduce((s, k) => s + (t[k]?.anzahl || 0), 0);
  const z = daten.zustellbarkeit;
  const letzteQuote = z.blockquoteWochen.length ? z.blockquoteWochen[z.blockquoteWochen.length - 1].quote : 0;
  const deckel = Number(daten.schalter.rueckhol_pro_tag || "0");
  const w = daten.wirkung;

  const anAus = (key: string, standard: boolean) => {
    const wert = daten.schalter[key];
    const an = wert === null ? standard : wert === "1";
    return (
      <button type="button" className={`cm-an ${an ? "cm-an-ja" : ""}`} title={an ? "Läuft — klicken zum Abschalten" : "Aus — klicken zum Anschalten"}
        onClick={() => speichern(key, an ? "0" : "1", an ? "Segment abgeschaltet." : "Segment angeschaltet.")}>
        {an ? "AN" : "AUS"}
      </button>
    );
  };

  return (
    <div className="cr">
      {meldung && <div className="cm-meldung" role="status">{meldung}</div>}

      {/* ── 1. Die eine Zahl ─────────────────────────────────────────────── */}
      <section className="cz-block cr-kopf">
        <div className="cr-riesig"><Hochzaehler ziel={gesamtWert} formatieren={eur} /></div>
        <p className="cr-riesig-satz">
          offener Wert in {zahl(gesamtZahl)} zurückholbaren Anträgen.
          {deckel <= 0 && <b> Lauf AUS (Tagesdeckel 0) — keine Mail geht raus.</b>}
        </p>
      </section>

      {/* ── 2. Der Trichter: fünf Segmente ───────────────────────────────── */}
      <section className="cz-block">
        <header className="cz-block-kopf"><h3>Die fünf Segmente</h3>
          <p>Der Lauf arbeitet von links nach rechts. Klick auf eine Karte zeigt die Fälle.</p>
        </header>
        <div className="cr-segmente">
          {REIHENFOLGE.map((k) => {
            const s = t[k] || { anzahl: 0, wert_cents: 0, mit_mail: 0, mit_telefon: 0, bereits_angeschrieben: 0 };
            const txt = SEGMENT_TEXT[k];
            const v = daten.versand[txt.event];
            const standard = k === "s1_frisch" || k === "s2_behauptet" || k === "s4_nie_gemahnt";
            return (
              <div key={k} className={`cr-segment ${offen === k ? "cr-segment-offen" : ""}`} onClick={() => setOffen(offen === k ? null : k)}
                role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setOffen(offen === k ? null : k)}>
                <div className="cr-segment-kopf">
                  <span className="cr-segment-titel">{txt.titel}</span>
                  <span onClick={(e) => e.stopPropagation()}>{anAus(`rueckhol_${k.split("_")[0]}_an`, standard)}</span>
                </div>
                <div className="cr-segment-zahl">{zahl(s.anzahl)}<small> Anträge · {eur(s.wert_cents)}</small></div>
                <p className="cr-segment-satz">{txt.satz}</p>
                <p className="cr-segment-beleg">{txt.beleg}</p>
                <div className="cr-segment-fuss">
                  ✉ {zahl(s.mit_mail)} · ☎ {zahl(s.mit_telefon)} · schon angeschrieben: {zahl(s.bereits_angeschrieben)}
                  {v ? <> · verschickt {zahl(v.gesamt)}{v.heute ? ` (heute ${v.heute})` : ""}{v.geklickt ? ` · ${v.geklickt} geklickt` : ""}</> : null}
                </div>
              </div>
            );
          })}
        </div>
        {offen && (
          <div className="cr-faelle">
            <h4>{SEGMENT_TEXT[offen].titel} — die nächsten Fälle</h4>
            {!faelle ? <Geruest zeilen={3} /> : faelle.length === 0 ? <p className="cr-leer" title="Gefiltert: keine Mail, Höchstzahl erreicht, Abstand läuft oder offener Bankeingang.">Kein versandfertiger Fall.</p> : (
              <div className="cr-tab-huelle"><table className="cr-tab">
                <thead><tr><th>Referenz</th><th>Vorname</th><th>Paket</th><th>Betrag</th><th>Alter</th><th>Mahnungen</th><th>Rückhol-Mails</th><th>Kontakt</th></tr></thead>
                <tbody>{faelle.map((f) => (
                  <tr key={f.ref}>
                    <td>{f.ref}</td><td>{f.vorname || "—"}</td><td>{f.paket || "—"}</td>
                    <td>{f.betrag ? `${f.betrag} €` : "—"}</td>
                    <td>{f.alterTage} T</td><td>{f.mahnungen}</td><td>{f.bisherige}</td>
                    <td>{f.mail || "—"}{f.telefon ? ` · ${f.telefon}` : ""}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </div>
        )}
      </section>

      {/* ── 3. Die Zustellbarkeit — der Block, der vor Schaden bewahrt ──── */}
      <section className="cz-block">
        <header className="cz-block-kopf"><h3>Zustellbarkeit</h3>
          <p>Jede überflüssige Mail schadet der ganzen Domain — auch Zugangsdaten und Termine.</p>
        </header>
        {letzteQuote >= 10 && (
          <div className="cr-klemmer"><ShieldAlert size={18} />
            <div><b>{letzteQuote.toFixed(1).replace(".", ",")} % zuletzt blockiert oder zurück</b> — über 10 % wertet Gmail die Domain ab. Weniger senden: Mahngrenze runter, Bremse an, Rückholung klein.</div>
          </div>
        )}
        <div className="cr-vier">
          <div className="cr-kennzahl"><b>{zahl(z.sendungen30)}</b><span>Mails in 30 Tagen an {zahl(z.empfaenger30)} Empfänger · Ø {String(z.schnitt).replace(".", ",")} je Kopf, max. {zahl(z.maximum)}</span></div>
          <div className="cr-kennzahl"><b>{zahl(z.blockiert + z.gebounct)}</b><span>blockiert oder zurück · {zahl(z.spam)} Spam-Beschwerden</span></div>
          <div className="cr-kennzahl"><b>{zahl(z.geoeffnet + z.geklickt)}</b><span>geöffnet oder geklickt</span></div>
          <div className="cr-kennzahl"><b>{zahl(daten.bremse.zurueckgehalten24h)}</b><span title="Deckel je Empfänger, Pflichtmails ausgenommen.">von der Bremse in 24 h zurückgehalten</span></div>
        </div>
        <div className="cr-wochen">
          {z.blockquoteWochen.map((wq) => (
            <div key={wq.woche} className="cr-woche">
              <div className={`cr-woche-balken ${wq.quote >= 10 ? "cr-rot" : ""}`} style={{ height: `${Math.min(100, wq.quote * 5)}%` }} />
              <span>{wq.woche}</span><b>{String(wq.quote).replace(".", ",")} %</b>
            </div>
          ))}
          <p className="cr-wochen-satz">Blockquote je Woche (nur Mails mit Rückmeldung).</p>
        </div>
      </section>

      {/* ── 4. Die Schalter ──────────────────────────────────────────────── */}
      <section className="cz-block">
        <header className="cz-block-kopf"><h3>Die Schalter</h3>
          <p>Wirken sofort. 0 heißt überall: aus.</p>
        </header>
        <div className="cr-schalter">
          {([
            ["rueckhol_pro_tag", "Rückhol-Mails je Tag", "Haupthahn. 0 = kein Versand. Start-Empfehlung: 30."],
            ["frequenzbremse_an", "Frequenzbremse (1 = an, 0 = aus)", "0 = keine Deckel, keine Ruhezeiten. Unzustellbar + Werbesperre gelten immer."],
            ["frequenz_pro_tag", "Je Empfänger: Mails pro Tag", "Gilt für ALLE Werbemails. Standard 2."],
            ["frequenz_pro_woche", "Je Empfänger: pro Woche", "Standard 4."],
            ["frequenz_pro_monat", "Je Empfänger: pro 30 Tage", "Standard 8 = Oberkante. Ab Mail 6 verdoppelt sich die Blockquote."],
            ["max_reminders", "Erstzahlung: Erinnerungen je Bestellung", "0 = ohne Grenze. Ab Mahnung 6 zahlt praktisch keiner mehr."],
            ["mahn_takte_pro_tag", "Mahnläufe pro Tag", "Empfehlung: 1. Bei 2 trifft es dieselben Leute zweimal täglich."],
            ["mahn_dauer_tage", "Raten: Dauermahnung alle … Tage", "Nach Stufe 5 alle N Tage weiter. Standard 3. 0 = Schluss nach Stufe 5."],
            ["rueckhol_dauerpflege_abstand_tage", "Dauerpflege: Tage zwischen zwei Mails", "Standard 28, Minimum 21."],
          ] as const).map(([key, label, satz]) => (
            <label key={key} className="cr-schalter-feld">
              <span className="cr-schalter-label">{label}</span>
              <input type="number" min={0} defaultValue={daten.schalter[key] ?? ""} placeholder="Standard"
                onBlur={(e) => { const v = e.target.value.trim(); if (v !== (daten.schalter[key] ?? "")) speichern(key, v || "0", `${label}: ${v || "0"}.`); }} />
              <small>{satz}</small>
            </label>
          ))}
        </div>
      </section>

      {/* ── 4b. FIAON Global (17.09.2026, E-188) ─────────────────────────────
          Drei Einstellungen des Bestellwegs für Unternehmen. Sie stehen hier,
          weil dies die Seite der Schalter ist — die Aufträge selbst zeigt
          /chef/s/global-auftraege. */}
      <section className="cz-block">
        <header className="cz-block-kopf"><h3>FIAON Global — Bestellweg Firmen</h3>
          <p>Zuständigkeit, Provision, Umsatzsteuer. Wirkt sofort. Aufträge: <a href="/chef/s/global-auftraege">Global-Aufträge</a>.</p>
        </header>
        <div className="cr-schalter">
          <label className="cr-schalter-feld">
            <span className="cr-schalter-label">Zuständige Person</span>
            <select value={daten.schalter.global_zustaendig_agent_id && daten.schalter.global_zustaendig_agent_id !== "0" ? daten.schalter.global_zustaendig_agent_id : ""}
              onChange={(e) => speichern("global_zustaendig_agent_id", e.target.value, e.target.value ? "Zuständige Person für FIAON Global gespeichert." : "Keine feste Person — neue Aufträge gehen an die Vertriebsleitung.")}>
              <option value="">Vertriebsleitung (wer am wenigsten offen hat)</option>
              {(daten.mitarbeiter ?? []).map((m) => <option key={m.id} value={String(m.id)}>{m.name}{m.rolle === "vertriebsleiter" ? " · Vertriebsleitung" : ""}</option>)}
            </select>
            <small title="Wird Betreuer (falls keiner da), steht als Ansprechpartner in Kundenmails, bekommt nach Zahlung „US-Struktur starten“.">Bekommt jeden neuen Auftrag als Aufgabe mit Mail.</small>
          </label>
          <label className="cr-schalter-feld">
            <span className="cr-schalter-label">Provision bei Global-Abschlüssen, in Prozent</span>
            <input type="number" min={0} max={50} defaultValue={daten.schalter.global_provision_prozent ?? ""} placeholder="25"
              onBlur={(e) => { const v = e.target.value.trim(); if (v !== (daten.schalter.global_provision_prozent ?? "")) speichern("global_provision_prozent", v || "25", `Provision FIAON Global: ${v || "25"} %.`); }} />
            <small title="Auf den Einmalpreis, ohne Partnerzuschlag: 2.499 € → 624,75 €, 35.999 € → 8.999,75 €. Werber-Beteiligung kommt wie üblich dazu.">Vorgabe 25, bei Zahlungseingang. Nur mit dokumentiertem Gespräch — Web-Kauf ohne Provision. 0 = keine.</small>
          </label>
          <label className="cr-schalter-feld">
            <span className="cr-schalter-label">Umsatzsteuer auf der Firmenrechnung</span>
            <select value={daten.schalter.rechnung_b2b_ust_modus === "reverse_charge" ? "reverse_charge" : "none"}
              onChange={(e) => speichern("rechnung_b2b_ust_modus", e.target.value, e.target.value === "reverse_charge" ? "Neue Firmenrechnungen: Reverse Charge." : "Neue Firmenrechnungen: ohne Steuerausweis.")}>
              <option value="none">Ohne gesonderten Steuerausweis (Vorgabe)</option>
              <option value="reverse_charge">Reverse Charge — netto, Steuerschuld beim Kunden</option>
            </select>
            <small title="Reverse Charge braucht die USt-IdNr.; fehlt sie, geht die Rechnung ohne Steuerausweis raus. 19 % weist das System nie aus.">Nur nach Steuerberater-Entscheid umstellen. Gilt nur für NEUE Aufträge.</small>
          </label>
        </div>
      </section>

      {/* ── 5. Die Wirkung ───────────────────────────────────────────────── */}
      <section className="cz-block">
        <header className="cz-block-kopf"><h3>Die Wirkung</h3>
          <p>Mail → Termin → Zahlung. Hier siehst du, ob die Rückholung verkauft.</p>
        </header>
        <div className="cr-stufen">
          <div className="cr-stufe"><MailX size={16} /><b>{zahl(w.angeschrieben)}</b><span>angeschrieben</span></div>
          <div className="cr-pfeil">{w.angeschrieben ? `${Math.round((w.termine / w.angeschrieben) * 100)} %` : "→"}</div>
          <div className="cr-stufe"><CalendarCheck2 size={16} /><b>{zahl(w.termine)}</b><span>Termin gebucht</span></div>
          <div className="cr-pfeil">{w.termine ? `${Math.round((w.bezahlt / w.termine) * 100)} %` : "→"}</div>
          <div className="cr-stufe"
            title={`Gebuchte Zahlungen nach der ersten Rückhol-Mail der Person.${w.neu_bezahlt != null ? ` Davon ${zahl(w.neu_bezahlt)} Personen, die vorher nie gezahlt hatten (${eur(w.neu_umsatz_cents ?? 0)}).` : ""}`}>
            <PhoneCall size={16} /><b>{zahl(w.bezahlt)}</b><span>bezahlt — {eur(w.umsatz_cents)}</span>
          </div>
        </div>
      </section>

      {/* ── 6. Die Läufe ─────────────────────────────────────────────────── */}
      <section className="cz-block">
        <header className="cz-block-kopf"><h3>Die Läufe</h3><p>Grün = sauber gelaufen. Prüft alle 30 Min., sendet bis zum Tagesdeckel.</p></header>
        <div className="cr-laeufe">
          {daten.laeufe.map((l) => (
            <div key={l.name} className={`cr-lauf cr-lauf-${l.ampel}`}>
              <b>{l.name === "rueckholung" ? "Rückholung (5 Segmente)" : l.name}</b>
              <span>{l.letzteMeldung || "noch nie gelaufen"}</span>
              <small>{l.letzterErfolg ? `zuletzt ${seit(l.letzterErfolg)}` : "—"}</small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
