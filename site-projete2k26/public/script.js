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

    const countTotais = document.getElementById('count-totais');
    const countDeepfakes = document.getElementById('count-deepfakes');
    const countAutenticos = document.getElementById('count-autenticos');
    const countSuspeitos = document.getElementById('count-suspeitos');

    // Barra lateral de histórico
    const sidebarList = document.getElementById('sidebar-list');
    const sidebarEmpty = document.getElementById('sidebar-empty');
    const sidebarSearchInput = document.getElementById('sidebar-search-input');
    const btnNewAnalysis = document.getElementById('btn-new-analysis');

    let currentTab = 'tab-imagem';
    let hasImage = false;
    let hasValidText = false;
    let currentFileName = '';

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
            const { history, counters } = await apiRequest('/api/history');
            historyCache = history;
            renderCounters(counters);
            renderSidebar(historyCache);
        } catch (e) {
            console.error('Falha ao carregar histórico:', e);
        }
    }

    function renderCounters(counters) {
        countTotais.textContent = String(counters.total).padStart(3, '0');
        countDeepfakes.textContent = String(counters.deepfakes).padStart(3, '0');
        countAutenticos.textContent = String(counters.autenticos).padStart(3, '0');
        countSuspeitos.textContent = String(counters.suspeitos).padStart(3, '0');
    }

    function badgeClassFor(resultado) {
        return resultado === 'DEEPFAKE' ? 'badge-deepfake'
            : resultado === 'AUTÊNTICO' ? 'badge-autentico'
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
                    <span class="sidebar-item-type"><i class="${iconClassFor(row.tipo)}"></i> ${row.tipo}</span>
                    <span class="badge badge-sm ${badgeClassFor(row.resultado)}">${row.resultado}</span>
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
            <h3><i class="fa-solid fa-chart-pie"></i> Resultado da Análise de ${entry.tipo}</h3>
            <p class="simulated-text">Status retornado: <span class="badge ${badgeClassFor(entry.resultado)}">${entry.resultado}</span></p>
            <p class="sub-placeholder-text" style="margin-top:15px;">Identificado: ${escapeHtml(entry.origem)}</p>
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
        imagePreview.src = "";
        imagePreview.style.display = 'none';
        uploadIcon.style.display = 'block';
        dropText.style.display = 'block';
        fileInfo.style.display = 'block';
        fileInput.value = "";
        hasImage = false;

        textInput.value = "";
        charCount.textContent = "0 / 20 min";
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
        if (file.type.startsWith('image/')) {
            currentFileName = file.name;
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                imagePreview.src = reader.result;
                imagePreview.style.display = 'block';
                uploadIcon.style.display = 'none';
                dropText.style.display = 'none';
                fileInfo.style.display = 'none';

                hasImage = true;
                checkValidation();
            };
        }
    }

    // =========================================================
    // CAMPO DE TEXTO E VALIDAÇÕES
    // =========================================================
    textInput.addEventListener('input', (e) => {
        const length = e.target.value.length;
        charCount.textContent = `${length} / 20 min`;

        hasValidText = length >= 20;
        checkValidation();
    });

    function checkValidation() {
        if (currentTab === 'tab-imagem' && hasImage) {
            enableButton();
        } else if (currentTab === 'tab-texto' && hasValidText) {
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
        if (!btnAnalyze.classList.contains('enabled')) return;

        activeHistoryId = null; // nova análise, sai do modo "visualização"

        emptyResults.style.display = 'none';
        resultsDisplay.style.display = 'flex';

        // Simulação do resultado da IA (substitua por uma chamada real ao seu modelo quando disponível)
        const statuses = ['DEEPFAKE', 'AUTÊNTICO', 'SUSPEITOS'];
        const resultadoFinal = statuses[Math.floor(Math.random() * statuses.length)];
        const badgeResultClass = badgeClassFor(resultadoFinal);

        let tipoAnalise = '';
        let origemInfo = '';
        let detalheInfo = '';

        if (currentTab === 'tab-imagem') {
            tipoAnalise = 'Imagem';
            origemInfo = currentFileName || 'imagem_upload.png';
            detalheInfo = `Arquivo "${origemInfo}" escaneado com sucesso e computado no banco.`;

            resultsDisplay.innerHTML = `
                <h3><i class="fa-solid fa-chart-pie"></i> Resultado da Análise de Imagem</h3>
                <p class="simulated-text">Status retornado: <span class="badge ${badgeResultClass}">${resultadoFinal}</span></p>
                <p class="sub-placeholder-text" style="margin-top:15px;">${detalheInfo}</p>
            `;
        } else {
            tipoAnalise = 'Texto';
            origemInfo = `"${textInput.value.substring(0, 18)}..."`;
            detalheInfo = textInput.value;

            resultsDisplay.innerHTML = `
                <h3><i class="fa-solid fa-chart-pie"></i> Resultado da Análise de Texto</h3>
                <p class="simulated-text">Status retornado: <span class="badge ${badgeResultClass}">${resultadoFinal}</span></p>
                <p class="sub-placeholder-text" style="margin-top:15px;">String de caracteres validada e adicionada à auditoria.</p>
            `;
        }

        try {
            const { history, counters } = await apiRequest('/api/history', {
                method: 'POST',
                body: JSON.stringify({ tipo: tipoAnalise, origem: origemInfo, resultado: resultadoFinal, detalhe: detalheInfo })
            });
            historyCache = history;
            renderCounters(counters);
            renderSidebar(sidebarSearchInput.value ? filteredCache() : historyCache);
        } catch (err) {
            console.error('Falha ao salvar análise no banco de dados:', err);
        }
    });
});
