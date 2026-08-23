// ═══════════════════════════════════════════════════════════════════════════
// MEIN BEREICH — der neue Kundenbereich (E-013, 22.08.2026)
//
// Drei Schichten, wie in der Vision: EINSICHT (Bonität, Finanzen), AKTION
// (Fahrplan, Schreiben, Unterlagen), ZUGANG (Vorteile). Dazu das Konto.
//
// Die Seite rechnet nichts selbst: Etappen, Stufe und der nächste Schritt
// kommen aus /api/fiaon/kunde/:ref/bereich (fiaon-kunde-bereich.ts). Hier wird
// nur gezeichnet. Immer hell (styles/mein-bereich.css). Kunden werden gesiezt
// (E-002). Keine Icons, keine Emojis.
//
// Noch nicht angebunden (ehrlich gezeigt statt leer): Kontoanbindung (E-014,
// GoCardless), Schreiben-Generator, KI-Auswertung der Auskunft (E-015).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutDashboard, ShieldCheck, Link2, Wallet, Map, FileText, FolderOpen, Gift, UserRound, CreditCard, Lock, LifeBuoy, LogOut, ChevronLeft, ChevronRight, X } from "lucide-react";
import "@/styles/mein-bereich.css";
import { Einrichtung, einrichtungsPhase } from "@/components/kunde/Einrichtung";

// Demo-Konto (23.08.2026): unter /demo/kundenbereich zeigt dieselbe Seite die
// Platzhalterdaten von FIAON-DEMO (server/routes/fiaon-demo.ts) — ohne Login.
const DEMO = typeof window !== "undefined" && window.location.pathname.startsWith("/demo");
const DEMO_REF = "FIAON-DEMO";

// ── Datenform des Endpunkts ─────────────────────────────────────────────────
interface Etappe { key: string; titel: string; text: string; stand: "fertig" | "jetzt" | "kommt"; datum: string | null; stempel: string | null; href?: string | null }
interface Bereich {
  kunde: { ref: string; vorname: string; nachname: string; email: string; telefon: string; strasse: string; plz: string; ort: string; land: string; geburtsdatum: string | null; kundeSeit: string | null; profilRueckfrage: boolean; profilHinweis: string | null };
  paket: { key: string | null; name: string; abo: boolean; rahmen: number | null; wunschlimit: number | null; monatlichCents: number | null; zahlungsstatus: string; zahlungsreferenz: string | null; faelligAm: string | null };
  stufe: { stufe: string | null; text: string | null; grund: string | null; naechsterSchritt: string | null; vollAktiv: boolean; pflicht: boolean; bezahlt: boolean };
  bonitaet: { stufe: string; fuerKunden: string; naechsterSchritt: string; bezahlt: boolean; hatDokument: boolean; geprueft: boolean; darfKaufen: boolean; darfHochladen: boolean; bestellRef: string | null; zahlungsreferenz: string | null; zahlungsstatus: string | null; preisEuro: number } | null;
  unterlagen: { kontoauszug: boolean; ausweis: boolean; auskunft: boolean; erneutKontoauszug: boolean; erneutAusweis: boolean; kycStatus: string; kontoStatus: string };
  abo: { verlaengerung?: { gefragt: boolean; entschieden: boolean; verlaengert: boolean; beendet: boolean; bezahlteRaten: number }; naechste: { nr: number; betragCents: number; faelligAm: string | null; status: string; referenz: string } | null; offen: number; bezahlt: number; raten: { nr: number; betragCents: number; faelligAm: string | null; faelligIso: string | null; status: string; bezahltAm: string | null }[] };
  termin: { beginn: string; status: string; agent: string | null } | null;
  fahrplan: Etappe[];
  naechsterSchritt: { key: string; titel: string; text: string; href: string | null } | null;
  ansprechpartner: { name: string; rolle: string | null } | null;
  lastschrift: { mandat: string | null; status: string | null; aktiv: boolean };
  kontoVerbunden: boolean;
  passwortGesetzt?: boolean;
  finanzen?: any;
}

const eur = (n: number | null | undefined) => n == null ? "—" : new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 0 }).format(n);
const eurCents = (c: number | null | undefined) => c == null ? "—" : new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(c / 100);
function gruss(): string {
  const h = new Date().getHours();
  return h >= 5 && h < 11 ? "Guten Morgen" : h >= 11 && h < 17 ? "Guten Tag" : "Guten Abend";
}
/** Paketfarbe wie CreditCard3D im alten Dashboard — damit die Karte dieselbe bleibt. */
function paketVerlauf(name: string): string {
  const n = (name || "").toLowerCase();
  if (n.includes("high") || n.includes("black")) return "linear-gradient(145deg,#0d1b2a,#1b2d44,#2a4060)";
  if (n.includes("ultra") || n.includes("elite")) return "linear-gradient(145deg,#1a3050,#2a5580,#3d7ab8)";
  if (n.includes("pro") || n.includes("standard")) return "linear-gradient(145deg,#1a3f6f,#2563eb,#4a8af5)";
  if (!n) return "linear-gradient(145deg,#1a3f6f,#2563eb,#4a8af5)";
  return "linear-gradient(145deg,#4a7ab5,#6a9fd4,#8ab8e8)";
}
function paketKurz(name: string): string {
  const n = (name || "").toLowerCase();
  if (n.includes("high")) return "High End"; if (n.includes("ultra")) return "Ultra";
  if (n.includes("pro")) return "Pro"; if (n.includes("start")) return "Start";
  if (n.includes("business")) return "Business"; return "Mitglied";
}

async function api(pfad: string, init?: RequestInit) {
  const r = await fetch(`/api/fiaon${pfad}`, { credentials: "include", headers: init?.body ? { "Content-Type": "application/json" } : undefined, ...init });
  const j = await r.json().catch(() => null);
  return { status: r.status, ok: r.ok && j?.ok, json: j };
}

// ── Die Mitgliedskarte (Neigung + Lichtpunkt wie im Live-Code) ─────────────
function Mitgliedskarte({ name, paket, rahmen }: { name: string; paket: string; rahmen: number | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const bewegen = (e: React.MouseEvent) => {
    const k = ref.current; if (!k) return;
    const b = k.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
    k.classList.add("aktiv");
    k.style.setProperty("--rx", `${(y / b.height - .5) * -10}deg`);
    k.style.setProperty("--ry", `${(x / b.width - .5) * 10}deg`);
    k.style.setProperty("--mx", `${x / b.width * 100}%`);
    k.style.setProperty("--my", `${y / b.height * 100}%`);
  };
  const verlassen = () => { const k = ref.current; if (!k) return; k.classList.remove("aktiv"); k.style.setProperty("--rx", "0deg"); k.style.setProperty("--ry", "0deg"); };
  return (
    <div className="mb-karte-buehne">
      <div ref={ref} className="mb-kk" style={{ background: paketVerlauf(paket) }} onMouseMove={bewegen} onMouseLeave={verlassen}>
        <div className="mb-kk-licht" /><div className="mb-kk-streifen" />
        <div className="mb-kk-innen">
          <div className="mb-kk-kopf"><span className="w">FIAON</span><span className="p">{paketKurz(paket)}</span></div>
          <div className="mb-chip" />
          <div className="mb-kk-rahmen"><small>Paket-Rahmen</small><b>{eur(rahmen)}</b></div>
          <div className="mb-kk-fuss"><span className="n">{name}</span><span className="m">Mitgliedskarte</span></div>
        </div>
      </div>
      <div className="mb-kk-schatten" aria-hidden="true" />
    </div>
  );
}

function Begruessung({ name, paket, rahmen, zeile, onZu }: { name: string; paket: string; rahmen: number | null; zeile: string; onZu: () => void }) {
  const [zu, setZu] = useState(false);
  const schliessen = () => { if (zu) return; setZu(true); setTimeout(onZu, 750); };
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") schliessen(); }; document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h); });
  return (
    <div className={`mb-vorhang${zu ? " zu" : ""}`} role="dialog" aria-label="Begrüßung">
      <div className="mb-vorhang-innen">
        <div className="mb-vorhang-karte"><Mitgliedskarte name={name} paket={paket} rahmen={rahmen} /></div>
        <div className="z1">Willkommen zurück</div>
        <h1 className="z2">{gruss()}, {name}.</h1>
        <p className="z3">{zeile}</p>
        <button className="mb-knopf" type="button" onClick={schliessen}>Zu meinem Bereich</button>
      </div>
    </div>
  );
}

// ── Seite ───────────────────────────────────────────────────────────────────
export default function MeinBereichPage() {
  const [d, setD] = useState<Bereich | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const einrichten = new URLSearchParams(window.location.search).get("einrichten") === "1";
  const [vorhang, setVorhang] = useState(() => !einrichten && (DEMO || sessionStorage.getItem("mb_begruesst") !== "1"));
  const [einrichtungFertig, setEinrichtungFertig] = useState(false);
  const [einrichtungStart, setEinrichtungStart] = useState<"auto" | "zahlung" | null>(null);
  const [eingeklappt, setEingeklappt] = useState(() => localStorage.getItem("mb_leiste") === "zu");
  const [menueOffen, setMenueOffen] = useState(false);
  useEffect(() => { const r = document.getElementById("root"); if (!r) return; r.style.overflow = menueOffen ? "hidden" : ""; return () => { r.style.overflow = ""; }; }, [menueOffen]);
  const [aktiv, setAktiv] = useState("buehne");

  // Die Referenz: aus dem Tab, sonst dauerhaft gespeichert, sonst fragt die
  // Seite das Cookie (/kunde/me). Vorher reichte ein geschlossener Tab, und
  // der Kunde stand trotz gültigem 30-Tage-Cookie wieder vor dem Login.
  const [ref, setRef] = useState<string | null>(() => {
    if (DEMO) return DEMO_REF;
    try { return JSON.parse(sessionStorage.getItem("fiaon_user") || localStorage.getItem("fiaon_user") || "{}")?.ref || null; } catch { return null; }
  });
  useEffect(() => {
    if (ref) return;
    api("/kunde/me").then((r) => {
      if (r.ok && r.json?.eingeloggt && r.json.ref) { try { sessionStorage.setItem("fiaon_user", JSON.stringify({ ref: r.json.ref })); } catch { /* egal */ } setRef(String(r.json.ref)); }
      else window.location.href = "/login";
    }).catch(() => { window.location.href = "/login"; });
  }, [ref]);

  useEffect(() => {
    if (!ref) return;
    api(`/kunde/${encodeURIComponent(ref ?? "")}/bereich`).then((r) => {
      if (r.status === 401 || r.status === 403) { window.location.href = "/login"; return; }
      if (!r.ok) { setFehler(r.json?.error || "Der Bereich konnte nicht geladen werden."); return; }
      setD(r.json as Bereich);
    }).catch(() => setFehler("Keine Verbindung. Bitte prüfen Sie Ihr Internet und laden Sie die Seite neu."));
  }, [ref]);

  // Leiste folgt dem Scrollen
  useEffect(() => {
    if (!d) return;
    const ziele = Array.from(document.querySelectorAll<HTMLElement>("main section[id]"));
    const lupe = new IntersectionObserver((es) => { es.forEach((e) => { if (e.isIntersecting) setAktiv(e.target.id); }); }, { rootMargin: "-30% 0px -60% 0px" });
    ziele.forEach((z) => lupe.observe(z));
    return () => lupe.disconnect();
  }, [d]);

  const leisteUmschalten = () => { const zu = !eingeklappt; setEingeklappt(zu); localStorage.setItem("mb_leiste", zu ? "zu" : "auf"); };
  const terminWaehlen = async () => {
    const r = await api(`/kunde/${encodeURIComponent(ref ?? "")}/startgespraech`);
    const token = r.json?.token;
    if (token) window.location.href = `/termin/${encodeURIComponent(token)}?art=start`;
    else alert(r.json?.error || "Der Terminlink konnte nicht erzeugt werden. Bitte versuchen Sie es gleich noch einmal.");
  };
  const lastschriftStarten = async () => {
    const r = await api(`/kunde/${encodeURIComponent(ref ?? "")}/lastschrift/start`, { method: "POST" });
    if (r.ok && r.json?.url) window.location.href = r.json.url;
    else if (r.ok && r.json?.bereits) alert("Ihre Lastschrift ist bereits eingerichtet.");
    else alert(r.json?.error || "Die Lastschrift konnte nicht gestartet werden.");
  };
  const lastschriftRueckmeldung = new URLSearchParams(window.location.search).get("lastschrift");
  const abmelden = async () => { if (DEMO) { window.location.href = "/demo"; return; } await api("/kunde/logout", { method: "POST" }).catch(() => null); sessionStorage.removeItem("fiaon_user"); window.location.href = "/login"; };

  if (fehler) return <div className="mb"><div className="mb-laden"><div className="mb-hinweis" style={{ maxWidth: 420 }}><b>Das hat nicht geklappt.</b><br />{fehler}</div></div></div>;
  if (!d) return <div className="mb"><div className="mb-laden">Ihr Bereich wird geladen …</div></div>;

  const name = `${d.kunde.vorname} ${d.kunde.nachname}`.trim() || "Mitglied";
  const initialen = `${d.kunde.vorname?.[0] || ""}${d.kunde.nachname?.[0] || ""}`.toUpperCase() || "FI";
  const ns = d.naechsterSchritt;
  const begruessungsZeile = ns ? `Ihr nächster Schritt: ${ns.titel}.` : "Alles ist auf dem neuesten Stand.";
  const leadText = d.stufe.vollAktiv
    ? (ns ? `${ns.text}` : "Ihr Konto ist vollständig aktiv.")
    : (d.stufe.naechsterSchritt || d.stufe.text || "Ihr Konto wird nach dem Startgespräch vollständig freigeschaltet.");
  const grussWorte = `${gruss()}, ${name}.`.split(" ");

  const punkte = [
    { id: "buehne", kurz: "ÜB", label: "Übersicht", gruppe: "Einsicht", Icon: LayoutDashboard },
    { id: "bonitaet", kurz: "BO", label: "Meine Bonität", gruppe: "Einsicht", Icon: ShieldCheck },
    { id: "kontoanbindung", kurz: "KV", label: "Konto verbinden", gruppe: "Einsicht", Icon: Link2, marke: "Bald" },
    { id: "finanzen", kurz: "MF", label: "Meine Finanzen", gruppe: "Einsicht", Icon: Wallet },
    { id: "fahrplan", kurz: "FP", label: "Mein Fahrplan", gruppe: "Aktion", Icon: Map },
    { id: "schreiben", kurz: "MS", label: "Meine Schreiben", gruppe: "Aktion", Icon: FileText },
    { id: "unterlagen", kurz: "UN", label: "Unterlagen", gruppe: "Aktion", Icon: FolderOpen, marke: [!d.unterlagen.kontoauszug || d.unterlagen.erneutKontoauszug, !d.unterlagen.ausweis || d.unterlagen.erneutAusweis].filter(Boolean).length || undefined },
    { id: "vorteile", kurz: "MV", label: "Meine Vorteile", gruppe: "Zugang", Icon: Gift },
    { id: "konto", kurz: "MK", label: "Mein Konto", gruppe: "Konto", Icon: UserRound },
    { id: "abo", kurz: "AZ", label: "Abo & Zahlungen", gruppe: "Konto", Icon: CreditCard },
    { id: "sicherheit", kurz: "PS", label: "Passwort & Sicherheit", gruppe: "Konto", Icon: Lock },
    { id: "hilfe", kurz: "HI", label: "Hilfe", gruppe: "Konto", Icon: LifeBuoy },
  ];
  const gruppen = ["Einsicht", "Aktion", "Zugang", "Konto"];

  return (
    <div className="mb">
      <div className="mb-lichter" aria-hidden="true"><div className="mb-licht a" /><div className="mb-licht b" /></div>
      {DEMO && <a className="mb-demo-band" href="/demo">Demo-Konto mit Platzhalterdaten<span>Zurück zur Demo-Übersicht</span></a>}

      {/* Die Einrichtungs-Ebene (E-032): Passwort → Wahl; bezahlt ohne Startgespräch → versperrt bis zur Buchung. */}
      {!DEMO && (einrichtungStart !== null || (!einrichtungFertig && (einrichten || ["passwort", "wahl", "terminPflicht"].includes(einrichtungsPhase(d))))) && (
        <Einrichtung bereich={d} name={name} start={einrichtungStart ?? "auto"} onFertig={() => { setEinrichtungFertig(true); setEinrichtungStart(null); history.replaceState(null, "", "/mein-bereich"); }} />
      )}
      {vorhang && <Begruessung name={name} paket={d.paket.name} rahmen={d.paket.rahmen} zeile={begruessungsZeile}
        onZu={() => { sessionStorage.setItem("mb_begruesst", "1"); setVorhang(false); }} />}

      {d.stufe.bezahlt && !d.termin && !d.stufe.vollAktiv && !vorhang && (
        <div className="mb-vorhang mb-gate" role="dialog" aria-label="Startgespräch buchen">
          <div className="mb-vorhang-innen">
            <div className="z1" style={{ animationDelay: ".1s" }}>Ein Schritt noch</div>
            <h1 className="z2" style={{ animationDelay: ".25s", fontSize: 30 }}>Ihr Startgespräch — dann ist alles frei.</h1>
            <p className="z3" style={{ animationDelay: ".4s" }}>Fünfzehn Minuten am Telefon: Wir gehen Ihren Bereich gemeinsam durch, klären offene Fragen und schalten Ihr Konto vollständig frei. Wählen Sie jetzt einen Zeitpunkt, der Ihnen passt.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button className="mb-knopf" type="button" style={{ animationDelay: ".6s" }} onClick={terminWaehlen}>Termin wählen</button>
              {!d.stufe.pflicht && <button className="mb-knopf still" type="button" style={{ animationDelay: ".7s" }} onClick={() => document.querySelector(".mb-gate")?.classList.add("zu")}>Später</button>}
              <button className="mb-knopf still" type="button" style={{ animationDelay: ".8s" }} onClick={abmelden}>Abmelden</button>
            </div>
          </div>
        </div>
      )}

      <header className="mb-kopf">
        <div className="mb-kopf-innen">
          <button type="button" className="mb-burger" aria-label="Menü öffnen" aria-expanded={menueOffen} onClick={() => setMenueOffen(true)}><span /><span /><span /></button>
          <a className="mb-wort fiaon-gradient-text-animated" href="/mein-bereich">FIAON</a>
          <span className="mb-bereich-marke">Mitgliedsbereich</span>
          <div className="mb-kopf-rechts">
            <div className="mb-kopf-name">{name}<small>{d.paket.name}{d.kunde.kundeSeit ? ` · Mitglied seit ${d.kunde.kundeSeit}` : ""}</small></div>
            <div className="mb-gesicht" aria-hidden="true">{initialen}</div>
          </div>
        </div>
      </header>

      {/* ═══ Handy: klassisches linkes Schubladen-Menü (Justin, 23.08.2026) — Glas, Symbole, Gruppen,
          Nutzerkarte, Kontakt, Abmelden. Ersetzt die Leiste unten und das Blatt „Mehr". ═══ */}
      <div className={`mb-schublade-hintergrund${menueOffen ? " offen" : ""}`} onClick={() => setMenueOffen(false)} aria-hidden="true" />
      <aside className={`mb-schublade${menueOffen ? " offen" : ""}`} aria-label="Menü" aria-hidden={!menueOffen}>
        <div className="mb-schublade-kopf">
          <span className="mb-wort fiaon-gradient-text-animated">FIAON</span>
          <button type="button" className="mb-schublade-zu" onClick={() => setMenueOffen(false)} aria-label="Menü schließen"><X size={20} strokeWidth={2} /></button>
        </div>
        <div className="mb-schublade-nutzer"><div className="mb-gesicht" aria-hidden="true">{initialen}</div><div><b>{name}</b><small>{d.paket.name}</small></div></div>
        <nav className="mb-schublade-liste">
          {gruppen.map((g) => (
            <div key={g} className="mb-schublade-gruppe">
              <div className="mb-schublade-titel">{g}</div>
              {punkte.filter((p) => p.gruppe === g).map((p, i) => (
                <a key={p.id} href={`#${p.id}`} className={aktiv === p.id ? "aktiv" : ""} style={{ animationDelay: `${60 + i * 35}ms` }} onClick={() => setMenueOffen(false)}>
                  <i className="mb-symbol" aria-hidden="true"><p.Icon size={18} strokeWidth={1.75} /></i><span>{p.label}</span>{p.marke ? <span className="mb-marke">{p.marke}</span> : null}
                </a>
              ))}
            </div>
          ))}
        </nav>
        <div className="mb-schublade-fuss">
          <a href="/kontakt" onClick={() => setMenueOffen(false)}><LifeBuoy size={18} strokeWidth={1.75} /><span>Kontakt &amp; Support</span></a>
          <button type="button" onClick={abmelden}><LogOut size={18} strokeWidth={1.75} /><span>Abmelden</span></button>
        </div>
      </aside>

      <div className="mb-rahmen">
        <div className={`mb-grundriss${eingeklappt ? " eingeklappt" : ""}`}>
          <nav className="mb-leiste" aria-label="Bereiche">
            <button className="mb-klapp" type="button" onClick={leisteUmschalten} aria-expanded={!eingeklappt} title={eingeklappt ? "Menü ausklappen" : "Menü einklappen"}>
              {eingeklappt ? <ChevronRight size={18} strokeWidth={2} aria-hidden="true" /> : <><ChevronLeft size={16} strokeWidth={2} aria-hidden="true" /><span>Menü einklappen</span></>}
            </button>
            <div className="mb-panel">
              {gruppen.map((g) => (<div key={g} style={{ display: "contents" }}>
                <div className="mb-leiste-titel">{g}</div>
                {punkte.filter((p) => p.gruppe === g).map((p) => (
                  <a key={p.id} href={`#${p.id}`} title={p.label} className={aktiv === p.id ? "aktiv" : ""}>
                    <i className="mb-symbol" aria-hidden="true"><p.Icon size={18} strokeWidth={1.75} /></i>
                    <span>{p.label}</span>{p.marke ? <span className="mb-marke">{p.marke}</span> : null}
                  </a>
                ))}
              </div>))}
              <div className="mb-nutzer"><div className="mb-gesicht" aria-hidden="true">{initialen}</div><div style={{ minWidth: 0 }}><b>{name}</b><small>{d.paket.name}</small></div></div>
              <button type="button" className="mb-link" title="Abmelden" onClick={abmelden}><i className="mb-symbol" aria-hidden="true"><LogOut size={18} strokeWidth={1.75} /></i><span>Abmelden</span></button>
            </div>
          </nav>

          <main className="mb-spalte">
            {/* ═══ BÜHNE ═══ */}
            <section className="mb-buehne" id="buehne">
              <div>
                <div className="mb-eyebrow">Ihr Stand</div>
                <h1 className="mb-gruss">{grussWorte.map((w, i) => <span key={i}><span className="w" style={{ animationDelay: `${0.15 + i * 0.12}s` }}>{w}</span>{i < grussWorte.length - 1 ? " " : ""}</span>)}</h1>
                <p className="lead">{leadText}</p>
                <div className="mb-kennzahlen">
                  <div className="mb-kz"><small>Paket</small><b>{d.paket.name}</b></div>
                  <div className="mb-kz"><small>Paket-Rahmen</small><b className="zahl">{eur(d.paket.rahmen)}</b></div>
                  <div className="mb-kz"><small>Wunschlimit</small><b className="zahl">{eur(d.paket.wunschlimit)}</b></div>
                  <div className="mb-kz"><small>Bonitätswert</small><b className="zahl">{d.bonitaet?.geprueft ? "liegt vor" : "noch offen"}</b></div>
                  <div className="mb-kz"><small>Nächste Abbuchung</small><b className="zahl">{d.abo.naechste ? `${d.abo.naechste.faelligAm} · ${eurCents(d.abo.naechste.betragCents)}` : (d.paket.monatlichCents ? eurCents(d.paket.monatlichCents) + " / Monat" : "—")}</b></div>
                  <div className="mb-kz"><small>Status</small><b>{d.stufe.vollAktiv ? "Vollständig aktiv" : "Wartet auf Startgespräch"}</b></div>
                </div>
              </div>
              <Mitgliedskarte name={name} paket={d.paket.name} rahmen={d.paket.rahmen} />
            </section>

            {/* ═══ ZAHLUNG OFFEN (E-032): Gespräch gebucht, Paket noch offen — sichtbar, nicht versperrt ═══ */}
            {!DEMO && !d.stufe.bezahlt && einrichtungsPhase(d) === "zahlungOffen" && (
              <div className="mb-offen">
                <div>
                  <div className="mb-eyebrow">Ihr Paket ist noch offen</div>
                  <h3>{d.termin ? `Ihr Gespräch ist gebucht${d.termin.beginn ? ` – ${new Date(d.termin.beginn).toLocaleString("de-DE", { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })} Uhr` : ""}.` : "Ihr Gespräch ist gebucht."}</h3>
                  <p>Damit daraus Ihr Startgespräch wird und FIAON Ihre Auskunft beantragen kann, fehlt noch die erste Rate: {d.paket.monatlichCents != null ? eurCents(d.paket.monatlichCents) : "Ihr Paket"}{d.paket.zahlungsreferenz ? ` · Verwendungszweck ${d.paket.zahlungsreferenz}` : ""}. Überweisen Sie jetzt – oder im Gespräch gemeinsam mit Ihrer Ansprechpartnerin.</p>
                </div>
                <div className="mb-offen-knoepfe">
                  <button type="button" className="mb-knopf" onClick={() => setEinrichtungStart("zahlung")}>Jetzt bezahlen</button>
                  <span className="mb-lage frist">Offen</span>
                </div>
              </div>
            )}
            {/* ═══ STARTGESPRÄCH — Termin gebucht, noch nicht geführt ═══ */}
            {d.stufe.bezahlt && d.termin && d.termin.status !== "erledigt" && (
              <div className="mb-pflicht">
                <div><h3>Ihr Startgespräch ist gebucht</h3><p>{new Date(d.termin.beginn).toLocaleString("de-DE", { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })} Uhr{d.termin.agent ? ` mit ${d.termin.agent}` : ""}. Wir rufen Sie an — halten Sie bitte Ihren Bereich geöffnet, wir gehen ihn gemeinsam durch.</p></div>
              </div>
            )}
            {lastschriftRueckmeldung && (
              <div className={`mb-meldung ${lastschriftRueckmeldung === "eingerichtet" ? "gut" : "fehler"}`} style={{ marginTop: 0 }}>
                {lastschriftRueckmeldung === "eingerichtet" ? "Ihre Lastschrift ist eingerichtet. Die Raten werden ab jetzt automatisch eingezogen — Sie müssen nichts mehr überweisen."
                  : lastschriftRueckmeldung === "abgebrochen" ? "Die Einrichtung wurde abgebrochen. Sie können sie jederzeit unter Abo & Zahlungen erneut starten."
                  : "Die Lastschrift konnte nicht eingerichtet werden. Bitte versuchen Sie es erneut oder schreiben Sie uns."}
              </div>
            )}

            {/* ═══ NÄCHSTER SCHRITT ═══ */}
            {ns && ns.key !== "start" && (
              <div className="mb-tat">
                <div><h3>{ns.titel}</h3><p>{ns.text}</p></div>
                {ns.href ? <a className="mb-knopf" href={ns.href}>Jetzt erledigen</a> : null}
              </div>
            )}

            {/* ═══ BONITÄT ═══ */}
            <section id="bonitaet">
              <div className="mb-abschnitt-kopf"><div><h2>Ihre Bonität</h2><p>{d.bonitaet?.fuerKunden || "Eine Auskunft, jeder Eintrag geprüft, in Menschensprache erklärt."}</p></div></div>
              <div className="mb-karte">
                {d.bonitaet?.geprueft ? (
                  <div className="mb-warte"><b>Ihre Auskunft ist geprüft.</b> Die Auswertung mit Ihren Einträgen und deren Wirkung in Punkten erscheint hier, sobald die Analyse freigegeben ist. Ihre Ansprechpartnerin meldet sich dazu.</div>
                ) : d.bonitaet?.hatDokument ? (
                  <div className="mb-warte"><b>Ihre Auskunft ist eingegangen.</b> Wir gehen jeden Eintrag durch und leiten daraus Ihre nächsten Schritte ab. Sie hören von uns, sobald die Auswertung vorliegt.</div>
                ) : d.bonitaet?.bezahlt ? (
                  <div className="mb-warte"><b>Bezahlt — die Auskunft wird beschafft.</b> {d.bonitaet.naechsterSchritt}</div>
                ) : (
                  <div className="mb-raster">
                    <div>
                      <h4 style={{ fontSize: 16, fontWeight: 700 }}>Bonitätsauskunft — der Grundstein</h4>
                      <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "var(--text-leise)", maxWidth: "56ch" }}>Bevor irgendetwas anderes Sinn hat, braucht es einen Überblick: Was steht über Sie in den Auskunfteien? Die Auskunft wird neutral abgerufen und verändert Ihren Wert nicht. Einmalig 74 €, kein Abo.</p>
                      <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {!d.stufe.bezahlt && !DEMO
                          ? <span className="mb-hinweis" style={{ display: "block" }}>Sobald Ihr Paket bezahlt ist, beauftragen Sie hier Ihre Bonitätsauskunft – ein Schritt nach dem anderen.</span>
                          : d.bonitaet?.zahlungsreferenz && d.bonitaet.zahlungsstatus !== "paid"
                          ? <a className="mb-knopf" href={`/zahlung/${encodeURIComponent(d.bonitaet.zahlungsreferenz)}`}>Auskunft jetzt bezahlen</a>
                          : d.bonitaet?.darfKaufen ? <a className="mb-knopf" href={`/bonitaet-antrag?ref=${encodeURIComponent(d.kunde.ref)}`}>Auskunft beauftragen</a> : null}
                        {d.bonitaet?.darfHochladen && <a className="mb-knopf still" href="#unterlagen">Sie haben schon eine Auskunft? Hochladen</a>}
                      </div>
                    </div>
                    <div className="mb-warte"><b>Was Sie danach sehen:</b> Ihren Wert als Bogen, die drei größten Einträge mit ihrer Wirkung in Punkten, und zu jedem eine Einschätzung — rechtmäßig, angreifbar oder rechtswidrig.</div>
                  </div>
                )}
              </div>
            </section>

            {/* ═══ FAHRPLAN ═══ */}
            <section id="fahrplan">
              <div className="mb-abschnitt-kopf"><div><h2>Ihr Fahrplan</h2><p>{d.fahrplan.length} Etappen bis zum Ziel. Sie stehen bei Nummer {Math.max(1, d.fahrplan.findIndex((e) => e.stand === "jetzt") + 1)}.</p></div></div>
              <div className="mb-karte">
                <ol className="mb-fahrplan">
                  {d.fahrplan.map((e, i) => (
                    <li key={e.key} className={`mb-etappe ${e.stand}`}>
                      <span className="mb-etappe-punkt zahl" aria-hidden="true">{e.stand === "fertig" ? "✓" : i + 1}</span>
                      <h4>{e.titel}{e.stempel && <span className={`mb-stempel ${e.stand === "fertig" ? "gut" : e.stand === "jetzt" ? "jetzt" : ""} zahl`}>{e.datum || e.stempel}</span>}</h4>
                      <p>{e.text}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </section>

            {/* ═══ SCHREIBEN ═══ */}
            <section id="schreiben">
              <div className="mb-abschnitt-kopf"><div><h2>Ihre Schreiben</h2><p>Fertig ausgefüllt, juristisch geprüft, mit einem Klick versendet.</p></div></div>
              <div className="mb-raster">
                {[["Löschantrag · Art. 17 DSGVO", "Für Einträge ohne Rechtsgrund. Die Auskunftei muss innerhalb eines Monats antworten."],
                  ["Ratenvereinbarung", "Für offene Forderungen: ein tragbarer Vorschlag, den das Inkasso annehmen kann."],
                  ["Selbstauskunft · Art. 15 DSGVO", "Ihre kostenlose Datenkopie bei SCHUFA, KSV1870 oder CRIF — vorbereitet, Sie unterschreiben."]].map(([t, x]) => (
                  <article className="mb-kachel" key={t}><h4>{t}</h4><p>{x}</p><div className="mb-kachel-fuss"><span className="mb-lage ruht">Nach der Analyse</span></div></article>
                ))}
              </div>
              <div className="mb-hinweis" style={{ marginTop: 16 }}><b>Jeder Brieftyp wird vor dem ersten Versand vom Anwaltsteam freigegeben</b> und mit Datum versioniert. Welche Fassung an Sie ging, steht später im Verlauf — nachvollziehbar, auch Jahre später.</div>
            </section>

            {/* ═══ UNTERLAGEN ═══ */}
            <section id="unterlagen">
              <div className="mb-abschnitt-kopf"><div><h2>Unterlagen</h2><p>Was vorliegt, was fehlt — und wie Sie es einreichen.</p></div></div>
              <div className="mb-raster">
                {[
                  { t: "Kontoauszug", da: d.unterlagen.kontoauszug && !d.unterlagen.erneutKontoauszug, x: d.unterlagen.erneutKontoauszug ? "Bitte erneut einreichen — die erste Fassung war nicht lesbar." : "Die letzten drei Monate, als PDF aus Ihrem Online-Banking. Ein Handyfoto genügt, wenn alles lesbar ist." },
                  { t: "Ausweis oder Reisepass", da: d.unterlagen.ausweis && !d.unterlagen.erneutAusweis, x: d.unterlagen.erneutAusweis ? "Bitte erneut einreichen — die erste Fassung war nicht lesbar." : "Vorder- und Rückseite, gut beleuchtet, alle vier Ecken sichtbar." },
                  { t: "Bonitätsauskunft", da: d.unterlagen.auskunft, x: "Über uns beschafft oder selbst hochgeladen — beides geht." },
                ].map((u) => (
                  <article className="mb-kachel" key={u.t}><h4>{u.t}</h4><p>{u.x}</p>
                    <div className="mb-kachel-fuss"><span className={`mb-lage ${u.da ? "gut" : "frist"}`}>{u.da ? "Liegt vor" : "Fehlt"}</span></div></article>
                ))}
              </div>
              <Upload refKunde={d.kunde.ref} fehlt={{ kontoauszug: !d.unterlagen.kontoauszug || d.unterlagen.erneutKontoauszug, ausweis: !d.unterlagen.ausweis || d.unterlagen.erneutAusweis, auskunft: !d.unterlagen.auskunft && !!d.bonitaet?.darfHochladen }} />
            </section>

            {/* ═══ KONTOANBINDUNG ═══ */}
            <section id="kontoanbindung">
              <div className="mb-abschnitt-kopf"><div><h2>Ihr Konto verbinden</h2><p>Statt Auszüge zu fotografieren: Sie melden sich einmal bei Ihrer Bank an, wir erhalten die Umsätze direkt und vollständig.</p></div></div>
              <div className="mb-karte mb-verbinden">
                <div>
                  {[["Bank auswählen", "Ihre Bank aus über 2.300 Instituten in Deutschland und Österreich — Filialbank, Direktbank oder Sparkasse."],
                    ["Bei Ihrer Bank anmelden", "Sie werden zu Ihrer Bank weitergeleitet und bestätigen dort wie beim Online-Banking. FIAON sieht Ihre Zugangsdaten nie."],
                    ["Freigabe für 90 Tage", "Sie erlauben nur das Lesen der Umsätze. Kein Zugriff auf Überweisungen. Jederzeit widerrufbar."],
                    ["Umsätze kommen an", "Die letzten 12 Monate werden geprüft, sortiert und in Ihre Finanzübersicht eingearbeitet — in Minuten."]].map(([t, x], i) => (
                    <div className="mb-schritt" key={t}><span className="mb-schritt-nr zahl">{i + 1}</span><div><h4>{t}</h4><p>{x}</p></div></div>
                  ))}
                  <div className="mb-freigabe"><b>Was wir lesen dürfen — und was nicht</b>
                    <ul><li>Lesen: Kontostand, Umsätze der letzten 12 Monate, Daueraufträge.</li><li>Nicht möglich: Überweisungen auslösen, Limits ändern, Zugangsdaten speichern.</li><li>Grundlage: EU-Zahlungsdiensterichtlinie PSD2 über einen zugelassenen Kontoinformationsdienst.</li></ul></div>
                </div>
                <div className="mb-bank-glas gesperrt">
                  <div className="mb-sperre" role="status">
                    <span className="mb-sperre-symbol" aria-hidden="true"><Lock size={20} strokeWidth={1.75} /></span>
                    <b>In Kürze verfügbar</b>
                    <p>Die Kontoanbindung wird gerade freigeschaltet. Bis dahin laden Sie Ihre Kontoauszüge bitte manuell hoch – ein Handyfoto oder PDF genügt.</p>
                    <a className="mb-knopf" href="#unterlagen">Kontoauszüge hochladen</a>
                  </div>
                  <div className="mb-eyebrow" style={{ marginBottom: 12 }}>Ihre Bank</div>
                  <div className="mb-suche"><input type="text" placeholder="Name, BLZ oder BIC" aria-label="Bank suchen" disabled /><span className="kuerzel">BLZ · BIC</span></div>
                  <div style={{ marginTop: 16, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <button className="mb-knopf" type="button" disabled>Bank verbinden</button>
                    <a className="mb-knopf still" href="#unterlagen">Lieber Auszug hochladen</a>
                  </div>
                  <div className="mb-siegel"><span>Verschlüsselt</span><span>Zugelassener Dienst</span><span>Nur Lesezugriff</span><span>Jederzeit widerrufbar</span></div>
                  <p style={{ margin: "14px 0 0", fontSize: 12.5, color: "var(--text-still)" }}>Die Bankanbindung wird gerade freigeschaltet. Bis dahin nehmen wir Ihren Kontoauszug als Datei entgegen — unter Unterlagen.</p>
                </div>
              </div>
            </section>

            {/* ═══ FINANZEN ═══ */}
            <section id="finanzen">
              <div className="mb-abschnitt-kopf"><div><h2>Ihre Finanzen</h2><p>Wohin Ihr Geld geht — nicht geschätzt, gezählt.</p></div></div>
              <FinanzAnalyse a={d.finanzen ?? null} hatAuszug={d.unterlagen.kontoauszug} />
              <Zahlungskalender raten={d.abo.raten} paket={d.paket.name} />
                  <p style={{ margin: "14px 0 0", fontSize: 12, color: "var(--text-still)" }}>Sie möchten nicht weitermachen? <a href="/abo-kuendigen" style={{ color: "var(--text-leise)", textDecoration: "underline", textUnderlineOffset: 3 }}>Abo kündigen</a> – wir sagen Ihnen vorher ehrlich, was Sie verlieren.</p>
              {!d.finanzen && <div className="mb-hinweis" style={{ marginTop: 16 }}><b>Sobald Ihr Kontoauszug vorliegt</b> (oder Ihr Konto verbunden ist), erscheinen hier Miete, Strom, Versicherungen, Abos und alle anderen festen Zahlungen — mit Betrag und Rhythmus. Dazu Ihr Ausgabenprofil nach Bereichen und Merksätze, die benennen, wo Spielraum ist.</div>}
            </section>

            {/* ═══ VORTEILE ═══ */}
            <section id="vorteile">
              <div className="mb-abschnitt-kopf"><div><h2>Ihre Vorteile</h2><p>Was heute geht, was in Reichweite ist, und was das Ziel bleibt.</p></div></div>
              <div className="mb-raster">
                <article className="mb-kachel"><h4>DKB Girokonto</h4><p>Kostenlos, ohne Bonitätsprüfung. Spart Ihnen rund 60 € im Jahr.</p><div className="mb-kachel-fuss"><span className="mb-lage gut">Heute möglich</span><span className="zahl" style={{ fontSize: 12, color: "var(--text-still)" }}>über Ihre Ansprechpartnerin</span></div></article>
                <article className="mb-kachel"><h4>Kreditkarte{d.paket.wunschlimit ? ` bis ${eur(d.paket.wunschlimit)}` : ""}</h4><p>Ihr Wunschlimit. Erreichbar, sobald Ihr Wert die Schwelle des Kartenpartners erreicht — wir sagen Ihnen, wann es so weit ist.</p><div className="mb-kachel-fuss"><span className="mb-lage bereit">Das Ziel</span></div></article>
                <article className="mb-kachel"><h4>Finanzierung</h4><p>Für Auto, Umzug oder Anschaffung. Braucht einen stabilen Wert über mehrere Monate.</p><div className="mb-kachel-fuss"><span className="mb-lage ruht">Später</span></div></article>
                {/* E-026: Kunden werden Mitarbeiter — die Bewerbung ist vorbelegt. */}
                <article className="mb-kachel" style={{ background: "linear-gradient(135deg,rgba(37,99,235,.07),rgba(40,141,250,.04))" }}><h4>Werden Sie Teil des FIAON Teams</h4><p>Arbeiten Sie von zuhause — für das, was Ihnen selbst hilft. Start auf Provision, Fixum bei Bewährung. Bewerbung in 60 Sekunden, Ihre Daten sind schon eingetragen.</p><div className="mb-kachel-fuss"><a className="mb-knopf klein" href={`/karriere?ref=${encodeURIComponent(d.kunde.ref)}`}>Jetzt bewerben</a></div></article>
              </div>
            </section>

            {/* ═══ KONTO ═══ */}
            <section id="konto">
              <div className="mb-abschnitt-kopf"><div><h2>Mein Konto</h2><p>Ihre Daten, Ihr Abo, Ihre Sicherheit — alles an einem Ort, jederzeit änderbar.</p></div></div>
              <div className="mb-konto">
                <Stammdaten d={d} />
                <div className="mb-karte" id="abo"><h4 style={{ fontSize: 15, marginBottom: 8 }}>Abo &amp; Zahlungen</h4>
                  {d.abo.verlaengerung?.gefragt && !d.abo.verlaengerung.entschieden && (
                    <Verlaengerung refKunde={d.kunde.ref} raten={d.abo.verlaengerung.bezahlteRaten} />
                  )}
                  {d.abo.verlaengerung?.beendet && (
                    <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--text-leise)" }}>Ihr Abo endet mit der letzten Rate. Möchten Sie doch weitermachen? Schreiben Sie uns unter Hilfe.</p>
                  )}
                  <div className="mb-zeile"><span>Paket</span><span>{d.paket.name}</span></div>
                  <div className="mb-zeile"><span>{d.paket.abo ? "Monatlich" : "Einmalig"}</span><span className="zahl">{eurCents(d.paket.monatlichCents)}</span></div>
                  <div className="mb-zeile"><span>Nächste Abbuchung</span><span className="zahl">{d.abo.naechste?.faelligAm || "—"}</span></div>
                  <div className="mb-zeile"><span>Verwendungszweck</span><span className="zahl">{d.abo.naechste?.referenz || d.paket.zahlungsreferenz || "—"}</span></div>
                  <div className="mb-zeile"><span>Bezahlt / offen</span><span className="zahl">{d.abo.bezahlt} / {d.abo.offen}</span></div>
                  <div className="mb-zeile"><span>Kündbar</span><span>zum Monatsende, formlos per E-Mail</span></div>
                  <div className="mb-zeile"><span>Lastschrift</span><span>{d.lastschrift.aktiv ? "eingerichtet — Raten werden automatisch eingezogen" : d.lastschrift.mandat ? "wird von Ihrer Bank bestätigt" : "nicht eingerichtet"}</span></div>
                  <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {!d.lastschrift.aktiv && d.paket.abo && d.stufe.bezahlt && <button className="mb-knopf klein" type="button" onClick={lastschriftStarten}>Lastschrift einrichten</button>}
                    {d.abo.naechste && d.abo.naechste.status !== "bezahlt" && d.abo.naechste.referenz && <a className={`mb-knopf klein${d.lastschrift.aktiv ? " still" : ""}`} href={`/zahlung/${encodeURIComponent(d.abo.naechste.referenz)}`}>Jetzt überweisen</a>}
                    <a className="mb-knopf still klein" href="/abo-kuendigen">Abo kündigen</a>
                  </div>
                  {!d.lastschrift.aktiv && d.paket.abo && (d.stufe.bezahlt
                    ? <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--text-still)" }}>Mit der Lastschrift geben Sie Ihre IBAN einmal sicher bei unserem Zahlungspartner GoCardless ein — FIAON sieht sie nie. Danach wird jede weitere Rate pünktlich eingezogen, ohne dass Sie an die Überweisung denken müssen.</p>
                    : <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--text-still)" }}>Die Lastschrift können Sie einrichten, sobald Ihre erste Zahlung eingegangen ist.</p>)}
                </div>
                <Passwort refKunde={d.kunde.ref} />
                <Hilfe refKunde={d.kunde.ref} ansprechpartner={d.ansprechpartner?.name || null} />
              </div>
            </section>

            <footer className="mb-fuss"><span>FIAON LTD · Company No. 17318250</span><span>128 City Road, London EC1V 2NX</span><a href="/impressum">Impressum</a><a href="/privacy">Datenschutz</a></footer>
          </main>
        </div>
      </div>
    </div>
  );
}

// ── Stammdaten (bearbeitbar über den bestehenden PATCH /profile/:ref) ───────
function Stammdaten({ d }: { d: Bereich }) {
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ email: d.kunde.email, phone: d.kunde.telefon, street: d.kunde.strasse, zip: d.kunde.plz, city: d.kunde.ort });
  const [meldung, setMeldung] = useState<{ ton: "gut" | "fehler"; text: string } | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const speichern = async () => {
    setLaeuft(true); setMeldung(null);
    const r = await api(`/profile/${encodeURIComponent(d.kunde.ref)}`, { method: "PATCH", body: JSON.stringify(f) });
    setLaeuft(false);
    if (r.ok) { setMeldung({ ton: "gut", text: "Gespeichert." }); setEdit(false); }
    else setMeldung({ ton: "fehler", text: r.json?.error || "Das konnte nicht gespeichert werden." });
  };
  return (
    <div className="mb-karte" id="stammdaten"><h4 style={{ fontSize: 15, marginBottom: 8 }}>Persönliche Daten</h4>
      {d.kunde.profilRueckfrage && <div className="mb-meldung fehler">{d.kunde.profilHinweis || "Bitte prüfen Sie Ihre Angaben."}</div>}
      {!edit ? (<>
        <div className="mb-zeile"><span>Name</span><span>{d.kunde.vorname} {d.kunde.nachname}</span></div>
        <div className="mb-zeile"><span>E-Mail</span><span>{d.kunde.email || "—"}</span></div>
        <div className="mb-zeile"><span>Telefon</span><span className="zahl">{d.kunde.telefon || "—"}</span></div>
        <div className="mb-zeile"><span>Anschrift</span><span>{[d.kunde.strasse, [d.kunde.plz, d.kunde.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "—"}</span></div>
        <div style={{ marginTop: 14 }}><button className="mb-knopf still klein" type="button" onClick={() => setEdit(true)}>Bearbeiten</button></div>
      </>) : (<>
        {([["email", "E-Mail"], ["phone", "Telefon"], ["street", "Straße und Hausnummer"], ["zip", "PLZ"], ["city", "Ort"]] as const).map(([k, l]) => (
          <div className="mb-feld" key={k}><label htmlFor={`f-${k}`}>{l}</label><input id={`f-${k}`} value={(f as any)[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
        ))}
        <div style={{ marginTop: 14, display: "flex", gap: 8 }}><button className="mb-knopf klein" type="button" disabled={laeuft} onClick={speichern}>{laeuft ? "Speichert …" : "Speichern"}</button><button className="mb-knopf still klein" type="button" onClick={() => setEdit(false)}>Abbrechen</button></div>
      </>)}
      {meldung && <div className={`mb-meldung ${meldung.ton}`}>{meldung.text}</div>}
    </div>
  );
}

function Passwort({ refKunde }: { refKunde: string }) {
  const [alt, setAlt] = useState(""); const [neu, setNeu] = useState(""); const [neu2, setNeu2] = useState("");
  const [meldung, setMeldung] = useState<{ ton: "gut" | "fehler"; text: string } | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const aendern = async () => {
    setMeldung(null);
    if (neu !== neu2) { setMeldung({ ton: "fehler", text: "Die beiden neuen Passwörter stimmen nicht überein." }); return; }
    setLaeuft(true);
    const r = await api(`/kunde/${encodeURIComponent(refKunde)}/passwort`, { method: "POST", body: JSON.stringify({ alt, neu }) });
    setLaeuft(false);
    if (r.ok) { setMeldung({ ton: "gut", text: "Ihr Passwort wurde geändert." }); setAlt(""); setNeu(""); setNeu2(""); }
    else setMeldung({ ton: "fehler", text: r.json?.error || "Das Passwort konnte nicht geändert werden." });
  };
  return (
    <div className="mb-karte" id="sicherheit"><h4 style={{ fontSize: 15, marginBottom: 8 }}>Passwort &amp; Sicherheit</h4>
      <div className="mb-feld"><label htmlFor="pw-alt">Bisheriges Passwort</label><input id="pw-alt" type="password" autoComplete="current-password" value={alt} onChange={(e) => setAlt(e.target.value)} /></div>
      <div className="mb-feld"><label htmlFor="pw-neu">Neues Passwort (mindestens 8 Zeichen)</label><input id="pw-neu" type="password" autoComplete="new-password" value={neu} onChange={(e) => setNeu(e.target.value)} /></div>
      <div className="mb-feld"><label htmlFor="pw-neu2">Neues Passwort wiederholen</label><input id="pw-neu2" type="password" autoComplete="new-password" value={neu2} onChange={(e) => setNeu2(e.target.value)} /></div>
      <div style={{ marginTop: 14 }}><button className="mb-knopf klein" type="button" disabled={laeuft || !alt || neu.length < 8} onClick={aendern}>{laeuft ? "Ändert …" : "Passwort ändern"}</button></div>
      {meldung && <div className={`mb-meldung ${meldung.ton}`}>{meldung.text}</div>}
      <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--text-still)" }}>Ihre Sitzung läuft nach 30 Tagen ab. Abmelden finden Sie im Menü.</p>
    </div>
  );
}

// ── Zahlungskalender: heute die FIAON-Raten, später alle festen Zahlungen ───
function Zahlungskalender({ raten, paket }: { raten: Bereich["abo"]["raten"]; paket: string }) {
  const [monat, setMonat] = useState(() => { const h = new Date(); return new Date(h.getFullYear(), h.getMonth(), 1); });
  const heute = new Date(); const heuteKey = heute.toISOString().slice(0, 10);
  const eintraege = raten.filter((r) => r.faelligIso).map((r) => ({
    datum: r.faelligIso as string, titel: `${/^fiaon/i.test(paket) ? paket : `FIAON ${paket}`} · Rate ${r.nr}`,
    zweck: `Verwendungszweck: ${(r as any).referenz || "siehe Rechnung"}`, betragCents: r.betragCents,
    art: r.status === "bezahlt" ? "bezahlt" : "offen", bezahltAm: r.bezahltAm,
  }));
  const imMonat = eintraege.filter((e) => e.datum.startsWith(monat.toISOString().slice(0, 7)));
  const summe = (art: string) => imMonat.filter((e) => e.art === art).reduce((a, e) => a + e.betragCents, 0);
  const ersterWt = (monat.getDay() + 6) % 7; const tage = new Date(monat.getFullYear(), monat.getMonth() + 1, 0).getDate();
  const zellen = [...Array(ersterWt).fill(null), ...Array.from({ length: tage }, (_, i) => i + 1)];
  const monatsName = monat.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  const schieben = (n: number) => setMonat(new Date(monat.getFullYear(), monat.getMonth() + n, 1));
  return (
    <div className="mb-karte mb-kal">
      <div>
        <div className="mb-kal-kopf"><button type="button" onClick={() => schieben(-1)} aria-label="Vormonat">‹</button><h4>{monatsName}</h4><button type="button" onClick={() => schieben(1)} aria-label="Folgemonat">›</button></div>
        <div className="mb-kal-raster">
          {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((w) => <div className="mb-kal-wt" key={w}>{w}</div>)}
          {zellen.map((t, i) => {
            if (!t) return <div className="mb-kal-tag leer" key={`l${i}`} />;
            const key = `${monat.getFullYear()}-${String(monat.getMonth() + 1).padStart(2, "0")}-${String(t).padStart(2, "0")}`;
            const am = eintraege.filter((e) => e.datum === key);
            return <div className={`mb-kal-tag${key === heuteKey ? " heute" : ""}${am.length ? " mit" : ""}`} key={key}>{t}{am.length > 0 && <span style={{ display: "flex", gap: 3 }}>{am.slice(0, 3).map((e, j) => <span key={j} className={`p ${e.art}`} />)}</span>}</div>;
          })}
        </div>
      </div>
      <div>
        <div className="mb-kal-summe">
          <div className="mb-kz"><small>Im Monat</small><b className="zahl">{eurCents(summe("offen") + summe("bezahlt"))}</b></div>
          <div className="mb-kz"><small>Offen</small><b className="zahl" style={{ color: summe("offen") ? "var(--frist)" : undefined }}>{eurCents(summe("offen"))}</b></div>
          <div className="mb-kz"><small>Bezahlt</small><b className="zahl" style={{ color: "var(--gut)" }}>{eurCents(summe("bezahlt"))}</b></div>
        </div>
        <div className="mb-kal-liste">
          {imMonat.length === 0 && <div className="mb-warte">In diesem Monat sind keine Zahlungen eingetragen.</div>}
          {imMonat.sort((a, b) => a.datum.localeCompare(b.datum)).map((e, i) => (
            <div className={`mb-kal-eintrag ${e.art}`} key={i}>
              <div className="d">{e.datum.slice(8, 10)}.{e.datum.slice(5, 7)}.<small>{new Date(e.datum).toLocaleDateString("de-DE", { weekday: "short" })}</small></div>
              <div className="t">{e.titel}<small>{e.zweck}{e.bezahltAm ? ` · bezahlt am ${e.bezahltAm}` : ""}</small></div>
              <div className="b">{eurCents(e.betragCents)}<small>{e.art === "bezahlt" ? "bezahlt" : "offen"}</small></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Die Auswertung des Kontoauszugs ───────────────────────────────────────
function FinanzAnalyse({ a, hatAuszug }: { a: any; hatAuszug: boolean }) {
  if (!a) {
    if (!hatAuszug) return null;
    return <div className="mb-karte" style={{ marginBottom: 16 }}><h4 style={{ fontSize: 15 }}>Ihre Auswertung wird vorbereitet</h4><p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-leise)" }}>Ihr Kontoauszug liegt vor. Die Auswertung erscheint hier, sobald sie fertig ist — laden Sie die Seite in ein paar Minuten neu.</p></div>;
  }
  if (a.status === "laeuft") return <div className="mb-karte" style={{ marginBottom: 16 }}><h4 style={{ fontSize: 15 }}>Ihr Kontoauszug wird gerade ausgewertet</h4><p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-leise)" }}>Das dauert in der Regel unter einer Minute. Laden Sie die Seite gleich neu.</p></div>;
  if (a.status === "unlesbar") return <div className="mb-karte" style={{ marginBottom: 16 }}><h4 style={{ fontSize: 15 }}>Ihr Kontoauszug ließ sich nicht auswerten</h4><p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-leise)" }}>{a.fehler}</p><a className="mb-knopf still" href="#unterlagen" style={{ marginTop: 10, display: "inline-block" }}>Neue Datei hochladen</a></div>;
  if (a.status === "fehler") return <div className="mb-karte" style={{ marginBottom: 16 }}><h4 style={{ fontSize: 15 }}>Die Auswertung ist nicht gelungen</h4><p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-leise)" }}>Wir prüfen das und melden uns. Ihr Kontoauszug ist sicher gespeichert.</p></div>;
  const zeitraum = a.zeitraumVon && a.zeitraumBis ? `${a.zeitraumVon.split("-").reverse().join(".")} – ${a.zeitraumBis.split("-").reverse().join(".")}` : "Zeitraum des Auszugs";
  const rest = (a.einnahmenCents ?? 0) - (a.ausgabenCents ?? 0);
  const ton = (art: string) => (art === "inkasso" || art === "pfaendung" || art === "ruecklastschrift") ? "var(--kritisch)" : art === "dispo" || art === "mahnung" || art === "kredit" ? "var(--frist)" : "var(--text-leise)";
  return (
    <div style={{ display: "grid", gap: 14, marginBottom: 16 }}>
      <div className="mb-karte">
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text-still)" }}>Aus Ihrem Kontoauszug · {zeitraum}</p>
        <div className="mb-raster" style={{ marginTop: 12 }}>
          {[["Einnahmen", a.einnahmenCents, "var(--gut)"], ["Ausgaben", a.ausgabenCents, "var(--text)"], ["Bleibt übrig", rest, rest >= 0 ? "var(--gut)" : "var(--kritisch)"], ["Gehalt / Rente", a.gehaltCents, "var(--text)"]].map(([t, v, c]) => (
            <article className="mb-kachel" key={String(t)}><p style={{ margin: 0, fontSize: 11.5, color: "var(--text-still)" }}>{t as string}</p><p className="zahl" style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 700, color: c as string }}>{v == null ? "—" : eurCents(v as number)}</p></article>
          ))}
        </div>
        {(a.dispoGenutzt || a.ruecklastschriften > 0) && (
          <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--frist)", fontWeight: 600 }}>
            {a.dispoGenutzt ? `Dispo genutzt${a.dispoTiefstCents != null ? ` (tiefster Stand ${eurCents(a.dispoTiefstCents)})` : ""}` : ""}
            {a.dispoGenutzt && a.ruecklastschriften > 0 ? " · " : ""}
            {a.ruecklastschriften > 0 ? `${a.ruecklastschriften} Rücklastschrift${a.ruecklastschriften === 1 ? "" : "en"}` : ""}
          </p>
        )}
      </div>
      {a.merksaetze?.length > 0 && (
        <div className="mb-karte" style={{ background: "linear-gradient(135deg,rgba(37,99,235,.07),rgba(40,141,250,.04))" }}>
          <h4 style={{ fontSize: 15, marginBottom: 6 }}>Was das für Sie heißt</h4>
          {a.merksaetze.map((m: string, i: number) => <p key={i} style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.55 }}>{m}</p>)}
        </div>
      )}
      {a.fixkosten?.length > 0 && (
        <div className="mb-karte">
          <h4 style={{ fontSize: 15, marginBottom: 8 }}>Ihre festen Zahlungen</h4>
          {a.fixkosten.map((f: any, i: number) => (
            <div className="mb-zeile" key={i}><span>{f.name}<small style={{ display: "block", color: "var(--text-still)" }}>{f.kategorie} · {f.rhythmus}</small></span><span className="zahl">{eurCents(f.betragCents ?? f.betrag_cents)}</span></div>
          ))}
        </div>
      )}
      {a.kategorien?.length > 0 && (
        <div className="mb-karte">
          <h4 style={{ fontSize: 15, marginBottom: 8 }}>Wohin Ihr Geld geht</h4>
          {a.kategorien.slice().sort((x: any, y: any) => (y.betragCents ?? y.betrag_cents ?? 0) - (x.betragCents ?? x.betrag_cents ?? 0)).map((k: any, i: number) => (
            <div key={i} style={{ margin: "8px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>{k.name}</span><span className="zahl">{eurCents(k.betragCents ?? k.betrag_cents)} · {Math.round((k.anteil || 0) * 100)} %</span></div>
              <div style={{ height: 6, borderRadius: 6, background: "var(--flaeche-still)", marginTop: 4, overflow: "hidden" }}><div style={{ width: `${Math.min(100, Math.round((k.anteil || 0) * 100))}%`, height: "100%", background: "linear-gradient(90deg,#288DFA,#1D4ED8)" }} /></div>
            </div>
          ))}
        </div>
      )}
      {a.warnungen?.length > 0 && (
        <div className="mb-karte">
          <h4 style={{ fontSize: 15, marginBottom: 8 }}>Was für Ihre Bonität zählt</h4>
          {a.warnungen.map((w: any, i: number) => (
            <p key={i} style={{ margin: "6px 0 0", fontSize: 13.5, color: ton(w.art) }}>{w.text}{(w.betragCents ?? w.betrag_cents) != null ? ` (${eurCents(w.betragCents ?? w.betrag_cents)})` : ""}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Nach Rate 12: „Möchten Sie bleiben?" (E-024) ──────────────────────────
function Verlaengerung({ refKunde, raten }: { refKunde: string; raten: number }) {
  const [laeuft, setLaeuft] = useState<"ja" | "nein" | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const antworten = async (bleiben: boolean) => {
    setLaeuft(bleiben ? "ja" : "nein");
    const r = await api(`/kunde/${encodeURIComponent(refKunde)}/abo/verlaengerung`, { method: "POST", body: JSON.stringify({ bleiben }) });
    setLaeuft(null);
    if (r.ok) { setMeldung(r.json?.meldung || "Danke."); setTimeout(() => window.location.reload(), 1800); }
    else setMeldung(r.json?.error || "Das hat nicht geklappt. Bitte versuchen Sie es erneut.");
  };
  return (
    <div style={{ margin: "0 0 14px", padding: 14, borderRadius: 14, background: "linear-gradient(135deg,rgba(37,99,235,.08),rgba(40,141,250,.05))", border: "1px solid rgba(37,99,235,.18)" }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--blau-tief)" }}>Ihre {raten} Raten sind geschafft</p>
      <h4 style={{ fontSize: 16, margin: "6px 0 4px" }}>Möchten Sie bleiben?</h4>
      <p style={{ margin: 0, fontSize: 13, color: "var(--text-leise)" }}>Mit einem Klick läuft Ihr Abo weitere zwölf Monate — zum gleichen Preis, jederzeit zum Monatsende kündbar. Ohne Antwort endet es mit der letzten Rate.</p>
      {meldung ? <p style={{ margin: "10px 0 0", fontSize: 13, fontWeight: 600, color: "var(--blau-tief)" }}>{meldung}</p> : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <button type="button" className="mb-knopf" disabled={!!laeuft} onClick={() => void antworten(true)}>{laeuft === "ja" ? "Einen Moment …" : "Ja, ich bleibe"}</button>
          <button type="button" className="mb-knopf still" disabled={!!laeuft} onClick={() => void antworten(false)}>{laeuft === "nein" ? "Einen Moment …" : "Nein, Abo beenden"}</button>
        </div>
      )}
    </div>
  );
}

// ── Upload: direkt an den bestehenden Endpunkt /upload-kyc (multipart) ──────
function Upload({ refKunde, fehlt }: { refKunde: string; fehlt: { kontoauszug: boolean; ausweis: boolean; auskunft: boolean } }) {
  const [dateien, setDateien] = useState<{ bankStatement?: File; idCard?: File; schufaDoc?: File }>({});
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ ton: "gut" | "fehler"; text: string } | null>(null);
  const felder: { key: "bankStatement" | "idCard" | "schufaDoc"; label: string; zeigen: boolean }[] = [
    { key: "bankStatement", label: "Kontoauszug (PDF oder Foto)", zeigen: fehlt.kontoauszug },
    { key: "idCard", label: "Ausweis oder Reisepass (PDF oder Foto)", zeigen: fehlt.ausweis },
    // Die Auskunft beschafft FIAON — das Feld ist ein Angebot für Kunden, die schon eine haben, keine Aufforderung.
    { key: "schufaDoc", label: "Eigene Bonitätsauskunft — nur falls Sie schon eine haben (optional)", zeigen: fehlt.auskunft },
  ];
  const sichtbar = felder.filter((f) => f.zeigen);
  if (sichtbar.length === 0) return null;
  const senden = async () => {
    const fd = new FormData(); fd.append("ref", refKunde);
    let n = 0; for (const f of sichtbar) { const d = dateien[f.key]; if (d) { fd.append(f.key, d); n++; } }
    if (!n) { setMeldung({ ton: "fehler", text: "Bitte wählen Sie zuerst eine Datei aus." }); return; }
    setLaeuft(true); setMeldung(null);
    const r = await fetch("/api/fiaon/upload-kyc", { method: "POST", body: fd, credentials: "include" });
    const j = await r.json().catch(() => null); setLaeuft(false);
    if (r.ok && j?.ok !== false) { setMeldung({ ton: "gut", text: j?.message || "Eingegangen. Wir prüfen Ihre Unterlagen innerhalb von zwei Werktagen und melden uns." }); setTimeout(() => window.location.reload(), 2200); }
    else setMeldung({ ton: "fehler", text: j?.error || "Der Upload hat nicht geklappt. Bitte versuchen Sie es erneut." });
  };
  return (
    <div className="mb-karte" style={{ marginTop: 16 }}>
      <h4 style={{ fontSize: 15 }}>Jetzt einreichen</h4>
      <p style={{ margin: "4px 0 0", fontSize: 12.8, color: "var(--text-leise)" }}>PDF, JPG oder PNG, bis 20 MB je Datei. Ein Handyfoto genügt, wenn alles lesbar ist — alle vier Ecken im Bild.</p>
      <div className="mb-upload">
        {sichtbar.map((f) => (
          <label key={f.key}><span>{f.label}</span><span className="gewaehlt">{dateien[f.key]?.name || "Datei wählen"}</span>
            <input type="file" accept=".pdf,image/*" onChange={(e) => setDateien({ ...dateien, [f.key]: e.target.files?.[0] })} /></label>
        ))}
      </div>
      <div style={{ marginTop: 12 }}><button className="mb-knopf klein" type="button" disabled={laeuft} onClick={senden}>{laeuft ? "Lädt hoch …" : "Hochladen"}</button></div>
      {meldung && <div className={`mb-meldung ${meldung.ton}`}>{meldung.text}</div>}
    </div>
  );
}

// ── Hilfe als Anliegen: Datensatz mit Zustand statt E-Mail ins Nirgendwo ────
function Hilfe({ refKunde, ansprechpartner }: { refKunde: string; ansprechpartner: string | null }) {
  const [liste, setListe] = useState<any[] | null>(null);
  const [betreff, setBetreff] = useState(""); const [text, setText] = useState("");
  const [offen, setOffen] = useState(false); const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ ton: "gut" | "fehler"; text: string } | null>(null);
  const laden = () => api(`/kunde/${encodeURIComponent(refKunde)}/tickets`).then((r) => setListe(r.ok ? r.json.tickets : []));
  useEffect(() => { laden(); }, [refKunde]);
  const senden = async () => {
    setLaeuft(true); setMeldung(null);
    const r = await api(`/kunde/${encodeURIComponent(refKunde)}/tickets`, { method: "POST", body: JSON.stringify({ betreff, text }) });
    setLaeuft(false);
    if (r.ok) { setMeldung({ ton: "gut", text: "Ihr Anliegen ist bei uns. Sie sehen die Antwort hier und bekommen sie zusätzlich per E-Mail." }); setBetreff(""); setText(""); setOffen(false); laden(); }
    else setMeldung({ ton: "fehler", text: r.json?.error || "Das Anliegen konnte nicht gesendet werden." });
  };
  const lage = (s: string) => s === "erledigt" ? "gut" : s === "beantwortet" ? "bereit" : "frist";
  const lageText = (s: string) => s === "erledigt" ? "Erledigt" : s === "beantwortet" ? "Beantwortet" : "In Bearbeitung";
  return (
    <div className="mb-karte" id="hilfe" style={{ gridColumn: "1 / -1" }}>
      <h4 style={{ fontSize: 15, marginBottom: 8 }}>Hilfe &amp; Anliegen</h4>
      <div className="mb-zeile"><span>Ihre Ansprechpartnerin</span><span>{ansprechpartner || "FIAON Team"}</span></div>
      <div className="mb-zeile"><span>Antwortzeit</span><span>werktags innerhalb von 24 Stunden</span></div>
      {!offen ? <div style={{ marginTop: 14 }}><button className="mb-knopf klein" type="button" onClick={() => setOffen(true)}>Neues Anliegen</button></div> : (
        <div>
          <div className="mb-feld"><label htmlFor="t-betreff">Worum geht es?</label><input id="t-betreff" value={betreff} onChange={(e) => setBetreff(e.target.value)} placeholder="z. B. Frage zu meiner Rate im September" /></div>
          <div className="mb-feld"><label htmlFor="t-text">Ihre Nachricht</label><textarea id="t-text" rows={4} value={text} onChange={(e) => setText(e.target.value)} style={{ font: "500 14px/1.5 'Inter',sans-serif", padding: "11px 12px", borderRadius: 10, border: "1px solid var(--linie-stark)", background: "var(--flaeche)", color: "var(--text)", resize: "vertical" }} /></div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}><button className="mb-knopf klein" type="button" disabled={laeuft || betreff.length < 3 || text.length < 10} onClick={senden}>{laeuft ? "Sendet …" : "Absenden"}</button><button className="mb-knopf still klein" type="button" onClick={() => setOffen(false)}>Abbrechen</button></div>
        </div>
      )}
      {meldung && <div className={`mb-meldung ${meldung.ton}`}>{meldung.text}</div>}
      {liste && liste.length > 0 && (
        <div className="mb-kal-liste" style={{ marginTop: 16 }}>
          {liste.map((t) => (
            <div className="mb-kachel" key={t.id} style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <h4 style={{ fontSize: 14 }}>{t.betreff}</h4><span className={`mb-lage ${lage(t.status)}`}>{lageText(t.status)}</span>
              </div>
              <p style={{ whiteSpace: "pre-wrap" }}>{t.text}</p>
              {t.antwort && <div className="mb-warte" style={{ marginTop: 6 }}><b>Antwort{t.beantwortet_am ? ` vom ${new Date(t.beantwortet_am).toLocaleDateString("de-DE")}` : ""}:</b> <span style={{ whiteSpace: "pre-wrap" }}>{t.antwort}</span></div>}
              <small style={{ color: "var(--text-still)", fontSize: 11 }}>gesendet am {new Date(t.created_at).toLocaleDateString("de-DE")}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
