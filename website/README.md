# BWW Website

Next.js 16 dashboard living directly inside the BWW repository.

## Local development

```bash
cd website
npm install
copy .env.example .env.local
npm run dev
```

Set the Supabase project URL and publishable key in `.env.local`.

## Vercel

Import the `teamluan/BWW` repository and set **Root Directory** to `website`. Vercel can then detect the Next.js app automatically.

Required environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Do not put the Supabase secret key into the website environment. The secret key belongs only to the bot/server environment.
