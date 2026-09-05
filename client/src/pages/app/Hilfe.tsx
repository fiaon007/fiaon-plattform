// /app/mehr/hilfe — Hilfe (Bauvorlage 3.15): Ansprechperson, Nachricht schreiben
// (bestehende Tickets-Endpunkte), Anruf-Termin wählen, bisherige Anliegen,
// Telefon/E-Mail, häufige Fragen. Keine Rückruf-Zusage („meldet sich“), kein
// Live-Chat — „Sie sehen die Antwort hier in Ihrem Bereich" (eine Antwort-Mail gibt es
// nicht: /agent/tickets/:id/antwort schreibt nur Ticket und Kontaktverlauf, Prüfung 05.09.).
//
// /app/mehr/termine — Termine (Bauvorlage 3.14): kommende mit Absage-Link,
// vergangene, Anruf-Termin wählen. Daten: GET /kunde/:ref/termine (vorhanden).
import { useEffect, useState } from "react";
import { SUPPORT } from "@shared/fiaon-wissen";
import { api } from "./Bausteine";

interface Ticket { id: number; betreff: string; text: string; status: string; antwort: string | null; beantwortet_am: string | null; created_at: string }
interface Termin { id: number; beginn: string; datumText: string; uhrzeit: string; status: string; mit: string | null; absageLink: string | null }
interface Termine { kommende: Termin[]; vergangene: Termin[]; buchungsLink: string | null }

const datum = (iso: string | null) => { if (!iso) return ""; const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" }); };

// Häufige Fragen — Wortwand-geprüft, ohne Zeitzusage, ohne Zusage der Bank.
const FRAGEN_ANTWORTEN: { f: string; a: string }[] = [
  { f: "Wie lange dauert es bis zur Karte?", a: "Das hängt von der Bank ab. Unter „Weg“ sehen Sie, welche Schritte noch offen sind – eine Zeit nennen wir nicht, weil wir sie nicht kennen." },
  { f: "Kann FIAON meine P-Konto-Bescheinigung ausstellen?", a: "Nein. Das dürfen nur bestimmte Stellen, zum Beispiel Arbeitgeber, Jobcenter oder eine anerkannte Schuldnerhilfe. Wir bereiten für Sie den Antrag auf Erhöhung des Freibetrags an Ihre Bank vor und schreiben Ihnen auf, welche Stelle die Bescheinigung ausstellt." },
  { f: "Wer entscheidet über Karte und Rahmen?", a: "Die Bank. FIAON bereitet vor und begleitet." },
  { f: "Was ist der Zahlungsnachweis?", a: "Jede Rate, die bis zum Fälligkeitstag eingeht, zählt als pünktlich. Die Liste unter „Geld“ ist Ihr Nachweis." },
  { f: "Was passiert mit meinem fotografierten Brief?", a: "Er landet in Ihrer Akte, Ihre Ansprechperson liest ihn und schreibt Ihnen unter „Vorgänge“, was wir daraus machen – mit Datum. Sie müssen nichts erklären." },
];

export function Hilfe({ kundeRef, demo, ansprechpartner, vorgang, buchungsLink }: { kundeRef: string; demo: boolean; ansprechpartner: { name: string; rolle: string | null } | null; vorgang: string | null; buchungsLink: string | null }) {
  const [betreff, setBetreff] = useState(vorgang ? `Frage zu Vorgang ${vorgang}` : "");
  const [text, setText] = useState("");
  const [dringend, setDringend] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ ton: "gut" | "fehler"; text: string } | null>(null);
  const [liste, setListe] = useState<Ticket[] | null>(null);
  const [offen, setOffen] = useState<number | null>(null);

  const laden = () => { api(`/kunde/${encodeURIComponent(kundeRef)}/tickets`).then((r) => setListe(Array.isArray(r.json?.tickets) ? r.json.tickets : [])).catch(() => setListe([])); };
  useEffect(laden, [kundeRef]);

  const senden = async (e: React.FormEvent) => {
    e.preventDefault();
    if (betreff.trim().length < 3 || text.trim().length < 10) return;
    if (demo) { setMeldung({ ton: "gut", text: "In der Demo-Ansicht wird nichts gesendet." }); return; }
    setLaeuft(true); setMeldung(null);
    // Dringend: das Kästchen wandert als Kennzeichen in den Betreff, bis fiaon_tickets ein eigenes Feld hat (Bauvorlage 8.3).
    const b = `${dringend ? "[DRINGEND – Post mit kurzer Frist] " : ""}${betreff.trim()}`.slice(0, 160);
    const r = await api(`/kunde/${encodeURIComponent(kundeRef)}/tickets`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ betreff: b, text: text.trim() }) });
    setLaeuft(false);
    if (r.ok && r.json?.ok !== false) {
      setMeldung({ ton: "gut", text: `Ihre Nachricht ist bei ${ansprechpartner?.name ?? "Ihrem FIAON-Team"}. Sie sehen die Antwort hier in Ihrem Bereich.${dringend ? " Wir haben das als dringend vermerkt." : ""}` });
      setBetreff(""); setText(""); setDringend(false); laden();
    } else setMeldung({ ton: "fehler", text: r.json?.error || "Die Nachricht konnte nicht gesendet werden. Ihr Text bleibt stehen – bitte noch einmal senden." });
  };

  return (
    <>
      <h1 className="ap-gruss ap-auf">Hilfe<small>{ansprechpartner ? `${ansprechpartner.name}${ansprechpartner.rolle ? `, ${ansprechpartner.rolle}` : ""} kümmert sich um Sie.` : "Ihr FIAON-Team kümmert sich um Sie."}</small></h1>

      <form className="ap-karte ap-auf v1" onSubmit={senden} style={{ display: "grid", gap: 12 }}>
        <h3>Nachricht schreiben</h3>
        <label className="ap-feld"><span>Worum geht es?</span><input value={betreff} onChange={(e) => setBetreff(e.target.value)} maxLength={160} /></label>
        <label className="ap-feld"><span>Ihre Nachricht</span><textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} maxLength={4000} style={{ width: "100%", padding: "12px 14px", borderRadius: "var(--fi-radius-knopf, 10px)", border: "1px solid var(--fi-linie)", font: "inherit", fontSize: 16, lineHeight: 1.5, resize: "vertical", background: "#fff", color: "var(--fi-text)" }} /></label>
        <label className="ap-check"><input type="checkbox" checked={dringend} onChange={(e) => setDringend(e.target.checked)} /><span>Ich habe Post von Gericht, Gerichtsvollzieher oder Inkasso mit kurzer Frist.</span></label>
        <button type="submit" className="ap-knopf" disabled={laeuft || betreff.trim().length < 3 || text.trim().length < 10}>{laeuft ? "Wird gesendet …" : "Nachricht senden"}</button>
        {meldung && <div className={`ap-meldung ${meldung.ton}`} role="status">{meldung.text}</div>}
      </form>

      <div className="ap-karte ap-auf v2">
        <h3>Lieber sprechen?</h3>
        <p>Wählen Sie eine Zeit – wir rufen Sie dann an. So erreichen Sie {ansprechpartner?.name ?? "Ihr Team"} ohne Warteschleife.</p>
        {buchungsLink ? <a className="ap-knopf still" style={{ marginTop: 12 }} href={buchungsLink}>Anruf-Termin wählen</a> : <p className="ap-fuss">Ein Terminlink liegt gerade nicht vor. Schreiben Sie uns oben – wir bieten Ihnen dann Zeiten an.</p>}
        <dl className="ap-liste" style={{ marginTop: 12 }}>
          <dt>Telefon</dt><dd><a className="ap-link" href={`tel:${SUPPORT.telefonTel}`}>{SUPPORT.telefon}</a></dd>
          <dt>E-Mail</dt><dd><a className="ap-link" href={`mailto:${SUPPORT.email}`}>{SUPPORT.email}</a></dd>
        </dl>
      </div>

      <section className="ap-abschnitt ap-auf v3">
        <h2 className="ap-abschnitt-titel">Ihre bisherigen Anliegen</h2>
        {!liste && <div className="ap-skelett" style={{ height: 80, borderRadius: 14 }} />}
        {liste && liste.length === 0 && <div className="ap-karte ap-leer" style={{ padding: 18 }}>Noch kein Anliegen. Ihre erste Nachricht erscheint hier mit Stand und Antwort.</div>}
        {liste && liste.map((t) => (
          <article key={t.id} className="ap-karte">
            <div className="ap-karte-kopf"><h3>{t.betreff}</h3><span className={`ap-status ${t.status === "erledigt" || t.antwort ? "gut" : "offen"}`}>{t.status === "erledigt" || t.antwort ? "Beantwortet" : "In Bearbeitung"}</span></div>
            <p style={{ whiteSpace: "pre-wrap" }}>{t.text}</p>
            {t.antwort && <div className="ap-meldung gut" style={{ whiteSpace: "pre-wrap" }}><b style={{ display: "block", fontWeight: 500 }}>Antwort{t.beantwortet_am ? ` vom ${datum(t.beantwortet_am)}` : ""}</b>{t.antwort}</div>}
            <p className="ap-fuss">gesendet am {datum(t.created_at)}</p>
          </article>
        ))}
      </section>

      <section className="ap-abschnitt ap-auf v4">
        <h2 className="ap-abschnitt-titel">Häufige Fragen</h2>
        <div className="ap-karte ap-linkliste">
          {FRAGEN_ANTWORTEN.map((q, i) => (
            <div key={i} style={{ borderTop: i ? "1px solid var(--fi-linie)" : 0 }}>
              <button type="button" onClick={() => setOffen(offen === i ? null : i)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", minHeight: 56, padding: "0 16px", border: 0, background: "none", font: "inherit", fontSize: 16, textAlign: "left", cursor: "pointer", color: "var(--fi-text)" }}>
                <span>{q.f}</span><span style={{ color: "var(--fi-text-still)", fontSize: 20, transform: offen === i ? "rotate(90deg)" : "none", transition: "transform var(--fi-mikro, 120ms)" }}>›</span>
              </button>
              {offen === i && <p style={{ margin: "0 16px 14px", color: "var(--fi-text-leise)", fontSize: 16, lineHeight: 1.5 }}>{q.a}</p>}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

export function Termine({ kundeRef, demo, daten }: { kundeRef: string; demo: boolean; daten: Termine | null }) {
  return (
    <>
      <h1 className="ap-gruss ap-auf">Termine<small>Ihre Gespräche mit FIAON – kommende und vergangene.</small></h1>
      {!daten && <div className="ap-skelett" style={{ height: 120, borderRadius: 14 }} />}
      {daten && (
        <>
          <section className="ap-abschnitt ap-auf v1">
            <h2 className="ap-abschnitt-titel">Kommende</h2>
            {daten.kommende.length === 0 && <div className="ap-karte" style={{ padding: 18 }}><p style={{ margin: 0 }}>Kein Termin geplant.{daten.buchungsLink ? " Wählen Sie unten eine Zeit, wenn Sie sprechen möchten." : ""}</p></div>}
            {daten.kommende.map((t) => (
              <article key={t.id ?? t.beginn} className="ap-karte">
                <div className="ap-karte-kopf"><h3>{t.datumText}, {t.uhrzeit} Uhr</h3><span className="ap-stempel">am Telefon</span></div>
                <p>{t.mit ? `Mit ${t.mit}. ` : ""}Halten Sie Ihr Handy bereit – wir rufen Sie an.</p>
                {t.absageLink && <a className="ap-link" href={t.absageLink} style={{ display: "inline-block", marginTop: 10, fontSize: 15 }}>Termin absagen</a>}
              </article>
            ))}
          </section>
          {daten.buchungsLink && <a className="ap-knopf still ap-auf v2" href={daten.buchungsLink}>Anruf-Termin wählen</a>}
          {daten.vergangene.length > 0 && (
            <section className="ap-abschnitt ap-auf v3">
              <h2 className="ap-abschnitt-titel">Vergangene</h2>
              <div className="ap-karte" style={{ padding: "4px 16px" }}>
                <ol className="ap-etappen">
                  {daten.vergangene.map((t) => (
                    <li key={t.id ?? t.beginn} className={`ap-etappe ${t.status === "erledigt" ? "fertig" : "kommt"}`}>
                      <span className={`ap-punkt ${t.status === "erledigt" ? "fertig" : ""}`}>{t.status === "erledigt" ? "✓" : null}</span>
                      <div><b>{t.datumText}, {t.uhrzeit} Uhr</b><small>{t.mit ? `Mit ${t.mit} · ` : ""}{t.status === "erledigt" ? "geführt" : t.status === "verpasst" ? "nicht erreicht" : t.status === "abgesagt" ? "abgesagt" : t.status}</small></div>
                      <span />
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          )}
        </>
      )}
      {demo && <p className="ap-fuss">Demo-Ansicht – feste Vorführdaten.</p>}
    </>
  );
}
