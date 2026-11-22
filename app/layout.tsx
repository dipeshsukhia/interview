import type { Metadata } from "next";
import { BackToTop } from "@/components/back-to-top";
import { SidebarProvider } from "@/components/sidebar-provider";
import { getAllTips } from "@/lib/content";
import "./globals.css";

const questionCount = getAllTips().length;
const siteDescription = `Study ${questionCount} developer interview questions with clear answers and copyable examples across PHP, React, MySQL, JavaScript, Git, Composer, and Docker.`;

export const metadata: Metadata = {
  metadataBase: new URL("https://dipeshsukhia.github.io"),
  title: {
    default: "Interview Guide — Developer questions and answers",
    template: "%s | Interview Guide",
  },
  description: siteDescription,
  applicationName: "Interview Guide",
  authors: [{ name: "Dipesh Sukhia", url: "https://dipeshsukhia.github.io/" }],
  creator: "Dipesh Sukhia",
  publisher: "Dipesh Sukhia",
  keywords: [
    "developer interview questions",
    "PHP interview questions",
    "React interview questions",
    "MySQL interview questions",
    "JavaScript interview questions",
    "Git interview questions",
    "Composer interview questions",
    "Docker interview questions",
  ],
  alternates: { canonical: "/interview/" },
  icons: { icon: "/interview/interview-icon.svg" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/interview/",
    siteName: "Interview Guide",
    title: "Interview Guide — Developer questions and answers",
    description: siteDescription,
  },
  twitter: {
    card: "summary",
    title: "Interview Guide — Developer questions and answers",
    description: siteDescription,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "WebSite",
                  name: "Interview Guide",
                  url: "https://dipeshsukhia.github.io/interview/",
                  description: siteDescription,
                  inLanguage: "en",
                  author: { "@type": "Person", name: "Dipesh Sukhia", url: "https://dipeshsukhia.github.io/" },
                },
                {
                  "@type": "Person",
                  name: "Dipesh Sukhia",
                  url: "https://dipeshsukhia.github.io/",
                  jobTitle: "Software Developer",
                  knowsAbout: ["PHP", "React", "MySQL", "JavaScript", "Git", "Composer", "Docker"],
                },
              ],
            }).replace(/</g, "\\u003c"),
          }}
        />
        <SidebarProvider>{children}</SidebarProvider>
        <BackToTop />
      </body>
    </html>
  );
}
