// ═══════════════════════════════════════════════════════════════════════════
// DER WHATSAPP-RAUM (23.09.2026, E-210) — dieselbe Seite für Team und Leitung
//
// Justin: „eine Seite die aussieht wie WhatsApp nur eben in FIAON STIL … aber
// eben 100 % mitgedacht!"
//
// Was hier anders ist als in jedem Chat-Fenster:
// · Das 24-Stunden-Fenster steht sichtbar über dem Eingabefeld und sperrt es,
//   wenn es zu ist — stattdessen erscheinen die freigegebenen Vorlagen.
// · Je Gespräch ein Schalter „Mara antwortet hier". Schreibt ein Mensch,
//   schaltet der Server Mara in diesem Gespräch selbst ab.
// · Rechts steht der Mensch: Stufe, Paket, Betreuer, Akte, Telefon — man muss
//   die Seite nicht verlassen, um zu wissen, mit wem man spricht.
// · Vor jedem Senden prüft der Server Wortwand, Sie-Form und die
//   WhatsApp-Richtlinie (keine Mahnung, keine Forderung).
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "@/pages/agent/rundgaenge";
import "@/styles/office-rundgang.css";
import "@/styles/whatsapp-raum.css";

interface Gespraech {
  nummer: string; name: string | null; personId: number | null; leadId: number | null;
  stufe: string | null; betreuer: string | null;
  letzte: { text: string; richtung: string; am: string; status: string };
  ungelesen: number; maraAn: boolean; fensterBis: string | null;
  bearbeiter: { id: number; seit: string } | null; notiz: string | null;
}
interface Nachricht {
  id: number; richtung: string; text: string | null; vorlage: string | null; knopf: string | null;
  status: string; fehler: string | null; von: string | null;
  empfangen_am: string | null; gesendet_am: string | null; zugestellt_am: string | null; gelesen_am: string | null; created_at: string;
}
interface Vorlage { name: string; status: string; text?: string; zweck?: string; beispiele?: string[] }

const zeit = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "";
const tag = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "";

function restZeit(bis: string | null): string | null {
  if (!bis) return null;
  const ms = new Date(bis).getTime() - Date.now();
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  return h > 0 ? `noch ${h} h ${m} min` : `noch ${m} min`;
}

export default function WhatsAppRaum({ basis }: { basis: string }) {
  const API = `/api/fiaon${basis}`;
  const [liste, setListe] = useState<Gespraech[] | null>(null);
  const [kopf, setKopf] = useState<{ nummer: string | null; bereit: boolean; ich: number | null; alles: boolean } | null>(null);
  const [suche, setSuche] = useState("");
  const [filter, setFilter] = useState<"alle" | "ungelesen" | "offen">("alle");
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [chat, setChat] = useState<{ verlauf: Nachricht[]; lage: any; fensterOffen: boolean; maraAn: boolean; notiz: string | null; vorlagen: Vorlage[] } | null>(null);
  const [entwurf, setEntwurf] = useState("");
  const [sendet, setSendet] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [vorlageOffen, setVorlageOffen] = useState(false);
  const endeRef = useRef<HTMLDivElement>(null);

  const melden = (t: string) => { setMeldung(t); window.setTimeout(() => setMeldung(null), 8000); };

  const listeLaden = useCallback(async () => {
    try {
      const r = await fetch(`${API}/gespraeche?suche=${encodeURIComponent(suche)}&filter=${filter === "alle" ? "" : filter}`, { credentials: "include" });
      const j = await r.json();
      if (j?.ok) { setListe(j.gespraeche); setKopf({ nummer: j.nummer, bereit: j.bereit, ich: j.ich, alles: j.alles }); }
    } catch { /* stiller Fehlschlag, der nächste Takt holt es */ }
  }, [API, suche, filter]);

  const chatLaden = useCallback(async (nummer: string, leise = false) => {
    if (!leise) setChat(null);
    try {
      const r = await fetch(`${API}/gespraech/${encodeURIComponent(nummer)}`, { credentials: "include" });
      const j = await r.json();
      if (j?.ok) setChat({ verlauf: j.verlauf, lage: j.lage, fensterOffen: j.fensterOffen, maraAn: j.maraAn, notiz: j.notiz, vorlagen: j.vorlagen });
      else melden(j?.error || "Das Gespräch ließ sich nicht laden.");
    } catch { melden("Keine Verbindung."); }
  }, [API]);

  useEffect(() => { void listeLaden(); }, [listeLaden]);
  useEffect(() => {
    const id = window.setInterval(() => { void listeLaden(); if (gewaehlt) void chatLaden(gewaehlt, true); }, 8000);
    return () => window.clearInterval(id);
  }, [listeLaden, chatLaden, gewaehlt]);
  useEffect(() => { if (gewaehlt) void chatLaden(gewaehlt); }, [gewaehlt, chatLaden]);
  useEffect(() => { endeRef.current?.scrollIntoView({ block: "end" }); }, [chat?.verlauf.length, gewaehlt]);

  const aktuell = useMemo(() => liste?.find((g) => g.nummer === gewaehlt) ?? null, [liste, gewaehlt]);
  const rest = restZeit(aktuell?.fensterBis ?? null);

  const senden = async (inhalt: { text?: string; vorlage?: string; werte?: string[] }) => {
    if (!gewaehlt) return;
    setSendet(true);
    try {
      const r = await fetch(`${API}/senden`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nummer: gewaehlt, ...inhalt }),
      });
      const j = await r.json();
      if (!j?.ok) { melden(j?.error || "Das ging nicht raus."); return; }
      setEntwurf(""); setVorlageOffen(false);
      await chatLaden(gewaehlt, true); await listeLaden();
    } catch { melden("Keine Verbindung."); } finally { setSendet(false); }
  };

  const maraSchalten = async (an: boolean) => {
    if (!gewaehlt) return;
    try {
      await fetch(`${API}/mara`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nummer: gewaehlt, an }) });
      melden(an ? "Mara antwortet hier wieder." : "Mara hält sich hier heraus.");
      await chatLaden(gewaehlt, true); await listeLaden();
    } catch { melden("Der Schalter ging nicht."); }
  };

  return (
    <div className={`wr${gewaehlt ? " wr-chat-offen" : ""}`}>
      <Rundgang raum="whatsapp" titel={RUNDGAENGE.whatsapp.titel} schritte={RUNDGAENGE.whatsapp.schritte} />
      <header className="wr-kopf">
        <div>
          <h1>WhatsApp</h1>
          <p className="wr-still">
            {kopf?.bereit
              ? <>Unsere Nummer: <b>{kopf?.nummer ?? "—"}</b> · {kopf?.alles ? "Du siehst alle Gespräche." : "Du siehst die Gespräche deiner Kunden."}</>
              : "Noch nicht eingerichtet — die Zugangswerte fehlen."}
          </p>
        </div>
      </header>

      <div className="wr-raum">
        {/* ── Liste ─────────────────────────────────────────────── */}
        <aside className="wr-liste" aria-label="Gespräche">
          <div className="wr-suchfeld">
            <input value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="Name, Nummer oder Text suchen" aria-label="Suchen" />
          </div>
          <div className="wr-filter">
            {([["alle", "Alle"], ["ungelesen", "Ungelesen"], ["offen", "Fenster offen"]] as const).map(([k, t]) => (
              <button key={k} type="button" className={filter === k ? "an" : ""} onClick={() => setFilter(k)}>{t}</button>
            ))}
          </div>
          <div className="wr-zeilen">
            {!liste ? <p className="wr-leer">Lädt …</p>
              : liste.length === 0 ? <p className="wr-leer">Noch kein Gespräch. Sobald jemand schreibt oder Mara jemanden anschreibt, steht es hier.</p>
                : liste.map((g) => (
                  <button key={g.nummer} type="button" className={`wr-zeile${g.nummer === gewaehlt ? " an" : ""}${g.ungelesen ? " neu" : ""}`} onClick={() => setGewaehlt(g.nummer)}>
                    <span className="wr-avatar" aria-hidden="true">{(g.name ?? "?").slice(0, 1).toUpperCase()}</span>
                    <span className="wr-zeile-text">
                      <span className="wr-zeile-kopf">
                        <b>{g.name ?? g.nummer}</b>
                        <span className="wr-still">{zeit(g.letzte.am)}</span>
                      </span>
                      <span className="wr-zeile-unten">
                        <span className="wr-vorschau">{g.letzte.richtung === "raus" ? "Du: " : ""}{g.letzte.text || "—"}</span>
                        {g.ungelesen > 0 && <span className="wr-punkt">{g.ungelesen}</span>}
                      </span>
                      <span className="wr-marken">
                        {g.stufe && <span className={`wr-marke stufe-${g.stufe}`}>{g.stufe}</span>}
                        {g.fensterBis && <span className="wr-marke offen">Fenster offen</span>}
                        {g.maraAn && <span className="wr-marke mara">Mara</span>}
                        {g.bearbeiter && kopf?.ich !== g.bearbeiter.id && <span className="wr-marke warn">jemand liest mit</span>}
                      </span>
                    </span>
                  </button>
                ))}
          </div>
        </aside>

        {/* ── Verlauf ───────────────────────────────────────────── */}
        <section className="wr-chat" aria-label="Verlauf">
          {!gewaehlt ? (
            <div className="wr-nichts">
              <p>Links ein Gespräch wählen.</p>
              <p className="wr-still">Frei schreiben darfst du, solange der Mensch in den letzten 24 Stunden geschrieben hat. Danach nur noch mit einer freigegebenen Vorlage — der Raum sagt dir, was gerade gilt.</p>
            </div>
          ) : (
            <>
              <div className="wr-chat-kopf">
                <button type="button" className="wr-zurueck" onClick={() => setGewaehlt(null)} aria-label="Zurück zur Liste">‹</button>
                <div className="wr-chat-wer">
                  <b>{aktuell?.name ?? gewaehlt}</b>
                  <span className="wr-still">
                    +{gewaehlt}
                    {chat?.lage?.betreuer ? ` · Betreuer: ${chat.lage.betreuer}` : ""}
                    {rest ? ` · Fenster ${rest}` : " · Fenster zu"}
                  </span>
                </div>
                <div className="wr-chat-knoepfe">
                  <button type="button" className={`wr-schalter${chat?.maraAn ? " an" : ""}`} onClick={() => void maraSchalten(!chat?.maraAn)} aria-pressed={!!chat?.maraAn}>
                    <span aria-hidden="true" />Mara
                  </button>
                  {chat?.lage?.id && !chat.lage.istLead && <a className="wr-klein" href={`/chef/s/akte?id=${chat.lage.id}`} target="_blank" rel="noreferrer">Akte</a>}
                </div>
              </div>

              <div className="wr-verlauf">
                {!chat ? <p className="wr-leer">Lädt …</p> : chat.verlauf.length === 0 ? <p className="wr-leer">Noch keine Nachricht.</p> : chat.verlauf.map((n, i) => {
                  const vorher = chat.verlauf[i - 1];
                  const amTag = tag(n.empfangen_am ?? n.gesendet_am ?? n.created_at);
                  const neuerTag = !vorher || tag(vorher.empfangen_am ?? vorher.gesendet_am ?? vorher.created_at) !== amTag;
                  return (
                    <div key={n.id}>
                      {neuerTag && <div className="wr-tag">{amTag}</div>}
                      <div className={`wr-blase ${n.richtung === "rein" ? "rein" : "raus"}${n.status === "fehler" ? " fehler" : ""}`}>
                        {n.vorlage && <span className="wr-vorlagenmarke">Vorlage · {n.vorlage}</span>}
                        <p>{n.text || (n.vorlage ? "(Vorlagentext)" : "—")}</p>
                        <span className="wr-blase-fuss">
                          {n.von && n.richtung === "raus" ? `${n.von} · ` : ""}
                          {zeit(n.empfangen_am ?? n.gesendet_am ?? n.created_at)}
                          {n.richtung === "raus" && (
                            <span className="wr-haken" title={n.gelesen_am ? "gelesen" : n.zugestellt_am ? "zugestellt" : "gesendet"}>
                              {n.status === "fehler" ? " ✕" : n.gelesen_am ? " ✓✓" : n.zugestellt_am ? " ✓✓" : " ✓"}
                            </span>
                          )}
                        </span>
                        {n.status === "fehler" && n.fehler && <span className="wr-fehlertext">{n.fehler}</span>}
                      </div>
                    </div>
                  );
                })}
                <div ref={endeRef} />
              </div>

              {/* ── Eingabe ─────────────────────────────────────── */}
              <div className="wr-eingabe">
                {chat?.fensterOffen ? (
                  <>
                    <textarea
                      value={entwurf}
                      onChange={(e) => setEntwurf(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && entwurf.trim()) void senden({ text: entwurf.trim() }); }}
                      placeholder="Nachricht schreiben … (⌘ + Enter sendet)"
                      rows={2}
                      aria-label="Nachricht"
                    />
                    <button type="button" className="wr-senden" disabled={sendet || !entwurf.trim()} onClick={() => void senden({ text: entwurf.trim() })}>
                      {sendet ? "Sendet …" : "Senden"}
                    </button>
                  </>
                ) : (
                  <div className="wr-zu">
                    <p>
                      <b>Das 24-Stunden-Fenster ist zu.</b> Jetzt geht nur eine von Meta freigegebene Vorlage.
                      Antwortet der Mensch darauf, kannst du wieder frei schreiben.
                    </p>
                    <button type="button" className="wr-knopf" onClick={() => setVorlageOffen(!vorlageOffen)}>
                      {vorlageOffen ? "Vorlagen schließen" : `Vorlage wählen${chat?.vorlagen.length ? ` (${chat.vorlagen.length})` : ""}`}
                    </button>
                  </div>
                )}
              </div>

              {vorlageOffen && (
                <div className="wr-vorlagen">
                  {chat?.vorlagen.length ? chat.vorlagen.map((v) => (
                    <div key={v.name} className="wr-vorlage">
                      <div className="wr-vorlage-kopf"><b>{v.name.replace(/^fiaon_/, "").replace(/_/g, " ")}</b><span className="wr-still">{v.zweck ?? ""}</span></div>
                      <p>{(v.text ?? "").replace("{{1}}", aktuell?.name ?? "Maria Muster")}</p>
                      <button type="button" className="wr-knopf voll" disabled={sendet}
                        onClick={() => void senden({ vorlage: v.name, werte: [aktuell?.name ?? "und willkommen"] })}>
                        Diese Vorlage senden
                      </button>
                    </div>
                  )) : <p className="wr-leer">Noch keine Vorlage freigegeben — Meta prüft sie gerade.</p>}
                </div>
              )}
            </>
          )}
        </section>

        {/* ── Der Mensch ────────────────────────────────────────── */}
        {gewaehlt && chat?.lage && (
          <aside className="wr-person" aria-label="Der Mensch">
            <h2>{chat.lage.name || aktuell?.name || "Unbekannt"}</h2>
            <dl>
              {chat.lage.stufe && <><dt>Stufe</dt><dd>{chat.lage.stufe}</dd></>}
              {chat.lage.paket && <><dt>Paket</dt><dd>{chat.lage.paket}</dd></>}
              {chat.lage.ref && <><dt>Antrag</dt><dd>{chat.lage.ref}</dd></>}
              {chat.lage.betreuer && <><dt>Betreuer</dt><dd>{chat.lage.betreuer}</dd></>}
              {chat.lage.email && <><dt>E-Mail</dt><dd>{chat.lage.email}</dd></>}
            </dl>
            {chat.lage.anzeige && <p className="wr-still">Kam über: {chat.lage.anzeige}</p>}
            <div className="wr-person-knoepfe">
              {!chat.lage.istLead && <a className="wr-knopf" href={`/chef/s/akte?id=${chat.lage.id}`} target="_blank" rel="noreferrer">Akte öffnen</a>}
              {chat.lage.phone && <a className="wr-knopf" href={`tel:${chat.lage.phone}`}>Anrufen</a>}
            </div>
            <p className="wr-still wr-hinweis">
              Mahnungen, Forderungen und Ratenrückstände gehen nie über WhatsApp — das verbietet Meta und kostet im
              Ernstfall unsere Nummer. Dafür bleiben Mail, Telefon und Brief.
            </p>
          </aside>
        )}
      </div>

      {meldung && <div className="wr-meldung" role="status">{meldung}</div>}
    </div>
  );
}
