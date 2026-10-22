// ═══════════════════════════════════════════════════════════════════════════
// DOKUMENTE & UNTERSCHRIFTEN — je Mandat (22.10.2026)
//
// Justin: „Jeder Vertrag, jedes Formular — alles für den Kunden bereit.“ Und:
//          „Formulare KOMPLETT ausgefüllt — der Kunde unterschreibt nur.“
//
// Ein Bauteil für zwei Räume (wie der Stationen-Editor): Chefbüro › Global ›
// Mandat › „Dokumente & Unterschriften“ (dunkel) und Office › Global-Akte (hell).
// Je Dokument (Ergänzung Befugnisse, Statement of Organizer, Operating Agreement,
// IRS SS-4, IRS 8821): Stand, was FEHLT (dann bleiben Erzeugen und Bereitstellen
// zu — mit der Liste daneben), Vorschau, Erzeugen, FIAON unterschreibt (SoO),
// zur Unterschrift bereitstellen, Prüfen (Prüfsumme + Siegel). Darunter die
// Angaben, die nur das Team ergänzen kann (Mitglieder, County, Tätigkeit …).
// Den Knopfzustand sagt der Server (fehlend, stand) — nie eine eigene Ableitung.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { SS4_TAETIGKEITEN } from "@shared/fiaon-global-irs";
import "@/styles/global-stationen.css";
import "@/styles/global-formulare.css";

type T = Record<string, any>;
type Antwort = { ok: boolean; error?: string; meldung?: string; fehlend?: { text: string }[]; [k: string]: unknown };

async function rufen(url: string, methode: "GET" | "POST", body?: unknown): Promise<Antwort> {
  try {
    const r = await fetch(url, { method: methode, credentials: "include", ...(body !== undefined ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.ok) return { ok: false, error: j?.error || `Fehler ${r.status} — bitte noch einmal.`, fehlend: j?.fehlend };
    return j;
  } catch { return { ok: false, error: "Keine Verbindung zum Server — nichts geändert." }; }
}

const STAND: Record<string, { text: string; ton: string }> = {
  nicht_noetig: { text: "nicht nötig", ton: "" },
  unvollstaendig: { text: "Angaben fehlen", ton: "rot" },
  bereit_zum_erzeugen: { text: "bereit zum Erzeugen", ton: "blau" },
  erzeugt: { text: "erzeugt (intern)", ton: "blau" },
  fiaon_unterschrieben: { text: "FIAON hat unterschrieben", ton: "blau" },
  veraltet: { text: "Daten geändert — neu erzeugen", ton: "rot" },
  wartet: { text: "beim Kunden zur Unterschrift", ton: "blau" },
  teilweise: { text: "teilweise unterschrieben", ton: "blau" },
  unterschrieben: { text: "unterschrieben", ton: "gruen" },
};
const tag = (iso?: string | null) => iso ? new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }) : "";

export default function GlobalFormulare({ basis, ton = "dunkel", onGeaendert }: { basis: string; ton?: "dunkel" | "hell"; onGeaendert?: () => void }) {
  const [daten, setDaten] = useState<T | null>(null);
  const [ladeFehler, setLadeFehler] = useState("");
  const [runde, setRunde] = useState(0);
  const [meldung, setMeldung] = useState<{ text: string; gut: boolean; liste?: string[] } | null>(null);
  const [laeuft, setLaeuft] = useState("");
  const [pruefung, setPruefung] = useState<Record<string, T>>({});
  const [felderAuf, setFelderAuf] = useState<string>("");
  const [fiaonOk, setFiaonOk] = useState(false);
  const [mitteilen, setMitteilen] = useState(true);
  const [angaben, setAngaben] = useState<T | null>(null);

  useEffect(() => {
    let aus = false;
    setLadeFehler("");
    const t = window.setTimeout(() => { if (!aus && !daten) setLadeFehler("Die Übersicht lädt nicht — bitte neu laden."); }, 20_000);
    void rufen(`${basis}/formulare`, "GET").then((j) => {
      if (aus) return;
      window.clearTimeout(t);
      if (!j.ok) { setLadeFehler(j.error || "Die Übersicht ließ sich nicht laden."); return; }
      setDaten(j); setAngaben(JSON.parse(JSON.stringify((j as T).angaben ?? {})));
    });
    return () => { aus = true; window.clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basis, runde]);

  const tun = async (key: string, pfad: string, body?: unknown) => {
    setLaeuft(key); setMeldung(null);
    const j = await rufen(`${basis}/${pfad}`, "POST", body ?? {});
    setLaeuft("");
    setMeldung({ text: j.ok ? String(j.meldung ?? "Erledigt.") : String(j.error), gut: j.ok, liste: j.fehlend?.map((f) => f.text) });
    if (j.ok) { setRunde((x) => x + 1); onGeaendert?.(); }
  };
  const pruefen = async (id: number) => {
    setLaeuft(`p${id}`);
    const j = await rufen(`${basis}/dokument/${id}/pruefen`, "GET");
    setLaeuft("");
    setPruefung((p) => ({ ...p, [id]: j.ok ? (j.pruefung as T) : { fehler: j.error } }));
  };

  if (ladeFehler) return <div className={`gst ${ton}`}><p className="gst-meldung schlecht" role="alert">{ladeFehler} <button type="button" className="gst-knopf leise" onClick={() => setRunde((x) => x + 1)}>Neu laden</button></p></div>;
  if (!daten || !angaben) return <div className={`gst ${ton}`}><p className="gst-leise">Lädt die Dokumente …</p></div>;
  const zeilen = daten.zeilen as T[];
  const k = daten.kontext as T;
  const offen = zeilen.filter((z) => z.noetig && z.stand !== "unterschrieben").length;

  return (
    <div className={`gst ${ton} gfo`} data-fiaon="formulare-editor">
      <div className="gst-kopf">
        <div>
          <span className="gst-auge">Dokumente &amp; Unterschriften</span>
          <p className="gst-kopf-zahl"><b>{zeilen.filter((z) => z.stand === "unterschrieben").length}</b> unterschrieben · {offen} offen</p>
        </div>
        <p className="gst-leise">Formulare gehen erst raus, wenn sie VOLLSTÄNDIG ausgefüllt sind — der Kunde unterschreibt nur. Digital: Ergänzung, Statement of Organizer, Operating Agreement (mit Code per E-Mail, Zertifikat, Siegel). Von Hand: IRS SS-4 und 8821 (ausdrucken, unterschreiben, Scan).</p>
      </div>

      {meldung && (
        <div className={`gst-meldung${meldung.gut ? " gut" : " schlecht"}`} role={meldung.gut ? "status" : "alert"}>
          {meldung.text}
          {meldung.liste && meldung.liste.length > 0 && <ul className="gfo-fehlt">{meldung.liste.map((x) => <li key={x}>{x}</li>)}</ul>}
          <button type="button" className="gst-knopf leise" onClick={() => setMeldung(null)}>Schließen</button>
        </div>
      )}

      <div className="gst-liste">
        {zeilen.map((z, i) => {
          const st = STAND[z.stand] ?? { text: z.stand, ton: "" };
          // Neu erzeugen geht, solange kein Kunde unterschrieben hat (auch wenn es schon beim Kunden liegt — dann danach neu bereitstellen).
          const kannErzeugen = z.noetig && z.fehlend.length === 0 && z.stand !== "unterschrieben" && z.stand !== "teilweise";
          const brauchtFiaon = z.art === "us_organizer" && z.organizerIstFiaon && !z.signaturen.some((x: T) => x.art === "fiaon");
          const kannFreigeben = !!z.dokumentId && z.fehlend.length === 0 && !z.datenGeaendert && (z.stand === "erzeugt" || z.stand === "fiaon_unterschrieben") && !brauchtFiaon;
          return (
            <section key={z.art} className={`gst-karte gfo-karte st-${z.stand}`} style={{ ["--i" as any]: i }} data-fiaon={`formular-${z.art}`}>
              <div className="gst-karte-kopf gfo-kopf">
                <span className="gst-titel">
                  <b>{z.titel}</b>
                  <small>{z.modus === "handschriftlich" ? "von Hand (Kunde druckt, unterschreibt, scannt als PDF)" : "digital im Portal"}{z.docId ? <> · <em>{z.docId}</em></> : null}{z.erzeugtAm ? <> · erzeugt {tag(z.erzeugtAm)}</> : null}</small>
                </span>
                <span className={`gst-pille ${st.ton}`}>{st.text}</span>
              </div>
              <div className="gfo-inhalt">
                {!z.noetig && <p className="gst-leise">{z.grund}</p>}
                {z.noetig && z.fehlend.length > 0 && (
                  <div className="gfo-fehlend" data-fiaon="formular-fehlend">
                    <b>Es fehlt noch ({z.fehlend.length}) — bis dahin geht nichts zum Kunden:</b>
                    <ul>{z.fehlend.map((f: T) => <li key={f.feld + f.text}>{f.text}</li>)}</ul>
                  </div>
                )}
                {z.hinweise?.length > 0 && <ul className="gfo-hinweise">{z.hinweise.map((h: string) => <li key={h}>{h}</li>)}</ul>}
                {z.signaturen?.length > 0 && (
                  <ul className="gfo-sig">{z.signaturen.map((x: T) => <li key={x.name + x.am}><b>{x.name}</b> ({x.rolle}) — {x.art === "fiaon" ? "FIAON" : "Kunde"}, {tag(x.am)}</li>)}</ul>
                )}
                {z.noetig && z.offen?.length > 0 && z.stand !== "unvollstaendig" && z.stand !== "bereit_zum_erzeugen" && <p className="gst-leise">Es unterschreiben noch: {z.offen.join(" · ")}</p>}
                {z.siegel && <p className="gst-leise">Siegel: {z.siegel.status === "versiegelt" ? `versiegelt (${z.siegel.zertifikat ?? "FIAON"})` : `ausstehend — ${z.siegel.grund ?? ""} Die Prüfsumme steht im Nachweis.`}</p>}

                <div className="gst-knoepfe gfo-knoepfe">
                  {z.noetig && <a className="gst-knopf leise" href={`${basis}/formulare/${z.art}/vorschau`} target="_blank" rel="noopener" data-fiaon="formular-vorschau">Vorschau</a>}
                  {z.noetig && z.stand !== "unterschrieben" && z.stand !== "teilweise" && (
                    <button type="button" className="gst-knopf" disabled={!kannErzeugen || !!laeuft} onClick={() => void tun(`e-${z.art}`, `formulare/${z.art}/erzeugen`)} data-fiaon="formular-erzeugen"
                      title={z.fehlend.length ? "Erst die fehlenden Angaben ergänzen" : ""}>
                      {laeuft === `e-${z.art}` ? "Erzeugt …" : z.dokumentId ? "Neu erzeugen" : "Formular erzeugen"}
                    </button>
                  )}
                  {z.dokumentId && <a className="gst-knopf leise" href={`${basis}/dokument/${z.ansichtId ?? z.dokumentId}`} target="_blank" rel="noopener">Ansehen</a>}
                  {z.art === "us_organizer" && z.dokumentId && brauchtFiaon && z.stand !== "veraltet" && (
                    <span className="gfo-fiaon">
                      <label className="gst-haken"><input type="checkbox" checked={fiaonOk} onChange={(e) => setFiaonOk(e.target.checked)} /> FIAON unterschreibt als Organizer (Director)</label>
                      <button type="button" className="gst-knopf" disabled={!fiaonOk || !!laeuft} onClick={() => void tun("fiaon", `formulare/${z.art}/fiaon-unterschreibt`, { bestaetigt: true })} data-fiaon="formular-fiaon">
                        {laeuft === "fiaon" ? "Unterschreibt …" : "FIAON unterschreibt"}
                      </button>
                    </span>
                  )}
                  {z.dokumentId && (z.stand === "erzeugt" || z.stand === "fiaon_unterschrieben" || z.stand === "veraltet") && (
                    <span className="gfo-freigabe">
                      <label className="gst-haken"><input type="checkbox" checked={mitteilen} onChange={(e) => setMitteilen(e.target.checked)} /> Kunde per Mail informieren</label>
                      <button type="button" className="gst-knopf gfo-haupt" disabled={!kannFreigeben || !!laeuft} onClick={() => void tun(`f-${z.art}`, `formulare/${z.art}/freigeben`, { mitteilen })} data-fiaon="formular-freigeben"
                        title={!kannFreigeben ? (z.datenGeaendert ? "Daten geändert — erst neu erzeugen" : brauchtFiaon ? "Erst unterschreibt FIAON" : "Erst vollständig erzeugen") : ""}>
                        {laeuft === `f-${z.art}` ? "Stellt bereit …" : "Zur Unterschrift bereitstellen"}
                      </button>
                    </span>
                  )}
                  {z.endfassungId && <a className="gst-knopf leise" href={`${basis}/dokument/${z.endfassungId}`} target="_blank" rel="noopener">Unterschriebene Fassung</a>}
                  {(z.endfassungId || z.signaturen?.length > 0) && z.dokumentId && <button type="button" className="gst-knopf leise" disabled={!!laeuft} onClick={() => void pruefen(z.dokumentId)} data-fiaon="formular-pruefen">{laeuft === `p${z.dokumentId}` ? "Prüft …" : "Prüfen"}</button>}
                  {z.belegung && <button type="button" className="gst-knopf leise" onClick={() => setFelderAuf((x) => x === z.art ? "" : z.art)}>{felderAuf === z.art ? "Felder zu" : "Welche Felder woher"}</button>}
                </div>
                {z.dokumentId && pruefung[z.dokumentId] && <Pruefung p={pruefung[z.dokumentId]} />}
                {felderAuf === z.art && z.belegung && (
                  <table className="gfo-tabelle"><thead><tr><th>Zeile</th><th>Wert</th><th>Quelle</th></tr></thead>
                    <tbody>{(z.belegung as T[]).map((f) => <tr key={f.feld}><td>{f.zeile}</td><td>{f.wert === true ? "angekreuzt" : String(f.wert)}</td><td>{f.quelle}</td></tr>)}</tbody></table>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <Angaben a={angaben} setA={setAngaben} k={k} laeuft={laeuft === "angaben"} speichern={() => void tun("angaben", "formular-angaben", angaben)} />
    </div>
  );
}

function Pruefung({ p }: { p: T }) {
  if (p.fehler) return <p className="gst-meldung schlecht" role="alert">{p.fehler}</p>;
  return (
    <div className={`gfo-pruefung ${p.unveraendert && (p.siegel?.gueltig || !p.siegel?.versiegelt) ? "gut" : "schlecht"}`} data-fiaon="formular-pruefung">
      <b>{p.unveraendert ? "Datei unverändert" : "Prüfsumme weicht ab!"}</b> — SHA-256 {String(p.sha256Jetzt).slice(0, 16)}… ({p.seiten} Seiten, {p.vollstaendig ? "alle unterschrieben" : "noch offen"})
      <br />Siegel: {p.siegel?.versiegelt ? (p.siegel.gueltig ? `gültig — ${p.siegel.subjekt ?? ""}` : `UNGÜLTIG — ${p.siegel.grund}`) : `keins (${p.siegel?.grundAusstehend ?? "ausstehend"})`}
      <ul>{(p.signaturen as T[]).map((s) => <li key={s.name + s.am}>{s.name} · {s.methode === "email_code" ? `Code an ${s.codeEmail}` : "Team"} · {tag(s.am)} · IP {s.ip ?? "—"}</li>)}</ul>
    </div>
  );
}

function Angaben({ a, setA, k, laeuft, speichern }: { a: T; setA: (x: T) => void; k: T; laeuft: boolean; speichern: () => void }) {
  const mitglieder: T[] = a.mitglieder?.length ? a.mitglieder : [{ name: k.kundeName, anschrift: k.kundeAnschrift, anteil: 100, email: k.kundeEmail, telefon: k.kundeTelefon }];
  const setzM = (i: number, feld: string, w: string) => setA({ ...a, mitglieder: mitglieder.map((m, j) => (j === i ? { ...m, [feld]: feld === "anteil" ? w.replace(",", ".") : w } : m)) });
  const s4 = a.ss4 ?? {}; const f8 = a.irs8821 ?? {}; const org = a.organizer ?? {};
  const feld = (titel: string, wert: string, setz: (v: string) => void, opt: { hilfe?: string; platz?: string; breit?: boolean } = {}) => (
    <label className={`gst-feld${opt.breit ? " gfo-breit" : ""}`}><span className="gst-label">{titel}</span>
      <input value={wert ?? ""} placeholder={opt.platz} onChange={(e) => setz(e.target.value)} />
      {opt.hilfe && <small className="gst-leise">{opt.hilfe}</small>}
    </label>
  );
  return (
    <section className="gst-karte gfo-angaben" data-fiaon="formular-angaben">
      <div className="gfo-inhalt">
        <span className="gst-auge">Angaben für die Dokumente</span>
        <p className="gst-leise">Alles andere kommt aus der Akte (Gesellschaft, Stationen, Auftrag). Gehört die LLC einer Firma (z. B. GmbH des Kunden), die Firma als Mitglied eintragen. Texte für US-Dokumente auf Englisch.</p>
        <h4 className="gfo-h">Mitglieder (Members)</h4>
        {mitglieder.map((m, i) => (
          <div key={i} className="gst-felder gfo-mitglied">
            {feld(`Name ${i + 1}`, m.name, (v) => setzM(i, "name", v))}
            {feld("Wohnanschrift (eine Zeile, englisch)", m.anschrift, (v) => setzM(i, "anschrift", v), { platz: "Musterstraße 1, 10115 Berlin, Germany", breit: true })}
            {feld("Anteil %", String(m.anteil ?? ""), (v) => setzM(i, "anteil", v))}
            {feld(i === 0 ? "E-Mail (sonst Auftrag)" : "E-Mail (Pflicht für den Code)", m.email ?? "", (v) => setzM(i, "email", v))}
            {feld("Telefon (international)", m.telefon ?? "", (v) => setzM(i, "telefon", v))}
            {mitglieder.length > 1 && <button type="button" className="gst-knopf leise" onClick={() => setA({ ...a, mitglieder: mitglieder.filter((_, j) => j !== i) })}>Entfernen</button>}
          </div>
        ))}
        <button type="button" className="gst-knopf leise" onClick={() => setA({ ...a, mitglieder: [...mitglieder, { name: "", anschrift: "", anteil: 0, email: "" }] })}>+ Mitglied</button>
        <div className="gst-felder zwei">
          <label className="gst-feld"><span className="gst-label">Geführt von</span>
            <select value={a.verwaltung ?? "member"} onChange={(e) => setA({ ...a, verwaltung: e.target.value })}><option value="member">den Mitgliedern (member-managed)</option><option value="manager">einem Manager (manager-managed)</option></select>
          </label>
          {a.verwaltung === "manager" && feld("Manager", a.manager ?? "", (v) => setA({ ...a, manager: v }))}
          {feld("County der Geschäftsanschrift", a.county ?? "", (v) => setA({ ...a, county: v }), { platz: "Laramie County", hilfe: "SS-4 Zeile 6" })}
        </div>
        <h4 className="gfo-h">Statement of Organizer</h4>
        <div className="gst-felder zwei">
          <label className="gst-haken"><input type="checkbox" checked={org.istFiaon !== false} onChange={(e) => setA({ ...a, organizer: { ...org, istFiaon: e.target.checked } })} /> Organizer ist FIAON LTD (Director)</label>
          {org.istFiaon === false && <>
            {feld("Organizer (Name)", org.name ?? "", (v) => setA({ ...a, organizer: { ...org, name: v } }))}
            {feld("Beschreibung", org.beschreibung ?? "", (v) => setA({ ...a, organizer: { ...org, beschreibung: v } }), { platz: "a Wyoming corporation" })}
            {feld("Unterzeichnet durch", org.vertreter ?? "", (v) => setA({ ...a, organizer: { ...org, vertreter: v } }))}
            {feld("Funktion", org.titel ?? "", (v) => setA({ ...a, organizer: { ...org, titel: v } }))}
          </>}
        </div>
        <h4 className="gfo-h">Operating Agreement (englisch)</h4>
        <div className="gst-felder zwei">
          {feld("Gegenstand (purpose)", a.zweck ?? "", (v) => setA({ ...a, zweck: v }), { platz: "any lawful business" })}
          {feld("Einlage (capital contribution)", a.einlage ?? "", (v) => setA({ ...a, einlage: v }), { platz: "USD 1,000 in cash" })}
          {feld("Vertrauensperson für den Ernstfall", a.nachfolger ?? "", (v) => setA({ ...a, nachfolger: v }), { platz: "the Member's personal representative" })}
        </div>
        <h4 className="gfo-h">IRS SS-4</h4>
        <div className="gst-felder zwei">
          {feld("Art des Geschäfts (Zeile 10)", s4.geschaeftsart ?? "", (v) => setA({ ...a, ss4: { ...s4, geschaeftsart: v } }), { platz: "Online retail" })}
          <label className="gst-feld"><span className="gst-label">Haupttätigkeit (Zeile 16)</span>
            <select value={s4.taetigkeit ?? ""} onChange={(e) => setA({ ...a, ss4: { ...s4, taetigkeit: e.target.value } })}>
              <option value="">— wählen —</option>{SS4_TAETIGKEITEN.map((t) => <option key={t.key} value={t.key}>{t.titel}</option>)}
            </select>
          </label>
          {s4.taetigkeit === "other" && feld("Other (specify)", s4.taetigkeitText ?? "", (v) => setA({ ...a, ss4: { ...s4, taetigkeitText: v } }))}
          {feld("Waren oder Leistungen (Zeile 17)", s4.leistungen ?? "", (v) => setA({ ...a, ss4: { ...s4, leistungen: v } }), { breit: true, platz: "Online retail of sporting goods" })}
          {feld("Fax des Designee (sonst FIAON_GLOBAL_FAX)", s4.designeeFax ?? "", (v) => setA({ ...a, ss4: { ...s4, designeeFax: v } }))}
        </div>
        <h4 className="gfo-h">IRS 8821</h4>
        <div className="gst-felder zwei">
          <label className="gst-haken"><input type="checkbox" checked={f8.aktiv !== false} onChange={(e) => setA({ ...a, irs8821: { ...f8, aktiv: e.target.checked } })} /> Dieses Mandat braucht ein 8821</label>
          {feld("Empfänger (leer = FIAON)", f8.name ?? "", (v) => setA({ ...a, irs8821: { ...f8, name: v } }), { hilfe: "z. B. Partner-CPA" })}
          {feld("Anschrift des Empfängers", f8.adresse ?? "", (v) => setA({ ...a, irs8821: { ...f8, adresse: v } }))}
          {feld("CAF-Nummer (leer = „None“)", f8.caf ?? "", (v) => setA({ ...a, irs8821: { ...f8, caf: v } }))}
          {feld("Formular (Zeile 3b)", f8.formular ?? "", (v) => setA({ ...a, irs8821: { ...f8, formular: v } }), { platz: "1120, 5472" })}
          {feld("Jahre (Zeile 3c)", f8.jahre ?? "", (v) => setA({ ...a, irs8821: { ...f8, jahre: v } }), { platz: "2026 through 2028" })}
        </div>
        <div className="gst-fuss"><div className="gst-knoepfe">
          <button type="button" className="gst-knopf gfo-haupt" disabled={laeuft} onClick={speichern} data-fiaon="formular-angaben-speichern">{laeuft ? "Speichert …" : "Angaben speichern"}</button>
        </div></div>
      </div>
    </section>
  );
}
