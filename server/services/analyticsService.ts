import { AnalyticsRepository } from '../repositories/analyticsRepository.js';
import { getCache, setCache, cacheKey, CACHE_TTL } from './cacheService.js';

export class AnalyticsService {
  private repository: AnalyticsRepository;

  constructor() {
    this.repository = new AnalyticsRepository();
  }

  async getTopicPoliticalDistribution(topicId: string) {
    const key = cacheKey('analytics', 'political-dist', topicId);
    
    // Try cache first
    const cached = await getCache(key);
    if (cached) {
      return cached;
    }

    // Fetch from repository
    const distribution = await this.repository.getTopicPoliticalDistribution(topicId);
    
    // Cache for 5 minutes (long TTL for analytics)
    await setCache(key, distribution, CACHE_TTL.LONG);
    
    return distribution;
  }

  async getActiveUserPoliticalDistribution() {
    const key = 'users:active-distribution';
    
    // Try cache first
    const cached = await getCache(key);
    if (cached) {
      return cached;
    }

    // Fetch from repository
    const distribution = await this.repository.getActiveUserPoliticalDistribution();
    
    // Cache for 5 minutes (long TTL for analytics)
    await setCache(key, distribution, CACHE_TTL.LONG);
    
    return distribution;
  }

  async getPlatformStats() {
    const key = 'stats:platform';
    
    // Try cache first
    const cached = await getCache(key);
    if (cached) {
      return cached;
    }

    // Fetch from repository
    const stats = await this.repository.getPlatformStats();
    
    // Cache for 5 minutes (long TTL for analytics)
    await setCache(key, stats, CACHE_TTL.LONG);
    
    return stats;
  }

  // Helper methods for processing distributions
  processPoliticalDistribution(distribution: {
    authoritarianCapitalist: number;
    authoritarianSocialist: number;
    libertarianCapitalist: number;
    libertarianSocialist: number;
  }) {
    const total = distribution.authoritarianCapitalist +
                  distribution.authoritarianSocialist +
                  distribution.libertarianCapitalist +
                  distribution.libertarianSocialist;

    if (total === 0) {
      return {
        ...distribution,
        percentages: {
          authoritarianCapitalist: 0,
          authoritarianSocialist: 0,
          libertarianCapitalist: 0,
          libertarianSocialist: 0,
        },
        total: 0,
      };
    }

    return {
      ...distribution,
      percentages: {
        authoritarianCapitalist: Math.round((distribution.authoritarianCapitalist / total) * 100),
        authoritarianSocialist: Math.round((distribution.authoritarianSocialist / total) * 100),
        libertarianCapitalist: Math.round((distribution.libertarianCapitalist / total) * 100),
        libertarianSocialist: Math.round((distribution.libertarianSocialist / total) * 100),
      },
      total,
    };
  }

  // Calculate diversity score based on distribution
  calculateDiversityScore(distribution: {
    authoritarianCapitalist: number;
    authoritarianSocialist: number;
    libertarianCapitalist: number;
    libertarianSocialist: number;
  }): number {
    const total = distribution.authoritarianCapitalist +
                  distribution.authoritarianSocialist +
                  distribution.libertarianCapitalist +
                  distribution.libertarianSocialist;

    if (total === 0) return 0;

    // Calculate entropy as diversity measure
    let entropy = 0;
    const quadrants = [
      distribution.authoritarianCapitalist,
      distribution.authoritarianSocialist,
      distribution.libertarianCapitalist,
      distribution.libertarianSocialist,
    ];

    for (const count of quadrants) {
      if (count > 0) {
        const p = count / total;
        entropy -= p * Math.log2(p);
      }
    }

    // Normalize to 0-100 scale (max entropy for 4 equal quadrants is 2)
    return Math.round((entropy / 2) * 100);
  }
}
