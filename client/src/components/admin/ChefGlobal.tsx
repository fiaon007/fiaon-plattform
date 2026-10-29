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
import { useEffect, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import {
  Globe2, Building2, FileText, MessageSquare, Landmark, CalendarClock, History, Eye, Copy, Check,
  Upload, Trash2, PenLine, Lock, EyeOff, Send, Plus, Sparkles, ShieldCheck, Inbox, ExternalLink, FlaskConical, Layers, ListChecks,
} from "lucide-react";
import { API, Hochzaehler, zahl, datum, datumZeit, seit, Geruest, Fehlermeldung, useDaten } from "./chef-teile";
import { GLOBAL_DOKUMENTARTEN, globalKundeDarfArt } from "@shared/fiaon-global-bereich";
import {
  GLOBAL_KAPITAL_ARTEN, GLOBAL_KAPITAL_STATUS,
  GLOBAL_TRESOR, globalTresorKategorie, globalUsd, type GlobalTresorKategorie,
} from "@shared/fiaon-global-mandat";
import "@/styles/chef-global-raum.css";
// E-443 (28.10.2026): der Rundgang des Raums (Nachladen, Marke „Neu“, „bitte neu“, Aufgaben).
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "@/pages/agent/rundgaenge";
import "@/styles/office-rundgang.css";

// E-443 (28.10.2026): Justin — „Man kann über das Chef-Dashboard kaum arbeiten, es läuft nicht synchron mit dem
// Kundenportal.“ Das Portal lud jede Minute nach, das Chefbüro nie. Jetzt lädt der Raum leise im selben Takt nach
// (nur bei sichtbarem Tab, sofort beim Zurückkehren) — ohne Ladebalken, ohne Fehlermeldung, ohne offene Eingaben anzufassen.
const NACHLADEN_MS = 60_000;
// E-342: Gespräche je Tag + Google-Kalender als Leiste im Raum.
import ChefGlobalEinstellungen from "./ChefGlobalEinstellungen";
// 22.10.2026: der Stationen-Editor (auch im Office).
import GlobalStationen from "@/components/global/GlobalStationen";
import GlobalFormulare from "@/components/global/GlobalFormulare";
// E-423: Kundenzugänge (persönlicher Zugang) — „Zugang einladen“ / „Einladung erneut senden“.
import ChefGlobalZugaenge from "./ChefGlobalZugaenge";
// E-462 (29.10.2026): der Arbeitsablauf je Kunde (Gründung beim Registered Agent bis ITIN) als Reiter.
import ChefGlobalArbeitsablauf from "./ChefGlobalArbeitsablauf";

// ── Typen (so, wie der Server sie schickt) ───────────────────────────────────
interface MandatZeile {
  ref: string; status: string; paket: string; kunde: string; firma: string | null; email: string | null; personId: number | null;
  llc: string | null; bundesstaat: string | null; etappe: number; fortschritt: { erledigt: number; gesamt: number };
  naechsterSchritt: string | null; stichtag: string | null; naechsteFrist: string | null; zustaendig: string | null;
  anfragenNeu: number; uploadsNeu: number; unterschriftenOffen: number; postUngelesen: number; test: boolean; portalNeu: boolean; angelegtAm: string;
}
interface AngebotZeile { id: number; angebotRef: string; status: string; art: "firma" | "begleit" | "individuell" | "kapital" | "koop"; kunde: string; firma: string | null; gueltigBis: string | null; angenommenAm: string | null; personId: number | null }
interface Liste { mandate: MandatZeile[]; angebote: AngebotZeile[]; kennzahlen: Record<string, number> }

const STATUS_TEXT: Record<string, string> = { offen: "Zahlung offen", bezahlt: "Bezahlt", gestartet: "In Arbeit", abgeschlossen: "Abgeschlossen", storniert: "Storniert" };
const ANGEBOT_ART: Record<string, string> = { firma: "Firmenangebot", begleit: "Begleitvertrag", individuell: "Individualangebot", kapital: "Kapital-Angebot", koop: "Kooperation" };

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
  const { daten, laedt, fehler, neu } = useDaten<Liste & { ok: true }>("/chef/global/mandate", [], NACHLADEN_MS);
  const [testZeigen, setTestZeigen] = useState(false);
  // 22.10.2026: „Global-Akte anlegen“ für ein angenommenes Begleit-Angebot — Ergebnis bleibt stehen (Erfolg mit Nummer, Fehler rot).
  const [akteLaeuft, setAkteLaeuft] = useState<number | null>(null);
  const [akteMeldung, setAkteMeldung] = useState<{ id: number; text: string; gut: boolean } | null>(null);
  const akteAnlegen = async (id: number) => {
    setAkteLaeuft(id); setAkteMeldung(null);
    const j = await senden(`/chef/global/angebote/${id}/akte`, "POST");
    setAkteLaeuft(null);
    setAkteMeldung({ id, text: j.ok ? String(j.meldung) : String(j.error), gut: j.ok });
    if (j.ok) { neu(); if (j.ref) navigate(`/chef/global?mandat=${encodeURIComponent(String(j.ref))}`); }
  };
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
      <Rundgang raum="chef-global" titel="Global-Mandate" schritte={RUNDGAENGE.chefGlobal.schritte} />
      <header className="cgr-kopf">
        <span className="cb-pille">Chefbüro · FIAON Global</span>
        <h1><span className="cb-verlauf">Global-Mandate</span></h1>
        <p>Was du hier änderst, sieht der Kunde sofort in seinem Portal — und was er tut, erscheint hier von selbst (jede Minute).</p>
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
      <ChefGlobalZugaenge />

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
                <div key={a.id} className="cgr-angebot-huelle">
                  <a className="cgr-angebot" href="/chef/s/global-auftraege?reiter=angebote">
                    <span className="cgr-angebot-art">{ANGEBOT_ART[a.art] ?? "Angebot"}</span>
                    <b>{a.firma && a.firma !== a.kunde ? `${a.kunde} · ${a.firma}` : a.kunde}</b>
                    <small>
                      {a.status === "angenommen" ? `angenommen ${a.angenommenAm ? datum(a.angenommenAm) : ""}` : `offen · gültig bis ${datum(a.gueltigBis)}`}
                      {a.art === "begleit" && a.status === "angenommen" ? " · noch ohne Global-Akte" : ""}
                    </small>
                  </a>
                  {/* 22.10.2026: Der Begleitvertrag legt bei der Annahme nichts an — die Akte entsteht hier mit einem Klick (wiederholbar). */}
                  {a.art === "begleit" && a.status === "angenommen" && (
                    <button type="button" className="cgr-angebot-knopf" disabled={akteLaeuft === a.id} data-fiaon="begleit-akte-anlegen" onClick={() => void akteAnlegen(a.id)}>
                      {akteLaeuft === a.id ? "Legt an …" : "Global-Akte anlegen"}
                    </button>
                  )}
                  {akteMeldung?.id === a.id && <small className={`cgr-angebot-meldung${akteMeldung.gut ? " gut" : ""}`} role={akteMeldung.gut ? "status" : "alert"}>{akteMeldung.text}</small>}
                </div>
              ))}
            </>
          )}

        </aside>

        <main className="cgr-akte-huelle">
          {/* E-451 (28.10.2026): Nach jeder Änderung in der Akte lädt auch die Zahl am Menüpunkt „Global-Mandate“ sofort nach. */}
          {gewaehlt ? <MandatAkte key={gewaehlt} gref={gewaehlt} onGeaendert={() => { neu(); window.dispatchEvent(new Event("chef-global-geaendert")); }} />
            : !laedt && <div className="cgr-akte leer"><Globe2 size={28} strokeWidth={1.4} /><p>Wähle links ein Mandat.</p></div>}
        </main>
      </div>
    </div>
  );
}

// ── Ein Mandat ───────────────────────────────────────────────────────────────
type Reiter = "ueberblick" | "arbeitsablauf" | "gesellschaft" | "akte" | "unterschriften" | "kapital" | "tresor" | "post" | "anfragen" | "fristen" | "leistungen" | "ki" | "verlauf";

function MandatAkte({ gref, onGeaendert }: { gref: string; onGeaendert: () => void }) {
  const { daten, laedt, fehler, neu, leise } = useDaten<{ ok: true; mandat: any; kundenLink: string; vorschauUrl: string }>(`/chef/global/mandate/${encodeURIComponent(gref)}`, [], NACHLADEN_MS);
  const [reiter, setReiter] = useState<Reiter>("ueberblick");
  const [meldung, setMeldung] = useState<{ text: string; gut: boolean } | null>(null);
  const [kopiert, setKopiert] = useState(false);
  // E-462: „Station öffnen“ aus dem Arbeitsablauf — der Reiter „Fahrplan & Werte“ klappt genau diese Station auf.
  const [stationOffen, setStationOffen] = useState<string | null>(null);
  const reiterWechseln = (x: Reiter) => { setStationOffen(null); setReiter(x); };
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
  // E-443: Eine neue Datei geöffnet (neuer Tab) — der Server setzt „gesehen“; kurz danach leise nachladen, damit Marke,
  // Kachel und Zähler sofort stimmen (das Zurückkehren in den Tab lädt ohnehin nach).
  const geoeffnet = (d: any) => { if (d?.neu) window.setTimeout(() => { leise(); onGeaendert(); }, 1500); };
  // E-443 (28.10.2026, Gutachten): EINE Stelle für „Anfragen gelesen“ — gleich, ob über den Reiter, über „antworten“ unter
  // „Jetzt zu tun“ (so kommt man über den Aufgaben-Link an) oder weil bei offenem Reiter eine neue Nachricht nachgeladen
  // wurde. Gelesen → Akte neu (Zahl am Reiter, „Jetzt zu tun“); die Nachrichten-Aufgabe erledigt der Server.
  const anfragenUngelesen = m ? (m.nachrichten as any[]).filter((n) => n.von === "kunde" && !n.gelesen).length : 0;
  const gelesenLaeuft = useRef(false);
  useEffect(() => {
    if (reiter !== "anfragen" || anfragenUngelesen === 0 || gelesenLaeuft.current) return;
    gelesenLaeuft.current = true;
    void senden(`/chef/global/mandate/${r}/anfragen-gelesen`, "POST").then(() => { neu(); onGeaendert(); }).finally(() => { gelesenLaeuft.current = false; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reiter, anfragenUngelesen]);

  if (fehler) return <div className="cgr-akte"><Fehlermeldung text={fehler} erneut={neu} /></div>;
  if (!m) return <div className="cgr-akte"><Geruest zeilen={8} /></div>;

  const name = [m.kontakt?.vorname, m.kontakt?.nachname].filter(Boolean).join(" ") || m.firma?.name || gref;
  const anfragenNeu = (m.nachrichten as any[]).filter((n) => n.von === "kunde" && !n.gelesen).length;
  const post = (m.dokumente as any[]).filter((d) => d.art === "post");
  const REITER: { key: Reiter; titel: string; Icon: any; zahl?: number }[] = [
    { key: "ueberblick", titel: "Überblick", Icon: Sparkles },
    // E-462 (29.10.2026): der komplette Ablauf je Kunde — jedes Feld beim Registered Agent, Stand aus den Stationen, Haken von Hand.
    { key: "arbeitsablauf", titel: "Arbeitsablauf", Icon: ListChecks },
    { key: "gesellschaft", titel: "Fahrplan & Werte", Icon: Building2 },
    // 22.10.2026: die vollständige Akte — alle Rechnungen der Person, Verträge, Dokumente zur Unterschrift mit Vollständigkeit, ZIP.
    { key: "akte", titel: "Akte komplett", Icon: ShieldCheck },
    // 22.10.2026: Formulare erzeugen (vollständig oder gesperrt), FIAON unterschreibt, bereitstellen, prüfen.
    { key: "unterschriften", titel: "Dokumente & Unterschriften", Icon: PenLine },
    { key: "kapital", titel: "Banken & Kapital", Icon: Landmark, zahl: (m.kapital as any[]).length || undefined },
    { key: "tresor", titel: "Tresor", Icon: FileText, zahl: (m.dokumente as any[]).filter((d) => d.art !== "post").length || undefined },
    { key: "post", titel: "Post", Icon: Inbox, zahl: post.length || undefined },
    { key: "anfragen", titel: "Anfragen", Icon: MessageSquare, zahl: anfragenNeu || undefined },
    { key: "fristen", titel: "Fristen", Icon: CalendarClock, zahl: (m.fristen as any[]).filter((f) => !f.erledigt).length || undefined },
    // Scheibe 1 „Ihr US-Büro“ (22.10.2026): Zusatzdienste, die der Kunde im Portal hinzugefügt hat.
    { key: "leistungen", titel: "Leistungen", Icon: Layers },
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
            {/* E-451 (28.10.2026): immer sichtbar — auch, wenn niemand festgelegt ist (dann gehen die Aufgaben an die Vorgabe). */}
            <em className="st-leise">Zuständig: {m.zustaendig ? m.zustaendig.name : "nicht festgelegt"}</em>
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
          <button key={x.key} type="button" className={reiter === x.key ? "an" : ""} onClick={() => reiterWechseln(x.key)}>
            <x.Icon size={14} strokeWidth={1.8} /> {x.titel}{x.zahl ? <span>{x.zahl}</span> : null}
          </button>
        ))}
      </nav>

      <div className="cgr-reiter-inhalt" key={reiter}>
        {reiter === "ueberblick" && <Ueberblick m={m} tun={tun} setReiter={reiterWechseln} />}
        {reiter === "arbeitsablauf" && <ChefGlobalArbeitsablauf m={m} tun={tun} setReiter={reiterWechseln}
                                          stationOeffnen={(k) => { setStationOffen(k); setReiter("gesellschaft"); }} />}
        {reiter === "gesellschaft" && <Gesellschaft m={m} tun={tun} gref={gref} startOffen={stationOffen} onGespeichert={() => { neu(); onGeaendert(); }} />}
        {reiter === "akte" && <AkteKomplett gref={gref} tun={tun} />}
        {reiter === "unterschriften" && <GlobalFormulare basis={`/api/fiaon/chef/global/mandate/${r}`} ton="dunkel" onGeaendert={() => { neu(); onGeaendert(); }} />}
        {reiter === "kapital" && <Kapital m={m} tun={tun} />}
        {reiter === "tresor" && <Tresor m={m} tun={tun} gref={gref} geoeffnet={geoeffnet} />}
        {reiter === "post" && <Post m={m} tun={tun} gref={gref} geoeffnet={geoeffnet} />}
        {reiter === "anfragen" && <Anfragen m={m} tun={tun} />}
        {reiter === "fristen" && <Fristen m={m} tun={tun} />}
        {reiter === "leistungen" && <Leistungen gref={gref} tun={tun} />}
        {reiter === "ki" && <KiGespraeche gref={gref} />}
        {reiter === "verlauf" && <Verlauf m={m} tun={tun} />}
      </div>
      {laedt && <div className="cgr-laedt" aria-hidden="true" />}
    </div>
  );
}

type Tun = (pfad: string, methode: "POST" | "DELETE", body?: unknown) => Promise<boolean>;

// ── Zuständigkeit (E-451, 28.10.2026) ────────────────────────────────────────
// EINE Quelle: die Person in der Akte. Das Portal nennt sie als Ansprechpartner, die Aufgaben der Akte folgen ihr
// (globalAufgabenZiel), und hier wird sie gesetzt. Ohne Person sagt der Block offen, wohin was geht.
function Zustaendigkeit({ m, tun }: { m: any; tun: Tun }) {
  const z = (m.zustaendigkeit ?? {}) as { agentId: number | null; name: string | null; aufgabenAn?: string; portalNennt: string | null; auswahl?: { id: number; name: string }[] };
  const auswahl = z.auswahl ?? [];
  const [wahl, setWahl] = useState<string>(z.agentId ? String(z.agentId) : "");
  const [laeuft, setLaeuft] = useState(false);
  return (
    <section className="cgr-block">
      <h3>Zuständig</h3>
      <dl className="cgr-daten">
        <dt>Akte</dt><dd>{z.name ? <b>{z.name}</b> : "nicht festgelegt"}</dd>
        <dt>Aufgaben an</dt><dd>{z.aufgabenAn ?? "—"}</dd>
        <dt>Portal nennt</dt><dd>{z.portalNennt ?? "niemanden"}</dd>
      </dl>
      {!z.name && (
        <p className="cgr-warnung">Niemand ist festgelegt: Die Aufgaben gehen an die Vorgabe, das Portal nennt {z.portalNennt ?? "niemanden"}. Lege fest, wer die Akte führt — dann stimmen Portal, Aufgaben und Chefbüro überein.</p>
      )}
      <div className="cgr-form zeile">
        <select value={wahl} onChange={(e) => setWahl(e.target.value)} aria-label="Zuständige Person">
          <option value="">Person wählen …</option>
          {auswahl.map((a) => <option key={a.id} value={String(a.id)}>{a.name}</option>)}
        </select>
        <button type="button" className="cw-knopf cgr-haupt" disabled={!wahl || laeuft || Number(wahl) === z.agentId}
                title="Offene Aufgaben dieser Akte wandern mit; der Kunde bekommt keine Mail."
                onClick={async () => { setLaeuft(true); try { await tun("/zustaendig", "POST", { agentId: Number(wahl) }); } finally { setLaeuft(false); } }}>
          {laeuft ? "Legt fest …" : "Festlegen"}
        </button>
      </div>
    </section>
  );
}

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
  // E-443 (28.10.2026): dieselbe Unterlagen-Rechnung wie das Portal (abgelehnte zählen nicht) — und neue Kunden-Uploads.
  const fehlendeUnterlagen = m.status !== "offen" ? (m.unterlagen as any[]).filter((u) => !u.vorhanden) : [];
  const nachreichen = (m.nachreichen ?? []) as any[];
  const uploadsNeu = (m.dokumente as any[]).filter((d) => d.neu).length;

  return (
    <div className="cgr-gitter">
      <section className="cgr-block breit">
        <h3>Der Weg des Kunden</h3>
        {/* E-451 (28.10.2026): die Etappen genau so, wie der Kunde sie im Portal liest — aus derselben Server-Sicht (sichtBauen):
            beim Begleitvertrag seine eigenen (BEGLEIT_PORTAL), beim Kapital-Angebot KAPITAL_ETAPPEN — nicht mehr fest GLOBAL_ETAPPEN. */}
        <div className="cgr-etappen">
          {(m.etappen as { nr: number; titel: string; text?: string; stand: string }[]).map((e) => (
            <button key={e.nr} type="button" className={`cgr-etappe ${e.stand ?? "offen"}${etappeWahl === e.nr ? " gewaehlt" : ""}`}
                    disabled={m.status === "offen" || m.status === "storniert"}
                    title={m.status === "offen" ? "Etappen setzt du nach dem Zahlungseingang." : `Auf Etappe ${e.nr} setzen${e.text ? ` — ${e.text}` : ""}`}
                    onClick={() => { setEtappeWahl(e.nr); setEtappeText(""); }}>
              <span>{e.nr}</span><b>{e.titel}</b>
            </button>
          ))}
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
          {uploadsNeu > 0 && <li className="blau"><Upload size={14} /> {uploadsNeu} {uploadsNeu === 1 ? "neues Dokument" : "neue Dokumente"} vom Kunden — <button type="button" className="cgr-link" onClick={() => setReiter("tresor")}>ansehen</button></li>}
          {fehlendeUnterlagen.length > 0 && (
            <li><FileText size={14} /> Unterlagen fehlen: {fehlendeUnterlagen.map((u) => u.abgelehnt ? `${u.titel} (bitte neu)` : u.titel).join(", ")}</li>
          )}
          {nachreichen.map((x) => <li key={`n-${x.art}`}><FileText size={14} /> Bitte neu angefordert: {x.titel}</li>)}
          {(m.fristen as any[]).filter((f) => !f.erledigt).slice(0, 2).map((f) => (
            <li key={f.id}><CalendarClock size={14} /> {f.titel} — {datum(f.faelligAm)}</li>
          ))}
          {m.status !== "offen" && anfragenNeu === 0 && offeneUnterschriften.length === 0 && uploadsNeu === 0 && fehlendeUnterlagen.length === 0 && nachreichen.length === 0 && (m.fristen as any[]).filter((f) => !f.erledigt).length === 0 && (
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

      <Zustaendigkeit m={m} tun={tun} />

      <section className="cgr-block">
        <h3>Vertrag &amp; Zahlung</h3>
        <dl className="cgr-daten">
          <dt>Paket</dt><dd>{m.paketName}</dd>
          <dt>Erteilt</dt><dd>{datum(m.erstelltAm)}</dd>
          {/* E-443: dieselbe Quelle wie das Portal (zahlung.status aus der Bestellung); das Datum liefert der Server mit. */}
          <dt>Bezahlt</dt><dd>{m.bezahltAm ? datum(m.bezahltAm) : m.zahlung?.status === "bezahlt" ? "bezahlt" : "offen"}</dd>
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
// 22.10.2026 (Stationen-Editor): Je Station eine Karte mit Status, Datum und den echten Werten — EIN, ITIN (verschlüsselt),
// D-U-N-S, Telefon, Adressen, Konto, Karten, Kreditrahmen. Dasselbe Bauteil steht im Office (Global-Akte › Fahrplan & Werte).
// Das alte Gesellschafts-Formular ging darin auf; übrig bleibt der freie Hinweis für den Kunden.
function Gesellschaft({ m, tun, gref, onGespeichert, startOffen = null }: { m: any; tun: Tun; gref: string; onGespeichert: () => void; startOffen?: string | null }) {
  const [hinweis, setHinweis] = useState(String(m.gesellschaftPlus?.hinweis ?? ""));
  return (
    <div className="cgr-gitter">
      <section className="cgr-block breit">
        <GlobalStationen basis={`${API}/chef/global/mandate/${encodeURIComponent(gref)}`} ton="dunkel" onGespeichert={onGespeichert} startOffen={startOffen}
          daten={{
            schritte: m.schritte, gesellschaft: m.gesellschaft, gesellschaftPlus: m.gesellschaftPlus, kapital: m.kapital,
            dokumente: (m.dokumente as any[]).map((d) => ({ id: d.id, art: d.art, name: d.name, titel: d.titel, url: d.url, pflichtKey: d.pflichtKey, unterschrift: d.unterschrift })),
            kontaktVorschlag: m.kontaktVorschlag ?? null,
          }} />
      </section>
      <section className="cgr-block breit">
        <h3>Hinweis zur Gesellschaft <small>(sieht der Kunde unter „Ihre US-Gesellschaft“)</small></h3>
        <div className="cgr-form zeile">
          <input value={hinweis} maxLength={400} onChange={(e) => setHinweis(e.target.value)} placeholder="z. B. Der Annual Report ist bis 1. Mai fällig — wir erinnern Sie rechtzeitig." />
          <button type="button" className="cw-knopf" disabled={hinweis === String(m.gesellschaftPlus?.hinweis ?? "")} onClick={() => void tun("/gesellschaft", "POST", { plus: { hinweis } })}>Speichern</button>
        </div>
      </section>
    </div>
  );
}

// ── Banken & Kapital ─────────────────────────────────────────────────────────
const LEER_KAPITAL = { id: 0, art: "konto", institut: "", produkt: "", inhaber: "firma", status: "vorbereitung", betragUsd: "", beantragtAm: "", entschiedenAm: "", hinweis: "", intern: "", sichtbar: true };
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
        <p className="cgr-leise">Der Kunde sieht Art, Status, Datum und Hinweis — nie Institut oder Produkt, einen Betrag erst ab „Zugesagt“. Karten und Kreditrahmen pflegst du auch direkt an der Station im Reiter „Fahrplan &amp; Werte“.</p>
        <div className="cgr-summe">
          <span>Zugesagt / aktiv</span><b>{globalUsd(m.zugesagtCents)}</b>
          {ziel && <small>Garantieziel laut Vertrag: {String(ziel)}</small>}
        </div>
        {form && (
          <div className="cgr-felder cgr-karte-form">
            <label>Art<select value={form.art} onChange={(e) => setForm({ ...form, art: e.target.value })}>{GLOBAL_KAPITAL_ARTEN.map((a) => <option key={a.art} value={a.art}>{a.titel.de}</option>)}</select></label>
            <label>Institut<input value={form.institut} onChange={(e) => setForm({ ...form, institut: e.target.value })} /></label>
            <label>Produkt<input value={form.produkt} onChange={(e) => setForm({ ...form, produkt: e.target.value })} /></label>
            {form.art === "karte" && <label>Karte für<select value={form.inhaber} onChange={(e) => setForm({ ...form, inhaber: e.target.value })}><option value="firma">Firma</option><option value="privat">Privat</option></select></label>}
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
                  <button type="button" onClick={() => setForm({ id: k.id, art: k.art, institut: k.institut ?? "", produkt: k.produkt ?? "", inhaber: k.inhaber ?? "firma", status: k.status, betragUsd: k.betragCents != null ? String(k.betragCents / 100) : "", beantragtAm: k.beantragtAm ?? "", entschiedenAm: k.entschiedenAm ?? "", hinweis: k.hinweis ?? "", intern: k.intern ?? "", sichtbar: !!k.sichtbar })}>Bearbeiten</button>
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

// ── Akte komplett (22.10.2026) ───────────────────────────────────────────────
// Justin: „Denk an jedes Detail." Alle Rechnungen der PERSON (Paket, Angebotsteile, Fast-Track, LLC-Gründung,
// Zusatzdienste — nie Privat-Linie), alle Verträge, die Dokumente zur Unterschrift mit Vollständigkeit (grün = alles
// unterschrieben) und „Akte als ZIP“. Nach der rechtlichen Prüfung KEINE eigene Vollmacht: Zur Unterschrift kommen nach
// der Gründung die vorausgefüllten Formulare IRS SS-4 (FIAON als Third Party Designee) und IRS 8821, dazu jedes Dokument,
// das das Team „zur Unterschrift“ stellt. Das eigene E-SIGN-Unterschreiben baut eine spätere Scheibe.
const EURO = (c: number) => `${(c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const STAND_TEXT: Record<string, string> = { fehlt: "noch nicht abgelegt", vorbereitet: "vorbereitet (intern)", wartet: "zur Unterschrift", unterschrieben: "unterschrieben" };
function AkteKomplett({ gref, tun }: { gref: string; tun: Tun }) {
  const { daten, fehler, neu } = useDaten<{ ok: true; rechnungen: any[]; vertraege: any[]; pflicht: any; zipUrl: string }>(`/chef/global/mandate/${encodeURIComponent(gref)}/akte`, [], NACHLADEN_MS);
  const [hoch, setHoch] = useState<{ key: string; titel: string; datei: File | null; modus: "digital" | "handschriftlich"; scanFuer?: number } | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  if (fehler) return <Fehlermeldung text={fehler} erneut={neu} />;
  if (!daten) return <Geruest zeilen={6} />;
  const p = daten.pflicht;
  const hochladen = async () => {
    if (!hoch?.datei) return;
    const fd = new FormData();
    // Der unterschriebene Scan im Namen des Kunden (nur PDF) — legt die unterschriebene Fassung ab und die Aufgabe an.
    if (hoch.scanFuer) {
      fd.append("datei", hoch.datei);
      setLaeuft(true);
      if (await tun(`/dokument/${hoch.scanFuer}/scan`, "POST", fd)) { setHoch(null); neu(); }
      setLaeuft(false);
      return;
    }
    const formular = hoch.key !== "weitere";
    fd.append("art", formular ? (p?.eintraege?.find((e: any) => e.key === hoch.key)?.art ?? "steuer") : "sonstiges");
    fd.append("datei", hoch.datei); fd.append("sichtbar", "true"); fd.append("unterschrift", "true"); fd.append("mitteilen", "false");
    if (formular) fd.append("pflichtKey", hoch.key); else if (hoch.titel.trim()) fd.append("titel", hoch.titel.trim());
    fd.append("unterschriftArt", hoch.modus);
    setLaeuft(true);
    if (await tun("/dokument", "POST", fd)) { setHoch(null); neu(); }
    setLaeuft(false);
  };
  const anzahl = p?.eintraege?.length ?? 0;
  return (
    <div className="cgr-gitter">
      <section className="cgr-block breit" data-fiaon="chef-akte-pflicht">
        <div className="cgr-block-kopf">
          <h3>Dokumente zur Unterschrift <small>{anzahl === 0 ? "noch keine" : p?.vollstaendig ? "vollständig — alles unterschrieben" : `${p?.offen ?? 0} offen`}</small></h3>
          <a className="cw-knopf cgr-haupt" href={daten.zipUrl} data-fiaon="chef-akte-zip"><FileText size={14} /> Akte als ZIP</a>
        </div>
        <div className={`cgr-vollstaendig${p?.vollstaendig ? " gruen" : ""}`}><i style={{ width: `${anzahl ? Math.round(((anzahl - p.offen) / anzahl) * 100) : 0}%` }} /></div>
        {!p?.gegruendet && <p className="cgr-leise">Die Formulare IRS SS-4 und 8821 erscheinen hier (und beim Kunden), sobald der Gründungstag der LLC eingetragen ist — oder sobald du eines schon ablegst.</p>}
        <ul className="cgr-pflicht">
          {(p?.eintraege ?? []).map((e: any) => (
            <li key={e.key} className={`st-${e.stand}`}>
              <span className="cgr-schritt-punkt" aria-hidden="true" />
              <div><b>{e.titel}</b><small>{e.text || "vom Team zur Unterschrift gestellt"}{e.modus === "handschriftlich" ? " · von Hand (Kunde druckt, unterschreibt, scannt als PDF)" : " · digital im Portal"}</small></div>
              <span className={`cgr-pille ${e.stand === "unterschrieben" ? "gruen" : e.stand === "wartet" ? "blau" : ""}`}>{STAND_TEXT[e.stand] ?? e.stand}</span>
              <span className="cgr-mini">
                {e.formular && e.stand !== "unterschrieben" && <button type="button" onClick={() => setHoch({ key: e.key, titel: e.titel, datei: null, modus: e.modus })}>{e.stand === "fehlt" ? "Zur Unterschrift hochladen" : "Neue Fassung hochladen"}</button>}
                {e.stand === "wartet" && e.modus === "handschriftlich" && e.dokumentId && <button type="button" data-fiaon="chef-scan-im-namen" onClick={() => setHoch({ key: e.key, titel: e.titel, datei: null, modus: "handschriftlich", scanFuer: e.dokumentId })}>Unterschriebenen Scan hochladen</button>}
              </span>
            </li>
          ))}
        </ul>
        {!hoch && <div className="cgr-form zeile"><button type="button" className="cw-knopf" onClick={() => setHoch({ key: "weitere", titel: "", datei: null, modus: "digital" })}><Plus size={14} /> Weiteres Dokument zur Unterschrift</button></div>}
        {hoch && (
          <div className="cgr-form zeile">
            {hoch.key === "weitere" && !hoch.scanFuer
              ? <>
                  <input value={hoch.titel} onChange={(e) => setHoch({ ...hoch, titel: e.target.value })} placeholder="Titel für den Kunden, z. B. Bankformular" />
                  <select value={hoch.modus} onChange={(e) => setHoch({ ...hoch, modus: e.target.value as "digital" | "handschriftlich" })} aria-label="Wie unterschreibt der Kunde?">
                    <option value="digital">digital im Portal</option><option value="handschriftlich">von Hand (Scan als PDF)</option>
                  </select>
                </>
              : <span className="cgr-leise">{hoch.titel} — {hoch.scanFuer ? "unterschriebener Scan (nur PDF)" : "PDF"}:</span>}
            <input type="file" accept="application/pdf,.pdf" onChange={(e) => setHoch({ ...hoch, datei: e.target.files?.[0] ?? null })} />
            <button type="button" className="cw-knopf cgr-haupt" disabled={!hoch.datei || laeuft} onClick={() => void hochladen()}>{laeuft ? "Lädt …" : hoch.scanFuer ? "Als unterschrieben ablegen" : "Zur Unterschrift bereitstellen"}</button>
            <button type="button" className="cw-knopf" onClick={() => setHoch(null)}>Abbrechen</button>
          </div>
        )}
      </section>
      <section className="cgr-block breit" data-fiaon="chef-akte-rechnungen">
        <h3>Alle Rechnungen der Person <small>Global-Welt: Paket, Angebot, Einzelrechnungen, Zusatzdienste — nie die Privat-Linie</small></h3>
        {daten.rechnungen.length === 0 && <p className="cgr-leer">Keine Rechnung gefunden.</p>}
        <ul className="cgr-verlauf">
          {daten.rechnungen.map((r) => (
            <li key={r.bestellRef}>
              <small>{r.nummer ?? r.bestellRef} · {r.datum ? datum(r.datum) : "—"} · {r.art}</small>
              <p><b>{r.titel}</b> — {EURO(r.betragCents)} · <span className={`cgr-pille ${r.status === "bezahlt" ? "gruen" : r.status === "offen" ? "blau" : "rot"}`}>{r.statusText}</span>
                {r.pdfUrl && <> · <a className="cgr-link" href={r.pdfUrl} target="_blank" rel="noopener">PDF <ExternalLink size={11} /></a></>}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="cgr-block breit">
        <h3>Verträge und Vereinbarungen</h3>
        {daten.vertraege.length === 0 && <p className="cgr-leer">Kein Vertrags-PDF gespeichert.</p>}
        <ul className="cgr-verlauf">
          {daten.vertraege.map((v) => <li key={v.key}><small>{v.unter}</small><p><a className="cgr-link" href={v.url} target="_blank" rel="noopener"><b>{v.titel}</b> <ExternalLink size={11} /></a></p></li>)}
        </ul>
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

// E-443 (28.10.2026): Marke „Neu“ (Kunden-Upload, im Chefbüro noch nicht geöffnet), „bitte neu“ mit Grund für den Kunden
// und die Art eines Kunden-Uploads korrigieren. Öffnen der Datei = gesehen (Server, Dokument-Route).
const ARTEN_TRESOR = GLOBAL_TRESOR.filter((k) => k.kategorie !== "vertrag" && k.kategorie !== "post");
function DokumentZeile({ d, tun, geoeffnet, sprache }: { d: any; tun: Tun; geoeffnet?: (d: any) => void; sprache?: string }) {
  const titel = d.titel || d.artText;
  const [grund, setGrund] = useState<string | null>(null);
  // E-443 (28.10.2026, Gutachten): Sperre gegen Doppelklick (am Handy häufig) — sonst zwei gleiche Zeilen beim Kunden.
  const [laeuft, setLaeuft] = useState(false);
  // Kunden-Upload, aber keine unterschriebene Fassung (die gehört zum Nachweis der Unterschrift).
  const kundeFrei = d.von === "kunde" && !d.unterschriebeneFassungVon;
  // „bitte neu“ ist erledigt, sobald der Kunde dieselbe Unterlage neu eingereicht hat — grau „ersetzt“, nichts mehr zu tun.
  const ablehnungOffen = !!d.abgelehnt && !d.abgelehnt.erledigt;
  const englisch = sprache === "en";
  return (
    <div className={`cgr-dok${d.von === "kunde" ? " vom-kunden" : ""}${d.neu ? " neu" : ""}`} data-fiaon={d.neu ? "chef-dok-neu" : undefined}>
      <span className="cgr-dok-icon">{d.unterschrift?.gefordert ? <PenLine size={15} /> : <FileText size={15} />}</span>
      <a className="cgr-dok-text" href={d.url} target="_blank" rel="noreferrer" onClick={() => geoeffnet?.(d)}>
        <b>{titel}</b>
        <small>{d.name} · {d.von === "kunde" ? "vom Kunden" : (d.vonName ?? "FIAON")} · {datum(d.am)}{d.post ? ` · ${d.post.absender ?? ""}` : ""}</small>
        {d.abgelehnt && <small className={`cgr-dok-grund${ablehnungOffen ? "" : " ersetzt"}`}>{ablehnungOffen ? "Bitte neu" : "Ersetzt — war „bitte neu“"}: „{d.abgelehnt.grund}“ ({datum(d.abgelehnt.am)})</small>}
      </a>
      <span className="cgr-dok-marken">
        {d.neu && <em className="blau">Neu</em>}
        {d.abgelehnt && (ablehnungOffen ? <em className="rot">bitte neu</em> : <em className="leise">ersetzt</em>)}
        {d.unterschrift?.gefordert && <em className={d.unterschrift.unterschrieben ? "gruen" : "gelb"}>{d.unterschrift.unterschrieben ? `unterschrieben ${datum(d.unterschrift.am)}` : "wartet auf Unterschrift"}</em>}
        {d.von !== "kunde" && d.sichtbarFuerKunde && <em className={d.gelesen ? "gruen" : "leise"}>{d.gelesen ? "gelesen" : "ungelesen"}</em>}
        {d.von !== "kunde" && !d.sichtbarFuerKunde && <em className="leise"><Lock size={10} /> intern</em>}
      </span>
      <div className="cgr-mini">
        {kundeFrei && (
          <select className="cgr-dok-art" value={d.art} aria-label="Art des Dokuments" title="Art korrigieren — zählt danach für die richtige Unterlage"
                  onChange={(e) => { if (e.target.value !== d.art) void tun(`/dokument/${d.id}`, "POST", { art: e.target.value }); }}>
            {ARTEN_TRESOR.map((g) => (
              <optgroup key={g.kategorie} label={g.titel.de}>
                {/* E-443 (Gutachten): nur Arten, die der Kunde selbst einreicht — sonst entstünde eine Aufgabe, die er nie erledigen kann. */}
                {GLOBAL_DOKUMENTARTEN.filter((a) => globalTresorKategorie(a.art) === g.kategorie && a.art !== "post" && (globalKundeDarfArt(a.art) || a.art === d.art)).map((a) => <option key={a.art} value={a.art}>{a.de}</option>)}
              </optgroup>
            ))}
          </select>
        )}
        {kundeFrei && !d.abgelehnt && grund === null && <button type="button" data-fiaon="chef-dok-ablehnen" onClick={() => setGrund("")}>Bitte neu …</button>}
        {kundeFrei && ablehnungOffen && <button type="button" disabled={laeuft} onClick={async () => { setLaeuft(true); await tun(`/dokument/${d.id}`, "POST", { ablehnungZurueck: true }); setLaeuft(false); }}>„Bitte neu“ zurücknehmen</button>}
        {d.von !== "kunde" && <button type="button" onClick={() => tun(`/dokument/${d.id}`, "POST", { sichtbar: !d.sichtbarFuerKunde })}>{d.sichtbarFuerKunde ? "Intern machen" : "Freigeben"}</button>}
        {d.istPdf && !d.unterschrift?.unterschrieben && d.von !== "kunde" && <button type="button" onClick={() => tun(`/dokument/${d.id}`, "POST", { unterschrift: !d.unterschrift?.gefordert })}>{d.unterschrift?.gefordert ? "Keine Unterschrift" : "Unterschrift anfordern"}</button>}
        <button type="button" onClick={() => { if (window.confirm(`„${titel}“ aus dem Tresor entfernen?`)) void tun(`/dokument/${d.id}`, "DELETE"); }}><Trash2 size={12} /></button>
      </div>
      {grund !== null && (
        <div className="cgr-form zeile cgr-dok-form">
          <input value={grund} maxLength={300} autoFocus onChange={(e) => setGrund(e.target.value)}
                 placeholder={englisch ? "Reason in English, e.g. Photo instead of a scan — please upload a PDF scan" : "Grund für den Kunden, z. B. Foto statt Scan — bitte als PDF-Scan"} />
          <button type="button" className="cw-knopf cgr-haupt" disabled={laeuft || grund.trim().length < 8}
                  onClick={async () => { setLaeuft(true); const ok = await tun(`/dokument/${d.id}`, "POST", { ablehnen: grund.trim() }); setLaeuft(false); if (ok) setGrund(null); }}>
            {laeuft ? "Speichert …" : "Als „bitte neu“ markieren"}
          </button>
          <button type="button" className="cw-knopf" onClick={() => setGrund(null)}>Abbrechen</button>
          {/* E-443 (Gutachten): Der Kunde liest den Grund wörtlich — in seiner Portal-Sprache schreiben. */}
          <small className="cgr-leise">{englisch ? "Der Kunde liest Englisch — den Grund bitte auf Englisch schreiben. " : ""}Der Kunde sieht die Unterlage wieder unter „Für Sie zu tun“ — mit diesem Satz. Es geht keine Mail raus.</small>
        </div>
      )}
    </div>
  );
}

function Tresor({ m, tun, gref, geoeffnet }: { m: any; tun: Tun; gref: string; geoeffnet: (d: any) => void }) {
  const doks = (m.dokumente as any[]).filter((d) => d.art !== "post");
  const nach = new Map<GlobalTresorKategorie, any[]>();
  for (const d of doks) { const k = (d.kategorie ?? "sonstiges") as GlobalTresorKategorie; nach.set(k, [...(nach.get(k) ?? []), d]); }
  const neuZahl = (m.dokumente as any[]).filter((d) => d.neu).length;
  return (
    <div className="cgr-gitter">
      <section className="cgr-block breit">
        <h3>Ablegen</h3>
        <Ablage gref={gref} tun={tun} portalNeu={!!m.portal?.neu} />
      </section>
      <section className="cgr-block breit">
        <div className="cgr-block-kopf">
          <h3>Im Tresor {neuZahl > 0 && <small>{neuZahl} neu vom Kunden</small>}</h3>
          {/* E-443: alle Kunden-Uploads der Akte als gesehen — die Aufgaben „neue Unterlagen“/„unterschrieben“ erledigen sich. */}
          {neuZahl > 0 && <button type="button" className="cw-knopf" data-fiaon="chef-alle-gesehen" onClick={() => void tun("/gesehen", "POST")}><Check size={14} /> Alle als gesehen markieren</button>}
        </div>
        <div className="cgr-mappe">
          <div className="cgr-mappe-kopf"><b>Vertrag und Rechnungen</b><small>immer im Portal</small></div>
          {m.vertragUrl && <a className="cgr-dok" href={m.vertragUrl} target="_blank" rel="noreferrer"><span className="cgr-dok-icon"><FileText size={15} /></span><span className="cgr-dok-text"><b>Vertrag</b><small>unterschrieben {datum(m.erstelltAm)}</small></span></a>}
          {m.rechnungUrl && <a className="cgr-dok" href={m.rechnungUrl} target="_blank" rel="noreferrer"><span className="cgr-dok-icon"><FileText size={15} /></span><span className="cgr-dok-text"><b>Rechnung</b><small>{m.rechnungsnummer ?? ""}</small></span></a>}
          <a className="cgr-link" href="/chef/s/global-auftraege?reiter=angebote">Nachweise &amp; Sicherheiten aus dem Angebot verwalten →</a>
        </div>
        {GLOBAL_TRESOR.filter((k) => k.kategorie !== "vertrag" && k.kategorie !== "post" && nach.has(k.kategorie)).map((k) => (
          <div key={k.kategorie} className="cgr-mappe">
            <div className="cgr-mappe-kopf"><b>{k.titel.de}</b><small>{nach.get(k.kategorie)!.length}</small></div>
            {nach.get(k.kategorie)!.map((d) => <DokumentZeile key={d.id} d={d} tun={tun} geoeffnet={geoeffnet} sprache={m.sprache} />)}
          </div>
        ))}
        {doks.length === 0 && <p className="cgr-leer">Noch keine Dokumente im Tresor.</p>}
      </section>
    </div>
  );
}

function Post({ m, tun, gref, geoeffnet }: { m: any; tun: Tun; gref: string; geoeffnet: (d: any) => void }) {
  const post = (m.dokumente as any[]).filter((d) => d.art === "post");
  return (
    <div className="cgr-gitter">
      <section className="cgr-block breit">
        <h3>Post ablegen <small>erscheint im Briefkasten des Kunden</small></h3>
        <Ablage gref={gref} tun={tun} fest="post" portalNeu={!!m.portal?.neu} />
      </section>
      <section className="cgr-block breit">
        <h3>Briefkasten</h3>
        {post.length === 0 ? <p className="cgr-leer">Noch keine Post.</p> : post.map((d) => <DokumentZeile key={d.id} d={d} tun={tun} geoeffnet={geoeffnet} />)}
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
// ── Leistungen (Zusatzdienste) ───────────────────────────────────────────────
// Was der Kunde in „Ihr Büro erweitern“ hinzugefügt hat. Die Zahlung setzt „bezahlt“ von selbst (Zahlungseingang);
// hier: „bezahlt“ von Hand (Geld kam anders an — die Rechnung bleibt beim Zahlungsweg offen), „aktiv“, sobald
// eingerichtet, „storniert“ (offene Rechnung wird storniert; bezahlt → Erstattung nur von Hand). Der Kunde sieht jeden Schritt.
const LEISTUNG_STATUS: Record<string, { text: string; ton: string }> = {
  gebucht: { text: "Gebucht · Rechnung offen", ton: "blau" }, bezahlt: { text: "Bezahlt · einrichten", ton: "blau" },
  aktiv: { text: "Aktiv", ton: "gruen" }, storniert: { text: "Storniert", ton: "rot" },
};
function Leistungen({ gref, tun }: { gref: string; tun: Tun }) {
  const { daten, fehler, neu } = useDaten<{ ok: true; katalog: any[]; buchungen: any[] }>(`/chef/global/mandate/${encodeURIComponent(gref)}/zusatz`, [], NACHLADEN_MS);
  const [notiz, setNotiz] = useState<Record<number, string>>({});
  const [laeuft, setLaeuft] = useState<number | null>(null);
  if (fehler) return <Fehlermeldung text={fehler} erneut={neu} />;
  if (!daten) return <Geruest zeilen={4} />;
  const setzen = async (id: number, status: string, frage: string) => {
    if (!window.confirm(frage)) return;
    setLaeuft(id);
    if (await tun(`/zusatz/${id}/status`, "POST", { status, notiz: notiz[id] ?? "" })) { setNotiz((n) => ({ ...n, [id]: "" })); neu(); }
    setLaeuft(null);
  };
  return (
    <div className="cgr-gitter">
      <section className="cgr-block breit">
        <div className="cgr-block-kopf">
          <h3>Leistungen <small>Zusatzdienste aus „Ihr Büro erweitern“ — der Kunde sieht jeden Schritt</small></h3>
        </div>
        {daten.buchungen.length === 0 && <p className="cgr-leer">Noch kein Zusatzdienst gebucht.</p>}
        <div className="cgr-kapital">
          {daten.buchungen.map((b) => {
            const st = LEISTUNG_STATUS[b.status] ?? { text: b.status, ton: "leise" };
            return (
              <div key={b.id} className={`cgr-kapital-karte ${st.ton}`} data-fiaon="chef-leistung">
                <div><small>{b.preis}{b.angabe ? ` · ${b.angabe}` : ""}</small><b>{b.titel}</b><em>{b.rechnungsnummer ? `Rechnung ${b.rechnungsnummer}` : "Rechnung noch nicht erstellt"}{b.verwendungszweck ? ` · ${b.verwendungszweck}` : ""}{b.zahlungsstatus ? ` · Zahlung: ${b.zahlungsstatus}` : ""}</em></div>
                <div className="cgr-kapital-rechts">
                  <span className={`cgr-pille ${st.ton}`}>{st.text}</span>
                  {b.rechnungUrl && <a className="cgr-link" href={b.rechnungUrl} target="_blank" rel="noopener">Rechnung <ExternalLink size={12} /></a>}
                </div>
                <small className="cgr-leise">
                  gebucht {datumZeit(b.am)}{b.bezahltAm ? ` · bezahlt ${datum(b.bezahltAm)}${b.bezahltVon ? ` (${b.bezahltVon})` : ""}` : ""}
                  {b.aktivAm ? ` · aktiv ${datum(b.aktivAm)} (${b.aktivVon ?? "—"})` : ""}{b.storniertAm ? ` · storniert ${datum(b.storniertAm)} (${b.storniertVon ?? "—"})` : ""}
                  {b.mailAm ? " · Rechnungsmail raus" : b.mailFehler ? ` · Rechnungsmail NICHT raus: ${b.mailFehler}` : ""}
                  {b.notiz ? ` · Notiz: „${b.notiz}“` : ""}
                </small>
                {b.intern && <small className="cgr-leise">Intern: {b.intern}</small>}
                {b.status !== "storniert" && (
                  <div className="cgr-form zeile">
                    <input value={notiz[b.id] ?? ""} onChange={(e) => setNotiz((n) => ({ ...n, [b.id]: e.target.value }))} placeholder="Notiz (intern, optional)" />
                  </div>
                )}
                <div className="cgr-mini">
                  {b.status === "gebucht" && <button type="button" disabled={laeuft === b.id} onClick={() => void setzen(b.id, "bezahlt", "Als bezahlt markieren? Nur, wenn das Geld sicher eingegangen ist — die Rechnung wird hier NICHT gebucht.")}>Bezahlt (von Hand)</button>}
                  {(b.status === "gebucht" || b.status === "bezahlt") && <button type="button" disabled={laeuft === b.id} onClick={() => void setzen(b.id, "aktiv", "Ist der Dienst eingerichtet? Der Kunde sieht ihn danach als „Aktiv“.")}>Aktiv setzen</button>}
                  {b.status !== "storniert" && <button type="button" disabled={laeuft === b.id} onClick={() => void setzen(b.id, "storniert", "Diesen Dienst stornieren? Eine offene Rechnung wird storniert; eine bezahlte erstattest du von Hand.")}>Stornieren</button>}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <section className="cgr-block breit">
        <h3>Katalog <small>Preise und Texte: shared/fiaon-global-zusatz.ts</small></h3>
        <ul className="cgr-verlauf">
          {daten.katalog.map((k) => <li key={k.key}><small>{k.preis}{k.buchbar ? (k.freigegeben ? " · für Kunden freigegeben" : " · nicht freigegeben (Schalter oben im Raum)") : " · noch nicht buchbar"}</small><p><b>{k.titel}</b> — {k.intern}</p></li>)}
        </ul>
      </section>
    </div>
  );
}

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

