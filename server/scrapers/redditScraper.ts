interface RawRedditPost {
  id: string;
  title: string;           // Original opinionated title
  selftext: string;        // Post body
  author: string;
  score: number;
  permalink: string;
  subreddit: string;
}

interface RawRedditComment {
  id: string;
  body: string;
  author: string;
  score: number;
}

export interface ScrapedDebate {
  post: RawRedditPost;
  comments: RawRedditComment[];  // Top N by score
}

export class RedditScraper {
  private baseUrl = 'https://oauth.reddit.com';
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  private async authenticate(): Promise<void> {
    // Check if token is still valid (refresh 5 minutes before expiry)
    if (this.accessToken && Date.now() < this.tokenExpiry - 300000) {
      return;
    }

    const clientId = process.env.REDDIT_CLIENT_ID;
    const clientSecret = process.env.REDDIT_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Reddit credentials not configured. Set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET in .env');
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    try {
      const response = await fetch('https://www.reddit.com/api/v1/access_token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'FullerFeuds/1.0',
        },
        body: 'grant_type=client_credentials',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Reddit authentication failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      // Reddit tokens typically expire in 1 hour
      this.tokenExpiry = Date.now() + (data.expires_in * 1000);
    } catch (error) {
      console.error('Reddit authentication error:', error);
      throw error;
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async makeRequest(endpoint: string): Promise<any> {
    if (!this.accessToken || Date.now() >= this.tokenExpiry - 300000) {
      await this.authenticate();
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'User-Agent': 'FullerFeuds/1.0',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired, re-authenticate and retry once
        await this.authenticate();
        const retryResponse = await fetch(`${this.baseUrl}${endpoint}`, {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'User-Agent': 'FullerFeuds/1.0',
          },
        });
        if (!retryResponse.ok) {
          throw new Error(`Reddit API error: ${retryResponse.status}`);
        }
        return await retryResponse.json();
      }
      throw new Error(`Reddit API error: ${response.status}`);
    }

    return await response.json();
  }

  private flattenComments(comments: any[], depth = 0, maxDepth = 3): RawRedditComment[] {
    const result: RawRedditComment[] = [];

    for (const comment of comments) {
      if (comment.kind !== 't1' || !comment.data?.body) continue;
      if (comment.data.author === '[deleted]' || comment.data.author === null) continue;
      if (comment.data.score < 1) continue; // Skip negative/low score comments
      if (comment.data.body.length < 50) continue; // Skip very short comments

      result.push({
        id: comment.data.id,
        body: comment.data.body,
        author: comment.data.author,
        score: comment.data.score || 0,
      });

      // Recursively get replies
      if (depth < maxDepth && comment.data.replies?.data?.children) {
        result.push(...this.flattenComments(
          comment.data.replies.data.children,
          depth + 1,
          maxDepth
        ));
      }
    }

    return result;
  }

  async scrapeSubreddit(subreddit: string, postLimit: number = 25, commentsPerPost: number = 10): Promise<ScrapedDebate[]> {
    const allowedSubreddits = ['changemyview', 'unpopularopinion', 'TrueOffMyChest', 'AmItheAsshole'];
    
    if (!allowedSubreddits.includes(subreddit.toLowerCase())) {
      throw new Error(`Subreddit ${subreddit} is not in the allowed list: ${allowedSubreddits.join(', ')}`);
    }

    await this.authenticate();

    // Fetch hot posts
    const postsResponse = await this.makeRequest(`/r/${subreddit}/hot?limit=${postLimit}`);
    const posts = postsResponse.data?.children || [];

    const debates: ScrapedDebate[] = [];

    for (const postWrapper of posts) {
      const postData = postWrapper.data;
      
      if (!postData || postData.removed_by_category) continue;

      // Fetch comments for this post
      await this.delay(1000); // Rate limiting: 1 second between requests
      
      try {
        const commentsResponse = await this.makeRequest(`/r/${subreddit}/comments/${postData.id}?limit=100`);
        
        // Reddit returns post data + comments in array format
        const commentsData = commentsResponse[1]?.data?.children || [];
        const allComments = this.flattenComments(commentsData);
        
        // Sort by score and take top N
        const topComments = allComments
          .sort((a, b) => b.score - a.score)
          .slice(0, commentsPerPost);

        debates.push({
          post: {
            id: postData.id,
            title: postData.title,
            selftext: postData.selftext || '',
            author: postData.author,
            score: postData.score || 0,
            permalink: postData.permalink,
            subreddit: postData.subreddit,
          },
          comments: topComments,
        });
      } catch (error) {
        console.error(`Error fetching comments for post ${postData.id}:`, error);
        // Continue with next post
      }
    }

    return debates;
  }
}

