// ═══════════════════════════════════════════════════════════════════════════
// /agent/inbox — Raum „Inbox" (23.08.2026, Plan §4/§11)
//
// Die Mail-Zentrale (client/src/pages/mail-zentrale.tsx) nativ im Office,
// alle Funktionen 1:1, plus Postfach-Liste und Verlauf je Kunde:
//   Links  – Postfach: GET /agent/inbox/gesendet (eigener Router
//            server/routes/fiaon-office-inbox.ts), Suche, Zeitraum, Seiten
//   Rechts – Schreiben: GET {basis}/gruppen, GET {basis}/suche?q=,
//            POST {basis}/vorschau, POST {basis}/senden, POST {basis}/test,
//            POST {basis}/ki (Entwurf, Ton glätten, Kürzen, Rückgängig)
//          – Kunde: GET /agent/mail/:personId (Vorlagen + Verlauf),
//            POST /agent/mail/:personId/:event (Vorlage senden), Antworten
//            = neue Mail an diesen Kunden, Akte-Link.
// basis = /api/fiaon/mail/zentrale (unter /admin/ wie bisher die Admin-Fassung).
// Am Handy: Liste → Detail als zwei Ebenen. Bausteine füllt der Server je
// Empfänger – deshalb keine Ersetzung im Browser.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { Mail, PenLine, Search, X, ChevronLeft, Sparkles, Users, Reply, Check, FolderOpen } from "lucide-react";
import { AgentShell, api, fmtDT, useAgentInfo, useFragen } from "./shared";
import { useOffice } from "./OfficeShell";
import "@/styles/office-inbox.css";

interface Treffer { personId: number | null; name: string; email: string; extern: boolean }
interface Gruppe { schluessel: string; titel: string; anzahl: number }
interface Baustein { marke: string; titel: string; erklaerung: string }
interface Gesendet { id: number; event: string; titel: string; betreff: string | null; status: string; grund: string | null; zustellung: string | null; zustellung_am: string | null; empfaenger: string | null; person_id: number | null; name: string | null; created_at: string }
type Meldung = { art: "gut" | "schlecht"; text: string } | null;
const MAIL_RE = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;

export default function AgentInboxPage() { return <AgentShell><InboxInnen /></AgentShell>; }

function InboxInnen() {
  const { dunkel, titel } = useOffice();
  useEffect(() => { dunkel(true); titel("Inbox"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const { agent } = useAgentInfo();
  const alsAdmin = typeof window !== "undefined" && window.location.pathname.startsWith("/admin/");
  const basis = alsAdmin ? "/api/fiaon/admin/mail/zentrale" : "/api/fiaon/mail/zentrale";

  // Rechte Spalte: schreiben oder Kunde. Am Handy zusätzlich: Liste oder Detail.
  const [ansicht, setAnsicht] = useState<{ art: "schreiben" } | { art: "kunde"; personId: number; name: string; email: string | null }>({ art: "schreiben" });
  const [ebene, setEbene] = useState<"liste" | "detail">("detail");
  const [vorbelegt, setVorbelegt] = useState<Treffer | null>(null);
  const [gesendetStand, setGesendetStand] = useState(0);

  const antworten = (personId: number | null, name: string, email: string | null) => {
    if (email) setVorbelegt({ personId, name, email, extern: !personId });
    setAnsicht({ art: "schreiben" }); setEbene("detail");
  };
  const kundeOeffnen = (personId: number, name: string, email: string | null) => { setAnsicht({ art: "kunde", personId, name, email }); setEbene("detail"); };

  return (
    <div className="in">
      <section className="in-kopf">
        <div>
          <span className="in-pille">Inbox · Mail-Zentrale</span>
          <h1>Schreiben, <span className="in-verlauf">senden</span>, nachsehen.</h1>
          <p>Kunden suchen, schreiben, senden – Bausteine füllt der Server je Empfänger einzeln. Links dein Postfach, rechts die Mail oder der Verlauf eines Kunden.</p>
        </div>
        <button type="button" className="in-knopf" onClick={() => { setVorbelegt(null); setAnsicht({ art: "schreiben" }); setEbene("detail"); }}><PenLine size={16} strokeWidth={1.75} /> Neue Mail</button>
      </section>

      <div className={`in-grund ebene-${ebene}`}>
        <aside className="in-spalte in-links">
          <Postfach stand={gesendetStand} aktiv={ansicht.art === "kunde" ? ansicht.personId : null} onKunde={kundeOeffnen} onAntworten={antworten} />
        </aside>
        <section className="in-spalte in-rechts">
          <button type="button" className="in-link in-zurueck" onClick={() => setEbene("liste")} style={{ marginBottom: 10 }}><ChevronLeft size={16} /> Zum Postfach</button>
          {ansicht.art === "schreiben"
            ? <Schreiben basis={basis} vorbelegt={vorbelegt} onVorbelegt={() => setVorbelegt(null)} onGesendet={() => setGesendetStand((n) => n + 1)} />
            : <Kunde personId={ansicht.personId} name={ansicht.name} email={ansicht.email} rolle={agent?.rolle} onAntworten={antworten} onGesendet={() => setGesendetStand((n) => n + 1)} />}
        </section>
      </div>
    </div>
  );
}

// ── Postfach: was du geschickt hast ────────────────────────────────────────
function Postfach({ stand, aktiv, onKunde, onAntworten }: { stand: number; aktiv: number | null; onKunde: (personId: number, name: string, email: string | null) => void; onAntworten: (personId: number | null, name: string, email: string | null) => void }) {
  const [zeilen, setZeilen] = useState<Gesendet[] | null>(null);
  const [zustellText, setZustellText] = useState<Record<string, string>>({});
  const [suche, setSuche] = useState("");
  const [tage, setTage] = useState(30);
  const [seite, setSeite] = useState(0);
  const [fehler, setFehler] = useState<string | null>(null);
  const [mehr, setMehr] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      api(`/agent/inbox/gesendet?tage=${tage}&seite=${seite}&suche=${encodeURIComponent(suche)}`).then((r) => {
        if (!r.ok) { setFehler(r.status === 404 ? "Die Postfach-Route ist noch nicht eingehängt (server/routes/fiaon-office-inbox.ts)." : r.json?.error || "Postfach konnte nicht geladen werden."); setZeilen([]); return; }
        setFehler(null); setZustellText(r.json.zustellText || {}); setMehr(r.json.zeilen.length >= r.json.proSeite);
        setZeilen((alt) => seite > 0 && alt ? [...alt, ...r.json.zeilen] : r.json.zeilen);
      }).catch(() => { setFehler("Keine Verbindung."); setZeilen([]); });
    }, 180);
    return () => clearTimeout(t);
  }, [suche, tage, seite, stand]);
  return (
    <>
      <div className="in-spalte-kopf"><b><Mail size={16} strokeWidth={1.75} style={{ verticalAlign: -3, marginRight: 8, color: "#93c5fd" }} />Postfach · Gesendet</b><small>{zeilen ? `${zeilen.length}${mehr ? "+" : ""} Mails` : ""}</small></div>
      <div className="in-suche"><input className="in-feld" value={suche} onChange={(e) => { setSuche(e.target.value); setSeite(0); }} placeholder="Name, Adresse oder Betreff …" aria-label="Postfach durchsuchen" /></div>
      <div className="in-wahl" style={{ marginBottom: 10 }}>{[[7, "7 Tage"], [30, "30 Tage"], [90, "90 Tage"]].map(([n, l]) => <button key={n} type="button" className={tage === n ? "an" : ""} onClick={() => { setTage(n as number); setSeite(0); }}>{l}</button>)}</div>
      {fehler && <p className="in-fehler">{fehler}</p>}
      {zeilen === null && <p className="in-laedt">Lade …</p>}
      {zeilen && zeilen.length === 0 && !fehler && <p className="in-leer">Noch nichts verschickt{suche ? " zu dieser Suche" : " in diesem Zeitraum"}. Schreib die erste Mail – rechts.</p>}
      <div className="in-liste">
        {zeilen?.map((z) => {
          const gut = z.status === "versandt" && !["gebounct", "blockiert", "spam", "fehler"].includes(String(z.zustellung));
          const stand = z.status !== "versandt" ? `nicht verschickt${z.grund ? ` – ${z.grund}` : ""}` : z.zustellung ? (zustellText[z.zustellung] ?? z.zustellung) : "versandt";
          return (
            <button key={z.id} type="button" className={`in-eintrag${aktiv != null && aktiv === z.person_id ? " an" : ""}`} onClick={() => z.person_id ? onKunde(z.person_id, z.name || z.empfaenger || "Kunde", z.empfaenger) : onAntworten(null, z.empfaenger || "", z.empfaenger)}>
              <span className="wer">{z.name || z.empfaenger || "—"}</span><span className="wann">{fmtDT(z.created_at)}</span>
              <span className="was">{z.betreff || z.titel}</span>
              <span className={`stand ${gut ? "gut" : z.status !== "versandt" || ["gebounct", "blockiert", "spam", "fehler"].includes(String(z.zustellung)) ? "schlecht" : ""}`}>{z.titel} · {stand}</span>
            </button>
          );
        })}
      </div>
      {mehr && <button type="button" className="in-link in-mehr" onClick={() => setSeite((s) => s + 1)}>Ältere laden</button>}
    </>
  );
}

// ── Kunde: Vorlagen (Standardmails) und Verlauf ────────────────────────────
function Kunde({ personId, name, email, rolle, onAntworten, onGesendet }: { personId: number; name: string; email: string | null; rolle?: string; onAntworten: (personId: number | null, name: string, email: string | null) => void; onGesendet: () => void }) {
  const fragen = useFragen();
  const [daten, setDaten] = useState<{ events: any[]; historie: any[]; zustellText?: Record<string, string> } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<Meldung>(null);
  const laden = useCallback(async () => {
    setFehler(null);
    const r = await fetch(`/api/fiaon/agent/mail/${personId}`, { credentials: "include" }).catch(() => null);
    if (!r) { setFehler("Keine Verbindung zum Server."); return; }
    const j = await r.json().catch(() => null);
    if (j?.ok) { setDaten({ events: j.events || [], historie: j.historie || [], zustellText: j.zustellText }); return; }
    setFehler(j?.error ? `${j.error} (Antwort ${r.status})` : `Der Server antwortete mit ${r.status}.`);
  }, [personId]);
  useEffect(() => { setDaten(null); setMeldung(null); void laden(); }, [laden]);
  const senden = async (e: any) => {
    if (!(await fragen({ titel: `„${e.label}" jetzt an ${name} schicken?`, text: e.klartext, ja: "Senden" }))) return;
    setBusy(e.type);
    const r = await fetch(`/api/fiaon/agent/mail/${personId}/${e.type}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => null);
    const j = await r?.json().catch(() => null); setBusy(null);
    setMeldung({ art: j?.ok ? "gut" : "schlecht", text: j?.meldung || j?.error || "Unbekannter Fehler." });
    void laden(); onGesendet();
  };
  const gruppen = new Map<string, any[]>(); for (const e of daten?.events || []) gruppen.set(e.gruppe, [...(gruppen.get(e.gruppe) || []), e]);
  const GRUPPEN: Record<string, string> = { zahlung: "Zahlung", termin: "Termin", konto: "Konto", dokumente: "Dokumente", lead: "Lead" };
  return (
    <>
      <div className="in-kunde-kopf">
        <div style={{ flex: 1, minWidth: 0 }}><b>{name}</b>{email && <span style={{ display: "block", marginTop: 4 }}>{email}</span>}</div>
        <button type="button" className="in-knopf klein" onClick={() => onAntworten(personId, name, email)}><Reply size={14} strokeWidth={1.75} /> Antworten</button>
        {rolle !== "inkasso" && <Link href={`/agent/kunden?person=${personId}`} className="in-knopf still klein"><FolderOpen size={14} strokeWidth={1.75} /> Akte</Link>}
      </div>
      {meldung && <p className={`in-meldung ${meldung.art === "schlecht" ? "schlecht" : ""}`}>{meldung.text}</p>}
      {fehler && <p className="in-fehler">{fehler} <button type="button" className="in-link" onClick={() => void laden()}>Erneut</button></p>}
      {!daten && !fehler && <p className="in-laedt">Lade Vorlagen und Verlauf …</p>}
      {daten && (
        <>
          <div className="in-block">
            <p className="titel">Vorlagen – Standardmails an diesen Kunden</p>
            {daten.events.length === 0 && <p className="in-leer">Für diesen Kunden gibt es gerade keine Standardmail.</p>}
            {Array.from(gruppen.entries()).map(([g, liste]) => (
              <div key={g} style={{ marginBottom: 10 }}>
                <p className="in-hinweis" style={{ marginBottom: 6 }}>{GRUPPEN[g] ?? g}</p>
                <div className="in-vorlagen">{liste.map((e: any) => (
                  <div key={e.type} className="in-vorlage">
                    <b>{e.label}</b>
                    <button type="button" className="in-knopf klein" disabled={!e.erlaubt || busy === e.type} onClick={() => void senden(e)}>{busy === e.type ? "…" : "Senden"}</button>
                    <small>{e.klartext}{e.heute > 0 ? ` · heute ${e.heute}×` : ""}{e.verifikationsText ? ` · ${e.verifikationsText}` : ""}</small>
                    {!e.erlaubt && e.grund && <small className="grund">{e.grund}</small>}
                  </div>
                ))}</div>
              </div>
            ))}
          </div>
          <div className="in-block">
            <p className="titel">Verlauf – was dieser Kunde bekommen hat</p>
            {daten.historie.length === 0 && <p className="in-leer">Noch keine Mail an diesen Kunden.</p>}
            {daten.historie.map((h: any) => (
              <div key={h.id} className="in-verlauf-zeile">
                <b>{h.titel}</b><span className="wann">{fmtDT(h.am)}</span>
                <small className={h.status !== "versandt" ? "schlecht" : ""}>{h.status === "versandt" ? (h.zustellung ? (daten.zustellText?.[h.zustellung] ?? h.zustellung) : "versandt") : `${h.status}${h.grund ? ` – ${h.grund}` : ""}`} · {h.ausgeloestVon}{h.empfaenger ? ` · ${h.empfaenger}` : ""}</small>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

// ── Schreiben: die Mail-Zentrale ───────────────────────────────────────────
function Schreiben({ basis, vorbelegt, onVorbelegt, onGesendet }: { basis: string; vorbelegt: Treffer | null; onVorbelegt: () => void; onGesendet: () => void }) {
  const [suche, setSuche] = useState("");
  const [treffer, setTreffer] = useState<Treffer[]>([]);
  const [gewaehlt, setGewaehlt] = useState<Treffer[]>([]);
  const [gruppen, setGruppen] = useState<Gruppe[]>([]);
  const [aktiveGruppen, setAktiveGruppen] = useState<string[]>([]);
  const [bausteine, setBausteine] = useState<Baustein[]>([]);
  const [maxEmpfaenger, setMaxEmpfaenger] = useState(10);
  const [betreff, setBetreff] = useState("");
  const [text, setText] = useState("");
  const [vorschau, setVorschau] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<Meldung>(null);
  const [gruppenWahl, setGruppenWahl] = useState(false);
  const [ergebnis, setErgebnis] = useState<any>(null);
  const [kiFehler, setKiFehler] = useState<string | null>(null);
  const [zurueck, setZurueck] = useState<{ betreff: string; text: string } | null>(null);
  const [eingefuegt, setEingefuegt] = useState(false);
  const [feldHinweis, setFeldHinweis] = useState<string | null>(null);
  const feld = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch(`${basis}/gruppen`, { credentials: "include" }).then((r) => r.json()).then((j) => {
      if (!j?.ok) { setFeldHinweis(j?.error || "Gruppen und Textbausteine konnten nicht geladen werden. Bitte die Seite neu laden."); return; }
      setGruppen(j.gruppen || []); setBausteine(j.bausteine || []); setMaxEmpfaenger(j.maxEmpfaenger || 10);
    }).catch(() => {});
  }, [basis]);
  // Antworten / „Neue Mail an": Empfänger als Chip übernehmen.
  useEffect(() => { if (!vorbelegt) return; setGewaehlt((l) => l.some((x) => x.email.toLowerCase() === vorbelegt.email.toLowerCase()) ? l : [...l, vorbelegt]); onVorbelegt(); }, [vorbelegt]); // eslint-disable-line react-hooks/exhaustive-deps
  // Autocomplete ab dem ersten Zeichen.
  useEffect(() => {
    if (suche.trim().length < 1) { setTreffer([]); return; }
    const t = setTimeout(() => { fetch(`${basis}/suche?q=${encodeURIComponent(suche)}`, { credentials: "include" }).then((r) => r.json()).then((j) => setTreffer(j?.ok ? j.treffer : [])).catch(() => {}); }, 180);
    return () => clearTimeout(t);
  }, [suche, basis]);

  const auswahl = useCallback(() => ({ personIds: gewaehlt.filter((g) => g.personId).map((g) => g.personId!), gruppen: aktiveGruppen, extern: gewaehlt.filter((g) => g.extern && !g.personId).map((g) => g.email) }), [gewaehlt, aktiveGruppen]);
  const gewaehltGesamt = gewaehlt.length + aktiveGruppen.reduce((s, g) => s + (gruppen.find((x) => x.schluessel === g)?.anzahl ?? 0), 0);

  const bausteinEinfuegen = (marke: string) => {
    const el = feld.current; if (!el) { setText((t) => `${t}${marke}`); return; }
    const a = el.selectionStart ?? text.length; setText(`${text.slice(0, a)}${marke}${text.slice(el.selectionEnd ?? a)}`);
    setTimeout(() => { el.focus(); el.setSelectionRange(a + marke.length, a + marke.length); }, 0);
  };
  // Getippte Adresse als Chip übernehmen (Enter, Komma, Verlassen, Senden).
  const adresseUebernehmen = (still = false): boolean => {
    const wert = suche.trim().replace(/[,;]+$/, ""); if (!wert) return true;
    if (!MAIL_RE.test(wert)) {
      if (!still || wert.includes("@")) setFeldHinweis(wert.includes("@") ? `„${wert}" ist keine vollständige E-Mail-Adresse. Es fehlt etwas nach dem Punkt.` : `„${wert}" ist weder ein Treffer noch eine E-Mail-Adresse. Wähle einen Kunden aus der Liste oder tippe eine vollständige Adresse.`);
      return false;
    }
    setGewaehlt((l) => l.some((x) => x.email.toLowerCase() === wert.toLowerCase()) ? l : [...l, { personId: null, email: wert, name: wert, extern: true }]);
    setSuche(""); setTreffer([]); setFeldHinweis(null); return true;
  };
  const vorschauHolen = async () => {
    if (!adresseUebernehmen()) return;
    setBusy("vorschau");
    const r = await fetch(`${basis}/vorschau`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auswahl(), betreff, text }) }).catch(() => null);
    const j = await r?.json().catch(() => null); setBusy(null);
    if (!j?.ok) { setMeldung({ art: "schlecht", text: j?.error || "Vorschau nicht möglich." }); return; }
    setVorschau(j);
  };
  const senden = async () => {
    setBusy("senden");
    const r = await fetch(`${basis}/senden`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auswahl(), betreff, text, merkmal: vorschau?.merkmal }) }).catch(() => null);
    const j = await r?.json().catch(() => null); setBusy(null);
    setMeldung({ art: j?.ok && !j?.fehlgeschlagen ? "gut" : "schlecht", text: j?.meldung || j?.error || "Unbekannter Fehler." });
    setErgebnis(j?.ergebnisse?.length ? j : null);
    if (j?.ok) { setVorschau(null); setText(""); setBetreff(""); setGewaehlt([]); setAktiveGruppen([]); onGesendet(); }
  };
  const test = async () => {
    setBusy("test");
    const r = await fetch(`${basis}/test`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ betreff, text }) }).catch(() => null);
    const j = await r?.json().catch(() => null); setBusy(null);
    setMeldung({ art: j?.ok ? "gut" : "schlecht", text: j?.meldung || j?.error || "Fehler." });
  };
  const ki = async (art: string) => {
    setBusy(`ki-${art}`); setKiFehler(null); const vorher = { betreff, text };
    const r = await fetch(`${basis}/ki`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ art, eingabe: text }) }).catch(() => null);
    const j = await r?.json().catch(() => null); setBusy(null);
    if (!j?.ok) { setKiFehler(j?.grund || j?.error || "Die KI war nicht erreichbar. Prüfe die Verbindung und versuche es erneut."); return; }
    setZurueck(vorher); setText(j.text); if (j.betreff && !betreff.trim()) setBetreff(j.betreff);
    setEingefuegt(true); window.setTimeout(() => setEingefuegt(false), 1400);
    setMeldung({ art: "gut", text: (j.entfernt?.length ?? 0) > 0 ? `Vorschlag steht im Feld. Entschärft wurde: ${j.entfernt.join(", ")} – solche Zusagen dürfen nicht an Kunden.` : "Vorschlag steht im Feld. Bitte lies ihn, bevor du sendest." });
  };

  return (
    <>
      <div className="in-spalte-kopf"><b><PenLine size={16} strokeWidth={1.75} style={{ verticalAlign: -3, marginRight: 8, color: "#93c5fd" }} />Neue Mail</b><small>{maxEmpfaenger < 1000 ? `bis zu ${maxEmpfaenger} Empfänger` : ""}</small></div>
      {meldung && <p className={`in-meldung ${meldung.art === "schlecht" ? "schlecht" : ""}`} style={{ marginBottom: 12 }}>{meldung.text}</p>}
      {ergebnis && ergebnis.ergebnisse?.length > 0 && <ErgebnisKarte ergebnis={ergebnis} onZu={() => setErgebnis(null)} />}

      <div className="in-zeilen">
        <div>
          <p className="in-hinweis" style={{ marginBottom: 8 }}>Empfänger{gewaehltGesamt > 0 && <b style={{ color: "#fff", fontWeight: 500 }}> · {gewaehltGesamt}</b>}</p>
          {gewaehlt.length > 0 && <div className="in-chips">{gewaehlt.map((g) => <span key={g.email} className="in-chip">{g.name}{g.extern && <em>extern</em>}<button type="button" aria-label={`${g.name} entfernen`} onClick={() => setGewaehlt((l) => l.filter((x) => x.email !== g.email))}><X size={12} /></button></span>)}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1, position: "relative" }}><Search size={15} style={{ position: "absolute", left: 13, top: 15, color: "#64748b" }} /><input className="in-feld" style={{ paddingLeft: 36 }} value={suche} onChange={(e) => { setSuche(e.target.value); setFeldHinweis(null); }} onKeyDown={(e) => { if (e.key !== "Enter" && e.key !== "," && e.key !== ";") return; e.preventDefault(); adresseUebernehmen(); }} onBlur={() => { if (suche.trim()) adresseUebernehmen(true); }} placeholder="Name, Kundennummer oder E-Mail eintippen …" aria-label="Empfänger suchen oder E-Mail eingeben" /></div>
            <button type="button" className="in-knopf still" onClick={() => setGruppenWahl(true)}><Users size={15} strokeWidth={1.75} /> Gruppe{aktiveGruppen.length > 0 && <b style={{ color: "#93c5fd" }}> {aktiveGruppen.length}</b>}</button>
          </div>
          {treffer.length > 0 && <div className="in-treffer">{treffer.slice(0, 8).map((t) => <button key={t.email} type="button" onClick={() => { setGewaehlt((l) => l.some((x) => x.email === t.email) ? l : [...l, t]); setSuche(""); setTreffer([]); }}>{t.name}<span>{t.email}</span></button>)}</div>}
          {feldHinweis && <p className="in-feldhinweis">{feldHinweis}</p>}
          {!feldHinweis && suche.trim().length > 2 && treffer.length === 0 && <p className="in-hinweis" style={{ marginTop: 8 }}>{MAIL_RE.test(suche.trim()) ? "Passt – die Adresse wird übernommen, sobald du Enter drückst, das Feld verlässt oder auf „Vorschau & senden“ gehst." : "Kein Kunde gefunden. Eine vollständige E-Mail-Adresse kannst du mit Enter direkt übernehmen."}</p>}
          <p className="in-hinweis" style={{ marginTop: 8 }}>Testeinträge, DSGVO-Gelöschte und archivierte Datensätze sind immer ausgeschlossen.{maxEmpfaenger < 1000 && ` Deine Rolle darf an höchstens ${maxEmpfaenger} Empfänger senden.`}</p>
        </div>

        <input className={`in-feld${eingefuegt ? " eingefuegt" : ""}`} value={betreff} onChange={(e) => setBetreff(e.target.value)} placeholder="Betreff" aria-label="Betreff" style={{ fontWeight: 500 }} />
        <textarea ref={feld} className={`in-feld${eingefuegt ? " eingefuegt" : ""}`} rows={9} value={text} onChange={(e) => setText(e.target.value)} placeholder="Hi {Anrede}, wie besprochen: {Zahlungsdaten}" aria-label="Text" />
        {bausteine.length > 0 && <div className="in-bausteine">{bausteine.map((b) => <button key={b.marke} type="button" title={b.erklaerung} onClick={() => bausteinEinfuegen(b.marke)}>{b.titel}</button>)}</div>}
        {kiFehler && <div className="in-ki-fehler"><b>Der Entwurf ist nicht entstanden</b>{kiFehler}{/^Die KI antwortete mit HTTP 401/.test(kiFehler) && <p style={{ margin: "6px 0 0" }}>Das ist kein Fehler an deinem Text: Der hinterlegte OpenAI-Schlüssel wird abgelehnt. Der Vorgesetzte muss ihn erneuern – schreib solange von Hand.</p>}</div>}
        <div className="in-ki">
          {[{ art: "entwurf", titel: "Entwurf aus Stichpunkten" }, { art: "ton", titel: "Ton glätten" }, { art: "kuerzen", titel: "Kürzen" }].map((k) => <button key={k.art} type="button" className="in-knopf still klein" disabled={!!busy || text.trim().length < 3} onClick={() => void ki(k.art)}><Sparkles size={13} strokeWidth={1.75} /> {busy === `ki-${k.art}` ? "…" : k.titel}</button>)}
          {zurueck && <button type="button" className="in-knopf still klein" onClick={() => { setBetreff(zurueck.betreff); setText(zurueck.text); setZurueck(null); }}>Rückgängig</button>}
        </div>
        <p className="in-hinweis">Die KI schlägt vor, du sendest. Zusagen zu Limits und das Wort „Beratung" werden automatisch entfernt.</p>
        <div className="in-senden">
          <button type="button" className="in-knopf still" disabled={!!busy || !betreff || !text} onClick={() => void test()}>{busy === "test" ? "…" : "Test an mich"}</button>
          <button type="button" className="in-knopf" disabled={!!busy || !betreff || !text || (gewaehltGesamt === 0 && !suche.trim())} onClick={() => void vorschauHolen()}>{busy === "vorschau" ? "…" : "Vorschau & senden"}</button>
        </div>
      </div>

      {gruppenWahl && (
        <Dialog ueber="Zielgruppen" titel="Eine ganze Gruppe anschreiben" unter="Die Zahl ist der aktuelle Stand – sie wird beim Senden neu ermittelt, nicht aus dieser Ansicht übernommen." breite={520} onZu={() => setGruppenWahl(false)}
          fuss={<><button type="button" className="in-knopf still" onClick={() => setAktiveGruppen([])}>Keine</button><button type="button" className="in-knopf" onClick={() => setGruppenWahl(false)}>Übernehmen</button></>}>
          <div style={{ display: "grid", gap: 6 }}>{gruppen.map((g) => { const an = aktiveGruppen.includes(g.schluessel); return (
            <button key={g.schluessel} type="button" className={`in-gruppe${an ? " an" : ""}`} disabled={g.anzahl === 0} onClick={() => setAktiveGruppen((l) => an ? l.filter((x) => x !== g.schluessel) : [...l, g.schluessel])}><span className="haken">{an && <Check size={14} strokeWidth={2.5} />}</span><b>{g.titel}</b><em>{g.anzahl}</em></button>
          ); })}</div>
        </Dialog>
      )}

      {vorschau && (
        <Dialog ueber="So geht es raus" titel={`${vorschau.anzahl} Empfänger`} breite={640} onZu={() => setVorschau(null)}
          unter={<>{(Array.isArray(vorschau.empfaenger) ? vorschau.empfaenger : []).map((e: any) => e?.name ?? e?.email ?? "?").slice(0, 6).join(", ")}{vorschau.anzahl > 6 && ` und ${vorschau.anzahl - 6} weitere`}</>}
          fuss={<><button type="button" className="in-knopf still" onClick={() => setVorschau(null)}>Zurück zum Text</button><button type="button" className="in-knopf" disabled={busy === "senden"} onClick={() => void senden()}>{busy === "senden" ? "Wird verschickt …" : `An ${vorschau.anzahl} senden`}</button></>}>
          <div className="in-vorschau">
            <p className="in-hinweis" style={{ marginBottom: 10 }}>Betreff: <b style={{ color: "#fff", fontWeight: 500 }}>{vorschau.betreff}</b> – Bausteine sind hier mit den Daten des ersten Empfängers gefüllt; jeder bekommt seine eigenen.</p>
            <iframe title="Vorschau" sandbox="" srcDoc={vorschau.html} />
          </div>
        </Dialog>
      )}
    </>
  );
}

// Sendeergebnis je Empfänger, mit Grund – nie ein Verweis auf einen anderen Ort.
function ErgebnisKarte({ ergebnis, onZu }: { ergebnis: any; onZu: () => void }) {
  const [offen, setOffen] = useState(true);
  const misslungen = ergebnis.ergebnisse.filter((e: any) => !e.ok); const geklappt = ergebnis.ergebnisse.filter((e: any) => e.ok);
  return (
    <div className={`in-ergebnis${misslungen.length ? " schlecht" : ""}`} style={{ marginBottom: 12 }}>
      <button type="button" className="in-ergebnis-kopf" onClick={() => setOffen((o) => !o)}><span>{geklappt.length} verschickt{misslungen.length > 0 && `, ${misslungen.length} nicht`}{misslungen.length > 0 && ergebnis.gruende?.length === 1 && <small style={{ display: "block", marginTop: 3, color: "#fde68a" }}>{ergebnis.gruende[0]}</small>}</span><small>{offen ? "Zuklappen" : "Je Empfänger ansehen"}</small></button>
      {offen && (
        <div style={{ marginTop: 8 }}>
          {ergebnis.ergebnisse.map((e: any) => <div key={e.email} className="in-ergebnis-zeile"><i style={{ background: e.ok ? "#34d399" : "#fbbf24" }} />{e.name}<span>{e.email}</span>{!e.ok && <p>{e.grund || "Kein Grund übermittelt."}</p>}</div>)}
          <button type="button" className="in-link" onClick={onZu} style={{ marginTop: 6 }}>Ergebnis schließen</button>
        </div>
      )}
    </div>
  );
}

function Dialog({ ueber, titel, unter, breite = 560, onZu, fuss, children }: { ueber: string; titel: string; unter?: ReactNode; breite?: number; onZu: () => void; fuss?: ReactNode; children: ReactNode }) {
  const zuRef = useRef(onZu); zuRef.current = onZu;
  useEffect(() => {
    const zu = (e: KeyboardEvent) => { if (e.key === "Escape") zuRef.current(); };
    window.addEventListener("keydown", zu); const r = document.getElementById("root"); const vorher = r?.style.overflow ?? ""; if (r) r.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", zu); if (r) r.style.overflow = vorher; };
  }, []);
  return (
    <div className="in-dialog-hintergrund" onClick={onZu} role="presentation">
      <div className="in-dialog" role="dialog" aria-modal="true" aria-label={titel} style={{ ["--in-breite" as any]: `${breite}px` }} onClick={(e) => e.stopPropagation()}>
        <div className="in-dialog-kopf"><div><span className="ueber">{ueber}</span><h2>{titel}</h2>{unter && <span className="unter">{unter}</span>}</div><button type="button" className="in-dialog-zu" onClick={onZu} aria-label="Schließen"><X size={18} /></button></div>
        <div className="in-dialog-inhalt">{children}</div>
        {fuss && <div className="in-dialog-fuss">{fuss}</div>}
      </div>
    </div>
  );
}
