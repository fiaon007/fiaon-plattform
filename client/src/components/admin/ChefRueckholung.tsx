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
  wirkung: { angeschrieben: number; termine: number; bezahlt: number; umsatz_cents: number };
  schalter: Record<string, string | null>;
  laeufe: { name: string; letzteMeldung: string | null; letzterErfolg: string | null; stundenHer: number | null; ampel: string }[];
}

// Was jedes Segment IST und WARUM es so behandelt wird — die Messung steht
// dabei, damit die Karte sich selbst erklärt.
const SEGMENT_TEXT: Record<SegmentKey, { titel: string; satz: string; beleg: string; event: string }> = {
  s1_frisch: {
    titel: "Frische Zahlungsmeldung", event: "rueckhol_s1",
    satz: "Hat vor unter 3 Tagen gemeldet, dass er überwiesen hat — das Geld ist noch nicht da.",
    beleg: "9,5 % zahlen — Faktor 19 zur Grundquote. Nach 72 Stunden ist der Vorsprung weg.",
  },
  s2_behauptet: {
    titel: "Alte Zahlungsmeldung", event: "rueckhol_s2",
    satz: "Meldung liegt Wochen zurück; danach kamen im Schnitt 29 Mahnungen. Die Mail entschuldigt sich und stoppt die Kette.",
    beleg: "47,2 % dieser Gruppe haben historisch doch bezahlt — die wertvollste Warteschlange.",
  },
  s3_preis_fehlt: {
    titel: "Preis fehlt (unser Bruch)", event: "rueckhol_s3",
    satz: "Bestellung ohne Betrag — diese Menschen haben nie eine Zahlungsaufforderung bekommen.",
    beleg: "0 von 1.211 haben je gezahlt. Erst prüfen, dann anschalten — Standard AUS.",
  },
  s4_nie_gemahnt: {
    titel: "Nie angeschrieben", event: "rueckhol_s4",
    satz: "Antrag und Betrag liegen vor, aber es ging nie eine Erinnerung raus. Erstkontakt, keine Mahnung.",
    beleg: "Die ersten 3 Mails bringen 75 von 116 Zahlern — hier ist die Botschaft noch neu.",
  },
  s5_altbestand: {
    titel: "Altbestand — letzte Mail", event: "rueckhol_s5",
    satz: "Hat die volle Kette bekommen. Genau EINE würdige Abschlussmail mit echtem Ausstieg, dann Ruhe.",
    beleg: "Ab Mahnung 6 ist die Ausbeute null (12.260 Mails → 5 Zahler). Unumkehrbar — Standard AUS.",
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
          offener Auftragswert in {zahl(gesamtZahl)} zurückholbaren Anträgen — sortiert nach Lage, nicht nach Alter.
          {deckel <= 0 && <b> Der Lauf ist AUS (Tagesdeckel 0): es geht keine einzige Mail raus, bis unten eine Zahl gesetzt wird.</b>}
        </p>
      </section>

      {/* ── 2. Der Trichter: fünf Segmente ───────────────────────────────── */}
      <section className="cz-block">
        <header className="cz-block-kopf"><h3>Die fünf Segmente</h3>
          <p>Jede Karte: wie viele Menschen, wie viel Wert, wie erreichbar. Der Lauf arbeitet von links nach rechts — S1 zuerst, denn eine frische Zahlungsmeldung verdirbt in 72 Stunden.</p>
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
            <h4>{SEGMENT_TEXT[offen].titel} — die nächsten Fälle, wie der Lauf sie ziehen würde</h4>
            {!faelle ? <Geruest zeilen={3} /> : faelle.length === 0 ? <p className="cr-leer">Kein versandfertiger Fall — alle gefiltert (keine Mail, Höchstzahl erreicht, Abstand läuft oder offener Bankeingang).</p> : (
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
        <header className="cz-block-kopf"><h3>Zustellbarkeit — die knappe Ressource</h3>
          <p>Gmail &amp; Co. bewerten die Absender-Domain als Ganzes. Jede überflüssige Mail hier macht auch Zugangsdaten und Terminbestätigungen unzustellbarer.</p>
        </header>
        {letzteQuote >= 10 && (
          <div className="cr-klemmer"><ShieldAlert size={18} />
            <div><b>{letzteQuote.toFixed(1).replace(".", ",")} % der rückgemeldeten Mails wurden zuletzt blockiert oder kamen zurück.</b> Über 10 % ist die Zone, in der Postfächer die Domain abwerten. Jetzt hilft nur weniger senden: Mahn-Obergrenze runter, Frequenzdeckel an, Rückholung klein takten.</div>
          </div>
        )}
        <div className="cr-vier">
          <div className="cr-kennzahl"><b>{zahl(z.sendungen30)}</b><span>Mails in 30 Tagen an {zahl(z.empfaenger30)} Empfänger — im Schnitt {String(z.schnitt).replace(".", ",")} je Kopf, Spitze {zahl(z.maximum)}.</span></div>
          <div className="cr-kennzahl"><b>{zahl(z.blockiert + z.gebounct)}</b><span>blockiert oder zurückgekommen; {zahl(z.spam)} Spam-Beschwerden. Jede davon senkt die Zustellrate aller Mails.</span></div>
          <div className="cr-kennzahl"><b>{zahl(z.geoeffnet + z.geklickt)}</b><span>geöffnet oder geklickt — das Engagement, das die Domain rettet.</span></div>
          <div className="cr-kennzahl"><b>{zahl(daten.bremse.zurueckgehalten24h)}</b><span>Mails hat die Frequenzbremse in 24 h zurückgehalten — Deckel je Empfänger, Pflichtmails ausgenommen.</span></div>
        </div>
        <div className="cr-wochen">
          {z.blockquoteWochen.map((wq) => (
            <div key={wq.woche} className="cr-woche">
              <div className={`cr-woche-balken ${wq.quote >= 10 ? "cr-rot" : ""}`} style={{ height: `${Math.min(100, wq.quote * 5)}%` }} />
              <span>{wq.woche}</span><b>{String(wq.quote).replace(".", ",")} %</b>
            </div>
          ))}
          <p className="cr-wochen-satz">Blockquote je Woche (nur Mails mit Rückmeldung). Fällt sie, wirkt die Bremse.</p>
        </div>
      </section>

      {/* ── 4. Die Schalter ──────────────────────────────────────────────── */}
      <section className="cz-block">
        <header className="cz-block-kopf"><h3>Die Schalter</h3>
          <p>Alles Zahlen in fiaon_settings — wirken sofort, ohne Auslieferung. 0 heißt überall: aus.</p>
        </header>
        <div className="cr-schalter">
          {([
            ["rueckhol_pro_tag", "Rückhol-Mails je Tag", "Der Haupthahn. 0 = kein Versand. Empfehlung zum Start: 30 — erst S1/S2 abarbeiten, Wirkung ansehen, dann erhöhen."],
            ["frequenz_pro_tag", "Je Empfänger: Mails pro Tag", "Deckel über ALLE werbenden Mails des Hauses. Standard 2."],
            ["frequenz_pro_woche", "Je Empfänger: pro Woche", "Standard 4. Justins 2-Tage-Takt passt darunter."],
            ["frequenz_pro_monat", "Je Empfänger: pro 30 Tage", "Standard 8. Ab Mail 6 verdoppelt sich die Blockquote — 8 ist die Oberkante."],
            ["max_reminders", "Mahnungen je Bestellung (Kette)", "Steht live auf 60. Die Messung sagt: Ab Mahnung 6 ist die Ausbeute null. Empfehlung: 6."],
            ["mahn_takte_pro_tag", "Mahnläufe pro Tag", "2 = zweimal täglich dieselben Leute. Empfehlung: 1."],
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

      {/* ── 5. Die Wirkung ───────────────────────────────────────────────── */}
      <section className="cz-block">
        <header className="cz-block-kopf"><h3>Die Wirkung</h3>
          <p>Der belegte Weg: Mail → gebuchter Termin (Faktor 6) → Zahlung. Erst wenn hier Zahlen stehen, weißt du, ob die Maschine verkauft.</p>
        </header>
        <div className="cr-stufen">
          <div className="cr-stufe"><MailX size={16} /><b>{zahl(w.angeschrieben)}</b><span>Menschen angeschrieben</span></div>
          <div className="cr-pfeil">{w.angeschrieben ? `${Math.round((w.termine / w.angeschrieben) * 100)} %` : "→"}</div>
          <div className="cr-stufe"><CalendarCheck2 size={16} /><b>{zahl(w.termine)}</b><span>haben danach einen Termin gebucht</span></div>
          <div className="cr-pfeil">{w.termine ? `${Math.round((w.bezahlt / w.termine) * 100)} %` : "→"}</div>
          <div className="cr-stufe"><PhoneCall size={16} /><b>{zahl(w.bezahlt)}</b><span>haben bezahlt — {eur(w.umsatz_cents)}</span></div>
        </div>
      </section>

      {/* ── 6. Die Läufe ─────────────────────────────────────────────────── */}
      <section className="cz-block">
        <header className="cz-block-kopf"><h3>Die Läufe</h3><p>Grün: zuletzt sauber gelaufen. Der Rückhol-Takt prüft alle 30 Minuten, verschickt aber nur bis zum Tagesdeckel.</p></header>
        <div className="cr-laeufe">
          {daten.laeufe.map((l) => (
            <div key={l.name} className={`cr-lauf cr-lauf-${l.ampel}`}>
              <b>{l.name === "rueckholung" ? "Rückholung (5 Segmente)" : l.name === "sepa-werbung" ? "SEPA-Einladungen" : l.name}</b>
              <span>{l.letzteMeldung || "noch nie gelaufen"}</span>
              <small>{l.letzterErfolg ? `zuletzt ${seit(l.letzterErfolg)}` : "—"}</small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
