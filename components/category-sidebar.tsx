"use client";

import Link from "next/link";
import type { Category } from "@/lib/content";
import { useSidebar } from "@/components/sidebar-provider";

export function CategorySidebar({ categories, active, activeAll = false }: { categories: Category[]; active?: string; activeAll?: boolean }) {
  const { isOpen, toggle } = useSidebar();
  return (
    <>
      <aside id="category-sidebar" className={`sidebar${isOpen ? "" : " is-collapsed"}`}>
        <p className="sidebar-label">Browse technologies</p>
        <nav aria-label="Interview question categories" className="category-nav">
          <Link className={`nav-link ${activeAll ? "active" : ""}`} href="/all-questions/">
            <span className="nav-icon">⌂</span><span>All questions</span>
          </Link>
          {categories.map((category) => (
            <Link className={`nav-link ${active === category.slug ? "active" : ""}`} href={`/${category.slug}/`} key={category.slug}>
              <span className="nav-icon">#</span><span>{category.title}</span><span className="nav-count">{category.tips.length}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-card">
          <span className="sidebar-card-icon">✳</span>
          <strong>Practice with clarity.</strong>
          <p>Concise answers and examples for the concepts interviewers ask about.</p>
        </div>
      </aside>
      {isOpen && <button className="sidebar-backdrop" type="button" aria-label="Close navigation" onClick={toggle} />}
    </>
  );
}
