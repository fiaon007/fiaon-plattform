// ═══════════════════════════════════════════════════════════════════════════
// Inhalte für das Onboarding-Gate & den Agentenvertrag.
//
// - ONBOARDING_DOCS: die drei Zustimmungs-Blöcke (Prompt 1 A). Jede Änderung am
//   Text MUSS mit einer erhöhten `version` einhergehen → erzwingt neue Zustimmung.
// - DEFAULT_CONTRACT_HTML: Standard-Vertragsvorlage v1 (Prompt 2 B), EN, langform,
//   mit [[PLATZHALTERN]] und dem Marker [[SIGNATURE_PANEL]] (wird serverseitig
//   durch das Signatur-Panel ersetzt).
// ═══════════════════════════════════════════════════════════════════════════

export interface OnboardingDoc {
  key: string;
  version: number;
  title: string;
  summary: string;
  html: string;
}

export const ONBOARDING_DOCS: OnboardingDoc[] = [
  {
    key: "datenschutz",
    version: 1,
    title: "Datenschutz & Vertraulichkeit",
    summary: "Du verarbeitest echte Kundendaten — ausschließlich über die Plattform, streng vertraulich.",
    html: `
      <p>Als FIAON-Agent verarbeitest du <strong>echte, personenbezogene Kundendaten</strong>. Mit deiner Bestätigung verpflichtest du dich zu Folgendem:</p>
      <ul>
        <li><strong>Verschwiegenheit:</strong> Du behandelst alle Kunden- und Geschäftsdaten streng vertraulich — während und nach deiner Tätigkeit für FIAON.</li>
        <li><strong>Keine Weitergabe:</strong> Du gibst Kundendaten niemals an Dritte weiter und nutzt sie ausschließlich zur Erfüllung deiner Aufgaben für FIAON.</li>
        <li><strong>Keine Speicherung außerhalb des Systems:</strong> Du speicherst, kopierst, exportierst oder fotografierst keine Kundendaten außerhalb der FIAON-Plattform (kein Export in eigene Tabellen, Notiz-Apps, Messenger o. Ä.).</li>
        <li><strong>DSGVO/GDPR:</strong> Du hältst die geltenden Datenschutzgesetze ein und meldest jeden Verdacht auf Datenverlust unverzüglich dem Betreiber.</li>
        <li><strong>Rückgabe/Löschung:</strong> Bei Beendigung der Tätigkeit endet dein Zugriff; du löschst etwaige lokale Spuren.</li>
      </ul>
    `,
  },
  {
    key: "verhalten",
    version: 1,
    title: "Seriosität, Verhalten & Compliance",
    summary: "Seriöser Umgang, keine falschen Zusagen. FIAON ist Bildung & Software — keine Finanzberatung.",
    html: `
      <p>FIAON ist ein Anbieter von <strong>Bildung und Software</strong> (SaaS/E-Learning) — <strong>kein</strong> Finanzdienstleister und <strong>keine</strong> Kreditvermittlung. Mit deiner Bestätigung verpflichtest du dich:</p>
      <ul>
        <li><strong>Seriöser Umgang:</strong> Du trittst professionell, ehrlich und respektvoll auf.</li>
        <li><strong>Keine falschen Zusagen:</strong> Du machst keine irreführenden, falschen oder übertriebenen Aussagen.</li>
        <li><strong>Keine regulierte Finanzberatung:</strong> Du erteilst keine Finanz-, Kredit- oder Anlageberatung.</li>
        <li><strong>Keine Kreditversprechen am Telefon:</strong> Du versprichst, garantierst oder implizierst niemals die Gewährung, Höhe oder Konditionen eines Kredits, einer Kreditlinie oder Kreditkarte.</li>
        <li><strong>Nur genehmigte Materialien:</strong> Du gehst nicht über die freigegebenen Skripte/Materialien hinaus und stellst FIAON ausschließlich als Bildungs-/Software-Anbieter dar.</li>
      </ul>
    `,
  },
  {
    key: "nutzung",
    version: 1,
    title: "Nutzungsbedingungen der Plattform",
    summary: "Regeln für die Nutzung des Agent-Portals und der bereitgestellten Werkzeuge.",
    html: `
      <p>Für die Nutzung der FIAON-Plattform gelten folgende Bedingungen:</p>
      <ul>
        <li><strong>Ausschließliche Nutzung:</strong> Du dokumentierst alle Kundenkontakte, Notizen und Ergebnisse ausschließlich in der Plattform.</li>
        <li><strong>Zugangsdaten:</strong> Du hältst deine Zugangsdaten geheim und gibst deinen Account nicht weiter.</li>
        <li><strong>Korrekte Dokumentation:</strong> Du führst wahrheitsgemäße und vollständige Aufzeichnungen.</li>
        <li><strong>Zulässige Nutzung:</strong> Du nutzt die Plattform und Leads nur für deine Tätigkeit für FIAON und nicht für Wettbewerber oder eigene Zwecke.</li>
        <li><strong>Geistiges Eigentum:</strong> Marke, Materialien und Daten bleiben Eigentum von FIAON; du erhältst nur ein Nutzungsrecht für die Dauer der Tätigkeit.</li>
      </ul>
    `,
  },
];

// ── Standard-Vertragsvorlage (EN) — deckt Prompt 2 B ab ──────────────────────
export const DEFAULT_CONTRACT_HTML = `
<p class="muted">FIAON LTD · Company No. 17318250 · London, United Kingdom</p>
<p><strong>(Independent Sales Agency — Non-Employment)</strong></p>
<p>THIS AGREEMENT is made on <strong>[[EFFECTIVE_DATE]]</strong> (the &ldquo;Effective Date&rdquo;)</p>
<p><strong>BETWEEN:</strong></p>
<p>(1)&nbsp;&nbsp;FIAON LTD, a private limited company incorporated in England and Wales under company number 17318250, whose registered office is at 128 City Road, London, EC1V 2NX, United Kingdom (the &ldquo;Principal&rdquo; or &ldquo;FIAON&rdquo;); and</p>
<p>(2)&nbsp;&nbsp;<strong>[[AGENT_LEGAL_NAME]]</strong>, [[AGENT_TYPE]], of [[AGENT_ADDRESS]][[COMPANY_BLOCK]] (the &ldquo;Agent&rdquo;).</p>
<p>The Principal and the Agent are together referred to as the &ldquo;Parties&rdquo; and each as a &ldquo;Party&rdquo;.</p>

<h2>Background</h2>
<p class="clause">(A) The Principal operates a software-as-a-service and e-learning platform providing financial-education and credit-building knowledge, tools and subscriptions to private and business customers (the &ldquo;Products&rdquo;). The Principal is a provider of education and software only; it is not a bank, is not a provider of regulated financial services, and does not carry on the business of credit brokerage, credit intermediation or the giving of regulated financial advice.</p>
<p class="clause">(B) The Principal wishes to appoint the Agent as a self-employed, independent commercial agent to promote and solicit orders for the Products, and the Agent wishes to accept such appointment, on the terms and conditions set out in this Agreement.</p>
<p class="clause">(C) The Parties intend that the Agent shall at all times act as an independent contractor and not as an employee, worker, partner or joint venturer of the Principal.</p>

<h2>1. Definitions and Interpretation</h2>
<p class="clause">1.1 In this Agreement, unless the context otherwise requires, the following definitions apply:</p>
<p class="clause">(a) &ldquo;Business Day&rdquo; means a day other than a Saturday, Sunday or public holiday in England when banks in London are open for business;</p>
<p class="clause">(b) &ldquo;Commission&rdquo; means the commission payable to the Agent in accordance with Clause 6;</p>
<p class="clause">(c) &ldquo;Customer&rdquo; means any person to whom the Products are promoted, sold or supplied through the Principal&rsquo;s platform;</p>
<p class="clause">(d) &ldquo;Customer Data&rdquo; means any personal data or business information relating to Customers or prospective Customers processed in connection with this Agreement;</p>
<p class="clause">(e) &ldquo;Platform&rdquo; means the Principal&rsquo;s software systems, agent portal, customer records, scripts and tools made available to the Agent;</p>
<p class="clause">(f) &ldquo;Qualifying Sale&rdquo; means a sale of a Product that has been paid in full by the Customer and in respect of which the Agent has a valid Commission entitlement under Clause 6;</p>
<p class="clause">(g) &ldquo;Commission Commencement Date&rdquo; means 15 July 2026, being the date from which the Commission model set out in Clause 6 applies.</p>
<p class="clause">1.2 Clause headings are for convenience only and do not affect interpretation. Words importing the singular include the plural and vice versa. A reference to a statute or statutory provision is a reference to it as amended, extended or re-enacted from time to time.</p>

<h2>2. Appointment and Independent Status</h2>
<p class="clause">2.1 The Principal appoints the Agent, and the Agent agrees to act, as the Principal&rsquo;s self-employed commercial agent for the purpose of [[ACTIVITY]] from Customers, on a non-exclusive basis, with effect from [[START_DATE]].</p>
<p class="clause">2.2 The Agent is an independent contractor. Nothing in this Agreement shall be construed as creating a relationship of employer and employee, principal and worker, partnership, or joint venture between the Parties. The Agent is not entitled to any employment rights, paid leave, sick pay, pension contributions or other employee benefits from the Principal.</p>
<p class="clause">2.3 The Agent shall have full discretion as to the time, place, manner and organisation of its work. The Principal shall not impose fixed working hours, minimum attendance, breaks or shift patterns upon the Agent, and any targets, guidance or scripts provided are for quality and compliance purposes only and do not constitute a right of direction over the manner in which the Agent organises its activity.</p>
<p class="clause">2.4 The Agent shall provide its own working equipment and bear its own costs and expenses, save for the Platform access, leads and materials expressly provided by the Principal under this Agreement.</p>
<p class="clause">2.5 The Agent may work for other principals and carry on other business activities, provided that it does not act for a competitor of the Principal in relation to the Products and does not act in a manner that conflicts with its obligations under this Agreement.</p>
<p class="clause">2.6 The Agent is solely responsible for its own taxes, social-security contributions, business registrations and, where applicable, value-added-tax obligations, and shall indemnify the Principal against any claim, assessment or demand arising from the Agent&rsquo;s failure to account for the same.</p>

<h2>3. Authority and Restrictions</h2>
<p class="clause">3.1 The Agent is authorised to promote the Products and to solicit and transmit orders from Customers to the Principal. The Agent has no authority to conclude contracts in the name of the Principal, to accept payment on the Principal&rsquo;s behalf, to grant discounts, or to make any representation, warranty or commitment binding on the Principal, except as expressly authorised in writing.</p>
<p class="clause">3.2 The Agent shall not make, and shall not permit any statement to be made, that goes beyond the approved materials supplied by the Principal. In particular, and for the avoidance of doubt, the Agent shall not: (i) provide regulated financial, credit or investment advice; (ii) promise, guarantee or imply the grant, approval, amount or terms of any loan, credit line or credit card; or (iii) describe the Products as anything other than education, knowledge, software and related subscriptions.</p>
<p class="clause">3.3 The Agent shall comply with all reasonable instructions of the Principal relating to compliance, data protection, and the approved scripts, it being acknowledged that such instructions concern the content and legality of communications and not the manner in which the Agent organises its independent activity.</p>

<h2>4. Obligations of the Agent</h2>
<p class="clause">4.1 The Agent shall act dutifully and in good faith and shall use reasonable endeavours to promote the sale of the Products and to protect the legitimate interests of the Principal.</p>
<p class="clause">4.2 The Agent shall: (a) use only the Platform to record all Customer contacts, notes, results and outcomes; (b) keep accurate and truthful records; (c) comply with the Principal&rsquo;s compliance rules and approved scripts; (d) protect the confidentiality and security of Customer Data at all times; and (e) promptly communicate to the Principal all relevant information relating to Customers and the market.</p>
<p class="clause">4.3 The Agent shall not store, copy, export or process Customer Data outside the Platform, and shall not disclose Customer Data to any third party.</p>
<p class="clause">4.4 The Agent shall not offer, promise, give, solicit or accept any bribe or improper payment, and shall comply with all applicable anti-bribery and anti-corruption laws, including the Bribery Act 2010.</p>

<h2>5. Obligations of the Principal</h2>
<p class="clause">5.1 The Principal shall: (a) provide the Agent with access to the Platform, leads and approved marketing materials reasonably required to perform its activity; (b) make available current information on the Products, prices and packages; (c) inform the Agent within a reasonable time of its acceptance, refusal or non-execution of any order transmitted by the Agent; and (d) calculate and pay Commission in accordance with this Agreement.</p>
<p class="clause">5.2 The Principal shall act dutifully and in good faith towards the Agent.</p>

<h2>6. Commission</h2>
<p class="clause">6.1 Subject to this Clause 6, the Principal shall pay the Agent Commission at the rate of <strong>[[COMMISSION_RATE]] %</strong> of the net paid value of each Qualifying Sale attributable to the Agent.</p>
<p class="clause">6.2 With effect from the Commission Commencement Date (15 July 2026), Commission is earned only where the Agent has actively and demonstrably serviced the Customer (including at least one documented contact recorded on the Platform) and that servicing has led to a Qualifying Sale. For the avoidance of doubt, no Commission is payable in respect of a Customer who pays without any documented involvement of the Agent (a &ldquo;direct payer&rdquo;), notwithstanding that a lead may have been allocated to the Agent.</p>
<p class="clause">6.3 Commission arrangements applicable to sales completed before the Commission Commencement Date are not affected by Clause 6.2 and shall be honoured on the basis applicable at the relevant time. This Agreement does not operate retrospectively to reduce or claw back Commission already validly earned and paid.</p>
<p class="clause">6.4 Commission becomes due when, and to the extent that, the Customer has paid the Principal in full for the relevant Product.</p>
<p class="clause">6.5 Where a Customer subsequently obtains a refund, reverses a payment, or a chargeback occurs, any Commission paid or accrued in respect of that sale shall be reversed (&ldquo;clawback&rdquo;). The Principal may deduct clawback amounts from future Commission or, where no sufficient future Commission exists, the Agent shall repay the amount within fourteen (14) days of demand.</p>
<p class="clause">6.6 Commission is paid [[PAYOUT_TERMS]]. Each payment is accompanied by a commission statement issued in accordance with Clause 7.</p>

<h2>7. Payment, Commission Statements and Taxes</h2>
<p class="clause">7.1 The Principal shall issue to the Agent a written commission statement for each payment period, setting out the Qualifying Sales, the applicable rate, the Commission due, any clawbacks or adjustments, the net amount payable, and the date and method of payment. Where the Agent is a business with a valid VAT identification number, the Parties may agree that such statements are issued under a self-billing arrangement.</p>
<p class="clause">7.2 All amounts stated are exclusive of value added tax (VAT) or equivalent, which shall be handled in accordance with the applicable law and the Agent&rsquo;s status. Where the reverse-charge mechanism applies, the commission statement shall bear the appropriate note (&ldquo;reverse charge / Steuerschuldnerschaft des Leistungsempf&auml;ngers&rdquo;). The exact tax treatment shall be confirmed by the Agent with its own tax adviser.</p>
<p class="clause">7.3 The Agent is responsible for accounting for its own income tax, social contributions and, where applicable, VAT.</p>

<h2>8. Data Protection and Confidentiality</h2>
<p class="clause">8.1 In processing Customer Data, the Agent acts on behalf of and under the instructions of the Principal, and shall comply with the UK GDPR, the EU General Data Protection Regulation and all other applicable data-protection laws. The Agent shall process Customer Data only through the Platform, only for the purposes of this Agreement, and only to the extent necessary.</p>
<p class="clause">8.2 The Agent shall implement appropriate technical and organisational measures to protect Customer Data, shall not transfer it outside the Platform, and shall not disclose it to any third party. The Agent shall assist the Principal in complying with data-subject rights and shall notify the Principal without undue delay of any personal-data breach of which it becomes aware.</p>
<p class="clause">8.3 The Agent shall keep confidential all non-public information of the Principal, including Customer Data, pricing, business methods and the Platform, both during the term and after termination of this Agreement, and shall return or delete all such information upon termination.</p>

<h2>9. Compliance and Conduct</h2>
<p class="clause">9.1 The Agent shall conduct all activity honestly, professionally and in accordance with the Principal&rsquo;s compliance rules. The Agent shall not make misleading, false or exaggerated statements, and shall at all times present the Principal as a provider of education and software and not as a financial-services or credit provider.</p>
<p class="clause">9.2 The Agent shall comply with all applicable laws in the conduct of its activity, including consumer-protection, marketing, data-protection and anti-bribery laws.</p>

<h2>10. Intellectual Property</h2>
<p class="clause">10.1 All intellectual property rights in the Products, the Platform, the FIAON name and brand, marketing materials, and Customer Data are and remain the exclusive property of the Principal. The Agent is granted a non-exclusive, non-transferable, revocable licence to use such materials solely for the performance of this Agreement and only during its term.</p>
<p class="clause">10.2 The Agent shall acquire no rights in the Principal&rsquo;s intellectual property and shall not register, use or contest any confusingly similar name or mark.</p>

<h2>11. Term and Termination</h2>
<p class="clause">11.1 This Agreement commences on the Effective Date and continues until terminated by either Party giving not less than [[NOTICE_PERIOD]] written notice to the other, such notice period to comply with any applicable statutory minimum.</p>
<p class="clause">11.2 Either Party may terminate this Agreement immediately by written notice if the other Party commits a material breach that is not remedied within fourteen (14) days of written notice, becomes insolvent, or ceases to carry on business.</p>
<p class="clause">11.3 On termination, the Agent shall immediately cease to use the Platform and the Principal&rsquo;s materials, return or delete all Confidential Information and Customer Data, and the licence granted under Clause 10 shall terminate.</p>

<h2>12. Termination Indemnity or Compensation</h2>
<p class="clause">12.1 The Parties acknowledge that, depending on the governing law chosen in Clause 15 and on the nature of the Agent&rsquo;s activity, the Agent may be entitled on termination to a goodwill indemnity or to compensation under mandatory commercial-agency law (including Council Directive 86/653/EEC as implemented, and, where English law applies, the Commercial Agents (Council Directive) Regulations 1993).</p>
<p class="clause">12.2 Nothing in this Agreement excludes or limits any such mandatory entitlement where it applies. The Parties agree that any indemnity or compensation shall be determined in accordance with, and subject to the conditions and limits of, the applicable mandatory law.</p>

<h2>13. Post-Termination Non-Solicitation</h2>
<p class="clause">13.1 For a period of twelve (12) months following termination, the Agent shall not, directly or indirectly, solicit or entice away any Customer or lead of the Principal with whom the Agent dealt during the term, for the purpose of offering competing products. This restriction is limited to what is reasonably necessary to protect the Principal&rsquo;s legitimate business interests and does not constitute a general non-compete obligation.</p>

<h2>14. Liability and Indemnity</h2>
<p class="clause">14.1 The Agent shall indemnify the Principal against any loss, damage, claim or liability arising from the Agent&rsquo;s breach of this Agreement, its misrepresentations to Customers, its breach of data-protection or compliance obligations, or its failure to account for its own taxes.</p>
<p class="clause">14.2 Neither Party excludes or limits liability for death or personal injury caused by negligence, for fraud, or for any liability that cannot lawfully be excluded.</p>

<h2>15. Governing Law and Jurisdiction</h2>
<p class="clause">15.1 This Agreement and any dispute arising out of or in connection with it are governed by [[GOVERNING_LAW]], and the Parties submit to the exclusive jurisdiction of the courts of [[JURISDICTION]], without prejudice to any mandatory protection available to the Agent under applicable commercial-agency law.</p>

<h2>16. Miscellaneous</h2>
<p class="clause">16.1 Entire Agreement. This Agreement constitutes the entire agreement between the Parties and supersedes all prior arrangements, whether written or oral, relating to its subject matter.</p>
<p class="clause">16.2 Variation. No variation of this Agreement is effective unless made in writing and signed by both Parties.</p>
<p class="clause">16.3 Severability. If any provision is held to be invalid or unenforceable, the remaining provisions continue in full force, and the invalid provision shall be replaced by a valid provision that most closely reflects the Parties&rsquo; intention.</p>
<p class="clause">16.4 Assignment. The Agent may not assign or sub-contract this Agreement without the Principal&rsquo;s prior written consent.</p>
<p class="clause">16.5 Notices. Notices must be in writing and sent to the Parties&rsquo; registered or notified addresses or email addresses.</p>
<p class="clause">16.6 Electronic Signature and Counterparts. This Agreement may be executed by electronic signature and in any number of counterparts, each of which is an original and all of which together constitute one and the same instrument. The Parties agree that an electronic signature captured through the Principal&rsquo;s Platform, together with the associated timestamp, IP address and document hash, constitutes a valid and binding execution of this Agreement.</p>

<h2>Executed by the Parties</h2>
[[SIGNATURE_PANEL]]
`;
