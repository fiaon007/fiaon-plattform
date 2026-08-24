// ═══════════════════════════════════════════════════════════════════════════
// /agent/more/:bereich? — Raum „More" (23.08.2026, Plan §4/§11)
//
// Ersetzt mehr.tsx, profil.tsx, dokumente.tsx und den eingeloggten Teil von
// passwort.tsx – als Glas-Kacheln mit Unterseiten (Reiter über die Adresse):
//   (leer)     Übersicht: Ich-Karte, Erste Schritte (/agent/first-steps GET+POST),
//              Kacheln zu Profil/Dokumente/Passwort/Abmelden und den weiteren
//              Bereichen (Academy, Schulung nur Leitung via /agent/academy,
//              Skripte, Updates mit Zähler, Feedback, Wallet)
//   profil     /agent/profile, POST …/avatar (Zuschnitt 256 px im Browser),
//              POST …/phone, GET/PUT /agent/verfuegbarkeit, POST …/bank (IBAN-Prüfsumme)
//   dokumente  /agent/documents (Vertrag + Abrechnungen als PDF),
//              /agent/onboarding (Einwilligungen mit Zeitpunkt, Text zum Nachlesen)
//   passwort   POST /agent/profile/password, POST /agent/forgot-password
//   Abmelden   POST /agent/logout
// Der Reset per Link aus der Mail (?token=) bleibt auf /agent/passwort – er
// läuft vor der Anmeldung und gehört nicht ins Office.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { User, FileText, KeyRound, LogOut, GraduationCap, Sparkles, MessageSquarePlus, Wallet, Camera, Trash2, CheckCircle2, X, FileSignature, ShieldCheck, Download, Clock, Compass } from "lucide-react";
import { AgentShell, api, useAgentInfo, fmtDT, fmtCents } from "./shared";
import { useOffice } from "./OfficeShell";
import { getUnseenCount } from "./updates-data";
import "@/styles/office-more.css";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "./rundgaenge";
import "@/styles/office-rundgang.css";

type Bereich = "" | "profil" | "dokumente" | "passwort";
type Meldung = { art: "gut" | "schlecht"; text: string } | null;
const initialen = (name?: string | null) => String(name || "?").split(/\s+/).map((t) => t[0]).join("").slice(0, 2).toUpperCase();

export default function AgentMorePage() { return <AgentShell><MoreInnen /></AgentShell>; }

function MoreInnen() {
  const { dunkel, titel } = useOffice();
  const [location, navigate] = useLocation();
  const bereich: Bereich = (() => { const s = location.replace(/^\/agent\/more\/?/, "").split(/[/?#]/)[0]; return (["profil", "dokumente", "passwort"].includes(s) ? s : "") as Bereich; })();
  useEffect(() => { dunkel(true); titel(bereich === "profil" ? "Profil" : bereich === "dokumente" ? "Dokumente" : bereich === "passwort" ? "Passwort" : "More"); }, [bereich]); // eslint-disable-line react-hooks/exhaustive-deps
  const { agent } = useAgentInfo();
  const [meldung, setMeldung] = useState<Meldung>(null);
  const melden = (m: Meldung) => { setMeldung(m); if (m) window.setTimeout(() => setMeldung((x) => (x === m ? null : x)), 4500); };

  const abmelden = async () => {
    await fetch("/api/fiaon/agent/logout", { method: "POST", credentials: "include" }).catch(() => {});
    navigate("/agent"); window.location.reload();
  };

  return (
    <div className="mo">
      <section className="mo-kopf">
        <div>
          <span className="mo-pille">More · Dein Konto</span>
          <h1>{bereich === "profil" ? <>Dein <span className="mo-verlauf">Profil.</span></> : bereich === "dokumente" ? <>Deine <span className="mo-verlauf">Dokumente.</span></> : bereich === "passwort" ? <>Dein <span className="mo-verlauf">Passwort.</span></> : <>Alles Weitere, <span className="mo-verlauf">an einem Ort.</span></>}</h1>
          <p>{bereich === "profil" ? "Foto, Telefonnummer, Erreichbarkeit für Termine und Auszahlungsdaten. Name und E-Mail ändert der Administrator." : bereich === "dokumente" ? "Dein Vertrag, deine Einwilligungen und deine Provisionsabrechnungen – jederzeit als PDF." : bereich === "passwort" ? "Mindestens 10 Zeichen, Zahl, Groß- und Kleinbuchstabe." : "Profil, Dokumente, Passwort – und die Bereiche, die in keinen anderen Raum gehören."}</p>
        </div>
        {bereich !== "" && <Link href="/agent/more" className="mo-knopf still">Zurück zu More</Link>}
      </section>

      <nav className="mo-reiter" aria-label="Bereiche">
        {([["", "Übersicht", User], ["profil", "Profil", User], ["dokumente", "Dokumente", FileText], ["passwort", "Passwort", KeyRound]] as [Bereich, string, any][]).map(([k, l, I]) => <Link key={k} href={k ? `/agent/more/${k}` : "/agent/more"} className={bereich === k ? "an" : ""}><I size={16} strokeWidth={1.75} />{l}</Link>)}
      </nav>

      {meldung && <p className={`mo-meldung ${meldung.art === "schlecht" ? "schlecht" : ""}`}>{meldung.text}</p>}

      {bereich === "" && <Uebersicht agent={agent} onAbmelden={abmelden} />}
      {bereich === "profil" && <Profil melden={melden} />}
      {bereich === "dokumente" && <Dokumente />}
      {bereich === "passwort" && <Passwort email={agent?.email} melden={melden} />}
      {/* 24.08.2026: Rundgang je Raum (E-063). */}
      <Rundgang raum="more" titel={RUNDGAENGE.more.titel} schritte={RUNDGAENGE.more.schritte} />
    </div>
  );
}

// ── Übersicht ──────────────────────────────────────────────────────────────
function Uebersicht({ agent, onAbmelden }: { agent: { name: string; email: string; avatar?: string | null; rolle?: string } | null; onAbmelden: () => void }) {
  const [istLeitung, setIstLeitung] = useState(false);
  const [updates, setUpdates] = useState(0);
  useEffect(() => {
    fetch("/api/fiaon/agent/academy", { credentials: "include" }).then((r) => r.json()).then((j) => setIstLeitung(j?.istLeitung === true)).catch(() => {});
    setUpdates(getUnseenCount()); const gesehen = () => setUpdates(0); window.addEventListener("agent-updates-seen", gesehen); return () => window.removeEventListener("agent-updates-seen", gesehen);
  }, []);
  const ROLLE: Record<string, string> = { agent: "Bonitätsmanager", inkasso: "Forderungen & Zahlungen", vertriebsleiter: "Vertriebsleitung", onboarding: "Onboarding", admin: "Verwaltung" };
  return (
    <>
      {agent && (
        <Link href="/agent/more/profil" className="mo-ich" style={{ textDecoration: "none", color: "inherit" }}>
          <span className="mo-gesicht">{agent.avatar ? <img src={agent.avatar} alt="" /> : initialen(agent.name)}</span>
          <div style={{ minWidth: 0 }}><b>{agent.name}</b><small>{agent.email}</small><span className="rolle">{ROLLE[agent.rolle || ""] ?? "Bonitätsmanager"}</span></div>
        </Link>
      )}
      <ErsteSchritte />
      <section className="mo-kacheln">
        <Link href="/agent/more/profil" className="mo-kachel"><i><User size={19} strokeWidth={1.75} /></i><div><b>Profil</b><span>Foto, Telefon, Erreichbarkeit, Auszahlungsdaten</span></div></Link>
        <Link href="/agent/more/dokumente" className="mo-kachel"><i><FileText size={19} strokeWidth={1.75} /></i><div><b>Dokumente</b><span>Vertrag, Einwilligungen, Abrechnungen als PDF</span></div></Link>
        <Link href="/agent/more/passwort" className="mo-kachel"><i><KeyRound size={19} strokeWidth={1.75} /></i><div><b>Passwort ändern</b><span>Neues Passwort oder Link per E-Mail</span></div></Link>
        <Link href="/agent/academy" className="mo-kachel"><i><GraduationCap size={19} strokeWidth={1.75} /></i><div><b>Academy</b><span>Der Ablauf deines Bereichs, Kapitel für Kapitel</span></div></Link>
        {istLeitung && <Link href="/agent/schulung" className="mo-kachel"><i><GraduationCap size={19} strokeWidth={1.75} /></i><div><b>Schulung</b><span>Reisen zum Vorführen, Funktionskatalog, Stand deines Teams</span></div></Link>}
        <Link href="/agent/skripte" className="mo-kachel"><i><FileText size={19} strokeWidth={1.75} /></i><div><b>Skripte</b><span>Gesprächsvorlagen und Leitfäden für deine Telefonate</span></div></Link>
        <Link href="/agent/updates" className="mo-kachel"><i><Sparkles size={19} strokeWidth={1.75} /></i><div><b>Updates{updates > 0 && <em>{updates}</em>}</b><span>Neuerungen im Office</span></div></Link>
        <Link href="/agent/feedback" className="mo-kachel"><i><MessageSquarePlus size={19} strokeWidth={1.75} /></i><div><b>Feedback</b><span>Verbesserungen vorschlagen – Umsetzung wird belohnt</span></div></Link>
        <Link href="/agent/wallet" className="mo-kachel"><i><Wallet size={19} strokeWidth={1.75} /></i><div><b>Wallet</b><span>Guthaben, Auszahlung, Leistung, Partnerprogramm</span></div></Link>
        {/* Einführung (23.08.2026): startet den geführten Rundgang neu — Einfuehrung.tsx hört auf dieses Ereignis. */}
        <button type="button" className="mo-kachel" onClick={() => window.dispatchEvent(new CustomEvent("fiaon-einfuehrung-starten"))}><i><Compass size={19} strokeWidth={1.75} /></i><div><b>Einführung neu starten</b><span>Der geführte Rundgang durch alle Räume des Office</span></div></button>
        <button type="button" className="mo-kachel aus" onClick={onAbmelden}><i><LogOut size={19} strokeWidth={1.75} /></i><div><b>Abmelden</b><span>Du bist danach offline – keine Anrufe, keine neuen Kunden.</span></div></button>
      </section>
    </>
  );
}

// Erste Schritte (neue Mitarbeiter) – verschwindet von selbst, wenn erledigt.
function ErsteSchritte() {
  const [steps, setSteps] = useState<{ key: string; label: string; done: boolean }[] | null>(null);
  const [weg, setWeg] = useState(false);
  const laden = async () => { const r = await api("/agent/first-steps"); if (r.ok) { if (r.json.dismissed || r.json.allDone) { setWeg(true); return; } setSteps(r.json.steps); } };
  useEffect(() => { laden(); }, []);
  if (weg || !steps) return null;
  const LINK: Record<string, string> = { profil: "/agent/more/profil", iban: "/agent/more/profil", skripte: "/agent/skripte", anruf: "/agent/kunden", notiz: "/agent/kunden" };
  return (
    <section className="mo-block leicht">
      <div className="mo-block-kopf"><b>Erste Schritte <small>{steps.filter((s) => s.done).length}/{steps.length}</small></b><button type="button" className="mo-link" title="Ausblenden" onClick={async () => { await api("/agent/first-steps", { method: "POST", body: JSON.stringify({ key: "dismiss" }) }); setWeg(true); }}><X size={14} /> Ausblenden</button></div>
      <div className="mo-schritte">{steps.map((s) => (
        <div key={s.key} className={`mo-schritt${s.done ? " fertig" : ""}`}><span className="punkt"><CheckCircle2 size={13} strokeWidth={2.5} /></span>{s.done ? <span>{s.label}</span> : <Link href={LINK[s.key] || "/agent"}>{s.label}</Link>}{s.key === "skripte" && !s.done && <button type="button" className="mo-link" onClick={async () => { await api("/agent/first-steps", { method: "POST", body: JSON.stringify({ key: "skripte" }) }); laden(); }}>Erledigt</button>}</div>
      ))}</div>
    </section>
  );
}

// ── Profil ─────────────────────────────────────────────────────────────────
async function bildZuschneiden(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, nein) => { const i = new Image(); i.onload = () => ok(i); i.onerror = nein; i.src = url; });
    const seite = Math.min(img.width, img.height); const c = document.createElement("canvas"); c.width = 256; c.height = 256;
    c.getContext("2d")!.drawImage(img, (img.width - seite) / 2, (img.height - seite) / 2, seite, seite, 0, 0, 256, 256);
    return c.toDataURL("image/jpeg", 0.85);
  } finally { URL.revokeObjectURL(url); }
}
function ibanPlausibel(input: string): boolean {
  const iban = input.replace(/\s+/g, "").toUpperCase(); if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  let rest = 0; for (const ch of iban.slice(4) + iban.slice(0, 4)) { const v = ch >= "A" ? String(ch.charCodeAt(0) - 55) : ch; for (const d of v) rest = (rest * 10 + Number(d)) % 97; }
  return rest === 1;
}
const WOCHENTAGE = [[1, "Mo", "Montag"], [2, "Di", "Dienstag"], [3, "Mi", "Mittwoch"], [4, "Do", "Donnerstag"], [5, "Fr", "Freitag"], [6, "Sa", "Samstag"], [7, "So", "Sonntag"]] as const;

function Profil({ melden }: { melden: (m: Meldung) => void }) {
  const { reload } = useAgentInfo();
  const [profil, setProfil] = useState<any>(null);
  const [bank, setBank] = useState({ holder: "", iban: "", bic: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const datei = useRef<HTMLInputElement>(null);
  const laden = () => { api("/agent/profile").then((r) => { if (r.ok) { setProfil(r.json.profile); setBank((b) => ({ ...b, holder: r.json.profile.bankHolder || "" })); } else melden({ art: "schlecht", text: r.json?.error || "Profil konnte nicht geladen werden." }); }); };
  useEffect(laden, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Erreichbarkeit für Terminbuchungen (/agent/verfuegbarkeit)
  const [fenster, setFenster] = useState<{ wochentag: number; von: string; bis: string; aktiv: boolean }[]>([]);
  const [vorgabe, setVorgabe] = useState(true);
  const [slot, setSlot] = useState(20);
  const [fensterGeladen, setFensterGeladen] = useState(false);
  useEffect(() => { api("/agent/verfuegbarkeit").then((r) => { if (r.ok) { setFenster(r.json.fenster || []); setVorgabe(!!r.json.vorgabe); setSlot(Number(r.json.slotMinuten) || 20); } setFensterGeladen(true); }); }, []);
  const fuerTag = (nr: number) => fenster.find((f) => f.wochentag === nr) || null;

  if (!profil) return <p className="mo-laedt">Lade …</p>;

  const bildHochladen = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) { melden({ art: "schlecht", text: "Bild zu groß (max. 2 MB)" }); return; }
    setBusy("avatar");
    try { const r = await api("/agent/profile/avatar", { method: "POST", body: JSON.stringify({ avatar: await bildZuschneiden(file) }) }); if (r.ok) { melden({ art: "gut", text: "Profilbild aktualisiert" }); laden(); reload(); } else melden({ art: "schlecht", text: r.json?.error || "Fehler beim Upload" }); }
    catch { melden({ art: "schlecht", text: "Bild konnte nicht verarbeitet werden" }); }
    finally { setBusy(null); }
  };
  const bildEntfernen = async () => { setBusy("avatar"); const r = await api("/agent/profile/avatar", { method: "POST", body: JSON.stringify({ avatar: "" }) }); setBusy(null); if (r.ok) { melden({ art: "gut", text: "Profilbild entfernt" }); laden(); reload(); } };
  const fensterSpeichern = async () => {
    const kaputt = fenster.find((f) => f.bis <= f.von);
    if (kaputt) { melden({ art: "schlecht", text: `${WOCHENTAGE.find((w) => w[0] === kaputt.wochentag)?.[2]}: „bis" muss nach „von" liegen.` }); return; }
    setBusy("fenster"); const r = await api("/agent/verfuegbarkeit", { method: "PUT", body: JSON.stringify({ fenster }) }); setBusy(null);
    if (r.ok) { setVorgabe(false); melden({ art: "gut", text: "Erreichbarkeit gespeichert" }); } else melden({ art: "schlecht", text: r.json?.error || "Fehler" });
  };
  const bankSpeichern = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ibanPlausibel(bank.iban)) { melden({ art: "schlecht", text: "IBAN ungültig (Prüfsumme fehlgeschlagen)" }); return; }
    setBusy("bank"); const r = await api("/agent/profile/bank", { method: "POST", body: JSON.stringify({ holder: bank.holder, iban: bank.iban, bic: bank.bic }) }); setBusy(null);
    if (r.ok) { melden({ art: "gut", text: "Auszahlungsdaten gespeichert" }); setBank((b) => ({ ...b, iban: "", bic: "" })); laden(); } else melden({ art: "schlecht", text: r.json?.error || "Fehler" });
  };

  return (
    <>
      <section className="mo-block">
        <div className="mo-ich" style={{ background: "transparent", border: 0, padding: 0, backdropFilter: "none" }}>
          <span className="mo-gesicht gross">{profil.avatar ? <img src={profil.avatar} alt="" /> : initialen(profil.name)}</span>
          <div style={{ flex: 1, minWidth: 0 }}><b>{profil.name}</b><small>{profil.email}</small><small style={{ color: "#64748b" }}>Name und E-Mail können nur vom Administrator geändert werden.</small></div>
          <div style={{ display: "grid", gap: 6 }}>
            <button type="button" className="mo-knopf still klein" disabled={busy === "avatar"} onClick={() => datei.current?.click()}><Camera size={14} strokeWidth={1.75} /> Foto</button>
            {profil.avatar && <button type="button" className="mo-link" onClick={bildEntfernen}><Trash2 size={12} /> Entfernen</button>}
          </div>
          <input ref={datei} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) bildHochladen(f); e.target.value = ""; }} />
        </div>
      </section>

      <section className="mo-block leicht">
        {/* 24.08.2026 (Justin): VORHER konnte hier jeder eine eigene Rufnummer
            „für Rückrufe und das Softphone" eintragen. Sie wurde NIE benutzt:
            Ruft ein Kunde die FIAON-Nummer an, klingelt es im BROWSER des
            Zuständigen (Twilio ruft <Client>agent-ID</Client>) — nicht auf
            einer hinterlegten Nummer. Das Feld hat also nur den Eindruck
            erweckt, man müsse etwas eintragen, damit man erreichbar ist.
            NACHHER steht dort, wie es wirklich läuft. */}
        <div className="mo-block-kopf"><b>Rückrufe</b><small>so erreichen dich deine Kunden</small></div>
        <p className="mo-hinweis">
          Ruft einer deiner Kunden die FIAON-Nummer an, klingelt es <b>hier im Office</b> —
          in dem Browserfenster, in dem du angemeldet bist. Du brauchst dafür keine eigene
          Nummer zu hinterlegen. Wer angerufen wird, entscheidet der Fall: Bei einer offenen
          Rate übernimmt das Forderungsmanagement, vor einem Startgespräch der Kollege mit
          dem Termin — sonst <b>du als Betreuer</b>. Nimmt niemand ab, hört der Kunde eine
          Ansage und der Anruf steht in deiner Inbox.
        </p>
      </section>

      {/* Vorher: komplettes Erreichbarkeits-Formular (Wochentage + Zeiten) direkt im Profil.
          Nachher (Justin 24.08.): nur noch ein Verweis – gepflegt wird auf der Availability-Seite. */}
      <section className="mo-block leicht" id="erreichbarkeit">
        <div className="mo-block-kopf"><b><Clock size={15} strokeWidth={1.75} />Erreichbarkeit für Termine</b></div>
        <p className="mo-hinweis" style={{ marginBottom: 12 }}>Deine buchbaren Zeiten pflegst du zentral im Wochenplan – dort entstehen Termine und Leads.</p>
        <Link href="/agent/arbeitszeiten" className="mo-knopf" style={{ display: "inline-flex", textDecoration: "none" }}>Zeiten einrichten oder ändern</Link>
      </section>

      <section className="mo-block">
        <div className="mo-block-kopf"><b>Auszahlungsdaten</b><small>verschlüsselt, nur maskiert sichtbar</small></div>
        <p className="mo-hinweis" style={{ marginBottom: 12 }}>Wird verschlüsselt gespeichert und nur maskiert angezeigt. Jede Änderung wird protokolliert und dem Administrator gemeldet. Auszahlungen gehen per Überweisung auf dieses Konto.</p>
        {profil.ibanMasked && <div className="mo-hinterlegt" style={{ marginBottom: 12 }}><small>Hinterlegt</small><span className="mono">{profil.ibanMasked}</span>{profil.bankHolder && <span>· {profil.bankHolder}</span>}</div>}
        <form onSubmit={bankSpeichern} className="mo-form">
          <input className="mo-feld" value={bank.holder} onChange={(e) => setBank((b) => ({ ...b, holder: e.target.value }))} placeholder="Kontoinhaber" aria-label="Kontoinhaber" />
          <div className="mo-raster-bank"><input className="mo-feld mono" value={bank.iban} onChange={(e) => setBank((b) => ({ ...b, iban: e.target.value }))} placeholder="IBAN" aria-label="IBAN" /><input className="mo-feld mono" value={bank.bic} onChange={(e) => setBank((b) => ({ ...b, bic: e.target.value }))} placeholder="BIC (optional)" aria-label="BIC" /></div>
          <div><button type="submit" className="mo-knopf" disabled={busy === "bank" || !bank.holder || !bank.iban}>{busy === "bank" ? "…" : profil.hasBank ? "Auszahlungsdaten aktualisieren" : "Auszahlungsdaten speichern"}</button></div>
        </form>
      </section>
    </>
  );
}

// ── Dokumente ──────────────────────────────────────────────────────────────
function Dokumente() {
  const [vertraege, setVertraege] = useState<any[]>([]);
  const [abrechnungen, setAbrechnungen] = useState<any[]>([]);
  const [geladen, setGeladen] = useState(false);
  const [einwilligungen, setEinwilligungen] = useState<any[] | null>(null);
  const [texte, setTexte] = useState<Record<string, string>>({});
  const [lesen, setLesen] = useState<string | null>(null);
  useEffect(() => {
    api("/agent/documents").then((r) => { if (r.ok) { setVertraege(r.json.contracts || []); setAbrechnungen(r.json.statements || []); } setGeladen(true); });
    api("/agent/onboarding").then((r) => { if (!r.ok) { setEinwilligungen([]); return; } setEinwilligungen(r.json.status?.consent?.docs || []); const t: Record<string, string> = {}; for (const d of r.json.documents || []) t[d.key] = d.html; setTexte(t); }).catch(() => setEinwilligungen([]));
  }, []);
  return (
    <>
      <section className="mo-block">
        <div className="mo-block-kopf"><b><FileSignature size={15} strokeWidth={1.75} />Vertrag</b><small>{vertraege.length} Version(en)</small></div>
        {vertraege.length === 0 && <p className="mo-leer">{geladen ? "Noch kein signierter Vertrag vorhanden." : "Lade …"}</p>}
        <div className="mo-doks">{vertraege.map((c, i) => (
          <div key={c.id} className="mo-dok"><i><FileText size={18} strokeWidth={1.75} /></i>
            <div><b>Handelsvertretervertrag · v{c.template_version}{i === 0 && <span className="mo-marke gut">Aktuell</span>}</b><small>Signiert {fmtDT(c.signed_at)} · {c.signature_mode === "drawn" ? "Unterschrift" : "getippt"} · {c.signature_name}</small><small className="hash">Hash {String(c.doc_hash).slice(0, 24)}…</small></div>
            {c.has_pdf && <a className="mo-knopf klein" href={`/api/fiaon/agent/documents/contract/${c.id}.pdf`} target="_blank" rel="noreferrer"><Download size={14} /> PDF</a>}
          </div>
        ))}</div>
      </section>

      <section className="mo-block leicht">
        <div className="mo-block-kopf"><b><ShieldCheck size={15} strokeWidth={1.75} />Einwilligungen</b><small>versioniert, mit Zeitpunkt</small></div>
        {einwilligungen === null && <p className="mo-laedt">Lade …</p>}
        {einwilligungen && einwilligungen.length === 0 && <p className="mo-leer">Keine Einwilligungen hinterlegt.</p>}
        <div className="mo-doks">{(einwilligungen || []).map((d) => (
          <div key={d.key} className="mo-dok" style={{ flexWrap: "wrap" }}><i><ShieldCheck size={18} strokeWidth={1.75} /></i>
            <div><b>{d.title} · v{d.version}{d.accepted ? <span className="mo-marke gut">zugestimmt</span> : <span className="mo-marke warten">offen</span>}</b><small>{d.accepted && d.acceptedAt ? `Zugestimmt ${fmtDT(d.acceptedAt)}` : "Noch nicht bestätigt – die Einarbeitung fragt danach."}</small></div>
            {texte[d.key] && <button type="button" className="mo-knopf still klein" onClick={() => setLesen(lesen === d.key ? null : d.key)}>{lesen === d.key ? "Zuklappen" : "Lesen"}</button>}
            {lesen === d.key && texte[d.key] && <div className="mo-lesen" style={{ flexBasis: "100%" }} dangerouslySetInnerHTML={{ __html: texte[d.key] }} />}
          </div>
        ))}</div>
      </section>

      <section className="mo-block">
        <div className="mo-block-kopf"><b><FileText size={15} strokeWidth={1.75} />Provisions-Abrechnungen</b><small>{abrechnungen.length} Beleg(e)</small></div>
        {abrechnungen.length === 0 && <p className="mo-leer">{geladen ? "Noch keine Abrechnungen – sie entstehen automatisch bei jeder Auszahlung." : "Lade …"}</p>}
        <div className="mo-doks">{abrechnungen.map((s) => (
          <div key={s.id} className="mo-dok"><i><FileText size={18} strokeWidth={1.75} /></i>
            <div><b>{s.statement_no}</b><small>Ausgestellt {fmtDT(s.issued_at)} · Netto <span style={{ color: "#fff" }}>{fmtCents(s.net_cents)}</span></small></div>
            {s.has_pdf && <a className="mo-knopf klein" href={`/api/fiaon/agent/documents/statement/${s.id}.pdf`} target="_blank" rel="noreferrer"><Download size={14} /> PDF</a>}
          </div>
        ))}</div>
      </section>
    </>
  );
}

// ── Passwort ───────────────────────────────────────────────────────────────
function Passwort({ email, melden }: { email?: string; melden: (m: Meldung) => void }) {
  const [form, setForm] = useState({ alt: "", neu: "", neu2: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const aendern = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.neu !== form.neu2) { melden({ art: "schlecht", text: "Neue Passwörter stimmen nicht überein" }); return; }
    setBusy("pw"); const r = await api("/agent/profile/password", { method: "POST", body: JSON.stringify({ oldPassword: form.alt, newPassword: form.neu }) }); setBusy(null);
    if (r.ok) { melden({ art: "gut", text: "Passwort geändert" }); setForm({ alt: "", neu: "", neu2: "" }); } else melden({ art: "schlecht", text: r.json?.error || "Fehler" });
  };
  const linkAnfordern = async () => { if (!email) return; setBusy("link"); const r = await api("/agent/forgot-password", { method: "POST", body: JSON.stringify({ email }) }); setBusy(null); setInfo(r.json?.message || "Falls ein Konto existiert, wurde eine E-Mail versendet."); };
  return (
    <>
      <section className="mo-block">
        <div className="mo-block-kopf"><b><KeyRound size={15} strokeWidth={1.75} />Passwort ändern</b><small>aktuelles Passwort erforderlich</small></div>
        <form onSubmit={aendern} className="mo-form">
          <input className="mo-feld" type="password" value={form.alt} onChange={(e) => setForm((f) => ({ ...f, alt: e.target.value }))} placeholder="Aktuelles Passwort" autoComplete="current-password" aria-label="Aktuelles Passwort" />
          <div className="mo-raster2"><input className="mo-feld" type="password" value={form.neu} onChange={(e) => setForm((f) => ({ ...f, neu: e.target.value }))} placeholder="Neues Passwort" autoComplete="new-password" aria-label="Neues Passwort" /><input className="mo-feld" type="password" value={form.neu2} onChange={(e) => setForm((f) => ({ ...f, neu2: e.target.value }))} placeholder="Neues Passwort wiederholen" autoComplete="new-password" aria-label="Neues Passwort wiederholen" /></div>
          <p className="mo-hinweis">Min. 10 Zeichen, Zahl, Groß- und Kleinbuchstabe.</p>
          <div><button type="submit" className="mo-knopf" disabled={busy === "pw" || !form.alt || !form.neu}>{busy === "pw" ? "…" : "Passwort ändern"}</button></div>
        </form>
      </section>
      <section className="mo-block leicht">
        <div className="mo-block-kopf"><b>Passwort vergessen?</b><small>Link gilt eine Stunde</small></div>
        <p className="mo-hinweis" style={{ marginBottom: 12 }}>Wir schicken dir einen Link an {email || "deine Login-E-Mail"}. Damit legst du ein neues Passwort fest – ohne das alte.</p>
        {info && <p className="mo-meldung" style={{ marginBottom: 12 }}>{info}</p>}
        <button type="button" className="mo-knopf still" disabled={busy === "link" || !email} onClick={linkAnfordern}>{busy === "link" ? "Sende …" : "Reset-Link an mich senden"}</button>
      </section>
    </>
  );
}
