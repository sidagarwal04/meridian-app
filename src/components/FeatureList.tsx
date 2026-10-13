"use client";

import Link from "next/link";
import { useState } from "react";
import { ARTICLES, TAGS } from "@/lib/articles";
import { useI18n } from "@/lib/i18n";
import { PageShell } from "./PageShell";

export function FeatureList() {
  const { t } = useI18n();
  const [tag, setTag] = useState<string | null>(null);
  const articles = ARTICLES.filter((article) => !tag || article.tags.includes(tag));
  return (
    <PageShell>
      <div className="page">
        <h1>{t("featuresTitle")}</h1>
        <p className="lead">{t("featuresLead")}</p>
        <div className="tag-row">
          <strong>{t("filterTags")}</strong>
          {TAGS.map((item) => (
            <button key={item} className={tag === item ? "on" : ""} onClick={() => setTag(tag === item ? null : item)}>
              {item}
            </button>
          ))}
        </div>
        <div className="article-grid">
          {articles.map((article) => (
            <Link key={article.slug} href={`/features/${article.slug}`} className="article-card">
              <div className="cover" style={{ background: article.cover }} />
              <div>
                <small>
                  {article.author} · {article.date}
                </small>
                <h2>{article.title}</h2>
                <p>{article.excerpt}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
