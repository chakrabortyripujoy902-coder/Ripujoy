const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { v4: uuid } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = Number(process.env.PORT || 3000);
const OTP_DEMO_MODE = String(process.env.OTP_DEMO_MODE || 'true') === 'true';

app.use(express.json({ limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const otpStore = new Map();
const usersByPhone = new Map();
const chats = new Map();

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', app: 'Social Connect', uptimeSec: Math.round(process.uptime()) });
});

app.post('/api/auth/send-otp', (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone number is required' });

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  otpStore.set(phone, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });

  if (OTP_DEMO_MODE) {
    return res.json({ success: true, otp, message: 'OTP generated (demo mode)' });
  }

  // Replace this with real SMS provider integration in production.
  return res.json({ success: true, message: 'OTP sent successfully' });
});

app.post('/api/auth/verify-otp', (req, res) => {
  const { phone, otp } = req.body;
  const data = otpStore.get(phone);
  if (!data || data.otp !== otp || data.expiresAt < Date.now()) {
    return res.status(401).json({ error: 'Invalid or expired OTP' });
  }

  let user = usersByPhone.get(phone);
  if (!user) {
    user = { id: uuid(), phone, name: '', country: '' };
    usersByPhone.set(phone, user);
  }

  otpStore.delete(phone);
  return res.json({ success: true, user });
});

app.post('/api/auth/register', (req, res) => {
  const { phone, name, country } = req.body;
  const user = usersByPhone.get(phone);
  if (!user) return res.status(404).json({ error: 'User not found. Verify OTP first.' });
  if (!name || !country) return res.status(400).json({ error: 'Name and country are required' });

  user.name = name;
  user.country = country;
  return res.json({ success: true, user });
});

app.get('/api/users', (_req, res) => {
  res.json([...usersByPhone.values()].filter((u) => u.name));
});

io.on('connection', (socket) => {
  socket.on('join-user', (userId) => {
    socket.join(`user:${userId}`);
  });

  socket.on('create-chat', ({ type, name, participants }, ack) => {
    const uniqueParticipants = [...new Set(participants || [])];
    if (!uniqueParticipants.length) return ack?.({ error: 'No participants provided' });

    const id = uuid();
    const chat = {
      id,
      type: type === 'group' ? 'group' : 'direct',
      name: name || '',
      participants: uniqueParticipants,
      messages: []
    };

    chats.set(id, chat);
    uniqueParticipants.forEach((uid) => io.to(`user:${uid}`).emit('chat-updated', chat));
    return ack?.(chat);
  });

  socket.on('send-message', ({ chatId, senderId, text, attachment }, ack) => {
    const chat = chats.get(chatId);
    if (!chat) return ack?.({ error: 'Chat not found' });

    const message = {
      id: uuid(),
      senderId,
      text: text || '',
      attachment: attachment || null,
      createdAt: new Date().toISOString()
    };

    chat.messages.push(message);
    chat.participants.forEach((uid) => io.to(`user:${uid}`).emit('message', { chatId, message }));
    return ack?.({ success: true, message });
  });

  socket.on('get-chats', (userId, ack) => {
    const userChats = [...chats.values()].filter((c) => c.participants.includes(userId));
    return ack?.(userChats);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Social Connect running on http://0.0.0.0:${PORT}`);
});
