// ═══════════════════════════════════════════════════════════════════════════
// /chef/s/telefonkartei — Justins eigene Anrufseite (21.09.2026, E-201)
//
// Justin: „Ich habe heute selbst telefoniert und es lief hervorragend […]
// simpel, clean, einfach zu bedienen." Und dann die vier Fälle: Rechnung
// (Mail + WhatsApp, ein Klick), kein Interesse (stornieren), nicht erreicht
// (Mail + WhatsApp), „rufen Sie mich um … an".
//
// So ist die Seite gebaut:
//   · Reiter Alle · A · B · C · Rate offen · Storniert — die Stufen des Hauses.
//     E-259 (29.09.2026): „Alle" zuerst; oben die Frischen A → B → C, dann wer
//     am wenigsten angerufen wurde, ab 10 Versuchen ans Ende (Regel auf dem
//     Server, KARTEI_ORDNUNG_SQL). Die Karte zeigt die Zahl: „3 Versuche".
//   · Jede Karte zeigt alles, ohne sie zu öffnen.
//   · „Anrufen" speichert am iPhone zuerst den Kontakt (vCard, „Neuen Kontakt
//     erstellen" — ein Tipp, den Apple verlangt), danach wählt derselbe Knopf.
//   · Vier Knöpfe nach dem Gespräch. Mail UND WhatsApp schickt der Server —
//     seit E-259 die WhatsApp über das FIAON-Konto bei Meta (Vorlage bzw.
//     freier Text im offenen 24-Stunden-Fenster), nie mehr über wa.me und
//     Justins privates WhatsApp. Vorher fragt das Blatt, was jeder Fall täte.
//   · Oben deine Rückrufe, unten alle gebuchten Termine.
//   · E-274 (02.10.2026): „E-Mail" auf der Karte und in der Akte — eine freie
//     Mail ohne Gesprächsergebnis, auf Wunsch mit den Zahlungsdaten und der
//     Rechnung als PDF (Blatt „E-Mail", unten).
// Die Texte stehen in shared/fiaon-telefonkartei.ts, die Wirkung in
// server/lib/fiaon-telefonkartei.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { API, seit, Geruest, Fehlermeldung, useDaten } from "./chef-teile";
import { Rundgang } from "@/components/agent/Rundgang";
import { BoniAmpelBlock, BoniAmpelKapsel } from "@/components/BoniAmpel";
import { RUNDGAENGE } from "@/pages/agent/rundgaenge";
import {
  KARTEI_GRUPPEN, KARTEI_LAGE_TEXT, KARTEI_SUCHE_SATZ, euro, euroGanz, datumKurz, KI_WUNSCH_MAX,
  hatRechnungsweg, hatAntragsweg, versucheText,
  mailZahlungsdaten, KARTEI_MAIL_BETREFF_MAX, KARTEI_MAIL_TEXT_MAX, KARTEI_MAIL_ZUSTELL_SATZ,
  type KarteiGruppe, type KarteiKarte, type KarteiErgebnis, type KarteiRueckruf, type KarteiTermin, type KarteiKiAntwort,
  type KarteiWaLage, type KarteiWaFallLage, type KarteiWaErgebnis,
  type KarteiMailLage, type KarteiMailAntwort, type KarteiMailZeile,
} from "@shared/fiaon-telefonkartei";
import { wandPruefen } from "@shared/fiaon-wortverbote";
import "@/styles/office-rundgang.css";
import "@/styles/chef-telefonkartei.css";
import "@/styles/akte-dunkel.css";

// Die Akte des Chefbüros — dieselbe Seite wie /chef/s/akte, hier im Fenster (E-201).
const KundeAkte = lazy(() => import("@/pages/admin-kunde"));

interface Antwort {
  ok: boolean;
  gruppe: KarteiGruppe;
  karten: KarteiKarte[];
  mehr: boolean;
  zaehler: (Record<KarteiGruppe, number> & { gesperrt: number }) | null;
  absender: string;
}

interface Meldung { art: "gut" | "fehler"; titel: string; punkte?: string[]; link?: { href: string; text: string } }

/**
 * Reihenfolge der Reiter. E-259 (29.09.2026): „Alle" vorn — dort stehen oben die
 * Frischen A, dann B, dann C (Justin: „gib mir ganz oben A dann B und dann C").
 */
const REITER: KarteiGruppe[] = ["alle", "A", "B", "C", "rate", "storniert"];
/**
 * Der gemerkte Reiter. Neuer Schlüssel seit E-259: Die alte Wahl („A", Vorgabe bis
 * 28.09.) hätte die neue Reihung „A → B → C" in „Alle" verdeckt — die Seite öffnet
 * einmal auf „Alle", danach gilt wieder, was du zuletzt gewählt hast.
 */
const REITER_SPEICHER = "tk-reiter";

// ── Kleiner Speicher im Browser — nur Bequemlichkeit, nie Wahrheit ─────────
function lesen<T>(schluessel: string, vorgabe: T): T {
  try { const v = localStorage.getItem(schluessel); return v ? (JSON.parse(v) as T) : vorgabe; } catch { return vorgabe; }
}
function schreiben(schluessel: string, wert: unknown): void {
  try { localStorage.setItem(schluessel, JSON.stringify(wert)); } catch { /* privates Fenster */ }
}
function loeschen(schluessel: string): void {
  try { localStorage.removeItem(schluessel); } catch { /* privates Fenster */ }
}

/** Telefon in der Hand? Dann speichert „Anrufen" zuerst den Kontakt. */
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
  const [gruppe, setGruppe] = useState<KarteiGruppe>(() => {
    const g = lesen<KarteiGruppe>(REITER_SPEICHER, "alle");
    return REITER.includes(g) ? g : "alle";
  });
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
  const [nachrichtFuer, setNachrichtFuer] = useState<KarteiKarte | null>(null);
  // E-274: das Blatt „E-Mail" — und ein Zähler, der die offene Akte nach dem Senden neu lädt (Verlauf).
  const [mailFuer, setMailFuer] = useState<KarteiKarte | null>(null);
  const [akteRunde, setAkteRunde] = useState(0);
  const [gespeichert, setGespeichert] = useState<Set<number>>(() => new Set(lesen<number[]>("tk-kontakte", [])));
  const handy = useMemo(istHandy, []);
  const termine = useDaten<{ rueckrufe: KarteiRueckruf[]; termine: KarteiTermin[] }>("/chef/telefonkartei/termine");
  const meldungUhr = useRef<number | null>(null);
  // Die gezeigten Karten für „Weitere laden" — ohne neu gebaute Ladefunktion bei jedem Klick.
  const kartenRef = useRef<KarteiKarte[]>([]);
  useEffect(() => { kartenRef.current = karten; }, [karten]);

  useEffect(() => { schreiben(REITER_SPEICHER, gruppe); }, [gruppe]);
  useEffect(() => { const t = window.setTimeout(() => setSuche(sucheRoh.trim()), 320); return () => window.clearTimeout(t); }, [sucheRoh]);

  // Nachbesserung E-259 (29.09.2026): „Weitere laden" schickt die schon gezeigten Karten mit und
  // bekommt die nächstbesten OHNE sie. Vorher blätterte es per OFFSET — seit die Reihenfolge an deinen
  // Klicks hängt („Nicht erreicht" schiebt nach hinten), standen die eben Angerufenen doppelt da und
  // die nächsten frischen Kunden fehlten. Beim Anhängen zusätzlich nach personId entdoppelt.
  const laden = useCallback(async (s: number) => {
    setLaedt(true); setFehler(null);
    try {
      const ohne = s === 0 ? [] : kartenRef.current.map((k) => k.personId);
      const r = s === 0
        ? await fetch(`${API}/chef/telefonkartei?${new URLSearchParams({ gruppe, seite: "0", ...(suche ? { suche } : {}), ...(gesperrte ? { gesperrte: "1" } : {}) })}`, { credentials: "include" })
        : await fetch(`${API}/chef/telefonkartei/weitere`, {
            method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ gruppe, suche, gesperrte, ohne }),
          });
      const j = await r.json().catch(() => null);
      if (r.status === 401) throw new Error("Die Anmeldung ist abgelaufen. Bitte neu anmelden.");
      if (!j?.ok) throw new Error(j?.error || "Die Kartei ließ sich nicht laden.");
      setDaten((alt) => ({ ...(alt ?? {}), ...j, zaehler: j.zaehler ?? alt?.zaehler ?? null, absender: j.absender ?? alt?.absender ?? "" }));
      setKarten((alt) => {
        if (s === 0) return j.karten;
        const da = new Set(alt.map((k) => k.personId));
        return [...alt, ...(j.karten as KarteiKarte[]).filter((k) => !da.has(k.personId))];
      });
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

  // ── Ein Fall-Knopf. E-259: Mail UND WhatsApp schickt der Server (WhatsApp
  //    über das FIAON-Konto bei Meta) — die Seite öffnet keinen Link mehr.
  const ergebnis = async (k: KarteiKarte, art: KarteiErgebnis, extra: Record<string, unknown> = {}) => {
    setArbeit((a) => ({ ...a, [k.personId]: art }));
    try {
      const r = await fetch(`${API}/chef/telefonkartei/${k.personId}/ergebnis`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ art, ...extra }),
      });
      const j = await r.json().catch(() => null);
      if (!j?.ok) { melden({ art: "fehler", titel: j?.meldung || "Das hat nicht geklappt." }); return false; }
      const wa: KarteiWaErgebnis | null = j.wa ?? null;
      const punkte = [j.mail?.text, wa?.text, j.meldung].filter(Boolean) as string[];
      if (j.doppelt) {
        // Nachbesserung E-259: Ein zweiter Tipp binnen zehn Minuten ist kein Fehler — es ging nur nichts ein zweites Mal raus.
        melden({ art: "gut", titel: `${k.name}: schon erledigt`, punkte: [j.meldung] });
      } else if (art === "rueckruf" && j.rueckruf) {
        melden({ art: "gut", titel: j.meldung, link: { href: `${API}/chef/telefonkartei/rueckruf/${j.rueckruf.id}/kalender.ics`, text: "Erinnerung ins iPhone-Kalender" } });
      } else {
        // Rot nur, wenn gar nichts beim Kunden ankam — dann soll Justin es sehen.
        const raus = !!(j.mail?.ok || wa?.ok);
        const titel = art === "nicht_erreicht" ? "nicht erreicht" : art === "rechnung" ? "Rechnung" : art === "antrag" ? "Antrag-Link" : "gespeichert";
        melden({ art: raus ? "gut" : "fehler", titel: `${k.name}: ${titel}${raus ? "" : " — nichts rausgegangen"}`, punkte });
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

  // E-274: Nach einer Mail lädt die offene Akte neu (der Eintrag im Verlauf) und die Karte frisch —
  // eine angehängte Rechnung zu einem fertigen Antrag hat ihn eben in Rechnung gestellt.
  const mailGesendet = async (k: KarteiKarte) => {
    setAkteRunde((n) => n + 1);
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

  return (
    <div className="tk">
      <Rundgang raum="telefonkartei" titel="Telefonkartei" schritte={RUNDGAENGE.telefonkartei.schritte} />

      <p className="tk-soseht">
        <b>So geht&apos;s:</b> „Anrufen“ speichert den Kontakt auf deinem iPhone und wählt. Nach dem Gespräch ein Knopf —
        Mail und WhatsApp gehen automatisch raus, die WhatsApp über das FIAON-Konto: Sie steht im WhatsApp-Raum, und Mara weiß Bescheid.
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
          <Karte key={k.personId} k={k} handy={handy}
                 gespeichert={gespeichert.has(k.personId)} arbeit={arbeit[k.personId]}
                 onGespeichert={kontaktGespeichert}
                 onNachrichten={() => setNachrichtFuer(k)}
                 onEmail={() => setMailFuer(k)}
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
      {nachrichtFuer && (<Ebene>
        <NachrichtenBlatt k={nachrichtFuer}
                          onZu={() => setNachrichtFuer(null)}
                          onErgebnis={(art) => { const k = nachrichtFuer; setNachrichtFuer(null); void ergebnis(k, art); }}
                          onRueckruf={() => { const k = nachrichtFuer; setNachrichtFuer(null); setRueckrufFuer(k); }}
                          onStorno={() => { const k = nachrichtFuer; setNachrichtFuer(null); setStornoFuer(k); }}
                          onEmail={() => { const k = nachrichtFuer; setNachrichtFuer(null); setMailFuer(k); }}
                          onGesendet={(wa) => { const k = nachrichtFuer; setNachrichtFuer(null);
                            melden({ art: "gut", titel: `${k.name}: ${wa.text}`, punkte: ["Steht im WhatsApp-Raum und im Verlauf der Akte."] }); }} />
      </Ebene>)}

      {akteFuer && (<Ebene>
        <AkteFenster k={akteFuer} runde={akteRunde} onZu={() => void akteSchliessen()} onEmail={() => setMailFuer(akteFuer)} />
      </Ebene>)}
      {/* E-274: nach der Akte eingehängt — das Blatt liegt über dem Akte-Fenster (z-index wie jedes Blatt). */}
      {mailFuer && (<Ebene>
        <MailBlatt k={mailFuer} absender={daten?.absender ?? ""}
                   onZu={() => setMailFuer(null)}
                   onGesendet={() => void mailGesendet(mailFuer)} />
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

function Karte({ k, handy, gespeichert, arbeit, onGespeichert, onNachrichten, onEmail, onAkte, onZurueck }: {
  k: KarteiKarte; handy: boolean; gespeichert: boolean;
  arbeit: KarteiErgebnis | "storno" | "zurueck" | undefined;
  onGespeichert: (id: number) => void;
  onNachrichten: () => void; onEmail: () => void; onAkte: () => void; onZurueck: () => void;
}) {
  const vcf = `${API}/chef/telefonkartei/${k.personId}/kontakt.vcf`;
  const tel = k.telefonWaehlbar ? `tel:${k.telefonWaehlbar}` : null;
  // Am Telefon: erst den Kontakt anlegen, dann wählt derselbe Knopf.
  const zuerstSpeichern = handy && !gespeichert && !!tel;
  const anrufZiel = zuerstSpeichern ? vcf : tel;
  const anrufKlick = () => { if (zuerstSpeichern) onGespeichert(k.personId); };

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
    // E-259: die Serie ohne Erreichen aus der Anrufzählung — auch für Leads (unreachable_count kennt sie nicht).
    k.kontakt.fehlInFolge > 0 ? `${k.kontakt.fehlInFolge}× in Folge nicht erreicht` : null,
  ].filter(Boolean).join(" · ");
  const versuche = k.kontakt.versuche;
  const versucheStufe = versuche === 0 ? "nie" : versuche >= 10 ? "viel" : versuche >= 5 ? "oft" : "wenig";
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
        {k.lage !== "storniert" && (
          <span className="tk-versuche" data-stufe={versucheStufe}
                title={k.kontakt.letzterVersuch ? `Zuletzt versucht ${seit(k.kontakt.letzterVersuch)}` : "Noch kein Anrufversuch"}>
            {versucheText(versuche)}
          </span>
        )}
      </div>
      {k.telefonHinweis && <p className="tk-hinweis">{k.telefonHinweis}</p>}

      {/* E-202: FIAONs eigene Boni-Ampel — aufklappbar, mit Herkunft jeder Zahl. */}
      {k.ampel && <BoniAmpelBlock ampel={k.ampel} />}

      <dl className="tk-fakten">
        {fakten.map(([t, w]) => <div key={t}><dt>{t}</dt><dd>{w}</dd></div>)}
      </dl>

      {(k.gesperrt || k.werbungGesperrt || k.stopp || k.testfall) && (
        <div className="tk-flaggen">
          {k.testfall && <span className="test">Testkonto</span>}
          {k.gesperrt && <span>Vertriebssperre</span>}
          {k.werbungGesperrt && <span>Werbesperre</span>}
          {/* Nachbesserung E-259: „STOPP" geschrieben — keine WhatsApp mehr, auch kein freier Text. */}
          {k.stopp && <span className="stopp" title="Hat „STOPP“ bzw. „Keine Nachrichten mehr“ geschrieben">Stopp: keine WhatsApp</span>}
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
          {/* 21.09.2026 (Justin: „Buttons moderner — und fasse alle WhatsApp-
              Nachrichten in EINEN Knopf"): zwei Knöpfe. Die vier Fälle und die
              persönliche Nachricht öffnen sich im Blatt „Nachrichten". */}
          <div className="tk-aktionen">
            {anrufZiel ? (
              <a className="tk-anrufen" href={anrufZiel} onClick={anrufKlick}>
                <span className="tk-zeichen" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M7 3.5c.8 0 1.5.6 1.7 1.4l.6 2.4a1.9 1.9 0 0 1-.6 1.9l-1 .9a10.5 10.5 0 0 0 4.7 4.7l.9-1a1.9 1.9 0 0 1 1.9-.6l2.4.6c.8.2 1.4.9 1.4 1.7V18a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 4 6.2 2 2 0 0 1 6 4Z" /></svg>
                </span>
                <span className="tk-aktion-text">
                  <b>{zuerstSpeichern ? "Anrufen" : handy && gespeichert ? "Jetzt anrufen" : "Anrufen"}</b>
                  {zuerstSpeichern && <small>speichert zuerst den Kontakt</small>}
                </span>
              </a>
            ) : (
              <span className="tk-anrufen aus"><span className="tk-aktion-text"><b>Keine Nummer</b></span></span>
            )}
            <button type="button" className="tk-nachrichten" disabled={!!arbeit} onClick={onNachrichten} aria-haspopup="dialog">
              <span className="tk-zeichen" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M4.5 18.8 5.6 15A7.6 7.6 0 1 1 9 18.4Z" /><path d="M9 10.5h6M9 13.5h3.5" /></svg>
              </span>
              <span className="tk-aktion-text">
                <b>{arbeit && arbeit !== "storno" && arbeit !== "zurueck" ? "Wird geschickt …" : "Nachrichten"}</b>
                <small>4 Fälle · KI</small>
              </span>
            </button>
            {/* E-274 (02.10.2026, Justin: „ich brauch da ein Knopf wo ich den Kunden eine Email senden kann"):
                eine Mail ohne Gesprächsergebnis — das Blatt „E-Mail". Ohne Adresse aus, mit Grund. */}
            <button type="button" className="tk-email" disabled={!k.email || !!arbeit} onClick={onEmail} aria-haspopup="dialog"
                    title={k.email ? `E-Mail an ${k.email}` : "Keine E-Mail-Adresse hinterlegt"}>
              <span className="tk-zeichen" aria-hidden="true">
                <svg viewBox="0 0 24 24"><rect x="3.5" y="5.5" width="17" height="13" rx="2.5" /><path d="m4.5 7.5 6.6 4.9c.5.4 1.3.4 1.8 0l6.6-4.9" /></svg>
              </span>
              <span className="tk-aktion-text">
                <b>E-Mail</b>
                <small>{k.email ?? "keine E-Mail-Adresse"}</small>
              </span>
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
// ins Dunkle wie dort, `.akte-dunkel` macht sie ruhig (akte-dunkel.css —
// Justin am 21.09.: „das muss besser aussehen, cleaner!"). Der Kopf trägt
// Name, Stufe, Boni-Ampel und Kontakt; die Akte selbst zeigt den Namen nicht
// ein zweites Mal. E-274 (02.10.2026): Neben der Adresse „E-Mail schreiben" —
// das Blatt „E-Mail" legt sich über das Fenster; nach dem Senden lädt die Akte neu.

function AkteFenster({ k, runde, onZu, onEmail }: { k: KarteiKarte; runde: number; onZu: () => void; onEmail: () => void }) {
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
        <div className="tk-akte-kopf" data-lage={k.lage}>
          <div className="tk-akte-wer">
            <span className="tk-akte-ort">Akte</span>
            <b>{k.name}</b>
            <div className="tk-akte-zeile">
              <span className="tk-akte-lage">{KARTEI_LAGE_TEXT[k.lage]}</span>
              {k.ampel && <BoniAmpelKapsel ampel={k.ampel} klein />}
              {k.telefonWaehlbar
                ? <a className="tk-akte-kontakt" href={`tel:${k.telefonWaehlbar}`}>{k.telefonAnzeige}</a>
                : k.telefonAnzeige ? <span className="tk-akte-kontakt">{k.telefonAnzeige}</span> : null}
              {k.email && <a className="tk-akte-kontakt" href={`mailto:${k.email}`}>{k.email}</a>}
              {/* E-274: Justin sucht den Knopf „in der Akte" — dasselbe Blatt wie auf der Karte, über FIAON. */}
              {k.email && (
                <button type="button" className="tk-akte-mail" onClick={onEmail} aria-haspopup="dialog">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="2.5" /><path d="m4.5 7.5 6.6 4.9c.5.4 1.3.4 1.8 0l6.6-4.9" /></svg>
                  E-Mail schreiben
                </button>
              )}
            </div>
          </div>
          <button type="button" className="tk-akte-zu" onClick={onZu} aria-label="Akte schließen">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
          </button>
        </div>
        <div className="tk-akte-inhalt cbs akte-dunkel">
          {/* E-274: `runde` zählt nach einer Mail hoch — die Akte lädt neu und zeigt den Eintrag im Verlauf. */}
          <Suspense key={runde} fallback={<div className="tk-klein" style={{ padding: 24 }}>Akte lädt …</div>}>
            {k.akteId && <KundeAkte akteId={k.akteId} eingebettet />}
          </Suspense>
        </div>
      </div>
    </div>
  );
}

// ── Nachrichten: vier Fälle und die persönliche Nachricht ──────────────────
// Justin (21.09.2026): „fasse alle WhatsApp-Nachrichten in einen Button — wenn
// man draufklickt, ein cooles Layout, wo die Szenarien drinstehen … UND so was
// wie ein Freitext, nur besser benannt."
// E-259 (29.09.2026): „Wenn ich WhatsApp-Nachricht auswähle, dann muss das über
// unser WhatsApp-Meta-Konto laufen, nicht über das private." Die Fälle sind jetzt
// Knöpfe, die nur den Server fragen; der schickt Mail UND WhatsApp (freigegebene
// Vorlage, im offenen 24-Stunden-Fenster freier Text). Beim Öffnen fragt das
// Blatt einmal, was jeder Fall täte (whatsapp-lage) — steht „keine WhatsApp:
// Werbesperre" darunter, weiß Justin es VOR dem Tippen.

interface WaLageStand { daten: KarteiWaLage | null; laedt: boolean; fehler: string | null; neu: () => void }

function useWaLage(personId: number): WaLageStand {
  const [daten, setDaten] = useState<KarteiWaLage | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [runde, setRunde] = useState(0);
  useEffect(() => {
    let aus = false;
    setLaedt(true); setFehler(null);
    fetch(`${API}/chef/telefonkartei/${personId}/whatsapp-lage`, { credentials: "include" })
      .then((r) => r.json().catch(() => null))
      .then((j) => { if (aus) return; if (j?.ok) setDaten(j); else setFehler(j?.meldung || "Der WhatsApp-Stand ließ sich nicht laden."); })
      .catch(() => { if (!aus) setFehler("Keine Verbindung — der WhatsApp-Stand fehlt."); })
      .finally(() => { if (!aus) setLaedt(false); });
    return () => { aus = true; };
  }, [personId, runde]);
  return { daten, laedt, fehler, neu: () => setRunde((n) => n + 1) };
}

/** „Mail mit PDF + WhatsApp über FIAON" — oder ehrlich, warum keine WhatsApp. */
function wegeZeile(mail: string | null, wa: KarteiWaFallLage | undefined, lage: WaLageStand): string {
  const raus: string[] = [];
  if (mail) raus.push(mail);
  // Nachbesserung E-259: Was man vorher wissen muss — z. B. dass der Knopf der Vorlage ins allgemeine Terminformular führt.
  if (wa?.weg) raus.push(`${wa.weg === "text" ? "WhatsApp über FIAON (freier Text)" : "WhatsApp über FIAON"}${wa.hinweis ? ` (${wa.hinweis})` : ""}`);
  const ohne = wa
    ? (!wa.weg ? `keine WhatsApp: ${wa.kurz ?? "—"}` : null)
    : lage.laedt ? "WhatsApp wird geprüft …" : lage.fehler ? "WhatsApp-Stand unbekannt" : null;
  return [raus.join(" + ") || null, ohne].filter(Boolean).join(" · ") || "nur Verlauf";
}

function NachrichtenBlatt({ k, onZu, onErgebnis, onRueckruf, onStorno, onEmail, onGesendet }: {
  k: KarteiKarte;
  onZu: () => void; onErgebnis: (art: KarteiErgebnis) => void;
  onRueckruf: () => void; onStorno: () => void; onEmail: () => void; onGesendet: (wa: KarteiWaErgebnis) => void;
}) {
  const [ansicht, setAnsicht] = useState<"faelle" | "ki">("faelle");
  const lage = useWaLage(k.personId);
  useEffect(() => {
    const taste = (e: KeyboardEvent) => { if (e.key === "Escape") onZu(); };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [onZu]);

  const ersterFall: KarteiErgebnis | null = hatRechnungsweg(k) ? "rechnung" : hatAntragsweg(k) ? "antrag" : null;
  const faelle = lage.daten?.faelle ?? {};
  const vorname = k.vorname || k.name.split(" ")[0];
  const offen = lage.daten?.fensterOffen === true;

  return (
    <div className="tk-schleier" role="dialog" aria-modal="true" aria-label={`Nachrichten an ${k.name}`} onClick={onZu}>
      <div className="tk-blatt tk-nb" onClick={(e) => e.stopPropagation()}>
        <div className="tk-nb-kopf">
          {ansicht === "ki" ? (
            <button type="button" className="tk-nb-rund" onClick={() => setAnsicht("faelle")} aria-label="Zurück zu den Fällen">
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5 5.5 8l4.5 4.5" /></svg>
            </button>
          ) : null}
          <div className="tk-nb-titel">
            <span>{ansicht === "ki" ? "Persönliche Nachricht" : "Nachrichten"}</span>
            <b>{k.name}</b>
          </div>
          <button type="button" className="tk-nb-rund" onClick={onZu} aria-label="Schließen">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
          </button>
        </div>

        {ansicht === "faelle" ? (
          <>
            <p className="tk-nb-frage">Wie lief das Gespräch?</p>
            <p className="tk-nb-wa">
              WhatsApp geht über das FIAON-Konto — steht im WhatsApp-Raum, Mara weiß Bescheid.
              {offen && !k.stopp ? ` In den letzten 24 Stunden kam eine Nachricht von ${vorname}: freier Text möglich.` : ""}
              {k.stopp ? " Achtung: Hat „STOPP“ geschrieben — keine WhatsApp." : ""}
            </p>
            <div className="tk-nb-liste">
              {ersterFall ? (
                <button type="button" className="tk-nb-fall gruen" onClick={() => onErgebnis(ersterFall)}>
                  <span className="tk-nb-zeichen" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d="M7 3.5h7l4 4v13H7z" /><path d="M14 3.5v4h4M9.5 12.5h6M9.5 15.5h4" /></svg>
                  </span>
                  <span className="tk-nb-text">
                    <b>{ersterFall === "rechnung" ? "Rechnung schicken" : "Antrag schicken"}</b>
                    <small>{wegeZeile(k.email ? (ersterFall === "rechnung" ? "Mail mit PDF" : "Mail") : null, faelle[ersterFall], lage)}</small>
                  </span>
                  <Pfeil />
                </button>
              ) : (
                <span className="tk-nb-fall aus">
                  <span className="tk-nb-zeichen" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 3.5h7l4 4v13H7z" /></svg></span>
                  <span className="tk-nb-text"><b>Rechnung schicken</b><small>keine offene Zahlung</small></span>
                </span>
              )}
              <button type="button" className="tk-nb-fall gelb" onClick={() => onErgebnis("nicht_erreicht")}>
                <span className="tk-nb-zeichen" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M7 3.5c.8 0 1.5.6 1.7 1.4l.6 2.4a1.9 1.9 0 0 1-.6 1.9l-1 .9a10.5 10.5 0 0 0 4.7 4.7l.9-1a1.9 1.9 0 0 1 1.9-.6l2.4.6c.8.2 1.4.9 1.4 1.7V18a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 4 6.2 2 2 0 0 1 6 4Z" /><path d="M15.5 4.5l4 4M19.5 4.5l-4 4" /></svg>
                </span>
                <span className="tk-nb-text">
                  <b>Nicht erreicht</b>
                  <small>{wegeZeile(k.email && !k.werbungGesperrt ? "Mail mit deinem Kalender" : null, faelle.nicht_erreicht, lage)}</small>
                </span>
                <Pfeil />
              </button>
              <button type="button" className="tk-nb-fall blau" onClick={onRueckruf}>
                <span className="tk-nb-zeichen" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
                </span>
                <span className="tk-nb-text"><b>Später anrufen</b><small>Uhrzeit wählen · keine Nachricht an den Kunden</small></span>
                <Pfeil />
              </button>
              <button type="button" className="tk-nb-fall rot" onClick={onStorno}>
                <span className="tk-nb-zeichen" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" /><path d="M8.5 15.5l7-7" /></svg>
                </span>
                <span className="tk-nb-text"><b>Stornieren</b><small>kein Interesse</small></span>
                <Pfeil />
              </button>
            </div>
            <p className="tk-nb-trenner"><span>Oder frei formuliert</span></p>
            <button type="button" className="tk-nb-fall ki" onClick={() => setAnsicht("ki")}>
              <span className="tk-nb-zeichen" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M12 3.5l1.8 4.7 4.7 1.8-4.7 1.8L12 16.5l-1.8-4.7L5.5 10l4.7-1.8z" /><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" /></svg>
              </span>
              <span className="tk-nb-text">
                <b>Persönliche Nachricht</b>
                <small>
                  Du sagst, worum es geht — die KI schreibt sie für {vorname}
                  {kiZusatz(lage)}
                </small>
              </span>
              <Pfeil />
            </button>
            {/* E-274 (02.10.2026): Hier suchte Justin die Mail — sie öffnet das Blatt „E-Mail" (ohne Ergebnis, ohne WhatsApp). */}
            {k.email ? (
              <button type="button" className="tk-nb-fall blau tk-nb-mail" onClick={onEmail}>
                <span className="tk-nb-zeichen" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><rect x="3.5" y="5.5" width="17" height="13" rx="2.5" /><path d="m4.5 7.5 6.6 4.9c.5.4 1.3.4 1.8 0l6.6-4.9" /></svg>
                </span>
                <span className="tk-nb-text">
                  <b>E-Mail schreiben</b>
                  <small>
                    Nur eine Mail — kein Ergebnis, keine WhatsApp{hatRechnungsweg(k) ? " · auch „Zahlungsdaten neu senden“ mit Rechnung" : ""}
                  </small>
                </span>
                <Pfeil />
              </button>
            ) : (
              <span className="tk-nb-fall blau tk-nb-mail aus">
                <span className="tk-nb-zeichen" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3.5" y="5.5" width="17" height="13" rx="2.5" /></svg></span>
                <span className="tk-nb-text"><b>E-Mail schreiben</b><small>keine E-Mail-Adresse</small></span>
              </span>
            )}
          </>
        ) : (
          <KiNachricht k={k} lage={lage} onGesendet={onGesendet} />
        )}
      </div>
    </div>
  );
}

/**
 * Der Zusatz unter „Persönliche Nachricht" — aus dem, was der Server wirklich
 * täte (Nachbesserung E-259). Vorher stand „Fenster zu: erst die Rückfrage-Vorlage"
 * auch beim Festnetz, bei Werbesperre und wenn die Rückfrage heute nicht mehr ging.
 */
function kiZusatz(lage: WaLageStand): string {
  const d = lage.daten;
  if (!d) return "";
  const frei = d.frei;
  if (frei.weg === "text") return frei.bestaetigen ? ` · ${frei.kurz}: nur mit ausdrücklicher Bestätigung, ohne Verkauf` : " · geht als freier Text über FIAON";
  if (frei.kurz !== "24-Stunden-Fenster zu") return ` · keine WhatsApp: ${frei.kurz ?? "—"}`;
  const rf = d.faelle.rueckfrage;
  if (rf?.weg) return " · Fenster zu: erst die Rückfrage-Vorlage";
  return ` · Fenster zu, Rückfrage heute nicht möglich: ${rf?.kurz ?? "—"}`;
}

function Pfeil() {
  return <svg className="tk-nb-pfeil" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" /></svg>;
}

// Justins eigenes Beispiel steht vorn — ein Tipp füllt das Feld.
const KI_BEISPIELE = [
  "Wie besprochen: in Ruhe unsere Website ansehen, überlegen und sich gern wieder bei mir melden",
  "Freundlich an die offene Rechnung erinnern, ohne Druck",
  "Danke für das Gespräch, ich freue mich auf unseren Termin",
  "Kurz nachfragen, ob noch Fragen offen sind",
];

/**
 * Die persönliche Nachricht. E-259: gesendet über das FIAON-Konto — als freier
 * Text nur, wenn der Kunde in den letzten 24 Stunden geschrieben hat. Ist das
 * Fenster zu, öffnet die Rückfrage-Vorlage das Gespräch neu; der Text bleibt
 * als Entwurf NUR auf diesem Gerät (localStorage). Nachbesserung E-259: Er geht
 * nicht von selbst raus — kein Server-Weg kennt ihn, und auf die Antwort des
 * Kunden antwortet zuerst Mara (nach einer Vorlage bleibt sie an). Die Seite
 * sagt das jetzt so. Bei Werbesperre, Vertriebssperre oder Kündigung verlangt
 * der Server eine ausdrückliche Bestätigung, bei „Stopp" geht gar nichts.
 */
function KiNachricht({ k, lage, onGesendet }: { k: KarteiKarte; lage: WaLageStand; onGesendet: (wa: KarteiWaErgebnis) => void }) {
  const entwurfSchluessel = `tk-entwurf-${k.personId}`;
  const [wunsch, setWunsch] = useState("");
  const [text, setText] = useState<string | null>(() => lesen<string | null>(entwurfSchluessel, null));
  const [hinweise, setHinweise] = useState<string[]>([]);
  const [laeuft, setLaeuft] = useState(false);
  const [sendet, setSendet] = useState<"frei" | "rueckfrage" | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [kopiert, setKopiert] = useState(false);
  const [bestaetigt, setBestaetigt] = useState(false);
  const textFeld = useRef<HTMLTextAreaElement | null>(null);
  const vorname = k.vorname || k.name.split(" ")[0];
  // Der Entwurf wächst mit — der Link am Ende war sonst im Feld verborgen.
  useEffect(() => {
    const f = textFeld.current;
    if (!f) return;
    f.style.height = "auto";
    f.style.height = `${Math.min(f.scrollHeight + 2, Math.round(window.innerHeight * 0.55))}px`;
  }, [text]);
  // Nur Bequemlichkeit: Der Entwurf überlebt das Schließen des Blatts auf diesem Gerät.
  useEffect(() => { if (text) schreiben(entwurfSchluessel, text); }, [text, entwurfSchluessel]);

  const schreibenLassen = async (neuFormulieren: boolean) => {
    if (wunsch.trim().length < 3 || laeuft) return;
    setLaeuft(true); setFehler(null); setKopiert(false);
    try {
      const r = await fetch(`${API}/chef/telefonkartei/${k.personId}/ki-nachricht`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wunsch, vorher: neuFormulieren ? text : null }),
      });
      const j: KarteiKiAntwort | null = await r.json().catch(() => null);
      if (!j?.ok || !j.text) { setFehler(j?.meldung || "Das hat nicht geklappt — bitte noch einmal."); return; }
      setText(j.text);
      setHinweise(j.hinweise ?? []);
    } catch {
      setFehler("Keine Verbindung — bitte noch einmal.");
    } finally {
      setLaeuft(false);
    }
  };

  const senden = async (art: "frei" | "rueckfrage") => {
    if (sendet || (art === "frei" && !text)) return;
    setSendet(art); setFehler(null);
    try {
      const r = await fetch(`${API}/chef/telefonkartei/${k.personId}/whatsapp-${art}`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(art === "frei" ? { text, bestaetigt } : {}),
      });
      const j = await r.json().catch(() => null);
      if (!j?.ok) {
        setFehler(j?.meldung || "Die WhatsApp ging nicht raus.");
        if (j?.fensterZu || j?.bestaetigen) lage.neu();
        return;
      }
      if (art === "frei") loeschen(entwurfSchluessel);
      onGesendet(j.wa ?? { ok: true, text: j.meldung, weg: art === "frei" ? "text" : "vorlage", vorlage: null });
    } catch {
      setFehler("Keine Verbindung — bitte noch einmal.");
    } finally {
      setSendet(null);
    }
  };
  const kopieren = async () => {
    if (!text) return;
    try { await navigator.clipboard.writeText(text); setKopiert(true); } catch { setKopiert(false); }
  };
  const verwerfen = () => { loeschen(entwurfSchluessel); setText(null); setHinweise([]); setWunsch(""); };

  const frei = lage.daten?.frei;
  const rueck = lage.daten?.faelle.rueckfrage;

  return (
    <div className="tk-ki">
      <label className="tk-ki-frage" htmlFor={`tk-ki-${k.personId}`}>Was möchtest du {vorname} schreiben?</label>
      <textarea id={`tk-ki-${k.personId}`} className="tk-ki-wunsch" rows={3} maxLength={KI_WUNSCH_MAX}
                value={wunsch} onChange={(e) => setWunsch(e.target.value)}
                placeholder="In deinen Worten, Stichpunkte reichen …" />
      {!text && (
        <div className="tk-ki-beispiele" aria-label="Beispiele">
          {KI_BEISPIELE.map((b) => <button key={b} type="button" onClick={() => setWunsch(b)}>{b}</button>)}
        </div>
      )}
      {!text && (
        <button type="button" className="tk-knopf blau tk-ki-los" disabled={laeuft || wunsch.trim().length < 3} onClick={() => void schreibenLassen(false)}>
          {laeuft ? <span className="tk-ki-denkt">Die KI schreibt<i /><i /><i /></span> : "Nachricht schreiben"}
        </button>
      )}
      {fehler && <p className="tk-ki-fehler" role="alert">{fehler}</p>}

      {text && (
        <>
          <p className="tk-ki-label">So geht sie raus — du kannst alles ändern</p>
          <textarea ref={textFeld} className="tk-ki-text" value={text} onChange={(e) => setText(e.target.value)} rows={8} />
          {hinweise.length > 0 && (
            <ul className="tk-ki-hinweise">{hinweise.map((h, i) => <li key={i}>{h}</li>)}</ul>
          )}
          <div className="tk-ki-tun">
            {lage.laedt && !lage.daten ? (
              <span className="tk-ki-keine">WhatsApp wird geprüft …</span>
            ) : frei?.weg === "text" && frei.bestaetigen ? (
              <div className="tk-ki-fenster tk-ki-sperre">
                <p><b>{frei.kurz}:</b> {String(frei.grund ?? "").replace(/^[^:]+:\s*/, "")}</p>
                <label className="tk-ki-bestaetigen">
                  <input type="checkbox" checked={bestaetigt} onChange={(e) => setBestaetigt(e.target.checked)} />
                  <span>Ich habe die Sperre gesehen — ich antworte nur auf die Nachricht des Kunden, ohne Verkauf.</span>
                </label>
                <button type="button" className="tk-knopf wa" disabled={!!sendet || !bestaetigt} onClick={() => void senden("frei")}>
                  {sendet === "frei" ? "Wird gesendet …" : "Trotz Sperre senden"}
                </button>
              </div>
            ) : frei?.weg === "text" ? (
              <button type="button" className="tk-knopf wa" disabled={!!sendet} onClick={() => void senden("frei")}>
                {sendet === "frei" ? "Wird gesendet …" : "Über FIAON-WhatsApp senden"}
              </button>
            ) : frei?.kurz === "24-Stunden-Fenster zu" ? (
              <div className="tk-ki-fenster">
                <p>
                  <b>Das 24-Stunden-Fenster ist zu.</b> Freier Text geht über Meta erst, wenn {vorname} uns schreibt.
                  Die Rückfrage-Vorlage („Eine kurze Rückfrage“) öffnet das Gespräch. Dein Text bleibt auf diesem Gerät
                  als Entwurf — er geht nicht von selbst raus: Kommt eine Antwort, öffne „Persönliche Nachricht“ wieder und
                  sende ihn. Bis dahin antwortet Mara.
                </p>
                {rueck?.weg ? (
                  <button type="button" className="tk-knopf wa" disabled={!!sendet} onClick={() => void senden("rueckfrage")}>
                    {sendet === "rueckfrage" ? "Wird gesendet …" : "Rückfrage-Vorlage senden"}
                  </button>
                ) : (
                  <span className="tk-ki-keine">Rückfrage geht nicht: {rueck?.grund ?? lage.fehler ?? "unbekannt"}</span>
                )}
              </div>
            ) : (
              <span className="tk-ki-keine">
                Keine WhatsApp möglich: {frei?.grund ?? lage.fehler ?? "unbekannt"}
                {/* Bei „Stopp" kein Umweg über einen anderen Kanal vorschlagen. */}
                {frei?.kurz === "Stopp" ? "" : " — kopieren und anders senden."}
              </span>
            )}
            <button type="button" className="tk-knopf still" disabled={laeuft || wunsch.trim().length < 3}
                    title={wunsch.trim().length < 3 ? "Oben kurz sagen, worum es geht" : undefined}
                    onClick={() => void schreibenLassen(true)}>
              {laeuft ? "Schreibt …" : "Neu formulieren"}
            </button>
            <button type="button" className="tk-knopf still" onClick={() => void kopieren()}>{kopiert ? "Kopiert" : "Kopieren"}</button>
            <button type="button" className="tk-knopf still" onClick={verwerfen}>Verwerfen</button>
          </div>
        </>
      )}
    </div>
  );
}

// ── E-Mail (02.10.2026, E-274) ─────────────────────────────────────────────
// Justin: „ich brauch da ein Knopf wo ich den Kunden eine Email senden kann —
// wie jetzt, ich hatte eben mit [einem Kunden] telefoniert, der will
// einbezahlen und braucht aber die Mail neu." Ein Blatt in derselben Bauart wie
// „Nachrichten": oben „Zahlungsdaten neu senden" (nur mit offener Zahlung —
// dieselbe Regel wie „Rechnung schicken"), dann Betreff und Text. Die Anrede
// setzt der Server davor (freitextVersenden) — das Blatt zeigt sie, damit sie
// nicht doppelt getippt wird. „Vorschau" zeigt die Mail, wie sie ankommt;
// „Senden" schickt sie — kein Gesprächsergebnis, keine WhatsApp, kein
// Zusagedatum. Unten die letzten Mails mit dem Stand aus dem Mail-Protokoll.

interface MailLageStand { daten: KarteiMailLage | null; laedt: boolean; fehler: string | null; verlaufSetzen: (v: KarteiMailZeile[]) => void; neu: () => void }

function useMailLage(personId: number): MailLageStand {
  const [daten, setDaten] = useState<KarteiMailLage | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  // Gegenprüfung E-274: „neu" — nach einem Verbindungsabbruch beim Senden zeigt „Zuletzt an …"
  // wirklich den Stand des Servers (vorher versprach die Meldung das, geladen wurde nichts).
  const [runde, setRunde] = useState(0);
  useEffect(() => {
    let aus = false;
    setLaedt(true); setFehler(null);
    fetch(`${API}/chef/telefonkartei/${personId}/mail-lage`, { credentials: "include" })
      .then((r) => r.json().catch(() => null))
      .then((j) => { if (aus) return; if (j?.ok) setDaten(j); else setFehler(j?.meldung || "Der Mail-Stand ließ sich nicht laden."); })
      .catch(() => { if (!aus) setFehler("Keine Verbindung — der Mail-Stand fehlt."); })
      .finally(() => { if (!aus) setLaedt(false); });
    return () => { aus = true; };
  }, [personId, runde]);
  return { daten, laedt, fehler, verlaufSetzen: (v) => setDaten((d) => (d ? { ...d, verlauf: v } : d)), neu: () => setRunde((n) => n + 1) };
}

/**
 * Gegenprüfung E-274 (02.10.2026): ein Teil des Blatts ins Bild holen — so wenig wie nötig, nur im Blatt
 * selbst (nicht die Seite dahinter). Gemessen auf 380 × 740 und 1280 × 800: Nach „Zahlungsdaten neu senden"
 * stand „Senden" 160–200 px unter der Kante, die Vorschau ganz darunter — gesehen hat man nichts davon.
 */
function insBild(el: HTMLElement | null): void {
  const huelle = el?.closest(".tk-blatt") as HTMLElement | null;
  if (!el || !huelle) return;
  const h = huelle.getBoundingClientRect();
  const e = el.getBoundingClientRect();
  const runter = e.bottom - h.bottom + 16;
  const hoch = e.top - h.top - 16;
  const um = runter > 0 ? Math.min(runter, Math.max(hoch, 0)) : hoch < 0 ? hoch : 0;
  if (!um) return;
  const ruhig = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  huelle.scrollBy({ top: um, behavior: ruhig ? "auto" : "smooth" });
}

/** Steht am Anfang des Textes schon eine Anrede? Die setzt der Server ein zweites Mal davor. */
const ANREDE_AM_ANFANG = /^\s*(hallo|hi|hey|servus|moin|grüß\s+gott|grüezi|guten\s+(tag|morgen|abend)|sehr\s+geehrte[rs]?|liebe[rs]?)\b/i;

/** Die Zustand-Wörter aus ZUSTELL_TEXT, die sagen, ob eine Mail ankam (nicht nur „gesendet"). */
const ZUSTELL_ENDSTAND = new Set(["zugestellt", "geöffnet", "geklickt", "blockiert", "unzustellbar", "als Spam gemeldet"]);

/** „59.99" (Rechnungs-PDF) → „59,99 €". */
function betragText(b: string | null | undefined): string {
  const n = Number(b);
  return Number.isFinite(n) && n > 0 ? euro(Math.round(n * 100)) : "";
}

function MailBlatt({ k, absender, onZu, onGesendet }: {
  k: KarteiKarte; absender: string; onZu: () => void; onGesendet: () => void;
}) {
  const lage = useMailLage(k.personId);
  // Nur Bequemlichkeit: Ein Tipp neben das Blatt (am iPhone schnell passiert) verliert den Entwurf nicht —
  // er bleibt auf diesem Gerät, bis die Mail raus ist.
  const entwurfSchluessel = `tk-mail-entwurf-${k.personId}`;
  // Gegenprüfung E-274: Der Entwurf merkt sich, zu welcher offenen Zahlung er geschrieben wurde. Ist sie
  // inzwischen eine andere (Rate bezahlt, nächste offen), gilt er nicht mehr — sonst ginge der alte
  // Verwendungszweck mit der Rechnung der neuen Zahlung raus.
  const zahlungJetzt = hatRechnungsweg(k) && k.zahlung ? k.zahlung.referenz : null;
  const [entwurf] = useState(() => {
    const e = lesen<{ betreff: string; text: string; anhang: boolean; ref?: string | null } | null>(entwurfSchluessel, null);
    if (e && (e.ref ?? null) !== zahlungJetzt) { loeschen(entwurfSchluessel); return null; }
    return e;
  });
  const [betreff, setBetreff] = useState(entwurf?.betreff ?? "");
  const [text, setText] = useState(entwurf?.text ?? "");
  const [anhang, setAnhang] = useState(entwurf?.anhang === true);
  // Die Schnellwahl merkt sich ihren Text in beiden Fassungen — der Haken tauscht ihn, solange du nichts geändert hast.
  const [vorlage, setVorlage] = useState<{ mit: string; ohne: string } | null>(null);
  const [vorschau, setVorschau] = useState<KarteiMailAntwort | null>(null);
  const [laeuft, setLaeuft] = useState<"vorschau" | "senden" | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [fertig, setFertig] = useState<KarteiMailAntwort | null>(null);
  const textFeld = useRef<HTMLTextAreaElement | null>(null);
  const tunZeile = useRef<HTMLDivElement | null>(null);
  const vorschauKasten = useRef<HTMLDivElement | null>(null);
  // Was nach dieser Runde ins Bild soll: die Knöpfe (nach der Schnellwahl) oder die Vorschau.
  const [zeigen, setZeigen] = useState<"tun" | "vorschau" | null>(null);
  useEffect(() => {
    if (fertig) return;
    if (betreff.trim() || text.trim()) schreiben(entwurfSchluessel, { betreff, text, anhang, ref: zahlungJetzt });
    else loeschen(entwurfSchluessel);
  }, [betreff, text, anhang, fertig, entwurfSchluessel, zahlungJetzt]);

  // Esc schließt nur dieses Blatt — auch über dem Akte-Fenster (Fang-Phase, danach kein zweiter Empfänger).
  useEffect(() => {
    const taste = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onZu(); } };
    window.addEventListener("keydown", taste, true);
    return () => window.removeEventListener("keydown", taste, true);
  }, [onZu]);
  useEffect(() => {
    const f = textFeld.current;
    if (!f) return;
    f.style.height = "auto";
    f.style.height = `${Math.min(Math.max(f.scrollHeight + 2, 180), Math.round(window.innerHeight * 0.5))}px`;
  }, [text, fertig]);
  // Nach der Höhe des Textfelds (Reihenfolge zählt): „Zahlungsdaten neu senden" holt „Senden" ins Bild,
  // „Vorschau" die Vorschau — so bleibt es bei zwei Tipps, ohne zu suchen.
  useEffect(() => {
    if (!zeigen) return;
    insBild(zeigen === "tun" ? tunZeile.current : vorschauKasten.current);
    setZeigen(null);
  }, [zeigen]);

  const d = lage.daten;
  // Die offene Zahlung kommt vom Server (mail-lage); solange er lädt, gilt die Karte.
  const zahlung = d ? d.zahlung : (hatRechnungsweg(k) ? k.zahlung : null);
  const empfaenger = d ? d.empfaenger : k.email;
  const anrede = d?.anrede ?? "";
  const vorname = k.vorname || k.name.split(" ")[0];
  const ohneAdresse = !!d && !d.empfaenger;
  const wand = useMemo(
    () => wandPruefen(`${betreff}\n${text}`, anhang && zahlung ? ["rechnung_anhaengen"] : []).filter((f) => f.art === "verboten" || f.art === "zusage"),
    [betreff, text, anhang, zahlung],
  );
  const hinweise: string[] = [];
  if (k.stopp) hinweise.push("Hat „STOPP“ bzw. „Keine Nachrichten mehr“ geschrieben — schreib nur, was er wirklich braucht.");
  if (k.werbungGesperrt) hinweise.push("Werbesperre — nur, was er braucht (Zahlungsdaten, Antwort auf seine Frage), kein Verkauf.");
  if (k.gesperrt) hinweise.push("Vertriebssperre — kein Verkauf.");
  if (k.lage === "storniert") hinweise.push("Storniert — die Mail geht trotzdem raus.");
  // Gegenprüfung E-274: Kam die letzte Mail nicht an (Brevo-Sperrliste, Abmelder, falsche Adresse), kommt diese
  // meist auch nicht an — das stand bisher nur rot ganz unten, unter „Senden" und dem grünen „Gesendet an …".
  const letzteZustellung = d?.verlauf.find((z) => ZUSTELL_ENDSTAND.has(z.stand));
  if (letzteZustellung?.ton === "warn") {
    hinweise.push(`Die letzte Mail an ${vorname} kam nicht an (Brevo: „${letzteZustellung.stand}“${letzteZustellung.grund ? ` — ${letzteZustellung.grund}` : ""}). `
      + "Diese wahrscheinlich auch nicht — lieber anrufen oder die Adresse prüfen.");
  }
  const anredeDoppelt = ANREDE_AM_ANFANG.test(text);

  const schnellwahl = () => {
    if (!zahlung) return;
    const karte = { ...k, zahlung };
    const mit = mailZahlungsdaten(karte, d?.absender || absender, true);
    const ohne = mailZahlungsdaten(karte, d?.absender || absender, false);
    if (!mit || !ohne) return;
    setBetreff(mit.betreff); setText(mit.text); setAnhang(true);
    setVorlage({ mit: mit.text, ohne: ohne.text });
    setVorschau(null); setFehler(null);
    setZeigen("tun");
  };
  const anhangUmschalten = (an: boolean) => {
    setAnhang(an); setVorschau(null);
    if (vorlage && text === (an ? vorlage.ohne : vorlage.mit)) setText(an ? vorlage.mit : vorlage.ohne);
  };
  const aendern = (feld: "betreff" | "text", wert: string) => {
    if (feld === "betreff") setBetreff(wert); else setText(wert);
    setVorschau(null); setFehler(null);
  };
  const koerper = () => JSON.stringify({ betreff, text, ...(anhang && zahlung ? { anhangReferenz: zahlung.referenz } : {}) });
  const bereit = !!betreff.trim() && !!text.trim() && wand.length === 0 && !ohneAdresse;

  const ansehen = async () => {
    if (!bereit || laeuft) return;
    setLaeuft("vorschau"); setFehler(null);
    try {
      const r = await fetch(`${API}/chef/telefonkartei/${k.personId}/mail/vorschau`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: koerper(),
      });
      const j: KarteiMailAntwort | null = await r.json().catch(() => null);
      if (!j?.ok || !j.vorschau) { setFehler(j?.meldung || "Die Vorschau ging nicht."); return; }
      setVorschau(j);
      setZeigen("vorschau");
    } catch {
      setFehler("Keine Verbindung — bitte noch einmal.");
    } finally {
      setLaeuft(null);
    }
  };
  const senden = async () => {
    if (!bereit || laeuft) return;
    setLaeuft("senden"); setFehler(null);
    try {
      const r = await fetch(`${API}/chef/telefonkartei/${k.personId}/mail`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: koerper(),
      });
      const j: KarteiMailAntwort | null = await r.json().catch(() => null);
      if (j?.verlauf) lage.verlaufSetzen(j.verlauf);
      if (!j?.ok) { setFehler(j?.meldung || "Die Mail ging nicht raus."); return; }
      setFertig(j);
      loeschen(entwurfSchluessel);
      if (!j.doppelt) onGesendet();
    } catch {
      setFehler("Keine Verbindung — ob die Mail rausging, steht gleich unter „Zuletzt an …“. Bitte erst dort nachsehen.");
      // Gegenprüfung E-274: „steht gleich unter …" — dann muss der Stand auch neu kommen (kurz warten, bis der Server schrieb).
      window.setTimeout(lage.neu, 1500);
    } finally {
      setLaeuft(null);
    }
  };
  const nochEine = () => {
    setFertig(null); setBetreff(""); setText(""); setAnhang(false); setVorlage(null); setVorschau(null); setFehler(null);
  };

  const anhangZeile = (a: KarteiMailAntwort) => {
    if (!a.anhang) return null;
    const betrag = betragText(a.anhang.betrag);
    return a.anhangBeimSenden
      ? `Rechnung als PDF${betrag ? ` über ${betrag}` : ""} — wird beim Senden gestellt`
      : `Rechnung ${a.anhang.rechnungsnummer}${betrag ? ` über ${betrag}` : ""} (PDF)`;
  };

  return (
    <div className="tk-schleier" role="dialog" aria-modal="true" aria-label={`E-Mail an ${k.name}`} onClick={onZu}>
      <div className="tk-blatt tk-nb tk-mail" onClick={(e) => e.stopPropagation()}>
        <div className="tk-nb-kopf">
          <div className="tk-nb-titel">
            <span>E-Mail</span>
            <b>{k.name}</b>
          </div>
          <button type="button" className="tk-nb-rund" onClick={onZu} aria-label="Schließen">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
          </button>
        </div>

        <p className="tk-nb-wa">
          {ohneAdresse
            ? <>Für den Versand ist keine E-Mail-Adresse hinterlegt.{k.email ? ` Die Karte kennt ${k.email} aus dem Lead — trag sie in der Akte ein.` : ""}</>
            : <>An <b className="tk-mail-an">{empfaenger || "…"}</b> · von FIAON (welcome@fiaon.com). Kein Gesprächsergebnis, keine WhatsApp.</>}
        </p>
        {hinweise.length > 0 && <ul className="tk-ki-hinweise tk-mail-hinweise">{hinweise.map((h) => <li key={h}>{h}</li>)}</ul>}

        {fertig ? (
          <div className="tk-mail-fertig" role="status">
            <span className="tk-mail-haken" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m6 12.5 4 4 8-9" /></svg></span>
            <div>
              <b>{fertig.doppelt ? "Schon gesendet" : fertig.meldung}</b>
              <span>{fertig.doppelt ? fertig.meldung : `„${betreff.trim()}“${fertig.anhang ? ` · ${anhangZeile(fertig)}` : ""}`}</span>
              {!fertig.doppelt && <span>Steht im Verlauf der Akte. Stand jetzt: „gesendet“ — zugestellt oder geöffnet siehst du unten.</span>}
            </div>
          </div>
        ) : !ohneAdresse && (
          <>
            {zahlung && (
              <>
                <p className="tk-blatt-label">Schnellwahl</p>
                <button type="button" className="tk-nb-fall gruen tk-mail-schnell" onClick={schnellwahl}>
                  <span className="tk-nb-zeichen" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d="M7 3.5h7l4 4v13H7z" /><path d="M14 3.5v4h4M9.5 12.5h6M9.5 15.5h4" /></svg>
                  </span>
                  <span className="tk-nb-text">
                    <b>Zahlungsdaten neu senden</b>
                    <small>
                      {[zahlung.betragCents != null ? euro(zahlung.betragCents) : null, `Verwendungszweck ${zahlung.referenz}`, "Zahlungsseite", "Rechnung als PDF"].filter(Boolean).join(" · ")}
                    </small>
                  </span>
                  <Pfeil />
                </button>
              </>
            )}

            <label className="tk-blatt-label tk-mail-label" htmlFor={`tk-mail-betreff-${k.personId}`}>Betreff</label>
            <input id={`tk-mail-betreff-${k.personId}`} className="tk-feld" value={betreff} maxLength={KARTEI_MAIL_BETREFF_MAX}
                   onChange={(e) => aendern("betreff", e.target.value)} placeholder="Worum geht es?" />
            <label className="tk-blatt-label tk-mail-label" htmlFor={`tk-mail-text-${k.personId}`}>Text</label>
            <div className="tk-mail-text">
              <span className="tk-mail-anrede" title="Setzt das System automatisch davor">{anrede || (lage.laedt ? "Anrede wird geladen …" : "Guten Tag,")}</span>
              <textarea id={`tk-mail-text-${k.personId}`} ref={textFeld} value={text} maxLength={KARTEI_MAIL_TEXT_MAX} rows={7}
                        onChange={(e) => aendern("text", e.target.value)}
                        placeholder={`Was soll ${vorname} lesen? Die Anrede oben steht schon davor.`} />
            </div>
            <p className="tk-mail-klein">Die Anrede steht automatisch davor — Kopf, Fuß und Pflichtangaben setzt das FIAON-Gerüst.</p>
            {/* Gegenprüfung E-274: Der Server setzt die Anrede IMMER davor — „Hallo Herr …" am Anfang stünde doppelt in der Mail. */}
            {anredeDoppelt && (
              <ul className="tk-ki-hinweise tk-mail-doppelt">
                <li>Dein Text beginnt mit einer Anrede — „{anrede || "Guten Tag …,"}“ steht schon davor, in der Mail stünden zwei. Nimm deine erste Zeile raus.</li>
              </ul>
            )}

            {zahlung && (
              <label className="tk-mail-anhang">
                <input type="checkbox" checked={anhang} onChange={(e) => anhangUmschalten(e.target.checked)} />
                <span>
                  Rechnung als PDF anhängen
                  <small>
                    {[zahlung.referenz, zahlung.betragCents != null ? euro(zahlung.betragCents) : null,
                      zahlung.art === "bestellung" && zahlung.nochKeineRechnung ? "wird beim Senden gestellt" : null].filter(Boolean).join(" · ")}
                  </small>
                </span>
              </label>
            )}

            {wand.length > 0 && (
              <ul className="tk-ki-hinweise">
                {wand.map((f, i) => <li key={i}>Die Wortwand hält „{f.treffer}“ auf — {f.hinweis}</li>)}
              </ul>
            )}
            {fehler && <p className="tk-ki-fehler" role="alert">{fehler}</p>}

            <div className="tk-blatt-tun" ref={tunZeile}>
              <button type="button" className="tk-knopf still" disabled={!bereit || !!laeuft} onClick={() => void ansehen()}>
                {laeuft === "vorschau" ? "Vorschau lädt …" : "Vorschau"}
              </button>
              <button type="button" className="tk-knopf blau" disabled={!bereit || !!laeuft} onClick={() => void senden()}>
                {laeuft === "senden" ? "Wird gesendet …" : "Senden"}
              </button>
            </div>

            {vorschau?.vorschau && (
              <div className="tk-mail-vorschau" ref={vorschauKasten}>
                <p>
                  <b>An:</b> {vorschau.empfaenger} · <b>Von:</b> {vorschau.vorschau.absender}<br />
                  <b>Betreff:</b> „{vorschau.vorschau.betreff}“
                  {vorschau.anhang && <><br /><b>Anhang:</b> {anhangZeile(vorschau)}</>}
                </p>
                <iframe title="So kommt die Mail an" srcDoc={vorschau.vorschau.html} sandbox="" />
              </div>
            )}
          </>
        )}

        {fertig && (
          <div className="tk-blatt-tun">
            <button type="button" className="tk-knopf blau" onClick={onZu}>Fertig</button>
            <button type="button" className="tk-knopf still" onClick={nochEine}>Noch eine E-Mail</button>
          </div>
        )}

        <MailVerlauf zeilen={d?.verlauf ?? []} laedt={lage.laedt} fehler={lage.fehler} vorname={vorname} />
      </div>
    </div>
  );
}

/** Die letzten Mails an diesen Menschen — mit dem Stand aus dem Mail-Protokoll (E-274). */
function MailVerlauf({ zeilen, laedt, fehler, vorname }: { zeilen: KarteiMailZeile[]; laedt: boolean; fehler: string | null; vorname: string }) {
  return (
    <section className="tk-mail-verlauf" aria-label={`Zuletzt an ${vorname}`}>
      <p className="tk-nb-trenner"><span>Zuletzt an {vorname}</span></p>
      {laedt && !zeilen.length ? <p className="tk-klein">Lädt …</p>
        : fehler && !zeilen.length ? <p className="tk-klein">{fehler}</p>
        : !zeilen.length ? <p className="tk-klein">Noch keine Mail im Protokoll.</p>
        : (
          <ul>
            {zeilen.map((z) => (
              <li key={z.id}>
                <div className="tk-mv-was">
                  <b>{z.betreff}</b>
                  <span>{tagName(z.am)}, {uhr(z.am)} · {z.von}{z.mitAnhang ? " · mit Rechnung" : ""}</span>
                  {z.grund && <span className="tk-mv-grund">{z.grund}</span>}
                </div>
                <span className={`tk-mv-stand ${z.ton}`}>{z.stand}</span>
              </li>
            ))}
          </ul>
        )}
      <p className="tk-mail-klein">{KARTEI_MAIL_ZUSTELL_SATZ}</p>
    </section>
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
