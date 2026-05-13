export interface NewsArticle {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  type: "news" | "update" | "feature" | "guide" | "note" | "info" | "warning" | "maintenance" | "danger" | "security" | "hotfix" | "release" | "event";
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
  type?: "news" | "update" | "feature" | "guide" | "note" | "info" | "warning" | "maintenance" | "danger" | "security" | "hotfix" | "release" | "event";
  date?: string;
  tags?: string;
  image?: string;
  content?: string;
};
