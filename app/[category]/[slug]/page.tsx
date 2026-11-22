import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CategorySidebar } from "@/components/category-sidebar";
import { MarkdownContent } from "@/components/markdown-content";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getCategories, getTip } from "@/lib/content";

export function generateStaticParams() {
  return getCategories().flatMap((category) => category.tips.map((tip) => ({ category: category.slug, slug: tip.slug })));
}

export async function generateMetadata({ params }: { params: Promise<{ category: string; slug: string }> }): Promise<Metadata> {
  const { category, slug } = await params;
  const question = getTip(category, slug);
  if (!question) return {};
  const url = `/interview/${question.categorySlug}/${question.slug}/`;
  const description = question.description;
  return {
    title: question.title,
    description,
    alternates: { canonical: url },
    keywords: [question.title, `${question.category} interview questions`, "technical interview answers"],
    openGraph: {
      type: "article",
      url,
      title: `${question.title} | Interview Guide`,
      description,
      section: question.category,
      authors: ["https://dipeshsukhia.github.io/"],
    },
    twitter: { card: "summary", title: `${question.title} | Interview Guide`, description },
  };
}

export default async function QuestionPage({ params }: { params: Promise<{ category: string; slug: string }> }) {
  const { category: categorySlug, slug } = await params;
  const categories = getCategories();
  const question = getTip(categorySlug, slug);
  if (!question) notFound();
  const category = categories.find((item) => item.slug === categorySlug)!;
  const index = category.tips.findIndex((item) => item.slug === slug);
  const previous = category.tips[index - 1];
  const next = category.tips[index + 1];
  const url = `https://dipeshsukhia.github.io/interview/${category.slug}/${question.slug}/`;

  return (
    <>
      <SiteHeader showSidebarToggle />
      <div className="app-shell">
        <CategorySidebar categories={categories} active={category.slug} />
        <main className="main-content inner-page article-page">
          <div className="breadcrumb"><Link href="/">All questions</Link><span>/</span><Link href={`/${category.slug}/`}>{category.title}</Link><span>/</span><span>Question {String(index + 1).padStart(2, "0")}</span></div>
          <article>
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: JSON.stringify({
                  "@context": "https://schema.org",
                  "@type": "TechArticle",
                  headline: question.title,
                  description: question.description,
                  url,
                  mainEntityOfPage: url,
                  articleSection: category.title,
                  inLanguage: "en",
                  author: { "@type": "Person", name: "Dipesh Sukhia", url: "https://dipeshsukhia.github.io/" },
                  publisher: { "@type": "Person", name: "Dipesh Sukhia", url: "https://dipeshsukhia.github.io/" },
                  isPartOf: { "@type": "WebSite", name: "Interview Guide", url: "https://dipeshsukhia.github.io/interview/" },
                }).replace(/</g, "\\u003c"),
              }}
            />
            <div className="article-heading">
              <Link className="article-category" href={`/${category.slug}/`}>{category.title}<span aria-hidden="true"> · {category.tips.length} questions</span></Link>
              <span className="article-index">QUESTION {String(index + 1).padStart(2, "0")} / {String(category.tips.length).padStart(2, "0")}</span>
              <h1>{question.title}<span className="title-period">.</span></h1>
              <div className="article-rule"><span /></div>
            </div>
            <div className="markdown-body"><MarkdownContent>{question.markdown}</MarkdownContent></div>
          </article>
          <nav className="article-pagination" aria-label="Questions in this technology">
            {previous ? <Link href={`/${category.slug}/${previous.slug}/`} className="page-step"><span>PREVIOUS QUESTION</span><strong>{previous.title}</strong></Link> : <Link href={`/${category.slug}/`} className="page-step"><span>BACK TO TECHNOLOGY</span><strong>{category.title}</strong></Link>}
            {next ? <Link href={`/${category.slug}/${next.slug}/`} className="page-step next-step"><span>NEXT QUESTION</span><strong>{next.title}</strong></Link> : <Link href="/" className="page-step next-step"><span>EXPLORE MORE</span><strong>All technologies</strong></Link>}
          </nav>
          <SiteFooter actionHref={`/${category.slug}/`} actionLabel={`Browse ${category.title} questions`} />
        </main>
      </div>
    </>
  );
}
