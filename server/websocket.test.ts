// Multi-client smoke test for the /ws server (run: npm run test:ws). No database needed: the session
// lookup is replaced with a fake that reads `uid=<id>` from the cookie header.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'http';
import WebSocket from 'ws';
import { setupWebSocketServer, sendToUser, broadcastToUsers, __setSessionResolverForTests } from './websocket.js';

__setSessionResolverForTests(async (req) => {
  const m = /uid=([\w-]+)/.exec(String(req.headers.cookie || ''));
  return m ? m[1] : null;
});

const server = createServer();
const wss = setupWebSocketServer(server);
await new Promise<void>((r) => server.listen(0, r));
const port = (server.address() as any).port;
after(() => { wss.close(); server.close(); });

function client(uid?: string) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { headers: uid ? { cookie: `uid=${uid}` } : {} });
  const inbox: any[] = [];
  ws.on('message', (d) => inbox.push(JSON.parse(String(d))));
  const opened = new Promise<void>((res, rej) => { ws.once('open', () => res()); ws.once('error', rej); });
  const waitFor = async (pred: (m: any) => boolean, ms = 2000) => {
    const start = Date.now();
    while (Date.now() - start < ms) {
      const hit = inbox.find(pred);
      if (hit) return hit;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error('timed out waiting for message; got ' + JSON.stringify(inbox));
  };
  return { ws, inbox, opened, waitFor };
}

async function signedIn(uid: string) {
  const c = client(uid);
  await c.opened;
  c.ws.send(JSON.stringify({ type: 'authenticate' }));
  await c.waitFor((m) => m.type === 'authenticated' && m.userId === uid);
  return c;
}

test('three users, multiple tabs: each gets only their own messages', async () => {
  const a1 = await signedIn('alice'), a2 = await signedIn('alice'), b = await signedIn('bob'), c = await signedIn('carol');
  sendToUser('alice', { type: 'debate_update', kind: 'message', n: 1 });
  broadcastToUsers(['bob', 'carol'], { type: 'debate_update', kind: 'turn', n: 2 });
  await a1.waitFor((m) => m.n === 1);
  await a2.waitFor((m) => m.n === 1);
  await b.waitFor((m) => m.n === 2);
  await c.waitFor((m) => m.n === 2);
  assert.equal(b.inbox.some((m) => m.n === 1), false);
  [a1, a2, b, c].forEach((x) => x.ws.close());
});

test('garbage, oversized and unauthenticated messages never take the server down', async () => {
  const bad = client();
  await bad.opened;
  bad.ws.send('not json {');
  bad.ws.send(JSON.stringify(null));
  bad.ws.send(JSON.stringify({ type: 'typing', debateRoomId: 'x', isTyping: true }));
  await bad.waitFor((m) => m.type === 'error');
  await bad.waitFor((m) => m.type === 'auth_error');
  const big = client();
  await big.opened;
  const closed = new Promise<number>((r) => big.ws.once('close', (code) => r(code)));
  big.ws.send('x'.repeat(200 * 1024));
  assert.equal(await closed, 1009); // too big: that socket is closed, nobody else is affected
  const ok = await signedIn('dave'); // server still serves new users
  ok.ws.close(); bad.ws.close();
});

test('a socket signing in without a session is refused cleanly', async () => {
  const anon = client();
  await anon.opened;
  const closed = new Promise<number>((r) => anon.ws.once('close', (code) => r(code)));
  anon.ws.send(JSON.stringify({ type: 'authenticate' }));
  assert.equal(await closed, 1008);
});

test('broadcasting while sockets drop mid-send does not throw', async () => {
  const users = await Promise.all(Array.from({ length: 10 }, (_, i) => signedIn('erin')));
  users.slice(0, 5).forEach((u) => u.ws.terminate());
  for (let i = 0; i < 50; i++) sendToUser('erin', { type: 'debate_update', kind: 'message', i });
  await users[9].waitFor((m) => m.i === 49);
  users.forEach((u) => u.ws.close());
});
