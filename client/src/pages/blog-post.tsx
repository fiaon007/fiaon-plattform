import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, Calendar, Share2, Linkedin, Twitter, Mail, Copy, Check, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link, useParams } from "wouter";
import { SEOHead } from "@/components/seo-head";
import { BLOG_POST_CONTENT } from "./blog-post-content";

interface TOCItem {
  id: string;
  text: string;
  level: number;
}

export default function BlogPost() {
  const { slug } = useParams();
  const [activeSection, setActiveSection] = useState("");
  const [tocItems, setTocItems] = useState<TOCItem[]>([]);
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const post = {
    slug: "ki-outbound-telefonie-ultimativer-guide-2025",
    title: "KI-Outbound-Telefonie: Der ultimative Guide für 2025",
    excerpt: "Erfahren Sie, wie KI-gestützte Telefonie Ihre B2B-Akquise revolutioniert.",
    category: "KI-Telefonie",
    tags: ["KI-Outbound", "Voice AI", "B2B-Vertrieb", "DSGVO", "ARAS Core", "Outbound-Telefonie"],
    author: {
      name: "ARAS AI Team",
      role: "KI-Experten & Vertriebsspezialisten",
      bio: "Das ARAS AI Team besteht aus KI-Forschern, Vertriebsexperten und Software-Engineers."
    },
    publishedAt: "2025-12-08",
    readTime: "15 Min.",
  };

  useEffect(() => {
    if (contentRef.current) {
      const headings = contentRef.current.querySelectorAll('h2, h3');
      const items: TOCItem[] = Array.from(headings).map((heading, index) => {
        const id = `section-${index}`;
        heading.id = id;
        return {
          id,
          text: heading.textContent || '',
          level: parseInt(heading.tagName.charAt(1))
        };
      });
      setTocItems(items);
    }
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );

    tocItems.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [tocItems]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const shareUrl = `https://platform.aras.ai/blog/${post.slug}`;
  
  const handleShare = (platform: string) => {
    const urls = {
      twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(post.title)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
      email: `mailto:?subject=${encodeURIComponent(post.title)}&body=${encodeURIComponent(shareUrl)}`
    };
    
    if (platform === 'copy') {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      window.open(urls[platform as keyof typeof urls], '_blank', 'width=600,height=400');
    }
  };

  return (
    <>
      <SEOHead
        title={`${post.title} | ARAS AI Blog`}
        description={post.excerpt}
        url={shareUrl}
        type="article"
        publishedTime={post.publishedAt}
        author={post.author.name}
        section={post.category}
        tags={post.tags}
      />

      <div className="min-h-screen bg-white">
        {/* Back Button */}
        <div className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <Link href="/blog">
              <motion.button
                whileHover={{ x: -5 }}
                className="flex items-center gap-2 text-gray-600 hover:text-orange-500 transition-colors font-medium"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                <ArrowLeft className="w-5 h-5" />
                Zurück zum Blog
              </motion.button>
            </Link>
          </div>
        </div>

        {/* Hero Header */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden bg-gradient-to-br from-orange-50 via-white to-orange-50/30 pt-16 pb-12 px-6"
        >
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="flex items-center gap-3 mb-6"
            >
              <span className="px-4 py-1.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-full text-sm font-semibold">
                {post.category}
              </span>
              <div className="flex items-center gap-2 text-gray-600 text-sm">
                <Calendar className="w-4 h-4" />
                <span>{new Date(post.publishedAt).toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600 text-sm">
                <Clock className="w-4 h-4" />
                <span>{post.readTime}</span>
              </div>
            </motion.div>

            <motion.h1
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-gray-900"
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              {post.title}
            </motion.h1>

            <motion.p
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="text-xl text-gray-600 mb-8"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              {post.excerpt}
            </motion.p>

            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="flex items-center gap-4"
            >
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-xl font-bold">
                A
              </div>
              <div>
                <p className="font-semibold text-gray-900">{post.author.name}</p>
                <p className="text-sm text-gray-600">{post.author.role}</p>
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-6 py-12 lg:py-16">
          <div className="grid lg:grid-cols-12 gap-12">
            {/* Sidebar */}
            <aside className="hidden lg:block lg:col-span-3">
              <div className="sticky top-24 space-y-6">
                <Card className="border-2 border-gray-100 rounded-2xl">
                  <CardContent className="p-6">
                    <h3 className="text-sm font-bold mb-4 uppercase" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                      Inhalt
                    </h3>
                    <nav className="space-y-2">
                      {tocItems.map((item) => (
                        <motion.button
                          key={item.id}
                          onClick={() => scrollToSection(item.id)}
                          whileHover={{ x: 5 }}
                          className={`block w-full text-left text-sm py-2 px-3 rounded-lg transition-all ${
                            item.level === 3 ? 'pl-6' : ''
                          } ${
                            activeSection === item.id
                              ? 'bg-orange-50 text-orange-600 font-semibold'
                              : 'text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {item.text}
                        </motion.button>
                      ))}
                    </nav>
                  </CardContent>
                </Card>

                <Card className="border-2 border-gray-100 rounded-2xl">
                  <CardContent className="p-6">
                    <h3 className="text-sm font-bold mb-4 uppercase" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                      Teilen
                    </h3>
                    <div className="space-y-2">
                      {[
                        { platform: 'linkedin', icon: Linkedin, label: 'LinkedIn', color: 'blue' },
                        { platform: 'twitter', icon: Twitter, label: 'Twitter', color: 'sky' },
                        { platform: 'email', icon: Mail, label: 'E-Mail', color: 'gray' },
                        { platform: 'copy', icon: copied ? Check : Copy, label: copied ? 'Kopiert!' : 'Link kopieren', color: 'orange' }
                      ].map(({ platform, icon: Icon, label, color }) => (
                        <motion.button
                          key={platform}
                          whileHover={{ scale: 1.05 }}
                          onClick={() => handleShare(platform)}
                          className={`w-full flex items-center gap-3 px-4 py-3 bg-${color}-50 hover:bg-${color}-100 text-${color}-600 rounded-xl`}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="font-medium text-sm">{label}</span>
                        </motion.button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-2 border-orange-200 rounded-2xl bg-gradient-to-br from-orange-50 to-white">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-bold mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                      Jetzt testen
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">Erlebe die Zukunft der KI-Telefonie</p>
                    <Link href="/auth">
                      <Button className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl">
                        Kostenlos starten <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </div>
            </aside>

            {/* Article */}
            <article className="lg:col-span-9">
              <motion.div
                ref={contentRef}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="prose prose-lg max-w-none"
                dangerouslySetInnerHTML={{ __html: BLOG_POST_CONTENT }}
              />

              <motion.div className="mt-12 pt-8 border-t">
                <h3 className="text-sm font-bold mb-4 uppercase">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <span key={tag} className="px-4 py-2 bg-gray-100 hover:bg-orange-50 rounded-lg text-sm">
                      # {tag}
                    </span>
                  ))}
                </div>
              </motion.div>

              <motion.div className="mt-12">
                <Card className="border-2 rounded-2xl bg-gradient-to-br from-gray-50 to-white">
                  <CardContent className="p-8">
                    <div className="flex items-start gap-6">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-2xl font-bold">
                        A
                      </div>
                      <div>
                        <h3 className="text-xl font-bold mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                          {post.author.name}
                        </h3>
                        <p className="text-sm text-orange-600 mb-3">{post.author.role}</p>
                        <p className="text-gray-600">{post.author.bio}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </article>
          </div>
        </div>

        {/* Bottom CTA */}
        <motion.section className="bg-gradient-to-r from-gray-900 via-black to-gray-900 text-white py-20 px-6 mt-16">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-6" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              Bereit für die menschlichste{" "}
              <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
                KI-Stimme der Welt?
              </span>
            </h2>
            <p className="text-xl text-gray-300 mb-10">
              Starte jetzt mit ARAS AI und führe 500+ parallele Anrufe. DSGVO-konform & ohne Abhängigkeiten.
            </p>
            <Link href="/auth">
              <Button size="lg" className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-12 py-6 text-lg rounded-full">
                Jetzt kostenlos testen <ChevronRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
        </motion.section>

        {/* Mobile Share FAB */}
        <div className="lg:hidden fixed bottom-6 right-6 z-50">
          <motion.button
            whileHover={{ scale: 1.1 }}
            className="w-14 h-14 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-full shadow-2xl flex items-center justify-center"
            onClick={() => navigator.share && navigator.share({ title: post.title, url: shareUrl })}
          >
            <Share2 className="w-6 h-6" />
          </motion.button>
        </div>
      </div>

      <style>{`
        .prose h2 { font-family: 'Orbitron', sans-serif; font-size: 32px; font-weight: 700; margin-top: 48px; }
        .prose h3 { font-family: 'Orbitron', sans-serif; font-size: 24px; font-weight: 700; margin-top: 36px; }
        .prose p { margin-bottom: 24px; color: #374151; }
        .prose strong { color: #121212; font-weight: 700; }
        .prose a { color: #FE9100; text-decoration: none; font-weight: 600; }
        .prose a:hover { color: #DC7900; text-decoration: underline; }
        .prose blockquote { border-left: 4px solid #FE9100; padding-left: 24px; margin: 32px 0; }
      `}</style>
    </>
  );
}
