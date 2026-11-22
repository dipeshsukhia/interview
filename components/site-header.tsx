import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarToggle } from "@/components/sidebar-toggle";

export function SiteHeader({ showSidebarToggle = false }: { showSidebarToggle?: boolean }) {
  return (
    <header className="topbar">
      <div className="topbar-leading">
        {showSidebarToggle && <SidebarToggle />}
        <Link className="brand" href="/" aria-label="Interview Guide home">
          <span className="brand-mark" aria-hidden="true"><span>&lt;/&gt;</span></span>
          <span>Interview <b>Guide</b></span>
        </Link>
      </div>
      <div className="topbar-note"><span className="status-dot" /> Questions and answers by technology</div>
      <div className="topbar-actions">
        <ThemeToggle />
        <a className="source-link" href="https://dipeshsukhia.github.io/">
          Dipesh Sukhia
        </a>
      </div>
    </header>
  );
}
