export interface NewsRepository {
  getReadUrls(userId: string): string[];
  markRead(userId: string, articleUrl: string, readAt: string): void;
}
