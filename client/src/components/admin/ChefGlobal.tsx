// ═══════════════════════════════════════════════════════════════════════════
// CHEFBÜRO › GLOBAL — der Arbeitsraum für die Firmenkunden (E-338, 12.10.2026)
//
// Justin: „unser gesamtes Admin Dashboard braucht eine Global Seite, worüber
//          wir arbeiten können, alles perfekt 100 % synchron … Firmendokumente
//          hochladen, wenn Post kommt, Funding-Verträge, Bankverträge, Steuern …
//          und eben so, dass sich das NICHT vermischt."
//
// Links die Mandate (je Auftrag eine Akte) und die Angebote in Arbeit, rechts
// das geöffnete Mandat mit Reitern. Jede Änderung geht über dieselben
// Funktionen wie Office und Kundenportal — der Kunde sieht sie sofort.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import {
  Globe2, Building2, FileText, MessageSquare, Landmark, CalendarClock, History, Eye, Copy, Check,
  Upload, Trash2, PenLine, Lock, EyeOff, Send, Plus, Sparkles, ShieldCheck, Inbox, ExternalLink, FlaskConical,
} from "lucide-react";
import { API, Hochzaehler, zahl, datum, datumZeit, seit, Geruest, Fehlermeldung, useDaten } from "./chef-teile";
import { GLOBAL_DOKUMENTARTEN, GLOBAL_ETAPPEN, US_BUNDESSTAATEN } from "@shared/fiaon-global-bereich";
import {
  GLOBAL_FAHRPLAN, GLOBAL_GESELLSCHAFT_PLUS_FELDER, GLOBAL_KAPITAL_ARTEN, GLOBAL_KAPITAL_STATUS, GLOBAL_SCHRITT_STATUS, GLOBAL_SCHRITT_STATUS_TEXT,
  GLOBAL_TRESOR, globalTresorKategorie, globalUsd, type GlobalTresorKategorie,
} from "@shared/fiaon-global-mandat";
import "@/styles/chef-global-raum.css";
// E-342: Gespräche je Tag + Google-Kalender als Leiste im Raum.
import ChefGlobalEinstellungen from "./ChefGlobalEinstellungen";

// ── Typen (so, wie der Server sie schickt) ───────────────────────────────────
interface MandatZeile {
  ref: string; status: string; paket: string; kunde: string; firma: string | null; email: string | null; personId: number | null;
  llc: string | null; bundesstaat: string | null; etappe: number; fortschritt: { erledigt: number; gesamt: number };
  naechsterSchritt: string | null; stichtag: string | null; naechsteFrist: string | null; zustaendig: string | null;
  anfragenNeu: number; uploadsNeu: number; unterschriftenOffen: number; postUngelesen: number; test: boolean; portalNeu: boolean; angelegtAm: string;
}
interface AngebotZeile { id: number; angebotRef: string; status: string; art: "firma" | "begleit" | "individuell"; kunde: string; firma: string | null; gueltigBis: string | null; angenommenAm: string | null; personId: number | null }
interface Liste { mandate: MandatZeile[]; angebote: AngebotZeile[]; kennzahlen: Record<string, number> }

const STATUS_TEXT: Record<string, string> = { offen: "Zahlung offen", bezahlt: "Bezahlt", gestartet: "In Arbeit", abgeschlossen: "Abgeschlossen", storniert: "Storniert" };
const ANGEBOT_ART: Record<string, string> = { firma: "Firmenangebot", begleit: "Begleitvertrag", individuell: "Individualangebot" };

async function senden(pfad: string, methode: "POST" | "DELETE", body?: unknown): Promise<{ ok: boolean; meldung?: string; error?: string; [k: string]: unknown }> {
  try {
    const r = await fetch(`${API}${pfad}`, {
      method: methode, credentials: "include",
      ...(body instanceof FormData ? { body } : body !== undefined ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.ok) return { ok: false, error: j?.error || `Fehler ${r.status}` };
    return j;
  } catch { return { ok: false, error: "Keine Verbindung zum Server." }; }
}

function initialen(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "G";
}

// ── Der Raum ─────────────────────────────────────────────────────────────────
export default function ChefGlobal() {
  const adresse = useSearch();
  const [, navigate] = useLocation();
  const gewaehlt = (() => { try { return new URLSearchParams(adresse).get("mandat"); } catch { return null; } })();
  const { daten, laedt, fehler, neu } = useDaten<Liste & { ok: true }>("/chef/global/mandate");
  const [testZeigen, setTestZeigen] = useState(false);
  const mandate = daten?.mandate ?? [];
  const sichtbar = mandate.filter((m) => testZeigen || !m.test);
  const k = daten?.kennzahlen ?? {};
  const waehlen = (ref: string) => navigate(`/chef/global?mandat=${encodeURIComponent(ref)}`);

  // Ohne Auswahl: das erste echte Mandat öffnen — der Raum ist nie leer.
  useEffect(() => {
    if (!gewaehlt && mandate.length) {
      const erstes = mandate.find((m) => !m.test && m.status !== "storniert") ?? mandate[0];
      navigate(`/chef/global?mandat=${encodeURIComponent(erstes.ref)}`, { replace: true });
    }
  }, [gewaehlt, mandate.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const kacheln: { titel: string; wert: number; Icon: any; ton?: string; satz: string }[] = [
    { titel: "Aktive Mandate", wert: k.aktiv ?? 0, Icon: Globe2, satz: "ohne Test und Storno" },
    { titel: "Zahlung offen", wert: k.zahlungOffen ?? 0, Icon: Landmark, ton: (k.zahlungOffen ?? 0) > 0 ? "gelb" : undefined, satz: "Auftrag erteilt, Geld fehlt" },
    { titel: "Neue Anfragen", wert: k.anfragenNeu ?? 0, Icon: MessageSquare, ton: (k.anfragenNeu ?? 0) > 0 ? "blau" : undefined, satz: "noch nicht beantwortet" },
    { titel: "Neue Uploads", wert: k.uploadsNeu ?? 0, Icon: Upload, ton: (k.uploadsNeu ?? 0) > 0 ? "blau" : undefined, satz: "vom Kunden, ungesehen" },
    { titel: "Unterschriften", wert: k.unterschriftenOffen ?? 0, Icon: PenLine, satz: "beim Kunden angefordert" },
    { titel: "Fristen ≤ 30 Tage", wert: k.fristen30 ?? 0, Icon: CalendarClock, ton: (k.fristen30 ?? 0) > 0 ? "gelb" : undefined, satz: "Steuer, Register, Agent" },
  ];

  return (
    <div className="cgr">
      <header className="cgr-kopf">
        <span className="cb-pille">Chefbüro · FIAON Global</span>
        <h1><span className="cb-verlauf">Global-Mandate</span></h1>
        <p>Was du hier änderst, sieht der Kunde sofort in seinem Portal.</p>
      </header>

      <section className="cgr-kacheln" aria-label="Kennzahlen">
        {kacheln.map((x, i) => (
          <div key={x.titel} className={`cgr-kachel${x.ton ? ` ${x.ton}` : ""}`} style={{ animationDelay: `${i * 50}ms` }}>
            <i><x.Icon size={16} strokeWidth={1.75} /></i>
            <b>{laedt && !daten ? "—" : <Hochzaehler ziel={x.wert} formatieren={zahl} />}</b>
            <span>{x.titel}</span>
            <small>{x.satz}</small>
          </div>
        ))}
      </section>

      <ChefGlobalEinstellungen />

      {fehler && <Fehlermeldung text={fehler} erneut={neu} />}

      <div className="cgr-raum">
        <aside className="cgr-liste" aria-label="Mandate">
          <div className="cgr-liste-kopf">
            <b>Mandate</b>
            <button type="button" className={`cgr-schalter${testZeigen ? " an" : ""}`} onClick={() => setTestZeigen((v) => !v)} title="Als Test markierte Aufträge zeigen">
              <FlaskConical size={13} strokeWidth={1.8} /> Tests
            </button>
          </div>
          {laedt && !daten && <Geruest zeilen={4} />}
          {sichtbar.map((m, i) => {
            const prozent = Math.round((m.fortschritt.erledigt / m.fortschritt.gesamt) * 100);
            const neuZahl = m.anfragenNeu + m.uploadsNeu;
            return (
              <button key={m.ref} type="button" className={`cgr-mandat${gewaehlt === m.ref ? " an" : ""}${m.test ? " test" : ""}`}
                      onClick={() => waehlen(m.ref)} style={{ animationDelay: `${i * 40}ms` }}>
                <span className="cgr-ring" style={{ ["--p" as any]: `${prozent}` }} aria-label={`${prozent} % des Fahrplans`}>
                  <span>{initialen(m.kunde || m.firma || m.ref)}</span>
                </span>
                <span className="cgr-mandat-text">
                  <b>{m.kunde || m.firma || m.ref}</b>
                  <small>{m.llc ? `${m.llc}${m.bundesstaat ? ` · ${m.bundesstaat}` : ""}` : (m.firma && m.firma !== m.kunde ? m.firma : m.ref)}</small>
                  <span className="cgr-mandat-marken">
                    <em className={`st-${m.status}`}>{STATUS_TEXT[m.status] ?? m.status}</em>
                    {m.test && <em className="st-test">Test</em>}
                    {m.portalNeu && <em className="st-portal">Neues Portal</em>}
                  </span>
                </span>
                {neuZahl > 0 && <span className="cgr-neu" title={`${m.anfragenNeu} Anfragen, ${m.uploadsNeu} Uploads neu`}>{neuZahl}</span>}
              </button>
            );
          })}
          {daten && sichtbar.length === 0 && <p className="cgr-leer">Noch kein Global-Auftrag.</p>}

          {daten && daten.angebote.length > 0 && (
            <>
              <div className="cgr-liste-kopf zwei"><b>Angebote in Arbeit</b></div>
              {daten.angebote.map((a) => (
                <a key={a.id} className="cgr-angebot" href="/chef/s/global-auftraege?reiter=angebote">
                  <span className="cgr-angebot-art">{ANGEBOT_ART[a.art]}</span>
                  <b>{a.firma || a.kunde}</b>
                  <small>
                    {a.status === "angenommen" ? `angenommen ${a.angenommenAm ? datum(a.angenommenAm) : ""}` : `offen · gültig bis ${datum(a.gueltigBis)}`}
                    {a.art === "begleit" && a.status === "angenommen" ? " · noch ohne Global-Akte" : ""}
                  </small>
                </a>
              ))}
            </>
          )}

        </aside>

        <main className="cgr-akte-huelle">
          {gewaehlt ? <MandatAkte key={gewaehlt} gref={gewaehlt} onGeaendert={neu} />
            : !laedt && <div className="cgr-akte leer"><Globe2 size={28} strokeWidth={1.4} /><p>Wähle links ein Mandat.</p></div>}
        </main>
      </div>
    </div>
  );
}

// ── Ein Mandat ───────────────────────────────────────────────────────────────
type Reiter = "ueberblick" | "gesellschaft" | "kapital" | "tresor" | "post" | "anfragen" | "fristen" | "ki" | "verlauf";

function MandatAkte({ gref, onGeaendert }: { gref: string; onGeaendert: () => void }) {
  const { daten, laedt, fehler, neu } = useDaten<{ ok: true; mandat: any; kundenLink: string; vorschauUrl: string }>(`/chef/global/mandate/${encodeURIComponent(gref)}`);
  const [reiter, setReiter] = useState<Reiter>("ueberblick");
  const [meldung, setMeldung] = useState<{ text: string; gut: boolean } | null>(null);
  const [kopiert, setKopiert] = useState(false);
  const m = daten?.mandat;
  const r = encodeURIComponent(gref);

  useEffect(() => { if (!meldung) return; const t = setTimeout(() => setMeldung(null), 5200); return () => clearTimeout(t); }, [meldung]);

  const tun = async (pfad: string, methode: "POST" | "DELETE", body?: unknown) => {
    const j = await senden(`/chef/global/mandate/${r}${pfad}`, methode, body);
    setMeldung({ text: j.ok ? String(j.meldung ?? "Gespeichert.") : String(j.error), gut: j.ok });
    if (j.ok) { neu(); onGeaendert(); }
    return j.ok;
  };

  const kopieren = async () => {
    try { await navigator.clipboard.writeText(daten?.kundenLink ?? ""); setKopiert(true); setTimeout(() => setKopiert(false), 1800); } catch { /* egal */ }
  };

  if (fehler) return <div className="cgr-akte"><Fehlermeldung text={fehler} erneut={neu} /></div>;
  if (!m) return <div className="cgr-akte"><Geruest zeilen={8} /></div>;

  const name = [m.kontakt?.vorname, m.kontakt?.nachname].filter(Boolean).join(" ") || m.firma?.name || gref;
  const anfragenNeu = (m.nachrichten as any[]).filter((n) => n.von === "kunde" && !n.gelesen).length;
  const post = (m.dokumente as any[]).filter((d) => d.art === "post");
  const REITER: { key: Reiter; titel: string; Icon: any; zahl?: number }[] = [
    { key: "ueberblick", titel: "Überblick", Icon: Sparkles },
    { key: "gesellschaft", titel: "Gesellschaft & Fahrplan", Icon: Building2 },
    { key: "kapital", titel: "Banken & Kapital", Icon: Landmark, zahl: (m.kapital as any[]).length || undefined },
    { key: "tresor", titel: "Tresor", Icon: FileText, zahl: (m.dokumente as any[]).filter((d) => d.art !== "post").length || undefined },
    { key: "post", titel: "Post", Icon: Inbox, zahl: post.length || undefined },
    { key: "anfragen", titel: "Anfragen", Icon: MessageSquare, zahl: anfragenNeu || undefined },
    { key: "fristen", titel: "Fristen", Icon: CalendarClock, zahl: (m.fristen as any[]).filter((f) => !f.erledigt).length || undefined },
    { key: "ki", titel: "KI-Gespräche", Icon: Sparkles },
    { key: "verlauf", titel: "Verlauf", Icon: History },
  ];

  return (
    <div className="cgr-akte">
      {meldung && <div className={`cgr-meldung${meldung.gut ? "" : " schlecht"}`} role="status">{meldung.text}</div>}

      <div className="cgr-akte-kopf">
        <span className="cgr-avatar">{initialen(name)}</span>
        <div className="cgr-akte-titel">
          <small>{gref} · {m.paketName}</small>
          <h2>{name}</h2>
          <p>
            {m.firma?.name && m.firma.name !== name ? `${m.firma.name} · ` : ""}
            {m.gesellschaft?.name ? <b>{m.gesellschaft.name}</b> : "US-Gesellschaft noch ohne Namen"}
            {m.gesellschaft?.bundesstaatName ? ` · ${m.gesellschaft.bundesstaatName}` : ""}
          </p>
          <div className="cgr-akte-marken">
            <em className={`st-${m.status}`}>{STATUS_TEXT[m.status] ?? m.status}</em>
            <em className={m.portal.neu ? "st-portal" : "st-leise"}>{m.portal.neu ? `Neues Portal seit ${datum(m.portal.seit)}` : "Bisheriges Portal"}</em>
            {m.test && <em className="st-test">Test</em>}
            {m.zustaendig && <em className="st-leise">Zuständig: {m.zustaendig.name}</em>}
          </div>
        </div>
        <div className="cgr-akte-tun">
          <a className="cw-knopf cgr-haupt" href={daten?.vorschauUrl} target="_blank" rel="noopener" title="Öffnet das neue Portal genau so, wie der Kunde es sieht — nichts gilt als gelesen.">
            <Eye size={15} /> Kundenportal ansehen
          </a>
          <button type="button" className="cw-knopf" onClick={kopieren} title="Der Link des Kunden (ein Jahr gültig, verlängert sich beim Besuch)">
            {kopiert ? <Check size={15} /> : <Copy size={15} />} {kopiert ? "Kopiert" : "Kunden-Link"}
          </button>
        </div>
      </div>

      <nav className="cgr-reiter" aria-label="Bereiche des Mandats">
        {REITER.map((x) => (
          <button key={x.key} type="button" className={reiter === x.key ? "an" : ""} onClick={() => {
            setReiter(x.key);
            if (x.key === "anfragen" && anfragenNeu > 0) void senden(`/chef/global/mandate/${r}/anfragen-gelesen`, "POST").then(() => onGeaendert());
          }}>
            <x.Icon size={14} strokeWidth={1.8} /> {x.titel}{x.zahl ? <span>{x.zahl}</span> : null}
          </button>
        ))}
      </nav>

      <div className="cgr-reiter-inhalt" key={reiter}>
        {reiter === "ueberblick" && <Ueberblick m={m} tun={tun} setReiter={setReiter} />}
        {reiter === "gesellschaft" && <Gesellschaft m={m} tun={tun} />}
        {reiter === "kapital" && <Kapital m={m} tun={tun} />}
        {reiter === "tresor" && <Tresor m={m} tun={tun} gref={gref} />}
        {reiter === "post" && <Post m={m} tun={tun} gref={gref} />}
        {reiter === "anfragen" && <Anfragen m={m} tun={tun} />}
        {reiter === "fristen" && <Fristen m={m} tun={tun} />}
        {reiter === "ki" && <KiGespraeche gref={gref} />}
        {reiter === "verlauf" && <Verlauf m={m} tun={tun} />}
      </div>
      {laedt && <div className="cgr-laedt" aria-hidden="true" />}
    </div>
  );
}

type Tun = (pfad: string, methode: "POST" | "DELETE", body?: unknown) => Promise<boolean>;

// ── Überblick ────────────────────────────────────────────────────────────────
function Ueberblick({ m, tun, setReiter }: { m: any; tun: Tun; setReiter: (r: Reiter) => void }) {
  const [etappeWahl, setEtappeWahl] = useState<number | null>(null);
  const [etappeText, setEtappeText] = useState("");
  const [etappeMail, setEtappeMail] = useState(true);
  const [schritt, setSchritt] = useState(m.naechsterSchritt?.text ?? "");
  const [schrittBis, setSchrittBis] = useState(m.naechsterSchritt?.bis ?? "");
  const [stichtag, setStichtag] = useState(m.stichtag ?? "");
  const [stichtagMail, setStichtagMail] = useState(false);
  const schritte = m.schritte as any[];
  const erledigt = schritte.filter((s) => s.status === "erledigt").length;
  const gesamt = schritte.filter((s) => s.status !== "entfaellt").length || 1;
  const offeneUnterschriften = (m.dokumente as any[]).filter((d) => d.unterschrift?.gefordert && !d.unterschrift?.unterschrieben);
  const anfragenNeu = (m.nachrichten as any[]).filter((n) => n.von === "kunde" && !n.gelesen).length;
  const garantie = m.angebot?.garantieZiel;

  return (
    <div className="cgr-gitter">
      <section className="cgr-block breit">
        <h3>Der Weg des Kunden</h3>
        <div className="cgr-etappen">
          {GLOBAL_ETAPPEN.map((e) => {
            const stand = (m.etappen as any[]).find((x) => x.nr === e.nr)?.stand ?? "offen";
            return (
              <button key={e.nr} type="button" className={`cgr-etappe ${stand}${etappeWahl === e.nr ? " gewaehlt" : ""}`}
                      disabled={m.status === "offen" || m.status === "storniert"}
                      title={m.status === "offen" ? "Etappen setzt du nach dem Zahlungseingang." : `Auf Etappe ${e.nr} setzen`}
                      onClick={() => { setEtappeWahl(e.nr); setEtappeText(""); }}>
                <span>{e.nr}</span><b>{e.de.titel}</b>
              </button>
            );
          })}
        </div>
        {m.status === "offen" && <p className="cgr-satz">Etappen starten mit dem Zahlungseingang — den Fahrplan kannst du schon pflegen.</p>}
        {etappeWahl !== null && (
          <div className="cgr-form zeile">
            <input value={etappeText} onChange={(e) => setEtappeText(e.target.value)} placeholder="Satz an den Kunden (optional, er liest ihn)" />
            <label className="cgr-haken"><input type="checkbox" checked={etappeMail} onChange={(e) => setEtappeMail(e.target.checked)} /> per Mail mitteilen</label>
            <button type="button" className="cw-knopf cgr-haupt" onClick={async () => { if (await tun("/etappe", "POST", { etappe: etappeWahl, text: etappeText, mitteilen: etappeMail })) setEtappeWahl(null); }}>
              Etappe {etappeWahl} setzen
            </button>
            <button type="button" className="cw-knopf" onClick={() => setEtappeWahl(null)}>Abbrechen</button>
          </div>
        )}
        <div className="cgr-fortschritt">
          <span style={{ width: `${Math.round((erledigt / gesamt) * 100)}%` }} />
        </div>
        <p className="cgr-satz">{erledigt} von {gesamt} Schritten erledigt. <button type="button" className="cgr-link" onClick={() => setReiter("gesellschaft")}>Fahrplan öffnen</button></p>
      </section>

      <section className="cgr-block">
        <h3>Jetzt zu tun</h3>
        <ul className="cgr-todo">
          {m.status === "offen" && <li className="gelb"><Landmark size={14} /> Zahlung offen{m.angebot?.teile?.[0] ? ` — ${m.angebot.teile[0].titel}` : ""}</li>}
          {anfragenNeu > 0 && <li className="blau"><MessageSquare size={14} /> {anfragenNeu} neue {anfragenNeu === 1 ? "Anfrage" : "Anfragen"} — <button type="button" className="cgr-link" onClick={() => setReiter("anfragen")}>antworten</button></li>}
          {offeneUnterschriften.length > 0 && <li><PenLine size={14} /> {offeneUnterschriften.length} Unterschrift{offeneUnterschriften.length === 1 ? "" : "en"} beim Kunden offen</li>}
          {(m.unterlagen as any[]).filter((u) => !u.vorhanden).length > 0 && m.status !== "offen" && (
            <li><FileText size={14} /> Unterlagen fehlen: {(m.unterlagen as any[]).filter((u) => !u.vorhanden).map((u) => u.titel).join(", ")}</li>
          )}
          {(m.fristen as any[]).filter((f) => !f.erledigt).slice(0, 2).map((f) => (
            <li key={f.id}><CalendarClock size={14} /> {f.titel} — {datum(f.faelligAm)}</li>
          ))}
          {m.status !== "offen" && anfragenNeu === 0 && offeneUnterschriften.length === 0 && (m.fristen as any[]).filter((f) => !f.erledigt).length === 0 && (
            <li className="gruen"><ShieldCheck size={14} /> Nichts offen.</li>
          )}
        </ul>
      </section>

      <section className="cgr-block">
        <h3>Nächster Schritt <small>(sieht der Kunde)</small></h3>
        <div className="cgr-form">
          <textarea rows={2} value={schritt} onChange={(e) => setSchritt(e.target.value)} placeholder="z. B. Wir reichen die Gründung beim Bundesstaat ein." />
          <div className="cgr-form zeile">
            <label>bis <input type="date" value={schrittBis} onChange={(e) => setSchrittBis(e.target.value)} /></label>
            <button type="button" className="cw-knopf" onClick={() => tun("/naechster-schritt", "POST", { text: schritt, bis: schrittBis || null })}>Speichern</button>
          </div>
        </div>
        <h3 className="zwei">Stichtag</h3>
        <div className="cgr-form zeile">
          <input type="date" value={stichtag} onChange={(e) => setStichtag(e.target.value)} />
          <label className="cgr-haken"><input type="checkbox" checked={stichtagMail} onChange={(e) => setStichtagMail(e.target.checked)} /> Mail</label>
          <button type="button" className="cw-knopf" onClick={() => tun("/stichtag", "POST", { stichtag, mitteilen: stichtagMail })} disabled={!stichtag}>Setzen</button>
        </div>
      </section>

      <section className="cgr-block">
        <h3>Kunde</h3>
        <dl className="cgr-daten">
          <dt>Name</dt><dd>{[m.kontakt?.anrede, m.kontakt?.vorname, m.kontakt?.nachname].filter(Boolean).join(" ") || "—"}</dd>
          <dt>E-Mail</dt><dd>{m.kontakt?.email || "—"}</dd>
          <dt>Telefon</dt><dd>{m.kontakt?.telefon || "—"}</dd>
          {m.firmaVoll?.name && m.firmaVoll?.art !== "privat" && <><dt>Firma</dt><dd>{String(m.firmaVoll.name)}</dd></>}
          <dt>Sprache</dt><dd>{m.sprache === "en" ? "Englisch" : "Deutsch"}</dd>
          {m.person && <><dt>Personenakte</dt><dd><a className="cgr-link" href={`/akte/${m.person.id}`}>Person {m.person.id} <ExternalLink size={11} /></a>{m.person.gesperrt ? <span className="cgr-leise"> · für Privat-Abläufe gesperrt</span> : null}</dd></>}
        </dl>
      </section>

      <section className="cgr-block">
        <h3>Vertrag &amp; Zahlung</h3>
        <dl className="cgr-daten">
          <dt>Paket</dt><dd>{m.paketName}</dd>
          <dt>Erteilt</dt><dd>{datum(m.erstelltAm)}</dd>
          <dt>Bezahlt</dt><dd>{m.bezahltAm ? datum(m.bezahltAm) : "offen"}</dd>
          {m.rechnungsnummer && <><dt>Rechnung</dt><dd>{m.rechnungsnummer}</dd></>}
          {(m.angebot?.teile as any[] | undefined)?.map((t) => (
            <div key={t.nr} className="cgr-teil"><dt>Teil {t.nr}</dt><dd>{t.titel} · {(t.betragCents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 })} € · {t.stand}</dd></div>
          ))}
          {garantie && <><dt>Garantieziel</dt><dd>{String(garantie)}</dd></>}
        </dl>
        <div className="cgr-form zeile">
          {m.vertragUrl && <a className="cw-knopf" href={m.vertragUrl} target="_blank" rel="noreferrer"><FileText size={14} /> Vertrag</a>}
          {m.rechnungUrl && <a className="cw-knopf" href={m.rechnungUrl} target="_blank" rel="noreferrer"><FileText size={14} /> Rechnung</a>}
        </div>
      </section>

      <section className="cgr-block breit cgr-freigabe">
        <h3>Kundenportal</h3>
        <p className="cgr-satz">
          {m.portal.neu
            ? <>Der Kunde sieht das <b>neue Portal</b> (freigeschaltet {datumZeit(m.portal.seit)}{m.portal.von ? ` von ${m.portal.von}` : ""}).</>
            : <>Der Kunde sieht noch das <b>bisherige Portal</b>. Erst „Kundenportal ansehen“, dann freischalten.</>}
        </p>
        <div className="cgr-form zeile">
          <button type="button" className={`cw-knopf${m.portal.neu ? "" : " cgr-haupt"}`} onClick={() => {
            const an = !m.portal.neu;
            if (an && !window.confirm(`Neues Portal für ${[m.kontakt?.vorname, m.kontakt?.nachname].filter(Boolean).join(" ") || "diesen Kunden"} freischalten? Er sieht es ab seinem nächsten Besuch.`)) return;
            void tun("/portal", "POST", { an });
          }}>
            {m.portal.neu ? <><EyeOff size={14} /> Wieder bisheriges Portal</> : <><Sparkles size={14} /> Neues Portal freischalten</>}
          </button>
          <button type="button" className="cw-knopf" onClick={() => { if (window.confirm("Den Link zu „Mein Auftrag“ jetzt per Mail an den Kunden schicken?")) void tun("/zugang-senden", "POST"); }}>
            <Send size={14} /> Link per Mail senden
          </button>
          <button type="button" className="cw-knopf" onClick={() => tun("/test", "POST", { an: !m.test })}>
            <FlaskConical size={14} /> {m.test ? "Test-Markierung entfernen" : "Als Test markieren"}
          </button>
        </div>
      </section>
    </div>
  );
}

// ── Gesellschaft & Fahrplan ──────────────────────────────────────────────────
function Gesellschaft({ m, tun }: { m: any; tun: Tun }) {
  const g = m.gesellschaft ?? {};
  const p = m.gesellschaftPlus ?? {};
  const [grund, setGrund] = useState({
    name: g.name ?? "", form: g.form ?? "LLC", bundesstaat: g.bundesstaat ?? "", gegruendetAm: g.gegruendetAm ?? "",
    einVorhanden: g.einVorhanden ?? false, itinStand: g.itinStand ?? "",
  });
  const [plus, setPlus] = useState<Record<string, string>>(Object.fromEntries(GLOBAL_GESELLSCHAFT_PLUS_FELDER.map((f) => [f.feld, String(p[f.feld] ?? "")])));
  const [offen, setOffen] = useState<string | null>(null);

  const speichern = () => tun("/gesellschaft", "POST", {
    grund: { ...grund, einVorhanden: grund.einVorhanden || !!plus.ein, itinStand: grund.itinStand || null, bundesstaat: grund.bundesstaat || null, gegruendetAm: grund.gegruendetAm || null },
    plus,
  });

  return (
    <div className="cgr-gitter">
      <section className="cgr-block breit">
        <h3>Die US-Gesellschaft <small>(sieht der Kunde)</small></h3>
        <div className="cgr-felder">
          <label>Name<input value={grund.name} onChange={(e) => setGrund({ ...grund, name: e.target.value })} placeholder="MUSTER LLC" /></label>
          <label>Form<select value={grund.form} onChange={(e) => setGrund({ ...grund, form: e.target.value })}><option>LLC</option><option>Corporation</option></select></label>
          <label>Bundesstaat<select value={grund.bundesstaat} onChange={(e) => setGrund({ ...grund, bundesstaat: e.target.value })}>
            <option value="">—</option>
            {Object.entries(US_BUNDESSTAATEN).map(([code, n]) => <option key={code} value={code}>{n}</option>)}
          </select></label>
          <label>Gegründet am<input type="date" value={grund.gegruendetAm} onChange={(e) => setGrund({ ...grund, gegruendetAm: e.target.value })} /></label>
          <label>ITIN<select value={grund.itinStand} onChange={(e) => setGrund({ ...grund, itinStand: e.target.value })}>
            <option value="">—</option><option value="offen">offen</option><option value="beantragt">beantragt</option><option value="vorhanden">vorhanden</option>
          </select></label>
          {GLOBAL_GESELLSCHAFT_PLUS_FELDER.map((f) => (
            <label key={f.feld} className={f.feld === "usAdresse" || f.feld === "hinweis" ? "breit" : ""}>
              {f.titel.de}
              {f.feld === "usAdresse" || f.feld === "hinweis"
                ? <textarea rows={2} value={plus[f.feld]} onChange={(e) => setPlus({ ...plus, [f.feld]: e.target.value })} />
                : <input value={plus[f.feld]} onChange={(e) => setPlus({ ...plus, [f.feld]: e.target.value })} placeholder={f.feld === "ein" ? "12-3456789" : ""} />}
            </label>
          ))}
        </div>
        <div className="cgr-form zeile"><button type="button" className="cw-knopf cgr-haupt" onClick={speichern}>Gesellschaft speichern</button>
          <span className="cgr-leise" title="Annual Report, Form 5472/1120">Bundesstaat + Gründungstag erzeugen die Pflichtfristen.</span></div>
      </section>

      <section className="cgr-block breit">
        <h3>Fahrplan <small>(sieht der Kunde; „Entfällt“ blendet aus)</small></h3>
        {[1, 2, 3, 4].map((etappe) => (
          <div key={etappe} className="cgr-fahrplan-etappe">
            <h4>Etappe {etappe} · {GLOBAL_ETAPPEN.find((e) => e.nr === etappe)?.de.titel}</h4>
            {(m.schritte as any[]).filter((s) => s.etappe === etappe).map((s) => (
              <SchrittZeile key={s.schluessel} s={s} offen={offen === s.schluessel} umschalten={() => setOffen(offen === s.schluessel ? null : s.schluessel)} tun={tun} />
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}

function SchrittZeile({ s, offen, umschalten, tun }: { s: any; offen: boolean; umschalten: () => void; tun: Tun }) {
  const [hinweis, setHinweis] = useState(s.hinweis ?? "");
  const [intern, setIntern] = useState(s.intern ?? "");
  const [datumWert, setDatum] = useState(s.datum ?? "");
  const setzen = (status: string) => tun("/schritt", "POST", { schluessel: s.schluessel, status, datum: datumWert || null, hinweis, intern });
  return (
    <div className={`cgr-schritt ${s.status}`}>
      <div className="cgr-schritt-zeile">
        <span className="cgr-schritt-punkt" aria-hidden="true" />
        <button type="button" className="cgr-schritt-titel" onClick={umschalten}>
          <b>{s.titel}</b>
          <small>{s.datum ? datum(s.datum) : ""}{s.hinweis ? ` · „${s.hinweis}“` : ""}</small>
        </button>
        <div className="cgr-segment" role="group" aria-label={`Status ${s.titel}`}>
          {GLOBAL_SCHRITT_STATUS.map((st) => (
            <button key={st} type="button" className={s.status === st ? "an" : ""} onClick={() => setzen(st)}>{GLOBAL_SCHRITT_STATUS_TEXT[st].de}</button>
          ))}
        </div>
      </div>
      {offen && (
        <div className="cgr-form cgr-schritt-mehr">
          <p className="cgr-leise">{s.text}</p>
          <label>Datum<input type="date" value={datumWert} onChange={(e) => setDatum(e.target.value)} /></label>
          <label>Hinweis für den Kunden<input value={hinweis} onChange={(e) => setHinweis(e.target.value)} placeholder="z. B. Eingereicht am 14.10., Bearbeitung beim Staat läuft." /></label>
          <label>Interne Notiz<input value={intern} onChange={(e) => setIntern(e.target.value)} /></label>
          <button type="button" className="cw-knopf" onClick={() => setzen(s.status)}>Speichern</button>
        </div>
      )}
    </div>
  );
}

// ── Banken & Kapital ─────────────────────────────────────────────────────────
const LEER_KAPITAL = { id: 0, art: "konto", institut: "", produkt: "", status: "vorbereitung", betragUsd: "", beantragtAm: "", entschiedenAm: "", hinweis: "", intern: "", sichtbar: true };
function Kapital({ m, tun }: { m: any; tun: Tun }) {
  const [form, setForm] = useState<typeof LEER_KAPITAL | null>(null);
  const liste = m.kapital as any[];
  const ziel = m.angebot?.garantieZiel;
  const speichern = async () => { if (form && await tun("/kapital", "POST", form)) setForm(null); };
  return (
    <div className="cgr-gitter">
      <section className="cgr-block breit">
        <div className="cgr-block-kopf">
          <h3>Banken &amp; Kapital <small>Konto, Karten, Kreditrahmen, Darlehen</small></h3>
          <button type="button" className="cw-knopf cgr-haupt" onClick={() => setForm({ ...LEER_KAPITAL })}><Plus size={14} /> Eintrag</button>
        </div>
        <div className="cgr-summe">
          <span>Zugesagt / aktiv</span><b>{globalUsd(m.zugesagtCents)}</b>
          {ziel && <small>Garantieziel laut Vertrag: {String(ziel)}</small>}
        </div>
        {form && (
          <div className="cgr-felder cgr-karte-form">
            <label>Art<select value={form.art} onChange={(e) => setForm({ ...form, art: e.target.value })}>{GLOBAL_KAPITAL_ARTEN.map((a) => <option key={a.art} value={a.art}>{a.titel.de}</option>)}</select></label>
            <label>Institut<input value={form.institut} onChange={(e) => setForm({ ...form, institut: e.target.value })} /></label>
            <label>Produkt<input value={form.produkt} onChange={(e) => setForm({ ...form, produkt: e.target.value })} /></label>
            <label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{GLOBAL_KAPITAL_STATUS.map((a) => <option key={a.status} value={a.status}>{a.titel.de}</option>)}</select></label>
            <label>Betrag / Limit (USD)<input inputMode="numeric" value={form.betragUsd} onChange={(e) => setForm({ ...form, betragUsd: e.target.value })} placeholder="25000" /></label>
            <label>Beantragt am<input type="date" value={form.beantragtAm} onChange={(e) => setForm({ ...form, beantragtAm: e.target.value })} /></label>
            <label>Entschieden am<input type="date" value={form.entschiedenAm} onChange={(e) => setForm({ ...form, entschiedenAm: e.target.value })} /></label>
            <label className="breit">Hinweis für den Kunden<input value={form.hinweis} onChange={(e) => setForm({ ...form, hinweis: e.target.value })} /></label>
            <label className="breit">Interne Notiz<input value={form.intern} onChange={(e) => setForm({ ...form, intern: e.target.value })} /></label>
            <label className="cgr-haken"><input type="checkbox" checked={form.sichtbar} onChange={(e) => setForm({ ...form, sichtbar: e.target.checked })} /> Kunde sieht diesen Eintrag</label>
            <div className="cgr-form zeile breit">
              <button type="button" className="cw-knopf cgr-haupt" onClick={speichern}>{form.id ? "Speichern" : "Anlegen"}</button>
              <button type="button" className="cw-knopf" onClick={() => setForm(null)}>Abbrechen</button>
            </div>
          </div>
        )}
        {liste.length === 0 && !form && <p className="cgr-leer">Noch nichts erfasst.</p>}
        <div className="cgr-kapital">
          {liste.map((k) => {
            const ton = GLOBAL_KAPITAL_STATUS.find((s) => s.status === k.status)?.ton ?? "leise";
            return (
              <div key={k.id} className={`cgr-kapital-karte ${ton}`}>
                <div><small>{k.artText}</small><b>{k.institut || "Institut offen"}</b>{k.produkt && <em>{k.produkt}</em>}</div>
                <div className="cgr-kapital-rechts">
                  {k.betragCents != null && <b>{globalUsd(k.betragCents)}</b>}
                  <span className={`cgr-pille ${ton}`}>{k.statusText}</span>
                </div>
                <small className="cgr-leise">
                  {k.beantragtAm ? `beantragt ${datum(k.beantragtAm)}` : ""}{k.entschiedenAm ? ` · entschieden ${datum(k.entschiedenAm)}` : ""}
                  {!k.sichtbar ? " · nur intern" : ""}{k.hinweis ? ` · „${k.hinweis}“` : ""}
                </small>
                <div className="cgr-mini">
                  <button type="button" onClick={() => setForm({ id: k.id, art: k.art, institut: k.institut ?? "", produkt: k.produkt ?? "", status: k.status, betragUsd: k.betragCents != null ? String(k.betragCents / 100) : "", beantragtAm: k.beantragtAm ?? "", entschiedenAm: k.entschiedenAm ?? "", hinweis: k.hinweis ?? "", intern: k.intern ?? "", sichtbar: !!k.sichtbar })}>Bearbeiten</button>
                  <button type="button" onClick={() => { if (window.confirm("Diesen Eintrag entfernen?")) void tun(`/kapital/${k.id}`, "DELETE"); }}>Entfernen</button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ── Tresor ───────────────────────────────────────────────────────────────────
function Ablage({ gref, tun, fest, portalNeu }: { gref: string; tun: Tun; fest?: "post"; portalNeu: boolean }) {
  const [art, setArt] = useState<string>(fest ?? "sonstiges");
  const [titel, setTitel] = useState("");
  const [sichtbar, setSichtbar] = useState(true);
  const [unterschrift, setUnterschrift] = useState(false);
  const [mitteilen, setMitteilen] = useState(fest === "post");
  const [absender, setAbsender] = useState("");
  const [eingang, setEingang] = useState(new Date().toISOString().slice(0, 10));
  const [datei, setDatei] = useState<File | null>(null);
  const [zieht, setZieht] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  void gref;
  const ablegen = async () => {
    if (!datei) return;
    const f = new FormData();
    f.append("datei", datei); f.append("art", art); f.append("titel", titel);
    f.append("sichtbar", String(sichtbar)); f.append("unterschrift", String(unterschrift)); f.append("mitteilen", String(mitteilen));
    if (art === "post") { f.append("postAbsender", absender); f.append("postEingang", eingang); }
    setLaeuft(true);
    const ok = await tun("/dokument", "POST", f);
    setLaeuft(false);
    if (ok) { setDatei(null); setTitel(""); setAbsender(""); setUnterschrift(false); }
  };
  const gruppen = GLOBAL_TRESOR.filter((k) => k.kategorie !== "vertrag");
  return (
    <div className={`cgr-ablage${zieht ? " zieht" : ""}`}
         onDragOver={(e) => { e.preventDefault(); setZieht(true); }} onDragLeave={() => setZieht(false)}
         onDrop={(e) => { e.preventDefault(); setZieht(false); const f = e.dataTransfer.files?.[0]; if (f) setDatei(f); }}>
      <label className="cgr-ablage-feld">
        <Upload size={18} strokeWidth={1.6} />
        <span>{datei ? <b>{datei.name}</b> : <>Datei hierher ziehen oder <u>auswählen</u></>}</span>
        <small>PDF, JPG, PNG, HEIC · bis 15 MB</small>
        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,application/pdf,image/*" onChange={(e) => setDatei(e.target.files?.[0] ?? null)} />
      </label>
      <div className="cgr-felder">
        {!fest && (
          <label>Art<select value={art} onChange={(e) => setArt(e.target.value)}>
            {gruppen.map((g) => (
              <optgroup key={g.kategorie} label={g.titel.de}>
                {GLOBAL_DOKUMENTARTEN.filter((a) => globalTresorKategorie(a.art) === g.kategorie && a.art !== "post").map((a) => <option key={a.art} value={a.art}>{a.de}</option>)}
              </optgroup>
            ))}
          </select></label>
        )}
        {art === "post" ? (
          <>
            <label>Absender<input value={absender} onChange={(e) => setAbsender(e.target.value)} placeholder="z. B. Florida Department of State" /></label>
            <label>Eingegangen am<input type="date" value={eingang} onChange={(e) => setEingang(e.target.value)} /></label>
          </>
        ) : (
          <label>Titel (optional)<input value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="z. B. Vollmacht für die EIN-Beantragung" /></label>
        )}
        <div className="cgr-haken-reihe breit">
          {art !== "post" && <label className="cgr-haken"><input type="checkbox" checked={sichtbar || unterschrift} disabled={unterschrift} onChange={(e) => setSichtbar(e.target.checked)} /> Kunde sieht es</label>}
          {art !== "post" && <label className="cgr-haken"><input type="checkbox" checked={unterschrift} onChange={(e) => setUnterschrift(e.target.checked)} /> Unterschrift anfordern (PDF)</label>}
          <label className="cgr-haken"><input type="checkbox" checked={mitteilen} onChange={(e) => setMitteilen(e.target.checked)} /> Kunde per Mail informieren</label>
        </div>
      </div>
      {unterschrift && !portalNeu && <p className="cgr-warnung">Bisheriges Portal zeigt keine Unterschrift — erst neues Portal freischalten (Überblick).</p>}
      <button type="button" className="cw-knopf cgr-haupt" disabled={!datei || laeuft || (art === "post" && !absender.trim())} onClick={ablegen}>
        <Upload size={14} /> {laeuft ? "Lädt hoch …" : art === "post" ? "Post ablegen" : "In den Tresor legen"}
      </button>
    </div>
  );
}

function DokumentZeile({ d, tun }: { d: any; tun: Tun }) {
  const titel = d.titel || d.artText;
  return (
    <div className={`cgr-dok${d.von === "kunde" ? " vom-kunden" : ""}`}>
      <span className="cgr-dok-icon">{d.unterschrift?.gefordert ? <PenLine size={15} /> : <FileText size={15} />}</span>
      <a className="cgr-dok-text" href={d.url} target="_blank" rel="noreferrer">
        <b>{titel}</b>
        <small>{d.name} · {d.von === "kunde" ? "vom Kunden" : (d.vonName ?? "FIAON")} · {datum(d.am)}{d.post ? ` · ${d.post.absender ?? ""}` : ""}</small>
      </a>
      <span className="cgr-dok-marken">
        {d.unterschrift?.gefordert && <em className={d.unterschrift.unterschrieben ? "gruen" : "gelb"}>{d.unterschrift.unterschrieben ? `unterschrieben ${datum(d.unterschrift.am)}` : "wartet auf Unterschrift"}</em>}
        {d.von !== "kunde" && d.sichtbarFuerKunde && <em className={d.gelesen ? "gruen" : "leise"}>{d.gelesen ? "gelesen" : "ungelesen"}</em>}
        {d.von !== "kunde" && !d.sichtbarFuerKunde && <em className="leise"><Lock size={10} /> intern</em>}
      </span>
      <div className="cgr-mini">
        {d.von !== "kunde" && <button type="button" onClick={() => tun(`/dokument/${d.id}`, "POST", { sichtbar: !d.sichtbarFuerKunde })}>{d.sichtbarFuerKunde ? "Intern machen" : "Freigeben"}</button>}
        {d.istPdf && !d.unterschrift?.unterschrieben && d.von !== "kunde" && <button type="button" onClick={() => tun(`/dokument/${d.id}`, "POST", { unterschrift: !d.unterschrift?.gefordert })}>{d.unterschrift?.gefordert ? "Keine Unterschrift" : "Unterschrift anfordern"}</button>}
        <button type="button" onClick={() => { if (window.confirm(`„${titel}“ aus dem Tresor entfernen?`)) void tun(`/dokument/${d.id}`, "DELETE"); }}><Trash2 size={12} /></button>
      </div>
    </div>
  );
}

function Tresor({ m, tun, gref }: { m: any; tun: Tun; gref: string }) {
  const doks = (m.dokumente as any[]).filter((d) => d.art !== "post");
  const nach = new Map<GlobalTresorKategorie, any[]>();
  for (const d of doks) { const k = (d.kategorie ?? "sonstiges") as GlobalTresorKategorie; nach.set(k, [...(nach.get(k) ?? []), d]); }
  return (
    <div className="cgr-gitter">
      <section className="cgr-block breit">
        <h3>Ablegen</h3>
        <Ablage gref={gref} tun={tun} portalNeu={!!m.portal?.neu} />
      </section>
      <section className="cgr-block breit">
        <h3>Im Tresor</h3>
        <div className="cgr-mappe">
          <div className="cgr-mappe-kopf"><b>Vertrag und Rechnungen</b><small>immer im Portal</small></div>
          {m.vertragUrl && <a className="cgr-dok" href={m.vertragUrl} target="_blank" rel="noreferrer"><span className="cgr-dok-icon"><FileText size={15} /></span><span className="cgr-dok-text"><b>Vertrag</b><small>unterschrieben {datum(m.erstelltAm)}</small></span></a>}
          {m.rechnungUrl && <a className="cgr-dok" href={m.rechnungUrl} target="_blank" rel="noreferrer"><span className="cgr-dok-icon"><FileText size={15} /></span><span className="cgr-dok-text"><b>Rechnung</b><small>{m.rechnungsnummer ?? ""}</small></span></a>}
          <a className="cgr-link" href="/chef/s/global-auftraege?reiter=angebote">Nachweise &amp; Sicherheiten aus dem Angebot verwalten →</a>
        </div>
        {GLOBAL_TRESOR.filter((k) => k.kategorie !== "vertrag" && k.kategorie !== "post" && nach.has(k.kategorie)).map((k) => (
          <div key={k.kategorie} className="cgr-mappe">
            <div className="cgr-mappe-kopf"><b>{k.titel.de}</b><small>{nach.get(k.kategorie)!.length}</small></div>
            {nach.get(k.kategorie)!.map((d) => <DokumentZeile key={d.id} d={d} tun={tun} />)}
          </div>
        ))}
        {doks.length === 0 && <p className="cgr-leer">Noch keine Dokumente im Tresor.</p>}
      </section>
    </div>
  );
}

function Post({ m, tun, gref }: { m: any; tun: Tun; gref: string }) {
  const post = (m.dokumente as any[]).filter((d) => d.art === "post");
  return (
    <div className="cgr-gitter">
      <section className="cgr-block breit">
        <h3>Post ablegen <small>erscheint im Briefkasten des Kunden</small></h3>
        <Ablage gref={gref} tun={tun} fest="post" portalNeu={!!m.portal?.neu} />
      </section>
      <section className="cgr-block breit">
        <h3>Briefkasten</h3>
        {post.length === 0 ? <p className="cgr-leer">Noch keine Post.</p> : post.map((d) => <DokumentZeile key={d.id} d={d} tun={tun} />)}
      </section>
    </div>
  );
}

// ── Anfragen ─────────────────────────────────────────────────────────────────
function Anfragen({ m, tun }: { m: any; tun: Tun }) {
  const [text, setText] = useState("");
  const [mail, setMail] = useState(true);
  const faden = m.nachrichten as any[];
  return (
    <div className="cgr-gitter">
      <section className="cgr-block breit">
        <h3>Gespräch mit dem Kunden</h3>
        {!m.portal?.neu && <p className="cgr-warnung">Bisheriges Portal zeigt keine Antworten — zusätzlich per Mail oder Telefon antworten.</p>}
        <div className="cgr-faden">
          {faden.length === 0 && <p className="cgr-leer">Noch keine Anfrage — neue landen hier und auf dem Board.</p>}
          {faden.map((n) => (
            <div key={n.id} className={`cgr-blase ${n.von}`}>
              <p>{n.text}</p>
              <small>{n.von === "kunde" ? "Kunde" : n.autor} · {datumZeit(n.am)}{n.von === "fiaon" ? (n.gelesen ? " · gelesen" : " · noch nicht gelesen") : ""}</small>
            </div>
          ))}
        </div>
        <div className="cgr-form">
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Antwort an den Kunden (im Portal)" />
          <div className="cgr-form zeile">
            <label className="cgr-haken"><input type="checkbox" checked={mail} onChange={(e) => setMail(e.target.checked)} /> Kunde per Mail informieren (ohne Inhalt)</label>
            <button type="button" className="cw-knopf cgr-haupt" disabled={text.trim().length < 2} onClick={async () => { if (await tun("/antwort", "POST", { text, mitteilen: mail })) setText(""); }}>
              <Send size={14} /> Antworten
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

// ── Fristen ──────────────────────────────────────────────────────────────────
function Fristen({ m, tun }: { m: any; tun: Tun }) {
  const [titel, setTitel] = useState("");
  const [faellig, setFaellig] = useState("");
  const [hinweis, setHinweis] = useState("");
  return (
    <div className="cgr-gitter">
      <section className="cgr-block breit">
        <h3 title="Annual Report, Steuer, Registered Agent">Pflichtenkalender <small>sieht der Kunde · Erinnerung 30 und 7 Tage vorher</small></h3>
        {(m.fristen as any[]).length === 0 && <p className="cgr-leer">Keine Fristen — entstehen mit Bundesstaat und Gründungstag.</p>}
        {(m.fristen as any[]).map((f) => (
          <div key={f.id} className={`cgr-frist${f.erledigt ? " erledigt" : ""}`}>
            <b>{datum(f.faelligAm)}</b>
            <span><b>{f.titel}</b>{f.hinweis && <small>{f.hinweis}</small>}</span>
            <em>{f.quelle === "regel" ? "automatisch" : "von Hand"}</em>
            <div className="cgr-mini">
              <button type="button" onClick={() => tun(`/frist/${f.id}`, "POST", { erledigt: !f.erledigt })}>{f.erledigt ? "Wieder offen" : "Erledigt"}</button>
              {f.quelle !== "regel" && <button type="button" onClick={() => { if (window.confirm("Frist löschen?")) void tun(`/frist/${f.id}`, "DELETE"); }}><Trash2 size={12} /></button>}
            </div>
          </div>
        ))}
        <div className="cgr-felder">
          <label>Neue Frist<input value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="z. B. Steuererklärung 2026 (Form 1120)" /></label>
          <label>Fällig am<input type="date" value={faellig} onChange={(e) => setFaellig(e.target.value)} /></label>
          <label className="breit">Hinweis<input value={hinweis} onChange={(e) => setHinweis(e.target.value)} /></label>
          <button type="button" className="cw-knopf cgr-haupt" disabled={!titel || !faellig} onClick={async () => { if (await tun("/frist", "POST", { titel, faelligAm: faellig, hinweis })) { setTitel(""); setFaellig(""); setHinweis(""); } }}><Plus size={14} /> Frist anlegen</button>
        </div>
      </section>
    </div>
  );
}

// ── KI-Gespräche (E-341) ─────────────────────────────────────────────────────
const FACH_NAME: Record<string, string> = { strategie: "Strategie & Wachstum", recht: "Recht & Verträge", steuern: "Steuern & Pflichten", expose: "Bank-Exposé" };
function KiGespraeche({ gref }: { gref: string }) {
  const { daten, laedt, fehler } = useDaten<{ ok: true; chats: { bereich: string; rolle: string; text: string; am: string; vorschau: boolean }[] }>(`/chef/global/mandate/${encodeURIComponent(gref)}/fach`);
  const chats = daten?.chats ?? [];
  return (
    <div className="cgr-gitter">
      <section className="cgr-block breit">
        <h3>KI-Antworten an den Kunden <small>Strategie · Recht · Steuern · durch die Wortwand geprüft</small></h3>
        {laedt && <Geruest zeilen={3} />}
        {fehler && <Fehlermeldung text={fehler} />}
        {!laedt && chats.length === 0 && <p className="cgr-leer">Noch keine Fragen an die KI.</p>}
        <div className="cgr-faden">
          {chats.map((c, i) => (
            <div key={i} className={`cgr-blase ${c.rolle === "kunde" ? "kunde" : "fiaon"}`}>
              <p>{c.text}</p>
              <small>{c.rolle === "kunde" ? "Kunde" : "KI"} · {FACH_NAME[c.bereich] ?? c.bereich} · {datumZeit(c.am)}{c.vorschau ? " · Vorschau (Chefbüro)" : ""}</small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ── Verlauf ──────────────────────────────────────────────────────────────────
function Verlauf({ m, tun }: { m: any; tun: Tun }) {
  const [text, setText] = useState("");
  const [sichtbar, setSichtbar] = useState(false);
  const zeilen = (m.intern?.verlaufAlles ?? []) as any[];
  return (
    <div className="cgr-gitter">
      <section className="cgr-block breit">
        <h3>Notiz</h3>
        <div className="cgr-form">
          <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Interne Notiz (oder für den Kunden sichtbar)" />
          <div className="cgr-form zeile">
            <label className="cgr-haken"><input type="checkbox" checked={sichtbar} onChange={(e) => setSichtbar(e.target.checked)} /> Kunde sieht die Notiz</label>
            <button type="button" className="cw-knopf" disabled={text.trim().length < 2} onClick={async () => { if (await tun("/notiz", "POST", { text, sichtbar })) setText(""); }}>Speichern</button>
          </div>
        </div>
      </section>
      <section className="cgr-block breit">
        <h3>Verlauf</h3>
        <ol className="cgr-verlauf">
          {zeilen.map((v, i) => (
            <li key={i} className={v.sichtbar ? "sichtbar" : ""}>
              <small>{datumZeit(v.am)} · {v.von ?? "System"}{v.sichtbar ? " · Kunde sieht es" : ""}</small>
              <p>{v.text}</p>
            </li>
          ))}
        </ol>
      </section>
      <p className="cgr-leise">Zuletzt geändert {seit(zeilen[0]?.am)}.</p>
    </div>
  );
}

