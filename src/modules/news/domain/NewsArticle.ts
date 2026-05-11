export interface NewsArticle {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  type: "news" | "update" | "guide" | "note" | "danger";
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
  type?: "news" | "update" | "guide" | "note" | "danger";
  date?: string;
  tags?: string;
  image?: string;
  content?: string;
};
