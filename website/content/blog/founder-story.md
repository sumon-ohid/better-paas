# Why I Built Better-PaaS After My Vercel Bill Surprised Me

*A founder story for Indie Hackers, Hacker News, or your company blog.*

---

## The moment I got tired of renting my own app

A few months ago I shipped a small side project. Next.js frontend, Node API, Postgres database. The kind of app indie hackers build every weekend.

I deployed it on Vercel because that is what you do. The deploy was instant. The preview URLs were magical. The dashboard felt like the future.

Then the project grew a little. More traffic. A few background jobs. A second database.

My free Hobby limits started tightening. I looked at the Pro plan, then at the add-on pricing, then at the bandwidth estimates. The math stopped being cute. I was going to pay more to host a side project than I paid for coffee in a month.

That is when it hit me: **I do not mind paying for servers. I mind paying rent for something I could own.**

## The self-hosting rabbit hole

So I looked at self-hosting.

First I tried a raw VPS. I learned more about systemd, Caddy, Docker networks, and SSL certificates than I ever wanted to. It worked, but every deploy felt like a small surgery.

Then I tried Coolify. It is great. But it felt built for teams and homelabs with a lot of surface area. I wanted something smaller, meaner, and focused on the solo-founder workflow: push code, get HTTPS, done.

I wanted the Vercel experience without the Vercel bill and without the platform lock-in.

## What I actually needed

I made a list of what mattered for a bootstrapped project:

1. **Push to deploy.** Connect a Git repo, pick a branch, done.
2. **Automatic HTTPS.** Add a domain and forget about certificates.
3. **Managed databases.** Postgres, Redis, MySQL without becoming a DBA.
4. **Rollbacks.** One click to the last working deploy.
5. **Flat cost.** One cheap VPS, many apps, no surprises.
6. **No lock-in.** My code, my server, my data.

Nothing I tried checked all six boxes without adding complexity I did not want.

So I started building Better-PaaS.

## What Better-PaaS is now

Better-PaaS is an open-source control plane you install on your own VPS. It turns a cheap Hetzner, DigitalOcean, or Linode server into your personal deployment platform.

- Connect a Git repo. Nixpacks detects your framework and builds it.
- Caddy handles routing and free Let&apos;s Encrypt certificates.
- Postgres, Redis, and MySQL are one-click containers on the same private network.
- Zero-downtime deploys with health checks.
- One-click rollbacks.
- Live logs and an in-browser terminal.

All on infrastructure you control.

It is not for everyone. If you need edge functions, global CDN auto-scaling, or serverless databases, Vercel is still the better tool. But if you are a solo founder with a full-stack app that fits on one server, Better-PaaS gives you the parts of Vercel that matter without the parts that bill you.

## What it costs

The control plane is free. AGPL-3.0 open source.

My own setup runs on a $5 Hetzner CX21. That server hosts three apps and two databases. My hosting bill is predictable. My data stays in Germany if I want it to. I can move the whole thing to another provider in an afternoon.

## Why I am sharing this

I built Better-PaaS because I needed it. I am sharing it because I think other indie hackers need it too.

If you are tired of surprise bills, platform lock-in, or over-engineering your deployment, I would love for you to try it.

The installer is one command. The dashboard has an interactive demo. The code is on GitHub.

**If this resonates, a GitHub star would mean a lot.** It helps more solo founders find an alternative to the platform tax.

- GitHub: https://github.com/sumon-ohid/better-paas
- Docs: https://better-paas.com/docs/quickstart
- Vercel comparison: https://better-paas.com/vercel-alternative

## A few honest notes

This is still early. There are bugs. There are rough edges. I fix them as fast as I can.

But the core promise works: you can own your deployment pipeline without becoming a DevOps engineer, and you can do it for the price of a cheap VPS.

Thanks for reading. If you have questions, I will be in the comments.
