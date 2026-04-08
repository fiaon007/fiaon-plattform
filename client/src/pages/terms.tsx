import { Card, CardContent } from "@/components/ui/card";
import { GradientText } from "@/components/ui/gradient-text";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function Terms() {
  const sections = [
    {
      title: "1. Vertragsgegenstand - KI-Outbound-Telefonie",
      content: "ARAS AI stellt Ihnen eine cloudbasierte KI-Plattform für automatisierte Outbound-Telefonie und Vertriebsautomatisierung zur Verfügung. Mit unserem eigenen LLM 'ARAS Core' führen wir bis zu 500+ parallele Gespräche in menschlicher Qualität."
    },
    {
      title: "2. Nutzungsumfang B2B-Telefonakquise",
      content: "Die Nutzung der ARAS AI Plattform ist ausschließlich für geschäftliche B2B-Telefonakquise gestattet. Die Anzahl der KI-Anrufe richtet sich nach dem gewählten Paket (Starter: 500, Business: 2.000, Enterprise: unbegrenzt)."
    },
    {
      title: "3. DSGVO-Compliance Garantie",
      content: "ARAS AI garantiert 100% DSGVO-konforme Datenverarbeitung auf Schweizer Servern. Als Auftragsverarbeiter nach Art. 28 DSGVO unterstützen wir Sie bei der rechtssicheren Durchführung Ihrer KI-Telefonie-Kampagnen."
    },
    {
      title: "4. Service Level Agreement (SLA)",
      content: "Wir garantieren eine Verfügbarkeit von 99,9% für die ARAS AI Voice-Plattform. Bei Ausfällen erhalten Sie anteilige Gutschriften. Die KI-Sprachqualität und CRM-Integration werden kontinuierlich optimiert."
    },
    {
      title: "5. Datenschutz & Vertraulichkeit",
      content: "Alle Gesprächsdaten Ihrer KI-Telefonate werden verschlüsselt und vertraulich behandelt. Details entnehmen Sie unserer Datenschutzerklärung. Ihr proprietäres Wissen bleibt durch unser eigenes LLM geschützt."
    },
    {
      title: "6. Kündigung & Preisanpassungen",
      content: "Monatliche Kündigung möglich. Preisanpassungen werden 30 Tage im Voraus angekündigt. Bei jährlicher Zahlung erhalten Sie 20% Rabatt auf alle KI-Telefonie-Pakete."
    }
  ];

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-8">
              {/* Header */}
              <div className="mb-8">
                <Link href="/signup">
                  <Button
                    variant="ghost"
                    className="p-0 h-auto text-muted-foreground hover:text-primary mb-6"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to signup
                  </Button>
                </Link>
                
                <h1 className="text-3xl font-orbitron font-bold mb-4">
                  <GradientText>Allgemeine Geschäftsbedingungen</GradientText>
                </h1>
                <p className="text-muted-foreground">
                  AGB für die ARAS AI KI-Telefonie-Plattform | Stand: Januar 2025
                </p>
              </div>

              {/* Terms Content */}
              <div className="space-y-8">
                {sections.map((section, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    className="space-y-4"
                  >
                    <h2 className="text-xl font-orbitron font-semibold text-primary">
                      {section.title}
                    </h2>
                    <p className="text-muted-foreground leading-relaxed">
                      {section.content}
                    </p>
                  </motion.div>
                ))}
              </div>

              {/* Contact Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.8 }}
                className="mt-12 pt-8 border-t border-border/50"
              >
                <h2 className="text-xl font-orbitron font-semibold text-primary mb-4">
                  Vertragspartner & Kontakt
                </h2>
                <p className="text-muted-foreground">
                  Für Fragen zu unseren B2B-Vertriebsautomatisierungs-Services:
                </p>
                <div className="mt-4 space-y-2 text-sm">
                  <p className="text-muted-foreground">Firma: Schwarzott Capital Partners AG</p>
                  <p className="text-muted-foreground">E-Mail: legal@aras-plattform.ai</p>
                  <p className="text-muted-foreground">Telefon: +41 43 344 6087</p>
                  <p className="text-muted-foreground">Adresse: Löwenstrasse 20, 8001 Zürich, Schweiz</p>
                  <p className="text-muted-foreground">Handelsregister: CHE-123.456.789</p>
                </div>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}