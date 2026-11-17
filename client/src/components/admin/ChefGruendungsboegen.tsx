// ═══════════════════════════════════════════════════════════════════════════
// /chef/s/gruendungsboegen — DIE GRÜNDUNGSBÖGEN (E-526, 17.11.2026)
//
// Für die Leitung: Liste der Bögen (Kennung, Wunschname, Status, Gesellschafter mit Status, angelegt am),
// Detail mit allen Angaben je Mitglied, Download von Reisepass und PDF, „gemeinsamen Link kopieren“,
// „Zugang erneut senden“, Zieladresse korrigieren, „Bogen schließen“, interne Notiz — und das Formular
// „Neuen Gründungsbogen anlegen“ (dieselbe Server-Funktion wie scripts/gruendungsbogen-anlegen.ts).
// Server: server/routes/fiaon-global-gruendungsbogen.ts (requireChef „leitung“ an jeder Route).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { API, Geruest, Fehlermeldung, useDaten, datum, datumZeit } from "./chef-teile";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "@/pages/agent/rundgaenge";
import {
  GB_KOSTEN_VORGABE, GB_MITGLIEDER_MAX, GB_MITGLIEDER_MIN, GB_RECHTSFORM, GB_UNTERSCHRIFT_TEXT, anlagePruefen, anteilText, gbStaatenZurWahl, gbStaatName,
  type GbAngaben, type GbGesellschaft, type GbStatus, type GbUnterschriftStatus,
} from "@shared/fiaon-global-gruendungsbogen";
import "@/styles/chef-gruendungsboegen.css";

const BASIS = "/chef/global/gruendungsboegen";

interface ListenZeile {
  id: number; kennung: string; status: GbStatus; statusText: string; wunschname: string; bundesstaat: string; fassung: number; angelegtAm: string; vollstaendigAm: string | null;
  mitglieder: { id: number; anzeigename: string; angabenVollstaendig: boolean; unterschrift: GbUnterschriftStatus }[];
}
interface DetailMitglied {
  id: number; reihenfolge: number; anzeigename: string; email: string; anteilVorgabe: number | null; angaben: GbAngaben; angabenAm: string | null;
  angabenFehlt: { feld: string; text: string }[]; reisepass: { name: string; typ: string; am: string } | null;
  unterschrift: { am: string; name: string; ort: string; ip: string; fassung: number; hash: string } | null;
  status: GbUnterschriftStatus; hatPdf: boolean; ueberholt: { am: string; fassung: number; hash: string; grund: string; ueberholtAm: string; name: string; ort: string }[];
  zugang: { zuletzt: string | null; anzahlImFenster: number; fensterAb: string | null };
}
interface Detail {
  ok: true; link: string;
  bogen: {
    id: number; kennung: string; status: GbStatus; statusText: string; gruss: string; kostenHinweis: string; bundesstaatVorgabe: string; fassung: number;
    gesellschaft: GbGesellschaft; wunschname: string; angelegtAm: string; angelegtVon: string | null; vollstaendigAm: string | null; gemeldetAm: string | null;
    geschlossenAm: string | null; geschlossenVon: string | null; notizIntern: string; geaendert: { am: string; von: string } | null;
    verlauf: { am: string; wer: string; was: string }[]; gesellschaftFehlt: { feld: string; text: string }[];
  };
  mitglieder: DetailMitglied[];
}

async function senden(pfad: string, body: unknown = {}): Promise<any> {
  const r = await fetch(`${API}${pfad}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok) throw Object.assign(new Error(j?.error || "Das hat nicht geklappt."), { feld: j?.feld });
  return j;
}
async function kopieren(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}
const tagDe = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : iso || "—");
const STATUS_KLASSE: Record<GbUnterschriftStatus, string> = { offen: "", unterschrieben: "gut", neu_noetig: "neu" };

function Marke({ s }: { s: GbUnterschriftStatus }) {
  return <span className={`gbc-marke ${STATUS_KLASSE[s]}`}>{GB_UNTERSCHRIFT_TEXT[s]}</span>;
}

// ── Anlegen ──────────────────────────────────────────────────────────────────
interface MitgliedEingabe { anzeigename: string; email: string; anteil: string }
function Anlegen({ onFertig }: { onFertig: (kennung: string) => void }) {
  const [gruss, setGruss] = useState("");
  const [kosten, setKosten] = useState(GB_KOSTEN_VORGABE);
  const [staat, setStaat] = useState("delaware");
  const [wunschname, setWunschname] = useState("");
  const [gegenstand, setGegenstand] = useState("");
  const [fuehrung, setFuehrung] = useState<"member" | "manager">("member");
  const [mitglieder, setMitglieder] = useState<MitgliedEingabe[]>([{ anzeigename: "", email: "", anteil: "50" }, { anzeigename: "", email: "", anteil: "50" }]);
  const [fehler, setFehler] = useState<{ feld: string | null; text: string } | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fertig, setFertig] = useState<{ kennung: string; link: string; kopiert: boolean } | null>(null);

  const eingabe = () => ({
    gruss, kostenHinweis: kosten, bundesstaat: staat, wunschname, gegenstand, fuehrung,
    mitglieder: mitglieder.map((m) => ({ anzeigename: m.anzeigename, email: m.email, anteil: m.anteil.replace(",", ".") })),
  });
  const summe = mitglieder.reduce((s, m) => s + Math.round(Number(m.anteil.replace(",", ".") || 0) * 100), 0) / 100;
  const absenden = async () => {
    const p = anlagePruefen(eingabe());
    if (!p.ok) { setFehler({ feld: p.feld, text: p.error }); return; }
    setFehler(null); setLaeuft(true);
    try {
      const j = await senden(BASIS, eingabe());
      const kopiert = await kopieren(String(j.link));
      setFertig({ kennung: String(j.kennung), link: String(j.link), kopiert });
      onFertig(String(j.kennung));
    } catch (e: any) { setFehler({ feld: e.feld ?? null, text: e.message }); }
    finally { setLaeuft(false); }
  };
  const aendern = (i: number, k: keyof MitgliedEingabe, v: string) => setMitglieder((ms) => ms.map((m, j) => (j === i ? { ...m, [k]: v } : m)));
  const F = (feld: string) => (fehler && (fehler.feld === feld || (feld === "mitglieder" && fehler.feld?.startsWith("mitglieder"))) ? <p className="gbc-fehler" role="alert">{fehler.text}</p> : null);

  if (fertig) {
    return (
      <section className="gbc-karte" aria-live="polite" data-fiaon="gruendungsbogen-angelegt">
        <h2>Angelegt: {fertig.kennung}</h2>
        <p className="gbc-leise">Gemeinsamer Link (90 Tage){fertig.kopiert ? " — schon in der Zwischenablage" : ""}:</p>
        <p className="gbc-link"><code>{fertig.link}</code></p>
        <p className="gbc-leise">Diesen Link schickst du den Gesellschaftern (z. B. per Mail aus js@ als Entwurf). Jeder fordert dort seinen persönlichen Zugang an.</p>
        <div className="gbc-leiste">
          <button type="button" className="gbc-knopf" onClick={() => void kopieren(fertig.link).then((k) => setFertig({ ...fertig, kopiert: k }))}>Link kopieren</button>
          <button type="button" className="gbc-knopf still" onClick={() => setFertig(null)}>Noch einen anlegen</button>
        </div>
      </section>
    );
  }
  return (
    <section className="gbc-karte" aria-labelledby="gbc-neu" data-fiaon="gruendungsbogen-anlegen">
      <h2 id="gbc-neu">Neuen Gründungsbogen anlegen</h2>
      <p className="gbc-leise">Zwei bis sechs Gesellschafter. Jeder bekommt seinen Zugang an seine eigene Adresse und unterschreibt selbst.</p>
      <div className="gbc-raster">
        <label className="gbc-feld breit">Anredezeile für die Seite <small>z. B. „Sehr geehrter Herr A, sehr geehrter Herr B“</small>
          <input value={gruss} onChange={(e) => setGruss(e.target.value)} maxLength={300} />{F("gruss")}
        </label>
        <label className="gbc-feld breit">Kostenhinweis
          <input value={kosten} onChange={(e) => setKosten(e.target.value)} maxLength={400} />
        </label>
        <label className="gbc-feld">Wunschname <small>ohne „{GB_RECHTSFORM}“</small>
          <input value={wunschname} onChange={(e) => setWunschname(e.target.value)} maxLength={80} />{F("wunschname")}
        </label>
        <label className="gbc-feld">Bundesstaat
          <select value={staat} onChange={(e) => setStaat(e.target.value)}>
            {gbStaatenZurWahl().map((s) => <option key={s.schluessel} value={s.schluessel}>{s.name}</option>)}
          </select>{F("bundesstaat")}
        </label>
        <label className="gbc-feld breit">Unternehmensgegenstand <small>Vorschlag — die Gesellschafter können ihn ändern</small>
          <textarea value={gegenstand} onChange={(e) => setGegenstand(e.target.value)} maxLength={600} />
        </label>
        <label className="gbc-feld">Führung
          <select value={fuehrung} onChange={(e) => setFuehrung(e.target.value === "manager" ? "manager" : "member")}>
            <option value="member">member-managed (Vorgabe)</option><option value="manager">manager-managed</option>
          </select>
        </label>
      </div>
      <h3 className="gbc-zwischen">Gesellschafter</h3>
      <div className="gbc-mitglieder">
        {mitglieder.map((m, i) => (
          <div key={i} className="gbc-mitglied-zeile">
            <label className="gbc-feld">Name <small>wie auf der Seite angezeigt</small>
              <input value={m.anzeigename} onChange={(e) => aendern(i, "anzeigename", e.target.value)} placeholder="Herr Max Muster" maxLength={120} />
            </label>
            <label className="gbc-feld">E-Mail <small>dorthin geht sein Zugang</small>
              <input type="email" value={m.email} onChange={(e) => aendern(i, "email", e.target.value)} maxLength={160} />
            </label>
            <label className="gbc-feld schmal">Anteil %
              <input inputMode="decimal" value={m.anteil} onChange={(e) => aendern(i, "anteil", e.target.value)} />
            </label>
            {mitglieder.length > GB_MITGLIEDER_MIN && <button type="button" className="gbc-klein" onClick={() => setMitglieder((ms) => ms.filter((_, j) => j !== i))} aria-label={`Gesellschafter ${i + 1} entfernen`}>Entfernen</button>}
          </div>
        ))}
      </div>
      <p className={`gbc-summe${Math.round(summe * 100) === 10000 ? "" : " falsch"}`}>Zusammen: {anteilText(summe)}</p>
      {F("mitglieder")}
      <div className="gbc-leiste">
        {mitglieder.length < GB_MITGLIEDER_MAX && <button type="button" className="gbc-knopf still" onClick={() => setMitglieder((ms) => [...ms, { anzeigename: "", email: "", anteil: "" }])}>+ Gesellschafter</button>}
        <button type="button" className="gbc-knopf" onClick={() => void absenden()} disabled={laeuft} data-fiaon="gruendungsbogen-anlegen-knopf">{laeuft ? "Legt an …" : "Gründungsbogen anlegen"}</button>
      </div>
      {fehler && !fehler.feld && <p className="gbc-fehler" role="alert">{fehler.text}</p>}
    </section>
  );
}

// ── Detail ───────────────────────────────────────────────────────────────────
function Angaben({ a, email }: { a: GbAngaben; email: string }) {
  const [usZeigen, setUsZeigen] = useState(false);
  const z: [string, string][] = [
    ["Name laut Reisepass", [a.anrede, a.vornamen, a.nachname].filter(Boolean).join(" ")],
    ["Geburtsdatum / -ort", [tagDe(a.geburtsdatum), a.geburtsort].filter((x) => x && x !== "—").join(" · ")],
    ["Staatsangehörigkeit", a.staatsangehoerigkeit],
    ["Wohnanschrift", [a.strasse, [a.plz, a.ort].filter(Boolean).join(" "), a.land].filter(Boolean).join(", ")],
    ["Steuerlich ansässig", a.steuerAnsaessig],
    ["Kontakt", [email, a.kontaktEmail, a.telefon].filter(Boolean).join(" · ")],
    ["Reisepass", [a.passNummer, a.passStaat, a.passGueltigBis ? `gültig bis ${tagDe(a.passGueltigBis)}` : ""].filter(Boolean).join(" · ")],
  ];
  return (
    <dl className="gbc-dl">
      {z.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || "—"}</dd></div>)}
      <div><dt>US-Steuernummer</dt><dd>
        {a.usSteuernummerVorhanden === true ? (
          <>{usZeigen ? a.usSteuernummer : `•••-••-${a.usSteuernummer.slice(-4)}`} <button type="button" className="gbc-textknopf" onClick={() => setUsZeigen(!usZeigen)}>{usZeigen ? "verbergen" : "anzeigen"}</button></>
        ) : a.usSteuernummerVorhanden === false ? "keine" : "—"}
      </dd></div>
    </dl>
  );
}

function DetailAnsicht({ kennung, zurueck, melden }: { kennung: string; zurueck: () => void; melden: (t: string) => void }) {
  const d = useDaten<Detail>(`${BASIS}/${encodeURIComponent(kennung)}`, [kennung]);
  const [notiz, setNotiz] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [emailEdit, setEmailEdit] = useState<{ id: number; wert: string } | null>(null);
  useEffect(() => { setNotiz(null); }, [kennung]);
  const x = d.daten;

  const tun = async (schluessel: string, pfad: string, body: unknown, erfolg: (j: any) => string, bestaetigen?: string) => {
    if (bestaetigen && !window.confirm(bestaetigen)) return;
    setLaeuft(schluessel);
    try { const j = await senden(pfad, body); melden(erfolg(j)); d.neu(); }
    catch (e: any) { melden(e.message); } finally { setLaeuft(null); }
  };

  if (d.laedt && !x) return <Geruest zeilen={8} />;
  if (d.fehler) return <Fehlermeldung text={d.fehler} erneut={d.neu} />;
  if (!x) return null;
  const b = x.bogen; const g = b.gesellschaft;
  const nameVon = (id: number | null) => x.mitglieder.find((m) => m.id === id)?.anzeigename ?? "—";
  const pfad = `${BASIS}/${b.id}`;

  return (
    <div className="gbc-detail" data-fiaon="gruendungsbogen-detail">
      <button type="button" className="gbc-textknopf" onClick={zurueck}>← Alle Gründungsbögen</button>
      <header className="gbc-kopf">
        <div>
          <p className="gbc-auge">{b.kennung} · Fassung {b.fassung}</p>
          <h1>{b.wunschname}</h1>
          <p className="gbc-leise">{gbStaatName(g.bundesstaat)} · {b.statusText} · angelegt {datumZeit(b.angelegtAm)}{b.angelegtVon ? ` von ${b.angelegtVon}` : ""}</p>
        </div>
        <div className="gbc-leiste">
          <button type="button" className="gbc-knopf" disabled={laeuft === "link"} onClick={() => void (async () => {
            setLaeuft("link");
            try { const j = await senden(`${pfad}/link`); melden((await kopieren(j.link)) ? "Gemeinsamer Link kopiert (90 Tage gültig)." : `Gemeinsamer Link: ${j.link}`); }
            catch (e: any) { melden(e.message); } finally { setLaeuft(null); }
          })()} data-fiaon="gruendungsbogen-link-kopieren">Gemeinsamen Link kopieren</button>
          {b.status !== "geschlossen" && (
            <button type="button" className="gbc-knopf still" disabled={!!laeuft} onClick={() => void tun("schliessen", `${pfad}/schliessen`, {}, () => "Bogen geschlossen.", `Gründungsbogen ${b.kennung} schließen?\n\nDanach kann niemand mehr Angaben ändern oder unterschreiben. Nichts wird gelöscht.`)}>Bogen schließen</button>
          )}
        </div>
      </header>

      {b.status === "vollstaendig" && !b.gemeldetAm && (
        <div className="gbc-hinweis warn">Alle haben unterschrieben, aber die Aufgabe an das Team fehlt noch.
          <button type="button" className="gbc-knopf" disabled={!!laeuft} onClick={() => void tun("melden", `${pfad}/melden`, {}, (j) => j.meldung || "Gemeldet.")}>Aufgabe jetzt anlegen</button>
        </div>
      )}
      {b.status === "vollstaendig" && b.gemeldetAm && <div className="gbc-hinweis gut">Alle haben am {datumZeit(b.vollstaendigAm)} unterschrieben. Aufgabe angelegt und Leitung informiert am {datumZeit(b.gemeldetAm)}.</div>}
      {b.status === "geschlossen" && <div className="gbc-hinweis">Geschlossen am {datumZeit(b.geschlossenAm)}{b.geschlossenVon ? ` von ${b.geschlossenVon}` : ""}.</div>}

      <section className="gbc-karte">
        <h2>Gemeinsame Angaben</h2>
        {b.geaendert && <p className="gbc-leise">Zuletzt geändert von {b.geaendert.von} am {datumZeit(b.geaendert.am)}.</p>}
        <dl className="gbc-dl">
          <div><dt>Wunschname</dt><dd>{g.wunschname1 ? `${g.wunschname1} ${GB_RECHTSFORM}` : "—"}</dd></div>
          <div><dt>Ausweichnamen</dt><dd>{[g.wunschname2, g.wunschname3].filter(Boolean).map((n) => `${n} ${GB_RECHTSFORM}`).join(" · ") || "—"}</dd></div>
          <div><dt>Bundesstaat</dt><dd>{gbStaatName(g.bundesstaat)} <span className="gbc-leise">(Vorgabe: {b.bundesstaatVorgabe})</span></dd></div>
          <div><dt>Gegenstand</dt><dd>{g.gegenstand || "—"}</dd></div>
          <div><dt>Führung</dt><dd>{g.fuehrung === "manager" ? `manager-managed: ${g.manager.map(nameVon).join(", ") || "—"}` : "member-managed"}</dd></div>
          <div><dt>Anteile</dt><dd>{x.mitglieder.map((m) => `${m.anzeigename} ${anteilText(Number(g.anteile[String(m.id)] ?? 0))}`).join(" · ")}</dd></div>
          <div><dt>Responsible Party</dt><dd>{nameVon(g.responsibleParty)}</dd></div>
          <div><dt>Website</dt><dd>{g.website || "—"}</dd></div>
          <div><dt>Anmerkungen</dt><dd>{g.anmerkungen || "—"}</dd></div>
          <div><dt>Anrede / Kosten</dt><dd>{b.gruss} · {b.kostenHinweis}</dd></div>
        </dl>
        {b.gesellschaftFehlt.length > 0 && <p className="gbc-leise">Noch offen: {b.gesellschaftFehlt.map((f) => f.text).join(" ")}</p>}
      </section>

      {x.mitglieder.map((m) => (
        <section key={m.id} className="gbc-karte" data-fiaon="gruendungsbogen-mitglied">
          <div className="gbc-mkopf">
            <h2>{m.anzeigename}</h2>
            <span className="gbc-marken"><span className={`gbc-marke ${m.angabenFehlt.length ? "" : "gut"}`}>{m.angabenFehlt.length ? "Angaben offen" : "Angaben vollständig"}</span><Marke s={m.status} /></span>
          </div>
          <div className="gbc-mzeile">
            {emailEdit?.id === m.id ? (
              <span className="gbc-inline">
                <input type="email" value={emailEdit.wert} onChange={(e) => setEmailEdit({ id: m.id, wert: e.target.value })} aria-label="Neue Zieladresse" />
                <button type="button" className="gbc-knopf" disabled={!!laeuft} onClick={() => void tun(`e${m.id}`, `${pfad}/mitglied/${m.id}/email`, { email: emailEdit.wert }, () => { setEmailEdit(null); return "Zieladresse geändert."; })}>Speichern</button>
                <button type="button" className="gbc-klein" onClick={() => setEmailEdit(null)}>Abbrechen</button>
              </span>
            ) : (
              <span>Zugang an <b>{m.email}</b> {b.status !== "geschlossen" && <button type="button" className="gbc-textknopf" onClick={() => setEmailEdit({ id: m.id, wert: m.email })}>ändern</button>}</span>
            )}
            <span className="gbc-leise">{m.zugang.zuletzt ? `zuletzt angefordert ${datumZeit(m.zugang.zuletzt)}` : "noch nie angefordert"}</span>
          </div>
          <div className="gbc-leiste">
            {b.status !== "geschlossen" && (
              <button type="button" className="gbc-knopf still" disabled={!!laeuft} onClick={() => void tun(`z${m.id}`, `${pfad}/mitglied/${m.id}/zugang`, {}, (j) => `Zugang an ${j.an} gesendet.`, `Persönlichen Zugang an ${m.anzeigename} (${m.email}) senden?`)} data-fiaon="gruendungsbogen-zugang-erneut">
                {laeuft === `z${m.id}` ? "Sendet …" : "Zugang erneut senden"}
              </button>
            )}
            {m.reisepass && <a className="gbc-knopf still" href={`${API}${pfad}/mitglied/${m.id}/reisepass`}>Reisepass ({m.reisepass.typ.replace(/^.*\//, "").toUpperCase()})</a>}
            {m.hatPdf && <a className="gbc-knopf still" href={`${API}${pfad}/mitglied/${m.id}/pdf`}>Unterschriebenes PDF</a>}
          </div>
          <Angaben a={m.angaben} email={m.email} />
          {m.angabenFehlt.length > 0 && <p className="gbc-leise">Fehlt: {m.angabenFehlt.map((f) => f.text).join(" ")}</p>}
          {m.unterschrift && (
            <p className="gbc-leise">Unterschrift: {m.unterschrift.name}, {m.unterschrift.ort}, {datumZeit(m.unterschrift.am)} · Fassung {m.unterschrift.fassung} · IP {m.unterschrift.ip} · <code>{m.unterschrift.hash.slice(0, 20)}…</code></p>
          )}
          {m.ueberholt.length > 0 && (
            <details className="gbc-ueberholt"><summary>{m.ueberholt.length} überholte Unterschrift{m.ueberholt.length === 1 ? "" : "en"}</summary>
              <ul>{m.ueberholt.map((u, i) => <li key={i}>{datumZeit(u.am)} (Fassung {u.fassung}) — überholt {datumZeit(u.ueberholtAm)}: {u.grund}</li>)}</ul>
            </details>
          )}
        </section>
      ))}

      <section className="gbc-karte">
        <h2>Interne Notiz</h2>
        <textarea className="gbc-notiz" value={notiz ?? b.notizIntern} onChange={(e) => setNotiz(e.target.value)} maxLength={4000} aria-label="Interne Notiz" />
        <div className="gbc-leiste">
          <button type="button" className="gbc-knopf" disabled={notiz === null || !!laeuft} onClick={() => void tun("notiz", `${pfad}/notiz`, { notiz }, () => { setNotiz(null); return "Notiz gespeichert."; })}>Notiz speichern</button>
        </div>
      </section>

      <section className="gbc-karte">
        <h2>Verlauf</h2>
        <ul className="gbc-verlauf">{b.verlauf.map((v, i) => <li key={i}><span className="gbc-leise">{datumZeit(v.am)} · {v.wer}</span> {v.was}</li>)}</ul>
      </section>
    </div>
  );
}

// ── Die Seite ────────────────────────────────────────────────────────────────
export default function ChefGruendungsboegen() {
  const [auswahl, setAuswahl] = useState<string | null>(() => {
    try { return new URL(window.location.href).searchParams.get("bogen"); } catch { return null; }
  });
  const [neu, setNeu] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const liste = useDaten<{ ok: true; boegen: ListenZeile[] }>(auswahl ? null : BASIS, [auswahl]);

  const waehlen = (k: string | null) => {
    setAuswahl(k);
    try {
      const u = new URL(window.location.href);
      if (k) u.searchParams.set("bogen", k); else u.searchParams.delete("bogen");
      window.history.replaceState(null, "", u.pathname + u.search);
    } catch { /* Adresse bleibt */ }
    window.scrollTo({ top: 0 });
  };
  const melden = (t: string) => { setMeldung(t); window.setTimeout(() => setMeldung(null), 7000); };

  return (
    <div className="gbc" data-fiaon="gruendungsboegen">
      <Rundgang raum="gruendungsboegen" titel="Gründungsbögen" schritte={RUNDGAENGE.gruendungsboegen.schritte} />
      {auswahl ? (
        <DetailAnsicht kennung={auswahl} zurueck={() => waehlen(null)} melden={melden} />
      ) : (
        <>
          <header className="gbc-kopf">
            <div>
              <h1>Gründungsbögen</h1>
              <p className="gbc-leise">Mehrere Gesellschafter gründen gemeinsam — jeder macht seine Angaben und unterschreibt selbst.</p>
            </div>
            <button type="button" className="gbc-knopf" onClick={() => setNeu(!neu)} aria-expanded={neu} data-fiaon="gruendungsbogen-neu">{neu ? "Formular schließen" : "Neuen Gründungsbogen anlegen"}</button>
          </header>
          {neu && <Anlegen onFertig={() => liste.neu()} />}
          {liste.laedt && !liste.daten && <Geruest zeilen={5} />}
          {liste.fehler && <Fehlermeldung text={liste.fehler} erneut={liste.neu} />}
          {liste.daten && (liste.daten.boegen.length === 0 ? (
            <p className="gbc-leer">Noch kein Gründungsbogen. Lege oben den ersten an — oder per Skript: <code>npx tsx scripts/gruendungsbogen-anlegen.ts &lt;datei.json&gt;</code>.</p>
          ) : (
            <div className="gbc-tabelle-huelle">
              <table className="gbc-tabelle">
                <thead><tr><th>Kennung</th><th>Gesellschaft</th><th>Status</th><th>Gesellschafter</th><th>Angelegt</th></tr></thead>
                <tbody>
                  {liste.daten.boegen.map((z) => (
                    <tr key={z.id} onClick={() => waehlen(z.kennung)} tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") waehlen(z.kennung); }} data-fiaon="gruendungsbogen-zeile">
                      <td><b>{z.kennung}</b></td>
                      <td>{z.wunschname}<span className="gbc-leise"> · {z.bundesstaat}</span></td>
                      <td>{z.statusText}</td>
                      <td><span className="gbc-marken">{z.mitglieder.map((m) => <span key={m.id} className={`gbc-marke ${STATUS_KLASSE[m.unterschrift]}`} title={`${m.anzeigename}: ${m.angabenVollstaendig ? "Angaben vollständig" : "Angaben offen"}, ${GB_UNTERSCHRIFT_TEXT[m.unterschrift]}`}>{m.anzeigename}</span>)}</span></td>
                      <td className="gbc-leise">{datum(z.angelegtAm)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}
      {meldung && <div className="gbc-meldung" role="status">{meldung}</div>}
    </div>
  );
}
