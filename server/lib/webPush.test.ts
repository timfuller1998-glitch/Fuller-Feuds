// Web Push send/prune rules (run: npm run test:notify). Needs a LOCAL seeded DB (u-alice); skipped elsewhere.
// The push service is stubbed: one device accepts, one answers 410 Gone and must be pruned, one 500 must be kept.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';

const local = /@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL || '');

test('web push sends to every device and prunes gone ones', { skip: !local && 'needs a local DATABASE_URL' }, async () => {
  process.env.VAPID_PUBLIC_KEY ||= 'BOp07Pm-u7klh1-GaefDP0xCH8QtLFdHEO2SlvNHMIg8Trim6hlUhEo5M5b4P3Hsf_iQtj-LyRssDqlt0YAOmpM';
  process.env.VAPID_PRIVATE_KEY ||= 'A'.repeat(43);
  const webPush = (await import('web-push')).default as any;
  const { db } = await import('../db.js');
  const { pushSubscriptions } = await import('../../shared/schema.js');
  const { eq, like } = await import('drizzle-orm');
  const { sendPush, urlFor, shouldPrune } = await import('./webPush.js');
  const clean = () => db.delete(pushSubscriptions).where(like(pushSubscriptions.endpoint, 'https://push.test/%'));
  await clean();
  after(clean);

  const sent: any[] = [];
  webPush.setVapidDetails = () => {};
  webPush.sendNotification = async (sub: any, body: string) => {
    if (sub.endpoint.endsWith('/gone')) throw Object.assign(new Error('gone'), { statusCode: 410 });
    if (sub.endpoint.endsWith('/flaky')) throw Object.assign(new Error('oops'), { statusCode: 500 });
    sent.push({ endpoint: sub.endpoint, body: JSON.parse(body) });
  };
  for (const e of ['ok', 'gone', 'flaky']) {
    await db.insert(pushSubscriptions).values({ userId: 'u-alice', endpoint: `https://push.test/${e}`, p256dh: 'k', auth: 'a' });
  }
  const n = await sendPush('u-alice', { title: '3 new opinions on your topic', body: 'Dave and 2 others…', url: '/topic/x', tag: 'topic_opinion:x' });
  assert.equal(n, 1);
  assert.equal(sent[0].body.tag, 'topic_opinion:x'); // a merged burst reuses the tag, so the phone replaces it
  assert.equal(sent[0].body.url, '/topic/x');
  const left = (await db.select().from(pushSubscriptions).where(like(pushSubscriptions.endpoint, 'https://push.test/%'))).map((r) => r.endpoint).sort();
  assert.deepEqual(left, ['https://push.test/flaky', 'https://push.test/ok']);
  assert.equal(urlFor({ debateRoomId: 'r1' }), '/debate-room/r1');
  assert.equal(urlFor({ linkUrl: '/topic/t', debateRoomId: 'r1' }), '/topic/t');
  assert.equal(shouldPrune(404), true);
  assert.equal(shouldPrune(429), false);
  void eq;
});
