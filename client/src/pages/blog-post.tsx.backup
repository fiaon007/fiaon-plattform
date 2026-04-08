import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, Clock, Share2, Twitter, Linkedin, Mail, Tag, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GradientText } from "@/components/ui/gradient-text";
import { Link, useParams, useLocation } from "wouter";
import { SEOHead } from "@/components/seo-head";
import { BLOG_POST_CONTENT } from "./blog-post-content";

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
    bio: string;
  };
  publishedAt: string;
  updatedAt?: string;
  readTime: string;
  image: string;
  featured: boolean;
}

// Beispiel-Content (wird später durch echte CMS-Daten ersetzt)
const BLOG_POSTS_DATA: Record<string, BlogPost> = {
  "ki-outbound-telefonie-ultimativer-guide-2025": {
    id: "1",
    slug: "ki-outbound-telefonie-ultimativer-guide-2025",
    title: "KI-Outbound-Telefonie: Der ultimative Guide für 2025",
    excerpt: "Der große Leitfaden für KI-Outbound-Telefonie: Was es ist, wie es funktioniert und warum ARAS AI der neue Goldstandard ist.",
    content: BLOG_POST_CONTENT,
    category: "KI-Telefonie",
    tags: ["KI-Outbound", "Voice AI", "B2B-Vertrieb", "DSGVO", "ARAS Core", "Outbound-Telefonie", "KI-Telefonie", "Vertriebsautomatisierung"],
    author: {
      name: "ARAS AI Team",
      avatar: "/src/assets/aras_logo_1755067745303.png",
      role: "KI-Experten",
      bio: "Pioniere der KI-gestützten Business-Telefonie aus Zürich. Seit 2023 entwickeln wir das proprietäre ARAS Core LLM für hochwertige, DSGVO-konforme Telefongespräche."
    },
    publishedAt: "2025-12-01",
    updatedAt: "2025-12-08",
    readTime: "15 Min.",
    image: "/api/placeholder/1200/600",
    featured: true
  }
};

export default function BlogPost() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const slug = params.slug as string;
  const [post, setPost] = useState<BlogPost | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<BlogPost[]>([]);

  useEffect(() => {
    // In Production würde hier eine API-Anfrage erfolgen
    const foundPost = BLOG_POSTS_DATA[slug];
    if (foundPost) {
      setPost(foundPost);
      // Simulate related posts
      setRelatedPosts([]);
    } else {
      setLocation("/blog");
    }
  }, [slug, setLocation]);

  if (!post) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold" style={{ color: '#e9d7c4' }}>
            Artikel wird geladen...
          </h2>
        </div>
      </div>
    );
  }

  const shareUrl = `https://platform.aras.ai/blog/${post.slug}`;

  return (
    <>
      <SEOHead
        title={`${post.title} | ARAS AI Blog`}
        description={post.excerpt}
        keywords={post.tags.join(', ')}
        image={post.image}
        url={shareUrl}
        type="article"
        publishedTime={post.publishedAt}
        modifiedTime={post.updatedAt}
        author={post.author.name}
        section={post.category}
        tags={post.tags}
      />
      <div className="min-h-screen" style={{ background: 'linear-gradient(to bottom, #0a0a0a, #1a1a1a)' }}>
      {/* Back Navigation */}
      <div className="max-w-5xl mx-auto px-4 pt-8">
        <Link href="/blog">
          <Button
            variant="ghost"
            className="mb-6 text-white/60 hover:text-[#FE9100]"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zurück zum Blog
          </Button>
        </Link>
      </div>

      {/* Hero Image */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="relative h-96 mb-12 overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/50 to-transparent z-10" />
        <img
          src={post.image}
          alt={post.title}
          className="w-full h-full object-cover"
        />
        
        <div className="absolute bottom-0 left-0 right-0 z-20 p-8">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <span
                className="inline-block px-4 py-2 rounded-full text-sm font-bold mb-4"
                style={{
                  background: 'rgba(254, 145, 0, 0.9)',
                  color: 'white'
                }}
              >
                {post.category}
              </span>
              <h1
                className="text-4xl md:text-5xl font-black mb-4"
                style={{ fontFamily: 'Orbitron, sans-serif', color: '#e9d7c4' }}
              >
                {post.title}
              </h1>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Article Meta & Content */}
      <div className="max-w-5xl mx-auto px-4 pb-24">
        <div className="grid lg:grid-cols-[1fr_300px] gap-12">
          {/* Main Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Author & Meta Info */}
            <Card className="border-white/10 bg-white/5 mb-8">
              <CardContent className="p-6">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <img
                      src={post.author.avatar}
                      alt={post.author.name}
                      className="w-16 h-16 rounded-full"
                    />
                    <div>
                      <div className="font-bold text-lg" style={{ color: '#e9d7c4' }}>
                        {post.author.name}
                      </div>
                      <div className="text-sm text-white/60 mb-1">
                        {post.author.role}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-white/50">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(post.publishedAt).toLocaleDateString('de-DE', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {post.readTime} Lesezeit
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Share Buttons */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-white/10 hover:border-[#FE9100]"
                      onClick={() => window.open(`https://twitter.com/intent/tweet?url=${shareUrl}&text=${post.title}`, '_blank')}
                    >
                      <Twitter className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-white/10 hover:border-[#FE9100]"
                      onClick={() => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`, '_blank')}
                    >
                      <Linkedin className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-white/10 hover:border-[#FE9100]"
                      onClick={() => window.open(`mailto:?subject=${post.title}&body=${shareUrl}`, '_blank')}
                    >
                      <Mail className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Article Content */}
            <article
              className="prose prose-invert prose-lg max-w-none"
              style={{
                color: '#e9d7c4',
                '--tw-prose-headings': '#e9d7c4',
                '--tw-prose-links': '#FE9100',
                '--tw-prose-bold': '#e9d7c4',
                '--tw-prose-code': '#FE9100',
              } as any}
            >
              <div
                dangerouslySetInnerHTML={{
                  __html: post.content
                    .replace(/\n/g, '<br />')
                    .replace(/#{1,6}\s(.+)/g, (match, title) => {
                      const level = match.split('#').length - 1;
                      return `<h${level} style="color: #e9d7c4; font-family: Orbitron, sans-serif; margin-top: 2rem; margin-bottom: 1rem;">${title}</h${level}>`;
                    })
                    .replace(/\*\*(.+?)\*\*/g, '<strong style="color: #FE9100;">$1</strong>')
                    .replace(/^-\s(.+)/gm, '<li style="margin-bottom: 0.5rem;">$1</li>')
                    .replace(/✅/g, '<span style="color: #4ade80;">✅</span>')
                }}
              />
            </article>

            {/* Tags */}
            <div className="mt-12 pt-8 border-t border-white/10">
              <div className="flex items-center gap-2 flex-wrap">
                <Tag className="w-5 h-5 text-[#FE9100]" />
                {post.tags.map(tag => (
                  <span
                    key={tag}
                    className="px-4 py-2 rounded-full text-sm font-medium cursor-pointer hover:scale-105 transition-transform"
                    style={{
                      background: 'rgba(254, 145, 0, 0.1)',
                      color: '#FE9100',
                      border: '1px solid rgba(254, 145, 0, 0.3)'
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Author Bio */}
            <Card className="mt-8 border-white/10 bg-white/5">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <img
                    src={post.author.avatar}
                    alt={post.author.name}
                    className="w-20 h-20 rounded-full"
                  />
                  <div>
                    <h3 className="text-xl font-bold mb-2" style={{ color: '#e9d7c4' }}>
                      Über {post.author.name}
                    </h3>
                    <p className="text-white/60">
                      {post.author.bio}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-6"
          >
            {/* CTA Card */}
            <Card
              className="border-white/10 sticky top-8"
              style={{
                background: 'linear-gradient(135deg, rgba(254, 145, 0, 0.1), rgba(233, 215, 196, 0.05))',
                borderColor: 'rgba(254, 145, 0, 0.3)'
              }}
            >
              <CardContent className="p-6">
                <h3
                  className="text-xl font-black mb-4"
                  style={{ fontFamily: 'Orbitron, sans-serif', color: '#e9d7c4' }}
                >
                  Bereit für KI-Telefonie?
                </h3>
                <p className="text-white/60 mb-6 text-sm">
                  Testen Sie ARAS AI 14 Tage kostenlos. Keine Kreditkarte erforderlich.
                </p>
                <Link href="/signup">
                  <Button
                    className="w-full mb-3"
                    style={{
                      background: 'linear-gradient(135deg, #FE9100, #ff6b00)',
                      color: 'white'
                    }}
                  >
                    Jetzt kostenlos testen
                  </Button>
                </Link>
                <Link href="/auth">
                  <Button
                    variant="outline"
                    className="w-full border-white/20 hover:border-[#FE9100]"
                    style={{ color: '#e9d7c4' }}
                  >
                    Demo ansehen
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Newsletter Card */}
            <Card className="border-white/10 bg-white/5">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold mb-3" style={{ color: '#e9d7c4' }}>
                  📧 Newsletter
                </h3>
                <p className="text-sm text-white/60 mb-4">
                  Erhalten Sie wöchentlich KI-Insights direkt in Ihr Postfach.
                </p>
                <input
                  type="email"
                  placeholder="Ihre E-Mail"
                  className="w-full px-4 py-2 rounded-lg mb-3 bg-white/5 border border-white/10 text-white focus:border-[#FE9100] focus:outline-none"
                />
                <Button
                  className="w-full"
                  variant="outline"
                  style={{ borderColor: '#FE9100', color: '#FE9100' }}
                >
                  Abonnieren
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
      </div>
    </>
  );
}
