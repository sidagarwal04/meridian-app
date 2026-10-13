import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { ARTICLES } from "@/lib/articles";

export function generateStaticParams() {
  return ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = ARTICLES.find((item) => item.slug === slug);
  return { title: article?.title ?? "Feature" };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = ARTICLES.find((item) => item.slug === slug);
  if (!article) notFound();
  return (
    <PageShell>
      <article className="article">
        <p className="meta">
          <Link href="/features">← Features</Link>
        </p>
        <div className="cover" style={{ background: article.cover }} />
        <h1>{article.title}</h1>
        {article.body.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </article>
    </PageShell>
  );
}
