import { CounterpointRepository } from '../repositories/counterpointRepository.js';

export class CounterpointService {
  private repo: CounterpointRepository;

  constructor() {
    this.repo = new CounterpointRepository();
  }

  async createCounterpoint(params: {
    opinionId: string;
    sentenceIndex: number;
    authorUserId: string;
    content: string;
    paragraphText?: string | null;
  }) {
    if (!params.content || params.content.trim().length < 1) {
      throw new Error('Counterpoint content is required');
    }
    if (!Number.isInteger(params.sentenceIndex) || params.sentenceIndex < 0) {
      throw new Error('Invalid sentenceIndex');
    }
    const paragraphText =
      params.paragraphText != null && String(params.paragraphText).trim().length > 0
        ? String(params.paragraphText).trim()
        : null;
    return this.repo.createCounterpoint({
      opinionId: params.opinionId,
      sentenceIndex: params.sentenceIndex,
      authorUserId: params.authorUserId,
      content: params.content.trim(),
      paragraphText,
    });
  }

  async listCounterpoints(params: { opinionId: string; sentenceIndex: number; currentUserId?: string }) {
    return this.repo.listCounterpoints(params);
  }

  async countCounterpointsBySentenceIndex(opinionId: string) {
    return this.repo.countCounterpointsBySentenceIndex(opinionId);
  }

  async setCounterpointLike(params: { counterpointId: string; userId: string; like: boolean }) {
    return this.repo.setCounterpointLike(params);
  }

  async getCounterpoint(counterpointId: string) {
    return this.repo.getCounterpointById(counterpointId);
  }

  async listLikerIds(counterpointId: string) {
    return this.repo.listCounterpointLikerIds(counterpointId);
  }

  async getDebaterRankMap(userIds: string[]) {
    return this.repo.getDebaterStatsForUsers(userIds);
  }
}

