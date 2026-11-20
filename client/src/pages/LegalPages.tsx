import type { ReactNode } from "react";
import { Link } from "wouter";
import { openFeedback } from "@/lib/feedback";

// Privacy Policy + Terms of Use (Fuller Feuds Dev, Nov 20 2026). Plain Editorial pages, public routes.
const UPDATED = "November 20, 2026";

function LegalShell({ title, testId, children }: { title: string; testId: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10" data-testid={testId}>
      <p className="font-ui text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Fuller Feuds</p>
      <h1 className="font-serif text-3xl sm:text-4xl font-bold mt-1">{title}</h1>
      <p className="text-sm text-muted-foreground mt-2">Last updated {UPDATED}</p>
      <div className="mt-6 space-y-6 leading-relaxed text-[0.95rem] [&_h2]:font-serif [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_a]:underline [&_a]:underline-offset-2 [&_p+p]:mt-2">
        {children}
      </div>
      <p className="mt-10 text-sm text-muted-foreground">
        <Link href="/privacy" data-testid="link-legal-privacy">Privacy Policy</Link>
        {" · "}
        <Link href="/terms" data-testid="link-legal-terms">Terms of Use</Link>
      </p>
    </div>
  );
}

function ContactLink({ children = "feedback form" }: { children?: ReactNode }) {
  return (
    <button type="button" className="underline underline-offset-2" onClick={() => openFeedback()} data-testid="button-legal-contact">
      {children}
    </button>
  );
}

export function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" testId="page-privacy">
      <section>
        <p>
          Fuller Feuds (“we”, “us”) is a debate community at fullerfeuds.com. This policy explains what we collect when you
          use the site, how we use it, and the choices you have.
        </p>
      </section>
      <section>
        <h2>Accounts</h2>
        <p>
          You can browse without an account. To post, vote or debate you create an account with an email address and a
          password (stored only as a secure hash). Your profile can include a name, a public display name and handle, a bio,
          a profile picture and your political-leaning settings. Your display name, handle, picture, badges, opinions,
          votes on topics and public debates are visible to other people. If you set a display name, your real name is not
          shown or searchable.
        </p>
      </section>
      <section>
        <h2>What we collect</h2>
        <ul>
          <li>Account details you give us (email, names, handle, picture, bio, preferences).</li>
          <li>Content you post: topics, opinions, counterpoints, debate messages, votes, reports and feedback.</li>
          <li>Activity used for features such as XP, badges, follows, notifications and trending lists.</li>
          <li>Push notification subscription details, only if you turn notifications on.</li>
          <li>Basic technical data our servers and hosting providers log (IP address, browser, pages requested) for security, rate limiting and troubleshooting.</li>
        </ul>
        <p>
          Some public content may be sent to an AI provider to generate topic summaries and moderation help. We do not sell
          your personal information. We do not use third-party analytics.
        </p>
      </section>
      <section id="applications">
        <h2>Founding-member applications and invites</h2>
        <p>
          If you apply at /apply we store your answers, your email, the link that brought you to us (for example a
          “ref” tag), and a one-way hash of your IP address to spot duplicate applications. The political and religious
          questions are optional; we use them only to keep the founding group balanced, they are seen only by the people
          reviewing applications, and they are never shown publicly. Your answers may be scored by simple rules and, when
          available, an AI provider to help us review them; a person makes every decision. Invite codes and launch passes record who invited
          whom. If you leave your email on the launch waitlist, we use it only to tell you when your pass unlocks. Ask us through the <ContactLink /> to delete your application.
        </p>
      </section>
      <section>
        <h2>Cookies and local storage</h2>
        <ul>
          <li><strong>Sign-in cookie</strong> (connect.sid): keeps you logged in. Strictly necessary.</li>
          <li><strong>Local storage</strong>: remembers your theme, recent searches and similar preferences on your device.</li>
          <li><strong>Advertising cookies</strong>: set by Google and its partners when ads are shown (see below).</li>
        </ul>
      </section>
      <section id="advertising">
        <h2>Advertising (Google AdSense)</h2>
        <p>
          We show ads served by Google AdSense. Third-party vendors, including Google, use cookies to serve ads based on
          your prior visits to this and other websites. Google’s use of advertising cookies enables it and its partners to
          serve ads to you based on your visits to this site and/or other sites on the Internet.
        </p>
        <p>
          You can opt out of personalized advertising in{" "}
          <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer" data-testid="link-google-ad-settings">Google Ads Settings</a>
          , or opt out of some third-party vendors’ use of cookies at{" "}
          <a href="https://www.aboutads.info/choices" target="_blank" rel="noopener noreferrer">aboutads.info</a>. Learn how Google uses information from
          sites that use its services at{" "}
          <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer" data-testid="link-google-partner-sites">
            How Google uses information from sites or apps that use our services
          </a>
          . Visitors in the EEA, UK and Switzerland are asked for consent through Google’s consent message before
          personalized ads are shown.
        </p>
        <p>Supporters can turn ads off for their account in Settings.</p>
      </section>
      <section>
        <h2>How we use information</h2>
        <p>
          To run the site and your account, show and rank content, award XP and badges, send notifications you asked for,
          keep the community safe (moderation, abuse and spam prevention), fix bugs and show ads.
        </p>
      </section>
      <section>
        <h2>Sharing</h2>
        <p>
          We share data only with providers that help run the site (hosting, database, email/push delivery, AI summaries
          and Google for ads), when required by law, or to protect users and the site.
        </p>
      </section>
      <section>
        <h2>Your choices</h2>
        <ul>
          <li>Edit your profile and preferences in Settings.</li>
          <li>Turn notifications off at any time in your browser or device.</li>
          <li>Ask us to export or delete your account and content using the <ContactLink />.</li>
        </ul>
        <p>We keep account data while your account is active and delete it on request, except where we must keep it for legal or safety reasons.</p>
      </section>
      <section>
        <h2>Children</h2>
        <p>
          Accounts and founding-member applications are for adults 18 and older. Fuller Feuds is not directed at children,
          and we do not knowingly collect information from anyone under 18. If you believe a minor has signed up or applied,
          tell us through the <ContactLink /> and we will remove their information.
        </p>
      </section>
      <section>
        <h2>Changes and contact</h2>
        <p>
          We will update this page when our practices change. Questions or requests? Reach us through the in-app{" "}
          <ContactLink /> (also in the sidebar under “Report a bug / idea”).
        </p>
      </section>
    </LegalShell>
  );
}

export function TermsPage() {
  return (
    <LegalShell title="Terms of Use" testId="page-terms">
      <section>
        <p>By using Fuller Feuds you agree to these terms. If you don’t agree, please don’t use the site.</p>
      </section>
      <section>
        <h2>Your account</h2>
        <p>
          You must be at least 18 years old to create an account, and you confirm this when you sign up. Founding members
          must also be 18 or older. Keep your password safe; you are responsible for activity on your account.
          Give accurate information and don’t impersonate anyone.
        </p>
      </section>
      <section>
        <h2>Your content</h2>
        <p>
          You own what you post. By posting, you give Fuller Feuds a worldwide, non-exclusive, royalty-free license to
          host, display, distribute and adapt it (for example in summaries, previews and feeds) to operate and promote the
          site. Public content can be seen by anyone.
        </p>
      </section>
      <section>
        <h2>Community rules</h2>
        <ul>
          <li>Argue the idea, not the person. No harassment, threats, hate speech or doxxing.</li>
          <li>No spam, scams, malware or manipulation of votes, XP or rankings.</li>
          <li>No illegal content or content that infringes someone else’s rights.</li>
          <li>Don’t try to break, overload or scrape the site.</li>
        </ul>
        <p>We may remove content, limit features or suspend accounts that break these rules.</p>
      </section>
      <section>
        <h2>Ads and supporters</h2>
        <p>
          The site is supported by ads (see the <Link href="/privacy#advertising">Privacy Policy</Link>). Any paid supporter
          features will be described when they are offered.
        </p>
      </section>
      <section>
        <h2>Disclaimers</h2>
        <p>
          Opinions on Fuller Feuds belong to the people who post them, not to us. AI summaries can be wrong. The site is
          provided “as is” without warranties, and to the extent allowed by law we are not liable for indirect or
          consequential damages from using it.
        </p>
      </section>
      <section>
        <h2>Changes and contact</h2>
        <p>
          We may update these terms; continuing to use the site means you accept the new version. Questions? Use the
          in-app <ContactLink />.
        </p>
      </section>
    </LegalShell>
  );
}
