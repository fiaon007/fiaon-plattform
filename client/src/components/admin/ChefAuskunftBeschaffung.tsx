// ═══════════════════════════════════════════════════════════════════════════
// /chef/s/auskunft-beschaffung — DER ARBEITSPLATZ DER BESCHAFFUNG (25.09.2026, E-241)
//
// Justin: „Ich kümmere mich heute um die API, bis dahin kaufen wir sie selbst."
// Jede bezahlte Bonitätsauskunft wird hier ein Auftrag. Die Karte zeigt alles,
// was man zum Bestellen braucht — Name, Geburtsdatum, Anschrift samt
// Voranschrift, Land, Auskunfteien mit Anschrift, bezahlt am, fällig ab und ob
// eine Einwilligung dokumentiert ist —, jedes Feld mit Kopierknopf. Wer die
// Auskunft beschafft hat, lädt das PDF hoch: Die Akte bekommt sie als
// Auskunft-Dokument, die Analyse startet, der Kunde bekommt „Ihre Auskunft ist
// da". Fehlt die Einwilligung, schickt „Auftragsbestätigung senden" den Link
// zur Bestätigung des Beschaffungsauftrags (25.09.2026, E-241 — vorher der
// Link zur Vollmacht auf /app/unterschrift: Die deckt nur die kostenlose
// Datenkopie, nicht den Kauf). Der Rückstand (bezahlt, nie geliefert) steht von
// selbst hier — ohne Mail an die Kunden.
//
// Server: server/routes/fiaon-chef-auskunft-beschaffung.ts · Regeln:
// server/lib/fiaon-auskunft-lieferung.ts (Abschnitt 5) · API: fiaon-auskunft-quelle.ts
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { API, seit, zahl, eur, Geruest, Fehlermeldung, useDaten } from "./chef-teile";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "@/pages/agent/rundgaenge";
import "@/styles/office-rundgang.css";
import "@/styles/chef-auskunft-beschaffung.css";

type Modus = "einkauf" | "vollmacht" | "api";
type Status = "offen" | "in_arbeit" | "hochgeladen" | "fertig" | "problem";
interface Stelle { key: string; kurz: string; name: string; anschrift: string | null; geliefert: boolean }
interface Auftrag {
  id: number; ref: string; personId: number; land: "DE" | "AT" | "CH"; art: "privat" | "firma"; status: Status;
  faelligAb: string; faellig: boolean; quelle: string; modus: string;
  bearbeiter: string | null; uebernommenAm: string | null; notiz: string | null;
  geliefert: string[]; letzteLieferung: string[]; hochgeladenAm: string | null; hochgeladenVon: string | null;
  mailStatus: string | null; mailAm: string | null; vollmachtLinkAm: string | null; vollmachtLinkAnzahl: number;
  apiVersuchAm: string | null; apiFehler: string | null; fertigAm: string | null; angelegtAm: string;
  bestellung: { betragCents: number | null; bezahltAm: string | null; bestelltAm: string | null; verwendungszweck: string | null; paket: string | null; zahlStatus: string | null; bezahlt: boolean };
  kunde: {
    name: string; vorname: string; nachname: string; geburtsdatum: string | null; strasse: string | null; plz: string | null; ort: string | null;
    voranschrift: { strasse: string | null; plz: string | null; ort: string | null; land: string | null } | null;
    email: string | null; telefon: string | null; firma: { name: string | null; rechtsform: string | null } | null;
  };
  stellen: Stelle[];
  einwilligung: { ja: boolean; quelle: string | null; text: string };
  dokumentDa: boolean; vorgaengeLaufend: number; anschriftFehlt: boolean; betreuer: string | null;
}
interface Stand {
  stand: string; modus: Modus; apiAngebunden: boolean; unterschriftAn: boolean; pdfMaxMb: number; rueckstandNeu: number;
  zahlen: { jetzt: number; einwilligungFehlt: number; wartet: number; mailFehlt: number; problem: number; offen: number; fertig30: number };
  auftraege: Auftrag[];
}

type Reiter = "jetzt" | "vollmacht" | "wartet" | "problem" | "fertig" | "alle";
const REITER: { key: Reiter; text: string }[] = [
  { key: "jetzt", text: "Jetzt beschaffen" },
  { key: "vollmacht", text: "Auftrag fehlt" },
  { key: "wartet", text: "Wartet auf Frist" },
  { key: "problem", text: "Problem" },
  { key: "fertig", text: "Fertig" },
  { key: "alle", text: "Alle" },
];
const LAND: Record<string, string> = { DE: "Deutschland", AT: "Österreich", CH: "Schweiz" };
const STATUS_TEXT: Record<Status, string> = { offen: "offen", in_arbeit: "in Arbeit", hochgeladen: "Mail fehlt", fertig: "fertig", problem: "Problem" };
const MODUS_TEXT: Record<Modus, { name: string; satz: string }> = {
  einkauf: { name: "Einkauf", satz: "Nach der Zahlung entsteht hier ein Auftrag; ihr beschafft die Auskunft und ladet sie hoch." },
  vollmacht: { name: "Vollmacht", satz: "Der Weg vom 24.09.: je Auskunftei eine Anfrage, der Kunde unterschreibt, Versand per Post, Eingang im Vorgang." },
  api: { name: "API", satz: "Wie Einkauf, dazu der Abruf über die Schnittstelle. Ohne Anbindung oder bei einem Fehler bleibt der Auftrag im Einkauf." },
};

/** „2026-10-09" → „09.10.2026" */
const tagText = (iso: string | null | undefined) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "—");
const datumText = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" }) : "—");
const zeitText = (s: string | null | undefined) => (s ? new Date(s).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }) : "—");

function reiterVon(a: Auftrag): Exclude<Reiter, "alle"> {
  if (a.status === "fertig") return "fertig";
  if (a.status === "problem") return "problem";
  // Gegenlesen 25.09.2026 (E-241): nicht mehr bezahlt (erstattet, storniert) ist ein Problem, kein Einkauf.
  if (a.bestellung.bezahlt === false) return "problem";
  if (a.status === "hochgeladen") return "jetzt";
  if (!a.einwilligung.ja) return "vollmacht";
  if (!a.faellig) return "wartet";
  return "jetzt";
}

async function senden(pfad: string, body?: unknown): Promise<any> {
  const r = await fetch(`${API}${pfad}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok) throw new Error(j?.error || "Das hat nicht geklappt.");
  return j;
}

function anschrift(t: { strasse: string | null; plz: string | null; ort: string | null; land?: string | null } | null): string | null {
  if (!t) return null;
  const z = [t.strasse, [t.plz, t.ort].filter(Boolean).join(" "), t.land].filter((x) => String(x ?? "").trim());
  return z.length ? z.join(", ") : null;
}

export default function ChefAuskunftBeschaffung() {
  const stand = useDaten<Stand>("/chef/auskunft-beschaffung");
  const s = stand.daten;
  const [reiter, setReiter] = useState<Reiter>("jetzt");
  const [suche, setSuche] = useState("");
  const [beschaeftigt, setBeschaeftigt] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);

  const melden = (t: string) => { setMeldung(t); window.setTimeout(() => setMeldung(null), 8000); };
  const ausfuehren = async (schluessel: string, tat: () => Promise<string | void>) => {
    setBeschaeftigt(schluessel);
    try { const t = await tat(); if (t) melden(t); stand.neu(); } catch (err: any) { melden(err?.message || "Das hat nicht geklappt."); } finally { setBeschaeftigt(null); }
  };

  const zaehler = useMemo(() => {
    const z: Record<Reiter, number> = { jetzt: 0, vollmacht: 0, wartet: 0, problem: 0, fertig: 0, alle: 0 };
    for (const a of s?.auftraege ?? []) { z[reiterVon(a)]++; z.alle++; }
    return z;
  }, [s]);
  const liste = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return (s?.auftraege ?? [])
      .filter((a) => reiter === "alle" || reiterVon(a) === reiter)
      .filter((a) => !q || `${a.kunde.name} ${a.ref} ${a.kunde.email ?? ""} ${a.bestellung.verwendungszweck ?? ""}`.toLowerCase().includes(q));
  }, [s, reiter, suche]);

  const modusSetzen = (m: Modus) => {
    if (!s || m === s.modus) return;
    const warnung = m === "vollmacht"
      ? "Ab der nächsten Zahlung entstehen wieder Anfragen je Auskunftei (Unterschrift, Versand per Post) statt eines Beschaffungsauftrags. Bestehende Aufträge hier bleiben."
      : m === "api"
        ? `Ab der nächsten Zahlung wird mit bestätigtem Beschaffungsauftrag gleich über die API abgerufen.${s.apiAngebunden ? "" : " Die API ist noch NICHT angebunden — bis dahin bleibt jeder Auftrag im Einkauf von Hand."}`
        : "Ab der nächsten Zahlung entsteht hier ein Auftrag, und ihr beschafft die Auskunft selbst.";
    if (!window.confirm(`Lieferweg auf „${MODUS_TEXT[m].name}“ stellen?\n\n${warnung}`)) return;
    void ausfuehren("modus", async () => { await senden("/chef/auskunft-beschaffung/modus", { modus: m }); return `Lieferweg: ${MODUS_TEXT[m].name}.`; });
  };

  return (
    <div className="akb">
      {/* Gegenlesen 25.09.2026: raum nur Kleinbuchstaben und Bindestrich — der Server merkt ihn kleingeschrieben (fiaon-office-einfuehrung.ts). */}
      <Rundgang raum="auskunft-beschaffung" titel="Auskunft-Beschaffung" schritte={RUNDGAENGE.auskunftBeschaffung.schritte} />
      {stand.laedt && !s && <Geruest zeilen={8} />}
      {stand.fehler && <Fehlermeldung text={stand.fehler} erneut={stand.neu} />}
      {s && (
        <>
          <header className="akb-kopf">
            <div>
              <h1>Auskunft-Beschaffung</h1>
              <p>Bezahlte Bonitätsauskünfte beschaffen und hochladen — die Akte, die Analyse und die Mail an den Kunden folgen von selbst. Stand {seit(s.stand)}.</p>
            </div>
            <div className="akb-modus" role="group" aria-label="Lieferweg">
              {(["einkauf", "vollmacht", "api"] as Modus[]).map((m) => (
                <button key={m} type="button" className={s.modus === m ? "an" : ""} aria-pressed={s.modus === m}
                  disabled={beschaeftigt === "modus"} onClick={() => modusSetzen(m)} title={MODUS_TEXT[m].satz}>
                  {MODUS_TEXT[m].name}
                </button>
              ))}
            </div>
          </header>

          <section className="akb-lage" aria-label="Lage">
            <p className="akb-leise"><b>Lieferweg {MODUS_TEXT[s.modus].name}:</b> {MODUS_TEXT[s.modus].satz}</p>
            <div className="akb-marken">
              <span className={`akb-marke ${s.apiAngebunden ? "gruen" : "gelb"}`}>{s.apiAngebunden ? "API angebunden" : "API noch nicht angebunden"}</span>
              {/* E-241: Die Unterschrift in der App zählt nur noch im Vollmacht-Weg — die Auftragsbestätigung hängt nicht daran. */}
              {s.modus === "vollmacht" && (
                <span className={`akb-marke ${s.unterschriftAn ? "gruen" : "rot"}`}>{s.unterschriftAn ? "Unterschrift in der App an" : "Unterschrift in der App aus — keine Vollmacht-Links"}</span>
              )}
              {s.modus === "api" && (
                <button type="button" className="akb-knopf" disabled={beschaeftigt === "api"}
                  onClick={() => void ausfuehren("api", async () => {
                    const j = await senden("/chef/auskunft-beschaffung/api-abrufen");
                    return j.versucht ? `${j.geliefert} von ${j.versucht} über die API geliefert. ${(j.texte ?? []).slice(0, 2).join(" · ")}` : "Heute ist nichts mit bestätigtem Auftrag fällig.";
                  })}>
                  {beschaeftigt === "api" ? "Ruft ab …" : "Fällige über die API abrufen"}
                </button>
              )}
            </div>
            {s.rueckstandNeu > 0 && (
              <p className="akb-hinweis">{zahl(s.rueckstandNeu)} bezahlte Auskünfte aus dem Rückstand sind eben als Aufträge dazugekommen — die Kunden haben dafür keine Mail bekommen.</p>
            )}
          </section>

          <section className="akb-zahlen" aria-label="Zahlen">
            <button type="button" className="akb-zahl" onClick={() => setReiter("jetzt")}><span>Jetzt beschaffen</span><b className="blau">{zahl(s.zahlen.jetzt)}</b><small>Einwilligung da, fällig</small></button>
            <button type="button" className="akb-zahl" onClick={() => setReiter("vollmacht")}><span>Auftrag fehlt</span><b className="gelb">{zahl(s.zahlen.einwilligungFehlt)}</b><small>erst bestätigen lassen, dann kaufen</small></button>
            <button type="button" className="akb-zahl" onClick={() => setReiter("wartet")}><span>Wartet</span><b>{zahl(s.zahlen.wartet)}</b><small>Widerrufsfrist läuft</small></button>
            <button type="button" className="akb-zahl" onClick={() => setReiter("jetzt")}><span>Mail fehlt</span><b className={s.zahlen.mailFehlt ? "rot" : ""}>{zahl(s.zahlen.mailFehlt)}</b><small>hochgeladen, Kunde weiß es nicht</small></button>
            <button type="button" className="akb-zahl" onClick={() => setReiter("problem")}><span>Problem</span><b className={s.zahlen.problem ? "rot" : ""}>{zahl(s.zahlen.problem)}</b><small>mit Notiz</small></button>
            <button type="button" className="akb-zahl" onClick={() => setReiter("fertig")}><span>Fertig</span><b className="gruen">{zahl(s.zahlen.fertig30)}</b><small>letzte 30 Tage</small></button>
          </section>

          <details className="akb-regeln">
            <summary>Die Regeln der Beschaffung</summary>
            <ul>
              <li><b>Kaufen nur mit Beschaffungsauftrag.</b> Er liegt vor, wenn der Kunde an der Kauftür (Bestellseite, Kauflink, Kaufkarte) den Auftrag angehakt oder ihn über den Link aus der Mail bestätigt hat. Nur er deckt den Kauf einer kostenpflichtigen Auskunft in seinem Namen.</li>
              <li><b>Vollmacht zur Übermittlung</b> (älterer Haken der Bestellseite, unterschriebene Vollmacht mit „Selbstauskunft“): deckt nur die kostenlose Datenkopie — seine Anfrage übermitteln und die Antwort entgegennehmen, keinen Kauf. Für einen Kauf erst „Auftragsbestätigung senden“.</li>
              <li><b>Fehlt die Einwilligung</b> (Betreuer, Mara, Altbestellung), schickt „Auftragsbestätigung senden“ den Link: Der Kunde sieht Bestellung und Leistung und bestätigt mit einem Haken. Danach springt der Auftrag von selbst auf „Jetzt beschaffen“.</li>
              <li><b>Fällig ab:</b> Hat der Kunde den Beginn vor Ablauf der Widerrufsfrist nicht verlangt, erst ab dem Tag nach dem Fristende. Vorher nicht anfordern.</li>
              <li><b>Hochladen:</b> nur PDF, bis {s.pdfMaxMb} MB je Datei, mehrere Dateien werden zu einer gebunden. Kommt eine Auskunftei später, einfach nachladen — sie wird angehängt. Sind alle schon gelieferten mit angehakt, ersetzt die neue Datei die alte (ohne zweite Mail).</li>
              <li>Gegenüber dem Kunden: nie etwas zusagen, was die Auskunftei oder die Bank entscheidet. Die kostenlose Datenkopie steht ihm immer zu — wer fragt, bekommt die ehrliche Antwort.</li>
            </ul>
          </details>

          <nav className="akb-reiter" aria-label="Ansicht">
            {REITER.map((r) => (
              <button key={r.key} type="button" className={reiter === r.key ? "an" : ""} aria-pressed={reiter === r.key} onClick={() => setReiter(r.key)}>
                {r.text}<i>{zahl(zaehler[r.key])}</i>
              </button>
            ))}
            <input type="search" className="akb-suche" placeholder="Name, Bestellung, E-Mail" value={suche} onChange={(e) => setSuche(e.target.value)} aria-label="Suchen" />
          </nav>

          <section className="akb-liste" aria-label="Aufträge">
            {liste.length === 0 ? (
              <p className="akb-leer">{reiter === "jetzt" ? "Gerade ist nichts zu beschaffen." : "Hier steht gerade nichts."}</p>
            ) : liste.map((a) => (
              <AuftragKarte key={a.id} a={a} beschaeftigt={beschaeftigt} ausfuehren={ausfuehren} melden={melden} pdfMaxMb={s.pdfMaxMb} />
            ))}
          </section>
        </>
      )}
      {/* Portal an <body>: Die Chefbüro-Hülle animiert mit transform — ein fester Platz darin säße sonst mitten auf der Seite. */}
      {meldung && createPortal(<div className="akb-meldung" role="status">{meldung}</div>, document.body)}
    </div>
  );
}

function Feld({ label, wert, melden }: { label: string; wert: string | null; melden: (t: string) => void }) {
  const kopieren = async () => {
    if (!wert) return;
    try { await navigator.clipboard.writeText(wert); melden(`${label} kopiert.`); } catch { melden("Kopieren ging nicht — bitte markieren und kopieren."); }
  };
  return (
    <div className={`akb-feld${wert ? "" : " leer"}`}>
      <dt>{label}</dt>
      <dd>
        <span>{wert ?? "fehlt"}</span>
        {wert && <button type="button" className="akb-kopie" onClick={() => void kopieren()} aria-label={`${label} kopieren`}>kopieren</button>}
      </dd>
    </div>
  );
}

function AuftragKarte({ a, beschaeftigt, ausfuehren, melden, pdfMaxMb }: {
  a: Auftrag; beschaeftigt: string | null; pdfMaxMb: number;
  ausfuehren: (schluessel: string, tat: () => Promise<string | void>) => Promise<void>;
  melden: (t: string) => void;
}) {
  const offenStellen = a.stellen.filter((st) => !st.geliefert);
  const [auswahl, setAuswahl] = useState<string[]>(offenStellen.map((st) => st.key));
  // Gegenlesen 25.09.2026 (E-241): Nach einer Lieferung steht die Auswahl wieder auf dem, was noch
  // fehlt — eine stehengebliebene Auswahl mit schon Geliefertem ersetzte sonst die frühere Datei.
  const geliefertSchluessel = a.geliefert.join(",");
  useEffect(() => { setAuswahl(a.stellen.filter((st) => !st.geliefert).map((st) => st.key)); }, [geliefertSchluessel]); // eslint-disable-line react-hooks/exhaustive-deps
  const [dateien, setDateien] = useState<File[]>([]);
  const [upload, setUpload] = useState(false);
  const fertig = a.status === "fertig";
  const k = a.kunde;
  const zumBestellen = [
    ["Name", k.name], ["Geburtsdatum", k.geburtsdatum], ["Anschrift", anschrift(k)],
    ...(k.voranschrift ? [["Voranschrift", anschrift(k.voranschrift)]] : []),
    ["E-Mail", k.email], ["Telefon", k.telefon],
    ...(k.firma ? [["Firma", k.firma.name], ["Rechtsform", k.firma.rechtsform]] : []),
  ] as [string, string | null][];
  const block = zumBestellen.filter(([, w]) => w).map(([l, w]) => `${l}: ${w}`).concat(`Land: ${LAND[a.land]}`).join("\n");
  const aktion = (was: string, frage?: string) => {
    let notiz = "";
    if (frage) {
      const eingabe = window.prompt(frage);
      if (eingabe === null) return;
      notiz = eingabe;
    }
    void ausfuehren(`${was}:${a.id}`, async () => (await senden(`/chef/auskunft-beschaffung/${a.id}/aktion`, { aktion: was, notiz })).text);
  };
  const linkSenden = () => {
    const nochmal = !!a.vollmachtLinkAm;
    if (!window.confirm(nochmal
      ? `Den Link zur Auftragsbestätigung noch einmal an ${k.name} schicken?\n\nZuletzt am ${zeitText(a.vollmachtLinkAm)} (${a.vollmachtLinkAnzahl}× gesendet).`
      : `Den Link zur Auftragsbestätigung an ${k.name} schicken?\n\nDer Kunde bekommt eine Mail: Wir beschaffen seine Auskunft, dafür fehlt nur seine kurze Bestätigung des Auftrags (ein Klick, ein Haken).`)) return;
    void ausfuehren(`link:${a.id}`, async () => (await senden(`/chef/auskunft-beschaffung/${a.id}/auftrag-link`, { nochmal })).text);
  };
  // E-241: Der Knopf steht, solange kein Beschaffungsauftrag vermerkt ist — auch bei einer Vollmacht
  // zur Übermittlung (die deckt nur die kostenlose Datenkopie, keinen Kauf).
  const auftragDa = a.einwilligung.quelle === "auftrag";
  const hochladen = () => {
    if (!dateien.length) { melden("Bitte zuerst die PDF-Datei wählen."); return; }
    if (!auswahl.length) { melden("Bitte angeben, von welcher Auskunftei die Datei stammt."); return; }
    const zu = dateien.find((d) => d.size > pdfMaxMb * 1024 * 1024);
    if (zu) { melden(`„${zu.name}“ ist größer als ${pdfMaxMb} MB.`); return; }
    const namen = a.stellen.filter((st) => auswahl.includes(st.key)).map((st) => st.kurz).join(", ");
    if (!window.confirm(`${namen} für ${k.name} hochladen?\n\nDie Auskunft kommt in die Akte, die Analyse startet, und der Kunde bekommt die Mail „Ihre Auskunft ist da“.`)) return;
    void ausfuehren(`hoch:${a.id}`, async () => {
      const fd = new FormData();
      for (const d of dateien) fd.append("datei", d, d.name);
      fd.append("auskunfteien", auswahl.join(","));
      const r = await fetch(`${API}/chef/auskunft-beschaffung/${a.id}/hochladen`, { method: "POST", credentials: "include", body: fd });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Das Hochladen ist gescheitert.");
      setDateien([]); setUpload(false);
      return `${j.text}${j.hinweis ? ` ${j.hinweis}` : ""}`;
    });
  };
  const bereitZumKaufen = a.einwilligung.ja && a.faellig && a.bestellung.bezahlt !== false;

  return (
    <article className={`akb-karte st-${a.status}`}>
      <div className="akb-karte-kopf">
        <div className="akb-wer">
          <a href={`/chef/s/akte?id=${a.personId}`}>{k.name}</a>
          <span className="akb-marke">{LAND[a.land]}</span>
          {a.art === "firma" && <span className="akb-marke blau">Firma</span>}
          {a.quelle === "rueckstand" && <span className="akb-marke gelb">Rückstand</span>}
          <span className={`akb-marke st st-${a.status}`}>{STATUS_TEXT[a.status]}</span>
        </div>
        <span className="akb-still">
          bezahlt {datumText(a.bestellung.bezahltAm ?? a.angelegtAm)}{a.bestellung.betragCents != null ? ` · ${eur(a.bestellung.betragCents)}` : ""} · {a.ref}{a.betreuer ? ` · Betreuer ${a.betreuer}` : ""}
        </span>
      </div>

      <div className="akb-ampel">
        <div className={`akb-schritt ${a.einwilligung.ja ? "gut" : "halt"}`}>
          <span>Einwilligung</span>
          <b>{auftragDa ? "Auftrag liegt vor" : a.einwilligung.ja ? "nur Datenkopie" : "fehlt"}</b>
          <small>{a.einwilligung.ja ? a.einwilligung.text : a.vollmachtLinkAm ? `Link gesendet ${zeitText(a.vollmachtLinkAm)}${a.vollmachtLinkAnzahl > 1 ? ` (${a.vollmachtLinkAnzahl}×)` : ""} — wartet auf Bestätigung` : "noch kein Link gesendet"}</small>
          {!auftragDa && !fertig && (
            <button type="button" className={`akb-knopf${a.einwilligung.ja ? "" : " voll"}`} disabled={beschaeftigt === `link:${a.id}`} onClick={linkSenden}>
              {beschaeftigt === `link:${a.id}` ? "Sendet …" : a.vollmachtLinkAm ? "Link erneut senden" : "Auftragsbestätigung senden"}
            </button>
          )}
        </div>
        <div className={`akb-schritt ${a.faellig ? "gut" : "warte"}`}>
          <span>Fällig ab</span>
          <b>{a.faellig ? "heute" : tagText(a.faelligAb)}</b>
          <small>{a.faellig ? (a.einwilligung.ja ? "darf beschafft werden" : "sobald der Auftrag bestätigt ist") :"Beginn vor Ablauf der Widerrufsfrist nicht verlangt — vorher nicht anfordern"}</small>
        </div>
        <div className={`akb-schritt ${a.bearbeiter ? "gut" : ""}`}>
          <span>Wer beschafft</span>
          <b>{a.bearbeiter ?? "noch niemand"}</b>
          <small>{a.uebernommenAm ? `seit ${zeitText(a.uebernommenAm)}` : "übernehmen, damit niemand doppelt kauft"}</small>
          {!a.bearbeiter && !fertig && (
            <button type="button" className="akb-knopf" disabled={beschaeftigt === `uebernehmen:${a.id}`} onClick={() => aktion("uebernehmen")}>Übernehmen</button>
          )}
        </div>
      </div>

      {(a.anschriftFehlt || a.dokumentDa || a.vorgaengeLaufend > 0 || a.apiFehler || a.bestellung.bezahlt === false) && !fertig && (
        <div className="akb-warnungen">
          {a.bestellung.bezahlt === false && <p className="rot">Die Bestellung steht nicht mehr auf bezahlt ({a.bestellung.zahlStatus ?? "unbekannt"}) — nicht beschaffen. Erst klären (Widerruf, Erstattung?), dann „Abschließen“ mit Grund.</p>}
          {a.anschriftFehlt && <p className="rot">In der Akte fehlt die Anschrift — erst erfragen. Ohne sie ordnet keine Auskunftei zu.</p>}
          {a.dokumentDa && <p className="gelb">In der Akte liegt schon eine Auskunft (auf anderem Weg hochgeladen). Prüfen, dann „Abschließen“ — oder die gekaufte hier hochladen.</p>}
          {a.vorgaengeLaufend > 0 && <p className="gelb">{a.vorgaengeLaufend} Anfrage{a.vorgaengeLaufend === 1 ? "" : "n"} aus dem Vollmacht-Weg laufen noch (Vorgänge) — nicht doppelt beschaffen.</p>}
          {a.apiFehler && <p className="gelb">API: {a.apiFehler}{a.apiVersuchAm ? ` (${zeitText(a.apiVersuchAm)})` : ""}</p>}
        </div>
      )}

      <div className="akb-raster">
        <section aria-label="Zum Bestellen">
          <div className="akb-block-kopf">
            <h3>Zum Bestellen</h3>
            <button type="button" className="akb-kopie" onClick={() => void navigator.clipboard.writeText(block).then(() => melden("Alle Angaben kopiert.")).catch(() => melden("Kopieren ging nicht."))}>alles kopieren</button>
          </div>
          <dl className="akb-felder">
            {zumBestellen.map(([l, w]) => <Feld key={l} label={l} wert={w} melden={melden} />)}
          </dl>
        </section>
        <section aria-label="Auskunfteien">
          <div className="akb-block-kopf"><h3>Bei wem</h3><span className="akb-still">{LAND[a.land]}</span></div>
          <ul className="akb-stellen">
            {a.stellen.map((st) => (
              <li key={st.key} className={st.geliefert ? "da" : ""}>
                <b>{st.kurz}{st.geliefert ? " · geliefert" : ""}</b>
                <span>{st.name}{st.anschrift ? ` · ${st.anschrift}` : ""}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {a.notiz && <pre className="akb-notiz">{a.notiz}</pre>}

      {!fertig && (
        <div className="akb-hochladen">
          {!upload ? (
            <button type="button" className={`akb-knopf${bereitZumKaufen ? " voll" : ""}`} onClick={() => setUpload(true)}>PDF hochladen</button>
          ) : (
            <div className="akb-upload">
              {!bereitZumKaufen && (
                <p className="akb-hinweis warn">
                  {a.bestellung.bezahlt === false ? "Nicht mehr bezahlt — nicht beschaffen." : !a.einwilligung.ja ? "Ohne Einwilligung nicht selbst beschaffen." : `Vor dem ${tagText(a.faelligAb)} nicht anfordern.`} Hochladen nur, was der Kunde selbst geschickt hat.
                </p>
              )}
              <label className="akb-datei">
                <input type="file" accept="application/pdf,.pdf" multiple onChange={(e) => setDateien(Array.from(e.target.files ?? []))} />
                <span>{dateien.length ? dateien.map((d) => d.name).join(", ") : `PDF wählen (bis ${pdfMaxMb} MB, mehrere möglich)`}</span>
              </label>
              <fieldset className="akb-wahl">
                <legend>In der Datei steckt die Auskunft von</legend>
                {/* Gegenlesen 25.09.2026: auch schon Geliefertes wählbar — sind ALLE früheren angehakt,
                    ersetzt die neue Datei die alte (Ausweg bei einer geschützten früheren Datei). */}
                {a.stellen.map((st) => (
                  <label key={st.key}>
                    <input type="checkbox" checked={auswahl.includes(st.key)}
                      onChange={(e) => setAuswahl(e.target.checked ? [...auswahl, st.key] : auswahl.filter((x) => x !== st.key))} />
                    {st.kurz}{st.geliefert ? " (schon geliefert)" : ""}
                  </label>
                ))}
              </fieldset>
              <div className="akb-zeile">
                <button type="button" className="akb-knopf voll" disabled={beschaeftigt === `hoch:${a.id}`} onClick={hochladen}>
                  {beschaeftigt === `hoch:${a.id}` ? "Lädt hoch …" : "Hochladen und Kunde benachrichtigen"}
                </button>
                <button type="button" className="akb-klein" onClick={() => { setUpload(false); setDateien([]); }}>abbrechen</button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="akb-fuss">
        <span className="akb-still">
          {a.status === "fertig" ? `fertig ${zeitText(a.fertigAm)}` : `angelegt ${seit(a.angelegtAm)}`}
          {a.hochgeladenAm ? ` · hochgeladen ${zeitText(a.hochgeladenAm)}${a.hochgeladenVon ? ` von ${a.hochgeladenVon}` : ""}` : ""}
          {a.mailStatus === "gesendet" ? ` · Mail an den Kunden ${zeitText(a.mailAm)}` : ""}
        </span>
        <div className="akb-taten">
          {a.status === "hochgeladen" && (
            <button type="button" className="akb-knopf voll" disabled={beschaeftigt === `mail:${a.id}`}
              onClick={() => void ausfuehren(`mail:${a.id}`, async () => (await senden(`/chef/auskunft-beschaffung/${a.id}/mail`)).text)}>
              Mail erneut senden
            </button>
          )}
          <button type="button" className="akb-klein" onClick={() => aktion("notiz", "Notiz zu diesem Auftrag:")}>Notiz</button>
          {!fertig && a.status !== "problem" && <button type="button" className="akb-klein" onClick={() => aktion("problem", "Was ist das Problem? (z. B. Auskunftei verlangt Ausweiskopie)")}>Problem</button>}
          {(a.status === "problem" || fertig) && <button type="button" className="akb-klein" onClick={() => aktion("wieder_offen")}>Wieder öffnen</button>}
          {!fertig && <button type="button" className="akb-klein" onClick={() => aktion("abschliessen", "Ohne Upload abschließen — warum? (Der Kunde bekommt keine Mail.)")}>Abschließen</button>}
        </div>
      </div>
    </article>
  );
}
