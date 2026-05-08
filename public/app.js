const socket = io();
let currentUser = null;
let selectedChatId = null;
let chats = [];

async function sendOtp() {
  const phone = phoneEl().value;
  const r = await fetch('/api/auth/send-otp', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ phone })});
  const d = await r.json();
  statusEl().textContent = d.error || `OTP sent (demo): ${d.otp}`;
}

async function verifyOtp() {
  const phone = phoneEl().value;
  const otp = document.getElementById('otp').value;
  const r = await fetch('/api/auth/verify-otp', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ phone, otp })});
  const d = await r.json();
  if (d.user) {
    currentUser = d.user;
    statusEl().textContent = 'OTP verified. Complete registration.';
  } else statusEl().textContent = d.error;
}

async function registerUser() {
  const body = { phone: phoneEl().value, name: document.getElementById('name').value, country: document.getElementById('country').value };
  const r = await fetch('/api/auth/register', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body)});
  const d = await r.json();
  if (!d.user) return statusEl().textContent = d.error;
  currentUser = d.user;
  socket.emit('join-user', currentUser.id);
  document.getElementById('authSection').classList.add('hidden');
  document.getElementById('chatSection').classList.remove('hidden');
  loadUsers();
  refreshChats();
}

async function loadUsers() {
  const users = await (await fetch('/api/users')).json();
  const peers = users.filter(u => u.id !== currentUser.id);
  const container = document.getElementById('users');
  const groupContainer = document.getElementById('groupUsers');
  container.innerHTML = '';
  groupContainer.innerHTML = '';

  peers.forEach(u => {
    container.innerHTML += `<div class="user-item">${u.name} (${u.country}) <button onclick="startDirect('${u.id}','${u.name}')">Chat</button></div>`;
    groupContainer.innerHTML += `<label><input type="checkbox" value="${u.id}"/> ${u.name}</label><br/>`;
  });
}

function startDirect(peerId, peerName) {
  socket.emit('create-chat', { type:'direct', name: peerName, participants:[currentUser.id, peerId] }, (chat) => {
    refreshChats();
    openChat(chat.id, chat.name || 'Direct Chat');
  });
}

function createGroup() {
  const ids = [...document.querySelectorAll('#groupUsers input:checked')].map(i => i.value);
  const name = document.getElementById('groupName').value || 'New Group';
  socket.emit('create-chat', { type:'group', name, participants:[currentUser.id, ...ids] }, (chat) => {
    refreshChats();
    openChat(chat.id, name);
  });
}

function refreshChats() {
  socket.emit('get-chats', currentUser.id, (items) => {
    chats = items;
    const c = document.getElementById('chats');
    c.innerHTML = '';
    chats.forEach(chat => {
      c.innerHTML += `<div class="chat-item"><b>${chat.name || 'Direct Chat'}</b><button onclick="openChat('${chat.id}','${chat.name || 'Direct Chat'}')">Open</button></div>`;
    });
  });
}

function openChat(id, name) {
  selectedChatId = id;
  document.getElementById('chatTitle').textContent = name;
  renderMessages();
}

function renderMessages() {
  const chat = chats.find(c => c.id === selectedChatId);
  const area = document.getElementById('messages');
  if (!chat) return area.innerHTML = '';
  area.innerHTML = chat.messages.map(m => {
    const mine = m.senderId === currentUser.id ? 'You' : m.senderId;
    let media = '';
    if (m.attachment) {
      if (m.attachment.type.startsWith('image/')) media = `<img src="${m.attachment.dataUrl}" width="180"/>`;
      else if (m.attachment.type.startsWith('video/')) media = `<video controls width="220" src="${m.attachment.dataUrl}"></video>`;
      else if (m.attachment.type.startsWith('audio/')) media = `<audio controls src="${m.attachment.dataUrl}"></audio>`;
      else media = `<a href="${m.attachment.dataUrl}" download="${m.attachment.name}">${m.attachment.name}</a>`;
    }
    return `<div class='msg'><b>${mine}</b>: ${m.text || ''}<br/>${media}</div>`;
  }).join('');
}

async function sendMessage() {
  if (!selectedChatId) return;
  const text = document.getElementById('messageInput').value;
  const file = document.getElementById('fileInput').files[0];
  let attachment = null;
  if (file) attachment = { name: file.name, type: file.type, dataUrl: await toDataUrl(file) };

  socket.emit('send-message', { chatId: selectedChatId, senderId: currentUser.id, text, attachment }, () => {
    document.getElementById('messageInput').value = '';
    document.getElementById('fileInput').value = '';
  });
}

socket.on('message', ({ chatId, message }) => {
  const chat = chats.find(c => c.id === chatId);
  if (chat) chat.messages.push(message);
  if (chatId === selectedChatId) renderMessages();
  refreshChats();
});

socket.on('chat-updated', refreshChats);

function toDataUrl(file) {
  return new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.readAsDataURL(file);
  });
}

const phoneEl = () => document.getElementById('phone');
const statusEl = () => document.getElementById('authStatus');
