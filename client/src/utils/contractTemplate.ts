const TEMPLATE = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>FIAON SaaS- und Lizenzvertrag – {{contractNumber}}</title>
<style>
@page {
  size: A4;
  margin: 20mm 15mm 20mm 15mm;
}
* { box-sizing: border-box; }
body {
  font-family: Arial, Helvetica, sans-serif;
  color: #111111;
  line-height: 1.5;
  font-size: 11pt;
  margin: 0;
  padding: 0;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.header { border-bottom: 2px solid #0F172A; padding-bottom: 14px; margin-bottom: 26px; overflow: hidden; }
.brand { float: left; }
.brand-name { font-size: 22pt; font-weight: 700; color: #0F172A; letter-spacing: 1.5px; line-height: 1; }
.brand-sub { font-size: 8.5pt; color: #64748B; text-transform: uppercase; letter-spacing: 2px; margin-top: 4px; }
.meta { float: right; text-align: right; font-size: 9pt; color: #475569; line-height: 1.7; }
.meta strong { color: #0F172A; }
h1 { font-size: 18pt; color: #0F172A; margin: 6px 0 4px 0; font-weight: 700; letter-spacing: 0.3px; }
.subtitle { font-size: 9.5pt; color: #64748B; text-transform: uppercase; letter-spacing: 2.5px; margin-bottom: 24px; border-bottom: 1px solid #E2E8F0; padding-bottom: 10px; }
h2 { font-size: 13.5pt; margin-top: 22px; margin-bottom: 6px; color: #0F172A; font-weight: 700; page-break-after: avoid; }
h3 { font-size: 11pt; margin-top: 14px; margin-bottom: 4px; color: #0F172A; font-weight: 700; page-break-after: avoid; }
p { margin: 7px 0; text-align: justify; hyphens: auto; }
.section { page-break-inside: avoid; margin-bottom: 12px; }
.parties { background: #F8FAFC; border: 1px solid #E2E8F0; border-left: 4px solid #2563EB; padding: 16px 20px; margin: 10px 0 24px 0; page-break-inside: avoid; }
.parties-title { font-size: 9pt; color: #64748B; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 10px; font-weight: 700; }
.party-row { overflow: hidden; margin-bottom: 14px; }
.party-row:last-child { margin-bottom: 0; }
.party-label { float: left; width: 22%; font-size: 9.5pt; color: #475569; font-weight: 700; padding-top: 2px; }
.party-body { float: left; width: 78%; font-size: 10.5pt; line-height: 1.55; }
.party-body strong { color: #0F172A; }
ul { margin: 6px 0 6px 22px; padding: 0; }
ul li { margin-bottom: 4px; text-align: justify; }
.price-table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10.5pt; page-break-inside: avoid; }
.price-table th, .price-table td { border: 1px solid #CBD5E1; padding: 10px 12px; text-align: left; vertical-align: top; }
.price-table th { background: #0F172A; color: #FFFFFF; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; font-size: 9.5pt; }
.price-table td.amount { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; font-weight: 600; color: #0F172A; }
.price-table tr.total td { background: #F1F5F9; font-weight: 700; color: #0F172A; border-top: 2px solid #0F172A; }
.notice { background: #FEF3C7; border-left: 4px solid #D97706; padding: 12px 16px; margin: 14px 0; font-size: 10.5pt; page-break-inside: avoid; }
.notice strong { color: #92400E; }
.notice-title { display: block; font-weight: 700; color: #78350F; text-transform: uppercase; letter-spacing: 1px; font-size: 9pt; margin-bottom: 4px; }
.signature-block { margin-top: 38px; page-break-inside: avoid; border-top: 2px solid #0F172A; padding-top: 20px; }
.signature-title { font-size: 11pt; font-weight: 700; color: #0F172A; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 4px; }
.signature-sub { font-size: 9pt; color: #64748B; margin-bottom: 22px; }
.signature-table { width: 100%; border-collapse: separate; border-spacing: 24px 0; margin-left: -24px; margin-right: -24px; }
.signature-cell { width: 50%; vertical-align: top; padding: 0; }
.sig-col-label { font-size: 9pt; color: #64748B; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; margin-bottom: 6px; }
.sig-static { font-size: 10.5pt; color: #111111; line-height: 1.6; margin-bottom: 8px; }
.sig-static strong { color: #0F172A; }
.sig-line { border-top: 1px solid #0F172A; margin-top: 56px; padding-top: 6px; font-size: 9pt; color: #475569; }
.sig-meta { background: #F8FAFC; border: 1px solid #E2E8F0; padding: 10px 12px; margin-top: 10px; font-size: 8.5pt; color: #475569; line-height: 1.7; word-break: break-all; }
.sig-meta .row { display: block; margin-bottom: 2px; }
.sig-meta strong { color: #0F172A; display: inline-block; min-width: 92px; }
.footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #E2E8F0; font-size: 8pt; color: #94A3B8; text-align: center; line-height: 1.6; }
.footer strong { color: #64748B; }
.small { font-size: 9pt; color: #475569; }
</style>
</head>
<body>

<div class="header">
  <div class="brand">
    <div class="brand-name">FIAON</div>
    <div class="brand-sub">SaaS- &amp; Lizenzvertrag</div>
  </div>
  <div class="meta">
    <strong>Vertragsnummer:</strong> {{contractNumber}}<br>
    <strong>Datum:</strong> {{date}}<br>
    <strong>Status:</strong> Digital abgeschlossen
  </div>
</div>

<h1>Software-as-a-Service (SaaS) und Lizenzvertrag</h1>
<div class="subtitle">FIAON Plattform &middot; B2B-Geschäftskundenvertrag</div>

<div class="parties">
  <div class="parties-title">Vertragsparteien</div>
  <div class="party-row">
    <div class="party-label">Anbieter</div>
    <div class="party-body">
      <strong>FIAON LTD</strong><br>
      128 City Road, London, EC1V 2NX, United Kingdom<br>
      Registerbehörde: Companies House (England and Wales), Company No. 17318250<br>
      Director: Justin Schwarzott<br>
      Plattform / Produktmarke: <strong>FIAON</strong><br>
      &ndash; nachfolgend &bdquo;<strong>Anbieter</strong>&ldquo; oder &bdquo;<strong>FIAON</strong>&ldquo; &ndash;
    </div>
  </div>
  <div style="clear:both;"></div>
  <div class="party-row">
    <div class="party-label">Kunde</div>
    <div class="party-body">
      <strong>{{companyName}} {{legalForm}}</strong><br>
      {{address}}<br>
      vertreten durch: <strong>{{representativeName}}</strong><br>
      &ndash; nachfolgend &bdquo;<strong>Kunde</strong>&ldquo; &ndash;
    </div>
  </div>
  <div style="clear:both;"></div>
</div>

<div class="section">
  <h2>Präambel</h2>
  <p>Der Anbieter betreibt unter der Marke FIAON eine technologische Software-as-a-Service-Plattform, welche Geschäftskunden datenbasierte Werkzeuge zur eigenständigen Analyse, Simulation und systematischen Optimierung ihrer unternehmerischen Bonität sowie strukturierte digitale Lehrinhalte (sogenannte Credit-Building-Protokolle) zur Verfügung stellt. Der Kunde ist Unternehmer im Sinne des § 14 BGB und beabsichtigt, diese Plattform im Rahmen seiner gewerblichen oder selbständigen beruflichen Tätigkeit zu nutzen, um seine bonitätsbezogenen Unternehmensprozesse eigenverantwortlich zu verbessern.</p>
  <p>Vor diesem Hintergrund vereinbaren die Parteien zur rechtsverbindlichen Regelung ihres Nutzungsverhältnisses die nachfolgenden Bestimmungen. Dieser Vertrag kommt durch elektronische Annahme über die FIAON-Onlinestrecke mit Wirkung zum {{date}} rechtsverbindlich zustande.</p>
</div>

<div class="section">
  <h2>§ 1 Vertragsgegenstand und Leistungsumfang</h2>
  <h3>1.1 Gegenstand des Vertrages</h3>
  <p>Gegenstand dieses Vertrages ist die entgeltliche Einräumung eines zeitlich auf die Vertragslaufzeit beschränkten, einfachen, nicht ausschließlichen und nicht übertragbaren Nutzungsrechtes an der FIAON-Plattform sowie die Erbringung der nachfolgend näher bezeichneten softwarebezogenen Dienstleistungen im Wege der Bereitstellung über das Internet (Software-as-a-Service).</p>
  <h3>1.2 Leistungsumfang im Einzelnen</h3>
  <p>Der Anbieter stellt dem Kunden gegen Zahlung der vereinbarten Vergütung folgende Leistungen zur Verfügung:</p>
  <ul>
    <li>webbasierten Zugang zur FIAON-Plattform über einen passwortgeschützten Geschäftskunden-Account;</li>
    <li>algorithmische und KI-gestützte Analyse-Werkzeuge zur Auswertung öffentlich und kundenseitig zugänglicher Bonitätsinformationen;</li>
    <li>simulationsbasierte Score-Rechner und Modellierungs-Werkzeuge;</li>
    <li>strukturierte digitale Lehr-, Schulungs- und Informationsinhalte zum eigenverantwortlichen Aufbau der geschäftlichen Bonität (Credit-Building-Protokolle);</li>
    <li>technischen E-Mail-basierten Anwendersupport zu funktionalen Fragen der Plattform.</li>
  </ul>
  <h3>1.3 Gewähltes Setup</h3>
  <p>Der Kunde hat im Rahmen des elektronischen Bestellvorgangs das nachfolgende Setup gewählt: <strong>{{selectedPackage}}</strong>. Dieses Setup bezieht sich auf eine theoretisch modellierte Bonitätsklasse mit einem rein illustrativen Wunsch-Zielrahmen in Höhe von <strong>{{maximumTargetLimit}}</strong>. Der Kunde nimmt ausdrücklich zur Kenntnis, dass es sich bei diesem Zielrahmen weder um eine Zusage des Anbieters noch um eine Verpflichtung eines Dritten handelt.</p>
  <h3>1.4 Verfügbarkeit der Plattform</h3>
  <p>Der Anbieter strebt eine Verfügbarkeit der FIAON-Plattform von mindestens 98,5 % im Jahresmittel an, gemessen am Zugriff auf die Produktivumgebung außerhalb planmäßiger Wartungsfenster.</p>
</div>

<div class="section">
  <h2>§ 2 Nutzung der FIAON-Plattform und Pflichten des Kunden</h2>
  <h3>2.1 Bestätigung der Unternehmereigenschaft</h3>
  <p>Der Kunde versichert mit Abschluss dieses Vertrages ausdrücklich, dass er ausschließlich zu Zwecken handelt, die seiner gewerblichen oder selbständigen beruflichen Tätigkeit zuzurechnen sind und dass er Unternehmer im Sinne des § 14 BGB ist.</p>
  <h3>2.2 Nutzungsrechte und ihre Grenzen</h3>
  <p>Das eingeräumte Nutzungsrecht berechtigt den Kunden ausschließlich zur bestimmungsgemäßen Verwendung der Plattform für eigene unternehmerische Zwecke. Untersagt sind insbesondere die Weitergabe, Vermietung, Unterlizenzierung oder sonstige entgeltliche oder unentgeltliche Überlassung der Plattform oder einzelner Bestandteile an Dritte.</p>
  <h3>2.3 Zugangsdaten und Account-Sicherheit</h3>
  <p>Der Kunde ist verpflichtet, seine Zugangsdaten geheim zu halten, vor unbefugtem Zugriff Dritter zu schützen und ausschließlich an namentlich autorisierte Mitarbeiter weiterzugeben.</p>
  <h3>2.4 Pflicht zur Datenrichtigkeit</h3>
  <p>Der Kunde stellt sicher, dass alle von ihm in die Plattform eingegebenen Daten – insbesondere Unternehmens-, Bonitäts- und Finanzdaten – wahrheitsgemäß, vollständig und aktuell sind.</p>
</div>

<div class="section">
  <h2>§ 3 Abgrenzung zu erlaubnispflichtigen Geschäften &amp; Risikoaufklärung</h2>
  <h3>3.1 Keine Erlaubnispflicht nach KWG</h3>
  <p>Der Anbieter ist <strong>kein Kreditinstitut</strong> und <strong>kein Finanzdienstleistungsinstitut</strong> im Sinne des Gesetzes über das Kreditwesen (KWG). Eine Erlaubnis der BaFin ist für die hier vertragsgegenständlichen Leistungen weder erforderlich noch beantragt oder erteilt.</p>
  <h3>3.2 Keine Vermittlungstätigkeit nach § 34c GewO</h3>
  <p>Der Anbieter ist <strong>kein Darlehens-, Kredit- oder Finanzierungsvermittler</strong> im Sinne des § 34c Abs. 1 Satz 1 Nr. 2 GewO. Der Anbieter führt keine Kunden an konkrete Finanzinstitute heran und erhält von Banken keine erfolgsabhängige Vermittlungsvergütung.</p>
  <h3>3.3 Kein Vertrieb eigener Kreditkarten</h3>
  <p>FIAON gibt <strong>keine eigenen Kreditkarten</strong> aus und ist nicht Co-Brand-Partner einer kreditkartenausgebenden Institution für die Zwecke dieses Vertrages.</p>
  <h3>3.4 Keine Rechts-, Steuer- oder Anlageberatung</h3>
  <p>Die Leistungen des Anbieters stellen <strong>keine Rechtsdienstleistung</strong>, <strong>keine Steuerberatung</strong> und <strong>keine Anlageberatung</strong> dar. Die bereitgestellten Inhalte ersetzen in keinem Einzelfall die rechtliche, steuerliche oder finanzielle Beratung durch einen entsprechend qualifizierten Berater.</p>
  <h3>3.5 Drittentscheidung der Kreditinstitute</h3>
  <p>Der Kunde nimmt ausdrücklich zur Kenntnis, dass jede Entscheidung über die Gewährung eines Kreditprodukts ausschließlich durch das jeweilige unabhängige Finanzinstitut nach dessen eigenen Kriterien getroffen wird. Diese Entscheidung liegt zu einhundert Prozent (100 %) <strong>außerhalb des Einfluss- und Verantwortungsbereichs des Anbieters</strong>.</p>
  <div class="notice">
    <span class="notice-title">Wesentliche Risikoaufklärung</span>
    Der Anbieter übernimmt <strong>keine Gewährleistung, keine Zusicherung und keine Garantie</strong> dafür, dass dem Kunden infolge der Nutzung der FIAON-Plattform durch ein Drittinstitut eine Kreditkarte oder ein anderweitiges Finanzprodukt ausgestellt oder das im gewählten Setup hinterlegte Wunsch-Limit in Höhe von <strong>{{maximumTargetLimit}}</strong> gewährt wird. Ein wirtschaftlicher Erfolg ist <strong>nicht Vertragsgegenstand</strong>.
  </div>
</div>

<div class="section">
  <h2>§ 4 Vergütung, Zahlungsbedingungen und Verzug</h2>
  <h3>4.1 Vergütungsstruktur</h3>
  <p>Für die in § 1 beschriebenen Leistungen entrichtet der Kunde an den Anbieter folgende Entgelte, sämtliche Beträge verstehen sich als <strong>Nettobeträge in Euro zuzüglich der jeweils gesetzlich geltenden Umsatzsteuer</strong>:</p>
  <table class="price-table">
    <thead>
      <tr>
        <th style="width:55%;">Leistungsposition</th>
        <th style="width:20%;">Abrechnungs-Modus</th>
        <th style="width:25%; text-align:right;">Betrag (netto)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Software-Lizenz- und Plattformnutzungsgebühr für das gewählte Paket <em>{{selectedPackage}}</em></td>
        <td>Monatlich, im Voraus</td>
        <td class="amount">{{monthlyFee}} €</td>
      </tr>
      <tr class="total">
        <td>Erste Abrechnung bei Vertragsschluss<br><span class="small">(Erste Monatsgebühr, zzgl. gesetzlicher USt.)</span></td>
        <td>Sofort fällig</td>
        <td class="amount">{{monthlyFee}} €</td>
      </tr>
    </tbody>
  </table>
  <h3>4.2 Fälligkeit und Zahlungsweise</h3>
  <p>Die monatliche Lizenzgebühr ist jeweils im Voraus zu Beginn eines Abrechnungsmonats fällig. Die Zahlung erfolgt per <strong>{{billingMethod}}</strong> an die E-Mail-Adresse <strong>{{billingEmail}}</strong>.</p>
  <h3>4.3 Verzug</h3>
  <p>Gerät der Kunde mit fälligen Zahlungen in Verzug, ist der Anbieter berechtigt, Verzugszinsen in Höhe von neun (9) Prozentpunkten über dem jeweiligen Basiszinssatz sowie eine Pauschale in Höhe von 40,00 EUR gemäß § 288 Abs. 5 BGB zu verlangen.</p>
</div>

<div class="section">
  <h2>§ 5 Laufzeit, automatische Verlängerung und Kündigung</h2>
  <h3>5.1 Mindestlaufzeit</h3>
  <p>Der Vertrag beginnt mit dem Tag des elektronischen Vertragsschlusses, also dem {{date}}, und wird auf eine feste Mindestlaufzeit von <strong>{{minimumTerm}} Monaten</strong> abgeschlossen.</p>
  <h3>5.2 Automatische Verlängerung</h3>
  <p>Soweit der Vertrag nicht ordentlich gekündigt wird, verlängert er sich nach Ablauf der Mindestlaufzeit automatisch um jeweils weitere zwölf (12) Monate.</p>
  <h3>5.3 Ordentliche Kündigung</h3>
  <p>Die ordentliche Kündigung ist erstmals zum Ablauf der Mindestlaufzeit mit einer Kündigungsfrist von drei (3) Monaten zulässig. Die Kündigung bedarf der Textform gemäß § 126b BGB.</p>
</div>

<div class="section">
  <h2>§ 6 Haftungsbeschränkung</h2>
  <h3>6.1 Unbeschränkte Haftung</h3>
  <p>Der Anbieter haftet dem Kunden unbeschränkt für Schäden, die auf Vorsatz oder grober Fahrlässigkeit des Anbieters beruhen, sowie für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit.</p>
  <h3>6.2 Keine Haftung für Drittentscheidungen</h3>
  <p>Der Anbieter haftet ausdrücklich <strong>nicht</strong> für Entscheidungen von Banken, Kreditkartenherausgebern oder anderen Dritten, insbesondere nicht für die Nichtgewährung oder Ablehnung von Kreditprodukten.</p>
</div>

<div class="section">
  <h2>§ 7 Datenschutz und Vertraulichkeit</h2>
  <p>Der Anbieter verarbeitet personenbezogene Daten ausschließlich nach Maßgabe der DSGVO, des BDSG sowie der weiteren anwendbaren datenschutzrechtlichen Vorschriften. Die Verarbeitung und Speicherung der Kundendaten findet ausschließlich auf Servern innerhalb der Europäischen Union statt.</p>
</div>

<div class="section">
  <h2>§ 8 Schlussbestimmungen</h2>
  <!-- LEGAL REVIEW REQUIRED: Rechtswahl/Gerichtsstand UK Ltd vs. deutsches Recht — Klausel anwaltlich prüfen (LEXR). -->
  <p>Dieser Vertrag unterliegt ausschließlich dem Recht der Bundesrepublik Deutschland. Ausschließlicher Gerichtsstand ist – soweit gesetzlich zulässig – der Sitz der Anbieterin (London, Vereinigtes Königreich). Änderungen und Ergänzungen bedürfen mindestens der Textform gemäß § 126b BGB. Sollten einzelne Bestimmungen unwirksam sein, bleiben die übrigen Bestimmungen hiervon unberührt.</p>
</div>

<div class="signature-block">
  <div class="signature-title">Digitaler Vertragsabschluss</div>
  <div class="signature-sub">Der Kunde hat diesen Vertrag durch elektronische Bestätigung im FIAON-Onboarding-Portal rechtsverbindlich angenommen:</div>
  <table class="signature-table" cellpadding="0" cellspacing="0">
    <tr>
      <td class="signature-cell">
        <div class="sig-col-label">Anbieter</div>
        <div class="sig-static">
          <strong>FIAON LTD</strong><br>
          128 City Road<br>
          London, EC1V 2NX, United Kingdom<br>
          Companies House No. 17318250
        </div>
        <div class="sig-line">Rechtsverbindlich für den Anbieter / Plattform FIAON</div>
        <div class="sig-meta">
          <span class="row"><strong>Vertragsnummer:</strong> {{contractNumber}}</span>
          <span class="row"><strong>Vertragsdatum:</strong> {{date}}</span>
          <span class="row"><strong>Gewähltes Setup:</strong> {{selectedPackage}}</span>
        </div>
      </td>
      <td class="signature-cell">
        <div class="sig-col-label">Kunde</div>
        <div class="sig-static">
          <strong>{{companyName}} {{legalForm}}</strong><br>
          {{address}}<br>
          vertreten durch <strong>{{representativeName}}</strong>
        </div>
        <div class="sig-line">Digitale Annahme durch {{representativeName}}</div>
        <div class="sig-meta">
          <span class="row"><strong>Name:</strong> {{representativeName}}</span>
          <span class="row"><strong>Unternehmen:</strong> {{companyName}}</span>
          <span class="row"><strong>Zeitstempel:</strong> {{date}}</span>
          <span class="row"><strong>Signatur-ID:</strong> {{signatureData}}</span>
        </div>
      </td>
    </tr>
  </table>
</div>

<div class="footer">
  <strong>FIAON LTD</strong> &middot; 128 City Road &middot; London, EC1V 2NX &middot; United Kingdom<br>
  Registered in England and Wales, Companies House No. 17318250 &middot; Director: Justin Schwarzott &middot; Plattform: FIAON<br>
  Dieses Dokument wurde automatisiert generiert und ist auch ohne handschriftliche Unterschrift in Verbindung mit dem digitalen Annahmenachweis rechtsverbindlich.
</div>

</body>
</html>`;

export interface ContractData {
  contractNumber: string;
  date: string;
  companyName: string;
  legalForm: string;
  address: string;
  representativeName: string;
  selectedPackage: string;
  maximumTargetLimit: string;
  monthlyFee: string;
  minimumTerm: string;
  billingMethod: string;
  billingEmail: string;
  signatureData: string;
}

export function generateContract(data: ContractData): string {
  let html = TEMPLATE;
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    html = html.replace(regex, value ?? '');
  }
  return html;
}

export function downloadContract(data: ContractData): void {
  const html = generateContract(data);
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
  }, 500);
}
