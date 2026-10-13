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
        <div className="page-hero-head">
          <span className="hero-badge">
            <span className="badge-dot" /> Guides &amp; Documentation
          </span>
          <h1>{t("featuresTitle")}</h1>
          <p className="lead">{t("featuresLead")}</p>
        </div>

        <div className="tag-row center-tags">
          <span className="tag-label">{t("filterTags")}</span>
          <button type="button" className={tag === null ? "on" : ""} onClick={() => setTag(null)}>
            All ({ARTICLES.length})
          </button>
          {TAGS.map((item) => (
            <button key={item} type="button" className={tag === item ? "on" : ""} onClick={() => setTag(tag === item ? null : item)}>
              {item}
            </button>
          ))}
        </div>

        <div className="article-grid">
          {articles.map((article, idx) => (
            <Link key={article.slug} href={`/features/${article.slug}`} className="article-card">
              <div className="cover article-cover" style={{ background: article.cover }}>
                <span className="article-num">0{idx + 1}</span>
                <div className="article-cover-tags">
                  {article.tags.slice(0, 2).map((tg) => (
                    <span key={tg}>{tg}</span>
                  ))}
                </div>
              </div>
              <div className="article-body">
                <small>
                  {article.author} · {article.date}
                </small>
                <h2>{article.title}</h2>
                <p>{article.excerpt}</p>
                <span className="article-read-more">Read guide →</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
