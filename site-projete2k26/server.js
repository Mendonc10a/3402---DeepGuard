const path = require('path');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  name: 'deepguard.sid',
  secret: process.env.SESSION_SECRET || 'deepguard-ai-troque-este-segredo',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    secure: isProduction, // exige HTTPS em produção
    maxAge: 1000 * 60 * 60 * 24 * 7 // 7 dias
  }
}));

// -----------------------------------------------------------------
// VALIDAÇÃO
// -----------------------------------------------------------------
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Mínimo 8 caracteres, pelo menos 1 maiúscula, 1 minúscula, 1 número e 1 símbolo
const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_.]{3,20}$/;

function validatePasswordStrength(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'A senha deve ter pelo menos 8 caracteres.';
  }
  if (password.length > 128) {
    return 'A senha é longa demais.';
  }
  if (!/[a-z]/.test(password)) return 'A senha deve conter ao menos uma letra minúscula.';
  if (!/[A-Z]/.test(password)) return 'A senha deve conter ao menos uma letra maiúscula.';
  if (!/\d/.test(password)) return 'A senha deve conter ao menos um número.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'A senha deve conter ao menos um caractere especial (ex: ! @ # $ %).';
  return null;
}

// -----------------------------------------------------------------
// MIDDLEWARE DE AUTENTICAÇÃO
// -----------------------------------------------------------------
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }
  next();
}

// -----------------------------------------------------------------
// ROTAS DE AUTENTICAÇÃO
// -----------------------------------------------------------------

// Cadastro de novo usuário
app.post('/api/register', (req, res) => {
  const { fullName, email, username, password, confirmPassword } = req.body || {};

  if (!fullName || !email || !username || !password || !confirmPassword) {
    return res.status(400).json({ error: 'Preencha nome completo, e-mail, usuário e senha.' });
  }
  if (String(fullName).trim().length < 3) {
    return res.status(400).json({ error: 'Informe seu nome completo.' });
  }
  if (!EMAIL_REGEX.test(String(email).trim())) {
    return res.status(400).json({ error: 'Informe um e-mail válido.' });
  }
  if (!USERNAME_REGEX.test(String(username).trim())) {
    return res.status(400).json({ error: 'O usuário deve ter de 3 a 20 caracteres (letras, números, "_" ou ".").' });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'As senhas não coincidem.' });
  }
  const passwordError = validatePasswordStrength(password);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  const existing = db.getUserByEmailOrUsername(email.trim(), username.trim());
  if (existing) {
    return res.status(409).json({ error: 'E-mail ou usuário já cadastrado.' });
  }

  const passwordHash = bcrypt.hashSync(password, 12);
  const newId = db.insertUser(email.trim(), username.trim(), passwordHash, fullName.trim());

  req.session.userId = newId;
  res.status(201).json({ user: db.getUserById(newId) });
});

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Informe usuário e senha.' });
  }

  const lockStatus = db.isLockedOut(username);
  if (lockStatus.locked) {
    const minutes = Math.ceil(lockStatus.retryAfterMs / 60000);
    return res.status(429).json({
      error: `Muitas tentativas incorretas. Tente novamente em ${minutes} minuto(s).`
    });
  }

  const user = db.getUserByUsername(username);
  const validCredentials = user && bcrypt.compareSync(password, user.password_hash);

  if (!validCredentials) {
    db.registerFailedLogin(username);
    return res.status(401).json({ error: 'Usuário ou senha incorretos!' });
  }

  db.resetLoginAttempts(username);
  req.session.userId = user.id;
  res.json({ user: db.getUserById(user.id) });
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('deepguard.sid');
    res.json({ ok: true });
  });
});

// Retorna o usuário logado (usado para restaurar sessão ao recarregar a página)
app.get('/api/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Não autenticado.' });
  const user = db.getUserById(req.session.userId);
  if (!user) return res.status(401).json({ error: 'Não autenticado.' });
  res.json({ user });
});

// -----------------------------------------------------------------
// ROTAS DE HISTÓRICO E CONTADORES (por usuário)
// -----------------------------------------------------------------

// Lista o histórico e os contadores do usuário logado
app.get('/api/history', requireAuth, (req, res) => {
  res.json({
    history: db.listHistoryByUser(req.session.userId),
    counters: db.countersByUser(req.session.userId)
  });
});

// Retorna uma entrada específica do histórico (usado pela barra lateral
// para reabrir uma análise antiga e mostrar o que foi identificado)
app.get('/api/history/:id', requireAuth, (req, res) => {
  const entry = db.getHistoryEntry(req.session.userId, req.params.id);
  if (!entry) return res.status(404).json({ error: 'Análise não encontrada.' });
  res.json({ entry });
});

// Registra uma nova análise no histórico do usuário logado
app.post('/api/history', requireAuth, (req, res) => {
  const { tipo, origem, resultado, detalhe } = req.body || {};
  const resultadosValidos = ['DEEPFAKE', 'AUTÊNTICO', 'SUSPEITOS'];

  if (!tipo || !origem || !resultadosValidos.includes(resultado)) {
    return res.status(400).json({ error: 'Dados de análise inválidos.' });
  }

  db.insertHistory(req.session.userId, tipo, origem, resultado, detalhe);

  res.status(201).json({
    history: db.listHistoryByUser(req.session.userId),
    counters: db.countersByUser(req.session.userId)
  });
});

app.listen(PORT, () => {
  console.log(`DeepGuard AI rodando em http://localhost:${PORT}`);
});
