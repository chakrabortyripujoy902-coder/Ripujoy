# Social Connect

Social Connect is a lightweight WhatsApp-like chat prototype with:
- Phone + OTP authentication
- User profile registration (Name + Country)
- 1:1 direct chat
- Group chats
- File sharing (images, videos, audios, and generic files)
- Realtime messaging with Socket.IO
- White + light purple UI theme

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:3000`.

## Publish / Deploy

### Option A: Deploy with Docker (any cloud VM/container platform)

```bash
docker build -t social-connect .
docker run -p 3000:3000 --env-file .env.example social-connect
```

### Option B: Deploy on Render / Railway / Fly.io

1. Push this repository to GitHub.
2. Create a new Web Service from the repo.
3. Use build command: `npm install`
4. Use start command: `npm start`
5. Add environment variables:
   - `PORT=3000`
   - `NODE_ENV=production`
   - `OTP_DEMO_MODE=false`

## Production note

When `OTP_DEMO_MODE=false`, the API no longer returns OTP in responses. Integrate your SMS provider inside `POST /api/auth/send-otp`.

## Health check

Use `GET /api/health` to verify the app is online.
