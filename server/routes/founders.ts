import { Router, type Request } from 'express';
import { createHash } from 'crypto';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db.js';
import { isAuthenticated, requireAdmin } from '../middleware/auth.js';
import { getSiteConfig, setSiteSetting } from '../lib/siteSettings.js';
import { scoreByRubric, scoreWithAI, isBestPick, fingerprint, type ApplicationAnswers } from '../lib/applicationScoring.js';
import { createInviteCode, lookupInviteCode, normalizeCode } from '../lib/invites.js';
import { listPublicDebates } from '../lib/debateWatch.js';
import { clientIp } from '../lib/clientIp.js';
import {
  APPLICATION_STATUSES, FREQUENCY_OPTIONS, INTEREST_AREAS, POLITICS_OPTIONS, RELIGION_OPTIONS, STEELMAN_PROMPTS,
  PASS_LOCKED_MESSAGE, PASS_PREMIUM_MONTHS, buildAcceptanceMessage, inviteLink, politicsBucket, religionBucket, type RubricScores,
} from '../../shared/founders.js';

// Founding members (Fuller Feuds Dev, Nov 20 2026): site switches, /apply, admin review, invite codes,
// Founders' Room and the Saturday showcase. Mounted from routes/index.ts.

const rows = (r: any) => (r.rows ?? r) as any[];
const siteOrigin = (req: Request) =>
  process.env.NODE_ENV === 'production' ? 'https://www.fullerfeuds.com' : `${req.protocol}://${req.get('host')}`;
const hashIp = (ip: string) => createHash('sha256').update(`${ip}|${process.env.SESSION_SECRET || 'ff'}`).digest('hex').slice(0, 32);
const cleanRef = (v: unknown) => String(v ?? '').trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 80) || null;
const sum = (s: RubricScores) => Object.values(s).reduce((n, v) => n + v, 0);

function limiter(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (key: string) => {
    const now = Date.now();
    const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (list.length >= max) { hits.set(key, list); return false; }
    list.push(now); hits.set(key, list);
    if (hits.size > 5000) hits.clear();
    return true;
  };
}
const allowApplication = limiter(3, 60 * 60 * 1000);
const allowCodeCheck = limiter(30, 10 * 60 * 1000);
const allowRoomPost = limiter(10, 10 * 60 * 1000);
const allowWaitlist = limiter(5, 60 * 60 * 1000);

async function audit(moderatorId: string, actionType: string, targetType: string, targetId: string, reason: string) {
  await db.execute(sql`
    insert into moderation_actions (moderator_id, action_type, target_type, target_id, reason)
    values (${moderatorId}, ${actionType}, ${targetType}, ${targetId}, ${reason})`).catch(() => {});
}

// ---------------------------------------------------------------------------------------------------
// Public
export const publicFoundersRouter = Router();

// GET /api/site-config — switches the client needs (invite-only sign-up, public launch).
publicFoundersRouter.get('/site-config', async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(await getSiteConfig());
});

// GET /api/invites/check?code= — lets the sign-up form say whether a code works before submitting.
publicFoundersRouter.get('/invites/check', async (req, res) => {
  if (!allowCodeCheck(clientIp(req))) return res.status(429).json({ valid: false, message: 'Too many tries. Wait a few minutes.' });
  const row = await lookupInviteCode(normalizeCode(req.query.code));
  const usable = !!row && !row.used_at && !row.revoked_at;
  // A founder's launch pass only works once the site has publicly launched.
  const isPass = row?.kind === 'founder';
  const { publicLaunch } = await getSiteConfig();
  if (usable && isPass && !publicLaunch) {
    return res.json({ valid: false, locked: true, kind: 'pass', message: PASS_LOCKED_MESSAGE });
  }
  res.json({
    valid: usable, locked: false, kind: isPass ? 'pass' : 'invite',
    message: usable
      ? (isPass ? `Launch pass accepted: ${PASS_PREMIUM_MONTHS} months of premium free` : 'Invite code accepted')
      : row ? 'That code has already been used' : "That code isn't valid",
  });
});

// POST /api/waitlist { email, inviteCode? } — pass holders (or anyone) leave an email to hear about public launch.
const waitlistSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(254),
  inviteCode: z.string().max(40).optional().nullable(),
});
publicFoundersRouter.post('/waitlist', async (req, res) => {
  const parsed = waitlistSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Enter a valid email' });
  if (!allowWaitlist(clientIp(req))) return res.status(429).json({ message: 'Too many tries. Please try again later.' });
  const code = parsed.data.inviteCode ? await lookupInviteCode(normalizeCode(parsed.data.inviteCode)) : null;
  const codeId = code && !code.used_at && !code.revoked_at ? code.id : null;
  await db.execute(sql`
    insert into launch_waitlist (email, invite_code_id, source)
    values (${parsed.data.email}, ${codeId}, ${codeId ? 'launch_pass' : 'waitlist'})
    on conflict (lower(email)) do update set invite_code_id = coalesce(launch_waitlist.invite_code_id, excluded.invite_code_id)`);
  res.status(201).json({ ok: true, message: "You're on the list. We'll email you when your pass unlocks." });
});

const applicationSchema = z.object({
  displayName: z.string().trim().min(2, 'Add your name').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(254),
  ref: z.string().max(120).optional().nullable(),
  heardAbout: z.string().trim().max(300).optional().nullable(),
  whereDebate: z.string().trim().max(1000).optional().nullable(),
  profileLinks: z.string().trim().max(1000).optional().nullable(),
  interests: z.array(z.enum(INTEREST_AREAS)).min(1, 'Pick at least one interest').max(3, 'Pick up to 3 interests'),
  politics: z.enum(POLITICS_OPTIONS).optional().nullable(),
  religion: z.enum(RELIGION_OPTIONS).optional().nullable(),
  steelmanPrompt: z.enum(STEELMAN_PROMPTS),
  steelman: z.string().trim().min(40, 'Your steelman needs a little more (aim for about 150 words)').max(4000),
  mindChange: z.string().trim().min(20, 'Tell us a bit more about changing your mind').max(3000),
  frequency: z.enum(FREQUENCY_OPTIONS.map((f) => f.value) as [string, ...string[]]),
  is18Plus: z.literal(true, { errorMap: () => ({ message: 'Founding members must be 18 or older' }) }),
  pledge: z.literal(true, { errorMap: () => ({ message: "Please agree to the founders' pledge" }) }),
  website: z.string().max(0).optional(), // honeypot: real people never fill this hidden field
});

// POST /api/applications — public founding-member application.
publicFoundersRouter.post('/applications', async (req, res) => {
  const parsed = applicationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Please check the form' });
  if (!allowApplication(clientIp(req))) return res.status(429).json({ message: 'Too many applications from this network. Please try again later.' });
  const a = parsed.data;
  try {
    const dup = rows(await db.execute(sql`
      select id from founder_applications where lower(email) = ${a.email} and status in ('new', 'accepted', 'waitlisted') limit 1`));
    if (dup.length) return res.status(409).json({ message: "We already have an application from this email. We'll be in touch." });

    const answers: ApplicationAnswers = {
      displayName: a.displayName, email: a.email, whereDebate: a.whereDebate, profileLinks: a.profileLinks,
      steelman: a.steelman, mindChange: a.mindChange, frequency: a.frequency,
    };
    const rubric = scoreByRubric(answers);
    const inserted = rows(await db.execute(sql`
      insert into founder_applications (
        display_name, email, ref_source, heard_about, where_debate, profile_links, interests, politics, religion,
        steelman_prompt, steelman, mind_change, frequency, is_18_plus, pledge_agreed, ip_hash, user_agent,
        suggested_scores, suggested_total, red_flags, score_method, ai_notes
      ) values (
        ${a.displayName}, ${a.email}, ${cleanRef(a.ref)}, ${a.heardAbout || null}, ${a.whereDebate || null}, ${a.profileLinks || null},
        ${sql.raw(`ARRAY[${a.interests.map((i) => `'${i.replace(/'/g, "''")}'`).join(',')}]::text[]`)},
        ${a.politics || null}, ${a.religion || null}, ${a.steelmanPrompt}, ${a.steelman}, ${a.mindChange}, ${a.frequency},
        true, true, ${hashIp(clientIp(req))}, ${String(req.headers['user-agent'] || '').slice(0, 500) || null},
        ${JSON.stringify({ rubric: rubric.scores, ai: null })}::jsonb, ${rubric.total},
        ${sql.raw(`ARRAY[${rubric.redFlags.concat(rubric.notes.map((n) => `Note: ${n}`)).map((f) => `'${f.replace(/'/g, "''")}'`).join(',')}]::text[]`)},
        'rubric', null
      ) returning id`));
    const id = inserted[0].id as string;
    res.status(201).json({ id });

    // Optional AI second opinion, after the response. Failures (no key, no credits) keep the rubric scores.
    void scoreWithAI(answers, a.steelmanPrompt).then(async (ai) => {
      if (!ai) return;
      await db.execute(sql`
        update founder_applications set
          suggested_scores = jsonb_set(coalesce(suggested_scores, '{}'::jsonb), '{ai}', ${JSON.stringify(ai.scores)}::jsonb),
          suggested_total = ${sum(ai.scores)}, score_method = 'ai', ai_notes = ${ai.notes}
        where id = ${id}`);
    }).catch(() => {});
  } catch (e) {
    console.error('Error saving application:', e);
    res.status(500).json({ message: 'Could not save your application. Please try again.' });
  }
});

// ---------------------------------------------------------------------------------------------------
// Founders (and admins)
export const foundersRouter = Router();
foundersRouter.use(isAuthenticated, (req, res, next) => {
  const u = req.user as any;
  if (u?.founderNumber != null || u?.role === 'admin') return next();
  return res.status(403).json({ message: "The Founders' Room is for founding members" });
});

// GET /api/founders/me — founder number and my invite codes.
foundersRouter.get('/me', async (req, res) => {
  const u = req.user as any;
  const codes = rows(await db.execute(sql`
    select c.code, c.kind, c.used_at, c.revoked_at, u.handle as used_by_handle
    from invite_codes c left join users u on u.id = c.used_by_user_id
    where c.owner_user_id = ${u.id} order by c.created_at`));
  const { publicLaunch } = await getSiteConfig();
  res.json({
    founderNumber: u.founderNumber ?? null,
    publicLaunch,
    passPremiumMonths: PASS_PREMIUM_MONTHS,
    codes: codes.map((c) => ({
      code: c.code, isPass: c.kind === 'founder', link: inviteLink(siteOrigin(req), c.code),
      used: !!c.used_by_handle || !!c.used_at, usedByHandle: c.used_by_handle ?? null, revoked: !!c.revoked_at,
    })),
  });
});

// GET /api/founders/room — newest first.
foundersRouter.get('/room', async (_req, res) => {
  const posts = rows(await db.execute(sql`
    select p.id, p.body, p.created_at, u.id as user_id, u.handle, u.first_name, u.profile_image_url, u.founder_number, u.role
    from founder_posts p join users u on u.id = p.user_id
    order by p.created_at desc limit 200`));
  res.set('Cache-Control', 'no-store');
  res.json(posts.map((p) => ({
    id: p.id, body: p.body, createdAt: p.created_at,
    author: { id: p.user_id, handle: p.handle, firstName: p.first_name, avatar: p.profile_image_url, founderNumber: p.founder_number, isAdmin: p.role === 'admin' },
  })));
});

foundersRouter.post('/room', async (req, res) => {
  const body = String(req.body?.body ?? '').trim();
  if (body.length < 2 || body.length > 2000) return res.status(400).json({ message: 'Posts are 2 to 2,000 characters' });
  const u = req.user as any;
  if (!allowRoomPost(u.id)) return res.status(429).json({ message: 'Slow down a little and try again in a few minutes' });
  const [row] = rows(await db.execute(sql`insert into founder_posts (user_id, body) values (${u.id}, ${body}) returning id`));
  res.status(201).json({ id: row.id });
});

foundersRouter.delete('/room/:id', async (req, res) => {
  const u = req.user as any;
  const r = rows(await db.execute(sql`
    delete from founder_posts where id = ${req.params.id} and (user_id = ${u.id} or ${u.role === 'admin'}) returning id`));
  if (!r.length) return res.status(404).json({ message: 'Post not found' });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------------------------------
// Admin
export const adminFoundersRouter = Router();
adminFoundersRouter.use(requireAdmin);

adminFoundersRouter.get('/settings', async (_req, res) => {
  const stats = rows(await db.execute(sql`
    select
      (select count(*)::int from users where founder_number is not null) as founders,
      (select coalesce(max(founder_number), 0)::int from users) as last_number,
      (select count(*)::int from founder_applications where status = 'new') as pending`))[0];
  res.json({ ...(await getSiteConfig()), stats });
});

const settingsSchema = z.object({ foundingMode: z.boolean().optional(), publicLaunch: z.boolean().optional() });
adminFoundersRouter.put('/settings', async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success || (parsed.data.foundingMode === undefined && parsed.data.publicLaunch === undefined)) {
    return res.status(400).json({ message: 'Nothing to change' });
  }
  const me = req.user!.id;
  let cfg = await getSiteConfig();
  if (parsed.data.foundingMode !== undefined) {
    cfg = await setSiteSetting('foundingMode', parsed.data.foundingMode, me);
    await audit(me, 'site_setting', 'site', 'founding_mode', `Founding mode → ${parsed.data.foundingMode ? 'on' : 'off'}`);
  }
  if (parsed.data.publicLaunch !== undefined) {
    const wasLaunched = cfg.publicLaunch;
    cfg = await setSiteSetting('publicLaunch', parsed.data.publicLaunch, me);
    await audit(me, 'site_setting', 'site', 'public_launch', `Public launch → ${parsed.data.publicLaunch ? 'on' : 'off'}`);
    // Launch day: founders' lifetime ad-free switches on (they can still turn ads back on in Settings).
    if (parsed.data.publicLaunch && !wasLaunched) {
      await db.execute(sql`update users set ad_free = true, updated_at = now() where founder_lifetime_ad_free = true and coalesce(ad_free, false) = false`);
    }
  }
  res.json(cfg);
});

// GET /api/admin/founders/applications — every application with suggested scores, flags, code and mix.
adminFoundersRouter.get('/applications', async (req, res) => {
  const list = rows(await db.execute(sql`
    select a.*, c.code as invite_code, c.used_at as code_used_at, c.revoked_at as code_revoked_at,
           cu.handle as code_used_by_handle, cu.founder_number as code_used_by_founder_number,
           rv.handle as reviewed_by_handle
    from founder_applications a
    left join invite_codes c on c.id = a.invite_code_id
    left join users cu on cu.id = c.used_by_user_id
    left join users rv on rv.id = a.reviewed_by_id
    order by a.created_at desc limit 1000`));

  // Duplicate signals computed on read: same network (hashed IP) or near-identical steelman.
  const byIp = new Map<string, number>();
  const byPrint = new Map<string, number>();
  for (const a of list) {
    if (a.ip_hash) byIp.set(a.ip_hash, (byIp.get(a.ip_hash) || 0) + 1);
    const fp = fingerprint(a.steelman || '');
    if (fp) byPrint.set(fp, (byPrint.get(fp) || 0) + 1);
  }
  const origin = siteOrigin(req);
  const items = list.map((a) => {
    const stored: string[] = a.red_flags || [];
    const redFlags = stored.filter((f) => !f.startsWith('Note: '));
    const notes = stored.filter((f) => f.startsWith('Note: ')).map((f) => f.slice(6));
    if ((byPrint.get(fingerprint(a.steelman || '')) || 0) > 1) redFlags.push('Steelman nearly identical to another application');
    const total = a.admin_score ?? a.suggested_total ?? 0;
    const bestPick = a.status === 'new' && isBestPick(total, redFlags);
    // Shared network is only a warning (households and campuses share IPs), so it doesn't remove a best pick.
    if (a.ip_hash && (byIp.get(a.ip_hash) || 0) > 1) redFlags.push('Several applications from the same network');
    return {
      id: a.id, displayName: a.display_name, email: a.email, refSource: a.ref_source, heardAbout: a.heard_about,
      whereDebate: a.where_debate, profileLinks: a.profile_links, interests: a.interests || [], politics: a.politics, religion: a.religion,
      steelmanPrompt: a.steelman_prompt, steelman: a.steelman, mindChange: a.mind_change, frequency: a.frequency,
      suggested: a.suggested_scores, suggestedTotal: a.suggested_total, scoreMethod: a.score_method, aiNotes: a.ai_notes,
      adminScore: a.admin_score, adminNote: a.admin_note, status: a.status, redFlags, notes,
      bestPick,
      createdAt: a.created_at, reviewedAt: a.reviewed_at, reviewedBy: a.reviewed_by_handle,
      invite: a.invite_code ? {
        code: a.invite_code, link: inviteLink(origin, a.invite_code), usedAt: a.code_used_at, revoked: !!a.code_revoked_at,
        usedByHandle: a.code_used_by_handle, founderNumber: a.code_used_by_founder_number,
        message: buildAcceptanceMessage({ name: a.display_name, code: a.invite_code, origin }),
      } : null,
    };
  });
  // Sort: best picks first, then by score, then newest.
  items.sort((x, y) => Number(y.bestPick) - Number(x.bestPick) || ((y.adminScore ?? y.suggestedTotal ?? 0) - (x.adminScore ?? x.suggestedTotal ?? 0)));

  const tally = (subset: typeof items) => {
    const politics = { left: 0, right: 0, center: 0, unknown: 0 };
    const religion = { religious: 0, nonreligious: 0, unsure: 0, unknown: 0 };
    for (const a of subset) { politics[politicsBucket(a.politics)]++; religion[religionBucket(a.religion)]++; }
    return { count: subset.length, politics, religion };
  };
  const counts = Object.fromEntries(APPLICATION_STATUSES.map((s) => [s, items.filter((a) => a.status === s).length]));
  res.json({
    items, counts,
    mix: { accepted: tally(items.filter((a) => a.status === 'accepted')), bestPicks: tally(items.filter((a) => a.bestPick)) },
  });
});

const reviewSchema = z.object({
  status: z.enum(APPLICATION_STATUSES).optional(),
  adminScore: z.number().int().min(0).max(15).nullable().optional(),
  adminNote: z.string().max(2000).nullable().optional(),
});

// PATCH /api/admin/founders/applications/:id — Timothy's decision. Accept creates the invite code.
adminFoundersRouter.patch('/applications/:id', async (req, res) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid request' });
  const me = req.user!.id;
  const [app] = rows(await db.execute(sql`select * from founder_applications where id = ${req.params.id}`));
  if (!app) return res.status(404).json({ message: 'Application not found' });
  const d = parsed.data;
  try {
    let codeId: string | null = app.invite_code_id;
    let code: string | null = null;
    if (d.status === 'accepted') {
      if (codeId) {
        // Re-accepting: un-revoke an unused code instead of minting a second one.
        const [c] = rows(await db.execute(sql`update invite_codes set revoked_at = null where id = ${codeId} and used_at is null returning code`));
        code = c?.code ?? rows(await db.execute(sql`select code from invite_codes where id = ${codeId}`))[0]?.code ?? null;
      } else {
        const c = await createInviteCode({ kind: 'acceptance', createdById: me, applicationId: app.id, note: `Application: ${app.display_name}`.slice(0, 200) });
        codeId = c.id; code = c.code;
      }
    } else if (d.status && codeId) {
      await db.execute(sql`update invite_codes set revoked_at = now() where id = ${codeId} and used_at is null`);
    }
    await db.execute(sql`
      update founder_applications set
        status = coalesce(${d.status ?? null}, status),
        admin_score = ${d.adminScore === undefined ? sql`admin_score` : d.adminScore},
        admin_note = ${d.adminNote === undefined ? sql`admin_note` : d.adminNote},
        invite_code_id = ${codeId},
        reviewed_by_id = ${d.status ? me : sql`reviewed_by_id`},
        reviewed_at = ${d.status ? sql`now()` : sql`reviewed_at`}
      where id = ${app.id}`);
    if (d.status) await audit(me, 'review_application', 'founder_application', app.id, `Application → ${d.status}`);
    const origin = siteOrigin(req);
    res.json({
      ok: true,
      invite: code ? { code, link: inviteLink(origin, code), message: buildAcceptanceMessage({ name: app.display_name, code, origin }) } : null,
    });
  } catch (e) {
    console.error('Error reviewing application:', e);
    res.status(500).json({ message: 'Could not save the decision' });
  }
});

// POST /api/admin/founders/applications/:id/rescore — retry the AI pass (keeps rubric scores if it fails).
adminFoundersRouter.post('/applications/:id/rescore', async (req, res) => {
  const [a] = rows(await db.execute(sql`select * from founder_applications where id = ${req.params.id}`));
  if (!a) return res.status(404).json({ message: 'Application not found' });
  const ai = await scoreWithAI({
    displayName: a.display_name, email: a.email, whereDebate: a.where_debate, profileLinks: a.profile_links,
    steelman: a.steelman, mindChange: a.mind_change, frequency: a.frequency,
  }, a.steelman_prompt);
  if (!ai) return res.json({ ok: false, message: "AI scoring isn't available right now (check OpenAI credits). Rubric scores kept." });
  await db.execute(sql`
    update founder_applications set
      suggested_scores = jsonb_set(coalesce(suggested_scores, '{}'::jsonb), '{ai}', ${JSON.stringify(ai.scores)}::jsonb),
      suggested_total = ${sum(ai.scores)}, score_method = 'ai', ai_notes = ${ai.notes}
    where id = ${a.id}`);
  res.json({ ok: true });
});

// Invite codes (admin-issued for Timothy's own network, plus every code for the invite tree).
adminFoundersRouter.get('/codes', async (_req, res) => {
  const list = rows(await db.execute(sql`
    select c.id, c.code, c.kind, c.note, c.used_at, c.revoked_at, c.created_at,
           o.handle as owner_handle, o.founder_number as owner_founder_number, u.handle as used_by_handle, u.founder_number as used_by_founder_number
    from invite_codes c
    left join users o on o.id = c.owner_user_id
    left join users u on u.id = c.used_by_user_id
    order by c.created_at desc limit 500`));
  res.json(list.map((c) => ({
    id: c.id, code: c.code, kind: c.kind, note: c.note, usedAt: c.used_at, revoked: !!c.revoked_at, createdAt: c.created_at,
    ownerHandle: c.owner_handle, ownerFounderNumber: c.owner_founder_number, usedByHandle: c.used_by_handle, usedByFounderNumber: c.used_by_founder_number,
  })));
});

adminFoundersRouter.post('/codes', async (req, res) => {
  const note = String(req.body?.note ?? '').trim().slice(0, 200) || null;
  const c = await createInviteCode({ kind: 'admin', createdById: req.user!.id, note });
  await audit(req.user!.id, 'create_invite_code', 'invite_code', c.id, note ? `Invite code for ${note}` : 'Invite code');
  const origin = siteOrigin(req);
  res.status(201).json({ code: c.code, link: inviteLink(origin, c.code), message: buildAcceptanceMessage({ name: note || '', code: c.code, origin }) });
});

adminFoundersRouter.post('/codes/:id/revoke', async (req, res) => {
  const r = rows(await db.execute(sql`update invite_codes set revoked_at = now() where id = ${req.params.id} and used_at is null returning id`));
  if (!r.length) return res.status(400).json({ message: 'Only unused codes can be revoked' });
  await audit(req.user!.id, 'revoke_invite_code', 'invite_code', req.params.id, 'Revoked invite code');
  res.json({ ok: true });
});

// Launch waitlist (pass holders who tried before public launch). No email provider: Timothy contacts them by hand.
adminFoundersRouter.get('/waitlist', async (_req, res) => {
  const list = rows(await db.execute(sql`
    select w.id, w.email, w.source, w.created_at, c.code, o.handle as pass_owner_handle, o.founder_number as pass_owner_founder_number
    from launch_waitlist w
    left join invite_codes c on c.id = w.invite_code_id
    left join users o on o.id = c.owner_user_id
    order by w.created_at desc limit 1000`));
  res.json(list.map((w) => ({
    id: w.id, email: w.email, source: w.source, createdAt: w.created_at, code: w.code ?? null,
    passOwnerHandle: w.pass_owner_handle ?? null, passOwnerFounderNumber: w.pass_owner_founder_number ?? null,
  })));
});

// Showcase: feature a public debate on /live.
adminFoundersRouter.get('/showcase', async (_req, res) => {
  const [live, finished] = await Promise.all([listPublicDebates('live', 30), listPublicDebates('finished', 20)]);
  res.json({ live, finished });
});
adminFoundersRouter.put('/showcase/:roomId', async (req, res) => {
  const on = req.body?.isShowcase === true;
  const r = rows(await db.execute(sql`update debate_rooms set is_showcase = ${on} where id = ${req.params.roomId} returning id`));
  if (!r.length) return res.status(404).json({ message: 'Debate not found' });
  await audit(req.user!.id, 'showcase_debate', 'debate_room', req.params.roomId, on ? 'Featured as showcase' : 'Removed from showcase');
  res.json({ ok: true, isShowcase: on });
});
