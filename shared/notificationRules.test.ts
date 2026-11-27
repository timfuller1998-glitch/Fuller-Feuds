import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldNotify, isLikeMilestone, groupKeyFor, mergeActors, describe, prefKeyFor } from './notificationRules.js';

test('never notifies you about your own action', () => {
  assert.equal(shouldNotify('topic_opinion', 'u1', 'u1'), false);
  assert.equal(shouldNotify('opinion_counterpoint', 'u1', 'u1', {}), false);
  assert.equal(shouldNotify('topic_opinion', 'u2', 'u1'), true);
});

test('needs a recipient', () => {
  assert.equal(shouldNotify('topic_opinion', 'u2', null), false);
  assert.equal(shouldNotify('topic_opinion', 'u2', ''), false);
});

test('per-type switches: off blocks, missing means on', () => {
  assert.equal(shouldNotify('topic_opinion', 'u2', 'u1', { topicOpinions: false }), false);
  assert.equal(shouldNotify('opinion_counterpoint', 'u2', 'u1', { topicOpinions: false }), true);
  assert.equal(shouldNotify('like_milestone', null, 'u1', { likes: true }), true);
  assert.equal(prefKeyFor('counterpoint_debate'), 'debates');
});

test('like milestones fire only on the milestone counts', () => {
  assert.deepEqual([1, 4, 5, 6, 10, 11, 25, 100].filter(isLikeMilestone), [5, 10, 25, 100]);
});

test('bursts collapse by key and count distinct people', () => {
  assert.equal(groupKeyFor('topic_opinion', 't1'), 'topic_opinion:t1');
  assert.equal(groupKeyFor('like_milestone', 'o1', 10), 'like_milestone:o1:10');
  let a = mergeActors([], 'u2');
  a = mergeActors(a, 'u3');
  a = mergeActors(a, 'u2'); // same person again doesn't inflate the count
  assert.deepEqual(a, ['u2', 'u3']);
});

test('collapsed wording', () => {
  assert.equal(describe('topic_opinion', { count: 1, name: 'Sam', topic: 'Tariffs' }).title, 'New opinion on your topic');
  const three = describe('topic_opinion', { count: 3, name: 'Sam', topic: 'Tariffs' });
  assert.equal(three.title, '3 new opinions on your topic');
  assert.equal(three.message, 'Sam and 2 others weighed in on "Tariffs".');
  assert.equal(describe('opinion_counterpoint', { count: 2, name: 'Jo', topic: 'X' }).message, 'Jo and 1 other answered your opinion on "X".');
  assert.equal(describe('like_milestone', { count: 1, name: '', topic: 'X', likes: 25 }).title, '25 likes');
});
