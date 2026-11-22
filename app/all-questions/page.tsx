import type { Metadata } from "next";
import { CategorySidebar } from "@/components/category-sidebar";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TipExplorer } from "@/components/tip-explorer";
import { getAllTips, getCategories } from "@/lib/content";

const title = "All Developer Interview Questions";
const description = "Browse interview questions and practical answers across PHP, React, MySQL, JavaScript, Git, Composer, and Docker.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/interview/all-questions/" },
  openGraph: { type: "website", url: "/interview/all-questions/", title: `${title} | Interview Guide`, description },
  twitter: { card: "summary", title: `${title} | Interview Guide`, description },
};

export default function AllQuestionsPage() {
  const categories = getCategories();
  const questions = getAllTips();

  return (
    <>
      <SiteHeader showSidebarToggle />
      <div className="app-shell">
        <CategorySidebar categories={categories} activeAll />
        <main className="main-content inner-page">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "CollectionPage",
                name: title,
                description,
                url: "https://dipeshsukhia.github.io/interview/all-questions/",
                isPartOf: { "@type": "WebSite", name: "Interview Guide", url: "https://dipeshsukhia.github.io/interview/" },
                about: { "@type": "Thing", name: "Software developer interviews" },
                inLanguage: "en",
              }).replace(/</g, "\\u003c"),
            }}
          />
          <section className="category-hero all-tips-hero">
            <p className="section-kicker">THE COMPLETE COLLECTION</p>
            <h1>All interview questions<span className="title-period">.</span></h1>
            <p>Search practical explanations and examples across every technology.</p>
            <span className="category-count-pill">{String(questions.length).padStart(2, "0")} QUESTIONS</span>
          </section>
          <TipExplorer tips={questions} categories={categories} />
          <SiteFooter />
        </main>
      </div>
    </>
  );
}
