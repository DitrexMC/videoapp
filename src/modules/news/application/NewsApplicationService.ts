import type { Clock } from "../../../shared/domain/clock.js";
import type { NewsRepository } from "./NewsRepository.js";

export interface NewsApplicationServiceDependencies {
  clock: Clock;
  newsRepository: NewsRepository;
}

export class NewsApplicationService {
  private readonly clock: Clock;
  private readonly newsRepository: NewsRepository;

  constructor(dependencies: NewsApplicationServiceDependencies) {
    this.clock = dependencies.clock;
    this.newsRepository = dependencies.newsRepository;
  }

  getReadUrls(userId: string): string[] {
    return this.newsRepository.getReadUrls(userId);
  }

  markRead(userId: string, articleUrl: string): void {
    this.newsRepository.markRead(userId, articleUrl, this.clock.nowIsoString());
  }
}
