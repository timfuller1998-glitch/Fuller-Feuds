import { test } from "node:test";
import assert from "node:assert/strict";
import { rankRecommended, rankFollowing } from "./profileFeeds";

const now = Date.parse("2026-11-27T12:00:00Z");
const topics = [
  { id: "a", createdById: "me", categories: ["Politics"], createdAt: "2026-11-26", opinionsCount: 9 },
  { id: "b", createdById: "x", categories: ["Politics"], createdAt: "2026-10-01", opinionsCount: 2 },
  { id: "c", createdById: "x", categories: ["Sports"], createdAt: "2026-11-26", opinionsCount: 50 },
  { id: "d", createdById: "y", categories: ["Politics"], createdAt: "2026-11-25", opinionsCount: 1 },
  { id: "e", createdById: "y", categories: ["Tech"], createdAt: "2026-11-25", opinionsCount: 3, status: "hidden" },
];

test("recommended puts unanswered topics in the user's categories first (own topics included), skips hidden", () => {
  const r = rankRecommended(topics, { userId: "me", answeredTopicIds: new Set(["d"]), categoryWeights: new Map([["Politics", 2]]), now, limit: 3 });
  assert.deepEqual(r.map((t) => t.id), ["a", "b", "c"]);
  assert.equal(r[0].recommendReason, "In categories you debate");
  assert.ok(!r.some((t) => t.id === "e"));
});

test("recommended is never empty while visible topics exist: fills with trending answered topics", () => {
  // The live case: the user (an admin) created every topic and has answered all but none here.
  const all = new Set(["a", "b", "c", "d"]);
  const r = rankRecommended(topics, { userId: "me", answeredTopicIds: all, categoryWeights: new Map(), now, limit: 2 });
  assert.deepEqual(r.map((t) => [t.id, t.recommendReason]), [["c", "Trending — add a new take"], ["a", "Trending — add a new take"]]);
  assert.deepEqual(rankRecommended([], { userId: "me", answeredTopicIds: all, categoryWeights: new Map(), now }), []);
});

test("following keeps the latest activity per topic, newest first, even on topics the viewer started", () => {
  const r = rankFollowing(topics, [
    { topicId: "b", actorId: "x", actorName: "Xena", kind: "created", at: "2026-10-01" },
    { topicId: "b", actorId: "y", actorName: "Yuri", kind: "opinion", at: "2026-11-27T10:00:00Z", excerpt: " UBI works " },
    { topicId: "c", actorId: "x", actorName: "Xena", kind: "created", at: "2026-11-26" },
    { topicId: "a", actorId: "x", actorName: "Xena", kind: "opinion", at: "2026-11-27T11:00:00Z" },
    { topicId: "e", actorId: "x", actorName: "Xena", kind: "opinion", at: "2026-11-27" },
    { topicId: "zz", actorId: "x", actorName: "Xena", kind: "opinion", at: "2026-11-27" },
  ], { userId: "me" });
  assert.deepEqual(r.map((t) => [t.id, t.followReason]), [
    ["a", "Xena shared an opinion"], ["b", "Yuri shared an opinion"], ["c", "Xena started this topic"],
  ]);
  assert.equal(r[1].followExcerpt, "UBI works");
  assert.deepEqual(rankFollowing(topics, [], { userId: "me" }), []);
});
