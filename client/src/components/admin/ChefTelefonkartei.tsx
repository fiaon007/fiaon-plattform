// ═══════════════════════════════════════════════════════════════════════════
// /chef/s/telefonkartei — Justins eigene Anrufseite (21.09.2026, E-201)
//
// Justin: „Ich habe heute selbst telefoniert und es lief hervorragend […]
// simpel, clean, einfach zu bedienen." Und dann die vier Fälle: Rechnung
// (Mail + WhatsApp, ein Klick), kein Interesse (stornieren), nicht erreicht
// (Mail + WhatsApp), „rufen Sie mich um … an".
//
// So ist die Seite gebaut:
//   · Reiter A · B · C · Rate offen · Alle · Storniert — die Stufen des Hauses.
//   · Jede Karte zeigt alles, ohne sie zu öffnen.
//   · „Anrufen" speichert am iPhone zuerst den Kontakt (vCard, „Neuen Kontakt
//     erstellen" — ein Tipp, den Apple verlangt), danach wählt derselbe Knopf.
//   · Vier Knöpfe nach dem Gespräch. WhatsApp öffnet sich fertig geschrieben;
//     die Mail (bei „Rechnung" mit der Rechnung als PDF) schickt der Server
//     über die geprüfte Hauskette — Wortwand, Protokoll, Akte.
//   · Oben deine Rückrufe, unten alle gebuchten Termine.
// Die Texte stehen in shared/fiaon-telefonkartei.ts, die Wirkung in
// server/lib/fiaon-telefonkartei.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { API, seit, Geruest, Fehlermeldung, useDaten } from "./chef-teile";
import { Rundgang } from "@/components/agent/Rundgang";
import { BoniAmpelBlock } from "@/components/BoniAmpel";
import { RUNDGAENGE } from "@/pages/agent/rundgaenge";
import {
  KARTEI_GRUPPEN, KARTEI_LAGE_TEXT, KARTEI_SUCHE_SATZ, euro, euroGanz, datumKurz, waLink,
  whatsappRechnung, whatsappNichtErreicht, whatsappAntrag, hatRechnungsweg, hatAntragsweg,
  type KarteiGruppe, type KarteiKarte, type KarteiErgebnis, type KarteiRueckruf, type KarteiTermin,
} from "@shared/fiaon-telefonkartei";
import "@/styles/office-rundgang.css";
import "@/styles/chef-telefonkartei.css";

// Die Akte des Chefbüros — dieselbe Seite wie /chef/s/akte, hier im Fenster (E-201).
const KundeAkte = lazy(() => import("@/pages/admin-kunde"));

interface Antwort {
  ok: boolean;
  gruppe: KarteiGruppe;
  karten: KarteiKarte[];
  mehr: boolean;
  zaehler: (Record<KarteiGruppe, number> & { gesperrt: number }) | null;
  absender: string;
  antragUrl: string;
}

interface Meldung { art: "gut" | "fehler"; titel: string; punkte?: string[]; link?: { href: string; text: string } }

/** Reihenfolge der Reiter: erst die heißen, „Alle" und „Storniert" hinten. */
const REITER: KarteiGruppe[] = ["A", "B", "C", "rate", "alle", "storniert"];

// ── Kleiner Speicher im Browser — nur Bequemlichkeit, nie Wahrheit ─────────
function lesen<T>(schluessel: string, vorgabe: T): T {
  try { const v = localStorage.getItem(schluessel); return v ? (JSON.parse(v) as T) : vorgabe; } catch { return vorgabe; }
}
function schreiben(schluessel: string, wert: unknown): void {
  try { localStorage.setItem(schluessel, JSON.stringify(wert)); } catch { /* privates Fenster */ }
}

/** Telefon in der Hand? Dann speichert „Anrufen" zuerst den Kontakt, und WhatsApp öffnet ohne neuen Tab. */
function istHandy(): boolean {
  if (typeof window === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || !!window.matchMedia?.("(pointer: coarse)").matches;
}

const uhr = (iso: string) => new Date(iso).toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
function tagName(iso: string): string {
  const berlin = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  const d = new Date(iso);
  if (berlin(d) === berlin(new Date())) return "Heute";
  if (berlin(d) === berlin(new Date(Date.now() + 86_400_000))) return "Morgen";
  return d.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", weekday: "short", day: "2-digit", month: "2-digit" });
}
function inWorten(iso: string): string {
  const min = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (min < -1) return `seit ${Math.abs(min) < 60 ? `${Math.abs(min)} Min` : `${Math.round(Math.abs(min) / 60)} Std`} fällig`;
  if (min <= 1) return "jetzt";
  if (min < 60) return `in ${min} Min`;
  return `in ${Math.round(min / 60)} Std`;
}

/**
 * Blätter und Meldungen hängen an <body>: Die Seitenhülle des Chefbüros blendet
 * mit einer transform-Animation ein, und ein transform macht jeden Vorfahren zum
 * Bezugsrahmen für position: fixed — das Blatt landete sonst am Seitenende.
 */
function Ebene({ children }: { children: ReactNode }) {
  return typeof document === "undefined" ? null : createPortal(<div className="tk tk-ebene">{children}</div>, document.body);
}

export default function ChefTelefonkartei() {
  const [gruppe, setGruppe] = useState<KarteiGruppe>(() => lesen<KarteiGruppe>("tk-gruppe", "A"));
  const [sucheRoh, setSucheRoh] = useState("");
  const [suche, setSuche] = useState("");
  const [gesperrte, setGesperrte] = useState(false);
  const [daten, setDaten] = useState<Antwort | null>(null);
  const [karten, setKarten] = useState<KarteiKarte[]>([]);
  const [seite, setSeite] = useState(0);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<Meldung | null>(null);
  const [arbeit, setArbeit] = useState<Record<number, KarteiErgebnis | "storno" | "zurueck" | undefined>>({});
  const [stornoFuer, setStornoFuer] = useState<KarteiKarte | null>(null);
  const [rueckrufFuer, setRueckrufFuer] = useState<KarteiKarte | null>(null);
  const [akteFuer, setAkteFuer] = useState<KarteiKarte | null>(null);
  const [gespeichert, setGespeichert] = useState<Set<number>>(() => new Set(lesen<number[]>("tk-kontakte", [])));
  const handy = useMemo(istHandy, []);
  const termine = useDaten<{ rueckrufe: KarteiRueckruf[]; termine: KarteiTermin[] }>("/chef/telefonkartei/termine");
  const meldungUhr = useRef<number | null>(null);

  useEffect(() => { schreiben("tk-gruppe", gruppe); }, [gruppe]);
  useEffect(() => { const t = window.setTimeout(() => setSuche(sucheRoh.trim()), 320); return () => window.clearTimeout(t); }, [sucheRoh]);

  const laden = useCallback(async (s: number) => {
    setLaedt(true); setFehler(null);
    try {
      const q = new URLSearchParams({ gruppe, seite: String(s), ...(suche ? { suche } : {}), ...(gesperrte ? { gesperrte: "1" } : {}) });
      const r = await fetch(`${API}/chef/telefonkartei?${q}`, { credentials: "include" });
      const j = await r.json().catch(() => null);
      if (r.status === 401) throw new Error("Die Anmeldung ist abgelaufen. Bitte neu anmelden.");
      if (!j?.ok) throw new Error(j?.error || "Die Kartei ließ sich nicht laden.");
      setDaten((alt) => ({ ...j, zaehler: j.zaehler ?? alt?.zaehler ?? null }));
      setKarten((alt) => (s === 0 ? j.karten : [...alt, ...j.karten]));
      setSeite(s);
    } catch (e: any) {
      setFehler(e.message || "Keine Verbindung zum Server.");
    } finally {
      setLaedt(false);
    }
  }, [gruppe, suche, gesperrte]);

  useEffect(() => { void laden(0); }, [laden]);

  const melden = (m: Meldung) => {
    setMeldung(m);
    if (meldungUhr.current) window.clearTimeout(meldungUhr.current);
    meldungUhr.current = window.setTimeout(() => setMeldung(null), m.art === "fehler" ? 12_000 : 8_000);
  };

  const kontaktGespeichert = (id: number) => {
    setGespeichert((alt) => { const n = new Set(alt); n.add(id); schreiben("tk-kontakte", Array.from(n).slice(-3000)); return n; });
  };

  const karteErsetzen = (k: KarteiKarte | null | undefined, id: number, raus = false) => {
    setKarten((alt) => (raus ? alt.filter((x) => x.personId !== id) : alt.map((x) => (x.personId === id && k ? k : x))));
  };

  const zaehlerAendern = (von: KarteiGruppe | null, nach: KarteiGruppe | null) => {
    setDaten((d) => {
      if (!d?.zaehler) return d;
      const z = { ...d.zaehler };
      if (von && z[von] > 0) z[von] -= 1;
      if (nach) z[nach] += 1;
      return { ...d, zaehler: z };
    });
  };

  // ── Ein Fall-Knopf. WhatsApp öffnet der Link selbst (braucht den Klick);
  //    hier läuft nur, was der Server tun muss. keepalive: Die Anfrage kommt
  //    auch an, wenn das iPhone gerade zu WhatsApp wechselt.
  const ergebnis = async (k: KarteiKarte, art: KarteiErgebnis, extra: Record<string, unknown> = {}) => {
    setArbeit((a) => ({ ...a, [k.personId]: art }));
    try {
      const r = await fetch(`${API}/chef/telefonkartei/${k.personId}/ergebnis`, {
        method: "POST", credentials: "include", keepalive: true,
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ art, ...extra }),
      });
      const j = await r.json().catch(() => null);
      if (!j?.ok) { melden({ art: "fehler", titel: j?.meldung || "Das hat nicht geklappt." }); return false; }
      const punkte = [j.mail?.text, j.meldung].filter(Boolean) as string[];
      if (art === "rueckruf" && j.rueckruf) {
        melden({ art: "gut", titel: j.meldung, link: { href: `${API}/chef/telefonkartei/rueckruf/${j.rueckruf.id}/kalender.ics`, text: "Erinnerung ins iPhone-Kalender" } });
      } else {
        melden({ art: j.mail && !j.mail.ok ? "fehler" : "gut", titel: `${k.name}: ${art === "nicht_erreicht" ? "nicht erreicht" : art === "rechnung" ? "Rechnung geschickt" : art === "antrag" ? "Antrag geschickt" : "gespeichert"}`, punkte });
      }
      karteErsetzen(j.karte, k.personId);
      termine.neu();
      return true;
    } catch {
      melden({ art: "fehler", titel: "Keine Verbindung — bitte noch einmal." });
      return false;
    } finally {
      setArbeit((a) => ({ ...a, [k.personId]: undefined }));
    }
  };

  const stornoAusfuehren = async (k: KarteiKarte, grund: string, kulanz: boolean) => {
    setArbeit((a) => ({ ...a, [k.personId]: "storno" }));
    try {
      const r = await fetch(`${API}/chef/telefonkartei/${k.personId}/storno`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grund, kulanz }),
      });
      const j = await r.json().catch(() => null);
      if (!j?.ok) { melden({ art: "fehler", titel: j?.meldung || "Der Storno hat nicht geklappt.", punkte: j?.punkte }); return; }
      setStornoFuer(null);
      karteErsetzen(null, k.personId, true);
      zaehlerAendern(gruppe === "alle" ? "alle" : gruppe, "storniert");
      melden({ art: "gut", titel: `${k.name} storniert`, punkte: [...(j.punkte ?? []), "Zurückholen geht unter „Storniert“."] });
      termine.neu();
    } catch {
      melden({ art: "fehler", titel: "Keine Verbindung — bitte noch einmal." });
    } finally {
      setArbeit((a) => ({ ...a, [k.personId]: undefined }));
    }
  };

  const zurueckholen = async (k: KarteiKarte) => {
    setArbeit((a) => ({ ...a, [k.personId]: "zurueck" }));
    try {
      const r = await fetch(`${API}/chef/telefonkartei/${k.personId}/storno/zuruecknehmen`, { method: "POST", credentials: "include" });
      const j = await r.json().catch(() => null);
      if (!j?.ok) { melden({ art: "fehler", titel: j?.meldung || "Zurückholen hat nicht geklappt." }); return; }
      karteErsetzen(null, k.personId, true);
      zaehlerAendern("storniert", null);
      melden({ art: "gut", titel: `${k.name} ist zurück`, punkte: j.punkte });
    } catch {
      melden({ art: "fehler", titel: "Keine Verbindung — bitte noch einmal." });
    } finally {
      setArbeit((a) => ({ ...a, [k.personId]: undefined }));
    }
  };

  const akteSchliessen = async () => {
    const k = akteFuer;
    setAkteFuer(null);
    if (!k) return;
    const r = await fetch(`${API}/chef/telefonkartei/karte/${k.personId}`, { credentials: "include" }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (j?.ok && j.karte) karteErsetzen(j.karte, k.personId);
  };

  const rueckrufErledigt = async (id: number) => {
    await fetch(`${API}/chef/telefonkartei/rueckruf/${id}/erledigt`, { method: "POST", credentials: "include" }).catch(() => null);
    termine.neu();
  };

  const z = daten?.zaehler;
  const satz = suche ? KARTEI_SUCHE_SATZ : (KARTEI_GRUPPEN.find((g) => g.key === gruppe)?.satz ?? "");
  const eigeneTermine = (termine.daten?.termine ?? []).filter((x) => x.meiner && x.status === "gebucht" && new Date(x.beginn).getTime() > Date.now() - 30 * 60_000);
  const absender = daten?.absender || "Justin Schwarzott";
  const antragUrl = daten?.antragUrl || "https://www.fiaon.com/antrag";

  return (
    <div className="tk">
      <Rundgang raum="telefonkartei" titel="Telefonkartei" schritte={RUNDGAENGE.telefonkartei.schritte} />

      <p className="tk-soseht">
        <b>So geht&apos;s:</b> „Anrufen“ speichert den Kontakt auf deinem iPhone und wählt. Nach dem Gespräch ein Knopf —
        die Mail geht automatisch raus, WhatsApp öffnet sich fertig geschrieben.
      </p>

      <Rueckrufe
        liste={termine.daten?.rueckrufe ?? []}
        onErledigt={rueckrufErledigt}
      />
      {eigeneTermine.length > 0 && (
        <a className="tk-sprung" href="#tk-deine-termine">
          Deine Termine ({eigeneTermine.length}) — nächster: {tagName(eigeneTermine[0].beginn).replace(/^(Heute|Morgen)$/, (w) => w.toLowerCase())}, {uhr(eigeneTermine[0].beginn)} Uhr
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3.5 8.5 8 13l4.5-4.5" /></svg>
        </a>
      )}

      <nav className="tk-reiter" aria-label="Gruppen">
        {REITER.map((key) => {
          const g = KARTEI_GRUPPEN.find((x) => x.key === key)!;
          return (
            <button key={key} type="button" className={`tk-reiter-knopf${gruppe === key ? " an" : ""}`} data-gruppe={key}
                    aria-pressed={gruppe === key} onClick={() => setGruppe(key)}>
              <span>{g.label}</span>
              {z && <em>{z[key].toLocaleString("de-DE")}</em>}
            </button>
          );
        })}
      </nav>

      <div className="tk-leiste">
        <label className="tk-suche">
          <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" /></svg>
          <input type="search" value={sucheRoh} onChange={(e) => setSucheRoh(e.target.value)}
                 placeholder="Name, Nummer, E-Mail oder FIAON-…" aria-label="Suchen" />
        </label>
        {gruppe !== "storniert" && (
          <label className="tk-schalter">
            <input type="checkbox" checked={gesperrte} onChange={(e) => setGesperrte(e.target.checked)} />
            <span>Gesperrte zeigen{z ? ` (${z.gesperrt.toLocaleString("de-DE")})` : ""}</span>
          </label>
        )}
      </div>
      <p className={`tk-satz${suche ? " sucht" : ""}`}>{satz}</p>

      {fehler && <Fehlermeldung text={fehler} erneut={() => void laden(0)} />}
      {laedt && karten.length === 0 && !fehler && <Geruest zeilen={6} />}
      {!laedt && !fehler && karten.length === 0 && (
        <div className="tk-leer">{suche ? `Niemand passt zu „${suche}“.` : "Hier ist gerade niemand."}</div>
      )}

      <div className="tk-raster">
        {karten.map((k) => (
          <Karte key={k.personId} k={k} absender={absender} antragUrl={antragUrl} handy={handy}
                 gespeichert={gespeichert.has(k.personId)} arbeit={arbeit[k.personId]}
                 onGespeichert={kontaktGespeichert}
                 onErgebnis={(art) => void ergebnis(k, art)}
                 onStorno={() => setStornoFuer(k)}
                 onRueckruf={() => setRueckrufFuer(k)}
                 onAkte={() => setAkteFuer(k)}
                 onZurueck={() => void zurueckholen(k)} />
        ))}
      </div>

      {daten?.mehr && (
        <button type="button" className="tk-mehr" disabled={laedt} onClick={() => void laden(seite + 1)}>
          {laedt ? "Lädt …" : "Weitere laden"}
        </button>
      )}

      <Termine liste={termine.daten?.termine ?? []} laedt={termine.laedt} fehler={termine.fehler} />

      {stornoFuer && (<Ebene>
        <StornoBlatt k={stornoFuer} laeuft={arbeit[stornoFuer.personId] === "storno"}
                     onAbbrechen={() => setStornoFuer(null)}
                     onStornieren={(grund, kulanz) => void stornoAusfuehren(stornoFuer, grund, kulanz)} />
      </Ebene>)}
      {akteFuer && (<Ebene>
        <AkteFenster k={akteFuer} onZu={() => void akteSchliessen()} />
      </Ebene>)}
      {rueckrufFuer && (<Ebene>
        <RueckrufBlatt k={rueckrufFuer} laeuft={arbeit[rueckrufFuer.personId] === "rueckruf"}
                       onAbbrechen={() => setRueckrufFuer(null)}
                       onSpeichern={async (am, notiz) => { if (await ergebnis(rueckrufFuer, "rueckruf", { am, notiz })) setRueckrufFuer(null); }} />
      </Ebene>)}

      {meldung && (<Ebene>
        <div className={`tk-meldung ${meldung.art}`} role="status" onClick={() => setMeldung(null)}>
          <b>{meldung.titel}</b>
          {meldung.punkte?.length ? <ul>{meldung.punkte.map((p, i) => <li key={i}>{p}</li>)}</ul> : null}
          {meldung.link && <a href={meldung.link.href} onClick={(e) => e.stopPropagation()}>{meldung.link.text}</a>}
        </div>
      </Ebene>)}
    </div>
  );
}

// ── Eine Karte ──────────────────────────────────────────────────────────────

function Karte({ k, absender, antragUrl, handy, gespeichert, arbeit, onGespeichert, onErgebnis, onStorno, onRueckruf, onAkte, onZurueck }: {
  k: KarteiKarte; absender: string; antragUrl: string; handy: boolean; gespeichert: boolean;
  arbeit: KarteiErgebnis | "storno" | "zurueck" | undefined;
  onGespeichert: (id: number) => void;
  onErgebnis: (art: KarteiErgebnis) => void;
  onStorno: () => void; onRueckruf: () => void; onAkte: () => void; onZurueck: () => void;
}) {
  const vcf = `${API}/chef/telefonkartei/${k.personId}/kontakt.vcf`;
  const tel = k.telefonWaehlbar ? `tel:${k.telefonWaehlbar}` : null;
  // Am Telefon: erst den Kontakt anlegen, dann wählt derselbe Knopf.
  const zuerstSpeichern = handy && !gespeichert && !!tel;
  const anrufZiel = zuerstSpeichern ? vcf : tel;
  const anrufKlick = () => { if (zuerstSpeichern) onGespeichert(k.personId); };

  const rechnungText = hatRechnungsweg(k) ? whatsappRechnung(k, absender) : null;
  const antragText = hatAntragsweg(k) ? whatsappAntrag(k, absender, antragUrl) : null;
  const waErster = rechnungText ? waLink(k.telefonWaehlbar, rechnungText) : antragText ? waLink(k.telefonWaehlbar, antragText) : null;
  const waNicht = waLink(k.telefonWaehlbar, whatsappNichtErreicht(k, absender));
  const ersterFall: KarteiErgebnis | null = rechnungText ? "rechnung" : antragText ? "antrag" : null;
  const ziel = handy ? undefined : "_blank";

  const fall = (art: KarteiErgebnis, href: string | null) => (e: React.MouseEvent) => {
    // Ohne WhatsApp-Ziel (keine Nummer) bleibt es bei Mail und Verlauf.
    if (!href) e.preventDefault();
    if (arbeit) { e.preventDefault(); return; }
    onErgebnis(art);
  };

  const fakten: [string, string][] = [];
  if (k.paket) fakten.push(["Paket", `${k.paket.label}${k.paket.preisCents != null ? ` · ${euro(k.paket.preisCents)}` : ""}`]);
  if (k.wunschlimitEuro != null) fakten.push(["Wunschlimit", euroGanz(k.wunschlimitEuro)]);
  if (k.zahlung) fakten.push(["Referenz", k.zahlung.referenz]);
  if (k.email) fakten.push(["E-Mail", k.email]);
  if (k.ort) fakten.push(["Ort", k.ort]);
  if (k.lead) fakten.push(["Quelle", [k.lead.quelle, k.lead.kampagne].filter(Boolean).join(" · ") || "Lead"]);
  if (k.betreuer) fakten.push(["Betreuer", k.betreuer]);
  const zuletzt = [
    k.kontakt.am ? seit(k.kontakt.am) : null,
    k.kontakt.von && k.kontakt.ergebnis ? `${k.kontakt.von}: ${k.kontakt.ergebnis}` : k.kontakt.ergebnis,
    k.kontakt.nichtErreicht > 0 ? `${k.kontakt.nichtErreicht}× nicht erreicht` : null,
  ].filter(Boolean).join(" · ");
  fakten.push(["Zuletzt", zuletzt || "noch nie angerufen"]);
  if (k.erreichbarkeit) fakten.push(["Erreichbar", k.erreichbarkeit]);
  if (k.zusage) fakten.push(["Zusage", datumKurz(k.zusage)]);
  if (k.termin) fakten.push(["Termin", `${tagName(k.termin.beginn)} ${uhr(k.termin.beginn)} · ${k.termin.art}${k.termin.bei ? ` (${k.termin.bei})` : ""}`]);
  if (k.rueckrufAm) fakten.push(["Rückruf", `${tagName(k.rueckrufAm)} ${uhr(k.rueckrufAm)} Uhr`]);

  return (
    <article className={`tk-karte${arbeit ? " arbeitet" : ""}`} data-lage={k.lage}>
      <header className="tk-kopf">
        <span className="tk-marke" title={KARTEI_LAGE_TEXT[k.lage]}>
          {k.lage === "A" || k.lage === "B" || k.lage === "C" ? k.lage : KARTEI_LAGE_TEXT[k.lage]}
        </span>
        <span className="tk-stand">{k.stand}</span>
        {k.ereignisAm && k.lage !== "storniert" && <time className="tk-frisch" dateTime={k.ereignisAm}>{seit(k.ereignisAm)}</time>}
      </header>

      <h3 className="tk-name">{k.name}</h3>
      <div className="tk-nummer-zeile">
        {anrufZiel
          ? <a className="tk-nummer" href={anrufZiel} onClick={anrufKlick}>{k.telefonAnzeige}</a>
          : <span className="tk-nummer aus">{k.telefonAnzeige || "keine Nummer"}</span>}
        {gespeichert && handy && <span className="tk-gespeichert">im iPhone</span>}
      </div>
      {k.telefonHinweis && <p className="tk-hinweis">{k.telefonHinweis}</p>}

      {/* E-202: FIAONs eigene Boni-Ampel — aufklappbar, mit Herkunft jeder Zahl. */}
      {k.ampel && <BoniAmpelBlock ampel={k.ampel} />}

      <dl className="tk-fakten">
        {fakten.map(([t, w]) => <div key={t}><dt>{t}</dt><dd>{w}</dd></div>)}
      </dl>

      {(k.gesperrt || k.werbungGesperrt || k.testfall) && (
        <div className="tk-flaggen">
          {k.testfall && <span className="test">Testkonto</span>}
          {k.gesperrt && <span>Vertriebssperre</span>}
          {k.werbungGesperrt && <span>Werbesperre</span>}
        </div>
      )}

      {k.lage === "storniert" ? (
        <div className="tk-storniert">
          <p>{k.storno?.grund ? `Grund: ${k.storno.grund}` : "Storniert."}</p>
          <button type="button" className="tk-knopf" disabled={!!arbeit} onClick={onZurueck}>
            {arbeit === "zurueck" ? "Wird zurückgeholt …" : "Zurückholen"}
          </button>
        </div>
      ) : (
        <>
          {anrufZiel ? (
            <a className="tk-anrufen" href={anrufZiel} onClick={anrufKlick}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.5c.8 0 1.5.6 1.7 1.4l.6 2.4a1.9 1.9 0 0 1-.6 1.9l-1 .9a10.5 10.5 0 0 0 4.7 4.7l.9-1a1.9 1.9 0 0 1 1.9-.6l2.4.6c.8.2 1.4.9 1.4 1.7V18a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 4 6.2 2 2 0 0 1 6 4Z" /></svg>
              <span>{zuerstSpeichern ? "Anrufen" : handy && gespeichert ? "Jetzt anrufen" : "Anrufen"}</span>
              {zuerstSpeichern && <small>speichert zuerst den Kontakt</small>}
            </a>
          ) : (
            <span className="tk-anrufen aus">Keine Nummer hinterlegt</span>
          )}

          <p className="tk-nach">Nach dem Gespräch</p>
          <div className="tk-faelle">
            {ersterFall ? (
              <a className="tk-fall gut" href={waErster ?? "#"} target={waErster ? ziel : undefined} rel="noopener noreferrer"
                 aria-disabled={!waErster && !k.email} onClick={fall(ersterFall, waErster)}>
                <b>{arbeit === ersterFall ? "Wird geschickt …" : ersterFall === "rechnung" ? "Rechnung schicken" : "Antrag schicken"}</b>
                <small>{[k.email ? (ersterFall === "rechnung" ? "Mail mit PDF" : "Mail") : null, waErster ? "WhatsApp" : null].filter(Boolean).join(" + ") || "keine Nummer, keine Mail"}</small>
              </a>
            ) : (
              <span className="tk-fall aus"><b>Rechnung schicken</b><small>keine offene Zahlung</small></span>
            )}
            <a className="tk-fall" href={waNicht ?? "#"} target={waNicht ? ziel : undefined} rel="noopener noreferrer"
               onClick={fall("nicht_erreicht", waNicht)}>
              <b>{arbeit === "nicht_erreicht" ? "Wird geschickt …" : "Nicht erreicht"}</b>
              <small>{[k.email && !k.werbungGesperrt ? "Mail" : null, waNicht ? "WhatsApp" : null].filter(Boolean).join(" + ") || "nur Verlauf"} · dein Kalender</small>
            </a>
            <button type="button" className="tk-fall blau" disabled={!!arbeit} onClick={onRueckruf}>
              <b>Später anrufen</b><small>Uhrzeit wählen</small>
            </button>
            <button type="button" className="tk-fall rot" disabled={!!arbeit} onClick={onStorno}>
              <b>Stornieren</b><small>kein Interesse</small>
            </button>
          </div>
        </>
      )}

      {(k.akteId || (!handy && k.telefonWaehlbar)) && (
        <footer className="tk-fuss">
          {k.akteId && <button type="button" className="tk-fuss-knopf" onClick={onAkte}>Akte öffnen</button>}
          {!handy && k.telefonWaehlbar && <a href={vcf}>Kontakt (.vcf)</a>}
        </footer>
      )}
    </article>
  );
}

// ── Rückrufe oben ───────────────────────────────────────────────────────────

function Rueckrufe({ liste, onErledigt }: { liste: KarteiRueckruf[]; onErledigt: (id: number) => void }) {
  if (!liste.length) return null;
  return (
    <section className="tk-rueckrufe" aria-label="Deine Rückrufe">
      <h2>Deine Rückrufe</h2>
      <ul>
        {liste.map((r) => {
          const faellig = new Date(r.am).getTime() <= Date.now() + 5 * 60_000;
          return (
            <li key={r.id} className={faellig ? "faellig" : ""}>
              <div className="tk-rr-zeit"><b>{uhr(r.am)}</b><span>{tagName(r.am)} · {inWorten(r.am)}</span></div>
              <div className="tk-rr-name"><b>{r.name}</b>{r.notiz && <span>{r.notiz}</span>}</div>
              <div className="tk-rr-tun">
                {r.telefonWaehlbar && <a className="tk-mini blau" href={`tel:${r.telefonWaehlbar}`}>Anrufen</a>}
                <a className="tk-mini" href={`${API}/chef/telefonkartei/rueckruf/${r.id}/kalender.ics`} title="Erinnerung ins iPhone-Kalender">Kalender</a>
                <button type="button" className="tk-mini" onClick={() => onErledigt(r.id)}>Erledigt</button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ── Termine unten: erst deine, dann alle ───────────────────────────────────
// Justin (21.09.2026): „Ich will nur meine sehen und erst weiter unten ALLE
// Termine — vorrangig die, die die Leute bei mir buchen." „Deine" kommen vom
// Server markiert (Gründerseite /justin, dein Konto, Gründergespräch).

function nachTagen(liste: KarteiTermin[]): [string, KarteiTermin[]][] {
  const m = new Map<string, KarteiTermin[]>();
  for (const t of liste) {
    const key = new Date(t.beginn).toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
    m.set(key, [...(m.get(key) ?? []), t]);
  }
  return Array.from(m.entries());
}

function tagUeberschrift(key: string, beginn: string): string {
  const n = tagName(beginn);
  return n === "Heute" || n === "Morgen" ? `${n}, ${datumKurz(key)}` : n;
}

/** Das Anliegen aus der Buchung (/justin schreibt „Anliegen: …" in die Notiz). */
function anliegen(notiz: string | null): string | null {
  const m = String(notiz ?? "").match(/Anliegen:\s*([^\n]+)/);
  return m ? m[1].trim() : null;
}

function Termine({ liste, laedt, fehler }: { liste: KarteiTermin[]; laedt: boolean; fehler: string | null }) {
  const [alleOffen, setAlleOffen] = useState(false);
  const deine = useMemo(() => nachTagen(liste.filter((t) => t.meiner)), [liste]);
  const andere = useMemo(() => liste.filter((t) => !t.meiner), [liste]);
  const andereTage = useMemo(() => nachTagen(andere), [andere]);
  return (
    <section className="tk-termine" aria-label="Termine">
      <div id="tk-deine-termine" className="tk-deine">
        <div className="tk-termine-kopf">
          <h2>Deine Termine</h2>
          <span>Gebucht über fiaon.com/justin und dein Kalender</span>
        </div>
        {fehler && <p className="tk-klein">{fehler}</p>}
        {laedt && !liste.length && <p className="tk-klein">Lädt …</p>}
        {!laedt && !fehler && !deine.length && (
          <p className="tk-klein">In den nächsten 60 Tagen hat niemand bei dir gebucht.</p>
        )}
        {deine.map(([tag, zeilen]) => (
          <div key={tag} className="tk-tag">
            <h3>{tagUeberschrift(tag, zeilen[0].beginn)}</h3>
            <ul>
              {zeilen.map((t) => {
                const thema = anliegen(t.notiz);
                return (
                  <li key={t.id} className={t.status !== "gebucht" ? "vorbei" : ""}>
                    <b className="tk-t-zeit">{uhr(t.beginn)}</b>
                    <div className="tk-t-was">
                      <b>{t.name}</b>
                      <span>{[t.art, thema, t.status !== "gebucht" ? t.status : null].filter(Boolean).join(" · ")}</span>
                    </div>
                    {t.telefonWaehlbar && t.status === "gebucht" && <a className="tk-mini blau" href={`tel:${t.telefonWaehlbar}`}>Anrufen</a>}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="tk-alle-termine">
        <button type="button" className="tk-alle-kopf" aria-expanded={alleOffen} onClick={() => setAlleOffen((o) => !o)}>
          <span>Alle Termine des Teams</span>
          <em>{andere.length}</em>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d={alleOffen ? "M3.5 10 8 5.5 12.5 10" : "M3.5 6 8 10.5 12.5 6"} /></svg>
        </button>
        {alleOffen && (
          <>
            {!andere.length && <p className="tk-klein">In den nächsten drei Wochen ist beim Team nichts gebucht.</p>}
            {andereTage.map(([tag, zeilen]) => (
              <div key={tag} className="tk-tag">
                <h3>{tagUeberschrift(tag, zeilen[0].beginn)}</h3>
                <ul>
                  {zeilen.map((t) => (
                    <li key={t.id}>
                      <b className="tk-t-zeit">{uhr(t.beginn)}</b>
                      <div className="tk-t-was">
                        <b>{t.name}</b>
                        <span>{t.art}{t.bei ? ` · ${t.bei}` : ""}</span>
                      </div>
                      {t.telefonWaehlbar && <a className="tk-mini" href={`tel:${t.telefonWaehlbar}`}>Anrufen</a>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <a className="tk-zentrale" href="/chef/s/termine">Zur Termin-Zentrale</a>
          </>
        )}
      </div>
    </section>
  );
}

// ── Die Akte im Fenster ────────────────────────────────────────────────────
// Justin: „Wenn ich ‚Akte öffnen' klicke, muss sich ein Popup öffnen — auf der
// selben Seite, ohne dass ich die Seite verlasse." Dieselbe Akte wie im
// Chefbüro (pages/admin-kunde.tsx), hier eingebettet; `.cbs` übersetzt sie
// ins Dunkle wie dort.

function AkteFenster({ k, onZu }: { k: KarteiKarte; onZu: () => void }) {
  useEffect(() => {
    const vorher = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const taste = (e: KeyboardEvent) => { if (e.key === "Escape") onZu(); };
    window.addEventListener("keydown", taste);
    return () => { document.body.style.overflow = vorher; window.removeEventListener("keydown", taste); };
  }, [onZu]);
  return (
    <div className="tk-akte-schleier" role="dialog" aria-modal="true" aria-label={`Akte ${k.name}`} onClick={onZu}>
      <div className="tk-akte" onClick={(e) => e.stopPropagation()}>
        <div className="tk-akte-kopf">
          <div>
            <b>{k.name}</b>
            <span>{KARTEI_LAGE_TEXT[k.lage]}{k.telefonAnzeige ? ` · ${k.telefonAnzeige}` : ""}</span>
          </div>
          <button type="button" className="tk-akte-zu" onClick={onZu} aria-label="Akte schließen">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
          </button>
        </div>
        <div className="tk-akte-inhalt cbs">
          <Suspense fallback={<div className="tk-klein" style={{ padding: 24 }}>Akte lädt …</div>}>
            {k.akteId && <KundeAkte akteId={k.akteId} eingebettet />}
          </Suspense>
        </div>
      </div>
    </div>
  );
}

// ── Stornieren ──────────────────────────────────────────────────────────────

const STORNO_GRUENDE = ["Kein Interesse", "Kein Geld", "Hat woanders abgeschlossen", "Falsche Person / Nummer", "Doppelt angelegt"];

function StornoBlatt({ k, laeuft, onAbbrechen, onStornieren }: {
  k: KarteiKarte; laeuft: boolean; onAbbrechen: () => void; onStornieren: (grund: string, kulanz: boolean) => void;
}) {
  const [grund, setGrund] = useState(STORNO_GRUENDE[0]);
  const [eigen, setEigen] = useState("");
  const [kulanz, setKulanz] = useState(false);
  const bezahlt = k.lage === "rate" || k.lage === "bezahlt";
  const punkte: string[] = [];
  if (k.lage === "A" || k.lage === "B" || k.lage === "abbrecher") {
    punkte.push(`Die offene Bestellung${k.paket ? ` (${k.paket.label}${k.paket.preisCents != null ? ` · ${euro(k.paket.preisCents)}` : ""})` : ""} wird storniert — keine Zahlungserinnerungen mehr.`);
  }
  if (k.lage === "A") punkte.push("Achtung: Er hat eine Zahlung gemeldet. Kommt das Geld doch noch, holst du ihn zurück.");
  if (bezahlt) punkte.push("Bezahlter Vertrag: Kündigung nach Hausregel — die laufende Rate bleibt fällig, spätere entfallen, er bekommt die Bestätigung per Mail.");
  if (k.leadId) punkte.push("Der Lead verschwindet aus allen Listen, die Lead-Mails hören auf.");
  punkte.push(bezahlt ? "Keine Werbung mehr; als zahlender Kunde bleibt er bis zum Vertragsende bei seinem Betreuer." : "Keine Anrufe, keine Werbung, gebuchte Termine werden abgesagt.");
  punkte.push("Du findest ihn danach unter „Storniert“ und kannst ihn dort zurückholen.");

  return (
    <div className="tk-schleier" role="dialog" aria-modal="true" aria-label={`${k.name} stornieren`} onClick={onAbbrechen}>
      <div className="tk-blatt" onClick={(e) => e.stopPropagation()}>
        <h2>{k.name} stornieren?</h2>
        <ul className="tk-blatt-punkte">{punkte.map((p, i) => <li key={i}>{p}</li>)}</ul>
        <p className="tk-blatt-label">Grund — steht am Kunden</p>
        <div className="tk-chips">
          {STORNO_GRUENDE.map((g) => (
            <button key={g} type="button" className={grund === g && !eigen ? "an" : ""} onClick={() => { setGrund(g); setEigen(""); }}>{g}</button>
          ))}
        </div>
        <input className="tk-feld" value={eigen} onChange={(e) => setEigen(e.target.value)} placeholder="Oder in eigenen Worten …" maxLength={200} />
        {bezahlt && (
          <label className="tk-kulanz">
            <input type="checkbox" checked={kulanz} onChange={(e) => setKulanz(e.target.checked)} />
            <span>Kulanz: sofort beenden — offene Raten entfallen</span>
          </label>
        )}
        <div className="tk-blatt-tun">
          <button type="button" className="tk-knopf rot" disabled={laeuft} onClick={() => onStornieren(eigen.trim() || grund, kulanz)}>
            {laeuft ? "Wird storniert …" : "Stornieren"}
          </button>
          <button type="button" className="tk-knopf still" onClick={onAbbrechen}>Abbrechen</button>
        </div>
      </div>
    </div>
  );
}

// ── Später anrufen ──────────────────────────────────────────────────────────
// Justin (21.09.2026): „Der Kalender ist super unübersichtlich, genauso die
// Uhrzeitauswahl — bitte neu und einfacher." Kein Systemkalender mehr: Tag,
// Stunde, Minute als große Knöpfe, oben die schnellen Wege, darüber groß, was
// gewählt ist. Vergangene Zeiten sind aus.

const STUNDEN = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const MINUTEN = [0, 15, 30, 45];
const SCHNELL: [string, number][] = [["in 15 Min", 15], ["in 30 Min", 30], ["in 1 Std", 60], ["in 2 Std", 120]];

function tagOffset(n: number): Date { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return d; }
const WOCHENTAG = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
function tagKnopf(n: number): string {
  if (n === 0) return "Heute";
  if (n === 1) return "Morgen";
  const d = tagOffset(n);
  return `${WOCHENTAG[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.`;
}
function zeitText(d: Date): string {
  const heute = tagOffset(0).getTime();
  const tag = new Date(d); tag.setHours(0, 0, 0, 0);
  const diff = Math.round((tag.getTime() - heute) / 86_400_000);
  const vor = diff === 0 ? "heute" : diff === 1 ? "morgen" : d.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
  return `${vor}, ${d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr`;
}

function RueckrufBlatt({ k, laeuft, onAbbrechen, onSpeichern }: {
  k: KarteiKarte; laeuft: boolean; onAbbrechen: () => void; onSpeichern: (am: string, notiz: string) => void;
}) {
  // Vorgabe: in einer Stunde, auf fünf Minuten gerundet — „meist am selben Tag".
  const [wahl, setWahl] = useState<Date>(() => { const d = new Date(Date.now() + 60 * 60_000); d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0); return d; });
  const [schnell, setSchnell] = useState<number | null>(60);
  const [notiz, setNotiz] = useState("");
  const jetzt = Date.now();
  const tagDiff = Math.round((new Date(wahl).setHours(0, 0, 0, 0) - tagOffset(0).getTime()) / 86_400_000);

  const setze = (tag: number, stunde: number, minute: number) => {
    const d = tagOffset(tag); d.setHours(stunde, minute, 0, 0);
    setWahl(d); setSchnell(null);
  };
  const schnellWahl = (min: number) => {
    const d = new Date(Date.now() + min * 60_000); d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
    setWahl(d); setSchnell(min);
  };
  // Beim Tageswechsel die Uhrzeit behalten — außer sie liegt dann in der Vergangenheit.
  const tagWahl = (n: number) => {
    let h = wahl.getHours(), m = wahl.getMinutes();
    if (!STUNDEN.includes(h)) { h = 10; m = 0; }
    const d = tagOffset(n); d.setHours(h, m - (m % 15), 0, 0);
    if (d.getTime() <= jetzt) { const s = STUNDEN.find((x) => tagOffset(n).setHours(x) > jetzt); if (s != null) d.setHours(s, 0, 0, 0); }
    setWahl(d); setSchnell(null);
  };
  const vorbei = (tag: number, h: number, m: number) => { const d = tagOffset(tag); d.setHours(h, m, 0, 0); return d.getTime() <= jetzt; };
  const gueltig = wahl.getTime() > jetzt;
  const tag = Math.max(0, tagDiff);
  const viertel = wahl.getMinutes() - (wahl.getMinutes() % 15);
  // Stunde gewählt: die Minute bleibt, wenn sie noch geht — sonst die erste freie.
  const stundeWahl = (h: number) => setze(tag, h, !vorbei(tag, h, viertel) ? viertel : (MINUTEN.find((m) => !vorbei(tag, h, m)) ?? 0));

  return (
    <div className="tk-schleier" role="dialog" aria-modal="true" aria-label={`${k.name} später anrufen`} onClick={onAbbrechen}>
      <div className="tk-blatt tk-rr-blatt" onClick={(e) => e.stopPropagation()}>
        <h2>{k.name} später anrufen</h2>
        <p className="tk-rr-gewaehlt">Rückruf <b>{zeitText(wahl)}</b></p>

        <p className="tk-blatt-label">Schnell</p>
        <div className="tk-wahl vier">
          {SCHNELL.map(([t, min]) => (
            <button key={t} type="button" className={schnell === min ? "an" : ""} onClick={() => schnellWahl(min)}>{t}</button>
          ))}
        </div>

        <p className="tk-blatt-label">Tag</p>
        <div className="tk-wahl tage">
          {[0, 1, 2, 3, 4, 5, 6].map((n) => (
            <button key={n} type="button" className={tagDiff === n ? "an" : ""} onClick={() => tagWahl(n)}>{tagKnopf(n)}</button>
          ))}
        </div>

        <p className="tk-blatt-label">Uhrzeit</p>
        <div className="tk-wahl stunden">
          {STUNDEN.map((h) => (
            <button key={h} type="button" disabled={vorbei(tag, h, 45)}
                    className={wahl.getHours() === h ? "an" : ""}
                    onClick={() => stundeWahl(h)}>
              {h}
            </button>
          ))}
        </div>
        <div className="tk-wahl vier minuten">
          {MINUTEN.map((m) => (
            <button key={m} type="button" disabled={vorbei(tag, wahl.getHours(), m)}
                    className={wahl.getMinutes() === m ? "an" : ""}
                    onClick={() => setze(tag, wahl.getHours(), m)}>
              :{String(m).padStart(2, "0")}
            </button>
          ))}
        </div>

        <input className="tk-feld" value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="Notiz (optional), z. B. „nach der Arbeit“" maxLength={200} />
        <div className="tk-blatt-tun">
          <button type="button" className="tk-knopf blau" disabled={laeuft || !gueltig} onClick={() => onSpeichern(wahl.toISOString(), notiz.trim())}>
            {laeuft ? "Wird gespeichert …" : "Rückruf speichern"}
          </button>
          <button type="button" className="tk-knopf still" onClick={onAbbrechen}>Abbrechen</button>
        </div>
      </div>
    </div>
  );
}
