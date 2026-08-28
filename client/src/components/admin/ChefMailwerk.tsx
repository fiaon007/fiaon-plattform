// ═══════════════════════════════════════════════════════════════════════════
// DAS MAILWERK — die Steuerzentrale des Mail-Systems (28.08.2026)
//
// Justin: „Ich brauche sowas wo ich das sehen, steuern kann — so, dass es
// aber auch wirklich funktioniert."
//
// Vier Abschnitte, von grob nach fein:
//   1. Der Versandweg      make (bewährt) | direkt (Quelltext-Vorlagen, Brevo)
//   2. Die Takte           Mahnungen und Lead-Strecke — an/aus, wie oft, Fenster
//   3. Die Läufe           Ampeln der Automatik (läuft sie wirklich?)
//   4. Jede Mail           Volumen, Probleme, Vorschau, Prüfversand
//
// Die Vorschau lädt ÜBER DEN SERVER gerendertes HTML (dieselbe Funktion, die
// auch versendet) — sie kann also nicht vom echten Versand abweichen.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { Eye, Send, X, CheckCircle2, AlertTriangle } from "lucide-react";
import "@/styles/chef-mailwerk.css";

interface Ereignis {
  type: string; label: string; gruppe: string; zielgruppe: string; klartext: string;
  hatVorlage: boolean; absender: string;
  volumen30: number; versandt30: number; probleme30: number; letzter: string | null;
}
interface Lauf { name: string; letzterErfolg: string | null; letzteMeldung: string | null; stundenHer: number | null; ampel: string }
interface Antwort {
  ok: boolean; ereignisse: Ereignis[];
  schalter: { versandweg: string; ausnahmen: string };
  takte: {
    mahnTakte: number; mahnFensterVon: number; mahnFensterBis: number; mahnObergrenze: number; mahnAn: boolean;
    leadAn: boolean; leadZeiten: string; leadPlan: string; leadObergrenze: number;
  };
  testAdresse: string; laeufe: Lauf[];
}

const wann = (iso: string | null) => iso
  ? new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" })
  : "nie";

const LAUF_NAME: Record<string, string> = {
  zahlungserinnerungen: "Zahlungserinnerungen (Startzahlung)",
  "lead-nachfass-und-verteilung": "Lead-Strecke & Verteilung",
  "abo-motor": "Abo-Motor (Raten & Mahnstufen)",
};

export default function ChefMailwerk() {
  const [daten, setDaten] = useState<Antwort | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [vorschau, setVorschau] = useState<Ereignis | null>(null);
  const [sendet, setSendet] = useState<string | null>(null);
  const [testAdresse, setTestAdresse] = useState("");
  const [takte, setTakte] = useState<Antwort["takte"] | null>(null);

  const laden = () => {
    fetch("/api/fiaon/chef/mailwerk", { credentials: "include" })
      .then((r) => r.json())
      .then((d: Antwort) => {
        if (!d.ok) throw new Error("Antwort nicht ok");
        setDaten(d); setTestAdresse(d.testAdresse); setTakte(d.takte);
      })
      .catch(() => setFehler("Das Mailwerk lässt sich gerade nicht laden."));
  };
  useEffect(laden, []);

  const speichern = async (key: string, value: string, hinweis?: string) => {
    setMeldung(null);
    const r = await fetch("/api/fiaon/chef/mailwerk/einstellung", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    }).then((x) => x.json()).catch(() => ({ ok: false, error: "Netzwerkfehler" }));
    setMeldung(r.ok ? (hinweis ?? "Gespeichert.") : `Nicht gespeichert: ${r.error}`);
    if (r.ok) laden();
  };

  const pruefversand = async (type: string) => {
    setSendet(type); setMeldung(null);
    const r = await fetch(`/api/fiaon/chef/mailwerk/pruefversand/${type}`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ an: testAdresse }),
    }).then((x) => x.json()).catch(() => ({ ok: false, error: "Netzwerkfehler" }));
    setSendet(null);
    setMeldung(r.ok ? r.meldung : `Prüfversand fehlgeschlagen: ${r.error}`);
  };

  if (fehler) return <div className="cz-fehler">{fehler}</div>;
  if (!daten || !takte) return <div className="cz-laedt">Das Mailwerk wird geladen …</div>;

  const direkt = daten.schalter.versandweg === "direkt";
  const kunden = daten.ereignisse.filter((e) => e.zielgruppe === "kunde");
  const team = daten.ereignisse.filter((e) => e.zielgruppe !== "kunde");

  return (
    <div className="cm">
      {meldung && <div className="cm-meldung" role="status">{meldung}</div>}

      {/* ── 1. Der Versandweg ─────────────────────────────────────────── */}
      <section className="cz-block">
        <header>
          <h2>Der Versandweg</h2>
          <p>
            Entscheidet, was hinter der einen Versand-Tür passiert. <b>Make</b> ist der bewährte
            Umweg über das Szenario; <b>Direkt</b> rendert die Quelltext-Vorlagen und sendet
            über Brevo — mit Annahme-Kennung im Protokoll und ohne Zweige, die fehlen können.
            Der Schalter wirkt binnen einer Minute und geht jederzeit zurück.
          </p>
        </header>
        <div className="cm-weg">
          <button className={`cm-weg-knopf${!direkt ? " aktiv" : ""}`}
            onClick={() => speichern("mail_versandweg", "make", "Versandweg: Make. Wirkt binnen einer Minute.")}>
            <b>Make</b><span>Webhook → Szenario → Brevo-Vorlage</span>
          </button>
          <button className={`cm-weg-knopf${direkt ? " aktiv" : ""}`}
            onClick={() => speichern("mail_versandweg", "direkt", "Versandweg: Direkt. Wirkt binnen einer Minute.")}>
            <b>Direkt</b><span>Quelltext-Vorlage → Brevo, mit Zustellspur</span>
          </button>
          <label className="cm-test">
            <span>Testadresse für Prüfversände</span>
            <div>
              <input value={testAdresse} onChange={(e) => setTestAdresse(e.target.value)}
                placeholder="deine@adresse.de" type="email" />
              <button onClick={() => speichern("mail_test_adresse", testAdresse, "Testadresse gespeichert.")}>Speichern</button>
            </div>
          </label>
        </div>
      </section>

      {/* ── 2. Die Takte ──────────────────────────────────────────────── */}
      <section className="cz-block">
        <header>
          <h2>Die Takte der Automatik</h2>
          <p>
            Offene Rechnungen und Leads ohne Antrag werden automatisch bespielt — hier steht,
            wie oft. Die Stopp-Regeln bleiben immer an: Wer bezahlt hat, einen Antrag stellt,
            sich abmeldet oder dessen Adresse nicht existiert, bekommt nichts mehr.
          </p>
        </header>
        <div className="cm-takte">
          <div className="cm-takt">
            <div className="cm-takt-kopf">
              <b>Zahlungserinnerungen</b>
              <button className={`cm-an${takte.mahnAn ? " ja" : ""}`}
                onClick={() => speichern("reminder_engine_enabled", takte.mahnAn ? "0" : "1")}>
                {takte.mahnAn ? "AN" : "AUS"}
              </button>
            </div>
            <label>Wie oft am Tag
              <select value={takte.mahnTakte}
                onChange={(e) => speichern("mahn_takte_pro_tag", e.target.value)}>
                <option value="1">1× täglich</option>
                <option value="2">2× täglich</option>
              </select>
            </label>
            <label>Sendefenster (Uhr, Berlin)
              <div className="cm-paar">
                <input type="number" min={8} max={19} defaultValue={takte.mahnFensterVon}
                  onBlur={(e) => speichern("reminder_window_start", e.target.value)} />
                <span>bis</span>
                <input type="number" min={9} max={20} defaultValue={takte.mahnFensterBis}
                  onBlur={(e) => speichern("reminder_window_end", e.target.value)} />
              </div>
            </label>
            <label>Höchstens Erinnerungen je Bestellung
              <input type="number" min={1} max={60} defaultValue={takte.mahnObergrenze}
                onBlur={(e) => speichern("max_reminders", e.target.value)} />
            </label>
            <p className="cm-fein">Bei 2× täglich hält der Lauf fünf Stunden Abstand je Kunde — vormittags und nachmittags je einmal.</p>
          </div>

          <div className="cm-takt">
            <div className="cm-takt-kopf">
              <b>Lead-Strecke (ohne Antrag)</b>
              <button className={`cm-an${takte.leadAn ? " ja" : ""}`}
                onClick={() => speichern("lead_followup_enabled", takte.leadAn ? "0" : "1")}>
                {takte.leadAn ? "AN" : "AUS"}
              </button>
            </div>
            <label>Sende-Uhrzeiten (Komma getrennt)
              <input defaultValue={takte.leadZeiten} placeholder="09:15,15:30"
                onBlur={(e) => speichern("lead_followup_times", e.target.value)} />
            </label>
            <label>Stufenplan (Tage seit Eintrag, je Stufe eine Mail)
              <input defaultValue={takte.leadPlan}
                onBlur={(e) => speichern("lead_followup_days", e.target.value)} />
            </label>
            <label>Höchstens Mails je Lead
              <input type="number" min={1} max={200} defaultValue={takte.leadObergrenze}
                onBlur={(e) => speichern("max_lead_followups", e.target.value)} />
            </label>
            <p className="cm-fein">
              Zwei Mails am Tag brauchen ZWEI Uhrzeiten und einen Plan mit doppelten Tagen
              (z. B. 1,1,2,2,4,4 …) — sonst greift nur der erste Slot.
            </p>
          </div>
        </div>
      </section>

      {/* ── 3. Die Läufe ──────────────────────────────────────────────── */}
      <section className="cz-block">
        <header><h2>Läuft die Automatik?</h2></header>
        <div className="cm-laeufe">
          {daten.laeufe.map((l) => (
            <div key={l.name} className={`cm-lauf ${l.ampel}`}>
              <i />
              <div>
                <b>{LAUF_NAME[l.name] ?? l.name}</b>
                <span>letzter Erfolg {wann(l.letzterErfolg)}{l.letzteMeldung ? ` · ${l.letzteMeldung}` : ""}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 4. Jede Mail ──────────────────────────────────────────────── */}
      {[{ titel: "An Kunden", liste: kunden }, { titel: "An das Team", liste: team }].map((block) => (
        <section className="cz-block" key={block.titel}>
          <header>
            <h2>{block.titel} — {block.liste.length} Mails</h2>
            {block.titel === "An Kunden" && (
              <p>Sortiert nach Volumen der letzten 30 Tage. „Ansehen" zeigt exakt das, was der Kunde bekommt.</p>
            )}
          </header>
          <div className="cm-tab-halter">
            <table className="cm-tab">
              <thead><tr>
                <th>Mail</th><th>Absender</th><th>30 Tage</th><th>Probleme</th><th>Zuletzt</th><th></th>
              </tr></thead>
              <tbody>
                {block.liste.map((e) => (
                  <tr key={e.type}>
                    <td>
                      <b>{e.label}</b>
                      <span className="cm-klartext">{e.klartext}</span>
                    </td>
                    <td className="cm-abs">{e.absender}</td>
                    <td className="cm-zahl">{e.volumen30.toLocaleString("de-DE")}</td>
                    <td className={`cm-zahl${e.probleme30 > 0 ? " rot" : ""}`}>{e.probleme30 || "—"}</td>
                    <td className="cm-wann">{wann(e.letzter)}</td>
                    <td className="cm-tun">
                      {e.hatVorlage ? (
                        <>
                          <button title="Vorschau ansehen" onClick={() => setVorschau(e)}><Eye size={15} /></button>
                          <button title={`Prüfversand an ${testAdresse || "Testadresse"}`}
                            disabled={sendet === e.type} onClick={() => pruefversand(e.type)}>
                            {sendet === e.type ? "…" : <Send size={15} />}
                          </button>
                        </>
                      ) : (
                        <span className="cm-ohne" title="Für dieses Ereignis gibt es noch keine Quelltext-Vorlage — es läuft weiter über Make.">
                          <AlertTriangle size={14} /> Make
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {/* ── Vorschau-Fenster ─────────────────────────────────────────── */}
      {vorschau && (
        <div className="cm-schleier" onClick={() => setVorschau(null)}>
          <div className="cm-fenster" onClick={(e) => e.stopPropagation()}>
            <div className="cm-fenster-kopf">
              <div>
                <b>{vorschau.label}</b>
                <span>{vorschau.absender} · mit Beispieldaten — genau so kommt sie an</span>
              </div>
              <button onClick={() => setVorschau(null)} aria-label="Schließen"><X size={18} /></button>
            </div>
            <iframe title={vorschau.label} src={`/api/fiaon/admin/mail/galerie/${vorschau.type}`} />
          </div>
        </div>
      )}

      <p className="cz-stand">
        <CheckCircle2 size={13} style={{ verticalAlign: "-2px" }} /> Jede Mail — automatisch oder von Hand — steht
        im Protokoll; beim Direktversand mit Brevo-Kennung. Notbremse: Versandweg auf „Make" stellen.
      </p>
    </div>
  );
}
