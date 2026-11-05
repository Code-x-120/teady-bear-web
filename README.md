# 🧸 Teady Bear-MD — Web Frontend

**Live:** https://code-x-120.github.io/teady-bear-web/

Static pairing/landing site for the Teady Bear-MD WhatsApp bot.
**No bot code here** — sirf HTML/CSS/JS. Bot ka source private rehta hai.

## Files
- `index.html` — landing + connect page
- `style.css` — theme (dark/light)
- `app.js` — server select, pairing, status polling
- `config.json` — branding, servers, commands list
- `vercel.json` — static deploy config

## Deploy (Vercel)
1. Vercel → **Add New → Project** → import this repo.
2. Framework preset: **Other**, build command: *(none)*, output dir: *(root)*.
3. Deploy → HTTPS link mil jayega, e.g. `https://your-project.vercel.app`.

## Deploy (GitHub Pages)
Repo → Settings → Pages → Source: `main` / root. Link:
`https://<user>.github.io/<repo>/`

## Server list (cloud config)
`config.json` ke `configGist` me ek **secret gist raw URL** daalo:
`https://gist.githubusercontent.com/<user>/<gist-id>/raw/config.json`

Us gist me `servers` array update karo — site bina redeploy nayi list utha legi.
Example:
```json
{
  "servers": [
    { "name": "Teady Main", "url": "https://teady.up.railway.app", "note": "Main instance" },
    { "name": "Backup", "url": "https://xxxx.trycloudflare.com", "note": "Temporary tunnel" }
  ]
}
```

## Important
- Server URL **HTTPS** hona chahiye, warna browser mixed content block karega.
- Bot API me CORS enabled hona chahiye (`/status`, `/pair`) — Teady `lib/webPairing.js` me included hai.
- Pairing flow: `GET {server}/pair?phone=<number>` → `{ code }`, status: `GET {server}/status`.
