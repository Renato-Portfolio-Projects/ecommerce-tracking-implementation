# Accounts and domain checklist (v0.1)

Renato does everything that creates an account, spends money or publishes. Claude drafts, checks, and runs commands only after Renato approves each one.

## Rules for every step

- No payment card is entered anywhere except at the domain checkout. If any other signup asks for a card, stop and ask.
- Pick the Free plan explicitly wherever a plan choice appears.
- Decline every upsell and add-on.
- Turn on two-factor authentication for each new account.
- Use your personal logins, not a business email. This project stays separate through its own accounts inside each tool (see the table below), not through a different login.
- Write down what you actually see on screen. Where a screen differs from this list, correct this list afterwards.
- Keep IDs and tokens in your private notes, not in the repo. Public IDs (GTM container, GA4 measurement ID, Meta dataset ID) go into Vercel environment variables in v0.2.

## Which account goes where

The same personal Google login can stay in use. What keeps this project separate from any other one is a new account inside each tool.

| Tool | What you create | Sign in with | Section |
|---|---|---|---|
| Namecheap | Nothing new. Buy the domain in your existing account. | Your existing login | 2 |
| Vercel | A new project inside your existing account. | GitHub, as before | 4 |
| Google Tag Manager | A new account named "Second Impression Portfolio". | Your personal Google login | 5 |
| Google Analytics 4 | A new account with two properties, Live and Test. | Your personal Google login | 6 |
| Meta | Two datasets in your existing business portfolio. No ad account. | Your regular Meta login | 7 |
| Upstash | A new account on the Free plan. | Personal email or GitHub | Later (v0.2) |
| Stape | A new account on the Free plan. It can later hold a second container for another site. | Personal email | Later (v0.4) |

Because this project has its own GTM and GA4 accounts, an interviewer can be given read-only access to them without seeing anything else.

Sections 5 to 7 are needed at the start of version 0.2, when the first tracking is built. They are not part of version 0.1.

## 1. Trademark search

Not legal advice. This is a due-diligence check on the name.

- [x] Search "Second Impression" in the Canadian Trademarks Database (CIPO). Look at class 25 (clothing) and class 35 (retail store services). Done on 2026-09-19: no mark named Second Impression turned up.
- [x] Do the same in the USPTO trademark search. Done on 2026-09-19: no mark named Second Impression turned up. A close variant, "2nd Impression", has a record that is cancelled, so it is no longer in force.
- [x] If a live mark for clothing turns up, stop and talk it through with Claude before going further. None turned up.

This is a due-diligence check, not legal clearance. Trademark registers do not list a name that is in use but never registered.

## 2. Domain (Namecheap)

The domain is the one planned cost.

- [x] Chosen and bought: `secondimpression.ca`, on 2026-09-19. A registry check that day showed it unregistered.
- [x] Check availability and price again at the Namecheap checkout. Write down the year-one price and the renewal price. Done, confirmed by Renato on 2026-09-20: the renewal price is the same as the first-year price.
- [x] Keep any free privacy option offered. Decline the paid extras. Done, confirmed by Renato on 2026-09-20: no paid privacy extras are on.
- [x] Decide whether auto-renew is on. The domain has to stay registered for as long as the portfolio is in use. Done, confirmed by Renato on 2026-09-20: auto-renew is on, at the same price.
- [x] The price is recorded in `src/data/stack.ts`: USD 11.98 a year, which is Namecheap's price. Your card was charged CAD 16.78 after conversion. The renewal price is the same, so USD 11.98 is what the domain costs over time.

## 3. GitHub repository

Done on 2026-09-19, with the name, description and topics Renato approved. The `main` branch is protected: both CI checks have to pass before anything merges into it.

## 4. Vercel (Hobby plan)

Do not create a second Vercel account for this project. Vercel links one GitHub login to exactly one Vercel account, so connecting the same GitHub login to a second account unlinks the first account's projects and stops their automatic deploys. Add this site as a new project inside your existing account.

- [x] Sign in with GitHub.
- [x] Add a new project and import the repository. Framework preset: Astro. Leave the build settings on their defaults.
- [x] Add the environment variable `PUBLIC_SITE_URL` with the final `https://` address of the domain.
- [ ] Add the environment variable `PUBLIC_STORE_OPEN` with the value `true`, for the **Preview** environment only. Leave Production and Development unticked. Preview builds then show the whole store, and production keeps building only the placeholder page until v0.3 (consent) is merged and you decide to open it. Nothing about the switch is secret, and it costs nothing.
- [x] Deploy, and confirm the `*.vercel.app` address loads the placeholder page. Done: the project is `second-impression`.
- [x] In the project's Domains settings, add the domain. Use the DNS records Vercel shows for this project. Do not copy record values from another project. Done for `secondimpression.ca`, and for `www.secondimpression.ca`, which redirects permanently to it.
- [x] Add those records under Advanced DNS in Namecheap. Wait for Vercel to show the domain as valid, and confirm HTTPS works. Done: an A record for `@` and a CNAME record for `www`. The live site passed every check on 2026-09-19.
- [x] Confirm the account is on the Hobby plan and no card is on file. Done, confirmed by Renato on 2026-09-20.

## 5. Google Tag Manager (needed for 0.2)

- [ ] Create an account named "Second Impression Portfolio". Country: Canada.
- [ ] Create a web container named after the domain.
- [ ] Do not add the snippet to the site and do not publish anything. That starts in v0.2.
- [ ] Note the container ID (`GTM-` followed by letters and numbers).

## 6. Google Analytics 4 (needed for 0.2)

- [ ] Create an account named "Second Impression Portfolio".
- [ ] Create two properties: "Second Impression - Live" and "Second Impression - Test". Time zone: Toronto. Currency: Canadian dollar.
- [ ] Give each property a web data stream. Live uses the production domain. Test uses `http://localhost`.
- [ ] In each property, find the event data retention setting and set it to 14 months.
- [ ] Note both measurement IDs (`G-` followed by letters and numbers).

## 7. Meta (needed for 0.2)

- [ ] In Events Manager, create two datasets under the existing business portfolio: "Second Impression - Live" and "Second Impression - Test".
- [ ] Do not create an ad account for this project, and never run ads to this domain.
- [ ] Note both dataset IDs.

## 8. Not yet

These come later. Do not create them now.

- Stape, in v0.4.
- Upstash, in v0.2, when the back end is built.
