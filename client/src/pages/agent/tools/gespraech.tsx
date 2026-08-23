// ═══════════════════════════════════════════════════════════════════════════
// /agent/tools/gespraech — Gesprächs-Begleiter (23.08.2026, Plan §4/§11)
//
// Live-Leitfaden während des Anrufs: Gesprächsart (Erstanruf, Rückruf,
// Startgespräch, Zahlungserinnerung), Timer, Abhak-Schritte mit Sätzen in der
// Sie-Form, Einwand-Schnellhilfe (aufklappbar), Notizfeld. Kunde per Suche
// (GET /agent/kunden/liste?q=) oder ?person=ID. Am Ende „Ins Kontaktprotokoll“
// → POST /agent/crm/kunden/:id/aktivitaet { art: "notiz" } – derselbe Endpunkt
// wie die Notiz in der Akte.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Phone, Play, Pause, RotateCcw, Check, Search, X, FileText } from "lucide-react";
import { AgentShell, api } from "../shared";
import { useOffice } from "../OfficeShell";
import "@/styles/office-tools.css";

type Art = "erstanruf" | "rueckruf" | "startgespraech" | "zahlung";
interface Schritt { titel: string; text?: string; satz?: string }
interface Einwand { frage: string; antwort: string }

const ARTEN: { key: Art; label: string; kurz: string; schritte: Schritt[]; einwaende: Einwand[] }[] = [
  {
    key: "erstanruf", label: "Erstanruf", kurz: "Lead oder abgebrochener Antrag – Interesse prüfen, zum Antrag führen",
    schritte: [
      { titel: "Begrüßung und Anlass", text: "Name, FIAON, Bezug auf den Antrag oder die Anfrage. Kurz fragen, ob es gerade passt.", satz: "Guten Tag, hier ist … von FIAON. Sie haben bei uns eine Anfrage gestellt – passt es Ihnen gerade für zwei Minuten?" },
      { titel: "Ziel des Kunden", text: "Kreditkarte, Kredit, Wohnung, Unternehmen? Das Ziel bestimmt das Paket.", satz: "Was möchten Sie mit FIAON erreichen – geht es um eine Karte, einen Kredit oder eine Wohnung?" },
      { titel: "Lage klären", text: "Negativeinträge? Inkasso? Fristen? Was hat der Kunde schon versucht?", satz: "Gibt es Einträge, von denen Sie wissen – Mahnungen, Inkasso, ein Titel?" },
      { titel: "FIAON in drei Sätzen", text: "Auskunft beschaffen und erklären, Schreiben versenden und verfolgen, Konto und Karte vorbereiten. Über Karte und Rahmen entscheidet die Bank.", satz: "FIAON beschafft Ihre Auskunft, erklärt jeden Eintrag, versendet die Schreiben in Ihrem Namen und bereitet Konto und Karte vor – über die Karte entscheidet die Bank." },
      { titel: "Paket und Rate nennen", text: "Paketfinder nutzen. Rate, zwölf Raten, danach entscheidet der Kunde.", satz: "Für Ihre Lage passt das Paket … – das sind … € im Monat, zwölf Raten, danach entscheiden Sie, ob Sie bleiben." },
      { titel: "Abschluss", text: "Zahlungsdaten senden oder Zahlungsdatum vereinbaren. Ergebnis in der Akte festhalten.", satz: "Dann schicke ich Ihnen jetzt die Zahlungsdaten. Mit der ersten Rate ist Ihr Bereich aktiv, und wir buchen Ihr Startgespräch." },
    ],
    einwaende: [
      { frage: "„Das kann ich doch selbst machen.“", antwort: "Ja – die Auskunft ist kostenlos. Der Unterschied liegt danach: Wer schreibt die Gläubiger an, wer verfolgt Fristen, wer bewertet die Antworten? Das übernimmt FIAON, und Sie sehen alles in Ihrem Bereich." },
      { frage: "„Das ist mir zu teuer.“", antwort: "Verstehe ich. Rechnen wir kurz: Ein einziger erledigter Eintrag entscheidet über Karte oder Absage. Es gibt auch den Einstieg mit FIAON Start – die Auskunft erklärt, die Schreiben zum Selbstversand." },
      { frage: "„Bringt das überhaupt etwas?“", antwort: "Das hängt von Ihren Einträgen ab – deshalb beginnt alles mit der Auskunft. Was angreifbar ist, greifen wir an; was berechtigt ist, sortieren wir mit Ihnen. Versprechen kann ich nichts, zeigen kann ich Ihnen alles." },
      { frage: "„Ich muss erst mit meinem Partner sprechen.“", antwort: "Gern. Darf ich Ihnen die Zahlungsdaten und die Übersicht per Mail schicken, damit Sie beides gemeinsam ansehen? Wann darf ich mich melden – morgen oder übermorgen?" },
      { frage: "„Ich habe gerade keine Zeit.“", antwort: "Kein Problem. Wann passt es Ihnen besser – heute Nachmittag oder morgen früh? Ich trage den Rückruf ein." },
    ],
  },
  {
    key: "rueckruf", label: "Rückruf", kurz: "Vereinbarter Rückruf oder Zahlungszusage – anknüpfen, abschließen",
    schritte: [
      { titel: "Anknüpfen", text: "Bezug auf das letzte Gespräch (Verlauf in der Akte lesen).", satz: "Guten Tag, hier ist … von FIAON. Wir hatten vereinbart, dass ich mich heute melde – passt es gerade?" },
      { titel: "Stand abfragen", text: "Überwiesen? Entschieden? Was fehlt noch?", satz: "Konnten Sie die erste Rate schon überweisen – oder ist noch etwas offen, das wir klären sollten?" },
      { titel: "Hindernis lösen", text: "Fehlende E-Mail, falsche Nummer, Paketwechsel – direkt in der Akte erledigen.", satz: "Das bekommen wir sofort hin – ich ändere das gleich für Sie." },
      { titel: "Verbindlich werden", text: "Zahlungsdatum oder Zahlungsdaten erneut senden. Beleg erbitten, wenn überwiesen.", satz: "Wann überweisen Sie – heute oder morgen? Dann trage ich das ein und wir sprechen direkt nach dem Eingang." },
      { titel: "Ergebnis festhalten", text: "In der Akte: zahlt am …, Rückruf, nicht erreicht. Keine Notiz ohne Ergebnis.", satz: "Danke Ihnen – ich halte das fest, und Sie hören von mir, sobald der Eingang da ist." },
    ],
    einwaende: [
      { frage: "„Ich habe es noch nicht geschafft.“", antwort: "Das passiert. Soll ich Ihnen die Zahlungsdaten jetzt noch einmal per WhatsApp schicken? Dann ist es in zwei Minuten erledigt, und ich rufe morgen kurz an." },
      { frage: "„Ich habe überwiesen, aber es ist nichts passiert.“", antwort: "Danke – dann prüfen wir den Eingang. Schicken Sie mir bitte ein Foto der Überweisung; ich hinterlege es direkt bei der Zahlungsprüfung." },
      { frage: "„Ich habe es mir anders überlegt.“", antwort: "Darf ich fragen, was Sie zögern lässt? Oft ist es die Rate oder die Frage, ob es sich lohnt – beides lässt sich lösen: ein kleineres Paket oder erst einmal nur die Auskunft." },
    ],
  },
  {
    key: "startgespraech", label: "Startgespräch", kurz: "Bezahlter Kunde – 15 Minuten, Fahrplan, Vollmacht, Unterlagen",
    schritte: [
      { titel: "Willkommen und Rahmen", text: "15 Minuten, Fahrplan erklären, feste Ansprechpartnerin nennen.", satz: "Willkommen bei FIAON. Wir haben jetzt eine Viertelstunde: Ich zeige Ihnen den Fahrplan, und Sie sagen mir, was Ihnen am wichtigsten ist." },
      { titel: "Ziel und Lage", text: "Ziel bestätigen, bekannte Einträge, Briefe, Fristen.", satz: "Was ist Ihr wichtigstes Ziel in den nächsten drei Monaten?" },
      { titel: "Vollmacht und Auskunft", text: "Auskunft wird beantragt, Einsicht etwa 24 Stunden nach Eingang. Zustimmungen gibt nur der Kunde selbst – Link schicken.", satz: "Mit Ihrer Vollmacht beantragen wir die Auskunft; etwa einen Tag nach Eingang sehen Sie jeden Eintrag erklärt in Ihrem Bereich." },
      { titel: "Unterlagen", text: "Kontoauszug der letzten drei Monate, Ausweis – Handyfoto genügt.", satz: "Laden Sie bitte den Kontoauszug der letzten drei Monate und Ihren Ausweis hoch – ein Handyfoto reicht." },
      { titel: "Nächste Schritte und Termin", text: "Was passiert wann; nächsten Kontakt vereinbaren.", satz: "Sobald die Auskunft da ist, melde ich mich – dann gehen wir Eintrag für Eintrag durch." },
    ],
    einwaende: [
      { frage: "„Wie lange dauert das alles?“", antwort: "Die Auskunft kommt meist innerhalb weniger Tage; Schreiben an Gläubiger haben Fristen von zwei bis vier Wochen. Sie sehen jeden Schritt mit Datum in Ihrem Bereich." },
      { frage: "„Bekomme ich danach sicher eine Karte?“", antwort: "Über die Karte entscheidet die Bank – das kann niemand versprechen. FIAON sorgt dafür, dass Ihre Auskunft sauber ist und der Antrag vorbereitet liegt, sobald die Schwelle erreicht ist." },
      { frage: "„Muss ich die Unterlagen wirklich hochladen?“", antwort: "Für die Finanzauswertung ja – sie zeigt Einnahmen, Fixkosten und Spielraum. Ohne Kontoauszug fehlt der wichtigste Teil des Bildes." },
    ],
  },
  {
    key: "zahlung", label: "Zahlungserinnerung", kurz: "Rechnung offen oder Frist abgelaufen – freundlich, klar, verbindlich",
    schritte: [
      { titel: "Freundlich anknüpfen", text: "Kein Vorwurf. Bezug auf Antrag und Paket.", satz: "Guten Tag, hier ist … von FIAON. Sie haben bei uns das Paket … beantragt – ich rufe an, weil die erste Rate noch nicht bei uns eingegangen ist." },
      { titel: "Grund erfragen", text: "Vergessen? Zahlungsdaten nicht erhalten? Zweifel? Geld fehlt?", satz: "Haben Sie die Zahlungsdaten erhalten – oder ist etwas dazwischengekommen?" },
      { titel: "Weg freimachen", text: "Zahlungsdaten per Mail oder WhatsApp erneut senden, Verwendungszweck vorlesen.", satz: "Ich schicke Ihnen die Zahlungsdaten gleich noch einmal – der Verwendungszweck lautet … Damit ordnen wir Ihre Zahlung sofort zu." },
      { titel: "Datum vereinbaren", text: "Konkretes Zahlungsdatum festhalten („zahlt am“).", satz: "Bis wann können Sie überweisen? Dann trage ich das Datum ein, und Ihr Bereich ist mit dem Eingang aktiv." },
      { titel: "Ergebnis festhalten", text: "Zahlt sofort / zahlt am … / abgelehnt – in der Akte buchen.", satz: "Vielen Dank – ich halte das fest und melde mich, sobald die Zahlung da ist." },
    ],
    einwaende: [
      { frage: "„Ich habe keine Zahlungsdaten bekommen.“", antwort: "Dann holen wir das sofort nach. Stimmt Ihre E-Mail-Adresse …? Ich schicke die Daten jetzt – oder gleich per WhatsApp, wenn Ihnen das lieber ist." },
      { frage: "„Ich habe gerade kein Geld.“", antwort: "Verstehe ich. Wann ist Ihr nächster Gehaltseingang? Dann tragen wir genau dieses Datum ein, und Sie müssen an nichts mehr denken." },
      { frage: "„Ich will das Paket doch nicht mehr.“", antwort: "Darf ich fragen, was sich geändert hat? Wenn die Rate das Problem ist, gibt es den Einstieg mit FIAON Start. Wenn es die Zweifel sind: Wir beginnen ohnehin mit der Auskunft – die zeigt, ob es sich lohnt." },
      { frage: "„Warum ruft ihr schon wieder an?“", antwort: "Weil Ihr Antrag bei uns offen liegt und ich nicht möchte, dass er einfach verfällt. Wenn Sie es nicht mehr möchten, sage ich das so in die Akte – und Sie hören nichts mehr von uns." },
    ],
  },
];

interface Treffer { personId: number; name: string; telefonWaehlbar: string | null; telefon: string | null; stufe: { marke: string; text: string } | null; produkt: string | null; tier: number; buchungen?: { bezeichnung: string; erledigt: boolean }[] }

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const anrufen = (k: Treffer) => { if (!k.telefonWaehlbar) return; window.dispatchEvent(new CustomEvent("fiaon-anrufen", { detail: { nummer: k.telefonWaehlbar, personId: k.personId, name: k.name } })); };

export default function AgentGespraechPage() { return <AgentShell><GespraechInnen /></AgentShell>; }

function GespraechInnen() {
  const { dunkel, titel } = useOffice();
  useEffect(() => { dunkel(true); titel("Tools · Gesprächs-Begleiter"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [art, setArt] = useState<Art>("erstanruf");
  const vorlage = useMemo(() => ARTEN.find((a) => a.key === art)!, [art]);
  const [haken, setHaken] = useState<Set<number>>(new Set());
  const [notiz, setNotiz] = useState("");
  const [sek, setSek] = useState(0);
  const [laeuft, setLaeuft] = useState(false);
  const [kunde, setKunde] = useState<Treffer | null>(null);
  const [suche, setSuche] = useState("");
  const [treffer, setTreffer] = useState<Treffer[]>([]);
  const [sucht, setSucht] = useState(false);
  const [speichert, setSpeichert] = useState(false);
  const [meldung, setMeldung] = useState<{ gut: boolean; text: string } | null>(null);
  const start = useRef<number | null>(null);

  useEffect(() => { setHaken(new Set()); }, [art]);
  useEffect(() => {
    if (!laeuft) return;
    const i = setInterval(() => setSek((s) => s + 1), 1000);
    return () => clearInterval(i);
  }, [laeuft]);
  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get("person"));
    if (!id) return;
    api(`/agent/crm/kunden/${id}`).then((r) => { if (r.ok && r.json?.kunde) setKunde(r.json.kunde); });
  }, []);
  useEffect(() => {
    const q = suche.trim();
    if (q.length < 2) { setTreffer([]); return; }
    setSucht(true);
    const t = setTimeout(() => {
      api(`/agent/kunden/liste?q=${encodeURIComponent(q)}&limit=20`).then((r) => { setTreffer(r.ok ? (r.json.kunden || []) : []); setSucht(false); });
    }, 260);
    return () => clearTimeout(t);
  }, [suche]);

  const umschalten = (i: number) => setHaken((h) => { const n = new Set(h); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  const starten = () => { if (!start.current) start.current = Date.now(); setLaeuft(true); };
  const zuruecksetzen = () => { setLaeuft(false); setSek(0); start.current = null; };

  const protokollText = () => {
    const schritte = vorlage.schritte.map((s, i) => `${haken.has(i) ? "✓" : "–"} ${s.titel}`).join(", ");
    return `${vorlage.label} (${mmss(sek)} Min): ${schritte}.${notiz.trim() ? ` Notiz: ${notiz.trim()}` : ""}`;
  };
  const insProtokoll = async () => {
    if (!kunde) return;
    setSpeichert(true); setMeldung(null);
    const r = await api(`/agent/crm/kunden/${kunde.personId}/aktivitaet`, { method: "POST", body: JSON.stringify({ art: "notiz", notiz: protokollText() }) });
    setSpeichert(false);
    if (r.ok) { setMeldung({ gut: true, text: `Gespeichert – steht im Verlauf von ${kunde.name}. Das Ergebnis (zahlt, Rückruf, nicht erreicht) buchst du in der Akte.` }); setNotiz(""); setHaken(new Set()); zuruecksetzen(); }
    else setMeldung({ gut: false, text: r.json?.error || "Nicht gespeichert. Bitte erneut versuchen." });
  };
  const fortschritt = Math.round((haken.size / vorlage.schritte.length) * 100);
  const paket = (k: Treffer) => (k.buchungen ?? []).filter((b) => !b.erledigt).map((b) => b.bezeichnung).join(" · ") || k.produkt || "kein Paket";

  return (
    <div className="to">
      <section className="to-kopf">
        <div>
          <span className="to-pille">Tools · Gesprächs-Begleiter</span>
          <h1>Dein Leitfaden <span className="to-verlauf">während des Anrufs.</span></h1>
          <p>Gesprächsart wählen, Kunden suchen, Timer starten. Schritte abhaken, Einwände aufklappen, Notiz tippen – und am Ende mit einem Klick ins Kontaktprotokoll.</p>
        </div>
        <Link href="/agent/tools" className="to-zurueck"><ArrowLeft size={15} strokeWidth={1.75} /> Alle Tools</Link>
      </section>

      <div className="to-spalten breit">
        <div style={{ display: "grid", gap: 14 }}>
          <section className="to-block">
            <div className="to-tabs">{ARTEN.map((a) => <button key={a.key} type="button" className={`to-tab${art === a.key ? " an" : ""}`} onClick={() => setArt(a.key)}>{a.label}</button>)}</div>
            <p className="leise">{vorlage.kurz}</p>
            <div className="to-fortschritt"><i style={{ width: `${fortschritt}%` }} /></div>
            <div className="to-schritte">
              {vorlage.schritte.map((s, i) => (
                <button key={s.titel} type="button" className={`to-schritt${haken.has(i) ? " an" : ""}`} onClick={() => umschalten(i)} aria-pressed={haken.has(i)}>
                  <span className="haken"><Check size={14} strokeWidth={2.5} /></span>
                  <span><b>{i + 1}. {s.titel}</b>{s.text && <span>{s.text}</span>}{s.satz && <q>{s.satz}</q>}</span>
                </button>
              ))}
            </div>
          </section>
          <section className="to-block leicht">
            <div className="to-block-kopf"><b>Einwand-Schnellhilfe</b><small>antippen zum Aufklappen</small></div>
            {vorlage.einwaende.map((e) => (
              <details key={e.frage} className="to-einwand"><summary>{e.frage}</summary><p>{e.antwort}</p></details>
            ))}
          </section>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <section className="to-block">
            <div className="to-block-kopf"><b>Kunde</b>{kunde && <button type="button" className="to-link" onClick={() => setKunde(null)}>wechseln</button>}</div>
            {kunde ? (
              <>
                <div className="to-kunde">
                  <span className={`marke ${kunde.stufe?.marke ?? (kunde.tier === 0 ? "OK" : "")}`}>{kunde.stufe?.marke ?? (kunde.tier === 0 ? "✓" : "–")}</span>
                  <div><b>{kunde.name}</b><small>{paket(kunde)}{kunde.telefon ? ` · ${kunde.telefon}` : ""}</small></div>
                </div>
                <div className="to-reihe">
                  <button type="button" className="to-knopf" disabled={!kunde.telefonWaehlbar} onClick={() => anrufen(kunde)}><Phone size={15} strokeWidth={1.75} /> Anrufen</button>
                  <Link href={`/agent/pipeline?person=${kunde.personId}`} className="to-knopf still"><FileText size={15} strokeWidth={1.75} /> Akte</Link>
                </div>
              </>
            ) : (
              <>
                <label className="to-eingabe" style={{ display: "flex", alignItems: "center", gap: 8, color: "#94a3b8" }}>
                  <Search size={15} strokeWidth={1.75} />
                  <input value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="Name, E-Mail, Nummer, Referenz" style={{ flex: 1, background: "transparent", border: 0, outline: "none", color: "#fff", font: "inherit" }} />
                  {suche && <button type="button" className="to-link" onClick={() => setSuche("")} aria-label="leeren"><X size={14} /></button>}
                </label>
                {sucht && <p className="leise">Suche …</p>}
                {!sucht && suche.trim().length >= 2 && treffer.length === 0 && <p className="leise">Kein Treffer in deinem Bestand.</p>}
                {treffer.length > 0 && (
                  <div className="to-treffer">
                    {treffer.map((t) => <button key={t.personId} type="button" onClick={() => { setKunde(t); setSuche(""); setTreffer([]); }}><b>{t.name}</b><small>{t.stufe ? `Stufe ${t.stufe.marke} · ` : ""}{paket(t)}</small></button>)}
                  </div>
                )}
                {!suche && <p className="leise">Ohne Kunden läuft der Leitfaden trotzdem – nur das Protokoll braucht einen.</p>}
              </>
            )}
          </section>

          <section className="to-block">
            <div className="to-block-kopf"><b>Timer</b><small>{laeuft ? "läuft" : sek > 0 ? "pausiert" : "bereit"}</small></div>
            <div className={`to-timer${laeuft ? " laeuft" : ""}`}>
              <b>{mmss(sek)}</b>
              <div className="to-reihe">
                {laeuft ? <button type="button" className="to-knopf still" onClick={() => setLaeuft(false)}><Pause size={15} strokeWidth={1.75} /> Pause</button>
                  : <button type="button" className="to-knopf" onClick={starten}><Play size={15} strokeWidth={1.75} /> {sek > 0 ? "Weiter" : "Start"}</button>}
                <button type="button" className="to-knopf still klein" onClick={zuruecksetzen} disabled={sek === 0 && !laeuft}><RotateCcw size={14} strokeWidth={1.75} /></button>
              </div>
            </div>
          </section>

          <section className="to-block">
            <div className="to-block-kopf"><b>Notiz</b><small>{haken.size}/{vorlage.schritte.length} Schritte</small></div>
            <textarea className="to-eingabe" value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="Was der Kunde gesagt hat, was vereinbart ist …" />
            {meldung && <p className={meldung.gut ? "to-meldung" : "to-fehler"}>{meldung.text}</p>}
            <button type="button" className="to-knopf" disabled={!kunde || speichert} onClick={() => void insProtokoll()} title={kunde ? "Speichert Gesprächsart, Dauer, Schritte und Notiz als Eintrag im Verlauf" : "Zuerst einen Kunden wählen"}>
              {speichert ? "Speichert …" : "Ins Kontaktprotokoll"}
            </button>
            <p className="to-fussnote">Das Ergebnis des Gesprächs (zahlt sofort, zahlt am …, Rückruf, nicht erreicht) buchst du in der Akte – dort sitzt die Ergebniswahl.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
