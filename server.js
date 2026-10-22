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

// O resultado e o histórico são produzidos pelo servidor, nunca pelo navegador.
let analyzing = false;
app.post('/api/analyze/text', requireAuth, async (req, res) => {
  const texto = req.body?.texto;
  if (typeof texto !== 'string' || texto.length > 20000 ||
      texto.normalize('NFKC').replace(/\s+/gu, ' ').trim().length < 100) {
    return res.status(400).json({ error: 'Informe de 100 a 20.000 caracteres.' });
  }
  if (analyzing) return res.status(429).json({ error: 'Outra análise está em andamento. Tente novamente.' });
  analyzing = true;
  try {
    const response = await fetch(`http://127.0.0.1:${process.env.MODEL_PORT || 8001}/analyze`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto }), signal: AbortSignal.timeout(30000)
    });
    const analysis = await response.json();
    if (!response.ok) return res.status(response.status).json(analysis);
    if (!['IA', 'HUMANO'].includes(analysis.resultado) || !Number.isFinite(analysis.pontuacao_ia)) {
      throw new Error('Resposta inválida do serviço de inferência.');
    }
    const detalhe = `Resumo experimental: ${analysis.resultado}. Pontuação média IA: ${(analysis.pontuacao_ia * 100).toFixed(2)}%. ` +
      `Analisados ${analysis.caracteres_analisados} caracteres em ${analysis.quantidade_trechos} trechos. ${analysis.aviso}`;
    // Salva a mensagem original e a resposta no histórico do usuário autenticado.
    db.insertHistory(req.session.userId, 'Texto', texto.replace(/\s+/g, ' ').trim().slice(0, 65), analysis.resultado, detalhe, texto, analysis);
    res.json({ analysis, history: db.listHistoryByUser(req.session.userId),
               counters: db.countersByUser(req.session.userId) });
  } catch (err) {
    res.status(503).json({ error: 'Serviço de IA indisponível. Inicie o inference.py e tente novamente.' });
  } finally { analyzing = false; }
});

app.post('/api/analyze/image', requireAuth,
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '10mb' }),
  async (req, res) => {
    if (!Buffer.isBuffer(req.body) || !req.body.length) {
      return res.status(400).json({ error: 'Envie JPG, PNG ou WEBP com até 10 MB.' });
    }
    if (analyzing) return res.status(429).json({ error: 'Outra análise está em andamento. Tente novamente.' });
    analyzing = true;
    try {
      const response = await fetch(`http://127.0.0.1:${process.env.MODEL_PORT || 8001}/analyze/image`, {
        method: 'POST', headers: { 'Content-Type': req.get('Content-Type') },
        body: req.body, signal: AbortSignal.timeout(180000)
      });
      const analysis = await response.json();
      if (!response.ok) return res.status(response.status).json(analysis);
      if (!['IA', 'REAL'].includes(analysis.resultado) || analysis.versao_analise !== 'imagem-v3' ||
          !Number.isFinite(analysis.pontuacao_ia) || analysis.pontuacao_ia < 0 || analysis.pontuacao_ia > 1) {
        throw new Error('Resposta inválida da V3.');
      }
      let filename = 'Imagem';
      try { filename = decodeURIComponent(req.get('X-File-Name') || 'Imagem').slice(0, 200); } catch (_) {}
      const detalhe = `Deep Guard V3: ${analysis.resultado}. Pontuação IA: ${(analysis.pontuacao_ia * 100).toFixed(2)}%. ${analysis.aviso}`;
      db.insertHistory(req.session.userId, 'Imagem', filename, analysis.resultado, detalhe, null, analysis);
      res.json({ analysis, history: db.listHistoryByUser(req.session.userId), counters: db.countersByUser(req.session.userId) });
    } catch (err) {
      res.status(503).json({ error: 'Serviço de imagem indisponível ou tempo excedido. Confira o inference.py.' });
    } finally { analyzing = false; }
  });

app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Arquivo grande demais. Limite de imagem: 10 MB.' });
  res.status(400).json({ error: 'Requisição inválida.' });
});

app.listen(PORT, () => {
  console.log(`DeepGuard AI rodando em http://localhost:${PORT}`);
});
