const paths: Record<string, React.ReactNode> = {
  "all-questions": <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
  laravel: <><path d="M4 4v12l8 5 8-5V4l-8 5-8-5Z" /><path d="M4 4v9l8 5 8-5V4M12 9v12" /></>,
  python: <><path d="M12 3H7a3 3 0 0 0-3 3v4h8v2H6a3 3 0 0 0-3 3v3a3 3 0 0 0 3 3h5" /><path d="M12 21h5a3 3 0 0 0 3-3v-4h-8v-2h6a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3h-5" /><circle cx="8" cy="6" r=".7" /><circle cx="16" cy="18" r=".7" /></>,
  genai: <><path d="m12 2 1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7L12 2Z" /><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" /></>,
  "document-processing": <><path d="M6 2h8l4 4v16H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" /><path d="M14 2v5h5M8 11h8M8 15h8M8 19h5" /></>,
  aws: <><path d="M4 15a4 4 0 0 1 2-7 6 6 0 0 1 11 1 4 4 0 0 1 1 8H6" /><path d="M7 20c3 1 7 1 10-1m-2 2 2-2-2-1" /></>,
  devops: <><path d="M4 12a8 8 0 0 1 14-5m2 5a8 8 0 0 1-14 5" /><path d="M18 3v4h-4M6 21v-4h4" /><circle cx="12" cy="12" r="2" /></>,
  security: <><path d="M12 2 4 5v6c0 5 3 8 8 11 5-3 8-6 8-11V5l-8-3Z" /><path d="m9 12 2 2 4-4" /></>,
  engineering: <><circle cx="12" cy="7" r="3" /><path d="M5 21v-2a7 7 0 0 1 14 0v2M3 11l2 1m16-1-2 1" /></>,
  php: <><path d="M3 12c1-4 4-6 9-6s8 2 9 6c-1 4-4 6-9 6s-8-2-9-6Z" /><path d="M8 10v5m0-5h3a2 2 0 0 1 0 4H8m6-4v5m0-5h3a2 2 0 0 1 0 4h-3" /></>,
  react: <><ellipse cx="12" cy="12" rx="10" ry="4" /><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" /><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" /><circle cx="12" cy="12" r="1.5" /></>,
  mysql: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>,
  javascript: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M10 8v7a2 2 0 0 1-4 0m8 0c0 1 1 2 3 2s3-1 3-2-1-1.5-3-2-3-1-3-2 1-2 3-2 3 1 3 2" /></>,
  git: <><circle cx="6" cy="5" r="2" /><circle cx="18" cy="7" r="2" /><circle cx="12" cy="19" r="2" /><path d="M6 7v4a4 4 0 0 0 4 4h2m4-6v1a4 4 0 0 1-4 4" /></>,
  composer: <><path d="m12 3 9 5v8l-9 5-9-5V8l9-5Z" /><path d="m3 8 9 5 9-5m-9 5v8m-4-14 9 5" /></>,
  docker: <><path d="M3 14h15c2 0 3-1 4-2-1-1-2-1-4-1h-1V8h-3v3h-2V8H9v3H7V8H4v3H2v2a1 1 0 0 0 1 1ZM5 16c1 3 3 4 6 4 4 0 7-2 9-6" /><path d="M11 5h3v2h-3z" /></>,
};

export function TopicIcon({ topic }: { topic: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[topic] ?? paths["all-questions"]}</svg>;
}
