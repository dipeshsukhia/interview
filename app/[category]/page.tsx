import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CategorySidebar } from "@/components/category-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { TipExplorer } from "@/components/tip-explorer";
import { getCategories, getCategory } from "@/lib/content";

export function generateStaticParams() {
  return getCategories().map(({ slug }) => ({ category: slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category: slug } = await params;
  const category = getCategory(slug);
  if (!category) return {};
  const title = `${category.title} Interview Questions`;
  const description = `Prepare with ${category.tips.length} ${category.title} interview questions, clear answers, and practical examples.`;
  const url = `/interview/${category.slug}/`;
  return {
    title,
    description,
    alternates: { canonical: url },
    keywords: [`${category.title} interview questions`, `${category.title} interview answers`, "developer interview preparation"],
    openGraph: { type: "website", url, title: `${title} | Interview Guide`, description },
    twitter: { card: "summary", title: `${title} | Interview Guide`, description },
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category: slug } = await params;
  const categories = getCategories();
  const category = getCategory(slug);
  if (!category) notFound();
  const description = `A collection of ${category.tips.length} ${category.title} interview questions and answers, with code examples where useful.`;

  return (
    <>
      <SiteHeader showSidebarToggle />
      <div className="app-shell">
        <CategorySidebar categories={categories} active={category.slug} />
        <main className="main-content inner-page">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "CollectionPage",
                name: `${category.title} Interview Questions`,
                description,
                url: `https://dipeshsukhia.github.io/interview/${category.slug}/`,
                isPartOf: { "@type": "WebSite", name: "Interview Guide", url: "https://dipeshsukhia.github.io/interview/" },
                about: { "@type": "Thing", name: `${category.title} technical interviews` },
                inLanguage: "en",
              }).replace(/</g, "\\u003c"),
            }}
          />
          <div className="breadcrumb"><Link href="/">All questions</Link><span>/</span><span>{category.title}</span></div>
          <div className="category-hero">
            <p className="section-kicker">TECHNOLOGY COLLECTION</p>
            <h1>{category.title}<span className="title-period">.</span></h1>
            <p>{category.tips.length} interview questions with clear answers and practical examples.</p>
            <span className="category-count-pill">{String(category.tips.length).padStart(2, "0")} QUESTIONS</span>
          </div>
          <TipExplorer tips={category.tips} categories={categories} initialCategory={category.slug} />
          <SiteFooter actionHref="/" actionLabel="Browse all technologies" />
        </main>
      </div>
    </>
  );
}
