// ═══════════════════════════════════════════════════════════════════════════
// DER AUFTRAG AUF DER ZAHLUNGSSEITE (09.10.2026, E-318)
//
// Justin: „bearbeite die Zahlungsseite, dass dort sein Vertrag angezeigt wird und all sowas — seriöser“. Gehört eine Rechnung
// zu einem angenommenen Begleitvertrag (E-312), zeigt /zahlung/<Zweck> oben die Gesellschaft, den Vertrag und die Rechnung als
// PDF, unten „So geht es weiter“ und die Ansprechpartner. Die Sätze baut der Server
// (server/lib/fiaon-global-angebot-begleit.ts begleitZahlungsKontext); hier steht nur die Form.
// Der Vertrag geht NUR über den signierten Link des Angebots raus (nie über den Verwendungszweck allein).
// ═══════════════════════════════════════════════════════════════════════════
export interface ZahlungAuftragKontext {
  auge: string;
  /** z. B. „CHEHADE LLC“ — fehlt, wenn die Rechnung keinen Gesellschaftsnamen trägt */
  gesellschaft: string | null;
  gesellschaftZeile: string;
  satz: string;
  dokumenteTitel: string;
  dokumente: { titel: string; unter: string; href: string }[];
  hinweis: string;
  schritteTitel: string;
  schritte: { titel: string; text: string }[];
  ansprechTitel: string;
  ansprechpartner: { kuerzel: string; name: string; rolle: string; email: string; telefon: string; portrait: string }[];
}
