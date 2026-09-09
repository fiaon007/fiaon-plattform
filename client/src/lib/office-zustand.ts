// ═══════════════════════════════════════════════════════════════════════════
// OFFICE-ZUSTAND — zwei Wahrheiten, die den Seitenwechsel überleben
// (09.09.2026, E-169)
//
// ── DER ANLASS ─────────────────────────────────────────────────────────────
// Hans-Jürgen (Android-Handy, Chrome): „Die Verbindung bricht alle paar
// Minuten ab, ich muss neu anrufen.“ Gemessen an seinen Anrufen vom 08. und
// 09.09.: Jeder Abbruch kam von SEINER Seite (Twilio: Eltern-Leg „completed“
// beim Dial-Rückruf), und in derselben Sekunde hat sein Browser entweder die
// Seite ganz neu geladen (08.09., 10:59/11:05/11:08) oder im Office die Akte
// geöffnet (09.09., 09:02 — GET /agent/crm/kunden/12264). Der Telefon-Baustein
// hing an JEDER Office-Seite (jede Seite rendert ihren eigenen AgentShell),
// und sein Aufräum-Effekt legte beim Verlassen der Seite auf.
//
// ── DIE LÖSUNG ─────────────────────────────────────────────────────────────
// Das Telefon hängt jetzt EINMAL an der App (SoftphoneHost in App.tsx),
// außerhalb des Routen-Schalters. Damit es weiß, ob ein Mitarbeiter angemeldet
// ist, meldet der Office-Rahmen die Sitzung hier an — und beim Seitenwechsel
// bleibt der letzte Stand stehen, bis die neue Seite geladen hat.
//
// Kein React-Kontext: Der Rahmen lebt in jeder Seite neu, das Telefon außerhalb
// aller Seiten. Ein Kontext müsste über beiden stehen; ein kleiner Speicher mit
// useSyncExternalStore reicht und hat keine Abhängigkeit zur Seitenstruktur.
// ═══════════════════════════════════════════════════════════════════════════

export type OfficeSitzung = { email: string; name: string } | null;

let sitzung: OfficeSitzung = null;
const hoerer = new Set<() => void>();

export const agentSitzung = {
  lesen: (): OfficeSitzung => sitzung,
  /** Gleiche E-Mail = gleiche Sitzung: kein Neuaufbau des Telefons. */
  setzen(neu: OfficeSitzung) {
    if ((sitzung?.email ?? null) === (neu?.email ?? null)) return;
    sitzung = neu;
    hoerer.forEach((h) => h());
  },
  abonnieren(h: () => void) {
    hoerer.add(h);
    return () => { hoerer.delete(h); };
  },
};

let gespraech = false;
export const telefon = {
  gespraechLaeuft: () => gespraech,
  /** Das Softphone meldet: wählt / klingelt / im Gespräch → true. */
  setzen(an: boolean) { gespraech = an; },
  /**
   * Vor dem Abmelden: Läuft ein Gespräch, fragt der Rahmen nach. Am 08.09.
   * (11:00) hat ein Tipp daneben am Handy die Sitzung beendet — mitten im
   * Kundengespräch, das damit ebenfalls weg war.
   */
  abmeldenErlaubt(): boolean {
    if (!gespraech) return true;
    return window.confirm("Du bist gerade im Gespräch. Wirklich abmelden? Das Gespräch wird damit beendet.");
  },
};
