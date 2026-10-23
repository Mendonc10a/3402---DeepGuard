document.addEventListener('DOMContentLoaded', () => {

    // =========================================================
    // MECÂNICA DE ACESSIBILIDADE E TEMA
    // =========================================================
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;

    const dropdownToggle = document.getElementById('dropdown-toggle');
    const accessibilityMenu = document.getElementById('accessibility-menu');
    const fontDecrease = document.getElementById('font-decrease');
    const fontIncrease = document.getElementById('font-increase');
    const accessReset = document.getElementById('access-reset');

    let currentFontSize = 16;

    dropdownToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        accessibilityMenu.classList.toggle('show');
        dropdownToggle.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (!accessibilityMenu.contains(e.target) && e.target !== dropdownToggle) {
            accessibilityMenu.classList.remove('show');
            dropdownToggle.classList.remove('active');
        }
    });

    themeToggle.addEventListener('click', () => {
        if (body.classList.contains('dark-mode')) {
            body.classList.remove('dark-mode');
            body.classList.add('light-mode');
        } else {
            body.classList.remove('light-mode');
            body.classList.add('dark-mode');
        }
    });

    fontIncrease.addEventListener('click', () => {
        if (currentFontSize < 22) {
            currentFontSize += 1;
            document.documentElement.style.setProperty('--base-font-size', `${currentFontSize}px`);
        }
    });

    fontDecrease.addEventListener('click', () => {
        if (currentFontSize > 13) {
            currentFontSize -= 1;
            document.documentElement.style.setProperty('--base-font-size', `${currentFontSize}px`);
        }
    });

    accessReset.addEventListener('click', () => {
        currentFontSize = 16;
        document.documentElement.style.setProperty('--base-font-size', '16px');
    });

    // =========================================================
    // ELEMENTOS DE AUTENTICAÇÃO
    // =========================================================
    const loginScreen = document.getElementById('login-screen');
    const mainDashboard = document.getElementById('main-dashboard');
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginError = document.getElementById('login-error');
    const displayUser = document.getElementById('display-user');
    const btnLogout = document.getElementById('btn-logout');

    const boxLogin = document.getElementById('box-login');
    const boxRegister = document.getElementById('box-register');
    const goToRegister = document.getElementById('go-to-register');
    const goToLogin = document.getElementById('go-to-login');
    const registerForm = document.getElementById('register-form');
    const registerSuccess = document.getElementById('register-success');
    const registerError = document.getElementById('register-error');

    const regFullName = document.getElementById('reg-fullname');
    const regEmail = document.getElementById('reg-email');
    const regUsername = document.getElementById('reg-username');
    const regPassword = document.getElementById('reg-password');
    const regConfirmPassword = document.getElementById('reg-confirm-password');
    const passwordRequirementsList = document.getElementById('password-requirements');

    // Mostrar/ocultar senha em qualquer campo marcado
    document.querySelectorAll('.btn-toggle-pass').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetInput = document.getElementById(btn.getAttribute('data-target'));
            const icon = btn.querySelector('i');
            if (!targetInput) return;
            const isHidden = targetInput.type === 'password';
            targetInput.type = isHidden ? 'text' : 'password';
            icon.classList.toggle('fa-eye', !isHidden);
            icon.classList.toggle('fa-eye-slash', isHidden);
        });
    });

    // Checklist visual de força de senha em tempo real
    const PASSWORD_RULES = {
        length: (pw) => pw.length >= 8,
        upper: (pw) => /[A-Z]/.test(pw),
        lower: (pw) => /[a-z]/.test(pw),
        number: (pw) => /\d/.test(pw),
        special: (pw) => /[^A-Za-z0-9]/.test(pw)
    };

    function isPasswordStrong(pw) {
        return Object.values(PASSWORD_RULES).every(check => check(pw));
    }

    regPassword.addEventListener('input', () => {
        const pw = regPassword.value;
        passwordRequirementsList.querySelectorAll('li').forEach(li => {
            const rule = li.getAttribute('data-rule');
            const valid = PASSWORD_RULES[rule](pw);
            li.classList.toggle('valid', valid);
        });
    });

    // =========================================================
    // ELEMENTOS DO DASHBOARD
    // =========================================================
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const browseBtn = document.getElementById('browse-btn');
    const imagePreview = document.getElementById('image-preview');
    const uploadIcon = document.querySelector('.upload-icon');
    const dropText = document.querySelector('.drop-text');
    const fileInfo = document.querySelector('.file-info');

    const textInput = document.getElementById('text-input');
    const charCount = document.querySelector('.char-count');
    const btnAnalyze = document.getElementById('btn-analyze');

    const emptyResults = document.getElementById('empty-results');
    const resultsDisplay = document.getElementById('results-display');


    // Barra lateral de histórico
    const sidebarList = document.getElementById('sidebar-list');
    const sidebarEmpty = document.getElementById('sidebar-empty');
    const sidebarSearchInput = document.getElementById('sidebar-search-input');
    const btnNewAnalysis = document.getElementById('btn-new-analysis');

    let currentTab = 'tab-imagem';
    let hasImage = false;
    let hasValidText = false;
    let analysisPending = false;
    let currentFileName = '';
    let currentImageFile = null;

    let historyCache = [];      // guarda todo o histórico carregado do usuário
    let activeHistoryId = null; // id da análise atualmente sendo visualizada (ou null = tela nova)

    // =========================================================
    // HELPERS DE API
    // =========================================================
    async function apiRequest(url, options = {}) {
        const res = await fetch(url, {
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            ...options
        });
        let data = {};
        try { data = await res.json(); } catch (e) { /* corpo vazio */ }
        if (!res.ok) {
            const err = new Error(data.error || 'Erro na requisição.');
            err.status = res.status;
            throw err;
        }
        return data;
    }

    // =========================================================
    // SESSÃO — RESTAURA LOGIN AO CARREGAR A PÁGINA
    // =========================================================
    (async function initSession() {
        try {
            const { user } = await apiRequest('/api/me');
            await enterDashboard(user);
        } catch (e) {
            loginScreen.style.display = 'flex';
            mainDashboard.style.display = 'none';
        }
    })();

    async function enterDashboard(user) {
        loginScreen.style.display = 'none';
        mainDashboard.style.display = 'flex';
        displayUser.textContent = user.full_name || user.username;
        await loadHistoryAndCounters();
    }

    async function loadHistoryAndCounters() {
        try {
            const { history } = await apiRequest('/api/history');
            historyCache = history;
            renderSidebar(historyCache);
        } catch (e) {
            console.error('Falha ao carregar histórico:', e);
        }
    }


    function badgeClassFor(resultado) {
        return ['DEEPFAKE', 'IA'].includes(resultado) ? 'badge-deepfake'
            : ['AUTÊNTICO', 'HUMANO', 'REAL'].includes(resultado) ? 'badge-autentico'
            : 'badge-suspeito';
    }

    function iconClassFor(tipo) {
        return tipo === 'Imagem' ? 'fa-regular fa-image' : 'fa-regular fa-file-lines';
    }

    // =========================================================
    // BARRA LATERAL — HISTÓRICO DE ANÁLISES
    // =========================================================
    function renderSidebar(rows) {
        sidebarList.innerHTML = '';

        if (!rows.length) {
            sidebarEmpty.style.display = 'block';
            return;
        }
        sidebarEmpty.style.display = 'none';

        rows.forEach(row => {
            const dataFormatada = new Date(row.created_at)
                .toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

            const item = document.createElement('div');
            item.className = 'sidebar-item' + (row.id === activeHistoryId ? ' active' : '');
            item.setAttribute('data-id', row.id);
            item.innerHTML = `
                <div class="sidebar-item-top">
                    <span class="sidebar-item-title" title="${escapeHtml(row.origem)}">${escapeHtml(row.origem)}</span>
                    <span class="sidebar-item-date">${dataFormatada}</span>
                </div>
                <div class="sidebar-item-bottom">
                    <span class="sidebar-item-type"><i class="${iconClassFor(row.tipo)}"></i> ${escapeHtml(row.tipo)}</span>
                    <span class="badge badge-sm ${badgeClassFor(row.resultado)}">${escapeHtml(row.resultado)}</span>
                </div>
            `;
            item.addEventListener('click', () => openHistoryEntry(row.id));
            sidebarList.appendChild(item);
        });
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = String(str == null ? '' : str);
        return div.innerHTML;
    }

    function filterSidebar(query) {
        const q = query.trim().toLowerCase();
        if (!q) {
            renderSidebar(historyCache);
            return;
        }
        const filtered = historyCache.filter(row =>
            (row.origem || '').toLowerCase().includes(q) ||
            (row.tipo || '').toLowerCase().includes(q) ||
            (row.resultado || '').toLowerCase().includes(q) ||
            (row.detalhe || '').toLowerCase().includes(q)
        );
        renderSidebar(filtered);

        if (filtered.length === 0) {
            sidebarEmpty.textContent = 'Nada encontrado para essa busca.';
            sidebarEmpty.style.display = 'block';
        } else {
            sidebarEmpty.textContent = 'Nenhuma análise ainda.';
        }
    }

    sidebarSearchInput.addEventListener('input', (e) => filterSidebar(e.target.value));

    // Abre uma análise antiga vinda da barra lateral, mostrando o que foi identificado
    function renderTextAnalysis(analysis) {
        const trechos = Array.isArray(analysis.trechos) ? analysis.trechos : [];
        return `
            <h3>Resultado da análise de texto</h3>
            <p>Resumo experimental: <span class="badge ${badgeClassFor(analysis.resultado)}">${escapeHtml(analysis.resultado)}</span></p>
            <p>Pontuação média IA: ${(analysis.pontuacao_ia * 100).toFixed(2)}%</p>
            <p>Pontuação média humano: ${(analysis.pontuacao_humano * 100).toFixed(2)}%</p>
            <p>Todo o texto normalizado foi analisado: ${Number(analysis.caracteres_analisados)} caracteres em ${trechos.length} trecho(s).</p>
            <p class="analysis-note">${escapeHtml(analysis.aviso)}</p>
            <div class="chunk-results">${trechos.map(t => `
                <details class="chunk-result">
                    <summary>Trecho ${Number(t.numero)} · ${Number(t.caracteres)} caracteres · ${escapeHtml(t.resultado)} · pontuação IA ${(t.pontuacao_ia * 100).toFixed(2)}%</summary>
                    <p class="message-content">${escapeHtml(t.texto)}</p>
                </details>`).join('')}</div>`;
    }

    function renderImageAnalysis(analysis) {
        return `<h3>Resultado — Deep Guard V3</h3>
            <p>Classificação: <span class="badge ${badgeClassFor(analysis.resultado)}">${escapeHtml(analysis.resultado)}</span></p>
            <p>Pontuação IA: ${(analysis.pontuacao_ia * 100).toFixed(2)}%</p>
            <p>Pontuação REAL: ${(analysis.pontuacao_real * 100).toFixed(2)}%</p>
            <p class="analysis-note">${escapeHtml(analysis.aviso)}</p>`;
    }

    function openHistoryEntry(id) {
        const entry = historyCache.find(row => row.id === id);
        if (!entry) return;

        activeHistoryId = id;
        renderSidebar(sidebarSearchInput.value ? filteredCache() : historyCache);

        const dataFormatada = new Date(entry.created_at)
            .toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

        emptyResults.style.display = 'none';
        resultsDisplay.style.display = 'flex';
        resultsDisplay.style.flexDirection = 'column';
        resultsDisplay.innerHTML = `
            <div class="viewing-banner">
                <span><i class="fa-solid fa-clock-rotate-left"></i> Visualizando análise antiga (${dataFormatada})</span>
                <button id="btn-back-to-new">Nova análise</button>
            </div>
            <h3><i class="fa-solid fa-chart-pie"></i> Resultado da Análise de ${escapeHtml(entry.tipo)}</h3>
            <p class="simulated-text">Status retornado: <span class="badge ${badgeClassFor(entry.resultado)}">${escapeHtml(entry.resultado)}</span></p>
            <p class="sub-placeholder-text" style="margin-top:15px;">Identificado: ${escapeHtml(entry.origem)}</p>
            <section class="history-message" aria-label="Mensagem enviada">
                <h4>Mensagem enviada para análise</h4>
                ${typeof entry.mensagem === 'string'
                    ? `<div class="message-content">${escapeHtml(entry.mensagem)}</div>`
                    : '<p>O arquivo original não foi armazenado nesta análise.</p>'}
            </section>
            ${entry.analise?.versao_analise === 'trechos-v1' ? renderTextAnalysis(entry.analise) : ''}
            ${entry.analise?.versao_analise === 'imagem-v3' ? renderImageAnalysis(entry.analise) : ''}
            <h4>Resposta do detector</h4>
            ${entry.detalhe ? `<p class="sub-placeholder-text" style="margin-top:8px;">${escapeHtml(entry.detalhe)}</p>` : ''}
        `;
        document.getElementById('btn-back-to-new').addEventListener('click', startNewAnalysis);
    }

    function filteredCache() {
        const q = sidebarSearchInput.value.trim().toLowerCase();
        return historyCache.filter(row =>
            (row.origem || '').toLowerCase().includes(q) ||
            (row.tipo || '').toLowerCase().includes(q) ||
            (row.resultado || '').toLowerCase().includes(q) ||
            (row.detalhe || '').toLowerCase().includes(q)
        );
    }

    function startNewAnalysis() {
        activeHistoryId = null;
        renderSidebar(sidebarSearchInput.value ? filteredCache() : historyCache);
        resetDashboardFields();
    }

    btnNewAnalysis.addEventListener('click', startNewAnalysis);

    // =========================================================
    // MECÂNICA DE AUTENTICAÇÃO (LOGIN / REGISTRO)
    // =========================================================
    goToRegister.addEventListener('click', (e) => {
        e.preventDefault();
        boxLogin.style.display = 'none';
        boxRegister.style.display = 'block';
    });

    goToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        boxRegister.style.display = 'none';
        boxLogin.style.display = 'block';
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        registerError.style.display = 'none';

        const fullName = regFullName.value.trim();
        const email = regEmail.value.trim();
        const username = regUsername.value.trim();
        const password = regPassword.value;
        const confirmPassword = regConfirmPassword.value;

        if (password !== confirmPassword) {
            registerError.textContent = 'As senhas não coincidem.';
            registerError.style.display = 'block';
            return;
        }
        if (!isPasswordStrong(password)) {
            registerError.textContent = 'A senha não atende aos requisitos mínimos de segurança.';
            registerError.style.display = 'block';
            return;
        }

        try {
            await apiRequest('/api/register', {
                method: 'POST',
                body: JSON.stringify({ fullName, email, username, password, confirmPassword })
            });

            registerSuccess.style.display = 'block';
            setTimeout(async () => {
                registerSuccess.style.display = 'none';
                registerForm.reset();
                passwordRequirementsList.querySelectorAll('li').forEach(li => li.classList.remove('valid'));
                boxRegister.style.display = 'none';
                boxLogin.style.display = 'block';
                usernameInput.value = username;
            }, 1200);
        } catch (err) {
            registerError.textContent = err.message;
            registerError.style.display = 'block';
        }
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.style.display = 'none';

        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        try {
            const { user } = await apiRequest('/api/login', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });
            loginForm.reset();
            await enterDashboard(user);
        } catch (err) {
            loginError.textContent = err.message || 'Usuário ou senha incorretos!';
            loginError.style.display = 'block';
        }
    });

    btnLogout.addEventListener('click', async () => {
        try {
            await apiRequest('/api/logout', { method: 'POST' });
        } catch (e) { /* ignora erro de logout */ }
        mainDashboard.style.display = 'none';
        loginScreen.style.display = 'flex';
        historyCache = [];
        activeHistoryId = null;
        resetDashboardFields();
    });

    function resetDashboardFields() {
        currentImageFile = null;
        imagePreview.src = "";
        imagePreview.style.display = 'none';
        uploadIcon.style.display = 'block';
        dropText.style.display = 'block';
        fileInfo.style.display = 'block';
        fileInput.value = "";
        hasImage = false;

        textInput.value = "";
        charCount.textContent = "0 / 100 min";
        hasValidText = false;

        emptyResults.style.display = 'flex';
        resultsDisplay.style.display = 'none';
        disableButton();
    }

    // =========================================================
    // ABAS (TABS)
    // =========================================================
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            tab.classList.add('active');
            currentTab = tab.getAttribute('data-tab');

            document.getElementById(currentTab).classList.add('active');

            checkValidation();
        });
    });

    // =========================================================
    // CONTROLE DE UPLOAD DE IMAGEM
    // =========================================================
    browseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });

    dropZone.addEventListener('click', () => fileInput.click());

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
        }, false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length) handleFile(files[0]);
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleFile(e.target.files[0]);
    });

    function handleFile(file) {
        if (analysisPending) return;
        currentImageFile = null;
        hasImage = false;
        checkValidation();
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
            alert('Selecione JPG, PNG ou WEBP com até 10 MB.');
            return;
        }
        if (file.type.startsWith('image/')) {
            currentImageFile = file;
            currentFileName = file.name;
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                if (currentImageFile !== file) return;
                imagePreview.src = reader.result;
                imagePreview.style.display = 'block';
                uploadIcon.style.display = 'none';
                dropText.style.display = 'none';
                fileInfo.style.display = 'none';

                hasImage = true;
                checkValidation();
            };
            reader.onerror = () => {
                if (currentImageFile !== file) return;
                currentImageFile = null;
                hasImage = false;
                checkValidation();
                alert('Não foi possível ler a imagem. Selecione novamente.');
            };
        }
    }

    // =========================================================
    // CAMPO DE TEXTO E VALIDAÇÕES
    // =========================================================
    textInput.addEventListener('input', (e) => {
        const length = Array.from(e.target.value.normalize('NFKC').replace(/\s+/gu, ' ').trim()).length;
        charCount.textContent = `${length} caracteres — mínimo 100; análise de todo o texto por trechos`;

        hasValidText = length >= 100 && e.target.value.length <= 20000;
        checkValidation();
    });

    function checkValidation() {
        if (analysisPending) {
            disableButton();
        } else if ((currentTab === 'tab-texto' && hasValidText) || (currentTab === 'tab-imagem' && hasImage)) {
            enableButton();
        } else {
            disableButton();
        }
    }

    function enableButton() {
        btnAnalyze.removeAttribute('disabled');
        btnAnalyze.classList.add('enabled');
    }

    function disableButton() {
        btnAnalyze.setAttribute('disabled', 'true');
        btnAnalyze.classList.remove('enabled');
    }

    // =========================================================
    // BOTÃO DE ANÁLISE — SALVA O RESULTADO NO BANCO DE DADOS
    // =========================================================
    btnAnalyze.addEventListener('click', async () => {
        const imageMode = currentTab === 'tab-imagem';
        if (analysisPending || (imageMode ? !hasImage || !currentImageFile : !hasValidText)) return;
        activeHistoryId = null;
        analysisPending = true;
        checkValidation();
        emptyResults.style.display = 'none';
        resultsDisplay.style.display = 'flex';
        resultsDisplay.style.flexDirection = 'column';
        resultsDisplay.textContent = imageMode ? 'Analisando com Deep Guard V3... O primeiro carregamento pode demorar.' : 'Analisando o texto...';
        try {
            const { analysis, history } = await apiRequest(imageMode ? '/api/analyze/image' : '/api/analyze/text', imageMode ? {
                method: 'POST', headers: { 'Content-Type': currentImageFile.type, 'X-File-Name': encodeURIComponent(currentFileName) },
                body: currentImageFile
            } : {
                method: 'POST', body: JSON.stringify({ texto: textInput.value })
            });
            resultsDisplay.innerHTML = imageMode ? renderImageAnalysis(analysis) : renderTextAnalysis(analysis);
            historyCache = history;
            renderSidebar(sidebarSearchInput.value ? filteredCache() : historyCache);
        } catch (err) {
            resultsDisplay.textContent = err.message;
        } finally {
            analysisPending = false;
            checkValidation();
        }
    });
});
