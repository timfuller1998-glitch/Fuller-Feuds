import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isSafeHttpUrl,
  normalizeHttpUrl,
  extractHttpUrls,
  aggregateTopicResources,
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
