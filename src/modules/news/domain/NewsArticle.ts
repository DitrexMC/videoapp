export const NEWS_ARTICLE_TYPES = [
  "news",
  "update",
  "feature",
  "guide",
  "note",
  "info",
  "warning",
  "maintenance",
  "danger",
  "security",
  "hotfix",
  "release",
  "event",
] as const;

export type NewsArticleType = (typeof NEWS_ARTICLE_TYPES)[number];

export interface NewsArticle {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  type: NewsArticleType;
  date: string;
  tags: string;
  image: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateNewsArticleInput = Pick<
  NewsArticle,
  "slug" | "title" | "subtitle" | "type" | "date" | "tags" | "image" | "content"
>;

export type UpdateNewsArticleInput = {
  slug?: string;
  title?: string;
  subtitle?: string;
  type?: NewsArticleType;
  date?: string;
  tags?: string;
  image?: string;
  content?: string;
};
