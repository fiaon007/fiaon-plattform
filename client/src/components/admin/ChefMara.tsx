// ═══════════════════════════════════════════════════════════════════════════
// /chef/s/mara — Maras Steuerpult (21.09.2026)
//
// Justin: „Ich möchte die Arbeit von Mara einsehen, im Detail sehen können,
// steuern können und ALLES nachvollziehen können."
//
//   · Oben: läuft sie, wie viel heute, was kommt zurück (Antworten, Zahlungen),
//     was es kostet.
//   · Steuerung: An/Aus, Mails je Stunde, Kostendeckel, Stufen, Emojis,
//     Probe ohne Senden, ein Durchgang jetzt.
//   · Unten jede Mail vollständig — mit dem, was danach geschah, Maras
//     Gedächtnis zu dem Menschen und „Aus der Aktion nehmen".
// Die Regeln selbst stehen in server/lib/fiaon-mara-aktion.ts.
//
// ── E-252 (28.09.2026): DAS STEUERPULT NACH DER ENDFASSUNG E-250 ───────────
// Justin hat den Entwurf freigegeben („Go, 1 ja, 2 ja, 3 ja"). Vorher stand
// über jedem Reiter eine KI-Karte und die ganze Bilanz (32–38 Zahlen), die
// Reiter begannen weit unter 1.000 px. Jetzt:
//   · Kopf: h1 „Mara-Steuerpult" und drei Chips — KI · Mara anweisen (n) ·
//     Rundgang. Höchstens EIN Aufklapper ist offen (KI, Bilanz, Anweisen).
//   · Verkaufsleiste: Geld nach Mara (7 Tage) und je Weg, ob er läuft und was
//     er gebracht hat. Jede Zelle springt zu ihrem Schalter.
//   · Reiter ohne Querrolle. Im Mail-Reiter: Statuszeile mit dem Schalter,
//     die Wirkung als Kette, links „Wen", rechts die EINE Glasfläche „Wie",
//     darunter „Was rausging". Meldungen stehen am Auslöser, nicht fest unten.
// Die Daten holt die Wurzel einmal (mara-lage.tsx) und lädt jede Minute neu.
// Keine Route, kein Schlüssel, kein Rückfragetext ist geändert.
// ═══════════════════════════════════════════════════════════════════════════
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type TextareaHTMLAttributes } from "react";
import { API, seit, zahl, Geruest, Fehlermeldung, useDaten } from "./chef-teile";
import {
  MaraLage, useMaraLage, useMaraDaten, useMaraRundgang, useMeldung, Meldung, InfoKnopf,
  MARA_QUELLEN, berlinTag, tagNur, uhrBerlin, tagZeitBerlin, wannWieder, naechsteGruppe, betragTextCents,
  type LageKern, type MaraReiter,
} from "./mara-lage";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "@/pages/agent/rundgaenge";
import "@/styles/office-rundgang.css";
import "@/styles/chef-mara.css";
import "@/styles/chef-wa-zentrale.css";
import ChefWhatsAppZentrale from "./ChefWhatsAppZentrale";
import { KiPauseKarte } from "./ChefKiPause";
// E-243 (26.09.2026): Der Verkauf der Bonitätsauskunft wohnt hier, nicht auf einer eigenen Seite — erst beim Öffnen geladen.
const AuskunftVerkauf = lazy(() => import("./ChefAuskunft"));
const AuskunftBeschaffung = lazy(() => import("./ChefAuskunftBeschaffung"));

interface Einstellungen { an: boolean; jeStunde: number; tagEuro: number; stufen: string[]; emojis: boolean; postfach: string; start: string | null }
interface Stand {
  einstellungen: Einstellungen;
  zaehler: { letzteStunde: number; heute: number; tagesDeckel: number; kostenHeuteEuro: number };
  zahlen: { gesendet: number; menschen: number; antworten: number; gemeldet: number; bezahlt: number; bezahltEuro?: number; abgelehnt: number; fehler: number; ausgeschlossen: number; postfach?: { heute_rein?: number; heute_beantwortet?: number; entwuerfe?: number } };
  kosten: { heuteEuro: number; wocheEuro: number };
  schlange: { personId: number; ref: string; stufe: "A" | "B"; schritt: number; name: string; paket: string | null; betragEuro: number | null; wunschlimit: number | null; ereignisAm: string; zuletztAm: string | null }[];
}
interface Mail {
  id: number; personId: number; ref: string; stufe: string; schritt: number; status: string; grund: string | null;
  betreff: string | null; text: string | null; empfaenger: string; name: string; am: string | null;
  antwortAm: string | null; gemeldetAm: string | null; bezahltAm: string | null; kostenCent: number; ausgeschlossen: boolean;
}
/** E-252: Die Schlange steht jetzt links unter „Wen" — die Unterreiter sind nur noch, was rausging. */
type MailStatus = "gesendet" | "abgelehnt" | "fehler";

const euro = (n: number) => `${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const zeit = (s: string | null) => (s ? new Date(s).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
/** Eine Zahl oder, bei 0, ein Wort — keine nackte Null (E-250, Zuordnung § 6). */
const oderWort = (n: number | null | undefined, wort: string) => (Number(n) > 0 ? zahl(Number(n)) : wort);

async function senden(pfad: string, body: unknown): Promise<any> {
  const r = await fetch(`${API}${pfad}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok) throw new Error(j?.error || "Das hat nicht geklappt.");
  return j;
}

// ═══════════════════════════════════════════════════════════════════════════
// MARA ANWEISEN (23.09.2026, E-219)
//
// Justin: „Ich möchte quasi mit Mara kommunizieren … ich soll aber eben alles
// steuern, von ihrem gesamten Wissen, allen Zugriffen — einfach alles."
//
// Ein Feld, ein Satz, ein Plan. Der Plan zeigt jeden Schritt mit Namen und
// Klasse; endgültige Schritte sind rot. Erst der Klick wirkt.
//
// E-252 (28.09.2026): Anweisen und „Deine Anweisung an Mara" gelten für ganz
// Mara (WhatsApp, Postfach, Aktion) — sie standen aber nur im Mail-Reiter und
// dort über der ersten Mail (Befund 6). Jetzt ein Aufklapper der Wurzel, aus
// jedem Reiter über den Chip „Mara anweisen (n)" erreichbar; die Zahl sind die
// Aufträge, die auf dich warten. Reihenfolge: Befehlsfeld → deine Anweisung →
// Wartet auf dich → Daueraufträge / Was Mara darf / Was gelaufen ist.
// ═══════════════════════════════════════════════════════════════════════════
interface Schritt { werkzeug: string; argumente: any; wen: string; warum: string; klasse: string }
interface Auftrag {
  id: number; befehl: string; absicht: string | null; status: string; rueckfrage: string | null;
  plan: Schritt[]; ergebnis: { werkzeug?: string; wen?: string; ok?: boolean; text?: string }[];
  von: string; erstelltAm: string; fertigAm: string | null; dauerauftragId: number | null;
}
interface Dauer { id: number; befehl: string; takt: string; uhrzeit: string; an: boolean; letzterLauf: string | null; letzteMeldung: string | null }
interface AuftraegeDaten {
  auftraege: Auftrag[];
  dauerauftraege: Dauer[];
  werkzeuge: { name: string; beschreibung: string; klasse: string; felder: string }[];
  tag: any;
}
const KLASSE_TEXT: Record<string, string> = { lesen: "nachsehen", umkehrbar: "umkehrbar", endgueltig: "endgültig" };
const STATUS_TEXT: Record<string, string> = {
  entwurf: "wartet auf dich", rueckfrage: "Rückfrage", laeuft: "läuft",
  fertig: "erledigt", teilweise: "teilweise", verworfen: "verworfen",
};
const wartetAufDich = (a: Auftrag) => a.status === "entwurf" || a.status === "rueckfrage";

/** Maras Tag als kurze Zeile — die vollen Zahlen stehen im title (E-244-Wortlaut). */
function tagZeile(t: any): { kurz: string; offen: string; titel: string } {
  const antworten = Number(t?.mails?.geschrieben || 0);
  const entwuerfe = Number(t?.mails?.entwuerfe || 0);
  const raus = Number(t?.whatsapp?.raus || 0);
  const nummern = Number(t?.whatsapp?.menschen || 0);
  const gelaufen = Number(t?.auftraege?.gelaufen || 0);
  const teileKurz = [
    antworten ? `${zahl(antworten)} ${antworten === 1 ? "Postfach-Antwort" : "Postfach-Antworten"}` : "keine Postfach-Antwort",
    raus ? `${zahl(raus)} WhatsApp raus` : null,
    gelaufen ? `${zahl(gelaufen)} ${gelaufen === 1 ? "Auftrag" : "Aufträge"} gelaufen` : null,
  ].filter(Boolean);
  // E-244: ehrlich beschriftet — „Mails" waren die Antworten im Postfach, „WhatsApp" alle Absender,
  // die KI-Kosten nur die der Aufträge. Maras eigene Zahlen je Weg stehen in „Maras Bilanz".
  const titel = `Postfach: ${antworten} Antworten${entwuerfe ? ` · ${entwuerfe} Entwürfe` : ""} · WhatsApp alle Absender: ${raus} raus an ${nummern} Nummern · ${gelaufen} Aufträge gelaufen.`
    + " Postfach = Antworten auf eingegangene Mails (nicht die Mail-Aktion). WhatsApp = alle Absender (Mara, Team, Leitung). Maras eigene Zahlen und alle KI-Kosten: „Maras Bilanz“ in der Leiste oben.";
  const offen = ((t?.offen ?? []) as { was: string; wieviel: number }[]).map((o) => `${o.wieviel} ${o.was}`).join(" · ");
  return { kurz: teileKurz.join(" · "), offen, titel };
}

// E-252 (28.09.2026, Gegenprüfung): `verborgen` — der Aufklapper bleibt nach dem ersten Öffnen stehen und wird nur
// ausgeblendet, damit ein halb geschriebener Auftrag oder eine ungespeicherte Anweisung beim Wechsel zu KI, Bilanz
// oder Rundgang nicht verloren geht. `children` (Deine Anweisung an Mara) steht auch da, wenn die Aufträge nicht laden.
function MaraBefehl({ children, verborgen }: { children?: ReactNode; verborgen?: boolean }) {
  const d = useMaraDaten<AuftraegeDaten>("auftraege", MARA_QUELLEN.auftraege);
  const { meldung, melden, zu } = useMeldung();
  const [befehl, setBefehl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [dauerBefehl, setDauerBefehl] = useState("");
  const [dauerZeit, setDauerZeit] = useState("09:00");
  const [dauerTakt, setDauerTakt] = useState("taeglich");
  const [wissenOffen, setWissenOffen] = useState(false);

  const ruf = async (pfad: string, koerper?: unknown) => {
    const r = await fetch(`${API}${pfad}`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(koerper ?? {}),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || j?.ok === false) throw new Error(j?.error || "Das hat nicht geklappt.");
    return j;
  };

  const planen = async () => {
    if (befehl.trim().length < 4) return;
    setBusy("plan");
    try {
      const j = await ruf("/chef/mara/auftrag", { befehl: befehl.trim() });
      melden(j.auftrag?.status === "rueckfrage" ? "Mara hat eine Rückfrage — sie steht unter „Wartet auf dich“." : "Plan steht — sieh ihn dir unter „Wartet auf dich“ an und bestätige.", "befehl");
      setBefehl(""); d.neu();
    } catch (e: any) { melden(e.message, "befehl", true); } finally { setBusy(null); }
  };

  const ausfuehren = async (a: Auftrag) => {
    const endgueltig = a.plan.filter((s) => s.klasse === "endgueltig");
    if (endgueltig.length && !window.confirm(
      `Dieser Auftrag enthält ${endgueltig.length} endgültige(n) Schritt:\n\n`
      + endgueltig.map((s) => `· ${s.werkzeug}${s.wen ? ` — ${s.wen}` : ""}`).join("\n")
      + "\n\nDas lässt sich nicht mit einem Klick zurücknehmen. Ausführen?")) return;
    setBusy(`a${a.id}`);
    try {
      const j = await ruf(`/chef/mara/auftrag/${a.id}/ausfuehren`);
      melden((j.ergebnis ?? []).map((x: any) => x.text).join(" · ") || "Erledigt.", "auftraege");
      d.neu();
    } catch (e: any) { melden(e.message, "auftraege", true); } finally { setBusy(null); }
  };

  const verwerfen = async (id: number) => {
    setBusy(`v${id}`);
    try { await ruf(`/chef/mara/auftrag/${id}/verwerfen`); melden("Verworfen.", "auftraege"); d.neu(); }
    catch (e: any) { melden(e.message, "auftraege", true); } finally { setBusy(null); }
  };

  const dauerAnlegen = async () => {
    if (dauerBefehl.trim().length < 4) return;
    setBusy("dauer");
    try {
      await ruf("/chef/mara/dauerauftrag", { befehl: dauerBefehl.trim(), takt: dauerTakt, uhrzeit: dauerZeit });
      melden("Dauerauftrag angelegt. Er wird bei jedem Lauf neu geplant.", "dauer");
      setDauerBefehl(""); d.neu();
    } catch (e: any) { melden(e.message, "dauer", true); } finally { setBusy(null); }
  };

  const kopf = (
    <div className="mara-kopfzeile">
      <div>
        <h2>Mara anweisen</h2>
        <p className="mara-leise mara-satz">Schreib in einem Satz, was passieren soll. Mara legt dir einen Plan vor — nichts wirkt, bevor du bestätigst.</p>
      </div>
    </div>
  );
  if (d.fehler && !d.daten) return <section id="mara-p-anweisen" className="mara-aufklapper mp-befehl" aria-label="Mara anweisen" hidden={verborgen}>{kopf}<Fehlermeldung text={d.fehler} erneut={d.neu} />{children}</section>;
  if (!d.daten) return <section id="mara-p-anweisen" className="mara-aufklapper mp-befehl" aria-label="Mara anweisen" hidden={verborgen}>{kopf}<Geruest zeilen={3} />{children}</section>;

  const t = d.daten.tag;
  const heute = t ? tagZeile(t) : null;
  const offen = d.daten.auftraege.filter(wartetAufDich);
  const erledigt = d.daten.auftraege.filter((a) => !wartetAufDich(a));
  const dauer = d.daten.dauerauftraege;

  return (
    <section id="mara-p-anweisen" className="mara-aufklapper mp-befehl" aria-label="Mara anweisen" hidden={verborgen}>
      {kopf}

      <div className="mp-befehl-eingabe">
        <textarea rows={2} value={befehl} maxLength={1000} aria-label="Was soll Mara tun?"
          onChange={(ev) => setBefehl(ev.target.value)}
          onKeyDown={(ev) => { if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) void planen(); }}
          placeholder="Zum Beispiel: Kündige den Kunden Gerold Kuhn, er hat angerufen. (⌘ + Enter)" />
        <button type="button" className="mara-knopf haupt" disabled={busy === "plan" || befehl.trim().length < 4} onClick={() => void planen()}>
          {busy === "plan" ? "Denkt nach …" : "Plan bauen"}
        </button>
      </div>
      <Meldung m={meldung} ort="befehl" onZu={zu} />

      {/* Zweiter sichtbarer Abschnitt: Maras Ton — das Mail-Glas verlinkt hierher. */}
      {children}

      {/* ── Was auf dich wartet, dazu Maras Tag als eine Zeile ─────────── */}
      <div className="mara-abschnitt mp-auftraege">
        <div className="mp-anw-kopf">
          <span className="mara-etikett">{offen.length ? `Wartet auf dich (${offen.length})` : "Nichts wartet auf dich"}</span>
          {heute && (
            <span className="mara-klein mp-tag" title={heute.titel}>
              <span className="mara-etikett">Heute</span> <span className="mara-leise">{heute.kurz}</span>
              {heute.offen ? <span className="mara-warn-t"> · {heute.offen}</span> : null}
            </span>
          )}
        </div>
        <Meldung m={meldung} ort="auftraege" onZu={zu} />
        {offen.map((a) => (
          <div key={a.id} className={`mp-auftrag${a.status === "rueckfrage" ? " frage" : ""}`}>
            <p className="mp-auftrag-befehl">„{a.befehl}"</p>
            {a.rueckfrage
              ? <p className="mp-auftrag-frage">{a.rueckfrage}</p>
              : (
                <>
                  {a.absicht && <p className="mp-still">{a.absicht}</p>}
                  <ol className="mp-plan">
                    {a.plan.map((sch, i) => (
                      <li key={i} className={sch.klasse === "endgueltig" ? "endgueltig" : ""}>
                        <b>{sch.werkzeug.replace(/_/g, " ")}</b>
                        {sch.wen ? <span className="mp-plan-wen">{sch.wen}</span> : null}
                        <span className={`mp-klasse ${sch.klasse}`}>{KLASSE_TEXT[sch.klasse] ?? sch.klasse}</span>
                        {sch.warum && <span className="mp-still">{sch.warum}</span>}
                      </li>
                    ))}
                  </ol>
                </>
              )}
            <div className="mp-auftrag-tun">
              {!a.rueckfrage && a.plan.length > 0 && (
                <button type="button" className="mara-knopf haupt klein" disabled={!!busy} onClick={() => void ausfuehren(a)}>
                  {busy === `a${a.id}` ? "Läuft …" : "Ausführen"}
                </button>
              )}
              <button type="button" className="mara-knopf klein" disabled={!!busy} onClick={() => void verwerfen(a.id)}>Verwerfen</button>
              <span className="mp-still">{seit(a.erstelltAm)} · {a.von}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Daueraufträge ────────────────────────────────────────────── */}
      <details className="mara-klappe mp-dauer">
        <summary>Daueraufträge{dauer.length ? ` (${dauer.length})` : ""} — wiederkehrend, bei jedem Lauf neu geplant</summary>
        <p className="mp-still">
          Enthält ein Lauf einen endgültigen Schritt, wartet er auf deinen Klick — ein Dauerauftrag kündigt niemanden von selbst.
        </p>
        {dauer.map((x) => (
          <div key={x.id} className="mp-dauer-zeile">
            <div>
              <b>„{x.befehl}"</b>
              <span className="mp-still">{x.takt === "werktags" ? "werktags" : x.takt === "woechentlich" ? "montags" : "täglich"} um {x.uhrzeit}
                {x.letzterLauf ? ` · zuletzt ${seit(x.letzterLauf)}` : " · noch nie gelaufen"}</span>
              {x.letzteMeldung && <span className="mp-still">{x.letzteMeldung}</span>}
            </div>
            <div className="mp-dauer-tun">
              <button type="button" className={`mara-schalter klein${x.an ? " an" : ""}`} aria-pressed={x.an}
                onClick={() => void ruf(`/chef/mara/dauerauftrag/${x.id}`, { an: !x.an }).then(() => d.neu()).catch((e) => melden(e.message, "dauer", true))}>
                <span className="bahn" aria-hidden="true" /><span>{x.an ? "an" : "aus"}</span>
              </button>
              <button type="button" className="mara-knopf klein"
                onClick={() => { if (window.confirm("Diesen Dauerauftrag löschen?")) void ruf(`/chef/mara/dauerauftrag/${x.id}`, { loeschen: true }).then(() => d.neu()).catch((e) => melden(e.message, "dauer", true)); }}>
                Löschen
              </button>
            </div>
          </div>
        ))}
        <div className="mp-befehl-eingabe mp-dauer-neu">
          <input value={dauerBefehl} maxLength={500} onChange={(ev) => setDauerBefehl(ev.target.value)} aria-label="Neuer Dauerauftrag"
            placeholder="Zum Beispiel: Schau, wer heute Geburtstag hat, und schick eine Glückwunsch-Nachricht." />
          <select value={dauerTakt} onChange={(ev) => setDauerTakt(ev.target.value)} aria-label="Takt">
            <option value="taeglich">täglich</option>
            <option value="werktags">werktags</option>
            <option value="woechentlich">montags</option>
          </select>
          <input type="time" value={dauerZeit} onChange={(ev) => setDauerZeit(ev.target.value)} aria-label="Uhrzeit" />
          <button type="button" className="mara-knopf" disabled={busy === "dauer" || dauerBefehl.trim().length < 4} onClick={() => void dauerAnlegen()}>
            {busy === "dauer" ? "Legt an …" : "Dauerauftrag anlegen"}
          </button>
        </div>
        <Meldung m={meldung} ort="dauer" onZu={zu} />
      </details>

      {/* ── Ihr Wissen und ihre Zugriffe ─────────────────────────────── */}
      <details className="mara-klappe mp-darf" onToggle={(ev) => setWissenOffen((ev.target as HTMLDetailsElement).open)}>
        <summary>Was Mara darf — {d.daten.werkzeuge.length} Werkzeuge</summary>
        {wissenOffen && (
          <ul className="mp-werkzeuge">
            {d.daten.werkzeuge.map((w) => (
              <li key={w.name}>
                <b>{w.name.replace(/_/g, " ")}</b>
                <span className={`mp-klasse ${w.klasse}`}>{KLASSE_TEXT[w.klasse] ?? w.klasse}</span>
                <span className="mp-still">{w.beschreibung}</span>
              </li>
            ))}
            <li className="mp-nicht">
              <b>nicht: Texte im Quelltext der Website</b>
              <span className="mp-still">
                Dafür bräuchte sie Schreibrechte auf den laufenden Code; ein falscher Satz dort nimmt die ganze Seite mit.
                Texte aus der Datenbank kann sie ändern.
              </span>
            </li>
          </ul>
        )}
      </details>

      {/* ── Was gelaufen ist ─────────────────────────────────────────── */}
      {erledigt.length > 0 && (
        <details className="mara-klappe mp-gelaufen">
          <summary>Was gelaufen ist ({erledigt.length})</summary>
          {erledigt.map((a) => (
            <div key={a.id} className="mp-auftrag erledigt">
              <p className="mp-auftrag-befehl">„{a.befehl}" <span className="mp-klasse">{STATUS_TEXT[a.status] ?? a.status}</span></p>
              <ul className="mp-ergebnis">
                {(a.ergebnis ?? []).map((r, i) => (
                  <li key={i} className={r.ok === false ? "fehler" : ""}>{r.text}{r.wen ? ` — ${r.wen}` : ""}</li>
                ))}
              </ul>
              <span className="mp-still">{seit(a.fertigAm ?? a.erstelltAm)} · {a.von}</span>
            </div>
          ))}
        </details>
      )}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// REITER „E-MAIL-AKTION" (E-252: Status · Kette · Wen | Wie · Was rausging)
// ═══════════════════════════════════════════════════════════════════════════
/** Ein Feld der Statuszeile: große dünne Zahl (bei 0 ein Wort), Etikett, leiser Satz. */
function StZahl({ wert, titel, unter }: { wert: string; titel: string; unter?: string }) {
  const wort = !/\d/.test(wert);
  return (
    <div className="st">
      <span className={`gross${wort ? " wort" : ""}`}>{wert}</span>
      <div className="st-text"><div>{titel}</div>{unter ? <small>{unter}</small> : null}</div>
    </div>
  );
}

const SO_ARBEITET_MARA = (
  <ul>
    <li><b>Wen:</b> jeden mit offener Rechnung — A (Zahlung gemeldet, Geld nicht da) vor B (Antrag fertig). Heißeste zuerst: das jüngste Ereignis.</li>
    <li><b>Wann:</b> erste Mail 24 Stunden nach Antrag bzw. Zahlungsmeldung, dann nach 2, 4 und 7 Tagen, danach alle 14 Tage — bis er zahlt. Rund um die Uhr.</li>
    <li><b>Wie:</b> jede Mail aus seiner Akte, seinem ganzen Weg und ihrem Gedächtnis geschrieben — nie zweimal dieselbe. Knopf zur Zahlungsseite, Karte positiv, keine Zusage, keine Frist.</li>
    <li><b>Rücksicht:</b> Schreibt der Kunde selbst, antwortet Mara im Postfach und die Aktion wartet 7 Tage. Hat ein Mitarbeiter in den letzten 12 Stunden mit ihm gesprochen oder ging vor weniger als 6 Stunden eine andere Mail raus, wartet sie.</li>
    <li><b>Nie:</b> bei Werbesperre, Vertriebssperre, „Stopp“, Storno, Kündigung, Zustellproblem — oder wenn du ihn hier aus der Aktion nimmst.</li>
    <li><b>Prüfung:</b> Jede Mail läuft durch die Wortwand (nichts garantieren, nichts empfehlen, keine Frist) und die Sie-Form. Was hängen bleibt, geht nicht raus und steht unter „Zurückgehalten“.</li>
  </ul>
);

const STUFE_ZEILE: Record<"A" | "B", { was: string; unter: string }> = {
  A: { was: "Zahlung gemeldet", unter: "Geld nicht da — kommt zuerst" },
  B: { was: "Rechnung offen", unter: "Antrag fertig, nicht bezahlt" },
};

function MaraMailAktion({ onAnweisungZeigen }: { onAnweisungZeigen: () => void }) {
  const stand = useMaraDaten<Stand>("stand", MARA_QUELLEN.stand);
  const rg = useMaraRundgang();
  const { meldung, melden, zu } = useMeldung();
  const [status, setStatus] = useState<MailStatus>("gesendet");
  const [probe, setProbe] = useState<any | null>(null);
  const [beschaeftigt, setBeschaeftigt] = useState<string | null>(null);
  const [runde, setRunde] = useState(0);
  const [schlangeAlle, setSchlangeAlle] = useState(false);
  // Der Regler zeigt beim Ziehen den neuen Wert; gespeichert wird beim Loslassen (wie bisher).
  const [taktZiehen, setTaktZiehen] = useState<number | null>(null);
  const s = stand.daten;
  const e = s?.einstellungen;
  useEffect(() => { setTaktZiehen(null); }, [e?.jeStunde]);

  const setzen = async (schluessel: string, wert: string, satz: string, ort: string) => {
    try { await senden("/chef/mara/einstellung", { schluessel, wert }); melden(satz, ort); stand.neu(); } catch (err: any) { melden(err.message, ort, true); }
  };
  const probeSchreiben = async (personId?: number) => {
    setBeschaeftigt("probe");
    try { setProbe(await senden("/chef/mara/probe", personId ? { personId } : {})); }
    catch (err: any) { melden(err.message, personId ? "wen" : "steuer", true); } finally { setBeschaeftigt(null); }
  };
  const durchgang = async () => {
    if (!window.confirm("Mara schickt jetzt die nächsten Mails — nach denselben Regeln wie im Takt (Stunde, Kostendeckel). Weiter?")) return;
    setBeschaeftigt("durchgang");
    try {
      const j = await senden("/chef/mara/durchgang", {});
      const r = j.ergebnis || {};
      melden(r.grund ? `Kein Versand: ${r.grund}.` : `${r.gesendet} gesendet, ${r.abgelehnt} von der Prüfung zurückgehalten${r.fehler ? `, ${r.fehler} Fehler` : ""}.`, "steuer");
      stand.neu(); setRunde((x) => x + 1);
    } catch (err: any) { melden(err.message, "steuer", true); } finally { setBeschaeftigt(null); }
  };
  const taktSpeichern = (wert: string) => void setzen("mara_aktion_je_stunde", wert, `Takt: ${wert} je Stunde.`, "steuer");

  const rate = e ? e.jeStunde : 0;
  const takt = taktZiehen ?? rate;
  const schlangeZahl = s ? `${zahl(s.schlange.length)}${s.schlange.length >= 40 ? "+" : ""}` : "";
  const z = s?.zahlen;
  const heuteBeantwortet = Number(z?.postfach?.heute_beantwortet || 0);

  return (
    <div className="mp">
      <Rundgang raum="mara" titel="Mara" schritte={RUNDGAENGE.mara.schritte} {...rg} />
      {stand.laedt && !s && <Geruest zeilen={8} />}
      {stand.fehler && !s && <Fehlermeldung text={stand.fehler} erneut={stand.neu} />}
      {s && e && z && (
        <>
          {/* ── Status: der Schalter und was heute läuft ─────────────────── */}
          <div className="mara-status mp-status" aria-label="Zustand der Mail-Aktion">
            <div className="st voll">
              <button type="button" className={`mara-schalter mp-aktion-schalter${e.an ? " an" : ""}`} data-mara-schalter="mail" aria-pressed={e.an}
                onClick={() => void setzen("mara_aktion_an", e.an ? "aus" : "an", e.an ? "Aktion pausiert." : "Aktion läuft — die nächsten Mails gehen im Takt raus.", "status")}>
                <span className="bahn" aria-hidden="true" /><span>{e.an ? "Aktion läuft" : "Aktion pausiert"}</span>
              </button>
            </div>
            <StZahl wert={oderWort(s.zaehler.heute, "keine")} titel="heute gesendet"
              unter={rate > 0 ? `von ${zahl(s.zaehler.tagesDeckel)} möglich (24 × ${e.jeStunde}) · nur wer fällig ist` : "der Takt steht still"} />
            <StZahl wert={oderWort(s.zaehler.letzteStunde, "keine")} titel="letzte Stunde"
              unter={rate > 0 ? `Takt jetzt ${rate} je Stunde` : "der Takt steht still"} />
            <StZahl wert={s.schlange.length ? schlangeZahl : "niemand"} titel="in der Schlange" unter="fällig, nach Hitze" />
            {/* E-252 (Gegenprüfung): morgens vor der ersten Mail ein Wort statt „0,00 €" — gerundet auf Cent, wie euro() zeigt. */}
            <StZahl wert={Math.round(s.kosten.heuteEuro * 100) > 0 ? euro(s.kosten.heuteEuro) : "keine"} titel="Kosten heute"
              unter={`Deckel ${euro(e.tagEuro)} · ${Math.round(s.kosten.wocheEuro * 100) > 0 ? `Woche ${euro(s.kosten.wocheEuro)}` : "Woche noch nichts"}`} />
            <div className="st rechts">
              <span className="mara-still mara-klein" title="lädt jede Minute neu, solange der Tab offen ist">
                {stand.geladenAm ? `Stand ${uhrBerlin(stand.geladenAm)}` : "lädt jede Minute neu"}
                {stand.fehler ? <> · <button type="button" className="mara-knopf text" onClick={stand.neu}>Neu laden gescheitert — nochmal</button></> : null}
              </span>
            </div>
          </div>
          <Meldung m={meldung} ort="status" onZu={zu} />
          {!e.an && (
            <div className="mara-hinweise">
              <p className="mara-hinweis warn"><span className="mara-punkt warn" aria-hidden="true" /><span>Die Aktion ist pausiert. Antworten im Postfach laufen weiter.</span></p>
            </div>
          )}

          {/* ── Wirkung 14 Tage: die Kette bis zum Geld ───────────────────── */}
          <div className="mara-kette mp-kette" aria-label="Wirkung 14 Tage"
            title="Antworten: Menschen, deren Mail im Postfach einging, nachdem Mara sie angeschrieben hatte. Geld: gebuchte Zahlung höchstens 14 Tage nach Maras Mail (wie /chef/zahlen) — zeitliche Folge, kein Beweis.">
            <span className="mara-etikett">Wirkung 14 Tage</span>
            {z.menschen ? <span><b>{zahl(z.menschen)}</b>Menschen angeschrieben</span> : <span>noch niemand angeschrieben</span>}
            <span className="pfeil" aria-hidden="true">→</span>
            {z.antworten ? <span><b className="akz">{zahl(z.antworten)}</b>{z.antworten === 1 ? "Antwort" : "Antworten"}</span> : <span>noch keine Antwort</span>}
            <span className="pfeil" aria-hidden="true">→</span>
            {z.bezahlt ? (
              <>
                <span><b>{zahl(z.bezahlt)}</b>{z.bezahlt === 1 ? "Mensch zahlte" : "Menschen zahlten"}</span>
                <span className="mara-leise"><b>{euro(z.bezahltEuro ?? 0)}</b>gebucht</span>
              </>
            ) : <span className="mara-pille warn">noch kein Geld gebucht</span>}
            {z.gemeldet > 0 && (
              <span className="mara-still mara-klein" title="Menschen, die nach Maras Mail „Zahlung gemeldet“ haben (noch kein Geld nötig).">{zahl(z.gemeldet)} × Zahlung gemeldet</span>
            )}
          </div>

          <div className="mara-spalten">
            {/* ── WEN ─────────────────────────────────────────────────── */}
            <section className="mara-wen mp-wen" aria-labelledby="mp-wen-titel">
              <div className="mara-wen-kopf">
                <h2 id="mp-wen-titel">Wen Mara anschreibt</h2>
                <p className="mara-still mara-klein" title={`Schreibt rund um die Uhr jeden an, der noch nichts bezahlt hat — ${e.stufen.join(" vor ")} zuerst, heißeste zuerst.`}>
                  rund um die Uhr jeden, der noch nichts bezahlt hat · {e.stufen.length ? e.stufen.join(" vor ") : "keine Stufe gewählt"} · heißeste zuerst
                </p>
              </div>
              <div className="mp-stufen">
                {(["A", "B"] as const).map((st) => {
                  const drin = e.stufen.includes(st);
                  const neu = drin ? e.stufen.filter((x) => x !== st) : [...e.stufen, st].sort();
                  return (
                    <button key={st} type="button" className={`mp-stufe-zeile${drin ? " an" : ""}`} aria-pressed={drin}
                      onClick={() => void setzen("mara_aktion_stufen", neu.join(","), `Stufen: ${neu.join(", ") || "keine"}.`, "wen")}>
                      <span className={`mp-stufe ${st}`}>{st}</span>
                      <span className="was">{STUFE_ZEILE[st].was}<small>{STUFE_ZEILE[st].unter}</small></span>
                      <span className={`mara-pille${drin ? " gut" : ""}`}>{drin ? "an" : "aus"}</span>
                    </button>
                  );
                })}
                <div className="mp-stufe-zeile gesperrt" title="Erst nach Prüfung der Mail-Einwilligung (§ 7 UWG)">
                  <span className="mp-stufe C">C</span>
                  <span className="was">wartet auf Einwilligung<small>gesperrt — § 7 UWG</small></span>
                  <span className="mara-pille">gesperrt</span>
                </div>
              </div>
              <Meldung m={meldung} ort="wen" onZu={zu} />
              <div className="mara-zwischen">{s.schlange.length ? `Als Nächstes dran · Schlange ${schlangeZahl}` : "Als Nächstes dran"}</div>
              <Schlange liste={schlangeAlle ? s.schlange : s.schlange.slice(0, 5)} onProbe={(id) => void probeSchreiben(id)} beschaeftigt={!!beschaeftigt} />
              {s.schlange.length > 5 && (
                <button type="button" className="mara-knopf klein mara-mehr" onClick={() => setSchlangeAlle((x) => !x)}>
                  {schlangeAlle ? "Nur die ersten 5 zeigen" : "Ganze Schlange zeigen"}
                </button>
              )}
            </section>

            {/* ── WIE: die eine Glasfläche ───────────────────────────────── */}
            <section className="mara-glas mp-steuer" aria-labelledby="mp-wie-titel">
              <div className="mara-kopfzeile">
                <div>
                  <h2 id="mp-wie-titel">Wie Mara Lindner schreibt</h2>
                  <p className="mara-still mara-klein">Jede Änderung wirkt sofort.</p>
                </div>
              </div>
              <div className="mara-feldgitter">
                <div className="mara-feld breit">
                  <label htmlFor="mp-stunde">Mails je Stunde{takt > 0 ? <> <b>{takt}</b></> : null}</label>
                  <input id="mp-stunde" type="range" min={0} max={500} step={10} value={takt}
                    onChange={(ev) => setTaktZiehen(Number(ev.target.value))}
                    onMouseUp={(ev) => taktSpeichern((ev.target as HTMLInputElement).value)}
                    onTouchEnd={(ev) => taktSpeichern((ev.target as HTMLInputElement).value)}
                    onKeyUp={(ev) => taktSpeichern((ev.target as HTMLInputElement).value)} />
                  <small>{takt > 0 ? `${(takt * 24).toLocaleString("de-DE")} am Tag` : "der Takt steht still"} · 0 bis 500</small>
                </div>
                <div className="mara-feld">
                  <label htmlFor="mp-euro">Kostendeckel je Tag</label>
                  <span className="mara-reihe">
                    <input id="mp-euro" key={e.tagEuro} type="number" min={0} max={500} defaultValue={e.tagEuro} className="mara-eingabe mara-eingabe-zahl"
                      onBlur={(ev) => { if (Number(ev.target.value) !== e.tagEuro) void setzen("mara_aktion_tag_euro", ev.target.value, `Kostendeckel: ${ev.target.value} € am Tag.`, "steuer"); }} />
                    <span>€</span>
                  </span>
                  <small>{e.jeStunde > 0 ? `rund ${(((e.jeStunde * 24) * 0.005)).toFixed(2).replace(".", ",")} € bei vollem Takt` : "ohne Takt keine Kosten"}</small>
                </div>
                <div className="mara-feld">
                  <span className="mara-feld-titel">Stil</span>
                  <span className="mara-reihe">
                    <button type="button" className={`mara-knopf klein${e.emojis ? " an" : ""}`} aria-pressed={e.emojis}
                      onClick={() => void setzen("mara_aktion_emojis", e.emojis ? "aus" : "an", e.emojis ? "Ohne Emojis." : "Höchstens ein Emoji je Mail.", "steuer")}>
                      {e.emojis ? "ein Emoji erlaubt" : "ohne Emojis"}
                    </button>
                    <select className="mara-eingabe" value={e.postfach} aria-label="Absender"
                      onChange={(ev) => void setzen("mara_aktion_postfach", ev.target.value, `Absender: ${ev.target.value}.`, "steuer")}>
                      <option value="support@fiaon.com">von support@fiaon.com</option>
                      <option value="welcome@fiaon.com">von welcome@fiaon.com</option>
                    </select>
                  </span>
                </div>
              </div>
              <div className="mara-startreihe">
                <button type="button" className="mara-knopf" disabled={!!beschaeftigt} onClick={() => void probeSchreiben()}>
                  {beschaeftigt === "probe" ? "Mara schreibt …" : "Probe: nächste Mail ansehen"}
                </button>
                <button type="button" className="mara-knopf haupt" disabled={!!beschaeftigt || !e.an} onClick={() => void durchgang()}
                  title={e.an ? undefined : "Die Aktion ist pausiert — erst oben einschalten."}>
                  {beschaeftigt === "durchgang" ? "Sendet …" : "Jetzt einen Durchgang"}
                </button>
                {!e.an && <span className="mara-still mara-klein">Pausiert — ein Durchgang geht erst, wenn die Aktion läuft.</span>}
              </div>
              <Meldung m={meldung} ort="steuer" onZu={zu} />
              <p className="mara-klein mp-ton-link">
                <button type="button" className="mara-knopf text" onClick={onAnweisungZeigen}>Ihr Ton: Deine Anweisung an Mara →</button>
              </p>
              <details className="mara-klappe mp-regeln">
                <summary>So arbeitet Mara</summary>
                {SO_ARBEITET_MARA}
              </details>
            </section>
          </div>

          {/* ── Darunter: was rausging ───────────────────────────────────── */}
          <div className="mara-darunter">
            <section className="mara-karte mp-rausging" aria-labelledby="mp-rausging-titel">
              <div className="mara-kopfzeile">
                <div><h2 id="mp-rausging-titel">Was rausging</h2><p className="mara-still mara-klein">Zeile antippen: Text, Maras Gedächtnis, Denkprotokoll</p></div>
              </div>
              <nav className="mp-reiter" aria-label="Mails">
                {([["gesendet", "Gesendet", z.gesendet], ["abgelehnt", "Zurückgehalten", z.abgelehnt], ["fehler", "Fehler", z.fehler]] as [MailStatus, string, number][]).map(([k, t, n]) => (
                  <button key={k} type="button" className={`mp-reiter-knopf${status === k ? " an" : ""}`} aria-pressed={status === k} onClick={() => setStatus(k)}
                    title="Zahl: die letzten 14 Tage">
                    {t} · {oderWort(n, "keine")}
                  </button>
                ))}
                <a className="mp-reiter-link" href="/chef/s/postmeister">
                  {heuteBeantwortet ? `Postfach · ${zahl(heuteBeantwortet)} heute beantwortet →` : "Postfach · heute noch nichts beantwortet →"}
                </a>
              </nav>
              <Mails status={status} runde={runde} melden={(t, f) => melden(t, "liste", f)} />
              <Meldung m={meldung} ort="liste" onZu={zu} />
            </section>
          </div>
        </>
      )}

      {probe && <ProbeFenster probe={probe} onZu={() => setProbe(null)} />}
    </div>
  );
}

function Schlange({ liste, onProbe, beschaeftigt }: { liste: Stand["schlange"]; onProbe: (personId: number) => void; beschaeftigt: boolean }) {
  if (!liste.length) return <p className="mp-leer">Gerade ist niemand fällig — alle haben ihre Mail oder warten auf den nächsten Takt.</p>;
  return (
    <ol className="mp-schlange">
      {liste.map((k) => (
        <li key={k.personId}>
          <span className={`mp-stufe ${k.stufe}`}>{k.stufe}</span>
          <div className="mp-schlange-wer">
            <a className="mp-name" href={`/chef/s/akte?id=${k.personId}`} target="_blank" rel="noreferrer">{k.name}</a>
            {" "}<span className="mp-still">Mail {k.schritt} · {k.stufe === "A" ? "Zahlung gemeldet" : "Antrag"} {seit(k.ereignisAm)}{k.zuletztAm ? ` · letzte Mail ${seit(k.zuletztAm)}` : ""}</span>
            <div className="mp-still">{[k.paket, k.betragEuro != null ? euro(k.betragEuro) : null, k.wunschlimit ? `Wunschlimit ${k.wunschlimit.toLocaleString("de-DE")} €` : null].filter(Boolean).join(" · ")}</div>
          </div>
          <button type="button" className="mara-knopf klein" disabled={beschaeftigt} onClick={() => onProbe(k.personId)}>Probe</button>
        </li>
      ))}
    </ol>
  );
}

/** Die Mails eines Unterreiters: 10 sichtbar, dann in Zehnern; die Route liefert 60 je Seite (?vor=). */
function Mails({ status, runde, melden }: { status: MailStatus; runde: number; melden: (t: string, fehler?: boolean) => void }) {
  const [liste, setListe] = useState<Mail[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [offen, setOffen] = useState<number | null>(null);
  const [zeilen, setZeilen] = useState(10);
  const [ende, setEnde] = useState(false);
  const [aelterLaedt, setAelterLaedt] = useState(false);
  const holen = useCallback(async (vor?: number): Promise<Mail[]> => {
    const r = await fetch(`${API}/chef/mara/mails?status=${status}${vor ? `&vor=${vor}` : ""}`, { credentials: "include" });
    const j = await r.json().catch(() => null);
    if (!j?.ok) throw new Error(j?.error || "Die Mails ließen sich nicht laden.");
    return j.mails as Mail[];
  }, [status]);
  const laden = useCallback(async () => {
    setFehler(null);
    try { const m = await holen(); setListe(m); setEnde(m.length < 60); } catch (err: any) { setFehler(err.message); }
  }, [holen]);
  useEffect(() => { setListe(null); setZeilen(10); setEnde(false); void laden(); }, [laden, runde]);
  const aelter = async () => {
    if (!liste?.length) return;
    setAelterLaedt(true);
    try {
      const m = await holen(Math.min(...liste.map((x) => x.id)));
      setListe([...liste, ...m]); setEnde(m.length < 60); setZeilen((n) => n + 10);
    } catch (err: any) { melden(err.message, true); } finally { setAelterLaedt(false); }
  };

  if (fehler) return <Fehlermeldung text={fehler} erneut={() => void laden()} />;
  if (!liste) return <Geruest zeilen={5} />;
  if (!liste.length) return <p className="mp-leer">{status === "gesendet" ? "Noch keine Mail aus der Aktion." : status === "abgelehnt" ? "Nichts zurückgehalten — jede Mail hat die Prüfung bestanden." : "Keine Fehler."}</p>;
  const gezeigt = liste.slice(0, zeilen);
  return (
    <>
      <ol className="mp-liste">
        {gezeigt.map((m) => (
          <li key={m.id} className={`mp-zeile${offen === m.id ? " offen" : ""}`}>
            <button type="button" className="mp-zeile-knopf" aria-expanded={offen === m.id} onClick={() => setOffen(offen === m.id ? null : m.id)}>
              <span className={`mp-stufe ${m.stufe}`}>{m.stufe}</span>
              <span className="mp-zeile-inhalt">
                <span className="mp-zeile-kopf">
                  <span className="mp-name">{m.name}</span>
                  <span className="mp-still">Mail {m.schritt} · {zeit(m.am)}</span>
                  {m.antwortAm && <span className="mp-chip blau">hat geantwortet</span>}
                  {m.gemeldetAm && <span className="mp-chip gelb">Zahlung gemeldet</span>}
                  {m.bezahltAm && <span className="mp-chip gruen" title="Gebuchte Zahlung höchstens 14 Tage nach dieser Mail (wie /chef/zahlen) — zeitliche Folge, kein Beweis.">Geld gebucht</span>}
                  {m.ausgeschlossen && <span className="mp-chip">aus der Aktion</span>}
                </span>
                <span className="mp-betreff">{m.betreff || "—"}</span>
                {m.grund && <span className="mp-grund">{m.grund}</span>}
              </span>
            </button>
            {offen === m.id && <MailDetail m={m} melden={melden} onGeaendert={() => void laden()} />}
          </li>
        ))}
      </ol>
      <div className="mara-mehr-zeile">
        {zeilen < liste.length
          ? <button type="button" className="mara-knopf klein" onClick={() => setZeilen((n) => n + 10)}>Weitere 10 zeigen</button>
          : !ende
            ? <button type="button" className="mara-knopf klein" disabled={aelterLaedt} onClick={() => void aelter()}>{aelterLaedt ? "Lädt …" : "Ältere laden"}</button>
            : null}
        <span className="mara-still mara-klein">
          {gezeigt.length < liste.length
            ? `${zahl(gezeigt.length)} von ${zahl(liste.length)}${ende ? "" : "+"} gezeigt`
            : ende ? (liste.length === 1 ? "die einzige Mail" : `alle ${zahl(liste.length)} gezeigt`) : `${zahl(liste.length)} gezeigt`}
        </span>
      </div>
    </>
  );
}

/** Warum diese Mail so aussieht — erst geladen, wenn man es aufklappt. */
function Denkprotokoll({ id }: { id: number }) {
  const [offen, setOffen] = useState(false);
  const [daten, setDaten] = useState<{ wissen: Record<string, unknown> | null; maengel: string[]; verlauf: { wer: string; art: string; text: string; am: string }[] } | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState(false);
  useEffect(() => {
    if (!offen || daten) return;
    let weg = false;
    setLaedt(true); setFehler(false);
    fetch(`${API}/chef/mara/denkprotokoll/${id}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => { if (weg) return; if (j?.ok) setDaten(j); else setFehler(true); })
      .catch(() => { if (!weg) setFehler(true); })
      .finally(() => { if (!weg) setLaedt(false); });
    return () => { weg = true; };
  }, [offen, id, daten]);
  return (
    <details className="mara-klappe mp-denk" onToggle={(e) => setOffen((e.target as HTMLDetailsElement).open)}>
      <summary>Denkprotokoll — was sie wusste und was geprüft wurde</summary>
      {!offen ? null : laedt && !daten ? <Geruest zeilen={3} /> : daten ? (
        <div className="mp-wissen">
          <ul>
            {Object.entries(daten.wissen ?? {}).map(([k, v]) => (
              <li key={k}><span className="mp-still">{WISSEN_TEXT[k] ?? k}</span> {v === null || v === "" ? "—" : String(v)}</li>
            ))}
            {!daten.wissen && <li className="mp-still">Für diese Mail wurde noch kein Protokoll mitgeschrieben (vor dem 22.09.2026).</li>}
          </ul>
          {daten.maengel?.length > 0 && (
            <p className="mp-grund">Die Prüfung hatte etwas zu beanstanden: {daten.maengel.join(" · ")}</p>
          )}
          {daten.verlauf?.length > 0 && (
            <>
              <h3>Was im Haus um diese Zeit passiert ist</h3>
              <ul className="mp-post">
                {daten.verlauf.slice(0, 6).map((v, i) => (
                  <li key={`${i}-${v.am}`}><span className="mp-still">{zeit(v.am)} · {v.wer}</span> {v.text}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : <p className="mp-grund">{fehler ? "Das Denkprotokoll ließ sich nicht laden — zu- und wieder aufklappen versucht es erneut." : "Nicht ladbar."}</p>}
    </details>
  );
}

function MailDetail({ m, melden, onGeaendert }: { m: Mail; melden: (t: string, fehler?: boolean) => void; onGeaendert: () => void }) {
  const person = useDaten<{ gedaechtnis: { am: string; text: string; quelle: string }[]; postfach: any[]; ausschluss: any }>(`/chef/mara/person/${m.personId}`);
  const [gedaechtnis, setGedaechtnis] = useState<{ am: string; text: string; quelle: string }[] | null>(null);
  const g = gedaechtnis ?? person.daten?.gedaechtnis ?? [];
  const aus = async (raus: boolean) => {
    try { await senden("/chef/mara/ausschluss", { personId: m.personId, aus: raus }); melden(raus ? `${m.name} ist aus der Aktion genommen.` : `${m.name} ist wieder in der Aktion.`); onGeaendert(); } catch (err: any) { melden(err.message, true); }
  };
  const vergessen = async (index: number) => {
    try { const j = await senden("/chef/mara/gedaechtnis/loeschen", { personId: m.personId, index }); setGedaechtnis(j.gedaechtnis); } catch (err: any) { melden(err.message, true); }
  };
  return (
    <div className="mp-detail">
      <div className="mp-mail">
        <div className="mp-mail-kopf"><span>An {m.empfaenger}</span><span>{m.kostenCent ? `${m.kostenCent.toFixed(2).replace(".", ",")} ct` : ""}</span></div>
        {/* E-252: ohne eigene Höhe — kein zweiter Scrollbereich; die Mail steht ganz da. */}
        <pre className="mp-mail-text">{m.text || "—"}</pre>
      </div>
      <div className="mp-seite">
        <h3>Was Mara sich zu {m.name.split(" ")[0]} gemerkt hat</h3>
        {person.fehler && !person.daten ? <Fehlermeldung text={person.fehler} erneut={person.neu} />
          : person.laedt && !person.daten ? <Geruest zeilen={2} /> : g.length ? (
            <ul className="mp-gedaechtnis">
              {g.map((x, i) => (
                <li key={`${i}-${x.text.slice(0, 20)}`}>
                  <span>{x.am ? `${x.am.slice(8, 10)}.${x.am.slice(5, 7)}. · ` : ""}{x.text}</span>
                  <button type="button" className="mara-knopf text" onClick={() => void vergessen(i)} aria-label="Vergessen">Vergessen</button>
                </li>
              ))}
            </ul>
          ) : <p className="mp-still">Noch nichts — Mara merkt sich, was der Kunde ihr schreibt.</p>}
        {(person.daten?.postfach?.length ?? 0) > 0 && (
          <>
            <h3>Seine Mails an uns</h3>
            <ul className="mp-post">
              {person.daten!.postfach.slice(0, 6).map((p: any) => (
                <li key={p.id}><span className="mp-still">{zeit(p.empfangen_am)}</span> {p.zusammenfassung || p.betreff}{p.gesendet_am ? <span className="mp-chip blau">beantwortet</span> : null}</li>
              ))}
            </ul>
          </>
        )}
        <Denkprotokoll id={m.id} />
        <div className="mara-startreihe">
          <a className="mara-knopf klein" href={`/chef/s/akte?id=${m.personId}`} target="_blank" rel="noreferrer">Akte öffnen</a>
          {m.ausgeschlossen
            ? <button type="button" className="mara-knopf klein" onClick={() => void aus(false)}>Wieder in die Aktion</button>
            : <button type="button" className="mara-knopf klein warn" onClick={() => void aus(true)}>Aus der Aktion nehmen</button>}
        </div>
      </div>
    </div>
  );
}

/**
 * E-252 (28.09.2026, Gegenprüfung): Ein Textfeld, das mit seinem Text wächst — sonst rollten die drei
 * Anweisungsfelder je für sich (bis zu 4.000 Zeichen in 72 px), und die Seite hätte vier Rollbereiche.
 * Ausgeblendet (Aufklapper zu) wird nicht gemessen; bei geänderter Breite neu.
 */
function MitwachsFeld(props: TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const anpassen = () => {
      if (!el.getClientRects().length) return;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight + (el.offsetHeight - el.clientHeight)}px`;
    };
    anpassen();
    window.addEventListener("resize", anpassen);
    return () => window.removeEventListener("resize", anpassen);
  }, [props.value]);
  return <textarea ref={ref} {...props} />;
}

/**
 * Maras Anweisung — Justins eigene Stimme im Kopf der Agentin.
 * Der lange Auftrag bleibt im Quelltext (dort hängen Werkzeuge und Prüfungen);
 * was hier steht, kommt GANZ OBEN hinein und gewinnt im Zweifel.
 * E-252: zweiter sichtbarer Abschnitt im Aufklapper „Mara anweisen" (#mara-anweisung).
 */
function Anweisungen() {
  const stand = useDaten<{ bereiche: { bereich: string; titel: string; text: string; verlauf: { id: number; text: string; von: string | null; aktiv: boolean; am: string }[] }[]; maxZeichen: number }>("/chef/mara/anweisung");
  const { meldung, melden, zu } = useMeldung();
  const [entwurf, setEntwurf] = useState<Record<string, string>>({});
  const [speichert, setSpeichert] = useState<string | null>(null);
  const b = stand.daten?.bereiche ?? [];

  const speichern = async (bereich: string, text: string) => {
    setSpeichert(bereich);
    try {
      const j = await senden("/chef/mara/anweisung", { bereich, text });
      melden(j.zeichen ? `Anweisung gespeichert (${j.zeichen} Zeichen) — sie gilt ab der nächsten Nachricht.` : "Anweisung gelöscht — Mara arbeitet wieder nur nach den Hausregeln.", bereich);
      setEntwurf((e) => { const n = { ...e }; delete n[bereich]; return n; });
      stand.neu();
    } catch (err: any) { melden(err.message, bereich, true); } finally { setSpeichert(null); }
  };
  const zurueck = async (bereich: string, id: number) => {
    try { await senden("/chef/mara/anweisung/zurueck", { id }); melden("Frühere Fassung ist wieder gültig.", bereich); stand.neu(); }
    catch (err: any) { melden(err.message, bereich, true); }
  };

  return (
    <div className="mara-abschnitt mp-anweisungen" id="mara-anweisung" aria-label="Maras Anweisung">
      <div className="mp-anw-kopf">
        <h3>Deine Anweisung an Mara</h3>
        <span className="mara-still mara-klein">steht vor allem anderen in ihrem Auftrag · die Hausregeln bleiben darüber</span>
      </div>
      {stand.fehler && <Fehlermeldung text={stand.fehler} erneut={stand.neu} />}
      {!stand.daten ? (stand.fehler ? null : <Geruest zeilen={3} />) : b.map((x) => {
        const wert = entwurf[x.bereich] ?? x.text;
        const geaendert = wert !== x.text;
        return (
          <div key={x.bereich} className="mp-anweisung">
            <label className="mara-etikett" htmlFor={`anw-${x.bereich}`}>{x.titel}</label>
            <MitwachsFeld
              id={`anw-${x.bereich}`}
              className="mp-feld-gross"
              rows={2}
              maxLength={stand.daten!.maxZeichen}
              placeholder="Noch nichts hinterlegt — Mara arbeitet nach den Hausregeln."
              value={wert}
              onChange={(ev) => setEntwurf((e) => ({ ...e, [x.bereich]: ev.target.value }))}
            />
            <div className="mp-anw-fuss">
              <span className="mp-still">{zahl(wert.length)} / {zahl(stand.daten!.maxZeichen)} Zeichen</span>
              <button type="button" className="mara-knopf haupt klein" disabled={!geaendert || speichert === x.bereich} onClick={() => void speichern(x.bereich, wert)}>
                {speichert === x.bereich ? "Speichert …" : "Speichern — gilt sofort"}
              </button>
              {geaendert && (
                <button type="button" className="mara-knopf klein" onClick={() => setEntwurf((e) => { const n = { ...e }; delete n[x.bereich]; return n; })}>Verwerfen</button>
              )}
            </div>
            <Meldung m={meldung} ort={x.bereich} onZu={zu} />
            {x.verlauf.length > 1 && (
              <details className="mara-klappe mp-fruehere">
                <summary>Frühere Fassungen ({x.verlauf.length - 1})</summary>
                <ul className="mp-post">
                  {x.verlauf.filter((v) => !v.aktiv).map((v) => (
                    <li key={v.id}>
                      <span className="mp-still">{zeit(v.am)} · {v.von ?? "—"}</span> {v.text.slice(0, 160)}{v.text.length > 160 ? " …" : ""}
                      <button type="button" className="mara-knopf text" onClick={() => void zurueck(x.bereich, v.id)}>Zurückholen</button>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Die Punkte des Denkprotokolls in Hauswort. */
const WISSEN_TEXT: Record<string, string> = {
  stufe: "Stufe:", schritt: "Wievielte Mail:", betreuer: "Betreuer:", faelligAm: "Rate fällig:",
  paket: "Paket:", offeneRate: "Offene Rate:", gedaechtnis: "Aus dem Gedächtnis:",
  fruehereMails: "Frühere Mails an ihn:", hausanweisung: "Deine Anweisung galt:", auftragZeichen: "Auftrag (Zeichen):",
};

/** Das Probe-Fenster — der einzige Dialog und der einzige zweite Scrollbereich der Seite. */
function ProbeFenster({ probe, onZu }: { probe: any; onZu: () => void }) {
  useEffect(() => {
    const t = (ev: KeyboardEvent) => { if (ev.key === "Escape") onZu(); };
    window.addEventListener("keydown", t);
    return () => window.removeEventListener("keydown", t);
  }, [onZu]);
  const p = probe.probe || {};
  return (
    <div className="mp-schleier" role="dialog" aria-modal="true" aria-label="Probe" onClick={onZu}>
      <div className="mp-fenster" onClick={(ev) => ev.stopPropagation()}>
        <div className="mp-fenster-kopf">
          <div>
            <span className="mp-still">Probe — nicht gesendet · Stufe {probe.fuer?.stufe} · Mail {probe.fuer?.schritt}</span>
            <h2>{probe.fuer?.name}</h2>
          </div>
          <button type="button" className="mara-knopf klein" onClick={onZu}>Schließen</button>
        </div>
        {p.ok ? (
          <>
            <p className="mp-betreff">Betreff: {p.betreff}</p>
            <pre className="mp-mail-text">{p.text}</pre>
          </>
        ) : (
          <>
            <p className="mp-grund">Diese Mail würde Mara zurückhalten: {p.grund}</p>
            {p.kern && <pre className="mp-mail-text">{p.kern}</pre>}
          </>
        )}
        {p.wissen && (
          <div className="mp-wissen">
            <h3>Was sie dabei wusste</h3>
            <ul>
              {Object.entries(p.wissen as Record<string, unknown>).map(([k, v]) => (
                <li key={k}><span className="mp-still">{WISSEN_TEXT[k] ?? k}</span> {v === null || v === "" ? "—" : String(v)}</li>
              ))}
            </ul>
          </div>
        )}
        {p.auftrag && (
          <details className="mara-klappe">
            <summary>Ihr ganzer Auftragstext ({Number(p.auftrag.length).toLocaleString("de-DE")} Zeichen)</summary>
            <pre className="mp-mail-text">{p.auftrag}</pre>
          </details>
        )}
        <p className="mp-still">Kosten dieser Probe: {Number(p.kostenCents || 0).toFixed(2).replace(".", ",")} ct</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MARAS BILANZ (26.09.2026, E-244)
//
// Justin: „Wo finde ich Maras Abschlussbericht? Ich will wissen, was wir durch
// Mara bislang hatten oder durch die neuen Leads."
//
// Eine Karte über den drei Reitern: Heute | 7 Tage | Seit Start, fünf Wege,
// darunter der Rahmen. Jede Zahl trägt ihre Quelle als title (aus dem JSON der
// Route, nicht aus dem Client). Die Rechnung: server/lib/fiaon-mara-bilanz.ts.
//
// E-252 (28.09.2026): kein Glas mehr und nicht mehr vor jedem Reiter (Befund 1)
// — ein matter Aufklapper, geöffnet über „Maras Bilanz" in der Verkaufsleiste.
// Logik, Definitionen und der Schlüssel `mara-bilanz-zeitraum` bleiben. „Heute"
// heißt nur so, wenn der Stand von heute ist; 0 € zeigt eine Pille; der
// Hinweis steht hinter (i).
// ═══════════════════════════════════════════════════════════════════════════
type BilanzName = "heute" | "woche" | "start";
interface BilanzGeld { zahlungen: number; menschen: number; cents: number }
interface BilanzZeitraum {
  name: BilanzName;
  mail: { ab: string; gesendet: number; menschen: number; antworten: number; gemeldet: number; geld: BilanzGeld; geldVorherGemeldet?: BilanzGeld };
  whatsapp: { ab: string; rein: number; reinNummern: number; antworten: number; gespraeche: number; vorlagen: number; fehler: number; termine: number; uebergaben: number; auskunft: number; geld: BilanzGeld };
  postfach: { ab: string; beantwortet: number; entwuerfe: number; handgriffe: number; handgriffeJe: Record<string, number> };
  auskunft: { ab: string; angebote: number; angeboteMenschen: number; whatsapp: number; klicks: number; bestellt: number; bezahlt: number; bezahltCents: number };
  leads: { von: string; bis: string; leads: number; leadsKonto: number; menschen: number; begonnen: number; fertig: number; zahlende: number; umsatzCents: number; werbungCents: number; kostenJeLeadCents: number | null; kostenJeZahlendemCents: number | null };
  rahmen: { ab: string; geldCents: number; zahlungen: number; rate1Cents: number; rate2Cents: number; auskunftCents: number; globalCents: number; nachMaraCents: number; nachMaraZahlungen: number; nachMaraOhneMeldungCents?: number; nachMailCents: number; nachWhatsappCents: number; kiCents: number; kiJeDienst: Record<string, number>; kuendigungen: number; kuendigungNachMail: number };
}
interface BilanzDaten {
  stand: string; heuteBerlin: string; dauerMs: number; ausZwischenspeicher: boolean; nachTagen: number; hinweis: string;
  starts: Record<string, { am: string; beleg: string; tag?: string }>;
  kostenStand: string | null;
  zeitraeume: Record<BilanzName, BilanzZeitraum>;
  definitionen: Record<string, { quelle: string; definition: string }>;
}
const HANDGRIFF_TEXT: Record<string, string> = {
  zahlungslink_bauen: "Zahlungslink", aufgabe_an_betreuer: "an Betreuer", vermerk_schreiben: "Vermerk", rechnung_anhaengen: "Rechnung",
  kuendigung_vormerken: "Kündigung", notiz_an_betreuer: "Notiz", auskunft_anbieten: "Auskunft angeboten", terminlink_bauen: "Terminlink",
  werbesperre_setzen: "Werbesperre", mahnstopp_setzen: "Mahnstopp", konto_freischalten: "Konto frei", eskalation_vorbereiten: "Eskalation",
  global_zugang_senden: "Global-Zugang",
};
const ct = (c: number | null | undefined) => (c == null ? "—" : euro(Number(c) / 100));
const zz = (n: number | null | undefined) => Number(n || 0).toLocaleString("de-DE");
const tagZeit = (s: string) => {
  try {
    return new Date(s).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
};

type BInfo = { quelle: string; definition: string } | undefined;
const infoText = (info: BInfo, zusatz?: string) => (info ? `${info.definition}${zusatz ? `\n${zusatz}` : ""}\nQuelle: ${info.quelle}` : undefined);

/**
 * E-252 (28.09.2026, Gegenprüfung): Keine nackte Null in der Bilanz. Besteht ein Wert nur aus Nullen
 * („0", „0,00 €", „0,00 € · 0", „0 · 0 Nr."), steht ein Wort: bei Geld „noch nichts", sonst „noch keine".
 * „—" (nicht berechenbar) und Werte mit einer echten Zahl bleiben, wie sie sind.
 */
const nurNull = (wert: string) => /\d/.test(wert) && !/[1-9]/.test(wert);
const nullWort = (wert: string) => (nurNull(wert) ? (wert.includes("€") ? "noch nichts" : "noch keine") : wert);

/** Eine Zeile der Bilanz. Maus: Quelle im title. Handy: Tippen klappt die Quelle unter der Zeile auf. */
function BZeile({ text, wert: roh, info, leise }: { text: string; wert: string; info?: BInfo; leise?: boolean }) {
  const [offen, setOffen] = useState(false);
  const wert = nullWort(roh);
  return (
    <div
      className={`mbz-zeile${leise ? " leise" : ""}${offen ? " offen" : ""}`} title={infoText(info)}
      role={info ? "button" : undefined} tabIndex={info ? 0 : undefined} aria-expanded={info ? offen : undefined}
      onClick={info ? () => setOffen((o) => !o) : undefined}
      onKeyDown={info ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOffen((o) => !o); } } : undefined}
    >
      <dt>{text}</dt><dd>{wert}</dd>
      {offen && info ? <dd className="mbz-info">{info.definition} <i>Quelle: {info.quelle}</i></dd> : null}
    </div>
  );
}

/** Die große Zahl je Weg — ebenfalls per Tippen erklärbar. Bei 0 eine Pille statt „0,00 €" (E-252). */
function BHeld({ wert, unter, info, pille }: { wert: string; unter: string; info?: BInfo; pille?: { text: string; ton?: "warn" } }) {
  const [offen, setOffen] = useState(false);
  return (
    <div
      className={`mbz-held${offen ? " offen" : ""}`} title={infoText(info)}
      role={info ? "button" : undefined} tabIndex={info ? 0 : undefined} aria-expanded={info ? offen : undefined}
      onClick={info ? () => setOffen((o) => !o) : undefined}
      onKeyDown={info ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOffen((o) => !o); } } : undefined}
    >
      {pille ? <b className="mbz-held-pille"><span className={`mara-pille${pille.ton ? ` ${pille.ton}` : ""}`}>{pille.text}</span></b> : <b>{wert}</b>}
      <span>{unter}</span>
      {offen && info ? <p className="mbz-info">{info.definition} <i>Quelle: {info.quelle}</i></p> : null}
    </div>
  );
}

/** Eine Kachel des Rahmens — Maus: title, Handy: Tippen zeigt die Erklärung. */
function BRahmen({ titel, wert: roh, unter, info, zusatz, klasse }: { titel: string; wert: string; unter: string; info?: BInfo; zusatz?: string; klasse?: string }) {
  const [offen, setOffen] = useState(false);
  const wert = nullWort(roh);
  return (
    <div
      className={`${klasse ?? ""}${offen ? " offen" : ""}`.trim() || undefined} title={infoText(info, zusatz)}
      role={info ? "button" : undefined} tabIndex={info ? 0 : undefined} aria-expanded={info ? offen : undefined}
      onClick={info ? () => setOffen((o) => !o) : undefined}
      onKeyDown={info ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOffen((o) => !o); } } : undefined}
    >
      <span>{titel}</span><b>{wert}</b><em>{unter}</em>
      {offen && info ? <p className="mbz-info">{info.definition}{zusatz ? ` ${zusatz}` : ""} <i>Quelle: {info.quelle}</i></p> : null}
    </div>
  );
}

function MarasBilanz() {
  const d = useMaraDaten<BilanzDaten>("bilanz", MARA_QUELLEN.bilanz);
  const [wahl, setWahl] = useState<BilanzName>(() => {
    try { const w = window.localStorage.getItem("mara-bilanz-zeitraum"); return w === "woche" || w === "start" ? w : "heute"; } catch { return "heute"; }
  });
  const [hinweisOffen, setHinweisOffen] = useState(false);
  const waehlen = (w: BilanzName) => { setWahl(w); try { window.localStorage.setItem("mara-bilanz-zeitraum", w); } catch { /* nur Bequemlichkeit */ } };
  const b = d.daten;
  const z = b?.zeitraeume?.[wahl];
  const def = (k: string) => b?.definitionen?.[k];
  // „Heute" heißt nur so, wenn der Stand wirklich von heute ist — sonst steht das Datum da.
  const heuteText = !b || b.heuteBerlin === berlinTag() ? "Heute" : tagNur(b.heuteBerlin);
  const reiterText: Record<BilanzName, string> = { heute: heuteText, woche: "7 Tage", start: "Seit Start" };
  // „ab …" nur, wenn der Weg später beginnt als der Zeitraum (Seit Start immer).
  const ab = (iso: string) => {
    if (!b || !iso) return null;
    if (wahl === "start") return `seit ${tagZeit(iso)}`;
    const nominal = wahl === "heute" ? null : new Date(new Date(b.stand).getTime() - 7 * 86400_000 + 60_000);
    if (nominal && new Date(iso) > nominal) return `ab ${tagZeit(iso)}`;
    return null;
  };
  const vorher = z?.mail.geldVorherGemeldet;

  return (
    <section id="mara-p-bilanz" className="mara-aufklapper mbz" aria-labelledby="mbz-titel">
      <header className="mbz-kopf">
        <div>
          <h2 id="mbz-titel">Maras Bilanz</h2>
          <p>
            Was Mara und die neuen Leads gebracht haben. Geld heißt gebucht, nicht gemeldet.{b ? ` Stand ${tagZeit(b.stand)} Uhr.` : ""}
            {" "}<InfoKnopf offen={hinweisOffen} onClick={() => setHinweisOffen((x) => !x)} label="Wie gezählt wird" />
          </p>
        </div>
        <div className="mbz-umschalter" role="group" aria-label="Zeitraum">
          {(["heute", "woche", "start"] as BilanzName[]).map((n) => (
            <button key={n} type="button" aria-pressed={wahl === n} onClick={() => waehlen(n)}>{reiterText[n]}</button>
          ))}
        </div>
      </header>

      {hinweisOffen && b ? (
        <p className="mara-info mbz-hinweis">
          <b>Zahlung nach Maras Kontakt = zeitliche Folge, kein Beweis.</b> Gezählt wird gebuchtes Geld (wie /chef/zahlen) höchstens {b.nachTagen} Tage nach einer Mail oder WhatsApp von Mara, ohne Testpersonen.
          {" "}Mara schreibt alle Menschen der Stufen A und B an, fast jede neue Rate 1 folgt deshalb auf eine Mara-Mail. „Vorher gemeldet“ heißt: Die Zahlung war schon vor Maras erstem Kontakt gemeldet.
          {" "}Gezählt wird bei Raten der Eingangstag (ohne Uhrzeit). Zahlungen werden oft Tage später nachgebucht, auch „Heute“ kann sich deshalb noch ändern. Fahre über eine Zahl oder tippe sie an, dann steht dort ihre Quelle.
          {b.kostenStand ? ` Werbekosten zuletzt abgerufen ${tagZeit(b.kostenStand)} Uhr.` : ""}
        </p>
      ) : null}

      {d.laedt && !b ? <Geruest zeilen={5} /> : null}
      {d.fehler && !b ? <Fehlermeldung text={d.fehler} erneut={d.neu} /> : null}

      {z && b ? (
        <>
          <div className="mbz-spalten">
            {/* ── Mail-Aktion ─────────────────────────────────────── */}
            <article className="mbz-spalte" title={b.starts.mail?.beleg}>
              <h3>Mail-Aktion</h3>
              {ab(z.mail.ab) ? <span className="mbz-ab">{ab(z.mail.ab)}</span> : null}
              <BHeld wert={ct(z.mail.geld.cents)} unter={z.mail.geld.zahlungen ? `Geld danach · ${zz(z.mail.geld.zahlungen)} ${z.mail.geld.zahlungen === 1 ? "Zahlung" : "Zahlungen"}` : "Geld danach"} info={def("mail.geld")}
                pille={z.mail.geld.cents ? undefined : { text: "noch kein Geld", ton: "warn" }} />
              <dl>
                {vorher ? (
                  <>
                    <BZeile text="davon vorher gemeldet" wert={`${ct(vorher.cents)} · ${zz(vorher.zahlungen)}`} info={def("mail.geldVorherGemeldet")} leise />
                    <BZeile text="ohne Meldung vorher" wert={ct(z.mail.geld.cents - vorher.cents)} info={def("mail.geldOhneMeldung")} />
                  </>
                ) : null}
                <BZeile text="Mails" wert={zz(z.mail.gesendet)} info={def("mail.gesendet")} />
                <BZeile text="Menschen" wert={zz(z.mail.menschen)} info={def("mail.menschen")} />
                <BZeile text="Antworten" wert={zz(z.mail.antworten)} info={def("mail.antworten")} />
                <BZeile text="Zahlung gemeldet" wert={zz(z.mail.gemeldet)} info={def("mail.gemeldet")} leise />
              </dl>
            </article>

            {/* ── WhatsApp ────────────────────────────────────────── */}
            <article className="mbz-spalte" title={b.starts.whatsapp?.beleg}>
              <h3>WhatsApp</h3>
              {ab(z.whatsapp.ab) ? <span className="mbz-ab">{ab(z.whatsapp.ab)}</span> : null}
              <BHeld wert={ct(z.whatsapp.geld.cents)} unter={z.whatsapp.geld.zahlungen ? `Geld danach · ${zz(z.whatsapp.geld.zahlungen)} ${z.whatsapp.geld.zahlungen === 1 ? "Zahlung" : "Zahlungen"}` : "Geld danach"} info={def("whatsapp.geld")}
                pille={z.whatsapp.geld.cents ? undefined : { text: "noch kein Geld", ton: "warn" }} />
              <dl>
                <BZeile text="Nachrichten rein" wert={`${zz(z.whatsapp.rein)} · ${zz(z.whatsapp.reinNummern)} Nr.`} info={def("whatsapp.rein")} />
                <BZeile text="Maras Antworten" wert={zz(z.whatsapp.antworten)} info={def("whatsapp.antworten")} />
                <BZeile text="Gespräche" wert={zz(z.whatsapp.gespraeche)} info={def("whatsapp.gespraeche")} />
                <BZeile text="Vorlagen ohne Fehler" wert={zz(z.whatsapp.vorlagen)} info={def("whatsapp.vorlagen")} />
                <BZeile text="Fehler" wert={zz(z.whatsapp.fehler)} info={def("whatsapp.fehler")} leise />
                <BZeile text="Termine · Übergaben" wert={`${zz(z.whatsapp.termine)} · ${zz(z.whatsapp.uebergaben)}`} info={def("whatsapp.termine")} />
                <BZeile text="Auskunft angeboten" wert={zz(z.whatsapp.auskunft)} info={def("whatsapp.auskunft")} />
              </dl>
            </article>

            {/* ── Postfach ────────────────────────────────────────── */}
            <article className="mbz-spalte" title={b.starts.postfach?.beleg}>
              <h3>Postfach</h3>
              {ab(z.postfach.ab) ? <span className="mbz-ab">{ab(z.postfach.ab)}</span> : null}
              <BHeld wert={zz(z.postfach.beantwortet)} unter="Mails beantwortet" info={def("postfach.beantwortet")}
                pille={z.postfach.beantwortet ? undefined : { text: "noch keine" }} />
              <dl>
                <BZeile text="Entwürfe offen" wert={zz(z.postfach.entwuerfe)} info={def("postfach.entwuerfe")} />
                <BZeile text="Handgriffe" wert={zz(z.postfach.handgriffe)} info={def("postfach.handgriffe")} />
                {Object.entries(z.postfach.handgriffeJe).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([k, v]) => (
                  <BZeile key={k} text={`· ${HANDGRIFF_TEXT[k] ?? k}`} wert={zz(v)} info={def("postfach.handgriffe")} leise />
                ))}
              </dl>
            </article>

            {/* ── Auskunft-Verkauf ────────────────────────────────── */}
            <article className="mbz-spalte" title={b.starts.auskunft?.beleg}>
              <h3>Auskunft-Verkauf</h3>
              {ab(z.auskunft.ab) ? <span className="mbz-ab">{ab(z.auskunft.ab)}</span> : null}
              <BHeld wert={ct(z.auskunft.bezahltCents)} unter={z.auskunft.bezahlt ? `bezahlt · ${zz(z.auskunft.bezahlt)} ${z.auskunft.bezahlt === 1 ? "Auskunft" : "Auskünfte"}` : "bezahlt"} info={def("auskunft.bezahlt")}
                pille={z.auskunft.bezahltCents ? undefined : { text: "noch nichts bezahlt", ton: "warn" }} />
              <dl>
                <BZeile text="Angebotsmails" wert={`${zz(z.auskunft.angebote)} · ${zz(z.auskunft.angeboteMenschen)} Menschen`} info={def("auskunft.angebote")} />
                <BZeile text="Angebote WhatsApp" wert={zz(z.auskunft.whatsapp)} info={def("auskunft.whatsapp")} />
                <BZeile text="Link geöffnet" wert={`${zz(z.auskunft.klicks)} ${z.auskunft.klicks === 1 ? "Mensch" : "Menschen"}`} info={def("auskunft.klicks")} />
                <BZeile text="Bestellt" wert={zz(z.auskunft.bestellt)} info={def("auskunft.bestellt")} />
              </dl>
            </article>

            {/* ── Neue Leads ──────────────────────────────────────── */}
            <article className="mbz-spalte" title={b.starts.leads?.beleg}>
              <h3>Neue Leads</h3>
              {wahl === "start" ? <span className="mbz-ab">seit {tagNur(z.leads.von)}</span>
                : wahl === "woche" && z.leads.von > tagNurIso(b.heuteBerlin, -6) ? <span className="mbz-ab">ab {tagNur(z.leads.von)}</span> : null}
              <BHeld wert={ct(z.leads.umsatzCents)} unter={z.leads.zahlende ? `gebucht · ${zz(z.leads.zahlende)} ${z.leads.zahlende === 1 ? "Zahlender" : "Zahlende"}` : "gebucht"} info={def("leads.umsatz")}
                pille={z.leads.umsatzCents ? undefined : z.leads.leads ? { text: "noch kein Zahlender", ton: "warn" } : { text: "kein neuer Lead" }} />
              <dl>
                <BZeile text="Leads (Meta)" wert={zz(z.leads.leads)} info={def("leads.leads")} />
                <BZeile text="Antrag begonnen · fertig" wert={`${zz(z.leads.begonnen)} · ${zz(z.leads.fertig)}`} info={def("leads.begonnen")} />
                <BZeile text="Werbekosten" wert={ct(z.leads.werbungCents)} info={def("leads.werbung")} />
                <BZeile text="je Lead" wert={ct(z.leads.kostenJeLeadCents)} info={def("leads.jeLead")} leise />
                <BZeile text="je Zahlendem" wert={z.leads.kostenJeZahlendemCents == null ? "noch keiner" : ct(z.leads.kostenJeZahlendemCents)} info={def("leads.jeZahlendem")} leise />
              </dl>
            </article>
          </div>

          {/* ── Rahmen ────────────────────────────────────────────── */}
          <div className="mbz-rahmen" aria-label="Rahmen">
            <BRahmen titel="Gesamteinnahmen" wert={ct(z.rahmen.geldCents)}
              unter={`${zz(z.rahmen.zahlungen)} ${z.rahmen.zahlungen === 1 ? "Zahlung" : "Zahlungen"} gebucht${wahl === "start" ? ` · seit ${tagZeit(z.rahmen.ab)}` : ""}`}
              info={def("rahmen.geld")} zusatz={`Raten 1: ${ct(z.rahmen.rate1Cents)} · Folgeraten: ${ct(z.rahmen.rate2Cents)} · Auskünfte: ${ct(z.rahmen.auskunftCents)} · Global: ${ct(z.rahmen.globalCents)}`} />
            <BRahmen klasse="blau" titel="davon nach Mara" wert={ct(z.rahmen.nachMaraCents)}
              unter={`${zz(z.rahmen.nachMaraZahlungen)} ${z.rahmen.nachMaraZahlungen === 1 ? "Zahlung" : "Zahlungen"}${z.rahmen.nachMaraOhneMeldungCents != null ? ` · ${ct(z.rahmen.nachMaraOhneMeldungCents)} ohne Meldung vorher` : ""}`}
              info={def("rahmen.nachMara")} zusatz={`Nach Mail: ${ct(z.rahmen.nachMailCents)} · nach WhatsApp: ${ct(z.rahmen.nachWhatsappCents)}`} />
            <BRahmen titel="KI-Kosten Mara" wert={ct(z.rahmen.kiCents)} unter={wahl === "start" ? `alle Mara-Dienste · ab ${tagZeit(z.rahmen.ab)}` : "alle Mara-Dienste"}
              info={def("rahmen.ki")} zusatz={Object.entries(z.rahmen.kiJeDienst).map(([k, v]) => `${k}: ${ct(v)}`).join(" · ")} />
            <BRahmen klasse="gegen" titel="Kündigung bei Mara vorgemerkt" wert={zz(z.rahmen.kuendigungen)}
              unter={`${z.rahmen.kuendigungen === 1 ? "Mensch" : "Menschen"} · im Postfach`} info={def("rahmen.kuendigungen")} />
            <BRahmen klasse="gegen" titel="Gekündigt nach Aktions-Mail" wert={zz(z.rahmen.kuendigungNachMail)}
              unter={`alle Wege · ≤ ${b.nachTagen} Tage danach`} info={def("rahmen.kuendigungNachMail")} />
          </div>
          <p className="mara-still mara-klein">Zahl antippen: Definition und Quelle stehen darunter.</p>
        </>
      ) : null}
    </section>
  );
}
/** Berlin-Kalendertag ± Tage als JJJJ-MM-TT. */
function tagNurIso(tag: string, tage: number): string {
  const x = new Date(`${tag}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + tage);
  return x.toISOString().slice(0, 10);
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE VERKAUFSLEISTE (E-252, 28.09.2026)
//
// Zusammenfassung vor Detail (E-250, Befund 1): Geld nach Mara in 7 Tagen ohne
// Klick, dazu je Weg der Zustand und das Geld. Jede Zahl hat EINE Quelle:
// Geld aus GET /chef/mara/bilanz (woche.rahmen.nachMaraCents, …mail.geld,
// …whatsapp.geld, …auskunft.bezahltCents), Zustände aus denselben Daten wie die
// Reiter (Lage, Stand, Auskunft — mara-lage.tsx). Ist der Bilanz-Stand nicht von
// heute, steht das Datum statt „heute". Jede Zelle springt zu ihrem Schalter.
// ═══════════════════════════════════════════════════════════════════════════
interface AuskunftKern {
  stand: string;
  einstellungen: { an: boolean; kreis: "uwg" | "alle"; mailsProTag: number; erinnerung?: { an: boolean } };
  offen: { betrag: string | null }[];
  erinnerung?: { an: boolean };
  beschaffung?: { offen: number; ueberfaellig: number; nichtEingelesen: number; ueberfaelligAbTagen: number };
}
interface StandKern { einstellungen: { an: boolean; jeStunde: number } }

function Zustand({ ton, lang, kurz }: { ton: "gut" | "warn" | "" ; lang: string; kurz?: string }) {
  return (
    <span className="l-zustand">
      <span className={`mara-punkt${ton ? ` ${ton}` : ""}`} aria-hidden="true" />
      <span className="lk-lang">{lang}</span><span className="lk-kurz">{kurz ?? lang}</span>
    </span>
  );
}

function LeisteKanal({ name, zustand, wert, weiter, onSprung, onWeiter, sprungTitel }: {
  name: string; zustand: ReactNode; wert: ReactNode; weiter?: string | null; onSprung: () => void; onWeiter?: () => void; sprungTitel: string;
}) {
  return (
    <div className="l-kanal">
      <button type="button" className="l-sprung" onClick={onSprung} title={sprungTitel}>
        <span className="l-kopf"><span className="l-name">{name}</span>{zustand}</span>
        <span className="l-wert">{wert}</span>
      </button>
      {weiter && onWeiter ? <button type="button" className="l-weiter" onClick={onWeiter}>{weiter}</button> : null}
    </div>
  );
}

function MaraVerkaufsleiste({ bilanzOffen, onBilanz }: { bilanzOffen: boolean; onBilanz: () => void }) {
  const lage = useMaraLage();
  const bilanz = useMaraDaten<BilanzDaten>("bilanz", MARA_QUELLEN.bilanz);
  const wa = useMaraDaten<LageKern>("lage", MARA_QUELLEN.lage);
  const stand = useMaraDaten<StandKern>("stand", MARA_QUELLEN.stand);
  const auskunft = useMaraDaten<AuskunftKern>("auskunft", MARA_QUELLEN.auskunft);
  if (!lage) return null;

  const b = bilanz.daten;
  const w = b?.zeitraeume.woche;
  const h = b?.zeitraeume.heute;
  const istHeute = !!b && b.heuteBerlin === berlinTag();
  const tagKurz = b ? tagNur(b.heuteBerlin) : "";

  // ── Geld nach Mara ─────────────────────────────────────────────────────
  const geldTitel = `Geld nach Mara · 7 Tage${b && !istHeute ? ` bis ${tagKurz}` : ""}`;
  const geldUnter = w ? [
    w.rahmen.nachMaraZahlungen ? `${zahl(w.rahmen.nachMaraZahlungen)} ${w.rahmen.nachMaraZahlungen === 1 ? "Zahlung" : "Zahlungen"}` : null,
    w.rahmen.geldCents ? `von ${ct(w.rahmen.geldCents)} gesamt` : "noch nichts gebucht",
    w.rahmen.kiCents ? `KI ${ct(w.rahmen.kiCents)}` : null,
  ].filter(Boolean).join(" · ") : "";
  const heuteGeld = h ? `${istHeute ? "heute" : `am ${tagKurz}`} ${h.rahmen.nachMaraCents ? ct(h.rahmen.nachMaraCents) : "noch nichts"}` : "";

  // ── WhatsApp ───────────────────────────────────────────────────────────
  const auto = wa.daten?.automatik;
  const waGeld = w?.whatsapp.geld.cents ?? 0;
  const waNaechste = waGeld ? null : naechsteGruppe(wa.daten);
  const waWeiter = waNaechste
    ? `„${waNaechste.titel}“ ${waNaechste.anzahl > 0 ? `· ${zahl(waNaechste.anzahl)} dran` : `ab ${wannWieder(waNaechste.wiederAb)} wieder dran`} →`
    : null;

  // ── Mail ───────────────────────────────────────────────────────────────
  const me = stand.daten?.einstellungen;
  const mailGeld = w?.mail.geld;

  // ── Auskunft ───────────────────────────────────────────────────────────
  const ak = auskunft.daten;
  const ae = ak?.einstellungen;
  const scharf = !!ae && ae.an && ae.kreis === "alle";
  const offenZahl = ak?.offen.length ?? 0;
  const offenCents = (ak?.offen ?? []).reduce((n, o) => n + betragTextCents(o.betrag), 0);
  const erinnerungAn = (ae?.erinnerung ?? ak?.erinnerung)?.an ?? true;
  const akWeiter = !ak ? null : !scharf ? "Verkauf scharf stellen →"
    : offenZahl ? `${zahl(offenZahl)} offen · ${ct(offenCents)} — Erinnerung ${erinnerungAn ? "läuft" : "aus"} →` : null;

  const laedt = <span className="mara-still">lädt …</span>;

  return (
    <section className="mara-leiste" aria-label="Was Mara verkauft">
      <div className="l-geld">
        <span className="mara-etikett">{geldTitel}</span>
        {w ? (
          w.rahmen.nachMaraCents
            ? <span className="l-zahl" title={`Gebuchtes Geld (wie /chef/zahlen) höchstens ${b!.nachTagen} Tage nach einer Mail oder WhatsApp von Mara — zeitliche Folge, kein Beweis.`}>{ct(w.rahmen.nachMaraCents)}</span>
            : <span className="l-zahl"><span className="mara-pille warn">noch kein Geld</span></span>
        ) : bilanz.fehler
          ? <span className="l-klein">{bilanz.fehler} <button type="button" className="mara-knopf text" onClick={bilanz.neu}>Nochmal</button></span>
          : <span className="l-zahl mara-still">…</span>}
        {geldUnter ? <span className="l-klein">{geldUnter}</span> : null}
        <span className="l-klein">
          {heuteGeld ? <>{heuteGeld}{b ? ` · Stand ${tagZeitBerlin(b.stand)}` : ""} · </> : null}
          <button type="button" className="mara-knopf text" aria-expanded={bilanzOffen} aria-controls="mara-p-bilanz" onClick={onBilanz}>Maras Bilanz</button>
        </span>
      </div>

      <LeisteKanal
        name="WhatsApp"
        sprungTitel="Zum Schalter der Automatik"
        zustand={!auto ? laedt : auto.an
          ? <Zustand ton="gut" lang={`Automatik an · ${auto.jeStunde} je Std.`} kurz={`an · ${auto.jeStunde}/Std.`} />
          : <Zustand ton="" lang="Automatik aus" kurz="aus" />}
        wert={!w ? laedt : waGeld
          ? <><b>{ct(waGeld)}</b><small>{zahl(w.whatsapp.geld.zahlungen)} {w.whatsapp.geld.zahlungen === 1 ? "Zahlung" : "Zahlungen"}</small></>
          : <><span className="mara-pille warn"><span className="lk-lang">noch kein Geld</span><span className="lk-kurz">kein Geld</span></span>
            <small>{[w.whatsapp.vorlagen ? `${zahl(w.whatsapp.vorlagen)} Vorlagen` : null, w.whatsapp.rein ? `${zahl(w.whatsapp.rein)} rein` : null].filter(Boolean).join(" · ")}</small></>}
        weiter={waWeiter}
        onSprung={() => lage.zumSchalter("whatsapp")}
        onWeiter={waNaechste ? () => { lage.gruppeWuenschen(waNaechste.schluessel); lage.zeigen(".wz-start", { reiter: "whatsapp" }); } : undefined}
      />

      <LeisteKanal
        name="Mail"
        sprungTitel="Zum Schalter der Mail-Aktion"
        zustand={!me ? laedt : me.an
          ? <Zustand ton="gut" lang={`Aktion an · ${me.jeStunde} je Std.`} kurz={`an · ${me.jeStunde}/Std.`} />
          : <Zustand ton="warn" lang="Aktion pausiert" kurz="pausiert" />}
        wert={!mailGeld ? laedt : mailGeld.cents
          ? <><b>{ct(mailGeld.cents)}</b><small>{zahl(mailGeld.zahlungen)} {mailGeld.zahlungen === 1 ? "Zahlung" : "Zahlungen"}{w!.mail.antworten ? ` · ${zahl(w!.mail.antworten)} Antworten` : ""}</small></>
          : <span className="mara-pille warn"><span className="lk-lang">noch kein Geld</span><span className="lk-kurz">kein Geld</span></span>}
        weiter={me && !me.an ? "Aktion wieder einschalten →" : null}
        onSprung={() => lage.zumSchalter("mail")}
        onWeiter={() => lage.zumSchalter("mail")}
      />

      <LeisteKanal
        name="Auskunft"
        sprungTitel="Zum Schalter des Verkaufs"
        zustand={!ae ? laedt : scharf
          ? <Zustand ton="gut" lang={`scharf · ${zahl(ae.mailsProTag)} Mails am Tag`} kurz="scharf" />
          : ae.an ? <Zustand ton="warn" lang="läuft, nur § 7 UWG" kurz="nur § 7 UWG" />
            : <Zustand ton="warn" lang="nicht scharf" />}
        wert={!w ? laedt : w.auskunft.bezahltCents
          ? <><b>{ct(w.auskunft.bezahltCents)}</b><small>{zahl(w.auskunft.bezahlt)} bezahlt</small></>
          : <><span className="mara-pille warn"><span className="lk-lang">noch nichts bezahlt</span><span className="lk-kurz">nichts bezahlt</span></span>
            {w.auskunft.bestellt ? <small>{zahl(w.auskunft.bestellt)} bestellt</small> : null}</>}
        weiter={akWeiter}
        onSprung={() => lage.zumSchalter("auskunft")}
        onWeiter={() => lage.zeigen(scharf ? ".ak-offen" : ".ak-scharf", { reiter: "auskunft", ansicht: "verkauf" })}
      />
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DREI REITER (23.09.2026, E-229 · 26.09.2026, E-243 · 28.09.2026, E-252)
//
// Justin: „bau mir eine von den Seiten um und neu auf, sodass ich von dort aus
// wirklich alles steuern kann." Mara arbeitet über zwei Wege — WhatsApp und
// Mail. Beide stehen hier, WhatsApp vorne. ?reiter=mail öffnet die Mail-Aktion.
//
// E-243, Justin 26.09.2026: „das soll nicht schon wieder eine neue eigene Seite
// sein, pflege das logisch hier irgendwo ein" — der dritte Reiter ist der
// Verkauf der Bonitätsauskunft (vorher /chef/s/auskunft): Trichter, „Verkauf
// scharf stellen", Steuerung, Pool, Rückstand. ?reiter=auskunft öffnet ihn,
// &ansicht=beschaffung die Beschaffung. Die Beschaffung bleibt zusätzlich als
// Arbeitsplatz im Raum „Kunden" (/chef/s/auskunft-beschaffung): Dort arbeitet
// das Team ab Stufe Geschäftsführung, und die Aufgaben verlinken dorthin.
//
// E-252: Reiter und Ansicht hält jetzt die Lage (mara-lage.tsx), damit die
// Verkaufsleiste dorthin springen kann. Die Reiterleiste rollt nicht mehr quer.
// ═══════════════════════════════════════════════════════════════════════════
type Aufklapper = "ki" | "bilanz" | "anweisen";
const REITER: { r: MaraReiter; lang: string; kurz: string }[] = [
  { r: "whatsapp", lang: "WhatsApp-Zentrale", kurz: "WhatsApp" },
  { r: "mail", lang: "E-Mail-Aktion", kurz: "Mail" },
  { r: "auskunft", lang: "Bonitätsauskunft", kurz: "Auskunft" },
];

function Steuerpult() {
  const lage = useMaraLage();
  const auftraege = useMaraDaten<AuftraegeDaten>("auftraege", MARA_QUELLEN.auftraege);
  const auskunft = useMaraDaten<AuskunftKern>("auskunft", MARA_QUELLEN.auskunft);
  const [offen, setOffen] = useState<Aufklapper | null>(null);
  // E-252 (Gegenprüfung): „Mara anweisen" bleibt nach dem ersten Öffnen montiert (nur ausgeblendet) — Entwürfe bleiben.
  const [anweisenDa, setAnweisenDa] = useState(false);
  const { meldung, melden, zu } = useMeldung();
  if (!lage) return null;

  const umschalten = (a: Aufklapper) => { if (a === "anweisen") setAnweisenDa(true); setOffen((o) => (o === a ? null : a)); };
  const wartend = (auftraege.daten?.auftraege ?? []).filter(wartetAufDich).length;
  const rundgangStarten = () => {
    const starten = lage.rundgangStart.current;
    if (starten) { setOffen(null); starten(); }
    else melden("Der Rundgang dieses Reiters lädt noch — gleich noch einmal tippen.", "kopf");
  };
  const anweisungZeigen = () => { setAnweisenDa(true); setOffen("anweisen"); lage.zeigen("#mara-anweisung", { block: "start" }); };
  const { reiter, ansicht, wechseln } = lage;
  const bs = auskunft.daten?.beschaffung;

  return (
    <div className="mara mara-pult">
      <header className="mara-kopf">
        <h1>Mara-Steuerpult</h1>
        <div className="mara-chips" role="group" aria-label="Für alle Reiter">
          <KiPauseKarte alsChip offen={offen === "ki"} onUmschalten={() => umschalten("ki")} />
          <button type="button" className="mara-chip" aria-expanded={offen === "anweisen"} aria-controls="mara-p-anweisen" onClick={() => umschalten("anweisen")}>
            Mara anweisen
            {wartend > 0 && <span className="mara-zahlmarke" title={`${wartend} ${wartend === 1 ? "Auftrag wartet" : "Aufträge warten"} auf dich`}>{wartend}</span>}
          </button>
          <button type="button" className="mara-chip" onClick={rundgangStarten}>Rundgang</button>
        </div>
      </header>
      <Meldung m={meldung} ort="kopf" onZu={zu} />

      <MaraVerkaufsleiste bilanzOffen={offen === "bilanz"} onBilanz={() => umschalten("bilanz")} />

      {/* Höchstens ein Aufklapper offen. */}
      {offen === "ki" && <KiPauseKarte imAufklapper />}
      {offen === "bilanz" && <MarasBilanz />}
      {(offen === "anweisen" || anweisenDa) && <MaraBefehl verborgen={offen !== "anweisen"}><Anweisungen /></MaraBefehl>}

      <div className="mara-reiter" role="tablist" aria-label="Maras Wege">
        {REITER.map((x) => (
          <button key={x.r} type="button" role="tab" id={`mara-tab-${x.r}`} aria-selected={reiter === x.r} onClick={() => wechseln(x.r)}>
            <span className="lang">{x.lang}</span><span className="kurz">{x.kurz}</span>
          </button>
        ))}
      </div>

      {reiter === "whatsapp" && <div role="tabpanel" aria-labelledby="mara-tab-whatsapp"><ChefWhatsAppZentrale /></div>}
      {reiter === "mail" && <div role="tabpanel" aria-labelledby="mara-tab-mail"><MaraMailAktion onAnweisungZeigen={anweisungZeigen} /></div>}
      {reiter === "auskunft" && (
        <div role="tabpanel" aria-labelledby="mara-tab-auskunft">
          <div className="mara-reiter-zeile">
            <div className="mara-ansicht" role="group" aria-label="Bonitätsauskunft">
              <button type="button" aria-pressed={ansicht === "verkauf"} onClick={() => wechseln("auskunft", "verkauf")}>Verkauf</button>
              <button type="button" aria-pressed={ansicht === "beschaffung"} onClick={() => wechseln("auskunft", "beschaffung")}
                title="Bezahlte Bonitätsauskünfte beschaffen: alle Daten zum Bestellen, Vollmacht, Frist, PDF hochladen — Akte, Analyse und Mail an den Kunden folgen von selbst.">
                Beschaffung
                {bs && bs.offen > 0 ? ` · ${zahl(bs.offen)} offen` : ""}
                {bs && bs.ueberfaellig > 0 ? <span className="mara-krit-t" title={`länger als ${bs.ueberfaelligAbTagen} Tage`}> · {zahl(bs.ueberfaellig)} überfällig</span> : null}
                {bs && bs.nichtEingelesen > 0 ? ` · +${zahl(bs.nichtEingelesen)} zum Einlesen` : ""}
              </button>
            </div>
            {ansicht === "verkauf" && auskunft.geladenAm
              ? <span className="mara-still mara-klein">Stand {uhrBerlin(auskunft.geladenAm)} · lädt jede Minute neu</span>
              : null}
          </div>
          <Suspense fallback={<Geruest zeilen={8} />}>
            {ansicht === "verkauf" ? <AuskunftVerkauf /> : <AuskunftBeschaffung />}
          </Suspense>
        </div>
      )}
    </div>
  );
}

export default function ChefMara() {
  return (
    <MaraLage>
      <Steuerpult />
    </MaraLage>
  );
}
