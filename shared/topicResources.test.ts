import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isSafeHttpUrl,
  normalizeHttpUrl,
  extractHttpUrls,
  aggregateTopicResources,
  coerceHttpUrl,
  normalizeReferences,
} from "./topicResources.ts";

describe("isSafeHttpUrl", () => {
  it("accepts http and https", () => {
    assert.ok(isSafeHttpUrl("https://example.com/a"));
    assert.ok(isSafeHttpUrl("http://example.com/a"));
  });
  it("rejects javascript, data, and credentialed URLs", () => {
    assert.equal(isSafeHttpUrl("javascript:alert(1)"), null);
    assert.equal(isSafeHttpUrl("data:text/html,hi"), null);
    assert.equal(isSafeHttpUrl("https://user:pass@example.com"), null);
    assert.equal(isSafeHttpUrl("https://localhost/secret"), null);
  });
});

describe("extractHttpUrls", () => {
  it("pulls URLs from references and from opinion text, and ignores unsafe ones", () => {
    const urls = extractHttpUrls(
      "See https://example.com/article. Also javascript:alert(1) and data:text/plain,hi",
      ["https://example.com/article", "https://news.example.com/other"],
    );
    assert.deepEqual(urls, ["https://example.com/article", "https://news.example.com/other"]);
  });
  it("strips trailing punctuation and tracking params", () => {
    const urls = extractHttpUrls("Source: https://example.com/a?utm_source=x&b=1).");
    assert.deepEqual(urls, ["https://example.com/a?b=1"]);
  });
});

describe("aggregateTopicResources", () => {
  it("ranks by citation count, then like ratio", () => {
    const rows = aggregateTopicResources([
      { content: "https://example.com/a", likesCount: 1, dislikesCount: 0 },
      { references: ["https://example.com/b"], likesCount: 10, dislikesCount: 0 },
      { content: "again https://example.com/a", likesCount: 0, dislikesCount: 1 },
    ]);
    assert.equal(rows[0].url, "https://example.com/a");
    assert.equal(rows[0].citationCount, 2);
    assert.equal(rows[0].likeRatio, 0.5);
    assert.equal(rows[1].url, "https://example.com/b");
    assert.equal(rows[1].citationCount, 1);
    assert.equal(rows[1].likeRatio, 1);
  });
});

describe("normalizeHttpUrl", () => {
  it("returns null for unsafe protocols", () => {
    assert.equal(normalizeHttpUrl("javascript:alert(1)"), null);
    assert.equal(normalizeHttpUrl("data:text/html,x"), null);
  });
});

describe("coerceHttpUrl", () => {
  it("adds https to bare domains and www hosts", () => {
    assert.equal(coerceHttpUrl("example.com"), "https://example.com");
    assert.equal(coerceHttpUrl("www.example.com/path"), "https://www.example.com/path");
    assert.equal(coerceHttpUrl("https://example.com/a"), "https://example.com/a");
  });
  it("rejects schemes and bare words that are not domains", () => {
    assert.equal(coerceHttpUrl("javascript:alert(1)"), null);
    assert.equal(coerceHttpUrl("notalink"), null);
    assert.equal(coerceHttpUrl("localhost"), null);
  });
});

describe("extractHttpUrls bare domains", () => {
  it("picks example.com out of opinion text", () => {
    assert.deepEqual(extractHttpUrls("I read this at example.com yesterday."), ["https://example.com"]);
    assert.deepEqual(extractHttpUrls("See www.bbc.co.uk/news and https://nytimes.com/a."), [
      "https://nytimes.com/a",
      "https://www.bbc.co.uk/news",
    ]);
  });
  it("does not treat emails as links", () => {
    assert.deepEqual(extractHttpUrls("Email me at you@example.com please."), []);
  });
});

describe("normalizeReferences", () => {
  it("coerces, dedupes, and caps at 5", () => {
    assert.deepEqual(
      normalizeReferences(["example.com", "https://example.com", "https://other.org/x", "", "not a link", "a.com", "b.com", "c.com", "d.com"]),
      ["https://example.com", "https://other.org/x", "https://a.com", "https://b.com", "https://c.com"],
    );
  });
});
