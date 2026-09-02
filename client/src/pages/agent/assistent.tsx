// ═══════════════════════════════════════════════════════════════════════════
// /agent/assistent — der FIAON Copilot (30.08.2026)
//
// Justin: „Ein KI-Assistent für Mitarbeiter und Admin, der auf Zuruf echte
// Aufgaben im System ERLEDIGT — nicht nur beantwortet. WOW ist Pflicht."
//
// ── WAS DIESE SEITE IST ────────────────────────────────────────────────────
// Ein Command-Deck auf der dunklen Navy-Bühne: EIN zentrales Eingabefeld,
// dahinter eine 3D-Szene (AssistentSzene.tsx), die auf die Zustände des
// Assistenten reagiert. Antworten streamen live; Werkzeug-Aufrufe erscheinen
// als Aktionskarten. Alles mit Folgen (Mail, Termin, Bestellung, Sperre,
// Einmal-Passwort) wartet als Bestätigungskarte auf den KLICK DES MENSCHEN —
// mit echter Mail-Vorschau, wo es eine gibt.
//
// ── ZWEI TÜREN, EINE SEITE ─────────────────────────────────────────────────
// `alsAdmin` schaltet auf die Chef-Endpunkte um (Muster: space.tsx). Die
// Mitarbeiter-Fassung läuft in der AgentShell, die Chef-Fassung nackt in der
// ChefShell. Der Rundgang gehört nur zur Mitarbeiter-Fassung — der Chef hat
// keine Agent-Anmeldung, und der Rundgang-Endpunkt verlangt eine.
//
// ── DIE BÜHNE, NEU (02.09.2026) ────────────────────────────────────────────
// Justin: „viel hochwertiger, cleaner, cinematisch, Matrix, kein weißer Rand."
// VORHER lag das Deck in der hellen Office-Fläche (.of-flaeche) — ein weißer
// Tablet-Rahmen um eine dunkle Bühne. NACHHER schaltet die Seite die Fläche
// über useOffice().dunkel(true) ab (derselbe Weg wie Team, Feed, Bestand) und
// füllt die Spalte von Kante zu Kante. Die Szene ist kein Ring mehr, sondern
// der Partikel-Humanoid (AssistentSzene.tsx, Prototyp von Justin freigegeben).
// Die Sitzungsleiste ist auf dem Rechner einklappbar — die Bühne gehört dem
// Wesen, nicht der Liste.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import { AgentShell } from "./shared";
import { useOffice } from "./OfficeShell";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "./rundgaenge";
import AssistentSzene, { type SzenenZustand } from "@/components/agent/AssistentSzene";
import "@/styles/office-assistent.css";

// ── Formen ───────────────────────────────────────────────────────────────────
interface Sitzung { id: number; titel: string; person_id: number | null }
interface Karte {
  typ: "werkzeug" | "bestaetigung";
  id: string;
  titel: string;
  status: string; // geplant | laeuft | erledigt | fehlgeschlagen | offen | verworfen | abgelaufen | ausgefuehrt
  zusammenfassung?: string;
  warnung?: string | null;
  fehler?: string | null;
  ergebnis?: any;
  hatVorschau?: boolean;
}
interface Nachricht { schluessel: string; rolle: "nutzer" | "assistent"; inhalt: string; karten: Karte[] }
interface WerkzeugInfo { name: string; titel: string; stufe: string; beschreibung: string }
interface Treffer { personId: number; name: string | null; email: string | null; telefon: string | null }

// Die sechs Vorschläge aus dem echten Alltag — Platzhalter tippt der Mensch.
// Nur, was der Copilot HEUTE kann: seit Scheibe 2 (02.09.2026) auch der
// Tagesbrief, die Fristen, die Anrufvorbereitung und das Nachschlagen (Scheibe 6).
const VORSCHLAEGE: Array<{ tag: string; text: string }> = [
  { tag: "Tagesbrief", text: "Was steht heute an — und womit fange ich an?" },
  { tag: "Anruf", text: "Bereite den Anruf mit … vor: Lage, Leitfaden, erste zwei Sätze." },
  { tag: "Fristen", text: "Was ist überfällig oder läuft in den nächsten drei Tagen ab?" },
  { tag: "Akte", text: "Was ist bei … los? Lage, Zahlungen, nächster Schritt." },
  { tag: "Zahlung", text: "Sende die Zahlungsdaten an … — mit Vorschau, ich bestätige." },
  { tag: "Wissen", text: "Wie lange bleibt eine erledigte Forderung in der SCHUFA — und was sagt der neue Score dazu?" },
];

/** Schaltet die helle Office-Fläche für diese Seite ab — muss INNERHALB der
 *  AgentShell stehen, weil useOffice den Kontext der OfficeShell liest. */
function DunkleBuehne() {
  const { dunkel, titel } = useOffice();
  useEffect(() => { dunkel(true); titel("Copilot"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

let schluesselZaehler = 0;
const neuerSchluessel = () => `n${Date.now()}_${schluesselZaehler += 1}`;

export default function AgentAssistentPage({ alsAdmin = false }: { alsAdmin?: boolean } = {}) {
  const basis = alsAdmin ? "/api/fiaon/chef/assistent" : "/api/fiaon/agent/assistent";

  // ── Alle Haken stehen HIER OBEN, vor jedem return (AGENTS.md-Wand). ──────
  const [sitzungen, setSitzungen] = useState<Sitzung[]>([]);
  const [aktiv, setAktiv] = useState<number | null>(null);
  const [nachrichten, setNachrichten] = useState<Nachricht[]>([]);
  const [eingabe, setEingabe] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [zustand, setZustand] = useState<SzenenZustand>("idle");
  const [fehler, setFehler] = useState<string | null>(null);
  const [name, setName] = useState<string>("");
  const [werkzeuge, setWerkzeuge] = useState<WerkzeugInfo[]>([]);
  const [hatAgentZugang, setHatAgentZugang] = useState(true);
  const [kontext, setKontext] = useState<{ personId: number; zeile: string } | null>(null);
  const [suchtext, setSuchtext] = useState("");
  const [treffer, setTreffer] = useState<Treffer[] | null>(null);
  // Rechner: Leiste offen, bis man sie einklappt. Handy: Schublade, zu bis man sie öffnet.
  const [leisteOffen, setLeisteOffen] = useState<boolean>(() => typeof window !== "undefined" && window.innerWidth > 760);
  const [umbenennen, setUmbenennen] = useState<{ id: number; wert: string } | null>(null);
  const [beschaeftigt, setBeschaeftigt] = useState<string | null>(null);
  const stromRef = useRef<HTMLDivElement | null>(null);
  const eingabeRef = useRef<HTMLTextAreaElement | null>(null);
  const ruheTimer = useRef<number | null>(null);
  const suchTimer = useRef<number | null>(null);

  const anfrage = async (pfad: string, init?: RequestInit): Promise<{ ok: boolean; status: number; json: any }> => {
    const r = await fetch(`${basis}${pfad}`, {
      credentials: "include",
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
      ...init,
    }).catch(() => null);
    if (!r) return { ok: false, status: 0, json: null };
    const j = await r.json().catch(() => null);
    return { ok: r.ok && j?.ok !== false, status: r.status, json: j };
  };

  const sitzungenLaden = async () => {
    const r = await anfrage("/sitzungen");
    if (r.ok) setSitzungen(r.json.sitzungen || []);
  };

  useEffect(() => {
    sitzungenLaden();
    anfrage("/werkzeuge").then((r) => {
      if (r.ok) {
        setWerkzeuge(r.json.werkzeuge || []);
        setHatAgentZugang(r.json.hatAgentZugang !== false);
        setName(String(r.json.name || ""));
      } else if (r.status === 401 || r.status === 403) {
        setFehler("Keine Berechtigung für den Copilot — bitte neu anmelden.");
      }
    });
    return () => {
      if (ruheTimer.current) window.clearTimeout(ruheTimer.current);
      if (suchTimer.current) window.clearTimeout(suchTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basis]);

  // Immer ans Ende des Stroms — wer liest, liest unten.
  useEffect(() => {
    const el = stromRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [nachrichten, laeuft]);

  // Kundensuche fürs Anheften — mit kurzer Atempause statt je Tastendruck.
  useEffect(() => {
    if (suchTimer.current) window.clearTimeout(suchTimer.current);
    const q = suchtext.trim();
    if (q.length < 2) { setTreffer(null); return; }
    suchTimer.current = window.setTimeout(async () => {
      const r = await anfrage(`/kunden-suche?q=${encodeURIComponent(q)}`);
      setTreffer(r.ok ? (r.json.kunden || []) : []);
    }, 280);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suchtext]);

  const zustandSetzen = (wert: SzenenZustand) => {
    setZustand(wert);
    if (ruheTimer.current) window.clearTimeout(ruheTimer.current);
    if (wert === "fertig" || wert === "fehler") {
      ruheTimer.current = window.setTimeout(() => setZustand("idle"), 2400);
    }
  };

  const karteAktualisieren = (karte: Karte) => {
    setNachrichten((alt) => {
      const neu = alt.slice();
      const letzte = neu[neu.length - 1];
      if (!letzte || letzte.rolle !== "assistent") return alt;
      const karten = letzte.karten.slice();
      const i = karten.findIndex((k) => k.id === karte.id);
      // Ein leerer Titel im Nachtrag (bestaetigen/verwerfen) darf den echten
      // Titel nicht überschreiben — sonst steht auf der Karte nur „Aktion".
      if (i >= 0) karten[i] = { ...karten[i], ...karte, titel: karte.titel || karten[i].titel };
      else karten.push(karte);
      neu[neu.length - 1] = { ...letzte, karten };
      return neu;
    });
  };

  const sitzungOeffnen = async (id: number) => {
    setAktiv(id);
    setLeisteOffen(false);
    setFehler(null);
    const r = await anfrage(`/sitzungen/${id}`);
    if (!r.ok) { setFehler(r.json?.error || "Die Sitzung ließ sich nicht laden."); return; }
    const offene = new Set<string>((r.json.offeneVorbereitungen || []).map((v: any) => String(v.id)));
    const geladen: Nachricht[] = (r.json.nachrichten || [])
      .map((n: any) => {
        const karten: Karte[] = Array.isArray(n.karten) ? n.karten : (n.karten ? JSON.parse(String(n.karten)) : []) || [];
        return {
          schluessel: `db${n.id}`,
          rolle: n.rolle === "nutzer" ? "nutzer" as const : "assistent" as const,
          inhalt: String(n.inhalt || ""),
          karten: karten.map((k) => (
            k.typ === "bestaetigung" && k.status === "offen" && !offene.has(String(k.id))
              ? { ...k, status: "abgelaufen" }
              : k
          )),
        };
      })
      .filter((n: Nachricht) => n.inhalt || n.karten.length);
    setNachrichten(geladen);
    const s = r.json.sitzung;
    if (s?.person_id) {
      setKontext((alt) => (alt && alt.personId === Number(s.person_id) ? alt : { personId: Number(s.person_id), zeile: `Akte ${s.person_id} angeheftet` }));
    } else {
      setKontext(null);
    }
  };

  const neueSitzung = () => {
    setAktiv(null);
    setNachrichten([]);
    setKontext(null);
    setFehler(null);
    setLeisteOffen(false);
    eingabeRef.current?.focus();
  };

  // ── Das Herz: den Auftrag senden und den Strom lesen ─────────────────────
  const senden = async (text?: string) => {
    const auftrag = (text ?? eingabe).trim();
    if (!auftrag || laeuft) return;
    setEingabe("");
    setFehler(null);
    setLaeuft(true);
    zustandSetzen("denkt");
    setNachrichten((alt) => [
      ...alt,
      { schluessel: neuerSchluessel(), rolle: "nutzer", inhalt: auftrag, karten: [] },
      { schluessel: neuerSchluessel(), rolle: "assistent", inhalt: "", karten: [] },
    ]);

    try {
      const r = await fetch(`${basis}/chat`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sitzungId: aktiv, text: auftrag }),
      });
      if (!r.ok || !r.body) {
        const j = await r.json().catch(() => null);
        throw new Error(j?.error || `Der Copilot ist nicht erreichbar (HTTP ${r.status}).`);
      }
      const leser = r.body.getReader();
      const dekodierer = new TextDecoder();
      let puffer = "";

      const ereignis = (roh: string) => {
        const zeile = roh.trim();
        if (!zeile.startsWith("data:")) return;
        let e: any = null;
        try { e = JSON.parse(zeile.slice(5).trim()); } catch { return; }
        if (!e || typeof e !== "object") return;
        if (e.art === "sitzung") {
          setAktiv(Number(e.sitzungId));
        } else if (e.art === "text" && typeof e.delta === "string") {
          setNachrichten((alt) => {
            const neu = alt.slice();
            const letzte = neu[neu.length - 1];
            if (!letzte || letzte.rolle !== "assistent") return alt;
            neu[neu.length - 1] = { ...letzte, inhalt: letzte.inhalt + e.delta };
            return neu;
          });
        } else if (e.art === "zustand") {
          zustandSetzen(String(e.wert) as SzenenZustand);
        } else if (e.art === "werkzeug") {
          karteAktualisieren({
            typ: "werkzeug", id: String(e.id), titel: String(e.titel || e.name || "Werkzeug"),
            status: String(e.status || "laeuft"), fehler: e.fehler || null, ergebnis: e.ergebnis,
          });
        } else if (e.art === "bestaetigung") {
          karteAktualisieren({
            typ: "bestaetigung", id: String(e.id), titel: String(e.titel || "Aktion"),
            status: "offen", zusammenfassung: String(e.zusammenfassung || ""),
            warnung: e.warnung || null, hatVorschau: !!e.hatVorschau,
          });
        } else if (e.art === "fehler") {
          setFehler(String(e.text || "Unbekannter Fehler"));
          zustandSetzen("fehler");
        }
      };

      let fertig = false;
      while (!fertig) {
        const { done, value } = await leser.read();
        if (done) break;
        puffer += dekodierer.decode(value, { stream: true });
        let umbruch = puffer.indexOf("\n");
        while (umbruch >= 0) {
          ereignis(puffer.slice(0, umbruch));
          puffer = puffer.slice(umbruch + 1);
          umbruch = puffer.indexOf("\n");
        }
      }
      if (puffer) ereignis(puffer);
      fertig = true;
      sitzungenLaden();
    } catch (err: any) {
      setFehler(String(err?.message || "Der Copilot ist gerade nicht erreichbar."));
      zustandSetzen("fehler");
    } finally {
      setLaeuft(false);
      setZustand((z) => (z === "denkt" || z === "fuehrt_aus" ? "fertig" : z));
    }
  };

  // ── Bestätigen und Verwerfen — der Mensch entscheidet ────────────────────
  const bestaetigen = async (id: string) => {
    setBeschaeftigt(id);
    zustandSetzen("fuehrt_aus");
    const r = await anfrage(`/bestaetigen/${id}`, { method: "POST" });
    setBeschaeftigt(null);
    if (r.ok) {
      karteAktualisieren({ typ: "bestaetigung", id, titel: "", status: "erledigt", ergebnis: r.json?.ergebnis } as Karte);
      zustandSetzen("fertig");
    } else {
      karteAktualisieren({ typ: "bestaetigung", id, titel: "", status: "fehlgeschlagen", fehler: r.json?.error || "Ausführung fehlgeschlagen." } as Karte);
      zustandSetzen("fehler");
    }
  };

  const verwerfen = async (id: string) => {
    setBeschaeftigt(id);
    const r = await anfrage(`/verwerfen/${id}`, { method: "POST" });
    setBeschaeftigt(null);
    if (r.ok) karteAktualisieren({ typ: "bestaetigung", id, titel: "", status: "verworfen" } as Karte);
  };

  // ── Akte anheften ─────────────────────────────────────────────────────────
  const anheften = async (t: Treffer) => {
    setSuchtext("");
    setTreffer(null);
    let sitzungId = aktiv;
    if (!sitzungId) {
      const neu = await anfrage("/sitzungen", { method: "POST" });
      if (!neu.ok) { setFehler(neu.json?.error || "Sitzung ließ sich nicht anlegen."); return; }
      sitzungId = Number(neu.json.sitzung.id);
      setAktiv(sitzungId);
      sitzungenLaden();
    }
    const r = await anfrage(`/sitzungen/${sitzungId}/kontext`, { method: "POST", body: JSON.stringify({ personId: t.personId }) });
    if (r.ok) setKontext({ personId: t.personId, zeile: r.json.kontext?.zeile || `${t.name || "Akte"} angeheftet` });
    else setFehler(r.json?.error || "Die Akte ließ sich nicht anheften.");
  };

  const abheften = async () => {
    if (!aktiv) { setKontext(null); return; }
    const r = await anfrage(`/sitzungen/${aktiv}/kontext`, { method: "POST", body: JSON.stringify({ personId: null }) });
    if (r.ok) setKontext(null);
  };

  // ── Sitzungen pflegen ─────────────────────────────────────────────────────
  const umbenennenSpeichern = async () => {
    if (!umbenennen) return;
    const titel = umbenennen.wert.trim();
    if (titel) {
      await anfrage(`/sitzungen/${umbenennen.id}/umbenennen`, { method: "POST", body: JSON.stringify({ titel }) });
      sitzungenLaden();
    }
    setUmbenennen(null);
  };

  const archivieren = async (id: number) => {
    if (!window.confirm("Diese Sitzung aus der Liste nehmen? Der Verlauf bleibt gespeichert.")) return;
    await anfrage(`/sitzungen/${id}/archivieren`, { method: "POST" });
    if (aktiv === id) neueSitzung();
    sitzungenLaden();
  };

  const vorname = name ? name.split(" ")[0] : "";
  const leer = nachrichten.length === 0;

  const inhalt = (
    <div className="asx-buehne" data-fiaon="assistent">
      <AssistentSzene zustand={zustand} />
      <div className="asx-schleier" />

      {/* ── Linke Leiste: die letzten Sitzungen ── */}
      <aside className={`asx-leiste${leisteOffen ? " offen" : " zu"}`} data-fiaon="assistent-sitzungen">
        <div className="asx-leiste-kopf">
          <b>Sitzungen</b>
          <button type="button" className="asx-mini" onClick={neueSitzung} title="Neue Sitzung" aria-label="Neue Sitzung">
            <ZeichenPlus />
          </button>
        </div>
        {sitzungen.length === 0 && <span style={{ fontSize: 12.5, color: "rgba(196,216,246,.5)", padding: "4px 8px" }}>Noch keine Sitzungen.</span>}
        {sitzungen.map((s) => (
          <div key={s.id} className={`asx-sitzung${aktiv === s.id ? " an" : ""}`} role="button" tabIndex={0}
               onClick={() => sitzungOeffnen(s.id)}
               onKeyDown={(e) => { if (e.key === "Enter") sitzungOeffnen(s.id); }}>
            {umbenennen?.id === s.id ? (
              <input
                autoFocus value={umbenennen.wert}
                onChange={(e) => setUmbenennen({ id: s.id, wert: e.target.value })}
                onBlur={umbenennenSpeichern}
                onKeyDown={(e) => { if (e.key === "Enter") umbenennenSpeichern(); if (e.key === "Escape") setUmbenennen(null); }}
                onClick={(e) => e.stopPropagation()}
                style={{ flex: 1, minWidth: 0, background: "rgba(7,17,41,.8)", border: "1px solid rgba(96,165,250,.4)", borderRadius: 8, color: "#fff", fontSize: 12.5, padding: "4px 8px" }}
              />
            ) : (
              <span className="titel">{s.titel}</span>
            )}
            <span className="werkzeuge">
              <button type="button" className="asx-mini" title="Umbenennen" aria-label={`Sitzung ${s.titel} umbenennen`}
                      onClick={(e) => { e.stopPropagation(); setUmbenennen({ id: s.id, wert: s.titel }); }}>
                <ZeichenStift />
              </button>
              <button type="button" className="asx-mini" title="Archivieren" aria-label={`Sitzung ${s.titel} archivieren`}
                      onClick={(e) => { e.stopPropagation(); archivieren(s.id); }}>
                <ZeichenArchiv />
              </button>
            </span>
          </div>
        ))}
      </aside>

      {/* ── Die Mitte ── */}
      <div className="asx-mitte">
        <header className="asx-kopf">
          <button type="button" className="asx-mini" style={{ display: "inline-flex" }} onClick={() => setLeisteOffen(!leisteOffen)}
                  title="Sitzungen" aria-label="Sitzungen ein- oder ausblenden">
            <ZeichenLeiste />
          </button>
          <h1>FIAON Copilot</h1>
          <div className="frei">
            {kontext ? (
              <span className="asx-chip" data-fiaon="assistent-kontext">
                <ZeichenNadel />
                <span style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{kontext.zeile}</span>
                <button type="button" onClick={abheften} aria-label="Akte abheften" title="Akte abheften"><ZeichenKreuz /></button>
              </span>
            ) : hatAgentZugang ? (
              <span className="asx-suche">
                <input
                  value={suchtext}
                  onChange={(e) => setSuchtext(e.target.value)}
                  placeholder="Akte anheften: Name, E-Mail, Nummer …"
                  aria-label="Akte anheften"
                  data-fiaon="assistent-anheften"
                />
                {treffer !== null && (
                  <span className="asx-treffer">
                    {treffer.length === 0 && <span className="leer">Keine Treffer.</span>}
                    {treffer.map((t) => (
                      <button key={t.personId} type="button" onClick={() => anheften(t)}>
                        <b>{t.name || `Kunde ${t.personId}`}</b>
                        <span style={{ display: "block", opacity: .65 }}>{[t.email, t.telefon].filter(Boolean).join(" · ")}</span>
                      </button>
                    ))}
                  </span>
                )}
              </span>
            ) : null}
          </div>
        </header>

        {!hatAgentZugang && (
          <div className="asx-fehlerband" data-fiaon="assistent-hinweis">
            Dein Chef-Zugang trägt keine Mitarbeiter-Kennung (alter Admin-Code). Kundenbezogene Werkzeuge sind
            deshalb aus — verfügbar bleibt das Mailwerk. Für alles andere bitte über die Team-Anmeldung ins Chefbüro.
          </div>
        )}
        {fehler && <div className="asx-fehlerband" role="alert" data-fiaon="assistent-fehler">{fehler}</div>}

        {leer ? (
          <div className="asx-deck" data-fiaon="assistent-deck">
            <span className="gruss">{vorname ? `Bereit, ${vorname}.` : "Bereit."}</span>
            <h2>Was soll ich <span className="verlauf">erledigen?</span></h2>
            <p className="satz">
              Ich schreibe dir den Tagesbrief, wache über Fristen, bereite Anrufe mit dem passenden Leitfaden
              vor, lese Akten, schreibe Notizen — und alles mit Folgen wartet auf deinen Klick.
            </p>
            <div className="asx-vorschlaege">
              {VORSCHLAEGE.map((v) => (
                <button key={v.tag} type="button" className="asx-vorschlag"
                        onClick={() => { setEingabe(v.text); eingabeRef.current?.focus(); }}>
                  <b>{v.tag}</b>
                  {v.text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="asx-strom" ref={stromRef} data-fiaon="assistent-strom">
            {nachrichten.map((n, i) => (
              <div key={n.schluessel}>
                {(n.inhalt || n.rolle === "nutzer" || (laeuft && i === nachrichten.length - 1)) && (
                  <div className={`asx-nachricht ${n.rolle}`}>
                    <div className="asx-blase">
                      {n.inhalt}
                      {laeuft && i === nachrichten.length - 1 && n.rolle === "assistent" && <span className="asx-tippt" />}
                    </div>
                  </div>
                )}
                {n.karten.map((k) => (
                  <AktionsKarte
                    key={k.id} karte={k} basis={basis}
                    beschaeftigt={beschaeftigt === k.id}
                    onBestaetigen={() => bestaetigen(k.id)}
                    onVerwerfen={() => verwerfen(k.id)}
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        <div className="asx-eingabe">
          <div className="asx-feld">
            <textarea
              ref={eingabeRef}
              value={eingabe}
              rows={1}
              placeholder="Was soll ich erledigen?"
              aria-label="Auftrag an den Copilot"
              data-fiaon="assistent-eingabe"
              onChange={(e) => setEingabe(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); senden(); }
              }}
              disabled={laeuft}
            />
            <button type="button" className="asx-senden" onClick={() => senden()} disabled={laeuft || !eingabe.trim()}
                    aria-label="Auftrag senden" data-fiaon="assistent-senden">
              <ZeichenSenden />
            </button>
          </div>
          <p className="hinweis">
            Enter sendet, Shift+Enter macht eine neue Zeile. Aktionen mit Folgen führt der Copilot erst nach deiner Bestätigung aus.
          </p>
        </div>

        <details className="asx-legende" data-fiaon="assistent-legende">
          <summary>Was der Copilot kann — {werkzeuge.length} Werkzeuge</summary>
          <ul>
            {werkzeuge.map((w) => (
              <li key={w.name}>
                <span className={`stufe ${w.stufe === "frei" ? "frei" : "bestaetigen"}`}>{w.stufe === "frei" ? "frei" : "bestätigen"}</span>
                <b>{w.titel}.</b> {w.beschreibung}
              </li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  );

  if (alsAdmin) return inhalt;
  return (
    <AgentShell>
      <DunkleBuehne />
      <Rundgang raum="assistent" titel={RUNDGAENGE.assistent.titel} schritte={RUNDGAENGE.assistent.schritte} />
      {inhalt}
    </AgentShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Die Aktionskarte — ein Werkzeug-Aufruf oder eine wartende Bestätigung
// ═══════════════════════════════════════════════════════════════════════════
function AktionsKarte({ karte, basis, beschaeftigt, onBestaetigen, onVerwerfen }: {
  karte: Karte; basis: string; beschaeftigt: boolean;
  onBestaetigen: () => void; onVerwerfen: () => void;
}) {
  const [vorschau, setVorschau] = useState<string | null>(null);
  const [vorschauGeladen, setVorschauGeladen] = useState(false);

  useEffect(() => {
    if (!karte.hatVorschau || karte.status !== "offen" || vorschauGeladen) return;
    setVorschauGeladen(true);
    fetch(`${basis}/vorbereitungen/${karte.id}/vorschau`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => { if (j?.ok && j.html) setVorschau(String(j.html)); })
      .catch(() => { /* Die Karte funktioniert auch ohne Vorschau. */ });
  }, [karte.hatVorschau, karte.status, karte.id, basis, vorschauGeladen]);

  const STAND_TEXT: Record<string, string> = {
    geplant: "geplant", laeuft: "läuft", erledigt: "erledigt", ausgefuehrt: "erledigt",
    fehlgeschlagen: "fehlgeschlagen", offen: "wartet auf dich", verworfen: "verworfen", abgelaufen: "abgelaufen",
  };
  const standKlasse = karte.status === "ausgefuehrt" ? "erledigt" : karte.status;
  const meldung = karte.ergebnis && typeof karte.ergebnis === "object"
    ? (karte.ergebnis.meldung || karte.ergebnis.hinweis || null)
    : null;
  const einmalPasswort = karte.ergebnis && typeof karte.ergebnis === "object" && karte.ergebnis.passwort
    ? String(karte.ergebnis.passwort) : null;

  return (
    <div className="asx-nachricht assistent" style={{ marginTop: 8 }}>
      <div className="asx-karte" data-fiaon={`assistent-karte-${karte.typ}`}>
        <div className="kopf">
          {karte.typ === "bestaetigung" ? <ZeichenSchild /> : <ZeichenBlitz />}
          <b>{karte.titel || (karte.typ === "bestaetigung" ? "Aktion" : "Werkzeug")}</b>
          <span className={`stand ${standKlasse}`}>{STAND_TEXT[karte.status] || karte.status}</span>
        </div>
        {karte.zusammenfassung && <p className="satz">{karte.zusammenfassung}</p>}
        {karte.warnung && <p className="warnung">{karte.warnung}</p>}
        {karte.fehler && <p className="fehler">{karte.fehler}</p>}
        {vorschau && karte.status === "offen" && (
          <div className="asx-vorschau">
            <iframe title="E-Mail-Vorschau" sandbox="" srcDoc={vorschau} />
          </div>
        )}
        {meldung && (karte.status === "erledigt" || karte.status === "ausgefuehrt") && (
          <p className="ergebnis">{String(meldung)}{einmalPasswort ? ` — Einmal-Passwort: ${einmalPasswort}` : ""}</p>
        )}
        {karte.typ === "bestaetigung" && karte.status === "offen" && (
          <div className="knoepfe">
            <button type="button" className="asx-ausfuehren" onClick={onBestaetigen} disabled={beschaeftigt}
                    data-fiaon="assistent-ausfuehren">
              {beschaeftigt ? "Wird ausgeführt …" : "Ausführen"}
            </button>
            <button type="button" className="asx-abbrechen" onClick={onVerwerfen} disabled={beschaeftigt}>
              Abbrechen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Selbst gezeichnete Zeichen — 1,5-px-Strich, currentColor (AGENTS.md:
// keine Icon-Bibliotheken in neuem Code).
// ═══════════════════════════════════════════════════════════════════════════
function ZeichenSenden() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>;
}
function ZeichenPlus() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;
}
function ZeichenStift() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 3l4 4L8 20l-5 1 1-5L17 3Z" /></svg>;
}
function ZeichenArchiv() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7h18M5 7v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7M10 11h4" /></svg>;
}
function ZeichenKreuz() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>;
}
function ZeichenNadel() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 17v5M7 4h10l-1.5 7.5L18 14H6l2.5-2.5L7 4Z" /></svg>;
}
function ZeichenLeiste() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h16" /></svg>;
}
function ZeichenSchild() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3Z" /></svg>;
}
function ZeichenBlitz() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" /></svg>;
}
