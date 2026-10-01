// ═══════════════════════════════════════════════════════════════════════════
// CHEFBÜRO · GLOBAL-AUFTRÄGE → Reiter „Individualangebote"
// Individualangebot (01.10.2026), Register E-268
//
// Keine neue Chef-Seite (Regel „Keine neuen Chef-Seiten"): ein Reiter im Raum
// /chef/s/global-auftraege (?reiter=angebote). Hier legt die Leitung ein
// persönliches Angebot an (Person → Daten aus dem jüngsten Antrag), trägt die
// Pflichtfelder der Bürgin ein, kopiert den signierten Link — und führt nach der
// Annahme die drei Dinge, die nur ein Mensch entscheiden kann:
//   · „Meilenstein erreicht" → Rechnung Teil 2 (Zahlungsziel sieben Tage),
//   · „Frist hemmen" → nur mit Aufforderung in Textform und Grund,
//   · „Erstattung vormerken" → erst nach Fristende ohne Meilenstein: Teil 2
//     entfällt, Storno mit Erstattung, dringende Aufgabe an Justin (Geld bewegt
//     nur er, von Hand), Mail an den Kunden.
// Ob ein Knopf frei ist, sagt der Server (knoepfe) — der Grund steht als Text da.
// Server: server/routes/fiaon-global-angebot.ts.
//
// Angebot-Aufrufe (01.10.2026, Justin: „wann er es wie oft und wo geöffnet hat"): je Angebot
// „Geöffnet: n× (zuletzt …)" bzw. „Noch nicht geöffnet", „Kunde zuletzt: …" und die aufklappbare
// Liste (Zeit Berlin, Art, Gerät, Ort, du/Kunde). Alles kommt fertig vom Server (aufrufe) —
// Zeiten schon in Berlin, Ort ehrlich („Ort unbekannt"). Quelle: server/lib/fiaon-global-angebot-aufrufe.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { eur, datum, datumZeit, Geruest, Fehlermeldung, useDaten, API } from "./chef-teile";

type Teil = {
  nr: number; titel: string; betragCents: number; faelligkeit: string; zahlungszielTage: number; bestellRef: string | null; verwendungszweck: string | null;
  rechnungsnummer: string | null; zahlungsstatus: string | null; faelligAm: string | null; bezahltAm: string | null; meilensteinAm: string | null; meilensteinArt: string | null;
  eingetragenAm: string | null; entfallenAm: string | null; entfallenGrund: string | null; rechnungUrl: string | null; zahlungsseite: string | null;
};
type AufrufZeile = { id: number; am: string; amText: string; art: string; geraet: string; ort: string; ip: string | null; wer: string; kunde: boolean; gemeldet: boolean; meldung: string | null; antwort: number | null };
type Aufrufe = {
  geoeffnet: number; vertragPdf: number; pruefberichtPdf: number; kundeAufrufe: number; besuche: number; intern: number; automatisch: number; gesamt: number;
  kundeZuletzt: { am: string; amText: string; art: string; geraet: string; ort: string } | null; kundeErster: { am: string; amText: string } | null;
  aufgabeSchluessel: string; liste: AufrufZeile[];
  /** Gegenprüfung 01.10.2026 (F1): Löschfrist erreicht (90 Tage nach Abschluss) — dann nicht „Noch nicht geöffnet". */
  geloescht?: boolean;
};
type Buergin = { name: string; bundesstaat: string | null; anschrift: string | null; registerstelle: string | null; registernummer: string | null; vertreter: string | null; funktion: string | null; unterzeichnetAm: string | null; bestaetigt: boolean; bestaetigtGrundlage: string | null };
type Angebot = {
  id: number; ref: string; status: "offen" | "angenommen" | "zurueckgezogen" | "abgelaufen"; personId: number | null; kundeName: string;
  kunde: Record<string, string>; parameter: Record<string, number>; gesamtCents: number; buergin: Buergin; fehlt: string[]; annahmeBereit: boolean;
  /** Endabnahme 01.10.2026: Grund, warum der Link noch nicht verschickt werden darf (Registernachweis der Bürgin) — null = frei. */
  versandSperre: string | null;
  gueltigBis: string; erstelltAm: string; erstelltVon: string | null; link: string | null; vertragUrl: string; pruefberichtUrl: string | null;
  anlage1Url: string; anlage1Pruefsumme: string;
  pruefbericht: { ergebnis: string; boniPunkte: number | null; boniLabel: string | null; sanktionen: boolean } | null;
  angenommenAm: string | null; ip: string | null; textHash: string | null; schalter: { sofortBeginn: boolean; jahresbetreuung: boolean } | null;
  auftragRef: string | null; officeLink: string | null; fristBeginn: string | null; fristEnde: string | null; fristHemmungTage: number;
  erstattungAusgeloestAm: string | null; erstattetAm: string | null; erstattungNotiz: string | null;
  bestaetigungMailAm: string | null; bestaetigungMailFehler: string | null; nacharbeitFehler: string | null;
  zurueckgezogenAm: string | null; zurueckgezogenGrund: string | null; teile: Teil[];
  knoepfe: { meilenstein: string | null; erstattung: string | null; hemmung: string | null; aendern: string | null };
  verlauf: { am: string; wer: string; was: string }[];
  /** Angebot-Aufrufe (01.10.2026) — null, wenn die Liste der Aufrufe gerade nicht ladbar ist. */
  aufrufe: Aufrufe | null;
};
type Antwort = {
  ok: boolean; angebote: Angebot[];
  vorgaben: { parameter: Record<string, number>; buergin: Buergin; buerginFelder: { schluessel: keyof Buergin; bezeichnung: string; hinweis: string }[]; fassung: string; gueltigTage: number };
};

const STATUS_TEXT: Record<Angebot["status"], string> = { offen: "Offen — wartet auf Annahme", angenommen: "Angenommen", zurueckgezogen: "Zurückgezogen", abgelaufen: "Abgelaufen" };
const KUNDE_FELDER: [string, string][] = [["anrede", "Anrede"], ["vorname", "Vorname"], ["nachname", "Nachname"], ["geburtsdatum", "Geburtsdatum (JJJJ-MM-TT)"], ["strasse", "Straße"], ["plz", "PLZ"], ["ort", "Ort"], ["land", "Land (DE/AT/CH)"], ["email", "E-Mail"], ["telefon", "Telefon"]];
const PARAM_FELDER: [string, string, "euro" | "zahl"][] = [["teil1Cents", "Teil 1 „Gründung“ (€)", "euro"], ["teil2Cents", "Teil 2 „Kapital-Begleitung“ (€)", "euro"], ["fristWochen", "Frist in Wochen", "zahl"], ["erstattungTage", "Erstattung binnen Tagen", "zahl"], ["teil2ZielTage", "Zahlungsziel Teil 2 (Tage)", "zahl"], ["kapitalZielUsd", "Kapitalrahmen-Ziel (US-Dollar)", "zahl"], ["kartenZiel", "Kartenziel (Anzahl)", "zahl"], ["buergschaftUsd", "Höchstbetrag Bürgschaft (US-Dollar)", "zahl"]];

/** Wer hat den persönlichen Link wann, wie oft und wo geöffnet — und wurde Justin benachrichtigt? */
function AufrufBlock({ x }: { x: Aufrufe | null }) {
  if (!x) return <div className="cg-aufrufe" data-aufrufe="fehlt"><p className="cm-fein">Die Aufrufe des Links lassen sich gerade nicht laden — bitte die Seite gleich neu laden.</p></div>;
  const kopf = x.geloescht && x.gesamt === 0
    ? "Aufrufe gelöscht — 90 Tage nach Abschluss"
    : x.geoeffnet > 0
      ? `Geöffnet: ${x.geoeffnet}×${x.kundeZuletzt ? ` (zuletzt ${x.kundeZuletzt.amText})` : ""}`
      : x.kundeAufrufe > 0 ? "Seite noch nicht geöffnet" : "Noch nicht geöffnet";
  const neben = [
    x.vertragPdf ? `Vertrag-PDF ${x.vertragPdf}×` : null,
    x.pruefberichtPdf ? `Prüfbericht-PDF ${x.pruefberichtPdf}×` : null,
    x.besuche > 1 ? `${x.besuche} Besuche` : null,
    x.intern ? `dazu ${x.intern}× du/Team` : null,
    x.automatisch ? `${x.automatisch}× automatisch` : null,
  ].filter(Boolean);
  const letzteMeldung = x.liste.find((z) => z.gemeldet) ?? null;
  return (
    <div className="cg-aufrufe" data-aufrufe-geoeffnet={x.geoeffnet} data-aufrufe-geloescht={x.geloescht ? "ja" : undefined}>
      <p className="cg-aufruf-kopf"><b className={x.kundeAufrufe > 0 ? "cg-gut" : undefined}>{kopf}</b>{neben.length > 0 && <span className="cm-fein"> · {neben.join(" · ")}</span>}</p>
      {x.kundeZuletzt && <p className="cm-klartext">Kunde zuletzt: {x.kundeZuletzt.amText} · {x.kundeZuletzt.art} · {x.kundeZuletzt.geraet} · {x.kundeZuletzt.ort}</p>}
      {letzteMeldung && <p className="cm-fein">Letzte Meldung an dich: {letzteMeldung.amText} — {letzteMeldung.meldung ?? "läuft gerade"}</p>}
      {x.liste.length > 0 && (
        <details className="cg-verlauf cg-aufruf-liste">
          <summary>Alle Aufrufe ({x.gesamt}{x.gesamt > x.liste.length ? `, hier die letzten ${x.liste.length}` : ""})</summary>
          <div className="cm-tab-halter"><table className="cm-tab cg-aufruf-tab">
            <thead><tr><th>Zeit (Berlin)</th><th>Art</th><th>Gerät</th><th>Ort</th><th>Wer</th></tr></thead>
            <tbody>
              {x.liste.map((z) => (
                <tr key={z.id} className={z.kunde ? "cg-aufruf-kunde" : undefined}>
                  <td>{z.amText}{z.gemeldet && <span className="cm-fein" title={z.meldung ?? undefined}> · gemeldet</span>}</td>
                  <td>{z.art}{z.antwort != null && z.antwort >= 400 && <span className="cg-rot"> (Antwort {z.antwort})</span>}</td>
                  <td>{z.geraet}</td>
                  <td>{z.ort}{z.ip && <span className="cm-fein"> · IP {z.ip}</span>}</td>
                  <td>{z.wer}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </details>
      )}
      <p className="cm-fein">Beim ersten Öffnen durch den Kunden und bei jedem neuen Besuch nach 30 Minuten Pause bekommst du eine Aufgabe auf deinem Board und eine Mail an js@fiaon.com. Deine eigenen Aufrufe zählen als „du“ und lösen nichts aus. Der Ort kommt nur aus den Angaben des Netzbetreibers. Die gekürzte IP steht nur hier, nicht in Aufgabe und Mail.</p>
    </div>
  );
}

async function post(pfad: string, body: unknown, methode = "POST"): Promise<any> {
  return fetch(`${API}${pfad}`, { method: methode, credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) })
    .then(async (r) => ({ status: r.status, ...(await r.json().catch(() => ({ ok: false, error: `Antwort ${r.status} ohne Inhalt` }))) }))
    .catch(() => ({ ok: false, error: "Keine Verbindung zum Server." }));
}

export default function ChefGlobalAngebote() {
  const { daten, fehler, neu } = useDaten<Antwort>("/admin/global/angebote");
  const [meldung, setMeldung] = useState<{ gut: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [offen, setOffen] = useState<{ id: number; art: "buergin" | "meilenstein" | "hemmung" | "erstattung" | "ueberwiesen" | "zurueck" } | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [neuOffen, setNeuOffen] = useState(false);
  const [neuForm, setNeuForm] = useState<{ personId: string; kunde: Record<string, string>; parameter: Record<string, string>; gueltigBis: string; hinweise: string[] }>({ personId: "", kunde: {}, parameter: {}, gueltigBis: "", hinweise: [] });

  const aktion = async (schluessel: string, pfad: string, body: unknown, methode = "POST") => {
    setBusy(schluessel); setMeldung(null);
    const r = await post(pfad, body, methode);
    setBusy(null);
    setMeldung(r.ok ? { gut: true, text: r.meldung || "Gespeichert." } : { gut: false, text: `Nicht gespeichert: ${r.error || "unbekannter Fehler"}` });
    if (r.ok) { setOffen(null); setForm({}); neu(); }
    return r;
  };

  if (fehler) return <Fehlermeldung text={fehler} erneut={neu} />;
  if (!daten) return <Geruest zeilen={4} />;
  const V = daten.vorgaben;

  const vorbelegen = async () => {
    const id = Number(neuForm.personId);
    if (!id) { setMeldung({ gut: false, text: "Bitte eine Personen-Nummer eintragen." }); return; }
    setBusy("vorbelegung"); setMeldung(null);
    const r = await fetch(`${API}/admin/global/angebote/vorbelegung?personId=${id}`, { credentials: "include" }).then((x) => x.json()).catch(() => ({ ok: false, error: "Keine Verbindung zum Server." }));
    setBusy(null);
    if (!r.ok) { setMeldung({ gut: false, text: r.error || "Die Person ließ sich nicht laden." }); return; }
    setNeuForm({ ...neuForm, kunde: Object.fromEntries(Object.entries(r.kunde || {}).map(([k, v]) => [k, String(v ?? "")])), hinweise: r.hinweise || [] });
  };
  const anlegen = async () => {
    const parameter: Record<string, number> = {};
    for (const [k, , art] of PARAM_FELDER) {
      const roh = String(neuForm.parameter[k] ?? "").replace(/\./g, "").replace(",", ".").trim();
      if (roh) parameter[k] = art === "euro" ? Math.round(Number(roh) * 100) : Math.round(Number(roh));
    }
    const r = await aktion("anlegen", "/admin/global/angebote", { personId: Number(neuForm.personId) || null, kunde: neuForm.kunde, parameter, gueltigBis: neuForm.gueltigBis || undefined });
    if (r.ok) { setNeuOffen(false); setNeuForm({ personId: "", kunde: {}, parameter: {}, gueltigBis: "", hinweise: [] }); setMeldung({ gut: true, text: `Angebot ${r.ref} angelegt. Link: ${r.link}` }); }
  };
  const kopieren = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setMeldung({ gut: true, text: "Link in die Zwischenablage kopiert." }); }
    catch { setMeldung({ gut: false, text: `Kopieren ging nicht — bitte von Hand markieren: ${text}` }); }
  };

  return (
    <div className="cg-angebote" data-fiaon="global-angebote">
      {meldung && <div className={`cm-meldung ${meldung.gut ? "" : "cg-rot"}`} role="status">{meldung.text}</div>}
      <section className="cz-block">
        <header>
          <h2>Individualangebote</h2>
          <p>Ein persönliches Angebot für eine Person — Teil 1 sofort, Teil 2 erst beim Meilenstein, Bürgschaftszusage, Frist mit vollständiger Erstattung. Der Kunde liest und nimmt über einen signierten Link an; danach laufen Rechnung, Zahlungsseite und „Mein Auftrag“ wie bei jedem Global-Auftrag. Fassung {V.fassung}.</p>
        </header>
        {!neuOffen ? (
          <button type="button" className="cg-knopf cg-knopf-haupt cg-neu-angebot" onClick={() => setNeuOffen(true)}>Neues Individualangebot</button>
        ) : (
          <div className="cg-form cg-form-breit" aria-label="Neues Individualangebot">
            <div className="cg-zeile-form">
              <label>Personen-Nummer<input inputMode="numeric" value={neuForm.personId} onChange={(e) => setNeuForm({ ...neuForm, personId: e.target.value.replace(/\D/g, "") })} placeholder="z. B. 13411" /></label>
              <button type="button" className="cg-knopf" disabled={busy === "vorbelegung" || !neuForm.personId} onClick={vorbelegen}>Daten aus dem Antrag holen</button>
            </div>
            {neuForm.hinweise.length > 0 && <ul className="cg-hinweise">{neuForm.hinweise.map((h) => <li key={h}>{h}</li>)}</ul>}
            <div className="cg-raster">
              {KUNDE_FELDER.map(([k, l]) => (
                <label key={k}>{l}<input value={neuForm.kunde[k] ?? ""} onChange={(e) => setNeuForm({ ...neuForm, kunde: { ...neuForm.kunde, [k]: e.target.value } })} /></label>
              ))}
            </div>
            <p className="cm-fein">Teile und Fristen (leer = Vorgabe der Fassung: {eur(V.parameter.teil1Cents)} + {eur(V.parameter.teil2Cents)}, {V.parameter.fristWochen} Wochen):</p>
            <div className="cg-raster">
              {PARAM_FELDER.map(([k, l, art]) => (
                <label key={k}>{l}<input inputMode="decimal" value={neuForm.parameter[k] ?? ""} placeholder={art === "euro" ? String(V.parameter[k] / 100) : String(V.parameter[k])} onChange={(e) => setNeuForm({ ...neuForm, parameter: { ...neuForm.parameter, [k]: e.target.value } })} /></label>
              ))}
              <label>Gültig bis (leer = {V.gueltigTage} Tage)<input type="date" value={neuForm.gueltigBis} onChange={(e) => setNeuForm({ ...neuForm, gueltigBis: e.target.value })} /></label>
            </div>
            <p className="cm-fein">Die Bürgin ({V.buergin.name}) und der Prüfbericht werden danach am Angebot eingetragen. Solange ein Pflichtfeld fehlt, kann der Kunde lesen, aber nicht annehmen.</p>
            <div className="cg-form-knoepfe">
              <button type="button" className="cg-knopf cg-knopf-haupt" disabled={busy === "anlegen"} onClick={anlegen}>Anlegen</button>
              <button type="button" className="cg-knopf" onClick={() => setNeuOffen(false)}>Abbrechen</button>
            </div>
          </div>
        )}
      </section>

      {daten.angebote.length === 0 && <p className="cg-leer">Noch kein Individualangebot.</p>}
      {daten.angebote.map((a) => {
        const t1 = a.teile.find((t) => t.nr === 1); const t2 = a.teile.find((t) => t.nr === 2);
        return (
          <section key={a.id} className={`cz-block cg-angebot cg-${a.status}`} data-angebot={a.ref}>
            <header className="cg-angebot-kopf">
              <div>
                <h3>{a.kundeName} <span className="cg-ref">{a.ref}</span></h3>
                <p className="cm-klartext">{eur(a.gesamtCents)} gesamt · Teil 1 {eur(a.parameter.teil1Cents)} sofort · Teil 2 {eur(a.parameter.teil2Cents)} beim Meilenstein · Frist {a.parameter.fristWochen} Wochen · gültig bis {datum(a.gueltigBis)}</p>
              </div>
              <span className={`cg-marke cg-marke-${a.status === "angenommen" ? "gestartet" : a.status === "offen" ? "offen" : "storniert"}`}>{STATUS_TEXT[a.status]}</span>
            </header>

            <div className="cg-links">
              {/* Endabnahme 01.10.2026: Solange der Registernachweis der Bürgin fehlt, gibt es „Link kopieren" nicht — nur die
                  Vorschau. Der Grund steht daneben; nach der Annahme hat der Kunde den Link ohnehin. */}
              {a.link && <span className="cg-linkzeile"><a href={a.link} target="_blank" rel="noreferrer">Kundenseite öffnen (Vorschau, ohne Annahme)</a>
                {a.status === "offen" && a.versandSperre
                  ? <span className="cg-rot" data-versand="gesperrt"><b>Versand gesperrt:</b> {a.versandSperre}</span>
                  : <button type="button" className="cg-knopf" onClick={() => kopieren(a.link!)}>Link kopieren</button>}
              </span>}
              <a href={a.vertragUrl} target="_blank" rel="noreferrer">{a.status === "angenommen" ? "Vertrag mit Annahmevermerk (PDF)" : "Vertrag — Entwurf (PDF)"}</a>
              {a.pruefberichtUrl && <a href={a.pruefberichtUrl} target="_blank" rel="noreferrer">Anlage 2: Prüfbericht (PDF)</a>}
              {/* Gegenprüfung 01.10.2026: Das Blatt zum eigenhändigen Unterschreiben — mit Prüfsumme dieser Fassung (§ 766 BGB). */}
              <a href={a.anlage1Url} target="_blank" rel="noreferrer">Anlage 1 zum Unterschreiben (PDF) · Prüfsumme {a.anlage1Pruefsumme.slice(0, 12)}…</a>
              {a.officeLink && <a href={a.officeLink}>Auftrag im Office ({a.auftragRef})</a>}
            </div>

            <AufrufBlock x={a.aufrufe ?? null} />

            {a.status === "offen" && (
              a.fehlt.length > 0
                ? <div className="cg-pflicht"><b>Annahme gesperrt — es fehlt:</b><ul>{a.fehlt.map((f) => <li key={f}>{f}</li>)}</ul></div>
                : <p className="cm-klartext cg-gut">Alle Pflichtfelder sind da — der Kunde kann annehmen.</p>
            )}

            <div className="cg-zwei">
              <div>
                <h4>Bürgin: {a.buergin.name}</h4>
                <p className="cm-klartext">{[a.buergin.bundesstaat, a.buergin.anschrift].filter(Boolean).join(" · ") || "—"}</p>
                <p className="cm-klartext">Register: {a.buergin.registernummer || <span className="cg-rot">fehlt</span>} · vertreten durch {a.buergin.vertreter || "—"} ({a.buergin.funktion || <span className="cg-rot">Funktion fehlt</span>}) · eigenhändig unterschrieben: {a.buergin.unterzeichnetAm ? datum(a.buergin.unterzeichnetAm) : <span className="cg-rot">offen</span>} · {a.buergin.bestaetigt ? `bestätigt${a.buergin.bestaetigtGrundlage ? ` (Grundlage: ${a.buergin.bestaetigtGrundlage})` : ""}` : <span className="cg-rot">nicht bestätigt</span>}</p>
                {a.knoepfe.aendern
                  ? <p className="cm-fein">{a.knoepfe.aendern}</p>
                  : <button type="button" className="cg-knopf cg-knopf-buergin" onClick={() => { setOffen({ id: a.id, art: "buergin" }); setForm({ ...a.buergin }); }}>Pflichtfelder der Bürgin eintragen</button>}
              </div>
              <div>
                <h4>Anlage 2: Prüfbericht</h4>
                {a.pruefbericht
                  ? <p className="cm-klartext">{a.pruefbericht.ergebnis}{a.pruefbericht.boniPunkte != null ? ` · Boni-Ampel ${a.pruefbericht.boniPunkte} Punkte (${a.pruefbericht.boniLabel})` : ""}{a.pruefbericht.sanktionen ? "" : " · Sanktionslisten: steht aus"}</p>
                  : <p className="cm-klartext cg-rot">Kein Prüfbericht — sperrt die Annahme.</p>}
                {a.status === "offen" && a.personId && <button type="button" className="cg-knopf" disabled={busy === `pb${a.id}`} onClick={() => aktion(`pb${a.id}`, `/admin/global/angebote/${a.id}/pruefbericht`, {})}>Bonitätsteil aus den Daten neu rechnen</button>}
              </div>
            </div>

            {a.status === "angenommen" && (
              <div className="cg-annahme">
                <p className="cm-klartext">Angenommen am {datumZeit(a.angenommenAm)} · IP {a.ip ?? "—"} · Prüfsumme {a.textHash?.slice(0, 16)}… · sofortiger Beginn: {a.schalter?.sofortBeginn ? "ja" : "nein"} · Jahresbetreuung: {a.schalter?.jahresbetreuung ? "ja" : "nein"}</p>
                {a.nacharbeitFehler && <p className="cm-klartext cg-rot">Nach der Annahme hing etwas: {a.nacharbeitFehler}</p>}
                {a.bestaetigungMailFehler && !a.bestaetigungMailAm && <p className="cm-klartext cg-rot">Bestätigungsmail ging nicht raus: {a.bestaetigungMailFehler}</p>}
                {(a.nacharbeitFehler || (a.bestaetigungMailFehler && !a.bestaetigungMailAm)) && <button type="button" className="cg-knopf" disabled={busy === `nach${a.id}`} onClick={() => aktion(`nach${a.id}`, `/admin/global/angebote/${a.id}/nachholen`, {})}>Nachholen</button>}
                <div className="cm-tab-halter"><table className="cm-tab cg-teile">
                  <thead><tr><th>Teil</th><th>Betrag</th><th>Stand</th><th>Rechnung</th></tr></thead>
                  <tbody>
                    {[t1, t2].filter(Boolean).map((t) => (
                      <tr key={t!.nr}>
                        <td><b>{t!.titel}</b></td>
                        <td>{eur(t!.betragCents)}</td>
                        <td>{t!.entfallenAm ? <span className="cg-rot">entfallen — {t!.entfallenGrund}</span>
                          : t!.zahlungsstatus === "paid" ? <>bezahlt{t!.bezahltAm ? ` am ${datum(t!.bezahltAm)}` : ""}</>
                          : t!.zahlungsstatus === "cancelled" || t!.zahlungsstatus === "superseded" ? <span className="cg-rot">storniert</span>
                          : t!.bestellRef ? <>offen · fällig {datum(t!.faelligAm)}{t!.meilensteinAm ? ` · Meilenstein ${datum(t!.meilensteinAm)} (${t!.meilensteinArt === "karte" ? "Karte" : "Kapital"})` : ""}</>
                          : <span className="cm-wann">noch nicht fällig — erst beim Meilenstein</span>}</td>
                        <td>{t!.rechnungUrl ? <a href={t!.rechnungUrl} target="_blank" rel="noreferrer">{t!.rechnungsnummer ?? "Rechnung"}</a> : "—"}{t!.verwendungszweck ? <span className="cm-klartext">Zweck {t!.verwendungszweck}</span> : null}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
                <p className="cm-klartext">Frist: {a.fristEnde ? <>vom {datum(a.fristBeginn)} bis <b>{datum(a.fristEnde)}</b>{a.fristHemmungTage ? ` (davon ${a.fristHemmungTage} Tage gehemmt)` : ""}</> : "beginnt mit dem Start (Zahlung Teil 1, ohne sofortigen Beginn nach der Widerrufsfrist)"}{a.erstattungAusgeloestAm ? ` · Erstattung vorgemerkt am ${datum(a.erstattungAusgeloestAm)}` : ""}{a.erstattetAm ? ` · überwiesen am ${datum(a.erstattetAm)} (${a.erstattungNotiz})` : ""}</p>
                <div className="cg-knoepfe cg-knoepfe-reihe">
                  <span><button type="button" className="cg-knopf cg-knopf-haupt cg-knopf-meilenstein" disabled={!!a.knoepfe.meilenstein} onClick={() => { setOffen({ id: a.id, art: "meilenstein" }); setForm({ art: "", datum: "", eingetragenAm: "", beleg: "" }); }}>Meilenstein erreicht → Rechnung Teil 2</button>{a.knoepfe.meilenstein && <span className="cm-fein">{a.knoepfe.meilenstein}</span>}</span>
                  <span><button type="button" className="cg-knopf" disabled={!!a.knoepfe.hemmung} onClick={() => { setOffen({ id: a.id, art: "hemmung" }); setForm({ aufgefordertAm: "", erbrachtAm: "", grund: "" }); }}>Frist hemmen</button>{a.knoepfe.hemmung && <span className="cm-fein">{a.knoepfe.hemmung}</span>}</span>
                  <span><button type="button" className="cg-knopf cg-knopf-storno cg-knopf-erstattung" disabled={!!a.knoepfe.erstattung} onClick={() => { setOffen({ id: a.id, art: "erstattung" }); setForm({}); }}>Frist abgelaufen → Erstattung {eur(a.parameter.teil1Cents)} vormerken</button>{a.knoepfe.erstattung && <span className="cm-fein">{a.knoepfe.erstattung}</span>}</span>
                  {a.erstattungAusgeloestAm && !a.erstattetAm && <span><button type="button" className="cg-knopf" onClick={() => { setOffen({ id: a.id, art: "ueberwiesen" }); setForm({ am: "", notiz: "" }); }}>Erstattung überwiesen</button></span>}
                </div>
              </div>
            )}

            {a.status === "offen" && <button type="button" className="cg-knopf cg-knopf-storno" onClick={() => { setOffen({ id: a.id, art: "zurueck" }); setForm({ grund: "" }); }}>Angebot zurückziehen</button>}
            {a.status === "zurueckgezogen" && <p className="cm-klartext">Zurückgezogen am {datum(a.zurueckgezogenAm)}: {a.zurueckgezogenGrund}</p>}

            {offen?.id === a.id && offen.art === "buergin" && (
              <div className="cg-form cg-form-breit">
                <div className="cg-raster">
                  {V.buerginFelder.map((f) => (
                    <label key={String(f.schluessel)} title={f.hinweis}>{f.bezeichnung}
                      <input type={f.schluessel === "unterzeichnetAm" ? "date" : "text"} value={String(form[f.schluessel] ?? "")} onChange={(e) => setForm({ ...form, [f.schluessel]: e.target.value })} />
                      <span className="cm-fein">{f.hinweis}</span>
                    </label>
                  ))}
                </div>
                <label className="cg-haken"><input type="checkbox" checked={form.bestaetigt === true} onChange={(e) => setForm({ ...form, bestaetigt: e.target.checked })} /> Bundesstaat, Anschrift und Vertretung habe ich bestätigt — womit, steht im Feld „Grundlage der Bestätigung“ (z. B. EIN-Antrag SS-4 oder Registerauszug).</label>
                <p className="cm-fein">Anlage 1 wird von Hand unterschrieben (§ 766 BGB) — das Original geht per Post an den Kunden, ein Scan in die Akte. Erst dann das Datum eintragen.</p>
                <div className="cg-form-knoepfe">
                  <button type="button" className="cg-knopf cg-knopf-haupt" disabled={busy === `b${a.id}`} onClick={() => aktion(`b${a.id}`, `/admin/global/angebote/${a.id}`, { buergin: form }, "PUT")}>Speichern</button>
                  <button type="button" className="cg-knopf" onClick={() => setOffen(null)}>Abbrechen</button>
                </div>
              </div>
            )}
            {offen?.id === a.id && offen.art === "meilenstein" && (
              <div className="cg-form cg-form-breit" role="dialog" aria-label="Meilenstein eintragen">
                <div className="cg-raster">
                  <label>Was ist passiert?
                    <select value={form.art} onChange={(e) => setForm({ ...form, art: e.target.value })}>
                      <option value="">Bitte wählen</option>
                      <option value="kapital">Erstes Kapital an die Gesellschaft ausgezahlt</option>
                      <option value="karte">Erste Business-Kreditkarte für die Gesellschaft freigeschaltet</option>
                    </select>
                  </label>
                  <label>Am (Auszahlung bzw. Freischaltung)<input type="date" value={form.datum} onChange={(e) => setForm({ ...form, datum: e.target.value })} /></label>
                  <label>Gesellschaft eingetragen am<input type="date" value={form.eingetragenAm} onChange={(e) => setForm({ ...form, eingetragenAm: e.target.value })} /></label>
                </div>
                <label>Beleg in einem Satz (intern — der Kunde sieht keinen Banknamen)<textarea rows={2} value={form.beleg} onChange={(e) => setForm({ ...form, beleg: e.target.value })} placeholder="Zum Beispiel: Mitteilung des Instituts vom … liegt im Dokumentenraum." /></label>
                <p className="cm-fein">Danach entsteht die Rechnung über Teil 2 ({eur(a.parameter.teil2Cents)}, zahlbar binnen {a.parameter.teil2ZielTage} Tagen) und geht mit einer Mail an den Kunden.</p>
                <div className="cg-form-knoepfe">
                  <button type="button" className="cg-knopf cg-knopf-haupt" disabled={busy === `m${a.id}` || !form.art || !form.datum || !form.eingetragenAm || String(form.beleg || "").trim().length < 20} onClick={() => aktion(`m${a.id}`, `/admin/global/angebote/${a.id}/meilenstein`, form)}>Rechnung Teil 2 stellen</button>
                  <button type="button" className="cg-knopf" onClick={() => setOffen(null)}>Abbrechen</button>
                </div>
                {String(form.beleg || "").trim().length < 20 && <p className="cm-fein">Noch {20 - String(form.beleg || "").trim().length} Zeichen bis zum Beleg.</p>}
              </div>
            )}
            {offen?.id === a.id && offen.art === "hemmung" && (
              <div className="cg-form cg-form-breit">
                {/* Gegenprüfung 01.10.2026: Die Ruhezeit wird gerechnet, nicht getippt — Aufforderung + sieben Tage bis zur erbrachten Mitwirkung (oder bis heute). */}
                <div className="cg-raster">
                  <label>Aufforderung in Textform am<input type="date" value={form.aufgefordertAm} onChange={(e) => setForm({ ...form, aufgefordertAm: e.target.value })} /></label>
                  <label>Mitwirkung erbracht am (leer = fehlt noch)<input type="date" value={form.erbrachtAm} onChange={(e) => setForm({ ...form, erbrachtAm: e.target.value })} /></label>
                </div>
                <label>Welche Mitwirkung fehlt(e)? (mindestens 20 Zeichen — der Satz steht in der Mail an den Kunden)<textarea rows={2} value={form.grund} onChange={(e) => setForm({ ...form, grund: e.target.value })} /></label>
                <p className="cm-fein">Die Frist ruht ab dem Tag nach Ablauf der Aufforderungsfrist (Aufforderung + sieben Tage) bis zum Tag der Mitwirkung — bei noch fehlender Mitwirkung bis heute; was schon gezählt ist, zählt nicht doppelt (Ziffer 6 Absatz 3). Der Kunde bekommt das neue Fristende sofort per Mail (Textform). Behörden, Institute oder wir selbst hemmen nie.</p>
                <div className="cg-form-knoepfe">
                  <button type="button" className="cg-knopf cg-knopf-haupt" disabled={busy === `h${a.id}` || !form.aufgefordertAm || String(form.grund || "").trim().length < 20} onClick={() => aktion(`h${a.id}`, `/admin/global/angebote/${a.id}/hemmung`, form)}>Ruhezeit eintragen</button>
                  <button type="button" className="cg-knopf" onClick={() => setOffen(null)}>Abbrechen</button>
                </div>
              </div>
            )}
            {offen?.id === a.id && offen.art === "erstattung" && (
              <div className="cg-form cg-form-breit" role="dialog" aria-label="Erstattung vormerken">
                <p className="cm-fein"><b>Frist am {datum(a.fristEnde)} abgelaufen, ohne Meilenstein.</b> Teil 2 entfällt. Die Bestellung Teil 1 geht über den Storno-Weg mit Erstattung (Provisionen zurück), Justin bekommt die dringende Aufgabe „Erstattung veranlassen“ mit dem spätesten Datum, und der Kunde bekommt eine Mail. Es wird KEIN Geld bewegt — überwiesen wird von Hand.</p>
                <div className="cg-form-knoepfe">
                  <button type="button" className="cg-knopf cg-knopf-storno" disabled={busy === `e${a.id}`} onClick={() => aktion(`e${a.id}`, `/admin/global/angebote/${a.id}/erstattung`, {})}>Erstattung jetzt vormerken</button>
                  <button type="button" className="cg-knopf" onClick={() => setOffen(null)}>Abbrechen</button>
                </div>
              </div>
            )}
            {offen?.id === a.id && offen.art === "ueberwiesen" && (
              <div className="cg-form cg-form-breit">
                <div className="cg-raster">
                  <label>Überwiesen am<input type="date" value={form.am} onChange={(e) => setForm({ ...form, am: e.target.value })} /></label>
                  <label>Bankreferenz oder Notiz<input value={form.notiz} onChange={(e) => setForm({ ...form, notiz: e.target.value })} /></label>
                </div>
                <div className="cg-form-knoepfe">
                  <button type="button" className="cg-knopf cg-knopf-haupt" disabled={busy === `u${a.id}`} onClick={() => aktion(`u${a.id}`, `/admin/global/angebote/${a.id}/erstattung-ueberwiesen`, form)}>Eintragen</button>
                  <button type="button" className="cg-knopf" onClick={() => setOffen(null)}>Abbrechen</button>
                </div>
              </div>
            )}
            {offen?.id === a.id && offen.art === "zurueck" && (
              <div className="cg-form">
                <label>Grund<textarea rows={2} value={form.grund} onChange={(e) => setForm({ ...form, grund: e.target.value })} /></label>
                <div className="cg-form-knoepfe">
                  <button type="button" className="cg-knopf cg-knopf-storno" disabled={busy === `z${a.id}` || String(form.grund || "").trim().length < 5} onClick={() => aktion(`z${a.id}`, `/admin/global/angebote/${a.id}/zurueckziehen`, form)}>Zurückziehen</button>
                  <button type="button" className="cg-knopf" onClick={() => setOffen(null)}>Abbrechen</button>
                </div>
              </div>
            )}

            {a.verlauf.length > 0 && (
              <details className="cg-verlauf"><summary>Verlauf ({a.verlauf.length})</summary>
                <ul>{a.verlauf.slice().reverse().map((v, i) => <li key={i}><span className="cm-wann">{datumZeit(v.am)} · {v.wer}</span> {v.was}</li>)}</ul>
              </details>
            )}
          </section>
        );
      })}
    </div>
  );
}
