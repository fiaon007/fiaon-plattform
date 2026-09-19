// ═══════════════════════════════════════════════════════════════════════════
// /agent/global/:ref — DIE AKTE EINES GLOBAL-AUFTRAGS (17.09.2026, E-188)
//
// Das Werkzeug der zuständigen Person. Was die Pakete dem Unternehmen
// versprechen — Dokumentenraum, Pflichtenkalender, fester Ansprechpartner,
// monatlicher Durchgang —, wird HIER geliefert; der Kunde sieht es auf seiner
// Seite „Mein Auftrag". Zwei Spalten: links die Arbeit (die eine Glasfläche,
// vier Reiter), rechts der Zusammenhang (matt).
//
//   Kopf      Firma, Paket, Preis, Stand, Zahlung · Anrufen, E-Mail,
//             Kundenansicht öffnen, Zugang senden
//   Stand     Etappen-Leiste + Dialog „Etappe setzen" (Text für den Kunden,
//             Haken „Kunden benachrichtigen") · nächster Schritt · Stichtag
//   Gesellschaft & Pflichten
//             Name, Form, Bundesstaat, Gründungsdatum, EIN, ITIN → der Server
//             setzt daraus die Regel-Fristen · Pflichtenkalender mit Haken,
//             eigene Fristen anlegen, ändern, löschen
//   Dokumente Unterlagen-Checkliste (was fehlt) · Upload mit Art und „für den
//             Kunden sichtbar" · beide Richtungen mit Ansehen und Löschen
//   Verlauf   Notiz (intern oder für den Kunden sichtbar) · alle Einträge
//   Rechts    Kontakt, Firmendaten, USt-IdNr., Vertrag/Rechnung, der Kasten
//             „Was ich dem Kunden NICHT zusage", Auftrag abschließen
//   19.09.2026 (E-196): Hat der Kunde die Jahresbetreuung angekreuzt, trägt der
//             Kopf die Marke „Jahresbetreuung gebucht (ab Jahr 2)"; unter
//             „Vertrag und Rechnung" steht, ab wann die Rechnung fürs zweite
//             Jahr gestellt wird (die Aufgabe dazu legt der Tageslauf an).
//
// ── DREI FESTE REGELN DIESER SEITE ─────────────────────────────────────────
// 1. NICHTS WIRD VORAB BEHAUPTET. Der Bildschirm ändert sich erst, wenn der
//    Server „ok" gesagt hat; danach lädt die Akte leise nach. Jede Aktion
//    meldet, was passiert ist — oder warum nicht.
// 2. WAS DER KUNDE LIEST, WIRD BEIM SCHREIBEN GEPRÜFT. Etappen-Text, nächster
//    Schritt, sichtbare Notiz: Die Wortwand (shared/fiaon-wortverbote.ts) und
//    die schärferen Global-Regeln (shared/fiaon-global-wortregeln.ts) laufen
//    mit. Ein Hinweis, keine Sperre — den Zusammenhang kennt der Mensch.
// 3. KEIN FELD IST PFLICHT FÜR DEN BILDSCHIRM. Der Server zu dieser Seite
//    entstand gleichzeitig in einem anderen Zweig; global-logik.ts liest jede
//    Antwort so, dass ein fehlendes Feld eine leere Stelle ist, kein Absturz.
//
// Der Mitarbeiter wird geduzt, der Kunde gesiezt. Über Konto, Karte, Rahmen
// und Darlehen entscheidet immer das Institut; Steuer- und Rechtsfragen
// beantworten Steuerberater und Anwälte auf eigenes Mandat — FIAON koordiniert.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Link, useRoute } from "wouter";
import { AgentShell, ConfirmDialog, api, inputCls, useFragen } from "./shared";
import { useOffice } from "./OfficeShell";
import { ToastAnbieter, useToast } from "@/lib/fiaon-ui";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "./rundgaenge";
import {
  type GlobalAkte, type GlobalFrist, type GlobalVerlaufZeile, JAHRESBETREUUNG_MARKE,
  akteLesen, STATUS_TEXT, etappenImPaket, etappeKundentext, kundenPlatzhalter, kundentextHinweise, nichtZusagen,
  tagText, zeitText, fristLage, groesseText, euroText, berlinTag, tageBis, dateiPruefen, UPLOAD_ERLAUBT,
  US_STAATEN, staatName, FIRMA_FELDER, LAND_NAME, VERLAUF_ART, telLink,
} from "./global-logik";
import "@/styles/office-pipeline.css";
import "@/styles/office-rundgang.css";
import "@/styles/office-global.css";

type Zustand = "laedt" | "ok" | "kein_zugriff" | "nicht_da" | "fehler";
type Reiter = "stand" | "gesellschaft" | "dokumente" | "verlauf";
const REITER: [Reiter, string][] = [["stand", "Stand"], ["gesellschaft", "Gesellschaft & Pflichten"], ["dokumente", "Dokumente"], ["verlauf", "Verlauf"]];

interface TunWahl { method?: "POST" | "DELETE"; body?: unknown; gut: string; gutText?: string; lokal?: (a: GlobalAkte) => GlobalAkte }
type Tun = (schluessel: string, pfad: string, wahl: TunWahl) => Promise<boolean>;
interface Werk { akte: GlobalAkte; tun: Tun; laeuft: string | null; heute: string; frisch: () => void }

export default function AgentGlobalAktePage() {
  return <AgentShell><ToastAnbieter ton="dunkel"><AkteInnen /></ToastAnbieter></AgentShell>;
}

/** Was der Server NICHT in Worte gefasst hat, sagt die Seite selbst. */
function statusSatz(status: number): string {
  if (status === 403) return "Dafür hast du bei diesem Auftrag keinen Zugriff.";
  if (status === 404) return "Diesen Schritt kennt der Server noch nicht — er kommt mit dem Start von FIAON Global.";
  if (status === 413) return "Die Datei ist dem Server zu groß — erlaubt sind 15 MB.";
  if (status === 0) return "Keine Verbindung zum Server. Es wurde nichts gespeichert.";
  return "Das hat gerade nicht geklappt. Es wurde nichts gespeichert — bitte noch einmal.";
}

/** Hinweise der Wortwand zu einem Satz, der an den Kunden geht. */
function WandHinweise({ text }: { text: string }) {
  const funde = useMemo(() => kundentextHinweise(text), [text]);
  if (!funde.length) return null;
  return (
    <ul className="gl-wand" role="status" aria-live="polite">
      <li><b>Dieser Satz geht an den Kunden — bitte prüfen:</b></li>
      {funde.map((f, i) => <li key={i}>„{f.treffer}“ — {f.hinweis}</li>)}
    </ul>
  );
}

function AkteInnen() {
  const { dunkel, titel } = useOffice();
  const { zeige } = useToast();
  const [, params] = useRoute("/agent/global/:ref");
  // Eine kaputte Adresse (halbes %-Zeichen) darf die Seite nicht werfen — dann gilt, was dasteht.
  const ref = useMemo(() => { const roh = String(params?.ref || ""); try { return decodeURIComponent(roh).trim(); } catch { return roh.trim(); } }, [params?.ref]);
  useEffect(() => { dunkel(true); titel("FIAON Global"); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [zustand, setZustand] = useState<Zustand>("laedt");
  const [fehlerText, setFehlerText] = useState("");
  const [akte, setAkte] = useState<GlobalAkte | null>(null);
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [reiter, setReiter] = useState<Reiter>("stand");
  const heute = useMemo(() => berlinTag(), []);
  const basis = `/agent/global/auftraege/${encodeURIComponent(ref)}`;

  const laden = useCallback(async (leise = false) => {
    if (!ref) { setFehlerText("In der Adresse fehlt die Referenz des Auftrags."); setZustand("fehler"); return; }
    if (!leise) setZustand("laedt");
    try {
      const r = await api(`/agent/global/auftraege/${encodeURIComponent(ref)}`);
      const gelesen = r.ok ? akteLesen(r.json) : null;
      if (gelesen) { setAkte(gelesen); setZustand("ok"); return; }
      if (leise) return; // Das leise Nachladen darf eine offene Akte nie gegen eine Fehlerseite tauschen.
      if (r.status === 403) setZustand("kein_zugriff");
      else if (r.status === 404) { setFehlerText(String(r.json?.error || "")); setZustand("nicht_da"); }
      else { setFehlerText(String(r.json?.error || (r.ok ? "Die Antwort des Servers enthält keinen Auftrag." : ""))); setZustand("fehler"); }
    } catch {
      if (!leise) { setFehlerText("Keine Verbindung zum Server."); setZustand("fehler"); }
    }
  }, [ref]);
  useEffect(() => { void laden(); }, [laden]);

  const tun: Tun = useCallback(async (schluessel, pfad, wahl) => {
    setLaeuft(schluessel);
    try {
      const r = await api(`${basis}${pfad}`, { method: wahl.method ?? "POST", body: wahl.method === "DELETE" ? undefined : JSON.stringify(wahl.body ?? {}) });
      if (!r.ok) { zeige("fehler", "Nicht gespeichert", String(r.json?.error || statusSatz(r.status))); return false; }
      if (wahl.lokal) setAkte((a) => (a ? wahl.lokal!(a) : a));
      zeige("erfolg", wahl.gut, String(r.json?.meldung || wahl.gutText || ""));
      void laden(true);
      return true;
    } catch {
      zeige("fehler", "Nicht gespeichert", statusSatz(0));
      return false;
    } finally { setLaeuft(null); }
  }, [basis, laden, zeige]);

  // Pfeiltasten wechseln den Reiter UND nehmen den Fokus mit (Muster für Reiter nach WAI-ARIA). Der Fokus
  // folgt in einem Effekt nach dem Neuzeichnen — nicht über requestAnimationFrame, das in einem Fenster im
  // Hintergrund gar nicht läuft.
  const fokusFolgt = useRef(false);
  const reiterTaste = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = REITER.findIndex(([k]) => k === reiter);
    const ziel = e.key === "ArrowRight" ? (i + 1) % REITER.length : e.key === "ArrowLeft" ? (i + REITER.length - 1) % REITER.length : e.key === "Home" ? 0 : e.key === "End" ? REITER.length - 1 : -1;
    if (ziel < 0) return;
    e.preventDefault();
    fokusFolgt.current = true;
    setReiter(REITER[ziel][0]);
  };
  useEffect(() => {
    if (!fokusFolgt.current) return;
    fokusFolgt.current = false;
    document.getElementById(`gl-reiter-${reiter}`)?.focus();
  }, [reiter]);

  if (zustand !== "ok" || !akte) {
    return (
      <div className="gl" data-fiaon="global-akte">
        <header className="gl-kopf"><Link href="/agent/global" className="gl-zurueck">← Alle Global-Aufträge</Link></header>
        {zustand === "laedt" && <div className="gl-glas gl-tafel" aria-busy="true" aria-label="Die Akte wird geladen"><div className="gl-liste">{[0, 1, 2].map((i) => <div key={i} className="gl-skelett" />)}</div></div>}
        {zustand === "kein_zugriff" && (
          <div className="gl-glas gl-still" role="status">
            <b>Dieser Auftrag liegt bei jemand anderem.</b>
            <p>Die Akte sieht nur die zuständige Person und die Vertriebsleitung. Hat sich das Unternehmen bei dir gemeldet, gib es an die zuständige Person weiter.</p>
            <Link href="/agent/global" className="pi-knopf still">Zur Liste</Link>
          </div>
        )}
        {zustand === "nicht_da" && (
          <div className="gl-glas gl-still" role="status">
            <b>Zu dieser Referenz gibt es keinen Global-Auftrag.</b>
            <p>{fehlerText || "Vielleicht ist der Link alt oder unvollständig."} In der Liste findest du alle Aufträge, für die du zuständig bist.</p>
            <Link href="/agent/global" className="pi-knopf still">Zur Liste</Link>
          </div>
        )}
        {zustand === "fehler" && (
          <div className="gl-glas gl-still" role="alert">
            <b>Die Akte lässt sich gerade nicht laden.</b>
            <p>{fehlerText || "Der Server hat nicht geantwortet."} Es ist nichts verloren.</p>
            <button type="button" className="pi-knopf" onClick={() => void laden()}>Noch einmal laden</button>
          </div>
        )}
      </div>
    );
  }

  const werk: Werk = { akte, tun, laeuft, heute, frisch: () => void laden(true) };
  const offeneUnterlagen = akte.unterlagen.filter((u) => !u.vorhanden).length;
  const offeneFristen = akte.fristen.filter((f) => !f.erledigt).length;
  const marke: Record<Reiter, string> = {
    stand: "", gesellschaft: offeneFristen ? String(offeneFristen) : "", dokumente: offeneUnterlagen ? `${offeneUnterlagen} fehlen` : "",
    verlauf: "",
  };

  return (
    <div className="gl" data-fiaon="global-akte">
      <Kopf {...werk} />
      <div className="gl-spalten">
        <section className="gl-glas gl-arbeit" aria-label="Arbeit am Auftrag">
          <div className="gl-reiter" role="tablist" aria-label="Bereiche der Akte" onKeyDown={reiterTaste}>
            {REITER.map(([k, t]) => (
              <button key={k} type="button" role="tab" id={`gl-reiter-${k}`} className="gl-chip" data-reiter={k}
                      aria-selected={reiter === k} aria-controls={`gl-panel-${k}`} tabIndex={reiter === k ? 0 : -1}
                      onClick={() => setReiter(k)}>{t}{marke[k] && <em>{marke[k]}</em>}</button>
            ))}
          </div>
          <div className="gl-panel" role="tabpanel" id="gl-panel-stand" aria-labelledby="gl-reiter-stand" hidden={reiter !== "stand"}>
            <EtappenAbschnitt {...werk} /><SchrittAbschnitt {...werk} /><StichtagAbschnitt {...werk} />
          </div>
          <div className="gl-panel" role="tabpanel" id="gl-panel-gesellschaft" aria-labelledby="gl-reiter-gesellschaft" hidden={reiter !== "gesellschaft"}>
            <GesellschaftAbschnitt {...werk} /><FristenAbschnitt {...werk} />
          </div>
          <div className="gl-panel" role="tabpanel" id="gl-panel-dokumente" aria-labelledby="gl-reiter-dokumente" hidden={reiter !== "dokumente"}>
            <DokumenteAbschnitt {...werk} basis={basis} />
          </div>
          <div className="gl-panel" role="tabpanel" id="gl-panel-verlauf" aria-labelledby="gl-reiter-verlauf" hidden={reiter !== "verlauf"}>
            <VerlaufAbschnitt {...werk} />
          </div>
        </section>
        <Kontext {...werk} />
      </div>
      <Rundgang raum="global-akte" titel={RUNDGAENGE.globalAkte.titel} schritte={RUNDGAENGE.globalAkte.schritte} />
    </div>
  );
}

// ═══ (a) DER KOPF ════════════════════════════════════════════════════════════
function Kopf({ akte, tun, laeuft }: Werk) {
  const fragen = useFragen();
  const [standText, ton] = STATUS_TEXT[akte.status];
  const k = akte.kontakt;
  const name = [k.anrede, k.vorname, k.nachname].filter(Boolean).join(" ");
  const zugangSenden = async () => {
    if (!(await fragen({
      titel: "Zugang an den Kunden senden?",
      text: `${name || "Der Kunde"} bekommt eine E-Mail mit einem frischen Link zu „Mein Auftrag“${k.email ? ` an ${k.email}` : ""}.`,
      folge: "Der alte Link bleibt gültig, bis er abläuft. Nutze das, wenn der Kunde seinen Link nicht mehr findet oder er abgelaufen ist.",
      ja: "Zugang senden",
    }))) return;
    await tun("zugang", "/zugang-senden", { gut: "Zugang ist unterwegs", gutText: "Die E-Mail mit dem Link ist an den Kunden gegangen." });
  };
  return (
    <header className="gl-akte-kopf">
      <Link href="/agent/global" className="gl-zurueck">← Alle Global-Aufträge</Link>
      <div className="gl-akte-titel">
        <h1>{akte.firma.name}</h1>
        <span className={`pi-marke ${ton}`}>{standText}</span>
        <span className={`pi-marke ${akte.zahlung.status === "bezahlt" ? "gut" : "warn"}`}>{akte.zahlung.status === "bezahlt" ? "Zahlung eingegangen" : "Zahlung offen"}</span>
        {akte.sprache === "en" && <span className="pi-marke still" title="Der Kunde hat auf der englischen Seite unterschrieben — schreib ihm auf Englisch.">Kunde liest Englisch</span>}
        {akte.auftraggeber === "privat" && <span className="pi-marke still" title="Beauftragt als Privatperson: Vertrag mit Widerrufsbelehrung, Preis als Endpreis, kein Registerauszug.">Privatperson</span>}
        {/* E-196: im Auftrag angekreuzt — Einzelheiten rechts unter „Vertrag und Rechnung“. */}
        {akte.jahresbetreuung.gebucht && <span className="pi-marke gut" title="Im Auftrag angekreuzt: Jahresbetreuung ab dem zweiten Jahr, alle Gebühren inklusive. Die Rechnung für das zweite Betreuungsjahr kommt rund einen Monat vor dem ersten Jahrestag als Aufgabe.">{JAHRESBETREUUNG_MARKE}</span>}
        {akte.widerruf && (akte.widerruf.sofortBeginn
          ? <span className="pi-marke still" title="Der Kunde hat ausdrücklich verlangt, dass wir vor Ablauf der Widerrufsfrist beginnen. Widerruft er, zahlt er anteilig.">{`Widerruf bis ${tagText(akte.widerruf.fristEnde)} · sofort beginnen`}</span>
          : <span className={`pi-marke ${berlinTag() < akte.widerruf.startAb ? "warn" : "still"}`} title="Kein Wunsch nach sofortigem Beginn: Vor dem Starttag nichts beantragen und keine Gebühren auslösen. Der Auftrag startet am Starttag von selbst.">{`Widerruf bis ${tagText(akte.widerruf.fristEnde)} · Start ab ${tagText(akte.widerruf.startAb)}`}</span>)}
      </div>
      <div className="gl-akte-unter">
        <b>{akte.paketName}</b>
        <span>{akte.betragCents != null ? `${euroText(akte.betragCents)} einmalig` : "Preis laut Rechnung"}</span>
        <span>{[akte.firma.ort, LAND_NAME[akte.firma.land] ?? akte.firma.land].filter(Boolean).join(" · ")}</span>
        <span className="gl-mono">{akte.ref}</span>
        {akte.zahlung.status === "offen" && akte.zahlung.zahlungsseite && <a className="gl-textknopf" href={akte.zahlung.zahlungsseite} target="_blank" rel="noopener noreferrer">Zahlungsseite des Kunden</a>}
      </div>
      <div className="gl-knoepfe">
        {k.telefon
          ? <a className="pi-knopf" href={telLink(k.telefon)}>Anrufen</a>
          : <span className="pi-knopf" aria-disabled="true" title="Im Auftrag steht keine Telefonnummer.">Anrufen</span>}
        {k.email
          ? <a className="pi-knopf still" href={`mailto:${k.email}`}>E-Mail</a>
          : <span className="pi-knopf still" aria-disabled="true" title="Im Auftrag steht keine E-Mail-Adresse.">E-Mail</span>}
        {akte.kundenLink
          ? <a className="pi-knopf still" href={akte.kundenLink} target="_blank" rel="noopener noreferrer">Kundenansicht öffnen</a>
          : <span className="pi-knopf still" aria-disabled="true" title="Der Server hat keinen Link zur Kundenansicht mitgegeben.">Kundenansicht öffnen</span>}
        <button type="button" className="pi-knopf still" disabled={laeuft === "zugang" || !k.email} onClick={() => void zugangSenden()}>{laeuft === "zugang" ? "Sende …" : "Zugang senden"}</button>
      </div>
    </header>
  );
}

// ═══ (b) DIE ETAPPE ══════════════════════════════════════════════════════════
function EtappenAbschnitt({ akte, tun, laeuft }: Werk) {
  const [dialog, setDialog] = useState<{ etappe: number; text: string; mitteilen: boolean; angefasst: boolean } | null>(null);
  // Stabil halten: ConfirmDialog setzt bei jedem neuen onCancel den Fokus neu — mit einer
  // frischen Funktion je Tastendruck spränge der Zeiger beim Tippen aus dem Textfeld.
  const zu = useCallback(() => setDialog(null), []);
  const reicht = etappenImPaket(akte.paket);
  const zuEnde = akte.status === "abgeschlossen" || akte.status === "storniert";
  const oeffnen = (nr: number) => setDialog({ etappe: nr, text: etappeKundentext(nr, akte.sprache), mitteilen: true, angefasst: false });
  const setzen = async () => {
    if (!dialog) return;
    const { etappe, text, mitteilen } = dialog;
    const ok = await tun("etappe", "/etappe", {
      body: { etappe, text: text.trim() || undefined, mitteilen },
      gut: `Etappe ${etappe} gesetzt`, gutText: mitteilen ? "Der Kunde hat die E-Mail bekommen und sieht den Eintrag in seinem Verlauf." : "Ohne E-Mail. Der Eintrag steht im Verlauf des Kunden.",
      lokal: (a) => ({ ...a, etappe, etappen: a.etappen.map((e) => ({ ...e, stand: e.nr < etappe ? "fertig" : e.nr === etappe ? "jetzt" : "offen" })) }),
    });
    if (ok) setDialog(null);
  };
  return (
    <div className="gl-ab gl-ab-etappe">
      <div className="gl-ab-kopf">
        <h2>Etappe</h2>
        <button type="button" className="pi-knopf klein" disabled={zuEnde} onClick={() => oeffnen(Math.min(4, Math.max(1, akte.etappe + (akte.etappe >= 4 ? 0 : 1))))}>Etappe setzen</button>
      </div>
      <div className="gl-etappen">
        {akte.etappen.filter((e) => e.nr >= 1 && e.nr <= 4).map((e) => (
          <button key={e.nr} type="button" className={`gl-etappe ${e.stand}${e.nr > reicht ? " ausser" : ""}`} disabled={zuEnde}
                  aria-label={`Etappe ${e.nr}: ${e.titel} — ${e.stand === "fertig" ? "abgeschlossen" : e.stand === "jetzt" ? "läuft" : "folgt"}. Klicken, um diese Etappe zu setzen.`}
                  onClick={() => oeffnen(e.nr)}>
            <small>Etappe {e.nr}</small>
            <b>{e.titel}</b>
            <span>{e.stand === "fertig" ? "abgeschlossen" : e.stand === "jetzt" ? `läuft${e.seit ? ` seit ${tagText(e.seit)}` : ""}` : e.nr > reicht ? "nicht im Paket" : "folgt"}</span>
          </button>
        ))}
      </div>
      <p className="gl-leise">
        {akte.etappe === 0 ? "Noch vor Etappe 1 — der Auftrag ist angelegt. " : akte.etappe >= 5 ? "Alle Etappen sind abgeschlossen. " : ""}
        {akte.paketName} reicht bis Etappe {reicht}{reicht < 4 ? " — ist sie geliefert, schließt du den Auftrag rechts ab" : ""}. Der Kunde sieht dieselbe Leiste auf seiner Seite; jede Änderung steht mit deinem Text in seinem Verlauf.
      </p>

      {dialog && createPortal(
        <ConfirmDialog open title="Etappe setzen" message={`${akte.firma.name} — der Kunde sieht die Etappe sofort auf seiner Seite.`}
                       consequence={dialog.mitteilen ? "Der Kunde bekommt eine E-Mail mit diesem Text. Der Eintrag steht danach in seinem Verlauf." : "Keine E-Mail. Der Eintrag steht trotzdem im Verlauf des Kunden."}
                       confirmLabel="Etappe setzen" busy={laeuft === "etappe"} onConfirm={() => void setzen()} onCancel={zu}>
          <div className="gl-dialog">
            <label>Etappe
              <select className={inputCls} value={dialog.etappe}
                      onChange={(e) => { const nr = Number(e.target.value); setDialog((d) => (d ? { ...d, etappe: nr, text: d.angefasst ? d.text : etappeKundentext(nr, akte.sprache) } : d)); }}>
                {akte.etappen.filter((e) => e.nr <= 4).map((e) => <option key={e.nr} value={e.nr}>{e.nr === 0 ? "0 · " : `${e.nr} · `}{e.titel}{e.nr > reicht ? " (nicht im Paket)" : ""}</option>)}
              </select>
            </label>
            <label>Text für den Kunden {akte.sprache === "en" ? "(Englisch)" : "(Sie-Form)"}
              <textarea className={inputCls} value={dialog.text} maxLength={1200}
                        onChange={(e) => setDialog((d) => (d ? { ...d, text: e.target.value, angefasst: true } : d))} />
            </label>
            <p>Sag, was FIAON gerade tut. Keine Frist, keine Zusage zu Konto, Karte, Rahmen oder Darlehen — darüber entscheidet das Institut.</p>
            <WandHinweise text={dialog.text} />
            <label className="haken">
              <input type="checkbox" checked={dialog.mitteilen} onChange={(e) => setDialog((d) => (d ? { ...d, mitteilen: e.target.checked } : d))} />
              Kunden benachrichtigen (E-Mail)
            </label>
          </div>
        </ConfirmDialog>, document.body)}
    </div>
  );
}

// ═══ (c) DER NÄCHSTE SCHRITT ═════════════════════════════════════════════════
function SchrittAbschnitt({ akte, tun, laeuft, heute }: Werk) {
  const [text, setText] = useState(akte.naechsterSchritt?.text ?? "");
  const [bis, setBis] = useState(akte.naechsterSchritt?.bis ?? "");
  // Nur wenn sich der gespeicherte Stand ändert — ein leises Nachladen überschreibt nichts, was du gerade tippst.
  useEffect(() => { setText(akte.naechsterSchritt?.text ?? ""); setBis(akte.naechsterSchritt?.bis ?? ""); }, [akte.naechsterSchritt?.text, akte.naechsterSchritt?.bis]);
  const unveraendert = text.trim() === (akte.naechsterSchritt?.text ?? "") && bis === (akte.naechsterSchritt?.bis ?? "");
  const speichern = () => void tun("schritt", "/naechster-schritt", {
    body: { text: text.trim(), bis: bis || undefined }, gut: "Nächster Schritt gespeichert", gutText: "Der Kunde liest ihn jetzt oben auf seiner Seite.",
    lokal: (a) => ({ ...a, naechsterSchritt: { text: text.trim(), bis: bis || null } }),
  });
  const leeren = () => void tun("schritt", "/naechster-schritt", {
    body: { text: "" }, gut: "Nächster Schritt geleert", gutText: "Der Kunde liest jetzt: Im Moment ist nichts von ihm nötig.",
    lokal: (a) => ({ ...a, naechsterSchritt: null }),
  });
  return (
    <div className="gl-ab gl-ab-schritt">
      <h2>Nächster Schritt des Kunden</h2>
      <div className="gl-felder">
        <label className="gl-feld breit">Was der Kunde als Nächstes tut {akte.sprache === "en" ? "(Englisch)" : "(Sie-Form)"}
          <textarea value={text} maxLength={600} onChange={(e) => setText(e.target.value)} placeholder={kundenPlatzhalter(akte.sprache).schritt} />
        </label>
        <label className="gl-feld">Bis wann (freiwillig)
          <input type="date" value={bis} min={heute} onChange={(e) => setBis(e.target.value)} />
        </label>
      </div>
      <WandHinweise text={text} />
      <div className="gl-tun">
        <button type="button" className="pi-knopf klein" disabled={laeuft === "schritt" || text.trim().length < 3 || unveraendert} onClick={speichern}>{laeuft === "schritt" ? "Speichere …" : "Speichern"}</button>
        {akte.naechsterSchritt && <button type="button" className="gl-textknopf" disabled={laeuft === "schritt"} onClick={leeren}>Erledigt — Schritt leeren</button>}
      </div>
      <p className="gl-leise">Der Kunde liest diesen Satz wörtlich, ganz oben auf seiner Seite. Steht hier nichts, liest er: „Im Moment ist nichts von Ihnen nötig.“</p>
    </div>
  );
}

// ═══ (d) DER STICHTAG ════════════════════════════════════════════════════════
function StichtagAbschnitt({ akte, tun, laeuft, heute }: Werk) {
  const fragen = useFragen();
  const [tag, setTag] = useState(akte.stichtag ?? "");
  const [mitteilen, setMitteilen] = useState(true);
  useEffect(() => { setTag(akte.stichtag ?? ""); }, [akte.stichtag]);
  const bezahlt = akte.status === "bezahlt" || akte.status === "gestartet";
  const inZukunft = (tageBis(tag || null, heute) ?? 0) > 0;
  const lage = fristLage(akte.stichtag, heute);
  const speichern = async () => {
    if (!(await fragen({
      titel: `Stichtag ${tagText(tag)} eintragen?`,
      text: "An diesem Tag hängt die Geld-zurück-Zusage aus Ziffer 6 des Auftrags: Stehen Gesellschaft und EIN bis dahin nicht, erstattet FIAON den Paketpreis.",
      folge: mitteilen ? "Der Kunde bekommt den Stichtag sofort per E-Mail — der Auftrag sagt diese Mitteilung in Textform zu." : "Ohne E-Mail. Der Auftrag sagt dem Kunden die Mitteilung in Textform zu — hol sie nach.",
      ja: "Stichtag eintragen",
    }))) return;
    await tun("stichtag", "/stichtag", { body: { stichtag: tag, mitteilen }, gut: "Stichtag eingetragen", gutText: mitteilen ? "Der Kunde hat ihn per E-Mail bekommen." : "Ohne E-Mail gespeichert.", lokal: (a) => ({ ...a, stichtag: tag }) });
  };
  return (
    <div className="gl-ab gl-ab-stichtag">
      <div className="gl-ab-kopf">
        <h2>Stichtag für Gesellschaft und EIN</h2>
        {akte.stichtag && <span className={`pi-marke ${lage.ton === "rot" ? "dringend" : lage.ton === "warn" ? "warn" : "still"}`}>{tagText(akte.stichtag)}{lage.text ? ` · ${lage.text}` : ""}</span>}
      </div>
      {!bezahlt ? (
        <p className="gl-leise">Der Stichtag wird im Startgespräch vereinbart — also nach dem Zahlungseingang. {akte.stichtag ? "" : "Noch ist keiner eingetragen."}</p>
      ) : (
        <>
          <div className="gl-felder">
            <label className="gl-feld">Vereinbart im Startgespräch
              <input type="date" value={tag} min={heute} onChange={(e) => setTag(e.target.value)} />
            </label>
            <label className="gl-haken unten">
              <input type="checkbox" checked={mitteilen} onChange={(e) => setMitteilen(e.target.checked)} />
              dem Kunden per E-Mail mitteilen
            </label>
          </div>
          <div className="gl-tun">
            <button type="button" className="pi-knopf klein" disabled={laeuft === "stichtag" || !tag || !inZukunft || tag === akte.stichtag} onClick={() => void speichern()}>{laeuft === "stichtag" ? "Speichere …" : akte.stichtag ? "Stichtag ändern" : "Stichtag eintragen"}</button>
            {tag && !inZukunft && <span className="gl-leise warn">Der Stichtag muss in der Zukunft liegen.</span>}
          </div>
          <p className="gl-leise">Trag nur ein, was mit dem Kunden besprochen ist. Der Stichtag ist ein Vertragsdatum, keine Planungsgröße — und er gilt nur für das, was FIAON selbst liefert: Gesellschaft und EIN.</p>
        </>
      )}
    </div>
  );
}

// ═══ (e) DIE GESELLSCHAFT ════════════════════════════════════════════════════
function GesellschaftAbschnitt({ akte, tun, laeuft, heute }: Werk) {
  const g = akte.gesellschaft;
  const [f, setF] = useState(g);
  useEffect(() => { setF(g); }, [g.name, g.form, g.bundesstaat, g.gegruendetAm, g.einVorhanden, g.itinStand]); // eslint-disable-line react-hooks/exhaustive-deps
  const unveraendert = f.name.trim() === g.name && f.form === g.form && f.bundesstaat === g.bundesstaat && f.gegruendetAm === g.gegruendetAm && f.einVorhanden === g.einVorhanden && f.itinStand === g.itinStand;
  const inZukunft = (tageBis(f.gegruendetAm || null, heute) ?? 0) > 0;
  const speichern = () => void tun("gesellschaft", "/gesellschaft", {
    body: { name: f.name.trim(), form: f.form || undefined, bundesstaat: f.bundesstaat || undefined, gegruendetAm: f.gegruendetAm || undefined, einVorhanden: f.einVorhanden, itinStand: f.itinStand },
    gut: "Gesellschaft gespeichert", gutText: "Der Pflichtenkalender ist mit den Regel-Fristen neu gesetzt.",
    lokal: (a) => ({ ...a, gesellschaft: { ...f, name: f.name.trim() } }),
  });
  return (
    <div className="gl-ab gl-ab-gesellschaft">
      <h2>Die US-Gesellschaft</h2>
      <div className="gl-felder">
        <label className="gl-feld breit">Name der Gesellschaft
          <input value={f.name} maxLength={160} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="wie im Gründungsdokument, z. B. Beispiel Holdings LLC" />
        </label>
        <label className="gl-feld">Form
          <select value={f.form} onChange={(e) => setF({ ...f, form: e.target.value as typeof f.form })}>
            <option value="">— noch offen —</option><option value="LLC">LLC</option><option value="Corporation">Corporation</option>
          </select>
        </label>
        <label className="gl-feld">Bundesstaat
          <select value={f.bundesstaat} onChange={(e) => setF({ ...f, bundesstaat: e.target.value })}>
            <option value="">— noch offen —</option>
            {f.bundesstaat && !US_STAATEN.some(([k]) => k === f.bundesstaat) && <option value={f.bundesstaat}>{f.bundesstaat}</option>}
            {US_STAATEN.map(([k, n]) => <option key={k} value={k}>{n} ({k})</option>)}
          </select>
        </label>
        <label className="gl-feld">Gegründet am
          <input type="date" value={f.gegruendetAm} max={heute} onChange={(e) => setF({ ...f, gegruendetAm: e.target.value })} />
        </label>
        <label className="gl-feld">ITIN des Inhabers
          <select value={f.itinStand} onChange={(e) => setF({ ...f, itinStand: e.target.value as typeof f.itinStand })}>
            <option value="offen">noch nicht beantragt</option><option value="beantragt">beantragt</option><option value="vorhanden">liegt vor</option>
          </select>
        </label>
        <label className="gl-haken breit">
          <input type="checkbox" checked={f.einVorhanden} onChange={(e) => setF({ ...f, einVorhanden: e.target.checked })} />
          Die EIN liegt vor (Bestätigung der US-Steuerbehörde in den Dokumenten)
        </label>
      </div>
      <div className="gl-tun">
        <button type="button" className="pi-knopf klein" disabled={laeuft === "gesellschaft" || unveraendert || inZukunft} onClick={speichern}>{laeuft === "gesellschaft" ? "Speichere …" : "Gesellschaft speichern"}</button>
        {inZukunft && <span className="gl-leise warn">Das Gründungsdatum liegt in der Zukunft.</span>}
      </div>
      <p className="gl-leise">Aus Form, Bundesstaat und Gründungsdatum setzt der Server die Regel-Fristen im Pflichtenkalender{g.bundesstaat ? ` (heute: ${staatName(g.bundesstaat)})` : ""}. Trag ein, was im Gründungsdokument steht — der Kunde sieht Name, Form, Staat und Datum auf seiner Seite.</p>
    </div>
  );
}

// ═══ (f) DER PFLICHTENKALENDER ═══════════════════════════════════════════════
function FristenAbschnitt({ akte, tun, laeuft, heute }: Werk) {
  const fragen = useFragen();
  const leer = { titel: "", faelligAm: "", hinweis: "" };
  const [neu, setNeu] = useState(leer);
  const [inArbeit, setInArbeit] = useState<(typeof leer & { id: string }) | null>(null);
  const sortiert = useMemo(() => [...akte.fristen].sort((a, b) => (a.erledigt !== b.erledigt ? (a.erledigt ? 1 : -1) : a.faelligAm < b.faelligAm ? -1 : a.faelligAm > b.faelligAm ? 1 : 0)), [akte.fristen]);

  const haken = (f: GlobalFrist) => void tun(`frist-${f.id}`, `/frist/${encodeURIComponent(f.id)}`, {
    body: { erledigt: !f.erledigt }, gut: f.erledigt ? "Frist wieder offen" : "Frist erledigt", gutText: f.titel,
    lokal: (a) => ({ ...a, fristen: a.fristen.map((x) => (x.id === f.id ? { ...x, erledigt: !f.erledigt } : x)) }),
  });
  const anlegen = async () => {
    const ok = await tun("frist-neu", "/frist", { body: { titel: neu.titel.trim(), faelligAm: neu.faelligAm, hinweis: neu.hinweis.trim() || undefined }, gut: "Frist angelegt", gutText: `${neu.titel.trim()} · ${tagText(neu.faelligAm)}` });
    if (ok) setNeu(leer);
  };
  const aendern = async () => {
    if (!inArbeit) return;
    const w = inArbeit;
    const ok = await tun(`frist-${w.id}`, `/frist/${encodeURIComponent(w.id)}`, {
      body: { titel: w.titel.trim(), faelligAm: w.faelligAm, hinweis: w.hinweis.trim() }, gut: "Frist geändert", gutText: `${w.titel.trim()} · ${tagText(w.faelligAm)}`,
      lokal: (a) => ({ ...a, fristen: a.fristen.map((x) => (x.id === w.id ? { ...x, titel: w.titel.trim(), faelligAm: w.faelligAm, hinweis: w.hinweis.trim() } : x)) }),
    });
    if (ok) setInArbeit(null);
  };
  const loeschen = async (f: GlobalFrist) => {
    if (!(await fragen({ titel: "Frist löschen?", text: `„${f.titel}“ am ${tagText(f.faelligAm)} verschwindet aus dem Kalender — auch beim Kunden.`, folge: f.regel ? "Das ist eine Regel-Frist. Speicherst du die Gesellschaft neu, setzt der Server sie wieder." : undefined, ja: "Löschen", gefaehrlich: true }))) return;
    await tun(`frist-${f.id}`, `/frist/${encodeURIComponent(f.id)}`, { method: "DELETE", gut: "Frist gelöscht", gutText: f.titel, lokal: (a) => ({ ...a, fristen: a.fristen.filter((x) => x.id !== f.id) }) });
  };

  return (
    <div className="gl-ab gl-ab-fristen">
      <div className="gl-ab-kopf"><h2>Pflichtenkalender</h2><span className="gl-leise">{sortiert.filter((f) => !f.erledigt).length} offen · {sortiert.filter((f) => f.erledigt).length} erledigt</span></div>
      {sortiert.length === 0 && <p className="gl-leise">Noch keine Frist. Sobald Form, Bundesstaat und Gründungsdatum oben gespeichert sind, setzt der Server die Regel-Fristen — die wiederkehrenden US-Meldungen und Staatsgebühren dieser Gesellschaft. Eigene Fristen legst du unten an.</p>}
      <ul className="gl-fristen">
        {sortiert.map((f) => {
          const lage = f.erledigt ? { text: "erledigt", ton: "still" as const } : fristLage(f.faelligAm, heute);
          const bearbeitet = inArbeit?.id === f.id;
          return (
            <li key={f.id} className={`gl-frist${f.erledigt ? " erledigt" : ""}`}>
              <input type="checkbox" checked={f.erledigt} disabled={laeuft === `frist-${f.id}`} onChange={() => haken(f)} aria-label={`${f.titel} — ${f.erledigt ? "als offen markieren" : "als erledigt markieren"}`} />
              <div>
                <span className="gl-frist-titel">{f.titel}</span>
                <span className="gl-frist-unter"><span>{tagText(f.faelligAm)}</span>{lage.text && <span className={lage.ton === "still" ? "" : lage.ton}>{lage.text}</span>}{f.regel && <span>Regel-Frist</span>}{f.hinweis && <span>{f.hinweis}</span>}</span>
              </div>
              <div className="gl-tun gl-frist-tun">
                <button type="button" className="gl-textknopf" aria-expanded={bearbeitet} onClick={() => setInArbeit(bearbeitet ? null : { id: f.id, titel: f.titel, faelligAm: f.faelligAm, hinweis: f.hinweis })}>{bearbeitet ? "Schließen" : "Ändern"}</button>
                <button type="button" className="gl-textknopf rot" disabled={laeuft === `frist-${f.id}`} onClick={() => void loeschen(f)}>Löschen</button>
              </div>
              {bearbeitet && inArbeit && (
                <div className="gl-frist-form">
                  <label className="gl-feld">Titel<input value={inArbeit.titel} maxLength={160} onChange={(e) => setInArbeit({ ...inArbeit, titel: e.target.value })} /></label>
                  <label className="gl-feld">Fällig am<input type="date" value={inArbeit.faelligAm} onChange={(e) => setInArbeit({ ...inArbeit, faelligAm: e.target.value })} /></label>
                  <label className="gl-feld breit">Hinweis für den Kunden (freiwillig)<input value={inArbeit.hinweis} maxLength={300} onChange={(e) => setInArbeit({ ...inArbeit, hinweis: e.target.value })} /></label>
                  <div className="breit"><WandHinweise text={`${inArbeit.titel} ${inArbeit.hinweis}`} /></div>
                  <div className="gl-tun breit"><button type="button" className="pi-knopf klein" disabled={laeuft === `frist-${f.id}` || inArbeit.titel.trim().length < 3 || !inArbeit.faelligAm} onClick={() => void aendern()}>Änderung speichern</button></div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="gl-frist-form" role="group" aria-label="Eigene Frist anlegen">
        <label className="gl-feld">Eigene Frist (der Kunde liest den Titel)<input value={neu.titel} maxLength={160} onChange={(e) => setNeu({ ...neu, titel: e.target.value })} placeholder={kundenPlatzhalter(akte.sprache).fristTitel} /></label>
        <label className="gl-feld">Fällig am<input type="date" value={neu.faelligAm} min={heute} onChange={(e) => setNeu({ ...neu, faelligAm: e.target.value })} /></label>
        <label className="gl-feld breit">Hinweis für den Kunden (freiwillig)<input value={neu.hinweis} maxLength={300} onChange={(e) => setNeu({ ...neu, hinweis: e.target.value })} placeholder={kundenPlatzhalter(akte.sprache).fristHinweis} /></label>
        <div className="breit"><WandHinweise text={`${neu.titel} ${neu.hinweis}`} /></div>
        <div className="gl-tun breit"><button type="button" className="pi-knopf klein still" disabled={laeuft === "frist-neu" || neu.titel.trim().length < 3 || !neu.faelligAm} onClick={() => void anlegen()}>{laeuft === "frist-neu" ? "Lege an …" : "Frist hinzufügen"}</button></div>
      </div>
      <p className="gl-leise">Der Kunde sieht diesen Kalender auf seiner Seite. Ob eine Frist für ihn gilt und wann genau, bestätigt sein Steuerberater bzw. US-CPA auf eigenes Mandat — nicht du. Du hältst den Kalender aktuell und erinnerst.</p>
    </div>
  );
}

// ═══ (g) UNTERLAGEN UND DOKUMENTE ════════════════════════════════════════════
/** multipart mit Fortschritt. `fetch` kennt keinen Upload-Fortschritt — deshalb hier XMLHttpRequest.
 *  Wie überall im Office OHNE eigenen Content-Type: Die Grenzmarke setzt der Browser. */
function sendeDatei(url: string, daten: FormData, fortschritt: (anteil: number) => void): Promise<{ status: number; json: any }> {
  return new Promise((fertig) => {
    const x = new XMLHttpRequest();
    x.open("POST", url);
    x.withCredentials = true;
    x.upload.onprogress = (e) => { if (e.lengthComputable && e.total > 0) fortschritt(e.loaded / e.total); };
    x.onload = () => { let json: any = null; try { json = JSON.parse(x.responseText); } catch { /* keine JSON-Antwort */ } fertig({ status: x.status, json }); };
    x.onerror = () => fertig({ status: 0, json: null });
    x.onabort = () => fertig({ status: 0, json: null });
    x.send(daten);
  });
}

function DokumenteAbschnitt({ akte, tun, laeuft, frisch, basis }: Werk & { basis: string }) {
  const fragen = useFragen();
  const { zeige } = useToast();
  const dateiFeld = useRef<HTMLInputElement>(null);
  const [art, setArt] = useState("");
  const [datei, setDatei] = useState<File | null>(null);
  const [sichtbar, setSichtbar] = useState(true);
  const [anteil, setAnteil] = useState<number | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const offen = akte.status === "bezahlt" || akte.status === "gestartet";
  const fehlend = akte.unterlagen.filter((u) => !u.vorhanden);
  const gewaehlteArt = art || akte.dokumentArten[0]?.art || "";

  const waehlen = (f: File | null) => { setDatei(f); setMeldung(f ? dateiPruefen(f) : null); };
  const hochladen = async () => {
    const grund = dateiPruefen(datei);
    if (grund || !datei) { setMeldung(grund); return; }
    if (!gewaehlteArt) { setMeldung("Bitte wähl die Art des Dokuments."); return; }
    setMeldung(null); setAnteil(0);
    const daten = new FormData();
    daten.append("art", gewaehlteArt); daten.append("sichtbarFuerKunde", sichtbar ? "true" : "false"); daten.append("datei", datei);
    const r = await sendeDatei(`/api/fiaon${basis}/dokument`, daten, setAnteil);
    setAnteil(null);
    if (r.status >= 200 && r.status < 300 && r.json?.ok) {
      zeige("erfolg", "Dokument liegt in der Akte", sichtbar ? "Der Kunde sieht es in seinem Dokumentenraum." : "Nur intern — der Kunde sieht es nicht.");
      setDatei(null); if (dateiFeld.current) dateiFeld.current.value = "";
      frisch();
    } else {
      const satz = String(r.json?.error || statusSatz(r.status));
      setMeldung(satz); zeige("fehler", "Hochladen fehlgeschlagen", satz);
    }
  };
  const loeschen = async (id: string, name: string, von: string) => {
    if (!(await fragen({ titel: "Dokument aus der Akte nehmen?", text: `„${name}“ verschwindet aus der Akte${von === "kunde" ? " — der Kunde hat es hochgeladen und sieht es danach nicht mehr" : " und aus dem Dokumentenraum des Kunden"}.`, folge: "Die Datei wird nicht vernichtet, sondern ausgeblendet; der Verlauf hält fest, wer sie entfernt hat.", ja: "Entfernen", gefaehrlich: true }))) return;
    await tun(`dok-${id}`, `/dokument/${encodeURIComponent(id)}`, { method: "DELETE", gut: "Dokument entfernt", gutText: name, lokal: (a) => ({ ...a, dokumente: a.dokumente.filter((d) => d.id !== id) }) });
  };

  return (
    <>
      <div className="gl-ab gl-ab-unterlagen">
        <div className="gl-ab-kopf"><h2>Unterlagen vom Kunden</h2><span className={`pi-marke ${fehlend.length ? "warn" : "gut"}`}>{akte.unterlagen.length === 0 ? "keine Liste" : fehlend.length ? `${fehlend.length} von ${akte.unterlagen.length} fehlen` : "vollständig"}</span></div>
        {akte.unterlagen.length === 0
          ? <p className="gl-leise">Der Server hat zu diesem Auftrag keine Unterlagenliste mitgegeben.</p>
          : (
            <ul className="gl-unterlagen">
              {akte.unterlagen.map((u) => (
                <li key={u.art} className={`gl-unterlage${u.vorhanden ? " da" : ""}`}>
                  <i aria-hidden="true" />
                  <div><b>{u.titel}</b>{u.hinweis && <small>{u.hinweis}</small>}</div>
                  <em>{u.vorhanden ? "liegt vor" : "fehlt noch"}</em>
                </li>
              ))}
            </ul>
          )}
        {fehlend.length > 0 && <p className="gl-leise">Der Kunde lädt jede Unterlage auf seiner Seite selbst hoch. Schafft er es nicht: Lass sie dir schicken und lade sie unten für ihn hoch — mit der passenden Art, dann hakt die Liste sie ab.</p>}
      </div>

      <div className="gl-ab gl-ab-upload">
        <h2>Dokument hochladen</h2>
        {!offen ? (
          <p className="gl-leise">{akte.status === "offen" ? "Der Dokumentenraum öffnet sich mit dem Zahlungseingang." : "Dieser Auftrag ist beendet — der Dokumentenraum nimmt nichts Neues mehr an."}</p>
        ) : (
          <div className="gl-upload">
            <div className="gl-upload-reihe">
              <label className="gl-feld">Art
                <select value={gewaehlteArt} onChange={(e) => setArt(e.target.value)} disabled={anteil !== null}>
                  {akte.dokumentArten.map((a) => <option key={a.art} value={a.art}>{a.titel}</option>)}
                </select>
              </label>
              <label className="gl-feld">Datei (PDF, JPG, PNG, HEIC · höchstens 15 MB)
                <span className="gl-datei">
                  <span>{datei ? `${datei.name} · ${groesseText(datei.size)}` : "Datei auswählen …"}</span>
                  <input ref={dateiFeld} type="file" accept={UPLOAD_ERLAUBT} className="gl-nur-leser" disabled={anteil !== null}
                         onChange={(e) => waehlen(e.target.files?.[0] ?? null)} />
                </span>
              </label>
            </div>
            <label className="gl-haken">
              <input type="checkbox" checked={sichtbar} onChange={(e) => setSichtbar(e.target.checked)} disabled={anteil !== null} />
              für den Kunden sichtbar (erscheint in seinem Dokumentenraum)
            </label>
            {anteil !== null && (
              <div role="progressbar" aria-label="Hochladen" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(anteil * 100)} className="gl-fortschritt"><i style={{ width: `${Math.round(anteil * 100)}%` }} /></div>
            )}
            {meldung && <p className="gl-leise warn" role="alert">{meldung}</p>}
            <div className="gl-tun">
              <button type="button" className="pi-knopf klein" disabled={anteil !== null || !datei || !!dateiPruefen(datei)} onClick={() => void hochladen()}>{anteil !== null ? `Lädt hoch … ${Math.round(anteil * 100)} %` : "Hochladen"}</button>
            </div>
          </div>
        )}
      </div>

      <div className="gl-ab gl-ab-doks">
        <div className="gl-ab-kopf"><h2>Dokumentenraum</h2><span className="gl-leise">{akte.dokumente.length} {akte.dokumente.length === 1 ? "Dokument" : "Dokumente"}</span></div>
        {akte.dokumente.length === 0 && <p className="gl-leise">Noch nichts da — weder vom Kunden noch von FIAON.</p>}
        <ul className="gl-doks">
          {akte.dokumente.map((d) => (
            <li key={d.id} className="gl-dok">
              <div>
                <b>{d.name}</b>
                <small>{[d.artText, d.von === "kunde" ? "vom Kunden" : "von FIAON", d.am ? zeitText(d.am) : "", groesseText(d.groesse)].filter(Boolean).join(" · ")}</small>
              </div>
              <div className="gl-dok-tun">
                {d.sichtbar !== null && <span className={`gl-sicht${d.sichtbar ? "" : " intern"}`}>{d.sichtbar ? "Kunde sieht das" : "nur intern"}</span>}
                <a className="gl-textknopf" href={`/api/fiaon${basis}/dokument/${encodeURIComponent(d.id)}`} target="_blank" rel="noopener noreferrer">Ansehen</a>
                <button type="button" className="gl-textknopf rot" disabled={laeuft === `dok-${d.id}`} onClick={() => void loeschen(d.id, d.name, d.von)}>Löschen</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

// ═══ (h) VERLAUF UND NOTIZ ═══════════════════════════════════════════════════
function VerlaufAbschnitt({ akte, tun, laeuft }: Werk) {
  const [text, setText] = useState("");
  const [sichtbar, setSichtbar] = useState(false);
  const zeilen: GlobalVerlaufZeile[] = useMemo(() => {
    const alle = akte.verlaufAlles.length
      ? akte.verlaufAlles
      : [...akte.verlauf.map((v) => ({ am: v.am, art: "", text: v.text, sichtbar: true, von: "" })), ...akte.notizen.map((n) => ({ am: n.am, art: "notiz", text: n.text, sichtbar: n.sichtbar, von: n.von }))];
    return [...alle].sort((a, b) => String(b.am ?? "").localeCompare(String(a.am ?? "")));
  }, [akte.verlaufAlles, akte.verlauf, akte.notizen]);
  const speichern = async () => {
    const ok = await tun("notiz", "/notiz", { body: { text: text.trim(), sichtbar }, gut: sichtbar ? "Notiz gespeichert — der Kunde sieht sie" : "Interne Notiz gespeichert", gutText: sichtbar ? "Sie steht jetzt in seinem Verlauf." : "Nur das Team sieht sie." });
    if (ok) { setText(""); setSichtbar(false); }
  };
  return (
    <>
      <div className="gl-ab gl-ab-notiz">
        <h2>Notiz</h2>
        <label className="gl-feld">{sichtbar ? `Für den Kunden ${akte.sprache === "en" ? "(Englisch)" : "(Sie-Form)"}` : "Intern (nur das Team)"}
          <textarea value={text} maxLength={2000} onChange={(e) => setText(e.target.value)}
                    placeholder={sichtbar ? kundenPlatzhalter(akte.sprache).notiz : "z. B. Monatlicher Durchgang geführt: Kartenantrag liegt beim Institut, Kunde schickt den Adressnachweis nach."} />
        </label>
        {sichtbar && <WandHinweise text={text} />}
        <div className="gl-tun">
          <label className="gl-haken"><input type="checkbox" checked={sichtbar} onChange={(e) => setSichtbar(e.target.checked)} />für den Kunden sichtbar</label>
          <button type="button" className="pi-knopf klein" disabled={laeuft === "notiz" || text.trim().length < 3} onClick={() => void speichern()}>{laeuft === "notiz" ? "Speichere …" : sichtbar ? "Für den Kunden speichern" : "Intern speichern"}</button>
        </div>
      </div>
      <div className="gl-ab gl-ab-verlauf">
        <div className="gl-ab-kopf"><h2>Verlauf</h2><span className="gl-leise">{zeilen.length} Einträge · grün markiert = sieht der Kunde</span></div>
        {zeilen.length === 0 && <p className="gl-leise">Noch kein Eintrag.</p>}
        <ul className="gl-verlauf" tabIndex={zeilen.length > 8 ? 0 : undefined} aria-label="Verlauf des Auftrags">
          {zeilen.map((v, i) => (
            <li key={i}>
              <time>{zeitText(v.am)}</time>
              <div>
                <p>{v.text}</p>
                <small><span className={`gl-sicht${v.sichtbar ? "" : " intern"}`}>{v.sichtbar ? "Kunde sieht das" : "nur intern"}</span>{v.von && <span>{v.von}</span>}{v.art && <span>{VERLAUF_ART[v.art] ?? v.art}</span>}</small>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

// ═══ (i) RECHTS: DER ZUSAMMENHANG ════════════════════════════════════════════
function Kontext({ akte, tun, laeuft }: Werk) {
  const k = akte.kontakt;
  const nicht = useMemo(() => nichtZusagen(), []);
  const [abschluss, setAbschluss] = useState<{ text: string } | null>(null);
  const zu = useCallback(() => setAbschluss(null), []);
  const bekannt = new Set(FIRMA_FELDER.map(([s]) => s));
  const weitere = Object.entries(akte.firmaVoll).filter(([s]) => !bekannt.has(s) && s !== "ustId" && s !== "art");
  const kannAbschliessen = akte.status === "gestartet";
  const abschliessen = async () => {
    if (!abschluss) return;
    const ok = await tun("abschluss", "/abschliessen", {
      body: { text: abschluss.text.trim() || undefined }, gut: "Auftrag abgeschlossen", gutText: "Stand „abgeschlossen“, Etappe 5 — der Kunde sieht es auf seiner Seite.",
      lokal: (a) => ({ ...a, status: "abgeschlossen", etappe: 5, etappen: a.etappen.map((e) => ({ ...e, stand: e.nr < 5 ? "fertig" : "jetzt" })) }),
    });
    if (ok) setAbschluss(null);
  };
  return (
    <aside className="gl-kontext" aria-label="Zusammenhang">
      <div className="gl-karte gl-karte-kontakt">
        <h2>Kontakt</h2>
        <dl className="gl-paare">
          <div><dt>Person</dt><dd>{[k.anrede, k.vorname, k.nachname].filter(Boolean).join(" ") || "—"}</dd></div>
          <div><dt>Funktion</dt><dd>{akte.auftraggeber === "privat" ? "beauftragt selbst, als Privatperson" : k.funktion || "—"}</dd></div>
          <div><dt>E-Mail</dt><dd>{k.email ? <a href={`mailto:${k.email}`}>{k.email}</a> : "—"}</dd></div>
          <div><dt>Telefon</dt><dd>{k.telefon ? <a href={telLink(k.telefon)}>{k.telefon}</a> : "—"}</dd></div>
          <div><dt>Sprache</dt><dd>{akte.sprache === "en" ? "Englisch" : "Deutsch"}</dd></div>
          {akte.ansprechpartner && <div><dt>Zuständig</dt><dd>{akte.ansprechpartner.name}</dd></div>}
        </dl>
      </div>

      <div className="gl-karte gl-karte-firma">
        <h2>{akte.auftraggeber === "privat" ? "Auftraggeber (Privatperson)" : "Firmendaten"}</h2>
        <dl className="gl-paare">
          {FIRMA_FELDER.filter(([s]) => akte.firmaVoll[s]).map(([s, titel]) => <div key={s}><dt>{titel}</dt><dd>{s === "land" ? LAND_NAME[akte.firmaVoll[s]] ?? akte.firmaVoll[s] : akte.firmaVoll[s]}</dd></div>)}
          {Object.keys(akte.firmaVoll).length === 0 && <div><dt>Firma</dt><dd>{akte.firma.name}{akte.firma.ort ? `, ${akte.firma.ort}` : ""}</dd></div>}
          {akte.auftraggeber !== "privat" && <div><dt>USt-IdNr.</dt><dd>{akte.ustId || "nicht angegeben"}</dd></div>}
          {weitere.map(([s, w]) => <div key={s}><dt>{s}</dt><dd>{w}</dd></div>)}
        </dl>
      </div>

      <div className="gl-karte gl-karte-papiere">
        <h2>Vertrag und Rechnung</h2>
        <div className="gl-links">
          {akte.vertragUrl ? <a className="pi-knopf still klein" href={akte.vertragUrl} target="_blank" rel="noopener noreferrer">Vertrag (PDF)</a> : <span className="gl-leise">Kein Vertrag hinterlegt.</span>}
          {akte.rechnungUrl ? <a className="pi-knopf still klein" href={akte.rechnungUrl} target="_blank" rel="noopener noreferrer">Rechnung (PDF)</a> : <span className="gl-leise">Keine Rechnung hinterlegt.</span>}
        </div>
        <p className="gl-leise">Dieselben Dateien, die der Kunde per E-Mail bekommen hat.</p>
        {/* E-196: Wann die Rechnung für das zweite Betreuungsjahr rausgeht — dieselbe Regel wie der Tageslauf (Server). */}
        {akte.jahresbetreuung.gebucht && (
          <p className="gl-leise">
            <b>{JAHRESBETREUUNG_MARKE}</b>{akte.jahresbetreuung.preisCents != null ? ` · ${euroText(akte.jahresbetreuung.preisCents)} je Betreuungsjahr` : ""}, alle Gebühren inklusive — auch die Staatsgebühr. Die Rechnung oben enthält nur den Paketpreis.
            {akte.jahresbetreuung.rechnungAb && akte.jahresbetreuung.jahrestag
              ? ` Das zweite Jahr beginnt am ${tagText(akte.jahresbetreuung.jahrestag)}; die Rechnung dafür stellst du ab dem ${tagText(akte.jahresbetreuung.rechnungAb)} — an diesem Tag kommt die Aufgabe dazu.${akte.jahresbetreuung.basis === "start" ? " Gerechnet ab dem Start: Trag den Gründungstag ein, dann zählt er." : ""}`
              : " Wann die Rechnung für das zweite Jahr fällig wird, steht hier, sobald der Auftrag gestartet ist."}
          </p>
        )}
      </div>

      <div className="gl-karte gl-nicht">
        <h2>Was ich dem Kunden NICHT zusage</h2>
        <ul>{nicht.verbote.map((s, i) => <li key={i}>{s}</li>)}</ul>
        <details><summary>So sagst du es dem Kunden</summary><ul>{nicht.saetze.map((s, i) => <li key={i}>{s}</li>)}</ul></details>
        <details><summary>Die drei Pflichthinweise aus dem Auftrag</summary><ul>{nicht.pflicht.map((s, i) => <li key={i}>{s}</li>)}</ul></details>
        <details><summary>Wer was tut — FIAON und die Partner</summary><ul>{nicht.rollen.map((s, i) => <li key={i}>{s}</li>)}</ul></details>
      </div>

      <div className="gl-karte gl-karte-abschluss">
        <h2>Auftrag abschließen</h2>
        <p className="gl-leise">{akte.status === "abgeschlossen" ? "Dieser Auftrag ist abgeschlossen." : akte.status === "storniert" ? "Dieser Auftrag ist storniert." : kannAbschliessen ? "Wenn alles aus dem Paket geliefert ist: Stand „abgeschlossen“, Etappe 5. Dokumente und Kalender bleiben für den Kunden sichtbar." : "Abschließen kannst du einen Auftrag, der gestartet ist."}</p>
        <div className="gl-tun"><button type="button" className="pi-knopf still klein" disabled={!kannAbschliessen || laeuft === "abschluss"} onClick={() => setAbschluss({ text: etappeKundentext(5, akte.sprache) })}>Auftrag abschließen</button></div>
      </div>

      {abschluss && createPortal(
        <ConfirmDialog open danger title="Auftrag abschließen?" message={`${akte.firma.name} · ${akte.paketName}`}
                       consequence="Der Stand wird „abgeschlossen“, die Etappe 5. Der Text steht danach im Verlauf des Kunden. In diesem Werkzeug lässt sich das nicht zurücknehmen."
                       confirmLabel="Abschließen" busy={laeuft === "abschluss"} onConfirm={() => void abschliessen()} onCancel={zu}>
          <div className="gl-dialog">
            <label>Text für den Kunden {akte.sprache === "en" ? "(Englisch)" : "(Sie-Form)"}
              <textarea className={inputCls} value={abschluss.text} maxLength={1200} placeholder={kundenPlatzhalter(akte.sprache).abschluss} onChange={(e) => setAbschluss({ text: e.target.value })} />
            </label>
            <WandHinweise text={abschluss.text} />
          </div>
        </ConfirmDialog>, document.body)}
    </aside>
  );
}
