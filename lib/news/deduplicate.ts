import type { NewsArticle } from "@/types/news";

const ignoredHeadlineWords = new Set(["a", "an", "and", "for", "in", "of", "on", "the", "to", "with", "demo", "scenario"]);
const trailingEditorialWords = new Set(["update", "report", "brief", "note"]);

export function normalizeHeadline(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase()
    .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/)
    .filter((word) => !ignoredHeadlineWords.has(word)).join(" ");
}

/** Conservative dedupe: identity, topic, 72-hour window, same normalized summary,
 * and an exact normalized headline or one safe trailing editorial qualifier. */
export function areDuplicateHeadlines(first: NewsArticle, second: NewsArticle): boolean {
  if (first.securityId !== second.securityId || first.category !== second.category) return false;
  const hoursApart = Math.abs(Date.parse(first.publishedAt) - Date.parse(second.publishedAt)) / (60 * 60 * 1000);
  if (!Number.isFinite(hoursApart) || hoursApart > 72) return false;
  if (normalizeHeadline(first.summary) !== normalizeHeadline(second.summary)) return false;
  const firstWords = normalizeHeadline(first.headline).split(" ");
  const secondWords = normalizeHeadline(second.headline).split(" ");
  if (firstWords.join(" ") === secondWords.join(" ")) return true;
  const shorter = firstWords.length < secondWords.length ? firstWords : secondWords;
  const longer = firstWords.length < secondWords.length ? secondWords : firstWords;
  return longer.length === shorter.length + 1
    && shorter.every((word, index) => longer[index] === word)
    && trailingEditorialWords.has(longer.at(-1) ?? "");
}

interface ArticleGroup { canonical: NewsArticle; members: NewsArticle[] }

export function deduplicateNews(articles: NewsArticle[]): NewsArticle[] {
  const ordered = [...articles].sort((a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt));
  const groups: ArticleGroup[] = [];
  for (const article of ordered) {
    // Match directly against canonical records; do not use transitive components.
    const group = groups.find((candidate) => areDuplicateHeadlines(candidate.canonical, article));
    if (group) group.members.push(article);
    else groups.push({ canonical: article, members: [article] });
  }
  return groups.map(({ canonical, members }) => {
    const allIds = new Set<string>();
    for (const member of members) {
      allIds.add(member.id);
      member.duplicateArticleIds.forEach((id) => allIds.add(id));
    }
    allIds.add(canonical.id);
    return {
      ...canonical,
      duplicateCount: allIds.size,
      duplicateArticleIds: [...allIds].filter((id) => id !== canonical.id)
    };
  }).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}
