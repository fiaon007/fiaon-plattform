// ═══════════════════════════════════════════════════════════════════════════
// CHEFBÜRO › GLOBAL-KUNDEN — die Abschnitte einer Akte (E-455, 29.10.2026)
//
// Dokumente, Nachrichten, Zahlungen & Leistungen, Firmendaten, Banken & Kapital, Fristen, Verlauf, Mehr.
// Jeder Abschnitt schreibt über DIESELBEN Endpunkte wie der Raum „Global-Mandate“ (server/routes/fiaon-chef-global.ts)
// — eine Wahrheit für beide Räume und das Kundenportal. Gestaltung: chef-global-kunden.css (.cgn-).
// ═══════════════════════════════════════════════════════════════════════════
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { API, datum, datumZeit, seit, Geruest, Fehlermeldung, useDaten } from "./chef-teile";
import { GLOBAL_DOKUMENTARTEN, globalKundeDarfArt, US_BUNDESSTAATEN } from "@shared/fiaon-global-bereich";
import { GLOBAL_KAPITAL_ARTEN, GLOBAL_KAPITAL_STATUS, GLOBAL_TRESOR, globalTresorKategorie, globalUsd, type GlobalTresorKategorie } from "@shared/fiaon-global-mandat";
import { GLOBAL_STATION_FELDER, STATION_ROLLEN, stationTelefonText, stationWertePruefen, type StationFeld } from "@shared/fiaon-global-stationen";
import GlobalFormulare from "@/components/global/GlobalFormulare";

/** Takt des leisen Nachladens — derselbe wie Portal und Raum „Global-Mandate“ (E-443). */
export const NACHLADEN_MS = 60_000;
export type Tun = (pfad: string, methode: "POST" | "DELETE", body?: unknown) => Promise<boolean>;
type T = Record<string, any>;

export async function senden(pfad: string, methode: "POST" | "DELETE", body?: unknown): Promise<{ ok: boolean; meldung?: string; error?: string; [k: string]: unknown }> {
  try {
    const r = await fetch(`${API}${pfad}`, {
      method: methode, credentials: "include",
      ...(body instanceof FormData ? { body } : body !== undefined ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.ok) return { ok: false, error: j?.error || (r.status === 403 ? "Dafür reicht deine Stufe nicht." : `Fehler ${r.status}`) };
    return j;
  } catch { return { ok: false, error: "Keine Verbindung zum Server — nichts gespeichert." }; }
}

/** Der Berliner Tag (YYYY-MM-DD) — Hausregel: Berliner Zeit nur über formatToParts. */
export function heuteBerlin(): string {
  const t = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const w = (typ: string) => t.find((x) => x.type === typ)?.value ?? "";
  return `${w("year")}-${w("month")}-${w("day")}`;
}

export const tagDe = (iso?: string | null) => iso ? `${String(iso).slice(8, 10)}.${String(iso).slice(5, 7)}.${String(iso).slice(0, 4)}` : "";
const euro = (c: number) => `${(c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

// ── Ein Abschnitt: Kopf mit einer Zeile Stand, einklappbar ─────────────────────
export function Abschnitt({ id, titel, kurz, zahl, auf, umschalten, children }: {
  id: string; titel: string; kurz?: ReactNode; zahl?: number; auf: boolean; umschalten: () => void; children: ReactNode;
}) {
  return (
    <section className={`cgn-abschnitt${auf ? " auf" : ""}`} id={`cgn-${id}`} data-cgn={id}>
      <button type="button" className="cgn-abschnitt-kopf" aria-expanded={auf} aria-controls={`cgn-${id}-inhalt`} onClick={umschalten}>
        <h3>{titel}</h3>
        {zahl ? <span className="cgn-zahl" aria-label={`${zahl} neu`}>{zahl}</span> : null}
        <small>{kurz}</small>
        <span className="cgn-winkel" aria-hidden="true" />
      </button>
      {auf && <div className="cgn-abschnitt-inhalt" id={`cgn-${id}-inhalt`}>{children}</div>}
    </section>
  );
}

function Marke({ ton, children }: { ton?: "blau" | "gruen" | "rot"; children: ReactNode }) {
  return <span className={`cgn-marke${ton ? ` ${ton}` : ""}`}><i aria-hidden="true" />{children}</span>;
}

// ═══ DOKUMENTE ═══════════════════════════════════════════════════════════════
type DokReiter = "tresor" | "post" | "unterschrift" | "formulare";
const ARTEN_TRESOR = GLOBAL_TRESOR.filter((k) => k.kategorie !== "vertrag" && k.kategorie !== "post");

export function Dokumente({ m, gref, tun, geoeffnet, onGeaendert }: { m: T; gref: string; tun: Tun; geoeffnet: (d: T) => void; onGeaendert: () => void }) {
  const [reiter, setReiter] = useState<DokReiter>("tresor");
  const [hoch, setHoch] = useState(false);
  const alle = (m.dokumente as T[]);
  const doks = alle.filter((d) => d.art !== "post");
  const post = alle.filter((d) => d.art === "post");
  const neu = doks.filter((d) => d.neu);
  const zurUnterschrift = doks.filter((d) => !d.neu && d.unterschrift?.gefordert && !d.unterschrift?.unterschrieben);
  const rest = doks.filter((d) => !d.neu && !(d.unterschrift?.gefordert && !d.unterschrift?.unterschrieben));
  const nach = new Map<GlobalTresorKategorie, T[]>();
  for (const d of rest) { const k = (d.kategorie ?? globalTresorKategorie(d.art)) as GlobalTresorKategorie; nach.set(k, [...(nach.get(k) ?? []), d]); }
  const fehlen = m.status !== "offen" ? (m.unterlagen as T[] ?? []).filter((u) => !u.vorhanden) : [];
  const nachreichen = (m.nachreichen ?? []) as T[];
  return (
    <>
      <div className="cgn-reihe zwischen">
        <div className="cgn-segment" role="tablist" aria-label="Dokumente">
          {([["tresor", "Tresor", neu.length], ["post", "Post", post.filter((d) => !d.gelesen).length], ["unterschrift", "Unterschriften", 0], ["formulare", "Formulare", 0]] as [DokReiter, string, number][]).map(([k, t, z]) => (
            <button key={k} type="button" role="tab" aria-selected={reiter === k} className={reiter === k ? "an" : ""} onClick={() => { setReiter(k); setHoch(false); }}>
              {t}{z ? <span>{z}</span> : null}
            </button>
          ))}
        </div>
        {(reiter === "tresor" || reiter === "post") && (
          <div className="cgn-reihe">
            {reiter === "tresor" && neu.length > 0 && <button type="button" className="cgn-knopf klein" data-cgn="alle-gesehen" onClick={() => void tun("/gesehen", "POST")}>Alle als gesehen</button>}
            <button type="button" className="cgn-knopf klein haupt" data-cgn="hochladen" onClick={() => setHoch((v) => !v)}>{hoch ? "Schließen" : reiter === "post" ? "Post ablegen" : "Hochladen"}</button>
          </div>
        )}
      </div>

      {reiter === "tresor" && (
        <>
          {hoch && <Ablage tun={tun} portalNeu={!!m.portal?.neu} fertig={() => setHoch(false)} />}
          {(fehlen.length > 0 || nachreichen.length > 0) && (
            <p className="cgn-warnung">
              {fehlen.length > 0 && <>Fehlt beim Kunden: {fehlen.map((u) => u.abgelehnt ? `${u.titel} (bitte neu)` : u.titel).join(", ")}. </>}
              {nachreichen.length > 0 && <>Bitte neu angefordert: {nachreichen.map((x) => x.titel).join(", ")}.</>}
            </p>
          )}
          {neu.length > 0 && (
            <div className="cgn-gruppe" data-cgn="dok-neu">
              <span className="cgn-auge">Neu vom Kunden</span>
              {neu.map((d) => <DokZeile key={d.id} d={d} tun={tun} geoeffnet={geoeffnet} sprache={m.sprache} />)}
            </div>
          )}
          {zurUnterschrift.length > 0 && (
            <div className="cgn-gruppe">
              <span className="cgn-auge">Beim Kunden zur Unterschrift</span>
              {zurUnterschrift.map((d) => <DokZeile key={d.id} d={d} tun={tun} geoeffnet={geoeffnet} sprache={m.sprache} />)}
            </div>
          )}
          <div className="cgn-gruppe">
            <span className="cgn-auge">Vertrag und Rechnungen</span>
            {m.vertragUrl && <div className="cgn-eintrag"><span className="cgn-eintrag-text"><a href={m.vertragUrl} target="_blank" rel="noreferrer">Vertrag</a><small>unterschrieben {datum(m.erstelltAm)}</small></span></div>}
            {m.rechnungUrl && <div className="cgn-eintrag"><span className="cgn-eintrag-text"><a href={m.rechnungUrl} target="_blank" rel="noreferrer">Rechnung</a><small>{m.rechnungsnummer ?? ""}</small></span></div>}
            <div className="cgn-eintrag"><span className="cgn-eintrag-text"><a href="/chef/s/global-auftraege?reiter=angebote">Nachweise und Sicherheiten aus dem Angebot</a><small>im Raum „Angebote & Aufträge“</small></span></div>
          </div>
          {GLOBAL_TRESOR.filter((k) => k.kategorie !== "vertrag" && k.kategorie !== "post" && nach.has(k.kategorie)).map((k) => (
            <div key={k.kategorie} className="cgn-gruppe">
              <span className="cgn-auge">{k.titel.de} · {nach.get(k.kategorie)!.length}</span>
              {nach.get(k.kategorie)!.map((d) => <DokZeile key={d.id} d={d} tun={tun} geoeffnet={geoeffnet} sprache={m.sprache} />)}
            </div>
          ))}
          {doks.length === 0 && <p className="cgn-leer">Noch keine Dokumente. „Hochladen“ legt das erste ab.</p>}
        </>
      )}

      {reiter === "post" && (
        <>
          {hoch && <Ablage tun={tun} fest="post" portalNeu={!!m.portal?.neu} fertig={() => setHoch(false)} />}
          <div className="cgn-gruppe">
            {post.length === 0 ? <p className="cgn-leer">Noch keine Post. Eingegangene Briefe erscheinen im Briefkasten des Kunden.</p>
              : post.map((d) => <DokZeile key={d.id} d={d} tun={tun} geoeffnet={geoeffnet} sprache={m.sprache} />)}
          </div>
        </>
      )}

      {reiter === "unterschrift" && <Pflichtformulare gref={gref} tun={tun} />}
      {reiter === "formulare" && (
        <div className="cgn-editor" data-cgn="formulare">
          <GlobalFormulare basis={`${API}/chef/global/mandate/${encodeURIComponent(gref)}`} ton="hell" onGeaendert={onGeaendert} />
        </div>
      )}
    </>
  );
}

function Ablage({ tun, fest, portalNeu, fertig }: { tun: Tun; fest?: "post"; portalNeu: boolean; fertig: () => void }) {
  const [art, setArt] = useState<string>(fest ?? "sonstiges");
  const [titel, setTitel] = useState("");
  const [sichtbar, setSichtbar] = useState(true);
  const [unterschrift, setUnterschrift] = useState(false);
  const [mitteilen, setMitteilen] = useState(fest === "post");
  const [absender, setAbsender] = useState("");
  const [eingang, setEingang] = useState(heuteBerlin());
  const [datei, setDatei] = useState<File | null>(null);
  const [zieht, setZieht] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const ablegen = async () => {
    if (!datei || laeuft) return;
    const f = new FormData();
    f.append("datei", datei); f.append("art", art); f.append("titel", titel);
    f.append("sichtbar", String(sichtbar || unterschrift)); f.append("unterschrift", String(unterschrift)); f.append("mitteilen", String(mitteilen));
    if (art === "post") { f.append("postAbsender", absender); f.append("postEingang", eingang); }
    setLaeuft(true);
    const ok = await tun("/dokument", "POST", f);
    setLaeuft(false);
    if (ok) fertig();
  };
  return (
    <div className={`cgn-ablage${zieht ? " zieht" : ""}`} data-cgn="ablage"
         onDragOver={(e) => { e.preventDefault(); setZieht(true); }} onDragLeave={() => setZieht(false)}
         onDrop={(e) => { e.preventDefault(); setZieht(false); const f = e.dataTransfer.files?.[0]; if (f) setDatei(f); }}>
      <label className="cgn-ablage-feld">
        <span>{datei ? <b>{datei.name}</b> : <>Datei hierher ziehen oder <b>auswählen</b></>}</span>
        <small>PDF, JPG, PNG, HEIC · bis 15 MB</small>
        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,application/pdf,image/*" onChange={(e) => setDatei(e.target.files?.[0] ?? null)} />
      </label>
      <div className="cgn-felder">
        {!fest && (
          <label className="cgn-feld">Art<select value={art} onChange={(e) => setArt(e.target.value)}>
            {GLOBAL_TRESOR.filter((k) => k.kategorie !== "vertrag").map((g) => (
              <optgroup key={g.kategorie} label={g.titel.de}>
                {GLOBAL_DOKUMENTARTEN.filter((a) => globalTresorKategorie(a.art) === g.kategorie && a.art !== "post").map((a) => <option key={a.art} value={a.art}>{a.de}</option>)}
              </optgroup>
            ))}
          </select></label>
        )}
        {art === "post" ? (
          <>
            <label className="cgn-feld">Absender<input value={absender} onChange={(e) => setAbsender(e.target.value)} placeholder="z. B. Florida Department of State" /></label>
            <label className="cgn-feld">Eingegangen am<input type="date" value={eingang} onChange={(e) => setEingang(e.target.value)} /></label>
          </>
        ) : (
          <label className="cgn-feld">Titel (freiwillig)<input value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="z. B. EIN-Bestätigung der IRS" /></label>
        )}
      </div>
      <div className="cgn-reihe">
        {art !== "post" && <label className="cgn-haken"><input type="checkbox" checked={sichtbar || unterschrift} disabled={unterschrift} onChange={(e) => setSichtbar(e.target.checked)} /> Kunde sieht es</label>}
        {art !== "post" && <label className="cgn-haken"><input type="checkbox" checked={unterschrift} onChange={(e) => setUnterschrift(e.target.checked)} /> Unterschrift anfordern (PDF)</label>}
        <label className="cgn-haken"><input type="checkbox" checked={mitteilen} onChange={(e) => setMitteilen(e.target.checked)} /> Kunde per Mail informieren</label>
      </div>
      {unterschrift && !portalNeu && <p className="cgn-warnung">Das bisherige Portal zeigt keine Unterschrift — erst das neue Portal freischalten (unter „Mehr“).</p>}
      <div className="cgn-reihe">
        <button type="button" className="cgn-knopf haupt" disabled={!datei || laeuft || (art === "post" && !absender.trim())} onClick={() => void ablegen()}>
          {laeuft ? "Lädt hoch …" : art === "post" ? "Post ablegen" : "In den Tresor legen"}
        </button>
        <button type="button" className="cgn-knopf" onClick={fertig}>Abbrechen</button>
      </div>
    </div>
  );
}

/** Ein Dokument: Titel öffnet (= gesehen), daneben eine Marke; „···“ zeigt die Handgriffe. */
function DokZeile({ d, tun, geoeffnet, sprache }: { d: T; tun: Tun; geoeffnet: (d: T) => void; sprache?: string }) {
  const titel = d.titel || d.artText;
  const [mehr, setMehr] = useState(false);
  const [grund, setGrund] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const kundeFrei = d.von === "kunde" && !d.unterschriebeneFassungVon;
  const ablehnungOffen = !!d.abgelehnt && !d.abgelehnt.erledigt;
  const englisch = sprache === "en";
  const sperre = async (f: () => Promise<boolean>) => { if (laeuft) return false; setLaeuft(true); try { return await f(); } finally { setLaeuft(false); } };
  return (
    <div className={`cgn-eintrag${d.neu ? " neu" : ""}`} data-cgn={d.neu ? "dok-neu-zeile" : "dok"}>
      <span className="cgn-eintrag-text">
        <a href={d.url} target="_blank" rel="noreferrer" onClick={() => geoeffnet(d)}>{titel}</a>
        <small>{d.von === "kunde" ? "vom Kunden" : (d.vonName ?? "FIAON")} · {datum(d.am)}{d.post?.absender ? ` · ${d.post.absender}` : ""}{d.name ? ` · ${d.name}` : ""}</small>
        {d.abgelehnt && <small>{ablehnungOffen ? "Bitte neu" : "Ersetzt — war „bitte neu“"}: „{d.abgelehnt.grund}“</small>}
      </span>
      <span className="cgn-eintrag-rechts">
        {d.neu && <Marke ton="blau">Neu</Marke>}
        {d.abgelehnt && (ablehnungOffen ? <Marke ton="rot">bitte neu</Marke> : <Marke>ersetzt</Marke>)}
        {d.unterschrift?.gefordert && <Marke ton={d.unterschrift.unterschrieben ? "gruen" : "blau"}>{d.unterschrift.unterschrieben ? `unterschrieben ${datum(d.unterschrift.am)}` : "wartet auf Unterschrift"}</Marke>}
        {!d.neu && !d.abgelehnt && !d.unterschrift?.gefordert && d.von !== "kunde" && (d.sichtbarFuerKunde ? <Marke ton={d.gelesen ? "gruen" : undefined}>{d.gelesen ? "gelesen" : "ungelesen"}</Marke> : <Marke>nur intern</Marke>)}
        <button type="button" className="cgn-punkte" aria-expanded={mehr} aria-label={`Handgriffe zu ${titel}`} onClick={() => setMehr((v) => !v)}>···</button>
      </span>
      {mehr && (
        <div className="cgn-eintrag-mehr">
          {kundeFrei && (
            <select value={d.art} aria-label="Art des Dokuments" title="Art korrigieren — zählt danach für die richtige Unterlage"
                    onChange={(e) => { if (e.target.value !== d.art) void tun(`/dokument/${d.id}`, "POST", { art: e.target.value }); }}>
              {ARTEN_TRESOR.map((g) => (
                <optgroup key={g.kategorie} label={g.titel.de}>
                  {GLOBAL_DOKUMENTARTEN.filter((a) => globalTresorKategorie(a.art) === g.kategorie && a.art !== "post" && (globalKundeDarfArt(a.art) || a.art === d.art)).map((a) => <option key={a.art} value={a.art}>{a.de}</option>)}
                </optgroup>
              ))}
            </select>
          )}
          {kundeFrei && !d.abgelehnt && grund === null && <button type="button" className="cgn-knopf klein" data-cgn="bitte-neu" onClick={() => setGrund("")}>Bitte neu …</button>}
          {kundeFrei && ablehnungOffen && <button type="button" className="cgn-knopf klein" disabled={laeuft} onClick={() => void sperre(() => tun(`/dokument/${d.id}`, "POST", { ablehnungZurueck: true }))}>„Bitte neu“ zurücknehmen</button>}
          {d.von !== "kunde" && <button type="button" className="cgn-knopf klein" onClick={() => void tun(`/dokument/${d.id}`, "POST", { sichtbar: !d.sichtbarFuerKunde })}>{d.sichtbarFuerKunde ? "Nur intern" : "Für Kunden freigeben"}</button>}
          {d.istPdf && !d.unterschrift?.unterschrieben && d.von !== "kunde" && <button type="button" className="cgn-knopf klein" data-cgn="unterschrift-anfordern" onClick={() => void tun(`/dokument/${d.id}`, "POST", { unterschrift: !d.unterschrift?.gefordert })}>{d.unterschrift?.gefordert ? "Keine Unterschrift" : "Unterschrift anfordern"}</button>}
          <button type="button" className="cgn-knopf klein gefahr" onClick={() => { if (window.confirm(`„${titel}“ aus dem Tresor entfernen?`)) void tun(`/dokument/${d.id}`, "DELETE"); }}>Entfernen</button>
          {grund !== null && (
            <div className="cgn-form" style={{ width: "100%" }}>
              <input value={grund} maxLength={300} autoFocus onChange={(e) => setGrund(e.target.value)} aria-label="Grund für den Kunden"
                     placeholder={englisch ? "Reason in English, e.g. Photo instead of a scan — please upload a PDF scan" : "Grund für den Kunden, z. B. Foto statt Scan — bitte als PDF-Scan"} />
              <p className="cgn-satz">{englisch ? "Der Kunde liest Englisch — bitte auf Englisch schreiben. " : ""}Er sieht die Unterlage wieder unter „Für Sie zu tun“, mit diesem Satz. Es geht keine Mail raus.</p>
              <div className="cgn-reihe">
                <button type="button" className="cgn-knopf haupt klein" disabled={laeuft || grund.trim().length < 8}
                        onClick={async () => { if (await sperre(() => tun(`/dokument/${d.id}`, "POST", { ablehnen: grund.trim() }))) setGrund(null); }}>
                  {laeuft ? "Speichert …" : "Als „bitte neu“ markieren"}
                </button>
                <button type="button" className="cgn-knopf klein" onClick={() => setGrund(null)}>Abbrechen</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Pflichtformulare (SS-4, 8821, weitere zur Unterschrift), Scan im Namen des Kunden, Akte als ZIP — /akte.
const STAND_TEXT: Record<string, string> = { fehlt: "noch nicht abgelegt", vorbereitet: "vorbereitet (intern)", wartet: "beim Kunden", unterschrieben: "unterschrieben" };
function Pflichtformulare({ gref, tun }: { gref: string; tun: Tun }) {
  const { daten, fehler, neu } = useDaten<{ ok: true; pflicht: T; zipUrl: string }>(`/chef/global/mandate/${encodeURIComponent(gref)}/akte`, [], NACHLADEN_MS);
  const [hoch, setHoch] = useState<{ key: string; titel: string; datei: File | null; modus: "digital" | "handschriftlich"; scanFuer?: number } | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  if (fehler) return <Fehlermeldung text={fehler} erneut={neu} />;
  if (!daten) return <Geruest zeilen={4} />;
  const p = daten.pflicht;
  const anzahl = p?.eintraege?.length ?? 0;
  const hochladen = async () => {
    if (!hoch?.datei || laeuft) return;
    const fd = new FormData();
    setLaeuft(true);
    try {
      if (hoch.scanFuer) { fd.append("datei", hoch.datei); if (await tun(`/dokument/${hoch.scanFuer}/scan`, "POST", fd)) { setHoch(null); neu(); } return; }
      const formular = hoch.key !== "weitere";
      fd.append("art", formular ? (p?.eintraege?.find((e: T) => e.key === hoch.key)?.art ?? "steuer") : "sonstiges");
      fd.append("datei", hoch.datei); fd.append("sichtbar", "true"); fd.append("unterschrift", "true"); fd.append("mitteilen", "false");
      if (formular) fd.append("pflichtKey", hoch.key); else if (hoch.titel.trim()) fd.append("titel", hoch.titel.trim());
      fd.append("unterschriftArt", hoch.modus);
      if (await tun("/dokument", "POST", fd)) { setHoch(null); neu(); }
    } finally { setLaeuft(false); }
  };
  return (
    <div className="cgn-gruppe" data-cgn="pflicht">
      <div className="cgn-reihe zwischen">
        <p className="cgn-satz">{anzahl === 0 ? "Noch nichts zur Unterschrift." : p?.vollstaendig ? <b>Vollständig — alles unterschrieben.</b> : <><b>{p?.offen ?? 0} offen</b> von {anzahl}.</>}</p>
        <a className="cgn-knopf klein" href={daten.zipUrl} data-cgn="akte-zip">Akte als ZIP</a>
      </div>
      {anzahl > 0 && <div className="cgn-balken"><i style={{ width: `${Math.round(((anzahl - (p?.offen ?? 0)) / anzahl) * 100)}%` }} /></div>}
      {!p?.gegruendet && <p className="cgn-satz">IRS SS-4 und 8821 erscheinen, sobald der Gründungstag eingetragen ist — oder sobald du eines ablegst.</p>}
      {(p?.eintraege ?? []).map((e: T) => (
        <div key={e.key} className="cgn-eintrag">
          <span className="cgn-eintrag-text"><b>{e.titel}</b><small>{e.text || "vom Team zur Unterschrift gestellt"} · {e.modus === "handschriftlich" ? "von Hand (Scan als PDF)" : "digital im Portal"}</small></span>
          <span className="cgn-eintrag-rechts">
            <Marke ton={e.stand === "unterschrieben" ? "gruen" : e.stand === "wartet" ? "blau" : undefined}>{STAND_TEXT[e.stand] ?? e.stand}</Marke>
            {e.formular && e.stand !== "unterschrieben" && <button type="button" className="cgn-knopf klein" onClick={() => setHoch({ key: e.key, titel: e.titel, datei: null, modus: e.modus })}>{e.stand === "fehlt" ? "Hochladen" : "Neue Fassung"}</button>}
            {e.stand === "wartet" && e.modus === "handschriftlich" && e.dokumentId && <button type="button" className="cgn-knopf klein" data-cgn="scan-im-namen" onClick={() => setHoch({ key: e.key, titel: e.titel, datei: null, modus: "handschriftlich", scanFuer: e.dokumentId })}>Unterschriebenen Scan ablegen</button>}
          </span>
        </div>
      ))}
      {!hoch && <div className="cgn-reihe" style={{ paddingTop: 10 }}><button type="button" className="cgn-knopf klein" onClick={() => setHoch({ key: "weitere", titel: "", datei: null, modus: "digital" })}>Weiteres Dokument zur Unterschrift</button></div>}
      {hoch && (
        <div className="cgn-form">
          {hoch.key === "weitere" && !hoch.scanFuer ? (
            <div className="cgn-felder">
              <label className="cgn-feld">Titel für den Kunden<input value={hoch.titel} onChange={(e) => setHoch({ ...hoch, titel: e.target.value })} placeholder="z. B. Bankformular" /></label>
              <label className="cgn-feld">Wie unterschreibt er?<select value={hoch.modus} onChange={(e) => setHoch({ ...hoch, modus: e.target.value as "digital" | "handschriftlich" })}><option value="digital">digital im Portal</option><option value="handschriftlich">von Hand (Scan als PDF)</option></select></label>
            </div>
          ) : <p className="cgn-satz"><b>{hoch.titel}</b> — {hoch.scanFuer ? "unterschriebener Scan (nur PDF)" : "PDF"}</p>}
          <input type="file" accept="application/pdf,.pdf" onChange={(e) => setHoch({ ...hoch, datei: e.target.files?.[0] ?? null })} />
          <div className="cgn-reihe">
            <button type="button" className="cgn-knopf haupt klein" disabled={!hoch.datei || laeuft} onClick={() => void hochladen()}>{laeuft ? "Lädt …" : hoch.scanFuer ? "Als unterschrieben ablegen" : "Zur Unterschrift bereitstellen"}</button>
            <button type="button" className="cgn-knopf klein" onClick={() => setHoch(null)}>Abbrechen</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══ NACHRICHTEN ═════════════════════════════════════════════════════════════
export function Nachrichten({ m, tun, fokus }: { m: T; tun: Tun; fokus: number }) {
  const [text, setText] = useState("");
  const [mail, setMail] = useState(true);
  const [laeuft, setLaeuft] = useState(false);
  const feld = useRef<HTMLTextAreaElement | null>(null);
  const faden = useRef<HTMLDivElement | null>(null);
  const liste = m.nachrichten as T[];
  useEffect(() => { if (fokus) feld.current?.focus({ preventScroll: true }); }, [fokus]);
  useEffect(() => { const f = faden.current; if (f) f.scrollTop = f.scrollHeight; }, [liste.length]);
  return (
    <>
      {!m.portal?.neu && <p className="cgn-warnung">Das bisherige Portal zeigt keine Antworten — zusätzlich per Mail oder Telefon antworten.</p>}
      <div className="cgn-faden" ref={faden}>
        {liste.length === 0 && <p className="cgn-leer">Noch keine Nachricht. Schreibt der Kunde im Portal, erscheint es hier.</p>}
        {liste.map((n) => (
          <div key={n.id} className={`cgn-blase ${n.von === "kunde" ? "kunde" : "fiaon"}`}>
            {n.text}
            <small>{n.von === "kunde" ? "Kunde" : n.autor} · {datumZeit(n.am)}{n.von !== "kunde" ? (n.gelesen ? " · gelesen" : " · noch nicht gelesen") : ""}</small>
          </div>
        ))}
      </div>
      <div className="cgn-form">
        <textarea ref={feld} rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Antwort an den Kunden — er liest sie im Portal" aria-label="Antwort an den Kunden" />
        <div className="cgn-reihe zwischen">
          <label className="cgn-haken"><input type="checkbox" checked={mail} onChange={(e) => setMail(e.target.checked)} /> Per Mail Bescheid geben (ohne Inhalt)</label>
          <button type="button" className="cgn-knopf haupt" data-cgn="antworten" disabled={text.trim().length < 2 || laeuft}
                  onClick={async () => { setLaeuft(true); try { if (await tun("/antwort", "POST", { text, mitteilen: mail })) setText(""); } finally { setLaeuft(false); } }}>
            {laeuft ? "Sendet …" : "Antworten"}
          </button>
        </div>
      </div>
    </>
  );
}

// ═══ ZAHLUNGEN & LEISTUNGEN ══════════════════════════════════════════════════
const LEISTUNG: Record<string, { text: string; ton?: "blau" | "gruen" | "rot" }> = {
  gebucht: { text: "Gebucht · Rechnung offen", ton: "blau" }, bezahlt: { text: "Bezahlt · einrichten", ton: "blau" },
  aktiv: { text: "Aktiv", ton: "gruen" }, storniert: { text: "Storniert", ton: "rot" },
};
export function Zahlungen({ m, gref, tun }: { m: T; gref: string; tun: Tun }) {
  const r = encodeURIComponent(gref);
  const akte = useDaten<{ ok: true; rechnungen: T[]; vertraege: T[] }>(`/chef/global/mandate/${r}/akte`, [], NACHLADEN_MS);
  const zusatz = useDaten<{ ok: true; katalog: T[]; buchungen: T[] }>(`/chef/global/mandate/${r}/zusatz`, [], NACHLADEN_MS);
  const [notiz, setNotiz] = useState<Record<number, string>>({});
  const [laeuft, setLaeuft] = useState<number | null>(null);
  const [katalog, setKatalog] = useState(false);
  const garantie = m.angebot?.garantieZiel;
  const setzen = async (id: number, status: string, frage: string) => {
    if (!window.confirm(frage)) return;
    setLaeuft(id);
    if (await tun(`/zusatz/${id}/status`, "POST", { status, notiz: notiz[id] ?? "" })) { setNotiz((n) => ({ ...n, [id]: "" })); zusatz.neu(); }
    setLaeuft(null);
  };
  return (
    <>
      <dl className="cgn-daten">
        <dt>Vertrag</dt><dd>{m.paketName}{m.vertragUrl && <a className="cgn-link" href={m.vertragUrl} target="_blank" rel="noreferrer">PDF</a>}</dd>
        <dt>Erteilt</dt><dd>{datum(m.erstelltAm)}</dd>
        <dt>Bezahlt</dt><dd>{m.bezahltAm ? datum(m.bezahltAm) : m.zahlung?.status === "bezahlt" ? "bezahlt" : <span className="leer">offen</span>}</dd>
        {m.rechnungsnummer && <><dt>Rechnung</dt><dd>{m.rechnungsnummer}{m.rechnungUrl && <a className="cgn-link" href={m.rechnungUrl} target="_blank" rel="noreferrer">PDF</a>}</dd></>}
        {(m.angebot?.teile as T[] | undefined)?.map((t) => <Fragment key={t.nr}><dt>Teil {t.nr}</dt><dd>{t.titel} · {euro(t.betragCents)} · {t.stand}</dd></Fragment>)}
        {garantie && <><dt>Garantieziel</dt><dd>{String(garantie)}</dd></>}
      </dl>

      <div className="cgn-gruppe" data-cgn="rechnungen">
        <span className="cgn-auge">Alle Rechnungen der Person</span>
        {akte.fehler && <Fehlermeldung text={akte.fehler} erneut={akte.neu} />}
        {!akte.daten && !akte.fehler && <Geruest zeilen={2} />}
        {akte.daten?.rechnungen.length === 0 && <p className="cgn-leer">Keine Rechnung gefunden.</p>}
        {akte.daten?.rechnungen.map((x) => (
          <div key={x.bestellRef} className="cgn-eintrag">
            <span className="cgn-eintrag-text">{x.pdfUrl ? <a href={x.pdfUrl} target="_blank" rel="noopener">{x.titel}</a> : <b>{x.titel}</b>}<small>{x.nummer ?? x.bestellRef} · {x.datum ? datum(x.datum) : "—"} · {x.art}</small></span>
            <span className="cgn-eintrag-rechts"><b style={{ fontWeight: 300 }}>{euro(x.betragCents)}</b><Marke ton={x.status === "bezahlt" ? "gruen" : x.status === "offen" ? "blau" : "rot"}>{x.statusText}</Marke></span>
          </div>
        ))}
      </div>

      {(akte.daten?.vertraege.length ?? 0) > 0 && (
        <div className="cgn-gruppe">
          <span className="cgn-auge">Verträge und Vereinbarungen</span>
          {akte.daten!.vertraege.map((v) => <div key={v.key} className="cgn-eintrag"><span className="cgn-eintrag-text"><a href={v.url} target="_blank" rel="noopener">{v.titel}</a><small>{v.unter}</small></span></div>)}
        </div>
      )}

      <div className="cgn-gruppe" data-cgn="leistungen">
        <span className="cgn-auge">Leistungen · Zusatzdienste aus „Ihr Büro erweitern“</span>
        {zusatz.fehler && <Fehlermeldung text={zusatz.fehler} erneut={zusatz.neu} />}
        {zusatz.daten?.buchungen.length === 0 && <p className="cgn-leer">Noch kein Zusatzdienst gebucht.</p>}
        {zusatz.daten?.buchungen.map((b) => {
          const st = LEISTUNG[b.status] ?? { text: b.status };
          return (
            <div key={b.id} className="cgn-eintrag">
              <span className="cgn-eintrag-text">
                <b>{b.titel}</b>
                <small>{b.preis}{b.angabe ? ` · ${b.angabe}` : ""} · {b.rechnungsnummer ? `Rechnung ${b.rechnungsnummer}` : "Rechnung noch nicht erstellt"}{b.zahlungsstatus ? ` · Zahlung: ${b.zahlungsstatus}` : ""}</small>
                <small>gebucht {datumZeit(b.am)}{b.bezahltAm ? ` · bezahlt ${datum(b.bezahltAm)}${b.bezahltVon ? ` (${b.bezahltVon})` : ""}` : ""}{b.aktivAm ? ` · aktiv ${datum(b.aktivAm)}` : ""}{b.storniertAm ? ` · storniert ${datum(b.storniertAm)}` : ""}{b.mailAm ? " · Rechnungsmail raus" : b.mailFehler ? ` · Rechnungsmail NICHT raus: ${b.mailFehler}` : ""}{b.notiz ? ` · Notiz: „${b.notiz}“` : ""}</small>
                {b.intern && <small>Intern: {b.intern}</small>}
              </span>
              <span className="cgn-eintrag-rechts">
                <Marke ton={st.ton}>{st.text}</Marke>
                {b.rechnungUrl && <a className="cgn-link" href={b.rechnungUrl} target="_blank" rel="noopener">Rechnung</a>}
              </span>
              {b.status !== "storniert" && (
                <div className="cgn-eintrag-mehr">
                  <input value={notiz[b.id] ?? ""} onChange={(e) => setNotiz((n) => ({ ...n, [b.id]: e.target.value }))} placeholder="Notiz (intern, freiwillig)" aria-label="Notiz zur Leistung" style={{ flex: "1 1 200px" }} />
                  {b.status === "gebucht" && <button type="button" className="cgn-knopf klein" disabled={laeuft === b.id} onClick={() => void setzen(b.id, "bezahlt", "Als bezahlt markieren? Nur, wenn das Geld sicher eingegangen ist — die Rechnung wird hier NICHT gebucht.")}>Bezahlt (von Hand)</button>}
                  {(b.status === "gebucht" || b.status === "bezahlt") && <button type="button" className="cgn-knopf klein haupt" disabled={laeuft === b.id} onClick={() => void setzen(b.id, "aktiv", "Ist der Dienst eingerichtet? Der Kunde sieht ihn danach als „Aktiv“.")}>Aktiv setzen</button>}
                  <button type="button" className="cgn-knopf klein gefahr" disabled={laeuft === b.id} onClick={() => void setzen(b.id, "storniert", "Diesen Dienst stornieren? Eine offene Rechnung wird storniert; eine bezahlte erstattest du von Hand.")}>Stornieren</button>
                </div>
              )}
            </div>
          );
        })}
        {(zusatz.daten?.katalog.length ?? 0) > 0 && <button type="button" className="cgn-klein-schalter" aria-expanded={katalog} onClick={() => setKatalog((v) => !v)}>{katalog ? "Katalog ausblenden" : "Katalog der Zusatzdienste zeigen"}</button>}
        {katalog && zusatz.daten?.katalog.map((k) => (
          <div key={k.key} className="cgn-eintrag"><span className="cgn-eintrag-text"><b>{k.titel}</b><small>{k.preis}{k.buchbar ? (k.freigegeben ? " · für Kunden freigegeben" : " · nicht freigegeben (Einstellungen unter der Tafel)") : " · noch nicht buchbar"} · {k.intern}</small></span></div>
        ))}
      </div>
    </>
  );
}

// ═══ FIRMENDATEN ═════════════════════════════════════════════════════════════
// Die Werte der Stationen (EIN, Registernummer, Agent, US-Adresse, US-Telefon, ITIN, D-U-N-S, Konto …) — je Wert
// „Ändern“ an Ort und Stelle, gespeichert über /station mit derselben Prüfung wie der Stationen-Editor.
const FIRMEN_STATIONEN: { schluessel: string; titel: string }[] = [
  { schluessel: "eingetragen", titel: "Gesellschaft" }, { schluessel: "agent", titel: "Registered Agent" }, { schluessel: "adresse", titel: "Adresse und Telefon" },
  { schluessel: "ein", titel: "EIN" }, { schluessel: "itin", titel: "ITIN" }, { schluessel: "konto", titel: "Geschäftskonto" }, { schluessel: "duns", titel: "D-U-N-S" },
  { schluessel: "vorgesellschaft", titel: "Frühere Gesellschaft" },
];
/** Felder, die nur in „Alle Angaben“ stehen (selten gebraucht). */
const SELTEN = new Set(["kontaktRolle", "kontaktEmail", "kontaktTelefon", "kontaktAdresse", "privatAdresse", "form"]);

export function Firmendaten({ m, tun, gref }: { m: T; tun: Tun; gref: string }) {
  const [alle, setAlle] = useState(false);
  const [hinweis, setHinweis] = useState(String(m.gesellschaftPlus?.hinweis ?? ""));
  const k = m.kontakt ?? {};
  return (
    <>
      <div className="cgn-gruppe">
        <span className="cgn-auge">Ansprechpartner beim Kunden</span>
        <dl className="cgn-daten">
          <dt>Name</dt><dd>{[k.anrede, k.vorname, k.nachname].filter(Boolean).join(" ") || <span className="leer">—</span>}</dd>
          <dt>E-Mail</dt><dd>{k.email ? <a className="cgn-link" href={`mailto:${k.email}`}>{k.email}</a> : <span className="leer">—</span>}</dd>
          <dt>Telefon</dt><dd>{k.telefon ? <a className="cgn-link" href={`tel:${k.telefon}`}>{k.telefon}</a> : <span className="leer">—</span>}</dd>
          {m.firmaVoll?.name && m.firmaVoll?.art !== "privat" && <><dt>Firma</dt><dd>{String(m.firmaVoll.name)}</dd></>}
          <dt>Sprache</dt><dd>{m.sprache === "en" ? "Englisch" : "Deutsch"}</dd>
          {m.person && <><dt>Personenakte</dt><dd><a className="cgn-link" href={`/akte/${m.person.id}`}>Person {m.person.id} öffnen</a>{m.person.gesperrt ? <span className="leer">für Privat-Abläufe gesperrt</span> : null}</dd></>}
        </dl>
      </div>

      <Zustaendigkeit m={m} tun={tun} />

      {FIRMEN_STATIONEN.map((st) => {
        const felder = (GLOBAL_STATION_FELDER[st.schluessel] ?? []).filter((f) => alle || !SELTEN.has(f.feld));
        if (st.schluessel === "vorgesellschaft" && !m.gesellschaftPlus?.vorGesellschaft && !alle) return null;
        if (!felder.length) return null;
        return (
          <div key={st.schluessel} className="cgn-gruppe" data-cgn={`firma-${st.schluessel}`}>
            <span className="cgn-auge">{st.titel}</span>
            <dl className="cgn-daten">
              {felder.map((f) => <FeldInline key={f.feld} schluessel={st.schluessel} f={f} m={m} tun={tun} gref={gref} />)}
            </dl>
          </div>
        );
      })}
      <button type="button" className="cgn-klein-schalter" aria-expanded={alle} onClick={() => setAlle((v) => !v)}>{alle ? "Weniger Angaben" : "Alle Angaben (Kontaktperson, Rechtsform, private Adresse …)"}</button>

      <div className="cgn-gruppe">
        <span className="cgn-auge">Hinweis zur Gesellschaft · sieht der Kunde</span>
        <div className="cgn-reihe">
          <input value={hinweis} maxLength={400} onChange={(e) => setHinweis(e.target.value)} placeholder="z. B. Der Annual Report ist bis 1. Mai fällig — wir erinnern Sie rechtzeitig." aria-label="Hinweis zur Gesellschaft" style={{ flex: "1 1 260px" }} />
          <button type="button" className="cgn-knopf klein" disabled={hinweis === String(m.gesellschaftPlus?.hinweis ?? "")} onClick={() => void tun("/gesellschaft", "POST", { plus: { hinweis } })}>Speichern</button>
        </div>
      </div>
    </>
  );
}

function feldAnzeige(f: StationFeld, m: T): string {
  const g = m.gesellschaft ?? {}; const p = m.gesellschaftPlus ?? {};
  if (f.art === "itin") return String(p.itinMaske ?? "");
  const w = String((f.ort === "grund" ? g : p)[f.feld] ?? "");
  if (!w) return "";
  if (f.art === "staat") return US_BUNDESSTAATEN[w] ?? g.bundesstaatName ?? w;
  if (f.art === "datum") return tagDe(w);
  if (f.art === "telefon") return stationTelefonText(w);
  if (f.art === "rolle") return STATION_ROLLEN.find((r) => r.wert === w)?.titel ?? w;
  return w;
}

function FeldInline({ schluessel, f, m, tun, gref }: { schluessel: string; f: StationFeld; m: T; tun: Tun; gref: string }) {
  const roh = f.art === "itin" ? "" : String(((f.ort === "grund" ? m.gesellschaft : m.gesellschaftPlus) ?? {})[f.feld] ?? "");
  const [auf, setAuf] = useState(false);
  const [wert, setWert] = useState(roh);
  const [fehler, setFehler] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [klar, setKlar] = useState<string | null>(null);
  useEffect(() => { if (!auf) setWert(roh); }, [roh, auf]);
  useEffect(() => { if (!klar) return; const t = window.setTimeout(() => setKlar(null), 20_000); return () => window.clearTimeout(t); }, [klar]);
  const anzeige = feldAnzeige(f, m);
  const speichern = async () => {
    const pr = stationWertePruefen(schluessel, { [f.feld]: wert }, heuteBerlin());
    if (!pr.ok) { setFehler(pr.error); return; }
    setLaeuft(true); setFehler("");
    try { if (await tun("/station", "POST", { schluessel, werte: { [f.feld]: wert } })) setAuf(false); } finally { setLaeuft(false); }
  };
  const itinZeigen = async () => {
    const j = await senden(`/chef/global/mandate/${encodeURIComponent(gref)}/itin`, "POST");
    if (j.ok) setKlar(String(j.itin)); else setFehler(String(j.error));
  };
  const eingabe = f.art === "mehrzeilig" ? <textarea rows={3} value={wert} onChange={(e) => setWert(e.target.value)} placeholder={f.platzhalter} aria-label={f.titel} autoFocus />
    : f.art === "datum" ? <input type="date" max={heuteBerlin()} value={wert} onChange={(e) => setWert(e.target.value)} aria-label={f.titel} autoFocus />
    : f.art === "staat" ? <select value={wert} onChange={(e) => setWert(e.target.value)} aria-label={f.titel} autoFocus><option value="">—</option>{Object.entries(US_BUNDESSTAATEN).map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select>
    : f.art === "form" ? <select value={wert} onChange={(e) => setWert(e.target.value)} aria-label={f.titel} autoFocus><option value="">—</option><option value="LLC">LLC</option><option value="Corporation">Corporation</option></select>
    : f.art === "rolle" ? <select value={wert} onChange={(e) => setWert(e.target.value)} aria-label={f.titel} autoFocus><option value="">—</option>{STATION_ROLLEN.map((r) => <option key={r.wert} value={r.wert}>{r.titel}</option>)}</select>
    : <input value={wert} onChange={(e) => setWert(e.target.value)} placeholder={f.platzhalter} aria-label={f.titel} autoComplete="off" autoFocus
             inputMode={f.art === "telefon" || f.art === "telefon_int" ? "tel" : f.art === "ein" || f.art === "duns" || f.art === "itin" ? "numeric" : f.art === "email" ? "email" : undefined} />;
  return (
    <>
      <dt>{f.titel.replace(/ \(intern\)$/, "")}{f.intern && <span className="cgn-intern">intern</span>}</dt>
      <dd>
        {auf ? (
          <span style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
            {eingabe}
            {fehler && <span className="cgn-fehler" role="alert">{fehler}</span>}
            <span className="cgn-reihe">
              <button type="button" className="cgn-knopf haupt klein" disabled={laeuft} onClick={() => void speichern()}>{laeuft ? "Speichert …" : "Speichern"}</button>
              <button type="button" className="cgn-knopf klein" onClick={() => { setAuf(false); setFehler(""); }}>Abbrechen</button>
            </span>
          </span>
        ) : (
          <>
            {anzeige ? (f.art === "mehrzeilig" ? <pre>{anzeige}</pre> : <span>{klar ?? anzeige}</span>) : <span className="leer">noch leer</span>}
            <span className="cgn-reihe">
              {f.art === "itin" && anzeige && (klar ? <button type="button" className="cgn-link leise" onClick={() => setKlar(null)}>Verbergen</button> : <button type="button" className="cgn-link leise" onClick={() => void itinZeigen()}>Anzeigen</button>)}
              <button type="button" className="cgn-link" onClick={() => { setWert(roh); setAuf(true); setKlar(null); }}>{anzeige ? "Ändern" : "Eintragen"}</button>
            </span>
            {fehler && <span className="cgn-fehler" role="alert">{fehler}</span>}
          </>
        )}
      </dd>
    </>
  );
}

/** E-451: EINE Quelle für „wer führt die Akte“ — Portal, Aufgaben und Chefbüro. */
export function Zustaendigkeit({ m, tun }: { m: T; tun: Tun }) {
  const z = (m.zustaendigkeit ?? {}) as { agentId: number | null; name: string | null; aufgabenAn?: string; portalNennt: string | null; auswahl?: { id: number; name: string }[] };
  const [wahl, setWahl] = useState<string>(z.agentId ? String(z.agentId) : "");
  const [laeuft, setLaeuft] = useState(false);
  return (
    <div className="cgn-gruppe" id="cgn-zustaendig" data-cgn="zustaendig">
      <span className="cgn-auge">Zuständig bei FIAON</span>
      <dl className="cgn-daten">
        <dt>Führt die Akte</dt><dd>{z.name ?? <span className="leer">niemand festgelegt</span>}</dd>
        <dt>Aufgaben gehen an</dt><dd>{z.aufgabenAn ?? "—"}</dd>
        <dt>Portal nennt</dt><dd>{z.portalNennt ?? <span className="leer">niemanden</span>}</dd>
      </dl>
      <div className="cgn-reihe">
        <select value={wahl} onChange={(e) => setWahl(e.target.value)} aria-label="Zuständige Person">
          <option value="">Person wählen …</option>
          {(z.auswahl ?? []).map((a) => <option key={a.id} value={String(a.id)}>{a.name}</option>)}
        </select>
        <button type="button" className="cgn-knopf klein haupt" disabled={!wahl || laeuft || Number(wahl) === z.agentId}
                title="Offene Aufgaben dieser Akte wandern mit; der Kunde bekommt keine Mail."
                onClick={async () => { setLaeuft(true); try { await tun("/zustaendig", "POST", { agentId: Number(wahl) }); } finally { setLaeuft(false); } }}>
          {laeuft ? "Legt fest …" : "Festlegen"}
        </button>
      </div>
    </div>
  );
}

// ═══ BANKEN & KAPITAL ════════════════════════════════════════════════════════
const LEER_KAPITAL = { id: 0, art: "konto", institut: "", produkt: "", inhaber: "firma", status: "vorbereitung", betragUsd: "", beantragtAm: "", entschiedenAm: "", hinweis: "", intern: "", sichtbar: true };
export function Kapital({ m, tun }: { m: T; tun: Tun }) {
  const [form, setForm] = useState<typeof LEER_KAPITAL | null>(null);
  const liste = m.kapital as T[];
  const speichern = async () => { if (form && await tun("/kapital", "POST", form)) setForm(null); };
  return (
    <>
      <div className="cgn-reihe zwischen">
        <div className="cgn-summe"><b>{globalUsd(m.zugesagtCents)}</b><small>zugesagt oder aktiv{m.angebot?.garantieZiel ? ` · Garantieziel ${String(m.angebot.garantieZiel)}` : ""}</small></div>
        {!form && <button type="button" className="cgn-knopf klein haupt" onClick={() => setForm({ ...LEER_KAPITAL })}>Eintrag anlegen</button>}
      </div>
      <p className="cgn-satz">Der Kunde sieht Art, Status, Datum und Hinweis — nie Institut oder Produkt, einen Betrag erst ab „Zugesagt“.</p>
      {form && (
        <div className="cgn-form">
          <div className="cgn-felder">
            <label className="cgn-feld">Art<select value={form.art} onChange={(e) => setForm({ ...form, art: e.target.value })}>{GLOBAL_KAPITAL_ARTEN.map((a) => <option key={a.art} value={a.art}>{a.titel.de}</option>)}</select></label>
            <label className="cgn-feld">Institut<input value={form.institut} onChange={(e) => setForm({ ...form, institut: e.target.value })} /></label>
            <label className="cgn-feld">Produkt<input value={form.produkt} onChange={(e) => setForm({ ...form, produkt: e.target.value })} /></label>
            {form.art === "karte" && <label className="cgn-feld">Karte für<select value={form.inhaber} onChange={(e) => setForm({ ...form, inhaber: e.target.value })}><option value="firma">Firma</option><option value="privat">Privat</option></select></label>}
            <label className="cgn-feld">Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{GLOBAL_KAPITAL_STATUS.map((a) => <option key={a.status} value={a.status}>{a.titel.de}</option>)}</select></label>
            <label className="cgn-feld">Betrag / Limit (USD)<input inputMode="numeric" value={form.betragUsd} onChange={(e) => setForm({ ...form, betragUsd: e.target.value })} placeholder="25000" /></label>
            <label className="cgn-feld">Beantragt am<input type="date" value={form.beantragtAm} onChange={(e) => setForm({ ...form, beantragtAm: e.target.value })} /></label>
            <label className="cgn-feld">Entschieden am<input type="date" value={form.entschiedenAm} onChange={(e) => setForm({ ...form, entschiedenAm: e.target.value })} /></label>
            <label className="cgn-feld breit">Hinweis für den Kunden<input value={form.hinweis} onChange={(e) => setForm({ ...form, hinweis: e.target.value })} /></label>
            <label className="cgn-feld breit">Interne Notiz<input value={form.intern} onChange={(e) => setForm({ ...form, intern: e.target.value })} /></label>
          </div>
          <label className="cgn-haken"><input type="checkbox" checked={form.sichtbar} onChange={(e) => setForm({ ...form, sichtbar: e.target.checked })} /> Kunde sieht diesen Eintrag</label>
          <div className="cgn-reihe">
            <button type="button" className="cgn-knopf haupt klein" onClick={() => void speichern()}>{form.id ? "Speichern" : "Anlegen"}</button>
            <button type="button" className="cgn-knopf klein" onClick={() => setForm(null)}>Abbrechen</button>
          </div>
        </div>
      )}
      <div className="cgn-gruppe">
        {liste.length === 0 && !form && <p className="cgn-leer">Noch nichts erfasst. Konto, Karten und Rahmen erscheinen hier.</p>}
        {liste.map((k) => {
          const ton = GLOBAL_KAPITAL_STATUS.find((s) => s.status === k.status)?.ton;
          return (
            <div key={k.id} className="cgn-eintrag">
              <span className="cgn-eintrag-text">
                <b>{k.artText} · {k.institut || "Institut offen"}{k.produkt ? ` · ${k.produkt}` : ""}</b>
                <small>{[k.beantragtAm ? `beantragt ${datum(k.beantragtAm)}` : "", k.entschiedenAm ? `entschieden ${datum(k.entschiedenAm)}` : "", !k.sichtbar ? "nur intern" : "", k.hinweis ? `„${k.hinweis}“` : ""].filter(Boolean).join(" · ") || "—"}</small>
              </span>
              <span className="cgn-eintrag-rechts">
                {k.betragCents != null && <b style={{ fontWeight: 300 }}>{globalUsd(k.betragCents)}</b>}
                <Marke ton={ton === "leise" ? undefined : ton}>{k.statusText}</Marke>
                <button type="button" className="cgn-link" onClick={() => setForm({ id: k.id, art: k.art, institut: k.institut ?? "", produkt: k.produkt ?? "", inhaber: k.inhaber ?? "firma", status: k.status, betragUsd: k.betragCents != null ? String(k.betragCents / 100) : "", beantragtAm: k.beantragtAm ?? "", entschiedenAm: k.entschiedenAm ?? "", hinweis: k.hinweis ?? "", intern: k.intern ?? "", sichtbar: !!k.sichtbar })}>Bearbeiten</button>
                <button type="button" className="cgn-link leise" onClick={() => { if (window.confirm("Diesen Eintrag entfernen?")) void tun(`/kapital/${k.id}`, "DELETE"); }}>Entfernen</button>
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ═══ FRISTEN ═════════════════════════════════════════════════════════════════
export function Fristen({ m, tun }: { m: T; tun: Tun }) {
  const [titel, setTitel] = useState("");
  const [faellig, setFaellig] = useState("");
  const [hinweis, setHinweis] = useState("");
  const [neu, setNeu] = useState(false);
  const liste = m.fristen as T[];
  return (
    <>
      <p className="cgn-satz">Der Kunde sieht jede Frist und wird 30 und 7 Tage vorher erinnert.</p>
      <div className="cgn-gruppe">
        {liste.length === 0 && <p className="cgn-leer">Keine Fristen — sie entstehen mit Bundesstaat und Gründungstag.</p>}
        {liste.map((f) => (
          <div key={f.id} className="cgn-eintrag" style={f.erledigt ? { opacity: .55 } : undefined}>
            <span className="cgn-eintrag-text"><b>{f.titel}</b><small>{datum(f.faelligAm)} · {f.quelle === "regel" ? "automatisch" : "von Hand"}{f.hinweis ? ` · ${f.hinweis}` : ""}</small></span>
            <span className="cgn-eintrag-rechts">
              <button type="button" className="cgn-knopf klein" onClick={() => void tun(`/frist/${f.id}`, "POST", { erledigt: !f.erledigt })}>{f.erledigt ? "Wieder offen" : "Erledigt"}</button>
              {f.quelle !== "regel" && <button type="button" className="cgn-link leise" onClick={() => { if (window.confirm("Frist löschen?")) void tun(`/frist/${f.id}`, "DELETE"); }}>Löschen</button>}
            </span>
          </div>
        ))}
      </div>
      {!neu ? <button type="button" className="cgn-knopf klein" style={{ alignSelf: "flex-start" }} onClick={() => setNeu(true)}>Frist anlegen</button> : (
        <div className="cgn-form">
          <div className="cgn-felder">
            <label className="cgn-feld">Titel<input value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="z. B. Steuererklärung 2026 (Form 1120)" /></label>
            <label className="cgn-feld">Fällig am<input type="date" value={faellig} onChange={(e) => setFaellig(e.target.value)} /></label>
            <label className="cgn-feld breit">Hinweis (freiwillig)<input value={hinweis} onChange={(e) => setHinweis(e.target.value)} /></label>
          </div>
          <div className="cgn-reihe">
            <button type="button" className="cgn-knopf haupt klein" disabled={!titel || !faellig} onClick={async () => { if (await tun("/frist", "POST", { titel, faelligAm: faellig, hinweis })) { setTitel(""); setFaellig(""); setHinweis(""); setNeu(false); } }}>Anlegen</button>
            <button type="button" className="cgn-knopf klein" onClick={() => setNeu(false)}>Abbrechen</button>
          </div>
        </div>
      )}
    </>
  );
}

// ═══ VERLAUF ═════════════════════════════════════════════════════════════════
export function Verlauf({ m, tun }: { m: T; tun: Tun }) {
  const [text, setText] = useState("");
  const [sichtbar, setSichtbar] = useState(false);
  const [alle, setAlle] = useState(false);
  const zeilen = (m.intern?.verlaufAlles ?? []) as T[];
  const gezeigt = alle ? zeilen : zeilen.slice(0, 8);
  return (
    <>
      <div className="cgn-form">
        <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Notiz — intern, oder für den Kunden sichtbar" aria-label="Notiz" />
        <div className="cgn-reihe zwischen">
          <label className="cgn-haken"><input type="checkbox" checked={sichtbar} onChange={(e) => setSichtbar(e.target.checked)} /> Kunde sieht die Notiz</label>
          <button type="button" className="cgn-knopf klein haupt" disabled={text.trim().length < 2} onClick={async () => { if (await tun("/notiz", "POST", { text, sichtbar })) setText(""); }}>Notiz speichern</button>
        </div>
      </div>
      <div className="cgn-gruppe">
        {gezeigt.map((v, i) => (
          <div key={i} className="cgn-eintrag">
            <span className="cgn-eintrag-text"><b style={{ fontSize: 13.5 }}>{v.text}</b><small>{datumZeit(v.am)} · {v.von ?? "System"}</small></span>
            <span className="cgn-eintrag-rechts"><span className={`cgn-sicht${v.sichtbar ? " kunde" : ""}`}>{v.sichtbar ? "Kunde sieht" : "nur intern"}</span></span>
          </div>
        ))}
      </div>
      {zeilen.length > 8 && <button type="button" className="cgn-klein-schalter" onClick={() => setAlle((v) => !v)}>{alle ? "Weniger zeigen" : `Alle ${zeilen.length} Einträge zeigen`}</button>}
      <p className="cgn-satz">Zuletzt geändert {seit(zeilen[0]?.am)}.</p>
    </>
  );
}

// ═══ MEHR ════════════════════════════════════════════════════════════════════
const FACH_NAME: Record<string, string> = { strategie: "Strategie & Wachstum", recht: "Recht & Verträge", steuern: "Steuern & Pflichten", expose: "Bank-Exposé" };
export function Mehr({ m, tun, gref, kundenLink }: { m: T; tun: Tun; gref: string; kundenLink: string }) {
  const [stichtag, setStichtag] = useState(m.stichtag ?? "");
  const [stichtagMail, setStichtagMail] = useState(false);
  const [ki, setKi] = useState(false);
  const [kopiert, setKopiert] = useState(false);
  const name = [m.kontakt?.vorname, m.kontakt?.nachname].filter(Boolean).join(" ") || "diesen Kunden";
  return (
    <>
      <div className="cgn-gruppe" data-cgn="portal">
        <span className="cgn-auge">Kundenportal</span>
        <p className="cgn-satz">{m.portal?.neu ? <>Der Kunde sieht das <b>neue Portal</b> — freigeschaltet {datumZeit(m.portal.seit)}{m.portal.von ? ` von ${m.portal.von}` : ""}.</> : <>Der Kunde sieht noch das <b>bisherige Portal</b>. Erst „Kundenansicht“ prüfen, dann freischalten.</>}</p>
        <div className="cgn-reihe">
          <button type="button" className={`cgn-knopf klein${m.portal?.neu ? "" : " haupt"}`} onClick={() => {
            const an = !m.portal?.neu;
            if (an && !window.confirm(`Neues Portal für ${name} freischalten? Er sieht es ab seinem nächsten Besuch.`)) return;
            void tun("/portal", "POST", { an });
          }}>{m.portal?.neu ? "Wieder bisheriges Portal" : "Neues Portal freischalten"}</button>
          <button type="button" className="cgn-knopf klein" onClick={() => { if (window.confirm("Den Link zu „Mein Auftrag“ jetzt per Mail an den Kunden schicken?")) void tun("/zugang-senden", "POST"); }}>Link per Mail senden</button>
          <button type="button" className="cgn-knopf klein" onClick={async () => { try { await navigator.clipboard.writeText(kundenLink); setKopiert(true); window.setTimeout(() => setKopiert(false), 1800); } catch { /* egal */ } }}>{kopiert ? "Kopiert" : "Kunden-Link kopieren"}</button>
        </div>
      </div>
      <div className="cgn-gruppe">
        <span className="cgn-auge">Stichtag</span>
        <div className="cgn-reihe">
          <input type="date" value={stichtag} onChange={(e) => setStichtag(e.target.value)} aria-label="Stichtag" />
          <label className="cgn-haken"><input type="checkbox" checked={stichtagMail} onChange={(e) => setStichtagMail(e.target.checked)} /> Kunde per Mail informieren</label>
          <button type="button" className="cgn-knopf klein" disabled={!stichtag} onClick={() => void tun("/stichtag", "POST", { stichtag, mitteilen: stichtagMail })}>Stichtag setzen</button>
        </div>
      </div>
      <div className="cgn-gruppe">
        <span className="cgn-auge">Test-Akte</span>
        <div className="cgn-reihe">
          <p className="cgn-satz" style={{ flex: "1 1 240px" }}>{m.test ? "Als Test markiert — zählt in keiner Zahl." : "Echte Akte — zählt in allen Zahlen."}</p>
          <button type="button" className="cgn-knopf klein" onClick={() => void tun("/test", "POST", { an: !m.test })}>{m.test ? "Test-Markierung entfernen" : "Als Test markieren"}</button>
        </div>
      </div>
      <div className="cgn-gruppe">
        <span className="cgn-auge">KI-Antworten an den Kunden</span>
        {!ki ? <button type="button" className="cgn-klein-schalter" onClick={() => setKi(true)}>Gespräche mit der KI zeigen (Strategie · Recht · Steuern)</button> : <KiGespraeche gref={gref} />}
      </div>
      <div className="cgn-gruppe">
        <span className="cgn-auge">Alte Ansicht</span>
        <p className="cgn-satz"><a className="cgn-link" href={`/chef/global?mandat=${encodeURIComponent(gref)}`} data-cgn="alte-ansicht">Diese Akte im Raum „Global-Mandate“ öffnen</a> — dieselben Daten, die bisherigen Reiter.</p>
      </div>
    </>
  );
}

function KiGespraeche({ gref }: { gref: string }) {
  const { daten, laedt, fehler } = useDaten<{ ok: true; chats: { bereich: string; rolle: string; text: string; am: string; vorschau: boolean }[] }>(`/chef/global/mandate/${encodeURIComponent(gref)}/fach`);
  if (laedt) return <Geruest zeilen={3} />;
  if (fehler) return <Fehlermeldung text={fehler} />;
  const chats = daten?.chats ?? [];
  if (!chats.length) return <p className="cgn-leer">Noch keine Fragen an die KI.</p>;
  return (
    <div className="cgn-faden">
      {chats.map((c, i) => (
        <div key={i} className={`cgn-blase ${c.rolle === "kunde" ? "kunde" : "fiaon"}`}>
          {c.text}
          <small>{c.rolle === "kunde" ? "Kunde" : "KI"} · {FACH_NAME[c.bereich] ?? c.bereich} · {datumZeit(c.am)}{c.vorschau ? " · Vorschau (Chefbüro)" : ""}</small>
        </div>
      ))}
    </div>
  );
}
