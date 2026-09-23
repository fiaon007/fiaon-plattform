// ═══════════════════════════════════════════════════════════════════════════
// BUCHHALTUNG — /buchhaltung (23.09.2026, E-227)
//
// Eigener Zugang, eigener Raum. Nachtglas: eine dunkle Anmeldebühne, dahinter
// ein heller Arbeitsraum mit genau EINEM Navy-Glas — dem Kassenstand.
//
// Der Kern der Seite ist der Zahlungsauftrag mit vier Augen. Deshalb steht er
// oben und ist der einzige Bereich, der offen beginnt; alles andere klappt
// man auf, wenn man es braucht.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from "react";
import "@/styles/buchhaltung.css";

// ── Formen ──────────────────────────────────────────────────────────────────
interface Ich { email: string; name: string; rolle: "inhaber" | "buchhaltung"; titel: string }
interface Anfang { cents: number; am: string; notiz: string; von: string }
interface Abgleich { cents: number; am: string; von: string; erfasst: string }
interface Kasse {
  anfang: Anfang | null; kundengeldCents: number; zuflussCents: number;
  abflussCents: number; bestandCents: number; abgleich: Abgleich | null; differenzCents: number | null;
}
interface Auftrag {
  id: number; nummer: string; empfaenger: string; iban: string; bic: string | null;
  betragCents: number; zweck: string; kategorie: string | null; faelligAm: string | null;
  belegName: string | null; hatBeleg: boolean; status: string;
  erstelltVon: string; erstelltAm: string; eingereichtAm: string | null;
  entschiedenVon: string | null; entschiedenAm: string | null; entscheidungNotiz: string | null;
  ausgefuehrtVon: string | null; ausgefuehrtAm: string | null; bankReferenz: string | null;
  hatBestaetigung: boolean;
}
interface Bewegung {
  id: number; art: string; richtung: number; betragCents: number; wertAm: string;
  zweck: string; gegenpartei: string | null; beleg: string | null; auftragId: number | null;
  erfasstVon: string; erfasstAm: string; storniertAm: string | null; stornoGrund: string | null;
}
interface Uebergabe { bisher: string; stichtag: string; bestaetigtVon?: string; bestaetigtAm?: string }
interface Lage {
  ich: Ich; kasse: Kasse; offen: Auftrag[]; auftraege: Auftrag[];
  bewegungen: Bewegung[]; uebergabe: Uebergabe | null; leute: Ich[];
}

// ── Kleinkram ───────────────────────────────────────────────────────────────
const geld = (c: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(c / 100);
const tag = (iso?: string | null) =>
  iso ? new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" }).format(new Date(iso)) : "—";
const zeit = (iso?: string | null) =>
  iso ? new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }).format(new Date(iso)) : "—";
const heute = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
const ibanHuebsch = (s: string) => String(s || "").replace(/(.{4})/g, "$1 ").trim();

async function ruf(pfad: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`/api/fiaon${pfad}`, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || j?.ok === false) throw new Error(j?.error || `Fehler ${res.status}`);
  return j;
}

const STATUS_TEXT: Record<string, { text: string; farbe: string }> = {
  entwurf: { text: "Entwurf", farbe: "" },
  eingereicht: { text: "Wartet auf Freigabe", farbe: "warn" },
  freigegeben: { text: "Freigegeben — überweisen", farbe: "info" },
  abgelehnt: { text: "Abgelehnt", farbe: "fehler" },
  ausgefuehrt: { text: "Ausgeführt", farbe: "gut" },
  zurueckgezogen: { text: "Zurückgezogen", farbe: "" },
};

// ═══════════════════════════════════════════════════════════════════════════
// ANMELDUNG
// ═══════════════════════════════════════════════════════════════════════════
function Tor({ fertig }: { fertig: (ich: Ich) => void }) {
  const [schritt, setSchritt] = useState<"passwort" | "wer" | "pin">("passwort");
  const [email, setEmail] = useState("accounting@fiaon.com");
  const [passwort, setPasswort] = useState("");
  const [leute, setLeute] = useState<{ email: string; name: string; titel: string }[]>([]);
  const [wer, setWer] = useState<{ email: string; name: string } | null>(null);
  const [pin, setPin] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [gut, setGut] = useState<string | null>(null);

  const passwortSenden = async (e: React.FormEvent) => {
    e.preventDefault();
    setLaeuft(true); setFehler(null);
    try {
      const j = await ruf("/buchhaltung/anmelden", { method: "POST", body: JSON.stringify({ email, passwort }) });
      setLeute(j.personen || []);
      setSchritt("wer");
    } catch (err: any) { setFehler(err.message); } finally { setLaeuft(false); }
  };

  const pinHolen = async (p: { email: string; name: string }) => {
    setLaeuft(true); setFehler(null); setGut(null);
    try {
      await ruf("/buchhaltung/pin-anfordern", { method: "POST", body: JSON.stringify({ email: p.email }) });
      setWer(p); setSchritt("pin");
      setGut(`Der PIN ist an ${p.email} unterwegs. Er gilt 10 Minuten.`);
    } catch (err: any) { setFehler(err.message); } finally { setLaeuft(false); }
  };

  const pinSenden = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wer) return;
    setLaeuft(true); setFehler(null);
    try {
      const j = await ruf("/buchhaltung/pin-pruefen", { method: "POST", body: JSON.stringify({ email: wer.email, pin }) });
      fertig(j.ich as Ich);
    } catch (err: any) { setFehler(err.message); } finally { setLaeuft(false); }
  };

  return (
    <div className="bu-tor">
      <div className="bu-marke">FIAON</div>
      <h1>Buchhaltung</h1>
      <p className="bu-satz">
        {schritt === "passwort" && "Zwei Schritte: das gemeinsame Passwort, dann ein Einmal-PIN an deine eigene Adresse."}
        {schritt === "wer" && "Wer meldet sich an? Der PIN geht ausschließlich an die eigene Adresse."}
        {schritt === "pin" && "Zwölf Stellen aus der Mail. Groß- und Kleinschreibung egal."}
      </p>

      {schritt === "passwort" && (
        <form onSubmit={passwortSenden}>
          <div className="bu-feld">
            <label htmlFor="bu-mail">Anmeldename</label>
            <input id="bu-mail" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="bu-feld">
            <label htmlFor="bu-pw">Passwort</label>
            <input id="bu-pw" type="password" autoComplete="current-password" value={passwort} onChange={(e) => setPasswort(e.target.value)} autoFocus />
          </div>
          <button className="bu-haupt" type="submit" disabled={laeuft || !passwort}>{laeuft ? "Prüfe …" : "Weiter"}</button>
        </form>
      )}

      {schritt === "wer" && (
        <div className="bu-wahl">
          {leute.map((p) => (
            <button key={p.email} type="button" disabled={laeuft} onClick={() => pinHolen(p)}>
              <strong>{p.name}</strong>
              <span>{p.titel} · PIN an {p.email}</span>
            </button>
          ))}
        </div>
      )}

      {schritt === "pin" && wer && (
        <form onSubmit={pinSenden}>
          <div className="bu-feld">
            <label htmlFor="bu-pin">PIN aus der Mail an {wer.email}</label>
            <input id="bu-pin" className="bu-pin" value={pin} onChange={(e) => setPin(e.target.value)}
              placeholder="XXXX-XXXX-XXXX" maxLength={20} autoFocus inputMode="text" autoComplete="one-time-code" />
          </div>
          <button className="bu-haupt" type="submit" disabled={laeuft || pin.replace(/[^A-Za-z0-9]/g, "").length !== 12}>
            {laeuft ? "Prüfe …" : "Anmelden"}
          </button>
          <button className="bu-still" type="button" onClick={() => pinHolen(wer)} disabled={laeuft}>Neuen PIN schicken</button>
        </form>
      )}

      {fehler && <div className="bu-meldung fehler">{fehler}</div>}
      {gut && !fehler && <div className="bu-meldung gut">{gut}</div>}

      <p className="bu-fuss">
        FIAON LTD · Company No. 17318250 · Jede Handlung in diesem Bereich wird mit Name und Uhrzeit protokolliert.
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// NEUER ZAHLUNGSAUFTRAG
// ═══════════════════════════════════════════════════════════════════════════
function NeuerAuftrag({ nachher }: { nachher: () => void }) {
  const leer = { empfaenger: "", iban: "", bic: "", betrag: "", zweck: "", kategorie: "", faelligAm: "" };
  const [f, setF] = useState(leer);
  const [beleg, setBeleg] = useState<{ name: string; base64: string } | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const setz = (k: keyof typeof leer) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((v) => ({ ...v, [k]: e.target.value }));

  const datei = (e: React.ChangeEvent<HTMLInputElement>) => {
    const d = e.target.files?.[0];
    if (!d) { setBeleg(null); return; }
    if (d.size > 6 * 1024 * 1024) { setFehler("Der Beleg ist größer als 6 MB."); return; }
    const leser = new FileReader();
    leser.onload = () => setBeleg({ name: d.name, base64: String(leser.result || "").replace(/^data:[^,]+,/, "") });
    leser.readAsDataURL(d);
  };

  const senden = async (e: React.FormEvent) => {
    e.preventDefault();
    setLaeuft(true); setFehler(null);
    try {
      await ruf("/buchhaltung/auftrag", {
        method: "POST",
        body: JSON.stringify({ ...f, belegName: beleg?.name ?? null, belegBase64: beleg?.base64 ?? null }),
      });
      setF(leer); setBeleg(null); nachher();
    } catch (err: any) { setFehler(err.message); } finally { setLaeuft(false); }
  };

  return (
    <form onSubmit={senden}>
      <div className="bu-gitter">
        <div className="bu-feld">
          <label htmlFor="na-e">Empfänger</label>
          <input id="na-e" value={f.empfaenger} onChange={setz("empfaenger")} placeholder="Name oder Firma" />
        </div>
        <div className="bu-feld">
          <label htmlFor="na-i">IBAN</label>
          <input id="na-i" value={f.iban} onChange={setz("iban")} placeholder="DE00 0000 0000 0000 0000 00" spellCheck={false} />
          <span className="bu-fein">Wird mit der Prüfziffer geprüft.</span>
        </div>
        <div className="bu-feld">
          <label htmlFor="na-bic">BIC (wenn bekannt)</label>
          <input id="na-bic" value={f.bic} onChange={setz("bic")} spellCheck={false} />
        </div>
        <div className="bu-feld">
          <label htmlFor="na-b">Betrag</label>
          <input id="na-b" value={f.betrag} onChange={setz("betrag")} placeholder="1.250,00" inputMode="decimal" />
        </div>
        <div className="bu-feld">
          <label htmlFor="na-k">Kategorie</label>
          <select id="na-k" value={f.kategorie} onChange={setz("kategorie")}>
            <option value="">— wählen —</option>
            <option>Gehalt / Vergütung</option>
            <option>Provision</option>
            <option>Dienstleister</option>
            <option>Software / Lizenzen</option>
            <option>Werbung</option>
            <option>Erstattung an Kunden</option>
            <option>Steuern / Abgaben</option>
            <option>Sonstiges</option>
          </select>
        </div>
        <div className="bu-feld">
          <label htmlFor="na-f">Fällig am</label>
          <input id="na-f" type="date" value={f.faelligAm} onChange={setz("faelligAm")} />
        </div>
        <div className="bu-feld bu-breit">
          <label htmlFor="na-z">Verwendungszweck</label>
          <input id="na-z" value={f.zweck} onChange={setz("zweck")} placeholder="Rechnung 2026-114, September" />
        </div>
        <div className="bu-feld bu-breit">
          <label htmlFor="na-d">Beleg (PDF oder Bild, optional)</label>
          <input id="na-d" type="file" accept=".pdf,image/*" onChange={datei} />
          {beleg && <span className="bu-fein">Angehängt: {beleg.name}</span>}
        </div>
      </div>
      {fehler && <div className="bu-band fehler" style={{ marginTop: 16, marginBottom: 0 }}>{fehler}</div>}
      <div className="bu-knoepfe">
        <button className="bu-knopf primaer" type="submit" disabled={laeuft}>{laeuft ? "Lege an …" : "Auftrag anlegen"}</button>
        <span className="bu-fein" style={{ color: "var(--bu-leise)", fontSize: 12 }}>
          Der Auftrag entsteht als Entwurf. Erst „Zur Freigabe einreichen“ legt ihn dem Inhaber vor.
        </span>
      </div>
    </form>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EIN AUFTRAG IN DER LISTE
// ═══════════════════════════════════════════════════════════════════════════
function AuftragZeile({ a, ich, nachher }: { a: Auftrag; ich: Ich; nachher: () => void }) {
  const [offen, setOffen] = useState<null | "ablehnen" | "ausfuehren">(null);
  const [notiz, setNotiz] = useState("");
  const [ref, setRef] = useState("");
  const [wertAm, setWertAm] = useState(heute());
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const st = STATUS_TEXT[a.status] || { text: a.status, farbe: "" };

  const tu = async (pfad: string, koerper?: unknown) => {
    setLaeuft(true); setFehler(null);
    try {
      await ruf(`/buchhaltung/auftrag/${a.id}/${pfad}`, { method: "POST", body: JSON.stringify(koerper || {}) });
      setOffen(null); nachher();
    } catch (err: any) { setFehler(err.message); } finally { setLaeuft(false); }
  };

  const meins = a.erstelltVon === ich.email;
  const darfFreigeben = ich.rolle === "inhaber" && a.status === "eingereicht" && !meins;

  return (
    <tr>
      <td>
        <span className="bu-mono">{a.nummer}</span>
        <span className="bu-klein">{a.kategorie || "ohne Kategorie"} · angelegt {zeit(a.erstelltAm)}</span>
      </td>
      <td>
        <strong style={{ fontWeight: 500 }}>{a.empfaenger}</strong>
        <span className="bu-klein bu-mono">{ibanHuebsch(a.iban)}</span>
        <span className="bu-klein">{a.zweck}</span>
        {a.hatBeleg && (
          <span className="bu-klein">
            <a href={`/api/fiaon/buchhaltung/auftrag/${a.id}/beleg`} target="_blank" rel="noreferrer">Beleg ansehen</a>
          </span>
        )}
        {a.entscheidungNotiz && <span className="bu-klein">Notiz: {a.entscheidungNotiz}</span>}
        {a.bankReferenz && <span className="bu-klein bu-mono">Bankreferenz {a.bankReferenz}</span>}
        {fehler && <span className="bu-klein" style={{ color: "var(--bu-fehler)" }}>{fehler}</span>}

        {offen === "ablehnen" && (
          <div style={{ marginTop: 10, maxWidth: 420 }}>
            <div className="bu-feld">
              <label htmlFor={`ab-${a.id}`}>Grund der Ablehnung</label>
              <input id={`ab-${a.id}`} value={notiz} onChange={(e) => setNotiz(e.target.value)} autoFocus />
            </div>
            <div className="bu-knoepfe">
              <button className="bu-knopf warnung" disabled={laeuft || !notiz.trim()} onClick={() => tu("entscheiden", { frei: false, notiz })}>Ablehnen</button>
              <button className="bu-knopf still" onClick={() => setOffen(null)}>Abbrechen</button>
            </div>
          </div>
        )}

        {offen === "ausfuehren" && (
          <div style={{ marginTop: 10, maxWidth: 480 }}>
            <div className="bu-gitter">
              <div className="bu-feld">
                <label htmlFor={`br-${a.id}`}>Referenz der Bank</label>
                <input id={`br-${a.id}`} value={ref} onChange={(e) => setRef(e.target.value)} autoFocus spellCheck={false} />
                <span className="bu-fein">Die Nummer, unter der die Überweisung im Konto steht.</span>
              </div>
              <div className="bu-feld">
                <label htmlFor={`bw-${a.id}`}>Wertstellung</label>
                <input id={`bw-${a.id}`} type="date" value={wertAm} onChange={(e) => setWertAm(e.target.value)} />
              </div>
            </div>
            <div className="bu-knoepfe">
              <button className="bu-knopf primaer" disabled={laeuft || !ref.trim()} onClick={() => tu("ausfuehren", { bankReferenz: ref, wertAm })}>
                Als überwiesen buchen
              </button>
              <button className="bu-knopf still" onClick={() => setOffen(null)}>Abbrechen</button>
            </div>
          </div>
        )}
      </td>
      <td className="bu-zahl" style={{ whiteSpace: "nowrap" }}>{geld(a.betragCents)}</td>
      <td>
        <span className={`bu-marke-pille ${st.farbe}`}>{st.text}</span>
        {a.status === "ausgefuehrt" && (
          <span className="bu-klein">
            <a href={`/api/fiaon/buchhaltung/auftrag/${a.id}/bestaetigung.pdf`} target="_blank" rel="noreferrer">Bestätigung (PDF)</a>
          </span>
        )}
        {a.entschiedenAm && <span className="bu-klein">{tag(a.entschiedenAm)}</span>}
      </td>
      <td style={{ whiteSpace: "nowrap" }}>
        {a.status === "entwurf" && meins && (
          <button className="bu-knopf neutral" disabled={laeuft} onClick={() => tu("einreichen")}>Zur Freigabe einreichen</button>
        )}
        {darfFreigeben && (
          <>
            <button className="bu-knopf primaer" disabled={laeuft} onClick={() => tu("entscheiden", { frei: true })}>Freigeben</button>{" "}
            <button className="bu-knopf neutral" disabled={laeuft} onClick={() => setOffen("ablehnen")}>Ablehnen</button>
          </>
        )}
        {ich.rolle === "inhaber" && a.status === "eingereicht" && meins && (
          <span className="bu-klein">Vier Augen: eigene Aufträge gibt niemand selbst frei.</span>
        )}
        {a.status === "freigegeben" && (
          <button className="bu-knopf primaer" disabled={laeuft} onClick={() => setOffen("ausfuehren")}>Überwiesen — eintragen</button>
        )}
        {["entwurf", "eingereicht"].includes(a.status) && meins && (
          <button className="bu-knopf still" disabled={laeuft} onClick={() => tu("zurueckziehen")}>Zurückziehen</button>
        )}
      </td>
    </tr>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DER RAUM
// ═══════════════════════════════════════════════════════════════════════════
function Raum({ ich, abmelden }: { ich: Ich; abmelden: () => void }) {
  const [lage, setLage] = useState<Lage | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [protokoll, setProtokoll] = useState<any[] | null>(null);

  const laden = useCallback(async () => {
    try { setLage(await ruf("/buchhaltung/lage")); setFehler(null); }
    catch (err: any) { setFehler(err.message); }
  }, []);

  useEffect(() => { void laden(); }, [laden]);

  const k = lage?.kasse;
  const offeneFreigaben = useMemo(() => (lage?.auftraege || []).filter((a) => a.status === "eingereicht"), [lage]);
  const zuUeberweisen = useMemo(() => (lage?.auftraege || []).filter((a) => a.status === "freigegeben"), [lage]);

  if (fehler && !lage) return <div className="bu-raum"><div className="bu-band fehler"><strong>Das ging schief</strong>{fehler}</div></div>;
  if (!lage || !k) return <div className="bu-raum"><p className="bu-leer">Lade …</p></div>;

  return (
    <div className="bu-raum">
      <header className="bu-kopf">
        <div className="bu-titel">
          <div className="bu-braue">FIAON LTD</div>
          <h1>Buchhaltung</h1>
          <p>Kassenbuch, Zahlungsaufträge und Freigaben. Jede Zahlung hat zwei Namen: wer sie vorbereitet, und wer sie freigibt.</p>
        </div>
        <div className="bu-wer">
          <strong>{ich.name}</strong>
          {ich.titel} · {ich.rolle === "inhaber" ? "darf freigeben" : "bereitet vor"}
          <div style={{ marginTop: 8 }}>
            <button className="bu-knopf still" onClick={abmelden}>Abmelden</button>
          </div>
        </div>
      </header>

      {/* Das eine Navy-Glas */}
      <section className="bu-instrument">
        <div className="bu-werte">
          <div className="bu-wert">
            <span>Bestand laut Kassenbuch</span>
            <strong>{k.anfang ? geld(k.bestandCents) : "nicht verfügbar"}</strong>
            <em>{k.anfang ? `seit ${tag(k.anfang.am)}` : "Anfangsbestand fehlt noch"}</em>
          </div>
          <div className="bu-wert">
            <span>Kundengeld seit dann</span>
            <strong>{k.anfang ? geld(k.kundengeldCents) : "—"}</strong>
            <em>gebuchte Raten, Auskünfte, Global</em>
          </div>
          <div className="bu-wert">
            <span>Abgeflossen</span>
            <strong>{geld(k.abflussCents)}</strong>
            <em>ausgeführte Aufträge und Kosten</em>
          </div>
          <div className="bu-wert">
            <span>Wartet auf Freigabe</span>
            <strong>{offeneFreigaben.length}</strong>
            <em>{offeneFreigaben.length ? geld(offeneFreigaben.reduce((s, a) => s + a.betragCents, 0)) : "nichts offen"}</em>
          </div>
        </div>
        <p className="bu-quelle">
          Bestand = Anfangsbestand + Kundengeld seit diesem Tag + erfasste Eingänge − erfasste Abflüsse.
          Das ist der Stand laut Buch, nicht der Kontostand der Bank — der Bankabgleich unten nennt die Differenz.
        </p>
      </section>

      {k.abgleich && k.differenzCents !== null && Math.abs(k.differenzCents) > 0 && (
        <div className={`bu-band ${Math.abs(k.differenzCents) > 5000 ? "warn" : ""}`}>
          <strong>Buch und Bank liegen {geld(Math.abs(k.differenzCents))} auseinander</strong>
          Bank {geld(k.abgleich.cents)} zum {tag(k.abgleich.am)} · Buch {geld(k.bestandCents)}.
          {k.differenzCents > 0
            ? " Auf dem Konto liegt mehr, als das Buch kennt — da fehlt ein Eingang."
            : " Das Buch kennt mehr, als auf dem Konto liegt — da fehlt ein Abfluss."}
        </div>
      )}

      {lage.uebergabe && !lage.uebergabe.bestaetigtVon && ich.rolle === "buchhaltung" && (
        <div className="bu-band">
          <strong>Übergabe der Buchhaltung</strong>
          Geführt bisher von {lage.uebergabe.bisher}. Ab dem {tag(lage.uebergabe.stichtag)} liegt die laufende Buchhaltung bei dir.
          Die Freigabe von Zahlungen bleibt beim Inhaber.
          <div className="bu-knoepfe">
            <button className="bu-knopf primaer" onClick={async () => { await ruf("/buchhaltung/uebergabe/bestaetigen", { method: "POST" }); void laden(); }}>
              Übernahme bestätigen
            </button>
            <a className="bu-knopf neutral" href="/api/fiaon/buchhaltung/uebergabe.pdf" target="_blank" rel="noreferrer">Vermerk lesen (PDF)</a>
          </div>
        </div>
      )}

      {zuUeberweisen.length > 0 && (
        <div className="bu-band gut">
          <strong>{zuUeberweisen.length} freigegeben{zuUeberweisen.length === 1 ? "er" : "e"} Auftrag{zuUeberweisen.length === 1 ? "" : "e"} wartet auf die Überweisung</strong>
          Zusammen {geld(zuUeberweisen.reduce((s, a) => s + a.betragCents, 0))}. Nach der Überweisung die Bankreferenz eintragen —
          erst dann entsteht die Bestätigung und die Buchung im Kassenbuch.
        </div>
      )}

      {/* ── Zahlungsaufträge: der Kern, deshalb offen ──────────────────── */}
      <section className="bu-karte">
        <h2>Zahlungsaufträge</h2>
        <p className="bu-hinweis">
          Entwurf → zur Freigabe einreichen → der Inhaber entscheidet → überweisen und die Bankreferenz eintragen.
          Wer einen Auftrag anlegt, gibt ihn nie selbst frei.
        </p>
        {lage.auftraege.length === 0 ? (
          <p className="bu-leer">Noch kein Auftrag. Der erste entsteht unten.</p>
        ) : (
          <div className="bu-rollen">
            <table className="bu-liste">
              <thead>
                <tr>
                  <th>Auftrag</th><th>Empfänger und Zweck</th><th className="bu-zahl">Betrag</th><th>Stand</th><th>Nächster Schritt</th>
                </tr>
              </thead>
              <tbody>
                {lage.auftraege.map((a) => <AuftragZeile key={a.id} a={a} ich={ich} nachher={laden} />)}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <details className="bu-karte" open={lage.auftraege.length === 0}>
        <summary>Neuen Zahlungsauftrag anlegen</summary>
        <NeuerAuftrag nachher={laden} />
      </details>

      {/* ── Kassenbuch ─────────────────────────────────────────────────── */}
      <details className="bu-karte">
        <summary>Kassenbuch<span className="bu-still-zahl">{lage.bewegungen.length} Bewegungen</span></summary>
        <p className="bu-hinweis">
          Alles, was nicht aus dem laufenden Kundengeschäft kommt: Einlagen, erfasste Kosten, ausgeführte Zahlungsaufträge.
          Das Kundengeld selbst steht im Instrument oben und kommt aus derselben Quelle wie die Zahlen im Chefbüro.
        </p>
        {lage.bewegungen.length === 0 ? (
          <p className="bu-leer">Noch keine Bewegung erfasst.</p>
        ) : (
          <div className="bu-rollen">
            <table className="bu-liste">
              <thead><tr><th>Tag</th><th>Vorgang</th><th className="bu-zahl">Betrag</th><th>Erfasst</th></tr></thead>
              <tbody>
                {lage.bewegungen.map((b) => (
                  <tr key={b.id} style={b.storniertAm ? { opacity: .5, textDecoration: "line-through" } : undefined}>
                    <td style={{ whiteSpace: "nowrap" }}>{tag(b.wertAm)}</td>
                    <td>
                      <strong style={{ fontWeight: 500 }}>{b.zweck}</strong>
                      <span className="bu-klein">
                        {b.art === "einlage" ? "Einlage" : b.art === "ausgabe" ? "Ausgabe" : "Eingang"}
                        {b.gegenpartei ? ` · ${b.gegenpartei}` : ""}{b.beleg ? ` · ${b.beleg}` : ""}
                      </span>
                      {b.stornoGrund && <span className="bu-klein">Storniert: {b.stornoGrund}</span>}
                    </td>
                    <td className="bu-zahl" style={{ whiteSpace: "nowrap", color: b.richtung < 0 ? "var(--bu-fehler)" : "var(--bu-gut)" }}>
                      {b.richtung < 0 ? "−" : "+"}{geld(b.betragCents)}
                    </td>
                    <td className="bu-klein" style={{ whiteSpace: "nowrap" }}>{b.erfasstVon.split("@")[0]}<br />{zeit(b.erfasstAm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>

      {/* ── Kasse einstellen ───────────────────────────────────────────── */}
      <details className="bu-karte">
        <summary>Kasse einstellen<span className="bu-still-zahl">{k.anfang ? `Anfang ${tag(k.anfang.am)}` : "Anfangsbestand fehlt"}</span></summary>
        <KasseEinstellen lage={lage} ich={ich} nachher={laden} />
      </details>

      {/* ── Protokoll ──────────────────────────────────────────────────── */}
      <details className="bu-karte" onToggle={async (e) => {
        if ((e.currentTarget as HTMLDetailsElement).open && !protokoll) {
          try { setProtokoll((await ruf("/buchhaltung/protokoll")).zeilen); } catch { setProtokoll([]); }
        }
      }}>
        <summary>Protokoll<span className="bu-still-zahl">wer hat wann was getan</span></summary>
        {!protokoll ? <p className="bu-leer">Lade …</p> : protokoll.length === 0 ? <p className="bu-leer">Noch nichts protokolliert.</p> : (
          <div className="bu-rollen">
            <table className="bu-liste">
              <thead><tr><th>Wann</th><th>Wer</th><th>Was</th></tr></thead>
              <tbody>
                {protokoll.map((z, i) => (
                  <tr key={i}>
                    <td style={{ whiteSpace: "nowrap" }}>{zeit(z.zeit)}</td>
                    <td>{z.person ? String(z.person).split("@")[0] : "—"}</td>
                    <td>{z.aktion}{z.ziel ? ` · ${z.ziel}` : ""}{z.notiz ? <span className="bu-klein">{z.notiz}</span> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>

      {/* ── Papiere ────────────────────────────────────────────────────── */}
      <details className="bu-karte">
        <summary>Papiere</summary>
        <div className="bu-knoepfe" style={{ marginTop: 0 }}>
          <a className="bu-knopf neutral" href="/api/fiaon/buchhaltung/zugang.pdf" target="_blank" rel="noreferrer">Mein Zugangsblatt</a>
          {ich.rolle === "inhaber" && lage.leute.filter((p) => p.rolle !== "inhaber").map((p) => (
            <a key={p.email} className="bu-knopf neutral" href={`/api/fiaon/buchhaltung/zugang.pdf?fuer=${encodeURIComponent(p.email)}`} target="_blank" rel="noreferrer">
              Zugangsblatt {p.name.split(" ")[0]}
            </a>
          ))}
          {lage.uebergabe && (
            <a className="bu-knopf neutral" href="/api/fiaon/buchhaltung/uebergabe.pdf" target="_blank" rel="noreferrer">Übergabevermerk</a>
          )}
        </div>
        <p className="bu-hinweis" style={{ marginTop: 14, marginBottom: 0 }}>
          Das Passwort steht bewusst auf keinem dieser Blätter. Es wird einmal persönlich übergeben.
        </p>
      </details>
    </div>
  );
}

// ── Kasse einstellen: Anfangsbestand, Einlage, Bankabgleich, Übergabe ──────
function KasseEinstellen({ lage, ich, nachher }: { lage: Lage; ich: Ich; nachher: () => void }) {
  const k = lage.kasse;
  const [anfang, setAnfang] = useState({ betrag: k.anfang ? (k.anfang.cents / 100).toFixed(2) : "", am: k.anfang?.am || heute(), notiz: k.anfang?.notiz || "" });
  const [abgleich, setAbgleich] = useState({ betrag: k.abgleich ? (k.abgleich.cents / 100).toFixed(2) : "", am: k.abgleich?.am || heute() });
  const [einlage, setEinlage] = useState({ betrag: "", wertAm: heute(), zweck: "Einlage Justin Schwarzott", gegenpartei: "Justin Schwarzott", beleg: "" });
  const [ueb, setUeb] = useState({ bisher: lage.uebergabe?.bisher || "", stichtag: lage.uebergabe?.stichtag || heute() });
  const [meldung, setMeldung] = useState<{ art: "gut" | "fehler"; text: string } | null>(null);
  const [laeuft, setLaeuft] = useState("");

  const tu = async (name: string, pfad: string, koerper: unknown, gut: string) => {
    setLaeuft(name); setMeldung(null);
    try { await ruf(pfad, { method: "POST", body: JSON.stringify(koerper) }); setMeldung({ art: "gut", text: gut }); nachher(); }
    catch (err: any) { setMeldung({ art: "fehler", text: err.message }); }
    finally { setLaeuft(""); }
  };

  return (
    <>
      {meldung && <div className={`bu-band ${meldung.art === "gut" ? "gut" : "fehler"}`}>{meldung.text}</div>}

      <h3>Bankabgleich</h3>
      <p className="bu-hinweis">Was steht wirklich auf dem Konto? Der Eintrag verändert nichts am Buch — er zeigt nur, ob beides zusammenpasst.</p>
      <div className="bu-gitter">
        <div className="bu-feld">
          <label htmlFor="ab-b">Kontostand laut Bank</label>
          <input id="ab-b" value={abgleich.betrag} onChange={(e) => setAbgleich((v) => ({ ...v, betrag: e.target.value }))} inputMode="decimal" />
        </div>
        <div className="bu-feld">
          <label htmlFor="ab-a">Stand vom</label>
          <input id="ab-a" type="date" value={abgleich.am} onChange={(e) => setAbgleich((v) => ({ ...v, am: e.target.value }))} />
        </div>
      </div>
      <div className="bu-knoepfe">
        <button className="bu-knopf primaer" disabled={laeuft === "ab" || !abgleich.betrag}
          onClick={() => tu("ab", "/buchhaltung/abgleich", abgleich, "Bankabgleich erfasst.")}>Abgleich erfassen</button>
      </div>

      {ich.rolle === "inhaber" && (
        <>
          <hr className="bu-trenner" />
          <h3>Anfangsbestand</h3>
          <p className="bu-hinweis">
            Der Punkt, an dem das Buch beginnt: der echte Kontostand an einem bestimmten Tag. Ab diesem Tag zählt das Buch
            das Kundengeld automatisch dazu — ein früheres Datum würde alles doppelt zählen.
          </p>
          <div className="bu-gitter">
            <div className="bu-feld">
              <label htmlFor="an-b">Kontostand</label>
              <input id="an-b" value={anfang.betrag} onChange={(e) => setAnfang((v) => ({ ...v, betrag: e.target.value }))} inputMode="decimal" />
            </div>
            <div className="bu-feld">
              <label htmlFor="an-a">Am</label>
              <input id="an-a" type="date" value={anfang.am} onChange={(e) => setAnfang((v) => ({ ...v, am: e.target.value }))} />
            </div>
            <div className="bu-feld bu-breit">
              <label htmlFor="an-n">Notiz</label>
              <input id="an-n" value={anfang.notiz} onChange={(e) => setAnfang((v) => ({ ...v, notiz: e.target.value }))} placeholder="Quelle des Stands, z. B. Kontoauszug" />
            </div>
          </div>
          <div className="bu-knoepfe">
            <button className="bu-knopf primaer" disabled={laeuft === "an" || !anfang.betrag}
              onClick={() => tu("an", "/buchhaltung/anfangsbestand", anfang, "Anfangsbestand gesetzt.")}>Anfangsbestand setzen</button>
          </div>

          <hr className="bu-trenner" />
          <h3>Einlage oder sonstige Bewegung</h3>
          <p className="bu-hinweis">
            Geld, das von außen ins Unternehmen kommt oder es außerhalb eines Zahlungsauftrags verlässt. Eine Einlage ist,
            was sie ist: eingezahltes Kapital mit Datum und Betrag.
          </p>
          <div className="bu-gitter">
            <div className="bu-feld">
              <label htmlFor="ei-b">Betrag</label>
              <input id="ei-b" value={einlage.betrag} onChange={(e) => setEinlage((v) => ({ ...v, betrag: e.target.value }))} inputMode="decimal" />
            </div>
            <div className="bu-feld">
              <label htmlFor="ei-a">Wertstellung</label>
              <input id="ei-a" type="date" value={einlage.wertAm} onChange={(e) => setEinlage((v) => ({ ...v, wertAm: e.target.value }))} />
            </div>
            <div className="bu-feld">
              <label htmlFor="ei-g">Von wem</label>
              <input id="ei-g" value={einlage.gegenpartei} onChange={(e) => setEinlage((v) => ({ ...v, gegenpartei: e.target.value }))} />
            </div>
            <div className="bu-feld bu-breit">
              <label htmlFor="ei-z">Zweck</label>
              <input id="ei-z" value={einlage.zweck} onChange={(e) => setEinlage((v) => ({ ...v, zweck: e.target.value }))} />
            </div>
          </div>
          <div className="bu-knoepfe">
            <button className="bu-knopf primaer" disabled={laeuft === "ei" || !einlage.betrag || !einlage.zweck.trim()}
              onClick={() => tu("ei", "/buchhaltung/bewegung", { ...einlage, art: "einlage" }, "Einlage gebucht.")}>Einlage buchen</button>
            <button className="bu-knopf neutral" disabled={laeuft === "ea" || !einlage.betrag || !einlage.zweck.trim()}
              onClick={() => tu("ea", "/buchhaltung/bewegung", { ...einlage, art: "ausgabe" }, "Ausgabe gebucht.")}>Als Ausgabe buchen</button>
          </div>

          <hr className="bu-trenner" />
          <h3>Übergabe</h3>
          <p className="bu-hinweis">
            Wer die Buchhaltung bisher geführt hat und ab wann Florentine verantwortlich ist. Der Text erscheint im internen
            Übergabevermerk — er gibt deine Angabe wieder, nicht eine Behauptung des Systems.
          </p>
          <div className="bu-gitter">
            <div className="bu-feld">
              <label htmlFor="ue-b">Bisher geführt von</label>
              <input id="ue-b" value={ueb.bisher} onChange={(e) => setUeb((v) => ({ ...v, bisher: e.target.value }))} />
            </div>
            <div className="bu-feld">
              <label htmlFor="ue-s">Übergabe zum</label>
              <input id="ue-s" type="date" value={ueb.stichtag} onChange={(e) => setUeb((v) => ({ ...v, stichtag: e.target.value }))} />
            </div>
          </div>
          <div className="bu-knoepfe">
            <button className="bu-knopf primaer" disabled={laeuft === "ue" || !ueb.bisher.trim()}
              onClick={() => tu("ue", "/buchhaltung/uebergabe", ueb, "Übergabe hinterlegt.")}>Übergabe hinterlegen</button>
            {lage.uebergabe?.bestaetigtVon && (
              <span className="bu-fein" style={{ color: "var(--bu-leise)", fontSize: 12 }}>
                Bestätigt von {lage.uebergabe.bestaetigtVon.split("@")[0]} am {tag(lage.uebergabe.bestaetigtAm)}.
              </span>
            )}
          </div>
        </>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
export default function BuchhaltungPage() {
  const [ich, setIch] = useState<Ich | null>(null);
  const [geprueft, setGeprueft] = useState(false);

  useEffect(() => {
    document.title = "Buchhaltung · FIAON";
    ruf("/buchhaltung/status")
      .then((j) => { if (j.angemeldet) setIch(j.ich); })
      .catch(() => { /* nicht angemeldet ist kein Fehler */ })
      .finally(() => setGeprueft(true));
  }, []);

  const abmelden = async () => {
    await fetch("/api/fiaon/buchhaltung/abmelden", { method: "POST", credentials: "include" }).catch(() => null);
    setIch(null);
  };

  if (!geprueft) return <div data-fiaon-buch className="bu-nacht" />;
  if (!ich) return <div data-fiaon-buch className="bu-nacht"><Tor fertig={setIch} /></div>;
  return <div data-fiaon-buch><Raum ich={ich} abmelden={abmelden} /></div>;
}
