import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getAllTips, getCategories } from "@/lib/content";
import { TopicIcon } from "@/components/topic-icon";

export default function HomePage() {
  const categories = getCategories();
  const questions = getAllTips();
  return (
    <>
      <SiteHeader />
      <div className="app-shell home-shell">
        <main className="main-content">
          <div className="eyebrow"><span className="eyebrow-line" /> THE DEVELOPER INTERVIEW FIELD GUIDE <span className="eyebrow-line" /></div>
          <section className="hero">
            <p className="hero-kicker">Clear thinking. Practical answers.</p>
            <h1>Interview prep, <em>made clearer.</em></h1>
            <p className="hero-description">Explore concise explanations and copyable examples for common software development interview questions.</p>
            <div className="hero-stats">
              <div><strong>{questions.length}</strong><span>questions answered</span></div>
              <span className="stat-divider" />
              <div><strong>{categories.length}</strong><span>technologies</span></div>
              <span className="hero-spark" aria-hidden="true">✳</span>
            </div>
          </section>

          <section className="category-tiles" aria-label="Browse interview questions by technology">
            <div className="section-heading compact-heading"><div><p className="section-kicker">EXPLORE BY TECHNOLOGY</p><h2>Choose a topic</h2></div><span className="section-note">{categories.length} collections</span></div>
            <div className="category-grid">
              <Link className="category-card" href="/all-questions/">
                <span className="category-card-icon"><TopicIcon topic="all-questions" /></span>
                <span className="category-card-title">All questions</span>
                <span className="category-card-count">{questions.length} answers</span>
              </Link>
              {categories.map((category) => (
                <Link className="category-card" href={`/${category.slug}/`} key={category.slug}>
                  <span className="category-card-icon"><TopicIcon topic={category.slug} /></span>
                  <span className="category-card-title">{category.title}</span>
                  <span className="category-card-count">{category.tips.length} questions</span>
                </Link>
              ))}
            </div>
          </section>
          <SiteFooter />
        </main>
      </div>
    </>
  );
}
