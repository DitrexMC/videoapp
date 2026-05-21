import type { Clock } from "../../../shared/domain/clock.js";
import { AuthorizationError, NotFoundError, ValidationError } from "../../../shared/domain/errors.js";
import { generateId } from "../../../shared/domain/id.js";
import type { AuthApplicationService } from "../../identity/application/AuthApplicationService.js";
import { isAdmin } from "../../identity/domain/User.js";
import type { CreateNewsArticleInput, NewsArticle, UpdateNewsArticleInput } from "../domain/NewsArticle.js";
import type { NewsRepository } from "./NewsRepository.js";

export interface NewsApplicationServiceDependencies {
  authService: AuthApplicationService;
  clock: Clock;
  newsRepository: NewsRepository;
}

export class NewsApplicationService {
  private readonly authService: AuthApplicationService;
  private readonly clock: Clock;
  private readonly newsRepository: NewsRepository;

  constructor(dependencies: NewsApplicationServiceDependencies) {
    this.authService = dependencies.authService;
    this.clock = dependencies.clock;
    this.newsRepository = dependencies.newsRepository;
  }

  getReadUrls(userId: string): string[] {
    return this.newsRepository.getReadUrls(userId);
  }

  markRead(userId: string, articleUrl: string): void {
    this.newsRepository.markRead(userId, articleUrl, this.clock.nowIsoString());
  }

  listArticles(sessionToken: string): NewsArticle[] {
    this.authService.authenticate(sessionToken);
    return this.newsRepository.listArticles();
  }

  getArticleBySlug(sessionToken: string, slug: string): NewsArticle {
    this.authService.authenticate(sessionToken);
    const article = this.newsRepository.getArticleBySlug(slug);
    if (!article) {
      throw new NotFoundError("記事が見つかりません。");
    }
    return article;
  }

  createArticle(sessionToken: string, input: CreateNewsArticleInput): NewsArticle {
    this.requireAdmin(sessionToken);

    if (!input.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) {
      throw new ValidationError("スラッグは小文字英数字とハイフンのみ使用できます。");
    }
    if (!input.title.trim()) {
      throw new ValidationError("タイトルは必須です。");
    }
    if (this.newsRepository.slugExists(input.slug)) {
      throw new ValidationError("このスラッグは既に使用されています。");
    }

    const timestamp = this.clock.nowIsoString();
    const id = generateId();

    this.newsRepository.createArticle({
      ...input,
      id,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return this.newsRepository.getArticleById(id)!;
  }

  updateArticle(sessionToken: string, id: string, input: UpdateNewsArticleInput): NewsArticle {
    this.requireAdmin(sessionToken);

    const existing = this.newsRepository.getArticleById(id);
    if (!existing) {
      throw new NotFoundError("記事が見つかりません。");
    }

    if (input.slug !== undefined) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) {
        throw new ValidationError("スラッグは小文字英数字とハイフンのみ使用できます。");
      }
      if (this.newsRepository.slugExists(input.slug, id)) {
        throw new ValidationError("このスラッグは既に使用されています。");
      }
    }
    if (input.title !== undefined && !input.title.trim()) {
      throw new ValidationError("タイトルは必須です。");
    }

    const timestamp = this.clock.nowIsoString();
    this.newsRepository.updateArticle(id, { ...input, updatedAt: timestamp });

    return this.newsRepository.getArticleById(id)!;
  }

  deleteArticle(sessionToken: string, id: string): void {
    this.requireAdmin(sessionToken);

    const existing = this.newsRepository.getArticleById(id);
    if (!existing) {
      throw new NotFoundError("記事が見つかりません。");
    }

    this.newsRepository.deleteArticle(id);
  }

  private requireAdmin(sessionToken: string) {
    const { user } = this.authService.authenticate(sessionToken);
    if (!isAdmin(user)) {
      throw new AuthorizationError("管理者権限が必要です。");
    }
  }
}
