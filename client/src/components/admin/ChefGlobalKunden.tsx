// ═══════════════════════════════════════════════════════════════════════════
// CHEFBÜRO › GLOBAL-KUNDEN — der eigene Bereich für die Firmenkunden (E-455, 29.10.2026)
//
// Justin: „Das aktuelle Chef-Dashboard ist super kompliziert bei den Global-Kunden, alles so verteilt, versteckt —
//          nicht clean. Baue mir einen eigenen Bereich für die Global-Kunden in Global CI (Apple), übersichtlich,
//          erklärlich — aber so, dass alles 100 % passt, synchron läuft und funktioniert — auch so, dass wir immer
//          mit 1 Klick alles lösen können — Fahrplan haben für uns intern, alles steuern können."
//
// Ein eigener Raum (/chef/global-kunden), auf Justins Wunsch NEBEN dem Raum „Global-Mandate“ (/chef/global), der
// unverändert bleibt. Dieselben Daten und Endpunkte (server/routes/fiaon-chef-global.ts) — was ein Raum ändert, sieht
// der andere und das Kundenportal beim nächsten leisen Nachladen (60 s, E-443).
//
// Aufbau: links die Kundenliste (Filter „Braucht uns“ · „Wartet auf Kunde“ · „Alle“, Suche, Punkt bei Neuem); rechts die
// Akte von oben nach unten — Kopf, „Als Nächstes“ (EIN Knopf, shared/fiaon-global-als-naechstes.ts), Fahrplan als
// Zeitlinie, Dokumente, Nachrichten, Zahlungen, Firmendaten, Banken & Kapital, Fristen, Verlauf, Mehr. Am Telefon:
// Liste → Akte. Gestaltung: chef-global-kunden.css (.cgn-).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { API, datum, seit, Geruest, Fehlermeldung, useDaten } from "./chef-teile";
import { alsNaechstes, listenLage, naechsteStation, zaehlendeStationen, type ListenGruppe } from "@shared/fiaon-global-als-naechstes";
import { GLOBAL_FAHRPLAN_BEDARF, GLOBAL_SCHRITT_STATUS_TEXT, globalUsd, type GlobalSchrittStatus } from "@shared/fiaon-global-mandat";
import { stationStatusName } from "@shared/fiaon-global-stationen";
import {
  NACHLADEN_MS, Abschnitt, Dokumente, Firmendaten, Fristen, Kapital, Mehr, Nachrichten, Verlauf, Zahlungen,
  heuteBerlin, senden, tagDe, type Tun,
} from "./chef-global-kunden-teile";
import GlobalStationen from "@/components/global/GlobalStationen";
import ChefGlobalEinstellungen from "./ChefGlobalEinstellungen";
import ChefGlobalZugaenge from "./ChefGlobalZugaenge";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "@/pages/agent/rundgaenge";
import "@/styles/office-rundgang.css";
import "@/styles/chef-global-kunden.css";

type T = Record<string, any>;
/** Eine Station, wie die Chef-Sicht sie schickt. */
type Station = { schluessel: string } & T;
interface MandatZeile {
  ref: string; status: string; paket: string; kunde: string; firma: string | null; email: string | null; personId: number | null;
  llc: string | null; bundesstaat: string | null; etappe: number; fortschritt: { erledigt: number; gesamt: number };
  naechsterSchritt: string | null; stichtag: string | null; naechsteFrist: string | null; zustaendig: string | null;
  anfragenNeu: number; uploadsNeu: number; unterschriftenOffen: number; postUngelesen: number; test: boolean; portalNeu: boolean; angelegtAm: string;
}
interface AngebotZeile { id: number; angebotRef: string; status: string; art: string; kunde: string; firma: string | null; gueltigBis: string | null; angenommenAm: string | null }
interface Liste { ok: true; mandate: MandatZeile[]; angebote: AngebotZeile[]; kennzahlen: Record<string, number> }

const PFAD = "/chef/global-kunden";
const STATUS: Record<string, { text: string; ton?: "blau" | "gruen" | "rot" }> = {
  offen: { text: "Zahlung offen" }, bezahlt: { text: "Bezahlt", ton: "blau" }, gestartet: { text: "In Arbeit", ton: "blau" },
  abgeschlossen: { text: "Abgeschlossen", ton: "gruen" }, storniert: { text: "Storniert", ton: "rot" },
};
const ANGEBOT_ART: Record<string, string> = { firma: "Firmenangebot", begleit: "Begleitvertrag", individuell: "Individualangebot", kapital: "Kapital-Angebot", koop: "Kooperation" };
type Filter = "uns" | "kunde" | "alle";
const FILTER: { key: Filter; text: string }[] = [{ key: "uns", text: "Braucht uns" }, { key: "kunde", text: "Wartet auf Kunde" }, { key: "alle", text: "Alle" }];

/** Der Name, unter dem wir den Kunden führen: die US-Gesellschaft, sonst die Firma, sonst die Person. */
function anzeigeName(z: { llc?: string | null; firma?: string | null; kunde?: string; ref: string }): string {
  return z.llc || z.firma || z.kunde || z.ref;
}
const breit = () => typeof window !== "undefined" && !!window.matchMedia?.("(min-width: 961px)").matches;

// ═══ DER RAUM ════════════════════════════════════════════════════════════════
export default function ChefGlobalKunden() {
  const adresse = useSearch();
  const [, navigate] = useLocation();
  const gewaehlt = (() => { try { return new URLSearchParams(adresse).get("akte"); } catch { return null; } })();
  const { daten, laedt, fehler, neu } = useDaten<Liste>("/chef/global/mandate", [], NACHLADEN_MS);
  const [filter, setFilter] = useState<Filter>(() => { try { return (window.localStorage.getItem("cgn-filter") as Filter) || "uns"; } catch { return "uns"; } });
  const [suche, setSuche] = useState("");
  const [tests, setTests] = useState(false);
  const [angeboteAuf, setAngeboteAuf] = useState(false);
  const [untenAuf, setUntenAuf] = useState(false);
  const [akteLaeuft, setAkteLaeuft] = useState<number | null>(null);
  const [akteMeldung, setAkteMeldung] = useState<{ id: number; text: string; gut: boolean } | null>(null);
  const heute = heuteBerlin();

  useEffect(() => { try { window.localStorage.setItem("cgn-filter", filter); } catch { /* egal */ } }, [filter]);

  const zeilen = useMemo(() => (daten?.mandate ?? []).filter((m) => tests || !m.test).map((m) => ({ m, lage: listenLage(m, heute) })), [daten, tests, heute]);
  const zahl: Record<Filter, number> = {
    uns: zeilen.filter((z) => z.lage.gruppe === "uns").length, kunde: zeilen.filter((z) => z.lage.gruppe === "kunde").length, alle: zeilen.length,
  };
  const s = suche.trim().toLowerCase();
  const sichtbar = zeilen
    .filter((z) => filter === "alle" || z.lage.gruppe === (filter as ListenGruppe))
    .filter((z) => !s || [z.m.llc, z.m.firma, z.m.kunde, z.m.ref, z.m.email].some((x) => String(x ?? "").toLowerCase().includes(s)))
    .sort((a, b) => Number(b.lage.neu) - Number(a.lage.neu));

  const waehlen = (ref: string) => navigate(`${PFAD}?akte=${encodeURIComponent(ref)}`);
  // Breiter Bildschirm ohne Auswahl: die erste Akte der Liste öffnen — der Raum ist nie leer. Am Telefon bleibt die Liste stehen.
  useEffect(() => {
    if (gewaehlt || !breit() || !zeilen.length) return;
    const erste = sichtbar[0]?.m ?? zeilen[0].m;
    navigate(`${PFAD}?akte=${encodeURIComponent(erste.ref)}`, { replace: true });
  }, [gewaehlt, zeilen.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const akteAnlegen = async (id: number) => {
    setAkteLaeuft(id); setAkteMeldung(null);
    const j = await senden(`/chef/global/angebote/${id}/akte`, "POST");
    setAkteLaeuft(null);
    setAkteMeldung({ id, text: j.ok ? String(j.meldung) : String(j.error), gut: j.ok });
    if (j.ok) { neu(); if (j.ref) waehlen(String(j.ref)); }
  };

  const k = daten?.kennzahlen ?? {};
  const neuGesamt = (k.uploadsNeu ?? 0) + (k.anfragenNeu ?? 0);
  return (
    <div className={`cgn${gewaehlt ? " mit-akte" : ""}`}>
      <Rundgang raum="chef-global-kunden" titel="Global-Kunden" schritte={RUNDGAENGE.chefGlobalKunden.schritte} />
      <div className="cgn-tafel">
        <header className="cgn-kopf">
          <div>
            <span className="cgn-auge">Chefbüro · FIAON Global</span>
            <h1>Global-Kunden</h1>
          </div>
          <ul className="cgn-zahlen" aria-label="Kennzahlen" data-cgn="kennzahlen">
            <li><b>{k.aktiv ?? "—"}</b>aktiv</li>
            <li className={neuGesamt ? "an" : ""}><b>{neuGesamt}</b>neu vom Kunden</li>
            <li><b>{k.zahlungOffen ?? 0}</b>Zahlung offen</li>
            <li><b>{k.unterschriftenOffen ?? 0}</b>Unterschriften offen</li>
            <li><b>{k.fristen30 ?? 0}</b>Fristen in 30 Tagen</li>
          </ul>
        </header>

        <div className="cgn-raum">
          <aside className="cgn-liste" aria-label="Global-Kunden">
            <div className="cgn-suche">
              <input type="search" value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="Firma, Name oder Nummer" aria-label="Kunden suchen" />
            </div>
            <div className="cgn-filter" role="tablist" aria-label="Filter">
              {FILTER.map((f) => (
                <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} className={filter === f.key ? "an" : ""} onClick={() => setFilter(f.key)}>
                  {f.text}<span>{zahl[f.key]}</span>
                </button>
              ))}
            </div>
            {fehler && <Fehlermeldung text={fehler} erneut={neu} />}
            {laedt && !daten && <Geruest zeilen={5} />}
            <div className="cgn-zeilen">
              {sichtbar.map(({ m, lage }) => (
                <button key={m.ref} type="button" className={`cgn-zeile${gewaehlt === m.ref ? " an" : ""}${m.test ? " test" : ""}`} onClick={() => waehlen(m.ref)}
                        aria-current={gewaehlt === m.ref ? "true" : undefined} data-cgn="zeile">
                  <span className={`cgn-punkt ${lage.neu ? "neu" : lage.gruppe}`} aria-label={lage.neu ? "Neues vom Kunden" : lage.gruppe === "uns" ? "Braucht uns" : lage.gruppe === "kunde" ? "Wartet auf Kunde" : "Ruhe"} />
                  <b>{anzeigeName(m)}</b>
                  <small>{lage.stand}{m.test ? " · Test" : ""}</small>
                  <em className={lage.gruppe === "kunde" ? "kunde" : ""}>{lage.naechster}</em>
                </button>
              ))}
              {daten && sichtbar.length === 0 && (
                <p className="cgn-leer">{s ? "Kein Kunde passt zur Suche." : filter === "uns" ? "Niemand braucht uns gerade. Alles erledigt." : filter === "kunde" ? "Wir warten auf keinen Kunden." : "Noch kein Global-Auftrag."}</p>
              )}
            </div>
            <div className="cgn-liste-fuss">
              <button type="button" className="cgn-klein-schalter" aria-pressed={tests} onClick={() => setTests((v) => !v)}>{tests ? "Test-Akten ausblenden" : "Test-Akten zeigen"}</button>
              {daten && daten.angebote.length > 0 && (
                <>
                  <button type="button" className="cgn-klein-schalter" aria-expanded={angeboteAuf} onClick={() => setAngeboteAuf((v) => !v)} data-cgn="angebote-schalter">
                    {angeboteAuf ? "Angebote ausblenden" : `Angebote in Arbeit (${daten.angebote.length})`}
                  </button>
                  {angeboteAuf && (
                    <div className="cgn-angebote">
                      {daten.angebote.map((a) => (
                        <div key={a.id} className="cgn-angebot">
                          <span className="cgn-auge">{ANGEBOT_ART[a.art] ?? "Angebot"}</span>
                          <a href="/chef/s/global-auftraege?reiter=angebote">{a.firma && a.firma !== a.kunde ? `${a.kunde} · ${a.firma}` : a.kunde}</a>
                          <small>{a.status === "angenommen" ? `angenommen ${a.angenommenAm ? datum(a.angenommenAm) : ""}` : `offen · gültig bis ${datum(a.gueltigBis)}`}{a.art === "begleit" && a.status === "angenommen" ? " · noch ohne Akte" : ""}</small>
                          {a.art === "begleit" && a.status === "angenommen" && (
                            <button type="button" className="cgn-knopf klein haupt" style={{ alignSelf: "flex-start", marginTop: 4 }} disabled={akteLaeuft === a.id} data-cgn="begleit-akte-anlegen" onClick={() => void akteAnlegen(a.id)}>
                              {akteLaeuft === a.id ? "Legt an …" : "Global-Akte anlegen"}
                            </button>
                          )}
                          {akteMeldung?.id === a.id && <small className={akteMeldung.gut ? "" : "cgn-fehler"} role={akteMeldung.gut ? "status" : "alert"}>{akteMeldung.text}</small>}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </aside>

          <main className={`cgn-akte${gewaehlt ? "" : " leer"}`}>
            {/* Nach jeder Änderung lädt die Liste nach und die Zahl am Menüpunkt (E-451) gleich mit. */}
            {gewaehlt ? <Akte key={gewaehlt} gref={gewaehlt} zurueck={() => navigate(PFAD)} onGeaendert={() => { neu(); window.dispatchEvent(new Event("chef-global-geaendert")); }} />
              : !laedt && <p>Wähle links einen Kunden.</p>}
          </main>
        </div>
      </div>

      <div className="cgn-unten">
        <button type="button" aria-expanded={untenAuf} onClick={() => setUntenAuf((v) => !v)} data-cgn="einstellungen-schalter">
          {untenAuf ? "Einstellungen ausblenden" : "Einstellungen & Kundenzugänge"}
        </button>
        {untenAuf && <><ChefGlobalEinstellungen /><ChefGlobalZugaenge /></>}
      </div>
    </div>
  );
}

// ═══ EINE AKTE ═══════════════════════════════════════════════════════════════
type AbschnittKey = "fahrplan" | "dokumente" | "nachrichten" | "zahlungen" | "firma" | "kapital" | "fristen" | "verlauf" | "mehr";

function Akte({ gref, zurueck, onGeaendert }: { gref: string; zurueck: () => void; onGeaendert: () => void }) {
  const r = encodeURIComponent(gref);
  const { daten, fehler, neu, leise } = useDaten<{ ok: true; mandat: T; kundenLink: string; vorschauUrl: string }>(`/chef/global/mandate/${r}`, [], NACHLADEN_MS);
  const [auf, setAuf] = useState<Record<AbschnittKey, boolean>>({ fahrplan: true, dokumente: true, nachrichten: false, zahlungen: false, firma: false, kapital: false, fristen: false, verlauf: false, mehr: false });
  const [meldung, setMeldung] = useState<{ text: string; gut: boolean } | null>(null);
  const [editor, setEditor] = useState<{ auf: boolean; station: string | null }>({ auf: false, station: null });
  const [antwortFokus, setAntwortFokus] = useState(0);
  const [laeuft, setLaeuft] = useState(false);
  const m = daten?.mandat;
  const heute = heuteBerlin();

  useEffect(() => { if (!meldung) return; const t = window.setTimeout(() => setMeldung(null), 5200); return () => window.clearTimeout(t); }, [meldung]);

  const tun: Tun = async (pfad, methode, body) => {
    const j = await senden(`/chef/global/mandate/${r}${pfad}`, methode, body);
    setMeldung({ text: j.ok ? String(j.meldung ?? "Gespeichert.") : String(j.error), gut: j.ok });
    if (j.ok) { neu(); onGeaendert(); }
    return j.ok;
  };
  // Eine neue Datei geöffnet (neuer Tab) — der Server setzt „gesehen“; kurz danach leise nachladen (E-443).
  const geoeffnet = (d: T) => { if (d?.neu) window.setTimeout(() => { leise(); onGeaendert(); }, 1500); };
  const oeffne = (k: AbschnittKey, ziel?: string) => {
    setAuf((a) => ({ ...a, [k]: true }));
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => document.getElementById(ziel ?? `cgn-${k}`)?.scrollIntoView({ behavior: "smooth", block: "start" })));
  };
  const umschalten = (k: AbschnittKey) => setAuf((a) => ({ ...a, [k]: !a[k] }));

  // Nachrichten gelesen: EINE Stelle — sobald der Abschnitt offen ist und Ungelesenes da ist (wie der Reiter „Anfragen“).
  const ungelesen = m ? (m.nachrichten as T[]).filter((n) => n.von === "kunde" && !n.gelesen).length : 0;
  const gelesenLaeuft = useRef(false);
  useEffect(() => {
    if (!auf.nachrichten || ungelesen === 0 || gelesenLaeuft.current) return;
    gelesenLaeuft.current = true;
    void senden(`/chef/global/mandate/${r}/anfragen-gelesen`, "POST").then(() => { neu(); onGeaendert(); }).finally(() => { gelesenLaeuft.current = false; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auf.nachrichten, ungelesen]);

  if (fehler) return <><button type="button" className="cgn-zurueck" onClick={zurueck}>‹ Alle Kunden</button><Fehlermeldung text={fehler} erneut={neu} /></>;
  if (!m) return <Geruest zeilen={8} />;

  const person = [m.kontakt?.vorname, m.kontakt?.nachname].filter(Boolean).join(" ");
  const name = m.gesellschaft?.name || (m.firmaVoll?.art !== "privat" && m.firmaVoll?.name) || m.firma?.name || person || gref;
  const st = STATUS[m.status] ?? { text: m.status };
  const naechstes = alsNaechstes(m, heute);
  const doks = (m.dokumente as T[]).filter((d) => d.art !== "post");
  const neuDoks = doks.filter((d) => d.neu).length;
  const uOffen = (m.dokumente as T[]).filter((d) => d.unterschrift?.gefordert && !d.unterschrift?.unterschrieben).length;
  const stationen = zaehlendeStationen(m.schritte as Station[]);
  const erledigt = stationen.filter((s) => s.status === "erledigt").length;
  const letzte = (m.nachrichten as T[])[(m.nachrichten as T[]).length - 1];
  const frist = (m.fristen as T[]).filter((f) => !f.erledigt).sort((a, b) => String(a.faelligAm).localeCompare(String(b.faelligAm)))[0];
  const p = m.gesellschaftPlus ?? {};
  const verlauf = (m.intern?.verlaufAlles ?? []) as T[];

  // Der eine Knopf der Karte „Als Nächstes“.
  const a = naechstes.aktion;
  const dokZiel = a.art === "dokument-oeffnen" ? (m.dokumente as T[]).find((d) => Number(d.id) === a.dokumentId) : null;
  const ausfuehren = async () => {
    if (laeuft) return;
    switch (a.art) {
      case "antworten": oeffne("nachrichten"); setAntwortFokus((x) => x + 1); return;
      case "station-werte": setEditor({ auf: true, station: a.schluessel }); oeffne("fahrplan", "cgn-editor"); return;
      case "zustaendig-waehlen": oeffne("firma", "cgn-zustaendig"); return;
      case "zugang-senden": if (!window.confirm("Den Link zu „Mein Auftrag“ (mit Zahlungsseite) jetzt per Mail an den Kunden schicken?")) return; break;
      case "keine": case "dokument-oeffnen": return;
    }
    setLaeuft(true);
    try {
      if (a.art === "station") await tun("/station", "POST", { schluessel: a.schluessel, status: a.status });
      else if (a.art === "frist-erledigt") await tun(`/frist/${a.fristId}`, "POST", { erledigt: true });
      else if (a.art === "zustaendig") await tun("/zustaendig", "POST", { agentId: a.agentId });
      else if (a.art === "zugang-senden") await tun("/zugang-senden", "POST");
    } finally { setLaeuft(false); }
  };

  return (
    <>
      <button type="button" className="cgn-zurueck" onClick={zurueck}>‹ Alle Kunden</button>

      <div className="cgn-akte-kopf" data-cgn="akte-kopf">
        <div className="cgn-akte-name">
          <span className="cgn-auge">{gref} · {m.paketName}</span>
          <h2>{name}</h2>
          <div className="cgn-akte-zeile">
            <span className={`cgn-pille${st.ton ? ` ${st.ton}` : ""}`}><i aria-hidden="true" />{st.text}</span>
            <span>{m.gesellschaft?.bundesstaatName ?? "Bundesstaat offen"}</span>
            {person && person !== name && <span>{person}</span>}
            <button type="button" className="cgn-link" onClick={() => oeffne("firma", "cgn-zustaendig")}>Zuständig: {m.zustaendigkeit?.name ?? "niemand"}</button>
            {m.test && <span className="cgn-pille">Test</span>}
          </div>
        </div>
        <div className="cgn-akte-tun">
          <a className="cgn-knopf" href={daten?.vorschauUrl} target="_blank" rel="noopener" data-cgn="kundenansicht" title="Öffnet das Portal so, wie der Kunde es sieht — nichts gilt als gelesen.">Kundenansicht</a>
          <a className="cgn-link leise" href={`/chef/global?mandat=${r}`}>Alte Ansicht</a>
        </div>
      </div>

      {meldung && <div className={`cgn-meldung${meldung.gut ? "" : " schlecht"}`} role="status">{meldung.text}</div>}

      <section className={`cgn-naechstes ${naechstes.ton}`} aria-label="Als Nächstes" data-cgn="als-naechstes">
        <span className="cgn-auge cgn-naechstes-ton"><i aria-hidden="true" />{naechstes.ton === "uns" ? "Als Nächstes" : naechstes.ton === "kunde" ? "Wartet auf den Kunden" : naechstes.ton === "amt" ? "Wartet auf Behörde oder Institut" : "Alles erledigt"}</span>
        <div className="cgn-naechstes-reihe">
          <h3>{naechstes.titel}</h3>
          {naechstes.knopf && (dokZiel
            ? <a className="cgn-knopf haupt" href={dokZiel.url} target="_blank" rel="noreferrer" onClick={() => geoeffnet(dokZiel)} data-cgn="naechstes-knopf">{naechstes.knopf}</a>
            : <button type="button" className="cgn-knopf haupt" disabled={laeuft} onClick={() => void ausfuehren()} data-cgn="naechstes-knopf">{laeuft ? "Einen Moment …" : naechstes.knopf}</button>)}
        </div>
        <p>{naechstes.warum}</p>
        {naechstes.wartet.length > 0 && (
          <div className="cgn-wartet"><b>Beim Kunden</b>{naechstes.wartet.map((w) => <span key={w}>{w}</span>)}</div>
        )}
      </section>

      <Abschnitt id="fahrplan" titel="Fahrplan" auf={auf.fahrplan} umschalten={() => umschalten("fahrplan")}
                 kurz={`${erledigt} von ${Math.max(1, stationen.length)} Stationen erledigt · Etappe ${m.etappe ?? 0}`}>
        <Fahrplan m={m} gref={gref} tun={tun} heute={heute} editor={editor} setEditor={setEditor} onGespeichert={() => { neu(); onGeaendert(); }} />
      </Abschnitt>

      <Abschnitt id="dokumente" titel="Dokumente" auf={auf.dokumente} umschalten={() => umschalten("dokumente")} zahl={neuDoks || undefined}
                 kurz={`${doks.length} im Tresor${neuDoks ? ` · ${neuDoks} neu` : ""}${uOffen ? ` · ${uOffen} zur Unterschrift` : ""}`}>
        <Dokumente m={m} gref={gref} tun={tun} geoeffnet={geoeffnet} onGeaendert={() => { neu(); onGeaendert(); }} />
      </Abschnitt>

      <Abschnitt id="nachrichten" titel="Nachrichten" auf={auf.nachrichten} umschalten={() => umschalten("nachrichten")} zahl={ungelesen || undefined}
                 kurz={ungelesen ? `${ungelesen} ungelesen` : letzte ? `zuletzt ${seit(letzte.am)}` : "noch keine"}>
        <Nachrichten m={m} tun={tun} fokus={antwortFokus} />
      </Abschnitt>

      <Abschnitt id="zahlungen" titel="Zahlungen & Leistungen" auf={auf.zahlungen} umschalten={() => umschalten("zahlungen")}
                 kurz={m.zahlung?.status === "bezahlt" || m.bezahltAm ? `bezahlt ${m.bezahltAm ? datum(m.bezahltAm) : ""}` : "Zahlung offen"}>
        <Zahlungen m={m} gref={gref} tun={tun} />
      </Abschnitt>

      <Abschnitt id="firma" titel="Firmendaten" auf={auf.firma} umschalten={() => umschalten("firma")}
                 kurz={[p.ein ? `EIN ${p.ein}` : "", p.aktenzeichen ? `Register ${p.aktenzeichen}` : "", p.usTelefon ? "US-Telefon" : ""].filter(Boolean).join(" · ") || "EIN, Registernummer, Adressen"}>
        <Firmendaten m={m} tun={tun} gref={gref} />
      </Abschnitt>

      <Abschnitt id="kapital" titel="Banken & Kapital" auf={auf.kapital} umschalten={() => umschalten("kapital")}
                 kurz={`${globalUsd(m.zugesagtCents)} zugesagt · ${(m.kapital as T[]).length} ${(m.kapital as T[]).length === 1 ? "Eintrag" : "Einträge"}`}>
        <Kapital m={m} tun={tun} />
      </Abschnitt>

      <Abschnitt id="fristen" titel="Fristen" auf={auf.fristen} umschalten={() => umschalten("fristen")}
                 kurz={frist ? `nächste: ${frist.titel} · ${tagDe(frist.faelligAm)}` : "keine offen"}>
        <Fristen m={m} tun={tun} />
      </Abschnitt>

      <Abschnitt id="verlauf" titel="Verlauf & Notizen" auf={auf.verlauf} umschalten={() => umschalten("verlauf")} kurz={verlauf[0] ? `zuletzt ${seit(verlauf[0].am)}` : "noch leer"}>
        <Verlauf m={m} tun={tun} />
      </Abschnitt>

      <Abschnitt id="mehr" titel="Mehr" auf={auf.mehr} umschalten={() => umschalten("mehr")} kurz={`Portal ${m.portal?.neu ? "neu" : "bisherig"} · Stichtag · Test · KI-Gespräche`}>
        <Mehr m={m} tun={tun} gref={gref} kundenLink={daten?.kundenLink ?? ""} />
      </Abschnitt>
    </>
  );
}

// ═══ DER FAHRPLAN ════════════════════════════════════════════════════════════
// Oben der Weg des Kunden (Etappen, wie er sie im Portal liest), darunter unser interner Fahrplan als Zeitlinie: je Station
// EIN Knopf („Starten“ · „Erledigt“), dahinter „···“ für Datum, Notiz, Beantragt, Entfällt. Die Werte (EIN, ITIN …) im
// Stationen-Editor („Alle Werte bearbeiten“) — derselbe Editor wie im Office und im Raum „Global-Mandate“.
function Fahrplan({ m, gref, tun, heute, editor, setEditor, onGespeichert }: {
  m: T; gref: string; tun: Tun; heute: string; editor: { auf: boolean; station: string | null };
  setEditor: (e: { auf: boolean; station: string | null }) => void; onGespeichert: () => void;
}) {
  const [etappeWahl, setEtappeWahl] = useState<number | null>(null);
  const [etappeText, setEtappeText] = useState("");
  const [etappeMail, setEtappeMail] = useState(true);
  const [satzAuf, setSatzAuf] = useState(false);
  const [satz, setSatz] = useState(m.naechsterSchritt?.text ?? "");
  const [satzBis, setSatzBis] = useState(m.naechsterSchritt?.bis ?? "");
  const schritte = m.schritte as Station[];
  const zaehlt = new Set(zaehlendeStationen(schritte).map((s) => s.schluessel));
  const naechste = naechsteStation(schritte)?.schluessel;
  const zeigen = schritte.filter((s) => zaehlt.has(s.schluessel) || s.status === "entfaellt");
  const bedarf = schritte.filter((s) => GLOBAL_FAHRPLAN_BEDARF.includes(s.schluessel) && !zaehlt.has(s.schluessel) && s.status !== "entfaellt");
  const gesperrt = m.status === "offen" || m.status === "storniert";
  return (
    <>
      <div className="cgn-gruppe" data-cgn="etappen">
        <span className="cgn-auge">Weg des Kunden · so liest er ihn im Portal</span>
        <div className="cgn-etappen">
          {(m.etappen as T[]).map((e) => (
            <button key={e.nr} type="button" className={`cgn-etappe ${e.stand ?? "offen"}${etappeWahl === e.nr ? " gewaehlt" : ""}`} disabled={gesperrt}
                    title={gesperrt ? "Etappen setzt du nach dem Zahlungseingang." : `Auf Etappe ${e.nr} setzen${e.text ? ` — ${e.text}` : ""}`}
                    onClick={() => { setEtappeWahl(e.nr); setEtappeText(""); }}>
              <span>{e.nr}</span>{e.titel}
            </button>
          ))}
        </div>
        {etappeWahl !== null && (
          <div className="cgn-form" style={{ marginTop: 10 }}>
            <input value={etappeText} onChange={(e) => setEtappeText(e.target.value)} placeholder="Satz an den Kunden (freiwillig, er liest ihn)" aria-label="Satz an den Kunden" />
            <div className="cgn-reihe zwischen">
              <label className="cgn-haken"><input type="checkbox" checked={etappeMail} onChange={(e) => setEtappeMail(e.target.checked)} /> Per Mail mitteilen</label>
              <span className="cgn-reihe">
                <button type="button" className="cgn-knopf haupt klein" onClick={async () => { if (await tun("/etappe", "POST", { etappe: etappeWahl, text: etappeText, mitteilen: etappeMail })) setEtappeWahl(null); }}>Etappe {etappeWahl} setzen</button>
                <button type="button" className="cgn-knopf klein" onClick={() => setEtappeWahl(null)}>Abbrechen</button>
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="cgn-gruppe" data-cgn="satz-kunde">
        <span className="cgn-auge">Nächster Schritt · liest der Kunde</span>
        {!satzAuf ? (
          <div className="cgn-reihe zwischen">
            <p className="cgn-satz">{m.naechsterSchritt?.text ? <>„{m.naechsterSchritt.text}“{m.naechsterSchritt.bis ? ` — bis ${tagDe(m.naechsterSchritt.bis)}` : ""}</> : "Kein eigener Satz — das Portal nennt die nächste offene Station."}</p>
            <button type="button" className="cgn-link" onClick={() => { setSatz(m.naechsterSchritt?.text ?? ""); setSatzBis(m.naechsterSchritt?.bis ?? ""); setSatzAuf(true); }}>{m.naechsterSchritt?.text ? "Ändern" : "Satz schreiben"}</button>
          </div>
        ) : (
          <div className="cgn-form">
            <textarea rows={2} value={satz} onChange={(e) => setSatz(e.target.value)} placeholder="z. B. Wir reichen die Gründung beim Bundesstaat ein." aria-label="Nächster Schritt für den Kunden" />
            <div className="cgn-reihe zwischen">
              <label className="cgn-haken">bis <input type="date" value={satzBis} onChange={(e) => setSatzBis(e.target.value)} aria-label="bis" /></label>
              <span className="cgn-reihe">
                <button type="button" className="cgn-knopf haupt klein" onClick={async () => { if (await tun("/naechster-schritt", "POST", { text: satz, bis: satzBis || null })) setSatzAuf(false); }}>Speichern</button>
                <button type="button" className="cgn-knopf klein" onClick={() => setSatzAuf(false)}>Abbrechen</button>
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="cgn-gruppe">
        <span className="cgn-auge">Unser Fahrplan · intern gesteuert</span>
        <ol className="cgn-zeitlinie" data-cgn="zeitlinie">
          {zeigen.map((s) => <StationZeile key={s.schluessel} s={s} naechste={s.schluessel === naechste} tun={tun} heute={heute}
                                             werte={() => setEditor({ auf: true, station: s.schluessel })} />)}
        </ol>
        {bedarf.length > 0 && (
          <div className="cgn-reihe" style={{ paddingTop: 8 }}>
            <span className="cgn-satz">Bei Bedarf:</span>
            {bedarf.map((s) => (
              <button key={s.schluessel} type="button" className="cgn-knopf klein" title="Legt die Station an — der Kunde sieht sie dann im Fahrplan."
                      onClick={() => { if (window.confirm(`„${s.titel}“ für diesen Kunden anlegen? Er sieht die Station dann in seinem Fahrplan.`)) void tun("/station", "POST", { schluessel: s.schluessel, status: "in_arbeit" }); }}>
                {s.titel} anlegen
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="cgn-editor" id="cgn-editor">
        <div className="cgn-reihe zwischen">
          <p className="cgn-satz">Werte der Stationen (EIN, ITIN, Adressen, Karten …), Hinweis für den Kunden, Dokument zur Station.</p>
          <button type="button" className="cgn-knopf klein" aria-expanded={editor.auf} data-cgn="editor-schalter" onClick={() => setEditor({ auf: !editor.auf, station: null })}>
            {editor.auf ? "Editor schließen" : "Alle Werte bearbeiten"}
          </button>
        </div>
        {editor.auf && (
          <div style={{ marginTop: 12 }}>
            <GlobalStationen key={editor.station ?? "alle"} basis={`${API}/chef/global/mandate/${encodeURIComponent(gref)}`} ton="hell" startOffen={editor.station} onGespeichert={onGespeichert}
              daten={{
                schritte: m.schritte, gesellschaft: m.gesellschaft, gesellschaftPlus: m.gesellschaftPlus, kapital: m.kapital,
                dokumente: (m.dokumente as T[]).map((d) => ({ id: d.id, art: d.art, name: d.name, titel: d.titel, url: d.url, pflichtKey: d.pflichtKey, unterschrift: d.unterschrift })),
                kontaktVorschlag: m.kontaktVorschlag ?? null,
              }} />
          </div>
        )}
      </div>
    </>
  );
}

function StationZeile({ s, naechste, tun, heute, werte }: { s: T; naechste: boolean; tun: Tun; heute: string; werte: () => void }) {
  const [mehr, setMehr] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [notiz, setNotiz] = useState(String(s.intern ?? ""));
  const [tag, setTag] = useState(String(s.datum ?? ""));
  const [beantragt, setBeantragt] = useState(String(s.beantragtAm ?? ""));
  useEffect(() => { if (!mehr) { setNotiz(String(s.intern ?? "")); setTag(String(s.datum ?? "")); setBeantragt(String(s.beantragtAm ?? "")); } }, [s.intern, s.datum, s.beantragtAm, mehr]);
  const status = String(s.status ?? "offen") as GlobalSchrittStatus;
  const name = (x: GlobalSchrittStatus) => stationStatusName(s.schluessel, x) ?? GLOBAL_SCHRITT_STATUS_TEXT[x]?.de ?? x;
  const setze = async (body: T) => {
    if (laeuft) return false;
    setLaeuft(true);
    try { return await tun("/station", "POST", { schluessel: s.schluessel, ...body }); } finally { setLaeuft(false); }
  };
  const stand = status === "erledigt" ? `${name("erledigt")}${s.datum ? ` am ${tagDe(s.datum)}` : ""}`
    : status === "beantragt" ? `${name("beantragt")}${s.beantragtAm ? ` am ${tagDe(s.beantragtAm)}` : ""}`
    : status === "in_arbeit" ? `${name("in_arbeit")} — läuft` : name(status);
  return (
    <li className={`cgn-station st-${status}${naechste ? " naechste" : ""}`} data-cgn-station={s.schluessel}>
      <span className="cgn-station-punkt" aria-hidden="true" />
      <span className="cgn-station-text">
        <b>{s.titel}</b>
        <small>{stand}{s.geaendertVon ? ` · ${s.geaendertVon}` : ""}</small>
        {s.intern && <small className="intern">Notiz: {s.intern}</small>}
        <span className={`cgn-sicht${status === "entfaellt" ? "" : " kunde"}`}>{status === "entfaellt" ? "nur intern" : "Kunde sieht"}</span>
      </span>
      <span className="cgn-station-tun">
        {status === "offen" && <button type="button" className={`cgn-knopf klein${naechste ? " haupt" : ""}`} disabled={laeuft} data-cgn="station-starten" onClick={() => void setze({ status: "in_arbeit" })}>Starten</button>}
        {(status === "in_arbeit" || status === "beantragt") && <button type="button" className={`cgn-knopf klein${naechste ? " haupt" : ""}`} disabled={laeuft} data-cgn="station-erledigt" onClick={() => void setze({ status: "erledigt" })}>Erledigt</button>}
        <button type="button" className="cgn-punkte" aria-expanded={mehr} aria-label={`Mehr zu ${s.titel}`} onClick={() => setMehr((v) => !v)}>···</button>
      </span>
      {mehr && (
        <div className="cgn-station-mehr">
          {status !== "in_arbeit" && status !== "erledigt" && <button type="button" className="cgn-knopf klein" disabled={laeuft} onClick={() => void setze({ status: "in_arbeit" })}>Läuft</button>}
          {status !== "beantragt" && status !== "erledigt" && <button type="button" className="cgn-knopf klein" disabled={laeuft} onClick={() => void setze({ status: "beantragt" })}>Beantragt</button>}
          {status !== "offen" && <button type="button" className="cgn-knopf klein" disabled={laeuft} onClick={() => void setze({ status: "offen" })}>Wieder offen</button>}
          {status !== "entfaellt" && <button type="button" className="cgn-knopf klein" disabled={laeuft} onClick={() => { if (window.confirm(`„${s.titel}“ entfällt für diesen Kunden? Er sieht die Station dann nicht mehr.`)) void setze({ status: "entfaellt" }); }}>Entfällt</button>}
          {status === "erledigt" && (
            <label className="cgn-haken">Erledigt am <input type="date" max={heute} value={tag} onChange={(e) => setTag(e.target.value)} /></label>
          )}
          {status === "beantragt" && (
            <label className="cgn-haken">Beantragt am <input type="date" max={heute} value={beantragt} onChange={(e) => setBeantragt(e.target.value)} /></label>
          )}
          {((status === "erledigt" && tag !== String(s.datum ?? "")) || (status === "beantragt" && beantragt !== String(s.beantragtAm ?? ""))) && (
            <button type="button" className="cgn-knopf klein haupt" disabled={laeuft} onClick={() => void setze(status === "erledigt" ? { datum: tag || null } : { beantragtAm: beantragt || null })}>Datum speichern</button>
          )}
          <span className="cgn-reihe" style={{ width: "100%" }}>
            <input value={notiz} maxLength={1200} onChange={(e) => setNotiz(e.target.value)} placeholder="Interne Notiz (sieht nur das Team)" aria-label={`Interne Notiz zu ${s.titel}`} style={{ flex: "1 1 220px" }} />
            <button type="button" className="cgn-knopf klein" disabled={laeuft || notiz === String(s.intern ?? "")} onClick={() => void setze({ intern: notiz })}>Notiz speichern</button>
          </span>
          <button type="button" className="cgn-link" onClick={werte}>Werte und Hinweis für den Kunden im Editor öffnen</button>
        </div>
      )}
    </li>
  );
}
