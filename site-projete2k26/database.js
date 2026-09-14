const fs = require('fs');
const path = require('path');

// Arquivo físico do "banco de dados" (persistente em disco, 100% JavaScript,
// sem nenhuma dependência nativa/compilada — funciona em qualquer sistema).
const DB_FILE = path.join(__dirname, 'deepguard.db.json');

function loadRaw() {
  if (!fs.existsSync(DB_FILE)) {
    const initial = { nextUserId: 1, nextHistoryId: 1, users: [], history: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  const content = fs.readFileSync(DB_FILE, 'utf-8');
  return JSON.parse(content);
}

function saveRaw(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ---------------------------------------------------------------
// USUÁRIOS
// ---------------------------------------------------------------
function getUserById(id) {
  const data = loadRaw();
  const u = data.users.find(u => u.id === id);
  if (!u) return null;
  const { password_hash, ...safe } = u;
  return safe;
}

function getUserByUsername(username) {
  const data = loadRaw();
  return data.users.find(u => u.username.toLowerCase() === String(username).toLowerCase()) || null;
}

function getUserByEmailOrUsername(email, username) {
  const data = loadRaw();
  return data.users.find(u =>
    u.email.toLowerCase() === String(email).toLowerCase() ||
    u.username.toLowerCase() === String(username).toLowerCase()
  ) || null;
}

function insertUser(email, username, passwordHash, fullName) {
  const data = loadRaw();
  const id = data.nextUserId++;
  const user = {
    id,
    email,
    username,
    full_name: fullName,
    password_hash: passwordHash,
    created_at: new Date().toISOString()
  };
  data.users.push(user);
  saveRaw(data);
  return id;
}

// ---------------------------------------------------------------
// CONTROLE DE TENTATIVAS DE LOGIN (proteção contra força bruta)
// ---------------------------------------------------------------
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutos

// Guardado em memória (por processo). Suficiente para conter tentativas
// automatizadas de adivinhação de senha entre requisições consecutivas.
const loginAttempts = new Map(); // key: username em minúsculo -> { count, lockUntil }

function getLoginState(username) {
  const key = String(username).toLowerCase();
  return loginAttempts.get(key) || { count: 0, lockUntil: 0 };
}

function isLockedOut(username) {
  const state = getLoginState(username);
  if (state.lockUntil && state.lockUntil > Date.now()) {
    return { locked: true, retryAfterMs: state.lockUntil - Date.now() };
  }
  return { locked: false, retryAfterMs: 0 };
}

function registerFailedLogin(username) {
  const key = String(username).toLowerCase();
  const state = getLoginState(username);
  state.count += 1;
  if (state.count >= MAX_LOGIN_ATTEMPTS) {
    state.lockUntil = Date.now() + LOCKOUT_DURATION_MS;
    state.count = 0;
  }
  loginAttempts.set(key, state);
}

function resetLoginAttempts(username) {
  const key = String(username).toLowerCase();
  loginAttempts.delete(key);
}

// ---------------------------------------------------------------
// HISTÓRICO
// ---------------------------------------------------------------
function insertHistory(userId, tipo, origem, resultado, detalhe) {
  const data = loadRaw();
  const id = data.nextHistoryId++;
  data.history.push({
    id,
    user_id: userId,
    tipo,
    origem,
    resultado,
    detalhe: detalhe || '',
    created_at: new Date().toISOString()
  });
  saveRaw(data);
}

function listHistoryByUser(userId) {
  const data = loadRaw();
  return data.history
    .filter(h => h.user_id === userId)
    .sort((a, b) => b.id - a.id)
    .map(({ user_id, ...rest }) => rest);
}

function getHistoryEntry(userId, historyId) {
  const data = loadRaw();
  const entry = data.history.find(h => h.user_id === userId && h.id === Number(historyId));
  if (!entry) return null;
  const { user_id, ...safe } = entry;
  return safe;
}

function countersByUser(userId) {
  const data = loadRaw();
  const rows = data.history.filter(h => h.user_id === userId);
  return {
    total: rows.length,
    deepfakes: rows.filter(r => r.resultado === 'DEEPFAKE').length,
    autenticos: rows.filter(r => r.resultado === 'AUTÊNTICO').length,
    suspeitos: rows.filter(r => r.resultado === 'SUSPEITOS').length
  };
}

module.exports = {
  getUserById,
  getUserByUsername,
  getUserByEmailOrUsername,
  insertUser,
  isLockedOut,
  registerFailedLogin,
  resetLoginAttempts,
  insertHistory,
  listHistoryByUser,
  getHistoryEntry,
  countersByUser
};
