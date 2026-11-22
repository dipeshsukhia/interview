import Link from "next/link";

export default function NotFound() {
  return <main className="not-found"><span>404</span><h1>Question not found.</h1><p>It may have moved to another technology collection.</p><Link href="/">Browse all questions</Link></main>;
}
