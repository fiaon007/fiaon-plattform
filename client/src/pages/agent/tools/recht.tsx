// ═══════════════════════════════════════════════════════════════════════════
// /agent/tools/recht — Rechtsrechner (23.08.2026, Plan §4/§11)
//
// Löschfrist, Verjährung und Inkassokosten in einem Werkzeug. Die Rechenlogik
// ist aus den öffentlichen Werkzeugen übernommen und angepasst
// (client/src/pages/site/werkzeuge/loeschfrist.tsx, verjaehrung.tsx,
// inkassokosten.tsx) – nicht importiert, damit die Mitarbeiterseite keine
// Website-Bühne zieht. Jedes Ergebnis endet mit dem Satz, den man dem Kunden
// vorlesen kann (Sie-Form). Nichts wird gespeichert.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Copy, Check } from "lucide-react";
import { AgentShell } from "../shared";
import { useOffice } from "../OfficeShell";
import "@/styles/office-tools.css";

type Tab = "loeschfrist" | "verjaehrung" | "inkasso";
const fmt = (d: Date) => d.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
const parse = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + "T12:00:00") : null);
const tage = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400000);
const plusMonate = (d: Date, m: number) => { const x = new Date(d); x.setMonth(x.getMonth() + m); return x; };
const jahresende = (d: Date, plusJahre: number) => new Date(d.getFullYear() + plusJahre, 11, 31, 23, 59, 59);
const euro = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const zahl = (s: string) => { const n = parseFloat(String(s).replace(/\./g, "").replace(",", ".")); return isFinite(n) && n >= 0 ? n : 0; };

export default function AgentRechtPage() { return <AgentShell><RechtInnen /></AgentShell>; }

function RechtInnen() {
  const { dunkel, titel } = useOffice();
  useEffect(() => { dunkel(true); titel("Tools · Rechtsrechner"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [tab, setTab] = useState<Tab>("loeschfrist");
  return (
    <div className="to">
      <section className="to-kopf">
        <div>
          <span className="to-pille">Tools · Rechtsrechner</span>
          <h1>Frist, Verjährung, <span className="to-verlauf">Kosten.</span></h1>
          <p>Drei Fragen, die am Telefon immer wieder kommen – mit Datum, Betrag und dem Satz, den du dem Kunden vorliest. Richtwerte, keine Rechtsprüfung des Einzelfalls.</p>
        </div>
        <Link href="/agent/tools" className="to-zurueck"><ArrowLeft size={15} strokeWidth={1.75} /> Alle Tools</Link>
      </section>
      <div className="to-tabs">
        {([["loeschfrist", "Löschfrist"], ["verjaehrung", "Verjährung"], ["inkasso", "Inkassokosten"]] as [Tab, string][]).map(([k, l]) => (
          <button key={k} type="button" className={`to-tab${tab === k ? " an" : ""}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === "loeschfrist" && <Loeschfrist />}
      {tab === "verjaehrung" && <Verjaehrung />}
      {tab === "inkasso" && <Inkasso />}
    </div>
  );
}

function Satz({ text, grundlage }: { text: string; grundlage: string }) {
  const [kopiert, setKopiert] = useState(false);
  return (
    <>
      <div className="to-satz">
        <small>So sagst du es dem Kunden</small>
        <p>{text}</p>
        <div className="fuss"><button type="button" className="to-knopf still klein" onClick={async () => { try { await navigator.clipboard.writeText(text); setKopiert(true); setTimeout(() => setKopiert(false), 1800); } catch { /* egal */ } }}>{kopiert ? <><Check size={13} /> Kopiert</> : <><Copy size={13} strokeWidth={1.75} /> Kopieren</>}</button></div>
      </div>
      <p className="to-fussnote">{grundlage}</p>
    </>
  );
}
function Opt<T extends string>({ wert, an, setzen, b, s }: { wert: T; an: T | ""; setzen: (v: T) => void; b: string; s?: string }) {
  return <button type="button" className={`to-option${an === wert ? " an" : ""}`} onClick={() => setzen(wert)}><b>{b}</b>{s && <small>{s}</small>}</button>;
}

// ── Löschfrist ────────────────────────────────────────────────────────────
type ArtE = "erledigt" | "offen" | "titel" | "rsb" | "anfrage" | "konto";
const ARTEN: { wert: ArtE; label: string; hinweis: string }[] = [
  { wert: "erledigt", label: "Erledigte Forderung (bezahlt)", hinweis: "Eintrag trägt einen Erledigungsvermerk." },
  { wert: "offen", label: "Offene Forderung", hinweis: "Ohne Erledigung läuft keine Löschfrist." },
  { wert: "titel", label: "Titulierte Forderung", hinweis: "Mahn- oder Vollstreckungsbescheid." },
  { wert: "rsb", label: "Restschuldbefreiung", hinweis: "Seit März 2023 nur noch sechs Monate." },
  { wert: "anfrage", label: "Kreditanfrage", hinweis: "Keine Negativinformation, aber gespeichert." },
  { wert: "konto", label: "Gekündigtes Konto / Karte", hinweis: "Kündigung durch die Bank wegen Vertragsverstoß." },
];
function Loeschfrist() {
  const [art, setArt] = useState<ArtE | "">("");
  const [erledigt, setErledigt] = useState("");
  const [gemeldet, setGemeldet] = useState("");
  const [weitere, setWeitere] = useState<"nein" | "ja" | "">("");
  const heute = useMemo(() => new Date(), []);
  const e = useMemo(() => {
    if (!art) return null;
    const ed = parse(erledigt), m = parse(gemeldet);
    if (art === "offen") return { marke: "Keine Frist", farbe: "#b45309", titel: "Keine Löschfrist – der Eintrag bleibt, bis die Forderung erledigt oder die Meldung unzulässig ist.", regel: "Offene Forderungen werden erst nach Erledigung gelöscht (drei Jahre taggenau nach Erledigung). Zuerst prüfen, ob die Meldung zulässig war: zwei Mahnungen, vier Wochen Abstand, Hinweis auf die Meldung, Forderung nicht bestritten (§ 31 Abs. 2 BDSG).", satz: "Solange die Forderung offen ist, läuft keine Löschfrist. Zwei Wege: Wir prüfen, ob die Meldung überhaupt zulässig war – oder Sie begleichen die Forderung innerhalb von 100 Tagen nach der Meldung, dann gilt die kurze Frist von 18 Monaten.", datum: null as Date | null };
    if (art === "anfrage") {
      if (!ed) return null;
      const d = plusMonate(ed, 12);
      return { marke: "12 Monate", farbe: "#1d4ed8", titel: `Löschung am ${fmt(d)}`, regel: "Kreditanfragen werden zwölf Monate gespeichert und sind nur zehn Tage für andere Vertragspartner sichtbar. Sie wirken nicht wie ein Negativmerkmal; viele Anfragen in kurzer Zeit können den Score aber drücken. Konditionsanfragen sind neutral.", satz: `Ihre Kreditanfrage wird am ${fmt(d)} gelöscht. Sie ist kein Negativmerkmal und für andere nur zehn Tage sichtbar. Verlangen Sie bei Vergleichen künftig ausdrücklich eine Konditionsanfrage – die ist neutral.`, datum: d };
    }
    if (art === "rsb") {
      if (!ed) return null;
      const d = plusMonate(ed, 6);
      const ueber = d < heute;
      return { marke: ueber ? "Frist überschritten" : "6 Monate", farbe: ueber ? "#b91c1c" : "#047857", titel: ueber ? `Der Eintrag hätte am ${fmt(d)} gelöscht sein müssen.` : `Löschung am ${fmt(d)}`, regel: "Seit März 2023 speichern die Auskunfteien die Restschuldbefreiung nur noch sechs Monate – so lange wie das Insolvenzportal. Der EuGH hat das am 7. Dezember 2023 bestätigt (C-26/22, C-64/22).", satz: ueber ? `Ihre Restschuldbefreiung hätte spätestens am ${fmt(d)} gelöscht sein müssen – die Frist beträgt seit 2023 nur noch sechs Monate. FIAON verlangt die Löschung nach Art. 17 DSGVO mit Verweis auf das EuGH-Urteil.` : `Ihre Restschuldbefreiung wird am ${fmt(d)} gelöscht – sechs Monate nach dem Beschluss. Danach prüfen wir die Datenkopie, ob der Eintrag wirklich weg ist.`, datum: d };
    }
    if (!ed) return null;
    let monate = 36; let kurz = false;
    let regel = "Erledigte Forderungen, titulierte Forderungen und bankseitige Kündigungen werden drei Jahre nach dem Erledigungsdatum gelöscht – taggenau, nicht mehr zum Jahresende.";
    if (art === "erledigt" && m && weitere === "nein") {
      const frist = tage(m, ed);
      if (frist >= 0 && frist <= 100 && m >= new Date("2024-01-01")) { monate = 18; kurz = true; regel = `Innerhalb von ${frist} Tagen nach der Meldung beglichen, keine weiteren Negativmerkmale: kurze Frist der Verhaltensregeln 2024 – Löschung 18 Monate nach Erledigung statt nach drei Jahren.`; }
      else if (frist > 100) regel += ` Die 100-Tage-Regel greift nicht: Zwischen Meldung und Begleichung lagen ${frist} Tage.`;
    } else if (art === "erledigt" && m && weitere === "ja") regel += " Die 100-Tage-Regel setzt voraus, dass keine weiteren Negativmerkmale vorliegen – deshalb bleibt es bei drei Jahren.";
    const d = plusMonate(ed, monate); const rest = tage(heute, d);
    const ueber = rest < 0;
    return {
      marke: ueber ? "Frist überschritten" : kurz ? "Kurze Frist" : "Reguläre Frist", farbe: ueber ? "#b91c1c" : kurz ? "#047857" : "#1d4ed8",
      titel: ueber ? `Der Eintrag hätte am ${fmt(d)} gelöscht sein müssen.` : `Löschung am ${fmt(d)} – in ${rest} Tagen`, regel, datum: d,
      satz: ueber ? `Nach den Verhaltensregeln der Auskunfteien hätte Ihr Eintrag am ${fmt(d)} gelöscht sein müssen. Eine überschrittene Frist ist ein klarer Löschgrund – FIAON fordert die Datenkopie an und verlangt die Löschung nach Art. 17 DSGVO.`
        : kurz ? `Weil Sie innerhalb von 100 Tagen nach der Meldung beglichen haben und keine weiteren Einträge vorliegen, gilt die kurze Frist: Ihr Eintrag wird am ${fmt(d)} gelöscht, in ${rest} Tagen. Wir weisen die Auskunftei auf die 100-Tage-Regel hin, damit sie auch so rechnet.`
        : `Ihr Eintrag wird am ${fmt(d)} gelöscht, in ${rest} Tagen – drei Jahre taggenau nach der Erledigung. Bis dahin prüfen wir, ob die Meldung damals überhaupt zulässig war; wenn Voraussetzungen fehlen, ist der Eintrag schon vorher angreifbar.`,
    };
  }, [art, erledigt, gemeldet, weitere, heute]);

  return (
    <div className="to-spalten">
      <section className="to-block">
        <div className="to-frage"><b>Um welchen Eintrag geht es?</b>
          <div className="to-optionen">{ARTEN.map((a) => <Opt key={a.wert} wert={a.wert} an={art} setzen={setArt} b={a.label} s={a.hinweis} />)}</div>
        </div>
        {art && art !== "offen" && (
          <div className="to-frage"><b>{art === "anfrage" ? "Datum der Anfrage" : art === "rsb" ? "Datum der Restschuldbefreiung (Beschluss)" : "Erledigungsdatum laut Datenkopie"}</b>
            <div className="to-felder"><label>Datum<input type="date" className="to-eingabe" value={erledigt} onChange={(ev) => setErledigt(ev.target.value)} max="2099-12-31" /></label></div>
            {art !== "anfrage" && art !== "rsb" && <p className="leise">Das Datum, das der Gläubiger als Erledigung gemeldet hat – es steht in der Datenkopie. Weicht es von der Zahlung ab, lohnt sich eine Berichtigung.</p>}
          </div>
        )}
        {art === "erledigt" && (
          <div className="to-frage"><b>Für die 100-Tage-Regel: Meldedatum und weitere Einträge</b>
            <div className="to-felder"><label>Meldedatum (optional)<input type="date" className="to-eingabe" value={gemeldet} onChange={(ev) => setGemeldet(ev.target.value)} /></label></div>
            <div className="to-optionen zwei">
              <Opt wert="nein" an={weitere} setzen={setWeitere} b="Keine weiteren Negativeinträge" />
              <Opt wert="ja" an={weitere} setzen={setWeitere} b="Es gibt weitere Einträge" />
            </div>
          </div>
        )}
      </section>
      <section className={`to-block${e ? " hervor" : ""}`}>
        {!e ? <p className="leise">Art des Eintrags und Datum eingeben – das Ergebnis erscheint hier.</p> : (
          <div className="to-ergebnis">
            <span className="to-stufe" style={{ background: e.farbe }}>{e.marke}</span>
            <h3>{e.titel}</h3>
            <p>{e.regel}</p>
            <Satz text={e.satz} grundlage="Grundlage: Verhaltensregeln der Wirtschaftsauskunfteien (Fassung 2024), § 31 BDSG, Art. 17 DSGVO, EuGH C-26/22. Ersetzt keine Prüfung der Datenkopie." />
          </div>
        )}
      </section>
    </div>
  );
}

// ── Verjährung ────────────────────────────────────────────────────────────
function Verjaehrung() {
  const [faellig, setFaellig] = useState("");
  const [titel, setTitel] = useState<"nein" | "ja" | "">("");
  const [anerkannt, setAnerkannt] = useState("");
  const [gehemmt, setGehemmt] = useState<"nein" | "ja" | "">("");
  const heute = useMemo(() => new Date(), []);
  const e = useMemo(() => {
    const f = parse(faellig); if (!f || !titel) return null;
    if (titel === "nein" && !gehemmt) return null;
    const a = parse(anerkannt);
    if (titel === "ja") {
      const d = new Date(f); d.setFullYear(d.getFullYear() + 30);
      return { datum: d, verjaehrt: d < heute, hinweis: "", regel: "Titulierte Forderungen (Vollstreckungsbescheid, Urteil, vollstreckbarer Vergleich) verjähren erst nach 30 Jahren (§ 197 Abs. 1 Nr. 3 BGB). Ein Mahnbescheid allein ist kein Titel – er hemmt die Verjährung nur." };
    }
    let start = f; let regel = "Die regelmäßige Verjährung beträgt drei Jahre und beginnt mit dem Ende des Jahres, in dem die Forderung fällig wurde und der Gläubiger davon wusste (§§ 195, 199 BGB).";
    if (a && a > f) { start = a; regel += ` Durch die Anerkennung am ${fmt(a)} (Teilzahlung, Ratenvereinbarung, Stundungsbitte) hat die Verjährung neu begonnen (§ 212 BGB) – gerechnet ab dem Ende dieses Jahres.`; }
    const d = jahresende(start, 3);
    const hinweis = gehemmt === "ja" ? "Ein zugestellter Mahnbescheid, eine Klage oder laufende Verhandlungen hemmen die Verjährung (§§ 203, 204 BGB): Die Zeit der Hemmung wird nicht mitgerechnet, in der Regel bis sechs Monate nach Ende des Verfahrens. Das Datum verschiebt sich entsprechend – prüfen lassen." : "";
    return { datum: d, verjaehrt: d < heute && gehemmt !== "ja", hinweis, regel };
  }, [faellig, titel, anerkannt, gehemmt, heute]);
  const einrede = e ? `Die geltend gemachte Forderung ist nach meiner Prüfung verjährt (Verjährungseintritt am ${fmt(e.datum)}, §§ 195, 199 BGB). Ich erhebe hiermit ausdrücklich die Einrede der Verjährung und werde keine Zahlung leisten. Bitte bestätigen Sie die Einstellung der Beitreibung. Eine Meldung an Auskunfteien ist unzulässig; sollte eine Meldung erfolgt sein, fordere ich die unverzügliche Rücknahme.` : "";
  const satz = e ? (e.verjaehrt
    ? `Nach den Daten, die Sie mir nennen, ist die Forderung seit dem ${fmt(e.datum)} verjährt. Wichtig: Verjährung wirkt nur, wenn Sie sich darauf berufen – also nichts überweisen, keine Raten vereinbaren, nichts „zur Prüfung“ zusagen. FIAON formuliert die Einrede der Verjährung schriftlich für Sie.`
    : `Die Forderung ist noch nicht verjährt – die Verjährung tritt ${e.hinweis ? "frühestens " : ""}am ${fmt(e.datum)} ein. Bis dahin prüfen wir Forderung und Kosten, fordern die Mahnungen an und klären, ob die Meldung zulässig war.`) : "";

  return (
    <div className="to-spalten">
      <section className="to-block">
        <div className="to-frage"><b>Wann wurde die Forderung fällig?</b>
          <p className="leise">Meist das Datum der Rechnung oder der ersten Mahnung. Irgendein Tag des richtigen Jahres genügt – es zählt das Jahresende.</p>
          <div className="to-felder"><label>Fälligkeit<input type="date" className="to-eingabe" value={faellig} onChange={(ev) => setFaellig(ev.target.value)} /></label></div>
        </div>
        <div className="to-frage"><b>Gibt es einen Titel?</b>
          <div className="to-optionen zwei">
            <Opt wert="nein" an={titel} setzen={setTitel} b="Nein" s="Nur Mahnungen und Inkassoschreiben" />
            <Opt wert="ja" an={titel} setzen={setTitel} b="Ja" s="Vollstreckungsbescheid, Urteil, Vergleich – ein Mahnbescheid allein ist kein Titel" />
          </div>
        </div>
        {titel === "nein" && (
          <div className="to-frage"><b>Später anerkannt oder gehemmt?</b>
            <p className="leise">Teilzahlung, Ratenvereinbarung oder Stundungsbitte gilt als Anerkenntnis – die drei Jahre beginnen neu.</p>
            <div className="to-felder"><label>Letzte Anerkennung (optional)<input type="date" className="to-eingabe" value={anerkannt} onChange={(ev) => setAnerkannt(ev.target.value)} /></label></div>
            <div className="to-optionen zwei">
              <Opt wert="nein" an={gehemmt} setzen={setGehemmt} b="Kein Mahnbescheid, keine Klage" />
              <Opt wert="ja" an={gehemmt} setzen={setGehemmt} b="Mahnbescheid oder Klage zugestellt" s="Hemmt die Verjährung." />
            </div>
          </div>
        )}
      </section>
      <section className={`to-block${e ? " hervor" : ""}`}>
        {!e ? <p className="leise">Fälligkeit und Titel angeben – das Ergebnis erscheint hier.</p> : (
          <div className="to-ergebnis">
            <span className="to-stufe" style={{ background: e.verjaehrt ? "#047857" : e.hinweis ? "#b45309" : "#1d4ed8" }}>{e.verjaehrt ? "Voraussichtlich verjährt" : e.hinweis ? "Prüfung nötig" : "Noch nicht verjährt"}</span>
            <h3>{e.verjaehrt ? `Verjährt seit dem ${fmt(e.datum)}.` : `Verjährung ${e.hinweis ? "frühestens " : ""}am ${fmt(e.datum)}.`}</h3>
            <p>{e.regel}</p>
            {e.hinweis && <p className="leise">{e.hinweis}</p>}
            <Satz text={satz} grundlage="Grundlage: §§ 195, 197, 199, 203, 204, 212 BGB. Richtwerte; Hemmungen und Sonderfristen bildet das Werkzeug nicht vollständig ab." />
            {e.verjaehrt && <div className="to-satz"><small>Einrede für das Schreiben des Kunden</small><p>{einrede}</p><div className="fuss"><KopierKnopf text={einrede} /></div></div>}
          </div>
        )}
      </section>
    </div>
  );
}
function KopierKnopf({ text }: { text: string }) {
  const [k, setK] = useState(false);
  return <button type="button" className="to-knopf still klein" onClick={async () => { try { await navigator.clipboard.writeText(text); setK(true); setTimeout(() => setK(false), 1800); } catch { /* egal */ } }}>{k ? <><Check size={13} /> Kopiert</> : <><Copy size={13} strokeWidth={1.75} /> Kopieren</>}</button>;
}

// ── Inkassokosten ─────────────────────────────────────────────────────────
// RVG Anlage 2 (seit 1.1.2021): Gegenstandswert bis … → 1,0-Gebühr
const TABELLE: [number, number][] = [[500, 49], [1000, 88], [1500, 127], [2000, 166], [3000, 222], [4000, 278], [5000, 334], [6000, 390], [7000, 446], [8000, 502], [9000, 558], [10000, 614], [13000, 666], [16000, 718], [19000, 770], [22000, 822], [25000, 874], [30000, 955], [35000, 1036], [40000, 1117], [45000, 1198], [50000, 1279]];
const gebuehr10 = (wert: number) => { for (const [bis, g] of TABELLE) if (wert <= bis) return g; return 1279 + Math.ceil((wert - 50000) / 15000) * 110; };
function Inkasso() {
  const [haupt, setHaupt] = useState("");
  const [kosten, setKosten] = useState("");
  const [auslagen, setAuslagen] = useState("");
  const [sonst, setSonst] = useState("");
  const [lage, setLage] = useState<"erstes" | "weiter" | "">("");
  const e = useMemo(() => {
    const h = zahl(haupt); if (!h || !lage) return null;
    const satz = lage === "erstes" ? 0.5 : 0.9;
    let geb = Math.round(gebuehr10(h) * satz * 100) / 100; let deckel = "";
    if (h <= 50) { const max = Math.round(gebuehr10(h) * 0.5 * 100) / 100; if (geb > max) { geb = max; deckel = "Bei Hauptforderungen bis 50 Euro ist nach § 13e Abs. 1 RDG höchstens eine 0,5-Geschäftsgebühr erstattungsfähig (24,50 Euro)."; } }
    const ausl = Math.min(20, Math.round(geb * 0.2 * 100) / 100);
    const gef = zahl(kosten) + zahl(auslagen) + zahl(sonst);
    const zul = geb + ausl; const diff = Math.round((gef - zul) * 100) / 100;
    return { h, satz, geb, ausl, zul, gef, diff, deckel, sonst: zahl(sonst) };
  }, [haupt, kosten, auslagen, sonst, lage]);
  const schreiben = e ? `Die Hauptforderung in Höhe von ${euro(e.h)} sowie Inkassokosten in gesetzlich zulässiger Höhe (${e.satz.toFixed(1).replace(".", ",")}-Geschäftsgebühr nach RVG: ${euro(e.geb)}, zuzüglich Auslagenpauschale ${euro(e.ausl)}) werde ich begleichen. Die darüber hinaus geforderten Kosten in Höhe von ${euro(Math.max(0, e.diff))} weise ich zurück; sie übersteigen die nach § 13e RDG in Verbindung mit dem RVG erstattungsfähige Vergütung.${e.sonst ? " Posten wie „Kontoführung“ oder „Adressermittlung“ sind ohne Nachweis nicht erstattungsfähig." : ""} Bitte legen Sie die Berechnung der Gebühren im Einzelnen dar oder bestätigen Sie die Erledigung mit Zahlung des genannten Betrags.` : "";
  const satz = e ? (e.diff > 5
    ? `Zulässig sind bei einer Hauptforderung von ${euro(e.h)} rund ${euro(e.zul)} Inkassokosten – gefordert werden ${euro(e.gef)}. Die Differenz von ${euro(e.diff)} weisen wir zurück; seit 2021 gelten gesetzliche Obergrenzen nach RVG und § 13e RDG. FIAON formuliert die Zurückweisung für Sie.`
    : `Die geforderten Kosten von ${euro(e.gef)} liegen im zulässigen Rahmen von rund ${euro(e.zul)}. Vor der Zahlung prüfen wir, ob die Forderung selbst besteht und nicht verjährt ist – und nach der Zahlung fordern wir die Erledigungsmeldung an die Auskunfteien ein.`) : "";

  return (
    <div className="to-spalten">
      <section className="to-block">
        <div className="to-frage"><b>Was steht im Inkassoschreiben?</b>
          <div className="to-felder">
            <label>Hauptforderung<input inputMode="decimal" className="to-eingabe" placeholder="z. B. 89,00" value={haupt} onChange={(ev) => setHaupt(ev.target.value)} /></label>
            <label>Geforderte Inkassogebühr<input inputMode="decimal" className="to-eingabe" placeholder="z. B. 70,20" value={kosten} onChange={(ev) => setKosten(ev.target.value)} /></label>
            <label>Auslagen / Pauschalen<input inputMode="decimal" className="to-eingabe" placeholder="z. B. 20,00" value={auslagen} onChange={(ev) => setAuslagen(ev.target.value)} /></label>
            <label>Sonstige Posten<input inputMode="decimal" className="to-eingabe" placeholder="Kontoführung, Adressermittlung …" value={sonst} onChange={(ev) => setSonst(ev.target.value)} /></label>
          </div>
          <p className="leise">Verzugszinsen nicht eintragen – sie sind gesondert geschuldet (fünf Prozentpunkte über dem Basiszins).</p>
        </div>
        <div className="to-frage"><b>In welcher Lage ist der Kunde?</b>
          <div className="to-optionen zwei">
            <Opt wert="erstes" an={lage} setzen={setLage} b="Erstes Schreiben, Forderung unstreitig" s="Zahlt jetzt – in der Regel 0,5-Gebühr." />
            <Opt wert="weiter" an={lage} setzen={setLage} b="Mehrere Schreiben oder Ratenvereinbarung" s="Regelgebühr 0,9. Höher (bis 1,3) nur bei umfangreicher Sache." />
          </div>
        </div>
      </section>
      <section className={`to-block${e ? " hervor" : ""}`}>
        {!e ? <p className="leise">Hauptforderung und Lage angeben – das Ergebnis erscheint hier.</p> : (
          <div className="to-ergebnis">
            <span className="to-stufe" style={{ background: e.diff > 5 ? "#b91c1c" : "#047857" }}>{e.diff > 5 ? `Um ${euro(e.diff)} überhöht` : "Im Rahmen"}</span>
            <h3>{e.diff > 5 ? `Zulässig sind rund ${euro(e.zul)} – gefordert werden ${euro(e.gef)}.` : `${euro(e.gef)} liegen im zulässigen Rahmen (rund ${euro(e.zul)}).`}</h3>
            <table className="to-tabelle"><tbody>
              <tr><td>Geschäftsgebühr {e.satz.toFixed(1).replace(".", ",")} (Gegenstandswert {euro(e.h)})</td><td>{euro(e.geb)}</td></tr>
              <tr><td>Auslagenpauschale (20 %, höchstens 20 €)</td><td>{euro(e.ausl)}</td></tr>
              <tr><td>Sonstige Posten ohne Nachweis</td><td>0,00 €</td></tr>
              <tr className="summe"><td>Zulässige Inkassokosten (ohne Zinsen)</td><td>{euro(e.zul)}</td></tr>
            </tbody></table>
            {e.deckel && <p className="leise">{e.deckel}</p>}
            <Satz text={satz} grundlage="Grundlage: § 13e RDG, RVG mit Anlage 2 (Stand 2021). Richtwerte; im Einzelfall kann eine höhere Gebühr gerechtfertigt sein." />
            {e.diff > 5 && <div className="to-satz"><small>Zurückweisung für das Schreiben des Kunden</small><p>{schreiben}</p><div className="fuss"><KopierKnopf text={schreiben} /></div></div>}
          </div>
        )}
      </section>
    </div>
  );
}
