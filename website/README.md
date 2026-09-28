# BWW Website

Next.js 16 dashboard living directly inside the BWW repository.

## Local development

```bash
cd website
npm install
copy .env.example .env.local
npm run dev
```

## Environment

Public dashboard data:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Server-only administration:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `BWW_DASHBOARD_SECRET`

Never prefix server secrets with `NEXT_PUBLIC_`.

## Administration

Open `/settings`.

An administrator generates a temporary login code in Discord with:

```
/dashboard-code
```

The code is valid for 60 minutes. The website and Discord setup commands both write to `bww_guild_settings`, so there is one central configuration per Discord server.

The website currently manages:

- Welcome system
- Verify system
- Ticket system
- Status embed
- Command role permissions

Changes to the status channel are automatically picked up by the bot, which can create the status message in the newly selected channel.

## Vercel

Import the `teamluan/BWW` repository and set **Root Directory** to `website`. Add the environment variables above to the Vercel project.
