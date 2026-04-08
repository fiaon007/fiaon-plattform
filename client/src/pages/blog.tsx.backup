import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Calendar, Clock, ArrowRight, Tag, TrendingUp, Sparkles, Bot, Users, Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GradientText } from "@/components/ui/gradient-text";
import { Link, useLocation } from "wouter";
import { SEOHead } from "@/components/seo-head";

// Blog Post Interface
interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string[];
  author: {
    name: string;
    avatar: string;
    role: string;
  };
  publishedAt: string;
  readTime: string;
  image: string;
  featured: boolean;
}

// Beispiel-Blog-Posts (werden später durch echte Daten ersetzt)
const BLOG_POSTS: BlogPost[] = [
  {
    id: "1",
    slug: "ki-outbound-telefonie-ultimativer-guide-2025",
    title: "KI-Outbound-Telefonie: Der ultimative Guide für 2025",
    excerpt: "Erfahren Sie, wie KI-gestützte Telefonie Ihre B2B-Akquise revolutioniert. Mit 500+ parallelen Anrufen, menschlicher Sprachqualität und DSGVO-Konformität.",
    content: "",
    category: "KI-Telefonie",
    tags: ["KI-Outbound", "Voice AI", "B2B-Vertrieb", "DSGVO"],
    author: {
      name: "ARAS AI Team",
      avatar: "/src/assets/aras_logo_1755067745303.png",
      role: "KI-Experten"
    },
    publishedAt: "2025-12-01",
    readTime: "8 Min.",
    image: "/api/placeholder/1200/600",
    featured: true
  },
  {
    id: "2",
    slug: "intelligente-vertriebsautomatisierung-schweiz",
    title: "Intelligente Vertriebsautomatisierung aus der Schweiz",
    excerpt: "Warum Schweizer KI-Lösungen die DACH-Region erobern. ARAS Core LLM im Vergleich zu internationalen Anbietern.",
    content: "",
    category: "Vertriebsautomatisierung",
    tags: ["Swiss Made", "ARAS Core", "LLM", "Enterprise"],
    author: {
      name: "Dr. Sarah Mueller",
      avatar: "/api/placeholder/100/100",
      role: "CTO"
    },
    publishedAt: "2025-11-28",
    readTime: "6 Min.",
    image: "/api/placeholder/1200/600",
    featured: true
  },
  {
    id: "3",
    slug: "dsgvo-konforme-ki-telefonie",
    title: "DSGVO-konforme KI-Telefonie: So geht's richtig",
    excerpt: "Compliance-Guide für B2B-Telefonakquise mit KI. Rechtssichere Implementierung und Best Practices für den deutschen Markt.",
    content: "",
    category: "Compliance",
    tags: ["DSGVO", "Datenschutz", "Compliance", "Deutschland"],
    author: {
      name: "Maximilian Berg",
      avatar: "/api/placeholder/100/100",
      role: "Legal Advisor"
    },
    publishedAt: "2025-11-25",
    readTime: "10 Min.",
    image: "/api/placeholder/1200/600",
    featured: false
  },
  {
    id: "4",
    slug: "voice-ai-versicherungen",
    title: "Voice AI für Versicherungen: Case Study & ROI",
    excerpt: "340% ROI-Steigerung durch KI-Telefonie. Wie eine Versicherung 120.000 Leads in 3 Monaten qualifizierte.",
    content: "",
    category: "Case Studies",
    tags: ["Versicherungen", "ROI", "Success Story"],
    author: {
      name: "Julia Schmidt",
      avatar: "/api/placeholder/100/100",
      role: "Sales Director"
    },
    publishedAt: "2025-11-20",
    readTime: "7 Min.",
    image: "/api/placeholder/1200/600",
    featured: false
  },
  {
    id: "5",
    slug: "ki-callcenter-vs-human-agents",
    title: "KI-Callcenter vs. Human Agents: Der ehrliche Vergleich",
    excerpt: "Wann lohnt sich KI-Telefonie wirklich? Kosten, Qualität und Performance im direkten Vergleich.",
    content: "",
    category: "Vergleiche",
    tags: ["Callcenter", "Kostenvergleich", "Effizienz"],
    author: {
      name: "Thomas Weber",
      avatar: "/api/placeholder/100/100",
      role: "Operations Lead"
    },
    publishedAt: "2025-11-15",
    readTime: "9 Min.",
    image: "/api/placeholder/1200/600",
    featured: false
  },
  {
    id: "6",
    slug: "voice-ai-banken-fintech",
    title: "Voice AI für Banken & FinTech: Compliance meets Innovation",
    excerpt: "Wie Finanzdienstleister KI-Telefonie rechtssicher einsetzen. Regulierung, Sicherheit und Best Practices.",
    content: "",
    category: "Branchen",
    tags: ["Banking", "FinTech", "Regulierung"],
    author: {
      name: "ARAS AI Team",
      avatar: "/src/assets/aras_logo_1755067745303.png",
      role: "KI-Experten"
    },
    publishedAt: "2025-11-10",
    readTime: "11 Min.",
    image: "/api/placeholder/1200/600",
    featured: false
  }
];

const CATEGORIES = [
  { name: "Alle", icon: <Sparkles className="w-4 h-4" /> },
  { name: "KI-Telefonie", icon: <Phone className="w-4 h-4" /> },
  { name: "Vertriebsautomatisierung", icon: <TrendingUp className="w-4 h-4" /> },
  { name: "Case Studies", icon: <Users className="w-4 h-4" /> },
  { name: "Compliance", icon: <Bot className="w-4 h-4" /> },
];

export default function Blog() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Alle");
  const [filteredPosts, setFilteredPosts] = useState(BLOG_POSTS);

  // Filter posts based on search and category
  useEffect(() => {
    let filtered = BLOG_POSTS;

    if (selectedCategory !== "Alle") {
      filtered = filtered.filter(post => post.category === selectedCategory);
    }

    if (searchQuery) {
      filtered = filtered.filter(post =>
        post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    setFilteredPosts(filtered);
  }, [searchQuery, selectedCategory]);

  const featuredPosts = BLOG_POSTS.filter(post => post.featured);

  return (
    <>
      <SEOHead
        title="Blog: KI-Outbound-Telefonie & Voice AI Insights | ARAS AI"
        description="Expertenwissen zu KI-Telefonie, Vertriebsautomatisierung und Voice AI. Aktuelle Trends, Case Studies und Best Practices aus der DACH-Region."
        keywords="KI-Telefonie Blog, Voice AI Insights, Outbound-Telefonie Trends, B2B Vertrieb KI, DSGVO Voice AI, ARAS AI Blog"
        url="https://platform.aras.ai/blog"
        type="website"
      />
      <div className="min-h-screen" style={{ background: 'linear-gradient(to bottom, #0a0a0a, #1a1a1a)' }}>
        
        {/* Hero Section */}
        <section className="relative py-24 px-4 overflow-hidden">
          {/* Background Gradient */}
          <motion.div
            className="absolute inset-0 opacity-20"
            style={{
              background: 'radial-gradient(circle at 50% 0%, #FE9100 0%, transparent 70%)'
            }}
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.2, 0.3, 0.2]
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />

          <div className="max-w-7xl mx-auto relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="text-center mb-16"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
                className="inline-block mb-6"
              >
                <div
                  className="px-6 py-2 rounded-full border text-sm font-semibold"
                  style={{
                    borderColor: 'rgba(254, 145, 0, 0.3)',
                    background: 'rgba(254, 145, 0, 0.1)',
                    color: '#FE9100'
                  }}
                >
                  ARAS AI BLOG
                </div>
              </motion.div>

              <h1
                className="text-5xl md:text-7xl font-black mb-6"
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                <GradientText>KI-Telefonie Insights</GradientText>
              </h1>
              
              <p className="text-xl md:text-2xl text-white/60 max-w-3xl mx-auto mb-12">
                Expertenwissen zu KI-Outbound-Telefonie, Vertriebsautomatisierung und Voice AI aus der Schweiz
              </p>

              {/* Search Bar */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="max-w-2xl mx-auto"
              >
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/40" />
                  <Input
                    type="text"
                    placeholder="Nach Artikeln, Tags oder Themen suchen..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-12 py-6 text-lg bg-white/5 border-white/10 focus:border-[#FE9100] rounded-2xl"
                    style={{ color: '#e9d7c4' }}
                  />
                </div>
              </motion.div>
            </motion.div>

            {/* Category Filter */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-wrap justify-center gap-3 mb-16"
            >
              {CATEGORIES.map((category, index) => (
                <motion.button
                  key={category.name}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedCategory(category.name)}
                  className="px-6 py-3 rounded-xl border transition-all duration-300 flex items-center gap-2"
                  style={{
                    borderColor: selectedCategory === category.name ? '#FE9100' : 'rgba(255, 255, 255, 0.1)',
                    background: selectedCategory === category.name
                      ? 'linear-gradient(135deg, rgba(254, 145, 0, 0.2), rgba(254, 145, 0, 0.1))'
                      : 'rgba(255, 255, 255, 0.05)',
                    color: selectedCategory === category.name ? '#FE9100' : '#e9d7c4'
                  }}
                >
                  {category.icon}
                  <span className="font-medium">{category.name}</span>
                </motion.button>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Featured Posts */}
        {selectedCategory === "Alle" && featuredPosts.length > 0 && (
          <section className="px-4 pb-16">
            <div className="max-w-7xl mx-auto">
              <motion.h2
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="text-3xl font-black mb-8"
                style={{ fontFamily: 'Orbitron, sans-serif', color: '#e9d7c4' }}
              >
                Featured Articles
              </motion.h2>

              <div className="grid md:grid-cols-2 gap-8">
                {featuredPosts.map((post, index) => (
                  <FeaturedPostCard key={post.id} post={post} index={index} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* All Posts Grid */}
        <section className="px-4 pb-24">
          <div className="max-w-7xl mx-auto">
            <motion.h2
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="text-3xl font-black mb-8"
              style={{ fontFamily: 'Orbitron, sans-serif', color: '#e9d7c4' }}
            >
              {selectedCategory === "Alle" ? "Alle Artikel" : selectedCategory}
            </motion.h2>

            <AnimatePresence mode="wait">
              {filteredPosts.length > 0 ? (
                <motion.div
                  key="posts-grid"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                  {filteredPosts.map((post, index) => (
                    <BlogPostCard key={post.id} post={post} index={index} />
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key="no-results"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="text-center py-20"
                >
                  <div
                    className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(254, 145, 0, 0.1)' }}
                  >
                    <Search className="w-10 h-10" style={{ color: '#FE9100' }} />
                  </div>
                  <h3 className="text-2xl font-bold mb-4" style={{ color: '#e9d7c4' }}>
                    Keine Artikel gefunden
                  </h3>
                  <p className="text-white/60 mb-6">
                    Versuchen Sie es mit anderen Suchbegriffen oder Kategorien
                  </p>
                  <Button
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedCategory("Alle");
                    }}
                    className="bg-[#FE9100] hover:bg-[#FE9100]/80"
                  >
                    Filter zurücksetzen
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* CTA Section */}
        <section className="px-4 pb-24">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="relative rounded-3xl p-12 overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(254, 145, 0, 0.1), rgba(233, 215, 196, 0.05))',
                border: '1px solid rgba(254, 145, 0, 0.2)'
              }}
            >
              <div className="relative z-10 text-center">
                <h2
                  className="text-4xl font-black mb-6"
                  style={{ fontFamily: 'Orbitron, sans-serif', color: '#e9d7c4' }}
                >
                  Bereit für KI-gestützte Telefonie?
                </h2>
                <p className="text-xl text-white/60 mb-8 max-w-2xl mx-auto">
                  Testen Sie ARAS AI 14 Tage kostenlos. 500+ parallele Anrufe, DSGVO-konform, eigenes LLM.
                </p>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Link href="/signup">
                    <Button
                      className="px-8 py-6 text-lg font-bold rounded-xl"
                      style={{
                        background: 'linear-gradient(135deg, #FE9100, #ff6b00)',
                        color: 'white'
                      }}
                    >
                      Kostenlos testen
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </Link>
                  <Link href="/auth">
                    <Button
                      variant="outline"
                      className="px-8 py-6 text-lg font-bold rounded-xl border-white/20 hover:border-[#FE9100]"
                      style={{ color: '#e9d7c4' }}
                    >
                      Zur Demo
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </div>
    </>
  );
}

// Featured Post Card Component
function FeaturedPostCard({ post, index }: { post: BlogPost; index: number }) {
  const [, setLocation] = useLocation();

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
    >
      <Card
        className="group cursor-pointer overflow-hidden border-white/10 bg-white/5 hover:bg-white/10 transition-all duration-500 h-full"
        onClick={() => setLocation(`/blog/${post.slug}`)}
      >
        <div className="relative h-64 overflow-hidden">
          <motion.div
            className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10"
          />
          <motion.img
            src={post.image}
            alt={post.title}
            className="w-full h-full object-cover"
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.6 }}
          />
          <div className="absolute top-4 left-4 z-20">
            <span
              className="px-4 py-2 rounded-full text-xs font-bold"
              style={{
                background: 'rgba(254, 145, 0, 0.9)',
                color: 'white'
              }}
            >
              FEATURED
            </span>
          </div>
        </div>
        
        <CardContent className="p-6">
          <div className="flex items-center gap-4 mb-4 text-sm text-white/50">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {new Date(post.publishedAt).toLocaleDateString('de-DE', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
              })}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {post.readTime}
            </span>
          </div>

          <h3
            className="text-2xl font-bold mb-3 group-hover:text-[#FE9100] transition-colors"
            style={{ fontFamily: 'Orbitron, sans-serif', color: '#e9d7c4' }}
          >
            {post.title}
          </h3>

          <p className="text-white/60 mb-4 line-clamp-2">
            {post.excerpt}
          </p>

          <div className="flex flex-wrap gap-2 mb-4">
            {post.tags.slice(0, 3).map(tag => (
              <span
                key={tag}
                className="px-3 py-1 rounded-full text-xs font-medium"
                style={{
                  background: 'rgba(254, 145, 0, 0.1)',
                  color: '#FE9100',
                  border: '1px solid rgba(254, 145, 0, 0.2)'
                }}
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-white/10">
            <img
              src={post.author.avatar}
              alt={post.author.name}
              className="w-10 h-10 rounded-full"
            />
            <div>
              <div className="font-medium" style={{ color: '#e9d7c4' }}>
                {post.author.name}
              </div>
              <div className="text-sm text-white/50">
                {post.author.role}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Regular Blog Post Card Component
function BlogPostCard({ post, index }: { post: BlogPost; index: number }) {
  const [, setLocation] = useLocation();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.05 }}
    >
      <Card
        className="group cursor-pointer overflow-hidden border-white/10 bg-white/5 hover:bg-white/10 transition-all duration-300 h-full flex flex-col"
        onClick={() => setLocation(`/blog/${post.slug}`)}
      >
        <div className="relative h-48 overflow-hidden">
          <motion.img
            src={post.image}
            alt={post.title}
            className="w-full h-full object-cover"
            whileHover={{ scale: 1.1 }}
            transition={{ duration: 0.4 }}
          />
          <div className="absolute top-3 right-3">
            <span
              className="px-3 py-1 rounded-full text-xs font-bold"
              style={{
                background: 'rgba(10, 10, 10, 0.8)',
                color: '#FE9100',
                border: '1px solid rgba(254, 145, 0, 0.3)'
              }}
            >
              {post.category}
            </span>
          </div>
        </div>

        <CardContent className="p-6 flex-1 flex flex-col">
          <div className="flex items-center gap-3 mb-3 text-xs text-white/50">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(post.publishedAt).toLocaleDateString('de-DE', {
                day: '2-digit',
                month: 'short'
              })}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {post.readTime}
            </span>
          </div>

          <h3
            className="text-lg font-bold mb-2 group-hover:text-[#FE9100] transition-colors line-clamp-2"
            style={{ fontFamily: 'Orbitron, sans-serif', color: '#e9d7c4' }}
          >
            {post.title}
          </h3>

          <p className="text-sm text-white/60 mb-4 line-clamp-3 flex-1">
            {post.excerpt}
          </p>

          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <div className="flex items-center gap-2">
              <img
                src={post.author.avatar}
                alt={post.author.name}
                className="w-8 h-8 rounded-full"
              />
              <span className="text-sm font-medium" style={{ color: '#e9d7c4' }}>
                {post.author.name}
              </span>
            </div>
            <ArrowRight className="w-4 h-4 text-[#FE9100] group-hover:translate-x-1 transition-transform" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
