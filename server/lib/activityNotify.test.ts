// Trigger-rule integration test for activity notifications (run: npm run test:notify).
// Needs a LOCAL seeded database (DATABASE_URL on localhost with users u-alice/u-bob/u-carol/u-dave and topic 1111…);
// skipped anywhere else so it can never touch production.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';

const local = /@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL || '');
const TOPIC = '11111111-1111-1111-1111-111111111111'; // created by u-alice

test('activity notification triggers', { skip: !local && 'needs a local DATABASE_URL' }, async (t) => {
  const { db } = await import('../db.js');
  const { notifications, users } = await import('../../shared/schema.js');
  const { and, eq, like } = await import('drizzle-orm');
  const { notifyActivity } = await import('./activityNotify.js');
  const mine = () => db.select().from(notifications).where(and(eq(notifications.userId, 'u-alice'), like(notifications.groupKey, `%${TOPIC}%`)));
  const reset = async () => {
    await db.delete(notifications).where(like(notifications.groupKey, `%${TOPIC}%`));
    await db.update(users).set({ notificationPrefs: {} }).where(eq(users.id, 'u-alice'));
  };
  await reset();
  after(reset);
  const opinionOn = (actorId: string) => notifyActivity({ type: 'topic_opinion', recipientId: 'u-alice', actorId, targetId: TOPIC, topicId: TOPIC, linkUrl: `/topic/${TOPIC}` });

  await t.test('your own opinion on your own topic: nothing', async () => {
    assert.equal(await opinionOn('u-alice'), null);
    assert.equal((await mine()).length, 0);
  });

  await t.test('a burst from three people collapses into one unread row', async () => {
    await opinionOn('u-bob'); await opinionOn('u-carol'); await opinionOn('u-bob'); await opinionOn('u-dave');
    const rows = await mine();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].title, '3 new opinions on your topic');
    assert.match(rows[0].message, /and 2 others weighed in/);
    assert.equal(rows[0].linkUrl, `/topic/${TOPIC}`);
  });

  await t.test('after reading it, the next one starts a fresh row', async () => {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, 'u-alice'));
    await opinionOn('u-carol');
    const rows = (await mine()).filter((r) => !r.isRead);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].title, 'New opinion on your topic');
  });

  await t.test('switched off: nothing', async () => {
    await db.update(users).set({ notificationPrefs: { topicOpinions: false } }).where(eq(users.id, 'u-alice'));
    const before = (await mine()).length;
    assert.equal(await opinionOn('u-dave'), null);
    assert.equal((await mine()).length, before);
  });

  await t.test('like milestone only once, even after unlike + re-like', async () => {
    const m = () => notifyActivity({ type: 'like_milestone', recipientId: 'u-alice', actorId: 'u-bob', likes: 5, targetId: TOPIC, topicId: TOPIC, linkUrl: '/x' });
    assert.ok(await m());
    assert.equal(await m(), null);
  });
});
