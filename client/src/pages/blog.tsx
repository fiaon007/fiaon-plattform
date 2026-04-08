import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Calendar, Clock, ArrowRight, Tag, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
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

// Blog Posts Data
const BLOG_POSTS: BlogPost[] = [
  {
    id: "1",
    slug: "ki-outbound-telefonie-ultimativer-guide-2025",
    title: "KI-Outbound-Telefonie: Der ultimative Guide für 2025",
    excerpt: "Erfahren Sie, wie KI-gestützte Telefonie Ihre B2B-Akquise revolutioniert. Mit 500+ parallelen Anrufen, menschlicher Sprachqualität und DSGVO-Konformität.",
    content: "",
    category: "KI-Telefonie",
    tags: ["KI-Outbound", "Voice AI", "B2B-Vertrieb", "DSGVO", "ARAS Core", "Outbound-Telefonie", "KI-Telefonie", "Vertriebsautomatisierung"],
    author: {
      name: "ARAS AI Team",
      avatar: "/src/assets/aras_logo_1755067745303.png",
      role: "KI-Experten"
    },
    publishedAt: "2025-12-08",
    readTime: "15 Min.",
    image: "/api/placeholder/1200/600",
    featured: true
  }
];

const CATEGORIES = ["Alle", "KI-Telefonie", "Voice AI", "DSGVO", "B2B-Vertrieb", "Automatisierung"];

export default function Blog() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Alle");
  const [typedText, setTypedText] = useState("");
  const fullText = "von morgen";

  // Typewriter Effect
  useEffect(() => {
    if (typedText.length < fullText.length) {
      const timeout = setTimeout(() => {
        setTypedText(fullText.slice(0, typedText.length + 1));
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [typedText]);

  // Filter Posts
  const filteredPosts = useMemo(() => {
    return BLOG_POSTS.filter(post => {
      const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           post.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           post.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = selectedCategory === "Alle" || post.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  const featuredPost = filteredPosts.find(post => post.featured);
  const regularPosts = filteredPosts.filter(post => !post.featured);

  return (
    <>
      <SEOHead
        title="ARAS AI Blog - KI-Telefonie, Voice AI & B2B-Automatisierung"
        description="Entdecke alles über KI-Telefonie, DSGVO-konforme Automatisierung und Voice AI. Expertenwissen für moderne B2B-Akquise."
        url="https://platform.aras.ai/blog"
        image="https://platform.aras.ai/og-blog.jpg"
      />

      <div className="min-h-screen bg-white">
        {/* Hero Section */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden bg-gradient-to-br from-white via-orange-50/30 to-white pt-24 pb-16 px-6"
        >
          <div className="max-w-6xl mx-auto text-center">
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6" style={{ fontFamily: 'Orbitron, sans-serif', color: '#121212' }}>
                Wissen ist die Stimme{" "}
                <span className="relative inline-block">
                  <span style={{ color: '#FE9100' }}>{typedText}</span>
                  <motion.span
                    animate={{ opacity: [1, 0] }}
                    transition={{ repeat: Infinity, duration: 0.8 }}
                    className="inline-block w-0.5 h-12 bg-orange-500 ml-1"
                  />
                </span>
              </h1>
            </motion.div>

            <motion.p
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="text-xl md:text-2xl text-gray-600 mb-12 max-w-3xl mx-auto"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              Entdecke alles über KI-Telefonie, DSGVO & Automatisierung
            </motion.p>

            {/* Search Bar */}
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.6 }}
              className="max-w-2xl mx-auto relative"
            >
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 group-focus-within:text-orange-500 transition-colors" />
                <Input
                  type="text"
                  placeholder="Durchsuche Artikel, Tags, Themen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 pr-4 py-6 text-lg border-2 border-gray-200 rounded-2xl focus:border-orange-500 focus:ring-4 focus:ring-orange-100 transition-all duration-300 shadow-sm hover:shadow-md"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                />
              </div>
            </motion.div>
          </div>

          {/* Decorative Elements */}
          <motion.div
            animate={{
              rotate: [0, 360],
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute -top-20 -right-20 w-96 h-96 bg-gradient-to-br from-orange-200/20 to-transparent rounded-full blur-3xl"
          />
          <motion.div
            animate={{
              rotate: [360, 0],
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute -bottom-20 -left-20 w-96 h-96 bg-gradient-to-tr from-orange-200/20 to-transparent rounded-full blur-3xl"
          />
        </motion.section>

        {/* Category Filter */}
        <section className="py-8 px-6 border-b border-gray-100">
          <div className="max-w-6xl mx-auto">
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {CATEGORIES.map((category, index) => (
                <motion.button
                  key={category}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index }}
                  onClick={() => setSelectedCategory(category)}
                  className={`
                    px-6 py-2.5 rounded-full font-medium whitespace-nowrap transition-all duration-300
                    ${selectedCategory === category
                      ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }
                  `}
                  style={{ fontFamily: 'Inter, sans-serif' }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {category}
                </motion.button>
              ))}
            </div>
          </div>
        </section>

        {/* Featured Article */}
        {featuredPost && (
          <section className="py-16 px-6">
            <div className="max-w-6xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.7 }}
                className="mb-8"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5 text-orange-500" />
                  <span className="text-sm font-semibold text-orange-500 tracking-wide uppercase" style={{ fontFamily: 'Inter, sans-serif' }}>
                    Featured Article
                  </span>
                </div>
              </motion.div>

              <Link href={`/blog/${featuredPost.slug}`}>
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.7 }}
                  whileHover={{ y: -8 }}
                  className="group cursor-pointer"
                >
                  <Card className="overflow-hidden border-2 border-gray-100 hover:border-orange-200 transition-all duration-500 shadow-xl hover:shadow-2xl rounded-3xl">
                    <div className="grid md:grid-cols-2 gap-0">
                      {/* Image */}
                      <div className="relative h-64 md:h-auto overflow-hidden bg-gradient-to-br from-orange-100 to-orange-50">
                        <motion.div
                          whileHover={{ scale: 1.1 }}
                          transition={{ duration: 0.6 }}
                          className="w-full h-full flex items-center justify-center"
                        >
                          <div className="text-center p-8">
                            <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center">
                              <Sparkles className="w-12 h-12 text-white" />
                            </div>
                            <p className="text-orange-600 font-semibold" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                              FEATURED
                            </p>
                          </div>
                        </motion.div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      </div>

                      {/* Content */}
                      <CardContent className="p-8 md:p-10 flex flex-col justify-center">
                        <div className="flex items-center gap-3 mb-4">
                          <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>
                            {featuredPost.category}
                          </span>
                          <div className="flex items-center gap-2 text-gray-500 text-sm">
                            <Clock className="w-4 h-4" />
                            <span>{featuredPost.readTime}</span>
                          </div>
                        </div>

                        <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900 group-hover:text-orange-600 transition-colors duration-300" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                          {featuredPost.title}
                        </h2>

                        <p className="text-gray-600 mb-6 text-lg leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                          {featuredPost.excerpt}
                        </p>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold">
                              A
                            </div>
                            <div>
                              <p className="font-medium text-gray-900" style={{ fontFamily: 'Inter, sans-serif' }}>{featuredPost.author.name}</p>
                              <p className="text-sm text-gray-500">{featuredPost.author.role}</p>
                            </div>
                          </div>

                          <motion.div
                            whileHover={{ x: 5 }}
                            className="flex items-center gap-2 text-orange-500 font-semibold"
                          >
                            <span>Weiterlesen</span>
                            <ArrowRight className="w-5 h-5" />
                          </motion.div>
                        </div>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-2 mt-6">
                          {featuredPost.tags.slice(0, 4).map((tag) => (
                            <span
                              key={tag}
                              className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-orange-50 hover:text-orange-600 transition-colors cursor-pointer"
                              style={{ fontFamily: 'Inter, sans-serif' }}
                            >
                              # {tag}
                            </span>
                          ))}
                        </div>
                      </CardContent>
                    </div>
                  </Card>
                </motion.div>
              </Link>
            </div>
          </section>
        )}

        {/* Regular Posts Grid */}
        {regularPosts.length > 0 && (
          <section className="py-16 px-6 bg-gray-50">
            <div className="max-w-6xl mx-auto">
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-3xl md:text-4xl font-bold mb-12 text-gray-900"
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                Weitere Artikel
              </motion.h2>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                <AnimatePresence>
                  {regularPosts.map((post, index) => (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0, y: 40 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 40 }}
                      transition={{ delay: index * 0.1, duration: 0.5 }}
                      whileHover={{ y: -8 }}
                    >
                      <Link href={`/blog/${post.slug}`}>
                        <Card className="h-full overflow-hidden border-2 border-gray-100 hover:border-orange-200 transition-all duration-500 shadow-lg hover:shadow-2xl rounded-2xl cursor-pointer group">
                          {/* Image Placeholder */}
                          <div className="relative h-48 bg-gradient-to-br from-orange-100 to-orange-50 overflow-hidden">
                            <motion.div
                              whileHover={{ scale: 1.1 }}
                              transition={{ duration: 0.6 }}
                              className="w-full h-full flex items-center justify-center"
                            >
                              <Tag className="w-16 h-16 text-orange-400" />
                            </motion.div>
                            <div className="absolute top-4 left-4">
                              <span className="px-3 py-1 bg-white/90 backdrop-blur-sm text-orange-700 rounded-full text-xs font-semibold shadow-sm">
                                {post.category}
                              </span>
                            </div>
                          </div>

                          <CardContent className="p-6">
                            <div className="flex items-center gap-2 text-gray-500 text-sm mb-3">
                              <Calendar className="w-4 h-4" />
                              <span>{new Date(post.publishedAt).toLocaleDateString('de-DE')}</span>
                              <span className="mx-1">•</span>
                              <Clock className="w-4 h-4" />
                              <span>{post.readTime}</span>
                            </div>

                            <h3 className="text-xl font-bold mb-3 text-gray-900 group-hover:text-orange-600 transition-colors line-clamp-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                              {post.title}
                            </h3>

                            <p className="text-gray-600 mb-4 line-clamp-3 text-sm leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                              {post.excerpt}
                            </p>

                            <motion.div
                              whileHover={{ x: 5 }}
                              className="flex items-center gap-2 text-orange-500 font-semibold text-sm"
                            >
                              <span>Artikel lesen</span>
                              <ArrowRight className="w-4 h-4" />
                            </motion.div>
                          </CardContent>
                        </Card>
                      </Link>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </section>
        )}

        {/* No Results */}
        {filteredPosts.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-24 text-center"
          >
            <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              Keine Artikel gefunden
            </h3>
            <p className="text-gray-600" style={{ fontFamily: 'Inter, sans-serif' }}>
              Versuche es mit anderen Suchbegriffen oder Kategorien
            </p>
          </motion.div>
        )}

        {/* Sticky CTA Footer */}
        <motion.section
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.7 }}
          className="bg-gradient-to-r from-gray-900 via-black to-gray-900 text-white py-16 px-6"
        >
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 1, duration: 0.5 }}
            >
              <h2 className="text-4xl md:text-5xl font-bold mb-6" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                Bereit für die menschlichste{" "}
                <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
                  KI-Stimme der Welt?
                </span>
              </h2>
              <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto" style={{ fontFamily: 'Inter, sans-serif' }}>
                Starte jetzt mit ARAS AI und erlebe, wie KI-Telefonie wirklich funktioniert
              </p>
              <Link href="/auth">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-12 py-6 text-lg rounded-full shadow-2xl hover:shadow-orange-500/50 transition-all duration-300 font-bold"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  Jetzt kostenlos testen
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </motion.section>
      </div>
    </>
  );
}
