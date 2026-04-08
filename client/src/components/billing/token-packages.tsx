import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GlowButton } from "@/components/ui/glow-button";
import { GradientText } from "@/components/ui/gradient-text";
import { motion } from "framer-motion";

export function TokenPackages() {
  const packages = [
    {
      id: "100",
      tokens: 100,
      price: 19,
    },
    {
      id: "500",
      tokens: 500,
      price: 79,
    },
    {
      id: "2000",
      tokens: 2000,
      price: 299,
    },
  ];

  const handlePurchase = (tokenCount: number) => {
    window.location.href = `/checkout?tokens=${tokenCount}`;
  };

  return (
    <div>
      <h2 className="text-2xl font-orbitron font-bold mb-6">
        <GradientText>Additional Tokens</GradientText>
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {packages.map((pkg, index) => (
          <motion.div
            key={pkg.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {pkg.tokens.toLocaleString()} Tokens
                </CardTitle>
                <div className="text-2xl font-bold">${pkg.price}</div>
              </CardHeader>
              <CardContent>
                <GlowButton
                  onClick={() => handlePurchase(pkg.tokens)}
                  className="w-full"
                >
                  Purchase
                </GlowButton>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
