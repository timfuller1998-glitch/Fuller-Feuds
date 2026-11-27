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

test("recommended skips own, answered and hidden topics and favours the user's categories", () => {
  const r = rankRecommended(topics, { userId: "me", answeredTopicIds: new Set(["d"]), categoryWeights: new Map([["Politics", 2]]), now });
  assert.deepEqual(r.map((t) => t.id), ["b", "c"]);
});

test("recommended falls back to popular/recent with no history", () => {
  const r = rankRecommended(topics, { userId: "me", answeredTopicIds: new Set(), categoryWeights: new Map(), now, limit: 2 });
  assert.deepEqual(r.map((t) => t.id), ["c", "d"]);
});

test("following keeps the latest activity per topic, newest first, excluding own topics", () => {
  const r = rankFollowing(topics, [
    { topicId: "b", actorId: "x", actorName: "Xena", kind: "created", at: "2026-10-01" },
    { topicId: "b", actorId: "y", actorName: "Yuri", kind: "opinion", at: "2026-11-27" },
    { topicId: "c", actorId: "x", actorName: "Xena", kind: "created", at: "2026-11-26" },
    { topicId: "a", actorId: "x", actorName: "Xena", kind: "opinion", at: "2026-11-27" },
    { topicId: "zz", actorId: "x", actorName: "Xena", kind: "opinion", at: "2026-11-27" },
  ], { userId: "me" });
  assert.deepEqual(r.map((t) => [t.id, t.followReason]), [["b", "Yuri shared an opinion"], ["c", "Xena started this topic"]]);
  assert.deepEqual(rankFollowing(topics, [], { userId: "me" }), []);
});
